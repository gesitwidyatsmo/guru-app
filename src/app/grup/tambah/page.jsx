'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Shuffle, TrendingUp, Loader2, GripVertical } from 'lucide-react';
import Loader from '@/app/components/loading';
import DragDropBoard from '@/app/components/DragDropBoard';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

// Neobrutalism SweetAlert Mixin
const brutalSwal = Swal.mixin({
	customClass: {
		popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
		title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
		htmlContainer: 'font-bold text-[#0D0D0D]',
		confirmButton: 'bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
		cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
	},
	buttonsStyling: false
});

export default function CreateGroupPage() {
	const router = useRouter();

	// State Form
	const [form, setForm] = useState({
		judul: '',
		kelas: '',
		mapel: '',
		metode: 'random',
		tugasSumber: 'all',
		jumlahGrup: 4,
	});

	// State Data
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [tugasList, setTugasList] = useState([]);
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(true);

	// State UI
	const [showBoard, setShowBoard] = useState(false);
	const [generatedGroups, setGeneratedGroups] = useState([]);

	// Fetch Data Kelas
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const supabase = createClient();
				const [{ data: dataKelas }, { data: mapelData }] = await Promise.all([
					supabase.from('kelas').select('*'),
					supabase.from('mapel').select('*')
				]);

				const sortedKelas = (dataKelas || []).sort((a, b) => {
					const nameA = a.nama_kelas || a.kelas || '';
					const nameB = b.nama_kelas || b.kelas || '';
					return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
				});

				const sortedMapel = (mapelData || []).sort((a, b) => {
					const nameA = a.nama_mapel || a.mapel || '';
					const nameB = b.nama_mapel || b.mapel || '';
					return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
				});

				setKelasList(sortedKelas);
				setMapelList(sortedMapel);
			} catch (err) {
				console.error('Error fetching kelas:', err);
			} finally {
				setLoadingPage(false);
			}
		};
		fetchAll();
	}, []);

	useEffect(() => {
		if (!form.kelas) {
			setSiswaList([]);
			return;
		}

		const fetchSiswa = async () => {
			setLoading(true);
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				const { data: userData } = await supabase.from('users').select('id_user, role').eq('auth_id', user?.id).single();
				const userId = userData?.id_user;
				const role = userData?.role;

				// Fetch siswa
				const { data: siswaDataRaw } = await supabase.from('siswa').select('id, nis, nama_lengkap, status, kelas').eq('kelas', form.kelas).eq('status', 'Aktif');
				let siswaData = siswaDataRaw || [];

				// Fetch poin aktif
				const { data: poinData } = await supabase.from('poin_siswa').select('siswa_id, tipe, poin').eq('kelas', form.kelas);
				const poinMap = {};
				(poinData || []).forEach(p => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = 0;
					if (p.tipe === 'positif') poinMap[p.siswa_id] += p.poin || 0;
					if (p.tipe === 'negatif') poinMap[p.siswa_id] -= p.poin || 0;
				});

				// Fetch tugas (to get the list of assignments)
				let tugasQuery = supabase.from('nilai_tugas').select('tugas_id, kategori, tanggal, mapel').eq('kelas', form.kelas);
				if (form.mapel) tugasQuery = tugasQuery.eq('mapel', form.mapel);
				if (role === 'Guru' && userId) tugasQuery = tugasQuery.eq('guru_id', userId);
				const { data: tugasData } = await tugasQuery;
				const tugasList = tugasData || [];

				// Fetch nilai
				const tugasIds = tugasList.map(t => t.tugas_id);
				let nilaiMap = {};
				let countNilaiMap = {};
				if (tugasIds.length > 0) {
					const { data: allNilai } = await supabase.from('nilai_siswa').select('siswa_id, tugas_id, nilai').in('tugas_id', tugasIds);
					if (allNilai) {
						allNilai.forEach(n => {
							if (!nilaiMap[n.siswa_id]) nilaiMap[n.siswa_id] = {};
							nilaiMap[n.siswa_id][n.tugas_id] = parseFloat(n.nilai) || 0;

							if (!countNilaiMap[n.siswa_id]) countNilaiMap[n.siswa_id] = 0;
							countNilaiMap[n.siswa_id]++;
						});
					}
				}

				const siswaDataUpdated = siswaData.map(s => {
					let total = 0;
					let avg = 0;
					const nMap = nilaiMap[s.id] || {};
					const cCount = countNilaiMap[s.id] || 0;
					if (tugasList.length > 0) {
						total = Object.values(nMap).reduce((sum, val) => sum + val, 0);
						avg = total / tugasList.length; // as per getScoreAvg logic
					}

					return {
						...s,
						netPoin: poinMap[s.id] || 0,
						nilai: nMap,
						countNilai: cCount,
						avg: avg
					};
				});

				setSiswaList(siswaDataUpdated);
				setTugasList(tugasList);

				if (siswaDataUpdated.length === 0) {
					brutalSwal.fire({
						title: 'INFORMASI',
						text: `TIDAK ADA SISWA AKTIF DI KELAS ${form.kelas}`,
						icon: 'info'
					});
				}
			} catch (err) {
				brutalSwal.fire({
					title: 'GAGAL',
					text: err.message,
					icon: 'error'
				});
				setSiswaList([]);
				setTugasList([]);
			} finally {
				setLoading(false);
			}
		};

		fetchSiswa();
	}, [form.kelas, form.mapel]);

	const fisherYatesShuffle = (arr) => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};

	const generateRandomGroups = () => {
		if (siswaList.length === 0) {
			brutalSwal.fire({
				title: 'MAAF',
				text: 'TIDAK ADA SISWA UNTUK DIBAGI',
				icon: 'warning'
			});
			return;
		}

		const shuffled = fisherYatesShuffle(siswaList);

		const k = form.jumlahGrup;
		const groups = Array.from({ length: k }, (_, i) => ({
			id: `grup-${i + 1}`,
			nama: `Grup ${i + 1}`,
			members: [],
		}));

		const startOffset = Math.floor(Math.random() * k);

		shuffled.forEach((s, idx) => {
			const groupIdx = (startOffset + idx) % k;
			groups[groupIdx].members.push({
				id: s.id,
				nama: s.nama_lengkap,
				nis: s.nis,
			});
		});

		setGeneratedGroups(groups);
		setShowBoard(true);
	};

	const generateHeterogenGroups = async () => {
		if (siswaList.length === 0) {
			brutalSwal.fire({
				title: 'MAAF',
				text: 'TIDAK ADA SISWA UNTUK DIBAGI',
				icon: 'warning'
			});
			return;
		}

		let totalRekamNilai = 0;
		if (form.tugasSumber === 'all') {
			totalRekamNilai = siswaList.reduce((acc, s) => acc + (s.countNilai || 0), 0);
		} else if (form.tugasSumber !== 'poin_aktif') {
			totalRekamNilai = siswaList.reduce((acc, s) => acc + (s.nilai && typeof s.nilai[form.tugasSumber] !== 'undefined' ? 1 : 0), 0);
		}

		if (form.tugasSumber !== 'poin_aktif' && totalRekamNilai === 0) {
			const labelTugas = form.tugasSumber === 'all' ? 'belum ada nilai rute manapun' : 'belum ada satupun yang dinilai pada tugas ini';
			brutalSwal.fire({
				title: 'TIDAK DAPAT DIPROSES',
				text: `Tidak dapat membuat grup metode heterogen. Siswa ${labelTugas} di database.`,
				icon: 'error'
			});
			return;
		}

		let adaYgNol = false;
		if (form.tugasSumber === 'all') {
			adaYgNol = siswaList.some((s) => (s.countNilai || 0) < tugasList.length);
		} else if (form.tugasSumber !== 'poin_aktif') {
			adaYgNol = siswaList.some((s) => !(s.nilai && typeof s.nilai[form.tugasSumber] !== 'undefined'));
		}

		if (adaYgNol) {
			const result = await brutalSwal.fire({
				title: 'PERINGATAN DATA KOSONG',
				text: form.tugasSumber === 'all'
						? 'Beberapa siswa tidak memiliki kerekaman nilai secara lengkap pada seluruh tugas di kelas ini. Kekosongan akan dianggap 0 dan memotong rata-rata akhirnya. Lanjutkan?'
						: 'Beberapa siswa belum memiliki rekam nilai untuk tugas kriteria ini. Mereka akan dianggap bernilai 0. Lanjutkan?',
				icon: 'warning',
				showCancelButton: true,
				confirmButtonText: 'YA, LANJUTKAN',
				cancelButtonText: 'BATAL',
				customClass: {
					...brutalSwal.options.customClass,
					confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
				}
			});
			if (!result.isConfirmed) return;
		}

		const getScoreAvg = (siswa) => {
			if (form.tugasSumber === 'poin_aktif') return siswa.netPoin || 0;
			if (form.tugasSumber !== 'all') {
				return siswa.nilai?.[form.tugasSumber] || 0;
			}
			if (tugasList.length === 0) return 0;

			const totalMutlak = Object.values(siswa.nilai || {}).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
			return totalMutlak / tugasList.length;
		};

		const sorted = [...siswaList].sort((a, b) => {
			const scoreA = getScoreAvg(a);
			const scoreB = getScoreAvg(b);
			return scoreB - scoreA;
		});

		const groups = Array.from({ length: form.jumlahGrup }, (_, i) => ({
			id: `grup-${i + 1}`,
			nama: `Grup ${i + 1}`,
			members: [],
		}));

		let arahMaju = true;

		for (let i = 0; i < sorted.length; i += form.jumlahGrup) {
			const batch = sorted.slice(i, i + form.jumlahGrup);

			if (arahMaju) {
				batch.forEach((siswa, idx) => {
					groups[idx].members.push({
						id: siswa.id,
						nama: siswa.nama_lengkap,
						nis: siswa.nis,
						avg: getScoreAvg(siswa),
					});
				});
			} else {
				batch.forEach((siswa, idx) => {
					const reverseIdx = form.jumlahGrup - 1 - idx;
					if (groups[reverseIdx]) {
						groups[reverseIdx].members.push({
							id: siswa.id,
							nama: siswa.nama_lengkap,
							nis: siswa.nis,
							avg: getScoreAvg(siswa),
						});
					} else {
						groups[idx].members.push({
							id: siswa.id,
							nama: siswa.nama_lengkap,
							nis: siswa.nis,
							avg: getScoreAvg(siswa),
						});
					}
				});
			}
			arahMaju = !arahMaju;
		}

		setGeneratedGroups(groups);
		setShowBoard(true);
	};

	const handleGenerate = async () => {
		if (!form.judul || !form.kelas) {
			brutalSwal.fire({
				title: 'OPS!',
				text: 'MOHON LENGKAPI JUDUL DAN KELAS',
				icon: 'warning'
			});
			return;
		}
		setLoading(true);

		try {
			if (!siswaList.length) {
				brutalSwal.fire({
					title: 'MAAF',
					text: `TIDAK ADA SISWA DI DATABASE UNTUK KELAS ${form.kelas}`,
					icon: 'error'
				});
				setLoading(false);
				return;
			}

			if (form.metode === 'random') {
				generateRandomGroups();
			} else {
				generateHeterogenGroups();
			}
		} catch (err) {
			console.log('Error: ' + err.message);
		} finally {
			setLoading(false);
		}
	};

	if (showBoard) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
				<div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
					<DragDropBoard
						initialGroups={generatedGroups}
						metaData={form}
						onBack={() => setShowBoard(false)}
					/>
				</div>
			</div>
		);
	}

	if (loadingPage) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-2 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>BUAT GRUP BARU</h1>
					</div>
				</div>

				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none overflow-hidden relative'>
					
					{/* Header Papan Form */}
					<div className='border-b-[4px] border-[#0D0D0D] bg-[#2F80ED] p-6 relative overflow-hidden'>
						{/* Deco */}
						<div className='absolute -right-10 -bottom-10 w-32 h-32 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rotate-45 z-0'></div>

						<div className='relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
							<div>
								<h1 className='text-xl font-black text-white uppercase tracking-widest'>DATA KEGIATAN & METODE</h1>
								<p className='mt-1 text-sm font-bold text-white bg-[#0D0D0D] px-2 py-1 inline-block uppercase tracking-widest'>ISI DETAIL, GENERATE, DAN ATUR DI PAPAN DRAG & DROP.</p>
							</div>

							{form.kelas ? (
								<div className='inline-flex items-center self-start border-[3px] border-[#0D0D0D] bg-[#A3E635] px-4 py-2 font-black uppercase tracking-widest text-[#0D0D0D] sm:self-auto shadow-[4px_4px_0px_0px_#0D0D0D]'>
									{loading ? 'MEMUAT...' : `${siswaList.length} SISWA AKTIF`}
								</div>
							) : (
								<div className='inline-flex items-center self-start border-[3px] border-[#0D0D0D] bg-white px-4 py-2 font-black uppercase tracking-widest text-[#0D0D0D] sm:self-auto shadow-[4px_4px_0px_0px_#0D0D0D]'>PILIH KELAS DULU</div>
							)}
						</div>
					</div>

					{/* Body Form */}
					<div className='p-6 md:p-8 relative z-10'>
						<div className='space-y-8'>
							
							<div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
								{/* Judul */}
								<div className='md:col-span-2'>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										JUDUL KEGIATAN <span className='text-[#E8451A]'>*</span>
									</label>
									<input
										type='text'
										value={form.judul}
										onChange={(e) => setForm({ ...form, judul: e.target.value })}
										placeholder='CONTOH: DISKUSI BAB 3'
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all placeholder:text-gray-400'
									/>
									<p className='mt-2 text-[10px] font-bold text-[#0D0D0D] bg-[#F5C518] px-2 py-1 inline-block uppercase tracking-widest border-[2px] border-[#0D0D0D]'>Judul akan tampil di papan grup.</p>
								</div>

								{/* Kelas */}
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										KELAS <span className='text-[#E8451A]'>*</span>
									</label>
									<select
										value={form.kelas}
										onChange={(e) => setForm({ ...form, kelas: e.target.value })}
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all appearance-none cursor-pointer'>
										<option value='' disabled>-- PILIH KELAS --</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.nama_kelas || k.kelas}>{k.nama_kelas || k.kelas}</option>
										))}
									</select>
								</div>

								{/* Mapel */}
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										MATA PELAJARAN (OPSIONAL)
									</label>
									<select
										value={form.mapel}
										onChange={(e) => setForm({ ...form, mapel: e.target.value })}
										className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all appearance-none cursor-pointer'>
										<option value=''>-- SEMUA MAPEL --</option>
										{mapelList.map((m) => (
											<option key={m.id} value={m.nama_mapel || m.mapel}>{m.nama_mapel || m.mapel}</option>
										))}
									</select>
								</div>

								{/* Metode */}
								<div className='md:col-span-2 pt-4 border-t-[4px] border-[#0D0D0D]'>
									<p className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest mb-4'>METODE PEMBAGIAN</p>

									<div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
										{/* Random */}
										<div
											onClick={() => setForm({ ...form, metode: 'random' })}
											className={`cursor-pointer border-[4px] border-[#0D0D0D] p-6 transition-all shadow-[8px_8px_0px_0px_#0D0D0D] ${form.metode === 'random' ? 'bg-[#F5C518] -translate-y-1 shadow-[10px_10px_0px_0px_#0D0D0D]' : 'bg-white hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#0D0D0D]'}`}>
											<div className='flex items-center gap-3 mb-2'>
												<div className={`p-2 border-[3px] border-[#0D0D0D] ${form.metode === 'random' ? 'bg-white' : 'bg-gray-100'}`}>
													<Shuffle className='h-6 w-6 text-[#0D0D0D]' strokeWidth={3} />
												</div>
												<h3 className='text-lg font-black text-[#0D0D0D] uppercase tracking-widest'>ACAK (RANDOM)</h3>
											</div>
											<p className='text-sm font-bold text-[#0D0D0D] uppercase tracking-widest'>Pembagian otomatis secara acak dan merata.</p>
										</div>

										{/* Heterogen */}
										<div
											onClick={() => setForm({ ...form, metode: 'heterogen' })}
											className={`cursor-pointer border-[4px] border-[#0D0D0D] p-6 transition-all shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col justify-between ${form.metode === 'heterogen' ? 'bg-[#FF90E8] -translate-y-1 shadow-[10px_10px_0px_0px_#0D0D0D]' : 'bg-white hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#0D0D0D]'}`}>
											<div>
												<div className='flex items-center gap-3 mb-2'>
													<div className={`p-2 border-[3px] border-[#0D0D0D] ${form.metode === 'heterogen' ? 'bg-white' : 'bg-gray-100'}`}>
														<TrendingUp className='h-6 w-6 text-[#0D0D0D]' strokeWidth={3} />
													</div>
													<h3 className='text-lg font-black text-[#0D0D0D] uppercase tracking-widest'>HETEROGEN</h3>
												</div>
												<p className='text-sm font-bold text-[#0D0D0D] uppercase tracking-widest'>Distribusi menyeimbangkan skor kelompok.</p>
											</div>

											{form.metode === 'heterogen' && (
												<div className='mt-6 pt-6 border-t-[4px] border-[#0D0D0D] animate-in fade-in zoom-in-95 duration-200'>
													<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>
														SUMBER NILAI:
													</label>
													<select
														value={form.tugasSumber}
														onChange={(e) => setForm({ ...form, tugasSumber: e.target.value })}
														className='w-full h-[50px] px-4 border-[3px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] appearance-none cursor-pointer text-sm focus:outline-none focus:-translate-y-1 transition-all'>
														<option value='all'>⭐ SEMUA NILAI (RATA-RATA)</option>
														<option value='poin_aktif'>🎭 KEAKTIFAN (NET POIN)</option>
														{tugasList.length > 0 && (
															<optgroup label='BERDASARKAN TUGAS SPESIFIK:'>
																{tugasList.map((t) => (
																	<option key={t.tugas_id} value={t.tugas_id}>
																		{t.kategori} - {t.tanggal}
																	</option>
																))}
															</optgroup>
														)}
													</select>
													{tugasList.length === 0 && form.kelas && !loading && (
														<p className='text-[10px] bg-white border-[2px] border-[#0D0D0D] px-2 py-1 text-[#0D0D0D] font-black uppercase tracking-widest mt-2 inline-block'>BELUM ADA RIWAYAT NILAI</p>
													)}
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Jumlah grup */}
								<div className='md:col-span-2 pt-4'>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>
										JUMLAH GRUP
									</label>
									<div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
										<select
											value={form.jumlahGrup}
											onChange={(e) => setForm({ ...form, jumlahGrup: parseInt(e.target.value) })}
											className='w-full sm:w-64 h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all appearance-none cursor-pointer'>
											{Array.from({ length: 14 }, (_, i) => i + 2).map((num) => (
												<option key={num} value={num}>
													{num} KELOMPOK
												</option>
											))}
										</select>

										<div className='flex-1 border-[4px] border-[#0D0D0D] bg-[#A3E635] px-6 py-4 text-sm font-black uppercase tracking-widest text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
											DIBAGI RATA MENJADI <span className='bg-white px-2 py-1 border-[2px] border-[#0D0D0D] mx-1 text-lg'>{form.jumlahGrup}</span> KELOMPOK
										</div>
									</div>
								</div>
							</div>

							{/* Action bar */}
							<div className='flex flex-col-reverse gap-4 border-t-[4px] border-[#0D0D0D] pt-8 sm:flex-row sm:justify-end mt-4'>
								<button
									onClick={() => router.back()}
									className='h-[60px] px-8 bg-white text-[#0D0D0D] border-[4px] border-[#0D0D0D] rounded-none font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all flex items-center justify-center gap-2'>
									BATAL
								</button>

								<button
									onClick={handleGenerate}
									disabled={loading || !form.kelas || !form.judul}
									className='h-[60px] px-8 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] rounded-none font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center gap-2'>
									{loading ? (
										<>
											<Loader2 className='h-6 w-6 animate-spin' />
											MEMPROSES...
										</>
									) : (
										<>
											GENERATE GRUP
											<ChevronRight className='h-6 w-6' strokeWidth={3} />
										</>
									)}
								</button>
							</div>

						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
