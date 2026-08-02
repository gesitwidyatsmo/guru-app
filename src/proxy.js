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
	// Gunakan singleton supabaseAdmin (bukan re-create setiap request)
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

	// Pengecekan Kustom Sesi (2 Jam vs 7 Hari)
	// auth_session_valid adalah cookie kustom yang di-set saat login.
	// Jika Supabase session masih valid tapi cookie ini tidak ada → sesi dianggap kedaluwarsa.
	const isDev = process.env.NODE_ENV === 'development';
	const hasCustomSession = request.cookies.has('auth_session_valid');

	// Deteksi apakah app berjalan dalam PWA standalone mode.
	// Di standalone mode, cookie browser tidak selalu diwariskan ke webview (terutama iOS),
	// sehingga auth_session_valid bisa tidak ada meski Supabase session valid.
	// Deteksi: sec-fetch-site tidak ada = kemungkinan standalone / direct navigation.
	const isStandalone =
		!request.headers.get('sec-fetch-site') ||
		request.headers.get('display-mode') === 'standalone';

	// --- FIX UTAMA: Normalisasi payload berdasarkan validitas sesi kustom ---
	// Jika payload ada (Supabase session OK) TAPI cookie kustom tidak ada
	// DAN bukan dev DAN bukan standalone → anggap sesi sudah tidak valid
	if (payload && !isDev && !hasCustomSession && !isStandalone) {
		// Set payload ke null agar logika routing di bawah menganggap user belum login.
		// Ini mencegah loop: middleware tidak akan redirect dari /login ke /
		// karena payload sudah null ketika sampai ke blok route protection di bawah.
		payload = null;

		// Jika user sudah berada di halaman login, biarkan saja (tidak perlu redirect)
		if (pathname === '/login') {
			return supabaseResponse;
		}

		// Untuk API routes, kembalikan 401
		if (pathname.startsWith('/api')) {
			return NextResponse.json({ error: 'Sesi kedaluwarsa' }, { status: 401 });
		}

		// Redirect ke login dengan flag expired — hanya untuk halaman non-public
		if (!isPublicRoute) {
			const loginUrl = new URL('/login?expired=1', request.url);
			const redirectResponse = NextResponse.redirect(loginUrl);
			// Salin Supabase cookies ke redirect response agar tidak hilang
			supabaseResponse.cookies.getAll().forEach(c =>
				redirectResponse.cookies.set(c.name, c.value, c)
			);
			return redirectResponse;
		}
	}

	// --- Route Protection Logic ---

	// Halaman login: jika sudah punya sesi valid, redirect ke dashboard
	if (pathname === '/login' && payload) {
		const destination = payload.role === 'Admin' ? '/admin/pengguna' : '/';
		return NextResponse.redirect(new URL(destination, request.url));
	}

	// Area admin: hanya bisa diakses oleh role Admin
	if (pathname.startsWith('/admin') && payload?.role !== 'Admin') {
		// FIX: Jika user tidak punya session sama sekali, redirect ke login, bukan ke /
		// Ini mencegah loop: non-admin tanpa session → / → /login → loop
		if (!payload) {
			return NextResponse.redirect(new URL('/login', request.url));
		}
		return NextResponse.redirect(new URL('/', request.url));
	}

	// Route private: harus login
	if (!isPublicRoute && !payload) {
		if (pathname.startsWith('/api')) {
			return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
		}
		return NextResponse.redirect(new URL('/login', request.url));
	}

	// Sisipkan custom headers untuk kemudahan API Routes membaca session
	if (payload) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set('x-user-role', payload.role);
		requestHeaders.set('x-user-id', payload.id);
		requestHeaders.set('x-user-name', encodeURIComponent(payload.nama_lengkap));

		// Ambil cookie yang mungkin sudah di-set oleh Supabase di response sebelumnya
		const cookiesToPreserve = supabaseResponse.cookies.getAll();

		// Buat response baru dengan request headers yang dimodifikasi
		supabaseResponse = NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});

		// Kembalikan cookie-cookie tersebut ke response yang baru
		cookiesToPreserve.forEach(c => supabaseResponse.cookies.set(c.name, c.value, c));
	}

	return supabaseResponse;
}
