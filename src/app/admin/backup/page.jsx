'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Swal from 'sweetalert2';

// ============================================================
// Metadata tabel untuk ditampilkan di UI
// ============================================================
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

// ============================================================
// Sub-komponen: Status Badge untuk laporan restore
// ============================================================
function StatusBadge({ status }) {
	if (status === 'success') return (
		<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
			✅ Berhasil
		</span>
	);
	if (status === 'partial') return (
		<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
			⚠️ Sebagian
		</span>
	);
	if (status === 'skipped') return (
		<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
			— Dilewati
		</span>
	);
	return null;
}

// ============================================================
// Main Page Component
// ============================================================
export default function BackupPage() {
	const [activeTab, setActiveTab] = useState('backup');

	// --- State: Backup ---
	const [isBackingUp, setIsBackingUp] = useState(false);
	// BUG FIX #6: Gunakan useEffect untuk baca localStorage (aman di SSR)
	const [lastBackupTime, setLastBackupTime] = useState(null);
	useEffect(() => {
		const saved = localStorage.getItem('last_backup_time');
		if (saved) setLastBackupTime(saved);
	}, []);

	// --- State: Restore ---
	const [selectedFile, setSelectedFile] = useState(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const [restoreProgress, setRestoreProgress] = useState(null); // { current, total, tableName }
	const [restoreReport, setRestoreReport] = useState(null);
	const fileInputRef = useRef(null);

	// ============================================================
	// Handler: Download Backup Excel
	// ============================================================
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

			// Buat blob dari response dan trigger download
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

			// Simpan timestamp
			const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
			localStorage.setItem('last_backup_time', now);
			setLastBackupTime(now);

			Swal.fire({
				icon: 'success',
				title: 'Backup Berhasil!',
				text: `File "${filename}" telah berhasil diunduh.`,
				confirmButtonColor: '#1e3a8a',
			});
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Backup Gagal',
				text: err.message,
				confirmButtonColor: '#dc2626',
			});
		} finally {
			setIsBackingUp(false);
		}
	};

	// BUG FIX #7: handleFileSelect perlu di-memoize juga agar bisa masuk dependency handleDrop
	const handleFileSelect = useCallback((file) => {
		if (!file) return;
		if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
			Swal.fire('Format Salah', 'Harap pilih file Excel (.xlsx) hasil backup.', 'warning');
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

	const handleDrop = useCallback((e) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		handleFileSelect(file);
		// BUG FIX #7: handleFileSelect ada di dependency array
	}, [handleFileSelect]);

	// ============================================================
	// Handler: Mulai Restore
	// ============================================================
	const handleRestore = async () => {
		if (!selectedFile) return;

		const confirm = await Swal.fire({
			icon: 'warning',
			title: 'Konfirmasi Restore',
			html: `
				<p class="text-sm text-gray-600">Anda akan me-restore data dari file:</p>
				<p class="font-bold text-gray-800 mt-1">${selectedFile.name}</p>
				<p class="text-sm text-amber-600 mt-3">
					⚠️ Strategi: <strong>Upsert</strong> — data yang sudah ada akan diperbarui, data baru akan ditambahkan.
				</p>
			`,
			showCancelButton: true,
			confirmButtonText: 'Ya, Mulai Restore',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#1e3a8a',
			cancelButtonColor: '#6b7280',
		});

		if (!confirm.isConfirmed) return;

		setIsRestoring(true);
		setRestoreReport(null);
		setRestoreProgress({ current: 0, total: TABLE_INFO.length, tableName: 'Mempersiapkan...' });

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
				text: `${successCount} tabel berhasil, ${failCount} tabel sebagian berhasil.`,
				confirmButtonColor: '#1e3a8a',
			});
		} catch (err) {
			setRestoreProgress(null);
			Swal.fire({
				icon: 'error',
				title: 'Restore Gagal',
				text: err.message,
				confirmButtonColor: '#dc2626',
			});
		} finally {
			setIsRestoring(false);
		}
	};

	// ============================================================
	// Render
	// ============================================================
	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			{/* Header */}
			<div className="mb-8">
				<div className="flex items-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
						</svg>
					</div>
					<div>
						<h1 className="text-2xl font-extrabold text-gray-800">Backup & Restore Data</h1>
						<p className="text-sm text-gray-500">Ekspor dan pulihkan seluruh data aplikasi ke/dari file Excel</p>
					</div>
				</div>

				{lastBackupTime && (
					<div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
						<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Backup terakhir: <strong>{lastBackupTime}</strong>
					</div>
				)}
			</div>

			{/* Tab Navigation */}
			<div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
				<button
					id="tab-backup"
					onClick={() => setActiveTab('backup')}
					className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'backup'
						? 'bg-white text-blue-700 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'
						}`}
				>
					📥 Backup (Export)
				</button>
				<button
					id="tab-restore"
					onClick={() => setActiveTab('restore')}
					className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'restore'
						? 'bg-white text-blue-700 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'
						}`}
				>
					🔄 Restore (Import)
				</button>
			</div>

			{/* ==================== TAB: BACKUP ==================== */}
			{activeTab === 'backup' && (
				<div>
					{/* Info Card */}
					<div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
						<svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<p className="text-sm font-semibold text-blue-800">Cara Kerja Backup</p>
							<p className="text-xs text-blue-600 mt-0.5">
								Sistem akan mengambil seluruh data dari <strong>18 tabel</strong> Supabase dan mengemasnya dalam satu file Excel (.xlsx).
								Setiap tabel menjadi satu sheet terpisah. File ini bisa digunakan untuk pemulihan data jika terjadi kehilangan data.
							</p>
						</div>
					</div>

					{/* Daftar Tabel */}
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
						<div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
							<h2 className="text-sm font-bold text-gray-700">Tabel yang Akan Di-backup ({TABLE_INFO.length} tabel)</h2>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
							{TABLE_INFO.map((t) => (
								<div key={t.name} className="bg-white px-4 py-3 flex items-center gap-3">
									<span className="text-xl">{t.icon}</span>
									<div>
										<p className="text-sm font-semibold text-gray-800">{t.label}</p>
										<p className="text-xs text-gray-400 font-mono">{t.name}</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Tombol Download */}
					<button
						id="btn-download-backup"
						onClick={handleDownloadBackup}
						disabled={isBackingUp}
						className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:scale-100"
					>
						{isBackingUp ? (
							<>
								<svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
								</svg>
								Membuat file Excel...
							</>
						) : (
							<>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
								Download Backup Excel
							</>
						)}
					</button>
				</div>
			)}

			{/* ==================== TAB: RESTORE ==================== */}
			{activeTab === 'restore' && (
				<div>
					{/* Warning Box */}
					<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
						<svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div>
							<p className="text-sm font-bold text-amber-800">Strategi Restore: Upsert</p>
							<ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
								<li>Data yang <strong>sudah ada</strong> di database akan <strong>diperbarui</strong> sesuai isi file backup</li>
								<li>Data yang <strong>belum ada</strong> akan <strong>ditambahkan</strong> baru</li>
								<li>Data yang ada di database tapi <strong>tidak ada di file backup</strong> akan <strong>dibiarkan</strong> (tidak dihapus)</li>
								<li>Hanya gunakan file Excel dari fitur Backup resmi ini</li>
							</ul>
						</div>
					</div>

					{/* Dropzone */}
					<div
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onClick={() => !isRestoring && fileInputRef.current?.click()}
						className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-6 ${isDragging
							? 'border-blue-500 bg-blue-50'
							: selectedFile
								? 'border-emerald-400 bg-emerald-50'
								: 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
							} ${isRestoring ? 'pointer-events-none opacity-60' : ''}`}
					>
						<input
							ref={fileInputRef}
							type="file"
							accept=".xlsx,.xls"
							className="hidden"
							onChange={(e) => handleFileSelect(e.target.files[0])}
							id="file-restore-input"
						/>

						{selectedFile ? (
							<div className="flex flex-col items-center gap-2">
								<span className="text-4xl">📊</span>
								<p className="text-sm font-bold text-emerald-700">{selectedFile.name}</p>
								<p className="text-xs text-gray-500">
									{(selectedFile.size / 1024).toFixed(1)} KB · Klik untuk ganti file
								</p>
							</div>
						) : (
							<div className="flex flex-col items-center gap-2">
								<svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
										d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<p className="text-sm font-semibold text-gray-600">Drag & drop file Excel di sini</p>
								<p className="text-xs text-gray-400">atau klik untuk memilih file (.xlsx)</p>
							</div>
						)}
					</div>

					{/* Tombol Restore */}
					<button
						id="btn-start-restore"
						onClick={handleRestore}
						disabled={!selectedFile || isRestoring}
						className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:scale-100 mb-6"
					>
						{isRestoring ? (
							<>
								<svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
								</svg>
								Sedang Restore...
							</>
						) : (
							<>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Mulai Restore Data
							</>
						)}
					</button>

					{/* Progress Indicator */}
					{isRestoring && restoreProgress && (
						<div className="bg-white border border-blue-200 rounded-xl p-4 mb-6">
							<div className="flex items-center justify-between mb-2">
								<p className="text-sm font-semibold text-gray-700">Sedang memproses restore...</p>
								<p className="text-xs text-gray-400">Harap tunggu</p>
							</div>
							<div className="w-full bg-gray-100 rounded-full h-2">
								<div
									className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
									style={{ width: '100%' }}
								/>
							</div>
							<p className="text-xs text-gray-500 mt-2 animate-pulse">Mengirim data ke server...</p>
						</div>
					)}

					{/* Laporan Hasil Restore */}
					{restoreReport && (
						<div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
							<div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
								<span className="text-lg">📋</span>
								<h2 className="text-sm font-bold text-gray-700">Laporan Hasil Restore</h2>
							</div>
							<div className="divide-y divide-gray-50">
								{restoreReport.map((r) => (
									<div key={r.table} className="px-5 py-3 flex items-center justify-between gap-4">
										<div className="flex items-center gap-3">
											<span className="text-base">
												{TABLE_INFO.find((t) => t.name === r.table)?.icon || '📄'}
											</span>
											<div>
												<p className="text-sm font-semibold text-gray-800">
													{TABLE_INFO.find((t) => t.name === r.table)?.label || r.table}
												</p>
												<p className="text-xs text-gray-400 font-mono">{r.table}</p>
											</div>
										</div>
										<div className="flex items-center gap-3 flex-shrink-0">
											{r.status !== 'skipped' && (
												<span className="text-xs text-gray-500">{r.count} baris</span>
											)}
											<StatusBadge status={r.status} />
										</div>
									</div>
								))}
							</div>
							{/* Summary */}
							<div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-4 text-xs font-semibold">
								<span className="text-emerald-700">
									✅ Berhasil: {restoreReport.filter((r) => r.status === 'success').length}
								</span>
								<span className="text-amber-700">
									⚠️ Sebagian: {restoreReport.filter((r) => r.status === 'partial').length}
								</span>
								<span className="text-gray-500">
									— Dilewati: {restoreReport.filter((r) => r.status === 'skipped').length}
								</span>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
