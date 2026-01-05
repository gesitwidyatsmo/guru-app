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
		const sheet = doc.sheetsByTitle['MASTER_ABSENSI'];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();

		// Filter rows milik siswa ini
		const result = rows
			.filter((r) => String(r.get('siswa_id')) === String(siswa_id))
			.map((r) => ({
				id: r.get('id'),
				tanggal: String(r.get('tanggal')).slice(0, 10),
				status: r.get('status'),
				// Jika kolom mapel kosong di sheet ini, anggap ini absensi 'Harian'
				// Jika ada isinya, sertakan saja
				keterangan: r.get('mapel') || 'Harian',
			}));

		// Sort terbaru -> terlama
		result.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return NextResponse.json(result);
	} catch (error) {
		console.error('GET Absensi Kelas Error:', error);
		return NextResponse.json([], { status: 500 });
	}
}
