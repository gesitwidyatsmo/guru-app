/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '../components/loading';

export default function JurnalPage() {
	const router = useRouter();

	// --- STATE MANAGEMENT ---
	const [journals, setJournals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterKelas, setFilterKelas] = useState('Semua');

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
				const [resKelas, resMapel] = await Promise.all([fetch('/api/kelas'), fetch('/api/mapel')]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];

				setKelasList(dataKelas);
				setMapelList(dataMapel);

				await refreshJurnal();
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	const refreshJurnal = async () => {
		try {
			const res = await fetch('/api/jurnal');
			if (res.ok) {
				const data = await res.json();
				setJournals(data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
			}
		} catch (error) {
			console.error('Gagal memuat jurnal:', error);
		}
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
				const res = await fetch(`/api/jurnal?id=${id}`, { method: 'DELETE' });
				if (res.ok) {
					Swal.fire('Terhapus!', 'Jurnal berhasil dihapus.', 'success');
					refreshJurnal();
				} else {
					throw new Error('Gagal menghapus');
				}
			} catch (err) {
				Swal.fire('Error', 'Terjadi kesalahan saat menghapus.', 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		try {
			const method = isEditing ? 'PUT' : 'POST';
			const res = await fetch('/api/jurnal', {
				method: method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			if (res.ok) {
				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: `Jurnal berhasil ${isEditing ? 'diperbarui' : 'disimpan'}`,
					timer: 1500,
					showConfirmButton: false,
				});
				setIsModalOpen(false);
				refreshJurnal();
			} else {
				throw new Error('Gagal menyimpan');
			}
		} catch (err) {
			Swal.fire('Error', 'Gagal menyimpan data jurnal.', 'error');
		} finally {
			setSaving(false);
		}
	};

	const filteredJournals = filterKelas === 'Semua' ? journals : journals.filter((j) => j.kelas === filterKelas);

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gray-50 pb-20'>
			{/* Header Gradient */}
			<div className='bg-gradient-to-br from-orange-500 to-red-600 pb-24 pt-8 px-4 sm:px-8 rounded-b-3xl shadow-xl relative overflow-hidden'>
				<div className='absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl'></div>
				<div className='absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full blur-2xl'></div>

				<div className='max-w-5xl mx-auto relative z-10'>
					<div className='flex items-center gap-4 mb-6'>
						<button
							onClick={() => router.back()}
							className='p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-all shadow-lg border border-white/20'>
							<svg
								className='w-6 h-6'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 19l-7-7 7-7'
								/>
							</svg>
						</button>
						<div>
							<h1 className='text-3xl font-bold text-white'>Jurnal Guru</h1>
							<p className='text-orange-100 text-sm'>Catat aktivitas pembelajaran harian Anda</p>
						</div>
					</div>

					{/* Search & Filter Bar (Opsi Dropdown Modern) */}
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20'>
						<div className='relative group w-full sm:w-64'>
							<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
								<svg
									className='w-5 h-5 text-orange-200'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'></path>
								</svg>
							</div>
							<select
								value={filterKelas}
								onChange={(e) => setFilterKelas(e.target.value)}
								className='block w-full pl-10 pr-10 py-3 rounded-xl bg-orange-800/30 text-white placeholder-orange-200 border border-orange-500/30 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent appearance-none cursor-pointer font-medium transition-all hover:bg-orange-800/40'>
								<option
									value='Semua'
									className='text-gray-900 bg-white'>
									📂 Semua Kelas
								</option>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}
										className='text-gray-900 bg-white'>
										🏫 {k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-orange-200'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M19 9l-7 7-7-7'></path>
								</svg>
							</div>
						</div>

						<button
							onClick={() => handleOpenModal()}
							className='w-full sm:w-auto bg-white text-orange-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-50 hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 whitespace-nowrap'>
							<svg
								className='w-5 h-5'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M12 4v16m8-8H4'
								/>
							</svg>
							Buat Jurnal Baru
						</button>
					</div>
				</div>
			</div>

			{/* Timeline Content */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 -mt-12 relative z-10'>
				{filteredJournals.length === 0 ? (
					<div className='bg-white rounded-3xl shadow-xl p-12 text-center border border-gray-100'>
						<div className='w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6'>
							<svg
								className='w-12 h-12 text-orange-500'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
								/>
							</svg>
						</div>
						<h3 className='text-xl font-bold text-gray-800 mb-2'>Belum ada jurnal</h3>
						<p className='text-gray-500'>Silakan buat jurnal baru untuk mencatat kegiatan hari ini.</p>
					</div>
				) : (
					<div className='space-y-6'>
						{filteredJournals.map((journal) => (
							<div
								key={journal.id}
								className='bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 hover:shadow-xl transition-shadow relative overflow-hidden group'>
								{/* Status Strip */}
								<div className={`absolute left-0 top-0 bottom-0 w-2 ${journal.tuntas ? 'bg-green-500' : 'bg-orange-500'}`}></div>

								<div className='flex justify-between items-start mb-4'>
									<div className='flex items-center gap-4'>
										{/* Date Badge */}
										<div className='bg-orange-50 p-3 rounded-2xl min-w-[70px] text-center'>
											<span className='text-2xl font-bold text-orange-600 block leading-none'>{new Date(journal.tanggal).getDate()}</span>
											<span className='text-[10px] font-bold text-orange-400 uppercase tracking-wide'>{new Date(journal.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
										</div>

										{/* Info Utama */}
										<div>
											<div className='flex items-center gap-2 mb-1'>
												<div className='text-sm font-bold text-gray-800 flex flex-col'>
													<h2>{journal.kelas}</h2>
													<h2>{journal.mapel}</h2>
												</div>
											</div>
											<div className='text-sm text-gray-500 flex flex-wrap items-center gap-2'>
												<span className='flex items-center gap-1'>
													<svg
														className='w-4 h-4'
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth='2'
															d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'></path>
													</svg>
													Jam ke-{journal.jam_ke}
												</span>
											</div>
										</div>
									</div>

									{/* Action Buttons */}
									<div className='flex'>
										<button
											onClick={() => handleOpenModal(journal)}
											className='p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
											title='Edit'>
											<svg
												className='w-5 h-5'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
												/>
											</svg>
										</button>
										<button
											onClick={() => handleDelete(journal.id)}
											className='p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
											title='Hapus'>
											<svg
												className='w-5 h-5'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
												/>
											</svg>
										</button>
									</div>
								</div>
								<div className='space-x-2'>
									{/* Badge Pertemuan */}
									{journal.pertemuan_ke && <span className='px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider border border-gray-200'>Pertemuan {journal.pertemuan_ke}</span>}

									{journal.tuntas ? (
										<span className='px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200'>Tuntas</span>
									) : (
										<span className='px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold border border-yellow-200'>Perlu Remedial</span>
									)}
								</div>
								<div className='space-y-4 border-t border-gray-100 pt-4 mt-4'>
									<div>
										<h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>Materi Pokok</h4>
										<p className='text-gray-700 font-medium'>{journal.materi}</p>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
										<div className='bg-gray-50 p-3 rounded-xl'>
											<h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1'>🎯 Kegiatan</h4>
											<p className='text-sm text-gray-600'>{journal.kegiatan || '-'}</p>
										</div>
										<div className='bg-gray-50 p-3 rounded-xl'>
											<h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1'>💡 Evaluasi / Catatan</h4>
											<p className='text-sm text-gray-600'>{journal.hambatan ? `Hambatan: ${journal.hambatan}` : 'Tidak ada hambatan.'}</p>
											{journal.solusi && <p className='text-sm text-gray-600 mt-1 pt-1 border-t border-gray-200'>✅ {journal.solusi}</p>}
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
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
					<div className='bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
						<form onSubmit={handleSubmit}>
							<div className='sticky top-0 bg-white px-8 py-5 border-b border-gray-100 flex justify-between items-center z-10'>
								<h2 className='text-xl font-bold text-gray-800'>{isEditing ? 'Edit Jurnal' : 'Jurnal Baru'}</h2>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='p-2 hover:bg-gray-100 rounded-full transition-colors'>
									<svg
										className='w-6 h-6 text-gray-500'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>
							</div>

							<div className='p-8 space-y-6'>
								{/* Baris 1: Kelas & Mapel (Pemicu Hitung Pertemuan) */}
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>Kelas</label>
										<select
											required
											value={formData.kelas}
											onChange={(e) => {
												const val = e.target.value;
												setFormData({ ...formData, kelas: val });
												calculateMeeting(val, formData.mapel);
											}}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'>
											<option value=''>Pilih Kelas</option>
											{kelasList.map((k) => (
												<option
													key={k.id}
													value={k.kelas || k.nama_kelas}>
													{k.kelas || k.nama_kelas}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>Mata Pelajaran</label>
										<select
											required
											value={formData.mapel}
											onChange={(e) => {
												const val = e.target.value;
												setFormData({ ...formData, mapel: val });
												calculateMeeting(formData.kelas, val);
											}}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'>
											<option value=''>Pilih Mata Pelajaran</option>
											{mapelList.map((m) => (
												<option
													key={m.id}
													value={m.mapel || m.nama_mapel}>
													{m.mapel || m.nama_mapel}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Baris 2: Tanggal, Jam, Pertemuan */}
								<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>Tanggal</label>
										<input
											type='date'
											required
											value={formData.tanggal}
											onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
										/>
									</div>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>Jam Ke-</label>
										<input
											type='text'
											required
											placeholder='Contoh: 1-2'
											value={formData.jam_ke}
											onChange={(e) => setFormData({ ...formData, jam_ke: e.target.value })}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
										/>
									</div>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>
											Pertemuan Ke-
											<span className='text-xs font-normal text-orange-500 ml-1'>(Auto)</span>
										</label>
										<input
											type='text'
											placeholder='Hitungan otomatis'
											value={formData.pertemuan_ke}
											onChange={(e) => setFormData({ ...formData, pertemuan_ke: e.target.value })}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium text-orange-600'
										/>
									</div>
								</div>

								{/* Materi */}
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1'>Materi Pembelajaran</label>
									<textarea
										rows='2'
										required
										placeholder='Apa materi yang diajarkan?'
										value={formData.materi}
										onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
										className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'></textarea>
								</div>

								{/* Detail Kegiatan */}
								<div className='space-y-4'>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1'>Kegiatan Pembelajaran</label>
										<textarea
											rows='3'
											placeholder='Deskripsi singkat aktivitas siswa...'
											value={formData.kegiatan}
											onChange={(e) => setFormData({ ...formData, kegiatan: e.target.value })}
											className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'></textarea>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
										<div>
											<label className='block text-sm font-semibold text-gray-700 mb-1'>Hambatan / Masalah</label>
											<textarea
												rows='2'
												placeholder='Kendala yang dihadapi...'
												value={formData.hambatan}
												onChange={(e) => setFormData({ ...formData, hambatan: e.target.value })}
												className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'></textarea>
										</div>
										<div>
											<label className='block text-sm font-semibold text-gray-700 mb-1'>Solusi / Tindak Lanjut</label>
											<textarea
												rows='2'
												placeholder='Solusi yang dilakukan...'
												value={formData.solusi}
												onChange={(e) => setFormData({ ...formData, solusi: e.target.value })}
												className='w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'></textarea>
										</div>
									</div>
								</div>

								{/* Status Checkbox */}
								<div className='bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between'>
									<div>
										<p className='font-bold text-gray-800'>Status Pembelajaran</p>
										<p className='text-xs text-gray-500'>Apakah tujuan pembelajaran tercapai?</p>
									</div>
									<label className='relative inline-flex items-center cursor-pointer'>
										<input
											type='checkbox'
											checked={formData.tuntas}
											onChange={(e) => setFormData({ ...formData, tuntas: e.target.checked })}
											className='sr-only peer'
										/>
										<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
										<span className='ml-3 text-sm font-medium text-gray-700'>{formData.tuntas ? 'Tuntas' : 'Belum'}</span>
									</label>
								</div>
							</div>

							<div className='sticky bottom-0 bg-white px-8 py-5 border-t border-gray-100 flex justify-end gap-3'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors'>
									Batal
								</button>
								<button
									type='submit'
									disabled={saving}
									className='bg-orange-600 hover:bg-orange-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'>
									{saving ? 'Menyimpan...' : 'Simpan Jurnal'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
