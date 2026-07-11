'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Save, Upload, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
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

export default function BuatTugas() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [mapelList, setMapelList] = useState([]);
	const [fetchingMapel, setFetchingMapel] = useState(false);
	
	const [form, setForm] = useState({
		judul: '',
		mapel: '',
		materi: '',
		tipe_soal: 'Tunggal', // 'Tunggal' atau 'Kasus'
		kategori: 'Pengetahuan',
		type: 'Tugas Online',
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
		const fetchMapel = async () => {
			setFetchingMapel(true);
			try {
				const res = await fetch('/api/mapel');
				if (res.ok) {
					const data = await res.json();
					setMapelList(data);
				}
			} catch (error) {
				console.error('Failed to fetch mapel', error);
			} finally {
				setFetchingMapel(false);
			}
		};
		fetchMapel();
	}, []);

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
			const kasusIsi = soalKasus.filter(k => k.teks.trim() !== '');
			if (kasusIsi.length === 0) return Swal.fire('Error', 'Minimal 1 kasus harus diisi', 'error');
			soalPayload = kasusIsi.map(k => k.teks); // Array of strings
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

		setLoading(true);

		try {
			const response = await fetch('/api/tugas-online', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...form,
					soal: wrappedPayload
				})
			});

			const data = await response.json();

			if (response.ok) {
				await Swal.fire({
					title: 'Berhasil!',
					html: `Tugas telah dibuat.<br><br>PIN Akses:<br><b style="font-size: 24px; color: #4f46e5;">${data.pin}</b><br><br>Siswa dapat menggunakan PIN ini di halaman <b>/soal</b>.`,
					icon: 'success',
				});
				router.push('/tugas');
			} else {
				Swal.fire('Gagal', data.error || 'Terjadi kesalahan', 'error');
			}
		} catch (error) {
			Swal.fire('Error', 'Gagal terhubung ke server', 'error');
		} finally {
			setLoading(false);
		}
	};

	const tambahKasus = () => {
		setSoalKasus([...soalKasus, { id: Date.now(), teks: '' }]);
	};

	const hapusKasus = (id) => {
		if (soalKasus.length > 1) {
			setSoalKasus(soalKasus.filter(k => k.id !== id));
		}
	};

	const updateKasus = (id, val) => {
		setSoalKasus(soalKasus.map(k => k.id === id ? { ...k, teks: val } : k));
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

			if (isEssaiImport && newSoalEssai.length > 0) {
				setSoalEssai(newSoalEssai);
				Swal.fire('Berhasil', `${newSoalEssai.length} soal Essai berhasil diimport!`, 'success');
			} else if (!isEssaiImport && newSoalPG.length > 0) {
				setSoalPG(newSoalPG);
				Swal.fire('Berhasil', `${newSoalPG.length} soal PG berhasil diimport!`, 'success');
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

	return (
		<main className='min-h-screen bg-gray-50 py-8'>
			<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='mb-8 flex items-center gap-4'>
					<Link href='/tugas' className='p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors'>
						<ChevronLeft className='w-6 h-6 text-gray-600' />
					</Link>
					<div>
						<h1 className='text-3xl font-bold text-gray-800'>Buat Tugas Baru</h1>
						<p className='text-gray-500'>Buat tugas tunggal atau berbasis studi kasus untuk siswa</p>
					</div>
				</div>

				<div className='bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden'>
					<form onSubmit={handleSubmit} className='p-6 sm:p-8 space-y-8'>
						
						{/* Informasi Dasar */}
						<div className='space-y-4'>
							<h3 className='text-lg font-bold text-gray-800 border-b pb-2'>Informasi Tugas</h3>
							
							<div>
								<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Judul Tugas <span className="text-red-500">*</span></label>
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
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Mata Pelajaran <span className="text-red-500">*</span></label>
									<select
										required
										value={form.mapel}
										onChange={(e) => setForm({ ...form, mapel: e.target.value })}
										className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer bg-white disabled:opacity-50'
										disabled={fetchingMapel}
									>
										<option value="" disabled>{fetchingMapel ? 'Memuat Mapel...' : 'Pilih Mata Pelajaran'}</option>
										{mapelList.map((m) => (
											<option key={m.id} value={m.mapel}>{m.mapel}</option>
										))}
									</select>
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

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Kategori Nilai</label>
									<select
										value={form.kategori}
										onChange={(e) => setForm({ ...form, kategori: e.target.value })}
										className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer bg-white'
									>
										<option value="Pengetahuan">Pengetahuan</option>
										<option value="Keterampilan">Keterampilan</option>
										<option value="Sikap">Sikap</option>
										<option value="Spiritual">Spiritual</option>
										<option value="Lainnya">Lainnya</option>
									</select>
								</div>
								<div>
									<label className='block text-sm font-semibold text-gray-700 mb-1.5'>Tipe Nilai</label>
									<select
										value={form.type}
										onChange={(e) => setForm({ ...form, type: e.target.value })}
										className='w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer bg-white'
									>
										<option value="Tugas Online">Tugas Online</option>
										<option value="Formatif">Formatif</option>
										<option value="Sumatif">Sumatif</option>
										<option value="UTS">UTS</option>
										<option value="UAS">UAS</option>
										<option value="Lainnya">Lainnya</option>
									</select>
								</div>
							</div>
						</div>

						{/* Detail Soal */}
						<div className='space-y-4'>
							<div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-3">
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
									<p className="text-sm text-gray-500 mt-2">Semua siswa yang memasukkan PIN akan melihat soal yang sama ini.</p>
								</div>
							) : form.tipe_soal === 'Kasus' ? (
								<div className="space-y-4">
									<div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
										<strong>Mode Studi Kasus:</strong> Aplikasi akan membagikan kasus secara otomatis kepada siswa berdasarkan rumus: <code className="bg-white px-1.5 py-0.5 rounded text-blue-600">(Nomor Absen mod Jumlah Kasus)</code>.
									</div>
									
									<div className="space-y-4">
										{soalKasus.map((kasus, index) => (
											<div key={kasus.id} className="flex gap-3 items-start bg-gray-50 p-4 rounded-xl border border-gray-200">
												<div className="w-10 h-10 shrink-0 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
													{index + 1}
												</div>
												<div className="flex-1 bg-white rounded-xl border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
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
													type="button"
													onClick={() => hapusKasus(kasus.id)}
													className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
													disabled={soalKasus.length === 1}
												>
													<Trash2 className="w-5 h-5" />
												</button>
											</div>
										))}
									</div>

									<button
										type="button"
										onClick={tambahKasus}
										className="inline-flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
									>
										<Plus className="w-5 h-5" />
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
											{/* Note: using the same fileInputRef requires handling based on form.tipe_soal */}
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

						<div className="pt-4 border-t border-gray-200 flex justify-end">
							<button
								type='submit'
								disabled={loading}
								className='inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{loading ? (
									<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								) : (
									<><Save className="w-5 h-5" /> Simpan Tugas & Generate PIN</>
								)}
							</button>
						</div>

					</form>
				</div>
			</div>
		</main>
	);
}
