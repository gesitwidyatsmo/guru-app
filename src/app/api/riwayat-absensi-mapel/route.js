import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const siswa_id = searchParams.get('siswa_id');
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun');

		if (!siswa_id) {
			return NextResponse.json({ error: 'Parameter siswa_id wajib' }, { status: 400 });
		}

		const supabase = await createClient();

		let query = supabase.from('absensi_mapel_siswa').select(`
			status,
			absensi_mapel!inner (
				sesi_id,
				tanggal,
				jam_ke,
				kelas,
				mapel
			)
		`).eq('siswa_id', siswa_id);

		if (kelas) query = query.eq('absensi_mapel.kelas', kelas);
		if (mapel) query = query.eq('absensi_mapel.mapel', mapel);

		if (bulan && tahun) {
			const startDate = new Date(tahun, bulan - 1, 1).toISOString();
			const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString();
			query = query.gte('absensi_mapel.tanggal', startDate).lte('absensi_mapel.tanggal', endDate);
		}

		const { data, error } = await query;
		if (error) throw error;

		const out = (data || []).map((r) => ({
			pertemuan_id: r.absensi_mapel.sesi_id,
			tanggal: String(r.absensi_mapel.tanggal).slice(0, 10),
			jam_ke: r.absensi_mapel.jam_ke,
			kelas: r.absensi_mapel.kelas,
			mapel: r.absensi_mapel.mapel,
			status: r.status,
		}));

		out.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
		return NextResponse.json(out);
	} catch (error) {
		console.error('GET /riwayat-absensi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
