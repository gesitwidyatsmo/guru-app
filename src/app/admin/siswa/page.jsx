'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { useAdminAuth } from '../AdminLayoutClient';

function AdminSiswaContent() {
	const searchParams = useSearchParams();
	const initialKelasParam = searchParams.get('kelas') || 'all';

	const { role: authRole } = useAdminAuth();
	const [siswaList, setSiswaList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentUserRole, setCurrentUserRole] = useState(authRole || null);

	useEffect(() => {
		if (authRole) setCurrentUserRole(authRole);
	}, [authRole]);

	const isReadOnly = currentUserRole === 'Kepala Sekolah';

	// Filters
	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelas, setFilterKelas] = useState(initialKelasParam);
	const [filterStatus, setFilterStatus] = useState('Aktif'); // default Aktif agar rapi, opsi 'all' tersedia
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
			const [resSiswa, resKelas, resAuth] = await Promise.all([
				fetch('/api/siswa'),
				fetch('/api/kelas?all=true'),
				fetch('/api/auth/me'),
			]);

			if (resAuth.ok) {
				const authData = await resAuth.json();
				if (authData?.user?.role) {
					setCurrentUserRole(authData.user.role);
				}
			}

			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
			const dataKelas = resKelas.ok ? await resKelas.json() : [];

			setSiswaList(Array.isArray(dataSiswa) ? dataSiswa : []);
			setKelasList(Array.isArray(dataKelas) ? dataKelas : []);
		} catch (err) {
			console.error('Error load data master siswa:', err);
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
		if (isReadOnly) return;
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			nis: '',
			nisn: '',
			nama_lengkap: '',
			kelas: filterKelas !== 'all' ? filterKelas : (kelasList[0]?.kelas || ''),
			jenis_kelamin: 'Laki-laki',
			status: 'Aktif',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		if (isReadOnly) return;
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			nis: item.nis || '',
			nisn: item.nisn || '',
			nama_lengkap: item.nama_lengkap || '',
			kelas: item.kelas || '',
			jenis_kelamin: item.jenis_kelamin || 'Laki-laki',
			status: item.status || 'Aktif',
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (isReadOnly) return;

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
				text: isEditMode ? 'Profil siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.',
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
		if (isReadOnly) return;

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
									💡 Saran: Klik <b>Edit</b> pada baris siswa ini lalu ubah Status menjadi <b>"Lulus"</b> atau <b>"Pindah"</b>.
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
		ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');

		const kelasName = filterKelas === 'all' ? 'Semua_Kelas' : filterKelas;
		const fileName = `Master_Siswa_${kelasName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
		XLSX.writeFile(wb, fileName);
	};

	// Download template import Excel
	const handleDownloadTemplate = () => {
		const sampleData = [
			{ 'NIS': '1001', 'Nama Lengkap': 'Ahmad Fauzi', 'Jenis Kelamin': 'Laki-laki' },
			{ 'NIS': '1002', 'Nama Lengkap': 'Siti Aisyah', 'Jenis Kelamin': 'Perempuan' },
			{ 'NIS': '1003', 'Nama Lengkap': 'Budi Santoso', 'Jenis Kelamin': 'Laki-laki' },
		];
		const ws = XLSX.utils.json_to_sheet(sampleData);
		ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }];
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
		XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
	};

	// Bulk import Excel handler
	const handleImportSubmit = async (e) => {
		e.preventDefault();
		if (!importFile) {
			Swal.fire('Peringatan', 'Harap pilih file Excel (.xlsx / .xls) terlebih dahulu!', 'warning');
			return;
		}
		if (!importTargetKelas) {
			Swal.fire('Peringatan', 'Harap pilih Kelas Tujuan untuk import siswa!', 'warning');
			return;
		}

		try {
			setIsImporting(true);
			const formDataPayload = new FormData();
			formDataPayload.append('file', importFile);
			formDataPayload.append('kelas_target', importTargetKelas);

			const res = await fetch('/api/siswa', {
				method: 'POST',
				body: formDataPayload,
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal memproses file import.');
			}

			Swal.fire({
				title: 'Import Berhasil!',
				text: `Sebanyak ${data.total || ''} siswa berhasil ditambahkan ke kelas ${importTargetKelas}.`,
				icon: 'success',
				confirmButtonColor: '#00A693',
			});

			setIsImportModalOpen(false);
			setImportFile(null);
			loadData();
		} catch (err) {
			Swal.fire('Gagal Import', err.message, 'error');
		} finally {
			setIsImporting(false);
		}
	};

	if (loading) return <Loader />;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-cyan-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🎒</span> Data Pokok Kesiswaan
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Data Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Kelola profil peserta didik, identitas NIS, status akademik, serta impor/ekspor data massal.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2.5 w-full sm:w-auto'>
					<button
						onClick={handleExportExcel}
						className='neo-btn-outline flex items-center justify-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 bg-white flex-1 sm:flex-none'>
						<svg className='w-4 h-4 text-emerald-700' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
						</svg>
						<span>Ekspor Excel</span>
					</button>

					{!isReadOnly && (
						<>
							<button
								onClick={() => {
									setImportTargetKelas(filterKelas !== 'all' ? filterKelas : (kelasList[0]?.kelas || ''));
									setIsImportModalOpen(true);
								}}
								className='neo-btn-outline flex items-center justify-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 bg-yellow-100 flex-1 sm:flex-none'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' />
								</svg>
								<span>Import Excel</span>
							</button>

							<button
								onClick={openCreateModal}
								className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-2.5 !px-5 whitespace-nowrap shrink-0 w-full sm:w-auto bg-black text-white'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
								</svg>
								<span>Tambah Siswa</span>
							</button>
						</>
					)}
				</div>
			</div>

			{/* Read-Only Notice for Kepsek */}
			{isReadOnly && (
				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<span className='text-2xl'>🎓</span>
						<div>
							<p className='text-sm font-black text-indigo-950 uppercase'>Mode Monitoring Kepala Sekolah</p>
							<p className='text-xs text-indigo-900 font-medium'>Anda memiliki hak supervisi untuk melihat seluruh direktori data siswa dan status akademik (Read Only).</p>
						</div>
					</div>
					<span className='px-3 py-1 bg-white border border-black rounded-lg text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						Read Only
					</span>
				</div>
			)}

			{/* Statistics Cards */}
			<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Siswa Aktif</p>
						<p className='text-2xl font-black text-black mt-0.5'>{siswaAktif}</p>
					</div>
					<span className='w-10 h-10 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🎒
					</span>
				</div>

				<div className='bg-blue-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-blue-800'>Laki-Laki</p>
						<p className='text-2xl font-black text-blue-950 mt-0.5'>{countLaki}</p>
					</div>
					<span className='w-10 h-10 bg-blue-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👦
					</span>
				</div>

				<div className='bg-pink-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-pink-800'>Perempuan</p>
						<p className='text-2xl font-black text-pink-950 mt-0.5'>{countPerempuan}</p>
					</div>
					<span className='w-10 h-10 bg-pink-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👧
					</span>
				</div>

				<div className='bg-purple-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-purple-800'>Total Terdaftar</p>
						<p className='text-2xl font-black text-purple-950 mt-0.5'>{totalSiswa}</p>
					</div>
					<span className='w-10 h-10 bg-purple-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📚
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
				<div className='grid grid-cols-1 sm:grid-cols-12 gap-3 items-center'>
					{/* Search */}
					<div className='sm:col-span-5 relative'>
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
							placeholder='Cari nama siswa atau NIS...'
							className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
						/>
					</div>

					{/* Filter Kelas */}
					<div className='sm:col-span-3'>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2 text-xs sm:text-sm bg-white font-bold w-full'>
							<option value='all'>Semua Rombel Kelas ({kelasList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id || k.kelas} value={k.kelas}>
									Kelas {k.kelas}
								</option>
							))}
						</select>
					</div>

					{/* Filter Status */}
					<div className='sm:col-span-2'>
						<select
							value={filterStatus}
							onChange={(e) => setFilterStatus(e.target.value)}
							className='neo-input !py-2 text-xs sm:text-sm bg-white font-bold w-full'>
							<option value='all'>Semua Status</option>
							<option value='Aktif'>🟢 Aktif</option>
							<option value='Lulus'>🎓 Lulus</option>
							<option value='Pindah'>🚚 Pindah</option>
							<option value='Boyong'>📦 Boyong</option>
							<option value='Non-Aktif'>⚪ Non-Aktif</option>
						</select>
					</div>

					{/* Filter Gender */}
					<div className='sm:col-span-2'>
						<select
							value={filterGender}
							onChange={(e) => setFilterGender(e.target.value)}
							className='neo-input !py-2 text-xs sm:text-sm bg-white font-bold w-full'>
							<option value='all'>Semua Gender</option>
							<option value='Laki-laki'>👦 Laki-laki</option>
							<option value='Perempuan'>👧 Perempuan</option>
						</select>
					</div>
				</div>

				<div className='flex items-center justify-between text-xs font-bold text-gray-600 pt-1'>
					<span>
						Menampilkan <b>{filteredSiswa.length}</b> siswa terfilter
					</span>
					{(searchQuery || filterKelas !== 'all' || filterStatus !== 'all' || filterGender !== 'all') && (
						<button
							onClick={() => {
								setSearchQuery('');
								setFilterKelas('all');
								setFilterStatus('all');
								setFilterGender('all');
							}}
							className='text-xs font-black text-rose-600 hover:underline'>
							✕ Reset Filter
						</button>
					)}
				</div>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Identitas Siswa
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Kelas / Rombel
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Gender
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider'>
									Status
								</th>
								<th className='px-5 py-4 text-xs font-black text-black uppercase tracking-wider text-right'>
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{filteredSiswa.length === 0 ? (
								<tr>
									<td colSpan='5' className='px-5 py-12 text-center'>
										<span className='text-4xl block mb-2'>🎒</span>
										<p className='font-black text-base text-black'>Tidak ada data siswa yang cocok</p>
										<p className='text-xs font-bold text-gray-500 mt-1'>
											Coba sesuaikan pencarian nama/NIS atau ubah opsi filter Anda.
										</p>
									</td>
								</tr>
							) : (
								filteredSiswa.map((item) => (
									<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
										<td className='px-5 py-3.5 whitespace-nowrap'>
											<div className='flex items-center gap-3'>
												<span className='w-9 h-9 rounded-full bg-cyan-200 border-2 border-black flex items-center justify-center font-black text-xs text-black shrink-0 shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{item.nama_lengkap ? item.nama_lengkap.charAt(0).toUpperCase() : 'S'}
												</span>
												<div>
													<span className='font-black text-black text-sm block'>
														{item.nama_lengkap}
													</span>
													<span className='text-[11px] font-mono font-bold text-gray-500'>
														NIS: {item.nis || '-'}{item.nisn ? ` | NISN: ${item.nisn}` : ''}
													</span>
												</div>
											</div>
										</td>

										<td className='px-5 py-3.5 whitespace-nowrap'>
											<span className='px-2.5 py-1 bg-yellow-100 border border-black rounded-lg text-xs font-black text-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
												{item.kelas || '-'}
											</span>
										</td>

										<td className='px-5 py-3.5 whitespace-nowrap'>
											<span className='text-xs font-bold text-gray-700'>
												{item.jenis_kelamin === 'Laki-laki' ? '👦 Laki-laki' : '👧 Perempuan'}
											</span>
										</td>

										<td className='px-5 py-3.5 whitespace-nowrap'>
											<span
												className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase border border-black shadow-[1px_1px_0px_0px_#0D0D0D] ${
													item.status === 'Aktif'
														? 'bg-emerald-300 text-black'
														: item.status === 'Lulus'
														? 'bg-purple-300 text-black'
														: item.status === 'Pindah' || item.status === 'Boyong'
														? 'bg-yellow-300 text-black'
														: 'bg-gray-200 text-gray-800'
												}`}>
												{item.status}
											</span>
										</td>

										<td className='px-5 py-3.5 whitespace-nowrap text-right'>
											<div className='inline-flex items-center gap-2'>
												<Link
													href={`/siswa/${item.id}`}
													title='Lihat Detail & Riwayat Siswa'
													className='p-2 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
													<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
														<path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
														<path strokeLinecap='round' strokeLinejoin='round' d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
													</svg>
												</Link>

												{!isReadOnly && (
													<>
														<button
															onClick={() => openEditModal(item)}
															title='Edit Siswa'
															className='p-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
																<path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
															</svg>
														</button>

														<button
															onClick={() => handleDelete(item)}
															title='Hapus Siswa'
															className='p-2 bg-rose-400 hover:bg-rose-500 border-2 border-black rounded-lg text-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
																<path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
															</svg>
														</button>
													</>
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

			{/* Modal Form Tambah / Edit Siswa */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Header Modal */}
						<div className='bg-cyan-300 border-b-2 border-black p-5 flex items-center justify-between'>
							<h3 className='font-black text-lg text-black uppercase tracking-tight flex items-center gap-2'>
								<span>🎒</span>
								<span>{isEditMode ? 'Edit Data Siswa' : 'Tambah Peserta Didik Baru'}</span>
							</h3>
							<button
								onClick={() => !submitting && setIsModalOpen(false)}
								className='w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-rose-400 hover:text-white transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Form Content */}
						<form onSubmit={handleSubmit} className='p-6 space-y-4'>
							<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										NIS
									</label>
									<input
										type='text'
										placeholder='Contoh: 10452'
										value={formData.nis}
										onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
										className='neo-input text-sm font-mono'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										NISN
									</label>
									<input
										type='text'
										placeholder='10 digit NISN'
										value={formData.nisn}
										onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
										className='neo-input text-sm font-mono'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Rombel / Kelas <span className='text-rose-600'>*</span>
									</label>
									<select
										required
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
										className='neo-input text-sm bg-white font-bold'>
										<option value=''>-- Pilih Kelas --</option>
										{kelasList.map((k) => (
											<option key={k.id || k.kelas} value={k.kelas}>
												{k.kelas}
											</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Nama Lengkap Siswa <span className='text-rose-600'>*</span>
								</label>
								<input
									type='text'
									required
									placeholder='Nama lengkap sesuai dokumen rapor'
									value={formData.nama_lengkap}
									onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
									className='neo-input text-sm'
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
										className='neo-input text-sm bg-white font-bold'>
										<option value='Laki-laki'>👦 Laki-laki</option>
										<option value='Perempuan'>👧 Perempuan</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Status Akademik
									</label>
									<select
										value={formData.status}
										onChange={(e) => setFormData({ ...formData, status: e.target.value })}
										className='neo-input text-sm bg-white font-bold'>
										<option value='Aktif'>🟢 Aktif</option>
										<option value='Lulus'>🎓 Lulus</option>
										<option value='Pindah'>🚚 Pindah</option>
										<option value='Boyong'>📦 Boyong</option>
										<option value='Salah Kelas'>⚠️ Salah Kelas</option>
										<option value='Non-Aktif'>⚪ Non-Aktif</option>
									</select>
								</div>
							</div>

							<div className='pt-4 border-t-2 border-black/10 flex justify-end gap-3'>
								<button
									type='button'
									disabled={submitting}
									onClick={() => setIsModalOpen(false)}
									className='neo-btn-outline text-xs sm:text-sm !py-2.5 !px-5'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='neo-btn-primary text-xs sm:text-sm !py-2.5 !px-6 bg-black text-white disabled:opacity-50'>
									{submitting ? 'Menyimpan...' : isEditMode ? 'Perbarui Data' : 'Simpan Siswa'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Modal Import Excel */}
			{isImportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Header Modal */}
						<div className='bg-yellow-300 border-b-2 border-black p-5 flex items-center justify-between'>
							<h3 className='font-black text-lg text-black uppercase tracking-tight flex items-center gap-2'>
								<span>📊</span>
								<span>Import Data Siswa via Excel</span>
							</h3>
							<button
								onClick={() => !isImporting && setIsImportModalOpen(false)}
								className='w-8 h-8 rounded-lg bg-white border-2 border-black font-black text-sm flex items-center justify-center hover:bg-rose-400 hover:text-white transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Form Content */}
						<form onSubmit={handleImportSubmit} className='p-6 space-y-4'>
							<div className='bg-yellow-50 border-2 border-black rounded-xl p-4 space-y-2'>
								<p className='text-xs font-black uppercase text-black'>Format Kolom Spreadsheet:</p>
								<p className='text-xs text-gray-700 leading-relaxed font-medium'>
									Pastikan file Excel memiliki kolom: <b>NIS</b>, <b>Nama Lengkap</b>, dan opsional <b>Jenis Kelamin</b>.
								</p>
								<button
									type='button'
									onClick={handleDownloadTemplate}
									className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-lg text-xs font-black text-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
									<span>📥</span>
									<span>Unduh Contoh Template Excel</span>
								</button>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Target Rombel / Kelas <span className='text-rose-600'>*</span>
								</label>
								<select
									required
									value={importTargetKelas}
									onChange={(e) => setImportTargetKelas(e.target.value)}
									className='neo-input text-sm bg-white font-bold'>
									<option value=''>-- Pilih Kelas Tujuan --</option>
									{kelasList.map((k) => (
										<option key={k.id || k.kelas} value={k.kelas}>
											Kelas {k.kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Pilih File Excel (.xlsx / .xls) <span className='text-rose-600'>*</span>
								</label>
								<input
									type='file'
									required
									accept='.xlsx, .xls'
									onChange={(e) => setImportFile(e.target.files?.[0] || null)}
									className='neo-input text-xs sm:text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:bg-yellow-300 file:text-black cursor-pointer'
								/>
							</div>

							<div className='pt-4 border-t-2 border-black/10 flex justify-end gap-3'>
								<button
									type='button'
									disabled={isImporting}
									onClick={() => setIsImportModalOpen(false)}
									className='neo-btn-outline text-xs sm:text-sm !py-2.5 !px-5'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isImporting}
									className='neo-btn-primary text-xs sm:text-sm !py-2.5 !px-6 bg-black text-white disabled:opacity-50'>
									{isImporting ? 'Mengimpor Data...' : 'Mulai Import'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

export default function AdminSiswaPage() {
	return (
		<Suspense fallback={<Loader />}>
			<AdminSiswaContent />
		</Suspense>
	);
}
