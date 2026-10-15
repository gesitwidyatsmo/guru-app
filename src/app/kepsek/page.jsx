'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Loader from '../components/loading';

export default function KepsekDashboardPage() {
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		totalUsers: 0,
		guruCount: 0,
		kepsekCount: 0,
		adminCount: 0,
		siswaCount: 0,
		kelasCount: 0,
		mapelCount: 0,
	});
	const [activeTahunAjar, setActiveTahunAjar] = useState(null);

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
				const kepsekList = Array.isArray(usersData) ? usersData.filter((u) => u.role === 'Kepala Sekolah') : [];
				const adminList = Array.isArray(usersData) ? usersData.filter((u) => u.role === 'Admin') : [];
				const activeTA = Array.isArray(taData) ? taData.find((t) => t.is_aktif) : null;

				setStats({
					totalUsers: usersData.length,
					guruCount: guruList.length,
					kepsekCount: kepsekList.length,
					adminCount: adminList.length,
					siswaCount: activeSiswa.length,
					kelasCount: Array.isArray(kelasData) ? kelasData.length : 0,
					mapelCount: Array.isArray(mapelData) ? mapelData.length : 0,
				});

				setActiveTahunAjar(activeTA);
			} catch (error) {
				console.error('Gagal memuat data dasbor kepsek:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	if (loading) {
		return <Loader />;
	}

	const kepsekModules = [
		{
			title: 'Supervisi Jurnal Guru',
			desc: 'Pantau keterisian materi ajar harian, absensi kelas, dan kedisiplinan mengajar seluruh guru.',
			href: '/kepsek/jurnal',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' />
				</svg>
			),
			badge: 'KBM Harian',
			color: 'bg-indigo-300',
			textColor: 'text-black',
		},
		{
			title: 'Rekap Nilai Siswa',
			desc: 'Tinjau capaian nilai formatif, sumatif, serta persentase ketuntasan belajar siswa per kelas.',
			href: '/kepsek/penilaian',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
				</svg>
			),
			badge: 'Capaian Akademik',
			color: 'bg-teal-300',
			textColor: 'text-black',
		},
		{
			title: 'Presensi & Kehadiran',
			desc: 'Pantau rekapitulasi kehadiran, sakit, izin, dan alpa siswa di seluruh kelas dan mata pelajaran.',
			href: '/kepsek/absensi',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
				</svg>
			),
			badge: `${stats.siswaCount} Siswa`,
			color: 'bg-emerald-300',
			textColor: 'text-black',
		},
		{
			title: 'Poin & Karakter Siswa',
			desc: 'Tinjau catatan pembinaan karakter, akumulasi poin prestasi, dan penegakan tata tertib siswa.',
			href: '/kepsek/poin',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' />
				</svg>
			),
			badge: 'Kedisiplinan',
			color: 'bg-yellow-300',
			textColor: 'text-black',
		},
		{
			title: 'Penugasan KBM Guru',
			desc: 'Tinjau struktur distribusi pembagian jam dan rombel mengajar dewan guru pada semester ini.',
			href: '/kepsek/penugasan',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
				</svg>
			),
			badge: `${stats.guruCount} Guru Aktif`,
			color: 'bg-orange-300',
			textColor: 'text-black',
		},
		{
			title: 'Laporan Komprehensif',
			desc: 'Akses cetak rapor nilai, leger nilai akhir, rekap kehadiran, dan evaluasi hasil belajar semesteran.',
			href: '/kepsek/laporan',
			icon: (
				<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
					<path strokeLinecap='round' strokeLinejoin='round' d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
				</svg>
			),
			badge: 'Rekap Terpadu',
			color: 'bg-pink-300',
			textColor: 'text-black',
		},
	];

	const masterDataShortcuts = [
		{ label: 'Data Kelas', route: '/kepsek/kelas', count: stats.kelasCount, color: 'bg-orange-100 hover:bg-orange-200' },
		{ label: 'Master Pengguna', route: '/kepsek/pengguna', count: stats.totalUsers, color: 'bg-cyan-100 hover:bg-cyan-200' },
		{ label: 'Penugasan KBM', route: '/kepsek/penugasan', count: stats.guruCount, color: 'bg-yellow-100 hover:bg-yellow-200' },
		{ label: 'Tahun Ajar', route: '/kepsek/tahun-ajar', count: activeTahunAjar ? `TA ${activeTahunAjar.nama}` : 'Aktif', color: 'bg-emerald-100 hover:bg-emerald-200' },
		{ label: 'Jurnal Guru', route: '/kepsek/jurnal', count: 'Harian', color: 'bg-indigo-100 hover:bg-indigo-200' },
		{ label: 'Rekap Laporan', route: '/kepsek/laporan', count: 'Akademik', color: 'bg-pink-100 hover:bg-pink-200' },
	];

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
			{/* Welcome Banner */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] relative overflow-hidden'>
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10'>
					<div className='space-y-2'>
						<div className='inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] bg-indigo-300'>
							<span>🎓</span>
							<span>Portal Monitoring Eksekutif</span>
						</div>
						<h1 className='text-3xl sm:text-4xl font-black text-black tracking-tight'>
							Dashboard Kepala Sekolah
						</h1>
						<p className='text-sm sm:text-base font-medium text-gray-700 max-w-2xl'>
							Selamat datang di portal monitoring sentral GuruApp. Tinjau statistik institusi, distribusi beban mengajar guru, status kalender akademik, dan evaluasi data operasional sekolah secara komprehensif.
						</p>
					</div>

					<div className='flex flex-wrap items-center gap-3'>
						<Link
							href='/kepsek/pengguna'
							className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 bg-indigo-300 text-black hover:bg-indigo-400'>
							<span>👥</span> Pantau Pengguna
						</Link>
						<Link
							href='/kepsek/penugasan'
							className='neo-btn-outline flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4'>
							<span>📋</span> Pantau KBM
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
						<div className='text-xs font-bold text-gray-600 mt-1 flex flex-wrap items-center gap-1.5'>
							<span className='text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300'>{stats.guruCount} Guru</span>
							{stats.kepsekCount > 0 && (
								<span className='text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-300'>{stats.kepsekCount} Kepsek</span>
							)}
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

			{/* Main Supervisory Modules Grid */}
			<div>
				<div className='flex items-center justify-between mb-4'>
					<h2 className='text-xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>📊</span>
						<span>Modul Supervisi Akademik & KBM</span>
					</h2>
					<span className='text-xs font-bold text-gray-500'>
						Pilih modul untuk meninjau data operasional sekolah
					</span>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
					{kepsekModules.map((m) => (
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
								<h3 className='text-lg font-black text-black group-hover:text-indigo-600 transition-colors mb-2'>
									{m.title}
								</h3>
								<p className='text-xs font-medium text-gray-600 leading-relaxed'>
									{m.desc}
								</p>
							</div>

							<div className='mt-6 pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-black uppercase text-black group-hover:translate-x-1 transition-transform'>
								<span>Akses Supervisi</span>
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
							Akses cepat ke basis data master kelas, pengguna, penugasan, dan kalender akademik.
						</p>
					</div>
					<Link
						href='/kepsek/jurnal'
						className='text-xs font-black uppercase tracking-wider text-black hover:underline self-start sm:self-auto'>
						Supervisi Jurnal Harian &rarr;
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
