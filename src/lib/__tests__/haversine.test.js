import { haversine, formatDistance, isWithinGeofence } from '../haversine';

describe('haversine utility', () => {
	it('should return 0 when comparing identical coordinates', () => {
		const distance = haversine(-6.2, 106.816666, -6.2, 106.816666);
		expect(distance).toBe(0);
	});

	it('should calculate distance accurately between two known points in Jakarta', () => {
		// Monas (-6.175392, 106.827153) to Bundaran HI (-6.195044, 106.823023) ~ 2.2 km
		const distance = haversine(-6.175392, 106.827153, -6.195044, 106.823023);
		expect(distance).toBeGreaterThan(2100);
		expect(distance).toBeLessThan(2350);
	});

	it('should handle null or invalid parameters safely without throwing', () => {
		expect(haversine(null, null, -6.2, 106.8)).toBe(Infinity);
		expect(haversine(undefined, 106.8, -6.2, 106.8)).toBe(Infinity);
		expect(haversine('invalid', 106.8, -6.2, 106.8)).toBe(Infinity);
	});
});

describe('formatDistance', () => {
	it('should format meters below 1000m correctly', () => {
		expect(formatDistance(85.4)).toBe('85 meter');
		expect(formatDistance(450)).toBe('450 meter');
	});

	it('should format kilometers for 1000m and above', () => {
		expect(formatDistance(1500)).toBe('1.50 km');
		expect(formatDistance(2340)).toBe('2.34 km');
	});

	it('should handle invalid or infinity values', () => {
		expect(formatDistance(Infinity)).toBe('-');
	});
});

describe('isWithinGeofence', () => {
	const schoolLat = -6.200000;
	const schoolLng = 106.816666;
	const radius = 200; // 200 meters

	it('should identify a position inside radius', () => {
		// Very close to school (~20m away)
		const userLat = -6.200150;
		const userLng = 106.816666;
		const result = isWithinGeofence(userLat, userLng, schoolLat, schoolLng, radius);

		expect(result.isInside).toBe(true);
		expect(result.distance).toBeLessThanOrEqual(radius);
		expect(result.allowedRadius).toBe(radius);
	});

	it('should identify a position outside radius', () => {
		// ~1 km away
		const userLat = -6.210000;
		const userLng = 106.816666;
		const result = isWithinGeofence(userLat, userLng, schoolLat, schoolLng, radius);

		expect(result.isInside).toBe(false);
		expect(result.distance).toBeGreaterThan(radius);
	});

	it('should allow marginal distance within GPS accuracy buffer', () => {
		// Jarak ~220 meter (sedikit di luar 200m), tapi akurasi GPS HP ±40m (buffer 20m)
		// dLat ~0.00198 ~ 220 meter
		const userLat = -6.201980;
		const userLng = 106.816666;
		
		// Tanpa akurasi, ditolak
		const resultStrict = isWithinGeofence(userLat, userLng, schoolLat, schoolLng, radius);
		expect(resultStrict.distance).toBeGreaterThan(200);
		expect(resultStrict.isInside).toBe(false);

		// Dengan akurasi 40m (buffer 20m), efektif distance <= 200m sehingga diizinkan
		const resultBuffered = isWithinGeofence(userLat, userLng, schoolLat, schoolLng, radius, 40);
		expect(resultBuffered.accuracyBuffer).toBe(20);
		expect(resultBuffered.effectiveDistance).toBeLessThanOrEqual(radius);
		expect(resultBuffered.isInside).toBe(true);
	});

	it('should cap accuracy buffer at maximum 40 meters to prevent spoofing', () => {
		// Jarak 260m dari sekolah, akurasi sangat buruk misal 200m
		const userLat = -6.202350;
		const userLng = 106.816666;

		const result = isWithinGeofence(userLat, userLng, schoolLat, schoolLng, radius, 200);
		// Buffer dibatasi maksimal 40m
		expect(result.accuracyBuffer).toBe(40);
		expect(result.isInside).toBe(false);
	});
});
