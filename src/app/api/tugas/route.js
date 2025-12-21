import { getSheet } from '@/lib/sheets';

// Fungsi generate ID random
function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

export async function POST(req) {
	try {
		const body = await req.json();
		const { judul, mapel, kelas, tanggal, nilai } = body;

		if (!judul || !mapel || !kelas || !tanggal) {
			return Response.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		const tugasId = generateId();
		const rows = [];
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		const siswaRows = await siswaSheet.getRows();

		for (const item of nilai) {
			if (item.nilai && parseInt(item.nilai) > 0) {
				const siswa = siswaRows.find((row) => String(row.get('id')) === String(item.siswa_id));

				if (siswa) {
					rows.push({
						id: generateId(),
						siswa_id: item.siswa_id,
						nama_siswa: siswa.get('nama_lengkap'),
						kelas: kelas,
						mapel: mapel,
						kategori: judul,
						nilai: item.nilai,
						tanggal: tanggal,
						tugas_id: tugasId,
					});
				}
			}
		}

		if (rows.length > 0) {
			await sheet.addRows(rows);
		}

		return Response.json(
			{
				success: true,
				message: 'Tugas berhasil disimpan',
				count: rows.length,
				tugasId: tugasId,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('❌ Error saving tugas:', error);
		return Response.json({ error: 'Gagal menyimpan tugas', details: error.message }, { status: 500 });
	}
}

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tugasId = searchParams.get('tugasId');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		let tugas = rows.map((row) => ({
			id: row.get('id'),
			siswa_id: row.get('siswa_id'),
			nama_siswa: row.get('nama_siswa'),
			kelas: row.get('kelas'),
			mapel: row.get('mapel'),
			kategori: row.get('kategori'),
			nilai: row.get('nilai'),
			tanggal: row.get('tanggal'),
			tugas_id: row.get('tugas_id'),
		}));

		if (tugasId) {
			tugas = tugas.filter((t) => String(t.tugas_id) === String(tugasId));
		}
		if (kelas) {
			tugas = tugas.filter((t) => t.kelas === kelas);
		}
		if (mapel) {
			tugas = tugas.filter((t) => t.mapel === mapel);
		}

		return Response.json(tugas, { status: 200 });
	} catch (error) {
		console.error('❌ Error fetching tugas:', error);
		return Response.json({ error: 'Gagal mengambil data tugas', details: error.message }, { status: 500 });
	}
}

// app/api/tugas/route.js

export async function PUT(req) {
	try {
		const body = await req.json();
		const { tugasId, judul, kelas, mapel, tanggal, nilai } = body;

		if (!tugasId || !judul || !kelas || !mapel || !tanggal) {
			return Response.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		// Ambil data siswa untuk validasi
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		const siswaRows = await siswaSheet.getRows();

		const rows = await sheet.getRows();
		let updateCount = 0;
		let insertCount = 0;

		// Prepare array untuk row baru (siswa yang belum ada di tugas ini)
		const newRows = [];

		for (const nilaiItem of nilai) {
			// Cari apakah siswa ini sudah ada di tugas ini
			const existingRow = rows.find((r) => String(r.get('tugas_id')) === String(tugasId) && String(r.get('siswa_id')) === String(nilaiItem.siswa_id));

			if (existingRow) {
				// UPDATE: Siswa sudah ada, update nilai
				existingRow.set('kategori', judul);
				existingRow.set('tanggal', tanggal);
				existingRow.set('nilai', nilaiItem.nilai);

				await existingRow.save();
				updateCount++;
			} else {
				// INSERT: Siswa baru, tambahkan ke array untuk di-insert
				const siswa = siswaRows.find((s) => String(s.get('id')) === String(nilaiItem.siswa_id));

				if (siswa && nilaiItem.nilai && parseInt(nilaiItem.nilai) > 0) {
					newRows.push({
						id: generateId(),
						siswa_id: nilaiItem.siswa_id,
						nama_siswa: siswa.get('nama_lengkap'),
						kelas: kelas,
						mapel: mapel,
						kategori: judul,
						nilai: nilaiItem.nilai,
						tanggal: tanggal,
						tugas_id: tugasId,
					});
					insertCount++;
				}
			}
		}

		// Insert siswa baru jika ada
		if (newRows.length > 0) {
			await sheet.addRows(newRows);
		}

		return Response.json(
			{
				success: true,
				message: 'Nilai berhasil diperbarui',
				updated: updateCount,
				inserted: insertCount,
				total: updateCount + insertCount,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('❌ Error updating tugas:', error);
		return Response.json({ error: 'Gagal memperbarui nilai', details: error.message }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const tugasId = searchParams.get('tugasId');

		if (!tugasId) {
			return Response.json({ error: 'tugasId tidak ditemukan' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();
		let deleteCount = 0;

		for (const row of rows) {
			if (String(row.get('tugas_id')) === String(tugasId)) {
				await row.delete();
				deleteCount++;
			}
		}

		return Response.json({ success: true, message: 'Tugas berhasil dihapus', count: deleteCount }, { status: 200 });
	} catch (error) {
		console.error('❌ Error deleting tugas:', error);
		return Response.json({ error: 'Gagal menghapus tugas', details: error.message }, { status: 500 });
	}
}
