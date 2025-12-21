import { getSheet } from '@/lib/sheets'; // Sesuaikan path import library sheets Anda

// Helper untuk generate ID unik
const generateId = () => Math.random().toString(36).substr(2, 9);

// 1. GET: Ambil semua data kelas
export async function GET() {
	try {
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_KELAS tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const data = rows.map((row) => ({
			id: row.get('id'),
			kelas: row.get('nama_kelas'),
			wali_kelas: row.get('wali_kelas') || '', // Ambil wali kelas, default kosong
		}));

		return Response.json(data);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// 2. POST: Tambah kelas baru
export async function POST(request) {
	try {
		const body = await request.json();
		const { kelas, wali_kelas } = body;

		if (!kelas) {
			return Response.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];

		// Tambah baris baru
		await sheet.addRow({
			id: generateId(),
			nama_kelas: kelas,
			wali_kelas: wali_kelas || '',
		});

		return Response.json({ success: true });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// 3. PUT: Edit/Update data kelas
export async function PUT(request) {
	try {
		const body = await request.json();
		const { id, kelas, wali_kelas } = body;

		if (!id || !kelas) {
			return Response.json({ error: 'ID dan nama kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];
		const rows = await sheet.getRows();

		// Cari baris berdasarkan ID
		const row = rows.find((r) => r.get('id') === id);

		if (row) {
			row.set('nama_kelas', kelas);
			row.set('wali_kelas', wali_kelas || ''); // Update wali kelas juga
			await row.save();
			return Response.json({ success: true });
		} else {
			return Response.json({ error: 'ID kelas tidak ditemukan' }, { status: 404 });
		}
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// 4. DELETE: Hapus kelas
export async function DELETE(request) {
	try {
		const body = await request.json();
		const { id } = body;

		if (!id) {
			return Response.json({ error: 'ID wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];
		const rows = await sheet.getRows();

		const row = rows.find((r) => r.get('id') === id);

		if (row) {
			await row.delete();
			return Response.json({ success: true });
		} else {
			return Response.json({ error: 'ID kelas tidak ditemukan' }, { status: 404 });
		}
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}
