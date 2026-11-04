'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
	ChevronLeft,
	Calendar as CalendarIcon,
	Clock,
	Users,
	Search,
	CheckCircle2,
	AlertTriangle,
	HelpCircle,
	XCircle,
	FileText,
	ArrowRight,
	School,
	Filter,
	Sparkles,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { normStatus, evaluateDailyAttendance, isJumatOrLibur } from '@/lib/absensiUtils';

export default function RiwayatAbsensiPage() {
	const params = useParams();
	const router = useRouter();
	const id = params?.id;

	// State Data Master
	const [namaKelas, setNamaKelas] = useState('');
	const [waliKelasName, setWaliKelasName] = useState('');
	const [siswaList, setSiswaList] = useState([]);

	// State Riwayat Sesi (Master Sidebar)
	const [daftarSesi, setDaftarSesi] = useState([]);
	const [selectedTanggal, setSelectedTanggal] = useState('');
	const [loadingSesi, setLoadingSesi] = useState(false);
	const [searchSesi, setSearchSesi] = useState('');

	// State Detail Sesi Hari Terpilih
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [sesiMapelList, setSesiMapelList] = useState([]);
	const [detailSiswaMap, setDetailSiswaMap] = useState({}); // { siswa_id: { status, keterangan, sessions: [] } }
	const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'hadir' | 'sakit' | 'izin' | 'alfa'
	const [searchSiswa, setSearchSiswa] = useState('');

	// State UI
	const [loading, setLoading] = useState(true);

	// --- 1. Fetch Data Awal (Kelas & Siswa) ---
	useEffect(() => {
		const fetchInitial = async () => {
			if (!id) return;
			try {
				setLoading(true);
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

					const { data: dataSiswa, error: errSiswa } = await supabase
						.from('siswa')
						.select('id, nama_lengkap, nis')
						.eq('status', 'Aktif')
						.eq('kelas', dataKelas.nama_kelas)
						.order('nama_lengkap', { ascending: true });

					if (errSiswa) throw errSiswa;
					setSiswaList(dataSiswa || []);
				}
			} catch (err) {
				console.error(err);
				Swal.fire('Error', 'Gagal memuat data kelas', 'error');
			} finally {
				setLoading(false);
			}
		};
		fetchInitial();
	}, [id]);

	// --- 2. Fetch Riwayat Tanggal Sesi KBM ---
	const fetchRiwayatSesi = useCallback(async () => {
		if (!namaKelas) return;
		try {
			setLoadingSesi(true);
			const supabase = createClient();
			const [resHarian, resMapel] = await Promise.all([
				supabase.from('absensi_harian').select('tanggal').eq('kelas', namaKelas),
				supabase.from('absensi_mapel').select('tanggal').eq('kelas', namaKelas),
			]);

			const sesiSet = new Set();
			(resHarian.data || []).forEach((item) => {
				const tgl = typeof item.tanggal === 'string' ? item.tanggal.slice(0, 10) : item.tanggal;
				if (tgl && !isJumatOrLibur(tgl)) sesiSet.add(tgl);
			});
			(resMapel.data || []).forEach((item) => {
				const tgl = typeof item.tanggal === 'string' ? item.tanggal.slice(0, 10) : item.tanggal;
				if (tgl && !isJumatOrLibur(tgl)) sesiSet.add(tgl);
			});

			const sesiArray = Array.from(sesiSet).sort((a, b) => new Date(b) - new Date(a));
			setDaftarSesi(sesiArray);

			// Pilih tanggal pertama secara default jika belum ada yang terpilih
			if (sesiArray.length > 0 && !selectedTanggal) {
				setSelectedTanggal(sesiArray[0]);
			}
		} catch (err) {
			console.error('Error fetching sesi:', err);
		} finally {
			setLoadingSesi(false);
		}
	}, [namaKelas, selectedTanggal]);

	useEffect(() => {
		fetchRiwayatSesi();
	}, [fetchRiwayatSesi]);

	// Filter Sesi Sidebar by Search
	const filteredSesi = useMemo(() => {
		if (!searchSesi.trim()) return daftarSesi;
		const q = searchSesi.toLowerCase().trim();
		return daftarSesi.filter((tgl) => {
			const formatted = new Date(tgl)
				.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
				.toLowerCase();
			return tgl.toLowerCase().includes(q) || formatted.includes(q);
		});
	}, [daftarSesi, searchSesi]);

	// --- 3. Load Detail Sesi ketika Tanggal Dipilih ---
	useEffect(() => {
		if (!selectedTanggal || !namaKelas || siswaList.length === 0) {
			setSesiMapelList([]);
			setDetailSiswaMap({});
			return;
		}

		const loadSesiDetail = async () => {
			try {
				setLoadingDetail(true);
				const supabase = createClient();

				// Ambil seluruh sesi mapel pada tanggal tersebut
				const { data: mapelData, error: mapelErr } = await supabase
					.from('absensi_mapel')
					.select(`
						sesi_id, jam_ke, mapel, guru_id, created_at,
						users (nama_lengkap),
						absensi_mapel_siswa (
							siswa_id, status, keterangan
						)
					`)
					.eq('kelas', namaKelas)
					.eq('tanggal', selectedTanggal)
					.order('created_at', { ascending: true });

				if (mapelErr) throw mapelErr;

				// Simpan ringkasan sesi mapel untuk ditampilkan di header
				const mapelSummary = (mapelData || []).map((m) => ({
					sesi_id: m.sesi_id,
					jam_ke: m.jam_ke,
					mapel: m.mapel,
					guru: m.users?.nama_lengkap || 'Guru Pengampu',
				}));
				setSesiMapelList(mapelSummary);

				// Evaluasi kehadiran per siswa secara otomatis dari sesi mapel
				const map = {};
				siswaList.forEach((sw) => {
					const studentSessions = [];
					(mapelData || []).forEach((m) => {
						const rec = (m.absensi_mapel_siswa || []).find((r) => String(r.siswa_id) === String(sw.id));
						if (rec) {
							studentSessions.push({
								jam_ke: m.jam_ke,
								mapel: m.mapel,
								status: rec.status,
								keterangan: rec.keterangan || '',
							});
						}
					});

					if (studentSessions.length > 0) {
						const evalRes = evaluateDailyAttendance(studentSessions);
						map[sw.id] = {
							status: evalRes.recommendedStatus,
							keterangan: evalRes.recommendedKeterangan || '',
							studentSessions,
						};
					} else {
						map[sw.id] = {
							status: 'Hadir',
							keterangan: 'Belum ada catatan ketidakhadiran',
							studentSessions: [],
						};
					}
				});

				setDetailSiswaMap(map);
			} catch (err) {
				console.error('Error loading detail sesi:', err);
			} finally {
				setLoadingDetail(false);
			}
		};

		loadSesiDetail();
	}, [selectedTanggal, namaKelas, siswaList]);

	// Statistik Hari Terpilih
	const dailyStats = useMemo(() => {
		let hadir = 0;
		let sakit = 0;
		let izin = 0;
		let alfa = 0;

		Object.values(detailSiswaMap).forEach((st) => {
			const s = normStatus(st.status);
			if (s === 'hadir') hadir++;
			else if (s === 'sakit') sakit++;
			else if (s === 'izin') izin++;
			else if (s === 'alfa') alfa++;
		});

		const total = hadir + sakit + izin + alfa;
		const rate = total > 0 ? Math.round((hadir / total) * 100) : 0;
		return { hadir, sakit, izin, alfa, total, rate };
	}, [detailSiswaMap]);

	// Filter Siswa by Status & Search
	const filteredSiswa = useMemo(() => {
		return siswaList.filter((sw) => {
			const info = detailSiswaMap[sw.id] || { status: 'Hadir' };
			const normSt = normStatus(info.status);

			if (filterStatus !== 'all' && normSt !== filterStatus) return false;

			if (searchSiswa.trim()) {
				const q = searchSiswa.toLowerCase().trim();
				const matchName = sw.nama_lengkap && sw.nama_lengkap.toLowerCase().includes(q);
				const matchNis = sw.nis && String(sw.nis).toLowerCase().includes(q);
				if (!matchName && !matchNis) return false;
			}

			return true;
		});
	}, [siswaList, detailSiswaMap, filterStatus, searchSiswa]);

	if (loading) {
		return <Loader text='Memuat riwayat absensi kelas...' />;
	}

	return (
		<div className='min-h-screen bg-[#FFFDF8] p-4 sm:p-6 lg:p-8 space-y-6'>
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
							<span className='px-2.5 py-0.5 rounded-lg border border-black bg-purple-200 text-purple-950 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
								👁️ Mode Monitoring Wali Kelas
							</span>
						</div>
						<h1 className='text-xl sm:text-2xl font-black uppercase tracking-tight text-[#0D0D0D] flex items-center gap-2'>
							<span>📅</span> Rekap Kalender &amp; Histori Presensi
						</h1>
					</div>
				</div>

				<div className='flex items-center gap-2'>
					<Link
						href={`/kelas/${id}/laporan-absensi`}
						className='px-3.5 py-2 bg-white hover:bg-yellow-200 border-[2px] border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5'>
						<FileText className='w-4 h-4 text-black' />
						<span>Buka Rekap Bulanan (Matriks) →</span>
					</Link>
				</div>
			</div>

			{/* MASTER-DETAIL LAYOUT */}
			<div className='flex flex-col lg:flex-row gap-6 items-start'>
				{/* SIDEBAR: DAFTAR TANGGAL (MASTER) */}
				<div className='w-full lg:w-80 shrink-0 border-[3px] border-[#0D0D0D] bg-white rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden flex flex-col h-[350px] lg:h-[calc(100vh-180px)] lg:sticky top-6'>
					{/* Header Sidebar */}
					<div className='p-4 border-b-2 border-black bg-yellow-100 flex-shrink-0 space-y-2.5'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase text-black flex items-center gap-1.5'>
								<CalendarIcon className='w-4 h-4' />
								<span>Tanggal KBM ({daftarSesi.length})</span>
							</span>
							<span className='text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-black'>
								Urut Terbaru
							</span>
						</div>

						{/* Pencarian Tanggal */}
						<div className='relative'>
							<Search className='w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500' />
							<input
								type='text'
								placeholder='Cari hari atau tanggal...'
								value={searchSesi}
								onChange={(e) => setSearchSesi(e.target.value)}
								className='w-full pl-8 pr-7 py-1.5 text-xs bg-white border-2 border-black rounded-xl font-bold shadow-[1.5px_1.5px_0px_0px_#0D0D0D] outline-none'
							/>
							{searchSesi && (
								<button
									onClick={() => setSearchSesi('')}
									className='absolute right-2 top-1 text-xs font-black text-gray-400 hover:text-black'>
									✕
								</button>
							)}
						</div>
					</div>

					{/* Daftar Tanggal List */}
					<div className='flex-1 overflow-y-auto p-3 space-y-2'>
						{loadingSesi ? (
							<div className='py-8 text-center text-xs font-bold text-gray-500'>Memuat daftar hari KBM...</div>
						) : filteredSesi.length === 0 ? (
							<div className='py-8 text-center text-xs font-bold text-gray-500'>
								{searchSesi ? `Tidak ada tanggal "${searchSesi}"` : 'Belum ada riwayat KBM yang terekam.'}
							</div>
						) : (
							filteredSesi.map((tgl) => {
								const isSelected = selectedTanggal === tgl;
								const dateObj = new Date(tgl);
								const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
								const dateFormatted = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

								return (
									<button
										key={tgl}
										onClick={() => setSelectedTanggal(tgl)}
										className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
											isSelected
												? 'bg-yellow-300 border-black shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
												: 'bg-white border-black/30 hover:border-black hover:bg-yellow-50'
										}`}>
										<div className='flex items-center justify-between'>
											<div>
												<div className='text-xs font-black text-black uppercase'>{dayName}</div>
												<div className='text-[11px] font-mono text-gray-700 font-bold mt-0.5'>{dateFormatted}</div>
											</div>
											{isSelected ? (
												<span className='w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center text-xs font-black'>
													✓
												</span>
											) : (
												<ArrowRight className='w-4 h-4 text-gray-400' />
											)}
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* CONTENT DETAIL: INFORMASI HARI TERPILIH (DETAIL) */}
				<div className='flex-1 w-full space-y-6'>
					{!selectedTanggal ? (
						<div className='border-[3px] border-[#0D0D0D] bg-white rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] p-12 text-center space-y-3'>
							<span className='text-4xl'>👈</span>
							<h3 className='text-lg font-black uppercase text-black'>Pilih Tanggal di Sebelah Kiri</h3>
							<p className='text-xs text-gray-600 max-w-sm mx-auto font-bold'>
								Pilih salah satu tanggal KBM dari daftar di samping untuk melihat rincian kehadiran siswa dan sesi mata pelajaran yang terlaksana.
							</p>
						</div>
					) : (
						<>
							{/* CARD HEADER DETAIL HARI */}
							<div className='border-[3px] border-[#0D0D0D] bg-white rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] p-5 sm:p-6 space-y-4'>
								<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black'>
									<div>
										<div className='flex flex-wrap items-center gap-2 mb-1'>
											<span className='px-2.5 py-0.5 rounded-lg border border-black bg-yellow-300 text-yellow-950 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
												📅 {new Date(selectedTanggal).toLocaleDateString('id-ID', { weekday: 'long' })}
											</span>
											<span className='font-mono text-xs font-bold text-gray-600'>
												{selectedTanggal}
											</span>
										</div>
										<h2 className='text-xl sm:text-2xl font-black uppercase text-black'>
											{new Date(selectedTanggal).toLocaleDateString('id-ID', {
												day: 'numeric',
												month: 'long',
												year: 'numeric',
											})}
										</h2>
									</div>

									{/* Persentase Kehadiran Badge */}
									<div className='flex items-center gap-2 bg-[#E2F7F4] border-2 border-black rounded-xl p-2.5 px-4 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div>
											<span className='text-[10px] font-black uppercase text-[#007A6C] block leading-none'>Tingkat Hadir</span>
											<span className='text-xl font-black text-black'>{dailyStats.rate}%</span>
										</div>
										<span className='text-2xl'>🎯</span>
									</div>
								</div>

								{/* Daftar Sesi Mapel yang Terlaksana di Hari Tersebut */}
								<div>
									<div className='text-xs font-black uppercase text-black mb-2 flex items-center gap-1.5'>
										<Clock className='w-4 h-4 text-black' />
										<span>Sesi Mata Pelajaran Terlaksana ({sesiMapelList.length} Sesi):</span>
									</div>

									{sesiMapelList.length > 0 ? (
										<div className='flex flex-wrap gap-2'>
											{sesiMapelList.map((sesi, idx) => (
												<div
													key={idx}
													className='px-3 py-1.5 bg-[#FFFDF0] border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<span className='font-black bg-amber-200 px-1.5 py-0.5 rounded border border-black mr-1.5'>
														Jam {sesi.jam_ke}
													</span>
													<span className='text-black font-black'>{sesi.mapel}</span>
													<span className='text-gray-600 font-normal ml-1.5'>({sesi.guru})</span>
												</div>
											))}
										</div>
									) : (
										<div className='p-3 bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl text-xs font-bold text-amber-900'>
											Tidak ada sesi KBM guru mapel yang tercatat pada tanggal ini.
										</div>
									)}
								</div>

								{/* 4 Counter Stat Box Hari Itu */}
								<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2'>
									<div className='p-3 bg-emerald-100 border-2 border-black rounded-xl text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div className='text-[11px] font-black uppercase text-emerald-900'>Hadir</div>
										<div className='text-2xl font-black text-emerald-950 mt-0.5'>{dailyStats.hadir}</div>
									</div>

									<div className='p-3 bg-amber-100 border-2 border-black rounded-xl text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div className='text-[11px] font-black uppercase text-amber-900'>Sakit</div>
										<div className='text-2xl font-black text-amber-950 mt-0.5'>{dailyStats.sakit}</div>
									</div>

									<div className='p-3 bg-sky-100 border-2 border-black rounded-xl text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div className='text-[11px] font-black uppercase text-sky-900'>Izin</div>
										<div className='text-2xl font-black text-sky-950 mt-0.5'>{dailyStats.izin}</div>
									</div>

									<div className='p-3 bg-rose-100 border-2 border-black rounded-xl text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div className='text-[11px] font-black uppercase text-rose-900'>Alfa</div>
										<div className='text-2xl font-black text-rose-950 mt-0.5'>{dailyStats.alfa}</div>
									</div>
								</div>
							</div>

							{/* TABEL DETAIL KEHADIRAN SISWA PADA HARI TERSEBUT */}
							<div className='border-[3px] border-[#0D0D0D] bg-white rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden space-y-4 p-5'>
								{/* Filter Bar Siswa */}
								<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black'>
									{/* Status Filter Buttons */}
									<div className='flex flex-wrap items-center gap-1.5'>
										{[
											{ key: 'all', label: 'Semua Siswa' },
											{ key: 'hadir', label: `Hadir (${dailyStats.hadir})` },
											{ key: 'sakit', label: `Sakit (${dailyStats.sakit})` },
											{ key: 'izin', label: `Izin (${dailyStats.izin})` },
											{ key: 'alfa', label: `Alfa (${dailyStats.alfa})` },
										].map((btn) => (
											<button
												key={btn.key}
												type='button'
												onClick={() => setFilterStatus(btn.key)}
												className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${
													filterStatus === btn.key
														? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#0D0D0D]'
														: 'bg-white text-black border-black/30 hover:border-black'
												}`}>
												{btn.label}
											</button>
										))}
									</div>

									{/* Search Input Siswa */}
									<div className='relative w-full sm:w-60'>
										<Search className='w-4 h-4 absolute left-3 top-2.5 text-gray-500' />
										<input
											type='text'
											value={searchSiswa}
											onChange={(e) => setSearchSiswa(e.target.value)}
											placeholder='Cari nama atau NIS...'
											className='w-full pl-9 pr-7 py-2 bg-[#FFFDF0] border-2 border-black font-bold text-xs rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] outline-none'
										/>
										{searchSiswa && (
											<button
												onClick={() => setSearchSiswa('')}
												className='absolute right-2.5 top-2 text-xs font-black text-gray-400 hover:text-black'>
												✕
											</button>
										)}
									</div>
								</div>

								{/* Table List Siswa */}
								{loadingDetail ? (
									<div className='py-12 text-center'>
										<Loader text='Memuat detail presensi...' />
									</div>
								) : filteredSiswa.length === 0 ? (
									<div className='py-12 text-center space-y-2'>
										<span className='text-3xl'>🔍</span>
										<p className='text-sm font-black text-black'>Tidak ada siswa yang sesuai filter.</p>
										<p className='text-xs text-gray-500'>Coba ubah status filter atau kata kunci pencarian.</p>
									</div>
								) : (
									<div className='overflow-x-auto'>
										<table className='w-full text-left border-collapse min-w-[700px]'>
											<thead>
												<tr className='bg-[#0D0D0D] text-white text-xs uppercase font-black'>
													<th className='p-3 border-r border-gray-700 w-12 text-center'>No</th>
													<th className='p-3 border-r border-gray-700 w-28'>NIS</th>
													<th className='p-3 border-r border-gray-700 min-w-[180px]'>Nama Siswa</th>
													<th className='p-3 border-r border-gray-700 w-32 text-center'>Status Harian</th>
													<th className='p-3 border-r border-gray-700'>Rincian Sesi Mapel</th>
													<th className='p-3'>Keterangan</th>
												</tr>
											</thead>
											<tbody className='divide-y-2 divide-gray-200 text-xs font-bold'>
												{filteredSiswa.map((sw, idx) => {
													const info = detailSiswaMap[sw.id] || { status: 'Hadir', studentSessions: [] };
													const st = normStatus(info.status);

													let badgeColor = 'bg-gray-100 text-gray-800 border-gray-300';
													if (st === 'hadir') badgeColor = 'bg-emerald-300 text-emerald-950 border-black';
													else if (st === 'sakit') badgeColor = 'bg-amber-300 text-amber-950 border-black';
													else if (st === 'izin') badgeColor = 'bg-sky-300 text-sky-950 border-black';
													else if (st === 'alfa') badgeColor = 'bg-rose-300 text-rose-950 border-black';

													return (
														<tr key={sw.id} className='hover:bg-yellow-50/70 transition-colors'>
															<td className='p-3 text-center border-r border-gray-300 font-mono'>
																{idx + 1}
															</td>
															<td className='p-3 border-r border-gray-300 font-mono text-gray-600 text-[11px]'>
																{sw.nis || '-'}
															</td>
															<td className='p-3 border-r border-gray-300 font-black text-black'>
																{sw.nama_lengkap}
															</td>
															<td className='p-3 border-r border-gray-300 text-center'>
																<span
																	className={`inline-block px-3 py-1 rounded-lg border-2 text-[11px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_#0D0D0D] ${badgeColor}`}>
																	{info.status}
																</span>
															</td>
															<td className='p-3 border-r border-gray-300'>
																{info.studentSessions && info.studentSessions.length > 0 ? (
																	<div className='flex flex-wrap gap-1.5'>
																		{info.studentSessions.map((ss, sIdx) => {
																			const ssStatus = normStatus(ss.status);
																			let ssBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
																			if (ssStatus === 'sakit') ssBg = 'bg-amber-100 text-amber-900 border-amber-300';
																			else if (ssStatus === 'izin') ssBg = 'bg-sky-100 text-sky-900 border-sky-300';
																			else if (ssStatus === 'alfa') ssBg = 'bg-rose-100 text-rose-900 border-rose-300';

																			return (
																				<span
																					key={sIdx}
																					className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${ssBg}`}>
																					Jam {ss.jam_ke}: {ss.status}
																				</span>
																			);
																		})}
																	</div>
																) : (
																	<span className='text-gray-400 italic'>-</span>
																)}
															</td>
															<td className='p-3 text-gray-600 text-[11px]'>
																{info.keterangan || '-'}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
