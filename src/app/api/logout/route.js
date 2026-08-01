import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

async function logoutHandler() {
	try {
		const supabase = await createClient();
		
		// Logout dari sesi Supabase Auth
		await supabase.auth.signOut();

		const response = NextResponse.json({ message: 'Berhasil logout' }, { status: 200 });

		// Bersihkan cookie legacy 'token' jika masih tersisa
		response.cookies.set('token', '', { expires: new Date(0), path: '/' });

		// Bersihkan cookie sesi kustom — WAJIB agar middleware tidak salah baca state
		response.cookies.set('auth_session_valid', '', {
			expires: new Date(0),
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
		});

		return response;
	} catch (error) {
		console.error('Logout error:', error);
		return NextResponse.json({ error: 'Gagal logout' }, { status: 500 });
	}
}

export const GET = logoutHandler;
export const POST = logoutHandler;
