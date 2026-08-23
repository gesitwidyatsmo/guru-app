'use client';

import { useState, useEffect } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { useAcademic } from '@/context/AcademicContext';

export default function TahunAjarAdminPage() {
	const { daftarTahunAjar, tahunAjarAktif, semesterAktif, refreshDaftar } = useAcademic();
	const [loading, setLoading] = useState(false);
	const [isSavingTA, setIsSavingTA] = useState(false);
	const [isSettingAktif, setIsSettingAktif] = useState(false);
	const [showFormTA, setShowFormTA] = useState(false);
	const [formTA, setFormTA] = useState({
		nama: '',
		semester: '1',
		tanggal_mulai: '',
		tanggal_selesai: '',
	});

	const handleBuatTA = async (e) => {
		e.preventDefault();
		if (!formTA.nama.trim() || !formTA.semester) {
			Swal.fire('Perhatian', 'Nama Tahun Ajar dan Semester wajib diisi!', 'warning');
			return;
		}

		try {
			setIsSavingTA(true);
			const res = await fetch('/api/tahun-ajar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formTA),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal membuat tahun ajar baru.');

			Swal.fire('Berhasil!', `Tahun Ajar ${formTA.nama} Semester ${formTA.semester} berhasil ditambahkan ke database.`, 'success');
			setShowFormTA(false);
			setFormTA({ nama: '', semester: '1', tanggal_mulai: '', tanggal_selesai: '' });
			await refreshDaftar();
		} catch (err) {
			Swal.fire('Gagal Membuat Tahun Ajar', err.message, 'error');
		} finally {
			setIsSavingTA(false);
		}
	};

	const handleSetAktif = async (id, nama, semester) => {
		const result = await Swal.fire({
			title: 'Aktifkan Periode Akademik?',
			text: `Tahun Ajar ${nama} Semester ${semester} akan diset sebagai periode aktif sistem. Seluruh guru dan rekap nilai akan membaca periode ini secara default.`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#00A693',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Jadikan Aktif!',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setIsSettingAktif(true);
			const res = await fetch('/api/tahun-ajar/aktif', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});

			if (!res.ok) throw new Error('Gagal mengaktifkan periode akademik.');

			Swal.fire('Aktif!', `Tahun Ajar ${nama} Semester ${semester} kini resmi menjadi periode aktif sistem.`, 'success');
			await refreshDaftar();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSettingAktif(false);
		}
	};

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-orange-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📅</span> Konfigurasi Kalender Akademik
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Manajemen Tahun Ajar & Semester
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tentukan rentang kalender akademik, aktifkan semester berjalan, dan buka tahun ajaran baru.
					</p>
				</div>

				<button
					onClick={() => setShowFormTA(!showFormTA)}
					className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-3 !px-5 whitespace-nowrap shrink-0 self-stretch sm:self-auto justify-center'>
					<span>{showFormTA ? '✕ Tutup Form' : '+ Buka Tahun Ajar Baru'}</span>
				</button>
			</div>

			{/* Active Academic Period Card */}
			<div className='bg-gradient-to-br from-yellow-200 via-yellow-100 to-orange-100 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='space-y-1'>
						<div className='inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-400 text-black border-2 border-black rounded-md text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<span className='w-2 h-2 rounded-full bg-white animate-pulse'></span>
							Periode Berjalan (Aktif)
						</div>
						<h2 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
							TA {tahunAjarAktif || 'Belum Dikonfigurasi'} &bull; Semester {semesterAktif || '-'}
						</h2>
						<p className='text-xs sm:text-sm font-bold text-gray-700'>
							Semua pengisian absensi harian, jurnal, nilai tugas, dan rapor siswa otomatis merujuk ke periode ini.
						</p>
					</div>

					<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] text-center self-start sm:self-auto'>
						<p className='text-[10px] font-black uppercase text-gray-500'>Total Periode</p>
						<p className='text-xl font-black text-black'>{daftarTahunAjar.length} Semester</p>
					</div>
				</div>
			</div>

			{/* Form Buat Tahun Ajar Baru */}
			{showFormTA && (
				<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_#0D0D0D] animate-in fade-in slide-in-from-top-2 duration-150'>
					<div className='flex items-center justify-between pb-3 mb-4 border-b-2 border-black/10'>
						<h3 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
							<span>✨</span>
							<span>Form Pembukaan Tahun Ajar Baru</span>
						</h3>
						<button
							onClick={() => setShowFormTA(false)}
							className='text-xs font-black uppercase hover:underline'>
							Batal
						</button>
					</div>

					<form
						onSubmit={handleBuatTA}
						className='space-y-4'>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
							<div>
								<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
									Nama Tahun Ajar <span className='text-rose-600'>*</span>
								</label>
								<input
									type='text'
									placeholder='Contoh: 2026/2027'
									value={formTA.nama}
									onChange={(e) => setFormTA({ ...formTA, nama: e.target.value })}
									className='neo-input text-sm'
									required
								/>
							</div>

							<div>
								<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
									Semester <span className='text-rose-600'>*</span>
								</label>
								<select
									value={formTA.semester}
									onChange={(e) => setFormTA({ ...formTA, semester: e.target.value })}
									className='neo-input text-sm bg-white font-bold'
									required>
									<option value='1'>Semester 1 (Ganjil)</option>
									<option value='2'>Semester 2 (Genap)</option>
								</select>
							</div>

							<div>
								<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
									Tanggal Mulai (Opsional)
								</label>
								<input
									type='date'
									value={formTA.tanggal_mulai}
									onChange={(e) => setFormTA({ ...formTA, tanggal_mulai: e.target.value })}
									className='neo-input text-sm'
								/>
							</div>

							<div>
								<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
									Tanggal Selesai (Opsional)
								</label>
								<input
									type='date'
									value={formTA.tanggal_selesai}
									onChange={(e) => setFormTA({ ...formTA, tanggal_selesai: e.target.value })}
									className='neo-input text-sm'
								/>
							</div>
						</div>

						<div className='pt-2 flex justify-end gap-3'>
							<button
								type='button'
								onClick={() => setShowFormTA(false)}
								className='neo-btn-outline text-xs sm:text-sm !py-2.5 !px-4'>
								Batal
							</button>
							<button
								type='submit'
								disabled={isSavingTA}
								className='neo-btn-primary text-xs sm:text-sm !py-2.5 !px-6 bg-black text-white disabled:opacity-50'>
								{isSavingTA ? 'Menyimpan...' : 'Simpan Tahun Ajar'}
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Daftar Riwayat Tahun Ajar */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between'>
					<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>📋</span> Daftar Seluruh Periode Akademik
					</h3>
					<span className='text-xs font-bold text-gray-500'>
						Pilih salah satu untuk dijadikan periode aktif
					</span>
				</div>

				<div className='space-y-3'>
					{daftarTahunAjar.length === 0 ? (
						<div className='p-8 text-center text-gray-500 font-bold bg-yellow-50/50 border-2 border-dashed border-black/20 rounded-xl'>
							Belum ada riwayat tahun ajar terdaftar. Silakan buat tahun ajar pertama Anda.
						</div>
					) : (
						daftarTahunAjar.map((ta) => {
							const isAktif = ta.is_aktif;
							return (
								<div
									key={ta.id}
									className={`border-2 border-black rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
										isAktif
											? 'bg-emerald-100 shadow-[4px_4px_0px_0px_#0D0D0D]'
											: 'bg-yellow-50/40 hover:bg-yellow-100/60 shadow-[2px_2px_0px_0px_#0D0D0D]'
									}`}>
									<div className='space-y-1'>
										<div className='flex items-center gap-2'>
											<span className='font-black text-base text-black'>
												TA {ta.nama} &bull; Semester {ta.semester}
											</span>
											{isAktif ? (
												<span className='px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white border-2 border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D]'>
													Sedang Aktif
												</span>
											) : (
												<span className='px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-white border border-black rounded'>
													Arsip
												</span>
											)}
										</div>
										<p className='text-xs font-medium text-gray-600'>
											{ta.tanggal_mulai
												? `${new Date(ta.tanggal_mulai).toLocaleDateString('id-ID')} s.d. ${
														ta.tanggal_selesai
															? new Date(ta.tanggal_selesai).toLocaleDateString('id-ID')
															: 'Selesai'
												  }`
												: 'Rentang tanggal belum diset'}
										</p>
									</div>

									<div>
										{!isAktif ? (
											<button
												onClick={() => handleSetAktif(ta.id, ta.nama, ta.semester)}
												disabled={isSettingAktif}
												className='px-4 py-2 bg-white hover:bg-emerald-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50'>
												{isSettingAktif ? 'Memproses...' : 'Jadikan Aktif'}
											</button>
										) : (
											<div className='inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 bg-white px-3 py-1.5 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
												<span>✅</span>
												<span>Default Sistem</span>
											</div>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
