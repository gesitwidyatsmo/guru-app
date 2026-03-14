import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_JURNAL';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

// GET JURNAL
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return Response.json({ error: `Sheet ${SHEET_NAME} tidak ditemukan` }, { status: 404 });

		const rows = await sheet.getRows();

		let data = rows.map((row) => ({
			id: row.get('id'),
			guru_id: row.get('guru_id') || '',
			tanggal: row.get('tanggal'),
			jam_ke: row.get('jam_ke'),
			pertemuan_ke: row.get('pertemuan_ke') || '',
			kelas: row.get('kelas'),
			mapel: row.get('mapel'),
			materi: row.get('materi'),
			kegiatan: row.get('kegiatan'),
			hambatan: row.get('hambatan'),
			solusi: row.get('solusi'),
			tuntas: (row.get('tuntas') || '').toString().toLowerCase() === 'true',
		}));

		// 1. Filter Isolasi Hak Akses (Guru hanya melihat miliknya)
		if (role === 'Guru' && userId) {
			data = data.filter((d) => String(d.guru_id) === String(userId));
		}

		// 2. Filter dari Parameter URL
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
		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const { tanggal, jam_ke, pertemuan_ke, kelas, mapel, materi, kegiatan, hambatan, solusi, tuntas } = body;

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_NAME];
		// Memastikan jika Master belum dibuat, Header baru dikonstruksi
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_NAME,
				headerValues: ['id', 'guru_id', 'tanggal', 'jam_ke', 'pertemuan_ke', 'kelas', 'mapel', 'materi', 'kegiatan', 'hambatan', 'solusi', 'tuntas'],
			});
		}

		const id = generateId();

		await sheet.addRow({
			id,
			guru_id: userId || '', // Labeling pembuat jurnal
			tanggal,
			jam_ke: jam_ke || '',
			pertemuan_ke: pertemuan_ke || '',
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
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const { id, pertemuan_ke, ...others } = body;

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return Response.json({ error: 'Data Jurnal tidak eksis' }, { status: 404 });

		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (!row) return Response.json({ error: 'Data Jurnal spesifik tidak ditemukan' }, { status: 404 });

		// Proteksi: Guru dilarang mengedit karya orang lain
		if (role === 'Guru' && String(row.get('guru_id')) !== String(userId)) {
			return Response.json({ error: 'Akses Ditolak: Ini bukan Jurnal ciptaan Anda!' }, { status: 403 });
		}

		if (pertemuan_ke !== undefined) row.set('pertemuan_ke', pertemuan_ke);

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
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return Response.json({ error: 'Data Jurnal tidak eksis' }, { status: 404 });

		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (!row) return Response.json({ error: 'Jurnal ini sudah tak ada di pangkalan data' }, { status: 404 });

		// Proteksi Hapus: Hanya Pemilik (atau Admin) yang boleh menghapus
		if (role === 'Guru' && String(row.get('guru_id')) !== String(userId)) {
			return Response.json({ error: 'Akses Ditolak: Anda mencoba menghapus Jurnal kolega Anda.' }, { status: 403 });
		}

		await row.delete();

		return Response.json({ success: true });
	} catch (error) {
		return Response.json({ error: 'Gagal hapus' }, { status: 500 });
	}
}
