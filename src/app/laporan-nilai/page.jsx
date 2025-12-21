'use client';

import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import * as XLSX from 'xlsx';

export default function RekapNilaiPage() {
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedBulan, setSelectedBulan] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [rekapData, setRekapData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const bulanOptions = [
		{ value: 'all', label: 'Semua Bulan' },
		{ value: '01', label: 'Januari' },
		{ value: '02', label: 'Februari' },
		{ value: '03', label: 'Maret' },
		{ value: '04', label: 'April' },
		{ value: '05', label: 'Mei' },
		{ value: '06', label: 'Juni' },
		{ value: '07', label: 'Juli' },
		{ value: '08', label: 'Agustus' },
		{ value: '09', label: 'September' },
		{ value: '10', label: 'Oktober' },
		{ value: '11', label: 'November' },
		{ value: '12', label: 'Desember' },
	];

	// Fetch daftar kelas
	useEffect(() => {
		const fetchKelas = async () => {
			try {
				const response = await fetch('/api/kelas');
				const data = await response.json();
				setKelasList(Array.isArray(data) ? data : []);
			} catch (error) {
				console.error('Error fetching kelas:', error);
			}
		};
		fetchKelas();
	}, []);

	// Fetch daftar mapel
	useEffect(() => {
		const fetchMapel = async () => {
			try {
				const response = await fetch('/api/mapel');
				const data = await response.json();
				setMapelList(Array.isArray(data) ? data : []);
			} catch (error) {
				console.error('Error fetching mapel:', error);
			}
		};
		fetchMapel();
	}, []);

	// Fetch rekap nilai
	const fetchRekap = async () => {
		if (!selectedKelas || !selectedBulan) {
			alert('Pilih kelas dan periode terlebih dahulu');
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				kelas: selectedKelas,
				bulan: selectedBulan,
				tahun: new Date().getFullYear(),
			});

			if (selectedMapel) {
				params.append('mapel', selectedMapel);
			}

			const response = await fetch(`/api/nilai/rekap?${params}`);
			if (!response.ok) throw new Error('Gagal mengambil data rekap');

			const data = await response.json();
			setRekapData(data);
		} catch (error) {
			console.error('Error fetching rekap:', error);
			setError(error.message);
			setRekapData(null);
		} finally {
			setLoading(false);
		}
	};

	// Fungsi untuk mendapatkan predikat
	const getPredikat = (avg) => {
		if (avg >= 90) return { label: 'A', color: 'bg-green-100 text-green-700' };
		if (avg >= 80) return { label: 'B', color: 'bg-blue-100 text-blue-700' };
		if (avg >= 70) return { label: 'C', color: 'bg-yellow-100 text-yellow-700' };
		if (avg >= 60) return { label: 'D', color: 'bg-orange-100 text-orange-700' };
		return { label: 'E', color: 'bg-red-100 text-red-700' };
	};

	// Fungsi Export ke Excel
	const exportToExcel = () => {
		if (!rekapData || !rekapData.siswa || rekapData.siswa.length === 0) {
			alert('Tidak ada data untuk diekspor');
			return;
		}

		// Buat header
		const headers = ['No', 'Nama Siswa'];

		// Tambahkan kolom tugas
		rekapData.tugasList.forEach((tugas) => {
			const date = new Date(tugas.tanggal);
			headers.push(`${tugas.kategori}\n${date.toLocaleDateString('id-ID')}`);
		});

		// Tambahkan kolom rata-rata dan predikat
		headers.push('Rata-rata', 'Predikat');

		// Buat data rows
		const data = rekapData.siswa.map((siswa, index) => {
			const row = [index + 1, siswa.nama_lengkap];

			// Tambahkan nilai per tugas
			rekapData.tugasList.forEach((tugas) => {
				const nilai = siswa.nilai[tugas.tugas_id] || '-';
				row.push(nilai);
			});

			// Tambahkan rata-rata dan predikat
			row.push(siswa.avg.toFixed(2), getPredikat(siswa.avg).label);

			return row;
		});

		// Gabungkan header dan data
		const worksheetData = [[`REKAP NILAI - ${rekapData.kelas}`], [`Periode: ${rekapData.periode}`], [`Mata Pelajaran: ${selectedMapel || 'Semua Mapel'}`], [], headers, ...data];

		const ws = XLSX.utils.aoa_to_sheet(worksheetData);

		// Merge cells untuk judul
		ws['!merges'] = [
			{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
			{ s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
			{ s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
		];

		// Set column widths
		const colWidths = [{ wch: 5 }, { wch: 30 }, ...rekapData.tugasList.map(() => ({ wch: 15 })), { wch: 12 }, { wch: 10 }];
		ws['!cols'] = colWidths;

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai');

		// Generate nama file
		const bulanLabel = bulanOptions.find((b) => b.value === selectedBulan)?.label || 'Semua_Bulan';
		const filename = `Rekap_Nilai_${rekapData.kelas}_${bulanLabel}_${new Date().getFullYear()}.xlsx`;

		XLSX.writeFile(wb, filename);
	};

	return (
		<div className='bg-gray-50 min-h-screen'>
			<div className='container mx-auto p-6 max-w-7xl'>
				<SectionHeader
					title='Rekap Nilai'
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
					onLeftClick={() => window.history.back()}
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
								d='M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605'
							/>
						</svg>
					}
				/>

				{/* Section 1: Filter */}
				<div className='bg-white rounded-lg shadow-md p-6 mb-6 mt-6'>
					<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
						{/* Pilih Kelas */}
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-2'>Kelas</label>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'>
								<option value=''>Pilih Kelas</option>
								{kelasList &&
									kelasList.length > 0 &&
									kelasList.map((kelas) => (
										<option
											key={kelas.id}
											value={kelas.kelas}>
											{kelas.kelas}
										</option>
									))}
							</select>
						</div>

						{/* Pilih Periode */}
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-2'>Periode</label>
							<select
								value={selectedBulan}
								onChange={(e) => setSelectedBulan(e.target.value)}
								className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'>
								<option value=''>Pilih Bulan</option>
								{bulanOptions.map((bulan) => (
									<option
										key={bulan.value}
										value={bulan.value}>
										{bulan.label}
									</option>
								))}
							</select>
						</div>

						{/* Pilih Mapel */}
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-2'>Mata Pelajaran</label>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'>
								<option value=''>Semua Mapel</option>
								{mapelList.map((mapel) => (
									<option
										key={mapel.id}
										value={mapel.mapel}>
										{mapel.mapel}
									</option>
								))}
							</select>
						</div>

						{/* Tombol Tampilkan */}
						<div className='flex items-end'>
							<button
								onClick={fetchRekap}
								disabled={loading}
								className='w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'>
								{loading ? 'Memuat...' : 'Tampilkan'}
							</button>
						</div>
					</div>

					{/* Error Message */}
					{error && <div className='mt-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg'>{error}</div>}
				</div>

				{/* Section 2: Tabel Rekap */}
				{rekapData && (
					<div className='bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden'>
						{/* Header */}
						<div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-5'>
							<div className='flex items-center justify-between'>
								<div>
									<h2 className='text-2xl font-bold text-white'>Rekap Nilai - {rekapData.kelas}</h2>
									<p className='text-white/90 text-sm mt-1'>
										Periode: {rekapData.periode} | Mapel: {selectedMapel || 'Semua Mata Pelajaran'}
									</p>
								</div>

								{/* Tombol Export */}
								<button
									onClick={exportToExcel}
									className='flex items-center gap-2 px-5 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl transition-all duration-200 hover:scale-105 border border-white/30 shadow-lg'>
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
											d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3'
										/>
									</svg>
									<span className='font-semibold text-sm'>Export Excel</span>
								</button>
							</div>
						</div>

						{rekapData.siswa && Array.isArray(rekapData.siswa) && rekapData.siswa.length > 0 ? (
							<div className='p-6'>
								<div className='overflow-x-auto rounded-xl border border-gray-200 shadow-lg'>
									<table className='min-w-full border-collapse'>
										<thead>
											<tr className='bg-gradient-to-r from-gray-50 to-gray-100'>
												<th className='border-b-2 border-gray-300 px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-20'>No</th>
												<th className='border-b-2 border-gray-300 px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-12 bg-gradient-to-r from-gray-50 to-gray-100 z-20 min-w-[200px]'>
													Nama Siswa
												</th>

												{/* Kolom Tugas */}
												{rekapData.tugasList.map((tugas) => {
													const date = new Date(tugas.tanggal);
													const hari = date.toLocaleDateString('id-ID', {
														weekday: 'short',
													});
													const tanggal = date.toLocaleDateString('id-ID', {
														day: 'numeric',
														month: 'short',
													});

													return (
														<th
															key={tugas.tugas_id}
															className='border-b-2 border-gray-300 px-3 py-4 text-center min-w-[120px] group hover:bg-indigo-50 transition-colors'>
															<div className='text-xs font-bold text-gray-700 mb-1 truncate'>{tugas.kategori}</div>
															<div className='text-[10px] text-gray-500'>
																{hari}, {tanggal}
															</div>
														</th>
													);
												})}

												{/* Kolom Rata-rata dan Predikat */}
												<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700'>Rata-rata</th>
												<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-purple-50 to-purple-100 text-purple-700'>Predikat</th>
											</tr>
										</thead>
										<tbody className='bg-white divide-y divide-gray-100'>
											{rekapData.siswa.map((siswa, index) => {
												const predikat = getPredikat(siswa.avg);
												return (
													<tr
														key={siswa.id}
														className='hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200'>
														<td className='border-r border-gray-200 px-4 py-4 text-sm text-gray-600 font-medium sticky left-0 bg-white z-10'>{index + 1}</td>
														<td className='border-r border-gray-200 px-6 py-4 sticky left-12 bg-white z-10'>
															<div className='text-sm font-semibold text-gray-900'>{siswa.nama_lengkap}</div>
															<div className='text-xs text-gray-500'>NIS: {siswa.nis || '-'}</div>
														</td>

														{/* Nilai per tugas */}
														{rekapData.tugasList.map((tugas) => {
															const nilai = siswa.nilai[tugas.tugas_id];
															return (
																<td
																	key={tugas.tugas_id}
																	className='border-r border-gray-100 px-3 py-4 text-center'>
																	{nilai ? (
																		<span className='inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm'>{nilai}</span>
																	) : (
																		<span className='text-gray-400'>-</span>
																	)}
																</td>
															);
														})}

														{/* Rata-rata */}
														<td className='border-r border-gray-200 px-4 py-4 text-center bg-blue-50/50'>
															<div className='inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-base shadow-md'>
																{siswa.avg.toFixed(1)}
															</div>
														</td>

														{/* Predikat */}
														<td className='px-4 py-4 text-center bg-purple-50/50'>
															<span className={`inline-flex items-center justify-center w-14 h-14 rounded-xl font-bold text-lg shadow-md ${predikat.color}`}>{predikat.label}</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>

								{/* Keterangan Predikat */}
								<div className='mt-6 bg-white p-4 rounded-xl border border-gray-200'>
									<h3 className='text-sm font-semibold text-gray-700 mb-3'>Keterangan Predikat:</h3>
									<div className='flex flex-wrap gap-4'>
										<div className='flex items-center gap-2'>
											<span className='inline-block px-3 py-1 rounded-lg bg-green-100 text-green-700 font-bold'>A</span>
											<span className='text-sm text-gray-600'>90 - 100</span>
										</div>
										<div className='flex items-center gap-2'>
											<span className='inline-block px-3 py-1 rounded-lg bg-blue-100 text-blue-700 font-bold'>B</span>
											<span className='text-sm text-gray-600'>80 - 89</span>
										</div>
										<div className='flex items-center gap-2'>
											<span className='inline-block px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700 font-bold'>C</span>
											<span className='text-sm text-gray-600'>70 - 79</span>
										</div>
										<div className='flex items-center gap-2'>
											<span className='inline-block px-3 py-1 rounded-lg bg-orange-100 text-orange-700 font-bold'>D</span>
											<span className='text-sm text-gray-600'>60 - 69</span>
										</div>
										<div className='flex items-center gap-2'>
											<span className='inline-block px-3 py-1 rounded-lg bg-red-100 text-red-700 font-bold'>E</span>
											<span className='text-sm text-gray-600'>0 - 59</span>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className='p-12 text-center'>
								<div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4'>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										strokeWidth='1.5'
										stroke='currentColor'
										className='w-10 h-10 text-gray-400'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
										/>
									</svg>
								</div>
								<p className='text-gray-500 font-medium'>Tidak ada data nilai</p>
								<p className='text-sm text-gray-400 mt-2'>Pilih kelas, periode, dan mata pelajaran</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
