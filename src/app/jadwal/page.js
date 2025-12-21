'use client';
import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import ModalJadwal from '../components/ModalJadwal';

export default function Page() {
	// State & Variabel
	const listHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
	const getSingkatan = (hari) => {
		if (hari === "Jum'at") return 'Jum';
		return hari.substring(0, 3);
	};
	const [selectedHari, setSelectedHari] = useState('');
	const [allJadwal, setAllJadwal] = useState([]);
	const [filteredJadwal, setFilteredJadwal] = useState([]);

	// State Modal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editData, setEditData] = useState(null); // Data jadwal yang sedang diedit

	// Inisialisasi Hari Ini
	useEffect(() => {
		const hariIniIndex = new Date().getDay();
		setSelectedHari(listHari[hariIniIndex]);
		fetchJadwal(); // Ambil data awal
	}, []);

	// Fungsi Fetch Jadwal (Refactored agar bisa dipanggil ulang)
	const fetchJadwal = () => {
		fetch('/api/jadwal')
			.then((res) => res.json())
			.then((data) => setAllJadwal(data))
			.catch((err) => console.error('Gagal ambil jadwal:', err));
	};

	// Filter Jadwal
	useEffect(() => {
		if (selectedHari && allJadwal.length > 0) {
			const hasilFilter = allJadwal.filter((item) => item.hari.toLowerCase() === selectedHari.toLowerCase());
			setFilteredJadwal(hasilFilter);
		} else {
			setFilteredJadwal([]);
		}
	}, [selectedHari, allJadwal]);

	// ---------------------------------------------------------
	// FUNGSI UTAMA: Handle Save (Tambah & Edit)
	// ---------------------------------------------------------
	const handleSaveJadwal = async (formData) => {
		try {
			// Tentukan URL dan Method berdasarkan Mode
			const url = '/api/jadwal';
			const method = isEditMode ? 'PUT' : 'POST';

			// Siapkan payload data
			// Jika edit, kita butuh ID. Jika tambah, ID digenerate di server (API)
			const payload = isEditMode
				? { id: editData.id, ...formData } // Sertakan ID lama untuk update
				: formData; // Data baru

			const res = await fetch(url, {
				method: method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!res.ok) throw new Error('Gagal menyimpan jadwal');

			// Jika sukses:
			setIsModalOpen(false);
			setEditData(null); // Reset edit data
			fetchJadwal(); // REFRESH DATA otomatis agar tampilan update
			alert(isEditMode ? 'Jadwal berhasil diperbarui!' : 'Jadwal berhasil ditambahkan!');
		} catch (error) {
			console.error('Error saving jadwal:', error);
			alert('Terjadi kesalahan saat menyimpan jadwal.');
		}
	};

	// Handler Buka Modal Tambah
	const openAddModal = () => {
		setIsEditMode(false);
		setEditData(null);
		setIsModalOpen(true);
	};

	// Handler Buka Modal Edit (Dipanggil saat klik item jadwal)
	const openEditModal = (jadwalItem) => {
		setIsEditMode(true);
		setEditData(jadwalItem); // Isi form dengan data item yang diklik
		setIsModalOpen(true);
	};

	const handleBack = () => {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	};

	return (
		<div>
			<SectionHeader
				title='Jadwal'
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
				onLeftClick={handleBack}
				rightIcon={<span className='text-xl'>＋</span>}
				onRightClick={() => setIsModalOpen(true)}
			/>
			{/* <!-- From Uiverse.io by hoshikawamaki -->  */}
			<div className='m-5 flex flex-wrap gap-1 border-[3px] border-purple-400 rounded-xl select-none p-1 overflow-x-auto'>
				{listHari.map((hari) => (
					<label
						key={hari}
						className='flex-grow cursor-pointer'>
						<input
							type='radio'
							name='hari'
							value={hari}
							className='peer hidden'
							// Cek apakah hari ini sama dengan state
							checked={selectedHari === hari}
							onChange={() => setSelectedHari(hari)}
						/>
						<span className='block sm:hidden text-center peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500 peer-checked:text-white text-gray-700 px-2 py-2 rounded-lg transition duration-150 ease-in-out text-sm font-medium hover:bg-purple-50'>
							{getSingkatan(hari)}
						</span>
						<span className='hidden sm:block text-center peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500 peer-checked:text-white text-gray-700 px-2 py-2 rounded-lg transition duration-150 ease-in-out text-sm font-medium hover:bg-purple-50'>
							{hari}
						</span>
					</label>
				))}
			</div>

			{/* LIST JADWAL (Hasil Filter) */}
			<div className='px-5 space-y-3'>
				{filteredJadwal.length === 0 ? (
					<div className='text-center text-gray-400 mt-10'>Tidak ada jadwal untuk hari {selectedHari}</div>
				) : (
					filteredJadwal.map((item) => (
						<div
							key={item.id}
							className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center'>
							<div>
								<h3 className='font-bold text-lg text-gray-800'>{item.kelas}</h3>
								<p className='text-gray-500 text-sm'>{item.mapel}</p>
							</div>
							<div className='text-right'>
								<span className='block font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-sm'>
									{item.jam_mulai} - {item.jam_selesai}
								</span>
							</div>
						</div>
					))
				)}
			</div>

			{/* Modal */}
			<ModalJadwal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSubmit={handleSaveJadwal}
				initialData={editData} // Data untuk edit (null jika tambah)
				isEditMode={isEditMode} // Flag mode
			/>
		</div>
	);
}
