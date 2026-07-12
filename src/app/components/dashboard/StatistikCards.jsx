export default function StatistikCards({ stat }) {
	return (
		<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8'>
			{/* Siswa */}
			<div className='neo-card-blue flex flex-col justify-between'>
				<div className='flex items-center justify-between mb-2'>
					<div className='bg-white/20 border-2 border-transparent rounded-xl p-2 sm:p-3'>
						<svg
							className='w-6 h-6 sm:w-8 sm:h-8'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
							/>
						</svg>
					</div>
				</div>
				<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.siswa}</p>
				<p className='text-xs sm:text-sm text-white/90'>Total Siswa Aktif</p>
			</div>

			{/* Mapel */}
			<div className='neo-card-yellow flex flex-col justify-between'>
				<div className='flex items-center justify-between mb-2'>
					<div className='bg-black/10 border-2 border-transparent rounded-xl p-2 sm:p-3 text-black'>
						<svg
							className='w-6 h-6 sm:w-8 sm:h-8'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
							/>
						</svg>
					</div>
				</div>
				<p className='text-2xl sm:text-4xl font-bold mb-1 text-black'>{stat.mapel}</p>
				<p className='text-xs sm:text-sm text-black/80'>Mata Pelajaran</p>
			</div>

			{/* Kelas */}
			<div className='neo-card-orange flex flex-col justify-between'>
				<div className='flex items-center justify-between mb-2'>
					<div className='bg-white/20 border-2 border-transparent rounded-xl p-2 sm:p-3'>
						<svg
							className='w-6 h-6 sm:w-8 sm:h-8'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
							/>
						</svg>
					</div>
				</div>
				<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.kelas}</p>
				<p className='text-xs sm:text-sm text-white/90'>Total Kelas</p>
			</div>

			{/* Jurnal */}
			<div className='neo-card-teal flex flex-col justify-between'>
				<div className='flex items-center justify-between mb-2'>
					<div className='bg-white/20 border-2 border-transparent rounded-xl p-2 sm:p-3'>
						<svg
							className='w-6 h-6 sm:w-8 sm:h-8'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
							/>
						</svg>
					</div>
				</div>
				<p className='text-2xl sm:text-4xl font-bold mb-1'>{stat.jurnal}</p>
				<p className='text-xs sm:text-sm text-white/90'>Jurnal Terisi</p>
			</div>
		</div>
	);
}
