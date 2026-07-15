'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { createClient } from '@/utils/supabase/client';

export default function JurnalPage() {
	const router = useRouter();

	// --- STATE MANAGEMENT ---
	const [journals, setJournals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterKelas, setFilterKelas] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	const [userRole, setUserRole] = useState('');
	const [userId, setUserId] = useState('');

	// State Form Modal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);

	// Data Master
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);

	// Form Data
	const initialForm = {
		id: '',
		tanggal: new Date().toISOString().slice(0, 10),
		jam_ke: '',
		pertemuan_ke: '', // Field Baru
		kelas: '',
		mapel: '',
		materi: '',
		kegiatan: '',
		hambatan: '',
		solusi: '',
		dokumentasi: null,
		tuntas: false,
	};
	const [formData, setFormData] = useState(initialForm);

	// --- 1. FETCH DATA ---
	useEffect(() => {
		const fetchData = async () => {
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) {
					router.push('/login');
					return;
				}
				
				const { data: profile } = await supabase.from('users').select('id_user, role').eq('auth_id', user.id).single();
				let currentUserId = '';
				let currentUserRole = '';
				if (profile) {
					currentUserId = profile.id_user;
					currentUserRole = profile.role;
					setUserId(currentUserId);
					setUserRole(currentUserRole);
				} else {
					router.push('/login');
					return;
				}
				
				const { data: kelasData } = await supabase.from('kelas').select('*').order('nama_kelas', { ascending: true });
				setKelasList(kelasData || []);
				
				const { data: mapelData } = await supabase.from('mapel').select('*').order('mapel', { ascending: true });
				setMapelList(mapelData || []);

				const fetchedJournals = await refreshJurnal(currentUserId, currentUserRole);

				// Auto-open modal from query params
				const searchParams = new URLSearchParams(window.location.search);
				if (searchParams.get('action') === 'new') {
					const qMapel = searchParams.get('mapel') || '';
					const qKelas = searchParams.get('kelas') || '';
					const qJam = searchParams.get('jam_ke') || '';

					const existingCount = fetchedJournals.filter((j) => j.kelas === qKelas && j.mapel === qMapel).length;
					const suggestion = existingCount + 1;

					setFormData((prev) => ({
						...prev,
						mapel: qMapel,
						kelas: qKelas,
						jam_ke: qJam,
						pertemuan_ke: suggestion.toString()
					}));
					setIsModalOpen(true);
				}
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	const refreshJurnal = async (uid = userId, role = userRole) => {
		try {
			const supabase = createClient();
			let query = supabase.from('jurnal').select('*').order('tanggal', { ascending: false });
			if (role === 'Guru' && uid) {
				query = query.eq('guru_id', uid);
			}
			const { data, error } = await query;
			if (!error) {
				setJournals(data || []);
				return data || [];
			}
		} catch (error) {
			console.error('Gagal memuat jurnal:', error);
		}
		return [];
	};

	// --- LOGIC AUTO-SUGGEST PERTEMUAN ---
	const calculateMeeting = (cls, mpl) => {
		// Hanya jalankan jika mode tambah baru (bukan edit)
		if (isEditing || !cls || !mpl) return;

		// Hitung jumlah jurnal yang sudah ada untuk kelas & mapel ini
		const existingCount = journals.filter((j) => j.kelas === cls && j.mapel === mpl).length;

		// Saran = Jumlah data + 1
		const suggestion = existingCount + 1;

		setFormData((prev) => ({
			...prev,
			pertemuan_ke: suggestion.toString(),
		}));
	};

	// --- HANDLERS ---
	const handleOpenModal = (journal = null) => {
		if (journal) {
			// Mode Edit
			setIsEditing(true);
			setFormData(journal);
		} else {
			// Mode Tambah Baru
			setIsEditing(false);
			setFormData(initialForm);
		}
		setIsModalOpen(true);
	};

	const handleDelete = async (id) => {
		const result = await Swal.fire({
			title: 'Hapus Jurnal?',
			text: 'Data yang dihapus tidak bisa dikembalikan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const supabase = createClient();
				const { error } = await supabase.from('jurnal').delete().eq('id', id);
				if (error) throw error;
				
				Swal.fire('Terhapus!', 'Jurnal berhasil dihapus.', 'success');
				refreshJurnal();
			} catch (err) {
				Swal.fire('Error', 'Terjadi kesalahan saat menghapus.', 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		try {
			const supabase = createClient();
			
			if (isEditing) {
				const { id, pertemuan_ke, ...others } = formData;
				const updates = { ...others };
				if (pertemuan_ke !== undefined) updates.pertemuan_ke = pertemuan_ke;
				if (updates.tuntas !== undefined) updates.tuntas = !!updates.tuntas;
				
				const { error } = await supabase.from('jurnal').update(updates).eq('id', id);
				if (error) throw error;
			} else {
				const newId = Math.random().toString(36).substring(2, 11);
				const insertData = {
					id: newId,
					guru_id: userId || null,
					tanggal: formData.tanggal,
					jam_ke: formData.jam_ke || '',
					pertemuan_ke: formData.pertemuan_ke || '',
					kelas: formData.kelas,
					mapel: formData.mapel,
					materi: formData.materi,
					kegiatan: formData.kegiatan || '',
					hambatan: formData.hambatan || '',
					solusi: formData.solusi || '',
					tuntas: !!formData.tuntas,
				};
				const { error } = await supabase.from('jurnal').insert(insertData);
				if (error) throw error;
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: `Jurnal berhasil ${isEditing ? 'diperbarui' : 'disimpan'}`,
				timer: 1500,
				showConfirmButton: false,
			});
			setIsModalOpen(false);
			refreshJurnal();
		} catch (err) {
			Swal.fire('Error', 'Gagal menyimpan data jurnal.', 'error');
		} finally {
			setSaving(false);
		}
	};

	const filteredJournals = journals.filter((j) => {
		const matchKelas = filterKelas === 'Semua' || j.kelas === filterKelas;
		const matchSearch =
			searchQuery === '' ||
			[j.materi, j.kegiatan, j.mapel, j.kelas, j.hambatan, j.solusi]
				.filter(Boolean)
				.some((field) => field.toString().toLowerCase().includes(searchQuery.toLowerCase()));
		return matchKelas && matchSearch;
	});

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20'>
			{/* Header Brutalist */}
			<div className='bg-[#E8451A] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
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
								<h1 className='text-4xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D] mb-2'>Jurnal Guru</h1>
								<p className='text-white font-black tracking-widest uppercase bg-[#0D0D0D] inline-block px-3 py-1 border-[2px] border-white text-xs sm:text-sm'>Catat aktivitas harian</p>
							</div>
						</div>
                        <button
                            onClick={() => handleOpenModal()}
                            className='w-full md:w-auto bg-[#00A693] text-white px-8 py-4 font-black shadow-[6px_6px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] flex items-center justify-center gap-3 whitespace-nowrap uppercase tracking-widest hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[10px_10px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none text-lg'>
                            <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={4} d='M12 4v16m8-8H4'/></svg>
                            BUAT JURNAL BARU
                        </button>
					</div>
				</div>
			</div>

			{/* Search & Filter Bar (Overlapping) */}
            <div className='max-w-5xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 mb-12'>
                <div className='flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
                    <div className='flex flex-col md:flex-row gap-4 w-full'>
                        <div className='relative group flex-1'>
                            <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                                <svg className='w-7 h-7 text-[#0D0D0D]' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='4' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path></svg>
                            </div>
                            <input
                                type='text'
                                placeholder='CARI JURNAL...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='neo-input w-full !pl-16 pr-4 py-4 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg'
                            />
                        </div>
                        <div className='relative w-full md:w-80'>
                            <select
                                value={filterKelas}
                                onChange={(e) => setFilterKelas(e.target.value)}
                                className='neo-input w-full pl-4 pr-12 py-4 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none appearance-none cursor-pointer rounded-none uppercase text-lg'>
                                <option value='Semua'>📂 SEMUA KELAS</option>
                                {kelasList.map((k) => (
                                    <option key={k.id} value={k.kelas || k.nama_kelas}>🏫 {k.kelas || k.nama_kelas}</option>
                                ))}
                            </select>
                            <div className='absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#0D0D0D] font-black text-2xl'>▼</div>
                        </div>
                    </div>
                </div>
            </div>

			{/* Timeline Content */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 relative z-10'>
				{filteredJournals.length === 0 ? (
					<div className='bg-white shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] p-16 text-center flex flex-col items-center justify-center relative overflow-hidden'>
						<div className='absolute -top-10 -right-10 w-40 h-40 bg-[#F5C518] rounded-full border-[4px] border-[#0D0D0D] opacity-50'></div>
						<div className='absolute -bottom-10 -left-10 w-40 h-40 bg-[#00A693] border-[4px] border-[#0D0D0D] rotate-45 opacity-50'></div>
						
						<div className='w-28 h-28 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center mx-auto mb-8 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform'>
							<svg className='w-16 h-16 text-[#E8451A]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'/></svg>
						</div>
						<h3 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] mb-4 uppercase tracking-widest relative z-10'>BELUM ADA JURNAL</h3>
						<p className='text-[#0D0D0D] font-bold text-lg relative z-10 bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D]'>Silakan buat jurnal baru untuk mencatat kegiatan hari ini.</p>
					</div>
				) : (
					<div className='space-y-12'>
						{filteredJournals.map((journal) => (
							<div
								key={journal.id}
								className='bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] transition-all relative group'>
								
								{/* Status Strip */}
								<div className={`absolute left-0 top-0 bottom-0 w-4 border-r-[4px] border-[#0D0D0D] ${journal.tuntas ? 'bg-[#00A693]' : 'bg-[#E8451A]'}`}></div>

								<div className='pl-6 sm:pl-8 py-6 pr-6'>
									<div className='flex flex-col lg:flex-row justify-between items-start gap-6 mb-8'>
										<div className='flex flex-col sm:flex-row items-start sm:items-center gap-6'>
											{/* Date Badge (Offset/Popping out slightly) */}
											<div className='bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-3 min-w-[90px] text-center transform -rotate-3 hover:rotate-0 transition-all'>
												<span className='text-4xl font-black text-[#0D0D0D] block leading-none'>{new Date(journal.tanggal).getDate()}</span>
												<span className='text-xs font-black text-[#0D0D0D] uppercase tracking-widest mt-1 block bg-white border-2 border-[#0D0D0D] py-1'>{new Date(journal.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
											</div>

											{/* Info Utama */}
											<div>
												<div className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-3 flex-wrap'>
													<span className='bg-white px-3 py-1 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>{journal.kelas}</span>
													<span className='bg-white px-3 py-1 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>{journal.mapel}</span>
												</div>
												<div className='text-xs font-bold text-[#0D0D0D] flex flex-wrap items-center gap-3 mt-4'>
													<span className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase font-black'>
														<svg className='w-5 h-5 text-[#E8451A]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'></path></svg>
														JAM KE-{journal.jam_ke}
													</span>
													{userRole === 'Admin' && <span className='text-[10px] font-black uppercase text-white bg-[#0D0D0D] px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>ID Guru: {journal.guru_id || 'UNKNOWN'}</span>}
												</div>
											</div>
										</div>

										{/* Action Buttons */}
										<div className='flex gap-3 shrink-0 self-start sm:self-auto'>
											<button
												onClick={() => handleOpenModal(journal)}
												className='p-3 bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
												title='Edit'>
												<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'/></svg>
											</button>
											<button
												onClick={() => handleDelete(journal.id)}
												className='p-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
												title='Hapus'>
												<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
											</button>
										</div>
									</div>

									<div className='flex flex-wrap gap-3 mb-8'>
										{/* Badge Pertemuan */}
										{journal.pertemuan_ke && <span className='px-4 py-2 bg-white text-[#0D0D0D] text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform rotate-1'>PERTEMUAN {journal.pertemuan_ke}</span>}

										{journal.tuntas ? (
											<span className='px-4 py-2 bg-[#00A693] text-white text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1'>TUNTAS</span>
										) : (
											<span className='px-4 py-2 bg-[#E8451A] text-white text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1'>PERLU REMEDIAL</span>
										)}
									</div>

									<div className='border-t-[4px] border-dashed border-[#0D0D0D] pt-8'>
										<div className='mb-8'>
											<h4 className='text-xs font-black text-white uppercase tracking-widest mb-3 bg-[#0D0D0D] inline-block px-4 py-2 transform -skew-x-6'>📝 MATERI POKOK</h4>
											<p className='text-[#0D0D0D] font-bold text-xl leading-relaxed bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-5'>{journal.materi}</p>
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
											<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative'>
												<div className='absolute -top-5 -right-5 text-4xl transform rotate-12 bg-[#F5C518] rounded-full border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] w-12 h-12 flex items-center justify-center'>🎯</div>
												<h4 className='text-[10px] font-black text-white uppercase tracking-widest mb-4 bg-[#0D0D0D] px-3 py-1.5 inline-block'>KEGIATAN</h4>
												<p className='text-base text-[#0D0D0D] font-bold'>{journal.kegiatan || '-'}</p>
											</div>
											<div className='bg-[#FFF5F0] p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative mt-4 md:mt-0'>
												<div className='absolute -top-5 -right-5 text-4xl transform -rotate-12 bg-[#E8451A] rounded-full border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] w-12 h-12 flex items-center justify-center'>💡</div>
												<div className='mb-3'>
													<h4 className='text-[10px] font-black text-white uppercase tracking-widest bg-[#0D0D0D] px-3 py-1.5 inline-block'>EVALUASI / CATATAN</h4>
												</div>
												<p className='text-sm text-[#0D0D0D] font-bold mt-2'>{journal.hambatan ? `Hambatan: ${journal.hambatan}` : 'Tidak ada hambatan.'}</p>
												{journal.solusi && (
													<p className='text-sm text-[#0D0D0D] font-bold mt-3 pt-3 border-t-[3px] border-dashed border-[#0D0D0D]'>✅ Solusi: {journal.solusi}</p>
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* MODAL FORM */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0D]/60 backdrop-blur-sm'>
					<div className='bg-white w-full max-w-2xl border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-none'>
						<form onSubmit={handleSubmit}>
							<div className='sticky top-0 bg-[#F5C518] px-8 py-5 border-b-[4px] border-[#0D0D0D] flex justify-between items-center z-10'>
								<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>{isEditing ? 'EDIT JURNAL' : 'JURNAL BARU'}</h2>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='w-10 h-10 flex items-center justify-center bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white transition-colors rounded-none'>
									<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12'/></svg>
								</button>
							</div>

							<div className='p-8 space-y-6 bg-[#FFF5F0]'>
								{/* Baris 1: Kelas & Mapel (Pemicu Hitung Pertemuan) */}
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Kelas</label>
										<div className='relative'>
											<select
												required
												value={formData.kelas}
												onChange={(e) => {
													const val = e.target.value;
													setFormData({ ...formData, kelas: val });
													calculateMeeting(val, formData.mapel);
												}}
												className='neo-input appearance-none w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none uppercase cursor-pointer'>
												<option value=''>PILIH KELAS</option>
												{kelasList.map((k) => (
													<option key={k.id} value={k.kelas || k.nama_kelas}>{k.kelas || k.nama_kelas}</option>
												))}
											</select>
											<div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#0D0D0D] font-bold'>▼</div>
										</div>
									</div>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Mata Pelajaran</label>
										<div className='relative'>
											<select
												required
												value={formData.mapel}
												onChange={(e) => {
													const val = e.target.value;
													setFormData({ ...formData, mapel: val });
													calculateMeeting(formData.kelas, val);
												}}
												className='neo-input appearance-none w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none uppercase cursor-pointer'>
												<option value=''>PILIH MAPEL</option>
												{mapelList.map((m) => (
													<option key={m.id} value={m.mapel || m.nama_mapel}>{m.mapel || m.nama_mapel}</option>
												))}
											</select>
											<div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#0D0D0D] font-bold'>▼</div>
										</div>
									</div>
								</div>

								{/* Baris 2: Tanggal, Jam, Pertemuan */}
								<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Tanggal</label>
										<input
											type='date'
											required
											value={formData.tanggal}
											onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none cursor-pointer'
										/>
									</div>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Jam Ke-</label>
										<input
											type='text'
											required
											placeholder='Contoh: 1-2'
											value={formData.jam_ke}
											onChange={(e) => setFormData({ ...formData, jam_ke: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none'
										/>
									</div>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>
											Pertemuan <span className='text-[10px] text-[#E8451A]'>(Auto)</span>
										</label>
										<input
											type='text'
											placeholder='Auto'
											value={formData.pertemuan_ke}
											onChange={(e) => setFormData({ ...formData, pertemuan_ke: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-[#E8E8E8] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-white outline-none rounded-none'
										/>
									</div>
								</div>

								{/* Materi */}
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Materi Pembelajaran</label>
									<textarea
										rows='2'
										required
										placeholder='Apa materi yang diajarkan?'
										value={formData.materi}
										onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
										className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
								</div>

								{/* Detail Kegiatan */}
								<div className='space-y-4'>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Kegiatan Pembelajaran</label>
										<textarea
											rows='3'
											placeholder='Deskripsi singkat aktivitas siswa...'
											value={formData.kegiatan}
											onChange={(e) => setFormData({ ...formData, kegiatan: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
										<div>
											<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Hambatan / Masalah</label>
											<textarea
												rows='2'
												placeholder='Kendala yang dihadapi...'
												value={formData.hambatan}
												onChange={(e) => setFormData({ ...formData, hambatan: e.target.value })}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
										</div>
										<div>
											<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Solusi / Tindak Lanjut</label>
											<textarea
												rows='2'
												placeholder='Solusi yang dilakukan...'
												value={formData.solusi}
												onChange={(e) => setFormData({ ...formData, solusi: e.target.value })}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
										</div>
									</div>
								</div>

								{/* Status Checkbox */}
								<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
									<div>
										<p className='font-black text-[#0D0D0D] uppercase tracking-widest'>Status Pembelajaran</p>
										<p className='text-xs text-[#0D0D0D] font-bold mt-1'>Apakah tujuan pembelajaran tercapai?</p>
									</div>
									<label className='relative inline-flex items-center cursor-pointer'>
										<input
											type='checkbox'
											checked={formData.tuntas}
											onChange={(e) => setFormData({ ...formData, tuntas: e.target.checked })}
											className='sr-only peer'
										/>
										<div className="w-16 h-8 bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-[26px] peer-checked:after:border-[#0D0D0D] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#0D0D0D] after:border-[#0D0D0D] after:border after:rounded-none after:h-6 after:w-6 after:transition-all peer-checked:bg-[#00A693] peer-checked:after:bg-white"></div>
										<span className='ml-4 text-sm font-black text-[#0D0D0D] uppercase tracking-widest w-16'>{formData.tuntas ? 'TUNTAS' : 'BELUM'}</span>
									</label>
								</div>
							</div>

							<div className='sticky bottom-0 bg-[#F5C518] px-4 sm:px-8 py-4 sm:py-5 border-t-[4px] border-[#0D0D0D] flex flex-col sm:flex-row justify-end gap-3 sm:gap-4'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='neo-btn-outline w-full sm:w-auto bg-white text-[#0D0D0D] px-6 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest'>
									BATAL
								</button>
								<button
									type='submit'
									disabled={saving}
									className='neo-btn-primary w-full sm:w-auto bg-[#0D0D0D] text-white px-8 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed'>
									{saving ? 'MENYIMPAN...' : 'SIMPAN JURNAL'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
