import { NextResponse } from 'next/server';
import { getSheet, getOrCreateSheet } from '@/lib/sheets';
import { uploadFileToSupabase } from '@/lib/supabase';

const SUBMIT_HEADERS = ['Waktu', 'PIN', 'Kelas', 'Nama_Siswa', 'No_Absen', 'Jawaban_Teks', 'Link_File', 'Nilai'];

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

		const doc = await getSheet();

		let finalJawabanTeks = jawabanTeks;
		let finalNilai = '';
		let calculatedScore = null;

		if (tipeSoal === 'PG') {
			// Auto-grading logic
			const taskSheet = await getOrCreateSheet(doc, 'Data_Tugas', ['ID', 'PIN', 'Judul', 'Mapel', 'Materi', 'Tipe_Soal', 'Soal', 'CreatedAt', 'CreatedBy']);
			const taskRows = await taskSheet.getRows();
			const taskRow = taskRows.find(r => r.get('PIN') === pin.toUpperCase());

			if (taskRow) {
				const soalJson = taskRow.get('Soal');
				let parsedSoal = [];
				try {
					parsedSoal = JSON.parse(soalJson);
				} catch(e) {}

				let jawabanPG = {};
				try {
					jawabanPG = JSON.parse(jawabanPGStr);
				} catch(e) {}

				let totalPoints = 0;
				const totalSoal = parsedSoal.length;
				let detailJawabanArr = []; // Array untuk menampung riwayat jawaban

				parsedSoal.forEach((soal, index) => {
					const studentAnswers = jawabanPG[soal.id] || [];
					
					// Merekam pilihan siswa (mengubah 0 jadi A, 1 jadi B, dsb)
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
						totalPoints += 1; // Jika anomali soal tanpa kunci, berikan poin gratis
						return;
					}

					let selectedCorrectly = 0;

					studentAnswers.forEach(ans => {
						if (correctAnswers.includes(ans)) {
							selectedCorrectly++;
						}
					});

					const numSelected = studentAnswers.length;
					let excessPenalty = 0;
					
					// Jika siswa mencentang LEBIH BANYAK opsi dari jumlah kunci, 
					// maka kelebihan centangan tersebut akan menjadi penalti
					if (numSelected > totalCorrect) {
						excessPenalty = numSelected - totalCorrect;
					}

					// Rumus: (Benar - Penalti Kelebihan) / Total Kunci
					let questionScore = (selectedCorrectly - excessPenalty) / totalCorrect;
					
					// Batasi agar nilai soal ini tidak minus (minimal 0)
					if (questionScore < 0) questionScore = 0;

					totalPoints += questionScore;
				});

				if (totalSoal > 0) {
					calculatedScore = Math.round((totalPoints / totalSoal) * 100);
					finalNilai = calculatedScore.toString();
					
					// Teks jawaban yang disimpan di Sheets adalah jejak pilihan siswa
					finalJawabanTeks = detailJawabanArr.join(' | ');
				}
			}
		}

		const sheet = await getOrCreateSheet(doc, 'Pengumpulan_Tugas', SUBMIT_HEADERS);

		const newRow = {
			Waktu: new Date().toLocaleString('id-ID'),
			PIN: pin.toUpperCase(),
			Kelas: kelas,
			Nama_Siswa: namaSiswa,
			No_Absen: noAbsen,
			Jawaban_Teks: finalJawabanTeks,
			Link_File: linkFile,
			Nilai: finalNilai,
		};

		await sheet.addRow(newRow);

		if (calculatedScore !== null) {
			return NextResponse.json({ success: true, message: 'Tugas berhasil dikumpulkan!', nilai: calculatedScore });
		}

		return NextResponse.json({ success: true, message: 'Tugas berhasil dikumpulkan!' });
	} catch (error) {
		console.error('API Submit Error:', error);
		return NextResponse.json({ error: 'Gagal mengirim tugas. ' + error.message }, { status: 500 });
	}
}
