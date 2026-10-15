'use client';

import { useState, useCallback } from 'react';

/**
 * Custom hook untuk mengambil lokasi GPS pengguna dari browser Geolocation API.
 */
export function useGeolocation() {
	const [location, setLocation] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

	const getPosition = useCallback((customOptions = {}) => {
		return new Promise((resolve, reject) => {
			if (typeof window === 'undefined' || !navigator.geolocation) {
				const errMsg = 'Geolocation tidak didukung oleh browser Anda.';
				setError(errMsg);
				return reject(new Error(errMsg));
			}

			setLoading(true);
			setError(null);

			const options = {
				enableHighAccuracy: true,
				timeout: 15000,
				maximumAge: 10000,
				...customOptions,
			};

			navigator.geolocation.getCurrentPosition(
				(position) => {
					const coords = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
						accuracy: position.coords.accuracy,
						timestamp: position.timestamp,
					};
					setLocation(coords);
					setLoading(false);
					resolve(coords);
				},
				(err) => {
					let errMsg = 'Gagal mendeteksi lokasi perangkat.';
					switch (err.code) {
						case err.PERMISSION_DENIED:
							errMsg = 'Akses lokasi ditolak. Harap izinkan akses lokasi (GPS) di browser untuk melanjutkan.';
							break;
						case err.POSITION_UNAVAILABLE:
							errMsg = 'Informasi lokasi tidak tersedia. Pastikan GPS perangkat aktif.';
							break;
						case err.TIMEOUT:
							errMsg = 'Waktu permintaan lokasi habis. Silakan coba lagi.';
							break;
						default:
							errMsg = err.message || errMsg;
					}
					setError(errMsg);
					setLoading(false);
					reject(new Error(errMsg));
				},
				options
			);
		});
	}, []);

	const reset = useCallback(() => {
		setLocation(null);
		setError(null);
		setLoading(false);
	}, []);

	return {
		getPosition,
		location,
		error,
		loading,
		reset,
	};
}
