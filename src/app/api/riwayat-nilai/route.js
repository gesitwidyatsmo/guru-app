import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const siswa_id = searchParams.get('siswa_id');

		if (!siswa_id) {
			return NextResponse.json({ error: 'siswa_id wajib' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];
		if (!sheet) return NextResponse.json([], { status: 404 });

		const rows = await sheet.getRows();

		// Filter berdasarkan siswa_id
		const nilaiSiswa = rows
			.filter((r) => String(r.get('siswa_id')) === String(siswa_id))
			.map((r) => ({
				id: r.get('id'),
				tugas_id: r.get('tugas_id'),
				tanggal: r.get('tanggal'),
				mapel: r.get('mapel'),
				kategori: r.get('kategori'), // misal: "UH 1", "Tugas Harian"
				nilai: Number(r.get('nilai')) || 0,
				kelas: r.get('kelas'),
			}));

		// Sort: Terbaru ke terlama
		nilaiSiswa.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return NextResponse.json(nilaiSiswa);
	} catch (error) {
		console.error('GET Riwayat Nilai Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
