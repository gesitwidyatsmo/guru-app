'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import SectionHeader from '../components/SectionHeader';
import ExploreButton from '../components/button/ExploreButton';
import Modal from '../components/Modal';
import EditButton from '../components/button/EditButton';
import DeleteButton from '../components/button/DeleteButton';
import Loader from '../components/loading';

export default function Page() {
	const [kelasList, setKelasList] = useState([]);
	// Modal Admin = showModal, Modal Guru = showChecklistModal
	const [showModal, setShowModal] = useState(false);
	const [showChecklistModal, setShowChecklistModal] = useState(false);

	const [kelasBaru, setKelasBaru] = useState('');
	const [idWaliKelasBaru, setIdWaliKelasBaru] = useState('');
	const [guruList, setGuruList] = useState([]);
	const [editMode, setEditMode] = useState(false);
	const [kelasEditId, setKelasEditId] = useState(null);

	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);

	// State khusus Guru Checklist
	const [allClasses, setAllClasses] = useState([]);
	const [myClasses, setMyClasses] = useState([]); // Array String
	const [userRole, setUserRole] = useState('');

	const handleBack = () => window.history.back();

	useEffect(() => {
		const fetchAll = async () => {
			try {
				// 1. Ambil Identitas
				const resAuth = await fetch('/api/auth/me');
				let role = '';
				if (resAuth.ok) {
					const dataAuth = await resAuth.json();
					role = dataAuth.user?.role || '';
					setUserRole(role);
				}

				// 2. Ambil Kelas yang akan Tampil di Grid (List)
				const res = await fetch('/api/kelas');
				if (res.ok) {
					const data = await res.json();
					setKelasList(data);
				}

				// 2.5 Jika Admin, Ambil Daftar Guru untuk Dropdown Wali Kelas
				if (role === 'Admin') {
					const resGuru = await fetch('/api/users?role=Guru');
					if (resGuru.ok) {
						const dataGuru = await resGuru.json();
						setGuruList(dataGuru);
					}
				}

				// 3. Jika Guru, Persiapkan Data untuk Modal Checklist
				if (role === 'Guru') {
					// Ambil SEMUA kelas master yg ada di DB untuk opsi modal
					const resAll = await fetch('/api/kelas?all=true');
					if (resAll.ok) {
						const dataAll = await resAll.json();
						setAllClasses(dataAll);
					}

					// Ambil kelas yang sudah centang sejauh ini
					const resMy = await fetch('/api/kbm/mandiri');
					if (resMy.ok) {
						const dataMy = await resMy.json();
						setMyClasses(dataMy.kelas || []);
					}
				}
			} catch (error) {
				console.error('Gagal mengambil data:', error);
			} finally {
				setLoadingPage(false);
			}
		};

		fetchAll();
	}, []);

	// --- HANDLER ADMIN --- //
	async function submitKelas(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/kelas', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				kelas: kelasBaru,
				id_wali_kelas: idWaliKelasBaru,
			}),
		});
		setLoading(false);
		if (res.ok) {
			setKelasBaru('');
			setIdWaliKelasBaru('');
			setShowModal(false);
			fetch('/api/kelas')
				.then((res) => res.json())
				.then(setKelasList);
			if (userRole === 'Guru') {
				fetch('/api/kelas?all=true')
					.then((r) => r.json())
					.then(setAllClasses);
			}
		}
	}

	async function updateKelas(e) {
		e.preventDefault();
		setLoading(true);
		const res = await fetch('/api/kelas', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: kelasEditId, kelas: kelasBaru, id_wali_kelas: idWaliKelasBaru }),
		});
		setLoading(false);
		setShowModal(false);
		setEditMode(false);
		setKelasEditId(null);
		setKelasBaru('');
		setIdWaliKelasBaru('');
		if (res.ok) {
			fetch('/api/kelas')
				.then((res) => res.json())
				.then(setKelasList);
		}
	}

	// --- HANDLER GURU (CHECKLIST) --- //
	const handleCheckboxChange = (namaKelas) => {
		setMyClasses((prev) => (prev.includes(namaKelas) ? prev.filter((k) => k !== namaKelas) : [...prev, namaKelas]));
	};

	const submitChecklist = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch('/api/kbm/mandiri', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target: 'kelas',
					data: myClasses,
				}),
			});
			if (res.ok) {
				setShowChecklistModal(false);
				// Refresh Grid Layar
				fetch('/api/kelas')
					.then((r) => r.json())
					.then(setKelasList);
			}
		} catch (e) {}
		setLoading(false);
	};

	if (loadingPage) {
		return <Loader />;
	}

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
					userRole === 'Admin' ? (
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
					) : (
						<span className='text-xl flex items-center gap-1 font-semibold text-sm'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth={2}
								stroke='currentColor'
								className='size-5'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
								/>
							</svg>
							Ceklis Ajar
						</span>
					)
				}
				onRightClick={() => {
					if (userRole === 'Admin') setShowModal(true);
					else setShowChecklistModal(true);
				}}
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
								{userRole === 'Admin' && (
									<>
										<EditButton
											className='scale-75'
											onClick={(e) => {
												e.preventDefault();
												setEditMode(true);
												setKelasEditId(kelas.id);
												setKelasBaru(kelas.kelas);
												setIdWaliKelasBaru(kelas.id_wali_kelas || '');
												setShowModal(true);
											}}
										/>
										<DeleteButton
											className='scale-75'
											onClick={async (e) => {
												e.preventDefault();
												if (confirm('Yakin ingin menghapus kelas ini?')) {
													setLoading(true);
													await fetch(`/api/kelas?id=${kelas.id}`, { method: 'DELETE' });
													setLoading(false);
													fetch('/api/kelas')
														.then((res) => res.json())
														.then(setKelasList);
												}
											}}
										/>
									</>
								)}
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
					setIdWaliKelasBaru('');
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
						<select
							className='bg-gray-700 text-gray-200 border-0 rounded-md p-2 my-2 focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition ease-in-out duration-150 w-full'
							name='id_wali_kelas'
							value={idWaliKelasBaru}
							onChange={(e) => setIdWaliKelasBaru(e.target.value)}>
							<option value=''>-- Pilih Wali Kelas (Opsional) --</option>
							{guruList.map((guru) => (
								<option
									key={guru.id_user}
									value={guru.id_user}>
									{guru.nama_lengkap}
								</option>
							))}
						</select>
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
								setIdWaliKelasBaru('');
							}}>
							Batal
						</button>
					</div>
				</form>
			</Modal>
			{/* Popup Modal untuk Checklist Guru (Self-Service) */}
			{userRole === 'Guru' && (
				<Modal
					open={showChecklistModal}
					onClose={() => setShowChecklistModal(false)}
					title='Centang Kelas yang Anda Ajar'
					className='text-white'>
					<form onSubmit={submitChecklist}>
						<div className='mb-4 max-h-60 overflow-y-auto pr-2 space-y-2'>
							{allClasses.length === 0 ? (
								<p className='text-gray-400 text-sm'>Tidak ada master kelas yang tersedia.</p>
							) : (
								allClasses.map((item) => (
									<label
										key={item.id}
										className='flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition'>
										<input
											type='checkbox'
											className='w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-700 border-gray-600'
											checked={myClasses.includes(item.kelas)}
											onChange={() => handleCheckboxChange(item.kelas)}
										/>
										<span className='font-medium'>{item.kelas}</span>
									</label>
								))
							)}
						</div>
						<div className='mb-2 pt-2 border-t border-gray-700'>
							<button
								type='submit'
								disabled={loading}
								className='bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg w-full font-medium'>
								{loading ? 'Menyimpan...' : 'Simpan Pilihan Saya'}
							</button>
						</div>
					</form>
				</Modal>
			)}
		</div>
	);
}
