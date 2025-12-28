'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from './components/loading';

export default function Home() {
	const [stat, setStat] = useState({
		siswa: 0,
		mapel: 0,
		kelas: 0,
		jurnal: 0,
	});

	const [jadwalHariIni, setJadwalHariIni] = useState([]);
	const [loading, setLoading] = useState(true);

	console.log(jadwalHariIni);

	const router = useRouter();

	// Nama hari dalam Bahasa Indonesia
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	// FETCH DATA STATISTIK DAN JADWAL
	useEffect(() => {
		const fetchData = async () => {
			try {
				const [resSiswa, resMapel, resKelas, resJadwal, resJurnal] = await Promise.all([fetch('/api/siswa'), fetch('/api/mapel'), fetch('/api/kelas'), fetch('/api/jadwal'), fetch('/api/jurnal')]);

				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataJadwal = resJadwal.ok ? await resJadwal.json() : [];
				const dataJurnal = resJurnal.ok ? await resJurnal.json() : [];

				const siswaAktif = dataSiswa.filter((siswa) => siswa.status === 'Aktif');

				// Filter jadwal hari ini
				const jadwalFiltered = dataJadwal
					.filter((jadwal) => jadwal.hari === hariIni)
					.sort((a, b) => {
						const [hA, mA] = a.jam_mulai.split(':').map(Number);
						const [hB, mB] = b.jam_mulai.split(':').map(Number);
						return hA * 60 + mA - (hB * 60 + mB);
					});

				setStat({
					siswa: siswaAktif.length,
					mapel: dataMapel.length,
					kelas: dataKelas.length,
					jurnal: dataJurnal.length,
				});

				setJadwalHariIni(jadwalFiltered);
			} catch (error) {
				console.error('Gagal mengambil data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [hariIni]);

	// Quick Actions (Menu Utama - Sering dipakai)
	const quickActions = [
		{
			label: 'Absensi',
			icon: (
				<svg
					className='w-8 h-8'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
					/>
				</svg>
			),
			route: '/absensi',
			color: 'from-green-500 to-emerald-600',
			description: 'Input absensi harian',
		},
		{
			label: 'Penilaian',
			icon: (
				<svg
					className='w-8 h-8'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
					/>
				</svg>
			),
			route: '/penilaian',
			color: 'from-blue-500 to-indigo-600',
			description: 'Input nilai siswa',
		},
		{
			label: 'Laporan',
			icon: (
				<svg
					className='w-8 h-8'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
					/>
				</svg>
			),
			route: '/laporan',
			color: 'from-purple-500 to-pink-600',
			description: 'Rekap & statistik',
		},
	];

	// Menu Reguler (Master Data)
	const menuItems = [
		{
			label: 'Kelas',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
					/>
				</svg>
			),
			route: '/kelas',
			color: 'bg-gradient-to-br from-orange-400 to-red-500',
		},
		{
			label: 'Siswa',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
					/>
				</svg>
			),
			route: '/siswa',
			color: 'bg-gradient-to-br from-cyan-400 to-blue-500',
		},
		{
			label: 'Mapel',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
					/>
				</svg>
			),
			route: '/mapel',
			color: 'bg-gradient-to-br from-yellow-400 to-orange-500',
		},
		{
			label: 'Jadwal',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
					/>
				</svg>
			),
			route: '/jadwal',
			color: 'bg-gradient-to-br from-pink-400 to-rose-500',
		},
		{
			label: 'Jurnal',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
					/>
				</svg>
			),
			route: '/jurnal',
			color: 'bg-gradient-to-br from-teal-400 to-cyan-500',
		},
		{
			label: 'Grup',
			icon: (
				<svg
					className='w-7 h-7'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
					/>
				</svg>
			),
			route: '/grup',
			color: 'bg-gradient-to-br from-violet-400 to-purple-500',
		},
	];

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<main className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
				{/* Header */}
				<div className='mb-8'>
					<h1 className='text-3xl sm:text-4xl font-bold text-gray-800 mb-2'>Selamat Datang! 👋</h1>
					<p className='text-gray-600 text-sm sm:text-base'>
						{new Date().toLocaleDateString('id-ID', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						})}
					</p>
				</div>

				{/* Statistik Cards */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8'>
					{/* Siswa */}
					<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white transform hover:scale-105 transition-all duration-300 hover:shadow-xl'>
						<div className='flex items-center justify-between mb-2'>
							<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3'>
								<svg
									className='w-6 h-6 sm:w-8 sm:h-8'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
									/>
								</svg>
							</div>
						</div>
						<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.siswa}</p>
						<p className='text-xs sm:text-sm text-blue-100'>Total Siswa Aktif</p>
					</div>

					{/* Mapel */}
					<div className='bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white transform hover:scale-105 transition-all duration-300 hover:shadow-xl'>
						<div className='flex items-center justify-between mb-2'>
							<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3'>
								<svg
									className='w-6 h-6 sm:w-8 sm:h-8'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
									/>
								</svg>
							</div>
						</div>
						<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.mapel}</p>
						<p className='text-xs sm:text-sm text-purple-100'>Mata Pelajaran</p>
					</div>

					{/* Kelas */}
					<div className='bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white transform hover:scale-105 transition-all duration-300 hover:shadow-xl'>
						<div className='flex items-center justify-between mb-2'>
							<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3'>
								<svg
									className='w-6 h-6 sm:w-8 sm:h-8'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
									/>
								</svg>
							</div>
						</div>
						<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.kelas}</p>
						<p className='text-xs sm:text-sm text-orange-100'>Total Kelas</p>
					</div>

					{/* Jurnal */}
					<div className='bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white transform hover:scale-105 transition-all duration-300 hover:shadow-xl'>
						<div className='flex items-center justify-between mb-2'>
							<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3'>
								<svg
									className='w-6 h-6 sm:w-8 sm:h-8'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
									/>
								</svg>
							</div>
						</div>
						<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.jurnal}</p>
						<p className='text-xs sm:text-sm text-teal-100'>Jurnal Terisi</p>
					</div>
				</div>

				{/* Quick Actions */}
				<div className='mb-8'>
					<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
						<span className='text-2xl'>⚡</span>
						Aksi Cepat
					</h2>
					<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
						{quickActions.map((action, idx) => (
							<Link
								key={idx}
								href={action.route}
								className={`bg-gradient-to-br ${action.color} rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300 hover:shadow-2xl cursor-pointer group`}>
								<div className='flex items-center gap-4'>
									<div className='bg-white/20 backdrop-blur-sm rounded-xl p-3 group-hover:bg-white/30 transition-all'>{action.icon}</div>
									<div className='flex-1'>
										<h3 className='text-xl font-bold mb-1'>{action.label}</h3>
										<p className='text-sm text-white/80'>{action.description}</p>
									</div>
									<svg
										className='w-6 h-6 transform group-hover:translate-x-1 transition-transform'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M9 5l7 7-7 7'
										/>
									</svg>
								</div>
							</Link>
						))}
					</div>
				</div>

				{/* Menu Utama */}
				<div className='mb-8'>
					<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
						<span className='text-2xl'>📚</span>
						Menu Utama
					</h2>
					<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4'>
						{menuItems.map((item, idx) => (
							<Link
								key={idx}
								href={item.route}
								className={`${item.color} rounded-2xl shadow-lg p-4 sm:p-6 text-white text-center cursor-pointer transform hover:scale-105 transition-all duration-300 hover:shadow-xl group`}>
								<div className='flex flex-col items-center gap-2 sm:gap-3'>
									<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3 group-hover:bg-white/30 transition-all'>{item.icon}</div>
									<p className='font-semibold text-sm sm:text-base'>{item.label}</p>
								</div>
							</Link>
						))}
					</div>
				</div>

				{/* Jadwal Hari Ini */}
				<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
					<div className='flex items-center justify-between mb-6'>
						<h2 className='text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2'>
							<span className='text-2xl'>📅</span>
							Jadwal Hari Ini
							<span className='text-base font-normal text-gray-500'>({hariIni})</span>
						</h2>
						<Link
							href='/jadwal'
							className='text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1'>
							Lihat Semua
							<svg
								className='w-4 h-4'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M9 5l7 7-7 7'
								/>
							</svg>
						</Link>
					</div>

					{loading ? (
						<div className='flex items-center justify-center py-12'>
							<div className='animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent'></div>
						</div>
					) : jadwalHariIni.length > 0 ? (
						<div className='space-y-3'>
							{jadwalHariIni.map((jadwal, idx) => (
								<div
									key={idx}
									className='flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl hover:shadow-md transition-all border border-indigo-100'>
									<div className='bg-indigo-600 text-white rounded-xl p-3 text-center min-w-[70px]'>
										<p className='text-xs font-medium'>Jam Ke</p>
										<p className='text-xl font-bold'>{jadwal.jam_ke || '-'}</p>
									</div>
									<div className='flex-1'>
										<h3 className='font-bold text-gray-800 text-base mb-1'>{jadwal.mapel || 'Tidak ada mapel'}</h3>
										<p className='text-sm text-gray-600 flex items-center gap-2'>
											<svg
												className='w-4 h-4'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
												/>
											</svg>
											{jadwal.kelas || '-'}
										</p>
									</div>
									<div className='text-right'>
										<p className='text-sm font-semibold text-indigo-600'>
											{jadwal.jam_mulai || '00:00'} - {jadwal.jam_selesai || '00:00'}
										</p>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className='text-center py-12'>
							<div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4'>
								<svg
									className='w-10 h-10 text-gray-400'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
									/>
								</svg>
							</div>
							<p className='text-gray-500 font-medium'>Tidak ada jadwal hari ini</p>
							<p className='text-sm text-gray-400 mt-2'>Nikmati waktu luang Anda! 😊</p>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
