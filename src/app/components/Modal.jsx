'use client';

export default function Modal({ open, onClose, title, children, className = '' }) {
	if (!open) return null;

	const handleModalClick = (e) => {
		e.stopPropagation();
	};

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-opacity'
			onClick={onClose}
		>
			<div
				className={`bg-white w-full max-w-md rounded-2xl border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] transform transition-all flex flex-col overflow-hidden ${className}`}
				style={{ maxHeight: '90vh' }}
				onClick={handleModalClick}
			>
				{/* Header */}
				<div className='p-4 border-b-[3px] border-black bg-yellow-300 flex justify-between items-center shrink-0'>
					<h3 className='text-lg font-black text-black uppercase tracking-wider'>{title}</h3>
					<button
						onClick={onClose}
						className='text-black bg-white border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[0px_0px_0px_0px_#0D0D0D] hover:translate-x-[2px] hover:translate-y-[2px] p-1 rounded-md transition-all'>
						<svg
							width='24'
							height='24'
							fill='none'
							stroke='currentColor'
							strokeWidth={3}>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>
				{/* Isi Konten Modal */}
				<div className='p-5 overflow-y-auto grow custom-scrollbar bg-white'>
					{children}
				</div>
			</div>
		</div>
	);
}
