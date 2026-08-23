'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Swal from 'sweetalert2';

// Metadata tabel untuk ditampilkan di UI
const TABLE_INFO = [
	{ name: 'users', label: 'Data Pengguna', desc: 'Profil guru & admin', icon: '👤' },
	{ name: 'kelas', label: 'Data Kelas', desc: 'Daftar kelas', icon: '🏫' },
	{ name: 'mapel', label: 'Mata Pelajaran', desc: 'Daftar mapel', icon: '📚' },
	{ name: 'siswa', label: 'Data Siswa', desc: 'Profil siswa', icon: '🎒' },
	{ name: 'guru_kbm', label: 'Penugasan KBM', desc: 'Guru mengajar di kelas & mapel', icon: '📋' },
	{ name: 'jadwal', label: 'Jadwal', desc: 'Jadwal mengajar guru', icon: '🗓️' },
	{ name: 'jurnal', label: 'Jurnal Mengajar', desc: 'Jurnal harian guru', icon: '📝' },
	{ name: 'nilai_tugas', label: 'Header Penilaian', desc: 'Metadata tugas & penilaian', icon: '📊' },
	{ name: 'nilai_siswa', label: 'Nilai Siswa', desc: 'Nilai per tugas per siswa', icon: '🏆' },
	{ name: 'absensi_harian', label: 'Sesi Absensi Harian', desc: 'Sesi absensi kelas harian', icon: '📆' },
	{ name: 'absensi_harian_siswa', label: 'Detail Absensi Harian', desc: 'Status absensi per siswa', icon: '✅' },
	{ name: 'absensi_mapel', label: 'Sesi Absensi Mapel', desc: 'Sesi absensi per mapel', icon: '📆' },
	{ name: 'absensi_mapel_siswa', label: 'Detail Absensi Mapel', desc: 'Status absensi mapel per siswa', icon: '✅' },
	{ name: 'poin', label: 'Poin Perilaku', desc: 'Reward & sanksi poin siswa', icon: '⭐' },
	{ name: 'grup', label: 'Grup Kegiatan', desc: 'Pembagian grup kegiatan', icon: '👥' },
	{ name: 'tugas_online', label: 'Tugas Online', desc: 'Soal & tugas online siswa', icon: '💻' },
	{ name: 'pengumpulan_tugas', label: 'Pengumpulan Tugas', desc: 'Submisi tugas oleh siswa', icon: '📤' },
	{ name: 'catatan', label: 'Catatan Guru', desc: 'Catatan pribadi guru', icon: '🗒️' },
];

function StatusBadge({ status }) {
	if (status === 'success') {
		return (
			<span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-400 text-black border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
				✅ Berhasil
			</span>
		);
	}
	if (status === 'partial') {
		return (
			<span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-yellow-300 text-black border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
				⚠️ Sebagian
			</span>
		);
	}
	if (status === 'skipped') {
		return (
			<span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 border border-black/30'>
				— Dilewati
			</span>
		);
	}
	return null;
}

export default function BackupPage() {
	const [activeTab, setActiveTab] = useState('backup');

	// State: Backup
	const [isBackingUp, setIsBackingUp] = useState(false);
	const [lastBackupTime, setLastBackupTime] = useState(null);

	useEffect(() => {
		const saved = localStorage.getItem('last_backup_time');
		if (saved) setLastBackupTime(saved);
	}, []);

	// State: Restore
	const [selectedFile, setSelectedFile] = useState(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const [restoreProgress, setRestoreProgress] = useState(null);
	const [restoreReport, setRestoreReport] = useState(null);
	const fileInputRef = useRef(null);

	// Handler: Download Backup Excel
	const handleDownloadBackup = async () => {
		setIsBackingUp(true);
		try {
			const response = await fetch('/api/backup');

			if (response.status === 401) {
				throw new Error('Sesi tidak valid. Harap login ulang.');
			}
			if (response.status === 403) {
				throw new Error('Akses ditolak. Hanya Admin yang dapat melakukan backup.');
			}
			if (!response.ok) {
				const errData = await response.json().catch(() => ({}));
				throw new Error(errData.error || 'Gagal menghubungi server backup.');
			}

			const blob = await response.blob();
			const contentDisposition = response.headers.get('Content-Disposition') || '';
			const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
			const filename = filenameMatch ? filenameMatch[1] : 'backup_guru-app.xlsx';

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
			localStorage.setItem('last_backup_time', now);
			setLastBackupTime(now);

			Swal.fire({
				icon: 'success',
				title: 'Backup Berhasil!',
				text: `File cadangan "${filename}" telah berhasil diunduh ke komputer Anda.`,
				confirmButtonColor: '#00A693',
			});
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Backup Gagal',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setIsBackingUp(false);
		}
	};

	const handleFileSelect = useCallback((file) => {
		if (!file) return;
		if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
			Swal.fire('Format Salah', 'Harap pilih file spreadsheet Excel (.xlsx) resmi hasil backup.', 'warning');
			return;
		}
		setSelectedFile(file);
		setRestoreReport(null);
	}, []);

	const handleDragOver = useCallback((e) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e) => {
			e.preventDefault();
			setIsDragging(false);
			const file = e.dataTransfer.files[0];
			handleFileSelect(file);
		},
		[handleFileSelect],
	);

	// Handler: Mulai Restore
	const handleRestore = async () => {
		if (!selectedFile) return;

		const confirm = await Swal.fire({
			icon: 'warning',
			title: 'Konfirmasi Pemulihan Data',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Anda akan me-restore database dari file:</p>
					<p class="font-black text-black bg-yellow-100 p-2 rounded-lg border-2 border-black">${selectedFile.name}</p>
					<p class="text-xs text-orange-950 font-bold bg-orange-100 p-2 rounded-lg border border-black/20">
						⚠️ Strategi: <b>Upsert</b> — data yang sudah ada akan diperbarui, data baru akan ditambahkan tanpa menghapus data di luar file backup.
					</p>
				</div>
			`,
			showCancelButton: true,
			confirmButtonText: 'Ya, Mulai Restore Sekarang',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
		});

		if (!confirm.isConfirmed) return;

		setIsRestoring(true);
		setRestoreReport(null);
		setRestoreProgress({ current: 0, total: TABLE_INFO.length, tableName: 'Mempersiapkan data...' });

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/backup/restore', {
				method: 'POST',
				body: formData,
			});

			if (response.status === 401) throw new Error('Sesi tidak valid. Harap login ulang.');
			if (response.status === 403) throw new Error('Akses ditolak. Hanya Admin yang dapat melakukan restore.');

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Terjadi kesalahan saat restore.');
			}

			setRestoreReport(result.report);
			setRestoreProgress(null);

			const successCount = result.report.filter((r) => r.status === 'success').length;
			const failCount = result.report.filter((r) => r.status === 'partial').length;

			Swal.fire({
				icon: failCount === 0 ? 'success' : 'warning',
				title: 'Restore Selesai',
				text: `${successCount} tabel berhasil dipulihkan, ${failCount} tabel sebagian berhasil.`,
				confirmButtonColor: '#00A693',
			});
		} catch (err) {
			setRestoreProgress(null);
			Swal.fire({
				icon: 'error',
				title: 'Restore Gagal',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setIsRestoring(false);
		}
	};

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-rose-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>💾</span> Keamanan & Cadangan Data
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Backup & Restore Database
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Ekspor seluruh 18 tabel aplikasi ke satu file Excel (.xlsx) atau pulihkan data dari file cadangan resmi.
					</p>
				</div>

				{lastBackupTime && (
					<div className='bg-emerald-100 border-2 border-black rounded-xl px-3.5 py-2 text-xs font-bold text-black shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2 self-stretch sm:self-auto'>
						<span>🕒</span>
						<span>Backup terakhir: <b>{lastBackupTime}</b></span>
					</div>
				)}
			</div>

			{/* Tab Switcher */}
			<div className='flex gap-2 bg-yellow-100 p-1.5 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] w-fit'>
				<button
					onClick={() => setActiveTab('backup')}
					className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase transition-all border-2 ${
						activeTab === 'backup'
							? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#F5C518]'
							: 'bg-white text-black border-transparent hover:bg-yellow-200'
					}`}>
					📥 Ekspor Backup (Download)
				</button>
				<button
					onClick={() => setActiveTab('restore')}
					className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase transition-all border-2 ${
						activeTab === 'restore'
							? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#F5C518]'
							: 'bg-white text-black border-transparent hover:bg-yellow-200'
					}`}>
					🔄 Pemulihan Data (Restore)
				</button>
			</div>

			{/* ==================== TAB: BACKUP ==================== */}
			{activeTab === 'backup' && (
				<div className='space-y-6 animate-in fade-in duration-150'>
					{/* Info Banner */}
					<div className='bg-blue-50 border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-start gap-4'>
						<span className='text-2xl shrink-0'>ℹ️</span>
						<div className='space-y-1'>
							<h3 className='text-sm font-black uppercase text-black'>Mekanisme Pencadangan Data</h3>
							<p className='text-xs font-medium text-gray-700 leading-relaxed'>
								Sistem akan mengekstrak seluruh data dari <b>18 tabel database Supabase</b> dan mengompilasinya ke dalam 1 file buku kerja Excel (.xlsx), di mana setiap tabel menjadi satu sheet mandiri yang rapi.
							</p>
						</div>
					</div>

					{/* Tabel List Grid */}
					<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
							<span>📋</span> Cakupan 18 Tabel Data Cadangan
						</h3>

						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
							{TABLE_INFO.map((t) => (
								<div
									key={t.name}
									className='border-2 border-black rounded-xl p-3.5 bg-yellow-50/40 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-3'>
									<span className='text-2xl'>{t.icon}</span>
									<div className='min-w-0'>
										<p className='text-xs sm:text-sm font-black text-black truncate'>{t.label}</p>
										<p className='text-[10px] font-mono font-bold text-gray-500 truncate'>{t.name}</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Download Trigger */}
					<div className='flex justify-start'>
						<button
							onClick={handleDownloadBackup}
							disabled={isBackingUp}
							className='neo-btn-primary flex items-center gap-3 text-sm !py-3.5 !px-8 bg-black text-white shadow-[4px_4px_0px_0px_#0D0D0D] disabled:opacity-50'>
							{isBackingUp ? (
								<>
									<div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
									<span>Menghasilkan Spreadsheet Excel...</span>
								</>
							) : (
								<>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
									</svg>
									<span>Unduh File Cadangan Excel (.xlsx)</span>
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* ==================== TAB: RESTORE ==================== */}
			{activeTab === 'restore' && (
				<div className='space-y-6 animate-in fade-in duration-150'>
					{/* Warning Box */}
					<div className='bg-orange-50 border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-start gap-4'>
						<span className='text-2xl shrink-0'>⚠️</span>
						<div className='space-y-1'>
							<h3 className='text-sm font-black uppercase text-orange-950'>Perhatian Strategi Pemulihan (Upsert)</h3>
							<ul className='text-xs font-medium text-orange-900 space-y-0.5 list-disc list-inside'>
								<li>Hanya gunakan file Excel (.xlsx) yang diunduh langsung dari fitur backup resmi GuruApp ini.</li>
								<li>Data yang sudah ada akan diperbarui nilainya, data baru akan ditambahkan.</li>
							</ul>
						</div>
					</div>

					{/* Dropzone Container */}
					<div
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onClick={() => !isRestoring && fileInputRef.current?.click()}
						className={`border-3 border-dashed border-black rounded-2xl p-10 text-center cursor-pointer transition-all ${
							isDragging
								? 'bg-yellow-200 shadow-[6px_6px_0px_0px_#0D0D0D]'
								: selectedFile
								? 'bg-emerald-100 shadow-[5px_5px_0px_0px_#0D0D0D]'
								: 'bg-white hover:bg-yellow-50 shadow-[4px_4px_0px_0px_#0D0D0D]'
						} ${isRestoring ? 'pointer-events-none opacity-60' : ''}`}>
						<input
							ref={fileInputRef}
							type='file'
							accept='.xlsx,.xls'
							className='hidden'
							onChange={(e) => handleFileSelect(e.target.files[0])}
						/>

						{selectedFile ? (
							<div className='flex flex-col items-center gap-2'>
								<span className='text-5xl'>📊</span>
								<p className='text-base font-black text-black'>{selectedFile.name}</p>
								<span className='px-3 py-1 bg-white border border-black rounded-md text-xs font-bold text-gray-700 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									{(selectedFile.size / 1024).toFixed(1)} KB &bull; Klik untuk mengganti file
								</span>
							</div>
						) : (
							<div className='flex flex-col items-center gap-2'>
								<span className='text-5xl'>📁</span>
								<p className='text-base font-black text-black'>Tarik & Lepas File Excel Backup di Sini</p>
								<p className='text-xs font-bold text-gray-500'>atau klik area ini untuk memilih file (.xlsx)</p>
							</div>
						)}
					</div>

					{/* Restore Button */}
					<div>
						<button
							onClick={handleRestore}
							disabled={!selectedFile || isRestoring}
							className='neo-btn-primary flex items-center gap-3 text-sm !py-3.5 !px-8 bg-black text-white shadow-[4px_4px_0px_0px_#0D0D0D] disabled:opacity-50'>
							{isRestoring ? (
								<>
									<div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
									<span>Sedang Memulihkan Database...</span>
								</>
							) : (
								<>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
									</svg>
									<span>Mulai Pulihkan Data (Restore)</span>
								</>
							)}
						</button>
					</div>

					{/* Restore Progress Bar */}
					{isRestoring && restoreProgress && (
						<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-2'>
							<div className='flex items-center justify-between text-xs font-black uppercase text-black'>
								<span>Memproses Restore Database...</span>
								<span>Harap Tunggu</span>
							</div>
							<div className='w-full bg-gray-200 border-2 border-black rounded-full h-4 overflow-hidden p-0.5'>
								<div className='bg-emerald-400 h-full rounded-full animate-pulse' style={{ width: '100%' }}></div>
							</div>
							<p className='text-xs font-bold text-gray-600 animate-pulse'>Mengirim dan menyusun data ke tabel Supabase...</p>
						</div>
					)}

					{/* Restore Report Card */}
					{restoreReport && (
						<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden space-y-4 p-6'>
							<div className='flex items-center justify-between pb-3 border-b-2 border-black'>
								<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
									<span>📋</span> Laporan Rinci Hasil Restore
								</h3>
								<div className='flex items-center gap-2 text-xs font-black'>
									<span className='text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300'>
										Berhasil: {restoreReport.filter((r) => r.status === 'success').length}
									</span>
									<span className='text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded border border-yellow-300'>
										Sebagian: {restoreReport.filter((r) => r.status === 'partial').length}
									</span>
								</div>
							</div>

							<div className='divide-y-2 divide-black/10'>
								{restoreReport.map((r) => (
									<div key={r.table} className='py-3 flex items-center justify-between gap-4'>
										<div className='flex items-center gap-3'>
											<span className='text-xl'>
												{TABLE_INFO.find((t) => t.name === r.table)?.icon || '📄'}
											</span>
											<div>
												<p className='text-sm font-black text-black'>
													{TABLE_INFO.find((t) => t.name === r.table)?.label || r.table}
												</p>
												<p className='text-[10px] font-mono font-bold text-gray-500'>{r.table}</p>
											</div>
										</div>
										<div className='flex items-center gap-3'>
											{r.status !== 'skipped' && (
												<span className='text-xs font-mono font-bold text-gray-600'>{r.count} baris</span>
											)}
											<StatusBadge status={r.status} />
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
