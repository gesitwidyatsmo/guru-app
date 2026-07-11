'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '../../../components/loading';
import SectionHeader from '../../../components/SectionHeader';
import { createClient } from '@/utils/supabase/client';

export default function RiwayatAbsensiMapelPage() {
	const params = useParams();
	const id = params.id;

	// State Data Master
	const [kelasDetail, setKelasDetail] = useState(null);
	const [namaKelas, setNamaKelas] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedMapel, setSelectedMapel] = useState('');

	// State Daftar Sesi (Sidebar)
	const [daftarSesi, setDaftarSesi] = useState([]); // Array obyek {tanggal, jam_ke}
	const [selectedTanggal, setSelectedTanggal] = useState('');
	const [selectedJamKe, setSelectedJamKe] = useState('');
	const [loadingSesi, setLoadingSesi] = useState(false);

	// State Form Detail
	const [tanggalEdit, setTanggalEdit] = useState('');
	const [jamKeEdit, setJamKeEdit] = useState('');
	const [absensiMap, setAbsensiMap] = useState({}); // {siswa_id: { status, keterangan }}

	// State UI
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// --- 1. Fetch Data Awal (Kelas, Siswa, Mapel) ---
	useEffect(() => {
		const fetchInitial = async () => {
			if (!id) return;
			try {
				const supabase = createClient();
				const { data: dataKelas } = await supabase.from('kelas').select('*').eq('id', id).single();
				
				if (dataKelas) {
					setKelasDetail(dataKelas);
					setNamaKelas(dataKelas.nama_kelas);

					const { data: dataSiswa } = await supabase.from('siswa').select('*').eq('status', 'Aktif').eq('kelas', dataKelas.nama_kelas);
					setSiswaList(dataSiswa || []);
				}

				const dataMapel = await fetch('/api/mapel?all=false').then(res => res.json());
				setMapelList(dataMapel || []);
			} catch (err) {
				console.error(err);
				Swal.fire('Error', 'Gagal memuat data awal', 'error');
			} finally {
				setLoading(false);
			}
		};
		fetchInitial();
	}, [id]);

	// --- 2. Fetch Daftar Sesi Absensi ketika Mapel dipilih ---
	const fetchRiwayatSesi = useCallback(async () => {
		if (!namaKelas || !selectedMapel) {
			setDaftarSesi([]);
			setSelectedTanggal('');
			setSelectedJamKe('');
			return;
		}

		try {
			setLoadingSesi(true);
			const supabase = createClient();
			const { data } = await supabase.from('absensi_mapel').select('tanggal, jam_ke').eq('kelas', namaKelas).eq('mapel', selectedMapel);
			
			if (data) {
				const sesiMap = new Map();
				data.forEach((item) => {
					const tgl = typeof item.tanggal === 'string' ? item.tanggal.slice(0, 10) : item.tanggal;
					const jam = item.jam_ke || '-';
					const key = `${tgl}|${jam}`;
					if (tgl) {
						sesiMap.set(key, { tanggal: tgl, jam_ke: jam });
					}
				});

				const sesiArray = Array.from(sesiMap.values()).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
				setDaftarSesi(sesiArray);
			}
		} catch (err) {
			console.error('Error fetching sesi:', err);
		} finally {
			setLoadingSesi(false);
		}
	}, [namaKelas, selectedMapel]);

	useEffect(() => {
		fetchRiwayatSesi();
		// Reset selected jika ganti mapel
		setSelectedTanggal('');
		setSelectedJamKe('');
	}, [fetchRiwayatSesi]);

	// --- 3. Load Detail Sesi ketika sesi dipilih ---
	useEffect(() => {
		if (!selectedTanggal || !selectedJamKe || !selectedMapel) {
			setTanggalEdit('');
			setJamKeEdit('');
			setAbsensiMap({});
			return;
		}

		const loadSesiDetail = async () => {
			try {
				const supabase = createClient();
				const { data: sesi } = await supabase.from('absensi_mapel').select('sesi_id').eq('kelas', namaKelas).eq('mapel', selectedMapel).eq('tanggal', selectedTanggal).eq('jam_ke', selectedJamKe).single();
				if (sesi) {
					const { data: details } = await supabase.from('absensi_mapel_siswa').select('siswa_id, status, keterangan').eq('sesi_id', sesi.sesi_id);
					setTanggalEdit(selectedTanggal);
					setJamKeEdit(selectedJamKe);

					const map = {};
					(details || []).forEach((item) => {
						map[item.siswa_id] = {
							status: item.status,
							keterangan: item.keterangan || '',
						};
					});
					setAbsensiMap(map);
				}
			} catch (err) {
				console.error('Error loading detail:', err);
			}
		};

		loadSesiDetail();
	}, [selectedTanggal, selectedJamKe, namaKelas, selectedMapel]);

	// --- 4. Handler Input Perubahan ---
	const handleStatusChange = (siswaId, val) => {
		setAbsensiMap((prev) => ({
			...prev,
			[siswaId]: {
				...prev[siswaId],
				status: val,
			},
		}));
	};

	const handleKeteranganChange = (siswaId, val) => {
		setAbsensiMap((prev) => ({
			...prev,
			[siswaId]: {
				...prev[siswaId],
				keterangan: val,
			},
		}));
	};

	// --- 5. Simpan Perubahan (Bulk Update) ---
	const handleSimpan = async () => {
		if (!selectedTanggal || !selectedJamKe) return;

		setSaving(true);
		try {
			const supabase = createClient();
			
			const { data: existingSesi } = await supabase.from('absensi_mapel').select('sesi_id').eq('kelas', namaKelas).eq('mapel', selectedMapel).eq('tanggal', selectedTanggal).eq('jam_ke', selectedJamKe).single();
			if (!existingSesi) throw new Error('Sesi tidak ditemukan');

			let sesiId = existingSesi.sesi_id;

			if (selectedTanggal !== tanggalEdit || selectedJamKe !== jamKeEdit) {
				// Check if new combo already exists
				const { data: checkNew } = await supabase.from('absensi_mapel').select('sesi_id').eq('kelas', namaKelas).eq('mapel', selectedMapel).eq('tanggal', tanggalEdit).eq('jam_ke', jamKeEdit).single();
				if (checkNew) {
					throw new Error('Sesi untuk tanggal dan jam tersebut sudah ada');
				}
				await supabase.from('absensi_mapel').update({ tanggal: tanggalEdit, jam_ke: jamKeEdit }).eq('sesi_id', sesiId);
			}

			await supabase.from('absensi_mapel_siswa').delete().eq('sesi_id', sesiId);
			
			const absensiList = Object.keys(absensiMap).map((siswaId) => ({
				sesi_id: sesiId,
				siswa_id: siswaId,
				status: absensiMap[siswaId].status,
				keterangan: absensiMap[siswaId].keterangan || '',
			}));
			
			if(absensiList.length > 0) {
				await supabase.from('absensi_mapel_siswa').insert(absensiList);
			}

			Swal.fire({
				icon: 'success',
				title: 'Berhasil',
				text: 'Perubahan riwayat absensi mapel disimpan',
				timer: 1500,
				showConfirmButton: false,
			});

			await fetchRiwayatSesi();
			if (tanggalEdit !== selectedTanggal || jamKeEdit !== selectedJamKe) {
				setSelectedTanggal(tanggalEdit);
				setSelectedJamKe(jamKeEdit);
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', error.message, 'error');
		} finally {
			setSaving(false);
		}
	};

	// --- 6. Hapus Sesi ---
	const handleHapusSesi = async () => {
		if (!selectedTanggal || !selectedJamKe) return;

		const resConfirm = await Swal.fire({
			title: 'Hapus Sesi Absensi Mapel?',
			text: `Sesi Absen (${selectedTanggal}, Jam ${selectedJamKe}) akan dihapus secara permanen beserta data seluruh siswa!`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Ya, Hapus!',
			cancelButtonText: 'Batal',
		});

		if (!resConfirm.isConfirmed) return;

		setSaving(true);
		try {
			const supabase = createClient();
			const { error } = await supabase.from('absensi_mapel').delete().eq('kelas', namaKelas).eq('mapel', selectedMapel).eq('tanggal', selectedTanggal).eq('jam_ke', selectedJamKe);
			if (error) throw error;

			Swal.fire('Terhapus!', 'Sesi absensi mapel berhasil dihapus.', 'success');
			setSelectedTanggal('');
			setSelectedJamKe('');
			await fetchRiwayatSesi();
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal menghapus sesi absen mapel', 'error');
		} finally {
			setSaving(false);
		}
	};

	if (loading) return <Loader />;

	return (
		<main className='min-h-screen bg-gray-50 pb-20'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				<SectionHeader
					title={'Kelola Riwayat Absensi Mapel'}
					leftIcon={
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='2'
							stroke='currentColor'
							className='w-6 h-6 text-purple-600'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					}
					onLeftClick={() => window.history.back()}
				/>

				{/* Filter Mapel */}
				<div className='mt-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-4'>
					<label className='font-bold text-gray-700 w-full sm:w-auto shrink-0'>Pilih Mata Pelajaran :</label>
					<select
						required
						value={selectedMapel}
						onChange={(e) => setSelectedMapel(e.target.value)}
						className='w-full sm:w-64 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-gray-700 outline-none'>
						<option
							value=''
							disabled>
							-- Klik untuk Memilih --
						</option>
						{mapelList.map((m) => (
							<option
								key={m.id || m.mapel}
								value={m.mapel}>
								{m.mapel}
							</option>
						))}
					</select>
				</div>

				{selectedMapel && (
					<div className='mt-6 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500'>
						{/* SIDEBAR: Daftar Sesi */}
						<div className='w-full lg:w-[320px] shrink-0'>
							<div className='bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[300px] lg:h-[calc(100vh-140px)] overflow-hidden lg:sticky top-[80px]'>
								<div className='p-5 border-b border-gray-100 bg-gray-50 flex-shrink-0'>
									<h2 className='text-lg font-bold text-gray-800 break-words'>{namaKelas}</h2>
									<div className='text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 flex-wrap'>
										<div className='w-2 h-2 rounded-full bg-purple-500'></div>
										<span>{selectedMapel}</span>
									</div>
								</div>

								<div className='flex-1 overflow-y-auto p-3 space-y-2'>
									{loadingSesi ? (
										<div className='py-8 text-center text-sm text-gray-400'>Memuat daftar sesi...</div>
									) : daftarSesi.length === 0 ? (
										<div className='py-8 text-center flex flex-col items-center justify-center text-gray-400'>
											<svg
												className='w-12 h-12 mb-3 text-gray-200'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={1}
													d='M12 6v6m0 0v6m0-6h6m-6 0H6'
												/>
											</svg>
											<p className='text-sm'>Belum ada riwayat terekam.</p>
										</div>
									) : (
										daftarSesi.map((item, idx) => {
											const isSelected = selectedTanggal === item.tanggal && selectedJamKe === item.jam_ke;
											return (
												<button
													key={idx}
													onClick={() => {
														setSelectedTanggal(item.tanggal);
														setSelectedJamKe(item.jam_ke);
													}}
													className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
														isSelected ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-white border-gray-100 hover:border-purple-100 hover:shadow hover:bg-gray-50'
													}`}>
													<div className='flex items-start justify-between'>
														<div className='flex items-center gap-3'>
															<div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
																<svg
																	className='w-5 h-5'
																	fill='none'
																	stroke='currentColor'
																	viewBox='0 0 24 24'>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
																	/>
																</svg>
															</div>
															<div>
																<div className={`font-bold ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
																	{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
																</div>
																<div className='text-xs text-purple-600 mt-0.5 font-medium'>Jam Ke- {item.jam_ke}</div>
															</div>
														</div>
													</div>
												</button>
											);
										})
									)}
								</div>
							</div>
						</div>

						{/* KONTEN UTAMA: Form Edit Detail Sesi */}
						<div className='flex-1'>
							{!selectedTanggal ? (
								<div className='bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-center p-8'>
									<div className='w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6'>
										<svg
											className='w-12 h-12 text-gray-300'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1}
												d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
											/>
										</svg>
									</div>
									<h3 className='text-xl font-bold text-gray-800 mb-2'>Pilih Sesi Rekaman</h3>
									<p className='text-gray-500 max-w-sm'>Pilih absensi dari daftar di sebelah kiri untuk melihat, mengedit kehadiran, mengganti tanggal, atau menghapus sesi secara permanen.</p>
								</div>
							) : (
								<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300'>
									{/* Header Form Detail */}
									<div className='border-b border-gray-100 p-6 sm:p-8 relative'>
										<div className='flex flex-col xl:flex-row xl:items-start justify-between gap-6'>
											<div className='flex-1 max-w-2xl'>
												<h3 className='text-xl font-bold text-gray-800 mb-4'>Pengaturan Data Sesi Kemarin</h3>
												<div className='flex flex-col sm:flex-row gap-4'>
													<div className='flex-1'>
														<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Ubah Tanggal Sesi</label>
														<input
															type='date'
															value={tanggalEdit}
															onChange={(e) => setTanggalEdit(e.target.value)}
															className='w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow'
														/>
													</div>
													<div className='flex-1'>
														<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Ubah Jam Ke</label>
														<input
															type='text'
															placeholder='Contoh: 1-2'
															value={jamKeEdit}
															onChange={(e) => setJamKeEdit(e.target.value)}
															className='w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow'
														/>
													</div>
												</div>
											</div>

											{/* Tampilan Action Buttons */}
											<div className='flex gap-3 sm:flex-row xl:flex-col sm:min-w-[160px] pt-2 xl:pt-0'>
												<button
													onClick={handleSimpan}
													disabled={saving}
													className='flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:-translate-y-0.5'>
													{saving ? (
														<div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
													) : (
														<>
															<svg
																className='w-5 h-5'
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	strokeWidth={2}
																	d='M5 13l4 4L19 7'
																/>
															</svg>
															<span>Simpan</span>
														</>
													)}
												</button>

												<button
													onClick={handleHapusSesi}
													disabled={saving}
													className='flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-colors disabled:opacity-50'>
													<svg
														className='w-5 h-5'
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth={2}
															d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
														/>
													</svg>
													<span>Hapus</span>
												</button>
											</div>
										</div>
									</div>

									{/* Daftar Siswa dan Absensinya */}
									<div className='p-4 sm:p-6 lg:p-8 bg-gray-50/50'>
										<div className='bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm'>
											{siswaList.length === 0 ? (
												<div className='p-8 text-center text-gray-500'>Tidak ada siswa di kelas ini.</div>
											) : (
												<div className='overflow-x-auto'>
													<table className='w-full min-w-[500px]'>
														<thead>
															<tr className='bg-gray-50 border-b border-gray-200'>
																<th className='px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[40%]'>Data Siswa</th>
																<th className='px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Kehadiran & Keterangan</th>
															</tr>
														</thead>
														<tbody className='divide-y divide-gray-100'>
															{siswaList.map((siswa, idx) => {
																const currentVal = absensiMap[siswa.id] || { status: 'Hadir', keterangan: '' };

																return (
																	<tr
																		key={siswa.id}
																		className='hover:bg-gray-50 transition-colors group'>
																		{/* Info Siswa */}
																		<td className='px-4 sm:px-6 py-4 align-top'>
																			<div className='flex items-center gap-4'>
																				<div className='w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0'>
																					{idx + 1}
																				</div>
																				<div>
																					<p className='font-bold text-gray-900 group-hover:text-purple-600 transition-colors'>{siswa.nama_lengkap}</p>
																					<p className='text-xs text-gray-500 mt-0.5 uppercase tracking-wide'>NIS: {siswa.nis || '-'}</p>
																				</div>
																			</div>
																		</td>

																		{/* Edit Absensi UI */}
																		<td className='px-4 sm:px-6 py-4'>
																			<div className='flex flex-wrap gap-2 mb-3'>
																				{[
																					{ val: 'Hadir', label: 'Hadir', colors: 'text-green-700 bg-green-50 border-green-200 ring-green-500', icon: 'bg-green-500' },
																					{ val: 'Izin', label: 'Izin', colors: 'text-blue-700 bg-blue-50 border-blue-200 ring-blue-500', icon: 'bg-blue-500' },
																					{ val: 'Sakit', label: 'Sakit', colors: 'text-yellow-700 bg-yellow-50 border-yellow-200 ring-yellow-500', icon: 'bg-yellow-500' },
																					{ val: 'Alpha', label: 'Alpha', colors: 'text-red-700 bg-red-50 border-red-200 ring-red-500', icon: 'bg-red-500' },
																				].map((opt) => {
																					const isSelected = currentVal.status === opt.val;
																					return (
																						<label
																							key={opt.val}
																							className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
																								isSelected ? `${opt.colors} shadow-sm border-transparent` : 'text-gray-500 border-gray-100 hover:bg-gray-50 hover:border-gray-200'
																							}`}>
																							<input
																								type='radio'
																								name={`status-${siswa.id}`}
																								value={opt.val}
																								checked={isSelected}
																								onChange={(e) => handleStatusChange(siswa.id, e.target.value)}
																								className='sr-only'
																							/>
																							<div className={`w-2 h-2 rounded-full ${isSelected ? opt.icon : 'bg-gray-300'}`}></div>
																							<span className='text-sm font-semibold'>{opt.label}</span>
																						</label>
																					);
																				})}
																			</div>

																			{/* Input Keterangan */}
																			<input
																				type='text'
																				placeholder='Keterangan (Opsional / Alasan Sakit)'
																				value={currentVal.keterangan || ''}
																				onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
																				className='w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
																			/>
																		</td>
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>
											)}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
