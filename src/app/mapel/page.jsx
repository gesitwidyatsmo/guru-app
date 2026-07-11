'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SectionHeader from '../components/SectionHeader';
import { createClient } from '@/utils/supabase/client';

export default function MapelPage() {
	// --- STATE ---
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true); // Loading awal halaman
	const [saving, setSaving] = useState(false); // Loading saat simpan/hapus

	const [userRole, setUserRole] = useState('');
	const [allClasses, setAllClasses] = useState([]);
	const [allMapels, setAllMapels] = useState([]);
	const [myKBM, setMyKBM] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [showChecklistModal, setShowChecklistModal] = useState(false);

	// State Filter/Search
	const [searchQuery, setSearchQuery] = useState('');

	// State Modal Form
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [formData, setFormData] = useState({ id: '', mapel: '' });

	// --- FETCH DATA ---
	const fetchMapel = async () => {
		try {
			const supabase = createClient();
			
			// 1. Ambil Profil User
			const { data: { user } } = await supabase.auth.getUser();
			let role = '';
			let userId = '';
			if (user) {
				const { data: profile } = await supabase.from('users').select('id_user, role').eq('auth_id', user.id).single();
				if (profile) {
					role = profile.role || '';
					userId = profile.id_user;
					setUserRole(role);
				}
			}

			// 2. Tampilkan Mapel List Regular (Filter Guru berlaku)
			let query = supabase.from('mapel').select('*').order('mapel', { ascending: true });
			if (role === 'Guru' && userId) {
				const { data: kbmData } = await supabase.from('guru_kbm').select('mapel').eq('id_user', userId);
				const allowedMapels = kbmData ? [...new Set(kbmData.map(r => r.mapel).filter(val => val && val.trim() !== ''))] : [];
				if (allowedMapels.length > 0) {
					query = query.in('mapel', allowedMapels);
				} else {
					query = null;
					setMapelList([]);
				}
			}
			
			if (query) {
				const { data: mapelData } = await query;
				if (mapelData) setMapelList(mapelData);
			}

			// 3. Tarik Master penuh dan Profil Centang jika ia seorang Guru
			if (role === 'Guru') {
				const { data: dataAllMapel } = await supabase.from('mapel').select('*').order('mapel', { ascending: true });
				if (dataAllMapel) setAllMapels(dataAllMapel);

				const { data: dataAllKelas } = await supabase.from('kelas').select('*').order('nama_kelas', { ascending: true });
				if (dataAllKelas) setAllClasses(dataAllKelas);

				const { data: myData } = await supabase.from('guru_kbm').select('id_kbm, kelas, mapel').eq('id_user', userId).order('kelas').order('mapel');
				if (myData) {
					setMyKBM(myData);
				}
			}
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

	// --- HANDLER GURU (KBM EKSPLISIT) --- //
	const refreshKBM = async () => {
		const res = await fetch('/api/kbm/mandiri');
		if (res.ok) {
			const data = await res.json();
			setMyKBM(data);
			// Refresh Grid Layar
			fetchMapel();
		}
	};

	const submitKBM = async (e) => {
		e.preventDefault();
		if (!selectedKelas || !selectedMapel) return;
		setSaving(true);
		try {
			const res = await fetch('/api/kbm/mandiri', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kelas: selectedKelas, mapel: selectedMapel }),
			});
			if (res.ok) {
				setSelectedKelas('');
				setSelectedMapel('');
				await refreshKBM();
				Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: 'Penugasan baru telah ditambahkan.',
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				const err = await res.json();
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menambahkan',
					text: err.error || 'Terjadi kesalahan.',
				});
			}
		} catch (e) {
			console.error(e);
		}
		setSaving(false);
	};

	const hapusKBM = async (id_kbm) => {
		const result = await Swal.fire({
			title: 'Hapus penugasan ini?',
			text: 'Data tidak dapat dikembalikan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			setSaving(true);
			try {
				const res = await fetch(`/api/kbm/mandiri?id_kbm=${id_kbm}`, { method: 'DELETE' });
				if (res.ok) {
					await refreshKBM();
					Swal.fire('Terhapus!', 'Penugasan telah dihapus.', 'success');
				} else {
					Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
				}
			} catch (e) {
				console.error(e);
				Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
			}
			setSaving(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-gray-50/50 p-6 space-y-6'>
			{/* Header Section */}
			<SectionHeader
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

					{userRole === 'Admin' ? (
						<button
							onClick={() => handleOpenModal()}
							className='px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 whitespace-nowrap'>
							<PlusIcon className='w-5 h-5' />
							<span>Tambah Baru</span>
						</button>
					) : (
						<button
							onClick={() => setShowChecklistModal(true)}
							className='px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 whitespace-nowrap'>
							<span>☑ Ceklis Ajar</span>
						</button>
					)}
				</div>
			</div>

			{/* Data List Section */}
			<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'>
				{filteredMapel.length === 0 ? (
					<div className='p-12 text-center flex flex-col items-center justify-center text-gray-500'>
						<div className='bg-gray-50 p-4 rounded-full mb-4 border border-gray-100'>
							<MagnifyingGlassIcon className='w-8 h-8 text-gray-300' />
						</div>
						{userRole === 'Guru' && !searchQuery ? (
							<p className='font-medium'>Silakan atur kelas yang Anda ajar dengan mengklik <span className='font-bold text-indigo-600'>☑ Ceklis Ajar</span> di pojok kanan atas.</p>
						) : (
							<p className='font-medium'>{searchQuery ? `Tidak ada mapel bernama "${searchQuery}"` : 'Belum ada data mata pelajaran.'}</p>
						)}
					</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead className='bg-gray-50/50 border-b border-gray-100'>
								<tr>
									<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 text-center'>No</th>
									<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider'>Nama Mata Pelajaran</th>
									{userRole === 'Admin' && (
										<th className='px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right'>Aksi</th>
									)}
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
										{userRole === 'Admin' && (
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
										)}
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

			{/* Popup Modal untuk Atur Penugasan Guru (Eksplisit) */}
			{userRole === 'Guru' && isModalOpen === false && (
				<div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity ${showChecklistModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
					<div className={`bg-white w-full max-w-md rounded-2xl shadow-2xl transform transition-all flex flex-col ${showChecklistModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} style={{ maxHeight: '90vh' }}>
						<div className='p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center rounded-t-2xl shrink-0'>
							<h3 className='text-lg font-bold text-gray-800'>Atur Penugasan Anda</h3>
							<button
								onClick={() => setShowChecklistModal(false)}
								className='text-gray-400 hover:text-gray-600 transition-colors'>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						
						<div className='p-5 overflow-y-auto grow custom-scrollbar'>
							{/* Form Tambah Penugasan */}
							<form onSubmit={submitKBM} className='mb-6'>
								<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>Tambah Penugasan Baru</h3>
								<div className='flex flex-col gap-3 mb-5'>
									<div className='flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all'>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400 mr-2 shrink-0">
											<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
										</svg>
										<select
											required
											value={selectedKelas}
											onChange={(e) => setSelectedKelas(e.target.value)}
											className='flex-1 bg-transparent text-gray-700 border-0 rounded-lg py-2 focus:ring-0 outline-none'>
											<option value='' disabled>Pilih Kelas...</option>
											{allClasses.map((item) => (
												<option key={item.id} value={item.nama_kelas}>{item.nama_kelas}</option>
											))}
										</select>
									</div>
									
									<div className='flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all'>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400 mr-2 shrink-0">
											<path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
										</svg>
										<select
											required
											value={selectedMapel}
											onChange={(e) => setSelectedMapel(e.target.value)}
											className='flex-1 bg-transparent text-gray-700 border-0 rounded-lg py-2 focus:ring-0 outline-none'>
											<option value='' disabled>Pilih Mapel...</option>
											{allMapels.map((item) => (
												<option key={item.id} value={item.mapel}>{item.mapel}</option>
											))}
										</select>
									</div>
								</div>
								<button
									type='submit'
									disabled={saving || !selectedKelas || !selectedMapel}
									className='bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-indigo-300 disabled:to-indigo-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl w-full font-bold flex justify-center items-center gap-2 transition-all shadow-md text-sm'>
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
									</svg>
									{saving ? 'Menambahkan...' : 'Tambahkan Ke Jadwal'}
								</button>
							</form>

							{/* Daftar Penugasan Saat Ini */}
							<div className='border-t border-gray-100 pt-5 mt-2'>
								<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>Daftar Penugasan Aktif</h3>
								<div className='space-y-2'>
									{myKBM.length === 0 ? (
										<p className='text-gray-400 text-sm italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed'>Belum ada jadwal penugasan.</p>
									) : (
										myKBM.map((kbm) => (
											<div key={kbm.id_kbm} className='flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm'>
												<div className='flex flex-col'>
													<span className='font-bold text-indigo-600'>{kbm.kelas}</span>
													<span className='text-sm text-gray-500 font-medium'>{kbm.mapel}</span>
												</div>
												<button 
													type='button'
													onClick={() => hapusKBM(kbm.id_kbm)}
													disabled={saving}
													className='text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition disabled:opacity-50'>
													<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
														<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
													</svg>
												</button>
											</div>
										))
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
