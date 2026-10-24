import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { extractTingkat, checkClassLock } from '@/utils/erapor';
import { isEkskulMapel, isMatchingEkskulMapel, getOfficialEkskulName } from '@/lib/eraporEkskulUtils';

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

		if (!kelasId || !mapelId) {
			return NextResponse.json({ error: 'kelas_id dan mapel_id wajib disertakan' }, { status: 400 });
		}

		// 1. Ambil detail kelas
		const { data: kelasData, error: kelasErr } = await supabase
			.from('kelas')
			.select('id, nama_kelas')
			.eq('id', kelasId)
			.single();
		if (kelasErr) throw kelasErr;

		// 2. Ambil detail mapel
		const { data: mapelData, error: mapelErr } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi')
			.eq('id', mapelId)
			.single();
		if (mapelErr) throw mapelErr;

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

		const tingkat = extractTingkat(kelasData.nama_kelas);

		// 3. Ambil seluruh siswa aktif
		const { data: siswaList, error: siswaErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap')
			.eq('kelas', kelasData.nama_kelas)
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });
		if (siswaErr) throw siswaErr;

		// 4. Ambil Tujuan Pembelajaran (TP) untuk mapel dan tingkat ini
		let tpQuery = supabase
			.from('rapor_tp')
			.select('id, kode_tp, deskripsi, tingkat')
			.eq('mapel_id', mapelId)
			.eq('tingkat', tingkat)
			.order('created_at', { ascending: true });

		// Jika role Guru: batasi HANYA TP yang dibuat oleh guru yang bersangkutan
		if (role === 'Guru' && userId) {
			tpQuery = tpQuery.eq('id_user', userId);
		}

		let { data: tpList, error: tpErr } = await tpQuery;
		// Fallback jika kolom id_user belum dimigrasi di database
		if (tpErr && tpErr.message?.includes('id_user')) {
			const fallback = await supabase
				.from('rapor_tp')
				.select('id, kode_tp, deskripsi, tingkat')
				.eq('mapel_id', mapelId)
				.eq('tingkat', tingkat)
				.order('created_at', { ascending: true });
			tpList = fallback.data;
			tpErr = fallback.error;
		}
		if (tpErr) throw tpErr;

		const siswaIds = (siswaList || []).map((s) => s.id);
		const tpIds = (tpList || []).map((tp) => tp.id);

		// 5. Ambil nilai TP yang sudah pernah diinput (skala 1-4)
		let existingNilaiTp = [];
		if (siswaIds.length > 0 && tpIds.length > 0 && tahunAjaran) {
			const { data: ntpData } = await supabase
				.from('rapor_nilai_tp')
				.select('*')
				.in('siswa_id', siswaIds)
				.in('tp_id', tpIds)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);
			existingNilaiTp = ntpData || [];
		}

		// 6. Ambil deskripsi tertinggi dan terendah yang tersimpan
		let existingDeskripsi = [];
		if (siswaIds.length > 0 && tahunAjaran) {
			const { data: descData } = await supabase
				.from('rapor_nilai_kualitatif')
				.select('*')
				.eq('kelas_id', kelasId)
				.eq('mapel_id', mapelId)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);
			existingDeskripsi = descData || [];
		}

		// 7. Ambil nilai kuantitatif (nilai_akhir rapor) jika sudah diisi
		const kuantitatifMap = {};
		if (siswaIds.length > 0 && tahunAjaran) {
			const { data: kuantitatifData } = await supabase
				.from('rapor_nilai_kuantitatif')
				.select('siswa_id, nilai_akhir')
				.eq('kelas_id', kelasId)
				.eq('mapel_id', mapelId)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran);

			(kuantitatifData || []).forEach((k) => {
				kuantitatifMap[k.siswa_id] = k.nilai_akhir;
			});
		}

		// 8. Ambil nilai KKM / KKTP spesifik untuk mapel dan jenjang kelas ini
		let kkm = 75;
		if (mapelId && kelasData?.nama_kelas) {
			const sClean = String(kelasData.nama_kelas || '').trim().toUpperCase();
			let tingkatStr = 'VII';
			if (sClean.startsWith('VIII.') || sClean.startsWith('VIII ') || sClean === 'VIII' || sClean.startsWith('8') || sClean.includes('VIII')) {
				tingkatStr = 'VIII';
			} else if (sClean.startsWith('IX.') || sClean.startsWith('IX ') || sClean === 'IX' || sClean.startsWith('9') || sClean.includes('IX')) {
				tingkatStr = 'IX';
			}

			const { data: kktpRow } = await supabase
				.from('kurikulum_kktp')
				.select('nilai_kktp')
				.eq('mapel_id', mapelId)
				.eq('tingkat_kelas', tingkatStr)
				.maybeSingle();

			if (kktpRow && kktpRow.nilai_kktp !== null && !isNaN(Number(kktpRow.nilai_kktp))) {
				kkm = Number(kktpRow.nilai_kktp);
			} else {
				const defaultKktp = { VII: 70, VIII: 72, IX: 75 };
				kkm = defaultKktp[tingkatStr] || 75;
			}
		}

		// Susun struktur data gabungan per siswa
		const descMap = {};
		existingDeskripsi.forEach((d) => {
			descMap[d.siswa_id] = {
				deskripsi_tertinggi: d.deskripsi_tertinggi || '',
				deskripsi_terendah: d.deskripsi_terendah || '',
			};
		});

		const tpScoreMap = {}; // { [siswaId]: { [tpId]: score } }
		existingNilaiTp.forEach((ntp) => {
			if (!tpScoreMap[ntp.siswa_id]) tpScoreMap[ntp.siswa_id] = {};
			tpScoreMap[ntp.siswa_id][ntp.tp_id] = ntp.nilai;
		});

		const studentResults = (siswaList || []).map((s) => ({
			siswa_id: s.id,
			nis: s.nis,
			nisn: s.nisn,
			nama_lengkap: s.nama_lengkap,
			nilai_kuantitatif: kuantitatifMap[s.id] !== undefined ? kuantitatifMap[s.id] : null,
			tp_scores: tpScoreMap[s.id] || {},
			deskripsi_tertinggi: descMap[s.id]?.deskripsi_tertinggi || '',
			deskripsi_terendah: descMap[s.id]?.deskripsi_terendah || '',
		}));

		// Cek proteksi kunci kelas
		const lockInfo = await checkClassLock(supabase, { kelasId, tahunAjaran, semester });

		return NextResponse.json({
			kelas: kelasData,
			mapel: mapelData,
			tingkat,
			kkm,
			is_locked: lockInfo.isLocked,
			is_locked_global: lockInfo.isGlobal,
			locked_by_name: lockInfo.lockedByName,
			tujuan_pembelajaran: tpList || [],
			students: studentResults,
		});
	} catch (error) {
		console.error('Error GET rapor_nilai_kualitatif:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const body = await request.json();
		const { kelas_id, mapel_id, semester, tahun_ajaran, payload } = body;

		if (!kelas_id || !mapel_id || !tahun_ajaran || !Array.isArray(payload)) {
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

		// Identifikasi siswa yang nilai TP-nya dikosongkan untuk dibersihkan dari database
		const clearedSiswaIds = payload
			.filter((item) => {
				const scores = Object.values(item.tp_scores || {}).filter((v) => v !== '' && v !== null && !isNaN(v));
				return scores.length === 0;
			})
			.map((item) => item.siswa_id);

		if (clearedSiswaIds.length > 0) {
			const { data: tpList } = await supabase
				.from('rapor_tp')
				.select('id')
				.eq('mapel_id', mapel_id);

			const tpIds = (tpList || []).map((t) => t.id);
			if (tpIds.length > 0) {
				await supabase
					.from('rapor_nilai_tp')
					.delete()
					.in('siswa_id', clearedSiswaIds)
					.in('tp_id', tpIds)
					.eq('semester', parseInt(semester, 10) || 1)
					.eq('tahun_ajaran', tahun_ajaran);
			}

			await supabase
				.from('rapor_nilai_kualitatif')
				.delete()
				.eq('kelas_id', kelas_id)
				.eq('mapel_id', mapel_id)
				.eq('semester', parseInt(semester, 10) || 1)
				.eq('tahun_ajaran', tahun_ajaran)
				.in('siswa_id', clearedSiswaIds);
		}

		const rowsTp = [];
		const rowsKualitatif = [];

		payload.forEach((item) => {
			const { siswa_id, tp_scores = {}, deskripsi_tertinggi, deskripsi_terendah } = item;

			// Kumpulkan skor TP
			Object.entries(tp_scores).forEach(([tp_id, score]) => {
				if (score !== '' && score !== null && !isNaN(score)) {
					rowsTp.push({
						siswa_id,
						tp_id,
						semester: parseInt(semester, 10) || 1,
						tahun_ajaran,
						nilai: parseInt(score, 10),
						updated_at: new Date().toISOString(),
					});
				}
			});

			// Kumpulkan deskripsi narasi
			if (deskripsi_tertinggi || deskripsi_terendah) {
				rowsKualitatif.push({
					siswa_id,
					kelas_id,
					mapel_id,
					semester: parseInt(semester, 10) || 1,
					tahun_ajaran,
					deskripsi_tertinggi: deskripsi_tertinggi || '',
					deskripsi_terendah: deskripsi_terendah || '',
					updated_at: new Date().toISOString(),
				});
			}
		});

		// Upsert ke rapor_nilai_tp
		if (rowsTp.length > 0) {
			const { error: errTp } = await supabase.from('rapor_nilai_tp').upsert(rowsTp, {
				onConflict: 'siswa_id,tp_id,semester,tahun_ajaran',
			});
			if (errTp) throw errTp;
		}

		// Upsert ke rapor_nilai_kualitatif
		if (rowsKualitatif.length > 0) {
			const { error: errKual } = await supabase.from('rapor_nilai_kualitatif').upsert(rowsKualitatif, {
				onConflict: 'siswa_id,mapel_id,kelas_id,semester,tahun_ajaran',
			});
			if (errKual) throw errKual;
		}

		// Sinkronisasi otomatis ke rapor_ekstrakurikuler jika ini mapel ekstrakurikuler (Opsi A: kelompok === 'Ekskul')
		const { data: mapelInfo } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi, kelompok')
			.eq('id', mapel_id)
			.maybeSingle();

		if (mapelInfo?.kelompok === 'Ekskul' || isEkskulMapel(mapel_id, mapelInfo)) {
			const ekskulName = mapelInfo?.nama_resmi || getOfficialEkskulName(mapel_id, mapelInfo);
			const ekskulKeyword = mapelInfo?.mapel || (String(mapel_id).toUpperCase().includes('ASW') ? 'aswaja' : 'khot');
			for (const item of payload) {
				if (item.deskripsi_tertinggi && item.deskripsi_tertinggi.trim()) {
					const { data: existingList } = await supabase
						.from('rapor_ekstrakurikuler')
						.select('id, nama_kegiatan')
						.eq('siswa_id', item.siswa_id)
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
								keterangan: item.deskripsi_tertinggi.trim(),
								updated_at: new Date().toISOString(),
							})
							.eq('id', existingEks.id);
					}
				}
			}
		}

		return NextResponse.json({
			success: true,
			message: 'Capaian kompetensi kualitatif berhasil disimpan',
		});
	} catch (error) {
		console.error('Error POST rapor_nilai_kualitatif:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
