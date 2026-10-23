'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
	Target,
	Calculator,
	Sparkles,
	UserCheck,
	Award,
	TableProperties,
	Printer,
	ArrowRight,
	BookOpen,
	Users,
	CheckCircle2,
	Clock,
	Layers,
	ChevronRight,
	FileSpreadsheet,
	AlertCircle,
} from 'lucide-react';
import { useERaporAuth } from './ERaporLayoutClient';
import Loader from '@/app/components/loading';

export default function ERaporDashboard() {
	const auth = useERaporAuth();
	const userRole = auth?.userRole || 'Guru';
	const isWaliKelas = auth?.isWaliKelas || false;
	const isPrivileged = auth?.isPrivileged || false;

	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchStats() {
			try {
				const resStats = await fetch('/api/erapor/dashboard');
				if (resStats.ok) {
					const dataS = await resStats.json();
					setStats(dataS);
				}
			} catch (err) {
				console.error('Error fetching erapor dashboard data:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchStats();
	}, []);

	const kbmProgress = stats?.guru_kbm_progress || [];
	const waliInfo = stats?.wali_kelas_info;

	const showWaliCard = isWaliKelas || isPrivileged || Boolean(waliInfo?.is_wali);

	return (
		<div className='space-y-8'>
			{/* Banner Hero Rapor */}
			<div className='p-4 sm:p-8 bg-gradient-to-r from-yellow-300 via-amber-200 to-rose-200 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] sm:shadow-[6px_6px_0px_0px_#000] relative overflow-hidden'>
				<div className='max-w-3xl space-y-3 relative z-10'>
					<div className='flex items-center gap-1.5 sm:gap-2 flex-wrap'>
						<span className='inline-block px-2.5 py-1 bg-black text-[#F5C518] text-[10px] sm:text-xs font-black uppercase rounded-lg'>
							Fase D • Kurikulum Merdeka
						</span>
						<span className='inline-block px-2.5 py-1 bg-white text-black text-[10px] sm:text-xs font-black uppercase rounded-lg border-2 border-black'>
							Tahun Pelajaran {stats?.tahun_ajaran || '2026/2027'} • Semester {stats?.semester || 1}
						</span>
						{showWaliCard ? (
							<span className='inline-block px-2.5 py-1 bg-[#00A693] text-white text-[10px] sm:text-xs font-black uppercase rounded-lg border-2 border-black'>
								Wali Kelas {waliInfo?.nama_kelas || 'Binaan'}
							</span>
						) : (
							<span className='inline-block px-2.5 py-1 bg-[#2F80ED] text-white text-[10px] sm:text-xs font-black uppercase rounded-lg border-2 border-black'>
								Guru Pengampu Mapel
							</span>
						)}
					</div>
					<h2 className='text-xl sm:text-4xl font-black text-black leading-tight'>
						Pusat Pengolahan E-Rapor Digital
					</h2>
					<p className='text-xs sm:text-sm font-bold text-gray-800 leading-relaxed max-w-2xl'>
						Silakan ikuti panduan langkah kerja pengerjaan rapor di bawah. Penginputan nilai dibagi menjadi dua zona terpisah: tugas guru mata pelajaran dan tugas wali kelas binaan.
					</p>
				</div>
			</div>

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Menyiapkan pusat pengolahan e-rapor...</p>
					<p className='text-xs font-bold text-gray-500'>Mengkonsolidasikan data mengajar, TP, dan status kelas binaan</p>
				</div>
			) : (
				<>
					{/* =================================================================== */}
					{/* BAGIAN ATAS: LANGKAH-LANGKAH PENGERJAAN RAPOR (INTERACTIVE STEPPER) */}
					{/* =================================================================== */}
			<div className='bg-white p-4 sm:p-6 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] sm:shadow-[5px_5px_0px_0px_#000] space-y-4'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-dashed border-gray-200 pb-3'>
					<div className='space-y-0.5'>
						<h3 className='text-base sm:text-lg font-black text-black flex items-center gap-2'>
							<Layers className='w-5 h-5 text-amber-500' />
							<span>Langkah-Langkah Pengerjaan Rapor</span>
						</h3>
						<p className='text-xs text-gray-600 font-medium'>
							Klik salah satu kotak langkah di bawah untuk langsung menuju halaman pengerjaan yang diinginkan:
						</p>
					</div>
					<span className='text-[11px] font-black uppercase px-2.5 py-1 bg-yellow-100 text-black border border-black rounded-md w-fit'>
						Alur Terpadu
					</span>
				</div>

				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3'>
					{/* Langkah 1: Rekap & Konversi Nilai */}
					<Link
						href='/erapor/rekap-nilai'
						className='group p-3.5 bg-teal-50 hover:bg-teal-100 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-teal-300 text-xs font-black flex items-center justify-center'>
									1
								</span>
								<span className='text-[10px] font-black uppercase text-teal-800 bg-teal-200 px-1.5 py-0.5 rounded'>
									Guru Mapel
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-teal-700 transition-colors'>
								Rekap & Konversi
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Hitung bobot tugas harian, SAS, & konversi nilai.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>Buka Rekap</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>

					{/* Langkah 2: TP */}
					<Link
						href='/erapor/tujuan-pembelajaran'
						className='group p-3.5 bg-yellow-50 hover:bg-yellow-100 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-[#F5C518] text-xs font-black flex items-center justify-center'>
									2
								</span>
								<span className='text-[10px] font-black uppercase text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded'>
									Guru Mapel
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-yellow-700 transition-colors'>
								Susun TP Belajar
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Input rumusan capaian Tujuan Pembelajaran per tingkat.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>Buka TP</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>

					{/* Langkah 3: Kuantitatif */}
					<Link
						href='/erapor/nilai-kuantitatif'
						className='group p-3.5 bg-blue-50 hover:bg-blue-100 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-blue-300 text-xs font-black flex items-center justify-center'>
									3
								</span>
								<span className='text-[10px] font-black uppercase text-blue-800 bg-blue-200 px-1.5 py-0.5 rounded'>
									Guru Mapel
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-blue-700 transition-colors'>
								Nilai Kuantitatif
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Input angka nilai akhir sumatif (0–100) per siswa di kelas.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>Input Nilai</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>

					{/* Langkah 4: Kualitatif */}
					<Link
						href='/erapor/nilai-kualitatif'
						className='group p-3.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-emerald-300 text-xs font-black flex items-center justify-center'>
									4
								</span>
								<span className='text-[10px] font-black uppercase text-emerald-800 bg-emerald-200 px-1.5 py-0.5 rounded'>
									Guru Mapel
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-emerald-700 transition-colors'>
								Nilai Kualitatif (TP)
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Rubrik skala 1–4 per TP & deskripsi otomatis capaian.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>Buat Deskripsi</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>

					{/* Langkah 5: Presensi & Ekskul */}
					<Link
						href='/erapor/ketidakhadiran'
						className={`group p-3.5 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between ${
							showWaliCard ? 'bg-rose-50 hover:bg-rose-100' : 'bg-gray-100 opacity-60 pointer-events-none'
						}`}>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-rose-300 text-xs font-black flex items-center justify-center'>
									5
								</span>
								<span className='text-[10px] font-black uppercase text-rose-800 bg-rose-200 px-1.5 py-0.5 rounded'>
									Wali Kelas
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-rose-700 transition-colors'>
								Presensi & Ekskul
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Rekap ketidakhadiran semester & catatan ekskul siswa.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>{showWaliCard ? 'Buka Presensi' : 'Khusus Wali Kelas'}</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>

					{/* Langkah 6: Leger & Cetak */}
					<Link
						href='/erapor/cetak'
						className={`group p-3.5 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between ${
							showWaliCard ? 'bg-purple-50 hover:bg-purple-100' : 'bg-gray-100 opacity-60 pointer-events-none'
						}`}>
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<span className='w-6 h-6 rounded-lg bg-black text-purple-300 text-xs font-black flex items-center justify-center'>
									6
								</span>
								<span className='text-[10px] font-black uppercase text-purple-800 bg-purple-200 px-1.5 py-0.5 rounded'>
									Wali Kelas
								</span>
							</div>
							<h4 className='text-xs font-black text-black group-hover:text-purple-700 transition-colors'>
								Leger & Cetak Rapor
							</h4>
							<p className='text-[11px] text-gray-600 font-medium leading-snug'>
								Audit kelengkapan nilai rombel & terbitkan rapor digital.
							</p>
						</div>
						<div className='pt-2 mt-2 border-t border-gray-200 flex items-center gap-1 text-[11px] font-bold text-black'>
							<span>{showWaliCard ? 'Cetak Rapor' : 'Khusus Wali Kelas'}</span>
							<ChevronRight className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform' />
						</div>
					</Link>
				</div>
			</div>

			{/* =================================================================== */}
			{/* BAGIAN BAWAH: DUA CARD UTAMA (GURU MAPEL VS WALI KELAS)             */}
			{/* =================================================================== */}
			<div className={`grid grid-cols-1 ${showWaliCard ? 'lg:grid-cols-2' : ''} gap-6 items-start`}>
				{/* ----------------------------------------------------------------- */}
				{/* CARD 1: ZONA GURU MATA PELAJARAN                                  */}
				{/* ----------------------------------------------------------------- */}
				<div
					id='zona-guru-mapel'
					className='bg-white border-3 border-black rounded-3xl shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col justify-between'>
					<div>
						{/* Header Card Guru Mapel */}
						<div className='p-5 sm:p-6 bg-yellow-300 border-b-3 border-black flex items-center justify-between gap-3'>
							<div className='flex items-center gap-3'>
								<div className='w-11 h-11 rounded-2xl bg-black text-[#F5C518] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]'>
									<BookOpen className='w-6 h-6' />
								</div>
								<div>
									<h3 className='text-lg sm:text-xl font-black text-black'>
										Zona Guru Mata Pelajaran
									</h3>
									<p className='text-xs font-bold text-gray-800'>
										Penginputan nilai & capaian TP untuk kelas yang Anda ampu
									</p>
								</div>
							</div>
							<span className='px-2.5 py-1 bg-black text-white text-[11px] font-black uppercase rounded-lg border border-black shrink-0'>
								4 Modul
							</span>
						</div>

						{/* Isi Card: Rekap Progres Nilai Mapel Saya */}
						<div className='p-5 sm:p-6 space-y-5'>
							<div className='space-y-2'>
								<div className='flex items-center justify-between'>
									<span className='text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5'>
										<span>Progres Nilai Kelas yang Diajar</span>
									</span>
									<span className='text-xs font-bold text-gray-500'>
										{kbmProgress.length} Rombel Terjadwal
									</span>
								</div>

								{kbmProgress.length === 0 ? (
									<div className='p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center text-xs font-bold text-gray-500'>
										Belum ada penugasan kelas di jadwal KBM.
									</div>
								) : (
									<div className='border-2 border-black rounded-2xl overflow-hidden max-h-64 overflow-y-auto divide-y-2 divide-gray-200'>
										{kbmProgress.map((item, idx) => (
											<div
												key={idx}
												className='p-3 bg-white hover:bg-yellow-50 flex items-center justify-between gap-3 transition-colors text-xs'>
												<div className='space-y-1 min-w-0'>
													<div className='flex items-center gap-2'>
														<span className='px-2 py-0.5 bg-yellow-300 text-black font-black rounded border border-black text-[11px]'>
															{item.kelas}
														</span>
														<span className='font-black text-black truncate'>
															{item.mapel}
														</span>
														{item.is_ekskul && (
															<span className='text-[9px] px-1.5 py-0.5 bg-teal-100 text-teal-800 border border-teal-300 rounded font-black uppercase'>
																Ekskul Rapor
															</span>
														)}
													</div>
													<div className='flex items-center gap-2 flex-wrap text-[11px]'>
														<span className={`font-bold ${item.is_kuantitatif_done ? 'text-emerald-700' : 'text-gray-500'}`}>
															Nilai Akhir: <strong>{item.nilai_kuantitatif}/{item.total_siswa}</strong>
														</span>
														<span className='text-gray-300'>•</span>
														{item.is_ekskul ? (
															<span className='font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[10px]'>
																⚡ Otomatis Terkonversi ke Lembar Ekskul
															</span>
														) : (
															<span className={`font-bold ${item.is_kualitatif_done ? 'text-emerald-700' : (item.nilai_kuantitatif > 0 ? 'text-amber-700' : 'text-gray-500')}`}>
																Deskripsi TP: <strong>{item.nilai_kualitatif}/{item.total_siswa}</strong>
															</span>
														)}
													</div>
												</div>

												<div className='flex items-center gap-2 shrink-0'>
													{item.is_fully_done ? (
														<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black rounded-lg border border-emerald-400 text-[10px]'>
															<CheckCircle2 className='w-3 h-3 text-emerald-600' />
															<span>Lengkap</span>
														</span>
													) : item.is_kuantitatif_done && !item.is_kualitatif_done ? (
														<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 font-black rounded-lg border border-amber-400 text-[10px]'>
															<AlertCircle className='w-3 h-3 text-amber-600' />
															<span>Kualitatif Belum</span>
														</span>
													) : !item.is_kuantitatif_done && item.is_kualitatif_done ? (
														<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-900 font-black rounded-lg border border-blue-400 text-[10px]'>
															<AlertCircle className='w-3 h-3 text-blue-600' />
															<span>Kuantitatif Belum</span>
														</span>
													) : (
														<span className='inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 font-bold rounded-lg border border-gray-300 text-[10px]'>
															<Clock className='w-3 h-3 text-gray-500' />
															<span>Belum Diisi</span>
														</span>
													)}

													{item.is_kuantitatif_done && !item.is_kualitatif_done ? (
														<Link
															href={`/erapor/nilai-kualitatif?kelas_id=${item.kelas_id || ''}&mapel_id=${item.mapel_id || ''}`}
															className='px-2.5 py-1 bg-amber-300 hover:bg-black hover:text-white text-black font-black text-[11px] rounded border border-black shadow-[1px_1px_0px_#000] transition-all'
															title='Lengkapi deskripsi capaian TP'>
															Isi TP
														</Link>
													) : (
														<Link
															href={`/erapor/nilai-kuantitatif?kelas_id=${item.kelas_id || ''}&mapel_id=${item.mapel_id || ''}`}
															className='px-2.5 py-1 bg-white hover:bg-black hover:text-white text-black font-bold text-[11px] rounded border border-black transition-all'
															title={item.is_fully_done ? 'Lihat / Edit Nilai' : 'Input Nilai Kuantitatif'}>
															{item.is_fully_done ? 'Lihat' : 'Isi'}
														</Link>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* 4 Tombol Modul Kerja Guru Mapel */}
							<div className='space-y-2 pt-2 border-t-2 border-dashed border-gray-200'>
								<span className='text-xs font-black uppercase tracking-wider text-gray-700'>
									Menu Modul Guru Mapel:
								</span>

								<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5'>
									<Link
										href='/erapor/rekap-nilai'
										className='p-3 bg-teal-100 hover:bg-teal-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
										<div className='flex items-center gap-2'>
											<FileSpreadsheet className='w-4 h-4 text-teal-800 shrink-0' />
											<span className='text-xs font-black text-black'>Rekap & Konversi</span>
										</div>
										<span className='text-[10px] text-gray-600 font-bold mt-1'>
											Formatif, SAS & Konversi
										</span>
									</Link>

									<Link
										href='/erapor/tujuan-pembelajaran'
										className='p-3 bg-amber-100 hover:bg-amber-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
										<div className='flex items-center gap-2'>
											<Target className='w-4 h-4 text-amber-800 shrink-0' />
											<span className='text-xs font-black text-black'>Tujuan Pembelajaran</span>
										</div>
										<span className='text-[10px] text-gray-600 font-bold mt-1'>
											{stats?.tp_count || 0} TP Tersimpan
										</span>
									</Link>

									<Link
										href='/erapor/nilai-kuantitatif'
										className='p-3 bg-blue-100 hover:bg-blue-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
										<div className='flex items-center gap-2'>
											<Calculator className='w-4 h-4 text-blue-800 shrink-0' />
											<span className='text-xs font-black text-black'>Nilai Kuantitatif</span>
										</div>
										<span className='text-[10px] text-gray-600 font-bold mt-1'>
											Nilai Akhir (0-100)
										</span>
									</Link>

									<Link
										href='/erapor/nilai-kualitatif'
										className='p-3 bg-emerald-100 hover:bg-emerald-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between'>
										<div className='flex items-center gap-2'>
											<Sparkles className='w-4 h-4 text-emerald-800 shrink-0' />
											<span className='text-xs font-black text-black'>Nilai Kualitatif</span>
										</div>
										<span className='text-[10px] text-gray-600 font-bold mt-1'>
											Otomatisasi Deskripsi
										</span>
									</Link>
								</div>
							</div>
						</div>
					</div>

					<div className='p-4 bg-gray-50 border-t-2 border-black text-xs text-gray-600 font-medium flex items-center justify-between'>
						<span>Total Siswa Diajar: <strong>{stats?.total_siswa || 0} Siswa</strong></span>
						<span>Total Mapel: <strong>{stats?.total_mapel || 0} Mapel</strong></span>
					</div>
				</div>

				{/* ----------------------------------------------------------------- */}
				{/* CARD 2: ZONA WALI KELAS (HANYA MUNCUL JIKA WALI KELAS / ADMIN)   */}
				{/* ----------------------------------------------------------------- */}
				{showWaliCard && (
					<div
						id='zona-wali-kelas'
						className='bg-white border-3 border-black rounded-3xl shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col justify-between'>
						<div>
							{/* Header Card Wali Kelas */}
							<div className='p-5 sm:p-6 bg-[#00A693] text-white border-b-3 border-black flex items-center justify-between gap-3'>
								<div className='flex items-center gap-3'>
									<div className='w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]'>
										<Users className='w-6 h-6 text-[#00A693]' />
									</div>
									<div>
										<h3 className='text-lg sm:text-xl font-black text-white flex items-center gap-2'>
											<span>Zona Wali Kelas</span>
											<span className='px-2.5 py-0.5 bg-yellow-300 text-black border border-black rounded-lg text-xs font-black shadow-[1.5px_1.5px_0px_#000]'>
												{waliInfo?.nama_kelas || 'IX.G'}
											</span>
										</h3>
										<p className='text-xs font-medium text-teal-100'>
											Pengelolaan presensi, ekskul, rekap leger, & cetak rapor kelas binaan
										</p>
									</div>
								</div>
								<span className='px-2.5 py-1 bg-yellow-300 text-black text-[11px] font-black uppercase rounded-lg border border-black shrink-0'>
									4 Modul
								</span>
							</div>

							{/* Isi Card Wali Kelas: Status Rombel Binaan */}
							<div className='p-5 sm:p-6 space-y-5'>
								<div className='space-y-2.5'>
									<span className='text-xs font-black uppercase tracking-wider text-gray-700'>
										Status Kesiapan Rombel {waliInfo?.nama_kelas || 'IX.G'}:
									</span>

									<div className='grid grid-cols-2 gap-3 text-xs'>
										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1'>
											<span className='text-gray-500 font-bold block text-[11px]'>Total Siswa Binaan</span>
											<span className='text-xl font-black text-black'>{waliInfo?.total_siswa || 28} Siswa</span>
											<span className='text-[10px] text-gray-500 block font-medium'>Status: Aktif</span>
										</div>

										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1'>
											<span className='text-gray-500 font-bold block text-[11px]'>Kelengkapan Nilai Mapel</span>
											<span className='text-xl font-black text-black'>
												{waliInfo?.mapel_lengkap_count || 0} / {waliInfo?.total_mapel || 13}{' '}
												<span className='text-xs font-bold text-gray-500'>Lengkap</span>
											</span>
											<span className='text-[10px] block font-bold text-gray-600'>
												{waliInfo?.mapel_lengkap_count === waliInfo?.total_mapel && (waliInfo?.total_mapel || 0) > 0 ? (
													<span className='text-emerald-700 font-black'>Semua Mapel Lengkap</span>
												) : (
													<span>
														Angka: <strong>{waliInfo?.mapel_kuantitatif_count || 0}</strong> • Deskripsi: <strong>{waliInfo?.mapel_kualitatif_count || 0}</strong>
													</span>
												)}
											</span>
										</div>

										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1'>
											<span className='text-gray-500 font-bold block text-[11px]'>Presensi Semester</span>
											<span className='text-sm font-black text-black'>
												{waliInfo?.presensi_count > 0 ? (
													<span className='text-emerald-700 flex items-center gap-1'>
														<CheckCircle2 className='w-4 h-4' /> {waliInfo.presensi_count} Siswa Terisi
													</span>
												) : (
													<span className='text-amber-700 flex items-center gap-1'>
														<Clock className='w-4 h-4' /> Belum Tersimpan
													</span>
												)}
											</span>
											<span className='text-[10px] text-gray-500 block font-medium'>Rekap Sakit, Izin, Alfa</span>
										</div>

										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1'>
											<span className='text-gray-500 font-bold block text-[11px]'>Ekstrakurikuler</span>
											<span className='text-sm font-black text-black'>
												{waliInfo?.ekskul_count > 0 ? (
													<span className='text-emerald-700 flex items-center gap-1'>
														<CheckCircle2 className='w-4 h-4' /> {waliInfo.ekskul_count} Siswa Terisi
													</span>
												) : (
													<span className='text-amber-700 flex items-center gap-1'>
														<Clock className='w-4 h-4' /> Belum Tersimpan
													</span>
												)}
											</span>
											<span className='text-[10px] text-gray-500 block font-medium'>Nilai Ekskul & Pramuka</span>
										</div>
									</div>
								</div>

								{/* 4 Tombol Modul Kerja Wali Kelas */}
								<div className='space-y-2 pt-2 border-t-2 border-dashed border-gray-200'>
									<span className='text-xs font-black uppercase tracking-wider text-gray-700'>
										Menu Modul Wali Kelas:
									</span>

									<div className='grid grid-cols-2 gap-2.5'>
										<Link
											href='/erapor/ketidakhadiran'
											className='p-3 bg-rose-100 hover:bg-rose-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<UserCheck className='w-4 h-4 text-rose-800 shrink-0' />
												<span className='text-xs font-black text-black'>Presensi Rapor</span>
											</div>
											<ArrowRight className='w-3.5 h-3.5 text-black' />
										</Link>

										<Link
											href='/erapor/ekstrakurikuler'
											className='p-3 bg-violet-100 hover:bg-violet-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<Award className='w-4 h-4 text-violet-800 shrink-0' />
												<span className='text-xs font-black text-black'>Ekstrakurikuler</span>
											</div>
											<ArrowRight className='w-3.5 h-3.5 text-black' />
										</Link>

										<Link
											href='/erapor/rekap-leger'
											className='p-3 bg-orange-100 hover:bg-orange-200 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<TableProperties className='w-4 h-4 text-orange-800 shrink-0' />
												<span className='text-xs font-black text-black'>Leger Nilai</span>
											</div>
											<ArrowRight className='w-3.5 h-3.5 text-black' />
										</Link>

										<Link
											href='/erapor/cetak'
											className='p-3 bg-yellow-200 hover:bg-yellow-300 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<Printer className='w-4 h-4 text-black shrink-0' />
												<span className='text-xs font-black text-black'>Cetak Rapor A4</span>
											</div>
											<ArrowRight className='w-3.5 h-3.5 text-black' />
										</Link>
									</div>
								</div>
							</div>
						</div>

						<div className='p-4 bg-teal-50 border-t-2 border-black text-xs text-gray-700 font-medium flex items-center justify-between'>
							<span>Kelas Binaan: <strong>{waliInfo?.nama_kelas || 'IX.G'}</strong></span>
							<span>Status: <strong>Siap Dicetak Setelah Semua Mapel Selesai</strong></span>
						</div>
					</div>
				)}
			</div>
				</>
			)}
		</div>
	);
}
