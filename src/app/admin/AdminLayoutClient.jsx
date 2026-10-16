'use client';

import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';

export const AdminAuthContext = createContext({
	role: null,
	name: '',
	isKepsek: false,
	isAdmin: false,
});

export const useAdminAuth = () => useContext(AdminAuthContext);

const ADMIN_NAV_SECTIONS = [
	{
		group: 'Utama',
		items: [
			{
				label: 'Dashboard',
				href: '/admin',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
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
				countKey: 'pengguna',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
					</svg>
				),
			},
			{
				label: 'Penugasan KBM',
				href: '/admin/penugasan',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
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
				label: 'Master Kelas',
				href: '/admin/kelas',
				countKey: 'kelas',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
					</svg>
				),
			},
			{
				label: 'Master Siswa',
				href: '/admin/siswa',
				countKey: 'siswa',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' />
					</svg>
				),
			},
			{
				label: 'Master Mapel',
				href: '/admin/mapel',
				countKey: 'mapel',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
			{
				label: 'Tahun Ajar & Sem.',
				href: '/admin/tahun-ajar',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
					</svg>
				),
			},
			{
				label: 'Promosi & Penjurusan',
				href: '/admin/promosi-kelas',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222' />
					</svg>
				),
			},
		],
	},
	{
		group: 'Pengaturan & Pemeliharaan',
		items: [
			{
				label: 'Profil Sekolah',
				href: '/admin/sekolah',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
					</svg>
				),
			},
			{
				label: 'Lokasi & Geofencing',
				href: '/admin/lokasi-sekolah',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M15 10.5a3 3 0 11-6 0 3 3 0 016 0z' />
						<path strokeLinecap='round' strokeLinejoin='round' d='M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' />
					</svg>
				),
			},
			{
				label: 'Kirim Pengumuman',
				href: '/admin/pengumuman',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' />
					</svg>
				),
			},
			{
				label: 'Backup & Restore',
				href: '/admin/backup',
				countKey: null,
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' />
					</svg>
				),
			},
		],
	},
];

const KEPSEK_NAV_SECTIONS = [
	{
		group: 'Utama',
		items: [
			{
				label: 'Dashboard Eksekutif',
				href: '/kepsek',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
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
				href: '/jurnal',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
					</svg>
				),
			},
			{
				label: 'Rekap Nilai Siswa',
				href: '/penilaian',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
			{
				label: 'Presensi Mapel',
				href: '/absensi',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
					</svg>
				),
			},
			{
				label: 'Daftar Kelas & Wali',
				href: '/admin/kelas',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' />
					</svg>
				),
			},
			{
				label: 'Data Siswa',
				href: '/admin/siswa',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' />
					</svg>
				),
			},
			{
				label: 'Laporan Komprehensif',
				href: '/laporan',
				icon: (
					<svg className='w-5 h-5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
					</svg>
				),
			},
		],
	},
];

export default function AdminLayoutClient({ children, initialRole = null, initialName = null }) {
	const pathname = usePathname();
	const router = useRouter();
	const { handleLogout } = useLogout();
	const [isMobileOpen, setIsMobileOpen] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Inisialisasi collapse dari LocalStorage
	useEffect(() => {
		const saved = localStorage.getItem('admin_sidebar_collapsed');
		if (saved === 'true') setIsCollapsed(true);
	}, []);

	const toggleCollapse = () => {
		setIsCollapsed((prev) => {
			const next = !prev;
			localStorage.setItem('admin_sidebar_collapsed', String(next));
			return next;
		});
	};

	// Jam & Tanggal Real-Time
	const [currentTime, setCurrentTime] = useState('');
	useEffect(() => {
		const updateTime = () => {
			const now = new Date();
			const dateStr = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
			const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
			setCurrentTime(`${dateStr} • ${timeStr}`);
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, []);

	// Periode Akademik Aktif
	const [activePeriod, setActivePeriod] = useState(null);
	useEffect(() => {
		fetch('/api/tahun-ajar')
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => {
				if (Array.isArray(data)) {
					const active = data.find((t) => t.is_aktif);
					if (active) setActivePeriod(active);
				}
			})
			.catch(() => {});
	}, []);

	// Counter Badges untuk Sidebar
	const [menuCounts, setMenuCounts] = useState({
		pengguna: null,
		kelas: null,
		siswa: null,
		mapel: null,
	});

	useEffect(() => {
		Promise.all([
			fetch('/api/users').then((r) => (r.ok ? r.json() : [])).catch(() => []),
			fetch('/api/kelas?all=true').then((r) => (r.ok ? r.json() : [])).catch(() => []),
			fetch('/api/siswa').then((r) => (r.ok ? r.json() : [])).catch(() => []),
			fetch('/api/mapel?all=true').then((r) => (r.ok ? r.json() : [])).catch(() => []),
		]).then(([users, kelas, siswa, mapel]) => {
			setMenuCounts({
				pengguna: Array.isArray(users) ? users.length : null,
				kelas: Array.isArray(kelas) ? kelas.length : null,
				siswa: Array.isArray(siswa) ? siswa.filter((s) => s.status === 'Aktif').length : null,
				mapel: Array.isArray(mapel) ? mapel.length : null,
			});
		});
	}, [pathname]);

	// Global Search / Command Palette (Ctrl + K)
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		const handleKeyDown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				setIsSearchOpen((prev) => !prev);
			}
			if (e.key === 'Escape') {
				setIsSearchOpen(false);
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	// Inisialisasi role langsung dari Server Props atau LocalStorage/Cookie
	const [adminRole, setAdminRole] = useState(() => {
		if (initialRole) return initialRole;
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('user_role');
			if (stored) return stored;
			const match = document.cookie.match(/(?:^|;\s*)user_role=([^;]*)/);
			if (match) return decodeURIComponent(match[1]);
		}
		return null;
	});

	const [adminName, setAdminName] = useState(() => {
		if (initialName) return initialName;
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('user_name');
			if (stored) return stored;
			const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]*)/);
			if (match) return decodeURIComponent(match[1]);
		}
		return initialRole === 'Kepala Sekolah' ? 'Kepala Sekolah' : 'Administrator';
	});

	useEffect(() => {
		const fetchAdminProfile = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					if (data?.user?.nama_lengkap) {
						setAdminName(data.user.nama_lengkap);
						localStorage.setItem('user_name', data.user.nama_lengkap);
					}
					if (data?.user?.role) {
						setAdminRole(data.user.role);
						localStorage.setItem('user_role', data.user.role);
					}
				}
			} catch (err) {
				console.error('Error fetch admin profile:', err);
			}
		};
		fetchAdminProfile();
	}, []);

	const isKepsek = adminRole === 'Kepala Sekolah';
	const isAdmin = adminRole === 'Admin';

	const activeNavSections = useMemo(() => {
		return isKepsek ? KEPSEK_NAV_SECTIONS : ADMIN_NAV_SECTIONS;
	}, [isKepsek]);

	// Daftar search items untuk command palette
	const searchableItems = useMemo(() => {
		const list = [
			{ title: 'Dashboard Eksekutif', category: 'Menu', href: '/admin', icon: '📊' },
			{ title: 'Master Pengguna (Guru, Admin)', category: 'Menu', href: '/admin/pengguna', icon: '👥' },
			{ title: 'Penugasan KBM Guru', category: 'Menu', href: '/admin/penugasan', icon: '📋' },
			{ title: 'Master Data Kelas (Rombel)', category: 'Menu', href: '/admin/kelas', icon: '🏫' },
			{ title: 'Master Data Siswa', category: 'Menu', href: '/admin/siswa', icon: '🎒' },
			{ title: 'Master Mata Pelajaran', category: 'Menu', href: '/admin/mapel', icon: '📚' },
			{ title: 'Tahun Ajar & Semester', category: 'Menu', href: '/admin/tahun-ajar', icon: '📅' },
			{ title: 'Promosi Kelas & Penjurusan', category: 'Menu', href: '/admin/promosi-kelas', icon: '🎓' },
			{ title: 'Profil & Identitas Sekolah', category: 'Menu', href: '/admin/sekolah', icon: '🏛️' },
			{ title: 'Lokasi & Geofencing Sekolah', category: 'Menu', href: '/admin/lokasi-sekolah', icon: '📍' },
			{ title: 'Broadcast Pengumuman', category: 'Menu', href: '/admin/pengumuman', icon: '📢' },
			{ title: 'Backup & Restore Database', category: 'Menu', href: '/admin/backup', icon: '💾' },
			{ title: 'Beranda Guru (Mode Guru)', category: 'Navigasi', href: '/', icon: '🏫' },
		];

		if (!searchQuery.trim()) return list;
		const q = searchQuery.toLowerCase().trim();
		return list.filter((item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
	}, [searchQuery]);

	const renderSidebarContent = (isMobile = false) => {
		const collapsed = !isMobile && isCollapsed;

		return (
			<div className='flex flex-col h-full bg-white text-black'>
				{/* Brand Header */}
				<div className={`p-4 border-b-2 border-black flex items-center justify-between ${isKepsek ? 'bg-indigo-300' : 'bg-yellow-300'}`}>
					<Link
						href='/admin'
						onClick={() => isMobile && setIsMobileOpen(false)}
						className={`flex items-center gap-3 group focus:outline-none ${collapsed ? 'justify-center w-full' : ''}`}>
						<div className='w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#0D0D0D] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all text-xl shrink-0'>
							{isKepsek ? '🎓' : '⚡'}
						</div>
						{!collapsed && (
							<div className='min-w-0'>
								<div className='flex items-center gap-1.5'>
									<h1 className='text-base font-black text-black leading-tight tracking-tight uppercase truncate'>
										{isKepsek ? 'Portal Kepsek' : 'Portal Admin'}
									</h1>
								</div>
								<p className='text-[10px] font-black text-black uppercase tracking-widest'>
									GuruSmart Core
								</p>
							</div>
						)}
					</Link>

					{/* Close Button on Mobile */}
					{isMobile && (
						<button
							onClick={() => setIsMobileOpen(false)}
							className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
							✕
						</button>
					)}
				</div>

				{/* Admin Profile Box */}
				<div className='p-3 border-b-2 border-black bg-yellow-50/70'>
					<div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
						<div
							className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 ${
								isKepsek ? 'bg-indigo-300 text-black' : 'bg-rose-400 text-white'
							}`}
							title={adminName}>
							{adminName ? adminName.charAt(0).toUpperCase() : 'A'}
						</div>
						{!collapsed && (
							<div className='min-w-0 flex-1'>
								<p className='text-xs font-black text-black truncate' title={adminName}>
									{adminName}
								</p>
								<span
									className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D] mt-0.5 ${
										isKepsek ? 'bg-indigo-200 text-black' : 'bg-rose-500 text-white'
									}`}>
									{isKepsek ? 'Kepala Sekolah' : 'Super Admin'}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Navigation Menu List */}
				<div className='flex-1 overflow-y-auto p-3 space-y-5 scrollbar-none'>
					{activeNavSections.map((section, idx) => (
						<div key={idx} className='space-y-1.5'>
							{!collapsed && (
								<p className='px-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500'>
									{section.group}
								</p>
							)}
							<div className='space-y-1'>
								{section.items.map((item) => {
									const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
									const badgeCount = item.countKey ? menuCounts[item.countKey] : null;

									return (
										<Link
											key={item.href}
											href={item.href}
											title={collapsed ? item.label : undefined}
											onClick={() => isMobile && setIsMobileOpen(false)}
											className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
												collapsed ? 'justify-center px-2' : ''
											} ${
												isActive
													? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#F5C518] translate-x-[-1px] translate-y-[-1px]'
													: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200 hover:shadow-[2px_2px_0px_0px_#0D0D0D]'
											}`}>
											<span className={isActive ? 'text-yellow-300' : 'text-black'}>
												{item.icon}
											</span>
											{!collapsed && (
												<>
													<span className='truncate flex-1'>{item.label}</span>
													{badgeCount !== null && (
														<span
															className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black border ${
																isActive
																	? 'bg-yellow-300 text-black border-black'
																	: 'bg-yellow-100 text-black border-black/40'
															}`}>
															{badgeCount}
														</span>
													)}
												</>
											)}
										</Link>
									);
								})}
							</div>
						</div>
					))}
				</div>

				{/* Bottom Action Footer */}
				<div className='p-3 border-t-2 border-black bg-yellow-50 space-y-2'>
					{/* Collapse Toggle for Desktop */}
					{!isMobile && (
						<button
							onClick={toggleCollapse}
							title={collapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar (Mode Mini)'}
							className='w-full flex items-center justify-center gap-2 py-2 px-2 bg-yellow-200 hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
							<svg
								className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M11 19l-7-7 7-7m8 14l-7-7 7-7' />
							</svg>
							{!collapsed && <span>Ciutkan Menu</span>}
						</button>
					)}

					<Link
						href={isKepsek ? '/kepsek' : '/'}
						onClick={() => isMobile && setIsMobileOpen(false)}
						title={collapsed ? 'Mode Guru' : undefined}
						className={`w-full flex items-center justify-center gap-2 py-2 px-2 bg-white hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all ${
							collapsed ? 'px-2' : ''
						}`}>
						<svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
						</svg>
						{!collapsed && <span className='truncate'>{isKepsek ? 'Portal Kepsek' : 'Mode Guru'}</span>}
					</Link>

					<button
						onClick={handleLogout}
						title={collapsed ? 'Keluar Akun' : undefined}
						className={`w-full flex items-center justify-center gap-2 py-2 px-2 bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all ${
							collapsed ? 'px-2' : ''
						}`}>
						<svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
						</svg>
						{!collapsed && <span>Logout</span>}
					</button>
				</div>
			</div>
		);
	};

	return (
		<AdminAuthContext.Provider value={{ role: adminRole, name: adminName, isKepsek, isAdmin }}>
			<div className='min-h-screen bg-[var(--background)] flex text-black font-sans'>
				{/* Desktop Sticky Sidebar (Left) */}
				<aside
					className={`hidden lg:flex flex-col ${
						isCollapsed ? 'w-20' : 'w-72'
					} bg-white border-r-2 border-black sticky top-0 h-screen z-30 shadow-[4px_0px_0px_0px_#0D0D0D] shrink-0 transition-all duration-200`}>
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
						<div className='px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3'>
							{/* Left: Mobile Hamburger & Logo OR Desktop Breadcrumb */}
							<div className='flex items-center gap-3'>
								{/* Mobile Hamburger */}
								<div className='flex items-center gap-2 lg:hidden'>
									<button
										onClick={() => setIsMobileOpen(true)}
										aria-label='Buka Sidebar Menu'
										className='p-2 bg-yellow-300 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
										<svg className='w-5 h-5 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
											<path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
										</svg>
									</button>

									<div>
										<h2 className='text-sm font-black uppercase text-black leading-tight'>
											{isKepsek ? 'Portal Kepsek' : 'Portal Admin'}
										</h2>
										<p className='text-[10px] font-bold text-gray-500 truncate max-w-[130px]'>{adminName}</p>
									</div>
								</div>

								{/* Desktop Breadcrumb / Section Name */}
								<div className='hidden lg:flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-600'>
									<span className={`px-2.5 py-1 border-2 border-black rounded-lg shadow-[1px_1px_0px_0px_#0D0D0D] text-black ${isKepsek ? 'bg-indigo-300' : 'bg-yellow-300'}`}>
										{isKepsek ? '🎓 Supervisi Kepsek' : '🛡️ Admin Core'}
									</span>
									<span>&bull;</span>
									<span className='text-black font-bold'>
										{pathname === '/admin'
											? (isKepsek ? 'Dashboard Monitoring Eksekutif' : 'Dashboard Manajemen Admin')
											: pathname === '/admin/pengguna'
											? 'Master Pengguna'
											: pathname === '/admin/penugasan'
											? 'Penugasan KBM'
											: pathname === '/admin/kelas'
											? 'Master Kelas & Rombel'
											: pathname === '/admin/siswa'
											? 'Master Siswa'
											: pathname === '/admin/mapel'
											? 'Master Mata Pelajaran'
											: pathname === '/admin/tahun-ajar'
											? 'Tahun Ajar & Semester'
											: pathname === '/admin/promosi-kelas'
											? 'Promosi Kelas & Penjurusan'
											: pathname === '/admin/sekolah'
											? 'Profil & Identitas Sekolah'
											: pathname === '/admin/pengumuman'
											? 'Broadcast Pengumuman'
											: pathname === '/admin/backup'
											? 'Backup & Restore Data'
											: pathname === '/admin/lokasi-sekolah'
											? 'Lokasi & Geofencing Sekolah'
											: 'Manajemen Sistem'}
									</span>
								</div>
							</div>

							{/* Right: Quick Search + Active Period + Live Clock + System Status */}
							<div className='flex items-center gap-2.5'>
								{/* Quick Search Button (Ctrl + K) */}
								<button
									onClick={() => setIsSearchOpen(true)}
									title='Pencarian Cepat Menu & Data (Tekan Ctrl + K)'
									className='flex items-center gap-2 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-200 text-black border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
									</svg>
									<span className='hidden sm:inline'>Cari Cepat...</span>
									<kbd className='hidden md:inline-block px-1.5 py-0.5 text-[9px] font-mono font-black bg-white border border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D]'>
										Ctrl K
									</kbd>
								</button>

								{/* Active Academic Period Chip */}
								{activePeriod && (
									<Link
										href='/admin/tahun-ajar'
										title='Periode Akademik Aktif (Klik untuk ganti)'
										className='hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all whitespace-nowrap'>
										<span>📅</span>
										<span>TA: {activePeriod.nama} Sem {activePeriod.semester}</span>
									</Link>
								)}

								{/* Live Digital Clock */}
								{currentTime && (
									<span className='hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-white text-black border-2 border-black rounded-xl text-xs font-mono font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span>🕒</span>
										<span>{currentTime}</span>
									</span>
								)}

								{/* System Status Online Badge */}
								<span className='px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
									<span className='w-2 h-2 rounded-full bg-emerald-700 animate-pulse'></span>
									<span className='hidden sm:inline'>Sistem Online</span>
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
							<span className='text-[10px] font-mono text-gray-500'>GuruSmart System v1.1.0</span>
						</div>
					</footer>
				</div>
			</div>

			{/* Global Command Palette / Quick Search Modal */}
			{isSearchOpen && (
				<div className='fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-xl shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Search Input Box */}
						<div className='p-4 border-b-2 border-black bg-yellow-200 flex items-center gap-3'>
							<svg className='w-5 h-5 text-black shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
							</svg>
							<input
								type='text'
								autoFocus
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='Ketik nama menu atau halaman yang ingin dibuka...'
								className='w-full bg-transparent font-black text-sm text-black placeholder-black/60 focus:outline-none'
							/>
							<kbd
								onClick={() => setIsSearchOpen(false)}
								className='px-2 py-1 text-[10px] font-mono font-black bg-white border-2 border-black rounded-lg cursor-pointer hover:bg-rose-400 hover:text-white transition-colors shadow-[1px_1px_0px_0px_#0D0D0D]'>
								ESC
							</kbd>
						</div>

						{/* Results List */}
						<div className='max-h-80 overflow-y-auto p-3 space-y-1.5 bg-[#FFF5F0]'>
							{searchableItems.length === 0 ? (
								<div className='py-8 text-center text-xs font-bold text-gray-500'>
									Tidak ditemukan menu dengan kata kunci &ldquo;{searchQuery}&rdquo;
								</div>
							) : (
								searchableItems.map((item, idx) => (
									<button
										key={idx}
										onClick={() => {
											setIsSearchOpen(false);
											setSearchQuery('');
											router.push(item.href);
										}}
										className='w-full text-left p-3 bg-white hover:bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_#0D0D0D] transition-all group'>
										<div className='flex items-center gap-3 min-w-0'>
											<span className='text-xl shrink-0'>{item.icon}</span>
											<span className='text-xs font-black text-black uppercase tracking-wide truncate'>
												{item.title}
											</span>
										</div>
										<span className='px-2 py-0.5 text-[9px] font-black uppercase bg-gray-100 group-hover:bg-white border border-black rounded'>
											{item.category}
										</span>
									</button>
								))
							)}
						</div>

						{/* Footer Helper */}
						<div className='p-3 bg-white border-t-2 border-black flex items-center justify-between text-[11px] font-bold text-gray-600'>
							<span>Tekan <b>ESC</b> atau klik di luar untuk menutup</span>
							<span className='text-[10px] font-mono'>GuruSmart Navigator</span>
						</div>
					</div>
				</div>
			)}
		</AdminAuthContext.Provider>
	);
}
