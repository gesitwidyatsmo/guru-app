/* eslint-disable react-hooks/set-state-in-effect */
// src/app/Siswa/page.js
'use client';
import { useEffect, useState } from 'react';
import SectionHeader from '../components/SectionHeader'; // gunakan path absolut (butuh support jsconfig.json/tsconfig.json)
import Modal from '../components/Modal';
import Link from 'next/link';

// inline modal seleksi kelas
function ClassPickerModal({ isOpen, onClose, kelasList, onSelect }) {
	if (!isOpen) return null;
	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-sm rounded-2xl shadow-lg overflow-hidden'>
				<div className='p-4 border-b border-gray-100 flex justify-between items-center'>
					<h3 className='font-bold text-gray-800'>Pilih Kelas</h3>
					<button
						onClick={onClose}
						className='text-gray-500 hover:text-red-500'>
						✕
					</button>
				</div>
				<div className='p-4 max-h-80 overflow-y-auto space-y-2'>
					{/* Opsi Semua Kelas */}
					<button
						onClick={() => onSelect('Semua')}
						className='w-full text-left px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors font-medium text-gray-700'>
						Semua Kelas
					</button>
					{/* Mapping List Kelas dari API */}
					{kelasList.map((k) => (
						<button
							key={k.id}
							onClick={() => onSelect(k.kelas)} // Pastikan API kelas return field 'kelas' atau 'nama_kelas'
							className='w-full text-left px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors font-medium text-gray-700'>
							{k.kelas}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function ModalFormSiswa({ isOpen, onClose, onSubmit, kelasList }) {
	const [formData, setFormData] = useState({
		nis: '',
		nama_lengkap: '',
		kelas: '',
		jenis_kelamin: 'Laki-laki',
		status: 'Aktif',
	});
	const [loading, setLoading] = useState(false);

	// Reset form saat modal dibuka
	useEffect(() => {
		if (isOpen) {
			setFormData({
				nis: '',
				nama_lengkap: '',
				kelas: '',
				jenis_kelamin: 'Laki-laki',
				status: 'Aktif',
			});
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		await onSubmit(formData);
		setLoading(false);
		onClose();
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden'>
				<div className='bg-purple-600 px-6 py-4 flex justify-between items-center'>
					<h3 className='text-xl font-bold text-white'>Tambah Siswa</h3>
					<button
						onClick={onClose}
						className='text-white/80 hover:text-white'>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='p-6 space-y-4'>
					{/* NIS */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>NIS</label>
						<input
							type='text'
							required
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none'
							value={formData.nis}
							onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
						/>
					</div>

					{/* Nama Lengkap */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>Nama Lengkap</label>
						<input
							type='text'
							required
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none'
							value={formData.nama_lengkap}
							onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
						/>
					</div>

					{/* Kelas (Dropdown dari API) */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>Kelas</label>
						<select
							required
							className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'
							value={formData.kelas}
							onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}>
							<option value=''>-- Pilih Kelas --</option>
							{kelasList.map((k) => (
								<option
									key={k.id}
									value={k.kelas}>
									{k.kelas}
								</option>
							))}
						</select>
					</div>

					{/* Jenis Kelamin & Status (Grid) */}
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>Jenis Kelamin</label>
							<select
								className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'
								value={formData.jenis_kelamin}
								onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
								<option value='Laki-laki'>Laki-laki</option>
								<option value='Perempuan'>Perempuan</option>
							</select>
						</div>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>Status</label>
							<select
								className='w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white'
								value={formData.status}
								onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
								<option value='Aktif'>Aktif</option>
								<option value='Boyong'>Boyong</option>
								<option value='Lulus'>Lulus</option>
							</select>
						</div>
					</div>

					<div className='pt-4 flex justify-end gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl'>
							Batal
						</button>
						<button
							type='submit'
							disabled={loading}
							className='px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md disabled:opacity-70'>
							{loading ? 'Menyimpan...' : 'Simpan'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function Page() {
	const [siswaList, setSiswaList] = useState([]);
	const [kelasList, setKelasList] = useState([]); // Data MASTER_KELAS
	const [filteredSiswa, setFilteredSiswa] = useState([]); // Hasil filter
	const [selectedKelas, setSelectedKelas] = useState('Semua'); // Kelas aktif
	const [loading, setLoading] = useState(true);
	const [showClassPicker, setShowClassPicker] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);

	const handleBack = () => window.history.back();

	// 1. Fetch Data Siswa & Kelas saat Load
	useEffect(() => {
		const fetchData = async () => {
			try {
				// Ambil Siswa
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = await resSiswa.json();
				setSiswaList(dataSiswa);
				setFilteredSiswa(dataSiswa); // Awalnya tampilkan semua

				// Ambil Kelas (Untuk Filter)
				const resKelas = await fetch('/api/kelas');
				const dataKelas = await resKelas.json();
				setKelasList(dataKelas);

				setLoading(false);
			} catch (err) {
				console.error(err);
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	// 2. Logic Filter (Setiap kali selectedKelas berubah)
	useEffect(() => {
		if (selectedKelas === 'Semua') {
			setFilteredSiswa(siswaList);
		} else {
			const hasil = siswaList.filter((s) => s.kelas === selectedKelas);
			setFilteredSiswa(hasil);
		}
	}, [selectedKelas, siswaList]);

	// Logic Simpan Siswa Baru
	const handleSaveSiswa = async (newData) => {
		try {
			const res = await fetch('/api/siswa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newData),
			});

			if (res.ok) {
				alert('Siswa berhasil ditambahkan!');
				// Refresh Data Otomatis
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = await resSiswa.json();
				setSiswaList(dataSiswa);
				// Reset filter jika perlu
				if (selectedKelas === 'Semua') setFilteredSiswa(dataSiswa);
				else setFilteredSiswa(dataSiswa.filter((s) => s.kelas === selectedKelas));
			} else {
				alert('Gagal menyimpan siswa.');
			}
		} catch (error) {
			console.error(error);
			alert('Terjadi kesalahan jaringan.');
		}
	};

	return (
		<div>
			<SectionHeader
				title='Siswa'
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
				onRightClick={() => setShowAddModal(true)}
			/>
			{/* FILTER BAR */}
			<div className='px-4 mt-4'>
				<div className='bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center'>
					<div className='flex gap-3 items-center'>
						<div className='bg-purple-100 p-2 rounded-full text-purple-600'>
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
									d='M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75'
								/>
							</svg>
						</div>
						<div className='flex flex-col'>
							<span className='text-xs text-gray-400 font-medium'>Filter Kelas</span>
							<span className='font-bold text-gray-800'>{selectedKelas}</span>
						</div>
					</div>

					<button
						onClick={() => setShowClassPicker(true)}
						className='flex gap-2 bg-blue-500 hover:bg-blue-600 transition-colors px-4 py-2 rounded-xl items-center shadow-blue-200 shadow-md active:scale-95 transform duration-100'>
						<span className='text-white font-medium text-sm'>Pilih</span>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 24 24'
							fill='white'
							className='size-5'>
							<path
								fillRule='evenodd'
								d='M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z'
								clipRule='evenodd'
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* LIST SISWA */}
			<div className='p-5'>
				{loading ? (
					<div className='text-center text-gray-500'>Memuat data siswa...</div>
				) : (
					<div className='grid grid-cols-3 md:grid-cols-5 gap-3'>
						{filteredSiswa.map((siswa) => (
							<Link
								href={`/siswa/${siswa.id}`}
								key={siswa.id}
								className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1'>
								<div className='flex justify-between items-start'>
									<div>
										<h3 className='font-bold text-lg text-gray-800'>{siswa.nama_lengkap}</h3>
										<span className='text-sm text-gray-500'>NIS: {siswa.nis}</span>
									</div>
									<span className={`text-xs px-2 py-1 rounded-full font-medium ${siswa.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{siswa.status}</span>
								</div>

								<div className='flex gap-3 mt-2 text-sm text-gray-600'>
									<span className='bg-gray-100 px-2 py-0.5 rounded'>Kelas: {siswa.kelas}</span>
									<span className='bg-blue-50 text-blue-600 px-2 py-0.5 rounded'>{siswa.jenis_kelamin}</span>
								</div>
							</Link>
						))}

						{siswaList.length === 0 && !loading && <p className='text-center text-gray-400'>Belum ada data siswa.</p>}
					</div>
				)}
			</div>

			{/* CLASS PICKER MODAL */}
			<ClassPickerModal
				isOpen={showClassPicker}
				onClose={() => setShowClassPicker(false)}
				kelasList={kelasList}
				onSelect={(kelas) => {
					setSelectedKelas(kelas);
					setShowClassPicker(false);
				}}
			/>

			{/* PANGGIL MODAL TAMBAH SISWA */}
			<ModalFormSiswa
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				kelasList={kelasList} // Kirim data kelas untuk dropdown
				onSubmit={handleSaveSiswa}
			/>
		</div>
	);
}
