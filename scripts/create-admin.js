import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createFirstAdmin() {
	console.log('🚀 Memulai pembuatan akun Admin Pertama...');

	const username = 'admin';
	const email = `${username}@guruapp.com`;
	const password = 'PasswordRahasia123!';
	const namaLengkap = 'Administrator Utama';
	const idUser = `UID-${Date.now().toString().slice(-4)}ADMIN`;

	try {
		// 1. Cek apakah user auth sudah ada
		console.log(`Membuat kredensial login (Email: ${email})...`);
		const { data: authData, error: authError } = await supabase.auth.admin.createUser({
			email: email,
			password: password,
			email_confirm: true,
		});

		if (authError) {
			if (authError.message.includes('already registered')) {
				console.error('❌ Akun dengan email tersebut sudah terdaftar di Supabase Auth.');
			} else {
				throw authError;
			}
			return;
		}

		console.log('✅ Kredensial berhasil dibuat. Auth ID:', authData.user.id);

		// 2. Masukkan ke tabel public.users
		console.log('Menambahkan profil ke database...');
		const { error: profileError } = await supabase.from('users').upsert({
			id_user: idUser,
			auth_id: authData.user.id,
			username: username,
			nama_lengkap: namaLengkap,
			role: 'Admin',
		}, { onConflict: 'username' });

		if (profileError) {
			// Rollback jika gagal
			await supabase.auth.admin.deleteUser(authData.user.id);
			throw profileError;
		}

		console.log('\n🎉 AKUN ADMIN BERHASIL DIBUAT!');
		console.log('====================================');
		console.log(`Username / Email : ${email}`);
		console.log(`Password         : ${password}`);
		console.log('====================================');
		console.log('Silakan login ke aplikasi menggunakan akun di atas.');
		console.log('Setelah login, Anda (sebagai Admin) dapat membuat akun Guru melalui menu kelola pengguna di aplikasi.');
		
	} catch (error) {
		console.error('\n❌ Terjadi kesalahan:', error.message);
	}
}

createFirstAdmin();
