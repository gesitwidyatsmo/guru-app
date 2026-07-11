'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function KbmBlocker() {
	const pathname = usePathname();
	const router = useRouter();
	const [isBlocked, setIsBlocked] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;

		const checkAccess = async () => {
			setLoading(true);
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) {
					if (isMounted) {
						setIsBlocked(false);
						setLoading(false);
					}
					return;
				}

				const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
				if (!profile) {
					if (isMounted) {
						setIsBlocked(false);
						setLoading(false);
					}
					return;
				}

				const role = profile.role || '';
				// Hanya blokir untuk Guru (atau Wali Kelas jika nanti disamakan)
				if (role !== 'Guru' && role !== 'Wali Kelas') {
					if (isMounted) {
						setIsBlocked(false);
						setLoading(false);
					}
					return;
				}

				// Fetch KBM
				const res = await fetch('/api/kbm/mandiri');
				if (res.ok) {
					const data = await res.json();
					if (data && data.length === 0) {
						if (isMounted) setIsBlocked(true);
					} else {
						if (isMounted) setIsBlocked(false);
					}
				} else {
					if (isMounted) setIsBlocked(false);
				}
			} catch (err) {
				console.error('Error KBM Blocker:', err);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		checkAccess();

		return () => {
			isMounted = false;
		};
	}, [pathname]); // Check ulang tiap ganti halaman

	// Jika tidak diblokir atau masih loading profile, jangan tampilkan apa-apa
	if (loading || !isBlocked) return null;

	// Tentukan halaman mana saja yang bebas diakses meskipun belum punya KBM
	const allowedPaths = ['/kelas', '/mapel', '/profil', '/pengaturan', '/login'];
	const isAllowed = allowedPaths.some(path => pathname.startsWith(path));

	if (isAllowed) return null;

	// Tampilan Pemblokir
	return (
		<div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
			<div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-8 border border-gray-100 transform transition-all animate-scale-in">
				<div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<h2 className="text-2xl font-extrabold text-gray-800 mb-2">Penugasan Belum Diatur</h2>
				<p className="text-gray-500 mb-8 leading-relaxed">
					Anda belum memiliki jadwal penugasan mengajar di kelas manapun. Anda wajib mengatur penugasan mata pelajaran dan kelas Anda terlebih dahulu untuk dapat mengakses menu lainnya (Absensi, Penilaian, dll).
				</p>
				<button
					onClick={() => router.push('/kelas?bukaPenugasan=true')}
					className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-3"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Atur Penugasan Sekarang
				</button>
			</div>
		</div>
	);
}
