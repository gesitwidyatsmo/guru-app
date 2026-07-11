import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

function generateUID() {
	return 'UID-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ---------------------------------------------------------------------------
// METHOD GET - Menampilkan Daftar Pengguna
// ---------------------------------------------------------------------------
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Hanya Admin yang diizinkan mengelola daftar pengguna.' }, { status: 403 });
		}

		const supabase = await createClient();
		let query = supabase.from('users').select('id_user, username, nama_lengkap, role').order('created_at', { ascending: false });

		const { searchParams } = new URL(req.url);
		const filterRole = searchParams.get('role');
		
		if (filterRole) {
			query = query.eq('role', filterRole);
		}

		const { data: users, error } = await query;

		if (error) throw error;

		return NextResponse.json(users || [], { status: 200 });
	} catch (error) {
		console.error('Error GET Pengguna:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD POST - Menambahkan Guru / Admin Baru
// ---------------------------------------------------------------------------
export async function POST(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { username, password, nama_lengkap, role } = await req.json();

		if (!username || !password || !nama_lengkap || !role) {
			return NextResponse.json({ error: 'Seluruh form data wajib dilengkapi.' }, { status: 400 });
		}

		// 1. Buat user di Supabase Auth
		const email = `${username}@guruapp.com`;
		const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});

		if (authError) {
			console.error('Auth Create Error:', authError.message);
			if (authError.message.includes('already registered')) {
				return NextResponse.json({ error: `Username '${username}' sudah dipakai pengguna lain.` }, { status: 409 });
			}
			return NextResponse.json({ error: 'Gagal membuat kredensial auth.' }, { status: 500 });
		}

		// 2. Buat record profil di public.users
		const newUserId = generateUID();
		const { error: profileError } = await supabaseAdmin.from('users').insert({
			id_user: newUserId,
			auth_id: authData.user.id,
			username,
			nama_lengkap,
			role,
		});

		if (profileError) {
			// Rollback auth user
			await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
			console.error('Profile Create Error:', profileError.message);
			return NextResponse.json({ error: `Gagal membuat profil pengguna: ${profileError.message}` }, { status: 500 });
		}

		return NextResponse.json({ success: true, message: 'Akun berhasil ditambahkan', id: newUserId }, { status: 201 });
	} catch (error) {
		console.error('Error POST Pengguna:', error);
		return NextResponse.json({ error: `Terjadi kesalahan sistem: ${error.message}` }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD PUT - Modifikasi Data / Reset Password
// ---------------------------------------------------------------------------
export async function PUT(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const body = await req.json();
		const { id_user, username, nama_lengkap, role, password_baru } = body;

		if (!id_user) {
			return NextResponse.json({ error: 'Parameter id_user diperlukan.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		// Dapatkan auth_id terlebih dahulu
		const { data: userProfile, error: fetchError } = await supabase
			.from('users')
			.select('auth_id, username')
			.eq('id_user', id_user)
			.single();

		if (fetchError || !userProfile) {
			return NextResponse.json({ error: 'Sistem tidak menemukan akun ini.' }, { status: 404 });
		}

		// Update Auth jika username atau password berubah
		if (username !== userProfile.username || (password_baru && password_baru.trim() !== '')) {
			const authUpdates = {};
			if (username !== userProfile.username) authUpdates.email = `${username}@guruapp.com`;
			if (password_baru && password_baru.trim() !== '') authUpdates.password = password_baru;
			
			const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
				userProfile.auth_id,
				authUpdates
			);
			
			if (updateAuthError) {
				console.error('Auth Update Error:', updateAuthError.message);
				return NextResponse.json({ error: 'Gagal mengupdate kredensial auth.' }, { status: 500 });
			}
		}

		// Update Profil public.users
		const profileUpdates = {};
		if (username !== userProfile.username) profileUpdates.username = username;
		if (nama_lengkap) profileUpdates.nama_lengkap = nama_lengkap;
		if (role) profileUpdates.role = role;

		if (Object.keys(profileUpdates).length > 0) {
			const { error: profileError } = await supabaseAdmin.from('users').update(profileUpdates).eq('id_user', id_user);
			if (profileError) {
				console.error('Profile Update Error:', profileError.message);
				return NextResponse.json({ error: 'Gagal mengupdate profil.' }, { status: 500 });
			}
		}

		return NextResponse.json({ success: true, message: 'Informasi pengguna berhasil dimutakhirkan.' }, { status: 200 });
	} catch (error) {
		console.error('Error PUT Pengguna:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan pembaruan sistem.' }, { status: 500 });
	}
}

// ---------------------------------------------------------------------------
// METHOD DELETE - Mencabut Hak Akses
// ---------------------------------------------------------------------------
export async function DELETE(req) {
	try {
		const roleHeader = req.headers.get('x-user-role');
		const loggedInUserId = req.headers.get('x-user-id');
		
		if (roleHeader !== 'Admin') {
			return NextResponse.json({ error: 'Akses Ditolak: Khusus Admin.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id_user = searchParams.get('id_user');

		if (!id_user) {
			return NextResponse.json({ error: 'ID Pengguna wajib dikirimkan.' }, { status: 400 });
		}

		if (loggedInUserId === id_user) {
			return NextResponse.json({ error: 'Peringatan: Anda tidak diizinkan menghapus akun Anda sendiri selagi aktif.' }, { status: 403 });
		}

		const supabase = await createClient();
		const { data: userProfile, error: fetchError } = await supabase
			.from('users')
			.select('auth_id')
			.eq('id_user', id_user)
			.single();

		if (fetchError || !userProfile) {
			return NextResponse.json({ error: 'Akun gagal dihapus (Tidak Ditemukan).' }, { status: 404 });
		}

		// Delete dari Supabase Auth, otomatis trigger ON DELETE CASCADE ke public.users dan guru_kbm
		const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userProfile.auth_id);

		if (deleteAuthError) {
			console.error('Delete Auth Error:', deleteAuthError.message);
			return NextResponse.json({ error: 'Gagal menghapus kredensial auth.' }, { status: 500 });
		}

		return NextResponse.json({ success: true, message: 'Akun Pengguna dicabut selamanya.' }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE Pengguna:', error);
		return NextResponse.json({ error: 'Kegagalan komunikasi database internal.' }, { status: 500 });
	}
}
