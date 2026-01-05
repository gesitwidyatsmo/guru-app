'use client';

import { useState, useEffect } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import * as XLSX from 'xlsx';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';

export default function LaporanAbsensiPage() {
	const params = useParams();
	const { id } = params;

	const [kelasList, setKelasList] = useState([]);
	const [namaKelas, setNamaKelas] = useState('');
	const [selectedBulan, setSelectedBulan] = useState('');
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
				if (!response.ok) throw new Error('Gagal mengambil data kelas');
				const dataKelas = await response.json();
				const kelas = dataKelas.find((k) => k.id === id);
				if (kelas) {
					setNamaKelas(kelas.kelas);
				}
			} catch (error) {
				console.error('Error fetching kelas:', error);
				setKelasList([]);
			}
		};
		fetchKelas();
	}, []);

	// Fetch rekap absensi
	const fetchRekap = async () => {
		if (!selectedBulan) {
			alert('Pilih periode terlebih dahulu');
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				kelas: namaKelas,
				bulan: selectedBulan,
				tahun: new Date().getFullYear(),
			});

			const response = await fetch(`/api/absensi/rekap?${params}`);
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

	// Generate tanggal-tanggal dalam bulan
	const getDatesInMonth = (dates) => {
		if (!dates || !Array.isArray(dates) || dates.length === 0) return [];
		return dates.sort((a, b) => new Date(a) - new Date(b));
	};

	const getStatusColor = (status) => {
		const colors = {
			Hadir: 'bg-green-100 text-green-800',
			Izin: 'bg-blue-100 text-blue-800',
			Sakit: 'bg-yellow-100 text-yellow-800',
			Alpha: 'bg-red-100 text-red-800',
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	};

	// Fungsi Export ke Excel
	const exportToExcel = () => {
		if (!rekapData || !rekapData.siswa || rekapData.siswa.length === 0) {
			alert('Tidak ada data untuk diekspor');
			return;
		}

		const tanggalList = getDatesInMonth(rekapData.tanggalList);

		// Buat header
		const headers = ['No', 'NIS', 'Nama Siswa'];

		// Tambahkan tanggal sebagai header
		tanggalList.forEach((tanggal) => {
			const date = new Date(tanggal);
			const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
			headers.push(`${date.getDate()} (${dayName})`);
		});

		// Tambahkan kolom ringkasan
		headers.push('Hadir', 'Izin', 'Sakit', 'Alpha', 'Total');

		// Buat data rows
		const data = rekapData.siswa.map((siswa, index) => {
			const row = [index + 1, siswa.nis || '-', siswa.nama_lengkap];

			// Tambahkan status per tanggal
			tanggalList.forEach((tanggal) => {
				const absensi = siswa.absensi && siswa.absensi[tanggal] ? siswa.absensi[tanggal] : null;
				const status = absensi?.status || '-';
				const kode = status === 'Hadir' ? 'H' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : status === 'Alpha' ? 'A' : '-';
				row.push(kode);
			});

			// Tambahkan ringkasan
			const total = (siswa.ringkasan?.H || 0) + (siswa.ringkasan?.I || 0) + (siswa.ringkasan?.S || 0) + (siswa.ringkasan?.A || 0);
			row.push(siswa.ringkasan?.H || 0, siswa.ringkasan?.I || 0, siswa.ringkasan?.S || 0, siswa.ringkasan?.A || 0, total);

			return row;
		});

		// Gabungkan header dan data
		const worksheetData = [
			[`REKAP ABSENSI - ${rekapData.kelas}`],
			[`Periode: ${rekapData.periode}`],
			[`Total Siswa: ${rekapData.siswa.length}`],
			[], // Baris kosong
			headers,
			...data,
		];

		// Buat worksheet dan workbook
		const ws = XLSX.utils.aoa_to_sheet(worksheetData);

		// Styling untuk merge cells (judul)
		ws['!merges'] = [
			{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
			{ s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
			{ s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
		];

		// Set column widths
		const colWidths = [
			{ wch: 5 }, // No
			{ wch: 15 }, // NIS
			{ wch: 30 }, // Nama
			...tanggalList.map(() => ({ wch: 8 })), // Tanggal
			{ wch: 8 },
			{ wch: 8 },
			{ wch: 8 },
			{ wch: 8 },
			{ wch: 8 }, // Ringkasan
		];
		ws['!cols'] = colWidths;

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

		// Generate nama file
		const bulanLabel = bulanOptions.find((b) => b.value === selectedBulan)?.label || 'Semua_Bulan';
		const filename = `Rekap_Absensi_${rekapData.kelas}_${bulanLabel}_${new Date().getFullYear()}.xlsx`;

		// Download file
		XLSX.writeFile(wb, filename);
	};

	return (
		<div className='bg-gray-50 min-h-screen'>
			<div className='container mx-auto p-6 max-w-7xl '>
				<SectionHeader
					title={'Riwayat Absensi'}
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
								d='M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z'
							/>
						</svg>
					}
				/>
				{/* Section 1: Filter */}
				<div className='bg-white rounded-lg shadow-md p-6 mb-6 mt-6'>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						{/* Pilih Kelas */}
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-2'>Kelas</label>
							<div className='pt-2 border-t border-gray-100'>
								<div className='text-sm font-semibold text-gray-800'>{namaKelas}</div>
							</div>
						</div>

						{/* Pilih Periode/Bulan */}
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

						{/* Tombol Tampilkan */}
						<div className='flex items-end'>
							<button
								onClick={fetchRekap}
								disabled={loading}
								className='w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'>
								{loading ? 'Memuat...' : 'Tampilkan Rekap'}
							</button>
						</div>
					</div>

					{/* Error Message */}
					{error && <div className='mt-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg'>{error}</div>}
				</div>

				{/* Section 2: Tabel Absensi */}
				{rekapData && (
					<div className='bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden'>
						{/* Header Card dengan Gradient */}
						<div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-5'>
							<div className='flex flex-col lg:flex-row space-y-6 lg:space-y-0 items-center justify-between'>
								<div className='flex flex-col items-center lg:items-start'>
									<h2 className='text-2xl font-bold text-white flex items-center gap-2'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth='2'
											stroke='currentColor'
											className='w-7 h-7'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z'
											/>
										</svg>
										{rekapData.kelas}
									</h2>
									<p className='text-white/90 text-sm mt-1 flex items-center gap-1.5'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth='2'
											stroke='currentColor'
											className='w-4 h-4'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'
											/>
										</svg>
										Periode: {rekapData.periode}
									</p>
								</div>

								{/* Action Buttons */}
								<div className='flex items-center gap-3'>
									{/* Total Siswa Badge */}
									<div className='bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl'>
										<p className='text-xs text-white/80'>Total Siswa</p>
										<p className='text-2xl font-bold text-white'>{rekapData.siswa?.length || 0}</p>
									</div>

									{/* Tombol Export Excel */}
									<button
										onClick={exportToExcel}
										className='flex items-center gap-2 px-5 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl transition-all duration-200 hover:scale-105 border border-white/30 shadow-lg group'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth='2'
											stroke='currentColor'
											className='w-5 h-5 group-hover:animate-bounce'>
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
						</div>

						{rekapData.siswa && Array.isArray(rekapData.siswa) && rekapData.siswa.length > 0 ? (
							<>
								<div className='p-6'>
									{/* Keterangan Status (dipindah ke atas) */}
									<div className='mb-6 flex flex-wrap gap-3'>
										<div className='flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-200 transition-all hover:scale-105 hover:shadow-md'>
											<span className='w-8 h-8 flex items-center justify-center rounded-lg bg-green-500 text-white font-bold text-sm shadow-sm'>H</span>
											<span className='text-sm font-medium text-green-900'>Hadir</span>
										</div>
										<div className='flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 transition-all hover:scale-105 hover:shadow-md'>
											<span className='w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 text-white font-bold text-sm shadow-sm'>I</span>
											<span className='text-sm font-medium text-blue-900'>Izin</span>
										</div>
										<div className='flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-xl border border-yellow-200 transition-all hover:scale-105 hover:shadow-md'>
											<span className='w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-500 text-white font-bold text-sm shadow-sm'>S</span>
											<span className='text-sm font-medium text-yellow-900'>Sakit</span>
										</div>
										<div className='flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl border border-red-200 transition-all hover:scale-105 hover:shadow-md'>
											<span className='w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 text-white font-bold text-sm shadow-sm'>A</span>
											<span className='text-sm font-medium text-red-900'>Alpha</span>
										</div>
									</div>

									{/* Container Tabel dengan Shadow */}
									<div className='overflow-x-auto rounded-xl border border-gray-200 shadow-lg'>
										<table className='min-w-full border-collapse'>
											<thead>
												<tr className='bg-gradient-to-r from-gray-50 to-gray-100'>
													<th className='border-b-2 border-gray-300 px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-20 shadow-sm'>
														No
													</th>
													<th className='border-b-2 border-gray-300 px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 shadow-sm'>Nama Siswa</th>

													{/* Kolom Tanggal dengan style lebih baik */}
													{getDatesInMonth(rekapData.tanggalList).map((tanggal, idx) => {
														const date = new Date(tanggal);
														const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
														const isWeekend = date.getDay() === 0 || date.getDay() === 6;

														return (
															<th
																key={tanggal}
																className={`border-b-2 border-gray-300 px-3 py-4 text-center min-w-[60px] group hover:bg-indigo-50 transition-colors ${isWeekend ? 'bg-red-50/50' : ''}`}>
																<div className='text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors'>{date.getDate()}</div>
																<div className={`text-[10px] font-medium mt-0.5 ${isWeekend ? 'text-red-600' : 'text-gray-500'} group-hover:text-indigo-500 transition-colors`}>{dayName}</div>
															</th>
														);
													})}

													{/* Kolom Ringkasan dengan gradient */}
													<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-green-50 to-green-100 text-green-700'>
														<div className='flex flex-col items-center gap-1'>
															<span className='text-lg'>✓</span>
															<span>H</span>
														</div>
													</th>
													<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700'>
														<div className='flex flex-col items-center gap-1'>
															<span className='text-lg'>ℹ</span>
															<span>I</span>
														</div>
													</th>
													<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-700'>
														<div className='flex flex-col items-center gap-1'>
															<span className='text-lg'>⚕</span>
															<span>S</span>
														</div>
													</th>
													<th className='border-b-2 border-gray-300 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-br from-red-50 to-red-100 text-red-700'>
														<div className='flex flex-col items-center gap-1'>
															<span className='text-lg'>✕</span>
															<span>A</span>
														</div>
													</th>
												</tr>
											</thead>
											<tbody className='bg-white divide-y divide-gray-100'>
												{rekapData.siswa.map((siswa, index) => (
													<tr
														key={siswa.id}
														className='hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200 group'>
														<td className='border-r border-gray-200 px-4 py-4 text-sm text-gray-600 font-medium sticky left-0 bg-white group-hover:bg-indigo-50 transition-colors z-10'>{index + 1}</td>
														<td className='border-r border-gray-200 px-6 py-4 bg-white group-hover:bg-indigo-50 transition-colors'>
															<div className='flex items-center gap-3'>
																<div className='w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0'>
																	{siswa.nama_lengkap.charAt(0)}
																</div>
																<div>
																	<div className='text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors'>{siswa.nama_lengkap}</div>
																	<div className='text-xs text-gray-500'>NIS: {siswa.nis || '-'}</div>
																</div>
															</div>
														</td>

														{/* Status per Tanggal dengan animasi */}
														{getDatesInMonth(rekapData.tanggalList).map((tanggal) => {
															const absensi = siswa.absensi && siswa.absensi[tanggal] ? siswa.absensi[tanggal] : null;
															const status = absensi?.status || '-';
															const kode = status === 'Hadir' ? 'H' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : status === 'Alpha' ? 'A' : '-';

															const getStatusStyle = (status) => {
																switch (status) {
																	case 'Hadir':
																		return 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200 hover:scale-110';
																	case 'Izin':
																		return 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 hover:scale-110';
																	case 'Sakit':
																		return 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200 hover:scale-110';
																	case 'Alpha':
																		return 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200 hover:scale-110';
																	default:
																		return 'bg-gray-50 text-gray-400 border-gray-200';
																}
															};

															return (
																<td
																	key={tanggal}
																	className='border-r border-gray-100 px-3 py-4 text-center'>
																	<span
																		className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs border-2 transition-all duration-200 cursor-pointer ${getStatusStyle(status)}`}
																		title={absensi?.keterangan ? `${status} - ${absensi.keterangan}` : status}>
																		{kode}
																	</span>
																</td>
															);
														})}

														{/* Ringkasan dengan style lebih menarik */}
														<td className='border-r border-gray-200 px-4 py-4 text-center bg-green-50/50'>
															<div className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-sm shadow-md hover:scale-110 transition-transform'>
																{siswa.ringkasan?.H || 0}
															</div>
														</td>
														<td className='border-r border-gray-200 px-4 py-4 text-center bg-blue-50/50'>
															<div className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm shadow-md hover:scale-110 transition-transform'>
																{siswa.ringkasan?.I || 0}
															</div>
														</td>
														<td className='border-r border-gray-200 px-4 py-4 text-center bg-yellow-50/50'>
															<div className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white font-bold text-sm shadow-md hover:scale-110 transition-transform'>
																{siswa.ringkasan?.S || 0}
															</div>
														</td>
														<td className='px-4 py-4 text-center bg-red-50/50'>
															<div className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-sm shadow-md hover:scale-110 transition-transform'>
																{siswa.ringkasan?.A || 0}
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							</>
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
								<p className='text-gray-500 font-medium'>Tidak ada data absensi untuk periode yang dipilih</p>
								<p className='text-sm text-gray-400 mt-2'>Silakan pilih kelas dan periode lain</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
