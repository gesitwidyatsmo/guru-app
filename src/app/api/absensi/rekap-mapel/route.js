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
		const mapel = searchParams.get('mapel');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun') || new Date().getFullYear();

		if (!kelas || !mapel || !bulan) {
			return Response.json({ error: 'Parameter kelas, mapel, dan bulan harus diisi' }, { status: 400 });
		}

		console.log(`REKAP MAPEL: ${kelas} - ${mapel} - ${bulan}/${tahun}`);

		const doc = await getSheet();

		// 1. Ambil Data Siswa (sama seperti rekap harian)
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (!siswaSheet) return Response.json({ error: 'Sheet Siswa 404' }, { status: 404 });
		
		const siswaRows = await siswaSheet.getRows();
		const siswaDiKelas = siswaRows
			.filter((row) => String(row.get('kelas')).trim() === kelas && row.get('status') === 'Aktif')
			.map((row) => ({
				id: String(row.get('id')),
				nis: String(row.get('nis')),
				nama_lengkap: String(row.get('nama_lengkap')),
				kelas: String(row.get('kelas')),
			}));

		if (siswaDiKelas.length === 0) {
			return Response.json({
				kelas,
				periode: `Bulan ${bulan} ${tahun}`,
				tanggalList: [],
				siswa: [],
			});
		}

		// 2. Ambil Data Absensi Mapel
		const mapelSheet = doc.sheetsByTitle['MASTER_ABSENSI_MAPEL'];
		if (!mapelSheet) return Response.json({ error: 'Sheet Absensi Mapel 404' }, { status: 404 });

		const mapelRows = await mapelSheet.getRows();

		// Filter Sesi (Pertemuan)
		const sesiFiltered = mapelRows.filter(row => {
			const rKelas = String(row.get('kelas')).trim();
			const rMapel = String(row.get('mapel')).trim();
			const rTanggal = normalizeDate(row.get('tanggal'));

			if (rKelas !== kelas) return false;
			if (rMapel !== mapel) return false;
			if (!rTanggal) return false;

			const d = new Date(rTanggal);
			if (bulan !== 'all') {
				if (d.getMonth() + 1 !== parseInt(bulan)) return false;
				if (d.getFullYear() !== parseInt(tahun)) return false;
			} else {
				if (d.getFullYear() !== parseInt(tahun)) return false;
			}
			return true;
		});

		// 3. Proses Data
		// Kita akan map sesi ke tanggal. Jika ada multiple sesi per hari, kita ambil yang terakhir atau merge (simplifikasi: ambil list tanggal unik)
		const tanggalSet = new Set();
		const absensiMap = {}; // Key: siswaId_tanggal => { status }

		sesiFiltered.forEach(row => {
			const tanggal = normalizeDate(row.get('tanggal'));
			tanggalSet.add(tanggal);

			let dataAbsensi = [];
			try {
				dataAbsensi = JSON.parse(row.get('data_absensi') || '[]');
			} catch (e) {
				dataAbsensi = [];
			}

			if (Array.isArray(dataAbsensi)) {
				dataAbsensi.forEach(item => {
					// item: { siswa_id, status, keterangan }
					const key = `${item.siswa_id}_${tanggal}`;
					absensiMap[key] = {
						status: item.status,
						keterangan: item.keterangan || ''
					};
				});
			}
		});

		const tanggalList = Array.from(tanggalSet).sort();

		// 4. Build Result
		const rekapSiswa = siswaDiKelas.map(siswa => {
			const absensiSiswa = {};
			const ringkasan = { H: 0, I: 0, S: 0, A: 0 };

			tanggalList.forEach(tgl => {
				const key = `${siswa.id}_${tgl}`;
				const data = absensiMap[key];
				if (data) {
					absensiSiswa[tgl] = data;
					const s = data.status;
					if (s === 'Hadir') ringkasan.H++;
					else if (s === 'Izin') ringkasan.I++;
					else if (s === 'Sakit') ringkasan.S++;
					else if (s === 'Alpha') ringkasan.A++;
				}
			});

			return {
				...siswa,
				absensi: absensiSiswa,
				ringkasan
			};
		});

		const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		const periode = bulan === 'all' ? `Semua Bulan ${tahun}` : `${namaBulan[parseInt(bulan) - 1]} ${tahun}`;

		return Response.json({
			kelas,
			periode,
			mapel,
			tanggalList,
			siswa: rekapSiswa,
			totalSiswa: rekapSiswa.length
		});

	} catch (error) {
		console.error('Error rekap mapel:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}
