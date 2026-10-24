import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { extractTingkat } from '@/utils/erapor';
import {
	convertMapelScoreToEkskul,
	getDefaultNarasiEkskul,
	getOfficialEkskulName,
	getPredikatFromNilai,
	isEkskulApplicableForTingkat,
	isEkskulMapel,
	isMatchingEkskulMapel,
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
			.select('id, mapel, nama_resmi, kelompok, tingkat')
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
					is_mapel_ekskul: isEkskulMapel(e.nama_kegiatan || e.nama_ekskul),
				}));

			// 1. Sinkronisasi otomatis dari seluruh mapel berkategori Ekskul / Ciri Khas (Opsi A)
			(ekskulMapels || []).forEach((em) => {
				if (!isEkskulApplicableForTingkat(em, tingkatKelas)) return;
				const emName = em.nama_resmi || getOfficialEkskulName(em.id, em);

				const existingIdx = studentEkskuls.findIndex((e) => {
					const name = e.nama_ekskul || e.nama_kegiatan || '';
					return isMatchingEkskulMapel(name, em);
				});

				const scoreObj = mapelScoreMap[s.id]?.[em.id];
				const hasScore =
					scoreObj &&
					scoreObj.nilai_akhir !== undefined &&
					scoreObj.nilai_akhir !== null &&
					scoreObj.nilai_akhir !== '';
				const numScore = hasScore ? parseFloat(scoreObj.nilai_akhir) : null;
				const pred = hasScore
					? getPredikatFromNilai(numScore)
					: (existingIdx !== -1 && studentEkskuls[existingIdx].predikat ? studentEkskuls[existingIdx].predikat : '');
				const descText =
					(scoreObj?.deskripsi && scoreObj.deskripsi.trim()) ||
					(existingIdx !== -1 && studentEkskuls[existingIdx].keterangan ? studentEkskuls[existingIdx].keterangan : '');

				const mapelItem = {
					id: existingIdx !== -1 ? studentEkskuls[existingIdx].id : undefined,
					nama_ekskul: emName,
					nama_kegiatan: emName,
					predikat: pred,
					keterangan: descText,
					nilai_angka: numScore,
					is_auto_synced: true,
					is_mapel_ekskul: true,
					is_graded_by_guru: hasScore,
				};

				if (existingIdx !== -1) {
					studentEkskuls[existingIdx] = mapelItem;
				} else {
					studentEkskuls.push(mapelItem);
				}
			});

			// 2. Tambahkan Pramuka sebagai ekskul wajib jika belum ada
			const hasPramuka = studentEkskuls.some((e) =>
				(e.nama_ekskul || e.nama_kegiatan || '').toLowerCase().includes('pramuka')
			);
			if (!hasPramuka) {
				studentEkskuls.unshift({
					nama_ekskul: 'Praja Muda Karana (Pramuka)',
					nama_kegiatan: 'Praja Muda Karana (Pramuka)',
					predikat: '',
					keterangan: '',
					is_auto_synced: false,
					is_mapel_ekskul: false,
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

		// Ambil data mapel ekskul dan nilai guru mapel untuk memproteksi nilai & deskripsi asli
		const [{ data: ekskulMapels }, { data: appSettingsRow }] = await Promise.all([
			supabase
				.from('mapel')
				.select('id, mapel, nama_resmi, kelompok, tingkat')
				.or('kelompok.eq.Ekskul,id.in.("MP-ASW","MP-KHOT")'),
			supabase
				.from('app_settings')
				.select('value')
				.eq('key', 'master_ekstrakurikuler')
				.maybeSingle(),
		]);

		const targetMapelIds = (ekskulMapels || []).map((m) => m.id);
		const mapelScoreMap = {};
		if (targetMapelIds.length > 0) {
			const [kuantRes, kualRes] = await Promise.all([
				supabase
					.from('rapor_nilai_kuantitatif')
					.select('siswa_id, mapel_id, nilai_akhir')
					.eq('kelas_id', kelas_id)
					.in('mapel_id', targetMapelIds)
					.eq('semester', parseInt(semester, 10) || 1)
					.eq('tahun_ajaran', tahun_ajaran),
				supabase
					.from('rapor_nilai_kualitatif')
					.select('siswa_id, mapel_id, deskripsi_tertinggi')
					.eq('kelas_id', kelas_id)
					.in('mapel_id', targetMapelIds)
					.eq('semester', parseInt(semester, 10) || 1)
					.eq('tahun_ajaran', tahun_ajaran),
			]);

			(kuantRes.data || []).forEach((row) => {
				if (!mapelScoreMap[row.siswa_id]) mapelScoreMap[row.siswa_id] = {};
				mapelScoreMap[row.siswa_id][row.mapel_id] = { nilai_akhir: row.nilai_akhir };
			});
			(kualRes.data || []).forEach((row) => {
				if (!mapelScoreMap[row.siswa_id]) mapelScoreMap[row.siswa_id] = {};
				if (!mapelScoreMap[row.siswa_id][row.mapel_id]) mapelScoreMap[row.siswa_id][row.mapel_id] = {};
				mapelScoreMap[row.siswa_id][row.mapel_id].deskripsi = row.deskripsi_tertinggi;
			});
		}

		let masterPresets = [];
		try {
			if (appSettingsRow?.value) {
				masterPresets = Array.isArray(appSettingsRow.value) ? appSettingsRow.value : JSON.parse(appSettingsRow.value);
			}
		} catch (e) {
			masterPresets = [];
		}

		// Hapus ekskul lama kelas ini di periode terkait untuk replace bersih
		const { error: delErr } = await supabase
			.from('rapor_ekstrakurikuler')
			.delete()
			.eq('kelas_id', kelas_id)
			.eq('semester', parseInt(semester, 10) || 1)
			.eq('tahun_ajaran', tahun_ajaran);

		if (delErr) throw delErr;

		// Kumpulkan baris baru dengan proteksi nilai & deskripsi
		const rowsToInsert = [];
		payload.forEach((item) => {
			const { siswa_id } = item;
			const list = item.kegiatan || item.ekskul_list || [];
			list.forEach((k) => {
				const nama = (k.nama_kegiatan || k.nama_ekskul || '').trim();
				if (!nama) return;

				let predikat = (k.predikat || '').trim();
				let keterangan = (k.keterangan || '').trim();

				// Proteksi 1: Jika Mapel Ekskul (Aswaja, Khot), kunci nilai & narasi sesuai catatan Guru Mapel
				const matchedMapel = (ekskulMapels || []).find(
					(em) => isMatchingEkskulMapel(nama, em)
				);

				if (matchedMapel) {
					const scoreObj = mapelScoreMap[siswa_id]?.[matchedMapel.id];
					if (scoreObj && scoreObj.nilai_akhir !== undefined && scoreObj.nilai_akhir !== null && scoreObj.nilai_akhir !== '') {
						predikat = getPredikatFromNilai(scoreObj.nilai_akhir);
						keterangan = (scoreObj.deskripsi && scoreObj.deskripsi.trim()) || getDefaultNarasiEkskul(matchedMapel.id, predikat) || '-';
					} else {
						// Jika Guru Mapel belum mengisi nilai, jangan simpan nilai/deskripsi palsu
						predikat = '';
						keterangan = '';
					}
				} else {
					// Untuk Ekskul Pilihan / Pramuka, Wali Kelas yang menentukan nilai & catatan capaian
					if (predikat && predikat !== '-') {
						if (!keterangan || keterangan === '-') {
							const preset = masterPresets.find(
								(p) => (p.nama_ekskul || '').toLowerCase() === nama.toLowerCase()
							);
							if (preset && preset.deskripsi_standar) {
								keterangan = preset.deskripsi_standar;
							} else {
								keterangan = getDefaultNarasiEkskul(nama, predikat) || '-';
							}
						}
					} else {
						// Belum dinilai oleh Wali Kelas
						predikat = '';
						keterangan = '';
					}
				}

				rowsToInsert.push({
					siswa_id,
					kelas_id,
					semester: parseInt(semester, 10) || 1,
					tahun_ajaran,
					nama_kegiatan: matchedMapel?.nama_resmi || nama,
					predikat: predikat || '',
					keterangan: keterangan || '',
					updated_at: new Date().toISOString(),
				});
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
