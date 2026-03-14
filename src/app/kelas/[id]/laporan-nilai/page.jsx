'use client';

import { useState, useEffect, useMemo } from 'react';
import SectionHeader from '@/app/components/SectionHeader'; // Adjust path if needed
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

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
				// Fetch Kelas
				const resKelas = await fetch('/api/kelas');
				const dataKelas = await resKelas.json();
				const k = dataKelas.find((x) => x.id === id);
				setKelasInfo(k);

				// Fetch Mapel
				const resMapel = await fetch('/api/mapel');
				const dataMapel = await resMapel.json();
				setMapelList(dataMapel);

				let poinMap = {};
				if (k) {
					const resPoin = await fetch(`/api/poin?kelas=${encodeURIComponent(k.kelas || k.nama_kelas)}`);
					const dataPoin = resPoin.ok ? await resPoin.json() : [];
					dataPoin.forEach((p) => {
						if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
						if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
						if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
					});
				}

				// Fetch Siswa
				if (k) {
					const resSiswa = await fetch('/api/siswa');
					const dataSiswa = await resSiswa.json();
					const siswaKelas = dataSiswa
						.filter((s) => s.kelas === (k.kelas || k.nama_kelas) && s.status === 'Aktif')
						.map((s) => ({
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
				const res = await fetch(`/api/nilai?kelas=${encodeURIComponent(namaKelas)}&mapel=${encodeURIComponent(selectedMapel)}`);
				const data = await res.json();
				setNilaiList(data);
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
				// Auto-detect type based on keyword
				const titleLower = (n.kategori || '').toLowerCase();
				if (titleLower.includes('uas') || titleLower.includes('pas')) {
					groups[n.tugas_id].type = 'uas';
				} else if (titleLower.includes('uts') || titleLower.includes('pts') || titleLower.includes('sumatif')) {
					groups[n.tugas_id].type = 'sumatif';
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

			const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

			const nilaiHarian = avg(studentScores.harian);
			const nilaiSumatif = avg(studentScores.sumatif);
			const nilaiUAS = avg(studentScores.uas);

			// Calculate Final
			// If a category has no scores, we might need to adjust logic or treat as 0
			// Or normalize weights? For now, standard weighted sum.
			// Format: (NH * W_H + NS * W_S + NU * W_U) / 100
			let finalOrig = 0;
			if (calcMethod === 'sederhana') {
				finalOrig = (nilaiHarian + nilaiSumatif + nilaiUAS) / 3;
			} else {
				finalOrig = (nilaiHarian * bobot.harian + nilaiSumatif * bobot.sumatif + nilaiUAS * bobot.uas) / 100;
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
		<div className='min-h-screen bg-gray-50 pb-10'>
			<SectionHeader
				title='Laporan Penilaian'
				leftIcon={
					<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
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
					</div>
				}
				onLeftClick={() => window.history.back()}
			/>

			<div className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6'>
				{/* 1. Filter / Selector */}
				<div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
					<h3 className='font-bold text-gray-800 mb-4'>Filter Laporan</h3>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
						<div>
							<label className='block text-sm font-medium text-gray-600 mb-2'>Mata Pelajaran</label>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none'>
								<option value=''>-- Pilih Mapel --</option>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel}>
										{m.mapel}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{selectedMapel && (
					<div className='flex justify-end'>
						<button
							onClick={handleDownloadExcel}
							className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-sm'>
							<svg
								className='w-5 h-5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
								/>
							</svg>
							Download Excel
						</button>
					</div>
				)}

				{selectedMapel && (
					<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
						{/* 2. Settings (Weights) */}
						<div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1 h-fit'>
							<h3 className='font-bold text-gray-800 mb-4 flex items-center gap-2'>
								<svg
									className='w-5 h-5 text-gray-400'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
									/>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
									/>
								</svg>
								Pengaturan Nilai
							</h3>

							<div className='flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100'>
								<label className='flex items-center gap-2 cursor-pointer w-full sm:w-auto'>
									<input
										type='radio'
										name='calcMethod'
										value='persentase'
										checked={calcMethod === 'persentase'}
										onChange={() => setCalcMethod('persentase')}
										className='accent-indigo-600 w-4 h-4'
									/>
									<span className='text-sm font-semibold text-gray-700'>Bobot Persentase</span>
								</label>
								<label className='flex items-center gap-2 cursor-pointer w-full sm:w-auto'>
									<input
										type='radio'
										name='calcMethod'
										value='sederhana'
										checked={calcMethod === 'sederhana'}
										onChange={() => setCalcMethod('sederhana')}
										className='accent-indigo-600 w-4 h-4'
									/>
									<span className='text-sm font-semibold text-gray-700'>Rata-rata Sederhana</span>
								</label>
							</div>

							{calcMethod === 'persentase' ? (
								<div className='space-y-4'>
									<div>
										<div className='flex justify-between text-sm mb-1'>
											<label className='text-gray-600'>Nilai Harian (%)</label>
											<span className='font-bold text-indigo-600'>{bobot.harian}%</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.harian}
											onChange={(e) => setBobot({ ...bobot, harian: parseInt(e.target.value) })}
											className='w-full accent-indigo-600'
										/>
									</div>
									<div>
										<div className='flex justify-between text-sm mb-1'>
											<label className='text-gray-600'>Nilai Sumatif (%)</label>
											<span className='font-bold text-indigo-600'>{bobot.sumatif}%</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.sumatif}
											onChange={(e) => setBobot({ ...bobot, sumatif: parseInt(e.target.value) })}
											className='w-full accent-indigo-600'
										/>
									</div>
									<div>
										<div className='flex justify-between text-sm mb-1'>
											<label className='text-gray-600'>Nilai UAS (%)</label>
											<span className='font-bold text-indigo-600'>{bobot.uas}%</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.uas}
											onChange={(e) => setBobot({ ...bobot, uas: parseInt(e.target.value) })}
											className='w-full accent-indigo-600'
										/>
									</div>

									<div className='p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mt-2 flex items-start gap-2'>
										<span className='text-lg'>ℹ️</span>
										<span>
											Total Bobot: <strong>{bobot.harian + bobot.sumatif + bobot.uas}%</strong>. Pastikan totalnya 100% untuk hasil akurat.
										</span>
									</div>
								</div>
							) : (
								<div className='p-6 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-600 text-center flex flex-col items-center gap-3'>
									<div className='p-3 bg-white rounded-full shadow-sm'>
										<svg
											className='w-6 h-6 text-indigo-500'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
											/>
										</svg>
									</div>
									Menggunakan <b>Rata-rata Sederhana</b>.<br />
									Semua komponen (Harian, Sumatif, UAS) memiliki bobot yg sama dan dirata-rata (/ 3).
								</div>
							)}

							<hr className='my-6 border-gray-100' />

							{/* Conversion Tool */}
							<div>
								<div className='flex items-center justify-between mb-4'>
									<h3 className='font-bold text-gray-800'>Konversi Nilai</h3>
									<div
										onClick={toggleConversion}
										className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${convertConfig.useConversion ? 'bg-green-500' : 'bg-gray-300'}`}>
										<div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${convertConfig.useConversion ? 'translate-x-5' : ''}`}></div>
									</div>
								</div>

								{convertConfig.useConversion && (
									<div className='space-y-4 animate-in fade-in slide-in-from-top-2'>
										<div className='grid grid-cols-2 gap-3'>
											<div>
												<label className='text-xs text-gray-500 block mb-1'>Nilai Asli Min</label>
												<input
													type='number'
													value={convertConfig.ncMin}
													onChange={(e) => setConvertConfig({ ...convertConfig, ncMin: parseInt(e.target.value) })}
													className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
												/>
											</div>
											<div>
												<label className='text-xs text-gray-500 block mb-1'>Nilai Asli Max</label>
												<input
													type='number'
													value={convertConfig.ncMax}
													onChange={(e) => setConvertConfig({ ...convertConfig, ncMax: parseInt(e.target.value) })}
													className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
												/>
											</div>
										</div>
										{/* Tampilan Aktual Nilai Kelas & Tombol Gunakan */}
										<div className='bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between'>
											<div className='text-sm'>
												<p className='text-indigo-900 font-semibold mb-1'>Nilai Kelas Aktual</p>
												<div className='flex items-center gap-4 text-xs text-indigo-700'>
													<span>
														Min: <b className='text-indigo-900'>{actualStats.min}</b>
													</span>
													<span>
														Max: <b className='text-indigo-900'>{actualStats.max}</b>
													</span>
												</div>
											</div>
											<button
												onClick={() => setConvertConfig((prev) => ({ ...prev, ncMin: Math.floor(actualStats.min), ncMax: Math.ceil(actualStats.max) }))}
												className='px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap'>
												Dapatkan Nilai Aktual
											</button>
										</div>
										<div className='flex justify-center text-gray-400'>
											<svg
												className='w-5 h-5'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 14l-7 7m0 0l-7-7m7 7V3'
												/>
											</svg>
										</div>
										<div className='grid grid-cols-2 gap-3'>
											<div>
												<label className='text-xs text-gray-500 block mb-1'>Target Min</label>
												<input
													type='number'
													value={convertConfig.nhMin}
													onChange={(e) => setConvertConfig({ ...convertConfig, nhMin: parseInt(e.target.value) })}
													className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
												/>
											</div>
											<div>
												<label className='text-xs text-gray-500 block mb-1'>Target Max</label>
												<input
													type='number'
													value={convertConfig.nhMax}
													onChange={(e) => setConvertConfig({ ...convertConfig, nhMax: parseInt(e.target.value) })}
													className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
												/>
											</div>
										</div>
										<div className='p-3 bg-yellow-50 rounded-xl mt-2 mb-4'>
											<p className='text-[10px] font-bold text-yellow-800 mb-1'>Rumus: NK = NHmin + ((NCx - NCmin) / (NCmax - NCmin)) * (NHmax - NHmin)</p>
											<ul className='text-[9px] text-yellow-700 space-y-0.5'>
												<li>
													• <b>NK</b> = Nilai Konversi (Hasil)
												</li>
												<li>
													• <b>NCx</b> = Nilai Asli Siswa saat ini
												</li>
												<li>
													• <b>NCmin / NCmax</b> = Range Nilai Asli Min / Max
												</li>
												<li>
													• <b>NHmin / NHmax</b> = Range Target Nilai Min / Max (Harapan)
												</li>
											</ul>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* 3. Table */}
						<div className='bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden'>
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[600px]'>
									<thead className='bg-gray-50 border-b border-gray-200'>
										<tr>
											<th className='px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>Siswa</th>
											<th className='px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider'>
												Harian <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-gray-200 px-1 rounded'>{bobot.harian}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider'>
												Sumatif <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-gray-200 px-1 rounded'>{bobot.sumatif}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider'>
												UAS <br />
												{calcMethod === 'persentase' && <span className='text-[10px] bg-gray-200 px-1 rounded'>{bobot.uas}%</span>}
											</th>
											<th className='px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider'>Pt (+)</th>
											<th className='px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider'>Pt (-)</th>
											<th className='px-6 py-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100'>Akhir</th>
											{convertConfig.useConversion && <th className='px-6 py-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider bg-green-50'>Konversi</th>}
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{studentGrades.map((siswa, idx) => (
											<tr
												key={siswa.id}
												className='hover:bg-slate-50 transition-colors'>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div className='flex items-center gap-3'>
														<div className='w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500'>{idx + 1}</div>
														<div>
															<div className='text-sm font-semibold text-gray-900'>{siswa.nama_lengkap}</div>
															<div className='text-xs text-gray-500'>{siswa.nis}</div>
														</div>
													</div>
												</td>
												<td className='px-4 py-4 text-center text-sm text-gray-600'>{siswa.harian > 0 ? siswa.harian.toFixed(1) : '-'}</td>
												<td className='px-4 py-4 text-center text-sm text-gray-600'>{siswa.sumatif > 0 ? siswa.sumatif.toFixed(1) : '-'}</td>
												<td className='px-4 py-4 text-center text-sm text-gray-600'>{siswa.uas > 0 ? siswa.uas.toFixed(1) : '-'}</td>
												<td className='px-4 py-4 text-center text-sm font-semibold text-emerald-600 bg-emerald-50/10'>+{siswa.poinPositif}</td>
												<td className='px-4 py-4 text-center text-sm font-semibold text-rose-600 bg-rose-50/10'>-{siswa.poinNegatif}</td>
												<td className='px-6 py-4 text-center text-sm font-bold text-gray-900 bg-gray-50/50'>{siswa.finalOrig.toFixed(2)}</td>
												{convertConfig.useConversion && <td className='px-6 py-4 text-center text-sm font-bold text-green-600 bg-green-50/30'>{siswa.finalConvert.toFixed(2)}</td>}
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
