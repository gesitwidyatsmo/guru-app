'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';
import { useAcademic } from '@/context/AcademicContext';

export default function KurikulumPenugasanPage() {
	const { role } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [penugasanList, setPenugasanList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelas, setFilterKelas] = useState('all');

	// Modal Tambah Manual
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({
		id_user: '',
		kelas: '',
		mapel: '',
	});
	const [isSaving, setIsSaving] = useState(false);

	// Modal Bulk Import Excel
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [importFile, setImportFile] = useState(null);
	const [importPreviewRows, setImportPreviewRows] = useState([]);
	const [isImporting, setIsImporting] = useState(false);
	const fileInputRef = useRef(null);

	const fetchAllData = async () => {
		try {
			setLoading(true);
			const supabase = createClient();

			// 1. Ambil data Penugasan KBM
			const { data: kbmData, error: kbmError } = await supabase.from('guru_kbm').select(`
				id_kbm, id_user, kelas, mapel, tahun_ajar, semester, users!guru_kbm_id_user_fkey(username, nama_lengkap)
			`);
			if (kbmError) throw kbmError;

			const formattedKBM = (kbmData || [])
				.map((r) => ({
					id_kbm: r.id_kbm,
					id_user: r.id_user,
					username: r.users?.username || 'Akun Terhapus',
					nama_guru: r.users?.nama_lengkap || 'Akun Terhapus',
					kelas: r.kelas,
					mapel: r.mapel,
					tahun_ajar: r.tahun_ajar,
					semester: r.semester,
				}))
				.sort((a, b) => a.nama_guru.localeCompare(b.nama_guru));

			setPenugasanList(formattedKBM);

			// 2. Ambil Master Guru, Kelas, Mapel
			const [resGuru, resKelas, resMapel] = await Promise.all([
				supabase.from('users').select('id_user, nama_lengkap, username, nip').eq('role', 'Guru').order('nama_lengkap', { ascending: true }),
				supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
				supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
			]);

			setGuruList(resGuru.data || []);
			setKelasList(resKelas.data || []);
			setMapelList(resMapel.data || []);
		} catch (error) {
			console.error('Fetch Error:', error);
			Swal.fire('Terjadi Kesalahan', error.message || 'Gagal memuat data penugasan KBM.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllData();
	}, []);

	// Handle Submit Penugasan Manual
	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.id_user || !formData.kelas || !formData.mapel) {
			Swal.fire('Form Belum Lengkap', 'Pilih Guru, Kelas, dan Mata Pelajaran!', 'warning');
			return;
		}

		// Validasi Duplikasi
		const isDuplicate = penugasanList.some(
			(p) => p.id_user === formData.id_user && p.kelas === formData.kelas && p.mapel === formData.mapel
		);
		if (isDuplicate) {
			Swal.fire('Peringatan Penugasan', 'Guru ini sudah ditugaskan mengajar mapel tersebut di kelas yang sama!', 'warning');
			return;
		}

		try {
			setIsSaving(true);
			const res = await fetch('/api/kbm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					tahun_ajar: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penugasan.');

			Swal.fire({
				title: 'Berhasil!',
				text: 'Penugasan mengajar KBM berhasil ditambahkan.',
				icon: 'success',
				confirmButtonColor: '#F59E0B',
			});

			setIsModalOpen(false);
			setFormData({ id_user: '', kelas: '', mapel: '' });
			fetchAllData();
		} catch (err) {
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setIsSaving(false);
		}
	};

	// Handle Hapus Penugasan
	const handleDelete = async (id_kbm, nama_guru, mapel, kelas) => {
		const result = await Swal.fire({
			title: 'Cabut Penugasan?',
			html: `Apakah Anda yakin ingin menghapus penugasan <b>${nama_guru}</b> untuk mapel <b>${mapel}</b> di kelas <b>${kelas}</b>?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Cabut Penugasan',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch(`/api/kbm?id_kbm=${id_kbm}`, { method: 'DELETE' });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal menghapus penugasan.');

				Swal.fire('Dicabut!', 'Penugasan mengajar berhasil dicabut.', 'success');
				fetchAllData();
			} catch (err) {
				Swal.fire('Gagal Mencabut', err.message, 'error');
			}
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR EXPORT PENUGASAN KE EXCEL
	// ---------------------------------------------------------------------------
	const handleExportExcel = () => {
		try {
			if (filteredList.length === 0) {
				Swal.fire('Data Kosong', 'Tidak ada data penugasan KBM yang cocok untuk diekspor.', 'info');
				return;
			}

			const exportRows = filteredList.map((item, idx) => ({
				No: idx + 1,
				'Nama Guru': item.nama_guru,
				'Username Guru': item.username,
				'Kelas': item.kelas,
				'Mata Pelajaran': item.mapel,
				'Tahun Ajaran': item.tahun_ajar || tahunAjarAktif || '2026/2027',
				'Semester': item.semester || semesterAktif || 1,
			}));

			const ws = XLSX.utils.json_to_sheet(exportRows);
			ws['!cols'] = [
				{ wch: 6 },
				{ wch: 32 },
				{ wch: 20 },
				{ wch: 14 },
				{ wch: 28 },
				{ wch: 16 },
				{ wch: 10 },
			];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, 'Penugasan_KBM');

			const fileName = `Penugasan_KBM_Kurikulum_${(tahunAjarAktif || '2026-2027').replace('/', '-')}.xlsx`;
			XLSX.writeFile(wb, fileName);

			Swal.fire('Berhasil!', `Data penugasan (${filteredList.length} baris) berhasil diekspor.`, 'success');
		} catch (err) {
			console.error('Export Excel error:', err);
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR UNDUH TEMPLATE EXCEL RESMI DENGAN REFERENSI LIVE
	// ---------------------------------------------------------------------------
	const handleDownloadTemplate = () => {
		try {
			// Sheet 1: Contoh Template Penugasan
			const sampleData = [
				{
					No: 1,
					'Username Guru': guruList[0]?.username || 'budi_santoso',
					'Nama Guru (Opsional)': guruList[0]?.nama_lengkap || 'Drs. Budi Santoso, M.Pd',
					'Kelas': kelasList[0]?.nama_kelas || '7A',
					'Mata Pelajaran': mapelList[0]?.mapel || 'Matematika',
				},
				{
					No: 2,
					'Username Guru': guruList[0]?.username || 'budi_santoso',
					'Nama Guru (Opsional)': guruList[0]?.nama_lengkap || 'Drs. Budi Santoso, M.Pd',
					'Kelas': kelasList[1]?.nama_kelas || '7B',
					'Mata Pelajaran': mapelList[0]?.mapel || 'Matematika',
				},
				{
					No: 3,
					'Username Guru': guruList[1]?.username || 'siti_aminah',
					'Nama Guru (Opsional)': guruList[1]?.nama_lengkap || 'Siti Aminah, S.Pd',
					'Kelas': kelasList[0]?.nama_kelas || '7A',
					'Mata Pelajaran': mapelList[1]?.mapel || 'Bahasa Indonesia',
				},
				{
					No: 4,
					'Username Guru': guruList[2]?.username || 'ahmad_ridwan',
					'Nama Guru (Opsional)': guruList[2]?.nama_lengkap || 'Ahmad Ridwan, S.Kom',
					'Kelas': kelasList[2]?.nama_kelas || '8A',
					'Mata Pelajaran': mapelList[2]?.mapel || 'Informatika',
				},
			];

			const wsTemplate = XLSX.utils.json_to_sheet(sampleData);
			wsTemplate['!cols'] = [
				{ wch: 6 },
				{ wch: 22 },
				{ wch: 32 },
				{ wch: 14 },
				{ wch: 28 },
			];

			// Sheet 2: Referensi Guru Aktif
			const refGuru = guruList.map((g, idx) => ({
				No: idx + 1,
				'Username': g.username,
				'Nama Lengkap Guru': g.nama_lengkap,
				'NIP': g.nip || '-',
			}));
			const wsGuru = XLSX.utils.json_to_sheet(refGuru);
			wsGuru['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 34 }, { wch: 20 }];

			// Sheet 3: Referensi Kelas Aktif
			const refKelas = kelasList.map((k, idx) => ({
				No: idx + 1,
				'Nama Kelas': k.nama_kelas,
			}));
			const wsKelas = XLSX.utils.json_to_sheet(refKelas);
			wsKelas['!cols'] = [{ wch: 6 }, { wch: 20 }];

			// Sheet 4: Referensi Mapel Kurikulum
			const refMapel = mapelList.map((m, idx) => ({
				No: idx + 1,
				'Nama Mata Pelajaran': m.mapel,
			}));
			const wsMapel = XLSX.utils.json_to_sheet(refMapel);
			wsMapel['!cols'] = [{ wch: 6 }, { wch: 30 }];

			// Sheet 5: Petunjuk Pengisian
			const petunjuk = [
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '1. Isi data penugasan pada sheet "Template_Penugasan".' },
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '2. Kolom "Username Guru" wajib diisi persis sesuai daftar di sheet "Daftar_Guru".' },
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '3. Kolom "Kelas" wajib diisi persis sesuai nama kelas di sheet "Daftar_Kelas" (contoh: 7A, 8B).' },
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '4. Kolom "Mata Pelajaran" wajib diisi persis sesuai daftar mapel di sheet "Daftar_Mapel".' },
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '5. Kolom "Nama Guru" bersifat opsional untuk mempermudah pengecekan Anda.' },
				{ 'PETUNJUK PENGISIAN TEMPLATE PENUGASAN GURU KBM': '6. Sistem akan otomatis memvalidasi apakah ada penugasan ganda/duplikat sebelum disimpan.' },
			];
			const wsPetunjuk = XLSX.utils.json_to_sheet(petunjuk);
			wsPetunjuk['!cols'] = [{ wch: 95 }];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template_Penugasan');
			XLSX.utils.book_append_sheet(wb, wsGuru, 'Daftar_Guru');
			XLSX.utils.book_append_sheet(wb, wsKelas, 'Daftar_Kelas');
			XLSX.utils.book_append_sheet(wb, wsMapel, 'Daftar_Mapel');
			XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk_Pengisian');

			XLSX.writeFile(wb, 'Template_Import_Penugasan_KBM.xlsx');
			Swal.fire('Template Diunduh!', 'Buka file Excel untuk mengisi penugasan sesuai referensi resmi sekolah.', 'success');
		} catch (err) {
			console.error('Download template error:', err);
			Swal.fire('Gagal Mengunduh Template', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR BACA & PREVIEW FILE IMPORT EXCEL
	// ---------------------------------------------------------------------------
	const handleFileChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setImportFile(file);

		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const buffer = evt.target.result;
				const wb = XLSX.read(buffer, { type: 'array' });
				const wsName = wb.SheetNames[0]; // Ambil sheet pertama (Template_Penugasan)
				const ws = wb.Sheets[wsName];
				const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

				// Map username & nama ke user object untuk pencocokan instan
				const usernameMap = new Map();
				const namaMap = new Map();
				guruList.forEach((g) => {
					usernameMap.set(g.username.toLowerCase().trim(), g);
					namaMap.set(g.nama_lengkap.toLowerCase().trim(), g);
				});

				const validKelasSet = new Set(kelasList.map((k) => k.nama_kelas.toLowerCase().trim()));
				const validMapelSet = new Set(mapelList.map((m) => m.mapel.toLowerCase().trim()));

				// Existing assignments set untuk deteksi duplikasi
				const existingSet = new Set(
					penugasanList.map((p) => `${p.id_user}___${p.kelas.toLowerCase().trim()}___${p.mapel.toLowerCase().trim()}`)
				);

				const parsedRows = [];
				const seenInFile = new Set();

				rawRows.forEach((r, idx) => {
					const usernameInput = String(r['Username Guru'] || r['Username'] || r['username'] || '').trim();
					const namaInput = String(r['Nama Guru (Opsional)'] || r['Nama Guru'] || r['Nama'] || r['nama'] || '').trim();
					const kelasInput = String(r['Kelas'] || r['kelas'] || r['Rombel'] || '').trim();
					const mapelInput = String(r['Mata Pelajaran'] || r['Mapel'] || r['mapel'] || '').trim();

					// Lewati jika seluruh kolom esensial kosong
					if (!usernameInput && !kelasInput && !mapelInput) return;

					// 1. Validasi Guru
					let matchedGuru = usernameMap.get(usernameInput.toLowerCase());
					if (!matchedGuru && namaInput) {
						matchedGuru = namaMap.get(namaInput.toLowerCase());
					}

					// 2. Validasi Kelas
					const matchedKelas = kelasList.find((k) => k.nama_kelas.toLowerCase().trim() === kelasInput.toLowerCase());

					// 3. Validasi Mapel
					const matchedMapel = mapelList.find((m) => m.mapel.toLowerCase().trim() === mapelInput.toLowerCase());

					// 4. Deteksi Duplikasi
					let status = 'VALID';
					let message = 'Siap Diimpor';

					if (!matchedGuru) {
						status = 'ERROR';
						message = `Guru "${usernameInput || namaInput}" tidak ditemukan di database`;
					} else if (!matchedKelas) {
						status = 'ERROR';
						message = `Kelas "${kelasInput}" tidak ditemukan di database`;
					} else if (!matchedMapel) {
						status = 'ERROR';
						message = `Mapel "${mapelInput}" tidak ditemukan di database`;
					} else {
						const key = `${matchedGuru.id_user}___${matchedKelas.nama_kelas.toLowerCase().trim()}___${matchedMapel.mapel.toLowerCase().trim()}`;
						if (existingSet.has(key)) {
							status = 'DUPLICATE';
							message = 'Sudah ditugaskan sebelumnya (Duplikat DB)';
						} else if (seenInFile.has(key)) {
							status = 'DUPLICATE';
							message = 'Baris berulang dalam file Excel ini';
						} else {
							seenInFile.add(key);
						}
					}

					parsedRows.push({
						rowNumber: idx + 2,
						rawUsername: usernameInput,
						rawNama: namaInput,
						rawKelas: kelasInput,
						rawMapel: mapelInput,
						guru: matchedGuru,
						kelas: matchedKelas ? matchedKelas.nama_kelas : kelasInput,
						mapel: matchedMapel ? matchedMapel.mapel : mapelInput,
						status,
						message,
					});
				});

				setImportPreviewRows(parsedRows);
			} catch (err) {
				console.error('Error parsing excel:', err);
				Swal.fire('Format File Salah', 'Gagal membaca format file Excel. Pastikan gunakan template resmi.', 'error');
			}
		};
		reader.readAsArrayBuffer(file);
	};

	// ---------------------------------------------------------------------------
	// FITUR EKSEKUSI BULK IMPORT
	// ---------------------------------------------------------------------------
	const handleExecuteBulkImport = async () => {
		const validRows = importPreviewRows.filter((r) => r.status === 'VALID');
		if (validRows.length === 0) {
			Swal.fire('Tidak Ada Data Valid', 'Tidak ada baris penugasan yang siap diimpor.', 'warning');
			return;
		}

		const confirm = await Swal.fire({
			title: 'Impor Penugasan Sekaligus?',
			html: `Anda akan menambahkan <b>${validRows.length} penugasan guru KBM</b> ke dalam sistem.`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			confirmButtonText: `Ya, Impor ${validRows.length} Data`,
			cancelButtonText: 'Batal',
		});

		if (confirm.isConfirmed) {
			try {
				setIsImporting(true);

				const payload = validRows.map((r) => ({
					id_user: r.guru.id_user,
					kelas: r.kelas,
					mapel: r.mapel,
					tahun_ajar: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				}));

				const res = await fetch('/api/kbm', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				const resData = await res.json();
				if (!res.ok) throw new Error(resData.error || 'Gagal melakukan bulk import penugasan.');

				Swal.fire({
					title: 'Import Sukses!',
					html: `Sebanyak <b>${validRows.length} penugasan KBM</b> berhasil diformalkan ke database sekolah.`,
					icon: 'success',
					confirmButtonColor: '#F59E0B',
				});

				// Reset Import Modal State
				setIsImportModalOpen(false);
				setImportFile(null);
				setImportPreviewRows([]);
				if (fileInputRef.current) fileInputRef.current.value = '';

				fetchAllData();
			} catch (err) {
				console.error('Import error:', err);
				Swal.fire('Gagal Impor', err.message, 'error');
			} finally {
				setIsImporting(false);
			}
		}
	};

	// Filter data
	const filteredList = useMemo(() => {
		return penugasanList.filter((item) => {
			const matchKelas = filterKelas === 'all' || item.kelas === filterKelas;
			const q = searchQuery.toLowerCase();
			const matchSearch =
				item.nama_guru.toLowerCase().includes(q) ||
				item.username.toLowerCase().includes(q) ||
				item.mapel.toLowerCase().includes(q) ||
				item.kelas.toLowerCase().includes(q);
			return matchKelas && matchSearch;
		});
	}, [penugasanList, filterKelas, searchQuery]);

	// Statistik Guru
	const teacherStats = useMemo(() => {
		const map = {};
		penugasanList.forEach((p) => {
			if (!map[p.id_user]) map[p.id_user] = 0;
			map[p.id_user] += 1;
		});
		const uniqueTeachers = Object.keys(map).length;
		return { uniqueTeachers, totalAssignments: penugasanList.length };
	}, [penugasanList]);

	// Rekap Preview Import Counts
	const previewCounts = useMemo(() => {
		const valid = importPreviewRows.filter((r) => r.status === 'VALID').length;
		const duplicate = importPreviewRows.filter((r) => r.status === 'DUPLICATE').length;
		const error = importPreviewRows.filter((r) => r.status === 'ERROR').length;
		return { valid, duplicate, error, total: importPreviewRows.length };
	}, [importPreviewRows]);

	if (loading) return <Loader text='Memuat Data Penugasan KBM...' />;

	return (
		<div className='space-y-6'>
			{/* HEADER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col lg:flex-row lg:items-center justify-between gap-5'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded tracking-wider'>
							Pengorganisasian KBM
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2.5'>
						<span>📋</span> Penugasan Guru KBM
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl leading-relaxed'>
						Plotting resmi pembagian rombel kelas dan mata pelajaran yang diampu oleh dewan guru untuk kalender akademik berjalan.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-2.5 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={() => {
							setIsImportModalOpen(true);
							setImportFile(null);
							setImportPreviewRows([]);
						}}
						className='px-3.5 sm:px-4 py-2.5 bg-white hover:bg-neutral-100 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📥</span> Import Excel
					</button>
					<button
						onClick={() => setIsModalOpen(true)}
						className='px-4 sm:px-5 py-2.5 bg-black text-white hover:bg-neutral-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>➕</span> Tambah Penugasan
					</button>
				</div>
			</div>

			{/* STAT CARDS */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Total Plotting KBM</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{teacherStats.totalAssignments}</p>
					<p className='text-[10px] font-bold text-emerald-700 mt-1'>Rombel-Mapel Terdistribusi</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Guru Bertugas</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{teacherStats.uniqueTeachers}</p>
					<p className='text-[10px] font-bold text-sky-700 mt-1'>Dari {guruList.length} Total Guru</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Total Rombel Kelas</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kelasList.length}</p>
					<p className='text-[10px] font-bold text-amber-700 mt-1'>Kelas Aktif Belajar</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Katalog Mapel</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{mapelList.length}</p>
					<p className='text-[10px] font-bold text-purple-700 mt-1'>Mapel Kurikulum</p>
				</div>
			</div>

			{/* SEARCH, FILTER & ACTION BAR */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3'>
				<div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1'>
					{/* Search */}
					<div className='relative flex-1 max-w-md'>
						<span className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 text-sm'>
							🔍
						</span>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari nama guru, mapel, atau kelas...'
							className='w-full pl-9 pr-8 py-2.5 border-2 border-black rounded-xl text-xs sm:text-sm font-bold bg-[#FFFDF0] focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-400'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className='absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 hover:text-black'>
								✕
							</button>
						)}
					</div>

					{/* Filter Kelas */}
					<div className='flex items-center gap-2'>
						<label className='text-xs font-black uppercase shrink-0 text-gray-700'>
							Rombel:
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='px-3.5 py-2.5 border-2 border-black rounded-xl text-xs font-bold bg-[#FEF08A] focus:outline-none cursor-pointer'>
							<option value='all'>Semua Kelas ({penugasanList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Action: Export Excel */}
				<div className='flex items-center gap-2 justify-end shrink-0'>
					<button
						onClick={handleExportExcel}
						className='px-4 py-2.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📊</span> Ekspor Excel ({filteredList.length})
					</button>
				</div>
			</div>

			{/* TABLE PENUGASAN */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
						<span>📋</span> Daftar Distribusi Mengajar ({filteredList.length})
					</h2>
					<span className='text-xs font-bold text-gray-500'>
						Menampilkan penugasan aktif semester berjalan
					</span>
				</div>

				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
								<th className='py-3 px-3'>No</th>
								<th className='py-3 px-3'>Guru Pengampu</th>
								<th className='py-3 px-3'>Kelas / Rombel</th>
								<th className='py-3 px-3'>Mata Pelajaran</th>
								<th className='py-3 px-3 text-right'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{filteredList.length === 0 ? (
								<tr>
									<td colSpan={5} className='text-center py-8 text-gray-500'>
										Tidak ada penugasan KBM yang cocok dengan pencarian / filter.
									</td>
								</tr>
							) : (
								filteredList.map((item, idx) => (
									<tr key={item.id_kbm} className='hover:bg-amber-50/60 transition-colors'>
										<td className='py-3 px-3 font-mono font-bold'>{idx + 1}</td>
										<td className='py-3 px-3'>
											<div>
												<span className='font-black text-black block text-sm'>{item.nama_guru}</span>
												<span className='text-[10px] font-mono text-gray-500'>@{item.username}</span>
											</div>
										</td>
										<td className='py-3 px-3'>
											<span className='px-2.5 py-1 bg-sky-100 border border-black rounded-lg text-xs font-black text-sky-950 inline-block shadow-[1px_1px_0px_0px_#0D0D0D]'>
												🏫 {item.kelas}
											</span>
										</td>
										<td className='py-3 px-3'>
											<span className='px-2.5 py-1 bg-amber-100 border border-black rounded-lg text-xs font-black text-amber-950 inline-block shadow-[1px_1px_0px_0px_#0D0D0D]'>
												📚 {item.mapel}
											</span>
										</td>
										<td className='py-3 px-3 text-right'>
											<button
												onClick={() => handleDelete(item.id_kbm, item.nama_guru, item.mapel, item.kelas)}
												className='px-3 py-1.5 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[2px_2px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
												Cabut
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* MODAL BULK IMPORT EXCEL PENUGASAN */}
			{isImportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-3xl shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3 shrink-0'>
							<div>
								<h3 className='text-lg font-black flex items-center gap-2'>
									<span>📥</span> Import Banyak Penugasan KBM Sekaligus
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Unggah berkas Excel (.xlsx / .xls) untuk memetakan penugasan guru secara massal.
								</p>
							</div>
							<button
								onClick={() => setIsImportModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black'>
								✕
							</button>
						</div>

						<div className='flex-1 overflow-y-auto space-y-4 pr-1'>
							{/* Step 1: Download Template Banner */}
							<div className='bg-emerald-50 border-2 border-black rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
								<div className='flex items-center gap-3'>
									<div className='w-9 h-9 bg-emerald-400 border-2 border-black rounded-lg flex items-center justify-center font-black text-sm shrink-0'>
										📄
									</div>
									<div>
										<p className='text-xs font-black text-emerald-950 uppercase'>Gunakan Template Resmi Sekolah</p>
										<p className='text-[11px] font-bold text-emerald-800 mt-0.5'>
											Template sudah dilengkapi daftar lengkap Username Guru, Rombel Kelas, dan Mapel aktif.
										</p>
									</div>
								</div>
								<button
									onClick={handleDownloadTemplate}
									type='button'
									className='px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-950 border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 flex items-center justify-center gap-1.5'>
									<span>⬇️</span> Unduh Template (.xlsx)
								</button>
							</div>

							{/* Step 2: Upload File Area */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black uppercase text-black'>
									Pilih File Excel Penugasan (.xlsx / .xls)
								</label>
								<div className='border-2 border-dashed border-black rounded-xl p-4 bg-[#FFFDF0] flex flex-col items-center justify-center text-center gap-2'>
									<input
										ref={fileInputRef}
										type='file'
										accept='.xlsx, .xls'
										onChange={handleFileChange}
										className='text-xs font-bold file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:bg-yellow-300 file:shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
									/>
									<span className='text-[10px] text-gray-500 font-bold'>
										Format didukung: Microsoft Excel Worksheet (.xlsx, .xls)
									</span>
								</div>
							</div>

							{/* Step 3: Preview Data Table */}
							{importPreviewRows.length > 0 && (
								<div className='space-y-3 pt-2'>
									<div className='flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2'>
										<h4 className='text-xs font-black uppercase text-black flex items-center gap-2'>
											<span>🔍</span> Hasil Analisis Berkas ({previewCounts.total} Baris)
										</h4>
										<div className='flex items-center gap-1.5 text-[10px] font-black'>
											<span className='px-2 py-0.5 bg-emerald-200 border border-emerald-500 rounded text-emerald-950'>
												✓ {previewCounts.valid} Valid
											</span>
											{previewCounts.duplicate > 0 && (
												<span className='px-2 py-0.5 bg-amber-200 border border-amber-500 rounded text-amber-950'>
													⚠️ {previewCounts.duplicate} Duplikat
												</span>
											)}
											{previewCounts.error > 0 && (
												<span className='px-2 py-0.5 bg-rose-200 border border-rose-500 rounded text-rose-950'>
													✕ {previewCounts.error} Error
												</span>
											)}
										</div>
									</div>

									<div className='border-2 border-black rounded-xl overflow-hidden max-h-56 overflow-y-auto'>
										<table className='w-full text-left border-collapse text-xs'>
											<thead className='sticky top-0 bg-yellow-100 border-b-2 border-black text-[10px] font-black uppercase'>
												<tr>
													<th className='py-2 px-2.5'>Baris</th>
													<th className='py-2 px-2.5'>Guru (Username/Nama)</th>
													<th className='py-2 px-2.5'>Kelas</th>
													<th className='py-2 px-2.5'>Mata Pelajaran</th>
													<th className='py-2 px-2.5 text-right'>Status Validasi</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-gray-200 font-bold'>
												{importPreviewRows.map((r, idx) => (
													<tr
														key={idx}
														className={
															r.status === 'VALID'
																? 'bg-emerald-50/60'
																: r.status === 'DUPLICATE'
																? 'bg-amber-50/60'
																: 'bg-rose-50/60'
														}>
														<td className='py-2 px-2.5 font-mono text-[10px]'>{r.rowNumber}</td>
														<td className='py-2 px-2.5'>
															<span className='font-black block'>
																{r.guru?.nama_lengkap || r.rawNama || '-'}
															</span>
															<span className='text-[10px] font-mono text-gray-500'>
																@{r.guru?.username || r.rawUsername}
															</span>
														</td>
														<td className='py-2 px-2.5'>{r.kelas}</td>
														<td className='py-2 px-2.5'>{r.mapel}</td>
														<td className='py-2 px-2.5 text-right'>
															<span
																className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase ${
																	r.status === 'VALID'
																		? 'bg-emerald-200 text-emerald-950 border-emerald-500'
																		: r.status === 'DUPLICATE'
																		? 'bg-amber-200 text-amber-950 border-amber-500'
																		: 'bg-rose-200 text-rose-950 border-rose-500'
																}`}>
																{r.message}
															</span>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>

						{/* Footer Actions */}
						<div className='pt-3 border-t-2 border-black flex items-center justify-between shrink-0'>
							<span className='text-[11px] font-bold text-gray-500'>
								{previewCounts.valid > 0 ? (
									<span className='text-emerald-800 font-black'>
										✓ {previewCounts.valid} penugasan siap disimpan ke database.
									</span>
								) : (
									'Pilih file Excel untuk memulai pratinjau'
								)}
							</span>

							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={() => setIsImportModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100'>
									Batal
								</button>
								<button
									type='button'
									onClick={handleExecuteBulkImport}
									disabled={isImporting || previewCounts.valid === 0}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
									{isImporting ? 'Mengimpor...' : `Impor ${previewCounts.valid} Penugasan Valid`}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* MODAL TAMBAH PENUGASAN SATUAN */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black flex items-center gap-2'>
								<span>➕</span> Tambah Penugasan Mengajar
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Pilih Guru Pengajar <span className='text-rose-600'>*</span>
								</label>
								<select
									value={formData.id_user}
									onChange={(e) => setFormData({ ...formData, id_user: e.target.value })}
									required
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
									<option value=''>-- Pilih Dewan Guru --</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap} (@{g.username})
										</option>
									))}
								</select>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Rombel Kelas <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
										required
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
										<option value=''>-- Pilih Kelas --</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.nama_kelas}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Mata Pelajaran <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.mapel}
										onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
										required
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
										<option value=''>-- Pilih Mapel --</option>
										{mapelList.map((m) => (
											<option key={m.id} value={m.mapel}>
												{m.mapel}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className='pt-3 border-t-2 border-black flex items-center justify-end gap-2.5'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isSaving}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
									{isSaving ? 'Menyimpan...' : 'Simpan Penugasan'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
