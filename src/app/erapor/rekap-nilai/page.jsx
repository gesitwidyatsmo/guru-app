'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
	FileSpreadsheet,
	Download,
	Save,
	Loader2,
	Search,
	Info,
	Sliders,
	ArrowRight,
	TrendingUp,
	CheckCircle2,
	RotateCcw,
	HelpCircle,
	Users,
	AlertCircle,
} from 'lucide-react';
import Loader from '@/app/components/loading';

// Komponen Tooltip Edukatif untuk Penjelasan Parameter Konversi Nilai
function CardInfoTooltip({ title, description, side = 'right' }) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className='relative inline-flex items-center'>
			<button
				type='button'
				onClick={() => setIsOpen((prev) => !prev)}
				onMouseEnter={() => setIsOpen(true)}
				onMouseLeave={() => setIsOpen(false)}
				className='p-1 text-gray-400 hover:text-black focus:outline-none transition-colors cursor-pointer rounded-full hover:bg-gray-200/60'
				aria-label={`Informasi ${title}`}
				title={`Informasi ${title}`}>
				<HelpCircle className='w-3.5 h-3.5' />
			</button>

			{isOpen && (
				<div
					onMouseEnter={() => setIsOpen(true)}
					onMouseLeave={() => setIsOpen(false)}
					className={`absolute z-50 w-60 sm:w-64 p-3 bg-neutral-900 text-white rounded-xl shadow-[3px_3px_0px_0px_#00A693] border-2 border-black text-left pointer-events-auto transition-all ${
						side === 'left'
							? 'left-0 top-7 origin-top-left'
							: 'right-0 top-7 origin-top-right'
					}`}>
					<div className='flex items-center gap-1.5 text-amber-300 font-black text-[11px] uppercase tracking-wider mb-1'>
						<Info className='w-3.5 h-3.5 shrink-0 text-amber-300' />
						<span>{title}</span>
					</div>
					<p className='text-gray-200 font-medium text-[11px] leading-relaxed'>
						{description}
					</p>
				</div>
			)}
		</div>
	);
}

export default function RekapNilaiPage() {
	const [allKelasList, setAllKelasList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');
	const [selectedMapelId, setSelectedMapelId] = useState('');

	// Periode Akademik
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	// Data Nilai & Siswa
	const [students, setStudents] = useState([]);
	const [nilaiList, setNilaiList] = useState([]);
	const [kkm, setKkm] = useState(75);
	const [kkmSource, setKkmSource] = useState('Standar Sekolah');

	// State UI
	const [loading, setLoading] = useState(true);
	const [loadingKelas, setLoadingKelas] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// State Bobot Nilai
	const [calcMethod, setCalcMethod] = useState('persentase'); // 'persentase' | 'sederhana'
	const [bobot, setBobot] = useState({
		harian: 50,
		sumatif: 25,
		uas: 25,
	});

	// State Konversi Nilai
	const [convertConfig, setConvertConfig] = useState({
		useConversion: false,
		ncMin: 0,
		ncMax: 100,
		nhMin: 75,
		nhMax: 95,
	});

	// State Override Nilai Konversi Manual per Siswa { [siswaId]: number | '' }
	const [customConverts, setCustomConverts] = useState({});

	// Handler helper untuk input parameter konversi (bisa kosong saat edit & otomatis hilangkan leading zero)
	const handleConvertConfigChange = (field, rawValue) => {
		if (rawValue === '') {
			setConvertConfig((prev) => ({ ...prev, [field]: '' }));
			return;
		}
		let clean = String(rawValue);
		if (clean.length > 1 && clean.startsWith('0') && !clean.startsWith('0.')) {
			clean = clean.replace(/^0+/, '');
		}
		const parsed = parseFloat(clean);
		setConvertConfig((prev) => ({
			...prev,
			[field]: isNaN(parsed) ? '' : parsed,
		}));
	};

	const handleConvertConfigBlur = (field, fallbackVal = 0) => {
		setConvertConfig((prev) => {
			if (prev[field] === '' || prev[field] === null || prev[field] === undefined) {
				return { ...prev, [field]: fallbackVal };
			}
			return prev;
		});
	};

	// --- 1. Fetch Master Mapel, Kelas & Tahun Ajar ---
	useEffect(() => {
		async function fetchMaster() {
			try {
				const [resMapel, resKelas, resTahun] = await Promise.all([
					fetch('/api/mapel?only_kbm=true'),
					fetch('/api/kelas?only_kbm=true'),
					fetch('/api/tahun-ajar'),
				]);

				let initialMapel = [];
				let initialKelas = [];

				if (resMapel.ok) {
					initialMapel = (await resMapel.json()) || [];
					setMapelList(initialMapel);
				}
				if (resKelas.ok) {
					initialKelas = (await resKelas.json()) || [];
					setAllKelasList(initialKelas);
				}

				if (resTahun.ok) {
					const dataT = await resTahun.json();
					const aktif = dataT.find((t) => t.is_aktif) || dataT[0];
					if (aktif) {
						setTahunAjaran(aktif.nama || '2026/2027');
						setSemester(aktif.semester || 1);
					}
				}

				// Check URL search params for deep linking from dashboard
				let targetMapelId = '';
				let targetKelasId = '';
				if (typeof window !== 'undefined') {
					const params = new URLSearchParams(window.location.search);
					targetMapelId = params.get('mapel_id') || '';
					targetKelasId = params.get('kelas_id') || '';
				}

				const activeMapelId = targetMapelId && initialMapel.some((m) => m.id === targetMapelId)
					? targetMapelId
					: initialMapel[0]?.id || '';
				setSelectedMapelId(activeMapelId);

				const activeMapelObj = initialMapel.find((m) => m.id === activeMapelId);
				let initialFilteredKelas = initialKelas;
				if (activeMapelObj?.kelas_list && activeMapelObj.kelas_list.length > 0) {
					const matched = initialKelas.filter((k) =>
						activeMapelObj.kelas_list.includes(k.kelas || k.nama_kelas)
					);
					if (matched.length > 0) initialFilteredKelas = matched;
				}
				setKelasList(initialFilteredKelas);

				if (targetKelasId && initialFilteredKelas.some((k) => k.id === targetKelasId)) {
					setSelectedKelasId(targetKelasId);
				} else if (initialFilteredKelas.length > 0) {
					setSelectedKelasId(initialFilteredKelas[0].id);
				}
			} catch (err) {
				console.error('Error fetching master data:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchMaster();
	}, []);

	// --- 2. Handler pergantian mapel secara sinkron & instan ---
	const handleMapelChange = useCallback((newMapelId) => {
		setSelectedMapelId(newMapelId);
		const targetMapel = mapelList.find((m) => m.id === newMapelId);
		let filtered = allKelasList;
		if (targetMapel?.kelas_list && targetMapel.kelas_list.length > 0) {
			const matched = allKelasList.filter((k) =>
				targetMapel.kelas_list.includes(k.kelas || k.nama_kelas)
			);
			if (matched.length > 0) filtered = matched;
		}
		setKelasList(filtered);

		// Otomatis pilih kelas pertama dari rombel mapel baru jika kelas lama tidak relevan
		setSelectedKelasId((prev) => {
			const isStillValid = filtered.some((k) => k.id === prev);
			return isStillValid ? prev : (filtered[0]?.id || '');
		});
	}, [mapelList, allKelasList]);

	// --- 3. Fetch Rekapitulasi Data Nilai ---
	const fetchRekapData = useCallback(async () => {
		if (!selectedKelasId || !selectedMapelId) {
			setStudents([]);
			setNilaiList([]);
			return;
		}

		// Safety Guard: Cegah pengiriman request jika kombinasi mapel & kelas belum sinkron
		const currentMapel = mapelList.find((m) => m.id === selectedMapelId);
		if (currentMapel?.kelas_list && currentMapel.kelas_list.length > 0) {
			const currentKelas = allKelasList.find((k) => k.id === selectedKelasId);
			const namaKls = currentKelas?.kelas || currentKelas?.nama_kelas;
			if (namaKls && !currentMapel.kelas_list.includes(namaKls)) {
				return; // Tahan request hingga transisi selesai
			}
		}

		try {
			setLoading(true);
			const url = `/api/erapor/rekap-nilai?kelas_id=${selectedKelasId}&mapel_id=${selectedMapelId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setStudents(json.students || []);
				setNilaiList(json.nilai_list || []);
				setCustomConverts({});
				if (json.kkm) {
					setKkm(json.kkm);
					// Set default target min konversi ke nilai KKM jika belum diubah
					setConvertConfig((prev) => ({
						...prev,
						nhMin: json.kkm,
					}));
				}
				if (json.kkm_source) setKkmSource(json.kkm_source);
			} else {
				const errJson = await res.json().catch(() => ({}));
				Swal.fire({
					icon: 'warning',
					title: 'Perhatian',
					text: errJson.error || 'Gagal memuat rekap nilai.',
				});
				setStudents([]);
				setNilaiList([]);
			}
		} catch (err) {
			console.error('Error fetching rekap data:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, selectedMapelId, semester, tahunAjaran, mapelList, allKelasList]);

	useEffect(() => {
		fetchRekapData();
	}, [fetchRekapData]);

	// --- 4. Kategorisasi Tugas & Pengelompokan Skor ---
	const assignments = useMemo(() => {
		const groups = {};
		nilaiList.forEach((n) => {
			if (!groups[n.tugas_id]) {
				groups[n.tugas_id] = {
					id: n.tugas_id,
					title: n.kategori || 'Tanpa Judul',
					date: n.tanggal,
					scores: [],
					type: 'harian',
				};

				const typeLower = (n.type || '').toLowerCase();
				const titleLower = (n.kategori || '').toLowerCase();

				if (typeLower === 'sas' || typeLower === 'uas' || typeLower === 'pas') {
					groups[n.tugas_id].type = 'uas';
				} else if (typeLower === 'sumatif' || typeLower === 'pts' || typeLower === 'uts' || typeLower === 'sts') {
					groups[n.tugas_id].type = 'sumatif';
				} else if (typeLower === 'formatif' || typeLower === 'harian' || typeLower === 'tugas' || typeLower === 'kuis') {
					groups[n.tugas_id].type = 'harian';
				} else {
					if (titleLower.includes('sas') || titleLower.includes('uas') || titleLower.includes('akhir semester') || titleLower.includes('pas')) {
						groups[n.tugas_id].type = 'uas';
					} else if (titleLower.includes('sumatif') || titleLower.includes('pts') || titleLower.includes('uts') || titleLower.includes('tengah semester')) {
						groups[n.tugas_id].type = 'sumatif';
					} else {
						groups[n.tugas_id].type = 'harian';
					}
				}
			}
			groups[n.tugas_id].scores.push({
				siswa_id: n.siswa_id,
				nilai: n.nilai,
			});
		});

		const list = Object.values(groups);
		return {
			harian: list.filter((a) => a.type === 'harian'),
			sumatif: list.filter((a) => a.type === 'sumatif'),
			uas: list.filter((a) => a.type === 'uas'),
			all: list,
		};
	}, [nilaiList]);

	// --- 5. Perhitungan Nilai Siswa (Formatif, Sumatif, SAS, Akhir, & Konversi) ---
	const studentGrades = useMemo(() => {
		return students.map((siswa) => {
			const getAvg = (assignList) => {
				if (!assignList || assignList.length === 0) return null;
				let total = 0;
				let count = 0;
				assignList.forEach((a) => {
					const scoreObj = a.scores.find((s) => s.siswa_id === siswa.siswa_id);
					if (scoreObj && scoreObj.nilai !== null && scoreObj.nilai !== undefined && !isNaN(scoreObj.nilai)) {
						total += Number(scoreObj.nilai);
						count++;
					}
				});
				return count > 0 ? total / count : null;
			};

			const nilaiHarian = getAvg(assignments.harian);
			const nilaiSumatif = getAvg(assignments.sumatif);
			const nilaiUAS = getAvg(assignments.uas);

			// Hitung Nilai Akhir Asli
			let finalOrig = 0;
			if (calcMethod === 'sederhana') {
				let totalScore = 0;
				let totalCount = 0;
				if (nilaiHarian !== null) { totalScore += nilaiHarian; totalCount++; }
				if (nilaiSumatif !== null) { totalScore += nilaiSumatif; totalCount++; }
				if (nilaiUAS !== null) { totalScore += nilaiUAS; totalCount++; }
				finalOrig = totalCount > 0 ? totalScore / totalCount : 0;
			} else {
				// Bobot Persentase
				const h = (nilaiHarian || 0) * (bobot.harian / 100);
				const s = (nilaiSumatif || 0) * (bobot.sumatif / 100);
				const u = (nilaiUAS || 0) * (bobot.uas / 100);
				finalOrig = h + s + u;
			}

			// Hitung Konversi Nilai
			let finalConvert = finalOrig;
			if (convertConfig.useConversion) {
				const { ncMin, ncMax, nhMin, nhMax } = convertConfig;
				if (ncMax - ncMin !== 0) {
					finalConvert = nhMin + ((finalOrig - ncMin) / (ncMax - ncMin)) * (nhMax - nhMin);
					finalConvert = Math.min(100, Math.max(0, finalConvert));
				}
			}

			return {
				...siswa,
				harian: nilaiHarian,
				sumatif: nilaiSumatif,
				uas: nilaiUAS,
				finalOrig: parseFloat(finalOrig.toFixed(2)),
				finalConvert: parseFloat(finalConvert.toFixed(2)),
			};
		});
	}, [students, assignments, bobot, convertConfig, calcMethod]);

	// --- 6. Statistik Aktual Min & Max ---
	const actualStats = useMemo(() => {
		if (!studentGrades || studentGrades.length === 0) return { min: 0, max: 100 };
		const scores = studentGrades.map((s) => s.finalOrig).filter((sc) => !isNaN(sc));
		if (scores.length === 0) return { min: 0, max: 100 };

		const min = Math.min(...scores);
		const max = Math.max(...scores);

		return {
			min: Number.isFinite(min) ? parseFloat(min.toFixed(1)) : 0,
			max: Number.isFinite(max) ? parseFloat(max.toFixed(1)) : 100,
		};
	}, [studentGrades]);

	// Preset Rentang Aktual untuk Konversi
	const applyActualRangePreset = () => {
		setConvertConfig((prev) => ({
			...prev,
			useConversion: true,
			ncMin: actualStats.min,
			ncMax: actualStats.max,
			nhMin: kkm || 75,
			nhMax: 95,
		}));
	};

	// Otomatis sinkronkan Rentang Aktual ke konfigurasi konversi ketika data kelas/mapel selesai dimuat
	const lastSyncedClassMapel = useRef('');
	useEffect(() => {
		const key = `${selectedKelasId}_${selectedMapelId}`;
		if (studentGrades.length > 0 && actualStats.min !== undefined && lastSyncedClassMapel.current !== key) {
			lastSyncedClassMapel.current = key;
			setConvertConfig((prev) => ({
				...prev,
				ncMin: actualStats.min,
				ncMax: actualStats.max,
				nhMin: kkm || prev.nhMin || 75,
				nhMax: prev.nhMax || 95,
			}));
		}
	}, [selectedKelasId, selectedMapelId, studentGrades.length, actualStats.min, actualStats.max, kkm]);

	// --- 7. Download Excel (XLSX) ---
	const handleDownloadExcel = () => {
		if (!studentGrades || studentGrades.length === 0) {
			Swal.fire('Info', 'Tidak ada data untuk diunduh.', 'info');
			return;
		}

		const currentKelas = kelasList.find((k) => k.id === selectedKelasId);
		const currentMapel = mapelList.find((m) => m.id === selectedMapelId);
		const namaKelas = currentKelas?.kelas || currentKelas?.nama_kelas || 'Kelas';
		const namaMapel = currentMapel?.mapel || 'Mapel';

		const dataToExport = studentGrades.map((s, idx) => {
			const row = {
				No: idx + 1,
				Nama: s.nama_lengkap,
				NIS: s.nis || '-',
				'Formatif (Harian)': s.harian !== null ? s.harian.toFixed(1) : '-',
				'Sumatif (Bab/STS)': s.sumatif !== null ? s.sumatif.toFixed(1) : '-',
				'SAS (Akhir Semester)': s.uas !== null ? s.uas.toFixed(1) : '-',
				'Poin Positif (+)': s.poinPositif || 0,
				'Poin Negatif (-)': s.poinNegatif || 0,
				'Nilai Akhir (Asli)': s.finalOrig,
			};

			if (convertConfig.useConversion) {
				const val =
					customConverts[s.siswa_id] !== undefined && customConverts[s.siswa_id] !== ''
						? Number(customConverts[s.siswa_id])
						: s.finalConvert;
				row['Nilai Konversi (Rapor)'] = val;
			}

			row['Status Rapor Kuantitatif'] =
				s.rapor_nilai_kuantitatif !== null ? `Tersimpan (${s.rapor_nilai_kuantitatif})` : 'Belum Ada';

			return row;
		});

		const ws = XLSX.utils.json_to_sheet(dataToExport);
		const wscols = [
			{ wch: 5 },  // No
			{ wch: 30 }, // Nama
			{ wch: 14 }, // NIS
			{ wch: 16 }, // Formatif
			{ wch: 16 }, // Sumatif
			{ wch: 18 }, // SAS
			{ wch: 14 }, // Pt +
			{ wch: 14 }, // Pt -
			{ wch: 16 }, // Akhir Asli
		];
		if (convertConfig.useConversion) {
			wscols.push({ wch: 18 }); // Konversi
		}
		wscols.push({ wch: 22 }); // Status Rapor
		ws['!cols'] = wscols;

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai');

		const fileName = `Rekap_Nilai_${namaKelas}_${namaMapel}_Sem${semester}.xlsx`.replace(/[^a-zA-Z0-9._-]/g, '_');
		XLSX.writeFile(wb, fileName);
	};

	// --- 8. Terapkan ke Nilai Kuantitatif Rapor (Sync to Database) ---
	const handleApplyToKuantitatif = async () => {
		if (!selectedKelasId || !selectedMapelId) {
			Swal.fire('Peringatan', 'Pilih kelas dan mata pelajaran terlebih dahulu', 'warning');
			return;
		}

		if (studentGrades.length === 0) {
			Swal.fire('Peringatan', 'Tidak ada data siswa untuk disinkronkan', 'warning');
			return;
		}

		const nilaiYangDigunakan = convertConfig.useConversion ? 'Nilai Konversi' : 'Nilai Akhir (Asli)';

		const confirmResult = await Swal.fire({
			title: 'Terapkan ke Nilai Kuantitatif?',
			html: `
				<div class="text-left text-xs space-y-2 text-gray-700">
					<p>Hasil perhitungan nilai akan langsung disimpan ke modul <b>Nilai Kuantitatif E-Rapor</b> untuk seluruh siswa di kelas ini.</p>
					<div class="p-2.5 bg-yellow-50 border-2 border-black rounded-lg">
						<div>• Nilai yang diterapkan: <b class="text-black uppercase underline">${nilaiYangDigunakan}</b></div>
						<div>• Total Siswa: <b class="text-black">${studentGrades.length} Siswa</b></div>
						<div>• Acuan KKM: <b class="text-black">${kkm}</b></div>
					</div>
					<p class="text-[11px] text-gray-500 italic">Nilai yang tersimpan dapat Anda tinjau dan edit kembali pada menu Nilai Kuantitatif.</p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'Ya, Terapkan Sekarang',
			cancelButtonText: 'Batal',
			didOpen: () => {
				const confirmBtn = Swal.getConfirmButton();
				if (confirmBtn) {
					confirmBtn.style.setProperty('background-color', '#F5C518', 'important');
					confirmBtn.style.setProperty('color', '#000000', 'important');
					confirmBtn.style.setProperty('border', '2px solid #000000', 'important');
					confirmBtn.style.setProperty('font-weight', '900', 'important');
					confirmBtn.style.setProperty('box-shadow', '4px 4px 0px 0px #000000', 'important');
					confirmBtn.onmouseenter = () => {
						confirmBtn.style.setProperty('background-color', '#e5b515', 'important');
					};
					confirmBtn.onmouseleave = () => {
						confirmBtn.style.setProperty('background-color', '#F5C518', 'important');
					};
				}
				const cancelBtn = Swal.getCancelButton();
				if (cancelBtn) {
					cancelBtn.style.setProperty('background-color', '#F3F4F6', 'important');
					cancelBtn.style.setProperty('color', '#000000', 'important');
					cancelBtn.style.setProperty('border', '2px solid #000000', 'important');
					cancelBtn.style.setProperty('font-weight', '800', 'important');
					cancelBtn.style.setProperty('box-shadow', '4px 4px 0px 0px #000000', 'important');
					cancelBtn.onmouseenter = () => {
						cancelBtn.style.setProperty('background-color', '#E5E7EB', 'important');
					};
					cancelBtn.onmouseleave = () => {
						cancelBtn.style.setProperty('background-color', '#F3F4F6', 'important');
					};
				}
			},
		});

		if (!confirmResult.isConfirmed) return;

		try {
			setSaving(true);
			const gradesPayload = studentGrades.map((s) => {
				const finalVal = convertConfig.useConversion
					? customConverts[s.siswa_id] !== undefined && customConverts[s.siswa_id] !== ''
						? Number(customConverts[s.siswa_id])
						: s.finalConvert
					: s.finalOrig;

				return {
					siswa_id: s.siswa_id,
					nilai_akhir: Math.round(finalVal),
				};
			});

			const res = await fetch('/api/erapor/rekap-nilai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					mapel_id: selectedMapelId,
					semester,
					tahun_ajaran: tahunAjaran,
					grades: gradesPayload,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menerapkan nilai ke rapor');

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil Diterapkan!',
				text: `${json.updated_count || studentGrades.length} nilai siswa telah berhasil disimpan ke modul Nilai Kuantitatif Rapor.`,
				confirmButtonColor: '#00A693',
			});

			// Refresh data rekap agar badge status tersinkron terupdate
			fetchRekapData();
		} catch (err) {
			console.error('Error applying grades to kuantitatif:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menerapkan',
				text: err.message,
			});
		} finally {
			setSaving(false);
		}
	};

	// Filter Search Siswa
	const filteredStudents = useMemo(() => {
		if (!searchQuery.trim()) return studentGrades;
		const q = searchQuery.toLowerCase();
		return studentGrades.filter(
			(s) => s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q))
		);
	}, [studentGrades, searchQuery]);

	const totalBobot = bobot.harian + bobot.sumatif + bobot.uas;

	return (
		<div className='space-y-6'>
			{/* Page Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<FileSpreadsheet className='w-6 h-6 text-[#00A693]' />
						<span>Rekap & Konversi Nilai Mapel</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Agregasi nilai tugas harian (Formatif, Sumatif, SAS), integrasi poin perilaku, serta simulasi konversi nilai akhir menuju E-Rapor.
					</p>
				</div>
				<div className='flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap'>
					<button
						type='button'
						onClick={handleDownloadExcel}
						disabled={loading || students.length === 0}
						className='flex-1 sm:flex-initial px-4 py-2.5 bg-[#A3E635] hover:bg-[#86efac] text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer'
						title='Unduh rekap nilai ke format Excel'>
						<Download className='w-4 h-4 text-black' />
						<span>Download Excel</span>
					</button>

					<button
						type='button'
						onClick={handleApplyToKuantitatif}
						disabled={saving || loading || students.length === 0}
						className='flex-1 sm:flex-initial px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer'
						title='Simpan hasil rekap/konversi ke modul Nilai Kuantitatif Rapor'>
						{saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
						<span>{saving ? 'Menerapkan...' : 'Terapkan ke Nilai Rapor'}</span>
					</button>

					<Link
						href='/erapor/nilai-kuantitatif'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-100 text-black font-bold text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 transition-all'
						title='Buka halaman Nilai Kuantitatif'>
						<span>Nilai Kuantitatif</span>
						<ArrowRight className='w-3.5 h-3.5' />
					</Link>
				</div>
			</div>

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Merekap tugas harian dan data nilai siswa...</p>
					<p className='text-xs font-bold text-gray-500'>Mengkonsolidasikan Formatif, Sumatif, SAS, poin siswa, dan acuan KKTP</p>
				</div>
			) : (
				<>
					{/* Filter Bar */}
					<div className='p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
						<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
							{/* Dropdown Mapel */}
							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-600'>Mapel:</span>
								{mapelList.length === 0 ? (
									<span className='text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 border border-black rounded-lg'>
										Tidak ada mapel ajar
									</span>
								) : (
									<select
										value={selectedMapelId}
										onChange={(e) => handleMapelChange(e.target.value)}
										className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold max-w-xs cursor-pointer'>
										{mapelList.map((m) => (
											<option key={m.id} value={m.id}>
												{m.mapel}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Dropdown Kelas */}
							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-600'>Kelas:</span>
								{loadingKelas ? (
									<span className='text-xs font-bold text-gray-500'>Memuat kelas...</span>
								) : kelasList.length === 0 ? (
									<span className='text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 border border-black rounded-lg'>
										Tidak ada rombel untuk mapel ini
									</span>
								) : (
									<select
										value={selectedKelasId}
										onChange={(e) => setSelectedKelasId(e.target.value)}
										className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
										{kelasList.map((k) => (
											<option key={k.id} value={k.id}>
												{k.kelas || k.nama_kelas}
											</option>
										))}
									</select>
								)}
							</div>

							<span className='px-2.5 py-1 bg-gray-100 text-black border border-black rounded-lg text-xs font-black'>
								Semester {semester} • {tahunAjaran} • KKM: {kkm}
							</span>
						</div>

						{/* Search Input */}
						<div className='relative w-full sm:w-64'>
							<Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
							<input
								type='text'
								placeholder='Cari nama siswa...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:bg-yellow-50'
							/>
						</div>
					</div>

					{/* Pengaturan Bobot & Konversi Nilai Grid */}
					<div className='grid grid-cols-1 lg:grid-cols-12 gap-5'>
						{/* Card 1: Pengaturan Bobot Penilaian (5 Cols) */}
						<div className='lg:col-span-5 bg-white p-5 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
							<div className='flex items-center justify-between border-b-2 border-black pb-3'>
								<div className='flex items-center gap-2'>
									<Sliders className='w-5 h-5 text-amber-500' />
									<h3 className='font-black text-black text-sm uppercase'>Pengaturan Formula Nilai</h3>
								</div>
								<div className='flex border-2 border-black rounded-lg overflow-hidden text-xs font-black'>
									<button
										type='button'
										onClick={() => setCalcMethod('persentase')}
										className={`px-2.5 py-1 transition-colors ${
											calcMethod === 'persentase'
												? 'bg-black text-white'
												: 'bg-white text-black hover:bg-gray-100'
										}`}>
										Bobot %
									</button>
									<button
										type='button'
										onClick={() => setCalcMethod('sederhana')}
										className={`px-2.5 py-1 border-l-2 border-black transition-colors ${
											calcMethod === 'sederhana'
												? 'bg-black text-white'
												: 'bg-white text-black hover:bg-gray-100'
										}`}>
										Rata-Rata
									</button>
								</div>
							</div>

							{calcMethod === 'persentase' ? (
								<div className='space-y-3.5'>
									{/* Formatif */}
									<div className='p-3 bg-teal-50 border-2 border-black rounded-xl space-y-1.5'>
										<div className='flex justify-between items-center text-xs font-black'>
											<div>
												<span className='uppercase text-teal-900'>Formatif</span>
												<span className='text-[10px] text-gray-500 font-bold block'>
													Tugas harian & kuis ({assignments.harian.length} tugas)
												</span>
											</div>
											<span className='px-2 py-0.5 bg-[#00A693] text-white rounded border border-black text-xs'>
												{bobot.harian}%
											</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.harian}
											onChange={(e) => setBobot({ ...bobot, harian: parseInt(e.target.value, 10) || 0 })}
											className='w-full accent-black cursor-pointer'
										/>
									</div>

									{/* Sumatif */}
									<div className='p-3 bg-blue-50 border-2 border-black rounded-xl space-y-1.5'>
										<div className='flex justify-between items-center text-xs font-black'>
											<div>
												<span className='uppercase text-blue-900'>Sumatif</span>
												<span className='text-[10px] text-gray-500 font-bold block'>
													Ulangan lingkup materi / STS ({assignments.sumatif.length} tugas)
												</span>
											</div>
											<span className='px-2 py-0.5 bg-[#2F80ED] text-white rounded border border-black text-xs'>
												{bobot.sumatif}%
											</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.sumatif}
											onChange={(e) => setBobot({ ...bobot, sumatif: parseInt(e.target.value, 10) || 0 })}
											className='w-full accent-black cursor-pointer'
										/>
									</div>

									{/* SAS */}
									<div className='p-3 bg-rose-50 border-2 border-black rounded-xl space-y-1.5'>
										<div className='flex justify-between items-center text-xs font-black'>
											<div>
												<span className='uppercase text-rose-900'>SAS</span>
												<span className='text-[10px] text-gray-500 font-bold block'>
													Sumatif Akhir Semester / PAS ({assignments.uas.length} tugas)
												</span>
											</div>
											<span className='px-2 py-0.5 bg-[#E8451A] text-white rounded border border-black text-xs'>
												{bobot.uas}%
											</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={bobot.uas}
											onChange={(e) => setBobot({ ...bobot, uas: parseInt(e.target.value, 10) || 0 })}
											className='w-full accent-black cursor-pointer'
										/>
									</div>

									{totalBobot !== 100 && (
										<div className='p-2 bg-rose-100 border-2 border-rose-600 rounded-xl text-center text-xs font-black text-rose-900'>
											Total bobot saat ini {totalBobot}%. Wajib 100%!
										</div>
									)}
								</div>
							) : (
								<div className='p-5 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center space-y-1'>
									<p className='text-xs font-black text-black'>Mode Rata-Rata Sederhana Aktif</p>
									<p className='text-[11px] text-gray-500'>
										Seluruh kategori tugas harian, sumatif, dan SAS dinilai dengan bobot setara secara langsung.
									</p>
								</div>
							)}
						</div>

						{/* Card 2: Fitur Konversi Nilai (7 Cols) */}
						<div className='lg:col-span-7 bg-white p-5 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
							<div className='flex items-center justify-between border-b-2 border-black pb-3'>
								<div className='flex items-center gap-2'>
									<TrendingUp className='w-5 h-5 text-[#00A693]' />
									<div>
										<h3 className='font-black text-black text-sm uppercase'>Fitur Konversi Nilai Rapor</h3>
										<p className='text-[11px] text-gray-500 font-medium'>
											Penyesuaian linier skor capaian siswa ke skala rentang target sekolah
										</p>
									</div>
								</div>
								<button
									type='button'
									onClick={() => {
										setConvertConfig((prev) => {
											const nextActive = !prev.useConversion;
											return {
												...prev,
												useConversion: nextActive,
												...(nextActive
													? {
															ncMin: actualStats.min,
															ncMax: actualStats.max,
															nhMin: kkm || 75,
															nhMax: 95,
													  }
													: {}),
											};
										});
									}}
									className={`px-3 py-1 font-black text-xs uppercase rounded-lg border-2 border-black transition-all cursor-pointer ${
										convertConfig.useConversion
											? 'bg-[#00A693] text-white shadow-[2px_2px_0px_#000]'
											: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
									}`}>
									{convertConfig.useConversion ? 'KONVERSI AKTIF' : 'NONAKTIF'}
								</button>
							</div>

							<div className='flex flex-wrap items-center justify-between gap-2 p-2.5 bg-yellow-50 border-2 border-black rounded-xl text-xs font-bold text-gray-800'>
								<div className='flex items-center gap-2 flex-wrap'>
									<span>
										Rentang Nilai Aktual: <span className='font-black text-black'>{actualStats.min}</span> s/d{' '}
										<span className='font-black text-black'>{actualStats.max}</span>
									</span>
									{convertConfig.useConversion &&
										Number(convertConfig.ncMin) === Number(actualStats.min) &&
										Number(convertConfig.ncMax) === Number(actualStats.max) && (
											<span className='px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-600 rounded text-[10px] font-black'>
												Aktif (Default)
											</span>
										)}
								</div>
								<button
									type='button'
									onClick={applyActualRangePreset}
									className='px-2.5 py-1 bg-white hover:bg-yellow-200 text-black border border-black rounded-lg text-[11px] font-black shadow-[1px_1px_0px_#000] cursor-pointer'>
									Gunakan Rentang Aktual
								</button>
							</div>

							{convertConfig.useConversion ? (
								<div className='space-y-3.5'>
									<div className='grid grid-cols-2 gap-3'>
										{/* Card 1: Min Capaian (Nc Min) */}
										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1 relative'>
											<div className='flex items-center justify-between gap-1'>
												<label className='block text-[11px] font-black uppercase text-gray-700'>
													Min Capaian (Nc Min)
												</label>
												<CardInfoTooltip
													title='Min Capaian (Nc Min)'
													description='Nilai capaian mentah terendah siswa di kelas ini. Nilai siswa yang setara dengan batas ini akan otomatis dikonversi menjadi Target Min (KKM/75).'
													side='right'
												/>
											</div>
											<input
												type='number'
												value={convertConfig.ncMin}
												onChange={(e) => handleConvertConfigChange('ncMin', e.target.value)}
												onBlur={() => handleConvertConfigBlur('ncMin', actualStats.min)}
												onFocus={(e) => e.target.select()}
												className='w-full p-1.5 bg-white border-2 border-black rounded-lg text-xs font-black text-black focus:outline-none focus:bg-yellow-50'
											/>
											<span className='text-[10px] text-gray-500'>Batas bawah nilai aktual</span>
										</div>

										{/* Card 2: Max Capaian (Nc Max) */}
										<div className='p-3 bg-gray-50 border-2 border-black rounded-xl space-y-1 relative'>
											<div className='flex items-center justify-between gap-1'>
												<label className='block text-[11px] font-black uppercase text-gray-700'>
													Max Capaian (Nc Max)
												</label>
												<CardInfoTooltip
													title='Max Capaian (Nc Max)'
													description='Nilai capaian mentah tertinggi siswa di kelas ini. Siswa dengan nilai capaian ini akan memperoleh nilai Target Max (misal 95) di rapor.'
													side='right'
												/>
											</div>
											<input
												type='number'
												value={convertConfig.ncMax}
												onChange={(e) => handleConvertConfigChange('ncMax', e.target.value)}
												onBlur={() => handleConvertConfigBlur('ncMax', actualStats.max)}
												onFocus={(e) => e.target.select()}
												className='w-full p-1.5 bg-white border-2 border-black rounded-lg text-xs font-black text-black focus:outline-none focus:bg-yellow-50'
											/>
											<span className='text-[10px] text-gray-500'>Batas atas nilai aktual</span>
										</div>
									</div>

									<div className='grid grid-cols-2 gap-3'>
										{/* Card 3: Target Min (Nh Min / KKM) */}
										<div className='p-3 bg-emerald-50 border-2 border-black rounded-xl space-y-1 relative'>
											<div className='flex items-center justify-between gap-1'>
												<label className='block text-[11px] font-black uppercase text-emerald-950'>
													Target Min (Nh Min / KKM)
												</label>
												<div className='flex items-center gap-1.5 shrink-0'>
													{convertConfig.nhMin !== kkm && (
														<button
															type='button'
															onClick={() => setConvertConfig((prev) => ({ ...prev, nhMin: kkm }))}
															className='text-[10px] font-black text-emerald-800 underline hover:text-black cursor-pointer'
															title='Kembalikan ke nilai KKM'>
															Samakan KKM
														</button>
													)}
													<CardInfoTooltip
														title='Target Min (Nh Min / KKM)'
														description='Batas nilai ketuntasan minimal di rapor (KKM / KKTP). Nilai asli siswa pada batas Nc Min akan diangkat tepat ke angka ini (misal 75) agar tuntas.'
														side='right'
													/>
												</div>
											</div>
											<input
												type='number'
												value={convertConfig.nhMin}
												onChange={(e) => handleConvertConfigChange('nhMin', e.target.value)}
												onBlur={() => handleConvertConfigBlur('nhMin', kkm || 75)}
												onFocus={(e) => e.target.select()}
												className='w-full p-1.5 bg-white border-2 border-black rounded-lg text-xs font-black text-black focus:outline-none focus:bg-yellow-50'
											/>
											<span className='text-[10px] text-emerald-800 font-bold block'>
												Otomatis tersinkron KKM: <strong>{kkm}</strong> ({kkmSource})
											</span>
										</div>

										{/* Card 4: Target Max (Nh Max) */}
										<div className='p-3 bg-emerald-50 border-2 border-black rounded-xl space-y-1 relative'>
											<div className='flex items-center justify-between gap-1'>
												<label className='block text-[11px] font-black uppercase text-emerald-950'>
													Target Max (Nh Max)
												</label>
												<CardInfoTooltip
													title='Target Max (Nh Max)'
													description='Batas nilai tertinggi yang ingin diberikan di rapor (maks. 100, standar 95). Menjadi patokan nilai puncak capaian bagi siswa terbaik di kelas.'
													side='right'
												/>
											</div>
											<input
												type='number'
												value={convertConfig.nhMax}
												onChange={(e) => handleConvertConfigChange('nhMax', e.target.value)}
												onBlur={() => handleConvertConfigBlur('nhMax', 95)}
												onFocus={(e) => e.target.select()}
												className='w-full p-1.5 bg-white border-2 border-black rounded-lg text-xs font-black text-black focus:outline-none focus:bg-yellow-50'
											/>
											<span className='text-[10px] text-emerald-800 font-bold'>
												Nilai tertinggi rapor (maks. 100)
											</span>
										</div>
									</div>

									<div className='p-2.5 bg-blue-50 border border-blue-300 rounded-xl text-[11px] text-blue-900 font-medium leading-relaxed flex items-start gap-2'>
										<Info className='w-4 h-4 shrink-0 text-blue-700 mt-0.5' />
										<span>
											<strong>Formula Konversi:</strong>{' '}
											<code className='bg-white px-1.5 py-0.5 border border-blue-400 rounded text-[10px] font-mono'>
												Nh Min + ((Nilai - Nc Min) / (Nc Max - Nc Min)) × (Nh Max - Nh Min)
											</code>
										</span>
									</div>

									{Object.keys(customConverts).length > 0 && (
										<div className='flex items-center justify-between p-2.5 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs font-bold text-amber-950'>
											<span>
												Terdapat <strong>{Object.keys(customConverts).length} siswa</strong> yang nilai konversinya diedit manual.
											</span>
											<button
												type='button'
												onClick={() => setCustomConverts({})}
												className='px-2.5 py-1 bg-white hover:bg-amber-100 text-black border border-black rounded-lg text-[10px] font-black cursor-pointer shadow-[1px_1px_0px_#000]'>
												Reset Semua ke Formula
											</button>
										</div>
									)}
								</div>
							) : (
								<div className='p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center space-y-2'>
									<p className='text-xs font-black text-black'>Fitur Konversi Sedang Nonaktif</p>
									<p className='text-[11px] text-gray-500 max-w-md mx-auto'>
										Nilai akhir yang digunakan untuk E-Rapor adalah nilai asli hasil kalkulasi rata-rata atau bobot tugas harian apa adanya.
									</p>
									<button
										type='button'
										onClick={() => {
											setConvertConfig((prev) => ({
												...prev,
												useConversion: true,
												ncMin: actualStats.min,
												ncMax: actualStats.max,
												nhMin: kkm || 75,
												nhMax: 95,
											}));
										}}
										className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] cursor-pointer'>
										Aktifkan Konversi Nilai
									</button>
								</div>
							)}
						</div>
					</div>

					{/* Tabel Rekapitulasi & Hasil Nilai */}
					{kelasList.length === 0 ? (
						<div className='p-12 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<Users className='w-10 h-10 mx-auto text-gray-400' />
							<h3 className='text-base font-black text-black'>Belum Ada Penugasan Kelas Ajar</h3>
							<p className='text-xs text-gray-500 max-w-md mx-auto'>
								Akun Anda belum terhubung dengan rombel jadwal KBM mana pun.
							</p>
						</div>
					) : mapelList.length === 0 ? (
						<div className='p-12 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<AlertCircle className='w-10 h-10 mx-auto text-amber-500' />
							<h3 className='text-base font-black text-black'>Tidak Ada Mata Pelajaran Diampu</h3>
							<p className='text-xs text-gray-500 max-w-md mx-auto'>
								Anda tidak memiliki mata pelajaran yang diajar pada kelas yang dipilih.
							</p>
						</div>
					) : (
						<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
							<div className='overflow-x-auto'>
								<table className='w-full text-left border-collapse min-w-[850px]'>
									<thead>
										<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
											<th className='p-3.5 w-12 text-center border-r-2 border-black'>No</th>
											<th className='p-3.5 w-44 border-r-2 border-black'>Nama Siswa</th>
											<th className='p-3 text-center border-r-2 border-black bg-teal-200/80'>
												Formatif
												<span className='block text-[10px] font-normal normal-case text-gray-700'>
													{calcMethod === 'persentase' ? `${bobot.harian}%` : 'Rata-rata'}
												</span>
											</th>
											<th className='p-3 text-center border-r-2 border-black bg-blue-200/80'>
												Sumatif
												<span className='block text-[10px] font-normal normal-case text-gray-700'>
													{calcMethod === 'persentase' ? `${bobot.sumatif}%` : 'Rata-rata'}
												</span>
											</th>
											<th className='p-3 text-center border-r-2 border-black bg-rose-200/80'>
												SAS
												<span className='block text-[10px] font-normal normal-case text-gray-700'>
													{calcMethod === 'persentase' ? `${bobot.uas}%` : 'Rata-rata'}
												</span>
											</th>
											<th className='p-3 w-16 text-center border-r-2 border-black' title='Total Poin Karakter Positif'>
												Pt (+)
											</th>
											<th className='p-3 w-16 text-center border-r-2 border-black' title='Total Poin Karakter Negatif'>
												Pt (-)
											</th>
											<th className='p-3 text-center border-r-2 border-black bg-amber-200'>
												Nilai Akhir (Asli)
											</th>
											{convertConfig.useConversion && (
												<th className='p-3 text-center border-r-2 border-black bg-emerald-300'>
													<div>Nilai Konversi</div>
													<span className='block text-[9px] font-normal normal-case text-emerald-950'>
														(Dapat diedit manual)
													</span>
												</th>
											)}
											<th className='p-3 text-center'>Status Rapor Kuantitatif</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-black/20 text-xs font-medium'>
										{filteredStudents.length === 0 ? (
											<tr>
												<td
													colSpan={convertConfig.useConversion ? 10 : 9}
													className='p-8 text-center text-gray-500 font-bold'>
													Tidak ada data siswa yang cocok dengan pencarian.
												</td>
											</tr>
										) : (
											filteredStudents.map((s, idx) => {
												const convertedVal =
													customConverts[s.siswa_id] !== undefined && customConverts[s.siswa_id] !== ''
														? Number(customConverts[s.siswa_id])
														: s.finalConvert;
												const finalToUse = convertConfig.useConversion ? convertedVal : s.finalOrig;
												const isSavedInRapor = s.rapor_nilai_kuantitatif !== null && s.rapor_nilai_kuantitatif !== undefined;
												const isDiffFromSaved = isSavedInRapor && Math.round(s.rapor_nilai_kuantitatif) !== Math.round(finalToUse);
												const isManualEdited = customConverts[s.siswa_id] !== undefined;

												return (
													<tr key={s.siswa_id} className='hover:bg-yellow-50/40 transition-colors'>
														<td className='p-3 text-center font-black border-r-2 border-black/30'>
															{idx + 1}
														</td>
														<td className='p-3 font-black text-black border-r-2 border-black/30'>
															<div>{s.nama_lengkap}</div>
															<div className='text-[10px] font-mono text-gray-500'>
																{s.nis || s.nisn || '-'}
															</div>
														</td>
														<td className='p-3 text-center font-bold border-r-2 border-black/30 bg-teal-50/30'>
															{s.harian !== null ? s.harian.toFixed(1) : <span className='text-gray-400'>-</span>}
														</td>
														<td className='p-3 text-center font-bold border-r-2 border-black/30 bg-blue-50/30'>
															{s.sumatif !== null ? s.sumatif.toFixed(1) : <span className='text-gray-400'>-</span>}
														</td>
														<td className='p-3 text-center font-bold border-r-2 border-black/30 bg-rose-50/30'>
															{s.uas !== null ? s.uas.toFixed(1) : <span className='text-gray-400'>-</span>}
														</td>
														<td className='p-3 text-center border-r-2 border-black/30'>
															{s.poinPositif > 0 ? (
																<span className='inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 rounded font-black text-[10px]'>
																	+{s.poinPositif}
																</span>
															) : (
																<span className='text-gray-400 font-bold'>-</span>
															)}
														</td>
														<td className='p-3 text-center border-r-2 border-black/30'>
															{s.poinNegatif > 0 ? (
																<span className='inline-block px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-400 rounded font-black text-[10px]'>
																	-{s.poinNegatif}
																</span>
															) : (
																<span className='text-gray-400 font-bold'>-</span>
															)}
														</td>
														<td className='p-3 text-center font-black border-r-2 border-black/30 bg-amber-50/40'>
															<span
																className={`inline-block px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0px_#000] text-xs font-black ${
																	s.finalOrig >= kkm
																		? 'bg-white text-black'
																		: 'bg-rose-100 text-rose-900 border-rose-900'
																}`}>
																{s.finalOrig.toFixed(1)}
															</span>
														</td>
														{convertConfig.useConversion && (
															<td className='p-2 text-center font-black border-r-2 border-black/30 bg-emerald-50/40'>
																<div className='flex items-center justify-center gap-1'>
																	<input
																		type='number'
																		min='0'
																		max='100'
																		step='1'
																		value={
																			customConverts[s.siswa_id] !== undefined
																				? customConverts[s.siswa_id]
																				: Math.round(s.finalConvert)
																		}
																		onChange={(e) => {
																			let raw = e.target.value;
																			if (raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')) {
																				raw = raw.replace(/^0+/, '');
																			}
																			const val = raw === '' ? '' : parseFloat(raw);
																			setCustomConverts((prev) => ({
																				...prev,
																				[s.siswa_id]: isNaN(val) ? '' : val,
																			}));
																		}}
																		onFocus={(e) => e.target.select()}
																		className={`w-16 px-1.5 py-1 text-center font-black text-xs rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] focus:outline-none focus:bg-yellow-100 ${
																			isManualEdited
																				? 'bg-amber-100 text-amber-950 border-amber-600 ring-2 ring-amber-400'
																				: convertedVal >= kkm
																				? 'bg-emerald-100 text-emerald-950'
																				: 'bg-rose-100 text-rose-950'
																		}`}
																		title={
																			isManualEdited
																				? 'Nilai ini telah diedit manual (Klik ↺ untuk reset ke formula)'
																				: 'Ketik langsung angka untuk mengedit nilai siswa ini'
																		}
																	/>
																	{isManualEdited && (
																		<button
																			type='button'
																			onClick={() => {
																				setCustomConverts((prev) => {
																					const copy = { ...prev };
																					delete copy[s.siswa_id];
																					return copy;
																				});
																			}}
																			className='w-5 h-5 flex items-center justify-center text-[10px] font-black text-rose-700 bg-white hover:bg-rose-100 border border-black rounded shadow-[0.5px_0.5px_0px_#000] cursor-pointer shrink-0'
																			title='Kembalikan ke nilai formula otomatis'>
																			↺
																		</button>
																	)}
																</div>
															</td>
														)}
														<td className='p-3 text-center'>
															{isSavedInRapor ? (
																<div className='flex flex-col items-center justify-center gap-0.5'>
																	<span className='inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-400 rounded-lg text-[10px] font-black'>
																		<CheckCircle2 className='w-3 h-3 text-emerald-600' />
																		<span>Tersimpan: {s.rapor_nilai_kuantitatif}</span>
																	</span>
																	{isDiffFromSaved && (
																		<span className='text-[9px] text-amber-700 font-bold'>
																			(Perlu disinkron ulang)
																		</span>
																	)}
																</div>
															) : (
																<span className='inline-block px-2 py-0.5 bg-gray-100 text-gray-500 border border-dashed border-gray-300 rounded text-[10px] font-bold'>
																	Belum Tersimpan
																</span>
															)}
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
