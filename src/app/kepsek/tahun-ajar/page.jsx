'use client';

import Loader from '@/app/components/loading';
import { useAcademic } from '@/context/AcademicContext';

export default function KepsekTahunAjarPage() {
	const { daftarTahunAjar, tahunAjarAktif, semesterAktif, loading } = useAcademic();

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-orange-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📅</span> Kalender Akademik Institusi
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Status Tahun Ajaran & Semester
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tinjau periode kalender akademik yang sedang berjalan dan arsip semester sebelumnya.
					</p>
				</div>

				<div className='bg-indigo-50 border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center'>
					<span className='text-indigo-950 font-bold block'>Mode Supervisi Eksekutif</span>
					<span className='text-gray-600 text-[10px] uppercase font-bold'>Akses Baca Terproteksi</span>
				</div>
			</div>

			{/* Active Academic Period Card */}
			<div className='bg-gradient-to-br from-yellow-200 via-yellow-100 to-orange-100 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='space-y-1'>
						<div className='inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-400 text-black border-2 border-black rounded-md text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<span className='w-2 h-2 rounded-full bg-white animate-pulse'></span>
							Periode Berjalan (Aktif)
						</div>
						<h2 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
							TA {tahunAjarAktif || 'Belum Dikonfigurasi'} &bull; Semester {semesterAktif || '-'}
						</h2>
						<p className='text-xs sm:text-sm font-bold text-gray-700'>
							Seluruh pencatatan absensi, pengisian jurnal mengajar guru, dan rekap penilaian merujuk ke periode ini.
						</p>
					</div>

					<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] text-center self-start sm:self-auto'>
						<p className='text-[10px] font-black uppercase text-gray-500'>Total Periode</p>
						<p className='text-xl font-black text-black'>{daftarTahunAjar.length} Semester</p>
					</div>
				</div>
			</div>

			{/* Daftar Riwayat Tahun Ajar */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between'>
					<h3 className='text-base font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>📋</span> Riwayat Periode Akademik Sekolah
					</h3>
					<span className='text-xs font-bold text-gray-500'>
						Arsip & Status Aktif
					</span>
				</div>

				<div className='space-y-3'>
					{daftarTahunAjar.length === 0 ? (
						<div className='p-8 text-center text-gray-500 font-bold bg-yellow-50/50 border-2 border-dashed border-black/20 rounded-xl'>
							Belum ada riwayat tahun ajar terdaftar.
						</div>
					) : (
						daftarTahunAjar.map((ta) => {
							const isAktif = ta.is_aktif;
							return (
								<div
									key={ta.id}
									className={`border-2 border-black rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
										isAktif
											? 'bg-emerald-100 shadow-[4px_4px_0px_0px_#0D0D0D]'
											: 'bg-yellow-50/40 hover:bg-yellow-100/60 shadow-[2px_2px_0px_0px_#0D0D0D]'
									}`}>
									<div className='space-y-1'>
										<div className='flex items-center gap-2'>
											<span className='font-black text-base text-black'>
												TA {ta.nama} &bull; Semester {ta.semester}
											</span>
											{isAktif ? (
												<span className='px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white border-2 border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D]'>
													Sedang Aktif
												</span>
											) : (
												<span className='px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-white border border-black rounded'>
													Arsip Non-Aktif
												</span>
											)}
										</div>
										<p className='text-xs font-medium text-gray-600'>
											{ta.tanggal_mulai
												? `${new Date(ta.tanggal_mulai).toLocaleDateString('id-ID')} s.d. ${
														ta.tanggal_selesai
															? new Date(ta.tanggal_selesai).toLocaleDateString('id-ID')
															: 'Selesai'
												  }`
												: 'Rentang tanggal belum diset'}
										</p>
									</div>

									<div>
										{isAktif ? (
											<div className='inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 bg-white px-3 py-1.5 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
												<span>✅</span>
												<span>Default Operasional</span>
											</div>
										) : (
											<span className='text-xs font-bold text-gray-500 bg-white px-3 py-1 border border-black/30 rounded-lg'>
												Arsip
											</span>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
