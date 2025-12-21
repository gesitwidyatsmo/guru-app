// src/app/api/jadwal/route.js
import { getSheet } from '@/lib/sheets';

export async function GET() {
	try {
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_JADWAL'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_JADWAL tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();

		const jadwal = rows
			.map((row) => ({
				id: row.get('id'),
				kelas: row.get('kelas'),
				mapel: row.get('mapel'),
				jam_ke: Number(row.get('jam_ke')), // pastikan number
				hari: row.get('hari'),
				jam_mulai: row.get('jam_mulai'),
				jam_selesai: row.get('jam_selesai'),
			}))
			.sort((a, b) => a.jam_ke - b.jam_ke); // sorting ASC
		// console.log('data:', jadwal);

		return Response.json(jadwal);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// POST (Tambah)
export async function POST(req) {
	const body = await req.json();
	const doc = await getSheet();
	const sheet = doc.sheetsByTitle['MASTER_JADWAL'];

	// Generate ID manual sederhana
	const newId = Math.floor(Math.random() * 100000).toString();

	await sheet.addRow({
		id: newId,
		mapel: body.mapel,
		kelas: body.kelas,
		hari: body.hari,
		jam_mulai: body.jam_mulai,
		jam_selesai: body.jam_selesai,
	});

	return Response.json({ success: true });
}

// PUT (Update)
export async function PUT(req) {
	const body = await req.json();
	const doc = await getSheet();
	const sheet = doc.sheetsByTitle['MASTER_JADWAL'];
	const rows = await sheet.getRows();

	// Cari baris berdasarkan ID
	const row = rows.find((r) => r.get('id') === body.id);

	if (row) {
		row.set('mapel', body.mapel);
		row.set('kelas', body.kelas);
		row.set('hari', body.hari);
		row.set('jam_mulai', body.jam_mulai);
		row.set('jam_selesai', body.jam_selesai);
		await row.save();
		return Response.json({ success: true });
	}

	return Response.json({ error: 'Not found' }, { status: 404 });
}
