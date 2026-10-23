'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
	Printer,
	Lock,
	Unlock,
	ShieldCheck,
	Calendar,
	MapPin,
	School,
	UserCheck,
	Award,
	BookOpen,
	FileText,
	CheckCircle2,
	AlertTriangle,
	Users,
	Save,
	RefreshCw,
	Plus,
	Trash2,
	Edit2,
	Check,
	X,
	Sparkles,
	Trophy,
	Crown,
	Download,
	FileSpreadsheet,
	Search,
	Filter,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import { normalizeTingkatArray } from '@/lib/eraporEkskulUtils';
import { generateSinglePiagamPDF, generateBatchPiagamPDF } from '@/lib/pdfPiagam';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import * as XLSX from 'xlsx';

export default function KurikulumRaporManagementPage() {
	const [activeTab, setActiveTab] = useState('titimangsa'); // 'titimangsa' | 'locking' | 'ekskul_catatan' | 'pleno' | 'juara_piagam'
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [notification, setNotification] = useState(null);

	// 1. Data Titimangsa & Profil Sekolah
	const [settings, setSettings] = useState({
		tempat_rapor: 'Kuala Gading',
		tanggal_rapor_ganjil: '20 Desember 2026',
		tanggal_rapor_genap: '26 Juni 2027',
		alamat_sekolah: 'Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355',
		nama_sekolah: 'SMP IT TEBUIRENG 4 AL-ISHLAH',
		nama_kepsek: 'Mujib Kodar, S.Pd,I',
		nip_kepsek: '-',
		is_locked_global: false,
	});

	// 2. Data Monitoring & Kunci Rombel
	const [kelasList, setKelasList] = useState([]);
	const [lockMap, setLockMap] = useState({});
	const [isLockedGlobal, setIsLockedGlobal] = useState(false);
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	// 3. Master Ekskul & Template Catatan
	const [ekskulList, setEkskulList] = useState([]);
	const [newEkskul, setNewEkskul] = useState({ nama_ekskul: '', kategori: 'Pilihan', deskripsi_standar: '', tingkat: [7, 8, 9] });
	const [templateList, setTemplateList] = useState([]);
	const [newTemplate, setNewTemplate] = useState({ kategori: 'Motivasi', judul: '', isi_catatan: '' });
	const [subTabEkskulCatatan, setSubTabEkskulCatatan] = useState('ekskul');

	// 4. Data Pleno Kenaikan Kelas
	const [selectedPlenoKelasId, setSelectedPlenoKelasId] = useState('');
	const [plenoData, setPlenoData] = useState(null);
	const [plenoDecisions, setPlenoDecisions] = useState({});
	const [loadingPleno, setLoadingPleno] = useState(false);

	// 5. Data Juara & Piagam Penghargaan
	const [juaraData, setJuaraData] = useState(null);
	const [loadingJuara, setLoadingJuara] = useState(false);
	const [juaraSubTab, setJuaraSubTab] = useState('kelas'); // 'kelas' | 'umum'
	const [selectedJuaraKelas, setSelectedJuaraKelas] = useState('');
	const [selectedJuaraTingkat, setSelectedJuaraTingkat] = useState('sekolah'); // 'sekolah' | 'VII' | 'VIII' | 'IX'
	const [juaraSearchQuery, setJuaraSearchQuery] = useState('');

	const fetchJuaraData = useCallback(async () => {
		try {
			setLoadingJuara(true);
			const res = await fetch(`/api/erapor/juara?tahun_ajaran=${encodeURIComponent(tahunAjaran)}&semester=${semester}`);
			if (res.ok) {
				const jData = await res.json();
				setJuaraData(jData);
				if (jData?.kelas_list?.length > 0 && !selectedJuaraKelas) {
					setSelectedJuaraKelas(jData.kelas_list[0].nama_kelas);
				}
			}
		} catch (err) {
			console.error('Error load data juara kurikulum:', err);
		} finally {
			setLoadingJuara(false);
		}
	}, [tahunAjaran, semester, selectedJuaraKelas]);

	useEffect(() => {
		if (activeTab === 'juara_piagam') {
			fetchJuaraData();
		}
	}, [activeTab, fetchJuaraData]);

	// Cetak Piagam Single
	const handleCetakPiagamSingle = (siswa, defaultLabel) => {
		try {
			const label = defaultLabel || siswa.juara_label || `PERINGKAT KE-${siswa.rank_kelas || 1} KELAS ${siswa.kelas}`;
			generateSinglePiagamPDF({
				siswa,
				juaraLabel: label,
				kategori: 'Hasil Belajar Akademik (E-Rapor)',
				kelas: siswa.kelas,
				tahunAjaran,
				semester,
				schoolProfile: {
					...DEFAULT_PROFIL_SEKOLAH,
					...settings,
				},
				tanggalPiagam: semester === 1 ? settings.tanggal_rapor_ganjil : settings.tanggal_rapor_genap,
				waliKelasName: siswa.wali_kelas,
				waliKelasNip: siswa.nip_wali,
				wakaKurikulumName: 'Waka Kurikulum',
				rataRata: siswa.rata_rata,
				totalNilai: siswa.total_nilai,
			});
			if (showToast) showToast(`Piagam untuk ${siswa.nama_lengkap} berhasil diunduh!`);
		} catch (err) {
			if (showToast) showToast('Gagal cetak piagam: ' + err.message, 'error');
		}
	};

	// Cetak Piagam Top 3 Kelas Terpilih
	const handleCetakPiagamTop3Kelas = () => {
		const classStudents = (juaraData?.juara_kelas_map?.[selectedJuaraKelas] || []).slice(0, 3);
		if (classStudents.length === 0) {
			if (showToast) showToast('Belum ada data nilai di kelas ini', 'error');
			return;
		}

		try {
			const items = classStudents.map((s) => ({
				siswa: s,
				juaraLabel: s.juara_label || `JUARA KELAS ${selectedJuaraKelas}`,
				kelas: selectedJuaraKelas,
				waliKelasName: s.wali_kelas,
				waliKelasNip: s.nip_wali,
				rataRata: s.rata_rata,
				totalNilai: s.total_nilai,
			}));

			generateBatchPiagamPDF(items, {
				schoolProfile: { ...DEFAULT_PROFIL_SEKOLAH, ...settings },
				tahunAjaran,
				semester,
				tanggalPiagam: semester === 1 ? settings.tanggal_rapor_ganjil : settings.tanggal_rapor_genap,
				batchTitle: `Piagam_Juara_Top3_Kelas_${selectedJuaraKelas}`,
			});
			if (showToast) showToast(`Piagam Juara Top 3 Kelas ${selectedJuaraKelas} berhasil dibuat!`);
		} catch (err) {
			if (showToast) showToast('Gagal cetak batch: ' + err.message, 'error');
		}
	};

	// Cetak Semua Juara 1, 2, 3 Seluruh Rombel Sekolah
	const handleCetakSemuaJuaraKelas = () => {
		const allTopItems = [];
		const kMap = juaraData?.juara_kelas_map || {};
		Object.keys(kMap).forEach((klsNama) => {
			const top3 = (kMap[klsNama] || []).slice(0, 3);
			top3.forEach((s) => {
				allTopItems.push({
					siswa: s,
					juaraLabel: s.juara_label || `JUARA KELAS ${klsNama}`,
					kelas: klsNama,
					waliKelasName: s.wali_kelas,
					waliKelasNip: s.nip_wali,
					rataRata: s.rata_rata,
					totalNilai: s.total_nilai,
				});
			});
		});

		if (allTopItems.length === 0) {
			if (showToast) showToast('Belum ada data juara kelas', 'error');
			return;
		}

		try {
			generateBatchPiagamPDF(allTopItems, {
				schoolProfile: { ...DEFAULT_PROFIL_SEKOLAH, ...settings },
				tahunAjaran,
				semester,
				tanggalPiagam: semester === 1 ? settings.tanggal_rapor_ganjil : settings.tanggal_rapor_genap,
				batchTitle: `Piagam_Semua_Juara_Kelas_${tahunAjaran.replace('/', '-')}`,
			});
			if (showToast) showToast(`Sebanyak ${allTopItems.length} piagam juara kelas berhasil digenerate!`);
		} catch (err) {
			if (showToast) showToast('Gagal cetak massal: ' + err.message, 'error');
		}
	};

	// Cetak Piagam Juara Umum
	const handleCetakPiagamJuaraUmum = () => {
		let listToPrint = [];
		const jUmum = juaraData?.juara_umum || {};
		if (selectedJuaraTingkat === 'VII') listToPrint = jUmum.tingkat_7?.slice(0, 3) || [];
		else if (selectedJuaraTingkat === 'VIII') listToPrint = jUmum.tingkat_8?.slice(0, 3) || [];
		else if (selectedJuaraTingkat === 'IX') listToPrint = jUmum.tingkat_9?.slice(0, 3) || [];
		else listToPrint = jUmum.sekolah?.slice(0, 3) || [];

		if (listToPrint.length === 0) {
			if (showToast) showToast('Belum ada data juara umum', 'error');
			return;
		}

		try {
			const labelKategori = selectedJuaraTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedJuaraTingkat}`;
			const items = listToPrint.map((s) => ({
				siswa: s,
				juaraLabel: s.juara_label || `JUARA UMUM ${labelKategori}`,
				kelas: s.kelas,
				waliKelasName: s.wali_kelas,
				rataRata: s.rata_rata,
				totalNilai: s.total_nilai,
			}));

			generateBatchPiagamPDF(items, {
				schoolProfile: { ...DEFAULT_PROFIL_SEKOLAH, ...settings },
				tahunAjaran,
				semester,
				tanggalPiagam: semester === 1 ? settings.tanggal_rapor_ganjil : settings.tanggal_rapor_genap,
				batchTitle: `Piagam_Juara_Umum_${labelKategori.replace(/\s+/g, '_')}`,
			});
			if (showToast) showToast(`Piagam Juara Umum (${labelKategori}) berhasil dibuat!`);
		} catch (err) {
			if (showToast) showToast('Gagal cetak juara umum: ' + err.message, 'error');
		}
	};

	const juaraKelasMap = juaraData?.juara_kelas_map || {};
	const juaraUmum = juaraData?.juara_umum || {};
	const kelasListJuara = juaraData?.kelas_list || [];

	const currentJuaraClassStudents = useMemo(() => {
		if (selectedJuaraKelas === 'ALL') {
			const all = [];
			Object.keys(juaraKelasMap).forEach((k) => {
				const top3 = (juaraKelasMap[k] || []).slice(0, 3);
				all.push(...top3);
			});
			if (!juaraSearchQuery.trim()) return all;
			const q = juaraSearchQuery.toLowerCase();
			return all.filter(
				(s) =>
					s.nama_lengkap?.toLowerCase().includes(q) ||
					s.nis?.includes(q) ||
					s.kelas?.toLowerCase().includes(q)
			);
		}

		if (!selectedJuaraKelas || !juaraKelasMap[selectedJuaraKelas]) return [];
		const list = (juaraKelasMap[selectedJuaraKelas] || []).slice(0, 3);
		if (!juaraSearchQuery.trim()) return list;
		const q = juaraSearchQuery.toLowerCase();
		return list.filter((s) => s.nama_lengkap?.toLowerCase().includes(q) || s.nis?.includes(q));
	}, [selectedJuaraKelas, juaraKelasMap, juaraSearchQuery]);

	const top3JuaraKelas = useMemo(() => {
		if (selectedJuaraKelas === 'ALL') {
			const firstK = Object.keys(juaraKelasMap)[0];
			return (juaraKelasMap[firstK] || []).slice(0, 3);
		}
		if (!selectedJuaraKelas || !juaraKelasMap[selectedJuaraKelas]) return [];
		return (juaraKelasMap[selectedJuaraKelas] || []).slice(0, 3);
	}, [selectedJuaraKelas, juaraKelasMap]);

	const currentJuaraUmumList = useMemo(() => {
		let list = [];
		if (selectedJuaraTingkat === 'VII') list = (juaraUmum.tingkat_7 || []).slice(0, 3);
		else if (selectedJuaraTingkat === 'VIII') list = (juaraUmum.tingkat_8 || []).slice(0, 3);
		else if (selectedJuaraTingkat === 'IX') list = (juaraUmum.tingkat_9 || []).slice(0, 3);
		else list = (juaraUmum.sekolah || []).slice(0, 3);

		if (!juaraSearchQuery.trim()) return list;
		const q = juaraSearchQuery.toLowerCase();
		return list.filter((s) => s.nama_lengkap?.toLowerCase().includes(q) || s.kelas?.toLowerCase().includes(q));
	}, [selectedJuaraTingkat, juaraUmum, juaraSearchQuery]);

	const top3JuaraUmum = useMemo(() => {
		return currentJuaraUmumList.slice(0, 3);
	}, [currentJuaraUmumList]);

	const handleExportJuaraExcel = () => {
		if (!juaraData) {
			showToast('Data juara belum siap diekspor', 'error');
			return;
		}

		try {
			const wb = XLSX.utils.book_new();

			// 1. Sheet Juara 1-3 Setiap Rombel
			const rowsKelas = [];
			const kMap = juaraData.juara_kelas_map || {};
			Object.keys(kMap).forEach((kls) => {
				(kMap[kls] || []).slice(0, 3).forEach((s) => {
					rowsKelas.push({
						Kelas: s.kelas,
						Peringkat: `Juara ${s.rank_kelas}`,
						NIS: s.nis || '-',
						NISN: s.nisn || '-',
						'Nama Lengkap': s.nama_lengkap,
						'Total Nilai': s.total_nilai,
						'Rata-Rata': s.rata_rata,
						Predikat: s.juara_label,
						'Wali Kelas': s.wali_kelas || '-',
					});
				});
			});
			const wsKelas = XLSX.utils.json_to_sheet(rowsKelas);
			XLSX.utils.book_append_sheet(wb, wsKelas, 'Juara 1-3 Tiap Rombel');

			// 2. Sheet Juara Umum (1-3 Besar)
			const rowsUmum = [];
			(juaraData.juara_umum?.sekolah || []).slice(0, 3).forEach((s, idx) => {
				rowsUmum.push({
					Peringkat: `Juara Umum ${idx + 1}`,
					Kelas: s.kelas,
					NIS: s.nis || '-',
					'Nama Lengkap': s.nama_lengkap,
					'Total Nilai': s.total_nilai,
					'Rata-Rata': s.rata_rata,
					Predikat: s.juara_label,
				});
			});
			const wsUmum = XLSX.utils.json_to_sheet(rowsUmum);
			XLSX.utils.book_append_sheet(wb, wsUmum, 'Juara Umum Top 3');

			XLSX.writeFile(wb, `Rekap_Juara_Top3_Rapor_${tahunAjaran.replace('/', '-')}_Sem${semester}.xlsx`);
			showToast('Rekapitulasi Juara 1-3 Rapor berhasil diekspor ke Excel!');
		} catch (err) {
			showToast('Gagal ekspor excel: ' + err.message, 'error');
		}
	};

	const showToast = (msg, type = 'success') => {
		setNotification({ msg, type });
		setTimeout(() => setNotification(null), 4000);
	};

	// Fetch Master Awal
	const fetchInitialData = useCallback(async () => {
		try {
			setLoading(true);
			const [resSettings, resKelas, resTahun, resEkskul, resTemplate] = await Promise.all([
				fetch('/api/erapor/settings'),
				fetch('/api/kelas'),
				fetch('/api/tahun-ajar'),
				fetch('/api/erapor/master-ekskul'),
				fetch('/api/erapor/template-catatan'),
			]);

			if (resSettings.ok) {
				const sData = await resSettings.json();
				setSettings((prev) => ({ ...prev, ...sData }));
				setIsLockedGlobal(Boolean(sData.is_locked_global));
			}

			let kList = [];
			if (resKelas.ok) {
				kList = (await resKelas.json()) || [];
				setKelasList(kList);
				if (kList.length > 0) setSelectedPlenoKelasId(kList[0].id);
			}

			let activeYear = '2026/2027';
			let activeSem = 1;
			if (resTahun.ok) {
				const tList = await resTahun.json();
				const aktif = tList.find((t) => t.is_aktif) || tList[0];
				if (aktif) {
					activeYear = aktif.nama || '2026/2027';
					activeSem = aktif.semester || 1;
					setTahunAjaran(activeYear);
					setSemester(activeSem);
				}
			}

			if (resEkskul.ok) {
				setEkskulList(await resEkskul.json());
			}

			if (resTemplate.ok) {
				setTemplateList(await resTemplate.json());
			}

			// Ambil status kunci kelas
			const resLocks = await fetch(`/api/erapor/lock-kelas?tahun_ajaran=${activeYear}&semester=${activeSem}`);
			if (resLocks.ok) {
				const lJson = await resLocks.json();
				setLockMap(lJson.locks || {});
				if (lJson.is_locked_global !== undefined) {
					setIsLockedGlobal(Boolean(lJson.is_locked_global));
				}
			}
		} catch (err) {
			console.error('Error fetching kurikulum rapor data:', err);
			showToast('Gagal memuat pengaturan rapor', 'error');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchInitialData();
	}, [fetchInitialData]);

	// Simpan Titimangsa & Profil Sekolah
	const handleSaveSettings = async (e) => {
		if (e) e.preventDefault();
		try {
			setSaving(true);
			const res = await fetch('/api/erapor/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...settings,
					is_locked_global: isLockedGlobal,
				}),
			});

			if (res.ok) {
				showToast('Pengaturan titimangsa & profil sekolah berhasil disimpan!');
			} else {
				const err = await res.json();
				showToast(err.error || 'Gagal menyimpan pengaturan', 'error');
			}
		} catch (err) {
			showToast('Terjadi kesalahan jaringan', 'error');
		} finally {
			setSaving(false);
		}
	};

	// Toggle Global Master Lock
	const handleToggleGlobalLock = async () => {
		const nextState = !isLockedGlobal;
		const confirmMsg = nextState
			? 'KUNCI SELURUH E-RAPOR: Semua guru mapel dan wali kelas tidak akan bisa lagi mengubah nilai / catatan rapor. Lanjutkan?'
			: 'BUKA KUNCI GLOBAL: Mengizinkan kembali wali kelas untuk mengelola kunci kelas binaannya. Lanjutkan?';

		if (!window.confirm(confirmMsg)) return;

		try {
			setSaving(true);
			const res = await fetch('/api/erapor/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...settings,
					is_locked_global: nextState,
				}),
			});

			if (res.ok) {
				setIsLockedGlobal(nextState);
				setSettings((prev) => ({ ...prev, is_locked_global: nextState }));
				showToast(nextState ? 'E-Rapor berhasil dikunci secara global!' : 'Kunci global berhasil dibuka!');
			}
		} catch (err) {
			showToast('Gagal memperbarui status kunci global', 'error');
		} finally {
			setSaving(false);
		}
	};

	// Toggle Kunci Kelas (Level 1)
	const handleToggleClassLock = async (kelasId, currentLockState) => {
		const nextState = !currentLockState;
		try {
			const res = await fetch('/api/erapor/lock-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: kelasId,
					tahun_ajaran: tahunAjaran,
					semester,
					lock: nextState,
					catatan: nextState ? 'Dikunci via Manajemen Kurikulum' : 'Dibuka via Manajemen Kurikulum',
				}),
			});

			if (res.ok) {
				const data = await res.json();
				setLockMap((prev) => ({
					...prev,
					[kelasId]: {
						is_locked_wali: nextState,
						locked_at_wali: data.locked_at_wali,
						locked_by_name: data.locked_by_name || 'Kurikulum',
					},
				}));
				showToast(nextState ? 'Nilai rombel berhasil dikunci!' : 'Kunci rombel berhasil dibuka!');
			}
		} catch (err) {
			showToast('Gagal mengubah status kunci kelas', 'error');
		}
	};

	// Master Ekskul Handlers
	const handleAddEkskul = async () => {
		if (!newEkskul.nama_ekskul.trim()) {
			showToast('Nama ekstrakurikuler wajib diisi', 'error');
			return;
		}

		const chosenTingkat =
			Array.isArray(newEkskul.tingkat) && newEkskul.tingkat.length > 0
				? newEkskul.tingkat
				: [7, 8, 9];

		const updated = [
			...ekskulList,
			{
				id: Date.now(),
				nama_ekskul: newEkskul.nama_ekskul.trim(),
				kategori: newEkskul.kategori,
				deskripsi_standar: newEkskul.deskripsi_standar.trim() || 'Aktif dan tertib mengikuti kegiatan ekstrakurikuler.',
				tingkat: chosenTingkat,
				urutan: ekskulList.length + 1,
				is_aktif: true,
			},
		];

		try {
			const res = await fetch('/api/erapor/master-ekskul', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});

			if (res.ok) {
				setEkskulList(updated);
				setNewEkskul({ nama_ekskul: '', kategori: 'Pilihan', deskripsi_standar: '', tingkat: [7, 8, 9] });
				showToast('Ekstrakurikuler berhasil ditambahkan!');
			}
		} catch (err) {
			showToast('Gagal menyimpan ekskul baru', 'error');
		}
	};

	const handleToggleEkskulTingkat = async (id, targetTingkat) => {
		const targetNum = parseInt(targetTingkat, 10);
		const previousList = ekskulList;
		const updated = ekskulList.map((e) => {
			if (e.id !== id) return e;
			const currentList = normalizeTingkatArray(e.tingkat, e.nama_ekskul);
			const isIncluded = currentList.includes(targetNum);
			let nextList = isIncluded
				? currentList.filter((x) => x !== targetNum)
				: [...currentList, targetNum].sort((a, b) => a - b);

			// Minimal harus ada 1 jenjang aktif
			if (nextList.length === 0) {
				nextList = [targetNum];
			}
			return { ...e, tingkat: nextList };
		});

		// Optimistic update: langsung ubah UI seketika tanpa jeda
		setEkskulList(updated);

		try {
			const res = await fetch('/api/erapor/master-ekskul', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
			if (!res.ok) throw new Error('Gagal menyimpan');
			showToast('Kombinasi jenjang kelas berhasil disimpan!');
		} catch (err) {
			setEkskulList(previousList);
			showToast('Gagal memperbarui jenjang ekskul', 'error');
		}
	};

	const handleDeleteEkskul = async (id, nama_ekskul = 'ekstrakurikuler ini') => {
		const result = await Swal.fire({
			title: 'Hapus Ekstrakurikuler?',
			text: `Kegiatan "${nama_ekskul}" akan dihapus dari daftar master resmi sekolah.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#e11d48',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		// Tampilkan popup loading seketika saat proses penghapusan berjalan
		Swal.fire({
			title: 'Menghapus Ekstrakurikuler...',
			text: `Sedang memproses penghapusan "${nama_ekskul}"...`,
			allowOutsideClick: false,
			allowEscapeKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			},
		});

		const updated = ekskulList.filter((e) => e.id !== id);
		try {
			const res = await fetch('/api/erapor/master-ekskul', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
			if (res.ok) {
				setEkskulList(updated);
				Swal.fire({
					icon: 'success',
					title: 'Terhapus',
					text: `Ekstrakurikuler "${nama_ekskul}" berhasil dihapus.`,
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				throw new Error('Gagal menghapus');
			}
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: err.message || 'Gagal menghapus ekstrakurikuler',
			});
		}
	};

	// Master Template Catatan Handlers
	const handleAddTemplate = async () => {
		if (!newTemplate.judul.trim() || !newTemplate.isi_catatan.trim()) {
			showToast('Judul dan isi catatan wajib diisi', 'error');
			return;
		}

		const updated = [
			...templateList,
			{
				id: Date.now(),
				kategori: newTemplate.kategori,
				judul: newTemplate.judul.trim(),
				isi_catatan: newTemplate.isi_catatan.trim(),
				urutan: templateList.length + 1,
				is_aktif: true,
			},
		];

		try {
			const res = await fetch('/api/erapor/template-catatan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
			if (res.ok) {
				setTemplateList(updated);
				setNewTemplate({ kategori: 'Motivasi', judul: '', isi_catatan: '' });
				showToast('Template catatan berhasil ditambahkan!');
			}
		} catch (err) {
			showToast('Gagal menyimpan template catatan', 'error');
		}
	};

	const handleDeleteTemplate = async (id, judul = 'template ini') => {
		const result = await Swal.fire({
			title: 'Hapus Template Catatan?',
			text: `Template "${judul}" akan dihapus dari bank preset wali kelas.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#e11d48',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		// Tampilkan popup loading seketika saat proses penghapusan berjalan
		Swal.fire({
			title: 'Menghapus Template...',
			text: `Sedang memproses penghapusan "${judul}"...`,
			allowOutsideClick: false,
			allowEscapeKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			},
		});

		const updated = templateList.filter((t) => t.id !== id);
		try {
			const res = await fetch('/api/erapor/template-catatan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
			if (res.ok) {
				setTemplateList(updated);
				Swal.fire({
					icon: 'success',
					title: 'Terhapus',
					text: `Template "${judul}" berhasil dihapus.`,
					timer: 1500,
					showConfirmButton: false,
				});
			} else {
				throw new Error('Gagal menghapus');
			}
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: err.message || 'Gagal menghapus template catatan',
			});
		}
	};

	// Fetch Data Pleno Kenaikan Kelas
	const fetchPlenoData = useCallback(async () => {
		if (!selectedPlenoKelasId) return;
		try {
			setLoadingPleno(true);
			const res = await fetch(`/api/erapor/pleno?kelas_id=${selectedPlenoKelasId}&tahun_ajaran=${tahunAjaran}`);
			if (res.ok) {
				const json = await res.json();
				setPlenoData(json);
				const initialDecisions = {};
				(json.evaluasi || []).forEach((e) => {
					initialDecisions[e.siswa_id] = {
						keputusan: e.keputusan_pleno || e.default_next_class,
						catatan: e.catatan_pleno || '',
					};
				});
				setPlenoDecisions(initialDecisions);
			}
		} catch (err) {
			console.error('Error fetching pleno data:', err);
			showToast('Gagal memuat data pleno kelas', 'error');
		} finally {
			setLoadingPleno(false);
		}
	}, [selectedPlenoKelasId, tahunAjaran]);

	useEffect(() => {
		if (activeTab === 'pleno') {
			fetchPlenoData();
		}
	}, [activeTab, fetchPlenoData]);

	const handleSavePlenoDecisions = async () => {
		try {
			setSaving(true);
			const res = await fetch('/api/erapor/pleno', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedPlenoKelasId,
					tahun_ajaran: tahunAjaran,
					decisions: plenoDecisions,
				}),
			});

			if (res.ok) {
				showToast('Keputusan pleno kenaikan kelas berhasil disimpan!');
			} else {
				showToast('Gagal menyimpan keputusan pleno', 'error');
			}
		} catch (err) {
			showToast('Terjadi kesalahan jaringan', 'error');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='p-16 text-center bg-white border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
				<Loader />
				<p className='text-sm font-black text-black'>Memuat data Manajemen E-Rapor...</p>
			</div>
		);
	}

	return (
		<div className='space-y-6'>
			{/* Toast Notifikasi */}
			{notification && (
				<div
					className={`fixed bottom-6 right-6 z-50 px-5 py-3 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-xs font-black flex items-center gap-2 ${
						notification.type === 'error' ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
					}`}>
					{notification.type === 'error' ? <AlertTriangle className='w-4 h-4' /> : <Check className='w-4 h-4' />}
					<span>{notification.msg}</span>
				</div>
			)}

			{/* Banner Header Kurikulum E-Rapor */}
			<div className='p-6 bg-gradient-to-r from-yellow-300 via-amber-200 to-rose-200 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
				<div className='space-y-1.5'>
					<span className='px-3 py-1 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-wider'>
						Pusat Kontrol Akademik
					</span>
					<h1 className='text-2xl font-black text-black flex items-center gap-2.5'>
						<ShieldCheck className='w-7 h-7 text-black' />
						<span>Manajemen & Pengesahan E-Rapor</span>
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-800'>
						Atur titimangsa, kendalikan kunci nilai 2-tingkat, master ekstrakurikuler, bank catatan, dan pleno kenaikan kelas.
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<span className='px-3.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
						{tahunAjaran} • Semester {semester}
					</span>
				</div>
			</div>

			{/* Navigasi Tab Menu Kurikulum */}
			<div className='flex flex-wrap gap-2.5 bg-white p-2 border-3 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000]'>
				<button
					onClick={() => setActiveTab('titimangsa')}
					className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
						activeTab === 'titimangsa'
							? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
							: 'text-gray-700 hover:bg-gray-100'
					}`}>
					<Calendar className='w-4 h-4' />
					<span>Titimangsa & Pejabat</span>
				</button>

				<button
					onClick={() => setActiveTab('locking')}
					className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
						activeTab === 'locking'
							? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
							: 'text-gray-700 hover:bg-gray-100'
					}`}>
					<Lock className='w-4 h-4' />
					<span>Kunci Nilai 2-Tingkat</span>
					{isLockedGlobal && (
						<span className='px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-black animate-pulse'>
							Locked
						</span>
					)}
				</button>

				<button
					onClick={() => setActiveTab('ekskul_catatan')}
					className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
						activeTab === 'ekskul_catatan'
							? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
							: 'text-gray-700 hover:bg-gray-100'
					}`}>
					<Award className='w-4 h-4' />
					<span>Master Ekskul & Catatan</span>
				</button>

				<button
					onClick={() => setActiveTab('pleno')}
					className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
						activeTab === 'pleno'
							? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
							: 'text-gray-700 hover:bg-gray-100'
					}`}>
					<Users className='w-4 h-4' />
					<span>Pleno Kenaikan Kelas</span>
					<span className='px-2 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-black'>
						Sem 2
					</span>
				</button>

				<button
					onClick={() => setActiveTab('juara_piagam')}
					className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
						activeTab === 'juara_piagam'
							? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
							: 'text-gray-700 hover:bg-gray-100'
					}`}>
					<Trophy className='w-4 h-4 text-amber-700' />
					<span>Juara & Piagam</span>
					<span className='px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-black'>
						Piagam
					</span>
				</button>
			</div>

			{/* ========================================================================= */}
			{/* TAB 1: TITIMANGSA & PEJABAT PENANDATANGAN                                  */}
			{/* ========================================================================= */}
			{activeTab === 'titimangsa' && (
				<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-6'>
					<div className='space-y-1 border-b-2 border-black pb-4'>
						<h2 className='text-lg sm:text-xl font-black text-black flex items-center gap-2'>
							<MapPin className='w-5 h-5 text-black' />
							<span>Identitas & Titimangsa Pencetakan Rapor</span>
						</h2>
						<p className='text-xs text-gray-600'>
							Nilai di bawah ini otomatis tampil seragam pada seluruh lembar cetak rapor santri di semua rombel.
						</p>
					</div>

					<form onSubmit={handleSaveSettings} className='space-y-5 max-w-4xl'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Nama Resmi Satuan Pendidikan
								</label>
								<input
									type='text'
									value={settings.nama_sekolah}
									onChange={(e) => setSettings({ ...settings, nama_sekolah: e.target.value })}
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Tempat Titimangsa Rapor (Kota / Desa)
								</label>
								<input
									type='text'
									value={settings.tempat_rapor}
									onChange={(e) => setSettings({ ...settings, tempat_rapor: e.target.value })}
									placeholder='Contoh: Kuala Gading'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none'
								/>
							</div>
						</div>

						<div>
							<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
								Alamat Lengkap Sekolah (Tampil di Kiri Atas Rapor)
							</label>
							<textarea
								rows='2'
								value={settings.alamat_sekolah}
								onChange={(e) => setSettings({ ...settings, alamat_sekolah: e.target.value })}
								placeholder='Alamat lengkap, jalan, desa, kecamatan, kabupaten, dan kode pos...'
								className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none leading-relaxed'
							/>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Tanggal Pembagian Rapor (Semester 1 / Ganjil)
								</label>
								<input
									type='text'
									value={settings.tanggal_rapor_ganjil}
									onChange={(e) => setSettings({ ...settings, tanggal_rapor_ganjil: e.target.value })}
									placeholder='Contoh: 20 Desember 2026'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Tanggal Pembagian Rapor (Semester 2 / Genap)
								</label>
								<input
									type='text'
									value={settings.tanggal_rapor_genap}
									onChange={(e) => setSettings({ ...settings, tanggal_rapor_genap: e.target.value })}
									placeholder='Contoh: 26 Juni 2027'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none'
								/>
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Nama Kepala Sekolah & Gelar
								</label>
								<input
									type='text'
									value={settings.nama_kepsek}
									onChange={(e) => setSettings({ ...settings, nama_kepsek: e.target.value })}
									placeholder='Contoh: Mujib Kodar, S.Pd,I'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									NIP / NPY Kepala Sekolah
								</label>
								<input
									type='text'
									value={settings.nip_kepsek}
									onChange={(e) => setSettings({ ...settings, nip_kepsek: e.target.value })}
									placeholder='Contoh: - atau 1985xxxx xxxx'
									className='w-full px-4 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-sm font-bold focus:bg-white focus:outline-none font-mono'
								/>
							</div>
						</div>

						<div className='pt-4'>
							<button
								type='submit'
								disabled={saving}
								className='px-6 py-3 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50'>
								<Save className='w-4 h-4' />
								<span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Titimangsa'}</span>
							</button>
						</div>
					</form>
				</div>
			)}

			{/* ========================================================================= */}
			{/* TAB 2: SISTEM KUNCI NILAI 2-TINGKAT                                      */}
			{/* ========================================================================= */}
			{activeTab === 'locking' && (
				<div className='space-y-6'>
					{/* Card Global Master Lock (Level 2) */}
					<div
						className={`p-6 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
							isLockedGlobal ? 'bg-rose-100' : 'bg-emerald-50'
						}`}>
						<div className='space-y-1.5'>
							<div className='flex items-center gap-2'>
								{isLockedGlobal ? (
									<Lock className='w-6 h-6 text-rose-600' />
								) : (
									<Unlock className='w-6 h-6 text-emerald-600' />
								)}
								<h3 className='text-lg font-black text-black'>
									Kunci Global E-Rapor (Level 2 — Kurikulum)
								</h3>
							</div>
							<p className='text-xs text-gray-700 max-w-2xl leading-relaxed'>
								{isLockedGlobal ? (
									<span className='font-bold text-rose-800'>
										E-Rapor sedang TERKUNCI TOTAL. Seluruh guru mapel dan wali kelas berstatus read-only (tidak dapat mengubah nilai dan catatan).
									</span>
								) : (
									<span>
										E-Rapor terbuka normal. Wali kelas dapat mengunci kelasnya masing-masing (Level 1) setelah verifikasi leger.
									</span>
								)}
							</p>
						</div>

						<button
							onClick={handleToggleGlobalLock}
							disabled={saving}
							className={`px-5 py-2.5 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs sm:text-sm cursor-pointer transition-all flex items-center gap-2 ${
								isLockedGlobal
									? 'bg-emerald-300 hover:bg-emerald-400 text-black'
									: 'bg-rose-400 hover:bg-rose-500 text-white'
							}`}>
							{isLockedGlobal ? <Unlock className='w-4 h-4' /> : <Lock className='w-4 h-4' />}
							<span>{isLockedGlobal ? 'Buka Kunci Global' : 'Kunci Seluruh E-Rapor'}</span>
						</button>
					</div>

					{/* Tabel Monitoring Kunci Rombel oleh Wali Kelas (Level 1) */}
					<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3'>
							<div>
								<h3 className='text-base sm:text-lg font-black text-black'>
									Status Kunci Nilai Rombel (Level 1 — Wali Kelas)
								</h3>
								<p className='text-xs text-gray-600'>
									Kelas yang terkunci oleh wali kelas menandakan nilai sudah difinalisasi dan tidak dapat diedit guru mapel.
								</p>
							</div>
							<button
								onClick={fetchInitialData}
								className='px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border-2 border-black rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer'>
								<RefreshCw className='w-3.5 h-3.5' />
								<span>Segarkan Status</span>
							</button>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full border-collapse text-xs sm:text-sm'>
								<thead>
									<tr className='bg-gray-100 border-b-2 border-black text-left'>
										<th className='p-3 font-black text-center w-12'>No</th>
										<th className='p-3 font-black w-32'>Kelas</th>
										<th className='p-3 font-black'>Wali Kelas</th>
										<th className='p-3 font-black text-center w-48'>Status Kunci Rombel</th>
										<th className='p-3 font-black text-center w-36'>Aksi Kurikulum</th>
									</tr>
								</thead>
								<tbody>
									{kelasList.map((k, idx) => {
										const lockInfo = lockMap[k.id];
										const isLocked = Boolean(lockInfo?.is_locked_wali || isLockedGlobal);

										return (
											<tr key={k.id} className='border-b border-gray-200 hover:bg-gray-50'>
												<td className='p-3 text-center font-bold'>{idx + 1}</td>
												<td className='p-3 font-black'>{k.nama_kelas}</td>
												<td className='p-3 font-semibold text-gray-800'>
													{k.wali_kelas || k.wali?.nama_lengkap || 'Belum Ditugaskan'}
												</td>
												<td className='p-3 text-center'>
													{isLocked ? (
														<span className='inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 border-2 border-amber-400 rounded-xl text-xs font-black shadow-[1px_1px_0px_#000]'>
															<Lock className='w-3 h-3 text-amber-700' />
															<span>Terkunci ({lockInfo?.locked_by_name || 'Wali Kelas'})</span>
														</span>
													) : (
														<span className='inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border-2 border-emerald-400 rounded-xl text-xs font-black'>
															<Unlock className='w-3 h-3 text-emerald-700' />
															<span>Terbuka (Input Aktif)</span>
														</span>
													)}
												</td>
												<td className='p-3 text-center'>
													<button
														onClick={() => handleToggleClassLock(k.id, Boolean(lockInfo?.is_locked_wali))}
														className={`px-3 py-1.5 rounded-lg border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] cursor-pointer transition-all ${
															lockInfo?.is_locked_wali
																? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
																: 'bg-yellow-200 hover:bg-yellow-300 text-black'
														}`}>
														{lockInfo?.is_locked_wali ? 'Buka Kunci' : 'Kunci Rombel'}
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* TAB 3: MASTER EKSTRAKURIKULER & BANK TEMPLATE CATATAN                     */}
			{/* ========================================================================= */}
			{activeTab === 'ekskul_catatan' && (
				<div className='space-y-6'>
					<div className='flex gap-2 border-b-2 border-black pb-2'>
						<button
							onClick={() => setSubTabEkskulCatatan('ekskul')}
							className={`px-4 py-2 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
								subTabEkskulCatatan === 'ekskul'
									? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
									: 'bg-gray-100 hover:bg-white'
							}`}>
							🏆 Master Ekstrakurikuler ({ekskulList.length})
						</button>
						<button
							onClick={() => setSubTabEkskulCatatan('catatan')}
							className={`px-4 py-2 rounded-xl text-xs font-black border-2 border-black cursor-pointer transition-all ${
								subTabEkskulCatatan === 'catatan'
									? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
									: 'bg-gray-100 hover:bg-white'
							}`}>
							📝 Bank Template Catatan Wali Kelas ({templateList.length})
						</button>
					</div>

					{/* SUBTAB A: MASTER EKSTRAKURIKULER */}
					{subTabEkskulCatatan === 'ekskul' && (
						<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-6'>
							<div className='space-y-1'>
								<div className='flex items-center gap-2'>
									<h3 className='text-lg font-black text-black'>Daftar Ekstrakurikuler Pilihan & Pramuka Wajib</h3>
									<span className='px-2.5 py-0.5 bg-yellow-200 border border-black rounded-lg text-xs font-black'>
										{ekskulList.length} Kegiatan
									</span>
								</div>
								<p className='text-xs text-gray-600'>
									Katalog kegiatan ekstrakurikuler non-mapel yang dapat dipilih dan diikuti siswa di halaman Wali Kelas.
								</p>
							</div>

							<div className='p-3.5 bg-purple-50 border-2 border-purple-300 rounded-2xl flex items-start sm:items-center gap-3 text-xs text-purple-950'>
								<span className='text-xl shrink-0'>💡</span>
								<div className='leading-relaxed'>
									<strong>Pemisahan Manajemen:</strong> Halaman ini khusus mengelola <strong>Praja Muda Karana (Pramuka Wajib)</strong> dan <strong>Ekstrakurikuler Pilihan</strong> (Futsal, Hadrah, PMR, Seni, dll). Adapun mata pelajaran muatan pesantren (<strong>Aswaja &amp; Khot</strong>) kini dikelola terpusat langsung di menu <strong>Kurikulum &gt; Master Mapel</strong> lengkap dengan tombol urutan dan checkbox jenjang kelasnya.
								</div>
							</div>

							{/* Form Tambah Ekskul */}
							<div className='p-4 bg-gray-50 border-2 border-black rounded-2xl flex flex-wrap gap-3 items-end'>
								<div className='flex-1 min-w-[200px]'>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>
										Nama Kegiatan Ekstrakurikuler
									</label>
									<input
										type='text'
										value={newEkskul.nama_ekskul}
										onChange={(e) => setNewEkskul({ ...newEkskul, nama_ekskul: e.target.value })}
										placeholder="Contoh: Tahfidz Al-Qur'an"
										className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold'
									/>
								</div>

								<div className='w-40'>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>
										Kategori
									</label>
									<select
										value={newEkskul.kategori}
										onChange={(e) => setNewEkskul({ ...newEkskul, kategori: e.target.value })}
										className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
										<option value='Wajib'>Wajib (Pramuka)</option>
										<option value='Pilihan'>Pilihan</option>
									</select>
								</div>

								<div className='w-full sm:w-auto'>
									<div className='flex items-center justify-between gap-2 mb-1.5'>
										<label className='block text-[10px] font-black uppercase text-gray-600'>
											Target Jenjang Kelas:
										</label>
										<button
											type='button'
											onClick={() => setNewEkskul({ ...newEkskul, tingkat: [7, 8, 9] })}
											className='text-[10px] font-black text-blue-600 hover:underline cursor-pointer'>
											Pilih Semua (7, 8, 9)
										</button>
									</div>
									<div className='flex items-center gap-1.5 flex-wrap'>
										{[7, 8, 9].map((t) => {
											const currentList = Array.isArray(newEkskul.tingkat) ? newEkskul.tingkat : [7, 8, 9];
											const isChecked = currentList.includes(t);
											return (
												<label
													key={t}
													className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer flex items-center gap-1.5 transition-all select-none ${
														isChecked
															? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
															: 'bg-white text-gray-400 hover:bg-gray-100'
													}`}>
													<input
														type='checkbox'
														checked={isChecked}
														onChange={(e) => {
															let next = e.target.checked
																? [...currentList, t].sort((a, b) => a - b)
																: currentList.filter((x) => x !== t);
															if (next.length === 0) next = [t]; // minimal 1 jenjang
															setNewEkskul({ ...newEkskul, tingkat: next });
														}}
														className='w-3.5 h-3.5 accent-black rounded cursor-pointer'
													/>
													<span>Kelas {t}</span>
												</label>
											);
										})}
									</div>
								</div>

								<div className='flex-1 min-w-[250px]'>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>
										Deskripsi Standar Rapor
									</label>
									<input
										type='text'
										value={newEkskul.deskripsi_standar}
										onChange={(e) => setNewEkskul({ ...newEkskul, deskripsi_standar: e.target.value })}
										placeholder='Keterangan capaian standar...'
										className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold'
									/>
								</div>

								<button
									onClick={handleAddEkskul}
									className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
									<Plus className='w-4 h-4' />
									<span>Tambah</span>
								</button>
							</div>

							{/* Tabel Ekskul */}
							<div className='overflow-x-auto'>
								<table className='w-full border-collapse text-xs sm:text-sm'>
									<thead>
										<tr className='bg-gray-100 border-b-2 border-black text-left'>
											<th className='p-3 text-center w-12'>No</th>
											<th className='p-3 w-56'>Nama Ekstrakurikuler</th>
											<th className='p-3 w-32 text-center'>Kategori</th>
											<th className='p-3 w-56 text-center'>Target Jenjang (Centang Kelas)</th>
											<th className='p-3'>Deskripsi Standar</th>
											<th className='p-3 text-center w-20'>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{ekskulList.map((e, idx) => (
											<tr key={e.id || idx} className='border-b border-gray-200 hover:bg-gray-50'>
												<td className='p-3 text-center font-bold'>{idx + 1}</td>
												<td className='p-3 font-black text-black'>{e.nama_ekskul}</td>
												<td className='p-3 text-center'>
													<span
														className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
															e.kategori === 'Wajib'
																? 'bg-blue-100 text-blue-800 border-blue-400'
																: e.kategori === 'Wajib Pondok'
																? 'bg-emerald-100 text-emerald-800 border-emerald-400'
																: 'bg-gray-100 text-gray-800 border-gray-400'
														}`}>
														{e.kategori}
													</span>
												</td>
												<td className='p-3 text-center'>
													<div className='inline-flex items-center gap-1.5 p-1 bg-gray-50 border-2 border-black/20 rounded-xl shadow-[1px_1px_0px_#000]'>
														{[7, 8, 9].map((t) => {
															const activeTingkat = normalizeTingkatArray(e.tingkat, e.nama_ekskul);
															const isChecked = activeTingkat.includes(t);
															return (
																<button
																	key={t}
																	type='button'
																	onClick={() => handleToggleEkskulTingkat(e.id, t)}
																	className={`px-2 py-1 rounded-lg text-[11px] font-black border-2 border-black transition-all flex items-center gap-1 cursor-pointer select-none ${
																		isChecked
																			? t === 9
																				? 'bg-indigo-300 text-indigo-950 shadow-[1px_1px_0px_#000]'
																				: t === 8
																				? 'bg-purple-300 text-purple-950 shadow-[1px_1px_0px_#000]'
																				: 'bg-amber-300 text-amber-950 shadow-[1px_1px_0px_#000]'
																			: 'bg-white text-gray-400 hover:bg-gray-100 border-gray-300 opacity-60'
																	}`}
																	title={isChecked ? `Kelas ${t} Aktif (Klik untuk nonaktifkan)` : `Kelas ${t} Nonaktif (Klik untuk aktifkan)`}>
																	<span className={`text-[10px] ${isChecked ? 'font-black' : 'text-gray-400'}`}>
																		{isChecked ? '✓' : '✗'}
																	</span>
																	<span>Kls {t}</span>
																</button>
															);
														})}
													</div>
													<div className='mt-1 text-[10px] font-bold text-gray-600'>
														{(() => {
															const activeTingkat = normalizeTingkatArray(e.tingkat, e.nama_ekskul);
															if (activeTingkat.length === 3) return 'Semua Kelas (7, 8, 9)';
															if (activeTingkat.length === 0) return 'Belum Diatur';
															return `Kelas ${activeTingkat.join(' & ')}`;
														})()}
													</div>
												</td>
												<td className='p-3 text-gray-700'>{e.deskripsi_standar || '-'}</td>
												<td className='p-3 text-center'>
													<button
														onClick={() => handleDeleteEkskul(e.id, e.nama_ekskul)}
														className='p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer'
														title='Hapus Ekstrakurikuler'>
														<Trash2 className='w-4 h-4' />
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* SUBTAB B: BANK TEMPLATE CATATAN WALI KELAS */}
					{subTabEkskulCatatan === 'catatan' && (
						<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-6'>
							<div className='space-y-1'>
								<h3 className='text-lg font-black text-black'>Bank Preset Catatan Wali Kelas</h3>
								<p className='text-xs text-gray-600'>
									Preset kalimat pembinaan karakter yang dapat dipilih langsung oleh wali kelas saat mengisi rapor.
								</p>
							</div>

							{/* Form Tambah Template */}
							<div className='p-4 bg-gray-50 border-2 border-black rounded-2xl space-y-3'>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
									<div>
										<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>Kategori</label>
										<select
											value={newTemplate.kategori}
											onChange={(e) => setNewTemplate({ ...newTemplate, kategori: e.target.value })}
											className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
											<option value='Prestasi'>Prestasi</option>
											<option value='Motivasi'>Motivasi</option>
											<option value='Kedisiplinan'>Kedisiplinan</option>
											<option value='Spiritual'>Spiritual</option>
										</select>
									</div>
									<div className='sm:col-span-2'>
										<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>Judul / Label</label>
										<input
											type='text'
											value={newTemplate.judul}
											onChange={(e) => setNewTemplate({ ...newTemplate, judul: e.target.value })}
											placeholder='Contoh: Dorongan Belajar Tekun'
											className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold'
										/>
									</div>
								</div>
								<div>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-1'>Isi Catatan Karakter</label>
									<textarea
										rows='2'
										value={newTemplate.isi_catatan}
										onChange={(e) => setNewTemplate({ ...newTemplate, isi_catatan: e.target.value })}
										placeholder='Tuliskan narasi motivasi atau catatan evaluasi siswa...'
										className='w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold'
									/>
								</div>
								<div className='flex justify-end'>
									<button
										onClick={handleAddTemplate}
										className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
										<Plus className='w-4 h-4' />
										<span>Tambah Preset Catatan</span>
									</button>
								</div>
							</div>

							{/* Daftar Template Catatan */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								{templateList.map((t, idx) => (
									<div
										key={t.id || idx}
										className='p-4 bg-white border-2 border-black rounded-2xl shadow-[2px_2px_0px_#000] space-y-2 relative'>
										<div className='flex items-center justify-between'>
											<span
												className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
													t.kategori === 'Prestasi'
														? 'bg-emerald-100 text-emerald-800 border-emerald-400'
														: t.kategori === 'Spiritual'
														? 'bg-blue-100 text-blue-800 border-blue-400'
														: t.kategori === 'Kedisiplinan'
														? 'bg-amber-100 text-amber-800 border-amber-400'
														: 'bg-purple-100 text-purple-800 border-purple-400'
												}`}>
												{t.kategori}
											</span>
											<button
												onClick={() => handleDeleteTemplate(t.id, t.judul)}
												className='text-gray-400 hover:text-rose-600 cursor-pointer'
												title='Hapus Template Catatan'>
												<Trash2 className='w-3.5 h-3.5' />
											</button>
										</div>
										<h4 className='text-xs font-black text-black'>{t.judul}</h4>
										<p className='text-xs text-gray-700 leading-relaxed italic'>"{t.isi_catatan}"</p>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* ========================================================================= */}
			{/* TAB 4: PLENO KENAIKAN KELAS (4 KRITERIA RESMI KURIKULUM)                   */}
			{/* ========================================================================= */}
			{activeTab === 'pleno' && (
				<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-6'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4'>
						<div>
							<h3 className='text-lg font-black text-black flex items-center gap-2'>
								<Users className='w-5 h-5 text-black' />
								<span>Evaluasi & Pleno Kenaikan Kelas (Semester Genap)</span>
							</h3>
							<p className='text-xs text-gray-600'>
								Evaluasi otomatis 4 kriteria resmi Kurikulum SMP IT Tebuireng 4 Al-Ishlah sebelum keputusan final pleno.
							</p>
						</div>

						{/* Filter Kelas */}
						<div className='flex items-center gap-2'>
							<span className='text-xs font-black uppercase text-gray-600'>Pilih Rombel:</span>
							<select
								value={selectedPlenoKelasId}
								onChange={(e) => setSelectedPlenoKelasId(e.target.value)}
								className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
								{kelasList.map((k) => (
									<option key={k.id} value={k.id}>
										{k.nama_kelas}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* 4 Panduan Kriteria Resmi */}
					<div className='grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-4 border-2 border-black rounded-2xl text-xs'>
						<div className='space-y-1'>
							<span className='font-black text-blue-700 block'>Kriteria 1 (KKTP)</span>
							<p className='text-[11px] text-gray-700 leading-snug'>
								Tidak memiliki lebih dari <strong>2 nilai rata-rata mapel</strong> yang tidak tuntas.
							</p>
						</div>
						<div className='space-y-1'>
							<span className='font-black text-amber-700 block'>Kriteria 2 (Presensi)</span>
							<p className='text-[11px] text-gray-700 leading-snug'>
								Ketidakhadiran (Alpa) tidak melebihi <strong>10% total jam belajar</strong> (~20 hari).
							</p>
						</div>
						<div className='space-y-1'>
							<span className='font-black text-emerald-700 block'>Kriteria 3 (Sikap)</span>
							<p className='text-[11px] text-gray-700 leading-snug'>
								Minimal memiliki perilaku baik (<strong>KI-1 & KI-2 minimal predikat B</strong> dari sistem poin).
							</p>
						</div>
						<div className='space-y-1'>
							<span className='font-black text-purple-700 block'>Kriteria 4 (Tuntas)</span>
							<p className='text-[11px] text-gray-700 leading-snug'>
								Menyelesaikan seluruh program pembelajaran di <strong>Semester 1 dan 2</strong>.
							</p>
						</div>
					</div>

					{/* Ringkasan Statistik Kelas */}
					{plenoData && (
						<div className='flex flex-wrap gap-3 items-center justify-between text-xs font-bold'>
							<div className='flex items-center gap-2'>
								<span className='px-3 py-1 bg-emerald-100 text-emerald-800 border-2 border-emerald-400 rounded-xl'>
									Lolos Kriteria: {plenoData.memenuhi_syarat_count} Siswa
								</span>
								<span className='px-3 py-1 bg-amber-100 text-amber-800 border-2 border-amber-400 rounded-xl'>
									Perlu Pembahasan Pleno: {plenoData.perlu_pembahasan_count} Siswa
								</span>
							</div>

							<button
								onClick={handleSavePlenoDecisions}
								disabled={saving}
								className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50'>
								<Save className='w-4 h-4' />
								<span>{saving ? 'Menyimpan...' : 'Simpan Seluruh Keputusan Pleno'}</span>
							</button>
						</div>
					)}

					{/* Tabel Siswa & Evaluasi Kriteria Pleno */}
					{loadingPleno ? (
						<div className='p-8 text-center'>
							<Loader />
							<p className='text-xs font-bold text-gray-600 mt-2'>Mengevaluasi 4 kriteria santri...</p>
						</div>
					) : !plenoData?.evaluasi || plenoData.evaluasi.length === 0 ? (
						<div className='p-8 text-center text-gray-500 font-bold text-xs'>
							Tidak ada data santri aktif pada rombel ini.
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full border-collapse text-xs'>
								<thead>
									<tr className='bg-gray-100 border-b-2 border-black text-left'>
										<th className='p-2.5 text-center w-10'>No</th>
										<th className='p-2.5 w-48'>Nama Santri</th>
										<th className='p-2.5 text-center w-24'>K1 (KKTP)</th>
										<th className='p-2.5 text-center w-24'>K2 (Alpa)</th>
										<th className='p-2.5 text-center w-24'>K3 (Sikap)</th>
										<th className='p-2.5 text-center w-24'>K4 (Tuntas)</th>
										<th className='p-2.5 text-center w-40'>Rekomendasi Sistem</th>
										<th className='p-2.5 text-center w-52'>Keputusan Pleno Final</th>
									</tr>
								</thead>
								<tbody>
									{plenoData.evaluasi.map((item, idx) => {
										const isPass = item.status_rekomendasi === 'Memenuhi Syarat Kenaikan';
										const currentDecision = plenoDecisions[item.siswa_id]?.keputusan || item.default_next_class;

										return (
											<tr key={item.siswa_id} className='border-b border-gray-200 hover:bg-gray-50'>
												<td className='p-2.5 text-center font-bold'>{idx + 1}</td>
												<td className='p-2.5'>
													<span className='font-black text-black block'>{item.nama_lengkap}</span>
													<span className='text-[10px] text-gray-500'>{item.nis} / {item.nisn}</span>
												</td>
												{/* K1: Mapel KKTP */}
												<td className='p-2.5 text-center'>
													{item.kriteria.k1_mapel_tuntas.pass ? (
														<span className='text-emerald-700 font-bold'>
															{item.kriteria.k1_mapel_tuntas.tidak_tuntas_count === 0 ? 'Tuntas' : `${item.kriteria.k1_mapel_tuntas.tidak_tuntas_count} Bawah KKTP`}
														</span>
													) : (
														<span className='text-rose-600 font-bold'>
															{item.kriteria.k1_mapel_tuntas.tidak_tuntas_count} Bawah KKTP
														</span>
													)}
												</td>
												{/* K2: Alpa */}
												<td className='p-2.5 text-center'>
													<span className={item.kriteria.k2_alpa.pass ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
														{item.kriteria.k2_alpa.total_alpa} Hari
													</span>
												</td>
												{/* K3: Sikap */}
												<td className='p-2.5 text-center'>
													<span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
														item.kriteria.k3_sikap.predikat === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
														item.kriteria.k3_sikap.predikat === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
														'bg-rose-100 text-rose-800 border-rose-300'
													}`}>
														Predikat {item.kriteria.k3_sikap.predikat}
													</span>
												</td>
												{/* K4: Kelengkapan */}
												<td className='p-2.5 text-center'>
													{item.kriteria.k4_kelengkapan.pass ? (
														<span className='text-emerald-700 font-bold'>Lengkap</span>
													) : (
														<span className='text-amber-600 font-bold'>Belum Lengkap</span>
													)}
												</td>
												{/* Rekomendasi */}
												<td className='p-2.5 text-center'>
													{isPass ? (
														<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-400 rounded-lg text-[10px] font-black'>
															<Check className='w-3 h-3 text-emerald-700' />
															<span>Memenuhi Syarat</span>
														</span>
													) : (
														<span
															title={item.alasan_sistem?.join('; ')}
															className='inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-400 rounded-lg text-[10px] font-black cursor-help'>
															<AlertTriangle className='w-3 h-3 text-amber-700' />
															<span>Bahasp Pleno</span>
														</span>
													)}
												</td>
												{/* Form Keputusan Pleno */}
												<td className='p-2.5 text-center'>
													<select
														value={currentDecision}
														onChange={(e) => {
															setPlenoDecisions({
																...plenoDecisions,
																[item.siswa_id]: {
																	...plenoDecisions[item.siswa_id],
																	keputusan: e.target.value,
																},
															});
														}}
														className='px-2.5 py-1 bg-white border-2 border-black rounded-lg text-xs font-bold cursor-pointer'>
														<option value={item.default_next_class}>{item.default_next_class}</option>
														<option value={`Tinggal di Kelas ${plenoData.kelas.nama_kelas}`}>
															Tinggal di Kelas {plenoData.kelas.nama_kelas}
														</option>
														<option value='Lulus dari Satuan Pendidikan'>Lulus dari Satuan Pendidikan</option>
													</select>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* ========================================================================= */}
			{/* TAB 5: JUARA KELAS, JUARA UMUM & CETAK PIAGAM                             */}
			{/* ========================================================================= */}
			{activeTab === 'juara_piagam' && (
				<div className='bg-white p-6 sm:p-8 border-3 border-black rounded-3xl shadow-[4px_4px_0px_0px_#000] space-y-6'>
					{/* Header Tab Juara & Piagam */}
					<div className='bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-100 border-2 border-black rounded-2xl p-5 shadow-[3px_3px_0px_0px_#000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
						<div>
							<div className='inline-flex items-center gap-2 px-3 py-1 bg-black text-amber-300 rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] mb-2'>
								<Trophy className='w-4 h-4' />
								<span>Prestasi Belajar & Piagam Penghargaan</span>
							</div>
							<h2 className='text-xl sm:text-2xl font-black text-black tracking-tight'>
								Juara Kelas & Juara Umum (E-Rapor)
							</h2>
							<p className='text-xs text-gray-700 font-medium mt-1 max-w-2xl'>
								Pemeringkatan resmi hasil belajar akademik santri / siswa, podium prestasi, serta fasilitas pencetakan piagam penghargaan berbingkai emas resmi sekolah.
							</p>
						</div>

						<div className='flex items-center gap-2 shrink-0 flex-wrap'>
							<span className='px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
								TA {tahunAjaran} • Sem {semester}
							</span>
							<button
								onClick={fetchJuaraData}
								disabled={loadingJuara}
								className='p-2 bg-white hover:bg-gray-100 border-2 border-black rounded-xl text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-all'
								title='Segarkan Data'>
								<RefreshCw className={`w-4 h-4 ${loadingJuara ? 'animate-spin' : ''}`} />
							</button>
							<button
								onClick={handleExportJuaraExcel}
								className='px-3.5 py-2 bg-emerald-300 hover:bg-emerald-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-all cursor-pointer'>
								<FileSpreadsheet className='w-4 h-4' />
								<span>Ekspor Excel</span>
							</button>
						</div>
					</div>

					{/* Sub Tab Switcher & Quick Actions */}
					<div className='flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-2 border-2 border-black rounded-2xl'>
						<div className='flex items-center gap-2'>
							<button
								onClick={() => setJuaraSubTab('kelas')}
								className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
									juaraSubTab === 'kelas'
										? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
										: 'text-gray-700 hover:bg-gray-200'
								}`}>
								<Award className='w-4 h-4' />
								<span>Juara Kelas (Per Rombel)</span>
							</button>

							<button
								onClick={() => setJuaraSubTab('umum')}
								className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
									juaraSubTab === 'umum'
										? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
										: 'text-gray-700 hover:bg-gray-200'
								}`}>
								<Crown className='w-4 h-4 text-amber-700' />
								<span>Juara Umum (Tingkat & Sekolah)</span>
								<span className='px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-black'>
									Grand
								</span>
							</button>
						</div>

						{/* Quick Actions Cetak Piagam Massal */}
						<div className='flex items-center gap-2 flex-wrap'>
							{juaraSubTab === 'kelas' ? (
								<>
									<button
										onClick={handleCetakPiagamTop3Kelas}
										className='px-3 py-1.5 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
										<Printer className='w-3.5 h-3.5' />
										<span>Cetak Piagam Juara 1-3 ({selectedJuaraKelas})</span>
									</button>
									<button
										onClick={handleCetakSemuaJuaraKelas}
										className='px-3 py-1.5 bg-rose-300 hover:bg-rose-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
										<Award className='w-3.5 h-3.5' />
										<span>Cetak Semua Juara Kelas (Batch)</span>
									</button>
								</>
							) : (
								<button
									onClick={handleCetakPiagamJuaraUmum}
									className='px-3 py-1.5 bg-amber-400 hover:bg-amber-500 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer'>
									<Crown className='w-3.5 h-3.5' />
									<span>Cetak Piagam Juara Umum Top 3</span>
								</button>
							)}
						</div>
					</div>

					{loadingJuara ? (
						<div className='py-12'>
							<Loader text='Memuat data rekapitulasi juara & piagam...' />
						</div>
					) : (
						<>
							{/* ================================================================= */}
							{/* SUB TAB A: JUARA KELAS (PER ROMBEL)                               */}
							{/* ================================================================= */}
							{juaraSubTab === 'kelas' && (
								<div className='space-y-6'>
									{/* Toolbar Pemilihan Rombel Kelas & Pencarian */}
									<div className='bg-gray-50 border-2 border-black rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
										<div className='flex flex-wrap items-center gap-3 flex-1'>
											<div className='flex items-center gap-2'>
												<span className='text-xs font-black uppercase text-gray-700 flex items-center gap-1.5'>
													<Filter className='w-4 h-4' />
													<span>Pilih Rombel:</span>
												</span>
												<select
													value={selectedJuaraKelas}
													onChange={(e) => setSelectedJuaraKelas(e.target.value)}
													className='px-3 py-2 bg-yellow-100 border-2 border-black rounded-xl text-xs font-black cursor-pointer shadow-[2px_2px_0px_#000] focus:outline-none'>
													<option value='ALL'>★ Rekap Semua Rombel (Juara 1-3)</option>
													{kelasListJuara.map((k) => (
														<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
															Kelas {k.nama_kelas} (Juara 1-3)
														</option>
													))}
												</select>
											</div>

											<div className='relative flex-1 min-w-[200px]'>
												<input
													type='text'
													value={juaraSearchQuery}
													onChange={(e) => setJuaraSearchQuery(e.target.value)}
													placeholder='Cari nama atau NIS santri...'
													className='w-full pl-8 pr-3 py-2 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000] focus:outline-none bg-white'
												/>
												<Search className='w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400' />
											</div>
										</div>

										<div className='text-xs font-bold text-gray-600 shrink-0'>
											Total: <span className='font-black text-black'>{currentJuaraClassStudents.length} Santri Juara (1–3)</span>
										</div>
									</div>

									{/* PODIUM TOP 3 JUARA KELAS */}
									{selectedJuaraKelas === 'ALL' ? (
										<div className='bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_#000] flex items-center gap-3'>
											<Trophy className='w-6 h-6 text-amber-600 shrink-0' />
											<p className='text-xs font-bold text-gray-800'>
												Menampilkan rekapitulasi peringkat <span className='font-black text-black'>Juara I, II, dan III (Top 3)</span> dari setiap rombel kelas di sekolah. Pilih rombel tertentu pada filter dropdown untuk melihat podium visual per kelas.
											</p>
										</div>
									) : (
										<div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
											{/* Juara 2 (Perak) */}
											<div className='order-2 md:order-1 bg-gradient-to-b from-slate-100 to-slate-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3 relative overflow-hidden'>
												<div className='w-12 h-12 mx-auto rounded-full bg-slate-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
													🥈
												</div>
												<span className='inline-block px-3 py-0.5 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
													Juara II Kelas
												</span>
												<div>
													<h3 className='text-base font-black text-black line-clamp-1'>
														{top3JuaraKelas[1]?.nama_lengkap || 'Belum Ada Data'}
													</h3>
													<p className='text-[11px] font-mono font-bold text-gray-600'>NIS: {top3JuaraKelas[1]?.nis || '-'}</p>
												</div>
												<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
													<p className='text-xs font-black text-slate-900'>Rata-Rata: {top3JuaraKelas[1]?.rata_rata || '0.00'}</p>
													<p className='text-[10px] font-bold text-gray-500'>Total: {top3JuaraKelas[1]?.total_nilai || 0}</p>
												</div>
												{top3JuaraKelas[1] && (
													<button
														onClick={() => handleCetakPiagamSingle(top3JuaraKelas[1], `JUARA II KELAS ${selectedJuaraKelas}`)}
														className='w-full py-2 bg-slate-300 hover:bg-slate-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
														<Printer className='w-3.5 h-3.5' />
														<span>Cetak Piagam Juara 2</span>
													</button>
												)}
											</div>

											{/* Juara 1 (Emas - Center Big) */}
											<div className='order-1 md:order-2 bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-200 border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] text-center space-y-3 relative overflow-hidden -translate-y-2'>
												<div className='w-16 h-16 mx-auto rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-3xl font-black shadow-[3px_3px_0px_#000]'>
													🥇
												</div>
												<span className='inline-block px-4 py-1 bg-amber-950 text-yellow-300 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]'>
													★ JUARA I KELAS ★
												</span>
												<div>
													<h3 className='text-lg font-black text-black line-clamp-1'>
														{top3JuaraKelas[0]?.nama_lengkap || 'Belum Ada Data'}
													</h3>
													<p className='text-xs font-mono font-bold text-amber-900'>NIS: {top3JuaraKelas[0]?.nis || '-'}</p>
												</div>
												<div className='p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
													<p className='text-sm font-black text-amber-950'>Rata-Rata: {top3JuaraKelas[0]?.rata_rata || '0.00'}</p>
													<p className='text-[11px] font-bold text-gray-600'>Total Nilai: {top3JuaraKelas[0]?.total_nilai || 0}</p>
												</div>
												{top3JuaraKelas[0] && (
													<button
														onClick={() => handleCetakPiagamSingle(top3JuaraKelas[0], `JUARA I KELAS ${selectedJuaraKelas}`)}
														className='w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
														<Trophy className='w-4 h-4' />
														<span>Cetak Piagam Juara 1</span>
													</button>
												)}
											</div>

											{/* Juara 3 (Perunggu) */}
											<div className='order-3 md:order-3 bg-gradient-to-b from-amber-100 to-amber-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3 relative overflow-hidden'>
												<div className='w-12 h-12 mx-auto rounded-full bg-amber-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
													🥉
												</div>
												<span className='inline-block px-3 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
													Juara III Kelas
												</span>
												<div>
													<h3 className='text-base font-black text-black line-clamp-1'>
														{top3JuaraKelas[2]?.nama_lengkap || 'Belum Ada Data'}
													</h3>
													<p className='text-[11px] font-mono font-bold text-gray-600'>NIS: {top3JuaraKelas[2]?.nis || '-'}</p>
												</div>
												<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
													<p className='text-xs font-black text-amber-950'>Rata-Rata: {top3JuaraKelas[2]?.rata_rata || '0.00'}</p>
													<p className='text-[10px] font-bold text-gray-500'>Total: {top3JuaraKelas[2]?.total_nilai || 0}</p>
												</div>
												{top3JuaraKelas[2] && (
													<button
														onClick={() => handleCetakPiagamSingle(top3JuaraKelas[2], `JUARA III KELAS ${selectedJuaraKelas}`)}
														className='w-full py-2 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all'>
														<Printer className='w-3.5 h-3.5' />
														<span>Cetak Piagam Juara 3</span>
													</button>
												)}
											</div>
										</div>
									)}

									{/* Tabel Peringkat Lengkap Rombel */}
									<div className='bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] overflow-hidden'>
										<div className='p-4 border-b-2 border-black bg-yellow-200 flex items-center justify-between'>
											<h3 className='text-sm font-black text-black uppercase flex items-center gap-2'>
												<Award className='w-4 h-4' />
												<span>
													{selectedJuaraKelas === 'ALL'
														? 'Rekapitulasi Juara I, II, dan III Seluruh Rombel'
														: `Daftar Juara I, II, dan III (Top 3) — Kelas ${selectedJuaraKelas}`}
												</span>
											</h3>
											{selectedJuaraKelas !== 'ALL' && (
												<span className='text-xs font-bold text-gray-700'>
													Wali Kelas: {top3JuaraKelas[0]?.wali_kelas || 'Belum Terploting'}
												</span>
											)}
										</div>

										<div className='overflow-x-auto'>
											<table className='w-full text-left border-collapse text-xs'>
												<thead>
													<tr className='border-b-2 border-black bg-gray-50 font-black uppercase text-[11px] text-gray-700'>
														<th className='py-3 px-4 text-center w-16'>Rank</th>
														{selectedJuaraKelas === 'ALL' && <th className='py-3 px-4 text-center'>Rombel</th>}
														<th className='py-3 px-4'>NIS</th>
														<th className='py-3 px-4'>Nama Lengkap Santri / Siswa</th>
														<th className='py-3 px-4 text-center'>Total Nilai</th>
														<th className='py-3 px-4 text-center'>Rata-Rata</th>
														<th className='py-3 px-4 text-center'>Predikat Prestasi</th>
														<th className='py-3 px-4 text-right'>Aksi Piagam</th>
													</tr>
												</thead>
												<tbody className='divide-y-2 divide-gray-100 font-bold'>
													{currentJuaraClassStudents.length === 0 ? (
														<tr>
															<td colSpan={selectedJuaraKelas === 'ALL' ? 8 : 7} className='text-center py-8 text-gray-500'>
																Belum ada data nilai yang diinput untuk kategori ini.
															</td>
														</tr>
													) : (
														currentJuaraClassStudents.map((item) => {
															const isTop3 = item.rank_kelas <= 3;
															const badgeColor =
																item.rank_kelas === 1
																	? 'bg-amber-300 border-amber-600 text-amber-950 font-black'
																	: item.rank_kelas === 2
																	? 'bg-slate-200 border-slate-400 text-slate-900 font-black'
																	: item.rank_kelas === 3
																	? 'bg-amber-100 border-amber-500 text-amber-900 font-black'
																	: 'bg-gray-100 border-gray-300 text-gray-700';

															return (
																<tr
																	key={`${item.id}-${item.kelas}`}
																	className={`hover:bg-yellow-50/60 transition-colors ${
																		isTop3 ? 'bg-yellow-50/30 font-bold' : ''
																	}`}>
																	<td className='py-3 px-4 text-center'>
																		<span
																			className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-black font-black text-xs shadow-[1px_1px_0px_#000] ${
																				item.rank_kelas === 1
																					? 'bg-yellow-400 text-black'
																					: item.rank_kelas === 2
																					? 'bg-slate-300 text-black'
																					: item.rank_kelas === 3
																					? 'bg-amber-300 text-black'
																					: 'bg-white text-gray-700'
																			}`}>
																			{item.rank_kelas}
																		</span>
																	</td>
																	{selectedJuaraKelas === 'ALL' && (
																		<td className='py-3 px-4 text-center'>
																			<span className='px-2.5 py-0.5 bg-black text-yellow-300 rounded font-black text-xs'>
																				{item.kelas}
																			</span>
																		</td>
																	)}
																	<td className='py-3 px-4 font-mono text-gray-600'>{item.nis || '-'}</td>
																	<td className='py-3 px-4 text-black font-black'>
																		<div className='flex items-center gap-2'>
																			<span>{item.nama_lengkap}</span>
																			{item.rank_kelas === 1 && <span title='Juara 1'>👑</span>}
																		</div>
																	</td>
																	<td className='py-3 px-4 text-center font-mono'>{item.total_nilai}</td>
																	<td className='py-3 px-4 text-center'>
																		<span className='px-2.5 py-1 bg-white border-2 border-black rounded-lg font-black font-mono shadow-[1px_1px_0px_#000]'>
																			{item.rata_rata}
																		</span>
																	</td>
																	<td className='py-3 px-4 text-center'>
																		<span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${badgeColor}`}>
																			{item.juara_label}
																		</span>
																	</td>
																	<td className='py-3 px-4 text-right'>
																		<button
																			onClick={() => handleCetakPiagamSingle(item)}
																			className='px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 cursor-pointer'>
																			<Printer className='w-3 h-3' />
																			<span>Cetak Piagam</span>
																		</button>
																	</td>
																</tr>
															);
														})
													)}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}

							{/* ================================================================= */}
							{/* SUB TAB B: JUARA UMUM (TINGKAT & KESELURUHAN SEKOLAH)             */}
							{/* ================================================================= */}
							{juaraSubTab === 'umum' && (
								<div className='space-y-6'>
									{/* Toolbar Filter Tingkat Juara Umum */}
									<div className='bg-gray-50 border-2 border-black rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
										<div className='flex flex-wrap items-center gap-2.5'>
											<span className='text-xs font-black uppercase text-gray-700 flex items-center gap-1.5'>
												<Crown className='w-4 h-4 text-amber-600' />
												<span>Kategori:</span>
											</span>
											<button
												onClick={() => setSelectedJuaraTingkat('sekolah')}
												className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
													selectedJuaraTingkat === 'sekolah'
														? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												★ Seluruh Sekolah
											</button>
											<button
												onClick={() => setSelectedJuaraTingkat('VII')}
												className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
													selectedJuaraTingkat === 'VII'
														? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												Tingkat VII
											</button>
											<button
												onClick={() => setSelectedJuaraTingkat('VIII')}
												className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
													selectedJuaraTingkat === 'VIII'
														? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												Tingkat VIII
											</button>
											<button
												onClick={() => setSelectedJuaraTingkat('IX')}
												className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
													selectedJuaraTingkat === 'IX'
														? 'bg-yellow-300 shadow-[2px_2px_0px_#000]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												Tingkat IX
											</button>
										</div>

										<div className='relative min-w-[200px]'>
											<input
												type='text'
												value={juaraSearchQuery}
												onChange={(e) => setJuaraSearchQuery(e.target.value)}
												placeholder='Cari nama atau kelas...'
												className='w-full pl-8 pr-3 py-1.5 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000] focus:outline-none bg-white'
											/>
											<Search className='w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400' />
										</div>
									</div>

									{/* PODIUM TOP 3 JUARA UMUM */}
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
										{/* Juara Umum 2 */}
										<div className='order-2 md:order-1 bg-gradient-to-b from-slate-100 to-slate-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3'>
											<div className='w-12 h-12 mx-auto rounded-full bg-slate-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
												🥈
											</div>
											<span className='inline-block px-3 py-0.5 bg-slate-800 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
												Juara Umum II
											</span>
											<div>
												<h3 className='text-base font-black text-black line-clamp-1'>
													{top3JuaraUmum[1]?.nama_lengkap || 'Belum Ada Data'}
												</h3>
												<p className='text-[11px] font-bold text-gray-600'>Kelas {top3JuaraUmum[1]?.kelas || '-'}</p>
											</div>
											<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
												<p className='text-xs font-black text-slate-900'>Rata-Rata: {top3JuaraUmum[1]?.rata_rata || '0.00'}</p>
												<p className='text-[10px] font-bold text-gray-500'>Total: {top3JuaraUmum[1]?.total_nilai || 0}</p>
											</div>
											{top3JuaraUmum[1] && (
												<button
													onClick={() =>
														handleCetakPiagamSingle(
															top3JuaraUmum[1],
															`JUARA UMUM II ${selectedJuaraTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedJuaraTingkat}`}`
														)
													}
													className='w-full py-2 bg-slate-300 hover:bg-slate-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
													<Printer className='w-3.5 h-3.5' />
													<span>Cetak Piagam Juara Umum 2</span>
												</button>
											)}
										</div>

										{/* Juara Umum 1 */}
										<div className='order-1 md:order-2 bg-gradient-to-b from-amber-200 via-yellow-300 to-amber-200 border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] text-center space-y-3 -translate-y-2'>
											<div className='w-16 h-16 mx-auto rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-3xl font-black shadow-[3px_3px_0px_#000]'>
												👑
											</div>
											<span className='inline-block px-4 py-1 bg-amber-950 text-yellow-300 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]'>
												★ JUARA UMUM I ★
											</span>
											<div>
												<h3 className='text-lg font-black text-black line-clamp-1'>
													{top3JuaraUmum[0]?.nama_lengkap || 'Belum Ada Data'}
												</h3>
												<p className='text-xs font-bold text-amber-950'>Rombel Kelas {top3JuaraUmum[0]?.kelas || '-'}</p>
											</div>
											<div className='p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
												<p className='text-sm font-black text-amber-950'>Rata-Rata: {top3JuaraUmum[0]?.rata_rata || '0.00'}</p>
												<p className='text-[11px] font-bold text-gray-600'>Total Nilai: {top3JuaraUmum[0]?.total_nilai || 0}</p>
											</div>
											{top3JuaraUmum[0] && (
												<button
													onClick={() =>
														handleCetakPiagamSingle(
															top3JuaraUmum[0],
															`JUARA UMUM I ${selectedJuaraTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedJuaraTingkat}`}`
														)
													}
													className='w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
													<Crown className='w-4 h-4' />
													<span>Cetak Piagam Juara Umum 1</span>
												</button>
											)}
										</div>

										{/* Juara Umum 3 */}
										<div className='order-3 md:order-3 bg-gradient-to-b from-amber-100 to-amber-200 border-3 border-black rounded-3xl p-5 shadow-[4px_4px_0px_#000] text-center space-y-3'>
											<div className='w-12 h-12 mx-auto rounded-full bg-amber-300 border-2 border-black flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#000]'>
												🥉
											</div>
											<span className='inline-block px-3 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider'>
												Juara Umum III
											</span>
											<div>
												<h3 className='text-base font-black text-black line-clamp-1'>
													{top3JuaraUmum[2]?.nama_lengkap || 'Belum Ada Data'}
												</h3>
												<p className='text-[11px] font-bold text-gray-600'>Kelas {top3JuaraUmum[2]?.kelas || '-'}</p>
											</div>
											<div className='p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]'>
												<p className='text-xs font-black text-amber-950'>Rata-Rata: {top3JuaraUmum[2]?.rata_rata || '0.00'}</p>
												<p className='text-[10px] font-bold text-gray-500'>Total: {top3JuaraUmum[2]?.total_nilai || 0}</p>
											</div>
											{top3JuaraUmum[2] && (
												<button
													onClick={() =>
														handleCetakPiagamSingle(
															top3JuaraUmum[2],
															`JUARA UMUM III ${selectedJuaraTingkat === 'sekolah' ? 'SEKOLAH' : `TINGKAT ${selectedJuaraTingkat}`}`
														)
													}
													className='w-full py-2 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer'>
													<Printer className='w-3.5 h-3.5' />
													<span>Cetak Piagam Juara Umum 3</span>
												</button>
											)}
										</div>
									</div>

									{/* Tabel Top Leaderboard Juara Umum */}
									<div className='bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] overflow-hidden'>
										<div className='p-4 border-b-2 border-black bg-yellow-200 flex items-center justify-between'>
											<h3 className='text-sm font-black text-black uppercase flex items-center gap-2'>
												<Crown className='w-4 h-4 text-amber-700' />
												<span>
													Juara Umum I, II, dan III (Top 3) —{' '}
													{selectedJuaraTingkat === 'sekolah' ? 'Seluruh Sekolah' : `Tingkat ${selectedJuaraTingkat}`}
												</span>
											</h3>
										</div>

										<div className='overflow-x-auto'>
											<table className='w-full text-left border-collapse text-xs'>
												<thead>
													<tr className='border-b-2 border-black bg-gray-50 font-black uppercase text-[11px] text-gray-700'>
														<th className='py-3 px-4 text-center w-16'>Rank</th>
														<th className='py-3 px-4'>NIS</th>
														<th className='py-3 px-4'>Nama Lengkap Santri / Siswa</th>
														<th className='py-3 px-4 text-center'>Asal Kelas</th>
														<th className='py-3 px-4 text-center'>Total Nilai</th>
														<th className='py-3 px-4 text-center'>Rata-Rata</th>
														<th className='py-3 px-4 text-center'>Predikat Prestasi</th>
														<th className='py-3 px-4 text-right'>Aksi Piagam</th>
													</tr>
												</thead>
												<tbody className='divide-y-2 divide-gray-100 font-bold'>
													{currentJuaraUmumList.length === 0 ? (
														<tr>
															<td colSpan={8} className='text-center py-8 text-gray-500'>
																Tidak ada data untuk kategori tingkat ini.
															</td>
														</tr>
													) : (
														currentJuaraUmumList.map((item, idx) => {
															const rankNum = idx + 1;
															return (
																<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
																	<td className='py-3 px-4 text-center'>
																		<span
																			className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-black font-black text-xs shadow-[1px_1px_0px_#000] ${
																				rankNum === 1
																					? 'bg-yellow-400 text-black'
																					: rankNum === 2
																					? 'bg-slate-300 text-black'
																					: rankNum === 3
																					? 'bg-amber-300 text-black'
																					: 'bg-white text-gray-700'
																			}`}>
																			{rankNum}
																		</span>
																	</td>
																	<td className='py-3 px-4 font-mono text-gray-600'>{item.nis || '-'}</td>
																	<td className='py-3 px-4 text-black font-black'>{item.nama_lengkap}</td>
																	<td className='py-3 px-4 text-center'>
																		<span className='px-2.5 py-0.5 bg-black text-yellow-300 rounded font-black text-xs'>
																			{item.kelas}
																		</span>
																	</td>
																	<td className='py-3 px-4 text-center font-mono'>{item.total_nilai}</td>
																	<td className='py-3 px-4 text-center'>
																		<span className='px-2.5 py-1 bg-white border-2 border-black rounded-lg font-black font-mono shadow-[1px_1px_0px_#000]'>
																			{item.rata_rata}
																		</span>
																	</td>
																	<td className='py-3 px-4 text-center'>
																		<span className='px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 border border-amber-400 text-amber-950'>
																			{item.juara_label}
																		</span>
																	</td>
																	<td className='py-3 px-4 text-right'>
																		<button
																			onClick={() => handleCetakPiagamSingle(item, item.juara_label)}
																			className='px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 cursor-pointer'>
																			<Printer className='w-3 h-3' />
																			<span>Cetak Piagam</span>
																		</button>
																	</td>
																</tr>
															);
														})
													)}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
