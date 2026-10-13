'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
	UploadCloud,
	FileText,
	FileImage,
	FileVideo,
	FileAudio,
	FileArchive,
	FileCode,
	File,
	Download,
	Eye,
	Copy,
	Check,
	Trash2,
	Search,
	Filter,
	ArrowUpDown,
	RefreshCw,
	X,
	LayoutGrid,
	List,
	ExternalLink,
	FolderOpen,
	ShieldCheck,
	Sparkles,
	Maximize2,
	Minimize2,
	ZoomIn,
	ZoomOut,
	RotateCw,
	FileSpreadsheet,
	Presentation,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { swalConfirmDelete, swalSuccess, swalError } from '@/lib/swal';

// Helper Format Tanggal
function formatDate(isoStr) {
	if (!isoStr) return '-';
	try {
		const date = new Date(isoStr);
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return isoStr;
	}
}

// Helper Waktu Relatif
function formatRelative(isoStr) {
	if (!isoStr) return '-';
	try {
		const now = new Date();
		const date = new Date(isoStr);
		const diffMs = now - date;
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHour / 24);

		if (diffMin < 1) return 'Baru saja';
		if (diffMin < 60) return `${diffMin} menit lalu`;
		if (diffHour < 24) return `${diffHour} jam lalu`;
		if (diffDay < 7) return `${diffDay} hari lalu`;
		return formatDate(isoStr);
	} catch {
		return isoStr;
	}
}

// Helper Ikon Berkas Berdasarkan Ekstensi & Kategori
function getFileIcon(filename = '', category = '', className = 'w-6 h-6') {
	const ext = filename.split('.').pop()?.toLowerCase() || '';

	if (['xls', 'xlsx', 'csv'].includes(ext)) {
		return <FileSpreadsheet className={`${className} text-emerald-600`} />;
	}
	if (['ppt', 'pptx'].includes(ext)) {
		return <Presentation className={`${className} text-amber-600`} />;
	}
	if (['doc', 'docx'].includes(ext)) {
		return <FileText className={`${className} text-blue-600`} />;
	}
	if (ext === 'pdf') {
		return <FileText className={`${className} text-rose-600`} />;
	}
	if (category === 'gambar' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
		return <FileImage className={`${className} text-purple-600`} />;
	}
	if (category === 'video' || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
		return <FileVideo className={`${className} text-teal-600`} />;
	}
	if (category === 'audio' || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
		return <FileAudio className={`${className} text-pink-600`} />;
	}
	if (category === 'arsip' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
		return <FileArchive className={`${className} text-orange-600`} />;
	}
	if (category === 'kode_teks' || ['txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'sql', 'md'].includes(ext)) {
		return <FileCode className={`${className} text-indigo-600`} />;
	}
	return <File className={`${className} text-gray-600`} />;
}

// Helper Badge Kategori
function getCategoryBadge(category) {
	const config = {
		dokumen: { label: 'Dokumen', bg: 'bg-rose-100 text-rose-800 border-rose-400' },
		gambar: { label: 'Gambar', bg: 'bg-purple-100 text-purple-800 border-purple-400' },
		video: { label: 'Video', bg: 'bg-teal-100 text-teal-800 border-teal-400' },
		audio: { label: 'Audio', bg: 'bg-pink-100 text-pink-800 border-pink-400' },
		arsip: { label: 'Arsip', bg: 'bg-amber-100 text-amber-800 border-amber-400' },
		kode_teks: { label: 'Kode / Teks', bg: 'bg-indigo-100 text-indigo-800 border-indigo-400' },
		lainnya: { label: 'Lainnya', bg: 'bg-gray-100 text-gray-800 border-gray-400' },
	};
	const badge = config[category] || config.lainnya;
	return (
		<span className={`inline-block px-2.5 py-0.5 text-xs font-black uppercase rounded-md border ${badge.bg}`}>
			{badge.label}
		</span>
	);
}

export default function BerkasPage() {
	const [files, setFiles] = useState([]);
	const [stats, setStats] = useState({ totalFiles: 0, totalSize: '0 B', categoryCounts: {} });
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);

	// Filter & Kontrol
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('semua');
	const [sortBy, setSortBy] = useState('terbaru');
	const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

	// Form Upload State
	const [selectedFiles, setSelectedFiles] = useState([]);
	const [uploadTitle, setUploadTitle] = useState('');
	const [uploadCategory, setUploadCategory] = useState('otomatis');
	const [uploadDescription, setUploadDescription] = useState('');
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef(null);

	// Modal Pratinjau / Baca State
	const [previewFile, setPreviewFile] = useState(null);
	const [textContent, setTextContent] = useState('');
	const [loadingText, setLoadingText] = useState(false);
	const [imageZoom, setImageZoom] = useState(1);
	const [imageRotate, setImageRotate] = useState(0);
	const [copiedId, setCopiedId] = useState(null);

	// Fetch Data Berkas
	const fetchFiles = async () => {
		try {
			setLoading(true);
			const res = await fetch('/api/berkas');
			const json = await res.json();
			if (res.ok && json.success) {
				setFiles(json.data || []);
				setStats(json.stats || { totalFiles: 0, totalSize: '0 B', categoryCounts: {} });
			} else {
				console.error('Fetch error:', json.error);
			}
		} catch (err) {
			console.error('Network error fetch berkas:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFiles();
	}, []);

	// Handle Drag & Drop
	const handleDragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const dropped = Array.from(e.dataTransfer.files);
			setSelectedFiles(dropped);
			if (dropped.length === 1 && !uploadTitle) {
				setUploadTitle(dropped[0].name.replace(/\.[^/.]+$/, ''));
			}
		}
	};

	const handleFileSelect = (e) => {
		if (e.target.files && e.target.files.length > 0) {
			const picked = Array.from(e.target.files);
			setSelectedFiles(picked);
			if (picked.length === 1 && !uploadTitle) {
				setUploadTitle(picked[0].name.replace(/\.[^/.]+$/, ''));
			}
		}
	};

	// Eksekusi Unggah Berkas
	const handleUploadSubmit = async (e) => {
		e.preventDefault();
		if (selectedFiles.length === 0) {
			swalError('Peringatan', 'Silakan pilih berkas yang ingin diunggah!');
			return;
		}

		setUploading(true);
		setUploadProgress(20);

		try {
			const formData = new FormData();
			selectedFiles.forEach((file) => {
				formData.append('files', file);
			});
			if (uploadTitle) formData.append('title', uploadTitle);
			if (uploadCategory) formData.append('category', uploadCategory);
			if (uploadDescription) formData.append('description', uploadDescription);

			setUploadProgress(50);

			const res = await fetch('/api/berkas', {
				method: 'POST',
				body: formData,
			});

			setUploadProgress(90);
			const result = await res.json();

			if (res.ok && result.success) {
				setUploadProgress(100);
				swalSuccess('Berhasil!', result.message || 'Berkas berhasil disimpan');
				// Reset Form
				setSelectedFiles([]);
				setUploadTitle('');
				setUploadCategory('otomatis');
				setUploadDescription('');
				if (fileInputRef.current) fileInputRef.current.value = '';
				// Refresh List
				fetchFiles();
			} else {
				throw new Error(result.error || 'Gagal mengunggah berkas');
			}
		} catch (err) {
			swalError('Gagal Mengunggah', err.message || 'Terjadi kesalahan');
		} finally {
			setUploading(false);
			setUploadProgress(0);
		}
	};

	// Hapus Berkas
	const handleDelete = async (file) => {
		const confirm = await swalConfirmDelete(
			'Hapus Berkas?',
			`Apakah Anda yakin ingin menghapus "${file.original_name}"? Berkas ini akan dihapus permanen.`
		);
		if (!confirm.isConfirmed) return;

		try {
			const res = await fetch(`/api/berkas?name=${encodeURIComponent(file.stored_name)}`, {
				method: 'DELETE',
			});
			const result = await res.json();
			if (res.ok && result.success) {
				swalSuccess('Terhapus', 'Berkas berhasil dihapus');
				setFiles((prev) => prev.filter((f) => f.stored_name !== file.stored_name));
				if (previewFile?.stored_name === file.stored_name) {
					setPreviewFile(null);
				}
			} else {
				throw new Error(result.error || 'Gagal menghapus berkas');
			}
		} catch (err) {
			swalError('Gagal', err.message);
		}
	};

	// Salin Link Publik
	const handleCopyLink = (file) => {
		if (!file.url) return;
		navigator.clipboard.writeText(file.url);
		setCopiedId(file.id);
		setTimeout(() => setCopiedId(null), 2000);

		const Toast = Swal.mixin({
			toast: true,
			position: 'top-end',
			showConfirmButton: false,
			timer: 2000,
			timerProgressBar: true,
		});
		Toast.fire({
			icon: 'success',
			title: 'Tautan berkas berhasil disalin!',
		});
	};

	// Buka Modal Pratinjau / Baca
	const handleOpenPreview = async (file) => {
		setPreviewFile(file);
		setImageZoom(1);
		setImageRotate(0);
		setTextContent('');

		const ext = file.original_name.split('.').pop()?.toLowerCase() || '';
		const isTextBased =
			file.category === 'kode_teks' ||
			['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'sql', 'xml'].includes(ext);

		if (isTextBased) {
			setLoadingText(true);
			try {
				const res = await fetch(`/api/berkas/read?name=${encodeURIComponent(file.stored_name)}`);
				const json = await res.json();
				if (res.ok && json.success) {
					setTextContent(json.content || '');
				} else {
					setTextContent('Gagal memuat isi teks berkas ini.');
				}
			} catch {
				setTextContent('Gagal memuat isi teks berkas ini.');
			} finally {
				setLoadingText(false);
			}
		}
	};

	// Filter & Urutkan Berkas
	const filteredAndSortedFiles = useMemo(() => {
		let result = [...files];

		// Filter Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(
				(f) =>
					f.original_name.toLowerCase().includes(q) ||
					(f.title && f.title.toLowerCase().includes(q)) ||
					(f.description && f.description.toLowerCase().includes(q))
			);
		}

		// Filter Kategori
		if (selectedCategory !== 'semua') {
			result = result.filter((f) => f.category === selectedCategory);
		}

		// Sortir
		result.sort((a, b) => {
			if (sortBy === 'terbaru') {
				return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
			}
			if (sortBy === 'terlama') {
				return new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0);
			}
			if (sortBy === 'nama_asc') {
				return a.original_name.localeCompare(b.original_name);
			}
			if (sortBy === 'nama_desc') {
				return b.original_name.localeCompare(a.original_name);
			}
			if (sortBy === 'ukuran_desc') {
				return (b.size || 0) - (a.size || 0);
			}
			if (sortBy === 'ukuran_asc') {
				return (a.size || 0) - (b.size || 0);
			}
			return 0;
		});

		return result;
	}, [files, searchQuery, selectedCategory, sortBy]);

	return (
		<div className="min-h-screen bg-[#FFF5F0] text-[#0D0D0D] pb-16 selection:bg-[#F5C518]">
			{/* Top Bar Header */}
			<header className="sticky top-0 z-30 bg-white border-b-2 border-black shadow-[0_4px_0_0_#0D0D0D]">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="px-3 py-1.5 bg-[#FFF5F0] hover:bg-[#FFE8DC] border-2 border-black rounded-lg font-bold text-sm shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-1.5"
						>
							<span>←</span>
							<span className="hidden sm:inline">Dasbor</span>
						</Link>
						<div className="h-6 w-[2px] bg-black/20 hidden sm:block" />
						<div>
							<h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
								<span className="p-1 bg-[#F5C518] border-2 border-black rounded-md inline-flex items-center justify-center">
									<FolderOpen className="w-5 h-5 text-black" />
								</span>
								<span>Penyimpanan Berkas Publik</span>
							</h1>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-3">
						<div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border-2 border-emerald-500 rounded-full text-xs font-black text-emerald-800">
							<ShieldCheck className="w-4 h-4 text-emerald-600" />
							<span>Akses Terbuka • Tanpa Login</span>
						</div>
						<button
							onClick={fetchFiles}
							disabled={loading}
							title="Segarkan daftar berkas"
							className="p-2 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
						>
							<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
						</button>
					</div>
				</div>
			</header>

			{/* Main Container */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
				{/* Hero & Banner Penjelasan */}
				<section className="bg-[#FFE8DC] border-3 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D] relative overflow-hidden">
					<div className="relative z-10 max-w-3xl">
						<div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8451A] text-white border-2 border-black rounded-lg text-xs font-black uppercase mb-3 shadow-[2px_2px_0px_#0D0D0D]">
							<Sparkles className="w-3.5 h-3.5" />
							<span>Pusat Berbagi Dokumen & Media Bebas</span>
						</div>
						<h2 className="text-2xl sm:text-4xl font-black text-[#0D0D0D] leading-tight mb-3">
							Simpan, Baca, Unduh, dan Unggah Berkas Tanpa Login.
						</h2>
						<p className="text-sm sm:text-base font-medium text-gray-800 mb-6 leading-relaxed">
							Halaman ini dirancang untuk memudahkan guru, siswa, dan staf bertukar berkas (modul, materi,
							tugas, foto, audio, video, arsip) secara instan. Semua berkas dapat diakses langsung tanpa harus
							masuk ke akun.
						</p>

						{/* Quick Stats Grid */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
							<div className="bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_#0D0D0D]">
								<p className="text-xs font-bold text-gray-600">Total Berkas</p>
								<p className="text-xl sm:text-2xl font-black text-[#E8451A]">{stats.totalFiles || files.length}</p>
							</div>
							<div className="bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_#0D0D0D]">
								<p className="text-xs font-bold text-gray-600">Ukuran Total</p>
								<p className="text-xl sm:text-2xl font-black text-[#2F80ED]">{stats.totalSize || '0 B'}</p>
							</div>
							<div className="bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_#0D0D0D]">
								<p className="text-xs font-bold text-gray-600">Dokumen</p>
								<p className="text-xl sm:text-2xl font-black text-[#00A693]">
									{stats.categoryCounts?.dokumen || 0}
								</p>
							</div>
							<div className="bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_#0D0D0D]">
								<p className="text-xs font-bold text-gray-600">Media & Lainnya</p>
								<p className="text-xl sm:text-2xl font-black text-[#F5C518]">
									{(stats.categoryCounts?.gambar || 0) +
										(stats.categoryCounts?.video || 0) +
										(stats.categoryCounts?.audio || 0) +
										(stats.categoryCounts?.arsip || 0)}
								</p>
							</div>
						</div>
					</div>

					{/* Dekorasi Bentuk Neo */}
					<div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#F5C518] border-3 border-black rounded-full opacity-40 pointer-events-none hidden md:block" />
				</section>

				{/* Section 1: Formulir Unggah Berkas */}
				<section className="bg-white border-3 border-black rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#0D0D0D]">
					<div className="flex items-center justify-between mb-5">
						<h3 className="text-xl sm:text-2xl font-black flex items-center gap-2">
							<span className="p-1.5 bg-[#E8451A] text-white border-2 border-black rounded-lg">
								<UploadCloud className="w-5 h-5" />
							</span>
							<span>Unggah Berkas Baru</span>
						</h3>
						<span className="text-xs font-bold px-2.5 py-1 bg-yellow-200 border-2 border-black rounded-md">
							Mendukung Semua Format
						</span>
					</div>

					<form onSubmit={handleUploadSubmit} className="space-y-5">
						{/* Dropzone Area */}
						<div
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onClick={() => fileInputRef.current?.click()}
							className={`border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
								isDragOver
									? 'border-[#E8451A] bg-orange-100 scale-[0.99]'
									: selectedFiles.length > 0
									? 'border-emerald-600 bg-emerald-50'
									: 'border-black bg-[#FFF5F0] hover:bg-orange-50'
							}`}
						>
							<input
								ref={fileInputRef}
								type="file"
								multiple
								onChange={handleFileSelect}
								className="hidden"
							/>

							<div className="max-w-md mx-auto flex flex-col items-center">
								<div className="w-16 h-16 bg-[#F5C518] border-2 border-black rounded-2xl flex items-center justify-center mb-3 shadow-[4px_4px_0px_#0D0D0D]">
									<UploadCloud className="w-8 h-8 text-black" />
								</div>

								{selectedFiles.length > 0 ? (
									<div className="space-y-1">
										<p className="font-black text-emerald-800 text-base">
											{selectedFiles.length} berkas dipilih:
										</p>
										<div className="max-h-24 overflow-y-auto text-xs font-bold text-gray-700 space-y-0.5">
											{selectedFiles.map((f, i) => (
												<div key={i} className="truncate">
													📎 {f.name} ({(f.size / 1024).toFixed(1)} KB)
												</div>
											))}
										</div>
										<p className="text-xs text-emerald-700 underline pt-2">Klik untuk mengganti pilihan</p>
									</div>
								) : (
									<>
										<p className="font-black text-base sm:text-lg mb-1">
											Seret & Letakkan Berkas di Sini, atau <span className="text-[#E8451A] underline">Jelajahi</span>
										</p>
										<p className="text-xs sm:text-sm font-medium text-gray-600">
											PDF, Word, Excel, Gambar (PNG, JPG), Video (MP4), Audio (MP3), ZIP, Dokumen, dll.
										</p>
									</>
								)}
							</div>
						</div>

						{/* Opsi Tambahan (Judul, Kategori, Deskripsi) */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
							<div>
								<label className="block text-xs font-black uppercase text-gray-700 mb-1">
									Kategori Berkas
								</label>
								<select
									value={uploadCategory}
									onChange={(e) => setUploadCategory(e.target.value)}
									className="w-full bg-[#FFF5F0] border-2 border-black rounded-xl px-3 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#E8451A] shadow-[2px_2px_0px_#0D0D0D]"
								>
									<option value="otomatis">✨ Otomatis Deteksi</option>
									<option value="dokumen">📄 Dokumen (PDF, Word, Excel, PPT)</option>
									<option value="gambar">🖼️ Gambar / Foto</option>
									<option value="video">🎬 Video</option>
									<option value="audio">🎵 Audio</option>
									<option value="arsip">📦 Arsip (ZIP / RAR)</option>
									<option value="kode_teks">💻 Teks / Kode / CSV</option>
									<option value="lainnya">📎 Lainnya</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-black uppercase text-gray-700 mb-1">
									Judul / Label (Opsional)
								</label>
								<input
									type="text"
									placeholder="Contoh: Modul Ajar Matematika Bab 1"
									value={uploadTitle}
									onChange={(e) => setUploadTitle(e.target.value)}
									className="w-full bg-[#FFF5F0] border-2 border-black rounded-xl px-3 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#E8451A] shadow-[2px_2px_0px_#0D0D0D]"
								/>
							</div>

							<div>
								<label className="block text-xs font-black uppercase text-gray-700 mb-1">
									Keterangan Singkat (Opsional)
								</label>
								<input
									type="text"
									placeholder="Catatan kecil untuk pembaca..."
									value={uploadDescription}
									onChange={(e) => setUploadDescription(e.target.value)}
									className="w-full bg-[#FFF5F0] border-2 border-black rounded-xl px-3 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#E8451A] shadow-[2px_2px_0px_#0D0D0D]"
								/>
							</div>
						</div>

						{/* Progress Bar Jika Sedang Upload */}
						{uploading && (
							<div className="space-y-1.5 pt-2">
								<div className="flex justify-between text-xs font-black">
									<span>Mengunggah berkas ke penyimpanan...</span>
									<span>{uploadProgress}%</span>
								</div>
								<div className="w-full h-3 bg-gray-200 border-2 border-black rounded-full overflow-hidden">
									<div
										className="h-full bg-[#E8451A] transition-all duration-300"
										style={{ width: `${uploadProgress}%` }}
									/>
								</div>
							</div>
						)}

						{/* Tombol Submit */}
						<div className="flex justify-end pt-2">
							<button
								type="submit"
								disabled={uploading || selectedFiles.length === 0}
								className={`px-6 py-3 font-black text-sm uppercase rounded-xl border-2 border-black flex items-center gap-2 transition-all ${
									uploading || selectedFiles.length === 0
										? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
										: 'bg-[#E8451A] text-white hover:bg-orange-600 shadow-[4px_4px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer'
								}`}
							>
								<UploadCloud className="w-4 h-4" />
								<span>{uploading ? 'Sedang Mengunggah...' : `Unggah ${selectedFiles.length || ''} Berkas Sekarang`}</span>
							</button>
						</div>
					</form>
				</section>

				{/* Section 2: Kontrol Filter, Pencarian & Tampilan */}
				<section className="space-y-4">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						{/* Input Pencarian */}
						<div className="relative flex-1 max-w-lg">
							<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
							<input
								type="text"
								placeholder="Cari berkas berdasarkan nama atau keterangan..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-10 pr-10 py-2.5 bg-white border-2 border-black rounded-xl font-bold text-sm shadow-[3px_3px_0px_#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#E8451A]"
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-0.5"
								>
									<X className="w-4 h-4" />
								</button>
							)}
						</div>

						{/* Kontrol Sortir & View Mode */}
						<div className="flex items-center gap-3 flex-wrap">
							{/* Dropdown Sortir */}
							<div className="flex items-center gap-1.5 bg-white border-2 border-black rounded-xl px-3 py-1.5 shadow-[3px_3px_0px_#0D0D0D]">
								<ArrowUpDown className="w-4 h-4 text-gray-700" />
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value)}
									className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer"
								>
									<option value="terbaru">Terbaru</option>
									<option value="terlama">Terlama</option>
									<option value="nama_asc">Nama (A-Z)</option>
									<option value="nama_desc">Nama (Z-A)</option>
									<option value="ukuran_desc">Ukuran (Terbesar)</option>
									<option value="ukuran_asc">Ukuran (Terkecil)</option>
								</select>
							</div>

							{/* Toggle Grid vs List */}
							<div className="flex items-center bg-white border-2 border-black rounded-xl p-0.5 shadow-[3px_3px_0px_#0D0D0D]">
								<button
									onClick={() => setViewMode('grid')}
									className={`p-1.5 rounded-lg font-black transition-all ${
										viewMode === 'grid' ? 'bg-[#F5C518] text-black border-2 border-black shadow-[1px_1px_0px_#0D0D0D]' : 'text-gray-600 hover:text-black'
									}`}
									title="Tampilan Grid"
								>
									<LayoutGrid className="w-4 h-4" />
								</button>
								<button
									onClick={() => setViewMode('list')}
									className={`p-1.5 rounded-lg font-black transition-all ${
										viewMode === 'list' ? 'bg-[#F5C518] text-black border-2 border-black shadow-[1px_1px_0px_#0D0D0D]' : 'text-gray-600 hover:text-black'
									}`}
									title="Tampilan List"
								>
									<List className="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>

					{/* Tab Kategori */}
					<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
						{[
							{ id: 'semua', label: 'Semua Berkas' },
							{ id: 'dokumen', label: '📄 Dokumen' },
							{ id: 'gambar', label: '🖼️ Gambar' },
							{ id: 'video', label: '🎬 Video' },
							{ id: 'audio', label: '🎵 Audio' },
							{ id: 'arsip', label: '📦 Arsip' },
							{ id: 'kode_teks', label: '💻 Teks & Kode' },
							{ id: 'lainnya', label: '📎 Lainnya' },
						].map((tab) => {
							const isActive = selectedCategory === tab.id;
							return (
								<button
									key={tab.id}
									onClick={() => setSelectedCategory(tab.id)}
									className={`px-3.5 py-1.5 rounded-xl border-2 border-black font-black text-xs whitespace-nowrap transition-all cursor-pointer ${
										isActive
											? 'bg-black text-white shadow-[3px_3px_0px_#E8451A]'
											: 'bg-white text-black hover:bg-yellow-100 shadow-[2px_2px_0px_#0D0D0D]'
									}`}
								>
									{tab.label}
								</button>
							);
						})}
					</div>
				</section>

				{/* Section 3: Daftar Berkas (Grid atau List) */}
				<section>
					{loading ? (
						<div className="bg-white border-3 border-black rounded-2xl p-12 text-center shadow-[6px_6px_0px_#0D0D0D]">
							<RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#E8451A] mb-3" />
							<p className="font-black text-lg">Memuat daftar berkas...</p>
							<p className="text-xs text-gray-500">Menghubungkan ke penyimpanan Supabase</p>
						</div>
					) : filteredAndSortedFiles.length === 0 ? (
						<div className="bg-white border-3 border-black rounded-2xl p-12 text-center shadow-[6px_6px_0px_#0D0D0D]">
							<div className="w-20 h-20 bg-[#FFE8DC] border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#0D0D0D]">
								<FolderOpen className="w-10 h-10 text-[#E8451A]" />
							</div>
							<h3 className="text-xl font-black mb-1">
								{searchQuery || selectedCategory !== 'semua'
									? 'Tidak ada berkas yang sesuai filter'
									: 'Belum Ada Berkas Tersimpan'}
							</h3>
							<p className="text-sm text-gray-600 max-w-md mx-auto mb-5 font-medium">
								{searchQuery || selectedCategory !== 'semua'
									? 'Coba ganti kata kunci pencarian atau ubah kategori filter di atas.'
									: 'Jadilah yang pertama mengunggah berkas! Seret file ke area formulir di atas untuk memulai.'}
							</p>
							{(searchQuery || selectedCategory !== 'semua') && (
								<button
									onClick={() => {
										setSearchQuery('');
										setSelectedCategory('semua');
									}}
									className="px-4 py-2 bg-[#F5C518] border-2 border-black rounded-xl font-bold text-xs uppercase shadow-[3px_3px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
								>
									Reset Filter
								</button>
							)}
						</div>
					) : viewMode === 'grid' ? (
						/* Tampilan Grid Card */
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
							{filteredAndSortedFiles.map((file) => {
								const ext = file.original_name.split('.').pop()?.toLowerCase() || '';
								const isImage = file.category === 'gambar' || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);

								return (
									<div
										key={file.stored_name}
										className="bg-white border-3 border-black rounded-2xl p-5 shadow-[5px_5px_0px_#0D0D0D] hover:shadow-[7px_7px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
									>
										<div>
											{/* Thumbnail Image Jika Gambar */}
											{isImage && file.url ? (
												<div
													onClick={() => handleOpenPreview(file)}
													className="relative w-full h-36 bg-gray-100 border-2 border-black rounded-xl mb-3.5 overflow-hidden cursor-pointer group-hover:opacity-95"
												>
													<img
														src={file.url}
														alt={file.original_name}
														className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
														loading="lazy"
													/>
													<span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-[10px] font-bold rounded">
														Klik untuk lihat
													</span>
												</div>
											) : (
												<div className="flex items-start justify-between gap-3 mb-3">
													<div className="p-3 bg-[#FFF5F0] border-2 border-black rounded-xl shadow-[2px_2px_0px_#0D0D0D]">
														{getFileIcon(file.original_name, file.category, 'w-7 h-7')}
													</div>
													{getCategoryBadge(file.category)}
												</div>
											)}

											{/* Nama & Deskripsi */}
											<div className="space-y-1 mb-3">
												<h4
													className="font-black text-base leading-snug line-clamp-2 text-black hover:text-[#E8451A] transition-colors cursor-pointer"
													onClick={() => handleOpenPreview(file)}
													title={file.title || file.original_name}
												>
													{file.title || file.original_name}
												</h4>
												<p className="text-xs text-gray-500 font-bold truncate" title={file.original_name}>
													{file.original_name}
												</p>
												{file.description && (
													<p className="text-xs font-medium text-gray-700 line-clamp-2 bg-yellow-50 border border-yellow-300 rounded p-1.5 mt-1.5">
														{file.description}
													</p>
												)}
											</div>
										</div>

										{/* Metadata & Aksi */}
										<div className="pt-3 border-t-2 border-gray-100 space-y-3">
											<div className="flex items-center justify-between text-xs font-bold text-gray-500">
												<span>{file.formatted_size}</span>
												<span title={formatDate(file.uploaded_at)}>{formatRelative(file.uploaded_at)}</span>
											</div>

											{/* Action Buttons */}
											<div className="grid grid-cols-4 gap-1.5">
												{/* Tombol Baca / Pratinjau */}
												<button
													onClick={() => handleOpenPreview(file)}
													title="Baca / Pratinjau Berkas"
													className="col-span-1 py-2 bg-white hover:bg-yellow-200 border-2 border-black rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
												>
													<Eye className="w-4 h-4 text-black" />
												</button>

												{/* Tombol Unduh */}
												<a
													href={`/api/berkas/download?name=${encodeURIComponent(file.stored_name)}&filename=${encodeURIComponent(file.original_name)}`}
													title="Unduh Berkas Langsung"
													className="col-span-1 py-2 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
												>
													<Download className="w-4 h-4" />
												</a>

												{/* Tombol Salin Tautan */}
												<button
													onClick={() => handleCopyLink(file)}
													title="Salin Tautan Langsung"
													className="col-span-1 py-2 bg-[#2F80ED] text-white hover:bg-blue-600 border-2 border-black rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
												>
													{copiedId === file.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
												</button>

												{/* Tombol Hapus */}
												<button
													onClick={() => handleDelete(file)}
													title="Hapus Berkas"
													className="col-span-1 py-2 bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-700 border-2 border-black rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						/* Tampilan List Table */
						<div className="bg-white border-3 border-black rounded-2xl shadow-[6px_6px_0px_#0D0D0D] overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm border-collapse">
									<thead>
										<tr className="bg-[#FFE8DC] border-b-2 border-black text-xs font-black uppercase text-black">
											<th className="p-3.5">Nama Berkas</th>
											<th className="p-3.5">Kategori</th>
											<th className="p-3.5">Ukuran</th>
											<th className="p-3.5">Waktu Unggah</th>
											<th className="p-3.5 text-center">Aksi</th>
										</tr>
									</thead>
									<tbody className="divide-y-2 divide-gray-100">
										{filteredAndSortedFiles.map((file) => (
											<tr key={file.stored_name} className="hover:bg-orange-50/60 transition-colors">
												<td className="p-3.5">
													<div className="flex items-center gap-3">
														<div className="p-2 bg-[#FFF5F0] border-2 border-black rounded-lg">
															{getFileIcon(file.original_name, file.category, 'w-5 h-5')}
														</div>
														<div className="max-w-xs sm:max-w-md">
															<p
																onClick={() => handleOpenPreview(file)}
																className="font-black text-sm text-black hover:text-[#E8451A] cursor-pointer truncate"
																title={file.title || file.original_name}
															>
																{file.title || file.original_name}
															</p>
															<p className="text-xs text-gray-500 font-bold truncate">
																{file.original_name}
															</p>
															{file.description && (
																<p className="text-[11px] text-gray-600 truncate mt-0.5">
																	{file.description}
																</p>
															)}
														</div>
													</div>
												</td>
												<td className="p-3.5">{getCategoryBadge(file.category)}</td>
												<td className="p-3.5 font-bold text-xs text-gray-600">{file.formatted_size}</td>
												<td className="p-3.5 font-bold text-xs text-gray-600" title={formatDate(file.uploaded_at)}>
													{formatRelative(file.uploaded_at)}
												</td>
												<td className="p-3.5">
													<div className="flex items-center justify-center gap-1.5">
														<button
															onClick={() => handleOpenPreview(file)}
															title="Baca / Pratinjau"
															className="p-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg shadow-[1px_1px_0px_#0D0D0D] cursor-pointer"
														>
															<Eye className="w-4 h-4 text-black" />
														</button>
														<a
															href={`/api/berkas/download?name=${encodeURIComponent(file.stored_name)}&filename=${encodeURIComponent(file.original_name)}`}
															title="Unduh"
															className="p-1.5 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-lg shadow-[1px_1px_0px_#0D0D0D]"
														>
															<Download className="w-4 h-4" />
														</a>
														<button
															onClick={() => handleCopyLink(file)}
															title="Salin Link"
															className="p-1.5 bg-[#2F80ED] text-white hover:bg-blue-600 border-2 border-black rounded-lg shadow-[1px_1px_0px_#0D0D0D] cursor-pointer"
														>
															{copiedId === file.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
														</button>
														<button
															onClick={() => handleDelete(file)}
															title="Hapus"
															className="p-1.5 bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-700 border-2 border-black rounded-lg shadow-[1px_1px_0px_#0D0D0D] cursor-pointer"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</section>
			</main>

			{/* ========================================================================= */}
			{/* MODAL PRATINJAU & BACA BERKAS (IMAGE / PDF / AUDIO / VIDEO / TEKS / CODE) */}
			{/* ========================================================================= */}
			{previewFile && (
				<div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
					<div className="bg-white border-3 border-black rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-[8px_8px_0px_#0D0D0D] overflow-hidden">
						{/* Header Modal */}
						<div className="p-4 sm:p-5 bg-[#FFE8DC] border-b-2 border-black flex items-center justify-between gap-3">
							<div className="flex items-center gap-3 overflow-hidden">
								<div className="p-2 bg-white border-2 border-black rounded-lg flex-shrink-0">
									{getFileIcon(previewFile.original_name, previewFile.category, 'w-6 h-6')}
								</div>
								<div className="overflow-hidden">
									<h3 className="font-black text-base sm:text-lg truncate text-black" title={previewFile.title || previewFile.original_name}>
										{previewFile.title || previewFile.original_name}
									</h3>
									<p className="text-xs font-bold text-gray-600 flex items-center gap-2">
										<span>{previewFile.formatted_size}</span>
										<span>•</span>
										<span>{formatDate(previewFile.uploaded_at)}</span>
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2 flex-shrink-0">
								{/* Tombol Unduh dari Modal */}
								<a
									href={`/api/berkas/download?name=${encodeURIComponent(previewFile.stored_name)}&filename=${encodeURIComponent(previewFile.original_name)}`}
									className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-lg font-black text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all text-black"
								>
									<Download className="w-3.5 h-3.5" />
									<span className="hidden sm:inline">Unduh</span>
								</a>

								{/* Tombol Buka Tab Baru */}
								{previewFile.url && (
									<a
										href={previewFile.url}
										target="_blank"
										rel="noreferrer"
										className="p-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none transition-all"
										title="Buka URL asli di tab baru"
									>
										<ExternalLink className="w-4 h-4 text-black" />
									</a>
								)}

								{/* Tombol Tutup Modal */}
								<button
									onClick={() => setPreviewFile(null)}
									className="p-1.5 bg-[#E8451A] hover:bg-red-700 text-white border-2 border-black rounded-lg shadow-[2px_2px_0px_#0D0D0D] hover:shadow-none transition-all cursor-pointer"
								>
									<X className="w-5 h-5" />
								</button>
							</div>
						</div>

						{/* Content Viewer Body */}
						<div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FFF5F0] flex items-center justify-center min-h-[350px]">
							{(() => {
								const ext = previewFile.original_name.split('.').pop()?.toLowerCase() || '';

								// 1. Gambar (Photo Lightbox dengan Zoom & Rotate)
								if (previewFile.category === 'gambar' || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
									return (
										<div className="flex flex-col items-center w-full h-full">
											{/* Image Controls Bar */}
											<div className="mb-3 flex items-center gap-2 bg-white border-2 border-black rounded-xl p-1 shadow-[2px_2px_0px_#0D0D0D]">
												<button
													onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
													className="p-1.5 hover:bg-gray-100 rounded-lg"
													title="Zoom Out"
												>
													<ZoomOut className="w-4 h-4" />
												</button>
												<span className="text-xs font-black px-2">{Math.round(imageZoom * 100)}%</span>
												<button
													onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}
													className="p-1.5 hover:bg-gray-100 rounded-lg"
													title="Zoom In"
												>
													<ZoomIn className="w-4 h-4" />
												</button>
												<button
													onClick={() => setImageRotate((r) => (r + 90) % 360)}
													className="p-1.5 hover:bg-gray-100 rounded-lg border-l-2 border-black ml-1 pl-2"
													title="Putar 90 derajat"
												>
													<RotateCw className="w-4 h-4" />
												</button>
												<button
													onClick={() => {
														setImageZoom(1);
														setImageRotate(0);
													}}
													className="px-2 py-1 text-xs font-bold hover:bg-gray-100 rounded-lg"
												>
													Reset
												</button>
											</div>

											{/* Image Render */}
											<div className="overflow-auto max-h-[60vh] max-w-full flex items-center justify-center p-2">
												<img
													src={previewFile.url}
													alt={previewFile.original_name}
													style={{
														transform: `scale(${imageZoom}) rotate(${imageRotate}deg)`,
														transition: 'transform 0.15s ease',
													}}
													className="max-h-[58vh] max-w-full object-contain border-2 border-black rounded-lg shadow-md"
												/>
											</div>
										</div>
									);
								}

								// 2. PDF Viewer (Embedded Fullscreen Iframe)
								if (ext === 'pdf') {
									return (
										<div className="w-full h-[65vh] flex flex-col bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_#0D0D0D]">
											<iframe
												src={`${previewFile.url}#toolbar=1`}
												title={previewFile.original_name}
												className="w-full h-full border-none"
											/>
										</div>
									);
								}

								// 3. Audio Player
								if (previewFile.category === 'audio' || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
									return (
										<div className="w-full max-w-lg bg-white border-3 border-black rounded-2xl p-6 shadow-[4px_4px_0px_#0D0D0D] text-center space-y-4">
											<div className="w-20 h-20 bg-pink-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_#0D0D0D]">
												<FileAudio className="w-10 h-10 text-pink-600" />
											</div>
											<div>
												<h4 className="font-black text-lg">{previewFile.title || previewFile.original_name}</h4>
												<p className="text-xs text-gray-500 font-bold">{previewFile.original_name}</p>
											</div>
											<audio controls className="w-full mt-2" autoPlay>
												<source src={previewFile.url} type={previewFile.type} />
												Browser Anda tidak mendukung pemutar audio ini.
											</audio>
										</div>
									);
								}

								// 4. Video Player
								if (previewFile.category === 'video' || ['mp4', 'webm', 'mkv', 'mov'].includes(ext)) {
									return (
										<div className="w-full max-w-3xl bg-black border-3 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_#0D0D0D]">
											<video controls className="w-full max-h-[60vh] bg-black" autoPlay>
												<source src={previewFile.url} type={previewFile.type} />
												Browser Anda tidak mendukung pemutar video ini.
											</video>
										</div>
									);
								}

								// 5. Teks / Kode / CSV / Markdown (In-App Reader)
								if (
									previewFile.category === 'kode_teks' ||
									['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'sql', 'xml'].includes(ext)
								) {
									return (
										<div className="w-full h-[65vh] flex flex-col bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_#0D0D0D]">
											<div className="p-2.5 bg-gray-100 border-b-2 border-black flex items-center justify-between text-xs font-black">
												<span>📖 Mode Pembaca Teks ({ext.toUpperCase()})</span>
												<button
													onClick={() => {
														navigator.clipboard.writeText(textContent);
														Swal.fire({
															toast: true,
															position: 'top-end',
															icon: 'success',
															title: 'Isi teks berhasil disalin',
															showConfirmButton: false,
															timer: 1500,
														});
													}}
													className="px-2.5 py-1 bg-white hover:bg-yellow-200 border border-black rounded font-bold"
												>
													Salin Seluruh Teks
												</button>
											</div>
											<div className="flex-1 overflow-auto p-4 bg-gray-50">
												{loadingText ? (
													<div className="flex items-center justify-center h-full">
														<RefreshCw className="w-6 h-6 animate-spin text-[#E8451A]" />
													</div>
												) : (
													<pre className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed select-text">
														{textContent}
													</pre>
												)}
											</div>
										</div>
									);
								}

								// 6. Microsoft Office Documents (DOCX / XLSX / PPTX via Google Docs Viewer)
								if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
									const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
										previewFile.url
									)}&embedded=true`;

									return (
										<div className="w-full h-[65vh] flex flex-col bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_#0D0D0D]">
											<div className="p-2 bg-yellow-100 border-b-2 border-black flex items-center justify-between text-xs font-bold text-gray-700">
												<span>📄 Pratinjau Dokumen Office Online</span>
												<a
													href={`/api/berkas/download?name=${encodeURIComponent(previewFile.stored_name)}&filename=${encodeURIComponent(previewFile.original_name)}`}
													className="text-[#E8451A] underline font-black"
												>
													Unduh File Asli
												</a>
											</div>
											<iframe
												src={googleViewerUrl}
												title={previewFile.original_name}
												className="w-full h-full border-none"
											/>
										</div>
									);
								}

								// 7. Berkas Lainnya / Arsip ZIP (Download Card)
								return (
									<div className="w-full max-w-md bg-white border-3 border-black rounded-2xl p-6 text-center space-y-4 shadow-[4px_4px_0px_#0D0D0D]">
										<div className="w-16 h-16 bg-orange-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_#0D0D0D]">
											{getFileIcon(previewFile.original_name, previewFile.category, 'w-8 h-8')}
										</div>
										<div>
											<h4 className="font-black text-lg">{previewFile.title || previewFile.original_name}</h4>
											<p className="text-xs text-gray-500 font-bold">{previewFile.original_name}</p>
										</div>
										<p className="text-xs text-gray-600">
											Format berkas ini ({ext.toUpperCase()}) tidak mendukung pratinjau langsung di dalam browser.
											Anda dapat langsung mengunduhnya untuk membuka di komputer atau ponsel Anda.
										</p>
										<div className="pt-2">
											<a
												href={`/api/berkas/download?name=${encodeURIComponent(previewFile.stored_name)}&filename=${encodeURIComponent(previewFile.original_name)}`}
												className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-xl font-black text-sm uppercase shadow-[3px_3px_0px_#0D0D0D]"
											>
												<Download className="w-4 h-4" />
												<span>Unduh Berkas Ini Sekarang</span>
											</a>
										</div>
									</div>
								);
							})()}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
