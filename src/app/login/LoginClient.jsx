'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function LoginClient({ initialBranding = null }) {
	const router = useRouter();

	const [formData, setFormData] = useState({ username: '', password: '', rememberMe: false });
	const [logoSekolah, setLogoSekolah] = useState(initialBranding?.logo || null);
	const [namaSekolah, setNamaSekolah] = useState(initialBranding?.nama || null);

	useEffect(() => {
		// Simpan branding awal ke localStorage agar sinkron dengan client
		if (typeof window !== 'undefined') {
			if (initialBranding?.logo) {
				localStorage.setItem('school_logo', initialBranding.logo);
			}
			if (initialBranding?.nama) {
				localStorage.setItem('school_name', initialBranding.nama);
			}
		}

		const searchParams = new URLSearchParams(window.location.search);
		if (searchParams.get('expired') === '1') {
			// Bersihkan sisa sesi dari server secara paksa
			fetch('/api/logout', { method: 'POST' }).catch(() => {});
			Swal.fire({
				icon: 'info',
				title: 'Sesi Berakhir',
				text: 'Waktu sesi Anda telah habis. Silakan login kembali.',
				confirmButtonColor: '#E8451A',
			});
			// Hapus parameter dari URL agar tidak muncul terus saat refresh
			router.replace('/login');
		}
	}, [router, initialBranding]);

	const [loading, setLoading] = useState(false);
	const [showPswd, setShowPswd] = useState(false);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.username || !formData.password) {
			Swal.fire('Login Gagal', 'Mohon isi username dan password.', 'warning');
			return;
		}

		setLoading(true);
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			const data = await res.json();

			if (res.ok) {
				const Toast = Swal.mixin({
					toast: true,
					position: 'top-end',
					showConfirmButton: false,
					timer: 2000,
					timerProgressBar: true,
				});

				Toast.fire({
					icon: 'success',
					title: `Selamat datang, ${data.user.nama_lengkap}!`,
				});

				// Simpan ke localStorage agar sinkronisasi client seketika tanpa jeda
				if (typeof window !== 'undefined') {
					localStorage.setItem('user_role', data.user.role);
					localStorage.setItem('user_name', data.user.nama_lengkap);
				}

				// Redirect ke Dashboard Home, Portal Admin, Kepsek, atau Bendahara berdasarkan Role
				if (data.user.role === 'Kepala Sekolah') {
					router.push('/kepsek');
				} else if (data.user.role === 'Bendahara') {
					router.push('/bendahara');
				} else if (data.user.role === 'Admin') {
					router.push('/admin');
				} else {
					router.push('/');
				}
			} else {
				Swal.fire('Gagal Masuk', data.error || 'Terjadi kesalahan.', 'error');
			}
		} catch (error) {
			Swal.fire('Error', 'Kesalahan server', 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden'>
			{/* Decorative elements for brutalist vibe */}
			<div className='absolute top-10 left-10 w-24 h-24 bg-yellow-300 border-[3px] border-black rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] hidden md:block animate-[spin_10s_linear_infinite]'></div>
			<div className='absolute bottom-10 right-10 w-32 h-32 bg-teal-400 border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] hidden md:block transform rotate-12'></div>

			{/* Header Branding */}
			<div className='relative sm:mx-auto sm:w-full sm:max-w-md text-center z-10 pt-4'>
				{/* Background Floating Elements */}
				<div className='absolute inset-0 pointer-events-none -z-10'>
					{/* Small floating yellow star on left */}
					<svg
						className='absolute -left-6 top-10 w-10 h-10 text-yellow-300 animate-[spin_10s_linear_infinite]'
						viewBox='0 0 24 24'
						fill='currentColor'>
						<path
							d='M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z'
							stroke='black'
							strokeWidth='2'
							strokeLinejoin='round'
						/>
					</svg>

					{/* Tiny dotted line on right */}
					<svg
						className='absolute -right-6 top-16 w-12 h-12 text-black opacity-40'
						viewBox='0 0 50 50'
						fill='none'>
						<circle cx='10' cy='10' r='3' fill='black' />
						<circle cx='30' cy='10' r='3' fill='black' />
						<circle cx='10' cy='30' r='3' fill='black' />
						<circle cx='30' cy='30' r='3' fill='black' />
					</svg>

					{/* Small teal square near bottom left */}
					<div className='absolute left-4 bottom-4 w-6 h-6 bg-teal-400 border-2 border-black transform -rotate-12 shadow-[2px_2px_0px_0px_#0D0D0D]'></div>
				</div>

				{/* Logo Showcase with Rich Neo-Brutalist Frame & Accents */}
				<div className='flex flex-col items-center justify-center mb-6 relative group'>
					{/* 1. Sparkle Star Top-Right */}
					<div className='absolute -top-3.5 -right-6 sm:-right-8 pointer-events-none select-none z-20'>
						<svg
							className='w-8 h-8 text-yellow-300 drop-shadow-[2px_2px_0px_#0D0D0D] animate-bounce'
							style={{ animationDuration: '3s' }}
							viewBox='0 0 24 24'
							fill='currentColor'>
							<path
								d='M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2L12 0Z'
								stroke='black'
								strokeWidth='2'
								strokeLinejoin='round'
							/>
						</svg>
					</div>

					{/* 2. Sparkle Star Bottom-Left */}
					<div className='absolute -bottom-2 -left-6 sm:-left-8 pointer-events-none select-none z-20'>
						<svg
							className='w-6 h-6 text-teal-300 drop-shadow-[2px_2px_0px_#0D0D0D] transform -rotate-12'
							viewBox='0 0 24 24'
							fill='currentColor'>
							<path
								d='M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2L12 0Z'
								stroke='black'
								strokeWidth='2'
								strokeLinejoin='round'
							/>
						</svg>
					</div>

					{/* 3. Layered Neo-Brutalist Card Frame */}
					<div className='relative flex items-center justify-center'>
						{/* Background Layer 2 (Teal Offset Shadow Card) */}
						<div className='absolute w-24 h-24 sm:w-28 sm:h-28 bg-teal-300 border-[3px] border-black rounded-2xl -translate-x-3 translate-y-3 -z-20 shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-6 transition-transform duration-300 group-hover:-rotate-12 group-hover:-translate-x-4'></div>

						{/* Background Layer 1 (Warm Peach/Orange Offset Card) */}
						<div className='absolute w-24 h-24 sm:w-28 sm:h-28 bg-orange-200 border-[3px] border-black rounded-2xl translate-x-3 -translate-y-2 -z-10 shadow-[4px_4px_0px_0px_#0D0D0D] transform rotate-6 transition-transform duration-300 group-hover:rotate-12 group-hover:translate-x-4'></div>

						{/* Main Interactive Logo Box */}
						{logoSekolah ? (
							<div className='w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-[3px] border-black p-3 flex items-center justify-center shadow-[6px_6px_0px_0px_#0D0D0D] transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[8px_8px_0px_0px_#0D0D0D] cursor-pointer relative z-10'>
								{/* Mini Verification Badge on Corner */}
								<div className='absolute -top-3 -right-3 px-2 py-0.5 bg-yellow-300 border-2 border-black rounded-md text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#0D0D0D] rotate-12 flex items-center gap-0.5 select-none'>
									<span className='text-amber-700'>★</span>
									<span>RESMI</span>
								</div>

								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={logoSekolah}
									alt='Logo Sekolah'
									className='w-full h-full object-contain filter drop-shadow-xs transition-transform duration-300 group-hover:scale-105'
								/>
							</div>
						) : (
							<div className='w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-orange-500 border-[3px] border-black flex items-center justify-center shadow-[6px_6px_0px_0px_#0D0D0D] transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[8px_8px_0px_0px_#0D0D0D] cursor-pointer relative z-10'>
								<svg
									className='w-14 h-14 text-black transition-transform duration-300 group-hover:scale-110'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth='2.5'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
									/>
								</svg>
							</div>
						)}
					</div>
				</div>

				{/* Nama Resmi Sekolah (Headline Utama jika tersedia dari Database) */}
				{namaSekolah && (
					<h2 className='text-lg sm:text-xl font-black text-black uppercase tracking-tight max-w-sm sm:max-w-md mx-auto px-4 mt-1 mb-1 leading-snug'>
						{namaSekolah}
					</h2>
				)}

				{/* Badge Tagline "Sistem Manajemen Akademika Digital" dengan Style Neo-Brutalist Badge */}
				<div className='mt-2 mb-2 flex items-center justify-center'>
					<div className='inline-flex items-center gap-2.5 px-4 py-2 bg-white border-[2.5px] border-black rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1 hover:rotate-0 transition-all duration-200 cursor-default'>
						{/* Icon Badge Kecil Bertema Edukasi */}
						<div className='w-5 h-5 rounded-md bg-yellow-300 border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#0D0D0D] shrink-0'>
							<svg
								className='w-3 h-3 text-black'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
								strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l9-5-9-5-9 5 9 5z' />
								<path strokeLinecap='round' strokeLinejoin='round' d='M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' />
							</svg>
						</div>

						{/* Teks Tagline */}
						<span className='text-[11px] sm:text-xs font-black uppercase tracking-wider text-black'>
							Sistem Manajemen Akademika Digital
						</span>
					</div>
				</div>
			</div>

			{/* Login Box */}
			<div className='mt-10 sm:mx-auto sm:w-full sm:max-w-md z-10'>
				<div className='bg-white py-8 px-4 border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] sm:rounded-2xl sm:px-10'>
					<form
						className='space-y-6'
						onSubmit={handleSubmit}>
						<div>
							<label
								htmlFor='username'
								className='block text-base font-bold text-black uppercase tracking-wider mb-2'>
								Username
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<svg
										className='h-6 w-6 text-black'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2.5'
											d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
										/>
									</svg>
								</div>
								<input
									id='username'
									name='username'
									type='text'
									required
									value={formData.username}
									onChange={handleChange}
									className='block w-full pl-12 pr-4 py-3.5 bg-gray-50 border-[3px] border-black rounded-xl text-black font-bold placeholder-gray-500 focus:outline-hidden focus:bg-yellow-50 focus:border-black focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all text-base'
									placeholder='Masukkan Username'
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor='password'
								className='block text-base font-bold text-black uppercase tracking-wider mb-2'>
								Password
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<svg
										className='h-6 w-6 text-black'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2.5'
											d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
										/>
									</svg>
								</div>
								<input
									id='password'
									name='password'
									type={showPswd ? 'text' : 'password'}
									required
									value={formData.password}
									onChange={handleChange}
									className='block w-full pl-12 pr-12 py-3.5 bg-gray-50 border-[3px] border-black rounded-xl text-black font-bold placeholder-gray-500 focus:outline-hidden focus:bg-yellow-50 focus:border-black focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all text-base'
									placeholder='••••••••'
								/>
								<button
									type='button'
									onClick={() => setShowPswd(!showPswd)}
									className='absolute inset-y-0 right-0 pr-4 flex items-center text-black hover:text-orange-600 transition-colors cursor-pointer'>
									{showPswd ? (
										<svg
											className='h-6 w-6'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth='2.5'
												d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
											/>
										</svg>
									) : (
										<svg
											className='h-6 w-6'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth='2.5'
												d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
											/>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth='2.5'
												d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
											/>
										</svg>
									)}
								</button>
							</div>
						</div>

						<div className='flex items-center justify-between'>
							<div className='flex items-center'>
								<input
									id='rememberMe'
									name='rememberMe'
									type='checkbox'
									checked={formData.rememberMe}
									onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
									className='h-5 w-5 text-orange-600 focus:ring-0 border-2 border-black rounded-sm cursor-pointer accent-orange-500'
								/>
								<label
									htmlFor='rememberMe'
									className='ml-2 block text-sm font-bold text-black select-none cursor-pointer'>
									Ingat Saya
								</label>
							</div>
						</div>

						<div>
							<button
								type='submit'
								disabled={loading}
								className={`w-full flex justify-center py-4 px-4 border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] text-lg font-black uppercase text-white bg-orange-500 hover:bg-orange-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer ${
									loading ? 'opacity-80 cursor-not-allowed' : ''
								}`}>
								{loading ? (
									<>
										<svg
											className='animate-spin -ml-1 mr-3 h-6 w-6 text-white'
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
										Memuat...
									</>
								) : (
									'Masuk Dasbor'
								)}
							</button>
						</div>
					</form>
				</div>
			</div>

			{/* Footer Copyright (Center Aligned) */}
			<footer className='mt-8 sm:mt-10 w-full flex justify-center items-center z-10 px-4'>
				<div className='relative inline-block text-center'>
					<div className='absolute inset-0 bg-yellow-300 border-2 border-black rounded-lg transform translate-x-1.5 translate-y-1.5'></div>
					<div className='relative bg-white border-2 border-black rounded-lg px-6 py-2.5 font-bold text-black text-xs sm:text-sm uppercase text-center shadow-xs'>
						Copyright &copy; {new Date().getFullYear()} GWA. <br className='sm:hidden' /> All Rights Reserved.
					</div>
				</div>
			</footer>
		</div>
	);
}
