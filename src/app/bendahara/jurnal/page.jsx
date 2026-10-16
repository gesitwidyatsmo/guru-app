'use client';

import { useState, useEffect, useMemo } from 'react';
import { parseJTM } from '@/lib/bisaroh';

export default function BendaharaJurnalPage() {
	const [loading, setLoading] = useState(true);
	const [journals, setJournals] = useState([]);
	const [users, setUsers] = useState([]);

	// Filters
	const [filterDate, setFilterDate] = useState('');
	const [filterGuru, setFilterGuru] = useState('all');
	const [filterKelas, setFilterKelas] = useState('all');
	const [filterMapel, setFilterMapel] = useState('all');
	const [onlyKendala, setOnlyKendala] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Detail Modal
	const [selectedJournal, setSelectedJournal] = useState(null);

	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 15;

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resJurnal, resUsers] = await Promise.all([
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/users').catch(() => ({ ok: false })),
				]);

				if (resJurnal.ok) {
					const data = await resJurnal.json();
					setJournals(Array.isArray(data) ? data : []);
				}

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
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
		return Array.from(guruIds).map((id) => guruMap[id] || { id_user: id, nama_lengkap: `ID: ${id}` });
	}, [journals, guruMap]);

	const uniqueKelas = useMemo(() => {
		const set = new Set(journals.map((j) => j.kelas).filter(Boolean));
		return Array.from(set).sort();
	}, [journals]);

	const uniqueMapel = useMemo(() => {
		const set = new Set(journals.map((j) => j.mapel).filter(Boolean));
		return Array.from(set).sort();
	}, [journals]);

	// Filtered Journals
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (filterDate && j.tanggal !== filterDate) return false;
			if (filterGuru !== 'all' && j.guru_id !== filterGuru) return false;
			if (filterKelas !== 'all' && j.kelas !== filterKelas) return false;
			if (filterMapel !== 'all' && j.mapel !== filterMapel) return false;
			if (onlyKendala && (!j.hambatan || !j.hambatan.trim() || j.hambatan.trim() === '-')) return false;

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const guruName = (guruMap[j.guru_id]?.nama_lengkap || '').toLowerCase();
				const materi = (j.materi || '').toLowerCase();
				const mapel = (j.mapel || '').toLowerCase();
				return guruName.includes(q) || materi.includes(q) || mapel.includes(q);
			}

			return true;
		});
	}, [journals, filterDate, filterGuru, filterKelas, filterMapel, onlyKendala, searchQuery, guruMap]);

	// Pagination
	const totalPages = Math.max(1, Math.ceil(filteredJournals.length / itemsPerPage));
	const paginatedJournals = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredJournals.slice(start, start + itemsPerPage);
	}, [filteredJournals, currentPage]);

	// Reset page on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterDate, filterGuru, filterKelas, filterMapel, onlyKendala, searchQuery]);

	// Preset Hari Ini
	const handleHariIni = () => {
		const now = new Date();
		const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		setFilterDate(filterDate === ymd ? '' : ymd);
	};

	// Ekspor CSV
	const handleExportCSV = () => {
		if (filteredJournals.length === 0) return;

		const headers = ['Tanggal', 'Guru Pengajar', 'Kelas', 'Mata Pelajaran', 'Jam Ke', 'Durasi JP', 'Materi Pembelajaran', 'Kendala / Hambatan', 'Status'];
		const rows = filteredJournals.map((j) => {
			const guruName = guruMap[j.guru_id]?.nama_lengkap || j.guru_id;
			return [
				j.tanggal || '',
				`"${guruName.replace(/"/g, '""')}"`,
				j.kelas || '',
				`"${(j.mapel || '').replace(/"/g, '""')}"`,
				j.jam_ke || '',
				parseJTM(j.jam_ke),
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

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>📖</span>
						<span>Audit Jurnal Pembelajaran Guru</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Verifikasi bukti fisik KBM, materi pokok, dan catatan kendala sebelum persetujuan bisaroh.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<button
						onClick={handleExportCSV}
						className='px-3.5 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>
				</div>
			</div>

			{/* Filter Box */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
					{/* Search */}
					<div className='lg:col-span-2'>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Pencarian</label>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari guru, materi, atau mapel...'
							className='neo-input !py-2 text-xs font-bold'
						/>
					</div>

					{/* Date Filter */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Filter Tanggal</label>
						<div className='flex items-center gap-1'>
							<input
								type='date'
								value={filterDate}
								onChange={(e) => setFilterDate(e.target.value)}
								className='neo-input !py-2 text-xs font-mono font-bold flex-1'
							/>
							<button
								type='button'
								onClick={handleHariIni}
								className={`px-2 py-2 border-2 border-black rounded-lg text-[10px] font-black uppercase shrink-0 ${
									filterDate ? 'bg-yellow-300' : 'bg-gray-100 hover:bg-gray-200'
								}`}>
								Hari Ini
							</button>
						</div>
					</div>

					{/* Kelas */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Kelas</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white'>
							<option value='all'>Semua Kelas</option>
							{uniqueKelas.map((k) => (
								<option key={k} value={k}>Kelas {k}</option>
							))}
						</select>
					</div>

					{/* Mapel */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Mata Pelajaran</label>
						<select
							value={filterMapel}
							onChange={(e) => setFilterMapel(e.target.value)}
							className='neo-input !py-2 text-xs font-bold bg-white'>
							<option value='all'>Semua Mapel</option>
							{uniqueMapel.map((m) => (
								<option key={m} value={m}>{m}</option>
							))}
						</select>
					</div>
				</div>

				{/* Quick Toggle Toggles */}
				<div className='flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-black/10'>
					<div className='flex items-center gap-2'>
						<label className='inline-flex items-center gap-2 cursor-pointer text-xs font-black uppercase'>
							<input
								type='checkbox'
								checked={onlyKendala}
								onChange={(e) => setOnlyKendala(e.target.checked)}
								className='w-4 h-4 rounded border-2 border-black text-rose-600 focus:ring-rose-500'
							/>
							<span>⚠️ Hanya yang Memiliki Kendala</span>
						</label>
					</div>

					<div className='flex items-center gap-2 text-xs font-bold text-gray-600'>
						<span>Ditemukan: <strong className='text-black'>{filteredJournals.length}</strong> entri jurnal</span>
						{(filterDate || filterGuru !== 'all' || filterKelas !== 'all' || filterMapel !== 'all' || onlyKendala || searchQuery) && (
							<button
								onClick={() => {
									setFilterDate('');
									setFilterGuru('all');
									setFilterKelas('all');
									setFilterMapel('all');
									setOnlyKendala(false);
									setSearchQuery('');
								}}
								className='text-rose-700 font-black hover:underline ml-2'>
								Reset Filter
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
								<th className='px-4 py-3.5 w-28'>Tanggal</th>
								<th className='px-4 py-3.5'>Guru Pengajar</th>
								<th className='px-4 py-3.5'>Kelas & Mapel</th>
								<th className='px-4 py-3.5 text-center'>Jam Ke-</th>
								<th className='px-4 py-3.5 text-center'>Durasi</th>
								<th className='px-4 py-3.5'>Materi & Kendala</th>
								<th className='px-4 py-3.5 text-right'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
							{loading ? (
								<tr>
									<td colSpan={7} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Memuat log jurnal pembelajaran...
									</td>
								</tr>
							) : paginatedJournals.length === 0 ? (
								<tr>
									<td colSpan={7} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Tidak ada entri jurnal yang cocok dengan kriteria audit.
									</td>
								</tr>
							) : (
								paginatedJournals.map((j) => {
									const guru = guruMap[j.guru_id];
									const guruName = guru?.nama_lengkap || `ID: ${j.guru_id}`;
									const hasKendala = j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-';

									return (
										<tr key={j.id} className='hover:bg-yellow-50/60 transition-colors'>
											<td className='px-4 py-3.5 font-mono whitespace-nowrap text-gray-700'>
												{j.tanggal}
											</td>
											<td className='px-4 py-3.5'>
												<p className='font-black text-black'>{guruName}</p>
												<span className='text-[10px] text-gray-500 font-mono'>@{guru?.username || '-'}</span>
											</td>
											<td className='px-4 py-3.5 whitespace-nowrap'>
												<span className='font-black text-black block'>{j.mapel}</span>
												<span className='text-[10px] text-gray-500 font-bold'>Kelas {j.kelas}</span>
											</td>
											<td className='px-4 py-3.5 text-center font-mono'>
												<span className='px-2 py-0.5 bg-gray-100 border border-black/20 rounded font-black'>
													{j.jam_ke}
												</span>
											</td>
											<td className='px-4 py-3.5 text-center font-mono'>
												<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg font-black text-teal-950'>
													{parseJTM(j.jam_ke)} JP
												</span>
											</td>
											<td className='px-4 py-3.5 max-w-xs'>
												<p className='line-clamp-1 text-black'>{j.materi || '-'}</p>
												{hasKendala ? (
													<span className='inline-block text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 px-1.5 py-0.2 rounded mt-0.5 line-clamp-1'>
														⚠️ {j.hambatan}
													</span>
												) : (
													<span className='text-[10px] text-emerald-700 font-bold'>✓ KBM tuntas</span>
												)}
											</td>
											<td className='px-4 py-3.5 text-right'>
												<button
													onClick={() => setSelectedJournal(j)}
													className='px-2.5 py-1 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
													Audit ➔
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
					<div className='p-4 bg-gray-50 border-t-2 border-black flex items-center justify-between text-xs font-black'>
						<span>Halaman {currentPage} dari {totalPages}</span>
						<div className='flex items-center gap-1.5'>
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								className='px-3 py-1 bg-white border border-black rounded-lg disabled:opacity-50'>
								Prev
							</button>
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								className='px-3 py-1 bg-white border border-black rounded-lg disabled:opacity-50'>
								Next
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Modal Detail Audit */}
			{selectedJournal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-yellow-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>Audit Entri Jurnal KBM</h3>
							<button
								onClick={() => setSelectedJournal(null)}
								className='w-7 h-7 bg-white border-2 border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<div className='p-5 space-y-3 text-xs'>
							<div>
								<span className='text-[10px] uppercase font-bold text-gray-500'>Guru Pengajar:</span>
								<p className='font-black text-base text-black'>
									{guruMap[selectedJournal.guru_id]?.nama_lengkap || selectedJournal.guru_id}
								</p>
							</div>

							<div className='grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-black/15'>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Tanggal:</span>
									<span className='font-mono font-black'>{selectedJournal.tanggal}</span>
								</div>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Jam Ke- & Durasi:</span>
									<span className='font-mono font-black'>
										Jam {selectedJournal.jam_ke} ({parseJTM(selectedJournal.jam_ke)} JP)
									</span>
								</div>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Kelas:</span>
									<span className='font-black'>Kelas {selectedJournal.kelas}</span>
								</div>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Mata Pelajaran:</span>
									<span className='font-black'>{selectedJournal.mapel}</span>
								</div>
							</div>

							<div>
								<span className='text-[10px] uppercase font-bold text-gray-500'>Materi Pokok:</span>
								<p className='font-bold text-black mt-0.5'>{selectedJournal.materi || '-'}</p>
							</div>

							{selectedJournal.kegiatan && (
								<div>
									<span className='text-[10px] uppercase font-bold text-gray-500'>Kegiatan KBM:</span>
									<p className='text-gray-700 mt-0.5 whitespace-pre-wrap'>{selectedJournal.kegiatan}</p>
								</div>
							)}

							{selectedJournal.hambatan && selectedJournal.hambatan.trim() && selectedJournal.hambatan.trim() !== '-' && (
								<div className='p-3 bg-rose-50 border border-rose-300 rounded-xl'>
									<span className='text-[10px] uppercase font-black text-rose-800 block'>⚠️ Kendala / Hambatan Mengajar:</span>
									<p className='text-rose-950 font-bold mt-0.5'>{selectedJournal.hambatan}</p>
									{selectedJournal.solusi && (
										<p className='text-[11px] text-rose-800 mt-1'>Solusi: {selectedJournal.solusi}</p>
									)}
								</div>
							)}
						</div>

						<div className='p-4 bg-gray-50 border-t-2 border-black flex justify-end'>
							<button
								onClick={() => setSelectedJournal(null)}
								className='px-5 py-2 bg-black text-white border-2 border-black rounded-xl text-xs font-black uppercase hover:bg-gray-800'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
