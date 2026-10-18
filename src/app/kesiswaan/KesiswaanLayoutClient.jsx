'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

const KesiswaanAuthContext = createContext({
	role: 'Kesiswaan',
	nama: 'Staf Kesiswaan',
});

export function useKesiswaanAuth() {
	return useContext(KesiswaanAuthContext);
}

const KESISWAAN_NAV_SECTIONS = [
	{
		group: 'Pengawasan Presensi',
		items: [
			{
				label: 'Radar Absensi & Bolos',
				href: '/kesiswaan',
				badge: 'Live',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Tindak Lanjut & Disiplin',
		items: [
			{
				label: 'Poin & Perilaku Santri',
				href: '/kesiswaan/poin',
				badge: 'Poin',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
					</svg>
				),
			},
			{
				label: 'Buku Bimbingan Santri',
				href: '/kesiswaan/penanganan',
				badge: 'Format Kasus',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
			{
				label: 'Pemanggilan Orang Tua',
				href: '/kesiswaan/pemanggilan-ortu',
				badge: 'Resmi',
				icon: (
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
					</svg>
				),
			},
		],
	},
];

export default function KesiswaanLayoutClient({ children, initialRole = 'Kesiswaan', initialName = 'Staf Kesiswaan' }) {
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

	// Tutup sidebar mobile saat route berpindah
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSidebarOpen(false);
	}, [pathname]);

	const isMonitoringMode = userRole === 'Kepala Sekolah' || userRole === 'Admin';

	return (
		<KesiswaanAuthContext.Provider value={{ role: userRole, nama: userName }}>
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
					{/* Sidebar Brand Header */}
					<div className='p-5 border-b-3 border-black bg-white flex items-center justify-between'>
						<Link href='/kesiswaan' className='flex items-center gap-3 group'>
							<div className='w-11 h-11 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none transition-all'>
								📡
							</div>
							<div>
								<span className='font-black text-base tracking-tight block leading-tight'>
									KESISWAAN
								</span>
								<span className='text-[10px] font-black uppercase text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-400 mt-0.5 inline-block'>
									Radar Absensi & Bolos
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
								Meninjau seluruh rekam pembinaan & prestasi siswa.
							</p>
						</div>
					)}

					{/* Nav Items List */}
					<nav className='flex-1 overflow-y-auto p-4 space-y-6'>
						{KESISWAAN_NAV_SECTIONS.map((section) => (
							<div key={section.group} className='space-y-1.5'>
								<p className='text-[10px] font-black uppercase tracking-wider text-black/60 px-3'>
									{section.group}
								</p>
								<div className='space-y-1'>
									{section.items.map((item) => {
										const isActive = pathname === item.href || (item.href !== '/kesiswaan' && pathname.startsWith(item.href));
										return (
											<Link
												key={item.href}
												href={item.href}
												className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all ${
													isActive
														? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#A78BFA] translate-x-1'
														: 'bg-white text-black border-black/30 hover:border-black hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
												}`}>
												<div className='flex items-center gap-2.5 truncate'>
													<span className={isActive ? 'text-violet-300' : 'text-black'}>
														{item.icon}
													</span>
													<span className='truncate'>{item.label}</span>
												</div>
												{item.badge && (
													<span
														className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${
															isActive
																? 'bg-violet-400 text-black border-black'
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
							<div className='w-9 h-9 rounded-xl bg-violet-300 border-2 border-black flex items-center justify-center font-black text-sm shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
								{userName.charAt(0).toUpperCase()}
							</div>
							<div className='truncate'>
								<p className='font-black text-xs text-black truncate'>{userName}</p>
								<span className='inline-block text-[10px] font-bold text-violet-900 bg-violet-100 px-1.5 py-0.2 rounded border border-violet-300 uppercase'>
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
							<span className='font-black text-xs uppercase'>Menu Kesiswaan</span>
						</button>

						<div className='flex items-center gap-2'>
							<span className='text-xs font-black bg-violet-300 px-2.5 py-1 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
								🛡️ KESISWAAN
							</span>
						</div>
					</header>

					{/* Page Container */}
					<main className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none print:m-0'>
						{children}
					</main>
				</div>
			</div>
		</KesiswaanAuthContext.Provider>
	);
}
