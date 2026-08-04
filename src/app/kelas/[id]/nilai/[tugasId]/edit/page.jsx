'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

export default function EditNilaiPage() {
	const params = useParams();
	const router = useRouter();
	const { id, tugasId: rawTugasId } = params;
	const tugasId = decodeURIComponent(rawTugasId || '');

	const [judul, setJudul] = useState('');
	const [type, setType] = useState('Formatif');
	const [deskripsi, setDeskripsi] = useState('');
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
					setJudul(tugasDetail.kategori);
					setType(tugasDetail.type || 'Formatif');
					setDeskripsi(tugasDetail.deskripsi || '');
					setKelas(tugasDetail.kelas);
					setMapel(tugasDetail.mapel);
					setTanggal(tugasDetail.tanggal);

					// Fetch all students for this class
					// Kolom 'absen' ternyata tidak ada di DB, jadi hapus dari select dan gunakan nama untuk sorting
					const { data: daftarSiswa, error: errSiswa } = await supabase
						.from('siswa')
						.select('id, nama_lengkap, status')
						.eq('kelas', tugasDetail.kelas)
						.order('nama_lengkap', { ascending: true });
					
					if (errSiswa) console.error("Error fetching siswa", errSiswa);

					let finalSiswaList = [];

					if (daftarSiswa && daftarSiswa.length > 0) {
						finalSiswaList = daftarSiswa.map((s, index) => {
							const found = submittedSiswa.find(sub => sub.siswa_id === s.id);
							// Nomor absen buatan jika DB tidak ada kolom absen
							const nomorAbsen = String(index + 1);
							return {
								id: s.id,
								nama_lengkap: s.nama_lengkap,
								status: s.status,
								absen: nomorAbsen,
								nilai: found && found.nilai !== null ? found.nilai : '',
								rowId: found ? found.id : null,
							};
						});
					} else {
						// FALLBACK
						console.warn("Daftar siswa kosong untuk kelas:", tugasDetail.kelas);
						finalSiswaList = submittedSiswa.map((item) => ({
							id: item.siswa_id,
							nama_lengkap: item.nama_siswa,
							status: 'Aktif',
							absen: '-',
							nilai: item.nilai,
							rowId: item.id,
						}));
					}

					setSiswaList(finalSiswaList);

					const initialNilai = {};
					finalSiswaList.forEach((siswa) => {
						initialNilai[siswa.id] = siswa.nilai;
					});
					setNilaiSiswa(initialNilai);
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
			const updates = { kategori: judul, tanggal: tanggal, type, deskripsi };
			const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', tugasId);
			if (updateError) throw updateError;

			// Update students
			const { data: existingGrades } = await supabase.from('nilai_siswa').select('siswa_id').eq('tugas_id', tugasId);
			const existingIds = new Set((existingGrades || []).map(g => g.siswa_id));
			
			const siswaIdsToUpdate = siswaList.map(s => s.id).filter(id => {
				const n = nilaiSiswa[id];
				return n !== undefined && n !== null && String(n).trim() !== '';
			});

			const newSiswaIds = siswaIdsToUpdate.filter(id => !existingIds.has(id));
			let siswaMap = new Map();
			if (newSiswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', newSiswaIds);
				siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));
			}

			let updatedCount = 0;
			const promises = [];

			for (const siswa of siswaList) {
				const idSiswa = siswa.id;
				const n = nilaiSiswa[idSiswa];
				const hasValidScore = n !== undefined && n !== null && String(n).trim() !== '';

				if (hasValidScore) {
					if (existingIds.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').update({ nilai: n }).eq('tugas_id', tugasId).eq('siswa_id', idSiswa));
					} else if (siswaMap.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: idSiswa,
							nama_siswa: siswaMap.get(idSiswa),
							nilai: n
						}));
					}
					updatedCount++;
				} else {
					if (existingIds.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').delete().eq('tugas_id', tugasId).eq('siswa_id', idSiswa));
					}
				}
			}

			await Promise.all(promises);

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
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] flex flex-col font-sans'>
				<div className='bg-[#00A693] border-b-[4px] border-[#0D0D0D] p-6 flex items-center gap-4'>
					<button onClick={() => router.back()} className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
					</button>
					<h1 className='text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>EDIT NILAI</h1>
				</div>
				<div className='flex items-center justify-center flex-1'>
					<div className='bg-white border-[4px] border-[#0D0D0D] p-6 shadow-[8px_8px_0px_0px_#0D0D0D] font-black uppercase text-lg animate-pulse'>MEMUAT DATA...</div>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			{/* Header Brutalist */}
			<div className='bg-[#8B5CF6] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
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
								EDIT NILAI
							</h1>
						</div>
					</div>
				</div>
			</div>

			<form onSubmit={handleSubmit} className='max-w-4xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 space-y-8'>
				
				{/* Section 1: Judul Tugas */}
				<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>JUDUL TUGAS</label>
					<input
						type='text'
						value={judul}
						onChange={(e) => setJudul(e.target.value)}
						className='w-full px-4 py-4 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-xl transition-all uppercase'
						required
					/>
				</div>

				{/* Section 2: Detail Tugas */}
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>KELAS (READ ONLY)</label>
							<input
								type='text'
								value={kelas}
								readOnly
								className='w-full px-4 py-3 bg-[#E5E7EB] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D] cursor-not-allowed pointer-events-none'
							/>
						</div>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>MATA PELAJARAN (READ ONLY)</label>
							<input
								type='text'
								value={mapel}
								readOnly
								className='w-full px-4 py-3 bg-[#E5E7EB] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D] cursor-not-allowed pointer-events-none'
							/>
						</div>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>TANGGAL</label>
							<input
								type='date'
								value={tanggal}
								onChange={(e) => setTanggal(e.target.value)}
								className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none uppercase cursor-pointer transition-all'
								required
							/>
						</div>
					</div>
					{/* Tambahan Baris untuk Tipe Tugas & Deskripsi */}
					<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-6'>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>TIPE TUGAS</label>
							<div className='relative'>
								<select
									value={type}
									onChange={(e) => setType(e.target.value)}
									className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none cursor-pointer transition-all appearance-none'
								>
									<option value='Formatif'>Formatif</option>
									<option value='Sumatif'>Sumatif</option>
									<option value='SAS'>SAS</option>
									<option value='PTS'>PTS</option>
									<option value='PAS'>PAS</option>
								</select>
								<div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none'>
									<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor' className='w-5 h-5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5' />
									</svg>
								</div>
							</div>
						</div>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>DESKRIPSI (OPSIONAL)</label>
							<textarea
								value={deskripsi}
								onChange={(e) => setDeskripsi(e.target.value)}
								placeholder='Contoh: BAB 1 Eksponen'
								className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-medium text-base shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none transition-all min-h-[56px] resize-y'
								rows='1'
							></textarea>
						</div>
					</div>
				</div>

				{/* Section 3: Daftar Nilai Siswa */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='bg-[#0D0D0D] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4'>
						<div className='flex items-center gap-3'>
							<h3 className='text-white font-black uppercase tracking-widest'>DAFTAR SISWA</h3>
							<span className='bg-[#F5C518] text-[#0D0D0D] text-[10px] font-black px-2 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>SKALA 0-100</span>
						</div>
						
						{/* Search Box */}
						<div className='relative w-full md:w-64'>
							<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
								<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor' className='w-5 h-5 text-[#0D0D0D]'><path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' /></svg>
							</div>
							<input
								type='text'
								placeholder='CARI SISWA...'
								value={searchSiswa}
								onChange={(e) => setSearchSiswa(e.target.value)}
								className='w-full pl-10 pr-4 py-2 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black placeholder-gray-500 uppercase outline-none focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all'
							/>
						</div>
					</div>

					<div className='max-h-[500px] overflow-y-auto bg-[#FFF5F0]'>
						{filteredSiswa.length > 0 ? (
							filteredSiswa.map((siswa, index) => (
								<div
									key={siswa.id}
									className={`flex items-center justify-between gap-4 p-4 transition-colors group border-b-[3px] border-[#0D0D0D] ${siswa.status !== 'Aktif' ? 'bg-gray-100 opacity-60' : 'bg-white hover:bg-[#A3E635]'}`}>
									
									<div className='flex items-center gap-4 flex-1'>
										<div className='w-8 h-8 flex items-center justify-center bg-[#0D0D0D] text-white font-black text-sm rounded-full shadow-[2px_2px_0px_0px_#0D0D0D]'>
											{index + 1}
										</div>
										<div className='text-base font-black text-[#0D0D0D] uppercase'>
											{siswa.nama_lengkap}
											{siswa.status && siswa.status !== 'Aktif' && (
												<span className='ml-2 inline-flex items-center text-[10px] font-black uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] align-middle'>
													{siswa.status}
												</span>
											)}
										</div>
									</div>

									<div className='w-24'>
										<input
											type='number'
											min='0'
											max='100'
											disabled={siswa.status && siswa.status !== 'Aktif'}
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
											className='w-full px-2 py-2 text-center bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-[#0D0D0D] font-black text-xl outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed'
										/>
									</div>
								</div>
							))
						) : (
							<div className='p-8 text-center bg-white border-b-[3px] border-[#0D0D0D]'>
								<div className='text-4xl mb-2'>📭</div>
								<div className='text-[#0D0D0D] font-black uppercase'>TIDAK ADA SISWA</div>
							</div>
						)}
					</div>
				</div>

				{/* Tombol Action */}
				<div className='flex flex-col sm:flex-row gap-4 pt-4'>
					<button
						type='button'
						onClick={() => router.back()}
						className='flex-1 px-6 py-4 bg-white text-[#0D0D0D] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all font-black uppercase tracking-widest text-center'>
						BATAL
					</button>
					<button
						type='submit'
						disabled={saving}
						className='flex-1 px-6 py-4 bg-[#A3E635] text-[#0D0D0D] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all font-black uppercase tracking-widest text-center disabled:opacity-50 disabled:cursor-not-allowed'>
						{saving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
					</button>
				</div>
			</form>
		</div>
	);
}
