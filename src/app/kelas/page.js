'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import SectionHeader from '../components/SectionHeader';
import ExploreButton from '../components/button/ExploreButton';
import Modal from '../components/Modal';
import EditButton from '../components/button/EditButton';
import DeleteButton from '../components/button/DeleteButton';

export default function Page() {
	const [kelasList, setKelasList] = useState([]);
	const [showModal, setShowModal] = useState(false);
	const [kelasBaru, setKelasBaru] = useState('');
	const [waliKelasBaru, setWaliKelasBaru] = useState('');
	const [editMode, setEditMode] = useState(false);
	const [kelasEditId, setKelasEditId] = useState(null);
	const [loading, setLoading] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteId, setDeleteId] = useState(null);

	const handleBack = () => window.history.back();
	const handleAdd = () => console.log('Tambah Kelas diklik!');

	useEffect(() => {
		fetch('/api/kelas')
			.then((res) => res.json())
			.then(setKelasList);
	}, []);

	async function submitKelas(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/kelas', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				kelas: kelasBaru,
				wali_kelas: waliKelasBaru,
			}),
		});
		setLoading(false);
		if (res.ok) {
			setKelasBaru('');
			setWaliKelasBaru('');
			setShowModal(false);
			// Refresh data Kelas
			fetch('/api/kelas')
				.then((res) => res.json())
				.then(setKelasList);
		}
	}

	// Edit function updateKelas
	async function updateKelas(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/kelas', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: kelasEditId, kelas: kelasBaru }),
		});
		setLoading(false);
		setShowModal(false);
		setEditMode(false);
		setKelasEditId(null);
		setKelasBaru('');
		if (res.ok) {
			fetch('/api/kelas')
				.then((res) => res.json())
				.then(setKelasList);
		}
	}

	// Fungsi hapus kelas
	async function deleteKelas(id) {
		if (!window.confirm('Yakin ingin menghapus kelas ini?')) return;
		setDeleteLoading(true);
		setDeleteId(id);
		const res = await fetch('/api/kelas', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id }),
		});
		setDeleteLoading(false);
		setDeleteId(null);
		if (res.ok) {
			// Refresh list Kelas
			fetch('/api/kelas')
				.then((res) => res.json())
				.then(setKelasList);
		}
	}

	console.log(kelasList);

	return (
		<div>
			<SectionHeader
				title='Kelas'
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
				rightIcon={
					<span className='text-xl'>
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
								d='M12 4.5v15m7.5-7.5h-15'
							/>
						</svg>
					</span>
				}
				onRightClick={() => setShowModal(true)}
			/>
			{/* Daftar Kelas */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-3 px-4 mt-8'>
				{kelasList.map((kelas) => (
					<Link
						href={`/kelas/${kelas.id}`}
						key={kelas.id}>
						<div className='flex items-center justify-between p-4 border rounded-lg shadow-sm'>
							<div>
								<span className='text-lg font-medium'>{kelas.kelas}</span>
								<span className='block text-sm text-gray-500'>Wali Kelas: {kelas.wali_kelas || 'Belum ditentukan'}</span>
							</div>
							<div className='flex space-x-2'>
								<ExploreButton
									className='scale-75'
									onClick={() => console.log('Mengunjungi')}
								/>
							</div>
						</div>
					</Link>
				))}
			</div>
			{/* Popup Modal untuk Tambah Kelas */}
			<Modal
				open={showModal}
				onClose={() => {
					setShowModal(false);
					setEditMode(false);
					setKelasEditId(null);
					setKelasBaru('');
				}}
				title={editMode ? 'Edit Kelas' : 'Tambah Kelas'}
				className='text-white'>
				{/* Form Input Kelas */}
				<form onSubmit={editMode ? updateKelas : submitKelas}>
					<div className='mb-4'>
						<input
							type='text'
							className='bg-gray-700 text-gray-200 border-0 rounded-md p-2 my-2 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150	w-full'
							required
							name='nama_kelas'
							value={kelasBaru}
							onChange={(e) => setKelasBaru(e.target.value)}
							placeholder='Contoh: VII A atau XI 1'
						/>
						<input
							type='text'
							className='bg-gray-700 text-gray-200 border-0 rounded-md p-2 my-2 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150	w-full'
							required
							name='nama_kelas'
							value={waliKelasBaru}
							onChange={(e) => setWaliKelasBaru(e.target.value)}
							placeholder='Wali Kelas'
						/>
					</div>
					<div className='mb-2'>
						<button
							type='submit'
							disabled={loading}
							className='bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg'>
							{/* {editMode ? 'Update' : loading ? 'Menyimpan...' : 'Simpan'} */}
							{loading ? (editMode ? 'Updating...' : 'Menyimpan...') : editMode ? 'Update' : 'Simpan'}
						</button>
						<button
							type='button'
							className='ml-3 text-gray-500 hover:underline'
							onClick={() => {
								setShowModal(false);
								setEditMode(false);
								setKelasEditId(null);
								setKelasBaru('');
							}}>
							Batal
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
