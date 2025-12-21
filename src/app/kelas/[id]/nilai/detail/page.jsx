'use client';

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';

export default function DetailNilaiPage() {
	const router = useRouter();
	const params = useParams();
	const searchParams = useSearchParams();
	const { id } = params;

	const kelas = searchParams.get('kelas') || '';
	const mapel = searchParams.get('mapel') || '';
	const judul = searchParams.get('judul') || '';
	const tanggal = searchParams.get('tanggal') || '';

	const [tugasData, setTugasData] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!kelas || !mapel || !judul || !tanggal) {
			setLoading(false);
			return;
		}

		const fetchDetailTugas = async () => {
			try {
				const params = new URLSearchParams({
					kelas,
					mapel,
					kategori: judul,
					tanggal,
				}).toString();

				const response = await fetch(`/api/tugas?${params}`);
				const data = await response.json();

				if (Array.isArray(data) && data.length > 0) {
					const first = data[0];
					setTugasData({
						judul: first.kategori,
						mapel: first.mapel,
						kelas: first.kelas,
						tanggal: first.tanggal,
						siswa: data.map((item) => ({
							id: item.siswa_id,
							nama_lengkap: item.nama_siswa,
							nilai: item.nilai,
						})),
					});
				} else {
					setTugasData(null);
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
	}, [kelas, mapel, judul, tanggal]);

	// Hapus: perlu strategi lain karena tidak ada tugasId tunggal
	const handleDelete = async () => {
		Swal.fire({
			icon: 'info',
			title: 'Belum Didukung',
			text: 'Hapus per tugas butuh kolom tugas_id di MASTER_NILAI.',
			confirmButtonColor: '#4F46E5',
		});
	};

	const handleEdit = () => {
		Swal.fire({
			icon: 'info',
			title: 'Belum Dibuat',
			text: 'Halaman edit nilai belum diimplementasikan.',
			confirmButtonColor: '#4F46E5',
		});
	};

	return (
		<div className='bg-gray-50 min-h-screen pb-6'>
			<SectionHeader
				title='Detail Nilai'
				leftIcon={
					<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
						<svg
							width='24'
							height='24'
							fill='none'
							stroke='currentColor'
							strokeWidth={2}>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					</div>
				}
				onLeftClick={() => router.back()}
				rightIcon={
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth='1.5'
						stroke='currentColor'
						className='size-6'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
						/>
					</svg>
				}
			/>

			<div className='px-5 mt-6 space-y-4'>
				{/* Section 1: Judul Tugas */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<label className='block text-sm font-medium text-gray-500 mb-2'>Judul Tugas</label>
					<div className='text-lg font-semibold text-gray-800'>{tugasData.judul}</div>
				</div>

				{/* Section 2: Detail Tugas */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4'>
					{/* Kelas */}
					<div>
						<label className='block text-sm font-medium text-gray-500 mb-2'>Kelas</label>
						<div className='text-base font-semibold text-gray-800'>{tugasData.kelas}</div>
					</div>

					{/* Mata Pelajaran */}
					<div>
						<label className='block text-sm font-medium text-gray-500 mb-2'>Mata Pelajaran</label>
						<div className='text-base font-semibold text-gray-800'>{tugasData.mapel}</div>
					</div>

					{/* Tanggal */}
					<div>
						<label className='block text-sm font-medium text-gray-500 mb-2'>Tanggal</label>
						<div className='text-base font-semibold text-gray-800'>
							{new Date(tugasData.tanggal).toLocaleDateString('id-ID', {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</div>
					</div>
				</div>

				{/* Section 3: Daftar Nilai Siswa */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-sm font-medium text-gray-700'>Daftar Nilai ({tugasData.siswa.length} Siswa)</h3>
						<span className='text-xs text-gray-500'>Nilai (0-100)</span>
					</div>

					<div className='space-y-3 max-h-[400px] overflow-y-auto'>
						{tugasData.siswa.map((siswa, index) => (
							<div
								key={siswa.id}
								className='flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg'>
								{/* Nama Siswa */}
								<div className='flex items-center gap-3 flex-1'>
									<span className='text-xs font-medium text-gray-500 w-6'>{index + 1}.</span>
									<div className='flex-1'>
										<div className='text-sm font-semibold text-gray-800'>{siswa.nama_lengkap}</div>
									</div>
								</div>

								{/* Nilai */}
								<div className='w-20'>
									<div className='w-full px-3 py-2 text-center bg-indigo-100 text-indigo-700 rounded-lg font-bold text-base'>{siswa.nilai}</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Tombol Action */}
				<div className='flex gap-3 pt-4'>
					<button
						type='button'
						onClick={handleEdit}
						className='flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'
							className='size-5'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
							/>
						</svg>
						Edit
					</button>
					<button
						type='button'
						onClick={handleDelete}
						className='flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'
							className='size-5'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
							/>
						</svg>
						Hapus
					</button>
				</div>
			</div>
		</div>
	);
}
