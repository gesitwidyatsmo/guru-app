import { supabaseAdmin } from '@/utils/supabase/admin';

// In-memory cache agar response SSR sub-millisecond (0ms DB roundtrip)
let cachedBranding = null;
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 menit

/**
 * Mengambil logo dan nama sekolah langsung di Server (SSR)
 * Sangat cepat dan bebas latency karena menggunakan in-memory cache
 */
export async function getSchoolBranding(forceRefresh = false) {
	const now = Date.now();
	if (!forceRefresh && cachedBranding && now - lastFetchTime < CACHE_TTL) {
		return cachedBranding;
	}

	try {
		const { data, error } = await supabaseAdmin
			.from('app_settings')
			.select('value')
			.eq('key', 'profil_sekolah')
			.maybeSingle();

		if (error) {
			console.warn('Gagal memuat profil_sekolah untuk branding:', error.message);
			return cachedBranding || { logo: null, nama: null };
		}

		const val = data?.value || {};
		const logo = val.logo_kiri || val.logo_kanan || null;
		const nama = val.nama_sekolah || null;

		cachedBranding = { logo, nama };
		lastFetchTime = now;
		return cachedBranding;
	} catch (err) {
		console.warn('Error getSchoolBranding:', err);
		return cachedBranding || { logo: null, nama: null };
	}
}

/**
 * Reset cache branding saat admin mengubah profil sekolah
 */
export function clearSchoolBrandingCache() {
	cachedBranding = null;
	lastFetchTime = 0;
}
