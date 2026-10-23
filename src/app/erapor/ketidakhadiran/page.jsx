'use client';

import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchSchoolProfile, drawKopSuratPDF, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import {
	UserCheck,
	Save,
	RefreshCw,
	AlertCircle,
	Search,
	Sparkles,
	Check,
	FileDown,
	Printer,
	Lock,
	X,
	BookOpen,
} from 'lucide-react';
import Loader from '@/app/components/loading';

export default function KetidakhadiranPage() {
	const [kelasList, setKelasList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');

	// Periode
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [students, setStudents] = useState([]);
	const [attendance, setAttendance] = useState({});
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Template Catatan Wali Kelas & Lock State
	const [templates, setTemplates] = useState([]);
	const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
	const [targetStudent, setTargetStudent] = useState(null);
	const [presetCategory, setPresetCategory] = useState('Semua');
	const [lockStatus, setLockStatus] = useState({ isLocked: false, lockedByName: '', isGlobal: false });

	useEffect(() => {
		async function fetchMaster() {
			try {
				const [resKelas, resTahun, resMyClass, pProfile, resTemplates] = await Promise.all([
					fetch('/api/kelas?only_wali=true'),
					fetch('/api/tahun-ajar'),
					fetch('/api/wali-kelas/my-class').catch(() => null),
					fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
					fetch('/api/erapor/template-catatan').catch(() => null),
				]);

				if (pProfile) setSchoolProfile(pProfile);

				if (resTemplates && resTemplates.ok) {
					const dataTpl = await resTemplates.json();
					setTemplates(dataTpl.templates || []);
				}

				let listK = [];
				if (resKelas.ok) {
					listK = (await resKelas.json()) || [];
				}

				if (listK.length === 0 && resMyClass && resMyClass.ok) {
					const myC = await resMyClass.json();
					if (myC?.kelas) {
						listK = [myC.kelas];
					}
				}

				setKelasList(listK);
				if (listK.length > 0) setSelectedKelasId(listK[0].id);

				if (resTahun.ok) {
					const dataT = await resTahun.json();
					const aktif = dataT.find((t) => t.is_aktif) || dataT[0];
					if (aktif) {
						setTahunAjaran(aktif.nama || '2026/2027');
						setSemester(aktif.semester || 1);
					}
				}
			} catch (err) {
				console.error('Error fetching master:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchMaster();
	}, []);

	const fetchAttendance = useCallback(async () => {
		if (!selectedKelasId) return;
		try {
			setLoading(true);
			const url = `/api/erapor/ketidakhadiran?kelas_id=${selectedKelasId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setStudents(json.students || []);

				const attMap = {};
				(json.students || []).forEach((s) => {
					attMap[s.siswa_id] = {
						sakit: s.sakit ?? 0,
						izin: s.izin ?? 0,
						tanpa_keterangan: s.tanpa_keterangan ?? 0,
						catatan_wali_kelas: s.catatan_wali_kelas || '',
					};
				});
				setAttendance(attMap);
			}
		} catch (err) {
			console.error('Error fetching attendance:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, semester, tahunAjaran]);

	const fetchLockStatus = useCallback(async () => {
		if (!selectedKelasId) return;
		try {
			const res = await fetch(
				`/api/erapor/lock-kelas?kelas_id=${selectedKelasId}&tahun_ajaran=${encodeURIComponent(tahunAjaran)}&semester=${semester}`
			);
			if (res.ok) {
				const data = await res.json();
				const lockInfo = data.locks?.[selectedKelasId];
				setLockStatus({
					isLocked: Boolean(data.is_locked_global || lockInfo?.is_locked_wali),
					isWaliLocked: Boolean(lockInfo?.is_locked_wali),
					lockedByName: lockInfo?.locked_by_name || (data.is_locked_global ? 'Kurikulum (Global)' : ''),
					isGlobal: Boolean(data.is_locked_global),
				});
			}
		} catch (err) {
			console.error('Error fetching lock status:', err);
		}
	}, [selectedKelasId, tahunAjaran, semester]);

	useEffect(() => {
		fetchAttendance();
		fetchLockStatus();
	}, [fetchAttendance, fetchLockStatus]);

	const openPresetModal = (siswaId, namaLengkap) => {
		setTargetStudent({ id: siswaId, name: namaLengkap });
		setIsPresetModalOpen(true);
	};

	const applyPreset = (text, applyToAllEmpty = false) => {
		if (applyToAllEmpty) {
			setAttendance((prev) => {
				const next = { ...prev };
				students.forEach((s) => {
					if (!next[s.siswa_id]?.catatan_wali_kelas || next[s.siswa_id]?.catatan_wali_kelas.trim() === '') {
						next[s.siswa_id] = {
							...(next[s.siswa_id] || { sakit: 0, izin: 0, tanpa_keterangan: 0 }),
							catatan_wali_kelas: text,
						};
					}
				});
				return next;
			});
			Swal.fire({
				icon: 'success',
				title: 'Preset Diterapkan',
				text: 'Catatan preset berhasil diterapkan ke seluruh siswa yang masih kosong.',
				timer: 1500,
				showConfirmButton: false,
			});
		} else if (targetStudent?.id) {
			setAttendance((prev) => ({
				...prev,
				[targetStudent.id]: {
					...(prev[targetStudent.id] || { sakit: 0, izin: 0, tanpa_keterangan: 0 }),
					catatan_wali_kelas: text,
				},
			}));
		}
		setIsPresetModalOpen(false);
	};

	const handleChange = (siswaId, field, rawValue) => {
		if (field === 'catatan_wali_kelas') {
			setAttendance((prev) => ({
				...prev,
				[siswaId]: {
					...prev[siswaId],
					[field]: rawValue,
				},
			}));
			return;
		}

		// Jika dikosongkan (misal dihapus dengan Backspace)
		if (rawValue === '') {
			setAttendance((prev) => ({
				...prev,
				[siswaId]: {
					...prev[siswaId],
					[field]: '',
				},
			}));
			return;
		}

		// Bersihkan karakter non-digit dan hilangkan leading zero (misal '09' -> 9)
		const clean = rawValue.replace(/[^0-9]/g, '');
		const num = clean === '' ? '' : parseInt(clean, 10);

		setAttendance((prev) => ({
			...prev,
			[siswaId]: {
				...prev[siswaId],
				[field]: num === '' || isNaN(num) ? '' : num,
			},
		}));
	};

	const handleBlur = (siswaId, field) => {
		if (field === 'catatan_wali_kelas') return;
		setAttendance((prev) => {
			const currentVal = prev[siswaId]?.[field];
			if (currentVal === '' || currentVal === null || currentVal === undefined) {
				return {
					...prev,
					[siswaId]: {
						...prev[siswaId],
						[field]: 0,
					},
				};
			}
			return prev;
		});
	};

	// 1-Klik Tarik Otomatis dari Absensi Harian (Mematuhi Aturan normStatus)
	const handleSyncFromDaily = async () => {
		try {
			setSyncing(true);
			const res = await fetch('/api/erapor/ketidakhadiran', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'sync_from_daily',
					kelas_id: selectedKelasId,
					semester,
					tahun_ajaran: tahunAjaran,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal sinkronisasi');

			const syncData = json.sync_data || {};

			// Update state attendance dengan data hasil tarik
			setAttendance((prev) => {
				const updated = { ...prev };
				students.forEach((s) => {
					const synced = syncData[s.siswa_id] || { sakit: 0, izin: 0, tanpa_keterangan: 0 };
					updated[s.siswa_id] = {
						...updated[s.siswa_id],
						sakit: synced.sakit,
						izin: synced.izin,
						tanpa_keterangan: synced.tanpa_keterangan,
					};
				});
				return updated;
			});

			Swal.fire({
				icon: 'success',
				title: 'Sinkronisasi Berhasil!',
				text: `${json.message}. Data sakit, izin, dan alpa telah disesuaikan secara otomatis.`,
			});
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal Menarik Presensi', text: err.message });
		} finally {
			setSyncing(false);
		}
	};

	// Simpan rekap absensi
	const handleSave = async () => {
		try {
			setSaving(true);
			const dataAbsensi = students.map((s) => ({
				siswa_id: s.siswa_id,
				sakit: parseInt(attendance[s.siswa_id]?.sakit || 0, 10) || 0,
				izin: parseInt(attendance[s.siswa_id]?.izin || 0, 10) || 0,
				tanpa_keterangan: parseInt(attendance[s.siswa_id]?.tanpa_keterangan || 0, 10) || 0,
				catatan_wali_kelas: attendance[s.siswa_id]?.catatan_wali_kelas || '',
			}));

			const res = await fetch('/api/erapor/ketidakhadiran', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					semester,
					tahun_ajaran: tahunAjaran,
					payload: dataAbsensi,
					data_absensi: dataAbsensi,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');

			Swal.fire({
				icon: 'success',
				title: 'Tersimpan',
				text: 'Rekap ketidakhadiran semester berhasil disimpan.',
				timer: 1500,
				showConfirmButton: false,
			});
			fetchAttendance();
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
		} finally {
			setSaving(false);
		}
	};

	// Export Rekap Ketidakhadiran ke PDF Resmi
	const handleExportPDF = () => {
		if (filteredStudents.length === 0) {
			Swal.fire('Info', 'Tidak ada data siswa untuk dicetak ke PDF', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'portrait' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			const currentKelas = kelasList.find((k) => k.id === selectedKelasId);
			const namaKelas = currentKelas?.nama_kelas || currentKelas?.kelas || 'Kelas Binaan';

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			doc.setTextColor(15, 23, 42);
			doc.text(
				'REKAPITULASI PRESENSI & KETIDAKHADIRAN SISWA',
				doc.internal.pageSize.getWidth() / 2,
				endKop + 4,
				{ align: 'center' }
			);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Kelas: ${namaKelas}   •   Semester: ${semester}   •   Tahun Pelajaran: ${tahunAjaran}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 9,
				{ align: 'center' }
			);

			let totalSakitSemua = 0;
			let totalIzinSemua = 0;
			let totalAlfaSemua = 0;

			const tableBody = filteredStudents.map((s, idx) => {
				const att = attendance[s.siswa_id] || {
					sakit: 0,
					izin: 0,
					tanpa_keterangan: 0,
					catatan_wali_kelas: '',
				};
				const sVal = Number(att.sakit) || 0;
				const iVal = Number(att.izin) || 0;
				const aVal = Number(att.tanpa_keterangan) || 0;
				const totalAbsen = sVal + iVal + aVal;

				totalSakitSemua += sVal;
				totalIzinSemua += iVal;
				totalAlfaSemua += aVal;

				return [
					idx + 1,
					s.nis || s.nisn || '-',
					s.nama_lengkap,
					sVal > 0 ? sVal : '-',
					iVal > 0 ? iVal : '-',
					aVal > 0 ? aVal : '-',
					totalAbsen > 0 ? `${totalAbsen} Hari` : '-',
					att.catatan_wali_kelas || '-',
				];
			});

			// Tambahkan baris total ketidakhadiran
			tableBody.push([
				{ content: 'TOTAL KETIDAKHADIRAN KELAS', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
				{ content: String(totalSakitSemua), styles: { halign: 'center', fontStyle: 'bold' } },
				{ content: String(totalIzinSemua), styles: { halign: 'center', fontStyle: 'bold' } },
				{ content: String(totalAlfaSemua), styles: { halign: 'center', fontStyle: 'bold' } },
				{ content: `${totalSakitSemua + totalIzinSemua + totalAlfaSemua} Hari`, styles: { halign: 'center', fontStyle: 'bold' } },
				{ content: '', styles: { halign: 'center' } },
			]);

			autoTable(doc, {
				startY: endKop + 13,
				head: [
					[
						{ content: 'No', styles: { halign: 'center' } },
						{ content: 'NIS / NISN', styles: { halign: 'center' } },
						{ content: 'Nama Siswa', styles: { halign: 'left' } },
						{ content: 'S', styles: { halign: 'center' } },
						{ content: 'I', styles: { halign: 'center' } },
						{ content: 'A', styles: { halign: 'center' } },
						{ content: 'Total', styles: { halign: 'center' } },
						{ content: 'Catatan Wali Kelas', styles: { halign: 'left' } },
					],
				],
				body: tableBody,
				theme: 'grid',
				headStyles: {
					fillColor: [245, 197, 24], // #F5C518 gold
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 8,
				},
				bodyStyles: {
					fontSize: 7.5,
					textColor: [15, 23, 42],
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { halign: 'center', cellWidth: 22 },
					2: { cellWidth: 42 },
					3: { halign: 'center', cellWidth: 10 },
					4: { halign: 'center', cellWidth: 10 },
					5: { halign: 'center', cellWidth: 10 },
					6: { halign: 'center', cellWidth: 16 },
					7: { cellWidth: 'auto' },
				},
			});

			// Bagian Tanda Tangan
			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 8;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			let signY = finalY;
			if (signY + 36 > pageHeight) {
				doc.addPage();
				signY = 20;
			}

			const todayFormatted = new Intl.DateTimeFormat('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}).format(new Date());

			doc.setFontSize(8.5);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(0, 0, 0);

			// Kiri: Mengetahui Kepala Sekolah
			doc.text('Mengetahui,', 20, signY);
			doc.text('Kepala Sekolah', 20, signY + 4.5);
			doc.setFont('helvetica', 'bold');
			doc.text(schoolProfile.nama_kepsek || '( .......................................... )', 20, signY + 24);
			doc.setFont('helvetica', 'normal');
			if (schoolProfile.nip_kepsek) {
				doc.text(`NIP. ${schoolProfile.nip_kepsek}`, 20, signY + 28);
			}

			// Kanan: Wali Kelas
			doc.text(`Batang Cenaku, ${todayFormatted}`, pageWidth - 70, signY);
			doc.text('Wali Kelas,', pageWidth - 70, signY + 4.5);
			doc.setFont('helvetica', 'bold');
			const waliName = currentKelas?.wali_kelas || '( .......................................... )';
			doc.text(waliName, pageWidth - 70, signY + 24);

			const sanitizedClass = namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
			doc.save(`Rekap_Presensi_Semester_${sanitizedClass}_${tahunAjaran.replace('/', '-')}.pdf`);
		} catch (err) {
			console.error('Gagal generate PDF presensi:', err);
			Swal.fire('Gagal', 'Terjadi kesalahan saat membuat file PDF: ' + err.message, 'error');
		}
	};

	const filteredStudents = students.filter((s) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q));
	});

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<UserCheck className='w-6 h-6 text-rose-500' />
						<span>Rekap Ketidakhadiran Semester</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Jumlah akumulasi hari Sakit (S), Izin (I), dan Tanpa Keterangan/Alfa (A) untuk dicantumkan pada lembar rapor.
					</p>
				</div>

				<div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
					{/* Tombol Cetak PDF */}
					<button
						type='button'
						onClick={handleExportPDF}
						disabled={loading || students.length === 0}
						className='px-4 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-950 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer'
						title='Cetak / Unduh Rekap Presensi Semester ke format PDF'>
						<FileDown className='w-4 h-4 text-rose-700' />
						<span>Cetak PDF</span>
					</button>

					{/* Tombol Tarik dari Absensi Harian */}
					<button
						onClick={handleSyncFromDaily}
						disabled={syncing || loading || lockStatus.isGlobal}
						className='px-4 py-2.5 bg-teal-300 hover:bg-teal-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer'
						title={lockStatus.isGlobal ? 'Terkunci Global Kurikulum' : 'Tarik akumulasi otomatis dari data absensi harian kelas'}>
						<RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
						<span>{syncing ? 'Menarik...' : 'Tarik dari Absensi Harian'}</span>
					</button>

					<button
						onClick={handleSave}
						disabled={saving || loading || students.length === 0 || lockStatus.isGlobal}
						className='px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer'
						title={lockStatus.isGlobal ? 'Terkunci Global Kurikulum' : 'Simpan catatan dan rekap ketidakhadiran'}>
						<Save className='w-4 h-4' />
						<span>{saving ? 'Menyimpan...' : 'Simpan Rekap'}</span>
					</button>
				</div>
			</div>

			{/* Banner Peringatan Jika Kelas Terkunci */}
			{lockStatus.isLocked && (
				<div className='p-4 bg-rose-50 border-3 border-rose-500 rounded-2xl shadow-[3px_3px_0px_0px_#f43f5e] flex items-center justify-between gap-3 text-rose-900'>
					<div className='flex items-center gap-3 text-xs sm:text-sm font-bold'>
						<div className='w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]'>
							<Lock className='w-5 h-5' />
						</div>
						<div>
							<div className='font-black text-rose-950 flex items-center gap-2'>
								<span>STATUS KELAS: TERKUNCI</span>
								<span className='px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-200 text-rose-800 border border-rose-400'>
									{lockStatus.isGlobal ? 'Kunci Global Kurikulum' : 'Kunci Wali Kelas'}
								</span>
							</div>
							<p className='text-xs text-rose-800 font-medium mt-0.5'>
								{lockStatus.isGlobal
									? 'Pengisian nilai dan catatan rapor sedang dikunci terpusat oleh Kurikulum.'
									: `Kelas ini telah dikunci (${lockStatus.lockedByName || 'Wali Kelas'}). Guru mapel tidak dapat mengubah nilai.`}
							</p>
						</div>
					</div>
				</div>
			)}

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat data rekap presensi & ketidakhadiran...</p>
					<p className='text-xs font-bold text-gray-500'>Menyiapkan data siswa dan catatan wali kelas</p>
				</div>
			) : (
				<>
					{/* Filter Bar */}
			<div className='p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
				<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
					<div className='flex items-center gap-2'>
						<span className='text-xs font-black uppercase text-gray-600'>Kelas Binaan:</span>
						{kelasList.length > 1 ? (
							<select
								value={selectedKelasId}
								onChange={(e) => setSelectedKelasId(e.target.value)}
								className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
								{kelasList.map((k) => (
									<option key={k.id} value={k.id}>
										{k.nama_kelas}
									</option>
								))}
							</select>
						) : kelasList.length === 1 ? (
							<span className='px-3.5 py-1 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
								{kelasList[0].nama_kelas}
							</span>
						) : loading ? (
							<span className='px-3 py-1 bg-gray-100 text-gray-600 border-2 border-dashed border-gray-400 rounded-xl text-xs font-bold animate-pulse'>
								Memuat kelas...
							</span>
						) : (
							<span className='px-3 py-1 bg-rose-100 text-rose-700 border-2 border-rose-400 rounded-xl text-xs font-bold'>
								Bukan Wali Kelas
							</span>
						)}
					</div>

					<span className='px-2.5 py-1 bg-gray-100 text-black border border-black rounded-lg text-xs font-black'>
						Semester {semester} • {tahunAjaran}
					</span>
				</div>

				<div className='relative w-full sm:w-64'>
					<Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
					<input
						type='text'
						placeholder='Cari nama siswa...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:bg-yellow-50'
					/>
				</div>
			</div>

			{/* Tabel Ketidakhadiran */}
			{kelasList.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Bukan Wali Kelas</h3>
					<p className='text-xs text-gray-500'>
						Akun Anda tidak tercatat sebagai Wali Kelas pada periode ini. Rekap ketidakhadiran hanya dapat dikelola oleh Wali Kelas binaan atau Administrator.
					</p>
				</div>
			) : filteredStudents.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Tidak Ada Siswa Ditemukan</h3>
					<p className='text-xs text-gray-500'>Pilih rombongan belajar yang terdaftar.</p>
				</div>
			) : (
				<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[650px]'>
							<thead>
								<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='p-3.5 w-12 text-center border-r-2 border-black'>No</th>
									<th className='p-3.5 border-r-2 border-black'>Nama Siswa</th>
									<th className='p-3.5 w-24 text-center border-r-2 border-black bg-blue-100'>Sakit (S)</th>
									<th className='p-3.5 w-24 text-center border-r-2 border-black bg-yellow-100'>Izin (I)</th>
									<th className='p-3.5 w-24 text-center border-r-2 border-black bg-rose-100'>Alfa (A)</th>
									<th className='p-3.5 border-r-2 border-black'>Catatan Wali Kelas</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black text-xs font-bold text-gray-900'>
								{filteredStudents.map((s, idx) => {
									const att = attendance[s.siswa_id] || { sakit: 0, izin: 0, tanpa_keterangan: 0, catatan_wali_kelas: '' };
									return (
										<tr key={s.siswa_id} className='hover:bg-yellow-50/50 transition-colors'>
											<td className='p-3.5 text-center font-black border-r-2 border-black bg-gray-50/50'>
												{idx + 1}
											</td>
											<td className='p-3.5 font-black border-r-2 border-black'>
												{s.nama_lengkap}
												<div className='text-[10px] font-mono text-gray-500'>{s.nis || s.nisn}</div>
											</td>

											{/* Sakit */}
											<td className='p-2 text-center border-r-2 border-black'>
												<input
													type='number'
													min='0'
													value={att.sakit ?? ''}
													onChange={(e) => handleChange(s.siswa_id, 'sakit', e.target.value)}
													onBlur={() => handleBlur(s.siswa_id, 'sakit')}
													onFocus={(e) => e.target.select()}
													className='w-16 px-2 py-1 text-center font-black rounded-lg border-2 border-black bg-blue-50 focus:bg-white focus:outline-none'
												/>
											</td>

											{/* Izin */}
											<td className='p-2 text-center border-r-2 border-black'>
												<input
													type='number'
													min='0'
													value={att.izin ?? ''}
													onChange={(e) => handleChange(s.siswa_id, 'izin', e.target.value)}
													onBlur={() => handleBlur(s.siswa_id, 'izin')}
													onFocus={(e) => e.target.select()}
													className='w-16 px-2 py-1 text-center font-black rounded-lg border-2 border-black bg-yellow-50 focus:bg-white focus:outline-none'
												/>
											</td>

											{/* Tanpa Keterangan / Alfa */}
											<td className='p-2 text-center border-r-2 border-black'>
												<input
													type='number'
													min='0'
													value={att.tanpa_keterangan ?? ''}
													onChange={(e) => handleChange(s.siswa_id, 'tanpa_keterangan', e.target.value)}
													onBlur={() => handleBlur(s.siswa_id, 'tanpa_keterangan')}
													onFocus={(e) => e.target.select()}
													className='w-16 px-2 py-1 text-center font-black rounded-lg border-2 border-black bg-rose-50 text-rose-800 focus:bg-white focus:outline-none'
												/>
											</td>

											{/* Catatan Wali Kelas */}
											<td className='p-2'>
												<div className='flex items-center gap-1.5'>
													<input
														type='text'
														value={att.catatan_wali_kelas}
														onChange={(e) => handleChange(s.siswa_id, 'catatan_wali_kelas', e.target.value)}
														disabled={lockStatus.isGlobal}
														placeholder='Tingkatkan ketekunan dan pertahankan prestasi belajar...'
														className='flex-1 px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-medium focus:bg-yellow-50 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed'
													/>
													<button
														type='button'
														onClick={() => openPresetModal(s.siswa_id, s.nama_lengkap)}
														disabled={lockStatus.isGlobal}
														className='px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 shrink-0 cursor-pointer'
														title='Pilih Preset Catatan Karakter'>
														<Sparkles className='w-3.5 h-3.5 text-amber-700' />
														<span>Preset</span>
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}
				</>
			)}

			{/* Modal Bank Preset Catatan Karakter */}
			{isPresetModalOpen && (
				<div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#000] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150'>
						{/* Modal Header */}
						<div className='p-4 sm:p-5 bg-yellow-300 border-b-3 border-black flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<div className='w-8 h-8 rounded-lg bg-black text-yellow-300 flex items-center justify-center font-black'>
									<Sparkles className='w-4 h-4' />
								</div>
								<div>
									<h3 className='text-base font-black text-black leading-tight'>Bank Template Catatan Karakter</h3>
									<p className='text-xs font-bold text-gray-800'>
										Target Siswa: <span className='underline font-black'>{targetStudent?.name}</span>
									</p>
								</div>
							</div>
							<button
								type='button'
								onClick={() => setIsPresetModalOpen(false)}
								className='w-8 h-8 rounded-xl bg-white hover:bg-rose-100 text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer'>
								<X className='w-4 h-4' />
							</button>
						</div>

						{/* Modal Category Filter */}
						<div className='p-3 sm:px-5 bg-gray-50 border-b-2 border-black flex items-center gap-2 overflow-x-auto'>
							<span className='text-xs font-black uppercase text-gray-500 mr-1 shrink-0'>Kategori:</span>
							{['Semua', ...Array.from(new Set(templates.map((t) => t.kategori).filter(Boolean)))].map((cat) => (
								<button
									key={cat}
									type='button'
									onClick={() => setPresetCategory(cat)}
									className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black transition-all shrink-0 cursor-pointer ${
										presetCategory === cat
											? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#F5C518]'
											: 'bg-white hover:bg-gray-100 text-black shadow-[2px_2px_0px_0px_#000]'
									}`}>
									{cat}
								</button>
							))}
						</div>

						{/* Modal Body: List of Templates */}
						<div className='p-4 sm:p-5 overflow-y-auto space-y-3 flex-1'>
							{templates
								.filter((t) => presetCategory === 'Semua' || t.kategori === presetCategory)
								.map((tpl) => (
									<div
										key={tpl.id}
										className='p-4 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#000] hover:bg-yellow-50/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
										<div className='space-y-1.5 flex-1'>
											<div className='flex items-center gap-2'>
												<span className='px-2 py-0.5 text-[10px] font-black uppercase rounded bg-gray-100 border border-black'>
													{tpl.kategori}
												</span>
												<h4 className='text-xs sm:text-sm font-black text-black'>{tpl.judul}</h4>
											</div>
											<p className='text-xs font-medium text-gray-700 leading-relaxed italic'>
												&ldquo;{tpl.isi_catatan}&rdquo;
											</p>
										</div>
										<div className='flex items-center gap-2 shrink-0 self-end sm:self-center'>
											<button
												type='button'
												onClick={() => applyPreset(tpl.isi_catatan, false)}
												className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer'>
												Gunakan
											</button>
											<button
												type='button'
												onClick={() => applyPreset(tpl.isi_catatan, true)}
												className='px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer'
												title='Terapkan teks ini ke semua siswa di kelas ini yang catatannya masih kosong'>
												Semua yg Kosong
											</button>
										</div>
									</div>
								))}

							{templates.length === 0 && (
								<div className='p-8 text-center text-gray-500 font-bold text-xs'>
									Belum ada preset template catatan. Tambahkan di menu Kurikulum &gt; Manajemen Rapor.
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='p-3 sm:px-5 bg-gray-100 border-t-2 border-black flex items-center justify-between text-xs text-gray-600 font-bold'>
							<span>Tips: Anda tetap dapat menyunting teks setelah preset diterapkan.</span>
							<button
								type='button'
								onClick={() => setIsPresetModalOpen(false)}
								className='px-4 py-1.5 bg-white hover:bg-gray-200 text-black font-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
