import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { isEkskulMapel } from '@/lib/eraporEkskulUtils';

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
		let semester = parseInt(searchParams.get('semester') || '1', 10);
		let tahunAjaran = searchParams.get('tahun_ajaran');

		// Ambil TA aktif jika tidak dispesifikasikan
		if (!tahunAjaran) {
			const { data: taAktif } = await supabase
				.from('tahun_ajar')
				.select('nama, semester')
				.eq('is_aktif', true)
				.maybeSingle();
			if (taAktif) {
				tahunAjaran = taAktif.nama;
				semester = taAktif.semester;
			} else {
				tahunAjaran = '2026/2027';
			}
		}

		// 1. Cek Wali Kelas Info
		let waliKelasInfo = null;
		if (userId) {
			const [{ data: directKls }, { data: relasiKls }] = await Promise.all([
				supabase.from('kelas').select('id, nama_kelas, wali_kelas').eq('id_wali_kelas', userId).maybeSingle(),
				supabase.from('wali_kelas').select('id_kelas, kelas:id_kelas(id, nama_kelas, wali_kelas)').eq('user_id', userId).eq('is_active', true).maybeSingle(),
			]);

			const targetKls = directKls || relasiKls?.kelas;
			if (targetKls) {
				const [sCountRes, presCountRes, eksCountRes, nilaiKuantitatifRes, nilaiKualitatifRes, totalMapelRes] = await Promise.all([
					supabase.from('siswa').select('id', { count: 'exact', head: true }).eq('kelas', targetKls.nama_kelas).eq('status', 'Aktif'),
					supabase.from('rapor_ketidakhadiran').select('id', { count: 'exact', head: true }).eq('kelas_id', targetKls.id).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
					supabase.from('rapor_ekstrakurikuler').select('siswa_id').eq('kelas_id', targetKls.id).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
					supabase.from('rapor_nilai_kuantitatif').select('mapel_id').eq('kelas_id', targetKls.id).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
					supabase.from('rapor_nilai_kualitatif').select('mapel_id').eq('kelas_id', targetKls.id).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
					supabase.from('mapel').select('id', { count: 'exact', head: true }),
				]);

				const uniqueEksSiswa = new Set((eksCountRes.data || []).map((r) => r.siswa_id)).size;
				const kuantitatifMapelSet = new Set((nilaiKuantitatifRes.data || []).map((r) => r.mapel_id));
				const kualitatifMapelSet = new Set((nilaiKualitatifRes.data || []).map((r) => r.mapel_id));
				// Untuk mapel ekskul (Aswaja & Khot), jika kuantitatif terisi otomatis dihitung lengkap
				const mapelLengkapList = [...kuantitatifMapelSet].filter(
					(mId) => mId === 'MP-ASW' || mId === 'MP-KHOT' || kualitatifMapelSet.has(mId)
				);

				waliKelasInfo = {
					is_wali: true,
					id: targetKls.id,
					kelas_id: targetKls.id,
					nama_kelas: targetKls.nama_kelas,
					total_siswa: sCountRes.count || 0,
					presensi_count: presCountRes.count || 0,
					ekskul_count: uniqueEksSiswa,
					mapel_masuk_count: kuantitatifMapelSet.size,
					mapel_kuantitatif_count: kuantitatifMapelSet.size,
					mapel_kualitatif_count: kualitatifMapelSet.size,
					mapel_lengkap_count: mapelLengkapList.length,
					total_mapel: totalMapelRes.count || 13,
				};
			}
		}

		// 2. Progres Guru Mapel (Kelas yang diajar oleh guru)
		let guruKbmProgress = [];
		let totalSiswaGuru = 0;
		let totalMapelGuru = 0;
		let totalKelasGuru = 0;
		let totalKuantitatifGuru = 0;
		let totalKualitatifGuru = 0;

		if (userId) {
			const [kbmRes, jdwRes] = await Promise.all([
				supabase.from('guru_kbm').select('kelas, mapel').eq('id_user', userId),
				supabase.from('jadwal').select('kelas, mapel').eq('id_user', userId),
			]);

			const combinedRaw = [...(kbmRes.data || []), ...(jdwRes.data || [])];
			const seenKey = new Set();
			const kbmRows = [];
			for (const r of combinedRaw) {
				if (!r.kelas || !r.mapel) continue;
				const k = `${r.kelas}__${r.mapel}`;
				if (!seenKey.has(k)) {
					seenKey.add(k);
					kbmRows.push(r);
				}
			}

			if (kbmRows.length > 0) {
				const uniqueClasses = [...new Set(kbmRows.map((r) => r.kelas).filter(Boolean))];
				const uniqueMapelNames = [...new Set(kbmRows.map((r) => r.mapel).filter(Boolean))];

				totalKelasGuru = uniqueClasses.length;
				totalMapelGuru = uniqueMapelNames.length;

				// Map nama_kelas -> id kelas & nama_mapel -> id mapel
				const [{ data: klsList }, { data: mplList }] = await Promise.all([
					supabase.from('kelas').select('id, nama_kelas').in('nama_kelas', uniqueClasses),
					supabase.from('mapel').select('id, mapel, nama_resmi'),
				]);

				const kelasMap = Object.fromEntries((klsList || []).map((k) => [k.nama_kelas, k.id]));
				const mapelMap = {};
				(mplList || []).forEach((m) => {
					mapelMap[m.mapel] = m;
					if (m.nama_resmi) mapelMap[m.nama_resmi] = m;
				});

				// Hitung siswa per kelas
				const { data: siswaData } = await supabase
					.from('siswa')
					.select('id, kelas')
					.in('kelas', uniqueClasses)
					.eq('status', 'Aktif');

				const countByKelas = {};
				(siswaData || []).forEach((s) => {
					countByKelas[s.kelas] = (countByKelas[s.kelas] || 0) + 1;
				});

				totalSiswaGuru = (siswaData || []).length;

				// Ambil progres pengisian nilai kuantitatif & kualitatif untuk guru ini
				const classIds = Object.values(kelasMap);
				const mapelIds = (mplList || []).map((m) => m.id);

				const [nkRes, nklRes] = await Promise.all([
					supabase
						.from('rapor_nilai_kuantitatif')
						.select('kelas_id, mapel_id, siswa_id')
						.in('kelas_id', classIds)
						.in('mapel_id', mapelIds)
						.eq('semester', semester)
						.eq('tahun_ajaran', tahunAjaran),
					supabase
						.from('rapor_nilai_kualitatif')
						.select('kelas_id, mapel_id, siswa_id')
						.in('kelas_id', classIds)
						.in('mapel_id', mapelIds)
						.eq('semester', semester)
						.eq('tahun_ajaran', tahunAjaran),
				]);

				// Buat map: `${kelas_id}_${mapel_id}` -> count
				const nkMap = {};
				(nkRes.data || []).forEach((row) => {
					const k = `${row.kelas_id}_${row.mapel_id}`;
					nkMap[k] = (nkMap[k] || 0) + 1;
				});

				const nklMap = {};
				(nklRes.data || []).forEach((row) => {
					const k = `${row.kelas_id}_${row.mapel_id}`;
					nklMap[k] = (nklMap[k] || 0) + 1;
				});

				guruKbmProgress = kbmRows.map((row) => {
					const kId = kelasMap[row.kelas];
					const mplObj = mapelMap[row.mapel];
					const mId = mplObj?.id;
					const sTotal = countByKelas[row.kelas] || 0;
					const key = `${kId}_${mId}`;
					const nkCount = nkMap[key] || 0;
					const nklCount = nklMap[key] || 0;

					totalKuantitatifGuru += nkCount;
					totalKualitatifGuru += nklCount;

					const isEkskulSubject = mId === 'MP-ASW' || mId === 'MP-KHOT' || isEkskulMapel(row.mapel);
					const isKuantitatifDone = sTotal > 0 && nkCount >= sTotal;
					// Untuk mapel ekskul (Aswaja & Khot), kualitatif otomatis dianggap lengkap jika nilai angka sudah diisi
					const isKualitatifDone = isEkskulSubject
						? isKuantitatifDone
						: sTotal > 0 && nklCount >= sTotal;
					const isFullDone = isKuantitatifDone && isKualitatifDone;

					return {
						kelas: row.kelas,
						kelas_id: kId,
						mapel: row.mapel,
						mapel_nama_resmi: mplObj?.nama_resmi || row.mapel,
						mapel_id: mId,
						is_ekskul: isEkskulSubject,
						total_siswa: sTotal,
						nilai_kuantitatif: nkCount,
						nilai_kualitatif: isEkskulSubject && isKuantitatifDone ? nkCount : nklCount,
						is_kuantitatif_done: isKuantitatifDone,
						is_kualitatif_done: isKualitatifDone,
						is_fully_done: isFullDone,
					};
				});
			}
		}

		// Total TP yang sudah dibuat oleh guru ini
		let tpCount = 0;
		if (userId) {
			const { count } = await supabase
				.from('rapor_tp')
				.select('id', { count: 'exact', head: true })
				.eq('id_user', userId);
			tpCount = count || 0;
		}

		return NextResponse.json({
			role: role || 'Guru',
			is_guru: role === 'Guru',
			is_wali_kelas: Boolean(waliKelasInfo?.is_wali),
			wali_kelas_info: waliKelasInfo,
			guru_kbm_progress: guruKbmProgress,
			tp_count: tpCount,
			total_siswa: totalSiswaGuru,
			total_mapel: totalMapelGuru,
			total_kelas: totalKelasGuru,
			kuantitatif_count: totalKuantitatifGuru,
			kualitatif_count: totalKualitatifGuru,
			tahun_ajaran: tahunAjaran,
			semester,
		});
	} catch (error) {
		console.error('Error GET rapor dashboard progress:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
