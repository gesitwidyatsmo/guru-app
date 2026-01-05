import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSheet } from '@/lib/sheets';

// --- METHOD GET (Ambil Data) ---
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const status = searchParams.get('status');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_SISWA'];

		if (!sheet) {
			return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();

		// Mapping data
		let siswaList = rows.map((row) => ({
			id: row.get('id'),
			nis: row.get('nis'),
			nama_lengkap: row.get('nama_lengkap'),
			kelas: row.get('kelas'),
			jenis_kelamin: row.get('jenis_kelamin'),
			status: row.get('status'),
		}));

		// Filtering
		if (kelas) siswaList = siswaList.filter((s) => s.kelas === kelas);
		if (status) siswaList = siswaList.filter((s) => s.status === status);

		return NextResponse.json(siswaList);
	} catch (error) {
		console.error('GET Siswa Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD POST (Tambah Data: Manual & Bulk Import) ---
export async function POST(request) {
	try {
		const contentType = request.headers.get('content-type') || '';

		// ============================================================
		// CASE 1: INPUT MANUAL (JSON)
		// ============================================================
		if (contentType.includes('application/json')) {
			const body = await request.json();
			const { nis, nama_lengkap, kelas, jenis_kelamin, status } = body;

			// Validasi
			if (!nama_lengkap || !kelas) {
				return NextResponse.json({ error: 'Nama Lengkap dan Kelas wajib diisi' }, { status: 400 });
			}

			const doc = await getSheet();
			let sheet = doc.sheetsByTitle['MASTER_SISWA'];

			// Buat sheet jika belum ada
			if (!sheet) {
				sheet = await doc.addSheet({
					title: 'MASTER_SISWA',
					headerValues: ['id', 'nis', 'nama_lengkap', 'kelas', 'jenis_kelamin', 'status'],
				});
			}

			// Simpan Data Manual
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

		// ============================================================
		// CASE 2: BULK IMPORT (FormData / File Excel)
		// ============================================================
		const formData = await request.formData();
		const file = formData.get('file');
		const kelasTarget = formData.get('kelas_target');

		if (!file) {
			return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
		}
		if (!kelasTarget) {
			return NextResponse.json({ error: 'Data kelas tujuan hilang' }, { status: 400 });
		}

		// Baca File Excel
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const workbook = XLSX.read(buffer, { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];

		// --- PARSING EXCEL DENGAN RANGE ---
		// range: 3 artinya skip 3 baris pertama (0,1,2).
		// Data Header dianggap mulai dari Baris 4 (Index 3).
		const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 3 });

		if (jsonData.length === 0) {
			return NextResponse.json({ error: 'File Excel kosong atau format salah' }, { status: 400 });
		}

		// Mapping Data
		const studentsToInsert = jsonData.map((row) => {
			const uniqueId = 'SIS-' + Date.now() + Math.floor(Math.random() * 10000);
			return {
				id: uniqueId,
				nis: String(row['NIS'] || row['nis'] || ''),
				nama_lengkap: row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || '',
				kelas: kelasTarget,
				jenis_kelamin: row['Jenis Kelamin'] || row['jenis_kelamin'] || 'Laki-laki',
				status: 'Aktif',
			};
		});

		// Validasi: Hanya ambil yang punya nama
		const validStudents = studentsToInsert.filter((s) => s.nama_lengkap);

		if (validStudents.length === 0) {
			return NextResponse.json({ error: 'Data tidak valid. Pastikan kolom "Nama Lengkap" terisi.' }, { status: 400 });
		}

		// Simpan ke Google Sheet
		const doc = await getSheet();
		let sheet = doc.sheetsByTitle['MASTER_SISWA'];

		if (!sheet) {
			sheet = await doc.addSheet({
				title: 'MASTER_SISWA',
				headerValues: ['id', 'nis', 'nama_lengkap', 'kelas', 'jenis_kelamin', 'status'],
			});
		}

		await sheet.addRows(validStudents);

		return NextResponse.json({
			success: true,
			message: 'Berhasil import data',
			total_uploaded: validStudents.length,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// --- METHOD PUT (Update Data) ---
export async function PUT(req) {
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

		return NextResponse.json({
			success: true,
			message: 'Data siswa berhasil diperbarui',
		});
	} catch (error) {
		console.error('PUT Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// --- METHOD DELETE (Hapus Data) ---
export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID siswa diperlukan' }, { status: 400 });

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
