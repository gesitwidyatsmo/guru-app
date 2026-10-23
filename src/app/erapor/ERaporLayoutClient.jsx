'use client';

import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	ArrowLeft,
	FileSpreadsheet,
	Target,
	Calculator,
	Sparkles,
	UserCheck,
	Award,
	TableProperties,
	Printer,
	LayoutDashboard,
	ShieldAlert,
	Trophy,
} from 'lucide-react';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

// Context Auth ERapor agar seluruh sub-halaman dapat mengakses role secara instan
export const ERaporAuthContext = createContext({
	userRole: 'Guru',
	isWaliKelas: false,
	isPrivileged: false,
	userName: '',
	userId: null,
});

export const useERaporAuth = () => useContext(ERaporAuthContext);

export default function ERaporLayoutClient({
	children,
	initialRole = 'Guru',
	initialIsWaliKelas = false,
	initialName = '',
	userId = null,
}) {
	const pathname = usePathname();

	// Inisialisasi role dan wali kelas secara SINKRON dari props server / cookies
	const [userRole, setUserRole] = useState(() => {
		if (initialRole) return initialRole;
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('user_role');
			if (stored) return stored;
			const match = document.cookie.match(/(?:^|;\s*)user_role=([^;]*)/);
			if (match) return decodeURIComponent(match[1]);
		}
		return 'Guru';
	});

	const [isWaliKelas, setIsWaliKelas] = useState(() => {
		if (typeof initialIsWaliKelas === 'boolean') return initialIsWaliKelas;
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('is_wali_kelas');
			if (stored === 'true') return true;
			if (stored === 'false') return false;
		}
		return false;
	});

	const [userName, setUserName] = useState(initialName || '');
	const [currentUserId, setCurrentUserId] = useState(userId || null);

	// Background re-sync (tidak memicu jeda/flicker tampilan)
	useEffect(() => {
		async function syncAuth() {
			try {
				const [resAuth, resWali] = await Promise.all([
					fetch('/api/auth/me'),
					fetch('/api/wali-kelas/my-class').catch(() => null),
				]);

				if (resAuth.ok) {
					const authData = await resAuth.json();
					if (authData?.user?.role) {
						setUserRole(authData.user.role);
						localStorage.setItem('user_role', authData.user.role);
					}
					if (authData?.user?.nama_lengkap) {
						setUserName(authData.user.nama_lengkap);
					}
					if (authData?.user?.id) {
						setCurrentUserId(authData.user.id);
					}
				}

				if (resWali && resWali.ok) {
					const waliData = await resWali.json();
					const isWali = Boolean(waliData?.isWaliKelas);
					setIsWaliKelas(isWali);
					localStorage.setItem('is_wali_kelas', String(isWali));
				}
			} catch (err) {
				console.error('Silent sync erapor auth error:', err);
			}
		}
		syncAuth();
	}, []);

	const isGuruMapelPage = ['/erapor/rekap-nilai', '/erapor/tujuan-pembelajaran', '/erapor/nilai-kuantitatif', '/erapor/nilai-kualitatif'].includes(pathname);
	const isWaliKelasPage = ['/erapor/ketidakhadiran', '/erapor/ekstrakurikuler', '/erapor/rekap-leger', '/erapor/juara', '/erapor/cetak'].includes(pathname);
	const isDashboard = pathname === '/erapor';

	const guruMapelNav = useMemo(
		() => [
			{
				href: '/erapor/rekap-nilai',
				label: 'Rekap Nilai',
				shortLabel: 'Rekap',
				icon: FileSpreadsheet,
			},
			{
				href: '/erapor/tujuan-pembelajaran',
				label: 'Tujuan Pembelajaran',
				shortLabel: 'TP',
				icon: Target,
			},
			{
				href: '/erapor/nilai-kuantitatif',
				label: 'Nilai Kuantitatif',
				shortLabel: 'Kuantitatif',
				icon: Calculator,
			},
			{
				href: '/erapor/nilai-kualitatif',
				label: 'Nilai Kualitatif',
				shortLabel: 'Kualitatif',
				icon: Sparkles,
			},
		],
		[]
	);

	const waliKelasNav = useMemo(
		() => [
			{
				href: '/erapor/ketidakhadiran',
				label: 'Presensi Semester',
				shortLabel: 'Presensi',
				icon: UserCheck,
			},
			{
				href: '/erapor/ekstrakurikuler',
				label: 'Ekstrakurikuler',
				shortLabel: 'Ekskul',
				icon: Award,
			},
			{
				href: '/erapor/rekap-leger',
				label: 'Leger Nilai',
				shortLabel: 'Leger',
				icon: TableProperties,
			},
			{
				href: '/erapor/juara',
				label: 'Juara & Piagam',
				shortLabel: 'Juara',
				icon: Trophy,
			},
			{
				href: '/erapor/cetak',
				label: 'Cetak Rapor',
				shortLabel: 'Cetak',
				icon: Printer,
			},
		],
		[]
	);

	const isPrivileged =
		userRole === 'Admin' ||
		userRole === 'Kepala Sekolah' ||
		userRole === 'Kurikulum' ||
		isWaliKelas;

	// Cek apakah halaman dilarang untuk role guru saat ini
	const isRestrictedPage = useMemo(() => {
		const waliOnlyPages = [
			'/erapor/ketidakhadiran',
			'/erapor/ekstrakurikuler',
			'/erapor/rekap-leger',
			'/erapor/juara',
			'/erapor/cetak',
		];

		return !isPrivileged && userRole === 'Guru' && waliOnlyPages.includes(pathname);
	}, [isPrivileged, userRole, pathname]);

	const authContextValue = useMemo(
		() => ({
			userRole,
			isWaliKelas,
			isPrivileged,
			userName,
			userId: currentUserId,
		}),
		[userRole, isWaliKelas, isPrivileged, userName, currentUserId]
	);

	return (
		<ERaporAuthContext.Provider value={authContextValue}>
			<div className='min-h-screen bg-[#FFFDF5] text-black font-sans'>
				{/* =================================================================== */}
				{/* TOP HEADER: NEOBRUTALISM CLEAN & COMPACT                            */}
				{/* =================================================================== */}
				<header className='bg-white border-b-[3px] border-black sticky top-0 z-40 shadow-[0_4px_0px_0px_#0D0D0D] print:hidden'>
					{/* Baris Atas: Brand & Global Actions */}
					<div className='max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5'>
						<div className='flex items-center justify-between gap-2 sm:gap-3'>
							{/* Sisi Kiri: Tombol Back & Identitas Modul */}
							<div className='flex items-center gap-2 sm:gap-3 min-w-0'>
								<Link
									href='/'
									className='w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-[#F5C518] hover:bg-[#E8451A] hover:text-white text-black border-2 border-black rounded-none shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[2.5px_2.5px_0px_0px_#0D0D0D] flex items-center justify-center transition-all cursor-pointer'
									title='Kembali ke Beranda Utama Guru App'>
									<ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5 shrink-0' strokeWidth={2.5} />
								</Link>

								<div className='min-w-0'>
									<div className='flex items-center gap-1.5 sm:gap-2 flex-wrap'>
										<span className='px-1.5 py-0.2 bg-black text-[#F5C518] text-[9px] font-black uppercase tracking-wider rounded-none shrink-0'>
											Kurikulum Merdeka
										</span>
										{userRole === 'Guru' && !isWaliKelas && (
											<span className='px-1.5 py-0.2 bg-[#2F80ED] text-white text-[9px] font-black uppercase tracking-wider rounded-none shrink-0'>
												Guru Mapel
											</span>
										)}
										{isWaliKelas && (
											<span className='px-1.5 py-0.2 bg-[#00A693] text-white text-[9px] font-black uppercase tracking-wider rounded-none shrink-0'>
												Wali Kelas
											</span>
										)}
										<span className='text-[10px] sm:text-[11px] font-bold text-gray-600 truncate hidden md:inline'>
											Fase D • SMP IT Tebuireng 4 Al-Ishlah
										</span>
									</div>
									<h1 className='text-sm sm:text-xl font-black text-black tracking-tight leading-tight truncate mt-0.5'>
										E-RAPOR DIGITAL
									</h1>
								</div>
							</div>

							{/* Sisi Kanan: Chip Periode Akademik */}
							<div className='flex items-center gap-2 shrink-0'>
								<AcademicPeriodChip />
							</div>
						</div>
					</div>

					{/* Baris Bawah: Contextual Navigation Bar (Hanya 3 atau 4 Tab Sesuai Ranah Kerja) */}
					<div className='border-t-2 border-black bg-[#F8F7F0]'>
						<div className='max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
							{isDashboard ? (
								/* Tampilan Bar saat di Dashboard Utama */
								<div className='flex items-center justify-between gap-2 py-0.5 min-w-max'>
									<div className='flex items-center gap-2 shrink-0'>
										<span className='px-2.5 py-1 bg-black text-[#F5C518] text-xs font-black uppercase rounded-lg shadow-[2px_2px_0px_#000] shrink-0 whitespace-nowrap'>
											Pusat Pengerjaan Rapor
										</span>
										<span className='text-xs font-bold text-gray-600 hidden sm:inline shrink-0 whitespace-nowrap'>
											Pilih zona tugas Guru Mapel atau Wali Kelas di bawah
										</span>
									</div>

									<div className='flex items-center gap-2 text-xs font-black shrink-0 whitespace-nowrap'>
										<a
											href='#zona-guru-mapel'
											className='px-3 py-1 bg-white hover:bg-yellow-100 text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] transition-all shrink-0 whitespace-nowrap'>
											📘 Zona Guru Mapel
										</a>
										{(isWaliKelas || isPrivileged) && (
											<a
												href='#zona-wali-kelas'
												className='px-3 py-1 bg-[#00A693] hover:bg-teal-400 text-white border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] transition-all shrink-0 whitespace-nowrap'>
												🏫 Zona Wali Kelas
											</a>
										)}
									</div>
								</div>
							) : isGuruMapelPage ? (
								/* Tampilan Bar saat Berada di Halaman Guru Mapel (Hanya 3 Tab) */
								<div className='flex items-center justify-start sm:justify-between gap-2 sm:gap-3 py-0.5 min-w-max flex-nowrap'>
									<div className='flex items-center gap-1.5 sm:gap-2 shrink-0'>
										<Link
											href='/erapor'
											className='flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-yellow-200 text-black text-xs font-black border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] transition-all cursor-pointer shrink-0 whitespace-nowrap'>
											<ArrowLeft className='w-3.5 h-3.5 shrink-0' />
											<span>E-Rapor</span>
										</Link>
										<span className='px-2 py-0.5 bg-[#2F80ED] text-white text-[10px] font-black uppercase rounded border border-black hidden md:inline shrink-0 whitespace-nowrap'>
											Guru Mapel
										</span>
									</div>

									<div className='w-px h-5 bg-black/20 shrink-0' />

									<nav className='flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap'>
										{guruMapelNav.map((item) => {
											const Icon = item.icon;
											const isActive = pathname === item.href;
											return (
												<Link
													key={item.href}
													href={item.href}
													className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-black transition-all cursor-pointer rounded-xl border-2 border-black shrink-0 whitespace-nowrap ${
														isActive
															? 'bg-[#F5C518] text-black shadow-[2px_2px_0px_0px_#000]'
															: 'bg-white text-gray-800 hover:bg-yellow-100'
													}`}>
													<Icon className='w-3.5 h-3.5 shrink-0' />
													<span className='hidden sm:inline'>{item.label}</span>
													<span className='inline sm:hidden'>{item.shortLabel}</span>
												</Link>
											);
										})}
									</nav>

									{(isWaliKelas || isPrivileged) && (
										<Link
											href='/erapor/ketidakhadiran'
											className='hidden md:flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black hover:underline shrink-0 whitespace-nowrap'>
											<span>Ke Wali Kelas</span>
											<span>➔</span>
										</Link>
									)}
								</div>
							) : isWaliKelasPage ? (
								/* Tampilan Bar saat Berada di Halaman Wali Kelas (Hanya 4 Tab) */
								<div className='flex items-center justify-start sm:justify-between gap-2 sm:gap-3 py-0.5 min-w-max flex-nowrap'>
									<div className='flex items-center gap-1.5 sm:gap-2 shrink-0'>
										<Link
											href='/erapor'
											className='flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-yellow-200 text-black text-xs font-black border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] transition-all cursor-pointer shrink-0 whitespace-nowrap'>
											<ArrowLeft className='w-3.5 h-3.5 shrink-0' />
											<span>E-Rapor</span>
										</Link>
										<span className='px-2 py-0.5 bg-[#00A693] text-white text-[10px] font-black uppercase rounded border border-black hidden md:inline shrink-0 whitespace-nowrap'>
											Wali Kelas
										</span>
									</div>

									<div className='w-px h-5 bg-black/20 shrink-0' />

									<nav className='flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap'>
										{waliKelasNav.map((item) => {
											const Icon = item.icon;
											const isActive = pathname === item.href;
											return (
												<Link
													key={item.href}
													href={item.href}
													className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-black transition-all cursor-pointer rounded-xl border-2 border-black shrink-0 whitespace-nowrap ${
														isActive
															? 'bg-[#F5C518] text-black shadow-[2px_2px_0px_0px_#000]'
															: 'bg-white text-gray-800 hover:bg-yellow-100'
													}`}>
													<Icon className='w-3.5 h-3.5 shrink-0' />
													<span className='hidden sm:inline'>{item.label}</span>
													<span className='inline sm:hidden'>{item.shortLabel}</span>
												</Link>
											);
										})}
									</nav>

									<Link
										href='/erapor/tujuan-pembelajaran'
										className='hidden md:flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-black hover:underline shrink-0 whitespace-nowrap'>
										<span>Ke Guru Mapel</span>
										<span>➔</span>
									</Link>
								</div>
							) : null}
						</div>
					</div>
				</header>

				{/* =================================================================== */}
				{/* KONTEN UTAMA                                                        */}
				{/* =================================================================== */}
				<main className='max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8'>
					{isRestrictedPage ? (
						<div className='bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_0px_#0D0D0D] text-center max-w-xl mx-auto my-12'>
							<div className='w-14 h-14 bg-rose-100 border-2 border-black flex items-center justify-center mx-auto mb-4'>
								<ShieldAlert className='w-7 h-7 text-rose-600' strokeWidth={2.5} />
							</div>
							<h2 className='text-lg sm:text-xl font-black text-black mb-2'>
								Akses Terbatas: Khusus Wali Kelas & Admin
							</h2>
							<p className='text-sm text-gray-700 font-bold mb-6'>
								Sebagai Guru Mata Pelajaran, Anda hanya bertugas mengisi Tujuan Pembelajaran (TP), Nilai Kuantitatif, dan Nilai Kualitatif pada kelas yang Anda ampu.
							</p>
							<Link
								href='/erapor'
								className='inline-flex items-center gap-2 px-4 py-2 bg-[#F5C518] text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-xs sm:text-sm cursor-pointer'>
								<ArrowLeft className='w-4 h-4' strokeWidth={2.5} />
								Kembali ke Ringkasan E-Rapor
							</Link>
						</div>
					) : (
						children
					)}
				</main>
			</div>
		</ERaporAuthContext.Provider>
	);
}
