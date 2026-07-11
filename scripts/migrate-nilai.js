import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY ada di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOGGED_IN_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !LOGGED_IN_KEY || !process.env.GOOGLE_SHEET_ID) {
    console.error("❌ Kredensial Google Sheets belum lengkap di .env.local");
    process.exit(1);
}

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

async function migrateNilai() {
	console.log('🚀 Memulai migrasi data nilai ke Supabase...');

	const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
	try {
        await doc.loadInfo();
    } catch (e) {
        console.error("❌ Gagal memuat Spreadsheet. Cek GOOGLE_SHEET_ID dan Kredensial:", e.message);
        return;
    }

	try {
		console.log('\nMigrasi MASTER_NILAI...');
		const sheetNilai = doc.sheetsByTitle['MASTER_NILAI'];
		
		if (!sheetNilai) {
            console.error("❌ Sheet 'MASTER_NILAI' tidak ditemukan dalam spreadsheet.");
            return;
        }

        const rows = await sheetNilai.getRows();
        let successCount = 0;
        let siswaCount = 0;

        for (const row of rows) {
            const tugasId = row.get('tugas_id');
            const guruId = row.get('guru_id');
            
            if (!tugasId) {
                console.warn("⚠️ Melewati baris karena tidak memiliki ID tugas.");
                continue;
            }

            if (guruId) {
                await ensureUserExists(supabase, guruId);
            }

            // 1. Insert/Upsert nilai_tugas
            const { error: tugasError } = await supabase.from('nilai_tugas').upsert(
                {
                    tugas_id: tugasId,
                    guru_id: guruId || null,
                    kategori: row.get('kategori') || '',
                    type: row.get('type') || '',
                    deskripsi: row.get('deskripsi') || '',
                    kelas: row.get('kelas') || '',
                    mapel: row.get('mapel') || '',
                    tanggal: row.get('tanggal') || new Date().toISOString().split('T')[0],
                },
                { onConflict: 'tugas_id' },
            );

            if (tugasError) {
                console.error(`❌ Error insert nilai_tugas (Tugas ID: ${tugasId}):`, tugasError.message);
                continue; // Lanjut ke baris berikutnya jika gagal insert tugas master
            }

            // 2. Insert/Upsert nilai_siswa (detail nilai dari JSON)
            let dataNil = [];
            const dataNilaiRaw = row.get('data_nilai');
            
            if (dataNilaiRaw) {
                try {
                    dataNil = JSON.parse(dataNilaiRaw);
                } catch (e) {
                    console.error(`❌ Format JSON tidak valid pada data_nilai (Tugas ID: ${tugasId}):`, e.message);
                }
            }

            for (const item of dataNil) {
                if (!item.siswa_id) {
                    console.warn(`⚠️ Melewati nilai siswa karena siswa_id kosong (Tugas ID: ${tugasId})`);
                    continue;
                }

                // Menambahkan data nilai_siswa ke Supabase
                const { error: siswaError } = await supabase.from('nilai_siswa').upsert(
                    {
                        tugas_id: tugasId,
                        siswa_id: item.siswa_id,
                        nama_siswa: item.nama_siswa || '',
                        nilai: isNaN(parseFloat(item.nilai)) ? null : parseFloat(item.nilai),
                    },
                    { onConflict: 'tugas_id,siswa_id' }
                );

                if (siswaError) {
                    console.error(`❌ Error insert nilai_siswa (Tugas: ${tugasId}, Siswa: ${item.siswa_id}):`, siswaError.message);
                } else {
                    siswaCount++;
                }
            }

            successCount++;
        }

        console.log(`\n✅ Selesai migrasi ${successCount} baris ke nilai_tugas`);
        console.log(`✅ Selesai migrasi ${siswaCount} detail data ke nilai_siswa`);
		console.log('\n🎉 MIGRASI NILAI SELESAI!');

	} catch (error) {
		console.error('❌ Terjadi kesalahan saat migrasi:', error);
	}
}

migrateNilai();
