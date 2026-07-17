'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { ChevronLeft, Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function MapelPage() {
	// --- STATE ---
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

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
			Swal.fire({
				title: 'ERROR',
				text: 'Gagal memuat data mata pelajaran',
				icon: 'error',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
					title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
					htmlContainer: 'font-bold text-[#0D0D0D]',
					confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
				}
			});
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
			Swal.fire({
				title: 'PERINGATAN',
				text: 'Nama Mata Pelajaran tidak boleh kosong!',
				icon: 'warning',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
					title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
					htmlContainer: 'font-bold text-[#0D0D0D]',
					confirmButton: 'bg-[#F5C518] text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
				}
			});
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
				await fetchMapel();
				setIsModalOpen(false);
				Swal.fire({
					icon: 'success',
					title: 'BERHASIL',
					text: `Mata pelajaran berhasil ${isEditMode ? 'diperbarui' : 'ditambahkan'}`,
					timer: 1500,
					showConfirmButton: false,
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
						title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
						htmlContainer: 'font-bold text-[#0D0D0D]'
					}
				});
			} else {
				throw new Error('Gagal menyimpan data');
			}
		} catch (error) {
			Swal.fire({
				title: 'ERROR',
				text: error.message,
				icon: 'error',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
					title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
					htmlContainer: 'font-bold text-[#0D0D0D]',
					confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
				}
			});
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id, namaMapel) => {
		const result = await Swal.fire({
			title: 'HAPUS MAPEL?',
			text: `Anda akan menghapus "${namaMapel}". Data tidak dapat dikembalikan.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
				title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
				htmlContainer: 'font-bold text-[#0D0D0D]',
				confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all mr-2',
				cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
			}
		});

		if (result.isConfirmed) {
			setSaving(true);
			try {
				const res = await fetch('/api/mapel', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id }),
				});

				if (res.ok) {
					setMapelList((prev) => prev.filter((item) => item.id !== id));
					Swal.fire({
						icon: 'success',
						title: 'TERHAPUS!',
						text: 'Mata pelajaran telah dihapus.',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
							title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
							htmlContainer: 'font-bold text-[#0D0D0D]',
							confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
						}
					});
				} else {
					throw new Error('Gagal menghapus data');
				}
			} catch (error) {
				Swal.fire({
					icon: 'error',
					title: 'ERROR',
					text: 'Terjadi kesalahan saat menghapus data.',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
						title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
						htmlContainer: 'font-bold text-[#0D0D0D]',
						confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
					}
				});
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
					title: 'BERHASIL!',
					text: 'Penugasan baru telah ditambahkan.',
					timer: 1500,
					showConfirmButton: false,
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
						title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
						htmlContainer: 'font-bold text-[#0D0D0D]'
					}
				});
			} else {
				const err = await res.json();
				Swal.fire({
					icon: 'error',
					title: 'GAGAL',
					text: err.error || 'Terjadi kesalahan.',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
						title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
						htmlContainer: 'font-bold text-[#0D0D0D]',
						confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
					}
				});
			}
		} catch (e) {
			console.error(e);
		}
		setSaving(false);
	};

	const hapusKBM = async (id_kbm) => {
		const result = await Swal.fire({
			title: 'HAPUS PENUGASAN?',
			text: 'Data tidak dapat dikembalikan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
				title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
				htmlContainer: 'font-bold text-[#0D0D0D]',
				confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all mr-2',
				cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
			}
		});

		if (result.isConfirmed) {
			setSaving(true);
			try {
				const res = await fetch(`/api/kbm/mandiri?id_kbm=${id_kbm}`, { method: 'DELETE' });
				if (res.ok) {
					await refreshKBM();
					Swal.fire({
						icon: 'success',
						title: 'TERHAPUS!',
						text: 'Penugasan telah dihapus.',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
							title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
							htmlContainer: 'font-bold text-[#0D0D0D]',
							confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
						}
					});
				} else {
					Swal.fire({
						icon: 'error',
						title: 'GAGAL',
						text: 'Terjadi kesalahan saat menghapus.',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
							title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
							htmlContainer: 'font-bold text-[#0D0D0D]',
							confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
						}
					});
				}
			} catch (e) {
				console.error(e);
			}
			setSaving(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] -rotate-2 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>MATA PELAJARAN</h1>
					</div>
				</div>

				<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-none'>
					<div className='w-full md:w-auto flex flex-col gap-2'>
						<h1 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>Manajemen</h1>
						<p className='text-sm font-bold text-[#0D0D0D] bg-[#FF90E8] border-[2px] border-[#0D0D0D] px-2 py-1 inline-block w-fit'>Kelola daftar mata pelajaran</p>
					</div>

					<div className='flex flex-col sm:flex-row w-full md:w-auto gap-4'>
						{/* Search Input */}
						<div className='relative flex-1 md:w-64 flex items-center'>
							<div className='absolute left-4 pointer-events-none'>
								<Search className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
							</div>
							<input
								type='text'
								placeholder='CARI MAPEL...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='pl-14 pr-4 h-[60px] w-full border-[4px] border-[#0D0D0D] rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all bg-white placeholder:text-gray-400'
							/>
						</div>

						{userRole === 'Admin' ? (
							<button
								onClick={() => handleOpenModal()}
								className='h-[60px] px-6 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] rounded-none font-black text-sm hover:-translate-y-1 transition-all shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center gap-2 whitespace-nowrap uppercase tracking-widest'>
								<Plus className='w-6 h-6' strokeWidth={3} />
								<span>Tambah Baru</span>
							</button>
						) : (
							<button
								onClick={() => setShowChecklistModal(true)}
								className='h-[60px] px-6 bg-[#F5C518] text-[#0D0D0D] border-[4px] border-[#0D0D0D] rounded-none font-black text-sm hover:-translate-y-1 transition-all shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center gap-2 whitespace-nowrap uppercase tracking-widest'>
								<Filter className='w-6 h-6' strokeWidth={3} />
								<span>CEKLIS AJAR</span>
							</button>
						)}
					</div>
				</div>

				{/* Data List Section */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
					{filteredMapel.length === 0 ? (
						<div className='p-12 text-center flex flex-col items-center justify-center border-b-[4px] border-[#0D0D0D] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")]'>
							<div className='bg-[#E8451A] p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] mb-4'>
								<Search className='w-8 h-8 text-white' strokeWidth={3} />
							</div>
							{userRole === 'Guru' && !searchQuery ? (
								<p className='font-black text-[#0D0D0D] uppercase tracking-widest'>SILAKAN ATUR KELAS YANG ANDA AJAR DENGAN MENGKLIK <span className='bg-[#F5C518] px-2 border-[2px] border-[#0D0D0D]'>CEKLIS AJAR</span></p>
							) : (
								<p className='font-black text-[#0D0D0D] uppercase tracking-widest text-lg'>{searchQuery ? `TIDAK ADA MAPEL "${searchQuery}"` : 'BELUM ADA DATA MAPEL.'}</p>
							)}
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse'>
								<thead className='bg-[#0D0D0D] text-white border-b-[4px] border-[#0D0D0D]'>
									<tr>
										<th className='px-6 py-4 text-xs font-black uppercase tracking-widest w-16 text-center'>No</th>
										<th className='px-6 py-4 text-xs font-black uppercase tracking-widest'>Nama Mata Pelajaran</th>
										{userRole === 'Admin' && (
											<th className='px-6 py-4 text-xs font-black uppercase tracking-widest text-right'>Aksi</th>
										)}
									</tr>
								</thead>
								<tbody className='divide-y-[3px] divide-[#0D0D0D] bg-white'>
									{filteredMapel.map((item, index) => (
										<tr
											key={item.id}
											className='hover:bg-[#FFF5F0] transition-colors group'>
											<td className='px-6 py-4 text-center font-black text-[#0D0D0D]'>{index + 1}</td>
											<td className='px-6 py-4'>
												<span className='font-black text-sm uppercase text-[#0D0D0D] tracking-wider'>{item.mapel}</span>
											</td>
											{userRole === 'Admin' && (
												<td className='px-6 py-4 text-right'>
													<div className='flex justify-end gap-3'>
														<button
															onClick={() => handleOpenModal(item)}
															disabled={saving}
															className='p-3 bg-[#A3E635] text-[#0D0D0D] border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
															title='Edit'>
															<Edit2 className='w-5 h-5' strokeWidth={3} />
														</button>
														<button
															onClick={() => handleDelete(item.id, item.mapel)}
															disabled={saving}
															className='p-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
															title='Hapus'>
															<Trash2 className='w-5 h-5' strokeWidth={3} />
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

				{/* Modal Form Admin */}
				{isModalOpen && (
					<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity'>
						<div className='bg-[#FFF5F0] w-full max-w-md border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none transform transition-all overflow-hidden'>
							<div className='p-6 border-b-[4px] border-[#0D0D0D] bg-[#2F80ED] flex justify-between items-center'>
								<h3 className='text-xl font-black text-white uppercase tracking-widest'>{isEditMode ? 'EDIT MAPEL' : 'TAMBAH MAPEL'}</h3>
								<button
									onClick={() => setIsModalOpen(false)}
									className='w-10 h-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
									✕
								</button>
							</div>

							<form
								onSubmit={handleSubmit}
								className='p-6 space-y-6'>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										NAMA MAPEL <span className='text-[#E8451A]'>*</span>
									</label>
									<input
										type='text'
										value={formData.mapel}
										onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
										placeholder='CONTOH: MATEMATIKA'
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all placeholder:text-gray-400'
										autoFocus
									/>
								</div>

								<div className='pt-4 flex gap-4 justify-end'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='h-[60px] px-6 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
										disabled={saving}>
										BATAL
									</button>
									<button
										type='submit'
										disabled={saving}
										className='h-[60px] px-6 bg-[#A3E635] text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all disabled:opacity-70 disabled:cursor-not-allowed'>
										{saving ? 'MENYIMPAN...' : 'SIMPAN'}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Popup Modal Guru (Ceklis Ajar) */}
				{userRole === 'Guru' && isModalOpen === false && (
					<div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity ${showChecklistModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
						<div className={`bg-[#FFF5F0] w-full max-w-md border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none transform transition-all flex flex-col ${showChecklistModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} style={{ maxHeight: '90vh' }}>
							<div className='p-6 border-b-[4px] border-[#0D0D0D] bg-[#F5C518] flex justify-between items-center shrink-0'>
								<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>ATUR PENUGASAN</h3>
								<button
									onClick={() => setShowChecklistModal(false)}
									className='w-10 h-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
									✕
								</button>
							</div>
							
							<div className='p-6 overflow-y-auto grow custom-scrollbar'>
								{/* Form Tambah Penugasan */}
								<form onSubmit={submitKBM} className='mb-8'>
									<h3 className='text-sm font-black text-[#0D0D0D] bg-[#FF90E8] border-[2px] border-[#0D0D0D] px-2 py-1 inline-block uppercase tracking-widest mb-4'>TAMBAH PENUGASAN BARU</h3>
									<div className='flex flex-col gap-4 mb-6'>
										<select
											required
											value={selectedKelas}
											onChange={(e) => setSelectedKelas(e.target.value)}
											className='h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all appearance-none cursor-pointer'>
											<option value='' disabled>PILIH KELAS...</option>
											{allClasses.map((item) => (
												<option key={item.id} value={item.nama_kelas}>{item.nama_kelas}</option>
											))}
										</select>
										
										<select
											required
											value={selectedMapel}
											onChange={(e) => setSelectedMapel(e.target.value)}
											className='h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all appearance-none cursor-pointer'>
											<option value='' disabled>PILIH MAPEL...</option>
											{allMapels.map((item) => (
												<option key={item.id} value={item.mapel}>{item.mapel}</option>
											))}
										</select>
									</div>
									<button
										type='submit'
										disabled={saving || !selectedKelas || !selectedMapel}
										className='h-[60px] w-full bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
										<Plus className="w-6 h-6" strokeWidth={3} />
										{saving ? 'MENAMBAHKAN...' : 'TAMBAH KE JADWAL'}
									</button>
								</form>

								{/* Daftar Penugasan Saat Ini */}
								<div className='border-t-[4px] border-[#0D0D0D] pt-6'>
									<h3 className='text-sm font-black text-[#0D0D0D] bg-[#A3E635] border-[2px] border-[#0D0D0D] px-2 py-1 inline-block uppercase tracking-widest mb-4'>DAFTAR PENUGASAN AKTIF</h3>
									<div className='space-y-4'>
										{myKBM.length === 0 ? (
											<div className='p-6 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-center font-black uppercase tracking-widest text-[#0D0D0D] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")]'>
												BELUM ADA JADWAL.
											</div>
										) : (
											myKBM.map((kbm) => (
												<div key={kbm.id_kbm} className='flex items-center justify-between p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
													<div className='flex flex-col'>
														<span className='font-black text-xl text-[#0D0D0D] uppercase'>{kbm.kelas}</span>
														<span className='text-sm font-bold text-[#0D0D0D] uppercase bg-[#F5C518] px-1 border-[2px] border-[#0D0D0D] w-fit mt-1'>{kbm.mapel}</span>
													</div>
													<button 
														type='button'
														onClick={() => hapusKBM(kbm.id_kbm)}
														disabled={saving}
														className='p-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none disabled:opacity-50'>
														<Trash2 className="w-5 h-5" strokeWidth={3} />
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
		</div>
	);
}
