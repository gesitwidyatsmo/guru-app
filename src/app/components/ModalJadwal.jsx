/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useState, useEffect } from 'react';

export default function ModalJadwal({ isOpen, onClose, onSubmit, initialData, isEditMode = false }) {
	// State form data
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	const [formData, setFormData] = useState({
		mapel: '',
		kelas: '',
		hari: hariIni,
		jam_mulai: '',
		jam_selesai: '',
	});

	// State untuk menyimpan list opsi dari API
	const [listMapel, setListMapel] = useState([]);
	const [listKelas, setListKelas] = useState([]);
	const [loading, setLoading] = useState(false);

	// 1. Fetch Data Master (Mapel & Kelas) saat Modal dibuka pertama kali
	useEffect(() => {
		if (isOpen) {
			// Ambil data Mapel
			fetch('/api/mapel')
				.then((res) => res.json())
				.then((data) => setListMapel(data))
				.catch((err) => console.error('Gagal ambil mapel:', err));

			// Ambil data Kelas
			fetch('/api/kelas')
				.then((res) => res.json())
				.then((data) => setListKelas(data))
				.catch((err) => console.error('Gagal ambil kelas:', err));
		}
	}, [isOpen]);

	// 2. Isi form jika ada initialData (Mode Edit)
	useEffect(() => {
		if (isOpen && initialData) {
			setFormData(initialData);
		} else if (isOpen && !initialData) {
			// Reset form
			setFormData({
				mapel: '',
				kelas: '',
				hari: hariIni,
				jam_mulai: '',
				jam_selesai: '',
			});
		}
	}, [isOpen, initialData]);

	if (!isOpen) return null;

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		await onSubmit(formData);
		setLoading(false);
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300'>
			<div className='bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100'>
				{/* HEADER */}
				<div className='bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center'>
					<h3 className='text-xl font-bold text-white'>{isEditMode ? 'Edit Jadwal' : 'Tambah Jadwal'}</h3>
					<button
						onClick={onClose}
						className='text-white/80 hover:text-white'>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='p-6 space-y-4'>
					{/* DROPDOWN MAPEL */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>Mata Pelajaran</label>
						<select
							name='mapel'
							value={formData.mapel}
							onChange={handleChange}
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'
							required>
							<option value=''>-- Pilih Mapel --</option>
							{listMapel.map((m) => (
								// Gunakan m.mapel (nama) atau m.id sesuai kebutuhan penyimpanan
								<option
									key={m.id}
									value={m.mapel}>
									{m.mapel}
								</option>
							))}
						</select>
					</div>

					{/* DROPDOWN KELAS */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>Kelas</label>
						<select
							name='kelas'
							value={formData.kelas}
							onChange={handleChange}
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'
							required>
							<option value=''>-- Pilih Kelas --</option>
							{listKelas.map((k) => (
								// Asumsi API kelas mengembalikan properti: id, kelas (nama kelas)
								<option
									key={k.id}
									value={k.kelas || k.nama_kelas}>
									{k.kelas || k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					{/* Input Hari */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>Hari</label>
						<select
							name='hari'
							value={formData.hari}
							onChange={handleChange}
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'>
							{['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'].map((h) => (
								<option
									key={h}
									value={h}>
									{h}
								</option>
							))}
						</select>
					</div>

					{/* Input Jam (Sama seperti sebelumnya) */}
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>Jam Mulai</label>
							<input
								type='time'
								name='jam_mulai'
								value={formData.jam_mulai}
								onChange={handleChange}
								className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none'
								required
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>Jam Selesai</label>
							<input
								type='time'
								name='jam_selesai'
								value={formData.jam_selesai}
								onChange={handleChange}
								className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none'
								required
							/>
						</div>
					</div>

					<div className='flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100'>
						<button
							type='button'
							onClick={onClose}
							className='px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl'>
							Batal
						</button>
						<button
							type='submit'
							disabled={loading}
							className='px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md'>
							{loading ? 'Menyimpan...' : isEditMode ? 'Update' : 'Simpan'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
