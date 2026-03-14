import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_KBM = 'GURU_KBM';

function generateKBMId() {
	return 'KBM-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Endpoint ini diciptakan khusus menangani aksi mencentang (Checkbox) Master
 * Kelas atau Mapel Mandiri oleh Guru (Self-Service).
 */

// 1. GET: Ambil apa saja Kelas & Mapel yang sudah dia centang
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role !== 'Guru' || !userId) {
			return NextResponse.json({ error: 'Akses Ditolak: Hanya Guru yang dapat melihat Profil Ajarnya.' }, { status: 403 });
		}

		const doc = await getSheet();
		const kbmSheet = doc.sheetsByTitle[SHEET_KBM];
		if (!kbmSheet) {
			return NextResponse.json({ kelas: [], mapel: [] }, { status: 200 });
		}

		const kbmRows = await kbmSheet.getRows();
		const myRows = kbmRows.filter((r) => String(r.get('id_user')) === String(userId));

		const myClasses = [...new Set(myRows.map((r) => r.get('kelas')).filter((val) => val && val.trim() !== ''))];
		const myMapels = [...new Set(myRows.map((r) => r.get('mapel')).filter((val) => val && val.trim() !== ''))];

		return NextResponse.json({ kelas: myClasses, mapel: myMapels }, { status: 200 });
	} catch (error) {
		console.error('Error GET KBM Mandiri:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan penarikan data.' }, { status: 500 });
	}
}

// 2. POST: Timpa pilihan Kelas ATAU Mapel yang baru. (Cartesian Product Logika)
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role !== 'Guru' || !userId) {
			return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
		}

		const body = await req.json();
		const { target, data } = body; // target = 'kelas' atau 'mapel'

		if (!target || !Array.isArray(data)) {
			return NextResponse.json({ error: 'Format Payload Cacat.' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_KBM];
		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_KBM,
				headerValues: ['id_kbm', 'id_user', 'kelas', 'mapel'],
			});
		}

		const kbmRows = await kbmSheetRows(sheet);
		const myRows = kbmRows.filter((r) => String(r.get('id_user')) === String(userId));

		// Kumpulkan data masa lalu agar tidak hilang persilangannya
		let currentClasses = [...new Set(myRows.map((r) => r.get('kelas')).filter((val) => val && val.trim() !== ''))];
		let currentMapels = [...new Set(myRows.map((r) => r.get('mapel')).filter((val) => val && val.trim() !== ''))];

		if (target === 'kelas') {
			currentClasses = data; // replace array kelas
		} else if (target === 'mapel') {
			currentMapels = data; // replace array mapel
		}

		// Bila Kosong sama sekali, masukkan array dummy [''] agar tak lenyap persilangannya
		if (currentClasses.length === 0) currentClasses = [''];
		if (currentMapels.length === 0) currentMapels = [''];

		// Jika memang betul-betul user tidak mengajukan keduanya, kita anggap kosong mutlak (Batal)
		if (currentClasses.length === 1 && currentClasses[0] === '' && currentMapels.length === 1 && currentMapels[0] === '') {
			currentClasses = [];
			currentMapels = [];
		}

		// STEP A: Delete baris historikal punya Guru ini
		for (const row of myRows) {
			await row.delete();
		}

		// STEP B: Generate Cartesian Product
		const rowsToInsert = [];
		for (const kelasVal of currentClasses) {
			for (const mapelVal of currentMapels) {
				rowsToInsert.push({
					id_kbm: generateKBMId(),
					id_user: userId,
					kelas: kelasVal,
					mapel: mapelVal,
				});
			}
		}

		// Insert ke Google Sheets jika ada
		if (rowsToInsert.length > 0) {
			await sheet.addRows(rowsToInsert);
		}

		return NextResponse.json({ success: true, message: 'Daftar yurisdiksi Anda berhasil di-sinkronisasi.' }, { status: 200 });
	} catch (error) {
		console.error('Error POST KBM Mandiri:', error);
		return NextResponse.json({ error: 'Kegagalan memperbarui data master penugasan.' }, { status: 500 });
	}
}

// helper wrapper karena `sheet.getRows()` tidak auto-refresh mutasi loop `delete()`
async function kbmSheetRows(sheet) {
	return await sheet.getRows();
}
