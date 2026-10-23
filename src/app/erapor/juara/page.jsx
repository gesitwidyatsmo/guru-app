'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
	Trophy,
	Crown,
	Award,
	Download,
	Search,
	FileSpreadsheet,
	Filter,
	Sparkles,
	Printer,
	ChevronRight,
	ExternalLink,
	CheckCircle2,
} from 'lucide-react';
import { useERaporAuth } from '../ERaporLayoutClient';
import { generateSinglePiagamPDF, generateBatchPiagamPDF } from '@/lib/pdfPiagam';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';

export default function ERaporJuaraPage() {
	const auth = useERaporAuth();
	const [activeTab, setActiveTab] = useState('kelas'); // 'kelas' | 'umum'
	const [loading, setLoading] = useState(true);

	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [juaraData, setJuaraData] = useState(null);

	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedTingkat, setSelectedTingkat] = useState('sekolah'); // 'sekolah' | 'VII' | 'VIII' | 'IX'
	const [searchQuery, setSearchQuery] = useState('');

	// Load Master & Data Juara
	const loadData = useCallback(async () => {
		try {
			setLoading(true);
			const [resTahun, resJuara, pProfile] = await Promise.all([
				fetch('/api/tahun-ajar'),
				fetch(`/api/erapor/juara?tahun_ajaran=${encodeURIComponent(tahunAjaran)}&semester=${semester}`),
				fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
			]);

			if (pProfile) setSchoolProfile(pProfile);

			if (resTahun.ok) {
				const tData = await resTahun.json();
				const aktif = tData.find((t) => t.is_aktif) || tData[0];
				if (aktif && (!tahunAjaran || tahunAjaran === '2026/2027')) {
					setTahunAjaran(aktif.nama || '2026/2027');
					setSemester(aktif.semester || 1);
				}
			}

			if (resJuara.ok) {
				const jData = await resJuara.json();
				setJuaraData(jData);
				if (jData?.kelas_list?.length > 0 && !selectedKelas) {
					setSelectedKelas(jData.kelas_list[0].nama_kelas);
				}
			}
		} catch (err) {
			console.error('Error load data juara:', err);
			Swal.fire('Error', 'Gagal memuat rekapitulasi juara kelas & umum.', 'error');
		} finally {
			setLoading(false);
		}
	}, [tahunAjaran, semester, selectedKelas]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const kelasList = juaraData?.kelas_list || [];
	const juaraKelasMap = juaraData?.juara_kelas_map || {};
	const juaraUmum = juaraData?.juara_umum || {};

	// Siswa di kelas yang dipilih (Hanya 1-3 Besar Saja)
	const currentClassStudents = useMemo(() => {
		if (selectedKelas === 'ALL') {
			const all = [];
			Object.keys(juaraKelasMap).forEach((k) => {
				const top3 = (juaraKelasMap[k] || []).slice(0, 3);
				all.push(...top3);
			});
			if (!searchQuery.trim()) return all;
			const q = searchQuery.toLowerCase();
			return all.filter(
				(s) =>
					s.nama_lengkap?.toLowerCase().includes(q) ||
					s.nis?.includes(q) ||
					s.kelas?.toLowerCase().includes(q)
			);
		}

		if (!selectedKelas || !juaraKelasMap[selectedKelas]) return [];
		const list = (juaraKelasMap[selectedKelas] || []).slice(0, 3);
		if (!searchQuery.trim()) return list;
		const q = searchQuery.toLowerCase();
		return list.filter((s) => s.nama_lengkap?.toLowerCase().includes(q) || s.nis?.includes(q));
	}, [selectedKelas, juaraKelasMap, searchQuery]);

	// Top 3 Kelas Terpilih
	const top3Kelas = useMemo(() => {
		if (selectedKelas === 'ALL') {
			const firstK = Object.keys(juaraKelasMap)[0];
			return (juaraKelasMap[firstK] || []).slice(0, 3);
		}
		if (!selectedKelas || !juaraKelasMap[selectedKelas]) return [];
		return (juaraKelasMap[selectedKelas] || []).slice(0, 3);
	}, [selectedKelas, juaraKelasMap]);

	// Data Juara Umum Terpilih (Hanya 1-3 Besar Saja)
	const currentJuaraUmumList = useMemo(() => {
		let list = [];
		if (selectedTingkat === 'VII') list = (juaraUmum.tingkat_7 || []).slice(0, 3);
		else if (selectedTingkat === 'VIII') list = (juaraUmum.tingkat_8 || []).slice(0, 3);
		else if (selectedTingkat === 'IX') list = (juaraUmum.tingkat_9 || []).slice(0, 3);
		else list = (juaraUmum.sekolah || []).slice(0, 3);

		if (!searchQuery.trim()) return list;
		const q = searchQuery.toLowerCase();
		return list.filter((s) => s.nama_lengkap?.toLowerCase().includes(q) || s.kelas?.toLowerCase().includes(q));
	}, [selectedTingkat, juaraUmum, searchQuery]);

	// Top 3 Juara Umum Terpilih
	const top3Umum = useMemo(() => {
		return currentJuaraUmumList.slice(0, 3);
	}, [currentJuaraUmumList]);

	// -------------------------------------------------------------
	// HANDLER CETAK PIAGAM
	// -------------------------------------------------------------

	// 1. Cetak Piagam Single Siswa
	const handleCetakPiagamSingle = (siswa, defaultLabel) => {
		try {
			const label = defaultLabel || siswa.juara_label || `PERINGKAT KE-${siswa.rank_kelas || 1} KELAS ${siswa.kelas}`;
			generateSinglePiagamPDF({
				siswa,
				juaraLabel: label,
				kategori: 'Hasil Belajar Akademik (E-Rapor)',
				kelas: siswa.kelas,
				tahunAjaran,
				semester,
				schoolProfile,
				tanggalPiagam: schoolProfile.tanggal_rapor_ganjil || '20 Desember 2026',
				waliKelasName: siswa.wali_kelas,
				waliKelasNip: siswa.nip_wali,
				rataRata: siswa.rata_rata,
				totalNilai: siswa.total_nilai,
			});
			Swal.fire({
				title: 'Piagam Diunduh!',
				text: `Piagam penghargaan untuk ${siswa.nama_lengkap} berhasil dibuat.`,
				icon: 'success',
				confirmButtonColor: '#00A693',
			});
		} catch (err) {
			Swal.fire('Gagal Cetak', err.message, 'error');
		}
	};

	// 2. Cetak Piagam Juara 1, 2, 3 untuk Kelas yang Aktif (Batch 3 Siswa)
	const handleCetakPiagamTop3Kelas = () => {
		if (top3Kelas.length === 0) {
			Swal.fire('Perhatian', 'Belum ada data nilai di kelas ini.', 'warning');
			return;
		}

		try {
			const items = top3Kelas.map((s) => ({
				siswa: s,
				juaraLabel: s.juara_label || `JUARA KELAS ${selectedKelas}`,
				kelas: selectedKelas,
				waliKelasName: s.wali_kelas,
				waliKelasNip: s.nip_wali,
				rataRata: s.rata_rata,
				totalNilai: s.total_nilai,
			}));

			generateBatchPiagamPDF(items, {
				schoolProfile,
				tahunAjaran,
				semester,
				tanggalPiagam: schoolProfile.tanggal_rapor_ganjil || '20 Desember 2026',
				batchTitle: `Piagam_Top3_Kelas_${selectedKelas}`,
			});

			Swal.fire('Berhasil!', `Piagam Juara 1, 2, dan 3 Kelas ${selectedKelas} berhasil digenerate!`, 'success');
		} catch (err) {
			Swal.fire('Gagal Cetak', err.message, 'error');
		}
	};

	// 3. Cetak Piagam Semua Juara 1, 2, 3 Seluruh Rombel Sekolah
	const handleCetakSemuaJuaraKelas = () => {
		const allTopItems = [];
		kelasList.forEach((k) => {
			const classTop = (juaraKelasMap[k.nama_kelas] || []).slice(0, 3);
			classTop.forEach((s) => {
				allTopItems.push({
					siswa: s,
					juaraLabel: s.juara_label || `JUARA KELAS ${k.nama_kelas}`,
					kelas: k.nama_kelas,
					waliKelasName: s.wali_kelas,
					waliKelasNip: s.nip_wali,
					rataRata: s.rata_rata,
					totalNilai: s.total_nilai,
				});
			});
		});

		if (allTopItems.length === 0) {
			Swal.fire('Perhatian', 'Belum ada data juara kelas yang tersedia.', 'warning');
			return;
		}

		try {
			generateBatchPiagamPDF(allTopItems, {
				schoolProfile,
				tahunAjaran,
				semester,
				tanggalPiagam: schoolProfile.tanggal_rapor_ganjil || '20 Desember 2026',
				batchTitle: `Piagam_Semua_Juara_Kelas_${tahunAjaran.replace('/', '-')}`,
			});

			Swal.fire({
				title: 'Cetak Massal Berhasil!',
				text: `Sebanyak ${allTopItems.length} lembar piagam juara kelas berhasil digenerate ke dalam 1 berkas PDF.`,
				icon: 'success',
				confirmButtonColor: '#00A693',
			});
		} catch (err) {
			Swal.fire('Gagal Cetak', err.message, 'error');
		}
	};

	// 4. Cetak Piagam Juara Umum
	const handleCetakPiagamJuaraUmum = () => {
		const listToPrint = top3Umum;
		if (listToPrint.length === 0) {
			Swal.fire('Perhatian', 'Belum ada data juara umum untuk kategori ini.', 'warning');
			return;
		}

		try {
			const labelTingkat = selectedTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedTingkat}`;
			const items = listToPrint.map((s) => ({
				siswa: s,
				juaraLabel: s.juara_label || `JUARA UMUM ${labelTingkat}`,
				kelas: s.kelas,
				waliKelasName: s.wali_kelas,
				rataRata: s.rata_rata,
				totalNilai: s.total_nilai,
			}));

			generateBatchPiagamPDF(items, {
				schoolProfile,
				tahunAjaran,
				semester,
				tanggalPiagam: schoolProfile.tanggal_rapor_ganjil || '20 Desember 2026',
				batchTitle: `Piagam_Juara_Umum_${labelTingkat.replace(/\s+/g, '_')}`,
			});

			Swal.fire('Berhasil!', `Piagam Juara Umum (${labelTingkat}) berhasil digenerate!`, 'success');
		} catch (err) {
			Swal.fire('Gagal Cetak', err.message, 'error');
		}
	};

	// Ekspor Rekap Juara (1-3 Besar Saja) ke Excel
	const handleExportExcel = () => {
		try {
			const wb = XLSX.utils.book_new();

			// Sheet 1: Juara 1-3 Semua Kelas
			const allTop3Rows = [];
			Object.keys(juaraKelasMap).forEach((kls) => {
				(juaraKelasMap[kls] || []).slice(0, 3).forEach((s) => {
					allTop3Rows.push({
						Kelas: s.kelas,
						Peringkat: `Juara ${s.rank_kelas}`,
						NIS: s.nis || '-',
						'Nama Lengkap': s.nama_lengkap,
						'Total Nilai': s.total_nilai,
						'Rata-Rata': s.rata_rata,
						Predikat: s.juara_label,
						'Wali Kelas': s.wali_kelas || '-',
					});
				});
			});
			const ws1 = XLSX.utils.json_to_sheet(allTop3Rows);
			XLSX.utils.book_append_sheet(wb, ws1, 'Juara 1-3 Tiap Rombel');

			// Sheet 2: Juara Umum (1-3 Besar)
			const umumRows = (juaraUmum.sekolah || []).slice(0, 3).map((s, idx) => ({
				'Kategori Juara': `Juara Umum ${idx + 1}`,
				Peringkat: idx + 1,
				NIS: s.nis || '-',
				'Nama Lengkap': s.nama_lengkap,
				Kelas: s.kelas,
				'Total Nilai': s.total_nilai,
				'Rata-Rata': s.rata_rata,
				Predikat: s.juara_label,
			}));
			const ws2 = XLSX.utils.json_to_sheet(umumRows);
			XLSX.utils.book_append_sheet(wb, ws2, 'Juara Umum Top 3');

			XLSX.writeFile(wb, `Rekap_Juara_Top3_Rapor_${tahunAjaran.replace('/', '-')}_Sem${semester}.xlsx`);
			Swal.fire('Ekspor Berhasil!', 'Data Juara 1-3 per kelas dan Juara Umum berhasil diekspor ke Excel.', 'success');
		} catch (err) {
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	if (loading) return <Loader text='Mengkalkulasi Peringkat & Juara Rapor...' />;

	return (
		<div className='space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-100 border-3 border-black rounded-3xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-black text-amber-300 rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<Trophy className='w-4 h-4' />
						<span>Prestasi & Rekapitulasi Rapor</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Juara Kelas & Juara Umum
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-800 mt-1 max-w-2xl'>
						Peringkat resmi hasil belajar akademik santri / siswa, podium prestasi, serta pencetakan piagam penghargaan resmi sekolah.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 flex-wrap'>
					<span className='px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
						TA {tahunAjaran} • Sem {semester}
					</span>
					<button
						onClick={handleExportExcel}
						className='px-3.5 py-2 bg-emerald-300 hover:bg-emerald-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all cursor-pointer'>
						<FileSpreadsheet className='w-4 h-4' />
						<span>Ekspor Excel</span>
					</button>
				</div>
			</div>

			{/* Tab Switcher: Juara Kelas vs Juara Umum */}
			<div className='flex flex-wrap items-center justify-between gap-3 bg-white p-2 border-3 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
				<div className='flex items-center gap-2'>
					<button
						onClick={() => setActiveTab('kelas')}
						className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
							activeTab === 'kelas'
								? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
								: 'text-gray-700 hover:bg-gray-100'
						}`}>
						<Award className='w-4 h-4' />
						<span>Juara Kelas (Per Rombel)</span>
					</button>

					<button
						onClick={() => setActiveTab('umum')}
						className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
							activeTab === 'umum'
								? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
								: 'text-gray-700 hover:bg-gray-100'
						}`}>
						<Crown className='w-4 h-4' />
						<span>Juara Umum (Tingkat & Sekolah)</span>
						<span className='px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-black'>
							Grand Top
						</span>
					</button>
				</div>

				{/* Quick Actions Cetak Piagam Massal */}
				<div className='flex items-center gap-2 pr-1'>
					{activeTab === 'kelas' ? (
						<>
							<button
								onClick={handleCetakPiagamTop3Kelas}
								className='px-3 py-1.5 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
								<Printer className='w-3.5 h-3.5' />
								<span>Cetak Piagam Juara 1-3 ({selectedKelas})</span>
							</button>
							<button
								onClick={handleCetakSemuaJuaraKelas}
								className='px-3 py-1.5 bg-rose-300 hover:bg-rose-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
								<Award className='w-3.5 h-3.5' />
								<span>Cetak Semua Juara Kelas (Batch)</span>
							</button>
						</>
					) : (
						<button
							onClick={handleCetakPiagamJuaraUmum}
							className='px-3 py-1.5 bg-amber-400 hover:bg-amber-500 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
							<Crown className='w-3.5 h-3.5' />
							<span>Cetak Piagam Juara Umum Top 3</span>
						</button>
					)}
				</div>
			</div>

			{/* ========================================================================= */}
			{/* KONTEN TAB 1: JUARA KELAS (PER ROMBEL)                                     */}
			{/* ========================================================================= */}
			{activeTab === 'kelas' && (
				<div className='space-y-6'>
					{/* Toolbar Pemilihan Rombel Kelas */}
					<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
						<div className='flex flex-wrap items-center gap-3 flex-1'>
							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-700 flex items-center gap-1.5'>
									<Filter className='w-4 h-4' />
									<span>Pilih Rombel:</span>
								</span>
								<select
									value={selectedKelas}
									onChange={(e) => setSelectedKelas(e.target.value)}
									className='px-3 py-2 bg-yellow-100 border-2 border-black rounded-xl text-xs font-black cursor-pointer shadow-[2px_2px_0px_#000] focus:outline-none'>
									<option value='ALL'>★ Rekap Semua Rombel (Juara 1-3)</option>
									{kelasList.map((k) => (
										<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
											Kelas {k.nama_kelas} (Juara 1-3)
										</option>
									))}
								</select>
							</div>

							<div className='relative flex-1 min-w-[200px]'>
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder='Cari nama atau NIS siswa...'
									className='w-full pl-8 pr-3 py-2 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000] focus:outline-none'
								/>
								<Search className='w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400' />
							</div>
						</div>

						<div className='text-xs font-bold text-gray-600 shrink-0'>
							Total: <span className='font-black text-black'>{currentClassStudents.length} Santri Juara (1–3)</span>
						</div>
					</div>

					{/* PODIUM TOP 3 JUARA KELAS */}
					{selectedKelas === 'ALL' ? (
						<div className='bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_#000] flex items-center gap-3'>
							<Trophy className='w-6 h-6 text-amber-600 shrink-0' />
							<p className='text-xs font-bold text-gray-800'>
								Menampilkan rekapitulasi peringkat <span className='font-black text-black'>Juara I, II, dan III (Top 3)</span> dari setiap rombel kelas di sekolah. Pilih rombel tertentu pada filter dropdown untuk melihat podium visual per kelas.
							</p>
						</div>
					) : (
						<div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
							{/* Juara 2 (Perak) */}
							<div className='order-2 md:order-1 bg-gradient-to-b from-slate-100 to-slate-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3 relative overflow-hidden'>
								<div className='w-12 h-12 mx-auto rounded-full bg-slate-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
									🥈
								</div>
								<span className='inline-block px-3 py-0.5 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
									Juara II Kelas
								</span>
								<div>
									<h3 className='text-base font-black text-black line-clamp-1'>
										{top3Kelas[1]?.nama_lengkap || 'Belum Ada Data'}
									</h3>
									<p className='text-[11px] font-mono font-bold text-gray-600'>NIS: {top3Kelas[1]?.nis || '-'}</p>
								</div>
								<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
									<p className='text-xs font-black text-slate-900'>Rata-Rata: {top3Kelas[1]?.rata_rata || '0.00'}</p>
									<p className='text-[10px] font-bold text-gray-500'>Total: {top3Kelas[1]?.total_nilai || 0}</p>
								</div>
								{top3Kelas[1] && (
									<button
										onClick={() => handleCetakPiagamSingle(top3Kelas[1], `JUARA II KELAS ${selectedKelas}`)}
										className='w-full py-2 bg-slate-300 hover:bg-slate-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
										<Printer className='w-3.5 h-3.5' />
										<span>Cetak Piagam Juara 2</span>
									</button>
								)}
							</div>

							{/* Juara 1 (Emas - Center Big) */}
							<div className='order-1 md:order-2 bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-200 border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] text-center space-y-3 relative overflow-hidden -translate-y-2'>
								<div className='w-16 h-16 mx-auto rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-3xl font-black shadow-[3px_3px_0px_#000] animate-bounce'>
									🥇
								</div>
								<span className='inline-block px-4 py-1 bg-amber-950 text-yellow-300 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]'>
									★ JUARA I KELAS ★
								</span>
								<div>
									<h3 className='text-lg font-black text-black line-clamp-1'>
										{top3Kelas[0]?.nama_lengkap || 'Belum Ada Data'}
									</h3>
									<p className='text-xs font-mono font-bold text-amber-900'>NIS: {top3Kelas[0]?.nis || '-'}</p>
								</div>
								<div className='p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
									<p className='text-sm font-black text-amber-950'>Rata-Rata: {top3Kelas[0]?.rata_rata || '0.00'}</p>
									<p className='text-[11px] font-bold text-gray-600'>Total Nilai: {top3Kelas[0]?.total_nilai || 0}</p>
								</div>
								{top3Kelas[0] && (
									<button
										onClick={() => handleCetakPiagamSingle(top3Kelas[0], `JUARA I KELAS ${selectedKelas}`)}
										className='w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
										<Trophy className='w-4 h-4' />
										<span>Cetak Piagam Juara 1</span>
									</button>
								)}
							</div>

							{/* Juara 3 (Perunggu) */}
							<div className='order-3 md:order-3 bg-gradient-to-b from-amber-100 to-amber-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3 relative overflow-hidden'>
								<div className='w-12 h-12 mx-auto rounded-full bg-amber-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
									🥉
								</div>
								<span className='inline-block px-3 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
									Juara III Kelas
								</span>
								<div>
									<h3 className='text-base font-black text-black line-clamp-1'>
										{top3Kelas[2]?.nama_lengkap || 'Belum Ada Data'}
									</h3>
									<p className='text-[11px] font-mono font-bold text-gray-600'>NIS: {top3Kelas[2]?.nis || '-'}</p>
								</div>
								<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
									<p className='text-xs font-black text-amber-950'>Rata-Rata: {top3Kelas[2]?.rata_rata || '0.00'}</p>
									<p className='text-[10px] font-bold text-gray-500'>Total: {top3Kelas[2]?.total_nilai || 0}</p>
								</div>
								{top3Kelas[2] && (
									<button
										onClick={() => handleCetakPiagamSingle(top3Kelas[2], `JUARA III KELAS ${selectedKelas}`)}
										className='w-full py-2 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
										<Printer className='w-3.5 h-3.5' />
										<span>Cetak Piagam Juara 3</span>
									</button>
								)}
							</div>
						</div>
					)}

					{/* Tabel Peringkat Lengkap Kelas */}
					<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 border-b-2 border-black bg-yellow-200 flex items-center justify-between'>
							<h3 className='text-sm font-black text-black uppercase flex items-center gap-2'>
								<Award className='w-4 h-4' />
								<span>
									{selectedKelas === 'ALL'
										? 'Rekapitulasi Juara I, II, dan III (Seluruh Rombel)'
										: `Daftar Juara I, II, dan III (Top 3) — Kelas ${selectedKelas}`}
								</span>
							</h3>
							{selectedKelas !== 'ALL' && (
								<span className='text-xs font-bold text-gray-700'>
									Wali Kelas: {top3Kelas[0]?.wali_kelas || 'Belum Terploting'}
								</span>
							)}
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse text-xs'>
								<thead>
									<tr className='border-b-2 border-black bg-gray-50 font-black uppercase text-[11px] text-gray-700'>
										<th className='py-3 px-4 text-center w-16'>Rank</th>
										{selectedKelas === 'ALL' && <th className='py-3 px-4 text-center'>Rombel</th>}
										<th className='py-3 px-4'>NIS</th>
										<th className='py-3 px-4'>Nama Lengkap Santri / Siswa</th>
										<th className='py-3 px-4 text-center'>Total Nilai</th>
										<th className='py-3 px-4 text-center'>Rata-Rata</th>
										<th className='py-3 px-4 text-center'>Predikat Prestasi</th>
										<th className='py-3 px-4 text-right'>Aksi Piagam</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-gray-100 font-bold'>
									{currentClassStudents.length === 0 ? (
										<tr>
											<td colSpan={selectedKelas === 'ALL' ? 8 : 7} className='text-center py-8 text-gray-500'>
												Belum ada nilai yang diinput untuk kategori ini.
											</td>
										</tr>
									) : (
										currentClassStudents.map((item) => {
											const isTop3 = item.rank_kelas <= 3;
											const badgeColor =
												item.rank_kelas === 1
													? 'bg-amber-300 border-amber-600 text-amber-950 font-black'
													: item.rank_kelas === 2
													? 'bg-slate-200 border-slate-400 text-slate-900 font-black'
													: item.rank_kelas === 3
													? 'bg-amber-100 border-amber-500 text-amber-900 font-black'
													: 'bg-gray-100 border-gray-300 text-gray-700';

											return (
												<tr
													key={`${item.id}-${item.kelas}`}
													className={`hover:bg-yellow-50/60 transition-colors ${
														isTop3 ? 'bg-yellow-50/30 font-bold' : ''
													}`}>
													<td className='py-3 px-4 text-center'>
														<span
															className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-black font-black text-xs shadow-[1px_1px_0px_#000] ${
																item.rank_kelas === 1
																	? 'bg-yellow-400 text-black'
																	: item.rank_kelas === 2
																	? 'bg-slate-300 text-black'
																	: item.rank_kelas === 3
																	? 'bg-amber-300 text-black'
																	: 'bg-white text-gray-700'
															}`}>
															{item.rank_kelas}
														</span>
													</td>
													{selectedKelas === 'ALL' && (
														<td className='py-3 px-4 text-center'>
															<span className='px-2.5 py-0.5 bg-black text-yellow-300 rounded font-black text-xs'>
																{item.kelas}
															</span>
														</td>
													)}
													<td className='py-3 px-4 font-mono text-gray-600'>{item.nis || '-'}</td>
													<td className='py-3 px-4 text-black font-black'>
														<div className='flex items-center gap-2'>
															<span>{item.nama_lengkap}</span>
															{item.rank_kelas === 1 && <span title='Juara 1'>👑</span>}
														</div>
													</td>
													<td className='py-3 px-4 text-center font-mono'>{item.total_nilai}</td>
													<td className='py-3 px-4 text-center'>
														<span className='px-2.5 py-1 bg-white border-2 border-black rounded-lg font-black font-mono shadow-[1px_1px_0px_#000]'>
															{item.rata_rata}
														</span>
													</td>
													<td className='py-3 px-4 text-center'>
														<span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${badgeColor}`}>
															{item.juara_label}
														</span>
													</td>
													<td className='py-3 px-4 text-right'>
														<button
															onClick={() => handleCetakPiagamSingle(item)}
															className='px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 cursor-pointer'>
															<Printer className='w-3 h-3' />
															<span>Cetak Piagam</span>
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* KONTEN TAB 2: JUARA UMUM (TINGKAT & KESELURUHAN SEKOLAH)                   */}
			{/* ========================================================================= */}
			{activeTab === 'umum' && (
				<div className='space-y-6'>
					{/* Toolbar Filter Tingkat */}
					<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
						<div className='flex flex-wrap items-center gap-2.5'>
							<span className='text-xs font-black uppercase text-gray-700 flex items-center gap-1.5'>
								<Crown className='w-4 h-4 text-amber-600' />
								<span>Kategori Juara Umum:</span>
							</span>
							<button
								onClick={() => setSelectedTingkat('sekolah')}
								className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
									selectedTingkat === 'sekolah'
										? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
										: 'bg-white hover:bg-gray-100'
								}`}>
								★ Seluruh Sekolah (Grand Champions)
							</button>
							<button
								onClick={() => setSelectedTingkat('VII')}
								className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
									selectedTingkat === 'VII'
										? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
										: 'bg-white hover:bg-gray-100'
								}`}>
								Tingkat VII (Fase D1)
							</button>
							<button
								onClick={() => setSelectedTingkat('VIII')}
								className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
									selectedTingkat === 'VIII'
										? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
										: 'bg-white hover:bg-gray-100'
								}`}>
								Tingkat VIII (Fase D2)
							</button>
							<button
								onClick={() => setSelectedTingkat('IX')}
								className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
									selectedTingkat === 'IX'
										? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
										: 'bg-white hover:bg-gray-100'
								}`}>
								Tingkat IX (Fase D3)
							</button>
						</div>

						<div className='relative min-w-[200px]'>
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='Cari nama atau kelas...'
								className='w-full pl-8 pr-3 py-1.5 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000] focus:outline-none'
							/>
							<Search className='w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400' />
						</div>
					</div>

					{/* PODIUM TOP 3 JUARA UMUM */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
						{/* Juara Umum 2 */}
						<div className='order-2 md:order-1 bg-gradient-to-b from-slate-100 to-slate-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3'>
							<div className='w-12 h-12 mx-auto rounded-full bg-slate-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
								🥈
							</div>
							<span className='inline-block px-3 py-0.5 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
								Juara Umum II
							</span>
							<div>
								<h3 className='text-base font-black text-black line-clamp-1'>
									{top3Umum[1]?.nama_lengkap || 'Belum Ada Data'}
								</h3>
								<p className='text-[11px] font-bold text-gray-600'>Kelas {top3Umum[1]?.kelas || '-'}</p>
							</div>
							<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
								<p className='text-xs font-black text-slate-900'>Rata-Rata: {top3Umum[1]?.rata_rata || '0.00'}</p>
								<p className='text-[10px] font-bold text-gray-500'>Total: {top3Umum[1]?.total_nilai || 0}</p>
							</div>
							{top3Umum[1] && (
								<button
									onClick={() =>
										handleCetakPiagamSingle(
											top3Umum[1],
											`JUARA UMUM II ${selectedTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedTingkat}`}`
										)
									}
									className='w-full py-2 bg-slate-300 hover:bg-slate-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
									<Printer className='w-3.5 h-3.5' />
									<span>Cetak Piagam Juara Umum 2</span>
								</button>
							)}
						</div>

						{/* Juara Umum 1 */}
						<div className='order-1 md:order-2 bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-200 border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] text-center space-y-3 -translate-y-2'>
							<div className='w-16 h-16 mx-auto rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-3xl font-black shadow-[3px_3px_0px_#000] animate-bounce'>
								👑
							</div>
							<span className='inline-block px-4 py-1 bg-amber-950 text-yellow-300 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]'>
								★ JUARA UMUM I ★
							</span>
							<div>
								<h3 className='text-lg font-black text-black line-clamp-1'>
									{top3Umum[0]?.nama_lengkap || 'Belum Ada Data'}
								</h3>
								<p className='text-xs font-bold text-amber-950'>Rombel Kelas {top3Umum[0]?.kelas || '-'}</p>
							</div>
							<div className='p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
								<p className='text-sm font-black text-amber-950'>Rata-Rata: {top3Umum[0]?.rata_rata || '0.00'}</p>
								<p className='text-[11px] font-bold text-gray-600'>Total Nilai: {top3Umum[0]?.total_nilai || 0}</p>
							</div>
							{top3Umum[0] && (
								<button
									onClick={() =>
										handleCetakPiagamSingle(
											top3Umum[0],
											`JUARA UMUM I ${selectedTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedTingkat}`}`
										)
									}
									className='w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
									<Crown className='w-4 h-4' />
									<span>Cetak Piagam Juara Umum 1</span>
								</button>
							)}
						</div>

						{/* Juara Umum 3 */}
						<div className='order-3 md:order-3 bg-gradient-to-b from-amber-100 to-amber-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3'>
							<div className='w-12 h-12 mx-auto rounded-full bg-amber-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
								🥉
							</div>
							<span className='inline-block px-3 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
								Juara Umum III
							</span>
							<div>
								<h3 className='text-base font-black text-black line-clamp-1'>
									{top3Umum[2]?.nama_lengkap || 'Belum Ada Data'}
								</h3>
								<p className='text-[11px] font-bold text-gray-600'>Kelas {top3Umum[2]?.kelas || '-'}</p>
							</div>
							<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
								<p className='text-xs font-black text-amber-950'>Rata-Rata: {top3Umum[2]?.rata_rata || '0.00'}</p>
								<p className='text-[10px] font-bold text-gray-500'>Total: {top3Umum[2]?.total_nilai || 0}</p>
							</div>
							{top3Umum[2] && (
								<button
									onClick={() =>
										handleCetakPiagamSingle(
											top3Umum[2],
											`JUARA UMUM III ${selectedTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedTingkat}`}`
										)
									}
									className='w-full py-2 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
									<Printer className='w-3.5 h-3.5' />
									<span>Cetak Piagam Juara Umum 3</span>
								</button>
							)}
						</div>
					</div>

					{/* Tabel Top Leaderboard Juara Umum */}
					<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 border-b-2 border-black bg-yellow-200 flex items-center justify-between'>
							<h3 className='text-sm font-black text-black uppercase flex items-center gap-2'>
								<Crown className='w-4 h-4 text-amber-700' />
								<span>
									Juara Umum I, II, dan III (Top 3) —{' '}
									{selectedTingkat === 'sekolah' ? 'Seluruh Sekolah' : `Tingkat ${selectedTingkat}`}
								</span>
							</h3>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse text-xs'>
								<thead>
									<tr className='border-b-2 border-black bg-gray-50 font-black uppercase text-[11px] text-gray-700'>
										<th className='py-3 px-4 text-center w-16'>Rank</th>
										<th className='py-3 px-4'>NIS</th>
										<th className='py-3 px-4'>Nama Lengkap Santri / Siswa</th>
										<th className='py-3 px-4 text-center'>Asal Kelas</th>
										<th className='py-3 px-4 text-center'>Total Nilai</th>
										<th className='py-3 px-4 text-center'>Rata-Rata</th>
										<th className='py-3 px-4 text-center'>Predikat Prestasi</th>
										<th className='py-3 px-4 text-right'>Aksi Piagam</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-gray-100 font-bold'>
									{currentJuaraUmumList.length === 0 ? (
										<tr>
											<td colSpan={8} className='text-center py-8 text-gray-500'>
												Tidak ada data untuk kategori tingkat ini.
											</td>
										</tr>
									) : (
										currentJuaraUmumList.map((item, idx) => {
											const rankNum = idx + 1;
											return (
												<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
													<td className='py-3 px-4 text-center'>
														<span
															className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-black font-black text-xs shadow-[1px_1px_0px_#000] ${
																rankNum === 1
																	? 'bg-yellow-400 text-black'
																	: rankNum === 2
																	? 'bg-slate-300 text-black'
																	: rankNum === 3
																	? 'bg-amber-300 text-black'
																	: 'bg-white text-gray-700'
															}`}>
															{rankNum}
														</span>
													</td>
													<td className='py-3 px-4 font-mono text-gray-600'>{item.nis || '-'}</td>
													<td className='py-3 px-4 text-black font-black'>{item.nama_lengkap}</td>
													<td className='py-3 px-4 text-center'>
														<span className='px-2.5 py-0.5 bg-black text-yellow-300 rounded font-black text-xs'>
															{item.kelas}
														</span>
													</td>
													<td className='py-3 px-4 text-center font-mono'>{item.total_nilai}</td>
													<td className='py-3 px-4 text-center'>
														<span className='px-2.5 py-1 bg-white border-2 border-black rounded-lg font-black font-mono shadow-[1px_1px_0px_#000]'>
															{item.rata_rata}
														</span>
													</td>
													<td className='py-3 px-4 text-center'>
														<span className='px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 border border-amber-400 text-amber-950'>
															{item.juara_label}
														</span>
													</td>
													<td className='py-3 px-4 text-right'>
														<button
															onClick={() => handleCetakPiagamSingle(item, item.juara_label)}
															className='px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 cursor-pointer'>
															<Printer className='w-3 h-3' />
															<span>Cetak Piagam</span>
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
