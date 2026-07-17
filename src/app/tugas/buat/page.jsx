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
		type: 'Formatif',
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
			Swal.fire({
				title: 'ERROR',
				text: 'Judul dan Mata Pelajaran wajib diisi',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		let soalPayload = null;
		if (form.tipe_soal === 'Tunggal') {
			if (!soalTunggal) {
				Swal.fire({ title: 'ERROR', text: 'Teks soal belum diisi', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
				return;
			}
			soalPayload = soalTunggal;
		} else if (form.tipe_soal === 'Kasus') {
			const kasusIsi = soalKasus.filter(k => k.teks.trim() !== '');
			if (kasusIsi.length === 0) {
				Swal.fire({ title: 'ERROR', text: 'Minimal 1 kasus harus diisi', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
				return;
			}
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
					title: 'BERHASIL!',
					html: `Tugas telah dibuat.<br><br>PIN Akses:<br><div style="font-size: 32px; font-weight: 900; background: #F5C518; color: #0D0D0D; padding: 10px; border: 4px solid #0D0D0D; box-shadow: 6px 6px 0px 0px #0D0D0D; margin-top: 10px; margin-bottom: 15px; display: inline-block;">${data.pin}</div><br>Siswa dapat menggunakan PIN ini di halaman <b>/soal</b>.`,
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
				router.push('/tugas');
			} else {
				Swal.fire({ title: 'GAGAL', text: data.error || 'Terjadi kesalahan', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
			}
		} catch (error) {
			Swal.fire({ title: 'ERROR', text: 'Gagal terhubung ke server', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
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
			Swal.fire({ title: 'ERROR', text: 'Pastikan setiap pertanyaan PG terisi, memiliki minimal 2 opsi (jawaban), dan tentukan kunci jawabannya!', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
			return null;
		}
		return cleanedPG;
	};

	const validateEssai = (essaiList) => {
		const invalid = essaiList.find(s => !s.pertanyaan.trim());
		if (invalid) {
			Swal.fire({ title: 'ERROR', text: 'Pastikan setiap pertanyaan Essai telah terisi!', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
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
				Swal.fire({ title: 'BERHASIL', text: `\${newSoalEssai.length} soal Essai berhasil diimport!`, icon: 'success', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase tracking-widest', confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
			} else if (!isEssaiImport && newSoalPG.length > 0) {
				setSoalPG(newSoalPG);
				Swal.fire({ title: 'BERHASIL', text: `\${newSoalPG.length} soal PG berhasil diimport!`, icon: 'success', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase tracking-widest', confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
			} else {
				Swal.fire({ title: 'GAGAL', text: 'Tidak ada soal valid yang ditemukan dalam file.', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
			}
		} catch (error) {
			console.error(error);
			Swal.fire({ title: 'ERROR', text: 'Gagal membaca file Excel. Pastikan format sesuai template.', icon: 'error', background: '#FFF5F0', color: '#0D0D0D', customClass: { popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none', title: 'font-black uppercase', confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase' }});
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
		<main className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] py-12 font-sans'>
			<div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8'>
				
				{/* Header Section */}
				<div className='mb-12 flex items-center gap-6'>
					<Link href='/tugas' className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</Link>
					<div>
						<h1 className='text-3xl sm:text-5xl font-black text-[#0D0D0D] uppercase tracking-widest drop-shadow-[2px_2px_0px_#F5C518] mb-1'>Buat Tugas Baru</h1>
						<p className='text-[#0D0D0D] font-bold text-sm sm:text-base uppercase tracking-wider'>Buat tugas tunggal atau berbasis studi kasus untuk siswa</p>
					</div>
				</div>

				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D]'>
					<form onSubmit={handleSubmit} className='p-6 sm:p-10 space-y-12'>
						
						{/* Informasi Dasar */}
						<div className='space-y-6'>
							<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] -rotate-1 mb-8 inline-block'>
								<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>1. Informasi Tugas</h3>
							</div>
							
							<div>
								<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Judul Tugas <span className="text-[#E8451A] text-xl">*</span></label>
								<input
									type='text'
									required
									value={form.judul}
									onChange={(e) => setForm({ ...form, judul: e.target.value })}
									placeholder='Contoh: Tugas Praktikum Excel 1'
									className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'
								/>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Mata Pelajaran <span className="text-[#E8451A] text-xl">*</span></label>
									<select
										required
										value={form.mapel}
										onChange={(e) => setForm({ ...form, mapel: e.target.value })}
										className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer rounded-none disabled:bg-gray-200'
										disabled={fetchingMapel}
									>
										<option value="" disabled>{fetchingMapel ? 'Memuat Mapel...' : 'PILIH MATA PELAJARAN'}</option>
										{mapelList.map((m) => (
											<option key={m.id} value={m.mapel}>{m.mapel}</option>
										))}
									</select>
								</div>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Materi <span className="text-gray-500 lowercase tracking-normal">(Opsional)</span></label>
									<input
										type='text'
										value={form.materi}
										onChange={(e) => setForm({ ...form, materi: e.target.value })}
										placeholder='Contoh: Microsoft Excel'
										className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] placeholder-gray-400 focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6'>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Kategori Nilai</label>
									<select
										value={form.kategori}
										onChange={(e) => setForm({ ...form, kategori: e.target.value })}
										className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer rounded-none'
									>
										<option value="Pengetahuan">PENGETAHUAN</option>
										<option value="Keterampilan">KETERAMPILAN</option>
										<option value="Sikap">SIKAP</option>
										<option value="Spiritual">SPIRITUAL</option>
										<option value="Lainnya">LAINNYA</option>
									</select>
								</div>
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Tipe Nilai</label>
									<select
										value={form.type}
										onChange={(e) => setForm({ ...form, type: e.target.value })}
										className='w-full px-5 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer rounded-none'
									>
										<option value="Formatif">FORMATIF</option>
										<option value="Sumatif">SUMATIF</option>
										<option value="SAS">SAS</option>
									</select>
								</div>
							</div>
						</div>

						{/* Detail Soal */}
						<div className='space-y-6 pt-10 border-t-[4px] border-[#0D0D0D]'>
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
								<div className='bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block'>
									<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>2. Detail Soal</h3>
								</div>
								<div className="w-full md:w-auto">
									<select
										value={form.tipe_soal}
										onChange={(e) => setForm({ ...form, tipe_soal: e.target.value })}
										className="w-full md:w-auto px-6 py-4 h-[60px] bg-white border-[4px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-widest focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer rounded-none"
									>
										<option value="Tunggal">SOAL TUNGGAL</option>
										<option value="Kasus">STUDI KASUS (VARIASI)</option>
										<option value="PG">PILIHAN GANDA</option>
										<option value="Essai">ESSAI</option>
										<option value="Gabungan">GABUNGAN (PG + ESSAI)</option>
									</select>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
								<div className='flex items-start gap-4 bg-[#A3E635] p-5 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<label className='relative inline-flex items-center cursor-pointer mt-1'>
										<input 
											type='checkbox' 
											className='sr-only peer' 
											checked={allowUpload} 
											onChange={(e) => setAllowUpload(e.target.checked)} 
										/>
										<div className="w-14 h-8 bg-white border-[3px] border-[#0D0D0D] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#0D0D0D] after:border-[#0D0D0D] after:border-[3px] after:h-6 after:w-6 after:transition-all peer-checked:bg-[#0D0D0D] peer-checked:after:bg-[#A3E635]"></div>
									</label>
									<div>
										<span className='block text-base font-black text-[#0D0D0D] uppercase tracking-widest'>Izinkan Upload Lampiran</span>
										<span className='block text-sm font-bold text-[#0D0D0D] mt-1'>Siswa dapat mengunggah file (seperti foto/dokumen) saat mengerjakan.</span>
									</div>
								</div>

								<div className='flex items-start gap-4 bg-[#E8451A] p-5 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<label className='relative inline-flex items-center cursor-pointer mt-1'>
										<input 
											type='checkbox' 
											className='sr-only peer' 
											checked={isCBTMode} 
											onChange={(e) => setIsCBTMode(e.target.checked)} 
										/>
										<div className="w-14 h-8 bg-white border-[3px] border-[#0D0D0D] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#0D0D0D] after:border-[#0D0D0D] after:border-[3px] after:h-6 after:w-6 after:transition-all peer-checked:bg-[#0D0D0D] peer-checked:after:bg-[#F5C518]"></div>
									</label>
									<div>
										<span className='block text-base font-black text-white uppercase tracking-widest'>Mode Ujian Ketat (CBT)</span>
										<span className='block text-sm font-bold text-white mt-1'>Wajib Layar Penuh. Siswa ditandai melanggar jika pindah tab.</span>
									</div>
								</div>
							</div>

							{form.tipe_soal === 'Tunggal' ? (
								<div className="bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-1">
									<div className="bg-[#0D0D0D] text-white px-4 py-2 font-black uppercase tracking-widest border-b-[4px] border-[#0D0D0D] mb-2 flex items-center justify-between">
										<span>Teks Soal / Instruksi</span>
										<span className="text-xs text-gray-400 bg-gray-800 px-2 py-1">Semua siswa melihat soal ini</span>
									</div>
									<div className="bg-white">
										<ReactQuill 
											theme="snow"
											value={soalTunggal}
											onChange={setSoalTunggal}
											modules={quillModules}
											formats={quillFormats}
											placeholder='Ketikkan soal atau instruksi pengerjaan di sini...'
											className="min-h-[250px] font-bold text-lg"
										/>
									</div>
								</div>
							) : form.tipe_soal === 'Kasus' ? (
								<div className="space-y-6">
									<div className="bg-[#2F80ED] border-[4px] border-[#0D0D0D] p-4 text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex gap-4 items-start">
										<div className="bg-white p-2 border-[3px] border-[#0D0D0D] -rotate-3">
											<svg className='w-8 h-8 text-[#0D0D0D]' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}>
												<path strokeLinecap='square' strokeLinejoin='miter' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
											</svg>
										</div>
										<div>
											<strong className="font-black uppercase tracking-widest text-white block mb-1">MODE STUDI KASUS:</strong> 
											<span className="font-bold text-white text-sm">Aplikasi membagikan kasus secara otomatis kepada siswa berdasarkan rumus: <code className="bg-white text-[#0D0D0D] px-2 py-1 border-[2px] border-[#0D0D0D] font-black">(Nomor Absen mod Jumlah Kasus)</code>.</span>
										</div>
									</div>
									
									<div className="space-y-6">
										{soalKasus.map((kasus, index) => (
											<div key={kasus.id} className="bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-1 relative">
												<div className="bg-[#0D0D0D] flex justify-between items-center mb-1">
													<div className="bg-[#F5C518] text-[#0D0D0D] px-6 py-3 font-black uppercase tracking-widest text-xl border-r-[4px] border-[#0D0D0D]">
														VAR. #{index + 1}
													</div>
													<button
														type="button"
														onClick={() => hapusKasus(kasus.id)}
														className="bg-[#E8451A] text-white px-6 py-3 font-black uppercase hover:bg-white hover:text-[#E8451A] transition-colors border-l-[4px] border-[#0D0D0D] disabled:opacity-50"
														disabled={soalKasus.length === 1}
													>
														<Trash2 className="w-6 h-6" strokeWidth={3} />
													</button>
												</div>
												<div className="bg-white p-2">
													<ReactQuill 
														theme="snow"
														value={kasus.teks}
														onChange={(val) => updateKasus(kasus.id, val)}
														modules={quillModules}
														formats={quillFormats}
														placeholder={`Teks soal untuk kasus #${index + 1}`}
														className="min-h-[200px] font-bold text-lg"
													/>
												</div>
											</div>
										))}
									</div>

									<button
										type="button"
										onClick={tambahKasus}
										className="inline-flex items-center justify-center gap-3 w-full py-5 bg-[#A3E635] border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
									>
										<Plus className="w-8 h-8" strokeWidth={3} />
										TAMBAH VARIASI KASUS
									</button>
								</div>
							) : null}

							{(form.tipe_soal === 'PG' || form.tipe_soal === 'Gabungan') && (
								<div className="space-y-8 pt-6">
									{form.tipe_soal === 'Gabungan' && <h4 className="text-3xl font-black text-[#0D0D0D] uppercase tracking-widest border-b-[6px] border-[#0D0D0D] pb-3">BAGIAN 1: PILIHAN GANDA</h4>}
									
									<div className="flex flex-col lg:flex-row gap-6 mb-6">
										<div className="bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-4 flex-1 flex gap-4 items-start">
											<div className="bg-white p-2 border-[3px] border-[#0D0D0D] rotate-3">
												<svg className='w-8 h-8 text-[#0D0D0D]' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}>
													<path strokeLinecap='square' strokeLinejoin='miter' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
												</svg>
											</div>
											<div>
												<strong className="font-black uppercase tracking-widest text-[#0D0D0D] block mb-1">PILIHAN GANDA (CBT):</strong>
												<span className="font-bold text-[#0D0D0D] text-sm">Sistem mengoreksi jawaban siswa otomatis.</span>
											</div>
										</div>
										<div className="flex flex-col gap-3 min-w-max">
											<button
												type="button"
												onClick={() => fileInputRef.current.click()}
												className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0D0D0D] text-white border-[4px] border-[#0D0D0D] hover:bg-[#F5C518] hover:text-[#0D0D0D] font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all"
											>
												<Upload className="w-5 h-5" strokeWidth={3} /> IMPORT EXCEL PG
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
												className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#0D0D0D] border-[4px] border-[#0D0D0D] hover:bg-[#00A693] hover:text-white font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all"
											>
												<Download className="w-5 h-5" strokeWidth={3} /> DOWNLOAD TEMPLATE PG
											</button>
										</div>
									</div>

									{soalPG.map((soal, index) => (
										<div key={soal.id} className="bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-2 relative">
											<div className="bg-[#0D0D0D] flex justify-between items-center mb-2">
												<div className="bg-[#00A693] text-white px-6 py-3 font-black uppercase tracking-widest text-xl border-r-[4px] border-[#0D0D0D]">
													SOAL #{index + 1}
												</div>
												<button
													type="button"
													onClick={() => hapusSoalPG(soal.id)}
													disabled={soalPG.length === 1}
													className="bg-[#E8451A] text-white px-6 py-3 font-black uppercase hover:bg-white hover:text-[#E8451A] transition-colors border-l-[4px] border-[#0D0D0D] disabled:opacity-50"
													title="Hapus Soal"
												>
													<Trash2 className="w-6 h-6" strokeWidth={3} />
												</button>
											</div>

											<div className="bg-white border-[4px] border-[#0D0D0D] mb-6 p-1">
												<div className="bg-[#0D0D0D] text-white px-4 py-2 font-black uppercase tracking-widest text-sm border-b-[4px] border-[#0D0D0D]">Pertanyaan</div>
												<ReactQuill 
													theme="snow"
													value={soal.pertanyaan}
													onChange={(val) => updateSoalPG(soal.id, 'pertanyaan', val)}
													modules={quillModules}
													formats={quillFormats}
													placeholder="Ketikkan pertanyaan di sini..."
													className="min-h-[150px] font-bold"
												/>
											</div>

											<div className="space-y-4 px-2 pb-4">
												<div className="font-black text-[#0D0D0D] uppercase tracking-widest mb-2 border-b-[4px] border-[#0D0D0D] inline-block pb-1">Opsi Jawaban</div>
												{soal.opsi.map((opt, optIdx) => {
													const isChecked = Array.isArray(soal.jawabanBenar) 
														? soal.jawabanBenar.includes(optIdx)
														: soal.jawabanBenar === optIdx;
													
													return (
														<div key={optIdx} className="flex items-center gap-4">
															<input
																type="checkbox"
																checked={isChecked}
																onChange={() => updateSoalPG(soal.id, 'jawabanBenar', optIdx)}
																className="w-8 h-8 appearance-none border-[3px] border-[#0D0D0D] bg-white checked:bg-[#00A693] checked:border-[3px] checked:after:content-['✔'] checked:after:text-white checked:after:font-black checked:after:flex checked:after:items-center checked:after:justify-center checked:after:h-full cursor-pointer hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all"
																title="Jadikan sebagai kunci jawaban"
															/>
															<div className="flex-1 flex items-center gap-0">
																<div className="bg-[#0D0D0D] text-white font-black text-xl px-4 py-3 h-[60px] flex items-center justify-center border-[4px] border-[#0D0D0D] border-r-0">
																	{String.fromCharCode(65 + optIdx)}
																</div>
																<input
																	type="text"
																	value={opt}
																	onChange={(e) => updateSoalPG(soal.id, 'opsi', e.target.value, optIdx)}
																	placeholder={`Teks Opsi ${String.fromCharCode(65 + optIdx)}`}
																	className={`w-full px-5 py-3 h-[60px] border-[4px] border-[#0D0D0D] font-bold text-[#0D0D0D] outline-none transition-all ${isChecked ? 'bg-[#00A693] text-white placeholder-white/70' : 'bg-white focus:-translate-y-1 focus:shadow-[4px_4px_0px_0px_#0D0D0D]'}`}
																/>
															</div>
														</div>
													);
												})}
												
												<button
													type="button"
													onClick={() => tambahOpsiPG(soal.id)}
													className="inline-flex items-center gap-2 text-[#0D0D0D] font-black uppercase tracking-widest text-sm bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all mt-4"
												>
													<Plus className="w-5 h-5" strokeWidth={3} /> TAMBAH OPSI JAWABAN
												</button>
											</div>
										</div>
									))}

									<button
										type="button"
										onClick={tambahSoalPG}
										className="inline-flex items-center justify-center gap-3 w-full py-5 bg-[#00A693] text-white border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
									>
										<Plus className="w-8 h-8" strokeWidth={3} />
										TAMBAH SOAL PILIHAN GANDA
									</button>
								</div>
							)}

							{(form.tipe_soal === 'Essai' || form.tipe_soal === 'Gabungan') && (
								<div className="space-y-8 pt-6">
									{form.tipe_soal === 'Gabungan' && <h4 className="text-3xl font-black text-[#0D0D0D] uppercase tracking-widest border-b-[6px] border-[#0D0D0D] pb-3 mt-12">BAGIAN 2: ESSAI</h4>}
									
									<div className="flex flex-col lg:flex-row gap-6 mb-6">
										<div className="bg-[#2F80ED] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-4 flex-1 flex gap-4 items-start">
											<div className="bg-white p-2 border-[3px] border-[#0D0D0D] -rotate-3">
												<svg className='w-8 h-8 text-[#0D0D0D]' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}>
													<path strokeLinecap='square' strokeLinejoin='miter' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
												</svg>
											</div>
											<div>
												<strong className="font-black uppercase tracking-widest text-white block mb-1">MODE ESSAI:</strong>
												<span className="font-bold text-white text-sm">Siswa diberi kotak teks terpisah tiap soal. Penilaian manual oleh guru.</span>
											</div>
										</div>
										<div className="flex flex-col gap-3 min-w-max">
											<button
												type="button"
												onClick={() => fileInputRef.current.click()}
												className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0D0D0D] text-white border-[4px] border-[#0D0D0D] hover:bg-[#2F80ED] hover:text-white font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all"
											>
												<Upload className="w-5 h-5" strokeWidth={3} /> IMPORT EXCEL ESSAI
											</button>
											<button
												type="button"
												onClick={() => downloadTemplate('Essai')}
												className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#0D0D0D] border-[4px] border-[#0D0D0D] hover:bg-[#F5C518] font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all"
											>
												<Download className="w-5 h-5" strokeWidth={3} /> DOWNLOAD TEMPLATE ESSAI
											</button>
										</div>
									</div>

									{soalEssai.map((soal, index) => (
										<div key={soal.id} className="bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-1 relative">
											<div className="bg-[#0D0D0D] flex justify-between items-center mb-1">
												<div className="bg-[#2F80ED] text-white px-6 py-3 font-black uppercase tracking-widest text-xl border-r-[4px] border-[#0D0D0D]">
													ESSAI #{index + 1}
												</div>
												<button
													type="button"
													onClick={() => hapusSoalEssai(soal.id)}
													disabled={soalEssai.length === 1}
													className="bg-[#E8451A] text-white px-6 py-3 font-black uppercase hover:bg-white hover:text-[#E8451A] transition-colors border-l-[4px] border-[#0D0D0D] disabled:opacity-50"
													title="Hapus Soal"
												>
													<Trash2 className="w-6 h-6" strokeWidth={3} />
												</button>
											</div>

											<div className="bg-white p-2">
												<ReactQuill 
													theme="snow"
													value={soal.pertanyaan}
													onChange={(val) => updateSoalEssai(soal.id, val)}
													modules={quillModules}
													formats={quillFormats}
													placeholder="Ketikkan pertanyaan essai di sini..."
													className="min-h-[150px] font-bold"
												/>
											</div>
										</div>
									))}

									<button
										type="button"
										onClick={tambahSoalEssai}
										className="inline-flex items-center justify-center gap-3 w-full py-5 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
									>
										<Plus className="w-8 h-8" strokeWidth={3} />
										TAMBAH SOAL ESSAI
									</button>
								</div>
							)}
						</div>

						<div className="pt-10 border-t-[6px] border-[#0D0D0D] flex justify-end">
							<button
								type='submit'
								disabled={loading}
								className='inline-flex items-center justify-center gap-3 px-12 py-5 bg-[#FF90E8] text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-xl shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto'
							>
								{loading ? (
									<div className="w-8 h-8 border-[4px] border-[#0D0D0D] border-t-transparent rounded-full animate-spin"></div>
								) : (
									<><Save className="w-8 h-8" strokeWidth={3} /> SIMPAN TUGAS & GENERATE PIN</>
								)}
							</button>
						</div>

					</form>
				</div>
			</div>
		</main>
	);

}
