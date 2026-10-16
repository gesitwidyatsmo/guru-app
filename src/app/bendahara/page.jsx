'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
	parseJTM,
	formatRupiah,
	getDefaultCutOffRange,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
	calculateSingleGuruBisaroh,
} from '@/lib/bisaroh';

export default function BendaharaDashboardPage() {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [journals, setJournals] = useState([]);
	const [kelas, setKelas] = useState([]);
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);
	const [submissions, setSubmissions] = useState([]);
	const [dateRange, setDateRange] = useState(() => getDefaultCutOffRange());

	useEffect(() => {
		const loadDashboardData = async () => {
			setLoading(true);
			try {
				const [resUsers, resJurnal, resKelas, resSettings, resSubmissions] = await Promise.all([
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/kelas').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_submissions').catch(() => ({ ok: false })),
				]);

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
				}

				if (resJurnal.ok) {
					const data = await resJurnal.json();
					setJournals(Array.isArray(data) ? data : []);
				}

				if (resKelas.ok) {
					const data = await resKelas.json();
					setKelas(Array.isArray(data) ? data : []);
				}

				if (resSettings.ok) {
					const data = await resSettings.json();
					if (data?.value) {
						setSettings(normalizeBisarohSettings(data.value));
					}
				}

				if (resSubmissions.ok) {
					const data = await resSubmissions.json();
					setSubmissions(Array.isArray(data?.value) ? data.value : []);
				}
			} catch (err) {
				console.error('Error load bendahara dashboard data:', err);
			} finally {
				setLoading(false);
			}
		};

		loadDashboardData();
	}, []);

	// Filter dewan guru
	const guruList = useMemo(() => {
		return users.filter((u) => u.role === 'Guru');
	}, [users]);

	// Set nama wali kelas
	const waliKelasNames = useMemo(() => {
		const names = new Set();
		kelas.forEach((k) => {
			if (k.wali_kelas) names.add(String(k.wali_kelas).trim().toLowerCase());
		});
		return names;
	}, [kelas]);

	// Filter jurnal dalam rentang cut-off berjalan
	const periodJournals = useMemo(() => {
		return journals.filter((j) => {
			if (!j.tanggal) return false;
			return j.tanggal >= dateRange.startDate && j.tanggal <= dateRange.endDate;
		});
	}, [journals, dateRange]);

	// Agregasi jam mengajar & estimasi bisaroh per guru
	const guruStats = useMemo(() => {
		const map = {};

		guruList.forEach((g) => {
			const isWali = waliKelasNames.has(String(g.nama_lengkap || '').trim().toLowerCase()) ||
						   waliKelasNames.has(String(g.username || '').trim().toLowerCase());

			map[g.id_user] = {
				guru: g,
				isWaliKelas: isWali,
				totalJP: 0,
				totalSesi: 0,
				dates: new Set(),
				kendalaCount: 0,
			};
		});

		periodJournals.forEach((j) => {
			const gId = j.guru_id;
			if (map[gId]) {
				const jp = parseJTM(j.jam_ke);
				map[gId].totalJP += jp;
				map[gId].totalSesi += 1;
				map[gId].dates.add(j.tanggal);
				if (j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-') {
					map[gId].kendalaCount += 1;
				}
			}
		});

		return Object.values(map).map((item) => {
			const totalHadir = item.dates.size;
			const calc = calculateSingleGuruBisaroh({
				guru: item.guru,
				isWaliKelas: item.isWaliKelas,
				totalJP: item.totalJP,
				totalHadir,
				settings,
			});

			return {
				...item,
				...calc,
				totalBisaroh: calc.totalBersih,
			};
		}).sort((a, b) => b.totalJP - a.totalJP);
	}, [guruList, periodJournals, waliKelasNames, settings]);

	// Totals
	const summary = useMemo(() => {
		const totalJP = guruStats.reduce((acc, curr) => acc + curr.totalJP, 0);
		const totalBisaroh = guruStats.reduce((acc, curr) => acc + curr.totalBisaroh, 0);
		const activeGuruCount = guruStats.filter((g) => g.totalJP > 0).length;
		const totalSesi = periodJournals.length;
		const avgJP = activeGuruCount > 0 ? (totalJP / activeGuruCount).toFixed(1) : 0;

		return {
			totalJP,
			totalBisaroh,
			activeGuruCount,
			totalSesi,
			avgJP,
		};
	}, [guruStats, periodJournals]);

	// Submission aktif yang relevan dengan rentang cut-off saat ini
	const activeSubmission = useMemo(() => {
		if (submissions.length === 0) return null;
		const match = submissions.find(
			(s) => s.periode_mulai === dateRange.startDate && s.periode_selesai === dateRange.endDate
		);
		return match || submissions[0];
	}, [submissions, dateRange]);

	return (
		<div className='space-y-6'>
			{/* Welcome Banner */}
			<div className='bg-gradient-to-r from-teal-300 via-emerald-200 to-yellow-200 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] relative overflow-hidden'>
				<div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div>
						<div className='inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white rounded-lg text-xs font-black uppercase tracking-wider mb-2'>
							<span>💼</span>
							<span>Pusat Kendali Bisaroh & JTM</span>
						</div>
						<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
							Ringkasan Keuangan & Penggajian Guru
						</h1>
						<p className='text-xs sm:text-sm font-bold text-gray-800 mt-1'>
							Otomatisasi kalkulasi honorarium guru berbasis Jam Tatap Muka (JTM) riil dari Jurnal Pembelajaran.
						</p>
					</div>

					<div className='bg-white/95 border-2 border-black rounded-xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] shrink-0 text-right'>
						<p className='text-[10px] font-black uppercase text-gray-500'>Periode Cut-Off Berjalan</p>
						<p className='text-xs sm:text-sm font-black text-black mt-0.5'>
							{dateRange.startDate} <span className='text-teal-600'>s/d</span> {dateRange.endDate}
						</p>
						<Link
							href='/bendahara/tarif'
							className='text-[10px] font-black text-teal-800 hover:underline block mt-1'>
							⚙️ Tarif: {settings.tingkatan_guru?.length || 3} Tingkatan &bull; Atur
						</Link>
					</div>
				</div>
			</div>

			{/* Real-time Submission Status Notice */}
			{activeSubmission && activeSubmission.status === 'PERLU_REVISI' && (
				<div className='bg-rose-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='flex items-start gap-3'>
						<span className='w-9 h-9 rounded-xl bg-rose-300 border-2 border-black flex items-center justify-center text-base font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D] animate-bounce'>
							⚠️
						</span>
						<div>
							<div className='flex items-center gap-2'>
								<h3 className='text-xs sm:text-sm font-black text-rose-950 uppercase'>
									Kepala Sekolah Meminta Revisi Bisaroh ({activeSubmission.periode_mulai} s/d {activeSubmission.periode_selesai})
								</h3>
								<span className='px-1.5 py-0.5 bg-rose-300 border border-black rounded text-[9px] font-black uppercase text-rose-950'>
									Perlu Revisi
								</span>
							</div>
							<p className='text-xs font-bold text-black mt-1 bg-white/80 p-2 rounded-lg border border-rose-300'>
								Catatan Kepsek: &ldquo;{activeSubmission.catatan_kepsek || 'Mohon tinjau kembali data rekap penggajian.'}&rdquo;
							</p>
						</div>
					</div>
					<Link
						href='/bendahara/bisaroh'
						className='px-3.5 py-2 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto'>
						<span>🔧</span>
						<span>Buka & Perbaiki</span>
					</Link>
				</div>
			)}

			{activeSubmission && activeSubmission.status === 'MENUNGGU_PERSETUJUAN' && (
				<div className='bg-amber-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='flex items-start gap-3'>
						<span className='w-9 h-9 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center text-base font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D] animate-pulse'>
							⏳
						</span>
						<div>
							<div className='flex items-center gap-2'>
								<h3 className='text-xs sm:text-sm font-black text-black uppercase'>
									Pengajuan Bisaroh Sedang Ditinjau Kepsek ({activeSubmission.periode_mulai} s/d {activeSubmission.periode_selesai})
								</h3>
								<span className='px-1.5 py-0.5 bg-amber-300 border border-black rounded text-[9px] font-black uppercase text-black'>
									Menunggu ACC
								</span>
							</div>
							<p className='text-xs font-bold text-amber-900 mt-0.5'>
								Nominal {formatRupiah(activeSubmission.total_bersih)} ({activeSubmission.total_pegawai} pegawai) sedang dalam antrean verifikasi Kepala Sekolah.
							</p>
						</div>
					</div>
					<Link
						href='/bendahara/bisaroh'
						className='px-3.5 py-2 bg-amber-300 hover:bg-amber-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto'>
						<span>🔍</span>
						<span>Pantau Status</span>
					</Link>
				</div>
			)}

			{activeSubmission && activeSubmission.status === 'DISETUJUI' && (
				<div className='bg-emerald-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='flex items-start gap-3'>
						<span className='w-9 h-9 rounded-xl bg-emerald-300 border-2 border-black flex items-center justify-center text-base font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
							✅
						</span>
						<div>
							<div className='flex items-center gap-2'>
								<h3 className='text-xs sm:text-sm font-black text-emerald-950 uppercase'>
									Bisaroh Periode {activeSubmission.periode_mulai} s/d {activeSubmission.periode_selesai} Telah Di-ACC Resmi
								</h3>
								<span className='px-1.5 py-0.5 bg-emerald-300 border border-black rounded text-[9px] font-black uppercase text-emerald-950'>
									Disahkan
								</span>
							</div>
							<p className='text-xs font-bold text-emerald-900 mt-0.5'>
								Disahkan oleh {activeSubmission.disetujui_oleh || 'Kepala Sekolah'}. Siap dicairkan dan diekspor ke format SPJ.
							</p>
						</div>
					</div>
					<Link
						href='/bendahara/bisaroh'
						className='px-3.5 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto'>
						<span>📥</span>
						<span>Cetak Slip & SPJ</span>
					</Link>
				</div>
			)}

			{/* Metric Cards Row */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-xs font-black uppercase text-gray-500'>Estimasi Total Bisaroh</p>
						<span className='w-9 h-9 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D]'>
							💵
						</span>
					</div>
					<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-2'>
						{loading ? '...' : formatRupiah(summary.totalBisaroh)}
					</p>
					<p className='text-[11px] font-bold text-gray-500 mt-1'>
						Akumulasi honor JP + tunjangan periode ini
					</p>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-xs font-black uppercase text-gray-500'>Total JP Terlaksana</p>
						<span className='w-9 h-9 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D]'>
							⏱️
						</span>
					</div>
					<p className='text-2xl sm:text-3xl font-black text-black mt-2'>
						{loading ? '...' : `${summary.totalJP} JP`}
					</p>
					<p className='text-[11px] font-bold text-gray-500 mt-1'>
						Dari {summary.totalSesi} sesi jurnal mengajar
					</p>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-xs font-black uppercase text-gray-500'>Guru Aktif Mengajar</p>
						<span className='w-9 h-9 bg-teal-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D]'>
							👨‍🏫
						</span>
					</div>
					<p className='text-2xl sm:text-3xl font-black text-teal-950 mt-2'>
						{loading ? '...' : `${summary.activeGuruCount} / ${guruList.length}`}
					</p>
					<p className='text-[11px] font-bold text-gray-500 mt-1'>
						Guru yang sudah mengisi jurnal periode ini
					</p>
				</div>

				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-xs font-black uppercase text-gray-500'>Rata-rata JP / Guru</p>
						<span className='w-9 h-9 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#0D0D0D]'>
							📊
						</span>
					</div>
					<p className='text-2xl sm:text-3xl font-black text-indigo-950 mt-2'>
						{loading ? '...' : `${summary.avgJP} JP`}
					</p>
					<p className='text-[11px] font-bold text-gray-500 mt-1'>
						Beban mengajar riil terlaksana
					</p>
				</div>
			</div>

			{/* Quick Action Navigation Grid */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
				<Link
					href='/bendahara/jtm'
					className='p-4 bg-teal-50 hover:bg-teal-100 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-between group'>
					<div>
						<p className='text-xs font-black uppercase text-teal-900'>Rekap JTM Guru</p>
						<p className='text-[11px] font-bold text-teal-700 mt-0.5'>Audit jam tatap muka riil</p>
					</div>
					<span className='text-xl group-hover:translate-x-1 transition-transform'>➔</span>
				</Link>

				<Link
					href='/bendahara/bisaroh'
					className='p-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-between group'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-900'>Kalkulasi Bisaroh</p>
						<p className='text-[11px] font-bold text-emerald-700 mt-0.5'>Hitung & cetak slip gaji</p>
					</div>
					<span className='text-xl group-hover:translate-x-1 transition-transform'>➔</span>
				</Link>

				<Link
					href='/bendahara/jurnal'
					className='p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-between group'>
					<div>
						<p className='text-xs font-black uppercase text-yellow-900'>Audit Jurnal KBM</p>
						<p className='text-[11px] font-bold text-yellow-700 mt-0.5'>Cek materi & kendala guru</p>
					</div>
					<span className='text-xl group-hover:translate-x-1 transition-transform'>➔</span>
				</Link>

				<Link
					href='/bendahara/tarif'
					className='p-4 bg-rose-50 hover:bg-rose-100 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-between group'>
					<div>
						<p className='text-xs font-black uppercase text-rose-900'>Konfigurasi Tarif</p>
						<p className='text-[11px] font-bold text-rose-700 mt-0.5'>Setting tarif JP & tunjangan</p>
					</div>
					<span className='text-xl group-hover:translate-x-1 transition-transform'>➔</span>
				</Link>
			</div>

			{/* Main Grid: Top Teachers JTM & Recent Journals */}
			<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
				{/* Top Teachers JTM */}
				<div className='lg:col-span-2 bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden flex flex-col'>
					<div className='p-4 sm:p-5 bg-teal-200 border-b-2 border-black flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<span className='text-lg'>🏆</span>
							<h3 className='font-black text-sm uppercase tracking-tight text-black'>
								Peringkat Jam Mengajar (JTM) Terbanyak Periode Ini
							</h3>
						</div>
						<Link
							href='/bendahara/jtm'
							className='text-xs font-black uppercase text-black hover:underline'>
							Lihat Semua &rarr;
						</Link>
					</div>

					<div className='overflow-x-auto flex-1'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='bg-gray-50 border-b-2 border-black text-[11px] font-black uppercase text-gray-600'>
									<th className='px-4 py-3'>Nama Guru</th>
									<th className='px-4 py-3 text-center'>Total Hadir</th>
									<th className='px-4 py-3 text-center'>Total JP</th>
									<th className='px-4 py-3 text-right'>Estimasi Bisaroh</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-black/10 text-xs font-bold'>
								{guruStats.slice(0, 5).map((item, idx) => (
									<tr key={item.guru.id_user || idx} className='hover:bg-yellow-50/50 transition-colors'>
										<td className='px-4 py-3'>
											<div className='flex items-center gap-2.5'>
												<span className='w-6 h-6 rounded-lg bg-teal-100 border border-black flex items-center justify-center font-black text-[10px]'>
													{idx + 1}
												</span>
												<div>
													<p className='font-black text-black'>{item.guru.nama_lengkap}</p>
													<div className='flex items-center gap-1.5 mt-0.5'>
														<span className='text-[10px] text-gray-500'>@{item.guru.username}</span>
														<span className='px-1.5 py-0.2 bg-teal-100 border border-teal-800 text-teal-900 text-[9px] font-black rounded uppercase'>
															{item.tingkatan?.nama || 'Reguler'}
														</span>
														{item.isWaliKelas && (
															<span className='px-1.5 py-0.2 bg-yellow-200 border border-yellow-800 text-yellow-950 text-[9px] font-black rounded uppercase'>
																Wali Kelas
															</span>
														)}
													</div>
												</div>
											</div>
										</td>
										<td className='px-4 py-3 text-center font-mono'>
											<span className='px-2 py-0.5 bg-gray-100 border border-black/20 rounded font-black'>
												{item.totalHadir} Hari
											</span>
										</td>
										<td className='px-4 py-3 text-center font-mono'>
											<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg font-black text-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
												{item.totalJP} JP
											</span>
										</td>
										<td className='px-4 py-3 text-right font-black font-mono text-emerald-800'>
											{formatRupiah(item.totalBisaroh)}
										</td>
									</tr>
								))}

								{guruStats.length === 0 && !loading && (
									<tr>
										<td colSpan={4} className='px-4 py-8 text-center text-gray-500'>
											Belum ada data jurnal yang terekam pada periode ini.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Recent Journal Stream */}
				<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden flex flex-col'>
					<div className='p-4 sm:p-5 bg-yellow-300 border-b-2 border-black flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<span className='text-lg'>📖</span>
							<h3 className='font-black text-sm uppercase tracking-tight text-black'>
								Log Jurnal Terkini
							</h3>
						</div>
						<Link
							href='/bendahara/jurnal'
							className='text-xs font-black uppercase text-black hover:underline'>
							Audit &rarr;
						</Link>
					</div>

					<div className='p-4 divide-y divide-black/10 space-y-3 overflow-y-auto flex-1 max-h-[420px]'>
						{periodJournals.slice(0, 5).map((j) => (
							<div key={j.id} className='pt-3 first:pt-0 space-y-1.5'>
								<div className='flex items-center justify-between'>
									<span className='text-[10px] font-mono font-black bg-gray-100 px-2 py-0.5 rounded border border-black/20'>
										{j.tanggal}
									</span>
									<span className='text-[10px] font-black uppercase bg-teal-100 text-teal-900 border border-teal-800 px-2 py-0.5 rounded'>
										Jam Ke: {j.jam_ke} ({parseJTM(j.jam_ke)} JP)
									</span>
								</div>
								<p className='text-xs font-black text-black line-clamp-1'>
									{j.mapel} &bull; <span className='text-gray-600 font-bold'>Kelas {j.kelas}</span>
								</p>
								<p className='text-[11px] text-gray-600 line-clamp-2'>
									Materi: {j.materi || '-'}
								</p>
								{j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-' && (
									<span className='inline-block text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded'>
										⚠️ Kendala: {j.hambatan}
									</span>
								)}
							</div>
						))}

						{periodJournals.length === 0 && !loading && (
							<div className='py-8 text-center text-xs font-bold text-gray-500'>
								Tidak ada jurnal pembelajaran dalam periode ini.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
