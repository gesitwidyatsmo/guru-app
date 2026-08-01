import { NextResponse } from 'next/server';
import { uploadFileToSupabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(request) {
	try {
		const formData = await request.formData();
		const pin = formData.get('pin');
		const kelas = formData.get('kelas') || '-';
		const namaSiswa = formData.get('namaSiswa');
		const noAbsen = formData.get('noAbsen');
		const jawabanTeks = formData.get('jawabanTeks') || '';
		const tipeSoal = formData.get('tipeSoal') || '';
		const jawabanPGStr = formData.get('jawabanPG') || '{}';
		const file = formData.get('file');
		const siswaId = formData.get('siswa_id');

		if (!pin || !namaSiswa || !noAbsen) {
			return NextResponse.json({ error: 'Data wajib (PIN, Nama, Absen) tidak lengkap' }, { status: 400 });
		}

		let linkFile = '';

		// Upload file to Supabase Storage if provided
		if (file && file.size > 0) {
			const sanitizedNama = namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
			const sanitizedFile = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
			const cleanFileName = `${noAbsen}_${sanitizedNama}_${sanitizedFile}`;
			const filePath = `${pin.toUpperCase()}/${cleanFileName}`;
			
			// Supabase JS library accepts File objects natively
			linkFile = await uploadFileToSupabase('tugas-siswa', filePath, file, file.type);
		}

		const supabase = supabaseAdmin;

		let finalJawabanTeks = jawabanTeks;
		let finalNilai = null;
		let calculatedScore = null;

		// Fetch Tugas Data for grading and syncing
		const { data: taskRow, error: taskError } = await supabase
			.from('tugas_online')
			.select('*')
			.eq('pin', pin.toUpperCase())
			.single();

		let parsedTaskSoal = null;
		try {
			parsedTaskSoal = typeof taskRow?.soal === 'string' ? JSON.parse(taskRow?.soal) : taskRow?.soal;
		} catch(e) {}

		const taskMapel = taskRow?.mapel || '-';
		const taskJudul = taskRow?.judul || `Tugas ${pin}`;
		const taskKategori = parsedTaskSoal?.kategori || 'Formatif';
		const taskType = parsedTaskSoal?.type || 'Tugas Online';

		if (tipeSoal === 'PG') {
			if (!taskError && taskRow) {
				const soalJson = taskRow.soal;
				let parsedSoal = [];
				try {
					parsedSoal = typeof soalJson === 'string' ? JSON.parse(soalJson) : soalJson;
					if (parsedSoal && parsedSoal._wrapper) parsedSoal = parsedSoal.data;
				} catch(e) {}

				let jawabanPG = {};
				try {
					jawabanPG = JSON.parse(jawabanPGStr);
				} catch(e) {}

				let totalPoints = 0;
				const totalSoal = parsedSoal.length;
				let detailJawabanArr = [];

				parsedSoal.forEach((soal, index) => {
					const studentAnswers = jawabanPG[soal.id] || [];
					
					if (studentAnswers.length === 0) {
						detailJawabanArr.push(`${index + 1}: Kosong`);
					} else {
						const selectedLetters = [...studentAnswers]
							.sort()
							.map(idx => String.fromCharCode(65 + idx))
							.join(', ');
						detailJawabanArr.push(`${index + 1}: ${selectedLetters}`);
					}

					const correctAnswers = Array.isArray(soal.jawabanBenar) 
						? soal.jawabanBenar 
						: (soal.jawabanBenar !== undefined && soal.jawabanBenar !== null ? [soal.jawabanBenar] : []);
					
					const totalCorrect = correctAnswers.length;
					
					if (totalCorrect === 0) {
						totalPoints += 1;
						return;
					}

					let selectedCorrectly = 0;
					studentAnswers.forEach(ans => {
						if (correctAnswers.includes(ans)) selectedCorrectly++;
					});

					const numSelected = studentAnswers.length;
					let excessPenalty = 0;
					
					if (numSelected > totalCorrect) {
						excessPenalty = numSelected - totalCorrect;
					}

					let questionScore = (selectedCorrectly - excessPenalty) / totalCorrect;
					if (questionScore < 0) questionScore = 0;

					totalPoints += questionScore;
				});

				if (totalSoal > 0) {
					calculatedScore = Math.round((totalPoints / totalSoal) * 100);
					finalNilai = calculatedScore;
					finalJawabanTeks = detailJawabanArr.join(' | ');
				}
			}
		} else if (tipeSoal === 'Essai') {
			let parsedSoal = [];
			if (taskRow && taskRow.soal) {
				try {
					parsedSoal = typeof taskRow.soal === 'string' ? JSON.parse(taskRow.soal) : taskRow.soal;
					if (parsedSoal && parsedSoal._wrapper) parsedSoal = parsedSoal.data;
				} catch(e) {}
			}

			let jawabanEssai = {};
			try {
				jawabanEssai = JSON.parse(formData.get('jawabanEssai') || '{}');
			} catch(e) {}

			let detailJawabanArr = [];
			parsedSoal.forEach((soal, index) => {
				const ans = jawabanEssai[soal.id] || 'Kosong';
				detailJawabanArr.push(`[No. ${index + 1}]\n${ans}`);
			});
			
			finalJawabanTeks = detailJawabanArr.join('\n\n');
		} else if (tipeSoal === 'Gabungan') {
			let parsedPG = [];
			let parsedEssai = [];
			if (taskRow && taskRow.soal) {
				try {
					const soalJson = typeof taskRow.soal === 'string' ? JSON.parse(taskRow.soal) : taskRow.soal;
					const dataSoal = (soalJson && soalJson._wrapper) ? soalJson.data : soalJson;
					parsedPG = dataSoal.pg || [];
					parsedEssai = dataSoal.essai || [];
				} catch(e) {}
			}

			let jawabanPG = {};
			let jawabanEssai = {};
			try {
				jawabanPG = JSON.parse(jawabanPGStr);
				jawabanEssai = JSON.parse(formData.get('jawabanEssai') || '{}');
			} catch(e) {}

			let totalPoints = 0;
			const totalSoal = parsedPG.length;
			let detailJawabanArrPG = [];

			parsedPG.forEach((soal, index) => {
				const studentAnswers = jawabanPG[soal.id] || [];
				if (studentAnswers.length === 0) {
					detailJawabanArrPG.push(`${index + 1}: Kosong`);
				} else {
					const selectedLetters = [...studentAnswers]
						.sort()
						.map(idx => String.fromCharCode(65 + idx))
						.join(', ');
					detailJawabanArrPG.push(`${index + 1}: ${selectedLetters}`);
				}

				const correctAnswers = Array.isArray(soal.jawabanBenar) ? soal.jawabanBenar : (soal.jawabanBenar !== undefined && soal.jawabanBenar !== null ? [soal.jawabanBenar] : []);
				const totalCorrect = correctAnswers.length;
				
				if (totalCorrect === 0) {
					totalPoints += 1;
					return;
				}

				let selectedCorrectly = 0;
				studentAnswers.forEach(ans => { if (correctAnswers.includes(ans)) selectedCorrectly++; });
				let excessPenalty = studentAnswers.length > totalCorrect ? studentAnswers.length - totalCorrect : 0;
				let questionScore = (selectedCorrectly - excessPenalty) / totalCorrect;
				if (questionScore < 0) questionScore = 0;
				totalPoints += questionScore;
			});

			if (totalSoal > 0) {
				calculatedScore = Math.round((totalPoints / totalSoal) * 100);
			} else {
				calculatedScore = 0;
			}

			let detailJawabanArrEssai = [];
			parsedEssai.forEach((soal, index) => {
				const ans = jawabanEssai[soal.id] || 'Kosong';
				detailJawabanArrEssai.push(`[Essai No. ${index + 1}]\n${ans}`);
			});

			finalJawabanTeks = `[NILAI PG: ${calculatedScore}]\n\n--- Jawaban Pilihan Ganda ---\n${detailJawabanArrPG.join(' | ')}\n\n--- Jawaban Essai ---\n${detailJawabanArrEssai.join('\n\n')}`;
			finalNilai = null; // Menunggu guru mengkoreksi totalnya
		}

		const { error } = await supabase.from('pengumpulan_tugas').insert({
			pin: pin.toUpperCase(),
			siswa_id: siswaId || null,
			kelas: kelas,
			nama_siswa: namaSiswa,
			no_absen: String(noAbsen),
			jawaban_teks: finalJawabanTeks,
			link_file: linkFile,
			nilai: finalNilai,
		});

		if (error) {
			console.error('Supabase Insert Error:', error);
			throw error;
		}

		// Auto Sync Nilai ke nilai_tugas + nilai_siswa jika PG dan ada siswaId
		// Opsi A: Satu header per kelas — TGS-ONLINE-{PIN}-{KELAS}
		if (finalNilai !== null) {
			if (!siswaId) {
				console.warn(`[Auto-Sync] siswa_id tidak ada untuk PIN ${pin}, kelas ${kelas}. Sinkronisasi dilewati.`);
			} else {
				const kelasKey = (kelas && kelas !== '-') ? kelas : 'UMUM';
				const tugasId = `TGS-ONLINE-${pin.toUpperCase()}-${kelasKey}`;
				
				let trueGuruId = null;
				if (taskRow?.created_by) {
					if (taskRow.created_by.startsWith('UID-')) {
						trueGuruId = taskRow.created_by;
					} else {
						const { data: guruData } = await supabase.from('users').select('id_user').eq('nama_lengkap', taskRow.created_by).single();
						if (guruData) trueGuruId = guruData.id_user;
					}
				}

				// Upsert Header (nilai_tugas) — satu per kelas
				const { error: headerError } = await supabase.from('nilai_tugas').upsert({
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
				} else {
					// Upsert Student Score (nilai_siswa)
					const { error: detailError } = await supabase.from('nilai_siswa').upsert({
						tugas_id: tugasId,
						siswa_id: siswaId,
						nama_siswa: namaSiswa,
						nilai: finalNilai
					}, {
						onConflict: 'tugas_id, siswa_id'
					});
					if (detailError) console.error('[Auto-Sync] Gagal sinkron detail nilai_siswa:', detailError);
				}
			}
		}

		if (calculatedScore !== null) {
			return NextResponse.json({ success: true, message: 'Tugas berhasil dikumpulkan!', nilai: calculatedScore });
		}

		return NextResponse.json({ success: true, message: 'Tugas berhasil dikumpulkan!' });
	} catch (error) {
		console.error('API Submit Error:', error);
		return NextResponse.json({ error: 'Gagal mengirim tugas. ' + error.message }, { status: 500 });
	}
}
