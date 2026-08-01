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
		const { id_pengumpulan, pin, siswa_id: bodySiswaId, nilai, kelas: bodyKelas, nama_siswa: bodyNamaSiswa } = body;

		if (!id_pengumpulan || !pin) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const numericNilai = nilai === '' ? null : Number(nilai);
		const supabase = await createClient();

		// 1. Update nilai di tabel pengumpulan_tugas
		const { error: updatePengumpulanError } = await supabaseAdmin
			.from('pengumpulan_tugas')
			.update({ nilai: numericNilai })
			.eq('id', id_pengumpulan);

		if (updatePengumpulanError) throw updatePengumpulanError;

		// 2. Resolve siswa_id, nama_siswa, kelas dari pengumpulan_tugas jika tidak ada di body
		let siswaId = bodySiswaId || null;
		let namaSiswa = bodyNamaSiswa || null;
		let kelas = bodyKelas || null;

		if (!siswaId || !namaSiswa || !kelas) {
			const { data: pengumpulanRow } = await supabaseAdmin
				.from('pengumpulan_tugas')
				.select('siswa_id, nama_siswa, kelas')
				.eq('id', id_pengumpulan)
				.single();

			if (pengumpulanRow) {
				if (!siswaId) siswaId = pengumpulanRow.siswa_id || null;
				if (!namaSiswa) namaSiswa = pengumpulanRow.nama_siswa || null;
				if (!kelas) kelas = pengumpulanRow.kelas || null;
			}
		}

		// Opsi A: Satu header per kelas — TGS-ONLINE-{PIN}-{KELAS}
		const kelasKey = (kelas && kelas !== '-') ? kelas : 'UMUM';
		const tugasId = `TGS-ONLINE-${pin.toUpperCase()}-${kelasKey}`;

		// 3. Sinkronisasi ke nilai_tugas + nilai_siswa
		if (numericNilai !== null) {
			const { data: taskRow, error: taskError } = await supabase
				.from('tugas_online')
				.select('*')
				.eq('pin', pin.toUpperCase())
				.single();

			if (!taskError && taskRow) {
				let parsedTaskSoal = null;
				try {
					parsedTaskSoal = typeof taskRow?.soal === 'string' ? JSON.parse(taskRow?.soal) : taskRow?.soal;
				} catch(e) {}

				const taskMapel = taskRow.mapel || '-';
				const taskJudul = taskRow.judul || `Tugas ${pin}`;
				const taskKategori = parsedTaskSoal?.kategori || 'Formatif';
				const taskType = parsedTaskSoal?.type || 'Tugas Online';

				// Resolve guru_id
				let trueGuruId = null;
				if (taskRow?.created_by) {
					if (taskRow.created_by.startsWith('UID-')) {
						trueGuruId = taskRow.created_by;
					} else {
						const { data: guruData } = await supabaseAdmin
							.from('users')
							.select('id_user')
							.eq('nama_lengkap', taskRow.created_by)
							.single();
						if (guruData) trueGuruId = guruData.id_user;
					}
				}

				// Upsert Header (nilai_tugas) — satu per kelas
				const { error: headerError } = await supabaseAdmin.from('nilai_tugas').upsert({
					tugas_id: tugasId,
					guru_id: trueGuruId,
					kategori: taskKategori,
					type: taskType,
					deskripsi: taskJudul,
					kelas: kelasKey,
					mapel: taskMapel,
					tanggal: new Date().toISOString().split('T')[0]
				}, {
					onConflict: 'tugas_id'
				});

				if (headerError) {
					console.error('[Auto-Sync] Gagal sinkron header nilai_tugas:', headerError);
				} else if (siswaId) {
					// Upsert Student Score (nilai_siswa)
					const { error: detailError } = await supabaseAdmin.from('nilai_siswa').upsert({
						tugas_id: tugasId,
						siswa_id: siswaId,
						nama_siswa: namaSiswa,
						nilai: numericNilai
					}, {
						onConflict: 'tugas_id, siswa_id'
					});
					if (detailError) console.error('[Auto-Sync] Gagal sinkron detail nilai_siswa:', detailError);
				}
			}
		} else if (numericNilai === null && siswaId) {
			// Nilai dihapus (di-clear) — hapus baris dari nilai_siswa
			await supabaseAdmin.from('nilai_siswa').delete().match({
				tugas_id: tugasId,
				siswa_id: siswaId
			});
		}

		return NextResponse.json({ success: true, message: 'Nilai berhasil disimpan' });
	} catch (error) {
		console.error('API Nilai Error:', error);
		return NextResponse.json({ error: 'Gagal menyimpan nilai' }, { status: 500 });
	}
}
