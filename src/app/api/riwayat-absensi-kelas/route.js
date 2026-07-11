import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const siswa_id = searchParams.get('siswa_id');

		if (!siswa_id) {
			return NextResponse.json({ error: 'siswa_id wajib' }, { status: 400 });
		}

		const supabase = await createClient();

		const { data, error } = await supabase
			.from('absensi_harian_siswa')
			.select(`
				id,
				status,
				keterangan,
				absensi_harian!inner (
					tanggal
				)
			`)
			.eq('siswa_id', siswa_id);

		if (error) throw error;

		const result = (data || []).map((r) => ({
			id: r.id,
			tanggal: String(r.absensi_harian.tanggal).slice(0, 10),
			status: r.status,
			keterangan: r.keterangan || 'Harian',
		}));

		// Sort terbaru -> terlama
		result.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return NextResponse.json(result);
	} catch (error) {
		console.error('GET Absensi Kelas Error:', error);
		return NextResponse.json([], { status: 500 });
	}
}
