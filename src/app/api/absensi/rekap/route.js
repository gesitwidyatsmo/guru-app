import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

		if (bulan !== 'all') {
			const startDate = new Date(tahun, bulan - 1, 1).toISOString();
			const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString();
			querySesi = querySesi.gte('tanggal', startDate).lte('tanggal', endDate);
		} else {
			const startDate = new Date(tahun, 0, 1).toISOString();
			const endDate = new Date(tahun, 12, 0, 23, 59, 59).toISOString();
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
				ringkasan: { H: 0, I: 0, S: 0, A: 0 },
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

		// 4. Proses rekap per siswa
		const rekapSiswa = siswaDiKelas.map((siswa) => {
			const absensiSiswa = {};
			const ringkasan = { H: 0, I: 0, S: 0, A: 0, T: 0, C: 0 };

			const studentAbsensi = absensiDetails.filter(d => String(d.siswa_id) === String(siswa.id));

			studentAbsensi.forEach(detail => {
				const tanggal = sesiTanggalMap[detail.sesi_id];
				if (!tanggal) return;

				const status = detail.status || '';
				const keterangan = detail.keterangan || '';
				
				// Handle multiple sessions in same day if exists by overriding or just accepting the last one
				absensiSiswa[tanggal] = { status, keterangan };

				// Hitung ringkasan (sesuai status yang digunakan)
				const s = status.toLowerCase();
				if (s === 'hadir' || s === 'h') ringkasan.H++;
				else if (s === 'izin' || s === 'i') ringkasan.I++;
				else if (s === 'sakit' || s === 's') ringkasan.S++;
				else if (s === 'alpa' || s === 'a' || s === 'alpha') ringkasan.A++;
				else if (s === 'terlambat' || s === 't') ringkasan.T++;
				else if (s === 'cabut' || s === 'c') ringkasan.C++;
			});

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
