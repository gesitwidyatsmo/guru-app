/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import Loader from '../components/loading';

export default function LaporanPage() {
	const router = useRouter();

	const [activeTab, setActiveTab] = useState('absensi'); // absensi, nilai, jurnal
	const [loading, setLoading] = useState(true);
	const [loadingRekap, setLoadingRekap] = useState(false);

	// Filter states
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [bulan, setBulan] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
	const [tahun, setTahun] = useState(() => new Date().getFullYear());

	// Data
	const [dataRekap, setDataRekap] = useState(null);
	const [stats, setStats] = useState({});

	// Load initial master data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resMapel, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/mapel'), fetch('/api/siswa')]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				setKelasList(dataKelas);
				setMapelList(dataMapel);
				setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

				if (dataKelas.length > 0) setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				if (dataMapel.length > 0) setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);
			} catch (err) {
				console.error(err);
				Swal.fire({
					icon: 'error',
					title: 'Gagal memuat data awal',
					text: err.message,
					confirmButtonColor: '#4F46E5',
				});
			} finally {
				setLoading(false);
			}
		};

		fetchAll();
	}, []);

	// Helper functions
	const getSiswaById = (siswaId) => siswaList.find((s) => String(s.id) === String(siswaId));
	const getNamaSiswa = (siswaId) => getSiswaById(siswaId)?.nama_lengkap || '-';
	const getNisSiswa = (siswaId) => getSiswaById(siswaId)?.nis || '-';

	// --- LOGIC BARU: Pivot Absensi Mapel (JSON) ---
	const processAbsensiMapel = (rawData) => {
		if (!rawData || rawData.length === 0) return { kolomTanggal: [], barisSiswa: [] };

		// 1. Ambil List Tanggal/Pertemuan Unik
		const pertemuanList = rawData
			.map((item) => {
				let parsedAbsenArray = [];
				let parsedAbsenObject = {}; // Kita butuh ini untuk lookup cepat

				try {
					// Parse JSON string -> Array
					parsedAbsenArray = typeof item.data_absensi === 'string' ? JSON.parse(item.data_absensi) : item.data_absensi;

					// Pastikan hasilnya array
					if (!Array.isArray(parsedAbsenArray)) parsedAbsenArray = [];

					// CONVERT ARRAY KE OBJECT:
					// Input: [{siswa_id: "s1", status: "Hadir"}, ...]
					// Output: { "s1": "Hadir", ... }
					parsedAbsenArray.forEach((record) => {
						if (record && record.siswa_id) {
							parsedAbsenObject[record.siswa_id] = record.status;
						}
					});
				} catch (e) {
					console.error('Error parse JSON absensi', e);
				}

				return {
					id: item.id,
					tanggal: item.tanggal,
					jam_ke: item.jam_ke,
					fullDate: new Date(item.tanggal),
					label: `${new Date(item.tanggal).getDate()}/${new Date(item.tanggal).getMonth() + 1}`,
					absensiData: parsedAbsenObject, // <--- SEKARANG SUDAH JADI OBJECT
				};
			})
			.sort((a, b) => a.fullDate - b.fullDate);

		// 2. Siapkan Baris Siswa
		const siswaKelasIni = siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim());

		const barisSiswa = siswaKelasIni.map((siswa) => {
			const row = {
				id: siswa.id,
				nis: siswa.nis,
				nama: siswa.nama_lengkap,
				kehadiran: {},
				stats: { H: 0, S: 0, I: 0, A: 0 },
			};

			pertemuanList.forEach((p) => {
				// Sekarang p.absensiData adalah Object, jadi bisa dipanggil by key
				const statusRaw = p.absensiData[siswa.id] || '-';

				let kode = '-';
				// Sesuaikan string ini dengan apa yang disimpan di DB (Hadir/Sakit/dst)
				if (statusRaw === 'Hadir') kode = 'H';
				else if (statusRaw === 'Sakit') kode = 'S';
				else if (statusRaw === 'Izin') kode = 'I';
				else if (statusRaw === 'Alpha') kode = 'A';

				row.kehadiran[p.id] = kode;

				// Hitung Stats
				if (kode !== '-') row.stats[kode] = (row.stats[kode] || 0) + 1;
			});

			const totalPertemuan = pertemuanList.length;
			row.persentase = totalPertemuan > 0 ? Math.round((row.stats.H / totalPertemuan) * 100) : 0;

			return row;
		});

		barisSiswa.sort((a, b) => a.nama.localeCompare(b.nama));

		return { kolomTanggal: pertemuanList, barisSiswa };
	};

	// Memoize Data Absensi agar tidak render ulang terus
	const pivotedAbsensi = useMemo(() => {
		if (activeTab !== 'absensi') return null;
		// Asumsi dataRekap.data berisi array raw absensi mapel
		return processAbsensiMapel(dataRekap?.data || []);
	}, [activeTab, dataRekap, siswaList, selectedKelas]);

	// --- Logic Baru: Pivot Nilai (Rata-rata memperhitungkan nilai 0) ---
	const pivotNilai = (dataRaw) => {
		if (!Array.isArray(dataRaw) || dataRaw.length === 0) return { kolomTugas: [], barisSiswa: [] };

		// 1. Identifikasi Semua Kolom Tugas Unik
		const tugasMap = new Map();
		for (const item of dataRaw) {
			const key = item.tugas_id ? String(item.tugas_id) : `${item.kategori}::${String(item.tanggal).slice(0, 10)}`;
			if (!tugasMap.has(key)) {
				tugasMap.set(key, {
					key,
					judul: item.kategori || '-',
					tanggal: String(item.tanggal || '').slice(0, 10),
				});
			}
		}
		// Sort tugas berdasarkan tanggal
		const kolomTugas = Array.from(tugasMap.values()).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		// 2. Siapkan Baris Siswa
		const siswaKelasIni = siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim());
		const barisMap = new Map();

		// Init baris untuk setiap siswa
		siswaKelasIni.forEach((s) => {
			barisMap.set(String(s.id), {
				siswa_id: String(s.id),
				nis: s.nis || '-',
				nama_lengkap: s.nama_lengkap || '-',
				nilaiByTugas: {},
				rataRata: 0, // Default 0
			});
		});

		// 3. Isi Nilai ke Baris Siswa
		for (const item of dataRaw) {
			const sid = String(item.siswa_id);
			if (!barisMap.has(sid)) continue; // Skip siswa yang tidak ada di master kelas ini

			const tugasKey = item.tugas_id ? String(item.tugas_id) : `${item.kategori}::${String(item.tanggal).slice(0, 10)}`;
			barisMap.get(sid).nilaiByTugas[tugasKey] = item.nilai;
		}

		// 4. Hitung Rata-rata (Total Nilai / Jumlah Kolom Tugas)
		const barisSiswa = Array.from(barisMap.values()).map((row) => {
			let sum = 0;

			// Loop ke semua kolom tugas yang ada
			kolomTugas.forEach((t) => {
				const v = row.nilaiByTugas[t.key];

				// Cek apakah ada nilai valid
				if (v !== undefined && v !== null && String(v).trim() !== '') {
					const num = Number(v);
					if (!Number.isNaN(num)) {
						sum += num;
					}
				} else {
					// Jika tidak ada nilai, anggap 0 (dan tampilan di tabel nanti bisa diatur tetap '-' atau '0')
					// sum += 0; // Tidak perlu ditulis, tapi logikanya nilai 0
				}
			});

			// PEMBAGI adalah Total Tugas (kolomTugas.length), bukan tugas yang dikerjakan saja
			const pembagi = kolomTugas.length;
			const avg = pembagi > 0 ? Math.round(sum / pembagi) : 0;

			return { ...row, rataRata: avg };
		});

		// Sort nama siswa
		barisSiswa.sort((a, b) => String(a.nama_lengkap).localeCompare(String(b.nama_lengkap), 'id'));

		return { kolomTugas, barisSiswa };
	};

	// --- FETCHING DATA ---
	const fetchLaporan = async () => {
		if (!selectedKelas) return;
		setLoadingRekap(true);
		try {
			if (activeTab === 'absensi') {
				if (!selectedMapel) return;
				const url = `/api/absensi-mapel?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (!res.ok) throw new Error('Gagal memuat data absensi mapel');

				const data = await res.json();
				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					return d.getMonth() + 1 === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
				});

				setDataRekap({ data: filtered });

				// Calc Stats
				const { barisSiswa } = processAbsensiMapel(filtered);
				if (barisSiswa.length > 0) {
					const totalHadir = barisSiswa.reduce((acc, curr) => acc + curr.stats.H, 0);
					const totalPertemuan = filtered.length;
					const totalMaxHadir = barisSiswa.length * totalPertemuan;
					setStats({
						totalSiswa: barisSiswa.length,
						totalPertemuan,
						persentaseHadir: totalMaxHadir > 0 ? Math.round((totalHadir / totalMaxHadir) * 100) : 0,
					});
				} else {
					setStats({});
				}
			}

			if (activeTab === 'nilai') {
				if (!selectedMapel) return;
				const url = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (!res.ok) throw new Error('Gagal memuat data nilai');
				const data = await res.json();
				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					return d.getMonth() + 1 === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
				});
				setDataRekap({ data: filtered });

				// Stats Nilai Simple
				const vals = filtered.map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
				setStats({
					totalNilai: vals.length,
					rataRata: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
				});
			}

			if (activeTab === 'jurnal') {
				if (!selectedMapel) return;
				const url = `/api/jurnal?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (!res.ok) throw new Error('Gagal memuat data jurnal');
				const data = await res.json();
				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					return d.getMonth() + 1 === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
				});
				setDataRekap({ data: filtered });
				setStats({ totalJurnal: filtered.length });
			}
		} catch (err) {
			console.error(err);
			Swal.fire({ icon: 'error', title: 'Gagal Memuat Data', text: err.message, confirmButtonColor: '#4F46E5' });
			setDataRekap(null);
			setStats({});
		} finally {
			setLoadingRekap(false);
		}
	};

	useEffect(() => {
		if (loading) return;
		fetchLaporan();
	}, [loading, activeTab, selectedKelas, selectedMapel, bulan, tahun]);

	// --- EXPORT EXCEL ---
	const handleExportExcel = () => {
		if (!dataRekap) {
			Swal.fire('Warning', 'Tidak ada data', 'warning');
			return;
		}
		let aoa = [];
		let sheetName = activeTab;

		if (activeTab === 'absensi') {
			// Export Absensi Mapel Pivot
			const { kolomTanggal, barisSiswa } = pivotedAbsensi;
			// Header 1: Judul Pertemuan
			const header1 = ['No', 'NIS', 'Nama Siswa', ...kolomTanggal.map((p) => `${p.label} (${p.jam_ke})`), 'H', 'I', 'S', 'A', '%'];
			aoa.push(header1);
			// Data Rows
			barisSiswa.forEach((row, idx) => {
				const rowData = [idx + 1, row.nis, row.nama];
				kolomTanggal.forEach((p) => {
					rowData.push(row.kehadiran[p.id] || '-');
				});
				rowData.push(row.stats.H, row.stats.I, row.stats.S, row.stats.A, `${row.persentase}%`);
				aoa.push(rowData);
			});
		} else if (activeTab === 'nilai' && dataRekap.data) {
			const { kolomTugas, barisSiswa } = pivotNilai(dataRekap.data);
			const headerTugas = kolomTugas.map((t) => `${t.judul} (${new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`);
			aoa.push(['No', 'NIS', 'Nama Siswa', ...headerTugas, 'Rata-rata']);
			barisSiswa.forEach((row, idx) => {
				const rowData = [idx + 1, row.nis, row.nama_lengkap];
				kolomTugas.forEach((t) => {
					const val = row.nilaiByTugas[t.key];
					rowData.push(val !== undefined ? Number(val) : '-');
				});
				rowData.push(row.rataRata ?? '-');
				aoa.push(rowData);
			});
		} else if (activeTab === 'jurnal' && dataRekap.data) {
			aoa.push(['No', 'Tanggal', 'Jam', 'Pert.', 'Mapel', 'Materi', 'Kegiatan', 'Hambatan', 'Solusi', 'Tuntas']);
			dataRekap.data.forEach((item, index) => {
				aoa.push([
					index + 1,
					new Date(item.tanggal).toLocaleDateString('id-ID'),
					item.jam_ke || '',
					item.pertemuan_ke || '',
					item.mapel || '',
					item.materi || '',
					item.kegiatan || '',
					item.hambatan || '',
					item.solusi || '',
					item.tuntas ? 'Ya' : 'Tidak',
				]);
			});
		}

		const worksheet = XLSX.utils.aoa_to_sheet(aoa);
		// Auto width basic
		const wscols = [{ wch: 5 }, { wch: 15 }, { wch: 30 }];
		worksheet['!cols'] = wscols;

		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, activeTab);
		XLSX.writeFile(workbook, `Laporan_${activeTab}_${selectedKelas}_${selectedMapel}_${bulan}.xlsx`);
	};

	const tabs = [
		{ id: 'absensi', name: 'Absensi', icon: '📋' },
		{ id: 'nilai', name: 'Nilai', icon: '📝' },
		{ id: 'jurnal', name: 'Jurnal', icon: '📖' },
	];

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-gray-50 pb-16 font-sans'>
			{/* Header Gradient */}
			<div className='bg-gradient-to-r from-indigo-600 to-purple-700 py-8 px-4 sm:px-8 rounded-b-[2.5rem] shadow-2xl'>
				<div className='max-w-7xl mx-auto'>
					<div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
						<div className='flex items-center gap-3'>
							<button
								onClick={() => router.back()}
								className='p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors'>
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
							</button>
							<div>
								<h1 className='text-2xl sm:text-3xl font-bold text-white'>Laporan</h1>
								<p className='text-indigo-100 text-sm'>Rekapitulasi {tabs.find((t) => t.id === activeTab)?.name} Bulanan</p>
							</div>
						</div>
						<div className='flex gap-2'>
							<button
								onClick={() => window.print()}
								className='bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl font-semibold transition-colors'>
								Print
							</button>
							<button
								onClick={handleExportExcel}
								className='bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl font-bold transition-colors shadow-lg'>
								Export Excel
							</button>
						</div>
					</div>

					{/* Tabs */}
					<div className='mt-8 flex gap-2 flex-wrap'>
						{tabs.map((t) => (
							<button
								key={t.id}
								onClick={() => setActiveTab(t.id)}
								className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
									activeTab === t.id ? 'bg-white text-indigo-700 shadow-xl scale-105' : 'bg-white/10 text-white hover:bg-white/20'
								}`}>
								<span>{t.icon}</span>
								{t.name}
							</button>
						))}
					</div>

					{/* Filters */}
					<div className='mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
						{/* Filter Kelas */}
						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1 font-medium'>Kelas</p>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-bold text-gray-800 bg-white/90 outline-none cursor-pointer hover:bg-white'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
						</div>
						{/* Filter Mapel */}
						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1 font-medium'>Mapel</p>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-bold text-gray-800 bg-white/90 outline-none cursor-pointer hover:bg-white'>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
						</div>
						{/* Filter Bulan */}
						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1 font-medium'>Bulan</p>
							<select
								value={bulan}
								onChange={(e) => setBulan(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-bold text-gray-800 bg-white/90 outline-none cursor-pointer hover:bg-white'>
								<option value='01'>Januari</option>
								<option value='02'>Februari</option>
								<option value='03'>Maret</option>
								<option value='04'>April</option>
								<option value='05'>Mei</option>
								<option value='06'>Juni</option>
								<option value='07'>Juli</option>
								<option value='08'>Agustus</option>
								<option value='09'>September</option>
								<option value='10'>Oktober</option>
								<option value='11'>November</option>
								<option value='12'>Desember</option>
							</select>
						</div>
						{/* Filter Tahun */}
						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1 font-medium'>Tahun</p>
							<select
								value={tahun}
								onChange={(e) => setTahun(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-bold text-gray-800 bg-white/90 outline-none cursor-pointer hover:bg-white'>
								{[2024, 2025, 2026].map((t) => (
									<option
										key={t}
										value={t}>
										{t}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>
			</div>

			{/* CONTENT */}
			<div className='max-w-7xl mx-auto px-4 sm:px-8 mt-8'>
				{/* STATS CARD ABSENSI */}
				{activeTab === 'absensi' && stats.totalSiswa && (
					<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
						<div className='bg-white p-4 rounded-2xl shadow-sm border border-gray-100'>
							<p className='text-xs text-gray-500 font-bold uppercase'>Total Pertemuan</p>
							<p className='text-2xl font-bold text-indigo-600'>
								{stats.totalPertemuan} <span className='text-sm text-gray-400'>Jam</span>
							</p>
						</div>
						<div className='bg-white p-4 rounded-2xl shadow-sm border border-gray-100'>
							<p className='text-xs text-gray-500 font-bold uppercase'>Kehadiran Kelas</p>
							<p className='text-2xl font-bold text-emerald-500'>{stats.persentaseHadir}%</p>
						</div>
					</div>
				)}

				{loadingRekap ? (
					<div className='bg-white rounded-3xl shadow-xl p-12 text-center'>
						<div className='animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4'></div>
						<p className='text-gray-500 font-medium'>Sedang merekap data...</p>
					</div>
				) : (
					<div className='bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden'>
						{/* --- TABEL ABSENSI MAPEL --- */}
						{activeTab === 'absensi' && pivotedAbsensi && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[1000px]'>
									<thead className='bg-gray-50 border-b border-gray-200'>
										<tr>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10'>No</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase lg:sticky left-12 bg-gray-50 z-10 w-64'>Nama Siswa</th>
											{/* Header Pertemuan */}
											{pivotedAbsensi.kolomTanggal.map((p) => (
												<th
													key={p.id}
													className='px-2 py-3 text-center text-xs font-bold text-gray-500 border-l border-gray-100 min-w-[60px]'>
													<div className='text-indigo-600'>{p.label}</div>
													<div className='text-[10px] text-gray-400'>{p.jam_ke}</div>
												</th>
											))}
											<th className='px-2 py-3 text-center text-xs font-bold text-gray-500 bg-gray-100 border-l'>H</th>
											<th className='px-2 py-3 text-center text-xs font-bold text-gray-500 bg-gray-100'>I</th>
											<th className='px-2 py-3 text-center text-xs font-bold text-gray-500 bg-gray-100'>S</th>
											<th className='px-2 py-3 text-center text-xs font-bold text-gray-500 bg-gray-100'>A</th>
											<th className='px-2 py-3 text-center text-xs font-bold text-gray-500 bg-gray-100'>%</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{pivotedAbsensi.barisSiswa.length === 0 ? (
											<tr>
												<td
													colSpan='100'
													className='p-8 text-center text-gray-400'>
													Belum ada data absensi bulan ini
												</td>
											</tr>
										) : (
											pivotedAbsensi.barisSiswa.map((row, idx) => (
												<tr
													key={row.id}
													className='hover:bg-gray-50/50 transition-colors'>
													<td className='px-4 py-3 text-sm text-gray-400 sticky left-0 bg-white'>{idx + 1}</td>
													<td className='px-4 py-3 lg:sticky left-12 bg-white border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]'>
														<p className='text-sm font-bold text-gray-700 truncate w-60'>{row.nama}</p>
														<p className='text-[10px] text-gray-400 font-mono'>{row.nis}</p>
													</td>
													{/* Status per pertemuan */}
													{pivotedAbsensi.kolomTanggal.map((p) => {
														const kode = row.kehadiran[p.id];
														let colorClass = 'text-gray-300';
														if (kode === 'H') colorClass = 'text-emerald-500 font-bold';
														if (kode === 'S') colorClass = 'text-amber-500 font-bold';
														if (kode === 'I') colorClass = 'text-blue-500 font-bold';
														if (kode === 'A') colorClass = 'text-rose-500 font-bold';

														return (
															<td
																key={p.id}
																className='px-2 py-3 text-center border-l border-gray-50'>
																<span className={`text-sm ${colorClass}`}>{kode}</span>
															</td>
														);
													})}
													{/* Ringkasan */}
													<td className='px-2 py-3 text-center font-bold text-emerald-600 bg-gray-50/50 border-l'>{row.stats.H}</td>
													<td className='px-2 py-3 text-center font-bold text-blue-600 bg-gray-50/50'>{row.stats.I}</td>
													<td className='px-2 py-3 text-center font-bold text-amber-600 bg-gray-50/50'>{row.stats.S}</td>
													<td className='px-2 py-3 text-center font-bold text-rose-600 bg-gray-50/50'>{row.stats.A}</td>
													<td className='px-2 py-3 text-center font-black text-gray-700 bg-gray-100 border-l'>{row.persentase}%</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						)}

						{/* --- TABEL NILAI (Logic Lama) --- */}
						{activeTab === 'nilai' && dataRekap?.data && (
							<div className='overflow-x-auto'>
								{/* Render Tabel Nilai di sini (sama seperti kode Anda sebelumnya) */}
								{/* Saya singkat agar muat, silakan copy paste bagian table nilai dari kode lama jika perlu, atau gunakan logic pivotNilai di atas */}
								<table className='w-full'>
									<thead className='bg-gray-50 border-b border-gray-200'>
										<tr>
											<th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase'>Nama Siswa</th>
											{pivotNilai(dataRekap.data).kolomTugas.map((t) => (
												<th
													key={t.key}
													className='px-4 py-3 text-center text-xs font-bold text-gray-500'>
													{t.judul}
												</th>
											))}
											<th className='px-4 py-3 text-center text-xs font-bold text-gray-500'>Rata2</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{pivotNilai(dataRekap.data).barisSiswa.map((row) => (
											<tr key={row.siswa_id}>
												<td className='px-6 py-3 font-bold text-gray-700'>{row.nama_lengkap}</td>
												{pivotNilai(dataRekap.data).kolomTugas.map((t) => (
													<td
														key={t.key}
														className='px-4 py-3 text-center text-gray-600'>
														{row.nilaiByTugas[t.key] || '-'}
													</td>
												))}
												<td className='px-4 py-3 text-center font-bold text-indigo-600'>{row.rataRata}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{/* --- TABEL JURNAL (Logic Lama) --- */}
						{activeTab === 'jurnal' && dataRekap?.data && (
							<div className='overflow-x-auto'>
								<table className='w-full'>
									<thead className='bg-gray-50 border-b border-gray-200'>
										<tr>
											<th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase'>Tanggal</th>
											<th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase'>Materi</th>
											<th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase'>Kegiatan</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.data.map((row, i) => (
											<tr key={i}>
												<td className='px-6 py-3 text-sm text-gray-600'>{new Date(row.tanggal).toLocaleDateString('id-ID')}</td>
												<td className='px-6 py-3 text-sm text-gray-800 font-medium'>{row.materi}</td>
												<td className='px-6 py-3 text-sm text-gray-600'>{row.kegiatan}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
