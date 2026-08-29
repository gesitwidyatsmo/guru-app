'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from './components/loading';
import Swal from 'sweetalert2';
import { useLogout } from '@/hooks/useLogout';
import StatistikCards from './components/dashboard/StatistikCards';
import QuickActions from './components/dashboard/QuickActions';
import MenuUtama from './components/dashboard/MenuUtama';
import Leaderboard from './components/dashboard/Leaderboard';
import JadwalWidget from './components/dashboard/JadwalWidget';
import NotificationBell from './components/dashboard/NotificationBell';
import DashboardCharts from './components/dashboard/DashboardCharts';
import AcademicPeriodChip from './components/AcademicPeriodChip';

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

	const [searchQuery, setSearchQuery] = useState('');
	const [allSiswa, setAllSiswa] = useState([]);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const searchRef = useRef(null);

	const router = useRouter();
	const { handleLogout } = useLogout();

	// Nama hari dalam Bahasa Indonesia
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	useEffect(() => {
		function handleClickOutside(event) {
			if (searchRef.current && !searchRef.current.contains(event.target)) {
				setIsSearchOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// FETCH DATA STATISTIK DAN JADWAL
	useEffect(() => {
		const fetchData = async () => {
			// 1. Coba baca data cepat dari IndexedDB dulu untuk render instan
			try {
				const { getAll, getUserSession, bulkPut } = await import('@/lib/offlineDb');
				const [cachedSiswa, cachedMapel, cachedKelas, cachedJadwal, cachedJurnal, cachedPoin, cachedUser] = await Promise.all([
					getAll('siswa'),
					getAll('mapel'),
					getAll('kelas'),
					getAll('jadwal'),
					getAll('jurnal'),
					getAll('poin'),
					getUserSession(),
				]);

				if (cachedUser) {
					setUserRole(cachedUser.role);
					setUserName(cachedUser.nama_lengkap || cachedUser.username || '');
				}

				if (cachedSiswa && cachedSiswa.length > 0) {
					const cachedSiswaAktif = cachedSiswa.filter((s) => s.status === 'Aktif');
					setAllSiswa(cachedSiswaAktif);
					setStat({
						siswa: cachedSiswaAktif.length,
						mapel: cachedMapel?.length || 0,
						kelas: cachedKelas?.length || 0,
						jurnal: cachedJurnal?.length || 0,
					});

					const jadwalFilteredCached = (cachedJadwal || [])
						.filter((jadwal) => jadwal.hari === hariIni)
						.sort((a, b) => {
							const [hA, mA] = (a.jam_mulai || '00:00').split(':').map(Number);
							const [hB, mB] = (b.jam_mulai || '00:00').split(':').map(Number);
							return hA * 60 + mA - (hB * 60 + mB);
						});
					setJadwalHariIni(jadwalFilteredCached);
					setLoading(false);
				}
			} catch (e) {
				console.warn('Error reading from IndexedDB:', e);
			}

			// 2. Fetch fresh data dari network / Service Worker
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

				const siswaAktif = Array.isArray(dataSiswa) ? dataSiswa.filter((siswa) => siswa.status === 'Aktif') : [];
				setAllSiswa(siswaAktif);

				// Filter jadwal hari ini
				const jadwalFiltered = (Array.isArray(dataJadwal) ? dataJadwal : [])
					.filter((jadwal) => jadwal.hari === hariIni)
					.sort((a, b) => {
						const [hA, mA] = (a.jam_mulai || '00:00').split(':').map(Number);
						const [hB, mB] = (b.jam_mulai || '00:00').split(':').map(Number);
						return hA * 60 + mA - (hB * 60 + mB);
					});

				setStat({
					siswa: siswaAktif.length,
					mapel: Array.isArray(dataMapel) ? dataMapel.length : 0,
					kelas: Array.isArray(dataKelas) ? dataKelas.length : 0,
					jurnal: Array.isArray(dataJurnal) ? dataJurnal.length : 0,
				});

				// Kalkulasi Poin Leaderboard
				const poinMap = {};
				(Array.isArray(dataPoin) ? dataPoin : []).forEach((p) => {
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

				// 3. Simpan ke IndexedDB untuk ketersediaan offline di seluruh halaman
				try {
					const { bulkPut } = await import('@/lib/offlineDb');
					if (Array.isArray(dataSiswa) && dataSiswa.length > 0) bulkPut('siswa', dataSiswa);
					if (Array.isArray(dataMapel) && dataMapel.length > 0) bulkPut('mapel', dataMapel);
					if (Array.isArray(dataKelas) && dataKelas.length > 0) bulkPut('kelas', dataKelas);
					if (Array.isArray(dataJadwal) && dataJadwal.length > 0) bulkPut('jadwal', dataJadwal);
					if (Array.isArray(dataJurnal) && dataJurnal.length > 0) bulkPut('jurnal', dataJurnal);
					if (Array.isArray(dataPoin) && dataPoin.length > 0) bulkPut('poin', dataPoin);
				} catch (e) {
					console.warn('Error saving master data to IndexedDB:', e);
				}
			} catch (error) {
				console.error('Gagal mengambil data online:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [hariIni]);

	// Quick Actions (Menu Utama - Sering dipakai)
	const quickActions = useMemo(
		() => [
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
				color: 'neo-card-teal',
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
				color: 'neo-card-blue',
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
				color: 'neo-card-orange',
				description: 'Rekap & statistik',
			},
			{
				label: 'Poin',
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
							d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
						/>
					</svg>
				),
				route: '/poin',
				color: 'neo-card-peach',
				description: 'Catat poin siswa',
			},
		],
		[],
	);

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
			color: 'neo-card-orange',
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
			color: 'neo-card-yellow',
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
			color: 'neo-card-teal',
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
			color: 'neo-card-blue',
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
			color: 'neo-card-peach',
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
			color: 'neo-card-orange',
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
			color: 'neo-card-yellow',
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
			color: 'neo-card-blue',
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
			color: 'neo-card-orange',
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

	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return { menus: [], siswa: [] };
		const q = searchQuery.toLowerCase();

		const menus = [...quickActions, ...filteredMenuItems].filter((m) => m.label.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q)));
		const siswa = allSiswa.filter((s) => s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.toLowerCase().includes(q))).slice(0, 5);

		return { menus, siswa };
	}, [searchQuery, allSiswa, filteredMenuItems, quickActions]);

	if (loading) {
		return <Loader />;
	}

	return (
		<main className='min-h-screen bg-[var(--background)]'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
				{/* Header */}
				<div className='mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
					<div>
						<div className='flex flex-wrap items-center gap-1 text-3xl sm:text-4xl font-bold text-black mb-4'>
							Selamat Datang
							{userName && (
								<>
									, <span className='bg-yellow-300 border-2 border-black px-3 py-1 shadow-[4px_4px_0px_0px_#0D0D0D] rotate-[-2deg] inline-block ml-2'>{userName}</span>
								</>
							)}
							!
						</div>
						<p className='text-gray-900 font-bold border-2 border-black bg-white inline-block px-3 py-1 rounded-md shadow-[2px_2px_0px_0px_#0D0D0D] text-sm sm:text-base'>
							{new Date().toLocaleDateString('id-ID', {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</p>
					</div>
					<div
						className='flex items-center gap-2 w-full md:w-auto relative'
						ref={searchRef}>
						{/* Academic Period Chip */}
						<AcademicPeriodChip />
						<div className={`relative flex items-center transition-all duration-300 ${isSearchOpen ? 'w-full md:w-64' : 'w-auto md:w-64'}`}>
							<input
								type='text'
								placeholder='Cari menu atau siswa...'
								className={`w-full neo-input !pl-10 ${!isSearchOpen && 'hidden md:block'}`}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onFocus={() => setIsSearchOpen(true)}
							/>
							<div
								className={`cursor-pointer ${!isSearchOpen ? 'md:hidden neo-card p-3 flex items-center justify-center hover:bg-yellow-400 transition-all' : 'absolute left-3 text-gray-500'}`}
								onClick={() => setIsSearchOpen(!isSearchOpen)}>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path>
								</svg>
							</div>
							<div className={`absolute left-3 text-gray-500 hidden md:block`}>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path>
								</svg>
							</div>

							{/* Search Results Dropdown */}
							{isSearchOpen && searchQuery.trim() !== '' && (
								<div className='absolute top-full right-0 mt-2 w-full md:w-80 neo-card overflow-hidden z-50 max-h-[60vh] overflow-y-auto p-0'>
									{searchResults.menus.length > 0 && (
										<div className='p-0'>
											<div className='text-xs font-bold text-black uppercase tracking-wider px-3 py-2 border-b-2 border-black bg-yellow-300'>Menu & Aksi</div>
											{searchResults.menus.map((menu, i) => (
												<Link
													key={`menu-${i}`}
													href={menu.route}
													className='flex items-center gap-3 px-3 py-3 hover:bg-yellow-50 border-b-2 border-black last:border-b-0 transition-colors'
													onClick={() => setIsSearchOpen(false)}>
													<div className={`w-8 h-8 flex items-center justify-center bg-black text-white shadow-[2px_2px_0px_0px_#0D0D0D]`}>{menu.icon}</div>
													<div>
														<div className='text-sm font-bold text-black'>{menu.label}</div>
														{menu.description && <div className='text-xs text-gray-600 font-medium'>{menu.description}</div>}
													</div>
												</Link>
											))}
										</div>
									)}

									{searchResults.siswa.length > 0 && (
										<div className='p-0'>
											<div className='text-xs font-bold text-black uppercase tracking-wider px-3 py-2 border-y-2 border-black bg-yellow-300'>Siswa Aktif</div>
											{searchResults.siswa.map((siswa) => (
												<Link
													key={siswa.id}
													href={`/siswa/${siswa.id}`}
													className='flex items-center justify-between px-3 py-3 hover:bg-yellow-50 border-b-2 border-black last:border-b-0 transition-colors'
													onClick={() => setIsSearchOpen(false)}>
													<div>
														<div className='text-sm font-bold text-black'>{siswa.nama_lengkap}</div>
														<div className='text-xs text-gray-600 font-medium'>
															{siswa.nis} • {siswa.kelas}
														</div>
													</div>
													<div className='text-xs font-bold px-2 py-1 bg-black text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Lihat</div>
												</Link>
											))}
										</div>
									)}

									{searchResults.menus.length === 0 && searchResults.siswa.length === 0 && (
										<div className='p-4 text-center text-sm font-bold text-black bg-yellow-50'>Tidak ada hasil ditemukan untuk &ldquo;{searchQuery}&rdquo;</div>
									)}
								</div>
							)}
						</div>

						<NotificationBell />

						{userRole === 'Admin' && (
							<Link
								href='/admin'
								title='Portal Admin'
								className={`flex-shrink-0 p-3 neo-card flex items-center justify-center bg-yellow-300 hover:bg-yellow-400 transition-all duration-200 group text-black ${isSearchOpen && 'hidden md:block'}`}>
								<svg
									className='w-6 h-6 group-hover:scale-110 transition-transform'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth='2'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
									/>
								</svg>
							</Link>
						)}

						<button
							onClick={handleLogout}
							title='Keluar Akun'
							className={`flex-shrink-0 p-3 neo-card flex items-center justify-center hover:bg-rose-400 transition-all duration-200 group text-black ${isSearchOpen && 'hidden md:block'}`}>
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
							className={`flex-shrink-0 p-3 neo-card flex items-center justify-center hover:bg-yellow-400 transition-all duration-200 group text-black ${isSearchOpen && 'hidden md:block'}`}>
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
				<StatistikCards stat={stat} />

				{/* Quick Actions */}
				<QuickActions quickActions={quickActions} />

				{/* Menu Utama */}
				<MenuUtama filteredMenuItems={filteredMenuItems} />

				{/* Visualisasi Data / Chart */}
				<DashboardCharts />

				{/* Leaderboard Poin Siswa */}
				<Leaderboard leaderboard={leaderboard} />

				{/* Jadwal Hari Ini */}
				<JadwalWidget
					jadwalHariIni={jadwalHariIni}
					hariIni={hariIni}
				/>
			</div>
		</main>
	);
}
