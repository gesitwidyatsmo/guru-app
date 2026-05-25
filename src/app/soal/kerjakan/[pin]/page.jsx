'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Upload, Send, CheckCircle, File, ChevronLeft } from 'lucide-react';
import Swal from 'sweetalert2';

export default function KerjakanSoal({ params }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const unwrappedParams = use(params);
	const pin = unwrappedParams.pin;
	const absenUrl = searchParams.get('absen');

	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [tugas, setTugas] = useState(null);
	const [soalDitampilkan, setSoalDitampilkan] = useState('');
	const [kasusHeaderInfo, setKasusHeaderInfo] = useState(null);

	const [siswa, setSiswa] = useState({ nama: '', kelas: '', absen: '' });
	const [jawabanTeks, setJawabanTeks] = useState('');
	const [file, setFile] = useState(null);
	const [sukses, setSukses] = useState(false);

	const [soalPGList, setSoalPGList] = useState([]);
	const [jawabanPG, setJawabanPG] = useState({});
	const [nilaiAkhir, setNilaiAkhir] = useState(null);

	useEffect(() => {
		// Ambil data siswa dari localStorage
		const nama = localStorage.getItem('siswa_nama');
		const kelas = localStorage.getItem('siswa_kelas');
		const absen = absenUrl || localStorage.getItem('siswa_absen');

		if (!nama || !kelas || !absen) {
			Swal.fire('Error', 'Data diri tidak lengkap. Silakan login kembali via portal.', 'warning');
			router.push('/soal');
			return;
		}

		setSiswa({ nama, kelas, absen });
		fetchSoal(absen);
	}, [pin, absenUrl, router]);

	const fetchSoal = async (absen) => {
		try {
			const res = await fetch('/api/soal/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin }),
			});

			const data = await res.json();

			if (res.ok) {
				setTugas(data.tugas);

				if (data.tugas.tipe_soal === 'Tunggal') {
					setSoalDitampilkan(data.tugas.soal);
				} else if (data.tugas.tipe_soal === 'Kasus') {
					const arraySoal = typeof data.tugas.soal === 'string' ? JSON.parse(data.tugas.soal || '[]') : data.tugas.soal;
					if (Array.isArray(arraySoal) && arraySoal.length > 0) {
						const numAbsen = parseInt(absen, 10);
						const validAbsen = isNaN(numAbsen) ? 1 : numAbsen;
						const indexSoal = (validAbsen - 1) % arraySoal.length;
						const soalPilihan = arraySoal[indexSoal] || arraySoal[0];
						setKasusHeaderInfo({ index: indexSoal + 1, absen: validAbsen });
						setSoalDitampilkan(soalPilihan);
					} else {
						setSoalDitampilkan('Error: Teks soal studi kasus tidak ditemukan.');
					}
				} else if (data.tugas.tipe_soal === 'PG') {
					const parsedSoal = typeof data.tugas.soal === 'string' ? JSON.parse(data.tugas.soal || '[]') : data.tugas.soal;
					setSoalPGList(parsedSoal);
				}
			} else {
				Swal.fire('Error', data.error || 'Tugas tidak ditemukan', 'error');
				router.push('/soal');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal memuat tugas', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleFileChange = (e) => {
		if (e.target.files && e.target.files[0]) {
			const selected = e.target.files[0];
			// Batasi ukuran maks 10MB
			if (selected.size > 10 * 1024 * 1024) {
				Swal.fire('File Terlalu Besar', 'Maksimal ukuran file adalah 10MB.', 'warning');
				e.target.value = '';
				return;
			}
			setFile(selected);
		}
	};

	const handleJawabanPG = (soalId, optIdx, isMultiple) => {
		setJawabanPG((prev) => {
			if (!isMultiple) {
				return { ...prev, [soalId]: [optIdx] };
			}
			const current = prev[soalId] || [];
			const newArr = current.includes(optIdx) ? current.filter((x) => x !== optIdx) : [...current, optIdx];
			return { ...prev, [soalId]: newArr };
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (tugas.tipe_soal === 'PG') {
			const unanswered = soalPGList.some((s) => !jawabanPG[s.id] || jawabanPG[s.id].length === 0);
			if (unanswered) {
				return Swal.fire('Perhatian', 'Harap isi semua soal (pilih minimal satu jawaban per soal)!', 'warning');
			}
		} else {
			if (!jawabanTeks.trim() && !file) {
				return Swal.fire('Perhatian', 'Anda harus mengisi teks jawaban ATAU mengupload file!', 'warning');
			}
		}

		setSubmitting(true);

		try {
			const formData = new FormData();
			formData.append('pin', pin);
			formData.append('namaSiswa', siswa.nama);
			formData.append('kelas', siswa.kelas);
			formData.append('noAbsen', siswa.absen);
			formData.append('tipeSoal', tugas.tipe_soal);

			if (tugas.tipe_soal === 'PG') {
				formData.append('jawabanPG', JSON.stringify(jawabanPG));
			} else {
				formData.append('jawabanTeks', jawabanTeks);
				if (file) {
					formData.append('file', file);
				}
			}

			const res = await fetch('/api/soal/submit', {
				method: 'POST',
				body: formData, // Jangan set Content-Type, biarkan browser yang atur multipart boundary
			});

			const data = await res.json();

			if (res.ok) {
				setSukses(true);
				if (data.nilai !== undefined) {
					setNilaiAkhir(data.nilai);
				}
				Swal.fire('Berhasil!', 'Tugas Anda telah terkirim.', 'success');
			} else {
				Swal.fire('Gagal', data.error || 'Terjadi kesalahan', 'error');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal mengirim tugas. Cek koneksi Anda.', 'error');
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-50 flex items-center justify-center'>
				<div className='animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		);
	}

	if (!tugas) return null;

	if (sukses) {
		return (
			<main className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
				<div className='max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100'>
					<div className='w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6'>
						<CheckCircle className='w-10 h-10' />
					</div>
					<h2 className='text-2xl font-bold text-gray-800 mb-2'>Tugas Berhasil Dikirim!</h2>
					<p className='text-gray-500 mb-6'>
						Kerja bagus, <b>{siswa.nama}</b>! Jawaban Anda sudah tersimpan dengan aman.
					</p>

					{nilaiAkhir !== null && (
						<div className='bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 transform hover:scale-105 transition-all'>
							<p className='text-indigo-600 font-bold mb-1 uppercase tracking-wider text-sm'>Nilai Akhir Anda</p>
							<div className='text-5xl font-black text-indigo-700'>{nilaiAkhir}</div>
						</div>
					)}

					<button
						onClick={() => router.push('/soal')}
						className='inline-flex items-center justify-center w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors'>
						Kembali ke Portal
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className='min-h-screen bg-gray-50 py-6 sm:py-10'>
			<div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
				{/* Top Bar Identitas */}
				<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-600 text-white rounded-2xl p-4 sm:p-6 mb-6 shadow-lg shadow-indigo-200'>
					<div>
						<p className='text-indigo-200 text-sm font-medium mb-1'>Mengerjakan sebagai:</p>
						<h2 className='text-xl sm:text-2xl font-bold'>{siswa.nama}</h2>
						<p className='text-indigo-100 mt-1 flex items-center gap-3'>
							<span>
								Kelas: <strong className='font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-md'>{siswa.kelas}</strong>
							</span>
							<span>
								No. Absen: <strong className='font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-md'>{siswa.absen}</strong>
							</span>
						</p>
					</div>
					<div className='mt-4 sm:mt-0 text-left sm:text-right'>
						<p className='text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1'>Status</p>
						<div className='inline-flex items-center gap-1.5 bg-indigo-500/50 px-3 py-1 rounded-full text-sm font-medium'>
							<span className='w-2 h-2 rounded-full bg-green-400 animate-pulse'></span>
							Sedang Dikerjakan
						</div>
					</div>
				</div>

				<div className='space-y-6'>
					{tugas.tipe_soal === 'PG' ? (
						<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8'>
							<div className='border-b border-gray-100 pb-4 mb-6'>
								<div className='flex items-center gap-2 mb-2'>
									<span className='text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md uppercase tracking-wider'>{tugas.mapel}</span>
									{tugas.materi && <span className='text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md uppercase tracking-wider'>{tugas.materi}</span>}
									<span className='text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md uppercase tracking-wider'>KUIS</span>
								</div>
								<h1 className='text-2xl font-bold text-gray-800'>{tugas.judul}</h1>
							</div>

							<form
								onSubmit={handleSubmit}
								className='space-y-8'>
								{soalPGList.map((soal, index) => (
									<div
										key={soal.id}
										className='p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100 relative'>
										<div className='absolute top-6 left-5 sm:left-6 w-8 h-8 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center shadow-sm'>{index + 1}</div>
										<div className='pl-12'>
											<div
												className='text-gray-800 font-medium mb-5 text-base sm:text-lg prose prose-indigo max-w-none break-words'
												dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
											/>
											<div className='space-y-3'>
												{soal.opsi.map((opt, optIdx) => {
													const isChecked = (jawabanPG[soal.id] || []).includes(optIdx);
													const isMultiple = Array.isArray(soal.jawabanBenar) && soal.jawabanBenar.length > 1;

													return (
														<label
															key={optIdx}
															className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${isChecked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
															onClick={(e) => {
																e.preventDefault(); // Mencegah event double fire dari label
																handleJawabanPG(soal.id, optIdx, isMultiple);
															}}>
															{isMultiple ? (
																<div
																	className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 bg-white'}`}>
																	{isChecked && (
																		<svg
																			className='w-3.5 h-3.5'
																			fill='none'
																			viewBox='0 0 24 24'
																			stroke='currentColor'
																			strokeWidth={3}>
																			<path
																				strokeLinecap='round'
																				strokeLinejoin='round'
																				d='M5 13l4 4L19 7'
																			/>
																		</svg>
																	)}
																</div>
															) : (
																<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isChecked ? 'border-indigo-500' : 'border-gray-300'}`}>
																	{isChecked && <div className='w-2.5 h-2.5 bg-indigo-500 rounded-full' />}
																</div>
															)}
															<span className='text-gray-700 font-medium'>
																{String.fromCharCode(65 + optIdx)}. {opt}
															</span>
														</label>
													);
												})}
											</div>
										</div>
									</div>
								))}

								<div className='pt-6 border-t border-gray-200'>
									<button
										type='submit'
										disabled={submitting}
										className='w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
										{submitting ? (
											<div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
										) : (
											<>
												<Send className='w-5 h-5' /> Kumpulkan Kuis & Lihat Nilai
											</>
										)}
									</button>
								</div>
							</form>
						</div>
					) : (
						<div className='space-y-6'>
							{/* Area Soal */}
							<div className='lg:col-span-7 space-y-6'>
								<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8'>
									<div className='border-b border-gray-100 pb-4 mb-6'>
										<div className='flex items-center gap-2 mb-2'>
											<span className='text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md uppercase tracking-wider'>{tugas.mapel}</span>
											{tugas.materi && <span className='text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md uppercase tracking-wider'>{tugas.materi}</span>}
										</div>
										<h1 className='text-2xl font-bold text-gray-800'>{tugas.judul}</h1>
									</div>

									{kasusHeaderInfo && (
										<div className='bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6'>
											<h3 className='text-indigo-800 font-bold text-sm uppercase tracking-wider mb-0.5'>KASUS VARIASI #{kasusHeaderInfo.index}</h3>
											<p className='text-sm text-indigo-600/80 italic'>Otomatis dibagikan berdasarkan nomor absen Anda ({kasusHeaderInfo.absen})</p>
										</div>
									)}

									<div
										className='prose prose-indigo max-w-none text-gray-700 break-words'
										dangerouslySetInnerHTML={{ __html: soalDitampilkan }}
									/>
								</div>
							</div>

							{/* Area Lembar Jawab */}
							<div className='lg:col-span-5 space-y-6'>
								<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6'>
									<h3 className='text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3'>
										<FileText className='w-5 h-5 text-indigo-500' />
										Lembar Jawaban
									</h3>

									<form
										onSubmit={handleSubmit}
										className='space-y-5'>
										{/* Teks Jawaban */}
										<div>
											<label className='block text-sm font-semibold text-gray-700 mb-1.5 '>Teks Jawaban</label>
											<textarea
												rows={5}
												value={jawabanTeks}
												onChange={(e) => setJawabanTeks(e.target.value)}
												placeholder='Ketik jawaban Anda di sini jika tidak menggunakan file...'
												className='w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y text-sm dark:text-black'
											/>
										</div>

										{/* Upload File */}
										<div>
											<label className='block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between'>
												<span>
													Upload File <span className='text-gray-400 font-normal'>(Opsional)</span>
												</span>
											</label>

											<div className='relative'>
												<input
													type='file'
													id='file-upload'
													onChange={handleFileChange}
													className='hidden'
													accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip,.rar'
												/>
												<label
													htmlFor='file-upload'
													className={`flex flex-col items-center justify-center w-full py-6 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}>
													{file ? (
														<div className='flex flex-col items-center text-center'>
															<File className='w-8 h-8 text-indigo-500 mb-2' />
															<p className='text-sm font-semibold text-indigo-700 line-clamp-1 px-4'>{file.name}</p>
															<p className='text-xs text-indigo-500 mt-1'>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
														</div>
													) : (
														<div className='flex flex-col items-center text-center'>
															<div className='w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-2'>
																<Upload className='w-5 h-5' />
															</div>
															<p className='text-sm font-medium text-gray-600 mb-1'>Klik untuk pilih file</p>
															<p className='text-xs text-gray-400'>PDF, Word, Excel, JPG (Max. 10MB)</p>
														</div>
													)}
												</label>
											</div>
										</div>

										<div className='pt-2'>
											<button
												type='submit'
												disabled={submitting}
												className='w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed'>
												{submitting ? (
													<div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
												) : (
													<>
														<Send className='w-4 h-4' /> Kumpulkan Tugas
													</>
												)}
											</button>
										</div>
									</form>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
