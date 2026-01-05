import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_ABSENSI_MAPEL';

const norm = (v) => String(v ?? '').trim();
const normDate = (v) => String(v ?? '').slice(0, 10);
const generateId = () => Math.random().toString(36).slice(2, 11);

// GET:
// - /api/absensi-mapel?kelas=...&mapel=...&bulan=12&tahun=2025     -> list pertemuan (untuk laporan)
// - /api/absensi-mapel?kelas=...&mapel=...&tanggal=YYYY-MM-DD&jam_ke=1-2 -> detail pertemuan (untuk halaman input)
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const jam_ke = searchParams.get('jam_ke');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');

		if (!kelas || !mapel) {
			return NextResponse.json({ error: 'Parameter kelas & mapel wajib' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();

		// filter dasar
		let filtered = rows.filter((r) => {
			return norm(r.get('kelas')) === norm(kelas) && norm(r.get('mapel')) === norm(mapel);
		});

		// filter bulan/tahun untuk laporan (opsional)
		if (bulan && tahun) {
			filtered = filtered.filter((r) => {
				const d = new Date(normDate(r.get('tanggal')));
				return d.getMonth() + 1 === Number(bulan) && d.getFullYear() === Number(tahun);
			});
		}

		// mode detail pertemuan (untuk halaman input)
		if (tanggal && jam_ke) {
			const row = filtered.find((r) => normDate(r.get('tanggal')) === normDate(tanggal) && norm(r.get('jam_ke')) === norm(jam_ke));
			if (!row) return NextResponse.json([]); // belum ada pertemuan

			let parsed = [];
			try {
				parsed = JSON.parse(row.get('data_absensi') || '[]'); // format: [{siswa_id, status}, ...]
			} catch {
				parsed = [];
			}

			// agar frontend bisa tahu id pertemuan untuk update
			const id_row = row.get('id');
			const data = Array.isArray(parsed) ? parsed.map((x) => ({ ...x, id_row })) : [];

			return NextResponse.json(data);
		}

		// mode list pertemuan (untuk laporan)
		const pertemuan = filtered.map((r) => ({
			id: r.get('id'),
			tanggal: normDate(r.get('tanggal')),
			jam_ke: r.get('jam_ke'),
			kelas: r.get('kelas'),
			mapel: r.get('mapel'),
			data_absensi: r.get('data_absensi') || '[]', // biarkan string; laporan Anda parse sendiri
		}));

		// urutkan tanggal
		pertemuan.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		return NextResponse.json(pertemuan);
	} catch (error) {
		console.error('GET /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// POST upsert: kalau pertemuan sudah ada -> update, kalau belum -> addRow
export async function POST(req) {
	try {
		const body = await req.json();
		const { tanggal, jam_ke, kelas, mapel, data } = body;

		if (!tanggal || !jam_ke || !kelas || !mapel) {
			return NextResponse.json({ error: 'tanggal, jam_ke, kelas, mapel wajib' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();

		const existing = rows.find((r) => {
			return norm(r.get('kelas')) === norm(kelas) && norm(r.get('mapel')) === norm(mapel) && normDate(r.get('tanggal')) === normDate(tanggal) && norm(r.get('jam_ke')) === norm(jam_ke);
		});

		const jsonString = JSON.stringify(Array.isArray(data) ? data : []);

		if (existing) {
			existing.set('data_absensi', jsonString);
			await existing.save();
			return NextResponse.json({ success: true, id: existing.get('id'), mode: 'update' });
		}

		const newId = generateId();
		await sheet.addRow({
			id: newId,
			tanggal: normDate(tanggal),
			jam_ke: norm(jam_ke),
			kelas: norm(kelas),
			mapel: norm(mapel),
			data_absensi: jsonString,
		});

		return NextResponse.json({ success: true, id: newId, mode: 'insert' });
	} catch (error) {
		console.error('POST /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
