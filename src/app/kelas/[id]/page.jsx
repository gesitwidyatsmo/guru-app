'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { ModalAddSiswa } from '@/app/components/ModalAddSiswa';
import { swalProcess, swalSuccess, swalError, swalConfirmDelete } from '@/lib/swal';

export default function KelasDetail() {
	const params = useParams();
	const id = params.id;
	const router = useRouter();
	const [kelasDetail, setKelasDetail] = useState(null);
	const [jumlahSiswa, setJumlahSiswa] = useState(0);
	const [namaKelas, setNamaKelas] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [poinList, setPoinList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [userName, setUserName] = useState('');
	const [userRole, setUserRole] = useState('');
	const [editFormData, setEditFormData] = useState({
		kelas: '',
		wali_kelas: '',
		// tahun_ajaran: '',
		// status: 'Aktif',
	});

	useEffect(() => {
		if (!id) return;

		const fetchAll = async () => {
			try {
				const res = await fetch('/api/kelas');
				const data = await res.json();

				const kelas = data.find((k) => k.id === id);
				if (kelas) {
					setKelasDetail(kelas);
					setNamaKelas(kelas.kelas);
				}
			} catch (error) {
				console.error('Gagal mengambil data kelas: ', error);
			}
		};

		fetchAll();
	}, [id]);

	useEffect(() => {
		const fetchAuth = async () => {
			try {
				const res = await fetch('/api/auth/me');
				if (res.ok) {
					const data = await res.json();
					setUserName(data.user.nama_lengkap);
					setUserRole(data.user.role);
				}
			} catch (err) {}
		};
		fetchAuth();
	}, []);

	useEffect(() => {
		if (!namaKelas) return; // Jangan fetch jika nama kelas belum ketemu

		const fetchStats = async () => {
			try {
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				const siswaDiKelasIni = dataSiswa.filter((siswa) => siswa.status === 'Aktif' && siswa.kelas === namaKelas);
				const siswaListIni = dataSiswa.filter((siswa) => siswa.kelas === namaKelas);

				setJumlahSiswa(siswaDiKelasIni.length);
				setSiswaList(siswaListIni);
			} catch (error) {
				console.error('Gagal mengambil statistik:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [namaKelas]);

	const fetchKelasData = useCallback(async () => {
		if (!id) return;
		try {
			const res = await fetch('/api/kelas');
			const data = await res.json();
			const kelas = data.find((k) => k.id === id);
			if (kelas) {
				setKelasDetail(kelas);
				setNamaKelas(kelas.kelas);
			}
		} catch (error) {
			console.error('Gagal ambil data kelas:', error);
		}
	}, [id]);

	const fetchSiswaData = useCallback(async () => {
		if (!namaKelas) return;
		// setLoading(true); // Opsional: jangan set loading true jika ingin silent update
		try {
			// 1. Fetch Siswa
			const resSiswa = await fetch('/api/siswa');
			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
			const siswaListIni = dataSiswa.filter((siswa) => siswa.kelas === namaKelas);
			// setJumlahSiswa(siswaListIni.length);
			setSiswaList(siswaListIni);

			// 2. Fetch Poin
			const resPoin = await fetch(`/api/poin?kelas=${encodeURIComponent(namaKelas)}`);
			const dataPoin = resPoin.ok ? await resPoin.json() : [];
			setPoinList(dataPoin);
		} catch (error) {
			console.error('Gagal ambil data siswa/poin:', error);
		} finally {
			setLoading(false);
		}
	}, [namaKelas]);

	useEffect(() => {
		fetchKelasData();
	}, [fetchKelasData]);

	useEffect(() => {
		fetchSiswaData();
	}, [fetchSiswaData]);

	const handleOpenEdit = () => {
		if (kelasDetail) {
			setEditFormData({
				kelas: kelasDetail.kelas,
				wali_kelas: kelasDetail.wali_kelas,
				// tahun_ajaran: kelasDetail.tahun_ajaran,
				// status: kelasDetail.status,
			});
			setIsEditModalOpen(true);
		}
	};

	const handleEditSubmit = async (e) => {
		e.preventDefault();
		swalProcess('Menyimpan Perubahan...');
		setIsEditModalOpen(false);

		try {
			const res = await fetch('/api/kelas', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, ...editFormData }),
			});

			if (!res.ok) throw new Error('Gagal update kelas');

			await swalSuccess('Berhasil', 'Data kelas diperbarui');
			// Refresh data manual atau reload page
			fetchKelasData();
		} catch (error) {
			swalError('Gagal', error.message);
		}
	};

	// Handler: Hapus Kelas
	const handleDeleteKelas = async () => {
		const confirm = await swalConfirmDelete('Hapus Kelas Ini?', 'Semua data siswa di kelas ini mungkin akan menjadi yatim piatu (tidak punya kelas).');

		if (confirm.isConfirmed) {
			swalProcess('Menghapus Kelas...');
			try {
				const res = await fetch(`/api/kelas?id=${id}`, { method: 'DELETE' });
				if (!res.ok) throw new Error('Gagal menghapus kelas');

				await swalSuccess('Terhapus', 'Kelas berhasil dihapus');
				router.push('/kelas');
			} catch (error) {
				swalError('Gagal', error.message);
			}
		}
	};

	if (loading) {
		return <Loader />;
	}

	const isWaliKelas = kelasDetail?.wali_kelas === userName || userRole === 'Admin';

	return (
		<div className='min-h-screen pb-20 font-sans'>
			<SectionHeader
				title={kelasDetail ? kelasDetail.kelas : 'Detail Kelas'}
				leftIcon={
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
				}
				rightIcon={
					<span className='text-xl'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='2'
							stroke='currentColor'
							className='size-6'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5'
							/>
						</svg>
					</span>
				}
				onLeftClick={() => window.history.back()}
			/>

			<div className='max-w-6xl mx-auto px-4 sm:px-8 mt-8 space-y-10'>
				{/* --- 1. HERO HEADER --- */}
				{kelasDetail ? (
					<div className='bg-[#2F80ED] border-[3px] border-black rounded-3xl p-8 md:p-10 text-white shadow-[8px_8px_0px_0px_#0D0D0D] relative overflow-hidden'>
						{/* Background Decorative SVG - Neobrutalism */}
						<div className='absolute -bottom-12 -right-10 opacity-20 pointer-events-none transform rotate-12'>
							<svg width="250" height="250" viewBox="0 0 100 100" fill="currentColor">
								<path d="M50 0 L58 42 L100 50 L58 58 L50 100 L42 58 L0 50 L42 42 Z" />
							</svg>
						</div>
						<div className='absolute top-10 right-40 opacity-20 pointer-events-none'>
							<svg width="80" height="80" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="8">
								<circle cx="50" cy="50" r="40" />
							</svg>
						</div>
						<div className='absolute -top-6 -left-6 opacity-20 pointer-events-none transform -rotate-12'>
							<svg width="150" height="150" viewBox="0 0 100 100" fill="currentColor">
								<path d="M40 0 H60 V40 H100 V60 H60 V100 H40 V60 H0 V40 H40 Z" />
							</svg>
						</div>

						{/* Sticker Decoration */}
						<div className='absolute top-6 right-6 md:top-8 md:right-8 transform rotate-12 z-20 hidden md:flex'>
							<div className='bg-[#F5C518] text-black border-2 border-black rounded-full w-24 h-24 flex items-center justify-center font-black text-center shadow-[4px_4px_0px_0px_#0D0D0D] text-sm leading-tight hover:rotate-45 transition-transform duration-300'>
								KELAS<br/>AKTIF
							</div>
						</div>

						<div className='relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6'>
							<div>
								<div className='text-white font-black tracking-widest uppercase mb-2 border-2 border-black inline-block px-3 py-1 rounded-md bg-black/20'>Dashboard Kelas</div>
								<h1 className='text-4xl md:text-5xl font-black font-["Space_Grotesk"] uppercase tracking-tight mb-6 mt-2' style={{ textShadow: '2px 2px 0 #000' }}>{kelasDetail.kelas}</h1>
								<div className='flex flex-wrap items-center gap-3 text-sm font-bold'>
									<div className='flex items-center gap-2 bg-white text-black border-2 border-black px-4 py-2 rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
										<span>👤</span> Wali Kelas: {kelasDetail.wali_kelas}
									</div>
									<div className='flex items-center gap-2 bg-white text-black border-2 border-black px-4 py-2 rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
										<span>🎓</span> {jumlahSiswa} Siswa Terdaftar
									</div>
								</div>
							</div>

							{isWaliKelas && (
								<button
									onClick={() => setIsAddOpen(true)}
									className='bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none px-6 py-3.5 rounded-2xl font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2'>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										strokeWidth='3'
										stroke='currentColor'
										className='w-5 h-5'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M12 4.5v15m7.5-7.5h-15'
										/>
									</svg>
									Tambah Siswa Baru
								</button>
							)}
						</div>
					</div>
				) : (
					<div className='neo-card text-center py-12'>
						<div className='text-5xl mb-4'>📭</div>
						<p className='font-black text-xl uppercase tracking-wide'>Kelas tidak ditemukan</p>
					</div>
				)}

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
					{/* --- MAIN COLUMN (Actions & Reports) --- */}
					<div className='lg:col-span-2 space-y-10'>
						{/* BENTO GRID: Aksi Utama */}
						<section>
							<div className='flex items-center justify-between mb-4 px-2'>
								<h2 className='text-xl font-black uppercase tracking-wider text-black'>Aksi Harian</h2>
							</div>
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
								{isWaliKelas && (
									<Link
										href={`/kelas/${id}/absensi`}
										className='neo-card flex flex-col items-center text-center gap-4 group cursor-pointer hover:bg-[#F5C518]'>
										<div className='bg-indigo-300 border-2 border-black text-black w-14 h-14 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:bg-white transition-colors duration-300'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={2.5}
												stroke='currentColor'
												className='w-7 h-7'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75'
												/>
											</svg>
										</div>
										<span className='font-black uppercase tracking-wide text-xs text-black leading-snug'>Absensi Wali Kelas</span>
									</Link>
								)}

								<Link
									href={`/kelas/${id}/absensi-mapel`}
									className='neo-card flex flex-col items-center text-center gap-4 group cursor-pointer hover:bg-[#F5C518]'>
									<div className='bg-purple-300 border-2 border-black text-black w-14 h-14 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:bg-white transition-colors duration-300'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2.5}
											stroke='currentColor'
											className='w-7 h-7'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
											/>
										</svg>
									</div>
									<span className='font-black uppercase tracking-wide text-xs text-black leading-snug'>Absensi Mapel</span>
								</Link>

								<Link
									href={`/kelas/${id}/buat-tugas`}
									className='neo-card flex flex-col items-center text-center gap-4 group cursor-pointer hover:bg-[#F5C518]'>
									<div className='bg-[#2F80ED] border-2 border-black text-black w-14 h-14 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:bg-white transition-colors duration-300'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2.5}
											stroke='currentColor'
											className='w-7 h-7'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12'
											/>
										</svg>
									</div>
									<span className='font-black uppercase tracking-wide text-xs text-black leading-snug'>Buat Tugas Baru</span>
								</Link>

								<Link
									href={`/kelas/${id}/jurnal`}
									className='neo-card flex flex-col items-center text-center gap-4 group cursor-pointer hover:bg-[#F5C518]'>
									<div className='bg-[#00A693] border-2 border-black text-black w-14 h-14 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:bg-white transition-colors duration-300'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2.5}
											stroke='currentColor'
											className='w-7 h-7'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
											/>
										</svg>
									</div>
									<span className='font-black uppercase tracking-wide text-xs text-black leading-snug'>Catat Jurnal</span>
								</Link>

								<Link
									href={`/kelas/${id}/poin`}
									className='neo-card flex flex-col items-center text-center gap-4 group cursor-pointer hover:bg-[#F5C518]'>
									<div className='bg-[#E8451A] border-2 border-black text-black w-14 h-14 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] group-hover:bg-white transition-colors duration-300'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2.5}
											stroke='currentColor'
											className='w-7 h-7'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'
											/>
										</svg>
									</div>
									<span className='font-black uppercase tracking-wide text-xs text-black leading-snug'>Catat Poin Master</span>
								</Link>
							</div>
						</section>

						{/* LISTS: Riwayat & Laporan */}
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
							{/* Riwayat */}
							<section>
								<div className='flex items-center justify-between mb-4 px-2'>
									<h2 className='text-xl font-black uppercase tracking-wider text-black'>Riwayat Data</h2>
								</div>
								<div className='border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] bg-white overflow-hidden'>
									<ul className='divide-y-2 divide-black'>
										{isWaliKelas && (
											<li>
												<Link
													href={`/kelas/${id}/riwayat-absensi`}
													className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
													<div className='bg-indigo-300 border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
														<svg
															className='w-5 h-5'
															fill='none'
															viewBox='0 0 24 24'
															stroke='currentColor'
															strokeWidth={2.5}>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																d='M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
															/>
														</svg>
													</div>
													<div className='flex flex-col'>
														<span className='font-black uppercase tracking-wide text-sm text-black'>Riwayat Absensi Harian</span>
														<span className='text-xs text-black font-bold'>Lihat data kehadiran harian</span>
													</div>
												</Link>
											</li>
										)}
										<li>
											<Link
												href={`/kelas/${id}/riwayat-absensi-mapel`}
												className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
												<div className='bg-purple-300 border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
													<svg
														className='w-5 h-5'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
														strokeWidth={2.5}>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'
														/>
													</svg>
												</div>
												<div className='flex flex-col'>
													<span className='font-black uppercase tracking-wide text-sm text-black'>Riwayat Absensi Mapel</span>
													<span className='text-xs text-black font-bold'>Kehadiran per mata pelajaran</span>
												</div>
											</Link>
										</li>
										<li>
											<Link
												href={`/kelas/${id}/riwayat-nilai`}
												className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
												<div className='bg-blue-300 border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
													<svg
														className='w-5 h-5'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
														strokeWidth={2.5}>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
														/>
													</svg>
												</div>
												<div className='flex flex-col'>
													<span className='font-black uppercase tracking-wide text-sm text-black'>Riwayat Nilai</span>
													<span className='text-xs text-black font-bold'>Daftar nilai tugas siswa</span>
												</div>
											</Link>
										</li>
									</ul>
								</div>
							</section>

							{/* Laporan */}
							<section>
								<div className='flex items-center justify-between mb-4 px-2'>
									<h2 className='text-xl font-black uppercase tracking-wider text-black'>Export Laporan</h2>
								</div>
								<div className='border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] bg-white overflow-hidden'>
									<ul className='divide-y-2 divide-black'>
										{isWaliKelas && (
											<li>
												<Link
													href={`/kelas/${id}/laporan-absensi`}
													className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
													<div className='bg-[#00A693] border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
														<svg
															className='w-5 h-5'
															fill='none'
															viewBox='0 0 24 24'
															stroke='currentColor'
															strokeWidth={2.5}>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM9.75 16.5v.75m3-3v3M15 12v5.25'
															/>
														</svg>
													</div>
													<div className='flex flex-col'>
														<span className='font-black uppercase tracking-wide text-sm text-black'>Laporan Absen Harian</span>
														<span className='text-xs text-black font-bold'>Rekapitulasi absensi harian</span>
													</div>
												</Link>
											</li>
										)}
										<li>
											<Link
												href={`/kelas/${id}/laporan-absensi-mapel`}
												className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
												<div className='bg-purple-300 border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
													<svg
														className='w-5 h-5'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
														strokeWidth={2.5}>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM9.75 16.5v.75m3-3v3M15 12v5.25'
														/>
													</svg>
												</div>
												<div className='flex flex-col'>
													<span className='font-black uppercase tracking-wide text-sm text-black'>Laporan Absen Mapel</span>
													<span className='text-xs text-black font-bold'>Rekapitulasi absensi mapel</span>
												</div>
											</Link>
										</li>
										<li>
											<Link
												href={`/kelas/${id}/laporan-nilai`}
												className='flex items-center gap-4 p-4 hover:bg-[#F5C518] transition-colors group'>
												<div className='bg-[#2F80ED] border-2 border-black text-black p-2.5 rounded-xl group-hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-colors'>
													<svg
														className='w-5 h-5'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
														strokeWidth={2.5}>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM9.75 16.5v.75m3-3v3M15 12v5.25'
														/>
													</svg>
												</div>
												<div className='flex flex-col'>
													<span className='font-black uppercase tracking-wide text-sm text-black'>Laporan Nilai Kelas</span>
													<span className='text-xs text-black font-bold'>Export buku nilai siswa</span>
												</div>
											</Link>
										</li>
									</ul>
								</div>
							</section>
						</div>
					</div>

					{/* --- SETTINGS COLUMN --- */}
					<div className='space-y-8 lg:col-span-1'>
						{/* Pengaturan Column */}
						{isWaliKelas && (
							<div className='flex flex-col gap-6'>
								<section>
									<h2 className='text-sm font-black uppercase tracking-wider text-black mb-4'>Pengaturan Kelas</h2>
									<div className='neo-card space-y-4'>
										<button
											onClick={handleOpenEdit}
											className='w-full neo-btn-outline flex items-center justify-center gap-2 transition-all'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={2}
												stroke='currentColor'
												className='w-5 h-5'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125'
												/>
											</svg>
											Edit Profil Kelas
										</button>
										<button
											onClick={handleDeleteKelas}
											className='w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white text-[#E8451A] font-bold text-sm transition-all border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={2}
												stroke='currentColor'
												className='w-5 h-5'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
												/>
											</svg>
											Hapus Kelas
										</button>
									</div>
								</section>
							</div>
						)}
					</div>
				</div>

				{/* --- FULL WIDTH COLUMN (Students) --- */}
				<div className='w-full'>
					{/* Daftar Siswa */}
					<section>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4'>
							<div className='flex items-center gap-4'>
								<div className='bg-[#F5C518] border-[3px] border-black text-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] hidden sm:block'>
									<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={2.5} stroke='currentColor' className='w-6 h-6'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' />
									</svg>
								</div>
								<div>
									<h2 className='text-2xl font-black uppercase tracking-wider text-black'>Daftar Siswa</h2>
									<p className='text-sm text-black font-bold border-2 border-black inline-block px-2 py-0.5 rounded-md shadow-[2px_2px_0px_0px_#0D0D0D] bg-white mt-1'>{siswaList.length} Siswa Terdaftar</p>
								</div>
							</div>
						</div>

						{/* List Siswa as Grid */}
						{siswaList.length === 0 ? (
							<div className='py-16 text-center flex flex-col items-center justify-center bg-white border-[3px] border-black rounded-3xl shadow-[6px_6px_0px_0px_#0D0D0D]'>
								<div className='w-20 h-20 bg-[#F5C518] border-2 border-black rounded-full flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<span className='text-4xl'>📭</span>
								</div>
								<h3 className='text-xl font-black uppercase text-black mb-1'>Belum Ada Siswa</h3>
								<p className='text-black font-bold text-sm'>Kelas ini belum memiliki siswa yang terdaftar.</p>
							</div>
						) : (
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
								{siswaList.map((siswa, index) => (
									<Link
										href={`/siswa/${siswa.id}`}
										key={siswa.id}
										className='bg-white border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] p-4 flex items-center gap-4 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all group'>
										<div className='w-12 h-12 rounded-xl bg-[#FFE8DC] border-2 border-black text-black flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 group-hover:bg-[#F5C518] transition-colors'>
											{siswa.nama_lengkap.charAt(0).toUpperCase()}
										</div>

										<div className='flex-1 min-w-0'>
											<div className='flex flex-wrap items-center gap-2 mb-1'>
												<span className='font-black uppercase text-black line-clamp-1 text-sm group-hover:underline' title={siswa.nama_lengkap}>{siswa.nama_lengkap}</span>
											</div>
											<div className='flex flex-wrap items-center gap-2 mt-1.5'>
												<p className='text-[10px] text-black font-bold bg-gray-100 border border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_#0D0D0D]'>NIS: {siswa.nis}</p>
												{siswa.status === 'Aktif' ? (
													<span className='bg-[#00A693] text-white border border-black shadow-[1px_1px_0px_0px_#0D0D0D] px-1.5 py-0.5 rounded font-bold text-[10px]'>AKTIF</span>
												) : (
													<span className='bg-[#E8451A] text-white border border-black shadow-[1px_1px_0px_0px_#0D0D0D] px-1.5 py-0.5 rounded font-bold text-[10px] uppercase'>{siswa.status}</span>
												)}
												
												{/* Poin Badges */}
												{(() => {
													const points = poinList.filter((p) => p.siswa_id === siswa.id);
													const positif = points.filter((p) => p.tipe === 'positif').reduce((sum, p) => sum + p.poin, 0);
													const negatif = points.filter((p) => p.tipe === 'negatif').reduce((sum, p) => sum + p.poin, 0);

													if (positif === 0 && negatif === 0) return null;

													return (
														<div className='flex gap-1'>
															{positif > 0 && <span className='text-[10px] bg-[#F5C518] text-black border border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_#0D0D0D] font-black'>+{positif}</span>}
															{negatif > 0 && <span className='text-[10px] bg-[#E8451A] text-white border border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_#0D0D0D] font-black'>-{negatif}</span>}
														</div>
													);
												})()}
											</div>
										</div>
										<div className='text-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={3}
												stroke='currentColor'
												className='w-5 h-5'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='m8.25 4.5 7.5 7.5-7.5 7.5'
												/>
											</svg>
										</div>
									</Link>
								))}
							</div>
						)}
					</section>
				</div>
			</div>

			{/* 4. Modal Form - Clean & Direct */}
			{isModalOpen && (
				<div
					className='fixed inset-0 z-50 overflow-y-auto'
					aria-labelledby='modal-title'
					role='dialog'
					aria-modal='true'>
					{/* Backdrop */}
					<div
						className='fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity'
						onClick={() => setIsModalOpen(false)}></div>

					<div className='flex min-h-full items-center justify-center p-4 text-center sm:p-0'>
						<div className='relative transform overflow-hidden rounded-2xl border-[3px] border-black bg-white text-left shadow-[8px_8px_0px_0px_#0D0D0D] transition-all sm:my-8 sm:w-full sm:max-w-lg'>
							<div className='bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4'>
								<h3
									className='text-xl font-black uppercase tracking-wider text-black mb-4'
									id='modal-title'>
									{isEditMode ? 'Edit Siswa' : 'Tambah Siswa Baru'}
								</h3>

								<form
									id='siswaForm'
									onSubmit={handleSubmit}
									className='space-y-4'>
									<div>
										<label className='block text-sm font-black uppercase tracking-wide text-black'>Nama Lengkap</label>
										<input
											required
											type='text'
											className='neo-input mt-1'
											value={formData.nama_lengkap}
											onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
										/>
									</div>

									<div className='grid grid-cols-2 gap-4'>
										<div>
											<label className='block text-sm font-black uppercase tracking-wide text-black'>NIS</label>
											<input
												type='text'
												className='neo-input mt-1'
												value={formData.nis}
												onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
											/>
										</div>
										<div>
											<label className='block text-sm font-black uppercase tracking-wide text-black'>Kelas</label>
											<select
												required
												className='neo-input mt-1'
												value={formData.kelas}
												onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}>
												<option value=''>Pilih Kelas</option>
												{kelasList.map((k, i) => (
													<option
														key={i}
														value={k.kelas || k.nama_kelas}>
														{k.kelas || k.nama_kelas}
													</option>
												))}
											</select>
										</div>
									</div>

									<div className='grid grid-cols-2 gap-4'>
										<div>
											<label className='block text-sm font-black uppercase tracking-wide text-black'>Jenis Kelamin</label>
											<select
												className='neo-input mt-1'
												value={formData.jenis_kelamin}
												onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
												<option value='Laki-laki'>Laki-laki</option>
												<option value='Perempuan'>Perempuan</option>
											</select>
										</div>
										<div>
											<label className='block text-sm font-black uppercase tracking-wide text-black'>Status</label>
											<select
												className='neo-input mt-1'
												value={formData.status}
												onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
												<option value='Aktif'>Aktif</option>
												<option value='Non-Aktif'>Non-Aktif</option>
												<option value='Lulus'>Lulus</option>
												<option value='Pindah'>Pindah</option>
											</select>
										</div>
									</div>
								</form>
							</div>

							<div className='bg-white border-t-2 border-black px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3'>
								<button
									type='submit'
									form='siswaForm'
									className='neo-btn-primary w-full sm:w-auto'>
									Simpan
								</button>
								<button
									type='button'
									className='neo-btn-outline w-full sm:w-auto mt-3 sm:mt-0'
									onClick={() => setIsModalOpen(false)}>
									Batal
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
			<ModalAddSiswa
				isOpen={isAddOpen}
				onClose={() => setIsAddOpen(false)}
				currentKelas={namaKelas}
				onRefresh={fetchSiswaData}
			/>

			{/* --- MODAL EDIT KELAS --- */}
			{isEditModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
					<div className='w-full max-w-md rounded-2xl border-[3px] border-black bg-white p-6 shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<h3 className='text-xl font-black uppercase tracking-wider text-black mb-4'>Edit Data Kelas</h3>
						<form
							onSubmit={handleEditSubmit}
							className='space-y-4'>
							<div>
								<label className='block text-sm font-black uppercase tracking-wide text-black'>Nama Kelas</label>
								<input
									type='text'
									required
									value={editFormData.kelas}
									onChange={(e) => setEditFormData({ ...editFormData, kelas: e.target.value })}
									className='neo-input mt-1'
								/>
							</div>

							<div>
								<label className='block text-sm font-black uppercase tracking-wide text-black'>Wali Kelas</label>
								<input
									type='text'
									required
									value={editFormData.wali_kelas}
									onChange={(e) => setEditFormData({ ...editFormData, wali_kelas: e.target.value })}
									className='neo-input mt-1'
								/>
							</div>

							{/* <div>
								<label className='block text-sm font-medium text-gray-700'>Tahun Ajaran</label>
								<input
									type='text'
									value={editFormData.tahun_ajaran}
									onChange={(e) => setEditFormData({ ...editFormData, tahun_ajaran: e.target.value })}
									className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500'
								/>
							</div> */}

							<div className='flex gap-3 pt-4'>
								<button
									type='button'
									onClick={() => setIsEditModalOpen(false)}
									className='flex-1 neo-btn-outline'>
									Batal
								</button>
								<button
									type='submit'
									className='flex-1 neo-btn-primary'>
									Simpan Perubahan
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
