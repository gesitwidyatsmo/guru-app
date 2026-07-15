const fs = require('fs');
const file = 'src/app/kelas/[id]/nilai/[tugasId]/page.jsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('\tif (loading) {');
if (startIdx === -1) {
	console.error('Batas penggantian tidak ditemukan!');
	process.exit(1);
}

const newReturn = `	if (loading) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] flex flex-col font-sans'>
				<div className='bg-[#00A693] border-b-[4px] border-[#0D0D0D] p-6 flex items-center gap-4'>
					<button onClick={() => router.back()} className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
					</button>
					<h1 className='text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>DETAIL NILAI</h1>
				</div>
				<div className='flex items-center justify-center flex-1'>
					<div className='bg-white border-[4px] border-[#0D0D0D] p-6 shadow-[8px_8px_0px_0px_#0D0D0D] font-black uppercase text-lg animate-pulse'>MEMUAT DATA...</div>
				</div>
			</div>
		);
	}

	if (!tugasData) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] flex flex-col font-sans'>
				<div className='bg-[#E8451A] border-b-[4px] border-[#0D0D0D] p-6 flex items-center gap-4'>
					<button onClick={() => router.back()} className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
					</button>
					<h1 className='text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>ERROR</h1>
				</div>
				<div className='flex items-center justify-center flex-1'>
					<div className='bg-[#F5C518] border-[4px] border-[#0D0D0D] p-8 shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col items-center -rotate-3 hover:rotate-0 transition-transform'>
						<span className='text-6xl mb-4 drop-shadow-[2px_2px_0px_#0D0D0D]'>⚠️</span>
						<h2 className='text-2xl font-black uppercase text-[#0D0D0D]'>DATA TIDAK DITEMUKAN</h2>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			{/* Header Brutalist */}
			<div className='bg-[#00A693] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
				<div className='absolute top-4 right-10 w-24 h-24 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] hidden md:block'></div>
				<div className='absolute bottom-8 left-1/4 w-12 h-12 bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rotate-45 hidden md:block'></div>

				<div className='max-w-4xl mx-auto relative z-10'>
					<div className='flex items-center gap-4 mb-4'>
						<button
							onClick={() => router.back()}
							className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<svg className='w-8 h-8' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
						</button>
						<div>
							<h1 className='text-3xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D]'>
								DETAIL NILAI
							</h1>
						</div>
					</div>
				</div>
			</div>

			<div className='max-w-4xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 space-y-8'>
				{/* Section 1: Judul Tugas */}
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div>
						<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-1 bg-white inline-block px-2 border-[2px] border-[#0D0D0D]'>JUDUL TUGAS</div>
						<div className='text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase drop-shadow-[1px_1px_0px_#0D0D0D]'>{tugasData.judul}</div>
					</div>
					<div className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] self-start md:self-auto text-center'>
						<div className='text-[10px] font-black uppercase text-gray-500'>TOTAL SISWA</div>
						<div className='text-2xl font-black text-[#0D0D0D]'>{tugasData.siswa.length}</div>
					</div>
				</div>

				{/* Section 2: Detail Tugas */}
				<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						<div>
							<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>KELAS</div>
							<div className='w-full px-4 py-3 bg-[#A3E635] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D]'>
								{tugasData.kelas}
							</div>
						</div>
						<div>
							<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>MATA PELAJARAN</div>
							<div className='w-full px-4 py-3 bg-[#FF90E8] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D] truncate' title={tugasData.mapel}>
								{tugasData.mapel}
							</div>
						</div>
						<div>
							<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>TANGGAL</div>
							<div className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-sm uppercase shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center'>
								{new Date(tugasData.tanggal).toLocaleDateString('id-ID', {
									weekday: 'short',
									year: 'numeric',
									month: 'short',
									day: 'numeric',
								})}
							</div>
						</div>
					</div>
				</div>

				{/* Section 3: Daftar Nilai Siswa */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='bg-[#0D0D0D] px-6 py-4 flex items-center justify-between'>
						<h3 className='text-white font-black uppercase tracking-widest'>DAFTAR NILAI</h3>
						<span className='bg-white text-[#0D0D0D] text-[10px] font-black px-2 py-1 border-[2px] border-[#0D0D0D]'>SKALA 0-100</span>
					</div>

					<div className='max-h-[500px] overflow-y-auto bg-[#FFF5F0]'>
						{tugasData.siswa.length > 0 ? (
							tugasData.siswa.map((siswa, index) => (
								<div
									key={siswa.id}
									className='flex items-center justify-between gap-4 p-4 bg-white border-b-[3px] border-[#0D0D0D] hover:bg-[#F5C518] transition-colors group'>
									
									<div className='flex items-center gap-4 flex-1'>
										<div className='w-8 h-8 flex items-center justify-center bg-[#0D0D0D] text-white font-black text-sm rounded-full shadow-[2px_2px_0px_0px_#0D0D0D]'>
											{index + 1}
										</div>
										<div className='text-base font-black text-[#0D0D0D] uppercase'>{siswa.nama_lengkap}</div>
									</div>

									<div className='w-24'>
										<div className='w-full px-2 py-2 text-center bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-[#0D0D0D] font-black text-xl group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-transform'>
											{siswa.nilai}
										</div>
									</div>
								</div>
							))
						) : (
							<div className='p-8 text-center bg-white border-b-[3px] border-[#0D0D0D]'>
								<div className='text-4xl mb-2'>📭</div>
								<div className='text-[#0D0D0D] font-black uppercase'>BELUM ADA SISWA</div>
							</div>
						)}
					</div>
				</div>

				{/* Tombol Action */}
				<div className='flex flex-col sm:flex-row gap-4 pt-4'>
					<button
						type='button'
						onClick={handleEdit}
						className='flex-1 px-6 py-4 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all font-black uppercase tracking-widest flex items-center justify-center gap-3'>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='4' stroke='currentColor' className='w-6 h-6'><path strokeLinecap='round' strokeLinejoin='round' d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10' /></svg>
						EDIT TUGAS
					</button>
					<button
						type='button'
						onClick={handleDelete}
						className='flex-1 px-6 py-4 bg-[#E8451A] text-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all font-black uppercase tracking-widest flex items-center justify-center gap-3'>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='4' stroke='currentColor' className='w-6 h-6'><path strokeLinecap='round' strokeLinejoin='round' d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0' /></svg>
						HAPUS TUGAS
					</button>
				</div>
			</div>
		</div>
	);
}
`

content = content.substring(0, startIdx) + newReturn;
fs.writeFileSync(file, content);
console.log('Successfully updated detail nilai page!');
