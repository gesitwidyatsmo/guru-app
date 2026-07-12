import Link from 'next/link';

export default function QuickActions({ quickActions }) {
	return (
		<div className='mb-8'>
			<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
				<span className='text-2xl'>⚡</span>
				Aksi Cepat
			</h2>
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				{quickActions.map((action, idx) => (
					<Link
						key={idx}
						href={action.route}
						className={`${action.color} cursor-pointer group`}>
						<div className='flex items-center gap-4'>
							<div className='bg-black/10 border-2 border-transparent rounded-xl p-3 text-current transition-all'>{action.icon}</div>
							<div className='flex-1'>
								<h3 className='text-xl font-bold mb-1'>{action.label}</h3>
								<p className='text-sm opacity-90'>{action.description}</p>
							</div>
							<svg
								className='w-6 h-6 transform group-hover:translate-x-1 transition-transform'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M9 5l7 7-7 7'
								/>
							</svg>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
