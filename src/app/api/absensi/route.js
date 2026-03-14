import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_ABSENSI_HARIAN';

const generateId = () => Math.random().toString(36).slice(2, 11);
const norm = (v) => String(v ?? '').trim();
const normDate = (v) => String(v ?? '').slice(0, 10);

// GET: Ambil data absensi berdasarkan kelas (dan optional tanggal/bulan/tahun)
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');

		if (!kelas) {
			return NextResponse.json({ error: 'Parameter kelas wajib diisi' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) {
			return NextResponse.json({ error: `Sheet ${SHEET_NAME} tidak ditemukan` }, { status: 404 });
		}

		const role = req.headers.get('x-user-role');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

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

		// Validasi otorisasi Guru atas request parameter kelas
		if (allowedClasses !== null && !allowedClasses.includes(kelas)) {
			// Cegah pengintipan kelas lain
			return NextResponse.json([]);
		}

		const rows = await sheet.getRows();

		// filter dasar kelas
		let filtered = rows.filter((r) => norm(r.get('kelas')) === norm(kelas));

		// mode detail pertemuan (untuk halaman form edit riwayat)
		if (tanggal) {
			const row = filtered.find((r) => normDate(r.get('tanggal')) === normDate(tanggal));
			if (!row) return NextResponse.json([]); // belum ada pertemuan

			let parsed = [];
			try {
				parsed = JSON.parse(row.get('data_absensi') || '[]'); // format: [{siswa_id, status, keterangan}, ...]
			} catch {
				parsed = [];
			}

			const data = Array.isArray(parsed) ? parsed : [];
			return NextResponse.json(data);
		}

		// filter bulan/tahun (untuk laporan)
		if (bulan && tahun) {
			filtered = filtered.filter((r) => {
				const d = new Date(normDate(r.get('tanggal')));
				return d.getMonth() + 1 === Number(bulan) && d.getFullYear() === Number(tahun);
			});
		}

		// mode list pertemuan (untuk laporan & daftar sesi di riwayat)
		const pertemuan = filtered.map((r) => ({
			id: r.get('id'),
			tanggal: normDate(r.get('tanggal')),
			kelas: r.get('kelas'),
			data_absensi: r.get('data_absensi') || '[]',
		}));

		// urutkan tanggal ascending
		pertemuan.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		return NextResponse.json(pertemuan);
	} catch (error) {
		console.error('Error GET absensi harian:', error);
		return NextResponse.json({ error: error?.message || 'Terjadi kesalahan' }, { status: 500 });
	}
}

// POST: Upsert (tambah/update) absensi 1 pertemuan penuh (menggantikan PUT bulk update)
export async function POST(req) {
	try {
		const body = await req.json();
		// API ini bisa menerima { oldTanggal, newTanggal, kelas, absensiList } dari halaman manage (riwayat)
		// atau menerima format umum { tanggal, kelas, data } dari entri baru
		const oldTanggal = body.oldTanggal || body.tanggal;
		const newTanggal = body.newTanggal || body.tanggal;
		const kelas = body.kelas;
		const data_absensi = body.absensiList || body.data;

		if (!oldTanggal || !newTanggal || !kelas || !Array.isArray(data_absensi)) {
			return NextResponse.json({ error: 'Payload tidak lengkap' }, { status: 400 });
		}

		const role = req.headers.get('x-user-role');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const doc = await getSheet();

		if (role === 'Guru') {
			const kelasSheet = doc.sheetsByTitle['MASTER_KELAS'];
			if (kelasSheet) {
				const kRows = await kelasSheet.getRows();
				const targetKls = kRows.find((r) => r.get('nama_kelas') === kelas);
				if (!targetKls || targetKls.get('wali_kelas') !== userName) {
					return NextResponse.json({ error: 'Akses Ditolak: Khusus Wali Kelas berwenang atas log absensi harian ini.' }, { status: 403 });
				}
			}
		}
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) {
			return NextResponse.json({ error: `Sheet ${SHEET_NAME} tidak ditemukan` }, { status: 404 });
		}

		const rows = await sheet.getRows();

		const existing = rows.find((r) => {
			return norm(r.get('kelas')) === norm(kelas) && normDate(r.get('tanggal')) === normDate(oldTanggal);
		});

		const jsonString = JSON.stringify(data_absensi);

		if (existing) {
			// Update existing row
			existing.set('data_absensi', jsonString);
			if (oldTanggal !== newTanggal) {
				existing.set('tanggal', normDate(newTanggal));
			}
			await existing.save();
			return NextResponse.json({ success: true, id: existing.get('id'), mode: 'update', message: 'Sesi absensi diperbarui' }, { status: 200 });
		} else {
			// Insert new row
			const newId = generateId();
			await sheet.addRow({
				id: newId,
				tanggal: normDate(newTanggal),
				kelas: norm(kelas),
				data_absensi: jsonString,
			});
			return NextResponse.json({ success: true, id: newId, mode: 'insert', message: 'Sesi absensi dibuat' }, { status: 201 });
		}
	} catch (error) {
		console.error('Error POST absensi harian:', error);
		return NextResponse.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 });
	}
}

// PUT: Endpoint lama, di-redirect untuk compatibility dengan POST
export async function PUT(req) {
	return POST(req);
}

// DELETE: Hapus sesi absensi 1 pertemuan berdasarkan kelas & tanggal
export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');

		if (!kelas || !tanggal) {
			return NextResponse.json({ error: 'parameter kelas dan tanggal diperlukan' }, { status: 400 });
		}

		const role = req.headers.get('x-user-role');
		const userName = decodeURIComponent(req.headers.get('x-user-name') || '');

		const doc = await getSheet();

		if (role === 'Guru') {
			const kelasSheet = doc.sheetsByTitle['MASTER_KELAS'];
			if (kelasSheet) {
				const kRows = await kelasSheet.getRows();
				const targetKls = kRows.find((r) => r.get('nama_kelas') === kelas);
				if (!targetKls || targetKls.get('wali_kelas') !== userName) {
					return NextResponse.json({ error: 'Akses Ditolak: Penghapusan catatan absensi harian hanya bisa dilakukan Wali Kelas yurisdiksi ini.' }, { status: 403 });
				}
			}
		}
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) {
			return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });
		}

		const rows = await sheet.getRows();

		let deletedCount = 0;
		for (let i = rows.length - 1; i >= 0; i--) {
			const row = rows[i];
			if (norm(row.get('kelas')) === norm(kelas) && normDate(row.get('tanggal')) === normDate(tanggal)) {
				await row.delete();
				deletedCount++;
			}
		}

		return NextResponse.json({ success: true, message: `${deletedCount} sesi absen telah dihapus` }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE absensi:', error);
		return NextResponse.json({ error: error?.message || 'Gagal menghapus absensi' }, { status: 500 });
	}
}
