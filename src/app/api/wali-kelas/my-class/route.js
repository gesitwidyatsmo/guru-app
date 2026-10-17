import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(req) {
	try {
		const supabase = await createClient();
		const { searchParams } = new URL(req.url);
		const requestedKelasId = searchParams.get('id_kelas');

		// Ambil identitas user dari session
		const {
			data: { user: authUser },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !authUser) {
			return NextResponse.json({ error: 'Belum terautentikasi' }, { status: 401 });
		}

		// Ambil detail profil user
		const roleHeader = req.headers.get('x-user-role');
		const userIdHeader = req.headers.get('x-user-id');

		let userId = userIdHeader;
		let userRole = roleHeader;
		let userName = '';

		if (!userId || !userRole) {
			const { data: profile } = await supabaseAdmin
				.from('users')
				.select('id_user, role, nama_lengkap')
				.eq('auth_id', authUser.id)
				.single();

			if (profile) {
				userId = profile.id_user;
				userRole = profile.role;
				userName = profile.nama_lengkap;
			}
		}

		// Ambil tahun ajar aktif
		const { data: activeTA } = await supabaseAdmin
			.from('tahun_ajar')
			.select('id, nama, semester, is_aktif')
			.eq('is_aktif', true)
			.maybeSingle();

		// Cari kelas binaan
		let targetKelas = null;

		// Jika Admin atau Kepsek meminta preview kelas tertentu
		if (requestedKelasId && (userRole === 'Admin' || userRole === 'Kepala Sekolah')) {
			const { data: kls } = await supabaseAdmin
				.from('kelas')
				.select('id, nama_kelas, wali_kelas, id_wali_kelas')
				.eq('id', requestedKelasId)
				.maybeSingle();
			if (kls) targetKelas = kls;
		}

		// Jika belum ketemu dan user adalah Guru / Admin
		if (!targetKelas && userId) {
			// 1. Coba cari di tabel relasi wali_kelas
			const { data: relasiWali } = await supabaseAdmin
				.from('wali_kelas')
				.select('id_kelas, is_active')
				.eq('user_id', userId)
				.eq('is_active', true)
				.maybeSingle();

			if (relasiWali?.id_kelas) {
				const { data: kls } = await supabaseAdmin
					.from('kelas')
					.select('id, nama_kelas, wali_kelas, id_wali_kelas')
					.eq('id', relasiWali.id_kelas)
					.maybeSingle();
				if (kls) targetKelas = kls;
			}

			// 2. Fallback cek langsung di tabel kelas (id_wali_kelas)
			if (!targetKelas) {
				const { data: directKls } = await supabaseAdmin
					.from('kelas')
					.select('id, nama_kelas, wali_kelas, id_wali_kelas')
					.eq('id_wali_kelas', userId)
					.maybeSingle();
				if (directKls) targetKelas = directKls;
			}
		}

		// Jika bukan wali kelas aktif
		if (!targetKelas) {
			return NextResponse.json({
				isWaliKelas: false,
				message: 'User tidak memiliki rombel kelas binaan aktif.',
				kelas: null,
			});
		}

		const namaKelas = targetKelas.nama_kelas;

		// 3. Ambil seluruh siswa aktif di kelas binaan ini
		const { data: siswaRaw } = await supabaseAdmin
			.from('siswa')
			.select('id, nis, nama_lengkap, jenis_kelamin, status')
			.eq('kelas', namaKelas)
			.order('nama_lengkap', { ascending: true });

		const siswaList = (siswaRaw || []).filter((s) => s.status === 'Aktif');
		const totalSiswa = siswaList.length;
		const totalLaki = siswaList.filter((s) => s.jenis_kelamin === 'Laki-laki').length;
		const totalPerempuan = siswaList.filter((s) => s.jenis_kelamin === 'Perempuan').length;
		const siswaIds = siswaList.map((s) => s.id);

		// 4. AMBIL STATUS ABSENSI HARI INI (HARIAN & MAPEL)
		const todayStr = new Date().toISOString().slice(0, 10);

		// 4A. Ambil sesi resmi absensi_harian jika sudah pernah disimpan
		const { data: sesiHarianResmi } = await supabaseAdmin
			.from('absensi_harian')
			.select('sesi_id, tanggal, kelas')
			.eq('kelas', namaKelas)
			.eq('tanggal', todayStr)
			.maybeSingle();

		let officialDetails = [];
		if (sesiHarianResmi) {
			const { data: harianRows } = await supabaseAdmin
				.from('absensi_harian_siswa')
				.select('siswa_id, status, keterangan')
				.eq('sesi_id', sesiHarianResmi.sesi_id);
			officialDetails = harianRows || [];
		}

		// 4B. Ambil semua sesi absensi_mapel hari ini untuk kelas ini (Live Feed dari Guru Mapel)
		const { data: sesiMapelTodayRaw } = await supabaseAdmin
			.from('absensi_mapel')
			.select(`
				sesi_id,
				guru_id,
				tanggal,
				jam_ke,
				kelas,
				mapel,
				users!absensi_mapel_guru_id_fkey(nama_lengkap),
				absensi_mapel_siswa (
					siswa_id,
					status,
					keterangan
				)
			`)
			.eq('kelas', namaKelas)
			.eq('tanggal', todayStr)
			.order('jam_ke', { ascending: true });

		const sesiMapelToday = (sesiMapelTodayRaw || []).map((s) => ({
			sesi_id: s.sesi_id,
			guru_id: s.guru_id,
			guru_nama: s.users?.nama_lengkap || 'Guru Pengajar',
			jam_ke: s.jam_ke,
			mapel: s.mapel,
			totalSiswaAbsen: (s.absensi_mapel_siswa || []).length,
			siswaDetails: s.absensi_mapel_siswa || [],
		}));

		// 4C. ALGORITMA CERDAS: HITUNG ATURAN 50% & DETEKSI BOLOS / ANOMALI JAM KOSONG
		const siswaMapelBreakdown = [];
		const siswaBolosList = [];

		let autoHadir = 0;
		let autoSakit = 0;
		let autoIzin = 0;
		let autoAlfa = 0;

		siswaList.forEach((siswa) => {
			const sessions = [];
			let hCount = 0;
			let sCount = 0;
			let iCount = 0;
			let aCount = 0;

			sesiMapelToday.forEach((sesi) => {
				const rec = sesi.siswaDetails.find((d) => String(d.siswa_id) === String(siswa.id));
				if (rec) {
					sessions.push({
						jam_ke: sesi.jam_ke,
						mapel: sesi.mapel,
						guru: sesi.guru_nama,
						status: rec.status,
						keterangan: rec.keterangan || '',
					});

					const st = (rec.status || '').toLowerCase();
					if (st === 'hadir' || st === 'h') hCount++;
					else if (st === 'sakit' || st === 's') sCount++;
					else if (st === 'izin' || st === 'i') iCount++;
					else if (st === 'alfa' || st === 'a') aCount++;
				}
			});

			const totalRecorded = hCount + sCount + iCount + aCount;
			let recommendedStatus = 'Hadir';
			let recommendedKeterangan = '';
			let isBolosParsial = false;
			let isAnomaliKurang50 = false;
			let kehadiranPct = 0;

			if (totalRecorded > 0) {
				kehadiranPct = Math.round((hCount / totalRecorded) * 100);

				// ATURAN 50%:
				if (kehadiranPct >= 50) {
					recommendedStatus = 'Hadir';
					// Jika ada alfa padahal hadir di sesi lain -> BOLOS PARSIAL
					if (aCount > 0) {
						isBolosParsial = true;
						const jamBolos = sessions
							.filter((ss) => (ss.status || '').toLowerCase() === 'alfa')
							.map((ss) => `Jam ${ss.jam_ke} (${ss.mapel})`)
							.join(', ');
						recommendedKeterangan = `Bolos di: ${jamBolos}`;
					}
				} else {
					// Kehadiran < 50%
					if (sCount >= iCount && sCount >= aCount) {
						recommendedStatus = 'Sakit';
						recommendedKeterangan =
							sessions.find((ss) => (ss.status || '').toLowerCase() === 'sakit')?.keterangan ||
							'Surat Keterangan Sakit';
					} else if (iCount > sCount && iCount >= aCount) {
						recommendedStatus = 'Izin';
						recommendedKeterangan =
							sessions.find((ss) => (ss.status || '').toLowerCase() === 'izin')?.keterangan ||
							'Izin Keperluan Keluarga';
					} else {
						recommendedStatus = 'Alfa';
						if (hCount > 0) {
							isAnomaliKurang50 = true;
							recommendedKeterangan = `Hanya hadir ${hCount} dari ${totalRecorded} jam (${kehadiranPct}%) - Di bawah syarat 50%`;
						} else {
							recommendedKeterangan = 'Tidak hadir di seluruh sesi KBM';
						}
					}
				}
			} else {
				// Belum ada guru mapel yang absen untuk siswa ini
				recommendedStatus = 'Belum Ada Data';
			}

			// Agregat hitungan
			if (recommendedStatus === 'Hadir') autoHadir++;
			else if (recommendedStatus === 'Sakit') autoSakit++;
			else if (recommendedStatus === 'Izin') autoIzin++;
			else if (recommendedStatus === 'Alfa') autoAlfa++;

			// Deteksi radar bolos / anomali
			if (isBolosParsial) {
				siswaBolosList.push({
					siswa_id: siswa.id,
					nama_lengkap: siswa.nama_lengkap,
					nis: siswa.nis,
					totalRecorded,
					hCount,
					aCount,
					kehadiranPct,
					tipeKasus: 'bolos_parsial',
					judulKasus: 'Membolos Jam Tertentu',
					keterangan: recommendedKeterangan,
					sessions,
				});
			} else if (isAnomaliKurang50) {
				siswaBolosList.push({
					siswa_id: siswa.id,
					nama_lengkap: siswa.nama_lengkap,
					nis: siswa.nis,
					totalRecorded,
					hCount,
					aCount,
					kehadiranPct,
					tipeKasus: 'anomali_kurang_50',
					judulKasus: 'Kehadiran Tidak Memenuhi Syarat Minimal 50%',
					keterangan: recommendedKeterangan,
					sessions,
				});
			}

			// Masukkan ke breakdown siswa
			siswaMapelBreakdown.push({
				siswa_id: siswa.id,
				nama_lengkap: siswa.nama_lengkap,
				nis: siswa.nis,
				jenis_kelamin: siswa.jenis_kelamin,
				totalRecorded,
				hCount,
				sCount,
				iCount,
				aCount,
				kehadiranPct,
				recommendedStatus,
				recommendedKeterangan,
				isBolosParsial,
				isAnomaliKurang50,
				sessions,
			});
		});

		// 4D. Tentukan Statistik Akhir Hari Ini
		const hasOfficial = Boolean(sesiHarianResmi && officialDetails.length > 0);
		const hasMapelData = sesiMapelToday.length > 0;

		let finalHadir = 0;
		let finalSakit = 0;
		let finalIzin = 0;
		let finalAlfa = 0;

		if (hasOfficial) {
			officialDetails.forEach((r) => {
				const st = (r.status || '').toLowerCase();
				if (st === 'hadir' || st === 'h') finalHadir++;
				else if (st === 'sakit' || st === 's') finalSakit++;
				else if (st === 'izin' || st === 'i') finalIzin++;
				else if (st === 'alfa' || st === 'a') finalAlfa++;
			});
		} else if (hasMapelData) {
			finalHadir = autoHadir;
			finalSakit = autoSakit;
			finalIzin = autoIzin;
			finalAlfa = autoAlfa;

			// Auto-persist ke absensi_harian agar langsung sah di database tanpa perlu klik tombol
			if (!sesiHarianResmi && siswaMapelBreakdown.length > 0) {
				try {
					const autoSesiId = `SESI-H-${Math.random().toString(36).slice(2, 11)}`;
					const { data: createdSesi } = await supabaseAdmin
						.from('absensi_harian')
						.insert({
							sesi_id: autoSesiId,
							kelas: namaKelas,
							tanggal: todayStr,
							tahun_ajar: activeTA?.nama || '2026/2027',
							semester: activeTA?.semester ? parseInt(activeTA.semester, 10) : 1,
						})
						.select('sesi_id')
						.single();

					if (createdSesi) {
						const autoRows = siswaMapelBreakdown.map((s) => ({
							sesi_id: createdSesi.sesi_id,
							siswa_id: s.siswa_id,
							status: s.recommendedStatus === 'Belum Ada Data' ? 'Hadir' : s.recommendedStatus,
							keterangan: s.recommendedKeterangan || '',
						}));
						await supabaseAdmin.from('absensi_harian_siswa').insert(autoRows);
					}
				} catch (autoErr) {
					console.error('Silent auto-persist error:', autoErr);
				}
			}
		}

		const finalBelum = Math.max(0, totalSiswa - (finalHadir + finalSakit + finalIzin + finalAlfa));
		const finalPctHadir = totalSiswa > 0 ? Math.round((finalHadir / totalSiswa) * 100) : 0;

		const absensiHariIniStats = {
			recorded: hasOfficial || hasMapelData,
			isSah: true,
			source: hasOfficial ? 'official' : hasMapelData ? 'auto_mapel' : 'none',
			tanggal: todayStr,
			hadir: finalHadir,
			sakit: finalSakit,
			izin: finalIzin,
			alfa: finalAlfa,
			belum: finalBelum,
			persentaseHadir: finalPctHadir,
			totalSesiMapel: sesiMapelToday.length,
			sesiMapelToday: sesiMapelToday.map((s) => ({
				jam_ke: s.jam_ke,
				mapel: s.mapel,
				guru: s.guru_nama,
			})),
			details: hasOfficial ? officialDetails : siswaMapelBreakdown.map((s) => ({
				siswa_id: s.siswa_id,
				status: s.recommendedStatus,
				keterangan: s.recommendedKeterangan,
			})),
		};

		// 5. Ambil data poin perilaku kelas
		let poinStats = {
			totalPositif: 0,
			totalNegatif: 0,
			totalLog: 0,
			recentLogs: [],
		};

		let siswaPerhatian = [];

		if (siswaIds.length > 0) {
			const { data: poinRows } = await supabaseAdmin
				.from('poin')
				.select('id, siswa_id, tipe, poin, aktifitas, tanggal, keterangan, created_at')
				.in('siswa_id', siswaIds)
				.order('tanggal', { ascending: false });

			if (poinRows && poinRows.length > 0) {
				let pos = 0;
				let neg = 0;
				const siswaPoinMap = {};

				poinRows.forEach((p) => {
					const val = Math.abs(parseInt(p.poin || '0', 10));
					if (p.tipe === 'Positif') {
						pos += val;
						siswaPoinMap[p.siswa_id] = (siswaPoinMap[p.siswa_id] || 0) + val;
					} else {
						neg += val;
						siswaPoinMap[p.siswa_id] = (siswaPoinMap[p.siswa_id] || 0) - val;
					}
				});

				poinStats = {
					totalPositif: pos,
					totalNegatif: neg,
					totalLog: poinRows.length,
					recentLogs: poinRows.slice(0, 10).map((p) => {
						const s = siswaList.find((sw) => String(sw.id) === String(p.siswa_id));
						return {
							...p,
							nama_siswa: s?.nama_lengkap || 'Siswa',
						};
					}),
				};

				// Radar perhatian: Siswa dengan poin minus paling besar
				const minusStudents = siswaList
					.map((s) => ({
						id: s.id,
						nama_lengkap: s.nama_lengkap,
						nis: s.nis,
						skorPoin: siswaPoinMap[s.id] || 0,
					}))
					.filter((s) => s.skorPoin < 0)
					.sort((a, b) => a.skorPoin - b.skorPoin);

				siswaPerhatian = minusStudents.slice(0, 5);
			}
		}

		return NextResponse.json({
			isWaliKelas: true,
			kelas: {
				id: targetKelas.id,
				nama_kelas: targetKelas.nama_kelas,
				wali_kelas: targetKelas.wali_kelas || userName,
				id_wali_kelas: targetKelas.id_wali_kelas,
			},
			tahunAjar: activeTA || { nama: '2026/2027', semester: 1 },
			stats: {
				totalSiswa,
				lakiLaki: totalLaki,
				perempuan: totalPerempuan,
				absensiHariIni: absensiHariIniStats,
				poin: poinStats,
			},
			siswaList,
			siswaPerhatian,
			siswaBolosList,
			siswaMapelBreakdown,
		});
	} catch (error) {
		console.error('Error GET /api/wali-kelas/my-class:', error);
		return NextResponse.json(
			{ error: 'Gagal memuat data rombel kelas binaan: ' + error.message },
			{ status: 500 }
		);
	}
}
