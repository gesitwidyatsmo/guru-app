/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function LaporanPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState('absensi'); // absensi, nilai, jurnal
	const [loading, setLoading] = useState(false);

	// Filter states
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [bulan, setBulan] = useState(() => {
		const now = new Date();
		return String(now.getMonth() + 1).padStart(2, '0');
	});
	const [tahun, setTahun] = useState(() => new Date().getFullYear());

	// Data states
	const [dataRekap, setDataRekap] = useState(null);
	const [stats, setStats] = useState({});

	// Load initial data
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

				if (dataKelas.length > 0) {
					setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				}
				if (dataMapel.length > 0) {
					setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);
				}
			} catch (err) {
				console.error(err);
			}
		};

		fetchAll();
	}, []);

	// Fetch laporan data
	const fetchLaporan = async () => {
		if (!selectedKelas) return;

		setLoading(true);
		try {
			if (activeTab === 'absensi') {
				// Fetch rekap absensi
				const url = `/api/absensi/rekap?kelas=${encodeURIComponent(selectedKelas)}&bulan=${bulan}&tahun=${tahun}`;
				console.log('Fetching:', url);

				const res = await fetch(url);
				if (res.ok) {
					const data = await res.json();
					console.log('Data received:', data);
					setDataRekap(data);
					calculateAbsensiStats(data);
				} else {
					const error = await res.json();
					console.error('API Error:', error);
					throw new Error(error.error || 'Gagal memuat data');
				}
			} else if (activeTab === 'nilai') {
				// Fetch nilai
				if (!selectedMapel) return;
				const url = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (res.ok) {
					const data = await res.json();

					// Filter by bulan & tahun
					const filtered = data.filter((item) => {
						const itemDate = new Date(item.tanggal);
						return itemDate.getMonth() + 1 === parseInt(bulan) && itemDate.getFullYear() === parseInt(tahun);
					});

					setDataRekap({ data: filtered });
					calculateNilaiStats(filtered);
				}
			} else if (activeTab === 'jurnal') {
				// Fetch jurnal
				if (!selectedMapel) return;
				const url = `/api/jurnal?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (res.ok) {
					const data = await res.json();

					// Filter by bulan & tahun
					const filtered = data.filter((item) => {
						const itemDate = new Date(item.tanggal);
						return itemDate.getMonth() + 1 === parseInt(bulan) && itemDate.getFullYear() === parseInt(tahun);
					});

					setDataRekap({ data: filtered });
					calculateJurnalStats(filtered);
				}
			}
		} catch (err) {
			console.error('Error fetching laporan:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: err.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setLoading(false);
		}
	};

	// Auto fetch saat filter berubah
	useEffect(() => {
		if (selectedKelas) {
			fetchLaporan();
		}
	}, [activeTab, selectedKelas, selectedMapel, bulan, tahun]);

	// Calculate statistics
	const calculateAbsensiStats = (data) => {
		if (!data || !data.siswa) {
			setStats({});
			return;
		}

		let totalHadir = 0;
		let totalSakit = 0;
		let totalIzin = 0;
		let totalAlpha = 0;

		data.siswa.forEach((siswa) => {
			if (siswa.ringkasan) {
				totalHadir += siswa.ringkasan.H || 0;
				totalSakit += siswa.ringkasan.S || 0;
				totalIzin += siswa.ringkasan.I || 0;
				totalAlpha += siswa.ringkasan.A || 0;
			}
		});

		const total = totalHadir + totalSakit + totalIzin + totalAlpha;

		setStats({
			total,
			hadir: totalHadir,
			sakit: totalSakit,
			izin: totalIzin,
			alpha: totalAlpha,
			persentaseHadir: total > 0 ? ((totalHadir / total) * 100).toFixed(1) : 0,
		});
	};

	const calculateNilaiStats = (data) => {
		const total = data.length;
		if (total === 0) {
			setStats({});
			return;
		}

		const nilaiArr = data.map((d) => parseFloat(d.nilai) || 0);
		const rataRata = (nilaiArr.reduce((a, b) => a + b, 0) / total).toFixed(2);
		const tertinggi = Math.max(...nilaiArr);
		const terendah = Math.min(...nilaiArr);
		const lulus = data.filter((d) => parseFloat(d.nilai) >= 70).length;

		setStats({
			total,
			rataRata,
			tertinggi,
			terendah,
			lulus,
			persentaseLulus: ((lulus / total) * 100).toFixed(1),
		});
	};

	const calculateJurnalStats = (data) => {
		const total = data.length;
		const uniqueDates = new Set(data.map((d) => d.tanggal)).size;
		const uniqueMateri = new Set(data.map((d) => d.materi)).size;

		setStats({
			total,
			totalPertemuan: uniqueDates,
			totalMateri: uniqueMateri,
		});
	};

	// Helper functions
	const getSiswaById = (siswaId) => {
		return siswaList.find((s) => s.id === siswaId);
	};

	const getNamaSiswa = (siswaId) => {
		const siswa = getSiswaById(siswaId);
		return siswa?.nama_lengkap || '-';
	};

	const getNisSiswa = (siswaId) => {
		const siswa = getSiswaById(siswaId);
		return siswa?.nis || '-';
	};

	const getStatusBadgeColor = (status) => {
		switch (status) {
			case 'Hadir':
			case 'H':
				return 'bg-green-500 text-white';
			case 'Sakit':
			case 'S':
				return 'bg-yellow-400 text-white';
			case 'Izin':
			case 'I':
				return 'bg-blue-500 text-white';
			case 'Alpha':
			case 'A':
				return 'bg-red-500 text-white';
			default:
				return 'bg-gray-300 text-gray-700';
		}
	};

	const getNilaiBadgeColor = (nilai) => {
		const n = parseFloat(nilai);
		if (n >= 90) return 'bg-gradient-to-br from-green-500 to-green-600 text-white';
		if (n >= 80) return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white';
		if (n >= 70) return 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white';
		if (n >= 60) return 'bg-gradient-to-br from-orange-500 to-orange-600 text-white';
		return 'bg-gradient-to-br from-red-500 to-red-600 text-white';
	};

	const getPredikat = (nilai) => {
		const n = parseFloat(nilai);
		if (n >= 90) return 'A';
		if (n >= 80) return 'B';
		if (n >= 70) return 'C';
		if (n >= 60) return 'D';
		return 'E';
	};

	// Export functions
	const handlePrint = () => {
		window.print();
	};

	const handleExportCSV = () => {
		if (!dataRekap) {
			Swal.fire({
				icon: 'warning',
				title: 'Tidak Ada Data',
				text: 'Tidak ada data untuk diekspor',
				confirmButtonColor: '#4F46E5',
			});
			return;
		}

		let csv = '';
		let filename = '';

		if (activeTab === 'absensi' && dataRekap.siswa) {
			// Header
			csv = 'No,NIS,Nama Siswa';
			dataRekap.tanggalList.forEach((tgl) => {
				csv += `,${tgl}`;
			});
			csv += ',Hadir,Izin,Sakit,Alpha\n';

			// Data
			dataRekap.siswa.forEach((siswa, index) => {
				csv += `${index + 1},"${siswa.nis}","${siswa.nama_lengkap}"`;

				dataRekap.tanggalList.forEach((tgl) => {
					const abs = siswa.absensi[tgl];
					csv += `,"${abs ? abs.status : '-'}"`;
				});

				csv += `,${siswa.ringkasan.H},${siswa.ringkasan.I},${siswa.ringkasan.S},${siswa.ringkasan.A}\n`;
			});

			filename = `Laporan_Absensi_${selectedKelas}_${bulan}_${tahun}.csv`;
		} else if (activeTab === 'nilai' && dataRekap.data) {
			csv = 'No,Tanggal,Kategori,NIS,Nama Siswa,Nilai,Predikat\n';
			dataRekap.data.forEach((item, index) => {
				csv += `${index + 1},"${item.tanggal}","${item.kategori}","${getNisSiswa(item.siswa_id)}","${getNamaSiswa(item.siswa_id)}","${item.nilai}","${getPredikat(item.nilai)}"\n`;
			});
			filename = `Laporan_Nilai_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.csv`;
		} else if (activeTab === 'jurnal' && dataRekap.data) {
			csv = 'No,Tanggal,Jam Ke,Materi,Kegiatan\n';
			dataRekap.data.forEach((item, index) => {
				csv += `${index + 1},"${item.tanggal}","${item.jam_ke}","${item.materi}","${item.kegiatan || ''}"\n`;
			});
			filename = `Laporan_Jurnal_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.csv`;
		}

		// Download CSV
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = filename;
		link.click();
	};

	const tabs = [
		{ id: 'absensi', name: 'Absensi', icon: '📋' },
		{ id: 'nilai', name: 'Nilai', icon: '📝' },
		{ id: 'jurnal', name: 'Jurnal', icon: '📖' },
	];

	const bulanOptions = [
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

	const tahunOptions = [];
	const currentYear = new Date().getFullYear();
	for (let i = currentYear - 2; i <= currentYear + 1; i++) {
		tahunOptions.push(i);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
				{/* Header */}
				<div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 text-white'>
					<div className='flex items-center justify-between mb-6'>
						<button
							onClick={() => router.back()}
							className='bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2 rounded-xl transition-all'>
							<svg
								className='w-6 h-6'
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
						<h1 className='text-2xl sm:text-3xl font-bold'>📊 Laporan</h1>
						<div className='w-10'></div>
					</div>

					{/* Tabs */}
					<div className='flex gap-2 mb-6 overflow-x-auto pb-2'>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
									activeTab === tab.id ? 'bg-white text-purple-600 shadow-lg scale-105' : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
								}`}>
								<span className='text-xl'>{tab.icon}</span>
								<span className='text-sm sm:text-base'>{tab.name}</span>
							</button>
						))}
					</div>

					{/* Filters */}
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
						<div>
							<label className='block text-xs font-medium text-white/90 mb-2'>Kelas</label>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
						</div>

						{(activeTab === 'nilai' || activeTab === 'jurnal') && (
							<div>
								<label className='block text-xs font-medium text-white/90 mb-2'>Mata Pelajaran</label>
								<select
									value={selectedMapel}
									onChange={(e) => setSelectedMapel(e.target.value)}
									className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
									{mapelList.map((m) => (
										<option
											key={m.id}
											value={m.mapel || m.nama_mapel}>
											{m.mapel || m.nama_mapel}
										</option>
									))}
								</select>
							</div>
						)}

						<div>
							<label className='block text-xs font-medium text-white/90 mb-2'>Bulan</label>
							<select
								value={bulan}
								onChange={(e) => setBulan(e.target.value)}
								className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
								{bulanOptions.map((opt) => (
									<option
										key={opt.value}
										value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className='block text-xs font-medium text-white/90 mb-2'>Tahun</label>
							<select
								value={tahun}
								onChange={(e) => setTahun(e.target.value)}
								className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
								{tahunOptions.map((y) => (
									<option
										key={y}
										value={y}>
										{y}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{/* Statistics Cards */}
				{activeTab === 'absensi' && stats.total > 0 && (
					<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6'>
						<div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100'>
							<p className='text-xs text-gray-600 mb-1'>Total</p>
							<p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
						</div>
						<div className='bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Hadir</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.hadir}</p>
						</div>
						<div className='bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Sakit</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.sakit}</p>
						</div>
						<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Izin</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.izin}</p>
						</div>
						<div className='bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Alpha</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.alpha}</p>
						</div>
						<div className='bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>% Hadir</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.persentaseHadir}%</p>
						</div>
					</div>
				)}

				{activeTab === 'nilai' && stats.total > 0 && (
					<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6'>
						<div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100'>
							<p className='text-xs text-gray-600 mb-1'>Total Nilai</p>
							<p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
						</div>
						<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Rata-rata</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.rataRata}</p>
						</div>
						<div className='bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Tertinggi</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.tertinggi}</p>
						</div>
						<div className='bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Terendah</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.terendah}</p>
						</div>
						<div className='bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Lulus (≥70)</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.lulus}</p>
						</div>
						<div className='bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>% Lulus</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.persentaseLulus}%</p>
						</div>
					</div>
				)}

				{activeTab === 'jurnal' && stats.total > 0 && (
					<div className='grid grid-cols-3 gap-3 sm:gap-4 mb-6'>
						<div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100'>
							<p className='text-xs text-gray-600 mb-1'>Total Jurnal</p>
							<p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
						</div>
						<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Pertemuan</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.totalPertemuan}</p>
						</div>
						<div className='bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Materi</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.totalMateri}</p>
						</div>
					</div>
				)}

				{/* Action Buttons */}
				<div className='flex gap-3 mb-6'>
					<button
						onClick={handlePrint}
						disabled={!dataRekap}
						className='flex-1 sm:flex-none px-6 py-3 bg-white border-2 border-indigo-300 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg'>
						🖨️ Cetak
					</button>
					<button
						onClick={handleExportCSV}
						disabled={!dataRekap}
						className='flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg'>
						📥 Export CSV
					</button>
				</div>

				{/* Content */}
				{loading ? (
					<div className='text-center py-12'>
						<div className='animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4'></div>
						<p className='text-gray-600 font-medium'>Memuat data...</p>
					</div>
				) : !dataRekap ||
				  (activeTab === 'absensi' && (!dataRekap.siswa || dataRekap.siswa.length === 0)) ||
				  ((activeTab === 'nilai' || activeTab === 'jurnal') && (!dataRekap.data || dataRekap.data.length === 0)) ? (
					<div className='bg-white rounded-2xl shadow-xl p-12 text-center'>
						<div className='text-gray-300 text-7xl mb-4'>📭</div>
						<h3 className='text-xl font-bold text-gray-800 mb-2'>Tidak Ada Data</h3>
						<p className='text-gray-500'>Tidak ada data {activeTab} untuk periode yang dipilih</p>
					</div>
				) : (
					<div className='bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden'>
						{/* Table Header */}
						<div className='bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4'>
							<h2 className='text-xl font-bold text-white'>
								{activeTab === 'absensi' && dataRekap.periode ? `Rekap Absensi - ${dataRekap.periode}` : `Laporan ${tabs.find((t) => t.id === activeTab)?.name}`}
							</h2>
						</div>

						{/* Table Content */}
						<div className='overflow-x-auto'>
							{activeTab === 'absensi' && dataRekap.siswa && (
								<table className='w-full text-sm'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10'>No</th>
											<th className='px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase sticky left-12 bg-gray-50 z-10'>NIS</th>
											<th className='px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase sticky left-32 bg-gray-50 z-10'>Nama Siswa</th>
											{dataRekap.tanggalList &&
												dataRekap.tanggalList.map((tgl) => (
													<th
														key={tgl}
														className='px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase min-w-[60px]'>
														{new Date(tgl).getDate()}
													</th>
												))}
											<th className='px-3 py-2 text-center text-xs font-bold text-green-700 uppercase bg-green-50'>H</th>
											<th className='px-3 py-2 text-center text-xs font-bold text-blue-700 uppercase bg-blue-50'>I</th>
											<th className='px-3 py-2 text-center text-xs font-bold text-yellow-700 uppercase bg-yellow-50'>S</th>
											<th className='px-3 py-2 text-center text-xs font-bold text-red-700 uppercase bg-red-50'>A</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.siswa.map((siswa, index) => (
											<tr
												key={siswa.id}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-3 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-white'>{index + 1}</td>
												<td className='px-3 py-2 text-sm text-gray-700 sticky left-12 bg-white'>{siswa.nis}</td>
												<td className='px-3 py-2 text-sm font-semibold text-gray-900 sticky left-32 bg-white'>{siswa.nama_lengkap}</td>
												{dataRekap.tanggalList &&
													dataRekap.tanggalList.map((tgl) => {
														const abs = siswa.absensi[tgl];
														return (
															<td
																key={tgl}
																className='px-2 py-2 text-center'>
																{abs ? (
																	<span
																		className={`inline-flex w-8 h-8 rounded-lg items-center justify-center text-xs font-bold ${getStatusBadgeColor(abs.status)}`}
																		title={abs.keterangan || ''}>
																		{abs.status === 'Hadir' ? 'H' : abs.status === 'Izin' ? 'I' : abs.status === 'Sakit' ? 'S' : abs.status === 'Alpha' ? 'A' : '-'}
																	</span>
																) : (
																	<span className='text-gray-300'>-</span>
																)}
															</td>
														);
													})}
												<td className='px-3 py-2 text-center font-bold text-green-700 bg-green-50'>{siswa.ringkasan.H}</td>
												<td className='px-3 py-2 text-center font-bold text-blue-700 bg-blue-50'>{siswa.ringkasan.I}</td>
												<td className='px-3 py-2 text-center font-bold text-yellow-700 bg-yellow-50'>{siswa.ringkasan.S}</td>
												<td className='px-3 py-2 text-center font-bold text-red-700 bg-red-50'>{siswa.ringkasan.A}</td>
											</tr>
										))}
									</tbody>
								</table>
							)}

							{activeTab === 'nilai' && dataRekap.data && (
								<table className='w-full'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>No</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Tanggal</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Kategori</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>NIS</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Nama Siswa</th>
											<th className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase'>Nilai</th>
											<th className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase'>Predikat</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.data.map((item, index) => (
											<tr
												key={item.id}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-4 py-3 text-sm font-medium text-gray-900'>{index + 1}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>
													{new Date(item.tanggal).toLocaleDateString('id-ID', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
													})}
												</td>
												<td className='px-4 py-3 text-sm font-semibold text-gray-700'>{item.kategori}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>{getNisSiswa(item.siswa_id)}</td>
												<td className='px-4 py-3 text-sm font-semibold text-gray-900'>{getNamaSiswa(item.siswa_id)}</td>
												<td className='px-4 py-3 text-center'>
													<span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getNilaiBadgeColor(item.nilai)}`}>{item.nilai}</span>
												</td>
												<td className='px-4 py-3 text-center'>
													<span className='inline-block px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-sm font-bold'>{getPredikat(item.nilai)}</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}

							{activeTab === 'jurnal' && dataRekap.data && (
								<table className='w-full'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>No</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Tanggal</th>
											<th className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase'>Jam Ke</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Materi</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Kegiatan</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.data.map((item, index) => (
											<tr
												key={item.id}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-4 py-3 text-sm font-medium text-gray-900'>{index + 1}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>
													{new Date(item.tanggal).toLocaleDateString('id-ID', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
													})}
												</td>
												<td className='px-4 py-3 text-center'>
													<span className='inline-block px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold'>{item.jam_ke}</span>
												</td>
												<td className='px-4 py-3 text-sm font-semibold text-gray-900'>{item.materi}</td>
												<td className='px-4 py-3 text-sm text-gray-600'>{item.kegiatan || '-'}</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Print Styles */}
			<style
				jsx
				global>{`
				@media print {
					body * {
						visibility: hidden;
					}
					.print-area,
					.print-area * {
						visibility: visible;
					}
					.print-area {
						position: absolute;
						left: 0;
						top: 0;
						width: 100%;
					}
					button {
						display: none !important;
					}
				}
			`}</style>
		</div>
	);
}
