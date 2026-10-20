'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	parseJTM,
	formatRupiah,
	getDefaultCutOffRange,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
	getGuruTingkatanInfo,
} from '@/lib/bisaroh';
import {
	buildCrossValidationMap,
	validateJurnalWithAbsensi,
	calculateGuruCompliance,
} from '@/lib/crossValidation';

export default function BendaharaJTMPage() {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [journals, setJournals] = useState([]);
	const [kelas, setKelas] = useState([]);
	const [absensiSessions, setAbsensiSessions] = useState([]);
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);
	
	// Date range state
	const defaultRange = getDefaultCutOffRange();
	const [startDate, setStartDate] = useState(defaultRange.startDate);
	const [endDate, setEndDate] = useState(defaultRange.endDate);
	const [searchQuery, setSearchQuery] = useState('');

	// Modal detail guru
	const [selectedGuru, setSelectedGuru] = useState(null);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resUsers, resJurnal, resKelas, resSettings, resAbsensi] = await Promise.all([
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/kelas').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
					fetch('/api/absensi-mapel?cross_check=true').catch(() => ({ ok: false })),
				]);

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
				}

				if (resJurnal.ok) {
					const data = await resJurnal.json();
					setJournals(Array.isArray(data) ? data : []);
				}

				if (resKelas.ok) {
					const data = await resKelas.json();
					setKelas(Array.isArray(data) ? data : []);
				}

				if (resSettings.ok) {
					const data = await resSettings.json();
					if (data?.value) {
						setSettings(normalizeBisarohSettings(data.value));
					}
				}

				if (resAbsensi.ok) {
					const data = await resAbsensi.json();
					setAbsensiSessions(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				console.error('Error load JTM data:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Filter dewan guru
	const guruList = useMemo(() => {
		return users.filter((u) => u.role === 'Guru');
	}, [users]);

	// Set nama wali kelas
	const waliKelasNames = useMemo(() => {
		const names = new Set();
		kelas.forEach((k) => {
			if (k.wali_kelas) names.add(String(k.wali_kelas).trim().toLowerCase());
		});
		return names;
	}, [kelas]);

	// Cross validation map
	const crossMap = useMemo(() => {
		return buildCrossValidationMap(absensiSessions);
	}, [absensiSessions]);

	// Filter jurnal sesuai tanggal yang dipilih
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (!j.tanggal) return false;
			if (startDate && j.tanggal < startDate) return false;
			if (endDate && j.tanggal > endDate) return false;
			return true;
		});
	}, [journals, startDate, endDate]);

	// Rekap per guru
	const guruJTMList = useMemo(() => {
		const map = {};

		guruList.forEach((g) => {
			const isWali = waliKelasNames.has(String(g.nama_lengkap || '').trim().toLowerCase()) ||
						   waliKelasNames.has(String(g.username || '').trim().toLowerCase());
			const tingkatan = getGuruTingkatanInfo(g.id_user, settings);

			map[g.id_user] = {
				guru: g,
				isWaliKelas: isWali,
				tingkatan,
				totalJP: 0,
				totalSesi: 0,
				dates: new Set(),
				kendalaCount: 0,
				sessions: [],
			};
		});

		filteredJournals.forEach((j) => {
			const gId = j.guru_id;
			if (map[gId]) {
				const jp = parseJTM(j.jam_ke);
				map[gId].totalJP += jp;
				map[gId].totalSesi += 1;
				map[gId].dates.add(j.tanggal);
				if (j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-') {
					map[gId].kendalaCount += 1;
				}
				map[gId].sessions.push({ ...j, jp });
			}
		});

		let list = Object.values(map);

		// Hitung skor kepatuhan presensi siswa per guru
		list.forEach((item) => {
			item.compliance = calculateGuruCompliance(item.sessions, crossMap);
		});

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter((item) =>
				(item.guru.nama_lengkap || '').toLowerCase().includes(q) ||
				(item.guru.username || '').toLowerCase().includes(q)
			);
		}

		return list.sort((a, b) => b.totalJP - a.totalJP);
	}, [guruList, filteredJournals, waliKelasNames, settings, crossMap, searchQuery]);

	// Total ringkasan
	const totalJPAll = useMemo(() => guruJTMList.reduce((acc, c) => acc + c.totalJP, 0), [guruJTMList]);
	const totalSesiAll = useMemo(() => guruJTMList.reduce((acc, c) => acc + c.totalSesi, 0), [guruJTMList]);
	
	const totalComplianceStats = useMemo(() => {
		let total = 0;
		let lengkap = 0;
		guruJTMList.forEach((item) => {
			if (item.compliance) {
				total += item.compliance.totalSesi;
				lengkap += item.compliance.sesiLengkap;
			}
		});
		const pct = total > 0 ? Math.round((lengkap / total) * 100) : 100;
		return { total, lengkap, belumLengkap: total - lengkap, pct };
	}, [guruJTMList]);

	// Preset tanggal
	const handlePreset = (type) => {
		const now = new Date();
		const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

		if (type === 'cutoff') {
			const def = getDefaultCutOffRange();
			setStartDate(def.startDate);
			setEndDate(def.endDate);
		} else if (type === 'thisMonth') {
			const first = new Date(now.getFullYear(), now.getMonth(), 1);
			const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			setStartDate(toYMD(first));
			setEndDate(toYMD(last));
		} else if (type === 'lastMonth') {
			const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const last = new Date(now.getFullYear(), now.getMonth(), 0);
			setStartDate(toYMD(first));
			setEndDate(toYMD(last));
		} else if (type === 'all') {
			setStartDate('');
			setEndDate('');
		}
	};

	// Ekspor CSV
	const handleExportCSV = () => {
		if (guruJTMList.length === 0) return;

		const headers = [
			'No',
			'Nama Guru',
			'Username',
			'Status Wali Kelas',
			'Hari Hadir Mengajar',
			'Total Sesi KBM',
			'Total Jam Pelajaran (JP)',
			'Kepatuhan Presensi Siswa (%)',
			'Sesi Lengkap Diabsen',
			'Sesi Belum Diabsen',
			'Jumlah Kendala',
		];
		const rows = guruJTMList.map((item, idx) => [
			idx + 1,
			`"${(item.guru.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(item.guru.username || '').replace(/"/g, '""')}"`,
			item.isWaliKelas ? 'Ya' : 'Bukan',
			item.dates.size,
			item.totalSesi,
			item.totalJP,
			`${item.compliance?.persentase || 0}%`,
			item.compliance?.sesiLengkap || 0,
			item.compliance?.sesiBelumLengkap || 0,
			item.kendalaCount,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `Rekap_JTM_Guru_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<div className='space-y-6'>
			{/* Header Title */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>⏱️</span>
						<span>Rekap Jam Tatap Muka (JTM) Guru</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Akumulasi jam mengajar riil hasil parsing jurnal KBM dan tingkat kepatuhan presensi siswa untuk bisaroh.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<button
						onClick={handleExportCSV}
						className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>
				</div>
			</div>

			{/* Filter Box */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					{/* Search */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Cari Dewan Guru
						</label>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Ketik nama atau @username...'
							className='neo-input !py-2 text-xs font-bold'
						/>
					</div>

					{/* Start Date */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Mulai
						</label>
						<input
							type='date'
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className='neo-input !py-2 text-xs font-mono font-bold'
						/>
					</div>

					{/* End Date */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Selesai
						</label>
						<input
							type='date'
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className='neo-input !py-2 text-xs font-mono font-bold'
						/>
					</div>
				</div>

				{/* Quick Preset Buttons */}
				<div className='flex flex-wrap items-center gap-2 pt-2 border-t-2 border-black/10'>
					<span className='text-[10px] font-black uppercase text-gray-500 mr-1'>Pintasan Periode:</span>
					<button
						onClick={() => handlePreset('cutoff')}
						className='px-3 py-1 bg-teal-200 hover:bg-teal-300 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
						📅 Periode Cut-Off (26-25)
					</button>
					<button
						onClick={() => handlePreset('thisMonth')}
						className='px-3 py-1 bg-yellow-200 hover:bg-yellow-300 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
						📆 Bulan Ini
					</button>
					<button
						onClick={() => handlePreset('lastMonth')}
						className='px-3 py-1 bg-gray-200 hover:bg-gray-300 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
						⏮️ Bulan Lalu
					</button>
					<button
						onClick={() => handlePreset('all')}
						className='px-3 py-1 bg-white hover:bg-gray-100 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
						Semua Tanggal
					</button>
				</div>
			</div>

			{/* Mini Summary Strip with Compliance Indicator */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
				<div className='bg-teal-100 border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[10px] font-black uppercase text-teal-900'>Total Dewan Guru Aktif</p>
						<p className='text-lg font-black text-black mt-0.5'>{guruJTMList.length} Guru</p>
					</div>
					<span className='text-2xl'>👥</span>
				</div>

				<div className='bg-yellow-200 border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[10px] font-black uppercase text-yellow-950'>Total Jam Pelajaran</p>
						<p className='text-lg font-black text-black mt-0.5'>{totalJPAll} JP <span className='text-xs font-bold text-gray-700'>({totalSesiAll} Sesi)</span></p>
					</div>
					<span className='text-2xl'>⏱️</span>
				</div>

				<div className={`border-2 rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between ${
					totalComplianceStats.pct >= 90 ? 'bg-emerald-100 border-emerald-800' : 'bg-amber-100 border-amber-800'
				}`}>
					<div>
						<p className='text-[10px] font-black uppercase text-gray-700'>Integritas Presensi Siswa</p>
						<p className='text-lg font-black text-black mt-0.5'>{totalComplianceStats.pct}% <span className='text-xs font-bold text-gray-700'>({totalComplianceStats.lengkap}/{totalComplianceStats.total} Sesi)</span></p>
					</div>
					<span className='text-2xl'>{totalComplianceStats.pct >= 90 ? '🟢' : '🟡'}</span>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
								<th className='px-4 py-3.5 text-center w-12'>No</th>
								<th className='px-4 py-3.5'>Dewan Guru</th>
								<th className='px-4 py-3.5 text-center'>Hadir Mengajar</th>
								<th className='px-4 py-3.5 text-center'>Total Sesi</th>
								<th className='px-4 py-3.5 text-center'>Total JP Riil</th>
								<th className='px-4 py-3.5 text-center'>Presensi Siswa</th>
								<th className='px-4 py-3.5 text-center'>Status Kendala</th>
								<th className='px-4 py-3.5 text-right'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
							{loading ? (
								<tr>
									<td colSpan={8} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Memuat rekap jam mengajar dewan guru...
									</td>
								</tr>
							) : guruJTMList.length === 0 ? (
								<tr>
									<td colSpan={8} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Tidak ada data guru atau jurnal yang cocok dengan filter tanggal ini.
									</td>
								</tr>
							) : (
								guruJTMList.map((item, idx) => (
									<tr key={item.guru.id_user || idx} className='hover:bg-yellow-50/60 transition-colors'>
										<td className='px-4 py-4 text-center font-mono font-black text-gray-600'>
											{idx + 1}
										</td>
										<td className='px-4 py-4'>
											<div className='flex items-center gap-3'>
												<div className='w-9 h-9 rounded-xl bg-teal-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
													{item.guru.nama_lengkap?.charAt(0).toUpperCase() || 'G'}
												</div>
												<div>
													<p className='font-black text-sm text-black'>{item.guru.nama_lengkap}</p>
													<div className='flex items-center gap-1.5 mt-0.5'>
														<span className='text-[10px] font-mono text-gray-500'>@{item.guru.username}</span>
														<span className='px-1.5 py-0.2 bg-teal-100 border border-teal-800 text-teal-900 text-[9px] font-black rounded uppercase'>
															{item.tingkatan?.nama} ({formatRupiah(item.tingkatan?.tarif_per_jp)}/JP)
														</span>
														{item.isWaliKelas && (
															<span className='px-1.5 py-0.2 bg-yellow-200 border border-yellow-800 text-yellow-950 text-[9px] font-black rounded uppercase'>
																Wali Kelas
															</span>
														)}
													</div>
												</div>
											</div>
										</td>
										<td className='px-4 py-4 text-center font-mono'>
											<span className='px-2.5 py-1 bg-emerald-100 border border-emerald-400 text-emerald-950 rounded-lg font-black'>
												{item.dates.size} Hari
											</span>
										</td>
										<td className='px-4 py-4 text-center font-mono'>
											<span className='px-2 py-0.5 bg-gray-100 border border-black/20 rounded font-black'>
												{item.totalSesi} Sesi
											</span>
										</td>
										<td className='px-4 py-4 text-center font-mono'>
											<span className='px-3 py-1 bg-yellow-300 border-2 border-black rounded-xl font-black text-black shadow-[2px_2px_0px_0px_#0D0D0D] text-xs'>
												{item.totalJP} JP
											</span>
										</td>
										{/* Tingkat Kepatuhan Presensi Siswa */}
										<td className='px-4 py-4 text-center'>
											{item.compliance ? (
												<div className='inline-flex flex-col items-center'>
													<span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black ${
														item.compliance.persentase >= 90
															? 'bg-emerald-100 border-emerald-500 text-emerald-950'
															: item.compliance.persentase >= 75
															? 'bg-amber-100 border-amber-500 text-amber-950'
															: 'bg-rose-100 border-rose-500 text-rose-950'
													}`}>
														{item.compliance.persentase}% Lengkap
													</span>
													<span className='text-[9px] text-gray-500 font-bold mt-0.5'>
														{item.compliance.sesiLengkap}/{item.compliance.totalSesi} Sesi
													</span>
												</div>
											) : (
												<span className='text-[10px] text-gray-400'>-</span>
											)}
										</td>
										<td className='px-4 py-4 text-center'>
											{item.kendalaCount > 0 ? (
												<span className='px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black rounded-lg'>
													⚠️ {item.kendalaCount} Kendala
												</span>
											) : (
												<span className='px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black rounded-lg'>
													✓ Lancar
												</span>
											)}
										</td>
										<td className='px-4 py-4 text-right'>
											<button
												onClick={() => setSelectedGuru(item)}
												className='px-3 py-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
												Detail Sesi ➔
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal Detail Sesi Mengajar Guru */}
			{selectedGuru && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Modal Header */}
						<div className='p-5 bg-teal-300 border-b-2 border-black flex items-center justify-between'>
							<div>
								<div className='flex items-center gap-2 mb-1'>
									<span className='text-[10px] font-black uppercase text-teal-950 bg-teal-200 px-2 py-0.5 rounded border border-teal-800 inline-block'>
										Rincian Bukti Mengajar
									</span>
									{selectedGuru.compliance && (
										<span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
											selectedGuru.compliance.persentase >= 90
												? 'bg-emerald-200 border-emerald-700 text-emerald-950'
												: 'bg-amber-200 border-amber-700 text-amber-950'
										}`}>
											Presensi Siswa: {selectedGuru.compliance.persentase}% ({selectedGuru.compliance.sesiLengkap}/{selectedGuru.compliance.totalSesi} Sesi)
										</span>
									)}
								</div>
								<h3 className='text-lg font-black text-black uppercase tracking-tight'>
									{selectedGuru.guru.nama_lengkap}
								</h3>
								<p className='text-xs font-bold text-gray-800 mt-0.5'>
									Total Jam Pelajaran: <span className='font-mono font-black'>{selectedGuru.totalJP} JP</span> ({selectedGuru.totalSesi} sesi pada periode ini)
								</p>
							</div>
							<button
								onClick={() => setSelectedGuru(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-rose-300 transition-colors'>
								✕
							</button>
						</div>

						{/* Modal Content Table */}
						<div className='p-4 overflow-y-auto flex-1 space-y-3'>
							{selectedGuru.sessions.length === 0 ? (
								<p className='text-center py-8 text-gray-500 font-bold'>
									Belum ada entri sesi jurnal pada rentang tanggal ini.
								</p>
							) : (
								<div className='border-2 border-black rounded-xl overflow-hidden'>
									<table className='w-full text-left border-collapse text-xs font-bold'>
										<thead>
											<tr className='bg-gray-100 border-b-2 border-black font-black uppercase text-[10px] text-gray-600'>
												<th className='px-3 py-2'>Tanggal</th>
												<th className='px-3 py-2'>Kelas & Mapel</th>
												<th className='px-3 py-2 text-center'>Jam Ke-</th>
												<th className='px-3 py-2 text-center'>JP</th>
												<th className='px-3 py-2 text-center'>Presensi Siswa</th>
												<th className='px-3 py-2'>Materi Pokok</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-black/10'>
											{selectedGuru.sessions.map((s, i) => {
												const val = validateJurnalWithAbsensi(s, crossMap);
												return (
													<tr key={s.id || i} className='hover:bg-teal-50/50 transition-colors'>
														<td className='px-3 py-2.5 font-mono text-gray-700 whitespace-nowrap'>{s.tanggal}</td>
														<td className='px-3 py-2.5'>
															<span className='font-black text-black'>{s.mapel}</span>
															<span className='text-[10px] text-gray-500 block font-normal'>Kelas {s.kelas}</span>
														</td>
														<td className='px-3 py-2.5 text-center font-mono'>{s.jam_ke}</td>
														<td className='px-3 py-2.5 text-center font-mono'>
															<span className='px-2 py-0.5 bg-yellow-200 border border-black/30 rounded font-black'>
																{s.jp} JP
															</span>
														</td>
														<td className='px-3 py-2.5 text-center whitespace-nowrap'>
															{val.isValid ? (
																<span className='px-2 py-0.5 bg-emerald-100 border border-emerald-500 text-emerald-950 text-[10px] font-black rounded-lg'>
																	✓ {val.studentCount} Siswa
																</span>
															) : (
																<span className='px-2 py-0.5 bg-amber-100 border border-amber-500 text-amber-950 text-[10px] font-black rounded-lg'>
																	⚠️ Belum Absen
																</span>
															)}
														</td>
														<td className='px-3 py-2.5'>
															<p className='line-clamp-1 text-black font-normal'>{s.materi || '-'}</p>
															{s.hambatan && s.hambatan.trim() && s.hambatan.trim() !== '-' && (
																<span className='text-[10px] text-rose-700 font-bold block mt-0.5'>
																	Kendala: {s.hambatan}
																</span>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex justify-between items-center text-xs font-black'>
							<span className='text-gray-500'>
								Terpilih {selectedGuru.sessions.length} sesi mengajar
							</span>
							<button
								onClick={() => setSelectedGuru(null)}
								className='px-5 py-2 bg-black text-white border-2 border-black rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
