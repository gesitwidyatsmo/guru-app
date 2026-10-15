'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';

export default function KepsekPenugasanPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [penugasanList, setPenugasanList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelas, setFilterKelas] = useState('all');

	useEffect(() => {
		const fetchPenugasan = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resKbm, resGuru, resKelas] = await Promise.all([
					supabase.from('guru_kbm').select(`
						id_kbm, id_user, kelas, mapel, users!guru_kbm_id_user_fkey(username, nama_lengkap)
					`),
					supabase.from('users').select('*').eq('role', 'Guru').order('nama_lengkap', { ascending: true }),
					supabase.from('kelas').select('*').order('nama_kelas', { ascending: true }),
				]);

				const formattedKBM = (resKbm.data || [])
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
				setGuruList(resGuru.data || []);
				setKelasList(resKelas.data || []);
			} catch (err) {
				console.error('Gagal mengambil data penugasan:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchPenugasan();
	}, []);

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

	const isFilterActive = Boolean(searchQuery.trim()) || filterKelas !== 'all';

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterKelas('all');
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredList.length === 0) return;

		const headers = ['Guru Pengajar', 'Username Guru', 'Rombongan Belajar', 'Mata Pelajaran', 'Status Wewenang'];
		const rows = filteredList.map((item) => [
			`"${(item.nama_guru || '').replace(/"/g, '""')}"`,
			`"${(item.username || '').replace(/"/g, '""')}"`,
			`"${(item.kelas || '').replace(/"/g, '""')}"`,
			`"${(item.mapel || '').replace(/"/g, '""')}"`,
			'Aktif Mengajar',
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`distribusi_penugasan_guru_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return <Loader />;
	}

	const activeGuruWithKBM = new Set(penugasanList.map((p) => p.username)).size;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-teal-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📋</span> Distribusi Beban Mengajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Penugasan KBM & Rombongan Belajar
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tinjau struktur pembagian kelas dan mata pelajaran yang diampu dewan guru pada semester ini.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto'>
					<button
						onClick={handleExportCSV}
						disabled={filteredList.length === 0}
						title='Unduh rekapitulasi penugasan guru dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-teal-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-gray-500 block text-[10px] uppercase font-bold'>Periode Sistem</span>
						<span className='text-teal-950 font-black text-xs sm:text-sm'>
							TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}
						</span>
					</div>
				</div>
			</div>

			{/* Stat Highlights Bar */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Total Relasi Mengajar</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{penugasanList.length}</p>
						<span className='text-[10px] font-bold text-gray-500'>Beban tugas mengajar</span>
					</div>
					<span className='w-11 h-11 bg-teal-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📋
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Guru Aktif Mengajar</p>
						<p className='text-2xl sm:text-3xl font-black text-yellow-950 mt-0.5'>{activeGuruWithKBM} / {guruList.length}</p>
						<span className='text-[10px] font-bold text-yellow-700'>Memiliki jadwal kelas</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👨‍🏫
					</span>
				</div>

				<div className='bg-purple-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-purple-800'>Rombongan Belajar</p>
						<p className='text-2xl sm:text-3xl font-black text-purple-950 mt-0.5'>{kelasList.length} Kelas</p>
						<span className='text-[10px] font-bold text-purple-700'>Tercatat di sistem</span>
					</div>
					<span className='w-11 h-11 bg-purple-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🏫
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
				<div className='relative flex-1'>
					<svg
						className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none'
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
						placeholder='Cari nama guru, username, rombel kelas, atau mata pelajaran...'
						className='neo-input neo-input-with-icon !py-2.5 text-xs sm:text-sm !w-full'
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							title='Hapus pencarian'
							className='absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black font-black text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors'>
							✕
						</button>
					)}
				</div>

				<div className='flex items-center gap-2 shrink-0'>
					<select
						value={filterKelas}
						onChange={(e) => setFilterKelas(e.target.value)}
						className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 w-full sm:w-48'>
						<option value='all'>Semua Kelas ({kelasList.length})</option>
						{kelasList.map((k) => (
							<option key={k.id || k.kelas || k.nama_kelas} value={k.nama_kelas || k.kelas}>
								{k.nama_kelas || k.kelas}
							</option>
						))}
					</select>

					{isFilterActive && (
						<button
							onClick={handleResetFilters}
							className='inline-flex items-center gap-1.5 px-3 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer whitespace-nowrap'>
							<span>↺</span>
							<span>Reset</span>
						</button>
					)}
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pengajar</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Kelas Binaan</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Mata Pelajaran</th>
								<th className='px-5 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Status Wewenang</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{Object.keys(groupedByGuru).length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-teal-50/50'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ada jadwal penugasan KBM yang sesuai</p>
											<p className='text-xs text-gray-500'>Coba ubah kata kunci pencarian atau reset filter kelas.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-teal-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								Object.entries(groupedByGuru).map(([username, info]) =>
									info.tugas.map((tugas, idx) => (
										<tr
											key={tugas.id_kbm || `${username}-${idx}`}
											className='hover:bg-teal-50/50 transition-colors'>
											{/* Guru Column (Rowspan) */}
											{idx === 0 && (
												<td
													className='px-5 py-4 align-top border-r-2 border-black/10 bg-yellow-50/40'
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

											<td className='px-5 py-4'>
												<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-orange-200 text-orange-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>🏫</span>
													<span>{tugas.kelas}</span>
												</span>
											</td>

											<td className='px-5 py-4'>
												<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-teal-200 text-teal-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>📚</span>
													<span>{tugas.mapel}</span>
												</span>
											</td>

											<td className='px-5 py-4 text-right'>
												<span className='inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold'>
													<span>✅</span> Aktif Mengajar
												</span>
											</td>
										</tr>
									))
								)
							)}
						</tbody>
					</table>
				</div>

				<div className='px-5 py-3 bg-gray-50 border-t-2 border-black text-xs font-bold text-gray-600'>
					Menampilkan <span className='font-black text-black'>{Object.keys(groupedByGuru).length}</span> guru dengan{' '}
					<span className='font-black text-black'>{filteredList.length}</span> relasi penugasan aktif
				</div>
			</div>
		</div>
	);
}
