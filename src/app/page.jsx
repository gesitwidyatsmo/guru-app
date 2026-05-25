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

	const [userRole, setUserRole] = useState(null);
	const [userName, setUserName] = useState('');

	const [jadwalHariIni, setJadwalHariIni] = useState([]);
	const [leaderboard, setLeaderboard] = useState({
		topPositif: [],
		topNegatif: [],
	});
	const [loading, setLoading] = useState(true);

	const router = useRouter();

	// Nama hari dalam Bahasa Indonesia
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	// FETCH DATA STATISTIK DAN JADWAL
	useEffect(() => {
		const fetchData = async () => {
			try {
				const [resSiswa, resMapel, resKelas, resJadwal, resJurnal, resPoin, resAuth] = await Promise.all([
					fetch('/api/siswa'),
					fetch('/api/mapel'),
					fetch('/api/kelas'),
					fetch('/api/jadwal'),
					fetch('/api/jurnal'),
					fetch('/api/poin'),
					fetch('/api/auth/me'),
				]);

				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataJadwal = resJadwal.ok ? await resJadwal.json() : [];
				const dataJurnal = resJurnal.ok ? await resJurnal.json() : [];
				const dataPoin = resPoin.ok ? await resPoin.json() : [];

				if (resAuth.ok) {
					const dataAuth = await resAuth.json();
					setUserRole(dataAuth.user.role);
					setUserName(dataAuth.user.nama_lengkap);
				}

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

				// Kalkulasi Poin Leaderboard
				const poinMap = {};
				dataPoin.forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					else if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				const siswaWithPoin = siswaAktif.map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));

				const topPositif = [...siswaWithPoin]
					.sort((a, b) => b.poinPositif - a.poinPositif)
					.filter((s) => s.poinPositif > 0)
					.slice(0, 5);
				const topNegatif = [...siswaWithPoin]
					.sort((a, b) => b.poinNegatif - a.poinNegatif)
					.filter((s) => s.poinNegatif > 0)
					.slice(0, 5);

				setLeaderboard({ topPositif, topNegatif });
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
		{
			label: 'Profil Ajar',
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
						d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
					/>
				</svg>
			),
			route: '/profil',
			color: 'bg-gradient-to-br from-indigo-500 to-blue-600',
		},
		{
			label: 'Tugas Online',
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
						d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
					/>
				</svg>
			),
			route: '/tugas',
			color: 'bg-gradient-to-br from-amber-500 to-orange-600',
		},
		{
			label: 'Game',
			icon: (
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth='1.5'
					stroke='currentColor'
					className='size-7'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z'
					/>
				</svg>
			),
			route: '/game',
			color: 'bg-gradient-to-br from-green-400 to-green-500',
		},
	];

	// Filter menu reguler (Sembunyikan Master Data konfidensial dari Guru)
	const filteredMenuItems = menuItems.filter((item) => {
		if (userRole === 'Guru' && [''].includes(item.label)) {
			return false;
		}
		if (userRole === 'Admin' && ['Jadwal', 'Profil Ajar'].includes(item.label)) {
			return false;
		}
		return true;
	});

	if (loading) {
		return <Loader />;
	}

	return (
		<main className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
				{/* Header */}
				<div className='mb-8 flex items-start justify-between gap-4'>
					<div>
						<h1 className='text-3xl sm:text-4xl font-bold text-gray-800 mb-2'>Selamat Datang{userName ? `, ${userName}` : ''}! 👋</h1>
						<p className='text-gray-600 text-sm sm:text-base'>
							{new Date().toLocaleDateString('id-ID', {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</p>
					</div>
					<div className='flex items-center gap-2'>
						<button
							onClick={async () => {
								await clearAll();
								await fetch('/api/logout');
								window.location.href = '/login';
							}}
							title='Keluar Akun'
							className='flex-shrink-0 p-3 rounded-2xl bg-white shadow-md hover:shadow-lg border border-rose-100 text-rose-500 hover:text-white hover:bg-rose-500 transition-all duration-200 group'>
							<svg
								className='w-6 h-6 group-hover:-translate-x-0.5 transition-transform'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
								/>
							</svg>
						</button>
						<Link
							href='/pengaturan'
							title='Pengaturan'
							className='flex-shrink-0 p-3 rounded-2xl bg-white shadow-md hover:shadow-lg border border-gray-100 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-200 group'>
							<svg
								className='w-6 h-6 group-hover:rotate-45 transition-transform duration-300'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
								/>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
								/>
							</svg>
						</Link>
					</div>
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
						{filteredMenuItems.map((item, idx) => (
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

				{/* Leaderboard Poin Siswa */}
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8'>
					{/* Top Positif */}
					<div className='bg-white rounded-2xl shadow-xl p-6 border border-emerald-100 relative overflow-hidden'>
						<div className='absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50'></div>
						<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
							<span className='text-2xl'>🌟</span>
							Bintang Kelas
						</h2>
						{leaderboard.topPositif.length > 0 ? (
							<div className='space-y-3'>
								{leaderboard.topPositif.map((siswa, idx) => (
									<div
										key={siswa.id}
										className='flex items-center gap-3 p-3 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-100/50'>
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
											{idx + 1}
										</div>
										<div className='flex-1'>
											<Link
												href={`/siswa/${siswa.id}`}
												className='font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors'>
												{siswa.nama_lengkap}
											</Link>
											<p className='text-xs text-gray-500'>{siswa.kelas}</p>
										</div>
										<div className='bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-sm'>+{siswa.poinPositif}</div>
									</div>
								))}
							</div>
						) : (
							<p className='text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100'>Belum ada siswa dengan poin positif.</p>
						)}
					</div>

					{/* Top Negatif */}
					<div className='bg-white rounded-2xl shadow-xl p-6 border border-rose-100 relative overflow-hidden'>
						<div className='absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -z-10 opacity-50'></div>
						<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
							<span className='text-2xl'>⚠️</span>
							Perhatian Khusus
						</h2>
						{leaderboard.topNegatif.length > 0 ? (
							<div className='space-y-3'>
								{leaderboard.topNegatif.map((siswa, idx) => (
									<div
										key={siswa.id}
										className='flex items-center gap-3 p-3 bg-rose-50/50 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100/50'>
										<div className='w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-rose-100 text-rose-700'>{idx + 1}</div>
										<div className='flex-1'>
											<Link
												href={`/siswa/${siswa.id}`}
												className='font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors'>
												{siswa.nama_lengkap}
											</Link>
											<p className='text-xs text-gray-500'>{siswa.kelas}</p>
										</div>
										<div className='bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-bold text-sm'>-{siswa.poinNegatif}</div>
									</div>
								))}
							</div>
						) : (
							<p className='text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100'>Sempurna! Tidak ada siswa dengan pelanggaran.</p>
						)}
					</div>
				</div>

				{/* Jadwal Hari Ini */}
				<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
					<div className='flex items-center justify-between mb-6'>
						<h2 className='text-md sm:text-2xl font-bold text-gray-800 flex items-center gap-2'>
							<span className='text-2xl '>📅</span>
							Jadwal Hari Ini
							<span className='text-base hidden lg:block font-normal text-gray-500'>({hariIni})</span>
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
