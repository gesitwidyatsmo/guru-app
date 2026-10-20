'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { ChevronLeft, Search, X, Award, ShieldAlert, Sparkles, Filter, Calendar, User, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { konversiPoinKeSikap } from '@/lib/poinUtils';

export default function RiwayatPoinSiswaPage() {
	const params = useParams();
	const id = params?.id;
	const router = useRouter();

	const [loading, setLoading] = useState(true);
	const [siswa, setSiswa] = useState(null);
	const [poinList, setPoinList] = useState([]);
	const [filterTipe, setFilterTipe] = useState('semua');
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		if (!id) return;
		const fetchData = async () => {
			try {
				setLoading(true);
				const [resSiswa, resPoin] = await Promise.all([
					fetch('/api/siswa'),
					fetch(`/api/poin?siswa_id=${id}`),
				]);

				if (resSiswa.ok) {
					const allSiswa = await resSiswa.json();
					const currentSiswa = allSiswa.find((s) => String(s.id) === String(id));
					setSiswa(currentSiswa || null);
				}

				if (resPoin.ok) {
					const dataPoin = await resPoin.json();
					setPoinList(Array.isArray(dataPoin) ? dataPoin : []);
				}
			} catch (err) {
				console.error('Gagal mengambil riwayat poin siswa:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id]);

	// Perhitungan Agregasi Poin
	const stats = useMemo(() => {
		let pos = 0;
		let neg = 0;
		let countPos = 0;
		let countNeg = 0;

		poinList.forEach((p) => {
			const val = parseInt(p.poin || 0, 10);
			if (p.tipe === 'positif') {
				pos += val;
				countPos++;
			} else if (p.tipe === 'negatif') {
				neg += val;
				countNeg++;
			}
		});

		const bersih = pos - neg;
		const sikap = konversiPoinKeSikap(bersih);

		return {
			pos,
			neg,
			bersih,
			countPos,
			countNeg,
			totalLogs: poinList.length,
			sikap,
		};
	}, [poinList]);

	// Filter & Search
	const filteredList = useMemo(() => {
		return poinList.filter((item) => {
			if (filterTipe !== 'semua' && item.tipe !== filterTipe) return false;
			if (searchQuery.trim() !== '') {
				const q = searchQuery.toLowerCase();
				const matchAktifitas = (item.aktifitas || '').toLowerCase().includes(q);
				const matchKategori = (item.kategori || '').toLowerCase().includes(q);
				const matchKeterangan = (item.keterangan || '').toLowerCase().includes(q);
				const matchGuru = (item.nama_guru || '').toLowerCase().includes(q);
				return matchAktifitas || matchKategori || matchKeterangan || matchGuru;
			}
			return true;
		});
	}, [poinList, filterTipe, searchQuery]);

	if (loading) return <Loader />;

	if (!siswa) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] p-12 text-center'>
				<div className='inline-block bg-white p-8 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<h2 className='text-2xl font-black text-[#0D0D0D] uppercase mb-4'>Data Siswa Tidak Ditemukan</h2>
					<Link
						href='/siswa'
						className='inline-block px-6 py-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D]'>
						Kembali ke Daftar Siswa
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-24 pt-8 font-sans'>
			<div className='mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* HEADER NAVIGASI */}
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='flex items-center gap-4'>
						<Link
							href={`/siswa/${id}`}
							className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all rounded-none'>
							<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
						</Link>
						<div className='bg-[#00A693] p-3 border-[4px] border-[#0D0D0D] rotate-[-1deg] inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<h1 className='text-2xl sm:text-3xl font-black text-white uppercase tracking-widest flex items-center gap-2'>
								<Award className='w-7 h-7' strokeWidth={3} /> RIWAYAT POIN
							</h1>
						</div>
					</div>

					<Link
						href='/poin'
						className='inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#A3E635] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
						<Sparkles className='w-5 h-5' /> CATAT POIN BARU
					</Link>
				</div>

				{/* IDENTITAS SISWA BANNER */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
						<div>
							<span className='text-xs font-black uppercase tracking-widest text-[#0D0D0D]/60'>PROFIL SISWA</span>
							<h2 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-wider'>{siswa.nama_lengkap}</h2>
							<div className='mt-2 flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest'>
								<span className='px-3 py-1 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D]'>
									KELAS {siswa.kelas}
								</span>
								<span className='px-3 py-1 bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
									NIS: {siswa.nis || '-'}
								</span>
								<span className={`px-3 py-1 border-[2px] border-[#0D0D0D] text-white ${siswa.status === 'Aktif' ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-[#E8451A]'}`}>
									{siswa.status}
								</span>
							</div>
						</div>

						{/* Predikat Sikap Box */}
						<div className='bg-[#FFF5F0] border-[3px] border-[#0D0D0D] p-4 text-center min-w-[180px] shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<span className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70 block mb-1'>NILAI SIKAP RAPOR</span>
							<div className='text-4xl font-black text-[#0D0D0D]'>
								PREDIKAT {stats.sikap.predikat}
							</div>
							<span className='inline-block mt-1 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider border-[2px] border-[#0D0D0D] bg-white'>
								{stats.sikap.label}
							</span>
						</div>
					</div>
				</div>

				{/* 4 STATS CARDS */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'>
					{/* Poin Positif */}
					<div className='bg-[#A3E635] p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex flex-col justify-between'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase tracking-widest text-[#0D0D0D]'>POIN POSITIF (+)</span>
							<ArrowUpRight className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
						</div>
						<div className='mt-4'>
							<div className='text-4xl sm:text-5xl font-black text-[#0D0D0D]'>+{stats.pos}</div>
							<p className='text-xs font-bold text-[#0D0D0D]/80 uppercase mt-1'>{stats.countPos} Catatan Positif</p>
						</div>
					</div>

					{/* Poin Negatif */}
					<div className='bg-[#E8451A] p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-white flex flex-col justify-between'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase tracking-widest text-white/90'>POIN NEGATIF (-)</span>
							<ArrowDownRight className='w-6 h-6 text-white' strokeWidth={3} />
						</div>
						<div className='mt-4'>
							<div className='text-4xl sm:text-5xl font-black text-white'>-{stats.neg}</div>
							<p className='text-xs font-bold text-white/80 uppercase mt-1'>{stats.countNeg} Pelanggaran</p>
						</div>
					</div>

					{/* Poin Bersih */}
					<div className='bg-[#2F80ED] p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-white flex flex-col justify-between'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase tracking-widest text-white/90'>POIN BERSIH (NET)</span>
							<Sparkles className='w-6 h-6 text-white' strokeWidth={3} />
						</div>
						<div className='mt-4'>
							<div className='text-4xl sm:text-5xl font-black text-white'>
								{stats.bersih > 0 ? `+${stats.bersih}` : stats.bersih}
							</div>
							<p className='text-xs font-bold text-white/80 uppercase mt-1'>Total Saldo Poin</p>
						</div>
					</div>

					{/* Total Aktivitas */}
					<div className='bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex flex-col justify-between'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase tracking-widest text-[#0D0D0D]'>TOTAL CATATAN</span>
							<Calendar className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
						</div>
						<div className='mt-4'>
							<div className='text-4xl sm:text-5xl font-black text-[#0D0D0D]'>{stats.totalLogs}</div>
							<p className='text-xs font-bold text-[#0D0D0D]/80 uppercase mt-1'>Riwayat Entri</p>
						</div>
					</div>
				</div>

				{/* TOOLBAR FILTER & SEARCH */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-5 space-y-4'>
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center'>
						
						{/* Filter Pills */}
						<div className='flex flex-wrap items-center gap-2'>
							<span className='text-xs font-black uppercase tracking-widest text-[#0D0D0D] mr-1 flex items-center gap-1'>
								<Filter className='w-4 h-4' /> TIPE:
							</span>
							<button
								onClick={() => setFilterTipe('semua')}
								className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] transition-all rounded-none ${
									filterTipe === 'semua'
										? 'bg-[#0D0D0D] text-white shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
										: 'bg-white text-[#0D0D0D] hover:bg-[#FFF5F0]'
								}`}>
								SEMUA ({poinList.length})
							</button>
							<button
								onClick={() => setFilterTipe('positif')}
								className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] transition-all rounded-none ${
									filterTipe === 'positif'
										? 'bg-[#00A693] text-white shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
										: 'bg-white text-[#0D0D0D] hover:bg-[#FFF5F0]'
								}`}>
								POSITIF (+) ({stats.countPos})
							</button>
							<button
								onClick={() => setFilterTipe('negatif')}
								className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] transition-all rounded-none ${
									filterTipe === 'negatif'
										? 'bg-[#E8451A] text-white shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
										: 'bg-white text-[#0D0D0D] hover:bg-[#FFF5F0]'
								}`}>
								NEGATIF (-) ({stats.countNeg})
							</button>
						</div>

						{/* Search Input */}
						<div className='relative min-w-[260px] sm:w-80'>
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='CARI AKTIFITAS / KATEGORI...'
								className='w-full pl-10 pr-10 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-xs uppercase text-[#0D0D0D] placeholder-[#0D0D0D]/50 focus:outline-none focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all'
							/>
							<Search className='w-4 h-4 text-[#0D0D0D] absolute left-3.5 top-3.5 pointer-events-none' strokeWidth={3} />
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className='absolute right-3 top-3 text-[#E8451A]'>
									<X className='w-4 h-4' strokeWidth={3} />
								</button>
							)}
						</div>
					</div>
				</div>

				{/* DAFTAR RIWAYAT POIN */}
				<div className='space-y-4'>
					{filteredList.map((item) => {
						const isPositif = item.tipe === 'positif';
						return (
							<div
								key={item.id}
								className={`bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-[12px] ${isPositif ? 'border-l-[#00A693]' : 'border-l-[#E8451A]'}`}>
								
								<div className='space-y-2 flex-1'>
									<div className='flex flex-wrap items-center gap-2'>
										<span className='px-2.5 py-1 bg-white border-[2px] border-[#0D0D0D] text-[11px] font-black uppercase tracking-widest text-[#0D0D0D] flex items-center gap-1.5'>
											<Calendar className='w-3.5 h-3.5' /> {item.tanggal}
										</span>
										<span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-widest border-[2px] border-[#0D0D0D] ${isPositif ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-[#E8451A] text-white'}`}>
											{isPositif ? 'POIN POSITIF' : 'POIN PELANGGARAN'}
										</span>
										{item.kategori && (
											<span className='px-2.5 py-1 bg-[#F5C518] text-[#0D0D0D] border-[2px] border-[#0D0D0D] text-[11px] font-black uppercase tracking-widest'>
												{item.kategori}
											</span>
										)}
									</div>

									<h3 className='text-lg font-black text-[#0D0D0D] uppercase tracking-wide'>
										{item.aktifitas}
									</h3>

									{item.keterangan && (
										<p className='text-sm font-bold text-[#0D0D0D]/70 bg-[#FFF5F0] p-2.5 border-[2px] border-[#0D0D0D]'>
											Catatan: {item.keterangan}
										</p>
									)}

									<div className='text-xs font-bold text-[#0D0D0D]/60 uppercase tracking-widest flex items-center gap-1.5 pt-1'>
										<User className='w-3.5 h-3.5' />
										<span>Dicatat oleh: <b>{item.nama_guru || item.guru_id || 'Guru'}</b></span>
									</div>
								</div>

								{/* POIN BADGE KANAN */}
								<div className='flex md:flex-col items-center justify-between md:justify-center md:items-end gap-2 border-t-[2px] md:border-t-0 border-[#0D0D0D]/20 pt-3 md:pt-0'>
									<div className={`px-5 py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] font-black text-2xl uppercase tracking-wider text-center min-w-[120px] ${isPositif ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
										{isPositif ? `+${item.poin}` : `-${item.poin}`}
										<span className='block text-[10px] font-black uppercase tracking-widest opacity-80'>POIN</span>
									</div>
								</div>
							</div>
						);
					})}

					{/* EMPTY STATE */}
					{filteredList.length === 0 && (
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-12 text-center space-y-4'>
							<div className='inline-flex p-5 bg-[#FFF5F0] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-4xl'>
								⭐
							</div>
							<h3 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>
								{searchQuery || filterTipe !== 'semua'
									? 'TIDAK ADA POIN YANG SESUAI DENGAN FILTER'
									: 'BELUM ADA RIWAYAT POIN UNTUK SISWA INI'}
							</h3>
							<p className='text-sm font-bold text-[#0D0D0D]/60 uppercase max-w-md mx-auto'>
								{searchQuery || filterTipe !== 'semua'
									? 'Coba ganti kata kunci pencarian atau ubah filter tipe poin.'
									: 'Siswa ini belum memiliki catatan poin positif maupun pelanggaran sikap.'}
							</p>
							{searchQuery || filterTipe !== 'semua' ? (
								<button
									onClick={() => {
										setSearchQuery('');
										setFilterTipe('semua');
									}}
									className='px-6 py-3 bg-[#F5C518] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 transition-all'>
									RESET FILTER
								</button>
							) : null}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
