import { supabaseAdmin } from '@/utils/supabase/admin';

// In-memory cache agar pengecekan di middleware / proxy sub-millisecond (0ms DB roundtrip pada beban tinggi)
let cachedMaintenance = null;
let lastFetchTime = 0;
const CACHE_TTL = 3000; // 3 detik TTL

const DEFAULT_MAINTENANCE_STATE = {
	enabled: false,
	pesan: 'Mohon maaf atas ketidaknyamanannya. Website GuruApp saat ini sedang menjalani proses pemeliharaan dan pembaruan sistem secara berkala untuk meningkatkan stabilitas dan performa aplikasi.',
	estimasi_selesai: 'Segera Kembali',
	kontak_bantuan: '081277813478',
	updated_at: new Date().toISOString(),
	updated_by: 'Administrator',
	allow_admin_bypass: true,
};

/**
 * Mengambil status pemeliharaan sistem
 * Mendukung in-memory caching untuk kecepatan proxy/middleware Next.js
 */
export async function getMaintenanceStatus(forceRefresh = false) {
	const now = Date.now();
	if (!forceRefresh && cachedMaintenance && now - lastFetchTime < CACHE_TTL) {
		return cachedMaintenance;
	}

	try {
		const { data, error } = await supabaseAdmin
			.from('app_settings')
			.select('value')
			.eq('key', 'maintenance_mode')
			.maybeSingle();

		if (error) {
			console.warn('⚠️ Gagal membaca status pemeliharaan dari Supabase:', error.message);
			return cachedMaintenance || DEFAULT_MAINTENANCE_STATE;
		}

		if (data?.value) {
			const val = data.value;
			cachedMaintenance = {
				enabled: !!val.enabled,
				pesan: val.pesan || DEFAULT_MAINTENANCE_STATE.pesan,
				estimasi_selesai: val.estimasi_selesai || DEFAULT_MAINTENANCE_STATE.estimasi_selesai,
				kontak_bantuan: val.kontak_bantuan || DEFAULT_MAINTENANCE_STATE.kontak_bantuan,
				updated_at: val.updated_at || new Date().toISOString(),
				updated_by: val.updated_by || 'Administrator',
				allow_admin_bypass: val.allow_admin_bypass !== false,
			};
		} else {
			cachedMaintenance = DEFAULT_MAINTENANCE_STATE;
		}

		lastFetchTime = now;
		return cachedMaintenance;
	} catch (err) {
		console.warn('⚠️ Error getMaintenanceStatus:', err);
		return cachedMaintenance || DEFAULT_MAINTENANCE_STATE;
	}
}

/**
 * Update cache lokal seketika saat admin mengubah toggle
 */
export function setCachedMaintenanceStatus(val) {
	cachedMaintenance = {
		...DEFAULT_MAINTENANCE_STATE,
		...val,
		enabled: !!val.enabled,
		updated_at: new Date().toISOString(),
	};
	lastFetchTime = Date.now();
}

/**
 * Bersihkan cache
 */
export function clearMaintenanceCache() {
	cachedMaintenance = null;
	lastFetchTime = 0;
}
