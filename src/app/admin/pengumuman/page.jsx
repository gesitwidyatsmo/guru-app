'use client';

import { useState } from 'react';
import Swal from 'sweetalert2';

export default function BroadcastPengumuman() {
	const [judul, setJudul] = useState('');
	const [pesan, setPesan] = useState('');
	const [targetUser, setTargetUser] = useState('all'); // all = Semua Guru
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!judul.trim() || !pesan.trim()) {
			Swal.fire({
				icon: 'warning',
				title: 'Oops...',
				text: 'Judul dan Pesan wajib diisi!',
			});
			return;
		}

		setIsLoading(true);
		try {
			const res = await fetch('/api/notifikasi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ judul, pesan, target_user_id: targetUser }),
			});

			const data = await res.json();
			if (res.ok) {
				Swal.fire({
					icon: 'success',
					title: 'Terkirim!',
					text: 'Pengumuman berhasil dikirimkan ke guru.',
					timer: 2000,
					showConfirmButton: false
				});
				setJudul('');
				setPesan('');
			} else {
				throw new Error(data.error || 'Gagal mengirim pengumuman');
			}
		} catch (error) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: error.message,
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold text-slate-800 tracking-tight'>Kirim Pengumuman</h1>
				<p className='text-slate-500 mt-2'>Kirim pesan massal (broadcast) ke seluruh guru, yang akan muncul di ikon lonceng mereka.</p>
			</div>

			<div className='bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden'>
				<form onSubmit={handleSubmit} className='p-6 sm:p-8 space-y-6'>
					<div>
						<label className='block text-sm font-semibold text-slate-700 mb-2'>Target Penerima</label>
						<select
							value={targetUser}
							onChange={(e) => setTargetUser(e.target.value)}
							className='w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 transition-colors'>
							<option value='all'>📢 Semua Guru Aktif</option>
							{/* Di masa depan bisa tambah opsi target spesifik atau per mapel */}
						</select>
					</div>

					<div>
						<label className='block text-sm font-semibold text-slate-700 mb-2'>Judul Pengumuman</label>
						<input
							type='text'
							value={judul}
							onChange={(e) => setJudul(e.target.value)}
							placeholder='Contoh: Info Rapat Paripurna'
							className='w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 transition-colors'
							required
						/>
					</div>

					<div>
						<label className='block text-sm font-semibold text-slate-700 mb-2'>Isi Pesan</label>
						<textarea
							value={pesan}
							onChange={(e) => setPesan(e.target.value)}
							placeholder='Tuliskan detail pengumuman di sini...'
							rows='5'
							className='w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 transition-colors resize-none'
							required></textarea>
						<p className='text-xs text-slate-500 mt-2'>Pesan yang dikirim tidak bisa dibatalkan atau ditarik kembali.</p>
					</div>

					<div className='pt-4 border-t border-slate-100 flex justify-end'>
						<button
							type='submit'
							disabled={isLoading}
							className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
								isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'
							}`}>
							{isLoading ? (
								<>
									<div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
									Mengirim...
								</>
							) : (
								<>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
									</svg>
									Kirim Sekarang
								</>
							)}
						</button>
					</div>
				</form>
			</div>

			<div className='mt-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-6'>
				<div className='flex gap-4'>
					<div className='w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-indigo-600'>
						<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
					</div>
					<div>
						<h3 className='font-bold text-indigo-900 mb-1'>Informasi Fitur</h3>
						<p className='text-indigo-700 text-sm leading-relaxed'>
							Pengumuman yang Anda kirim akan langsung muncul di panel notifikasi pada *Dashboard* seluruh guru.
							Ikon lonceng mereka akan menampilkan angka berwarna merah sebagai penanda adanya pesan baru.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
