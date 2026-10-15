'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';

export default function KepsekPenilaianPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [tasks, setTasks] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterMapel, setFilterMapel] = useState('Semua');
	const [filterKategori, setFilterKategori] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTask, setSelectedTask] = useState(null);

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	useEffect(() => {
		const fetchPenilaianData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resTasks, resKelas, resMapel] = await Promise.all([
					supabase
						.from('nilai_tugas')
						.select('*, users!nilai_tugas_guru_id_fkey(nama_lengkap, username), nilai_siswa(id, nilai, siswa_id, nama_siswa)')
						.order('tanggal', { ascending: false }),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
				]);

				setTasks(resTasks.data || []);
				setKelasList(resKelas.data || []);
				setMapelList(resMapel.data || []);
			} catch (err) {
				console.error('Gagal memuat rekap nilai:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchPenilaianData();
	}, []);

	// Reset pagination on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterMapel, filterKategori, searchQuery]);

	// Filter Data
	const filteredTasks = useMemo(() => {
		return tasks.filter((t) => {
			const matchKelas = filterKelas === 'Semua' || t.kelas === filterKelas;
			const matchMapel = filterMapel === 'Semua' || t.mapel === filterMapel;
			const matchKat = filterKategori === 'Semua' || t.kategori === filterKategori;

			const q = searchQuery.toLowerCase().trim();
			const desc = t.deskripsi?.toLowerCase() || '';
			const guruName = t.users?.nama_lengkap?.toLowerCase() || '';
			const matchSearch =
				!q ||
				desc.includes(q) ||
				guruName.includes(q) ||
				(t.mapel && t.mapel.toLowerCase().includes(q)) ||
				(t.kelas && t.kelas.toLowerCase().includes(q));

			return matchKelas && matchMapel && matchKat && matchSearch;
		});
	}, [tasks, filterKelas, filterMapel, filterKategori, searchQuery]);

	// Statistik Komprehensif
	const overallStats = useMemo(() => {
		let totalScore = 0;
		let scoreCount = 0;
		let highest = 0;
		let passCount = 0;

		tasks.forEach((t) => {
			(t.nilai_siswa || []).forEach((s) => {
				const val = parseFloat(s.nilai);
				if (!isNaN(val)) {
					totalScore += val;
					scoreCount++;
					if (val > highest) highest = val;
					if (val >= 75) passCount++; // KKM acuan 75
				}
			});
		});

		const avg = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 0;
		const passRate = scoreCount > 0 ? Math.round((passCount / scoreCount) * 100) : 0;

		return {
			totalTugas: tasks.length,
			totalSiswaDinilai: scoreCount,
			rataRata: avg,
			ketuntasan: passRate,
			tertinggi: highest,
		};
	}, [tasks]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredTasks.length / itemsPerPage));
	const paginatedTasks = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredTasks.slice(start, start + itemsPerPage);
	}, [filteredTasks, currentPage]);

	// Filter active check
	const isFilterActive =
		Boolean(searchQuery.trim()) ||
		filterKelas !== 'Semua' ||
		filterMapel !== 'Semua' ||
		filterKategori !== 'Semua';

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterKelas('Semua');
		setFilterMapel('Semua');
		setFilterKategori('Semua');
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredTasks.length === 0) return;

		const headers = [
			'Tanggal',
			'Deskripsi Penilaian',
			'Guru Pengampu',
			'Kelas',
			'Mata Pelajaran',
			'Kategori',
			'Jumlah Siswa Dinilai',
			'Rata-rata Nilai',
			'Persentase KKM (%)',
		];

		const rows = filteredTasks.map((t) => {
			const scores = (t.nilai_siswa || []).map((s) => parseFloat(s.nilai)).filter((v) => !isNaN(v));
			const taskAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
			const passRate = scores.length > 0 ? Math.round((scores.filter((v) => v >= 75).length / scores.length) * 100) : 0;

			return [
				t.tanggal || '',
				`"${(t.deskripsi || '').replace(/"/g, '""')}"`,
				`"${(t.users?.nama_lengkap || '').replace(/"/g, '""')}"`,
				`"${(t.kelas || '').replace(/"/g, '""')}"`,
				`"${(t.mapel || '').replace(/"/g, '""')}"`,
				t.kategori || '-',
				scores.length,
				taskAvg,
				passRate,
			];
		});

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`rekap_nilai_akademik_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-teal-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📊</span> Audit Capaian Belajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Rekapitulasi Nilai Akademik Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Evaluasi distribusi capaian nilai formatif, sumatif, dan persentase ketuntasan belajar siswa di seluruh kelas.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto'>
					<button
						onClick={handleExportCSV}
						disabled={filteredTasks.length === 0}
						title='Unduh rekapitulasi penilaian saat ini dalam format CSV'
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
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Rata-rata Nilai</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{overallStats.rataRata}</p>
						<span className='text-[10px] font-bold text-gray-500'>Skala 0 - 100</span>
					</div>
					<span className='w-11 h-11 bg-teal-200 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📈
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-emerald-800'>Ketuntasan KKM (75)</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>{overallStats.ketuntasan}%</p>
						<span className='text-[10px] font-bold text-emerald-700'>Tuntas KKM nasional</span>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🎯
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Sesi Penilaian</p>
						<p className='text-2xl sm:text-3xl font-black text-yellow-950 mt-0.5'>{overallStats.totalTugas}</p>
						<span className='text-[10px] font-bold text-yellow-700'>Formatif & Sumatif</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📑
					</span>
				</div>

				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-indigo-800'>Total Nilai Siswa</p>
						<p className='text-2xl sm:text-3xl font-black text-indigo-950 mt-0.5'>{overallStats.totalSiswaDinilai}</p>
						<span className='text-[10px] font-bold text-indigo-700'>Entri nilai terekam</span>
					</div>
					<span className='w-11 h-11 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👥
					</span>
				</div>
			</div>

			{/* Search & Multi Filter Box (Clean Structured Two-Tier Layout) */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Row 1: Search & Active Filter State */}
				<div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
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
							placeholder='Cari deskripsi tugas, nama guru, mapel, atau kelas...'
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

					<div className='flex items-center justify-between sm:justify-end gap-2 shrink-0'>
						<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-950 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							<span>📑</span>
							<span>{filteredTasks.length} Sesi Ditemukan</span>
						</span>

						{isFilterActive && (
							<button
								onClick={handleResetFilters}
								className='inline-flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
								<span>↺</span>
								<span>Reset Filter</span>
							</button>
						)}
					</div>
				</div>

				{/* Row 2: 3 Dedicated Filter Dropdowns */}
				<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t-2 border-black/10'>
					{/* Filter Rombel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏫</span> Rombongan Belajar
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kelas ({kelasList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					{/* Filter Mapel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>📚</span> Mata Pelajaran
						</label>
						<select
							value={filterMapel}
							onChange={(e) => setFilterMapel(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Mapel ({mapelList.length})</option>
							{mapelList.map((m) => (
								<option key={m.id || m.mapel} value={m.mapel}>
									{m.mapel}
								</option>
							))}
						</select>
					</div>

					{/* Filter Kategori */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏷️</span> Kategori Penilaian
						</label>
						<select
							value={filterKategori}
							onChange={(e) => setFilterKategori(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kategori</option>
							<option value='Formatif'>Formatif</option>
							<option value='Sumatif'>Sumatif</option>
							<option value='Tugas'>Tugas Harian</option>
							<option value='UH'>Ulangan Harian</option>
						</select>
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Deskripsi Penilaian</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pengampu</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Rombel & Mapel</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Kategori</th>
								<th className='px-5 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider'>Rata-rata & KKM</th>
								<th className='px-5 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedTasks.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-teal-50/30'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ditemukan rekaman penilaian yang sesuai</p>
											<p className='text-xs text-gray-500'>Coba ubah kata kunci pencarian atau reset filter untuk menampilkan semua data.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-teal-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedTasks.map((t, idx) => {
									const scores = (t.nilai_siswa || []).map((s) => parseFloat(s.nilai)).filter((v) => !isNaN(v));
									const taskAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
									const passRate = scores.length > 0 ? Math.round((scores.filter((v) => v >= 75).length / scores.length) * 100) : 0;

									return (
										<tr
											key={t.tugas_id || t.id || idx}
											className='hover:bg-teal-50/40 transition-colors'>
											{/* Deskripsi */}
											<td className='px-5 py-4'>
												<div className='font-black text-xs sm:text-sm text-black'>{t.deskripsi || 'Sesi Penilaian'}</div>
												<span className='text-[10px] font-bold text-gray-500 block mt-0.5'>
													{t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
												</span>
											</td>

											{/* Guru */}
											<td className='px-5 py-4'>
												<div className='flex items-center gap-2'>
													<div className='w-8 h-8 rounded-lg bg-teal-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
														{t.users?.nama_lengkap ? t.users.nama_lengkap.charAt(0).toUpperCase() : 'G'}
													</div>
													<div className='min-w-0'>
														<p className='font-black text-xs sm:text-sm text-black truncate max-w-[160px] sm:max-w-xs'>
															{t.users?.nama_lengkap || 'Guru Pengampu'}
														</p>
														<span className='font-mono text-[10px] text-gray-500'>
															@{t.users?.username || 'user'}
														</span>
													</div>
												</div>
											</td>

											{/* Kelas & Mapel */}
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex flex-col gap-1 items-start'>
													<span className='inline-block px-2.5 py-0.5 bg-yellow-200 text-black text-xs font-black rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
														{t.kelas}
													</span>
													<span className='text-xs font-bold text-gray-700'>{t.mapel}</span>
												</div>
											</td>

											{/* Kategori */}
											<td className='px-5 py-4 whitespace-nowrap'>
												<span className='inline-block px-2.5 py-1 bg-white border-2 border-black rounded-lg text-xs font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{t.kategori || 'Tugas'}
												</span>
											</td>

											{/* Nilai Rata-rata & KKM */}
											<td className='px-5 py-4 text-center whitespace-nowrap'>
												<div className='inline-flex flex-col items-center gap-1'>
													<span className='font-mono font-black text-sm text-black bg-gray-100 px-2.5 py-0.5 rounded border border-black/20'>
														{taskAvg}
													</span>
													<span
														className={`text-[10px] font-black px-2 py-0.2 rounded border ${
															passRate >= 75
																? 'bg-emerald-100 text-emerald-800 border-emerald-300'
																: 'bg-orange-100 text-orange-800 border-orange-300'
														}`}>
														{passRate}% Tuntas KKM
													</span>
												</div>
											</td>

											{/* Detail */}
											<td className='px-5 py-4 text-right whitespace-nowrap'>
												<button
													onClick={() => setSelectedTask(t)}
													className='px-3 py-1.5 bg-white hover:bg-teal-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
													🔍 Tinjau Nilai
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div className='px-5 py-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3'>
					<div className='text-xs font-bold text-gray-600'>
						Menampilkan <span className='font-black text-black'>{filteredTasks.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredTasks.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredTasks.length}</span> sesi penilaian
					</div>

					{totalPages > 1 && (
						<div className='flex items-center gap-1.5'>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className='px-3 py-1.5 bg-white hover:bg-teal-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								◀ Prev
							</button>

							<div className='flex items-center gap-1'>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
									if (
										pageNum === 1 ||
										pageNum === totalPages ||
										(pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
									) {
										return (
											<button
												key={pageNum}
												onClick={() => setCurrentPage(pageNum)}
												className={`w-8 h-8 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer ${
													currentPage === pageNum
														? 'bg-teal-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												{pageNum}
											</button>
										);
									} else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
										return (
											<span key={pageNum} className='px-1 text-xs font-black text-gray-400'>
												...
											</span>
										);
									}
									return null;
								})}
							</div>

							<button
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								className='px-3 py-1.5 bg-white hover:bg-teal-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								Next ▶
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Modal Tinjau Nilai Siswa */}
			{selectedTask && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150'>
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-teal-300'>
							<div>
								<h3 className='text-base sm:text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
									<span>📑</span>
									<span>Daftar Nilai Siswa</span>
								</h3>
								<p className='text-xs font-bold text-gray-800'>
									{selectedTask.deskripsi} &bull; {selectedTask.kelas} &bull; {selectedTask.mapel}
								</p>
							</div>
							<button
								onClick={() => setSelectedTask(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
								✕
							</button>
						</div>

						<div className='p-6 max-h-[70vh] overflow-y-auto space-y-4 bg-[var(--background)]'>
							<div className='overflow-x-auto border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<table className='w-full text-left bg-white text-xs'>
									<thead>
										<tr className='bg-yellow-200 border-b-2 border-black font-black'>
											<th className='p-3'>No</th>
											<th className='p-3'>Nama Siswa</th>
											<th className='p-3 text-center'>Nilai</th>
											<th className='p-3 text-center'>Status KKM (75)</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-black/10'>
										{(selectedTask.nilai_siswa || []).length === 0 ? (
											<tr>
												<td colSpan={4} className='p-6 text-center text-gray-500 font-bold'>
													Belum ada data nilai siswa yang dimasukkan untuk sesi ini.
												</td>
											</tr>
										) : (
											selectedTask.nilai_siswa.map((ns, idx) => {
												const val = parseFloat(ns.nilai);
												const isPass = !isNaN(val) && val >= 75;
												return (
													<tr key={ns.id || idx} className='hover:bg-yellow-50'>
														<td className='p-3 font-bold text-gray-500'>{idx + 1}</td>
														<td className='p-3 font-black text-black'>{ns.nama_siswa || `Siswa ID: ${ns.siswa_id}`}</td>
														<td className='p-3 text-center font-mono font-black text-sm'>{ns.nilai || 0}</td>
														<td className='p-3 text-center'>
															<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
																{isPass ? 'Tuntas' : 'Remedial'}
															</span>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>

							<div className='pt-2 flex justify-end'>
								<button
									onClick={() => setSelectedTask(null)}
									className='neo-btn-primary text-xs sm:text-sm !py-2 !px-5 bg-black text-white cursor-pointer'>
									Tutup Tinjauan
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
