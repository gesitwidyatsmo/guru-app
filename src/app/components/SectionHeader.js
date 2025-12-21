// src/components/SectionHeader.jsx
'use client';

export default function SectionHeader({ title, leftIcon, onLeftClick, rightIcon, onRightClick }) {
	return (
		<div className='flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow'>
			{/* Kiri: tombol */}
			<button
				onClick={onLeftClick}
				className='p-2 rounded-full text-gray-600 hover:bg-gray-100'
				aria-label={leftIcon ? 'Kembali' : ''}>
				{leftIcon}
			</button>
			{/* Tengah: judul */}
			<div className='flex-1 text-center font-bold text-lg select-none'>{title}</div>
			{/* Kanan: tombol */}
			<button
				onClick={onRightClick}
				className='bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg flex items-center gap-1'
				aria-label={rightIcon ? 'Tambah' : ''}>
				{rightIcon}
			</button>
		</div>
	);
}
