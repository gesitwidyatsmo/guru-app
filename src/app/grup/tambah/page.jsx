'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Users, Shuffle, TrendingUp, Save, Loader2, GripVertical, Trash2 } from 'lucide-react';
import Loader from '@/app/components/loading';
import DragDropBoard from '@/app/components/DragDropBoard';
import ButtonBack from '@/app/components/button/ButtonBack';

export default function CreateGroupPage() {
	const router = useRouter();

	// State Form
	const [form, setForm] = useState({
		judul: '',
		kelas: '',
		mapel: '',
		metode: 'random',
		jumlahGrup: 4,
	});

	// State Data
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [loading, setLoading] = useState(false);
	const [loadingPage, setLoadingPage] = useState(false);

	// State UI
	const [showBoard, setShowBoard] = useState(false);
	const [generatedGroups, setGeneratedGroups] = useState([]);

	// Fetch Data Kelas
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const res = await fetch('/api/kelas');
				const resMapel = await fetch('/api/mapel');
				if (!res.ok || !resMapel.ok) throw new Error('Gagal mengambil data kelas');

				const data = await res.json();
				const mapelData = await resMapel.json();

				setKelasList(data);
				setMapelList(mapelData);
				console.log(mapelList);
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
				const url = `/api/siswa?kelas=${encodeURIComponent(form.kelas)}&status=Aktif`;
				console.log('Fetching siswa from:', url);

				const res = await fetch(url);

				if (!res.ok) {
					const errorData = await res.json();
					throw new Error(errorData.error || 'Gagal mengambil data siswa');
				}

				const data = await res.json();

				if (!Array.isArray(data)) {
					throw new Error('Format data siswa tidak valid');
				}

				setSiswaList(data);

				if (data.length === 0) {
					alert(`⚠️ Tidak ada siswa aktif di kelas ${form.kelas}`);
				}
			} catch (err) {
				alert('❌ ' + err.message);
				setSiswaList([]);
			} finally {
				setLoading(false);
			}
		};

		fetchSiswa();
	}, [form.kelas]);

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
			alert('⚠️ Tidak ada siswa untuk dibagi ke dalam grup');
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

	const generateHeterogenGroups = () => {
		if (siswaList.length === 0) {
			alert('⚠️ Tidak ada siswa untuk dibagi ke dalam grup');
			return;
		}

		const sorted = [...siswaList].sort((a, b) => (b.nilai || 0) - (a.nilai || 0));

		const groups = Array.from({ length: form.jumlahGrup }, (_, i) => ({
			id: `grup-${i + 1}`,
			nama: `Grup ${i + 1}`,
			members: [],
		}));

		// Distribusi zig-zag (tinggi-rendah merata)
		sorted.forEach((siswa, idx) => {
			const groupIdx = idx % form.jumlahGrup;
			groups[groupIdx].members.push({
				id: siswa.id,
				nama: siswa.nama_lengkap,
				nis: siswa.nis,
				nilai: siswa.nilai || null,
			});
		});

		setGeneratedGroups(groups);
		setShowBoard(true);
	};

	const handleGenerate = async () => {
		if (!form.judul || !form.kelas) return alert('Mohon lengkapi judul dan kelas');
		setLoading(true);

		try {
			const url = `/api/siswa?kelas=${encodeURIComponent(form.kelas)}`;
			const res = await fetch(url);
			const allSiswa = await res.json();

			if (!allSiswa.length) {
				alert(`Tidak ada siswa ditemukan untuk kelas "${form.kelas}". Periksa nama kelas di database.`);
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
													<div className='min-w-0'>
														<div className='flex items-center gap-2'>
															<Shuffle className='h-5 w-5 text-blue-600' />
															<p className='text-sm font-semibold text-slate-900'>Acak</p>
														</div>
														<p className='mt-1 text-sm text-slate-500'>Pembagian otomatis secara random dan merata.</p>
													</div>
												</label>

												{/* Heterogen */}
												<label className='group relative flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300'>
													<input
														disabled
														type='radio'
														name='metode'
														value='heterogen'
														checked={form.metode === 'heterogen'}
														onChange={(e) => setForm({ ...form, metode: e.target.value })}
														className='mt-1 h-4 w-4 accent-emerald-600'
													/>
													<div className='min-w-0'>
														<div className='flex items-center gap-2'>
															<TrendingUp className='h-5 w-5 text-emerald-600' />
															<p className='text-sm font-semibold text-slate-900'>Heterogen (berdasarkan nilai)</p>
														</div>
														<p className='mt-1 text-sm text-slate-500'>Distribusi merata berdasarkan nilai (jika tersedia).</p>
													</div>
												</label>
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
