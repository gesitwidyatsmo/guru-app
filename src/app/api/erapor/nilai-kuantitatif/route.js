import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { checkClassLock } from '@/utils/erapor';
import {
	isEkskulMapel,
	isMatchingEkskulMapel,
	getOfficialEkskulName,
	getPredikatFromNilai,
	getDefaultNarasiEkskul,
} from '@/lib/eraporEkskulUtils';

async function getAuthInfo(request, supabase) {
	let role = request.headers.get('x-user-role');
	let userId = request.headers.get('x-user-id');

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
	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const { searchParams } = new URL(request.url);
		const kelasId = searchParams.get('kelas_id');
		const mapelId = searchParams.get('mapel_id');
		const semester = parseInt(searchParams.get('semester') || '1', 10);
		const tahunAjaran = searchParams.get('tahun_ajaran');

		if (!kelasId) {
			return NextResponse.json({ error: 'kelas_id wajib disertakan' }, { status: 400 });
		}

		// Ambil data detail kelas untuk nama_kelas
		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas')
			.eq('id', kelasId)
			.single();

		if (kelasErr) throw kelasErr;

		// Jika role Guru dan mapelId terisi, validasi hak ajar di kelas ini
		if (role === 'Guru' && userId && mapelId) {
			const { data: mapelData } = await supabase
				.from('mapel')
				.select('id, mapel, nama_resmi')
				.eq('id', mapelId)
				.maybeSingle();

			if (mapelData) {
				const mapelNames = [mapelData.mapel, mapelData.nama_resmi].filter(Boolean);
				const [kbmRes, jdwRes] = await Promise.all([
					supabase
						.from('guru_kbm')
						.select('id_kbm')
						.eq('id_user', userId)
						.eq('kelas', kelasData.nama_kelas)
						.in('mapel', mapelNames)
						.limit(1),
					supabase
						.from('jadwal')
						.select('id')
						.eq('id_user', userId)
						.eq('kelas', kelasData.nama_kelas)
						.in('mapel', mapelNames)
						.limit(1),
				]);

				const isAllowed = (kbmRes.data && kbmRes.data.length > 0) || (jdwRes.data && jdwRes.data.length > 0);

				if (!isAllowed) {
					return NextResponse.json(
						{ error: `Akses Ditolak: Anda tidak ditugaskan mengajar ${mapelData.mapel} di kelas ${kelasData.nama_kelas}.` },
						{ status: 403 }
					);
				}
			}
		}

		// Ambil seluruh siswa aktif di kelas tersebut
		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap, jenis_kelamin')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });

		if (siswaErr) throw siswaErr;

		let existingGrades = [];
		let existingKualitatif = [];
		if (mapelId && tahunAjaran) {
			const [gradesRes, kualRes] = await Promise.all([
				supabase
					.from('rapor_nilai_kuantitatif')
					.select('*')
					.eq('kelas_id', kelasId)
					.eq('mapel_id', mapelId)
					.eq('semester', semester)
					.eq('tahun_ajaran', tahunAjaran),
				supabase
					.from('rapor_nilai_kualitatif')
					.select('*')
					.eq('kelas_id', kelasId)
					.eq('mapel_id', mapelId)
					.eq('semester', semester)
					.eq('tahun_ajaran', tahunAjaran),
			]);

			if (gradesRes.error) throw gradesRes.error;
			existingGrades = gradesRes.data || [];
			existingKualitatif = kualRes.data || [];
		}

		// Ambil nilai KKM / KKTP spesifik untuk mapel dan jenjang kelas ini
		let kkm = 75;
		let kkmSource = 'Standar Sekolah';
		if (mapelId && kelasData?.nama_kelas) {
			const s = String(kelasData.nama_kelas || '').trim().toUpperCase();
			let tingkat = 'VII';
			if (s.startsWith('VIII.') || s.startsWith('VIII ') || s === 'VIII' || s.startsWith('8') || s.includes('VIII')) {
				tingkat = 'VIII';
			} else if (s.startsWith('IX.') || s.startsWith('IX ') || s === 'IX' || s.startsWith('9') || s.includes('IX')) {
				tingkat = 'IX';
			}

			const { data: kktpRow } = await supabase
				.from('kurikulum_kktp')
				.select('nilai_kktp')
				.eq('mapel_id', mapelId)
				.eq('tingkat_kelas', tingkat)
				.maybeSingle();

			if (kktpRow && kktpRow.nilai_kktp !== null && !isNaN(Number(kktpRow.nilai_kktp))) {
				kkm = Number(kktpRow.nilai_kktp);
				kkmSource = `Kurikulum (Kelas ${tingkat})`;
			} else {
				const defaultKktp = { VII: 70, VIII: 72, IX: 75 };
				kkm = defaultKktp[tingkat] || 75;
				kkmSource = `Standar Jenjang (Kelas ${tingkat})`;
			}
		}

		// Gabungkan data siswa dengan nilai dan deskripsi kualitatif
		const gradeMap = {};
		existingGrades.forEach((g) => {
			gradeMap[g.siswa_id] = {
				id: g.id,
				nilai_akhir: g.nilai_akhir,
			};
		});

		const kualMap = {};
		existingKualitatif.forEach((k) => {
			kualMap[k.siswa_id] = k.deskripsi_tertinggi || '';
		});

		const result = (siswaList || []).map((s) => ({
			siswa_id: s.id,
			nis: s.nis,
			nisn: s.nisn,
			nama_lengkap: s.nama_lengkap,
			jenis_kelamin: s.jenis_kelamin,
			nilai_akhir: gradeMap[s.id]?.nilai_akhir ?? '',
			deskripsi: kualMap[s.id] || '',
			record_id: gradeMap[s.id]?.id ?? null,
		}));

		// Cek proteksi kunci kelas
		const lockInfo = await checkClassLock(supabase, { kelasId, tahunAjaran, semester });

		return NextResponse.json({
			kelas: kelasData,
			semester,
			tahun_ajaran: tahunAjaran,
			kkm,
			kkm_source: kkmSource,
			is_locked: lockInfo.isLocked,
			is_locked_global: lockInfo.isGlobal,
			locked_by_name: lockInfo.lockedByName,
			students: result,
		});
	} catch (error) {
		console.error('Error GET rapor_nilai_kuantitatif:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const { kelas_id, mapel_id, semester, tahun_ajaran, grades } = body;

		if (!kelas_id || !mapel_id || !tahun_ajaran || !Array.isArray(grades)) {
			return NextResponse.json({ error: 'Data payload tidak lengkap' }, { status: 400 });
		}

		// Cek apakah rombel terkunci
		const lockInfo = await checkClassLock(supabase, {
			kelasId: kelas_id,
			tahun_ajaran: tahun_ajaran,
			semester,
		});
		if (lockInfo.isLocked) {
			const isPrivileged = role === 'Admin' || role === 'Kurikulum' || role === 'Superadmin';
			if (!isPrivileged) {
				return NextResponse.json(
					{
						error: `Akses Ditolak: Rombel ini telah dikunci (${lockInfo.lockedByName}). Nilai rapor tidak dapat diubah lagi. Hubungi Wali Kelas atau Kurikulum untuk membuka kunci.`,
					},
					{ status: 403 }
				);
			}
		}

		// Validasi otorisasi Guru
		if (role === 'Guru' && userId) {
			const [{ data: kelasData }, { data: mapelData }] = await Promise.all([
				supabase.from('kelas').select('id, nama_kelas').eq('id', kelas_id).maybeSingle(),
				supabase.from('mapel').select('id, mapel, nama_resmi').eq('id', mapel_id).maybeSingle(),
			]);

			if (!kelasData || !mapelData) {
				return NextResponse.json({ error: 'Data kelas atau mapel tidak valid.' }, { status: 400 });
			}

			const mapelNames = [mapelData.mapel, mapelData.nama_resmi].filter(Boolean);
			const [kbmRes, jdwRes] = await Promise.all([
				supabase
					.from('guru_kbm')
					.select('id_kbm')
					.eq('id_user', userId)
					.eq('kelas', kelasData.nama_kelas)
					.in('mapel', mapelNames)
					.limit(1),
				supabase
					.from('jadwal')
					.select('id')
					.eq('id_user', userId)
					.eq('kelas', kelasData.nama_kelas)
					.in('mapel', mapelNames)
					.limit(1),
			]);

			const isAllowed = (kbmRes.data && kbmRes.data.length > 0) || (jdwRes.data && jdwRes.data.length > 0);

			if (!isAllowed) {
				return NextResponse.json(
					{ error: `Akses Ditolak: Anda tidak ditugaskan mengajar ${mapelData.mapel} di kelas ${kelasData.nama_kelas}.` },
					{ status: 403 }
				);
			}
		}

		// Identifikasi siswa yang nilainya dikosongkan untuk dihapus dari database
		const emptySiswaIds = grades
			.filter((g) => g.nilai_akhir === '' || g.nilai_akhir === null || isNaN(g.nilai_akhir))
			.map((g) => g.siswa_id);

		if (emptySiswaIds.length > 0) {
			await supabase
				.from('rapor_nilai_kuantitatif')
				.delete()
				.eq('kelas_id', kelas_id)
				.eq('mapel_id', mapel_id)
				.eq('semester', parseInt(semester, 10) || 1)
				.eq('tahun_ajaran', tahun_ajaran)
				.in('siswa_id', emptySiswaIds);
		}

		const rowsToUpsert = grades
			.filter((g) => g.nilai_akhir !== '' && g.nilai_akhir !== null && !isNaN(g.nilai_akhir))
			.map((g) => ({
				siswa_id: g.siswa_id,
				kelas_id,
				mapel_id,
				semester: parseInt(semester, 10) || 1,
				tahun_ajaran,
				nilai_akhir: Math.min(100, Math.max(0, parseFloat(g.nilai_akhir))),
				updated_at: new Date().toISOString(),
			}));

		if (rowsToUpsert.length > 0) {
			const { error } = await supabase
				.from('rapor_nilai_kuantitatif')
				.upsert(rowsToUpsert, {
					onConflict: 'siswa_id,mapel_id,kelas_id,semester,tahun_ajaran',
				});

			if (error) throw error;
		}

		// Simpan deskripsi ke rapor_nilai_kualitatif jika disediakan
		const kualRows = grades
			.filter((g) => g.nilai_akhir !== '' && g.nilai_akhir !== null && !isNaN(g.nilai_akhir) && g.deskripsi)
			.map((g) => ({
				siswa_id: g.siswa_id,
				kelas_id,
				mapel_id,
				semester: parseInt(semester, 10) || 1,
				tahun_ajaran,
				deskripsi_tertinggi: String(g.deskripsi).trim(),
				updated_at: new Date().toISOString(),
			}));

		if (kualRows.length > 0) {
			await supabase.from('rapor_nilai_kualitatif').upsert(kualRows, {
				onConflict: 'siswa_id,mapel_id,kelas_id,semester,tahun_ajaran',
			});
		}

		// Sinkronisasi otomatis ke rapor_ekstrakurikuler jika ini mapel ekstrakurikuler (Opsi A: kelompok === 'Ekskul')
		const { data: mapelInfo } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi, kelompok')
			.eq('id', mapel_id)
			.maybeSingle();

		if (mapelInfo?.kelompok === 'Ekskul' || isEkskulMapel(mapel_id, mapelInfo)) {
			const ekskulName = mapelInfo?.nama_resmi || getOfficialEkskulName(mapel_id, mapelInfo);
			const searchKeyword = mapelInfo?.mapel || (mapel_id === 'MP-ASW' ? 'aswaja' : 'khot');
			for (const g of grades) {
				if (g.nilai_akhir !== '' && g.nilai_akhir !== null && !isNaN(g.nilai_akhir)) {
					const numScore = parseFloat(g.nilai_akhir);
					const pred = getPredikatFromNilai(numScore);
					const ket = g.deskripsi?.trim() || getDefaultNarasiEkskul(mapel_id, pred) || '-';

					const { data: existingList } = await supabase
						.from('rapor_ekstrakurikuler')
						.select('id, nama_kegiatan')
						.eq('siswa_id', g.siswa_id)
						.eq('kelas_id', kelas_id)
						.eq('semester', parseInt(semester, 10) || 1)
						.eq('tahun_ajaran', tahun_ajaran);

					const existingEks = (existingList || []).find((row) =>
						isMatchingEkskulMapel(row.nama_kegiatan, mapelInfo || mapel_id)
					);

					if (existingEks) {
						await supabase
							.from('rapor_ekstrakurikuler')
							.update({
								nama_kegiatan: ekskulName,
								predikat: pred,
								keterangan: ket,
								updated_at: new Date().toISOString(),
							})
							.eq('id', existingEks.id);
					} else {
						await supabase.from('rapor_ekstrakurikuler').insert({
							siswa_id: g.siswa_id,
							kelas_id,
							semester: parseInt(semester, 10) || 1,
							tahun_ajaran,
							nama_kegiatan: ekskulName,
							predikat: pred,
							keterangan: ket,
							updated_at: new Date().toISOString(),
						});
					}
				}
			}
		}

		return NextResponse.json({
			success: true,
			count: rowsToUpsert.length,
			message: rowsToUpsert.length > 0 ? 'Nilai kuantitatif berhasil disimpan' : 'Seluruh nilai berhasil dikosongkan',
		});
	} catch (error) {
		console.error('Error POST rapor_nilai_kuantitatif:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
