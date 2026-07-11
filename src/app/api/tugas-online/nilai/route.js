import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(request) {
	try {
		const role = request.headers.get('x-user-role');
		if (role !== 'Guru' && role !== 'Admin') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { id_pengumpulan, pin, siswa_id, nilai, kelas } = body;

		if (!id_pengumpulan || !pin) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const numericNilai = nilai === '' ? null : Number(nilai);
		const supabase = await createClient();

		// 1. Update nilai di tabel pengumpulan_tugas
		const { error: updatePengumpulanError } = await supabase
			.from('pengumpulan_tugas')
			.update({ nilai: numericNilai })
			.eq('id', id_pengumpulan);

		if (updatePengumpulanError) throw updatePengumpulanError;

		// 2. Sinkronisasi ke nilai_tugas jika siswa_id tersedia
		if (siswa_id && numericNilai !== null) {
			const { data: taskRow, error: taskError } = await supabase
				.from('tugas_online')
				.select('*')
				.eq('pin', pin.toUpperCase())
				.single();

			if (!taskError && taskRow) {
				const taskMapel = taskRow.mapel || '-';
				const taskJudul = taskRow.judul || `Tugas ${pin}`;
				const taskKategori = taskRow.kategori || 'Formatif';
				const taskType = taskRow.type || 'Tugas Online';

				const { error: upsertError } = await supabaseAdmin.from('nilai_tugas').upsert({
					siswa_id: siswa_id,
					kelas: kelas || '-',
					mapel: taskMapel,
					judul_tugas: taskJudul,
					kategori: taskKategori,
					type: taskType,
					nilai: numericNilai
				}, {
					onConflict: 'siswa_id, kelas, mapel, judul_tugas'
				});
				
				if (upsertError) {
					console.error('Gagal sinkron nilai_tugas:', upsertError);
				}
			}
		} else if (siswa_id && numericNilai === null) {
			// Jika nilai dihapus, mungkin kita perlu menghapus dari nilai_tugas juga?
			// Tapi untuk saat ini kita biarkan atau hapus jika perlu.
			const { data: taskRow } = await supabase.from('tugas_online').select('*').eq('pin', pin.toUpperCase()).single();
			if (taskRow) {
				await supabaseAdmin.from('nilai_tugas').delete().match({
					siswa_id: siswa_id,
					mapel: taskRow.mapel || '-',
					judul_tugas: taskRow.judul || `Tugas ${pin}`
				});
			}
		}

		return NextResponse.json({ success: true, message: 'Nilai berhasil disimpan' });
	} catch (error) {
		console.error('API Nilai Error:', error);
		return NextResponse.json({ error: 'Gagal menyimpan nilai' }, { status: 500 });
	}
}
