import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return Math.random().toString(36).substring(2, 11);
}

export async function POST(req) {
	try {
		const body = await req.json();
		const {
			judul,
			type,
			deskripsi,
			mapel,
			kelas,
			tanggal,
			nilai,
			tahun_ajar,
			semester,
			mode_penilaian = 'langsung',
			total_soal = 100,
			skala_maks = 100,
			pembulatan = 'decimal_1',
		} = body;

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
		const numTotalSoal = parseInt(total_soal) || 100;
		const numSkalaMaks = parseInt(skala_maks) || 100;
		
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
			tahun_ajar: tahun_ajar || '2026/2027',
			semester: semester ? parseInt(semester) : 1,
			mode_penilaian,
			total_soal: numTotalSoal,
			skala_maks: numSkalaMaks,
			pembulatan,
		});

		if (tugasError) throw tugasError;

		// Helper kalkulasi nilai dari jumlah benar
		const calculateScore = (benar, rawNilai) => {
			if (mode_penilaian === 'jumlah_benar' && numTotalSoal > 0 && benar !== undefined && benar !== null && String(benar).trim() !== '') {
				const numBenar = Math.min(Math.max(parseFloat(benar) || 0, 0), numTotalSoal);
				const rawCalculated = (numBenar / numTotalSoal) * numSkalaMaks;
				if (pembulatan === 'round') return Math.round(rawCalculated);
				if (pembulatan === 'decimal_2') return parseFloat(rawCalculated.toFixed(2));
				return parseFloat(rawCalculated.toFixed(1));
			}
			return rawNilai !== undefined && rawNilai !== null ? parseFloat(rawNilai) || 0 : 0;
		};

		// 2. Format students and insert to nilai_siswa
		const data_nilai = [];
		if (nilai && Array.isArray(nilai)) {
			// Kita perlu nama siswa, ambil batch dari DB jika hanya ada ID
			const validItems = nilai.filter(n => {
				if (mode_penilaian === 'jumlah_benar') {
					return n.jumlah_benar !== undefined && n.jumlah_benar !== null && String(n.jumlah_benar).trim() !== '';
				}
				return n.nilai && parseFloat(n.nilai) > 0;
			});

			const siswaIds = validItems.map(n => n.siswa_id);
			
			if (siswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', siswaIds);
				const siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));

				for (const item of validItems) {
					if (siswaMap.has(item.siswa_id)) {
						const finalNilai = calculateScore(item.jumlah_benar, item.nilai);
						const finalJumlahBenar = item.jumlah_benar !== undefined && item.jumlah_benar !== null && String(item.jumlah_benar).trim() !== ''
							? parseFloat(item.jumlah_benar)
							: null;

						data_nilai.push({
							tugas_id: tugasId,
							siswa_id: item.siswa_id,
							nama_siswa: siswaMap.get(item.siswa_id),
							nilai: finalNilai,
							jumlah_benar: finalJumlahBenar,
						});
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
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');

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
			jumlah_benar,
			nilai_tugas!inner (
				guru_id,
				kategori,
				type,
				deskripsi,
				kelas,
				mapel,
				tanggal,
				mode_penilaian,
				total_soal,
				skala_maks,
				pembulatan
			)
		`);

		// Filter
		if (tugasId) query = query.eq('tugas_id', tugasId);
		if (kelas) query = query.eq('nilai_tugas.kelas', kelas);
		if (mapel) query = query.eq('nilai_tugas.mapel', mapel);
		// Filter Periode Akademik
		if (tahunAjar) query = query.eq('nilai_tugas.tahun_ajar', tahunAjar);
		if (semester) query = query.eq('nilai_tugas.semester', parseInt(semester));
		
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
			jumlah_benar: row.jumlah_benar,
			mode_penilaian: row.nilai_tugas.mode_penilaian || 'langsung',
			total_soal: row.nilai_tugas.total_soal || 100,
			skala_maks: row.nilai_tugas.skala_maks || 100,
			pembulatan: row.nilai_tugas.pembulatan || 'decimal_1',
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
		const {
			tugasId,
			judul,
			type,
			deskripsi,
			kelas,
			mapel,
			tanggal,
			nilai,
			mode_penilaian,
			total_soal,
			skala_maks,
			pembulatan,
		} = body;

		if (!tugasId || !judul || !kelas || !mapel || !tanggal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		const supabase = await createClient();

		// Verifikasi keberadaan dan kepemilikan
		const { data: existingTugas, error: fetchError } = await supabase
			.from('nilai_tugas')
			.select('*')
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

		const activeMode = mode_penilaian || existingTugas.mode_penilaian || 'langsung';
		const numTotalSoal = total_soal !== undefined ? parseInt(total_soal) : (existingTugas.total_soal || 100);
		const numSkalaMaks = skala_maks !== undefined ? parseInt(skala_maks) : (existingTugas.skala_maks || 100);
		const activePembulatan = pembulatan || existingTugas.pembulatan || 'decimal_1';

		// Update Header (nilai_tugas)
		const updates = {
			kategori: judul,
			tanggal: tanggal,
		};
		if (type !== undefined) updates.type = type;
		if (deskripsi !== undefined) updates.deskripsi = deskripsi;
		if (mode_penilaian !== undefined) updates.mode_penilaian = mode_penilaian;
		if (total_soal !== undefined) updates.total_soal = numTotalSoal;
		if (skala_maks !== undefined) updates.skala_maks = numSkalaMaks;
		if (pembulatan !== undefined) updates.pembulatan = activePembulatan;

		const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', tugasId);
		if (updateError) throw updateError;

		// Helper kalkulasi nilai
		const calculateScore = (benar, rawNilai) => {
			if (activeMode === 'jumlah_benar' && numTotalSoal > 0 && benar !== undefined && benar !== null && String(benar).trim() !== '') {
				const numBenar = Math.min(Math.max(parseFloat(benar) || 0, 0), numTotalSoal);
				const rawCalculated = (numBenar / numTotalSoal) * numSkalaMaks;
				if (activePembulatan === 'round') return Math.round(rawCalculated);
				if (activePembulatan === 'decimal_2') return parseFloat(rawCalculated.toFixed(2));
				return parseFloat(rawCalculated.toFixed(1));
			}
			return rawNilai !== undefined && rawNilai !== null ? parseFloat(rawNilai) || 0 : 0;
		};

		// Update Nilai Siswa (Hapus lama, buat baru - upsert like approach)
		if (nilai && Array.isArray(nilai)) {
			// Get current student grades for this task
			const { data: existingGrades } = await supabase.from('nilai_siswa').select('siswa_id').eq('tugas_id', tugasId);
			const existingIds = new Set((existingGrades || []).map(g => g.siswa_id));
			
			const validItems = nilai.filter(n => {
				if (activeMode === 'jumlah_benar') {
					return n.jumlah_benar !== undefined && n.jumlah_benar !== null && String(n.jumlah_benar).trim() !== '';
				}
				return n.nilai !== undefined && n.nilai !== null && String(n.nilai).trim() !== '';
			});

			const siswaIdsToUpdate = validItems.map(n => n.siswa_id);
			
			// Jika ada siswa baru yg butuh nama:
			const newSiswaIds = siswaIdsToUpdate.filter(id => !existingIds.has(id));
			let siswaMap = new Map();
			if (newSiswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', newSiswaIds);
				siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));
			}

			for (const item of nilai) {
				const hasValidBenar = item.jumlah_benar !== undefined && item.jumlah_benar !== null && String(item.jumlah_benar).trim() !== '';
				const hasValidScore = item.nilai !== undefined && item.nilai !== null && String(item.nilai).trim() !== '';
				const isValid = activeMode === 'jumlah_benar' ? hasValidBenar : hasValidScore;
				
				if (isValid) {
					const finalNilai = calculateScore(item.jumlah_benar, item.nilai);
					const finalJumlahBenar = hasValidBenar ? parseFloat(item.jumlah_benar) : null;

					if (existingIds.has(item.siswa_id)) {
						// Update existing
						await supabase.from('nilai_siswa').update({
							nilai: finalNilai,
							jumlah_benar: finalJumlahBenar,
						}).eq('tugas_id', tugasId).eq('siswa_id', item.siswa_id);
					} else if (siswaMap.has(item.siswa_id)) {
						// Insert new
						await supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: item.siswa_id,
							nama_siswa: siswaMap.get(item.siswa_id),
							nilai: finalNilai,
							jumlah_benar: finalJumlahBenar,
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
