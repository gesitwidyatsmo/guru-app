import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { extractTingkat } from '@/utils/erapor';
import {
	convertMapelScoreToEkskul,
	getDefaultNarasiEkskul,
	getOfficialEkskulName,
	isEkskulApplicableForTingkat,
} from '@/lib/eraporEkskulUtils';

async function getAuthInfo(request, supabase) {
	const cookieStore = await cookies();
	let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
	let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;

	if (!role || !userId) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: userProfile } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('auth_id', user.id)
				.maybeSingle();
			if (userProfile) {
				role = role || userProfile.role;
				userId = userId || userProfile.id_user;
			}
		}
	}

	if (!userId) {
		const rawName = request.headers.get('x-user-name') || cookieStore.get('user_name')?.value;
		if (rawName) {
			const userName = decodeURIComponent(rawName);
			const { data: u } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('nama_lengkap', userName)
				.maybeSingle();
			if (u) {
				userId = u.id_user;
				role = role || u.role;
			}
		}
	}

	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const { searchParams } = new URL(request.url);
		const kelasId = searchParams.get('kelas_id');
		const semester = parseInt(searchParams.get('semester') || '1', 10);
		const tahunAjaran = searchParams.get('tahun_ajaran');

		if (!kelasId) {
			return NextResponse.json({ error: 'kelas_id wajib disertakan' }, { status: 400 });
		}

		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas, id_wali_kelas, wali_kelas')
			.eq('id', kelasId)
			.single();
		if (kelasErr) throw kelasErr;

		// Validasi Wali Kelas untuk role Guru
		if (role === 'Guru' && userId) {
			const isDirectWali = kelasData.id_wali_kelas === userId;
			let isRelasiWali = false;
			if (!isDirectWali) {
				const { data: relasi } = await supabase
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('id_kelas', kelasId)
					.eq('is_active', true)
					.maybeSingle();
				if (relasi) isRelasiWali = true;
			}
			let isNameWali = false;
			if (!isDirectWali && !isRelasiWali && kelasData.wali_kelas) {
				const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
				if (userRow?.nama_lengkap && kelasData.wali_kelas.includes(userRow.nama_lengkap)) {
					isNameWali = true;
				}
			}
			if (!isDirectWali && !isRelasiWali && !isNameWali) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat mengakses data ekstrakurikuler rombel ini.' },
					{ status: 403 }
				);
			}
		}

		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });
		if (siswaErr) throw siswaErr;

		const siswaIds = (siswaList || []).map((s) => s.id);

		// Ambil seluruh mapel berkategori Ekskul / Ciri Khas (Opsi A)
		const { data: ekskulMapels } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi, kelompok')
			.or('kelompok.eq.Ekskul,id.in.("MP-ASW","MP-KHOT")');

		const ekskulMapelIds = (ekskulMapels || []).map((m) => m.id);
		const targetMapelIds = ekskulMapelIds.length > 0 ? ekskulMapelIds : ['MP-ASW', 'MP-KHOT'];

		let existingEkskul = [];
		let kuantitatifScores = [];
		let kualitatifScores = [];

		if (tahunAjaran && siswaIds.length > 0) {
			const [ekskulRes, kuantRes, kualRes] = await Promise.all([
				supabase
					.from('rapor_ekstrakurikuler')
					.select('*')
					.eq('kelas_id', kelasId)
					.eq('semester', semester)
					.eq('tahun_ajaran', tahunAjaran),
				supabase
					.from('rapor_nilai_kuantitatif')
					.select('siswa_id, mapel_id, nilai_akhir')
					.in('siswa_id', siswaIds)
					.in('mapel_id', targetMapelIds)
					.eq('semester', semester)
					.eq('tahun_ajaran', tahunAjaran),
				supabase
					.from('rapor_nilai_kualitatif')
					.select('siswa_id, mapel_id, deskripsi_tertinggi')
					.in('siswa_id', siswaIds)
					.in('mapel_id', targetMapelIds)
					.eq('semester', semester)
					.eq('tahun_ajaran', tahunAjaran),
			]);

			existingEkskul = ekskulRes.data || [];
			kuantitatifScores = kuantRes.data || [];
			kualitatifScores = kualRes.data || [];
		}

		// Buat dictionary nilai kuantitatif & kualitatif per siswa:
		const mapelScoreMap = {};
		kuantitatifScores.forEach((row) => {
			if (!mapelScoreMap[row.siswa_id]) mapelScoreMap[row.siswa_id] = {};
			mapelScoreMap[row.siswa_id][row.mapel_id] = { nilai_akhir: row.nilai_akhir };
		});
		kualitatifScores.forEach((row) => {
			if (!mapelScoreMap[row.siswa_id]) mapelScoreMap[row.siswa_id] = {};
			if (!mapelScoreMap[row.siswa_id][row.mapel_id]) {
				mapelScoreMap[row.siswa_id][row.mapel_id] = {};
			}
			mapelScoreMap[row.siswa_id][row.mapel_id].deskripsi = row.deskripsi_tertinggi;
		});

		const tingkatKelas = extractTingkat(kelasData.nama_kelas);

		// Map ekskul per siswa (bisa lebih dari satu per siswa)
		const ekskulMap = {};
		(siswaList || []).forEach((s) => {
			const studentEkskuls = existingEkskul
				.filter((e) => e.siswa_id === s.id)
				.filter((e) => {
					const eName = e.nama_ekskul || e.nama_kegiatan || '';
					return isEkskulApplicableForTingkat(eName, tingkatKelas);
				})
				.map((e) => ({
					id: e.id,
					nama_ekskul: e.nama_kegiatan || e.nama_ekskul,
					nama_kegiatan: e.nama_kegiatan || e.nama_ekskul,
					predikat: e.predikat || 'Baik',
					keterangan: e.keterangan || '',
					is_auto_synced: false,
				}));

			// 1. Sinkronisasi otomatis dari seluruh mapel berkategori Ekskul / Ciri Khas (Opsi A)
			(ekskulMapels || []).forEach((em) => {
				if (!isEkskulApplicableForTingkat(em.id, tingkatKelas)) return;
				const emName = em.nama_resmi || getOfficialEkskulName(em.id, em);
				const emKeyword = (em.mapel || em.id || '').toLowerCase();

				const hasItem = studentEkskuls.some((e) => {
					const name = (e.nama_ekskul || e.nama_kegiatan || '').toLowerCase();
					return name === emName.toLowerCase() || name.includes(emKeyword);
				});

				if (!hasItem) {
					const scoreObj = mapelScoreMap[s.id]?.[em.id];
					if (scoreObj && scoreObj.nilai_akhir !== undefined && scoreObj.nilai_akhir !== null) {
						studentEkskuls.push(
							convertMapelScoreToEkskul(em.id, scoreObj.nilai_akhir, scoreObj.deskripsi)
						);
					} else {
						studentEkskuls.push({
							nama_ekskul: emName,
							nama_kegiatan: emName,
							predikat: 'Baik',
							keterangan: getDefaultNarasiEkskul(em.id, 'Baik') || '-',
							is_auto_synced: false,
						});
					}
				}
			});

			// 3. Tambahkan Pramuka sebagai ekskul wajib jika belum ada
			const hasPramuka = studentEkskuls.some((e) =>
				(e.nama_ekskul || e.nama_kegiatan || '').toLowerCase().includes('pramuka')
			);
			if (!hasPramuka) {
				studentEkskuls.unshift({
					nama_ekskul: 'Praja Muda Karana (Pramuka)',
					nama_kegiatan: 'Praja Muda Karana (Pramuka)',
					predikat: 'Baik',
					keterangan: getDefaultNarasiEkskul('PRAMUKA', 'Baik'),
					is_auto_synced: false,
				});
			}

			ekskulMap[s.id] = studentEkskuls;
		});

		const result = (siswaList || []).map((s) => ({
			siswa_id: s.id,
			nis: s.nis,
			nisn: s.nisn,
			nama_lengkap: s.nama_lengkap,
			kegiatan: ekskulMap[s.id] || [],
			ekskul_list: ekskulMap[s.id] || [], // kompatibilitas ganda
		}));

		return NextResponse.json({
			kelas: kelasData,
			semester,
			tahun_ajaran: tahunAjaran,
			students: result,
		});
	} catch (error) {
		console.error('Error GET rapor_ekstrakurikuler:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const kelas_id = body.kelas_id;
		const semester = body.semester;
		const tahun_ajaran = body.tahun_ajaran;
		const payload = body.payload || body.data_ekskul || [];

		if (!kelas_id || !tahun_ajaran || !Array.isArray(payload)) {
			return NextResponse.json({ error: 'Data payload tidak lengkap' }, { status: 400 });
		}

		// Validasi Wali Kelas
		if (role === 'Guru' && userId) {
			const { data: kelasData } = await supabase.from('kelas').select('id_wali_kelas, wali_kelas').eq('id', kelas_id).maybeSingle();
			const isDirectWali = kelasData?.id_wali_kelas === userId;
			let isRelasiWali = false;
			if (!isDirectWali) {
				const { data: relasi } = await supabase
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('id_kelas', kelas_id)
					.eq('is_active', true)
					.maybeSingle();
				if (relasi) isRelasiWali = true;
			}
			let isNameWali = false;
			if (!isDirectWali && !isRelasiWali && kelasData?.wali_kelas) {
				const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
				if (userRow?.nama_lengkap && kelasData.wali_kelas.includes(userRow.nama_lengkap)) {
					isNameWali = true;
				}
			}
			if (!isDirectWali && !isRelasiWali && !isNameWali) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat menyimpan nilai ekstrakurikuler.' },
					{ status: 403 }
				);
			}
		}

		// Hapus ekskul lama kelas ini di periode terkait untuk replace bersih
		const { error: delErr } = await supabase
			.from('rapor_ekstrakurikuler')
			.delete()
			.eq('kelas_id', kelas_id)
			.eq('semester', parseInt(semester, 10) || 1)
			.eq('tahun_ajaran', tahunAjaran);

		if (delErr) throw delErr;

		// Kumpulkan baris baru
		const rowsToInsert = [];
		payload.forEach((item) => {
			const { siswa_id } = item;
			const list = item.kegiatan || item.ekskul_list || [];
			list.forEach((k) => {
				const nama = (k.nama_kegiatan || k.nama_ekskul || '').trim();
				if (nama) {
					rowsToInsert.push({
						siswa_id,
						kelas_id,
						semester: parseInt(semester, 10) || 1,
						tahun_ajaran,
						nama_kegiatan: nama,
						predikat: (k.predikat || 'Baik').trim(),
						keterangan: (k.keterangan || '').trim(),
						updated_at: new Date().toISOString(),
					});
				}
			});
		});

		if (rowsToInsert.length > 0) {
			const { data, error: insErr } = await supabase.from('rapor_ekstrakurikuler').insert(rowsToInsert).select();
			if (insErr) throw insErr;
			return NextResponse.json({
				success: true,
				count: data?.length || rowsToInsert.length,
				message: 'Nilai ekstrakurikuler berhasil disimpan',
			});
		}

		return NextResponse.json({ success: true, message: 'Data ekstrakurikuler telah diperbarui (kosong)' });
	} catch (error) {
		console.error('Error POST rapor_ekstrakurikuler:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
