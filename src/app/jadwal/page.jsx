/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import ModalJadwal from '../components/ModalJadwal';
import Loader from '../components/loading';
import Swal from 'sweetalert2'; // Import SweetAlert
import { ClockIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import ButtonBack from '../components/button/ButtonBack';

export default function JadwalPage() {
	const listHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

	// State
	const [selectedHari, setSelectedHari] = useState('');
	const [allJadwal, setAllJadwal] = useState([]);
	const [filteredJadwal, setFilteredJadwal] = useState([]);
	const [loading, setLoading] = useState(true);

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editData, setEditData] = useState(null);

	// Init
	useEffect(() => {
		const hariIniIndex = new Date().getDay();
		setSelectedHari(listHari[hariIniIndex]);
		fetchJadwal();
	}, []);

	// Filter Logic
	useEffect(() => {
		if (selectedHari && allJadwal.length > 0) {
			const hasil = allJadwal.filter((item) => item.hari.toLowerCase() === selectedHari.toLowerCase());
			setFilteredJadwal(hasil);
		} else {
			setFilteredJadwal([]);
		}
		setLoading(false);
	}, [selectedHari, allJadwal]);

	const fetchJadwal = () => {
		setLoading(true);
		fetch('/api/jadwal')
			.then((res) => res.json())
			.then((data) => {
				const sorted = Array.isArray(data) ? data.sort((a, b) => a.jam_ke - b.jam_ke) : [];
				setAllJadwal(sorted);
			})
			.catch((err) => console.error(err))
			.finally(() => setLoading(false));
	};

	// --- HANDLERS (UPDATED WITH SWEETALERT) ---

	const handleSaveJadwal = async (formData) => {
		try {
			const url = '/api/jadwal';
			const method = isEditMode ? 'PUT' : 'POST';
			const payload = isEditMode ? { id: editData.id, ...formData } : formData;

			// Loading indikator saat proses simpan
			Swal.fire({
				title: 'Menyimpan...',
				text: 'Mohon tunggu sebentar',
				allowOutsideClick: false,
				didOpen: () => {
					Swal.showLoading();
				},
			});

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!res.ok) throw new Error('Gagal simpan');

			setIsModalOpen(false);
			await fetchJadwal(); // Refresh data

			// Alert Sukses
			Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: `Jadwal berhasil ${isEditMode ? 'diperbarui' : 'ditambahkan'}`,
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (error) {
			console.error(error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: 'Terjadi kesalahan saat menyimpan jadwal.',
			});
		}
	};

	const handleDelete = async (id, namaMapel) => {
		// Konfirmasi Hapus dengan SweetAlert
		const result = await Swal.fire({
			title: 'Hapus Jadwal?',
			text: `Anda yakin ingin menghapus jadwal "${namaMapel}"?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Ya, Hapus!',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			// Loading saat menghapus
			Swal.fire({
				title: 'Menghapus...',
				allowOutsideClick: false,
				didOpen: () => Swal.showLoading(),
			});

			const res = await fetch('/api/jadwal', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});

			if (res.ok) {
				await fetchJadwal(); // Refresh list
				Swal.fire({
					icon: 'success',
					title: 'Terhapus!',
					text: 'Jadwal telah dihapus.',
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				throw new Error('Gagal menghapus');
			}
		} catch (err) {
			console.error(err);
			Swal.fire({
				icon: 'error',
				title: 'Error',
				text: 'Gagal menghapus jadwal.',
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
		<div className='min-h-screen bg-gray-50/50 p-6 space-y-6'>
			<ButtonBack />
			{/* Header */}
			<div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 -mt-6 rounded-2xl shadow-sm border border-gray-100'>
				<div>
					<h1 className='text-2xl font-bold text-gray-800'>Jadwal Pelajaran</h1>
					<p className='text-gray-500 text-sm mt-1'>Kelola jadwal KBM sekolah</p>
				</div>
				<button
					onClick={openAddModal}
					className='flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95'>
					<PlusIcon className='w-5 h-5' />
					Tambah Jadwal
				</button>
			</div>

			{/* Hari Selector */}
			<div className='flex gap-2 overflow-x-auto pb-2 scrollbar-hide'>
				{listHari.map((hari) => (
					<button
						key={hari}
						onClick={() => setSelectedHari(hari)}
						className={`
              px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border
              ${selectedHari === hari ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}
            `}>
						{hari}
					</button>
				))}
			</div>

			{/* Jadwal List */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
				{filteredJadwal.length > 0 ? (
					filteredJadwal.map((item) => (
						<div
							key={item.id}
							className='bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative'>
							<div className='absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-xs font-bold shadow-sm z-10'>Jam Ke-{item.jam_ke}</div>
							{/* Card Header: Jam & Kelas */}
							<div className='flex justify-between items-start my-3'>
								<div className=''>
									<h3 className='text-lg font-bold text-gray-800 line-clamp-2'>{item.mapel}</h3>
									<div className='flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider'>
										<ClockIcon className='w-4 h-4' />
										{item.jam_mulai} - {item.jam_selesai}
									</div>
								</div>
								<span className='text-xs font-bold border border-gray-200 px-2 py-1 rounded-md'>{item.kelas}</span>
							</div>

							{/* Card Body: Mapel */}

							{/* Card Footer: Action Buttons */}
							<div className='flex gap-2 mt-auto pt-4 border-t border-gray-50'>
								<button
									onClick={() => openEditModal(item)}
									className='flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors'>
									<PencilSquareIcon className='w-4 h-4' /> Edit
								</button>
								<div className='w-px bg-gray-200 my-1'></div>
								<button
									onClick={() => handleDelete(item.id, item.mapel)}
									className='flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors'>
									<TrashIcon className='w-4 h-4' /> Hapus
								</button>
							</div>
						</div>
					))
				) : (
					<div className='col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200'>
						<p>Tidak ada jadwal untuk hari {selectedHari}</p>
					</div>
				)}
			</div>

			{/* Modal Component */}
			<ModalJadwal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSubmit={handleSaveJadwal}
				initialData={editData}
				mode={isEditMode ? 'edit' : 'add'}
			/>
		</div>
	);
}
