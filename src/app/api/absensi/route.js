import { getSheet } from '@/lib/sheets';

// GET: Ambil data absensi berdasarkan kelas dan tanggal
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');

		if (!kelas || !tanggal) {
			return Response.json({ error: 'kelas dan tanggal wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_ABSENSI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();

		const absensiData = rows
			.filter((row) => {
				const rowKelas = String(row.get('kelas') || row.kelas || '').trim();
				const rowTanggal = String(row.get('tanggal') || row.tanggal || '').slice(0, 10);
				return rowKelas === kelas.trim() && rowTanggal === tanggal;
			})
			.map((row) => ({
				id: row.get('id') || row.id,
				tanggal: row.get('tanggal') || row.tanggal,
				kelas: row.get('kelas') || row.kelas,
				siswa_id: row.get('siswa_id') || row.siswa_id,
				status: row.get('status') || row.status,
				keterangan: row.get('keterangan') || row.keterangan || '',
			}));

		return Response.json(absensiData, { status: 200 });
	} catch (error) {
		console.error('Error GET absensi:', error);
		return Response.json({ error: error?.message || 'Terjadi kesalahan' }, { status: 500 });
	}
}

// POST: simpan banyak baris absensi sekaligus
export async function POST(req) {
	try {
		const body = await req.json(); // array payload

		if (!Array.isArray(body) || body.length === 0) {
			return Response.json({ error: 'Payload kosong' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_ABSENSI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_ABSENSI tidak ditemukan' }, { status: 404 });
		}

		// Simpan semua baris absensi (tanpa cek duplikasi)
		for (const item of body) {
			const newId = Math.random().toString(36).slice(2, 11);

			await sheet.addRow({
				id: newId,
				tanggal: item.tanggal,
				kelas_id: item.kelas_id,
				kelas: item.kelas,
				siswa_id: item.siswa_id,
				status: item.status,
				keterangan: item.keterangan || '',
			});
		}

		return Response.json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Error simpan absensi:', error);
		return Response.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 });
	}
}
