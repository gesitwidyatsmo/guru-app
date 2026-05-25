'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Save, Upload, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import Loader from '../../../components/loading';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const quillModules = {
	toolbar: [
		[{ 'header': [1, 2, false] }],
		['bold', 'italic', 'underline', 'strike'],
		[{'list': 'ordered'}, {'list': 'bullet'}],
		['clean']
	],
};

const quillFormats = [
	'header',
	'bold', 'italic', 'underline', 'strike',
	'list'
];

export default function EditTugas({ params }) {
	const router = useRouter();
	const unwrappedParams = use(params);
	const id = unwrappedParams.id;

	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const [form, setForm] = useState({
		id: id,
		judul: '',
		mapel: '',
		materi: '',
		tipe_soal: 'Tunggal',
	});

	const [soalTunggal, setSoalTunggal] = useState('');
	const [soalKasus, setSoalKasus] = useState([{ id: Date.now(), teks: '' }]);
	const [soalPG, setSoalPG] = useState([
		{ id: Date.now(), pertanyaan: '', opsi: ['', ''], jawabanBenar: [] }
	]);

	useEffect(() => {
		const fetchTask = async () => {
			try {
				const res = await fetch(`/api/tugas-online?id=${id}`);
				if (res.ok) {
					const data = await res.json();
					setForm({
						id: id,
						judul: data.judul,
						mapel: data.mapel,
						materi: data.materi,
						tipe_soal: data.tipe_soal,
					});

					let parsedSoal;
					try {
						parsedSoal = JSON.parse(data.soal);
					} catch (e) {
						parsedSoal = data.soal;
					}

					if (data.tipe_soal === 'Tunggal') {
						setSoalTunggal(parsedSoal);
					} else if (data.tipe_soal === 'Kasus') {
						if (Array.isArray(parsedSoal)) {
							setSoalKasus(parsedSoal.map((teks) => ({ id: Math.random(), teks })));
						}
					} else if (data.tipe_soal === 'PG') {
						if (Array.isArray(parsedSoal)) {
							setSoalPG(parsedSoal.map(p => ({ 
								...p, 
								id: Math.random(),
								jawabanBenar: Array.isArray(p.jawabanBenar) ? p.jawabanBenar : (p.jawabanBenar !== undefined && p.jawabanBenar !== null ? [p.jawabanBenar] : [])
							})));
						}
					}
				} else {
					Swal.fire('Error', 'Tugas tidak ditemukan', 'error');
					router.push('/tugas');
				}
			} catch (error) {
				console.error(error);
				Swal.fire('Error', 'Gagal memuat tugas', 'error');
			} finally {
				setLoading(false);
			}
		};

		fetchTask();
	}, [id, router]);

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!form.judul || !form.mapel) {
			Swal.fire('Error', 'Judul dan Mata Pelajaran wajib diisi', 'error');
			return;
		}

		let soalPayload = null;
		if (form.tipe_soal === 'Tunggal') {
			if (!soalTunggal) return Swal.fire('Error', 'Teks soal belum diisi', 'error');
			soalPayload = soalTunggal;
		} else if (form.tipe_soal === 'Kasus') {
			const kasusIsi = soalKasus.filter((k) => k.teks.trim() !== '');
			if (kasusIsi.length === 0) return Swal.fire('Error', 'Minimal 1 kasus harus diisi', 'error');
			soalPayload = kasusIsi.map((k) => k.teks);
		} else if (form.tipe_soal === 'PG') {
			const cleanedPG = soalPG.map(s => {
				const currentJwbn = Array.isArray(s.jawabanBenar) ? s.jawabanBenar : (s.jawabanBenar !== null ? [s.jawabanBenar] : []);
				const newOpsi = [];
				const newJwbn = [];
				s.opsi.forEach((o, i) => {
					if (o.trim() !== '') {
						newOpsi.push(o.trim());
						if (currentJwbn.includes(i)) {
							newJwbn.push(newOpsi.length - 1);
						}
					}
				});
				return { ...s, opsi: newOpsi, jawabanBenar: newJwbn };
			});

			const invalid = cleanedPG.find(s => !s.pertanyaan.trim() || s.opsi.length < 2 || s.jawabanBenar.length === 0);
			if (invalid) return Swal.fire('Error', 'Pastikan setiap pertanyaan terisi, memiliki minimal 2 opsi (jawaban), dan tentukan kunci jawabannya!', 'error');
			
			soalPayload = cleanedPG;
		}

		setSubmitting(true);

		try {
			const res = await fetch('/api/tugas-online', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					soal: soalPayload,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				await Swal.fire({
					title: 'Berhasil!',
					text: 'Perubahan tugas telah disimpan.',
					icon: 'success',
					timer: 2000,
					showConfirmButton: false,
				});
				router.push('/tugas');
			} else {
				Swal.fire('Gagal', data.error || 'Terjadi kesalahan', 'error');
			}
		} catch (error) {
			Swal.fire('Error', 'Gagal terhubung ke server', 'error');
		} finally {
			setSubmitting(false);
		}
	};

	const tambahKasus = () => {
		setSoalKasus([...soalKasus, { id: Date.now(), teks: '' }]);
	};

	const hapusKasus = (id) => {
		if (soalKasus.length > 1) {
			setSoalKasus(soalKasus.filter((k) => k.id !== id));
		}
	};

	const updateKasus = (id, val) => {
		setSoalKasus(soalKasus.map((k) => (k.id === id ? { ...k, teks: val } : k)));
	};

	const tambahSoalPG = () => {
		setSoalPG([...soalPG, { id: Date.now(), pertanyaan: '', opsi: ['', ''], jawabanBenar: [] }]);
	};

	const hapusSoalPG = (id) => {
		if (soalPG.length > 1) {
			setSoalPG(soalPG.filter(s => s.id !== id));
		}
	};

	const tambahOpsiPG = (soalId) => {
		setSoalPG(soalPG.map(s => {
			if (s.id !== soalId) return s;
			return { ...s, opsi: [...s.opsi, ''] };
		}));
	};

	const updateSoalPG = (id, field, value, optIndex = null) => {
		setSoalPG(soalPG.map(s => {
			if (s.id !== id) return s;
			if (field === 'pertanyaan') return { ...s, pertanyaan: value };
			if (field === 'jawabanBenar') {
				const current = Array.isArray(s.jawabanBenar) ? s.jawabanBenar : (s.jawabanBenar !== null ? [s.jawabanBenar] : []);
				const newJawaban = current.includes(value) 
					? current.filter(x => x !== value) 
					: [...current, value];
				return { ...s, jawabanBenar: newJawaban };
			}
			if (field === 'opsi') {
				const newOpsi = [...s.opsi];
				newOpsi[optIndex] = value;
				return { ...s, opsi: newOpsi };
			}
			return s;
		}));
	};

	const fileInputRef = useRef(null);

	const handleFileUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		try {
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data);
			const sheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[sheetName];
			const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

			// Skip baris header (index 0)
			const rows = json.slice(1);
			const newSoalPG = [];

			rows.forEach(row => {
				if (!row || row.length === 0 || !row[0]) return; // Skip baris kosong

				const pertanyaan = row[0] ? String(row[0]) : '';
				
				const rawOpsi = [row[1], row[2], row[3], row[4], row[5]];
				const opsi = rawOpsi.map(o => o !== undefined && o !== null ? String(o).trim() : '').filter(o => o !== '');

				const rawKunci = row[6] ? String(row[6]) : '';
				const kunciArray = rawKunci.split(',').map(k => k.trim().toUpperCase());
				
				const jawabanBenar = [];
				kunciArray.forEach(k => {
					const idx = k.charCodeAt(0) - 65;
					if (idx >= 0 && idx < opsi.length) {
						jawabanBenar.push(idx);
					}
				});

				while (opsi.length < 2) {
					opsi.push('');
				}

				newSoalPG.push({
					id: Math.random(),
					pertanyaan,
					opsi,
					jawabanBenar
				});
			});

			if (newSoalPG.length > 0) {
				// Pada mode Edit, tanyakan apakah menimpa (replace) atau menambah (append)
				const result = await Swal.fire({
					title: 'Pilih Tindakan',
					text: `Ditemukan ${newSoalPG.length} soal di Excel. Anda ingin mengganti semua soal yang ada, atau menambahkannya ke bawah?`,
					icon: 'question',
					showCancelButton: true,
					showDenyButton: true,
					confirmButtonText: 'Ganti Semua',
					denyButtonText: 'Tambahkan Saja',
					cancelButtonText: 'Batal'
				});

				if (result.isConfirmed) {
					setSoalPG(newSoalPG);
					Swal.fire('Berhasil', 'Soal telah diganti seluruhnya dengan data dari Excel.', 'success');
				} else if (result.isDenied) {
					setSoalPG([...soalPG, ...newSoalPG]);
					Swal.fire('Berhasil', 'Soal dari Excel berhasil ditambahkan ke urutan bawah.', 'success');
				}
			} else {
				Swal.fire('Gagal', 'Tidak ada soal valid yang ditemukan dalam file.', 'error');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal membaca file Excel. Pastikan format sesuai template.', 'error');
		}
		
		e.target.value = '';
	};

	const downloadTemplate = () => {
		const ws = XLSX.utils.aoa_to_sheet([
			['Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci Jawaban (Gunakan koma jika > 1. Contoh: A, C)'],
			['Ibukota Indonesia adalah?', 'Jakarta', 'Nusantara', 'Bandung', 'Surabaya', '', 'B'],
			['Manakah yang merupakan bahasa pemrograman?', 'Python', 'HTML', 'JavaScript', 'CSS', '', 'A, C']
		]);
		ws['!cols'] = [{wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 50}];
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Template Soal PG");
		XLSX.writeFile(wb, "Template_Soal_PG.xlsx");
	};

	if (loading) return <Loader />;

	return (
		<main className='min-h-screen bg-gray-50 py-8'>
			<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='mb-8 flex items-center gap-4'>
					<Link
						href='/tugas'
						className='p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors'>
						<ChevronLeft className='w-6 h-6 text-gray-600' />
					</Link>
					<div>
						<h1 className='text-3xl font-bold text-gray-800'>Edit Tugas</h1>
						<p className='text-gray-500'>Perbarui informasi atau soal pada tugas yang sudah ada</p>
					</div>
				</div>

				<div className='bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden'>
					<form
						onSubmit={handleSubmit}
						className='p-6 sm:p-8 space-y-8'>
						{/* Informasi Dasar */}
						<div className='space-y-4'>
							<h3 className='text-lg font-bold text-gray-800 border-b pb-2'>Informasi Tugas</h3>

							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
									Judul Tugas <span className='text-red-500'>*</span>
								</label>
								<input
									type='text'
									required
									value={form.judul}
									onChange={(e) => setForm({ ...form, judul: e.target.value })}
									placeholder='Contoh: Tugas Praktikum Excel 1'
									className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
								/>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>
										Mata Pelajaran <span className='text-red-500'>*</span>
									</label>
									<input
										type='text'
										required
										value={form.mapel}
										onChange={(e) => setForm({ ...form, mapel: e.target.value })}
										placeholder='Contoh: Informatika'
										className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
									/>
								</div>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Materi (Opsional)</label>
									<input
										type='text'
										value={form.materi}
										onChange={(e) => setForm({ ...form, materi: e.target.value })}
										placeholder='Contoh: Microsoft Excel'
										className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all'
									/>
								</div>
							</div>
						</div>

						{/* Detail Soal */}
						<div className='space-y-4'>
							<div className='flex items-center justify-between border-b pb-2'>
								<h3 className='text-lg font-bold text-gray-800'>Detail Soal</h3>
								<div className='flex bg-gray-100 rounded-lg p-1'>
									<button
										type='button'
										onClick={() => setForm({ ...form, tipe_soal: 'Tunggal' })}
										className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${form.tipe_soal === 'Tunggal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
										Soal Tunggal
									</button>
									<button
										type='button'
										onClick={() => setForm({ ...form, tipe_soal: 'Kasus' })}
										className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${form.tipe_soal === 'Kasus' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
										Studi Kasus (Variasi)
									</button>
									<button
										type='button'
										onClick={() => setForm({ ...form, tipe_soal: 'PG' })}
										className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${form.tipe_soal === 'PG' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
										Pilihan Ganda
									</button>
								</div>
							</div>

							{form.tipe_soal === 'Tunggal' ? (
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Teks Soal / Instruksi</label>
									<div className="bg-white rounded-xl border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
										<ReactQuill 
											theme="snow"
											value={soalTunggal}
											onChange={setSoalTunggal}
											modules={quillModules}
											formats={quillFormats}
											placeholder='Ketikkan soal atau instruksi pengerjaan di sini...'
											className="min-h-[200px]"
										/>
									</div>
									<p className='text-sm text-gray-500 mt-2'>Semua siswa yang memasukkan PIN akan melihat soal yang sama ini.</p>
								</div>
							) : form.tipe_soal === 'Kasus' ? (
								<div className='space-y-4'>
									<div className='bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800'>
										<strong>Mode Studi Kasus:</strong> Aplikasi akan membagikan kasus secara otomatis kepada siswa berdasarkan rumus:{' '}
										<code className='bg-white px-1.5 py-0.5 rounded text-blue-600'>(Nomor Absen mod Jumlah Kasus)</code>.
									</div>

									<div className='space-y-4'>
										{soalKasus.map((kasus, index) => (
											<div
												key={kasus.id}
												className='flex gap-3 items-start bg-gray-50 p-4 rounded-xl border border-gray-200'>
												<div className='w-10 h-10 shrink-0 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold'>{index + 1}</div>
												<div className='flex-1 bg-white rounded-xl border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all'>
													<ReactQuill 
														theme="snow"
														value={kasus.teks}
														onChange={(val) => updateKasus(kasus.id, val)}
														modules={quillModules}
														formats={quillFormats}
														placeholder={`Teks soal untuk kasus #${index + 1}`}
													/>
												</div>
												<button
													type='button'
													onClick={() => hapusKasus(kasus.id)}
													className='p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors'
													disabled={soalKasus.length === 1}>
													<Trash2 className='w-5 h-5' />
												</button>
											</div>
										))}
									</div>

									<button
										type='button'
										onClick={tambahKasus}
										className='inline-flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all'>
										<Plus className='w-5 h-5' />
										Tambah Variasi Kasus
									</button>
								</div>
							) : (
								<div className="space-y-6">
									<div className="flex flex-col sm:flex-row gap-4 mb-4">
										<div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800 flex-1">
											<strong>Mode Pilihan Ganda (CBT):</strong> Sistem akan secara otomatis mengoreksi jawaban siswa dan memberikan nilai akhir (0-100) segera setelah mereka selesai.
										</div>
										<div className="flex flex-col gap-2 min-w-max">
											<button
												type="button"
												onClick={() => fileInputRef.current.click()}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
											>
												<Upload className="w-4 h-4" /> Import Excel
											</button>
											<input
												type="file"
												accept=".xlsx, .xls"
												ref={fileInputRef}
												onChange={handleFileUpload}
												className="hidden"
											/>
											<button
												type="button"
												onClick={downloadTemplate}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition-colors"
											>
												<Download className="w-4 h-4" /> Download Template
											</button>
										</div>
									</div>

									{soalPG.map((soal, index) => (
										<div key={soal.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative">
											<div className="absolute -top-3 -left-3 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
												{index + 1}
											</div>
											<div className="flex justify-between items-start mb-4 pl-3">
												<h4 className="font-bold text-gray-700">Pertanyaan</h4>
												<button
													type="button"
													onClick={() => hapusSoalPG(soal.id)}
													disabled={soalPG.length === 1}
													className="text-gray-400 hover:text-red-500 transition-colors"
													title="Hapus Soal"
												>
													<Trash2 className="w-5 h-5" />
												</button>
											</div>

											<div className="bg-white rounded-xl border border-gray-300 mb-4 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
												<ReactQuill 
													theme="snow"
													value={soal.pertanyaan}
													onChange={(val) => updateSoalPG(soal.id, 'pertanyaan', val)}
													modules={quillModules}
													formats={quillFormats}
													placeholder="Ketikkan pertanyaan di sini..."
												/>
											</div>

											<div className="space-y-3">
												{soal.opsi.map((opt, optIdx) => {
													const isChecked = Array.isArray(soal.jawabanBenar) 
														? soal.jawabanBenar.includes(optIdx)
														: soal.jawabanBenar === optIdx;
													
													return (
														<div key={optIdx} className="flex items-center gap-3">
															<input
																type="checkbox"
																checked={isChecked}
																onChange={() => updateSoalPG(soal.id, 'jawabanBenar', optIdx)}
																className="w-5 h-5 text-emerald-500 focus:ring-emerald-500 rounded cursor-pointer"
																title="Jadikan sebagai kunci jawaban"
															/>
															<div className="flex-1 flex items-center gap-2">
																<span className="font-bold text-gray-500 w-5">{String.fromCharCode(65 + optIdx)}.</span>
																<input
																	type="text"
																	value={opt}
																	onChange={(e) => updateSoalPG(soal.id, 'opsi', e.target.value, optIdx)}
																	placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
																	className={`w-full px-4 py-2 rounded-lg border outline-none transition-all ${isChecked ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-gray-300 focus:border-indigo-500'}`}
																/>
															</div>
														</div>
													);
												})}
												
												<button
													type="button"
													onClick={() => tambahOpsiPG(soal.id)}
													className="inline-flex items-center gap-1.5 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors mt-2"
												>
													<Plus className="w-4 h-4" /> Tambah Opsi
												</button>
											</div>
										</div>
									))}

									<button
										type="button"
										onClick={tambahSoalPG}
										className="inline-flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
									>
										<Plus className="w-6 h-6" />
										Tambah Soal Pilihan Ganda
									</button>
								</div>
							)}
						</div>

						<div className='pt-4 border-t border-gray-200 flex justify-end'>
							<button
								type='submit'
								disabled={submitting}
								className='inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
								{submitting ? (
									<div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
								) : (
									<>
										<Save className='w-5 h-5' /> Simpan Perubahan
									</>
								)}
							</button>
						</div>
					</form>
				</div>
			</div>
		</main>
	);
}
