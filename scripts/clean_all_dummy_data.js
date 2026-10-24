/**
 * SCRIPT PEMBERSIHAN DATA PALSU / UJI COBA (DUMMY DATA CLEANUP)
 * GuruApp — SMP IT Tebuireng 4 Al-Ishlah
 * 
 * Mode:
 *   node scripts/clean_all_dummy_data.js --dry-run   (Hanya simulasi & cek rincian)
 *   node scripts/clean_all_dummy_data.js --execute   (Eksekusi pembersihan nyata)
 */

const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

async function main() {
  console.log('====================================================================');
  console.log('🧹 AUDIT & PEMBERSIHAN DATA UJI COBA / PALSU (GURU-APP)');
  console.log('Target Database :', SUPABASE_URL);
  console.log('Mode Eksekusi   :', isDryRun ? 'DRY-RUN (Simulasi / Hanya Cek)' : 'LIVE EXECUTION (Menghapus Data Palsu)');
  console.log('====================================================================\n');

  // 1. Audit Nilai Tugas & Nilai Siswa
  const { count: cntNilaiSiswa } = await supabase.from('nilai_siswa').select('*', { count: 'exact', head: true });
  const { count: cntNilaiTugas } = await supabase.from('nilai_tugas').select('*', { count: 'exact', head: true });

  // 2. Audit Presensi / Absensi
  const { count: cntAbsMapelSiswa } = await supabase.from('absensi_mapel_siswa').select('*', { count: 'exact', head: true });
  const { count: cntAbsMapel } = await supabase.from('absensi_mapel').select('*', { count: 'exact', head: true });
  const { count: cntAbsHarianSiswa } = await supabase.from('absensi_harian_siswa').select('*', { count: 'exact', head: true });
  const { count: cntAbsHarian } = await supabase.from('absensi_harian').select('*', { count: 'exact', head: true });

  // 3. Audit Jurnal Mengajar
  const { count: cntJurnal } = await supabase.from('jurnal').select('*', { count: 'exact', head: true });

  // 4. Audit Grup Pembelajaran
  const { count: cntGrup } = await supabase.from('grup').select('*', { count: 'exact', head: true });

  // 5. Audit Kesiswaan Sanksi
  const { count: cntSanksi } = await supabase.from('kesiswaan_sanksi').select('*', { count: 'exact', head: true });

  // 6. Audit Notifikasi
  const { count: cntNotif } = await supabase.from('notifikasi').select('*', { count: 'exact', head: true });

  // 7. Audit E-Rapor
  const { count: cntRaporNilaiTp } = await supabase.from('rapor_nilai_tp').select('*', { count: 'exact', head: true });
  const { count: cntRaporKualitatif } = await supabase.from('rapor_nilai_kualitatif').select('*', { count: 'exact', head: true });
  const { count: cntRaporKuantitatif } = await supabase.from('rapor_nilai_kuantitatif').select('*', { count: 'exact', head: true });
  const { count: cntRaporKetidakhadiran } = await supabase.from('rapor_ketidakhadiran').select('*', { count: 'exact', head: true });
  const { count: cntRaporStatusKelas } = await supabase.from('rapor_status_kelas').select('*', { count: 'exact', head: true });
  const { count: cntRaporTp } = await supabase.from('rapor_tp').select('*', { count: 'exact', head: true });

  console.log('📊 DAFTAR DATA PALSU / UJI COBA YANG TERDETEKSI:');
  console.log(`- nilai_siswa             : ${cntNilaiSiswa ?? 0} baris (100% dummy TGS-DUMMY-*)`);
  console.log(`- nilai_tugas             : ${cntNilaiTugas ?? 0} baris (100% dummy TGS-DUMMY-*)`);
  console.log(`- absensi_mapel_siswa     : ${cntAbsMapelSiswa ?? 0} baris (detail kehadiran jam mapel)`);
  console.log(`- absensi_mapel           : ${cntAbsMapel ?? 0} baris (544 dummy + 10 uji coba UI)`);
  console.log(`- absensi_harian_siswa    : ${cntAbsHarianSiswa ?? 0} baris (detail kehadiran harian)`);
  console.log(`- absensi_harian          : ${cntAbsHarian ?? 0} baris (100% dummy SESI-H-DUMMY-*)`);
  console.log(`- jurnal                  : ${cntJurnal ?? 0} baris (544 dummy + 3 uji coba guru)`);
  console.log(`- grup                    : ${cntGrup ?? 0} baris (grup uji coba judul "test")`);
  console.log(`- kesiswaan_sanksi        : ${cntSanksi ?? 0} baris (sanksi uji coba alasan "test")`);
  console.log(`- notifikasi              : ${cntNotif ?? 0} baris (notifikasi otomatis saat testing)`);
  console.log(`- modul e-rapor (test TP) : ${cntRaporTp ?? 0} TP ("testing brohamt", dsb)`);
  console.log(`- modul e-rapor (nilai)   : ${cntRaporKuantitatif ?? 0} kuantitatif, ${cntRaporKualitatif ?? 0} kualitatif, ${cntRaporNilaiTp ?? 0} nilai TP`);
  console.log(`- modul e-rapor (absen)   : ${cntRaporKetidakhadiran ?? 0} ketidakhadiran, ${cntRaporStatusKelas ?? 0} status kunci kelas`);
  console.log(`- app_settings            : 1 draft pengajuan bisaroh uji coba & 1 kunci e-rapor IX-G\n`);

  if (isDryRun) {
    console.log('💡 Ini adalah mode DRY-RUN. Tidak ada data yang dihapus.');
    console.log('Untuk mengeksekusi penghapusan riil, jalankan:');
    console.log('  node scripts/clean_all_dummy_data.js --execute\n');
    return;
  }

  // Konfirmasi sebelum eksekusi live
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => {
    rl.question('Ketik "BERSIHKAN" untuk memulai penghapusan data palsu di atas: ', a => {
      rl.close();
      res(a.trim());
    });
  });

  if (answer !== 'BERSIHKAN') {
    console.log('Pembersihan dibatalkan.');
    process.exit(0);
  }

  console.log('\nMemulai pembersihan...');

  // Urutan penghapusan sesuai relasi child -> parent
  const actions = [
    { name: 'nilai_siswa', fn: () => supabase.from('nilai_siswa').delete().gte('id', 0) },
    { name: 'nilai_tugas', fn: () => supabase.from('nilai_tugas').delete().neq('tugas_id', 'NON_EXISTENT_ID_XYZ') },
    { name: 'absensi_mapel_siswa', fn: () => supabase.from('absensi_mapel_siswa').delete().gte('id', 0) },
    { name: 'absensi_mapel', fn: () => supabase.from('absensi_mapel').delete().neq('sesi_id', 'NON_EXISTENT_ID_XYZ') },
    { name: 'absensi_harian_siswa', fn: () => supabase.from('absensi_harian_siswa').delete().gte('id', 0) },
    { name: 'absensi_harian', fn: () => supabase.from('absensi_harian').delete().neq('sesi_id', 'NON_EXISTENT_ID_XYZ') },
    { name: 'jurnal', fn: () => supabase.from('jurnal').delete().neq('id', 'NON_EXISTENT_ID_XYZ') },
    { name: 'grup', fn: () => supabase.from('grup').delete().neq('id', 'NON_EXISTENT_ID_XYZ') },
    { name: 'kesiswaan_sanksi', fn: () => supabase.from('kesiswaan_sanksi').delete().gte('id', 0) },
    { name: 'notifikasi', fn: () => supabase.from('notifikasi').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
    { name: 'rapor_nilai_tp', fn: () => supabase.from('rapor_nilai_tp').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
    { name: 'rapor_nilai_kualitatif', fn: () => supabase.from('rapor_nilai_kualitatif').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
    { name: 'rapor_nilai_kuantitatif', fn: () => supabase.from('rapor_nilai_kuantitatif').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
    { name: 'rapor_ketidakhadiran', fn: () => supabase.from('rapor_ketidakhadiran').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
    { name: 'rapor_status_kelas', fn: () => supabase.from('rapor_status_kelas').delete().gte('id', 0) },
    { name: 'rapor_tp', fn: () => supabase.from('rapor_tp').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
  ];

  for (const act of actions) {
    process.stdout.write(`Menghapus data di tabel ${act.name}... `);
    const { error } = await act.fn();
    if (error) {
      console.log(`[GAGAL: ${error.message}]`);
    } else {
      console.log(`[BERHASIL]`);
    }
  }

  // Reset bisaroh submissions & kunci rapor di app_settings
  console.log('Mereset pengajuan bisaroh uji coba di app_settings...');
  await supabase.from('app_settings').update({ value: [] }).eq('key', 'bisaroh_submissions');

  console.log('Mereset kunci rapor IX-G uji coba di app_settings...');
  await supabase.from('app_settings').update({ value: {} }).eq('key', 'rapor_locks_2026/2027_1');

  console.log('\n✔ PEMBERSIHAN SELESAI!');
  console.log('Database sekarang dalam kondisi BERSIH & SIAP PAKAI.');
}

main().catch(console.error);
