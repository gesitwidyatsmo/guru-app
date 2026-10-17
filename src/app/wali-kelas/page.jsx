'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Loader from '../components/loading';
import Swal from 'sweetalert2';
import {
	Users,
	Calendar,
	CheckCircle2,
	AlertTriangle,
	Award,
	BookOpen,
	ArrowLeft,
	Search,
	ExternalLink,
	UserCheck,
	ShieldAlert,
	FileText,
	ChevronRight,
	Clock,
	Zap,
	RefreshCw,
	AlertCircle,
} from 'lucide-react';

export default function WaliKelasHubPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialTab = searchParams.get('tab') || 'ringkasan';

	const [activeTab, setActiveTab] = useState(initialTab);
	const [dataHub, setDataHub] = useState(null);
	const [loading, setLoading] = useState(true);
	const [searchSiswa, setSearchSiswa] = useState('');
	const [syncing, setSyncing] = useState(false);
	const [editedStatuses, setEditedStatuses] = useState({});

	const fetchHubData = useCallback(async () => {
		try {
			const res = await fetch('/api/wali-kelas/my-class');
			if (!res.ok) {
				if (res.status === 401) {
					router.replace('/login');
					return;
				}
				throw new Error('Gagal memuat data kelas binaan');
			}
			const data = await res.json();
			setDataHub(data);
		} catch (err) {
			console.error('Error Hub Wali Kelas:', err);
			Swal.fire({
				icon: 'error',
				title: 'Terjadi Kesalahan',
				text: err.message || 'Tidak dapat memuat data Hub Wali Kelas',
			});
		} finally {
			setLoading(false);
		}
	}, [router]);

	useEffect(() => {
		fetchHubData();
	}, [fetchHubData]);

	const {
		isWaliKelas,
		kelas,
		tahunAjar,
		stats,
		siswaList = [],
		siswaPerhatian = [],
		siswaBolosList = [],
		siswaMapelBreakdown = [],
	} = dataHub || {};

	// Filter siswa di Tab Siswa
	const filteredSiswa = useMemo(() => {
		if (!siswaList) return [];
		if (!searchSiswa.trim()) return siswaList;
		const q = searchSiswa.toLowerCase();
		return siswaList.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && s.nis.toLowerCase().includes(q))
		);
	}, [siswaList, searchSiswa]);

	// Handler untuk 1-Klik Sahkan Presensi Harian dari Agregasi Mapel
	const handleSyncPresensi = async () => {
		if (!kelas || !stats?.absensiHariIni) return;

		const confirm = await Swal.fire({
			title: 'Sahkan Presensi Harian?',
			text: 'Data hasil agregasi sesi mapel hari ini (berdasarkan aturan kehadiran 50%) akan disimpan resmi ke Buku Absensi Harian kelas ini.',
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: '⚡ Ya, Sahkan Sekarang!',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00A693',
			cancelButtonColor: '#0D0D0D',
		});

		if (!confirm.isConfirmed) return;

		setSyncing(true);
		try {
			// Susun payload dari breakdown mapel (dengan mempertimbangkan edit status dari wali kelas jika ada)
			const payloadData = siswaMapelBreakdown.map((s) => {
				const currentStatus =
					editedStatuses[s.siswa_id] ||
					(s.recommendedStatus === 'Belum Ada Data' ? 'Hadir' : s.recommendedStatus);
				return {
					siswa_id: s.siswa_id,
					status: currentStatus,
					keterangan: s.recommendedKeterangan || '',
				};
			});

			const res = await fetch('/api/wali-kelas/sync-presensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id_kelas: kelas.id,
					tanggal: stats.absensiHariIni.tanggal,
					data_absensi: payloadData,
					tahun_ajar: tahunAjar?.nama,
					semester: tahunAjar?.semester,
				}),
			});

			const resJson = await res.json();
			if (!res.ok) throw new Error(resJson.error || 'Gagal menyinkronkan presensi');

			await Swal.fire({
				icon: 'success',
				title: 'Presensi Disahkan!',
				text: resJson.message || 'Presensi harian resmi berhasil disimpan.',
				confirmButtonColor: '#00A693',
			});

			// Refresh data hub
			fetchHubData();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: err.message,
			});
		} finally {
			setSyncing(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	// State jika akun login BUKAN wali kelas
	if (!isWaliKelas || !kelas) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] flex items-center justify-center p-4'>
				<div className='max-w-md w-full neo-card bg-white text-center p-8 border-[3px] border-black shadow-[6px_6px_0px_#000]'>
					<div className='w-20 h-20 bg-amber-200 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[3px_3px_0px_#000] text-4xl'>
						🎓
					</div>
					<h2 className='text-2xl font-black uppercase text-black mb-2'>
						Bukan Wali Kelas
					</h2>
					<p className='text-sm font-bold text-gray-700 mb-6'>
						Akun Anda saat ini belum ditugaskan sebagai Wali Kelas untuk rombel aktif mana pun. Penugasan dapat dilakukan oleh Administrator melalui menu Manajemen Kelas.
					</p>
					<div className='flex flex-col gap-3'>
						<Link
							href='/'
							className='neo-btn-primary bg-black text-white py-3 font-black uppercase text-sm text-center'>
							Kembali ke Beranda KBM
						</Link>
						<Link
							href='/kelas'
							className='neo-btn-outline py-2.5 font-bold text-sm text-center'>
							Lihat Daftar Seluruh Kelas
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const absensiToday = stats?.absensiHariIni || {};
	const poinStats = stats?.poin || {};
	const isAutoFeed = absensiToday.source === 'auto_mapel';
	const isOfficial = absensiToday.source === 'official';

	return (
		<div className='min-h-screen bg-[#FFF5F0] text-black pb-24 font-sans'>
			{/* TOP NAVBAR / HEADER */}
			<div className='sticky top-0 z-40 bg-[#F5C518] border-b-[3px] border-black px-4 sm:px-6 py-4 shadow-[0_4px_0_#000]'>
				<div className='max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4'>
					{/* Left: Back & Title */}
					<div className='flex items-center gap-3'>
						<Link
							href='/'
							className='w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0_#000] hover:bg-black hover:text-white transition-all shrink-0'
							title='Kembali ke Beranda'>
							<ArrowLeft className='w-5 h-5' strokeWidth={2.5} />
						</Link>
						<div>
							<div className='flex flex-wrap items-center gap-2 mb-0.5'>
								<span className='text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 bg-black text-yellow-400 rounded border border-black'>
									🌟 Hub Wali Kelas
								</span>
								<span className='text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 bg-white text-black border border-black rounded'>
									TA {tahunAjar?.nama || '2026/2027'} (Sem {tahunAjar?.semester || 1})
								</span>
							</div>
							<h1 className='text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight'>
								Rombel {kelas.nama_kelas}
							</h1>
						</div>
					</div>

					{/* Right: Quick CTA */}
					<div className='flex flex-wrap items-center gap-2 self-start md:self-auto'>
						<Link
							href={`/kelas/${kelas.id}`}
							className='neo-btn-outline !py-2 !px-3 bg-white text-black flex items-center gap-1.5 text-xs sm:text-sm font-bold'>
							<span>Profil Rombel</span>
							<ExternalLink className='w-3.5 h-3.5' />
						</Link>
					</div>
				</div>
			</div>

			{/* MAIN CONTAINER */}
			<div className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6'>
				{/* TAB BAR (Segmented Navigation) */}
				<div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none'>
					{[
						{ id: 'ringkasan', label: 'Ringkasan Rombel', icon: <BookOpen className='w-4 h-4' /> },
						{
							id: 'presensi',
							label: `Presensi Harian ${isAutoFeed ? '⚡ (Live)' : ''}`,
							icon: <Calendar className='w-4 h-4' />,
						},
						{ id: 'siswa', label: `Daftar Siswa (${stats?.totalSiswa || 0})`, icon: <Users className='w-4 h-4' /> },
						{ id: 'leger', label: 'Leger Nilai (Preview)', icon: <FileText className='w-4 h-4' /> },
						{ id: 'poin', label: 'Poin Karakter', icon: <Award className='w-4 h-4' /> },
					].map((tab) => {
						const isActive = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-[2.5px] border-black font-black text-xs sm:text-sm uppercase tracking-wide transition-all shrink-0 ${
									isActive
										? 'bg-[#E8451A] text-white shadow-[3px_3px_0_#000] -translate-y-0.5'
										: 'bg-white text-black hover:bg-yellow-200 shadow-[2px_2px_0_#000]'
								}`}>
								{tab.icon}
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				{/* ======================================================== */}
				{/* TAB 1: RINGKASAN ROMBEL */}
				{/* ======================================================== */}
				{activeTab === 'ringkasan' && (
					<div className='space-y-6'>
						{/* 4 BENTO METRIC CARDS */}
						<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
							{/* Card 1: Total Siswa */}
							<div className='neo-card bg-[#2F80ED] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Siswa Terdaftar
									</span>
									<Users className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>{stats?.totalSiswa || 0}</div>
								<div className='flex items-center gap-2 text-xs font-bold'>
									<span className='bg-white text-blue-900 px-2 py-0.5 rounded border border-black'>
										👦 {stats?.lakiLaki || 0} L
									</span>
									<span className='bg-white text-blue-900 px-2 py-0.5 rounded border border-black'>
										👧 {stats?.perempuan || 0} P
									</span>
								</div>
							</div>

							{/* Card 2: Kehadiran Hari Ini (Smart Status) */}
							<div className='neo-card bg-[#F5C518] text-black p-5 border-[3px] border-black shadow-[4px_4px_0_#000] flex flex-col justify-between'>
								<div>
									<div className='flex items-center justify-between mb-2'>
										<span className='text-[10px] sm:text-xs font-black uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded'>
											{isOfficial ? 'Presensi Resmi' : isAutoFeed ? 'Agregasi Mapel' : 'Presensi Harian'}
										</span>
										<CheckCircle2 className='w-5 h-5 text-black' />
									</div>
									<div className='text-3xl sm:text-4xl font-black mb-1'>
										{absensiToday.persentaseHadir}%
									</div>
									<div className='text-xs font-bold text-gray-900 mb-2'>
										{absensiToday.hadir} Hadir • {absensiToday.sakit} Sakit • {absensiToday.izin} Izin • {absensiToday.alfa} Alfa
									</div>
								</div>

								{/* Status Indicator: Langsung Sah */}
								<div>
									{absensiToday.recorded || absensiToday.totalSesiMapel > 0 ? (
										<span className='inline-block text-[11px] font-black bg-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0_#000]'>
											✅ Presensi Sah (Terhubung KBM)
										</span>
									) : (
										<span className='inline-block text-[11px] font-black bg-rose-200 text-rose-900 px-2 py-0.5 rounded border border-black'>
											⚠️ Belum Ada Data KBM Hari Ini
										</span>
									)}
								</div>
							</div>

							{/* Card 3: Poin Prestasi */}
							<div className='neo-card bg-[#00A693] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Poin Prestasi
									</span>
									<Award className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>
									+{poinStats.totalPositif || 0}
								</div>
								<p className='text-xs font-bold text-white/90'>
									Akumulasi sikap positif kelas
								</p>
							</div>

							{/* Card 4: Poin Pelanggaran */}
							<div className='neo-card bg-[#E8451A] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Poin Pelanggaran
									</span>
									<AlertTriangle className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>
									-{poinStats.totalNegatif || 0}
								</div>
								<p className='text-xs font-bold text-white/90'>
									Perlu pembinaan karakter
								</p>
							</div>
						</div>

						{/* TWO-COLUMN GRID: Early Warning vs Quick Actions */}
						<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
							{/* EARLY WARNING RADAR (2 Columns) */}
							<div className='lg:col-span-2 space-y-6'>
								{/* RADAR 1: SISWA MEMBOLOS JAM TERTENTU / ANOMALI */}
								{siswaBolosList.length > 0 && (
									<div className='neo-card bg-rose-50 p-6 border-[3px] border-rose-600 shadow-[4px_4px_0_#991b1b]'>
										<div className='flex items-center justify-between pb-3 border-b-2 border-rose-600 mb-4'>
											<div className='flex items-center gap-2.5'>
												<div className='w-9 h-9 rounded-xl bg-rose-500 text-white border-2 border-black flex items-center justify-center font-black'>
													🚨
												</div>
												<div>
													<h2 className='text-lg font-black uppercase text-rose-950'>
														Radar Siswa Membolos / Anomali Kehadiran ({siswaBolosList.length} Siswa)
													</h2>
													<p className='text-xs font-bold text-rose-800'>
														Terdeteksi oleh sistem dari perbandingan antar-sesi mata pelajaran hari ini
													</p>
												</div>
											</div>
										</div>

										<div className='space-y-3'>
											{siswaBolosList.map((item, idx) => (
												<div
													key={idx}
													className='p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000] space-y-2.5'>
													<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
														<div>
															<div className='flex items-center gap-2'>
																<span className='font-black text-sm text-black'>{item.nama_lengkap}</span>
																<span className='text-xs font-mono font-bold text-gray-500'>({item.nis || '-'})</span>
															</div>
															<div className='text-xs font-bold text-rose-700 mt-0.5'>
																{item.judulKasus}: <span className='font-black'>{item.keterangan}</span>
															</div>
														</div>
														<div className='flex items-center gap-2 shrink-0'>
															<Link
																href={`/kelas/${kelas.id}/poin`}
																className='neo-btn-primary !py-1 !px-2.5 bg-rose-600 text-white text-xs font-black flex items-center gap-1'>
																<ShieldAlert className='w-3.5 h-3.5' />
																<span>+ Catat Poin Bolos</span>
															</Link>
															<Link
																href={`/siswa/${item.siswa_id}`}
																className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold'>
																Profil
															</Link>
														</div>
													</div>

													{/* Timeline Visual Sesi Mapel Siswa Ini */}
													<div className='flex flex-wrap items-center gap-2 pt-2 border-t border-black/10'>
														<span className='text-[10px] font-black uppercase text-gray-600'>Sesi Hari Ini:</span>
														{item.sessions.map((sesi, sIdx) => {
															const isAlfa = (sesi.status || '').toLowerCase() === 'alfa';
															return (
																<span
																	key={sIdx}
																	className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
																		isAlfa
																			? 'bg-rose-400 text-white animate-pulse'
																			: 'bg-emerald-100 text-emerald-950'
																	}`}>
																	Jam {sesi.jam_ke} ({sesi.mapel}): {sesi.status}
																</span>
															);
														})}
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* RADAR 2: SISWA DENGAN POIN MINUS / PERILAKU */}
								<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000]'>
									<div className='flex items-center justify-between pb-4 border-b-2 border-black mb-4'>
										<div className='flex items-center gap-2.5'>
											<div className='w-9 h-9 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center font-black'>
												⚠️
											</div>
											<div>
												<h2 className='text-lg font-black uppercase text-black'>
													Radar Siswa Perlu Atensi Karakter
												</h2>
												<p className='text-xs font-bold text-gray-600'>
													Akumulasi poin kedisiplinan dan catatan pembinaan siswa
												</p>
											</div>
										</div>
										<Link
											href={`/kelas/${kelas.id}/poin`}
											className='text-xs font-black uppercase text-blue-700 hover:underline flex items-center gap-1'>
											Lihat Semua <ChevronRight className='w-3.5 h-3.5' />
										</Link>
									</div>

									{siswaPerhatian.length === 0 ? (
										<div className='text-center py-8 bg-emerald-50 border-2 border-dashed border-emerald-400 rounded-xl p-4'>
											<div className='text-3xl mb-2'>🎉</div>
											<p className='font-black text-sm text-emerald-900 uppercase'>
												Kondisi Kelas Sangat Baik
											</p>
											<p className='text-xs font-bold text-emerald-700 mt-1'>
												Tidak ada siswa dengan akumulasi poin pelanggaran yang mengkhawatirkan saat ini.
											</p>
										</div>
									) : (
										<div className='space-y-3'>
											{siswaPerhatian.map((siswa, idx) => (
												<div
													key={siswa.id}
													className='flex items-center justify-between p-3.5 bg-amber-50 border-2 border-black rounded-xl hover:bg-amber-100 transition-colors'>
													<div className='flex items-center gap-3'>
														<span className='w-6 h-6 rounded-md bg-black text-white font-black text-xs flex items-center justify-center'>
															{idx + 1}
														</span>
														<div>
															<div className='font-black text-sm text-black'>{siswa.nama_lengkap}</div>
															<div className='text-xs font-bold text-gray-600'>NIS: {siswa.nis || '-'}</div>
														</div>
													</div>
													<div className='flex items-center gap-3'>
														<span className='px-2.5 py-1 bg-rose-200 border-2 border-rose-900 text-rose-950 font-black text-xs rounded-lg'>
															Skor Poin: {siswa.skorPoin}
														</span>
														<Link
															href={`/siswa/${siswa.id}`}
															className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold'>
															Profil
														</Link>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>

							{/* AKSI CEPAT WALI KELAS (1 Column) */}
							<div className='neo-card bg-amber-100 p-6 border-[3px] border-black shadow-[4px_4px_0_#000] flex flex-col justify-between'>
								<div>
									<h2 className='text-lg font-black uppercase text-black mb-4 flex items-center gap-2'>
										<span>⚡</span> Aksi Cepat Wali Kelas
									</h2>
									<div className='space-y-3'>
										<button
											onClick={() => setActiveTab('presensi')}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group text-left'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-indigo-200 border border-black flex items-center justify-center font-bold text-indigo-900'>
													📋
												</div>
												<span className='font-black text-xs uppercase'>Lihat Rekap Presensi KBM</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</button>

										<Link
											href={`/kelas/${kelas.id}/riwayat-absensi`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-teal-200 border border-black flex items-center justify-center font-bold text-teal-900'>
													📅
												</div>
												<span className='font-black text-xs uppercase'>Rekap Kalender Bulanan</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>

										<Link
											href={`/kelas/${kelas.id}/poin`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-rose-200 border border-black flex items-center justify-center font-bold text-rose-900'>
													🛡️
												</div>
												<span className='font-black text-xs uppercase'>Catat Poin Siswa Rombel</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>

										<Link
											href={`/kelas/${kelas.id}/riwayat-nilai`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-blue-200 border border-black flex items-center justify-center font-bold text-blue-900'>
													📑
												</div>
												<span className='font-black text-xs uppercase'>Buku Nilai Kelas</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>
									</div>
								</div>

								<div className='mt-6 pt-4 border-t-2 border-black/20 text-xs font-bold text-gray-700'>
									Wali Kelas: <span className='font-black text-black'>{kelas.wali_kelas}</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 2: PRESENSI HARIAN (TIMELINE & 50% RULE MATRIX) */}
				{/* ======================================================== */}
				{activeTab === 'presensi' && (
					<div className='space-y-6'>
						<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000]'>
							{/* Header Bar */}
							<div className='flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black mb-6'>
								<div>
									<div className='flex flex-wrap items-center gap-2 mb-1'>
										<span className='text-xs font-black uppercase px-2.5 py-0.5 rounded border border-black bg-emerald-300 text-emerald-950'>
											✅ Presensi Sah &amp; Terhubung KBM
										</span>
										<span className='text-xs font-bold text-gray-600'>
											{absensiToday.tanggal}
										</span>
									</div>
									<h2 className='text-xl sm:text-2xl font-black uppercase text-black'>
										Rekap Presensi KBM Hari Ini
									</h2>
								</div>
								<div className='flex flex-wrap items-center gap-2'>
									<Link
										href={`/kelas/${kelas.id}/riwayat-absensi`}
										className='neo-btn-outline !py-2 !px-3 bg-white text-xs sm:text-sm font-bold flex items-center gap-1.5'>
										<Calendar className='w-4 h-4' />
										<span>Rekap Kalender</span>
									</Link>
								</div>
							</div>

							{/* Sesi KBM yang Masuk Hari Ini */}
							{absensiToday.sesiMapelToday && absensiToday.sesiMapelToday.length > 0 ? (
								<div className='mb-6 p-4 bg-yellow-50 border-2 border-black rounded-xl'>
									<div className='text-xs font-black uppercase text-black mb-2 flex items-center gap-1.5'>
										<Clock className='w-4 h-4 text-black' />
										<span>Sesi Mata Pelajaran yang Terlaksana Hari Ini ({absensiToday.sesiMapelToday.length} Sesi):</span>
									</div>
									<div className='flex flex-wrap gap-2'>
										{absensiToday.sesiMapelToday.map((sesi, idx) => (
											<div
												key={idx}
												className='px-3 py-1 bg-white border border-black rounded-lg text-xs font-bold shadow-[1px_1px_0_#000]'>
												<span className='font-black'>Jam {sesi.jam_ke}</span>: {sesi.mapel}{' '}
												<span className='text-gray-500'>({sesi.guru})</span>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className='mb-6 p-4 bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl text-xs font-bold text-amber-900'>
									Belum ada sesi guru mapel yang menginput absensi KBM hari ini.
								</div>
							)}

							{/* Summary Counters */}
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6'>
								<div className='p-4 bg-emerald-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-emerald-900'>Hadir</div>
									<div className='text-3xl font-black text-emerald-950 mt-1'>
										{absensiToday.hadir || 0}
									</div>
								</div>
								<div className='p-4 bg-amber-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-amber-900'>Sakit</div>
									<div className='text-3xl font-black text-amber-950 mt-1'>
										{absensiToday.sakit || 0}
									</div>
								</div>
								<div className='p-4 bg-blue-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-blue-900'>Izin</div>
									<div className='text-3xl font-black text-blue-950 mt-1'>
										{absensiToday.izin || 0}
									</div>
								</div>
								<div className='p-4 bg-rose-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-rose-900'>Alfa / Bolos</div>
									<div className='text-3xl font-black text-rose-950 mt-1'>
										{absensiToday.alfa || 0}
									</div>
								</div>
							</div>

							{/* MATRIKS TIMELINE KEHADIRAN SISWA LENGKAP */}
							<div className='space-y-3'>
								<div className='flex items-center justify-between'>
									<h3 className='text-sm font-black uppercase tracking-wider text-black'>
										Detail Kehadiran per Siswa & Logika 50% Rule
									</h3>
									<span className='text-xs font-bold text-gray-500'>
										{siswaMapelBreakdown.length} Siswa
									</span>
								</div>

								<div className='overflow-x-auto border-2 border-black rounded-xl'>
									<table className='w-full text-left border-collapse text-xs sm:text-sm font-bold'>
										<thead className='bg-[#F5C518] text-black border-b-2 border-black font-black uppercase tracking-wider text-xs'>
											<tr>
												<th className='p-3 border-r-2 border-black w-10 text-center'>No</th>
												<th className='p-3 border-r-2 border-black'>Nama Siswa</th>
												<th className='p-3 border-r-2 border-black'>Sesi Mapel Hari Ini</th>
												<th className='p-3 border-r-2 border-black text-center w-28'>Rasio Jam</th>
												<th className='p-3 border-r-2 border-black text-center w-36'>Status Harian</th>
												<th className='p-3 text-center w-32'>Koreksi</th>
											</tr>
										</thead>
										<tbody className='divide-y-2 divide-black/10 bg-white'>
											{siswaMapelBreakdown.length === 0 ? (
												<tr>
													<td colSpan={6} className='p-6 text-center text-gray-500 italic'>
														Belum ada catatan presensi mapel hari ini.
													</td>
												</tr>
											) : (
												siswaMapelBreakdown.map((item, idx) => {
													const currentStatus =
														editedStatuses[item.siswa_id] ||
														(item.recommendedStatus === 'Belum Ada Data'
															? 'Hadir'
															: item.recommendedStatus);

													return (
														<tr key={item.siswa_id} className='hover:bg-yellow-50 transition-colors'>
															<td className='p-3 border-r-2 border-black/10 text-center font-black'>
																{idx + 1}
															</td>
															<td className='p-3 border-r-2 border-black/10'>
																<div className='font-black text-black'>{item.nama_lengkap}</div>
																<div className='text-[11px] font-mono text-gray-500'>
																	{item.nis || '-'}
																</div>
															</td>
															{/* Visual Timeline Sesi Mapel */}
															<td className='p-3 border-r-2 border-black/10'>
																{item.sessions && item.sessions.length > 0 ? (
																	<div className='flex flex-wrap gap-1.5'>
																		{item.sessions.map((sesi, sIdx) => {
																			const st = (sesi.status || '').toLowerCase();
																			const isAlfa = st === 'alfa' || st === 'a';
																			const isHadir = st === 'hadir' || st === 'h';
																			return (
																				<span
																					key={sIdx}
																					title={`${sesi.mapel} (${sesi.guru})`}
																					className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
																						isAlfa
																							? 'bg-rose-400 text-white'
																							: isHadir
																							? 'bg-emerald-200 text-emerald-950'
																							: 'bg-amber-200 text-amber-950'
																					}`}>
																					Jam {sesi.jam_ke}: {sesi.status}
																				</span>
																			);
																		})}
																	</div>
																) : (
																	<span className='text-[11px] text-gray-400 italic'>
																		Belum ada sesi tercatat
																	</span>
																)}
															</td>
															{/* Rasio Jam Belajar */}
															<td className='p-3 border-r-2 border-black/10 text-center'>
																<span
																	className={`px-2 py-0.5 rounded text-xs font-black border border-black ${
																		item.kehadiranPct >= 50
																			? 'bg-emerald-100 text-emerald-950'
																			: 'bg-rose-100 text-rose-950'
																	}`}>
																	{item.hCount}/{item.totalRecorded} ({item.kehadiranPct}%)
																</span>
															</td>
															{/* Rekomendasi Status Harian */}
															<td className='p-3 border-r-2 border-black/10 text-center'>
																<span
																	className={`px-2.5 py-1 rounded-lg text-xs font-black border-2 border-black ${
																		currentStatus === 'Hadir'
																			? 'bg-emerald-300 text-emerald-950'
																			: currentStatus === 'Sakit'
																			? 'bg-amber-300 text-amber-950'
																			: currentStatus === 'Izin'
																			? 'bg-blue-300 text-blue-950'
																			: 'bg-rose-400 text-white'
																	}`}>
																	{currentStatus}
																</span>
																{item.isBolosParsial && (
																	<div className='text-[10px] text-rose-600 font-bold mt-1'>
																		⚠️ Bolos jam tertentu
																	</div>
																)}
																{item.isAnomaliKurang50 && (
																	<div className='text-[10px] text-amber-700 font-bold mt-1'>
																		⚠️ Hadir &lt; 50% jam
																	</div>
																)}
															</td>
															{/* Quick Override Dropdown */}
															<td className='p-3 text-center'>
																<select
																	value={currentStatus}
																	onChange={(e) =>
																		setEditedStatuses((prev) => ({
																			...prev,
																			[item.siswa_id]: e.target.value,
																		}))
																	}
																	className='neo-input !py-1 !px-2 text-xs font-bold bg-white'>
																	<option value='Hadir'>Hadir</option>
																	<option value='Sakit'>Sakit</option>
																	<option value='Izin'>Izin</option>
																	<option value='Alfa'>Alfa</option>
																</select>
															</td>
														</tr>
													);
												})
											)}
										</tbody>
									</table>
								</div>

								{/* Bottom Save Action */}
								{/* Bottom Action: Langsung Sah Otomatis */}
								<div className='pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-yellow-50 p-4 border-2 border-black rounded-xl'>
									<div className='text-xs font-bold text-gray-800'>
										✨ <span className='font-black'>Presensi Langsung Sah:</span> Data kehadiran otomatis terakumulasi langsung dari sesi KBM guru mapel hari ini.
										{Object.keys(editedStatuses).length > 0 && (
											<span className='text-rose-600 block sm:inline sm:ml-2 font-black'>
												(Ada {Object.keys(editedStatuses).length} siswa yang statusnya Anda sesuaikan)
											</span>
										)}
									</div>
									{Object.keys(editedStatuses).length > 0 && (
										<button
											onClick={handleSyncPresensi}
											disabled={syncing}
											className='neo-btn-primary !py-2 !px-4 bg-emerald-600 text-white hover:bg-emerald-700 text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-[2px_2px_0_#000] shrink-0 disabled:opacity-50'>
											<span>{syncing ? 'Menyimpan...' : '💾 Simpan Koreksi Status'}</span>
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 3: DAFTAR SISWA */}
				{/* ======================================================== */}
				{activeTab === 'siswa' && (
					<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black'>
							<div>
								<h2 className='text-xl font-black uppercase text-black'>
									Buku Induk Rombel {kelas.nama_kelas}
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Total: {siswaList.length} siswa aktif terdaftar
								</p>
							</div>
							<div className='relative w-full sm:w-72'>
								<Search className='w-4 h-4 absolute left-3 top-3 text-gray-500' />
								<input
									type='text'
									placeholder='Cari nama atau NIS...'
									value={searchSiswa}
									onChange={(e) => setSearchSiswa(e.target.value)}
									className='neo-input !pl-9 text-xs sm:text-sm'
								/>
							</div>
						</div>

						{/* TABLE SISWA */}
						<div className='overflow-x-auto border-2 border-black rounded-xl'>
							<table className='w-full text-left border-collapse text-xs sm:text-sm font-bold'>
								<thead className='bg-[#F5C518] text-black border-b-2 border-black font-black uppercase tracking-wider text-xs'>
									<tr>
										<th className='p-3 border-r-2 border-black w-12 text-center'>No</th>
										<th className='p-3 border-r-2 border-black'>NIS</th>
										<th className='p-3 border-r-2 border-black'>Nama Siswa</th>
										<th className='p-3 border-r-2 border-black text-center'>L/P</th>
										<th className='p-3 border-r-2 border-black text-center'>Status</th>
										<th className='p-3 text-center w-28'>Aksi</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-black/10 bg-white'>
									{filteredSiswa.length === 0 ? (
										<tr>
											<td colSpan={6} className='p-6 text-center text-gray-500 italic'>
												Tidak ada siswa yang cocok dengan pencarian.
											</td>
										</tr>
									) : (
										filteredSiswa.map((siswa, idx) => (
											<tr key={siswa.id} className='hover:bg-yellow-50 transition-colors'>
												<td className='p-3 border-r-2 border-black/10 text-center font-black'>
													{idx + 1}
												</td>
												<td className='p-3 border-r-2 border-black/10 font-mono'>
													{siswa.nis || '-'}
												</td>
												<td className='p-3 border-r-2 border-black/10 font-black text-black'>
													{siswa.nama_lengkap}
												</td>
												<td className='p-3 border-r-2 border-black/10 text-center'>
													<span
														className={`px-2 py-0.5 rounded text-[11px] font-black border border-black ${
															siswa.jenis_kelamin === 'Laki-laki'
																? 'bg-blue-100 text-blue-900'
																: 'bg-pink-100 text-pink-900'
														}`}>
														{siswa.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}
													</span>
												</td>
												<td className='p-3 border-r-2 border-black/10 text-center'>
													<span className='px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-black'>
														{siswa.status}
													</span>
												</td>
												<td className='p-3 text-center'>
													<Link
														href={`/siswa/${siswa.id}`}
														className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold inline-block'>
														Profil
													</Link>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 4: LEGER NILAI (PREVIEW FASE 3) */}
				{/* ======================================================== */}
				{activeTab === 'leger' && (
					<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-6'>
						<div className='flex items-center justify-between pb-4 border-b-2 border-black'>
							<div>
								<div className='text-xs font-black uppercase px-2 py-0.5 bg-yellow-300 text-black border border-black rounded inline-block mb-1'>
									Roadmap Fase 3
								</div>
								<h2 className='text-xl font-black uppercase text-black'>
									Leger Nilai Lintas Mata Pelajaran
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Matriks nilai seluruh siswa rombel {kelas.nama_kelas} dari semua guru mapel pengajar
								</p>
							</div>
							<Link
								href={`/kelas/${kelas.id}/riwayat-nilai`}
								className='neo-btn-primary bg-black text-white text-xs sm:text-sm font-black flex items-center gap-1.5'>
								<span>Buka Nilai Rombel Saat Ini</span>
								<ExternalLink className='w-4 h-4' />
							</Link>
						</div>

						<div className='p-6 bg-amber-50 border-2 border-black rounded-2xl flex flex-col items-center text-center space-y-3'>
							<div className='w-14 h-14 bg-amber-200 border-2 border-black rounded-2xl flex items-center justify-center text-2xl shadow-[2px_2px_0_#000]'>
								📑
							</div>
							<h3 className='text-base font-black uppercase text-black'>
								Matriks Leger Nilai Sedang Dirancang
							</h3>
							<p className='text-xs font-bold text-gray-700 max-w-lg'>
								Modul ini akan mengagregasikan nilai tugas, kuis, dan ujian dari seluruh guru mapel pengajar di kelas {kelas.nama_kelas} ke dalam format matriks terpusat untuk persiapan rapat kenaikan kelas dan pencetakan rapor.
							</p>
							<div className='pt-2 flex flex-wrap gap-2 justify-center'>
								<span className='px-3 py-1 bg-white border border-black rounded-md text-xs font-bold'>
									✅ Pengecekan KKM Otomatis
								</span>
								<span className='px-3 py-1 bg-white border border-black rounded-md text-xs font-bold'>
									✅ Monitor Guru yang Belum Setor Nilai
								</span>
								<span className='px-3 py-1 bg-white border border-black rounded-md text-xs font-bold'>
									✅ Cetak Leger Excel / PDF
								</span>
							</div>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 5: POIN KARAKTER */}
				{/* ======================================================== */}
				{activeTab === 'poin' && (
					<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black'>
							<div>
								<h2 className='text-xl font-black uppercase text-black'>
									Catatan Karakter & Poin Siswa
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Log prestasi dan pelanggaran siswa rombel {kelas.nama_kelas}
								</p>
							</div>
							<Link
								href={`/kelas/${kelas.id}/poin`}
								className='neo-btn-primary bg-[#E8451A] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 self-start sm:self-auto'>
								<ShieldAlert className='w-4 h-4' />
								<span>Catat Poin Baru</span>
							</Link>
						</div>

						{/* Log list */}
						{poinStats.recentLogs && poinStats.recentLogs.length > 0 ? (
							<div className='space-y-3'>
								{poinStats.recentLogs.map((item) => (
									<div
										key={item.id}
										className={`p-4 border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
											item.tipe === 'Positif' ? 'bg-emerald-50' : 'bg-rose-50'
										}`}>
										<div className='space-y-1'>
											<div className='flex items-center gap-2'>
												<span
													className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black ${
														item.tipe === 'Positif'
															? 'bg-emerald-200 text-emerald-950'
															: 'bg-rose-200 text-rose-950'
													}`}>
													{item.tipe}
												</span>
												<span className='font-black text-sm text-black'>{item.nama_siswa}</span>
											</div>
											<p className='text-xs font-bold text-gray-800'>{item.aktifitas}</p>
											{item.keterangan && (
												<p className='text-[11px] text-gray-600 italic font-medium'>
													&ldquo;{item.keterangan}&rdquo;
												</p>
											)}
										</div>
										<div className='flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0'>
											<span
												className={`text-base font-black px-3 py-1 rounded-lg border-2 border-black ${
													item.tipe === 'Positif'
														? 'bg-emerald-400 text-black'
														: 'bg-rose-400 text-white'
												}`}>
												{item.tipe === 'Positif' ? `+${item.poin}` : `-${item.poin}`}
											</span>
											<span className='text-[11px] font-bold text-gray-500 font-mono'>
												{item.tanggal}
											</span>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className='text-xs font-bold text-gray-500 italic p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl'>
								Belum ada catatan poin perilaku siswa di kelas ini.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
