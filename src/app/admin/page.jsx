'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Loader from '../components/loading';

export default function AdminDashboardPage() {
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		totalUsers: 0,
		guruCount: 0,
		adminCount: 0,
		siswaCount: 0,
		kelasCount: 0,
		mapelCount: 0,
		kbmCount: 0,
	});
	const [activeTahunAjar, setActiveTahunAjar] = useState(null);
	const [lastBackup, setLastBackup] = useState(null);
	const [recentUsers, setRecentUsers] = useState([]);
	const [kbmDistribution, setKbmDistribution] = useState([]);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [resUsers, resSiswa, resKelas, resMapel, resTA] = await Promise.all([
					fetch('/api/users'),
					fetch('/api/siswa'),
					fetch('/api/kelas'),
					fetch('/api/mapel'),
					fetch('/api/tahun-ajar'),
				]);

				const usersData = resUsers.ok ? await resUsers.json() : [];
				const siswaData = resSiswa.ok ? await resSiswa.json() : [];
				const kelasData = resKelas.ok ? await resKelas.json() : [];
				const mapelData = resMapel.ok ? await resMapel.json() : [];
				const taData = resTA.ok ? await resTA.json() : [];

				const activeSiswa = Array.isArray(siswaData) ? siswaData.filter((s) => s.status === 'Aktif') : [];
				const guruList = Array.isArray(usersData) ? usersData.filter((u) => u.role === 'Guru') : [];
				const adminList = Array.isArray(usersData) ? usersData.filter((u) => u.role === 'Admin') : [];
				const activeTA = Array.isArray(taData) ? taData.find((t) => t.is_aktif) : null;

				setStats({
					totalUsers: usersData.length,
					guruCount: guruList.length,
					adminCount: adminList.length,
					siswaCount: activeSiswa.length,
					kelasCount: Array.isArray(kelasData) ? kelasData.length : 0,
					mapelCount: Array.isArray(mapelData) ? mapelData.length : 0,
					kbmCount: 0, // diupdate saat ambil detail KBM jika perlu
				});

				setActiveTahunAjar(activeTA);
				setRecentUsers(usersData.slice(0, 5));

				// Baca waktu backup terakhir
				const savedBackupTime = localStorage.getItem('last_backup_time');
				if (savedBackupTime) setLastBackup(savedBackupTime);
			} catch (error) {
				console.error('Gagal memuat data dasbor admin:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	if (loading) {
		return <Loader />;
	}

	const adminModules = [
		{
			title: 'Master Pengguna',
			desc: 'Kelola akun guru & admin, reset kata sandi, serta kontrol hak akses profil.',
			href: '/admin/pengguna',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
				</svg>
			),
			badge: `${stats.totalUsers} Akun`,
			color: 'bg-yellow-300',
			textColor: 'text-black',
		},
		{
			title: 'Penugasan KBM',
			desc: 'Petakan kewenangan mengajar guru terhadap rombongan belajar (Kelas) dan Mata Pelajaran.',
			href: '/admin/penugasan',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
				</svg>
			),
			badge: `${stats.guruCount} Guru Terdaftar`,
			color: 'bg-teal-400',
			textColor: 'text-black',
		},
		{
			title: 'Tahun Ajar & Semester',
			desc: 'Buka tahun ajaran baru dan tentukan periode semester aktif untuk seluruh sistem.',
			href: '/admin/tahun-ajar',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
				</svg>
			),
			badge: activeTahunAjar ? `TA ${activeTahunAjar.nama} Sem ${activeTahunAjar.semester}` : 'Belum Aktif',
			color: 'bg-orange-400',
			textColor: 'text-white',
		},
		{
			title: 'Promosi Kelas & Penjurusan',
			desc: 'Naikkan kelas siswa secara massal / individual atau impor plotting pemetaan penjurusan via Excel.',
			href: '/admin/promosi-kelas',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222' />
				</svg>
			),
			badge: `${stats.siswaCount} Siswa Aktif`,
			color: 'bg-purple-300',
			textColor: 'text-black',
		},
		{
			title: 'Broadcast Pengumuman',
			desc: 'Kirim notifikasi pesan kilat massal ke lonceng notifikasi dan dashboard seluruh dewan guru.',
			href: '/admin/pengumuman',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' />
				</svg>
			),
			badge: 'Live Notifikasi',
			color: 'bg-blue-400',
			textColor: 'text-white',
		},
		{
			title: 'Backup & Restore Data',
			desc: 'Unduh salinan cadangan lengkap seluruh tabel Supabase ke file Excel (.xlsx) atau lakukan pemulihan.',
			href: '/admin/backup',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' />
				</svg>
			),
			badge: lastBackup ? `Backup: ${lastBackup}` : '18 Tabel Siap',
			color: 'bg-rose-400',
			textColor: 'text-white',
		},
	];

	const masterDataShortcuts = [
		{ label: 'Data Kelas', route: '/kelas', count: stats.kelasCount, color: 'bg-orange-100 hover:bg-orange-200' },
		{ label: 'Data Siswa', route: '/siswa', count: stats.siswaCount, color: 'bg-cyan-100 hover:bg-cyan-200' },
		{ label: 'Mata Pelajaran', route: '/mapel', count: stats.mapelCount, color: 'bg-yellow-100 hover:bg-yellow-200' },
		{ label: 'Jadwal Mengajar', route: '/jadwal', count: 'Kalender', color: 'bg-emerald-100 hover:bg-emerald-200' },
		{ label: 'Jurnal Guru', route: '/jurnal', count: 'Harian', color: 'bg-indigo-100 hover:bg-indigo-200' },
		{ label: 'Rekap Laporan', route: '/laporan', count: 'Akademik', color: 'bg-pink-100 hover:bg-pink-200' },
	];

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
			{/* Welcome Banner */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] relative overflow-hidden'>
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10'>
					<div className='space-y-2'>
						<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<span>⚡</span> Pusat Kendali Administrator
						</div>
						<h1 className='text-3xl sm:text-4xl font-black text-black tracking-tight'>
							Dashboard Manajemen Admin
						</h1>
						<p className='text-sm sm:text-base font-medium text-gray-700 max-w-2xl'>
							Selamat datang di portal sentral GuruApp. Pantau kesehatan sistem, kelola penugasan guru, aktifkan periode akademik, dan amankan data sekolah dari satu tempat.
						</p>
					</div>

					<div className='flex flex-wrap items-center gap-3'>
						<Link
							href='/admin/pengguna'
							className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4'>
							<span>+</span> Tambah Pengguna
						</Link>
						<Link
							href='/admin/backup'
							className='neo-btn-outline flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4'>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
							</svg>
							Backup Sekarang
						</Link>
					</div>
				</div>
			</div>

			{/* Stat Highlights Bar */}
			<div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between'>
					<div className='flex items-center justify-between'>
						<span className='text-xs font-black uppercase tracking-wider text-gray-600'>Pengguna Sistem</span>
						<span className='p-2 bg-yellow-100 border-2 border-black rounded-xl text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>👥</span>
					</div>
					<div className='mt-4'>
						<div className='text-3xl font-black text-black'>{stats.totalUsers}</div>
						<div className='text-xs font-bold text-gray-600 mt-1 flex items-center gap-2'>
							<span className='text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300'>{stats.guruCount} Guru</span>
							<span className='text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300'>{stats.adminCount} Admin</span>
						</div>
					</div>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between'>
					<div className='flex items-center justify-between'>
						<span className='text-xs font-black uppercase tracking-wider text-gray-600'>Siswa Aktif</span>
						<span className='p-2 bg-teal-100 border-2 border-black rounded-xl text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>🎒</span>
					</div>
					<div className='mt-4'>
						<div className='text-3xl font-black text-black'>{stats.siswaCount}</div>
						<p className='text-xs font-bold text-gray-600 mt-1'>Tersebar di {stats.kelasCount} Rombel</p>
					</div>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between'>
					<div className='flex items-center justify-between'>
						<span className='text-xs font-black uppercase tracking-wider text-gray-600'>Periode Aktif</span>
						<span className='p-2 bg-purple-100 border-2 border-black rounded-xl text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>📅</span>
					</div>
					<div className='mt-4'>
						<div className='text-xl font-black text-black truncate'>
							{activeTahunAjar ? `TA ${activeTahunAjar.nama}` : 'Belum Diset'}
						</div>
						<p className='text-xs font-bold text-purple-700 mt-1'>
							{activeTahunAjar ? `Semester ${activeTahunAjar.semester} (Aktif)` : 'Silakan buka modul Tahun Ajar'}
						</p>
					</div>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between'>
					<div className='flex items-center justify-between'>
						<span className='text-xs font-black uppercase tracking-wider text-gray-600'>Kurikulum & Mapel</span>
						<span className='p-2 bg-orange-100 border-2 border-black rounded-xl text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>📚</span>
					</div>
					<div className='mt-4'>
						<div className='text-3xl font-black text-black'>{stats.mapelCount}</div>
						<p className='text-xs font-bold text-gray-600 mt-1'>Mata Pelajaran Formal</p>
					</div>
				</div>
			</div>

			{/* Main Modules Grid */}
			<div>
				<div className='flex items-center justify-between mb-4'>
					<h2 className='text-xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>🎛️</span> Modul Kendali Administrasi
					</h2>
					<span className='text-xs font-bold text-gray-500'>Pilih modul untuk mengelola</span>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
					{adminModules.map((m) => (
						<Link
							key={m.href}
							href={m.href}
							className='neo-card flex flex-col justify-between hover:translate-x-[-3px] hover:translate-y-[-3px] transition-all group !p-6'>
							<div>
								<div className='flex items-center justify-between mb-4'>
									<div className={`p-3.5 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] ${m.color} ${m.textColor}`}>
										{m.icon}
									</div>
									<span className='px-2.5 py-1 text-[11px] font-black uppercase tracking-wider bg-gray-100 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#0D0D0D] text-black'>
										{m.badge}
									</span>
								</div>
								<h3 className='text-lg font-black text-black group-hover:text-orange-600 transition-colors mb-2'>
									{m.title}
								</h3>
								<p className='text-xs font-medium text-gray-600 leading-relaxed'>
									{m.desc}
								</p>
							</div>

							<div className='mt-6 pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-black uppercase text-black group-hover:translate-x-1 transition-transform'>
								<span>Akses Modul</span>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M14 5l7 7m0 0l-7 7m7-7H3' />
								</svg>
							</div>
						</Link>
					))}
				</div>
			</div>

			{/* Master Data Quick Shortcuts */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5'>
					<div>
						<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
							<span>⚡</span> Pintasan Master Data Sekolah
						</h3>
						<p className='text-xs text-gray-600 font-medium'>
							Akses instan ke halaman data operasional harian yang digunakan guru.
						</p>
					</div>
					<Link
						href='/'
						className='text-xs font-black uppercase tracking-wider text-black hover:underline self-start sm:self-auto'>
						Buka Dasbor Guru &rarr;
					</Link>
				</div>

				<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
					{masterDataShortcuts.map((item) => (
						<Link
							key={item.route}
							href={item.route}
							className={`border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex flex-col justify-between ${item.color}`}>
							<span className='text-xs font-black text-black uppercase truncate'>{item.label}</span>
							<span className='mt-2 text-sm font-black text-gray-800 self-end font-mono'>{item.count}</span>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}
