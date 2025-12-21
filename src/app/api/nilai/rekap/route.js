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

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun') || new Date().getFullYear();
		const mapel = searchParams.get('mapel');

		console.log('=== DEBUG REKAP NILAI ===');
		console.log('Query kelas:', kelas);
		console.log('Query bulan:', bulan);
		console.log('Query tahun:', tahun);
		console.log('Query mapel:', mapel);

		if (!kelas || !bulan) {
			return Response.json({ error: 'Parameter kelas dan bulan harus diisi' }, { status: 400 });
		}

		const doc = await getSheet();

		// 1. Ambil data siswa berdasarkan kelas
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (!siswaSheet) {
			return Response.json({ error: 'Sheet MASTER_SISWA tidak ditemukan' }, { status: 404 });
		}

		const siswaRows = await siswaSheet.getRows();
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

		console.log('Total siswa di kelas:', siswaDiKelas.length);

		// 2. Ambil data nilai
		const nilaiSheet = doc.sheetsByTitle['MASTER_NILAI'];
		if (!nilaiSheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		const nilaiRows = await nilaiSheet.getRows();

		// Filter nilai berdasarkan kelas, periode, dan mapel
		const filteredNilai = nilaiRows.filter((row) => {
			const rowKelas = String(row.get('kelas') || '').trim();
			const rowTanggal = normalizeDate(row.get('tanggal'));
			const rowMapel = String(row.get('mapel') || '').trim();

			if (rowKelas !== kelas) return false;

			// Filter mapel jika ada
			if (mapel && rowMapel !== mapel) return false;

			const tanggalObj = new Date(rowTanggal);
			const bulanTanggal = tanggalObj.getMonth() + 1;
			const tahunTanggal = tanggalObj.getFullYear();

			if (bulan === 'all') {
				return tahunTanggal === parseInt(tahun);
			} else {
				return bulanTanggal === parseInt(bulan) && tahunTanggal === parseInt(tahun);
			}
		});

		console.log('Total nilai ditemukan:', filteredNilai.length);

		// 3. Dapatkan daftar tugas unik
		const tugasMap = new Map();
		filteredNilai.forEach((row) => {
			const tugasId = String(row.get('tugas_id') || '');
			if (tugasId && !tugasMap.has(tugasId)) {
				tugasMap.set(tugasId, {
					tugas_id: tugasId,
					kategori: String(row.get('kategori') || ''),
					mapel: String(row.get('mapel') || ''),
					tanggal: normalizeDate(row.get('tanggal')),
				});
			}
		});

		const tugasList = Array.from(tugasMap.values()).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		console.log('Total tugas:', tugasList.length);

		// 4. Proses data per siswa
		const rekapSiswa = siswaDiKelas.map((siswa) => {
			const nilaiSiswa = {};
			let totalNilai = 0;
			let countNilai = 0;

			filteredNilai.forEach((row) => {
				const rowSiswaId = String(row.get('siswa_id') || '');
				const tugasId = String(row.get('tugas_id') || '');

				if (rowSiswaId === siswa.id && tugasId) {
					const nilai = parseFloat(row.get('nilai') || 0);
					nilaiSiswa[tugasId] = nilai;
					totalNilai += nilai;
					countNilai++;
				}
			});

			const avg = countNilai > 0 ? totalNilai / countNilai : 0;

			return {
				...siswa,
				nilai: nilaiSiswa,
				avg: avg,
				countNilai: countNilai,
			};
		});

		// 5. Format periode untuk display
		const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

		const periode = bulan === 'all' ? `Semua Bulan ${tahun}` : `${namaBulan[parseInt(bulan) - 1]} ${tahun}`;

		console.log('✅ Rekap berhasil dibuat');

		return Response.json({
			kelas,
			periode,
			mapel: mapel || 'Semua Mapel',
			tugasList,
			siswa: rekapSiswa,
			totalSiswa: rekapSiswa.length,
			totalTugas: tugasList.length,
		});
	} catch (error) {
		console.error('❌ Error fetching rekap nilai:', error);
		return Response.json({ error: 'Gagal mengambil data rekap', details: error.message }, { status: 500 });
	}
}
