import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
// BUG FIX #3: Gunakan xlsx-js-style untuk support cell styling (.s property)
import XLSXStyle from 'xlsx-js-style';

// Daftar tabel & urutan backup
const TARGET_TABLES = [
	{ name: 'users', label: 'Data Pengguna (Guru & Admin)' },
	{ name: 'kelas', label: 'Data Kelas' },
	{ name: 'mapel', label: 'Mata Pelajaran' },
	{ name: 'siswa', label: 'Data Siswa' },
	{ name: 'guru_kbm', label: 'Penugasan KBM' },
	{ name: 'jadwal', label: 'Jadwal Pelajaran' },
	{ name: 'jurnal', label: 'Jurnal Mengajar' },
	{ name: 'nilai_tugas', label: 'Header Penilaian Tugas' },
	{ name: 'nilai_siswa', label: 'Nilai Siswa' },
	{ name: 'absensi_harian', label: 'Sesi Absensi Harian' },
	{ name: 'absensi_harian_siswa', label: 'Detail Absensi Harian' },
	{ name: 'absensi_mapel', label: 'Sesi Absensi Mata Pelajaran' },
	{ name: 'absensi_mapel_siswa', label: 'Detail Absensi Mata Pelajaran' },
	{ name: 'poin', label: 'Poin Perilaku Siswa' },
	{ name: 'grup', label: 'Grup Kegiatan' },
	{ name: 'tugas_online', label: 'Tugas Online & Soal' },
	{ name: 'pengumpulan_tugas', label: 'Pengumpulan Tugas Siswa' },
	{ name: 'catatan', label: 'Catatan Pribadi Guru' },
];

export async function GET() {
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
			return NextResponse.json({ error: 'Forbidden: Hanya Admin yang dapat melakukan backup.' }, { status: 403 });
		}

		// 2. Fetch semua tabel secara paralel menggunakan admin client (bypass RLS)
		const fetchResults = await Promise.all(
			TARGET_TABLES.map(async ({ name }) => {
				const { data, error } = await supabaseAdmin.from(name).select('*');
				if (error) {
					console.error(`Backup warning: Gagal fetch tabel "${name}":`, error.message);
					return { name, data: [] };
				}
				return { name, data: data || [] };
			})
		);

		// 3. Buat workbook Excel menggunakan xlsx-js-style
		const workbook = XLSXStyle.utils.book_new();

		for (const { name, data } of fetchResults) {
			let worksheet;

			if (data.length === 0) {
				// Sheet kosong dengan label
				worksheet = XLSXStyle.utils.aoa_to_sheet([['(Tidak ada data)']]);
			} else {
				// Konversi JSONB/Array ke string agar bisa masuk Excel
				const sanitizedData = data.map((row) => {
					const newRow = {};
					for (const [key, val] of Object.entries(row)) {
						if (val !== null && (typeof val === 'object' || Array.isArray(val))) {
							newRow[key] = JSON.stringify(val);
						} else {
							newRow[key] = val;
						}
					}
					return newRow;
				});

				worksheet = XLSXStyle.utils.json_to_sheet(sanitizedData);

				// BUG FIX #3: Styling header row dengan xlsx-js-style (support properti .s)
				const headers = Object.keys(data[0]);
				const headerStyle = {
					font: { bold: true, color: { rgb: 'FFFFFF' } },
					fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
					alignment: { horizontal: 'center', vertical: 'center' },
					border: {
						bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
					},
				};

				headers.forEach((_, colIdx) => {
					const cellAddr = XLSXStyle.utils.encode_cell({ r: 0, c: colIdx });
					if (worksheet[cellAddr]) {
						worksheet[cellAddr].s = headerStyle;
					}
				});

				// Auto-width kolom berdasarkan konten
				const colWidths = headers.map((h) => {
					const maxLen = Math.max(
						h.length,
						...sanitizedData.map((row) => String(row[h] ?? '').length)
					);
					return { wch: Math.min(maxLen + 2, 60) };
				});
				worksheet['!cols'] = colWidths;
			}

			// Nama sheet max 31 karakter (batas Excel)
			const sheetName = name.substring(0, 31);
			XLSXStyle.utils.book_append_sheet(workbook, worksheet, sheetName);
		}

		// 4. Generate buffer
		// BUG FIX #2: Gunakan 'buffer' dan pastikan konversi ke Buffer eksplisit
		const excelBuffer = XLSXStyle.write(workbook, {
			type: 'buffer',
			bookType: 'xlsx',
		});

		// BUG FIX #4: Format tanggal yang robust tanpa bergantung locale OS
		const now = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		// Konversi ke WIB (UTC+7)
		const wibOffset = 7 * 60;
		const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
		const dateStr = `${wibDate.getUTCFullYear()}-${pad(wibDate.getUTCMonth() + 1)}-${pad(wibDate.getUTCDate())}`;
		const filename = `backup_guru-app_${dateStr}.xlsx`;

		// 5. Return sebagai file download
		return new NextResponse(Buffer.from(excelBuffer), {
			status: 200,
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': excelBuffer.length.toString(),
			},
		});
	} catch (error) {
		console.error('❌ Error API Backup:', error);
		return NextResponse.json(
			{ error: 'Gagal melakukan backup database', details: error.message },
			{ status: 500 }
		);
	}
}
