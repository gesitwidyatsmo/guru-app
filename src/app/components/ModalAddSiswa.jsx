'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import Swal from 'sweetalert2';
import { swalProcess, swalSuccess, swalError } from '@/lib/swal';

// --- IKON ---
const IconPlus = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<line
			x1='12'
			y1='5'
			x2='12'
			y2='19'></line>
		<line
			x1='5'
			y1='12'
			x2='19'
			y2='12'></line>
	</svg>
);

const IconUpload = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path>
		<polyline points='17 8 12 3 7 8'></polyline>
		<line
			x1='12'
			y1='3'
			x2='12'
			y2='15'></line>
	</svg>
);

const IconFileSpreadsheet = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'></path>
		<polyline points='14 2 14 8 20 8'></polyline>
		<path d='M8 13h2'></path>
		<path d='M8 17h2'></path>
		<path d='M14 13h2'></path>
		<path d='M14 17h2'></path>
	</svg>
);

// --- KOMPONEN UTAMA ---
export function ModalAddSiswa({ isOpen, onClose, onRefresh, currentKelas }) {
	const [activeTab, setActiveTab] = useState('manual');
	const [loading, setLoading] = useState(false);

	// State Manual
	const [formData, setFormData] = useState({
		nis: '',
		nama_lengkap: '',
		kelas: currentKelas,
		jenis_kelamin: 'Laki-laki',
		status: 'Aktif',
	});

	// State Bulk
	const [file, setFile] = useState(null);

	const handleDownloadTemplate = () => {
		// 1. Data Konten
		const headerRows = [['', 'Kelas', `: ${currentKelas}` || 'Data Kosong'], ['', 'Wali Kelas', ':', ''], [''], ['No', 'NIS', 'Nama Lengkap', 'Jenis Kelamin']];
		const dataRows = Array.from({ length: 40 }, (_, index) => {
			const nomor = String(index + 1);
			return [nomor, '', '', ''];
		});

		const excelData = [...headerRows, ...dataRows];
		const worksheet = XLSX.utils.aoa_to_sheet(excelData);

		// --- BAGIAN STYLING (BORDER & WARNA) ---

		// Definisi Style Border (Garis Tipis Semua Sisi)
		const borderStyle = {
			top: { style: 'thin', color: { rgb: '000000' } },
			bottom: { style: 'thin', color: { rgb: '000000' } },
			left: { style: 'thin', color: { rgb: '000000' } },
			right: { style: 'thin', color: { rgb: '000000' } },
		};

		// Definisi Style Header (Bold + Background Kuning + Border)
		const headerStyle = {
			font: { bold: true, color: { rgb: '000000' } },
			fill: { fgColor: { rgb: 'FFEB9C' } }, // Kuning muda
			border: borderStyle,
			alignment: { horizontal: 'center', vertical: 'center' },
		};

		// Definisi Style Data Biasa (Border Saja)
		const cellStyle = {
			border: borderStyle,
			alignment: { horizontal: 'center', vertical: 'center' },
		};

		const range = XLSX.utils.decode_range(worksheet['!ref']);

		for (let R = range.s.r; R <= range.e.r; ++R) {
			for (let C = range.s.c; C <= range.e.c; ++C) {
				if (R >= 3) {
					const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

					if (!worksheet[cellAddress]) continue;

					if (R === 3) {
						worksheet[cellAddress].s = headerStyle;
					} else {
						worksheet[cellAddress].s = cellStyle;
					}
				}

				if (R < 2 && C === 1) {
					const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
					if (worksheet[cellAddress]) {
						worksheet[cellAddress].s = { font: { bold: true } };
					}
				}
			}
		}

		worksheet['!cols'] = [
			{ wch: 5 }, // No
			{ wch: 15 }, // NIS
			{ wch: 35 }, // : Nama
			{ wch: 15 }, // JK
		];

		// 4. Download
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');

		const safeKelasName = currentKelas ? currentKelas.replace(/[^a-zA-Z0-9-_]/g, '-') : 'Baru';
		XLSX.writeFile(workbook, `Template_Siswa_${safeKelasName}.xlsx`);
	};

	if (!isOpen) return null;

	const handleSubmitManual = async (e) => {
		e.preventDefault();
		setLoading(true);
		onClose();
		swalProcess('Menyimpan...', 'Jangan tutup halaman');
		try {
			// Pastikan kelas terisi dari props jika state kosong
			const payload = { ...formData, kelas: formData.kelas || currentKelas };

			const res = await fetch('/api/siswa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!res.ok) throw new Error('Gagal menyimpan data');
			Swal.close();
			await swalSuccess('Tersimpan', 'Data berhasil disimpan');

			await onRefresh();
			setFormData({ nis: '', nama_lengkap: '', kelas: currentKelas, jenis_kelamin: 'Laki-laki', status: 'Aktif' });
		} catch (error) {
			swalError('Gagal', error.message);
		} finally {
			setLoading(false);
		}
	};

	// Handler Bulk Upload
	const handleSubmitBulk = async (e) => {
		e.preventDefault();
		if (!file) return swalError('File Kosong', 'Silakan pilih file Excel terlebih dahulu');
		onClose();
		swalProcess('Menyimpan...', 'Jangan tutup halaman');

		setLoading(true);
		const formDataUpload = new FormData();

		// --- PERBAIKAN: Masukkan File ke FormData ---
		formDataUpload.append('file', file);
		formDataUpload.append('kelas_target', currentKelas);

		try {
			const res = await fetch('/api/siswa/bulk-import', {
				method: 'POST',
				body: formDataUpload,
			});

			const result = await res.json();
			Swal.close();
			await swalSuccess('Tersimpan', 'Data berhasil disimpan');

			if (!res.ok) throw new Error(result.error || 'Gagal import data');

			await onRefresh();
			onClose();
			setFile(null);
		} catch (error) {
			swalError('Gagal Import', error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const droppedFiles = e.dataTransfer.files;
		if (droppedFiles && droppedFiles[0]) {
			setFile(droppedFiles[0]);
		}
	};

	return (
		<div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 sm:p-6'>
			<div
				className='fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity'
				onClick={onClose}
			/>

			<div className='relative w-full max-w-lg transform rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl transition-all animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200'>
				{/* Header */}
				<div className='mb-6 flex items-center justify-between'>
					<h3 className='text-xl font-bold text-gray-900'>Tambah Siswa Baru</h3>
					<button
						onClick={onClose}
						className='rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors'>
						<svg
							className='h-6 w-6'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				{/* Tab Switcher */}
				<div className='mb-6 flex rounded-xl bg-gray-100 p-1'>
					<button
						onClick={() => setActiveTab('manual')}
						className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
							activeTab === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
						}`}>
						<IconPlus className='h-4 w-4' />
						Input Satu-satu
					</button>
					<button
						onClick={() => setActiveTab('bulk')}
						className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
							activeTab === 'bulk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
						}`}>
						<IconFileSpreadsheet className='h-4 w-4' />
						Import Excel
					</button>
				</div>

				{/* FORM MANUAL */}
				{activeTab === 'manual' && (
					<form
						onSubmit={handleSubmitManual}
						className='space-y-5'>
						{/* ... Input Manual (Tidak berubah) ... */}
						<div className='grid grid-cols-1 gap-4'>
							<div className='text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200'>
								Menambahkan siswa ke kelas: <span className='font-bold text-indigo-600'>{currentKelas}</span>
							</div>
							<div>
								<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Nama Lengkap</label>
								<input
									type='text'
									required
									placeholder='Masukan nama siswa'
									className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm'
									value={formData.nama_lengkap}
									onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
								/>
							</div>
							<div>
								<label className='mb-1.5 block text-sm font-semibold text-gray-700'>NIS</label>
								<input
									type='text'
									required
									placeholder='Masukan NIS siswa'
									className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm'
									value={formData.nis}
									onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
								/>
							</div>
							<div>
								<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Jenis Kelamin</label>
								<select
									className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm'
									value={formData.jenis_kelamin}
									onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
									<option value='Laki-laki'>Laki-laki</option>
									<option value='Perempuan'>Perempuan</option>
								</select>
							</div>
						</div>

						<div className='flex gap-3 pt-4'>
							<button
								type='button'
								onClick={onClose}
								className='flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'>
								Batal
							</button>
							<button
								type='submit'
								disabled={loading}
								className='flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-70'>
								{loading ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</form>
				)}

				{/* FORM BULK */}
				{activeTab === 'bulk' && (
					<form
						onSubmit={handleSubmitBulk}
						className='space-y-5'>
						<div className='rounded-xl border border-blue-100 bg-blue-50 p-4'>
							<h4 className='text-sm font-bold text-blue-800'>Panduan Upload</h4>
							<ul className='mt-2 list-disc pl-4 text-xs text-blue-600 space-y-1'>
								<li>Download template excel dibawah ini.</li>
								<li>Isi NIS dan Nama Lengkap siswa.</li>
								<li>Upload file yang sudah diisi.</li>
							</ul>

							{/* TOMBOL DOWNLOAD TEMPLATE */}
							<button
								type='button'
								onClick={handleDownloadTemplate} // Memanggil fungsi yang benar
								className='mt-3 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline'>
								<IconFileSpreadsheet className='h-4 w-4' />
								Download Template {currentKelas}
							</button>
						</div>

						<div className='relative'>
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Upload File Excel</label>
							<div className='flex w-full items-center justify-center'>
								<label
									onDragOver={handleDragOver}
									onDrop={handleDrop}
									className='flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 transition-all'>
									<div className='flex flex-col items-center justify-center pb-6 pt-5'>
										<IconUpload className='mb-3 h-8 w-8 text-gray-400' />
										<p className='mb-2 text-sm text-gray-500'>
											<span className='font-semibold text-indigo-600'>Klik untuk upload</span>
										</p>
										<p className='text-xs text-gray-500'>XLSX, CSV (MAX. 5MB)</p>
									</div>
									<input
										type='file'
										className='hidden'
										accept='.xlsx, .xls, .csv'
										onChange={(e) => setFile(e.target.files[0])}
									/>
								</label>
							</div>
							{file && (
								<div className='mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>
									<IconFileSpreadsheet className='h-4 w-4' />
									<span className='truncate flex-1'>{file.name}</span>
									<button
										type='button'
										onClick={() => setFile(null)}
										className='text-emerald-500 hover:text-emerald-800'>
										✕
									</button>
								</div>
							)}
						</div>

						<div className='flex gap-3 pt-4'>
							<button
								type='button'
								onClick={onClose}
								className='flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'>
								Batal
							</button>
							<button
								type='submit'
								disabled={loading || !file}
								className='flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-70 disabled:bg-gray-300'>
								{loading ? 'Mengupload...' : 'Upload Data'}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
