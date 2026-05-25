'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, User, Hash, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SoalPortal() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const [form, setForm] = useState({
		pin: '',
		nama: '',
		kelas: '',
		absen: '',
	});

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!form.pin || !form.nama || !form.kelas || !form.absen) {
			Swal.fire('Perhatian', 'Semua kolom wajib diisi!', 'warning');
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
				// Simpan nama, kelas, dan absen di localStorage supaya di halaman kerjakan nggak usah ketik lagi
				localStorage.setItem('siswa_nama', form.nama);
				localStorage.setItem('siswa_kelas', form.kelas);
				localStorage.setItem('siswa_absen', form.absen);

				router.push(`/soal/kerjakan/${form.pin.toUpperCase()}?absen=${form.absen}`);
			} else {
				Swal.fire('Akses Ditolak', data.error || 'PIN yang Anda masukkan salah.', 'error');
			}
		} catch (error) {
			Swal.fire('Error', 'Gagal menghubungi server.', 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className='min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden'>
			{/* Decorative elements */}
			<div className='absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none'>
				<div className='absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl'></div>
				<div className='absolute top-[60%] -left-[10%] w-[30%] h-[30%] rounded-full bg-indigo-100/50 blur-3xl'></div>
			</div>

			<div className='max-w-md w-full relative z-10'>
				<div className='text-center mb-8'>
					<div className='w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200 mb-6 transform -rotate-6'>
						<KeyRound className='w-8 h-8 text-white' />
					</div>
					<h1 className='text-3xl font-extrabold text-gray-900 tracking-tight mb-2'>Portal Tugas</h1>
					<p className='text-gray-500'>Silakan masukkan detail Anda untuk mengakses soal.</p>
				</div>

				<div className='bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-6 sm:p-8'>
					<form
						onSubmit={handleSubmit}
						className='space-y-5'>
						<div>
							<label className='block text-sm font-semibold text-gray-700 mb-1.5'>PIN Tugas</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<KeyRound className='h-5 w-5 text-indigo-400' />
								</div>
								<input
									type='text'
									required
									maxLength={8}
									value={form.pin}
									onChange={(e) => setForm({ ...form, pin: e.target.value.toUpperCase() })}
									placeholder='Contoh: A8X2B9'
									className='w-full pl-11 pr-4 py-3.5 bg-gray-50/50 rounded-2xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-lg tracking-widest uppercase font-bold text-gray-800'
								/>
							</div>
						</div>

						<div>
							<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Nama Lengkap</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<User className='h-5 w-5 text-gray-400' />
								</div>
								<input
									type='text'
									required
									value={form.nama}
									onChange={(e) => setForm({ ...form, nama: e.target.value })}
									placeholder='Nama Lengkap Anda'
									className='w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-2xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800'
								/>
							</div>
						</div>

						<div>
							<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Kelas</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<Hash className='h-5 w-5 text-gray-400' />
								</div>
								<input
									type='text'
									required
									value={form.kelas}
									onChange={(e) => setForm({ ...form, kelas: e.target.value })}
									placeholder='Contoh: XI 1'
									className='w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-2xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800'
								/>
							</div>
						</div>

						<div>
							<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Nomor Absen</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
									<Hash className='h-5 w-5 text-gray-400' />
								</div>
								<input
									type='number'
									required
									min='1'
									max='100'
									value={form.absen}
									onChange={(e) => setForm({ ...form, absen: e.target.value })}
									placeholder='No. Absen'
									className='w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-2xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-800'
								/>
							</div>
						</div>

						<button
							type='submit'
							disabled={loading}
							className='w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed'>
							{loading ? (
								<div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
							) : (
								<>
									Mulai Kerjakan <ArrowRight className='w-5 h-5' />
								</>
							)}
						</button>
					</form>
				</div>

				<p className='text-center text-sm text-gray-400 mt-8'>Pastikan Anda memasukkan data yang benar sesuai dengan identitas Anda.</p>
			</div>
		</main>
	);
}
