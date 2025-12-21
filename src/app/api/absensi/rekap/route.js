import { getSheet } from '@/lib/sheets';

function normalizeDate(value) {
	if (!value) return '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
		return String(value);
	}
	const d = new Date(value);
	if (isNaN(d.getTime())) return String(value);
	return d.toISOString().slice(0, 10);
}

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const kelas = searchParams.get('kelas');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun') || new Date().getFullYear();

		console.log('=== DEBUG REKAP ABSENSI ===');
		console.log('Query kelas:', kelas);
		console.log('Query bulan:', bulan);
		console.log('Query tahun:', tahun);

		if (!kelas || !bulan) {
			return Response.json({ error: 'Parameter kelas dan bulan harus diisi' }, { status: 400 });
		}

		const doc = await getSheet();

		// 1. Ambil data siswa berdasarkan kelas
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (!siswaSheet) {
			console.error('Sheet MASTER_SISWA tidak ditemukan');
			return Response.json({ error: 'Sheet MASTER_SISWA tidak ditemukan' }, { status: 404 });
		}

		const siswaRows = await siswaSheet.getRows();
		console.log('Total siswa rows:', siswaRows?.length || 0);

		if (!siswaRows || siswaRows.length === 0) {
			console.log('Tidak ada data siswa');
			return Response.json({
				kelas,
				periode: bulan === 'all' ? `Semua Bulan ${tahun}` : `Bulan ${bulan} ${tahun}`,
				tanggalList: [],
				siswa: [],
				totalSiswa: 0,
			});
		}

		const siswaDiKelas = siswaRows
			.filter((row) => {
				const rowKelas = String(row.get('kelas') || '').trim();
				const rowStatus = String(row.get('status') || '').trim();
				return rowKelas === kelas && rowStatus === 'Aktif';
			})
			.map((row) => ({
				id: String(row.get('id') || ''),
				nis: String(row.get('nis') || ''),
				nama_lengkap: String(row.get('nama_lengkap') || ''),
				kelas: String(row.get('kelas') || ''),
			}));

		console.log('Total siswa di kelas ' + kelas + ':', siswaDiKelas.length);

		if (siswaDiKelas.length === 0) {
			console.log('Tidak ada siswa aktif di kelas ini');
			return Response.json({
				kelas,
				periode: bulan === 'all' ? `Semua Bulan ${tahun}` : `Bulan ${bulan} ${tahun}`,
				tanggalList: [],
				siswa: [],
				totalSiswa: 0,
			});
		}

		// 2. Ambil data absensi
		const absensiSheet = doc.sheetsByTitle['MASTER_ABSENSI'];
		if (!absensiSheet) {
			console.error('Sheet MASTER_ABSENSI tidak ditemukan');
			return Response.json({ error: 'Sheet MASTER_ABSENSI tidak ditemukan' }, { status: 404 });
		}

		const absensiRows = await absensiSheet.getRows();
		console.log('Total absensi rows:', absensiRows?.length || 0);

		if (!absensiRows || absensiRows.length === 0) {
			console.log('Tidak ada data absensi');
			// Return data siswa tanpa absensi
			const rekapSiswa = siswaDiKelas.map((siswa) => ({
				...siswa,
				absensi: {},
				ringkasan: { H: 0, I: 0, S: 0, A: 0 },
			}));

			return Response.json({
				kelas,
				periode: bulan === 'all' ? `Semua Bulan ${tahun}` : `Bulan ${bulan} ${tahun}`,
				tanggalList: [],
				siswa: rekapSiswa,
				totalSiswa: rekapSiswa.length,
			});
		}

		// Filter absensi berdasarkan kelas dan periode
		const filteredAbsensi = absensiRows.filter((row) => {
			const rowKelas = String(row.get('kelas') || '').trim();
			const rowTanggal = normalizeDate(row.get('tanggal'));

			if (rowKelas !== kelas) return false;
			if (!rowTanggal) return false;

			const tanggalObj = new Date(rowTanggal);
			if (isNaN(tanggalObj.getTime())) return false;

			const bulanTanggal = tanggalObj.getMonth() + 1;
			const tahunTanggal = tanggalObj.getFullYear();

			if (bulan === 'all') {
				return tahunTanggal === parseInt(tahun);
			} else {
				return bulanTanggal === parseInt(bulan) && tahunTanggal === parseInt(tahun);
			}
		});

		console.log('Total absensi ditemukan:', filteredAbsensi.length);

		// 3. Dapatkan daftar tanggal unik
		const tanggalSet = new Set();
		filteredAbsensi.forEach((row) => {
			const tanggal = normalizeDate(row.get('tanggal'));
			if (tanggal) tanggalSet.add(tanggal);
		});
		const tanggalList = Array.from(tanggalSet).sort();

		console.log('Tanggal list:', tanggalList);

		// 4. Proses data per siswa
		const rekapSiswa = siswaDiKelas.map((siswa) => {
			const absensiSiswa = {};
			const ringkasan = { H: 0, I: 0, S: 0, A: 0 };

			filteredAbsensi.forEach((row) => {
				const rowSiswaId = String(row.get('siswa_id') || '');

				if (rowSiswaId === siswa.id) {
					const tanggal = normalizeDate(row.get('tanggal'));
					const status = String(row.get('status') || '');
					const keterangan = String(row.get('keterangan') || '');

					absensiSiswa[tanggal] = { status, keterangan };

					// Hitung ringkasan
					if (status === 'Hadir') ringkasan.H++;
					else if (status === 'Izin') ringkasan.I++;
					else if (status === 'Sakit') ringkasan.S++;
					else if (status === 'Alpha') ringkasan.A++;
				}
			});

			return {
				...siswa,
				absensi: absensiSiswa,
				ringkasan,
			};
		});

		// 5. Format periode untuk display
		const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

		const periode = bulan === 'all' ? `Semua Bulan ${tahun}` : `${namaBulan[parseInt(bulan) - 1]} ${tahun}`;

		console.log('✅ Rekap berhasil dibuat');
		console.log('Total siswa dalam rekap:', rekapSiswa.length);

		return Response.json({
			kelas,
			periode,
			tanggalList,
			siswa: rekapSiswa,
			totalSiswa: rekapSiswa.length,
		});
	} catch (error) {
		console.error('❌ Error fetching rekap:', error);
		console.error('Error stack:', error.stack);
		return Response.json({ error: 'Gagal mengambil data rekap', details: error.message }, { status: 500 });
	}
}
