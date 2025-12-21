'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Link from 'next/link';

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

	const bulanNama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

	// Fetch kelas dan mapel
	useEffect(() => {
		const fetchData = async () => {
			try {
				// Fetch kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = await resKelas.json();
				const kelas = dataKelas.find((k) => k.id === id);
				if (kelas) {
					setNamaKelas(kelas.kelas);
				}

				// Fetch mapel
				const resMapel = await fetch('/api/mapel');
				const dataMapel = await resMapel.json();
				setMapelList(dataMapel);
			} catch (error) {
				console.error('Error fetching data:', error);
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
				const params = new URLSearchParams({
					kelas: namaKelas,
				});

				if (selectedMapel) {
					params.append('mapel', selectedMapel);
				}

				const response = await fetch(`/api/tugas?${params}`);
				const data = await response.json();

				// Filter berdasarkan bulan dan tahun
				const filtered = data.filter((tugas) => {
					const tanggalTugas = new Date(tugas.tanggal);
					return tanggalTugas.getMonth() === currentMonth && tanggalTugas.getFullYear() === currentYear;
				});

				// Group by tugas_id dan ambil data pertama untuk setiap grup
				const tugasMap = new Map();
				filtered.forEach((tugas) => {
					if (!tugasMap.has(tugas.tugas_id)) {
						tugasMap.set(tugas.tugas_id, tugas);
					}
				});

				// Convert ke array dan sort by tanggal
				const uniqueTugas = Array.from(tugasMap.values()).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

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

	return (
		<div className='bg-gray-50 min-h-screen pb-6'>
			<SectionHeader
				title='Riwayat Penilaian'
				leftIcon={
					<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
						<svg
							width='24'
							height='24'
							fill='none'
							stroke='currentColor'
							strokeWidth={2}>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					</div>
				}
				onLeftClick={() => router.back()}
				rightIcon={
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth='1.5'
						stroke='currentColor'
						className='size-6'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
						/>
					</svg>
				}
			/>

			<div className='px-5 mt-6 space-y-4'>
				{/* Section 1: Filter Bulan/Tahun dan Mapel */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4'>
					{/* Carousel Bulan/Tahun */}
					<div className='flex items-center justify-between gap-4'>
						<button
							onClick={handlePrevMonth}
							className='p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth='2'
								stroke='currentColor'
								className='w-5 h-5 text-gray-600'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M15.75 19.5L8.25 12l7.5-7.5'
								/>
							</svg>
						</button>

						<div className='flex-1 text-center'>
							<div className='text-2xl font-bold text-gray-800'>{bulanNama[currentMonth]}</div>
							<div className='text-sm text-gray-500'>{currentYear}</div>
						</div>

						<button
							onClick={handleNextMonth}
							className='p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth='2'
								stroke='currentColor'
								className='w-5 h-5 text-gray-600'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M8.25 4.5l7.5 7.5-7.5 7.5'
								/>
							</svg>
						</button>
					</div>

					{/* Filter Mapel */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Filter Mata Pelajaran</label>
						<select
							value={selectedMapel}
							onChange={(e) => setSelectedMapel(e.target.value)}
							className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'>
							<option value=''>Semua Mata Pelajaran</option>
							{mapelList.map((mapel) => (
								<option
									key={mapel.id}
									value={mapel.mapel}>
									{mapel.mapel}
								</option>
							))}
						</select>
					</div>

					{/* Info Kelas */}
					<div className='pt-2 border-t border-gray-100'>
						<div className='text-xs text-gray-500'>Kelas</div>
						<div className='text-sm font-semibold text-gray-800'>{namaKelas}</div>
					</div>
				</div>

				{/* Loading State */}
				{loading && (
					<div className='text-center py-8'>
						<div className='text-gray-500'>Memuat data...</div>
					</div>
				)}

				{/* Daftar Tugas Grouped by Date */}
				{!loading && (
					<div className='space-y-6'>
						{Object.keys(groupedTugas).length > 0 ? (
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
										<div key={tanggal}>
											{/* Section 2: Pemisah Tanggal */}
											<div className='flex items-center gap-3 my-4'>
												<hr className='flex-1 border-gray-300' />
												<div className='text-center px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200'>
													<div className='text-xs font-medium text-gray-500'>{hari}</div>
													<div className='text-sm font-bold text-gray-800'>{tanggalFormatted}</div>
												</div>
												<hr className='flex-1 border-gray-300' />
											</div>

											{/* Section 3: Daftar Tugas */}
											<div className='space-y-3'>
												{groupedTugas[tanggal].map((tugas) => (
													<Link
														key={tugas.tugas_id}
														href={`/kelas/${id}/nilai/${tugas.tugas_id}`}
														className='block bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all'>
														<div className='flex items-center justify-between gap-3'>
															{/* Bagian A (Icon + Info) */}
															<div className='flex items-center gap-3 flex-1'>
																{/* Bagian C: Icon Tugas */}
																<div className='bg-indigo-100 p-3 rounded-xl flex-shrink-0'>
																	<svg
																		xmlns='http://www.w3.org/2000/svg'
																		fill='none'
																		viewBox='0 0 24 24'
																		strokeWidth='2'
																		stroke='currentColor'
																		className='w-6 h-6 text-indigo-600'>
																		<path
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
																		/>
																	</svg>
																</div>

																{/* Bagian D: Mapel dan Nama Tugas */}
																<div className='flex-1 min-w-0'>
																	<div className='text-xs font-medium text-indigo-600 mb-1'>{tugas.mapel}</div>
																	<div className='text-sm font-semibold text-gray-800 truncate'>{tugas.kategori}</div>
																</div>
															</div>

															{/* Bagian B: Icon Next */}
															<div className='text-gray-400'>
																<svg
																	xmlns='http://www.w3.org/2000/svg'
																	fill='none'
																	viewBox='0 0 24 24'
																	strokeWidth='2'
																	stroke='currentColor'
																	className='w-5 h-5'>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		d='M8.25 4.5l7.5 7.5-7.5 7.5'
																	/>
																</svg>
															</div>
														</div>
													</Link>
												))}
											</div>
										</div>
									);
								})
						) : (
							<div className='text-center py-12 bg-white rounded-xl border border-gray-100'>
								<div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4'>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										strokeWidth='1.5'
										stroke='currentColor'
										className='w-8 h-8 text-gray-400'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
										/>
									</svg>
								</div>
								<p className='text-gray-500 font-medium'>Tidak ada tugas di bulan ini</p>
								<p className='text-sm text-gray-400 mt-1'>Coba pilih bulan atau mata pelajaran lain</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
