'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PwaInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState(null);
	const [isInstallable, setIsInstallable] = useState(false);
	const [isDismissed, setIsDismissed] = useState(false);
	const pathname = usePathname();

	useEffect(() => {
		// Cek apakah user sebelumnya sudah menutup banner ini
		const dismissed = localStorage.getItem('pwa_install_dismissed');
		if (dismissed === 'true') {
			setIsDismissed(true);
		}

		const handleBeforeInstallPrompt = (e) => {
			// Mencegah Chrome memunculkan prompt mini bawaan secara otomatis
			e.preventDefault();
			// Simpan event sehingga bisa dipicu nanti
			setDeferredPrompt(e);
			// Tampilkan UI banner kita
			setIsInstallable(true);
		};

		const handleAppInstalled = () => {
			// Sembunyikan banner jika aplikasi berhasil di-install
			setIsInstallable(false);
			setDeferredPrompt(null);
			console.log('PWA berhasil di-install');
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	}, []);

	// Sembunyikan di halaman login atau admin
	if (pathname === '/login' || pathname?.startsWith('/admin')) {
		return null;
	}

	// Jangan render jika tidak installable atau sudah di-dismiss
	if (!isInstallable || isDismissed) {
		return null;
	}

	const handleInstallClick = async () => {
		if (!deferredPrompt) {
			return;
		}
		// Munculkan prompt instalasi bawaan browser
		deferredPrompt.prompt();
		// Tunggu respon user (terima/tolak)
		const { outcome } = await deferredPrompt.userChoice;
		console.log(`Hasil instalasi: ${outcome}`);
		// Bersihkan event karena hanya bisa dipakai sekali
		setDeferredPrompt(null);
		setIsInstallable(false);
	};

	const handleDismiss = () => {
		setIsDismissed(true);
		localStorage.setItem('pwa_install_dismissed', 'true');
	};

	return (
		<div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-[110]">
			<div className="neo-card-yellow p-4 flex flex-col gap-3 relative animate-[swal2-show_0.3s_ease]">
				<button 
					onClick={handleDismiss}
					className="absolute -top-3 -right-3 bg-neo-white text-neo-black border-2 border-neo-black rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_#0D0D0D] hover:transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#0D0D0D] transition-all"
					aria-label="Tutup Banner Instalasi"
				>
					✕
				</button>
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 bg-neo-white border-2 border-neo-black rounded-lg flex items-center justify-center overflow-hidden shrink-0">
						<img 
							src="/android/launchericon-192x192.png" 
							alt="App Icon" 
							className="w-full h-full object-cover" 
							onError={(e) => { e.target.style.display='none'; }}
						/>
						{/* Fallback jika gambar gagal dimuat */}
						<svg className="w-6 h-6 absolute -z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
						</svg>
					</div>
					<div>
						<h3 className="font-bold text-lg leading-tight">Install Aplikasi</h3>
						<p className="text-sm font-medium mt-1">Akses lebih cepat & penuhi layar HP seperti aplikasi asli.</p>
					</div>
				</div>
				<button 
					onClick={handleInstallClick}
					className="neo-btn-primary w-full py-2 mt-1 flex justify-center items-center gap-2"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
					Install Sekarang
				</button>
			</div>
		</div>
	);
}
