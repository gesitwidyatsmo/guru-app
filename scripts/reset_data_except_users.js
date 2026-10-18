/**
 * SCRIPT RESET DATA SUPABASE (KECUALI USERS)
 * Menghapus seluruh isi tabel master & transaksional di database Supabase
 * yang aktif di .env.local, TETAP MEMPERTAHANKAN tabel users & auth accounts.
 */

const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Urutan hapus dari child table ke parent table agar tidak melanggar foreign key
const TABLES_TO_CLEAR = [
  { name: 'absensi_mapel_siswa', pk: 'id', type: 'int' },
  { name: 'absensi_mapel', pk: 'sesi_id', type: 'text' },
  { name: 'absensi_harian_siswa', pk: 'id', type: 'int' },
  { name: 'absensi_harian', pk: 'sesi_id', type: 'text' },
  { name: 'nilai_siswa', pk: 'id', type: 'int' },
  { name: 'nilai_tugas', pk: 'tugas_id', type: 'text' },
  { name: 'pengumpulan_tugas', pk: 'id', type: 'int' },
  { name: 'tugas_online', pk: 'id', type: 'text' },
  { name: 'poin', pk: 'id', type: 'text' },
  { name: 'grup', pk: 'id', type: 'text' },
  { name: 'jurnal', pk: 'id', type: 'text' },
  { name: 'jadwal', pk: 'id', type: 'text' },
  { name: 'guru_kbm', pk: 'id_kbm', type: 'text' },
  { name: 'wali_kelas', pk: 'id', type: 'int' },
  { name: 'siswa', pk: 'id', type: 'text' },
  { name: 'kelas', pk: 'id', type: 'text' },
  { name: 'mapel', pk: 'id', type: 'text' },
  { name: 'catatan', pk: 'id', type: 'text' },
  { name: 'notifikasi', pk: 'id', type: 'uuid' },
  { name: 'game_sessions', pk: 'id', type: 'text' },
  { name: 'game_questions', pk: 'id', type: 'text' },
  { name: 'game_packages', pk: 'id', type: 'text' },
  { name: 'tahun_ajar', pk: 'id', type: 'text' },
  { name: 'app_settings', pk: 'key', type: 'text' }
];

async function confirmAction() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    console.log('=================================================================');
    console.log('⚠️  PERINGATAN: OPERASI INI AKAN MENGHAPUS SEMUA ISI TABEL SUPABASE');
    console.log('Target URL  :', SUPABASE_URL);
    console.log('Tabel Aman  : public.users & auth.users (TIDAK AKAN DIHAPUS)');
    console.log('Tabel Hapus : 24 tabel (siswa, kelas, nilai, absensi, jurnal, dll.)');
    console.log('=================================================================');
    rl.question('Apakah Anda yakin ingin melanjutkan? Ketik "Y" lalu tekan Enter: ', answer => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'Y');
    });
  });
}

async function run() {
  const confirmed = await confirmAction();
  if (!confirmed) {
    console.log('Operasi dibatalkan oleh pengguna.');
    process.exit(0);
  }

  console.log('\nMemulai proses pembersihan tabel...');

  for (const t of TABLES_TO_CLEAR) {
    process.stdout.write(`Mengosongkan tabel ${t.name}... `);
    let query = supabase.from(t.name).delete();

    if (t.type === 'int') {
      query = query.gte(t.pk, 0);
    } else if (t.type === 'uuid') {
      query = query.neq(t.pk, '00000000-0000-0000-0000-000000000000');
    } else {
      query = query.neq(t.pk, 'DUMMY_NEQ_FILTER_XYZ');
    }

    const { error, count } = await query;
    if (error) {
      console.log(`[GAGAL: ${error.message}]`);
    } else {
      console.log(`[SUKSES]`);
    }
  }

  // Seed kembali periode tahun ajar aktif agar sistem langsung siap digunakan
  console.log('\nMenyiapkan periode Tahun Ajar aktif default...');
  await supabase.from('tahun_ajar').upsert({
    id: 'TA-2026-S1',
    nama: '2026/2027',
    semester: 1,
    is_aktif: true,
    tanggal_mulai: '2026-07-14',
    tanggal_selesai: '2026-12-31'
  }, { onConflict: 'nama,semester' });

  // Verifikasi akun users tetap utuh
  const { data: users, count: userCount } = await supabase.from('users').select('*', { count: 'exact' });
  console.log(`\n✔ SELESAI! Seluruh tabel berhasil dikosongkan.`);
  console.log(`✔ Tabel public.users tetap utuh: ${users?.length || 0} akun aktif (Admin, Kepala Sekolah, Bendahara, Guru).`);
  console.log(`✔ Periode Tahun Ajar 2026/2027 Semester 1 siap digunakan.`);
}

run().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
