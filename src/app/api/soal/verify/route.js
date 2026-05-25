import { NextResponse } from 'next/server';
import { getSheet, getOrCreateSheet } from '@/lib/sheets';

const TUGAS_HEADERS = ['ID', 'PIN', 'Judul', 'Mapel', 'Materi', 'Tipe_Soal', 'Soal', 'CreatedAt', 'CreatedBy'];

export async function POST(request) {
	try {
		const { pin } = await request.json();

		if (!pin) {
			return NextResponse.json({ error: 'PIN diperlukan' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = await getOrCreateSheet(doc, 'Data_Tugas', TUGAS_HEADERS);
		const rows = await sheet.getRows();

		const task = rows.find((row) => row.get('PIN') === pin.toUpperCase());

		if (!task) {
			return NextResponse.json({ error: 'PIN tidak valid atau tugas tidak ditemukan' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			tugas: {
				judul: task.get('Judul'),
				mapel: task.get('Mapel'),
				materi: task.get('Materi'),
				tipe_soal: task.get('Tipe_Soal'),
				soal: JSON.parse(task.get('Soal')), // Parse back to array/object if it's multiple cases
			},
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}
