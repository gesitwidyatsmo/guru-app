'use client';

import { useState, useEffect, useCallback } from 'react';
import ModalJadwal from '../components/ModalJadwal';
import Loader from '../components/loading';
import Swal from 'sweetalert2';
import { Clock, Edit2, Trash2, Plus, ChevronLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const listHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

// Neobrutalism SweetAlert Mixin
const brutalSwal = Swal.mixin({
	customClass: {
		popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
		title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
		htmlContainer: 'font-bold text-[#0D0D0D]',
		confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3',
		cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3'
	},
	buttonsStyling: false
});

export default function JadwalPage() {

	// State
	const [selectedHari, setSelectedHari] = useState('');
	const [allJadwal, setAllJadwal] = useState([]);
	const [filteredJadwal, setFilteredJadwal] = useState([]);
	const [loading, setLoading] = useState(true);

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editData, setEditData] = useState(null);

	const fetchJadwal = useCallback(async () => {
		setLoading(true);
		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) {
				setAllJadwal([]);
				return;
			}
			const { data: profile } = await supabase.from('users').select('id_user, role').eq('auth_id', user.id).single();
			
			if (profile?.role === 'Admin') {
				setAllJadwal([]);
				return;
			}
			
			const { data: jadwalArray, error } = await supabase
				.from('jadwal')
				.select('*')
				.eq('id_user', profile.id_user)
				.order('jam_ke', { ascending: true });

			if (error) throw error;
			const sorted = (jadwalArray || []).sort((a, b) => a.jam_ke - b.jam_ke);
			setAllJadwal(sorted);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, []);

	// Init
	useEffect(() => {
		const hariIniIndex = new Date().getDay();
		setSelectedHari(listHari[hariIniIndex]);
		fetchJadwal();
	}, [fetchJadwal]);

	// Filter Logic
	useEffect(() => {
		if (selectedHari && allJadwal.length > 0) {
			const hasil = allJadwal.filter((item) => item.hari?.toLowerCase() === selectedHari.toLowerCase());
			setFilteredJadwal(hasil);
		} else {
			setFilteredJadwal([]);
		}
		setLoading(false);
	}, [selectedHari, allJadwal]);

	// --- HANDLERS ---

	const handleSaveJadwal = async (formData) => {
		try {
			brutalSwal.fire({
				title: 'MENYIMPAN...',
				text: 'MOHON TUNGGU SEBENTAR',
				allowOutsideClick: false,
				didOpen: () => {
					Swal.showLoading();
				},
			});

			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Unauthenticated');
			const { data: profile } = await supabase.from('users').select('id_user').eq('auth_id', user.id).single();
			const userId = profile.id_user;

			if (isEditMode) {
				const updates = {
					mapel: formData.mapel,
					kelas: formData.kelas,
					hari: formData.hari,
					jam_ke: formData.jam_ke,
					jam_mulai: formData.jam_mulai,
					jam_selesai: formData.jam_selesai,
				};
				const { error } = await supabase.from('jadwal').update(updates).eq('id', editData.id).eq('id_user', userId);
				if (error) throw error;
			} else {
				const newJadwalItem = {
					id: Math.floor(Math.random() * 100000).toString(),
					id_user: userId,
					mapel: formData.mapel,
					kelas: formData.kelas,
					hari: formData.hari,
					jam_ke: formData.jam_ke || '',
					jam_mulai: formData.jam_mulai,
					jam_selesai: formData.jam_selesai,
				};
				const { error } = await supabase.from('jadwal').insert(newJadwalItem);
				if (error) throw error;
			}

			setIsModalOpen(false);
			await fetchJadwal(); // Refresh data

			brutalSwal.fire({
				icon: 'success',
				title: 'BERHASIL!',
				text: `JADWAL BERHASIL ${isEditMode ? 'DIPERBARUI' : 'DITAMBAHKAN'}`,
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (error) {
			console.error(error);
			brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: 'TERJADI KESALAHAN SAAT MENYIMPAN JADWAL.',
			});
		}
	};

	const handleDelete = async (id, namaMapel) => {
		const result = await brutalSwal.fire({
			title: 'HAPUS JADWAL?',
			text: `ANDA YAKIN INGIN MENGHAPUS JADWAL "${namaMapel}"?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			customClass: {
				...brutalSwal.options.customClass,
				confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
				cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
			}
		});

		if (!result.isConfirmed) return;

		try {
			brutalSwal.fire({
				title: 'MENGHAPUS...',
				allowOutsideClick: false,
				didOpen: () => Swal.showLoading(),
			});

			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Unauthenticated');
			const { data: profile } = await supabase.from('users').select('id_user').eq('auth_id', user.id).single();

			const { error } = await supabase.from('jadwal').delete().eq('id', id).eq('id_user', profile.id_user);
			if (error) throw error;

			await fetchJadwal(); // Refresh list
			brutalSwal.fire({
				icon: 'success',
				title: 'TERHAPUS!',
				text: 'JADWAL TELAH DIHAPUS.',
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (err) {
			console.error(err);
			brutalSwal.fire({
				icon: 'error',
				title: 'ERROR',
				text: 'GAGAL MENGHAPUS JADWAL.',
			});
		}
	};

	const openEditModal = (item) => {
		setEditData(item);
		setIsEditMode(true);
		setIsModalOpen(true);
	};

	const openAddModal = () => {
		setEditData(null);
		setIsEditMode(false);
		setIsModalOpen(true);
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
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>JADWAL PELAJARAN</h1>
					</div>
				</div>

				<div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none'>
					<div className='flex flex-col gap-2'>
						<h1 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>Manajemen KBM</h1>
						<p className='text-sm font-bold text-[#0D0D0D] bg-[#FF90E8] border-[2px] border-[#0D0D0D] px-2 py-1 inline-block w-fit'>Atur dan lihat jadwal mengajar Anda</p>
					</div>
					<button
						onClick={openAddModal}
						className='h-[60px] px-6 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] rounded-none font-black text-sm hover:-translate-y-1 transition-all shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center gap-2 uppercase tracking-widest whitespace-nowrap'>
						<Plus className='w-6 h-6' strokeWidth={3} />
						TAMBAH JADWAL
					</button>
				</div>

				{/* Hari Selector */}
				<div className='flex gap-4 overflow-x-auto pb-4 pt-2 px-2 -mx-2 custom-scrollbar'>
					{listHari.map((hari) => (
						<button
							key={hari}
							onClick={() => setSelectedHari(hari)}
							className={`h-[50px] px-6 font-black uppercase tracking-widest whitespace-nowrap transition-all border-[4px] border-[#0D0D0D] rounded-none
							${selectedHari === hari 
								? 'bg-[#0D0D0D] text-white shadow-[4px_4px_0px_0px_#E8451A] -translate-y-1' 
								: 'bg-white text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'
							}`}>
							{hari}
						</button>
					))}
				</div>

				{/* Jadwal List */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					{filteredJadwal.length > 0 ? (
						filteredJadwal.map((item) => (
							<div
								key={item.id}
								className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col h-full rounded-none group hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#0D0D0D] transition-all relative overflow-hidden'>
								
								{/* Dekorasi Pojok */}
								<div className='absolute -right-6 -top-6 w-20 h-20 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rotate-12 z-0'></div>
								
								<div className='relative z-10'>
									<div className='flex justify-between items-start mb-6 gap-2'>
										<div className='bg-[#F5C518] px-3 py-1 border-[3px] border-[#0D0D0D] font-black text-sm uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
											JAM KE-{item.jam_ke}
										</div>
										<span className='text-sm font-black text-white bg-[#0D0D0D] px-3 py-1 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>{item.kelas}</span>
									</div>

									<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest line-clamp-2 min-h-[56px]'>{item.mapel}</h3>
									
									<div className='flex items-center gap-2 mt-4 text-[#0D0D0D] bg-[#A3E635] px-3 py-2 border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_#0D0D0D] w-fit'>
										<Clock className='w-5 h-5' strokeWidth={3} />
										{item.jam_mulai} - {item.jam_selesai}
									</div>
								</div>

								{/* Action Buttons */}
								<div className='flex gap-3 mt-8 relative z-10'>
									<button
										onClick={() => openEditModal(item)}
										className='flex-1 flex items-center justify-center gap-2 h-[50px] bg-white text-[#0D0D0D] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:bg-[#F5C518] transition-all font-black uppercase tracking-widest text-sm'>
										<Edit2 className='w-4 h-4' strokeWidth={3} /> EDIT
									</button>
									<button
										onClick={() => handleDelete(item.id, item.mapel)}
										className='flex-1 flex items-center justify-center gap-2 h-[50px] bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all font-black uppercase tracking-widest text-sm'>
										<Trash2 className='w-4 h-4' strokeWidth={3} /> HAPUS
									</button>
								</div>
							</div>
						))
					) : (
						<div className='col-span-full p-12 text-center bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] font-black text-xl text-[#0D0D0D] uppercase tracking-widest bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")]'>
							<span className='bg-[#FF90E8] px-4 py-2 border-[4px] border-[#0D0D0D] inline-block shadow-[4px_4px_0px_0px_#0D0D0D] rotate-2'>
								TIDAK ADA JADWAL UNTUK HARI {selectedHari.toUpperCase()}
							</span>
						</div>
					)}
				</div>

				<ModalJadwal
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
					onSubmit={handleSaveJadwal}
					initialData={editData}
					isEditMode={isEditMode}
				/>
			</div>
		</div>
	);
}
