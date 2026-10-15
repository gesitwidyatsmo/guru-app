'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { useAcademic } from '@/context/AcademicContext';

export default function KepsekLaporanPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchMaster = async () => {
			try {
				const [resKelas, resMapel] = await Promise.all([
					fetch('/api/kelas'),
					fetch('/api/mapel'),
				]);
				const kData = resKelas.ok ? await resKelas.json() : [];
				const mData = resMapel.ok ? await resMapel.json() : [];
				setKelasList(Array.isArray(kData) ? kData : []);
				setMapelList(Array.isArray(mData) ? mData : []);
			} catch (err) {
				console.error('Gagal mengambil master data laporan:', err);
			} finally {
				setLoading(false);
			}
		};
		fetchMaster();
	}, []);

	if (loading) {
		return <Loader />;
	}

	const reportModules = [
		{
			title: 'Rekapitulasi Jurnal KBM',
			desc: 'Laporan keterisian materi ajar, rekap jam terlaksana, dan kedisiplinan mengajar harian guru.',
			route: '/kepsek/jurnal',
			badge: 'KBM Harian',
			icon: '📖',
			color: 'bg-indigo-300',
		},
		{
			title: 'Laporan Nilai & Capaian Belajar',
			desc: 'Audit capaian nilai formatif, sumatif, dan statistik ketuntasan KKM siswa per rombel.',
			route: '/kepsek/penilaian',
			badge: 'Akademik',
			icon: '📊',
			color: 'bg-teal-300',
		},
		{
			title: 'Rekapitulasi Presensi Siswa',
			desc: 'Laporan tingkat kehadiran, persentase hadir, sakit, izin, dan alpa di seluruh kelas.',
			route: '/kepsek/absensi',
			badge: 'Kehadiran',
			icon: '📋',
			color: 'bg-emerald-300',
		},
		{
			title: 'Rekapitulasi Karakter & Poin',
			desc: 'Laporan pembinaan kedisiplinan siswa, akumulasi poin prestasi dan catatan pelanggaran.',
			route: '/kepsek/poin',
			badge: 'Disiplin',
			icon: '⭐',
			color: 'bg-yellow-300',
		},
	];

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-pink-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📑</span> Pusat Laporan & Audit Sekolah
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Pusat Laporan & Evaluasi Akademik
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Pilih modul rekapitulasi data sekolah yang ingin dievaluasi, diaudit, atau dicetak sebagai laporan resmi institusi.
					</p>
				</div>

				<div className='bg-indigo-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center'>
					<span className='text-gray-500 block text-[10px] uppercase'>Periode Sistem</span>
					<span className='text-indigo-950 font-bold'>TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}</span>
				</div>
			</div>

			{/* Reporting Modules Grid */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
				{reportModules.map((m) => (
					<Link
						key={m.route}
						href={m.route}
						className='neo-card flex flex-col justify-between hover:translate-x-[-3px] hover:translate-y-[-3px] transition-all group !p-6'>
						<div>
							<div className='flex items-center justify-between mb-4'>
								<div className={`w-12 h-12 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-center text-2xl ${m.color}`}>
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
							<span>Buka Laporan Terperinci</span>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M14 5l7 7m0 0l-7 7m7-7H3' />
							</svg>
						</div>
					</Link>
				))}
			</div>

			{/* Export Banner & Cetak Rapor Terpadu */}
			<div className='bg-gradient-to-r from-yellow-200 via-orange-100 to-yellow-100 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
				<div className='space-y-1'>
					<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>🖨️</span> Cetak Rapor Nilai & Dokumen Leger Terpusat
					</h3>
					<p className='text-xs font-bold text-gray-700 max-w-2xl'>
						Perlu mengunduh dokumen fisik rapor per siswa atau mencetak leger nilai resmi dalam format PDF & Excel? Gunakan modul cetak terpadu.
					</p>
				</div>

				<Link
					href='/laporan'
					className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-5 bg-black text-white whitespace-nowrap shrink-0'>
					<span>Cetak Dokumen Leger &rarr;</span>
				</Link>
			</div>
		</div>
	);
}
