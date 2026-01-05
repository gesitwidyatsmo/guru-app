import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const SHEET_NAME = 'MASTER_ABSENSI_MAPEL';
const norm = (v) => String(v ?? '').trim();
const normDate = (v) => String(v ?? '').slice(0, 10);

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const siswa_id = searchParams.get('siswa_id');
		const kelas = searchParams.get('kelas'); // opsional
		const mapel = searchParams.get('mapel'); // opsional
		const bulan = searchParams.get('bulan'); // opsional
		const tahun = searchParams.get('tahun'); // opsional

		if (!siswa_id) {
			return NextResponse.json({ error: 'Parameter siswa_id wajib' }, { status: 400 });
		}

		const doc = await getSheet();
		const sheet = doc.sheetsByTitle[SHEET_NAME];
		if (!sheet) return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 404 });

		const rows = await sheet.getRows();

		let filtered = rows;

		if (kelas) filtered = filtered.filter((r) => norm(r.get('kelas')) === norm(kelas));
		if (mapel) filtered = filtered.filter((r) => norm(r.get('mapel')) === norm(mapel));

		if (bulan && tahun) {
			filtered = filtered.filter((r) => {
				const d = new Date(normDate(r.get('tanggal')));
				return d.getMonth() + 1 === Number(bulan) && d.getFullYear() === Number(tahun);
			});
		}

		const out = [];

		for (const r of filtered) {
			let arr = [];
			try {
				arr = JSON.parse(r.get('data_absensi') || '[]');
			} catch {
				arr = [];
			}

			const hit = Array.isArray(arr) ? arr.find((x) => String(x?.siswa_id) === String(siswa_id)) : null;

			if (hit) {
				out.push({
					pertemuan_id: r.get('id'),
					tanggal: normDate(r.get('tanggal')),
					jam_ke: r.get('jam_ke'),
					kelas: r.get('kelas'),
					mapel: r.get('mapel'),
					status: hit.status,
				});
			}
		}

		out.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
		return NextResponse.json(out);
	} catch (error) {
		console.error('GET /riwayat-absensi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
