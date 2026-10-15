'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';

export default function KepsekPenggunaPage() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [roleFilter, setRoleFilter] = useState('all');

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	useEffect(() => {
		const fetchUsers = async () => {
			try {
				setLoading(true);
				const res = await fetch('/api/users');
				if (res.ok) {
					const data = await res.json();
					setUsers(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				console.error('Gagal mengambil daftar pengguna:', err);
			} finally {
				setLoading(false);
			}
		};
		fetchUsers();
	}, []);

	// Reset page on filter changes
	useEffect(() => {
		setCurrentPage(1);
	}, [roleFilter, searchQuery]);

	const filteredUsers = useMemo(() => {
		return users.filter((u) => {
			const matchRole = roleFilter === 'all' || u.role === roleFilter;
			const q = searchQuery.toLowerCase().trim();
			const matchSearch =
				!q ||
				u.nama_lengkap.toLowerCase().includes(q) ||
				u.username.toLowerCase().includes(q) ||
				(u.id_user && u.id_user.toLowerCase().includes(q));
			return matchRole && matchSearch;
		});
	}, [users, roleFilter, searchQuery]);

	// Role counts
	const guruCount = useMemo(() => users.filter((u) => u.role === 'Guru').length, [users]);
	const kepsekCount = useMemo(() => users.filter((u) => u.role === 'Kepala Sekolah').length, [users]);
	const adminCount = useMemo(() => users.filter((u) => u.role === 'Admin').length, [users]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
	const paginatedUsers = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredUsers.slice(start, start + itemsPerPage);
	}, [filteredUsers, currentPage]);

	const isFilterActive = Boolean(searchQuery.trim()) || roleFilter !== 'all';

	const handleResetFilters = () => {
		setSearchQuery('');
		setRoleFilter('all');
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredUsers.length === 0) return;

		const headers = ['Nama Lengkap', 'Username', 'Peran / Hak Akses', 'ID Pengguna'];
		const rows = filteredUsers.map((u) => [
			`"${(u.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(u.username || '').replace(/"/g, '""')}"`,
			u.role || '',
			`"${(u.id_user || '').replace(/"/g, '""')}"`,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`daftar_pengguna_ptk_${new Date().toISOString().split('T')[0]}.csv`
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
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-indigo-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>👥</span> Data Staf & Pengajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Daftar Pengguna & Dewan Guru
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tinjau seluruh akun terdaftar, identitas pendidik, peran operasional, serta hak akses sistem sekolah.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto'>
					<button
						onClick={handleExportCSV}
						disabled={filteredUsers.length === 0}
						title='Unduh daftar akun pengguna dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-indigo-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-indigo-950 font-bold block'>Supervisi Eksekutif</span>
						<span className='text-gray-600 text-[10px] uppercase font-bold'>Akses Read-Only</span>
					</div>
				</div>
			</div>

			{/* User Statistics Row (Interactive as quick filters) */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
				<button
					onClick={() => setRoleFilter('all')}
					className={`bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						roleFilter === 'all' ? 'ring-2 ring-indigo-500 bg-indigo-50/40' : ''
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Total Akun</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{users.length}</p>
						<span className='text-[10px] font-bold text-gray-500'>Semua pengguna sistem</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👤
					</span>
				</button>

				<button
					onClick={() => setRoleFilter(roleFilter === 'Guru' ? 'all' : 'Guru')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						roleFilter === 'Guru' ? 'bg-emerald-100 ring-2 ring-emerald-600' : 'bg-emerald-50 hover:bg-emerald-100/60'
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-emerald-800'>Dewan Guru</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>{guruCount}</p>
						<span className='text-[10px] font-bold text-emerald-700'>
							{roleFilter === 'Guru' ? '✓ Filter aktif' : 'Klik filter guru'}
						</span>
					</div>
					<span className='w-11 h-11 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👨‍🏫
					</span>
				</button>

				<button
					onClick={() => setRoleFilter(roleFilter === 'Kepala Sekolah' ? 'all' : 'Kepala Sekolah')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						roleFilter === 'Kepala Sekolah' ? 'bg-indigo-100 ring-2 ring-indigo-600' : 'bg-indigo-50 hover:bg-indigo-100/60'
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-indigo-800'>Kepala Sekolah</p>
						<p className='text-2xl sm:text-3xl font-black text-indigo-950 mt-0.5'>{kepsekCount}</p>
						<span className='text-[10px] font-bold text-indigo-700'>
							{roleFilter === 'Kepala Sekolah' ? '✓ Filter aktif' : 'Klik filter kepsek'}
						</span>
					</div>
					<span className='w-11 h-11 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🎓
					</span>
				</button>

				<button
					onClick={() => setRoleFilter(roleFilter === 'Admin' ? 'all' : 'Admin')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						roleFilter === 'Admin' ? 'bg-rose-100 ring-2 ring-rose-600' : 'bg-rose-50 hover:bg-rose-100/60'
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-rose-800'>Administrator</p>
						<p className='text-2xl sm:text-3xl font-black text-rose-950 mt-0.5'>{adminCount}</p>
						<span className='text-[10px] font-bold text-rose-700'>
							{roleFilter === 'Admin' ? '✓ Filter aktif' : 'Klik filter admin'}
						</span>
					</div>
					<span className='w-11 h-11 bg-rose-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-white text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🛡️
					</span>
				</button>
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
						placeholder='Cari nama lengkap, username, atau ID...'
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
					<div className='flex flex-wrap items-center gap-1.5 bg-indigo-100 p-1.5 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						{[
							{ id: 'all', label: 'Semua Role' },
							{ id: 'Guru', label: 'Guru' },
							{ id: 'Kepala Sekolah', label: 'Kepsek' },
							{ id: 'Admin', label: 'Admin' },
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setRoleFilter(tab.id)}
								className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap border-2 cursor-pointer ${
									roleFilter === tab.id
										? 'bg-black text-white border-black shadow-[1px_1px_0px_0px_#818CF8]'
										: 'bg-white text-black border-transparent hover:border-black hover:bg-indigo-200'
								}`}>
								{tab.label}
							</button>
						))}
					</div>

					{isFilterActive && (
						<button
							onClick={handleResetFilters}
							className='inline-flex items-center gap-1 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer whitespace-nowrap'>
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
							<tr className='bg-indigo-300 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Nama Pengguna</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Peran / Hak Akses</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Username & ID Sistem</th>
								<th className='px-5 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Status Akun</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedUsers.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-indigo-50/50'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ada pengguna yang sesuai kriteria</p>
											<p className='text-xs text-gray-500'>Coba ubah kata kunci pencarian atau reset filter role.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-indigo-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedUsers.map((u) => {
									const initial = u.nama_lengkap ? u.nama_lengkap.charAt(0).toUpperCase() : '?';
									let roleBadge = 'bg-yellow-200 text-yellow-950 border-yellow-400';
									if (u.role === 'Guru') roleBadge = 'bg-emerald-200 text-emerald-950 border-emerald-400';
									else if (u.role === 'Kepala Sekolah') roleBadge = 'bg-indigo-200 text-indigo-950 border-indigo-400';
									else if (u.role === 'Admin') roleBadge = 'bg-rose-200 text-rose-950 border-rose-400';

									return (
										<tr
											key={u.id_user || u.username}
											className='hover:bg-indigo-50/50 transition-colors'>
											<td className='px-5 py-4 whitespace-nowrap'>
												<div className='flex items-center gap-3'>
													<div className='w-9 h-9 rounded-xl bg-indigo-200 border-2 border-black flex items-center justify-center font-black text-sm shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
														{initial}
													</div>
													<div>
														<span className='font-black text-xs sm:text-sm text-black block'>
															{u.nama_lengkap || 'Tanpa Nama'}
														</span>
														<span className='text-[10px] text-gray-500'>
															Terdaftar resmi di database
														</span>
													</div>
												</div>
											</td>

											<td className='px-5 py-4 whitespace-nowrap'>
												<span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D] ${roleBadge}`}>
													{u.role}
												</span>
											</td>

											<td className='px-5 py-4 whitespace-nowrap'>
												<span className='font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-black/20 block w-fit'>
													@{u.username}
												</span>
												<span className='text-[10px] font-mono text-gray-500 block mt-1'>
													ID: {u.id_user || '-'}
												</span>
											</td>

											<td className='px-5 py-4 text-right whitespace-nowrap'>
												<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold'>
													<span>●</span> Aktif
												</span>
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
						Menampilkan <span className='font-black text-black'>{filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredUsers.length}</span> akun pengguna
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
		</div>
	);
}
