'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Deteksi apakah pengguna membuka halaman dari In-App Browser (seperti WhatsApp, Instagram, FB)
 * yang sering membatasi atau merusak fungsionalitas Geolocation API.
 */
export function checkIsInAppBrowser() {
	if (typeof window === 'undefined' || !navigator?.userAgent) return false;
	const ua = navigator.userAgent || '';
	return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|BytedanceWebview/i.test(ua);
}

/**
 * Custom hook untuk mengambil lokasi GPS pengguna dari browser Geolocation API
 * dengan mekanisme Progressive Refinement (penghangatan GPS bertahap),
 * evaluasi tingkat akurasi (accuracy margin), dan fallback otomatis jika sinyal satelit lemah di dalam ruangan.
 */
export function useGeolocation() {
	const [location, setLocation] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const activeCleanupRef = useRef(null);

	// Bersihkan watcher/timer aktif jika komponen di-unmount
	useEffect(() => {
		return () => {
			if (activeCleanupRef.current) {
				activeCleanupRef.current();
			}
		};
	}, []);

	const getPosition = useCallback((customOptions = {}) => {
		return new Promise((resolve, reject) => {
			if (typeof window === 'undefined' || !navigator?.geolocation) {
				const errMsg = 'Geolocation tidak didukung oleh browser Anda.';
				setError(errMsg);
				return reject(new Error(errMsg));
			}

			// Bersihkan sesi sebelumnya jika masih ada yang berjalan
			if (activeCleanupRef.current) {
				activeCleanupRef.current();
			}

			setLoading(true);
			setError(null);

			const inApp = checkIsInAppBrowser();

			const getFriendlyErrorMessage = (err) => {
				let msg = 'Gagal mendeteksi lokasi perangkat.';
				switch (err?.code) {
					case 1: // PERMISSION_DENIED
						msg = 'Akses lokasi ditolak. Harap izinkan akses lokasi (GPS) di setelan browser Anda.';
						if (inApp) {
							msg += ' (Anda terdeteksi membuka dari WhatsApp / In-App Browser. Buka menu titik 3 lalu pilih "Buka di Chrome" atau "Buka di Safari").';
						}
						break;
					case 2: // POSITION_UNAVAILABLE
						msg = 'Informasi lokasi GPS tidak tersedia. Pastikan fitur Lokasi (GPS) dan "Akurasi Lokasi Google" HP Anda sudah aktif.';
						break;
					case 3: // TIMEOUT
						msg = 'Waktu pencarian sinyal GPS habis. Silakan coba lagi di dekat jendela/area terbuka, atau buka aplikasi Google Maps sebentar agar GPS HP terkunci.';
						break;
					default:
						msg = err?.message || msg;
				}
				return msg;
			};

			let isResolved = false;
			let watchId = null;
			let fallbackTimeoutId = null;
			let settleTimerId = null;
			let bestCoords = null;

			const cleanup = () => {
				if (watchId !== null && navigator?.geolocation) {
					try {
						navigator.geolocation.clearWatch(watchId);
					} catch {}
					watchId = null;
				}
				if (fallbackTimeoutId) {
					clearTimeout(fallbackTimeoutId);
					fallbackTimeoutId = null;
				}
				if (settleTimerId) {
					clearTimeout(settleTimerId);
					settleTimerId = null;
				}
				activeCleanupRef.current = null;
			};

			activeCleanupRef.current = cleanup;

			const finishSuccess = (coords) => {
				if (isResolved) return;
				isResolved = true;
				cleanup();
				setLocation(coords);
				setLoading(false);
				resolve(coords);
			};

			const finishError = (err) => {
				if (isResolved) return;
				isResolved = true;
				cleanup();
				const friendlyMsg = getFriendlyErrorMessage(err);
				setError(friendlyMsg);
				setLoading(false);
				reject(new Error(friendlyMsg));
			};

			// Fallback mechanism: jika High Accuracy timeout atau gagal di dalam ruangan beton
			const triggerFallback = () => {
				if (isResolved) return;
				if (bestCoords) {
					// Jika sudah sempat menangkap koordinat meski akurasi menengah, gunakan yang terbaik
					finishSuccess(bestCoords);
					return;
				}

				// Coba satu kali lagi dengan mode akurasi jaringan (Wi-Fi/Cellular) yang tembus indoor
				try {
					navigator.geolocation.getCurrentPosition(
						(pos) => {
							const coords = {
								lat: pos.coords.latitude,
								lng: pos.coords.longitude,
								accuracy: pos.coords.accuracy,
								timestamp: pos.timestamp,
								isFallback: true,
							};
							finishSuccess(coords);
						},
						(err) => {
							finishError(err);
						},
						{
							enableHighAccuracy: false,
							timeout: 7000,
							maximumAge: 15000,
						}
					);
				} catch (fallbackErr) {
					finishError(fallbackErr);
				}
			};

			// Mulai pemantauan sinyal GPS bertahap (Progressive GPS Refinement)
			try {
				watchId = navigator.geolocation.watchPosition(
					(position) => {
						const coords = {
							lat: position.coords.latitude,
							lng: position.coords.longitude,
							accuracy: position.coords.accuracy,
							timestamp: position.timestamp,
						};

						// Simpan koordinat dengan akurasi terbaik sejauh ini
						if (!bestCoords || coords.accuracy < bestCoords.accuracy) {
							bestCoords = coords;
						}

						// Jika akurasi sangat presisi (<= 25 meter), satelit sudah terkunci sempurna
						if (bestCoords.accuracy <= 25) {
							if (!settleTimerId) {
								settleTimerId = setTimeout(() => {
									finishSuccess(bestCoords);
								}, 400);
							}
							return;
						}

						// Jika akurasi belum <= 25m, berikan jeda pemanasan 3.5 detik untuk menunggu satelit tambahan
						if (!settleTimerId) {
							settleTimerId = setTimeout(() => {
								if (bestCoords) {
									finishSuccess(bestCoords);
								}
							}, 3500);
						}
					},
					(err) => {
						// Jika akses langsung ditolak pengguna, jangan buang waktu nunggu timeout
						if (err?.code === 1) {
							finishError(err);
							return;
						}
						// Jika sinyal satelit unavailable, langsung jalankan fallback
						triggerFallback();
					},
					{
						enableHighAccuracy: true,
						timeout: 14000,
						maximumAge: 0,
						...customOptions,
					}
				);

				// Timeout batas atas jika watchPosition tidak memberikan callback sama sekali (blind spot)
				const totalTimeout = customOptions.timeout || 15000;
				fallbackTimeoutId = setTimeout(() => {
					triggerFallback();
				}, totalTimeout);

			} catch (watchErr) {
				triggerFallback();
			}
		});
	}, []);

	const reset = useCallback(() => {
		if (activeCleanupRef.current) {
			activeCleanupRef.current();
		}
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
		isInAppBrowser: typeof window !== 'undefined' ? checkIsInAppBrowser() : false,
	};
}
