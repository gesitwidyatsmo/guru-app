'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

import { useLogout } from '@/hooks/useLogout';

export default function AdminLayout({ children }) {
	const pathname = usePathname();
	const router = useRouter();
	const { handleLogout } = useLogout();

	return (
		<div className='min-h-screen bg-slate-50 flex flex-col'>
			{/* Navbar Portal Admin */}
			<header className='bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40'>
				<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
					<div className='flex justify-between items-center h-16'>
						{/* Logo / Brand */}
						<div className='flex-shrink-0 flex items-center gap-3'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30'>
								<svg
									className='w-6 h-6 text-white'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
									/>
								</svg>
							</div>
							<div>
								<h1 className='text-lg font-bold text-slate-800 leading-tight'>Portal Admin</h1>
								<p className='text-[10px] font-medium text-slate-500 uppercase tracking-widest'>GuruSmart Core</p>
							</div>
						</div>

						{/* Navigasi Menu */}
						<nav className='flex space-x-1 sm:space-x-4'>
							<Link
								href='/admin/pengguna'
								className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
									pathname === '/admin/pengguna' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
								}`}>
								Master Pengguna
							</Link>
							<Link
								href='/admin/penugasan'
								className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
									pathname === '/admin/penugasan' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
								}`}>
								Data Penugasan KBM
							</Link>
							<Link
								href='/admin/pengumuman'
								className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
									pathname === '/admin/pengumuman' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
								}`}>
								Kirim Pengumuman
							</Link>
							<Link
								href='/admin/backup'
								className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
									pathname === '/admin/backup' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
								}`}>
								Backup & Restore
							</Link>
						</nav>

						{/* Quick Action / Logout */}
						<div className='flex items-center gap-2'>
							<div>
								<Link
									href='/'
									className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border border-slate-200`}>
									Home
								</Link>
							</div>
							<div className='flex items-center'>
								<button
									onClick={handleLogout}
									className='flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 rounded-xl transition-all shadow-sm hover:shadow-md'>
									<svg
										className='w-4 h-4'
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
									<span className='hidden sm:inline'>Logout</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content Render */}
			<main className='flex-1 w-full relative pt-4 pb-12 transition-all'>{children}</main>
		</div>
	);
}
