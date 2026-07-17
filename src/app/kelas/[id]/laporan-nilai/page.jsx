'use client';

import { useState, useEffect, useMemo } from 'react';
import SectionHeader from '@/app/components/SectionHeader'; // Adjust path if needed
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

	// --- 1. Fetch Data Initial ---
	useEffect(() => {
		const init = async () => {
			try {
				const supabase = createClient();
				
				// Fetch Kelas
				const { data: k } = await supabase.from('kelas').select('*').eq('id', id).single();
				if (k) setKelasInfo(k);

				// Fetch Mapel
				const { data: dataMapel } = await supabase.from('mapel').select('*');
				if (dataMapel) setMapelList(dataMapel);

				let poinMap = {};
				if (k) {
					const namaKelas = k.kelas || k.nama_kelas;
					const { data: dataPoin } = await supabase.from('poin_siswa').select('*').eq('kelas', namaKelas);
					(dataPoin || []).forEach((p) => {
						if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
						if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
						if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
					});
				}

				// Fetch Siswa
				if (k) {
					const namaKelas = k.kelas || k.nama_kelas;
					const { data: dataSiswa } = await supabase.from('siswa').select('*').eq('kelas', namaKelas).eq('status', 'Aktif');
					const siswaKelas = (dataSiswa || []).map((s) => ({
						...s,
						poinPositif: poinMap[s.id]?.positif || 0,
						poinNegatif: poinMap[s.id]?.negatif || 0,
					}));
					setSiswaList(siswaKelas);
				}
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		init();
	}, [id]);

	// --- 2. Fetch Nilai when Mapel changes ---
	useEffect(() => {
		if (!kelasInfo || !selectedMapel) {
			setNilaiList([]);
			return;
		}

		const fetchNilai = async () => {
			setLoading(true);
			try {
				const namaKelas = kelasInfo.kelas || kelasInfo.nama_kelas;
				
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) throw new Error('Unauthenticated');

				const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
				const role = userData?.role;
				const userId = userData?.id_user;

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

				if (role === 'Guru' && userId) {
					query = query.eq('nilai_tugas.guru_id', userId);
				}

				const { data: rawData, error } = await query;
				if (error) throw error;

				const formattedData = (rawData || []).map(row => ({
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
	}, [kelasInfo, selectedMapel]);

	// --- 3. Calculation Logic ---

	// Categorize Assignments
	const assignments = useMemo(() => {
		// Group by title (kategori) + tugas_id
		// Assuming 'tugas_id' is unique for an assignment
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
				
				if (typeLower === 'sas' || typeLower === 'uas') {
					groups[n.tugas_id].type = 'uas';
				} else if (typeLower === 'sumatif') {
					groups[n.tugas_id].type = 'sumatif';
				} else if (typeLower === 'formatif' || typeLower === 'harian') {
					groups[n.tugas_id].type = 'harian';
				} else {
					// Priority 2: Fallback for legacy data using title keyword matching
					if (titleLower.includes('uas') || titleLower.includes('pas') || titleLower.includes('sas')) {
						groups[n.tugas_id].type = 'uas';
					} else if (titleLower.includes('uts') || titleLower.includes('pts') || titleLower.includes('sumatif')) {
						groups[n.tugas_id].type = 'sumatif';
					} else {
						groups[n.tugas_id].type = 'harian';
					}
				}
			}
			groups[n.tugas_id].scores.push({ siswa_id: n.siswa_id, nilai: parseInt(n.nilai) || 0 });
		});
		return Object.values(groups);
	}, [nilaiList]);

	// Calculate Student Grades
	const studentGrades = useMemo(() => {
		return siswaList.map((siswa) => {
			// Get scores for this student
			const studentScores = {
				harian: [],
				sumatif: [],
				uas: [],
			};

			assignments.forEach((asg) => {
				const scoreEntry = asg.scores.find((s) => s.siswa_id === siswa.id);
				if (scoreEntry) {
					studentScores[asg.type].push(scoreEntry.nilai);
				}
			});

			const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

			const nilaiHarian = avg(studentScores.harian);
			const nilaiSumatif = avg(studentScores.sumatif);
			const nilaiUAS = avg(studentScores.uas);

			// Calculate Final
			// If a category has no scores, we might need to adjust logic or treat as 0
			// Or normalize weights? For now, standard weighted sum.
			// Format: (NH * W_H + NS * W_S + NU * W_U) / 100
			let finalOrig = 0;
			if (calcMethod === 'sederhana') {
				finalOrig = ((nilaiHarian || 0) + (nilaiSumatif || 0) + (nilaiUAS || 0)) / 3;
			} else {
				finalOrig = ((nilaiHarian || 0) * bobot.harian + (nilaiSumatif || 0) * bobot.sumatif + (nilaiUAS || 0) * bobot.uas) / 100;
			}

			// Conversion
			let finalConvert = finalOrig;
			if (convertConfig.useConversion) {
				const { ncMin, ncMax, nhMin, nhMax } = convertConfig;
				// Formula: NK = NHmin + ( (NCx - NCmin) / (NCmax - NCmin) ) * (NHmax - NHmin)
				if (ncMax - ncMin !== 0) {
					finalConvert = nhMin + ((finalOrig - ncMin) / (ncMax - ncMin)) * (nhMax - nhMin);
				}
				// Clamp result to 0-100 or max limit?
				// Usually optional, but let's keep it raw formatted
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
				'Nilai Harian': parseFloat(siswa.harian.toFixed(1)),
				'Nilai Sumatif': parseFloat(siswa.sumatif.toFixed(1)),
				'Nilai UAS': parseFloat(siswa.uas.toFixed(1)),
				'Nilai Akhir': parseFloat(siswa.finalOrig.toFixed(2)),
			};

			if (convertConfig.useConversion) {
				row['Nilai Konversi'] = parseFloat(siswa.finalConvert.toFixed(2));
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
			{ wch: 12 }, // Harian
			{ wch: 12 }, // Sumatif
			{ wch: 12 }, // UAS
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

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			<div className='bg-[#00A693] border-b-[4px] border-[#0D0D0D] p-4 sm:p-6 flex items-center gap-4 sticky top-0 z-50'>
				<button onClick={() => window.history.back()} className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
					<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
				</button>
				<h1 className='text-xl sm:text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>LAPORAN PENILAIAN</h1>
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
											<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>HARIAN</label>
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
											<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>SUMATIF</label>
											<div className='bg-[#FF90E8] text-[#0D0D0D] font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] rotate-1'>{bobot.sumatif}%</div>
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
											<label className='font-black uppercase text-[#0D0D0D] text-sm tracking-wider'>UAS</label>
											<div className='bg-[#A3E635] text-[#0D0D0D] font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] -rotate-1'>{bobot.uas}%</div>
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

									<div className='p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] mt-4 flex gap-3 items-start'>
										<svg className='w-6 h-6 text-[#E8451A] flex-shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor'><path strokeLinecap='square' strokeLinejoin='miter' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg>
										<div>
											<div className='font-black uppercase text-[#0D0D0D] mb-1'>TOTAL BOBOT: {bobot.harian + bobot.sumatif + bobot.uas}%</div>
											<p className='text-xs font-medium text-[#0D0D0D]'>Pastikan total keseluruhannya 100% untuk mendapatkan hasil kalkulasi yang seimbang.</p>
										</div>
									</div>
								</div>
							) : (
								<div className='p-6 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-center flex flex-col items-center gap-4'>
									<div className='w-14 h-14 bg-[#2F80ED] border-[3px] border-[#0D0D0D] flex items-center justify-center -rotate-6 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<svg
											className='w-8 h-8 text-white'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='square'
												strokeLinejoin='miter'
												strokeWidth={3}
												d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
											/>
										</svg>
									</div>
									<div>
										<h4 className='font-black uppercase text-[#0D0D0D] mb-2 text-lg'>RATA-RATA SEDERHANA</h4>
										<p className='text-sm font-medium text-[#0D0D0D]'>Semua komponen (Harian, Sumatif, UAS) dianggap setara dan akan dirata-rata lurus (dibagi 3).</p>
									</div>
								</div>
							)}

							<div className='w-full h-[4px] bg-[#0D0D0D] my-8'></div>

							{/* Conversion Tool */}
							<div>
								<div className='flex items-center justify-between mb-6'>
									<h3 className='font-black text-[#0D0D0D] text-xl uppercase tracking-widest'>KONVERSI NILAI</h3>
									<div
										onClick={toggleConversion}
										className={`w-14 h-8 border-[3px] border-[#0D0D0D] rounded-full p-1 cursor-pointer transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] relative ${convertConfig.useConversion ? 'bg-[#00A693]' : 'bg-white'}`}>
										<div className={`bg-[#0D0D0D] w-5 h-5 rounded-full transform transition-transform ${convertConfig.useConversion ? 'translate-x-6' : ''}`}></div>
									</div>
								</div>

								{convertConfig.useConversion && (
									<div className='space-y-6 animate-in fade-in slide-in-from-top-2'>
										<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
											<div className='flex items-center gap-2 mb-3'>
												<span className='bg-[#E8451A] text-white px-2 py-0.5 font-black border-[2px] border-[#0D0D0D] text-xs -rotate-2'>ASLI</span>
												<span className='font-black uppercase tracking-wider text-sm'>NILAI SISWA</span>
											</div>
											<div className='grid grid-cols-2 gap-4'>
												<div>
													<label className='font-bold uppercase text-[10px] tracking-widest mb-1 block'>MIN (NCmin)</label>
													<input
														type='number'
														value={convertConfig.ncMin}
														onWheel={(e) => e.target.blur()}
														onChange={(e) => setConvertConfig({ ...convertConfig, ncMin: parseInt(e.target.value) })}
														className='neo-input w-full px-3 py-2 text-lg font-black'
													/>
												</div>
												<div>
													<label className='font-bold uppercase text-[10px] tracking-widest mb-1 block'>MAX (NCmax)</label>
													<input
														type='number'
														value={convertConfig.ncMax}
														onWheel={(e) => e.target.blur()}
														onChange={(e) => setConvertConfig({ ...convertConfig, ncMax: parseInt(e.target.value) })}
														className='neo-input w-full px-3 py-2 text-lg font-black'
													/>
												</div>
											</div>
										</div>

										{/* Tampilan Aktual Nilai Kelas & Tombol Gunakan */}
										<div className='bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-4 flex flex-col gap-3 items-center text-center'>
											<div>
												<p className='font-black uppercase tracking-widest text-[#0D0D0D] mb-1'>NILAI KELAS AKTUAL</p>
												<div className='flex items-center justify-center gap-4 font-black text-lg'>
													<span className='bg-[#F5C518] px-2 py-1 border-[2px] border-[#0D0D0D]'>
														MIN: {actualStats.min}
													</span>
													<span className='bg-[#F5C518] px-2 py-1 border-[2px] border-[#0D0D0D]'>
														MAX: {actualStats.max}
													</span>
												</div>
											</div>
											<button
												onClick={() => setConvertConfig((prev) => ({ ...prev, ncMin: Math.floor(actualStats.min), ncMax: Math.ceil(actualStats.max) }))}
												className='w-full py-2 bg-[#2F80ED] hover:bg-[#0D0D0D] hover:-translate-y-1 text-white border-[3px] border-[#0D0D0D] font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'>
												GUNAKAN AKTUAL
											</button>
										</div>

										<div className='flex justify-center text-[#0D0D0D] py-2'>
											<svg
												className='w-8 h-8'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='square'
													strokeLinejoin='miter'
													strokeWidth={4}
													d='M19 14l-7 7m0 0l-7-7m7 7V3'
												/>
											</svg>
										</div>

										<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
											<div className='flex items-center gap-2 mb-3'>
												<span className='bg-[#00A693] text-white px-2 py-0.5 font-black border-[2px] border-[#0D0D0D] text-xs rotate-2'>TARGET</span>
												<span className='font-black uppercase tracking-wider text-sm'>NILAI HARAPAN</span>
											</div>
											<div className='grid grid-cols-2 gap-4'>
												<div>
													<label className='font-bold uppercase text-[10px] tracking-widest mb-1 block'>MIN (NHmin)</label>
													<input
														type='number'
														value={convertConfig.nhMin}
														onWheel={(e) => e.target.blur()}
														onChange={(e) => setConvertConfig({ ...convertConfig, nhMin: parseInt(e.target.value) })}
														className='neo-input w-full px-3 py-2 text-lg font-black'
													/>
												</div>
												<div>
													<label className='font-bold uppercase text-[10px] tracking-widest mb-1 block'>MAX (NHmax)</label>
													<input
														type='number'
														value={convertConfig.nhMax}
														onWheel={(e) => e.target.blur()}
														onChange={(e) => setConvertConfig({ ...convertConfig, nhMax: parseInt(e.target.value) })}
														className='neo-input w-full px-3 py-2 text-lg font-black'
													/>
												</div>
											</div>
										</div>

										<div className='p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
											<div className='inline-block bg-[#0D0D0D] text-white px-2 py-0.5 font-black uppercase text-[10px] tracking-widest mb-2'>RUMUS KONVERSI</div>
											<p className='text-xs font-bold text-[#0D0D0D] mb-2 font-mono'>NK = NHmin + ((NCx - NCmin) / (NCmax - NCmin)) * (NHmax - NHmin)</p>
											<ul className='text-[10px] text-[#0D0D0D] font-medium space-y-1 leading-tight'>
												<li><strong>NK</strong> = Nilai Konversi (Hasil Akhir)</li>
												<li><strong>NCx</strong> = Nilai Asli Siswa saat ini</li>
												<li><strong>NCmin / NCmax</strong> = Rentang Nilai Asli</li>
												<li><strong>NHmin / NHmax</strong> = Rentang Target Nilai</li>
											</ul>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* 3. Table */}
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
												Harian <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-white px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>{bobot.harian}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[2px] border-[#0D0D0D]'>
												Sumatif <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-white px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>{bobot.sumatif}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-black text-[#0D0D0D] uppercase tracking-wider border-r-[4px] border-[#0D0D0D]'>
												UAS <br />
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
