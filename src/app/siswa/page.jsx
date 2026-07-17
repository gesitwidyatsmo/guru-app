'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Loader from '../components/loading';
import { createClient } from '@/utils/supabase/client';
import { ChevronLeft, Search, X, Plus, Users, Filter } from 'lucide-react';
import Swal from 'sweetalert2';

// inline modal seleksi kelas
function ClassPickerModal({ isOpen, onClose, kelasList, onSelect }) {
	if (!isOpen) return null;
	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/80 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-sm border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden rounded-none transform transition-all'>
				<div className='p-5 border-b-[4px] border-[#0D0D0D] bg-[#F5C518] flex justify-between items-center'>
					<h3 className='font-black text-[#0D0D0D] text-xl uppercase tracking-widest'>Pilih Kelas</h3>
					<button
						onClick={onClose}
						className='w-8 h-8 flex items-center justify-center bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all'>
						<X className='w-5 h-5' strokeWidth={3} />
					</button>
				</div>
				<div className='p-4 max-h-80 overflow-y-auto space-y-3 bg-[#FFF5F0]'>
					<button
						onClick={() => onSelect('Semua')}
						className='w-full text-left px-5 py-4 bg-white border-[3px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-widest hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all rounded-none'>
						SEMUA KELAS
					</button>
					{kelasList.map((k) => (
						<button
							key={k.id}
							onClick={() => onSelect(k.kelas)}
							className='w-full text-left px-5 py-4 bg-white border-[3px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-widest hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all rounded-none'>
							{k.kelas}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function ModalFormSiswa({ isOpen, onClose, onSubmit, kelasList }) {
	const [formData, setFormData] = useState({
		nis: '',
		nama_lengkap: '',
		kelas: '',
		jenis_kelamin: 'Laki-laki',
		status: 'Aktif',
	});
	const [loading, setLoading] = useState(false);
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

	if (isOpen !== prevIsOpen) {
		setPrevIsOpen(isOpen);
		if (isOpen) {
			setFormData({
				nis: '',
				nama_lengkap: '',
				kelas: '',
				jenis_kelamin: 'Laki-laki',
				status: 'Aktif',
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
		onClose();
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/80 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-lg border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden rounded-none transform transition-all'>
				<div className='bg-[#FF90E8] px-6 py-5 border-b-[4px] border-[#0D0D0D] flex justify-between items-center'>
					<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2'>
						<Plus strokeWidth={4} /> TAMBAH SISWA
					</h2>
					<button
						onClick={onClose}
						className='w-10 h-10 flex items-center justify-center bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all'>
						<X className='w-6 h-6' strokeWidth={3} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className='p-6 space-y-6 bg-[#FFF5F0]'>
					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>NIS (Nomor Induk Siswa)</label>
						<input
							type='text'
							placeholder='MASUKAN NIS'
							className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
							value={formData.nis}
							onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
						/>
					</div>

					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Nama Lengkap <span className="text-[#E8451A] text-xl">*</span></label>
						<input
							type='text'
							required
							placeholder='MASUKAN NAMA SISWA'
							className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
							value={formData.nama_lengkap}
							onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
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
							className='px-8 py-4 bg-[#00A693] border-[4px] border-[#0D0D0D] font-black text-white uppercase tracking-widest hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all rounded-none disabled:opacity-50 flex items-center gap-2'>
							{loading ? 'MENYIMPAN...' : 'SIMPAN'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function Page() {
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadingPage, setLoadingPage] = useState(true);
	const [userRole, setUserRole] = useState('');
	const [userName, setUserName] = useState('');

	const [selectedKelas, setSelectedKelas] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	const [showClassPicker, setShowClassPicker] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const supabase = createClient();
				const [resSiswa, resKelas, resPoin] = await Promise.all([
					fetch('/api/siswa').then((res) => res.json()),
					fetch('/api/kelas?all=false').then((res) => res.json()),
					supabase.from('poin').select('*')
				]);

				const dataSiswa = resSiswa || [];
				const dataKelas = resKelas || [];
				const dataPoin = resPoin.data || [];

				const poinMap = {};
				dataPoin.forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					else if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				const siswaWithPoin = dataSiswa.map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));

				setSiswaList(siswaWithPoin);
				setKelasList(dataKelas);
				setLoading(false);
			} catch (err) {
				console.error(err);
				setLoading(false);
			} finally {
				setLoadingPage(false);
			}
		};

		fetchData();
	}, []);

	const filteredSiswa = useMemo(() => {
		let hasil = siswaList;
		if (selectedKelas !== 'Semua') {
			hasil = hasil.filter((s) => s.kelas === selectedKelas);
		}
		if (searchQuery.trim() !== '') {
			const query = searchQuery.toLowerCase();
			hasil = hasil.filter((s) => s.nama_lengkap.toLowerCase().includes(query) || (s.nis && s.nis.toLowerCase().includes(query)));
		}
		return hasil;
	}, [selectedKelas, searchQuery, siswaList]);

	const handleSaveSiswa = async (newData) => {
		try {
			const supabase = createClient();
			const uniqueId = 'SIS-' + Date.now() + Math.floor(Math.random() * 100);
			const { error } = await supabase.from('siswa').insert({
				id: uniqueId,
				nis: newData.nis || null,
				nama_lengkap: newData.nama_lengkap,
				kelas: newData.kelas,
				jenis_kelamin: newData.jenis_kelamin || 'Laki-laki',
				status: newData.status || 'Aktif',
			});

			if (!error) {
				await Swal.fire({
					title: 'BERHASIL!',
					text: 'Siswa berhasil ditambahkan.',
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
				
				// Refresh Data Otomatis
				const { data: dataSiswa } = await supabase.from('siswa').select('*').order('nama_lengkap', { ascending: true });
				const { data: resPoin } = await supabase.from('poin').select('*');
				const dataPoin = resPoin || [];
				const poinMap = {};
				dataPoin.forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					else if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});
				const siswaWithPoin = (dataSiswa || []).map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));
				setSiswaList(siswaWithPoin);
			} else {
				Swal.fire({
					title: 'GAGAL',
					text: 'Gagal menyimpan siswa: ' + error.message,
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
			console.error(error);
			Swal.fire({
				title: 'ERROR',
				text: 'Terjadi kesalahan jaringan.',
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

	useEffect(() => {
		const fetchAuth = async () => {
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					const { data: profile } = await supabase
						.from('users')
						.select('nama_lengkap, role')
						.eq('auth_id', user.id)
						.single();
					if (profile) {
						setUserName(profile.nama_lengkap);
						setUserRole(profile.role);
					}
				}
			} catch (err) {}
		};
		fetchAuth();
	}, []);

	if (loadingPage) {
		return <Loader />;
	}

	const isAdmin = userRole === 'Admin';

	return (
		<main className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] py-8 md:py-12 font-sans'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8'>
				
				{/* HEADER NEOBRUTALISM */}
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
					<div className='flex items-center gap-4'>
						<Link href='/dashboard' className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
						</Link>
						<div className='bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block'>
							<h1 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest'>Manajemen Siswa</h1>
						</div>
					</div>
					{isAdmin && (
						<button 
							onClick={() => setShowAddModal(true)}
							className='inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#A3E635] text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-2 active:shadow-none transition-all w-full md:w-auto'
						>
							<Plus className='w-6 h-6' strokeWidth={4} /> TAMBAH SISWA
						</button>
					)}
				</div>

				{/* SEARCH & FILTER BAR */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
					<div className='md:col-span-2 relative'>
						<div className='absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none'>
							<Search className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
						</div>
						<input
							type='text'
							placeholder='CARI NAMA ATAU NIS SISWA...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='w-full pl-14 pr-12 py-5 bg-white border-[4px] border-[#0D0D0D] font-black text-[#0D0D0D] placeholder-[#0D0D0D]/50 focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className='absolute inset-y-0 right-0 pr-5 flex items-center'>
								<X className='w-6 h-6 text-[#E8451A] hover:scale-110 transition-transform' strokeWidth={3} />
							</button>
						)}
					</div>
					<div>
						<button
							onClick={() => setShowClassPicker(true)}
							className='w-full h-full min-h-[72px] px-6 flex items-center justify-between bg-[#F5C518] border-[4px] border-[#0D0D0D] font-black text-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all rounded-none'
						>
							<div className='flex items-center gap-3'>
								<Filter className='w-6 h-6' strokeWidth={3} />
								<div className='flex flex-col items-start'>
									<span className='text-[10px] leading-tight uppercase tracking-widest'>FILTER KELAS:</span>
									<span className='text-lg uppercase leading-tight'>{selectedKelas}</span>
								</div>
							</div>
							<ChevronLeft className='w-6 h-6 rotate-[-90deg]' strokeWidth={3} />
						</button>
					</div>
				</div>

				{/* HASIL PENCARIAN INFO */}
				{searchQuery && (
					<div className='bg-[#0D0D0D] text-white p-4 border-[4px] border-[#0D0D0D] font-bold uppercase tracking-widest inline-block'>
						MENAMPILKAN <span className='text-[#F5C518]'>{filteredSiswa.length}</span> HASIL UNTUK "{searchQuery}"
					</div>
				)}

				{/* LIST SISWA */}
				{loading ? (
					<div className='text-center py-20 font-black text-2xl text-[#0D0D0D] uppercase tracking-widest animate-pulse'>MEMUAT DATA SISWA...</div>
				) : (
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
						{filteredSiswa.map((siswa) => (
							<Link
								href={`/siswa/${siswa.id}`}
								key={siswa.id}
								className='group block bg-white p-5 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[10px_10px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all rounded-none flex flex-col justify-between'
							>
								<div>
									<div className='flex justify-between items-start mb-4'>
										<div className='bg-[#0D0D0D] text-white px-3 py-1 text-sm font-black uppercase tracking-widest border-[2px] border-[#0D0D0D]'>
											{siswa.kelas}
										</div>
										<span className={`px-3 py-1 text-sm font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] \${siswa.status === 'Aktif' ? 'bg-[#A3E635] text-[#0D0D0D]' : siswa.status === 'Lulus' ? 'bg-[#2F80ED] text-white' : 'bg-[#E8451A] text-white'}`}>
											{siswa.status}
										</span>
									</div>
									<h3 className='font-black text-xl text-[#0D0D0D] mb-1 line-clamp-2 uppercase group-hover:text-[#2F80ED] transition-colors'>{siswa.nama_lengkap}</h3>
									<p className='text-sm font-bold text-[#0D0D0D]/60 uppercase tracking-widest mb-4'>NIS: {siswa.nis || '-'}</p>
								</div>

								<div className='flex flex-col gap-3'>
									<div className='flex items-center gap-2'>
										<span className='px-2 py-1 bg-[#F5C518] border-[2px] border-[#0D0D0D] text-xs font-black uppercase text-[#0D0D0D]'>
											{siswa.jenis_kelamin}
										</span>
									</div>
									<div className='flex items-center gap-2 border-t-[3px] border-[#0D0D0D] pt-3'>
										<div className='flex-1 bg-white border-[3px] border-[#0D0D0D] p-2 flex items-center justify-between' title='Total Poin Positif'>
											<span className='text-xs font-black uppercase'>POS (+)</span>
											<span className='text-sm font-black text-[#00A693]'>{siswa.poinPositif || 0}</span>
										</div>
										<div className='flex-1 bg-white border-[3px] border-[#0D0D0D] p-2 flex items-center justify-between' title='Total Poin Negatif'>
											<span className='text-xs font-black uppercase'>NEG (-)</span>
											<span className='text-sm font-black text-[#E8451A]'>{siswa.poinNegatif || 0}</span>
										</div>
									</div>
								</div>
							</Link>
						))}

						{filteredSiswa.length === 0 && !loading && (
							<div className='col-span-full py-20 bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] text-center'>
								<Users className='w-20 h-20 text-[#0D0D0D]/20 mx-auto mb-4' />
								<p className='font-black text-2xl text-[#0D0D0D] uppercase tracking-widest'>
									{searchQuery ? 'TIDAK ADA SISWA DITEMUKAN' : 'BELUM ADA DATA SISWA'}
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			<ClassPickerModal
				isOpen={showClassPicker}
				onClose={() => setShowClassPicker(false)}
				kelasList={kelasList}
				onSelect={(kelas) => {
					setSelectedKelas(kelas);
					setShowClassPicker(false);
				}}
			/>

			<ModalFormSiswa
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				kelasList={kelasList}
				onSubmit={handleSaveSiswa}
			/>
		</main>
	);
}
