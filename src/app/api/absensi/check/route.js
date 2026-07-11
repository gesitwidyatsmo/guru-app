import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);

		const kelas = searchParams.get('kelas');
		const tanggal = searchParams.get('tanggal');

		if (!kelas || !tanggal) {
			return NextResponse.json({ error: 'kelas dan tanggal wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();

		const { data, error } = await supabase
			.from('absensi_harian')
			.select('sesi_id')
			.eq('kelas', kelas)
			.eq('tanggal', tanggal)
			.single();

		if (error && error.code !== 'PGRST116') { // PGRST116 is not found
			throw error;
		}

		const exists = !!data;

		return NextResponse.json({ exists }, { status: 200 });
	} catch (error) {
		console.error('❌ Error cek absensi:', error);
		return NextResponse.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 });
	}
}
