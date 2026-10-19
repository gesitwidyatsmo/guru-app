import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { normStatus, parseJamPelajaran, calculateHariAlfa } from '@/lib/absensiUtils';

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const kelas = searchParams.get('kelas');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun') || new Date().getFullYear();

		if (!kelas || !bulan) {
			return NextResponse.json({ error: 'Parameter kelas dan bulan harus diisi' }, { status: 400 });
		}

		const supabase = await createClient();

		// 1. Ambil data siswa
		const { data: siswaData, error: siswaError } = await supabase
			.from('siswa')
			.select('id, nis, nama_lengkap, kelas')
			.eq('kelas', kelas)
			.eq('status', 'Aktif');

		if (siswaError) throw siswaError;

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

		// 2. Ambil data absensi harian (sesi)
		let querySesi = supabase.from('absensi_harian').select('sesi_id, tanggal').eq('kelas', kelas);

		let startDate;
		let endDate;
		if (bulan !== 'all') {
			startDate = new Date(tahun, bulan - 1, 1).toISOString();
			endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString();
			querySesi = querySesi.gte('tanggal', startDate).lte('tanggal', endDate);
		} else {
			startDate = new Date(tahun, 0, 1).toISOString();
			endDate = new Date(tahun, 12, 0, 23, 59, 59).toISOString();
			querySesi = querySesi.gte('tanggal', startDate).lte('tanggal', endDate);
		}

		const { data: sesiData, error: sesiError } = await querySesi;
		if (sesiError) throw sesiError;

		const sessions = sesiData || [];
		const tanggalSet = new Set();
		sessions.forEach(s => {
			if (s.tanggal) tanggalSet.add(String(s.tanggal).slice(0, 10));
		});
		const tanggalList = Array.from(tanggalSet).sort();

		if (sessions.length === 0) {
			const rekapSiswa = siswaDiKelas.map((siswa) => ({
				...siswa,
				absensi: {},
				ringkasan: { H: 0, I: 0, S: 0, A: 0, A_JP: 0, A_Detail: calculateHariAlfa(0) },
			}));

			return NextResponse.json({
				kelas,
				periode,
				tanggalList: [],
				siswa: rekapSiswa,
				totalSiswa: rekapSiswa.length,
			});
		}

		const sesiIds = sessions.map(s => s.sesi_id);

		// 3. Ambil detail absensi siswa
		const { data: detailData, error: detailError } = await supabase
			.from('absensi_harian_siswa')
			.select('sesi_id, siswa_id, status, keterangan')
			.in('sesi_id', sesiIds);

		if (detailError) throw detailError;
		const absensiDetails = detailData || [];

		// Create a map for quick lookup: map[sesi_id] -> tanggal
		const sesiTanggalMap = {};
		sessions.forEach(s => {
			sesiTanggalMap[s.sesi_id] = String(s.tanggal).slice(0, 10);
		});

		// 3B. Ambil data sesi mapel untuk perhitungan JP Alfa kumulatif
		const startDateStr = startDate.slice(0, 10);
		const endDateStr = endDate.slice(0, 10);

		const { data: mapelSesiData } = await supabase
			.from('absensi_mapel')
			.select('sesi_id, tanggal, jam_ke')
			.eq('kelas', kelas)
			.gte('tanggal', startDateStr)
			.lte('tanggal', endDateStr);

		let mapelDetails = [];
		const mapelSesiMap = {};
		if (mapelSesiData && mapelSesiData.length > 0) {
			mapelSesiData.forEach((s) => {
				const jpList = parseJamPelajaran(s.jam_ke);
				mapelSesiMap[s.sesi_id] = {
					tanggal: s.tanggal ? String(s.tanggal).slice(0, 10) : '',
					jam_ke: s.jam_ke,
					jp: jpList.length > 0 ? jpList.length : 1,
				};
			});

			const mapelSesiIds = mapelSesiData.map((s) => s.sesi_id);
			const { data: mDetails } = await supabase
				.from('absensi_mapel_siswa')
				.select('sesi_id, siswa_id, status')
				.in('sesi_id', mapelSesiIds);

			mapelDetails = mDetails || [];
		}

		// 4. Proses rekap per siswa
		const rekapSiswa = siswaDiKelas.map((siswa) => {
			const absensiSiswa = {};
			const ringkasan = { H: 0, I: 0, S: 0, A: 0, T: 0, C: 0, A_JP: 0, A_Detail: null };

			const studentAbsensi = absensiDetails.filter(d => String(d.siswa_id) === String(siswa.id));

			studentAbsensi.forEach(detail => {
				const tanggal = sesiTanggalMap[detail.sesi_id];
				if (!tanggal) return;

				const status = detail.status || '';
				const keterangan = detail.keterangan || '';
				
				// Handle multiple sessions in same day if exists by overriding or just accepting the last one
				absensiSiswa[tanggal] = { status, keterangan };

				// Hitung ringkasan (sesuai status harian)
				const s = normStatus(status);
				if (s === 'hadir') ringkasan.H++;
				else if (s === 'izin') ringkasan.I++;
				else if (s === 'sakit') ringkasan.S++;
				else if (s === 'alfa') ringkasan.A++;
				else if (s === 'terlambat') ringkasan.T++;
				else if (s === 'cabut') ringkasan.C++;
			});

			// Akumulasi JP Alfa dari seluruh sesi mapel
			let totalJpAlfa = 0;
			const studentMapelAbsen = mapelDetails.filter(d => String(d.siswa_id) === String(siswa.id));
			const datesWithMapel = new Set();

			studentMapelAbsen.forEach(d => {
				const sesi = mapelSesiMap[d.sesi_id];
				if (!sesi) return;
				if (sesi.tanggal) datesWithMapel.add(sesi.tanggal);
				const st = normStatus(d.status);
				if (st === 'alfa') {
					totalJpAlfa += sesi.jp;
				}
			});

			// Periksa apakah ada tanggal absensi harian yang berstatus alfa tanpa ada catatan mapel (misal input manual)
			studentAbsensi.forEach(detail => {
				const tgl = sesiTanggalMap[detail.sesi_id];
				const st = normStatus(detail.status);
				if (st === 'alfa' && !datesWithMapel.has(tgl)) {
					totalJpAlfa += 7; // Standar 1 hari penuh = 7 JP
				}
			});

			// Hitung hari alfa berdasarkan aturan user: 7 JP = 1 hari, sisa >= 5 JP = +1 hari
			const alfaCalc = calculateHariAlfa(totalJpAlfa);
			ringkasan.A_JP = totalJpAlfa;
			if (totalJpAlfa > 0) {
				ringkasan.A = alfaCalc.totalHari;
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
