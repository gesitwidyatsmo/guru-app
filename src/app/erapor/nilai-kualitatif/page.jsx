'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
	Sparkles,
	Save,
	Loader2,
	Search,
	Info,
	Check,
	FileText,
	AlertCircle,
	Users,
	RotateCcw,
	Lock,
	Edit3,
	ArrowRight,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import { generateCapaianDeskripsi } from '@/utils/erapor';
import {
	isEkskulMapel,
	getOfficialEkskulName,
	getPredikatFromNilai,
	getDefaultNarasiEkskul,
	getPlaceholderNarasiEkskul,
} from '@/lib/eraporEkskulUtils';

export default function NilaiKualitatifPage() {
	const [allKelasList, setAllKelasList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');
	const [selectedMapelId, setSelectedMapelId] = useState('');

	const selectedMapelObj = useMemo(() => {
		return mapelList.find((m) => m.id === selectedMapelId);
	}, [mapelList, selectedMapelId]);

	// Deteksi apakah mapel yang dipilih adalah mata pelajaran ekstrakurikuler (Opsi A: kelompok === 'Ekskul')
	const isEkskulMode = useMemo(() => {
		return isEkskulMapel(selectedMapelId, selectedMapelObj);
	}, [selectedMapelId, selectedMapelObj]);

	const ekskulDisplayName = useMemo(() => {
		if (!isEkskulMode) return '';
		return selectedMapelObj?.nama_resmi || selectedMapelObj?.mapel || getOfficialEkskulName(selectedMapelId, selectedMapelObj);
	}, [isEkskulMode, selectedMapelObj, selectedMapelId]);

	// Periode
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [students, setStudents] = useState([]);
	const [tps, setTps] = useState([]);
	const [grades, setGrades] = useState({}); // { [siswaId]: { tp_scores: {}, deskripsi_tertinggi, deskripsi_terendah } }
	const [kkm, setKkm] = useState(75);
	const [loading, setLoading] = useState(true);
	const [loadingKelas, setLoadingKelas] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [lockStatus, setLockStatus] = useState({ isLocked: false, lockedByName: '', isGlobal: false });

	// Modal Custom Deskripsi
	const [editingDescSiswa, setEditingDescSiswa] = useState(null);

	// Fetch master mapel, kelas & tahun ajar
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
				console.error('Error fetching master:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchMaster();
	}, []);

	// Handler pergantian mapel secara sinkron & instan
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

		setSelectedKelasId((prev) => {
			const isStillValid = filtered.some((k) => k.id === prev);
			return isStillValid ? prev : (filtered[0]?.id || '');
		});
	}, [mapelList, allKelasList]);

	// Fetch data penilaian
	const fetchKualitatifData = useCallback(async () => {
		if (!selectedKelasId || !selectedMapelId) {
			setStudents([]);
			setTps([]);
			return;
		}

		// Safety Guard: Cegah pengiriman request jika kombinasi mapel & kelas belum sinkron
		const currentMapel = mapelList.find((m) => m.id === selectedMapelId);
		if (currentMapel?.kelas_list && currentMapel.kelas_list.length > 0) {
			const currentKelas = allKelasList.find((k) => k.id === selectedKelasId);
			const namaKls = currentKelas?.kelas || currentKelas?.nama_kelas;
			if (namaKls && !currentMapel.kelas_list.includes(namaKls)) {
				return;
			}
		}
		try {
			setLoading(true);
			const url = `/api/erapor/nilai-kualitatif?kelas_id=${selectedKelasId}&mapel_id=${selectedMapelId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				const studentList = json.students || [];
				const tpList = json.tujuan_pembelajaran || [];

				setStudents(studentList);
				setTps(tpList);

				// Ambil status kunci rombel
				setLockStatus({
					isLocked: Boolean(json.is_locked),
					isGlobal: Boolean(json.is_locked_global),
					lockedByName: json.locked_by_name || '',
				});

				if (json.kkm !== undefined) {
					setKkm(json.kkm);
				}

				// Inisialisasi state grades
				const initGrades = {};
				const isEks = isEkskulMapel(selectedMapelId);
				studentList.forEach((s) => {
					let descTertinggi = s.deskripsi_tertinggi || '';
					if (isEks && !descTertinggi && s.nilai_kuantitatif !== null && s.nilai_kuantitatif !== undefined && s.nilai_kuantitatif !== '') {
						const pred = getPredikatFromNilai(Number(s.nilai_kuantitatif));
						descTertinggi = getDefaultNarasiEkskul(selectedMapelId, pred);
					}
					initGrades[s.siswa_id] = {
						tp_scores: { ...s.tp_scores },
						deskripsi_tertinggi: descTertinggi,
						deskripsi_terendah: s.deskripsi_terendah || '',
					};
				});
				setGrades(initGrades);
			} else {
				const errJson = await res.json().catch(() => ({}));
				Swal.fire({
					icon: 'warning',
					title: 'Perhatian',
					text: errJson.error || 'Gagal memuat data penilaian kualitatif.',
				});
				setStudents([]);
				setTps([]);
			}
		} catch (err) {
			console.error('Error fetching kualitatif data:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, selectedMapelId, semester, tahunAjaran, mapelList, allKelasList]);

	useEffect(() => {
		fetchKualitatifData();
	}, [fetchKualitatifData]);

	// Handler ganti skor rubrik TP (1, 2, 3, 4)
	const handleScoreChange = (siswaId, tpId, val) => {
		const numVal = parseInt(val, 10);
		setGrades((prev) => {
			const currentStudent = prev[siswaId] || { tp_scores: {}, deskripsi_tertinggi: '', deskripsi_terendah: '' };
			const newTpScores = {
				...currentStudent.tp_scores,
				[tpId]: isNaN(numVal) ? '' : numVal,
			};

			// Auto-generate deskripsi capaian jika opsi default
			const generated = generateCapaianDeskripsi(tps, newTpScores);

			return {
				...prev,
				[siswaId]: {
					...currentStudent,
					tp_scores: newTpScores,
					deskripsi_tertinggi: generated.deskripsi_tertinggi,
					deskripsi_terendah: generated.deskripsi_terendah,
				},
			};
		});
	};

	// Quick Fill Nilai TP untuk seluruh siswa
	const handleBatchFillTp = (tpId, score) => {
		setGrades((prev) => {
			const updated = { ...prev };
			students.forEach((s) => {
				const current = updated[s.siswa_id] || { tp_scores: {} };
				const newTpScores = {
					...current.tp_scores,
					[tpId]: score,
				};
				const generated = generateCapaianDeskripsi(tps, newTpScores);
				updated[s.siswa_id] = {
					...current,
					tp_scores: newTpScores,
					deskripsi_tertinggi: generated.deskripsi_tertinggi,
					deskripsi_terendah: generated.deskripsi_terendah,
				};
			});
			return updated;
		});
	};

	// Save
	const handleSave = async () => {
		if (!selectedKelasId || !selectedMapelId) {
			Swal.fire('Peringatan', 'Pilih kelas dan mata pelajaran terlebih dahulu', 'warning');
			return;
		}

		try {
			setSaving(true);
			const payload = students.map((s) => ({
				siswa_id: s.siswa_id,
				tp_scores: grades[s.siswa_id]?.tp_scores || {},
				deskripsi_tertinggi: grades[s.siswa_id]?.deskripsi_tertinggi || '',
				deskripsi_terendah: grades[s.siswa_id]?.deskripsi_terendah || '',
			}));

			const res = await fetch('/api/erapor/nilai-kualitatif', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					mapel_id: selectedMapelId,
					semester,
					tahun_ajaran: tahunAjaran,
					payload,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan penilaian');

			Swal.fire({
				icon: 'success',
				title: 'Tersimpan',
				text: 'Penilaian rubrik TP & deskripsi narasi rapor berhasil disimpan!',
				timer: 1500,
				showConfirmButton: false,
			});
			fetchKualitatifData();
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
		} finally {
			setSaving(false);
		}
	};

	// Kosongkan seluruh penilaian rubrik TP & deskripsi narasi di kelas & mapel ini
	const handleResetKualitatif = async () => {
		if (students.length === 0) return;

		const result = await Swal.fire({
			title: 'Kosongkan Seluruh Penilaian Kualitatif?',
			text: 'Seluruh skor rubrik TP dan narasi capaian siswa pada kelas dan mata pelajaran ini akan dikosongkan. Klik "Simpan Nilai TP" setelahnya untuk memperbarui database.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#e11d48',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Ya, Kosongkan Semua',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			const resetGrades = {};
			students.forEach((s) => {
				resetGrades[s.siswa_id] = {
					tp_scores: {},
					deskripsi_tertinggi: '',
					deskripsi_terendah: '',
				};
			});
			setGrades(resetGrades);

			Swal.fire({
				icon: 'info',
				title: 'Nilai Dikosongkan',
				text: 'Seluruh skor rubrik TP telah dikosongkan. Klik "Simpan Nilai TP" untuk menyimpan perubahan ke database.',
				timer: 2000,
				showConfirmButton: false,
			});
		}
	};

	const filteredStudents = useMemo(() => {
		if (!searchQuery.trim()) return students;
		const q = searchQuery.toLowerCase();
		return students.filter((s) => s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q)));
	}, [students, searchQuery]);

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<Sparkles className='w-6 h-6 text-[#00A693]' />
						<span>Penilaian Kualitatif & Deskripsi TP</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Penilaian rubrik Tujuan Pembelajaran (skala 1–4) & otomatisasi generator narasi capaian kompetensi Kurikulum Merdeka.
					</p>
				</div>
				<div className='flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap'>
					{isEkskulMode ? (
						<>
							<Link
								href={`/erapor/nilai-kuantitatif?mapel_id=${selectedMapelId}&kelas_id=${selectedKelasId}`}
								className='flex-1 sm:flex-initial px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer'>
								<Edit3 className='w-4 h-4' />
								<span>Edit di Penilaian Kuantitatif</span>
							</Link>
							<button
								type='button'
								onClick={handleSave}
								disabled={saving || loading || students.length === 0 || lockStatus.isLocked}
								className='flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-300 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer'
								title={lockStatus.isLocked ? 'Rombel terkunci (Read-Only)' : 'Simpan narasi capaian ekstrakurikuler ke database'}>
								{saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
								<span>{saving ? 'Menyimpan...' : 'Simpan Narasi'}</span>
							</button>
						</>
					) : (
						<>
							<button
								type='button'
								onClick={handleResetKualitatif}
								disabled={saving || loading || students.length === 0 || lockStatus.isLocked}
								className='flex-1 sm:flex-initial px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer'
								title={lockStatus.isLocked ? 'Rombel terkunci (Read-Only)' : 'Kosongkan seluruh penilaian rubrik TP dan deskripsi narasi'}>
								<RotateCcw className='w-4 h-4 text-rose-700' />
								<span>Kosongkan Nilai</span>
							</button>

							<button
								type='button'
								onClick={handleSave}
								disabled={saving || loading || students.length === 0 || lockStatus.isLocked}
								className='flex-1 sm:flex-initial px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer'
								title={lockStatus.isLocked ? 'Rombel terkunci (Read-Only)' : 'Simpan rubrik dan narasi capaian ke database'}>
								{saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
								<span>{saving ? 'Menyimpan...' : 'Simpan Nilai TP'}</span>
							</button>
						</>
					)}
				</div>
			</div>

			{/* Banner Proteksi Terkunci (Read-Only) */}
			{lockStatus.isLocked && (
				<div className='p-4 bg-rose-50 border-3 border-rose-500 rounded-2xl shadow-[3px_3px_0px_0px_#f43f5e] flex items-center justify-between gap-3 text-rose-900'>
					<div className='flex items-center gap-3 text-xs sm:text-sm font-bold'>
						<div className='w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]'>
							<Lock className='w-5 h-5' />
						</div>
						<div>
							<div className='font-black text-rose-950 flex items-center gap-2'>
								<span>STATUS ROMBEL: TERKUNCI (READ-ONLY)</span>
								<span className='px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-200 text-rose-800 border border-rose-400'>
									{lockStatus.isGlobal ? 'Kunci Global Kurikulum' : 'Kunci Wali Kelas'}
								</span>
							</div>
							<p className='text-xs text-rose-800 font-medium mt-0.5'>
								Nilai kualitatif dan rubrik capaian untuk rombel ini telah difinalisasi dan dikunci oleh{' '}
								<strong>{lockStatus.lockedByName || 'Wali Kelas / Kurikulum'}</strong>. Form pengisian beralih ke mode hanya-baca (read-only). Hubungi Wali Kelas atau Kurikulum jika ada perbaikan yang mendesak.
							</p>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat rubrik TP dan data capaian kualitatif...</p>
					<p className='text-xs font-bold text-gray-500'>Menyiapkan rombel, daftar siswa, dan narasi capaian kompetensi</p>
				</div>
			) : (
				<>
					{/* Filter Bar */}
			<div className='p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
				<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
					{/* Pilihan Mapel */}
					<div className='flex items-center gap-2'>
						<span className='text-xs font-black uppercase text-gray-600'>Mapel:</span>
						{mapelList.length === 0 ? (
							<span className='text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 border border-black rounded-lg'>
								Tidak ada mapel diampu
							</span>
						) : (
							<select
								value={selectedMapelId}
								onChange={(e) => handleMapelChange(e.target.value)}
								className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold max-w-xs cursor-pointer'>
								{mapelList.map((m) => {
									const isEks = isEkskulMapel(m.id || m.mapel, m);
									return (
										<option key={m.id} value={m.id}>
											{m.mapel} {isEks ? '⚡ (Ekstrakurikuler)' : ''}
										</option>
									);
								})}
							</select>
						)}
					</div>

					{/* Pilihan Kelas */}
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

			{/* Banner Khusus Mapel Ekstrakurikuler Terintegrasi */}
			{isEkskulMode && (
				<div className='p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-150'>
					<div className='flex items-start gap-3.5'>
						<div className='w-11 h-11 rounded-xl bg-[#2F80ED] text-white flex items-center justify-center font-black shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]'>
							<Sparkles className='w-6 h-6' />
						</div>
						<div className='space-y-1'>
							<div className='flex items-center gap-2 flex-wrap'>
								<span className='px-2.5 py-0.5 text-[10px] font-black uppercase rounded bg-blue-200 text-blue-950 border border-black shadow-[1px_1px_0px_#000]'>
									Penilaian Kualitatif Ekstrakurikuler Terintegrasi
								</span>
								<span className='text-xs font-black text-gray-400'>•</span>
								<span className='text-xs font-black text-blue-900'>{ekskulDisplayName}</span>
							</div>
							<h4 className='text-sm sm:text-base font-black text-black'>
								Otomatis Terkonversi dari Penilaian Kuantitatif
							</h4>
							<p className='text-xs text-gray-700 leading-relaxed max-w-2xl font-medium'>
								Predikat <strong>(A, B, C, D)</strong> dan narasi capaian untuk mata pelajaran ekstrakurikuler telah otomatis dihitung dan disinkronkan langsung dari nilai angka yang Anda masukkan. Anda tidak perlu menyusun rubrik checklist TP per siswa di halaman ini. Nilai dan narasi capaian akan dicetak langsung pada <strong>Lembar 3 Rapor Siswa (Ekstrakurikuler)</strong>.
							</p>
						</div>
					</div>
					<div className='flex items-center gap-2 flex-wrap shrink-0'>
						<Link
							href={`/erapor/nilai-kuantitatif?mapel_id=${selectedMapelId}&kelas_id=${selectedKelasId}`}
							className='px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-1.5 cursor-pointer'>
							<FileText className='w-4 h-4' />
							<span>Kelola di Penilaian Kuantitatif</span>
						</Link>
					</div>
				</div>
			)}

			{/* Panduan Rubrik Skala 1-4 / Pedoman Predikat Ekstrakurikuler */}
			{isEkskulMode ? (
				<div className='p-3.5 bg-blue-50 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-800'>
					<div className='flex items-center gap-2 font-black text-blue-950'>
						<Sparkles className='w-4 h-4 text-blue-600' />
						<span>Ketentuan Predikat Ekstrakurikuler ({ekskulDisplayName}):</span>
					</div>
					<div className='flex flex-wrap items-center gap-2 font-mono text-[11px]'>
						<span className='px-2.5 py-1 bg-emerald-200 text-emerald-950 border border-black rounded-lg font-black shadow-[1px_1px_0px_#000]'>
							A = Sangat Baik (≥ 85)
						</span>
						<span className='px-2.5 py-1 bg-blue-200 text-blue-950 border border-black rounded-lg font-black shadow-[1px_1px_0px_#000]'>
							B = Baik (75–84)
						</span>
						<span className='px-2.5 py-1 bg-amber-200 text-amber-950 border border-black rounded-lg font-black shadow-[1px_1px_0px_#000]'>
							C = Cukup (60–74)
						</span>
						<span className='px-2.5 py-1 bg-rose-200 text-rose-950 border border-black rounded-lg font-black shadow-[1px_1px_0px_#000]'>
							D = Kurang (&lt; 60)
						</span>
					</div>
				</div>
			) : (
				<div className='p-3.5 bg-teal-50 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-800'>
					<div className='flex items-center gap-2'>
						<Info className='w-4 h-4 text-[#00A693]' />
						<span>Pedoman Rubrik TP:</span>
					</div>
					<div className='flex flex-wrap items-center gap-2 font-mono text-[11px]'>
						<span className='px-2 py-0.5 bg-emerald-200 border border-black rounded'>4 = Sangat Baik</span>
						<span className='px-2 py-0.5 bg-blue-200 border border-black rounded'>3 = Baik</span>
						<span className='px-2 py-0.5 bg-yellow-200 border border-black rounded'>2 = Cukup</span>
						<span className='px-2 py-0.5 bg-rose-200 border border-black rounded'>1 = Perlu Bimbingan</span>
					</div>
				</div>
			)}

			{/* Tabel Penilaian Rubrik TP */}
			{kelasList.length === 0 ? (
				<div className='p-12 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<Users className='w-10 h-10 mx-auto text-gray-400' />
					<h3 className='text-base font-black text-black'>Belum Ada Penugasan Kelas Ajar</h3>
					<p className='text-xs text-gray-500 max-w-md mx-auto'>
						Akun Anda belum terhubung dengan jadwal atau penugasan mengajar di rombel mana pun.
					</p>
				</div>
			) : mapelList.length === 0 ? (
				<div className='p-12 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<AlertCircle className='w-10 h-10 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Tidak Ada Mata Pelajaran Diampu</h3>
					<p className='text-xs text-gray-500 max-w-md mx-auto'>
						Anda tidak ditugaskan mengajar mata pelajaran apa pun pada kelas yang dipilih.
					</p>
				</div>
			) : isEkskulMode ? (
				/* TABEL PRATINJAU NILAI & CAPAIAN EKSTRAKURIKULER */
				<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
					<div className='p-4 bg-yellow-50 border-b-2 border-black flex flex-wrap items-center justify-between gap-3'>
						<div className='flex items-center gap-2'>
							<Sparkles className='w-5 h-5 text-[#2F80ED]' />
							<span className='font-black text-xs sm:text-sm text-black'>
								Pratinjau Capaian Ekstrakurikuler: {ekskulDisplayName}
							</span>
							<span className='px-2.5 py-0.5 text-[10px] font-black uppercase rounded bg-blue-100 text-blue-900 border border-black'>
								Lembar 3 Rapor Siswa
							</span>
						</div>
						<div className='text-xs font-bold text-gray-600'>
							Total Siswa: <span className='font-black text-black'>{filteredStudents.length}</span>
						</div>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[750px]'>
							<thead>
								<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='p-3.5 w-12 text-center border-r-2 border-black'>No</th>
									<th className='p-3.5 w-52 border-r-2 border-black'>Nama Siswa</th>
									<th className='p-3.5 w-28 text-center border-r-2 border-black bg-yellow-200'>
										Nilai Angka
									</th>
									<th className='p-3.5 w-36 text-center border-r-2 border-black'>
										Predikat Rapor
									</th>
									<th className='p-3.5 min-w-[320px] border-r-2 border-black'>
										Narasi Capaian Rapor (Lembar 3)
									</th>
									<th className='p-3.5 w-36 text-center border-r-2 border-black'>
										Status Lembar 3
									</th>
									<th className='p-3.5 w-24 text-center'>Aksi</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black/20 text-xs font-medium'>
								{filteredStudents.map((s, idx) => {
									const studentGrade = grades[s.siswa_id] || {};
									const rawScore = s.nilai_kuantitatif;
									const hasScore = rawScore !== null && rawScore !== undefined && rawScore !== '';
									const numScore = hasScore ? Number(rawScore) : null;
									const pred = numScore !== null ? getPredikatFromNilai(numScore) : '-';
									const defaultNarasi = numScore !== null ? getDefaultNarasiEkskul(selectedMapelId, pred) : '';
									const narasi = studentGrade.deskripsi_tertinggi || defaultNarasi;
									const isCustomDesc = Boolean(studentGrade.deskripsi_tertinggi && studentGrade.deskripsi_tertinggi !== defaultNarasi);

									return (
										<tr key={s.siswa_id} className='hover:bg-yellow-50/40 transition-colors'>
											<td className='p-3 text-center font-black border-r-2 border-black/30 bg-gray-50/50'>
												{idx + 1}
											</td>
											<td className='p-3 font-black text-black border-r-2 border-black/30'>
												<div>{s.nama_lengkap}</div>
												<div className='text-[10px] font-mono text-gray-500'>{s.nis || s.nisn || '-'}</div>
											</td>
											<td className='p-3 text-center border-r-2 border-black/30 bg-yellow-50/30'>
												{hasScore ? (
													<span className='inline-block px-3 py-1 text-xs font-black rounded-lg border-2 border-black bg-white shadow-[1.5px_1.5px_0px_0px_#000]'>
														{numScore}
													</span>
												) : (
													<span className='inline-block px-2.5 py-1 text-[10px] font-bold text-gray-400 bg-gray-100 border border-dashed border-gray-300 rounded'>
														Belum Diisi
													</span>
												)}
											</td>
											<td className='p-3 text-center border-r-2 border-black/30'>
												{hasScore ? (
													<span
														className={`inline-block px-3 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] ${
															pred === 'A'
																? 'bg-emerald-200 text-emerald-950'
																: pred === 'B'
																? 'bg-blue-200 text-blue-950'
																: pred === 'C'
																? 'bg-amber-200 text-amber-950'
																: 'bg-rose-200 text-rose-950'
														}`}>
														Predikat {pred}
													</span>
												) : (
													<span className='font-mono font-bold text-gray-400'>-</span>
												)}
											</td>
											<td className='p-3 border-r-2 border-black/30 text-xs leading-relaxed'>
												{narasi ? (
													<div className='space-y-1'>
														<div className='p-2.5 bg-gray-50 border-2 border-black/20 rounded-xl text-gray-800 font-medium'>
															{narasi}
														</div>
														<div className='flex items-center gap-1.5 text-[10px] font-mono text-gray-500'>
															<span>⚡ Sinkron ke Lembar 3</span>
															{isCustomDesc && (
																<span className='text-amber-700 font-black'>• (Disesuaikan Guru)</span>
															)}
														</div>
													</div>
												) : (
													<div className='text-gray-400 italic text-[11px]'>
														Nilai kuantitatif belum diinput. Masukkan nilai di menu Penilaian Kuantitatif untuk menghasilkan narasi otomatis.
													</div>
												)}
											</td>
											<td className='p-3 text-center border-r-2 border-black/30'>
												{hasScore ? (
													<span className='inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-black rounded-lg text-[10px] font-black shadow-[1px_1px_0px_#000]'>
														<Check className='w-3 h-3 text-emerald-700' />
														<span>Tersinkron Rapor</span>
													</span>
												) : (
													<span className='inline-block px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-bold'>
														Menunggu Nilai
													</span>
												)}
											</td>
											<td className='p-3 text-center'>
												<button
													onClick={() => setEditingDescSiswa(s)}
													disabled={lockStatus.isLocked}
													className='px-2.5 py-1.5 bg-white hover:bg-yellow-200 text-black border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_0px_#000] text-[11px] font-black hover:translate-x-[0.5px] hover:translate-y-[0.5px] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer'>
													<FileText className='w-3.5 h-3.5' />
													<span>Edit</span>
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			) : tps.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-3'>
					<AlertCircle className='w-10 h-10 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Belum Ada Tujuan Pembelajaran (TP)</h3>
					<p className='text-xs text-gray-500 max-w-md mx-auto'>
						Mata pelajaran ini belum memiliki Tujuan Pembelajaran untuk tingkat kelas yang dipilih. Silakan rumuskan TP terlebih dahulu pada menu Tujuan Pembelajaran.
					</p>
					<Link
						href='/erapor/tujuan-pembelajaran'
						className='inline-block px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer'>
						Buka Menu TP
					</Link>
				</div>
			) : (
				<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[750px]'>
							<thead>
								<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='p-3.5 w-12 text-center border-r-2 border-black'>No</th>
									<th className='p-3.5 w-44 border-r-2 border-black'>Nama Siswa</th>
									<th
										className='p-3.5 w-24 text-center border-r-2 border-black bg-yellow-200'
										title='Nilai Akhir dari Penilaian Kuantitatif'>
										Nilai Kuantitatif
									</th>
									{tps.map((tp, tpIdx) => (
										<th
											key={tp.id}
											className='p-2.5 w-24 text-center border-r-2 border-black group relative'
											title={tp.deskripsi}>
											<div className='text-[11px] font-black'>
												{tp.kode_tp && tp.kode_tp !== '-' ? tp.kode_tp : `TP ${tpIdx + 1}`}
											</div>
											<div className='text-[9px] font-normal normal-case truncate max-w-[90px] mx-auto text-gray-700'>
												{tp.deskripsi}
											</div>
										</th>
									))}
									<th className='p-3.5 min-w-[280px] border-r-2 border-black'>
										Deskripsi Capaian Otomatis (Rapor)
									</th>
									<th className='p-3.5 w-24 text-center'>Aksi</th>
								</tr>
								{/* Baris Quick Fill Per TP */}
								<tr className='bg-yellow-100 border-b-2 border-black text-[10px] font-bold'>
									<td colSpan={3} className='p-2 text-right pr-3 border-r-2 border-black text-gray-700'>
										Isi Cepat Rubrik:
									</td>
									{tps.map((tp) => (
										<td key={tp.id} className='p-1.5 text-center border-r-2 border-black'>
											<div className='flex items-center justify-center gap-1'>
												{[4, 3, 2, 1].map((num) => (
													<button
														key={num}
														onClick={() => handleBatchFillTp(tp.id, num)}
														disabled={lockStatus.isLocked}
														className='w-5 h-5 text-[10px] font-black rounded bg-white hover:bg-yellow-300 border border-black shadow-[0.5px_0.5px_0px_#000] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
														title={lockStatus.isLocked ? 'Rombel terkunci' : `Isi semua ${num}`}>
														{num}
													</button>
												))}
											</div>
										</td>
									))}
									<td colSpan={2} className='p-2 text-gray-500 italic text-[11px]'>
										Narasi tertinggi & terendah terisi otomatis
									</td>
								</tr>
							</thead>
							<tbody className='divide-y divide-black/20 text-xs font-medium'>
								{filteredStudents.map((s, idx) => {
									const studentGrade = grades[s.siswa_id] || { tp_scores: {} };
									const { tp_scores, deskripsi_tertinggi, deskripsi_terendah } = studentGrade;

									return (
										<tr key={s.siswa_id} className='hover:bg-yellow-50/40 transition-colors'>
											<td className='p-3 text-center font-black border-r-2 border-black/30'>
												{idx + 1}
											</td>
											<td className='p-3 font-black text-black border-r-2 border-black/30'>
												<div>{s.nama_lengkap}</div>
												<div className='text-[10px] font-mono text-gray-500'>{s.nis || s.nisn || '-'}</div>
											</td>
											<td className='p-2 text-center border-r-2 border-black/30'>
												{s.nilai_kuantitatif !== null && s.nilai_kuantitatif !== undefined && s.nilai_kuantitatif !== '' ? (
													<span
														className={`inline-block px-2.5 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] ${
															kkm && Number(s.nilai_kuantitatif) < kkm
																? 'bg-rose-100 text-rose-900 border-rose-900'
																: 'bg-emerald-100 text-emerald-950 border-emerald-900'
														}`}
														title={kkm ? (Number(s.nilai_kuantitatif) < kkm ? `Di bawah KKM (${kkm})` : `Mencapai KKM (≥ ${kkm})`) : undefined}>
														{s.nilai_kuantitatif}
													</span>
												) : (
													<span className='inline-block px-2 py-0.5 text-[10px] font-bold text-gray-400 bg-gray-100 border border-dashed border-gray-300 rounded'>
														Kosong
													</span>
												)}
											</td>
											{tps.map((tp) => {
												const val = tp_scores[tp.id] ?? '';
												return (
													<td key={tp.id} className='p-2 text-center border-r-2 border-black/30'>
														<select
															value={val}
															disabled={lockStatus.isLocked}
															onChange={(e) => handleScoreChange(s.siswa_id, tp.id, e.target.value)}
															className={`w-14 px-1.5 py-1 text-center font-black rounded-lg border-2 border-black ${
																lockStatus.isLocked
																	? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-400'
																	: val === 4
																	? 'bg-emerald-200 text-emerald-950 cursor-pointer'
																	: val === 3
																	? 'bg-blue-200 text-blue-950 cursor-pointer'
																	: val === 2
																	? 'bg-yellow-200 text-yellow-950 cursor-pointer'
																	: val === 1
																	? 'bg-rose-200 text-rose-950 cursor-pointer'
																	: 'bg-white text-gray-400 cursor-pointer'
															}`}>
															<option value=''>-</option>
															<option value='4'>4 (SB)</option>
															<option value='3'>3 (B)</option>
															<option value='2'>2 (C)</option>
															<option value='1'>1 (PB)</option>
														</select>
													</td>
												);
											})}
											{/* Narasi Rapor */}
											<td className='p-3 border-r-2 border-black/30 text-[11px] leading-relaxed space-y-1.5'>
												{deskripsi_tertinggi || deskripsi_terendah ? (
													<>
														{deskripsi_tertinggi && (
															<div className='text-emerald-900 bg-emerald-50 p-2 rounded border border-emerald-300'>
																<span className='font-black'>Capaian Tertinggi: </span>
																{deskripsi_tertinggi}
															</div>
														)}
														{deskripsi_terendah && (
															<div className='text-rose-900 bg-rose-50 p-2 rounded border border-rose-300'>
																<span className='font-black'>Perlu Bimbingan: </span>
																{deskripsi_terendah}
															</div>
														)}
													</>
												) : (
													<div className='text-gray-400 italic text-[11px]'>
														Isi skor rubrik TP untuk menghasilkan deskripsi otomatis.
													</div>
												)}
											</td>
											{/* Tombol Kustomisasi Deskripsi */}
											<td className='p-3 text-center'>
												<button
													onClick={() => setEditingDescSiswa(s)}
													disabled={lockStatus.isLocked}
													className='px-2.5 py-1 bg-white hover:bg-yellow-200 text-black border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_0px_#000] text-[11px] font-black hover:translate-x-[0.5px] hover:translate-y-[0.5px] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer'>
													<FileText className='w-3.5 h-3.5' />
													<span>Edit</span>
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Modal Edit Deskripsi Khusus */}
			{editingDescSiswa && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
					<div className='bg-white border-4 border-black rounded-2xl p-6 w-full max-w-xl shadow-[8px_8px_0px_0px_#000] space-y-4'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<h3 className='text-base font-black text-black'>
									Sesuaikan Deskripsi Narasi: {editingDescSiswa.nama_lengkap}
								</h3>
								{editingDescSiswa.nilai_kuantitatif !== null && editingDescSiswa.nilai_kuantitatif !== undefined && editingDescSiswa.nilai_kuantitatif !== '' ? (
									<div className='text-xs font-bold text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap'>
										<span>Nilai Angka: <strong className='text-black font-black'>{editingDescSiswa.nilai_kuantitatif}</strong></span>
										{isEkskulMode ? (
											<span className='px-2 py-0.5 bg-blue-100 text-blue-900 border border-black rounded text-[10px] font-black'>
												Predikat Lembar 3: {getPredikatFromNilai(Number(editingDescSiswa.nilai_kuantitatif))}
											</span>
										) : (
											<span>(KKM: {kkm})</span>
										)}
									</div>
								) : null}
							</div>
							<button
								onClick={() => setEditingDescSiswa(null)}
								className='text-lg font-black hover:text-rose-600 cursor-pointer'>
								✕
							</button>
						</div>

						<div className='space-y-3'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									{isEkskulMode ? 'Narasi Capaian Rapor (Lembar 3 Ekstrakurikuler)' : 'Capaian Kompetensi Tertinggi'}
								</label>
								<textarea
									rows={isEkskulMode ? 4 : 3}
									disabled={lockStatus.isLocked}
									placeholder={
										isEkskulMode
											? getPlaceholderNarasiEkskul(
													selectedMapelId,
													editingDescSiswa?.nilai_kuantitatif
														? getPredikatFromNilai(editingDescSiswa.nilai_kuantitatif)
														: 'Baik'
											  )
											: ''
									}
									value={grades[editingDescSiswa.siswa_id]?.deskripsi_tertinggi || ''}
									onChange={(e) => {
										const val = e.target.value;
										setGrades((prev) => ({
											...prev,
											[editingDescSiswa.siswa_id]: {
												...prev[editingDescSiswa.siswa_id],
												deskripsi_tertinggi: val,
											},
										}));
									}}
									className='w-full p-2.5 text-xs font-medium border-2 border-black rounded-xl bg-gray-50 focus:bg-yellow-50 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed'
								/>
								{isEkskulMode && (
									<p className='text-[10px] text-gray-500 font-medium mt-1'>
										* Narasi ini akan tercetak langsung pada kolom &quot;Keterangan&quot; di Lembar 3 Rapor Siswa.
									</p>
								)}
							</div>

							{!isEkskulMode && (
								<div>
									<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
										Capaian Yang Perlu Ditingkatkan / Bimbingan
									</label>
									<textarea
										rows={3}
										disabled={lockStatus.isLocked}
										value={grades[editingDescSiswa.siswa_id]?.deskripsi_terendah || ''}
										onChange={(e) => {
											const val = e.target.value;
											setGrades((prev) => ({
												...prev,
												[editingDescSiswa.siswa_id]: {
													...prev[editingDescSiswa.siswa_id],
													deskripsi_terendah: val,
												},
											}));
										}}
										className='w-full p-2.5 text-xs font-medium border-2 border-black rounded-xl bg-gray-50 focus:bg-yellow-50 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed'
									/>
								</div>
							)}
						</div>

						<div className='flex justify-end gap-2 pt-2 border-t-2 border-black'>
							<button
								onClick={() => setEditingDescSiswa(null)}
								className='px-4 py-2 bg-yellow-300 text-black font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer'>
								Selesai Mengedit
							</button>
						</div>
					</div>
				</div>
			)}
				</>
			)}
		</div>
	);
}
