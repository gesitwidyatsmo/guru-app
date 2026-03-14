import { NextResponse } from 'next/server';

export async function GET() {
	// Buat respons sukses logout
	const response = NextResponse.json({ message: 'Berhasil logout' }, { status: 200 });

	// Timpa/Hapus cookie bernama 'token'
	response.cookies.set('token', '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		expires: new Date(0), // Set kadaluarsa ke masa lampau
		path: '/',
	});

	return response;
}
