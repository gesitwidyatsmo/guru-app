import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_KBM = 'GURU_KBM';
const SHEET_USERS = 'MASTER_USERS';

function generateKBMId() {
	return 'KBM-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ---------------------------------------------------------------------------
// METHOD GET - Ambil Seluruh Data Penugasan Mengajar + Nama Guru (Join Tabel)
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		// Validasi Proteksi Middleware Tambahan: Pastikan Admin
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		const doc = await getSheet();
		const kbmSheet = doc.sheetsByTitle[SHEET_KBM];
		const userSheet = doc.sheetsByTitle[SHEET_USERS];

		if (!kbmSheet) return NextResponse.json([]); // Masih kosong

		const kbmRows = await kbmSheet.getRows();
		const userRows = userSheet ? await userSheet.getRows() : [];

		// Persiapkan Lookup (Penelusuran) Tabel User ID => Nama Lengkap & Username
		const userDict = {};
		userRows.forEach((u) => {
			userDict[u.get('id_user')] = {
				username: u.get('username'),
				nama_lengkap: u.get('nama_lengkap'),
			};
		});

		const result = kbmRows.map((r) => {
			const guruId = r.get('id_user');
			const userInfo = userDict[guruId] || { username: 'Akun Terhapus', nama_lengkap: 'Akun Terhapus' };

			return {
				id_kbm: r.get('id_kbm') || r.rowIndex, // Fallback jika id di masa lalu kosong
				id_user: guruId,
				username: userInfo.username,
				nama_guru: userInfo.nama_lengkap,
				kelas: r.get('kelas'),
				mapel: r.get('mapel'),
			};
		});

		// Sortir/Urutkan berdasarkan Nama Guru
		result.sort((a, b) => a.nama_guru.localeCompare(b.nama_guru));

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error('Error GET Penugasan:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan penarikan data relasional.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD POST - Menugaskan Kombinasi (Satu atau banyak row) KBM
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		// Body dapat berupa 1 objek assign tunggal, atau batch array
		const body = await req.json();
		const assignments = Array.isArray(body) ? body : [body];

		if (assignments.length === 0) {
			return NextResponse.json({ error: 'Data penugasan tidak terbaca.' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_KBM];
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_KBM,
				headerValues: ['id_kbm', 'id_user', 'kelas', 'mapel'],
			});
		}

		// Karena Google Sheets menerima format flat array of JSON
		const rowsToInsert = assignments.map((task) => ({
			id_kbm: generateKBMId(),
			id_user: task.id_user,
			kelas: task.kelas,
			mapel: task.mapel,
		}));

		await sheet.addRows(rowsToInsert);

		return NextResponse.json({ success: true, message: `${rowsToInsert.length} jadwal mengajar telah berhasil diformalkan.` }, { status: 201 });
	} catch (error) {
		console.error('Error POST KBM:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan perekaman database.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD DELETE - Mencabut satu jam mengajar guru
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Entitas Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);

		// Kita akan coba hapus memakai id_kbm (unique) atau row_index fallback sebagai alternatif
		const id_kbm = searchParams.get('id_kbm');

		if (!id_kbm) {
			return NextResponse.json({ error: 'ID penugasan / Row tak ditemukan.' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_KBM];
		if (!sheet) return NextResponse.json({ error: 'Data KBM belum terbuat.' }, { status: 404 });

		const rows = await sheet.getRows();
		const targetRow = rows.find((r) => r.get('id_kbm') === id_kbm || String(r.rowIndex) === id_kbm);

		if (!targetRow) {
			return NextResponse.json({ error: 'Baris penugasan yang dimaksud tidak terlacak.' }, { status: 404 });
		}

		await targetRow.delete();

		return NextResponse.json({ success: true, message: 'Hak mengajar kelas ini berhasil dicabut.' }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE KBM:', error);
		return NextResponse.json({ error: 'Pencabutan wewenang gagal.' }, { status: 500 });
	}
}
