'use client';

import { useState, useEffect } from 'react';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';

export default function PenggunaPage() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);

	const [formData, setFormData] = useState({
		username: '',
		password: '', // Untuk create baru wajib, edit bebas
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
			title: 'Hapus Akses Pengguna?',
			text: `Pengguna ${user.nama_lengkap} akan segera dicabut aksesnya.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Ya, Hapus!',
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
				Swal.fire('Kegagalan Menghapus', err.message, 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.username || !formData.nama_lengkap || !formData.role) {
			Swal.fire('Kolom Wajib', 'Silakan isi parameter Username, Nama Lengkap, & Role!', 'warning');
			return;
		}

		if (!isEditMode && !formData.password) {
			Swal.fire('Sandi Kosong', 'Akun pendaftar baru wajib memiliki sandi!', 'warning');
			return;
		}

		try {
			let response;
			const payload = { ...formData };

			if (isEditMode) {
				// Modifikasi
				response = await fetch('/api/users', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id_user: editId,
						username: payload.username,
						nama_lengkap: payload.nama_lengkap,
						role: payload.role,
						password_baru: payload.password, // Menerima payload reset pwd API PUT backend
					}),
				});
			} else {
				// Insert Baru
				response = await fetch('/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
			}

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Terjadi kesalahan tidak wajar pada sistem API.');
			}

			Swal.fire('Berhasil!', data.message || 'Tugas selesai!', 'success');
			setIsModalOpen(false);
			fetchUsers();
		} catch (err) {
			Swal.fire('Peringatan Proses', err.message, 'error');
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-gray-50 flex-1 relative w-full pb-10 min-h-screen'>
				<div className='flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-gray-100 gap-4 mt-8'>
					<div>
						<h1 className='text-3xl font-extrabold text-gray-800 tracking-tight'>Manajemen Pengguna</h1>
						<p className='text-sm text-gray-500 mt-2 font-medium'>Eksklusif Admin: Tambah, modifikasi dan reset akses peramban Guru.</p>
					</div>

					<button
						onClick={openCreateModal}
						className='flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-95'>
						<svg
							className='w-5 h-5'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 4v16m8-8H4'
							/>
						</svg>
						Tambah Pengguna Baru
					</button>
				</div>

				<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-full'>
							<thead>
								<tr className='bg-gray-50/50 border-b border-gray-100'>
									<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Nama Lengkap</th>
									<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Akses (Role)</th>
									<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>ID Sistem / Login</th>
									<th className='px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider'>Pengaturan Cepat</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-100'>
								{users.length === 0 ? (
									<tr>
										<td
											colSpan={4}
											className='px-6 py-8 text-center text-sm font-medium text-gray-500 bg-gray-50/50'>
											Tidak terdapat rekam user terpantau.
										</td>
									</tr>
								) : (
									users.map((u) => (
										<tr
											key={u.id_user}
											className='hover:bg-gray-50/50 transition-colors'>
											<td className='px-6 py-4'>
												<span className='font-semibold text-gray-800'>{u.nama_lengkap}</span>
											</td>
											<td className='px-6 py-4'>
												<span className={`px-3 py-1 text-xs font-semibold rounded-full ${u.role === 'Admin' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.role}</span>
											</td>
											<td className='px-6 py-4'>
												<div className='flex items-center flex-col items-start gap-1'>
													<span className='font-medium text-gray-600 font-mono'>@{u.username}</span>
													<span className='text-[11px] text-gray-400'>ID: {u.id_user}</span>
												</div>
											</td>
											<td className='px-6 py-4'>
												<div className='flex items-center justify-end gap-2'>
													<button
														onClick={() => openEditModal(u)}
														className='p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors'
														title='Ubah Akses Profil'>
														<svg
															className='w-5 h-5'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																strokeWidth={2}
																d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
															/>
														</svg>
													</button>
													<button
														onClick={() => handleDelete(u)}
														className='p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors'
														title='Hancurkan Kredensial Pengguna Ini'>
														<svg
															className='w-5 h-5'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																strokeWidth={2}
																d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
															/>
														</svg>
													</button>
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

			{/* Modal UI Pendaftaran Pengguna */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm'>
					<div className='bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200'>
						<div className='px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50'>
							<h3 className='text-lg font-bold text-gray-800'>{isEditMode ? 'Edit Pengaturan Akses & Profil' : 'Pendaftaran Pengguna Baru'}</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='text-gray-400 hover:text-gray-600 transition-colors p-1'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>

						<div className='p-6'>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Nama Lengkap</label>
									<input
										type='text'
										required
										value={formData.nama_lengkap}
										onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
										className='w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm text-gray-600'
										placeholder='Budi Santoso S.Pd'
									/>
								</div>

								<div className='grid grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Username</label>
										<input
											type='text'
											required
											value={formData.username}
											onChange={(e) => setFormData({ ...formData, username: e.target.value })}
											className='w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm text-gray-600'
											placeholder='budi77'
										/>
									</div>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Role Pangkat</label>
										<select
											value={formData.role}
											onChange={(e) => setFormData({ ...formData, role: e.target.value })}
											className='w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm bg-white'>
											<option value='Guru'>Guru (Wali/Pengajar)</option>
											<option value='Admin'>Kepala Admin (Master)</option>
										</select>
									</div>
								</div>

								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>{isEditMode ? 'Ganti Sandi Pengguna (Kosongkan bila sandi lawas masih aman)' : 'Kata Sandi / Password'}</label>
									<input
										type='password'
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										className='w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm text-gray-600'
										placeholder={isEditMode ? 'Ketik sandi mutakhir' : 'Wajib diisikan saat pendaftaran baru'}
									/>
								</div>

								<div className='pt-4 flex gap-3'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium'>
										Batal
									</button>
									<button
										type='submit'
										className='flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium'>
										{isEditMode ? 'Simpan Data Pengguna' : 'Tambahkan'}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
