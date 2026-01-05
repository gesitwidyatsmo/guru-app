'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SectionHeader from '../components/SectionHeader';

export default function MapelPage() {
	// --- STATE ---
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true); // Loading awal halaman
	const [saving, setSaving] = useState(false); // Loading saat simpan/hapus

	// State Filter/Search
	const [searchQuery, setSearchQuery] = useState('');

	// State Modal Form
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [formData, setFormData] = useState({ id: '', mapel: '' });

	// --- FETCH DATA ---
	const fetchMapel = async () => {
		try {
			const res = await fetch('/api/mapel');
			const data = res.ok ? await res.json() : [];
			setMapelList(data);
		} catch (err) {
			console.error('Error fetching mapel:', err);
			Swal.fire('Error', 'Gagal memuat data mata pelajaran', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchMapel();
	}, []);

	// --- FILTERING ---
	const filteredMapel = mapelList.filter((item) => item.mapel.toLowerCase().includes(searchQuery.toLowerCase()));

	// --- HANDLERS ---
	const handleOpenModal = (item = null) => {
		if (item) {
			setIsEditMode(true);
			setFormData({ id: item.id, mapel: item.mapel });
		} else {
			setIsEditMode(false);
			setFormData({ id: '', mapel: '' });
		}
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.mapel.trim()) {
			Swal.fire('Peringatan', 'Nama Mata Pelajaran tidak boleh kosong', 'warning');
			return;
		}

		setSaving(true);
		try {
			const method = isEditMode ? 'PUT' : 'POST';
			const res = await fetch('/api/mapel', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			if (res.ok) {
				await fetchMapel(); // Refresh data
				setIsModalOpen(false);
				Swal.fire({
					icon: 'success',
					title: 'Berhasil',
					text: `Mata pelajaran berhasil ${isEditMode ? 'diperbarui' : 'ditambahkan'}`,
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				throw new Error('Gagal menyimpan data');
			}
		} catch (error) {
			Swal.fire('Error', error.message, 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id, namaMapel) => {
		const result = await Swal.fire({
			title: 'Hapus Mata Pelajaran?',
			text: `Anda akan menghapus "${namaMapel}". Data tidak dapat dikembalikan.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444', // Merah
			cancelButtonColor: '#6B7280', // Abu-abu
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			setSaving(true); // Tampilkan indikator loading global atau lokal
			try {
				const res = await fetch('/api/mapel', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id }),
				});

				if (res.ok) {
					setMapelList((prev) => prev.filter((item) => item.id !== id));
					Swal.fire('Terhapus!', 'Mata pelajaran telah dihapus.', 'success');
				} else {
					throw new Error('Gagal menghapus data');
				}
			} catch (error) {
				Swal.fire('Error', 'Terjadi kesalahan saat menghapus data', 'error');
			} finally {
				setSaving(false);
			}
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-gray-50/50 p-6 space-y-6'>
			{/* Header Section */}
			<SectionHeader
				// title={'Riwayat Absensi'}
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
			<div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
				<div>
					<h1 className='text-2xl font-bold text-gray-800'>Mata Pelajaran</h1>
					<p className='text-sm text-gray-500 mt-1'>Kelola daftar mata pelajaran sekolah</p>
				</div>

				<div className='flex w-full md:w-auto gap-3'>
					{/* Search Input */}
					<div className='relative flex-1 md:w-64'>
						<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
							<MagnifyingGlassIcon className='h-5 w-5 text-gray-400' />
						</div>
						<input
							type='text'
							placeholder='Cari Mapel...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white'
						/>
					</div>

					<button
						onClick={() => handleOpenModal()}
						className='px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 whitespace-nowrap'>
						<PlusIcon className='w-5 h-5' />
						<span>Tambah Baru</span>
					</button>
				</div>
			</div>

			{/* Data List Section */}
			<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'>
				{filteredMapel.length === 0 ? (
					<div className='p-12 text-center flex flex-col items-center justify-center text-gray-500'>
						<div className='bg-gray-100 p-4 rounded-full mb-4'>
							<MagnifyingGlassIcon className='w-8 h-8 text-gray-400' />
						</div>
						<p className='font-medium'>{searchQuery ? `Tidak ada mapel bernama "${searchQuery}"` : 'Belum ada data mata pelajaran.'}</p>
					</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead className='bg-gray-50/50 border-b border-gray-100'>
								<tr>
									<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 text-center'>No</th>
									<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider'>Nama Mata Pelajaran</th>
									<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right'>Aksi</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-50'>
								{filteredMapel.map((item, index) => (
									<tr
										key={item.id}
										className='hover:bg-indigo-50/30 transition-colors group'>
										<td className='px-6 py-4 text-center text-gray-400 text-sm font-medium'>{index + 1}</td>
										<td className='px-6 py-4'>
											<span className='text-gray-800 font-medium text-sm'>{item.mapel}</span>
										</td>
										<td className='px-6 py-4 text-right'>
											<div className='flex justify-end gap-2'>
												<button
													onClick={() => handleOpenModal(item)}
													disabled={saving}
													className='p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group-hover:bg-white border border-transparent group-hover:border-indigo-100'
													title='Edit'>
													<PencilSquareIcon className='w-5 h-5' />
												</button>
												<button
													onClick={() => handleDelete(item.id, item.mapel)}
													disabled={saving}
													className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors group-hover:bg-white border border-transparent group-hover:border-red-100'
													title='Hapus'>
													<TrashIcon className='w-5 h-5' />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Modal Form */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity'>
					<div className='bg-white w-full max-w-md rounded-2xl shadow-2xl transform transition-all animate-fade-in-up overflow-hidden'>
						<div className='p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center'>
							<h3 className='text-lg font-bold text-gray-800'>{isEditMode ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='text-gray-400 hover:text-gray-600 transition-colors'>
								✕
							</button>
						</div>

						<form
							onSubmit={handleSubmit}
							className='p-6 space-y-4'>
							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-2'>
									Nama Mata Pelajaran <span className='text-red-500'>*</span>
								</label>
								<input
									type='text'
									value={formData.mapel}
									onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
									placeholder='Contoh: Matematika Wajib'
									className='w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800 placeholder:text-gray-400'
									autoFocus
								/>
							</div>

							<div className='pt-4 flex gap-3 justify-end'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors text-sm'
									disabled={saving}>
									Batal
								</button>
								<button
									type='submit'
									disabled={saving}
									className='px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2'>
									{saving && (
										<svg
											className='animate-spin h-4 w-4 text-white'
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'>
											<circle
												className='opacity-25'
												cx='12'
												cy='12'
												r='10'
												stroke='currentColor'
												strokeWidth='4'></circle>
											<path
												className='opacity-75'
												fill='currentColor'
												d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
										</svg>
									)}
									{saving ? 'Menyimpan...' : 'Simpan'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
