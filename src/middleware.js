import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Next.js Middleware — Auto-refresh Supabase Auth Token
 *
 * Middleware ini WAJIB ada agar token Supabase (yang expire tiap ~1 jam)
 * di-refresh secara otomatis di setiap request. Tanpa ini, sesi akan mati
 * setelah 1 jam meskipun cookie `auth_session_valid` masih hidup.
 *
 * Referensi: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request) {
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					// Perbarui cookie di request object terlebih dahulu
					cookiesToSet.forEach(({ name, value }) =>
						request.cookies.set(name, value)
					);
					// Buat response baru agar bisa menyisipkan cookie yang diperbarui
					supabaseResponse = NextResponse.next({ request });
					// Sisipkan cookie ke response agar browser ikut memperbarui
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					);
				},
			},
		}
	);

	// PENTING: Panggilan getUser() di sini adalah yang memicu token refresh otomatis.
	// Jangan hapus atau pindahkan baris ini.
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;

	// Rute yang dikecualikan dari pengecekan autentikasi
	const isLoginPage = pathname === '/login';
	const isApiRoute = pathname.startsWith('/api/');
	const isPublicAsset = pathname.startsWith('/_next/') || pathname.startsWith('/favicon');
	const isOfflinePage = pathname === '/offline';

	// Jika bukan rute publik dan user belum terautentikasi → redirect ke login
	if (!user && !isLoginPage && !isApiRoute && !isPublicAsset && !isOfflinePage) {
		const url = request.nextUrl.clone();
		url.pathname = '/login';
		url.searchParams.set('expired', '1');
		return NextResponse.redirect(url);
	}

	// Jika user sudah login dan mencoba akses halaman login → redirect ke dashboard
	if (user && isLoginPage) {
		const url = request.nextUrl.clone();
		url.pathname = '/';
		url.searchParams.delete('expired');
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		/*
		 * Jalankan middleware di semua route kecuali:
		 * - _next/static  (file statis Next.js)
		 * - _next/image   (optimasi gambar Next.js)
		 * - favicon.ico   (favicon browser)
		 */
		'/((?!_next/static|_next/image|favicon.ico|faviconwhite.ico).*)',
	],
};
