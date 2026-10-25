'use client';

import { useEffect, useMemo, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip, { ArchiveBanner } from '@/app/components/AcademicPeriodChip';
import { hitungTotalPoinBersih, konversiPoinKeSikap } from '@/lib/poinUtils';
import { drawKopSuratPDF, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import { exportJurnalPDFReport } from '@/lib/pdfJurnalReport';
import { normStatus, parseJamPelajaran, calculateHariAlfa } from '@/lib/absensiUtils';
import { getTimeWIB, calculateDurationMinutes, formatDurationString, getKBMStatusBadge } from '@/lib/kbmRealtimeUtils';

export default function LaporanPage() {
	const router = useRouter();
	const { tahunAjar, semester, buildPeriodeQuery } = useAcademic();

	const [activeTab, setActiveTab] = useState('absensi'); // absensi, nilai, jurnal
	const [loading, setLoading] = useState(true);
	const [loadingRekap, setLoadingRekap] = useState(false);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Filter states
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [bulan, setBulan] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
	const [tahun, setTahun] = useState(() => new Date().getFullYear());
	const [searchQuery, setSearchQuery] = useState('');
	const [filterTipePoin, setFilterTipePoin] = useState('semua'); // 'semua' | 'positif' | 'negatif'
	const [perilakuViewMode, setPerilakuViewMode] = useState('ringkasan'); // 'ringkasan' | 'log'
	const [expandedSiswaId, setExpandedSiswaId] = useState(null);

	// Data
	const [dataRekap, setDataRekap] = useState(null);
	const [stats, setStats] = useState({});

	// Load initial master data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resMapel, resSiswa, resProfile] = await Promise.all([
					fetch('/api/kelas'),
					fetch('/api/mapel'),
					fetch('/api/siswa'),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				if (resProfile && resProfile.ok) {
					const pData = await resProfile.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}

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

				const jamStr = item.created_at ? getTimeWIB(item.created_at) : '';
				return {
					id: item.id,
					tanggal: item.tanggal,
					jam_ke: item.jam_ke,
					created_at: item.created_at,
					jam: jamStr,
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
				stats: { H: 0, S: 0, I: 0, A: 0, A_JP: 0 },
			};

			pertemuanList.forEach((p) => {
				// Sekarang p.absensiData adalah Object, jadi bisa dipanggil by key
				const statusRaw = p.absensiData[siswa.id] || '-';

				let kode = '-';
				const s = normStatus(statusRaw);
				if (s === 'hadir') kode = 'H';
				else if (s === 'sakit') kode = 'S';
				else if (s === 'izin') kode = 'I';
				else if (s === 'alfa') kode = 'A';

				row.kehadiran[p.id] = kode;

				// Hitung Stats
				if (kode !== '-') row.stats[kode] = (row.stats[kode] || 0) + 1;
				if (kode === 'A') {
					const jpList = parseJamPelajaran(p.jam_ke);
					const jp = jpList.length > 0 ? jpList.length : 1;
					row.stats.A_JP = (row.stats.A_JP || 0) + jp;
				}
			});

			// Konversi akumulasi JP Alfa ke Hari Alfa (7 JP = 1 Hari, sisa >= 5 JP = +1 Hari)
			const alfaCalc = calculateHariAlfa(row.stats.A_JP || 0);
			if (row.stats.A_JP > 0) {
				row.stats.A = alfaCalc.totalHari;
			}
			row.stats.A_Detail = alfaCalc;

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

	const filteredBarisSiswa = useMemo(() => {
		if (!pivotedAbsensi?.barisSiswa) return [];
		if (!searchQuery.trim()) return pivotedAbsensi.barisSiswa;
		const q = searchQuery.toLowerCase().trim();
		return pivotedAbsensi.barisSiswa.filter(
			(row) =>
				(row.nama && row.nama.toLowerCase().includes(q)) ||
				(row.nis && String(row.nis).toLowerCase().includes(q))
		);
	}, [pivotedAbsensi?.barisSiswa, searchQuery]);

	// --- Logic Baru: Pivot Nilai (Rata-rata memperhitungkan nilai 0 & Nilai Sikap dari Poin) ---
	const pivotNilai = useCallback((dataRaw, dataPoin = []) => {
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

		// Map Poin per Siswa
		const poinPerSiswa = {};
		(dataPoin || []).forEach((p) => {
			const sid = String(p.siswa_id);
			if (!poinPerSiswa[sid]) poinPerSiswa[sid] = [];
			poinPerSiswa[sid].push(p);
		});

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

		// 4. Hitung Rata-rata & Kalkulasi Nilai Sikap dari Poin
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
				}
			});

			const pembagi = kolomTugas.length;
			const avg = pembagi > 0 ? Math.round(sum / pembagi) : 0;

			// Hitung Poin Sikap
			const poinSiswa = poinPerSiswa[row.siswa_id] || [];
			const totalPoinBersih = hitungTotalPoinBersih(poinSiswa);
			const predikatSikap = konversiPoinKeSikap(totalPoinBersih);

			return { ...row, rataRata: avg, totalPoinBersih, predikatSikap };
		});

		// Sort nama siswa
		barisSiswa.sort((a, b) => String(a.nama_lengkap).localeCompare(String(b.nama_lengkap), 'id'));

		return { kolomTugas, barisSiswa };
	}, [siswaList, selectedKelas]);

	// Memoize Pivot Nilai
	const pivotedNilai = useMemo(() => {
		if (activeTab !== 'nilai' || !dataRekap?.data) return { kolomTugas: [], barisSiswa: [] };
		return pivotNilai(dataRekap.data, dataRekap.dataPoin || []);
	}, [activeTab, dataRekap, pivotNilai]);

	// --- LOGIC PERILAKU / POIN ---
	const rekapPerilakuSiswa = useMemo(() => {
		if (activeTab !== 'perilaku') return [];
		const siswaKelasIni = siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim());
		const allPoints = Array.isArray(dataRekap?.data) ? dataRekap.data : [];

		const list = siswaKelasIni.map((siswa) => {
			const poinSiswa = allPoints.filter((p) => String(p.siswa_id) === String(siswa.id));
			const totalPoinBersih = hitungTotalPoinBersih(poinSiswa);
			const predikatSikap = konversiPoinKeSikap(totalPoinBersih);
			const poinPositif = poinSiswa.filter((p) => p.tipe === 'positif').reduce((sum, p) => sum + parseInt(p.poin || 0, 10), 0);
			const poinNegatif = poinSiswa.filter((p) => p.tipe === 'negatif').reduce((sum, p) => sum + parseInt(p.poin || 0, 10), 0);

			return {
				id: String(siswa.id),
				nis: siswa.nis || '-',
				nama_lengkap: siswa.nama_lengkap || '-',
				totalPoinBersih,
				predikatSikap,
				poinPositif,
				poinNegatif,
				poinList: poinSiswa,
				jumlahCatatan: poinSiswa.length,
			};
		});

		return list.sort((a, b) => String(a.nama_lengkap).localeCompare(String(b.nama_lengkap), 'id'));
	}, [activeTab, siswaList, selectedKelas, dataRekap?.data]);

	const filteredPerilakuSiswa = useMemo(() => {
		if (!rekapPerilakuSiswa) return [];
		let res = rekapPerilakuSiswa;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			res = res.filter(
				(s) =>
					s.nama_lengkap.toLowerCase().includes(q) ||
					String(s.nis).toLowerCase().includes(q) ||
					s.poinList.some((p) => (p.aktifitas && p.aktifitas.toLowerCase().includes(q)) || (p.kategori && p.kategori.toLowerCase().includes(q)))
			);
		}
		if (filterTipePoin === 'positif') {
			res = res.filter((s) => s.poinPositif > 0);
		} else if (filterTipePoin === 'negatif') {
			res = res.filter((s) => s.poinNegatif > 0);
		}
		return res;
	}, [rekapPerilakuSiswa, searchQuery, filterTipePoin]);

	const filteredPerilakuLog = useMemo(() => {
		if (activeTab !== 'perilaku' || !Array.isArray(dataRekap?.data)) return [];
		let res = dataRekap.data;
		if (filterTipePoin !== 'semua') {
			res = res.filter((p) => p.tipe === filterTipePoin);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			res = res.filter((p) => {
				const s = siswaList.find((sw) => String(sw.id) === String(p.siswa_id));
				const nama = s?.nama_lengkap || '';
				return (
					nama.toLowerCase().includes(q) ||
					(p.aktifitas && p.aktifitas.toLowerCase().includes(q)) ||
					(p.kategori && p.kategori.toLowerCase().includes(q)) ||
					(p.keterangan && p.keterangan.toLowerCase().includes(q))
				);
			});
		}
		return res;
	}, [activeTab, dataRekap?.data, filterTipePoin, searchQuery, siswaList]);

	// --- FETCHING DATA ---
	const fetchLaporan = useCallback(async () => {
		if (!selectedKelas) return;
		setLoadingRekap(true);
		try {
			if (activeTab === 'absensi') {
				if (!selectedMapel) return;
				const url = `/api/absensi-mapel?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}&${buildPeriodeQuery()}`;
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
				const [resNilai, resPoin] = await Promise.all([
					fetch(`/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}&${buildPeriodeQuery()}`),
					fetch(`/api/poin?kelas=${encodeURIComponent(selectedKelas)}&${buildPeriodeQuery()}`)
				]);
				if (!resNilai.ok) throw new Error('Gagal memuat data nilai');
				const data = await resNilai.json();
				const dataPoin = resPoin.ok ? await resPoin.json() : [];

				const filtered = data.filter((item) => {
					const d = new Date(item.tanggal);
					const isYearMatch = d.getFullYear() === parseInt(tahun);
					if (bulan === 'all') return isYearMatch;
					return d.getMonth() + 1 === parseInt(bulan) && isYearMatch;
				});
				setDataRekap({ data: filtered, dataPoin });

				// Stats Nilai Simple
				const vals = filtered.map((r) => Number(r.nilai)).filter((n) => !isNaN(n));
				setStats({
					totalNilai: vals.length,
					rataRata: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
				});
			}

			if (activeTab === 'perilaku') {
				const url = `/api/poin?kelas=${encodeURIComponent(selectedKelas)}&${buildPeriodeQuery()}`;
				const res = await fetch(url);
				if (!res.ok) throw new Error('Gagal memuat data laporan perilaku');
				const data = await res.json();
				const filtered = (data || []).filter((item) => {
					const d = new Date(item.tanggal);
					const isYearMatch = d.getFullYear() === parseInt(tahun);
					if (bulan === 'all') return isYearMatch;
					return d.getMonth() + 1 === parseInt(bulan) && isYearMatch;
				});
				setDataRekap({ data: filtered });

				// Stats Perilaku
				const totalPositif = filtered.filter((p) => p.tipe === 'positif').reduce((s, p) => s + (p.poin || 0), 0);
				const totalNegatif = filtered.filter((p) => p.tipe === 'negatif').reduce((s, p) => s + (p.poin || 0), 0);
				setStats({
					totalCatatan: filtered.length,
					totalPositif,
					totalNegatif,
					netPoin: totalPositif - totalNegatif,
				});
			}

			if (activeTab === 'jurnal') {
				if (!selectedMapel) return;
				const url = `/api/jurnal?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}&${buildPeriodeQuery()}`;
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
	}, [activeTab, selectedKelas, selectedMapel, bulan, tahun, processAbsensiMapel, buildPeriodeQuery]);

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
			const header1 = ['No', 'NIS', 'Nama Siswa', ...kolomTanggal.map((p) => p.jam ? `${p.label} (${p.jam_ke} • ${p.jam})` : `${p.label} (${p.jam_ke})`), 'H', 'I', 'S', 'A', '%'];
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
			const { kolomTugas, barisSiswa } = pivotedNilai;
			const headerTugas = kolomTugas.map((t) => `${t.judul} (${new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`);
			aoa.push(['No', 'NIS', 'Nama Siswa', ...headerTugas, 'Rata-rata', 'Status', 'Poin Bersih', 'Nilai Sikap']);
			barisSiswa.forEach((row, idx) => {
				const rowData = [idx + 1, row.nis, row.nama_lengkap];
				kolomTugas.forEach((t) => {
					const val = row.nilaiByTugas[t.key];
					rowData.push(val !== undefined ? Number(val) : '-');
				});
				rowData.push(row.rataRata ?? '-');
				rowData.push(row.rataRata >= 75 ? 'Tuntas' : 'Belum Tuntas');
				const pts = row.totalPoinBersih ?? 0;
				rowData.push(pts > 0 ? `+${pts}` : `${pts}`);
				rowData.push(row.predikatSikap ? `${row.predikatSikap.predikat} (${row.predikatSikap.label})` : '-');
				aoa.push(rowData);
			});
		} else if (activeTab === 'perilaku') {
			if (perilakuViewMode === 'ringkasan') {
				aoa.push(['No', 'NIS', 'Nama Siswa', 'Predikat Sikap', 'Poin Bersih', 'Total Positif', 'Total Negatif', 'Jumlah Catatan', 'Sumber & Rincian Poin']);
				filteredPerilakuSiswa.forEach((row, idx) => {
					const rincian = row.poinList.map((p) => `[${p.tanggal}] ${p.aktifitas} (${p.tipe === 'positif' ? '+' : '-'}${p.poin}${p.kategori ? `, Kat: ${p.kategori}` : ''}${p.keterangan ? ` - ${p.keterangan}` : ''})`).join('; ');
					aoa.push([
						idx + 1,
						row.nis,
						row.nama_lengkap,
						`${row.predikatSikap.predikat} (${row.predikatSikap.label})`,
						row.totalPoinBersih,
						row.poinPositif,
						row.poinNegatif,
						row.jumlahCatatan,
						rincian || 'Belum ada catatan',
					]);
				});
			} else {
				aoa.push(['No', 'Tanggal', 'NIS', 'Nama Siswa', 'Tipe', 'Kategori', 'Aktivitas', 'Poin', 'Keterangan']);
				filteredPerilakuLog.forEach((item, idx) => {
					const s = siswaList.find((sw) => String(sw.id) === String(item.siswa_id));
					aoa.push([
						idx + 1,
						item.tanggal,
						s?.nis || '-',
						s?.nama_lengkap || 'Siswa Unknown',
						item.tipe === 'positif' ? 'Positif' : 'Negatif/Pelanggaran',
						item.kategori || '-',
						item.aktifitas,
						item.tipe === 'positif' ? `+${item.poin}` : `-${item.poin}`,
						item.keterangan || '-',
					]);
				});
			}
		} else if (activeTab === 'jurnal' && dataRekap.data) {
			aoa.push([
				'No',
				'Tanggal',
				'Jam Ke',
				'Jam Mulai',
				'Jam Selesai',
				'Durasi (Menit)',
				'Status Kehadiran',
				'Pert.',
				'Mapel',
				'Materi',
				'Kegiatan',
				'Hambatan',
				'Solusi',
				'Tuntas',
			]);
			dataRekap.data.forEach((item, index) => {
				aoa.push([
					index + 1,
					new Date(item.tanggal).toLocaleDateString('id-ID'),
					item.jam_ke || '',
					item.jam_mulai ? item.jam_mulai.slice(0, 5) : '',
					item.jam_selesai ? item.jam_selesai.slice(0, 5) : '',
					item.durasi_menit ?? (item.jam_mulai && item.jam_selesai ? calculateDurationMinutes(item.jam_mulai, item.jam_selesai) : ''),
					item.status_kehadiran || 'Normal',
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
		XLSX.writeFile(workbook, `Laporan_${activeTab}_${selectedKelas}_${activeTab === 'perilaku' ? 'Poin' : selectedMapel}_${bulan}.xlsx`);
	};

	const handleExportPDF = () => {
		if (activeTab === 'absensi' && pivotedAbsensi) {
			const doc = new jsPDF({ orientation: 'landscape' });
			const startY = drawKopSuratPDF(doc, schoolProfile);

			const pWidth = doc.internal.pageSize.getWidth();
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text(`REKAPITULASI PRESENSI / ABSENSI KELAS ${selectedKelas}`, pWidth / 2, startY + 3.5, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(`Mata Pelajaran: ${selectedMapel}  •  Periode: ${bulan === 'all' ? 'Semua Bulan' : bulan}/${tahun}`, pWidth / 2, startY + 8, { align: 'center' });

			const head = [['No', 'Nama Siswa', ...pivotedAbsensi.kolomTanggal.map(p => p.jam ? `${p.label}\n(${p.jam})` : p.label), 'H', 'I', 'S', 'A', '%']];
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
				startY: startY + 12,
				head: head,
				body: body,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229] },
				styles: { fontSize: 7.5 },
			});

			doc.save(`Rekap_Absensi_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`);
		} else if (activeTab === 'nilai' && dataRekap?.data) {
			const { kolomTugas, barisSiswa } = pivotedNilai;
			const doc = new jsPDF({ orientation: 'landscape' });
			const startY = drawKopSuratPDF(doc, schoolProfile);

			const pWidth = doc.internal.pageSize.getWidth();
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text(`REKAPITULASI NILAI AKADEMIK KELAS ${selectedKelas}`, pWidth / 2, startY + 3.5, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(`Mata Pelajaran: ${selectedMapel}  •  Periode: ${bulan === 'all' ? 'Semua Bulan' : bulan}/${tahun}`, pWidth / 2, startY + 8, { align: 'center' });

			const head = [['No', 'NIS', 'Nama Siswa', ...kolomTugas.map(t => t.judul), 'Rata2', 'Poin', 'Sikap']];
			const body = barisSiswa.map((row, idx) => {
				const pts = row.totalPoinBersih ?? 0;
				return [
					idx + 1,
					row.nis || '-',
					row.nama_lengkap || '-',
					...kolomTugas.map(t => row.nilaiByTugas[t.key] !== undefined ? row.nilaiByTugas[t.key] : '-'),
					row.rataRata,
					pts > 0 ? `+${pts}` : `${pts}`,
					row.predikatSikap ? `${row.predikatSikap.predikat} (${row.predikatSikap.label})` : '-'
				];
			});

			autoTable(doc, {
				startY: startY + 12,
				head: head,
				body: body,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229] },
				styles: { fontSize: 7.5 },
			});

			doc.save(`Rekap_Nilai_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`);
		} else if (activeTab === 'perilaku') {
			const doc = new jsPDF({ orientation: 'landscape' });
			const startY = drawKopSuratPDF(doc, schoolProfile);

			const pWidth = doc.internal.pageSize.getWidth();
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text(`REKAPITULASI KARAKTER & POIN SISWA KELAS ${selectedKelas}`, pWidth / 2, startY + 3.5, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(`Periode: ${bulan === 'all' ? 'Semua Bulan' : bulan}/${tahun}`, pWidth / 2, startY + 8, { align: 'center' });

			if (perilakuViewMode === 'ringkasan') {
				const head = [['No', 'NIS', 'Nama Siswa', 'Predikat', 'Poin Bersih', 'Positif', 'Negatif', 'Ringkasan Sumber Poin']];
				const body = filteredPerilakuSiswa.map((row, idx) => {
					const rincian = row.poinList.slice(0, 3).map((p) => `${p.aktifitas} (${p.tipe === 'positif' ? '+' : '-'}${p.poin})`).join(', ');
					return [
						idx + 1,
						row.nis || '-',
						row.nama_lengkap || '-',
						`${row.predikatSikap.predikat} (${row.predikatSikap.label})`,
						row.totalPoinBersih > 0 ? `+${row.totalPoinBersih}` : `${row.totalPoinBersih}`,
						`+${row.poinPositif}`,
						`-${row.poinNegatif}`,
						rincian || '-'
					];
				});

				autoTable(doc, {
					startY: startY + 12,
					head: head,
					body: body,
					theme: 'grid',
					headStyles: { fillColor: [0, 166, 147] },
					styles: { fontSize: 7.5 },
				});
			} else {
				const head = [['No', 'Tanggal', 'Nama Siswa', 'Tipe', 'Kategori', 'Aktivitas', 'Poin']];
				const body = filteredPerilakuLog.map((item, idx) => {
					const s = siswaList.find((sw) => String(sw.id) === String(item.siswa_id));
					return [
						idx + 1,
						item.tanggal,
						s?.nama_lengkap || 'Siswa Unknown',
						item.tipe === 'positif' ? 'Positif' : 'Negatif',
						item.kategori || '-',
						item.aktifitas,
						item.tipe === 'positif' ? `+${item.poin}` : `-${item.poin}`
					];
				});

				autoTable(doc, {
					startY: startY + 12,
					head: head,
					body: body,
					theme: 'grid',
					headStyles: { fillColor: [0, 166, 147] },
					styles: { fontSize: 8 },
				});
			}

			doc.save(`Laporan_Perilaku_${selectedKelas}_${bulan}_${tahun}.pdf`);
		} else if (activeTab === 'jurnal' && dataRekap?.data) {
			const subInfo = `Kelas: ${selectedKelas}  •  Mapel: ${selectedMapel}  •  Periode: ${bulan === 'all' ? 'Semua Bulan' : bulan}/${tahun}`;
			exportJurnalPDFReport({
				journals: dataRekap.data,
				schoolProfile,
				title: 'REKAPITULASI JURNAL PEMBELAJARAN (KBM)',
				subInfo,
				filename: `Rekap_Jurnal_${selectedKelas}_${selectedMapel}_${bulan}_${tahun}.pdf`,
			});
		}
	};

	const tabs = [
		{ id: 'absensi', name: 'Absensi', icon: '📋' },
		{ id: 'nilai', name: 'Nilai', icon: '📝' },
		{ id: 'perilaku', name: 'Perilaku', icon: '⭐' },
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
								<div className='flex flex-wrap items-center gap-2 sm:gap-3'>
									<h1 className='text-2xl sm:text-4xl font-black text-black uppercase tracking-widest'>Laporan</h1>
									<AcademicPeriodChip align='left' />
								</div>
								<p className='text-black font-bold text-xs sm:text-sm bg-white border-2 border-black inline-block px-2 py-0.5 rounded shadow-[2px_2px_0px_0px_#0D0D0D] mt-1'>
									Rekapitulasi {tabs.find((t) => t.id === activeTab)?.name} Bulanan
								</p>
							</div>
						</div>
						<div className='grid grid-cols-2 md:flex gap-3 mt-4 md:mt-0 w-full md:w-auto'>
							<button
								onClick={handleExportPDF}
								className='bg-[#E8451A] text-white border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center text-center'>
								Export PDF
							</button>
							<button
								onClick={handleExportExcel}
								className='bg-[#00A693] text-white border-[3px] border-black px-4 py-2 rounded-xl font-black uppercase hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center text-center'>
								Export Excel
							</button>
						</div>
					</div>
					<ArchiveBanner />

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
						{/* Filter Mapel / Tipe Poin */}
						{activeTab !== 'perilaku' ? (
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
						) : (
							<div className='bg-white border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<p className='text-xs text-black font-black uppercase tracking-widest mb-1'>Filter Tipe Poin</p>
								<select
									value={filterTipePoin}
									onChange={(e) => setFilterTipePoin(e.target.value)}
									className='w-full rounded-xl border-2 border-black px-3 py-2 font-bold text-black bg-white outline-none cursor-pointer focus:border-[#E8451A]'>
									<option value='semua'>Semua Poin (+ & -)</option>
									<option value='positif'>🏆 Positif Saja</option>
									<option value='negatif'>⚠️ Pelanggaran Saja</option>
								</select>
							</div>
						)}
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

				{/* STATS CARD PERILAKU */}
				{activeTab === 'perilaku' && (
					<div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
						<div className='bg-[#C4F0EB] p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Total Poin Positif</p>
							<p className='text-3xl sm:text-4xl font-black text-[#00A693] mt-2' style={{ textShadow: '2px 2px 0px #0D0D0D' }}>
								+{stats.totalPositif || 0}
							</p>
						</div>
						<div className='bg-[#FFD6D6] p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Total Pelanggaran</p>
							<p className='text-3xl sm:text-4xl font-black text-[#E8451A] mt-2' style={{ textShadow: '2px 2px 0px #0D0D0D' }}>
								-{stats.totalNegatif || 0}
							</p>
						</div>
						<div className='bg-[#FFE8DC] p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Net Poin Kelas</p>
							<p className={`text-3xl sm:text-4xl font-black mt-2 ${(stats.netPoin || 0) >= 0 ? 'text-[#00A693]' : 'text-[#E8451A]'}`} style={{ textShadow: '2px 2px 0px #0D0D0D' }}>
								{(stats.netPoin || 0) >= 0 ? '+' : ''}{stats.netPoin || 0}
							</p>
						</div>
						<div className='bg-white p-5 rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-black transition-transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
							<p className='text-xs text-black font-black uppercase tracking-widest'>Kejadian Tercatat</p>
							<p className='text-3xl sm:text-4xl font-black text-black mt-2'>
								{stats.totalCatatan || 0} <span className='text-base font-bold'>Aktivitas</span>
							</p>
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
							<div>
								{/* Search Bar Toolbar */}
								<div className='p-4 bg-[#FFE8DC] border-b-[4px] border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
									<div className='relative flex-1 max-w-md'>
										<input
											type='text'
											placeholder='Cari nama atau NIS siswa...'
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className='w-full pl-9 pr-8 py-2 bg-white border-[3px] border-black font-bold text-xs outline-none focus:shadow-[3px_3px_0px_0px_#0D0D0D]'
										/>
										<svg className='w-4 h-4 absolute left-2.5 top-2.5 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
										</svg>
										{searchQuery && (
											<button onClick={() => setSearchQuery('')} className='absolute right-2 top-2 text-black font-black text-xs'>✕</button>
										)}
									</div>
									<div className='text-xs font-black uppercase text-black bg-white border-[2px] border-black px-3 py-1.5 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										{searchQuery.trim() ? `Menampilkan ${filteredBarisSiswa.length} dari ${pivotedAbsensi.barisSiswa.length} siswa` : `Total ${pivotedAbsensi.barisSiswa.length} siswa`}
									</div>
								</div>

								{filteredBarisSiswa.length === 0 ? (
									<div className='p-12 text-center text-black font-black uppercase text-sm'>
										{pivotedAbsensi.barisSiswa.length === 0 ? 'Belum ada data absensi bulan ini' : `Tidak ada siswa yang cocok dengan "${searchQuery}"`}
									</div>
								) : (
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
															className='px-2 py-3 text-center text-sm font-black text-black border-r-[3px] border-black min-w-[70px]'>
															<div>{p.label}</div>
															<div className='text-[10px]'>{p.jam_ke}</div>
															{p.jam && (
																<div className='text-[9px] font-mono text-gray-800 bg-white/80 rounded px-1 mt-0.5 border border-black/30 font-bold'>
																	{p.jam}
																</div>
															)}
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
												{filteredBarisSiswa.map((row, idx) => (
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
														<td 
															title={row.stats.A_JP > 0 ? `${row.stats.A} Hari (${row.stats.A_JP} JP Alfa)` : `${row.stats.A} Hari`}
															className='px-2 py-3 text-center font-black text-[#E8451A] border-r-[3px] border-black bg-[#FFD6D6]/30'>
															<div>{row.stats.A}</div>
															{row.stats.A_JP > 0 && (
																<div className='text-[9px] font-normal text-gray-700 leading-none'>{row.stats.A_JP} JP</div>
															)}
														</td>
														<td className='px-2 py-3 text-center font-black text-black bg-[#F5C518]/20'>{row.persentase}%</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						)}

						{/* --- TABEL NILAI --- */}
						{activeTab === 'nilai' && dataRekap?.data && (
							<div>
								<div className='overflow-x-auto'>
									<table className='w-full min-w-[850px]'>
										<thead className='bg-[#F5C518] border-b-[4px] border-black'>
											<tr>
												<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-16'>No</th>
												<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Nama Siswa</th>
												{pivotedNilai.kolomTugas.map((t) => (
													<th
														key={t.key}
														className='px-4 py-4 text-center text-sm font-black text-black border-r-[3px] border-black'>
														{t.judul}
													</th>
												))}
												<th className='px-4 py-4 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#C4F0EB]'>Rata2</th>
												<th className='px-4 py-4 text-center text-sm font-black text-black border-r-[3px] border-black bg-[#FFE8DC]'>Status</th>
												<th className='px-4 py-4 text-center text-sm font-black text-black bg-[#C4F0EB]'>Nilai Sikap (Poin)</th>
											</tr>
										</thead>
										<tbody className='divide-y-[3px] divide-black'>
											{pivotedNilai.barisSiswa.map((row, idx) => (
												<tr key={row.siswa_id} className='hover:bg-gray-100 transition-colors'>
													<td className='px-4 py-3 font-black text-black border-r-[3px] border-black text-center'>{idx + 1}</td>
													<td className='px-6 py-3 font-black text-black border-r-[3px] border-black'>{row.nama_lengkap}</td>
													{pivotedNilai.kolomTugas.map((t) => (
														<td
															key={t.key}
															className='px-4 py-3 text-center font-bold text-black border-r-[3px] border-black'>
															{row.nilaiByTugas[t.key] ?? '-'}
														</td>
													))}
													<td className='px-4 py-3 text-center font-black text-[#00A693] border-r-[3px] border-black bg-[#C4F0EB]/30'>{row.rataRata}</td>
													<td className='px-4 py-3 text-center border-r-[3px] border-black bg-[#FFE8DC]/30'>
														<span className={`inline-block px-3 py-1 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${row.rataRata >= 75 ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
															{row.rataRata >= 75 ? 'Tuntas' : 'Belum'}
														</span>
													</td>
													<td className='px-4 py-3 text-center bg-white'>
														<div className='inline-flex items-center gap-2'>
															<span className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${row.predikatSikap?.badgeClass || 'bg-gray-100 text-black'}`}>
																{row.predikatSikap?.predikat} ({row.predikatSikap?.label})
															</span>
															<span className={`text-[10px] font-black px-2 py-0.5 border border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D] ${row.totalPoinBersih >= 0 ? 'bg-[#C4F0EB] text-[#00A693]' : 'bg-[#FFD6D6] text-[#E8451A]'}`}>
																{row.totalPoinBersih > 0 ? `+${row.totalPoinBersih}` : row.totalPoinBersih} pts
															</span>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Keterangan Nilai Sikap Raport */}
								<div className='p-6 bg-[#FFF5F0] border-t-[4px] border-black'>
									<div className='bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<h4 className='text-xs font-black uppercase tracking-wider text-black mb-3 flex items-center justify-between'>
											<span>Keterangan Nilai Sikap Raport (Berdasarkan Akumulasi Poin Perilaku)</span>
											<span className='text-[10px] text-gray-500 font-bold'>Semester Ini</span>
										</h4>
										<div className='flex flex-wrap gap-4 text-xs font-bold'>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-emerald-100 text-emerald-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>A</span>
												<span className='text-black'>Sangat Baik (≥ +50 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-blue-100 text-blue-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>B</span>
												<span className='text-black'>Baik (+10 s/d +49 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-amber-100 text-amber-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>C</span>
												<span className='text-black'>Cukup (-9 s/d +9 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-rose-100 text-rose-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>D</span>
												<span className='text-black'>Perlu Bimbingan (≤ -10 poin)</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* --- TABEL PERILAKU & SUMBER POIN --- */}
						{activeTab === 'perilaku' && (
							<div>
								{/* Toolbar View Mode & Search */}
								<div className='p-4 bg-[#FFE8DC] border-b-[4px] border-black flex flex-col md:flex-row md:items-center justify-between gap-4'>
									<div className='flex flex-wrap items-center gap-2'>
										<button
											onClick={() => setPerilakuViewMode('ringkasan')}
											className={`px-4 py-2 border-[2px] border-black text-xs font-black uppercase transition-all ${
												perilakuViewMode === 'ringkasan'
													? 'bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'
													: 'bg-white text-black hover:bg-gray-50'
											}`}>
											📊 Rekap Siswa & Sumber Poin
										</button>
										<button
											onClick={() => setPerilakuViewMode('log')}
											className={`px-4 py-2 border-[2px] border-black text-xs font-black uppercase transition-all ${
												perilakuViewMode === 'log'
													? 'bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'
													: 'bg-white text-black hover:bg-gray-50'
											}`}>
											📜 Log Riwayat Lengkap ({Array.isArray(dataRekap?.data) ? dataRekap.data.length : 0})
										</button>
									</div>

									<div className='flex items-center gap-3'>
										<div className='relative w-full sm:w-64'>
											<input
												type='text'
												placeholder='Cari siswa atau aktivitas...'
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className='w-full pl-8 pr-3 py-1.5 bg-white border-[2px] border-black font-bold text-xs outline-none focus:shadow-[2px_2px_0px_0px_#0D0D0D]'
											/>
											<svg className='w-4 h-4 absolute left-2 top-2 text-black' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
											</svg>
										</div>
										<span className='text-[10px] font-black uppercase text-black bg-white border-[2px] border-black px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#0D0D0D] whitespace-nowrap'>
											{perilakuViewMode === 'ringkasan' ? `${filteredPerilakuSiswa.length} Siswa` : `${filteredPerilakuLog.length} Catatan`}
										</span>
									</div>
								</div>

								{/* VIEW 1: REKAP PER SISWA & RINCIAN SUMBER POIN */}
								{perilakuViewMode === 'ringkasan' && (
									<div className='overflow-x-auto'>
										{filteredPerilakuSiswa.length === 0 ? (
											<div className='p-12 text-center text-black font-black uppercase text-sm'>
												Belum ada catatan poin atau siswa di kelas ini
											</div>
										) : (
											<table className='w-full min-w-[950px]'>
												<thead className='bg-[#F5C518] border-b-[4px] border-black'>
													<tr>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-16'>No</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Nama Siswa</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black bg-[#C4F0EB]'>Predikat Raport</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black bg-[#FFE8DC]'>Poin Bersih</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black'>Positif / Negatif</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Sumber Poin (Dari mana saja)</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase w-32'>Aksi</th>
													</tr>
												</thead>
												<tbody className='divide-y-[3px] divide-black'>
													{filteredPerilakuSiswa.map((siswa, idx) => {
														const isExpanded = expandedSiswaId === siswa.id;
														return (
															<Fragment key={siswa.id}>
																<tr className='hover:bg-gray-100 transition-colors'>
																	<td className='px-4 py-3 font-black text-black border-r-[3px] border-black text-center'>{idx + 1}</td>
																	<td className='px-6 py-3 font-black text-black border-r-[3px] border-black'>
																		<div className='text-sm'>{siswa.nama_lengkap}</div>
																		<div className='text-[10px] font-mono text-gray-600'>NIS: {siswa.nis}</div>
																	</td>
																	<td className='px-4 py-3 text-center border-r-[3px] border-black bg-[#C4F0EB]/30'>
																		<span className={`inline-block px-3 py-1 text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${siswa.predikatSikap.badgeClass}`}>
																			{siswa.predikatSikap.predikat} — {siswa.predikatSikap.label}
																		</span>
																	</td>
																	<td className='px-4 py-3 text-center border-r-[3px] border-black bg-[#FFE8DC]/30'>
																		<span className={`inline-block px-3 py-1 text-sm font-black border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#0D0D0D] ${siswa.totalPoinBersih >= 0 ? 'bg-[#00A693] text-white' : 'bg-[#E8451A] text-white'}`}>
																			{siswa.totalPoinBersih > 0 ? `+${siswa.totalPoinBersih}` : siswa.totalPoinBersih} pts
																		</span>
																	</td>
																	<td className='px-4 py-3 text-center border-r-[3px] border-black font-black text-xs'>
																		<div className='flex items-center justify-center gap-2'>
																			<span className='text-[#00A693] bg-[#C4F0EB] px-2 py-0.5 rounded border border-black font-black'>+{siswa.poinPositif}</span>
																			<span className='text-[#E8451A] bg-[#FFD6D6] px-2 py-0.5 rounded border border-black font-black'>-{siswa.poinNegatif}</span>
																		</div>
																	</td>
																	<td className='px-6 py-3 border-r-[3px] border-black'>
																		{siswa.poinList.length === 0 ? (
																			<span className='text-xs text-gray-400 italic font-bold'>Belum ada catatan poin</span>
																		) : (
																			<div className='flex flex-wrap gap-1.5'>
																				{siswa.poinList.slice(0, 3).map((p) => (
																					<span
																						key={p.id}
																						className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 border border-black rounded shadow-[1px_1px_0px_0px_#0D0D0D] ${
																							p.tipe === 'positif' ? 'bg-[#C4F0EB] text-[#00A693]' : 'bg-[#FFD6D6] text-[#E8451A]'
																						}`}>
																						<span>{p.tipe === 'positif' ? '🏆' : '⚠️'}</span>
																						<span className='truncate max-w-[140px]' title={p.aktifitas}>{p.aktifitas}</span>
																						<span>({p.tipe === 'positif' ? `+${p.poin}` : `-${p.poin}`})</span>
																					</span>
																				))}
																				{siswa.poinList.length > 3 && (
																					<span className='text-[10px] font-black text-gray-600 bg-gray-100 px-1.5 py-0.5 border border-black rounded'>
																						+{siswa.poinList.length - 3} lainnya
																					</span>
																				)}
																			</div>
																		)}
																	</td>
																	<td className='px-4 py-3 text-center'>
																		<button
																			onClick={() => setExpandedSiswaId(isExpanded ? null : siswa.id)}
																			className='bg-white text-black hover:bg-[#F5C518] border-2 border-black px-2.5 py-1 text-xs font-black uppercase rounded shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] transition-all whitespace-nowrap'>
																			{isExpanded ? 'Tutup ▲' : `Rincian (${siswa.jumlahCatatan}) ▼`}
																		</button>
																	</td>
																</tr>

																{/* EXPANDABLE ROW RINCIAN DETAIL POIN */}
																{isExpanded && (
																	<tr className='bg-[#FFF9F5]'>
																		<td colSpan={7} className='p-4 border-b-[3px] border-black'>
																			<div className='bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
																				<div className='flex items-center justify-between pb-3 mb-3 border-b-2 border-dashed border-black'>
																					<div>
																						<h5 className='text-sm font-black uppercase text-black'>
																							Riwayat Sumber Poin: {siswa.nama_lengkap} (NIS: {siswa.nis})
																						</h5>
																						<p className='text-xs text-gray-600 font-bold'>
																							Total {siswa.jumlahCatatan} catatan ({siswa.poinPositif > 0 ? `+${siswa.poinPositif} poin positif` : ''}{siswa.poinPositif > 0 && siswa.poinNegatif > 0 ? ', ' : ''}{siswa.poinNegatif > 0 ? `-${siswa.poinNegatif} poin pelanggaran` : ''})
																						</p>
																					</div>
																					<button
																						onClick={() => setExpandedSiswaId(null)}
																						className='text-xs font-black text-black bg-[#FFE8DC] hover:bg-[#E8451A] hover:text-white px-2 py-1 border border-black rounded transition-colors'>
																						✕ Tutup Rincian
																					</button>
																				</div>

																				{siswa.poinList.length === 0 ? (
																					<p className='text-xs font-bold text-gray-500 py-3 text-center'>Tidak ada rincian kejadian tercatat untuk siswa ini.</p>
																				) : (
																					<div className='overflow-x-auto'>
																						<table className='w-full text-xs text-left border-collapse'>
																							<thead className='bg-[#F5C518] border-b-2 border-black font-black uppercase'>
																								<tr>
																									<th className='p-2 border-r border-black w-10 text-center'>No</th>
																									<th className='p-2 border-r border-black w-24'>Tanggal</th>
																									<th className='p-2 border-r border-black w-24 text-center'>Tipe</th>
																									<th className='p-2 border-r border-black w-32'>Kategori</th>
																									<th className='p-2 border-r border-black'>Aktivitas / Perilaku</th>
																									<th className='p-2 border-r border-black w-20 text-center'>Poin</th>
																									<th className='p-2'>Keterangan Guru</th>
																								</tr>
																							</thead>
																							<tbody className='divide-y border-b-2 border-black'>
																								{siswa.poinList.map((item, pIdx) => (
																									<tr key={item.id || pIdx} className='hover:bg-amber-50'>
																										<td className='p-2 border-r border-black text-center font-bold'>{pIdx + 1}</td>
																										<td className='p-2 border-r border-black font-mono font-bold'>{new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
																										<td className='p-2 border-r border-black text-center'>
																											<span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border border-black ${item.tipe === 'positif' ? 'bg-[#C4F0EB] text-[#00A693]' : 'bg-[#FFD6D6] text-[#E8451A]'}`}>
																												{item.tipe === 'positif' ? 'Positif' : 'Pelanggaran'}
																											</span>
																										</td>
																										<td className='p-2 border-r border-black font-bold text-gray-700'>{item.kategori || '-'}</td>
																										<td className='p-2 border-r border-black font-black text-black'>{item.aktifitas}</td>
																										<td className='p-2 border-r border-black text-center font-black'>
																											<span className={item.tipe === 'positif' ? 'text-[#00A693]' : 'text-[#E8451A]'}>
																												{item.tipe === 'positif' ? `+${item.poin}` : `-${item.poin}`}
																											</span>
																										</td>
																										<td className='p-2 text-gray-600 font-medium italic'>{item.keterangan || '-'}</td>
																									</tr>
																								))}
																							</tbody>
																						</table>
																					</div>
																				)}
																			</div>
																		</td>
																	</tr>
																)}
															</Fragment>
														);
													})}
												</tbody>
											</table>
										)}
									</div>
								)}

								{/* VIEW 2: LOG LENGKAP KELAS */}
								{perilakuViewMode === 'log' && (
									<div className='overflow-x-auto'>
										{filteredPerilakuLog.length === 0 ? (
											<div className='p-12 text-center text-black font-black uppercase text-sm'>
												Tidak ada catatan log poin untuk filter ini
											</div>
										) : (
											<table className='w-full min-w-[850px]'>
												<thead className='bg-[#F5C518] border-b-[4px] border-black'>
													<tr>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-16'>No</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black w-32'>Tanggal</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Nama Siswa</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-28'>Tipe</th>
														<th className='px-4 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black w-36'>Kategori</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase border-r-[3px] border-black'>Aktivitas</th>
														<th className='px-4 py-4 text-center text-sm font-black text-black uppercase border-r-[3px] border-black w-24'>Poin</th>
														<th className='px-6 py-4 text-left text-sm font-black text-black uppercase'>Keterangan</th>
													</tr>
												</thead>
												<tbody className='divide-y-[3px] divide-black'>
													{filteredPerilakuLog.map((item, idx) => {
														const s = siswaList.find((sw) => String(sw.id) === String(item.siswa_id));
														const isPos = item.tipe === 'positif';
														return (
															<tr key={item.id || idx} className='hover:bg-gray-100 transition-colors'>
																<td className='px-4 py-3 font-black text-black border-r-[3px] border-black text-center'>{idx + 1}</td>
																<td className='px-6 py-3 font-bold font-mono text-xs text-black border-r-[3px] border-black'>
																	{new Date(item.tanggal).toLocaleDateString('id-ID')}
																</td>
																<td className='px-6 py-3 font-black text-black border-r-[3px] border-black'>
																	{s?.nama_lengkap || 'Siswa Unknown'}
																	<div className='text-[10px] font-mono text-gray-500'>NIS: {s?.nis || '-'}</div>
																</td>
																<td className='px-4 py-3 text-center border-r-[3px] border-black'>
																	<span className={`inline-block px-2.5 py-0.5 text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${isPos ? 'bg-[#C4F0EB] text-[#00A693]' : 'bg-[#FFD6D6] text-[#E8451A]'}`}>
																		{isPos ? '🏆 Positif' : '⚠️ Minus'}
																	</span>
																</td>
																<td className='px-4 py-3 text-xs font-bold text-gray-700 border-r-[3px] border-black'>{item.kategori || '-'}</td>
																<td className='px-6 py-3 font-black text-black border-r-[3px] border-black'>{item.aktifitas}</td>
																<td className='px-4 py-3 text-center font-black border-r-[3px] border-black text-sm'>
																	<span className={isPos ? 'text-[#00A693]' : 'text-[#E8451A]'}>
																		{isPos ? `+${item.poin}` : `-${item.poin}`}
																	</span>
																</td>
																<td className='px-6 py-3 text-xs font-medium text-gray-600 italic'>{item.keterangan || '-'}</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										)}
									</div>
								)}

								{/* Keterangan Nilai Sikap Raport */}
								<div className='p-6 bg-[#FFF5F0] border-t-[4px] border-black'>
									<div className='bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
										<h4 className='text-xs font-black uppercase tracking-wider text-black mb-3 flex items-center justify-between'>
											<span>Pedoman Predikat Sikap Raport (Berdasarkan Akumulasi Poin)</span>
											<span className='text-[10px] text-gray-500 font-bold'>Standar Kurikulum</span>
										</h4>
										<div className='flex flex-wrap gap-4 text-xs font-bold'>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-emerald-100 text-emerald-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>A</span>
												<span className='text-black'>Sangat Baik (≥ +50 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-blue-100 text-blue-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>B</span>
												<span className='text-black'>Baik (+10 s/d +49 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-amber-100 text-amber-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>C</span>
												<span className='text-black'>Cukup (-9 s/d +9 poin)</span>
											</div>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-0.5 border-2 border-black bg-rose-100 text-rose-800 font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>D</span>
												<span className='text-black'>Perlu Bimbingan (≤ -10 poin)</span>
											</div>
										</div>
									</div>
								</div>
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
												<td className='px-6 py-3 text-sm font-black text-black border-r-[3px] border-black w-48'>
													<div>{new Date(row.tanggal).toLocaleDateString('id-ID')}</div>
													<div className='text-[10px] font-mono text-gray-600 font-bold mt-0.5'>
														Jam ke-{row.jam_ke || '-'}
													</div>
													{row.jam_mulai && row.jam_selesai && (
														<div className='text-[10px] font-black text-[#007A6C] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-400 mt-1 w-fit'>
															🕒 {row.jam_mulai.slice(0, 5)} - {row.jam_selesai.slice(0, 5)} ({formatDurationString(row.durasi_menit || calculateDurationMinutes(row.jam_mulai, row.jam_selesai))})
														</div>
													)}
													{row.status_kehadiran && row.status_kehadiran !== 'Normal' && (
														(() => {
															const b = getKBMStatusBadge(row.status_kehadiran);
															return (
																<span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded border mt-1 ${b.border} ${b.bg} ${b.text}`}>
																	{b.icon} {b.label}
																</span>
															);
														})()
													)}
												</td>
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
