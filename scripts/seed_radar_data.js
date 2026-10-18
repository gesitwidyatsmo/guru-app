/**
 * SCRIPT SEED DATA ABSENSI RADAR KESISWAAN (11 - 18 OKTOBER 2026)
 * 
 * Script ini:
 * 1. Mengambil seluruh data siswa aktif dari Supabase.
 * 2. Menghasilkan skrip SQL lengkap di `sql/seed_radar_absensi_11_18_okt.sql`.
 * 3. Menginput langsung data absensi ke Supabase agar Radar Absensi & Bolos
 *    langsung berfungsi dan dapat diuji secara live.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
	console.error('Error: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan.');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

// Daftar tanggal: 11 - 18 Oktober 2026
const DATES = [
	'2026-10-11',
	'2026-10-12',
	'2026-10-13',
	'2026-10-14',
	'2026-10-15',
	'2026-10-16',
	'2026-10-17',
	'2026-10-18', // Hari Ini
];

const MAPEL_SESSIONS = [
	{ jam: '1-2', mapel: 'MTK', guru_id: 'UID-SMP-03' },
	{ jam: '3-4', mapel: 'IPA', guru_id: 'UID-SMP-05' },
	{ jam: '5-6', mapel: 'B.INDO', guru_id: 'UID-SMP-07' },
	{ jam: '7-8', mapel: 'PJOK', guru_id: 'UID-SMP-08' },
];

async function main() {
	console.log('--- MEMULAI PEMBUATAN SEED DATA ABSENSI RADAR KESISWAAN ---');

	// 1. Ambil seluruh siswa aktif dikelompokkan per kelas
	const { data: allSiswa, error: errSiswa } = await supabase
		.from('siswa')
		.select('id, nama_lengkap, kelas, nis')
		.eq('status', 'Aktif')
		.order('kelas', { ascending: true })
		.order('nama_lengkap', { ascending: true });

	if (errSiswa || !allSiswa || allSiswa.length === 0) {
		console.error('Gagal mengambil data siswa:', errSiswa?.message);
		process.exit(1);
	}

	console.log(`Ditemukan ${allSiswa.length} siswa aktif.`);

	// Grouping siswa per kelas
	const kelasGroup = {};
	allSiswa.forEach((s) => {
		if (!kelasGroup[s.kelas]) kelasGroup[s.kelas] = [];
		kelasGroup[s.kelas].push(s);
	});

	const kelasNames = Object.keys(kelasGroup);
	console.log(`Ditemukan ${kelasNames.length} rombel kelas.`);

	// Tentukan 5 Siswa untuk Skenario ALFA KRONIS (13 - 18 Oktober)
	const kronisStudents = [
		allSiswa.find((s) => s.kelas === 'VII.C'),
		allSiswa.find((s) => s.kelas === 'VIII.B'),
		allSiswa.find((s) => s.kelas === 'IX.C'),
		allSiswa.find((s) => s.kelas === 'VII.E'),
		allSiswa.find((s) => s.kelas === 'VIII.G'),
	].filter(Boolean);

	const kronisIds = new Set(kronisStudents.map((s) => s.id));
	console.log(`Siswa Kasus Alfa Kronis:`, kronisStudents.map((s) => `${s.nama_lengkap} (${s.kelas})`));

	// Tentukan 8 Siswa untuk Skenario BOLOS MAPEL (CABUT) pada tanggal 18 Oktober
	const bolosStudentsToday = [
		allSiswa.find((s) => s.kelas === 'VII.A'),
		allSiswa.find((s) => s.kelas === 'VII.B'),
		allSiswa.find((s) => s.kelas === 'VIII.A'),
		allSiswa.find((s) => s.kelas === 'VIII.C'),
		allSiswa.find((s) => s.kelas === 'VIII.F'),
		allSiswa.find((s) => s.kelas === 'IX.A'),
		allSiswa.find((s) => s.kelas === 'IX.B'),
		allSiswa.find((s) => s.kelas === 'IX.D'),
	].filter(Boolean);

	const bolosTodayIds = new Set(bolosStudentsToday.map((s) => s.id));
	console.log(`Siswa Kasus Bolos Mapel Hari Ini:`, bolosStudentsToday.map((s) => `${s.nama_lengkap} (${s.kelas})`));

	// Container untuk SQL dan insert langsung
	const harianSessions = [];
	const harianDetails = [];
	const mapelSessions = [];
	const mapelDetails = [];

	let sqlContent = `-- ===========================================================================\n`;
	sqlContent += `-- SEED DATA ABSENSI & RADAR BOLOS (11 - 18 OKTOBER 2026)\n`;
	sqlContent += `-- Dibuat khusus untuk pengujian Radar Absensi dan Deteksi Bolos Kesiswaan\n`;
	sqlContent += `-- ===========================================================================\n\n`;
	sqlContent += `BEGIN;\n\n`;

	// Bersihkan data absensi 11 - 18 Oktober terdahulu jika ada (agar idempotent)
	sqlContent += `-- 1. Hapus sesi absensi harian & mapel periode 11 - 18 Oktober jika ada sebelumnya\n`;
	sqlContent += `DELETE FROM public.absensi_harian WHERE tanggal >= '2026-10-11' AND tanggal <= '2026-10-18';\n`;
	sqlContent += `DELETE FROM public.absensi_mapel WHERE tanggal >= '2026-10-11' AND tanggal <= '2026-10-18';\n\n`;

	console.log('Menghapus data absensi 11-18 Oktober lama dari database...');
	await supabase.from('absensi_harian').delete().gte('tanggal', '2026-10-11').lte('tanggal', '2026-10-18');
	await supabase.from('absensi_mapel').delete().gte('tanggal', '2026-10-11').lte('tanggal', '2026-10-18');

	// Loop setiap tanggal
	for (const tanggal of DATES) {
		const isToday = tanggal === '2026-10-18';
		const isRecent = tanggal >= '2026-10-16';

		for (const kelas of kelasNames) {
			const students = kelasGroup[kelas] || [];
			const cleanKls = kelas.replace(/[^a-zA-Z0-9]/g, '_');

			// --- A. ABSENSI HARIAN ROMBEL ---
			const sesiHarianId = `ABSH-${cleanKls}-${tanggal}`;
			harianSessions.push({
				sesi_id: sesiHarianId,
				tanggal,
				kelas,
				tahun_ajar: '2026/2027',
				semester: 1,
			});

			students.forEach((s, idx) => {
				let status = 'Hadir';
				let keterangan = '';

				// Cek apakah siswa kasus kronis
				if (kronisIds.has(s.id) && tanggal >= '2026-10-13') {
					status = 'Alfa';
					keterangan = 'Tanpa keterangan (berulang)';
				}
				// Cek apakah siswa kasus bolos hari ini
				else if (isToday && bolosTodayIds.has(s.id)) {
					status = 'Hadir'; // Tercatat hadir di pagi hari!
					keterangan = 'Hadir pagi';
				}
				// Siswa normal acak: sebagian kecil izin/sakit/alfa
				else {
					if (idx === 2) {
						status = 'Sakit';
						keterangan = 'Surat dokter';
					} else if (idx === 5) {
						status = 'Izin';
						keterangan = 'Acara keluarga';
					} else if (idx === 8 && !isToday) {
						status = 'Alfa';
						keterangan = 'Tanpa keterangan';
					}
				}

				harianDetails.push({
					sesi_id: sesiHarianId,
					siswa_id: s.id,
					status,
					keterangan,
				});
			});

			// --- B. ABSENSI MAPEL (Untuk hari 16, 17, dan 18 Oktober) ---
			if (isRecent) {
				MAPEL_SESSIONS.forEach((ses, sesIdx) => {
					const sesiMapelId = `ABSM-${cleanKls}-${tanggal}-J${ses.jam.replace('-', '_')}`;
					mapelSessions.push({
						sesi_id: sesiMapelId,
						guru_id: ses.guru_id,
						tanggal,
						jam_ke: ses.jam,
						kelas,
						mapel: ses.mapel,
						tahun_ajar: '2026/2027',
						semester: 1,
					});

					students.forEach((s) => {
						let st = 'Hadir';
						let ket = '';

						// Siswa kronis alfa seharian
						if (kronisIds.has(s.id) && tanggal >= '2026-10-13') {
							st = 'Alfa';
							ket = 'Tidak masuk kelas';
						}
						// Siswa bolos cabut hari ini (18 Okt)
						else if (isToday && bolosTodayIds.has(s.id)) {
							// Hadir di sesi jam 1-2, tapi ALFA di sesi jam 3-4 atau 5-6!
							if (sesIdx === 1 || sesIdx === 2) {
								st = 'Alfa';
								ket = 'Tidak ada di kelas saat jam pelajaran (terindikasi bolos)';
							} else {
								st = 'Hadir';
							}
						}
						// Siswa bolos tanggal 17 Okt untuk variasi
						else if (tanggal === '2026-10-17' && (s.id === 'SIS-0010' || s.id === 'SIS-0050')) {
							if (sesIdx === 2) {
								st = 'Alfa';
								ket = 'Bolos jam ke-5';
							}
						}
						// Siswa sakit/izin di harian tetap konsisten di mapel
						else {
							const harianRecord = harianDetails.find(
								(hd) => hd.sesi_id === sesiHarianId && hd.siswa_id === s.id
							);
							if (harianRecord && harianRecord.status !== 'Hadir') {
								st = harianRecord.status;
								ket = harianRecord.keterangan;
							}
						}

						mapelDetails.push({
							sesi_id: sesiMapelId,
							siswa_id: s.id,
							status: st,
							keterangan: ket,
						});
					});
				});
			}
		}
	}

	console.log(`Total Sesi Harian yang dibuat: ${harianSessions.length}`);
	console.log(`Total Detail Siswa Harian: ${harianDetails.length}`);
	console.log(`Total Sesi Mapel yang dibuat: ${mapelSessions.length}`);
	console.log(`Total Detail Siswa Mapel: ${mapelDetails.length}`);

	// 2. TULIS KE FILE SQL
	sqlContent += `-- 2. INSERT SESI ABSENSI HARIAN\n`;
	for (const s of harianSessions) {
		sqlContent += `INSERT INTO public.absensi_harian (sesi_id, tanggal, kelas, tahun_ajar, semester) VALUES ('${s.sesi_id}', '${s.tanggal}', '${s.kelas}', '${s.tahun_ajar}', ${s.semester}) ON CONFLICT (sesi_id) DO NOTHING;\n`;
	}

	sqlContent += `\n-- 3. INSERT DETAIL SISWA ABSENSI HARIAN (BATCHED)\n`;
	const batchSize = 100;
	for (let i = 0; i < harianDetails.length; i += batchSize) {
		const chunk = harianDetails.slice(i, i + batchSize);
		sqlContent += `INSERT INTO public.absensi_harian_siswa (sesi_id, siswa_id, status, keterangan) VALUES\n`;
		sqlContent += chunk
			.map(
				(d) =>
					`('${d.sesi_id}', '${d.siswa_id}', '${d.status}', ${d.keterangan ? `'${d.keterangan.replace(/'/g, "''")}'` : 'NULL'})`
			)
			.join(',\n');
		sqlContent += `\nON CONFLICT (sesi_id, siswa_id) DO UPDATE SET status = EXCLUDED.status, keterangan = EXCLUDED.keterangan;\n`;
	}

	sqlContent += `\n-- 4. INSERT SESI ABSENSI MAPEL\n`;
	for (const s of mapelSessions) {
		sqlContent += `INSERT INTO public.absensi_mapel (sesi_id, guru_id, tanggal, jam_ke, kelas, mapel, tahun_ajar, semester) VALUES ('${s.sesi_id}', '${s.guru_id}', '${s.tanggal}', '${s.jam_ke}', '${s.kelas}', '${s.mapel}', '${s.tahun_ajar}', ${s.semester}) ON CONFLICT (sesi_id) DO NOTHING;\n`;
	}

	sqlContent += `\n-- 5. INSERT DETAIL SISWA ABSENSI MAPEL (BATCHED)\n`;
	for (let i = 0; i < mapelDetails.length; i += batchSize) {
		const chunk = mapelDetails.slice(i, i + batchSize);
		sqlContent += `INSERT INTO public.absensi_mapel_siswa (sesi_id, siswa_id, status, keterangan) VALUES\n`;
		sqlContent += chunk
			.map(
				(d) =>
					`('${d.sesi_id}', '${d.siswa_id}', '${d.status}', ${d.keterangan ? `'${d.keterangan.replace(/'/g, "''")}'` : 'NULL'})`
			)
			.join(',\n');
		sqlContent += `\nON CONFLICT (sesi_id, siswa_id) DO UPDATE SET status = EXCLUDED.status, keterangan = EXCLUDED.keterangan;\n`;
	}

	sqlContent += `\nCOMMIT;\n`;

	const sqlPath = path.resolve(process.cwd(), 'sql/seed_radar_absensi_11_18_okt.sql');
	fs.writeFileSync(sqlPath, sqlContent, 'utf8');
	console.log(`✅ File SQL berhasil disimpan di: ${sqlPath}`);

	// 3. SEED LANGSUNG KE DATABASE SUPABASE VIA JS CLIENT (Batched)
	console.log('Menginjeksi data ke database Supabase...');

	// Insert harian sessions
	for (let i = 0; i < harianSessions.length; i += 50) {
		const chunk = harianSessions.slice(i, i + 50);
		const { error } = await supabase.from('absensi_harian').upsert(chunk);
		if (error) console.error('Error insert harian sessions:', error.message);
	}

	// Insert harian details
	for (let i = 0; i < harianDetails.length; i += 200) {
		const chunk = harianDetails.slice(i, i + 200);
		const { error } = await supabase.from('absensi_harian_siswa').upsert(chunk, { onConflict: 'sesi_id,siswa_id' });
		if (error) console.error('Error insert harian details:', error.message);
	}

	// Insert mapel sessions
	for (let i = 0; i < mapelSessions.length; i += 50) {
		const chunk = mapelSessions.slice(i, i + 50);
		const { error } = await supabase.from('absensi_mapel').upsert(chunk);
		if (error) console.error('Error insert mapel sessions:', error.message);
	}

	// Insert mapel details
	for (let i = 0; i < mapelDetails.length; i += 200) {
		const chunk = mapelDetails.slice(i, i + 200);
		const { error } = await supabase.from('absensi_mapel_siswa').upsert(chunk, { onConflict: 'sesi_id,siswa_id' });
		if (error) console.error('Error insert mapel details:', error.message);
	}

	console.log('🎉 INJEKSI SEED DATA SELESAI!');
	console.log('Sekarang Anda dapat membuka browser di /kesiswaan untuk melihat Radar Absensi & Bolos langsung aktif.');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
