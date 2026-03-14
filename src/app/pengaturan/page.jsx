'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

const SPREADSHEET_KEY = 'SPREADSHEET_ID';
const SHEET_NAME_KEY = 'SHEET_NAME';

export default function PengaturanPage() {
	const [spreadsheetId, setSpreadsheetId] = useState('');
	const [sheetName, setSheetName] = useState('');
	const [saved, setSaved] = useState(false);
	const [activeTab, setActiveTab] = useState('koneksi');
	const [isBackingUp, setIsBackingUp] = useState(false);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			setSpreadsheetId(localStorage.getItem(SPREADSHEET_KEY) || '');
			setSheetName(localStorage.getItem(SHEET_NAME_KEY) || '');
		}
	}, []);

	const handleSave = () => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(SPREADSHEET_KEY, spreadsheetId.trim());
			localStorage.setItem(SHEET_NAME_KEY, sheetName.trim());
		}
		setSaved(true);
		setTimeout(() => setSaved(false), 3000);
	};

	const handleBackup = async () => {
		try {
			setIsBackingUp(true);
			const res = await fetch('/api/backup');
			if (!res.ok) throw new Error('Gagal mengambil data dari server');

			const data = await res.json();
			const workbook = XLSX.utils.book_new();

			// Iterate object keys (sheet titles)
			Object.keys(data).forEach((sheetTitle) => {
				const sheetData = data[sheetTitle];
				// Jika kosong, minimal kasih header kosong atau array kosong
				const worksheet = XLSX.utils.json_to_sheet(sheetData.length ? sheetData : [{}]);
				XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.replace('MASTER_', ''));
			});

			const dateStr = new Date().toISOString().slice(0, 10);
			XLSX.writeFile(workbook, `Backup_GuruApp_${dateStr}.xlsx`);

			Swal.fire('Berhasil', 'Database berhasil dibackup ke mode Excel', 'success');
		} catch (error) {
			console.error(error);
			Swal.fire('Error', error.message || 'Terjadi kesalahan saat membackup data', 'error');
		} finally {
			setIsBackingUp(false);
		}
	};

	const appInfo = [
		{ label: 'Nama Aplikasi', value: 'GuruApp' },
		{ label: 'Versi', value: '1.0.0' },
		{ label: 'Framework', value: 'Next.js 14' },
		{ label: 'Backend', value: 'Google Sheets API' },
	];

	const menuLinks = [
		{
			label: 'Kelas',
			route: '/kelas',
			icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
			color: 'from-orange-400 to-red-500',
		},
		{ label: 'Siswa', route: '/siswa', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'from-cyan-400 to-blue-500' },
		{
			label: 'Mata Pelajaran',
			route: '/mapel',
			icon:
				'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
			color: 'from-yellow-400 to-orange-500',
		},
		{ label: 'Jadwal', route: '/jadwal', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'from-pink-400 to-rose-500' },
		{
			label: 'Jurnal',
			route: '/jurnal',
			icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
			color: 'from-teal-400 to-cyan-500',
		},
		{
			label: 'Grup',
			route: '/grup',
			icon:
				'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
			color: 'from-violet-400 to-purple-500',
		},
	];

	const tabs = [
		{ id: 'koneksi', label: 'Koneksi Data', emoji: '🔗' },
		{ id: 'backup', label: 'Backup Data', emoji: '💾' },
		{ id: 'navigasi', label: 'Navigasi', emoji: '🗺️' },
		{ id: 'tentang', label: 'Tentang', emoji: 'ℹ️' },
	];

	return (
		<main className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
			<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
				{/* Header */}
				<div className='flex items-center gap-4 mb-8'>
					<Link
						href='/'
						className='p-2 rounded-xl bg-white shadow hover:shadow-md transition-all text-gray-600 hover:text-indigo-600'>
						<svg
							className='w-5 h-5'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					</Link>
					<div>
						<h1 className='text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2'>
							<span>⚙️</span> Pengaturan
						</h1>
						<p className='text-gray-500 text-sm'>Kelola konfigurasi aplikasi GuruApp</p>
					</div>
				</div>

				{/* Tabs */}
				<div className='flex gap-2 mb-6 bg-white rounded-2xl p-1.5 shadow border border-gray-100 overflow-x-auto'>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
								activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
							}`}>
							<span>{tab.emoji}</span>
							{tab.label}
						</button>
					))}
				</div>

				{/* TAB: Koneksi Data */}
				{activeTab === 'koneksi' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4'
									/>
								</svg>
							</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Koneksi Google Sheets</h2>
								<p className='text-sm text-gray-500'>Konfigurasi sumber data aplikasi</p>
							</div>
						</div>

						<div className='space-y-4'>
							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Spreadsheet ID</label>
								<input
									type='text'
									value={spreadsheetId}
									onChange={(e) => setSpreadsheetId(e.target.value)}
									placeholder='Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'
									className='w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm font-mono bg-gray-50'
								/>
								<p className='text-xs text-gray-400 mt-1'>
									Temukan ID di URL Google Sheets Anda:{' '}
									<code className='bg-gray-100 px-1 rounded'>
										docs.google.com/spreadsheets/d/<span className='text-indigo-500 font-bold'>[ID]</span>/edit
									</code>
								</p>
							</div>

							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Nama Sheet (opsional)</label>
								<input
									type='text'
									value={sheetName}
									onChange={(e) => setSheetName(e.target.value)}
									placeholder='Contoh: Data Siswa'
									className='w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm bg-gray-50'
								/>
							</div>

							<div className='pt-2'>
								<button
									onClick={handleSave}
									className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 ${
										saved ? 'bg-green-500 scale-[0.99]' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:scale-[1.01]'
									}`}>
									{saved ? (
										<>
											<svg
												className='w-5 h-5'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M5 13l4 4L19 7'
												/>
											</svg>
											Tersimpan!
										</>
									) : (
										<>
											<svg
												className='w-5 h-5'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
												/>
											</svg>
											Simpan Pengaturan
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* TAB: Backup Data */}
				{activeTab === 'backup' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-2'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
									/>
								</svg>
							</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Backup Database Lokal</h2>
								<p className='text-sm text-gray-500'>Amankan semua data aplikasi ke file Excel</p>
							</div>
						</div>

						<div className='bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3'>
							<span className='text-xl'>⚠️</span>
							<p className='text-sm text-orange-800'>
								Proses ini akan mengunduh seluruh data (Kelas, Mapel, Siswa, Nilai, Absensi, Jurnal) dari Google Sheets pusat ke dalam format{' '}
								<span className='font-bold bg-orange-200 px-1 rounded'>.xlsx</span> untuk keperluan arsip/offline. Harap simpan file backup dengan aman.
							</p>
						</div>

						<button
							onClick={handleBackup}
							disabled={isBackingUp}
							className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-3 shadow hover:shadow-lg ${
								isBackingUp ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-[1.01]'
							}`}>
							{isBackingUp ? (
								<>
									<div className='w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin'></div>
									Sedang Memproses Backup...
								</>
							) : (
								<>
									<svg
										className='w-6 h-6'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
										/>
									</svg>
									Download Backup Database (.xlsx)
								</>
							)}
						</button>
					</div>
				)}

				{/* TAB: Navigasi */}
				{activeTab === 'navigasi' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M4 6h16M4 12h16M4 18h16'
									/>
								</svg>
							</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Navigasi Menu</h2>
								<p className='text-sm text-gray-500'>Akses cepat ke semua halaman</p>
							</div>
						</div>

						<div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
							{menuLinks.map((item, idx) => (
								<Link
									key={idx}
									href={item.route}
									className={`bg-gradient-to-br ${item.color} p-4 rounded-xl text-white flex items-center gap-3 hover:scale-105 transition-all duration-200 shadow hover:shadow-lg group`}>
									<div className='bg-white/20 rounded-lg p-2 group-hover:bg-white/30 transition-all'>
										<svg
											className='w-5 h-5'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d={item.icon}
											/>
										</svg>
									</div>
									<span className='font-semibold text-sm'>{item.label}</span>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* TAB: Tentang */}
				{activeTab === 'tentang' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6'>
						<div className='text-center mb-8'>
							<div className='inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4'>
								<svg
									className='w-10 h-10 text-white'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={1.5}
										d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
									/>
								</svg>
							</div>
							<h2 className='text-2xl font-bold text-gray-800'>GuruApp</h2>
							<p className='text-gray-500 text-sm mt-1'>Aplikasi manajemen kelas modern</p>
						</div>

						<div className='space-y-3'>
							{appInfo.map((info, idx) => (
								<div
									key={idx}
									className='flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0'>
									<span className='text-sm text-gray-500'>{info.label}</span>
									<span className='text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg'>{info.value}</span>
								</div>
							))}
						</div>

						<div className='mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100'>
							<p className='text-xs text-indigo-600 text-center'>Dibuat dengan ❤️ untuk memudahkan pengelolaan kelas dan administrasi guru</p>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
