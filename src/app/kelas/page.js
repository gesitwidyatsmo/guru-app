'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Modal from '../components/Modal';
import Loader from '../components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import styles from './kelas.module.css';

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

	// State khusus Guru KBM Explicit
	const [allClasses, setAllClasses] = useState([]);
	const [allMapels, setAllMapels] = useState([]);
	const [myKBM, setMyKBM] = useState([]); // Array of { id_kbm, kelas, mapel }
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [userRole, setUserRole] = useState('');

	const handleBack = () => window.history.back();

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.get('bukaPenugasan') === 'true') {
				setShowChecklistModal(true);
				window.history.replaceState({}, '', '/kelas');
			}
		}
	}, []);

	useEffect(() => {
		const fetchAll = async () => {
			try {
				const supabase = createClient();
				
				// 1. Ambil Identitas
				const { data: { user } } = await supabase.auth.getUser();
				let role = '';
				let userId = '';
				if (user) {
					const { data: profile } = await supabase.from('users').select('id_user, role').eq('auth_id', user.id).single();
					if (profile) {
						role = profile.role || '';
						setUserRole(role);
						userId = profile.id_user;
					}
				}

				// 2. Ambil Kelas yang akan Tampil di Grid (List)
				let allowedClasses = null;
				if (role === 'Admin') {
					allowedClasses = null; // Semua kelas
				} else if (role === 'Guru' && userId) {
					const { data: kbmData } = await supabase.from('guru_kbm').select('kelas').eq('id_user', userId);
					allowedClasses = kbmData ? [...new Set(kbmData.map(r => r.kelas))] : [];
				} else {
					allowedClasses = [];
				}

				let query = supabase.from('kelas').select(`
					id,
					nama_kelas,
					id_wali_kelas,
					users!kelas_id_wali_kelas_fkey(nama_lengkap)
				`).order('nama_kelas', { ascending: true });

				if (allowedClasses !== null) {
					if (allowedClasses.length > 0) {
						query = query.in('nama_kelas', allowedClasses);
					} else {
						query = null;
						setKelasList([]);
					}
				}

				if (query) {
					const { data: kelasData } = await query;
					
					// Ambil jumlah siswa per kelas
					const { data: allSiswa } = await supabase.from('siswa').select('kelas').eq('status', 'Aktif');
					const countPerKelas = {};
					if (allSiswa) {
						allSiswa.forEach(s => {
							if (s.kelas) {
								countPerKelas[s.kelas] = (countPerKelas[s.kelas] || 0) + 1;
							}
						});
					}

					if (kelasData) {
						setKelasList(kelasData.map(k => ({
							id: k.id,
							kelas: k.nama_kelas,
							id_wali_kelas: k.id_wali_kelas || '',
							wali_kelas: k.users?.nama_lengkap || '',
							jumlah_siswa: countPerKelas[k.nama_kelas] || 0
						})));
					}
				}

				// 2.5 Jika Admin, Ambil Daftar Guru untuk Dropdown Wali Kelas
				if (role === 'Admin') {
					const { data: dataGuru } = await supabase.from('users').select('id_user, nama_lengkap').eq('role', 'Guru');
					if (dataGuru) {
						setGuruList(dataGuru);
					}
				}

				// 3. Jika Guru, Persiapkan Data untuk Modal Checklist
				if (role === 'Guru') {
					// Ambil SEMUA kelas master yg ada di DB untuk opsi modal
					const { data: dataAll } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true });
					if (dataAll) {
						setAllClasses(dataAll.map(k => ({ id: k.id, kelas: k.nama_kelas })));
					}

					// Ambil SEMUA mapel master untuk dropdown
					const { data: dataMapel } = await supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true });
					if (dataMapel) {
						setAllMapels(dataMapel);
					}

					// Ambil penugasan saat ini (Eksplisit)
					const { data: myData } = await supabase.from('guru_kbm').select('id_kbm, kelas, mapel').eq('id_user', userId).order('kelas').order('mapel');
					if (myData) {
						setMyKBM(myData);
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

	// --- HANDLER GURU (KBM EKSPLISIT) --- //
	const refreshKBM = async () => {
		const res = await fetch('/api/kbm/mandiri');
		if (res.ok) {
			const data = await res.json();
			setMyKBM(data);
			// Refresh Grid Layar
			fetch('/api/kelas').then((r) => r.json()).then(setKelasList);
		}
	};

	const submitKBM = async (e) => {
		e.preventDefault();
		if (!selectedKelas || !selectedMapel) return;
		setLoading(true);
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
					title: 'Berhasil!',
					text: 'Penugasan baru telah ditambahkan.',
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				const err = await res.json();
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menambahkan',
					text: err.error || 'Terjadi kesalahan.',
				});
			}
		} catch (e) {
			console.error(e);
		}
		setLoading(false);
	};

	const hapusKBM = async (id_kbm) => {
		const result = await Swal.fire({
			title: 'Hapus penugasan ini?',
			text: 'Data tidak dapat dikembalikan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			setLoading(true);
			try {
				const res = await fetch(`/api/kbm/mandiri?id_kbm=${id_kbm}`, { method: 'DELETE' });
				if (res.ok) {
					await refreshKBM();
					Swal.fire('Terhapus!', 'Penugasan telah dihapus.', 'success');
				} else {
					Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
				}
			} catch (e) {
				console.error(e);
				Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
			}
			setLoading(false);
		}
	};

	if (loadingPage) {
		return <Loader />;
	}

	return (
		<div className={styles.pageContainer}>
			{/* Header Custom */}
			<header className={styles.header}>
				<div className={styles.headerLeft}>
					<button onClick={handleBack} className={styles.backButton}>
						<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
						Kembali
					</button>
					<h1 className={styles.headerTitle}>Manajemen Kelas</h1>
				</div>
				<div>
					{userRole === 'Admin' ? (
						<button onClick={() => setShowModal(true)} className={styles.accentButton}>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Tambah Kelas
						</button>
					) : userRole === 'Guru' ? (
						<button onClick={() => setShowChecklistModal(true)} className={styles.accentButton}>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
							</svg>
							Atur Penugasan
						</button>
					) : null}
				</div>
			</header>

			{/* Daftar Kelas */}
			<div className={styles.gridContainer}>
				{kelasList.length === 0 ? (
					<div className={styles.emptyLedger}>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" width="64" height="64" className="text-gray-300">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<h2 className={styles.emptyText}>Data Kelas Kosong</h2>
						<p className={styles.emptySubText}>
							{userRole === 'Guru' 
								? 'Anda belum ditugaskan ke kelas manapun. Silakan Atur Penugasan terlebih dahulu.' 
								: 'Belum ada kelas yang terdaftar di sistem buku besar ini.'}
						</p>
					</div>
				) : (
					kelasList.map((kelas) => (
						<Link href={`/kelas/${kelas.id}`} key={kelas.id} className={styles.indexCard}>
							<div className={styles.cardContent}>
								<h2 className={styles.className}>{kelas.kelas}</h2>
								<div className='flex flex-col gap-1 mb-2'>
									<div className={styles.classTeacher}>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
											<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
										</svg>
										<span className='truncate'>{kelas.wali_kelas || 'Belum Ditentukan'}</span>
									</div>
									<div className={styles.classTeacher}>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
											<path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
										</svg>
										<span>{kelas.jumlah_siswa} Siswa Aktif</span>
									</div>
								</div>
								
								<div className={styles.cardActions}>
									{userRole === 'Admin' && (
										<>
											<button
												className={styles.actionButton}
												onClick={(e) => {
													e.preventDefault();
													setEditMode(true);
													setKelasEditId(kelas.id);
													setKelasBaru(kelas.kelas);
													setIdWaliKelasBaru(kelas.id_wali_kelas || '');
													setShowModal(true);
												}}
												title="Edit"
											>
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
													<path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
												</svg>
											</button>
											<button
												className={`${styles.actionButton} ${styles.danger}`}
												onClick={async (e) => {
													e.preventDefault();
													const result = await Swal.fire({
														title: 'Yakin menghapus kelas?',
														icon: 'warning',
														showCancelButton: true,
														confirmButtonText: 'Ya, Hapus',
													});
													if (result.isConfirmed) {
														setLoading(true);
														await fetch(`/api/kelas?id=${kelas.id}`, { method: 'DELETE' });
														setLoading(false);
														fetch('/api/kelas').then((res) => res.json()).then(setKelasList);
													}
												}}
												title="Hapus"
											>
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
													<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
												</svg>
											</button>
										</>
									)}
								</div>
							</div>
							{/* The Signature Watermark */}
							<div className={styles.cardWatermark} aria-hidden="true">
								{kelas.kelas}
							</div>
						</Link>
					))
				)}
			</div>

			{/* Modal Admin (Tambah/Edit Kelas) */}
			<Modal
				open={showModal}
				onClose={() => {
					setShowModal(false);
					setEditMode(false);
					setKelasEditId(null);
					setKelasBaru('');
					setIdWaliKelasBaru('');
				}}
				title={editMode ? 'Edit Kelas' : 'Tambah Kelas Baru'}
			>
				<form onSubmit={editMode ? updateKelas : submitKelas}>
					<div className='mb-4'>
						<label className={styles.inputLabel}>Nama Kelas</label>
						<input
							type='text'
							className={styles.inputField}
							required
							name='nama_kelas'
							value={kelasBaru}
							onChange={(e) => setKelasBaru(e.target.value)}
							placeholder='Contoh: VII A atau XI 1'
						/>
					</div>
					<div className='mb-5'>
						<label className={styles.inputLabel}>Wali Kelas (Opsional)</label>
						<select
							className={styles.inputField}
							name='id_wali_kelas'
							value={idWaliKelasBaru}
							onChange={(e) => setIdWaliKelasBaru(e.target.value)}
						>
							<option value=''>-- Belum Ditentukan --</option>
							{guruList.map((guru) => (
								<option key={guru.id_user} value={guru.id_user}>
									{guru.nama_lengkap}
								</option>
							))}
						</select>
					</div>
					<div className='flex gap-3'>
						<button type='submit' disabled={loading} className={styles.accentButton}>
							{loading ? (editMode ? 'Updating...' : 'Menyimpan...') : editMode ? 'Update Data' : 'Simpan Kelas'}
						</button>
						<button
							type='button'
							className='px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors'
							onClick={() => {
								setShowModal(false);
								setEditMode(false);
								setKelasEditId(null);
								setKelasBaru('');
								setIdWaliKelasBaru('');
							}}
						>
							Batal
						</button>
					</div>
				</form>
			</Modal>

			{/* Modal Guru (Atur Penugasan) */}
			{userRole === 'Guru' && (
				<Modal
					open={showChecklistModal}
					onClose={() => setShowChecklistModal(false)}
					title='Atur Penugasan Anda'
				>
					<form onSubmit={submitKBM} className='mb-6'>
						<div className='flex flex-col gap-4 mb-5'>
							<div>
								<label className={styles.inputLabel}>Pilih Kelas</label>
								<select
									required
									value={selectedKelas}
									onChange={(e) => setSelectedKelas(e.target.value)}
									className={styles.inputField}
								>
									<option value='' disabled>-- Pilih Kelas --</option>
									{allClasses.map((item) => (
										<option key={item.id} value={item.kelas}>{item.kelas}</option>
									))}
								</select>
							</div>
							
							<div>
								<label className={styles.inputLabel}>Pilih Mata Pelajaran</label>
								<select
									required
									value={selectedMapel}
									onChange={(e) => setSelectedMapel(e.target.value)}
									className={styles.inputField}
								>
									<option value='' disabled>-- Pilih Mapel --</option>
									{allMapels.map((item) => (
										<option key={item.id} value={item.mapel}>{item.mapel}</option>
									))}
								</select>
							</div>
						</div>
						<button type='submit' disabled={loading || !selectedKelas || !selectedMapel} className={styles.accentButton + " w-full justify-center"}>
							{loading ? 'Menambahkan...' : 'Tambahkan Ke Jadwal'}
						</button>
					</form>

					<div className='border-t border-gray-200 pt-5 mt-2'>
						<h3 className={styles.inputLabel}>Daftar Penugasan Aktif</h3>
						<div className='space-y-2 mt-3'>
							{myKBM.length === 0 ? (
								<p className='text-gray-400 text-sm italic text-center py-4 bg-gray-50 rounded border border-gray-200 border-dashed'>Belum ada jadwal penugasan.</p>
							) : (
								myKBM.map((kbm) => (
									<div key={kbm.id_kbm} className='flex items-center justify-between p-3 bg-white rounded border border-gray-200 shadow-sm'>
										<div className='flex flex-col'>
											<span className='font-bold text-indigo-700 font-mono'>{kbm.kelas}</span>
											<span className='text-sm text-gray-600 font-medium'>{kbm.mapel}</span>
										</div>
										<button 
											type='button'
											onClick={() => hapusKBM(kbm.id_kbm)}
											disabled={loading}
											className='text-rose-500 hover:text-white hover:bg-rose-500 p-2 rounded transition-colors disabled:opacity-50'
											title="Hapus"
										>
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
												<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
											</svg>
										</button>
									</div>
								))
							)}
						</div>
					</div>
				</Modal>
			)}
		</div>
	);
}
