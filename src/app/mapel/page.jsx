// src/app/mapel/page.js
'use client';
import { useEffect, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import Modal from '../components/Modal';
import EditButton from '../components/button/EditButton';
import DeleteButton from '../components/button/DeleteButton';
import Loader from '../components/loading';
// import Edit from '../components/button/EditButton';

export default function Page() {
	const [showModal, setShowModal] = useState(false);
	const [mapelList, setMapelList] = useState([]);
	const [mapelBaru, setMapelBaru] = useState('');
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);
	const [editMode, setEditMode] = useState(false);
	const [mapelEditId, setMapelEditId] = useState(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteId, setDeleteId] = useState(null);

	const handleBack = () => window.history.back();

	useEffect(() => {
		const fecthData = async () => {
			try {
				const res = await fetch('/api/mapel');
				const data = await res.json();
				setMapelList(data);
			} catch (err) {
				console.log(err);
			} finally {
				setLoadingPage(false);
			}
		};

		fecthData();
	});

	// Tambah function submitMapel
	async function submitMapel(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/mapel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mapel: mapelBaru }),
		});
		setLoading(false);
		if (res.ok) {
			setMapelBaru('');
			setShowModal(false);
			// Refresh data mapel
			fetch('/api/mapel')
				.then((res) => res.json())
				.then(setMapelList);
		}
	}

	// Edit function updateMapel
	async function updateMapel(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/mapel', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: mapelEditId, mapel: mapelBaru }),
		});
		setLoading(false);
		setShowModal(false);
		setEditMode(false);
		setMapelEditId(null);
		setMapelBaru('');
		if (res.ok) {
			fetch('/api/mapel')
				.then((res) => res.json())
				.then(setMapelList);
		}
	}

	// Fungsi hapus mapel
	async function deleteMapel(id) {
		if (!window.confirm('Yakin ingin menghapus mapel ini?')) return;
		setDeleteLoading(true);
		setDeleteId(id);
		const res = await fetch('/api/mapel', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id }),
		});
		setDeleteLoading(false);
		setDeleteId(null);
		if (res.ok) {
			// Refresh list Mapel
			fetch('/api/mapel')
				.then((res) => res.json())
				.then(setMapelList);
		}
	}

	if (loadingPage) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
				<div className='text-center'>
					<Loader />
				</div>
			</div>
		);
	}

	return (
		<div className='bg-gray-100 h-screen'>
			<SectionHeader
				title='Mapel'
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
				onRightClick={() => setShowModal(true)}
			/>
			{/* List Mapel */}
			<div className='m-6 space-y-3'>
				{mapelList.length === 0 && <div className='text-gray-400 text-center'>Belum ada mapel.</div>}
				{mapelList.map((item) => (
					<div
						key={item.id}
						className='rounded-2xl px-4 py-2 flex items-center gap-3 bg-white'>
						<span className='font-medium'>{item.mapel}</span>
						<span className='flex ml-auto text-xs text-white'>
							<EditButton
								onClick={() => {
									setEditMode(true);
									setMapelEditId(item.id);
									setMapelBaru(item.mapel); // isi input dengan mapel yang akan diedit
									setShowModal(true);
								}}
								className='scale-75'
							/>
							<DeleteButton
								onClick={() => deleteMapel(item.id)}
								className={`scale-75 ${deleteLoading && deleteId === item.id ? 'animate-pulse opacity-70' : ''}`}
							/>
						</span>
					</div>
				))}
			</div>

			{/* Popup Modal untuk Tambah Mapel */}
			<Modal
				open={showModal}
				onClose={() => {
					setShowModal(false);
					setEditMode(false);
					setMapelEditId(null);
					setMapelBaru('');
				}}
				title={editMode ? 'Edit Mapel' : 'Tambah Mapel'}
				className='text-white'>
				{/* Form Input Mapel */}
				<form onSubmit={editMode ? updateMapel : submitMapel}>
					<div className='mb-4'>
						{/* <label className='block text-sm font-medium mb-1 text-white'>Nama Mapel</label> */}
						<input
							type='text'
							className='bg-gray-700 text-gray-200 border-0 rounded-md p-2 my-2 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150	w-full'
							required
							name='nama_mapel'
							value={mapelBaru}
							onChange={(e) => setMapelBaru(e.target.value)}
							placeholder='Contoh: Informatika'
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
								setMapelEditId(null);
								setMapelBaru('');
							}}>
							Batal
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
