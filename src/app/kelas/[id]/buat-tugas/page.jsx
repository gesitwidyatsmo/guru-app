'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';

export default function BuatTugasPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;

	const [namaKelas, setNamaKelas] = useState('');
	const [judul, setJudul] = useState('');
	const [type, setType] = useState('Formatif');
	const [deskripsi, setDeskripsi] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [tanggal, setTanggal] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [nilaiSiswa, setNilaiSiswa] = useState({});
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);
	const [searchSiswa, setSearchSiswa] = useState('');

	// Fetch data kelas dan siswa
	useEffect(() => {
		if (!id) return;

		const fetchData = async () => {
			try {
				const supabase = createClient();
				const { data: kelas } = await supabase.from('kelas').select('*').eq('id', id).single();

				if (kelas) {
					setNamaKelas(kelas.nama_kelas);

					const { data: dataSiswa } = await supabase.from('siswa').select('*').eq('kelas', kelas.nama_kelas).eq('status', 'Aktif');
					const siswaKelas = dataSiswa || [];
					setSiswaList(siswaKelas);

					const initialNilai = {};
					siswaKelas.forEach((siswa) => {
						initialNilai[siswa.id] = '';
					});
					setNilaiSiswa(initialNilai);
				}

				const { data: dataMapel } = await supabase.from('mapel').select('*');
				setMapelList(dataMapel || []);
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
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const userId = userData?.id_user;
			const role = userData?.role;

			// Validate
			if (role === 'Guru' && userId) {
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', namaKelas).eq('mapel', selectedMapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Anda tidak mengajar mapel ini di kelas tersebut.');
			}

			// Generate ID
			const tugasId = `TGS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

			const { error: insertHeaderError } = await supabase.from('nilai_tugas').insert({
				tugas_id: tugasId,
				guru_id: userId,
				kategori: judul,
				type,
				deskripsi,
				kelas: namaKelas,
				mapel: selectedMapel,
				tanggal
			});
			if (insertHeaderError) throw insertHeaderError;

			// Insert scores
			const siswaMap = new Map();
			siswaList.forEach(s => siswaMap.set(s.id, s.nama_lengkap));

			const validGrades = Object.entries(nilaiSiswa).filter(([id, n]) => n && String(n).trim() !== '').map(([id, n]) => ({
				tugas_id: tugasId,
				siswa_id: id,
				nama_siswa: siswaMap.get(id) || 'Unknown',
				nilai: n
			}));

			if (validGrades.length > 0) {
				const { error: insertScoreError } = await supabase.from('nilai_siswa').insert(validGrades);
				if (insertScoreError) {
					await supabase.from('nilai_tugas').delete().eq('tugas_id', tugasId);
					throw insertScoreError;
				}
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: `Tugas berhasil disimpan untuk ${validGrades.length} siswa`,
				confirmButtonColor: '#4F46E5',
				timer: 2000,
				timerProgressBar: true,
			});

			// Redirect ke halaman detail nilai dengan tugasId
			router.push(`/kelas/${id}/nilai/${tugasId}`);
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

	const filteredSiswa = siswaList.filter((s) => (s.nama_lengkap?.toLowerCase() || '').includes(searchSiswa.toLowerCase()) || (s.nis?.toLowerCase() || '').includes(searchSiswa.toLowerCase()));

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
				{/* Section 1: Input Judul, Tipe, & Deskripsi */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4'>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='md:col-span-2'>
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
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-2'>Tipe Penilaian</label>
							<select
								value={type}
								onChange={(e) => setType(e.target.value)}
								className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'>
								<option value='Formatif'>Formatif</option>
								<option value='Sumatif'>Sumatif</option>
								<option value='SAS'>SAS</option>
							</select>
						</div>
					</div>
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Deskripsi (Opsional)</label>
						<textarea
							value={deskripsi}
							onChange={(e) => setDeskripsi(e.target.value)}
							rows={2}
							className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none'
							placeholder='Catatan tambahan tentang tugas ini'
						/>
					</div>
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

					<div className='mb-4 relative'>
						<input
							type='text'
							placeholder='Cari nama atau NIS siswa...'
							value={searchSiswa}
							onChange={(e) => setSearchSiswa(e.target.value)}
							className='w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all'
						/>
						<div className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'>
							<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-5 h-5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' />
							</svg>
						</div>
					</div>

					<div className='space-y-3 max-h-[400px] overflow-y-auto'>
						{filteredSiswa.length > 0 ? (
							filteredSiswa.map((siswa, index) => (
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
