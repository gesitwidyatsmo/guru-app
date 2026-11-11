'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function RootError({ error, reset }) {
	const [showDetails, setShowDetails] = useState(false);
	const [copied, setCopied] = useState(false);
	const [isClearing, setIsClearing] = useState(false);

	useEffect(() => {
		// Log error ke browser console untuk proses debugging
		console.error('Unhandled Client-Side Error (Root Error Boundary):', error);
	}, [error]);

	const handleReload = () => {
		if (typeof reset === 'function') {
			try {
				reset();
				return;
			} catch {
				// Fallback jika reset gagal
			}
		}
		window.location.reload();
	};

	const handleClearCacheAndReload = async () => {
		setIsClearing(true);
		try {
			if (typeof window !== 'undefined') {
				// Bersihkan caches browser & service worker cache
				if ('caches' in window) {
					const cacheNames = await caches.keys();
					await Promise.all(cacheNames.map((name) => caches.delete(name)));
				}
				// Bersihkan sesi dan preference lokal
				sessionStorage.clear();
				localStorage.removeItem('guruapp_academic_period');
				localStorage.removeItem('pwa_install_dismissed_at');
			}
		} catch (err) {
			console.warn('Gagal membersihkan cache secara penuh:', err);
		}
		// Muat ulang paksa tanpa cache
		window.location.href = window.location.pathname + '?nocache=' + Date.now();
	};

	const handleCopyReport = () => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return;

		const errorReport = [
			'=== LAPORAN KENDALA APLIKASI ===',
			`Waktu: ${new Date().toLocaleString('id-ID')}`,
			`Halaman: ${typeof window !== 'undefined' ? window.location.href : 'Unknown'}`,
			`Pesan Error: ${error?.message || 'Tidak ada pesan error spesifik'}`,
			`Digest / ID: ${error?.digest || 'N/A'}`,
			`Perangkat: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`,
			'================================',
			error?.stack ? `\nStack Trace:\n${error.stack}` : '',
		].filter(Boolean).join('\n');

		navigator.clipboard.writeText(errorReport).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		}).catch(() => {});
	};

	return (
		<main className='min-h-screen bg-[#FFF5F0] flex items-center justify-center p-4 sm:p-6'>
			<div className='w-full max-w-xl bg-white border-[3px] border-[#0D0D0D] rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] p-6 sm:p-8 overflow-hidden'>
				{/* Header Kartu */}
				<div className='flex items-start gap-4 mb-6'>
					<div className='w-14 h-14 shrink-0 rounded-xl bg-[#FEE2E2] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-[#DC2626]'>
						<AlertTriangle className='w-8 h-8 stroke-[2.5]' />
					</div>
					<div>
						<span className='inline-block px-2.5 py-0.5 mb-1.5 text-xs font-black uppercase tracking-wider bg-[#FEE2E2] text-[#DC2626] border-[2px] border-[#0D0D0D] rounded-md shadow-[2px_2px_0px_0px_#0D0D0D]'>
							Kendala Tampilan
						</span>
						<h1 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-tight'>
							Terjadi Kendala Memuat Halaman
						</h1>
					</div>
				</div>

				{/* Deskripsi Penjelasan Ramah */}
				<p className='text-sm sm:text-base text-gray-700 font-medium mb-6 leading-relaxed'>
					Halaman ini mengalami kendala teknis saat memuat data di perangkat Anda. Hal ini biasanya terjadi akibat koneksi yang terputus, sesi login yang perlu diperbarui, atau data cache sementara di browser.
				</p>

				{/* Tombol Aksi Utama */}
				<div className='flex flex-col sm:flex-row gap-3 mb-6'>
					<button
						type='button'
						onClick={handleReload}
						className='flex-1 inline-flex items-center justify-center gap-2 bg-[#E8451A] hover:bg-[#c93610] text-white font-black uppercase text-sm px-5 py-3 rounded-xl border-[2.5px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer'
					>
						<RotateCcw className='w-4 h-4 stroke-[3]' />
						Coba Muat Ulang
					</button>

					<Link
						href='/'
						className='inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-[#0D0D0D] font-black uppercase text-sm px-5 py-3 rounded-xl border-[2.5px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all'
					>
						<Home className='w-4 h-4 stroke-[2.5]' />
						Beranda
					</Link>
				</div>

				{/* Opsi Bersihkan Cache */}
				<div className='p-4 bg-[#FFE8DC] border-[2px] border-[#0D0D0D] rounded-xl mb-6'>
					<div className='flex items-center justify-between gap-3'>
						<div>
							<div className='text-xs font-black uppercase text-[#0D0D0D]'>Masih tetap terkendala?</div>
							<div className='text-xs text-gray-700 font-medium'>Bersihkan cache situs yang tersimpan di browser ini.</div>
						</div>
						<button
							type='button'
							onClick={handleClearCacheAndReload}
							disabled={isClearing}
							className='shrink-0 inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-[#DC2626] font-bold text-xs px-3 py-2 rounded-lg border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50'
						>
							<Trash2 className='w-3.5 h-3.5' />
							{isClearing ? 'Membersihkan...' : 'Reset Cache'}
						</button>
					</div>
				</div>

				{/* Akordeon Detail Teknis (Untuk Laporan Bug) */}
				<div className='border-t-[2px] border-dashed border-gray-300 pt-4'>
					<button
						type='button'
						onClick={() => setShowDetails((prev) => !prev)}
						className='w-full flex items-center justify-between text-xs font-bold text-gray-500 hover:text-[#0D0D0D] transition-colors cursor-pointer py-1'
					>
						<span>Detail Teknis (Untuk Administrator / Debugging)</span>
						{showDetails ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
					</button>

					{showDetails && (
						<div className='mt-3 p-3 bg-gray-50 border-[2px] border-[#0D0D0D] rounded-lg text-xs font-mono text-gray-800 break-all space-y-2'>
							<div>
								<span className='font-bold text-gray-500'>Pesan: </span>
								<span className='text-red-600 font-semibold'>{error?.message || 'Tidak ada detail pesan.'}</span>
							</div>
							{error?.digest && (
								<div>
									<span className='font-bold text-gray-500'>Error Digest: </span>
									<span>{error.digest}</span>
								</div>
							)}
							<div className='pt-2 flex justify-end'>
								<button
									type='button'
									onClick={handleCopyReport}
									className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-xs font-bold border-[2px] border-[#0D0D0D] rounded-md shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer'
								>
									{copied ? <Check className='w-3.5 h-3.5 text-green-600' /> : <Copy className='w-3.5 h-3.5' />}
									{copied ? 'Tersalin ke Clipboard!' : 'Salin Laporan Error'}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
