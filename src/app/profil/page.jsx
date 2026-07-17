'use client';

import { useState, useEffect } from 'react';
import Loader from '../components/loading';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import { ChevronLeft, Save, ShieldAlert, GraduationCap, BookOpen, AlertTriangle } from 'lucide-react';

// Neobrutalism SweetAlert Mixin
const brutalSwal = Swal.mixin({
	customClass: {
		popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
		title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
		htmlContainer: 'font-bold text-[#0D0D0D]',
		confirmButton: 'bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
		cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
	},
	buttonsStyling: false
});

export default function ProfilAjarPage() {
	const router = useRouter();
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
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				
				if (!user) {
					router.push('/login');
					return;
				}

				const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single();
				if (profile) {
					const userData = {
						id_user: profile.id_user,
						username: profile.username,
						nama_lengkap: profile.nama_lengkap,
						role: profile.role
					};
					setUserProfile(userData);
					setFormData((prev) => ({ ...prev, nama_lengkap: profile.nama_lengkap || '' }));

					// Cegah Admin mengakses laman Profil Ajar khusus Guru
					if (profile.role === 'Admin') {
						router.push('/');
						return;
					}

					// Ambil KBM
					const { data: myData } = await supabase.from('guru_kbm').select('kelas, mapel').eq('id_user', profile.id_user);
					if (myData) {
						const myClassesSet = [...new Set(myData.map(r => r.kelas).filter(val => val && val.trim() !== ''))];
						const myMapelsSet = [...new Set(myData.map(r => r.mapel).filter(val => val && val.trim() !== ''))];
						
						setMyClasses(myClassesSet);
						setMyMapels(myMapelsSet);
					}
				} else {
					router.push('/login');
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
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('SESI TIDAK DITEMUKAN. SILAKAN LOGIN ULANG.');

			// Update users table
			const updates = { nama_lengkap: formData.nama_lengkap };
			const { error: userError } = await supabase.from('users').update(updates).eq('auth_id', user.id);
			if (userError) throw userError;

			// Update password in Auth if provided
			if (formData.password_baru && formData.password_baru.trim() !== '') {
				const { error: authError } = await supabase.auth.updateUser({
					password: formData.password_baru,
				});
				if (authError) throw authError;
			}

			brutalSwal.fire({
				icon: 'success',
				title: 'SUKSES DIPERBARUI!',
				text: 'PROFIL ANDA BERHASIL DISIMPAN!',
				timer: 2000,
				showConfirmButton: false,
			});
			setUserProfile((prev) => ({ ...prev, nama_lengkap: formData.nama_lengkap }));
			setFormData((prev) => ({ ...prev, password_baru: '' }));
		} catch (error) {
			brutalSwal.fire({
				icon: 'error',
				title: 'ERROR',
				text: error.message || 'TERJADI KESALAHAN SISTEM',
			});
		} finally {
			setLoadingSubmit(false);
		}
	};

	if (loadingPage) return <Loader />;

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
				
				{/* Header Navigasi */}
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<button
						onClick={handleBack}
						className='w-fit p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-2 shadow-[4px_4px_0px_0px_#0D0D0D] shrink-0 self-start sm:self-auto'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>PROFIL SAYA</h1>
					</div>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-8 items-start'>
					{/* Kolom Kiri - Info Akun & Form */}
					<div className='md:col-span-2 space-y-8'>
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none p-6 md:p-10 relative overflow-hidden'>
							{/* Deco */}
							<div className='absolute -right-6 -top-6 w-24 h-24 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rotate-45 z-0'></div>

							<div className='flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10 relative z-10'>
								<div className='w-24 h-24 bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-[#0D0D0D] text-4xl font-black rotate-[-3deg] shrink-0'>
									{userProfile.nama_lengkap?.charAt(0).toUpperCase() || 'U'}
								</div>
								<div>
									<h1 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>{userProfile.nama_lengkap}</h1>
									<div className='flex flex-wrap items-center gap-3'>
										<span className='inline-flex items-center gap-2 bg-[#A3E635] border-[3px] border-[#0D0D0D] px-3 py-1 font-black uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_#0D0D0D]'>
											<ShieldAlert className='w-4 h-4' strokeWidth={3} />
											{userProfile.role} GURU
										</span>
										<span className='bg-white border-[3px] border-[#0D0D0D] px-3 py-1 font-bold uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_#0D0D0D]'>
											@{userProfile.username}
										</span>
									</div>
								</div>
							</div>

							<form onSubmit={handleSubmit} className='space-y-6 relative z-10'>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>NAMA LENGKAP</label>
									<input
										type='text'
										name='nama_lengkap'
										value={formData.nama_lengkap}
										onChange={handleChange}
										placeholder='NAMA LENGKAP BERSERTA GELAR...'
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all placeholder:text-gray-400'
										required
									/>
								</div>

								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										UBAH KATA SANDI <span className='text-[#E8451A] bg-[#FFF5F0] px-2 py-0.5 border-[2px] border-[#0D0D0D] ml-2 text-xs'>OPSIONAL</span>
									</label>
									<input
										type='password'
										name='password_baru'
										value={formData.password_baru}
										onChange={handleChange}
										placeholder='KOSONGKAN JIKA TIDAK INGIN DIUBAH'
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all placeholder:text-gray-400'
									/>
								</div>

								<div className='pt-6 border-t-[4px] border-[#0D0D0D]'>
									<button
										type='submit'
										disabled={loadingSubmit}
										className='w-full h-[60px] bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] rounded-none hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex justify-center items-center gap-3 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#0D0D0D]'>
										{loadingSubmit ? (
											<svg className='animate-spin h-6 w-6 text-white' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
												<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
												<path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
											</svg>
										) : (
											<>
												<Save className='w-6 h-6' strokeWidth={3} />
												SIMPAN PROFIL
											</>
										)}
									</button>
								</div>
							</form>
						</div>
					</div>

					{/* Kolom Kanan - Ringkasan Ajar */}
					<div className='space-y-8'>
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
							<h3 className='text-lg font-black text-white uppercase tracking-widest flex items-center gap-3 p-4 bg-[#0D0D0D] border-b-[4px] border-[#0D0D0D]'>
								<GraduationCap className='w-6 h-6 text-[#A3E635]' strokeWidth={3} /> KELAS TERTAUT
							</h3>
							<div className='p-5'>
								{myClasses.length === 0 ? (
									<div className='text-center py-6 bg-[#FFF5F0] border-[3px] border-[#0D0D0D] rotate-1'>
										<p className='text-sm text-[#0D0D0D] font-black uppercase tracking-widest'>BELUM ADA KELAS TERTAUT</p>
									</div>
								) : (
									<div className='flex flex-wrap gap-3'>
										{myClasses.map((kls, i) => (
											<span
												key={i}
												className='bg-[#A3E635] text-[#0D0D0D] px-3 py-2 text-sm font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all'>
												{kls}
											</span>
										))}
									</div>
								)}
							</div>
						</div>

						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
							<h3 className='text-lg font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-3 p-4 bg-[#FF90E8] border-b-[4px] border-[#0D0D0D]'>
								<BookOpen className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} /> MAPEL TERTAUT
							</h3>
							<div className='p-5'>
								{myMapels.length === 0 ? (
									<div className='text-center py-6 bg-[#FFF5F0] border-[3px] border-[#0D0D0D] -rotate-1'>
										<p className='text-sm text-[#0D0D0D] font-black uppercase tracking-widest'>BELUM ADA MAPEL TERTAUT</p>
									</div>
								) : (
									<div className='flex flex-wrap gap-3'>
										{myMapels.map((mpl, i) => (
											<span
												key={i}
												className='bg-[#FF90E8] text-[#0D0D0D] px-3 py-2 text-sm font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all'>
												{mpl}
											</span>
										))}
									</div>
								)}
							</div>
						</div>

						<div className='bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] -rotate-1'>
							<div className='flex gap-3'>
								<AlertTriangle className='w-8 h-8 text-[#0D0D0D] shrink-0' strokeWidth={3} />
								<p className='text-sm text-[#0D0D0D] font-black uppercase tracking-widest leading-relaxed'>
									UNTUK MENAUTKAN JAM AJAR TAMBAHAN, SILAKAN KUNJUNGI MENU <span className='bg-white px-2 py-0.5 border-[2px] border-[#0D0D0D] ml-1 mr-1'>"CEKLIS AJAR"</span> PADA DASBOR UTAMA.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
