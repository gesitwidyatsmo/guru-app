'use client';

import React from 'react';
import { ChevronLeft, Gamepad2, Users, Lock, Construction, AlertTriangle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

// Neobrutalism SweetAlert Mixin
const brutalCustomClass = {
	popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
	title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
	htmlContainer: 'font-bold text-[#0D0D0D]',
	confirmButton: 'bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3',
};

const brutalSwal = Swal.mixin({
	customClass: brutalCustomClass,
	buttonsStyling: false,
});

export default function GameMenu() {
	const router = useRouter();

	const handleLockedClick = (gameName) => {
		brutalSwal.fire({
			title: 'FITUR DALAM PENGEMBANGAN',
			html: `
				<div class="space-y-4 text-center">
					<div class="text-5xl my-2">🚧 🔒</div>
					<p class="text-base font-bold text-[#0D0D0D]">
						Permainan <span class="bg-[#F5C518] px-2 py-0.5 border-[2px] border-[#0D0D0D] uppercase font-black">${gameName}</span> saat ini sedang dikunci karena masih dalam tahap pengembangan dan penyempurnaan sistem.
					</p>
					<div class="p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D] text-xs font-bold text-gray-700 uppercase tracking-wider">
						Nantikan pembaruan game edukatif interaktif ini pada rilis versi mendatang!
					</div>
				</div>
			`,
			icon: 'info',
			confirmButtonText: 'MENGERTI',
		});
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-4 sm:p-8 md:p-12 flex flex-col items-center font-sans pb-20'>
			
			{/* Top Bar Navigasi */}
			<div className='w-full max-w-5xl flex items-center justify-between mb-8 sm:mb-12'>
				<button
					onClick={() => router.push('/dashboard')}
					className='p-3 sm:p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
					<ChevronLeft className='w-6 h-6 sm:w-8 sm:h-8 text-[#0D0D0D]' strokeWidth={3} />
				</button>
				
				<div className='flex items-center gap-3'>
					<div className='bg-[#A3E635] p-2.5 sm:p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<h1 className='text-xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>ARCADE GAME</h1>
					</div>
					<div className='bg-[#E8451A] text-white px-3 py-2 border-[3px] border-[#0D0D0D] font-black uppercase text-xs sm:text-sm tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] -rotate-2 hidden sm:flex items-center gap-1.5'>
						<Lock className='w-4 h-4' strokeWidth={3} />
						DIKUNCI
					</div>
				</div>
			</div>

			{/* Banner Peringatan: Sedang Dalam Pengembangan */}
			<div className='w-full max-w-5xl mb-10'>
				<div className='bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] relative overflow-hidden p-6 sm:p-8'>
					{/* Strip pita zebra hazard atas */}
					<div className='absolute top-0 left-0 right-0 h-3 bg-[repeating-linear-gradient(45deg,#0D0D0D,#0D0D0D_12px,#F5C518_12px,#F5C518_24px)] border-b-[3px] border-[#0D0D0D]'></div>

					<div className='flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-3'>
						<div className='w-16 h-16 sm:w-20 sm:h-20 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center flex-shrink-0 -rotate-3'>
							<Construction className='w-10 h-10 sm:w-12 sm:h-12 text-[#E8451A]' strokeWidth={3} />
						</div>

						<div className='flex-1 text-center sm:text-left space-y-2'>
							<div className='inline-flex items-center gap-2 bg-[#0D0D0D] text-white px-3 py-1 font-black uppercase text-xs tracking-widest'>
								<AlertTriangle className='w-4 h-4 text-[#F5C518]' />
								STATUS SISTEM: SEDANG DALAM PENGEMBANGAN
							</div>
							<h2 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-tight'>
								FITUR GAME SEMENTARA DIKUNCI
							</h2>
							<p className='text-sm sm:text-base font-bold text-[#0D0D0D] leading-relaxed'>
								Halaman ini sedang dalam proses riset, pengujian stabilitas, dan pengembangan fitur baru agar dapat memberikan pengalaman belajar yang lebih interaktif dan edukatif di kelas. Permainan di bawah untuk saat ini belum dapat dimainkan.
							</p>
						</div>
					</div>

					{/* Strip pita zebra hazard bawah */}
					<div className='absolute bottom-0 left-0 right-0 h-3 bg-[repeating-linear-gradient(45deg,#0D0D0D,#0D0D0D_12px,#F5C518_12px,#F5C518_24px)] border-t-[3px] border-[#0D0D0D]'></div>
				</div>
			</div>

			{/* Daftar Game Terkunci */}
			<div className='w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8'>
				
				{/* Card Arisan (Terkunci) */}
				<div 
					onClick={() => handleLockedClick('Arisan')}
					className='cursor-pointer group relative bg-[#FF90E8] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:shadow-[12px_12px_0px_0px_#0D0D0D] hover:-translate-y-2 transition-all p-8 flex flex-col items-center text-center overflow-hidden'>
					
					{/* Badge Terkunci */}
					<div className='absolute top-4 right-4 bg-[#E8451A] text-white px-3 py-1 border-[3px] border-[#0D0D0D] font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-1.5 rotate-3'>
						<Lock className='w-3.5 h-3.5' strokeWidth={3} />
						DALAM PENGEMBANGAN
					</div>

					{/* Icon Box dengan Gembok */}
					<div className='relative mt-4 mb-6'>
						<div className='bg-white p-5 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] group-hover:rotate-6 transition-transform'>
							<Users className='w-16 h-16 text-[#0D0D0D]' strokeWidth={2.5} />
						</div>
						<div className='absolute -bottom-3 -right-3 bg-[#F5C518] p-2 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] rounded-full'>
							<Lock className='w-5 h-5 text-[#0D0D0D]' strokeWidth={3} />
						</div>
					</div>

					<h2 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest mb-3 bg-white px-4 py-1 border-[3px] border-[#0D0D0D] rotate-1'>
						ARISAN
					</h2>
					<p className='text-base font-bold text-[#0D0D0D] mt-1 bg-white/80 p-2 border-2 border-[#0D0D0D] w-full'>
						Games, Kuis & Tantangan Seru!
					</p>

					{/* Tombol Terkunci */}
					<div className='mt-6 w-full py-3 bg-gray-200 text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black uppercase tracking-wider text-sm shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-center gap-2 group-hover:bg-[#E8451A] group-hover:text-white transition-colors'>
						<Lock className='w-4 h-4' strokeWidth={3} />
						BELUM DAPAT DIMAINKAN
					</div>
				</div>

				{/* Card Hand Hockey (Terkunci) */}
				<div 
					onClick={() => handleLockedClick('Hand Hockey')}
					className='cursor-pointer group relative bg-[#2F80ED] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:shadow-[12px_12px_0px_0px_#0D0D0D] hover:-translate-y-2 transition-all p-8 flex flex-col items-center text-center overflow-hidden h-full'>
					
					{/* Badge Terkunci */}
					<div className='absolute top-4 right-4 bg-[#E8451A] text-white px-3 py-1 border-[3px] border-[#0D0D0D] font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-1.5 -rotate-3'>
						<Lock className='w-3.5 h-3.5' strokeWidth={3} />
						DALAM PENGEMBANGAN
					</div>

					{/* Icon Box dengan Gembok */}
					<div className='relative mt-4 mb-6'>
						<div className='bg-white p-5 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] group-hover:-rotate-6 transition-transform'>
							<Gamepad2 className='w-16 h-16 text-[#0D0D0D]' strokeWidth={2.5} />
						</div>
						<div className='absolute -bottom-3 -right-3 bg-[#F5C518] p-2 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] rounded-full'>
							<Lock className='w-5 h-5 text-[#0D0D0D]' strokeWidth={3} />
						</div>
					</div>

					<h2 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest mb-3 bg-white px-4 py-1 border-[3px] border-[#0D0D0D] -rotate-1'>
						HAND HOCKEY
					</h2>
					<p className='text-base font-bold text-[#0D0D0D] mt-1 bg-white/80 p-2 border-2 border-[#0D0D0D] w-full'>
						Game klasik hoki tangan dengan kamera
					</p>

					{/* Tombol Terkunci */}
					<div className='mt-6 w-full py-3 bg-gray-200 text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black uppercase tracking-wider text-sm shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-center gap-2 group-hover:bg-[#E8451A] group-hover:text-white transition-colors'>
						<Lock className='w-4 h-4' strokeWidth={3} />
						BELUM DAPAT DIMAINKAN
					</div>
				</div>

			</div>

		</div>
	);
}
