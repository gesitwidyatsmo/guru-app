import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/utils/supabase/admin';

export const config = {
	matcher: [
		// Kecualikan semua aset statis Next.js DAN aset PWA agar tidak di-intercept middleware
		'/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|manifest\\.json|sw\\.js|workbox-.*\\.js|fallback-.*\\.js|swe-worker-.*\\.js|android\\/.*|ios\\/.*|windows\\/.*|screenshots\\/.*|icon.*\\.png|icon.*\\.svg|icon\\.svg|gwa\\.svg|logo.*\\.png).*)',
	],
};

export async function proxy(request) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					);
				},
			},
		}
	);

	const { pathname } = request.nextUrl;
	const publicRoutes = [
		'/login',
		'/soal',
		'/api/soal',
		'/api/login',
		'/api/logout',
		'/api/kelas',
		'/api/siswa',
		'/offline',        // PWA: halaman fallback saat offline harus bisa diakses tanpa login
		'/manifest.json',  // PWA: manifest harus selalu bisa diakses
	];
	const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

	const {
		data: { user },
	} = await supabase.auth.getUser();

	let payload = null;

	// Jika terautentikasi di Supabase, ambil detail role dan ID dari tabel public.users
	if (user) {
		const { data: userProfile, error } = await supabaseAdmin
			.from('users')
			.select('id_user, role, nama_lengkap')
			.eq('auth_id', user.id)
			.single();

		if (error) console.error('Proxy Profile Fetch Error:', error.message);

		if (userProfile) {
			payload = {
				id: userProfile.id_user,
				role: userProfile.role,
				nama_lengkap: userProfile.nama_lengkap,
			};
		}
	}

	// --- Route Protection Logic ---
	let finalResponse;

	// Halaman login: jika sudah punya sesi valid, redirect ke dashboard
	if (pathname === '/login' && payload) {
		const destination = payload.role === 'Admin' ? '/admin' : '/';
		finalResponse = NextResponse.redirect(new URL(destination, request.url));
	}
	// Area admin: hanya bisa diakses oleh role Admin
	else if (pathname.startsWith('/admin') && payload?.role !== 'Admin') {
		if (!payload) {
			finalResponse = NextResponse.redirect(new URL('/login', request.url));
		} else {
			finalResponse = NextResponse.redirect(new URL('/', request.url));
		}
	}
	// Route private: harus login
	else if (!isPublicRoute && !payload) {
		if (pathname.startsWith('/api')) {
			finalResponse = NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
		} else {
			finalResponse = NextResponse.redirect(new URL('/login', request.url));
		}
	}
	// Lolos pengecekan dan memiliki sesi valid
	else if (payload) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set('x-user-role', payload.role);
		requestHeaders.set('x-user-id', payload.id);
		requestHeaders.set('x-user-name', encodeURIComponent(payload.nama_lengkap));

		// Buat response baru dengan request headers yang dimodifikasi
		finalResponse = NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});

		// Auto-renew auth_session_valid
		const hasCustomSession = request.cookies.has('auth_session_valid');
		if (!hasCustomSession) {
			finalResponse.cookies.set('auth_session_valid', 'true', {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				path: '/',
				maxAge: 2 * 60 * 60, // 2 jam
			});
		}
	} 
	// Route publik tanpa login
	else {
		finalResponse = NextResponse.next({ request });
	}

	// PENTING: Kembalikan semua cookie yang telah di-set atau dihapus oleh Supabase
	// ke finalResponse. Hal ini agar browser mendapatkan update (seperti logout).
	const cookiesToPreserve = supabaseResponse.cookies.getAll();
	cookiesToPreserve.forEach(c => finalResponse.cookies.set(c.name, c.value, c));

	return finalResponse;
}
