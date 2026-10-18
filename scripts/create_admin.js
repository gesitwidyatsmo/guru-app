/**
 * SCRIPT BUAT ADMIN BARU GURUAPP
 * 
 * Penggunaan:
 * 1. Mode Interaktif (ditanya satu per satu):
 *    npm run db:create-admin
 * 
 * 2. Mode Langsung (Command Line Arguments):
 *    node scripts/create_admin.js --username admin2 --password password123 --nama "Admin Cadangan" --nip "19800101"
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

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function generateUID() {
  return 'UID-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      params[key] = val;
    }
  }
  return params;
}

function promptQuestion(rl, question, defaultValue = '') {
  return new Promise(resolve => {
    const promptText = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(promptText, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function main() {
  const cliArgs = parseArgs();
  let username = cliArgs.username;
  let password = cliArgs.password;
  let namaLengkap = cliArgs.nama || cliArgs.name;
  let nip = cliArgs.nip || null;

  if (!username || !password || !namaLengkap) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('=================================================================');
    console.log('🛠️  PEMBUATAN AKUN ADMIN BARU (GURUAPP)');
    console.log('Target Database:', SUPABASE_URL);
    console.log('=================================================================\n');

    if (!username) {
      while (!username) {
        username = await promptQuestion(rl, 'Masukkan Username login (tanpa spasi)');
        username = username.toLowerCase().replace(/\s+/g, '');
        if (!username) console.log('❌ Username tidak boleh kosong!');
      }
    }

    if (!password) {
      while (!password) {
        password = await promptQuestion(rl, 'Masukkan Password (minimal 6 karakter)');
        if (!password || password.length < 6) {
          console.log('❌ Password minimal 6 karakter!');
          password = '';
        }
      }
    }

    if (!namaLengkap) {
      while (!namaLengkap) {
        namaLengkap = await promptQuestion(rl, 'Masukkan Nama Lengkap Admin');
        if (!namaLengkap) console.log('❌ Nama lengkap tidak boleh kosong!');
      }
    }

    if (nip === null || nip === undefined) {
      const inputNip = await promptQuestion(rl, 'Masukkan NIP (opsional, tekan Enter untuk lewati)');
      nip = inputNip ? inputNip.trim() : null;
    }

    rl.close();
  }

  username = String(username).toLowerCase().trim().replace(/\s+/g, '');
  const email = `${username}@guruapp.com`;

  console.log('\nSedang memproses pendaftaran ke Supabase...');

  // 1. Cek apakah username sudah ada di public.users
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('username')
    .eq('username', username)
    .single();

  if (existingUser) {
    console.error(`❌ Gagal: Username "${username}" sudah digunakan pengguna lain.`);
    process.exit(1);
  }

  // 2. Buat akun di Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username }
  });

  if (authError) {
    console.error(`❌ Gagal membuat kredensial auth: ${authError.message}`);
    process.exit(1);
  }

  // 3. Buat profil di public.users
  const newUserId = generateUID();
  const userPayload = {
    id_user: newUserId,
    auth_id: authData.user.id,
    username,
    nama_lengkap: namaLengkap,
    role: 'Admin',
    nip: nip || null
  };

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert(userPayload);

  if (profileError) {
    // Rollback auth jika gagal
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    console.error(`❌ Gagal membuat profil public.users: ${profileError.message}`);
    process.exit(1);
  }

  console.log('\n=================================================================');
  console.log('✔ SUKSES! AKUN ADMIN BARU BERHASIL DIBUAT');
  console.log('=================================================================');
  console.log('Username     :', username);
  console.log('Password     :', password);
  console.log('Nama Lengkap :', namaLengkap);
  console.log('Role         : Admin');
  if (nip) console.log('NIP          :', nip);
  console.log('ID User      :', newUserId);
  console.log('Auth ID      :', authData.user.id);
  console.log('Email Sistem :', email);
  console.log('=================================================================');
  console.log('Anda sekarang bisa login di aplikasi menggunakan:');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log('=================================================================\n');
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
