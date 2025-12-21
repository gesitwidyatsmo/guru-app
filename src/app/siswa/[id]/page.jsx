'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SectionHeader from '../../components/SectionHeader'; // Pastikan path benar

export default function SiswaPage() {
	const params = useParams();
	const id = params.id; // 1. PERBAIKAN: Ambil ID langsung dari params

	const [siswaData, setSiswaData] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!id) return;

		// 2. PERBAIKAN: Fetch ke '/api/siswa' (list semua), baru di-find
		fetch(`/api/siswa`)
			.then((res) => res.json())
			.then((data) => {
				// 3. PERBAIKAN: Hapus parseInt. Bandingkan string dengan string.
				// Pastikan item.id dan id keduanya string.
				const siswa = data.find((item) => String(item.id) === String(id));

				if (siswa) {
					setSiswaData(siswa);
				} else {
					console.log('Siswa tidak ditemukan dengan ID:', id);
				}
				setLoading(false);
			})
			.catch((err) => {
				console.error(err);
				setLoading(false);
			});
	}, [id]);

	if (loading) return <div>Loading...</div>;
	if (!siswaData) return <div>Data siswa tidak ditemukan.</div>;

	return (
		<div>
			{/* Contoh menampilkan data */}
			<SectionHeader
				title='Detail Siswa'
				leftIcon={
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
				}
				rightIcon={
					<svg
						xmlns='http://www.w3.org/2000/svg'
						viewBox='0 0 24 24'
						fill='currentColor'
						className='size-6'>
						<path
							fillRule='evenodd'
							d='M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z'
							clipRule='evenodd'
						/>
					</svg>
				}
				onLeftClick={() => window.history.back()}
			/>

			<div className='p-5'>
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center space-y-1'>
					<h1 className='text-2xl font-bold'>{siswaData.nama_lengkap}</h1>
					<p>Kelas: {siswaData.kelas}</p>
					<p>NIS: {siswaData.nis}</p>
					<p>Status: {siswaData.status}</p>
				</div>
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-3'>
					<div className='flex gap-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 24 24'
							fill='currentColor'
							className='size-6'>
							<path
								fillRule='evenodd'
								d='M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm1.5 1.5a.75.75 0 0 0-.75.75V16.5a.75.75 0 0 0 1.085.67L12 15.089l4.165 2.083a.75.75 0 0 0 1.085-.671V5.25a.75.75 0 0 0-.75-.75h-9Z'
								clipRule='evenodd'
							/>
						</svg>
						<div>Riwayat Absensi</div>
					</div>
					<hr className='border-gray-100' />
					<div className='flex gap-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 24 24'
							fill='currentColor'
							className='size-6'>
							<path d='M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z' />
						</svg>
						<div>Riwayat Penilaian</div>
					</div>
				</div>
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-3'>
					<div className='flex gap-2'>
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
								d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
							/>
						</svg>
						<div>Edit Siswa</div>
					</div>
					<hr className='border-gray-100' />
					<div className='flex gap-2'>
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
								d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
							/>
						</svg>
						<div>Hapus Siswa</div>
					</div>
				</div>
			</div>
		</div>
	);
}
