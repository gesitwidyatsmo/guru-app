'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { ChevronLeft, X } from 'lucide-react';

// --- Ikon SVG ---
const IconCalendar = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<rect x='3' y='4' width='18' height='18' rx='0' ry='0' />
		<line x1='16' y1='2' x2='16' y2='6' />
		<line x1='8' y1='2' x2='8' y2='6' />
		<line x1='3' y1='10' x2='21' y2='10' />
	</svg>
);
const IconEdit = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<path d='M11 4H4v14h14v-7' />
		<path d='M18.5 2.5l3 3L12 15l-4 1 1-4 9.5-9.5z' />
	</svg>
);
const IconTrash = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<polyline points='3 6 5 6 21 6' />
		<path d='M19 6v14H7V6m3 0V4h4v2' />
	</svg>
);
const IconAward = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<circle cx='12' cy='8' r='7' />
		<polyline points='8.21 13.89 7 23 12 20 17 23 15.79 13.88' />
	</svg>
);

// --- MODAL EDIT NEOBRUTALISM ---
function ModalEditSiswa({ isOpen, onClose, onSubmit, kelasList, initialData }) {
	const [formData, setFormData] = useState({ id: '', nis: '', nama_lengkap: '', kelas: '', jenis_kelamin: 'Laki-laki', status: 'Aktif' });
	const [loading, setLoading] = useState(false);

	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	const [prevInitialData, setPrevInitialData] = useState(initialData);

	if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
		setPrevIsOpen(isOpen);
		setPrevInitialData(initialData);
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
	}

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.nama_lengkap || !formData.kelas) {
			Swal.fire({
				title: 'ERROR',
				text: 'Nama Lengkap dan Kelas wajib diisi!',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		setLoading(true);
		await onSubmit(formData);
		setLoading(false);
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/80 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-lg border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden rounded-none transform transition-all'>
				<div className='bg-[#F5C518] px-6 py-5 border-b-[4px] border-[#0D0D0D] flex justify-between items-center'>
					<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2'>
						<IconEdit className='w-6 h-6' /> EDIT DATA
					</h2>
					<button
						onClick={onClose}
						className='w-10 h-10 flex items-center justify-center bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all'>
						<X className='w-6 h-6' strokeWidth={3} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className='p-6 space-y-6 bg-[#FFF5F0]'>
					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Nama Lengkap <span className="text-[#E8451A] text-xl">*</span></label>
						<input
							type='text'
							required
							className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
							value={formData.nama_lengkap}
							onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
							placeholder='NAMA LENGKAP SISWA'
						/>
					</div>
					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>NIS (Nomor Induk Siswa)</label>
						<input
							type='text'
							className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
							value={formData.nis}
							onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
							placeholder='NOMOR INDUK SISWA'
						/>
					</div>
					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Kelas <span className="text-[#E8451A] text-xl">*</span></label>
						<select
							required
							className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
							value={formData.kelas}
							onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}>
							<option value='' disabled>-- PILIH KELAS --</option>
							{kelasList.map((k) => (
								<option key={k.id} value={k.kelas}>
									{k.kelas}
								</option>
							))}
						</select>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Jenis Kelamin</label>
							<select
								className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
								value={formData.jenis_kelamin}
								onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
								<option value='Laki-laki'>LAKI-LAKI</option>
								<option value='Perempuan'>PEREMPUAN</option>
							</select>
						</div>
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Status</label>
							<select
								className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
								value={formData.status}
								onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
								<option value='Aktif'>AKTIF</option>
								<option value='Boyong'>BOYONG</option>
								<option value='Lulus'>LULUS</option>
							</select>
						</div>
					</div>

					<div className='pt-6 border-t-[4px] border-[#0D0D0D] flex justify-end gap-4'>
						<button
							type='button'
							onClick={onClose}
							className='px-6 py-4 bg-white border-[4px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-widest hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all rounded-none'>
							BATAL
						</button>
						<button
							type='submit'
							disabled={loading}
							className='px-8 py-4 bg-[#FF90E8] border-[4px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-widest hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all rounded-none disabled:opacity-50'>
							{loading ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
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
	const [poinSiswa, setPoinSiswa] = useState({ positif: 0, negatif: 0 });
	const [loading, setLoading] = useState(true);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [kelasList, setKelasList] = useState([]);

	const fetchSiswa = useCallback(async () => {
		try {
			const [resSiswa, resPoin] = await Promise.all([fetch(`/api/siswa`), fetch(`/api/poin?siswa_id=${id}`)]);

			const data = await resSiswa.json();
			const siswa = data.find((item) => String(item.id) === String(id));
			if (siswa) setSiswaData(siswa);

			if (resPoin.ok) {
				const dataPoin = await resPoin.json();
				const poinTerkumpul = dataPoin.reduce(
					(acc, curr) => {
						if (curr.tipe === 'positif') acc.positif += curr.poin || 0;
						else if (curr.tipe === 'negatif') acc.negatif += curr.poin || 0;
						return acc;
					},
					{ positif: 0, negatif: 0 },
				);
				setPoinSiswa(poinTerkumpul);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		if (id) fetchSiswa();
	}, [id, fetchSiswa]);

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
		if (!updatedData.id) {
			Swal.fire({
				title: 'ERROR',
				text: 'ID Siswa hilang.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		Swal.fire({
			title: 'MENYIMPAN...',
			text: 'Jangan tutup halaman',
			allowOutsideClick: false,
			background: '#FFF5F0',
			color: '#0D0D0D',
			didOpen: () => {
				Swal.showLoading();
			},
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
			},
		});

		try {
			const res = await fetch('/api/siswa', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedData),
			});
			if (res.ok) {
				setSiswaData((prev) => ({ ...prev, ...updatedData }));
				setIsEditOpen(false);
				Swal.fire({
					title: 'BERHASIL!',
					text: 'Data berhasil disimpan',
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			} else {
				Swal.fire({
					title: 'GAGAL',
					text: 'Gagal Update Data',
					icon: 'error',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			}
		} catch (error) {
			Swal.fire({
				title: 'ERROR',
				text: error.message || 'Terjadi kesalahan jaringan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
		}
	};

	const handleDeleteSiswa = async () => {
		const result = await Swal.fire({
			title: 'HAPUS SISWA?',
			text: 'Data siswa akan dihapus permanen.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
			},
		});

		if (!result.isConfirmed) return;

		Swal.fire({
			title: 'MENGHAPUS...',
			text: 'Jangan tutup halaman',
			allowOutsideClick: false,
			background: '#FFF5F0',
			color: '#0D0D0D',
			didOpen: () => {
				Swal.showLoading();
			},
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
			},
		});

		try {
			const res = await fetch(`/api/siswa?id=${id}`, { method: 'DELETE' });
			if (res.ok) {
				await Swal.fire({
					title: 'TERHAPUS!',
					text: 'Data berhasil dihapus',
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
				router.back();
			} else {
				Swal.fire({
					title: 'GAGAL',
					text: 'Gagal menghapus siswa',
					icon: 'error',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			}
		} catch (e) {
			Swal.fire({
				title: 'ERROR',
				text: 'Error koneksi saat menghapus',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
		}
	};

	const initials = useMemo(() => {
		const name = siswaData?.nama_lengkap || '';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
	}, [siswaData]);

	if (loading) return <Loader />;
	if (!siswaData) return <div className='p-20 text-center font-black text-2xl text-[#0D0D0D] bg-[#FFF5F0] uppercase tracking-widest'>Data siswa tidak ditemukan.</div>;

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>Profil Siswa</h1>
					</div>
				</div>

				{/* Profil Utama */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none'>
					{/* Banner Solid */}
					<div className='h-40 w-full bg-[#2F80ED] border-b-[4px] border-[#0D0D0D] relative overflow-hidden'>
						{/* Geometric Decoration */}
						<div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF90E8] rounded-full border-[4px] border-[#0D0D0D] opacity-80 mix-blend-multiply"></div>
						<div className="absolute right-20 bottom-[-20px] w-20 h-20 bg-[#F5C518] rotate-45 border-[4px] border-[#0D0D0D] opacity-80"></div>
					</div>

					<div className='px-6 pb-10'>
						<div className='relative flex flex-col items-center'>
							{/* Avatar */}
							<div className='-mt-20 mb-6'>
								<div className='flex h-40 w-40 items-center justify-center rounded-none border-[4px] border-[#0D0D0D] bg-white text-6xl font-black text-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D]'>
									{initials}
								</div>
							</div>

							{/* Nama & Info */}
							<div className='text-center w-full'>
								<h2 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest break-words'>{siswaData.nama_lengkap}</h2>
								
								<div className='mt-3 mb-6 inline-block bg-[#0D0D0D] text-white px-4 py-1 text-lg font-black uppercase tracking-widest border-[2px] border-[#0D0D0D]'>
									KELAS {siswaData.kelas}
								</div>

								<div className='flex flex-wrap justify-center gap-4 mt-2'>
									<span className='px-4 py-2 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>
										NIS: {siswaData.nis || '-'}
									</span>
									<span
										className={`px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest \${siswaData.status === 'Aktif' ? 'bg-[#A3E635] text-[#0D0D0D]' : siswaData.status === 'Lulus' ? 'bg-[#2F80ED] text-white' : 'bg-[#E8451A] text-white'}`}>
										{siswaData.status}
									</span>
									<span className='px-4 py-2 bg-[#F5C518] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>
										{siswaData.jenis_kelamin || 'LAKI-LAKI'}
									</span>
									<span className='px-4 py-2 bg-[#00A693] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest'>
										POS (+): {poinSiswa.positif}
									</span>
									<span className='px-4 py-2 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest'>
										NEG (-): {poinSiswa.negatif}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Menu Grid */}
				<div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
					<Link
						href={`/siswa/${id}/riwayat-absensi`}
						className='group flex items-center gap-5 bg-[#2F80ED] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:rotate-6 transition-transform'>
							<IconCalendar className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-white uppercase tracking-widest mb-1'>RIWAYAT ABSENSI</h3>
							<p className='text-sm font-bold text-white/80 uppercase'>Cek kehadiran siswa</p>
						</div>
					</Link>

					<Link
						href={`/siswa/${id}/riwayat-nilai`}
						className='group flex items-center gap-5 bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:scale-110 transition-transform'>
							<IconAward className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-1'>RIWAYAT NILAI</h3>
							<p className='text-sm font-bold text-[#0D0D0D]/70 uppercase'>Akademik & rapor</p>
						</div>
					</Link>

					<button
						onClick={handleOpenEdit}
						className='group flex items-center gap-5 bg-[#FF90E8] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none text-left'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:-rotate-6 transition-transform'>
							<IconEdit className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-1'>EDIT DATA</h3>
							<p className='text-sm font-bold text-[#0D0D0D]/70 uppercase'>Perbarui profil siswa</p>
						</div>
					</button>

					<button
						onClick={handleDeleteSiswa}
						className='group flex items-center gap-5 bg-[#E8451A] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none text-left'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:scale-110 group-hover:rotate-3 transition-transform'>
							<IconTrash className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-white uppercase tracking-widest mb-1'>HAPUS SISWA</h3>
							<p className='text-sm font-bold text-white/80 uppercase'>Hapus permanen</p>
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
