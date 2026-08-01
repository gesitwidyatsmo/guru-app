'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

export default function DetailNilaiPage() {
	const params = useParams();
	const router = useRouter();
	const { id, tugasId: rawTugasId } = params;
	const tugasId = decodeURIComponent(rawTugasId || '');

	const [tugasData, setTugasData] = useState(null);
	const [loading, setLoading] = useState(true);

	// Fetch detail tugas
	useEffect(() => {
		if (!tugasId) return;

		const fetchDetailTugas = async () => {
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) throw new Error('Unauthenticated');

				const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
				const role = userData?.role;
				const userId = userData?.id_user;

				let query = supabase.from('nilai_siswa').select(`
					id,
					tugas_id,
					siswa_id,
					nama_siswa,
					nilai,
					nilai_tugas!inner (
						guru_id,
						kategori,
						type,
						deskripsi,
						kelas,
						mapel,
						tanggal
					)
				`).eq('tugas_id', tugasId);

				if (role === 'Guru' && userId) {
					query = query.eq('nilai_tugas.guru_id', userId);
				}

				const { data: rawData, error } = await query;
				if (error) throw error;

				let tugasDetail = null;
				let submittedSiswa = [];

				if (rawData && rawData.length > 0) {
					tugasDetail = rawData[0].nilai_tugas;
					submittedSiswa = rawData;
				} else {
					// Fallback if no students inserted but task exists
					const { data: tugasHead, error: errHead } = await supabase.from('nilai_tugas').select('*').eq('tugas_id', tugasId).single();
					if (tugasHead) {
						if (role === 'Guru' && tugasHead.guru_id !== userId) throw new Error('Akses Ditolak');
						tugasDetail = tugasHead;
					}
				}

				if (tugasDetail) {
					// Fetch all students for this class
					// Kolom 'absen' ternyata tidak ada di DB, jadi hapus dari select dan gunakan nama untuk sorting
					const { data: daftarSiswa, error: errSiswa } = await supabase
						.from('siswa')
						.select('id, nama_lengkap')
						.eq('kelas', tugasDetail.kelas)
						.order('nama_lengkap', { ascending: true });
					
					if (errSiswa) console.error("Error fetching siswa", errSiswa);
					
					let finalSiswaList = [];

					if (daftarSiswa && daftarSiswa.length > 0) {
						// Gabungkan daftar seluruh siswa dengan nilai yang sudah masuk
						finalSiswaList = daftarSiswa.map((s, index) => {
							const found = submittedSiswa.find(sub => sub.siswa_id === s.id);
							// Nomor absen buatan jika DB tidak ada kolom absen
							const nomorAbsen = String(index + 1); 
							return {
								id: s.id,
								nama_lengkap: s.nama_lengkap,
								absen: nomorAbsen,
								nilai: found && found.nilai !== null ? found.nilai : '-'
							};
						});
					} else {
						// FALLBACK: Jika daftarSiswa gagal diambil, tampilkan setidaknya yang sudah ada di submittedSiswa
						console.warn("Daftar siswa kosong untuk kelas:", tugasDetail.kelas);
						finalSiswaList = submittedSiswa.map((item) => ({
							id: item.siswa_id,
							nama_lengkap: item.nama_siswa,
							absen: '-',
							nilai: item.nilai,
						}));
					}

					setTugasData({
						judul: tugasDetail.kategori,
						type: tugasDetail.type || 'Formatif',
						deskripsi: tugasDetail.deskripsi || '',
						mapel: tugasDetail.mapel,
						kelas: tugasDetail.kelas,
						tanggal: tugasDetail.tanggal,
						siswa: finalSiswaList,
					});
				}
			} catch (error) {
				console.error('Error fetching tugas:', error);
				Swal.fire({
					icon: 'error',
					title: 'Gagal Memuat Data',
					text: error.message,
					confirmButtonColor: '#4F46E5',
				});
			} finally {
				setLoading(false);
			}
		};

		fetchDetailTugas();
	}, [tugasId]);

	// Handle Edit
	const handleEdit = () => {
		router.push(`/kelas/${id}/nilai/${tugasId}/edit`);
	};

	// Handle Delete
	const handleDelete = async () => {
		const result = await Swal.fire({
			title: 'Hapus Tugas?',
			text: 'Data yang dihapus tidak dapat dikembalikan!',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const role = userData?.role;
			const userId = userData?.id_user;

			const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id, kelas, mapel').eq('tugas_id', tugasId).single();
			if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

			if (role === 'Guru' && userId) {
				if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
					throw new Error('Akses Ditolak: Dilarang menghapus riwayat penilaian kepunyaan rekan Guru Anda.');
				}
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', existingTugas.kelas).eq('mapel', existingTugas.mapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Anda tidak berhak menghapus tugas dari kelas eksternal.');
			}

			const { error: deleteError } = await supabase.from('nilai_tugas').delete().eq('tugas_id', tugasId);
			if (deleteError) throw deleteError;

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil Dihapus!',
				text: `Data nilai berhasil dihapus`,
				confirmButtonColor: '#4F46E5',
				timer: 2000,
				timerProgressBar: true,
			});
			router.push(`/kelas/${id}`);
		} catch (error) {
			console.error('Error deleting tugas:', error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menghapus',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		}
	};

	if (loading) {
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
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row justify-between gap-6'>
					<div className='flex-1'>
						<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2 bg-white inline-block px-2 border-[2px] border-[#0D0D0D]'>JUDUL TUGAS</div>
						<div className='flex flex-wrap items-center gap-3 mb-2'>
							<div className='text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase drop-shadow-[1px_1px_0px_#0D0D0D]'>{tugasData.judul}</div>
							<div className='px-3 py-1 bg-[#00A693] text-white text-sm font-black border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2'>{tugasData.type}</div>
						</div>
						{tugasData.deskripsi && (
							<div className='mt-4 p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<div className='text-[10px] font-black uppercase text-gray-500 mb-1'>DESKRIPSI</div>
								<p className='text-sm md:text-base font-medium text-[#0D0D0D]'>{tugasData.deskripsi}</p>
							</div>
						)}
					</div>
					<div className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] self-start text-center min-w-[120px]'>
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
						<h3 className='text-white font-black uppercase tracking-widest'>DAFTAR SISWA</h3>
						<span className='bg-[#F5C518] text-[#0D0D0D] text-[10px] font-black px-2 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>SKALA 0-100</span>
					</div>
					
					{tugasData.siswa.length > 0 ? (
						<div className='divide-y-[3px] divide-[#0D0D0D]'>
							{tugasData.siswa.map((siswa, index) => {
								const nilaiValue = parseFloat(siswa.nilai);
								let badgeBg = 'bg-[#E8E8E8]';
								let badgeText = 'text-[#0D0D0D]';
								if (nilaiValue >= 90) { badgeBg = 'bg-[#00A693]'; badgeText = 'text-white'; }
								else if (nilaiValue >= 80) { badgeBg = 'bg-[#2F80ED]'; badgeText = 'text-white'; }
								else if (nilaiValue >= 70) { badgeBg = 'bg-[#F5C518]'; badgeText = 'text-[#0D0D0D]'; }
								else if (nilaiValue >= 60) { badgeBg = 'bg-[#E8451A]'; badgeText = 'text-white'; }
								else if (nilaiValue < 60 && !isNaN(nilaiValue)) { badgeBg = 'bg-[#0D0D0D]'; badgeText = 'text-white'; }

								return (
									<div key={siswa.id} className='p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F3F4F6] transition-colors'>
										<div className='flex items-center gap-4'>
											<div className='w-10 h-10 bg-white border-[3px] border-[#0D0D0D] flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>{index + 1}</div>
											<div>
												<div className='text-sm font-black text-gray-500 uppercase tracking-widest mb-1'>ID: {siswa.id}</div>
												<div className='font-black text-[#0D0D0D] text-lg uppercase'>{siswa.nama_lengkap}</div>
											</div>
										</div>
										<div className='flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto'>
											<div className='font-black text-xs uppercase tracking-widest text-gray-500'>NILAI:</div>
											<div className={'w-20 h-14 border-[3px] border-[#0D0D0D] flex items-center justify-center text-xl font-black shadow-[4px_4px_0px_0px_#0D0D0D] ' + badgeBg + ' ' + badgeText}>
												{siswa.nilai}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className='p-12 flex flex-col items-center justify-center text-center'>
							<span className='text-5xl mb-4'>📭</span>
							<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-wider mb-2'>TIDAK ADA SISWA</h3>
							<p className='text-gray-500 font-bold'>Belum ada nilai yang diinputkan untuk tugas ini.</p>
						</div>
					)}
				</div>
			</div>
            
            {/* Tombol Aksi Float Bawah */}
			<div className='fixed bottom-0 left-0 right-0 p-4 bg-white border-t-[4px] border-[#0D0D0D] z-50'>
				<div className='max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 justify-end'>
					<button
						onClick={handleDelete}
						className='w-full sm:w-auto px-6 py-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] font-black uppercase shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all flex items-center justify-center gap-2'>
						<svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='3' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'/></svg>
						Hapus Tugas
					</button>
					<button
						onClick={handleEdit}
						className='w-full sm:w-auto px-8 py-3 bg-[#00A693] text-white border-[3px] border-[#0D0D0D] font-black uppercase shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all flex items-center justify-center gap-2'>
						<svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='3' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125'/></svg>
						Edit Tugas
					</button>
				</div>
			</div>
		</div>
	);
}
