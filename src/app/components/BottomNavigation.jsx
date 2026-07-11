'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNavigation() {
	const pathname = usePathname();

	// Jangan tampilkan di halaman login atau area admin
	if (!pathname || pathname === '/login' || pathname.startsWith('/admin')) {
		return null;
	}

	const navItems = [
		{
			label: 'Home',
			path: '/',
			icon: (
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			)
		},
		{
			label: 'Absensi',
			path: '/absensi',
			icon: (
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
				</svg>
			)
		},
		{
			label: 'Penilaian',
			path: '/penilaian',
			icon: (
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			)
		},
		{
			label: 'Laporan',
			path: '/laporan',
			icon: (
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
			)
		},
		{
			label: 'Profil',
			path: '/profil',
			icon: (
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
			)
		}
	];

	return (
		<>
			{/* Spacer untuk mencegah konten tertutup Bottom Navigation */}
			<div className="h-16 md:hidden"></div>
			
			<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-[100] md:hidden pb-safe">
				<div className="flex justify-around items-center h-16 px-2">
					{navItems.map((item) => {
						const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
						return (
							<Link
								key={item.path}
								href={item.path}
								className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
									isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-500'
								}`}
							>
								<div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
									{item.icon}
								</div>
								<span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
									{item.label}
								</span>
							</Link>
						);
					})}
				</div>
			</div>
		</>
	);
}
