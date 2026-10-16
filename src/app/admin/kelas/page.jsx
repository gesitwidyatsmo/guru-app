'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';
import { useAdminAuth } from '../AdminLayoutClient';

export default function AdminKelasPage() {
	const { role: authRole } = useAdminAuth();
	const [kelasList, setKelasList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentUserRole, setCurrentUserRole] = useState(authRole || null);

	useEffect(() => {
		if (authRole) setCurrentUserRole(authRole);
	}, [authRole]);

	const isReadOnly = currentUserRole === 'Kepala Sekolah';

	// Filters
	const [searchQuery, setSearchQuery] = useState('');
	const [filterWali, setFilterWali] = useState('all'); // all | has_wali | no_wali

	// Modals
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		kelas: '',
		id_wali_kelas: '',
	});

	const loadData = async () => {
		try {
			setLoading(true);
			const [resKelas, resUsers, resSiswa, resAuth] = await Promise.all([
				fetch('/api/kelas?all=true'),
				fetch('/api/users'),
				fetch('/api/siswa'),
				fetch('/api/auth/me'),
			]);

			if (resAuth.ok) {
				const authData = await resAuth.json();
				if (authData?.user?.role) {
					setCurrentUserRole(authData.user.role);
				}
			}

			const dataKelas = resKelas.ok ? await resKelas.json() : [];
			const dataUsers = resUsers.ok ? await resUsers.json() : [];
			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

			const onlyGuru = Array.isArray(dataUsers) ? dataUsers.filter((u) => u.role === 'Guru') : [];

			setKelasList(Array.isArray(dataKelas) ? dataKelas : []);
			setGuruList(onlyGuru);
			setSiswaList(Array.isArray(dataSiswa) ? dataSiswa : []);
		} catch (err) {
			console.error('Error load data master kelas:', err);
			Swal.fire('Error', 'Gagal memuat data kelas dari server.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Count siswa aktif per kelas
	const siswaCountMap = useMemo(() => {
		const map = {};
		siswaList.forEach((s) => {
			if (s.kelas && s.status === 'Aktif') {
				map[s.kelas] = (map[s.kelas] || 0) + 1;
			}
		});
		return map;
	}, [siswaList]);

	// Filtered kelas
	const filteredKelas = useMemo(() => {
		return kelasList.filter((k) => {
			const namaKelas = (k.kelas || '').toLowerCase();
			const waliKelas = (k.wali_kelas || '').toLowerCase();
			const q = searchQuery.toLowerCase().trim();

			const matchSearch = !q || namaKelas.includes(q) || waliKelas.includes(q);

			let matchWali = true;
			if (filterWali === 'has_wali') matchWali = Boolean(k.id_wali_kelas);
			if (filterWali === 'no_wali') matchWali = !k.id_wali_kelas;

			return matchSearch && matchWali;
		});
	}, [kelasList, searchQuery, filterWali]);

	// Stats
	const totalKelas = kelasList.length;
	const kelasWithWali = useMemo(() => kelasList.filter((k) => k.id_wali_kelas).length, [kelasList]);
	const totalSiswaAktif = useMemo(() => siswaList.filter((s) => s.status === 'Aktif').length, [siswaList]);

	const openCreateModal = () => {
		if (isReadOnly) return;
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			kelas: '',
			id_wali_kelas: '',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		if (isReadOnly) return;
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			kelas: item.kelas || '',
			id_wali_kelas: item.id_wali_kelas || '',
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (isReadOnly) return;

		const namaKelas = formData.kelas.trim();
		if (!namaKelas) {
			Swal.fire('Peringatan', 'Nama kelas wajib diisi!', 'warning');
			return;
		}

		try {
			setSubmitting(true);
			const url = '/api/kelas';
			const method = isEditMode ? 'PUT' : 'POST';
			const body = isEditMode
				? { id: editId, kelas: namaKelas, id_wali_kelas: formData.id_wali_kelas || null }
				: { kelas: namaKelas, id_wali_kelas: formData.id_wali_kelas || null };

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan data kelas.');
			}

			Swal.fire({
				title: 'Berhasil!',
				text: isEditMode ? 'Data kelas berhasil diperbarui.' : 'Kelas baru berhasil ditambahkan.',
				icon: 'success',
				confirmButtonColor: '#00A693',
			});

			setIsModalOpen(false);
			loadData();
		} catch (err) {
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (item) => {
		if (isReadOnly) return;

		const jumlahSiswa = siswaCountMap[item.kelas] || 0;
		if (jumlahSiswa > 0) {
			Swal.fire({
				title: 'Kelas Tidak Dapat Dihapus',
				html: `Kelas <b>${item.kelas}</b> masih memiliki <b>${jumlahSiswa} siswa aktif</b>. Silakan pindahkan atau mutasikan siswa terlebih dahulu via menu <b>Promosi Kelas</b> sebelum menghapus kelas ini.`,
				icon: 'warning',
				confirmButtonColor: '#0D0D0D',
			});
			return;
		}

		const confirm = await Swal.fire({
			title: 'Hapus Rombel Kelas?',
			html: `Anda yakin ingin menghapus kelas <b>${item.kelas}</b> dari sistem? Tindakan ini tidak dapat dibatalkan.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus Kelas',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		try {
			const res = await fetch(`/api/kelas?id=${item.id}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menghapus kelas.');

			Swal.fire('Terhapus!', `Kelas ${item.kelas} telah berhasil dihapus.`, 'success');
			loadData();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		}
	};

	if (loading) return <Loader />;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-orange-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🏫</span> Manajemen Rombel & Kelas
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Data Kelas
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Kelola daftar rombongan belajar, tentukan guru wali kelas, dan pantau distribusi siswa aktif.
					</p>
				</div>

				<div className='flex items-center gap-3 w-full sm:w-auto'>
					{!isReadOnly && (
						<button
							onClick={openCreateModal}
							className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-3 !px-5 whitespace-nowrap shrink-0 w-full sm:w-auto'>
							<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
							</svg>
							<span>Tambah Kelas Baru</span>
						</button>
					)}
				</div>
			</div>

			{/* Read-Only Notice for Kepsek */}
			{isReadOnly && (
				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<span className='text-2xl'>🎓</span>
						<div>
							<p className='text-sm font-black text-indigo-950 uppercase'>Mode Monitoring Kepala Sekolah</p>
							<p className='text-xs text-indigo-900 font-medium'>Anda memiliki hak supervisi untuk melihat seluruh kelas, wali kelas, dan jumlah siswa aktif.</p>
						</div>
					</div>
					<span className='px-3 py-1 bg-white border border-black rounded-lg text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						Read Only
					</span>
				</div>
			)}

			{/* Statistics Cards */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Total Rombel Kelas</p>
						<p className='text-2xl font-black text-black mt-0.5'>{totalKelas} Kelas</p>
					</div>
					<span className='w-11 h-11 bg-orange-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏫
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-800'>Memiliki Wali Kelas</p>
						<p className='text-2xl font-black text-emerald-950 mt-0.5'>
							{kelasWithWali} <span className='text-sm font-bold text-gray-600'>/ {totalKelas}</span>
						</p>
					</div>
					<span className='w-11 h-11 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-yellow-800'>Siswa Aktif Terdistribusi</p>
						<p className='text-2xl font-black text-black mt-0.5'>{totalSiswaAktif} Siswa</p>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🎒
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div className='relative w-full sm:w-80'>
					<svg
						className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
						strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
					</svg>
					<input
						type='text'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder='Cari nama kelas atau wali...'
						className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
					/>
				</div>

				<div className='flex flex-wrap items-center gap-1.5 bg-yellow-100 p-1.5 border-2 border-black rounded-xl w-full sm:w-auto shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
					{[
						{ id: 'all', label: 'Semua Kelas' },
						{ id: 'has_wali', label: 'Ada Wali' },
						{ id: 'no_wali', label: 'Belum Ada Wali' },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setFilterWali(tab.id)}
							className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap border-2 ${
								filterWali === tab.id
									? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#F5C518]'
									: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200'
							}`}>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Nama Kelas / Rombel
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Wali Kelas
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider text-center'>
									Jumlah Siswa Aktif
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider text-right'>
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{filteredKelas.length === 0 ? (
								<tr>
									<td colSpan='4' className='px-5 py-12 text-center'>
										<span className='text-4xl block mb-2'>🏫</span>
										<p className='font-black text-base text-black'>Tidak ada kelas yang ditemukan</p>
										<p className='text-xs font-bold text-gray-500 mt-1'>
											Coba sesuaikan kata kunci pencarian atau filter wali kelas Anda.
										</p>
									</td>
								</tr>
							) : (
								filteredKelas.map((item) => {
									const jumlahSiswa = siswaCountMap[item.kelas] || 0;
									return (
										<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex items-center gap-3'>
													<span className='w-9 h-9 rounded-lg bg-yellow-300 border-2 border-black flex items-center justify-center font-black text-sm text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
														{item.kelas?.slice(0, 2)}
													</span>
													<div>
														<span className='font-black text-black text-base block'>
															{item.kelas}
														</span>
														<span className='text-[10px] font-mono font-bold text-gray-500'>
															ID: {item.id}
														</span>
													</div>
												</div>
											</td>

											<td className='px-5 py-4 whitespace-nowrap'>
												{item.wali_kelas ? (
													<div className='flex items-center gap-2'>
														<span className='w-7 h-7 rounded-full bg-emerald-400 border border-black flex items-center justify-center font-black text-xs text-black'>
															{item.wali_kelas.charAt(0).toUpperCase()}
														</span>
														<span className='font-bold text-sm text-black'>{item.wali_kelas}</span>
													</div>
												) : (
													<span className='px-2.5 py-1 text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 rounded-lg'>
														⚠️ Belum Ditentukan
													</span>
												)}
											</td>

											<td className='px-5 py-4 whitespace-nowrap text-center'>
												<Link
													href={`/admin/siswa?kelas=${encodeURIComponent(item.kelas)}`}
													title={`Lihat daftar siswa ${item.kelas}`}
													className='inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 hover:bg-yellow-300 text-black border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
													<span>🎒</span>
													<span>{jumlahSiswa} Siswa</span>
													<span className='text-[10px] text-gray-600'>&rarr;</span>
												</Link>
											</td>

											<td className='px-5 py-4 whitespace-nowrap text-right'>
												<div className='inline-flex items-center gap-2'>
													<Link
														href={`/admin/siswa?kelas=${encodeURIComponent(item.kelas)}`}
														title='Detail Siswa Kelas'
														className='p-2 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
														<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
															<path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
															<path strokeLinecap='round' strokeLinejoin='round' d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
														</svg>
													</Link>

													{!isReadOnly && (
														<>
															<button
																onClick={() => openEditModal(item)}
																title='Edit Kelas & Wali'
																className='p-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
																	<path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
																</svg>
															</button>

															<button
																onClick={() => handleDelete(item)}
																title='Hapus Kelas'
																className='p-2 bg-rose-400 hover:bg-rose-500 border-2 border-black rounded-lg text-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
																	<path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
																</svg>
															</button>
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal Form Tambah / Edit Kelas */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-md shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Header Modal */}
						<div className='bg-yellow-300 border-b-2 border-black p-5 flex items-center justify-between'>
							<h3 className='font-black text-lg text-black uppercase tracking-tight flex items-center gap-2'>
								<span>🏫</span>
								<span>{isEditMode ? 'Edit Data Kelas' : 'Tambah Rombel Kelas Baru'}</span>
							</h3>
							<button
								onClick={() => !submitting && setIsModalOpen(false)}
								className='w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-rose-400 hover:text-white transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Form Content */}
						<form onSubmit={handleSubmit} className='p-6 space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Nama Kelas / Rombel <span className='text-rose-600'>*</span>
								</label>
								<input
									type='text'
									required
									placeholder='Contoh: 10-A, 11-IPA-1, 12-IPS-2'
									value={formData.kelas}
									onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
									className='neo-input text-sm'
								/>
								<p className='text-[11px] font-bold text-gray-500 mt-1'>
									Gunakan format penamaan standar sekolah yang konsisten.
								</p>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Guru Wali Kelas
								</label>
								<select
									value={formData.id_wali_kelas}
									onChange={(e) => setFormData({ ...formData, id_wali_kelas: e.target.value })}
									className='neo-input text-sm bg-white font-bold'>
									<option value=''>-- Belum Ditentukan (Kosongkan) --</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap} (@{g.username})
										</option>
									))}
								</select>
								<p className='text-[11px] font-bold text-gray-500 mt-1'>
									Daftar guru aktif yang berhak memantau absensi & rekap nilai kelas ini.
								</p>
							</div>

							<div className='pt-4 border-t-2 border-black/10 flex justify-end gap-3'>
								<button
									type='button'
									disabled={submitting}
									onClick={() => setIsModalOpen(false)}
									className='neo-btn-outline text-xs sm:text-sm !py-2.5 !px-5'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='neo-btn-primary text-xs sm:text-sm !py-2.5 !px-6 bg-black text-white disabled:opacity-50'>
									{submitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Kelas' : 'Simpan Kelas'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
