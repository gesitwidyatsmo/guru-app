'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';
import { useKurikulumAuth } from './KurikulumLayoutClient';
import { getTodayDateString } from '@/lib/dateUtils';

export default function KurikulumDashboard() {
	const { role, nama } = useKurikulumAuth();
	const [loading, setLoading] = useState(true);

	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [kbmList, setKbmList] = useState([]);
	const [jurnalList, setJurnalList] = useState([]);
	const [jadwalList, setJadwalList] = useState([]);

	const todayStr = useMemo(() => getTodayDateString(), []);
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				setLoading(true);
				const [resUsers, resKelas, resMapel, resKbm, resJurnal, resJadwal, resSiswa] = await Promise.all([
					fetch('/api/users'),
					fetch('/api/kelas'),
					fetch('/api/mapel?all=true'),
					fetch('/api/kbm'),
					fetch('/api/jurnal'),
					fetch('/api/jadwal'),
					fetch('/api/siswa'),
				]);

				if (resUsers.ok) setGuruList((await resUsers.json()).filter((u) => u.role === 'Guru'));
				if (resKelas.ok) setKelasList(await resKelas.json());
				if (resMapel.ok) setMapelList(await resMapel.json());
				if (resKbm.ok) setKbmList(await resKbm.json());
				if (resJurnal.ok) setJurnalList(await resJurnal.json());
				if (resJadwal.ok) setJadwalList(await resJadwal.json());
				if (resSiswa.ok) setSiswaList(await resSiswa.json());
			} catch (err) {
				console.error('Error fetching Kurikulum dashboard data:', err);
				Swal.fire('Terjadi Kesalahan', 'Gagal memuat data statistik kurikulum.', 'error');
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	// Jurnal Hari Ini
	const jurnalHariIni = useMemo(() => {
		return jurnalList.filter((j) => j.tanggal === todayStr);
	}, [jurnalList, todayStr]);

	// Jadwal Hari Ini
	const jadwalHariIni = useMemo(() => {
		return jadwalList.filter((j) => j.hari === hariIni);
	}, [jadwalList, hariIni]);

	// Guru yang memiliki jadwal hari ini
	const guruJadwalHariIni = useMemo(() => {
		const map = new Map();
		jadwalHariIni.forEach((j) => {
			if (!map.has(j.id_user)) {
				map.set(j.id_user, {
					id_user: j.id_user,
					nama_guru: j.users?.nama_lengkap || 'Guru',
					sesiList: [],
				});
			}
			map.get(j.id_user).sesiList.push(j);
		});
		return Array.from(map.values());
	}, [jadwalHariIni]);

	// Guru yang sudah mengisi jurnal hari ini
	const guruSudahIsiJurnalIds = useMemo(() => {
		return new Set(jurnalHariIni.map((j) => j.guru_id));
	}, [jurnalHariIni]);

	// Rekap Beban Mengajar KBM per Guru
	const bebanGuruSummary = useMemo(() => {
		const map = {};
		kbmList.forEach((k) => {
			if (!map[k.id_user]) {
				map[k.id_user] = {
					nama_guru: k.nama_guru,
					username: k.username,
					total_rombel: 0,
					mapelSet: new Set(),
				};
			}
			map[k.id_user].total_rombel += 1;
			map[k.id_user].mapelSet.add(k.mapel);
		});

		return Object.values(map)
			.map((g) => ({
				...g,
				total_mapel: g.mapelSet.size,
			}))
			.sort((a, b) => b.total_rombel - a.total_rombel);
	}, [kbmList]);

	if (loading) {
		return <Loader text='Memuat Dashboard Kurikulum...' />;
	}

	return (
		<div className='space-y-6'>
			{/* TOP BANNER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1'>
						<span className='px-2 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded'>
							Portal Akademik
						</span>
						<span className='text-xs font-bold text-black/70'>
							{hariIni}, {todayStr}
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Halo, {nama || 'Tim Kurikulum'}! 📐
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl'>
						Pusat komando kurikulum, pengaturan penugasan KBM dewan guru, penyusunan jadwal pelajaran, serta supervisi ketercapaian pembelajaran institusi.
					</p>
				</div>
				<div className='shrink-0'>
					<AcademicPeriodChip />
				</div>
			</div>

			{/* METRIC CARDS */}
			<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5'>
				<div className='bg-emerald-100 border-2 border-black rounded-xl p-3.5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-xs font-black uppercase text-emerald-900'>Guru Pengajar</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{guruList.length}</p>
						<p className='text-[10px] font-bold text-emerald-800 mt-1'>Tenaga Pendidik</p>
					</div>
					<div className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						👨‍🏫
					</div>
				</div>

				<Link
					href='/kurikulum/kelas'
					className='bg-sky-100 border-2 border-black rounded-xl p-3.5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between hover:bg-sky-200 transition-colors group'>
					<div>
						<p className='text-xs font-black uppercase text-sky-900 group-hover:underline'>Rombel Kelas</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kelasList.length}</p>
						<p className='text-[10px] font-bold text-sky-800 mt-1'>Kelola Rombel →</p>
					</div>
					<div className='w-11 h-11 bg-sky-300 border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🏫
					</div>
				</Link>

				<Link
					href='/kurikulum/siswa'
					className='bg-indigo-100 border-2 border-black rounded-xl p-3.5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between hover:bg-indigo-200 transition-colors group'>
					<div>
						<p className='text-xs font-black uppercase text-indigo-900 group-hover:underline'>Peserta Didik</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{siswaList.length}</p>
						<p className='text-[10px] font-bold text-indigo-800 mt-1'>Kelola Siswa →</p>
					</div>
					<div className='w-11 h-11 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						🎓
					</div>
				</Link>

				<Link
					href='/kurikulum/mapel'
					className='bg-amber-100 border-2 border-black rounded-xl p-3.5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between hover:bg-amber-200 transition-colors group'>
					<div>
						<p className='text-xs font-black uppercase text-amber-900 group-hover:underline'>Mata Pelajaran</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{mapelList.length}</p>
						<p className='text-[10px] font-bold text-amber-800 mt-1'>Katalog Mapel →</p>
					</div>
					<div className='w-11 h-11 bg-amber-300 border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📚
					</div>
				</Link>

				<Link
					href='/kurikulum/penugasan'
					className='bg-purple-100 border-2 border-black rounded-xl p-3.5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between hover:bg-purple-200 transition-colors group col-span-2 sm:col-span-1'>
					<div>
						<p className='text-xs font-black uppercase text-purple-900 group-hover:underline'>Penugasan KBM</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kbmList.length}</p>
						<p className='text-[10px] font-bold text-purple-800 mt-1'>Plotting SK KBM →</p>
					</div>
					<div className='w-11 h-11 bg-purple-300 border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📋
					</div>
				</Link>
			</div>

			{/* RADAR KBM & JURNAL HARI INI */}
			<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
				<div className='lg:col-span-2 bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center justify-between border-b-2 border-black pb-3'>
						<div>
							<h2 className='text-lg font-black flex items-center gap-2'>
								<span>📡</span> Radar Keterisian Jurnal KBM Hari Ini ({hariIni})
							</h2>
							<p className='text-xs font-bold text-gray-600 mt-0.5'>
								Monitoring real-time guru yang memiliki jadwal hari ini dan status pengisian bukti jurnal mengajar.
							</p>
						</div>
						<span className='px-2.5 py-1 bg-yellow-200 border-2 border-black text-xs font-black rounded-lg shadow-[1px_1px_0px_0px_#0D0D0D]'>
							{jurnalHariIni.length} Terisi Hari Ini
						</span>
					</div>

					{guruJadwalHariIni.length === 0 ? (
						<div className='p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl'>
							<span className='text-3xl block mb-2'>🏖️</span>
							<p className='font-black text-sm text-gray-700'>Tidak Ada Jadwal KBM Hari Ini</p>
							<p className='text-xs text-gray-500 mt-0.5'>Tidak ada guru yang terjadwal mengajar pada hari {hariIni}.</p>
						</div>
					) : (
						<div className='divide-y-2 divide-gray-100 max-h-80 overflow-y-auto pr-1'>
							{guruJadwalHariIni.map((item) => {
								const sudahIsi = guruSudahIsiJurnalIds.has(item.id_user);
								return (
									<div key={item.id_user} className='py-3 flex items-center justify-between gap-3'>
										<div className='flex items-center gap-3'>
											<div className={`w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#0D0D0D] ${sudahIsi ? 'bg-emerald-300 text-black' : 'bg-rose-200 text-black'}`}>
												{sudahIsi ? '✓' : '!'}
											</div>
											<div>
												<p className='font-black text-sm text-black'>{item.nama_guru}</p>
												<p className='text-xs font-bold text-gray-500'>
													{item.sesiList.length} Sesi Terjadwal: {item.sesiList.map((s) => `${s.kelas} (${s.mapel})`).join(', ')}
												</p>
											</div>
										</div>
										<span className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D] uppercase ${sudahIsi ? 'bg-emerald-300 text-black' : 'bg-rose-400 text-white'}`}>
											{sudahIsi ? 'Jurnal Terisi' : 'Belum Isi Jurnal'}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* AKSI CEPAT / MENU KURIKULUM */}
				<div className='bg-[#FEF08A] border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3 flex flex-col justify-between'>
					<div>
						<h2 className='text-lg font-black flex items-center gap-2 mb-1'>
							<span>⚡</span> Aksi Cepat Kurikulum
						</h2>
						<p className='text-xs font-bold text-black/70 mb-4'>
							Pintasan cepat untuk mengelola modul kurikulum utama sekolah.
						</p>

						<div className='space-y-2.5'>
							<Link
								href='/kurikulum/kelas'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>🏫</span> Kelola Rombel Kelas
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/siswa'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>🎓</span> Kelola Data Peserta Didik
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/penugasan'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>📋</span> Atur Penugasan Guru KBM
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/jadwal'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>📅</span> Susun Jadwal Pelajaran
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/mapel'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>📚</span> Kelola Mata Pelajaran
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/jurnal'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>📖</span> Supervisi Jurnal Harian Guru
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>

							<Link
								href='/kurikulum/penilaian'
								className='flex items-center justify-between p-3 bg-white border-2 border-black rounded-xl font-black text-xs hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group'>
								<span className='flex items-center gap-2'>
									<span>📊</span> Audit Capaian & Leger Nilai
								</span>
								<span className='group-hover:translate-x-1 transition-transform'>→</span>
							</Link>
						</div>
					</div>

					<div className='pt-3 border-t-2 border-black/20'>
						<p className='text-[11px] font-bold text-black/70 leading-snug'>
							💡 <strong>Tips:</strong> Data penugasan KBM dan keaktifan jurnal secara otomatis diselaraskan dengan kalkulasi bisaroh oleh Bendahara.
						</p>
					</div>
				</div>
			</div>

			{/* REKAP BEBAN MENGAJAR GURU (DISTRIBUSI KBM) */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<div>
						<h2 className='text-lg font-black flex items-center gap-2'>
							<span>⚖️</span> Distribusi Beban Mengajar Guru (KBM)
						</h2>
						<p className='text-xs font-bold text-gray-600 mt-0.5'>
							Rekapitulasi jumlah rombel kelas dan ragam mata pelajaran yang diampu oleh dewan guru.
						</p>
					</div>
					<Link
						href='/kurikulum/penugasan'
						className='px-3 py-1.5 bg-yellow-300 border-2 border-black text-xs font-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-yellow-400'>
						Kelola Penugasan →
					</Link>
				</div>

				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='border-b-2 border-black bg-yellow-100 text-[11px] font-black uppercase text-black'>
								<th className='py-2.5 px-3'>No</th>
								<th className='py-2.5 px-3'>Nama Guru</th>
								<th className='py-2.5 px-3'>Username</th>
								<th className='py-2.5 px-3'>Jumlah Rombel Diampu</th>
								<th className='py-2.5 px-3'>Jumlah Mapel</th>
								<th className='py-2.5 px-3'>Status Beban</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{bebanGuruSummary.length === 0 ? (
								<tr>
									<td colSpan={6} className='text-center py-6 text-gray-500'>
										Belum ada penugasan KBM yang terdaftar.
									</td>
								</tr>
							) : (
								bebanGuruSummary.map((guru, idx) => (
									<tr key={idx} className='hover:bg-yellow-50/60'>
										<td className='py-2.5 px-3 font-mono font-bold'>{idx + 1}</td>
										<td className='py-2.5 px-3 font-black text-black'>{guru.nama_guru}</td>
										<td className='py-2.5 px-3 font-mono text-gray-600'>{guru.username}</td>
										<td className='py-2.5 px-3'>
											<span className='px-2 py-0.5 bg-sky-100 border border-sky-400 rounded text-sky-950 font-black'>
												{guru.total_rombel} Rombel
											</span>
										</td>
										<td className='py-2.5 px-3'>
											<span className='px-2 py-0.5 bg-amber-100 border border-amber-400 rounded text-amber-950 font-black'>
												{guru.total_mapel} Mapel
											</span>
										</td>
										<td className='py-2.5 px-3'>
											<span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${guru.total_rombel >= 6 ? 'bg-emerald-200 border-emerald-500 text-emerald-950' : guru.total_rombel >= 3 ? 'bg-yellow-200 border-yellow-500 text-yellow-950' : 'bg-rose-200 border-rose-500 text-rose-950'}`}>
												{guru.total_rombel >= 6 ? 'Optimal' : guru.total_rombel >= 3 ? 'Sedang' : 'Ringan'}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
