'use client';

export default function Modal({ open, onClose, title, children, className = '' }) {
	if (!open) return null;

	const handleModalClick = (e) => {
		e.stopPropagation();
	};

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity'
			onClick={onClose}
		>
			<div
				className={`bg-white w-full max-w-md rounded-2xl shadow-2xl transform transition-all flex flex-col ${className}`}
				style={{ maxHeight: '90vh' }}
				onClick={handleModalClick}
			>
				{/* Header */}
				<div className='p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center rounded-t-2xl shrink-0'>
					<h3 className='text-lg font-bold text-gray-800'>{title}</h3>
					<button
						onClick={onClose}
						className='text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-lg transition-colors'>
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
				<div className='p-5 overflow-y-auto grow custom-scrollbar'>
					{children}
				</div>
			</div>
		</div>
	);
}
