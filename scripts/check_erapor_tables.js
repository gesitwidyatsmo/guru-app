const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: Kredensial Supabase tidak lengkap.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TABLES = [
  'rapor_tp',
  'rapor_nilai_kuantitatif',
  'rapor_nilai_tp',
  'rapor_nilai_kualitatif',
  'rapor_ekstrakurikuler',
  'rapor_ketidakhadiran',
  'rapor_pengaturan'
];

async function checkTables() {
  console.log('--- Pemeriksaan Tabel ERapor di Supabase ---');
  let allReady = true;
  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === 'PGRST205') {
      console.log(`❌ Tabel '${table}': Belum ada di database`);
      allReady = false;
    } else if (error) {
      console.log(`⚠️  Tabel '${table}': ${error.message} (${error.code})`);
      allReady = false;
    } else {
      console.log(`✅ Tabel '${table}': Siap`);
    }
  }

  // Periksa apakah kolom id_user sudah ada di tabel rapor_tp
  const { error: colErr } = await supabase.from('rapor_tp').select('id_user').limit(1);
  if (colErr && (colErr.code === '42703' || colErr.message?.includes('id_user'))) {
    console.log(`\n⚠️  Kolom 'id_user' di tabel 'rapor_tp' belum dibuat.`);
    console.log(`   Silakan jalankan file migrasi berikut di Supabase SQL Editor:`);
    console.log(`   migrations/add_id_user_to_rapor_tp.sql\n`);
  } else if (!colErr) {
    console.log(`✅ Kolom 'id_user' di 'rapor_tp': Siap (TP terisolasi per guru)`);
  }

  if (!allReady) {
    console.log('\n⚠️  Harap jalankan file migrasi berikut di Supabase SQL Editor:');
    console.log('   migrations/add_erapor_module.sql\n');
  } else {
    console.log('\n🎉 Seluruh tabel ERapor siap digunakan!');
  }
}

checkTables();
