'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';

export default function LaporanPage() {
	const params = useParams();
	const router = useRouter();
	const { id } = params;

	// State Data
	const [kelasInfo, setKelasInfo] = useState(null);
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [nilaiList, setNilaiList] = useState([]);

	// Hak Akses & User State
	const [authLoading, setAuthLoading] = useState(true);
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [authError, setAuthError] = useState(null);
	const [currentUser, setCurrentUser] = useState(null);
	const [isWaliKelas, setIsWaliKelas] = useState(false);

	// State UI/Filter
	const [selectedMapel, setSelectedMapel] = useState('');
	const [loading, setLoading] = useState(true);

	// State Settings Weights
	const [calcMethod, setCalcMethod] = useState('persentase'); // 'persentase' | 'sederhana'
	const [bobot, setBobot] = useState({
		harian: 50,
		sumatif: 25,
		uas: 25,
	});

	// State Conversion
	const [convertConfig, setConvertConfig] = useState({
		useConversion: false,
		ncMin: 0,
		ncMax: 100,
		nhMin: 75,
		nhMax: 95,
	});

	// --- 1. Fetch Data Initial with Authorization Check ---
	useEffect(() => {
		if (!id) return;

		const init = async () => {
			setAuthLoading(true);
			setAuthError(null);
			try {
				const supabase = createClient();

				// 1. Dapatkan user session
				const resAuth = await fetch('/api/auth/me');
				if (!resAuth.ok) {
					setAuthError('Sesi login telah berakhir. Silakan login kembali.');
					setIsAuthorized(false);
					setAuthLoading(false);
					setLoading(false);
					return;
				}
				const authData = await resAuth.json();
				const user = authData?.user;
				if (!user) {
					setAuthError('Pengguna tidak terautentikasi.');
					setIsAuthorized(false);
					setAuthLoading(false);
					setLoading(false);
					return;
				}
				setCurrentUser(user);
				
				// 2. Fetch Kelas
				const { data: k, error: errK } = await supabase.from('kelas').select('*').eq('id', id).single();
				if (errK || !k) {
					setAuthError('Data kelas tidak ditemukan.');
					setIsAuthorized(false);
					setAuthLoading(false);
					setLoading(false);
					return;
				}
				setKelasInfo(k);

				const namaKelas = k.kelas || k.nama_kelas;
				const role = user.role;
				const userId = user.id;

				const isPrivileged = role === 'Admin' || role === 'Kepala Sekolah' || role === 'Kurikulum' || role === 'Kesiswaan';
				const isHomeroom = (k.id_wali_kelas && k.id_wali_kelas === userId) || (k.wali_kelas && k.wali_kelas === user.nama_lengkap);

				setIsWaliKelas(Boolean(isHomeroom));

				let allowedMapels = [];

				if (isPrivileged || isHomeroom) {
					// Privileged atau Wali Kelas: dapat melihat seluruh mapel di kelas ini
					setIsAuthorized(true);
					const { data: kbmData } = await supabase
						.from('guru_kbm')
						.select('mapel')
						.eq('kelas', namaKelas);

					const kbmMapels = kbmData ? [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))] : [];
					if (kbmMapels.length > 0) {
						allowedMapels = kbmMapels;
					} else {
						const { data: allMapels } = await supabase.from('mapel').select('mapel').order('mapel');
						allowedMapels = (allMapels || []).map((m) => m.mapel);
					}
				} else if (role === 'Guru') {
					// Guru mapel biasa: HANYA berhak jika mengajar di kelas ini
					const { data: kbmData } = await supabase
						.from('guru_kbm')
						.select('mapel')
						.eq('kelas', namaKelas)
						.eq('id_user', userId);

					const teacherMapels = kbmData ? [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))] : [];

					if (teacherMapels.length > 0) {
						setIsAuthorized(true);
						allowedMapels = teacherMapels;
					} else {
						// Guru tidak mengajar di kelas ini dan bukan wali kelas -> AKSES DITOLAK
						setIsAuthorized(false);
						setAuthError('Akses Ditolak: Anda bukan wali kelas ataupun guru mata pelajaran di kelas ini.');
						setAuthLoading(false);
						setLoading(false);
						return;
					}
				} else {
					setIsAuthorized(false);
					setAuthError('Akses Ditolak: Role Anda tidak diizinkan mengakses laporan ini.');
					setAuthLoading(false);
					setLoading(false);
					return;
				}

				const mapelObjects = allowedMapels.map((m) => ({ id: m, mapel: m }));
				setMapelList(mapelObjects);
				if (mapelObjects.length > 0) {
					setSelectedMapel(mapelObjects[0].mapel);
				}

				// Fetch Poin Siswa di Kelas Ini
				let poinMap = {};
				const { data: dataPoin } = await supabase.from('poin_siswa').select('*').eq('kelas', namaKelas);
				(dataPoin || []).forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				// Fetch Siswa Aktif di Kelas Ini
				const { data: dataSiswa } = await supabase.from('siswa').select('*').eq('kelas', namaKelas).eq('status', 'Aktif');
				const siswaKelas = (dataSiswa || []).map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));
				setSiswaList(siswaKelas);
			} catch (err) {
				console.error('Error init laporan nilai:', err);
				setAuthError(err.message);
				setIsAuthorized(false);
			} finally {
				setAuthLoading(false);
				setLoading(false);
			}
		};

		init();
	}, [id]);

	// --- 2. Fetch Nilai when Mapel changes ---
	useEffect(() => {
		if (!kelasInfo || !selectedMapel || !isAuthorized) {
			setNilaiList([]);
			return;
		}

		const fetchNilai = async () => {
			setLoading(true);
			try {
				const namaKelas = kelasInfo.kelas || kelasInfo.nama_kelas;
				
				// Validasi ekstra: guru biasa tidak boleh mengambil mapel di luar wewenangnya
				if (currentUser?.role === 'Guru' && !isWaliKelas) {
					const allowed = mapelList.map((m) => m.mapel);
					if (!allowed.includes(selectedMapel)) {
						setNilaiList([]);
						setLoading(false);
						return;
					}
				}

				const supabase = createClient();
				let query = supabase.from('nilai_siswa').select(`
					id,
					tugas_id,
					siswa_id,
					nama_siswa,
					nilai,
					nilai_tugas!inner (
						guru_id,
						kategori,
						type,
						deskripsi,
						kelas,
						mapel,
						tanggal
					)
				`).eq('nilai_tugas.kelas', namaKelas).eq('nilai_tugas.mapel', selectedMapel);

				// Guru mapel biasa hanya dapat melihat tugas yang ia buat sendiri
				if (currentUser?.role === 'Guru' && !isWaliKelas && currentUser?.id) {
					query = query.eq('nilai_tugas.guru_id', currentUser.id);
				}

				const { data: rawData, error } = await query;
				if (error) throw error;

				const formattedData = (rawData || []).map((row) => ({
					id: row.id + '_' + row.siswa_id,
					guru_id: row.nilai_tugas.guru_id || '',
					siswa_id: row.siswa_id,
					nama_siswa: row.nama_siswa,
					kelas: row.nilai_tugas.kelas,
					mapel: row.nilai_tugas.mapel,
					kategori: row.nilai_tugas.kategori,
					type: row.nilai_tugas.type || '',
					deskripsi: row.nilai_tugas.deskripsi || '',
					nilai: row.nilai,
					tanggal: row.nilai_tugas.tanggal,
					tugas_id: row.tugas_id,
				}));

				setNilaiList(formattedData);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		fetchNilai();
	}, [kelasInfo, selectedMapel, isAuthorized, currentUser, isWaliKelas, mapelList]);

	// --- 3. Calculation Logic ---

	// Categorize Assignments
	const assignments = useMemo(() => {
		const groups = {};
		nilaiList.forEach((n) => {
			if (!groups[n.tugas_id]) {
				groups[n.tugas_id] = {
					id: n.tugas_id,
					title: n.kategori || 'Tanpa Judul',
					date: n.tanggal,
					scores: [], // { siswa_id, nilai }
					type: 'harian', // default
				};
				// Priority 1: Strict match based on 'type' from DB
				const typeLower = (n.type || '').toLowerCase();
				const titleLower = (n.kategori || '').toLowerCase();
				
				if (typeLower === 'sas' || typeLower === 'uas' || typeLower === 'pas') {
					groups[n.tugas_id].type = 'uas';
				} else if (typeLower === 'sumatif' || typeLower === 'pts' || typeLower === 'uts' || typeLower === 'sts') {
					groups[n.tugas_id].type = 'sumatif';
				} else if (typeLower === 'formatif' || typeLower === 'harian' || typeLower === 'tugas' || typeLower === 'kuis') {
					groups[n.tugas_id].type = 'harian';
				} else {
					// Fallback to title inspection
					if (titleLower.includes('sas') || titleLower.includes('uas') || titleLower.includes('akhir semester') || titleLower.includes('pas')) {
						groups[n.tugas_id].type = 'uas';
					} else if (titleLower.includes('sumatif') || titleLower.includes('pts') || titleLower.includes('uts') || titleLower.includes('tengah semester')) {
						groups[n.tugas_id].type = 'sumatif';
					} else {
						groups[n.tugas_id].type = 'harian';
					}
				}
			}
			groups[n.tugas_id].scores.push({
				siswa_id: n.siswa_id,
				nilai: n.nilai,
			});
		});

		const list = Object.values(groups);
		return {
			harian: list.filter((a) => a.type === 'harian'),
			sumatif: list.filter((a) => a.type === 'sumatif'),
			uas: list.filter((a) => a.type === 'uas'),
			all: list,
		};
	}, [nilaiList]);

	// Calculate Average per Category for each Student
	const studentGrades = useMemo(() => {
		return siswaList.map((siswa) => {
			// Helper to calc avg
			const getAvg = (assignList) => {
				if (!assignList || assignList.length === 0) return null;
				let total = 0;
				let count = 0;
				assignList.forEach((a) => {
					const scoreObj = a.scores.find((s) => s.siswa_id === siswa.id);
					if (scoreObj && scoreObj.nilai !== null && scoreObj.nilai !== undefined) {
						total += Number(scoreObj.nilai);
						count++;
					}
				});
				return count > 0 ? total / count : null;
			};

			const nilaiHarian = getAvg(assignments.harian);
			const nilaiSumatif = getAvg(assignments.sumatif);
			const nilaiUAS = getAvg(assignments.uas);

			// Final Score Calculation
			let finalOrig = 0;
			if (calcMethod === 'sederhana') {
				let totalScore = 0;
				let totalCount = 0;
				if (nilaiHarian !== null) { totalScore += nilaiHarian; totalCount++; }
				if (nilaiSumatif !== null) { totalScore += nilaiSumatif; totalCount++; }
				if (nilaiUAS !== null) { totalScore += nilaiUAS; totalCount++; }
				finalOrig = totalCount > 0 ? totalScore / totalCount : 0;
			} else {
				// Weighted Percentage
				finalOrig = ((nilaiHarian || 0) * bobot.harian + (nilaiSumatif || 0) * bobot.sumatif + (nilaiUAS || 0) * bobot.uas) / 100;
			}

			// Conversion
			let finalConvert = finalOrig;
			if (convertConfig.useConversion) {
				const { ncMin, ncMax, nhMin, nhMax } = convertConfig;
				if (ncMax - ncMin !== 0) {
					finalConvert = nhMin + ((finalOrig - ncMin) / (ncMax - ncMin)) * (nhMax - nhMin);
				}
			}

			return {
				...siswa,
				harian: nilaiHarian,
				sumatif: nilaiSumatif,
				uas: nilaiUAS,
				finalOrig,
				finalConvert,
			};
		});
	}, [siswaList, assignments, bobot, convertConfig, calcMethod]);

	// --- 3.5 Kalkulasi Nilai Aktual Min & Max ---
	const actualStats = useMemo(() => {
		if (!studentGrades || studentGrades.length === 0) return { min: 0, max: 100 };

		const scores = studentGrades.map((s) => s.finalOrig);
		const min = Math.min(...scores);
		const max = Math.max(...scores);

		return {
			min: Number.isFinite(min) ? parseFloat(min.toFixed(2)) : 0,
			max: Number.isFinite(max) ? parseFloat(max.toFixed(2)) : 100,
		};
	}, [studentGrades]);

	// --- Handlers ---
	const toggleConversion = () => {
		setConvertConfig((prev) => ({ ...prev, useConversion: !prev.useConversion }));
	};

	const handleDownloadExcel = () => {
		if (!studentGrades || studentGrades.length === 0) {
			Swal.fire('Info', 'Tidak ada data untuk diunduh', 'info');
			return;
		}

		// Prepare data for Excel
		const dataToExport = studentGrades.map((siswa, index) => {
			const row = {
				No: index + 1,
				Nama: siswa.nama_lengkap,
				NIS: siswa.nis,
				'Total Pt (+)': siswa.poinPositif || 0,
				'Total Pt (-)': siswa.poinNegatif || 0,
				'Formatif': siswa.harian !== null && !isNaN(siswa.harian) ? parseFloat(siswa.harian.toFixed(1)) : '-',
				'Sumatif': siswa.sumatif !== null && !isNaN(siswa.sumatif) ? parseFloat(siswa.sumatif.toFixed(1)) : '-',
				'SAS': siswa.uas !== null && !isNaN(siswa.uas) ? parseFloat(siswa.uas.toFixed(1)) : '-',
				'Nilai Akhir': parseFloat((siswa.finalOrig || 0).toFixed(2)),
			};

			if (convertConfig.useConversion) {
				row['Nilai Konversi'] = parseFloat((siswa.finalConvert || 0).toFixed(2));
			}

			return row;
		});

		// Create worksheet
		const ws = XLSX.utils.json_to_sheet(dataToExport);

		// Set column widths
		const wscols = [
			{ wch: 5 }, // No
			{ wch: 30 }, // Nama
			{ wch: 15 }, // NIS
			{ wch: 10 }, // Pt +
			{ wch: 10 }, // Pt -
			{ wch: 12 }, // Formatif
			{ wch: 12 }, // Sumatif
			{ wch: 12 }, // SAS
			{ wch: 12 }, // Akhir
		];
		if (convertConfig.useConversion) {
			wscols.push({ wch: 15 }); // Konversi
		}
		ws['!cols'] = wscols;

		// Create workbook
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Laporan Nilai');

		// Generate filename
		const namaKelas = kelasInfo?.kelas || kelasInfo?.nama_kelas || 'Kelas';
		const mapel = selectedMapel || 'Mapel';
		const sanitizedName = `Laporan_Nilai_${namaKelas}_${mapel}`.replace(/[^a-z0-9]/gi, '_');
		const fileName = `${sanitizedName}.xlsx`;

		// Save file
		XLSX.writeFile(wb, fileName);
	};

	// 1. Loading State
	if (authLoading) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] flex flex-col items-center justify-center p-4 font-sans'>
				<div className='bg-white border-[4px] border-[#0D0D0D] p-8 shadow-[8px_8px_0px_0px_#0D0D0D] text-center max-w-md w-full'>
					<div className='w-12 h-12 border-[4px] border-[#0D0D0D] border-t-transparent rounded-full animate-spin mx-auto mb-4 bg-[#F5C518]'></div>
					<p className='font-black uppercase tracking-wider text-lg text-[#0D0D0D]'>Memeriksa Hak Akses...</p>
				</div>
			</div>
		);
	}

	// 2. Access Denied State
	if (!isAuthorized) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] flex flex-col items-center justify-center p-4 font-sans'>
				<div className='bg-white border-[4px] border-[#0D0D0D] p-8 md:p-10 shadow-[10px_10px_0px_0px_#0D0D0D] text-center max-w-lg w-full relative'>
					<div className='bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] font-black uppercase text-xs px-3 py-1 inline-block mb-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						AKSES DITOLAK
					</div>
					<div className='text-6xl mb-4'>🚫</div>
					<h2 className='text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0D0D0D] mb-3'>
						HAK AKSES DIBATASI
					</h2>
					<p className='text-sm font-bold text-gray-700 uppercase mb-8 leading-relaxed'>
						{authError || 'Anda tidak memiliki hak akses untuk melihat data kelas ini karena Anda bukan wali kelas ataupun guru mata pelajaran di kelas ini.'}
					</p>
					<div className='flex flex-col sm:flex-row gap-3 justify-center'>
						<button
							onClick={() => router.push('/kelas')}
							className='bg-[#F5C518] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black uppercase px-6 py-3 shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all'>
							Daftar Kelas
						</button>
						<button
							onClick={() => router.push('/dashboard')}
							className='bg-white text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black uppercase px-6 py-3 shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all'>
							Dashboard
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			<div className='bg-[#00A693] border-b-[4px] border-[#0D0D0D] p-4 sm:p-6 flex items-center justify-between sticky top-0 z-50'>
				<div className='flex items-center gap-4'>
					<button onClick={() => window.history.back()} className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
					</button>
					<div>
						<h1 className='text-xl sm:text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>LAPORAN PENILAIAN</h1>
						<div className='flex flex-wrap items-center gap-2 mt-1'>
							<span className='bg-[#F5C518] text-[#0D0D0D] font-black text-xs px-2 py-0.5 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase'>
								KELAS {kelasInfo?.kelas || kelasInfo?.nama_kelas || '-'}
							</span>
							{isWaliKelas && (
								<span className='bg-white text-[#0D0D0D] font-black text-xs px-2 py-0.5 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase'>
									WALI KELAS
								</span>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className='max-w-7xl mx-auto px-4 sm:px-8 pt-10 space-y-10 relative z-10'>
				{/* 1. Filter / Selector */}
				<div className='bg-[#FF90E8] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-4 bg-white inline-block px-3 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2'>FILTER LAPORAN</div>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>MATA PELAJARAN</label>
							<div className='relative'>
								<select
									value={selectedMapel}
									onChange={(e) => setSelectedMapel(e.target.value)}
									className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none appearance-none cursor-pointer uppercase transition-all'>
									<option value=''>-- PILIH MAPEL --</option>
									{mapelList.map((m) => (
										<option
											key={m.id}
											value={m.mapel}>
											{m.mapel}
										</option>
									))}
								</select>
								<div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none'>
									<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor' className='w-5 h-5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5' />
									</svg>
								</div>
							</div>
						</div>
					</div>
				</div>

				{selectedMapel && (
					<div className='flex justify-end'>
						<button
							onClick={handleDownloadExcel}
							className='flex items-center gap-3 px-6 py-3 bg-[#A3E635] text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-wider shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<svg
								className='w-6 h-6'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={3}
									d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
								/>
							</svg>
							DOWNLOAD EXCEL
						</button>
					</div>
				)}

				{selectedMapel && (
					<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
						{/* 2. Settings (Weights) */}
						<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] lg:col-span-1 h-fit'>
							<div className='flex items-center justify-between mb-6 border-b-[4px] border-[#0D0D0D] pb-4'>
								<h3 className='font-black text-[#0D0D0D] text-xl uppercase tracking-widest'>
									PENGATURAN NILAI
								</h3>
								<svg
									className='w-8 h-8 text-[#0D0D0D]'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='square'
										strokeLinejoin='miter'
										strokeWidth={3}
										d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
									/>
									<path
										strokeLinecap='square'
										strokeLinejoin='miter'
										strokeWidth={3}
										d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
									/>
								</svg>
							</div>

							<div className='flex flex-col sm:flex-row items-stretch gap-0 mb-6 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<button
									onClick={() => setCalcMethod('persentase')}
									className={`flex-1 py-3 px-2 font-black uppercase text-xs tracking-wider transition-colors ${calcMethod === 'persentase' ? 'bg-[#0D0D0D] text-white' : 'hover:bg-gray-100 text-[#0D0D0D]'}`}>
									Bobot %
								</button>
								<div className='w-[3px] bg-[#0D0D0D] hidden sm:block'></div>
								<div className='h-[3px] bg-[#0D0D0D] sm:hidden'></div>
								<button
									onClick={() => setCalcMethod('sederhana')}
									className={`flex-1 py-3 px-2 font-black uppercase text-xs tracking-wider transition-colors ${calcMethod === 'sederhana' ? 'bg-[#0D0D0D] text-white' : 'hover:bg-gray-100 text-[#0D0D0D]'}`}>
									Rata-Rata
								</button>
							</div>

							{calcMethod === 'persentase' ? (
								<div className='space-y-6'>
									<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<div className='flex justify-between items-center mb-2'>
											<div>
												<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>FORMATIF</label>
												<span className='block text-[10px] font-bold text-gray-500'>Tugas Harian / Formatif</span>
											</div>
											<div className='bg-[#00A693] text-white font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] -rotate-2'>{bobot.harian}%</div>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.harian}
											onChange={(e) => setBobot({ ...bobot, harian: parseInt(e.target.value) })}
											className='w-full accent-[#0D0D0D] cursor-pointer'
										/>
									</div>
									<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<div className='flex justify-between items-center mb-2'>
											<div>
												<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>SUMATIF</label>
												<span className='block text-[10px] font-bold text-gray-500'>Ulangan Tengah / Bab</span>
											</div>
											<div className='bg-[#2F80ED] text-white font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] rotate-1'>{bobot.sumatif}%</div>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.sumatif}
											onChange={(e) => setBobot({ ...bobot, sumatif: parseInt(e.target.value) })}
											className='w-full accent-[#0D0D0D] cursor-pointer'
										/>
									</div>
									<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<div className='flex justify-between items-center mb-2'>
											<div>
												<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>SAS</label>
												<span className='block text-[10px] font-bold text-gray-500'>Sumatif Akhir Semester</span>
											</div>
											<div className='bg-[#E8451A] text-white font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] -rotate-1'>{bobot.uas}%</div>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.uas}
											onChange={(e) => setBobot({ ...bobot, uas: parseInt(e.target.value) })}
											className='w-full accent-[#0D0D0D] cursor-pointer'
										/>
									</div>
									{bobot.harian + bobot.sumatif + bobot.uas !== 100 && (
										<div className='bg-[#E8451A] text-white p-3 border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider text-center'>
											Total Bobot ({bobot.harian + bobot.sumatif + bobot.uas}%) Harus 100%!
										</div>
									)}
								</div>
							) : (
								<div className='p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-center'>
									<p className='text-xs font-black uppercase text-[#0D0D0D]'>Metode rata-rata sederhana aktif.</p>
									<p className='text-[10px] font-bold text-gray-500 mt-1 uppercase'>Semua kategori dinilai sama rata.</p>
								</div>
							)}

							{/* Konversi Nilai Box */}
							<div className='mt-8 pt-6 border-t-[4px] border-[#0D0D0D]'>
								<div className='flex items-center justify-between mb-4'>
									<label className='font-black text-[#0D0D0D] text-sm uppercase tracking-wider'>KONVERSI NILAI</label>
									<button
										onClick={toggleConversion}
										className={`px-3 py-1 font-black text-xs uppercase border-[2px] border-[#0D0D0D] transition-colors ${convertConfig.useConversion ? 'bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]' : 'bg-white text-[#0D0D0D]'}`}>
										{convertConfig.useConversion ? 'AKTIF' : 'NONAKTIF'}
									</button>
								</div>

								{convertConfig.useConversion && (
									<div className='space-y-4 bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<div className='text-[10px] font-bold text-gray-500 uppercase leading-snug'>
											Rentang Nilai Aktual: <span className='font-black text-[#0D0D0D]'>{actualStats.min}</span> s/d <span className='font-black text-[#0D0D0D]'>{actualStats.max}</span>
										</div>

										<div className='grid grid-cols-2 gap-2'>
											<div>
												<label className='text-[10px] font-black uppercase text-[#0D0D0D] block'>Min Capaian</label>
												<input
													type='number'
													value={convertConfig.ncMin}
													onChange={(e) => setConvertConfig({ ...convertConfig, ncMin: parseFloat(e.target.value) || 0 })}
													className='w-full p-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none'
												/>
											</div>
											<div>
												<label className='text-[10px] font-black uppercase text-[#0D0D0D] block'>Max Capaian</label>
												<input
													type='number'
													value={convertConfig.ncMax}
													onChange={(e) => setConvertConfig({ ...convertConfig, ncMax: parseFloat(e.target.value) || 0 })}
													className='w-full p-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none'
												/>
											</div>
										</div>

										<div className='grid grid-cols-2 gap-2 pt-2 border-t-[2px] border-gray-200'>
											<div>
												<label className='text-[10px] font-black uppercase text-[#0D0D0D] block'>Target Min</label>
												<input
													type='number'
													value={convertConfig.nhMin}
													onChange={(e) => setConvertConfig({ ...convertConfig, nhMin: parseFloat(e.target.value) || 0 })}
													className='w-full p-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none'
												/>
											</div>
											<div>
												<label className='text-[10px] font-black uppercase text-[#0D0D0D] block'>Target Max</label>
												<input
													type='number'
													value={convertConfig.nhMax}
													onChange={(e) => setConvertConfig({ ...convertConfig, nhMax: parseFloat(e.target.value) || 0 })}
													className='w-full p-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none'
												/>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* 3. Table Rekapitulasi */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] lg:col-span-2 flex flex-col h-fit overflow-hidden'>
							<div className='bg-[#0D0D0D] px-6 py-4 flex items-center justify-between'>
								<h3 className='text-white font-black uppercase tracking-widest text-lg'>REKAP NILAI SISWA</h3>
								{convertConfig.useConversion && <span className='bg-[#00A693] text-white text-[10px] font-black px-2 py-1 border-[2px] border-white -rotate-2'>KONVERSI AKTIF</span>}
							</div>
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[700px]'>
									<thead className='bg-[#F5C518] border-b-[4px] border-[#0D0D0D]'>
										<tr>
											<th className='px-6 py-4 text-left text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[4px] border-[#0D0D0D]'>Siswa</th>
											<th className='px-4 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[2px] border-[#0D0D0D]'>
												Formatif <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-white px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>{bobot.harian}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[2px] border-[#0D0D0D]'>
												Sumatif <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-white px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>{bobot.sumatif}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[4px] border-[#0D0D0D]'>
												SAS <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-white px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>{bobot.uas}%</span>}
											</th>
											<th className='px-2 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[2px] border-[#0D0D0D]'>Pt (+)</th>
											<th className='px-2 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[4px] border-[#0D0D0D]'>Pt (-)</th>
											<th className='px-6 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider bg-[#FF90E8] border-r-[4px] border-[#0D0D0D]'>Akhir</th>
											{convertConfig.useConversion && <th className='px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider bg-[#2F80ED]'>Konversi</th>}
										</tr>
									</thead>
									<tbody className='divide-y-[3px] divide-[#0D0D0D]'>
										{studentGrades.map((siswa, idx) => (
											<tr
												key={siswa.id}
												className='hover:bg-[#F3F4F6] transition-colors'>
												<td className='px-6 py-4 whitespace-nowrap border-r-[4px] border-[#0D0D0D]'>
													<div className='flex items-center gap-4'>
														<div className='w-8 h-8 bg-white border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center justify-center text-xs font-black text-[#0D0D0D]'>{idx + 1}</div>
														<div>
															<div className='text-sm font-black text-[#0D0D0D] uppercase'>{siswa.nama_lengkap}</div>
															<div className='text-xs font-bold text-gray-500 uppercase tracking-widest'>{siswa.nis}</div>
														</div>
													</div>
												</td>
												<td className='px-4 py-4 text-center text-sm font-bold text-[#0D0D0D] border-r-[2px] border-[#0D0D0D] bg-white'>{siswa.harian !== null ? siswa.harian.toFixed(1) : '-'}</td>
												<td className='px-4 py-4 text-center text-sm font-bold text-[#0D0D0D] border-r-[2px] border-[#0D0D0D] bg-white'>{siswa.sumatif !== null ? siswa.sumatif.toFixed(1) : '-'}</td>
												<td className='px-4 py-4 text-center text-sm font-bold text-[#0D0D0D] border-r-[4px] border-[#0D0D0D] bg-white'>{siswa.uas !== null ? siswa.uas.toFixed(1) : '-'}</td>
												<td className='px-2 py-4 text-center border-r-[2px] border-[#0D0D0D] bg-white'>
													{siswa.poinPositif > 0 ? (
														<span className='inline-block bg-[#00A693] text-white px-2 py-0.5 border-[2px] border-[#0D0D0D] font-black text-xs'>+{siswa.poinPositif}</span>
													) : (
														<span className='text-gray-400 font-bold'>-</span>
													)}
												</td>
												<td className='px-2 py-4 text-center border-r-[4px] border-[#0D0D0D] bg-white'>
													{siswa.poinNegatif > 0 ? (
														<span className='inline-block bg-[#E8451A] text-white px-2 py-0.5 border-[2px] border-[#0D0D0D] font-black text-xs'>-{siswa.poinNegatif}</span>
													) : (
														<span className='text-gray-400 font-bold'>-</span>
													)}
												</td>
												<td className='px-6 py-4 text-center text-base font-black text-[#0D0D0D] bg-[#FFF5F0] border-r-[4px] border-[#0D0D0D] shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.05)]'>{siswa.finalOrig.toFixed(2)}</td>
												{convertConfig.useConversion && <td className='px-6 py-4 text-center text-base font-black text-white bg-[#00A693] shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.15)]'>{siswa.finalConvert.toFixed(2)}</td>}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
