import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

function detectTingkat(namaKelas = '') {
	const raw = String(namaKelas || '').toUpperCase();
	if (raw.includes('IX') || raw.includes('9') || raw.includes('SEMBILAN')) return 'IX';
	if (raw.includes('VIII') || raw.includes('8') || raw.includes('DELAPAN')) return 'VIII';
	if (raw.includes('VII') || raw.includes('7') || raw.includes('TUJUH')) return 'VII';
	return 'Lainnya';
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { searchParams } = new URL(request.url);

		let tahunAjaran = searchParams.get('tahun_ajaran');
		let semester = parseInt(searchParams.get('semester') || '0', 10);
		const requestedKelasId = searchParams.get('kelas_id');

		// 1. Ambil tahun ajar & semester aktif jika tidak dispesifikasikan
		if (!tahunAjaran || !semester) {
			const { data: taAktif } = await supabase
				.from('tahun_ajar')
				.select('nama, semester, is_aktif')
				.eq('is_aktif', true)
				.maybeSingle();

			if (taAktif) {
				tahunAjaran = tahunAjaran || taAktif.nama || '2026/2027';
				semester = semester || taAktif.semester || 1;
			} else {
				tahunAjaran = tahunAjaran || '2026/2027';
				semester = semester || 1;
			}
		}

		// 2. Ambil daftar kelas dengan data wali kelas
		const { data: kelasListRaw, error: klsErr } = await supabase
			.from('kelas')
			.select(`
				id,
				nama_kelas,
				id_wali_kelas,
				users!kelas_id_wali_kelas_fkey(id_user, nama_lengkap, nip)
			`)
			.order('nama_kelas', { ascending: true });

		if (klsErr) throw klsErr;
		const kelasList = (kelasListRaw || []).map((k) => ({
			id: k.id,
			nama_kelas: k.nama_kelas,
			tingkat: detectTingkat(k.nama_kelas),
			wali_kelas: k.users?.nama_lengkap || '',
			nip_wali: k.users?.nip || '',
		}));

		// 3. Ambil seluruh siswa aktif
		const { data: siswaListRaw, error: sErr } = await supabase
			.from('siswa')
			.select('id, nis, nisn, nama_lengkap, kelas, jenis_kelamin')
			.eq('status', 'Aktif')
			.order('nama_lengkap', { ascending: true });

		if (sErr) throw sErr;
		const siswaList = siswaListRaw || [];

		// 4. Ambil nilai dari rapor_nilai_kuantitatif
		let grades = [];
		const { data: rGrades, error: gErr } = await supabase
			.from('rapor_nilai_kuantitatif')
			.select('siswa_id, mapel_id, kelas_id, nilai_akhir')
			.eq('semester', semester)
			.eq('tahun_ajaran', tahunAjaran);

		if (!gErr && rGrades && rGrades.length > 0) {
			grades = rGrades;
		}

		// Map nilai: { [siswa_id]: { [mapel_id]: nilai_akhir } }
		const gradeMap = {};
		grades.forEach((g) => {
			if (!gradeMap[g.siswa_id]) gradeMap[g.siswa_id] = {};
			const val = parseFloat(g.nilai_akhir);
			if (!isNaN(val)) {
				gradeMap[g.siswa_id][g.mapel_id] = val;
			}
		});

		// 5. Fallback jika nilai rapor_nilai_kuantitatif masih kosong: gunakan nilai_siswa KBM
		if (Object.keys(gradeMap).length === 0) {
			const { data: rawKbmScores } = await supabase
				.from('nilai_siswa')
				.select(`
					siswa_id,
					nilai,
					nilai_tugas!inner (
						mapel,
						kelas
					)
				`);

			if (rawKbmScores && rawKbmScores.length > 0) {
				const tempAccum = {}; // { [siswa_id]: { [mapel]: [scores...] } }
				rawKbmScores.forEach((row) => {
					const sid = row.siswa_id;
					const mapelName = row.nilai_tugas?.mapel;
					const score = parseFloat(row.nilai);
					if (sid && mapelName && !isNaN(score)) {
						if (!tempAccum[sid]) tempAccum[sid] = {};
						if (!tempAccum[sid][mapelName]) tempAccum[sid][mapelName] = [];
						tempAccum[sid][mapelName].push(score);
					}
				});

				// Hitung rata-rata per mapel sebagai nilai_akhir
				Object.keys(tempAccum).forEach((sid) => {
					gradeMap[sid] = {};
					Object.keys(tempAccum[sid]).forEach((mapel) => {
						const list = tempAccum[sid][mapel];
						const avg = list.reduce((a, b) => a + b, 0) / list.length;
						gradeMap[sid][mapel] = Math.round(avg * 10) / 10;
					});
				});
			}
		}

		// 6. Hitung Total & Rata-Rata Nilai untuk Tiap Siswa
		const studentScores = siswaList.map((s) => {
			const sGrades = gradeMap[s.id] || {};
			const mapelKeys = Object.keys(sGrades);
			let total = 0;
			let count = 0;

			mapelKeys.forEach((mKey) => {
				const val = sGrades[mKey];
				if (val !== undefined && val !== null && !isNaN(val)) {
					total += val;
					count += 1;
				}
			});

			const rataRata = count > 0 ? parseFloat((total / count).toFixed(2)) : 0;
			const targetKls = kelasList.find((k) => k.nama_kelas === s.kelas);

			return {
				id: s.id,
				nis: s.nis,
				nisn: s.nisn,
				nama_lengkap: s.nama_lengkap,
				jenis_kelamin: s.jenis_kelamin,
				kelas: s.kelas,
				tingkat: targetKls?.tingkat || detectTingkat(s.kelas),
				wali_kelas: targetKls?.wali_kelas || '',
				nip_wali: targetKls?.nip_wali || '',
				kelas_id: targetKls?.id || null,
				total_nilai: Math.round(total * 10) / 10,
				rata_rata: rataRata,
				jumlah_mapel: count,
			};
		});

		// 7. Hitung Juara Kelas per Rombel
		const juaraKelasMap = {};
		kelasList.forEach((k) => {
			const inClass = studentScores.filter((s) => s.kelas === k.nama_kelas);
			// Sortir: Rata-Rata tertinggi -> Total Nilai tertinggi -> Nama
			inClass.sort((a, b) => {
				if (b.rata_rata !== a.rata_rata) return b.rata_rata - a.rata_rata;
				if (b.total_nilai !== a.total_nilai) return b.total_nilai - a.total_nilai;
				return a.nama_lengkap.localeCompare(b.nama_lengkap);
			});

			// Berikan predikat juara
			const rankedClass = inClass.map((st, idx) => {
				const rank = idx + 1;
				let juaraBadge = '';
				let juaraLabel = '';

				if (rank === 1) {
					juaraBadge = 'JUARA_1';
					juaraLabel = `JUARA I KELAS ${k.nama_kelas}`;
				} else if (rank === 2) {
					juaraBadge = 'JUARA_2';
					juaraLabel = `JUARA II KELAS ${k.nama_kelas}`;
				} else if (rank === 3) {
					juaraBadge = 'JUARA_3';
					juaraLabel = `JUARA III KELAS ${k.nama_kelas}`;
				} else if (rank === 4) {
					juaraBadge = 'HARAPAN_1';
					juaraLabel = `HARAPAN I KELAS ${k.nama_kelas}`;
				} else if (rank === 5) {
					juaraBadge = 'HARAPAN_2';
					juaraLabel = `HARAPAN II KELAS ${k.nama_kelas}`;
				} else {
					juaraBadge = 'PERINGKAT';
					juaraLabel = `PERINGKAT KE-${rank} KELAS ${k.nama_kelas}`;
				}

				return {
					...st,
					rank_kelas: rank,
					juara_badge: juaraBadge,
					juara_label: juaraLabel,
				};
			});

			// Ambil hanya 1-3 besar saja per kelas
			juaraKelasMap[k.nama_kelas] = rankedClass.slice(0, 3);
		});

		// 8. Hitung Juara Umum per Tingkat (VII, VIII, IX) - Top 3 Saja
		const hitungJuaraTingkat = (tingkat) => {
			const inTingkat = studentScores.filter((s) => s.tingkat === tingkat && s.rata_rata > 0);
			inTingkat.sort((a, b) => {
				if (b.rata_rata !== a.rata_rata) return b.rata_rata - a.rata_rata;
				if (b.total_nilai !== a.total_nilai) return b.total_nilai - a.total_nilai;
				return a.nama_lengkap.localeCompare(b.nama_lengkap);
			});

			return inTingkat.slice(0, 3).map((st, idx) => {
				const rank = idx + 1;
				let juaraBadge = '';
				let juaraLabel = '';

				if (rank === 1) {
					juaraBadge = 'JUARA_UMUM_1';
					juaraLabel = `JUARA UMUM I TINGKAT ${tingkat}`;
				} else if (rank === 2) {
					juaraBadge = 'JUARA_UMUM_2';
					juaraLabel = `JUARA UMUM II TINGKAT ${tingkat}`;
				} else if (rank === 3) {
					juaraBadge = 'JUARA_UMUM_3';
					juaraLabel = `JUARA UMUM III TINGKAT ${tingkat}`;
				}

				return {
					...st,
					rank_tingkat: rank,
					juara_badge: juaraBadge,
					juara_label: juaraLabel,
				};
			});
		};

		const juaraUmumTingkat7 = hitungJuaraTingkat('VII');
		const juaraUmumTingkat8 = hitungJuaraTingkat('VIII');
		const juaraUmumTingkat9 = hitungJuaraTingkat('IX');

		// 9. Hitung Juara Umum Keseluruhan Sekolah (Grand Champions) - Top 3 Saja
		const allValidStudents = [...studentScores].filter((s) => s.rata_rata > 0);
		allValidStudents.sort((a, b) => {
			if (b.rata_rata !== a.rata_rata) return b.rata_rata - a.rata_rata;
			if (b.total_nilai !== a.total_nilai) return b.total_nilai - a.total_nilai;
			return a.nama_lengkap.localeCompare(b.nama_lengkap);
		});

		const juaraUmumSekolah = allValidStudents.slice(0, 3).map((st, idx) => {
			const rank = idx + 1;
			let juaraBadge = '';
			let juaraLabel = '';

			if (rank === 1) {
				juaraBadge = 'JUARA_UMUM_SEKOLAH_1';
				juaraLabel = 'JUARA UMUM I SEKOLAH';
			} else if (rank === 2) {
				juaraBadge = 'JUARA_UMUM_SEKOLAH_2';
				juaraLabel = 'JUARA UMUM II SEKOLAH';
			} else if (rank === 3) {
				juaraBadge = 'JUARA_UMUM_SEKOLAH_3';
				juaraLabel = 'JUARA UMUM III SEKOLAH';
			}

			return {
				...st,
				rank_sekolah: rank,
				juara_badge: juaraBadge,
				juara_label: juaraLabel,
			};
		});

		return NextResponse.json({
			tahun_ajaran: tahunAjaran,
			semester,
			kelas_list: kelasList,
			juara_kelas_map: juaraKelasMap,
			juara_umum: {
				tingkat_7: juaraUmumTingkat7,
				tingkat_8: juaraUmumTingkat8,
				tingkat_9: juaraUmumTingkat9,
				sekolah: juaraUmumSekolah,
			},
			stats: {
				total_siswa: siswaList.length,
				total_dinilai: allValidStudents.length,
				total_kelas: kelasList.length,
				nilai_tertinggi: allValidStudents[0]?.rata_rata || 0,
			},
		});
	} catch (error) {
		console.error('Error GET /api/erapor/juara:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
