import { getSheet } from '@/lib/sheets';

// Fungsi generate ID random
function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

export async function POST(req) {
	try {
		const body = await req.json();
		const { judul, type, deskripsi, mapel, kelas, tanggal, nilai } = body;

		if (!judul || !mapel || !kelas || !tanggal) {
			return Response.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			sheet = await doc.addSheet({
				title: 'MASTER_NILAI',
				headerValues: ['id', 'tugas_id', 'guru_id', 'kategori', 'type', 'deskripsi', 'kelas', 'mapel', 'tanggal', 'data_nilai'],
			});
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Guru' && userId) {
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				const isAllowed = kbmRows.some((r) => String(r.get('id_user')) === String(userId) && r.get('kelas') === kelas && r.get('mapel') === mapel);
				if (!isAllowed) return Response.json({ error: 'Akses Ditolak: Anda di luar yurisdiksi kelas ini.' }, { status: 403 });
			}
		}

		const tugasId = generateId();
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		const siswaRows = await siswaSheet.getRows();

		const data_nilai = [];

		for (const item of nilai) {
			if (item.nilai && parseInt(item.nilai) > 0) {
				const siswa = siswaRows.find((row) => String(row.get('id')) === String(item.siswa_id));
				if (siswa) {
					data_nilai.push({
						siswa_id: item.siswa_id,
						nama_siswa: siswa.get('nama_lengkap'),
						nilai: item.nilai,
					});
				}
			}
		}

		if (data_nilai.length > 0) {
			await sheet.addRow({
				id: generateId(),
				tugas_id: tugasId,
				guru_id: userId || '',
				kategori: judul,
				type: type || '',
				deskripsi: deskripsi || '',
				kelas: kelas,
				mapel: mapel,
				tanggal: tanggal,
				data_nilai: JSON.stringify(data_nilai),
			});
		}

		return Response.json(
			{
				success: true,
				message: 'Tugas berhasil disimpan',
				count: data_nilai.length,
				tugasId: tugasId,
			},
			{ status: 201 },
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

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		let allowedKBM = null;
		if (role === 'Guru' && userId) {
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				allowedKBM = kbmRows.filter((r) => String(r.get('id_user')) === String(userId)).map((r) => ({ kelas: r.get('kelas'), mapel: r.get('mapel') }));
			} else {
				allowedKBM = [];
			}
		}

		const rows = await sheet.getRows();
		let tugas = [];

		rows.forEach((row) => {
			let data_nilai = [];
			try {
				data_nilai = JSON.parse(row.get('data_nilai') || '[]');
			} catch (e) {
				data_nilai = [];
			}

			if (data_nilai.length === 0 && row.get('siswa_id')) {
				data_nilai.push({
					siswa_id: row.get('siswa_id'),
					nama_siswa: row.get('nama_siswa'),
					nilai: row.get('nilai'),
				});
			}

			// Filter guru_id spesifik (hanya melihat yang diciptakannya)
			if (role === 'Guru' && String(row.get('guru_id')) && String(row.get('guru_id')) !== String(userId)) {
				return; // bukan miliknya
			}

			data_nilai.forEach((item) => {
				const rowKelas = row.get('kelas');
				const rowMapel = row.get('mapel');

				if (allowedKBM !== null) {
					const isAllowed = allowedKBM.some((kbm) => kbm.kelas === rowKelas && kbm.mapel === rowMapel);
					if (!isAllowed) return;
				}

				tugas.push({
					id: row.get('id') + '_' + item.siswa_id,
					guru_id: row.get('guru_id') || '',
					siswa_id: item.siswa_id,
					nama_siswa: item.nama_siswa,
					kelas: row.get('kelas'),
					mapel: row.get('mapel'),
					kategori: row.get('kategori'),
					type: row.get('type') || '',
					deskripsi: row.get('deskripsi') || '',
					nilai: item.nilai,
					tanggal: row.get('tanggal'),
					tugas_id: row.get('tugas_id'),
				});
			});
		});

		if (tugasId) tugas = tugas.filter((t) => String(t.tugas_id) === String(tugasId));
		if (kelas) tugas = tugas.filter((t) => t.kelas === kelas);
		if (mapel) tugas = tugas.filter((t) => t.mapel === mapel);

		return Response.json(tugas, { status: 200 });
	} catch (error) {
		console.error('❌ Error fetching tugas:', error);
		return Response.json({ error: 'Gagal mengambil data tugas', details: error.message }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const { tugasId, judul, type, deskripsi, kelas, mapel, tanggal, nilai } = body;

		if (!tugasId || !judul || !kelas || !mapel || !tanggal) {
			return Response.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];

		if (!sheet) {
			return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const rows = await sheet.getRows();
		const matchingRows = rows.filter((r) => String(r.get('tugas_id')) === String(tugasId));

		if (matchingRows.length === 0) {
			return Response.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
		}

		if (role === 'Guru' && userId) {
			// Proteksi 1: KBM Jurisdiction
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				const isAllowed = kbmRows.some((r) => String(r.get('id_user')) === String(userId) && r.get('kelas') === kelas && r.get('mapel') === mapel);
				if (!isAllowed) return Response.json({ error: 'Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.' }, { status: 403 });
			}

			// Proteksi 2: Pemilik Penilaian Poin (guru_id)
			const guruIdPembuat = matchingRows[0].get('guru_id');
			if (guruIdPembuat && String(guruIdPembuat) !== String(userId)) {
				return Response.json({ error: 'Akses Ditolak: Anda mencoba menyunting Tugas/Penilaian buatan kolega.' }, { status: 403 });
			}
		}

		let existingDataNilai = [];
		let existingKategori = matchingRows[0].get('kategori');
		let existingTanggal = matchingRows[0].get('tanggal');
		let existingType = matchingRows[0].get('type') || '';
		let existingDeskripsi = matchingRows[0].get('deskripsi') || '';

		for (const row of matchingRows) {
			let dnStr = row.get('data_nilai');
			if (dnStr) {
				try {
					const dnArr = JSON.parse(dnStr);
					existingDataNilai.push(...dnArr);
				} catch (e) {}
			} else if (row.get('siswa_id')) {
				existingDataNilai.push({
					siswa_id: row.get('siswa_id'),
					nama_siswa: row.get('nama_siswa'),
					nilai: row.get('nilai'),
				});
			}
		}

		const uniqueDataNilaiMap = new Map();
		existingDataNilai.forEach((item) => {
			uniqueDataNilaiMap.set(String(item.siswa_id), item);
		});

		if (nilai && Array.isArray(nilai)) {
			const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
			const siswaRows = await siswaSheet.getRows();

			for (const item of nilai) {
				if (item.nilai && String(item.nilai).trim() !== '') {
					if (uniqueDataNilaiMap.has(String(item.siswa_id))) {
						uniqueDataNilaiMap.get(String(item.siswa_id)).nilai = item.nilai;
					} else {
						const siswa = siswaRows.find((r) => String(r.get('id')) === String(item.siswa_id));
						if (siswa) {
							uniqueDataNilaiMap.set(String(item.siswa_id), {
								siswa_id: item.siswa_id,
								nama_siswa: siswa.get('nama_lengkap'),
								nilai: item.nilai,
							});
						}
					}
				} else {
					uniqueDataNilaiMap.delete(String(item.siswa_id));
				}
			}
		}

		const finalDataNilai = Array.from(uniqueDataNilaiMap.values());

		const mainRow = matchingRows[0];
		mainRow.set('kategori', judul || existingKategori);
		mainRow.set('tanggal', tanggal || existingTanggal);
		if (type !== undefined) mainRow.set('type', type);
		if (deskripsi !== undefined) mainRow.set('deskripsi', deskripsi);
		mainRow.set('data_nilai', JSON.stringify(finalDataNilai));

		mainRow.set('siswa_id', '');
		mainRow.set('nama_siswa', '');
		mainRow.set('nilai', '');

		// Update kepemilikan guru_id jika masih meminjam data legacy
		if (!mainRow.get('guru_id') && userId) {
			mainRow.set('guru_id', userId);
		}

		await mainRow.save();

		if (matchingRows.length > 1) {
			for (let i = 1; i < matchingRows.length; i++) {
				await matchingRows[i].delete();
			}
		}

		return Response.json(
			{
				success: true,
				message: 'Nilai berhasil diperbarui',
				konsolidasi: matchingRows.length > 1,
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

		if (!tugasId) return Response.json({ error: 'tugasId tidak ditemukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle['MASTER_NILAI'];
		if (!sheet) return Response.json({ error: 'Sheet MASTER_NILAI tidak ditemukan' }, { status: 404 });

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const rows = await sheet.getRows();
		let deleteCount = 0;

		let allowedKBM = null;
		if (role === 'Guru' && userId) {
			const kbmSheet = doc.sheetsByTitle['GURU_KBM'];
			if (kbmSheet) {
				const kbmRows = await kbmSheet.getRows();
				allowedKBM = kbmRows.filter((r) => String(r.get('id_user')) === String(userId)).map((r) => ({ kelas: r.get('kelas'), mapel: r.get('mapel') }));
			} else {
				allowedKBM = [];
			}
		}

		for (const row of rows) {
			if (String(row.get('tugas_id')) === String(tugasId)) {
				const rowKelas = row.get('kelas');
				const rowMapel = row.get('mapel');

				if (allowedKBM !== null) {
					// Pengecekan KBM
					const isAllowed = allowedKBM.some((kbm) => kbm.kelas === rowKelas && kbm.mapel === rowMapel);
					if (!isAllowed) return Response.json({ error: 'Akses Ditolak: Anda tidak berhak menghapus tugas dari kelas eksternal.' }, { status: 403 });

					// Pengecekan Kepemilikan (guru_id)
					const guruIdPembuat = row.get('guru_id');
					if (guruIdPembuat && String(guruIdPembuat) !== String(userId)) {
						return Response.json({ error: 'Akses Ditolak: Dilarang menghapus riwayat penilaian kepunyaan rekan Guru Anda.' }, { status: 403 });
					}
				}

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
