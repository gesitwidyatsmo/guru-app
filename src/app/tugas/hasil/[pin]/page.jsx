'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileText, Clock, X, Trash2 } from 'lucide-react';
import Loader from '../../../components/loading';
import Swal from 'sweetalert2';

export default function HasilTugas({ params }) {
	const unwrappedParams = use(params);
	const pin = unwrappedParams.pin;

	const [submissions, setSubmissions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterKelas, setFilterKelas] = useState('Semua');
	
	// Untuk modal teks panjang
	const [selectedText, setSelectedText] = useState(null);

	// Untuk grading manual
	const [savingNilaiId, setSavingNilaiId] = useState(null);

	const handleSaveNilai = async (id, nilai, siswa_id, kelas, nama_siswa) => {
		setSavingNilaiId(id);
		try {
			const res = await fetch('/api/tugas-online/nilai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id_pengumpulan: id,
					pin: pin,
					siswa_id: siswa_id,
					kelas: kelas,
					nama_siswa: nama_siswa,
					nilai: nilai
				})
			});
			const data = await res.json();
			if (!res.ok) {
				console.error(data.error);
			} else {
				// Update state locally
				setSubmissions(prev => prev.map(s => s.id === id ? { ...s, nilai: nilai } : s));
			}
		} catch (e) {
			console.error(e);
		} finally {
			setSavingNilaiId(null);
		}
	};

	const handleBeriNilai = (sub) => {
		Swal.fire({
			title: `BERI NILAI`,
			text: sub.nama,
			input: 'number',
			inputLabel: 'Masukkan nilai (0 - 100)',
			inputValue: sub.nilai || '',
			showCancelButton: true,
			confirmButtonText: 'SIMPAN',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			inputAttributes: {
				min: 0,
				max: 100,
				step: 1
			},
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				input: 'bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-center font-black text-xl !text-[#0D0D0D] rounded-none focus:outline-none focus:ring-0 mx-auto w-32 mt-4',
				confirmButton: 'bg-[#A3E635] text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
			},
			preConfirm: (value) => {
				if (value !== '' && (value < 0 || value > 100)) {
					Swal.showValidationMessage('Nilai harus di antara 0 dan 100');
				}
				return value;
			},
			didOpen: () => {
				const input = Swal.getInput();
				if (input) {
					input.addEventListener('wheel', (e) => e.target.blur());
				}
			}
		}).then((result) => {
			if (result.isConfirmed) {
				const newVal = result.value;
				if (newVal !== String(sub.nilai || '')) {
					handleSaveNilai(sub.id, newVal, sub.siswa_id, sub.kelas, sub.nama);
				}
			}
		});
	};

	const handleDelete = async (id, nama) => {
		const result = await Swal.fire({
			title: 'HAPUS PENGUMPULAN?',
			text: `Data pengumpulan milik ${nama} akan dihapus secara permanen.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
			},
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch(`/api/tugas-online/hasil?id=${id}`, {
					method: 'DELETE',
				});
				const data = await res.json();

				if (res.ok) {
					Swal.fire({
						title: 'TERHAPUS!',
						text: 'Hasil pengumpulan telah dihapus.',
						icon: 'success',
						background: '#FFF5F0',
						color: '#0D0D0D',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
							title: 'font-black uppercase tracking-widest',
							confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
						},
					});
					setSubmissions(prev => prev.filter(s => s.id !== id));
				} else {
					Swal.fire({
						title: 'GAGAL!',
						text: data.error || 'Gagal menghapus pengumpulan.',
						icon: 'error',
						background: '#FFF5F0',
						color: '#0D0D0D',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
							title: 'font-black uppercase tracking-widest',
							confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
						},
					});
				}
			} catch (e) {
				console.error(e);
			}
		}
	};

	useEffect(() => {
		const fetchHasil = async () => {
			try {
				const res = await fetch(`/api/tugas-online/hasil?pin=${pin}`);
				if (res.ok) {
					const data = await res.json();
					setSubmissions(data);
				}
			} catch (error) {
				console.error('Failed to fetch submissions', error);
			} finally {
				setLoading(false);
			}
		};

		fetchHasil();
	}, [pin]);

	if (loading) return <Loader />;

	const uniqueKelas = ['Semua', ...new Set(submissions.map(s => s.kelas).filter(k => k && k !== '-'))].sort();
	const filteredSubmissions = filterKelas === 'Semua' 
		? submissions 
		: submissions.filter(s => s.kelas === filterKelas);

	const formatWaktu = (waktuStr) => {
		if (!waktuStr) return '-';
		try {
			const d = new Date(waktuStr);
			if (isNaN(d.getTime())) return waktuStr;
			return d.toLocaleString('id-ID', {
				day: '2-digit',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			}).replace(/\./g, ':');
		} catch (e) {
			return waktuStr;
		}
	};

	return (
		<main className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				
				{/* Header */}
				<div className='mb-10 flex flex-col md:flex-row md:items-end justify-between bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] gap-6'>
					<div className='flex items-center gap-6'>
						<Link
							href='/tugas'
							className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
						</Link>
						<div>
							<div className="flex flex-wrap items-center gap-3 mb-1">
								<h1 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest drop-shadow-[2px_2px_0px_#F5C518]'>
									HASIL PENGUMPULAN
								</h1>
								<span className="text-sm font-black bg-[#F5C518] text-[#0D0D0D] px-3 py-1 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2 uppercase tracking-widest">
									PIN: {pin}
								</span>
							</div>
							<p className='text-[#0D0D0D] font-bold text-sm sm:text-base uppercase tracking-wider'>
								Total Terkumpul: <span className="bg-[#A3E635] px-2 py-0.5 border-[2px] border-[#0D0D0D] font-black">{submissions.length} SISWA</span>
							</p>
						</div>
					</div>

					{uniqueKelas.length > 1 && (
						<div className="flex items-center gap-3 bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]">
							<label className="text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-wider whitespace-nowrap">Filter Kelas:</label>
							<select 
								value={filterKelas}
								onChange={(e) => setFilterKelas(e.target.value)}
								className="bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] text-sm font-bold p-2 outline-none cursor-pointer shadow-[2px_2px_0px_0px_#0D0D0D] rounded-none uppercase min-w-[120px]"
							>
								{uniqueKelas.map(k => (
									<option key={k} value={k}>{k}</option>
								))}
							</select>
						</div>
					)}
				</div>

				{/* Tabel Data */}
				<div className="bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden">
					{filteredSubmissions.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-[#F5C518] border-b-[4px] border-[#0D0D0D] text-[#0D0D0D]">
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D] w-20 text-center">Absen</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D]">Nama Siswa</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D]">Kelas</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D] text-center">Waktu Kumpul</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D] text-center w-36">Nilai</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D]">Jawaban Teks</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm border-r-[3px] border-[#0D0D0D] text-center w-36">File Lampiran</th>
										<th className="p-4 font-black uppercase tracking-wider text-xs sm:text-sm text-center w-24">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y-[3px] divide-[#0D0D0D]">
									{filteredSubmissions.map((sub, idx) => (
										<tr key={idx} className="hover:bg-[#FFF5F0] transition-colors">
											<td className="p-4 text-center border-r-[3px] border-[#0D0D0D]">
												<span className="font-black text-[#0D0D0D] text-base bg-[#FFE8DC] border-[2px] border-[#0D0D0D] px-2.5 py-1 shadow-[2px_2px_0px_0px_#0D0D0D] inline-block min-w-[2.5rem]">
													{sub.absen}
												</span>
											</td>
											<td className="p-4 font-black text-[#0D0D0D] uppercase tracking-wide border-r-[3px] border-[#0D0D0D]">
												{sub.nama}
											</td>
											<td className="p-4 border-r-[3px] border-[#0D0D0D]">
												{sub.kelas && sub.kelas !== '-' ? (
													<span className="inline-block px-3 py-1 text-xs font-black uppercase tracking-wider bg-[#00A693] text-white border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-1">
														{sub.kelas}
													</span>
												) : (
													<span className="font-bold text-gray-400">-</span>
												)}
											</td>
											<td className="p-4 border-r-[3px] border-[#0D0D0D] text-center">
												<div className="inline-flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm text-[#0D0D0D]">
													<Clock className="w-4 h-4 text-[#0D0D0D] shrink-0" strokeWidth={2.5} />
													<span className="whitespace-nowrap uppercase tracking-wider">{formatWaktu(sub.waktu)}</span>
												</div>
											</td>
											<td className="p-4 border-r-[3px] border-[#0D0D0D] text-center">
												<div className="relative flex items-center justify-center">
													<button
														onClick={() => handleBeriNilai(sub)}
														disabled={savingNilaiId === sub.id}
														className="w-16 h-11 flex items-center justify-center font-black text-lg text-[#0D0D0D] bg-[#A3E635] border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
													>
														{sub.nilai !== null && sub.nilai !== undefined ? sub.nilai : '-'}
													</button>
													{savingNilaiId === sub.id && (
														<div className="absolute -right-2 w-4 h-4 border-2 border-[#0D0D0D] border-t-transparent rounded-full animate-spin"></div>
													)}
												</div>
											</td>
											<td className="p-4 border-r-[3px] border-[#0D0D0D]">
												{sub.teks ? (
													<div className="max-w-xs sm:max-w-md">
														<p className="text-sm font-semibold text-[#0D0D0D] line-clamp-2 leading-relaxed">{sub.teks}</p>
														{sub.teks.length > 80 && (
															<button 
																onClick={() => setSelectedText({nama: sub.nama, teks: sub.teks})}
																className="text-xs font-black text-[#2F80ED] uppercase tracking-wider underline underline-offset-4 hover:text-[#E8451A] mt-1 inline-block"
															>
																Baca selengkapnya
															</button>
														)}
													</div>
												) : (
													<span className="text-xs font-bold text-gray-400 uppercase tracking-wider italic">Tidak ada teks</span>
												)}
											</td>
											<td className="p-4 border-r-[3px] border-[#0D0D0D] text-center">
												{sub.file ? (
													<a
														href={sub.file}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-2 px-3 py-2 bg-[#2F80ED] text-white hover:bg-[#F5C518] hover:text-[#0D0D0D] border-[3px] border-[#0D0D0D] text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
													>
														<Download className="w-4 h-4" strokeWidth={3} /> BUKA
													</a>
												) : (
													<span className="text-xs font-bold text-gray-400">-</span>
												)}
											</td>
											<td className="p-4 text-center">
												<button
													onClick={() => handleDelete(sub.id, sub.nama)}
													className="p-2 bg-white text-[#E8451A] border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
													title="Hapus Pengumpulan"
												>
													<Trash2 className="w-4 h-4" strokeWidth={3} />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="p-16 flex flex-col items-center justify-center text-center bg-[#FF90E8]">
							<div className="w-20 h-20 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center mb-6 rotate-3">
								<FileText className="w-10 h-10 text-[#0D0D0D]" strokeWidth={2.5} />
							</div>
							<h3 className="text-2xl font-black text-[#0D0D0D] mb-2 uppercase tracking-widest">BELUM ADA PENGUMPULAN</h3>
							<p className="text-[#0D0D0D] font-bold uppercase tracking-wider text-sm max-w-sm">Belum ada siswa yang mengirimkan tugas dengan PIN ini.</p>
						</div>
					)}
				</div>

			</div>

			{/* Modal Teks Panjang */}
			{selectedText && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0D]/60">
					<div className="bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] w-full max-w-2xl overflow-hidden rounded-none">
						<div className="p-6 bg-[#F5C518] border-b-[4px] border-[#0D0D0D] flex justify-between items-center">
							<h3 className="font-black text-lg text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2">
								<FileText className="w-6 h-6 text-[#0D0D0D]" strokeWidth={3} />
								JAWABAN: {selectedText.nama}
							</h3>
							<button 
								onClick={() => setSelectedText(null)}
								className="p-1 bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0.5 active:shadow-none transition-all text-[#0D0D0D]"
							>
								<X className="w-6 h-6" strokeWidth={3} />
							</button>
						</div>
						<div className="p-6 max-h-[60vh] overflow-y-auto font-medium text-[#0D0D0D] leading-relaxed bg-[#FFF5F0]">
							<p className="whitespace-pre-wrap font-semibold text-base">{selectedText.teks}</p>
						</div>
						<div className="p-4 border-t-[4px] border-[#0D0D0D] bg-white text-right">
							<button 
								onClick={() => setSelectedText(null)}
								className="px-6 py-2.5 bg-[#E8451A] hover:bg-[#0D0D0D] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none font-black uppercase tracking-widest text-xs sm:text-sm transition-all"
							>
								TUTUP
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
