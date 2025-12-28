'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Link from 'next/link';
import Loader from '@/app/components/loading';

export default function KelasDetail() {
	const params = useParams();
	const id = params.id;
	const [kelasDetail, setKelasDetail] = useState(null);
	const [jumlahSiswa, setJumlahSiswa] = useState(0);
	const [namaKelas, setNamaKelas] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!id) return;

		const fetchAll = async () => {
			try {
				const res = await fetch('/api/kelas');
				const data = await res.json();

				const kelas = data.find((k) => k.id === id);
				if (kelas) {
					setKelasDetail(kelas);
					setNamaKelas(kelas.kelas);
				}
			} catch (error) {
				console.error('Gagal mengambil data kelas: ', error);
			}
		};

		fetchAll();
	}, [id]);

	useEffect(() => {
		if (!namaKelas) return; // Jangan fetch jika nama kelas belum ketemu

		const fetchStats = async () => {
			try {
				const resSiswa = await fetch('/api/siswa');
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				const siswaDiKelasIni = dataSiswa.filter((siswa) => siswa.status === 'Aktif' && siswa.kelas === namaKelas);
				const siswaListIni = dataSiswa.filter((siswa) => siswa.kelas === namaKelas);

				setJumlahSiswa(siswaDiKelasIni.length);
				setSiswaList(siswaListIni);
			} catch (error) {
				console.error('Gagal mengambil statistik:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [namaKelas]);

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
				<div className='text-center'>
					<Loader />
				</div>
			</div>
		);
	}

	return (
		<div>
			<SectionHeader
				title={kelasDetail ? kelasDetail.kelas : 'Detail Kelas'}
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
					<span className='text-xl'>
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
								d='M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5'
							/>
						</svg>
					</span>
				}
				onLeftClick={() => window.history.back()}
			/>
			<div className='px-5 mt-6'>
				{kelasDetail ? (
					<div className=''>
						<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center space-y-1'>
							{/* <div className='font-bold'>{kelasDetail.kelas}</div> */}
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
									d='M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z'
								/>
							</svg>
							<div className='font-bold'>{jumlahSiswa} SISWA</div>
							<div>Wali Kelas: {kelasDetail.wali_kelas}</div>
						</div>
					</div>
				) : (
					<div>Tidak ditemukan</div>
				)}

				<div className='mt-4'>
					<div className=''>Menu</div>
					<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-1'>
						<Link
							className='flex gap-2'
							href={`/kelas/${id}/absensi`}>
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
									d='M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75'
								/>
							</svg>
							<div>Catat Absensi</div>
						</Link>
						<hr className='border-gray-100' />
						<Link
							className='flex gap-2'
							href={`/kelas/${id}/buat-tugas`}>
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
									d='M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12'
								/>
							</svg>
							<div>Buat Tugas</div>
						</Link>
						<hr className='border-gray-100' />
						<Link href={`/kelas/${id}/jurnal`} className='flex gap-2'>
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
									d='M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
								/>
							</svg>
							<div>Buat Jurnal</div>
						</Link>
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
									d='M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z'
								/>
							</svg>
							<div>Tambah Siswa</div>
						</div>
					</div>
				</div>

				{/* Riwayat */}
				<div className='mt-4'>
					<div className=''>Riwayat</div>
					<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-1'>
						<Link
							className='flex gap-2'
							href={`/riwayat-absensi`}>
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
									d='M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z'
								/>
							</svg>
							<div>Absensi</div>
						</Link>
						<hr className='border-gray-100' />
						<Link
							className='flex gap-2'
							href={`/kelas/${id}/riwayat-nilai`}>
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
							<div>Penilaian</div>
						</Link>
					</div>
				</div>

				{/* Laporan */}
				<div className='mt-4'>
					<div className=''>Laporan</div>
					<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-1'>
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
									d='M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z'
								/>
							</svg>
							<div>Laporan Absensi</div>
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
									d='M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605'
								/>
							</svg>
							<div>Laporan Penilaian</div>
						</div>
					</div>
				</div>

				{/* Siswa */}
				<div className='mt-4'>
					<div className='font-medium text-gray-700 mb-2'>Daftar Siswa ({siswaList.length})</div>

					<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-0 mt-1 divide-y divide-gray-100'>
						{siswaList.length > 0 ? (
							siswaList.map((siswa, index) => (
								<Link
									href={`/siswa/${siswa.id}`}
									key={siswa.id}
									className='flex gap-3 items-center py-3 first:pt-0 last:pb-0 cursor-pointer'>
									{/* Icon Avatar / User */}
									<div className='bg-indigo-50 p-2 rounded-full text-indigo-600'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={1.5}
											stroke='currentColor'
											className='size-5'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z'
											/>
										</svg>
									</div>

									<div className='flex flex-col flex-grow'>
										<span className={`text-sm font-semibold ${siswa.status === 'Aktif' ? 'text-gray-800' : 'text-red-500 line-through'}`}>{siswa.nama_lengkap}</span>
										<span className='text-xs text-gray-500'>NIS: {siswa.nis}</span>
									</div>

									{/* Optional: Icon Panah / Detail */}
									<div className='text-gray-300'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={1.5}
											stroke='currentColor'
											className='size-4'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='m8.25 4.5 7.5 7.5-7.5 7.5'
											/>
										</svg>
									</div>
								</Link>
							))
						) : (
							<div className='text-center py-4 text-gray-400 text-sm'>Belum ada siswa di kelas ini.</div>
						)}
					</div>
				</div>

				{/* action */}
				<div className='my-6'>
					<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center space-y-2 mt-1'>
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
							<div>Edit</div>
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
							<div>Hapus Kelas</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
