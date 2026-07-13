// src/components/SectionHeader.jsx
'use client';

export default function SectionHeader({ title, leftIcon, onLeftClick, rightIcon, onRightClick }) {
	return (
		<div className='flex items-center justify-between bg-white border-[4px] border-black p-3 md:p-4 rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] mb-8 relative'>
			{/* Kiri: tombol (Kotak Tajam) */}
			{leftIcon ? (
				<button
					onClick={onLeftClick}
					className='flex items-center justify-center w-12 h-12 rounded-none border-[3px] border-black bg-black text-white hover:bg-[#E8451A] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all disabled:opacity-50 shrink-0'
					aria-label='Kembali'>
					{leftIcon}
				</button>
			) : (
				<div className='w-12 shrink-0'></div>
			)}
			
			{/* Tengah: judul (Sticker Miring) */}
			<div className='flex-1 flex justify-center min-w-0 px-2'>
				<div className='bg-[#F5C518] border-[3px] border-black text-black px-3 py-1.5 md:px-6 md:py-2 transform -skew-x-6 shadow-[4px_4px_0px_0px_#0D0D0D] max-w-full'>
					<h1 className='font-black text-sm sm:text-base md:text-2xl uppercase tracking-widest md:tracking-[0.2em] transform skew-x-6 select-none truncate'>
						{title}
					</h1>
				</div>
			</div>
			
			{/* Kanan: tombol (Kotak Solid) */}
			{rightIcon ? (
				<button
					onClick={onRightClick}
					className='flex items-center justify-center px-4 py-2 md:px-5 md:py-3 min-w-12 min-h-12 rounded-none border-[3px] border-black bg-[#00A693] text-white font-black gap-2 hover:bg-[#2F80ED] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all shrink-0'
					aria-label='Aksi Kanan'>
					{rightIcon}
				</button>
			) : (
				<div className='w-12 shrink-0'></div>
			)}
		</div>
	);
}
