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
				jam_ke: Number(row.get('jam_ke')),
				hari: row.get('hari'),
				jam_mulai: row.get('jam_mulai'),
				jam_selesai: row.get('jam_selesai'),
			}))
			.sort((a, b) => a.jam_ke - b.jam_ke);

		return Response.json(jadwal);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_JADWAL'];

		// Generate ID unik
		const newId = Math.floor(Math.random() * 100000).toString();

		await sheet.addRow({
			id: newId,
			mapel: body.mapel,
			kelas: body.kelas,
			hari: body.hari,
			jam_ke: body.jam_ke || '', // Pastikan kolom ini ada
			jam_mulai: body.jam_mulai,
			jam_selesai: body.jam_selesai,
		});

		return Response.json({ success: true, id: newId });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_JADWAL'];
		const rows = await sheet.getRows();

		const row = rows.find((r) => r.get('id') === body.id);
		if (row) {
			row.set('mapel', body.mapel);
			row.set('kelas', body.kelas);
			row.set('hari', body.hari);
			row.set('jam_ke', body.jam_ke); // Update jam_ke juga
			row.set('jam_mulai', body.jam_mulai);
			row.set('jam_selesai', body.jam_selesai);
			await row.save();
			return Response.json({ success: true });
		}
		return Response.json({ error: 'Data tidak ditemukan' }, { status: 404 });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// --- TAMBAHAN BARU: METHOD DELETE ---
export async function DELETE(req) {
	try {
		const { id } = await req.json(); // Ambil ID dari body request

		if (!id) return Response.json({ error: 'ID diperlukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_JADWAL'];
		const rows = await sheet.getRows();

		const row = rows.find((r) => r.get('id') === id);
		if (row) {
			await row.delete(); // Hapus baris
			return Response.json({ success: true });
		}

		return Response.json({ error: 'Data tidak ditemukan' }, { status: 404 });
	} catch (error) {
		console.error('Delete Error:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}
