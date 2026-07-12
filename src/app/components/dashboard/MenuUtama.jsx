import Link from 'next/link';

export default function MenuUtama({ filteredMenuItems }) {
	const bgMap = {
		'neo-card-orange': 'bg-[#E8451A]',
		'neo-card-yellow': 'bg-[#F5C518]',
		'neo-card-teal': 'bg-[#00A693]',
		'neo-card-blue': 'bg-[#2F80ED]',
		'neo-card-peach': 'bg-[#FFE8DC]',
	};



	return (
		<div className='mb-8'>
			<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
				<span className='text-2xl'>📚</span>
				Menu Utama
			</h2>
			<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6'>
				{filteredMenuItems.map((item, idx) => (
					<Link
						key={idx}
						href={item.route}
						className={`${item.color} cursor-pointer group flex flex-col items-center justify-center text-center gap-3`}>
						
						<div className='bg-black/10 border-2 border-transparent group-hover:border-black rounded-xl p-3 sm:p-4 text-current transition-all group-hover:scale-110 group-hover:-rotate-3'>
							<div className="[&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-8 sm:[&>svg]:h-8">{item.icon}</div>
						</div>

						<p className='font-bold text-sm sm:text-base text-current'>
							{item.label}
						</p>
					</Link>
				))}
			</div>
		</div>
	);
}
