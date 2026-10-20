'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import { DEFAULT_PROFIL_SEKOLAH, fetchSchoolProfile } from '@/lib/pdfKopSurat';
import { exportJurnalPDFReport, getJPFromJamKe } from '@/lib/pdfJurnalReport';
import { getTodayDateString } from '@/lib/dateUtils';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export default function KurikulumJurnalPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [journals, setJournals] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	// Filter state
	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterGuru, setFilterGuru] = useState('Semua');
	const [filterStatus, setFilterStatus] = useState('Semua');
	const [filterTanggal, setFilterTanggal] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedJournal, setSelectedJournal] = useState(null);

	// Tab Tampilan Laporan & Supervisi
	// 'rincian' = Tabel Detail Jurnal
	// 'distribusi' = Bagian A. Distribusi Hari Mengajar
	// 'kinerja' = Bagian B. Statistik Kinerja Mengajar Per Guru
	const [activeTab, setActiveTab] = useState('rincian');

	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	const todayStr = useMemo(() => getTodayDateString(), []);

	useEffect(() => {
		const fetchJurnalData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resJurnal, resGuru, resKelas, prof] = await Promise.all([
					supabase
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.order('tanggal', { ascending: false }),
					supabase.from('users').select('id_user, nama_lengkap, username').eq('role', 'Guru'),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
				]);

				setJournals(resJurnal.data || []);
				setGuruList(resGuru.data || []);
				setKelasList(resKelas.data || []);
				if (prof) setSchoolProfile(prof);
			} catch (err) {
				console.error('Error fetching jurnal:', err);
				Swal.fire('Terjadi Kesalahan', 'Gagal memuat rekam jurnal KBM.', 'error');
			} finally {
				setLoading(false);
			}
		};

		fetchJurnalData();
	}, []);

	// Reset pagination on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterGuru, filterStatus, filterTanggal, searchQuery]);

	// Filter Journals
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			const matchKelas = filterKelas === 'Semua' || j.kelas === filterKelas;
			const matchGuru = filterGuru === 'Semua' || j.guru_id === filterGuru;
			const isTuntas = j.tuntas === true || j.tuntas === 'Tuntas' || j.tuntas === 'Ya';
			const matchStatus =
				filterStatus === 'Semua' ||
				(filterStatus === 'Tuntas' && isTuntas) ||
				(filterStatus === 'Belum' && !isTuntas);
			const matchTanggal = !filterTanggal || j.tanggal === filterTanggal;
			const q = searchQuery.toLowerCase().trim();
			const matchQuery =
				!q ||
				(j.materi && j.materi.toLowerCase().includes(q)) ||
				(j.mapel && j.mapel.toLowerCase().includes(q)) ||
				(j.kelas && j.kelas.toLowerCase().includes(q)) ||
				(j.users?.nama_lengkap && j.users.nama_lengkap.toLowerCase().includes(q));

			return matchKelas && matchGuru && matchStatus && matchTanggal && matchQuery;
		});
	}, [journals, filterKelas, filterGuru, filterStatus, filterTanggal, searchQuery]);

	// =========================================================================
	// STATISTIK LAPORAN (KPI CARDS, DISTRIBUSI HARI, KINERJA PER GURU)
	// =========================================================================
	const reportStats = useMemo(() => {
		const totalJurnal = filteredJournals.length;
		let totalJam = 0;
		const guruMap = new Map();
		const mapelSet = new Set();
		const kelasSet = new Set();
		let tuntasCount = 0;

		const hariStats = {
			1: { nama: 'Senin', count: 0, jp: 0 },
			2: { nama: 'Selasa', count: 0, jp: 0 },
			3: { nama: 'Rabu', count: 0, jp: 0 },
			4: { nama: 'Kamis', count: 0, jp: 0 },
			5: { nama: 'Jumat', count: 0, jp: 0 },
			6: { nama: 'Sabtu', count: 0, jp: 0 },
			0: { nama: 'Minggu', count: 0, jp: 0 },
		};

		filteredJournals.forEach((j) => {
			const jp = getJPFromJamKe(j.jam_ke);
			totalJam += jp;

			if (j.mapel) mapelSet.add(String(j.mapel).trim());
			if (j.kelas) kelasSet.add(String(j.kelas).trim());
			const isTuntas = j.tuntas === true || j.tuntas === 'Tuntas' || j.tuntas === 'Ya';
			if (isTuntas) tuntasCount += 1;

			if (j.tanggal) {
				const dayIndex = new Date(`${String(j.tanggal).slice(0, 10)}T00:00:00`).getDay();
				if (hariStats[dayIndex] !== undefined) {
					hariStats[dayIndex].count += 1;
					hariStats[dayIndex].jp += jp;
				}
			}

			const guruKey = j.guru_id || j.users?.nama_lengkap || 'guru_unknown';
			const guruNama = j.users?.nama_lengkap || j.nama_guru || 'Guru Pengajar';
			if (!guruMap.has(guruKey)) {
				guruMap.set(guruKey, {
					id: guruKey,
					nama: guruNama,
					username: j.users?.username || '',
					totalJurnal: 0,
					totalJP: 0,
					mapelSet: new Set(),
					kelasSet: new Set(),
					tuntasCount: 0,
				});
			}
			const g = guruMap.get(guruKey);
			g.totalJurnal += 1;
			g.totalJP += jp;
			if (j.mapel) g.mapelSet.add(String(j.mapel).trim());
			if (j.kelas) g.kelasSet.add(String(j.kelas).trim());
			if (isTuntas) g.tuntasCount += 1;
		});

		const totalGuru = guruMap.size;
		const persentaseTuntas = totalJurnal > 0 ? Math.round((tuntasCount / totalJurnal) * 100) : 0;
		const guruPerformanceList = Array.from(guruMap.values()).sort(
			(a, b) => b.totalJP - a.totalJP || b.totalJurnal - a.totalJurnal
		);

		return {
			totalJurnal,
			totalJam,
			totalGuru,
			jumlahMapel: mapelSet.size,
			jumlahKelas: kelasSet.size,
			tuntasCount,
			persentaseTuntas,
			hariStats,
			guruPerformanceList,
		};
	}, [filteredJournals]);

	// Pagination Data
	const totalPages = Math.max(1, Math.ceil(filteredJournals.length / itemsPerPage));
	const paginatedJournals = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredJournals.slice(start, start + itemsPerPage);
	}, [filteredJournals, currentPage]);

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

	// =========================================================================
	// EKSPOR PDF LAPORAN SUPERVISI JURNAL LENGKAP
	// =========================================================================
	const handleExportPDF = () => {
		if (filteredJournals.length === 0) {
			Swal.fire('Info', 'Tidak ada data jurnal untuk diekspor.', 'info');
			return;
		}

		try {
			const namaGuruFilter = guruList.find((g) => g.id_user === filterGuru)?.nama_lengkap || filterGuru;
			const subInfo = `Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${filterKelas}  •  Filter Guru: ${namaGuruFilter}`;
			
			exportJurnalPDFReport({
				journals: filteredJournals,
				schoolProfile,
				title: 'LAPORAN SUPERVISI JURNAL PEMBELAJARAN GURU (KBM)',
				subInfo,
				filename: `Laporan_Supervisi_Jurnal_Kurikulum_${getTodayDateString()}.pdf`,
			});

			Swal.fire({
				title: 'Berhasil Ekspor PDF!',
				text: 'Laporan supervisi jurnal KBM lengkap dengan statistik hari dan kinerja guru berhasil diunduh.',
				icon: 'success',
				confirmButtonColor: '#F59E0B',
			});
		} catch (err) {
			console.error('PDF error:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Ekspor CSV
	const handleExportCSV = () => {
		if (filteredJournals.length === 0) {
			Swal.fire('Info', 'Tidak ada data jurnal untuk diekspor.', 'info');
			return;
		}

		const headers = [
			'No',
			'Tanggal',
			'Jam Ke',
			'Guru Pengajar',
			'Username',
			'Kelas',
			'Mapel',
			'Pertemuan Ke',
			'Metode Pembelajaran',
			'Materi Pokok',
			'Kegiatan Pembelajaran',
			'Hambatan / Kendala',
			'Solusi',
			'Status Ketuntasan',
		];

		const rows = filteredJournals.map((j, idx) => [
			idx + 1,
			j.tanggal || '',
			j.jam_ke || '',
			`"${(j.users?.nama_lengkap || j.nama_guru || '').replace(/"/g, '""')}"`,
			`"${(j.users?.username || '').replace(/"/g, '""')}"`,
			`"${(j.kelas || '').replace(/"/g, '""')}"`,
			`"${(j.mapel || '').replace(/"/g, '""')}"`,
			j.pertemuan_ke || '',
			`"${(j.metode || 'Ceramah').replace(/"/g, '""')}"`,
			`"${(j.materi || '').replace(/"/g, '""')}"`,
			`"${(j.kegiatan || '').replace(/"/g, '""')}"`,
			`"${(j.hambatan || '').replace(/"/g, '""')}"`,
			`"${(j.solusi || '').replace(/"/g, '""')}"`,
			j.tuntas ? 'Tuntas' : 'Belum Tuntas',
		]);

		const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `Rekap_Jurnal_Kurikulum_${getTodayDateString()}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	if (loading) return <Loader text='Memuat Laporan & Supervisi Jurnal KBM...' />;

	return (
		<div className='space-y-6 pb-12'>
			{/* HEADER BANNER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded'>
							Supervisi & Evaluasi Kurikulum
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>📖</span> Laporan & Supervisi Jurnal KBM
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl leading-relaxed'>
						Monitoring rekapitulasi keterisian materi pembelajaran, alokasi jam mengajar (JP), distribusi hari, serta tingkat ketuntasan KBM dewan guru.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-2.5 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={handleExportPDF}
						disabled={filteredJournals.length === 0}
						className='px-4 py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span> Ekspor PDF Laporan
					</button>
					<button
						onClick={handleExportCSV}
						disabled={filteredJournals.length === 0}
						className='px-3.5 py-2.5 bg-white text-black hover:bg-amber-100 disabled:opacity-50 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span> CSV
					</button>
				</div>
			</div>

			{/* ========================================================================= */}
			{/* 6 RINGKASAN EKSEKUTIF KPI (PERSIS SEPERTI LAPORAN KEPSEK/JURNAL) */}
			{/* ========================================================================= */}
			<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
				{/* TOTAL JURNAL */}
				<div className='bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-gray-500 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>TOTAL JURNAL</span>
						<span className='text-sm'>📝</span>
					</div>
					<p className='text-2xl font-black text-black'>{reportStats.totalJurnal}</p>
					<p className='text-[10px] font-bold text-gray-500 mt-0.5'>Sesi Pembelajaran</p>
				</div>

				{/* TOTAL JAM (JP) */}
				<div className='bg-indigo-50 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-indigo-800 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>TOTAL JAM (JP)</span>
						<span className='text-sm'>⏱️</span>
					</div>
					<p className='text-2xl font-black text-indigo-950'>{reportStats.totalJam}</p>
					<p className='text-[10px] font-bold text-indigo-700 mt-0.5'>Jam Pelajaran</p>
				</div>

				{/* JUMLAH GURU */}
				<div className='bg-yellow-50 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-yellow-800 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>JUMLAH GURU</span>
						<span className='text-sm'>👨‍🏫</span>
					</div>
					<p className='text-2xl font-black text-yellow-950'>
						{reportStats.totalGuru}{' '}
						<span className='text-xs font-bold text-yellow-800'>/ {guruList.length}</span>
					</p>
					<p className='text-[10px] font-bold text-yellow-700 mt-0.5'>Tenaga Pendidik</p>
				</div>

				{/* JUMLAH MAPEL */}
				<div className='bg-sky-50 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-sky-800 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>JUMLAH MAPEL</span>
						<span className='text-sm'>📚</span>
					</div>
					<p className='text-2xl font-black text-sky-950'>{reportStats.jumlahMapel}</p>
					<p className='text-[10px] font-bold text-sky-700 mt-0.5'>Mata Pelajaran</p>
				</div>

				{/* JUMLAH KELAS */}
				<div className='bg-emerald-50 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-emerald-800 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>JUMLAH KELAS</span>
						<span className='text-sm'>🏫</span>
					</div>
					<p className='text-2xl font-black text-emerald-950'>{reportStats.jumlahKelas}</p>
					<p className='text-[10px] font-bold text-emerald-700 mt-0.5'>Rombel Kelas</p>
				</div>

				{/* KETUNTASAN KBM */}
				<div className='bg-rose-50 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between text-rose-800 mb-1'>
						<span className='text-[10px] font-black uppercase tracking-wider'>KETUNTASAN KBM</span>
						<span className='text-sm'>🎯</span>
					</div>
					<p className='text-2xl font-black text-rose-950'>{reportStats.persentaseTuntas}%</p>
					<p className='text-[10px] font-bold text-rose-700 mt-0.5'>
						{reportStats.tuntasCount} / {reportStats.totalJurnal} Sesi Tuntas
					</p>
				</div>
			</div>

			{/* ========================================================================= */}
			{/* NAVIGASI TAB: RINCIAN JURNAL | DISTRIBUSI HARI | KINERJA PER GURU */}
			{/* ========================================================================= */}
			<div className='flex flex-wrap items-center gap-2 border-b-2 border-black pb-1'>
				<button
					onClick={() => setActiveTab('rincian')}
					className={`px-4 py-2 border-2 border-black rounded-xl font-black text-xs uppercase transition-all cursor-pointer flex items-center gap-2 ${
						activeTab === 'rincian'
							? 'bg-amber-300 text-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-gray-700 hover:bg-gray-100 shadow-[1px_1px_0px_0px_#0D0D0D]'
					}`}>
					<span>📋</span> Rincian Catatan Jurnal ({filteredJournals.length})
				</button>

				<button
					onClick={() => setActiveTab('distribusi')}
					className={`px-4 py-2 border-2 border-black rounded-xl font-black text-xs uppercase transition-all cursor-pointer flex items-center gap-2 ${
						activeTab === 'distribusi'
							? 'bg-amber-300 text-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-gray-700 hover:bg-gray-100 shadow-[1px_1px_0px_0px_#0D0D0D]'
					}`}>
					<span>📅</span> A. Distribusi Hari Mengajar
				</button>

				<button
					onClick={() => setActiveTab('kinerja')}
					className={`px-4 py-2 border-2 border-black rounded-xl font-black text-xs uppercase transition-all cursor-pointer flex items-center gap-2 ${
						activeTab === 'kinerja'
							? 'bg-amber-300 text-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-gray-700 hover:bg-gray-100 shadow-[1px_1px_0px_0px_#0D0D0D]'
					}`}>
					<span>👨‍🏫</span> B. Statistik Kinerja Mengajar Per Guru ({reportStats.totalGuru})
				</button>
			</div>

			{/* ========================================================================= */}
			{/* KONTEN TAB 1: RINCIAN CATATAN JURNAL PEMBELAJARAN (KBM) */}
			{/* ========================================================================= */}
			{activeTab === 'rincian' && (
				<div className='space-y-4'>
					{/* MULTI FILTER BOX */}
					<div className='bg-white border-3 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
							<div>
								<label className='block text-[11px] font-black uppercase text-gray-600 mb-1'>
									Cari Materi / Guru / Mapel
								</label>
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder='Ketik nama guru, materi, mapel...'
									className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'
								/>
							</div>

							<div>
								<div className='flex items-center justify-between mb-1'>
									<label className='text-[11px] font-black uppercase text-gray-600'>Tanggal Mengajar</label>
									<button
										type='button'
										onClick={() => setFilterTanggal(filterTanggal === todayStr ? '' : todayStr)}
										className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
											filterTanggal === todayStr
												? 'bg-amber-300 text-black border-black'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-400'
										}`}>
										{filterTanggal === todayStr ? '✓ Hari Ini' : 'Hari Ini'}
									</button>
								</div>
								<input
									type='date'
									value={filterTanggal}
									onChange={(e) => setFilterTanggal(e.target.value)}
									className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'
								/>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-600 mb-1'>Rombel Kelas</label>
								<select
									value={filterKelas}
									onChange={(e) => setFilterKelas(e.target.value)}
									className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'>
									<option value='Semua'>Semua Kelas ({kelasList.length})</option>
									{kelasList.map((k) => (
										<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
											{k.nama_kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-600 mb-1'>Guru Pengampu</label>
								<select
									value={filterGuru}
									onChange={(e) => setFilterGuru(e.target.value)}
									className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'>
									<option value='Semua'>Semua Dewan Guru ({guruList.length})</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap}
										</option>
									))}
								</select>
							</div>
						</div>

						{isFilterActive && (
							<div className='flex items-center justify-between pt-2 border-t border-gray-200'>
								<span className='text-xs font-bold text-gray-500'>
									Menampilkan {filteredJournals.length} dari total {journals.length} entri jurnal KBM
								</span>
								<button
									onClick={handleResetFilters}
									className='text-xs font-black text-rose-600 hover:underline cursor-pointer'>
									✕ Reset Semua Filter
								</button>
							</div>
						)}
					</div>

					{/* TABEL DETAIL RINCIAN JURNAL KBM */}
					<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>📋</span> C. Rincian Catatan Jurnal Pembelajaran Guru ({filteredJournals.length})
							</h2>
							<span className='text-xs font-black px-2.5 py-1 bg-yellow-200 border border-black rounded-lg'>
								Halaman {currentPage} dari {totalPages}
							</span>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse'>
								<thead>
									<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
										<th className='py-3 px-3 w-12 text-center'>No</th>
										<th className='py-3 px-3'>Tanggal / Jam</th>
										<th className='py-3 px-3'>Guru Pengampu</th>
										<th className='py-3 px-3'>Rombel & Mapel</th>
										<th className='py-3 px-3'>Materi Pembelajaran</th>
										<th className='py-3 px-3 text-center'>Status</th>
										<th className='py-3 px-3 text-right'>Aksi</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
									{paginatedJournals.length === 0 ? (
										<tr>
											<td colSpan={7} className='text-center py-10 text-gray-500'>
												<div className='flex flex-col items-center gap-2'>
													<span className='text-3xl'>🔍</span>
													<p className='text-sm font-black text-black'>Tidak ada entri jurnal yang cocok dengan filter.</p>
													<p className='text-xs text-gray-500'>Ubah kata kunci pencarian atau reset filter untuk melihat semua data.</p>
												</div>
											</td>
										</tr>
									) : (
										paginatedJournals.map((j, idx) => (
											<tr key={j.id || idx} className='hover:bg-amber-50/60 transition-colors'>
												<td className='py-3 px-3 text-center font-mono font-bold text-gray-500'>
													{(currentPage - 1) * itemsPerPage + idx + 1}
												</td>
												<td className='py-3 px-3'>
													<span className='font-black text-black block'>
														{j.tanggal
															? new Date(j.tanggal).toLocaleDateString('id-ID', {
																	day: 'numeric',
																	month: 'short',
																	year: 'numeric',
															  })
															: '-'}
													</span>
													<span className='text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 inline-block mt-0.5'>
														Jam ke-{j.jam_ke || '-'} ({getJPFromJamKe(j.jam_ke)} JP)
													</span>
												</td>
												<td className='py-3 px-3'>
													<span className='font-black text-black block'>{j.users?.nama_lengkap || 'Guru Pengajar'}</span>
													<span className='text-[10px] text-gray-500 font-mono'>@{j.users?.username || 'user'}</span>
												</td>
												<td className='py-3 px-3'>
													<div className='flex flex-wrap items-center gap-1'>
														<span className='px-2 py-0.5 bg-sky-100 border border-sky-400 rounded text-sky-950 font-black text-[11px]'>
															{j.kelas}
														</span>
														<span className='px-2 py-0.5 bg-amber-100 border border-amber-400 rounded text-amber-950 font-black text-[11px]'>
															{j.mapel}
														</span>
														{j.pertemuan_ke && (
															<span className='px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-bold text-[10px]'>
																Pert. {j.pertemuan_ke}
															</span>
														)}
													</div>
												</td>
												<td className='py-3 px-3 max-w-xs'>
													<p className='font-bold text-gray-900'>{j.materi || '-'}</p>
													{j.metode && (
														<span className='inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-400 rounded text-[10px] font-black mt-1'>
															<span>🎯</span>
															<span>{j.metode}</span>
														</span>
													)}
													{j.hambatan && (
														<p className='text-[10px] text-rose-700 truncate mt-0.5 font-bold'>
															Kendala: {j.hambatan}
														</p>
													)}
												</td>
												<td className='py-3 px-3 text-center'>
													<span
														className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${
															j.tuntas
																? 'bg-emerald-100 text-emerald-950 border-emerald-500'
																: 'bg-amber-100 text-amber-950 border-amber-500'
														}`}>
														{j.tuntas ? '✓ Tuntas' : '⚠️ Belum'}
													</span>
												</td>
												<td className='py-3 px-3 text-right'>
													<button
														onClick={() => setSelectedJournal(j)}
														className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
														Detail
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* PAGINATION CONTROLS */}
						{totalPages > 1 && (
							<div className='flex items-center justify-between pt-3 border-t-2 border-black/10 text-xs font-bold'>
								<span className='text-gray-500'>
									Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
									{Math.min(currentPage * itemsPerPage, filteredJournals.length)} dari {filteredJournals.length} data
								</span>
								<div className='flex items-center gap-1.5'>
									<button
										disabled={currentPage === 1}
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										className='px-3 py-1.5 border-2 border-black rounded-lg bg-white disabled:opacity-40 font-black cursor-pointer disabled:cursor-not-allowed hover:bg-gray-100 shadow-[1px_1px_0px_0px_#0D0D0D]'>
										&larr; Sebelumnya
									</button>
									<span className='px-3 py-1.5 bg-yellow-100 border border-black rounded-lg font-black'>
										{currentPage} / {totalPages}
									</span>
									<button
										disabled={currentPage === totalPages}
										onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
										className='px-3 py-1.5 border-2 border-black rounded-lg bg-white disabled:opacity-40 font-black cursor-pointer disabled:cursor-not-allowed hover:bg-gray-100 shadow-[1px_1px_0px_0px_#0D0D0D]'>
										Berikutnya &rarr;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* KONTEN TAB 2: A. DISTRIBUSI HARI MENGAJAR */}
			{/* ========================================================================= */}
			{activeTab === 'distribusi' && (
				<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center justify-between border-b-2 border-black pb-3'>
						<div>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>📅</span> A. Distribusi Hari Mengajar
							</h2>
							<p className='text-xs font-bold text-gray-500 mt-0.5'>
								Sebaran pelaksanaan sesi KBM dan akumulasi Jam Pelajaran (JP) dari hari Senin hingga Sabtu
							</p>
						</div>
						<span className='text-xs font-black px-3 py-1 bg-indigo-100 text-indigo-950 border border-black rounded-lg'>
							Total: {reportStats.totalJam} JP ({reportStats.totalJurnal} Sesi)
						</span>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-slate-800 text-[11px] font-black uppercase text-white'>
									<th className='py-3 px-3 text-center w-14'>No</th>
									<th className='py-3 px-4'>Hari Mengajar</th>
									<th className='py-3 px-4 text-center'>Jumlah Jurnal / Sesi</th>
									<th className='py-3 px-4 text-center'>Total Jam Pelajaran (JP)</th>
									<th className='py-3 px-4 text-center w-36'>Porsi Jam (%)</th>
									<th className='py-3 px-4'>Visual Proporsi Jam</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{(() => {
									const effectiveHariList = [1, 2, 3, 4, 6, 0];
									if (reportStats.hariStats[5]?.count > 0) effectiveHariList.push(5);
									return effectiveHariList.map((dayIdx, idx) => {
										const h = reportStats.hariStats[dayIdx] || { nama: '-', count: 0, jp: 0 };
										const porsi =
											reportStats.totalJam > 0
												? ((h.jp / reportStats.totalJam) * 100).toFixed(1)
												: '0.0';
										return (
											<tr key={dayIdx} className='hover:bg-amber-50/60 transition-colors'>
												<td className='py-3 px-3 text-center font-mono font-bold border-r border-gray-200'>
													{idx + 1}
												</td>
												<td className='py-3 px-4 font-black text-black border-r border-gray-200'>
													{h.nama}
												</td>
												<td className='py-3 px-4 text-center border-r border-gray-200 font-mono'>
													<span className='px-2.5 py-1 bg-gray-100 border border-gray-300 rounded font-black text-xs'>
														{h.count} Sesi
													</span>
												</td>
												<td className='py-3 px-4 text-center border-r border-gray-200 font-mono'>
													<span className='px-3 py-1 bg-indigo-100 text-indigo-950 border border-indigo-300 rounded-lg font-black text-xs'>
														{h.jp} JP
													</span>
												</td>
												<td className='py-3 px-4 text-center border-r border-gray-200 font-mono font-black text-black'>
													{porsi}%
												</td>
												<td className='py-3 px-4'>
													<div className='w-full bg-gray-100 rounded-full h-3 border border-gray-300 overflow-hidden'>
														<div
															className='bg-indigo-600 h-3 rounded-full transition-all'
															style={{ width: `${Math.min(100, Math.max(0, parseFloat(porsi)))}%` }}></div>
													</div>
												</td>
											</tr>
										);
									});
								})()}
								{/* Baris Total Akumulatif */}
								<tr className='bg-amber-100/80 border-t-2 border-black font-black text-black text-xs'>
									<td className='py-3.5 px-3 text-center font-bold'>-</td>
									<td className='py-3.5 px-4 uppercase tracking-wider'>TOTAL KESELURUHAN</td>
									<td className='py-3.5 px-4 text-center font-mono'>{reportStats.totalJurnal} Sesi</td>
									<td className='py-3.5 px-4 text-center font-mono text-sm text-indigo-950'>{reportStats.totalJam} JP</td>
									<td className='py-3.5 px-4 text-center font-mono'>100.0%</td>
									<td className='py-3.5 px-4'>
										<div className='w-full bg-indigo-600 rounded-full h-3'></div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* KONTEN TAB 3: B. STATISTIK KINERJA MENGAJAR PER GURU */}
			{/* ========================================================================= */}
			{activeTab === 'kinerja' && (
				<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center justify-between border-b-2 border-black pb-3'>
						<div>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>👨‍🏫</span> B. Statistik Kinerja Mengajar Per Guru ({reportStats.guruPerformanceList.length})
							</h2>
							<p className='text-xs font-bold text-gray-500 mt-0.5'>
								Akumulasi beban jam mengajar (JP), jumlah sesi jurnal, mata pelajaran diampu, serta tingkat ketuntasan KBM
							</p>
						</div>
						<button
							onClick={handleExportPDF}
							className='px-3 py-1.5 bg-black text-white rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-neutral-800'>
							<span>📄</span> Cetak PDF
						</button>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-cyan-800 text-[11px] font-black uppercase text-white'>
									<th className='py-3 px-3 text-center w-12'>No</th>
									<th className='py-3 px-4'>Nama Guru Pengajar</th>
									<th className='py-3 px-3 text-center'>Total Jurnal</th>
									<th className='py-3 px-3 text-center'>Total Jam (JP)</th>
									<th className='py-3 px-4'>Mata Pelajaran</th>
									<th className='py-3 px-4'>Kelas / Rombel</th>
									<th className='py-3 px-4 text-center'>Ketuntasan KBM</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{reportStats.guruPerformanceList.length === 0 ? (
									<tr>
										<td colSpan={7} className='text-center py-8 text-gray-500'>
											Belum ada data kinerja guru yang tercatat.
										</td>
									</tr>
								) : (
									reportStats.guruPerformanceList.map((g, idx) => {
										const persen =
											g.totalJurnal > 0
												? Math.round((g.tuntasCount / g.totalJurnal) * 100)
												: 0;
										const mapels = Array.from(g.mapelSet).join(', ');
										const kelases = Array.from(g.kelasSet).sort().join(', ');

										return (
											<tr key={g.id || idx} className='hover:bg-amber-50/60 transition-colors'>
												<td className='py-3 px-3 text-center font-mono font-bold border-r border-gray-200'>
													{idx + 1}
												</td>
												<td className='py-3 px-4 border-r border-gray-200'>
													<span className='font-black text-black text-sm block'>{g.nama}</span>
													{g.username && (
														<span className='text-[10px] text-gray-500 font-mono'>@{g.username}</span>
													)}
												</td>
												<td className='py-3 px-3 text-center border-r border-gray-200 font-mono'>
													<span className='px-2.5 py-1 bg-gray-100 border border-gray-300 rounded font-black'>
														{g.totalJurnal} Sesi
													</span>
												</td>
												<td className='py-3 px-3 text-center border-r border-gray-200 font-mono'>
													<span className='px-3 py-1 bg-cyan-100 text-cyan-950 border border-cyan-400 rounded-lg font-black text-xs'>
														{g.totalJP} JP
													</span>
												</td>
												<td className='py-3 px-4 border-r border-gray-200'>
													<span className='text-xs font-bold text-gray-800 line-clamp-2'>
														{mapels || '-'}
													</span>
												</td>
												<td className='py-3 px-4 border-r border-gray-200'>
													<span className='text-xs font-bold text-gray-800'>
														{kelases || '-'}
													</span>
												</td>
												<td className='py-3 px-4 text-center'>
													<div className='flex items-center justify-center gap-1.5'>
														<span
															className={`px-2 py-0.5 rounded font-black text-xs font-mono border ${
																persen >= 85
																	? 'bg-emerald-100 text-emerald-950 border-emerald-400'
																	: persen >= 65
																	? 'bg-amber-100 text-amber-950 border-amber-400'
																	: 'bg-rose-100 text-rose-950 border-rose-400'
															}`}>
															{persen}%
														</span>
														<span className='text-[10px] text-gray-500 font-bold'>
															({g.tuntasCount}/{g.totalJurnal})
														</span>
													</div>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* MODAL DETAIL SUPERVISI JURNAL */}
			{/* ========================================================================= */}
			{selectedJournal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<h3 className='text-lg font-black flex items-center gap-2'>
									<span>🔍</span> Detail Supervisi Jurnal KBM
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									{selectedJournal.tanggal} &bull; Jam ke-{selectedJournal.jam_ke} ({getJPFromJamKe(selectedJournal.jam_ke)} JP)
								</p>
							</div>
							<button
								onClick={() => setSelectedJournal(null)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black cursor-pointer'>
								✕
							</button>
						</div>

						<div className='space-y-3 text-xs'>
							<div className='grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-black/20'>
								<div>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Guru Pengajar</span>
									<span className='font-black text-black text-sm'>{selectedJournal.users?.nama_lengkap}</span>
								</div>
								<div>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Rombel & Mapel</span>
									<span className='font-black text-black text-sm'>
										{selectedJournal.kelas} - {selectedJournal.mapel}
									</span>
								</div>
							</div>

							<div>
								<span className='text-[11px] font-black uppercase text-black block mb-1'>Materi Pembelajaran:</span>
								<div className='p-3 bg-gray-50 border border-black/20 rounded-xl font-bold text-gray-800 whitespace-pre-wrap'>
									{selectedJournal.materi || 'Tidak dicatat.'}
								</div>
							</div>

							{selectedJournal.metode && (
								<div>
									<span className='text-[11px] font-black uppercase text-purple-900 block mb-1'>Metode Pembelajaran:</span>
									<div className='p-2.5 bg-purple-50 border border-purple-300 rounded-xl font-black text-purple-950 text-xs flex items-center gap-1.5'>
										<span>🎯</span>
										<span>{selectedJournal.metode}</span>
									</div>
								</div>
							)}

							<div>
								<span className='text-[11px] font-black uppercase text-black block mb-1'>Kegiatan Pembelajaran:</span>
								<div className='p-3 bg-gray-50 border border-black/20 rounded-xl font-bold text-gray-800 whitespace-pre-wrap'>
									{selectedJournal.kegiatan || 'Tidak dicatat.'}
								</div>
							</div>

							{selectedJournal.hambatan && (
								<div>
									<span className='text-[11px] font-black uppercase text-rose-800 block mb-1'>Hambatan / Kendala KBM:</span>
									<div className='p-3 bg-rose-50 border border-rose-300 rounded-xl font-bold text-rose-950 whitespace-pre-wrap'>
										{selectedJournal.hambatan}
									</div>
								</div>
							)}

							{selectedJournal.solusi && (
								<div>
									<span className='text-[11px] font-black uppercase text-emerald-800 block mb-1'>Solusi / Tindak Lanjut:</span>
									<div className='p-3 bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-emerald-950 whitespace-pre-wrap'>
										{selectedJournal.solusi}
									</div>
								</div>
							)}

							<div className='pt-2 flex items-center justify-between border-t border-gray-200'>
								<span className='text-[11px] font-black text-gray-600'>Status Ketercapaian:</span>
								<span
									className={`px-3 py-1 rounded-lg text-xs font-black uppercase border ${
										selectedJournal.tuntas
											? 'bg-emerald-100 text-emerald-950 border-emerald-400'
											: 'bg-amber-100 text-amber-950 border-amber-400'
									}`}>
									{selectedJournal.tuntas ? '✓ Target KBM Tuntas' : '⚠️ Belum Tuntas / Remedial'}
								</span>
							</div>
						</div>

						<div className='pt-3 border-t-2 border-black flex justify-end'>
							<button
								onClick={() => setSelectedJournal(null)}
								className='px-4 py-2 bg-black text-white rounded-xl font-black text-xs hover:bg-neutral-800 cursor-pointer'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
