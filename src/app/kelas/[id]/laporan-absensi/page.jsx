'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
	ChevronLeft,
	Calendar as CalendarIcon,
	Download,
	Printer,
	Search,
	Users,
	CheckCircle2,
	AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { normStatus, isJumatOrLibur } from '@/lib/absensiUtils';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import { useAcademic } from '@/context/AcademicContext';
import Loader from '@/app/components/loading';

const bulanOptions = [
	{ value: 'all', label: 'Semua Bulan (Semester)' },
	{ value: '01', label: 'Januari' },
	{ value: '02', label: 'Februari' },
	{ value: '03', label: 'Maret' },
	{ value: '04', label: 'April' },
	{ value: '05', label: 'Mei' },
	{ value: '06', label: 'Juni' },
	{ value: '07', label: 'Juli' },
	{ value: '08', label: 'Agustus' },
	{ value: '09', label: 'September' },
	{ value: '10', label: 'Oktober' },
	{ value: '11', label: 'November' },
	{ value: '12', label: 'Desember' },
];

export default function LaporanAbsensiPage() {
	const params = useParams();
	const router = useRouter();
	const id = params?.id;

	const { tahunAjar = '2026/2027', semester = 1 } = useAcademic() || {};

	const [namaKelas, setNamaKelas] = useState('');
	const [waliKelasName, setWaliKelasName] = useState('');
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [selectedBulan, setSelectedBulan] = useState(() => {
		const m = new Date().getMonth() + 1;
		return String(m).padStart(2, '0');
	});
	const [selectedTahun, setSelectedTahun] = useState(() => String(new Date().getFullYear()));
	const [rekapData, setRekapData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [loadingKelas, setLoadingKelas] = useState(true);
	const [error, setError] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [tampilanStyle, setTampilanStyle] = useState('jumlah'); // 'jumlah' | 'persentase'

	// 1. Fetch Informasi Profil Sekolah
	useEffect(() => {
		fetchSchoolProfile().then((profile) => {
			if (profile) setSchoolProfile(profile);
		});
	}, []);

	// 2. Fetch Informasi Kelas
	useEffect(() => {
		const fetchKelas = async () => {
			if (!id) return;
			try {
				setLoadingKelas(true);
				const supabase = createClient();
				const { data: dataKelas, error: errKelas } = await supabase
					.from('kelas')
					.select('nama_kelas, wali_kelas')
					.eq('id', id)
					.single();
				if (errKelas) throw errKelas;

				if (dataKelas) {
					setNamaKelas(dataKelas.nama_kelas);
					setWaliKelasName(dataKelas.wali_kelas || 'Wali Kelas');
				}
			} catch (err) {
				console.error('Error fetching kelas:', err);
				setError('Gagal memuat profil kelas.');
			} finally {
				setLoadingKelas(false);
			}
		};

		fetchKelas();
	}, [id]);

	// 3. Fetch Rekap Absensi
	const fetchRekap = useCallback(async () => {
		if (!namaKelas || !selectedBulan) return;

		setLoading(true);
		setError(null);
		try {
			const res = await fetch(
				`/api/absensi/rekap?kelas=${encodeURIComponent(namaKelas)}&bulan=${selectedBulan}&tahun=${selectedTahun}`
			);
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || data.details || 'Gagal memuat rekap absensi');
			}
			setRekapData(data);
		} catch (err) {
			console.error('Error fetching rekap:', err);
			setError(err.message);
			setRekapData(null);
		} finally {
			setLoading(false);
		}
	}, [namaKelas, selectedBulan, selectedTahun]);

	// Otomatis fetch saat kelas atau bulan berubah
	useEffect(() => {
		if (namaKelas) {
			fetchRekap();
		}
	}, [namaKelas, selectedBulan, selectedTahun, fetchRekap]);

	// Filter Siswa by Search Query
	const filteredSiswa = useMemo(() => {
		if (!rekapData?.siswa) return [];
		if (!searchQuery.trim()) return rekapData.siswa;
		const q = searchQuery.toLowerCase().trim();
		return rekapData.siswa.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && String(s.nis).toLowerCase().includes(q))
		);
	}, [rekapData?.siswa, searchQuery]);

	// Ringkasan Keseluruhan Kelas
	const classStats = useMemo(() => {
		if (!rekapData?.siswa || rekapData.siswa.length === 0) {
			return { totalSiswa: 0, avgRate: 0, totalA_JP: 0, hariEfektif: 0 };
		}
		const totalSiswa = rekapData.siswa.length;
		const hariEfektif = rekapData.tanggalList ? rekapData.tanggalList.length : 0;
		let totalHadir = 0;
		let totalPertemuanSemua = 0;
		let totalA_JP = 0;

		rekapData.siswa.forEach((s) => {
			const h = s.ringkasan?.H || 0;
			const total = (s.ringkasan?.H || 0) + (s.ringkasan?.S || 0) + (s.ringkasan?.I || 0) + (s.ringkasan?.A || 0);
			totalHadir += h;
			totalPertemuanSemua += total;
			totalA_JP += s.ringkasan?.A_JP || 0;
		});

		const avgRate = totalPertemuanSemua > 0 ? Math.round((totalHadir / totalPertemuanSemua) * 100) : 0;
		return { totalSiswa, avgRate, totalA_JP, hariEfektif };
	}, [rekapData]);

	// Sortir Tanggal
	const sortedTanggalList = useMemo(() => {
		if (!rekapData?.tanggalList || !Array.isArray(rekapData.tanggalList)) return [];
		return [...rekapData.tanggalList].sort((a, b) => new Date(a) - new Date(b));
	}, [rekapData?.tanggalList]);

	// Hitung Jumlah Siswa Hadir Harian untuk Baris Footer Rekap
	const dailyHadirCounts = useMemo(() => {
		if (!rekapData?.siswa || !sortedTanggalList.length) return {};
		const counts = {};
		sortedTanggalList.forEach((tgl) => {
			counts[tgl] = rekapData.siswa.filter((s) => normStatus(s.absensi?.[tgl]?.status) === 'hadir').length;
		});
		return counts;
	}, [rekapData?.siswa, sortedTanggalList]);

	// Akumulasi Total Seluruh Siswa Rombel (H, S, I, A, A_JP)
	const classTotals = useMemo(() => {
		if (!rekapData?.siswa) return { h: 0, s: 0, i: 0, a: 0, aJp: 0 };
		let h = 0;
		let s = 0;
		let i = 0;
		let a = 0;
		let aJp = 0;
		rekapData.siswa.forEach((siswa) => {
			h += siswa.ringkasan?.H || 0;
			s += siswa.ringkasan?.S || 0;
			i += siswa.ringkasan?.I || 0;
			a += siswa.ringkasan?.A || 0;
			aJp += siswa.ringkasan?.A_JP || 0;
		});
		return { h, s, i, a, aJp };
	}, [rekapData?.siswa]);

	// Format Tanggal Hari Ini untuk Tanda Tangan Cetak
	const todayFormatted = useMemo(() => {
		return new Date().toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});
	}, []);

	const bulanLabel = bulanOptions.find((b) => b.value === selectedBulan)?.label || 'Bulan';

	// Ekspor Excel
	const exportToExcel = () => {
		if (!rekapData?.siswa || rekapData.siswa.length === 0) {
			Swal.fire('Data Kosong', 'Tidak ada data presensi yang cocok untuk diekspor.', 'info');
			return;
		}

		const headers = ['No', 'NIS', 'Nama Lengkap Siswa'];
		sortedTanggalList.forEach((tanggal) => {
			const d = new Date(tanggal);
			const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
			headers.push(`${d.getDate()} (${dayName})`);
		});
		headers.push('Hadir (H)', 'Izin (I)', 'Sakit (S)', 'Alfa (A)', 'JP Alfa', '% Kehadiran');

		const rows = rekapData.siswa.map((siswa, idx) => {
			const row = [siswa.nomor_absen || (idx + 1), siswa.nis || '-', siswa.nama_lengkap];
			sortedTanggalList.forEach((tgl) => {
				const rec = siswa.absensi?.[tgl];
				const st = normStatus(rec?.status);
				const code =
					st === 'hadir' ? 'H' : st === 'izin' ? 'I' : st === 'sakit' ? 'S' : st === 'alfa' ? 'A' : '-';
				row.push(code);
			});
			const h = siswa.ringkasan?.H || 0;
			const i = siswa.ringkasan?.I || 0;
			const s = siswa.ringkasan?.S || 0;
			const a = siswa.ringkasan?.A || 0;
			const aJp = siswa.ringkasan?.A_JP || 0;
			const total = h + i + s + a;
			const rate = total > 0 ? `${Math.round((h / total) * 100)}%` : '0%';
			row.push(h, i, s, a, aJp, rate);
			return row;
		});

		const worksheetData = [
			[`REKAPITULASI PRESENSI SISWA - KELAS ${rekapData.kelas}`],
			[`Periode: ${rekapData.periode} | Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
			[`Wali Kelas: ${waliKelasName} | Total Rombel: ${rekapData.siswa.length} Siswa`],
			[],
			headers,
			...rows,
		];

		const ws = XLSX.utils.aoa_to_sheet(worksheetData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');
		XLSX.writeFile(wb, `Rekap_Presensi_${rekapData.kelas}_${bulanLabel}_${selectedTahun}.xlsx`);
		Swal.fire('Berhasil!', 'Berkas Excel berhasil diunduh.', 'success');
	};

	if (loadingKelas) {
		return <Loader text='Memuat data kelas...' />;
	}

	return (
		<>
			{/* ============================================================== */}
			{/* 1. TAMPILAN LAYAR UTAMA (PRINT: HIDDEN)                        */}
			{/* ============================================================== */}
			<div className='print:hidden min-h-screen bg-[#FFFDF8] p-4 sm:p-6 lg:p-8 space-y-6'>
				{/* TOP BAR / BREADCRUMB */}
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[3px] border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_0px_#0D0D0D] rounded-2xl'>
					<div className='flex items-center gap-3'>
						<Link
							href='/wali-kelas?tab=presensi'
							className='p-2 bg-yellow-300 hover:bg-yellow-400 border-[2px] border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
							<ChevronLeft className='w-5 h-5 text-black' />
						</Link>
						<div>
							<div className='flex flex-wrap items-center gap-2 mb-0.5'>
								<span className='px-2.5 py-0.5 rounded-lg border border-black bg-emerald-300 text-emerald-950 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
									🏫 Rombel: {namaKelas}
								</span>
								<span className='px-2.5 py-0.5 rounded-lg border border-black bg-yellow-200 text-yellow-950 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
									Wali: {waliKelasName}
								</span>
							</div>
							<h1 className='text-xl sm:text-2xl font-black uppercase tracking-tight text-[#0D0D0D] flex items-center gap-2'>
								<span>📑</span> Rekap Bulanan Presensi Siswa
							</h1>
						</div>
					</div>

					<div className='flex items-center gap-2'>
						<Link
							href={`/kelas/${id}/riwayat-absensi`}
							className='px-3.5 py-2 bg-white hover:bg-yellow-200 border-[2px] border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5'>
							<CalendarIcon className='w-4 h-4 text-black' />
							<span>Buka Rekap Kalender →</span>
						</Link>
					</div>
				</div>

				{/* METRICS STATS BAR */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
					<div className='p-4 bg-[#E2F7F4] border-[2px] border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between text-xs font-black uppercase text-[#007A6C]'>
							<span>Total Siswa</span>
							<Users className='w-4 h-4' />
						</div>
						<div className='text-2xl sm:text-3xl font-black text-[#0D0D0D] mt-1'>{classStats.totalSiswa}</div>
						<div className='text-[10px] font-bold text-gray-600 mt-0.5'>Siswa aktif terdaftar</div>
					</div>

					<div className='p-4 bg-[#FEF9C3] border-[2px] border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between text-xs font-black uppercase text-amber-900'>
							<span>Tingkat Hadir</span>
							<CheckCircle2 className='w-4 h-4' />
						</div>
						<div className='text-2xl sm:text-3xl font-black text-[#0D0D0D] mt-1'>{classStats.avgRate}%</div>
						<div className='text-[10px] font-bold text-gray-600 mt-0.5'>Rata-rata kehadiran kelas</div>
					</div>

					<div className='p-4 bg-[#E0F2FE] border-[2px] border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between text-xs font-black uppercase text-sky-900'>
							<span>Hari KBM</span>
							<CalendarIcon className='w-4 h-4' />
						</div>
						<div className='text-2xl sm:text-3xl font-black text-[#0D0D0D] mt-1'>{classStats.hariEfektif} Hari</div>
						<div className='text-[10px] font-bold text-gray-600 mt-0.5'>Hari efektif pada periode ini</div>
					</div>

					<div className='p-4 bg-[#FFE4E6] border-[2px] border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between text-xs font-black uppercase text-rose-900'>
							<span>Akumulasi Alfa</span>
							<AlertTriangle className='w-4 h-4' />
						</div>
						<div className='text-2xl sm:text-3xl font-black text-[#E8451A] mt-1'>{classStats.totalA_JP} JP</div>
						<div className='text-[10px] font-bold text-gray-600 mt-0.5'>Total jam pelajaran alfa</div>
					</div>
				</div>

				{/* FILTER & CONTROL PANEL */}
				<div className='border-[3px] border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_0px_#0D0D0D] rounded-2xl space-y-4'>
					<div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
						{/* Pemilih Periode Bulan & Tahun */}
						<div className='flex flex-wrap items-center gap-3'>
							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Pilih Bulan:</label>
								<select
									value={selectedBulan}
									onChange={(e) => setSelectedBulan(e.target.value)}
									className='px-3 py-2 bg-[#FFFDF0] border-[2px] border-[#0D0D0D] font-black text-xs rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] outline-none cursor-pointer'>
									{bulanOptions.map((b) => (
										<option key={b.value} value={b.value}>
											{b.label}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Tahun:</label>
								<select
									value={selectedTahun}
									onChange={(e) => setSelectedTahun(e.target.value)}
									className='px-3 py-2 bg-[#FFFDF0] border-[2px] border-[#0D0D0D] font-black text-xs rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] outline-none cursor-pointer'>
									{[2025, 2026, 2027].map((yr) => (
										<option key={yr} value={String(yr)}>
											{yr}
										</option>
									))}
								</select>
							</div>

							{/* Toggle View Mode: Jumlah Hari vs Persentase */}
							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Tampilan Angka:</label>
								<div className='flex items-center p-0.5 border-[2px] border-black rounded-xl bg-gray-100 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<button
										type='button'
										onClick={() => setTampilanStyle('jumlah')}
										className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${
											tampilanStyle === 'jumlah'
												? 'bg-yellow-300 text-black border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'
												: 'text-gray-600 hover:text-black'
										}`}>
										Jumlah (Hari)
									</button>
									<button
										type='button'
										onClick={() => setTampilanStyle('persentase')}
										className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all ${
											tampilanStyle === 'persentase'
												? 'bg-yellow-300 text-black border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'
												: 'text-gray-600 hover:text-black'
										}`}>
										Persen (%)
									</button>
								</div>
							</div>
						</div>

						{/* Search & Export Buttons */}
						<div className='flex flex-wrap items-center gap-2 lg:justify-end'>
							<div className='relative w-full sm:w-64'>
								<Search className='w-4 h-4 absolute left-3 top-2.5 text-gray-500' />
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder='Cari nama atau NIS...'
									className='w-full pl-9 pr-7 py-2 bg-[#FFFDF0] border-[2px] border-[#0D0D0D] font-bold text-xs rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] outline-none'
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className='absolute right-2.5 top-2 text-xs font-black text-gray-400 hover:text-black'>
										✕
									</button>
								)}
							</div>

							<button
								onClick={exportToExcel}
								className='px-3.5 py-2 bg-emerald-300 hover:bg-emerald-400 border-[2px] border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
								<Download className='w-4 h-4' />
								<span>Excel</span>
							</button>

							<button
								onClick={() => window.print()}
								title='Cetak Rekap Presensi Resmi (A4 Landscape)'
								className='px-3.5 py-2 bg-sky-200 hover:bg-sky-300 border-[2px] border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
								<Printer className='w-4 h-4' />
								<span>Cetak Rekap (A4)</span>
							</button>
						</div>
					</div>

					{/* Status Legend Bar */}
					<div className='pt-3 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-3 text-xs'>
						<div className='flex flex-wrap items-center gap-2'>
							<span className='font-black uppercase text-gray-500 text-[11px]'>Keterangan:</span>
							<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-200 border border-black rounded-lg font-black text-[11px] shadow-[1px_1px_0px_0px_#0D0D0D]'>
								H = Hadir
							</span>
							<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-200 border border-black rounded-lg font-black text-[11px] shadow-[1px_1px_0px_0px_#0D0D0D]'>
								S = Sakit
							</span>
							<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-200 border border-black rounded-lg font-black text-[11px] shadow-[1px_1px_0px_0px_#0D0D0D]'>
								I = Izin
							</span>
							<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-200 border border-black rounded-lg font-black text-[11px] shadow-[1px_1px_0px_0px_#0D0D0D]'>
								A = Alfa
							</span>
							<span className='inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 border border-purple-800 text-purple-950 rounded-lg font-bold text-[11px]'>
								🕌 Jum&apos;at = Libur
							</span>
						</div>
						<div className='text-gray-500 font-bold text-[11px]'>
							Menampilkan <b>{filteredSiswa.length}</b> siswa
						</div>
					</div>
				</div>

				{/* TABLE MATRIKS BULANAN (SCREEN DISPLAY) */}
				<div className='border-[3px] border-[#0D0D0D] bg-white shadow-[6px_6px_0px_0px_#0D0D0D] rounded-2xl overflow-hidden'>
					{loading ? (
						<div className='p-12 text-center'>
							<Loader text='Memuat data rekap bulanan...' />
						</div>
					) : error ? (
						<div className='p-8 text-center space-y-3'>
							<div className='p-3 bg-rose-100 border-2 border-rose-500 text-rose-900 rounded-xl font-bold text-xs max-w-md mx-auto'>
								{error}
							</div>
							<button
								onClick={fetchRekap}
								className='px-4 py-2 bg-yellow-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
								Coba Muat Ulang
							</button>
						</div>
					) : filteredSiswa.length === 0 ? (
						<div className='p-12 text-center space-y-2'>
							<span className='text-3xl'>🔍</span>
							<p className='text-base font-black text-black'>Tidak ada data presensi yang sesuai.</p>
							<p className='text-xs text-gray-500'>
								{searchQuery ? `Tidak ada siswa dengan kata kunci "${searchQuery}"` : 'Belum ada rekaman KBM pada bulan ini.'}
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse min-w-[900px]'>
								<thead>
									<tr className='bg-[#0D0D0D] text-white text-xs uppercase font-black'>
										<th className='p-3 border-r border-gray-700 w-12 text-center sticky left-0 bg-[#0D0D0D] z-20'>No</th>
										<th className='p-3 border-r border-gray-700 w-28'>NIS</th>
										<th className='p-3 border-r border-gray-700 min-w-[200px] sticky left-12 bg-[#0D0D0D] z-20'>Nama Siswa</th>

										{/* Kolom Tanggal */}
										{sortedTanggalList.map((tgl) => {
											const d = new Date(tgl);
											const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
											const isJum = isJumatOrLibur(tgl);

											return (
												<th
													key={tgl}
													className={`p-2 text-center border-r border-gray-700 min-w-[42px] ${
														isJum ? 'bg-purple-950 text-purple-200' : ''
													}`}>
													<div className='text-xs font-black'>{d.getDate()}</div>
													<div className='text-[9px] font-mono text-gray-400 uppercase'>{dayName}</div>
												</th>
											);
										})}

										{/* Kolom Ringkasan */}
										<th className='p-2 text-center border-r border-gray-700 bg-emerald-950 text-emerald-300 w-12'>H</th>
										<th className='p-2 text-center border-r border-gray-700 bg-amber-950 text-amber-300 w-12'>S</th>
										<th className='p-2 text-center border-r border-gray-700 bg-sky-950 text-sky-300 w-12'>I</th>
										<th className='p-2 text-center border-r border-gray-700 bg-rose-950 text-rose-300 w-14'>A</th>
										<th className='p-2 text-center bg-gray-900 text-yellow-300 w-16'>%</th>
									</tr>
								</thead>

								<tbody className='divide-y-2 divide-gray-200 text-xs font-bold'>
									{filteredSiswa.map((siswa, idx) => {
										const h = siswa.ringkasan?.H || 0;
										const s = siswa.ringkasan?.S || 0;
										const i = siswa.ringkasan?.I || 0;
										const a = siswa.ringkasan?.A || 0;
										const aJp = siswa.ringkasan?.A_JP || 0;
										const totalPertemuan = Math.max(sortedTanggalList.length, 1);
										const totalDiikuti = h + s + i + a;
										const rate = totalDiikuti > 0 ? Math.round((h / totalDiikuti) * 100) : 0;

										const formatVal = (v) => {
											if (tampilanStyle === 'jumlah') return v;
											return `${Math.round((v / totalPertemuan) * 100)}%`;
										};

										return (
											<tr key={siswa.id} className='hover:bg-yellow-50/70 transition-colors'>
												<td className='p-3 text-center border-r border-gray-300 sticky left-0 bg-white hover:bg-yellow-50 z-10 font-mono'>
													{siswa.nomor_absen || (idx + 1)}
												</td>
												<td className='p-3 border-r border-gray-300 font-mono text-gray-600 text-[11px]'>
													{siswa.nis || '-'}
												</td>
												<td className='p-3 border-r border-gray-300 sticky left-12 bg-white hover:bg-yellow-50 z-10 font-black text-black'>
													{siswa.nama_lengkap}
												</td>

												{/* Kolom Status Tanggal */}
												{sortedTanggalList.map((tgl) => {
													const rec = siswa.absensi?.[tgl];
													const st = normStatus(rec?.status);
													const isJum = isJumatOrLibur(tgl);

													let badgeClass = 'text-gray-300';
													let label = '-';

													if (st === 'hadir') {
														badgeClass = 'bg-emerald-200 text-emerald-950 border border-black';
														label = 'H';
													} else if (st === 'sakit') {
														badgeClass = 'bg-amber-200 text-amber-950 border border-black';
														label = 'S';
													} else if (st === 'izin') {
														badgeClass = 'bg-sky-200 text-sky-950 border border-black';
														label = 'I';
													} else if (st === 'alfa') {
														badgeClass = 'bg-rose-300 text-rose-950 border border-black';
														label = 'A';
													} else if (isJum) {
														label = '•';
														badgeClass = 'text-purple-300';
													}

													return (
														<td
															key={tgl}
															className={`p-1.5 text-center border-r border-gray-200 ${
																isJum ? 'bg-purple-50/50' : ''
															}`}
															title={rec?.keterangan ? `${st}: ${rec.keterangan}` : st !== '-' ? st : ''}>
															{label !== '-' && label !== '•' ? (
																<span
																	className={`inline-block w-7 h-7 leading-7 rounded-lg text-center font-black text-[11px] shadow-[1px_1px_0px_0px_#0D0D0D] ${badgeClass}`}>
																	{label}
																</span>
															) : (
																<span className={`text-xs ${badgeClass}`}>{label}</span>
															)}
														</td>
													);
												})}

												{/* Ringkasan H/S/I/A */}
												<td className='p-2 text-center border-r border-gray-300 bg-emerald-50/60 font-black text-emerald-950'>
													{formatVal(h)}
												</td>
												<td className='p-2 text-center border-r border-gray-300 bg-amber-50/60 font-black text-amber-950'>
													{formatVal(s)}
												</td>
												<td className='p-2 text-center border-r border-gray-300 bg-sky-50/60 font-black text-sky-950'>
													{formatVal(i)}
												</td>
												<td className='p-2 text-center border-r border-gray-300 bg-rose-50/60 font-black text-rose-950'>
													<div>{formatVal(a)}</div>
													{aJp > 0 && (
														<div className='text-[9px] font-mono text-rose-700 leading-none'>
															{aJp} JP
														</div>
													)}
												</td>
												<td className='p-2 text-center bg-gray-50 font-black text-black font-mono text-xs'>
													{rate}%
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>

			{/* ============================================================== */}
			{/* 2. LEMBAR CETAK DOKUMEN RESMI (A4 LANDSCAPE PRINT ONLY)        */}
			{/* Hanya tampil saat browser memicu window.print()                */}
			{/* ============================================================== */}
			<div id='printable-laporan-absensi' className='hidden print:block w-full text-black font-sans bg-white p-0 m-0'>
				{/* KOP SURAT RESMI SEKOLAH */}
				<div className='border-b-2 border-black pb-2 mb-3'>
					<div className='flex items-center justify-between gap-3'>
						<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
							{schoolProfile.logo_kiri ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img src={schoolProfile.logo_kiri} alt='Logo Kiri' className='max-w-full max-h-full object-contain' />
							) : (
								<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded flex items-center justify-center font-bold text-[9px] text-gray-500'>
									LOGO
								</div>
							)}
						</div>

						<div className='flex-1 text-center px-1'>
							<p className='text-xs font-black uppercase text-gray-800 tracking-wider leading-tight'>
								{schoolProfile.kementerian || 'YAYASAN AL-ISHLAH KUALA GADING'}
							</p>
							<h1 className='text-base sm:text-lg font-black uppercase text-black leading-tight mt-0.5 tracking-wide'>
								{schoolProfile.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
							</h1>
							<p className='text-[10px] font-bold text-gray-700 font-mono mt-0.5'>
								NPSN: {schoolProfile.npsn || '69953165'} &bull; Akreditasi: {schoolProfile.akreditasi || 'A (Unggul)'}
							</p>
							<p className='text-[9px] text-gray-600 mt-0.5 leading-snug'>
								{schoolProfile.alamat || 'Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355'}
							</p>
							{(schoolProfile.telepon || schoolProfile.email) && (
								<p className='text-[8.5px] text-gray-500 mt-0.5'>
									{schoolProfile.telepon ? `Telp: ${schoolProfile.telepon}` : ''}
									{schoolProfile.telepon && schoolProfile.email ? ' | ' : ''}
									{schoolProfile.email ? `Email: ${schoolProfile.email}` : ''}
								</p>
							)}
						</div>

						<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
							{schoolProfile.logo_kanan ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img src={schoolProfile.logo_kanan} alt='Logo Kanan' className='max-w-full max-h-full object-contain' />
							) : (
								<div className='w-16 h-16' />
							)}
						</div>
					</div>

					{/* Garis Ganda Kop Surat */}
					<div className='mt-2 space-y-0.5'>
						<div className='border-b-2 border-black'></div>
						<div className='border-b border-black/70'></div>
					</div>
				</div>

				{/* JUDUL REKAP & IDENTITAS ROMBEL */}
				<div className='text-center my-2'>
					<h2 className='text-sm font-black uppercase tracking-wider text-black underline underline-offset-4 decoration-2'>
						REKAPITULASI PRESENSI SISWA {selectedBulan === 'all' ? 'SEMESTER' : 'BULANAN'}
					</h2>
					<p className='text-[10.5px] font-bold uppercase text-gray-800 mt-1'>
						KELAS: <span className='font-black underline'>{namaKelas}</span> &bull; PERIODE:{' '}
						<span className='font-black'>
							{selectedBulan === 'all'
								? `Semua Bulan ${selectedTahun} (T.A. ${tahunAjar})`
								: `${bulanLabel} ${selectedTahun}`}
						</span>
					</p>
				</div>

				{/* METADATA RINGKASAN ROMBEL */}
				<div className='flex justify-between items-center text-[10px] border border-black/40 bg-gray-50 px-3 py-1.5 rounded mb-2.5'>
					<div>
						<span className='font-bold text-gray-600'>Wali Kelas:</span>{' '}
						<span className='font-black text-black'>{waliKelasName}</span>
					</div>
					<div>
						<span className='font-bold text-gray-600'>Hari Efektif KBM:</span>{' '}
						<span className='font-black text-black'>{classStats.hariEfektif} Hari</span>
					</div>
					<div>
						<span className='font-bold text-gray-600'>Rata-rata Kehadiran:</span>{' '}
						<span className='font-black text-black'>{classStats.avgRate}%</span>
					</div>
					<div>
						<span className='font-bold text-gray-600'>Total Siswa:</span>{' '}
						<span className='font-black text-black'>
							{filteredSiswa.length} Siswa{searchQuery ? ` (Filter: "${searchQuery}")` : ''}
						</span>
					</div>
					<div>
						<span className='font-bold text-gray-600'>Akumulasi Alpa:</span>{' '}
						<span className='font-black text-rose-800'>{classStats.totalA_JP} JP</span>
					</div>
				</div>

				{/* TABEL MATRIKS PRESENSI RESMI */}
				{selectedBulan === 'all' ? (
					/* Tampilan Rekap Semester (Jika 'Semua Bulan' dipilih) */
					<table className='w-full text-black border-collapse border border-black'>
						<thead>
							<tr className='bg-gray-100 text-[10px] font-black uppercase text-center border-b border-black'>
								<th className='py-2 px-1 border-r border-black w-8 text-center'>No</th>
								<th className='py-2 px-2 border-r border-black w-24 text-center font-mono'>NIS</th>
								<th className='py-2 px-3 border-r border-black text-left'>Nama Siswa</th>
								<th className='py-2 px-2 border-r border-black w-20 text-center bg-emerald-100/60 font-black'>Hadir (H)</th>
								<th className='py-2 px-2 border-r border-black w-20 text-center bg-amber-100/60 font-black'>Sakit (S)</th>
								<th className='py-2 px-2 border-r border-black w-20 text-center bg-sky-100/60 font-black'>Izin (I)</th>
								<th className='py-2 px-2 border-r border-black w-20 text-center bg-rose-100/60 font-black'>Alfa (A)</th>
								<th className='py-2 px-2 border-r border-black w-24 text-center font-mono'>Akumulasi JP Alfa</th>
								<th className='py-2 px-2 border-r border-black w-24 text-center bg-gray-200 font-black'>% Kehadiran</th>
								<th className='py-2 px-3 text-center w-36'>Evaluasi / Predikat</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-black/40 text-[9.5px]'>
							{filteredSiswa.map((siswa, idx) => {
								const h = siswa.ringkasan?.H || 0;
								const s = siswa.ringkasan?.S || 0;
								const i = siswa.ringkasan?.I || 0;
								const a = siswa.ringkasan?.A || 0;
								const aJp = siswa.ringkasan?.A_JP || 0;
								const total = h + s + i + a;
								const rate = total > 0 ? Math.round((h / total) * 100) : 0;

								let predikat = 'Sangat Baik';
								let predikatClass = 'text-emerald-800 font-bold';
								if (rate < 75) {
									predikat = 'Perlu Pembinaan';
									predikatClass = 'text-rose-800 font-black';
								} else if (rate < 85) {
									predikat = 'Cukup';
									predikatClass = 'text-amber-800 font-bold';
								} else if (rate < 95) {
									predikat = 'Baik';
									predikatClass = 'text-sky-800 font-bold';
								}

								return (
									<tr key={siswa.id} className='text-center'>
										<td className='py-1.5 px-1 border-r border-black/40 font-mono'>{siswa.nomor_absen || (idx + 1)}</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-mono text-gray-700'>{siswa.nis || '-'}</td>
										<td className='py-1.5 px-3 border-r border-black/40 text-left font-bold uppercase'>{siswa.nama_lengkap}</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-bold bg-emerald-50/40'>{h} Hari</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-bold bg-amber-50/40'>{s} Hari</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-bold bg-sky-50/40'>{i} Hari</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-bold bg-rose-50/40 text-rose-800'>{a} Hari</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-mono'>{aJp > 0 ? `${aJp} JP` : '-'}</td>
										<td className='py-1.5 px-2 border-r border-black/40 font-black font-mono bg-gray-100/60'>{rate}%</td>
										<td className={`py-1.5 px-3 ${predikatClass}`}>{predikat}</td>
									</tr>
								);
							})}
						</tbody>
						<tfoot>
							<tr className='bg-gray-100 border-t-2 border-black font-black text-[10px] text-center'>
								<td colSpan={3} className='py-2 px-3 border-r border-black text-right uppercase'>
									Total Keseluruhan Kelas
								</td>
								<td className='py-2 px-2 border-r border-black font-mono bg-emerald-100'>{classTotals.h} Hari</td>
								<td className='py-2 px-2 border-r border-black font-mono bg-amber-100'>{classTotals.s} Hari</td>
								<td className='py-2 px-2 border-r border-black font-mono bg-sky-100'>{classTotals.i} Hari</td>
								<td className='py-2 px-2 border-r border-black font-mono bg-rose-100'>{classTotals.a} Hari</td>
								<td className='py-2 px-2 border-r border-black font-mono'>{classTotals.aJp} JP</td>
								<td className='py-2 px-2 border-r border-black font-mono bg-gray-200'>{classStats.avgRate}%</td>
								<td className='py-2 px-3 font-mono text-gray-600'>-</td>
							</tr>
						</tfoot>
					</table>
				) : (
					/* Tampilan Rekap Bulanan Lengkap (Matriks Tanggal 1..31) */
					<table className='w-full text-black border-collapse border border-black'>
						<thead>
							<tr className='bg-gray-100 text-[10px] font-black uppercase text-center border-b border-black'>
								<th rowSpan={2} className='py-1.5 px-1 border-r border-black w-7 text-center'>
									No
								</th>
								<th rowSpan={2} className='py-1.5 px-1 border-r border-black w-16 text-center font-mono'>
									NIS
								</th>
								<th rowSpan={2} className='py-1.5 px-2 border-r border-black text-left min-w-[150px]'>
									Nama Siswa
								</th>
								<th
									colSpan={Math.max(sortedTanggalList.length, 1)}
									className='py-1 px-1 border-r border-black text-center text-[9px]'>
									Tanggal Pelaksanaan KBM ({bulanLabel} {selectedTahun})
								</th>
								<th colSpan={5} className='py-1 px-1 text-center text-[9px]'>
									Rekap Kehadiran
								</th>
							</tr>
							<tr className='bg-gray-100 text-[9px] font-black uppercase text-center border-b border-black'>
								{sortedTanggalList.length === 0 ? (
									<th className='py-1 px-2 border-r border-black text-gray-400 font-normal'>-</th>
								) : (
									sortedTanggalList.map((tgl) => {
										const d = new Date(tgl);
										const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
										const isJum = isJumatOrLibur(tgl);

										return (
											<th
												key={tgl}
												className={`py-0.5 px-0.5 border-r border-black min-w-[20px] max-w-[28px] ${
													isJum ? 'bg-gray-200 text-gray-600' : ''
												}`}>
												<div className='font-black text-[9.5px] leading-tight'>{d.getDate()}</div>
												<div className='text-[7.5px] font-bold text-gray-600 uppercase leading-none'>
													{dayName}
												</div>
											</th>
										);
									})
								)}
								<th className='py-1 px-1 border-r border-black w-7 text-center bg-emerald-100/60 font-black'>H</th>
								<th className='py-1 px-1 border-r border-black w-7 text-center bg-amber-100/60 font-black'>S</th>
								<th className='py-1 px-1 border-r border-black w-7 text-center bg-sky-100/60 font-black'>I</th>
								<th className='py-1 px-1 border-r border-black w-7 text-center bg-rose-100/60 font-black'>A</th>
								<th className='py-1 px-1 w-10 text-center bg-gray-200 font-black'>%</th>
							</tr>
						</thead>

						<tbody className='divide-y divide-black/40 text-[9px]'>
							{filteredSiswa.map((siswa, idx) => {
								const h = siswa.ringkasan?.H || 0;
								const s = siswa.ringkasan?.S || 0;
								const i = siswa.ringkasan?.I || 0;
								const a = siswa.ringkasan?.A || 0;
								const aJp = siswa.ringkasan?.A_JP || 0;
								const total = h + s + i + a;
								const rate = total > 0 ? Math.round((h / total) * 100) : 0;

								return (
									<tr key={siswa.id} className='text-center'>
										<td className='py-1 px-1 border-r border-black/40 font-mono'>{siswa.nomor_absen || (idx + 1)}</td>
										<td className='py-1 px-1 border-r border-black/40 font-mono text-gray-700'>
											{siswa.nis || '-'}
										</td>
										<td className='py-1 px-2 border-r border-black/40 text-left font-bold truncate max-w-[190px]'>
											{siswa.nama_lengkap}
										</td>

										{/* Kolom Tanggal KBM */}
										{sortedTanggalList.length === 0 ? (
											<td className='py-1 px-1 border-r border-black/40 text-gray-400'>-</td>
										) : (
											sortedTanggalList.map((tgl) => {
												const rec = siswa.absensi?.[tgl];
												const st = normStatus(rec?.status);
												const isJum = isJumatOrLibur(tgl);

												let code = '-';
												let cellBg = '';
												let fontClass = 'text-gray-400';

												if (st === 'hadir') {
													code = 'H';
													fontClass = 'font-bold text-black';
												} else if (st === 'sakit') {
													code = 'S';
													fontClass = 'font-black text-amber-800';
													cellBg = 'bg-amber-50';
												} else if (st === 'izin') {
													code = 'I';
													fontClass = 'font-black text-sky-800';
													cellBg = 'bg-sky-50';
												} else if (st === 'alfa') {
													code = 'A';
													fontClass = 'font-black text-rose-800';
													cellBg = 'bg-rose-100';
												} else if (isJum) {
													code = '•';
													fontClass = 'text-gray-400';
													cellBg = 'bg-gray-100';
												}

												return (
													<td
														key={tgl}
														className={`py-1 px-0.5 border-r border-black/40 ${fontClass} ${cellBg}`}>
														{code}
													</td>
												);
											})
										)}

										{/* Summary Columns */}
										<td className='py-1 px-1 border-r border-black/40 font-bold bg-emerald-50/40 text-emerald-950'>
											{h}
										</td>
										<td className='py-1 px-1 border-r border-black/40 font-bold bg-amber-50/40 text-amber-950'>
											{s}
										</td>
										<td className='py-1 px-1 border-r border-black/40 font-bold bg-sky-50/40 text-sky-950'>
											{i}
										</td>
										<td className='py-1 px-1 border-r border-black/40 font-bold bg-rose-50/40 text-rose-950'>
											{a}
											{aJp > 0 && <span className='text-[7.5px] block font-mono text-rose-700 leading-none'>({aJp} JP)</span>}
										</td>
										<td className='py-1 px-1 font-black font-mono bg-gray-100/60'>
											{rate}%
										</td>
									</tr>
								);
							})}
						</tbody>

						{/* Footer Baris Jumlah Siswa Hadir Harian */}
						<tfoot>
							<tr className='bg-gray-100 border-t-2 border-black font-black text-[9px] text-center'>
								<td colSpan={3} className='py-1.5 px-2 border-r border-black text-right uppercase'>
									Jumlah Hadir Harian (Siswa)
								</td>
								{sortedTanggalList.length === 0 ? (
									<td className='py-1 px-1 border-r border-black'>-</td>
								) : (
									sortedTanggalList.map((tgl) => {
										const count = dailyHadirCounts[tgl] || 0;
										const isJum = isJumatOrLibur(tgl);
										return (
											<td
												key={tgl}
												className={`py-1 px-0.5 border-r border-black font-mono ${
													isJum ? 'bg-gray-200 text-gray-500' : ''
												}`}>
												{isJum ? '-' : count}
											</td>
										);
									})
								)}
								<td className='py-1 px-1 border-r border-black font-mono bg-emerald-100 font-black'>
									{classTotals.h}
								</td>
								<td className='py-1 px-1 border-r border-black font-mono bg-amber-100 font-black'>
									{classTotals.s}
								</td>
								<td className='py-1 px-1 border-r border-black font-mono bg-sky-100 font-black'>
									{classTotals.i}
								</td>
								<td className='py-1 px-1 border-r border-black font-mono bg-rose-100 font-black'>
									{classTotals.a}
								</td>
								<td className='py-1 px-1 font-mono bg-gray-200 font-black'>
									{classStats.avgRate}%
								</td>
							</tr>
						</tfoot>
					</table>
				)}

				{/* LEGENDA STATUS & CATATAN KEBIJAKAN */}
				<div className='mt-2.5 flex items-center justify-between text-[8.5px] text-gray-700 border-b border-gray-300 pb-1'>
					<div>
						<span className='font-bold'>Keterangan Status:</span> H = Hadir &bull; S = Sakit &bull; I = Izin &bull; A = Alpa/Alfa &bull; JP = Jam Pelajaran Alpa.
					</div>
					<div>
						* Kehadiran minimal 1 JP dalam sehari diakui Hadir Harian. Hari Jum&apos;at libur KBM.
					</div>
				</div>

				{/* LEMBAR PENGESAHAN / TANDA TANGAN */}
				<div className='signature-block mt-6 grid grid-cols-2 text-center text-xs' style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
					<div>
						<p className='text-[10px] font-bold'>Mengetahui,</p>
						<p className='text-[10px] text-gray-700'>Kepala {schoolProfile.nama_sekolah || 'Sekolah'}</p>
						<div className='h-16'></div>
						<p className='font-black border-t border-black/70 pt-1 w-52 mx-auto uppercase text-[10.5px]'>
							{schoolProfile.nama_kepsek || 'Mujib Kodar, S.Pd,I'}
						</p>
						<p className='text-[9px] text-gray-600 font-mono'>
							{schoolProfile.nip_kepsek ? `NIP. ${schoolProfile.nip_kepsek}` : 'NIP. -'}
						</p>
					</div>

					<div>
						<p className='text-[10px] font-bold'>
							Kuala Gading, {todayFormatted}
						</p>
						<p className='text-[10px] text-gray-700'>Wali Kelas {namaKelas}</p>
						<div className='h-16'></div>
						<p className='font-black border-t border-black/70 pt-1 w-52 mx-auto uppercase text-[10.5px]'>
							{waliKelasName || 'Wali Kelas'}
						</p>
						<p className='text-[9px] text-gray-600 font-mono'>NIP. -</p>
					</div>
				</div>

				{/* FOOTER CETAK WATERMARK */}
				<div className='mt-5 pt-1 border-t border-gray-300 flex justify-between items-center text-[8px] text-gray-400 font-mono'>
					<span>Dicetak otomatis melalui Guru App - Sistem Administrasi KBM & Presensi Digital</span>
					<span>Waktu Cetak: {new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB</span>
				</div>
			</div>

			{/* ============================================================== */}
			{/* 3. CSS KHUSUS PENCETAKAN A4 LANDSCAPE                           */}
			{/* ============================================================== */}
			<style dangerouslySetInnerHTML={{
				__html: `
					@media print {
						@page {
							size: A4 landscape;
							margin: 8mm 10mm;
						}
						html, body {
							background: #ffffff !important;
							color: #000000 !important;
							margin: 0 !important;
							padding: 0 !important;
							width: 100% !important;
							height: auto !important;
							overflow: visible !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
							font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
						}
						.print\\:hidden,
						header,
						aside,
						nav,
						#sidebar,
						[role="navigation"] {
							display: none !important;
						}
						#printable-laporan-absensi {
							display: block !important;
							position: static !important;
							width: 100% !important;
							max-width: 100% !important;
							margin: 0 !important;
							padding: 0 !important;
							background: #ffffff !important;
						}
						table {
							border-collapse: collapse !important;
							width: 100% !important;
						}
						thead {
							display: table-header-group !important;
						}
						tfoot {
							display: table-footer-group !important;
						}
						tr {
							page-break-inside: avoid !important;
							break-inside: avoid !important;
						}
						.signature-block {
							page-break-inside: avoid !important;
							break-inside: avoid !important;
						}
					}
				`
			}} />
		</>
	);
}
