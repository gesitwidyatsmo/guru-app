import { getSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx'; // Pastikan import ini ada

// --- METHOD GET (Ambil Data) ---
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const status = searchParams.get('status');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (!sheet) return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		let allowedClasses = null;
		if (role === 'Guru' && userId) {
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				const list = kbmRows.filter((r) => String(r.get('id_user')) === String(userId)).map((r) => r.get('kelas'));
				allowedClasses = [...new Set(list)];
			} else {
				allowedClasses = [];
			}
		}

		const rows = await sheet.getRows();
		let siswaList = [];
		for (const row of rows) {
			const kls = row.get('kelas');
			if (allowedClasses === null || allowedClasses.includes(kls)) {
				siswaList.push({
					id: row.get('id'),
					nis: row.get('nis'),
					nama_lengkap: row.get('nama_lengkap'),
					kelas: kls,
					jenis_kelamin: row.get('jenis_kelamin'),
					status: row.get('status'),
				});
			}
		}

		if (kelas) siswaList = siswaList.filter((s) => s.kelas === kelas);
		if (status) siswaList = siswaList.filter((s) => s.status === status);

		return Response.json(siswaList);
	} catch (error) {
		console.error('GET Siswa Error:', error);
		return Response.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD POST (Tambah Data Baru - Manual & Bulk) ---
export async function POST(request) {
	if (request.headers.get('x-user-role') === 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const contentType = request.headers.get('content-type') || '';

		// === CASE 1: INPUT MANUAL (JSON) ===
		if (contentType.includes('application/json')) {
			const body = await request.json();
			const { nis, nama_lengkap, kelas, jenis_kelamin, status } = body;

			if (!nama_lengkap || !kelas) {
				return NextResponse.json({ error: 'Nama Lengkap dan Kelas wajib diisi' }, { status: 400 });
			}

			const doc = await getSheet();
			let sheet = doc.sheetsByTitle['MASTER_SISWA'];

			if (!sheet) {
				sheet = await doc.addSheet({
					title: 'MASTER_SISWA',
					headerValues: ['id', 'nis', 'nama_lengkap', 'kelas', 'jenis_kelamin', 'status'],
				});
			}

			const uniqueId = 'SIS-' + Date.now() + Math.floor(Math.random() * 100);
			await sheet.addRow({
				id: uniqueId,
				nis: nis || '',
				nama_lengkap,
				kelas,
				jenis_kelamin: jenis_kelamin || 'Laki-laki',
				status: status || 'Aktif',
			});

			return NextResponse.json({ success: true, message: 'Berhasil menambah siswa baru' });
		}

		// === CASE 2: BULK IMPORT (FormData) ===
		const formData = await request.formData();
		const file = formData.get('file');
		const kelasTarget = formData.get('kelas_target');

		if (!file) return NextResponse.json({ error: 'Tidak ada file' }, { status: 400 });
		if (!kelasTarget) return NextResponse.json({ error: 'Kelas target hilang' }, { status: 400 });

		const arrayBuffer = await file.arrayBuffer();
		const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

		if (jsonData.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });

		const studentsToInsert = jsonData
			.map((row) => ({
				id: 'SIS-' + Date.now() + Math.floor(Math.random() * 10000),
				nis: String(row['NIS'] || row['nis'] || ''),
				nama_lengkap: row['Nama Lengkap'] || row['nama_lengkap'] || '',
				kelas: kelasTarget,
				jenis_kelamin: row['Jenis Kelamin'] || row['jenis_kelamin'] || 'Laki-laki',
				status: 'Aktif',
			}))
			.filter((s) => s.nama_lengkap);

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (!sheet) {
			sheet = await doc.addSheet({ title: 'MASTER_SISWA', headerValues: ['id', 'nis', 'nama_lengkap', 'kelas', 'jenis_kelamin', 'status'] });
		}

		await sheet.addRows(studentsToInsert);

		return NextResponse.json({ success: true, message: 'Import berhasil', total: studentsToInsert.length });
	} catch (error) {
		console.error('POST Error:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// --- METHOD PUT (Update Data) ---
export async function PUT(req) {
	if (req.headers.get('x-user-role') === 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await req.json();
		const { id, nis, nama_lengkap, kelas, jenis_kelamin, status } = body;

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];
		const rows = await sheet.getRows();
		const row = rows.find((r) => String(r.get('id')) === String(id));

		if (!row) return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });

		if (nis) row.set('nis', nis);
		if (nama_lengkap) row.set('nama_lengkap', nama_lengkap);
		if (kelas) row.set('kelas', kelas);
		if (jenis_kelamin) row.set('jenis_kelamin', jenis_kelamin);
		if (status) row.set('status', status);

		await row.save();
		return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
	} catch (error) {
		console.error('PUT Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD DELETE (Hapus Data) ---
export async function DELETE(req) {
	if (req.headers.get('x-user-role') === 'Guru') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];
		const rows = await sheet.getRows();
		const row = rows.find((r) => String(r.get('id')) === String(id));

		if (!row) return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });

		await row.delete();
		return NextResponse.json({ success: true, message: 'Siswa berhasil dihapus' });
	} catch (error) {
		console.error('DELETE Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
