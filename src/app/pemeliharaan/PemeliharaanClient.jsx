'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function PemeliharaanClient({ initialBranding = null, initialMaintenance = null }) {
	const router = useRouter();

	const [branding] = useState(initialBranding || {});
	const [maintenance, setMaintenance] = useState(
		initialMaintenance || {
			enabled: true,
			pesan: 'Mohon maaf atas ketidaknyamanannya. Website GuruApp saat ini sedang menjalani proses pemeliharaan dan pembaruan sistem secara berkala untuk meningkatkan stabilitas dan performa aplikasi.',
			estimasi_selesai: 'Segera Kembali',
			kontak_bantuan: '081277813478',
		}
	);

	const [isChecking, setIsChecking] = useState(false);
	const [userRole, setUserRole] = useState(null);
	const [showLoginModal, setShowLoginModal] = useState(false);
	const [loginForm, setLoginForm] = useState({ username: '', password: '' });
	const [loginLoading, setLoginLoading] = useState(false);
	const [loginError, setLoginError] = useState('');

	// Cek status role saat ini dari cookie / localStorage
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const role = localStorage.getItem('user_role');
			setUserRole(role);
		}
	}, []);

	// Auto-polling status pemeliharaan setiap 15 detik
	useEffect(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch('/api/maintenance?refresh=1', { cache: 'no-store' });
				if (res.ok) {
					const data = await res.json();
					setMaintenance(data);
					if (data.enabled === false) {
						// Jika pemeliharaan dinonaktifkan oleh admin
						Swal.fire({
							icon: 'success',
							title: 'Pemeliharaan Selesai!',
							text: 'Sistem telah aktif kembali. Mengalihkan ke aplikasi...',
							timer: 2500,
							showConfirmButton: false,
						}).then(() => {
							router.push('/');
						});
					}
				}
			} catch (err) {
				console.debug('Polling maintenance status error:', err);
			}
		}, 15000);

		return () => clearInterval(interval);
	}, [router]);

	// Fungsi manual cek status
	const handleCheckStatus = async () => {
		setIsChecking(true);
		try {
			const res = await fetch('/api/maintenance?refresh=1', { cache: 'no-store' });
			if (res.ok) {
				const data = await res.json();
				setMaintenance(data);
				if (!data.enabled) {
					Swal.fire({
						icon: 'success',
						title: 'Website Sudah Aktif!',
						text: 'Pemeliharaan sistem telah selesai. Mengalihkan ke halaman utama...',
						timer: 2000,
						showConfirmButton: false,
					}).then(() => {
						router.push('/');
					});
				} else {
					Swal.fire({
						icon: 'info',
						title: 'Masih Dalam Pemeliharaan',
						text: 'Sistem kami masih dalam proses penyempurnaan. Mohon tunggu beberapa saat lagi.',
						confirmButtonColor: '#E8451A',
					});
				}
			}
		} catch (error) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memeriksa',
				text: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setIsChecking(false);
		}
	};

	// Handle Admin Login dari Modal
	const handleAdminLogin = async (e) => {
		e.preventDefault();
		if (!loginForm.username || !loginForm.password) {
			setLoginError('Username dan password wajib diisi.');
			return;
		}

		setLoginLoading(true);
		setLoginError('');

		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: loginForm.username,
					password: loginForm.password,
					rememberMe: true,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				if (data.user?.role === 'Admin') {
					if (typeof window !== 'undefined') {
						localStorage.setItem('user_role', data.user.role);
						localStorage.setItem('user_name', data.user.nama_lengkap);
					}
					setShowLoginModal(false);
					Swal.fire({
						icon: 'success',
						title: `Selamat datang, ${data.user.nama_lengkap}!`,
						text: 'Akses Administrator berhasil dibuka.',
						timer: 1800,
						showConfirmButton: false,
					}).then(() => {
						router.push('/admin/pemeliharaan');
					});
				} else {
					setLoginError('Akun ini bukan Administrator. Selama pemeliharaan, hanya Admin yang dapat mengakses sistem.');
				}
			} else {
				setLoginError(data.error || 'Kredensial tidak valid.');
			}
		} catch (err) {
			setLoginError('Terjadi kesalahan koneksi saat login.');
		} finally {
			setLoginLoading(false);
		}
	};

	const waNumber = maintenance?.kontak_bantuan
		? maintenance.kontak_bantuan.replace(/[^0-9]/g, '').replace(/^0/, '62')
		: '';

	const schoolName = branding?.nama || 'SMP IT TEBUIRENG 4 AL-ISHLAH';
	const schoolLogo = branding?.logo || '/logo smp.png';

	return (
		<div className='min-h-screen bg-[#FFF5F0] flex flex-col justify-between selection:bg-yellow-300 selection:text-black relative overflow-x-hidden'>
			{/* Background Pattern Elements (Neo-brutalist dots & shapes) */}
			<div
				className='absolute inset-0 pointer-events-none opacity-40'
				style={{
					backgroundImage: 'radial-gradient(#0D0D0D 1.2px, transparent 1.2px)',
					backgroundSize: '24px 24px',
				}}
			/>

			{/* Top Bar Banner jika Login sebagai Admin */}
			{userRole === 'Admin' && (
				<div className='relative z-30 bg-yellow-300 border-b-2 border-black py-2.5 px-4 text-center text-xs sm:text-sm font-bold flex flex-wrap items-center justify-center gap-3 shadow-[0_2px_0_0_#0D0D0D]'>
					<span className='inline-flex items-center gap-1.5'>
						<span className='w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse' />
						<span>Anda terautentikasi sebagai <strong>Administrator</strong> (Bypass Aktif).</span>
					</span>
					<div className='flex items-center gap-2'>
						<Link
							href='/admin'
							className='px-3 py-1 bg-white hover:bg-black hover:text-white border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'
						>
							Dashboard Admin
						</Link>
						<Link
							href='/admin/pemeliharaan'
							className='px-3 py-1 bg-[#E8451A] text-white hover:bg-orange-600 border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'
						>
							Kelola Pemeliharaan
						</Link>
					</div>
				</div>
			)}

			{/* Main Content Area */}
			<main className='relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8'>
				<div className='w-full max-w-2xl'>
					{/* Status Inactive Notification (Jika Admin membuka saat mode mati) */}
					{maintenance?.enabled === false && (
						<div className='mb-6 p-4 bg-emerald-100 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] text-center'>
							<p className='font-bold text-sm text-emerald-900'>
								ℹ️ Status: Mode Pemeliharaan saat ini <strong>NONAKTIF</strong>. Sistem sedang beroperasi secara normal.
							</p>
							<Link
								href='/'
								className='mt-2 inline-block px-4 py-1.5 bg-emerald-500 text-white font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-x-[1px] hover:translate-y-[1px]'
							>
								Buka Halaman Utama
							</Link>
						</div>
					)}

					{/* Card Utama Pemeliharaan */}
					<div className='bg-white border-[3px] border-black rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_0px_#0D0D0D] relative'>
						{/* Top Header Sekolah */}
						<div className='flex items-center justify-center gap-3 pb-6 border-b-2 border-dashed border-gray-300'>
							{schoolLogo && (
								<img
									src={schoolLogo}
									alt='Logo Sekolah'
									className='w-10 h-10 sm:w-12 sm:h-12 object-contain'
									onError={(e) => {
										e.currentTarget.src = '/logo smp.png';
									}}
								/>
							)}
							<div className='text-left'>
								<h2 className='text-sm sm:text-base font-black tracking-tight text-gray-900 leading-tight'>
									{schoolName}
								</h2>
								<p className='text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider'>
									Portal Sistem Akademik GuruApp
								</p>
							</div>
						</div>

						{/* Ilustrasi Pemeliharaan dari public/Pemeliharaan */}
						<div className='my-6 sm:my-8 text-center flex flex-col items-center justify-center'>
							<div className='relative inline-block max-w-[280px] sm:max-w-[340px]'>
								<img
									src='/Pemeliharaan/Maintenance Signboard with Two Supports.png'
									alt='Papan Pemeliharaan Sistem'
									className='w-full h-auto object-contain transition-transform duration-300 hover:scale-105 select-none drop-shadow-md'
									onError={(e) => {
										// Fallback jika nama file lain
										e.currentTarget.src = '/Pemeliharaan/maintenance.png';
									}}
								/>
							</div>

							{/* Badge Status Berkedip */}
							<div className='mt-6 inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-300 border-2 border-black rounded-full font-black text-xs sm:text-sm uppercase shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<span className='relative flex h-3 w-3'>
									<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75'></span>
									<span className='relative inline-flex rounded-full h-3 w-3 bg-red-600'></span>
								</span>
								<span>Sistem Dalam Pemeliharaan</span>
							</div>
						</div>

						{/* Judul & Deskripsi */}
						<div className='text-center space-y-3'>
							<h1 className='text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-tight'>
								Kami Segera Kembali!
							</h1>
							<p className='text-sm sm:text-base text-gray-700 leading-relaxed max-w-xl mx-auto font-medium'>
								{maintenance?.pesan ||
									'Website GuruApp saat ini sedang menjalani proses pemeliharaan dan pembaruan sistem secara berkala untuk meningkatkan kualitas layanan dan performa aplikasi.'}
							</p>
						</div>

						{/* Info Estimasi Waktu */}
						{maintenance?.estimasi_selesai && (
							<div className='mt-6 p-3.5 bg-amber-50 border-2 border-black rounded-2xl flex items-center justify-center gap-3 text-center shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<svg
									className='w-5 h-5 text-amber-800 shrink-0'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth='2.5'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
									/>
								</svg>
								<div className='text-xs sm:text-sm font-bold text-amber-950'>
									Estimasi Selesai:{' '}
									<span className='font-black underline decoration-2 decoration-amber-500'>
										{maintenance.estimasi_selesai}
									</span>
								</div>
							</div>
						)}

						{/* Tombol Aksi */}
						<div className='mt-8 pt-6 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-center gap-3'>
							{/* Tombol Cek Status */}
							<button
								type='button'
								onClick={handleCheckStatus}
								disabled={isChecking}
								className='w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:opacity-50'
							>
								<svg
									className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`}
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth='2.5'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
									/>
								</svg>
								<span>{isChecking ? 'Memeriksa...' : 'Periksa Status Sistem'}</span>
							</button>

							{/* Tombol Kontak WhatsApp */}
							{waNumber && (
								<a
									href={`https://wa.me/${waNumber}?text=Halo%20Admin,%20saya%20ingin%20menanyakan%20perihal%20pemeliharaan%20sistem%20GuruApp.`}
									target='_blank'
									rel='noopener noreferrer'
									className='w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-400 hover:bg-emerald-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#0D0D0D] transition-all'
								>
									<svg
										className='w-4 h-4 text-black'
										fill='currentColor'
										viewBox='0 0 24 24'
									>
										<path d='M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.698.077-2.023-.473-1.637-.679-2.69-2.348-2.77-2.457-.082-.109-.664-.882-.664-1.682 0-.8.419-1.194.568-1.354.149-.16.326-.2.435-.2.11 0 .219.002.316.006.102.005.239-.039.373.285.14.339.479 1.168.52 1.253.042.085.07.185.014.296-.056.11-.084.181-.168.278-.084.098-.178.219-.253.294-.085.086-.174.179-.075.349.099.171.44 1.054.945 1.503.651.58 1.201.76 1.371.846.171.085.271.071.373-.043.102-.114.437-.509.553-.684.116-.175.232-.146.39-.088.158.058 1.002.472 1.175.558.172.086.287.129.33.202.043.073.043.422-.101.827z' />
									</svg>
									<span>Hubungi Admin</span>
								</a>
							)}
						</div>
					</div>

					{/* Footer & Link Akses Admin Tersembunyi/Discreet */}
					<div className='mt-6 text-center space-y-2'>
						<p className='text-xs font-bold text-gray-500'>
							Terima kasih atas kesabaran dan kerja sama Anda.
						</p>
						<button
							type='button'
							onClick={() => setShowLoginModal(true)}
							className='inline-flex items-center gap-1.5 text-[11px] font-black text-gray-600 hover:text-black underline underline-offset-4 decoration-dashed transition-colors cursor-pointer py-1 px-2'
						>
							<svg
								className='w-3.5 h-3.5'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								strokeWidth='2'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
								/>
							</svg>
							<span>Akses Administrator</span>
						</button>
					</div>
				</div>
			</main>

			{/* Modal Login Admin Saat Pemeliharaan Aktif */}
			{showLoginModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn'>
					<div className='bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#0D0D0D] relative'>
						{/* Close Button */}
						<button
							type='button'
							onClick={() => setShowLoginModal(false)}
							className='absolute top-4 right-4 p-1.5 bg-gray-100 hover:bg-gray-200 border-2 border-black rounded-xl text-black font-black transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'
						>
							<svg
								className='w-5 h-5'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								strokeWidth='2.5'
							>
								<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
							</svg>
						</button>

						<div className='text-center mb-6'>
							<div className='w-12 h-12 bg-yellow-300 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<svg
									className='w-6 h-6 text-black'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth='2.5'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z'
									/>
								</svg>
							</div>
							<h3 className='text-xl font-black text-gray-900'>Login Administrator</h3>
							<p className='text-xs font-bold text-gray-600 mt-1'>
								Masuk untuk mengelola sistem atau membuka kunci pemeliharaan.
							</p>
						</div>

						{loginError && (
							<div className='mb-4 p-3 bg-red-100 border-2 border-black rounded-xl text-xs font-bold text-red-900 shadow-[2px_2px_0px_0px_#0D0D0D]'>
								⚠️ {loginError}
							</div>
						)}

						<form onSubmit={handleAdminLogin} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Username Admin
								</label>
								<input
									type='text'
									required
									value={loginForm.username}
									onChange={(e) =>
										setLoginForm({ ...loginForm, username: e.target.value })
									}
									placeholder='Masukkan username admin'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Password
								</label>
								<input
									type='password'
									required
									value={loginForm.password}
									onChange={(e) =>
										setLoginForm({ ...loginForm, password: e.target.value })
									}
									placeholder='Masukkan password'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div className='pt-2'>
								<button
									type='submit'
									disabled={loginLoading}
									className='w-full py-3 bg-[#E8451A] hover:bg-orange-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-white font-black text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:opacity-50'
								>
									{loginLoading ? 'Memverifikasi...' : 'Masuk Sebagai Admin'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
