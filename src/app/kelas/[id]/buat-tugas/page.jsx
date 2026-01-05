'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';
import Loader from '@/app/components/loading';

export default function BuatTugasPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;

	const [namaKelas, setNamaKelas] = useState('');
	const [judul, setJudul] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [tanggal, setTanggal] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [nilaiSiswa, setNilaiSiswa] = useState({});
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);

	// Fetch data kelas dan siswa
	useEffect(() => {
		if (!id) return;

		const fetchData = async () => {
			try {
				// Fetch kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = await resKelas.json();
				const kelas = dataKelas.find((k) => k.id === id);

				if (kelas) {
					setNamaKelas(kelas.kelas);

					// Fetch siswa berdasarkan nama kelas
					const resSiswa = await fetch('/api/siswa');
					const dataSiswa = await resSiswa.json();
					const siswaKelas = dataSiswa.filter((siswa) => siswa.kelas === kelas.kelas && siswa.status === 'Aktif');
					setSiswaList(siswaKelas);

					// Initialize nilai siswa dengan 0
					const initialNilai = {};
					siswaKelas.forEach((siswa) => {
						initialNilai[siswa.id] = '';
					});
					setNilaiSiswa(initialNilai);
				}

				// Fetch mapel
				const resMapel = await fetch('/api/mapel');
				const dataMapel = await resMapel.json();
				setMapelList(dataMapel);
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoadingPage(false);
			}
		};

		fetchData();
	}, [id]);

	// Set tanggal hari ini sebagai default
	useEffect(() => {
		const today = new Date().toISOString().split('T')[0];
		setTanggal(today);
	}, []);

	// Handle perubahan nilai siswa
	const handleNilaiChange = (siswaId, nilai) => {
		setNilaiSiswa((prev) => ({
			...prev,
			[siswaId]: nilai,
		}));
	};

	// Handle submit
	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!judul || !selectedMapel || !tanggal) {
			Swal.fire({
				icon: 'warning',
				title: 'Data Tidak Lengkap',
				text: 'Harap lengkapi semua field yang diperlukan',
				confirmButtonColor: '#4F46E5',
			});
			return;
		}

		setLoading(true);

		try {
			const tugasData = {
				judul,
				mapel: selectedMapel,
				kelas: namaKelas,
				tanggal,
				nilai: Object.entries(nilaiSiswa).map(([siswaId, nilai]) => ({
					siswa_id: siswaId,
					nilai: nilai || '0',
				})),
			};

			const response = await fetch('/api/nilai', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(tugasData),
			});

			const result = await response.json();

			if (response.ok) {
				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: `Tugas berhasil disimpan untuk ${result.count} siswa`,
					confirmButtonColor: '#4F46E5',
					timer: 2000,
					timerProgressBar: true,
				});

				// Redirect ke halaman detail nilai dengan tugasId
				router.push(`/kelas/${id}/nilai/${result.tugasId}`);
			} else {
				throw new Error(result.error || 'Gagal menyimpan tugas');
			}
		} catch (error) {
			console.error('Error saving tugas:', error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setLoading(false);
		}
	};

	if (loadingPage) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<div className='bg-gray-50 min-h-screen pb-6'>
			<SectionHeader
				title='Buat Tugas'
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
							d='M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12'
						/>
					</svg>
				}
			/>

			<form
				onSubmit={handleSubmit}
				className='px-5 mt-6 space-y-4'>
				{/* Section 1: Input Judul */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<label className='block text-sm font-medium text-gray-700 mb-2'>Judul Tugas</label>
					<input
						type='text'
						value={judul}
						onChange={(e) => setJudul(e.target.value)}
						placeholder='Contoh: Tugas Matematika Bab 1'
						className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
						required
					/>
				</div>

				{/* Section 2: Pilihan Mapel dan Tanggal */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4'>
					{/* Kelas (Read Only) */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Kelas</label>
						<input
							type='text'
							value={namaKelas}
							readOnly
							className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed'
						/>
					</div>

					{/* Mata Pelajaran */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Mata Pelajaran</label>
						<select
							value={selectedMapel}
							onChange={(e) => setSelectedMapel(e.target.value)}
							className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
							required>
							<option value=''>Pilih Mata Pelajaran</option>
							{mapelList.map((mapel) => (
								<option
									key={mapel.id}
									value={mapel.mapel}>
									{mapel.mapel}
								</option>
							))}
						</select>
					</div>

					{/* Tanggal */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Tanggal</label>
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
							required
						/>
					</div>
				</div>

				{/* Section 3: Nama Siswa dan Input Nilai */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-sm font-medium text-gray-700'>Daftar Siswa ({siswaList.length})</h3>
						<span className='text-xs text-gray-500'>Input Nilai (0-100)</span>
					</div>

					<div className='space-y-3 max-h-[400px] overflow-y-auto'>
						{siswaList.length > 0 ? (
							siswaList.map((siswa, index) => (
								<div
									key={siswa.id}
									className='flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'>
									{/* Nama Siswa */}
									<div className='flex items-center gap-3 flex-1'>
										<span className='text-xs font-medium text-gray-500 w-6'>{index + 1}.</span>
										<div className='flex-1'>
											<div className='text-sm font-semibold text-gray-800'>{siswa.nama_lengkap}</div>
											<div className='text-xs text-gray-500'>NIS: {siswa.nis || '-'}</div>
										</div>
									</div>

									{/* Input Nilai */}
									<div className='w-20'>
										<input
											type='number'
											min='0'
											max='100'
											value={nilaiSiswa[siswa.id] || ''}
											onChange={(e) => {
												const value = e.target.value;
												// Batasi input hanya 0-100
												if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 100)) {
													handleNilaiChange(siswa.id, value);
												}
											}}
											onKeyDown={(e) => {
												// Cegah input karakter minus, e, +, .
												if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') {
													e.preventDefault();
												}
											}}
											placeholder='0'
											className='w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-semibold'
										/>
									</div>
								</div>
							))
						) : (
							<div className='text-center py-8 text-gray-400 text-sm'>Tidak ada siswa di kelas ini</div>
						)}
					</div>
				</div>

				{/* Tombol Submit */}
				<div className='flex gap-3 pt-4'>
					<button
						type='button'
						onClick={() => router.back()}
						className='flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'>
						Batal
					</button>
					<button
						type='submit'
						disabled={loading}
						className='flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium'>
						{loading ? 'Menyimpan...' : 'Simpan Tugas'}
					</button>
				</div>
			</form>
		</div>
	);
}
