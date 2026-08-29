'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import ButtonBack from '../components/button/ButtonBack';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip, { ArchiveBanner } from '@/app/components/AcademicPeriodChip';

const DEFAULT_STATUS_LIST = [
	{ id: 'st_hadir', label: 'Hadir', kode: 'H', warna: 'green' },
	{ id: 'st_sakit', label: 'Sakit', kode: 'S', warna: 'yellow' },
	{ id: 'st_izin', label: 'Izin', kode: 'I', warna: 'blue' },
	{ id: 'st_alpha', label: 'Alpha', kode: 'A', warna: 'red' },
];

export default function AbsensiMapelPage() {
	const router = useRouter();
	const { tahunAjar, semester, tahunAjarAktif, semesterAktif, buildPeriodeQuery } = useAcademic();

	// --- State UI ---
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [statusList, setStatusList] = useState(DEFAULT_STATUS_LIST);
	const [siswaList, setSiswaList] = useState([]);

	// --- Filter State ---
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [jamKe, setJamKe] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	// --- Data State ---
	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [existingId, setExistingId] = useState(null);

	// MODE: 'input' (Form Input), 'edit' (Form Edit), 'rekap' (Tampilan Tabel Hasil)
	const [mode, setMode] = useState('input');

	// Helper status colors
	const getStatusClasses = (warna, active) => {
		const base = 'px-4 py-2 rounded-xl font-bold text-sm transition-all border-2 border-[#0D0D0D] flex items-center justify-center';
		if (active) {
			const activeStyle = 'translate-x-[2px] translate-y-[2px] shadow-none';
			switch (warna) {
				case 'green': return `${base} bg-[#00A693] text-white ${activeStyle}`;
				case 'yellow': return `${base} bg-[#F5C518] text-[#0D0D0D] ${activeStyle}`;
				case 'blue': return `${base} bg-[#2F80ED] text-white ${activeStyle}`;
				case 'red': return `${base} bg-[#E8451A] text-white ${activeStyle}`;
				default: return `${base} bg-[#0D0D0D] text-white ${activeStyle}`;
			}
		}
		return `${base} bg-white text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-[1px] hover:-translate-x-[1px]`;
	};

	// Helper Badge untuk Tabel Rekap
	const getBadgeRekap = (status) => {
		const s = statusList.find((sl) => sl.label === status);
		const warna = s ? s.warna : 'gray';

		const style = 'px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-block';
		switch (warna) {
			case 'green': return <span className={`${style} bg-[#00A693] text-white`}>HADIR</span>;
			case 'yellow': return <span className={`${style} bg-[#F5C518] text-[#0D0D0D]`}>SAKIT</span>;
			case 'blue': return <span className={`${style} bg-[#2F80ED] text-white`}>IZIN</span>;
			case 'red': return <span className={`${style} bg-[#E8451A] text-white`}>ALPHA</span>;
			default: return <span className={`${style} bg-gray-200 text-gray-700`}>{status || '-'}</span>;
		}
	};

	// 1. Fetch Master Data (Offline-First)
	useEffect(() => {
		const fetchAll = async () => {
			// A. Coba baca dari IndexedDB dulu untuk render cepat / offline
			try {
				const { getAll } = await import('@/lib/offlineDb');
				const [cachedKelas, cachedMapel, cachedSiswa, cachedPoin] = await Promise.all([
					getAll('kelas'),
					getAll('mapel'),
					getAll('siswa'),
					getAll('poin'),
				]);

				if (cachedKelas && cachedKelas.length > 0) {
					setKelasList(cachedKelas);
					setMapelList(cachedMapel || []);
					setStatusList(DEFAULT_STATUS_LIST);

					const poinMap = {};
					(cachedPoin || []).forEach((p) => {
						if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
						if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
						else if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
					});

					const siswaCached = (cachedSiswa || []).map((s) => ({
						...s,
						poinPositif: poinMap[s.id]?.positif || 0,
						poinNegatif: poinMap[s.id]?.negatif || 0,
					}));
					setSiswaList(siswaCached);

					if (cachedKelas.length > 0) setSelectedKelas(cachedKelas[0].kelas || cachedKelas[0].nama_kelas);
					if (cachedMapel && cachedMapel.length > 0) setSelectedMapel(cachedMapel[0].mapel || cachedMapel[0].nama_mapel);
					setLoading(false);
				}
			} catch (e) {
				console.warn('Error reading from IndexedDB:', e);
			}

			// B. Fetch fresh data jika online
			try {
				const [resKelas, resMapel, resStatus, resSiswa, resPoin] = await Promise.all([
					fetch('/api/kelas'),
					fetch('/api/mapel'),
					fetch('/api/status-absensi'),
					fetch('/api/siswa'),
					fetch(`/api/poin?${buildPeriodeQuery()}`),
				]);
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataPoin = resPoin.ok ? await resPoin.json() : [];

				if (Array.isArray(dataKelas) && dataKelas.length > 0) {
					const poinMap = {};
					dataPoin.forEach((p) => {
						if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
						if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
						else if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
					});

					const siswaDataUpdated = dataSiswa.map((s) => ({
						...s,
						poinPositif: poinMap[s.id]?.positif || 0,
						poinNegatif: poinMap[s.id]?.negatif || 0,
					}));

					setKelasList(dataKelas);
					setMapelList(dataMapel);
					if (dataStatus && dataStatus.length > 0) setStatusList(dataStatus);
					setSiswaList(siswaDataUpdated);

					if (!selectedKelas && dataKelas.length > 0) setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
					if (!selectedMapel && dataMapel.length > 0) setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);
				}
			} catch (err) {
				console.warn('Offline mode: Using cached master data for absensi');
			} finally {
				setLoading(false);
			}
		};
		fetchAll();
	}, []);

	const siswaKelasIni = useMemo(() => siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim()), [siswaList, selectedKelas]);

	const filteredSiswa = useMemo(() => {
		if (!searchQuery.trim()) return siswaKelasIni;
		const q = searchQuery.toLowerCase().trim();
		return siswaKelasIni.filter((s) =>
			(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
			(s.nis && String(s.nis).toLowerCase().includes(q))
		);
	}, [siswaKelasIni, searchQuery]);

	// 2. Check Absensi Mapel
	useEffect(() => {
		if (!selectedKelas || !selectedMapel || !tanggal || !jamKe || siswaKelasIni.length === 0) {
			return; // <-- HAPUS RESET! Biarkan state user tetap
		}

		const checkAbsensi = async () => {
			try {
				const params = new URLSearchParams({
					kelas: selectedKelas,
					mapel: selectedMapel,
					tanggal: tanggal,
					jam_ke: jamKe,
				});
				const res = await fetch(`/api/absensi-mapel?${params.toString()}&${buildPeriodeQuery()}`);

				if (res.ok) {
					const data = await res.json();

					if (data && data.length > 0) {
						// Load existing data
						const loadedAbsensi = {};
						data.forEach((item) => {
							loadedAbsensi[item.siswa_id] = {
								status: item.status,
								keterangan: item.keterangan || '', // Tambah keterangan jika ada di DB
							};
						});
						setAbsensi(loadedAbsensi);
						setMode('rekap');
						if (data[0]?.id_row) setExistingId(data[0].id_row);
					} else {
						// Cek Draft Lokal terlebih dahulu (Offline PWA feature)
						const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${jamKe}`;
						const savedDraft = localStorage.getItem(draftKey);

						if (savedDraft) {
							setAbsensi(JSON.parse(savedDraft));
							setMode('input');
							setExistingId(null);
						} else {
							// Data baru: INIT SAJA jika absensi kosong total (bukan reset)
							setAbsensi(prev => {
								const newAbsensi = { ...prev };
								siswaKelasIni.forEach((s) => {
									if (!newAbsensi[s.id]) {
										newAbsensi[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
									}
								});
								return newAbsensi;
							});
							setMode('input');
							setExistingId(null);
						}
					}
				}
			} catch (err) {
				console.error('Error checking absensi:', err);
			}
		};

		checkAbsensi();
	}, [selectedKelas, selectedMapel, tanggal, jamKe, siswaKelasIni, statusList, tahunAjar, semester]); // Tambah statusList ke deps

	const handleStatusChange = (siswaId, labelStatus) => {
		setAbsensi((prev) => {
			const updated = {
				...prev,
				[siswaId]: { ...(prev[siswaId] || { keterangan: '' }), status: labelStatus },
			};
			// Simpan draft lokal
			if (selectedKelas && selectedMapel && tanggal && jamKe) {
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${jamKe}`;
				localStorage.setItem(draftKey, JSON.stringify(updated));
			}
			return updated;
		});
	};

	const handleKeteranganChange = (siswaId, value) => {
		setAbsensi((prev) => {
			const updated = {
				...prev,
				[siswaId]: { ...(prev[siswaId] || { status: statusList[0]?.label || '' }), keterangan: value },
			};
			// Simpan draft lokal
			if (selectedKelas && selectedMapel && tanggal && jamKe) {
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${jamKe}`;
				localStorage.setItem(draftKey, JSON.stringify(updated));
			}
			return updated;
		});
	};

	const handleSimpan = async () => {
		let isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

		let currentJamKe = jamKe;
		let isDirectSave = false;

		if (!currentJamKe || currentJamKe.trim() === '') {
			const { value: inputJamKe } = await Swal.fire({
				title: 'Jam Belum Diisi',
				text: 'Masukkan Jam Ke (misal: 1-2) untuk menyimpan.',
				input: 'text',
				inputPlaceholder: 'Contoh: 1-2',
				showCancelButton: true,
				confirmButtonColor: '#4F46E5',
				cancelButtonColor: '#6B7280',
				confirmButtonText: 'Simpan Absensi',
				cancelButtonText: 'Batal',
				inputValidator: (value) => {
					if (!value || value.trim() === '') {
						return 'Jam Ke wajib diisi!';
					}
				}
			});

			if (inputJamKe) {
				currentJamKe = inputJamKe;
				setJamKe(currentJamKe);
				isDirectSave = true;
			} else {
				return;
			}
		}

		const hasAbsensiData = siswaKelasIni.some((s) => absensi[s.id]);
		if (!hasAbsensiData) {
			Swal.fire('Error', 'Belum ada data absensi siswa', 'error');
			return;
		}

		if (siswaKelasIni.length === 0) return;

		if (!isDirectSave) {
			const result = await Swal.fire({
				title: 'Simpan Absensi Mapel?',
				text: `Simpan data ${selectedMapel} jam ke-${currentJamKe}?`,
				icon: 'question',
				showCancelButton: true,
				confirmButtonColor: '#4F46E5',
				cancelButtonColor: '#6B7280',
				confirmButtonText: 'Ya, Simpan',
				cancelButtonText: 'Batal',
			});

			if (!result.isConfirmed) return;
		}

		setSaving(true);

		const dataToSave = siswaKelasIni.map((s) => ({
			siswa_id: s.id,
			status: absensi[s.id]?.status || 'Hadir',
			keterangan: absensi[s.id]?.keterangan || '',
		}));

		const payload = {
			id: existingId,
			tanggal,
			kelas: selectedKelas,
			mapel: selectedMapel,
			jam_ke: currentJamKe,
			data: dataToSave,
			tahun_ajar: tahunAjarAktif,
			semester: semesterAktif,
		};

		try {
			if (isOffline) {
				const { enqueueAction } = await import('@/lib/syncEngine');
				await enqueueAction({
					type: 'ABSENSI_MAPEL',
					endpoint: '/api/absensi-mapel',
					method: 'POST',
					payload,
					description: `Absensi ${selectedMapel} - ${selectedKelas} (Jam ${currentJamKe})`,
				});

				// Bersihkan draft lokal
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${currentJamKe}`;
				localStorage.removeItem(draftKey);

				await Swal.fire({
					icon: 'success',
					title: 'Tersimpan di Perangkat!',
					text: 'Data absensi mapel tersimpan offline dan akan otomatis disinkronkan ke server saat internet terhubung.',
					confirmButtonColor: '#00A693',
				});

				setMode('rekap');
			} else {
				const res = await fetch('/api/absensi-mapel', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				if (res.ok) {
					const responseData = await res.json();
					const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${currentJamKe}`;
					localStorage.removeItem(draftKey);

					await Swal.fire({
						icon: 'success',
						title: 'Berhasil!',
						text: 'Data absensi mapel tersimpan.',
						timer: 1500,
						showConfirmButton: false,
					});

					setMode('rekap');
					if (!existingId && responseData.id) setExistingId(responseData.id);
				} else {
					throw new Error('Gagal menyimpan di server');
				}
			}
		} catch (error) {
			console.warn('Simpan server gagal, beralih ke antrean offline:', error);
			try {
				const { enqueueAction } = await import('@/lib/syncEngine');
				await enqueueAction({
					type: 'ABSENSI_MAPEL',
					endpoint: '/api/absensi-mapel',
					method: 'POST',
					payload,
					description: `Absensi ${selectedMapel} - ${selectedKelas} (Jam ${currentJamKe})`,
				});
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${currentJamKe}`;
				localStorage.removeItem(draftKey);

				await Swal.fire({
					icon: 'info',
					title: 'Tersimpan Offline!',
					text: 'Koneksi terganggu. Data absensi aman di perangkat dan akan disinkronkan saat terhubung kembali.',
					confirmButtonColor: '#00A693',
				});
				setMode('rekap');
			} catch (enqueueErr) {
				Swal.fire('Error', 'Gagal menyimpan data', 'error');
			}
		} finally {
			setSaving(false);
		}
	};

	const handleHapus = async () => {
		const result = await Swal.fire({
			title: 'Hapus Absensi?',
			text: `Yakin ingin menghapus data absensi ${selectedMapel} kelas ${selectedKelas} jam ke-${jamKe}?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setLoading(true);
			const params = new URLSearchParams({
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal: tanggal,
				jam_ke: jamKe,
			});
			const res = await fetch(`/api/absensi-mapel?${params.toString()}`, {
				method: 'DELETE',
			});

			if (res.ok) {
				await Swal.fire('Terhapus!', 'Data absensi telah dihapus.', 'success');
				// Reset data
				const init = {};
				siswaKelasIni.forEach((s) => {
					init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
				});
				setAbsensi(init);
				setExistingId(null);
				setMode('input');
			} else {
				throw new Error('Gagal menghapus data');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal menghapus data absensi', 'error');
		} finally {
			setLoading(false);
		}
	};

	const goToRiwayat = () => {
		const kelasObj = kelasList.find(k => k.kelas === selectedKelas || k.nama_kelas === selectedKelas);
		if (kelasObj && kelasObj.id) {
			router.push(`/kelas/${kelasObj.id}/riwayat-absensi-mapel`);
		} else {
			Swal.fire('Info', 'Gagal menemukan ID Kelas untuk melihat riwayat', 'info');
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[var(--background)] pb-32 font-sans'>
			{/* --- Header & Filters --- */}
			<div className='bg-white border-b-4 border-[#0D0D0D] shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]'>
				<div className='max-w-5xl mx-auto px-4 py-4 space-y-4'>
					<ButtonBack />
					{/* Title Row */}
					<div className='flex justify-between items-center'>
						<div>
							<div className='flex items-center gap-3'>
								<h1 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-tight'>Absensi Mapel</h1>
								<AcademicPeriodChip />
							</div>
							<div className='flex items-center gap-2 mt-2'>
								{mode === 'rekap' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#2F80ED] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Data Tersimpan (Rekap)</span>
								) : mode === 'edit' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>Mode Edit</span>
								) : (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Input Baru</span>
								)}
							</div>
						</div>
						<button
							onClick={() => router.push('/laporan')}
							className='neo-btn-outline flex items-center gap-2 bg-[#F5C518] hover:bg-[#E8451A] hover:text-white'>
							<span className='text-xl'>📅</span> <span className='hidden sm:inline'>Rekap Bulanan</span>
						</button>
					</div>

					{/* Filter Grid */}
					<div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
						{/* Kelas */}
						<div className='relative'>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								disabled={mode === 'edit'} // Kunci saat edit
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{kelasList.map((k, idx) => (
									<option
										key={k.id || k.kelas || k.nama_kelas || `kelas_${idx}`}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Mapel */}
						<div className='relative'>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								disabled={mode === 'edit'}
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{mapelList.map((m, idx) => (
									<option
										key={m.id || m.mapel || m.nama_mapel || `mapel_${idx}`}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Tanggal */}
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							disabled={mode === 'edit'}
							className='neo-input bg-white disabled:bg-gray-200 disabled:cursor-not-allowed'
						/>

						{/* Jam Ke */}
						<input
							type='text'
							placeholder='Jam (mis: 1-2)'
							value={jamKe}
							onChange={(e) => setJamKe(e.target.value)}
							disabled={mode === 'edit'}
							className={`neo-input text-center disabled:bg-gray-200 disabled:cursor-not-allowed ${
								!jamKe ? 'border-[#E8451A] bg-[#FFF5F0]' : 'bg-white'
							}`}
						/>
					</div>
				</div>
			</div>

			{/* Archive Banner */}
			<ArchiveBanner />

			{/* --- MAIN CONTENT --- */}
			<div className='max-w-5xl mx-auto px-4 py-6'>
				{/* 1. STATE KOSONG */}
				{siswaKelasIni.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-20'>
						<div className='text-6xl mb-4 drop-shadow-[4px_4px_0px_#0D0D0D]'>🎓</div>
						<p className='text-[#0D0D0D] font-bold text-xl border-2 border-[#0D0D0D] px-6 py-3 rounded-xl bg-white shadow-[4px_4px_0px_0px_#0D0D0D]'>Tidak ada siswa di kelas ini</p>
					</div>
				) : (
					<>
						{/* Search Bar */}
						<div className='mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border-2 border-[#0D0D0D] rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
							<div className='relative flex-1'>
								<div className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500'>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
									</svg>
								</div>
								<input
									type='text'
									placeholder='Cari nama atau NIS siswa...'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='w-full pl-10 pr-10 py-2 bg-transparent text-[#0D0D0D] font-bold text-sm outline-none placeholder:text-gray-400'
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className='absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-black font-black text-sm'
										title='Hapus pencarian'>
										✕
									</button>
								)}
							</div>
							<div className='text-xs font-bold text-[#0D0D0D] bg-[#FFF5F0] border-2 border-[#0D0D0D] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 text-center sm:text-left'>
								{searchQuery.trim() ? (
									<span>Menampilkan <b>{filteredSiswa.length}</b> dari {siswaKelasIni.length} siswa</span>
								) : (
									<span>Total: <b>{siswaKelasIni.length}</b> siswa</span>
								)}
							</div>
						</div>

						{filteredSiswa.length === 0 ? (
							<div className='bg-white border-2 border-[#0D0D0D] rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] p-8 text-center my-4'>
								<div className='text-4xl mb-2'>🔍</div>
								<p className='font-bold text-[#0D0D0D] text-base'>Tidak ada siswa yang cocok dengan &quot;{searchQuery}&quot;</p>
								<button
									onClick={() => setSearchQuery('')}
									className='mt-3 neo-btn-outline bg-[#F5C518] text-[#0D0D0D] text-xs py-1.5 px-4 rounded-xl font-bold'>
									Reset Pencarian
								</button>
							</div>
						) : mode === 'rekap' ? (
							/* 2. MODE REKAPITULASI (Tabel Read Only) */
							<div className='neo-card p-0 overflow-hidden'>
								<div className='px-6 py-5 border-b-4 border-[#0D0D0D] flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 bg-[#F5C518]'>
									<div>
										<h2 className='font-black text-[#0D0D0D] text-xl uppercase tracking-tight'>Rekapitulasi Kehadiran</h2>
										<p className='text-sm font-bold text-[#0D0D0D]'>
											{selectedKelas} • {selectedMapel} • Jam ke-{jamKe}
										</p>
									</div>
									<div className='flex flex-wrap gap-3'>
										<button
											onClick={handleHapus}
											className='neo-btn-outline bg-[#E8451A] text-white hover:bg-white hover:text-[#E8451A] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
											<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
											<span className='hidden sm:inline'>Hapus</span>
										</button>
										<button
											onClick={goToRiwayat}
											className='neo-btn-outline bg-[#2F80ED] text-white hover:bg-white hover:text-[#2F80ED] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
											<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/></svg>
											<span className='hidden sm:inline'>Riwayat</span>
										</button>
										<button
											onClick={() => setMode('edit')}
											className='neo-btn-outline bg-[#00A693] text-white hover:bg-white hover:text-[#00A693] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
											<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'/></svg>
											<span className='hidden sm:inline'>Edit</span>
										</button>
									</div>
								</div>

								<div className='overflow-x-auto'>
									<table className='w-full'>
										<thead className='bg-[#0D0D0D] text-white text-xs uppercase tracking-wider font-bold border-b-4 border-[#0D0D0D]'>
											<tr>
												<th className='px-6 py-4 text-left w-16 border-r-2 border-[#0D0D0D]'>No</th>
												<th className='px-6 py-4 text-left border-r-2 border-[#0D0D0D]'>Nama Siswa</th>
												<th className='px-6 py-4 text-center w-32 border-r-2 border-[#0D0D0D]'>Status</th>
												<th className='px-6 py-4 text-left w-1/3'>Keterangan</th>
											</tr>
										</thead>
										<tbody className='divide-y-2 divide-[#0D0D0D] bg-white'>
											{filteredSiswa.map((siswa, idx) => {
												const status = absensi[siswa.id]?.status || '-';
												const ket = absensi[siswa.id]?.keterangan || '-';
												return (
													<tr
														key={siswa.id || `siswa_row_${idx}`}
														className='hover:bg-[#FFF5F0] transition-colors'>
														<td className='px-6 py-4 font-bold text-[#0D0D0D] border-r-2 border-[#0D0D0D]'>{idx + 1}</td>
														<td className='px-6 py-4 border-r-2 border-[#0D0D0D]'>
															<p className='font-bold text-[#0D0D0D] text-base'>
																{siswa.nama_lengkap}
																{siswa.status !== 'Aktif' && (
																	<span className='ml-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'>
																		{siswa.status}
																	</span>
																)}
															</p>
															<p className='text-sm text-gray-600 font-mono font-bold mt-1'>{siswa.nis}</p>
														</td>
														<td className='px-6 py-4 text-center border-r-2 border-[#0D0D0D]'>{getBadgeRekap(status)}</td>
														<td className='px-6 py-4 text-sm font-semibold text-[#0D0D0D]'>{ket !== '-' ? ket : <span className='text-gray-400 italic'>Tidak ada keterangan</span>}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						) : (
							/* 3. MODE INPUT / EDIT (Card UI) */
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
								{filteredSiswa.map((siswa, idx) => {
									const currentStatus = absensi[siswa.id]?.status || 'Hadir';

									return (
										<div
											key={siswa.id || `siswa_card_${idx}`}
											className='neo-card flex flex-col gap-3 relative'>
											<div className='flex justify-between items-start mb-1'>
												<div className='pr-8'>
													<div className='flex flex-wrap items-center gap-2 mb-1'>
														<h3 className='font-bold text-[#0D0D0D] line-clamp-1 text-lg uppercase tracking-tight'>
															{siswa.nama_lengkap}
															{siswa.status !== 'Aktif' && (
																<span className='ml-2 inline-flex items-center text-[10px] font-black uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] align-middle'>
																	{siswa.status}
																</span>
															)}
														</h3>
														<div className='flex gap-1 shrink-0'>
															{siswa.poinPositif > 0 && (
																<span
																	className='text-[10px] font-bold text-white bg-[#00A693] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
																	title='Poin +'>
																	+{siswa.poinPositif}
																</span>
															)}
															{siswa.poinNegatif > 0 && (
																<span
																	className='text-[10px] font-bold text-white bg-[#E8451A] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
																	title='Pelanggaran -'>
																	-{siswa.poinNegatif}
																</span>
															)}
														</div>
													</div>
													<p className='text-xs text-[#0D0D0D] font-mono font-bold'>{siswa.nis || '-'}</p>
												</div>
												<span className='absolute top-4 right-4 text-sm font-black text-[#0D0D0D] border-2 border-[#0D0D0D] w-8 h-8 flex items-center justify-center rounded-full bg-[#F5C518] shadow-[2px_2px_0px_0px_#0D0D0D]'>
													{idx + 1}
												</span>
											</div>

											<div className='grid grid-cols-4 gap-2 my-2'>
												{statusList.map((st, stIdx) => {
													const isActive = currentStatus === st.label;
													return (
														<button
															key={st.id || st.label || st.kode || `st_${stIdx}`}
															onClick={() => handleStatusChange(siswa.id, st.label)}
															disabled={siswa.status !== 'Aktif'}
															className={`${getStatusClasses(st.warna, isActive)} ${siswa.status !== 'Aktif' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
															{st.kode || st.label.substring(0, 1)}
														</button>
													);
												})}
											</div>

											<div className='relative'>
												<input
													type='text'
													placeholder='Keterangan...'
													value={absensi[siswa.id]?.keterangan || ''}
													onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
													disabled={siswa.status !== 'Aktif'}
													className='neo-input text-sm disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed'
												/>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>

			{/* --- Floating Save Button (Hanya Muncul di Mode Input/Edit) --- */}
			{siswaKelasIni.length > 0 && mode !== 'rekap' && (
				<div className='fixed bottom-0 left-0 right-0 p-4 bg-[#FFF5F0] border-t-4 border-[#0D0D0D] z-30 flex justify-end shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]'>
					<button
						onClick={handleSimpan}
						disabled={saving}
						className='w-full md:w-auto neo-btn-primary bg-[#0D0D0D] text-white py-3 px-10 text-lg uppercase tracking-wider flex items-center justify-center gap-2'>
						{saving ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			)}
		</div>
	);
}
