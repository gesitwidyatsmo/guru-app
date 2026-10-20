'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { useAcademic } from '@/context/AcademicContext';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

function KurikulumSiswaContent() {
	const searchParams = useSearchParams();
	const initialKelasParam = searchParams.get('kelas') || 'all';

	const { role, nama } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();

	const [siswaList, setSiswaList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filters
	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelas, setFilterKelas] = useState(initialKelasParam);
	const [filterStatus, setFilterStatus] = useState('Aktif'); // default Aktif
	const [filterGender, setFilterGender] = useState('all');

	// Modals: Add/Edit Siswa
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		nis: '',
		nama_lengkap: '',
		kelas: '',
		jenis_kelamin: 'Laki-laki',
		status: 'Aktif',
	});

	// Modals: Import Excel
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [importTargetKelas, setImportTargetKelas] = useState('');
	const [importFile, setImportFile] = useState(null);
	const [isImporting, setIsImporting] = useState(false);

	const loadData = async () => {
		try {
			setLoading(true);
			const [resSiswa, resKelas] = await Promise.all([
				fetch('/api/siswa'),
				fetch('/api/kelas?all=true'),
			]);

			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
			const dataKelas = resKelas.ok ? await resKelas.json() : [];

			setSiswaList(Array.isArray(dataSiswa) ? dataSiswa : []);
			setKelasList(Array.isArray(dataKelas) ? dataKelas : []);
		} catch (err) {
			console.error('Error load data master siswa kurikulum:', err);
			Swal.fire('Error', 'Gagal memuat data siswa dari server.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Update filter jika query param berubah
	useEffect(() => {
		const param = searchParams.get('kelas');
		if (param) setFilterKelas(param);
	}, [searchParams]);

	// Filtered list
	const filteredSiswa = useMemo(() => {
		return siswaList.filter((s) => {
			const q = searchQuery.toLowerCase().trim();
			const matchSearch =
				!q ||
				(s.nama_lengkap || '').toLowerCase().includes(q) ||
				(s.nis && String(s.nis).toLowerCase().includes(q));

			const matchKelas = filterKelas === 'all' || s.kelas === filterKelas;
			const matchStatus = filterStatus === 'all' || s.status === filterStatus;
			const matchGender = filterGender === 'all' || s.jenis_kelamin === filterGender;

			return matchSearch && matchKelas && matchStatus && matchGender;
		});
	}, [siswaList, searchQuery, filterKelas, filterStatus, filterGender]);

	// Stats
	const totalSiswa = siswaList.length;
	const siswaAktif = useMemo(() => siswaList.filter((s) => s.status === 'Aktif').length, [siswaList]);
	const countLaki = useMemo(() => siswaList.filter((s) => s.status === 'Aktif' && s.jenis_kelamin === 'Laki-laki').length, [siswaList]);
	const countPerempuan = useMemo(() => siswaList.filter((s) => s.status === 'Aktif' && s.jenis_kelamin === 'Perempuan').length, [siswaList]);
	const siswaNonAktif = useMemo(() => siswaList.filter((s) => s.status !== 'Aktif').length, [siswaList]);

	// Modal Handlers
	const openCreateModal = () => {
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			nis: '',
			nama_lengkap: '',
			kelas: filterKelas !== 'all' ? filterKelas : (kelasList[0]?.kelas || ''),
			jenis_kelamin: 'Laki-laki',
			status: 'Aktif',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			nis: item.nis || '',
			nama_lengkap: item.nama_lengkap || '',
			kelas: item.kelas || '',
			jenis_kelamin: item.jenis_kelamin || 'Laki-laki',
			status: item.status || 'Aktif',
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.nama_lengkap.trim() || !formData.kelas) {
			Swal.fire('Peringatan', 'Nama Lengkap dan Kelas wajib diisi!', 'warning');
			return;
		}

		try {
			setSubmitting(true);
			const url = '/api/siswa';
			const method = isEditMode ? 'PUT' : 'POST';
			const payload = isEditMode
				? { id: editId, ...formData }
				: { ...formData };

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan data siswa.');
			}

			Swal.fire({
				title: 'Berhasil!',
				text: isEditMode ? 'Data siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.',
				icon: 'success',
				confirmButtonColor: '#00A693',
			});

			setIsModalOpen(false);
			loadData();
		} catch (err) {
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (item) => {
		const confirm = await Swal.fire({
			title: 'Hapus Siswa?',
			html: `Anda yakin ingin menghapus data siswa <b>${item.nama_lengkap}</b> (${item.kelas})?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus Siswa',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		try {
			const res = await fetch(`/api/siswa?id=${item.id}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			if (!res.ok) {
				if (data.hasHistory) {
					await Swal.fire({
						title: 'Tidak Dapat Dihapus',
						html: `
							<div class="text-left text-sm space-y-2">
								<p>${data.error}</p>
								<p class="font-bold text-xs bg-yellow-100 p-2 border-2 border-black rounded-lg">
									💡 Saran: Klik <b>Edit</b> pada baris siswa ini lalu ubah Status menjadi <b>"Lulus"</b> atau <b>"Pindah"</b> untuk menjaga arsip rapor.
								</p>
							</div>
						`,
						icon: 'info',
						confirmButtonColor: '#0D0D0D',
					});
					return;
				}
				throw new Error(data.error || 'Gagal menghapus siswa.');
			}

			Swal.fire('Terhapus!', 'Data siswa telah berhasil dihapus.', 'success');
			loadData();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		}
	};

	// Export filtered siswa to Excel
	const handleExportExcel = () => {
		if (filteredSiswa.length === 0) {
			Swal.fire('Info', 'Tidak ada data siswa untuk diekspor pada filter ini.', 'info');
			return;
		}

		const exportRows = filteredSiswa.map((s, idx) => ({
			No: idx + 1,
			NIS: s.nis || '-',
			'Nama Lengkap': s.nama_lengkap,
			Kelas: s.kelas,
			'Jenis Kelamin': s.jenis_kelamin,
			Status: s.status,
		}));

		const ws = XLSX.utils.json_to_sheet(exportRows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');

		const filterLabel = filterKelas !== 'all' ? `_Kelas_${filterKelas}` : '';
		XLSX.writeFile(wb, `Data_Siswa_Kurikulum${filterLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
	};

	// Unduh Template Excel Import
	const handleDownloadTemplate = () => {
		const templateData = [
			{ 'NIS': '2026001', 'Nama Lengkap': 'Ahmad Fauzan', 'Jenis Kelamin': 'Laki-laki' },
			{ 'NIS': '2026002', 'Nama Lengkap': 'Fathimah Azzahra', 'Jenis Kelamin': 'Perempuan' },
			{ 'NIS': '2026003', 'Nama Lengkap': 'Muhammad Rizky', 'Jenis Kelamin': 'Laki-laki' },
		];

		const ws = XLSX.utils.json_to_sheet(templateData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
		XLSX.writeFile(wb, 'Template_Import_Siswa_Kurikulum.xlsx');
	};

	// Eksekusi Import Excel
	const handleImportSubmit = async (e) => {
		e.preventDefault();

		if (!importTargetKelas) {
			Swal.fire('Peringatan', 'Silakan pilih kelas tujuan import!', 'warning');
			return;
		}

		if (!importFile) {
			Swal.fire('Peringatan', 'Silakan pilih file Excel (.xlsx / .xls) yang valid!', 'warning');
			return;
		}

		try {
			setIsImporting(true);
			const fData = new FormData();
			fData.append('file', importFile);
			fData.append('kelas_target', importTargetKelas);

			const res = await fetch('/api/siswa', {
				method: 'POST',
				body: fData,
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mengimpor data siswa.');

			Swal.fire({
				title: 'Import Berhasil!',
				text: `Sebanyak ${data.total || 'semua'} siswa berhasil diimpor ke kelas ${importTargetKelas}.`,
				icon: 'success',
				confirmButtonColor: '#00A693',
			});

			setIsImportModalOpen(false);
			setImportFile(null);
			setImportTargetKelas('');
			loadData();
		} catch (err) {
			Swal.fire('Gagal Import', err.message, 'error');
		} finally {
			setIsImporting(false);
		}
	};

	if (loading) return <Loader text='Memuat Master Data Siswa...' />;

	return (
		<div className='space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-amber-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🎓</span> Manajemen Peserta Didik
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Data Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Kelola biodata santri/siswa, plotting rombel kelas, import massal via Excel, serta arsip status keaktifan akademik.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2.5 w-full md:w-auto'>
					<AcademicPeriodChip />
					<button
						onClick={() => {
							setImportTargetKelas(filterKelas !== 'all' ? filterKelas : (kelasList[0]?.kelas || ''));
							setIsImportModalOpen(true);
						}}
						className='neo-btn-outline flex items-center justify-center gap-1.5 text-xs sm:text-sm !py-2.5 !px-3.5 bg-yellow-200'>
						<span>📥</span>
						<span>Import Excel</span>
					</button>
					<button
						onClick={openCreateModal}
						className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 whitespace-nowrap shrink-0'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
						</svg>
						<span>Tambah Siswa</span>
					</button>
				</div>
			</div>

			{/* Stat Cards */}
			<div className='grid grid-cols-2 lg:grid-cols-5 gap-3.5'>
				<div className='bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-gray-500'>Total Terdaftar</p>
					<p className='text-2xl font-black text-black mt-0.5'>{totalSiswa}</p>
					<span className='text-[10px] font-bold text-gray-600'>Semua riwayat siswa</span>
				</div>

				<div className='bg-emerald-100 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-emerald-900'>Siswa Aktif</p>
					<p className='text-2xl font-black text-black mt-0.5'>{siswaAktif}</p>
					<span className='text-[10px] font-bold text-emerald-800'>Berstatus aktif belajar</span>
				</div>

				<div className='bg-sky-100 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-sky-900'>Laki-Laki (Aktif)</p>
					<p className='text-2xl font-black text-black mt-0.5'>{countLaki}</p>
					<span className='text-[10px] font-bold text-sky-800'>Santri / Siswa putra</span>
				</div>

				<div className='bg-pink-100 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-pink-900'>Perempuan (Aktif)</p>
					<p className='text-2xl font-black text-black mt-0.5'>{countPerempuan}</p>
					<span className='text-[10px] font-bold text-pink-800'>Santriwati / Siswi putri</span>
				</div>

				<div className='bg-rose-100 border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#0D0D0D] col-span-2 lg:col-span-1'>
					<p className='text-[10px] font-black uppercase text-rose-900'>Non-Aktif / Lulus</p>
					<p className='text-2xl font-black text-black mt-0.5'>{siswaNonAktif}</p>
					<span className='text-[10px] font-bold text-rose-800'>Pindah, Lulus, dsb.</span>
				</div>
			</div>

			{/* Filter Toolbar */}
			<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3'>
				<div className='flex flex-wrap items-center gap-2.5 flex-1'>
					{/* Search */}
					<div className='relative flex-1 min-w-[200px]'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari Nama atau NIS siswa...'
							className='w-full pl-9 pr-4 py-2 border-2 border-black rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
						/>
						<svg
							className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
						</svg>
					</div>

					{/* Filter Kelas */}
					<select
						value={filterKelas}
						onChange={(e) => setFilterKelas(e.target.value)}
						className='py-2 px-3 border-2 border-black rounded-lg text-xs font-bold bg-white focus:outline-none shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<option value='all'>Semua Rombel Kelas</option>
						{kelasList.map((k) => (
							<option key={k.id} value={k.kelas}>
								Kelas {k.kelas}
							</option>
						))}
					</select>

					{/* Filter Status */}
					<select
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
						className='py-2 px-3 border-2 border-black rounded-lg text-xs font-bold bg-white focus:outline-none shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<option value='Aktif'>Status: Aktif Saja</option>
						<option value='all'>Semua Status</option>
						<option value='Lulus'>Lulus</option>
						<option value='Pindah'>Pindah</option>
						<option value='Non-Aktif'>Non-Aktif</option>
					</select>

					{/* Filter Gender */}
					<select
						value={filterGender}
						onChange={(e) => setFilterGender(e.target.value)}
						className='py-2 px-3 border-2 border-black rounded-lg text-xs font-bold bg-white focus:outline-none shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<option value='all'>Semua Gender</option>
						<option value='Laki-laki'>Laki-laki</option>
						<option value='Perempuan'>Perempuan</option>
					</select>
				</div>

				{/* Export Button */}
				<div className='flex items-center gap-2 shrink-0'>
					<button
						onClick={handleExportExcel}
						className='px-3 py-2 bg-emerald-300 border-2 border-black rounded-lg text-xs font-black hover:bg-emerald-400 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
						<span>📊</span> Ekspor Excel ({filteredSiswa.length})
					</button>
				</div>
			</div>

			{/* Table Siswa */}
			<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='border-b-2 border-black bg-yellow-200 text-black text-xs font-black uppercase tracking-wider'>
								<th className='py-3.5 px-4 text-center w-12'>No</th>
								<th className='py-3.5 px-4'>NIS</th>
								<th className='py-3.5 px-4'>Nama Lengkap Siswa</th>
								<th className='py-3.5 px-4 text-center'>Rombel Kelas</th>
								<th className='py-3.5 px-4 text-center'>Jenis Kelamin</th>
								<th className='py-3.5 px-4 text-center'>Status</th>
								<th className='py-3.5 px-4 text-right'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{filteredSiswa.length === 0 ? (
								<tr>
									<td colSpan={7} className='text-center py-12 text-gray-500'>
										<span className='text-3xl block mb-2'>🎓</span>
										<p className='font-black text-sm text-black'>Tidak ada data siswa yang cocok dengan filter</p>
										<p className='text-xs text-gray-500 mt-1'>Coba sesuaikan kata kunci pencarian atau rombel kelas.</p>
									</td>
								</tr>
							) : (
								filteredSiswa.map((item, idx) => {
									const isAktif = item.status === 'Aktif';

									return (
										<tr key={item.id} className='hover:bg-yellow-50/70 transition-colors'>
											<td className='py-3 px-4 text-center font-mono text-gray-600 font-bold'>
												{idx + 1}
											</td>
											<td className='py-3 px-4 font-mono font-bold text-gray-700'>
												{item.nis || '-'}
											</td>
											<td className='py-3 px-4'>
												<span className='font-black text-black block'>{item.nama_lengkap}</span>
											</td>
											<td className='py-3 px-4 text-center'>
												<span className='px-2.5 py-0.5 bg-black text-yellow-300 font-black rounded-lg text-xs shadow-[1px_1px_0px_0px_#000]'>
													{item.kelas}
												</span>
											</td>
											<td className='py-3 px-4 text-center'>
												<span
													className={`px-2 py-0.5 rounded text-[11px] font-black border ${
														item.jenis_kelamin === 'Laki-laki'
															? 'bg-blue-100 border-blue-400 text-blue-900'
															: 'bg-pink-100 border-pink-400 text-pink-900'
													}`}>
													{item.jenis_kelamin === 'Laki-laki' ? '♂ L' : '♀ P'}
												</span>
											</td>
											<td className='py-3 px-4 text-center'>
												<span
													className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
														isAktif
															? 'bg-emerald-100 border-emerald-500 text-emerald-950'
															: item.status === 'Lulus'
															? 'bg-sky-100 border-sky-500 text-sky-950'
															: 'bg-rose-100 border-rose-500 text-rose-950'
													}`}>
													{item.status}
												</span>
											</td>
											<td className='py-3 px-4 text-right'>
												<div className='flex items-center justify-end gap-1.5'>
													<button
														onClick={() => openEditModal(item)}
														className='p-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] flex items-center gap-1'
														title='Edit Siswa'>
														<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
															<path strokeLinecap='round' strokeLinejoin='round' d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' />
														</svg>
														<span>Edit</span>
													</button>
													<button
														onClick={() => handleDelete(item)}
														className='p-1.5 bg-rose-200 hover:bg-rose-300 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] text-rose-900 flex items-center gap-1'
														title='Hapus Siswa'>
														<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
															<path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
														</svg>
														<span>Hapus</span>
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

			{/* Modal Add / Edit Siswa */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg p-6 shadow-[8px_8px_0px_0px_#0D0D0D] space-y-5 animate-scale-up'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black text-black flex items-center gap-2'>
								<span>{isEditMode ? '✏️' : '🎓'}</span>
								{isEditMode ? 'Edit Biodata Siswa' : 'Tambah Siswa Baru'}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='p-1.5 hover:bg-gray-100 border-2 border-black rounded-lg transition-colors font-black text-xs'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} className='space-y-4'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										NIS (Nomor Induk Siswa)
									</label>
									<input
										type='text'
										value={formData.nis}
										onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
										placeholder='Contoh: 2026010'
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Rombel Kelas <span className='text-red-500'>*</span>
									</label>
									<select
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
										required
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<option value=''>-- Pilih Rombel Kelas --</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.kelas}>
												Kelas {k.kelas}
											</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Nama Lengkap Siswa <span className='text-red-500'>*</span>
								</label>
								<input
									type='text'
									value={formData.nama_lengkap}
									onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
									placeholder='Masukkan nama lengkap santri / siswa...'
									required
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Jenis Kelamin
									</label>
									<select
										value={formData.jenis_kelamin}
										onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<option value='Laki-laki'>Laki-laki</option>
										<option value='Perempuan'>Perempuan</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Status Siswa
									</label>
									<select
										value={formData.status}
										onChange={(e) => setFormData({ ...formData, status: e.target.value })}
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<option value='Aktif'>Aktif</option>
										<option value='Lulus'>Lulus</option>
										<option value='Pindah'>Pindah</option>
										<option value='Non-Aktif'>Non-Aktif</option>
									</select>
								</div>
							</div>

							<div className='flex items-center justify-end gap-3 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl text-xs font-bold hover:bg-gray-100'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='neo-btn-primary text-xs font-black !py-2 !px-4 flex items-center gap-1.5 disabled:opacity-50'>
									{submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Siswa'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Modal Bulk Import Excel */}
			{isImportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg p-6 shadow-[8px_8px_0px_0px_#0D0D0D] space-y-5 animate-scale-up'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black text-black flex items-center gap-2'>
								<span>📥</span> Import Massal Siswa via Excel
							</h3>
							<button
								onClick={() => setIsImportModalOpen(false)}
								className='p-1.5 hover:bg-gray-100 border-2 border-black rounded-lg transition-colors font-black text-xs'>
								✕
							</button>
						</div>

						<form onSubmit={handleImportSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Target Rombel Kelas <span className='text-red-500'>*</span>
								</label>
								<select
									value={importTargetKelas}
									onChange={(e) => setImportTargetKelas(e.target.value)}
									required
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<option value=''>-- Pilih Kelas Tujuan --</option>
									{kelasList.map((k) => (
										<option key={k.id} value={k.kelas}>
											Kelas {k.kelas}
										</option>
									))}
								</select>
								<p className='text-[10px] font-medium text-gray-500 mt-1'>
									Seluruh siswa dalam file Excel ini akan dimasukkan ke rombel kelas yang dipilih.
								</p>
							</div>

							<div>
								<div className='flex items-center justify-between mb-1.5'>
									<label className='block text-xs font-black uppercase text-black'>
										File Excel (.xlsx / .xls) <span className='text-red-500'>*</span>
									</label>
									<button
										type='button'
										onClick={handleDownloadTemplate}
										className='text-[11px] font-black text-blue-600 hover:underline flex items-center gap-1'>
										<span>📄 Unduh Format Template</span>
									</button>
								</div>
								<input
									type='file'
									accept='.xlsx, .xls'
									onChange={(e) => setImportFile(e.target.files?.[0] || null)}
									required
									className='w-full px-3.5 py-2.5 border-2 border-dashed border-black rounded-xl text-xs font-bold bg-gray-50 focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:bg-yellow-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
								<p className='text-[10px] font-medium text-gray-500 mt-1.5'>
									Format kolom Excel wajib: <b>NIS</b>, <b>Nama Lengkap</b>, <b>Jenis Kelamin</b> (Laki-laki / Perempuan).
								</p>
							</div>

							<div className='p-3 bg-yellow-50 border-2 border-black rounded-xl text-xs font-bold text-black space-y-1'>
								<p className='font-black flex items-center gap-1'>
									<span>💡</span> Petunjuk Pengisian:
								</p>
								<ul className='list-disc list-inside text-[11px] text-gray-700 space-y-0.5'>
									<li>Gunakan template Excel resmi agar nama kolom terbaca sempurna.</li>
									<li>Status siswa hasil import akan otomatis disetel menjadi <b>Aktif</b>.</li>
								</ul>
							</div>

							<div className='flex items-center justify-end gap-3 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setIsImportModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl text-xs font-bold hover:bg-gray-100'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isImporting}
									className='neo-btn-primary text-xs font-black !py-2 !px-4 flex items-center gap-1.5 disabled:opacity-50'>
									{isImporting ? 'Sedang Mengimpor...' : 'Mulai Import Siswa'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

export default function KurikulumSiswaPage() {
	return (
		<Suspense fallback={<Loader text='Memuat Halaman Siswa...' />}>
			<KurikulumSiswaContent />
		</Suspense>
	);
}
