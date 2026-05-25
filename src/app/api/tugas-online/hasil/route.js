import { NextResponse } from 'next/server';
import { getSheet, getOrCreateSheet } from '@/lib/sheets';

const SUBMIT_HEADERS = ['Waktu', 'PIN', 'Nama_Siswa', 'No_Absen', 'Jawaban_Teks', 'Link_File'];

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const pin = searchParams.get('pin');

		if (!pin) {
			return NextResponse.json({ error: 'PIN tidak diberikan' }, { status: 400 });
		}

		const doc = await getSheet();
		const SUBMIT_HEADERS = ['Waktu', 'PIN', 'Kelas', 'Nama_Siswa', 'No_Absen', 'Jawaban_Teks', 'Link_File', 'Nilai'];
		const sheet = await getOrCreateSheet(doc, 'Pengumpulan_Tugas', SUBMIT_HEADERS);
		const rows = await sheet.getRows();

		// Filter baris yang PIN-nya sama dengan request
		const submissions = rows
			.filter((row) => row.get('PIN') === pin.toUpperCase())
			.map((row) => ({
				waktu: row.get('Waktu'),
				kelas: row.get('Kelas') || '-',
				nama: row.get('Nama_Siswa'),
				absen: row.get('No_Absen'),
				teks: row.get('Jawaban_Teks'),
				file: row.get('Link_File'),
				nilai: row.get('Nilai') || '',
			}));

		// Urutkan berdasarkan absen (bisa juga berdasarkan waktu)
		submissions.sort((a, b) => parseInt(a.absen) - parseInt(b.absen));

		return NextResponse.json(submissions);
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal mengambil data hasil pengumpulan' }, { status: 500 });
	}
}
