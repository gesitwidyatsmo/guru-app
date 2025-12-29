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
		const n = Number(nilai);
		if (Number.isNaN(n)) return 'bg-gray-200 text-gray-700';
		if (n >= 90) return 'bg-gradient-to-br from-green-500 to-green-600 text-white';
		if (n >= 80) return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white';
		if (n >= 70) return 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white';
		if (n >= 60) return 'bg-gradient-to-br from-orange-500 to-orange-600 text-white';
		return 'bg-gradient-to-br from-red-500 to-red-600 text-white';
	};

	const getPredikat = (nilai) => {
		const n = Number(nilai);
		if (Number.isNaN(n)) return '-';
		if (n >= 90) return 'A';
		if (n >= 80) return 'B';
		if (n >= 70) return 'C';
		if (n >= 60) return 'D';
		return 'E';
	};

	// Statistik Absensi (rekap API)
	const calculateAbsensiStats = (data) => {
		if (!data?.siswa) return;

		const total = data.siswa.length;
		let hadir = 0;
		let sakit = 0;
		let izin = 0;
		let alpha = 0;

		data.siswa.forEach((s) => {
			hadir += Number(s.ringkasan?.H || 0);
			sakit += Number(s.ringkasan?.S || 0);
			izin += Number(s.ringkasan?.I || 0);
			alpha += Number(s.ringkasan?.A || 0);
		});

		const totalHari = data.tanggalList?.length || 0;
		const maxHadir = total * totalHari;
		const persentaseHadir = maxHadir > 0 ? Math.round((hadir / maxHadir) * 100) : 0;

		setStats({
			total,
			hadir,
			sakit,
			izin,
			alpha,
			persentaseHadir,
		});
	};

	// Statistik Nilai (list nilai mentah)
	const calculateNilaiStats = (rows) => {
		if (!Array.isArray(rows) || rows.length === 0) {
			setStats({});
			return;
		}

		const nilaiNums = rows.map((r) => Number(r.nilai)).filter((n) => !Number.isNaN(n));

		const total = nilaiNums.length;
		const rataRata = total > 0 ? Math.round(nilaiNums.reduce((a, b) => a + b, 0) / total) : 0;
		const tertinggi = total > 0 ? Math.max(...nilaiNums) : 0;
		const terendah = total > 0 ? Math.min(...nilaiNums) : 0;

		const lulus = nilaiNums.filter((n) => n >= 70).length;
		const persentaseLulus = total > 0 ? Math.round((lulus / total) * 100) : 0;

		setStats({
			total,
			rataRata,
			tertinggi,
			terendah,
			lulus,
			persentaseLulus,
		});
	};

	// Statistik Jurnal
	const calculateJurnalStats = (rows) => {
		if (!Array.isArray(rows) || rows.length === 0) {
			setStats({});
			return;
		}

		const total = rows.length;
		const totalPertemuan = rows.filter((r) => r.pertemuan_ke !== undefined && String(r.pertemuan_ke).trim() !== '').length;
		const totalMateri = rows.filter((r) => r.materi && String(r.materi).trim() !== '').length;

		setStats({
			total,
			totalPertemuan,
			totalMateri,
		});
	};

	// Pivot nilai: baris = siswa, kolom = tugas
	const pivotNilai = (dataRaw) => {
		if (!Array.isArray(dataRaw) || dataRaw.length === 0) return { kolomTugas: [], barisSiswa: [] };

		// kolom tugas unik
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
		const kolomTugas = Array.from(tugasMap.values()).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		// baris siswa (master)
		const siswaKelasIni = siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim());

		const barisMap = new Map();
		siswaKelasIni.forEach((s) => {
			barisMap.set(String(s.id), {
				siswa_id: String(s.id),
				nis: s.nis || '-',
				nama_lengkap: s.nama_lengkap || '-',
				nilaiByTugas: {},
				rataRata: null,
			});
		});

		// isi nilai
		for (const item of dataRaw) {
			const sid = String(item.siswa_id);
			if (!barisMap.has(sid)) {
				barisMap.set(sid, {
					siswa_id: sid,
					nis: getNisSiswa(item.siswa_id),
					nama_lengkap: getNamaSiswa(item.siswa_id),
					nilaiByTugas: {},
					rataRata: null,
				});
			}
			const tugasKey = item.tugas_id ? String(item.tugas_id) : `${item.kategori}::${String(item.tanggal).slice(0, 10)}`;
			barisMap.get(sid).nilaiByTugas[tugasKey] = item.nilai;
		}

		// hitung rata-rata per siswa
		const barisSiswa = Array.from(barisMap.values()).map((row) => {
			let sum = 0;
			let cnt = 0;

			kolomTugas.forEach((t) => {
				const v = row.nilaiByTugas[t.key];
				if (v !== undefined && v !== null && String(v).trim() !== '') {
					const num = Number(v);
					if (!Number.isNaN(num)) {
						sum += num;
						cnt += 1;
					}
				}
			});

			return {
				...row,
				rataRata: cnt > 0 ? Math.round(sum / cnt) : null,
			};
		});

		// sort nama
		barisSiswa.sort((a, b) => String(a.nama_lengkap).localeCompare(String(b.nama_lengkap), 'id'));

		return { kolomTugas, barisSiswa };
	};

	const pivotedNilai = useMemo(() => {
		if (activeTab !== 'nilai') return { kolomTugas: [], barisSiswa: [] };
		return pivotNilai(dataRekap?.data || []);
	}, [activeTab, dataRekap, selectedKelas, siswaList]);

	// Fetch laporan based on tab/filter
	const fetchLaporan = async () => {
		if (!selectedKelas) return;

		setLoadingRekap(true);
		try {
			if (activeTab === 'absensi') {
				const url = `/api/absensi/rekap?kelas=${encodeURIComponent(selectedKelas)}&bulan=${bulan}&tahun=${tahun}`;
				const res = await fetch(url);
				if (!res.ok) {
					const error = await res.json();
					throw new Error(error.error || 'Gagal memuat data absensi');
				}
				const data = await res.json();
				setDataRekap(data);
				calculateAbsensiStats(data);
			}

			if (activeTab === 'nilai') {
				if (!selectedMapel) return;

				const url = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (!res.ok) {
					const error = await res.json();
					throw new Error(error.error || 'Gagal memuat data nilai');
				}

				const data = await res.json();
				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					return d.getMonth() + 1 === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
				});

				setDataRekap({ data: filtered });
				calculateNilaiStats(filtered);
			}

			if (activeTab === 'jurnal') {
				if (!selectedMapel) return;

				const url = `/api/jurnal?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);
				if (!res.ok) {
					const error = await res.json();
					throw new Error(error.error || 'Gagal memuat data jurnal');
				}

				const data = await res.json();
				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					return d.getMonth() + 1 === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
				});

				setDataRekap({ data: filtered });
				calculateJurnalStats(filtered);
			}
		} catch (err) {
			console.error(err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: err.message,
				confirmButtonColor: '#4F46E5',
			});
			setDataRekap(null);
			setStats({});
		} finally {
			setLoadingRekap(false);
		}
	};

	// Auto fetch saat filter/tab berubah
	useEffect(() => {
		if (loading) return;
		fetchLaporan();
	}, [loading, activeTab, selectedKelas, selectedMapel, bulan, tahun]);

	// Export & Print
	const handlePrint = () => window.print();

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
			csv = 'No,NIS,Nama Siswa';
			dataRekap.tanggalList.forEach((tgl) => {
				csv += `,${tgl}`;
			});
			csv += ',Hadir,Izin,Sakit,Alpha\n';

			dataRekap.siswa.forEach((siswa, index) => {
				csv += `${index + 1},"${siswa.nis}","${siswa.nama_lengkap}"`;
				dataRekap.tanggalList.forEach((tgl) => {
					const abs = siswa.absensi[tgl];
					csv += `,"${abs ? abs.status : '-'}"`;
				});
				csv += `,${siswa.ringkasan.H},${siswa.ringkasan.I},${siswa.ringkasan.S},${siswa.ringkasan.A}\n`;
			});

			filename = `Laporan_Absensi_${selectedKelas}_${bulan}_${tahun}.csv`;
		}

		if (activeTab === 'nilai' && dataRekap.data) {
			const { kolomTugas, barisSiswa } = pivotNilai(dataRekap.data);

			csv = 'No,NIS,Nama Siswa';
			kolomTugas.forEach((t) => {
				const tglLabel = t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '';
				csv += `,"${t.judul}${tglLabel ? ' (' + tglLabel + ')' : ''}"`;
			});
			csv += ',Rata-rata\n';

			barisSiswa.forEach((row, idx) => {
				csv += `${idx + 1},"${row.nis}","${row.nama_lengkap}"`;
				kolomTugas.forEach((t) => {
					const v = row.nilaiByTugas[t.key];
					csv += `,"${v !== undefined && v !== null && String(v).trim() !== '' ? v : '-'}"`;
				});
				csv += `,"${row.rataRata ?? '-'}"\n`;
			});

			filename = `Laporan_Nilai_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.csv`;
		}

		if (activeTab === 'jurnal' && dataRekap.data) {
			csv = 'No,Tanggal,Jam Ke,Pertemuan,Mapel,Materi,Kegiatan,Hambatan,Solusi,Tuntas\n';
			dataRekap.data.forEach((item, index) => {
				csv += `${index + 1},"${String(item.tanggal).slice(0, 10)}","${item.jam_ke || ''}","${item.pertemuan_ke || ''}","${item.mapel || ''}","${(item.materi || '').replaceAll('"', '""')}","${(
					item.kegiatan || ''
				).replaceAll('"', '""')}","${(item.hambatan || '').replaceAll('"', '""')}","${(item.solusi || '').replaceAll('"', '""')}","${item.tuntas ? 'TRUE' : 'FALSE'}"\n`;
			});
			filename = `Laporan_Jurnal_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.csv`;
		}

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = filename || `Laporan_${activeTab}.csv`;
		link.click();
	};

	const handleExportExcel = () => {
		if (!dataRekap) {
			Swal.fire('Warning', 'Tidak ada data untuk diekspor', 'warning');
			return;
		}

		let dataExport = [];
		let header = [];
		// Gunakan Array of Arrays (AoA) agar lebih mudah mengatur layout custom
		let aoa = [];

		if (activeTab === 'absensi' && dataRekap.siswa) {
			// 1. Header Baris 1
			header = ['No', 'NIS', 'Nama Siswa', ...dataRekap.tanggalList.map((t) => new Date(t).getDate()), 'H', 'I', 'S', 'A'];
			aoa.push(header);

			// 2. Data Baris
			dataRekap.siswa.forEach((siswa, index) => {
				const row = [index + 1, siswa.nis, siswa.nama_lengkap];
				// Isi status per tanggal
				dataRekap.tanggalList.forEach((tgl) => {
					const abs = siswa.absensi[tgl];
					row.push(abs ? abs.status.substring(0, 1) : '-'); // Ambil huruf depan saja (H, I, S, A)
				});
				// Isi Ringkasan
				row.push(siswa.ringkasan.H, siswa.ringkasan.I, siswa.ringkasan.S, siswa.ringkasan.A);

				aoa.push(row);
			});
		} else if (activeTab === 'nilai' && dataRekap.data) {
			// Panggil fungsi pivot yang sudah kita buat sebelumnya
			const { kolomTugas, barisSiswa } = pivotNilai(dataRekap.data);

			// 1. Header
			const headerTugas = kolomTugas.map((t) => `${t.judul} (${t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''})`);
			header = ['No', 'NIS', 'Nama Siswa', ...headerTugas, 'Rata-rata'];
			aoa.push(header);

			// 2. Data Baris
			barisSiswa.forEach((row, idx) => {
				const rowData = [idx + 1, row.nis, row.nama_lengkap];

				// Nilai per tugas
				kolomTugas.forEach((t) => {
					const val = row.nilaiByTugas[t.key];
					rowData.push(val !== undefined && val !== null ? Number(val) : '-');
				});

				// Rata-rata
				rowData.push(row.rataRata !== null ? Number(row.rataRata) : '-');

				aoa.push(rowData);
			});
		} else if (activeTab === 'jurnal' && dataRekap.data) {
			// Header
			header = ['No', 'Tanggal', 'Jam', 'Pert.', 'Mapel', 'Materi', 'Kegiatan', 'Hambatan', 'Solusi', 'Tuntas'];
			aoa.push(header);

			// Data
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

		// --- PROSES PEMBUATAN FILE EXCEL ---
		// 1. Buat Worksheet dari Array data
		const worksheet = XLSX.utils.aoa_to_sheet(aoa);

		// (Opsional) Auto width kolom sederhana
		const wscols = header.map(() => ({ wch: 15 })); // set lebar kolom rata 15 char
		wscols[2] = { wch: 30 }; // kolom Nama Siswa lebih lebar
		worksheet['!cols'] = wscols;

		// 2. Buat Workbook
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, activeTab);

		// 3. Download File
		const filename = `Laporan_${activeTab}_${selectedKelas}_${bulan}_${tahun}.xlsx`;
		XLSX.writeFile(workbook, filename);
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

	const tahunOptions = useMemo(() => {
		const list = [];
		const currentYear = new Date().getFullYear();
		for (let i = currentYear - 2; i <= currentYear + 1; i++) list.push(i);
		return list;
	}, []);

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
				<div className='text-center'>
					<Loader />
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gray-50 pb-16'>
			{/* Header */}
			<div className='bg-gradient-to-r from-indigo-600 to-purple-700 py-8 px-4 sm:px-8 rounded-b-[2.5rem] shadow-2xl'>
				<div className='max-w-6xl mx-auto'>
					<div className='flex items-center justify-between gap-4'>
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
								<p className='text-indigo-100 text-sm'>Absensi, Nilai, dan Jurnal per periode</p>
							</div>
						</div>

						<div className='flex items-center gap-2'>
							<button
								onClick={handleExportCSV}
								className='bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl font-semibold transition-colors'>
								Export CSV
							</button>
							<button
								onClick={handleExportExcel}
								className='bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl font-bold transition-colors'>
								Export Excel
							</button>
						</div>
					</div>

					{/* Tabs */}
					<div className='mt-6 flex gap-2 flex-wrap'>
						{tabs.map((t) => (
							<button
								key={t.id}
								onClick={() => setActiveTab(t.id)}
								className={`px-4 py-2 rounded-xl font-semibold transition-all ${activeTab === t.id ? 'bg-white text-indigo-700 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
								<span className='mr-2'>{t.icon}</span>
								{t.name}
							</button>
						))}
					</div>

					{/* Filters */}
					<div className='mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1'>Kelas</p>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-semibold text-gray-800 bg-white/90 outline-none'>
								{kelasList.map((k) => {
									const nama = k.kelas || k.nama_kelas;
									return (
										<option
											key={k.id}
											value={nama}>
											{nama}
										</option>
									);
								})}
							</select>
						</div>

						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1'>Mapel</p>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								disabled={activeTab === 'absensi'}
								className={`w-full rounded-xl px-3 py-2 font-semibold outline-none ${activeTab === 'absensi' ? 'bg-white/40 text-white/70 cursor-not-allowed' : 'bg-white/90 text-gray-800'}`}>
								{mapelList.map((m) => {
									const nama = m.mapel || m.nama_mapel;
									return (
										<option
											key={m.id}
											value={nama}>
											{nama}
										</option>
									);
								})}
							</select>
							{activeTab === 'absensi' && <p className='text-[11px] text-indigo-100 mt-1'>Mapel tidak dipakai untuk Absensi.</p>}
						</div>

						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1'>Bulan</p>
							<select
								value={bulan}
								onChange={(e) => setBulan(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-semibold text-gray-800 bg-white/90 outline-none'>
								{bulanOptions.map((b) => (
									<option
										key={b.value}
										value={b.value}>
										{b.label}
									</option>
								))}
							</select>
						</div>

						<div className='bg-white/10 border border-white/15 rounded-2xl p-3'>
							<p className='text-xs text-indigo-100 mb-1'>Tahun</p>
							<select
								value={tahun}
								onChange={(e) => setTahun(e.target.value)}
								className='w-full rounded-xl px-3 py-2 font-semibold text-gray-800 bg-white/90 outline-none'>
								{tahunOptions.map((t) => (
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

			{/* Content */}
			<div className='max-w-6xl mx-auto px-4 sm:px-8 mt-8'>
				{/* Stats */}
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
						<div className='bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Lulus (≥70)</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.lulus}</p>
						</div>
						<div className='bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>% Lulus</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.persentaseLulus}%</p>
						</div>
					</div>
				)}

				{activeTab === 'jurnal' && stats.total > 0 && (
					<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6'>
						<div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100'>
							<p className='text-xs text-gray-600 mb-1'>Total Jurnal</p>
							<p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
						</div>
						<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Pertemuan Terisi</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.totalPertemuan}</p>
						</div>
						<div className='bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-4 text-white'>
							<p className='text-xs text-white/90 mb-1'>Materi Terisi</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.totalMateri}</p>
						</div>
					</div>
				)}

				{/* Table card */}
				{loadingRekap ? (
					<div className='bg-white rounded-2xl shadow-xl p-12 text-center'>
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
						<div className='bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4'>
							<h2 className='text-xl font-bold text-white'>
								{activeTab === 'absensi' && dataRekap.periode ? `Rekap Absensi - ${dataRekap.periode}` : `Laporan ${tabs.find((t) => t.id === activeTab)?.name}`}
							</h2>
						</div>

						{/* ABSENSI */}
						{activeTab === 'absensi' && dataRekap.siswa && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[900px]'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10'>No</th>
											<th className='px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-[56px] bg-gray-50 z-10'>NIS</th>
											<th className='px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-[160px] bg-gray-50 z-10 min-w-[220px]'>Nama Siswa</th>
											{dataRekap.tanggalList.map((tgl) => (
												<th
													key={tgl}
													className='px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase min-w-[70px]'>
													{new Date(tgl).getDate()}
												</th>
											))}
											<th className='px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-green-50'>H</th>
											<th className='px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-blue-50'>I</th>
											<th className='px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-yellow-50'>S</th>
											<th className='px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-red-50'>A</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.siswa.map((siswa, index) => (
											<tr
												key={siswa.siswa_id || siswa.id}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-3 py-2 sticky left-0 bg-white z-10 border-r border-gray-100 text-sm font-medium text-gray-900'>{index + 1}</td>
												<td className='px-3 py-2 sticky left-[56px] bg-white z-10 border-r border-gray-100 text-sm text-gray-700 font-mono'>{siswa.nis}</td>
												<td className='px-3 py-2 sticky left-[160px] bg-white z-10 border-r border-gray-100 text-sm font-semibold text-gray-900'>{siswa.nama_lengkap}</td>

												{dataRekap.tanggalList.map((tgl) => {
													const abs = siswa.absensi[tgl];
													const label = abs?.status === 'Hadir' ? 'H' : abs?.status === 'Izin' ? 'I' : abs?.status === 'Sakit' ? 'S' : abs?.status === 'Alpha' ? 'A' : '-';
													return (
														<td
															key={tgl}
															className='px-3 py-2 text-center'>
															<span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${getStatusBadgeColor(label)}`}>{label}</span>
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
							</div>
						)}

						{/* NILAI (PIVOT) */}
						{activeTab === 'nilai' && dataRekap.data && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[900px]'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10'>No</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase sticky left-[56px] bg-gray-50 z-10 min-w-[240px]'>Siswa</th>

											{pivotedNilai.kolomTugas.map((t) => (
												<th
													key={t.key}
													className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase min-w-[140px]'>
													<div className='flex flex-col items-center gap-1'>
														<span className='line-clamp-1'>{t.judul}</span>
														<span className='text-[10px] font-medium text-gray-400 normal-case'>{t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : ''}</span>
													</div>
												</th>
											))}

											<th className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-gray-100 min-w-[120px]'>Rata-rata</th>
										</tr>
									</thead>

									<tbody className='divide-y divide-gray-100'>
										{pivotedNilai.barisSiswa.map((row, idx) => (
											<tr
												key={row.siswa_id}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100'>{idx + 1}</td>
												<td className='px-4 py-3 sticky left-[56px] bg-white z-10 border-r border-gray-100'>
													<div className='flex flex-col'>
														<span className='text-sm font-semibold text-gray-900 line-clamp-1'>{row.nama_lengkap}</span>
														<span className='text-xs text-gray-400 font-mono'>{row.nis}</span>
													</div>
												</td>

												{pivotedNilai.kolomTugas.map((t) => {
													const v = row.nilaiByTugas[t.key];
													const has = v !== undefined && v !== null && String(v).trim() !== '';
													return (
														<td
															key={t.key}
															className='px-4 py-3 text-center'>
															{has ? <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getNilaiBadgeColor(v)}`}>{v}</span> : <span className='text-gray-300'>-</span>}
														</td>
													);
												})}

												<td className='px-4 py-3 text-center bg-gray-50'>
													{row.rataRata !== null ? (
														<span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getNilaiBadgeColor(row.rataRata)}`}>{row.rataRata}</span>
													) : (
														<span className='text-gray-300'>-</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{/* JURNAL */}
						{activeTab === 'jurnal' && dataRekap.data && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[900px]'>
									<thead className='bg-gray-50 border-b-2 border-gray-200'>
										<tr>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>No</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Tanggal</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Jam</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Pert.</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Materi</th>
											<th className='px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase'>Kegiatan</th>
											<th className='px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase'>Tuntas</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-100'>
										{dataRekap.data.map((item, index) => (
											<tr
												key={item.id || index}
												className='hover:bg-gray-50 transition-colors'>
												<td className='px-4 py-3 text-sm font-medium text-gray-900'>{index + 1}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>{item.jam_ke || '-'}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>{item.pertemuan_ke || '-'}</td>
												<td className='px-4 py-3 text-sm font-semibold text-gray-900'>{item.materi || '-'}</td>
												<td className='px-4 py-3 text-sm text-gray-700'>{item.kegiatan || '-'}</td>
												<td className='px-4 py-3 text-center'>
													<span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${item.tuntas ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
														{item.tuntas ? 'Ya' : 'Tidak'}
													</span>
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
		</div>
	);
}
