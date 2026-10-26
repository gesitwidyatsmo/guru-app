'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
	drawKepsekSignaturePDF,
	fetchSchoolProfile,
} from '@/lib/pdfKopSurat';
import { useAdminAuth } from '../AdminLayoutClient';

export default function PenggunaPage() {
	const { role: authRole } = useAdminAuth();
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentUserRole, setCurrentUserRole] = useState(authRole || null);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [isExportingPDF, setIsExportingPDF] = useState(false);
	const [kelasList, setKelasList] = useState([]);

	useEffect(() => {
		if (authRole) setCurrentUserRole(authRole);
	}, [authRole]);

	const [searchQuery, setSearchQuery] = useState('');
	const [roleFilter, setRoleFilter] = useState('all');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);

	// State Bulk Import Excel
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [importFile, setImportFile] = useState(null);
	const [defaultPassword, setDefaultPassword] = useState('guru123');
	const [parsedPreviewRows, setParsedPreviewRows] = useState([]);
	const [rawFileRows, setRawFileRows] = useState([]);
	const [isImporting, setIsImporting] = useState(false);
	const fileInputRef = useRef(null);

	const [formData, setFormData] = useState({
		username: '',
		password: '', // Untuk create baru wajib, edit opsional
		nama_lengkap: '',
		nip: '',
		role: 'Guru', // Default
	});

	const fetchUsers = async () => {
		try {
			const [response, resAuth, profile, resKelas] = await Promise.all([
				fetch('/api/users'),
				fetch('/api/auth/me'),
				fetchSchoolProfile(),
				fetch('/api/kelas?all=true').catch(() => ({ ok: false })),
			]);

			if (profile) {
				setSchoolProfile(profile);
			}

			if (resKelas && resKelas.ok) {
				const kData = await resKelas.json();
				if (Array.isArray(kData)) {
					setKelasList(kData);
				}
			}

			if (resAuth.ok) {
				const authData = await resAuth.json();
				if (authData?.user?.role) {
					setCurrentUserRole(authData.user.role);
				}
			}

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

	// Peta deteksi Wali Kelas: id_user & nama_lengkap -> list rombel kelas
	const waliMap = useMemo(() => {
		const map = {};
		kelasList.forEach((k) => {
			if (!k.kelas) return;
			if (k.id_wali_kelas) {
				const idKey = String(k.id_wali_kelas).trim();
				if (!map[idKey]) map[idKey] = [];
				if (!map[idKey].includes(k.kelas)) map[idKey].push(k.kelas);
			}
			if (k.wali_kelas) {
				const nameKey = String(k.wali_kelas).trim().toLowerCase();
				if (!map[nameKey]) map[nameKey] = [];
				if (!map[nameKey].includes(k.kelas)) map[nameKey].push(k.kelas);
			}
		});
		return map;
	}, [kelasList]);

	const getWaliKelas = useCallback((u) => {
		if (!u) return [];
		if (u.id_user && waliMap[String(u.id_user).trim()]) {
			return waliMap[String(u.id_user).trim()];
		}
		if (u.nama_lengkap && waliMap[String(u.nama_lengkap).trim().toLowerCase()]) {
			return waliMap[String(u.nama_lengkap).trim().toLowerCase()];
		}
		return [];
	}, [waliMap]);

	const filteredUsers = useMemo(() => {
		return users.filter((u) => {
			const waliArr = getWaliKelas(u);
			const isWali = waliArr.length > 0;
			const matchRole =
				roleFilter === 'all'
					? true
					: roleFilter === 'Wali Kelas'
					? isWali
					: roleFilter === 'Keamanan'
					? (u.role === 'Keamanan' || u.role === 'Keamanan Putra' || u.role === 'Keamanan Putri')
					: u.role === roleFilter;

			const q = searchQuery.toLowerCase().trim();
			const waliText = waliArr.join(' ').toLowerCase();
			const matchSearch =
				!q ||
				u.nama_lengkap.toLowerCase().includes(q) ||
				u.username.toLowerCase().includes(q) ||
				(u.nip && u.nip.toLowerCase().includes(q)) ||
				(u.id_user && u.id_user.toLowerCase().includes(q)) ||
				(isWali && (waliText.includes(q) || 'wali kelas'.includes(q)));
			return matchRole && matchSearch;
		});
	}, [users, roleFilter, searchQuery, getWaliKelas]);

	const guruCount = useMemo(() => users.filter((u) => u.role === 'Guru').length, [users]);
	const waliCount = useMemo(() => users.filter((u) => getWaliKelas(u).length > 0).length, [users, getWaliKelas]);
	const kepsekCount = useMemo(() => users.filter((u) => u.role === 'Kepala Sekolah').length, [users]);
	const kurikulumCount = useMemo(() => users.filter((u) => u.role === 'Kurikulum').length, [users]);
	const bendaharaCount = useMemo(() => users.filter((u) => u.role === 'Bendahara').length, [users]);
	const kesiswaanCount = useMemo(() => users.filter((u) => u.role === 'Kesiswaan').length, [users]);
	const keamananCount = useMemo(() => users.filter((u) => u.role === 'Keamanan').length, [users]);
	const keamananPutraCount = useMemo(() => users.filter((u) => u.role === 'Keamanan Putra').length, [users]);
	const keamananPutriCount = useMemo(() => users.filter((u) => u.role === 'Keamanan Putri').length, [users]);
	const adminCount = useMemo(() => users.filter((u) => u.role === 'Admin').length, [users]);

	const openCreateModal = () => {
		setIsEditMode(false);
		setEditId(null);
		setFormData({
			username: '',
			password: '',
			nama_lengkap: '',
			nip: '',
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
			nip: user.nip || '',
			role: user.role,
		});
		setIsModalOpen(true);
	};

	const handleDelete = async (user) => {
		const result = await Swal.fire({
			title: 'Cabut Akses Pengguna?',
			text: `Pengguna "${user.nama_lengkap}" (${user.username}) akan segera dicabut akses loginnya dari sistem.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Cabut Akses!',
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
				Swal.fire('Gagal Menghapus', err.message, 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formData.username.trim() || !formData.nama_lengkap.trim() || !formData.role) {
			Swal.fire('Kolom Wajib', 'Silakan lengkapi parameter Username, Nama Lengkap, & Role!', 'warning');
			return;
		}

		if (!isEditMode && !formData.password) {
			Swal.fire('Sandi Kosong', 'Akun pendaftar baru wajib memiliki kata sandi!', 'warning');
			return;
		}

		try {
			let response;
			const payload = { ...formData };

			if (isEditMode) {
				response = await fetch('/api/users', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id_user: editId,
						username: payload.username.trim(),
						nama_lengkap: payload.nama_lengkap.trim(),
						role: payload.role,
						nip: payload.nip ? payload.nip.trim() : null,
						password_baru: payload.password ? payload.password : undefined,
					}),
				});
			} else {
				response = await fetch('/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...payload,
						username: payload.username.trim(),
						nama_lengkap: payload.nama_lengkap.trim(),
						nip: payload.nip ? payload.nip.trim() : null,
					}),
				});
			}

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Terjadi kesalahan pada sistem backend.');
			}

			Swal.fire('Berhasil!', data.message || 'Data pengguna berhasil disimpan!', 'success');
			setIsModalOpen(false);
			fetchUsers();
		} catch (err) {
			Swal.fire('Peringatan', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR EKSPOR PDF MASTER PENGGUNA (DENGAN KOP SURAT RESMI)
	// ---------------------------------------------------------------------------
	const handleExportPDF = async () => {
		if (filteredUsers.length === 0) {
			Swal.fire('Data Kosong', 'Tidak ada data pengguna yang sesuai untuk diekspor ke PDF.', 'info');
			return;
		}

		setIsExportingPDF(true);
		try {
			let prof = schoolProfile;
			try {
				prof = await fetchSchoolProfile();
				if (prof) setSchoolProfile(prof);
			} catch (err) {
				console.warn('Gagal memuat profil sekolah terbaru saat ekspor PDF:', err);
			}

			const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();
			const margin = 14;

			// 1. Gambar Kop Surat Resmi
			const endKop = drawKopSuratPDF(doc, prof, { startY: 8, margin });

			// 2. Judul Laporan & Metadata
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42); // slate-900
			doc.text('DIREKTORI DATA PENGGUNA & HAK AKSES SISTEM', pageWidth / 2, endKop + 2.5, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			doc.setTextColor(71, 85, 105); // slate-600
			const roleLabel = roleFilter === 'all' ? 'Semua Peran' : roleFilter;
			const searchLabel = searchQuery.trim() ? `  •  Pencarian: "${searchQuery.trim()}"` : '';
			const dateStr = new Date().toLocaleDateString('id-ID', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			});
			doc.text(
				`Kategori Role: ${roleLabel}${searchLabel}  •  Total: ${filteredUsers.length} Pengguna  •  Dicetak: ${dateStr}`,
				pageWidth / 2,
				endKop + 6.8,
				{ align: 'center' }
			);

			// 3. Tabel Master Pengguna
			const tableHead = [
				['No', 'Nama Pengguna & Identitas', 'Username', 'Peran / Hak Akses', 'ID Pengguna'],
			];

			const tableBody = filteredUsers.map((u, idx) => {
				const namaWithNip = u.nip
					? `${u.nama_lengkap || '-'}\nNIP. ${u.nip}`
					: (u.nama_lengkap || '-');
				const waliArr = getWaliKelas(u);
				const roleDisplay =
					waliArr.length > 0
						? `${u.role} & Wali Kelas ${waliArr.join(', ')}`
						: (u.role || '-');

				return [
					idx + 1,
					namaWithNip,
					u.username || '-',
					roleDisplay,
					u.id_user || '-',
				];
			});

			autoTable(doc, {
				startY: endKop + 10,
				margin: { left: margin, right: margin },
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: {
					fillColor: [30, 41, 59], // Slate 800
					textColor: [255, 255, 255],
					fontSize: 8,
					fontStyle: 'bold',
					halign: 'center',
					cellPadding: 2,
				},
				bodyStyles: {
					fontSize: 7.5,
					textColor: [15, 23, 42],
					cellPadding: 2,
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { fontStyle: 'bold', cellWidth: 58 },
					2: { halign: 'center', cellWidth: 34 },
					3: { halign: 'center', fontStyle: 'bold', cellWidth: 46 },
					4: { halign: 'center', cellWidth: 36, textColor: [71, 85, 105], fontSize: 7 },
				},
				alternateRowStyles: {
					fillColor: [248, 250, 252], // slate-50
				},
				didParseCell: (data) => {
					if (data.section === 'body' && data.column.index === 3) {
						const r = String(data.cell.raw || '').toLowerCase();
						if (r.includes('admin')) {
							data.cell.styles.textColor = [190, 18, 60]; // Rose 700
						} else if (r.includes('kepala')) {
							data.cell.styles.textColor = [67, 56, 202]; // Indigo 700
						} else if (r.includes('wali')) {
							data.cell.styles.textColor = [5, 150, 105]; // Emerald 600
						} else if (r.includes('guru')) {
							data.cell.styles.textColor = [4, 120, 87]; // Emerald 700
						} else if (r.includes('kesiswaan')) {
							data.cell.styles.textColor = [109, 40, 217]; // Violet 700
						} else if (r.includes('bendahara')) {
							data.cell.styles.textColor = [15, 118, 110]; // Teal 700
						}
					}
				},
			});

			// 4. Blok Tanda Tangan Kepala Sekolah
			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 10;
			if (finalY + 35 > pageHeight) {
				doc.addPage();
				drawKepsekSignaturePDF(doc, prof, {
					startY: 20,
					title: 'Mengetahui & Mengesahkan,\nKepala Sekolah',
					x: pageWidth - 70,
				});
			} else {
				drawKepsekSignaturePDF(doc, prof, {
					startY: finalY,
					title: 'Mengetahui & Mengesahkan,\nKepala Sekolah',
					x: pageWidth - 70,
				});
			}

			// 5. Penomoran Halaman & Footer Resmi
			const pageCount = doc.internal.getNumberOfPages();
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(7.5);
				doc.setTextColor(148, 163, 184); // slate-400
				doc.text(
					`Halaman ${i} dari ${pageCount}`,
					pageWidth / 2,
					pageHeight - 8,
					{ align: 'center' }
				);
				doc.text(
					`Master Pengguna - ${prof?.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}`,
					margin,
					pageHeight - 8
				);
			}

			// 6. Simpan File PDF
			const cleanRole = roleFilter !== 'all' ? `_${roleFilter.replace(/\s+/g, '_')}` : '';
			const fileName = `Master_Pengguna${cleanRole}_${new Date().toISOString().split('T')[0]}.pdf`;
			doc.save(fileName);

			Swal.fire({
				icon: 'success',
				title: 'Berhasil Diekspor',
				text: `Dokumen PDF (${filteredUsers.length} pengguna) berhasil diunduh.`,
				timer: 2000,
				showConfirmButton: false,
			});
		} catch (err) {
			console.error('Gagal mengekspor PDF pengguna:', err);
			Swal.fire('Gagal Ekspor PDF', err.message || 'Terjadi kesalahan sistem saat membuat dokumen PDF.', 'error');
		} finally {
			setIsExportingPDF(false);
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR BULK IMPORT EXCEL
	// ---------------------------------------------------------------------------
	const handleDownloadTemplate = () => {
		const sampleData = [
			{
				'No': 1,
				'Nama Lengkap': 'Drs. Budi Santoso, M.Pd',
				'Username': 'budi_santoso',
				'Role': 'Guru',
				'Password': '',
			},
			{
				'No': 2,
				'Nama Lengkap': 'Siti Aminah, S.Pd',
				'Username': 'siti_aminah',
				'Role': 'Guru',
				'Password': 'guru123',
			},
			{
				'No': 3,
				'Nama Lengkap': 'Ahmad Ridwan, S.Kom',
				'Username': 'ahmad_ridwan',
				'Role': 'Guru',
				'Password': 'sandiRahasia99',
			},
			{
				'No': 4,
				'Nama Lengkap': 'Dr. H. Muhammad Arifin, M.Pd',
				'Username': 'arifin_kepsek',
				'Role': 'Kepala Sekolah',
				'Password': '',
			},
			{
				'No': 5,
				'Nama Lengkap': 'Admin IT Sekolah',
				'Username': 'admin_sekolah2',
				'Role': 'Admin',
				'Password': '',
			},
		];

		const ws = XLSX.utils.json_to_sheet(sampleData);
		ws['!cols'] = [
			{ wch: 6 },
			{ wch: 32 },
			{ wch: 22 },
			{ wch: 18 },
			{ wch: 24 },
		];

		const petunjukData = [
			{ 'PANDUAN PENGISIAN TEMPLATE EXCEL PENGGUNA': '1. Kolom "Nama Lengkap" wajib diisi (minimal 2 karakter).' },
			{ 'PANDUAN PENGISIAN TEMPLATE EXCEL PENGGUNA': '2. Kolom "Username" bersifat unik (hanya huruf kecil, angka, titik, atau garis bawah).' },
			{ 'PANDUAN PENGISIAN TEMPLATE EXCEL PENGGUNA': '3. Kolom "Role" dapat diisi salah satu dari: Guru, Kepala Sekolah, Admin. Default: Guru.' },
			{ 'PANDUAN PENGISIAN TEMPLATE EXCEL PENGGUNA': '4. Kolom "Password" bersifat OPSIONAL. Jika kosong, otomatis menggunakan kata sandi default: "guru123".' },
			{ 'PANDUAN PENGISIAN TEMPLATE EXCEL PENGGUNA': '5. Jika diisi kustom, kata sandi wajib minimal 6 karakter.' },
		];
		const wsPetunjuk = XLSX.utils.json_to_sheet(petunjukData);
		wsPetunjuk['!cols'] = [{ wch: 90 }];

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Template_Pengguna');
		XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk_Pengisian');
		XLSX.writeFile(wb, 'Template_Import_Pengguna_GuruApp.xlsx');
	};

	const handleFileChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setImportFile(file);

		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const buffer = evt.target.result;
				const wb = XLSX.read(buffer, { type: 'array' });
				const wsName = wb.SheetNames[0];
				const ws = wb.Sheets[wsName];
				const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

				// Filter baris kosong
				const validRows = rows.filter((r) => {
					const nama = r['Nama Lengkap'] || r['nama_lengkap'] || r['Nama'] || r['nama'] || '';
					const user = r['Username'] || r['username'] || r['User'] || '';
					return !!(String(nama).trim() || String(user).trim());
				});

				const preview = validRows.slice(0, 5).map((r, i) => {
					const nama = r['Nama Lengkap'] || r['nama_lengkap'] || r['Nama'] || r['nama'] || '(Kosong)';
					const rawUser = r['Username'] || r['username'] || r['User'] || '';
					const role = r['Role'] || r['role'] || r['Peran'] || 'Guru';
					const pass = r['Password'] || r['password'] || r['Kata Sandi'] || '';
					return {
						no: i + 1,
						nama: String(nama).trim(),
						username: String(rawUser).trim() || '(Otomatis dari Nama)',
						role: String(role).trim() || 'Guru',
						hasCustomPass: !!String(pass).trim(),
						rawPass: String(pass).trim(),
					};
				});

				setRawFileRows(validRows);
				setParsedPreviewRows(preview);
			} catch (err) {
				console.error('File parsing error:', err);
				Swal.fire('Format Tidak Didukung', 'Gagal memproses file Excel. Pastikan format file .xlsx atau .xls yang valid.', 'error');
				handleResetImport();
			}
		};
		reader.readAsArrayBuffer(file);
	};

	const handleResetImport = () => {
		setImportFile(null);
		setRawFileRows([]);
		setParsedPreviewRows([]);
		setDefaultPassword('guru123');
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const handleImportSubmit = async (e) => {
		e.preventDefault();
		if (!importFile) {
			Swal.fire('File Belum Dipilih', 'Harap pilih atau drag-and-drop file Excel terlebih dahulu!', 'warning');
			return;
		}

		if (rawFileRows.length === 0) {
			Swal.fire('File Kosong', 'Tidak ada baris data valid yang terdeteksi di dalam file Excel.', 'warning');
			return;
		}

		const pwdToUse = defaultPassword.trim() || 'guru123';
		if (pwdToUse.length < 6) {
			Swal.fire('Sandi Terlalu Pendek', 'Password default harus minimal 6 karakter kombinasi.', 'warning');
			return;
		}

		try {
			setIsImporting(true);
			const formDataPayload = new FormData();
			formDataPayload.append('file', importFile);
			formDataPayload.append('default_password', pwdToUse);

			const res = await fetch('/api/users/bulk-import', {
				method: 'POST',
				body: formDataPayload,
			});

			const result = await res.json();
			if (!res.ok) {
				throw new Error(result.error || 'Terjadi kesalahan sistem saat memproses impor.');
			}

			const { total, successCount, failCount, failures, defaultPasswordUsed } = result;

			let failureHtml = '';
			if (failCount > 0 && Array.isArray(failures) && failures.length > 0) {
				failureHtml = `
					<div class="mt-3 text-left border-2 border-black rounded-xl p-3 bg-rose-50 max-h-48 overflow-y-auto">
						<p class="text-xs font-black text-rose-800 uppercase mb-2">Rincian Baris Gagal / Dilewati (${failCount}):</p>
						<ul class="text-xs space-y-1.5 divide-y divide-rose-200">
							${failures
								.slice(0, 15)
								.map(
									(f) => `
								<li class="pt-1.5 text-rose-950 font-medium">
									<span class="font-black text-rose-900 bg-rose-200 px-1.5 py-0.5 rounded text-[10px] mr-1">Baris ${f.row}</span>
									<b>${f.username || f.nama}:</b> ${f.reason}
								</li>
							`
								)
								.join('')}
							${failures.length > 15 ? `<li class="pt-1.5 font-bold text-gray-600">... dan ${failures.length - 15} baris lainnya.</li>` : ''}
						</ul>
					</div>
				`;
			}

			await Swal.fire({
				title: successCount > 0 ? 'Proses Impor Tuntas!' : 'Impor Gagal',
				html: `
					<div class="space-y-3 text-sm text-gray-800 text-center">
						<p class="text-sm">Total data diproses: <b class="text-black font-black">${total} akun</b></p>
						<div class="flex items-center justify-center gap-3">
							<div class="px-3 py-1.5 bg-emerald-200 border-2 border-black rounded-xl font-black text-emerald-950 text-xs shadow-[2px_2px_0px_0px_#0D0D0D]">
								✅ Berhasil: ${successCount}
							</div>
							<div class="px-3 py-1.5 bg-rose-200 border-2 border-black rounded-xl font-black text-rose-950 text-xs shadow-[2px_2px_0px_0px_#0D0D0D]">
								❌ Gagal: ${failCount}
							</div>
						</div>
						<div class="p-2.5 bg-yellow-100 border-2 border-black rounded-xl text-left text-xs font-medium text-yellow-950 mt-2">
							💡 <b>Catatan Kredensial:</b> Akun dengan kolom password kosong telah disetel dengan password default: <code class="bg-white px-1.5 py-0.5 rounded border border-black font-mono font-bold">${defaultPasswordUsed || 'guru123'}</code>. Guru dapat mengubahnya setelah berhasil masuk.
						</div>
						${failureHtml}
					</div>
				`,
				icon: successCount > 0 ? (failCount > 0 ? 'warning' : 'success') : 'error',
				confirmButtonColor: '#0D0D0D',
				confirmButtonText: 'Selesai & Muat Ulang',
			});

			setIsImportModalOpen(false);
			handleResetImport();
			fetchUsers();
		} catch (err) {
			console.error('Import submit error:', err);
			Swal.fire('Gagal Impor', err.message, 'error');
		} finally {
			setIsImporting(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Monitoring Banner for Kepala Sekolah */}
			{currentUserRole === 'Kepala Sekolah' && (
				<div className='p-4 bg-indigo-50 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center gap-3.5'>
					<span className='text-3xl shrink-0'>🎓</span>
					<div>
						<p className='text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-tight'>Mode Monitoring Kepala Sekolah (Hanya Baca)</p>
						<p className='text-xs font-medium text-indigo-900 mt-0.5'>
							Anda memiliki hak akses penuh untuk meninjau seluruh data akun pengguna sekolah. Pembuatan akun baru, perombakan profil, serta reset kata sandi dikelola secara tersentralisasi oleh Administrator.
						</p>
					</div>
				</div>
			)}

			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>👥</span> Manajemen Hak Akses
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Master Pengguna & Akun
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tambah, modifikasi profil, tentukan peran (Role), serta reset kata sandi akun Guru & Administrator.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0'>
					<button
						onClick={handleExportPDF}
						disabled={isExportingPDF || filteredUsers.length === 0}
						title='Unduh data master pengguna dalam format PDF resmi dengan Kop Surat'
						className='neo-btn-outline flex items-center justify-center gap-2 text-xs sm:text-sm !py-3 !px-4 bg-white hover:bg-rose-50 text-rose-700 font-black flex-1 sm:flex-none whitespace-nowrap shadow-[3px_3px_0px_0px_#0D0D0D] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'>
						{isExportingPDF ? (
							<svg className='w-4 h-4 animate-spin text-rose-600' viewBox='0 0 24 24' fill='none'>
								<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
								<path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
							</svg>
						) : (
							<svg className='w-4 h-4 text-rose-600 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' />
							</svg>
						)}
						<span>{isExportingPDF ? 'Mengekspor PDF...' : 'Export PDF'}</span>
					</button>

					{currentUserRole !== 'Kepala Sekolah' && (
						<>
							<button
								onClick={() => {
									handleResetImport();
									setIsImportModalOpen(true);
								}}
								className='neo-btn-outline flex items-center justify-center gap-2 text-xs sm:text-sm !py-3 !px-4 bg-white flex-1 sm:flex-none whitespace-nowrap shadow-[3px_3px_0px_0px_#0D0D0D] hover:bg-emerald-50'>
								<svg className='w-4 h-4 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' />
								</svg>
								<span>Import Excel</span>
							</button>
							<button
								onClick={openCreateModal}
								className='neo-btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm !py-3 !px-5 flex-1 sm:flex-none whitespace-nowrap'>
								<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
								</svg>
								<span>Tambah Pengguna Baru</span>
							</button>
						</>
					)}
				</div>
			</div>

			{/* User Statistics Row */}
			<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-gray-500'>Total Pengguna</p>
						<p className='text-2xl font-black text-black mt-0.5'>{users.length}</p>
					</div>
					<span className='w-10 h-10 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👤
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-800'>Dewan Guru</p>
						<p className='text-2xl font-black text-emerald-900 mt-0.5'>{guruCount}</p>
						{waliCount > 0 && (
							<span className='inline-block text-[10px] font-black text-emerald-900 bg-emerald-200/90 px-1.5 py-0.5 rounded border border-emerald-400 mt-1'>
								{waliCount} Wali Kelas
							</span>
						)}
					</div>
					<span className='w-10 h-10 bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</span>
				</div>

				<div className='bg-violet-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-violet-800'>Kesiswaan</p>
						<p className='text-2xl font-black text-violet-900 mt-0.5'>{kesiswaanCount}</p>
					</div>
					<span className='w-10 h-10 bg-violet-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🛡️
					</span>
				</div>

				<div className='bg-amber-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-amber-800'>Kurikulum</p>
						<p className='text-2xl font-black text-amber-900 mt-0.5'>{kurikulumCount}</p>
					</div>
					<span className='w-10 h-10 bg-amber-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📐
					</span>
				</div>

				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-indigo-800'>Kepala Sekolah</p>
						<p className='text-2xl font-black text-indigo-900 mt-0.5'>{kepsekCount}</p>
					</div>
					<span className='w-10 h-10 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🎓
					</span>
				</div>

				<div className='bg-teal-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-teal-800'>Bendahara</p>
						<p className='text-2xl font-black text-teal-900 mt-0.5'>{bendaharaCount}</p>
					</div>
					<span className='w-10 h-10 bg-teal-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						💼
					</span>
				</div>

				<div className='bg-orange-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-orange-800'>Keamanan</p>
						<p className='text-2xl font-black text-orange-950 mt-0.5'>{keamananPutraCount + keamananPutriCount + keamananCount}</p>
						<p className='text-[10px] font-bold text-orange-800 mt-0.5'>{keamananPutraCount} Putra • {keamananPutriCount} Putri{keamananCount > 0 ? ` • ${keamananCount} Umum` : ''}</p>
					</div>
					<span className='w-10 h-10 bg-orange-300 border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👮‍♂️
					</span>
				</div>

				<div className='bg-rose-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-rose-800'>Administrator</p>
						<p className='text-2xl font-black text-rose-900 mt-0.5'>{adminCount}</p>
					</div>
					<span className='w-10 h-10 bg-rose-400 border-2 border-black rounded-xl flex items-center justify-center font-black text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👑
					</span>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div className='relative w-full sm:w-80'>
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
						placeholder='Cari nama, username, ID, atau wali kelas...'
						className='neo-input neo-input-with-icon !py-2 text-xs sm:text-sm'
					/>
				</div>

				<div className='flex flex-wrap items-center gap-1.5 bg-yellow-100 p-1.5 border-2 border-black rounded-xl w-full sm:w-auto shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
					{[
						{ id: 'all', label: 'Semua Role' },
						{ id: 'Guru', label: 'Guru' },
						{ id: 'Wali Kelas', label: `Wali Kelas${waliCount > 0 ? ` (${waliCount})` : ''}` },
						{ id: 'Kesiswaan', label: 'Kesiswaan' },
						{ id: 'Kurikulum', label: 'Kurikulum' },
						{ id: 'Kepala Sekolah', label: 'Kepsek' },
						{ id: 'Bendahara', label: 'Bendahara' },
						{ id: 'Keamanan', label: 'Keamanan' },
						{ id: 'Admin', label: 'Admin' },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setRoleFilter(tab.id)}
							className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap border-2 ${
								roleFilter === tab.id
									? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#F5C518]'
									: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200'
							}`}>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Table Container */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Pengguna</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Role / Hak Akses</th>
								<th className='px-6 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Username / ID</th>
								<th className='px-6 py-3.5 text-right text-xs font-black text-black uppercase tracking-wider'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{filteredUsers.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-yellow-50/50'>
										Tidak ada pengguna yang cocok dengan kriteria pencarian &ldquo;{searchQuery}&rdquo;.
									</td>
								</tr>
							) : (
								filteredUsers.map((u) => {
									const initial = u.nama_lengkap ? u.nama_lengkap.charAt(0).toUpperCase() : '?';
									const isAdmin = u.role === 'Admin';
									const isKepsek = u.role === 'Kepala Sekolah';
									const isBendahara = u.role === 'Bendahara';
									const isKesiswaan = u.role === 'Kesiswaan';
									const isKurikulum = u.role === 'Kurikulum';
									const isKeamananPutra = u.role === 'Keamanan Putra';
									const isKeamananPutri = u.role === 'Keamanan Putri';
									const isKeamananUmum = u.role === 'Keamanan';
									const isKeamanan = isKeamananPutra || isKeamananPutri || isKeamananUmum;
									const waliClasses = getWaliKelas(u);
									const isWali = waliClasses.length > 0;
									return (
										<tr
											key={u.id_user}
											className='hover:bg-yellow-50 transition-colors'>
											{/* Name & Avatar */}
											<td className='px-6 py-4'>
												<div className='flex items-center gap-3'>
													<div className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] ${
														isAdmin
															? 'bg-rose-400 text-white'
															: isKepsek
															? 'bg-indigo-300 text-black'
															: isKurikulum
															? 'bg-amber-300 text-black'
															: isBendahara
															? 'bg-teal-300 text-black'
															: isKesiswaan
															? 'bg-violet-300 text-black'
															: isKeamananPutra
															? 'bg-sky-300 text-sky-950'
															: isKeamananPutri
															? 'bg-pink-300 text-pink-950'
															: isKeamananUmum
															? 'bg-orange-300 text-black'
															: 'bg-emerald-300 text-black'
													}`}>
														{initial}
													</div>
													<div>
														<span className='font-black text-black block text-sm sm:text-base'>
															{u.nama_lengkap}
														</span>
														<div className='flex flex-wrap items-center gap-1.5 mt-0.5'>
															{u.nip && (
																<span className='inline-block text-[10px] font-mono font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300'>
																	NIP. {u.nip}
																</span>
															)}
															{isWali && (
																<span className='inline-block text-[10px] font-black text-emerald-950 bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-500'>
																	🏫 Wali Kelas {waliClasses.join(', ')}
																</span>
															)}
															<span className='text-[11px] font-bold text-gray-500'>
																{isAdmin
																	? 'Akses Penuh Administrator'
																	: isKepsek
																	? 'Monitoring & Evaluasi Institusi'
																	: isKurikulum
																	? 'Manajemen Kurikulum, Mapel, & Beban KBM'
																	: isBendahara
																	? 'Pengelola Keuangan & Bisaroh Guru'
																	: isKesiswaan
																	? 'Ketertiban, Poin, & Prestasi Siswa'
																	: isKeamananPutra
																	? 'Pos Keamanan Santri Putra & Surat Izin Digital'
																	: isKeamananPutri
																	? 'Pos Keamanan Santriwati Putri & Surat Izin Digital'
																	: isKeamananUmum
																	? 'Petugas Pos Keamanan & Surat Izin Digital'
																	: isWali
																	? `Wali Kelas ${waliClasses.join(', ')} • Tenaga Pendidik`
																	: 'Tenaga Pendidik / Pengajar'}
															</span>
														</div>
													</div>
												</div>
											</td>

											{/* Role Badge */}
											<td className='px-6 py-4'>
												<span
													className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] uppercase ${
														isAdmin
															? 'bg-rose-400 text-white'
															: isKepsek
															? 'bg-indigo-300 text-black'
															: isKurikulum
															? 'bg-amber-300 text-black'
															: isBendahara
															? 'bg-teal-300 text-black'
															: isKesiswaan
															? 'bg-violet-300 text-black'
															: isKeamananPutra
															? 'bg-sky-300 text-sky-950'
															: isKeamananPutri
															? 'bg-pink-300 text-pink-950'
															: isKeamananUmum
															? 'bg-orange-300 text-black'
															: isWali
															? 'bg-emerald-300 text-black'
															: 'bg-emerald-200 text-black'
													}`}>
													<span>{isAdmin ? '👑' : isKepsek ? '🎓' : isKurikulum ? '📐' : isBendahara ? '💼' : isKesiswaan ? '🛡️' : isKeamananPutra ? '👮‍♂️' : isKeamananPutri ? '🧕' : isKeamananUmum ? '👮‍♂️' : isWali ? '🏫' : '👨‍🏫'}</span>
													<span>{isWali ? `Guru & Wali Kelas ${waliClasses.join(', ')}` : u.role}</span>
												</span>
											</td>

											{/* Username & ID */}
											<td className='px-6 py-4'>
												<div className='flex flex-col items-start gap-0.5'>
													<span className='font-mono font-black text-xs sm:text-sm text-black bg-yellow-100 px-2 py-0.5 rounded border border-black/30'>
														{u.username}
													</span>
													<span className='text-[10px] font-mono text-gray-500 font-bold'>
														ID: {u.id_user}
													</span>
												</div>
											</td>

											{/* Action Buttons */}
											<td className='px-6 py-4 text-right'>
												{currentUserRole === 'Kepala Sekolah' ? (
													<span className='inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 border border-black/30 rounded-lg text-xs font-bold text-gray-700'>
														<span>👁️</span> Pantau
													</span>
												) : (
													<div className='flex items-center justify-end gap-2'>
														<button
															onClick={() => openEditModal(u)}
															title='Ubah Profil / Reset Sandi'
															className='p-2 bg-yellow-200 hover:bg-yellow-400 text-black border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
															<svg
																className='w-4 h-4'
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'
																strokeWidth='2.5'>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
																/>
															</svg>
														</button>
														<button
															onClick={() => handleDelete(u)}
															title='Cabut Akses Akun Pengguna'
															className='p-2 bg-rose-200 hover:bg-rose-500 hover:text-white text-rose-900 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
															<svg
																className='w-4 h-4'
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'
																strokeWidth='2.5'>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
																/>
															</svg>
														</button>
													</div>
												)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal UI Pendaftaran & Edit Pengguna */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-yellow-300'>
							<h3 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
								<span>{isEditMode ? '✏️' : '✨'}</span>
								<span>{isEditMode ? 'Edit Profil & Akses Pengguna' : 'Pendaftaran Pengguna Baru'}</span>
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 bg-[var(--background)]'>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Nama Lengkap & Gelar <span className='text-rose-600'>*</span>
										</label>
										<input
											type='text'
											required
											value={formData.nama_lengkap}
											onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
											className='neo-input text-sm'
											placeholder='Contoh: Drs. Budi Santoso, M.Pd'
										/>
									</div>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											NIP (Nomor Induk Pegawai)
										</label>
										<input
											type='text'
											value={formData.nip || ''}
											onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
											className='neo-input text-sm font-mono'
											placeholder='19750812 199903 1 002'
										/>
										<p className='text-[10px] font-bold text-gray-500 mt-1'>
											Wajib/utama untuk penandatangan Kepala Sekolah
										</p>
									</div>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Username Login <span className='text-rose-600'>*</span>
										</label>
										<input
											type='text'
											required
											value={formData.username}
											onChange={(e) => setFormData({ ...formData, username: e.target.value })}
											className='neo-input text-sm font-mono'
											placeholder='budi_santoso'
										/>
									</div>
									<div>
										<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
											Peran / Role <span className='text-rose-600'>*</span>
										</label>
										<select
											value={formData.role}
											onChange={(e) => setFormData({ ...formData, role: e.target.value })}
											className='neo-input text-sm bg-white font-bold'>
											<option value='Guru'>👨‍🏫 Guru (Pengajar/Wali)</option>
											<option value='Kesiswaan'>🛡️ Kesiswaan (Ketertiban & Prestasi)</option>
											<option value='Kurikulum'>📐 Kurikulum (Akademik & Jadwal)</option>
											<option value='Kepala Sekolah'>🎓 Kepala Sekolah (Monitoring)</option>
											<option value='Bendahara'>💼 Bendahara (Keuangan & Bisaroh)</option>
											<option value='Keamanan Putra'>👮‍♂️ Keamanan Putra (Pos Santri Putra)</option>
											<option value='Keamanan Putri'>🧕 Keamanan Putri (Pos Santriwati Putri)</option>
											<option value='Keamanan'>🚨 Keamanan Terpadu (Gerbang Utama)</option>
											<option value='Admin'>👑 Admin (Super Master)</option>
										</select>
									</div>
								</div>

								<div>
									<label className='block text-xs font-black text-black uppercase tracking-wider mb-1.5'>
										{isEditMode ? 'Ganti Kata Sandi (Kosongkan bila tidak diubah)' : 'Kata Sandi Awal *'}
									</label>
									<input
										type='password'
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										className='neo-input text-sm font-mono'
										placeholder={isEditMode ? 'Ketik sandi baru untuk mereset...' : 'Minimal 6 karakter kombinasi'}
									/>
									<p className='text-[11px] font-bold text-gray-500 mt-1'>
										{isEditMode
											? 'Biarkan kosong jika kata sandi lama masih ingin dipertahankan.'
											: 'Kredensial ini akan langsung digunakan guru untuk masuk ke GuruApp.'}
									</p>
								</div>

								<div className='pt-4 border-t-2 border-black/10 flex gap-3'>
									<button
										type='button'
										onClick={() => setIsModalOpen(false)}
										className='neo-btn-outline flex-1 text-center justify-center text-xs sm:text-sm !py-2.5'>
										Batal
									</button>
									<button
										type='submit'
										className='neo-btn-primary flex-1 text-center justify-center text-xs sm:text-sm !py-2.5 bg-black text-white'>
										{isEditMode ? 'Simpan Perubahan' : 'Daftarkan Akun'}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* Modal UI Bulk Import Excel */}
			{isImportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-emerald-300'>
							<h3 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
								<span>📥</span>
								<span>Impor Pengguna Massal (Excel)</span>
							</h3>
							<button
								onClick={() => {
									if (!isImporting) {
										setIsImportModalOpen(false);
										handleResetImport();
									}
								}}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 bg-[var(--background)] space-y-4 max-h-[80vh] overflow-y-auto'>
							{/* Step 1: Template Excel */}
							<div className='p-4 bg-emerald-50 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
								<div className='flex items-start gap-3'>
									<span className='text-2xl shrink-0'>📊</span>
									<div>
										<p className='text-xs sm:text-sm font-black text-emerald-950 uppercase'>Gunakan Template Excel Resmi</p>
										<p className='text-xs font-medium text-emerald-900 mt-0.5'>
											Unduh format tabel dengan kolom baku: <span className='font-bold bg-white px-1 py-0.5 rounded border border-black/30'>Nama Lengkap</span>, <span className='font-bold bg-white px-1 py-0.5 rounded border border-black/30'>Username</span>, <span className='font-bold bg-white px-1 py-0.5 rounded border border-black/30'>Role</span>, dan <span className='font-bold bg-white px-1 py-0.5 rounded border border-black/30'>Password</span>.
										</p>
									</div>
								</div>
								<button
									type='button'
									onClick={handleDownloadTemplate}
									className='neo-btn-outline !py-2 !px-3 text-xs bg-white text-emerald-950 border-2 border-black font-black flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-emerald-100 whitespace-nowrap self-stretch sm:self-auto justify-center'>
									<span>⬇️</span> Unduh Template (.xlsx)
								</button>
							</div>

							{/* Step 2: Konfigurasi Password Default */}
							<div className='p-4 bg-yellow-50 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] space-y-2'>
								<div className='flex items-center justify-between'>
									<label className='block text-xs font-black text-black uppercase tracking-wider'>
										🔑 Password Default (Jika Kolom Kosong)
									</label>
									<span className='text-[10px] font-black uppercase bg-yellow-300 border border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_#0D0D0D]'>
										Default: guru123
									</span>
								</div>
								<div className='flex items-center gap-2'>
									<input
										type='text'
										value={defaultPassword}
										onChange={(e) => setDefaultPassword(e.target.value)}
										placeholder='guru123'
										className='neo-input text-xs sm:text-sm font-mono font-bold bg-white flex-1'
									/>
									<button
										type='button'
										onClick={() => setDefaultPassword('guru123')}
										title='Reset ke guru123'
										className='px-3 py-2 bg-yellow-200 hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 transition-all'>
										Reset guru123
									</button>
								</div>
								<p className='text-[11px] font-bold text-gray-600'>
									💡 Baris data dalam file Excel dengan kolom Password yang kosong akan otomatis disetel ke password default di atas. (Minimal 6 karakter).
								</p>
							</div>

							{/* Step 3: Area Upload File */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black text-black uppercase tracking-wider'>
									File Excel (.xlsx / .xls) <span className='text-rose-600'>*</span>
								</label>
								<div
									onClick={() => fileInputRef.current?.click()}
									className={`border-3 border-dashed border-black rounded-2xl p-6 text-center cursor-pointer transition-all ${
										importFile ? 'bg-emerald-50 border-solid border-emerald-600' : 'bg-white hover:bg-yellow-50'
									}`}>
									<input
										ref={fileInputRef}
										type='file'
										accept='.xlsx, .xls'
										onChange={handleFileChange}
										className='hidden'
									/>
									{importFile ? (
										<div className='space-y-1.5'>
											<div className='w-12 h-12 mx-auto bg-emerald-400 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
												📄
											</div>
											<p className='text-sm font-black text-black'>{importFile.name}</p>
											<p className='text-xs font-bold text-emerald-800'>
												Ukuran: {(importFile.size / 1024).toFixed(1)} KB • Terdeteksi: <b className='font-black text-black'>{rawFileRows.length} baris calon pengguna</b>
											</p>
											<p className='text-[11px] font-bold text-gray-500'>
												Klik untuk mengganti berkas Excel
											</p>
										</div>
									) : (
										<div className='space-y-1.5'>
											<div className='w-12 h-12 mx-auto bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
												📁
											</div>
											<p className='text-sm font-black text-black'>Klik untuk memilih file Excel atau seret berkas ke sini</p>
											<p className='text-xs font-medium text-gray-500'>Format didukung: Microsoft Excel (.xlsx / .xls)</p>
										</div>
									)}
								</div>
							</div>

							{/* Step 4: Pratinjau Baris */}
							{parsedPreviewRows.length > 0 && (
								<div className='space-y-2'>
									<div className='flex items-center justify-between'>
										<p className='text-xs font-black uppercase text-black'>
											Pratinjau Data (5 Teratas dari {rawFileRows.length} Akun):
										</p>
										<span className='text-[11px] font-bold text-gray-600'>
											Siap diimpor
										</span>
									</div>
									<div className='border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0px_0px_#0D0D0D]'>
										<div className='overflow-x-auto'>
											<table className='w-full text-left text-xs'>
												<thead className='bg-yellow-300 border-b-2 border-black font-black uppercase'>
													<tr>
														<th className='p-2.5 w-8 text-center'>#</th>
														<th className='p-2.5'>Nama Lengkap</th>
														<th className='p-2.5'>Username</th>
														<th className='p-2.5'>Role</th>
														<th className='p-2.5'>Kata Sandi</th>
													</tr>
												</thead>
												<tbody className='divide-y divide-black/10 bg-white'>
													{parsedPreviewRows.map((r) => (
														<tr key={r.no} className='hover:bg-yellow-50'>
															<td className='p-2.5 text-center font-bold'>{r.no}</td>
															<td className='p-2.5 font-black text-black'>{r.nama}</td>
															<td className='p-2.5 font-mono text-gray-700 font-bold'>{r.username}</td>
															<td className='p-2.5'>
																<span className='px-2 py-0.5 bg-gray-100 border border-black rounded text-[10px] font-black uppercase'>
																	{r.role}
																</span>
															</td>
															<td className='p-2.5'>
																{r.hasCustomPass ? (
																	<span className='px-2 py-0.5 bg-cyan-100 text-cyan-900 border border-cyan-800 rounded text-[10px] font-bold'>
																		🔒 Kustom ({r.rawPass.length} char)
																	</span>
																) : (
																	<span className='px-2 py-0.5 bg-yellow-200 text-yellow-950 border border-yellow-800 rounded text-[10px] font-bold'>
																		🔑 {defaultPassword || 'guru123'} (Default)
																	</span>
																)}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}

							{/* Step 5: Footer Actions */}
							<div className='pt-4 border-t-2 border-black/10 flex gap-3'>
								<button
									type='button'
									disabled={isImporting}
									onClick={() => {
										if (!isImporting) {
											setIsImportModalOpen(false);
											handleResetImport();
										}
									}}
									className='neo-btn-outline flex-1 text-center justify-center text-xs sm:text-sm !py-2.5'>
									Batal
								</button>
								<button
									type='button'
									disabled={isImporting || !importFile || rawFileRows.length === 0}
									onClick={handleImportSubmit}
									className={`neo-btn-primary flex-1 text-center justify-center text-xs sm:text-sm !py-2.5 ${
										isImporting || !importFile || rawFileRows.length === 0
											? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-700'
											: 'bg-emerald-400 hover:bg-emerald-300 text-black'
									}`}>
									{isImporting ? (
										<span className='flex items-center gap-2'>
											<svg className='animate-spin h-4 w-4 text-black' viewBox='0 0 24 24'>
												<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' fill='none' />
												<path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
											</svg>
											<span>Memproses Impor Pengguna...</span>
										</span>
									) : (
										<span>Mulai Impor ({rawFileRows.length} Pengguna)</span>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
