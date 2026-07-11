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
	const [soalEssai, setSoalEssai] = useState([
		{ id: Date.now(), pertanyaan: '' }
	]);
	const [allowUpload, setAllowUpload] = useState(false);
	const [isCBTMode, setIsCBTMode] = useState(false);

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
					let isAllowUpload = false;
					let cbtMode = false;
					try {
						parsedSoal = JSON.parse(data.soal);
						if (parsedSoal && parsedSoal._wrapper) {
							isAllowUpload = parsedSoal.allowUpload;
							cbtMode = !!parsedSoal.isCBTMode;
							parsedSoal = parsedSoal.data;
						} else {
							isAllowUpload = data.tipe_soal !== 'PG' && data.tipe_soal !== 'Gabungan';
						}
					} catch (e) {
						parsedSoal = data.soal;
						isAllowUpload = data.tipe_soal !== 'PG' && data.tipe_soal !== 'Gabungan';
					}
					
					setAllowUpload(isAllowUpload);
					setIsCBTMode(cbtMode);

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
					} else if (data.tipe_soal === 'Essai') {
						if (Array.isArray(parsedSoal)) {
							setSoalEssai(parsedSoal.map(p => ({ id: Math.random(), pertanyaan: p.pertanyaan })));
						}
					} else if (data.tipe_soal === 'Gabungan') {
						if (parsedSoal && parsedSoal.pg && Array.isArray(parsedSoal.pg)) {
							setSoalPG(parsedSoal.pg.map(p => ({ 
								...p, 
								id: Math.random(),
								jawabanBenar: Array.isArray(p.jawabanBenar) ? p.jawabanBenar : (p.jawabanBenar !== undefined && p.jawabanBenar !== null ? [p.jawabanBenar] : [])
							})));
						}
						if (parsedSoal && parsedSoal.essai && Array.isArray(parsedSoal.essai)) {
							setSoalEssai(parsedSoal.essai.map(p => ({ id: Math.random(), pertanyaan: p.pertanyaan })));
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
			const cleanedPG = validatePG(soalPG);
			if (!cleanedPG) return;
			soalPayload = cleanedPG;
		} else if (form.tipe_soal === 'Essai') {
			const cleanedEssai = validateEssai(soalEssai);
			if (!cleanedEssai) return;
			soalPayload = cleanedEssai;
		} else if (form.tipe_soal === 'Gabungan') {
			const cleanedPG = validatePG(soalPG);
			if (!cleanedPG) return;
			const cleanedEssai = validateEssai(soalEssai);
			if (!cleanedEssai) return;
			soalPayload = { pg: cleanedPG, essai: cleanedEssai };
		}

		const wrappedPayload = {
			_wrapper: true,
			allowUpload: allowUpload,
			isCBTMode: isCBTMode,
			data: soalPayload
		};

		setSubmitting(true);

		try {
			const res = await fetch('/api/tugas-online', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					soal: wrappedPayload
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

	const validatePG = (pgList) => {
		const cleanedPG = pgList.map(s => {
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
		if (invalid) {
			Swal.fire('Error', 'Pastikan setiap pertanyaan PG terisi, memiliki minimal 2 opsi (jawaban), dan tentukan kunci jawabannya!', 'error');
			return null;
		}
		return cleanedPG;
	};

	const validateEssai = (essaiList) => {
		const invalid = essaiList.find(s => !s.pertanyaan.trim());
		if (invalid) {
			Swal.fire('Error', 'Pastikan setiap pertanyaan Essai telah terisi!', 'error');
			return null;
		}
		return essaiList;
	};

	const tambahSoalEssai = () => {
		setSoalEssai([...soalEssai, { id: Date.now(), pertanyaan: '' }]);
	};

	const hapusSoalEssai = (id) => {
		if (soalEssai.length > 1) {
			setSoalEssai(soalEssai.filter(s => s.id !== id));
		}
	};

	const updateSoalEssai = (id, value) => {
		setSoalEssai(soalEssai.map(s => (s.id === id ? { ...s, pertanyaan: value } : s)));
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

			const rows = json.slice(1);
			const isEssaiImport = form.tipe_soal === 'Essai';
			
			const newSoalPG = [];
			const newSoalEssai = [];

			rows.forEach(row => {
				if (!row || row.length === 0 || !row[0]) return;

				const pertanyaan = row[0] ? String(row[0]) : '';
				
				if (isEssaiImport) {
					newSoalEssai.push({ id: Math.random(), pertanyaan });
				} else {
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

					newSoalPG.push({ id: Math.random(), pertanyaan, opsi, jawabanBenar });
				}
			});

			if ((isEssaiImport && newSoalEssai.length > 0) || (!isEssaiImport && newSoalPG.length > 0)) {
				const jumlahSoal = isEssaiImport ? newSoalEssai.length : newSoalPG.length;
				const label = isEssaiImport ? 'Essai' : 'PG';

				const result = await Swal.fire({
					title: 'Pilih Tindakan',
					text: `Ditemukan ${jumlahSoal} soal ${label} di Excel. Anda ingin mengganti semua soal yang ada, atau menambahkannya ke bawah?`,
					icon: 'question',
					showCancelButton: true,
					showDenyButton: true,
					confirmButtonText: 'Ganti Semua',
					denyButtonText: 'Tambahkan Saja',
					cancelButtonText: 'Batal'
				});

				if (result.isConfirmed) {
					if (isEssaiImport) setSoalEssai(newSoalEssai);
					else setSoalPG(newSoalPG);
					Swal.fire('Berhasil', `Soal ${label} telah diganti seluruhnya dengan data dari Excel.`, 'success');
				} else if (result.isDenied) {
					if (isEssaiImport) setSoalEssai([...soalEssai, ...newSoalEssai]);
					else setSoalPG([...soalPG, ...newSoalPG]);
					Swal.fire('Berhasil', `Soal ${label} dari Excel berhasil ditambahkan ke urutan bawah.`, 'success');
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

	const downloadTemplate = (tipe) => {
		if (tipe === 'Essai') {
			const ws = XLSX.utils.aoa_to_sheet([
				['Pertanyaan'],
				['Jelaskan yang dimaksud dengan ekosistem!'],
				['Sebutkan fungsi dari HTML dalam pembuatan website!']
			]);
			ws['!cols'] = [{wch: 80}];
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Template Soal Essai");
			XLSX.writeFile(wb, "Template_Soal_Essai.xlsx");
		} else {
			const ws = XLSX.utils.aoa_to_sheet([
				['Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci Jawaban (Gunakan koma jika > 1. Contoh: A, C)'],
				['Ibukota Indonesia adalah?', 'Jakarta', 'Nusantara', 'Bandung', 'Surabaya', '', 'B'],
				['Manakah yang merupakan bahasa pemrograman?', 'Python', 'HTML', 'JavaScript', 'CSS', '', 'A, C']
			]);
			ws['!cols'] = [{wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 50}];
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Template Soal PG");
			XLSX.writeFile(wb, "Template_Soal_PG.xlsx");
		}
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
							<div className='flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-3'>
								<h3 className='text-lg font-bold text-gray-800'>Detail Soal</h3>
								<div className="w-full sm:w-auto">
									<select
										value={form.tipe_soal}
										onChange={(e) => setForm({ ...form, tipe_soal: e.target.value })}
										className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 outline-none font-semibold cursor-pointer shadow-sm"
									>
										<option value="Tunggal">Soal Tunggal</option>
										<option value="Kasus">Studi Kasus (Variasi)</option>
										<option value="PG">Pilihan Ganda</option>
										<option value="Essai">Essai</option>
										<option value="Gabungan">Gabungan (PG + Essai)</option>
									</select>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className='flex items-start gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200'>
									<label className='relative inline-flex items-center cursor-pointer mt-1'>
										<input 
											type='checkbox' 
											className='sr-only peer' 
											checked={allowUpload} 
											onChange={(e) => setAllowUpload(e.target.checked)} 
										/>
										<div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
									</label>
									<div>
										<span className='block text-sm font-bold text-gray-800'>Izinkan Upload Lampiran</span>
										<span className='block text-xs text-gray-500'>Siswa dapat mengunggah file (seperti foto/dokumen) saat mengerjakan.</span>
									</div>
								</div>

								<div className='flex items-start gap-3 bg-red-50 p-4 rounded-xl border border-red-200'>
									<label className='relative inline-flex items-center cursor-pointer mt-1'>
										<input 
											type='checkbox' 
											className='sr-only peer' 
											checked={isCBTMode} 
											onChange={(e) => setIsCBTMode(e.target.checked)} 
										/>
										<div className="w-11 h-6 bg-red-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
									</label>
									<div>
										<span className='block text-sm font-bold text-red-800'>Mode Ujian Ketat (CBT/CAT)</span>
										<span className='block text-xs text-red-600'>Wajib Layar Penuh. Siswa akan ditandai melanggar jika berpindah tab atau aplikasi.</span>
									</div>
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
							) : null}

							{(form.tipe_soal === 'PG' || form.tipe_soal === 'Gabungan') && (
								<div className="space-y-6 pt-4">
									{form.tipe_soal === 'Gabungan' && <h4 className="text-xl font-bold text-gray-800 border-b pb-2">Bagian 1: Pilihan Ganda</h4>}
									<div className="flex flex-col sm:flex-row gap-4 mb-4">
										<div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800 flex-1">
											<strong>Pilihan Ganda (CBT):</strong> Sistem akan secara otomatis mengoreksi jawaban siswa.
										</div>
										<div className="flex flex-col gap-2 min-w-max">
											<button
												type="button"
												onClick={() => fileInputRef.current.click()}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
											>
												<Upload className="w-4 h-4" /> Import Excel PG
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
												onClick={() => downloadTemplate('PG')}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition-colors"
											>
												<Download className="w-4 h-4" /> Download Template PG
											</button>
										</div>
									</div>

									{soalPG.map((soal, index) => (
										<div key={soal.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative">
											<div className="absolute -top-3 -left-3 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
												{index + 1}
											</div>
											<div className="flex justify-between items-start mb-4 pl-3">
												<h4 className="font-bold text-gray-700">Pertanyaan PG</h4>
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

							{(form.tipe_soal === 'Essai' || form.tipe_soal === 'Gabungan') && (
								<div className="space-y-6 pt-4">
									{form.tipe_soal === 'Gabungan' && <h4 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8">Bagian 2: Essai</h4>}
									<div className="flex flex-col sm:flex-row gap-4 mb-4">
										<div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex-1">
											<strong>Mode Essai:</strong> Siswa akan diberikan kotak teks terpisah untuk tiap butir soal. Penilaian akan dilakukan manual oleh guru.
										</div>
										<div className="flex flex-col gap-2 min-w-max">
											<button
												type="button"
												onClick={() => fileInputRef.current.click()}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
											>
												<Upload className="w-4 h-4" /> Import Excel Essai
											</button>
											<button
												type="button"
												onClick={() => downloadTemplate('Essai')}
												className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold rounded-lg transition-colors"
											>
												<Download className="w-4 h-4" /> Download Template Essai
											</button>
										</div>
									</div>

									{soalEssai.map((soal, index) => (
										<div key={soal.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative">
											<div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
												{index + 1}
											</div>
											<div className="flex justify-between items-start mb-4 pl-3">
												<h4 className="font-bold text-gray-700">Pertanyaan Essai</h4>
												<button
													type="button"
													onClick={() => hapusSoalEssai(soal.id)}
													disabled={soalEssai.length === 1}
													className="text-gray-400 hover:text-red-500 transition-colors"
													title="Hapus Soal"
												>
													<Trash2 className="w-5 h-5" />
												</button>
											</div>

											<div className="bg-white rounded-xl border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
												<ReactQuill 
													theme="snow"
													value={soal.pertanyaan}
													onChange={(val) => updateSoalEssai(soal.id, val)}
													modules={quillModules}
													formats={quillFormats}
													placeholder="Ketikkan pertanyaan essai di sini..."
												/>
											</div>
										</div>
									))}

									<button
										type="button"
										onClick={tambahSoalEssai}
										className="inline-flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
									>
										<Plus className="w-6 h-6" />
										Tambah Soal Essai
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
