'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';
import { useAdminAuth } from '../AdminLayoutClient';

export default function AdminMapelPage() {
	const { role: authRole } = useAdminAuth();
	const [mapelList, setMapelList] = useState([]);
	const [kbmList, setKbmList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentUserRole, setCurrentUserRole] = useState(authRole || null);

	useEffect(() => {
		if (authRole) setCurrentUserRole(authRole);
	}, [authRole]);

	const isReadOnly = currentUserRole === 'Kepala Sekolah';

	// Filters
	const [searchQuery, setSearchQuery] = useState('');

	// Modals
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		mapel: '',
	});

	const loadData = async () => {
		try {
			setLoading(true);
			const [resMapel, resKBM, resAuth] = await Promise.all([
				fetch('/api/mapel?all=true'),
				fetch('/api/penugasan').catch(() => ({ ok: false })),
				fetch('/api/auth/me'),
			]);

			if (resAuth.ok) {
				const authData = await resAuth.json();
				if (authData?.user?.role) {
					setCurrentUserRole(authData.user.role);
				}
			}

			const dataMapel = resMapel.ok ? await resMapel.json() : [];
			const dataKBM = resKBM.ok ? await resKBM.json() : [];

			setMapelList(Array.isArray(dataMapel) ? dataMapel : []);
			setKbmList(Array.isArray(dataKBM) ? dataKBM : []);
		} catch (err) {
			console.error('Error load data master mapel:', err);
			Swal.fire('Error', 'Gagal memuat data mata pelajaran dari server.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Hitung penggunaan mapel pada relasi guru_kbm jika ada
	const kbmMapelCount = useMemo(() => {
		const map = {};
		kbmList.forEach((k) => {
			if (k.mapel) {
				map[k.mapel] = (map[k.mapel] || 0) + 1;
			}
		});
		return map;
	}, [kbmList]);

	// Filtered mapel
	const filteredMapel = useMemo(() => {
		return mapelList.filter((m) => {
			const namaMapel = (m.mapel || '').toLowerCase();
			const q = searchQuery.toLowerCase().trim();
			return !q || namaMapel.includes(q);
		});
	}, [mapelList, searchQuery]);

	// Stats
	const totalMapel = mapelList.length;

	const openCreateModal = () => {
		if (isReadOnly) return;
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			mapel: '',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		if (isReadOnly) return;
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			mapel: item.mapel || '',
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (isReadOnly) return;

		const namaMapel = formData.mapel.trim();
		if (!namaMapel) {
			Swal.fire('Peringatan', 'Nama mata pelajaran wajib diisi!', 'warning');
			return;
		}

		try {
			setSubmitting(true);
			const url = '/api/mapel';
			const method = isEditMode ? 'PUT' : 'POST';
			const body = isEditMode
				? { id: editId, mapel: namaMapel }
				: { mapel: namaMapel };

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan data mata pelajaran.');
			}

			Swal.fire({
				title: 'Berhasil!',
				text: isEditMode ? 'Mata pelajaran berhasil diperbarui.' : 'Mata pelajaran baru berhasil ditambahkan.',
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

		const confirm = await Swal.fire({
			title: 'Hapus Mata Pelajaran?',
			html: `Anda yakin ingin menghapus mata pelajaran <b>${item.mapel}</b>?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus Mapel',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		try {
			const res = await fetch(`/api/mapel?id=${item.id}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menghapus mata pelajaran.');

			Swal.fire('Terhapus!', `Mata pelajaran ${item.mapel} telah berhasil dihapus.`, 'success');
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
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📚</span> Kurikulum & Mata Pelajaran
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Mata Pelajaran
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Kelola daftar mata pelajaran resmi sekolah yang dapat diampu oleh guru pada penugasan KBM.
					</p>
				</div>

				<div className='flex items-center gap-3 w-full sm:w-auto'>
					{!isReadOnly && (
						<button
							onClick={openCreateModal}
							className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-3 !px-5 whitespace-nowrap shrink-0 w-full sm:w-auto bg-black text-white'>
							<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
							</svg>
							<span>Tambah Mapel Baru</span>
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
							<p className='text-xs text-indigo-900 font-medium'>Anda dapat melihat daftar seluruh mata pelajaran terdaftar (Read Only).</p>
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
						<p className='text-xs font-black uppercase text-gray-500'>Total Mata Pelajaran</p>
						<p className='text-2xl font-black text-black mt-0.5'>{totalMapel} Mapel</p>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📚
					</span>
				</div>

				<div className='bg-teal-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-teal-800'>Penugasan KBM Terkait</p>
						<p className='text-2xl font-black text-teal-950 mt-0.5'>
							{kbmList.length} <span className='text-xs font-bold text-gray-600'>Relasi</span>
						</p>
					</div>
					<span className='w-11 h-11 bg-teal-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📋
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-800'>Status Kurikulum</p>
						<p className='text-base font-black text-emerald-950 mt-1'>Kurikulum Aktif</p>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						✅
					</span>
				</div>
			</div>

			{/* Search Bar */}
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
						placeholder='Cari nama mata pelajaran...'
						className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
					/>
				</div>

				<span className='text-xs font-bold text-gray-600'>
					Menampilkan <b>{filteredMapel.length}</b> dari {totalMapel} mata pelajaran
				</span>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Nama Mata Pelajaran
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider text-center'>
									Penggunaan di KBM
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider text-right'>
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{filteredMapel.length === 0 ? (
								<tr>
									<td colSpan='3' className='px-5 py-12 text-center'>
										<span className='text-4xl block mb-2'>📚</span>
										<p className='font-black text-base text-black'>Tidak ada mata pelajaran yang ditemukan</p>
										<p className='text-xs font-bold text-gray-500 mt-1'>
											Coba sesuaikan kata kunci pencarian Anda.
										</p>
									</td>
								</tr>
							) : (
								filteredMapel.map((item, idx) => {
									const kbmCount = kbmMapelCount[item.mapel] || 0;
									return (
										<tr key={item.id || idx} className='hover:bg-yellow-50/60 transition-colors'>
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex items-center gap-3'>
													<span className='w-9 h-9 rounded-lg bg-yellow-200 border-2 border-black flex items-center justify-center font-black text-sm text-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
														{item.mapel?.slice(0, 2).toUpperCase()}
													</span>
													<div>
														<span className='font-black text-black text-base block'>
															{item.mapel}
														</span>
														<span className='text-[10px] font-mono font-bold text-gray-500'>
															ID: {item.id}
														</span>
													</div>
												</div>
											</td>

											<td className='px-5 py-4 whitespace-nowrap text-center'>
												<span className='inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 border border-black rounded-lg text-xs font-black text-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
													<span>📋</span>
													<span>{kbmCount} Penugasan KBM</span>
												</span>
											</td>

											<td className='px-5 py-4 whitespace-nowrap text-right'>
												<div className='inline-flex items-center gap-2'>
													{!isReadOnly && (
														<>
															<button
																onClick={() => openEditModal(item)}
																title='Edit Mata Pelajaran'
																className='p-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
																	<path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
																</svg>
															</button>

															<button
																onClick={() => handleDelete(item)}
																title='Hapus Mata Pelajaran'
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

			{/* Modal Form Tambah / Edit Mapel */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-md shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Header Modal */}
						<div className='bg-yellow-300 border-b-2 border-black p-5 flex items-center justify-between'>
							<h3 className='font-black text-lg text-black uppercase tracking-tight flex items-center gap-2'>
								<span>📚</span>
								<span>{isEditMode ? 'Edit Mata Pelajaran' : 'Tambah Mapel Baru'}</span>
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
									Nama Mata Pelajaran <span className='text-rose-600'>*</span>
								</label>
								<input
									type='text'
									required
									placeholder='Contoh: Matematika, Fisika, Bahasa Indonesia'
									value={formData.mapel}
									onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
									className='neo-input text-sm'
								/>
								<p className='text-[11px] font-bold text-gray-500 mt-1'>
									Nama mata pelajaran resmi sesuai kurikulum sekolah.
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
									{submitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Mapel' : 'Simpan Mapel'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
