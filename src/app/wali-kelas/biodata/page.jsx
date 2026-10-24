'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
	Users,
	ArrowLeft,
	Search,
	UserPlus,
	Download,
	Edit3,
	Trash2,
	MessageCircle,
	ExternalLink,
	RefreshCw,
	SlidersHorizontal,
	Eye,
	CheckCircle,
} from 'lucide-react';
import ModalEditBiodataSiswa from '@/app/components/ModalEditBiodataSiswa';

export default function WaliKelasBiodataPage() {
	const router = useRouter();

	const [dataHub, setDataHub] = useState(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	// Filter states
	const [searchQuery, setSearchQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState('Aktif');
	const [filterGender, setFilterGender] = useState('all');
	const [viewMode, setViewMode] = useState('semua'); // 'semua' | 'identitas' | 'alamat' | 'ortu'

	// Modal CRUD states
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCreateMode, setIsCreateMode] = useState(false);
	const [selectedSiswa, setSelectedSiswa] = useState(null);

	const fetchHubData = useCallback(async () => {
		try {
			setRefreshing(true);
			const res = await fetch('/api/wali-kelas/my-class');
			if (!res.ok) {
				if (res.status === 401) {
					router.replace('/login');
					return;
				}
				throw new Error('Gagal memuat data rombel wali kelas.');
			}
			const data = await res.json();
			setDataHub(data);
		} catch (err) {
			console.error('Error load wali kelas data:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: err.message || 'Terjadi kesalahan sistem',
			});
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, [router]);

	useEffect(() => {
		fetchHubData();
	}, [fetchHubData]);

	const kelas = dataHub?.kelas;
	const isWaliKelas = Boolean(dataHub?.isWaliKelas);
	const allStudents = useMemo(() => {
		return dataHub?.allSiswa || dataHub?.siswaList || [];
	}, [dataHub]);

	// Filtered students list
	const filteredSiswa = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		return allStudents.filter((s) => {
			const matchSearch =
				!q ||
				(s.nama_lengkap || '').toLowerCase().includes(q) ||
				(s.nis && String(s.nis).toLowerCase().includes(q)) ||
				(s.nisn && String(s.nisn).toLowerCase().includes(q)) ||
				(s.nik && String(s.nik).toLowerCase().includes(q)) ||
				(s.nama_ayah && String(s.nama_ayah).toLowerCase().includes(q)) ||
				(s.nama_ibu && String(s.nama_ibu).toLowerCase().includes(q)) ||
				(s.alamat && String(s.alamat).toLowerCase().includes(q));

			const matchStatus = filterStatus === 'all' || s.status === filterStatus;
			const matchGender = filterGender === 'all' || s.jenis_kelamin === filterGender;

			return matchSearch && matchStatus && matchGender;
		});
	}, [allStudents, searchQuery, filterStatus, filterGender]);

	// Handler: Open Create Modal
	const handleOpenCreate = () => {
		setSelectedSiswa(null);
		setIsCreateMode(true);
		setIsModalOpen(true);
	};

	// Handler: Open Edit Modal
	const handleOpenEdit = (siswa) => {
		setSelectedSiswa(siswa);
		setIsCreateMode(false);
		setIsModalOpen(true);
	};

	// Handler: Submit Create / Edit
	const handleSubmitBiodata = async (payload, isCreate) => {
		try {
			const url = '/api/siswa';
			const method = isCreate ? 'POST' : 'PUT';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.error || 'Gagal menyimpan biodata siswa.');
			}

			Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: isCreate ? 'Siswa baru berhasil ditambahkan ke rombel.' : 'Biodata siswa berhasil diperbarui.',
				timer: 1600,
				showConfirmButton: false,
			});

			setIsModalOpen(false);
			fetchHubData();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		}
	};

	// Handler: Quick Ubah Status
	const handleUbahStatus = async (siswa) => {
		const { value: statusPilihan } = await Swal.fire({
			title: 'UBAH STATUS SISWA',
			html: `Perbarui status akademik untuk <b>${siswa.nama_lengkap}</b>:`,
			input: 'select',
			inputOptions: {
				Aktif: '🟢 AKTIF (Mengikuti KBM)',
				Pindah: '🚚 PINDAH / MUTASI KELUAR',
				Lulus: '🎓 LULUS',
				Boyong: '📦 BOYONG',
				'Salah Kelas': '⚠️ SALAH KELAS',
				'Non-Aktif': '⚪ NON-AKTIF / BERHENTI',
			},
			inputValue: siswa.status || 'Aktif',
			showCancelButton: true,
			confirmButtonText: 'Simpan Status',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00A693',
			cancelButtonColor: '#0D0D0D',
		});

		if (statusPilihan && statusPilihan !== siswa.status) {
			await handleSubmitBiodata({ ...siswa, status: statusPilihan }, false);
		}
	};

	// Handler: Hapus Siswa
	const handleDeleteSiswa = async (siswa) => {
		const result = await Swal.fire({
			title: 'HAPUS SISWA?',
			html: `Anda yakin ingin menghapus data siswa <b>${siswa.nama_lengkap}</b>?<br/><small class="text-red-600 font-bold">Perhatian: Gunakan fitur Ubah Status jika siswa pindah/lulus agar riwayat nilainya tetap aman.</small>`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
		});

		if (!result.isConfirmed) return;

		try {
			const res = await fetch(`/api/siswa?id=${siswa.id}`, { method: 'DELETE' });
			const json = await res.json();

			if (!res.ok) {
				throw new Error(json.error || 'Gagal menghapus siswa');
			}

			Swal.fire({
				icon: 'success',
				title: 'Terhapus!',
				text: 'Data siswa berhasil dihapus.',
				timer: 1500,
				showConfirmButton: false,
			});
			fetchHubData();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menghapus',
				text: err.message,
			});
		}
	};

	// Handler: Export Excel Biodata Lengkap Rombel
	const handleExportExcel = () => {
		if (filteredSiswa.length === 0) {
			Swal.fire('Info', 'Tidak ada data siswa untuk diekspor.', 'info');
			return;
		}

		const dataToExport = filteredSiswa.map((s, idx) => ({
			No: idx + 1,
			NIS: s.nis || '',
			NISN: s.nisn || '',
			NIK: s.nik || '',
			'Nama Lengkap': s.nama_lengkap || '',
			Kelas: s.kelas || kelas?.nama_kelas || '',
			'Jenis Kelamin': s.jenis_kelamin || '',
			Status: s.status || '',
			'Tempat Lahir': s.tempat_lahir || '',
			'Tanggal Lahir': s.tanggal_lahir ? String(s.tanggal_lahir).substring(0, 10) : '',
			Agama: s.agama || 'Islam',
			'Anak Ke': s.anak_ke || '',
			'Jumlah Saudara': s.jumlah_saudara !== null && s.jumlah_saudara !== undefined ? s.jumlah_saudara : '',
			'Sekolah Asal': s.sekolah_asal || '',
			'Alamat Jalan': s.alamat || '',
			RT: s.rt || '',
			RW: s.rw || '',
			Dusun: s.dusun || '',
			'Kelurahan / Desa': s.kelurahan || '',
			Kecamatan: s.kecamatan || '',
			'Kode Pos': s.kode_pos || '',
			'Jenis Tinggal': s.jenis_tinggal || '',
			'No HP / WA': s.no_hp || '',
			'Nama Ayah': s.nama_ayah || '',
			'Pendidikan Ayah': s.pendidikan_ayah || '',
			'Pekerjaan Ayah': s.pekerjaan_ayah || '',
			'Nama Ibu': s.nama_ibu || '',
			'Pendidikan Ibu': s.pendidikan_ibu || '',
			'Pekerjaan Ibu': s.pekerjaan_ibu || '',
			'Nama Wali': s.nama_wali || '',
			'Pendidikan Wali': s.pendidikan_wali || '',
			'Pekerjaan Wali': s.pekerjaan_wali || '',
		}));

		const worksheet = XLSX.utils.json_to_sheet(dataToExport);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, `Biodata ${kelas?.nama_kelas || 'Siswa'}`);

		const fileName = `Biodata_Siswa_${kelas?.nama_kelas || 'Rombel'}_${new Date().toISOString().substring(0, 10)}.xlsx`;
		XLSX.writeFile(workbook, fileName);

		Swal.fire({
			icon: 'success',
			title: 'Export Berhasil!',
			text: `File Excel berhasil diunduh (${fileName})`,
			timer: 2000,
			showConfirmButton: false,
		});
	};

	if (loading) return <Loader />;

	if (!isWaliKelas || !kelas) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] flex items-center justify-center p-4 font-sans'>
				<div className='max-w-md w-full neo-card bg-white text-center p-8 border-[3px] border-black shadow-[6px_6px_0_#000]'>
					<span className='text-5xl block mb-3'>🎓</span>
					<h2 className='text-2xl font-black uppercase text-black mb-2'>Bukan Wali Kelas</h2>
					<p className='text-sm font-bold text-gray-700 mb-6'>
						Fitur manajemen dan CRUD biodata siswa ini khusus diperuntukkan bagi Wali Kelas dari rombel aktif.
					</p>
					<Link href='/wali-kelas' className='neo-btn-primary bg-yellow-300 text-black font-black uppercase text-sm'>
						Kembali ke Hub
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] pb-24 font-sans'>
			{/* HEADER NAVIGASI */}
			<div className='bg-[#F5C518] border-b-[4px] border-[#0D0D0D] p-4 sm:p-6'>
				<div className='max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div className='flex items-center gap-3'>
						<Link
							href='/wali-kelas?tab=akademik'
							className='w-10 h-10 bg-white border-[2.5px] border-[#0D0D0D] flex items-center justify-center shadow-[2px_2px_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all'>
							<ArrowLeft className='w-5 h-5 text-black' strokeWidth={2.5} />
						</Link>
						<div>
							<div className='flex items-center gap-2'>
								<span className='px-2.5 py-0.5 bg-[#0D0D0D] text-white text-[11px] font-black uppercase tracking-wider'>
									Wali Kelas Hub
								</span>
								<span className='text-xs font-bold text-[#0D0D0D] uppercase'>
									Rombel {kelas.nama_kelas}
								</span>
							</div>
							<h1 className='text-xl sm:text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase tracking-tight mt-0.5'>
								Manajemen & CRUD Biodata Siswa Sekaligus
							</h1>
						</div>
					</div>

					<div className='flex flex-wrap items-center gap-2.5'>
						<button
							onClick={handleExportExcel}
							className='px-3.5 py-2.5 bg-white text-black font-black text-xs sm:text-sm uppercase tracking-wider border-[2.5px] border-[#0D0D0D] shadow-[2px_2px_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5'>
							<Download className='w-4 h-4' />
							<span>Download Excel</span>
						</button>
						<button
							onClick={handleOpenCreate}
							className='px-4 py-2.5 bg-[#A3E635] text-black font-black text-xs sm:text-sm uppercase tracking-wider border-[2.5px] border-[#0D0D0D] shadow-[2px_2px_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5'>
							<UserPlus className='w-4 h-4' />
							<span>Tambah Siswa</span>
						</button>
					</div>
				</div>
			</div>

			{/* CONTENT CONTAINER */}
			<div className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6'>
				{/* STATS & QUICK INFO CARDS */}
				<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4'>
					<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[3px_3px_0_#000]'>
						<p className='text-[11px] font-black uppercase text-gray-500 tracking-wider'>Total Siswa Rombel</p>
						<p className='text-2xl sm:text-3xl font-black text-[#0D0D0D] mt-0.5'>{allStudents.length}</p>
					</div>
					<div className='bg-blue-50 p-4 border-[3px] border-[#0D0D0D] shadow-[3px_3px_0_#000]'>
						<p className='text-[11px] font-black uppercase text-blue-900 tracking-wider'>Laki-Laki</p>
						<p className='text-2xl sm:text-3xl font-black text-blue-950 mt-0.5'>
							{allStudents.filter((s) => s.jenis_kelamin === 'Laki-laki').length}
						</p>
					</div>
					<div className='bg-pink-50 p-4 border-[3px] border-[#0D0D0D] shadow-[3px_3px_0_#000]'>
						<p className='text-[11px] font-black uppercase text-pink-900 tracking-wider'>Perempuan</p>
						<p className='text-2xl sm:text-3xl font-black text-pink-950 mt-0.5'>
							{allStudents.filter((s) => s.jenis_kelamin === 'Perempuan').length}
						</p>
					</div>
					<div className='bg-emerald-50 p-4 border-[3px] border-[#0D0D0D] shadow-[3px_3px_0_#000]'>
						<p className='text-[11px] font-black uppercase text-emerald-900 tracking-wider'>Siswa Aktif</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>
							{allStudents.filter((s) => s.status === 'Aktif').length}
						</p>
					</div>
				</div>

				{/* TOOLBAR CONTROLS */}
				<div className='bg-white p-5 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0_#000] space-y-4'>
					<div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
						{/* Mode Tampilan Kolom */}
						<div className='flex items-center gap-1.5 flex-wrap'>
							<span className='text-xs font-black uppercase text-gray-500 mr-1 flex items-center gap-1'>
								<SlidersHorizontal className='w-3.5 h-3.5' /> Tampilan:
							</span>
							{[
								{ id: 'semua', label: '🌐 Semua Kolom' },
								{ id: 'identitas', label: '📌 Identitas Pokok' },
								{ id: 'alamat', label: '📍 Alamat & Domisili' },
								{ id: 'ortu', label: '👨‍👩‍👧 Orang Tua & Kontak' },
							].map((m) => (
								<button
									key={m.id}
									onClick={() => setViewMode(m.id)}
									className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-[2px] border-[#0D0D0D] transition-all ${
										viewMode === m.id
											? 'bg-[#FF90E8] text-[#0D0D0D] shadow-[2px_2px_0_#000]'
											: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
									}`}>
									{m.label}
								</button>
							))}
						</div>

						{/* Refresh */}
						<button
							onClick={fetchHubData}
							disabled={refreshing}
							className='self-start lg:self-auto px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-black text-xs font-black uppercase border-[2px] border-black flex items-center gap-1.5'>
							<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
							<span>Refresh</span>
						</button>
					</div>

					{/* Search & Filters */}
					<div className='grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t-2 border-black/10'>
						<div className='sm:col-span-6 relative'>
							<Search className='w-4 h-4 absolute left-3 top-3 text-gray-500' />
							<input
								type='text'
								placeholder='Cari nama, NIS, NISN, NIK, alamat, atau orang tua...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='w-full pl-9 pr-3 py-2 bg-[#FFF5F0] border-[2.5px] border-[#0D0D0D] text-xs sm:text-sm font-bold text-black focus:outline-none focus:bg-white'
							/>
						</div>

						<div className='sm:col-span-3'>
							<select
								value={filterStatus}
								onChange={(e) => setFilterStatus(e.target.value)}
								className='w-full px-3 py-2 bg-[#FFF5F0] border-[2.5px] border-[#0D0D0D] text-xs sm:text-sm font-bold text-black uppercase cursor-pointer'>
								<option value='all'>Semua Status</option>
								<option value='Aktif'>🟢 Aktif</option>
								<option value='Lulus'>🎓 Lulus</option>
								<option value='Pindah'>🚚 Pindah</option>
								<option value='Boyong'>📦 Boyong</option>
								<option value='Salah Kelas'>⚠️ Salah Kelas</option>
								<option value='Non-Aktif'>⚪ Non-Aktif</option>
							</select>
						</div>

						<div className='sm:col-span-3'>
							<select
								value={filterGender}
								onChange={(e) => setFilterGender(e.target.value)}
								className='w-full px-3 py-2 bg-[#FFF5F0] border-[2.5px] border-[#0D0D0D] text-xs sm:text-sm font-bold text-black uppercase cursor-pointer'>
								<option value='all'>Semua Gender</option>
								<option value='Laki-laki'>👦 Laki-laki</option>
								<option value='Perempuan'>👧 Perempuan</option>
							</select>
						</div>
					</div>

					<div className='flex items-center justify-between text-xs font-bold text-gray-600'>
						<span>
							Menampilkan <b>{filteredSiswa.length}</b> dari {allStudents.length} siswa
						</span>
						{(searchQuery || filterStatus !== 'Aktif' || filterGender !== 'all') && (
							<button
								onClick={() => {
									setSearchQuery('');
									setFilterStatus('Aktif');
									setFilterGender('all');
								}}
								className='text-xs font-black text-rose-600 hover:underline'>
								✕ Reset Filter
							</button>
						)}
					</div>
				</div>

				{/* TABEL BIODATA LENGKAP SEKILAS & SEKALIGUS */}
				<div className='bg-white border-[3px] border-[#0D0D0D] shadow-[5px_5px_0_#000] overflow-hidden'>
					<div className='overflow-x-auto max-h-[68vh]'>
						<table className='w-full text-left border-collapse text-xs whitespace-nowrap'>
							<thead className='bg-[#F5C518] text-[#0D0D0D] border-b-[3px] border-[#0D0D0D] sticky top-0 z-10 font-black uppercase tracking-wider text-[11px] shadow-sm'>
								<tr>
									<th className='p-3 border-r-2 border-[#0D0D0D] text-center w-10'>No</th>
									<th className='p-3 border-r-2 border-[#0D0D0D] text-center w-36'>Aksi Cepat</th>
									<th className='p-3 border-r-2 border-[#0D0D0D]'>Nama Lengkap</th>
									<th className='p-3 border-r-2 border-[#0D0D0D]'>NIS</th>
									<th className='p-3 border-r-2 border-[#0D0D0D]'>NISN</th>
									<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>L/P</th>
									<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>Status</th>

									{(viewMode === 'semua' || viewMode === 'identitas') && (
										<>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>NIK</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Tempat, Tgl Lahir</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Agama</th>
											<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>Anak Ke</th>
											<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>Saudara</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Sekolah Asal (SD/MI)</th>
										</>
									)}

									{(viewMode === 'semua' || viewMode === 'alamat') && (
										<>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Alamat</th>
											<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>RT/RW</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Dusun</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Kelurahan/Desa</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Kecamatan</th>
											<th className='p-3 border-r-2 border-[#0D0D0D] text-center'>Kode Pos</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Jenis Tinggal</th>
										</>
									)}

									{(viewMode === 'semua' || viewMode === 'ortu') && (
										<>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>No. HP / WA</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Nama Ayah</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Pendidikan Ayah</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Pekerjaan Ayah</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Nama Ibu</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Pendidikan Ibu</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Pekerjaan Ibu</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Nama Wali</th>
											<th className='p-3 border-r-2 border-[#0D0D0D]'>Pekerjaan Wali</th>
										</>
									)}
								</tr>
							</thead>

							<tbody className='divide-y-2 divide-black/10 bg-white font-bold'>
								{filteredSiswa.length === 0 ? (
									<tr>
										<td colSpan={25} className='p-12 text-center'>
											<span className='text-4xl block mb-2'>🎒</span>
											<p className='font-black text-sm text-black'>Tidak ada siswa yang sesuai filter</p>
											<p className='text-xs text-gray-500 mt-1'>Coba sesuaikan pencarian atau pilih Semua Status.</p>
										</td>
									</tr>
								) : (
									filteredSiswa.map((siswa, idx) => {
										const cleanWa = String(siswa.no_hp || '').replace(/[^0-9]/g, '');
										const waNumber = cleanWa ? (cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa.startsWith('62') ? cleanWa : '62' + cleanWa) : null;

										return (
											<tr key={siswa.id} className='hover:bg-yellow-50/70 transition-colors'>
												<td className='p-3 border-r border-black/10 text-center font-black text-gray-600'>
													{idx + 1}
												</td>

												{/* AKSI CRUD BARIS */}
												<td className='p-2.5 border-r border-black/10 text-center'>
													<div className='inline-flex items-center gap-1.5'>
														<button
															onClick={() => handleOpenEdit(siswa)}
															title='Edit Biodata Lengkap'
															className='p-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded shadow-[1px_1px_0_#000] text-black'>
															<Edit3 className='w-3.5 h-3.5' />
														</button>

														<button
															onClick={() => handleUbahStatus(siswa)}
															title='Ubah Status / Mutasi'
															className='px-1.5 py-1 bg-cyan-200 hover:bg-cyan-300 border border-black rounded text-[10px] font-black shadow-[1px_1px_0_#000] text-black'>
															Status
														</button>

														{waNumber && (
															<a
																href={`https://wa.me/${waNumber}`}
																target='_blank'
																rel='noopener noreferrer'
																title='Chat WhatsApp Ortu'
																className='p-1.5 bg-emerald-400 hover:bg-emerald-500 text-white border border-black rounded shadow-[1px_1px_0_#000]'>
																<MessageCircle className='w-3.5 h-3.5' />
															</a>
														)}

														<Link
															href={`/siswa/${siswa.id}`}
															title='Buka Profil Detail Siswa'
															className='p-1.5 bg-white hover:bg-gray-100 border border-black rounded shadow-[1px_1px_0_#000] text-black'>
															<Eye className='w-3.5 h-3.5' />
														</Link>

														<button
															onClick={() => handleDeleteSiswa(siswa)}
															title='Hapus Siswa Salah Input'
															className='p-1.5 bg-rose-400 hover:bg-rose-500 text-white border border-black rounded shadow-[1px_1px_0_#000]'>
															<Trash2 className='w-3.5 h-3.5' />
														</button>
													</div>
												</td>

												{/* NAMA LENGKAP */}
												<td className='p-3 border-r border-black/10 font-black text-black'>
													<div className='flex items-center gap-2'>
														<span className='w-6 h-6 rounded-full bg-yellow-200 border border-black flex items-center justify-center text-[10px] shrink-0 font-black'>
															{siswa.nama_lengkap?.charAt(0) || 'S'}
														</span>
														<span>{siswa.nama_lengkap}</span>
													</div>
												</td>

												{/* NIS & NISN */}
												<td className='p-3 border-r border-black/10 font-mono text-gray-700'>
													{siswa.nis || '-'}
												</td>
												<td className='p-3 border-r border-black/10 font-mono text-gray-700'>
													{siswa.nisn || '-'}
												</td>

												{/* GENDER */}
												<td className='p-3 border-r border-black/10 text-center'>
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
															siswa.jenis_kelamin === 'Laki-laki'
																? 'bg-blue-100 text-blue-900'
																: 'bg-pink-100 text-pink-900'
														}`}>
														{siswa.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}
													</span>
												</td>

												{/* STATUS */}
												<td className='p-3 border-r border-black/10 text-center'>
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
															siswa.status === 'Aktif'
																? 'bg-emerald-200 text-emerald-950'
																: siswa.status === 'Lulus'
																? 'bg-purple-200 text-purple-950'
																: 'bg-gray-200 text-gray-800'
														}`}>
														{siswa.status}
													</span>
												</td>

												{/* IDENTITAS POKOK */}
												{(viewMode === 'semua' || viewMode === 'identitas') && (
													<>
														<td className='p-3 border-r border-black/10 font-mono text-gray-600'>
															{siswa.nik || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-800'>
															{siswa.tempat_lahir || '-'}
															{siswa.tanggal_lahir ? `, ${String(siswa.tanggal_lahir).substring(0, 10)}` : ''}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-800'>
															{siswa.agama || 'Islam'}
														</td>
														<td className='p-3 border-r border-black/10 text-center'>
															{siswa.anak_ke || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-center'>
															{siswa.jumlah_saudara !== null && siswa.jumlah_saudara !== undefined
																? siswa.jumlah_saudara
																: '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.sekolah_asal || '-'}
														</td>
													</>
												)}

												{/* ALAMAT & DOMISILI */}
												{(viewMode === 'semua' || viewMode === 'alamat') && (
													<>
														<td className='p-3 border-r border-black/10 max-w-xs truncate' title={siswa.alamat || ''}>
															{siswa.alamat || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-center'>
															{siswa.rt || '-'}/{siswa.rw || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.dusun || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.kelurahan || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.kecamatan || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-center font-mono'>
															{siswa.kode_pos || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.jenis_tinggal || 'Bersama orang tua'}
														</td>
													</>
												)}

												{/* ORANG TUA & KONTAK */}
												{(viewMode === 'semua' || viewMode === 'ortu') && (
													<>
														<td className='p-3 border-r border-black/10 font-mono'>
															{siswa.no_hp || '-'}
														</td>
														<td className='p-3 border-r border-black/10 font-bold text-gray-900'>
															{siswa.nama_ayah || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-600'>
															{siswa.pendidikan_ayah || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.pekerjaan_ayah || '-'}
														</td>
														<td className='p-3 border-r border-black/10 font-bold text-gray-900'>
															{siswa.nama_ibu || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-600'>
															{siswa.pendidikan_ibu || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.pekerjaan_ibu || 'Ibu Rumah Tangga'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-800'>
															{siswa.nama_wali || '-'}
														</td>
														<td className='p-3 border-r border-black/10 text-gray-700'>
															{siswa.pekerjaan_wali || '-'}
														</td>
													</>
												)}
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* MODAL EDIT / TAMBAH BIODATA SISWA */}
				<ModalEditBiodataSiswa
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
					onSubmit={handleSubmitBiodata}
					initialData={selectedSiswa}
					defaultKelas={kelas?.nama_kelas || ''}
					isCreate={isCreateMode}
				/>
			</div>
		</div>
	);
}
