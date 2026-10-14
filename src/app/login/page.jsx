'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function LoginPage() {
	const router = useRouter();

	const [formData, setFormData] = useState({ username: '', password: '', rememberMe: false });

	useEffect(() => {
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
	}, [router]);
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

				// Redirect ke Dashboard Home atau Portal Admin berdasarkan Role
				if (data.user.role === 'Admin') {
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
						<circle
							cx='10'
							cy='10'
							r='3'
							fill='black'
						/>
						<circle
							cx='30'
							cy='10'
							r='3'
							fill='black'
						/>
						<circle
							cx='10'
							cy='30'
							r='3'
							fill='black'
						/>
						<circle
							cx='30'
							cy='30'
							r='3'
							fill='black'
						/>
					</svg>

					{/* Small teal square near bottom left */}
					<div className='absolute left-4 bottom-4 w-6 h-6 bg-teal-400 border-2 border-black transform -rotate-12 shadow-[2px_2px_0px_0px_#0D0D0D]'></div>
				</div>

				<div className='flex justify-center mb-8 relative'>
					{/* Simple offset square behind logo */}
					<div className='absolute top-1/2 left-1/2 w-20 h-20 bg-orange-200 border-[3px] border-black rounded-xl -translate-x-4 -translate-y-4 -z-20 shadow-[4px_4px_0px_0px_#0D0D0D] transform rotate-3'></div>

					<div className='w-20 h-20 rounded-xl bg-orange-500 border-[3px] border-black flex items-center justify-center shadow-[6px_6px_0px_0px_#0D0D0D] transform hover:-rotate-6 transition-transform cursor-pointer relative z-10'>
						<svg
							className='w-12 h-12 text-black'
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
				</div>

				<h2 className='text-4xl sm:text-5xl font-black text-black tracking-tight uppercase'>Guru-App</h2>

				<div className='mt-6 mb-2'>
					<p className='text-xs sm:text-sm text-black font-bold border-[3px] border-black bg-white inline-block px-4 py-1.5 rounded-full shadow-[4px_4px_0px_0px_#0D0D0D]'>
						Sistem Manajemen Akademika Digital
					</p>
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
								Username / Email
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
									autoComplete='username'
									className='appearance-none block w-full pl-12 pr-4 py-3 border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-none focus:translate-x-[4px] focus:translate-y-[4px] outline-none text-black font-bold placeholder-gray-400 sm:text-base transition-all bg-yellow-50 focus:bg-white'
									placeholder='ID GURU PENDAMPING'
								/>
							</div>
						</div>

						<div className='mt-6'>
							<label
								htmlFor='password'
								className='block text-base font-bold text-black uppercase tracking-wider mb-2'>
								Kata Sandi
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
									autoComplete='current-password'
									className='appearance-none block w-full pl-12 pr-12 py-3 border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-none focus:translate-x-[4px] focus:translate-y-[4px] outline-none text-black font-bold placeholder-gray-400 sm:text-base transition-all bg-yellow-50 focus:bg-white tracking-widest'
									placeholder='••••••••'
								/>
								<button
									type='button'
									onClick={() => setShowPswd(!showPswd)}
									className='absolute inset-y-0 right-0 pr-4 flex items-center text-black hover:text-blue-600 focus:outline-none'>
									{showPswd ? (
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2}
											stroke='currentColor'
											className='w-6 h-6'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88'
											/>
										</svg>
									) : (
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2}
											stroke='currentColor'
											className='w-6 h-6'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'
											/>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
											/>
										</svg>
									)}
								</button>
							</div>
						</div>

						<div className='flex items-center justify-between mt-6 mb-8'>
							<div className='flex items-center cursor-pointer group'>
								<div className='relative flex items-center'>
									<input
										id='remember-me'
										name='rememberMe'
										type='checkbox'
										checked={formData.rememberMe}
										onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
										className='peer appearance-none h-6 w-6 border-2 border-black rounded bg-white checked:bg-black transition-colors cursor-pointer'
									/>
									<svg
										className='absolute w-4 h-4 text-white left-1 pointer-events-none hidden peer-checked:block'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
										strokeWidth='4'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M5 13l4 4L19 7'
										/>
									</svg>
								</div>
								<label
									htmlFor='remember-me'
									className='ml-3 block text-sm font-bold text-black uppercase cursor-pointer group-hover:underline decoration-2 underline-offset-4'>
									Simpan Sesi
								</label>
							</div>

							<div className='text-sm'>
								<a
									href='#'
									className='font-bold text-black uppercase hover:bg-yellow-300 px-2 py-1 rounded border-2 border-transparent hover:border-black transition-all'>
									Lupa Sandi?
								</a>
							</div>
						</div>

						<div className='mt-8'>
							<button
								type='submit'
								disabled={loading}
								className={`w-full flex justify-center items-center gap-2 py-4 px-4 border-[3px] border-black rounded-xl text-lg font-black uppercase tracking-widest transition-all ${
									loading
										? 'bg-gray-300 text-gray-500 cursor-wait shadow-[4px_4px_0px_0px_#0D0D0D]'
										: 'bg-blue-500 text-white shadow-[6px_6px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px]'
								}`}>
								{loading ? (
									<>
										<svg
											className='animate-spin h-6 w-6 text-gray-500'
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

				{/* Footer Copy */}
				<div className='mt-8 relative inline-block mx-auto'>
					<div className='absolute inset-0 bg-yellow-300 border-2 border-black rounded-lg transform translate-x-1.5 translate-y-1.5'></div>
					<div className='relative bg-white border-2 border-black rounded-lg px-6 py-3 font-bold text-black text-xs sm:text-sm uppercase text-center'>
						Copyright &copy; {new Date().getFullYear()} Gesit Widi Atmoko. <br className='sm:hidden' /> All Rights Reserved.
					</div>
				</div>
			</div>
		</div>
	);
}
