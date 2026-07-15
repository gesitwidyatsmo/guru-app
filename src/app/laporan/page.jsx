'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
	const processAbsensiMapel = useCallback((rawData) => {
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
				else if (statusRaw === 'Alpha' || statusRaw === 'Alpa') kode = 'A';

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
	}, [siswaList, selectedKelas]);

	// Memoize Data Absensi agar tidak render ulang terus
	const pivotedAbsensi = useMemo(() => {
		if (activeTab !== 'absensi') return null;
		// Asumsi dataRekap.data berisi array raw absensi mapel
		return processAbsensiMapel(dataRekap?.data || []);
	}, [activeTab, dataRekap, processAbsensiMapel]);

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
	const fetchLaporan = useCallback(async () => {
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
					const isYearMatch = d.getFullYear() === parseInt(tahun);
					if (bulan === 'all') return isYearMatch;
					return d.getMonth() + 1 === parseInt(bulan) && isYearMatch;
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
					const isYearMatch = d.getFullYear() === parseInt(tahun);
					if (bulan === 'all') return isYearMatch;
					return d.getMonth() + 1 === parseInt(bulan) && isYearMatch;
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
					const isYearMatch = d.getFullYear() === parseInt(tahun);
					if (bulan === 'all') return isYearMatch;
					return d.getMonth() + 1 === parseInt(bulan) && isYearMatch;
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
	}, [activeTab, selectedKelas, selectedMapel, bulan, tahun, processAbsensiMapel]);

	useEffect(() => {
		if (loading) return;
		fetchLaporan();
	}, [loading, fetchLaporan]);

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

	const handleExportPDF = () => {
		if (activeTab === 'absensi' && pivotedAbsensi) {
			const doc = new jsPDF({ orientation: 'landscape' });
			doc.text(`Rekap Absensi - Kelas ${selectedKelas} - ${selectedMapel}`, 14, 15);
			doc.text(`Periode: ${bulan}/${tahun}`, 14, 22);

			const head = [['No', 'Nama Siswa', ...pivotedAbsensi.kolomTanggal.map(p => p.label), 'H', 'I', 'S', 'A', '%']];
			const body = pivotedAbsensi.barisSiswa.map((row, idx) => [
				idx + 1,
				row.nama,
				...pivotedAbsensi.kolomTanggal.map(p => row.kehadiran[p.id] || '-'),
				row.stats.H || 0,
				row.stats.I || 0,
				row.stats.S || 0,
				row.stats.A || 0,
				`${row.persentase}%`
			]);

			autoTable(doc, {
				startY: 30,
				head: head,
				body: body,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229] },
			});

			doc.save(`Rekap_Absensi_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`);
		} else if (activeTab === 'nilai' && dataRekap?.data) {
			const pivotedNilai = pivotNilai(dataRekap.data);
			const doc = new jsPDF({ orientation: 'landscape' });
			doc.text(`Rekap Nilai - Kelas ${selectedKelas} - ${selectedMapel}`, 14, 15);
			doc.text(`Periode: ${bulan}/${tahun}`, 14, 22);

			const head = [['No', 'NIS', 'Nama Siswa', ...pivotedNilai.kolomTugas.map(t => t.judul), 'Rata-rata']];
			const body = pivotedNilai.barisSiswa.map((row, idx) => [
				idx + 1,
				row.nis || '-',
				row.nama_lengkap || '-',
				...pivotedNilai.kolomTugas.map(t => row.nilaiByTugas[t.key] !== undefined ? row.nilaiByTugas[t.key] : '-'),
				row.rataRata
			]);

			autoTable(doc, {
				startY: 30,
				head: head,
				body: body,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229] },
			});

			doc.save(`Rekap_Nilai_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`);
		} else if (activeTab === 'jurnal' && dataRekap?.data) {
			const doc = new jsPDF();
			doc.text(`Rekap Jurnal Mengajar - Kelas ${selectedKelas} - ${selectedMapel}`, 14, 15);
			doc.text(`Periode: ${bulan}/${tahun}`, 14, 22);

			const head = [['Tanggal', 'Jam', 'Pert', 'Materi', 'Kegiatan', 'Status']];
			const body = dataRekap.data.map((j) => [
				new Date(j.tanggal).toLocaleDateString('id-ID'),
				j.jam_ke || '-',
				j.pertemuan_ke || '-',
				j.materi || '-',
				j.kegiatan || '-',
				j.tuntas ? 'Tuntas' : 'Belum Tuntas'
			]);

			autoTable(doc, {
				startY: 30,
				head: head,
				body: body,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229] },
			});

			doc.save(`Rekap_Jurnal_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`);
		}
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
		<div className='min-h-screen bg-[#FFF5F0] pb-16 font-sans'>
			{/* Header Neobrutalism */}
			<div className='bg-[#F5C518] border-b-[4px] border-black py-8 px-4 sm:px-8 shadow-[0_8px_0px_0px_#0D0D0D] mb-8 relative'>
				<div className='max-w-7xl mx-auto'>
					<div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
						<div className='flex items-center gap-4'>
							<button
								onClick={() => router.back()}
								className='p-2 bg-white text-black border-[3px] border-black rounded-xl hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all'>
								<svg
									className='w-6 h-6'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={3}
										d='M15 19l-7-7 7-7'
									/>
								</svg>
							</button>
							<div>
								<h1 className='text-2xl sm:text-4xl font-black text-black uppercase tracking-widest'>Laporan</h1>
								<p className='text-black font-bold text-sm bg-white border-2 border-black inline-block px-2 py-0.5 rounded shadow-[2px_2px_0px_0px_#0D0D0D] mt-1'>Rekapitulasi {tabs.find((t) => t.id === activeTab)?.name} Bulanan</p>
							</div>
						</div>
						<div className='grid grid-cols-2 md:flex gap-3 mt-4 md:mt-0 w-full md:w-auto'>
							<button
								onClick={() => window.print()}
								className='bg-white text-black border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center'>
								Print
							</button>
							<button
								onClick={handleExportPDF}
								className='bg-[#E8451A] text-white border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center text-center'>
								Export PDF
							</button>
							<button
								onClick={handleExportExcel}
								className='col-span-2 md:col-auto bg-[#00A693] text-white border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center text-center'>
								Export Excel
							</button>
						</div>
					</div>

					{/* Tabs */}
					<div className='mt-8 grid grid-cols-2 md:flex gap-3 w-full md:w-auto'>
						{tabs.map((t, index) => (
							<button
								key={t.id}
								onClick={() => setActiveTab(t.id)}
								className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wide border-[3px] border-black transition-all flex items-center justify-center gap-2 ${
									tabs.length === 3 && index === 2 ? 'col-span-2 md:col-auto' : ''
								} ${
									activeTab === t.id 
										? 'bg-[#2F80ED] text-white translate-y-[2px] translate-x-[2px] shadow-none' 
										: 'bg-white text-black hover:-translate-y-[2px] hover:-translate-x-[2px] shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D]'
								}`}>
								<span>{t.icon}</span>
								{t.name}
							</button>
						))}
					</div>

					{/* Filters */}
					<div className='mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
						{/* Filter Kelas */}
						<div className='bg-white border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest mb-1'>Kelas</p>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full rounded-xl border-2 border-black px-3 py-2 font-bold text-black bg-white outline-none cursor-pointer focus:border-[#E8451A]'>
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
						<div className='bg-white border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest mb-1'>Mapel</p>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full rounded-xl border-2 border-black px-3 py-2 font-bold text-black bg-white outline-none cursor-pointer focus:border-[#E8451A]'>
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
						<div className='bg-white border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest mb-1'>Bulan</p>
							<select
								value={bulan}
								onChange={(e) => setBulan(e.target.value)}
								className='w-full rounded-xl border-2 border-black px-3 py-2 font-bold text-black bg-white outline-none cursor-pointer focus:border-[#E8451A]'>
								<option value='all'>Semua Bulan</option>
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
						<div className='bg-white border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest mb-1'>Tahun</p>
							<select
								value={tahun}
								onChange={(e) => setTahun(e.target.value)}
								className='w-full rounded-xl border-2 border-black px-3 py-2 font-bold text-black bg-white outline-none cursor-pointer focus:border-[#E8451A]'>
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
					<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
						<div className='bg-[#FFE8DC] p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Total Pertemuan</p>
							<p className='text-4xl font-black text-black mt-2'>
								{stats.totalPertemuan} <span className='text-lg font-bold'>Jam</span>
							</p>
						</div>
						<div className='bg-[#C4F0EB] p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Kehadiran Kelas</p>
							<p className='text-4xl font-black text-[#00A693] mt-2' style={{ textShadow: '2px 2px 0px #0D0D0D' }}>{stats.persentaseHadir}%</p>
						</div>
					</div>
				)}

				{loadingRekap ? (
					<div className='bg-white rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-black p-12 text-center'>
						<div className='animate-spin rounded-none h-12 w-12 border-4 border-black border-t-[#F5C518] mx-auto mb-4'></div>
						<p className='text-black font-black uppercase tracking-widest'>Sedang merekap data...</p>
					</div>
				) : (
					<div className='bg-white rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-black overflow-hidden'>
						{/* --- TABEL ABSENSI MAPEL --- */}
						{activeTab === 'absensi' && pivotedAbsensi && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[1000px]'>
									<thead className='bg-[#F5C518] border-b-[4px] border-black'>
										<tr>
											<th className='px-4 py-4 text-left text-sm font-black text-black uppercase sticky left-0 bg-[#F5C518] z-10 border-r-[3px] border-black'>No</th>
											<th className='px-4 py-4 text-left text-sm font-black text-black uppercase lg:sticky left-12 bg-[#F5C518] z-10 w-64 border-r-[3px] border-black'>Nama Siswa</th>
											{/* Header Pertemuan */}
											{pivotedAbsensi.kolomTanggal.map((p) => (
												<th
													key={p.id}
													className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black min-w-[60px]'>
													<div>{p.label}</div>
													<div className='text-[10px]'>{p.jam_ke}</div>
												</th>
											))}
											<th className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#C4F0EB]'>H</th>
											<th className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#E2D4F0]'>I</th>
											<th className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#FFE8DC]'>S</th>
											<th className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#FFD6D6]'>A</th>
											<th className='px-2 py-3 text-center text-sm font-black text-black bg-[#F5C518]'>%</th>
										</tr>
									</thead>
									<tbody className='divide-y-[3px] divide-black'>
										{pivotedAbsensi.barisSiswa.length === 0 ? (
											<tr>
												<td
													colSpan='100'
													className='p-8 text-center text-black font-bold uppercase'>
													Belum ada data absensi bulan ini
												</td>
											</tr>
										) : (
											pivotedAbsensi.barisSiswa.map((row, idx) => (
												<tr
													key={row.id}
													className='hover:bg-gray-100 transition-colors'>
													<td className='px-4 py-3 text-sm font-bold text-black sticky left-0 bg-white border-r-[3px] border-black'>{idx + 1}</td>
													<td className='px-4 py-3 lg:sticky left-12 bg-white border-r-[3px] border-black shadow-[4px_0_0px_0px_rgba(0,0,0,0.1)]'>
														<p className='text-sm font-black text-black truncate w-60'>{row.nama}</p>
														<p className='text-[10px] font-bold text-black font-mono'>{row.nis}</p>
													</td>
													{/* Status per pertemuan */}
													{pivotedAbsensi.kolomTanggal.map((p) => {
														const kode = row.kehadiran[p.id];
														let colorClass = 'text-black';
														if (kode === 'H') colorClass = 'text-[#00A693] font-black text-lg';
														if (kode === 'S') colorClass = 'text-[#F5C518] font-black text-lg';
														if (kode === 'I') colorClass = 'text-[#2F80ED] font-black text-lg';
														if (kode === 'A') colorClass = 'text-[#E8451A] font-black text-lg';

														return (
															<td
																key={p.id}
																className='px-2 py-3 text-center border-r-[3px] border-black'>
																<span className={colorClass}>{kode}</span>
															</td>
														);
													})}
													{/* Ringkasan */}
													<td className='px-2 py-3 text-center font-black text-[#00A693] border-r-[3px] border-black bg-[#C4F0EB]/30'>{row.stats.H}</td>
													<td className='px-2 py-3 text-center font-black text-[#2F80ED] border-r-[3px] border-black bg-[#E2D4F0]/30'>{row.stats.I}</td>
													<td className='px-2 py-3 text-center font-black text-[#F5C518] border-r-[3px] border-black bg-[#FFE8DC]/30'>{row.stats.S}</td>
													<td className='px-2 py-3 text-center font-black text-[#E8451A] border-r-[3px] border-black bg-[#FFD6D6]/30'>{row.stats.A}</td>
													<td className='px-2 py-3 text-center font-black text-black bg-[#F5C518]/20'>{row.persentase}%</td>
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
								<table className='w-full min-w-[800px]'>
									<thead className='bg-[#F5C518] border-b-[4px] border-black'>
										<tr>
											<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-16'>No</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Nama Siswa</th>
											{pivotNilai(dataRekap.data).kolomTugas.map((t) => (
												<th
													key={t.key}
													className='px-4 py-4 text-center text-sm font-black text-black border-r-[3px] border-black'>
													{t.judul}
												</th>
											))}
											<th className='px-4 py-4 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#C4F0EB]'>Rata2</th>
											<th className='px-4 py-4 text-center text-sm font-black text-black bg-[#FFE8DC]'>Status</th>
										</tr>
									</thead>
									<tbody className='divide-y-[3px] divide-black'>
										{pivotNilai(dataRekap.data).barisSiswa.map((row, idx) => (
											<tr key={row.siswa_id} className='hover:bg-gray-100 transition-colors'>
												<td className='px-4 py-3 font-black text-black border-r-[3px] border-black text-center'>{idx + 1}</td>
												<td className='px-6 py-3 font-black text-black border-r-[3px] border-black'>{row.nama_lengkap}</td>
												{pivotNilai(dataRekap.data).kolomTugas.map((t) => (
													<td
														key={t.key}
														className='px-4 py-3 text-center font-bold text-black border-r-[3px] border-black'>
														{row.nilaiByTugas[t.key] ?? '-'}
													</td>
												))}
												<td className='px-4 py-3 text-center font-black text-[#00A693] border-r-[3px] border-black bg-[#C4F0EB]/30'>{row.rataRata}</td>
												<td className='px-4 py-3 text-center bg-[#FFE8DC]/30'>
													<span className={`inline-block px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${row.rataRata >= 75 ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
														{row.rataRata >= 75 ? 'Tuntas' : 'Belum'}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{/* --- TABEL JURNAL (Logic Lama) --- */}
						{activeTab === 'jurnal' && dataRekap?.data && (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[600px]'>
									<thead className='bg-[#F5C518] border-b-[4px] border-black'>
										<tr>
											<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-16'>No</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Tanggal</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Materi</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Kegiatan</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Hambatan</th>
											<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Solusi</th>
											<th className='px-6 py-4 text-center text-sm font-black text-black uppercase'>Status</th>
										</tr>
									</thead>
									<tbody className='divide-y-[3px] divide-black'>
										{dataRekap.data.map((row, i) => (
											<tr key={i} className='hover:bg-gray-100 transition-colors'>
												<td className='px-4 py-3 text-center text-sm font-black text-black border-r-[3px] border-black'>{i + 1}</td>
												<td className='px-6 py-3 text-sm font-black text-black border-r-[3px] border-black w-32'>{new Date(row.tanggal).toLocaleDateString('id-ID')}</td>
												<td className='px-6 py-3 text-sm font-bold text-black border-r-[3px] border-black'>{row.materi}</td>
												<td className='px-6 py-3 text-sm font-bold text-black border-r-[3px] border-black'>{row.kegiatan}</td>
												<td className='px-6 py-3 text-sm font-bold text-black border-r-[3px] border-black max-w-[200px] truncate' title={row.hambatan}>{row.hambatan || '-'}</td>
												<td className='px-6 py-3 text-sm font-bold text-black border-r-[3px] border-black max-w-[200px] truncate' title={row.solusi}>{row.solusi || '-'}</td>
												<td className='px-6 py-3 text-center'>
													<span className={`inline-block px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${row.tuntas ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
														{row.tuntas ? 'Tuntas' : 'Belum'}
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
