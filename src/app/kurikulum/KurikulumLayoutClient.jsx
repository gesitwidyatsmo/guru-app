'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

const KurikulumAuthContext = createContext({
	role: 'Kurikulum',
	nama: 'Waka Kurikulum',
});

export function useKurikulumAuth() {
	return useContext(KurikulumAuthContext);
}

const KURIKULUM_NAV_SECTIONS = [
	{
		group: 'Utama',
		items: [
			{
				label: 'Dashboard Akademik',
				href: '/kurikulum',
				badge: 'Utama',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Rombel & Siswa',
		items: [
			{
				label: 'Master Data Kelas',
				href: '/kurikulum/kelas',
				badge: 'Rombel',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
					</svg>
				),
			},
			{
				label: 'Master Data Siswa',
				href: '/kurikulum/siswa',
				badge: 'Siswa',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Pengorganisasian KBM',
		items: [
			{
				label: 'Penugasan Guru KBM',
				href: '/kurikulum/penugasan',
				badge: 'SK KBM',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
					</svg>
				),
			},
			{
				label: 'Master Jadwal KBM',
				href: '/kurikulum/jadwal',
				badge: 'Jadwal',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
					</svg>
				),
			},
			{
				label: 'Kurikulum & Mapel',
				href: '/kurikulum/mapel',
				badge: 'Mapel',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Supervisi & Evaluasi',
		items: [
			{
				label: 'Supervisi Jurnal Guru',
				href: '/kurikulum/jurnal',
				badge: 'Jurnal',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
					</svg>
				),
			},
			{
				label: 'Presensi Mapel Siswa',
				href: '/kurikulum/absensi',
				badge: 'Presensi',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
					</svg>
				),
			},
			{
				label: 'Rekap JTM & Kehadiran',
				href: '/kurikulum/jtm',
				badge: 'JTM',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
				),
			},
			{
				label: 'Rekap & Leger Nilai',
				href: '/kurikulum/penilaian',
				badge: 'Nilai',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
					</svg>
				),
			},
			{
				label: 'Laporan Akademik KBM',
				href: '/kurikulum/laporan',
				badge: 'PDF',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Periode & Promosi',
		items: [
			{
				label: 'Tahun Ajar & Semester',
				href: '/kurikulum/tahun-ajar',
				badge: 'Aktif',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
					</svg>
				),
			},
			{
				label: 'Promosi & Kenaikan Kelas',
				href: '/kurikulum/promosi-kelas',
				badge: 'Pleno',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222' />
					</svg>
				),
			},
			{
				label: 'Manajemen E-Rapor',
				href: '/kurikulum/rapor',
				badge: 'Rapor',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
		],
	},
];

export default function KurikulumLayoutClient({ children, initialRole = 'Kurikulum', initialName = 'Waka Kurikulum' }) {
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [userName, setUserName] = useState(initialName);
	const [userRole, setUserRole] = useState(initialRole);
	const { handleLogout, isLoggingOut } = useLogout();

	useEffect(() => {
		fetch('/api/auth/me')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.user?.nama_lengkap) setUserName(data.user.nama_lengkap);
				if (data?.user?.role) setUserRole(data.user.role);
			})
			.catch(() => {});
	}, []);

	// Tutup drawer mobile saat route berpindah
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSidebarOpen(false);
	}, [pathname]);

	const isMonitoringMode = userRole === 'Kepala Sekolah' || userRole === 'Admin';

	return (
		<KurikulumAuthContext.Provider value={{ role: userRole, nama: userName }}>
			<div className='min-h-screen bg-[#FFFDF0] flex text-black font-sans'>
				{/* Backdrop Mobile Drawer */}
				{sidebarOpen && (
					<div
						className='fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity'
						onClick={() => setSidebarOpen(false)}
					/>
				)}

				{/* SIDEBAR */}
				<aside
					className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#FEF08A] border-r-3 border-black flex flex-col z-50 transition-transform duration-300 ease-in-out shrink-0 print:hidden ${
						sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
					}`}>
					{/* Brand Header */}
					<div className='p-5 border-b-3 border-black bg-white flex items-center justify-between'>
						<Link href='/kurikulum' className='flex items-center gap-3 group'>
							<div className='w-11 h-11 bg-amber-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all'>
								📐
							</div>
							<div>
								<span className='font-black text-base tracking-tight block leading-tight'>
									KURIKULUM
								</span>
								<span className='text-[10px] font-black uppercase text-amber-950 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-400 mt-0.5 inline-block'>
									Manajemen Akademik
								</span>
							</div>
						</Link>

						<button
							onClick={() => setSidebarOpen(false)}
							className='lg:hidden p-1.5 border-2 border-black rounded-lg bg-yellow-200 hover:bg-yellow-300'>
							<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
							</svg>
						</button>
					</div>

					{/* Mode Supervisi Alert */}
					{isMonitoringMode && (
						<div className='mx-4 mt-4 p-3 bg-indigo-100 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<div className='flex items-center gap-2 text-indigo-950 font-black'>
								<span>👁️</span> Mode Supervisi ({userRole})
							</div>
							<p className='text-[11px] text-indigo-900 mt-0.5 leading-snug'>
								Meninjau seluruh rancangan kurikulum, jadwal, dan progres pembelajaran.
							</p>
						</div>
					)}

					{/* Nav Items List */}
					<nav className='flex-1 overflow-y-auto p-4 space-y-6'>
						{KURIKULUM_NAV_SECTIONS.map((section) => (
							<div key={section.group} className='space-y-1.5'>
								<p className='text-[10px] font-black uppercase tracking-wider text-black/60 px-3'>
									{section.group}
								</p>
								<div className='space-y-1'>
									{section.items.map((item) => {
										const isActive = pathname === item.href || (item.href !== '/kurikulum' && pathname.startsWith(item.href));
										return (
											<Link
												key={item.href}
												href={item.href}
												className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all ${
													isActive
														? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#F59E0B] translate-x-1'
														: 'bg-white text-black border-black/30 hover:border-black hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
												}`}>
												<div className='flex items-center gap-2.5 truncate'>
													<span className={isActive ? 'text-amber-300' : 'text-black'}>
														{item.icon}
													</span>
													<span className='truncate'>{item.label}</span>
												</div>
												{item.badge && (
													<span
														className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
															isActive
																? 'bg-amber-400 text-black border-black'
																: 'bg-yellow-300 text-black border-black'
														}`}>
														{item.badge}
													</span>
												)}
											</Link>
										);
									})}
								</div>
							</div>
						))}
					</nav>

					{/* Sidebar User & Logout Footer */}
					<div className='p-4 border-t-3 border-black bg-white space-y-3'>
						<div className='flex items-center gap-2.5'>
							<div className='w-9 h-9 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center font-black text-sm shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
								{userName.charAt(0).toUpperCase()}
							</div>
							<div className='truncate'>
								<p className='font-black text-xs text-black truncate'>{userName}</p>
								<span className='inline-block text-[10px] font-bold text-amber-950 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-400 uppercase'>
									{userRole}
								</span>
							</div>
						</div>

						<button
							onClick={handleLogout}
							disabled={isLoggingOut}
							className='w-full py-2 bg-rose-400 hover:bg-rose-500 text-black font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center justify-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
							</svg>
							<span>{isLoggingOut ? 'Keluar...' : 'Keluar Sesi'}</span>
						</button>
					</div>
				</aside>

				{/* MAIN CONTENT AREA */}
				<div className='flex-1 flex flex-col min-w-0'>
					{/* Top Header Mobile Toggle */}
					<header className='lg:hidden sticky top-0 z-30 bg-[#FEF08A] border-b-3 border-black px-4 py-3 flex items-center justify-between shadow-[0px_2px_0px_0px_#0D0D0D] print:hidden'>
						<button
							onClick={() => setSidebarOpen(true)}
							className='p-2 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-2'>
							<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
							</svg>
							<span className='font-black text-xs uppercase'>Menu Kurikulum</span>
						</button>

						<div className='flex items-center gap-2'>
							<span className='text-xs font-black bg-amber-300 px-2.5 py-1 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
								📐 KURIKULUM
							</span>
						</div>
					</header>

					{/* Page Container */}
					<main className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none print:m-0'>
						{children}
					</main>
				</div>
			</div>
		</KurikulumAuthContext.Provider>
	);
}
