'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Users, Calendar, Loader2, BookOpen } from 'lucide-react';
import ButtonBack from '../components/button/ButtonBack';
import { useRouter } from 'next/navigation';
import Loader from '../components/loading';

export default function ManajemenGrupPage() {
	const router = useRouter();

	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadingPage, setLoadingPage] = useState(true);
	const [search, setSearch] = useState('');

	useEffect(() => {
		fetch('/api/grup')
			.then((res) => res.json())
			.then((json) => {
				if (Array.isArray(json)) setData(json);
				setLoading(false);
			})
			.catch((err) => {
				console.error(err);
				setLoading(false);
			})
			.finally(() => setLoadingPage(false));
	}, []);

	const filtered = data.filter((item) => item.judul_kegiatan?.toLowerCase().includes(search.toLowerCase()) || item.kelas_id?.toLowerCase().includes(search.toLowerCase()));

	if (loadingPage) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-slate-50 p-5 md:p-8 font-sans text-slate-900'>
			<div className='max-w-6xl mx-auto'>
				<ButtonBack />

				{/* Header */}
				<div className='flex flex-col md:flex-row md:items-end md:justify-between mb-8 gap-4'>
					<div>
						<h1 className='text-3xl md:text-4xl font-bold tracking-tight text-slate-900'>Manajemen Grup</h1>
						<p className='text-slate-500 mt-1'>Kelola pembagian kelompok siswa secara otomatis & manual.</p>
					</div>

					<Link
						href='/grup/tambah'
						className='inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm hover:shadow-indigo-200/60 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'
						aria-label='Buat grup baru'>
						<Plus className='w-5 h-5' />
						Buat Grup Baru
					</Link>
				</div>

				{/* Filter & Search */}
				<div className='bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200/70 mb-6'>
					<div className='relative'>
						<Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5' />
						<input
							type='text'
							placeholder='Cari judul kegiatan, kelas, atau mapel...'
							className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50/40 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder:text-slate-400'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>

				{/* Content */}
				{loading ? (
					<div className='flex flex-col items-center justify-center py-20 gap-3'>
						<Loader2 className='w-9 h-9 animate-spin text-indigo-600' />
						<p className='text-sm text-slate-500'>Memuat data grup...</p>
					</div>
				) : filtered.length === 0 ? (
					<div className='text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300'>
						<div className='mx-auto mb-3 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center'>
							<Users className='w-6 h-6 text-slate-400' />
						</div>
						<p className='text-slate-600 font-medium'>Belum ada data grup.</p>
						<p className='text-slate-500 text-sm mt-1'>Silakan buat grup baru untuk memulai.</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
						{filtered.map((item) => (
							<div
								key={item.id}
								className='bg-white rounded-2xl shadow-sm border border-slate-200/70 hover:border-indigo-200 hover:shadow-md transition duration-200 flex flex-col overflow-hidden'>
								<div className='p-5 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/60'>
									<div className='flex justify-between items-start mb-2 gap-3'>
										<span className='bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide border border-indigo-100'>{item.kelas_id}</span>
										<span className='text-[11px] text-slate-400 font-mono truncate max-w-[120px]'>{item.id}</span>
									</div>

									<h3 className='font-bold text-lg text-slate-900 line-clamp-2 leading-snug'>{item.judul_kegiatan}</h3>

									<div className='flex items-center gap-1.5 text-sm text-slate-500 mt-1'>
										<BookOpen className='w-4 h-4 text-slate-400' />
										<span className='truncate'>{item.mapel_id}</span>
									</div>
								</div>

								<div className='p-5 grid grid-cols-2 gap-4'>
									<div className='rounded-xl bg-slate-50 p-3 border border-slate-100'>
										<p className='text-xs text-slate-500 mb-1'>Jumlah Grup</p>
										<p className='font-semibold text-slate-900 flex items-center gap-2'>
											<Users className='w-4 h-4 text-indigo-600' />
											{item.total_grup}
										</p>
									</div>

									<div className='rounded-xl bg-slate-50 p-3 border border-slate-100'>
										<p className='text-xs text-slate-500 mb-1'>Total Siswa</p>
										<p className='font-semibold text-slate-900'>{item.total_siswa}</p>
									</div>
								</div>

								<div className='mt-auto p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm'>
									<div className='flex items-center gap-2 text-slate-500'>
										<Calendar className='w-4 h-4 text-slate-400' />
										<span className='truncate max-w-[140px]'>{item.tanggal}</span>
									</div>

									<Link
										href={`/grup/${item.id}`}
										className='text-indigo-600 font-semibold hover:text-indigo-700 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-md px-1'>
										Lihat Detail →
									</Link>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
