import Link from 'next/link';

export default function Leaderboard({ leaderboard }) {
	return (
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8'>
			{/* Top Positif */}
			<div className='neo-card relative overflow-hidden'>
				<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
					<span className='text-2xl'>🌟</span>
					Bintang Kelas
				</h2>
				{leaderboard.topPositif.length > 0 ? (
					<div className='space-y-3'>
						{leaderboard.topPositif.map((siswa, idx) => (
							<div
								key={siswa.id}
								className='flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 border-2 border-black rounded-xl transition-all shadow-sm hover:shadow-md'>
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
									{idx + 1}
								</div>
								<div className='flex-1'>
									<Link
										href={`/siswa/${siswa.id}`}
										className='font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors'>
										{siswa.nama_lengkap}
									</Link>
									<p className='text-xs text-gray-500'>{siswa.kelas}</p>
								</div>
								<div className='bg-emerald-100 border-2 border-black text-emerald-700 px-3 py-1 rounded-full font-bold text-sm'>+{siswa.poinPositif}</div>
							</div>
						))}
					</div>
				) : (
					<p className='text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100'>Belum ada siswa dengan poin positif.</p>
				)}
			</div>

			{/* Top Negatif */}
			<div className='neo-card relative overflow-hidden'>
				<h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2'>
					<span className='text-2xl'>⚠️</span>
					Perhatian Khusus
				</h2>
				{leaderboard.topNegatif.length > 0 ? (
					<div className='space-y-3'>
						{leaderboard.topNegatif.map((siswa, idx) => (
							<div
								key={siswa.id}
								className='flex items-center gap-3 p-3 bg-white hover:bg-rose-50 border-2 border-black rounded-xl transition-all shadow-sm hover:shadow-md'>
								<div className='w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-rose-100 text-rose-700'>{idx + 1}</div>
								<div className='flex-1'>
									<Link
										href={`/siswa/${siswa.id}`}
										className='font-semibold text-gray-800 text-sm hover:text-indigo-600 transition-colors'>
										{siswa.nama_lengkap}
									</Link>
									<p className='text-xs text-gray-500'>{siswa.kelas}</p>
								</div>
								<div className='bg-rose-100 border-2 border-black text-rose-700 px-3 py-1 rounded-full font-bold text-sm'>-{siswa.poinNegatif}</div>
							</div>
						))}
					</div>
				) : (
					<p className='text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100'>Sempurna! Tidak ada siswa dengan pelanggaran.</p>
				)}
			</div>
		</div>
	);
}
