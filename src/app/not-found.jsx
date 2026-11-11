import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
	return (
		<main className='min-h-screen bg-[#FFF5F0] flex items-center justify-center p-4 sm:p-6'>
			<div className='w-full max-w-lg bg-white border-[3px] border-[#0D0D0D] rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] p-6 sm:p-8 text-center'>
				<div className='inline-block bg-[#F5C518] text-[#0D0D0D] font-black text-5xl sm:text-6xl px-6 py-2 border-[3px] border-[#0D0D0D] rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] mb-6'>
					404
				</div>

				<h1 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-tight mb-3'>
					Halaman Tidak Ditemukan
				</h1>

				<p className='text-sm sm:text-base text-gray-700 font-medium mb-8 leading-relaxed max-w-md mx-auto'>
					Halaman yang Anda tuju tidak ditemukan atau tautan yang Anda buka telah kedaluwarsa.
				</p>

				<div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
					<Link
						href='/'
						className='w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#E8451A] hover:bg-[#c93610] text-white font-black uppercase text-sm px-6 py-3 rounded-xl border-[2.5px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all'
					>
						<Home className='w-4 h-4 stroke-[2.5]' />
						Kembali ke Beranda
					</Link>
				</div>
			</div>
		</main>
	);
}
