'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { fetchSchoolProfile, drawKopSuratPDF, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import {
	TableProperties,
	Download,
	Search,
	AlertCircle,
	FileDown,
	Info,
	Lock,
	Unlock,
} from 'lucide-react';
import Loader from '@/app/components/loading';

// Helper kode singkatan nama mata pelajaran agar muat rapi di tabel & PDF
function getMapelShortCode(name = '') {
	const raw = String(name || '').trim();
	const upper = raw.toUpperCase();

	// Custom override singkatan
	if (upper === 'INFO' || upper === 'INFORMATIKA') return 'INFOR';
	if (upper === 'SRUPA' || upper === 'SENI RUPA' || upper === 'SENI BUDAYA' || upper === 'SENI') return 'SENI';
	if (upper === 'BMKK' || upper === 'BMK' || upper === 'BELAJAR MEMBACA KITAB KUNING') return 'BMK';
	if (upper === 'MATEMATIKA' || upper === 'MTK') return 'MTK';

	const map = {
		'PENDIDIKAN AGAMA DAN BUDI PEKERTI': 'PABP',
		'PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI': 'PABP',
		'PENDIDIKAN AGAMA ISLAM': 'PAI',
		'PENDIDIKAN PANCASILA': 'PPKn',
		'PENDIDIKAN PANCASILA DAN KEWARGANEGARAAN': 'PPKn',
		'BAHASA INDONESIA': 'B.IND',
		'MATEMATIKA': 'MTK',
		'ILMU PENGETAHUAN ALAM': 'IPA',
		'IPA': 'IPA',
		'ILMU PENGETAHUAN SOSIAL': 'IPS',
		'IPS': 'IPS',
		'BAHASA INGGRIS': 'B.ING',
		'PENDIDIKAN JASMANI, OLAHRAGA, DAN KESEHATAN': 'PJOK',
		'PENDIDIKAN JASMANI OLAHRAGA DAN KESEHATAN': 'PJOK',
		'PJOK': 'PJOK',
		'INFORMATIKA': 'INFOR',
		'TIK': 'INFOR',
		'SENI BUDAYA': 'SENI',
		'SENI RUPA': 'SENI',
		'SENI MUSIK': 'SMUSIK',
		'PRAKARYA': 'PRAK',
		'BAHASA ARAB': 'B.ARB',
		'ASWAJA': 'ASWJ',
		'ASWAJA / KE-NU-AN': 'ASWJ',
		'TAHFIDZ': 'THFD',
		'BIMBINGAN KONSELING': 'BK',
		'BUDAYA MELAYU RIAU': 'BMR',
		'BUDAYA MELAYU RIAU (BMR)': 'BMR',
		'BMR': 'BMR',
		'BELAJAR MEMBACA KITAB KUNING': 'BMK',
		'BMKK': 'BMK',
		'BMK': 'BMK',
		'KHAT / KALIGRAFI': 'KHOT',
		'KHOT': 'KHOT',
		'KALIGRAFI': 'KHOT',
	};
	if (map[upper]) return map[upper];
	if (raw.length <= 6) return raw.toUpperCase();
	const words = raw.split(' ');
	if (words.length > 1) {
		return words.map((w) => w[0]).join('').toUpperCase();
	}
	return raw.slice(0, 5).toUpperCase();
}

export default function RekapLegerPage() {
	const [kelasList, setKelasList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');

	// Periode
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [legerData, setLegerData] = useState(null);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [lockStatus, setLockStatus] = useState({ isLocked: false, lockedByName: '', isGlobal: false });
	const [togglingLock, setTogglingLock] = useState(false);

	useEffect(() => {
		async function fetchMaster() {
			try {
				const [resKelas, resTahun, resMyClass, pProfile] = await Promise.all([
					fetch('/api/kelas?only_wali=true'),
					fetch('/api/tahun-ajar'),
					fetch('/api/wali-kelas/my-class').catch(() => null),
					fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
				]);

				if (pProfile) setSchoolProfile(pProfile);

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

	const fetchLeger = useCallback(async () => {
		if (!selectedKelasId) return;
		try {
			setLoading(true);
			const url = `/api/erapor/leger?kelas_id=${selectedKelasId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setLegerData(json);
			}
		} catch (err) {
			console.error('Error fetching leger:', err);
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
		fetchLeger();
		fetchLockStatus();
	}, [fetchLeger, fetchLockStatus]);

	const handleToggleLock = async () => {
		if (lockStatus.isGlobal) {
			Swal.fire({
				title: 'Kunci Terpusat (Global)',
				text: 'Nilai seluruh sekolah sedang dikunci oleh Kurikulum. Wali kelas tidak dapat membuka kunci sampai dibuka oleh Kurikulum.',
				icon: 'info',
			});
			return;
		}

		const willLock = !lockStatus.isWaliLocked;
		const confirm = await Swal.fire({
			title: willLock ? 'Kunci Nilai Kelas Ini?' : 'Buka Kunci Nilai?',
			html: willLock
				? 'Setelah dikunci, <b>guru mata pelajaran tidak dapat lagi mengubah nilai</b> di kelas ini sampai kunci dibuka kembali oleh Anda atau Kurikulum. Gunakan ini setelah seluruh nilai tuntas diperiksa.'
				: 'Membuka kunci akan memperbolehkan guru mata pelajaran mengedit kembali nilai siswa di kelas ini.',
			icon: willLock ? 'warning' : 'question',
			showCancelButton: true,
			confirmButtonColor: willLock ? '#000' : '#10b981',
			cancelButtonColor: '#d33',
			confirmButtonText: willLock ? 'Ya, Kunci Nilai' : 'Ya, Buka Kunci',
			cancelButtonText: 'Batal',
		});

		if (!confirm.isConfirmed) return;

		try {
			setTogglingLock(true);
			const res = await fetch('/api/erapor/lock-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					tahun_ajaran: tahunAjaran,
					semester: semester,
					lock: willLock,
				}),
			});

			if (res.ok) {
				Swal.fire('Berhasil', willLock ? 'Nilai kelas berhasil dikunci!' : 'Kunci nilai berhasil dibuka!', 'success');
				fetchLockStatus();
			} else {
				const err = await res.json();
				Swal.fire('Gagal', err.error || 'Terjadi kesalahan saat mengubah status kunci', 'error');
			}
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setTogglingLock(false);
		}
	};

	// Ekspor ke Excel
	const handleExportExcel = () => {
		const listSiswa = legerData?.students || legerData?.rows || [];
		if (!legerData || listSiswa.length === 0) return;

		const mapels = legerData.mapel_list || legerData.mapel || [];
		const rows = listSiswa.map((s, idx) => {
			const rowObj = {
				No: idx + 1,
				NIS: s.nis || '-',
				NISN: s.nisn || '-',
				'Nama Siswa': s.nama_lengkap,
				'L/P': s.jenis_kelamin?.startsWith('P') ? 'P' : 'L',
			};

			mapels.forEach((m) => {
				rowObj[m.mapel || m.nama_resmi] = s.nilai?.[m.id] ?? '-';
			});

			rowObj['Total Nilai'] = s.total ?? s.total_nilai ?? '-';
			rowObj['Rata-rata'] = s.rata_rata ?? '-';
			rowObj['Peringkat'] = s.peringkat ?? s.ranking ?? '-';

			return rowObj;
		});

		const worksheet = XLSX.utils.json_to_sheet(rows);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Leger Nilai');

		const namaKelas = legerData.kelas?.nama_kelas?.replace(/[^a-zA-Z0-9]/g, '_') || 'Kelas';
		const filename = `Leger_Nilai_${namaKelas}_Sem${semester}_${tahunAjaran.replace('/', '-')}.xlsx`;
		XLSX.writeFile(workbook, filename);
	};

	// Ekspor Leger ke PDF Resmi Landscape
	const handleExportPDF = () => {
		const listSiswa = legerData?.students || legerData?.rows || [];
		if (!legerData || listSiswa.length === 0) {
			Swal.fire('Info', 'Tidak ada data nilai untuk dicetak ke PDF', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			const currentKelas = kelasList.find((k) => k.id === selectedKelasId);
			const namaKelas = currentKelas?.nama_kelas || currentKelas?.kelas || legerData?.kelas?.nama_kelas || 'Kelas';
			const waliNama = currentKelas?.wali_kelas || legerData?.kelas?.wali?.nama_lengkap || '-';

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text(
				'LEGER NILAI HASIL BELAJAR SISWA (E-RAPOR)',
				doc.internal.pageSize.getWidth() / 2,
				endKop + 3,
				{ align: 'center' }
			);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Kelas: ${namaKelas}   •   Semester: ${semester}   •   Tahun Pelajaran: ${tahunAjaran}   •   Wali Kelas: ${waliNama}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 7,
				{ align: 'center' }
			);

			const mapels = legerData.mapel_list || legerData.mapel || [];
			const mapelHeaders = mapels.map((m) => getMapelShortCode(m.mapel || m.nama_resmi));

			const headRow = [
				{ content: 'No', styles: { halign: 'center' } },
				{ content: 'NIS', styles: { halign: 'center' } },
				{ content: 'Nama Siswa', styles: { halign: 'left' } },
				{ content: 'L/P', styles: { halign: 'center' } },
				...mapelHeaders.map((h) => ({ content: h, styles: { halign: 'center' } })),
				{ content: 'Total', styles: { halign: 'center' } },
				{ content: 'Rata²', styles: { halign: 'center' } },
				{ content: 'Rank', styles: { halign: 'center' } },
			];

			// Hitung akumulasi statistik mapel
			const mapelTotals = {};
			const mapelCounts = {};
			mapels.forEach((m) => {
				mapelTotals[m.id] = 0;
				mapelCounts[m.id] = 0;
			});

			const tableBody = listSiswa.map((s, idx) => {
				const row = [
					idx + 1,
					s.nis || '-',
					s.nama_lengkap,
					s.jenis_kelamin?.startsWith('P') ? 'P' : 'L',
				];

				mapels.forEach((m) => {
					const val = s.nilai?.[m.id];
					if (val !== undefined && val !== null && !isNaN(val)) {
						mapelTotals[m.id] += Number(val);
						mapelCounts[m.id] += 1;
						row.push(Number(val));
					} else {
						row.push('-');
					}
				});

				row.push(s.total ?? s.total_nilai ?? '-');
				row.push(s.rata_rata ?? '-');
				row.push(s.peringkat ?? s.ranking ?? '-');
				return row;
			});

			// Tambahkan baris rata-rata kelas per mapel
			const avgRow = [
				{ content: 'RATA-RATA KELAS', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 247, 240] } },
			];
			mapels.forEach((m) => {
				const count = mapelCounts[m.id] || 0;
				const avg = count > 0 ? (mapelTotals[m.id] / count).toFixed(1) : '-';
				avgRow.push({ content: String(avg), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 247, 240] } });
			});
			avgRow.push({ content: '', colSpan: 3, styles: { fillColor: [248, 247, 240] } });
			tableBody.push(avgRow);

			autoTable(doc, {
				startY: endKop + 10,
				head: [headRow],
				body: tableBody,
				theme: 'grid',
				headStyles: {
					fillColor: [245, 197, 24],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 7,
				},
				bodyStyles: {
					fontSize: 6.5,
					textColor: [15, 23, 42],
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 7 },
					1: { halign: 'center', cellWidth: 16 },
					2: { cellWidth: 38 },
					3: { halign: 'center', cellWidth: 8 },
				},
				didParseCell: (data) => {
					if (data.section === 'body' && data.column.index >= 4) {
						data.cell.styles.halign = 'center';
					}
				},
			});

			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 6;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			let signY = finalY;
			if (signY + 30 > pageHeight) {
				doc.addPage();
				signY = 16;
			}

			const todayFormatted = new Intl.DateTimeFormat('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}).format(new Date());

			doc.setFontSize(8);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(0, 0, 0);

			// Kiri: Mengetahui Kepala Sekolah
			doc.text('Mengetahui,', 24, signY);
			doc.text('Kepala Sekolah', 24, signY + 4);
			doc.setFont('helvetica', 'bold');
			doc.text(schoolProfile.nama_kepsek || '( .......................................... )', 24, signY + 20);
			doc.setFont('helvetica', 'normal');
			if (schoolProfile.nip_kepsek) {
				doc.text(`NIP. ${schoolProfile.nip_kepsek}`, 24, signY + 24);
			}

			// Kanan: Wali Kelas
			doc.text(`Batang Cenaku, ${todayFormatted}`, pageWidth - 70, signY);
			doc.text('Wali Kelas,', pageWidth - 70, signY + 4);
			doc.setFont('helvetica', 'bold');
			doc.text(waliNama, pageWidth - 70, signY + 20);

			const sanitizedClass = namaKelas.replace(/[^a-zA-Z0-9_-]/g, '_');
			doc.save(`Leger_Nilai_${sanitizedClass}_Semester_${semester}_${tahunAjaran.replace('/', '-')}.pdf`);
		} catch (err) {
			console.error('Gagal generate PDF leger:', err);
			Swal.fire('Gagal', 'Terjadi kesalahan saat membuat file PDF: ' + err.message, 'error');
		}
	};

	const students = useMemo(() => legerData?.students || legerData?.rows || [], [legerData]);
	const mapelList = legerData?.mapel_list || legerData?.mapel || [];

	const filteredStudents = useMemo(() => {
		if (!searchQuery.trim()) return students;
		const q = searchQuery.toLowerCase();
		return students.filter(
			(s) => s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q))
		);
	}, [students, searchQuery]);

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<TableProperties className='w-6 h-6 text-[#E8451A]' />
						<span>Matriks Leger Nilai Rombel</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Rekapitulasi nilai kuantitatif seluruh mata pelajaran, total skor, rata-rata, dan peringkat kelas.
					</p>
				</div>
				<div className='flex items-center gap-2 flex-wrap'>
					<button
						type='button'
						onClick={handleToggleLock}
						disabled={loading || togglingLock || !selectedKelasId || kelasList.length === 0}
						className={`px-4 py-2 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer ${
							lockStatus.isLocked
								? 'bg-rose-500 hover:bg-rose-600 text-white'
								: 'bg-amber-300 hover:bg-amber-400 text-black'
						}`}
						title={
							lockStatus.isLocked
								? `Nilai kelas ini terkunci (${lockStatus.lockedByName || 'Wali Kelas'}). Klik untuk membuka kunci.`
								: 'Kunci nilai rombel agar tidak dapat diubah oleh guru mapel'
						}>
						{lockStatus.isLocked ? <Lock className='w-4 h-4' /> : <Unlock className='w-4 h-4' />}
						<span>{lockStatus.isLocked ? 'Kelas Terkunci' : 'Kunci Nilai'}</span>
					</button>
					<button
						type='button'
						onClick={handleExportPDF}
						disabled={loading || students.length === 0}
						className='px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-950 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer'
						title='Cetak / Unduh Leger Nilai ke format PDF resmi'>
						<FileDown className='w-4 h-4 text-rose-700' />
						<span>Unduh PDF</span>
					</button>
					<button
						onClick={handleExportExcel}
						disabled={loading || students.length === 0}
						className='px-4 py-2 bg-emerald-300 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer'>
						<Download className='w-4 h-4' />
						<span>Unduh Excel</span>
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
								<span>STATUS KELAS: TERKUNCI (READ-ONLY)</span>
								<span className='px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-200 text-rose-800 border border-rose-400'>
									{lockStatus.isGlobal ? 'Kunci Global Kurikulum' : 'Kunci Wali Kelas'}
								</span>
							</div>
							<p className='text-xs text-rose-800 font-medium mt-0.5'>
								Seluruh guru mata pelajaran tidak dapat lagi mengubah nilai di kelas ini. Status dikunci oleh:{' '}
								<strong>{lockStatus.lockedByName || 'Wali Kelas'}</strong>.
							</p>
						</div>
					</div>
					{!lockStatus.isGlobal && (
						<button
							type='button'
							onClick={handleToggleLock}
							disabled={togglingLock}
							className='px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all shrink-0 cursor-pointer'>
							Buka Kunci
						</button>
					)}
				</div>
			)}

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat matriks leger nilai kelas...</p>
					<p className='text-xs font-bold text-gray-500'>Mengkalkulasi rekap nilai seluruh mapel dan peringkat siswa</p>
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
						) : (kelasList[0]?.nama_kelas || legerData?.kelas?.nama_kelas) ? (
							<span className='px-3.5 py-1 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
								{kelasList[0]?.nama_kelas || legerData?.kelas?.nama_kelas}
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

					{legerData?.kelas?.wali?.nama_lengkap && (
						<span className='text-xs font-bold text-gray-600'>
							Wali Kelas: <strong className='text-black'>{legerData.kelas.wali.nama_lengkap}</strong>
						</span>
					)}
				</div>

				<div className='relative w-full sm:w-64'>
					<Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
					<input
						type='text'
						placeholder='Cari siswa...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:bg-yellow-50'
					/>
				</div>
			</div>

			{/* Matriks Leger Tabel */}
			{kelasList.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Bukan Wali Kelas</h3>
					<p className='text-xs text-gray-500'>
						Akun Anda tidak tercatat sebagai Wali Kelas pada periode ini. Rekapitulasi leger nilai hanya dapat diakses oleh Wali Kelas binaan atau Administrator.
					</p>
				</div>
			) : students.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
					<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Tidak Ada Data Nilai</h3>
					<p className='text-xs text-gray-500'>Guru mapel belum menginputkan nilai untuk rombel ini.</p>
				</div>
			) : (
				<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-max min-w-full text-left border-collapse text-xs'>
							<thead>
								<tr className='bg-yellow-300 border-b-2 border-black font-black uppercase text-black'>
									<th className='w-12 min-w-[48px] max-w-[48px] p-2.5 text-center border-r-2 border-black sticky left-0 bg-yellow-300 z-20'>
										No
									</th>
									<th className='w-60 min-w-[240px] max-w-[240px] p-2.5 border-r-2 border-black sticky left-12 bg-yellow-300 z-20 shadow-[2px_0px_0px_#000]'>
										Nama Siswa
									</th>
									<th className='w-12 min-w-[48px] max-w-[48px] p-2.5 text-center border-r-2 border-black'>
										L/P
									</th>
									{mapelList.map((m) => {
										const label = getMapelShortCode(m.mapel || m.nama_resmi);
										const fullTitle = m.nama_resmi && m.nama_resmi !== m.mapel 
											? `${m.nama_resmi} (${m.mapel})` 
											: (m.nama_resmi || m.mapel);
										return (
											<th
												key={m.id}
												className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black'
												title={fullTitle}>
												<span className='block truncate text-[11px] font-black' title={fullTitle}>
													{label}
												</span>
											</th>
										);
									})}
									<th className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black bg-blue-100'>
										Total
									</th>
									<th className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black bg-amber-100'>
										Rata-rata
									</th>
									<th className='w-16 min-w-[64px] max-w-[64px] p-2 text-center bg-emerald-100'>
										Rank
									</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black font-bold text-gray-900'>
								{filteredStudents.map((s, idx) => (
									<tr key={s.siswa_id} className='group hover:bg-yellow-50/60 transition-colors'>
										<td className='w-12 min-w-[48px] max-w-[48px] p-2.5 text-center font-black border-r-2 border-black sticky left-0 bg-white group-hover:bg-yellow-50 transition-colors z-10'>
											{idx + 1}
										</td>
										<td
											className='w-60 min-w-[240px] max-w-[240px] p-2.5 font-black border-r-2 border-black sticky left-12 bg-white group-hover:bg-yellow-50 transition-colors z-10 shadow-[2px_0px_0px_#000] truncate'
											title={s.nama_lengkap}>
											{s.nama_lengkap}
										</td>
										<td className='w-12 min-w-[48px] max-w-[48px] p-2.5 text-center border-r-2 border-black'>
											{s.jenis_kelamin?.startsWith('P') ? 'P' : 'L'}
										</td>
										{mapelList.map((m) => {
											const val = s.nilai[m.id];
											return (
												<td
													key={m.id}
													className={`w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black font-mono ${
														val === null ? 'text-gray-300 italic' : val < 70 ? 'text-rose-600 font-black' : ''
													}`}>
													{val ?? '-'}
												</td>
											);
										})}
										<td className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black font-mono font-black bg-blue-50/50'>
											{s.total ?? '-'}
										</td>
										<td className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black font-mono font-black bg-amber-50/50'>
											{s.rata_rata ?? '-'}
										</td>
										<td className='w-16 min-w-[64px] max-w-[64px] p-2 text-center font-black bg-emerald-50/50'>
											{s.peringkat !== '-' ? (
												<span className='px-2 py-0.5 bg-emerald-200 border border-black rounded-md'>
													{s.peringkat}
												</span>
											) : (
												'-'
											)}
										</td>
									</tr>
								))}
							</tbody>
							{filteredStudents.length > 0 && (
								<tfoot className='border-t-2 border-black font-black text-black bg-yellow-100'>
									<tr>
										<td className='w-12 min-w-[48px] max-w-[48px] p-2 text-center border-r-2 border-black sticky left-0 bg-yellow-100 z-10 font-black'>
											—
										</td>
										<td className='w-60 min-w-[240px] max-w-[240px] p-2.5 text-right uppercase tracking-wider text-xs border-r-2 border-black sticky left-12 bg-yellow-100 z-10 shadow-[2px_0px_0px_#000] font-black'>
											Rata-rata Kelas
										</td>
										<td className='w-12 min-w-[48px] max-w-[48px] p-2 text-center border-r-2 border-black font-bold'>
											—
										</td>
										{mapelList.map((m) => {
											let totalMapel = 0;
											let countMapel = 0;
											filteredStudents.forEach((s) => {
												const val = s.nilai?.[m.id];
												if (val !== undefined && val !== null && !isNaN(val)) {
													totalMapel += Number(val);
													countMapel += 1;
												}
											});
											const avg = countMapel > 0 ? (totalMapel / countMapel).toFixed(1) : '-';
											return (
												<td
													key={m.id}
													className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black font-mono font-black text-xs text-blue-900'>
													{avg}
												</td>
											);
										})}
										<td className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black bg-blue-100/50 text-gray-500 font-bold'>
											—
										</td>
										<td className='w-20 min-w-[80px] max-w-[80px] p-2 text-center border-r-2 border-black bg-amber-100/50 text-gray-500 font-bold'>
											—
										</td>
										<td className='w-16 min-w-[64px] max-w-[64px] p-2 text-center bg-emerald-100/50 text-gray-500 font-bold'>
											—
										</td>
									</tr>
								</tfoot>
							)}
						</table>
					</div>
					<div className='p-3 bg-gray-50 border-t-2 border-black flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 font-medium'>
						<div className='flex items-center gap-2'>
							<Info className='w-4 h-4 text-blue-600 shrink-0' />
							<span>Arahkan kursor pada singkatan kode mapel di atas untuk melihat nama lengkap mata pelajaran.</span>
						</div>
						<div className='flex items-center gap-4 text-xs font-bold'>
							<span>Total Siswa: <strong className='text-black font-black'>{filteredStudents.length}</strong></span>
							<span>Total Mapel: <strong className='text-black font-black'>{mapelList.length}</strong></span>
						</div>
					</div>
				</div>
			)}
				</>
			)}
		</div>
	);
}
