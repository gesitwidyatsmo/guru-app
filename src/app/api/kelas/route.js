import { getSheet } from '@/lib/sheets'; // Sesuaikan path import library sheets Anda

// Helper untuk generate ID unik
const generateId = () => Math.random().toString(36).substr(2, 9);

// 1. GET: Ambil semua data kelas
export async function GET(request) {
	try {
		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];
		const userSheet = doc.sheetsByTitle['MASTER_USERS'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_KELAS tidak ditemukan' }, { status: 404 });
		}

		// Buat dictionary nama guru
		const userDict = {};
		if (userSheet) {
			const userRows = await userSheet.getRows();
			userRows.forEach((u) => {
				userDict[u.get('id_user')] = u.get('nama_lengkap');
			});
		}

		const role = request.headers.get('x-user-role');
		const userId = request.headers.get('x-user-id');
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';

		let allowedClasses = null;
		if (showAll || role === 'Admin') {
			allowedClasses = null; // Tembus filter, ambil semua kelas
		} else if (role === 'Guru' && userId) {
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				// Ambil kelas unik jikalau ada mapel ganda
				const list = kbmRows.filter((r) => String(r.get('id_user')) === String(userId)).map((r) => r.get('kelas'));
				allowedClasses = [...new Set(list)];
			} else {
				allowedClasses = [];
			}
		} else if (role !== 'Admin') {
			// Kalau bukan Guru dan bukan Admin, mungkin Guest -> Tolak / Kosongkan
			allowedClasses = [];
		}

		const rows = await sheet.getRows();
		const data = [];
		for (const row of rows) {
			const namaKelas = row.get('nama_kelas');
			if (allowedClasses === null || allowedClasses.includes(namaKelas)) {
				const idWali = row.get('id_wali_kelas') || '';
				data.push({
					id: row.get('id'),
					kelas: namaKelas,
					id_wali_kelas: idWali,
					wali_kelas: userDict[idWali] || row.get('wali_kelas') || '',
				});
			}
		}

		return Response.json(data);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// 2. POST: Tambah kelas baru
export async function POST(request) {
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { kelas, id_wali_kelas } = body;

		if (!kelas) {
			return Response.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];
		
		// Pastikan kita muat header
		await sheet.loadHeaderRow();
		if (!sheet.headerValues.includes('id_wali_kelas')) {
			const newHeaders = [...sheet.headerValues, 'id_wali_kelas'];
			await sheet.setHeaderRow(newHeaders);
		}

		// Tambah baris baru
		await sheet.addRow({
			id: generateId(),
			nama_kelas: kelas,
			id_wali_kelas: id_wali_kelas || '',
			wali_kelas: '', // Kosongkan wali_kelas manual, kita pakai ID
		});

		return Response.json({ success: true });
	} catch (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}
}

// 3. PUT: Edit/Update data kelas
export async function PUT(request) {
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { id, kelas, id_wali_kelas } = body;

		if (!id || !kelas) {
			return Response.json({ error: 'ID dan nama kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_KELAS'];

		await sheet.loadHeaderRow();
		if (!sheet.headerValues.includes('id_wali_kelas')) {
			const newHeaders = [...sheet.headerValues, 'id_wali_kelas'];
			await sheet.setHeaderRow(newHeaders);
		}

		const rows = await sheet.getRows();

		// Cari baris berdasarkan ID
		const row = rows.find((r) => r.get('id') === id);

		if (row) {
			row.set('nama_kelas', kelas);
			row.set('id_wali_kelas', id_wali_kelas || '');
			row.set('wali_kelas', ''); // hapus redudansi manual
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
	if (request.headers.get('x-user-role') === 'Guru') {
		return Response.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		// AMBIL DARI URL SEARCH PARAMS
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

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
