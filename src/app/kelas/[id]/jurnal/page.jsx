/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function JurnalKelasPage() {
	const params = useParams();
	const router = useRouter();
	const classId = params.id;

	// --- State ---
	const [kelasInfo, setKelasInfo] = useState(null);
	const [journals, setJournals] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filter State
	const [selectedMapel, setSelectedMapel] = useState('Semua');

	// Form State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);

	const initialForm = {
		id: '',
		tanggal: new Date().toISOString().slice(0, 10),
		jam_ke: '',
		pertemuan_ke: '',
		mapel: '',
		materi: '',
		kegiatan: '',
		hambatan: '',
		solusi: '',
		tuntas: false,
	};
	const [formData, setFormData] = useState(initialForm);

	// --- Fetch Data ---
	useEffect(() => {
		if (!classId) return;

		const initData = async () => {
			try {
				// 1. Ambil Info Kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const currentKelas = dataKelas.find((k) => String(k.id) === String(classId));

				if (!currentKelas) {
					Swal.fire('Error', 'Kelas tidak ditemukan', 'error');
					router.push('/kelas');
					return;
				}
				setKelasInfo(currentKelas);

				// 2. Ambil List Mapel (untuk dropdown)
				const resMapel = await fetch('/api/mapel');
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				setMapelList(dataMapel);

				// 3. Ambil Jurnal
				await fetchJurnals(currentKelas.kelas || currentKelas.nama_kelas);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		initData();
	}, [classId]);

	const fetchJurnals = async (namaKelas) => {
		try {
			const res = await fetch(`/api/jurnal?kelas=${encodeURIComponent(namaKelas)}`);
			if (res.ok) {
				const data = await res.json();
				setJournals(data);
			}
		} catch (error) {
			console.error('Gagal load jurnal:', error);
		}
	};

	// --- Logic Auto-Suggest Pertemuan ---
	useEffect(() => {
		if (!isEditing && isModalOpen && formData.mapel && kelasInfo) {
			const namaKelas = kelasInfo.kelas || kelasInfo.nama_kelas;
			const existingCount = journals.filter((j) => j.kelas === namaKelas && j.mapel === formData.mapel).length;

			const suggestion = (existingCount + 1).toString();
			if (formData.pertemuan_ke !== suggestion) {
				setFormData((prev) => ({ ...prev, pertemuan_ke: suggestion }));
			}
		}
	}, [formData.mapel, isModalOpen, isEditing, journals, kelasInfo]);

	// --- Handlers ---
	const handleOpenModal = (item = null) => {
		if (item) {
			setIsEditing(true);
			setFormData(item);
		} else {
			setIsEditing(false);
			setFormData({
				...initialForm,
				// Pre-fill mapel jika filter sedang aktif
				mapel: selectedMapel !== 'Semua' ? selectedMapel : '',
			});
		}
		setIsModalOpen(true);
	};

	const handleDelete = async (id) => {
		const result = await Swal.fire({
			title: 'Hapus Jurnal?',
			text: 'Data tidak bisa dikembalikan',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#0f172a',
			confirmButtonText: 'Hapus',
			cancelButtonText: 'Batal',
			customClass: { popup: 'rounded-2xl' },
		});

		if (result.isConfirmed) {
			await fetch(`/api/jurnal?id=${id}`, { method: 'DELETE' });
			fetchJurnals(kelasInfo.kelas || kelasInfo.nama_kelas);
			Swal.fire({
				title: 'Terhapus',
				icon: 'success',
				timer: 1000,
				showConfirmButton: false,
				customClass: { popup: 'rounded-2xl' },
			});
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		const namaKelas = kelasInfo.kelas || kelasInfo.nama_kelas;
		const payload = { ...formData, kelas: namaKelas };

		try {
			const res = await fetch('/api/jurnal', {
				method: isEditing ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				setIsModalOpen(false);
				fetchJurnals(namaKelas);
				Swal.fire({
					icon: 'success',
					title: 'Tersimpan',
					timer: 1500,
					showConfirmButton: false,
					customClass: { popup: 'rounded-2xl' },
				});
			} else {
				throw new Error('Gagal API');
			}
		} catch (error) {
			Swal.fire('Error', 'Gagal menyimpan data', 'error');
		} finally {
			setSaving(false);
		}
	};

	// --- Derived Data ---
	const filteredJournals = selectedMapel === 'Semua' ? journals : journals.filter((j) => j.mapel === selectedMapel);

	// Stats Sederhana
	const totalPertemuan = filteredJournals.length;
	const totalTuntas = filteredJournals.filter((j) => j.tuntas).length;

	if (loading)
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center'>
				<div className='w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin'></div>
			</div>
		);

	return (
		<div className='min-h-screen bg-[#FAFAFA] text-slate-800 font-sans'>
			{/* --- Header Area --- */}
			<header className='sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200'>
				<div className='max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between'>
					<div className='flex items-center gap-4'>
						<button
							onClick={() => router.back()}
							className='p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500'>
							<svg
								className='w-5 h-5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10 19l-7-7m0 0l7-7m-7 7h18'
								/>
							</svg>
						</button>
						<div>
							<h1 className='text-lg font-bold text-slate-900 leading-tight'>{kelasInfo?.kelas || kelasInfo?.nama_kelas}</h1>
							<p className='text-xs text-slate-500'>Jurnal Pembelajaran</p>
						</div>
					</div>

					<button
						onClick={() => handleOpenModal()}
						className='bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95'>
						<svg
							className='w-4 h-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 4v16m8-8H4'
							/>
						</svg>
						<span className='hidden sm:inline'>Entri Baru</span>
					</button>
				</div>
			</header>

			<main className='max-w-6xl mx-auto px-4 sm:px-6 py-8'>
				<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
					{/* --- Sidebar (Stats & Filters) --- */}
					<aside className='lg:col-span-3 space-y-6'>
						{/* Stat Card */}
						<div className='bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'>
							<h3 className='text-xs font-bold text-slate-400 uppercase tracking-wider mb-4'>Ringkasan</h3>
							<div className='space-y-4'>
								<div>
									<p className='text-3xl font-bold text-slate-900'>{totalPertemuan}</p>
									<p className='text-sm text-slate-500'>Total Pertemuan</p>
								</div>
								<div className='w-full bg-slate-100 h-2 rounded-full overflow-hidden'>
									<div
										className='bg-emerald-500 h-full rounded-full transition-all duration-1000'
										style={{ width: totalPertemuan > 0 ? `${(totalTuntas / totalPertemuan) * 100}%` : '0%' }}></div>
								</div>
								<div className='flex justify-between text-xs text-slate-500'>
									<span>{totalTuntas} Tuntas</span>
									<span>{totalPertemuan - totalTuntas} Remedial</span>
								</div>
							</div>
						</div>

						{/* Filter Mapel */}
						<div className='bg-white p-2 rounded-2xl border border-slate-200 shadow-sm'>
							<div className='flex flex-col gap-1'>
								<button
									onClick={() => setSelectedMapel('Semua')}
									className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedMapel === 'Semua' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
									📂 Semua Mapel
								</button>
								{mapelList.map((m) => (
									<button
										key={m.id}
										onClick={() => setSelectedMapel(m.mapel || m.nama_mapel)}
										className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
											selectedMapel === (m.mapel || m.nama_mapel) ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
										}`}>
										📚 {m.mapel || m.nama_mapel}
									</button>
								))}
							</div>
						</div>
					</aside>

					{/* --- Main Feed (Timeline) --- */}
					<div className='lg:col-span-9'>
						{filteredJournals.length === 0 ? (
							<div className='flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300'>
								<div className='w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4'>
									<svg
										className='w-8 h-8 text-slate-300'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={1.5}
											d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
										/>
									</svg>
								</div>
								<h3 className='text-slate-900 font-semibold text-lg'>Belum ada jurnal</h3>
								<p className='text-slate-500 text-sm mt-1'>Mulai dengan mencatat kegiatan pertama.</p>
							</div>
						) : (
							<div className='space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent'>
								{filteredJournals.map((journal) => (
									<div
										key={journal.id}
										className='relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active'>
										{/* Icon Titik Tengah */}
										<div className='flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#FAFAFA] bg-slate-200 group-hover:bg-slate-900 transition-colors shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10'>
											<svg
												className='w-4 h-4 text-slate-500 group-hover:text-white'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M12 6v6m0 0v6m0-6h6m-6 0H6'
												/>
											</svg>
										</div>

										{/* Content Card */}
										<div className='w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow'>
											<div className='flex justify-between items-start mb-3'>
												<div>
													<span className='inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1'>{journal.mapel}</span>
													<div className='text-xs text-slate-400 font-medium'>
														{new Date(journal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} • Jam {journal.jam_ke}
													</div>
												</div>
												<div className='flex gap-1'>
													<button
														onClick={() => handleOpenModal(journal)}
														className='p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'>
														<svg
															className='w-4 h-4'
															fill='none'
															viewBox='0 0 24 24'
															stroke='currentColor'>
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
														className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'>
														<svg
															className='w-4 h-4'
															fill='none'
															viewBox='0 0 24 24'
															stroke='currentColor'>
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

											<h4 className='font-bold text-slate-800 mb-2 leading-snug'>
												{journal.materi}
												{journal.pertemuan_ke && <span className='ml-2 font-normal text-slate-500 text-sm'>(Pert. {journal.pertemuan_ke})</span>}
											</h4>

											<p className='text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3'>{journal.kegiatan}</p>

											{/* Footer Status */}
											<div className='pt-3 border-t border-slate-100 flex items-center justify-between'>
												<div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${journal.tuntas ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
													<div className={`w-1.5 h-1.5 rounded-full ${journal.tuntas ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
													{journal.tuntas ? 'Tuntas' : 'Perlu Remedial'}
												</div>
												{(journal.hambatan || journal.solusi) && (
													<div className='flex -space-x-2'>
														{journal.hambatan && (
															<div
																className='w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] ring-2 ring-white'
																title='Ada Hambatan'>
																⚠️
															</div>
														)}
														{journal.solusi && (
															<div
																className='w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] ring-2 ring-white'
																title='Ada Solusi'>
																💡
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</main>

			{/* --- Minimalist Modal --- */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
					<div
						className='absolute inset-0 bg-slate-900/30 backdrop-blur-sm'
						onClick={() => setIsModalOpen(false)}></div>
					<div className='relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col'>
						<div className='px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10'>
							<h2 className='text-lg font-bold text-slate-900'>{isEditing ? 'Edit Entri' : 'Jurnal Baru'}</h2>
							<button
								onClick={() => setIsModalOpen(false)}
								className='text-slate-400 hover:text-slate-600 transition-colors'>
								<svg
									className='w-6 h-6'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>

						<form
							onSubmit={handleSubmit}
							className='flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar'>
							{/* Section 1: Konteks */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase'>Mata Pelajaran</label>
									<select
										required
										value={formData.mapel}
										onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
										className='w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 font-medium text-slate-700'>
										<option value=''>Pilih Mapel...</option>
										{mapelList.map((m) => (
											<option
												key={m.id}
												value={m.mapel || m.nama_mapel}>
												{m.mapel || m.nama_mapel}
											</option>
										))}
									</select>
								</div>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase'>Tanggal</label>
									<input
										type='date'
										required
										value={formData.tanggal}
										onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
										className='w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 font-medium text-slate-700'
									/>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-5'>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase'>Jam Ke-</label>
									<input
										type='text'
										placeholder='1-2'
										value={formData.jam_ke}
										onChange={(e) => setFormData({ ...formData, jam_ke: e.target.value })}
										className='w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 text-slate-700'
									/>
								</div>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase flex justify-between'>
										Pertemuan
										<span className='text-emerald-600 text-[10px] bg-emerald-50 px-1 rounded'>Auto</span>
									</label>
									<input
										type='text'
										placeholder='Auto'
										value={formData.pertemuan_ke}
										onChange={(e) => setFormData({ ...formData, pertemuan_ke: e.target.value })}
										className='w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 text-slate-700 font-semibold'
									/>
								</div>
							</div>

							{/* Section 2: Isi */}
							<div className='space-y-4 pt-2'>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase'>Materi Pokok</label>
									<input
										type='text'
										required
										placeholder='Topik pembahasan hari ini...'
										value={formData.materi}
										onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
										className='w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-700 font-medium placeholder:font-normal'
									/>
								</div>
								<div className='space-y-1.5'>
									<label className='text-xs font-semibold text-slate-500 uppercase'>Kegiatan Pembelajaran</label>
									<textarea
										rows={4}
										placeholder='Deskripsikan aktivitas siswa secara singkat...'
										value={formData.kegiatan}
										onChange={(e) => setFormData({ ...formData, kegiatan: e.target.value })}
										className='w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-700 leading-relaxed'></textarea>
								</div>
							</div>

							{/* Section 3: Evaluasi */}
							<div className='bg-slate-50 p-5 rounded-2xl space-y-4'>
								<h3 className='text-xs font-bold text-slate-400 uppercase tracking-widest'>Catatan Evaluasi</h3>

								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<input
										type='text'
										placeholder='Hambatan (jika ada)'
										value={formData.hambatan}
										onChange={(e) => setFormData({ ...formData, hambatan: e.target.value })}
										className='w-full p-3 bg-white border-none shadow-sm rounded-xl focus:ring-2 focus:ring-rose-200 text-sm'
									/>
									<input
										type='text'
										placeholder='Solusi / Tindak lanjut'
										value={formData.solusi}
										onChange={(e) => setFormData({ ...formData, solusi: e.target.value })}
										className='w-full p-3 bg-white border-none shadow-sm rounded-xl focus:ring-2 focus:ring-blue-200 text-sm'
									/>
								</div>

								<div className='flex items-center justify-between pt-2'>
									<span className='text-sm font-medium text-slate-600'>Apakah tujuan tercapai?</span>
									<button
										type='button'
										onClick={() => setFormData((prev) => ({ ...prev, tuntas: !prev.tuntas }))}
										className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
											formData.tuntas ? 'bg-emerald-500' : 'bg-slate-200'
										}`}>
										<span className={`${formData.tuntas ? 'translate-x-9' : 'translate-x-1'} inline-block h-6 w-6 transform rounded-full bg-white transition duration-200 shadow-sm`} />
										<span className={`absolute text-[10px] font-bold text-white ${formData.tuntas ? 'left-2' : 'right-2'}`}>{formData.tuntas ? 'YA' : 'NO'}</span>
									</button>
								</div>
							</div>
						</form>

						<div className='p-6 border-t border-slate-100 bg-white flex justify-end gap-3 z-10'>
							<button
								onClick={() => setIsModalOpen(false)}
								className='px-6 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors'>
								Batal
							</button>
							<button
								onClick={handleSubmit}
								disabled={saving}
								className='bg-slate-900 hover:bg-slate-800 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all'>
								{saving ? 'Menyimpan...' : 'Simpan Jurnal'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
