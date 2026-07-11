import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
	try {
		const supabase = await createClient();

		// Daftar tabel utama di Supabase yang ingin dibackup
		const targetTables = [
			'users',
			'kelas',
			'mapel',
			'siswa',
			'guru_kbm',
			'jadwal',
			'jurnal',
			'nilai_tugas',
			'nilai_siswa',
			'absensi_harian',
			'absensi_harian_siswa',
			'absensi_mapel',
			'absensi_mapel_siswa',
			'poin',
			'grup',
			'tugas_online',
			'pengumpulan_tugas'
		];

		const backupData = {};

		// Loop dan ambil isi tiap tabel
		for (const table of targetTables) {
			const { data, error } = await supabase.from(table).select('*');
			
			if (error) {
				console.error(`Backup warning: Failed to fetch ${table}:`, error);
				backupData[table] = [];
			} else {
				backupData[table] = data || [];
			}
		}

		return NextResponse.json(backupData, { status: 200 });
	} catch (error) {
		console.error('❌ Error API Backup:', error);
		return NextResponse.json({ error: 'Gagal melakukan backup database', details: error.message }, { status: 500 });
	}
}
