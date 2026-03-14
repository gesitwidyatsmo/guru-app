import { getSheet } from '@/lib/sheets';

// GET: Ambil data grup LENGKAP dengan nama siswa
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const doc = await getSheet();

		// 1. Ambil Data Grup
		const sheetGrup = doc.sheetsByTitle['MASTER_GRUP'];
		if (!sheetGrup) return Response.json({ error: 'Sheet MASTER_GRUP not found' }, { status: 404 });
		const rowsGrup = await sheetGrup.getRows();

		// 2. Ambil Data Siswa (untuk Lookup Nama)
		const sheetSiswa = doc.sheetsByTitle['MASTER_SISWA'];
		const rowsSiswa = await sheetSiswa.getRows();

		const siswaMap = {};
		rowsSiswa.forEach((row) => {
			siswaMap[row.get('id')] = {
				id: row.get('id'),
				nama: row.get('nama_lengkap'),
			};
		});

		// 3. Gabungkan Data (Hydration Process)
		let groups = rowsGrup.map((row) => {
			let parsedJson = [];
			try {
				const raw = row.get('data_json');
				parsedJson = raw ? JSON.parse(raw) : [];
			} catch (e) {
				parsedJson = [];
			}

			const hydratedJson = parsedJson.map((group) => ({
				...group,
				members: (group.anggota_ids || []).map((siswaId) => {
					return siswaMap[siswaId] || { id: siswaId, nama: 'Siswa Tidak Dikenal' };
				}),
			}));

			return {
				id: row.get('id'),
				guru_id: row.get('guru_id') || '',
				judul_kegiatan: row.get('judul_kegiatan'),
				kelas_id: row.get('kelas_id'),
				mapel_id: row.get('mapel_id'),
				tanggal: row.get('tanggal'),
				total_grup: parsedJson.length,
				total_siswa: parsedJson.reduce((acc, curr) => acc + (curr.anggota_ids?.length || 0), 0),
				raw_json: hydratedJson,
			};
		});

		// 4. Implementasikan Isolasi Kepemilikan (Khusus Guru)
		if (role === 'Guru' && userId) {
			groups = groups.filter((g) => String(g.guru_id) === String(userId));
		}

		return Response.json(groups.reverse());
	} catch (error) {
		console.error('API Error:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// POST: Simpan grup baru
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const doc = await getSheet();
		let sheet = doc.sheetsByTitle['MASTER_GRUP'];

		if (!sheet) {
			sheet = await doc.addSheet({ title: 'MASTER_GRUP', headerValues: ['id', 'guru_id', 'judul_kegiatan', 'kelas_id', 'mapel_id', 'tanggal', 'data_json'] });
		}

		const newId = 'GRP-' + Date.now().toString(36).toUpperCase();

		await sheet.addRow({
			id: newId,
			guru_id: userId || '',
			judul_kegiatan: body.judul_kegiatan,
			kelas_id: body.kelas_id,
			mapel_id: body.mapel_id || '-',
			tanggal: new Date().toISOString().split('T')[0],
			data_json: JSON.stringify(body.data_grup),
		});

		return Response.json({ success: true, id: newId });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// PUT: Update struktur grup yang sudah ada
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const body = await req.json();
		const { id, data_grup } = body;

		if (!id || !data_grup) {
			return Response.json({ error: 'ID dan Data Grup wajib ada' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_GRUP'];

		if (!sheet) return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();
		const rowToUpdate = rows.find((r) => r.get('id') === id);

		if (!rowToUpdate) {
			return Response.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
		}

		// Proteksi: Hanya Pembuat yang Boleh Memodifikasi
		if (role === 'Guru' && String(rowToUpdate.get('guru_id')) !== String(userId)) {
			return Response.json({ error: 'Akses Ditolak: Anda mencoba menyunting Grup Formasi buatan orang lain.' }, { status: 403 });
		}

		// UPDATE DATA
		rowToUpdate.set('data_json', JSON.stringify(data_grup));

		await rowToUpdate.save();

		return Response.json({ success: true, message: 'Berhasil diupdate' });
	} catch (error) {
		console.error('API Error Update:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// DELETE: Hapus grup berdasarkan ID
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return Response.json({ error: 'ID wajib ada' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_GRUP'];

		if (!sheet) return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();
		const rowToDelete = rows.find((r) => r.get('id') === id);

		if (!rowToDelete) {
			return Response.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
		}

		// Proteksi: Hanya Pembuat yang Boleh Menghapus
		if (role === 'Guru' && String(rowToDelete.get('guru_id')) !== String(userId)) {
			return Response.json({ error: 'Akses Ditolak: Anda mencoba menghapus Formasi Grup kolega.' }, { status: 403 });
		}

		await rowToDelete.delete();

		return Response.json({ success: true, message: 'Grup berhasil dihapus' });
	} catch (error) {
		console.error('API Error Delete:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}
