'use client';

import { useState, useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import Loader from '../components/loading';
import Swal from 'sweetalert2';

export default function ProfilAjarPage() {
	const [loadingPage, setLoadingPage] = useState(true);
	const [loadingSubmit, setLoadingSubmit] = useState(false);

	const [userProfile, setUserProfile] = useState({
		nama_lengkap: '',
		username: '',
		role: '',
	});

	const [formData, setFormData] = useState({
		nama_lengkap: '',
		password_baru: '',
	});

	const [myClasses, setMyClasses] = useState([]);
	const [myMapels, setMyMapels] = useState([]);

	const handleBack = () => window.history.back();

	useEffect(() => {
		const fetchProfil = async () => {
			try {
				const resAuth = await fetch('/api/auth/me');
				if (resAuth.ok) {
					const dataAuth = await resAuth.json();
					setUserProfile(dataAuth.user || {});
					setFormData((prev) => ({ ...prev, nama_lengkap: dataAuth.user?.nama_lengkap || '' }));

					// Cegah Admin mengakses laman Profil Ajar khusus Guru
					if (dataAuth.user?.role === 'Admin') {
						window.location.href = '/';
						return;
					}
				} else {
					window.location.href = '/login';
					return;
				}

				const resKBM = await fetch('/api/kbm/mandiri');
				if (resKBM.ok) {
					const dataKBM = await resKBM.json();
					setMyClasses(dataKBM.kelas || []);
					setMyMapels(dataKBM.mapel || []);
				}
			} catch (error) {
				console.error('Ada masalah saat mengambil data profil', error);
			} finally {
				setLoadingPage(false);
			}
		};

		fetchProfil();
	}, []);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoadingSubmit(true);

		try {
			const res = await fetch('/api/profil/akun', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			if (res.ok) {
				const resData = await res.json();
				Swal.fire({
					icon: 'success',
					title: 'Sukses Diperbarui',
					text: resData.message || 'Profil Profil Anda berhasil disimpan!',
					timer: 2000,
					showConfirmButton: false,
				});
				setUserProfile((prev) => ({ ...prev, nama_lengkap: formData.nama_lengkap }));
				setFormData((prev) => ({ ...prev, password_baru: '' }));
			} else {
				const errorData = await res.json();
				Swal.fire('Error', errorData.error || 'Gagal menyimpan profil', 'error');
			}
		} catch (error) {
			Swal.fire('Error', 'Terjadi kesalahan sistem saat menghubungi server', 'error');
		} finally {
			setLoadingSubmit(false);
		}
	};

	if (loadingPage) return <Loader />;

	return (
		<div className='min-h-screen bg-gray-50/50 p-4 md:p-6 space-y-6'>
			<SectionHeader
				leftIcon={
					<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
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
					</div>
				}
				onLeftClick={handleBack}
			/>

			<div className='max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6'>
				{/* Kolom Kiri - Info Akun & Form */}
				<div className='md:col-span-2 space-y-6'>
					<div className='bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100'>
						<div className='flex items-center gap-4 mb-8'>
							<div className='w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center text-white text-2xl font-bold'>
								{userProfile.nama_lengkap?.charAt(0).toUpperCase() || 'U'}
							</div>
							<div>
								<h1 className='text-2xl font-bold text-gray-800 tracking-tight'>{userProfile.nama_lengkap}</h1>
								<p className='text-sm text-indigo-600 font-medium flex items-center gap-1'>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										className='h-4 w-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
										/>
									</svg>
									{userProfile.role} Guru
								</p>
								<p className='text-xs text-gray-400 mt-0.5 font-mono'>@{userProfile.username}</p>
							</div>
						</div>

						<form
							onSubmit={handleSubmit}
							className='space-y-5'>
							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Nama Lengkap</label>
								<input
									type='text'
									name='nama_lengkap'
									value={formData.nama_lengkap}
									onChange={handleChange}
									placeholder='Nama lengkap Anda beserta gelar...'
									className='w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white'
									required
								/>
							</div>

							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
									Ubah Kata Sandi <span className='text-xs text-gray-400 font-normal'>(Opsional)</span>
								</label>
								<input
									type='password'
									name='password_baru'
									value={formData.password_baru}
									onChange={handleChange}
									placeholder='Kosongkan jika tidak ingin mengubah sandi'
									className='w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white placeholder:text-gray-400'
								/>
							</div>

							<div className='pt-2'>
								<button
									type='submit'
									disabled={loadingSubmit}
									className='w-full bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex justify-center items-center gap-2'>
									{loadingSubmit ? (
										<svg
											className='animate-spin h-5 w-5 text-white'
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'>
											<circle
												className='opacity-25'
												cx='12'
												cy='12'
												r='10'
												stroke='currentColor'
												strokeWidth='4'></circle>
											<path
												className='opacity-75'
												fill='currentColor'
												d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
										</svg>
									) : (
										<>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={2}
												stroke='currentColor'
												className='w-5 h-5'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M4.5 12.75l6 6 9-13.5'
												/>
											</svg>
											Simpan Profil
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>

				{/* Kolom Kanan - Ringkasan Ajar */}
				<div className='space-y-6'>
					<div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
						<h3 className='text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b border-gray-100 pb-3'>
							<span className='text-xl'>🏫</span> Kelas Tertaut
						</h3>
						{myClasses.length === 0 ? (
							<div className='text-center py-6 bg-orange-50 rounded-xl border border-orange-100'>
								<p className='text-sm text-orange-600 font-medium'>Anda belum menautkan kelas.</p>
							</div>
						) : (
							<div className='flex flex-wrap gap-2'>
								{myClasses.map((kls, i) => (
									<span
										key={i}
										className='bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-indigo-100 shadow-sm'>
										{kls}
									</span>
								))}
							</div>
						)}
					</div>

					<div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
						<h3 className='text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b border-gray-100 pb-3'>
							<span className='text-xl'>📚</span> Mapel Tertaut
						</h3>
						{myMapels.length === 0 ? (
							<div className='text-center py-6 bg-orange-50 rounded-xl border border-orange-100'>
								<p className='text-sm text-orange-600 font-medium'>Anda belum menautkan mapel.</p>
							</div>
						) : (
							<div className='flex flex-wrap gap-2'>
								{myMapels.map((mpl, i) => (
									<span
										key={i}
										className='bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-teal-100 shadow-sm'>
										{mpl}
									</span>
								))}
							</div>
						)}
					</div>

					<div className='bg-blue-50/50 p-5 rounded-2xl border border-blue-100'>
						<div className='flex gap-3'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth={1.5}
								stroke='currentColor'
								className='w-6 h-6 text-blue-500 shrink-0'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
								/>
							</svg>
							<p className='text-xs text-blue-800 leading-relaxed font-medium'>
								Untuk menautkan jam ajar tambahan, silakan kunjungi menu <strong>&quot;Ceklis Ajar&quot;</strong> yang tersedia pada Dasbor Utama (Menu Kelas dan Mapel).
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
