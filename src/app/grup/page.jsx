'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Users, Calendar, BookOpen, ChevronLeft } from 'lucide-react';
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
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#F5C518] p-3 border-[4px] border-[#0D0D0D] -rotate-1 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>MANAJEMEN GRUP</h1>
					</div>
				</div>

				{/* Sub-Header & Aksi */}
				<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-none'>
					<div className='w-full md:w-auto flex flex-col gap-2'>
						<h1 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>Data Kelompok</h1>
						<p className='text-sm font-bold text-[#0D0D0D] bg-[#A3E635] border-[2px] border-[#0D0D0D] px-2 py-1 inline-block w-fit'>Kelola pembagian kelompok siswa</p>
					</div>

					<div className='flex flex-col sm:flex-row w-full md:w-auto gap-4'>
						<Link
							href='/grup/tambah'
							className='h-[60px] px-6 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] rounded-none font-black text-sm hover:-translate-y-1 transition-all shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center gap-2 uppercase tracking-widest whitespace-nowrap'
							aria-label='Buat grup baru'>
							<Plus className='w-6 h-6' strokeWidth={3} />
							BUAT GRUP BARU
						</Link>
					</div>
				</div>

				{/* Filter & Search */}
				<div className='relative flex items-center'>
					<div className='absolute left-4 pointer-events-none'>
						<Search className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
					</div>
					<input
						type='text'
						placeholder='CARI JUDUL KEGIATAN, KELAS, ATAU MAPEL...'
						className='pl-14 pr-4 h-[60px] w-full border-[4px] border-[#0D0D0D] rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[8px_8px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[10px_10px_0px_0px_#0D0D0D] transition-all bg-white placeholder:text-gray-400'
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				{/* Content */}
				{loading ? (
					<div className='flex flex-col items-center justify-center py-20 bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<div className='text-center font-black text-2xl text-[#0D0D0D] uppercase tracking-widest animate-pulse'>MEMUAT DATA GRUP...</div>
					</div>
				) : filtered.length === 0 ? (
					<div className='p-16 text-center flex flex-col items-center justify-center border-[4px] border-[#0D0D0D] bg-[#FFF5F0] shadow-[12px_12px_0px_0px_#0D0D0D] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")]'>
						<div className='bg-[#E8451A] p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] mb-4'>
							<Users className='w-10 h-10 text-white' strokeWidth={3} />
						</div>
						<p className='font-black text-[#0D0D0D] uppercase tracking-widest text-xl bg-white border-[3px] border-[#0D0D0D] px-4 py-2 mt-2 -rotate-1'>BELUM ADA DATA GRUP.</p>
						<p className='text-[#0D0D0D] font-bold uppercase tracking-widest mt-4'>Silakan buat grup baru untuk memulai.</p>
					</div>
				) : (
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
						{filtered.map((item) => (
							<div
								key={item.id}
								className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:shadow-[12px_12px_0px_0px_#0D0D0D] hover:-translate-y-1 transition-all flex flex-col rounded-none group overflow-hidden relative'>
								
								{/* Dekorasi Pojok */}
								<div className='absolute -right-8 -top-8 w-24 h-24 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rotate-12 z-0'></div>

								<div className='p-6 border-b-[4px] border-[#0D0D0D] relative z-10 bg-white'>
									<div className='flex justify-between items-start mb-4 gap-3'>
										<span className='bg-[#A3E635] text-[#0D0D0D] text-xs font-black px-3 py-1 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase tracking-widest'>{item.kelas_id}</span>
										<span className='text-[10px] text-[#0D0D0D] font-black uppercase tracking-widest bg-gray-200 px-2 border-[2px] border-[#0D0D0D] truncate max-w-[100px]'>ID: {item.id}</span>
									</div>

									<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest line-clamp-2 min-h-[56px]'>{item.judul_kegiatan}</h3>

									<div className='flex items-center gap-2 text-sm text-[#0D0D0D] mt-3 font-bold uppercase tracking-widest'>
										<BookOpen className='w-5 h-5' strokeWidth={3} />
										<span className='truncate'>{item.mapel_id}</span>
									</div>
								</div>

								<div className='p-6 grid grid-cols-2 gap-4 bg-[#FFF5F0] z-10'>
									<div className='bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-3 rounded-none'>
										<p className='text-[10px] text-[#0D0D0D] font-black uppercase tracking-widest mb-1'>JUMLAH GRUP</p>
										<p className='font-black text-xl text-[#0D0D0D] flex items-center gap-2'>
											<Users className='w-5 h-5 text-[#2F80ED]' strokeWidth={3} />
											{item.total_grup}
										</p>
									</div>

									<div className='bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-3 rounded-none'>
										<p className='text-[10px] text-[#0D0D0D] font-black uppercase tracking-widest mb-1'>TOTAL SISWA</p>
										<p className='font-black text-xl text-[#0D0D0D] flex items-center gap-2'>
											{item.total_siswa}
										</p>
									</div>
								</div>

								<div className='mt-auto p-6 bg-white border-t-[4px] border-[#0D0D0D] flex justify-between items-center z-10'>
									<div className='flex items-center gap-2 text-[#0D0D0D] font-bold text-xs uppercase tracking-widest'>
										<Calendar className='w-5 h-5' strokeWidth={3} />
										<span className='truncate max-w-[120px]'>{item.tanggal}</span>
									</div>

									<Link
										href={`/grup/${item.id}`}
										className='bg-[#0D0D0D] text-white font-black uppercase tracking-widest text-xs px-4 py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#E8451A] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E8451A] transition-all rounded-none'>
										LIHAT DETAIL
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
