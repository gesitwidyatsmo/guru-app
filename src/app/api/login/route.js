import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(req) {
	try {
		const { username, password, rememberMe } = await req.json();

		if (!username || !password) {
			return NextResponse.json({ error: 'Username dan Password wajib diisi.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		// Gunakan dummy email format karena Supabase Auth butuh format email
		const email = `${username}@guruapp.com`;

		const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (authError || !authData.user) {
			console.error('Supabase Auth Error:', authError?.message);
			return NextResponse.json({ error: 'Kredensial Anda salah.' }, { status: 401 });
		}

		// Ambil profil dari tabel public.users
		const { data: userProfile, error: profileError } = await supabaseAdmin
			.from('users')
			.select('id_user, username, nama_lengkap, role')
			.eq('auth_id', authData.user.id)
			.single();

		if (profileError || !userProfile) {
			console.error('Profile Fetch Error:', profileError?.message);
			// Fallback log
			return NextResponse.json({ error: 'Profil tidak ditemukan.' }, { status: 401 });
		}

		const tokenPayload = {
			id: userProfile.id_user,
			username: userProfile.username,
			nama_lengkap: userProfile.nama_lengkap,
			role: userProfile.role,
		};

		// Supabase Auth SSR mengatur cookies secara otomatis melalui metode setAll di server client
		// Hapus legacy 'token' cookie agar tidak bentrok
		const response = NextResponse.json(
			{
				message: 'Login sukses',
				user: tokenPayload,
			},
			{ status: 200 },
		);

		// Hapus legacy 'token' cookie agar tidak bentrok
		response.cookies.set('token', '', { expires: new Date(0), path: '/' });

		// Set cookie custom untuk mengatur limit maksimal sesi (2 Jam vs 7 Hari)
		const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 2 * 60 * 60; // 7 Hari vs 2 Jam
		response.cookies.set('auth_session_valid', 'true', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: maxAge,
		});

		return response;
	} catch (error) {
		console.error('Error saat Login:', error);
		return NextResponse.json({ error: 'Terjadi kesalahan sistem internal.' }, { status: 500 });
	}
}
