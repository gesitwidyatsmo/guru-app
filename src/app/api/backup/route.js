import { getSheet } from '@/lib/sheets';

export async function GET() {
	try {
		const doc = await getSheet();

		// Daftar sheet utama yang ingin dibackup
		const targetSheets = [
			// 'MASTER_MAPEL',
			'MASTER_MAPEL',
			'MASTER_KELAS',
			'MASTER_JADWAL',
			'MASTER_SISWA',
			'MASTER_ABSENSI_HARIAN',
			'MASTER_ABSENSI_MAPEL',
			'MASTER_ABSENSI',
			'MASTER_JURNAL',
			'MASTER_POIN',
			'daftar_kategori_positif',
			'daftar_kategori_minus',
			'badge_poin',
			'MASTER_NILAI',
			'MASTER_GRUP',
			'MASTER_STATUS_ABSENSI',
		];

		const backupData = {};

		// Loop dan ambil isi tiap sheet
		for (const title of targetSheets) {
			const sheet = doc.sheetsByTitle[title];
			if (sheet) {
				const rows = await sheet.getRows();
				// Simpan raw data objek baris sebagai literal object
				backupData[title] = rows.map((row) => {
					// Gunakan .toObject() asli dari node-google-spreadsheet jika tersedia,
					// Atau destructure object row. Coba gunakan metode aman:
					const rawObj = {};
					sheet.headerValues.forEach((header) => {
						rawObj[header] = row.get(header) || '';
					});
					return rawObj;
				});
			} else {
				// Sheet tidak ditemukan, beri array kosong
				backupData[title] = [];
			}
		}

		return Response.json(backupData, { status: 200 });
	} catch (error) {
		console.error('❌ Error API Backup:', error);
		return Response.json({ error: 'Gagal melakukan backup database', details: error.message }, { status: 500 });
	}
}
