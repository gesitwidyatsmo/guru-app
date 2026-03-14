'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '@/app/components/loading';

export default function PoinKelasPage() {
	const params = useParams();
	const router = useRouter();
	const classId = params.id;

	// --- State ---
	const [kelasInfo, setKelasInfo] = useState(null);
	const [poinList, setPoinList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [siswaMap, setSiswaMap] = useState({});
	const [kategoriPositif, setKategoriPositif] = useState([]);
	const [kategoriNegatif, setKategoriNegatif] = useState([]);
	const [badges, setBadges] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filter State
	const [selectedTipe, setSelectedTipe] = useState('semua');
	const [searchQuery, setSearchQuery] = useState('');

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchSiswaModal, setSearchSiswaModal] = useState('');
	const [isSiswaDropdownOpen, setIsSiswaDropdownOpen] = useState(false);

	const initialForm = {
		id: '',
		tanggal: new Date().toISOString().slice(0, 10),
		siswa_id: '',
		tipe: 'positif',
		kategori: '',
		aktifitas: '',
		poin: 5,
		keterangan: '',
	};
	const [formData, setFormData] = useState(initialForm);

	// --- Fetch Data ---
	useEffect(() => {
		if (!classId) return;

		const initData = async () => {
			try {
				// 1. Ambil Info Kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const currentKelas = dataKelas.find((k) => String(k.id) === String(classId));

				if (!currentKelas) {
					Swal.fire('Error', 'Kelas tidak ditemukan', 'error');
					router.push('/kelas');
					return;
				}
				setKelasInfo(currentKelas);

				// 2. Ambil List Siswa
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const siswaKelas = dataSiswa.filter((s) => s.kelas === (currentKelas.kelas || currentKelas.nama_kelas) && s.status === 'Aktif');
				setSiswaList(siswaKelas);

				// Buat map siswa untuk lookup cepat
				const map = {};
				dataSiswa.forEach((s) => {
					map[s.id] = s;
				});
				setSiswaMap(map);

				// 3. Ambil Kategori
				const resKategori = await fetch('/api/poin/kategori');
				if (resKategori.ok) {
					const dataKategori = await resKategori.json();
					setKategoriPositif(dataKategori.positif || []);
					setKategoriNegatif(dataKategori.negatif || []);
					setBadges(dataKategori.badges || []);
				}

				// 4. Ambil Poin
				await fetchPoin(currentKelas.kelas || currentKelas.nama_kelas);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		initData();
	}, [classId, router, fetchPoin]);

	const fetchPoin = useCallback(async (namaKelas) => {
		try {
			const res = await fetch(`/api/poin?kelas=${encodeURIComponent(namaKelas)}`);
			if (res.ok) {
				const data = await res.json();
				setPoinList(data);
			}
		} catch (error) {
			console.error('Gagal load poin:', error);
		}
	}, []);

	// --- Handlers ---
	const handleOpenModal = (item = null) => {
		if (item) {
			setIsEditing(true);
			setFormData(item);
			const tmpsiswa = siswaList.find((s) => s.id === item.siswa_id) || siswaMap[item.siswa_id];
			setSearchSiswaModal(tmpsiswa ? `${tmpsiswa.nama_lengkap} (${tmpsiswa.nis})` : '');
		} else {
			setIsEditing(false);
			setFormData(initialForm);
			setSearchSiswaModal('');
		}
		setIsSiswaDropdownOpen(false);
		setIsModalOpen(true);
	};

	const handleKategoriSelect = (item) => {
		setFormData({
			...formData,
			kategori: item.kategori,
			aktifitas: item.aktivitas,
			poin: item.bobot_default || 5,
		});
	};

	const handleDelete = async (id) => {
		const result = await Swal.fire({
			title: 'Hapus Poin?',
			text: 'Data tidak bisa dikembalikan',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#ef4444',
			confirmButtonText: 'Hapus',
			cancelButtonText: 'Batal',
			customClass: { popup: 'rounded-2xl' },
		});

		if (result.isConfirmed) {
			await fetch(`/api/poin?id=${id}`, { method: 'DELETE' });
			fetchPoin(kelasInfo.kelas || kelasInfo.nama_kelas);
			Swal.fire({
				title: 'Terhapus',
				icon: 'success',
				timer: 1000,
				showConfirmButton: false,
				customClass: { popup: 'rounded-2xl' },
			});
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		const payload = { ...formData };

		try {
			const res = await fetch('/api/poin', {
				method: isEditing ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				setIsModalOpen(false);
				fetchPoin(kelasInfo.kelas || kelasInfo.nama_kelas);
				Swal.fire({
					icon: 'success',
					title: 'Tersimpan',
					timer: 1500,
					showConfirmButton: false,
					customClass: { popup: 'rounded-2xl' },
				});
			} else {
				throw new Error('Gagal API');
			}
		} catch (error) {
			Swal.fire('Error', 'Gagal menyimpan data', 'error');
		} finally {
			setSaving(false);
		}
	};

	// --- Derived Data ---
	const filteredPoin = poinList
		.filter((p) => selectedTipe === 'semua' || p.tipe === selectedTipe)
		.filter((p) => {
			if (!searchQuery) return true;
			const siswa = siswaMap[p.siswa_id];
			const nama = siswa?.nama_lengkap || '';
			return nama.toLowerCase().includes(searchQuery.toLowerCase());
		});

	// Stats
	const totalPositif = poinList.filter((p) => p.tipe === 'positif').reduce((sum, p) => sum + p.poin, 0);
	const totalNegatif = poinList.filter((p) => p.tipe === 'negatif').reduce((sum, p) => sum + p.poin, 0);
	const netPoin = totalPositif - totalNegatif;

	// Group by date
	const groupedPoin = filteredPoin.reduce((acc, p) => {
		const date = p.tanggal;
		if (!acc[date]) acc[date] = [];
		acc[date].push(p);
		return acc;
	}, {});

	// Kategori berdasarkan tipe
	const currentKategoriList = formData.tipe === 'positif' ? kategoriPositif : kategoriNegatif;

	// Grouped kategori
	const groupedKategori = currentKategoriList.reduce((acc, item) => {
		const cat = item.kategori || 'Lainnya';
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(item);
		return acc;
	}, {});

	if (loading) return <Loader />;

	return (
		<div className='min-h-screen bg-[#FAFAFA] text-slate-800 font-sans'>
			{/* --- Header Area --- */}
			<header className='sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200'>
				<div className='max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between'>
					<div className='flex items-center gap-2 sm:gap-4'>
						<button
							onClick={() => router.back()}
							className='p-1.5 sm:p-2 -ml-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500'>
							<svg
								className='w-5 h-5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10 19l-7-7m0 0l7-7m-7 7h18'
								/>
							</svg>
						</button>
						<div>
							<h1 className='text-base sm:text-lg font-bold text-slate-900 leading-tight'>{kelasInfo?.kelas || kelasInfo?.nama_kelas}</h1>
							<p className='text-[10px] sm:text-xs text-slate-500'>Poin Siswa</p>
						</div>
					</div>

					<button
						onClick={() => handleOpenModal()}
						className='bg-slate-900 hover:bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-slate-900/20 active:scale-95'>
						<svg
							className='w-4 h-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 4v16m8-8H4'
							/>
						</svg>
						<span className='hidden xs:inline'>Catat</span>
					</button>
				</div>
			</header>

			<main className='max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8'>
				{/* --- Stats Cards --- */}
				<div className='grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-8'>
					<div className='bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm'>
						<div className='flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3'>
							<div className='w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0'>
								<span className='text-base sm:text-lg'>🏆</span>
							</div>
							<div className='text-center sm:text-left'>
								<p className='text-lg sm:text-2xl font-bold text-emerald-600'>+{totalPositif}</p>
								<p className='text-[10px] sm:text-xs text-slate-500'>Positif</p>
							</div>
						</div>
					</div>

					<div className='bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm'>
						<div className='flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3'>
							<div className='w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0'>
								<span className='text-base sm:text-lg'>⚠️</span>
							</div>
							<div className='text-center sm:text-left'>
								<p className='text-lg sm:text-2xl font-bold text-red-600'>-{totalNegatif}</p>
								<p className='text-[10px] sm:text-xs text-slate-500'>Negatif</p>
							</div>
						</div>
					</div>

					<div className='bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm'>
						<div className='flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3'>
							<div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${netPoin >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
								<span className='text-base sm:text-lg'>📊</span>
							</div>
							<div className='text-center sm:text-left'>
								<p className={`text-lg sm:text-2xl font-bold ${netPoin >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
									{netPoin >= 0 ? '+' : ''}
									{netPoin}
								</p>
								<p className='text-[10px] sm:text-xs text-slate-500'>Nett</p>
							</div>
						</div>
					</div>
				</div>

				{/* --- Filter Bar --- */}
				<div className='flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-6'>
					{/* Type Filter - Horizontal Scroll on Mobile */}
					<div className='flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide'>
						{['semua', 'positif', 'negatif'].map((tipe) => (
							<button
								key={tipe}
								onClick={() => setSelectedTipe(tipe)}
								className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
									selectedTipe === tipe ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
								}`}>
								{tipe === 'semua' ? '📋 Semua' : tipe === 'positif' ? '🏆 Positif' : '⚠️ Negatif'}
							</button>
						))}
					</div>
					{/* Search */}
					<input
						type='text'
						placeholder='🔍 Cari siswa...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='w-full px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent'
					/>
				</div>

				{/* --- Poin List --- */}
				{filteredPoin.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-12 sm:py-20 bg-white rounded-2xl sm:rounded-3xl border border-dashed border-slate-300'>
						<div className='w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 sm:mb-4'>
							<span className='text-2xl sm:text-3xl'>⭐</span>
						</div>
						<h3 className='text-slate-900 font-semibold text-base sm:text-lg'>Belum ada poin</h3>
						<p className='text-slate-500 text-xs sm:text-sm mt-1 text-center px-4'>Mulai dengan mencatat poin siswa.</p>
					</div>
				) : (
					<div className='space-y-4 sm:space-y-6'>
						{Object.entries(groupedPoin).map(([date, items]) => (
							<div key={date}>
								<div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
									<div className='w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-slate-300'></div>
									<span className='text-xs sm:text-sm font-medium text-slate-500'>
										{new Date(date).toLocaleDateString('id-ID', {
											weekday: 'short',
											day: 'numeric',
											month: 'short',
											year: 'numeric',
										})}
									</span>
								</div>
								<div className='space-y-2 sm:space-y-3 ml-4 sm:ml-6'>
									{items.map((poin) => {
										const siswa = siswaMap[poin.siswa_id];
										return (
											<div
												key={poin.id}
												className={`bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm transition-all hover:shadow-md ${poin.tipe === 'positif' ? 'border-emerald-200' : 'border-red-200'}`}>
												<div className='flex justify-between items-start gap-2'>
													<div className='flex gap-2 sm:gap-3 flex-1 min-w-0'>
														<div
															className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 text-sm sm:text-base ${
																poin.tipe === 'positif' ? 'bg-emerald-100' : 'bg-red-100'
															}`}>
															{poin.tipe === 'positif' ? '🏆' : '⚠️'}
														</div>
														<div className='flex-1 min-w-0'>
															<h4 className='font-semibold text-slate-900 text-sm sm:text-base truncate'>{siswa?.nama_lengkap || poin.siswa_id}</h4>
															<p className='text-xs sm:text-sm text-slate-600 mt-0.5 line-clamp-2'>{poin.aktifitas}</p>
															<div className='flex flex-wrap gap-1 sm:gap-2 mt-1.5 sm:mt-2'>
																{poin.kategori && <span className='px-1.5 sm:px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] sm:text-xs'>{poin.kategori}</span>}
																{poin.keterangan && <span className='text-[10px] sm:text-xs text-slate-400 italic truncate max-w-[120px] sm:max-w-none'>{poin.keterangan}</span>}
															</div>
														</div>
													</div>
													<div className='flex flex-col items-end gap-1 sm:gap-2 flex-shrink-0'>
														<span className={`text-base sm:text-lg font-bold ${poin.tipe === 'positif' ? 'text-emerald-600' : 'text-red-600'}`}>
															{poin.tipe === 'positif' ? '+' : '-'}
															{poin.poin}
														</span>
														<div className='flex gap-0.5 sm:gap-1'>
															<button
																onClick={() => handleOpenModal(poin)}
																className='p-1 sm:p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'>
																<svg
																	className='w-3.5 h-3.5 sm:w-4 sm:h-4'
																	fill='none'
																	viewBox='0 0 24 24'
																	stroke='currentColor'>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
																	/>
																</svg>
															</button>
															<button
																onClick={() => handleDelete(poin.id)}
																className='p-1 sm:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'>
																<svg
																	className='w-3.5 h-3.5 sm:w-4 sm:h-4'
																	fill='none'
																	viewBox='0 0 24 24'
																	stroke='currentColor'>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
																	/>
																</svg>
															</button>
														</div>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</main>

			{/* --- Modal Form --- */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center'>
					<div
						className='absolute inset-0 bg-slate-900/30 backdrop-blur-sm'
						onClick={() => setIsModalOpen(false)}></div>
					<div className='relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-200'>
						{/* Modal Header */}
						<div className='px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center flex-shrink-0'>
							<h2 className='text-base sm:text-lg font-bold text-slate-900'>{isEditing ? 'Edit Poin' : 'Catat Poin Baru'}</h2>
							<button
								onClick={() => setIsModalOpen(false)}
								className='text-slate-400 hover:text-slate-600 transition-colors'>
								<svg
									className='w-5 h-5 sm:w-6 sm:h-6'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>

						<form
							onSubmit={handleSubmit}
							className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5'>
							{/* Tipe Toggle */}
							<div className='flex gap-2'>
								<button
									type='button'
									onClick={() => setFormData({ ...formData, tipe: 'positif', kategori: '', aktifitas: '' })}
									className={`flex-1 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base transition-all ${
										formData.tipe === 'positif' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
									}`}>
									🏆 Positif
								</button>
								<button
									type='button'
									onClick={() => setFormData({ ...formData, tipe: 'negatif', kategori: '', aktifitas: '' })}
									className={`flex-1 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base transition-all ${
										formData.tipe === 'negatif' ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
									}`}>
									⚠️ Negatif
								</button>
							</div>

							{/* Siswa */}
							<div className='space-y-1 relative'>
								<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Pilih Siswa</label>
								<div className='relative'>
									<input
										type='text'
										required={!formData.siswa_id}
										placeholder='Cari dan Pilih Siswa...'
										value={searchSiswaModal}
										onChange={(e) => {
											setSearchSiswaModal(e.target.value);
											setIsSiswaDropdownOpen(true);
											if (formData.siswa_id) setFormData({ ...formData, siswa_id: '' });
										}}
										onFocus={() => setIsSiswaDropdownOpen(true)}
										onBlur={() => setTimeout(() => setIsSiswaDropdownOpen(false), 200)}
										className={`w-full p-2.5 sm:p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-slate-900 font-medium text-sm sm:text-base transition-colors ${formData.siswa_id ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-transparent text-slate-700'}`}
									/>
									{/* Ikon panah/centang */}
									<div className={`absolute right-3 top-1/2 -translate-y-1/2 ${formData.siswa_id ? 'text-emerald-500' : 'text-slate-400'}`}>
										{formData.siswa_id ? (
											<svg
												className='w-5 h-5 pointer-events-none'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2.5}
													d='M5 13l4 4L19 7'
												/>
											</svg>
										) : (
											<svg
												className='w-5 h-5 pointer-events-none'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 9l-7 7-7-7'
												/>
											</svg>
										)}
									</div>
								</div>

								{/* Dropdown Hasil Pencarian*/}
								{isSiswaDropdownOpen && (
									<ul className='absolute z-[60] w-full bg-white border border-slate-200 mt-1 max-h-48 overflow-y-auto rounded-xl shadow-xl divide-y divide-slate-50 outline outline-1 outline-black/5'>
										{siswaList
											.filter((s) => s.nama_lengkap.toLowerCase().includes(searchSiswaModal.toLowerCase()) || (s.nis && s.nis.toLowerCase().includes(searchSiswaModal.toLowerCase())))
											.map((s) => (
												<li
													key={s.id}
													className='px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700'
													onClick={() => {
														setFormData({ ...formData, siswa_id: s.id });
														setSearchSiswaModal(`${s.nama_lengkap} (${s.nis})`);
														setIsSiswaDropdownOpen(false);
													}}>
													{s.nama_lengkap} <span className='text-slate-400 font-normal ml-1'>({s.nis})</span>
												</li>
											))}
										{siswaList.filter((s) => s.nama_lengkap.toLowerCase().includes(searchSiswaModal.toLowerCase()) || (s.nis && s.nis.toLowerCase().includes(searchSiswaModal.toLowerCase()))).length === 0 && (
											<li className='px-4 py-3 text-sm text-slate-500 text-center italic'>Tidak ada siswa yang cocok.</li>
										)}
									</ul>
								)}
							</div>

							{/* Aktivitas dari Kategori */}
							{currentKategoriList.length > 0 && (
								<div className='space-y-1'>
									<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Pilih Aktivitas</label>
									<div className='max-h-48 sm:max-h-56 overflow-y-auto bg-slate-50 rounded-xl p-2 space-y-2'>
										{Object.entries(groupedKategori).map(([kategori, items]) => (
											<div key={kategori}>
												<div className='text-[10px] sm:text-xs font-bold text-slate-400 uppercase px-2 py-1'>{kategori}</div>
												<div className='space-y-1'>
													{items.map((item) => (
														<button
															key={item.id}
															type='button'
															onClick={() => handleKategoriSelect(item)}
															className={`w-full text-left px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm transition-all flex items-center justify-between gap-2 ${
																formData.aktifitas === item.aktivitas
																	? formData.tipe === 'positif'
																		? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
																		: 'bg-red-100 text-red-700 border border-red-200'
																	: 'hover:bg-white text-slate-600 border border-transparent'
															}`}>
															<div className='flex items-center gap-2 min-w-0'>
																{item.icon && <span className='text-base flex-shrink-0'>{item.icon}</span>}
																<span className='truncate'>{item.aktivitas}</span>
															</div>
															<span className={`text-xs font-bold flex-shrink-0 ${formData.tipe === 'positif' ? 'text-emerald-600' : 'text-red-600'}`}>
																{formData.tipe === 'positif' ? '+' : '-'}
																{item.bobot_default}
															</span>
														</button>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Manual Input if no kategori or need custom */}
							<div className='grid grid-cols-2 gap-3 sm:gap-4'>
								<div className='space-y-1'>
									<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Tanggal</label>
									<input
										type='date'
										required
										value={formData.tanggal}
										onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
										className='w-full p-2.5 sm:p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 font-medium text-slate-700 text-sm'
									/>
								</div>
								<div className='space-y-1'>
									<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Poin</label>
									<input
										type='number'
										required
										min='1'
										max='100'
										value={formData.poin}
										onChange={(e) => setFormData({ ...formData, poin: parseInt(e.target.value) || 0 })}
										className='w-full p-2.5 sm:p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 font-medium text-slate-700 text-sm'
									/>
								</div>
							</div>

							{/* Aktivitas Custom (jika tidak ada dari kategori) */}
							{currentKategoriList.length === 0 && (
								<div className='space-y-1'>
									<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Aktivitas</label>
									<input
										type='text'
										required
										placeholder='Contoh: Membantu teman belajar'
										value={formData.aktifitas}
										onChange={(e) => setFormData({ ...formData, aktifitas: e.target.value })}
										className='w-full p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 text-slate-700 text-sm'
									/>
								</div>
							)}

							{/* Keterangan */}
							<div className='space-y-1'>
								<label className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>
									Keterangan <span className='font-normal text-slate-400'>(opsional)</span>
								</label>
								<textarea
									rows={2}
									placeholder='Catatan tambahan...'
									value={formData.keterangan}
									onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
									className='w-full p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 text-slate-700 text-sm'></textarea>
							</div>
						</form>

						{/* Modal Footer */}
						<div className='p-4 sm:p-6 border-t border-slate-100 flex gap-2 sm:gap-3 flex-shrink-0'>
							<button
								type='button'
								onClick={() => setIsModalOpen(false)}
								className='flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors border border-slate-200'>
								Batal
							</button>
							<button
								onClick={handleSubmit}
								disabled={saving}
								className={`flex-1 sm:flex-none px-6 sm:px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all ${
									formData.tipe === 'positif' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
								}`}>
								{saving ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Custom scrollbar hide style */}
			<style
				jsx
				global>{`
				.scrollbar-hide::-webkit-scrollbar {
					display: none;
				}
				.scrollbar-hide {
					-ms-overflow-style: none;
					scrollbar-width: none;
				}
			`}</style>
		</div>
	);
}
