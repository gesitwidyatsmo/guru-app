'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, drawKopSuratPDF, fetchSchoolProfile } from '@/lib/pdfKopSurat';
import { useAcademic } from '@/context/AcademicContext';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export default function KurikulumKelasPage() {
	const { role, nama } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();

	const [kelasList, setKelasList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	// Filters
	const [searchQuery, setSearchQuery] = useState('');
	const [filterWali, setFilterWali] = useState('all'); // all | has_wali | no_wali

	// Modals
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		kelas: '',
		id_wali_kelas: '',
	});

	const loadData = async () => {
		try {
			setLoading(true);
			const [resKelas, resUsers, resSiswa, pProfile] = await Promise.all([
				fetch('/api/kelas?all=true'),
				fetch('/api/users'),
				fetch('/api/siswa'),
				fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
			]);

			const dataKelas = resKelas.ok ? await resKelas.json() : [];
			const dataUsers = resUsers.ok ? await resUsers.json() : [];
			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

			const onlyGuru = Array.isArray(dataUsers) ? dataUsers.filter((u) => u.role === 'Guru') : [];

			setKelasList(Array.isArray(dataKelas) ? dataKelas : []);
			setGuruList(onlyGuru);
			setSiswaList(Array.isArray(dataSiswa) ? dataSiswa : []);
			if (pProfile) setSchoolProfile(pProfile);
		} catch (err) {
			console.error('Error load data master kelas kurikulum:', err);
			Swal.fire('Error', 'Gagal memuat data rombel kelas dari server.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Hitung siswa aktif per kelas
	const siswaStatsMap = useMemo(() => {
		const map = {};
		siswaList.forEach((s) => {
			if (s.kelas && s.status === 'Aktif') {
				if (!map[s.kelas]) {
					map[s.kelas] = { total: 0, laki: 0, perempuan: 0 };
				}
				map[s.kelas].total += 1;
				if (s.jenis_kelamin === 'Laki-laki') map[s.kelas].laki += 1;
				else if (s.jenis_kelamin === 'Perempuan') map[s.kelas].perempuan += 1;
			}
		});
		return map;
	}, [siswaList]);

	// Filtered kelas
	const filteredKelas = useMemo(() => {
		return kelasList.filter((k) => {
			const namaKelas = (k.kelas || '').toLowerCase();
			const waliKelas = (k.wali_kelas || '').toLowerCase();
			const q = searchQuery.toLowerCase().trim();

			const matchSearch = !q || namaKelas.includes(q) || waliKelas.includes(q);

			let matchWali = true;
			if (filterWali === 'has_wali') matchWali = Boolean(k.id_wali_kelas);
			if (filterWali === 'no_wali') matchWali = !k.id_wali_kelas;

			return matchSearch && matchWali;
		});
	}, [kelasList, searchQuery, filterWali]);

	// Stats
	const totalKelas = kelasList.length;
	const kelasWithWali = useMemo(() => kelasList.filter((k) => k.id_wali_kelas).length, [kelasList]);
	const totalSiswaAktif = useMemo(() => siswaList.filter((s) => s.status === 'Aktif').length, [siswaList]);

	const openCreateModal = () => {
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			kelas: '',
			id_wali_kelas: '',
		});
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			kelas: item.kelas || '',
			id_wali_kelas: item.id_wali_kelas || '',
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		const namaKelas = formData.kelas.trim();
		if (!namaKelas) {
			Swal.fire('Peringatan', 'Nama kelas wajib diisi!', 'warning');
			return;
		}

		try {
			setSubmitting(true);
			const url = '/api/kelas';
			const method = isEditMode ? 'PUT' : 'POST';
			const body = isEditMode
				? { id: editId, kelas: namaKelas, id_wali_kelas: formData.id_wali_kelas || null }
				: { kelas: namaKelas, id_wali_kelas: formData.id_wali_kelas || null };

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan data kelas.');
			}

			Swal.fire({
				title: 'Berhasil!',
				text: isEditMode ? 'Data rombel kelas berhasil diperbarui.' : 'Rombel kelas baru berhasil ditambahkan.',
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
		const stat = siswaStatsMap[item.kelas];
		const jumlahSiswa = stat?.total || 0;
		if (jumlahSiswa > 0) {
			Swal.fire({
				title: 'Kelas Tidak Dapat Dihapus',
				html: `Kelas <b>${item.kelas}</b> masih memiliki <b>${jumlahSiswa} siswa aktif</b>. Silakan mutasikan atau pindahkan siswa terlebih dahulu via menu <b>Promosi & Kenaikan Kelas</b> sebelum menghapus rombel ini.`,
				icon: 'warning',
				confirmButtonColor: '#0D0D0D',
			});
			return;
		}

		const confirm = await Swal.fire({
			title: 'Hapus Rombel Kelas?',
			html: `Anda yakin ingin menghapus rombel <b>${item.kelas}</b> dari data kurikulum?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus Rombel',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		try {
			const res = await fetch(`/api/kelas?id=${item.id}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menghapus rombel kelas.');

			Swal.fire('Terhapus!', `Rombel ${item.kelas} berhasil dihapus.`, 'success');
			loadData();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		}
	};

	// Export ke Excel
	const handleExportExcel = () => {
		if (filteredKelas.length === 0) {
			Swal.fire('Info', 'Tidak ada data rombel kelas untuk diekspor.', 'info');
			return;
		}

		const exportRows = filteredKelas.map((k, idx) => {
			const stat = siswaStatsMap[k.kelas] || { total: 0, laki: 0, perempuan: 0 };
			return {
				No: idx + 1,
				'Nama Rombel / Kelas': k.kelas,
				'Guru Wali Kelas': k.wali_kelas || 'Belum Ditentukan',
				'Laki-laki': stat.laki,
				Perempuan: stat.perempuan,
				'Total Siswa Aktif': stat.total,
			};
		});

		const ws = XLSX.utils.json_to_sheet(exportRows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rombel Kelas');
		XLSX.writeFile(wb, `Data_Rombel_Kelas_Kurikulum_${new Date().toISOString().slice(0, 10)}.xlsx`);
	};

	// Cetak PDF Rekap Rombel
	const handlePrintPDF = () => {
		try {
			const doc = new jsPDF('portrait');
			drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			doc.text('DAFTAR ROMBONGAN BELAJAR & WALI KELAS', 105, 48, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'} | Semester: ${semesterAktif || '-'} | Total: ${filteredKelas.length} Rombel`,
				105,
				54,
				{ align: 'center' }
			);

			const tableBody = filteredKelas.map((k, idx) => {
				const stat = siswaStatsMap[k.kelas] || { total: 0, laki: 0, perempuan: 0 };
				return [
					idx + 1,
					k.kelas,
					k.wali_kelas || 'Belum Ditentukan',
					stat.laki,
					stat.perempuan,
					stat.total,
				];
			});

			autoTable(doc, {
				startY: 60,
				head: [['No', 'Nama Rombel', 'Guru Wali Kelas', 'L', 'P', 'Total Siswa']],
				body: tableBody,
				theme: 'grid',
				headStyles: {
					fillColor: [250, 204, 21],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 9,
					halign: 'center',
				},
				styles: {
					fontSize: 8.5,
					cellPadding: 3,
					textColor: [20, 20, 20],
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 12 },
					1: { halign: 'left', fontStyle: 'bold', cellWidth: 35 },
					2: { halign: 'left' },
					3: { halign: 'center', cellWidth: 15 },
					4: { halign: 'center', cellWidth: 15 },
					5: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
				},
			});

			doc.save(`Rekap_Rombel_Kelas_Kurikulum_${new Date().toISOString().slice(0, 10)}.pdf`);
		} catch (err) {
			console.error('Error generating PDF:', err);
			Swal.fire('Gagal Cetak PDF', err.message, 'error');
		}
	};

	if (loading) return <Loader text='Memuat Data Rombel Kelas...' />;

	return (
		<div className='space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-amber-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🏫</span> Manajemen Rombel & Kelas
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Data Kelas
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Pengaturan rombongan belajar, penugasan guru wali kelas, dan pemantauan rasio siswa aktif di setiap tingkat.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-3 w-full md:w-auto'>
					<AcademicPeriodChip />
					<button
						onClick={openCreateModal}
						className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 whitespace-nowrap shrink-0'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
						</svg>
						<span>Tambah Rombel Baru</span>
					</button>
				</div>
			</div>

			{/* Stat Cards */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<div className='bg-sky-100 border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-sky-900'>Total Rombel</p>
						<p className='text-3xl font-black text-black mt-1'>{totalKelas}</p>
						<p className='text-[10px] font-bold text-sky-800 mt-1'>Rombongan Belajar Terdaftar</p>
					</div>
					<div className='w-12 h-12 bg-sky-300 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏫
					</div>
				</div>

				<div className='bg-emerald-100 border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-900'>Memiliki Wali Kelas</p>
						<p className='text-3xl font-black text-black mt-1'>{kelasWithWali}</p>
						<p className='text-[10px] font-bold text-emerald-800 mt-1'>
							{totalKelas > 0 ? `${Math.round((kelasWithWali / totalKelas) * 100)}% Terploting Wali` : '0%'}
						</p>
					</div>
					<div className='w-12 h-12 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</div>
				</div>

				<div className='bg-amber-100 border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-amber-900'>Total Siswa Aktif</p>
						<p className='text-3xl font-black text-black mt-1'>{totalSiswaAktif}</p>
						<p className='text-[10px] font-bold text-amber-800 mt-1'>Terbagi di seluruh rombel</p>
					</div>
					<div className='w-12 h-12 bg-amber-300 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🎓
					</div>
				</div>
			</div>

			{/* Filter & Action Toolbar */}
			<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3'>
				<div className='flex flex-wrap items-center gap-3 flex-1'>
					{/* Search */}
					<div className='relative flex-1 min-w-[200px]'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari nama rombel atau wali kelas...'
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

					{/* Filter Wali */}
					<div className='flex items-center gap-1.5'>
						<select
							value={filterWali}
							onChange={(e) => setFilterWali(e.target.value)}
							className='py-2 px-3 border-2 border-black rounded-lg text-xs font-bold bg-white focus:outline-none shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<option value='all'>Semua Status Wali</option>
							<option value='has_wali'>Sudah Ada Wali</option>
							<option value='no_wali'>Belum Ada Wali</option>
						</select>
					</div>
				</div>

				{/* Export buttons */}
				<div className='flex items-center gap-2 shrink-0'>
					<button
						onClick={handleExportExcel}
						className='px-3 py-2 bg-emerald-300 border-2 border-black rounded-lg text-xs font-black hover:bg-emerald-400 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
						<span>📊</span> Ekspor Excel
					</button>
					<button
						onClick={handlePrintPDF}
						className='px-3 py-2 bg-rose-200 border-2 border-black rounded-lg text-xs font-black hover:bg-rose-300 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
						<span>🖨️</span> Cetak PDF
					</button>
				</div>
			</div>

			{/* Table Kelas */}
			<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='border-b-2 border-black bg-yellow-200 text-black text-xs font-black uppercase tracking-wider'>
								<th className='py-3.5 px-4 text-center w-12'>No</th>
								<th className='py-3.5 px-4'>Nama Rombel / Tingkat</th>
								<th className='py-3.5 px-4'>Guru Wali Kelas</th>
								<th className='py-3.5 px-4 text-center'>Distribusi Siswa (L / P)</th>
								<th className='py-3.5 px-4 text-center'>Total Siswa Aktif</th>
								<th className='py-3.5 px-4 text-right'>Aksi Manajemen</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{filteredKelas.length === 0 ? (
								<tr>
									<td colSpan={6} className='text-center py-12 text-gray-500'>
										<span className='text-3xl block mb-2'>🏫</span>
										<p className='font-black text-sm text-black'>Tidak ada rombel kelas yang ditemukan</p>
										<p className='text-xs text-gray-500 mt-1'>Coba sesuaikan kata kunci pencarian atau tambah kelas baru.</p>
									</td>
								</tr>
							) : (
								filteredKelas.map((item, idx) => {
									const stats = siswaStatsMap[item.kelas] || { total: 0, laki: 0, perempuan: 0 };
									const hasWali = Boolean(item.id_wali_kelas);

									return (
										<tr key={item.id} className='hover:bg-yellow-50/70 transition-colors'>
											<td className='py-3.5 px-4 text-center font-mono text-gray-600 font-bold'>
												{idx + 1}
											</td>
											<td className='py-3.5 px-4'>
												<div className='flex items-center gap-2'>
													<span className='px-2.5 py-1 bg-black text-yellow-300 font-black rounded-lg text-xs tracking-wide shadow-[1px_1px_0px_0px_#000]'>
														{item.kelas}
													</span>
													<Link
														href={`/kurikulum/siswa?kelas=${encodeURIComponent(item.kelas)}`}
														className='text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1'>
														<span>Lihat Murid</span>
														<span>→</span>
													</Link>
												</div>
											</td>
											<td className='py-3.5 px-4'>
												{hasWali ? (
													<div className='flex items-center gap-2'>
														<span className='w-6 h-6 rounded-full bg-emerald-200 border border-black flex items-center justify-center text-[10px] font-black'>
															✓
														</span>
														<span className='font-black text-black'>{item.wali_kelas}</span>
													</div>
												) : (
													<span className='inline-block px-2.5 py-1 bg-rose-100 border border-rose-400 text-rose-800 rounded-lg text-[11px] font-black'>
														⚠️ Belum Ditentukan
													</span>
												)}
											</td>
											<td className='py-3.5 px-4 text-center'>
												<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-300 rounded-lg text-xs font-black'>
													<span className='text-blue-700 font-bold'>♂ {stats.laki}</span>
													<span className='text-gray-400'>|</span>
													<span className='text-pink-600 font-bold'>♀ {stats.perempuan}</span>
												</span>
											</td>
											<td className='py-3.5 px-4 text-center'>
												<span
													className={`px-3 py-1 rounded-full text-xs font-black border ${
														stats.total > 0
															? 'bg-emerald-100 border-emerald-400 text-emerald-950'
															: 'bg-gray-100 border-gray-300 text-gray-500'
													}`}>
													{stats.total} Siswa
												</span>
											</td>
											<td className='py-3.5 px-4 text-right'>
												<div className='flex items-center justify-end gap-1.5'>
													<button
														onClick={() => openEditModal(item)}
														className='p-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] flex items-center gap-1'
														title='Edit Rombel'>
														<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
															<path strokeLinecap='round' strokeLinejoin='round' d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' />
														</svg>
														<span>Edit</span>
													</button>
													<button
														onClick={() => handleDelete(item)}
														className='p-1.5 bg-rose-200 hover:bg-rose-300 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] text-rose-900 flex items-center gap-1'
														title='Hapus Rombel'>
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

			{/* Modal Add / Edit Rombel */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-[8px_8px_0px_0px_#0D0D0D] space-y-5 animate-scale-up'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black text-black flex items-center gap-2'>
								<span>{isEditMode ? '✏️' : '🏫'}</span>
								{isEditMode ? 'Edit Data Rombel Kelas' : 'Tambah Rombel Kelas Baru'}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='p-1.5 hover:bg-gray-100 border-2 border-black rounded-lg transition-colors font-black text-xs'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Nama Rombel / Kelas <span className='text-red-500'>*</span>
								</label>
								<input
									type='text'
									value={formData.kelas}
									onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
									placeholder='Contoh: VII.A, VIII.B, IX.C'
									required
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
								<p className='text-[10px] font-medium text-gray-500 mt-1'>
									Gunakan format konsisten agar sinkron dengan penugasan dan jadwal KBM.
								</p>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Guru Wali Kelas
								</label>
								<select
									value={formData.id_wali_kelas}
									onChange={(e) => setFormData({ ...formData, id_wali_kelas: e.target.value })}
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<option value=''>-- Pilih Wali Kelas (Opsional) --</option>
									{guruList.map((g) => (
										<option key={g.id_user || g.id} value={g.id_user || g.id}>
											{g.nama_lengkap} ({g.username})
										</option>
									))}
								</select>
								<p className='text-[10px] font-medium text-gray-500 mt-1'>
									Wali kelas memiliki hak mengesahkan presensi harian dan rekap leger rombel ini.
								</p>
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
									{submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Rombel'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
