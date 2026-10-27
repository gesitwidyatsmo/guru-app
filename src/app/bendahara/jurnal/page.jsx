'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { parseJTM } from '@/lib/bisaroh';
import { buildCrossValidationMap, validateJurnalWithAbsensi } from '@/lib/crossValidation';

export default function BendaharaJurnalPage() {
	const [loading, setLoading] = useState(true);
	const [journals, setJournals] = useState([]);
	const [users, setUsers] = useState([]);
	const [absensiSessions, setAbsensiSessions] = useState([]);

	// Filters
	const [searchQuery, setSearchQuery] = useState('');
	const [filterDate, setFilterDate] = useState('');
	const [filterGuru, setFilterGuru] = useState('all');
	const [filterKelas, setFilterKelas] = useState('all');
	const [filterMapel, setFilterMapel] = useState('all');
	const [filterAbsensi, setFilterAbsensi] = useState('all'); // 'all' | 'lengkap' | 'belum_absen'
	const [onlyKendala, setOnlyKendala] = useState(false);

	// Detail Modal
	const [selectedJournal, setSelectedJournal] = useState(null);

	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 15;

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resJurnal, resUsers, resAbsensi] = await Promise.all([
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/absensi-mapel?cross_check=true').catch(() => ({ ok: false })),
				]);

				if (resJurnal.ok) {
					const data = await resJurnal.json();
					setJournals(Array.isArray(data) ? data : []);
				}

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
				}

				if (resAbsensi.ok) {
					const data = await resAbsensi.json();
					setAbsensiSessions(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				console.error('Error load jurnal audit data:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Guru map for quick lookup
	const guruMap = useMemo(() => {
		const map = {};
		users.forEach((u) => {
			map[u.id_user] = u;
		});
		return map;
	}, [users]);

	// Dropdown options
	const uniqueGurus = useMemo(() => {
		const guruIds = new Set(journals.map((j) => j.guru_id).filter(Boolean));
		return Array.from(guruIds)
			.map((id) => guruMap[id] || { id_user: id, nama_lengkap: `ID: ${id}` })
			.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
	}, [journals, guruMap]);

	const uniqueKelas = useMemo(() => {
		const set = new Set(journals.map((j) => j.kelas).filter(Boolean));
		return Array.from(set).sort();
	}, [journals]);

	const uniqueMapel = useMemo(() => {
		const set = new Set(journals.map((j) => j.mapel).filter(Boolean));
		return Array.from(set).sort();
	}, [journals]);

	// Cross-validation lookup map
	const crossMap = useMemo(() => {
		return buildCrossValidationMap(absensiSessions);
	}, [absensiSessions]);

	// Filtered Journals
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (filterDate && j.tanggal !== filterDate) return false;
			if (filterGuru !== 'all' && j.guru_id !== filterGuru) return false;
			if (filterKelas !== 'all' && j.kelas !== filterKelas) return false;
			if (filterMapel !== 'all' && j.mapel !== filterMapel) return false;
			if (onlyKendala && (!j.hambatan || !j.hambatan.trim() || j.hambatan.trim() === '-')) return false;

			// Filter Status Absensi Siswa (Cross-Check)
			if (filterAbsensi !== 'all') {
				const val = validateJurnalWithAbsensi(j, crossMap);
				if (filterAbsensi === 'lengkap' && !val.isValid) return false;
				if (filterAbsensi === 'belum_absen' && val.isValid) return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const guruName = (guruMap[j.guru_id]?.nama_lengkap || '').toLowerCase();
				const guruUser = (guruMap[j.guru_id]?.username || '').toLowerCase();
				const materi = (j.materi || '').toLowerCase();
				const mapel = (j.mapel || '').toLowerCase();
				const kelas = (j.kelas || '').toLowerCase();
				return guruName.includes(q) || guruUser.includes(q) || materi.includes(q) || mapel.includes(q) || kelas.includes(q);
			}

			return true;
		});
	}, [journals, filterDate, filterGuru, filterKelas, filterMapel, filterAbsensi, onlyKendala, searchQuery, guruMap, crossMap]);

	// KPI Summary Metrik
	const auditStats = useMemo(() => {
		let total = filteredJournals.length;
		let lengkap = 0;
		let belumAbsen = 0;
		let totalJP = 0;

		filteredJournals.forEach((j) => {
			const v = validateJurnalWithAbsensi(j, crossMap);
			if (v.isValid) lengkap++;
			else belumAbsen++;
			totalJP += parseJTM(j.jam_ke);
		});

		const kepatuhanPct = total > 0 ? Math.round((lengkap / total) * 100) : 100;
		return { total, lengkap, belumAbsen, totalJP, kepatuhanPct };
	}, [filteredJournals, crossMap]);

	// Pagination
	const totalPages = Math.max(1, Math.ceil(filteredJournals.length / itemsPerPage));
	const paginatedJournals = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredJournals.slice(start, start + itemsPerPage);
	}, [filteredJournals, currentPage]);

	// Reset page on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterDate, filterGuru, filterKelas, filterMapel, filterAbsensi, onlyKendala, searchQuery]);

	// Preset Hari Ini
	const handleHariIni = () => {
		const now = new Date();
		const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		setFilterDate(filterDate === ymd ? '' : ymd);
	};

	// Reset Semua Filter
	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterDate('');
		setFilterGuru('all');
		setFilterKelas('all');
		setFilterMapel('all');
		setFilterAbsensi('all');
		setOnlyKendala(false);
	};

	const hasActiveFilters = Boolean(
		searchQuery ||
		filterDate ||
		filterGuru !== 'all' ||
		filterKelas !== 'all' ||
		filterMapel !== 'all' ||
		filterAbsensi !== 'all' ||
		onlyKendala
	);

	// Ekspor CSV
	const handleExportCSV = () => {
		if (filteredJournals.length === 0) return;

		const headers = [
			'Tanggal',
			'Guru Pengajar',
			'Kelas',
			'Mata Pelajaran',
			'Jam Ke',
			'Durasi JP',
			'Status Absensi Siswa',
			'Jumlah Siswa',
			'Hadir',
			'Sakit',
			'Izin',
			'Alfa',
			'Materi Pembelajaran',
			'Kendala / Hambatan',
			'Status Jurnal',
		];
		const rows = filteredJournals.map((j) => {
			const guruName = guruMap[j.guru_id]?.nama_lengkap || j.guru_id;
			const v = validateJurnalWithAbsensi(j, crossMap);
			return [
				j.tanggal || '',
				`"${guruName.replace(/"/g, '""')}"`,
				j.kelas || '',
				`"${(j.mapel || '').replace(/"/g, '""')}"`,
				j.jam_ke || '',
				parseJTM(j.jam_ke),
				v.isValid ? 'Lengkap' : 'Belum Absen',
				v.studentCount,
				v.summary.hadir,
				v.summary.sakit,
				v.summary.izin,
				v.summary.alfa,
				`"${(j.materi || '').replace(/"/g, '""')}"`,
				`"${(j.hambatan || '-').replace(/"/g, '""')}"`,
				j.tuntas ? 'Tuntas' : 'Belum Tuntas',
			];
		});

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `Audit_Jurnal_Guru_${filterDate || 'Semua_Tanggal'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const selectedValidation = selectedJournal ? validateJurnalWithAbsensi(selectedJournal, crossMap) : null;

	return (
		<div className='space-y-6'>
			{/* Page Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2'>
						<span className='px-2.5 py-0.5 bg-yellow-300 border border-black rounded-lg text-[10px] font-black uppercase tracking-wider'>
							Pusat Audit KBM
						</span>
						<Link
							href='/bendahara/jtm'
							className='text-[10px] font-black text-teal-800 hover:underline flex items-center gap-1'>
							<span>⏱️ Buka Rekap JTM Guru &rarr;</span>
						</Link>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black uppercase tracking-tight flex items-center gap-2 mt-1'>
						<span>📖</span>
						<span>Audit Jurnal & Validasi KBM</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-0.5'>
						Verifikasi bukti fisik mengajar, materi pembelajaran, dan validasi silang kehadiran siswa sebelum ACC bisaroh.
					</p>
				</div>

				<div className='flex items-center gap-2 shrink-0'>
					<button
						onClick={handleExportCSV}
						disabled={filteredJournals.length === 0}
						className='px-4 py-2.5 bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>
				</div>
			</div>

			{/* KPI Metrik Integritas KBM (4 Cards Grid Rapi & Seimbang) */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
				{/* Card 1: Total Jurnal */}
				<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-gray-500 tracking-wider'>Total Jurnal Masuk</p>
						<span className='w-8 h-8 rounded-xl bg-gray-100 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							📖
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-black'>{auditStats.total}</span>
							<span className='text-xs font-bold text-gray-600'>Sesi</span>
						</div>
						<p className='text-[11px] font-bold text-gray-500 mt-0.5'>
							Akumulasi {auditStats.totalJP} Jam Pelajaran (JP)
						</p>
					</div>
				</div>

				{/* Card 2: Presensi Siswa Lengkap */}
				<div className='bg-emerald-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-emerald-950 tracking-wider'>Presensi Siswa Sah</p>
						<span className='w-8 h-8 rounded-xl bg-emerald-300 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							✓
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-emerald-950'>{auditStats.lengkap}</span>
							<span className='text-xs font-bold text-emerald-800'>Sesi Valid</span>
						</div>
						<p className='text-[11px] font-bold text-emerald-800 mt-0.5'>
							Siswa terdata di kelas
						</p>
					</div>
				</div>

				{/* Card 3: Belum Absen Siswa */}
				<div className={`border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px] ${
					auditStats.belumAbsen > 0 ? 'bg-amber-100 text-amber-950' : 'bg-white text-black'
				}`}>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-amber-950 tracking-wider'>Belum Absen Siswa</p>
						<span className='w-8 h-8 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							⚠️
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-amber-950'>{auditStats.belumAbsen}</span>
							<span className='text-xs font-bold text-amber-900'>Perlu Dilengkapi</span>
						</div>
						<p className='text-[11px] font-bold text-amber-900 mt-0.5'>
							Data kehadiran siswa kosong
						</p>
					</div>
				</div>

				{/* Card 4: Tingkat Kepatuhan */}
				<div className='bg-teal-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-teal-950 tracking-wider'>Integritas KBM</p>
						<span className='w-8 h-8 rounded-xl bg-teal-300 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							🎯
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-teal-950'>{auditStats.kepatuhanPct}%</span>
							<span className='text-xs font-bold text-teal-800'>Kepatuhan</span>
						</div>
						<div className='w-full h-2.5 bg-white border border-black rounded-full overflow-hidden mt-1.5'>
							<div
								className={`h-full transition-all duration-500 ${
									auditStats.kepatuhanPct >= 90
										? 'bg-emerald-500'
										: auditStats.kepatuhanPct >= 75
										? 'bg-amber-400'
										: 'bg-rose-500'
								}`}
								style={{ width: `${auditStats.kepatuhanPct}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Filter Box: Struktur Rapi 2 Baris dengan Field Nyaman */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Baris 1: Pencarian Cepat, Dewan Guru, dan Filter Tanggal */}
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3'>
					{/* Search Bar (Lebar: 5 cols di desktop) */}
					<div className='lg:col-span-5'>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Cari Materi / Guru / Mapel
						</label>
						<div className='relative'>
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='Ketik nama guru, materi pokok, mapel, kelas...'
								className='neo-input !py-2.5 !pl-9 text-xs font-bold w-full'
							/>
							<span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm'>
								🔍
							</span>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className='absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-black font-black'>
									✕
								</button>
							)}
						</div>
					</div>

					{/* Dropdown Guru (Lebar: 4 cols di desktop) */}
					<div className='lg:col-span-4'>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Dewan Guru
						</label>
						<select
							value={filterGuru}
							onChange={(e) => setFilterGuru(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white w-full'>
							<option value='all'>Semua Dewan Guru ({uniqueGurus.length})</option>
							{uniqueGurus.map((g) => (
								<option key={g.id_user} value={g.id_user}>
									{g.nama_lengkap}
								</option>
							))}
						</select>
					</div>

					{/* Filter Tanggal (Lebar: 3 cols di desktop dengan Tombol Hari Ini Rapi) */}
					<div className='lg:col-span-3'>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Pelaksanaan
						</label>
						<div className='flex items-center gap-1.5'>
							<input
								type='date'
								value={filterDate}
								onChange={(e) => setFilterDate(e.target.value)}
								className='neo-input !py-2 text-xs font-mono font-bold flex-1'
							/>
							<button
								type='button'
								onClick={handleHariIni}
								title='Set filter ke hari ini'
								className={`px-3 py-2 border-2 border-black rounded-xl text-xs font-black uppercase shrink-0 transition-colors ${
									filterDate ? 'bg-yellow-300 shadow-[1px_1px_0px_0px_#0D0D0D]' : 'bg-gray-100 hover:bg-gray-200'
								}`}>
								Hari Ini
							</button>
						</div>
					</div>
				</div>

				{/* Baris 2: Status Presensi, Kelas, Mata Pelajaran */}
				<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-black/10'>
					{/* Status Presensi Siswa */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Status Presensi Siswa
						</label>
						<select
							value={filterAbsensi}
							onChange={(e) => setFilterAbsensi(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white w-full'>
							<option value='all'>Semua Status Presensi</option>
							<option value='lengkap'>🟢 ✓ Absensi Lengkap (Sah)</option>
							<option value='belum_absen'>🟡 ⚠️ Belum Absen Siswa (Kosong)</option>
						</select>
					</div>

					{/* Kelas */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Rombel / Kelas
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white w-full'>
							<option value='all'>Semua Kelas</option>
							{uniqueKelas.map((k) => (
								<option key={k} value={k}>
									Kelas {k}
								</option>
							))}
						</select>
					</div>

					{/* Mapel */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Mata Pelajaran
						</label>
						<select
							value={filterMapel}
							onChange={(e) => setFilterMapel(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white w-full'>
							<option value='all'>Semua Mata Pelajaran</option>
							{uniqueMapel.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Baris 3: Toggle Kendala & Reset Info */}
				<div className='flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-black/10 text-xs font-bold'>
					<div className='flex items-center gap-3'>
						<label className='inline-flex items-center gap-2 cursor-pointer text-xs font-black uppercase select-none'>
							<input
								type='checkbox'
								checked={onlyKendala}
								onChange={(e) => setOnlyKendala(e.target.checked)}
								className='w-4 h-4 rounded border-2 border-black text-rose-600 focus:ring-rose-500'
							/>
							<span>⚠️ Hanya yang Memiliki Kendala KBM</span>
						</label>
					</div>

					<div className='flex items-center gap-2 text-xs font-bold text-gray-600'>
						<span>
							Menampilkan: <strong className='text-black font-black'>{filteredJournals.length}</strong> dari {journals.length} entri
						</span>
						{hasActiveFilters && (
							<button
								onClick={handleResetFilters}
								className='px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-400 rounded-lg text-xs font-black uppercase transition-colors ml-1'>
								✕ Reset Filter
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Main Audit Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
								<th className='px-4 py-3.5 w-28 whitespace-nowrap'>Tanggal</th>
								<th className='px-4 py-3.5 min-w-[180px]'>Guru Pengajar</th>
								<th className='px-4 py-3.5 min-w-[150px]'>Kelas & Mapel</th>
								<th className='px-4 py-3.5 text-center w-20 whitespace-nowrap'>Jam Ke-</th>
								<th className='px-4 py-3.5 text-center w-24 whitespace-nowrap'>Durasi</th>
								<th className='px-4 py-3.5 text-center min-w-[170px] whitespace-nowrap'>Presensi Siswa</th>
								<th className='px-4 py-3.5 min-w-[220px]'>Materi Pembelajaran</th>
								<th className='px-4 py-3.5 text-right w-24'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
							{loading ? (
								<tr>
									<td colSpan={8} className='px-6 py-14 text-center text-gray-500 font-bold'>
										<div className='inline-flex items-center gap-2'>
											<span className='animate-spin text-lg'>⌛</span>
											<span>Memuat log jurnal pembelajaran & validasi presensi siswa...</span>
										</div>
									</td>
								</tr>
							) : paginatedJournals.length === 0 ? (
								<tr>
									<td colSpan={8} className='px-6 py-14 text-center text-gray-500 font-bold'>
										<div className='max-w-xs mx-auto space-y-2'>
											<span className='text-3xl block'>🔍</span>
											<p className='text-sm font-black text-black uppercase'>Tidak Ada Data Jurnal</p>
											<p className='text-xs text-gray-500'>
												Tidak ditemukan entri jurnal yang cocok dengan kombinasi filter yang Anda pilih.
											</p>
											{hasActiveFilters && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedJournals.map((j) => {
									const guru = guruMap[j.guru_id];
									const guruName = guru?.nama_lengkap || `ID: ${j.guru_id}`;
									const hasKendala = j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-';
									const validation = validateJurnalWithAbsensi(j, crossMap);

									return (
										<tr key={j.id} className='hover:bg-yellow-50/70 transition-colors'>
											{/* Tanggal */}
											<td className='px-4 py-3.5 font-mono whitespace-nowrap text-gray-800 align-middle'>
												{j.tanggal}
											</td>

											{/* Guru */}
											<td className='px-4 py-3.5 align-middle'>
												<p className='font-black text-black leading-tight'>{guruName}</p>
												<span className='text-[10px] text-gray-500 font-mono block mt-0.5'>
													@{guru?.username || '-'}
												</span>
											</td>

											{/* Kelas & Mapel */}
											<td className='px-4 py-3.5 align-middle whitespace-nowrap'>
												<span className='font-black text-black block'>{j.mapel}</span>
												<span className='text-[10px] text-gray-500 font-bold'>
													Kelas {j.kelas}
												</span>
											</td>

											{/* Jam Ke */}
											<td className='px-4 py-3.5 text-center font-mono align-middle'>
												<span className='px-2.5 py-1 bg-gray-100 border border-black/20 rounded-md font-black text-[11px]'>
													{j.jam_ke}
												</span>
											</td>

											{/* Durasi JP */}
											<td className='px-4 py-3.5 text-center font-mono align-middle'>
												<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg font-black text-teal-950 text-xs shadow-xs'>
													{parseJTM(j.jam_ke)} JP
												</span>
											</td>

											{/* Status Presensi Siswa */}
											<td className='px-4 py-3.5 text-center align-middle whitespace-nowrap'>
												{validation.status === 'tugas_luar' ? (
													<div className='inline-flex flex-col items-center gap-0.5'>
														<span className='px-2.5 py-1 bg-blue-100 border border-blue-600 text-blue-950 rounded-lg text-xs font-black inline-flex items-center gap-1 shadow-xs'>
															<span>✈️</span>
															<span>Tugas Luar</span>
														</span>
														<span className='text-[9px] text-blue-800 font-bold mt-0.5'>
															Dispensasi Siswa
														</span>
													</div>
												) : validation.status === 'kegiatan_sekolah' ? (
													<div className='inline-flex flex-col items-center gap-0.5'>
														<span className='px-2.5 py-1 bg-purple-100 border border-purple-600 text-purple-950 rounded-lg text-xs font-black inline-flex items-center gap-1 shadow-xs'>
															<span>🎪</span>
															<span>Kegiatan Sekolah</span>
														</span>
														<span className='text-[9px] text-purple-800 font-bold mt-0.5'>
															Dispensasi Siswa
														</span>
													</div>
												) : validation.isValid ? (
													<div className='inline-flex flex-col items-center gap-0.5'>
														<span className='px-2.5 py-1 bg-emerald-100 border border-emerald-600 text-emerald-950 rounded-lg text-xs font-black inline-flex items-center gap-1 shadow-xs'>
															<span>✓</span>
															<span>{validation.studentCount} Siswa</span>
														</span>
														<div className='flex items-center gap-1 text-[9px] font-mono font-bold text-gray-600 mt-0.5'>
															<span className='text-emerald-700' title='Hadir'>H:{validation.summary.hadir}</span>
															<span>&bull;</span>
															<span className='text-blue-700' title='Sakit'>S:{validation.summary.sakit}</span>
															<span>&bull;</span>
															<span className='text-amber-700' title='Izin'>I:{validation.summary.izin}</span>
															<span>&bull;</span>
															<span className='text-rose-700' title='Alfa'>A:{validation.summary.alfa}</span>
														</div>
													</div>
												) : (
													<div className='inline-flex flex-col items-center gap-0.5'>
														<span className='px-2.5 py-1 bg-amber-100 border border-amber-600 text-amber-950 rounded-lg text-xs font-black inline-flex items-center gap-1 shadow-xs animate-pulse'>
															<span>⚠️</span>
															<span>Belum Absen</span>
														</span>
														<span className='text-[9px] text-amber-800 font-bold mt-0.5'>
															Data siswa kosong
														</span>
													</div>
												)}
											</td>

											{/* Materi & Kendala */}
											<td className='px-4 py-3.5 align-middle'>
												<p className='font-bold text-black line-clamp-1' title={j.materi || '-'}>
													{j.materi || '-'}
												</p>
												{hasKendala ? (
													<span
														title={j.hambatan}
														className='inline-block text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded mt-1 line-clamp-1'>
														⚠️ {j.hambatan}
													</span>
												) : (
													<span className='text-[10px] text-emerald-700 font-bold block mt-0.5'>
														✓ KBM tuntas
													</span>
												)}
											</td>

											{/* Tombol Aksi */}
											<td className='px-4 py-3.5 text-right align-middle'>
												<button
													onClick={() => setSelectedJournal(j)}
													className='px-3 py-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ml-auto flex items-center gap-1'>
													<span>Audit</span>
													<span>➔</span>
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination Bar */}
				{totalPages > 1 && (
					<div className='p-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-black'>
						<span className='text-gray-600'>
							Menampilkan halaman <strong className='text-black'>{currentPage}</strong> dari {totalPages} ({filteredJournals.length} entri)
						</span>
						<div className='flex items-center gap-1.5'>
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage(1)}
								className='px-2.5 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								⇤ Awal
							</button>
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								className='px-3 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Prev
							</button>
							<span className='px-3 py-1 bg-yellow-300 border-2 border-black rounded-lg font-black'>
								{currentPage}
							</span>
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								className='px-3 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Next
							</button>
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage(totalPages)}
								className='px-2.5 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Akhir ⇥
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Modal Detail Audit (Ukuran Nyaman max-w-2xl) */}
			{selectedJournal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-2xl w-full flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden max-h-[90vh]'>
						{/* Modal Header */}
						<div className='p-4 sm:p-5 bg-yellow-300 border-b-2 border-black flex items-center justify-between shrink-0'>
							<div className='flex items-center gap-2.5'>
								<span className='w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center font-black text-sm shadow-[1px_1px_0px_0px_#0D0D0D]'>
									📋
								</span>
								<div>
									<h3 className='font-black text-base uppercase text-black leading-tight'>
										Lembar Audit Jurnal & KBM
									</h3>
									<p className='text-[10px] font-bold text-gray-800 font-mono'>
										ID Jurnal: {selectedJournal.id}
									</p>
								</div>
							</div>
							<button
								onClick={() => setSelectedJournal(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-xl flex items-center justify-center font-black text-sm hover:bg-rose-300 shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
								✕
							</button>
						</div>

						{/* Modal Scrollable Body */}
						<div className='p-5 sm:p-6 space-y-4 text-xs overflow-y-auto'>
							{/* Guru Profile Bar */}
							<div className='bg-gray-50 border-2 border-black rounded-xl p-3.5 flex items-center justify-between gap-3'>
								<div>
									<span className='text-[10px] uppercase font-black text-gray-500 block'>Guru Pengajar:</span>
									<p className='font-black text-base text-black mt-0.5'>
										{guruMap[selectedJournal.guru_id]?.nama_lengkap || selectedJournal.guru_id}
									</p>
									<span className='text-xs font-mono text-gray-600'>
										@{guruMap[selectedJournal.guru_id]?.username || '-'}
									</span>
								</div>
								<div className='text-right shrink-0'>
									<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg font-mono font-black text-xs inline-block'>
										{parseJTM(selectedJournal.jam_ke)} JP
									</span>
								</div>
							</div>

							{/* 4-Item Parameter Grid */}
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5'>
								<div className='bg-white border-2 border-black/20 rounded-xl p-2.5'>
									<span className='text-[10px] text-gray-500 font-black uppercase block'>Tanggal</span>
									<span className='font-mono font-black text-sm text-black mt-0.5 block'>
										{selectedJournal.tanggal}
									</span>
								</div>
								<div className='bg-white border-2 border-black/20 rounded-xl p-2.5'>
									<span className='text-[10px] text-gray-500 font-black uppercase block'>Jam Pelajaran</span>
									<span className='font-mono font-black text-sm text-black mt-0.5 block'>
										Jam {selectedJournal.jam_ke}
									</span>
								</div>
								<div className='bg-white border-2 border-black/20 rounded-xl p-2.5'>
									<span className='text-[10px] text-gray-500 font-black uppercase block'>Kelas</span>
									<span className='font-black text-sm text-black mt-0.5 block'>
										Kelas {selectedJournal.kelas}
									</span>
								</div>
								<div className='bg-white border-2 border-black/20 rounded-xl p-2.5'>
									<span className='text-[10px] text-gray-500 font-black uppercase block'>Mata Pelajaran</span>
									<span className='font-black text-sm text-black mt-0.5 block truncate' title={selectedJournal.mapel}>
										{selectedJournal.mapel}
									</span>
								</div>
							</div>

							{/* Status Integritas Presensi Siswa */}
							<div className={`p-4 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] ${
								selectedValidation?.status === 'tugas_luar'
									? 'bg-blue-100'
									: selectedValidation?.status === 'kegiatan_sekolah'
									? 'bg-purple-100'
									: selectedValidation?.isValid
									? 'bg-emerald-100'
									: 'bg-amber-100'
							}`}>
								<div className='flex items-center justify-between gap-2'>
									<div className='flex items-center gap-2'>
										<span className='text-base'>
											{selectedValidation?.status === 'tugas_luar'
												? '✈️'
												: selectedValidation?.status === 'kegiatan_sekolah'
												? '🎪'
												: selectedValidation?.isValid
												? '🟢'
												: '🟡'}
										</span>
										<span className='text-xs sm:text-sm font-black uppercase text-black'>
											{selectedValidation?.status === 'tugas_luar'
												? 'Tugas Luar Sekolah / Dinas Resmi'
												: selectedValidation?.status === 'kegiatan_sekolah'
												? 'Kegiatan Sekolah (Hari Santri / Event)'
												: selectedValidation?.isValid
												? 'Presensi Siswa Lengkap & Terverifikasi'
												: 'Presensi Siswa Belum Diisi'}
										</span>
									</div>
									<span className={`text-xs font-mono font-black px-2.5 py-1 bg-white border-2 border-black rounded-lg shadow-xs ${
										selectedValidation?.status === 'tugas_luar'
											? 'text-blue-900'
											: selectedValidation?.status === 'kegiatan_sekolah'
											? 'text-purple-900'
											: ''
									}`}>
										{selectedValidation?.status === 'tugas_luar' || selectedValidation?.status === 'kegiatan_sekolah'
											? 'Dispensasi Siswa'
											: `${selectedValidation?.studentCount || 0} Siswa`}
									</span>
								</div>

								{selectedValidation?.status === 'tugas_luar' ? (
									<div className='mt-2.5 bg-white/90 border border-blue-400 p-2.5 rounded-lg'>
										<p className='text-xs font-bold text-blue-950 leading-relaxed'>
											Guru bertugas di luar sekolah atas nama dinas/sekolah. Kewajiban presensi kehadiran siswa dibebaskan, dan jam mengajar (JP) tetap diakui sah dan lengkap untuk perhitungan bisaroh.
										</p>
									</div>
								) : selectedValidation?.status === 'kegiatan_sekolah' ? (
									<div className='mt-2.5 bg-white/90 border border-purple-400 p-2.5 rounded-lg'>
										<p className='text-xs font-bold text-purple-950 leading-relaxed'>
											Guru mendampingi / mengikuti agenda resmi kegiatan sekolah (Hari Santri, Upacara, Pawai, PHBI/PHBN, dll). Kewajiban presensi mata pelajaran dibebaskan, dan jam kegiatan (JP) tetap diakui sah dan lengkap untuk perhitungan bisaroh.
										</p>
									</div>
								) : selectedValidation?.isValid ? (
									<div className='mt-3'>
										<div className='grid grid-cols-4 gap-2 text-center text-xs font-black'>
											<div className='bg-white border-2 border-black p-2 rounded-xl'>
												<span className='block text-[10px] text-emerald-800 uppercase'>Hadir</span>
												<span className='text-base text-emerald-950'>{selectedValidation.summary.hadir}</span>
											</div>
											<div className='bg-white border-2 border-black p-2 rounded-xl'>
												<span className='block text-[10px] text-blue-800 uppercase'>Sakit</span>
												<span className='text-base text-blue-950'>{selectedValidation.summary.sakit}</span>
											</div>
											<div className='bg-white border-2 border-black p-2 rounded-xl'>
												<span className='block text-[10px] text-yellow-800 uppercase'>Izin</span>
												<span className='text-base text-yellow-950'>{selectedValidation.summary.izin}</span>
											</div>
											<div className='bg-white border-2 border-black p-2 rounded-xl'>
												<span className='block text-[10px] text-rose-800 uppercase'>Alfa</span>
												<span className='text-base text-rose-950'>{selectedValidation.summary.alfa}</span>
											</div>
										</div>
									</div>
								) : (
									<div className='mt-2.5 bg-white/80 border border-amber-400 p-2.5 rounded-lg'>
										<p className='text-xs font-bold text-amber-950 leading-relaxed'>
											Guru belum menginput presensi siswa untuk sesi ini. Pembayaran bisaroh tetap dapat diproses, namun disarankan untuk meminta guru melengkapi presensi siswa sebelum pengesahan draf bisaroh oleh Kepala Sekolah.
										</p>
									</div>
								)}
							</div>

							{/* Materi Pokok Box */}
							<div className='bg-white border-2 border-black/20 rounded-xl p-3.5'>
								<span className='text-[10px] uppercase font-black text-gray-500 block'>Materi Pokok Pembelajaran:</span>
								<p className='font-bold text-black text-sm mt-1 leading-relaxed'>
									{selectedJournal.materi || '-'}
								</p>
							</div>

							{/* Kegiatan KBM (Jika Ada) */}
							{selectedJournal.kegiatan && (
								<div className='bg-white border-2 border-black/20 rounded-xl p-3.5'>
									<span className='text-[10px] uppercase font-black text-gray-500 block'>Rincian Kegiatan Pembelajaran:</span>
									<p className='text-gray-800 font-bold mt-1 whitespace-pre-wrap leading-relaxed'>
										{selectedJournal.kegiatan}
									</p>
								</div>
							)}

							{/* Kendala / Hambatan Mengajar (Jika Ada) */}
							{selectedJournal.hambatan && selectedJournal.hambatan.trim() && selectedJournal.hambatan.trim() !== '-' && (
								<div className='p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl'>
									<span className='text-[10px] uppercase font-black text-rose-800 block flex items-center gap-1'>
										<span>⚠️</span>
										<span>Kendala & Solusi Pembelajaran:</span>
									</span>
									<p className='text-rose-950 font-bold mt-1 text-xs'>
										{selectedJournal.hambatan}
									</p>
									{selectedJournal.solusi && (
										<p className='text-xs text-rose-800 mt-1.5 font-bold pt-1.5 border-t border-rose-200'>
											Solusi: {selectedJournal.solusi}
										</p>
									)}
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex items-center justify-between shrink-0'>
							<span className='text-[11px] font-bold text-gray-500'>
								Status: <strong className='text-black font-black'>{selectedJournal.tuntas ? '✓ KBM Tuntas' : 'Belum Tuntas'}</strong>
							</span>
							<button
								onClick={() => setSelectedJournal(null)}
								className='px-6 py-2.5 bg-black text-white hover:bg-gray-800 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
								Tutup Lembar Audit
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
