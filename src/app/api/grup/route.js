import { getSheet } from '@/lib/sheets';

// GET: Ambil data grup LENGKAP dengan nama siswa
export async function GET() {
	try {
		const doc = await getSheet();

		// 1. Ambil Data Grup
		const sheetGrup = doc.sheetsByTitle['MASTER_GRUP'];
		if (!sheetGrup) return Response.json({ error: 'Sheet MASTER_GRUP not found' }, { status: 404 });
		const rowsGrup = await sheetGrup.getRows();

		// 2. Ambil Data Siswa (untuk Lookup Nama)
		//    Kita ambil semua siswa sekali jalan agar efisien (daripada query satu2)
		const sheetSiswa = doc.sheetsByTitle['MASTER_SISWA'];
		const rowsSiswa = await sheetSiswa.getRows();

		// Buat Dictionary/Map Siswa: { 'SIS-001': { nama: 'Budi', ... }, ... }
		const siswaMap = {};
		rowsSiswa.forEach((row) => {
			siswaMap[row.get('id')] = {
				id: row.get('id'),
				nama: row.get('nama_lengkap'),
				// Tambahkan field lain jika perlu (misal foto/nis)
			};
		});

		// 3. Gabungkan Data (Hydration Process)
		const groups = rowsGrup.map((row) => {
			let parsedJson = [];
			try {
				const raw = row.get('data_json');
				parsedJson = raw ? JSON.parse(raw) : [];
			} catch (e) {
				parsedJson = [];
			}

			// 🔄 HYDRATION LOGIC: Ubah ID menjadi Object Siswa Lengkap
			const hydratedJson = parsedJson.map((group) => ({
				...group,
				// Ganti array ID string ["1", "2"] menjadi array Object Siswa [{id:"1", nama:"Budi"}, ...]
				members: (group.anggota_ids || []).map((siswaId) => {
					// Cari data siswa di Map, kalau tidak ada return object fallback
					return siswaMap[siswaId] || { id: siswaId, nama: 'Siswa Tidak Dikenal' };
				}),
			}));

			return {
				id: row.get('id'),
				judul_kegiatan: row.get('judul_kegiatan'),
				kelas_id: row.get('kelas_id'),
				mapel_id: row.get('mapel_id'),
				tanggal: row.get('tanggal'),
				total_grup: parsedJson.length,
				total_siswa: parsedJson.reduce((acc, curr) => acc + (curr.anggota_ids?.length || 0), 0),

				// Kirim data yang SUDAH lengkap namanya
				raw_json: hydratedJson,
			};
		});

		return Response.json(groups.reverse());
	} catch (error) {
		console.error('API Error:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// POST: Simpan grup baru
export async function POST(req) {
	try {
		const body = await req.json();
		const doc = await getSheet();
		let sheet = doc.sheetsByTitle['MASTER_GRUP'];

		// Auto create sheet jika belum ada (opsional)
		if (!sheet) {
			sheet = await doc.addSheet({ title: 'MASTER_GRUP', headerValues: ['id', 'judul_kegiatan', 'kelas_id', 'mapel_id', 'tanggal', 'data_json'] });
		}

		const newId = 'GRP-' + Date.now().toString(36).toUpperCase();

		await sheet.addRow({
			id: newId,
			judul_kegiatan: body.judul_kegiatan,
			kelas_id: body.kelas_id,
			mapel_id: body.mapel_id || '-',
			tanggal: new Date().toISOString().split('T')[0],
			data_json: JSON.stringify(body.data_grup), // Simpan struktur grup sbg JSON string
		});

		return Response.json({ success: true, id: newId });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// PUT: Update struktur grup yang sudah ada
export async function PUT(req) {
	try {
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

		// UPDATE DATA
		rowToUpdate.set('data_json', JSON.stringify(data_grup));
		// rowToUpdate.set('tanggal', new Date().toISOString().split('T')[0]);

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

		await rowToDelete.delete(); // Hapus baris dari spreadsheet

		return Response.json({ success: true, message: 'Grup berhasil dihapus' });
	} catch (error) {
		console.error('API Error Delete:', error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}
