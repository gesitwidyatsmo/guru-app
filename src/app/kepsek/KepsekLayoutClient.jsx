'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

const KEPSEK_NAV_SECTIONS = [
	{
		group: 'Utama',
		items: [
			{
				label: 'Dashboard Eksekutif',
				href: '/kepsek',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Supervisi Pembelajaran',
		items: [
			{
				label: 'Jurnal Guru',
				href: '/kepsek/jurnal',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
			{
				label: 'Rekap Nilai Siswa',
				href: '/kepsek/penilaian',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
			{
				label: 'Presensi Mapel',
				href: '/kepsek/absensi',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
					</svg>
				),
			},
			{
				label: 'Poin & Karakter Siswa',
				href: '/kepsek/poin',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' />
					</svg>
				),
			},
			{
				label: 'Daftar Kelas & Wali',
				href: '/kepsek/kelas',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
					</svg>
				),
			},
			{
				label: 'Laporan Komprehensif',
				href: '/kepsek/laporan',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Data Master Institusi',
		items: [
			{
				label: 'Master Pengguna',
				href: '/kepsek/pengguna',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
					</svg>
				),
			},
			{
				label: 'Penugasan KBM',
				href: '/kepsek/penugasan',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
					</svg>
				),
			},
			{
				label: 'Tahun Ajar & Sem.',
				href: '/kepsek/tahun-ajar',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Keuangan & Bisaroh',
		items: [
			{
				label: 'Persetujuan Bisaroh',
				href: '/kepsek/bisaroh',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
				),
			},
		],
	},
];

export default function KepsekLayoutClient({ children, initialName = 'Kepala Sekolah' }) {
	const pathname = usePathname();
	const { handleLogout } = useLogout();
	const [isMobileOpen, setIsMobileOpen] = useState(false);

	const [kepsekName, setKepsekName] = useState(() => {
		if (initialName && initialName !== 'Kepala Sekolah') return initialName;
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('user_name');
			if (stored) return stored;
			const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]*)/);
			if (match) return decodeURIComponent(match[1]);
		}
		return initialName || 'Kepala Sekolah';
	});

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data?.user?.nama_lengkap) {
						setKepsekName(data.user.nama_lengkap);
						localStorage.setItem('user_name', data.user.nama_lengkap);
					}
				}
			} catch (err) {
				console.error('Error fetch kepsek profile:', err);
			}
		};
		fetchProfile();
	}, []);

	const getPageTitle = () => {
		if (pathname === '/kepsek') return 'Dashboard Monitoring Eksekutif';
		if (pathname.startsWith('/kepsek/jurnal')) return 'Supervisi Jurnal Guru';
		if (pathname.startsWith('/kepsek/penilaian')) return 'Rekapitulasi Nilai Siswa';
		if (pathname.startsWith('/kepsek/absensi')) return 'Presensi & Kehadiran Siswa';
		if (pathname.startsWith('/kepsek/poin')) return 'Poin & Pembinaan Karakter';
		if (pathname.startsWith('/kepsek/kelas')) return 'Daftar Kelas & Wali Kelas';
		if (pathname.startsWith('/kepsek/laporan')) return 'Laporan Akademik Terpadu';
		if (pathname.startsWith('/kepsek/pengguna')) return 'Daftar Pengguna & Dewan Guru';
		if (pathname.startsWith('/kepsek/penugasan')) return 'Penugasan KBM Guru';
		if (pathname.startsWith('/kepsek/tahun-ajar')) return 'Status Kalender Akademik';
		return 'Supervisi Sekolah';
	};

	const renderSidebarContent = (isMobile = false) => (
		<div className='flex flex-col h-full bg-white text-black'>
			{/* Brand Header */}
			<div className='p-5 border-b-2 border-black flex items-center justify-between bg-indigo-300'>
				<Link
					href='/kepsek'
					onClick={() => isMobile && setIsMobileOpen(false)}
					className='flex items-center gap-3 group focus:outline-none'>
					<div className='w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#0D0D0D] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all text-xl'>
						🎓
					</div>
					<div>
						<div className='flex items-center gap-1.5'>
							<h1 className='text-lg font-black text-black leading-tight tracking-tight uppercase'>
								Portal Monitoring
							</h1>
						</div>
						<p className='text-[10px] font-black text-black uppercase tracking-widest'>
							Kepala Sekolah
						</p>
					</div>
				</Link>

				{isMobile && (
					<button
						onClick={() => setIsMobileOpen(false)}
						className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
						✕
					</button>
				)}
			</div>

			{/* Kepsek Profile Box */}
			<div className='p-4 border-b-2 border-black bg-indigo-50/70'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 bg-indigo-300 text-black'>
						{kepsekName ? kepsekName.charAt(0).toUpperCase() : 'K'}
					</div>
					<div className='min-w-0 flex-1'>
						<p className='text-xs font-black text-black truncate' title={kepsekName}>
							{kepsekName}
						</p>
						<span className='inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D] mt-0.5 bg-indigo-200 text-black'>
							🎓 Kepala Sekolah
						</span>
					</div>
				</div>
			</div>

			{/* Navigation Menu List */}
			<div className='flex-1 overflow-y-auto p-4 space-y-6 scrollbar-none'>
				{KEPSEK_NAV_SECTIONS.map((section, idx) => (
					<div key={idx} className='space-y-1.5'>
						<p className='px-3 text-[10px] font-black uppercase tracking-widest text-gray-500'>
							{section.group}
						</p>
						<div className='space-y-1'>
							{section.items.map((item) => {
								const isActive = pathname === item.href;
								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={() => isMobile && setIsMobileOpen(false)}
										className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
											isActive
												? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#818CF8] translate-x-[-1px] translate-y-[-1px]'
												: 'bg-white text-black border-transparent hover:border-black hover:bg-indigo-100 hover:shadow-[2px_2px_0px_0px_#0D0D0D]'
										}`}>
										<span className={isActive ? 'text-indigo-300' : 'text-black'}>
											{item.icon}
										</span>
										<span className='truncate'>{item.label}</span>
									</Link>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{/* Bottom Action Footer */}
			<div className='p-4 border-t-2 border-black bg-indigo-50/50 space-y-2'>
				<Link
					href='/'
					onClick={() => isMobile && setIsMobileOpen(false)}
					className='w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-indigo-200 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
					</svg>
					<span>Beralih ke Beranda Guru</span>
				</Link>

				<button
					onClick={handleLogout}
					className='w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
					</svg>
					<span>Keluar (Logout)</span>
				</button>
			</div>
		</div>
	);

	return (
		<div className='min-h-screen bg-[var(--background)] flex text-black font-sans'>
			{/* Desktop Sticky Sidebar (Left) */}
			<aside className='hidden lg:flex flex-col w-72 bg-white border-r-2 border-black sticky top-0 h-screen z-30 shadow-[4px_0px_0px_0px_#0D0D0D] shrink-0'>
				{renderSidebarContent(false)}
			</aside>

			{/* Mobile Slide-over Drawer & Overlay */}
			{isMobileOpen && (
				<div className='fixed inset-0 z-50 lg:hidden flex'>
					{/* Backdrop */}
					<div
						className='fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200'
						onClick={() => setIsMobileOpen(false)}
					/>

					{/* Drawer Content */}
					<div className='relative w-72 max-w-[80vw] bg-white border-r-3 border-black h-full shadow-[8px_0px_0px_0px_#0D0D0D] z-10 animate-in slide-in-from-left duration-200'>
						{renderSidebarContent(true)}
					</div>
				</div>
			)}

			{/* Main Content Area (Right) */}
			<div className='flex-1 flex flex-col min-w-0 min-h-screen'>
				{/* Top Status Header */}
				<header className='bg-white border-b-2 border-black sticky top-0 z-20 shadow-[0_3px_0px_0px_#0D0D0D]'>
					<div className='px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
						{/* Mobile Hamburger & Logo */}
						<div className='flex items-center gap-3 lg:hidden'>
							<button
								onClick={() => setIsMobileOpen(true)}
								aria-label='Buka Sidebar Menu'
								className='p-2 bg-indigo-300 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
								<svg className='w-5 h-5 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
								</svg>
							</button>

							<div>
								<h2 className='text-sm font-black uppercase text-black leading-tight'>
									Portal Monitoring
								</h2>
								<p className='text-[10px] font-bold text-gray-500'>{kepsekName}</p>
							</div>
						</div>

						{/* Desktop Breadcrumb / Section Name */}
						<div className='hidden lg:flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-600'>
							<Link href='/kepsek' className='px-2.5 py-1 border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#0D0D0D] text-black bg-indigo-300 hover:bg-indigo-400 transition-colors'>
								🎓 Monitoring Kepsek
							</Link>
							<span>&bull;</span>
							<span className='text-black font-bold'>
								{getPageTitle()}
							</span>
						</div>

						{/* Top Right Quick Badges */}
						<div className='flex items-center gap-2'>
							<Link
								href='/'
								className='hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
								<span>🏫 Beranda Guru</span>
							</Link>

							<span className='px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
								<span className='w-2 h-2 rounded-full bg-emerald-700 animate-pulse'></span>
								<span>Sistem Online</span>
							</span>
						</div>
					</div>
				</header>

				{/* Main Content Render */}
				<main className='flex-1 w-full relative py-6 sm:py-8'>
					{children}
				</main>

				{/* Footer */}
				<footer className='border-t-2 border-black bg-white py-4 px-4 sm:px-6 lg:px-8 text-center text-xs font-bold text-black mt-auto'>
					<div className='flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto'>
						<p>&copy; {new Date().getFullYear()} GuruApp Core &bull; Portal Monitoring Supervisi Kepala Sekolah</p>
						<span className='text-[10px] font-mono text-gray-500'>GuruSmart System v1.0.0</span>
					</div>
				</footer>
			</div>
		</div>
	);
}
