import Link from 'next/link';

export default function JadwalWidget({ jadwalHariIni, hariIni }) {
	return (
		<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
			<div className='flex items-center justify-between mb-6'>
				<h2 className='text-md sm:text-2xl font-bold text-gray-800 flex items-center gap-2'>
					<span className='text-2xl '>📅</span>
					Jadwal Hari Ini
					<span className='text-base hidden lg:block font-normal text-gray-500'>({hariIni})</span>
				</h2>
				<Link
					href='/jadwal'
					className='text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1'>
					Lihat Semua
					<svg
						className='w-4 h-4'
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
				</Link>
			</div>
			{jadwalHariIni.length > 0 ? (
				<div className='space-y-4'>
					{jadwalHariIni.map((jadwal) => (
						<div
							key={jadwal.id}
							className='flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all bg-gray-50/50 group'>
							<div className='flex items-center gap-3 sm:w-48 flex-shrink-0'>
								<div className='w-2 h-10 rounded-full bg-indigo-500'></div>
								<div>
									<p className='font-bold text-gray-800'>
										{jadwal.jam_mulai.slice(0, 5)} - {jadwal.jam_selesai.slice(0, 5)}
									</p>
									<p className='text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-1'>Mulai</p>
								</div>
							</div>
							<div className='flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
								<div>
									<h3 className='font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors'>{jadwal.mapel}</h3>
									<p className='text-gray-500 text-sm mt-0.5 flex items-center gap-1'>
										<svg
											className='w-4 h-4'
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
										Kelas {jadwal.kelas}
									</p>
								</div>
								<Link
									href={`/jurnal?action=new&mapel=${encodeURIComponent(jadwal.mapel || '')}&kelas=${encodeURIComponent(jadwal.kelas || '')}&jam_ke=${encodeURIComponent(jadwal.jam_ke || '')}`}
									className='px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors text-sm font-semibold text-center'>
									Isi Jurnal
								</Link>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className='text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200'>
					<div className='text-4xl mb-3'>☕</div>
					<p className='text-gray-500 font-medium'>Tidak ada jadwal mengajar hari ini</p>
					<p className='text-sm text-gray-400 mt-1'>Selamat beristirahat atau mengerjakan tugas lainnya!</p>
				</div>
			)}
		</div>
	);
}
