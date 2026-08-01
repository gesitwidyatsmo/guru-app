'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, User, Hash, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SoalPortal() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [fetchingSiswa, setFetchingSiswa] = useState(false);

	const [form, setForm] = useState({
		pin: '',
		nama: '',
		kelas: '',
		absen: '',
		siswa_id: '',
	});

	// Fetch daftar kelas saat komponen dimuat
	useEffect(() => {
		const fetchKelas = async () => {
			try {
				const res = await fetch('/api/kelas?all=true');
				if (res.ok) {
					const data = await res.json();
					setKelasList(data);
				}
			} catch (error) {
				console.error('Failed to fetch kelas', error);
			}
		};
		fetchKelas();
	}, []);

	// Fetch daftar siswa saat kelas berubah
	useEffect(() => {
		if (!form.kelas) {
			setSiswaList([]);
			setForm(prev => ({ ...prev, nama: '', absen: '', siswa_id: '' }));
			return;
		}

		const fetchSiswa = async () => {
			setFetchingSiswa(true);
			try {
				const res = await fetch(`/api/siswa?kelas=${encodeURIComponent(form.kelas)}`);
				if (res.ok) {
					const data = await res.json();
					setSiswaList(data);
				}
			} catch (error) {
				console.error('Failed to fetch siswa', error);
			} finally {
				setFetchingSiswa(false);
			}
		};
		fetchSiswa();
	}, [form.kelas]);

	const handleSiswaChange = (e) => {
		const selectedNama = e.target.value;
		const selectedSiswa = siswaList.find(s => s.nama_lengkap === selectedNama);
		if (selectedSiswa) {
			// Jika nomor absen tidak ada di DB, kita buat urutan sementara berdasarkan index (jika disortir abjad)
			const index = siswaList.findIndex(s => s.nama_lengkap === selectedNama) + 1;
			setForm(prev => ({ 
				...prev, 
				nama: selectedSiswa.nama_lengkap, 
				siswa_id: selectedSiswa.id,
				absen: selectedSiswa.absen || index.toString()
			}));
		} else {
			setForm(prev => ({ ...prev, nama: '', absen: '', siswa_id: '' }));
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!form.pin || !form.nama || !form.kelas || !form.absen) {
			Swal.fire({
				title: 'PERHATIAN!',
				text: 'Semua kolom wajib diisi!',
				icon: 'warning',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#0D0D0D] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		setLoading(true);

		try {
			const res = await fetch('/api/soal/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin: form.pin }),
			});

			const data = await res.json();

			if (res.ok) {
				localStorage.setItem('siswa_nama', form.nama);
				localStorage.setItem('siswa_kelas', form.kelas);
				localStorage.setItem('siswa_absen', form.absen);
				localStorage.setItem('siswa_id', form.siswa_id);

				router.push(`/soal/kerjakan/${form.pin.toUpperCase()}?absen=${form.absen}`);
			} else {
				Swal.fire({
					title: 'AKSES DITOLAK!',
					text: data.error || 'PIN yang Anda masukkan salah.',
					icon: 'error',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			}
		} catch (error) {
			Swal.fire({
				title: 'ERROR!',
				text: 'Gagal menghubungi server.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] flex items-center justify-center p-4 py-12 font-sans'>
			<div className='max-w-md w-full relative z-10'>
				<div className='text-center mb-8'>
					<div className='w-20 h-20 bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] mx-auto flex items-center justify-center -rotate-6 mb-6'>
						<KeyRound className='w-10 h-10 text-[#0D0D0D]' strokeWidth={3} />
					</div>
					<h1 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest drop-shadow-[2px_2px_0px_#F5C518] mb-2'>
						PORTAL TUGAS
					</h1>
					<p className='text-[#0D0D0D] font-bold text-xs sm:text-sm uppercase tracking-wider bg-[#FF90E8] px-3 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-block -rotate-1'>
						Masukkan detail Anda untuk mengakses soal
					</p>
				</div>

				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[10px_10px_0px_0px_#0D0D0D] p-6 sm:p-8 rounded-none'>
					<form
						onSubmit={handleSubmit}
						className='space-y-6'>
						<div>
							<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>
								PIN Tugas
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10'>
									<KeyRound className='h-5 w-5 text-[#0D0D0D]' strokeWidth={3} />
								</div>
								<input
									type='text'
									required
									maxLength={8}
									value={form.pin}
									onChange={(e) => setForm({ ...form, pin: e.target.value.toUpperCase() })}
									placeholder='CONTOH: A8X2B9'
									className='w-full pl-12 pr-4 py-3.5 bg-white border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] focus:border-[#E8451A] focus:shadow-[5px_5px_0px_0px_#E8451A] outline-none transition-all font-mono text-xl tracking-widest uppercase font-black text-[#0D0D0D] rounded-none'
								/>
							</div>
						</div>

						<div>
							<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>
								Kelas
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10'>
									<Hash className='h-5 w-5 text-[#0D0D0D]' strokeWidth={3} />
								</div>
								<select
									required
									value={form.kelas}
									onChange={(e) => setForm({ ...form, kelas: e.target.value })}
									className='w-full pl-12 pr-4 py-3.5 bg-white border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] focus:border-[#E8451A] focus:shadow-[5px_5px_0px_0px_#E8451A] outline-none transition-all text-sm font-bold text-[#0D0D0D] appearance-none uppercase rounded-none cursor-pointer'
								>
									<option value="" disabled>PILIH KELAS</option>
									{kelasList.map(k => (
										<option key={k.id} value={k.kelas}>{k.kelas}</option>
									))}
								</select>
							</div>
						</div>

						<div>
							<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>
								Nama Lengkap
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10'>
									<User className='h-5 w-5 text-[#0D0D0D]' strokeWidth={3} />
								</div>
								<select
									required
									disabled={!form.kelas || fetchingSiswa}
									value={form.nama}
									onChange={handleSiswaChange}
									className='w-full pl-12 pr-4 py-3.5 bg-white border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] focus:border-[#E8451A] focus:shadow-[5px_5px_0px_0px_#E8451A] outline-none transition-all text-sm font-bold text-[#0D0D0D] appearance-none uppercase rounded-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
								>
									<option value="" disabled>{fetchingSiswa ? 'MEMUAT SISWA...' : 'PILIH NAMA ANDA'}</option>
									{siswaList.map(s => (
										<option key={s.id} value={s.nama_lengkap}>{s.nama_lengkap}</option>
									))}
								</select>
							</div>
						</div>

						<button
							type='submit'
							disabled={loading}
							className='w-full mt-6 flex items-center justify-center gap-3 bg-[#A3E635] hover:bg-[#F5C518] text-[#0D0D0D] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none font-black text-base sm:text-lg uppercase tracking-widest py-4 px-6 transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer rounded-none'>
							{loading ? (
								<div className='w-6 h-6 border-[3px] border-[#0D0D0D] border-t-transparent rounded-full animate-spin'></div>
							) : (
								<>
									MULAI KERJAKAN <ArrowRight className='w-6 h-6' strokeWidth={3} />
								</>
							)}
						</button>
					</form>
				</div>

				<div className='text-center mt-8'>
					<p className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider bg-[#FFE8DC] py-2.5 px-4 border-[2px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] inline-block'>
						Pastikan Anda memasukkan data yang benar sesuai identitas Anda.
					</p>
				</div>
			</div>
		</main>
	);
}
