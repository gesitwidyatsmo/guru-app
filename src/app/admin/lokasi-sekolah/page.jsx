'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Loader from '../../components/loading';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine, formatDistance, isWithinGeofence } from '@/lib/haversine';

export default function LokasiSekolahPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [missingTable, setMissingTable] = useState(false);

	const { getPosition, loading: gpsLoading } = useGeolocation();

	const [settings, setSettings] = useState({
		enabled: false,
		lat: -6.200000,
		lng: 106.816666,
		radius: 200,
		nama_lokasi: 'Area Sekolah',
		berlaku_untuk: ['jurnal'],
	});

	// State hasil pengujian lokasi saat ini
	const [testResult, setTestResult] = useState(null);
	const [testingGps, setTestingGps] = useState(false);

	// Provider Peta: 'interactive' (Leaflet + Circle Radius) | 'google' (Google Maps) | 'satellite' (Google Satelit)
	const [mapProvider, setMapProvider] = useState('interactive');

	// Listener saat pengguna menggeser atau klik pin di Peta Interaktif
	useEffect(() => {
		const handleMessage = (event) => {
			if (event.data?.type === 'UPDATE_COORDS') {
				const { lat, lng } = event.data;
				if (typeof lat === 'number' && typeof lng === 'number') {
					setSettings((prev) => ({
						...prev,
						lat: parseFloat(lat.toFixed(6)),
						lng: parseFloat(lng.toFixed(6)),
					}));
				}
			}
		};
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Fetch data pengaturan dari server
	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const res = await fetch('/api/settings?key=geofence');
				if (res.ok) {
					const data = await res.json();
					if (data?.value) {
						setSettings({
							enabled: !!data.value.enabled,
							lat: typeof data.value.lat === 'number' ? data.value.lat : parseFloat(data.value.lat) || -6.2,
							lng: typeof data.value.lng === 'number' ? data.value.lng : parseFloat(data.value.lng) || 106.816666,
							radius: parseInt(data.value.radius) || 200,
							nama_lokasi: data.value.nama_lokasi || 'Area Sekolah',
							berlaku_untuk: Array.isArray(data.value.berlaku_untuk) ? data.value.berlaku_untuk : ['jurnal'],
						});
					}
					if (data?._fallback) {
						setMissingTable(true);
					}
				}
			} catch (err) {
				console.error('Gagal mengambil pengaturan geofence:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchSettings();
	}, []);

	// Ambil lokasi admin saat ini dan masukkan ke input
	const handleUseCurrentLocation = async () => {
		try {
			const coords = await getPosition();
			const roundedLat = parseFloat(coords.lat.toFixed(6));
			const roundedLng = parseFloat(coords.lng.toFixed(6));

			setSettings((prev) => ({
				...prev,
				lat: roundedLat,
				lng: roundedLng,
			}));

			Swal.fire({
				icon: 'success',
				title: 'Lokasi Berhasil Terdeteksi!',
				html: `
					<div class="text-left text-sm space-y-1">
						<p><b>Latitude:</b> ${roundedLat}</p>
						<p><b>Longitude:</b> ${roundedLng}</p>
						<p class="text-xs text-gray-500">Tingkat akurasi GPS: ±${Math.round(coords.accuracy)} meter</p>
					</div>
				`,
				confirmButtonColor: '#00A693',
			});
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Mendapatkan GPS',
				text: err.message || 'Pastikan izin akses lokasi telah diberikan pada browser Anda.',
				confirmButtonColor: '#E8451A',
			});
		}
	};

	// Uji posisi admin saat ini terhadap titik sekolah yang disetel
	const handleTestDistance = async () => {
		setTestingGps(true);
		setTestResult(null);
		try {
			const coords = await getPosition();
			const check = isWithinGeofence(coords.lat, coords.lng, settings.lat, settings.lng, settings.radius);

			setTestResult({
				...check,
				userLat: coords.lat,
				userLng: coords.lng,
				accuracy: coords.accuracy,
			});
		} catch (err) {
			Swal.fire({
				icon: 'warning',
				title: 'Gagal Menguji Lokasi',
				text: err.message || 'Tidak dapat membaca koordinat GPS perangkat Anda saat ini.',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setTestingGps(false);
		}
	};

	// Simpan pengaturan ke server
	const handleSave = async (e) => {
		e?.preventDefault();
		setSaving(true);

		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: 'geofence',
					value: settings,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				if (data?.missingTable) {
					setMissingTable(true);
					throw new Error(data.error);
				}
				throw new Error(data?.error || 'Gagal menyimpan pengaturan.');
			}

			setMissingTable(false);
			Swal.fire({
				icon: 'success',
				title: 'Pengaturan Disimpan!',
				text: 'Konfigurasi geofencing sekolah telah berhasil diperbarui.',
				timer: 2000,
				showConfirmButton: false,
			});
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	// URL Google Maps Embed & External
	const googleMapUrl = `https://maps.google.com/maps?q=${settings.lat},${settings.lng}&hl=id&z=17&output=embed`;
	const googleSatelliteUrl = `https://maps.google.com/maps?q=${settings.lat},${settings.lng}&t=k&hl=id&z=18&output=embed`;
	const googleMapsExternalUrl = `https://www.google.com/maps?q=${settings.lat},${settings.lng}`;

	// Template HTML untuk Peta Interaktif Leaflet dengan visual radius & pin geser
	const interactiveLeafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; font-family: system-ui, -apple-system, sans-serif; background: #f3f4f6; }
    .custom-marker {
      background: #E8451A;
      color: white;
      border: 3px solid #0D0D0D;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 3px 3px 0px #0D0D0D;
      cursor: grab;
      user-select: none;
    }
    .custom-marker:active { cursor: grabbing; transform: scale(1.1); }
    .info-floating {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background: #0D0D0D;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 20px;
      border: 2px solid #F5C518;
      box-shadow: 2px 2px 0px rgba(0,0,0,0.5);
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="info-floating">📍 Klik peta atau geser pin 🏫 untuk set posisi</div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const lat = ${settings.lat};
    const lng = ${settings.lng};
    const radius = ${settings.radius || 200};

    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Lingkaran radius geofence
    const circle = L.circle([lat, lng], {
      color: '#00A693',
      fillColor: '#00A693',
      fillOpacity: 0.25,
      weight: 3,
      dashArray: '6, 6',
      radius: radius
    }).addTo(map);

    // Pin marker kustom
    const schoolIcon = L.divIcon({
      className: 'custom-marker',
      html: '🏫',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const marker = L.marker([lat, lng], {
      icon: schoolIcon,
      draggable: true
    }).addTo(map);

    marker.bindPopup('<b>${(settings.nama_lokasi || 'Area Sekolah').replace(/'/g, "\\'")}</b><br>Radius: ' + radius + 'm').openPopup();

    function updatePos(newLat, newLng) {
      marker.setLatLng([newLat, newLng]);
      circle.setLatLng([newLat, newLng]);
      window.parent.postMessage({ type: 'UPDATE_COORDS', lat: newLat, lng: newLng }, '*');
    }

    marker.on('dragend', function(e) {
      const pos = e.target.getLatLng();
      updatePos(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      updatePos(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>
	`;

	return (
		<div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
			{/* Alert jika tabel app_settings belum dimigrasi */}
			{missingTable && (
				<div className='bg-amber-100 border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start gap-4'>
					<span className='text-3xl'>⚠️</span>
					<div className='space-y-1.5'>
						<h3 className='font-black text-black text-sm uppercase'>Tabel Database Belum Dibuat</h3>
						<p className='text-xs text-gray-800 leading-relaxed font-medium'>
							Tabel <code className='bg-white px-1.5 py-0.5 rounded border border-black font-mono font-bold text-amber-900'>app_settings</code> belum ditemukan di database Supabase Anda.
							Jalankan file script migrasi <code className='bg-white px-1.5 py-0.5 rounded border border-black font-mono font-bold text-amber-900'>migrations/add_app_settings_geofence.sql</code> melalui menu <b>SQL Editor</b> di dashboard Supabase agar pengaturan dapat tersimpan permanen.
						</p>
					</div>
				</div>
			)}

			{/* Welcome Banner */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] relative overflow-hidden'>
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10'>
					<div className='space-y-2'>
						<div className='inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] bg-emerald-300 text-black'>
							<span>📍</span>
							<span>Geofencing & Pembatasan Area</span>
						</div>
						<h1 className='text-3xl sm:text-4xl font-black text-black tracking-tight'>
							Lokasi & Geofencing Sekolah
						</h1>
						<p className='text-sm sm:text-base font-medium text-gray-700 max-w-2xl'>
							Tentukan titik koordinat geografis sekolah dan radius toleransi. Saat diaktifkan, guru wajib berada di area sekolah untuk dapat menyimpan jurnal mengajar.
						</p>
					</div>

					<div className='shrink-0 flex items-center'>
						<button
							onClick={handleSave}
							disabled={saving}
							className='neo-btn-primary flex items-center gap-2 text-sm !py-3 !px-6 disabled:opacity-50'>
							<span>💾</span>
							<span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
						</button>
					</div>
				</div>
			</div>

			{/* Saklar Status Geofencing */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='space-y-1'>
						<div className='flex items-center gap-2'>
							<h2 className='text-lg font-black text-black uppercase tracking-tight'>
								Status Pembatasan Lokasi (Geofence)
							</h2>
							<span className={`px-2.5 py-0.5 text-[11px] font-black uppercase rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${
								settings.enabled ? 'bg-emerald-300 text-black' : 'bg-gray-200 text-gray-700'
							}`}>
								{settings.enabled ? 'AKTIF' : 'NONAKTIF'}
							</span>
						</div>
						<p className='text-xs text-gray-600 font-medium leading-relaxed max-w-2xl'>
							{settings.enabled
								? '🟢 SISTEM AKTIF: Guru hanya dapat menyimpan Jurnal Guru saat perangkat berada di dalam radius sekolah.'
								: '⚪ SISTEM NONAKTIF: Guru dapat mengisi dan menyimpan jurnal dari lokasi manapun tanpa verifikasi GPS.'}
						</p>
					</div>

					<label className='relative inline-flex items-center cursor-pointer shrink-0'>
						<input
							type='checkbox'
							checked={settings.enabled}
							onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
							className='sr-only peer'
						/>
						<div className="w-16 h-8 bg-gray-200 border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] rounded-none peer peer-checked:bg-emerald-400 peer-checked:after:translate-x-[32px] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-2 after:border-black after:h-6 after:w-6 after:transition-all peer-checked:after:bg-black"></div>
					</label>
				</div>
			</div>

			{/* Form Pengaturan Koordinat */}
			<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
				<div className='lg:col-span-7 bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-6'>
					<div className='flex items-center justify-between border-b-2 border-black/10 pb-4'>
						<h2 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
							<span>🎯</span> Titik Koordinat & Nama Sekolah
						</h2>
						<button
							type='button'
							onClick={handleUseCurrentLocation}
							disabled={gpsLoading}
							className='neo-btn-outline flex items-center gap-1.5 text-xs !py-1.5 !px-3 font-black bg-yellow-200 hover:bg-yellow-300 text-black'>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M15 10.5a3 3 0 11-6 0 3 3 0 016 0z' />
								<path strokeLinecap='round' strokeLinejoin='round' d='M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' />
							</svg>
							<span>{gpsLoading ? 'Membaca GPS...' : 'Gunakan Posisi Saya'}</span>
						</button>
					</div>

					<div className='space-y-4'>
						<div>
							<label className='block text-xs font-black text-black uppercase tracking-widest mb-1.5'>
								Nama Institusi / Area
							</label>
							<input
								type='text'
								value={settings.nama_lokasi}
								onChange={(e) => setSettings((prev) => ({ ...prev, nama_lokasi: e.target.value }))}
								placeholder='Contoh: Gedung SMKN 1 Nganjuk'
								className='w-full px-4 py-3 bg-white border-2 border-black text-black font-bold shadow-[3px_3px_0px_0px_#0D0D0D] focus:shadow-[5px_5px_0px_0px_#0D0D0D] outline-none rounded-xl'
							/>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-xs font-black text-black uppercase tracking-widest mb-1.5'>
									Latitude (Lintang)
								</label>
								<input
									type='number'
									step='0.000001'
									value={settings.lat}
									onChange={(e) => setSettings((prev) => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
									placeholder='-6.200000'
									className='w-full px-4 py-3 bg-white border-2 border-black text-black font-mono font-bold shadow-[3px_3px_0px_0px_#0D0D0D] focus:shadow-[5px_5px_0px_0px_#0D0D0D] outline-none rounded-xl'
								/>
							</div>

							<div>
								<label className='block text-xs font-black text-black uppercase tracking-widest mb-1.5'>
									Longitude (Bujur)
								</label>
								<input
									type='number'
									step='0.000001'
									value={settings.lng}
									onChange={(e) => setSettings((prev) => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
									placeholder='106.816666'
									className='w-full px-4 py-3 bg-white border-2 border-black text-black font-mono font-bold shadow-[3px_3px_0px_0px_#0D0D0D] focus:shadow-[5px_5px_0px_0px_#0D0D0D] outline-none rounded-xl'
								/>
							</div>
						</div>

						<div>
							<div className='flex items-center justify-between mb-1.5'>
								<label className='block text-xs font-black text-black uppercase tracking-widest'>
									Radius Toleransi Geofence (Meter)
								</label>
								<span className='text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 font-mono'>
									{settings.radius} meter
								</span>
							</div>
							<input
								type='number'
								min='20'
								max='5000'
								step='10'
								value={settings.radius}
								onChange={(e) => setSettings((prev) => ({ ...prev, radius: Math.max(10, parseInt(e.target.value) || 10) }))}
								className='w-full px-4 py-3 bg-white border-2 border-black text-black font-bold shadow-[3px_3px_0px_0px_#0D0D0D] focus:shadow-[5px_5px_0px_0px_#0D0D0D] outline-none rounded-xl'
							/>

							{/* Shortcut Radius Presets */}
							<div className='flex flex-wrap gap-2 mt-2.5'>
								{[50, 100, 200, 300, 500].map((preset) => (
									<button
										key={preset}
										type='button'
										onClick={() => setSettings((prev) => ({ ...prev, radius: preset }))}
										className={`px-3 py-1 text-xs font-black uppercase rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all ${
											settings.radius === preset ? 'bg-black text-white' : 'bg-gray-100 hover:bg-yellow-200 text-black'
										}`}>
										{preset}m
									</button>
								))}
							</div>
							<p className='text-[11px] text-gray-500 font-medium mt-2'>
								Saran: Gunakan radius 150m - 300m untuk mencakup seluruh lingkungan gedung sekolah, lapangan, dan ruang guru dengan toleransi fluktuasi sinyal GPS di dalam ruangan.
							</p>
						</div>
					</div>

					{/* Pengujian Lokasi Langsung */}
					<div className='border-t-2 border-black/10 pt-4 space-y-3'>
						<div className='flex items-center justify-between'>
							<h3 className='text-xs font-black text-black uppercase tracking-wider'>
								🧪 Uji Posisi Perangkat Anda Saat Ini
							</h3>
							<button
								type='button'
								onClick={handleTestDistance}
								disabled={testingGps}
								className='neo-btn-outline flex items-center gap-1.5 text-xs !py-1.5 !px-3 font-black bg-cyan-200 hover:bg-cyan-300 text-black'>
								<span>📡</span>
								<span>{testingGps ? 'Mengukur...' : 'Uji Jarak Sekarang'}</span>
							</button>
						</div>

						{testResult && (
							<div className={`p-4 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] ${
								testResult.isInside ? 'bg-emerald-100 text-emerald-950' : 'bg-rose-100 text-rose-950'
							}`}>
								<div className='flex items-start gap-3'>
									<span className='text-2xl'>{testResult.isInside ? '✅' : '🚫'}</span>
									<div className='space-y-1 text-xs'>
										<p className='font-black uppercase text-sm'>
											{testResult.isInside ? 'Anda Berada DI DALAM Area Sekolah' : 'Anda Berada DI LUAR Area Sekolah'}
										</p>
										<p className='font-medium'>
											Jarak Anda ke titik tengah: <b>{formatDistance(testResult.distance)}</b> (Radius diizinkan: <b>{testResult.allowedRadius} meter</b>).
										</p>
										<p className='text-[10px] text-gray-600 font-mono'>
											Koordinat GPS terdeteksi: {testResult.userLat?.toFixed(6)}, {testResult.userLng?.toFixed(6)} (Akurasi: ±{Math.round(testResult.accuracy || 0)}m)
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Preview Peta Terintegrasi */}
				<div className='lg:col-span-5 bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-black/10 mb-4 gap-2'>
						<h2 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-1.5'>
							<span>🗺️</span> Peta Lokasi
						</h2>

						{/* Map View Switcher */}
						<div className='flex flex-wrap items-center gap-1.5'>
							<button
								type='button'
								onClick={() => setMapProvider('interactive')}
								className={`px-2 py-1 text-[11px] font-black uppercase rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all ${
									mapProvider === 'interactive' ? 'bg-emerald-300 text-black' : 'bg-gray-100 hover:bg-yellow-200 text-gray-800'
								}`}>
								📍 Interaktif
							</button>
							<button
								type='button'
								onClick={() => setMapProvider('google')}
								className={`px-2 py-1 text-[11px] font-black uppercase rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all ${
									mapProvider === 'google' ? 'bg-blue-400 text-white' : 'bg-gray-100 hover:bg-yellow-200 text-gray-800'
								}`}>
								Google Maps
							</button>
							<button
								type='button'
								onClick={() => setMapProvider('satellite')}
								className={`px-2 py-1 text-[11px] font-black uppercase rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all ${
									mapProvider === 'satellite' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-yellow-200 text-gray-800'
								}`}>
								🛰️ Satelit
							</button>
						</div>
					</div>

					<div className='flex-1 min-h-[360px] rounded-xl border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_0px_#0D0D0D] bg-gray-100'>
						{mapProvider === 'interactive' ? (
							<iframe
								key={`interactive-${settings.lat}-${settings.lng}-${settings.radius}`}
								srcDoc={interactiveLeafletHtml}
								width='100%'
								height='100%'
								style={{ border: 0, minHeight: '360px' }}
								loading='lazy'
								title='Peta Interaktif Radius Sekolah'
								className='w-full h-full'
							/>
						) : mapProvider === 'google' ? (
							<iframe
								key={`google-${settings.lat}-${settings.lng}`}
								src={googleMapUrl}
								width='100%'
								height='100%'
								style={{ border: 0, minHeight: '360px' }}
								loading='lazy'
								title='Google Maps Sekolah'
								className='w-full h-full'
							/>
						) : (
							<iframe
								key={`satellite-${settings.lat}-${settings.lng}`}
								src={googleSatelliteUrl}
								width='100%'
								height='100%'
								style={{ border: 0, minHeight: '360px' }}
								loading='lazy'
								title='Google Satelit Sekolah'
								className='w-full h-full'
							/>
						)}
					</div>

					<div className='mt-4 p-3.5 bg-yellow-50 border-2 border-black rounded-xl text-xs space-y-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between gap-2'>
							<p className='font-black text-black uppercase text-[11px] flex items-center gap-1.5 truncate'>
								<span>📌</span> {settings.nama_lokasi || 'Area Sekolah'}
							</p>
							<a
								href={googleMapsExternalUrl}
								target='_blank'
								rel='noopener noreferrer'
								className='text-[10px] font-black uppercase text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded border border-blue-400 transition-colors flex items-center gap-1 shrink-0'>
								<span>Buka Maps</span>
								<span>↗</span>
							</a>
						</div>
						<p className='font-mono text-gray-700 text-[11px]'>
							{settings.lat.toFixed(6)}, {settings.lng.toFixed(6)} &bull; Radius {settings.radius}m
						</p>
						<p className='text-[10px] text-gray-600 font-medium leading-relaxed'>
							{mapProvider === 'interactive'
								? '💡 Mode Interaktif: Anda dapat langsung mengklik di peta atau menggeser pin 🏫 untuk memindahkan titik pusat sekolah!'
								: mapProvider === 'google'
								? '🗺️ Mode Google Maps: Tampilan peta standar jalan raya & nama gedung resmi Google Maps Indonesia.'
								: '🛰️ Mode Satelit: Tampilan foto citra satelit Google dari udara untuk melihat atap gedung sekolah.'}
						</p>
					</div>
				</div>
			</div>

			{/* Tombol Simpan Footer */}
			<div className='flex justify-end pt-4 pb-12'>
				<button
					type='button'
					onClick={handleSave}
					disabled={saving}
					className='neo-btn-primary flex items-center gap-2 text-base !py-3.5 !px-8 shadow-[6px_6px_0px_0px_#0D0D0D] disabled:opacity-50'>
					<span>💾</span>
					<span>{saving ? 'Sedang Menyimpan...' : 'Simpan Perubahan Lokasi'}</span>
				</button>
			</div>
		</div>
	);
}
