import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Helper get secret key untuk environment Edge (Middleware wajib pakai Jose, beda dengan jsonwebtoken biasa)
const getJwtSecretKey = () => {
	const secret = process.env.JWT_SECRET_KEY;
	if (!secret || secret.length === 0) {
		return 'super-secret-key-guru-app-antigravity';
	}
	return secret;
};

// Konfigurasi path mana yang diurus middleware
export const config = {
	matcher: [
		/*
		 * Match semua request path KECUALI yang diawali dengan:
		 * - api/login, api/logout (Auth routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!api/login|api/logout|_next/static|_next/image|favicon.ico).*)',
	],
};

export async function middleware(request) {
	const { pathname } = request.nextUrl;

	// Daftar rute public yang tidak perlu login
	const publicRoutes = ['/login', '/soal', '/api/soal'];

	// 1. Apakah sedang mencoba akses rute Publik?
	const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

	// 2. Ambil token dari cookie
	const token = request.cookies.get('token')?.value;

	try {
		let payload = null;
		if (token) {
			// 3. Verifikasi JWT Edge-compatible
			const verified = await jwtVerify(token, new TextEncoder().encode(getJwtSecretKey()));
			payload = verified.payload;
		}

		// Bila Sedang di /login tapi SUDAH punya Token Valid -> Tendang ke Home / Admin
		if (isPublicRoute && payload) {
			if (payload.role === 'Admin') {
				return NextResponse.redirect(new URL('/admin/pengguna', request.url));
			}
			return NextResponse.redirect(new URL('/', request.url));
		}

		// Blokir perlindungan rute eksklusif Portal Admin
		if (pathname.startsWith('/admin') && payload?.role !== 'Admin') {
			return NextResponse.redirect(new URL('/', request.url));
		}

		// Bila Sedang di route Private tapi TIDAK punya Token Valid -> Tendang ke /login
		if (!isPublicRoute && !payload) {
			// Kalau requestnya ke API endpoint, kembalikan JSON error 401
			if (pathname.startsWith('/api')) {
				return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
			}
			// Kalau request URL UI, redirect ke login
			return NextResponse.redirect(new URL('/login', request.url));
		}

		// Lolos validasi, lanjutkan request!
		// Menyisipkan headers tambahan (misal username) supaya bisa dibaca route API di backend
		const response = NextResponse.next();
		if (payload) {
			response.headers.set('x-user-role', payload.role);
			response.headers.set('x-user-id', payload.id);
			response.headers.set('x-user-name', encodeURIComponent(payload.nama_lengkap));
		}

		return response;
	} catch (error) {
		// Bila Sedang di route Private TAPI Token expired/salah -> Tendang ke /login
		if (!isPublicRoute) {
			// Hapus sekalian token bodongnya (Opsional)
			const response = pathname.startsWith('/api')
				? NextResponse.json({ error: 'Unauthorized: Token sudah kadaluarsa (Expired).' }, { status: 401 })
				: NextResponse.redirect(new URL('/login', request.url));

			response.cookies.set('token', '', { expires: new Date(0) });
			return response;
		}

		return NextResponse.next();
	}
}
