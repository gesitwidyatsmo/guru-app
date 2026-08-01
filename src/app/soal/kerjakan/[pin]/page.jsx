'use client';

import { useEffect, useState, use, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Upload, Send, CheckCircle, File, AlertTriangle, Monitor, Lock } from 'lucide-react';
import Swal from 'sweetalert2';

function KerjakanSoalContent({ params }) {
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

	const [siswa, setSiswa] = useState({ nama: '', kelas: '', absen: '', id: '' });
	const [jawabanTeks, setJawabanTeks] = useState('');
	const [file, setFile] = useState(null);
	const [sukses, setSukses] = useState(false);

	const [soalPGList, setSoalPGList] = useState([]);
	const [jawabanPG, setJawabanPG] = useState({});
	const [soalEssaiList, setSoalEssaiList] = useState([]);
	const [jawabanEssai, setJawabanEssai] = useState({});
	const [nilaiAkhir, setNilaiAkhir] = useState(null);
	const [allowUpload, setAllowUpload] = useState(true);

	// CBT States
	const [isCBTMode, setIsCBTMode] = useState(false);
	const [cbtState, setCbtState] = useState('none'); // 'none', 'waiting', 'running', 'warning', 'locked'
	const [violationCount, setViolationCount] = useState(0);
	const [unlockCode, setUnlockCode] = useState('');
	const [isPickingFile, setIsPickingFile] = useState(false);
	const containerRef = useRef(null);

	const saveDraft = useCallback((type, data) => {
		if (!pin || !siswa.absen) return;
		try {
			localStorage.setItem(`draft_${type}_${pin}_${siswa.absen}`, JSON.stringify(data));
		} catch (e) {}
	}, [pin, siswa.absen]);

	useEffect(() => {
		const nama = localStorage.getItem('siswa_nama');
		const kelas = localStorage.getItem('siswa_kelas');
		const absen = absenUrl || localStorage.getItem('siswa_absen');
		const id = localStorage.getItem('siswa_id');

		if (!nama || !kelas || !absen) {
			Swal.fire('Error', 'Data diri tidak lengkap. Silakan login kembali via portal.', 'warning');
			router.push('/soal');
			return;
		}

		setSiswa({ nama, kelas, absen, id });

		// Restore Drafts
		try {
			const savedTeks = localStorage.getItem(`draft_teks_${pin}_${absen}`);
			if (savedTeks) setJawabanTeks(JSON.parse(savedTeks));

			const savedPG = localStorage.getItem(`draft_pg_${pin}_${absen}`);
			if (savedPG) setJawabanPG(JSON.parse(savedPG));

			const savedEssai = localStorage.getItem(`draft_essai_${pin}_${absen}`);
			if (savedEssai) setJawabanEssai(JSON.parse(savedEssai));

			const savedViolation = localStorage.getItem(`violation_${pin}_${absen}`);
			if (savedViolation) {
				const vCount = parseInt(savedViolation, 10);
				setViolationCount(vCount);
				if (vCount >= 2) {
					setCbtState('locked');
				}
			}
		} catch (e) {}

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

				let parsedSoalPayload;
				let isAllowUpload = true;
				let cbtMode = false;
				try {
					parsedSoalPayload = typeof data.tugas.soal === 'string' ? JSON.parse(data.tugas.soal || '[]') : data.tugas.soal;
					if (parsedSoalPayload && parsedSoalPayload._wrapper) {
						isAllowUpload = parsedSoalPayload.allowUpload;
						cbtMode = !!parsedSoalPayload.isCBTMode;
						parsedSoalPayload = parsedSoalPayload.data;
					} else {
						isAllowUpload = data.tugas.tipe_soal !== 'PG' && data.tugas.tipe_soal !== 'Gabungan';
					}
				} catch(e) {
					parsedSoalPayload = data.tugas.soal;
					isAllowUpload = data.tugas.tipe_soal !== 'PG' && data.tugas.tipe_soal !== 'Gabungan';
				}

				setAllowUpload(isAllowUpload);
				setIsCBTMode(cbtMode);
				
				if (cbtMode) {
					setCbtState(prev => prev === 'locked' ? 'locked' : 'waiting');
				} else {
					setCbtState('none');
				}

				if (data.tugas.tipe_soal === 'Tunggal') {
					setSoalDitampilkan(parsedSoalPayload);
				} else if (data.tugas.tipe_soal === 'Kasus') {
					let kasusList = Array.isArray(parsedSoalPayload) ? parsedSoalPayload : [];
					const jumlahKasus = kasusList.length;
					if (jumlahKasus > 0) {
						let absenNum = parseInt(absen, 10);
						if (isNaN(absenNum)) absenNum = 1;
						const indexMod = absenNum % jumlahKasus;
						const indexSoal = indexMod === 0 ? jumlahKasus - 1 : indexMod - 1;
						setSoalDitampilkan(kasusList[indexSoal]);
						setKasusHeaderInfo({ absen: absen, index: indexSoal + 1 });
					} else {
						setSoalDitampilkan('<p>Tidak ada soal studi kasus yang tersedia.</p>');
					}
				} else if (data.tugas.tipe_soal === 'PG') {
					setSoalPGList(parsedSoalPayload);
				} else if (data.tugas.tipe_soal === 'Essai') {
					setSoalEssaiList(parsedSoalPayload);
				} else if (data.tugas.tipe_soal === 'Gabungan') {
					setSoalPGList(parsedSoalPayload.pg || []);
					setSoalEssaiList(parsedSoalPayload.essai || []);
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

	// --- CBT Mode Handlers ---
	const enterFullscreen = async () => {
		try {
			if (containerRef.current) {
				if (containerRef.current.requestFullscreen) {
					await containerRef.current.requestFullscreen();
				} else if (containerRef.current.webkitRequestFullscreen) { /* Safari */
					await containerRef.current.webkitRequestFullscreen();
				} else if (containerRef.current.msRequestFullscreen) { /* IE11 */
					await containerRef.current.msRequestFullscreen();
				}
				setCbtState('running');
			}
		} catch (err) {
			Swal.fire('Error', 'Gagal masuk layar penuh. Pastikan browser Anda mendukung fitur ini.', 'error');
		}
	};

	const recordViolation = useCallback(() => {
		if (!siswa.absen) return;
		setViolationCount(prev => {
			const next = prev + 1;
			localStorage.setItem(`violation_${pin}_${siswa.absen}`, next.toString());
			if (next >= 2) {
				setCbtState('locked');
			} else {
				setCbtState('warning');
			}
			return next;
		});
	}, [pin, siswa.absen]);

	useEffect(() => {
		if (!isCBTMode || cbtState === 'waiting' || cbtState === 'none' || cbtState === 'locked') return;

		const handleVisibilityChange = () => {
			if (document.hidden && !isPickingFile) {
				recordViolation();
			}
		};

		const handleBlur = () => {
			if (!isPickingFile) {
				recordViolation();
			}
		};

		const handleFocus = () => {
			if (isPickingFile) {
				// Beri jeda sedikit agar blur dari dialog benar-benar selesai diproses sebelum mengaktifkan penjagaan lagi
				setTimeout(() => setIsPickingFile(false), 1000);
			}
		};

		const handleFullscreenChange = () => {
			if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
				// We only record violation if they drop out of fullscreen while running or warning.
				// If they are in waiting, they are already out of fullscreen.
				if (cbtState === 'running' || cbtState === 'warning') {
					recordViolation();
				}
			}
		};

		const handleKeyDown = (e) => {
			// Blokir F5, Ctrl+R (Refresh)
			if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
				e.preventDefault();
			}
			// Blokir F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (DevTools / View Source)
			if (
				e.key === 'F12' ||
				(e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
				(e.ctrlKey && (e.key === 'U' || e.key === 'u'))
			) {
				e.preventDefault();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('blur', handleBlur);
		window.addEventListener('focus', handleFocus);
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('blur', handleBlur);
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isCBTMode, cbtState, recordViolation, isPickingFile]);

	const handleUnlock = () => {
		const expectedCode = `BUKA${pin.toUpperCase()}`;
		if (unlockCode.toUpperCase() === expectedCode) {
			setViolationCount(0);
			localStorage.removeItem(`violation_${pin}_${siswa.absen}`);
			setUnlockCode('');
			setCbtState('waiting'); // Kembali ke waiting untuk request fullscreen lagi
			Swal.fire('Berhasil', 'Ujian berhasil dibuka kembali oleh Guru.', 'success');
		} else {
			Swal.fire('Kode Salah', 'Kode buka kunci tidak valid!', 'error');
		}
	};

	// --- Input Handlers with Auto Save ---
	const handleTeksChange = (val) => {
		setJawabanTeks(val);
		saveDraft('teks', val);
	};

	const handleEssaiChange = (id, val) => {
		setJawabanEssai(prev => {
			const next = { ...prev, [id]: val };
			saveDraft('essai', next);
			return next;
		});
	};

	const handleJawabanPG = (soalId, optIdx, isMultiple) => {
		setJawabanPG((prev) => {
			let nextArr = [];
			if (!isMultiple) {
				nextArr = [optIdx];
			} else {
				const current = prev[soalId] || [];
				nextArr = current.includes(optIdx) ? current.filter((x) => x !== optIdx) : [...current, optIdx];
			}
			const next = { ...prev, [soalId]: nextArr };
			saveDraft('pg', next);
			return next;
		});
	};

	const handleFileChange = (e) => {
		if (e.target.files && e.target.files[0]) {
			const selected = e.target.files[0];
			if (selected.size > 10 * 1024 * 1024) {
				Swal.fire('File Terlalu Besar', 'Maksimal ukuran file adalah 10MB.', 'warning');
				e.target.value = '';
				return;
			}
			setFile(selected);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (tugas.tipe_soal === 'PG' || tugas.tipe_soal === 'Gabungan') {
			const unanswered = soalPGList.some((s) => !jawabanPG[s.id] || jawabanPG[s.id].length === 0);
			if (unanswered) {
				return Swal.fire('Perhatian', 'Harap isi semua soal Pilihan Ganda (pilih minimal satu jawaban per soal)!', 'warning');
			}
		} 
		
		if (tugas.tipe_soal === 'Essai' || tugas.tipe_soal === 'Gabungan') {
			const unanswered = soalEssaiList.some((s) => !jawabanEssai[s.id] || jawabanEssai[s.id].trim() === '');
			if (unanswered && !file) {
				return Swal.fire('Perhatian', allowUpload ? 'Harap isi teks jawaban untuk semua soal Essai ATAU lampirkan file jawaban!' : 'Harap isi teks jawaban untuk semua soal Essai!', 'warning');
			}
		}

		if (tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus') {
			if (!jawabanTeks.trim() && !file) {
				return Swal.fire('Perhatian', allowUpload ? 'Anda harus mengisi teks jawaban ATAU mengupload file!' : 'Anda harus mengisi teks jawaban!', 'warning');
			}
		}

		setSubmitting(true);

		try {
			const formData = new FormData();
			formData.append('pin', pin);
			formData.append('namaSiswa', siswa.nama);
			formData.append('kelas', siswa.kelas);
			formData.append('noAbsen', siswa.absen);
			if (siswa.id) formData.append('siswa_id', siswa.id);
			formData.append('tipeSoal', tugas.tipe_soal);

			if (tugas.tipe_soal === 'PG') {
				formData.append('jawabanPG', JSON.stringify(jawabanPG));
			} else if (tugas.tipe_soal === 'Essai') {
				formData.append('jawabanEssai', JSON.stringify(jawabanEssai));
				if (file) formData.append('file', file);
			} else if (tugas.tipe_soal === 'Gabungan') {
				formData.append('jawabanPG', JSON.stringify(jawabanPG));
				formData.append('jawabanEssai', JSON.stringify(jawabanEssai));
				if (file) formData.append('file', file);
			} else {
				formData.append('jawabanTeks', jawabanTeks);
				if (file) {
					formData.append('file', file);
				}
			}

			const res = await fetch('/api/soal/submit', {
				method: 'POST',
				body: formData,
			});

			const data = await res.json();

			if (res.ok) {
				// Hapus data lokal karena sudah selesai
				localStorage.removeItem(`draft_teks_${pin}_${siswa.absen}`);
				localStorage.removeItem(`draft_pg_${pin}_${siswa.absen}`);
				localStorage.removeItem(`draft_essai_${pin}_${siswa.absen}`);
				localStorage.removeItem(`violation_${pin}_${siswa.absen}`);
				// Optional: jangan hapus nama/kelas agar mereka bisa ujian lain dengan mudah

				setSukses(true);
				if (data.nilai !== undefined) {
					setNilaiAkhir(data.nilai);
				}
				
				// Keluar fullscreen
				if (document.fullscreenElement) {
					document.exitFullscreen().catch(e => console.log(e));
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
		<main ref={containerRef} className='min-h-screen bg-gray-50 relative overflow-y-auto'>
			{/* CBT OVERLAYS */}
			{isCBTMode && cbtState === 'waiting' && (
				<div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center">
					<Monitor className="w-20 h-20 text-indigo-600 mb-6" />
					<h2 className="text-3xl font-black text-gray-800 mb-4">Ujian Mode Ketat Aktif</h2>
					<p className="text-gray-600 mb-8 max-w-lg">
						Ujian ini menggunakan mode Anti-Kecurangan (CBT). Anda wajib menggunakan mode <b>Layar Penuh (Fullscreen)</b>. <br/><br/>
						Jika Anda menekan ESC, meminimize layar, atau berpindah ke tab/aplikasi lain, sistem akan mencatatnya sebagai pelanggaran.
					</p>
					<button 
						onClick={enterFullscreen}
						className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all text-lg"
					>
						Mengerti, Masuk Layar Penuh
					</button>
				</div>
			)}

			{isCBTMode && cbtState === 'warning' && (
				<div className="absolute inset-0 z-50 bg-yellow-500/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
					<AlertTriangle className="w-24 h-24 text-white mb-6" />
					<h2 className="text-4xl font-black text-white mb-4">PERINGATAN PELANGGARAN!</h2>
					<p className="text-yellow-100 mb-8 max-w-2xl text-lg font-medium">
						Anda terdeteksi keluar dari layar penuh atau berpindah fokus aplikasi. <br/><br/>
						Ini adalah Peringatan. Jika Anda mengulanginya sekali lagi atau mencoba merefresh browser (F5), <b>Ujian akan TERKUNCI</b>.
					</p>
					<button 
						onClick={() => {
							setCbtState('waiting'); // Harus masuk fullscreen lagi
						}}
						className="px-8 py-4 bg-white text-yellow-700 hover:bg-yellow-50 font-bold rounded-2xl shadow-xl transition-all text-lg"
					>
						Kembali ke Ujian
					</button>
				</div>
			)}

			{isCBTMode && cbtState === 'locked' && (
				<div className="absolute inset-0 z-50 bg-red-600 flex flex-col items-center justify-center p-6 text-center">
					<Lock className="w-24 h-24 text-white mb-6" />
					<h2 className="text-4xl font-black text-white mb-4">UJIAN TERKUNCI</h2>
					<p className="text-red-100 mb-8 max-w-2xl text-lg font-medium">
						Anda telah melanggar aturan Ujian Ketat lebih dari 1 kali. Ujian Anda kini dikunci secara paksa oleh sistem. <br/><br/>
						Silakan panggil Guru / Pengawas Anda untuk membuka kunci ini.
					</p>
					<div className="max-w-xs w-full">
						<input 
							type="password" 
							placeholder="Kode Buka Kunci (Guru)" 
							value={unlockCode}
							onChange={(e) => setUnlockCode(e.target.value)}
							className="w-full text-center px-4 py-3 bg-white/10 border-2 border-white/30 text-white placeholder-red-200 rounded-xl mb-4 font-bold outline-none focus:border-white tracking-widest"
						/>
						<button 
							onClick={handleUnlock}
							className="w-full px-6 py-3 bg-white text-red-700 hover:bg-red-50 font-bold rounded-xl shadow-lg transition-all"
						>
							Buka Kunci
						</button>
					</div>
				</div>
			)}

			<div className={`py-6 sm:py-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${(isCBTMode && cbtState !== 'running') ? 'hidden' : 'block'}`}>
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
									<span className='text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md uppercase tracking-wider'>KUIS (PG)</span>
								</div>
								<h1 className='text-2xl font-bold text-gray-800'>{tugas.judul}</h1>
							</div>

							<form onSubmit={handleSubmit} className='space-y-8'>
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
																e.preventDefault();
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
							{/* Area Soal Tunggal/Kasus/Essai/Gabungan */}
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

									{(tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus') && (
										<div
											className='prose prose-indigo max-w-none text-gray-700 break-words'
											dangerouslySetInnerHTML={{ __html: soalDitampilkan }}
										/>
									)}
								</div>
							</div>

							<form onSubmit={handleSubmit}>
								{(tugas.tipe_soal === 'Gabungan') && (
									<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6'>
										<h3 className='text-xl font-bold text-gray-800 border-b pb-2 mb-6'>Bagian 1: Pilihan Ganda</h3>
										<div className='space-y-8'>
											{soalPGList.map((soal, index) => (
												<div key={soal.id} className='p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100 relative'>
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
																			e.preventDefault();
																			handleJawabanPG(soal.id, optIdx, isMultiple);
																		}}>
																		{isMultiple ? (
																			<div
																				className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 bg-white'}`}>
																				{isChecked && (
																					<svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}>
																						<path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
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
										</div>
									</div>
								)}

								{(tugas.tipe_soal === 'Essai' || tugas.tipe_soal === 'Gabungan') && (
									<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6'>
										<h3 className='text-xl font-bold text-gray-800 border-b pb-2 mb-6'>
											{tugas.tipe_soal === 'Gabungan' ? 'Bagian 2: Essai' : 'Soal Essai'}
										</h3>
										<div className='space-y-8'>
											{soalEssaiList.map((soal, index) => (
												<div key={soal.id} className='p-5 sm:p-6 bg-blue-50 rounded-2xl border border-blue-100 relative'>
													<div className='absolute top-6 left-5 sm:left-6 w-8 h-8 bg-blue-200 text-blue-800 font-bold rounded-full flex items-center justify-center shadow-sm'>{index + 1}</div>
													<div className='pl-12'>
														<div
															className='text-gray-800 font-medium mb-4 text-base sm:text-lg prose prose-blue max-w-none break-words'
															dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
														/>
														<textarea
															rows={4}
															value={jawabanEssai[soal.id] || ''}
															onChange={(e) => handleEssaiChange(soal.id, e.target.value)}
															placeholder='Ketik jawaban Anda di sini...'
															className='w-full px-4 py-3 bg-white rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y text-sm text-gray-800'
														/>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Area Upload File / Submit Tunggal */}
								{((tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus') || allowUpload) && (
									<div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6'>
										<h3 className='text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3'>
											<FileText className='w-5 h-5 text-indigo-500' />
											{tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus' ? 'Lembar Jawaban' : 'Lampiran / Upload File'}
										</h3>

										<div className='space-y-5'>
											{(tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus') && (
												<div>
													<label className='block text-sm font-semibold text-gray-700 mb-1.5 '>Teks Jawaban</label>
													<textarea
														rows={5}
														value={jawabanTeks}
														onChange={(e) => handleTeksChange(e.target.value)}
														placeholder={allowUpload ? 'Ketik jawaban Anda di sini jika tidak menggunakan file...' : 'Ketik jawaban Anda di sini...'}
														className='w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y text-sm text-gray-800'
													/>
												</div>
											)}

											{/* Upload File */}
											{allowUpload && (
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
															onClick={() => setIsPickingFile(true)}
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
											)}

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
										</div>
									</div>
								)}

								{(!(tugas.tipe_soal === 'Tunggal' || tugas.tipe_soal === 'Kasus') && !allowUpload) && (
									<div className='mt-6 pt-2'>
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
								)}
							</form>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

export default function KerjakanSoal({ params }) {
	return (
		<Suspense fallback={
			<div className='min-h-screen bg-neo-cream flex items-center justify-center'>
				<div className='neo-card p-8 text-center'>
					<div className='text-xl font-bold'>Memuat soal...</div>
				</div>
			</div>
		}>
			<KerjakanSoalContent params={params} />
		</Suspense>
	);
}
