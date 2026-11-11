'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import Loader from '@/app/components/loading';

export default function AdminPemeliharaanPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [toggling, setToggling] = useState(false);

	const [formData, setFormData] = useState({
		enabled: false,
		pesan: 'Mohon maaf atas ketidaknyamanannya. Website GuruApp saat ini sedang menjalani proses pemeliharaan dan pembaruan sistem secara berkala untuk meningkatkan stabilitas dan performa aplikasi.',
		estimasi_selesai: 'Segera Kembali',
		kontak_bantuan: '081277813478',
		updated_at: '',
		updated_by: '',
	});

	// Ambil konfigurasi pemeliharaan dari API
	const fetchSettings = async () => {
		try {
			const res = await fetch('/api/maintenance?refresh=1', { cache: 'no-store' });
			if (res.ok) {
				const data = await res.json();
				setFormData({
					enabled: !!data.enabled,
					pesan: data.pesan || '',
					estimasi_selesai: data.estimasi_selesai || '',
					kontak_bantuan: data.kontak_bantuan || '',
					updated_at: data.updated_at || '',
					updated_by: data.updated_by || 'Administrator',
				});
			}
		} catch (error) {
			console.error('Gagal mengambil pengaturan pemeliharaan:', error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Pengaturan',
				text: 'Terjadi kesalahan saat memuat status pemeliharaan sistem.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchSettings();
	}, []);

	// Handler Toggle Cepat Aktifkan / Nonaktifkan
	const handleToggleMaintenance = async () => {
		const newStatus = !formData.enabled;

		if (newStatus) {
			// Konfirmasi aktivasi (Kunci website)
			const confirmResult = await Swal.fire({
				title: 'Kunci Seluruh Website?',
				text: 'PERINGATAN: Mengaktifkan mode pemeliharaan akan langsung mengunci seluruh halaman website (termasuk halaman login guru & siswa). Seluruh pengunjung umum akan dialihkan ke Halaman Pemeliharaan.',
				icon: 'warning',
				showCancelButton: true,
				confirmButtonColor: '#E8451A',
				cancelButtonColor: '#0D0D0D',
				confirmButtonText: 'Ya, Kunci Website Sekarang!',
				cancelButtonText: 'Batal',
				reverseButtons: true,
			});

			if (!confirmResult.isConfirmed) return;
		} else {
			// Konfirmasi penonaktifan (Buka kunci website)
			const confirmResult = await Swal.fire({
				title: 'Buka Kunci Website?',
				text: 'Mode pemeliharaan akan dinonaktifkan. Seluruh pengunjung akan dapat mengakses aplikasi dan halaman login kembali seperti biasa.',
				icon: 'question',
				showCancelButton: true,
				confirmButtonColor: '#00A693',
				cancelButtonColor: '#0D0D0D',
				confirmButtonText: 'Ya, Buka Kunci Website',
				cancelButtonText: 'Batal',
				reverseButtons: true,
			});

			if (!confirmResult.isConfirmed) return;
		}

		setToggling(true);
		try {
			const res = await fetch('/api/maintenance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					enabled: newStatus,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				setFormData((prev) => ({
					...prev,
					enabled: newStatus,
					updated_at: new Date().toISOString(),
				}));

				Swal.fire({
					icon: 'success',
					title: newStatus ? 'Website Telah Dikunci!' : 'Website Telah Dibuka!',
					text: newStatus
						? 'Mode Pemeliharaan aktif. Seluruh pengunjung sekarang melihat Halaman Pemeliharaan.'
						: 'Mode Pemeliharaan nonaktif. Website beroperasi normal kembali.',
					confirmButtonColor: '#0D0D0D',
				});
			} else {
				Swal.fire({
					icon: 'error',
					title: 'Gagal Mengubah Status',
					text: data.error || 'Terjadi kesalahan pada server.',
					confirmButtonColor: '#0D0D0D',
				});
			}
		} catch (error) {
			Swal.fire({
				icon: 'error',
				title: 'Kesalahan Jaringan',
				text: 'Gagal menghubungkan ke server.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setToggling(false);
		}
	};

	// Handler Simpan Konfigurasi Teks/Pesan
	const handleSaveConfig = async (e) => {
		e.preventDefault();
		setSaving(true);

		try {
			const res = await fetch('/api/maintenance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			const data = await res.json();

			if (res.ok) {
				Swal.fire({
					icon: 'success',
					title: 'Pengaturan Disimpan',
					text: 'Teks pesan dan estimasi waktu pemeliharaan berhasil diperbarui.',
					confirmButtonColor: '#0D0D0D',
					timer: 2000,
				});
			} else {
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menyimpan',
					text: data.error || 'Terjadi kesalahan.',
					confirmButtonColor: '#0D0D0D',
				});
			}
		} catch (error) {
			Swal.fire({
				icon: 'error',
				title: 'Kesalahan Jaringan',
				text: 'Tidak dapat menyimpan konfigurasi.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
			{/* Header Navigasi & Judul */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.32l-3.276 3.277a1.5 1.5 0 01-2.122 0l-2.12-2.122a1.5 1.5 0 010-2.122L18.42 3.12a4.5 4.5 0 00-6.32 4.487c.047.579.023 1.192-.14 1.742m-1.768 1.768l2.122 2.122' />
						</svg>
						<span>Sistem & Keamanan</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-gray-900 tracking-tight'>
						Mode Pemeliharaan Website (Maintenance Mode)
					</h1>
					<p className='text-sm text-gray-600 mt-1 font-medium'>
						Kunci seluruh akses website dan tampilkan halaman pemeliharaan dari folder <code>public/pemeliharaan</code>.
					</p>
				</div>

				<div className='flex items-center gap-3'>
					<Link
						href='/pemeliharaan'
						target='_blank'
						className='inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black rounded-xl font-black text-xs sm:text-sm text-black shadow-[3px_3px_0px_0px_#0D0D0D] transition-all'
					>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />
						</svg>
						<span>Pratinjau Halaman</span>
					</Link>
				</div>
			</div>

			{/* Master Status Card (Paling Menonjol) */}
			<div
				className={`border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] transition-all ${
					formData.enabled
						? 'bg-rose-50 border-rose-950'
						: 'bg-emerald-50 border-emerald-950'
				}`}
			>
				<div className='flex flex-col lg:flex-row lg:items-center justify-between gap-6'>
					<div className='space-y-2'>
						<div className='flex items-center gap-3'>
							<span
								className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#0D0D0D] ${
									formData.enabled ? 'bg-red-500 text-white' : 'bg-emerald-400 text-black'
								}`}
							>
								<span
									className={`w-3 h-3 rounded-full border border-black ${
										formData.enabled ? 'bg-white animate-ping' : 'bg-white'
									}`}
								/>
								{formData.enabled ? '🔴 STATUS: AKTIF (WEBSITE TERKUNCI)' : '🟢 STATUS: NONAKTIF (NORMAL)'}
							</span>
						</div>

						<h2 className='text-xl sm:text-2xl font-black text-gray-900'>
							{formData.enabled
								? 'Sistem Sedang Dikunci untuk Pemeliharaan'
								: 'Website Sedang Berjalan Normal untuk Semua Pengguna'}
						</h2>

						<p className='text-sm text-gray-700 max-w-2xl leading-relaxed font-medium'>
							{formData.enabled ? (
								<>
									Semua pengunjung umum (termasuk akses login guru, portal siswa, dan modul lainnya) dialihkan ke{' '}
									<strong>Halaman Pemeliharaan</strong>. Hanya akun Administrator yang dapat mengakses sistem saat ini.
								</>
							) : (
								<>
									Seluruh dewan guru, staf tendik, siswa, dan publik dapat masuk dan menggunakan seluruh modul aplikasi tanpa halangan.
								</>
							)}
						</p>

						{formData.updated_at && (
							<p className='text-xs text-gray-500 font-bold'>
								Terakhir diubah:{' '}
								{new Date(formData.updated_at).toLocaleString('id-ID', {
									dateStyle: 'medium',
									timeStyle: 'short',
								})}{' '}
								oleh {formData.updated_by || 'Admin'}
							</p>
						)}
					</div>

					{/* Tombol Utama Saklar */}
					<div className='shrink-0'>
						<button
							type='button'
							disabled={toggling}
							onClick={handleToggleMaintenance}
							className={`w-full sm:w-auto px-8 py-4 rounded-2xl border-[3px] border-black font-black text-base shadow-[5px_5px_0px_0px_#0D0D0D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50 ${
								formData.enabled
									? 'bg-emerald-400 hover:bg-emerald-500 text-black'
									: 'bg-[#E8451A] hover:bg-orange-600 text-white'
							}`}
						>
							<svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								{formData.enabled ? (
									<path strokeLinecap='round' strokeLinejoin='round' d='M13.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' />
								) : (
									<path strokeLinecap='round' strokeLinejoin='round' d='M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' />
								)}
							</svg>
							<span>
								{toggling
									? 'Memproses...'
									: formData.enabled
									? 'Buka Kunci Website (Nonaktifkan)'
									: 'Aktifkan Mode Pemeliharaan (Kunci)'}
							</span>
						</button>
					</div>
				</div>
			</div>

			{/* Grid Konfigurasi & Pratinjau */}
			<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
				{/* Kolom Kiri: Form Konfigurasi Pesan & Estimasi */}
				<div className='lg:col-span-7 bg-white border-2 border-black rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] space-y-6'>
					<div>
						<h3 className='text-lg font-black text-gray-900'>Konfigurasi Tampilan Halaman Pemeliharaan</h3>
						<p className='text-xs text-gray-600 font-medium mt-1'>
							Sesuaikan pesan yang ditampilkan kepada pengunjung saat website dikunci.
						</p>
					</div>

					<form onSubmit={handleSaveConfig} className='space-y-5'>
						<div>
							<label className='block text-xs font-black uppercase text-gray-800 mb-1.5'>
								Pesan Keterangan Pemeliharaan
							</label>
							<textarea
								rows={4}
								required
								value={formData.pesan}
								onChange={(e) => setFormData({ ...formData, pesan: e.target.value })}
								placeholder='Tulis pesan penjelasan pemeliharaan untuk guru dan pengunjung...'
								className='w-full px-4 py-3 bg-gray-50 border-2 border-black rounded-xl font-medium text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
							/>
							<p className='text-[11px] text-gray-500 font-bold mt-1'>
								Pesan ini akan langsung terlihat di bawah judul utama halaman pemeliharaan.
							</p>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-800 mb-1.5'>
									Estimasi Waktu Selesai
								</label>
								<input
									type='text'
									value={formData.estimasi_selesai}
									onChange={(e) =>
										setFormData({ ...formData, estimasi_selesai: e.target.value })
									}
									placeholder='Contoh: 1-2 Jam ke depan / Pukul 21:00 WIB'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-800 mb-1.5'>
									Kontak Bantuan (WhatsApp)
								</label>
								<input
									type='text'
									value={formData.kontak_bantuan}
									onChange={(e) =>
										setFormData({ ...formData, kontak_bantuan: e.target.value })
									}
									placeholder='Contoh: 081277813478'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>
						</div>

						<div className='pt-2'>
							<button
								type='submit'
								disabled={saving}
								className='px-6 py-3 bg-yellow-300 hover:bg-yellow-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:opacity-50'
							>
								{saving ? 'Menyimpan...' : 'Simpan Perubahan Teks'}
							</button>
						</div>
					</form>
				</div>

				{/* Kolom Kanan: Live Box Pratinjau Tampilan */}
				<div className='lg:col-span-5 space-y-6'>
					<div className='bg-amber-100/60 border-2 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex items-center justify-between'>
							<h3 className='text-sm font-black text-gray-900 uppercase tracking-wide flex items-center gap-2'>
								<span className='w-2.5 h-2.5 rounded-full bg-orange-500' />
								<span>Pratinjau Pengunjung</span>
							</h3>
							<span className='text-[10px] font-black uppercase bg-white px-2 py-0.5 border border-black rounded-md'>
								Aset: public/Pemeliharaan
							</span>
						</div>

						{/* Miniatur Card */}
						<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] text-center space-y-3'>
							<div className='w-32 mx-auto'>
								<img
									src='/Pemeliharaan/Maintenance Signboard with Two Supports.png'
									alt='Pratinjau Papan Pemeliharaan'
									className='w-full h-auto object-contain mx-auto'
								/>
							</div>

							<div className='inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-300 border border-black rounded-full font-black text-[10px] uppercase'>
								<span className='w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse' />
								<span>Sistem Dalam Pemeliharaan</span>
							</div>

							<h4 className='font-black text-sm text-gray-900'>Kami Segera Kembali!</h4>

							<p className='text-xs text-gray-600 line-clamp-3 leading-relaxed font-medium'>
								{formData.pesan}
							</p>

							{formData.estimasi_selesai && (
								<div className='text-[11px] font-bold text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-black/10'>
									⏱️ {formData.estimasi_selesai}
								</div>
							)}
						</div>

						{/* Catatan Panduan Administrator */}
						<div className='p-4 bg-white border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#0D0D0D] space-y-2'>
							<h4 className='text-xs font-black uppercase text-gray-900 flex items-center gap-1.5'>
								<span>💡 Catatan Penting Admin:</span>
							</h4>
							<ul className='text-xs text-gray-700 space-y-1.5 list-disc list-inside font-medium'>
								<li>
									Saat aktif, semua halaman selain <code>/pemeliharaan</code> akan dialihkan.
								</li>
								<li>
									Akun Administrator tidak akan terblokir dan tetap dapat membuka modul <code>/admin</code>.
								</li>
								<li>
									Jika tidak sengaja logout, Admin dapat login kembali via tombol <strong>Akses Administrator</strong> di halaman pemeliharaan.
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
