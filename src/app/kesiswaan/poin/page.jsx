'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip, { ArchiveBanner } from '@/app/components/AcademicPeriodChip';
import { konversiPoinKeSikap } from '@/lib/poinUtils';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import { getTodayDateString } from '@/lib/dateUtils';

// Kategori Default Pelanggaran & Prestasi (Cadangan Lengkap untuk Bagian Kesiswaan)
const DEFAULT_PRESET_PELANGGARAN = [
	{ kode: 'bolos', nama: 'Bolos Jam Pelajaran / KBM', poin: 25, tingkat: 'Berat', icon: '❌' },
	{ kode: 'kabur', nama: 'Keluar Lingkungan Tanpa Izin / Kabur', poin: 30, tingkat: 'Berat', icon: '🚪' },
	{ kode: 'rokok', nama: 'Merokok / Membawa Rokok / Vape', poin: 50, tingkat: 'Sangat Berat', icon: '🚬' },
	{ kode: 'terlambat', nama: 'Terlambat Masuk Kelas / Apel', poin: 5, tingkat: 'Ringan', icon: '⏰' },
	{ kode: 'keluyuran', nama: 'Keluyuran / Nongkrong saat Jam KBM', poin: 15, tingkat: 'Sedang', icon: '🚶' },
	{ kode: 'tidur', nama: 'Tidur di Kelas saat Pembelajaran', poin: 5, tingkat: 'Ringan', icon: '😴' },
	{ kode: 'hp_ilegal', nama: 'Membawa / Memakai HP Tanpa Izin', poin: 25, tingkat: 'Berat', icon: '📱' },
	{ kode: 'seragam', nama: 'Melanggar Tata Tertib Seragam / Atribut', poin: 5, tingkat: 'Ringan', icon: '👕' },
	{ kode: 'ibadah', nama: 'Mengabaikan Sholat Berjamaah / Ibadah', poin: 20, tingkat: 'Berat', icon: '🕌' },
	{ kode: 'berkelahi', nama: 'Perkelahian / Bullying / Intimidasi', poin: 50, tingkat: 'Sangat Berat', icon: '🥊' },
	{ kode: 'lainnya_negatif', nama: 'Pelanggaran Lainnya (Ketik Manual)', poin: 10, tingkat: 'Khusus', icon: '⚠️' },
];

const DEFAULT_PRESET_PRESTASI = [
	{ kode: 'lomba', nama: 'Juara Lomba / Kompetisi Akademik & Seni', poin: 30, icon: '🏆' },
	{ kode: 'tahfidz', nama: 'Capaian / Setoran Hafalan Al-Qur\'an (Tahfidz)', poin: 25, icon: '📖' },
	{ kode: 'adab', nama: 'Sikap, Sopan Santun & Adab Terpuji', poin: 10, icon: '🌟' },
	{ kode: 'kehadiran', nama: 'Kedisiplinan & Kehadiran Sempurna', poin: 15, icon: '🎯' },
	{ kode: 'kebersihan', nama: 'Piket Kebersihan & Tanggung Jawab Unggul', poin: 10, icon: '🧹' },
	{ kode: 'bantu_guru', nama: 'Membantu Guru / Petugas Kesiswaan', poin: 10, icon: '🤝' },
	{ kode: 'keaktifan', nama: 'Keaktifan & Kepemimpinan Santri', poin: 15, icon: '💡' },
	{ kode: 'lainnya_positif', nama: 'Prestasi Lainnya (Ketik Manual)', poin: 10, icon: '✨' },
];

export default function KesiswaanPoinPage() {
	const { buildPeriodeQuery, tahunAjar, semester, isViewingActive } = useAcademic();

	// Data States
	const [poinList, setPoinList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	// Tabs & View State
	const [activeTab, setActiveTab] = useState('riwayat'); // 'riwayat' | 'rekap'

	// Filter States
	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterTipe, setFilterTipe] = useState('Semua');
	const [filterPredikat, setFilterPredikat] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');
	const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);

	// Modal Input / Edit State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	// Form State
	const initialForm = {
		id: '',
		tanggal: getTodayDateString(),
		kelas: '',
		siswa_ids: [],
		tipe: 'negatif', // 'negatif' (pelanggaran) | 'positif' (prestasi)
		presetKode: 'bolos',
		kategori: 'Disiplin',
		aktifitas: 'Bolos Jam Pelajaran / KBM',
		poin: 25,
		keterangan: '',
	};
	const [formData, setFormData] = useState(initialForm);

	// Modal Detail Riwayat Siswa
	const [selectedDetailSiswa, setSelectedDetailSiswa] = useState(null);

	// Modal Cetak Rekap State
	const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

	// Fetch Data Utama
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			const periodeQuery = buildPeriodeQuery();
			const [resPoin, resSiswa, resKelas, resProfile] = await Promise.all([
				fetch(`/api/poin?${periodeQuery}`).catch(() => ({ ok: false })),
				fetch('/api/siswa').catch(() => ({ ok: false })),
				fetch('/api/kelas').catch(() => ({ ok: false })),
				fetchSchoolProfile().catch(() => null),
			]);

			if (resPoin.ok) {
				const dataPoin = await resPoin.json();
				setPoinList(Array.isArray(dataPoin) ? dataPoin : []);
			} else {
				setPoinList([]);
			}

			if (resSiswa.ok) {
				const dataSiswa = await resSiswa.json();
				setSiswaList(Array.isArray(dataSiswa) ? dataSiswa : []);
			}

			if (resKelas.ok) {
				const dataKelas = await resKelas.json();
				const sorted = (Array.isArray(dataKelas) ? dataKelas : []).sort((a, b) =>
					(a.nama_kelas || a.kelas || '').localeCompare(b.nama_kelas || b.kelas || '')
				);
				setKelasList(sorted);
			}

			if (resProfile) {
				setSchoolProfile(resProfile);
			}
		} catch (err) {
			console.error('Error fetching poin data:', err);
		} finally {
			setLoading(false);
		}
	}, [buildPeriodeQuery]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Lookup Map Siswa
	const siswaMap = useMemo(() => {
		const map = {};
		siswaList.forEach((s) => {
			map[s.id] = s;
		});
		return map;
	}, [siswaList]);

	// Siswa Filtered untuk Modal Form berdasarkan Kelas Terpilih
	const siswaOptionsInModal = useMemo(() => {
		if (!formData.kelas || formData.kelas === 'Semua') return siswaList;
		return siswaList.filter((s) => s.kelas === formData.kelas);
	}, [siswaList, formData.kelas]);

	// Filtered Log Poin (Tab Riwayat Harian)
	const filteredPoinList = useMemo(() => {
		return poinList.filter((item) => {
			const s = siswaMap[item.siswa_id];
			const sKelas = s?.kelas || '';
			const sNama = s?.nama_lengkap || '';
			const sNis = s?.nis || '';

			if (filterKelas !== 'Semua' && sKelas !== filterKelas) return false;

			const isPos = item.tipe === 'positif' || item.poin > 0;
			if (filterTipe === 'positif' && !isPos) return false;
			if (filterTipe === 'negatif' && isPos) return false;

			if (searchQuery.trim() !== '') {
				const q = searchQuery.toLowerCase();
				const matchNama = sNama.toLowerCase().includes(q);
				const matchNis = String(sNis).toLowerCase().includes(q);
				const matchAkt = (item.aktifitas || '').toLowerCase().includes(q);
				const matchKet = (item.keterangan || '').toLowerCase().includes(q);
				if (!matchNama && !matchNis && !matchAkt && !matchKet) return false;
			}

			return true;
		});
	}, [poinList, siswaMap, filterKelas, filterTipe, searchQuery]);

	// Aggregasi Poin per Siswa (Tab Rekap & Predikat Sikap)
	const rekapSiswaList = useMemo(() => {
		const map = {};

		// Inisialisasi seluruh santri aktif
		siswaList.forEach((s) => {
			map[s.id] = {
				id: s.id,
				nama: s.nama_lengkap,
				nis: s.nis || '—',
				kelas: s.kelas,
				positif: 0,
				negatif: 0,
				net: 0,
				countPositif: 0,
				countNegatif: 0,
				items: [],
			};
		});

		// Akumulasi data poin
		poinList.forEach((p) => {
			if (map[p.siswa_id]) {
				const val = Math.abs(parseInt(p.poin || 0, 10));
				const isPos = p.tipe === 'positif' || p.poin > 0;
				if (isPos) {
					map[p.siswa_id].positif += val;
					map[p.siswa_id].countPositif += 1;
				} else {
					map[p.siswa_id].negatif += val;
					map[p.siswa_id].countNegatif += 1;
				}
				map[p.siswa_id].items.push(p);
			}
		});

		// Hitung net & predikat sikap
		const list = Object.values(map).map((s) => {
			const net = s.positif - s.negatif;
			const sikap = konversiPoinKeSikap(net);
			return {
				...s,
				net,
				sikap,
			};
		});

		// Filter
		return list.filter((s) => {
			if (filterKelas !== 'Semua' && s.kelas !== filterKelas) return false;
			if (filterPredikat !== 'Semua' && s.sikap.predikat !== filterPredikat) return false;
			if (onlyNeedsAttention && s.net >= 0 && s.negatif < 20) return false;

			if (searchQuery.trim() !== '') {
				const q = searchQuery.toLowerCase();
				const matchNama = s.nama.toLowerCase().includes(q);
				const matchNis = String(s.nis).toLowerCase().includes(q);
				if (!matchNama && !matchNis) return false;
			}

			return true;
		}).sort((a, b) => a.net - b.net); // Prioritaskan santri dengan poin terendah (paling butuh perhatian) di atas
	}, [siswaList, poinList, filterKelas, filterPredikat, onlyNeedsAttention, searchQuery]);

	// Statistik Ringkasan
	const summaryStats = useMemo(() => {
		let totalPositif = 0;
		let totalNegatif = 0;
		let santriPerluBimbingan = 0;

		rekapSiswaList.forEach((s) => {
			totalPositif += s.positif;
			totalNegatif += s.negatif;
			if (s.net < -9 || s.negatif >= 25) {
				santriPerluBimbingan += 1;
			}
		});

		return {
			totalCatatan: poinList.length,
			totalPositif,
			totalNegatif,
			santriPerluBimbingan,
		};
	}, [poinList, rekapSiswaList]);

	// Buka Modal Tambah Poin Baru
	const handleOpenCreateModal = () => {
		setIsEditing(false);
		const firstKelas = kelasList[0]?.nama_kelas || kelasList[0]?.kelas || '';
		setFormData({
			...initialForm,
			kelas: firstKelas,
			tanggal: getTodayDateString(),
		});
		setIsModalOpen(true);
	};

	// Buka Modal Edit Poin
	const handleOpenEditModal = (item) => {
		setIsEditing(true);
		const s = siswaMap[item.siswa_id];
		const isPos = item.tipe === 'positif' || item.poin > 0;
		setFormData({
			id: item.id,
			tanggal: item.tanggal,
			kelas: s?.kelas || '',
			siswa_ids: [item.siswa_id],
			tipe: isPos ? 'positif' : 'negatif',
			presetKode: 'manual',
			kategori: item.kategori || (isPos ? 'Prestasi' : 'Disiplin'),
			aktifitas: item.aktifitas || '',
			poin: Math.abs(item.poin || 10),
			keterangan: item.keterangan || '',
		});
		setIsModalOpen(true);
	};

	// Saat User Memilih Preset Pelanggaran / Prestasi
	const handleSelectPreset = (preset) => {
		setFormData((prev) => ({
			...prev,
			presetKode: preset.kode,
			aktifitas: preset.nama,
			poin: preset.poin,
			kategori: prev.tipe === 'negatif' ? 'Disiplin' : 'Prestasi',
		}));
	};

	// Ganti Tipe Positif / Negatif di Modal
	const handleTipeChange = (newTipe) => {
		const defaultPreset = newTipe === 'negatif' ? DEFAULT_PRESET_PELANGGARAN[0] : DEFAULT_PRESET_PRESTASI[0];
		setFormData((prev) => ({
			...prev,
			tipe: newTipe,
			presetKode: defaultPreset.kode,
			aktifitas: defaultPreset.nama,
			poin: defaultPreset.poin,
			kategori: newTipe === 'negatif' ? 'Disiplin' : 'Prestasi',
		}));
	};

	// Submit Modal Form Poin
	const handleSubmitForm = async (e) => {
		e.preventDefault();

		if (!formData.siswa_ids || formData.siswa_ids.length === 0) {
			Swal.fire({
				icon: 'warning',
				title: 'Santri Belum Dipilih',
				text: 'Silakan pilih minimal 1 santri yang bersangkutan.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		if (!formData.aktifitas.trim()) {
			Swal.fire({
				icon: 'warning',
				title: 'Aktivitas Belum Diisi',
				text: 'Silakan pilih atau ketik aktivitas perilaku santri.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		try {
			setSubmitting(true);
			const payload = {
				id: formData.id,
				siswa_id: formData.siswa_ids[0],
				siswa_ids: formData.siswa_ids,
				tanggal: formData.tanggal,
				tipe: formData.tipe,
				kategori: formData.kategori || (formData.tipe === 'negatif' ? 'Disiplin' : 'Prestasi'),
				aktifitas: formData.aktifitas.trim(),
				poin: Number(formData.poin) || 0,
				keterangan: formData.keterangan.trim(),
			};

			const method = isEditing ? 'PUT' : 'POST';
			const res = await fetch('/api/poin', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const result = await res.json();
			if (!res.ok || result.error) {
				throw new Error(result.error || 'Gagal menyimpan catatan poin');
			}

			Swal.fire({
				icon: 'success',
				title: isEditing ? 'Poin Diperbarui' : 'Poin Berhasil Dicatat!',
				text: isEditing
					? 'Catatan perilaku santri telah diperbarui.'
					: `Berhasil mencatat poin untuk ${formData.siswa_ids.length} santri.`,
				confirmButtonColor: '#10B981',
				timer: 1800,
			});

			setIsModalOpen(false);
			fetchData();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSubmitting(false);
		}
	};

	// Hapus Poin
	const handleDeletePoin = async (id, namaSiswa, aktifitas) => {
		const confirm = await Swal.fire({
			title: 'Hapus Catatan Poin?',
			text: `Catatan "${aktifitas}" untuk santri ${namaSiswa} akan dihapus secara permanen.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
		});

		if (confirm.isConfirmed) {
			try {
				const res = await fetch(`/api/poin?id=${id}`, { method: 'DELETE' });
				const data = await res.json();
				if (!res.ok || data.error) throw new Error(data.error || 'Gagal menghapus poin');

				Swal.fire({
					icon: 'success',
					title: 'Terhapus',
					text: 'Catatan poin berhasil dihapus.',
					confirmButtonColor: '#10B981',
					timer: 1500,
				});

				fetchData();
			} catch (err) {
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menghapus',
					text: err.message,
					confirmButtonColor: '#E8451A',
				});
			}
		}
	};

	// Toggle santri terpilih di modal (Multi-select)
	const toggleSiswaSelection = (id) => {
		setFormData((prev) => {
			const exists = prev.siswa_ids.includes(id);
			if (exists) {
				return { ...prev, siswa_ids: prev.siswa_ids.filter((item) => item !== id) };
			} else {
				return { ...prev, siswa_ids: [...prev.siswa_ids, id] };
			}
		});
	};

	const selectAllSiswaInKelas = () => {
		const allIds = siswaOptionsInModal.map((s) => s.id);
		setFormData((prev) => ({
			...prev,
			siswa_ids: allIds,
		}));
	};

	const clearAllSiswaSelection = () => {
		setFormData((prev) => ({
			...prev,
			siswa_ids: [],
		}));
	};

	// Eksekusi Print Rekap
	const handlePrint = () => {
		window.print();
	};

	if (loading && poinList.length === 0 && siswaList.length === 0) {
		return <Loader />;
	}

	return (
		<>
			{/* Konten Web Utama Kesiswaan Poin */}
			<div className='space-y-6 print:hidden'>
				{/* Top Bar Header & Period */}
				<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
					<div>
						<div className='flex items-center gap-2'>
							<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded text-[10px] font-black uppercase text-black'>
								Kedisiplinan & Prestasi
							</span>
							<AcademicPeriodChip />
						</div>
						<h1 className='text-xl sm:text-2xl font-black text-black tracking-tight mt-1 flex items-center gap-2'>
							<span>⭐</span>
							<span>Poin & Perilaku Santri</span>
						</h1>
						<p className='text-xs sm:text-sm text-gray-600 font-medium mt-0.5'>
							Pusat pemantauan rekam disiplin, poin pelanggaran, prestasi, dan predikat sikap santri lintas rombel.
						</p>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<button
							onClick={handlePrint}
							className='px-3.5 py-2 bg-white hover:bg-gray-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5'>
							<span>🖨️</span>
							<span>Cetak Rekap</span>
						</button>

						<button
							onClick={handleOpenCreateModal}
							className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5'>
							<span>➕</span>
							<span>Catat Poin Santri</span>
						</button>
					</div>
				</div>

				<ArchiveBanner />

				{/* 4 Kartu Statistik Ringkasan */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
					<div className='p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase text-gray-600'>Total Catatan</span>
							<span className='text-base'>📋</span>
						</div>
						<p className='text-2xl font-black text-black font-mono mt-1'>{summaryStats.totalCatatan}</p>
						<p className='text-[10px] text-gray-500 font-semibold mt-0.5'>Kejadian tercatat</p>
					</div>

					<div className='p-4 bg-emerald-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase text-emerald-900'>Poin Prestasi (+)</span>
							<span className='text-base'>🌟</span>
						</div>
						<p className='text-2xl font-black text-emerald-700 font-mono mt-1'>+{summaryStats.totalPositif}</p>
						<p className='text-[10px] text-emerald-800 font-semibold mt-0.5'>Reward santri</p>
					</div>

					<div className='p-4 bg-rose-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase text-rose-900'>Poin Minus (-)</span>
							<span className='text-base'>⚠️</span>
						</div>
						<p className='text-2xl font-black text-rose-700 font-mono mt-1'>-{summaryStats.totalNegatif}</p>
						<p className='text-[10px] text-rose-800 font-semibold mt-0.5'>Pelanggaran santri</p>
					</div>

					<div className='p-4 bg-amber-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<div className='flex items-center justify-between'>
							<span className='text-xs font-black uppercase text-amber-900'>Perlu Bimbingan</span>
							<span className='text-base'>🚨</span>
						</div>
						<p className='text-2xl font-black text-amber-800 font-mono mt-1'>{summaryStats.santriPerluBimbingan}</p>
						<p className='text-[10px] text-amber-800 font-semibold mt-0.5'>Santri minus tinggi</p>
					</div>
				</div>

				{/* Tab Navigasi Mode Tampilan */}
				<div className='flex items-center gap-2 border-b-2 border-black pb-2'>
					<button
						onClick={() => setActiveTab('riwayat')}
						className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1.5 ${
							activeTab === 'riwayat'
								? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#FEF08A]'
								: 'bg-white text-black border-black/40 hover:bg-yellow-100'
						}`}>
						<span>📜</span>
						<span>Log Aktivitas Harian ({filteredPoinList.length})</span>
					</button>

					<button
						onClick={() => setActiveTab('rekap')}
						className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1.5 ${
							activeTab === 'rekap'
								? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#FEF08A]'
								: 'bg-white text-black border-black/40 hover:bg-yellow-100'
						}`}>
						<span>📊</span>
						<span>Rekap Per Santri & Predikat Sikap ({rekapSiswaList.length})</span>
					</button>
				</div>

				{/* Filter & Toolbar */}
				<div className='p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
					<div className='flex flex-wrap items-center justify-between gap-3'>
						<div className='flex flex-wrap items-center gap-2'>
							{/* Filter Rombel */}
							<div>
								<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Rombel</label>
								<select
									value={filterKelas}
									onChange={(e) => setFilterKelas(e.target.value)}
									className='neo-input !py-1 text-xs font-bold bg-white'>
									<option value='Semua'>Semua Rombel</option>
									{kelasList.map((k) => (
										<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
											Kelas {k.nama_kelas || k.kelas}
										</option>
									))}
								</select>
							</div>

							{/* Filter Tipe (Tab Riwayat) */}
							{activeTab === 'riwayat' && (
								<div>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Tipe Poin</label>
									<select
										value={filterTipe}
										onChange={(e) => setFilterTipe(e.target.value)}
										className='neo-input !py-1 text-xs font-bold bg-white'>
										<option value='Semua'>Semua Tipe</option>
										<option value='negatif'>⚠️ Pelanggaran (Minus)</option>
										<option value='positif'>🌟 Prestasi (Positif)</option>
									</select>
								</div>
							)}

							{/* Filter Predikat (Tab Rekap) */}
							{activeTab === 'rekap' && (
								<div>
									<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Predikat Sikap</label>
									<select
										value={filterPredikat}
										onChange={(e) => setFilterPredikat(e.target.value)}
										className='neo-input !py-1 text-xs font-bold bg-white'>
										<option value='Semua'>Semua Predikat</option>
										<option value='A'>A - Sangat Baik</option>
										<option value='B'>B - Baik</option>
										<option value='C'>C - Cukup</option>
										<option value='D'>D - Perlu Bimbingan</option>
									</select>
								</div>
							)}

							{/* Checkbox Hanya Butuh Perhatian (Tab Rekap) */}
							{activeTab === 'rekap' && (
								<div className='flex items-center gap-1.5 pt-4'>
									<label className='inline-flex items-center gap-2 cursor-pointer text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-300'>
										<input
											type='checkbox'
											checked={onlyNeedsAttention}
											onChange={(e) => setOnlyNeedsAttention(e.target.checked)}
											className='rounded text-rose-600 focus:ring-rose-500 w-4 h-4'
										/>
										<span>🚨 Hanya Santri Minus / Perlu Bimbingan</span>
									</label>
								</div>
							)}
						</div>

						{/* Search Box */}
						<div className='w-full sm:w-72'>
							<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Cari Santri / Aktivitas</label>
							<input
								type='text'
								placeholder='Ketik nama santri, NIS, atau aktivitas...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='neo-input !py-1 text-xs w-full bg-white font-medium'
							/>
						</div>
					</div>
				</div>

				{/* ============================================================== */}
				{/* TAB 1: LOG RIWAYAT AKTIVITAS HARIAN POIN                       */}
				{/* ============================================================== */}
				{activeTab === 'riwayat' && (
					<div className='bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
						{filteredPoinList.length === 0 ? (
							<div className='p-12 text-center space-y-2'>
								<span className='text-4xl block'>📋</span>
								<p className='text-base font-black text-black'>Belum Ada Catatan Poin yang Cocok</p>
								<p className='text-xs text-gray-500 max-w-sm mx-auto'>
									Klik tombol <b>➕ Catat Poin Santri</b> untuk memasukkan rekam pelanggaran atau prestasi baru.
								</p>
							</div>
						) : (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[950px] text-left text-sm'>
									<thead>
										<tr className='border-b-2 border-black text-xs font-black uppercase tracking-wider text-black bg-yellow-100/70'>
											<th className='py-3.5 px-3 text-center w-12'>No</th>
											<th className='py-3.5 px-4 min-w-[120px]'>Tanggal</th>
											<th className='py-3.5 px-4 min-w-[200px]'>Santri & Rombel</th>
											<th className='py-3.5 px-4 min-w-[240px]'>Aktivitas Perilaku</th>
											<th className='py-3.5 px-3 text-center min-w-[100px]'>Bobot Poin</th>
											<th className='py-3.5 px-4 min-w-[200px]'>Keterangan</th>
											<th className='py-3.5 px-4 text-right min-w-[160px]'>Tindakan</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-200 font-bold'>
										{filteredPoinList.map((item, idx) => {
											const s = siswaMap[item.siswa_id];
											const isPos = item.tipe === 'positif' || item.poin > 0;
											const valPoin = Math.abs(item.poin || 0);

											return (
												<tr key={item.id} className='hover:bg-yellow-50 transition-colors'>
													<td className='py-3.5 px-3 font-mono text-xs text-center text-gray-500'>
														{idx + 1}
													</td>

													<td className='py-3.5 px-4 text-xs font-mono font-bold text-gray-700 whitespace-nowrap'>
														{item.tanggal}
													</td>

													<td className='py-3.5 px-4 whitespace-nowrap'>
														<p className='font-black text-sm text-black'>{s?.nama_lengkap || 'Santri'}</p>
														<div className='flex items-center gap-1.5 mt-0.5'>
															<span className='px-1.5 py-0.2 bg-yellow-100 border border-black/30 rounded text-[10px] font-black'>
																Kelas {s?.kelas || '—'}
															</span>
															<span className='text-[10px] text-gray-500 font-mono'>
																NIS: {s?.nis || '—'}
															</span>
														</div>
													</td>

													<td className='py-3.5 px-4'>
														<div className='flex items-center gap-2'>
															<span className='text-base shrink-0'>{isPos ? '🌟' : '⚠️'}</span>
															<div>
																<p className='text-xs font-black text-black leading-snug'>{item.aktifitas}</p>
																<span className='text-[10px] text-gray-500 font-bold uppercase'>
																	{item.kategori || (isPos ? 'Prestasi' : 'Disiplin')}
																</span>
															</div>
														</div>
													</td>

													<td className='py-3.5 px-3 text-center whitespace-nowrap'>
														<span
															className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border inline-flex items-center gap-1 ${
																isPos
																	? 'bg-emerald-100 text-emerald-950 border-emerald-400'
																	: 'bg-rose-100 text-rose-950 border-rose-400'
															}`}>
															{isPos ? `+${valPoin}` : `-${valPoin}`}
														</span>
													</td>

													<td className='py-3.5 px-4 text-xs text-gray-600 font-medium max-w-xs'>
														{item.keterangan || '—'}
													</td>

													<td className='py-3.5 px-4 text-right whitespace-nowrap'>
														<div className='flex items-center justify-end gap-1.5'>
															{/* Link Cepat Eskalasi ke Buku Bimbingan jika pelanggaran */}
															{!isPos && (
																<Link
																	href={`/kesiswaan/penanganan?siswa_id=${item.siswa_id}&nama=${encodeURIComponent(s?.nama_lengkap || '')}&kelas=${encodeURIComponent(s?.kelas || '')}`}
																	title='Catat Bimbingan Santri'
																	className='p-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5'>
																	📋
																</Link>
															)}

															<button
																onClick={() => handleOpenEditModal(item)}
																title='Ubah / Edit Catatan'
																className='p-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5'>
																✏️
															</button>

															<button
																onClick={() => handleDeletePoin(item.id, s?.nama_lengkap || 'Santri', item.aktifitas)}
																title='Hapus Catatan'
																className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-400 rounded-lg text-xs transition-colors'>
																🗑️
															</button>
														</div>
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

				{/* ============================================================== */}
				{/* TAB 2: REKAP PER SANTRI & PREDIKAT SIKAP RAPORT               */}
				{/* ============================================================== */}
				{activeTab === 'rekap' && (
					<div className='bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
						{rekapSiswaList.length === 0 ? (
							<div className='p-12 text-center space-y-2'>
								<span className='text-4xl block'>👥</span>
								<p className='text-base font-black text-black'>Tidak Ada Data Santri yang Cocok</p>
								<p className='text-xs text-gray-500'>Coba sesuaikan filter rombel atau predikat di atas.</p>
							</div>
						) : (
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[950px] text-left text-sm'>
									<thead>
										<tr className='border-b-2 border-black text-xs font-black uppercase tracking-wider text-black bg-yellow-100/70'>
											<th className='py-3.5 px-3 text-center w-12'>No</th>
											<th className='py-3.5 px-4 min-w-[220px]'>Santri & Rombel</th>
											<th className='py-3.5 px-3 text-center min-w-[100px]'>Prestasi (+)</th>
											<th className='py-3.5 px-3 text-center min-w-[100px]'>Pelanggaran (-)</th>
											<th className='py-3.5 px-3 text-center min-w-[110px]'>Poin Bersih</th>
											<th className='py-3.5 px-4 text-center min-w-[170px]'>Predikat Sikap</th>
											<th className='py-3.5 px-4 text-right min-w-[170px]'>Tindakan</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-200 font-bold'>
										{rekapSiswaList.map((s, idx) => {
											const isNeedsAttention = s.net < -9 || s.negatif >= 25;

											return (
												<tr
													key={s.id}
													className={`transition-colors ${
														isNeedsAttention ? 'bg-rose-50/60 hover:bg-rose-100/60' : 'hover:bg-yellow-50'
													}`}>
													<td className='py-3.5 px-3 font-mono text-xs text-center text-gray-500'>
														{idx + 1}
													</td>

													<td className='py-3.5 px-4 whitespace-nowrap'>
														<p className='font-black text-sm text-black'>{s.nama}</p>
														<div className='flex items-center gap-1.5 mt-0.5'>
															<span className='px-1.5 py-0.2 bg-yellow-100 border border-black/30 rounded text-[10px] font-black'>
																Kelas {s.kelas}
															</span>
															<span className='text-[10px] text-gray-500 font-mono'>
																NIS: {s.nis}
															</span>
														</div>
													</td>

													<td className='py-3.5 px-3 text-center font-mono text-xs text-emerald-700 font-black'>
														+{s.positif}
													</td>

													<td className='py-3.5 px-3 text-center font-mono text-xs text-rose-700 font-black'>
														-{s.negatif}
													</td>

													<td className='py-3.5 px-3 text-center whitespace-nowrap'>
														<span
															className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border ${
																s.net > 0
																	? 'bg-emerald-100 text-emerald-950 border-emerald-400'
																	: s.net < 0
																	? 'bg-rose-100 text-rose-950 border-rose-400'
																	: 'bg-gray-100 text-gray-900 border-gray-300'
															}`}>
															{s.net > 0 ? `+${s.net}` : s.net}
														</span>
													</td>

													<td className='py-3.5 px-4 text-center whitespace-nowrap'>
														<span
															className={`px-3 py-1 rounded-lg text-xs font-black border inline-flex items-center gap-1.5 ${s.sikap.badgeClass}`}>
															<span>{s.sikap.predikat === 'A' ? '🌟' : s.sikap.predikat === 'B' ? '👍' : s.sikap.predikat === 'C' ? '⚠️' : '🚨'}</span>
															<span>Predikat {s.sikap.predikat} ({s.sikap.label})</span>
														</span>
													</td>

													<td className='py-3.5 px-4 text-right whitespace-nowrap'>
														<div className='flex items-center justify-end gap-1.5'>
															{/* Lihat Riwayat Santri */}
															<button
																onClick={() => setSelectedDetailSiswa(s)}
																title='Lihat Rekam Jejak Santri'
																className='px-2.5 py-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1'>
																<span>👁️</span>
																<span>Riwayat</span>
															</button>

															{/* Eskalasi ke Bimbingan Santri */}
															{isNeedsAttention && (
																<Link
																	href={`/kesiswaan/penanganan?siswa_id=${s.id}&nama=${encodeURIComponent(s.nama)}&kelas=${encodeURIComponent(s.kelas)}`}
																	title='Eskalasi: Catat Bimbingan Kesiswaan'
																	className='px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1'>
																	<span>🚨</span>
																	<span>Bina</span>
																</Link>
															)}
														</div>
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
			</div>

			{/* ============================================================== */}
			{/* MODAL FORM: INPUT / EDIT POIN SANTRI                           */}
			{/* ============================================================== */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded text-[10px] font-black uppercase text-black'>
									Kedisiplinan & Sikap
								</span>
								<h2 className='text-lg font-black text-black mt-1 flex items-center gap-1.5'>
									<span>{formData.tipe === 'negatif' ? '⚠️' : '🌟'}</span>
									<span>{isEditing ? 'Ubah Catatan Poin Santri' : 'Catat Poin Perilaku Santri'}</span>
								</h2>
							</div>

							<button
								type='button'
								onClick={() => setIsModalOpen(false)}
								className='w-8 h-8 rounded-xl border-2 border-black bg-white hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<form onSubmit={handleSubmitForm} className='space-y-4'>
							{/* Toggle Tipe: Pelanggaran vs Prestasi */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>Klasifikasi Perilaku</label>
								<div className='grid grid-cols-2 gap-2'>
									<button
										type='button'
										onClick={() => handleTipeChange('negatif')}
										className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 ${
											formData.tipe === 'negatif'
												? 'bg-rose-500 text-white border-black shadow-[2px_2px_0px_0px_#0D0D0D]'
												: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
										}`}>
										<span>⚠️</span>
										<span>Pelanggaran (Poin Minus)</span>
									</button>

									<button
										type='button'
										onClick={() => handleTipeChange('positif')}
										className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 ${
											formData.tipe === 'positif'
												? 'bg-emerald-500 text-white border-black shadow-[2px_2px_0px_0px_#0D0D0D]'
												: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
										}`}>
										<span>🌟</span>
										<span>Prestasi / Kebaikan (Plus)</span>
									</button>
								</div>
							</div>

							{/* Tanggal & Rombel */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Tanggal Kejadian</label>
									<input
										type='date'
										value={formData.tanggal}
										onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
										required
										className='neo-input w-full text-xs font-bold bg-white'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Pilih Rombel / Kelas</label>
									<select
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value, siswa_ids: [] })}
										required
										className='neo-input w-full text-xs font-bold bg-white'>
										{kelasList.map((k) => (
											<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
												Kelas {k.nama_kelas || k.kelas}
											</option>
										))}
									</select>
								</div>
							</div>

							{/* Pilih Santri (Mendukung Multi-select) */}
							<div>
								<div className='flex items-center justify-between mb-1'>
									<label className='block text-xs font-black uppercase text-black'>
										Santri yang Terlibat ({formData.siswa_ids.length} Dipilih)
									</label>
									<div className='flex items-center gap-2 text-[10px] font-bold'>
										<button
											type='button'
											onClick={selectAllSiswaInKelas}
											className='text-emerald-700 hover:underline'>
											Pilih Semua di Kelas
										</button>
										<span>•</span>
										<button
											type='button'
											onClick={clearAllSiswaSelection}
											className='text-rose-700 hover:underline'>
											Hapus Pilihan
										</button>
									</div>
								</div>

								<div className='max-h-36 overflow-y-auto border-2 border-black rounded-xl p-2 bg-yellow-50/30 space-y-1 divide-y divide-gray-100'>
									{siswaOptionsInModal.length === 0 ? (
										<p className='text-xs text-gray-500 text-center py-3'>Tidak ada santri di kelas ini.</p>
									) : (
										siswaOptionsInModal.map((s) => {
											const isSelected = formData.siswa_ids.includes(s.id);
											return (
												<div
													key={s.id}
													onClick={() => toggleSiswaSelection(s.id)}
													className={`p-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
														isSelected ? 'bg-yellow-200 font-black' : 'hover:bg-gray-100 font-medium'
													}`}>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isSelected}
															onChange={() => {}}
															className='rounded text-black focus:ring-black pointer-events-none'
														/>
														<span className='text-xs text-black'>{s.nama_lengkap}</span>
													</div>
													<span className='text-[10px] font-mono text-gray-500'>NIS: {s.nis || '—'}</span>
												</div>
											);
										})
									)}
								</div>
							</div>

							{/* Pilihan Preset Kategori Perilaku */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Pilih Kategori Perilaku / Pelanggaran
								</label>
								<div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
									{(formData.tipe === 'negatif' ? DEFAULT_PRESET_PELANGGARAN : DEFAULT_PRESET_PRESTASI).map(
										(preset) => {
											const isCurrent = formData.presetKode === preset.kode;
											return (
												<button
													key={preset.kode}
													type='button'
													onClick={() => handleSelectPreset(preset)}
													className={`p-2 rounded-xl border text-left transition-all ${
														isCurrent
															? 'bg-yellow-200 border-black shadow-[2px_2px_0px_0px_#0D0D0D] font-black'
															: 'bg-white border-gray-300 hover:border-black font-semibold'
													}`}>
													<div className='flex items-center gap-1.5'>
														<span>{preset.icon}</span>
														<span className='text-xs line-clamp-1 leading-tight text-black'>{preset.nama}</span>
													</div>
													<div className='mt-1 flex items-center justify-between text-[10px]'>
														<span className='font-mono font-bold text-gray-600'>
															{formData.tipe === 'negatif' ? `-${preset.poin} Poin` : `+${preset.poin} Poin`}
														</span>
														{preset.tingkat && (
															<span className='text-[9px] px-1 py-0.2 rounded bg-gray-100 text-gray-700'>
																{preset.tingkat}
															</span>
														)}
													</div>
												</button>
											);
										}
									)}
								</div>
							</div>

							{/* Nama Aktivitas & Bobot Poin */}
							<div className='grid grid-cols-1 sm:grid-cols-4 gap-3'>
								<div className='sm:col-span-3'>
									<label className='block text-xs font-black uppercase text-black mb-1'>Nama Aktivitas</label>
									<input
										type='text'
										value={formData.aktifitas}
										onChange={(e) => setFormData({ ...formData, aktifitas: e.target.value })}
										required
										placeholder='Contoh: Bolos Jam Pelajaran ke-3'
										className='neo-input w-full text-xs font-bold bg-white'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Bobot Poin</label>
									<input
										type='number'
										min='1'
										max='100'
										value={formData.poin}
										onChange={(e) => setFormData({ ...formData, poin: Math.abs(parseInt(e.target.value || 0, 10)) })}
										required
										className='neo-input w-full text-xs font-mono font-black bg-white'
									/>
								</div>
							</div>

							{/* Keterangan Tambahan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Keterangan / Kronologi Kejadian (Opsional)
								</label>
								<textarea
									rows='2'
									value={formData.keterangan}
									onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
									placeholder='Catatan detail lokasi, saksi, atau kronologi bimbingan awal...'
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							{/* Tombol Simpan Form */}
							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200'>
									Batal
								</button>

								<button
									type='submit'
									disabled={submitting}
									className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-emerald-400 hover:bg-emerald-500 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 disabled:opacity-60'>
									{submitting ? (
										<>
											<span className='inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin'></span>
											<span>Menyimpan...</span>
										</>
									) : (
										<>
											<span>💾</span>
											<span>Simpan Poin</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL DETAIL: REKAM JEJAK PERILAKU SEORANG SANTRI              */}
			{/* ============================================================== */}
			{selectedDetailSiswa && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded text-[10px] font-black uppercase text-black'>
									Rekam Jejak Santri
								</span>
								<h2 className='text-lg font-black text-black mt-1'>{selectedDetailSiswa.nama}</h2>
								<p className='text-xs font-mono font-bold text-gray-600'>
									Kelas {selectedDetailSiswa.kelas} &bull; NIS: {selectedDetailSiswa.nis}
								</p>
							</div>

							<button
								type='button'
								onClick={() => setSelectedDetailSiswa(null)}
								className='w-8 h-8 rounded-xl border-2 border-black bg-white hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'>
								✕
							</button>
						</div>

						{/* Score Summary Box */}
						<div className='grid grid-cols-3 gap-2.5 p-3 bg-yellow-50 border-2 border-black rounded-2xl text-center'>
							<div>
								<span className='text-[10px] font-black uppercase text-emerald-800'>Prestasi</span>
								<p className='text-lg font-black text-emerald-700 font-mono'>+{selectedDetailSiswa.positif}</p>
							</div>
							<div>
								<span className='text-[10px] font-black uppercase text-rose-800'>Pelanggaran</span>
								<p className='text-lg font-black text-rose-700 font-mono'>-{selectedDetailSiswa.negatif}</p>
							</div>
							<div>
								<span className='text-[10px] font-black uppercase text-black'>Poin Bersih</span>
								<p className='text-lg font-black text-black font-mono'>{selectedDetailSiswa.net}</p>
							</div>
						</div>

						{/* List Catatan Perilaku */}
						<div>
							<h4 className='text-xs font-black uppercase text-black mb-2'>Riwayat Kejadian</h4>
							{selectedDetailSiswa.items.length === 0 ? (
								<p className='text-xs text-gray-500 text-center py-6'>Belum ada rekam catatan perilaku.</p>
							) : (
								<div className='space-y-2 max-h-64 overflow-y-auto divide-y divide-gray-100'>
									{selectedDetailSiswa.items.map((it) => {
										const isPos = it.tipe === 'positif' || it.poin > 0;
										const val = Math.abs(it.poin || 0);
										return (
											<div key={it.id} className='p-2.5 flex items-start justify-between gap-3'>
												<div>
													<p className='text-xs font-black text-black flex items-center gap-1.5'>
														<span>{isPos ? '🌟' : '⚠️'}</span>
														<span>{it.aktifitas}</span>
													</p>
													<p className='text-[10px] text-gray-500 font-medium mt-0.5'>
														📅 {it.tanggal} &bull; {it.kategori}
													</p>
													{it.keterangan && (
														<p className='text-[11px] text-gray-700 mt-1 pl-2 border-l-2 border-gray-300'>
															{it.keterangan}
														</p>
													)}
												</div>
												<span
													className={`px-2 py-0.5 rounded text-xs font-mono font-black ${
														isPos ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
													}`}>
													{isPos ? `+${val}` : `-${val}`}
												</span>
											</div>
										);
									})}
								</div>
							)}
						</div>

						<div className='flex items-center justify-between pt-3 border-t-2 border-black'>
							<Link
								href={`/kesiswaan/penanganan?siswa_id=${selectedDetailSiswa.id}&nama=${encodeURIComponent(selectedDetailSiswa.nama)}&kelas=${encodeURIComponent(selectedDetailSiswa.kelas)}`}
								className='px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
								<span>🚨</span>
								<span>Buka Formulir Bimbingan Santri</span>
							</Link>

							<button
								onClick={() => setSelectedDetailSiswa(null)}
								className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-black rounded-xl text-xs font-bold'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* LEMBAR CETAK DOKUMEN REKAP POIN RESMI (A4 PRINT)              */}
			{/* Hanya tampil saat browser memicu window.print()                */}
			{/* ============================================================== */}
			<div id='printable-poin-rekap' className='hidden print:block w-full text-black font-sans bg-white p-0 m-0'>
				{/* Kop Surat Sekolah Resmi */}
				<div className='border-b-2 border-black pb-2 mb-3'>
					<div className='flex items-center justify-between gap-3'>
						<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
							{schoolProfile.logo_kiri ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img src={schoolProfile.logo_kiri} alt='Logo' className='max-w-full max-h-full object-contain' />
							) : (
								<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded flex items-center justify-center font-bold text-[9px] text-gray-500'>
									LOGO
								</div>
							)}
						</div>

						<div className='flex-1 text-center px-1'>
							<p className='text-xs font-black uppercase text-gray-800 tracking-wider leading-tight'>
								{schoolProfile.kementerian || 'YAYASAN AL-ISHLAH KUALA GADING'}
							</p>
							<h1 className='text-base sm:text-lg font-black uppercase text-black leading-tight mt-0.5'>
								{schoolProfile.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
							</h1>
							<p className='text-[10px] font-bold text-gray-700 font-mono mt-0.5'>
								NPSN: {schoolProfile.npsn || '69953165'} &bull; Akreditasi: {schoolProfile.akreditasi || 'A'}
							</p>
							<p className='text-[9px] text-gray-600 mt-0.5'>
								{schoolProfile.alamat || 'Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau'}
							</p>
						</div>

						<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
							{schoolProfile.logo_kanan ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img src={schoolProfile.logo_kanan} alt='Logo' className='max-w-full max-h-full object-contain' />
							) : (
								<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded flex items-center justify-center font-bold text-[9px] text-gray-500'>
									LOGO
								</div>
							)}
						</div>
					</div>

					<div className='mt-2 space-y-0.5'>
						<div className='border-b-2 border-black'></div>
						<div className='border-b border-black/70'></div>
					</div>
				</div>

				{/* Judul Rekap */}
				<div className='text-center my-3'>
					<h2 className='text-sm font-black uppercase tracking-wider text-black underline underline-offset-4 decoration-2'>
						REKAPITULASI POIN KEDISIPLINAN & PRESTASI SANTRI
					</h2>
					<p className='text-[10px] font-bold uppercase text-gray-700 mt-0.5'>
						BAGIAN KESISWAAN & KEDISIPLINAN &bull; PERIODE {tahunAjar} SEMESTER {semester}
					</p>
				</div>

				{/* Tabel Cetak Rekap */}
				<table className='w-full text-xs border border-black'>
					<thead>
						<tr className='bg-gray-100 border-b border-black font-black uppercase text-[10px]'>
							<th className='py-2 px-2 text-center border-r border-black w-8'>No</th>
							<th className='py-2 px-3 text-left border-r border-black'>Nama Santri</th>
							<th className='py-2 px-2 text-center border-r border-black w-14'>Rombel</th>
							<th className='py-2 px-2 text-center border-r border-black w-16'>Prestasi (+)</th>
							<th className='py-2 px-2 text-center border-r border-black w-16'>Minus (-)</th>
							<th className='py-2 px-2 text-center border-r border-black w-16'>Poin Bersih</th>
							<th className='py-2 px-3 text-center'>Predikat Sikap</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-black/30 font-semibold'>
						{rekapSiswaList.slice(0, 45).map((s, idx) => (
							<tr key={s.id} className='text-[10.5px]'>
								<td className='py-1.5 px-2 text-center border-r border-black/30 font-mono'>{idx + 1}</td>
								<td className='py-1.5 px-3 border-r border-black/30 font-bold'>{s.nama}</td>
								<td className='py-1.5 px-2 text-center border-r border-black/30'>{s.kelas}</td>
								<td className='py-1.5 px-2 text-center border-r border-black/30 font-mono text-emerald-800'>+{s.positif}</td>
								<td className='py-1.5 px-2 text-center border-r border-black/30 font-mono text-rose-800'>-{s.negatif}</td>
								<td className='py-1.5 px-2 text-center border-r border-black/30 font-mono font-bold'>{s.net}</td>
								<td className='py-1.5 px-3 text-center'>
									Predikat {s.sikap.predikat} ({s.sikap.label})
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{/* Tanda Tangan */}
				<div className='mt-6 pt-2 grid grid-cols-2 text-center text-xs'>
					<div>
						<p className='text-[10.5px] font-bold'>Mengetahui,</p>
						<p className='text-[10px] text-gray-600'>Kepala Sekolah / Madrasah</p>
						<div className='h-14'></div>
						<p className='font-black border-t border-black/70 pt-1 w-48 mx-auto'>
							{schoolProfile.nama_kepsek || 'Kepala Sekolah'}
						</p>
					</div>

					<div>
						<p className='text-[10.5px] font-bold'>Kuala Gading, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
						<p className='text-[10px] text-gray-600'>Bagian Kesiswaan & Kedisiplinan</p>
						<div className='h-14'></div>
						<p className='font-black border-t border-black/70 pt-1 w-48 mx-auto'>
							Staf Kesiswaan
						</p>
					</div>
				</div>
			</div>

			{/* CSS Print Stylesheet */}
			<style dangerouslySetInnerHTML={{
				__html: `
					@media print {
						@page {
							size: A4 portrait;
							margin: 10mm 15mm;
						}
						html, body {
							background: #ffffff !important;
							color: #000000 !important;
							margin: 0 !important;
							padding: 0 !important;
							width: 100% !important;
							height: auto !important;
							overflow: visible !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						.print\\:hidden,
						header,
						aside,
						nav {
							display: none !important;
						}
						#printable-poin-rekap {
							display: block !important;
							position: static !important;
							width: 100% !important;
							max-width: 100% !important;
							margin: 0 !important;
							padding: 0 !important;
							background: #ffffff !important;
						}
					}
				`
			}} />
		</>
	);
}
