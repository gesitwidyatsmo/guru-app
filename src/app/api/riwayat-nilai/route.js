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

		const { data: nilaiData, error } = await supabase
			.from('nilai_siswa')
			.select(`
				id,
				tugas_id,
				nilai,
				nilai_tugas!inner(
					tanggal,
					mapel,
					kategori,
					kelas
				)
			`)
			.eq('siswa_id', siswa_id);

		if (error) throw error;

		const nilaiSiswa = (nilaiData || []).map(r => ({
			id: r.id,
			tugas_id: r.tugas_id,
			tanggal: r.nilai_tugas.tanggal,
			mapel: r.nilai_tugas.mapel,
			kategori: r.nilai_tugas.kategori,
			nilai: Number(r.nilai) || 0,
			kelas: r.nilai_tugas.kelas,
		}));

		// Sort: Terbaru ke terlama
		nilaiSiswa.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

		return NextResponse.json(nilaiSiswa);
	} catch (error) {
		console.error('GET Riwayat Nilai Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
