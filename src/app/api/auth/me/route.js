import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(req) {
	try {
		// Ambil token dari cookie (NextJS v13+)
		const token = req.cookies.get('token')?.value;

		if (!token) {
			return NextResponse.json({ error: 'Belum login', user: null }, { status: 401 });
		}

		// Verifikasi JWT token
		const payload = await verifyAuth(token);

		// Jika lolos, kirim profil user
		return NextResponse.json(
			{
				message: 'Terautentikasi',
				user: {
					id: payload.id,
					username: payload.username,
					nama_lengkap: payload.nama_lengkap,
					role: payload.role, // 'Admin' | 'Guru'
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		// Token invalid atau kedaluwarsa
		return NextResponse.json({ error: 'Sesi tidak valid', user: null }, { status: 401 });
	}
}
