import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_ABSENSI_MAPEL';

const norm = (v) => String(v ?? '').trim();
const normDate = (v) => String(v ?? '').slice(0, 10);
const generateId = () => Math.random().toString(36).slice(2, 11);

// GET:
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

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

		// filter dasar & isolasi guru
		let filtered = rows.filter((r) => {
			const isMatchKelasMapel = norm(r.get('kelas')) === norm(kelas) && norm(r.get('mapel')) === norm(mapel);
			// Isolasi Kepemilikan (Guru hanya melihat absensi miliknya)
			if (role === 'Guru' && userId) {
				return isMatchKelasMapel && String(r.get('guru_id')) === String(userId);
			}
			return isMatchKelasMapel;
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
				parsed = JSON.parse(row.get('data_absensi') || '[]');
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
			guru_id: r.get('guru_id') || '',
			tanggal: normDate(r.get('tanggal')),
			jam_ke: r.get('jam_ke'),
			kelas: r.get('kelas'),
			mapel: r.get('mapel'),
			data_absensi: r.get('data_absensi') || '[]',
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
		const userId = req.headers.get('x-user-id');
		const role = req.headers.get('x-user-role');

		const body = await req.json();
		const oldTanggal = body.oldTanggal || body.tanggal;
		const newTanggal = body.newTanggal || body.tanggal;
		const oldJamKe = body.oldJam_ke || body.jam_ke;
		const newJamKe = body.newJam_ke || body.jam_ke;
		const { kelas, mapel } = body;
		// Karena format di UI pakai absensiList
		const data = body.absensiList || body.data;

		if (!oldTanggal || !oldJamKe || !kelas || !mapel) {
			return NextResponse.json({ error: 'parameter wajib tidak lengkap' }, { status: 400 });
		}

		const doc = await getSheet();
		let sheet = doc.sheetsByTitle[SHEET_NAME];

		if (!sheet) {
			sheet = await doc.addSheet({
				title: SHEET_NAME,
				headerValues: ['id', 'guru_id', 'tanggal', 'jam_ke', 'kelas', 'mapel', 'data_absensi'],
			});
		}

		const rows = await sheet.getRows();

		const existing = rows.find((r) => {
			const isMatch = norm(r.get('kelas')) === norm(kelas) && norm(r.get('mapel')) === norm(mapel) && normDate(r.get('tanggal')) === normDate(oldTanggal) && norm(r.get('jam_ke')) === norm(oldJamKe);
			if (role === 'Guru' && userId) {
				return isMatch && String(r.get('guru_id')) === String(userId);
			}
			return isMatch;
		});

		const jsonString = JSON.stringify(Array.isArray(data) ? data : []);

		if (existing) {
			// Proteksi tambahan (kalau-kalau Admin edit milik guru lain, tapi disini dibebaskan)
			existing.set('data_absensi', jsonString);
			if (oldTanggal !== newTanggal) existing.set('tanggal', normDate(newTanggal));
			if (oldJamKe !== newJamKe) existing.set('jam_ke', norm(newJamKe));

			// Jika belum punya guru_id (data legacy), assign ke user saat ini
			if (!existing.get('guru_id') && userId) existing.set('guru_id', userId);

			await existing.save();
			return NextResponse.json({ success: true, id: existing.get('id'), mode: 'update' });
		}

		// Jika memang tidak ada baris terkait, buat baru
		const newId = generateId();
		await sheet.addRow({
			id: newId,
			guru_id: userId || '',
			tanggal: normDate(newTanggal),
			jam_ke: norm(newJamKe),
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

// DELETE: Hapus sesi
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tanggal = searchParams.get('tanggal');
		const jam_ke = searchParams.get('jam_ke');

		if (!kelas || !mapel || !tanggal || !jam_ke) {
			return NextResponse.json({ error: 'parameter kurang' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();
		let deleted = 0;
		for (let i = rows.length - 1; i >= 0; i--) {
			const r = rows[i];
			const isMatch = norm(r.get('kelas')) === norm(kelas) && norm(r.get('mapel')) === norm(mapel) && normDate(r.get('tanggal')) === normDate(tanggal) && norm(r.get('jam_ke')) === norm(jam_ke);

			if (isMatch) {
				if (role === 'Guru' && String(r.get('guru_id')) !== String(userId)) {
					// Lompati jika Guru mencoba menghapus absensi mapel orang lain
					continue;
				}
				await r.delete();
				deleted++;
			}
		}

		if (deleted === 0) {
			return NextResponse.json({ error: 'Data absensi tidak ditemukan / Akses Ditolak' }, { status: 403 });
		}

		return NextResponse.json({ success: true, deleted });
	} catch (error) {
		console.error('DELETE /absensi-mapel Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
