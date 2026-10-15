/**
 * Menghitung jarak antara dua titik koordinat GPS (dalam meter)
 * menggunakan formula Haversine.
 * 
 * @param {number} lat1 Latitude titik 1
 * @param {number} lon1 Longitude titik 1
 * @param {number} lat2 Latitude titik 2
 * @param {number} lon2 Longitude titik 2
 * @returns {number} Jarak dalam satuan meter
 */
export function haversine(lat1, lon1, lat2, lon2) {
	if (
		lat1 === undefined || lat1 === null ||
		lon1 === undefined || lon1 === null ||
		lat2 === undefined || lat2 === null ||
		lon2 === undefined || lon2 === null
	) {
		return Infinity;
	}

	const p1 = Number(lat1);
	const l1 = Number(lon1);
	const p2 = Number(lat2);
	const l2 = Number(lon2);

	if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) {
		return Infinity;
	}

	const R = 6371000; // Radius rata-rata bumi dalam meter
	const toRad = (deg) => (deg * Math.PI) / 180;

	const dLat = toRad(p2 - p1);
	const dLon = toRad(l2 - l1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(p1)) * Math.cos(toRad(p2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Format jarak menjadi string yang mudah dibaca pengguna
 * @param {number} meters 
 * @returns {string} Contoh: "85 meter" atau "1.4 km"
 */
export function formatDistance(meters) {
	if (!isFinite(meters)) return '-';
	if (meters < 1000) {
		return `${Math.round(meters)} meter`;
	}
	return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Memeriksa apakah lokasi pengguna berada dalam radius geofence
 */
export function isWithinGeofence(userLat, userLng, targetLat, targetLng, radiusMeters) {
	const distance = haversine(userLat, userLng, targetLat, targetLng);
	return {
		isInside: distance <= radiusMeters,
		distance: Math.round(distance),
		allowedRadius: radiusMeters,
	};
}
