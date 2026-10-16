'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

const BENDAHARA_NAV_SECTIONS = [
	{
		group: 'Ringkasan',
		items: [
			{
				label: 'Dashboard Keuangan',
				href: '/bendahara',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Bisaroh & Jam Mengajar',
		items: [
			{
				label: 'Rekap JTM & Hadir',
				href: '/bendahara/jtm',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
				),
			},
			{
				label: 'Kalkulasi Bisaroh',
				href: '/bendahara/bisaroh',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Supervisi & Verifikasi',
		items: [
			{
				label: 'Audit Jurnal KBM',
				href: '/bendahara/jurnal',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
			{
				label: 'Data Dewan Guru',
				href: '/bendahara/guru',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Pengaturan Finansial',
		items: [
			{
				label: 'Tarif & Tunjangan',
				href: '/bendahara/tarif',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' />
					</svg>
				),
			},
		],
	},
];

export default function BendaharaLayoutClient({ children, initialName = 'Bendahara Sekolah' }) {
	const pathname = usePathname();
	const { handleLogout } = useLogout();
	const [isMobileOpen, setIsMobileOpen] = useState(false);

	const [bendaharaName, setBendaharaName] = useState(() => {
		if (initialName && initialName !== 'Bendahara Sekolah') return initialName;
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('user_name');
			if (saved) return saved;
		}
		return initialName || 'Bendahara Sekolah';
	});

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data?.user?.nama_lengkap) {
						setBendaharaName(data.user.nama_lengkap);
						if (typeof window !== 'undefined') {
							localStorage.setItem('user_name', data.user.nama_lengkap);
						}
					}
				}
			} catch (err) {
				console.error('Error fetch bendahara profile:', err);
			}
		};
		fetchProfile();
	}, []);

	const getPageTitle = () => {
		if (pathname === '/bendahara') return 'Dashboard Pengelolaan Keuangan & Bisaroh';
		if (pathname.startsWith('/bendahara/jtm')) return 'Rekapitulasi Jam Tatap Muka (JTM) Guru';
		if (pathname.startsWith('/bendahara/bisaroh')) return 'Perhitungan Bisaroh & Cetak Slip Gaji';
		if (pathname.startsWith('/bendahara/jurnal')) return 'Audit Jurnal Pembelajaran Guru';
		if (pathname.startsWith('/bendahara/guru')) return 'Daftar Dewan Guru & Beban Mengajar';
		if (pathname.startsWith('/bendahara/tarif')) return 'Konfigurasi Tarif per JP & Tunjangan';
		return 'Portal Bendahara Sekolah';
	};

	return (
		<div className='min-h-screen bg-[#FFFDF7] text-black font-sans flex flex-col md:flex-row antialiased selection:bg-teal-300 selection:text-black'>
			{/* Mobile Header Bar */}
			<div className='md:hidden flex items-center justify-between p-4 bg-teal-400 border-b-2 border-black sticky top-0 z-40 shadow-[0_3px_0_0_#0D0D0D]'>
				<div className='flex items-center gap-2.5'>
					<div className='w-9 h-9 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D]'>
						💼
					</div>
					<div>
						<span className='font-black text-sm uppercase tracking-tight block leading-tight'>Portal Bendahara</span>
						<span className='text-[10px] font-bold text-teal-950 block leading-none'>Keuangan & Bisaroh</span>
					</div>
				</div>
				<button
					onClick={() => setIsMobileOpen(!isMobileOpen)}
					aria-label='Toggle menu'
					className='p-2 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						{isMobileOpen ? (
							<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
						) : (
							<path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
						)}
					</svg>
				</button>
			</div>

			{/* Sidebar Container */}
			<aside
				className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r-2 border-black flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen md:sticky md:top-0 shadow-[4px_0_0_0_#0D0D0D] ${
					isMobileOpen ? 'translate-x-0' : '-translate-x-full'
				}`}>
				{/* Sidebar Branding */}
				<div className='p-5 border-b-2 border-black bg-teal-300 flex items-center justify-between'>
					<Link
						href='/bendahara'
						className='flex items-center gap-3 group'
						onClick={() => setIsMobileOpen(false)}>
						<div className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:rotate-6 transition-transform'>
							💼
						</div>
						<div>
							<h1 className='font-black text-base uppercase tracking-tight leading-tight text-black'>
								Bendahara
							</h1>
							<span className='text-[11px] font-black uppercase text-teal-950 bg-teal-200/80 px-1.5 py-0.5 rounded border border-teal-800/40 inline-block mt-0.5'>
								Portal Keuangan
							</span>
						</div>
					</Link>
					<button
						onClick={() => setIsMobileOpen(false)}
						className='md:hidden p-1.5 bg-white border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#0D0D0D]'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
						</svg>
					</button>
				</div>

				{/* User Badge in Sidebar */}
				<div className='p-4 border-b-2 border-black bg-teal-50/70'>
					<div className='flex items-center gap-3'>
						<div className='w-10 h-10 rounded-xl bg-teal-300 border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] text-black shrink-0'>
							{bendaharaName ? bendaharaName.charAt(0).toUpperCase() : 'B'}
						</div>
						<div className='overflow-hidden'>
							<p className='text-xs font-black text-black truncate' title={bendaharaName}>
								{bendaharaName}
							</p>
							<p className='text-[10px] font-bold text-teal-800 flex items-center gap-1'>
								<span>💰</span> Bendahara Sekolah
							</p>
						</div>
					</div>
				</div>

				{/* Navigation Items */}
				<nav className='flex-1 overflow-y-auto p-4 space-y-5'>
					{BENDAHARA_NAV_SECTIONS.map((sec, idx) => (
						<div key={idx} className='space-y-1.5'>
							<p className='text-[10px] font-black uppercase tracking-wider text-gray-500 px-3'>
								{sec.group}
							</p>
							<div className='space-y-1'>
								{sec.items.map((item) => {
									const isActive =
										pathname === item.href ||
										(item.href !== '/bendahara' && pathname.startsWith(item.href));

									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={() => setIsMobileOpen(false)}
											className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-xs font-black uppercase tracking-wide transition-all ${
												isActive
													? 'bg-teal-300 text-black border-black shadow-[3px_3px_0px_0px_#0D0D0D] translate-x-1'
													: 'border-transparent text-gray-700 hover:text-black hover:bg-yellow-100 hover:border-black'
											}`}>
											<span className={`${isActive ? 'text-black' : 'text-gray-500'}`}>{item.icon}</span>
											<span>{item.label}</span>
										</Link>
									);
								})}
							</div>
						</div>
					))}
				</nav>

				{/* Sidebar Footer & Logout */}
				<div className='p-4 border-t-2 border-black bg-gray-50 space-y-2'>
					<Link
						href='/'
						className='w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-black rounded-xl text-xs font-black uppercase bg-yellow-200 hover:bg-yellow-300 shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
						<span>🏠</span>
						<span>Ke Beranda Guru</span>
					</Link>
					<button
						onClick={handleLogout}
						className='w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-black rounded-xl text-xs font-black uppercase bg-rose-200 hover:bg-rose-300 text-rose-950 shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
						</svg>
						<span>Keluar Sesi</span>
					</button>
				</div>
			</aside>

			{/* Backdrop for Mobile Sidebar */}
			{isMobileOpen && (
				<div
					onClick={() => setIsMobileOpen(false)}
					className='fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs'
				/>
			)}

			{/* Main Content Area */}
			<div className='flex-1 flex flex-col min-w-0'>
				{/* Top Header Breadcrumb / Bar */}
				<header className='hidden md:flex items-center justify-between px-8 py-4 bg-white border-b-2 border-black sticky top-0 z-30 shadow-[0_2px_0_0_#0D0D0D]'>
					<div className='flex items-center gap-3'>
						<span className='px-2.5 py-1 bg-teal-100 border-2 border-black rounded-lg text-xs font-black uppercase text-teal-900 shadow-[1px_1px_0px_0px_#0D0D0D]'>
							Portal Finansial
						</span>
						<span className='text-gray-400 font-black'>/</span>
						<h2 className='text-sm font-black text-black uppercase tracking-tight'>{getPageTitle()}</h2>
					</div>

					<div className='flex items-center gap-3'>
						<div className='text-right'>
							<p className='text-xs font-black text-black leading-tight'>{bendaharaName}</p>
							<p className='text-[10px] font-bold text-gray-500'>Keuangan & Bisaroh Guru</p>
						</div>
						<div className='w-9 h-9 rounded-xl bg-teal-300 border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
							💼
						</div>
					</div>
				</header>

				{/* Page Content Viewport */}
				<main className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6'>
					{children}
				</main>

				{/* Footer */}
				<footer className='px-8 py-4 bg-white border-t-2 border-black text-center text-xs font-bold text-gray-600 mt-auto'>
					<p>&copy; {new Date().getFullYear()} GuruApp &bull; Portal Pengelolaan Keuangan & Bisaroh Guru</p>
				</footer>
			</div>
		</div>
	);
}
