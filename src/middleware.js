import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico).*)',
	],
};

export async function middleware(request) {
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
					cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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
	const publicRoutes = ['/login', '/soal', '/api/soal', '/api/login', '/api/logout', '/api/kelas', '/api/siswa'];
	const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

	const {
		data: { user },
	} = await supabase.auth.getUser();

	let payload = null;

	// Jika terautentikasi di Supabase, ambil detail role dan ID dari tabel public.users
	if (user) {
		const { createClient } = await import('@supabase/supabase-js');
		const supabaseAdmin = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		);
		const { data: userProfile, error } = await supabaseAdmin
			.from('users')
			.select('id_user, role, nama_lengkap')
			.eq('auth_id', user.id)
			.single();
		
		if (error) console.error('Middleware Profile Fetch Error:', error.message);

		if (userProfile) {
			payload = {
				id: userProfile.id_user,
				role: userProfile.role,
				nama_lengkap: userProfile.nama_lengkap,
			};
		}
	}

	// Route Protection Logic
	if (isPublicRoute && payload && pathname === '/login') {
		if (payload.role === 'Admin') {
			return NextResponse.redirect(new URL('/admin/pengguna', request.url));
		}
		return NextResponse.redirect(new URL('/', request.url));
	}

	if (pathname.startsWith('/admin') && payload?.role !== 'Admin') {
		return NextResponse.redirect(new URL('/', request.url));
	}

	if (!isPublicRoute && !payload) {
		if (pathname.startsWith('/api')) {
			return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
		}
		return NextResponse.redirect(new URL('/login', request.url));
	}

	// Sisipkan custom headers untuk kemudahan API Routes membaca session
	if (payload) {
		// Mengirimkan header ke response (jika dibutuhkan)
		supabaseResponse.headers.set('x-user-role', payload.role);
		supabaseResponse.headers.set('x-user-id', payload.id);
		supabaseResponse.headers.set('x-user-name', encodeURIComponent(payload.nama_lengkap));

		// YANG PALING PENTING: Mengirimkan header ke DOWNSTREAM API ROUTES
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
