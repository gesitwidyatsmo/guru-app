'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';
import { normStatus } from '@/lib/absensiUtils';
import { getTimeWIB } from '@/lib/kbmRealtimeUtils';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
	fetchSchoolProfile,
} from '@/lib/pdfKopSurat';

export default function KurikulumAbsensiMapelPage() {
	const { role, nama } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [sessions, setSessions] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterMapel, setFilterMapel] = useState('Semua');
	const [filterTanggal, setFilterTanggal] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedSession, setSelectedSession] = useState(null);

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	useEffect(() => {
		const fetchAbsensiData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resSesi, resKelas, resMapel, pProfile] = await Promise.all([
					supabase
						.from('absensi_mapel')
						.select('*, users!absensi_mapel_guru_id_fkey(nama_lengkap, username), absensi_mapel_siswa(id, status, keterangan, siswa_id, siswa(nama_lengkap, nis))')
						.order('tanggal', { ascending: false }),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
					fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
				]);

				setSessions(resSesi.data || []);
				setKelasList(resKelas.data || []);
				setMapelList(resMapel.data || []);
				if (pProfile) setSchoolProfile(pProfile);
			} catch (err) {
				console.error('Gagal memuat data presensi mapel kurikulum:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchAbsensiData();
	}, []);

	// Reset pagination saat filter berubah
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterMapel, filterTanggal, searchQuery]);

	// Filter data
	const filteredSessions = useMemo(() => {
		return sessions.filter((s) => {
			const matchKelas = filterKelas === 'Semua' || s.kelas === filterKelas;
			const matchMapel = filterMapel === 'Semua' || s.mapel === filterMapel;
			const matchTgl = !filterTanggal || s.tanggal === filterTanggal;

			const q = searchQuery.toLowerCase().trim();
			const guruName = s.users?.nama_lengkap?.toLowerCase() || '';
			const matchSearch =
				!q ||
				guruName.includes(q) ||
				(s.mapel && s.mapel.toLowerCase().includes(q)) ||
				(s.kelas && s.kelas.toLowerCase().includes(q));

			return matchKelas && matchMapel && matchTgl && matchSearch;
		});
	}, [sessions, filterKelas, filterMapel, filterTanggal, searchQuery]);

	// Statistik Kehadiran Kumulatif (dengan fungsi normStatus seragam)
	const overallStats = useMemo(() => {
		let totalHadir = 0;
		let totalSakit = 0;
		let totalIzin = 0;
		let totalAlpa = 0;
		let totalRecords = 0;

		sessions.forEach((s) => {
			(s.absensi_mapel_siswa || []).forEach((item) => {
				totalRecords++;
				const st = normStatus(item.status);
				if (st === 'hadir') totalHadir++;
				else if (st === 'sakit') totalSakit++;
				else if (st === 'izin') totalIzin++;
				else if (st === 'alfa') totalAlpa++;
			});
		});

		const attendanceRate = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 0;

		return {
			totalSesi: sessions.length,
			rate: attendanceRate,
			hadir: totalHadir,
			sakit: totalSakit,
			izin: totalIzin,
			alpa: totalAlpa,
		};
	}, [sessions]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
	const paginatedSessions = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredSessions.slice(start, start + itemsPerPage);
	}, [filteredSessions, currentPage]);

	// Filter active check
	const isFilterActive =
		Boolean(searchQuery.trim()) ||
		filterKelas !== 'Semua' ||
		filterMapel !== 'Semua' ||
		Boolean(filterTanggal);

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterKelas('Semua');
		setFilterMapel('Semua');
		setFilterTanggal('');
	};

	// Export to PDF with Kop Surat Resmi
	const handleExportPDF = () => {
		if (filteredSessions.length === 0) {
			Swal.fire('Info', 'Tidak ada data presensi mapel untuk diekspor.', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text('LAPORAN SUPERVISI PRESENSI SISWA PER MAPEL (KBM)', doc.internal.pageSize.getWidth() / 2, endKop + 2, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${filterKelas}  •  Filter Mapel: ${filterMapel}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const tableHead = [
				['No', 'Tanggal', 'Jam Ke', 'Guru Pengampu', 'Kelas', 'Mata Pelajaran', 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Hadir'],
			];

			const tableBody = filteredSessions.map((s, idx) => {
				const list = s.absensi_mapel_siswa || [];
				let h = 0, sk = 0, iz = 0, al = 0;
				list.forEach((item) => {
					const st = normStatus(item.status);
					if (st === 'hadir') h++;
					else if (st === 'sakit') sk++;
					else if (st === 'izin') iz++;
					else if (st === 'alfa') al++;
				});
				const totalSiswa = list.length;
				const sessionRate = totalSiswa > 0 ? Math.round((h / totalSiswa) * 100) : 0;

				return [
					idx + 1,
					s.tanggal || '-',
					s.created_at ? `Jam ${s.jam_ke || '-'}\n(${getTimeWIB(s.created_at)})` : (s.jam_ke || '-'),
					s.users?.nama_lengkap || '-',
					s.kelas || '-',
					s.mapel || '-',
					h,
					sk,
					iz,
					al,
					`${sessionRate}%`,
				];
			});

			autoTable(doc, {
				startY: endKop + 10,
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
				bodyStyles: { fontSize: 7, textColor: [15, 23, 42] },
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { halign: 'center', cellWidth: 20 },
					2: { halign: 'center', cellWidth: 14 },
					3: { fontStyle: 'bold' },
					4: { halign: 'center', cellWidth: 16 },
					6: { halign: 'center', cellWidth: 14 },
					7: { halign: 'center', cellWidth: 14 },
					8: { halign: 'center', cellWidth: 14 },
					9: { halign: 'center', cellWidth: 14 },
					10: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
				},
			});

			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 8;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			if (finalY + 28 <= pageHeight) {
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				const signerName = nama || 'Waka Kurikulum';
				doc.text(
					`Mengetahui,\nWaka Kurikulum\n\n\n\n${signerName}`,
					pageWidth - 70,
					finalY
				);
			}

			doc.save(`Rekap_Presensi_Mapel_Kurikulum_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (err) {
			console.error('Gagal export PDF absensi mapel:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredSessions.length === 0) return;

		const headers = [
			'Tanggal',
			'Jam Ke',
			'Waktu Riil',
			'Guru Pengampu',
			'Kelas',
			'Mata Pelajaran',
			'Total Hadir',
			'Total Sakit',
			'Total Izin',
			'Total Alpa',
			'Rasio Kehadiran (%)',
		];

		const rows = filteredSessions.map((s) => {
			const list = s.absensi_mapel_siswa || [];
			let h = 0, sk = 0, iz = 0, al = 0;
			list.forEach((item) => {
				const st = normStatus(item.status);
				if (st === 'hadir') h++;
				else if (st === 'sakit') sk++;
				else if (st === 'izin') iz++;
				else if (st === 'alfa') al++;
			});
			const totalSiswa = list.length;
			const sessionRate = totalSiswa > 0 ? Math.round((h / totalSiswa) * 100) : 0;

			return [
				s.tanggal || '',
				s.jam_ke || '',
				s.created_at ? getTimeWIB(s.created_at) : '',
				`"${(s.users?.nama_lengkap || '').replace(/"/g, '""')}"`,
				`"${(s.kelas || '').replace(/"/g, '""')}"`,
				`"${(s.mapel || '').replace(/"/g, '""')}"`,
				h,
				sk,
				iz,
				al,
				sessionRate,
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
			`rekap_presensi_mapel_kurikulum_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return <Loader text='Memuat Data Presensi Mapel...' />;
	}

	return (
		<div className='space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-white border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-amber-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📋</span> Monitoring Presensi Sesi Mapel
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Presensi Mapel Guru & Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Supervisi real-time kehadiran peserta didik per jam tatap muka pelajaran, guru pengampu, dan rasio ketidakhadiran santri.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto flex-wrap'>
					<AcademicPeriodChip />

					<button
						onClick={handleExportPDF}
						disabled={filteredSessions.length === 0}
						title='Unduh rekapitulasi presensi mapel dalam format PDF'
						className='px-3.5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={filteredSessions.length === 0}
						title='Unduh rekapitulasi presensi mapel dalam format CSV'
						className='px-3.5 py-2.5 bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>
				</div>
			</div>

			{/* Stat Highlights Bar */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-emerald-800'>Persentase Hadir</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>{overallStats.rate}%</p>
						<span className='text-[10px] font-bold text-emerald-700'>{overallStats.hadir} kehadiran siswa</span>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						✅
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Siswa Sakit</p>
						<p className='text-2xl sm:text-3xl font-black text-yellow-950 mt-0.5'>{overallStats.sakit}</p>
						<span className='text-[10px] font-bold text-yellow-700'>Dengan surat / keterangan</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🤒
					</span>
				</div>

				<div className='bg-blue-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-blue-800'>Siswa Izin</p>
						<p className='text-2xl sm:text-3xl font-black text-blue-950 mt-0.5'>{overallStats.izin}</p>
						<span className='text-[10px] font-bold text-blue-700'>Izin resmi / keluarga</span>
					</div>
					<span className='w-11 h-11 bg-blue-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						✉️
					</span>
				</div>

				<div className='bg-rose-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-rose-800'>Tanpa Keterangan (Alpa)</p>
						<p className='text-2xl sm:text-3xl font-black text-rose-950 mt-0.5'>{overallStats.alpa}</p>
						<span className='text-[10px] font-bold text-rose-700'>Perlu supervisi Kesiswaan & Wali</span>
					</div>
					<span className='w-11 h-11 bg-rose-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						⚠️
					</span>
				</div>
			</div>

			{/* Search & Multi Filter Box */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Row 1: Search & Filter Summary */}
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
							placeholder='Cari nama guru, rombel kelas, atau mata pelajaran...'
							className='w-full pl-10 pr-9 py-2.5 border-2 border-black rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
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
						<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-black border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							<span>📋</span>
							<span>{filteredSessions.length} Sesi Presensi</span>
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

				{/* Row 2: 3 Dedicated Filter Dropdowns / Inputs */}
				<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t-2 border-black/10'>
					{/* Filter Tanggal */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>📅</span> Tanggal Presensi
						</label>
						<input
							type='date'
							value={filterTanggal}
							onChange={(e) => setFilterTanggal(e.target.value)}
							className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
						/>
					</div>

					{/* Filter Rombel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏫</span> Rombongan Belajar
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
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
							className='w-full px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<option value='Semua'>Semua Mapel ({mapelList.length})</option>
							{mapelList.map((m) => (
								<option key={m.id || m.mapel} value={m.mapel}>
									{m.mapel}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-3 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-200 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Waktu Sesi</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pengajar</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Rombel & Mapel</th>
								<th className='px-5 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider'>Kehadiran (H / S / I / A)</th>
								<th className='px-5 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider'>Rasio Hadir</th>
								<th className='px-5 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedSessions.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-yellow-50/30'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ditemukan sesi presensi yang sesuai</p>
											<p className='text-xs text-gray-500'>Coba sesuaikan tanggal, filter kelas, atau kata kunci pencarian.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-yellow-300 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedSessions.map((s, idx) => {
									const list = s.absensi_mapel_siswa || [];
									let h = 0, sk = 0, iz = 0, al = 0;
									list.forEach((item) => {
										const st = normStatus(item.status);
										if (st === 'hadir') h++;
										else if (st === 'sakit') sk++;
										else if (st === 'izin') iz++;
										else if (st === 'alfa') al++;
									});
									const totalSiswa = list.length;
									const sessionRate = totalSiswa > 0 ? Math.round((h / totalSiswa) * 100) : 0;

									return (
										<tr
											key={s.sesi_id || s.id || idx}
											className='hover:bg-yellow-50/50 transition-colors'>
											{/* Tanggal & Jam */}
											<td className='px-5 py-4 whitespace-nowrap'>
												<span className='font-black text-xs sm:text-sm text-black block'>
													{s.tanggal ? new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
												</span>
												<span className='inline-block text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-black/20 mt-1'>
													Jam Ke-{s.jam_ke || '-'}
												</span>
												{s.created_at && (
													<span className='block text-[10px] font-mono font-bold text-gray-800 bg-yellow-200 px-1.5 py-0.5 rounded border border-black/30 mt-1 w-fit'>
														🕒 {getTimeWIB(s.created_at)} WIB
													</span>
												)}
											</td>

											{/* Guru */}
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex items-center gap-2'>
													<div className='w-8 h-8 rounded-lg bg-amber-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
														{s.users?.nama_lengkap ? s.users.nama_lengkap.charAt(0).toUpperCase() : 'G'}
													</div>
													<div className='min-w-0'>
														<span className='font-black text-xs sm:text-sm text-black block truncate max-w-[160px] sm:max-w-xs'>
															{s.users?.nama_lengkap || 'Guru Pengampu'}
														</span>
														<span className='font-mono text-[10px] text-gray-500'>
															@{s.users?.username || 'user'}
														</span>
													</div>
												</div>
											</td>

											{/* Kelas & Mapel */}
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex flex-col gap-1 items-start'>
													<span className='inline-block px-2.5 py-0.5 bg-black text-yellow-300 text-xs font-black rounded border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
														{s.kelas}
													</span>
													<span className='text-xs font-bold text-gray-700'>{s.mapel}</span>
												</div>
											</td>

											{/* Kehadiran H/S/I/A */}
											<td className='px-5 py-4 text-center whitespace-nowrap'>
												<div className='inline-flex items-center gap-1.5 font-mono text-xs font-black'>
													<span className='px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300' title='Hadir'>{h}H</span>
													<span className='px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300' title='Sakit'>{sk}S</span>
													<span className='px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300' title='Izin'>{iz}I</span>
													<span className='px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300' title='Alpa'>{al}A</span>
												</div>
											</td>

											{/* Rasio Hadir */}
											<td className='px-5 py-4 text-center whitespace-nowrap'>
												<span className='font-mono font-black text-sm text-black bg-white px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] inline-block'>
													{sessionRate}%
												</span>
											</td>

											{/* Action */}
											<td className='px-5 py-4 text-right whitespace-nowrap'>
												<button
													onClick={() => setSelectedSession(s)}
													className='px-3 py-1.5 bg-white hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
													🔍 Detail Siswa
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
						Menampilkan <span className='font-black text-black'>{filteredSessions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredSessions.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredSessions.length}</span> sesi presensi
					</div>

					{totalPages > 1 && (
						<div className='flex items-center gap-1.5'>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className='px-3 py-1.5 bg-white hover:bg-yellow-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
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
														? 'bg-yellow-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
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
								className='px-3 py-1.5 bg-white hover:bg-yellow-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								Next ▶
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Modal Detail Presensi Sesi */}
			{selectedSession && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150'>
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-yellow-300'>
							<div>
								<h3 className='text-base sm:text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
									<span>📋</span>
									<span>Daftar Presensi Sesi KBM</span>
								</h3>
								<p className='text-xs font-bold text-gray-800'>
									{selectedSession.kelas} &bull; {selectedSession.mapel} &bull; Jam Ke-{selectedSession.jam_ke || '-'} &bull; {selectedSession.users?.nama_lengkap || 'Guru'}
								</p>
							</div>
							<button
								onClick={() => setSelectedSession(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
								✕
							</button>
						</div>

						<div className='p-6 max-h-[70vh] overflow-y-auto space-y-4 bg-gray-50'>
							<div className='overflow-x-auto border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] bg-white'>
								<table className='w-full text-left text-xs'>
									<thead>
										<tr className='bg-amber-100 border-b-2 border-black font-black'>
											<th className='p-3'>No</th>
											<th className='p-3'>Nama Siswa</th>
											<th className='p-3 text-center'>Status</th>
											<th className='p-3'>Keterangan</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-black/10'>
										{(selectedSession.absensi_mapel_siswa || []).length === 0 ? (
											<tr>
												<td colSpan={4} className='p-6 text-center text-gray-500 font-bold'>
													Belum ada data presensi siswa yang dicatat untuk sesi ini.
												</td>
											</tr>
										) : (
											selectedSession.absensi_mapel_siswa.map((item, idx) => {
												const st = normStatus(item.status);
												let badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
												if (st === 'sakit') badgeBg = 'bg-yellow-100 text-yellow-800 border-yellow-300';
												else if (st === 'izin') badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
												else if (st === 'alfa') badgeBg = 'bg-rose-100 text-rose-800 border-rose-300';

												return (
													<tr key={item.id || idx} className='hover:bg-gray-50'>
														<td className='p-3 font-bold text-gray-500'>{idx + 1}</td>
														<td className='p-3'>
															<p className='font-black text-black'>{item.siswa?.nama_lengkap || `Siswa ID: ${item.siswa_id}`}</p>
															{item.siswa?.nis && <span className='text-[10px] text-gray-500 font-mono'>NIS: {item.siswa.nis}</span>}
														</td>
														<td className='p-3 text-center'>
															<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeBg}`}>
																{st === 'alfa' ? 'ALPA' : (item.status || 'Hadir')}
															</span>
														</td>
														<td className='p-3 text-gray-600 font-medium'>
															{item.keterangan || '-'}
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
									onClick={() => setSelectedSession(null)}
									className='neo-btn-primary text-xs sm:text-sm !py-2 !px-5 bg-black text-white cursor-pointer'>
									Tutup Rincian
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
