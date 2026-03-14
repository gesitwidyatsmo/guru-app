import { getSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';

const SHEET_NAME = 'MASTER_POIN';

function generateId() {
	return 'POIN-' + Date.now() + Math.floor(Math.random() * 1000);
}

// =====================
// GET - Ambil Data Poin
// =====================
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const siswa_id = searchParams.get('siswa_id');
		const tipe = searchParams.get('tipe');

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];

		if (!sheet) {
			return NextResponse.json([]);
		}

		const rows = await sheet.getRows();

		let data = rows.map((row) => ({
			id: row.get('id'),
			siswa_id: row.get('siswa_id'),
			guru_id: row.get('guru_id') || '',
			tanggal: row.get('tanggal'),
			tipe: row.get('tipe'),
			kategori: row.get('kategori'),
			aktifitas: row.get('aktifitas'),
			poin: parseInt(row.get('poin') || '0', 10),
			keterangan: row.get('keterangan'),
		}));

		if (siswa_id) data = data.filter((d) => d.siswa_id === siswa_id);
		if (tipe) data = data.filter((d) => d.tipe === tipe);

		let allowedClasses = null;
		if (role === 'Guru' && userName) {
			const kelasSheet = doc.sheetsByTitle['MASTER_KELAS'];
			if (kelasSheet) {
				const kbmRows = await kelasSheet.getRows();
				const list = kbmRows.filter((r) => r.get('wali_kelas') === userName).map((r) => r.get('nama_kelas'));
				allowedClasses = [...new Set(list)];
			} else {
				allowedClasses = [];
			}
		} else if (role !== 'Admin') {
			allowedClasses = [];
		}

		// Filter Hak Akses Guru: Bisa lihat jika dia Wali Kelas, ATAU jika dia Pencatat Poin tersebut
		const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
		if (siswaSheet) {
			const siswaRows = await siswaSheet.getRows();
			const siswaMap = new Map(siswaRows.map((r) => [r.get('id'), r.get('kelas')]));

			data = data.filter((d) => {
				const sKelas = siswaMap.get(d.siswa_id);
				if (kelas && sKelas !== kelas) return false;

				if (role === 'Guru') {
					const isWaliKelas = allowedClasses !== null && allowedClasses.includes(sKelas);
					const isPembuat = String(d.guru_id) === String(userId);
					if (!isWaliKelas && !isPembuat) return false;
				}
				return true;
			});
		}

		data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return NextResponse.json(data);
	} catch (error) {
		console.error('❌ Error GET poin:', error);
		return NextResponse.json({ error: 'Gagal mengambil data poin' }, { status: 500 });
	}
}

// =====================
// POST - Tambah Poin Baru
// =====================
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		const body = await req.json();
		const { siswa_id, tanggal, tipe, kategori, aktifitas, poin, keterangan } = body;

		if (!siswa_id || !tanggal || !tipe || !aktifitas || poin === undefined) {
			return NextResponse.json({ error: 'Field wajib: siswa_id, tanggal, tipe, aktifitas, poin' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_NAME];

		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_NAME,
				headerValues: ['id', 'siswa_id', 'guru_id', 'tanggal', 'tipe', 'kategori', 'aktifitas', 'poin', 'keterangan'],
			});
		}

		const id = generateId();

		await sheet.addRow({
			id,
			siswa_id,
			guru_id: userId || '',
			tanggal,
			tipe,
			kategori: kategori || '',
			aktifitas,
			poin: String(poin),
			keterangan: keterangan || '',
		});

		return NextResponse.json({ success: true, id }, { status: 201 });
	} catch (error) {
		console.error('❌ Error POST poin:', error);
		return NextResponse.json({ error: 'Gagal menyimpan poin' }, { status: 500 });
	}
}

// =====================
// PUT - Update Poin
// =====================
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const body = await req.json();
		const { id, ...updates } = body;

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (!row) return NextResponse.json({ error: 'Data poin tidak ditemukan' }, { status: 404 });

		if (role === 'Guru') {
			const guruIdPembuat = row.get('guru_id');
			const isPembuat = String(guruIdPembuat) === String(userId);

			const siswa_id_target = row.get('siswa_id');
			const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
			let isWaliKelas = false;

			if (siswaSheet) {
				const siswaRows = await siswaSheet.getRows();
				const targetSiswa = siswaRows.find((r) => r.get('id') === siswa_id_target);
				if (targetSiswa) {
					const targetKelas = targetSiswa.get('kelas');
					const kelasSheet = doc.sheetsByTitle['MASTER_KELAS'];
					const kRows = await kelasSheet.getRows();
					const klsData = kRows.find((r) => r.get('nama_kelas') === targetKelas);
					if (klsData && klsData.get('wali_kelas') === userName) {
						isWaliKelas = true;
					}
				}
			}

			if (!isPembuat && !isWaliKelas) {
				return NextResponse.json({ error: 'Akses Ditolak: Poin ini tidak dibuat oleh Anda dan bukan yurisdiksi kelas Anda.' }, { status: 403 });
			}
		}

		const allowedFields = ['siswa_id', 'tanggal', 'tipe', 'kategori', 'aktifitas', 'poin', 'keterangan'];
		allowedFields.forEach((field) => {
			if (updates[field] !== undefined) {
				row.set(field, String(updates[field]));
			}
		});

		await row.save();
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('❌ Error PUT poin:', error);
		return NextResponse.json({ error: 'Gagal update poin' }, { status: 500 });
	}
}

// =====================
// DELETE - Hapus Poin
// =====================
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();
		const row = rows.find((r) => r.get('id') === id);

		if (!row) return NextResponse.json({ error: 'Data poin tidak ditemukan' }, { status: 404 });

		if (role === 'Guru') {
			const guruIdPembuat = row.get('guru_id');
			const isPembuat = String(guruIdPembuat) === String(userId);

			const siswa_id_target = row.get('siswa_id');
			const siswaSheet = doc.sheetsByTitle['MASTER_SISWA'];
			let isWaliKelas = false;

			if (siswaSheet) {
				const siswaRows = await siswaSheet.getRows();
				const targetSiswa = siswaRows.find((r) => r.get('id') === siswa_id_target);
				if (targetSiswa) {
					const targetKelas = targetSiswa.get('kelas');
					const kelasSheet = doc.sheetsByTitle['MASTER_KELAS'];
					const kRows = await kelasSheet.getRows();
					const klsData = kRows.find((r) => r.get('nama_kelas') === targetKelas);
					if (klsData && klsData.get('wali_kelas') === userName) {
						isWaliKelas = true;
					}
				}
			}

			if (!isPembuat && !isWaliKelas) {
				return NextResponse.json({ error: 'Akses Ditolak: Penghapusan poin bukan wewenang Anda.' }, { status: 403 });
			}
		}

		await row.delete();
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('❌ Error DELETE poin:', error);
		return NextResponse.json({ error: 'Gagal hapus poin' }, { status: 500 });
	}
}
