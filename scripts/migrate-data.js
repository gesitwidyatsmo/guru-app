import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const LOGGED_IN_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

const serviceAccountAuth = new JWT({
	email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
	key: LOGGED_IN_KEY,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function ensureUserExists(supabase, id_user) {
	if (!id_user) return;
	await supabase.from('users').upsert({
		id_user: id_user,
		username: id_user.toLowerCase(),
		nama_lengkap: `Pengguna ${id_user}`,
		role: 'Guru'
	}, { onConflict: 'id_user', ignoreDuplicates: true });
}

async function migrate() {
	console.log('🚀 Memulai migrasi data ke Supabase...');

	const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
	await doc.loadInfo();

	try {
		// --- 1. KELAS ---
		// console.log('\nMigrasi Kelas...');
		// const sheetKelas = doc.sheetsByTitle['MASTER_KELAS'];
		// if (sheetKelas) {
		// 	const rows = await sheetKelas.getRows();
		// 	for (const row of rows) {
		// 		const { error } = await supabase.from('kelas').upsert(
		// 			{
		// 				id: row.get('id') || Date.now().toString(),
		// 				nama_kelas: row.get('nama_kelas'),
		// 				wali_kelas: row.get('wali_kelas'),
		// 			},
		// 			{ onConflict: 'nama_kelas' },
		// 		);
		// 		if (error) console.error(`Error insert Kelas ${row.get('nama_kelas')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Kelas`);
		// }

		// --- 2. MAPEL ---
		// console.log('\nMigrasi Mapel...');
		// const sheetMapel = doc.sheetsByTitle['MASTER_MAPEL'];
		// if (sheetMapel) {
		// 	const rows = await sheetMapel.getRows();
		// 	for (const row of rows) {
		// 		const { error } = await supabase.from('mapel').upsert(
		// 			{
		// 				id: row.get('id') || Date.now().toString(),
		// 				mapel: row.get('mapel'),
		// 			},
		// 			{ onConflict: 'mapel' },
		// 		);
		// 		if (error) console.error(`Error insert Mapel ${row.get('mapel')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Mapel`);
		// }

		// --- 3. SISWA ---
		// console.log('\nMigrasi Siswa...');
		// const sheetSiswa = doc.sheetsByTitle['MASTER_SISWA'];
		// if (sheetSiswa) {
		// 	const rows = await sheetSiswa.getRows();
		// 	for (const row of rows) {
		// 		let jk = row.get('jenis_kelamin');
		// 		if (jk) {
		// 			jk = jk.trim().toUpperCase();
		// 			if (jk === 'L' || jk.startsWith('LAKI')) jk = 'Laki-laki';
		// 			else if (jk === 'P' || jk.startsWith('PEREMPUAN')) jk = 'Perempuan';
		// 			else jk = null;
		// 		} else {
		// 			jk = null;
		// 		}

		// 		const { error } = await supabase.from('siswa').upsert({
		// 			id: row.get('id'),
		// 			nis: row.get('nis') || null,
		// 			nama_lengkap: row.get('nama_lengkap'),
		// 			kelas: row.get('kelas') || null,
		// 			jenis_kelamin: jk,
		// 			status: row.get('status') || 'Aktif',
		// 		}, { onConflict: 'id' });
		// 		if (error) console.error(`Error insert Siswa ${row.get('nama_lengkap')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Siswa`);
		// }

		// --- 4. JADWAL & GURU_KBM (Diekstrak dari MASTER_JADWAL) ---
		// console.log('\nMigrasi Jadwal & Guru KBM...');
		// const sheetJadwal = doc.sheetsByTitle['MASTER_JADWAL'];
		// if (sheetJadwal) {
		// 	const rows = await sheetJadwal.getRows();
		// 	let kbmCount = 0;
		// 	for (const row of rows) {
		// 		const mapel = row.get('jadwal_data');
		// 		let parsed = [];
		// 		try {
		// 			parsed = JSON.parse(mapel || '[]');
		// 		} catch (e) {}

		// 		const guruId = row.get('id_user');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		for (const item of parsed) {
		// 			// Extract KBM (Unik untuk setiap kombinasi guru, kelas, mapel)
		// 			if (guruId && item.kelas && item.mapel) {
		// 				const idKbm = `KBM-${guruId}-${item.kelas}-${item.mapel}`.replace(/\s+/g, '-');
		// 				const { error: errKbm } = await supabase.from('guru_kbm').upsert(
		// 					{
		// 						id_kbm: idKbm,
		// 						id_user: guruId,
		// 						kelas: item.kelas,
		// 						mapel: item.mapel,
		// 					},
		// 					{ onConflict: 'id_kbm' },
		// 				);
		// 				if (!errKbm) kbmCount++;
		// 				else console.error(`Error insert KBM ${idKbm}:`, errKbm.message);
		// 			}

		// 			// Insert Jadwal (Gunakan ID yang tetap berdasarkan guru, hari, dan jam agar bisa di-upsert berulang kali)
		// 			const jadId = `JDW-${guruId}-${item.hari}-${item.jam_ke}`.replace(/\s+/g, '-');
		// 			const { error } = await supabase.from('jadwal').upsert({
		// 				id: jadId,
		// 				id_user: guruId || null,
		// 				mapel: item.mapel,
		// 				kelas: item.kelas,
		// 				hari: item.hari,
		// 				jam_ke: item.jam_ke,
		// 				jam_mulai: item.jam_mulai || '',
		// 				jam_selesai: item.jam_selesai || '',
		// 			});
		// 			if (error) console.error(`Error insert Jadwal:`, error.message);
		// 		}
		// 	}
		// 	console.log(`✅ Selesai migrasi Jadwal dan ${kbmCount} data Guru KBM`);
		// }

		// --- 5. ABSENSI (Harian) ---
		// console.log('\nMigrasi Absensi Harian...');
		// const sheetAbsensi = doc.sheetsByTitle['MASTER_ABSENSI_HARIAN'];
		// if (sheetAbsensi) {
		// 	const rows = await sheetAbsensi.getRows();
		// 	for (const row of rows) {
		// 		const sesiId = row.get('id');

		// 		await supabase.from('absensi_harian').upsert(
		// 			{
		// 				sesi_id: sesiId,
		// 				tanggal: row.get('tanggal'),
		// 				kelas: row.get('kelas'),
		// 			},
		// 			{ onConflict: 'sesi_id' },
		// 		);

		// 		let dataAbs = [];
		// 		try {
		// 			dataAbs = JSON.parse(row.get('data_absensi') || '[]');
		// 		} catch (e) {}

		// 		for (const item of dataAbs) {
		// 			await supabase.from('absensi_harian_siswa').upsert({
		// 				sesi_id: sesiId,
		// 				siswa_id: item.siswa_id,
		// 				status: item.status,
		// 				keterangan: item.keterangan || '',
		// 			});
		// 		}
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Sesi Absensi Harian`);
		// }

		// --- 6. ABSENSI (Mapel) ---
		// console.log('\nMigrasi Absensi Mapel...');
		// const sheetAbsensiMapel = doc.sheetsByTitle['MASTER_ABSENSI_MAPEL'];
		// if (sheetAbsensiMapel) {
		// 	const rows = await sheetAbsensiMapel.getRows();
		// 	for (const row of rows) {
		// 		const sesiId = row.get('id');
		// 		const guruId = row.get('guru_id');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		await supabase.from('absensi_mapel').upsert(
		// 			{
		// 				sesi_id: sesiId,
		// 				guru_id: guruId || null,
		// 				tanggal: row.get('tanggal'),
		// 				jam_ke: row.get('jam_ke'),
		// 				kelas: row.get('kelas'),
		// 				mapel: row.get('mapel'),
		// 			},
		// 			{ onConflict: 'sesi_id' },
		// 		);

		// 		let dataAbs = [];
		// 		try {
		// 			dataAbs = JSON.parse(row.get('data_absensi') || '[]');
		// 		} catch (e) {}

		// 		for (const item of dataAbs) {
		// 			await supabase.from('absensi_mapel_siswa').upsert({
		// 				sesi_id: sesiId,
		// 				siswa_id: item.siswa_id,
		// 				status: item.status,
		// 				keterangan: item.keterangan || '',
		// 			});
		// 		}
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Sesi Absensi Mapel`);
		// }

		// --- 7. NILAI ---
		// console.log('\nMigrasi Nilai...');
		// const sheetNilai = doc.sheetsByTitle['MASTER_NILAI'];
		// if (sheetNilai) {
		// 	const rows = await sheetNilai.getRows();
		// 	for (const row of rows) {
		// 		const tugasId = row.get('id');
		// 		const guruId = row.get('guru_id');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		await supabase.from('nilai_tugas').upsert(
		// 			{
		// 				tugas_id: tugasId,
		// 				guru_id: guruId || null,
		// 				kategori: row.get('kategori'),
		// 				type: row.get('type') || '',
		// 				deskripsi: row.get('deskripsi') || '',
		// 				kelas: row.get('kelas'),
		// 				mapel: row.get('mapel'),
		// 				tanggal: row.get('tanggal'),
		// 			},
		// 			{ onConflict: 'tugas_id' },
		// 		);

		// 		let dataNil = [];
		// 		try {
		// 			dataNil = JSON.parse(row.get('data_nilai') || '[]');
		// 		} catch (e) {}

		// 		for (const item of dataNil) {
		// 			await supabase.from('nilai_siswa').upsert({
		// 				tugas_id: tugasId,
		// 				siswa_id: item.siswa_id,
		// 				nama_siswa: item.nama_siswa || '',
		// 				nilai: item.nilai,
		// 			});
		// 		}
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Tugas Nilai`);
		// }

		// --- 8. JURNAL ---
		// console.log('\nMigrasi Jurnal...');
		// const sheetJurnal = doc.sheetsByTitle['MASTER_JURNAL'];
		// if (sheetJurnal) {
		// 	const rows = await sheetJurnal.getRows();
		// 	for (const row of rows) {
		// 		const guruId = row.get('id_user') || row.get('guru_id');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		const { error } = await supabase.from('jurnal').upsert(
		// 			{
		// 				id: row.get('id'),
		// 				guru_id: guruId || null,
		// 				tanggal: row.get('tanggal'),
		// 				jam_ke: row.get('jam_ke'),
		// 				pertemuan_ke: row.get('pertemuan_ke') || '',
		// 				kelas: row.get('kelas'),
		// 				mapel: row.get('mapel'),
		// 				materi: row.get('materi'),
		// 				kegiatan: row.get('kegiatan'),
		// 				hambatan: row.get('hambatan') || '',
		// 				solusi: row.get('solusi') || '',
		// 				tuntas: row.get('tuntas') === 'true' || row.get('tuntas') === 'TRUE',
		// 			},
		// 			{ onConflict: 'id' },
		// 		);
		// 		if (error) console.error(`Error insert Jurnal ${row.get('id')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Jurnal`);
		// }

		// --- 9. POIN ---
		// console.log('\nMigrasi Poin...');
		// const sheetPoin = doc.sheetsByTitle['MASTER_POIN'];
		// if (sheetPoin) {
		// 	const rows = await sheetPoin.getRows();
		// 	for (const row of rows) {
		// 		const guruId = row.get('guru_id');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		const { error } = await supabase.from('poin').upsert(
		// 			{
		// 				id: row.get('id'),
		// 				siswa_id: row.get('siswa_id'),
		// 				guru_id: guruId || null,
		// 				tanggal: row.get('tanggal'),
		// 				tipe: row.get('tipe'),
		// 				kategori: row.get('kategori'),
		// 				aktifitas: row.get('aktifitas'),
		// 				poin: parseInt(row.get('poin') || '0', 10),
		// 				keterangan: row.get('keterangan') || '',
		// 			},
		// 			{ onConflict: 'id' },
		// 		);
		// 		if (error) console.error(`Error insert Poin ${row.get('id')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Poin`);
		// }

		// --- 10. GRUP ---
		// console.log('\nMigrasi Grup...');
		// const sheetGrup = doc.sheetsByTitle['MASTER_GRUP'];
		// if (sheetGrup) {
		// 	const rows = await sheetGrup.getRows();
		// 	for (const row of rows) {
		// 		const guruId = row.get('guru_id');
		// 		if (guruId) await ensureUserExists(supabase, guruId);

		// 		let parsedJson = [];
		// 		try {
		// 			parsedJson = JSON.parse(row.get('data_json') || '[]');
		// 		} catch (e) {}

		// 		const { error } = await supabase.from('grup').upsert(
		// 			{
		// 				id: row.get('id'),
		// 				guru_id: guruId || null,
		// 				judul_kegiatan: row.get('judul_kegiatan'),
		// 				kelas_id: row.get('kelas_id'),
		// 				mapel_id: row.get('mapel_id'),
		// 				tanggal: row.get('tanggal'),
		// 				data_json: parsedJson,
		// 			},
		// 			{ onConflict: 'id' },
		// 		);
		// 		if (error) console.error(`Error insert Grup ${row.get('id')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Grup`);
		// }

		// --- 11. TUGAS ONLINE (Data_Tugas) ---
		// console.log('\nMigrasi Tugas Online...');
		// const sheetDataTugas = doc.sheetsByTitle['Data_Tugas'];
		// if (sheetDataTugas) {
		// 	const rows = await sheetDataTugas.getRows();
		// 	for (const row of rows) {
		// 		let parsedSoal = [];
		// 		try {
		// 			parsedSoal = JSON.parse(row.get('Soal') || '[]');
		// 		} catch (e) {}

		// 		const { error } = await supabase.from('tugas_online').upsert(
		// 			{
		// 				id: row.get('ID') || Date.now().toString(),
		// 				pin: row.get('PIN'),
		// 				judul: row.get('Judul'),
		// 				mapel: row.get('Mapel'),
		// 				materi: row.get('Materi'),
		// 				tipe_soal: row.get('Tipe_Soal'),
		// 				soal: parsedSoal,
		// 				created_by: row.get('CreatedBy'),
		// 				created_at: row.get('CreatedAt'),
		// 			},
		// 			{ onConflict: 'id' },
		// 		);
		// 		if (error) console.error(`Error insert Tugas Online ${row.get('PIN')}:`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Tugas Online`);
		// }

		// --- 12. PENGUMPULAN TUGAS (Pengumpulan_Tugas) ---
		// console.log('\nMigrasi Pengumpulan Tugas...');
		// const sheetPengumpulan = doc.sheetsByTitle['Pengumpulan_Tugas'];
		// if (sheetPengumpulan) {
		// 	const rows = await sheetPengumpulan.getRows();
		// 	for (const row of rows) {
		// 		let nilaiNum = parseFloat(row.get('Nilai'));
		// 		if (isNaN(nilaiNum)) nilaiNum = null;

		// 		// Parse format "25/5/2026, 20.05.44"
		// 		let waktu = row.get('Waktu');
		// 		let parsedWaktu = new Date().toISOString();
		// 		if (waktu) {
		// 			try {
		// 				if (waktu.includes(', ')) {
		// 					const [dStr, tStr] = waktu.split(', ');
		// 					const [day, month, year] = dStr.split('/');
		// 					const [hour, min, sec] = tStr.split('.');
		// 					const d = new Date(year, month - 1, day, hour, min, sec);
		// 					if (!isNaN(d.getTime())) parsedWaktu = d.toISOString();
		// 				} else {
		// 					const d = new Date(waktu);
		// 					if (!isNaN(d.getTime())) parsedWaktu = d.toISOString();
		// 				}
		// 			} catch (e) {
		// 				// Biarkan pakai fallback waktu sekarang jika gagal
		// 			}
		// 		}

		// 		const { error } = await supabase.from('pengumpulan_tugas').insert({
		// 			waktu: parsedWaktu,
		// 			pin: row.get('PIN'),
		// 			kelas: row.get('Kelas'),
		// 			nama_siswa: row.get('Nama_Siswa'),
		// 			no_absen: String(row.get('No_Absen') || ''),
		// 			jawaban_teks: row.get('Jawaban_Teks') || '',
		// 			link_file: row.get('Link_File') || '',
		// 			nilai: nilaiNum,
		// 		});
		// 		if (error) console.error(`Error insert Pengumpulan Tugas (PIN: ${row.get('PIN')} - Siswa: ${row.get('Nama_Siswa')}):`, error.message);
		// 	}
		// 	console.log(`✅ Selesai migrasi ${rows.length} Pengumpulan Tugas`);
		// }

		console.log('\n🎉 MIGRASI SELESAI SELURUHNYA!');
	} catch (error) {
		console.error('❌ Terjadi kesalahan saat migrasi:', error);
	}
}

migrate();
