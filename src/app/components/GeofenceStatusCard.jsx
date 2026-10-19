'use client';

import { useState } from 'react';
import Swal from 'sweetalert2';
import { useGeolocation } from '@/hooks/useGeolocation';
import { isWithinGeofence, formatDistance } from '@/lib/haversine';

export default function GeofenceStatusCard({
	geofenceSettings,
	moduleName = 'absensi',
	userRole = '',
	locationStatus,
	setLocationStatus,
	className = '',
}) {
	const { getPosition, loading: gpsLoading } = useGeolocation();
	const [internalStatus, setInternalStatus] = useState(null);

	// Sinkronisasi status dari props jika ada, atau gunakan state internal
	const status = locationStatus !== undefined ? locationStatus : internalStatus;
	const updateStatus = (newStatus) => {
		if (setLocationStatus) {
			setLocationStatus(newStatus);
		} else {
			setInternalStatus(newStatus);
		}
	};

	// Cek apakah geofence aktif untuk modul ini
	if (!geofenceSettings?.enabled) return null;
	const berlakuUntuk = geofenceSettings.berlaku_untuk || [];
	if (!berlakuUntuk.includes(moduleName)) return null;

	const isAdmin = userRole === 'Admin';
	const isChecked = Boolean(status?.checked);
	const isInside = Boolean(status?.isInside);

	const handleCheckGPS = async () => {
		try {
			const coords = await getPosition();
			const check = isWithinGeofence(
				coords.lat,
				coords.lng,
				geofenceSettings.lat,
				geofenceSettings.lng,
				geofenceSettings.radius
			);

			const newStatus = {
				...check,
				checked: true,
				userLat: coords.lat,
				userLng: coords.lng,
			};
			updateStatus(newStatus);

			if (check.isInside) {
				Swal.fire({
					icon: 'success',
					title: 'Lokasi Terverifikasi!',
					html: `
						<div class="text-left text-sm space-y-1">
							<p>Posisi Anda berada di dalam area <b>${geofenceSettings.nama_lokasi || 'Sekolah'}</b>.</p>
							<p class="text-xs text-gray-600 font-semibold mt-2">Jarak ke titik pusat: <b class="text-emerald-700">${formatDistance(check.distance)}</b> (Batas: ${geofenceSettings.radius}m)</p>
						</div>
					`,
					confirmButtonColor: '#00A693',
				});
			} else {
				Swal.fire({
					icon: 'warning',
					title: 'Di Luar Area Sekolah',
					html: `
						<div class="text-left text-sm space-y-2">
							<p>Sistem mendeteksi posisi Anda saat ini di luar radius <b>${geofenceSettings.nama_lokasi || 'Sekolah'}</b>.</p>
							<div class="bg-red-50 p-2.5 rounded-lg border border-red-200 text-xs">
								<p>Jarak Anda saat ini: <b class="text-red-600">${formatDistance(check.distance)}</b></p>
								<p>Radius maksimum izin: <b>${geofenceSettings.radius} meter</b></p>
							</div>
							${isAdmin ? '<p class="text-xs font-bold text-amber-700 mt-2">ℹ️ Catatan: Karena Anda adalah Admin, Anda tetap dapat menyimpan data (Bypass Aktif).</p>' : '<p class="text-xs text-gray-600">Pastikan Anda berada di lingkungan sekolah sebelum menyimpan.</p>'}
						</div>
					`,
					confirmButtonColor: '#E8451A',
				});
			}
		} catch (err) {
			console.error('GPS Check error:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Membaca GPS',
				text: err.message || 'Pastikan GPS dan izin akses lokasi telah diaktifkan di browser perangkat Anda.',
				confirmButtonColor: '#E8451A',
			});
		}
	};

	let bgClass = 'bg-yellow-100 text-[#0D0D0D] border-[#0D0D0D]';
	let iconBg = 'bg-yellow-300 text-[#0D0D0D]';
	let iconText = '📍';

	if (isChecked) {
		if (isInside) {
			bgClass = 'bg-emerald-100 text-emerald-950 border-[#0D0D0D]';
			iconBg = 'bg-emerald-400 text-white';
			iconText = '✓';
		} else {
			bgClass = 'bg-rose-100 text-rose-950 border-[#0D0D0D]';
			iconBg = 'bg-rose-400 text-white';
			iconText = '✕';
		}
	}

	return (
		<div className={`p-4 border-[3px] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${bgClass} ${className}`}>
			<div className='flex items-center gap-3'>
				<div className={`w-10 h-10 rounded-xl border-2 border-[#0D0D0D] flex items-center justify-center font-bold text-lg shrink-0 ${iconBg}`}>
					{iconText}
				</div>
				<div>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='text-xs font-black uppercase tracking-wider'>
							{!isChecked
								? `Validasi Lokasi: ${geofenceSettings.nama_lokasi || 'Area Sekolah'}`
								: isInside
								? `Lokasi Terverifikasi (${formatDistance(status.distance)})`
								: `Di Luar Area Sekolah (${formatDistance(status.distance || 0)})`}
						</p>
						{isAdmin && (
							<span className='px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 border border-[#0D0D0D] shadow-[1px_1px_0px_0px_#0D0D0D]'>
								👑 Mode Admin (Bypass)
							</span>
						)}
					</div>
					<p className='text-[11px] font-medium opacity-90 mt-0.5'>
						{!isChecked
							? `Radius wajib maksimal ${geofenceSettings.radius}m dari sekolah. Diperiksa otomatis saat menyimpan atau klik tombol di samping.`
							: isInside
							? `Posisi Anda memenuhi batas radius izin (${geofenceSettings.radius}m). Absensi siap disimpan.`
							: `Posisi Anda melebihi batas radius (${geofenceSettings.radius}m).${isAdmin ? ' Admin tetap dapat menyimpan.' : ' Pengisian hanya dapat dilakukan dari sekolah.'}`}
					</p>
				</div>
			</div>

			<div className='flex items-center gap-2 w-full md:w-auto justify-end shrink-0'>
				<button
					type='button'
					onClick={handleCheckGPS}
					disabled={gpsLoading}
					className='w-full md:w-auto px-3.5 py-2 bg-white border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-black text-xs uppercase hover:bg-yellow-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0'>
					{gpsLoading ? (
						<>
							<span className='animate-spin'>⏳</span>
							<span>Memeriksa GPS...</span>
						</>
					) : (
						<>
							<span>📡</span>
							<span>{isChecked ? 'Cek Ulang GPS' : 'Cek Posisi GPS Sekarang'}</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}
