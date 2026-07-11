import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

export async function POST(req) {
	try {
		const body = await req.json();
		const { judul, type, deskripsi, mapel, kelas, tanggal, nilai } = body;

		if (!judul || !mapel || !kelas || !tanggal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const supabase = await createClient();

		if (role === 'Guru' && userId) {
			const { data: isAllowed } = await supabase
				.from('guru_kbm')
				.select('id_kbm')
				.eq('id_user', userId)
				.eq('kelas', kelas)
				.eq('mapel', mapel)
				.single();

			if (!isAllowed) {
				return NextResponse.json({ error: 'Akses Ditolak: Anda di luar yurisdiksi kelas ini.' }, { status: 403 });
			}
		}

		const tugasId = 'TGS-' + generateId();
		
		// 1. Insert header to nilai_tugas
		const { error: tugasError } = await supabase.from('nilai_tugas').insert({
			tugas_id: tugasId,
			guru_id: userId || null,
			kategori: judul,
			type: type || '',
			deskripsi: deskripsi || '',
			kelas,
			mapel,
			tanggal,
		});

		if (tugasError) throw tugasError;

		// 2. Format students and insert to nilai_siswa
		const data_nilai = [];
		if (nilai && Array.isArray(nilai)) {
			// Kita perlu nama siswa, ambil batch dari DB jika hanya ada ID
			const siswaIds = nilai.filter(n => n.nilai && parseInt(n.nilai) > 0).map(n => n.siswa_id);
			
			if (siswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', siswaIds);
				const siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));

				for (const item of nilai) {
					if (item.nilai && parseInt(item.nilai) > 0) {
						if (siswaMap.has(item.siswa_id)) {
							data_nilai.push({
								tugas_id: tugasId,
								siswa_id: item.siswa_id,
								nama_siswa: siswaMap.get(item.siswa_id),
								nilai: item.nilai,
							});
						}
					}
				}
			}
		}

		if (data_nilai.length > 0) {
			const { error: nilaiError } = await supabase.from('nilai_siswa').insert(data_nilai);
			if (nilaiError) throw nilaiError;
		}

		return NextResponse.json(
			{
				success: true,
				message: 'Tugas berhasil disimpan',
				count: data_nilai.length,
				tugasId: tugasId,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('❌ Error saving tugas:', error);
		return NextResponse.json({ error: 'Gagal menyimpan tugas', details: error.message }, { status: 500 });
	}
}

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const mapel = searchParams.get('mapel');
		const tugasId = searchParams.get('tugasId');

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const supabase = await createClient();

		// Mengambil nilai siswa dan join dengan nilai tugas
		let query = supabase.from('nilai_siswa').select(`
			id,
			tugas_id,
			siswa_id,
			nama_siswa,
			nilai,
			nilai_tugas!inner (
				guru_id,
				kategori,
				type,
				deskripsi,
				kelas,
				mapel,
				tanggal
			)
		`);

		// Filter
		if (tugasId) query = query.eq('tugas_id', tugasId);
		if (kelas) query = query.eq('nilai_tugas.kelas', kelas);
		if (mapel) query = query.eq('nilai_tugas.mapel', mapel);
		
		// Isolasi Hak Akses Guru
		if (role === 'Guru' && userId) {
			query = query.eq('nilai_tugas.guru_id', userId);
		}

		const { data: rawData, error } = await query;
		if (error) throw error;

		// Map to flat structure expected by frontend
		const formattedTugas = (rawData || []).map(row => ({
			id: row.id + '_' + row.siswa_id,
			guru_id: row.nilai_tugas.guru_id || '',
			siswa_id: row.siswa_id,
			nama_siswa: row.nama_siswa,
			kelas: row.nilai_tugas.kelas,
			mapel: row.nilai_tugas.mapel,
			kategori: row.nilai_tugas.kategori,
			type: row.nilai_tugas.type || '',
			deskripsi: row.nilai_tugas.deskripsi || '',
			nilai: row.nilai,
			tanggal: row.nilai_tugas.tanggal,
			tugas_id: row.tugas_id,
		}));

		return NextResponse.json(formattedTugas, { status: 200 });
	} catch (error) {
		console.error('❌ Error fetching tugas:', error);
		return NextResponse.json({ error: 'Gagal mengambil data tugas', details: error.message }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const { tugasId, judul, type, deskripsi, kelas, mapel, tanggal, nilai } = body;

		if (!tugasId || !judul || !kelas || !mapel || !tanggal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const supabase = await createClient();

		// Verifikasi keberadaan dan kepemilikan
		const { data: existingTugas, error: fetchError } = await supabase
			.from('nilai_tugas')
			.select('guru_id')
			.eq('tugas_id', tugasId)
			.single();

		if (fetchError || !existingTugas) {
			return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
		}

		if (role === 'Guru' && userId) {
			if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Anda mencoba menyunting Tugas buatan kolega.' }, { status: 403 });
			}
			
			// Cek Yurisdiksi KBM
			const { data: isAllowed } = await supabase
				.from('guru_kbm')
				.select('id_kbm')
				.eq('id_user', userId)
				.eq('kelas', kelas)
				.eq('mapel', mapel)
				.single();

			if (!isAllowed) {
				return NextResponse.json({ error: 'Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.' }, { status: 403 });
			}
		}

		// Update Header (nilai_tugas)
		const updates = {
			kategori: judul,
			tanggal: tanggal,
		};
		if (type !== undefined) updates.type = type;
		if (deskripsi !== undefined) updates.deskripsi = deskripsi;

		const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', tugasId);
		if (updateError) throw updateError;

		// Update Nilai Siswa (Hapus lama, buat baru - upsert like approach)
		if (nilai && Array.isArray(nilai)) {
			// Get current student grades for this task
			const { data: existingGrades } = await supabase.from('nilai_siswa').select('siswa_id').eq('tugas_id', tugasId);
			const existingIds = new Set((existingGrades || []).map(g => g.siswa_id));
			
			const siswaIdsToUpdate = nilai.filter(n => n.nilai && String(n.nilai).trim() !== '').map(n => n.siswa_id);
			
			// Jika ada siswa baru yg butuh nama:
			const newSiswaIds = siswaIdsToUpdate.filter(id => !existingIds.has(id));
			let siswaMap = new Map();
			if (newSiswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', newSiswaIds);
				siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));
			}

			for (const item of nilai) {
				const hasValidScore = item.nilai && String(item.nilai).trim() !== '';
				
				if (hasValidScore) {
					if (existingIds.has(item.siswa_id)) {
						// Update existing
						await supabase.from('nilai_siswa').update({ nilai: item.nilai }).eq('tugas_id', tugasId).eq('siswa_id', item.siswa_id);
					} else if (siswaMap.has(item.siswa_id)) {
						// Insert new
						await supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: item.siswa_id,
							nama_siswa: siswaMap.get(item.siswa_id),
							nilai: item.nilai
						});
					}
				} else {
					// Delete if exists and score is cleared
					if (existingIds.has(item.siswa_id)) {
						await supabase.from('nilai_siswa').delete().eq('tugas_id', tugasId).eq('siswa_id', item.siswa_id);
					}
				}
			}
		}

		return NextResponse.json({ success: true, message: 'Nilai berhasil diperbarui' }, { status: 200 });
	} catch (error) {
		console.error('❌ Error updating tugas:', error);
		return NextResponse.json({ error: 'Gagal memperbarui nilai', details: error.message }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const tugasId = searchParams.get('tugasId');

		if (!tugasId) return NextResponse.json({ error: 'tugasId tidak ditemukan' }, { status: 400 });

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const supabase = await createClient();

		const { data: existingTugas, error: fetchError } = await supabase
			.from('nilai_tugas')
			.select('guru_id, kelas, mapel')
			.eq('tugas_id', tugasId)
			.single();

		if (fetchError || !existingTugas) {
			return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
		}

		if (role === 'Guru' && userId) {
			if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
				return NextResponse.json({ error: 'Akses Ditolak: Dilarang menghapus riwayat penilaian kepunyaan rekan Guru Anda.' }, { status: 403 });
			}
			
			// Cek Yurisdiksi KBM
			const { data: isAllowed } = await supabase
				.from('guru_kbm')
				.select('id_kbm')
				.eq('id_user', userId)
				.eq('kelas', existingTugas.kelas)
				.eq('mapel', existingTugas.mapel)
				.single();

			if (!isAllowed) {
				return NextResponse.json({ error: 'Akses Ditolak: Anda tidak berhak menghapus tugas dari kelas eksternal.' }, { status: 403 });
			}
		}

		// Delete Header (akan cascade mendelete detail di nilai_siswa)
		const { error: deleteError } = await supabase.from('nilai_tugas').delete().eq('tugas_id', tugasId);
		
		if (deleteError) throw deleteError;

		return NextResponse.json({ success: true, message: 'Tugas berhasil dihapus' }, { status: 200 });
	} catch (error) {
		console.error('❌ Error deleting tugas:', error);
		return NextResponse.json({ error: 'Gagal menghapus tugas', details: error.message }, { status: 500 });
	}
}
