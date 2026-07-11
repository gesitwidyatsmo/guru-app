'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Users, Shuffle, TrendingUp, Save, Loader2, GripVertical, Trash2 } from 'lucide-react';
import Loader from '@/app/components/loading';
import DragDropBoard from '@/app/components/DragDropBoard';
import ButtonBack from '@/app/components/button/ButtonBack';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

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
	const [loadingPage, setLoadingPage] = useState(false);

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

				setKelasList(dataKelas || []);
				setMapelList(mapelData || []);
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
					Swal.fire('Informasi', `Tidak ada siswa aktif di kelas ${form.kelas}`, 'info');
				}
			} catch (err) {
				Swal.fire('Gagal', err.message, 'error');
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
			Swal.fire('Maaf', 'Tidak ada siswa untuk dibagi ke dalam grup', 'warning');
			return;
		}

		const shuffled = fisherYatesShuffle(siswaList); // unbiased shuffle [web:38]

		const k = form.jumlahGrup;
		const groups = Array.from({ length: k }, (_, i) => ({
			id: `grup-${i + 1}`,
			nama: `Grup ${i + 1}`,
			members: [],
		}));

		// Offset acak agar grup yang dapat anggota ekstra juga acak
		const startOffset = Math.floor(Math.random() * k);

		shuffled.forEach((s, idx) => {
			const groupIdx = (startOffset + idx) % k; // floor-mod style distribution [web:26]
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
			Swal.fire('Maaf', 'Tidak ada siswa untuk dibagi ke dalam grup', 'warning');
			return;
		}

		// Bila all, validasinya countNilai. Bila spesifik, validasinya adalah map nilai spesifik ada isinya
		let totalRekamNilai = 0;
		if (form.tugasSumber === 'all') {
			totalRekamNilai = siswaList.reduce((acc, s) => acc + (s.countNilai || 0), 0);
		} else if (form.tugasSumber !== 'poin_aktif') {
			totalRekamNilai = siswaList.reduce((acc, s) => acc + (s.nilai && typeof s.nilai[form.tugasSumber] !== 'undefined' ? 1 : 0), 0);
		}

		if (form.tugasSumber !== 'poin_aktif' && totalRekamNilai === 0) {
			const labelTugas = form.tugasSumber === 'all' ? 'belum ada nilai rute manapun' : 'belum ada satupun yang dinilai pada tugas ini';
			Swal.fire('Tidak Dapat Diproses', `Tidak dapat membuat grup metode heterogen. Siswa ${labelTugas} di database.`, 'error');
			return;
		}

		let adaYgNol = false;
		if (form.tugasSumber === 'all') {
			adaYgNol = siswaList.some((s) => (s.countNilai || 0) < tugasList.length);
		} else if (form.tugasSumber !== 'poin_aktif') {
			adaYgNol = siswaList.some((s) => !(s.nilai && typeof s.nilai[form.tugasSumber] !== 'undefined'));
		}

		if (adaYgNol) {
			const result = await Swal.fire({
				title: 'Peringatan Data Kosong',
				text:
					form.tugasSumber === 'all'
						? 'Beberapa siswa tidak memiliki kerekaman nilai secara lengkap pada seluruh tugas di kelas ini. Kekosongan akan dianggap 0 dan memotong rata-rata akhirnya. Lanjutkan?'
						: 'Beberapa siswa belum memiliki rekam nilai untuk tugas kriteria ini. Mereka akan dianggap bernilai 0. Lanjutkan?',
				icon: 'warning',
				showCancelButton: true,
				confirmButtonColor: '#3085d6',
				cancelButtonColor: '#d33',
				confirmButtonText: 'Ya, lanjutkan',
			});
			if (!result.isConfirmed) return;
		}

		// Kalkulator khusus "Semua Nilai" agar membagi berdasar total TugasList, bukan countNilainya si anak
		const getScoreAvg = (siswa) => {
			if (form.tugasSumber === 'poin_aktif') return siswa.netPoin || 0;
			if (form.tugasSumber !== 'all') {
				return siswa.nilai?.[form.tugasSumber] || 0;
			}
			if (tugasList.length === 0) return 0;

			// Akumulasi total nilai mutlak
			const totalMutlak = Object.values(siswa.nilai || {}).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
			return totalMutlak / tugasList.length;
		};

		// Urutkan nilai tertinggi ke terendah (Descending)
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

		// Distribusi Snake-Draft (Melanggar arah di setiap repetisi untuk keseimbangan)
		// e.g., 1-2-3-4 -> 4-3-2-1 -> 1-2-3-4
		let arahMaju = true;

		// Bagi ke dalam 'ronde' putaran
		for (let i = 0; i < sorted.length; i += form.jumlahGrup) {
			const batch = sorted.slice(i, i + form.jumlahGrup);

			if (arahMaju) {
				// Isi normal (K1, K2, K3, K4)
				batch.forEach((siswa, idx) => {
					groups[idx].members.push({
						id: siswa.id,
						nama: siswa.nama_lengkap,
						nis: siswa.nis,
						avg: getScoreAvg(siswa),
					});
				});
			} else {
				// Isi terbalik (K4, K3, K2, K1)
				batch.forEach((siswa, idx) => {
					// Balik indeks berdasarkan sisa ukuran batch (Bisa saja batch sisa kurang dari jumlahGrup)
					const reverseIdx = form.jumlahGrup - 1 - idx;
					// Pastikan indeks tidak undefined jika batch melompati struktur
					if (groups[reverseIdx]) {
						groups[reverseIdx].members.push({
							id: siswa.id,
							nama: siswa.nama_lengkap,
							nis: siswa.nis,
							avg: getScoreAvg(siswa),
						});
					} else {
						// Fallback aman
						groups[idx].members.push({
							id: siswa.id,
							nama: siswa.nama_lengkap,
							nis: siswa.nis,
							avg: getScoreAvg(siswa),
						});
					}
				});
			}

			// Ganti arah putaran untuk ronde berikutnya
			arahMaju = !arahMaju;
		}

		setGeneratedGroups(groups);
		setShowBoard(true);
	};

	const handleGenerate = async () => {
		if (!form.judul || !form.kelas) {
			Swal.fire('Ops!', 'Mohon lengkapi perihal judul aktivitas beserta kelas yang dituju.', 'warning');
			return;
		}
		setLoading(true);

		try {
			if (!siswaList.length) {
				Swal.fire('Maaf', `Tidak ada siswa di database yang terdaftar untuk kelas "${form.kelas}".`, 'error');
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
			<div className='max-w-6xl mx-auto'>
				<ButtonBack />
				<div className='bg-white rounded-2xl shadow-sm border border-slate-200/70 p-1 h-full  overflow-hidden'>
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
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-slate-50'>
			<div className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8'>
				<ButtonBack />
				<div className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
					{/* Header */}
					<div className='border-b border-slate-200 bg-white px-5 py-4 sm:px-6'>
						<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
							<div>
								<h1 className='text-xl font-semibold text-slate-900 sm:text-2xl'>Buat Grup Belajar Baru</h1>
								<p className='mt-1 text-sm text-slate-500'>Isi detail kegiatan, lalu generate grup dan atur anggota di papan drag & drop.</p>
							</div>

							{/* Info kecil di kanan (opsional UI) */}
							{form.kelas ? (
								<div className='inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 sm:self-auto'>
									<span className='h-2 w-2 rounded-full bg-emerald-500' />
									{loading ? 'Memuat siswa...' : `${siswaList.length} siswa aktif`}
								</div>
							) : (
								<div className='inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 sm:self-auto'>Pilih kelas untuk memuat siswa</div>
							)}
						</div>
					</div>

					{/* Body */}
					<div className='px-5 py-5 sm:px-6'>
						{/* Style base (UI only) */}
						{/*
            Catatan: ini bukan perubahan logika; hanya helper string untuk className.
          */}
						{(() => {
							const inputClass =
								'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 ' +
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:border-blue-600';

							const selectClass =
								'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm ' +
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:border-blue-600';

							const hintClass = 'mt-2 text-xs text-slate-500';

							return (
								<div className='space-y-6'>
									{/* Grid form */}
									<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
										{/* Judul */}
										<div className='md:col-span-2'>
											<label
												htmlFor='judul'
												className='text-sm font-medium text-slate-800'>
												Judul Kegiatan
											</label>
											<input
												id='judul'
												type='text'
												value={form.judul}
												onChange={(e) => setForm({ ...form, judul: e.target.value })}
												placeholder='Contoh: Diskusi Bab 3'
												className={inputClass}
											/>
											<p className={hintClass}>Judul akan tampil di papan grup sebagai nama aktivitas.</p>
										</div>

										{/* Kelas */}
										<div>
											<label
												htmlFor='kelas'
												className='text-sm font-medium text-slate-800'>
												Kelas
											</label>
											<select
												id='kelas'
												value={form.kelas}
												onChange={(e) => setForm({ ...form, kelas: e.target.value })}
												className={selectClass}>
												<option value=''>-- Pilih Kelas --</option>
												{kelasList.map((k) => (
													<option
														key={k.id}
														value={k.kelas}>
														{k.kelas}
													</option>
												))}
											</select>

											{loading && <p className={hintClass}>Memuat data siswa...</p>}
											{!loading && form.kelas && <p className={hintClass}>{siswaList.length} siswa aktif ditemukan</p>}
										</div>

										{/* Mapel */}
										<div>
											<label
												htmlFor='mapel'
												className='text-sm font-medium text-slate-800'>
												Mata Pelajaran <span className='font-normal text-slate-500'>(opsional)</span>
											</label>
											<select
												id='mapel'
												value={form.mapel}
												onChange={(e) => setForm({ ...form, mapel: e.target.value })}
												className={selectClass}>
												<option value=''>-- Pilih Mapel --</option>
												{mapelList.map((m) => (
													<option
														key={m.id}
														value={m.mapel}>
														{m.mapel}
													</option>
												))}
											</select>
											<p className={hintClass}>Kosongkan jika grup tidak terikat mapel tertentu.</p>
										</div>

										{/* Metode */}
										<div className='md:col-span-2'>
											<p className='text-sm font-medium text-slate-800'>Metode Pembagian</p>

											<div className='mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2'>
												{/* Random */}
												<label className='group relative flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300'>
													<input
														type='radio'
														name='metode'
														value='random'
														checked={form.metode === 'random'}
														onChange={(e) => setForm({ ...form, metode: e.target.value })}
														className='mt-1 h-4 w-4 accent-blue-600'
													/>
													<div className='min-w-0 flex-1'>
														<div className='flex items-center gap-2'>
															<Shuffle className='h-5 w-5 text-blue-600' />
															<p className='text-sm font-semibold text-slate-900'>Acak</p>
														</div>
														<p className='mt-1 text-sm text-slate-500'>Pembagian otomatis secara random dan merata.</p>
													</div>
												</label>

												{/* Heterogen */}
												<div
													className={`rounded-2xl border bg-white shadow-sm transition ${form.metode === 'heterogen' ? 'border-emerald-500 ring-1 ring-emerald-500 rounded-b-none border-b-0' : 'border-slate-200 hover:border-slate-300'}`}>
													<label className='group relative flex cursor-pointer gap-3 p-4'>
														<input
															type='radio'
															name='metode'
															value='heterogen'
															checked={form.metode === 'heterogen'}
															onChange={(e) => setForm({ ...form, metode: e.target.value })}
															className='mt-1 h-4 w-4 accent-emerald-600'
														/>
														<div className='min-w-0 flex-1'>
															<div className='flex items-center gap-2'>
																<TrendingUp className='h-5 w-5 text-emerald-600' />
																<p className='text-sm font-semibold text-slate-900'>Heterogen (berdasarkan nilai)</p>
															</div>
															<p className='mt-1 text-sm text-slate-500'>Distribusi merata menyeimbangkan skor kelompok.</p>
														</div>
													</label>

													{form.metode === 'heterogen' && (
														<div className='px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200'>
															<hr className='border-slate-100 mb-3' />
															<label
																htmlFor='tugasSumber'
																className='block text-xs font-medium text-slate-500 mb-1'>
																Pilih Dasar Perhitungan Nilai:
															</label>
															<select
																id='tugasSumber'
																value={form.tugasSumber}
																onChange={(e) => setForm({ ...form, tugasSumber: e.target.value })}
																className='w-full text-sm rounded-lg border border-slate-200 bg-emerald-50/50 px-3 py-2 text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'>
																<option value='all'>⭐ Semua Nilai (Rata-rata)</option>
																<option value='poin_aktif'>🎭 Keaktifan Karakter (Net Poin)</option>
																{tugasList.length > 0 && (
																	<optgroup label='Berdasarkan Tugas Kelompok/Individu:'>
																		{tugasList.map((t) => (
																			<option
																				key={t.tugas_id}
																				value={t.tugas_id}>
																				{t.kategori} - {t.tanggal} (Mapel: {t.mapel})
																			</option>
																		))}
																	</optgroup>
																)}
															</select>
															{tugasList.length === 0 && form.kelas && !loading && <p className='text-[10px] text-amber-600 mt-1 italic'>Belum ada satupun riwayat nilai di kelas terkait.</p>}
														</div>
													)}
												</div>
											</div>
										</div>

										{/* Jumlah grup */}
										<div className='md:col-span-2'>
											<label
												htmlFor='jumlahGrup'
												className='text-sm font-medium text-slate-800'>
												Jumlah Grup
											</label>
											<div className='mt-1 flex flex-col gap-3 sm:flex-row sm:items-center'>
												<select
													id='jumlahGrup'
													value={form.jumlahGrup}
													onChange={(e) => setForm({ ...form, jumlahGrup: parseInt(e.target.value) })}
													className={`${selectClass} sm:max-w-xs`}>
													{Array.from({ length: 14 }, (_, i) => i + 2).map((num) => (
														<option
															key={num}
															value={num}>
															{num} Kelompok
														</option>
													))}
												</select>

												<div className='flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'>
													Sistem akan membagi siswa ke dalam <span className='font-semibold'>{form.jumlahGrup}</span> kelompok secara merata.
												</div>
											</div>
										</div>
									</div>

									{/* Action bar */}
									<div className='flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end'>
										<button
											onClick={() => router.back()}
											className='inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto'>
											<ChevronLeft className='mr-2 h-5 w-5' />
											Batal
										</button>

										<button
											onClick={handleGenerate}
											disabled={loading || !form.kelas || !form.judul}
											className='inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto'>
											{loading ? (
												<>
													<Loader2 className='mr-2 h-5 w-5 animate-spin' />
													Memproses...
												</>
											) : (
												<>
													Generate Grup
													<ChevronRight className='ml-2 h-5 w-5' />
												</>
											)}
										</button>
									</div>
								</div>
							);
						})()}
					</div>
				</div>
			</div>
		</div>
	);
}
