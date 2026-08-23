'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

export default function PenugasanPage() {
	const [penugasanList, setPenugasanList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelas, setFilterKelas] = useState('all');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		id_user: '',
		kelas: '',
		mapel: '',
	});

	const fetchAllData = async () => {
		try {
			setLoading(true);
			const supabase = createClient();

			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Sesi telah habis, silakan login ulang.');

			const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
			if (profile?.role !== 'Admin') throw new Error('Akses KBM Ditolak.');

			// 1. Ambil data Penugasan KBM
			const { data: kbmData, error: kbmError } = await supabase.from('guru_kbm').select(`
				id_kbm, id_user, kelas, mapel, users!guru_kbm_id_user_fkey(username, nama_lengkap)
			`);
			if (kbmError) throw kbmError;

			const formattedKBM = (kbmData || [])
				.map((r) => ({
					id_kbm: r.id_kbm,
					id_user: r.id_user,
					username: r.users?.username || 'Akun Terhapus',
					nama_guru: r.users?.nama_lengkap || 'Akun Terhapus',
					kelas: r.kelas,
					mapel: r.mapel,
				}))
				.sort((a, b) => a.nama_guru.localeCompare(b.nama_guru));

			setPenugasanList(formattedKBM);

			// 2. Ambil daftar Guru
			const { data: guruData } = await supabase.from('users').select('*').eq('role', 'Guru').order('nama_lengkap', { ascending: true });
			if (guruData) setGuruList(guruData);

			// 3. Ambil daftar Kelas
			const { data: kelasData } = await supabase.from('kelas').select('*').order('nama_kelas', { ascending: true });
			if (kelasData) setKelasList(kelasData);

			// 4. Ambil daftar Mapel
			const { data: mapelData } = await supabase.from('mapel').select('*').order('mapel', { ascending: true });
			if (mapelData) setMapelList(mapelData);
		} catch (error) {
			Swal.fire('Terjadi Kesalahan', error.message, 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllData();
	}, []);

	const openModal = () => {
		setFormData({ id_user: '', kelas: '', mapel: '' });
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.id_user || !formData.kelas || !formData.mapel) {
			Swal.fire('Perhatian', 'Harap pilih Guru, Kelas, dan Mata Pelajaran!', 'warning');
			return;
		}

		try {
			const supabase = createClient();
			const newKBM = {
				id_kbm: 'KBM-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase(),
				id_user: formData.id_user,
				kelas: formData.kelas,
				mapel: formData.mapel,
			};
			const { error } = await supabase.from('guru_kbm').insert([newKBM]);
			if (error) throw error;

			Swal.fire('Ditugaskan!', 'Relasi mengajar KBM telah berhasil diformalkan.', 'success');
			setIsModalOpen(false);
			fetchAllData();
		} catch (error) {
			Swal.fire('Gagal!', error.message, 'error');
		}
	};

	const handleDelete = async (kbmId, infoTugas) => {
		const result = await Swal.fire({
			title: 'Cabut Wewenang Mengajar?',
			text: `Wewenang mengampu "${infoTugas.mapel}" di kelas "${infoTugas.kelas}" akan dicabut dari ${infoTugas.nama_guru}.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Cabut!',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const supabase = createClient();
				const { error } = await supabase.from('guru_kbm').delete().eq('id_kbm', kbmId);
				if (error) throw error;

				Swal.fire('Dicabut', 'Penugasan KBM berhasil dihapus.', 'success');
				fetchAllData();
			} catch (error) {
				Swal.fire('Error', error.message, 'error');
			}
		}
	};

	// Filter data berdasarkan pencarian & filter kelas
	const filteredList = useMemo(() => {
		return penugasanList.filter((item) => {
			const matchKelas = filterKelas === 'all' || item.kelas === filterKelas;
			const q = searchQuery.toLowerCase().trim();
			const matchSearch =
				!q ||
				item.nama_guru.toLowerCase().includes(q) ||
				item.username.toLowerCase().includes(q) ||
				item.mapel.toLowerCase().includes(q) ||
				item.kelas.toLowerCase().includes(q);
			return matchKelas && matchSearch;
		});
	}, [penugasanList, filterKelas, searchQuery]);

	// Kelompokkan per Guru
	const groupedByGuru = useMemo(() => {
		return filteredList.reduce((acc, curr) => {
			if (!acc[curr.username]) {
				acc[curr.username] = {
					nama: curr.nama_guru,
					username: curr.username,
					tugas: [],
				};
			}
			acc[curr.username].tugas.push(curr);
			return acc;
		}, {});
	}, [filteredList]);

	if (loading && penugasanList.length === 0) return <Loader />;

	const activeGuruWithKBM = new Set(penugasanList.map((p) => p.username)).size;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-teal-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📋</span> Distribusi Beban Mengajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Penugasan KBM & Rombel
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Atur relasi kewenangan akses mengajar guru terhadap kelas dan mata pelajaran yang diampu.
					</p>
				</div>

				<button
					onClick={openModal}
					className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-3 !px-5 whitespace-nowrap shrink-0 self-stretch sm:self-auto justify-center'>
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
					</svg>
					<span>Tambah Relasi Mengajar</span>
				</button>
			</div>

			{/* Stat Highlights Bar */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Total Relasi Mengajar</p>
						<p className='text-2xl font-black text-black mt-0.5'>{penugasanList.length}</p>
					</div>
					<span className='w-10 h-10 bg-teal-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📋
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-yellow-800'>Guru Aktif Mengajar</p>
						<p className='text-2xl font-black text-black mt-0.5'>{activeGuruWithKBM} / {guruList.length}</p>
					</div>
					<span className='w-10 h-10 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</span>
				</div>

				<div className='bg-purple-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-purple-800'>Rombongan Belajar</p>
						<p className='text-2xl font-black text-black mt-0.5'>{kelasList.length} Kelas</p>
					</div>
					<span className='w-10 h-10 bg-purple-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏫
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div className='relative w-full sm:w-80'>
					<svg
						className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
						strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
					</svg>
					<input
						type='text'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder='Cari guru, kelas, atau mapel...'
						className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
					/>
				</div>

				<div className='flex items-center gap-2 w-full sm:w-auto'>
					<label className='text-xs font-black uppercase text-black whitespace-nowrap'>Filter Kelas:</label>
					<select
						value={filterKelas}
						onChange={(e) => setFilterKelas(e.target.value)}
						className='neo-input !py-2 text-xs sm:text-sm bg-white font-bold max-w-[200px]'>
						<option value='all'>Semua Kelas ({kelasList.length})</option>
						{kelasList.map((k) => (
							<option key={k.id || k.kelas || k.nama_kelas} value={k.nama_kelas || k.kelas}>
								{k.nama_kelas || k.kelas}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black'>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pengajar</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Kelas Binaan</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Mata Pelajaran</th>
								<th className='px-6 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{Object.keys(groupedByGuru).length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-teal-50/50'>
										Tidak ada jadwal penugasan KBM yang sesuai filter.
									</td>
								</tr>
							) : (
								Object.entries(groupedByGuru).map(([username, info]) =>
									info.tugas.map((tugas, idx) => (
										<tr
											key={tugas.id_kbm || `${username}-${idx}`}
											className='hover:bg-teal-50/50 transition-colors'>
											{/* Guru Column (Merged Rowspan) */}
											{idx === 0 && (
												<td
													className='px-6 py-4 align-top border-r-2 border-black/10 bg-yellow-50/40'
													rowSpan={info.tugas.length}>
													<div className='flex items-start gap-3'>
														<div className='w-10 h-10 rounded-xl bg-yellow-300 border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
															{info.nama.charAt(0).toUpperCase()}
														</div>
														<div>
															<span className='font-black text-black block text-sm sm:text-base'>
																{info.nama}
															</span>
															<span className='font-mono text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-block mt-1'>
																@{username}
															</span>
															<div className='mt-2'>
																<span className='text-[10px] font-black uppercase px-2 py-0.5 bg-black text-white rounded-md'>
																	{info.tugas.length} Beban Tugas
																</span>
															</div>
														</div>
													</div>
												</td>
											)}

											{/* Kelas Column */}
											<td className='px-6 py-4'>
												<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-orange-200 text-orange-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>🏫</span>
													<span>{tugas.kelas}</span>
												</span>
											</td>

											{/* Mapel Column */}
											<td className='px-6 py-4'>
												<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-teal-200 text-teal-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>📚</span>
													<span>{tugas.mapel}</span>
												</span>
											</td>

											{/* Action Column */}
											<td className='px-6 py-4 text-right'>
												<button
													onClick={() => handleDelete(tugas.id_kbm, tugas)}
													className='p-2 bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-900 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'
													title='Hapus Penugasan Ini'>
													<svg
														className='w-4 h-4'
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'
														strokeWidth='2.5'>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
														/>
													</svg>
												</button>
											</td>
										</tr>
									))
								)
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal UI Registrasi Penugasan */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150'>
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-teal-300'>
							<h3 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
								<span>📋</span>
								<span>Registrasi Penugasan KBM</span>
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						<div className='p-6 bg-[var(--background)]'>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div>
									<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
										Pilih Guru Pengajar <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.id_user}
										onChange={(e) => setFormData({ ...formData, id_user: e.target.value })}
										className='neo-input text-sm bg-white font-bold'
										required>
										<option value=''>-- Pilih Guru dari Akun Terdaftar --</option>
										{guruList.map((g) => (
											<option
												key={g.id_user}
												value={g.id_user}>
												{g.nama_lengkap} (@{g.username})
											</option>
										))}
									</select>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Kelas Target <span className='text-rose-600'>*</span>
										</label>
										<select
											value={formData.kelas}
											onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
											className='neo-input text-sm bg-white font-bold'
											required>
											<option value=''>-- Pilih Kelas --</option>
											{kelasList.map((k) => (
												<option
													key={k.id || k.kelas || k.nama_kelas}
													value={k.nama_kelas || k.kelas}>
													{k.nama_kelas || k.kelas}
												</option>
											))}
										</select>
									</div>

									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Mata Pelajaran <span className='text-rose-600'>*</span>
										</label>
										<select
											value={formData.mapel}
											onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
											className='neo-input text-sm bg-white font-bold'
											required>
											<option value=''>-- Pilih Mapel --</option>
											{mapelList.map((m) => (
												<option
													key={m.id || m.mapel}
													value={m.mapel}>
													{m.mapel}
												</option>
											))}
										</select>
									</div>
								</div>

								<div className='pt-4 border-t-2 border-black/10 flex gap-3'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='neo-btn-outline flex-1 text-center justify-center text-xs sm:text-sm !py-2.5'>
										Batal
									</button>
									<button
										type='submit'
										className='neo-btn-primary flex-1 text-center justify-center text-xs sm:text-sm !py-2.5 bg-black text-white'>
										Simpan Penugasan
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
