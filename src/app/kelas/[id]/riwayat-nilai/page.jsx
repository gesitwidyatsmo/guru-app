'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';

export default function RiwayatNilaiPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	const [namaKelas, setNamaKelas] = useState('');
	const [mapelList, setMapelList] = useState([]);
	const [selectedMapel, setSelectedMapel] = useState('');
	const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
	const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
	const [tugasList, setTugasList] = useState([]);
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);

	const bulanNama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

	// Fetch kelas dan mapel
	useEffect(() => {
		const fetchData = async () => {
			try {
				const supabase = createClient();
				const { data: dataKelas } = await supabase.from('kelas').select('*').eq('id', id).single();
				if (dataKelas) {
					setNamaKelas(dataKelas.nama_kelas);
				}

				const dataMapel = await fetch('/api/mapel?all=false').then(res => res.json());
				if (dataMapel) {
					setMapelList(dataMapel);
				}
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoadingPage(false);
			}
		};

		fetchData();
	}, [id]);

	// Fetch tugas berdasarkan filter
	useEffect(() => {
		if (!namaKelas) return;

		const fetchTugas = async () => {
			setLoading(true);
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
				const role = userData?.role;
				const userId = userData?.id_user;

				let query = supabase.from('nilai_tugas').select('tugas_id, guru_id, kategori, type, deskripsi, mapel, tanggal, kelas, mode_penilaian, total_soal').eq('kelas', namaKelas);

				if (selectedMapel) {
					query = query.eq('mapel', selectedMapel);
				}

				if (role === 'Guru' && userId) {
					query = query.eq('guru_id', userId);
				}

				const { data } = await query;
				
				const filtered = (data || []).filter((tugas) => {
					const tanggalTugas = new Date(tugas.tanggal);
					return tanggalTugas.getMonth() === currentMonth && tanggalTugas.getFullYear() === currentYear;
				});

				const uniqueTugas = filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
				setTugasList(uniqueTugas);
			} catch (error) {
				console.error('Error fetching tugas:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchTugas();
	}, [namaKelas, selectedMapel, currentMonth, currentYear]);

	// Handler prev/next month
	const handlePrevMonth = () => {
		if (currentMonth === 0) {
			setCurrentMonth(11);
			setCurrentYear(currentYear - 1);
		} else {
			setCurrentMonth(currentMonth - 1);
		}
	};

	const handleNextMonth = () => {
		if (currentMonth === 11) {
			setCurrentMonth(0);
			setCurrentYear(currentYear + 1);
		} else {
			setCurrentMonth(currentMonth + 1);
		}
	};

	// Group tugas by tanggal
	const groupTugasByDate = () => {
		const grouped = {};
		tugasList.forEach((tugas) => {
			const tanggal = tugas.tanggal;
			if (!grouped[tanggal]) {
				grouped[tanggal] = [];
			}
			grouped[tanggal].push(tugas);
		});
		return grouped;
	};

	const groupedTugas = groupTugasByDate();

	if (loadingPage) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			
			{/* Header Brutalist */}
			<div className='bg-[#8B5CF6] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
				{/* Decorative Elements */}
				<div className='absolute top-4 right-10 w-24 h-24 bg-[#F5C518] border-[4px] border-[#0D0D0D] rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] rotate-12 hidden md:block'></div>
				<div className='absolute bottom-8 left-1/4 w-12 h-12 bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -rotate-12 hidden md:block'></div>

				<div className='max-w-5xl mx-auto relative z-10'>
					<div className='flex items-center gap-4 mb-8'>
						<button
							onClick={() => router.back()}
							className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<svg className='w-8 h-8' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
						</button>
						<div>
							<h1 className='text-4xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D] mb-2'>
								RIWAYAT PENILAIAN
							</h1>
							<p className='text-[#0D0D0D] font-black tracking-widest uppercase bg-[#F5C518] inline-block px-3 py-1 border-[2px] border-[#0D0D0D] text-xs sm:text-sm'>
								KELAS {namaKelas}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 mb-12'>
				<div className='bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row gap-6'>
					
					{/* Carousel Bulan/Tahun */}
					<div className='flex items-center gap-4 flex-1'>
						<button
							onClick={handlePrevMonth}
							className='p-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'>
							<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth='4' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15.75 19.5L8.25 12l7.5-7.5' /></svg>
						</button>

						<div className='flex-1 text-center bg-white border-[3px] border-[#0D0D0D] py-2 px-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<div className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>{bulanNama[currentMonth]}</div>
							<div className='text-sm font-bold text-[#0D0D0D]'>{currentYear}</div>
						</div>

						<button
							onClick={handleNextMonth}
							className='p-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'>
							<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth='4' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M8.25 4.5l7.5 7.5-7.5 7.5' /></svg>
						</button>
					</div>

					{/* Filter Mapel */}
					<div className='flex-1 relative'>
						<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
							<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' /></svg>
						</div>
						<select
							value={selectedMapel}
							onChange={(e) => setSelectedMapel(e.target.value)}
							className='w-full h-full pl-12 pr-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] outline-none rounded-none text-lg appearance-none cursor-pointer uppercase transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<option value=''>SEMUA MATA PELAJARAN</option>
							{mapelList.map((mapel) => (
								<option key={mapel.id} value={mapel.mapel}>{mapel.mapel}</option>
							))}
						</select>
						<div className='absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none'>
							<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7'/></svg>
						</div>
					</div>

				</div>
			</div>

			{/* Loading State */}
			{loading && (
				<div className='flex justify-center items-center py-12'>
					<Loader />
				</div>
			)}

			{/* Feed Tugas */}
			{!loading && (
				<div className='max-w-5xl mx-auto px-4 sm:px-8 relative z-10 space-y-10'>
					{Object.keys(groupedTugas).length === 0 ? (
						<div className='bg-white shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] p-16 text-center flex flex-col items-center justify-center relative overflow-hidden'>
							<div className='absolute -top-10 -right-10 w-40 h-40 bg-[#F5C518] rounded-full border-[4px] border-[#0D0D0D] opacity-50'></div>
							<div className='absolute -bottom-10 -left-10 w-40 h-40 bg-[#00A693] border-[4px] border-[#0D0D0D] rotate-45 opacity-50'></div>
							
							<div className='w-28 h-28 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center mx-auto mb-8 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform'>
								<span className='text-6xl drop-shadow-[2px_2px_0px_#0D0D0D]'>📝</span>
							</div>
							<h3 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] mb-4 uppercase tracking-widest relative z-10'>TIDAK ADA TUGAS</h3>
							<p className='text-[#0D0D0D] font-bold text-lg relative z-10 bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D]'>Coba pilih bulan atau mata pelajaran lain.</p>
						</div>
					) : (
						Object.keys(groupedTugas)
							.sort((a, b) => new Date(b) - new Date(a))
							.map((tanggal) => {
								const date = new Date(tanggal);
								const hari = date.toLocaleDateString('id-ID', { weekday: 'long' });
								const tanggalFormatted = date.toLocaleDateString('id-ID', {
									day: 'numeric',
									month: 'long',
									year: 'numeric',
								});

								return (
									<div key={tanggal} className='relative'>
										{/* Tanggal Separator */}
										<div className='flex items-center gap-4 mb-6 relative z-20'>
											<div className='bg-[#0D0D0D] text-white px-4 py-2 font-black uppercase tracking-widest text-sm border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#F5C518] transform -rotate-2'>
												{hari}, {tanggalFormatted}
											</div>
											<div className='flex-1 border-b-[4px] border-dashed border-[#0D0D0D]'></div>
										</div>

										{/* Daftar Tugas */}
										<div className='space-y-6'>
											{groupedTugas[tanggal].map((tugas) => (
												<Link
													key={tugas.tugas_id}
													href={`/kelas/${id}/nilai/${tugas.tugas_id}`}
													className='block bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all relative group'>
													
													{/* Strip Kiri */}
													<div className='absolute left-0 top-0 bottom-0 w-4 border-r-[4px] border-[#0D0D0D] bg-[#2F80ED]'></div>

													<div className='pl-8 py-6 pr-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
														<div className='flex items-center gap-6'>
															{/* Icon Tugas */}
															<div className='w-14 h-14 bg-[#2F80ED] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-white flex-shrink-0 transform rotate-3 group-hover:rotate-0 transition-all'>
																<svg className='w-7 h-7' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'/></svg>
															</div>

															{/* Konten */}
															<div>
																<div className='flex flex-wrap items-center gap-2 mb-1'>
																	<div className='inline-block bg-[#F5C518] px-2 py-0.5 border-[2px] border-[#0D0D0D] text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#0D0D0D]'>{tugas.mapel}</div>
																	<div className='inline-block bg-[#00A693] text-white px-2 py-0.5 border-[2px] border-[#0D0D0D] text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#0D0D0D]'>{tugas.type || 'Formatif'}</div>
																	{tugas.mode_penilaian === 'jumlah_benar' && (
																		<div className='inline-block bg-[#A3E635] text-[#0D0D0D] px-2 py-0.5 border-[2px] border-[#0D0D0D] text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#0D0D0D]'>
																			⭐ {tugas.total_soal} Soal
																		</div>
																	)}
																</div>
																<h4 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-wider'>{tugas.kategori}</h4>
																{tugas.deskripsi && (
																	<p className='mt-1 text-sm text-[#0D0D0D] font-medium opacity-80 line-clamp-1'>{tugas.deskripsi}</p>
																)}
															</div>
														</div>

														<div className='bg-[#0D0D0D] text-white p-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#F5C518] self-end sm:self-auto transform group-hover:translate-x-1 transition-transform'>
															<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7'/></svg>
														</div>
													</div>
												</Link>
											))}
										</div>
									</div>
								);
							})
					)}
				</div>
			)}
		</div>
	);
}
