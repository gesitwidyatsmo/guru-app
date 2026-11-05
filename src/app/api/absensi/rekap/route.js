import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { normStatus, parseJamPelajaran, calculateHariAlfa, evaluateDailyAttendance, isJumatOrLibur } from '@/lib/absensiUtils';

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const kelas = searchParams.get('kelas');
		const bulan = searchParams.get('bulan') || 'all';
		const tahun = searchParams.get('tahun') || new Date().getFullYear();

		if (!kelas) {
			return NextResponse.json({ error: 'Parameter kelas harus diisi' }, { status: 400 });
		}

		const supabase = await createClient();

		// 1. Ambil data siswa aktif (diurutkan berdasarkan nomor_absen, fallback nama_lengkap)
		let siswaData = null;
		let { data: sData, error: siswaError } = await supabase
			.from('siswa')
			.select('id, nis, nama_lengkap, kelas, nomor_absen')
			.eq('kelas', kelas)
			.eq('status', 'Aktif')
			.order('nomor_absen', { ascending: true, nullsFirst: false })
			.order('nama_lengkap', { ascending: true });

		if (siswaError && (siswaError.code === '42703' || siswaError.message?.includes('nomor_absen'))) {
			const fallback = await supabase
				.from('siswa')
				.select('id, nis, nama_lengkap, kelas')
				.eq('kelas', kelas)
				.eq('status', 'Aktif')
				.order('nama_lengkap', { ascending: true });
			if (fallback.error) throw fallback.error;
			siswaData = fallback.data;
		} else if (siswaError) {
			throw siswaError;
		} else {
			siswaData = sData;
		}

		const siswaDiKelas = siswaData || [];
		
		const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		const periode = bulan === 'all' ? `Semua Bulan ${tahun}` : `${namaBulan[parseInt(bulan) - 1]} ${tahun}`;

		if (siswaDiKelas.length === 0) {
			return NextResponse.json({
				kelas,
				periode,
				tanggalList: [],
				siswa: [],
				totalSiswa: 0,
			});
		}

		// 2. Tentukan Rentang Tanggal
		let startDate;
		let endDate;
		if (bulan !== 'all') {
			const b = parseInt(bulan, 10);
			const y = parseInt(tahun, 10);
			startDate = `${y}-${String(b).padStart(2, '0')}-01`;
			const lastDay = new Date(y, b, 0).getDate();
			endDate = `${y}-${String(b).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		} else {
			startDate = `${tahun}-01-01`;
			endDate = `${tahun}-12-31`;
		}

		// 3. Ambil Sesi Mapel (Sumber Utama KBM) & Sesi Harian (Jika Ada)
		const [mapelSesiRes, harianSesiRes] = await Promise.all([
			supabase
				.from('absensi_mapel')
				.select('sesi_id, tanggal, jam_ke, mapel')
				.eq('kelas', kelas)
				.gte('tanggal', startDate)
				.lte('tanggal', endDate)
				.order('tanggal', { ascending: true }),
			supabase
				.from('absensi_harian')
				.select('sesi_id, tanggal')
				.eq('kelas', kelas)
				.gte('tanggal', startDate)
				.lte('tanggal', endDate),
		]);

		const mapelSessions = mapelSesiRes.data || [];
		const harianSessions = harianSesiRes.data || [];

		// Kumpulkan seluruh tanggal unik KBM (Dikecualikan Hari Jum'at / Libur Sekolah)
		const tanggalSet = new Set();
		mapelSessions.forEach((s) => {
			if (s.tanggal) {
				const tStr = String(s.tanggal).slice(0, 10);
				if (!isJumatOrLibur(tStr)) tanggalSet.add(tStr);
			}
		});
		harianSessions.forEach((s) => {
			if (s.tanggal) {
				const tStr = String(s.tanggal).slice(0, 10);
				if (!isJumatOrLibur(tStr)) tanggalSet.add(tStr);
			}
		});

		const tanggalList = Array.from(tanggalSet).sort();

		if (tanggalList.length === 0) {
			const rekapSiswaKosong = siswaDiKelas.map((siswa) => ({
				...siswa,
				absensi: {},
				ringkasan: { H: 0, I: 0, S: 0, A: 0, A_JP: 0, A_Detail: calculateHariAlfa(0) },
			}));

			return NextResponse.json({
				kelas,
				periode,
				tanggalList: [],
				siswa: rekapSiswaKosong,
				totalSiswa: rekapSiswaKosong.length,
			});
		}

		// 4. Ambil Detail Siswa Sesi Mapel & Harian
		const mapelSesiIds = mapelSessions.map((s) => s.sesi_id);
		const harianSesiIds = harianSessions.map((s) => s.sesi_id);

		const [mapelDetailsRes, harianDetailsRes] = await Promise.all([
			mapelSesiIds.length > 0
				? supabase
						.from('absensi_mapel_siswa')
						.select('sesi_id, siswa_id, status, keterangan')
						.in('sesi_id', mapelSesiIds)
				: { data: [] },
			harianSesiIds.length > 0
				? supabase
						.from('absensi_harian_siswa')
						.select('sesi_id, siswa_id, status, keterangan')
						.in('sesi_id', harianSesiIds)
				: { data: [] },
		]);

		const mapelDetails = mapelDetailsRes.data || [];
		const harianDetails = harianDetailsRes.data || [];

		// Indexing sesi mapel per sesi_id
		const mapelSesiMap = {};
		mapelSessions.forEach((s) => {
			const jpList = parseJamPelajaran(s.jam_ke);
			mapelSesiMap[s.sesi_id] = {
				tanggal: s.tanggal ? String(s.tanggal).slice(0, 10) : '',
				jam_ke: s.jam_ke,
				mapel: s.mapel || '',
				jp: jpList.length > 0 ? jpList.length : 1,
			};
		});

		// Indexing sesi harian per sesi_id
		const harianSesiMap = {};
		harianSessions.forEach((s) => {
			harianSesiMap[s.sesi_id] = s.tanggal ? String(s.tanggal).slice(0, 10) : '';
		});

		// 5. Olah Rekap Kehadiran Siswa Otomatis Berbasis Agregasi KBM
		const rekapSiswa = siswaDiKelas.map((siswa) => {
			const absensiSiswa = {};
			const ringkasan = { H: 0, I: 0, S: 0, A: 0, T: 0, C: 0, A_JP: 0, A_Detail: null };

			// Ambil semua rekapan mapel siswa ini
			const studentMapelAbsen = mapelDetails.filter((d) => String(d.siswa_id) === String(siswa.id));
			const studentHarianAbsen = harianDetails.filter((d) => String(d.siswa_id) === String(siswa.id));

			let totalJpAlfa = 0;
			const datesWithMapel = new Set();

			// Group mapel sessions by tanggal
			const studentMapelByDate = {};
			studentMapelAbsen.forEach((d) => {
				const sesi = mapelSesiMap[d.sesi_id];
				if (!sesi || !sesi.tanggal) return;
				if (isJumatOrLibur(sesi.tanggal)) return; // Lewati hari Jum'at

				datesWithMapel.add(sesi.tanggal);
				if (!studentMapelByDate[sesi.tanggal]) studentMapelByDate[sesi.tanggal] = [];

				studentMapelByDate[sesi.tanggal].push({
					jam_ke: sesi.jam_ke,
					mapel: sesi.mapel,
					status: d.status,
					keterangan: d.keterangan || '',
				});

				// Hitung JP Alfa
				if (normStatus(d.status) === 'alfa') {
					totalJpAlfa += sesi.jp;
				}
			});

			// Group harian sessions by tanggal
			const studentHarianByDate = {};
			studentHarianAbsen.forEach((d) => {
				const tgl = harianSesiMap[d.sesi_id];
				if (!tgl || isJumatOrLibur(tgl)) return;
				studentHarianByDate[tgl] = {
					status: d.status,
					keterangan: d.keterangan || '',
				};
			});

			// Evaluasi status kehadiran untuk setiap tanggal KBM aktif
			tanggalList.forEach((tanggal) => {
				const mapelToday = studentMapelByDate[tanggal];
				let finalStatus = '';
				let finalKeterangan = '';

				if (mapelToday && mapelToday.length > 0) {
					// Gunakan aturan cerdas: Min. 1 JP Hadir = Hadir Hari Itu
					const evalResult = evaluateDailyAttendance(mapelToday);
					finalStatus = evalResult.recommendedStatus;
					finalKeterangan = evalResult.recommendedKeterangan;
				} else if (studentHarianByDate[tanggal]) {
					finalStatus = studentHarianByDate[tanggal].status || '';
					finalKeterangan = studentHarianByDate[tanggal].keterangan || '';
				}

				if (finalStatus && finalStatus !== 'Belum Ada Data') {
					absensiSiswa[tanggal] = { status: finalStatus, keterangan: finalKeterangan };

					const s = normStatus(finalStatus);
					if (s === 'hadir') ringkasan.H++;
					else if (s === 'izin') ringkasan.I++;
					else if (s === 'sakit') ringkasan.S++;
					else if (s === 'alfa') ringkasan.A++;
				}
			});

			// Cek jika ada absensi harian alfa tanpa sesi mapel (tambahkan 7 JP)
			studentHarianAbsen.forEach((d) => {
				const tgl = harianSesiMap[d.sesi_id];
				if (!tgl || isJumatOrLibur(tgl)) return;
				const st = normStatus(d.status);
				if (st === 'alfa' && !datesWithMapel.has(tgl)) {
					totalJpAlfa += 7;
				}
			});

			// Konversi total JP Alfa menjadi Hari Alfa (7 JP = 1 Hari, sisa >= 5 JP = +1 Hari)
			const alfaCalc = calculateHariAlfa(totalJpAlfa);
			ringkasan.A_JP = totalJpAlfa;
			if (totalJpAlfa > 0) {
				ringkasan.A = Math.max(ringkasan.A, alfaCalc.totalHari);
			}
			ringkasan.A_Detail = alfaCalc;

			return {
				...siswa,
				absensi: absensiSiswa,
				ringkasan,
			};
		});

		return NextResponse.json({
			kelas,
			periode,
			tanggalList,
			siswa: rekapSiswa,
			totalSiswa: rekapSiswa.length,
		});
	} catch (error) {
		console.error('❌ Error fetching rekap:', error);
		return NextResponse.json({ error: 'Gagal mengambil data rekap', details: error.message }, { status: 500 });
	}
}
