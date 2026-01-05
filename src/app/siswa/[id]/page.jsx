/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { swalProcess, swalSuccess, swalError, swalConfirmDelete } from '@/lib/swal';

// --- Ikon SVG ---
const IconUser = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
		<circle
			cx='12'
			cy='7'
			r='4'
		/>
	</svg>
);
const IconCalendar = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<rect
			x='3'
			y='4'
			width='18'
			height='18'
			rx='2'
			ry='2'
		/>
		<line
			x1='16'
			y1='2'
			x2='16'
			y2='6'
		/>
		<line
			x1='8'
			y1='2'
			x2='8'
			y2='6'
		/>
		<line
			x1='3'
			y1='10'
			x2='21'
			y2='10'
		/>
	</svg>
);
const IconEdit = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
		<path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
	</svg>
);
const IconTrash = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<polyline points='3 6 5 6 21 6' />
		<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
	</svg>
);
const IconAward = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<circle
			cx='12'
			cy='8'
			r='7'
		/>
		<polyline points='8.21 13.89 7 23 12 20 17 23 15.79 13.88' />
	</svg>
);
const IconArrowLeft = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='M19 12H5M12 19l-7-7 7-7' />
	</svg>
);

// --- MODAL EDIT MODERN ---
function ModalEditSiswa({ isOpen, onClose, onSubmit, kelasList, initialData }) {
	const [formData, setFormData] = useState({ id: '', nis: '', nama_lengkap: '', kelas: '', jenis_kelamin: 'Laki-laki', status: 'Aktif' });
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (isOpen && initialData) {
			setFormData({
				id: initialData.id || '',
				nis: initialData.nis || '',
				nama_lengkap: initialData.nama_lengkap || '',
				kelas: initialData.kelas || '',
				jenis_kelamin: initialData.jenis_kelamin || 'Laki-laki',
				status: initialData.status || 'Aktif',
			});
		}
	}, [isOpen, initialData]);

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		await onSubmit(formData);
		setLoading(false);
		onClose();
	};

	return (
		<div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 sm:p-6'>
			<div
				className='fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity'
				onClick={onClose}
			/>
			<div className='relative w-full max-w-lg transform rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl transition-all animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200'>
				<div className='mb-6 flex items-center justify-between'>
					<h3 className='text-xl font-bold text-gray-900'>Edit Data Siswa</h3>
					<button
						onClick={onClose}
						className='rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 transition-colors'>
						<span className='sr-only'>Close</span>
						<svg
							className='h-6 w-6'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='space-y-5'>
					<div className='grid grid-cols-2 gap-4'>
						<div className='col-span-2'>
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Nama Lengkap</label>
							<input
								type='text'
								required
								className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 transition-colors'
								value={formData.nama_lengkap}
								onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
								placeholder='Nama lengkap siswa'
							/>
						</div>
						<div>
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>NIS</label>
							<input
								type='text'
								required
								className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 transition-colors'
								value={formData.nis}
								onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
								placeholder='Nomor Induk'
							/>
						</div>
						<div>
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Kelas</label>
							<select
								required
								className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 transition-colors'
								value={formData.kelas}
								onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}>
								<option value=''>Pilih Kelas</option>
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
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Jenis Kelamin</label>
							<select
								className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 transition-colors'
								value={formData.jenis_kelamin}
								onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
								<option value='Laki-laki'>Laki-laki</option>
								<option value='Perempuan'>Perempuan</option>
							</select>
						</div>
						<div>
							<label className='mb-1.5 block text-sm font-semibold text-gray-700'>Status</label>
							<select
								className='block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 transition-colors'
								value={formData.status}
								onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
								<option value='Aktif'>Aktif</option>
								<option value='Boyong'>Boyong</option>
								<option value='Lulus'>Lulus</option>
							</select>
						</div>
					</div>

					<div className='flex gap-3 pt-4'>
						<button
							type='button'
							onClick={onClose}
							className='flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all'>
							Batal
						</button>
						<button
							type='submit'
							disabled={loading}
							className='flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-70 transition-all'>
							{loading ? 'Menyimpan...' : 'Simpan Perubahan'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// --- HALAMAN UTAMA ---
export default function SiswaPage() {
	const params = useParams();
	const id = params.id;
	const router = useRouter();

	const [siswaData, setSiswaData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [kelasList, setKelasList] = useState([]);

	const fetchSiswa = async () => {
		try {
			const res = await fetch(`/api/siswa`);
			const data = await res.json();
			const siswa = data.find((item) => String(item.id) === String(id));
			if (siswa) setSiswaData(siswa);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (id) fetchSiswa();
	}, [id]);

	const handleOpenEdit = async () => {
		if (kelasList.length === 0) {
			try {
				const res = await fetch('/api/kelas');
				if (res.ok) setKelasList(await res.json());
				else
					setKelasList([
						{ id: 1, kelas: 'VII A' },
						{ id: 2, kelas: 'VII B' },
						{ id: 3, kelas: 'VIII A' },
						{ id: 4, kelas: 'IX A' },
					]);
			} catch (e) {
				console.error('Gagal ambil kelas', e);
			}
		}
		setIsEditOpen(true);
	};

	const handleUpdateSiswa = async (updatedData) => {
		if (!updatedData.id) return alert('Error: ID Siswa hilang.');
		swalProcess('Updating...', 'Jangan tutup halaman');
		setIsEditOpen(false);
		try {
			const res = await fetch('/api/siswa', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedData),
			});
			if (res.ok) {
				setSiswaData((prev) => ({ ...prev, ...updatedData }));
				Swal.close();
				await swalSuccess('Tersimpan', 'Data berhasil disimpan');
			} else {
				await swalError('Gagal Update Data');
			}
		} catch (error) {
			await swalError('Gagal', error);
		}
	};

	const handleDeleteSiswa = async () => {
		// if (!confirm('Hapus siswa ini? Data tidak bisa dikembalikan.')) return;
		const result = await swalConfirmDelete('Hapus Siswa ini?', 'Data siswa akan dihapus permanen.');
		if (!result.isConfirmed) return;
		swalProcess('Menghapus...', 'Jangan tutup halaman');
		try {
			const res = await fetch(`/api/siswa?id=${id}`, { method: 'DELETE' });
			if (res.ok) {
				Swal.close();
				await swalSuccess('Terhapus', 'Data berhasil dihapus');
				router.back();
				// router.push('/siswa');
			} else {
				alert('Gagal menghapus siswa');
			}
		} catch (e) {
			alert('Error koneksi saat menghapus');
		}
	};

	const initials = useMemo(() => {
		const name = siswaData?.nama_lengkap || '';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
	}, [siswaData]);

	if (loading)
		return (
			<div className='flex min-h-screen items-center justify-center bg-slate-50'>
				<Loader />
			</div>
		);
	if (!siswaData) return <div className='p-10 text-center text-gray-500'>Data siswa tidak ditemukan.</div>;

	return (
		<div className='min-h-screen bg-slate-50/50 pb-20 pt-6'>
			<div className='mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8'>
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					{/* <h1 className='text-2xl font-bold tracking-tight text-gray-900'>Detail Siswa</h1> */}
					<button
						onClick={() => window.history.back()}
						className='group flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'>
						<IconArrowLeft className='h-4 w-4 transition-transform group-hover:-translate-x-1' />
						Kembali
					</button>
				</div>

				{/* Profil Utama */}
				<div className='overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'>
					{/* Banner Gradient */}
					<div className='h-32 w-full bg-linear-150 bg-blue-500 to-blue-50'></div>

					<div className='px-6 pb-8'>
						<div className='relative flex flex-col items-center'>
							{/* Avatar */}
							<div className='-mt-16 mb-4'>
								<div className='flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-white bg-white text-4xl font-bold text-indigo-600 shadow-lg'>{initials}</div>
							</div>

							{/* Nama & Info */}
							<div className='text-center'>
								<h2 className='text-2xl font-bold text-gray-900'>{siswaData.nama_lengkap}</h2>
								<p className='mt-1 font-medium text-gray-500'>Kelas {siswaData.kelas}</p>

								<div className='mt-4 flex flex-wrap justify-center gap-2'>
									<span className='inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600'>NIS: {siswaData.nis}</span>
									<span
										className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${siswaData.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
										<span className={`h-1.5 w-1.5 rounded-full ${siswaData.status === 'Aktif' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
										{siswaData.status}
									</span>
									<span className='inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700'>{siswaData.jenis_kelamin || 'Laki-laki'}</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Menu Grid */}
				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
					<Link
						href={`/siswa/${id}/riwayat-absensi`}
						className='group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md hover:-translate-y-0.5'>
						<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors'>
							<IconCalendar className='h-6 w-6' />
						</div>
						<div>
							<h3 className='font-bold text-gray-900'>Riwayat Absensi</h3>
							<p className='text-xs text-gray-500'>Cek kehadiran siswa</p>
						</div>
					</Link>

					<Link
						href={`/siswa/${id}/riwayat-nilai`}
						className='group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-purple-100 hover:shadow-md hover:-translate-y-0.5'>
						<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors'>
							<IconAward className='h-6 w-6' />
						</div>
						<div>
							<h3 className='font-bold text-gray-900'>Riwayat Nilai</h3>
							<p className='text-xs text-gray-500'>Akademik & rapor</p>
						</div>
					</Link>

					<button
						onClick={handleOpenEdit}
						className='group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-amber-100 hover:shadow-md hover:-translate-y-0.5 text-left'>
						<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors'>
							<IconEdit className='h-6 w-6' />
						</div>
						<div>
							<h3 className='font-bold text-gray-900'>Edit Data</h3>
							<p className='text-xs text-gray-500'>Perbarui profil siswa</p>
						</div>
					</button>

					<button
						onClick={handleDeleteSiswa}
						className='group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-rose-100 hover:shadow-md hover:-translate-y-0.5 text-left'>
						<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white transition-colors'>
							<IconTrash className='h-6 w-6' />
						</div>
						<div>
							<h3 className='font-bold text-gray-900'>Hapus Siswa</h3>
							<p className='text-xs text-gray-500'>Hapus permanen</p>
						</div>
					</button>
				</div>

				<ModalEditSiswa
					isOpen={isEditOpen}
					onClose={() => setIsEditOpen(false)}
					initialData={siswaData}
					kelasList={kelasList}
					onSubmit={handleUpdateSiswa}
				/>
			</div>
		</div>
	);
}
