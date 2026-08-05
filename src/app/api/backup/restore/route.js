import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
// BUG FIX #1: Gunakan xlsx biasa untuk parse (bukan xlsx-js-style yang tidak perlu styling di server restore)
import * as XLSX from 'xlsx';

// ============================================================
// Konfigurasi urutan restore (respecting foreign key deps)
// serialIdCols: kolom ID serial yang harus dibuang saat upsert
// (biarkan Supabase yang generate, untuk menghindari konflik sequence)
// ============================================================
const RESTORE_ORDER = [
	{
		name: 'users',
		primaryKey: 'id_user',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'kelas',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'mapel',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'siswa',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'guru_kbm',
		primaryKey: 'id_kbm',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'jadwal',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		name: 'jurnal',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: ['tuntas'],
		jsonbCols: [],
		dateCols: ['tanggal', 'created_at'],
		numberCols: [],
	},
	{
		name: 'nilai_tugas',
		primaryKey: 'tugas_id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['tanggal', 'created_at'],
		numberCols: [],
	},
	{
		// BUG FIX #5: nilai_siswa punya SERIAL id tapi juga UNIQUE(tugas_id, siswa_id)
		// Kita buang kolom 'id' dari payload dan pakai composite unique sebagai conflict target
		name: 'nilai_siswa',
		primaryKey: null,
		uniqueConflict: 'tugas_id,siswa_id',
		serialIdCols: ['id'], // buang id serial dari payload
		booleans: [],
		jsonbCols: [],
		dateCols: [],
		numberCols: ['nilai'],
	},
	{
		name: 'absensi_harian',
		primaryKey: 'sesi_id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['tanggal', 'created_at'],
		numberCols: [],
	},
	{
		// BUG FIX #5: absensi_harian_siswa punya SERIAL id + UNIQUE(sesi_id, siswa_id)
		name: 'absensi_harian_siswa',
		primaryKey: null,
		uniqueConflict: 'sesi_id,siswa_id',
		serialIdCols: ['id'],
		booleans: [],
		jsonbCols: [],
		dateCols: [],
		numberCols: [],
	},
	{
		name: 'absensi_mapel',
		primaryKey: 'sesi_id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['tanggal', 'created_at'],
		numberCols: [],
	},
	{
		// BUG FIX #5: absensi_mapel_siswa punya SERIAL id + UNIQUE(sesi_id, siswa_id)
		name: 'absensi_mapel_siswa',
		primaryKey: null,
		uniqueConflict: 'sesi_id,siswa_id',
		serialIdCols: ['id'],
		booleans: [],
		jsonbCols: [],
		dateCols: [],
		numberCols: [],
	},
	{
		name: 'poin',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['tanggal', 'created_at'],
		numberCols: ['poin'],
	},
	{
		name: 'grup',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: ['data_json'],
		dateCols: ['tanggal', 'created_at'],
		numberCols: [],
	},
	{
		name: 'tugas_online',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: ['soal'],
		dateCols: ['created_at'],
		numberCols: [],
	},
	{
		// BUG FIX #5: pengumpulan_tugas punya SERIAL id — tidak ada unique constraint yg aman
		// untuk upsert selain id itu sendiri, jadi kita tetap sertakan id agar upsert by id bisa jalan
		// Catatan: data baru (id baru) akan di-insert biasa
		name: 'pengumpulan_tugas',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: [],
		jsonbCols: [],
		dateCols: ['waktu'],
		numberCols: ['id', 'nilai'],
	},
	{
		name: 'catatan',
		primaryKey: 'id',
		serialIdCols: [],
		booleans: ['pinned'],
		jsonbCols: [],
		dateCols: ['created_at', 'updated_at'],
		numberCols: [],
	},
];

// ============================================================
// BUG FIX #1: Helper konversi Excel serial date ke ISO string
// XLSX.SSF.parse_date_code tidak reliable di semua versi xlsx
// Gunakan formula epoch manual yang lebih stabil
// ============================================================
function excelSerialToISO(serial) {
	// Excel epoch: 1 Januari 1900 = serial 1
	// Ada bug Lotus123: Excel menganggap 1900 adalah leap year (serial 60 = 29 Feb 1900 yang tidak ada)
	// JS Date epoch: 1 Januari 1970
	const EXCEL_EPOCH = new Date(Date.UTC(1900, 0, 0)); // 31 Des 1899
	const msPerDay = 86400000;
	// Koreksi bug Lotus123 untuk serial >= 60
	const correctedSerial = serial >= 60 ? serial - 1 : serial;
	const date = new Date(EXCEL_EPOCH.getTime() + correctedSerial * msPerDay);
	return date.toISOString();
}

// ============================================================
// Helper: Konversi nilai dari Excel ke tipe yang benar
// ============================================================
function convertRow(row, config) {
	const result = {};

	for (const [key, rawVal] of Object.entries(row)) {
		// BUG FIX #5: Buang kolom serial ID dari payload
		if (config.serialIdCols && config.serialIdCols.includes(key)) {
			continue; // skip, biarkan Supabase yang generate
		}

		let val = rawVal;

		// undefined / null / empty string → null
		if (val === undefined || val === null || val === '') {
			result[key] = null;
			continue;
		}

		// Boolean columns
		if (config.booleans.includes(key)) {
			if (val === true || val === 'TRUE' || val === 'true' || val === 1) {
				result[key] = true;
			} else if (val === false || val === 'FALSE' || val === 'false' || val === 0) {
				result[key] = false;
			} else {
				result[key] = null;
			}
			continue;
		}

		// JSONB columns — parse dari string
		if (config.jsonbCols.includes(key)) {
			if (typeof val === 'string') {
				try {
					result[key] = JSON.parse(val);
				} catch {
					result[key] = val; // simpan apa adanya jika parse gagal
				}
			} else {
				result[key] = val;
			}
			continue;
		}

		// Number columns
		if (config.numberCols.includes(key)) {
			const num = Number(val);
			result[key] = isNaN(num) ? null : num;
			continue;
		}

		// Date/timestamp columns
		if (config.dateCols.includes(key)) {
			if (typeof val === 'number') {
				// BUG FIX #1: Gunakan helper manual, bukan XLSX.SSF.parse_date_code
				try {
					result[key] = excelSerialToISO(val);
				} catch {
					result[key] = null;
				}
			} else if (typeof val === 'string' && val.trim() !== '') {
				const d = new Date(val);
				result[key] = isNaN(d.getTime()) ? null : d.toISOString();
			} else {
				result[key] = null;
			}
			continue;
		}

		result[key] = val;
	}
	return result;
}

// ============================================================
// POST /api/backup/restore
// ============================================================
export async function POST(request) {
	try {
		// 1. Validasi sesi & role Admin
		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized: Sesi tidak valid.' }, { status: 401 });
		}

		const { data: userProfile, error: profileError } = await supabase
			.from('users')
			.select('role')
			.eq('auth_id', user.id)
			.single();

		if (profileError || !userProfile || userProfile.role !== 'Admin') {
			return NextResponse.json({ error: 'Forbidden: Hanya Admin yang dapat melakukan restore.' }, { status: 403 });
		}

		// 2. Parse multipart form data — ambil file Excel
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) {
			return NextResponse.json({ error: 'File tidak ditemukan. Harap upload file Excel (.xlsx).' }, { status: 400 });
		}

		const filename = file.name || '';
		if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
			return NextResponse.json({ error: 'Format file tidak valid. Harap upload file .xlsx dari hasil backup.' }, { status: 400 });
		}

		// 3. Baca konten file sebagai ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();
		// cellDates: false agar tanggal datang sebagai serial number (kita handle manual di convertRow)
		const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });

		// 4. Restore per tabel sesuai urutan
		const report = [];

		for (const config of RESTORE_ORDER) {
			const { name, primaryKey, uniqueConflict } = config;

			// Cek apakah sheet ada di workbook
			if (!workbook.SheetNames.includes(name)) {
				report.push({ table: name, status: 'skipped', message: 'Sheet tidak ditemukan di file backup', count: 0 });
				continue;
			}

			const worksheet = workbook.Sheets[name];
			const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

			if (!rawRows || rawRows.length === 0) {
				report.push({ table: name, status: 'skipped', message: 'Sheet kosong', count: 0 });
				continue;
			}

			// Filter baris placeholder "(Tidak ada data)"
			const filteredRows = rawRows.filter(
				(row) => !(Object.keys(row).length === 1 && Object.values(row)[0] === '(Tidak ada data)')
			);

			if (filteredRows.length === 0) {
				report.push({ table: name, status: 'skipped', message: 'Tidak ada data untuk di-restore', count: 0 });
				continue;
			}

			// Konversi tipe data per baris
			const convertedRows = filteredRows.map((row) => convertRow(row, config));

			// Tentukan conflict column untuk upsert
			const onConflict = primaryKey || uniqueConflict;

			// Upsert ke Supabase menggunakan admin client (bypass RLS)
			// Proses batch per 500 baris agar tidak timeout
			const BATCH_SIZE = 500;
			let totalInserted = 0;
			const errors = [];

			for (let i = 0; i < convertedRows.length; i += BATCH_SIZE) {
				const batch = convertedRows.slice(i, i + BATCH_SIZE);
				const { error: upsertError, count } = await supabaseAdmin
					.from(name)
					.upsert(batch, {
						onConflict: onConflict,
						ignoreDuplicates: false,
						count: 'exact',
					});

				if (upsertError) {
					errors.push(upsertError.message);
					console.error(`Restore error [${name}] batch ${i}:`, upsertError.message);
				} else {
					totalInserted += count || batch.length;
				}
			}

			report.push({
				table: name,
				status: errors.length === 0 ? 'success' : 'partial',
				count: totalInserted,
				errors: errors.length > 0 ? errors : undefined,
			});
		}

		return NextResponse.json({
			success: true,
			message: 'Restore selesai diproses.',
			report,
		});
	} catch (error) {
		console.error('❌ Error API Restore:', error);
		return NextResponse.json(
			{ error: 'Gagal melakukan restore database', details: error.message },
			{ status: 500 }
		);
	}
}
