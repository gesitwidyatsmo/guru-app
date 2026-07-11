import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const pin = searchParams.get('pin');

		if (!pin) {
			return NextResponse.json({ error: 'PIN tidak diberikan' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { data: submissions, error } = await supabase
			.from('pengumpulan_tugas')
			.select('*')
			.eq('pin', pin.toUpperCase())
			.order('no_absen', { ascending: true });

		if (error) throw error;

		const formattedSubmissions = (submissions || []).map((row) => ({
			id: row.id,
			waktu: row.waktu,
			kelas: row.kelas || '-',
			nama: row.nama_siswa,
			absen: row.no_absen,
			teks: row.jawaban_teks,
			file: row.link_file,
			nilai: row.nilai || '',
			siswa_id: row.siswa_id,
		}));

		// Urutkan berdasarkan absen secara numerik jika bisa
		formattedSubmissions.sort((a, b) => {
			const aNum = parseInt(a.absen);
			const bNum = parseInt(b.absen);
			if (!isNaN(aNum) && !isNaN(bNum)) {
				return aNum - bNum;
			}
			return String(a.absen).localeCompare(String(b.absen));
		});

		return NextResponse.json(formattedSubmissions);
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal mengambil data hasil pengumpulan' }, { status: 500 });
	}
}
