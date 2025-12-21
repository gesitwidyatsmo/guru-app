import { getSheet } from '@/lib/sheets';

export async function GET() {
	try {
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_STATUS_ABSENSI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_STATUS_ABSENSI tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const data = rows.map((row) => ({
			id: row.get('id'),
			kode: row.get('kode'),
			label: row.get('label'),
			warna: row.get('warna') || '',
		}));

		return Response.json(data);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}
