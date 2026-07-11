import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export const useLogout = () => {
	const router = useRouter();

	const handleLogout = async () => {
		const result = await Swal.fire({
			title: 'Keluar Akun?',
			text: 'Sesi Anda akan diakhiri.',
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#ef4444',
			cancelButtonColor: '#94a3b8',
			confirmButtonText: 'Ya, Keluar!',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch('/api/logout', { method: 'POST' });
				if (res.ok) {
					localStorage.clear();
					sessionStorage.clear();
					router.push('/login');
				} else {
					Swal.fire('Gagal', 'Terjadi kesalahan saat logout', 'error');
				}
			} catch (error) {
				Swal.fire('Error', 'Sistem sedang sibuk.', 'error');
			}
		}
	};

	return { handleLogout };
};
