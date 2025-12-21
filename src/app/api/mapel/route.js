import { getSheet } from '@/lib/sheets'; // pastikan path dan fungsi sudah benar

export async function GET() {
	const doc = await getSheet();
	// Pastikan tab Google Sheets namanya MASTER_MAPEL (huruf besar!)
	const sheet = doc.sheetsByTitle['MASTER_MAPEL'];
	const rows = await sheet.getRows();

	// Ubah data sheet menjadi array objek { id, mapel }
	const data = rows.map((row) => ({
		id: row.get('id'),
		mapel: row.get('mapel'),
	}));

	return Response.json(data);
}

// Fungsi untuk generate id baru (sederhana)
const generateId = () => Math.random().toString(36).substr(2, 9);

export async function POST(request) {
	const body = await request.json();
	const { mapel } = body; // Ambil properti dari form

	if (!mapel) {
		return Response.json({ error: 'Nama mapel wajib diisi' }, { status: 400 });
	}

	const doc = await getSheet();
	const sheet = doc.sheetsByTitle['MASTER_MAPEL'];

	// Buat baris baru
	await sheet.addRow({
		id: generateId(),
		mapel,
	});

	return Response.json({ success: true });
}

export async function PUT(request) {
	const body = await request.json();
	const { id, mapel } = body;

	if (!id || !mapel) {
		return Response.json({ error: 'ID dan nama mapel wajib diisi' }, { status: 400 });
	}

	const doc = await getSheet();
	const sheet = doc.sheetsByTitle['MASTER_MAPEL'];
	const rows = await sheet.getRows();

	// Cari row dengan id yang cocok
	const row = rows.find((r) => r.get('id') === id);

	if (row) {
		row.set('mapel', mapel);
		await row.save();
		return Response.json({ success: true });
	} else {
		return Response.json({ error: 'ID tidak ditemukan' }, { status: 404 });
	}
}

export async function DELETE(request) {
	const { id } = await request.json();
	if (!id) {
		return Response.json({ error: 'ID wajib diisi.' }, { status: 400 });
	}

	const doc = await getSheet();
	const sheet = doc.sheetsByTitle['MASTER_MAPEL'];
	const rows = await sheet.getRows();

	// Cari dan hapus row
	const row = rows.find((r) => r.get('id') === id);

	if (row) {
		await row.delete();
		return Response.json({ success: true });
	} else {
		return Response.json({ error: 'ID tidak ditemukan' }, { status: 404 });
	}
}
