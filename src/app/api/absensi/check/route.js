import { getSheet } from '@/lib/sheets';

function normalizeDate(value) {
	if (!value) return '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
		return String(value);
	}
	const d = new Date(value);
	if (isNaN(d.getTime())) return String(value);
	return d.toISOString().slice(0, 10);
}

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);

		// ✅ Ambil nama kelas (bukan ID)
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');

		console.log('=== DEBUG ABSENSI CHECK ===');
		console.log('Query kelas:', kelas);
		console.log('Query tanggal:', tanggal);

		if (!kelas || !tanggal) {
			return Response.json({ error: 'kelas dan tanggal wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_ABSENSI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_ABSENSI tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		const queryTanggal = normalizeDate(tanggal);

		console.log('Query tanggal (normalized):', queryTanggal);
		console.log('Total rows:', rows.length);

		// ✅ Debug: Cek property yang tersedia
		if (rows.length > 0) {
			console.log('Available properties:', Object.keys(rows[0].toObject()));
			console.log('First row sample:', rows[0].toObject());
		}

		// ✅ Bandingkan nama kelas dengan nama kelas
		const exists = rows.some((row) => {
			// Gunakan row.get() ATAU row.property, tergantung library
			const rowKelas = String(row.get('kelas') || row.kelas || '').trim();
			const rowTanggal = normalizeDate(row.get('tanggal') || row.tanggal);
			const queryKelas = String(kelas).trim();

			const kelasMatch = rowKelas === queryKelas;
			const tanggalMatch = rowTanggal === queryTanggal;

			if (kelasMatch && tanggalMatch) {
				console.log('✅ MATCH FOUND:', {
					rowKelas,
					queryKelas,
					rowTanggal,
					queryTanggal,
				});
			}

			return kelasMatch && tanggalMatch;
		});

		console.log('Hasil exists:', exists);

		return Response.json({ exists }, { status: 200 });
	} catch (error) {
		console.error('❌ Error cek absensi:', error);
		return Response.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 });
	}
}
