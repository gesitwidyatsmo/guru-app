'use client';

export default function Modal({ open, onClose, title, children }) {
	if (!open) return null;

	// Handler agar klik dalam konten modal tidak menutup modal
	const handleModalClick = (e) => {
		e.stopPropagation();
	};

	return (
		<div
			className='fixed inset-0 z-40 flex items-center justify-center bg-black/40 transition-colors duration-200'
			onClick={onClose} // klik overlay (di luar modal) akan menutup modal
		>
			<div
				className='bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4'
				onClick={handleModalClick} // klik isi modal tidak menutup modal
			>
				{/* Header */}
				<div className='flex items-center justify-between px-4 py-3 border-b'>
					<span className='text-2xl font-bold text-gray-200'>{title}</span>
					<button
						onClick={onClose}
						className='text-gray-400 hover:scale-110 transition-transform'>
						<svg
							width='24'
							height='24'
							fill='none'
							stroke='currentColor'
							strokeWidth={2}>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>
				{/* Isi Konten Modal */}
				<div className='px-4 py-4'>{children}</div>
			</div>
		</div>
	);
}
