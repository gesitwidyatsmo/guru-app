import { getSheet } from '@/lib/sheets'; // pastikan path dan fungsi sudah benar

export async function GET(request) {
	const doc = await getSheet();
	// Pastikan tab Google Sheets namanya MASTER_MAPEL (huruf besar!)
	const sheet = doc.sheetsByTitle['MASTER_MAPEL'];
	const role = request.headers.get('x-user-role');
	const userId = request.headers.get('x-user-id');
	const { searchParams } = new URL(request.url);
	const showAll = searchParams.get('all') === 'true';

	let allowedMapels = null;
	if (showAll || role === 'Admin') {
		allowedMapels = null;
	} else if (role === 'Guru' && userId) {
		const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
		if (kbmSheet) {
			const kbmRows = await kbmSheet.getRows();
			const list = kbmRows.filter((r) => String(r.get('id_user')) === String(userId)).map((r) => r.get('mapel'));
			allowedMapels = [...new Set(list)];
		} else {
			allowedMapels = [];
		}
	} else if (role !== 'Admin') {
		allowedMapels = [];
	}

	const rows = await sheet.getRows();

	// Ubah data sheet menjadi array objek { id, mapel }
	const data = [];
	for (const row of rows) {
		const namaMapel = row.get('mapel');
		if (allowedMapels === null || allowedMapels.includes(namaMapel)) {
			data.push({
				id: row.get('id'),
				mapel: namaMapel,
			});
		}
	}

	return Response.json(data);
}

// Fungsi untuk generate id baru (sederhana)
const generateId = () => Math.random().toString(36).substr(2, 9);

export async function POST(request) {
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
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
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
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
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
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
