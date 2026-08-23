'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

export default function AdminLayout({ children }) {
	const pathname = usePathname();
	const { handleLogout } = useLogout();
	const [isMobileOpen, setIsMobileOpen] = useState(false);
	const [adminName, setAdminName] = useState('Administrator');

	useEffect(() => {
		const fetchAdminProfile = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data?.user?.nama_lengkap) {
						setAdminName(data.user.nama_lengkap);
					}
				}
			} catch (err) {
				console.error('Error fetch admin profile:', err);
			}
		};
		fetchAdminProfile();
	}, []);

	const navSections = [
		{
			group: 'Utama',
			items: [
				{
					label: 'Dashboard',
					href: '/admin',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' />
						</svg>
					),
				},
			],
		},
		{
			group: 'Manajemen Akun & Beban',
			items: [
				{
					label: 'Master Pengguna',
					href: '/admin/pengguna',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
						</svg>
					),
				},
				{
					label: 'Penugasan KBM',
					href: '/admin/penugasan',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
						</svg>
					),
				},
			],
		},
		{
			group: 'Akademik & Rombel',
			items: [
				{
					label: 'Tahun Ajar & Sem.',
					href: '/admin/tahun-ajar',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
						</svg>
					),
				},
				{
					label: 'Promosi & Penjurusan',
					href: '/admin/promosi-kelas',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222' />
						</svg>
					),
				},
			],
		},
		{
			group: 'Komunikasi & Pemeliharaan',
			items: [
				{
					label: 'Kirim Pengumuman',
					href: '/admin/pengumuman',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' />
						</svg>
					),
				},
				{
					label: 'Backup & Restore',
					href: '/admin/backup',
					icon: (
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' />
						</svg>
					),
				},
			],
		},
	];

	// Sub-komponen isi sidebar (digunakan di Desktop & Mobile Drawer)
	const renderSidebarContent = (isMobile = false) => (
		<div className='flex flex-col h-full bg-white text-black'>
			{/* Brand Header */}
			<div className='p-5 border-b-2 border-black bg-yellow-300 flex items-center justify-between'>
				<Link
					href='/admin'
					onClick={() => isMobile && setIsMobileOpen(false)}
					className='flex items-center gap-3 group focus:outline-none'>
					<div className='w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#0D0D0D] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all'>
						<svg
							className='w-5 h-5 text-black'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
							strokeWidth='2.5'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
							/>
						</svg>
					</div>
					<div>
						<div className='flex items-center gap-1.5'>
							<h1 className='text-lg font-black text-black leading-tight tracking-tight uppercase'>
								Portal Admin
							</h1>
						</div>
						<p className='text-[10px] font-black text-black uppercase tracking-widest'>
							GuruSmart Core
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

			{/* Admin Profile Box */}
			<div className='p-4 border-b-2 border-black bg-yellow-50/70'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 rounded-xl bg-rose-400 border-2 border-black flex items-center justify-center font-black text-white text-base shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						{adminName ? adminName.charAt(0).toUpperCase() : 'A'}
					</div>
					<div className='min-w-0 flex-1'>
						<p className='text-xs font-black text-black truncate' title={adminName}>
							{adminName}
						</p>
						<span className='inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-rose-500 text-white rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D] mt-0.5'>
							Super Admin
						</span>
					</div>
				</div>
			</div>

			{/* Navigation Menu List */}
			<div className='flex-1 overflow-y-auto p-4 space-y-6 scrollbar-none'>
				{navSections.map((section, idx) => (
					<div key={idx} className='space-y-1.5'>
						<p className='px-3 text-[10px] font-black uppercase tracking-widest text-gray-500'>
							{section.group}
						</p>
						<div className='space-y-1'>
							{section.items.map((item) => {
								const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={() => isMobile && setIsMobileOpen(false)}
										className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
											isActive
												? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#F5C518] translate-x-[-1px] translate-y-[-1px]'
												: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200 hover:shadow-[2px_2px_0px_0px_#0D0D0D]'
										}`}>
										<span className={isActive ? 'text-yellow-300' : 'text-black'}>
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
			<div className='p-4 border-t-2 border-black bg-yellow-50 space-y-2'>
				<Link
					href='/'
					onClick={() => isMobile && setIsMobileOpen(false)}
					className='w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
					</svg>
					<span>Beralih ke Mode Guru</span>
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
								className='p-2 bg-yellow-300 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
								<svg className='w-5 h-5 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
								</svg>
							</button>

							<div>
								<h2 className='text-sm font-black uppercase text-black leading-tight'>Portal Admin</h2>
								<p className='text-[10px] font-bold text-gray-500'>{adminName}</p>
							</div>
						</div>

						{/* Desktop Breadcrumb / Section Name */}
						<div className='hidden lg:flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-600'>
							<span className='px-2.5 py-1 bg-yellow-300 border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#0D0D0D] text-black'>
								🛡️ Admin Core
							</span>
							<span>&bull;</span>
							<span className='text-black font-bold'>
								{pathname === '/admin'
									? 'Dashboard Eksekutif'
									: pathname === '/admin/pengguna'
									? 'Master Pengguna'
									: pathname === '/admin/penugasan'
									? 'Penugasan KBM'
									: pathname === '/admin/tahun-ajar'
									? 'Tahun Ajar & Semester'
									: pathname === '/admin/promosi-kelas'
									? 'Promosi Kelas & Penjurusan'
									: pathname === '/admin/pengumuman'
									? 'Broadcast Pengumuman'
									: pathname === '/admin/backup'
									? 'Backup & Restore Data'
									: 'Manajemen Sistem'}
							</span>
						</div>

						{/* Top Right Quick Badges */}
						<div className='flex items-center gap-2'>
							<Link
								href='/'
								className='hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
								<span>🏫 Mode Guru</span>
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
						<p>&copy; {new Date().getFullYear()} GuruApp Core &bull; Seluruh Hak Manajemen Terproteksi</p>
						<span className='text-[10px] font-mono text-gray-500'>GuruSmart System v1.0.0</span>
					</div>
				</footer>
			</div>
		</div>
	);
}
