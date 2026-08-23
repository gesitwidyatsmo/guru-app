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
				title: 'Kolom Kosong',
				text: 'Judul dan Isi Pesan pengumuman wajib diisi!',
			});
			return;
		}

		const confirm = await Swal.fire({
			title: 'Kirim Pengumuman Massal?',
			html: `
				<div class="text-left text-sm space-y-1">
					<p>Pengumuman <b>"${judul}"</b> akan segera dikirimkan ke seluruh dewan guru dan muncul pada ikon lonceng notifikasi mereka.</p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Kirim Sekarang!',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		setIsLoading(true);
		try {
			const res = await fetch('/api/notifikasi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ judul: judul.trim(), pesan: pesan.trim(), target_user_id: targetUser }),
			});

			const data = await res.json();
			if (res.ok) {
				Swal.fire({
					icon: 'success',
					title: 'Tersampaikan!',
					text: data.message || 'Pengumuman berhasil disebarkan ke seluruh guru.',
				});
				setJudul('');
				setPesan('');
			} else {
				throw new Error(data.error || 'Gagal mengirim pengumuman.');
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
		<div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='inline-flex items-center gap-2 px-3 py-1 bg-blue-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
					<span>📢</span> Notifikasi Massal
				</div>
				<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
					Kirim Broadcast Pengumuman
				</h1>
				<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
					Kirim pesan informasi kilat secara serentak ke seluruh akun Guru aktif yang akan langsung memicu indikator lonceng notifikasi merah di dasbor mereka.
				</p>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
				{/* Form Box (7 cols) */}
				<div className='lg:col-span-7 bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[5px_5px_0px_0px_#0D0D0D]'>
					<h2 className='text-lg font-black text-black uppercase tracking-tight mb-5 flex items-center gap-2'>
						<span>✍️</span> Form Penulisan Pesan
					</h2>

					<form
						onSubmit={handleSubmit}
						className='space-y-5'>
						<div>
							<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
								Target Dewan Guru <span className='text-rose-600'>*</span>
							</label>
							<select
								value={targetUser}
								onChange={(e) => setTargetUser(e.target.value)}
								className='neo-input text-sm bg-white font-bold'>
								<option value='all'>📢 Seluruh Guru Aktif (Broadcast Publik)</option>
							</select>
						</div>

						<div>
							<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
								Judul Pengumuman <span className='text-rose-600'>*</span>
							</label>
							<input
								type='text'
								value={judul}
								onChange={(e) => setJudul(e.target.value)}
								placeholder='Contoh: Agenda Rapat Evaluasi KBM & Kurikulum'
								className='neo-input text-sm'
								required
							/>
						</div>

						<div>
							<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
								Isi Rincian Pesan <span className='text-rose-600'>*</span>
							</label>
							<textarea
								value={pesan}
								onChange={(e) => setPesan(e.target.value)}
								placeholder='Tuliskan detail pengumuman, instruksi, atau jadwal rapat di sini...'
								rows='6'
								className='neo-input text-sm resize-none'
								required></textarea>
							<p className='text-[11px] font-bold text-gray-500 mt-1.5'>
								Pesan yang terkirim akan langsung tercatat dan tidak dapat ditarik kembali.
							</p>
						</div>

						<div className='pt-3 border-t-2 border-black/10 flex justify-end'>
							<button
								type='submit'
								disabled={isLoading}
								className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-3 !px-8 bg-black text-white disabled:opacity-50'>
								{isLoading ? (
									<span>Sedang Mengirim...</span>
								) : (
									<>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
											<path strokeLinecap='round' strokeLinejoin='round' d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
										</svg>
										<span>Kirim Pengumuman Sekarang</span>
									</>
								)}
							</button>
						</div>
					</form>
				</div>

				{/* Live Preview Card (5 cols) */}
				<div className='lg:col-span-5 space-y-6'>
					<div className='bg-yellow-50 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between pb-3 mb-4 border-b-2 border-black'>
							<h3 className='text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5'>
								<span>👁️</span> Live Preview Guru
							</h3>
							<span className='px-2 py-0.5 text-[10px] font-black uppercase bg-yellow-300 border border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D]'>
								Simulasi Nyata
							</span>
						</div>

						{/* Notification Drawer Simulation */}
						<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] space-y-2'>
							<div className='flex items-start gap-3'>
								<div className='w-9 h-9 rounded-lg bg-orange-400 border-2 border-black flex items-center justify-center font-black text-white text-base shrink-0 shadow-[1px_1px_0px_0px_#0D0D0D]'>
									📢
								</div>
								<div className='flex-1 min-w-0'>
									<div className='flex items-center justify-between gap-1'>
										<span className='font-black text-xs sm:text-sm text-black truncate'>
											{judul.trim() || 'Judul Pengumuman'}
										</span>
										<span className='text-[10px] font-mono text-gray-500 font-bold'>Baru</span>
									</div>
									<p className='text-xs text-gray-700 font-medium mt-1 whitespace-pre-wrap line-clamp-4'>
										{pesan.trim() || 'Rincian pesan pengumuman akan ditampilkan seperti ini pada notifikasi guru...'}
									</p>
								</div>
							</div>
						</div>

						<p className='text-[11px] font-bold text-gray-600 mt-4 leading-relaxed'>
							💡 Guru yang sedang membuka dasbor akan menerima tanda lonceng menyala merah dan dapat membaca pesan ini kapan saja.
						</p>
					</div>

					<div className='bg-blue-50 border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-2'>
						<h4 className='text-xs font-black uppercase text-blue-900 flex items-center gap-1.5'>
							<span>ℹ️</span> Panduan Broadcast
						</h4>
						<p className='text-xs font-medium text-blue-950 leading-relaxed'>
							Gunakan fitur ini untuk pengumuman mendesak seperti jadwal rapat guru, perubahan kalender akademik, pembagian tugas mendadak, atau informasi resmi dari kepala sekolah.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
