import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(request) {
	try {
		const { pin } = await request.json();

		if (!pin) {
			return NextResponse.json({ error: 'PIN diperlukan' }, { status: 400 });
		}

		const supabase = supabaseAdmin;
		
		const { data: task, error } = await supabase
			.from('tugas_online')
			.select('judul, mapel, materi, tipe_soal, soal')
			.eq('pin', pin.toUpperCase())
			.single();

		if (error || !task) {
			return NextResponse.json({ error: 'PIN tidak valid atau tugas tidak ditemukan' }, { status: 404 });
		}

		let parsedSoal = task.soal;
		if (typeof task.soal === 'string') {
			try {
				parsedSoal = JSON.parse(task.soal);
			} catch(e) {
				parsedSoal = task.soal;
			}
		}

		return NextResponse.json({
			success: true,
			tugas: {
				judul: task.judul,
				mapel: task.mapel,
				materi: task.materi,
				tipe_soal: task.tipe_soal,
				soal: parsedSoal,
			},
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
	}
}
