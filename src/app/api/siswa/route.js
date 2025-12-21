import { getSheet } from '@/lib/sheets';

export async function GET() {
	try {
		const doc = await getSheet();

		// Pastikan nama tab sesuai persis dengan di spreadsheet
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_SISWA tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();

		const siswa = rows.map((row) => ({
			id: row.get('id'),
			nis: row.get('nis'),
			nama_lengkap: row.get('nama_lengkap'),
			kelas: row.get('kelas'),
			jenis_kelamin: row.get('jenis_kelamin'),
			status: row.get('status'),
		}));

		return Response.json(siswa);
	} catch (error) {
		console.error('Error fetching siswa:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// Tambahkan fungsi POST ini
export async function POST(req) {
	try {
		const body = await req.json();

		// Validasi data wajib
		if (!body.nama_lengkap || !body.kelas) {
			return Response.json({ error: 'Nama dan Kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];

		// Generate ID unik sederhana
		const newId = Math.random().toString(36).substr(2, 9);

		await sheet.addRow({
			id: newId,
			nis: body.nis || '',
			nama_lengkap: body.nama_lengkap,
			kelas: body.kelas,
			jenis_kelamin: body.jenis_kelamin || 'Laki-laki',
			status: body.status || 'Aktif',
		});

		return Response.json({ success: true, id: newId });
	} catch (error) {
		console.error('Error adding siswa:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}
