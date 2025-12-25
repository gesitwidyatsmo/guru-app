import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_JURNAL';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

// GET JURNAL
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return Response.json({ error: `Sheet ${SHEET_NAME} tidak ditemukan` }, { status: 404 });

		const rows = await sheet.getRows();

		let data = rows.map((row) => ({
			id: row.get('id'),
			tanggal: row.get('tanggal'),
			jam_ke: row.get('jam_ke'),
			pertemuan_ke: row.get('pertemuan_ke') || '', // Field Baru
			kelas: row.get('kelas'),
			mapel: row.get('mapel'),
			materi: row.get('materi'),
			kegiatan: row.get('kegiatan'),
			hambatan: row.get('hambatan'),
			solusi: row.get('solusi'),
			tuntas: (row.get('tuntas') || '').toString().toLowerCase() === 'true',
		}));

		if (kelas) data = data.filter((d) => d.kelas === kelas);
		if (mapel) data = data.filter((d) => d.mapel === mapel);

		// Sort terbaru
		data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return Response.json(data, { status: 200 });
	} catch (error) {
		console.error('❌ Error GET jurnal:', error);
		return Response.json({ error: 'Gagal ambil data' }, { status: 500 });
	}
}

// POST JURNAL BARU
export async function POST(req) {
	try {
		const body = await req.json();
		// Destructure termasuk 'pertemuan_ke'
		const { tanggal, jam_ke, pertemuan_ke, kelas, mapel, materi, kegiatan, hambatan, solusi, tuntas } = body;

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const id = generateId();

		await sheet.addRow({
			id,
			tanggal,
			jam_ke: jam_ke || '',
			pertemuan_ke: pertemuan_ke || '', // Simpan ke Excel
			kelas,
			mapel,
			materi,
			kegiatan: kegiatan || '',
			hambatan: hambatan || '',
			solusi: solusi || '',
			tuntas: tuntas ? 'TRUE' : 'FALSE',
		});

		return Response.json({ success: true, id }, { status: 201 });
	} catch (error) {
		console.error('❌ Error POST jurnal:', error);
		return Response.json({ error: 'Gagal simpan' }, { status: 500 });
	}
}

// PUT UPDATE JURNAL
export async function PUT(req) {
	try {
		const body = await req.json();
		const { id, pertemuan_ke, ...others } = body; // Ambil pertemuan_ke

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (!row) return Response.json({ error: 'Data tidak ditemukan' }, { status: 404 });

		// Update field pertemuan_ke jika ada
		if (pertemuan_ke !== undefined) row.set('pertemuan_ke', pertemuan_ke);

		// Update field lainnya...
		Object.keys(others).forEach((key) => {
			if (key === 'tuntas') {
				row.set('tuntas', others[key] ? 'TRUE' : 'FALSE');
			} else {
				row.set(key, others[key]);
			}
		});

		await row.save();
		return Response.json({ success: true });
	} catch (error) {
		return Response.json({ error: 'Gagal update' }, { status: 500 });
	}
}

// DELETE JURNAL
export async function DELETE(req) {
	// ...Sama seperti sebelumnya...
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (row) await row.delete();

		return Response.json({ success: true });
	} catch (error) {
		return Response.json({ error: 'Gagal hapus' }, { status: 500 });
	}
}
