'use client';

import { useState, useEffect } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';

export default function PenugasanPage() {
	const [penugasanList, setPenugasanList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		id_user: '',
		kelas: '',
		mapel: '',
	});

	const fetchAllData = async () => {
		try {
			setLoading(true);
			const [resKBM, resUsers, resKelas, resMapel] = await Promise.all([fetch('/api/kbm'), fetch('/api/users?role=Guru'), fetch('/api/kelas'), fetch('/api/mapel')]);

			if (!resKBM.ok) throw new Error('Akses KBM Ditolak.');
			setPenugasanList(await resKBM.json());
			if (resUsers.ok) setGuruList(await resUsers.json());
			if (resKelas.ok) setKelasList(await resKelas.json());
			if (resMapel.ok) setMapelList(await resMapel.json());
		} catch (error) {
			Swal.fire('Terjadi Kesalahan', error.message, 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllData();
	}, []);

	const openModal = () => {
		setFormData({ id_user: '', kelas: '', mapel: '' });
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.id_user || !formData.kelas || !formData.mapel) {
			Swal.fire('Perhatian', 'Harap isi (Pilih) Guru, Kelas, dan Mapel!', 'warning');
			return;
		}

		try {
			const res = await fetch('/api/kbm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error);

			Swal.fire('Ditugaskan!', data.message, 'success');
			setIsModalOpen(false);
			fetchAllData();
		} catch (error) {
			Swal.fire('Gagal!', error.message, 'error');
		}
	};

	const handleDelete = async (kbmId) => {
		const result = await Swal.fire({
			title: 'Cabut Wewenang?',
			text: `Beban mengajar (Kelas/Mapel ini) akan dihapus dari Guru tersebut.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Ya, Cabut!',
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch(`/api/kbm?id_kbm=${kbmId}`, { method: 'DELETE' });
				if (!res.ok) {
					const fault = await res.json();
					throw new Error(fault.error);
				}
				Swal.fire('Dicabut', 'Tugas berhasil dihentikan.', 'success');
				fetchAllData();
			} catch (error) {
				Swal.fire('Error', error.message, 'error');
			}
		}
	};

	if (loading && penugasanList.length === 0) return <Loader />;

	// Mengelompokkan tabel ke dalam baris yang disinergikan per Guru untuk UI (Grouping)
	const groupedByGuru = penugasanList.reduce((acc, curr) => {
		if (!acc[curr.username]) acc[curr.username] = { nama: curr.nama_guru, tugas: [] };
		acc[curr.username].tugas.push(curr);
		return acc;
	}, {});

	return (
		<div className='max-w-7xl mx-auto'>
			<div className='flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-gray-100 gap-4 mt-8'>
				<div>
					<h1 className='text-3xl font-extrabold text-gray-800 tracking-tight'>Beban Mengajar & Penugasan</h1>
					<p className='text-sm text-gray-500 mt-2 font-medium'>Atur relasi wewenang _Role-Based Access_ dari Guru terhadap yurisdiksi Kelas/Mapel.</p>
				</div>
				<button
					onClick={openModal}
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
					Tambahkan Relasi Mengajar
				</button>
			</div>

			<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12'>
				<div className='overflow-x-auto'>
					<table className='w-full'>
						<thead>
							<tr className='bg-gray-50/50 border-b border-gray-100'>
								<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Nama Pengajar (Sistem / Guru)</th>
								<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Kelas Yang Diasuh</th>
								<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Mata Pelajaran Diampu</th>
								<th className='px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider'>Cabut / Hapus</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-gray-100'>
							{Object.keys(groupedByGuru).length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-8 text-center text-sm font-medium text-gray-500 bg-gray-50/50'>
										Belum ada satupun jadwal Penugasan Aktif (Kosong).
									</td>
								</tr>
							) : (
								Object.entries(groupedByGuru).map(([username, info]) =>
									info.tugas.map((tugas, idx) => (
										<tr
											key={tugas.id_kbm || idx}
											className='hover:bg-indigo-50/30 transition-colors'>
											{/* Trik merging Kolom baris (Rowspan per Guru) agar terlihat estetik */}
											{idx === 0 && (
												<td
													className='px-6 py-4 align-top border-r border-gray-50'
													rowSpan={info.tugas.length}>
													<div className='flex flex-col gap-1'>
														<span className='font-bold text-gray-800'>{info.nama}</span>
														<span className='font-mono text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-md self-start'>@{username}</span>
													</div>
												</td>
											)}
											<td className='px-6 py-4'>
												<span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700'>{tugas.kelas}</span>
											</td>
											<td className='px-6 py-4'>
												<span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700'>{tugas.mapel}</span>
											</td>
											{console.log(tugas.kelas)}
											<td className='px-6 py-4 text-right'>
												<button
													onClick={() => handleDelete(tugas.id_kbm)}
													className='p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors'
													title='Hapus Baris Beban Mengajar Ini'>
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
											</td>
										</tr>
									)),
								)
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal Penugasan */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm'>
					<div className='bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200'>
						<div className='px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50'>
							<h3 className='text-lg font-bold text-gray-800'>Registrasi Penugasan Guru Baru</h3>
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
								className='space-y-5'>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
										Pilih Identitas Guru <span className='text-rose-500'>*</span>
									</label>
									<select
										value={formData.id_user}
										onChange={(e) => setFormData({ ...formData, id_user: e.target.value })}
										className='w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm bg-white'
										required>
										<option value=''>-- Pilih dari Akun Terdaftar --</option>
										{guruList.map((g) => (
											<option
												key={g.id_user}
												value={g.id_user}>
												{g.nama_lengkap} (@{g.username})
											</option>
										))}
									</select>
								</div>

								<div className='grid grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
											Kelas Target <span className='text-rose-500'>*</span>
										</label>
										<select
											value={formData.kelas}
											onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
											className='w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm'
											required>
											<option value=''>-- Master Kelas --</option>
											{kelasList.map((k) => (
												<option
													key={k.id}
													value={k.kelas}>
													{k.kelas}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
											Mata Pelajaran <span className='text-rose-500'>*</span>
										</label>
										<select
											value={formData.mapel}
											onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
											className='w-full px-4 py-2 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-sm bg-white'
											required>
											<option value=''>-- Master Mapel --</option>
											{mapelList.map((m) => (
												<option
													key={m.id}
													value={m.mapel}>
													{m.mapel}
												</option>
											))}
										</select>
									</div>
								</div>

								<div className='pt-6 flex gap-3'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium'>
										Batal
									</button>
									<button
										type='submit'
										className='flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-md shadow-indigo-600/20'>
										Simpan Penugasan
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
