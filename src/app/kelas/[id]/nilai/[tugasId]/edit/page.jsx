'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

export default function EditNilaiPage() {
	const params = useParams();
	const router = useRouter();
	const { id, tugasId } = params;

	const [judul, setJudul] = useState('');
	const [kelas, setKelas] = useState('');
	const [mapel, setMapel] = useState('');
	const [tanggal, setTanggal] = useState('');
	const [siswaList, setSiswaList] = useState([]);
	const [nilaiSiswa, setNilaiSiswa] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [searchSiswa, setSearchSiswa] = useState('');

	// Fetch data tugas yang akan diedit
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

				if (rawData && rawData.length > 0) {
					const firstData = rawData[0].nilai_tugas;
					
					setJudul(firstData.kategori);
					setKelas(firstData.kelas);
					setMapel(firstData.mapel);
					setTanggal(firstData.tanggal);

					const siswaData = rawData.map((item) => ({
						id: item.siswa_id,
						nama_lengkap: item.nama_siswa,
						nilai: item.nilai,
						rowId: item.id,
					}));
					setSiswaList(siswaData);

					const initialNilai = {};
					siswaData.forEach((siswa) => {
						initialNilai[siswa.id] = siswa.nilai;
					});
					setNilaiSiswa(initialNilai);
				} else {
					// Fallback if no students inserted but task exists
					const { data: tugasHead, error: errHead } = await supabase.from('nilai_tugas').select('*').eq('tugas_id', tugasId).single();
					if (tugasHead) {
						if (role === 'Guru' && tugasHead.guru_id !== userId) throw new Error('Akses Ditolak');
						setJudul(tugasHead.kategori);
						setKelas(tugasHead.kelas);
						setMapel(tugasHead.mapel);
						setTanggal(tugasHead.tanggal);
						setSiswaList([]);
						setNilaiSiswa({});
					}
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

	// Handle perubahan nilai siswa
	const handleNilaiChange = (siswaId, nilai) => {
		setNilaiSiswa((prev) => ({
			...prev,
			[siswaId]: nilai,
		}));
	};

	// Handle submit update
	const handleSubmit = async (e) => {
		e.preventDefault();

		// Konfirmasi
		const result = await Swal.fire({
			title: 'Update Nilai?',
			text: 'Nilai yang diubah akan tersimpan',
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Update',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);

		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const role = userData?.role;
			const userId = userData?.id_user;

			// Verify
			const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id').eq('tugas_id', tugasId).single();
			if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

			if (role === 'Guru' && userId) {
				if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
					throw new Error('Akses Ditolak: Anda mencoba menyunting Tugas buatan kolega.');
				}
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', kelas).eq('mapel', mapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.');
			}

			// Update Header
			const updates = { kategori: judul, tanggal: tanggal };
			const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', tugasId);
			if (updateError) throw updateError;

			// Update students
			const { data: existingGrades } = await supabase.from('nilai_siswa').select('siswa_id').eq('tugas_id', tugasId);
			const existingIds = new Set((existingGrades || []).map(g => g.siswa_id));
			
			const siswaIdsToUpdate = siswaList.map(s => s.id).filter(id => {
				const n = nilaiSiswa[id];
				return n && String(n).trim() !== '';
			});

			const newSiswaIds = siswaIdsToUpdate.filter(id => !existingIds.has(id));
			let siswaMap = new Map();
			if (newSiswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', newSiswaIds);
				siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));
			}

			let updatedCount = 0;
			for (const siswa of siswaList) {
				const idSiswa = siswa.id;
				const n = nilaiSiswa[idSiswa];
				const hasValidScore = n && String(n).trim() !== '';

				if (hasValidScore) {
					if (existingIds.has(idSiswa)) {
						await supabase.from('nilai_siswa').update({ nilai: n }).eq('tugas_id', tugasId).eq('siswa_id', idSiswa);
					} else if (siswaMap.has(idSiswa)) {
						await supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: idSiswa,
							nama_siswa: siswaMap.get(idSiswa),
							nilai: n
						});
					}
					updatedCount++;
				} else {
					if (existingIds.has(idSiswa)) {
						await supabase.from('nilai_siswa').delete().eq('tugas_id', tugasId).eq('siswa_id', idSiswa);
					}
				}
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: `${updatedCount} nilai berhasil diperbarui`,
				confirmButtonColor: '#4F46E5',
				timer: 2000,
				timerProgressBar: true,
			});

			router.push(`/kelas/${id}/nilai/${tugasId}`);
		} catch (error) {
			console.error('Error updating nilai:', error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memperbarui',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setSaving(false);
		}
	};

	const filteredSiswa = siswaList.filter((s) => (s.nama_lengkap?.toLowerCase() || '').includes(searchSiswa.toLowerCase()) || (s.nis?.toLowerCase() || '').includes(searchSiswa.toLowerCase()));

	if (loading) {
		return (
			<div className='bg-gray-50 min-h-screen'>
				<SectionHeader
					title='Edit Nilai'
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
				/>
				<div className='flex items-center justify-center h-64'>
					<div className='text-gray-500'>Memuat data...</div>
				</div>
			</div>
		);
	}

	return (
		<div className='bg-gray-50 min-h-screen pb-6'>
			<SectionHeader
				title='Edit Nilai'
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
							d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
						/>
					</svg>
				}
			/>

			<form
				onSubmit={handleSubmit}
				className='px-5 mt-6 space-y-4'>
				{/* Section 1: Judul Tugas */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<label className='block text-sm font-medium text-gray-700 mb-2'>Judul Tugas</label>
					<input
						type='text'
						value={judul}
						onChange={(e) => setJudul(e.target.value)}
						className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
						required
					/>
				</div>

				{/* Section 2: Detail Tugas */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4'>
					{/* Kelas (Read Only) */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Kelas</label>
						<input
							type='text'
							value={kelas}
							readOnly
							className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed'
						/>
					</div>

					{/* Mata Pelajaran (Read Only) */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-2'>Mata Pelajaran</label>
						<input
							type='text'
							value={mapel}
							readOnly
							className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed'
						/>
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

				{/* Section 3: Daftar Nilai Siswa */}
				<div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-sm font-medium text-gray-700'>Daftar Siswa ({siswaList.length})</h3>
						<span className='text-xs text-gray-500'>Edit Nilai (0-100)</span>
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
												if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 100)) {
													handleNilaiChange(siswa.id, value);
												}
											}}
											onKeyDown={(e) => {
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
							<div className='text-center py-8 text-gray-400 text-sm'>Tidak ada data siswa</div>
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
						disabled={saving}
						className='flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium'>
						{saving ? 'Menyimpan...' : 'Simpan Perubahan'}
					</button>
				</div>
			</form>
		</div>
	);
}
