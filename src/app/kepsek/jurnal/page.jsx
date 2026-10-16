'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
} from '@/lib/pdfKopSurat';
import { exportJurnalPDFReport } from '@/lib/pdfJurnalReport';

export default function KepsekJurnalPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [journals, setJournals] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterGuru, setFilterGuru] = useState('Semua');
	const [filterStatus, setFilterStatus] = useState('Semua');
	const [filterTanggal, setFilterTanggal] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedJournal, setSelectedJournal] = useState(null);

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

	useEffect(() => {
		const fetchSupervisiJurnal = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resJurnal, resGuru, resKelas, resProfil] = await Promise.all([
					supabase
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.order('tanggal', { ascending: false }),
					supabase.from('users').select('id_user, nama_lengkap, username').eq('role', 'Guru'),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				setJournals(resJurnal.data || []);
				setGuruList(resGuru.data || []);
				setKelasList(resKelas.data || []);

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Gagal memuat supervisi jurnal:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchSupervisiJurnal();
	}, []);

	// Reset pagination on filter/search change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterGuru, filterStatus, filterTanggal, searchQuery]);

	// Filter Data
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			const matchTanggal = !filterTanggal || j.tanggal === filterTanggal;
			const matchKelas = filterKelas === 'Semua' || j.kelas === filterKelas;
			const matchGuru = filterGuru === 'Semua' || j.guru_id === filterGuru;
			const matchStatus =
				filterStatus === 'Semua' ||
				(filterStatus === 'Tuntas' && j.tuntas) ||
				(filterStatus === 'Belum Tuntas' && !j.tuntas);

			const q = searchQuery.toLowerCase().trim();
			const guruName = j.users?.nama_lengkap?.toLowerCase() || '';
			const matchSearch =
				!q ||
				guruName.includes(q) ||
				(j.materi && j.materi.toLowerCase().includes(q)) ||
				(j.mapel && j.mapel.toLowerCase().includes(q)) ||
				(j.kelas && j.kelas.toLowerCase().includes(q));

			return matchTanggal && matchKelas && matchGuru && matchStatus && matchSearch;
		});
	}, [journals, filterTanggal, filterKelas, filterGuru, filterStatus, searchQuery]);

	// Stats Highlights
	const stats = useMemo(() => {
		const total = journals.length;
		const tuntas = journals.filter((j) => j.tuntas).length;
		const belumTuntas = total - tuntas;
		const guruAktif = new Set(journals.map((j) => j.guru_id).filter(Boolean)).size;
		const persentaseTuntas = total > 0 ? Math.round((tuntas / total) * 100) : 0;
		const persentaseBelumTuntas = total > 0 ? Math.round((belumTuntas / total) * 100) : 0;
		return { total, tuntas, belumTuntas, guruAktif, persentaseTuntas, persentaseBelumTuntas };
	}, [journals]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredJournals.length / itemsPerPage));
	const paginatedJournals = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredJournals.slice(start, start + itemsPerPage);
	}, [filteredJournals, currentPage]);

	// Check if any filter is actively applied
	const isFilterActive =
		Boolean(searchQuery.trim()) ||
		Boolean(filterTanggal) ||
		filterKelas !== 'Semua' ||
		filterGuru !== 'Semua' ||
		filterStatus !== 'Semua';

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterTanggal('');
		setFilterKelas('Semua');
		setFilterGuru('Semua');
		setFilterStatus('Semua');
	};

	// Export to PDF with Kop Surat Resmi & Statistik Lengkap (Total Jurnal, Total Jam, Jumlah Guru, Mapel, Kelas, Distribusi Hari, Statistik Per Guru)
	const handleExportPDF = () => {
		if (filteredJournals.length === 0) {
			Swal.fire('Info', 'Tidak ada data jurnal untuk diekspor.', 'info');
			return;
		}

		try {
			const subInfo = `Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${filterKelas}  •  Filter Guru: ${filterGuru}`;
			exportJurnalPDFReport({
				journals: filteredJournals,
				schoolProfile,
				title: 'LAPORAN SUPERVISI JURNAL PEMBELAJARAN GURU (KBM)',
				subInfo,
				filename: `Supervisi_Jurnal_KBM_${new Date().toISOString().split('T')[0]}.pdf`,
			});
		} catch (err) {
			console.error('Gagal export PDF jurnal:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredJournals.length === 0) return;

		const headers = [
			'Tanggal',
			'Jam Ke',
			'Guru Pengajar',
			'Kelas',
			'Mata Pelajaran',
			'Pertemuan Ke',
			'Materi',
			'Status',
			'Kegiatan',
			'Kendala / Hambatan',
			'Solusi',
		];

		const rows = filteredJournals.map((j) => [
			j.tanggal || '',
			j.jam_ke || '',
			`"${(j.users?.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(j.kelas || '').replace(/"/g, '""')}"`,
			`"${(j.mapel || '').replace(/"/g, '""')}"`,
			j.pertemuan_ke || '',
			`"${(j.materi || '').replace(/"/g, '""')}"`,
			j.tuntas ? 'Tuntas' : 'Belum Tuntas',
			`"${(j.kegiatan || '').replace(/"/g, '""')}"`,
			`"${(j.hambatan || '').replace(/"/g, '""')}"`,
			`"${(j.solusi || '').replace(/"/g, '""')}"`,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`supervisi_jurnal_${new Date().toISOString().split('T')[0]}.csv`
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
			{/* Header Banner */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-indigo-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📖</span> Supervisi Akademik & KBM
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Monitoring Jurnal Mengajar Guru
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tinjau rekapitulasi keterisian materi, kedisiplinan jadwal harian, dan ketuntasan KBM seluruh dewan guru.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto flex-wrap'>
					<button
						onClick={handleExportPDF}
						disabled={filteredJournals.length === 0}
						title='Unduh rekapitulasi jurnal dalam format PDF dengan Kop Surat Resmi'
						className='px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={filteredJournals.length === 0}
						title='Unduh rekapitulasi saat ini dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-indigo-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-gray-500 block text-[10px] uppercase font-bold'>Periode Sistem</span>
						<span className='text-indigo-950 font-black text-xs sm:text-sm'>
							TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}
						</span>
					</div>
				</div>
			</div>

			{/* Stat Highlights Bar (Clickable as Quick Filters) */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				{/* Total Jurnal */}
				<button
					onClick={() => setFilterStatus('Semua')}
					className={`bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterStatus === 'Semua' ? 'ring-2 ring-indigo-500 bg-indigo-50/40' : ''
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Total Jurnal Masuk</p>
						<p className='text-2xl font-black text-black mt-0.5'>{stats.total}</p>
						<span className='text-[10px] font-bold text-gray-500'>Semua riwayat KBM</span>
					</div>
					<span className='w-11 h-11 bg-indigo-200 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📝
					</span>
				</button>

				{/* Target Tuntas */}
				<button
					onClick={() => setFilterStatus(filterStatus === 'Tuntas' ? 'Semua' : 'Tuntas')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterStatus === 'Tuntas'
							? 'bg-emerald-100 ring-2 ring-emerald-600'
							: 'bg-emerald-50 hover:bg-emerald-100/60'
					}`}>
					<div>
						<div className='flex items-center gap-1.5'>
							<p className='text-[11px] font-black uppercase text-emerald-800'>Target KBM Tuntas</p>
							<span className='text-[10px] font-black bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-400'>
								{stats.persentaseTuntas}%
							</span>
						</div>
						<p className='text-2xl font-black text-emerald-950 mt-0.5'>{stats.tuntas}</p>
						<span className='text-[10px] font-bold text-emerald-700'>
							{filterStatus === 'Tuntas' ? '✓ Filter aktif' : 'Klik filter tuntas'}
						</span>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						✅
					</span>
				</button>

				{/* Belum Tuntas */}
				<button
					onClick={() => setFilterStatus(filterStatus === 'Belum Tuntas' ? 'Semua' : 'Belum Tuntas')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterStatus === 'Belum Tuntas'
							? 'bg-orange-100 ring-2 ring-orange-600'
							: 'bg-orange-50 hover:bg-orange-100/60'
					}`}>
					<div>
						<div className='flex items-center gap-1.5'>
							<p className='text-[11px] font-black uppercase text-orange-800'>Belum Tuntas</p>
							<span className='text-[10px] font-black bg-orange-200 text-orange-900 px-1.5 py-0.2 rounded border border-orange-400'>
								{stats.persentaseBelumTuntas}%
							</span>
						</div>
						<p className='text-2xl font-black text-orange-950 mt-0.5'>{stats.belumTuntas}</p>
						<span className='text-[10px] font-bold text-orange-700'>
							{filterStatus === 'Belum Tuntas' ? '✓ Filter aktif' : 'Klik filter belum tuntas'}
						</span>
					</div>
					<span className='w-11 h-11 bg-orange-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						⚠️
					</span>
				</button>

				{/* Guru Telah Mengisi */}
				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Guru Telah Mengisi</p>
						<p className='text-2xl font-black text-yellow-950 mt-0.5'>
							{stats.guruAktif} <span className='text-sm text-yellow-800 font-bold'>/ {guruList.length} guru</span>
						</p>
						<span className='text-[10px] font-bold text-yellow-700'>Partisipasi dewan guru</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👨‍🏫
					</span>
				</div>
			</div>

			{/* Search & Multi Filter Box (Clean Structured Two-Tier Layout) */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Row 1: Search Input & Result Count + Reset Filter */}
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
							placeholder='Cari nama guru, materi ajar, mapel, atau kelas...'
							className='neo-input neo-input-with-icon !py-2.5 text-xs sm:text-sm !w-full'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								title='Hapus kata kunci'
								className='absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black font-black text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors'>
								✕
							</button>
						)}
					</div>

					<div className='flex items-center justify-between sm:justify-end gap-2 shrink-0'>
						<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-950 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							<span>📋</span>
							<span>
								{filteredJournals.length} Jurnal {filterTanggal ? `(${new Date(filterTanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})` : 'Ditemukan'}
							</span>
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

				{/* Row 2: 4 Dedicated Filter Dropdowns / Date in Structured Grid */}
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t-2 border-black/10'>
					{/* Filter Tanggal Harian */}
					<div className='space-y-1.5'>
						<div className='flex items-center justify-between'>
							<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
								<span>📅</span> Tanggal (Harian)
							</label>
							<button
								type='button'
								onClick={() => setFilterTanggal(filterTanggal === todayStr ? '' : todayStr)}
								className={`text-[10px] font-black px-2 py-0.5 rounded border transition-all cursor-pointer ${
									filterTanggal === todayStr
										? 'bg-indigo-600 text-white border-black'
										: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
								}`}>
								{filterTanggal === todayStr ? '✓ Hari Ini' : 'Hari Ini'}
							</button>
						</div>
						<div className='relative'>
							<input
								type='date'
								value={filterTanggal}
								onChange={(e) => setFilterTanggal(e.target.value)}
								className='neo-input !py-2 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'
							/>
							{filterTanggal && (
								<button
									type='button'
									onClick={() => setFilterTanggal('')}
									title='Hapus filter tanggal'
									className='absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-black font-black text-xs bg-gray-100 rounded-full transition-colors'>
									✕
								</button>
							)}
						</div>
					</div>

					{/* Filter Rombel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏫</span> Rombongan Belajar
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kelas ({kelasList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					{/* Filter Guru Pengajar */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>👨‍🏫</span> Dewan Guru Pengajar
						</label>
						<select
							value={filterGuru}
							onChange={(e) => setFilterGuru(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Guru Pengajar ({guruList.length})</option>
							{guruList.map((g) => (
								<option key={g.id_user} value={g.id_user}>
									{g.nama_lengkap}
								</option>
							))}
						</select>
					</div>

					{/* Filter Ketuntasan */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🎯</span> Status Ketercapaian
						</label>
						<select
							value={filterStatus}
							onChange={(e) => setFilterStatus(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Status KBM</option>
							<option value='Tuntas'>✅ Target KBM Tuntas</option>
							<option value='Belum Tuntas'>⚠️ Belum Tuntas</option>
						</select>
					</div>
				</div>
			</div>

			{/* Main Table Content */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-indigo-300 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Waktu & Jam</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pengajar</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Rombel & Mapel</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Materi Ajar</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider text-center'>Status</th>
								<th className='px-5 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedJournals.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-indigo-50/30'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>
												{filterTanggal
													? `Tidak ada jurnal mengajar pada tanggal ${new Date(filterTanggal).toLocaleDateString('id-ID', { dateStyle: 'full' })}`
													: 'Tidak ada riwayat jurnal yang sesuai filter'}
											</p>
											<p className='text-xs text-gray-500'>Coba ubah tanggal, kata kunci pencarian, atau reset filter untuk melihat semua data.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-indigo-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedJournals.map((j, idx) => (
									<tr
										key={j.id || idx}
										className='hover:bg-indigo-50/40 transition-colors'>
										{/* Tanggal & Jam */}
										<td className='px-5 py-4 whitespace-nowrap'>
											<div className='font-black text-xs sm:text-sm text-black'>
												{j.tanggal
													? new Date(j.tanggal).toLocaleDateString('id-ID', {
															day: 'numeric',
															month: 'short',
															year: 'numeric',
													  })
													: '-'}
											</div>
											<span className='inline-block text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-black/20 mt-1'>
												Jam Ke-{j.jam_ke || '-'}
											</span>
										</td>

										{/* Guru Pengajar */}
										<td className='px-5 py-4'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-indigo-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
													{j.users?.nama_lengkap ? j.users.nama_lengkap.charAt(0).toUpperCase() : 'G'}
												</div>
												<div className='min-w-0'>
													<p className='font-black text-xs sm:text-sm text-black truncate max-w-[160px] sm:max-w-xs'>
														{j.users?.nama_lengkap || 'Guru Terdaftar'}
													</p>
													<span className='font-mono text-[10px] text-gray-500'>
														@{j.users?.username || 'user'}
													</span>
												</div>
											</div>
										</td>

										{/* Kelas & Mapel */}
										<td className='px-5 py-4 whitespace-nowrap'>
											<div className='flex flex-col gap-1 items-start'>
												<span className='inline-block px-2.5 py-0.5 bg-yellow-200 text-black text-xs font-black rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{j.kelas}
												</span>
												<span className='text-xs font-bold text-gray-700'>
													{j.mapel}
												</span>
											</div>
										</td>

										{/* Materi */}
										<td className='px-5 py-4'>
											<p className='text-xs sm:text-sm font-bold text-black line-clamp-2 max-w-sm'>
												{j.materi || '-'}
											</p>
											<div className='flex flex-wrap items-center gap-1.5 mt-1'>
												{j.pertemuan_ke && (
													<span className='text-[10px] font-black text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-300'>
														Pertemuan Ke-{j.pertemuan_ke}
													</span>
												)}
												{j.hambatan && (
													<span className='text-[10px] font-black text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 flex items-center gap-0.5'>
														<span>⚠️</span> Ada Kendala
													</span>
												)}
											</div>
										</td>

										{/* Status Ketuntasan */}
										<td className='px-5 py-4 whitespace-nowrap text-center'>
											{j.tuntas ? (
												<span className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase rounded-lg bg-emerald-300 text-emerald-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>✅</span> Tuntas
												</span>
											) : (
												<span className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase rounded-lg bg-orange-300 text-orange-950 border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span>⚠️</span> Belum Tuntas
												</span>
											)}
										</td>

										{/* Action Button */}
										<td className='px-5 py-4 text-right whitespace-nowrap'>
											<button
												onClick={() => setSelectedJournal(j)}
												className='px-3 py-1.5 bg-white hover:bg-indigo-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
												🔍 Detail
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div className='px-5 py-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3'>
					<div className='text-xs font-bold text-gray-600'>
						Menampilkan <span className='font-black text-black'>{filteredJournals.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredJournals.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredJournals.length}</span> jurnal
					</div>

					{totalPages > 1 && (
						<div className='flex items-center gap-1.5'>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className='px-3 py-1.5 bg-white hover:bg-indigo-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
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
														? 'bg-indigo-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
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
								className='px-3 py-1.5 bg-white hover:bg-indigo-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								Next ▶
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Modal Inspeksi Detail Jurnal */}
			{selectedJournal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-indigo-300'>
							<div>
								<h3 className='text-base sm:text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
									<span>🔍</span>
									<span>Inspeksi Jurnal KBM Harian</span>
								</h3>
								<p className='text-xs font-bold text-gray-800'>
									{selectedJournal.users?.nama_lengkap || 'Guru'} &bull; {selectedJournal.kelas} &bull; {selectedJournal.mapel}
								</p>
							</div>
							<button
								onClick={() => setSelectedJournal(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
								✕
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-[var(--background)]'>
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
								<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Tanggal</span>
									<span className='font-black text-xs sm:text-sm text-black'>{selectedJournal.tanggal}</span>
								</div>
								<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Jam Ke-</span>
									<span className='font-black text-xs sm:text-sm text-black'>{selectedJournal.jam_ke || '-'}</span>
								</div>
								<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Pertemuan</span>
									<span className='font-black text-xs sm:text-sm text-black'>Ke-{selectedJournal.pertemuan_ke || '1'}</span>
								</div>
								<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Status Ketuntasan</span>
									<span className={`font-black text-xs sm:text-sm ${selectedJournal.tuntas ? 'text-emerald-700' : 'text-orange-700'}`}>
										{selectedJournal.tuntas ? '✅ TUNTAS' : '⚠️ BELUM TUNTAS'}
									</span>
								</div>
							</div>

							{/* Materi Pokok */}
							<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<h4 className='text-xs font-black uppercase tracking-wider text-indigo-900 mb-1 flex items-center gap-1.5'>
									<span>📝</span> Materi Pembelajaran
								</h4>
								<p className='text-sm font-bold text-black'>{selectedJournal.materi || '-'}</p>
							</div>

							{/* Kegiatan Pembelajaran */}
							<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<h4 className='text-xs font-black uppercase tracking-wider text-indigo-900 mb-1 flex items-center gap-1.5'>
									<span>📋</span> Kegiatan Pembelajaran
								</h4>
								<p className='text-xs sm:text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed'>
									{selectedJournal.kegiatan || 'Tidak ada deskripsi kegiatan.'}
								</p>
							</div>

							{/* Hambatan & Solusi */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div className='bg-rose-50 border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
									<h4 className='text-xs font-black uppercase tracking-wider text-rose-900 mb-1 flex items-center gap-1.5'>
										<span>⚠️</span> Hambatan / Kendala
									</h4>
									<p className='text-xs font-medium text-rose-950'>
										{selectedJournal.hambatan || 'Tidak ada hambatan yang dilaporkan.'}
									</p>
								</div>

								<div className='bg-emerald-50 border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
									<h4 className='text-xs font-black uppercase tracking-wider text-emerald-900 mb-1 flex items-center gap-1.5'>
										<span>💡</span> Solusi / Tindak Lanjut
									</h4>
									<p className='text-xs font-medium text-emerald-950'>
										{selectedJournal.solusi || 'Tidak ada catatan solusi.'}
									</p>
								</div>
							</div>

							{/* Footer Action */}
							<div className='pt-3 flex justify-end gap-2'>
								<button
									onClick={() => setSelectedJournal(null)}
									className='neo-btn-primary text-xs sm:text-sm !py-2 !px-5 bg-black text-white cursor-pointer'>
									Tutup Inspeksi
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
