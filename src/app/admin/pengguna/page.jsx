'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';

export default function PenggunaPage() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);

	const [searchQuery, setSearchQuery] = useState('');
	const [roleFilter, setRoleFilter] = useState('all');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);

	const [formData, setFormData] = useState({
		username: '',
		password: '', // Untuk create baru wajib, edit opsional
		nama_lengkap: '',
		role: 'Guru', // Default
	});

	const fetchUsers = async () => {
		try {
			const response = await fetch('/api/users');
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Akses Ditolak');
			}
			const data = await response.json();
			setUsers(data);
		} catch (error) {
			Swal.fire('Terjadi Kesalahan', error.message, 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, []);

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

	const guruCount = useMemo(() => users.filter((u) => u.role === 'Guru').length, [users]);
	const adminCount = useMemo(() => users.filter((u) => u.role === 'Admin').length, [users]);

	const openCreateModal = () => {
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			username: '',
			password: '',
			nama_lengkap: '',
			role: 'Guru',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (user) => {
		setIsEditMode(true);
		setEditId(user.id_user);
		setFormData({
			username: user.username,
			password: '', // Dikosongkan, diset null jika tidak ingin ganti password
			nama_lengkap: user.nama_lengkap,
			role: user.role,
		});
		setIsModalOpen(true);
	};

	const handleDelete = async (user) => {
		const result = await Swal.fire({
			title: 'Cabut Akses Pengguna?',
			text: `Pengguna "${user.nama_lengkap}" (@${user.username}) akan segera dicabut akses loginnya dari sistem.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Cabut Akses!',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const response = await fetch(`/api/users?id_user=${user.id_user}`, {
					method: 'DELETE',
				});

				if (!response.ok) {
					const fault = await response.json();
					throw new Error(fault.error || 'Server error.');
				}

				Swal.fire('Terhapus!', 'Pengguna telah berhasil dihapus.', 'success');
				fetchUsers();
			} catch (err) {
				Swal.fire('Gagal Menghapus', err.message, 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.username.trim() || !formData.nama_lengkap.trim() || !formData.role) {
			Swal.fire('Kolom Wajib', 'Silakan lengkapi parameter Username, Nama Lengkap, & Role!', 'warning');
			return;
		}

		if (!isEditMode && !formData.password) {
			Swal.fire('Sandi Kosong', 'Akun pendaftar baru wajib memiliki kata sandi!', 'warning');
			return;
		}

		try {
			let response;
			const payload = { ...formData };

			if (isEditMode) {
				response = await fetch('/api/users', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id_user: editId,
						username: payload.username.trim(),
						nama_lengkap: payload.nama_lengkap.trim(),
						role: payload.role,
						password_baru: payload.password ? payload.password : undefined,
					}),
				});
			} else {
				response = await fetch('/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...payload,
						username: payload.username.trim(),
						nama_lengkap: payload.nama_lengkap.trim(),
					}),
				});
			}

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Terjadi kesalahan pada sistem backend.');
			}

			Swal.fire('Berhasil!', data.message || 'Data pengguna berhasil disimpan!', 'success');
			setIsModalOpen(false);
			fetchUsers();
		} catch (err) {
			Swal.fire('Peringatan', err.message, 'error');
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>👥</span> Manajemen Hak Akses
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Pengguna & Akun
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tambah, modifikasi profil, tentukan peran (Role), serta reset kata sandi akun Guru & Administrator.
					</p>
				</div>

				<button
					onClick={openCreateModal}
					className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-3 !px-5 whitespace-nowrap shrink-0 self-stretch sm:self-auto justify-center'>
					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
						<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
					</svg>
					<span>Tambah Pengguna Baru</span>
				</button>
			</div>

			{/* User Statistics Row */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Total Pengguna</p>
						<p className='text-2xl font-black text-black mt-0.5'>{users.length}</p>
					</div>
					<span className='w-10 h-10 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👤
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-800'>Dewan Guru (Pengajar)</p>
						<p className='text-2xl font-black text-emerald-900 mt-0.5'>{guruCount}</p>
					</div>
					<span className='w-10 h-10 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</span>
				</div>

				<div className='bg-rose-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-rose-800'>Administrator (Master)</p>
						<p className='text-2xl font-black text-rose-900 mt-0.5'>{adminCount}</p>
					</div>
					<span className='w-10 h-10 bg-rose-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🛡️
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div className='relative w-full sm:w-80'>
					<svg
						className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2'
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
						placeholder='Cari nama, username, atau ID...'
						className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
					/>
				</div>

				<div className='flex flex-wrap items-center gap-1.5 bg-yellow-100 p-1.5 border-2 border-black rounded-xl w-full sm:w-auto shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
					{[
						{ id: 'all', label: 'Semua Role' },
						{ id: 'Guru', label: 'Guru' },
						{ id: 'Admin', label: 'Admin' },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setRoleFilter(tab.id)}
							className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap border-2 ${
								roleFilter === tab.id
									? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#F5C518]'
									: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200'
							}`}>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Pengguna</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Role / Hak Akses</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Username / ID</th>
								<th className='px-6 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{filteredUsers.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-yellow-50/50'>
										Tidak ada pengguna yang cocok dengan kriteria pencarian &ldquo;{searchQuery}&rdquo;.
									</td>
								</tr>
							) : (
								filteredUsers.map((u) => {
									const initial = u.nama_lengkap ? u.nama_lengkap.charAt(0).toUpperCase() : '?';
									const isAdmin = u.role === 'Admin';
									return (
										<tr
											key={u.id_user}
											className='hover:bg-yellow-50 transition-colors'>
											{/* Name & Avatar */}
											<td className='px-6 py-4'>
												<div className='flex items-center gap-3'>
													<div className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] ${isAdmin ? 'bg-rose-400 text-white' : 'bg-teal-300 text-black'}`}>
														{initial}
													</div>
													<div>
														<span className='font-black text-black block text-sm sm:text-base'>
															{u.nama_lengkap}
														</span>
														<span className='text-[11px] font-bold text-gray-500'>
															{isAdmin ? 'Akses Penuh Administrator' : 'Tenaga Pendidik / Pengajar'}
														</span>
													</div>
												</div>
											</td>

											{/* Role Badge */}
											<td className='px-6 py-4'>
												<span
													className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] uppercase ${
														isAdmin
															? 'bg-rose-400 text-white'
															: 'bg-emerald-300 text-black'
													}`}>
													<span>{isAdmin ? '🛡️' : '👨‍🏫'}</span>
													<span>{u.role}</span>
												</span>
											</td>

											{/* Username & ID */}
											<td className='px-6 py-4'>
												<div className='flex flex-col items-start gap-0.5'>
													<span className='font-mono font-black text-xs sm:text-sm text-black bg-yellow-100 px-2 py-0.5 rounded border border-black/30'>
														@{u.username}
													</span>
													<span className='text-[10px] font-mono text-gray-500 font-bold'>
														ID: {u.id_user}
													</span>
												</div>
											</td>

											{/* Action Buttons */}
											<td className='px-6 py-4 text-right'>
												<div className='flex items-center justify-end gap-2'>
													<button
														onClick={() => openEditModal(u)}
														title='Ubah Profil / Reset Sandi'
														className='p-2 bg-yellow-200 hover:bg-yellow-400 text-black border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
														<svg
															className='w-4 h-4'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'
															strokeWidth='2.5'>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
															/>
														</svg>
													</button>
													<button
														onClick={() => handleDelete(u)}
														title='Cabut Akses Akun Pengguna'
														className='p-2 bg-rose-200 hover:bg-rose-500 hover:text-white text-rose-900 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
														<svg
															className='w-4 h-4'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'
															strokeWidth='2.5'>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
															/>
														</svg>
													</button>
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

			{/* Modal UI Pendaftaran & Edit Pengguna */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-yellow-300'>
							<h3 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
								<span>{isEditMode ? '✏️' : '✨'}</span>
								<span>{isEditMode ? 'Edit Profil & Akses Pengguna' : 'Pendaftaran Pengguna Baru'}</span>
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 bg-[var(--background)]'>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div>
									<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
										Nama Lengkap & Gelar <span className='text-rose-600'>*</span>
									</label>
									<input
										type='text'
										required
										value={formData.nama_lengkap}
										onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
										className='neo-input text-sm'
										placeholder='Contoh: Drs. Budi Santoso, M.Pd'
									/>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Username Login <span className='text-rose-600'>*</span>
										</label>
										<input
											type='text'
											required
											value={formData.username}
											onChange={(e) => setFormData({ ...formData, username: e.target.value })}
											className='neo-input text-sm font-mono'
											placeholder='budi_santoso'
										/>
									</div>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Peran / Role <span className='text-rose-600'>*</span>
										</label>
										<select
											value={formData.role}
											onChange={(e) => setFormData({ ...formData, role: e.target.value })}
											className='neo-input text-sm bg-white font-bold'>
											<option value='Guru'>👨‍🏫 Guru (Pengajar/Wali)</option>
											<option value='Admin'>🛡️ Admin (Super Master)</option>
										</select>
									</div>
								</div>

								<div>
									<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
										{isEditMode ? 'Ganti Kata Sandi (Kosongkan bila tidak diubah)' : 'Kata Sandi Awal *'}
									</label>
									<input
										type='password'
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										className='neo-input text-sm font-mono'
										placeholder={isEditMode ? 'Ketik sandi baru untuk mereset...' : 'Minimal 6 karakter kombinasi'}
									/>
									<p className='text-[11px] font-bold text-gray-500 mt-1'>
										{isEditMode
											? 'Biarkan kosong jika kata sandi lama masih ingin dipertahankan.'
											: 'Kredensial ini akan langsung digunakan guru untuk masuk ke GuruApp.'}
									</p>
								</div>

								<div className='pt-4 border-t-2 border-black/10 flex gap-3'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='neo-btn-outline flex-1 text-center justify-center text-xs sm:text-sm !py-2.5'>
										Batal
									</button>
									<button
										type='submit'
										className='neo-btn-primary flex-1 text-center justify-center text-xs sm:text-sm !py-2.5 bg-black text-white'>
										{isEditMode ? 'Simpan Perubahan' : 'Daftarkan Akun'}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
