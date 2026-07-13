import Link from 'next/link';

export default function JadwalWidget({ jadwalHariIni, hariIni }) {
	return (
		<div className='bg-[#FFF5F0] border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl p-6 mb-8'>
			<div className='flex items-center justify-between mb-6 border-b-[3px] border-black pb-4'>
				<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-3 uppercase tracking-wider'>
					<span className='bg-yellow-300 border-2 border-black p-2 rounded-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>📅</span>
					Jadwal Hari Ini
					<span className='text-base hidden lg:block font-bold text-black border-2 border-black bg-white px-2 py-1 shadow-[2px_2px_0px_0px_#0D0D0D]'>({hariIni})</span>
				</h2>
				<Link
					href='/jadwal'
					className='bg-black text-white border-2 border-black font-bold px-4 py-2 rounded-lg shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center gap-2 hover:bg-yellow-400 hover:text-black hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all'>
					Lihat Semua
					<svg
						className='w-5 h-5'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={3}
							d='M9 5l7 7-7 7'
						/>
					</svg>
				</Link>
			</div>
			{jadwalHariIni.length > 0 ? (
				<div className='space-y-5'>
					{jadwalHariIni.map((jadwal) => (
						<div
							key={jadwal.id}
							className='flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border-[3px] border-black bg-white hover:bg-yellow-50 transition-all shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1'>
							<div className='flex items-center gap-4 sm:w-56 flex-shrink-0 border-r-[3px] border-black pr-4'>
								<div className='w-4 h-12 rounded bg-teal-400 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'></div>
								<div>
									<p className='font-black text-xl text-black'>
										{jadwal.jam_mulai.slice(0, 5)} - {jadwal.jam_selesai.slice(0, 5)}
									</p>
									<p className='text-xs font-black text-black uppercase border-2 border-black bg-yellow-400 px-2 py-0.5 rounded shadow-[2px_2px_0px_0px_#0D0D0D] inline-block mt-1'>Mulai</p>
								</div>
							</div>
							<div className='flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-0 sm:pl-2'>
								<div>
									<h3 className='font-black text-black text-2xl uppercase tracking-wider decoration-4 decoration-yellow-400 underline-offset-4 hover:underline transition-colors'>{jadwal.mapel}</h3>
									<p className='text-black font-bold text-sm mt-2 flex items-center gap-2 border-2 border-black bg-[#FFF5F0] px-3 py-1 rounded shadow-[2px_2px_0px_0px_#0D0D0D] w-max'>
										<svg
											className='w-5 h-5'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2.5}
												d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
											/>
										</svg>
										KELAS {jadwal.kelas}
									</p>
								</div>
								<Link
									href={`/jurnal?action=new&mapel=${encodeURIComponent(jadwal.mapel || '')}&kelas=${encodeURIComponent(jadwal.kelas || '')}&jam_ke=${encodeURIComponent(jadwal.jam_ke || '')}`}
									className='bg-blue-500 text-white font-black uppercase tracking-wider border-[3px] border-black shadow-[4px_4px_0px_0px_#0D0D0D] px-6 py-3 rounded-lg hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all text-center'>
									Isi Jurnal
								</Link>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className='text-center py-12 bg-white rounded-2xl border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<div className='text-6xl mb-6 transform -rotate-12 inline-block drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]'>☕</div>
					<p className='text-black font-black uppercase text-xl'>Tidak ada jadwal mengajar hari ini</p>
					<p className='text-base font-bold text-black border-2 border-black bg-yellow-300 inline-block px-4 py-1 rounded-full shadow-[2px_2px_0px_0px_#0D0D0D] mt-4 transform rotate-2'>
						Selamat beristirahat atau mengerjakan tugas lainnya!
					</p>
				</div>
			)}
		</div>
	);
}
