'use client';

import { useIdleTimer } from 'react-idle-timer';
import { usePathname, useRouter } from 'next/navigation';

export default function IdleTimerWrapper({ children }) {
	const pathname = usePathname();
	const router = useRouter();

	const handleOnIdle = async () => {
		// Jangan lakukan auto-logout jika pengguna sudah berada di halaman login
		if (pathname === '/login') return;

		try {
			console.log('Sesi kedaluwarsa karena tidak ada aktivitas (Idle timeout).');

			// Bersihkan penyimpanan lokal
			localStorage.clear();
			sessionStorage.clear();

			// Panggil API logout untuk menghapus cookie sesi di server
			await fetch('/api/logout', { method: 'POST' });

			// Redirect secara paksa ke halaman login
			router.push('/login');
		} catch (error) {
			console.error('Error saat mencoba auto-logout:', error);
			// Tetap paksa ke halaman login meskipun fetch gagal (misal karena jaringan)
			router.push('/login');
		}
	};

	useIdleTimer({
		timeout: 1000 * 60 * 30, // 30 Menit dalam satuan milidetik
		onIdle: handleOnIdle,
		debounce: 500, // Menghindari pemanggilan fungsi yang terlalu sering
	});

	return <>{children}</>;
}
