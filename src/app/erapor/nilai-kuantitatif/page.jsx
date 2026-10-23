'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
	Calculator,
	Save,
	Loader2,
	Search,
	AlertCircle,
	Users,
	Keyboard,
	CheckCircle2,
	AlertTriangle,
	Award,
	RotateCcw,
	Lock,
	Sparkles,
	BookOpen,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import {
	isEkskulMapel,
	getOfficialEkskulName,
	getPredikatFromNilai,
	getDefaultNarasiEkskul,
	getPlaceholderNarasiEkskul,
} from '@/lib/eraporEkskulUtils';

export default function NilaiKuantitatifPage() {
	const [allKelasList, setAllKelasList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');
	const [selectedMapelId, setSelectedMapelId] = useState('');

	// Objek Mapel yang sedang dipilih
	const selectedMapelObj = useMemo(() => {
		return mapelList.find((m) => m.id === selectedMapelId || m.mapel === selectedMapelId);
	}, [mapelList, selectedMapelId]);

	// Mode Ekstrakurikuler (Opsi A: Dideteksi via database kelompok === 'Ekskul')
	const isEkskulMode = isEkskulMapel(selectedMapelId, selectedMapelObj);

	// Template Narasi Predikat A-D untuk Mode Ekskul
	const [ekskulTemplates, setEkskulTemplates] = useState({
		A: '',
		B: '',
		C: '',
		D: '',
	});
	const [customDescriptions, setCustomDescriptions] = useState({});

	// Nilai KKM / KKTP spesifik mapel & jenjang kelas
	const [kkm, setKkm] = useState(75);
	const [kkmSource, setKkmSource] = useState('Kurikulum');

	// Active academic period
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [students, setStudents] = useState([]);
	const [grades, setGrades] = useState({});
	const [loading, setLoading] = useState(true);
	const [loadingKelas, setLoadingKelas] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [lockStatus, setLockStatus] = useState({ isLocked: false, lockedByName: '', isGlobal: false });

	// Fetch initial master mapel, kelas & tahun ajar
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

	// Inisialisasi template narasi saat mapel berubah (dikosongkan, menggunakan placeholder panduan)
	useEffect(() => {
		if (isEkskulMode) {
			setEkskulTemplates({
				A: '',
				B: '',
				C: '',
				D: '',
			});
		}
	}, [selectedMapelId, isEkskulMode]);

	const resetEkskulTemplates = useCallback(() => {
		setEkskulTemplates({
			A: '',
			B: '',
			C: '',
			D: '',
		});
		setCustomDescriptions({});
		Swal.fire({
			icon: 'info',
			title: 'Template Dikosongkan',
			text: 'Template narasi telah dikosongkan (mengikuti placeholder panduan).',
			timer: 1500,
			showConfirmButton: false,
		});
	}, []);

	// Fetch student list & existing grades when filter changes
	const fetchStudentsAndGrades = useCallback(async () => {
		if (!selectedKelasId || !selectedMapelId) {
			setStudents([]);
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
			const url = `/api/erapor/nilai-kuantitatif?kelas_id=${selectedKelasId}&mapel_id=${selectedMapelId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				const studentData = json.students || [];
				setStudents(studentData);

				// Ambil status kunci rombel
				setLockStatus({
					isLocked: Boolean(json.is_locked),
					isGlobal: Boolean(json.is_locked_global),
					lockedByName: json.locked_by_name || '',
				});

				// Ambil KKM dinamis dari data kurikulum / standar
				if (json.kkm !== undefined && json.kkm !== null && !isNaN(Number(json.kkm))) {
					setKkm(Number(json.kkm));
					setKkmSource(json.kkm_source || '');
				}

				// Re-populate local grade state & custom descriptions
				const initGrades = {};
				const initDescs = {};
				studentData.forEach((s) => {
					initGrades[s.siswa_id] = s.nilai_akhir ?? '';
					if (s.deskripsi) {
						initDescs[s.siswa_id] = s.deskripsi;
					}
				});
				setGrades(initGrades);
				setCustomDescriptions(initDescs);
			} else {
				const errJson = await res.json().catch(() => ({}));
				Swal.fire({
					icon: 'warning',
					title: 'Perhatian',
					text: errJson.error || 'Gagal memuat data siswa & nilai.',
				});
				setStudents([]);
			}
		} catch (err) {
			console.error('Error fetching grades:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, selectedMapelId, semester, tahunAjaran, mapelList, allKelasList]);

	useEffect(() => {
		fetchStudentsAndGrades();
	}, [fetchStudentsAndGrades]);

	const handleGradeChange = (siswaId, val) => {
		let num = val.replace(/[^0-9.]/g, '');
		const parts = num.split('.');
		if (parts.length > 2) {
			num = parts[0] + '.' + parts.slice(1).join('');
		}
		// Hilangkan leading zero jika bukan "0." (misal "09" -> "9")
		if (num.length > 1 && num.startsWith('0') && !num.startsWith('0.')) {
			num = num.replace(/^0+/, '');
		}
		if (parseFloat(num) > 100) num = '100';
		setGrades((prev) => ({
			...prev,
			[siswaId]: num,
		}));
	};

	const handleKeyDown = (e, index) => {
		if (e.key === 'Enter' || e.key === 'ArrowDown') {
			e.preventDefault();
			const nextInput = document.getElementById(`input-grade-${index + 1}`);
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const prevInput = document.getElementById(`input-grade-${index - 1}`);
			if (prevInput) {
				prevInput.focus();
				prevInput.select();
			}
		}
	};

	const handleSave = async () => {
		if (!selectedKelasId || !selectedMapelId) {
			Swal.fire('Peringatan', 'Silakan pilih kelas dan mata pelajaran terlebih dahulu', 'warning');
			return;
		}

		try {
			setSaving(true);
			const gradePayload = students.map((s) => {
				const val = grades[s.siswa_id];
				const num = val !== '' && !isNaN(val) ? parseFloat(val) : '';
				let desc = '';
				if (isEkskulMode && num !== '') {
					const pred = getPredikatFromNilai(num);
					const key = pred === 'Sangat Baik' ? 'A' : pred === 'Baik' ? 'B' : pred === 'Cukup' ? 'C' : 'D';
					desc = customDescriptions[s.siswa_id] || ekskulTemplates[key] || '';
				}
				return {
					siswa_id: s.siswa_id,
					nilai_akhir: num,
					deskripsi: desc,
				};
			});

			const res = await fetch('/api/erapor/nilai-kuantitatif', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					mapel_id: selectedMapelId,
					semester,
					tahun_ajaran: tahunAjaran,
					grades: gradePayload,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan nilai');

			Swal.fire({
				icon: 'success',
				title: 'Tersimpan',
				text: `Nilai dan narasi rapor berhasil disimpan untuk ${json.count || 0} siswa.`,
				timer: 1500,
				showConfirmButton: false,
			});
			fetchStudentsAndGrades();
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
		} finally {
			setSaving(false);
		}
	};

	// Kosongkan seluruh nilai siswa di kelas & mapel ini
	const handleResetGrades = async () => {
		if (students.length === 0) return;

		const result = await Swal.fire({
			title: 'Kosongkan Seluruh Nilai?',
			text: 'Seluruh input nilai siswa pada kelas dan mata pelajaran ini akan dikosongkan. Klik "Simpan Nilai" setelahnya untuk memperbarui database.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#e11d48',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Ya, Kosongkan Nilai',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			const resetGrades = {};
			students.forEach((s) => {
				resetGrades[s.siswa_id] = '';
			});
			setGrades(resetGrades);

			Swal.fire({
				icon: 'info',
				title: 'Nilai Dikosongkan',
				text: 'Seluruh nilai telah dikosongkan pada layar. Klik "Simpan Nilai" untuk menyimpan perubahan permanen ke database.',
				timer: 2000,
				showConfirmButton: false,
			});
		}
	};

	// Statistika nilai & ketuntasan KKM
	const stats = useMemo(() => {
		const validValues = Object.values(grades)
			.filter((v) => v !== '' && v !== null && v !== undefined)
			.map(Number)
			.filter((n) => !isNaN(n) && n >= 0);
		if (validValues.length === 0) {
			return {
				max: '-',
				min: '-',
				avg: '-',
				filled: 0,
				tuntas: 0,
				belumTuntas: 0,
				pctTuntas: 0,
			};
		}

		const max = Math.max(...validValues);
		const min = Math.min(...validValues);
		const avg = (validValues.reduce((a, b) => a + b, 0) / validValues.length).toFixed(1);
		const tuntas = validValues.filter((v) => v >= kkm).length;
		const belumTuntas = validValues.length - tuntas;
		const pctTuntas = Math.round((tuntas / validValues.length) * 100);

		return {
			max,
			min,
			avg,
			filled: validValues.length,
			tuntas,
			belumTuntas,
			pctTuntas,
		};
	}, [grades, kkm]);

	const filteredStudents = students.filter((s) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q));
	});

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-lg sm:text-2xl font-black text-black flex items-center gap-2'>
						<Calculator className='w-5 h-5 sm:w-6 sm:h-6 text-[#2F80ED]' />
						<span>Input Nilai Kuantitatif</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Input angka nilai akhir (skala 0–100) per siswa untuk mata pelajaran dan rombel yang Anda ampu.
					</p>
				</div>
				<div className='flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap'>
					<button
						type='button'
						onClick={handleResetGrades}
						disabled={saving || loading || students.length === 0 || lockStatus.isLocked}
						className='flex-1 sm:flex-initial px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer'
						title={lockStatus.isLocked ? 'Rombel terkunci (Read-Only)' : 'Kosongkan seluruh nilai siswa di kelas ini'}>
						<RotateCcw className='w-4 h-4 text-rose-700' />
						<span>Kosongkan Nilai</span>
					</button>

					<button
						type='button'
						onClick={handleSave}
						disabled={saving || loading || students.length === 0 || lockStatus.isLocked}
						className='flex-1 sm:flex-initial px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer'
						title={lockStatus.isLocked ? 'Rombel terkunci (Read-Only)' : 'Simpan nilai ke database'}>
						{saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
						<span>{saving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
					</button>
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
								Nilai rapor untuk rombel ini telah difinalisasi dan dikunci oleh{' '}
								<strong>{lockStatus.lockedByName || 'Wali Kelas / Kurikulum'}</strong>. Form pengisian beralih ke mode hanya-baca (read-only). Hubungi Wali Kelas atau Kurikulum jika ada perbaikan nilai yang mendesak.
							</p>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className='p-12 sm:p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat data siswa dan nilai rapor...</p>
					<p className='text-xs font-bold text-gray-500'>Menyiapkan rombel, daftar siswa, dan standar KKM</p>
				</div>
			) : (
				<>
					{/* Filter Rombel & Mapel */}
					<div className='p-3.5 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between'>
						<div className='flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto'>
							{/* Pilihan Mapel */}
							<div className='flex items-center gap-1.5 sm:gap-2'>
								<span className='text-[11px] sm:text-xs font-black uppercase text-gray-600'>Mapel:</span>
								{mapelList.length === 0 ? (
									<span className='text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 border border-black rounded-lg'>
										Tidak ada mapel diampu
									</span>
								) : (
									<select
										value={selectedMapelId}
										onChange={(e) => handleMapelChange(e.target.value)}
										className='px-2.5 sm:px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold max-w-[200px] sm:max-w-xs cursor-pointer truncate'>
										{mapelList.map((m) => (
											<option key={m.id} value={m.id}>
												{m.mapel}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Pilihan Kelas */}
							<div className='flex items-center gap-1.5 sm:gap-2'>
								<span className='text-[11px] sm:text-xs font-black uppercase text-gray-600'>Kelas:</span>
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
										className='px-2.5 sm:px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
										{kelasList.map((k) => (
											<option key={k.id} value={k.id}>
												{k.kelas || k.nama_kelas}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Semester & Tahun */}
							<span className='px-2 sm:px-2.5 py-1 bg-gray-100 text-black border border-black rounded-lg text-[11px] sm:text-xs font-black shrink-0 whitespace-nowrap'>
								Sem. {semester} • {tahunAjaran}
							</span>

							{/* Standar KKM / Mode Ekskul */}
							{isEkskulMode ? (
								<div className='flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-teal-100 border border-black rounded-lg text-[11px] sm:text-xs font-black shadow-[1px_1px_0px_0px_#000] shrink-0 whitespace-nowrap text-teal-900'>
									<Sparkles className='w-3.5 h-3.5 text-teal-800' />
									<span>Mode Ekstrakurikuler Rapor</span>
								</div>
							) : (
								<div className='flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-yellow-100 border border-black rounded-lg text-[11px] sm:text-xs font-black shadow-[1px_1px_0px_0px_#000] shrink-0 whitespace-nowrap'>
									<Award className='w-3.5 h-3.5 text-black' />
									<span>
										KKM: <strong className='text-rose-700 font-black'>{kkm}</strong>
									</span>
									{kkmSource && (
										<span className='text-[10px] text-gray-600 font-bold hidden md:inline'>
											({kkmSource})
										</span>
									)}
								</div>
							)}
						</div>

						{/* Search Box */}
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

					{/* Mode Ekskul: Panel Pengaturan Template Narasi A-D */}
					{isEkskulMode && (
						<div className='p-4 bg-yellow-50/90 border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-3'>
							<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
								<div className='flex items-center gap-2'>
									<Sparkles className='w-5 h-5 text-amber-600 shrink-0' />
									<div>
										<h3 className='text-xs sm:text-sm font-black text-black flex items-center gap-1.5'>
											<span>Pengaturan Template Narasi Rapor — {getOfficialEkskulName(selectedMapelId)}</span>
										</h3>
										<p className='text-[11px] text-gray-600 font-medium'>
											Contoh kalimat di bawah ini adalah placeholder panduan. Anda dapat mengisi narasi template sendiri atau membiarkannya kosong:
										</p>
									</div>
								</div>
								<button
									type='button'
									onClick={resetEkskulTemplates}
									className='px-3 py-1 bg-white hover:bg-yellow-200 text-black border border-black rounded-lg text-xs font-bold transition-all shadow-[1px_1px_0px_#000] self-start sm:self-auto cursor-pointer'>
									Kosongkan Template
								</button>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1'>
								<div className='p-2.5 bg-white border-2 border-black rounded-xl space-y-1 shadow-[1.5px_1.5px_0px_#000]'>
									<span className='px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-400 rounded text-[10px] font-black'>
										Predikat A (Sangat Baik: 85 – 100)
									</span>
									<textarea
										rows={2}
										value={ekskulTemplates.A}
										onChange={(e) => setEkskulTemplates((prev) => ({ ...prev, A: e.target.value }))}
										placeholder={getPlaceholderNarasiEkskul(selectedMapelId, 'Sangat Baik')}
										className='w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-400'
									/>
								</div>

								<div className='p-2.5 bg-white border-2 border-black rounded-xl space-y-1 shadow-[1.5px_1.5px_0px_#000]'>
									<span className='px-2 py-0.5 bg-yellow-100 text-yellow-900 border border-yellow-500 rounded text-[10px] font-black'>
										Predikat B (Baik: 75 – 84)
									</span>
									<textarea
										rows={2}
										value={ekskulTemplates.B}
										onChange={(e) => setEkskulTemplates((prev) => ({ ...prev, B: e.target.value }))}
										placeholder={getPlaceholderNarasiEkskul(selectedMapelId, 'Baik')}
										className='w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-400'
									/>
								</div>

								<div className='p-2.5 bg-white border-2 border-black rounded-xl space-y-1 shadow-[1.5px_1.5px_0px_#000]'>
									<span className='px-2 py-0.5 bg-orange-100 text-orange-900 border border-orange-400 rounded text-[10px] font-black'>
										Predikat C (Cukup: 60 – 74)
									</span>
									<textarea
										rows={2}
										value={ekskulTemplates.C}
										onChange={(e) => setEkskulTemplates((prev) => ({ ...prev, C: e.target.value }))}
										placeholder={getPlaceholderNarasiEkskul(selectedMapelId, 'Cukup')}
										className='w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-400'
									/>
								</div>

								<div className='p-2.5 bg-white border-2 border-black rounded-xl space-y-1 shadow-[1.5px_1.5px_0px_#000]'>
									<span className='px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-400 rounded text-[10px] font-black'>
										Predikat D (Kurang: &lt; 60)
									</span>
									<textarea
										rows={2}
										value={ekskulTemplates.D}
										onChange={(e) => setEkskulTemplates((prev) => ({ ...prev, D: e.target.value }))}
										placeholder={getPlaceholderNarasiEkskul(selectedMapelId, 'Kurang')}
										className='w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-black placeholder-gray-400'
									/>
								</div>
							</div>
						</div>
					)}

					{/* Mini Stats Bar */}
					{isEkskulMode ? (
						<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3'>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-gray-500'>Siswa Terisi</span>
								<span className='text-sm sm:text-base font-black text-black mt-1'>
									{stats.filled} <span className='text-xs font-bold text-gray-500'>/ {students.length}</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-emerald-700'>Predikat A (≥85)</span>
								<span className='text-sm sm:text-base font-black text-emerald-600 mt-1'>
									{stats.countA || 0} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-yellow-800'>Predikat B (75–84)</span>
								<span className='text-sm sm:text-base font-black text-yellow-600 mt-1'>
									{stats.countB || 0} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-orange-700'>Predikat C (60–74)</span>
								<span className='text-sm sm:text-base font-black text-orange-600 mt-1'>
									{stats.countC || 0} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between col-span-2 sm:col-span-1'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-rose-700'>Predikat D (&lt;60)</span>
								<span className='text-sm sm:text-base font-black text-rose-600 mt-1'>
									{stats.countD || 0} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
						</div>
					) : (
						<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3'>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-gray-500'>Siswa Terisi</span>
								<span className='text-sm sm:text-base font-black text-black mt-1'>
									{stats.filled} <span className='text-xs font-bold text-gray-500'>/ {students.length}</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-gray-500'>Standar KKM</span>
								<div className='flex items-baseline gap-1 mt-1'>
									<span className='text-sm sm:text-base font-black text-black'>{kkm}</span>
									<span className='text-[10px] font-bold text-gray-500 truncate'>({kkmSource || 'Kurikulum'})</span>
								</div>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-emerald-700 flex items-center justify-between'>
									<span>Tuntas (≥{kkm})</span>
									<span className='text-[10px] font-bold'>{stats.pctTuntas}%</span>
								</span>
								<span className='text-sm sm:text-base font-black text-emerald-600 mt-1'>
									{stats.tuntas} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-rose-700'>
									Belum Tuntas (&lt;{kkm})
								</span>
								<span className='text-sm sm:text-base font-black text-rose-600 mt-1'>
									{stats.belumTuntas} <span className='text-xs font-bold text-gray-500'>Siswa</span>
								</span>
							</div>
							<div className='p-2.5 sm:p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-col justify-between col-span-2 sm:col-span-1'>
								<span className='text-[10px] sm:text-[11px] font-black uppercase text-gray-500'>Rata-rata</span>
								<div className='flex items-baseline justify-between mt-1'>
									<span className='text-sm sm:text-base font-black text-blue-600'>{stats.avg}</span>
									<span className='text-[10px] font-bold text-gray-500'>
										{stats.min} – {stats.max}
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Tips Navigasi Keyboard & Info Ketuntasan KKM / Predikat Ekskul */}
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs bg-[#FFFDF0] border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#000]'>
						<div className='hidden sm:flex items-center gap-2 font-medium text-gray-700'>
							<Keyboard className='w-4 h-4 text-black flex-shrink-0' />
							<span>
								<strong className='font-black text-black'>Navigasi Cepat:</strong> Tekan{' '}
								<kbd className='px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000] font-mono text-[11px] font-bold'>
									Enter
								</kbd>{' '}
								atau{' '}
								<kbd className='px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000] font-mono text-[11px] font-bold'>
									↓
								</kbd>{' '}
								untuk siswa berikutnya,{' '}
								<kbd className='px-1.5 py-0.5 bg-white border border-black rounded shadow-[1px_1px_0px_#000] font-mono text-[11px] font-bold'>
									↑
								</kbd>{' '}
								untuk siswa sebelumnya.
							</span>
						</div>
						{isEkskulMode ? (
							<div className='flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold'>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-600 bg-emerald-100 text-emerald-900'>
									A (≥85)
								</span>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-yellow-600 bg-yellow-100 text-yellow-900'>
									B (75–84)
								</span>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-orange-600 bg-orange-100 text-orange-900'>
									C (60–74)
								</span>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-rose-600 bg-rose-100 text-rose-900'>
									D (&lt;60)
								</span>
							</div>
						) : (
							<div className='flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold'>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border-2 border-black bg-yellow-200 text-black font-black shadow-[1px_1px_0px_0px_#000]'>
									KKM: {kkm}
								</span>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-500 bg-emerald-100 text-emerald-900 font-bold'>
									≥ {kkm} : Tuntas
								</span>
								<span className='px-2 sm:px-2.5 py-1 rounded-lg border border-rose-500 bg-rose-100 text-rose-900 font-bold'>
									&lt; {kkm} : Belum Tuntas (Remedial)
								</span>
							</div>
						)}
					</div>

			{/* Tabel Siswa & Nilai */}
			<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
				{students.length === 0 ? (
					<div className='p-12 text-center space-y-2'>
						<Users className='w-8 h-8 text-gray-400 mx-auto' />
						<p className='text-sm font-black text-black'>
							{kelasList.length === 0
								? 'Belum ada jadwal penugasan kelas untuk akun Anda.'
								: mapelList.length === 0
								? 'Anda tidak ditugaskan mengajar mata pelajaran apa pun di kelas ini.'
								: 'Tidak ada data siswa aktif di rombel kelas ini.'}
						</p>
					</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse text-xs sm:text-sm min-w-[540px]'>
							<thead>
								<tr className='bg-[#F8F7F0] border-b-2 border-black text-black'>
									<th className='p-2.5 sm:p-4 font-black text-center w-12 sm:w-14'>No</th>
									<th className='p-2.5 sm:p-4 font-black w-28 sm:w-36'>NIS / NISN</th>
									<th className='p-2.5 sm:p-4 font-black w-36 sm:w-48'>Nama Siswa</th>
									{!isEkskulMode && (
										<th className='p-2.5 sm:p-4 font-black text-center w-14 sm:w-20'>L/P</th>
									)}
									<th className='p-2.5 sm:p-4 font-black text-center w-32 sm:w-40'>
										Nilai {isEkskulMode ? 'Angka (0–100)' : 'Akhir (0–100)'}
									</th>
									<th className='p-2.5 sm:p-4 font-black text-center w-36 sm:w-44'>
										{isEkskulMode ? 'Predikat Rapor' : `Status KKM (${kkm})`}
									</th>
									{isEkskulMode && (
										<th className='p-2.5 sm:p-4 font-black min-w-[280px]'>
											Keterangan Capaian Rapor (Live Narasi)
										</th>
									)}
								</tr>
							</thead>
							<tbody className='divide-y divide-black/10'>
								{filteredStudents.map((s, idx) => {
									const val = grades[s.siswa_id] ?? '';
									const isFilled = val !== '' && !isNaN(val) && !isNaN(parseFloat(val));
									const numVal = parseFloat(val);
									const isTuntas = isFilled && numVal >= kkm;
									const isBelowKkm = isFilled && numVal < kkm;

									// Khusus Mode Ekskul
									const pred = isFilled ? getPredikatFromNilai(numVal) : '';
									const predKey = pred === 'Sangat Baik' ? 'A' : pred === 'Baik' ? 'B' : pred === 'Cukup' ? 'C' : 'D';
									const liveNarasi = customDescriptions[s.siswa_id] !== undefined
										? customDescriptions[s.siswa_id]
										: (isFilled ? (ekskulTemplates[predKey] || '') : '');

									return (
										<tr
											key={s.siswa_id}
											className={`transition-colors font-medium ${
												!isEkskulMode && isBelowKkm
													? 'bg-rose-50/40 hover:bg-rose-50/70'
													: 'hover:bg-yellow-50/60'
											}`}>
											<td className='p-2.5 sm:p-4 text-center font-black text-gray-500'>{idx + 1}</td>
											<td className='p-2.5 sm:p-4 font-mono font-bold text-gray-600'>
												{s.nis || s.nisn || '-'}
											</td>
											<td className='p-2.5 sm:p-4 font-black text-black'>
												<div>{s.nama_lengkap}</div>
												{isEkskulMode && (
													<span className='text-[10px] text-gray-500 font-bold'>
														{s.jenis_kelamin === 'L' || s.jenis_kelamin === 'Laki-laki'
															? 'Laki-laki'
															: s.jenis_kelamin === 'P' || s.jenis_kelamin === 'Perempuan'
															? 'Perempuan'
															: ''}
													</span>
												)}
											</td>
											{!isEkskulMode && (
												<td className='p-2.5 sm:p-4 text-center'>
													<span
														className={`inline-block px-2 py-0.5 rounded text-[11px] font-black border ${
															s.jenis_kelamin === 'L' || s.jenis_kelamin === 'Laki-laki'
																? 'bg-blue-50 text-blue-800 border-blue-300'
																: 'bg-rose-50 text-rose-800 border-rose-300'
														}`}>
														{s.jenis_kelamin === 'L' || s.jenis_kelamin === 'Laki-laki'
															? 'L'
															: s.jenis_kelamin === 'P' || s.jenis_kelamin === 'Perempuan'
															? 'P'
															: '-'}
													</span>
												</td>
											)}
											<td className='p-2.5 sm:p-4 text-center'>
												<div className='flex flex-col items-center justify-center'>
													<input
														id={`input-grade-${idx}`}
														type='text'
														inputMode='decimal'
														placeholder='0–100'
														value={val}
														disabled={lockStatus.isLocked}
														onChange={(e) => handleGradeChange(s.siswa_id, e.target.value)}
														onFocus={(e) => e.target.select()}
														onKeyDown={(e) => handleKeyDown(e, idx)}
														className={`w-20 sm:w-28 px-2 sm:px-3 py-1.5 text-center font-black text-xs sm:text-sm rounded-xl transition-all ${
															lockStatus.isLocked
																? 'bg-gray-100 border-2 border-gray-400 text-gray-700 cursor-not-allowed shadow-none'
																: !isFilled
																? 'bg-white border-2 border-black text-gray-400 shadow-[2px_2px_0px_0px_#000] focus:bg-yellow-100'
																: !isEkskulMode && isBelowKkm
																? 'bg-rose-50 border-2 border-rose-600 text-rose-950 shadow-[2px_2px_0px_0px_#e11d48] focus:bg-rose-100'
																: 'bg-emerald-50 border-2 border-emerald-700 text-emerald-950 shadow-[2px_2px_0px_0px_#047857] focus:bg-emerald-100'
														} focus:outline-none`}
													/>
													{!isEkskulMode && isBelowKkm && (
														<span className='text-[10px] font-black text-rose-600 mt-1 flex items-center gap-0.5 animate-pulse'>
															<AlertTriangle className='w-3 h-3' /> Belum Tuntas (&lt;{kkm})
														</span>
													)}
												</div>
											</td>

											{/* Kolom Status KKM (Reguler) ATAU Predikat Rapor (Ekskul) */}
											<td className='p-2.5 sm:p-4 text-center'>
												{isEkskulMode ? (
													isFilled ? (
														<span
															className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border-2 shadow-[2px_2px_0px_0px_#000] ${
																predKey === 'A'
																	? 'bg-emerald-100 text-emerald-900 border-emerald-700'
																	: predKey === 'B'
																	? 'bg-yellow-100 text-yellow-900 border-yellow-600'
																	: predKey === 'C'
																	? 'bg-orange-100 text-orange-900 border-orange-600'
																	: 'bg-rose-100 text-rose-900 border-rose-600'
															}`}>
															<span>{predKey} ({pred})</span>
														</span>
													) : (
														<span className='text-gray-400 text-xs italic font-medium'>
															Belum Diisi
														</span>
													)
												) : (
													isFilled ? (
														isTuntas ? (
															<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border-2 border-emerald-700 bg-emerald-100 text-emerald-900 shadow-[2px_2px_0px_0px_#047857]'>
																<CheckCircle2 className='w-3.5 h-3.5 text-emerald-700' />
																<span>Tuntas</span>
															</span>
														) : (
															<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border-2 border-rose-700 bg-rose-100 text-rose-900 shadow-[2px_2px_0px_0px_#be123c]'>
																<AlertTriangle className='w-3.5 h-3.5 text-rose-700' />
																<span>Belum Tuntas</span>
															</span>
														)
													) : (
														<span className='text-gray-400 text-xs italic font-medium'>
															Belum Diisi
														</span>
													)
												)}
											</td>

											{/* Kolom Keterangan Capaian Live (Hanya Mode Ekskul) */}
											{isEkskulMode && (
												<td className='p-2 sm:p-3'>
													{isFilled ? (
														<div className='space-y-1'>
															<textarea
																rows={2}
																value={customDescriptions[s.siswa_id] !== undefined ? customDescriptions[s.siswa_id] : (ekskulTemplates[predKey] || '')}
																disabled={lockStatus.isLocked}
																onChange={(e) =>
																	setCustomDescriptions((prev) => ({
																		...prev,
																		[s.siswa_id]: e.target.value,
																	}))
																}
																placeholder={ekskulTemplates[predKey] || getPlaceholderNarasiEkskul(selectedMapelId, pred) || 'Tuliskan keterangan capaian kegiatan (opsional)...'}
																className='w-full p-2 bg-white border-2 border-black rounded-xl text-xs font-medium focus:bg-yellow-50 focus:outline-none shadow-[1.5px_1.5px_0px_#000] placeholder-gray-400'
															/>
															{customDescriptions[s.siswa_id] !== undefined &&
																customDescriptions[s.siswa_id] !== (ekskulTemplates[predKey] || '') && (
																	<span className='text-[10px] text-amber-800 font-black flex items-center gap-1'>
																		✎ Narasi kustom siswa
																	</span>
																)}
														</div>
													) : (
														<span className='text-gray-400 text-xs italic font-medium'>
															Ketik nilai angka di samping untuk memunculkan input capaian.
														</span>
													)}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
							{filteredStudents.length > 0 && (
								<tfoot className='bg-[#F8F7F0] border-t-2 border-black font-black text-xs sm:text-sm'>
									<tr>
										<td colSpan={isEkskulMode ? 3 : 4} className='p-2.5 sm:p-4 text-right uppercase tracking-wider text-gray-700 font-black'>
											Total Terisi: <span className='text-black font-black'>{stats.filled}</span> / {filteredStudents.length} Siswa
										</td>
										<td className='p-2.5 sm:p-4 text-center'>
											<span className='inline-block px-2.5 py-1 bg-white border border-black rounded-lg shadow-[1px_1px_0px_0px_#000] font-black text-xs'>
												Rata-rata: <strong className='text-blue-700'>{stats.avg}</strong>
											</span>
										</td>
										<td colSpan={isEkskulMode ? 2 : 1} className='p-2.5 sm:p-4 text-center text-xs'>
											{isEkskulMode ? (
												<div className='inline-flex flex-wrap items-center justify-center gap-1.5 font-bold'>
													<span className='px-2 py-0.5 rounded border border-emerald-600 bg-emerald-100 text-emerald-900'>
														A: {stats.countA || 0}
													</span>
													<span className='px-2 py-0.5 rounded border border-yellow-600 bg-yellow-100 text-yellow-900'>
														B: {stats.countB || 0}
													</span>
													<span className='px-2 py-0.5 rounded border border-orange-600 bg-orange-100 text-orange-900'>
														C: {stats.countC || 0}
													</span>
													{stats.countD > 0 && (
														<span className='px-2 py-0.5 rounded border border-rose-600 bg-rose-100 text-rose-900'>
															D: {stats.countD}
														</span>
													)}
												</div>
											) : (
												<div className='inline-flex flex-wrap items-center justify-center gap-1.5 font-bold'>
													<span className='px-2 py-0.5 rounded border border-emerald-600 bg-emerald-100 text-emerald-900'>
														{stats.tuntas} Tuntas ({stats.pctTuntas}%)
													</span>
													{stats.belumTuntas > 0 && (
														<span className='px-2 py-0.5 rounded border border-rose-600 bg-rose-100 text-rose-900'>
															{stats.belumTuntas} Belum Tuntas
														</span>
													)}
												</div>
											)}
										</td>
									</tr>
								</tfoot>
							)}
						</table>
					</div>
				)}
			</div>
				</>
			)}
		</div>
	);
}
