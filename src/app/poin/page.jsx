'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '@/app/components/loading';

export default function PoinGlobalPage() {
	const router = useRouter();

	// --- State ---
	const [kelasList, setKelasList] = useState([]);
	const [poinList, setPoinList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [siswaMap, setSiswaMap] = useState({});
	const [kategoriPositif, setKategoriPositif] = useState([]);
	const [kategoriNegatif, setKategoriNegatif] = useState([]);
	const [badges, setBadges] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filter State
	const [selectedTipe, setSelectedTipe] = useState('semua');
	const [filterKelas, setFilterKelas] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchSiswaModal, setSearchSiswaModal] = useState('');
	const [isSiswaDropdownOpen, setIsSiswaDropdownOpen] = useState(false);
	const [modalFilterKelas, setModalFilterKelas] = useState('Semua');

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
		const initData = async () => {
			try {
				// 1. Ambil List Kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				setKelasList(dataKelas.sort((a, b) => (a.nama_kelas || a.kelas).localeCompare(b.nama_kelas || b.kelas)));

				// 2. Ambil List Siswa (Semua)
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const siswaAktif = dataSiswa.filter((s) => s.status === 'Aktif');
				setSiswaList(siswaAktif);

				// Buat map siswa untuk lookup cepat
				const map = {};
				siswaAktif.forEach((s) => {
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
				await fetchPoin();
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		initData();
	}, [router]);

	const fetchPoin = useCallback(async () => {
		try {
			const res = await fetch(`/api/poin`);
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
			setModalFilterKelas(tmpsiswa?.kelas || 'Semua');
		} else {
			setIsEditing(false);
			setFormData(initialForm);
			setSearchSiswaModal('');
			setModalFilterKelas(filterKelas);
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
			title: 'HAPUS POIN?',
			text: 'Data tidak bisa dikembalikan!',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			confirmButtonText: 'YA, HAPUS',
			cancelButtonText: 'BATAL',
			customClass: { popup: 'rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]', confirmButton: 'rounded-none border-[3px] border-[#0D0D0D] font-black', cancelButton: 'rounded-none border-[3px] border-[#0D0D0D] font-black bg-white text-[#0D0D0D]' },
		});

		if (result.isConfirmed) {
			await fetch(`/api/poin?id=${id}`, { method: 'DELETE' });
			fetchPoin();
			Swal.fire({
				title: 'TERHAPUS!',
				icon: 'success',
				timer: 1000,
				showConfirmButton: false,
				customClass: { popup: 'rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]' },
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
				fetchPoin();
				Swal.fire({
					icon: 'success',
					title: 'TERSIMPAN!',
					timer: 1500,
					showConfirmButton: false,
					customClass: { popup: 'rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]' },
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
	const poinByClass = poinList.filter((p) => {
		if (filterKelas === 'Semua') return true;
		const siswa = siswaMap[p.siswa_id];
		return siswa?.kelas === filterKelas;
	});

	const filteredPoin = poinByClass
		.filter((p) => selectedTipe === 'semua' || p.tipe === selectedTipe)
		.filter((p) => {
			if (!searchQuery) return true;
			const siswa = siswaMap[p.siswa_id];
			const nama = siswa?.nama_lengkap || '';
			return nama.toLowerCase().includes(searchQuery.toLowerCase());
		});

	// Stats
	const totalPositif = poinByClass.filter((p) => p.tipe === 'positif').reduce((sum, p) => sum + p.poin, 0);
	const totalNegatif = poinByClass.filter((p) => p.tipe === 'negatif').reduce((sum, p) => sum + p.poin, 0);
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
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			
			{/* Header Brutalist */}
			<div className='bg-[#8B5CF6] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
				{/* Decorative Elements */}
				<div className='absolute top-4 right-10 w-24 h-24 bg-[#F5C518] border-[4px] border-[#0D0D0D] rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] rotate-12 hidden md:block'></div>
				<div className='absolute bottom-8 left-1/4 w-12 h-12 bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -rotate-12 hidden md:block'></div>

				<div className='max-w-5xl mx-auto relative z-10'>
					<div className='flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8'>
						<div className='flex items-center gap-4'>
							<button
								onClick={() => router.back()}
								className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
								<svg className='w-8 h-8' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
							</button>
							<div>
								<h1 className='text-4xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D] mb-2'>
									REKAP POIN
								</h1>
								<p className='text-[#0D0D0D] font-black tracking-widest uppercase bg-[#F5C518] inline-block px-3 py-1 border-[2px] border-[#0D0D0D] text-xs sm:text-sm'>
									Poin Prestasi & Pelanggaran
								</p>
							</div>
						</div>
						<button
							onClick={() => handleOpenModal()}
							className='w-full md:w-auto bg-[#0D0D0D] text-white px-8 py-4 font-black shadow-[6px_6px_0px_0px_#F5C518] border-[4px] border-[#0D0D0D] flex items-center justify-center gap-3 whitespace-nowrap uppercase tracking-widest hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[10px_10px_0px_0px_#F5C518] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none text-lg'>
							<svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={4} d='M12 4v16m8-8H4'/></svg>
							CATAT POIN BARU
						</button>
					</div>

					{/* Stats Cards */}
					<div className='grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10'>
						{/* Positif */}
						<div className='bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-5 flex items-center justify-between hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all'>
							<div>
								<p className='text-white font-black uppercase text-xs tracking-widest mb-1'>TOTAL POSITIF</p>
								<p className='text-4xl font-black text-white drop-shadow-[2px_2px_0px_#0D0D0D]'>+{totalPositif}</p>
							</div>
							<div className='text-4xl drop-shadow-[2px_2px_0px_#0D0D0D]'>🏆</div>
						</div>
						{/* Negatif */}
						<div className='bg-[#E8451A] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-5 flex items-center justify-between hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all'>
							<div>
								<p className='text-white font-black uppercase text-xs tracking-widest mb-1'>TOTAL NEGATIF</p>
								<p className='text-4xl font-black text-white drop-shadow-[2px_2px_0px_#0D0D0D]'>-{totalNegatif}</p>
							</div>
							<div className='text-4xl drop-shadow-[2px_2px_0px_#0D0D0D]'>⚠️</div>
						</div>
						{/* Nett */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-5 flex items-center justify-between hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all'>
							<div>
								<p className='text-[#0D0D0D] font-black uppercase text-xs tracking-widest mb-1'>NET POIN</p>
								<p className={`text-4xl font-black drop-shadow-[2px_2px_0px_#0D0D0D] ${netPoin >= 0 ? 'text-[#00A693]' : 'text-[#E8451A]'}`}>
									{netPoin >= 0 ? '+' : ''}{netPoin}
								</p>
							</div>
							<div className='text-4xl drop-shadow-[2px_2px_0px_#0D0D0D]'>📊</div>
						</div>
					</div>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 mb-12'>
				<div className='bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col gap-4'>
					{/* Toggle Tipe */}
					<div className='flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar'>
						{['semua', 'positif', 'negatif'].map((tipe) => (
							<button
								key={tipe}
								onClick={() => setSelectedTipe(tipe)}
								className={`px-6 py-4 border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm whitespace-nowrap transition-all flex-shrink-0 ${selectedTipe === tipe ? 'bg-[#0D0D0D] text-white shadow-[4px_4px_0px_0px_#E8451A]' : 'bg-white text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'}`}>
								{tipe === 'semua' ? '📋 SEMUA' : tipe === 'positif' ? '🏆 POSITIF' : '⚠️ NEGATIF'}
							</button>
						))}
					</div>
					<div className='flex flex-col md:flex-row gap-4 w-full'>
						{/* Class Dropdown */}
						<div className='relative w-full md:w-1/3 shrink-0'>
							<select
								value={filterKelas}
								onChange={(e) => setFilterKelas(e.target.value)}
								className='neo-input w-full pl-6 pr-10 py-4 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg appearance-none cursor-pointer'>
								<option value='Semua'>SEMUA KELAS</option>
								{kelasList.map((k) => (
									<option key={k.id} value={k.nama_kelas || k.kelas}>
										{k.nama_kelas || k.kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none'>
								<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7'/></svg>
							</div>
						</div>

						{/* Search Input */}
						<div className='relative flex-1'>
							<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
								<svg className='w-7 h-7 text-[#0D0D0D]' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='4' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path></svg>
							</div>
							<input
								type='text'
								placeholder='CARI NAMA SISWA...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='neo-input w-full !pl-16 pr-4 py-4 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg uppercase placeholder:text-gray-400'
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Feed Poin */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 relative z-10'>
				{filteredPoin.length === 0 ? (
					<div className='bg-white shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] p-16 text-center flex flex-col items-center justify-center relative overflow-hidden'>
						<div className='absolute -top-10 -right-10 w-40 h-40 bg-[#F5C518] rounded-full border-[4px] border-[#0D0D0D] opacity-50'></div>
						<div className='absolute -bottom-10 -left-10 w-40 h-40 bg-[#00A693] border-[4px] border-[#0D0D0D] rotate-45 opacity-50'></div>
						
						<div className='w-28 h-28 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center mx-auto mb-8 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform'>
							<span className='text-6xl drop-shadow-[2px_2px_0px_#0D0D0D]'>⭐</span>
						</div>
						<h3 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] mb-4 uppercase tracking-widest relative z-10'>BELUM ADA DATA</h3>
						<p className='text-[#0D0D0D] font-bold text-lg relative z-10 bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D]'>Silakan catat poin pertama untuk kelas ini.</p>
					</div>
				) : (
					<div className='space-y-12'>
						{Object.entries(groupedPoin).map(([date, items]) => (
							<div key={date} className='relative'>
								{/* Tanggal Separator */}
								<div className='flex items-center gap-4 mb-6 relative z-20'>
									<div className='bg-[#0D0D0D] text-white px-4 py-2 font-black uppercase tracking-widest text-sm border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#F5C518] transform -rotate-2'>
										{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
									</div>
									<div className='flex-1 border-b-[4px] border-dashed border-[#0D0D0D]'></div>
								</div>

								<div className='space-y-6'>
									{items.map((poin) => {
										const siswa = siswaMap[poin.siswa_id];
										const isPositif = poin.tipe === 'positif';
										return (
											<div
												key={poin.id}
												className='bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all relative flex flex-col md:flex-row group'>
												
												{/* Strip Kiri */}
												<div className={`absolute left-0 top-0 bottom-0 w-4 border-r-[4px] border-[#0D0D0D] ${isPositif ? 'bg-[#00A693]' : 'bg-[#E8451A]'}`}></div>

												<div className='flex-1 pl-8 py-6 pr-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center'>
													<div className='flex items-center gap-6'>
														{/* Icon Tipe */}
														<div className={`w-16 h-16 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-3xl flex-shrink-0 transform -rotate-6 group-hover:rotate-0 transition-all ${isPositif ? 'bg-[#00A693]' : 'bg-[#E8451A]'}`}>
															<span className='drop-shadow-[2px_2px_0px_#0D0D0D]'>{isPositif ? '🏆' : '⚠️'}</span>
														</div>

														{/* Konten */}
														<div>
															<h4 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>{siswa?.nama_lengkap || 'Siswa Unknown'}</h4>
															<p className='text-[#0D0D0D] font-bold text-lg leading-snug'>{poin.aktifitas}</p>
															
															<div className='flex flex-wrap gap-2 mt-3'>
																{poin.kategori && (
																	<span className='bg-white px-2 py-1 border-[3px] border-[#0D0D0D] text-[10px] font-black uppercase tracking-widest text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
																		{poin.kategori}
																	</span>
																)}
																{poin.keterangan && (
																	<span className='bg-[#F5C518] px-2 py-1 border-[3px] border-[#0D0D0D] text-[10px] font-bold uppercase tracking-widest text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] truncate max-w-[200px]'>
																		"{poin.keterangan}"
																	</span>
																)}
															</div>
														</div>
													</div>

													<div className='flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t-[4px] border-dashed border-[#0D0D0D] md:border-none pt-4 md:pt-0'>
														<div className={`text-4xl font-black drop-shadow-[2px_2px_0px_#0D0D0D] ${isPositif ? 'text-[#00A693]' : 'text-[#E8451A]'}`}>
															{isPositif ? '+' : '-'}{poin.poin}
														</div>
														<div className='flex gap-2'>
															<button
																onClick={() => handleOpenModal(poin)}
																className='p-2 bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
																title='Edit'>
																<svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'/></svg>
															</button>
															<button
																onClick={() => handleDelete(poin.id)}
																className='p-2 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
																title='Hapus'>
																<svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
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
			</div>

			{/* MODAL FORM */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0D]/60 backdrop-blur-sm'>
					<div className='bg-white w-full max-w-3xl border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 rounded-none'>
						<div className='bg-[#F5C518] px-8 py-5 border-b-[4px] border-[#0D0D0D] flex justify-between items-center shrink-0'>
							<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>{isEditing ? 'EDIT POIN' : 'CATAT POIN BARU'}</h2>
							<button
								onClick={() => setIsModalOpen(false)}
								className='w-10 h-10 flex items-center justify-center bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white transition-colors rounded-none'>
								<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12'/></svg>
							</button>
						</div>

						<form onSubmit={handleSubmit} className='flex-1 overflow-y-auto bg-[#FFF5F0] custom-scrollbar flex flex-col'>
							<div className='p-8 space-y-8 flex-1'>
								
								{/* Tipe Toggle */}
								<div className='flex flex-col sm:flex-row gap-4'>
									<button
										type='button'
										onClick={() => setFormData({ ...formData, tipe: 'positif', kategori: '', aktifitas: '' })}
										className={`flex-1 py-4 border-[4px] border-[#0D0D0D] font-black text-lg uppercase tracking-widest transition-all ${
											formData.tipe === 'positif' ? 'bg-[#00A693] text-white shadow-[6px_6px_0px_0px_#0D0D0D]' : 'bg-white text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'
										}`}>
										🏆 PRESTASI (POSITIF)
									</button>
									<button
										type='button'
										onClick={() => setFormData({ ...formData, tipe: 'negatif', kategori: '', aktifitas: '' })}
										className={`flex-1 py-4 border-[4px] border-[#0D0D0D] font-black text-lg uppercase tracking-widest transition-all ${
											formData.tipe === 'negatif' ? 'bg-[#E8451A] text-white shadow-[6px_6px_0px_0px_#0D0D0D]' : 'bg-white text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'
										}`}>
										⚠️ PELANGGARAN (NEGATIF)
									</button>
								</div>

								<div className='flex flex-col gap-8'>
									{/* Top: Target Siswa */}
									<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative z-20'>
										<div className='absolute -top-4 -left-4 bg-[#F5C518] px-3 py-1 border-[3px] border-[#0D0D0D] font-black uppercase text-sm shadow-[2px_2px_0px_0px_#0D0D0D] rotate-2'>TARGET SISWA</div>
										
										{/* Pilihan Kelas Modal */}
										<div className='mt-4 mb-4 relative'>
											<select
												value={modalFilterKelas}
												onChange={(e) => {
													setModalFilterKelas(e.target.value);
													setSearchSiswaModal('');
													if (formData.siswa_id) setFormData({ ...formData, siswa_id: '' });
													setIsSiswaDropdownOpen(false);
												}}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none appearance-none cursor-pointer'>
												<option value='Semua'>SEMUA KELAS</option>
												{kelasList.map((k) => (
													<option key={k.id} value={k.nama_kelas || k.kelas}>
														{k.nama_kelas || k.kelas}
													</option>
												))}
											</select>
											<div className='absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none'>
												<svg className='w-5 h-5 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7'/></svg>
											</div>
										</div>

										{/* Pencarian Siswa */}
										<div className='relative'>
											<input
												type='text'
												required={!formData.siswa_id}
												placeholder='Ketik nama siswa...'
												value={searchSiswaModal}
												onChange={(e) => {
													setSearchSiswaModal(e.target.value);
													setIsSiswaDropdownOpen(true);
													if (formData.siswa_id) setFormData({ ...formData, siswa_id: '' });
												}}
												onFocus={() => setIsSiswaDropdownOpen(true)}
												onBlur={() => setTimeout(() => setIsSiswaDropdownOpen(false), 200)}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none'
											/>
											{/* Indikator Pilihan */}
											<div className='absolute right-4 top-1/2 -translate-y-1/2'>
												{formData.siswa_id ? (
													<div className='bg-[#00A693] text-white p-1 border-[2px] border-[#0D0D0D]'>
														<svg className='w-4 h-4' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7'/></svg>
													</div>
												) : (
													<span className='text-2xl'>🔍</span>
												)}
											</div>

											{/* Dropdown Pencarian */}
											{isSiswaDropdownOpen && (
												<ul className='absolute z-50 w-full bg-white border-[4px] border-[#0D0D0D] mt-2 max-h-48 overflow-y-auto shadow-[6px_6px_0px_0px_#0D0D0D] divide-y-[3px] divide-[#0D0D0D] custom-scrollbar'>
													{siswaList
														.filter((s) => modalFilterKelas === 'Semua' || s.kelas === modalFilterKelas)
														.filter((s) => s.nama_lengkap.toLowerCase().includes(searchSiswaModal.toLowerCase()) || (s.nis && s.nis.toLowerCase().includes(searchSiswaModal.toLowerCase())))
														.map((s) => (
															<li
																key={s.id}
																className='px-4 py-3 hover:bg-[#F5C518] cursor-pointer text-sm font-bold text-[#0D0D0D] transition-colors'
																onMouseDown={(e) => {
																	e.preventDefault(); // Prevent focus loss on input
																	setFormData({ ...formData, siswa_id: s.id });
																	setSearchSiswaModal(`${s.nama_lengkap} (${s.nis})`);
																	setIsSiswaDropdownOpen(false);
																}}>
																{s.nama_lengkap} <span className='text-[#0D0D0D] bg-white px-2 py-0.5 border border-[#0D0D0D] ml-2 text-xs'>{s.nis}</span>
															</li>
														))}
													{siswaList.filter((s) => modalFilterKelas === 'Semua' || s.kelas === modalFilterKelas).filter((s) => s.nama_lengkap.toLowerCase().includes(searchSiswaModal.toLowerCase()) || (s.nis && s.nis.toLowerCase().includes(searchSiswaModal.toLowerCase()))).length === 0 && (
														<li className='px-4 py-4 text-sm font-bold text-[#0D0D0D] text-center bg-[#FFE8DC]'>TIDAK DITEMUKAN</li>
													)}
												</ul>
											)}
										</div>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
										{/* Kiri (Desktop) / Bawah (Mobile): Detail & Keterangan */}
										<div className='order-2 md:order-1 bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative'>
											<div className='absolute -top-4 -left-4 bg-[#00A693] text-white px-3 py-1 border-[3px] border-[#0D0D0D] font-black uppercase text-sm shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2'>DETAIL</div>
											
											{/* Tanggal & Poin */}
											<div className={formData.kategori === 'Lainnya' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4' : 'mt-4'}>
												<div>
													<label className='block text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest mb-2 bg-[#F5C518] inline-block px-2 border-[2px] border-[#0D0D0D]'>Tanggal</label>
													<input
														type='date'
														required
														value={formData.tanggal}
														onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
														className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none'
													/>
												</div>
												{formData.kategori === 'Lainnya' && (
													<div>
														<label className='block text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest mb-2 bg-[#F5C518] inline-block px-2 border-[2px] border-[#0D0D0D]'>Jumlah Poin</label>
														<div className='relative'>
															<div className={`absolute inset-y-0 left-0 w-10 flex items-center justify-center border-r-[3px] border-[#0D0D0D] font-black text-lg ${formData.tipe === 'positif' ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
																{formData.tipe === 'positif' ? '+' : '-'}
															</div>
															<input
																type='number'
																required
																min='1'
																max='100'
																onWheel={(e) => e.target.blur()}
																value={formData.poin}
																onChange={(e) => setFormData({ ...formData, poin: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
																className='neo-input w-full !pl-14 pr-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-xl shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none'
															/>
														</div>
													</div>
												)}
											</div>

											{/* Aktivitas Manual */}
											{formData.kategori === 'Lainnya' && (
												<div className='mt-6'>
													<label className='block text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest mb-2 bg-[#F5C518] inline-block px-2 border-[2px] border-[#0D0D0D]'>Aktivitas Manual</label>
													<textarea
														rows={2}
														required
														placeholder='Tulis deskripsi aktivitas...'
														value={formData.aktifitas}
														onChange={(e) => setFormData({ ...formData, aktifitas: e.target.value })}
														className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none resize-none'></textarea>
												</div>
											)}

											{/* Keterangan */}
											<div className='mt-6'>
												<label className='block text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest mb-2 bg-[#F5C518] inline-block px-2 border-[2px] border-[#0D0D0D]'>Keterangan Opsional</label>
												<textarea
													rows={2}
													placeholder='Tambahkan catatan spesifik...'
													value={formData.keterangan}
													onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
													className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none resize-none'></textarea>
											</div>
										</div>

										{/* Kanan (Desktop) / Atas (Mobile): Pilihan Aktivitas Cepat */}
										<div className='order-1 md:order-2 bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative flex flex-col max-h-[400px] md:max-h-[600px]'>
											<div className={`absolute -top-4 -right-4 px-3 py-1 border-[3px] border-[#0D0D0D] font-black uppercase text-sm shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2 ${formData.tipe === 'positif' ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
												REFERENSI AKTIVITAS
											</div>

											{currentKategoriList.length > 0 ? (
												<div className='overflow-y-auto custom-scrollbar flex-1 mt-4 space-y-6 pr-2'>
													{Object.entries(groupedKategori).map(([kategori, items]) => (
														<div key={kategori}>
															<h4 className='text-xs font-black text-white bg-[#0D0D0D] inline-block px-3 py-1 uppercase tracking-widest mb-3'>{kategori}</h4>
															<div className='space-y-3'>
																{items.map((item) => {
																	const isSelected = formData.aktifitas === item.aktivitas;
																	return (
																		<button
																			key={item.id}
																			type='button'
																			onClick={() => handleKategoriSelect(item)}
																			className={`w-full text-left px-4 py-3 border-[3px] border-[#0D0D0D] font-bold text-sm transition-all flex items-center justify-between gap-3 ${
																				isSelected
																					? formData.tipe === 'positif'
																						? 'bg-[#00A693] text-white shadow-[4px_4px_0px_0px_#0D0D0D] scale-[1.02]'
																						: 'bg-[#E8451A] text-white shadow-[4px_4px_0px_0px_#0D0D0D] scale-[1.02]'
																					: 'bg-white text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#F5C518] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D]'
																			}`}>
																			<div className='flex items-center gap-3 flex-1 min-w-0 pr-2'>
																				{item.icon && <span className='text-2xl drop-shadow-[1px_1px_0px_#0D0D0D] shrink-0'>{item.icon}</span>}
																				<span className='leading-tight whitespace-normal break-words text-left'>{item.aktivitas}</span>
																			</div>
																			<span className={`px-2 py-1 border-[2px] border-[#0D0D0D] font-black shrink-0 ${isSelected ? 'bg-white text-[#0D0D0D]' : formData.tipe === 'positif' ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
																				{formData.tipe === 'positif' ? '+' : '-'}{item.bobot_default}
																			</span>
																		</button>
																	);
																})}
															</div>
														</div>
													))}
													
													{/* Tombol Opsi Lainnya */}
													<div className='pt-2'>
														<button
															type='button'
															onClick={() => setFormData({ ...formData, kategori: 'Lainnya', aktifitas: '', poin: 5 })}
															className={`w-full text-left px-4 py-3 border-[3px] border-[#0D0D0D] font-bold text-sm transition-all flex items-center justify-between gap-3 ${
																formData.kategori === 'Lainnya'
																	? formData.tipe === 'positif'
																		? 'bg-[#00A693] text-white shadow-[4px_4px_0px_0px_#0D0D0D] scale-[1.02]'
																		: 'bg-[#E8451A] text-white shadow-[4px_4px_0px_0px_#0D0D0D] scale-[1.02]'
																	: 'bg-white text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#F5C518] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D]'
															}`}>
															<div className='flex items-center gap-3 flex-1 min-w-0'>
																<span className='text-2xl drop-shadow-[1px_1px_0px_#0D0D0D]'>✍️</span>
																<span className='leading-tight'>Tulis Manual (Opsi Lainnya)</span>
															</div>
														</button>
													</div>
												</div>
											) : (
												<div className='mt-4 flex-1'>
													<label className='block text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest mb-2 bg-[#F5C518] inline-block px-2 border-[2px] border-[#0D0D0D]'>Input Aktivitas Manual</label>
													<textarea
														rows={4}
														required
														placeholder='Ketik aktivitas yang dilakukan siswa...'
														value={formData.aktifitas}
														onChange={(e) => setFormData({ ...formData, aktifitas: e.target.value })}
														className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none resize-none'></textarea>
												</div>
											)}
										</div>
									</div>
								</div>

							</div>

							<div className='bg-[#F5C518] px-8 py-5 border-t-[4px] border-[#0D0D0D] flex justify-end gap-4 shrink-0'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='bg-white text-[#0D0D0D] px-6 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest'>
									BATAL
								</button>
								<button
									type='submit'
									disabled={saving}
									className='bg-[#0D0D0D] text-white px-8 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:bg-[#00A693] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed'>
									{saving ? 'MENYIMPAN...' : 'SIMPAN POIN'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			<style jsx global>{`
				.custom-scrollbar::-webkit-scrollbar {
					width: 8px;
					height: 8px;
				}
				.custom-scrollbar::-webkit-scrollbar-track {
					background: #FFF5F0;
					border-left: 2px solid #0D0D0D;
				}
				.custom-scrollbar::-webkit-scrollbar-thumb {
					background: #0D0D0D;
				}
				.custom-scrollbar::-webkit-scrollbar-thumb:hover {
					background: #E8451A;
				}
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
