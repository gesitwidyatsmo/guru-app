'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function LoginPage() {
	const router = useRouter();

	const [formData, setFormData] = useState({ username: '', password: '' });
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
					router.push('/admin/pengguna');
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
		<div className='min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8'>
			{/* Header Branding */}
			<div className='sm:mx-auto sm:w-full sm:max-w-md text-center'>
				<div className='flex justify-center mb-6'>
					<div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 transform rotate-3'>
						<svg
							className='w-10 h-10 text-white transform -rotate-3'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
							/>
						</svg>
					</div>
				</div>
				<h2 className='text-3xl font-extrabold text-slate-900 tracking-tight'>Guru-App Space</h2>
				<p className='mt-2 text-sm text-slate-600 font-medium'>Sistem Manajemen Akademika Digital</p>
			</div>

			{/* Login Box */}
			<div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div className='bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100'>
					<form
						className='space-y-6'
						onSubmit={handleSubmit}>
						<div>
							<label
								htmlFor='username'
								className='block text-sm font-semibold text-slate-700'>
								Username / Email
							</label>
							<div className='mt-2 relative'>
								<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
									<svg
										className='h-5 w-5 text-slate-400'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
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
									className='appearance-none block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all'
									placeholder='ID Guru Pendamping'
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor='password'
								className='block text-sm font-semibold text-slate-700'>
								Kata Sandi
							</label>
							<div className='mt-2 relative'>
								<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
									<svg
										className='h-5 w-5 text-slate-400'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
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
									className='appearance-none block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all'
									placeholder='••••••••'
								/>
								<button
									type='button'
									onClick={() => setShowPswd(!showPswd)}
									className='absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 focus:outline-none'>
									{showPswd ? (
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={1.5}
											stroke='currentColor'
											className='w-5 h-5'>
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
											strokeWidth={1.5}
											stroke='currentColor'
											className='w-5 h-5'>
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

						<div className='flex items-center justify-between'>
							<div className='flex items-center'>
								<input
									id='remember-me'
									name='remember-me'
									type='checkbox'
									className='h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded'
								/>
								<label
									htmlFor='remember-me'
									className='ml-2 block text-sm text-slate-900'>
									Simpan Sesi Masuk
								</label>
							</div>

							<div className='text-sm'>
								<a
									href='#'
									className='font-semibold text-indigo-600 hover:text-indigo-500'>
									Lupa Sandi?
								</a>
							</div>
						</div>

						<div>
							<button
								type='submit'
								disabled={loading}
								className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all transform hover:-translate-y-0.5 ${
									loading
										? 'bg-indigo-400 cursor-wait'
										: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:shadow-lg'
								}`}>
								{loading ? (
									<>
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
										Otentikasi...
									</>
								) : (
									'Masuk Dasbor'
								)}
							</button>
						</div>
					</form>
				</div>

				{/* Footer Copy */}
				<p className='mt-8 text-center text-xs text-slate-500 font-medium'>
					&copy; {new Date().getFullYear()} Hak Akses Terbatas. <br /> Hanya untuk Lingkungan Tenaga Pendidik.
				</p>
			</div>
		</div>
	);
}
