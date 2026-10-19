import { haversine, formatDistance } from '@/lib/haversine';

/**
 * Memvalidasi apakah permintaan berada di dalam area geofence sekolah.
 * 
 * @param {Object} options
 * @param {Object} options.supabase Klien Supabase (server atau admin)
 * @param {number|string|null} options.userLat Koordinat latitude dari perangkat user
 * @param {number|string|null} options.userLng Koordinat longitude dari perangkat user
 * @param {string} [options.moduleName='absensi'] Nama modul ('jurnal' atau 'absensi')
 * @param {string} [options.role] Peran pengguna (Admin dilewati dari validasi)
 * @returns {Promise<{ allowed: boolean, status?: number, error?: string, distance?: number }>}
 */
export async function verifyGeofence({ supabase, userLat, userLng, moduleName = 'absensi', role }) {
	// Administrator dikecualikan dari batasan geofencing
	if (role === 'Admin') {
		return { allowed: true };
	}

	try {
		const { data: geofenceSetting, error } = await supabase
			.from('app_settings')
			.select('value')
			.eq('key', 'geofence')
			.maybeSingle();

		if (error || !geofenceSetting?.value) {
			return { allowed: true };
		}

		const geofence = geofenceSetting.value;
		if (!geofence.enabled) {
			return { allowed: true };
		}

		const berlakuUntuk = Array.isArray(geofence.berlaku_untuk)
			? geofence.berlaku_untuk
			: ['jurnal'];

		// Jika geofence tidak diaktifkan untuk modul ini, loloskan
		if (!berlakuUntuk.includes(moduleName)) {
			return { allowed: true };
		}

		// Jika lokasi tidak dikirim
		if (userLat === undefined || userLng === undefined || userLat === null || userLng === null || userLat === '' || userLng === '') {
			return {
				allowed: false,
				status: 403,
				error: `Akses Lokasi Wajib: Sistem pembatasan area aktif untuk ${geofence.nama_lokasi || 'Area Sekolah'}. Harap aktifkan GPS dan izinkan akses lokasi di browser Anda untuk mengisi ${moduleName === 'absensi' ? 'absensi' : 'jurnal'}.`,
			};
		}

		const distance = haversine(userLat, userLng, geofence.lat, geofence.lng);
		const maxRadius = Number(geofence.radius) || 200;

		if (distance > maxRadius) {
			return {
				allowed: false,
				status: 403,
				error: `Di Luar Radius: Anda terdeteksi berada ${formatDistance(distance)} dari ${geofence.nama_lokasi || 'Sekolah'} (radius izin: ${maxRadius}m). Pengisian ${moduleName === 'absensi' ? 'absensi' : 'jurnal'} hanya dapat dilakukan dari lingkungan sekolah.`,
			};
		}

		return { allowed: true, distance: Math.round(distance) };
	} catch (err) {
		console.warn('⚠️ Server geofence verification bypassed due to error:', err.message);
		return { allowed: true };
	}
}
