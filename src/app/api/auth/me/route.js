import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
	try {
		const supabase = await createClient();
		
		// Dapatkan user dari sesi saat ini
		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: 'Belum login', user: null }, { status: 401 });
		}

		// Ambil data profil dari public.users
		const { data: userProfile, error: profileError } = await supabase
			.from('users')
			.select('id_user, username, nama_lengkap, role')
			.eq('auth_id', user.id)
			.single();

		if (profileError || !userProfile) {
			return NextResponse.json({ error: 'Profil tidak valid', user: null }, { status: 401 });
		}

		// Jika lolos, kirim profil user
		return NextResponse.json(
			{
				message: 'Terautentikasi',
				user: {
					id: userProfile.id_user,
					username: userProfile.username,
					nama_lengkap: userProfile.nama_lengkap,
					role: userProfile.role, // 'Admin' | 'Guru'
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error Auth Me:', error);
		return NextResponse.json({ error: 'Sesi tidak valid', user: null }, { status: 401 });
	}
}
