import Link from 'next/link';

export default function MenuUtama({ filteredMenuItems }) {
	return (
		<div className='mb-8'>
			<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
				<span className='text-2xl'>📚</span>
				Menu Utama
			</h2>
			<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4'>
				{filteredMenuItems.map((item, idx) => (
					<Link
						key={idx}
						href={item.route}
						className={`${item.color} rounded-2xl shadow-lg p-4 sm:p-6 text-white text-center cursor-pointer transform hover:scale-105 transition-all duration-300 hover:shadow-xl group`}>
						<div className='flex flex-col items-center gap-2 sm:gap-3'>
							<div className='bg-white/20 backdrop-blur-sm rounded-xl p-2 sm:p-3 group-hover:bg-white/30 transition-all'>{item.icon}</div>
							<p className='font-semibold text-sm sm:text-base'>{item.label}</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
