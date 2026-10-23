import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

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

		// 1. Ambil detail kelas
		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas')
			.eq('id', kelasId)
			.single();

		if (kelasErr) throw kelasErr;

		// 2. Ambil detail mapel (jika ada mapelId)
		let mapelData = null;
		if (mapelId) {
			const { data: mData, error: mErr } = await supabase
				.from('mapel')
				.select('id, mapel, nama_resmi')
				.eq('id', mapelId)
				.single();
			if (mErr) throw mErr;
			mapelData = mData;

			// Validasi otorisasi Guru
			if (role === 'Guru' && userId) {
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

		// 3. Ambil seluruh siswa aktif di kelas tersebut
		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap, jenis_kelamin')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });

		if (siswaErr) throw siswaErr;

		const siswaIds = (siswaList || []).map((s) => s.id);

		// 4. Ambil data nilai_tugas & nilai_siswa jika mapel dipilih
		let rawNilaiList = [];
		if (mapelData && siswaIds.length > 0) {
			let queryTugas = supabase
				.from('nilai_tugas')
				.select(`
					tugas_id,
					guru_id,
					kategori,
					type,
					deskripsi,
					kelas,
					mapel,
					tanggal,
					tahun_ajar,
					semester
				`)
				.eq('kelas', kelasData.nama_kelas)
				.eq('mapel', mapelData.mapel);

			if (tahunAjaran) {
				queryTugas = queryTugas.eq('tahun_ajar', tahunAjaran);
			}
			if (semester) {
				queryTugas = queryTugas.eq('semester', semester);
			}

			const { data: tugasList, error: tugasErr } = await queryTugas;
			if (tugasErr) throw tugasErr;

			if (tugasList && tugasList.length > 0) {
				const tugasIds = tugasList.map((t) => t.tugas_id);
				const { data: scoresData, error: scoresErr } = await supabase
					.from('nilai_siswa')
					.select('tugas_id, siswa_id, nilai')
					.in('tugas_id', tugasIds)
					.in('siswa_id', siswaIds);

				if (scoresErr) throw scoresErr;

				// Gabungkan informasi tugas dan nilai
				const tugasMap = {};
				tugasList.forEach((t) => {
					tugasMap[t.tugas_id] = t;
				});

				rawNilaiList = (scoresData || []).map((row) => ({
					tugas_id: row.tugas_id,
					siswa_id: row.siswa_id,
					nilai: row.nilai,
					kategori: tugasMap[row.tugas_id]?.kategori || '',
					type: tugasMap[row.tugas_id]?.type || '',
					deskripsi: tugasMap[row.tugas_id]?.deskripsi || '',
					tanggal: tugasMap[row.tugas_id]?.tanggal || '',
				}));
			}
		}

		// 5. Ambil data poin siswa di kelas ini
		let poinMap = {};
		if (siswaIds.length > 0) {
			let queryPoin = supabase
				.from('poin')
				.select('siswa_id, tipe, poin, tahun_ajar, semester')
				.in('siswa_id', siswaIds);

			if (tahunAjaran) {
				queryPoin = queryPoin.eq('tahun_ajar', tahunAjaran);
			}
			if (semester) {
				queryPoin = queryPoin.eq('semester', semester);
			}

			const { data: dataPoin, error: poinErr } = await queryPoin;
			if (!poinErr && Array.isArray(dataPoin)) {
				dataPoin.forEach((p) => {
					const sid = String(p.siswa_id);
					if (!poinMap[sid]) poinMap[sid] = { positif: 0, negatif: 0 };
					const pts = Number(p.poin) || 0;
					if (p.tipe === 'positif') poinMap[sid].positif += pts;
					if (p.tipe === 'negatif') poinMap[sid].negatif += pts;
				});
			}
		}

		// 6. Ambil nilai KKM / KKTP spesifik untuk mapel dan jenjang kelas ini
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

		// 7. Ambil nilai yang sudah pernah disimpan di rapor_nilai_kuantitatif
		let existingKuantitatif = {};
		if (mapelId && tahunAjaran && siswaIds.length > 0) {
			const { data: qData } = await supabase
				.from('rapor_nilai_kuantitatif')
				.select('siswa_id, nilai_akhir')
				.eq('kelas_id', kelasId)
				.eq('mapel_id', mapelId)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);

			(qData || []).forEach((row) => {
				existingKuantitatif[row.siswa_id] = row.nilai_akhir;
			});
		}

		// Susun student results
		const students = (siswaList || []).map((s) => ({
			siswa_id: s.id,
			nis: s.nis,
			nisn: s.nisn,
			nama_lengkap: s.nama_lengkap,
			jenis_kelamin: s.jenis_kelamin,
			poinPositif: poinMap[s.id]?.positif || 0,
			poinNegatif: poinMap[s.id]?.negatif || 0,
			rapor_nilai_kuantitatif: existingKuantitatif[s.id] ?? null,
		}));

		return NextResponse.json({
			kelas: kelasData,
			mapel: mapelData,
			semester,
			tahun_ajaran: tahunAjaran,
			kkm,
			kkm_source: kkmSource,
			nilai_list: rawNilaiList,
			students,
		});
	} catch (error) {
		console.error('Error GET rapor_rekap_nilai:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// POST - Simpan / Terapkan hasil rekap & konversi ke rapor_nilai_kuantitatif
export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const { kelas_id, mapel_id, semester, tahun_ajaran, grades } = body;

		if (!kelas_id || !mapel_id || !tahun_ajaran || !Array.isArray(grades)) {
			return NextResponse.json({ error: 'Data payload tidak lengkap' }, { status: 400 });
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

		return NextResponse.json({
			success: true,
			message: `${rowsToUpsert.length} nilai berhasil disinkronkan ke E-Rapor Kuantitatif.`,
			updated_count: rowsToUpsert.length,
		});
	} catch (error) {
		console.error('Error POST rapor_rekap_nilai:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
