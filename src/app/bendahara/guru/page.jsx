'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	formatRupiah,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
	getGuruTingkatanInfo,
	getPegawaiJabatanInfo,
} from '@/lib/bisaroh';

export default function BendaharaGuruPage() {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [kelas, setKelas] = useState([]);
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resUsers, resKelas, resSettings] = await Promise.all([
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/kelas').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
				]);

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
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
			} catch (err) {
				console.error('Error load guru data for bendahara:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Mapping wali kelas
	const waliKelasMap = useMemo(() => {
		const map = {};
		kelas.forEach((k) => {
			if (k.wali_kelas) {
				const wk = String(k.wali_kelas).trim().toLowerCase();
				map[wk] = k.nama_kelas || k.id_kelas;
			}
		});
		return map;
	}, [kelas]);

	// Filter guru & pegawai struktural berhak bisaroh
	const guruList = useMemo(() => {
		const assignedIds = new Set(Object.keys(settings?.user_jabatan_map || {}));
		const list = users
			.filter((u) => u.role === 'Guru' || u.role === 'Kepala Sekolah' || assignedIds.has(u.id_user))
			.map((g) => {
				const byName = waliKelasMap[String(g.nama_lengkap || '').trim().toLowerCase()];
				const byUser = waliKelasMap[String(g.username || '').trim().toLowerCase()];
				const waliKelasName = byName || byUser || null;
				const tingkatan = getGuruTingkatanInfo(g.id_user, settings);
				const jabatan = getPegawaiJabatanInfo(g.id_user, settings);

				return {
					...g,
					isWaliKelas: Boolean(waliKelasName),
					waliKelasName,
					tingkatan,
					jabatan,
				};
			});

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			return list.filter(
				(g) =>
					(g.nama_lengkap || '').toLowerCase().includes(q) ||
					(g.username || '').toLowerCase().includes(q) ||
					(g.id_user || '').toLowerCase().includes(q) ||
					(g.tingkatan?.nama || '').toLowerCase().includes(q) ||
					(g.jabatan?.nama || '').toLowerCase().includes(q)
			);
		}

		return list;
	}, [users, waliKelasMap, settings, searchQuery]);

	const waliCount = useMemo(() => guruList.filter((g) => g.isWaliKelas).length, [guruList]);
	const strukturalCount = useMemo(() => guruList.filter((g) => Boolean(g.jabatan)).length, [guruList]);

	// Ekspor CSV
	const handleExportCSV = () => {
		if (guruList.length === 0) return;

		const headers = [
			'No',
			'Nama Lengkap',
			'Username',
			'Role Sistem',
			'Jabatan Struktural',
			'Gaji Pokok Jabatan (Rp)',
			'Tunjangan Jabatan (Rp)',
			'Tingkatan Guru',
			'Tarif per JP (Rp)',
			'Status Wali Kelas',
			'Nama Rombel',
		];
		const rows = guruList.map((g, idx) => [
			idx + 1,
			`"${(g.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(g.username || '').replace(/"/g, '""')}"`,
			`"${(g.role || '').replace(/"/g, '""')}"`,
			`"${(g.jabatan?.nama || '-').replace(/"/g, '""')}"`,
			g.jabatan?.gaji_pokok || 0,
			g.jabatan?.tunjangan_jabatan || 0,
			`"${(g.tingkatan?.nama || '').replace(/"/g, '""')}"`,
			g.tingkatan?.tarif_per_jp || 0,
			g.isWaliKelas ? 'Ya' : 'Bukan',
			g.waliKelasName ? `Kelas ${g.waliKelasName}` : '-',
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `Daftar_Pegawai_dan_Guru_${new Date().toISOString().split('T')[0]}.csv`);
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
						<span>👥</span>
						<span>Data Pegawai, Guru & Hak Bisaroh</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Daftar tenaga pendidik & kependidikan, jabatan struktural, grade tingkatan, dan penugasan wali kelas.
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

			{/* Metric Cards */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Total Pegawai & Guru</p>
						<p className='text-2xl font-black text-black mt-0.5'>{guruList.length}</p>
					</div>
					<span className='w-10 h-10 bg-teal-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👥
					</span>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-purple-700'>Pejabat & Tendik</p>
						<p className='text-2xl font-black text-purple-950 mt-0.5'>{strukturalCount}</p>
					</div>
					<span className='w-10 h-10 bg-purple-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏛️
					</span>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Guru Wali Kelas</p>
						<p className='text-2xl font-black text-emerald-900 mt-0.5'>{waliCount}</p>
					</div>
					<span className='w-10 h-10 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏫
					</span>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Guru Pengajar Murni</p>
						<p className='text-2xl font-black text-indigo-900 mt-0.5'>
							{guruList.filter((g) => !g.jabatan && !g.isWaliKelas).length}
						</p>
					</div>
					<span className='w-10 h-10 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📖
					</span>
				</div>
			</div>

			{/* Search Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
				<input
					type='text'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder='Cari nama pegawai, username, jabatan, atau tingkatan...'
					className='neo-input !py-2.5 text-xs sm:text-sm font-bold'
				/>
			</div>

			{/* Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
								<th className='px-4 py-3.5 text-center w-12'>No</th>
								<th className='px-4 py-3.5'>Pegawai & Identitas</th>
								<th className='px-4 py-3.5'>Jabatan Struktural / Posisi</th>
								<th className='px-4 py-3.5'>Tingkatan & Tarif JP</th>
								<th className='px-4 py-3.5 text-center'>Tugas Tambahan</th>
								<th className='px-4 py-3.5 text-right'>Hak Finansial</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
							{loading ? (
								<tr>
									<td colSpan={6} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Memuat daftar pegawai & dewan guru...
									</td>
								</tr>
							) : guruList.length === 0 ? (
								<tr>
									<td colSpan={6} className='px-6 py-12 text-center text-gray-500 font-bold'>
										Tidak ada pegawai yang cocok dengan pencarian.
									</td>
								</tr>
							) : (
								guruList.map((g, idx) => (
									<tr key={g.id_user || idx} className='hover:bg-yellow-50/50 transition-colors'>
										<td className='px-4 py-3.5 text-center font-mono text-gray-500'>{idx + 1}</td>
										<td className='px-4 py-3.5'>
											<div className='flex items-center gap-3'>
												<div className='w-8 h-8 rounded-lg bg-teal-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{g.nama_lengkap?.charAt(0).toUpperCase() || 'P'}
												</div>
												<div>
													<span className='font-black text-sm text-black block'>{g.nama_lengkap}</span>
													<span className='text-[10px] text-gray-500 font-mono'>@{g.username}</span>
												</div>
											</div>
										</td>
										<td className='px-4 py-3.5'>
											{g.jabatan ? (
												<div>
													<span className='px-2 py-0.5 bg-purple-100 border border-purple-800 text-purple-950 rounded font-black text-xs inline-flex items-center gap-1'>
														<span>🏛️</span>
														<span>{g.jabatan.nama}</span>
													</span>
													<div className='text-[10px] text-gray-500 font-mono mt-0.5'>
														{g.jabatan.gaji_pokok > 0 && <span>Gapok: {formatRupiah(g.jabatan.gaji_pokok)} </span>}
														{g.jabatan.tunjangan_jabatan > 0 && <span>• Tunj: {formatRupiah(g.jabatan.tunjangan_jabatan)}</span>}
													</div>
												</div>
											) : (
												<span className='text-gray-400 text-xs'>Dewan Guru Pengajar</span>
											)}
										</td>
										<td className='px-4 py-3.5'>
											{g.jabatan?.kategori === 'tendik' ? (
												<span className='px-2 py-0.5 bg-gray-100 border border-gray-400 text-gray-600 rounded text-[10px] font-bold'>
													Tendik (Non-KBM)
												</span>
											) : (
												<div className='flex items-center gap-1.5 flex-wrap'>
													<span className='px-2.5 py-0.5 bg-violet-100 border border-violet-800 text-violet-900 rounded-md font-black text-xs inline-block'>
														{g.tingkatan?.nama || 'Standar'}
													</span>
													<span className='text-xs font-black text-gray-700 font-mono'>
														{formatRupiah(g.tingkatan?.tarif_per_jp || 0)}
														<span className='text-[10px] text-gray-400 font-normal'>/JP</span>
													</span>
												</div>
											)}
										</td>
										<td className='px-4 py-3.5 text-center'>
											{g.isWaliKelas ? (
												<span className='px-2.5 py-1 bg-teal-100 border border-teal-800 text-teal-900 rounded-lg font-black text-xs inline-block'>
													Wali Kelas {g.waliKelasName}
												</span>
											) : (
												<span className='text-gray-400'>-</span>
											)}
										</td>
										<td className='px-4 py-3.5 text-right'>
											<div className='space-y-0.5'>
												{g.jabatan?.gaji_pokok > 0 && (
													<span className='px-1.5 py-0.5 bg-purple-50 border border-purple-300 text-purple-900 rounded text-[9px] font-black uppercase block'>
														✓ Gaji Pokok
													</span>
												)}
												{g.jabatan?.tunjangan_jabatan > 0 && (
													<span className='px-1.5 py-0.5 bg-purple-50 border border-purple-300 text-purple-900 rounded text-[9px] font-black uppercase block'>
														✓ Tunj. Jabatan
													</span>
												)}
												{g.role === 'Guru' && (
													<span className='px-1.5 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-[9px] font-black uppercase block'>
														✓ Honor JTM Riil
													</span>
												)}
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
