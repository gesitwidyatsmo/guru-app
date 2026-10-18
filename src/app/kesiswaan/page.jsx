'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { useKesiswaanAuth } from './KesiswaanLayoutClient';
import { getTodayDateString } from '@/lib/dateUtils';

export default function RadarAbsensiBolosPage() {
	const { role, nama } = useKesiswaanAuth();
	const [selectedDate, setSelectedDate] = useState(() => getTodayDateString());
	const [selectedKelas, setSelectedKelas] = useState('Semua');
	const [kelasList, setKelasList] = useState([]);
	const [radarData, setRadarData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('bolos'); // 'bolos' | 'kronis' | 'rekap'
	const [filterTemuan, setFilterTemuan] = useState('ALL'); // 'ALL' | 'CABUT_SIANG' | 'BOLOS_AWAL' | 'BOLOS_TENGAH' | 'SIAGA_PAGI' | 'ALFA_TOTAL'

	// Load list kelas untuk dropdown
	useEffect(() => {
		fetch('/api/kelas')
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setKelasList(Array.isArray(data) ? data : []))
			.catch(() => {});
	}, []);

	// Fetch Radar Data
	const fetchRadar = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams({ tanggal: selectedDate });
			if (selectedKelas && selectedKelas !== 'Semua') {
				params.append('kelas', selectedKelas);
			}

			const res = await fetch(`/api/kesiswaan/radar-bolos?${params.toString()}`);
			if (!res.ok) {
				throw new Error('Gagal memuat data radar absensi');
			}
			const data = await res.json();
			setRadarData(data);
		} catch (err) {
			console.error('Error fetching radar data:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Radar',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setLoading(false);
		}
	}, [selectedDate, selectedKelas]);

	useEffect(() => {
		fetchRadar();
	}, [fetchRadar]);

	const summary = radarData?.summary || {
		hadir: 0,
		sakit: 0,
		izin: 0,
		alfa: 0,
		bolosCabut: 0,
		bolosAwal: 0,
		bolosTengah: 0,
		siagaPagi: 0,
		persenHadirSekolah: 0,
	};

	const radarBolos = radarData?.radarBolos || [];
	const radarKronis = radarData?.radarKronis || [];
	const rekapKelas = radarData?.rekapKelas || [];

	// Filter radar bolos berdasarkan kategori temuan
	const filteredRadarBolos = useMemo(() => {
		if (filterTemuan === 'ALL') return radarBolos;
		return radarBolos.filter((r) => r.tipe_temuan === filterTemuan);
	}, [radarBolos, filterTemuan]);

	if (loading && !radarData) {
		return <Loader />;
	}

	return (
		<div className='space-y-6'>
			{/* Banner Utama */}
			<div className='p-6 bg-gradient-to-r from-emerald-100 via-teal-100 to-yellow-100 border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-white text-[10px] font-black rounded-md uppercase tracking-wider'>
							Sistem Pengawasan Presensi
						</span>
						<span className='px-2 py-0.5 bg-emerald-400 border border-black rounded-md text-[10px] font-black text-black'>
							Live Cross-Session Audit
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>📡</span> Radar Absensi & Deteksi Bolos
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-2xl'>
						Audit cerdas lintas sesi KBM: mendeteksi siswa yang hadir di sekolah namun membolos pada jam mata pelajaran tertentu, serta memantau siswa alfa kronis.
					</p>
				</div>

				{/* Filter Tanggal & Kelas */}
				<div className='bg-white p-3 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-wrap items-center gap-2 shrink-0'>
					<div>
						<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Tanggal Audit</label>
						<input
							type='date'
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.target.value)}
							className='neo-input !py-1 text-xs font-black bg-yellow-50'
						/>
					</div>

					<div>
						<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Filter Rombel</label>
						<select
							value={selectedKelas}
							onChange={(e) => setSelectedKelas(e.target.value)}
							className='neo-input !py-1 text-xs font-bold bg-white'>
							<option value='Semua'>Semua Rombel</option>
							{kelasList.map((k) => (
								<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
									{k.nama_kelas || k.kelas}
								</option>
							))}
						</select>
					</div>

					<button
						onClick={fetchRadar}
						title='Muat Ulang Data'
						className='self-end p-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
						<svg className='w-4 h-4 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
						</svg>
					</button>
				</div>
			</div>

			{/* Kartu Metrik Kehadiran Sekolah */}
			<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5'>
				<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-[11px] font-black uppercase text-gray-500 tracking-wider'>Total Santri</p>
					<p className='text-3xl font-black text-black mt-1'>{radarData?.totalSiswa || 0}</p>
					<span className='text-[10px] font-bold text-gray-600'>Terdaftar aktif</span>
				</div>

				<div className='bg-emerald-50 border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-[11px] font-black uppercase text-emerald-800 tracking-wider'>Kehadiran KBM</p>
					<div className='flex items-baseline gap-1 mt-1'>
						<p className='text-3xl font-black text-emerald-950'>{summary.persenHadirSekolah}%</p>
						<span className='text-xs font-bold text-emerald-800'>({summary.hadir} santri)</span>
					</div>
					<span className='text-[10px] font-bold text-emerald-700'>Mengikuti jam KBM</span>
				</div>

				<div className='bg-rose-100 border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-rose-900 tracking-wider'>Cabut Jam Siang</p>
						<span className='w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse'></span>
					</div>
					<p className='text-3xl font-black text-rose-950 mt-1'>{summary.bolosCabut || 0}</p>
					<span className='text-[10px] font-bold text-rose-800'>Hadir awal, kabur di siang</span>
				</div>

				<div className='bg-amber-100 border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-amber-900 tracking-wider'>Bolos Jam Awal</p>
						<span className='text-base'>⏳</span>
					</div>
					<p className='text-3xl font-black text-amber-950 mt-1'>{summary.bolosAwal || 0}</p>
					<span className='text-[10px] font-bold text-amber-800'>Alfa jam 1-2, masuk siang</span>
				</div>

				<div className='bg-red-50 border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] col-span-2 sm:col-span-1'>
					<p className='text-[11px] font-black uppercase text-red-900 tracking-wider'>Siaga Pagi / Alfa</p>
					<div className='flex items-baseline gap-1 mt-1'>
						<p className='text-3xl font-black text-red-950'>{(summary.siagaPagi || 0) + (summary.alfa || 0)}</p>
					</div>
					<span className='text-[10px] font-bold text-red-700'>
						{summary.siagaPagi || 0} Siaga Jam 1 • {summary.alfa || 0} Alfa KBM
					</span>
				</div>
			</div>

			{/* Navigasi Tab Radar */}
			<div className='flex flex-wrap items-center gap-2 border-b-2 border-black pb-2'>
				<button
					onClick={() => setActiveTab('bolos')}
					className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-2 transition-all flex items-center gap-2 ${
						activeTab === 'bolos'
							? 'bg-rose-500 text-white border-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-black border-black/30 hover:border-black'
					}`}>
					<span>🚨</span>
					<span>Radar Bolos Jam Mapel ({radarBolos.length})</span>
				</button>

				<button
					onClick={() => setActiveTab('kronis')}
					className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-2 transition-all flex items-center gap-2 ${
						activeTab === 'kronis'
							? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-black border-black/30 hover:border-black'
					}`}>
					<span>⚠️</span>
					<span>Radar Siswa Alfa Kronis ({radarKronis.length})</span>
				</button>

				<button
					onClick={() => setActiveTab('rekap')}
					className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-2 transition-all flex items-center gap-2 ${
						activeTab === 'rekap'
							? 'bg-yellow-300 text-black border-black shadow-[3px_3px_0px_0px_#0D0D0D]'
							: 'bg-white text-black border-black/30 hover:border-black'
					}`}>
					<span>📊</span>
					<span>Rekapitulasi Kehadiran per Rombel ({rekapKelas.length})</span>
				</button>
			</div>

			{/* ======================================================================== */}
			{/* KONTEN TAB 1: RADAR BOLOS JAM MAPEL (CABUT, BOLOS AWAL, & SIAGA PAGI) */}
			{/* ======================================================================== */}
			{activeTab === 'bolos' && (
				<div className='bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='p-4 border-b-2 border-black bg-rose-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
						<div>
							<h3 className='font-black text-sm text-rose-950 uppercase tracking-tight flex items-center gap-1.5'>
								<span>🚨</span> Temuan Siswa Bolos & Anomali Jam KBM Hari Ini
							</h3>
							<p className='text-[11px] font-semibold text-rose-900'>
								Audit cerdas berbasis sesi KBM guru: mendeteksi santri yang cabut siang, bolos jam pertama/masuk siang, maupun siaga pagi.
							</p>
						</div>
						<span className='px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-lg border border-black shrink-0'>
							{radarBolos.length} Kasus Terdeteksi
						</span>
					</div>

					{/* Sub-Filter Kategori Temuan Bolos */}
					<div className='p-3 border-b-2 border-black bg-gray-50 flex flex-wrap items-center gap-1.5'>
						<span className='text-[10px] font-black uppercase text-gray-500 mr-1'>Filter Temuan:</span>
						<button
							onClick={() => setFilterTemuan('ALL')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'ALL'
									? 'bg-black text-white border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-gray-800 border-black/30 hover:border-black'
							}`}>
							Semua ({radarBolos.length})
						</button>
						<button
							onClick={() => setFilterTemuan('CABUT_SIANG')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'CABUT_SIANG'
									? 'bg-rose-600 text-white border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-rose-900 border-rose-300 hover:border-black'
							}`}>
							🚨 Cabut Siang ({summary.bolosCabut || 0})
						</button>
						<button
							onClick={() => setFilterTemuan('BOLOS_AWAL')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'BOLOS_AWAL'
									? 'bg-amber-400 text-black border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-amber-900 border-amber-300 hover:border-black'
							}`}>
							⏳ Bolos Jam Awal ({summary.bolosAwal || 0})
						</button>
						<button
							onClick={() => setFilterTemuan('BOLOS_TENGAH')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'BOLOS_TENGAH'
									? 'bg-purple-600 text-white border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-purple-900 border-purple-300 hover:border-black'
							}`}>
							🎯 Pilih Mapel ({summary.bolosTengah || 0})
						</button>
						<button
							onClick={() => setFilterTemuan('SIAGA_PAGI')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'SIAGA_PAGI'
									? 'bg-red-600 text-white border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-red-900 border-red-300 hover:border-black'
							}`}>
							🔍 Siaga Jam 1 ({summary.siagaPagi || 0})
						</button>
						<button
							onClick={() => setFilterTemuan('ALFA_TOTAL')}
							className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
								filterTemuan === 'ALFA_TOTAL'
									? 'bg-gray-800 text-white border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D]'
									: 'bg-white text-gray-800 border-gray-300 hover:border-black'
							}`}>
							⛔ Alfa KBM ({radarBolos.filter((r) => r.tipe_temuan === 'ALFA_TOTAL').length})
						</button>
					</div>

					{loading ? (
						<div className='p-16 text-center space-y-3 bg-white'>
							<div className='inline-block w-9 h-9 border-4 border-black border-t-rose-500 rounded-full animate-spin'></div>
							<p className='text-xs font-black text-black tracking-wide'>
								Memindai sesi KBM & data presensi sekolah...
							</p>
						</div>
					) : filteredRadarBolos.length === 0 ? (
						<div className='p-14 text-center text-gray-500 font-bold space-y-2'>
							<span className='text-5xl block'>🎉</span>
							<p className='text-base font-black text-black'>
								{filterTemuan === 'ALL'
									? 'Radar Bersih: Tidak Ada Siswa Bolos Terdeteksi'
									: 'Tidak Ada Temuan untuk Kategori Ini'}
							</p>
							<p className='text-xs text-gray-600 max-w-md mx-auto'>
								Seluruh siswa mengikuti sesi mata pelajaran sesuai jadwal pada kategori ini.
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[1200px] text-left text-sm'>
								<thead>
									<tr className='border-b-2 border-black text-[11px] font-black uppercase text-gray-600 bg-gray-100 whitespace-nowrap'>
										<th className='py-3.5 px-4 min-w-[210px]'>Siswa</th>
										<th className='py-3.5 px-4 min-w-[90px] text-center'>Rombel</th>
										<th className='py-3.5 px-4 min-w-[230px]'>Kategori Temuan & Pola</th>
										<th className='py-3.5 px-4 min-w-[340px]'>Jam Mapel yang Ditinggalkan (Bolos)</th>
										<th className='py-3.5 px-4 min-w-[180px] text-center'>Rasio Bolos KBM</th>
										<th className='py-3.5 px-4 min-w-[150px] text-right'>Tindakan</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-200 font-bold'>
									{filteredRadarBolos.map((s) => (
										<tr key={s.siswa_id} className='hover:bg-rose-50/60 transition-colors'>
											<td className='py-3.5 px-4 whitespace-nowrap'>
												<div>
													<p className='font-black text-black text-sm'>{s.nama_lengkap}</p>
													<p className='text-[10px] text-gray-500 font-mono'>
														NIS: {s.nis || '—'} • {s.jenis_kelamin}
													</p>
												</div>
											</td>

											<td className='py-3.5 px-4 text-center whitespace-nowrap'>
												<span className='px-2.5 py-1 bg-yellow-100 text-black border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{s.kelas}
												</span>
											</td>

											<td className='py-3.5 px-4 whitespace-nowrap'>
												<div className='flex flex-col gap-0.5'>
													<span
														className={`px-2.5 py-1 rounded-md text-xs font-black border border-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1 w-fit ${
															s.tipe_temuan === 'SIAGA_PAGI'
																? 'bg-red-600 text-white animate-pulse'
																: s.tipe_temuan === 'BOLOS_AWAL'
																? 'bg-amber-400 text-black'
																: s.tipe_temuan === 'BOLOS_TENGAH'
																? 'bg-purple-600 text-white'
																: s.tipe_temuan === 'ALFA_TOTAL'
																? 'bg-gray-800 text-white'
																: 'bg-rose-600 text-white'
														}`}>
														{s.label_tipe || 'Bolos Jam Pelajaran'}
													</span>
													<span className='text-[10px] text-gray-600 font-medium max-w-xs truncate'>
														{s.deskripsi_temuan}
													</span>
												</div>
											</td>

											<td className='py-3.5 px-4 min-w-[340px]'>
												<div className='flex flex-wrap gap-1.5'>
													{s.detail_sesi_bolos.map((b, idx) => (
														<span
															key={idx}
															className='px-2.5 py-1 bg-rose-100 text-rose-950 border border-rose-300 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm whitespace-nowrap'>
															<span>⚠️</span>
															<span className='font-black'>Jam {b.jam_ke}</span>
															<span className='font-medium text-rose-850'>({b.mapel} - {b.guru})</span>
														</span>
													))}
												</div>
											</td>

											<td className='py-3.5 px-4 text-center whitespace-nowrap'>
												<div className='inline-flex flex-col items-center gap-1'>
													<span className='px-3 py-1 bg-rose-500 text-white rounded-lg text-xs font-black border border-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D] tracking-wide'>
														{s.sesi_bolos} dari {s.total_sesi} Sesi Mapel
													</span>
													<span className='text-[10px] font-bold text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200'>
														Cabut {Math.round((s.sesi_bolos / (s.total_sesi || 1)) * 100)}% Jam KBM
													</span>
												</div>
											</td>

											<td className='py-3.5 px-4 text-right whitespace-nowrap'>
												<div className='flex items-center justify-end gap-1.5'>
													<Link
														href={`/kesiswaan/penanganan`}
														className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black border border-black rounded-lg text-xs font-black shadow-[1.5px_1.5px_0px_0px_#0D0D0D] inline-flex items-center gap-1.5 transition-transform active:scale-95'>
														<span>📋</span> Catat Bimbingan
													</Link>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* ======================================================================== */}
			{/* KONTEN TAB 2: RADAR SISWA ALFA KRONIS */}
			{/* ======================================================================== */}
			{activeTab === 'kronis' && (
				<div className='bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='p-4 border-b-2 border-black bg-black text-white flex items-center justify-between'>
						<div>
							<h3 className='font-black text-sm uppercase tracking-tight flex items-center gap-1.5'>
								<span>⚠️</span> Radar Siswa Sering Tidak Hadir (Alfa ≥ 3 Hari dalam 14 Hari)
							</h3>
							<p className='text-[11px] font-medium text-gray-300'>
								Siswa yang membutuhkan penanganan khusus, konseling BK, atau pemanggilan orang tua / wali murid.
							</p>
						</div>
						<span className='px-3 py-1 bg-rose-500 text-white text-xs font-black rounded-lg border border-white'>
							{radarKronis.length} Siswa Terdaftar
						</span>
					</div>

					{loading ? (
						<div className='p-16 text-center space-y-3 bg-white'>
							<div className='inline-block w-9 h-9 border-4 border-black border-t-yellow-400 rounded-full animate-spin'></div>
							<p className='text-xs font-black text-black tracking-wide'>
								Memindai rekor kehadiran santri 14 hari terakhir...
							</p>
						</div>
					) : radarKronis.length === 0 ? (
						<div className='p-14 text-center text-gray-500 font-bold space-y-2'>
							<span className='text-5xl block'>👍</span>
							<p className='text-base font-black text-black'>Tidak Ada Siswa dengan Rekor Alfa Kronis</p>
							<p className='text-xs text-gray-600 max-w-md mx-auto'>
								Seluruh siswa memiliki tingkat kehadiran harian yang stabil dalam 14 hari terakhir.
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[1000px] text-left text-sm'>
								<thead>
									<tr className='border-b-2 border-black text-[11px] font-black uppercase text-gray-600 bg-gray-100 whitespace-nowrap'>
										<th className='py-3.5 px-4 w-12 text-center'>No</th>
										<th className='py-3.5 px-4 min-w-[220px]'>Siswa</th>
										<th className='py-3.5 px-4 min-w-[100px] text-center'>Rombel</th>
										<th className='py-3.5 px-4 min-w-[160px] text-center'>Total Alfa (14 Hari)</th>
										<th className='py-3.5 px-4 min-w-[150px] text-center'>Tingkat Urgensi</th>
										<th className='py-3.5 px-4 min-w-[220px] text-right'>Rekomendasi Tindakan</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-200 font-bold'>
									{radarKronis.map((s, idx) => (
										<tr key={s.siswa_id} className='hover:bg-yellow-50 transition-colors whitespace-nowrap'>
											<td className='py-3.5 px-4 font-mono text-xs text-center'>{idx + 1}</td>
											<td className='py-3.5 px-4'>
												<p className='font-black text-black text-sm'>{s.nama_lengkap}</p>
												<p className='text-[10px] text-gray-500 font-mono'>NIS: {s.nis || '—'}</p>
											</td>
											<td className='py-3.5 px-4 text-center'>
												<span className='px-2.5 py-1 bg-yellow-100 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{s.kelas}
												</span>
											</td>
											<td className='py-3.5 px-4 text-center'>
												<span className='px-3 py-1 bg-rose-100 text-rose-950 border border-rose-400 rounded-md text-xs font-black'>
													{s.total_alfa_14_hari} Hari Alfa
												</span>
											</td>
											<td className='py-3.5 px-4 text-center'>
												<span
													className={`px-3 py-1 rounded-md text-xs font-black border ${
														s.total_alfa_14_hari >= 5
															? 'bg-rose-500 text-white border-black'
															: 'bg-amber-100 text-amber-900 border-amber-400'
													}`}>
													{s.status_peringatan}
												</span>
											</td>
											<td className='py-3.5 px-4 text-right'>
												{s.total_alfa_14_hari >= 5 ? (
													<div className='flex items-center justify-end gap-1.5'>
														<Link
															href={`/kesiswaan/pemanggilan-ortu?siswa_id=${s.siswa_id}&nama=${encodeURIComponent(s.nama_lengkap)}`}
															className='px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1 transition-transform active:scale-95'>
															<span>📩</span> Surat Panggilan
														</Link>
														<a
															href={`https://wa.me/?text=${encodeURIComponent(
																`Pemberitahuan Resmi Kesiswaan: Siswa atas nama ${s.nama_lengkap} (Kelas ${s.kelas}) tercatat telah tidak hadir tanpa keterangan (Alfa) sebanyak ${s.total_alfa_14_hari} hari dalam 14 hari terakhir. Mengingat pentingnya keberlanjutan studi ananda, kami mengundang Bapak/Ibu Orang Tua/Wali Murid untuk hadir ke sekolah guna koordinasi dan pemanggilan pembinaan kesiswaan.`
															)}`}
															target='_blank'
															rel='noopener noreferrer'
															title='Kirim Notifikasi WA ke Orang Tua'
															className='px-2.5 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-black border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1 transition-transform active:scale-95'>
															<span>💬</span> WA
														</a>
													</div>
												) : (
													<div className='flex items-center justify-end gap-1.5'>
														<Link
															href={`/kesiswaan/penanganan`}
															className='text-xs font-black text-black bg-yellow-300 hover:bg-yellow-400 px-2.5 py-1.5 rounded-lg border border-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1 transition-transform active:scale-95'>
															<span>📋</span> Bimbingan WK
														</Link>
													</div>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* ======================================================================== */}
			{/* KONTEN TAB 3: REKAPITULASI KEHADIRAN PER ROMBEL */}
			{/* ======================================================================== */}
			{activeTab === 'rekap' && (
				<div className='bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='p-4 border-b-2 border-black bg-yellow-50 flex items-center justify-between'>
						<div>
							<h3 className='font-black text-sm text-black uppercase tracking-tight flex items-center gap-1.5'>
								<span>📊</span> Rekapitulasi Presensi per Rombel ({selectedDate})
							</h3>
							<p className='text-[11px] font-semibold text-gray-600'>
								Perbandingan persentase kehadiran dan jumlah siswa tidak hadir per kelas
							</p>
						</div>
					</div>

					{loading ? (
						<div className='p-16 text-center space-y-3 bg-white'>
							<div className='inline-block w-9 h-9 border-4 border-black border-t-yellow-400 rounded-full animate-spin'></div>
							<p className='text-xs font-black text-black tracking-wide'>
								Memuat rekapitulasi kehadiran per rombel...
							</p>
						</div>
					) : rekapKelas.length === 0 ? (
						<div className='p-14 text-center text-gray-500 font-bold space-y-2'>
							<span className='text-5xl block'>📊</span>
							<p className='text-base font-black text-black'>Belum Ada Rekapitulasi Kelas</p>
							<p className='text-xs text-gray-600 max-w-md mx-auto'>
								Tidak ada data presensi yang ditemukan untuk tanggal ini.
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[950px] text-left text-sm'>
								<thead>
									<tr className='border-b-2 border-black text-[11px] font-black uppercase text-gray-600 bg-gray-100 whitespace-nowrap'>
										<th className='py-3.5 px-4 min-w-[140px]'>Rombel Kelas</th>
										<th className='py-3.5 px-4 text-center min-w-[100px]'>Total Siswa</th>
										<th className='py-3.5 px-4 text-center text-emerald-800 min-w-[90px]'>Hadir</th>
										<th className='py-3.5 px-4 text-center text-amber-800 min-w-[90px]'>Sakit</th>
										<th className='py-3.5 px-4 text-center text-blue-800 min-w-[90px]'>Izin</th>
										<th className='py-3.5 px-4 text-center text-rose-800 min-w-[90px]'>Alfa</th>
										<th className='py-3.5 px-4 text-center text-rose-950 min-w-[110px]'>Bolos Mapel</th>
										<th className='py-3.5 px-4 min-w-[200px]'>Persentase Kehadiran</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-200 font-bold'>
									{rekapKelas.map((k) => (
										<tr key={k.kelas} className='hover:bg-yellow-50 transition-colors whitespace-nowrap'>
											<td className='py-3.5 px-4 font-black text-black'>{k.kelas}</td>
											<td className='py-3.5 px-4 text-center'>{k.totalSiswa}</td>
											<td className='py-3.5 px-4 text-center text-emerald-700 font-black'>{k.hadir}</td>
											<td className='py-3.5 px-4 text-center text-amber-700'>{k.sakit}</td>
											<td className='py-3.5 px-4 text-center text-blue-700'>{k.izin}</td>
											<td className='py-3.5 px-4 text-center text-rose-700 font-black'>{k.alfa}</td>
											<td className='py-3.5 px-4 text-center'>
												{k.bolosCabut > 0 ? (
													<span className='px-2.5 py-0.5 bg-rose-200 text-rose-950 border border-rose-400 rounded-md text-xs font-black'>
														{k.bolosCabut}
													</span>
												) : (
													<span className='text-gray-400 font-normal'>0</span>
												)}
											</td>
											<td className='py-3.5 px-4'>
												<div className='flex items-center gap-2'>
													<div className='flex-1 h-3 bg-gray-200 rounded-full overflow-hidden border border-black/30'>
														<div
															className={`h-full rounded-full ${
																k.persenHadir >= 90
																	? 'bg-emerald-500'
																	: k.persenHadir >= 75
																	? 'bg-amber-400'
																	: 'bg-rose-500'
															}`}
															style={{ width: `${k.persenHadir}%` }}
														/>
													</div>
													<span className='text-xs font-black text-black w-10 text-right'>
														{k.persenHadir}%
													</span>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
