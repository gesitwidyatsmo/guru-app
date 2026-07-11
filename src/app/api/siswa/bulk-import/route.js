import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as XLSX from 'xlsx';

// --- METHOD POST (Tambah Data Bulk) ---
export async function POST(request) {
	try {
		const supabase = await createClient();

		const formData = await request.formData();
		const file = formData.get('file');
		const kelasTarget = formData.get('kelas_target');

		if (!file) return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
		if (!kelasTarget) return NextResponse.json({ error: 'Data kelas tujuan hilang' }, { status: 400 });

		const arrayBuffer = await file.arrayBuffer();
		const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
		const sheetName = workbook.SheetNames[0];
		
		let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 3 });
		if (jsonData.length === 0) {
			jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
		}

		if (jsonData.length === 0) return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });

		const studentsToInsert = jsonData
			.map((row) => ({
				id: 'SIS-' + Date.now() + Math.floor(Math.random() * 10000) + Math.random().toString(36).substring(7),
				nis: String(row['NIS'] || row['nis'] || ''),
				nama_lengkap: row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || '',
				kelas: kelasTarget,
				jenis_kelamin: row['Jenis Kelamin'] || row['jenis_kelamin'] || 'Laki-laki',
				status: 'Aktif',
			}))
			.filter((s) => s.nama_lengkap);

		if (studentsToInsert.length === 0) {
			return NextResponse.json({ error: 'Data tidak valid. Pastikan kolom "Nama Lengkap" terisi.' }, { status: 400 });
		}

		const { error } = await supabase.from('siswa').insert(studentsToInsert);
		if (error) throw error;

		return NextResponse.json({
			success: true,
			message: 'Berhasil import data',
			total_uploaded: studentsToInsert.length,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
