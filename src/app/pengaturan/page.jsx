'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { useAcademic } from '@/context/AcademicContext';

export default function PengaturanPage() {
	const [userRole, setUserRole] = useState(null);
	const [activeTab, setActiveTab] = useState('tentang');
	const [isBackingUp, setIsBackingUp] = useState(false);
	const [installPrompt, setInstallPrompt] = useState(null);
	const [isInstalled, setIsInstalled] = useState(false);

	// === STATE TAHUN AJAR ===
	const { daftarTahunAjar, tahunAjarAktif, semesterAktif, refreshDaftar } = useAcademic();
	const [isSavingTA, setIsSavingTA] = useState(false);
	const [isSettingAktif, setIsSettingAktif] = useState(false);
	const [showFormTA, setShowFormTA] = useState(false);
	const [formTA, setFormTA] = useState({ nama: '', semester: '1', tanggal_mulai: '', tanggal_selesai: '' });

	// === STATE PROMOSI KELAS ===
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [promosiMode, setPromosiMode] = useState('massal');
	const [promosiMassal, setPromosiMassal] = useState([]);
	const [promosiIndividual, setPromosiIndividual] = useState([]);
	const [isLoadingPromosi, setIsLoadingPromosi] = useState(false);
	const [isSavingPromosi, setIsSavingPromosi] = useState(false);
	const [searchSiswaPromosi, setSearchSiswaPromosi] = useState('');
	const [filterKelasAsal, setFilterKelasAsal] = useState('all');

	useEffect(() => {
		// Cek apakah sudah berjalan dalam mode standalone (sudah diinstall)
		if (window.matchMedia('(display-mode: standalone)').matches) {
			setIsInstalled(true);
		}

		const handler = (e) => {
			e.preventDefault();
			setInstallPrompt(e);
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);

	useEffect(() => {
		const checkRole = async () => {
			try {
				const resAuth = await fetch('/api/auth/me');
				if (resAuth.ok) {
					const dataAuth = await resAuth.json();
					setUserRole(dataAuth.user.role);
					if (dataAuth.user.role === 'Admin') {
						setActiveTab('backup');
					}
				}
			} catch (err) {
				console.error(err);
			}
		};
		checkRole();
	}, []);

	// Load data kelas & siswa untuk promosi
	useEffect(() => {
		if (userRole !== 'Admin') return;
		const loadData = async () => {
			try {
				const [resKelas, resSiswa] = await Promise.all([
					fetch('/api/kelas'),
					fetch('/api/siswa'),
				]);
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				setKelasList(dataKelas);
				setSiswaList(dataSiswa.filter(s => s.status === 'Aktif'));
				// Init promosi massal
				const initMassal = dataKelas.map(k => ({
					dari_kelas: k.nama_kelas || k.kelas,
					ke_kelas: '',
				}));
				setPromosiMassal(initMassal);
				// Init promosi individual
				setPromosiIndividual(dataSiswa.filter(s => s.status === 'Aktif').map(s => ({ siswa_id: s.id, nama: s.nama_lengkap, kelas_lama: s.kelas, ke_kelas: '' })));
			} catch (err) {
				console.error(err);
			}
		};
		loadData();
	}, [userRole]);

	// Handler: Buat Tahun Ajar Baru
	const handleBuatTA = async (e) => {
		e.preventDefault();
		if (!formTA.nama || !formTA.semester) return;
		try {
			setIsSavingTA(true);
			const res = await fetch('/api/tahun-ajar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formTA),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal membuat tahun ajar');
			Swal.fire('Berhasil!', `Tahun Ajar ${formTA.nama} Semester ${formTA.semester} berhasil dibuat.`, 'success');
			setShowFormTA(false);
			setFormTA({ nama: '', semester: '1', tanggal_mulai: '', tanggal_selesai: '' });
			await refreshDaftar();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSavingTA(false);
		}
	};

	// Handler: Set Aktif
	const handleSetAktif = async (id, nama, semester) => {
		const result = await Swal.fire({
			title: 'Jadikan Aktif?',
			text: `TA ${nama} Semester ${semester} akan menjadi periode aktif sistem. Semua pengguna akan melihat data periode ini secara default.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#10B981',
			confirmButtonText: 'Ya, Aktifkan',
			cancelButtonText: 'Batal',
		});
		if (!result.isConfirmed) return;
		try {
			setIsSettingAktif(true);
			const res = await fetch('/api/tahun-ajar/aktif', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});
			if (!res.ok) throw new Error('Gagal mengaktifkan periode');
			Swal.fire('Aktif!', `TA ${nama} Sem ${semester} kini menjadi periode aktif.`, 'success');
			await refreshDaftar();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSettingAktif(false);
		}
	};

	// Handler: Promosi Massal
	const handlePromosiMassal = async () => {
		const items = promosiMassal.filter(p => p.ke_kelas && p.ke_kelas !== p.dari_kelas);
		if (items.length === 0) {
			Swal.fire('Info', 'Tidak ada kelas yang dipilih untuk dipromosikan.', 'info');
			return;
		}
		const result = await Swal.fire({
			title: 'Konfirmasi Promosi Massal',
			html: `<p>${items.length} kelas akan dipromosikan:</p><ul>${items.map(i => `<li>${i.dari_kelas} → ${i.ke_kelas}</li>`).join('')}</ul>`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			confirmButtonText: 'Ya, Promosikan',
		});
		if (!result.isConfirmed) return;
		try {
			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'massal', items }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			Swal.fire('Berhasil!', data.message, 'success');
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSavingPromosi(false);
		}
	};

	// Handler: Promosi Individual
	const handlePromosiIndividual = async () => {
		const items = promosiIndividual.filter(p => p.ke_kelas && p.ke_kelas !== p.kelas_lama);
		if (items.length === 0) {
			Swal.fire('Info', 'Tidak ada siswa yang dipilih untuk dipromosikan.', 'info');
			return;
		}
		const result = await Swal.fire({
			title: 'Konfirmasi Promosi Individual',
			text: `${items.length} siswa akan diperbarui kelasnya.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			confirmButtonText: 'Ya, Promosikan',
		});
		if (!result.isConfirmed) return;
		try {
			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'individual', items: items.map(p => ({ siswa_id: p.siswa_id, ke_kelas: p.ke_kelas })) }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			Swal.fire('Berhasil!', data.message, 'success');
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSavingPromosi(false);
		}
	};

	// Handler: Download Template Excel Penjurusan / Plotting
	const handleDownloadTemplatePenjurusan = () => {
		let targetStudents = siswaList;
		if (filterKelasAsal !== 'all') {
			targetStudents = siswaList.filter(s => s.kelas === filterKelasAsal);
		}
		if (targetStudents.length === 0) {
			Swal.fire('Perhatian', 'Tidak ada siswa aktif pada kelas yang dipilih.', 'warning');
			return;
		}

		const dataToExport = targetStudents.map((s, idx) => ({
			'No': idx + 1,
			'NIS': s.nis || '',
			'Nama Siswa': s.nama_lengkap,
			'Kelas Asal': s.kelas,
			'Kelas Baru': '', // diisi oleh kurikulum/admin (contoh: 11-IPA-1, 11-IPS-2, atau Lulus)
		}));

		const ws = XLSX.utils.json_to_sheet(dataToExport);
		ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 22 }];
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Plotting_Penjurusan');

		const fileName = `Template_Penjurusan_${filterKelasAsal === 'all' ? 'Semua_Kelas' : filterKelasAsal}_${new Date().getFullYear()}.xlsx`;
		XLSX.writeFile(wb, fileName);
	};

	// Handler: Upload Mapping Excel Penjurusan / Plotting
	const handleUploadExcelPenjurusan = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const arrayBuffer = await file.arrayBuffer();
			const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
			const sheetName = workbook.SheetNames[0];
			const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

			if (!rawData || rawData.length === 0) {
				Swal.fire('Error', 'File Excel kosong atau format kolom tidak sesuai.', 'error');
				return;
			}

			const parsedItems = [];
			for (const row of rawData) {
				const nis = String(row['NIS'] || row['nis'] || '').trim();
				const nama = String(row['Nama Siswa'] || row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || '').trim();
				const keKelas = String(row['Kelas Baru'] || row['kelas_baru'] || row['Ke Kelas'] || row['ke_kelas'] || '').trim();

				if ((nis || nama) && keKelas) {
					let matchedSiswa = null;
					if (nis) {
						matchedSiswa = siswaList.find(s => String(s.nis).trim() === nis);
					}
					if (!matchedSiswa && nama) {
						matchedSiswa = siswaList.find(s => s.nama_lengkap.toLowerCase() === nama.toLowerCase());
					}

					if (matchedSiswa) {
						parsedItems.push({
							siswa_id: matchedSiswa.id,
							nis: matchedSiswa.nis,
							nama: matchedSiswa.nama_lengkap,
							kelas_lama: matchedSiswa.kelas,
							ke_kelas: keKelas
						});
					} else {
						parsedItems.push({
							nis: nis,
							nama: nama,
							ke_kelas: keKelas
						});
					}
				}
			}

			if (parsedItems.length === 0) {
				Swal.fire('Perhatian', 'Tidak ditemukan data pemetaan kelas yang valid pada kolom "Kelas Baru". Pastikan kolom terisi.', 'warning');
				return;
			}

			const confirm = await Swal.fire({
				title: 'Konfirmasi Plotting Penjurusan',
				html: `
					<div class="text-left text-sm space-y-2">
						<p>Ditemukan <b>${parsedItems.length}</b> siswa dengan pemetaan kelas baru.</p>
						<p class="text-gray-500 text-xs">Contoh sampel 3 data pertama:</p>
						<ul class="list-disc pl-5 text-xs text-indigo-700 font-semibold bg-indigo-50 p-2 rounded">
							${parsedItems.slice(0, 3).map(p => `<li>${p.nama || p.nis} (${p.kelas_lama || 'Asal'} &rarr; ${p.ke_kelas})</li>`).join('')}
						</ul>
					</div>
				`,
				icon: 'question',
				showCancelButton: true,
				confirmButtonText: 'Ya, Jalankan Plotting',
				cancelButtonText: 'Batal',
				confirmButtonColor: '#7C3AED'
			});

			if (!confirm.isConfirmed) return;

			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'individual', items: parsedItems }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memproses pemetaan kelas');

			Swal.fire('Berhasil!', data.message || `Berhasil memplot ${parsedItems.length} siswa ke kelas baru.`, 'success');

			// Refresh data siswa lokal
			const resSiswa = await fetch('/api/siswa');
			if (resSiswa.ok) {
				const dataSiswa = await resSiswa.json();
				const activeSiswa = (dataSiswa || []).filter(s => s.status === 'Aktif');
				setSiswaList(activeSiswa);
				setPromosiIndividual(activeSiswa.map(s => ({ siswa_id: s.id, nama: s.nama_lengkap, kelas_lama: s.kelas, ke_kelas: '' })));
			}
		} catch (err) {
			console.error(err);
			Swal.fire('Error', err.message || 'Gagal membaca file Excel.', 'error');
		} finally {
			setIsSavingPromosi(false);
			e.target.value = '';
		}
	};

	const handleInstallApp = async () => {
		if (!installPrompt) return;
		installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === 'accepted') {
			setIsInstalled(true);
			setInstallPrompt(null);
		}
	};

	const handleBackup = async () => {
		try {
			setIsBackingUp(true);
			const res = await fetch('/api/backup');
			if (!res.ok) throw new Error('Gagal mengambil data dari server');

			const data = await res.json();
			const workbook = XLSX.utils.book_new();

			// Iterate object keys (sheet titles)
			Object.keys(data).forEach((sheetTitle) => {
				const sheetData = data[sheetTitle];
				// Jika kosong, minimal kasih header kosong atau array kosong
				const worksheet = XLSX.utils.json_to_sheet(sheetData.length ? sheetData : [{}]);
				XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.replace('MASTER_', ''));
			});

			const dateStr = new Date().toISOString().slice(0, 10);
			XLSX.writeFile(workbook, `Backup_GuruApp_${dateStr}.xlsx`);

			Swal.fire('Berhasil', 'Database berhasil dibackup ke mode Excel', 'success');
		} catch (error) {
			console.error(error);
			Swal.fire('Error', error.message || 'Terjadi kesalahan saat membackup data', 'error');
		} finally {
			setIsBackingUp(false);
		}
	};

	const appInfo = [
		{ label: 'Nama Aplikasi', value: 'GuruApp' },
		{ label: 'Versi', value: '1.0.0' },
		{ label: 'Framework', value: 'Next.js 14' },
		{ label: 'Backend', value: 'Supabase' },
	];

	const menuLinks = [
		{
			label: 'Kelas',
			route: '/kelas',
			icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
			color: 'from-orange-400 to-red-500',
		},
		{ label: 'Siswa', route: '/siswa', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'from-cyan-400 to-blue-500' },
		{
			label: 'Mata Pelajaran',
			route: '/mapel',
			icon:
				'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
			color: 'from-yellow-400 to-orange-500',
		},
		{ label: 'Jadwal', route: '/jadwal', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'from-pink-400 to-rose-500' },
		{
			label: 'Jurnal',
			route: '/jurnal',
			icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
			color: 'from-teal-400 to-cyan-500',
		},
		{
			label: 'Grup',
			route: '/grup',
			icon:
				'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
			color: 'from-violet-400 to-purple-500',
		},
	];

	const tabs = [];
	if (userRole === 'Admin') {
		tabs.push({ id: 'backup', label: 'Backup Data', emoji: '💾' });
		tabs.push({ id: 'tahun-ajar', label: 'Tahun Ajar', emoji: '📅' });
		tabs.push({ id: 'promosi-kelas', label: 'Promosi Kelas', emoji: '🎓' });
		tabs.push({ id: 'navigasi', label: 'Navigasi', emoji: '🗺️' });
	}
	tabs.push({ id: 'tentang', label: 'Tentang', emoji: 'ℹ️' });

	return (
		<main className='min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'>
			<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
				{/* Header */}
				<div className='flex items-center justify-between gap-4 mb-6'>
					<div className='flex items-center gap-4'>
						<Link
							href='/'
							className='p-2 rounded-xl bg-white shadow hover:shadow-md transition-all text-gray-600 hover:text-indigo-600'>
							<svg
								className='w-5 h-5'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 19l-7-7 7-7'
								/>
							</svg>
						</Link>
						<div>
							<h1 className='text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2'>
								<span>⚙️</span> Pengaturan
							</h1>
							<p className='text-gray-500 text-sm'>Kelola konfigurasi aplikasi GuruApp</p>
						</div>
					</div>

					{userRole === 'Admin' && (
						<Link
							href='/admin'
							className='hidden sm:flex items-center gap-2 px-4 py-2 bg-yellow-300 border-2 border-black rounded-xl font-bold text-xs uppercase shadow-[3px_3px_0px_0px_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-black'>
							<span>⚡ Buka Portal Admin</span>
						</Link>
					)}
				</div>

				{userRole === 'Admin' && (
					<div className='mb-6 bg-yellow-100 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
						<div className='flex items-center gap-3'>
							<span className='text-2xl'>🛡️</span>
							<div>
								<p className='text-sm font-bold text-black'>Akses Administrator Terdeteksi</p>
								<p className='text-xs text-gray-700'>Seluruh fitur manajemen pengguna, penugasan, tahun ajar, promosi, dan backup kini tersedia terpusat di Portal Admin.</p>
							</div>
						</div>
						<Link
							href='/admin'
							className='px-4 py-2 bg-black text-white text-xs font-bold uppercase rounded-xl border border-black shadow-[2px_2px_0px_0px_#0D0D0D] self-start sm:self-auto whitespace-nowrap'>
							Buka Portal &rarr;
						</Link>
					</div>
				)}

				{/* Tabs */}
				<div className='flex gap-2 mb-6 bg-white rounded-2xl p-1.5 shadow border border-gray-100 overflow-x-auto'>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
								activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
							}`}>
							<span>{tab.emoji}</span>
							{tab.label}
						</button>
					))}
				</div>

				{/* TAB: Backup Data */}
				{activeTab === 'backup' && userRole === 'Admin' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-2'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
									/>
								</svg>
							</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Backup Database Lokal</h2>
								<p className='text-sm text-gray-500'>Amankan semua data aplikasi ke file Excel</p>
							</div>
						</div>

						<div className='bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3'>
							<span className='text-xl'>⚠️</span>
							<p className='text-sm text-orange-800'>
								Proses ini akan mengunduh seluruh data (Kelas, Mapel, Siswa, Nilai, Absensi, Jurnal) dari Google Sheets pusat ke dalam format{' '}
								<span className='font-bold bg-orange-200 px-1 rounded'>.xlsx</span> untuk keperluan arsip/offline. Harap simpan file backup dengan aman.
							</p>
						</div>

						<button
							onClick={handleBackup}
							disabled={isBackingUp}
							className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-3 shadow hover:shadow-lg ${
								isBackingUp ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-[1.01]'
							}`}>
							{isBackingUp ? (
								<>
									<div className='w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin'></div>
									Sedang Memproses Backup...
								</>
							) : (
								<>
									<svg
										className='w-6 h-6'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
										/>
									</svg>
									Download Backup Database (.xlsx)
								</>
							)}
						</button>
					</div>
				)}

				{/* TAB: Tahun Ajar */}
				{activeTab === 'tahun-ajar' && userRole === 'Admin' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-2'>
						<div className='flex items-center justify-between mb-6'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl'>📅</div>
								<div>
									<h2 className='text-lg font-bold text-gray-800'>Manajemen Tahun Ajar</h2>
									<p className='text-sm text-gray-500'>Kelola periode akademik sistem</p>
								</div>
							</div>
							<button
								onClick={() => setShowFormTA(!showFormTA)}
								className='flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors'
							>
								<span>+</span> Buat Baru
							</button>
						</div>

						{/* Form Buat Tahun Ajar */}
						{showFormTA && (
							<form onSubmit={handleBuatTA} className='mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl'>
								<h3 className='font-semibold text-emerald-800 mb-4'>Buat Tahun Ajar Baru</h3>
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>Tahun Ajar <span className='text-red-500'>*</span></label>
										<input
											type='text'
											placeholder='Contoh: 2027/2028'
											value={formTA.nama}
											onChange={(e) => setFormTA({ ...formTA, nama: e.target.value })}
											className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
											required
										/>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>Semester <span className='text-red-500'>*</span></label>
										<select
											value={formTA.semester}
											onChange={(e) => setFormTA({ ...formTA, semester: e.target.value })}
											className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
										>
											<option value='1'>Semester 1</option>
											<option value='2'>Semester 2</option>
										</select>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>Tanggal Mulai</label>
										<input type='date' value={formTA.tanggal_mulai} onChange={(e) => setFormTA({ ...formTA, tanggal_mulai: e.target.value })}
											className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
										/>
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>Tanggal Selesai</label>
										<input type='date' value={formTA.tanggal_selesai} onChange={(e) => setFormTA({ ...formTA, tanggal_selesai: e.target.value })}
											className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
										/>
									</div>
								</div>
								<div className='flex gap-2 mt-4'>
									<button type='submit' disabled={isSavingTA}
										className='bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors'>
										{isSavingTA ? 'Menyimpan...' : 'Simpan'}
									</button>
									<button type='button' onClick={() => setShowFormTA(false)}
										className='bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors'>
										Batal
									</button>
								</div>
							</form>
						)}

						{/* Daftar Tahun Ajar */}
						<div className='space-y-3'>
							{daftarTahunAjar.length === 0 ? (
								<div className='text-center text-gray-400 py-8'>Belum ada tahun ajar</div>
							) : (
								daftarTahunAjar.map((ta) => (
									<div key={ta.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${ta.is_aktif ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
										<div>
											<div className='flex items-center gap-2'>
												<span className='font-bold text-gray-800'>TA {ta.nama} — Semester {ta.semester}</span>
												{ta.is_aktif && (
													<span className='text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase'>Aktif</span>
												)}
											</div>
											{ta.tanggal_mulai && (
												<p className='text-xs text-gray-500 mt-0.5'>
													{new Date(ta.tanggal_mulai).toLocaleDateString('id-ID')} — {ta.tanggal_selesai ? new Date(ta.tanggal_selesai).toLocaleDateString('id-ID') : 'Belum diset'}
												</p>
											)}
										</div>
										{!ta.is_aktif && (
											<button
												onClick={() => handleSetAktif(ta.id, ta.nama, ta.semester)}
												disabled={isSettingAktif}
												className='text-xs font-semibold bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap'
											>
												Jadikan Aktif
											</button>
										)}
									</div>
								))
							)}
						</div>
					</div>
				)}

				{/* TAB: Promosi Kelas */}
				{activeTab === 'promosi-kelas' && userRole === 'Admin' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-2'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl'>🎓</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Promosi Kelas</h2>
								<p className='text-sm text-gray-500'>Naikkan kelas siswa ke tahun ajar berikutnya</p>
							</div>
						</div>

						{/* Mode Toggle */}
						<div className='flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit'>
							{['massal', 'individual'].map((mode) => (
								<button key={mode} onClick={() => setPromosiMode(mode)}
									className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${promosiMode === mode ? 'bg-white text-indigo-700 shadow' : 'text-gray-500 hover:text-indigo-600'}`}>
									{mode === 'massal' ? '🏫 Massal (Per Kelas)' : '👤 Individual (Per Siswa)'}
								</button>
							))}
						</div>

						{/* Mode Massal */}
						{promosiMode === 'massal' && (
							<div>
								<p className='text-sm text-gray-500 mb-4'>Isi kolom &quot;Ke Kelas&quot; untuk setiap kelas yang ingin dipromosikan. Kosongkan jika tidak diubah.</p>
								<div className='space-y-3 mb-6'>
									{promosiMassal.map((item, idx) => (
										<div key={idx} className='flex items-center gap-4'>
											<span className='font-semibold text-gray-700 w-24 shrink-0'>{item.dari_kelas}</span>
											<svg className='w-5 h-5 text-gray-400 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M14 5l7 7m0 0l-7 7m7-7H3' />
											</svg>
											<select
												value={item.ke_kelas}
												onChange={(e) => {
													const updated = [...promosiMassal];
													updated[idx].ke_kelas = e.target.value;
													setPromosiMassal(updated);
												}}
												className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
											>
												<option value=''>-- Tidak Diubah --</option>
												{kelasList.map((k) => <option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>{k.nama_kelas || k.kelas}</option>)}
												<option value='Lulus'>Lulus (Keluarkan dari sistem)</option>
											</select>
										</div>
									))}
								</div>
								<button onClick={handlePromosiMassal} disabled={isSavingPromosi}
									className='bg-violet-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors'>
									{isSavingPromosi ? 'Memproses...' : '🎓 Jalankan Promosi Massal'}
								</button>
							</div>
						)}

						{/* Mode Individual & Penjurusan */}
						{promosiMode === 'individual' && (
							<div className='space-y-6'>
								{/* Toolbar Penjurusan via Excel */}
								<div className='bg-gradient-to-br from-indigo-50 to-purple-50 p-4 sm:p-5 rounded-2xl border border-indigo-200'>
									<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4'>
										<div>
											<h3 className='font-bold text-indigo-900 flex items-center gap-2 text-base'>
												<span>📊</span> Plotting Penjurusan Cepat via Excel
											</h3>
											<p className='text-xs text-indigo-700 mt-0.5'>
												Gunakan untuk pengacakan/penjurusan siswa (misal: kelas 10 disebar ke 11-IPA, 11-IPS).
											</p>
										</div>
										<div className='flex flex-wrap items-center gap-2'>
											<button
												onClick={handleDownloadTemplatePenjurusan}
												className='flex items-center gap-1.5 px-3.5 py-2 bg-white text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-50 hover:border-indigo-400 transition-all'
												title='Download format Excel dengan daftar siswa terisi'
											>
												<svg className='w-4 h-4 text-indigo-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
													<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
												</svg>
												Download Template
											</button>
											<label className='flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition-all cursor-pointer'>
												<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
													<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' />
												</svg>
												<span>Upload File Excel (.xlsx)</span>
												<input
													type='file'
													accept='.xlsx, .xls'
													onChange={handleUploadExcelPenjurusan}
													className='hidden'
													disabled={isSavingPromosi}
												/>
											</label>
										</div>
									</div>
									<div className='text-[11px] text-indigo-600 bg-white/70 p-2.5 rounded-xl border border-indigo-100 flex items-start gap-2'>
										<span className='text-sm leading-none'>💡</span>
										<span><b>Format Excel:</b> Sistem mencocokkan siswa berdasarkan <b>NIS</b> atau <b>Nama Lengkap</b>, lalu mengarahkan ke kelas pada kolom <b>Kelas Baru</b> (misal: <code>11-IPA-1</code>, <code>11-IPS-2</code>, atau <code>Lulus</code>).</span>
									</div>
								</div>

								{/* Filter Bar: Kelas Asal & Search */}
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									<div>
										<label className='block text-xs font-bold text-gray-700 mb-1.5'>Filter Kelas Asal:</label>
										<select
											value={filterKelasAsal}
											onChange={(e) => setFilterKelasAsal(e.target.value)}
											className='w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'
										>
											<option value='all'>Semua Kelas Asal ({siswaList.length} siswa)</option>
											{kelasList.map((k) => {
												const count = siswaList.filter(s => s.kelas === (k.nama_kelas || k.kelas)).length;
												return (
													<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
														{k.nama_kelas || k.kelas} ({count} siswa)
													</option>
												);
											})}
										</select>
									</div>

									<div>
										<label className='block text-xs font-bold text-gray-700 mb-1.5'>Pencarian Nama / NIS:</label>
										<input
											type='text'
											placeholder='Ketik nama atau NIS...'
											value={searchSiswaPromosi}
											onChange={(e) => setSearchSiswaPromosi(e.target.value)}
											className='w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white'
										/>
									</div>
								</div>

								{/* Daftar Siswa */}
								<div className='border border-gray-200 rounded-2xl overflow-hidden'>
									<div className='bg-gray-100 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700'>
										<span>Nama Siswa & Kelas Asal</span>
										<span>Pilih Kelas / Jurusan Baru</span>
									</div>
									<div className='space-y-1 max-h-96 overflow-y-auto p-2 bg-white divide-y divide-gray-100'>
										{promosiIndividual
											.filter((s) => {
												const matchClass = filterKelasAsal === 'all' || s.kelas_lama === filterKelasAsal;
												const matchSearch = !searchSiswaPromosi || s.nama.toLowerCase().includes(searchSiswaPromosi.toLowerCase()) || (s.siswa_id && String(s.siswa_id).includes(searchSiswaPromosi));
												return matchClass && matchSearch;
											})
											.map((item) => {
												const origIdx = promosiIndividual.findIndex((p) => p.siswa_id === item.siswa_id);
												return (
													<div key={item.siswa_id} className='flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors'>
														<div className='flex-1 min-w-0'>
															<p className='font-bold text-sm text-gray-800 truncate'>{item.nama}</p>
															<div className='flex items-center gap-2 mt-0.5'>
																<span className='text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200'>
																	Asal: {item.kelas_lama}
																</span>
																{item.ke_kelas && item.ke_kelas !== item.kelas_lama && (
																	<span className='text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300'>
																		Target: {item.ke_kelas}
																	</span>
																)}
															</div>
														</div>
														<select
															value={item.ke_kelas}
															onChange={(e) => {
																const updated = [...promosiIndividual];
																updated[origIdx].ke_kelas = e.target.value;
																setPromosiIndividual(updated);
															}}
															className={`border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
																item.ke_kelas && item.ke_kelas !== item.kelas_lama
																	? 'border-emerald-400 bg-emerald-50 text-emerald-900 font-bold'
																	: 'border-gray-300 bg-white'
															}`}
														>
															<option value=''>-- Tidak Diubah --</option>
															{kelasList.map((k) => (
																<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
																	{k.nama_kelas || k.kelas}
																</option>
															))}
															<option value='Lulus'>Lulus</option>
															<option value='Pindah'>Pindah / Mutasi</option>
															<option value='Non-Aktif'>Non-Aktif</option>
														</select>
													</div>
												);
											})}

										{promosiIndividual.filter((s) => {
											const matchClass = filterKelasAsal === 'all' || s.kelas_lama === filterKelasAsal;
											const matchSearch = !searchSiswaPromosi || s.nama.toLowerCase().includes(searchSiswaPromosi.toLowerCase());
											return matchClass && matchSearch;
										}).length === 0 && (
											<div className='p-8 text-center text-gray-400 text-sm'>
												Tidak ada siswa yang sesuai filter
											</div>
										)}
									</div>
								</div>

								<div className='flex items-center justify-between gap-4 pt-2'>
									<p className='text-xs text-gray-500'>
										{promosiIndividual.filter(p => p.ke_kelas && p.ke_kelas !== p.kelas_lama).length} siswa siap dipromosikan/dipetakan
									</p>
									<button
										onClick={handlePromosiIndividual}
										disabled={isSavingPromosi || promosiIndividual.filter(p => p.ke_kelas && p.ke_kelas !== p.kelas_lama).length === 0}
										className='bg-violet-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-violet-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-2'
									>
										<span>💾</span>
										{isSavingPromosi ? 'Memproses...' : 'Simpan Pemetaan Individual'}
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{/* TAB: Navigasi */}
				{activeTab === 'navigasi' && userRole === 'Admin' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white'>
								<svg
									className='w-5 h-5'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M4 6h16M4 12h16M4 18h16'
									/>
								</svg>
							</div>
							<div>
								<h2 className='text-lg font-bold text-gray-800'>Navigasi Menu</h2>
								<p className='text-sm text-gray-500'>Akses cepat ke semua halaman</p>
							</div>
						</div>

						<div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
							{menuLinks.map((item, idx) => (
								<Link
									key={idx}
									href={item.route}
									className={`bg-gradient-to-br ${item.color} p-4 rounded-xl text-white flex items-center gap-3 hover:scale-105 transition-all duration-200 shadow hover:shadow-lg group`}>
									<div className='bg-white/20 rounded-lg p-2 group-hover:bg-white/30 transition-all'>
										<svg
											className='w-5 h-5'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d={item.icon}
											/>
										</svg>
									</div>
									<span className='font-semibold text-sm'>{item.label}</span>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* TAB: Tentang */}
				{activeTab === 'tentang' && (
					<div className='bg-white rounded-2xl shadow-xl border border-gray-100 p-6'>
						<div className='text-center mb-8'>
							<div className='inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4'>
								<svg
									className='w-10 h-10 text-white'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={1.5}
										d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
									/>
								</svg>
							</div>
							<h2 className='text-2xl font-bold text-gray-800'>GuruApp</h2>
							<p className='text-gray-500 text-sm mt-1'>Aplikasi manajemen kelas modern</p>
						</div>

						<div className='space-y-3'>
							{appInfo.map((info, idx) => (
								<div
									key={idx}
									className='flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0'>
									<span className='text-sm text-gray-500'>{info.label}</span>
									<span className='text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg'>{info.value}</span>
								</div>
							))}
						</div>

						<div className='mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100'>
							<p className='text-xs text-indigo-600 text-center'>Dibuat dengan ❤️ untuk memudahkan pengelolaan kelas dan administrasi guru</p>
						</div>

						{/* Tombol Install PWA */}
						<div className='mt-6'>
							{isInstalled ? (
								<div className='flex items-center justify-center gap-2 py-4 rounded-xl bg-green-50 border border-green-200'>
									<svg className='w-5 h-5 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
									</svg>
									<span className='text-sm font-semibold text-green-700'>Aplikasi Sudah Terinstal</span>
								</div>
							) : installPrompt ? (
								<button
									onClick={handleInstallApp}
									className='w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-3'
								>
									<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
									</svg>
									Instal Aplikasi ke Perangkat
								</button>
							) : (
								<div className='flex items-center justify-center gap-2 py-4 rounded-xl bg-gray-50 border border-gray-200'>
									<svg className='w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
									</svg>
									<span className='text-sm text-gray-500'>Install via menu browser (⋮ → Instal aplikasi)</span>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
