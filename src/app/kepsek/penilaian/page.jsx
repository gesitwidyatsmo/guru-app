'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
} from '@/lib/pdfKopSurat';

// Ekstraksi tingkat jenjang kelas (VII, VIII, IX) dari nama rombel
export const getTingkatKelas = (kelasStr) => {
	const s = String(kelasStr || '').trim().toUpperCase();
	if (s.startsWith('VII.') || s.startsWith('VII ') || s === 'VII' || s.startsWith('7')) return 'VII';
	if (s.startsWith('VIII.') || s.startsWith('VIII ') || s === 'VIII' || s.startsWith('8')) return 'VIII';
	if (s.startsWith('IX.') || s.startsWith('IX ') || s === 'IX' || s.startsWith('9')) return 'IX';
	if (s.includes('VII')) return 'VII';
	if (s.includes('VIII')) return 'VIII';
	if (s.includes('IX')) return 'IX';
	return 'VII';
};

// Default baseline KKTP/KKM jika mapel tertentu belum memiliki entri spesifik
const DEFAULT_KKTP_BY_TINGKAT = {
	VII: 70,
	VIII: 72,
	IX: 75,
};

// Dapatkan nilai KKM/KKTP yang akurat untuk tugas berdasarkan Mapel dan Jenjang Kelas
export const getTaskKKM = (task, kktpMap = {}) => {
	const tingkat = getTingkatKelas(task?.kelas);
	const mapelName = String(task?.mapel || '').toLowerCase().trim();
	const key = `${mapelName}_${tingkat}`;
	const val = kktpMap[key];
	if (val !== undefined && val !== null && !isNaN(Number(val))) {
		return Number(val);
	}
	return DEFAULT_KKTP_BY_TINGKAT[tingkat] || 70;
};

export const getKategoriBadgeStyle = (kat) => {
	const k = String(kat || '').toLowerCase();
	if (k.includes('sumatif') || k.includes('sts') || k.includes('sas') || k.includes('pas') || k.includes('pts')) {
		return 'bg-purple-100 text-purple-900 border-purple-800';
	}
	if (k.includes('formatif')) {
		return 'bg-teal-100 text-teal-900 border-teal-800';
	}
	if (k.includes('ulangan') || k.includes('uh') || k.includes('harian')) {
		return 'bg-amber-100 text-amber-900 border-amber-800';
	}
	if (k.includes('tugas') || k.includes('pr') || k.includes('proyek')) {
		return 'bg-yellow-100 text-yellow-900 border-yellow-800';
	}
	return 'bg-slate-100 text-slate-900 border-slate-800';
};

export default function KepsekPenilaianPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [tasks, setTasks] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [kktpList, setKktpList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterMapel, setFilterMapel] = useState('Semua');
	const [filterKategori, setFilterKategori] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTask, setSelectedTask] = useState(null);
	const [modalSearch, setModalSearch] = useState('');

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	useEffect(() => {
		const fetchPenilaianData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resTasks, resKelas, resMapel, resProfil, resKktp] = await Promise.all([
					supabase
						.from('nilai_tugas')
						.select('*, users!nilai_tugas_guru_id_fkey(nama_lengkap, username), nilai_siswa(id, nilai, siswa_id, nama_siswa)')
						.order('tanggal', { ascending: false }),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
					fetch('/api/kktp').catch(() => ({ ok: false })),
				]);

				setTasks(resTasks.data || []);
				setKelasList(resKelas.data || []);
				setMapelList(resMapel.data || []);

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}

				if (resKktp && resKktp.ok) {
					const kData = await resKktp.json();
					setKktpList(Array.isArray(kData) ? kData : []);
				}
			} catch (err) {
				console.error('Gagal memuat rekap nilai:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchPenilaianData();
	}, []);

	// Peta KKTP/KKM berdasarkan nama mapel dan tingkat kelas
	const kktpMap = useMemo(() => {
		const map = {};
		kktpList.forEach((item) => {
			const tingkat = String(item.tingkat_kelas || '').toUpperCase().trim();
			const val = item.nilai_kktp;
			if (item.mapel?.mapel) {
				map[`${String(item.mapel.mapel).toLowerCase().trim()}_${tingkat}`] = val;
			}
			if (item.mapel_id) {
				map[`${String(item.mapel_id).toLowerCase().trim()}_${tingkat}`] = val;
			}
		});
		return map;
	}, [kktpList]);

	// Reset pagination on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterMapel, filterKategori, searchQuery]);

	// Extract unique kategori list from database tasks
	const kategoriOptions = useMemo(() => {
		const set = new Set();
		tasks.forEach((t) => {
			if (t.kategori && t.kategori.trim()) {
				set.add(t.kategori.trim());
			}
		});
		return Array.from(set).sort();
	}, [tasks]);

	// Filter Data
	const filteredTasks = useMemo(() => {
		return tasks.filter((t) => {
			const matchKelas = filterKelas === 'Semua' || t.kelas === filterKelas;
			const matchMapel = filterMapel === 'Semua' || t.mapel === filterMapel;
			const matchKat = filterKategori === 'Semua' || t.kategori === filterKategori;

			const q = searchQuery.toLowerCase().trim();
			const desc = t.deskripsi?.toLowerCase() || '';
			const guruName = t.users?.nama_lengkap?.toLowerCase() || '';
			const matchSearch =
				!q ||
				desc.includes(q) ||
				guruName.includes(q) ||
				(t.mapel && t.mapel.toLowerCase().includes(q)) ||
				(t.kelas && t.kelas.toLowerCase().includes(q)) ||
				(t.kategori && t.kategori.toLowerCase().includes(q));

			return matchKelas && matchMapel && matchKat && matchSearch;
		});
	}, [tasks, filterKelas, filterMapel, filterKategori, searchQuery]);

	// Statistik Komprehensif (Menggunakan KKM spesifik masing-masing mapel & kelas)
	const overallStats = useMemo(() => {
		let totalScore = 0;
		let scoreCount = 0;
		let highest = 0;
		let passCount = 0;

		tasks.forEach((t) => {
			const taskKkm = getTaskKKM(t, kktpMap);
			(t.nilai_siswa || []).forEach((s) => {
				const val = parseFloat(s.nilai);
				if (!isNaN(val)) {
					totalScore += val;
					scoreCount++;
					if (val > highest) highest = val;
					if (val >= taskKkm) passCount++;
				}
			});
		});

		const avg = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 0;
		const passRate = scoreCount > 0 ? Math.round((passCount / scoreCount) * 100) : 0;

		return {
			totalTugas: tasks.length,
			totalSiswaDinilai: scoreCount,
			rataRata: avg,
			ketuntasan: passRate,
			tertinggi: highest,
		};
	}, [tasks, kktpMap]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredTasks.length / itemsPerPage));
	const paginatedTasks = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredTasks.slice(start, start + itemsPerPage);
	}, [filteredTasks, currentPage]);

	// Filter active check
	const isFilterActive =
		Boolean(searchQuery.trim()) ||
		filterKelas !== 'Semua' ||
		filterMapel !== 'Semua' ||
		filterKategori !== 'Semua';

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterKelas('Semua');
		setFilterMapel('Semua');
		setFilterKategori('Semua');
	};

	// Export to PDF with Kop Surat Resmi (Memuat KKM spesifik per jenjang & mapel)
	const handleExportPDF = () => {
		if (filteredTasks.length === 0) {
			Swal.fire('Info', 'Tidak ada data penilaian untuk diekspor.', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text('LAPORAN REKAPITULASI PENILAIAN AKADEMIK SISWA', doc.internal.pageSize.getWidth() / 2, endKop + 2, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${filterKelas}  •  Filter Mapel: ${filterMapel}  •  Kategori: ${filterKategori}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const tableHead = [
				['No', 'Tanggal', 'Deskripsi Penilaian', 'Guru Pengampu', 'Kelas', 'Mata Pelajaran', 'Kategori', 'KKM', 'Jml Siswa', 'Rata-rata', '% Tuntas'],
			];

			const tableBody = filteredTasks.map((t, idx) => {
				const taskKkm = getTaskKKM(t, kktpMap);
				const scores = (t.nilai_siswa || []).map((s) => parseFloat(s.nilai)).filter((v) => !isNaN(v));
				const taskAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
				const passRate = scores.length > 0 ? Math.round((scores.filter((v) => v >= taskKkm).length / scores.length) * 100) : 0;

				return [
					idx + 1,
					t.tanggal || '-',
					t.deskripsi || '-',
					t.users?.nama_lengkap || '-',
					t.kelas || '-',
					t.mapel || '-',
					t.kategori || '-',
					taskKkm,
					scores.length,
					taskAvg,
					`${passRate}%`,
				];
			});

			autoTable(doc, {
				startY: endKop + 10,
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
				bodyStyles: { fontSize: 7, textColor: [15, 23, 42] },
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { halign: 'center', cellWidth: 18 },
					2: { fontStyle: 'bold' },
					4: { halign: 'center', cellWidth: 14 },
					6: { halign: 'center', cellWidth: 16 },
					7: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
					8: { halign: 'center', cellWidth: 14 },
					9: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
					10: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
				},
			});

			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 8;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			if (finalY + 28 <= pageHeight) {
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				const kepsekName = schoolProfile.nama_kepsek || 'Kepala Sekolah';
				const kepsekNip = schoolProfile.nip_kepsek ? `\nNIP. ${schoolProfile.nip_kepsek}` : '';
				doc.text(
					`Mengetahui & Menyetujui,\nKepala Sekolah\n\n\n\n${kepsekName}${kepsekNip}`,
					pageWidth - 70,
					finalY
				);
			}

			doc.save(`Rekap_Nilai_Akademik_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (err) {
			console.error('Gagal export PDF penilaian:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredTasks.length === 0) return;

		const headers = [
			'Tanggal',
			'Deskripsi Penilaian',
			'Guru Pengampu',
			'Kelas',
			'Mata Pelajaran',
			'Kategori',
			'KKM Mapel',
			'Jumlah Siswa Dinilai',
			'Rata-rata Nilai',
			'Persentase Ketuntasan (%)',
		];

		const rows = filteredTasks.map((t) => {
			const taskKkm = getTaskKKM(t, kktpMap);
			const scores = (t.nilai_siswa || []).map((s) => parseFloat(s.nilai)).filter((v) => !isNaN(v));
			const taskAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
			const passRate = scores.length > 0 ? Math.round((scores.filter((v) => v >= taskKkm).length / scores.length) * 100) : 0;

			return [
				t.tanggal || '',
				`"${(t.deskripsi || '').replace(/"/g, '""')}"`,
				`"${(t.users?.nama_lengkap || '').replace(/"/g, '""')}"`,
				`"${(t.kelas || '').replace(/"/g, '""')}"`,
				`"${(t.mapel || '').replace(/"/g, '""')}"`,
				`"${(t.kategori || '-').replace(/"/g, '""')}"`,
				taskKkm,
				scores.length,
				taskAvg,
				passRate,
			];
		});

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`rekap_nilai_akademik_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Export single task to CSV dengan KKM tugas yang sesuai
	const handleExportSingleTaskCSV = (task) => {
		if (!task || !task.nilai_siswa || task.nilai_siswa.length === 0) {
			Swal.fire('Info', 'Tidak ada data nilai siswa untuk diunduh.', 'info');
			return;
		}

		const taskKkm = getTaskKKM(task, kktpMap);
		const headers = ['No', 'Nama Siswa', 'Nilai', `Status KKM (${taskKkm})`];
		const rows = task.nilai_siswa.map((ns, idx) => {
			const val = parseFloat(ns.nilai);
			const isPass = !isNaN(val) && val >= taskKkm;
			return [
				idx + 1,
				`"${(ns.nama_siswa || `Siswa ID ${ns.siswa_id}`).replace(/"/g, '""')}"`,
				!isNaN(val) ? val : 0,
				isPass ? 'Tuntas' : 'Remedial',
			];
		});

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		const cleanTitle = (task.kategori || task.deskripsi || 'tugas').replace(/[^a-zA-Z0-9]/g, '_');
		link.setAttribute(
			'download',
			`nilai_${task.kelas || ''}_${cleanTitle}_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Modal task statistics (Menghitung ketuntasan berdasarkan KKM mapel & kelas terkait)
	const selectedTaskStats = useMemo(() => {
		if (!selectedTask) return null;
		const taskKkm = getTaskKKM(selectedTask, kktpMap);
		const scores = (selectedTask.nilai_siswa || [])
			.map((s) => parseFloat(s.nilai))
			.filter((v) => !isNaN(v));

		const total = scores.length;
		const avg = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0';
		const highest = total > 0 ? Math.max(...scores) : 0;
		const lowest = total > 0 ? Math.min(...scores) : 0;
		const passCount = scores.filter((v) => v >= taskKkm).length;
		const remedialCount = total - passCount;
		const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

		return { kkm: taskKkm, total, avg, highest, lowest, passCount, remedialCount, passRate };
	}, [selectedTask, kktpMap]);

	// Modal student search filter
	const filteredModalStudents = useMemo(() => {
		if (!selectedTask) return [];
		const list = selectedTask.nilai_siswa || [];
		if (!modalSearch.trim()) return list;
		const q = modalSearch.toLowerCase().trim();
		return list.filter((s) => (s.nama_siswa || '').toLowerCase().includes(q));
	}, [selectedTask, modalSearch]);

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-teal-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>📊</span> Audit Capaian Belajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Rekapitulasi Nilai Akademik Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Evaluasi distribusi capaian nilai formatif, sumatif, dan persentase ketuntasan belajar siswa berbasis KKTP / KKM setiap mata pelajaran dan jenjang.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto flex-wrap'>
					<button
						onClick={handleExportPDF}
						disabled={filteredTasks.length === 0}
						title='Unduh rekapitulasi penilaian dalam format PDF dengan Kop Surat Resmi'
						className='px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:hover:bg-teal-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={filteredTasks.length === 0}
						title='Unduh rekapitulasi penilaian saat ini dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-teal-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-gray-500 block text-[10px] uppercase font-bold'>Periode Sistem</span>
						<span className='text-teal-950 font-black text-xs sm:text-sm'>
							TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}
						</span>
					</div>
				</div>
			</div>

			{/* Stat Highlights Bar */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Rata-rata Nilai</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{overallStats.rataRata}</p>
						<span className='text-[10px] font-bold text-gray-500'>Skala 0 - 100</span>
					</div>
					<span className='w-11 h-11 bg-teal-200 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📈
					</span>
				</div>

				<div className='bg-emerald-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-emerald-800'>Ketuntasan KKTP / KKM</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>{overallStats.ketuntasan}%</p>
						<span className='text-[10px] font-bold text-emerald-700'>Sesuai standar mapel & jenjang</span>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🎯
					</span>
				</div>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Sesi Penilaian</p>
						<p className='text-2xl sm:text-3xl font-black text-yellow-950 mt-0.5'>{overallStats.totalTugas}</p>
						<span className='text-[10px] font-bold text-yellow-700'>Formatif & Sumatif</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📑
					</span>
				</div>

				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-indigo-800'>Total Nilai Siswa</p>
						<p className='text-2xl sm:text-3xl font-black text-indigo-950 mt-0.5'>{overallStats.totalSiswaDinilai}</p>
						<span className='text-[10px] font-bold text-indigo-700'>Entri nilai terekam</span>
					</div>
					<span className='w-11 h-11 bg-indigo-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						👥
					</span>
				</div>
			</div>

			{/* Search & Multi Filter Box */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Row 1: Search & Active Filter State */}
				<div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
					<div className='relative flex-1'>
						<svg
							className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
							strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
						</svg>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari deskripsi tugas, nama guru, mapel, kategori, atau kelas...'
							className='neo-input neo-input-with-icon !py-2.5 text-xs sm:text-sm !w-full'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								title='Hapus pencarian'
								className='absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black font-black text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors'>
								✕
							</button>
						)}
					</div>

					<div className='flex items-center justify-between sm:justify-end gap-2 shrink-0'>
						<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-950 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							<span>📑</span>
							<span>{filteredTasks.length} Sesi Ditemukan</span>
						</span>

						{isFilterActive && (
							<button
								onClick={handleResetFilters}
								className='inline-flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
								<span>↺</span>
								<span>Reset Filter</span>
							</button>
						)}
					</div>
				</div>

				{/* Row 2: 3 Dedicated Filter Dropdowns */}
				<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t-2 border-black/10'>
					{/* Filter Rombel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏫</span> Rombongan Belajar
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kelas ({kelasList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					{/* Filter Mapel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>📚</span> Mata Pelajaran
						</label>
						<select
							value={filterMapel}
							onChange={(e) => setFilterMapel(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Mapel ({mapelList.length})</option>
							{mapelList.map((m) => (
								<option key={m.id || m.mapel} value={m.mapel}>
									{m.mapel}
								</option>
							))}
						</select>
					</div>

					{/* Filter Kategori (Dinamic based on real database entries) */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏷️</span> Kategori Penilaian
						</label>
						<select
							value={filterKategori}
							onChange={(e) => setFilterKategori(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kategori ({kategoriOptions.length})</option>
							{kategoriOptions.map((kat) => (
								<option key={kat} value={kat}>
									{kat}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				{/* Mobile swipe hint */}
				<div className='sm:hidden px-4 py-2 bg-teal-50 border-b border-black/10 flex items-center justify-between text-[11px] font-bold text-teal-900'>
					<span>↔️ Geser ke samping untuk melihat detail nilai</span>
					<span className='font-mono font-black'>TABEL</span>
				</div>

				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse min-w-[960px]'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black'>
								<th className='px-4 py-3.5 text-xs font-black text-black uppercase tracking-wider w-[30%] min-w-[260px] whitespace-nowrap'>
									Deskripsi Penilaian
								</th>
								<th className='px-4 py-3.5 text-xs font-black text-black uppercase tracking-wider w-[18%] min-w-[170px] whitespace-nowrap'>
									Guru Pengampu
								</th>
								<th className='px-4 py-3.5 text-xs font-black text-black uppercase tracking-wider w-[14%] min-w-[130px] whitespace-nowrap'>
									Rombel & Mapel
								</th>
								<th className='px-4 py-3.5 text-xs font-black text-black uppercase tracking-wider w-[14%] min-w-[130px] whitespace-nowrap'>
									Kategori
								</th>
								<th className='px-4 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider w-[16%] min-w-[140px] whitespace-nowrap'>
									Rata-rata & KKM
								</th>
								<th className='px-4 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider w-[8%] min-w-[90px] whitespace-nowrap'>
									Aksi
								</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedTasks.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-teal-50/30'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ditemukan rekaman penilaian yang sesuai</p>
											<p className='text-xs text-gray-500'>Coba ubah kata kunci pencarian atau reset filter untuk menampilkan semua data.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-teal-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedTasks.map((t, idx) => {
									const taskKkm = getTaskKKM(t, kktpMap);
									const scores = (t.nilai_siswa || []).map((s) => parseFloat(s.nilai)).filter((v) => !isNaN(v));
									const taskAvg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
									const passCount = scores.filter((v) => v >= taskKkm).length;
									const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0;

									return (
										<tr
											key={t.tugas_id || t.id || idx}
											className='hover:bg-teal-50/40 transition-colors'>
											{/* Deskripsi & Info Penilaian */}
											<td className='px-4 py-4 align-middle'>
												<div className='space-y-1.5'>
													<p
														className='font-black text-xs sm:text-sm text-black leading-snug line-clamp-2 hover:line-clamp-none transition-all cursor-default'
														title={t.deskripsi || 'Sesi Penilaian'}>
														{t.deskripsi || 'Sesi Penilaian'}
													</p>
													<div className='flex flex-wrap items-center gap-1.5'>
														<span className='inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-black/15'>
															<span>📅</span>
															<span>
																{t.tanggal
																	? new Date(t.tanggal).toLocaleDateString('id-ID', {
																			day: 'numeric',
																			month: 'short',
																			year: 'numeric',
																	  })
																	: '-'}
															</span>
														</span>
														<span className='inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200'>
															<span>👥</span>
															<span>{scores.length} Siswa</span>
														</span>
													</div>
												</div>
											</td>

											{/* Guru Pengampu */}
											<td className='px-4 py-4 align-middle'>
												<div className='flex items-center gap-2.5'>
													<div className='w-9 h-9 rounded-xl bg-teal-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0 text-teal-950'>
														{t.users?.nama_lengkap ? t.users.nama_lengkap.charAt(0).toUpperCase() : 'G'}
													</div>
													<div className='min-w-0'>
														<p
															className='font-black text-xs sm:text-sm text-black truncate'
															title={t.users?.nama_lengkap || 'Guru Pengampu'}>
															{t.users?.nama_lengkap || 'Guru Pengampu'}
														</p>
														<span className='font-mono text-[10px] font-bold text-gray-500 block truncate'>
															@{t.users?.username || 'guru'}
														</span>
													</div>
												</div>
											</td>

											{/* Kelas & Mapel */}
											<td className='px-4 py-4 align-middle whitespace-nowrap'>
												<div className='flex flex-col gap-1 items-start'>
													<span className='inline-block px-2.5 py-0.5 bg-yellow-300 text-black text-xs font-black rounded-md border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
														{t.kelas}
													</span>
													<span className='text-xs font-black text-gray-800 tracking-tight' title={t.mapel}>
														{t.mapel}
													</span>
												</div>
											</td>

											{/* Kategori */}
											<td className='px-4 py-4 align-middle'>
												<span
													className={`inline-block px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border-2 shadow-[1px_1px_0px_0px_#0D0D0D] max-w-[170px] truncate ${getKategoriBadgeStyle(
														t.kategori
													)}`}
													title={t.kategori || 'Tugas'}>
													{t.kategori || 'Tugas'}
												</span>
											</td>

											{/* Nilai Rata-rata & KKM Spesifik */}
											<td className='px-4 py-4 text-center align-middle whitespace-nowrap'>
												<div className='inline-flex flex-col items-center gap-1.5'>
													<span className='font-mono font-black text-sm text-black bg-white px-2.5 py-0.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
														{taskAvg}
													</span>
													<div className='flex items-center gap-1.5'>
														<span
															className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
																passRate >= 75
																	? 'bg-emerald-100 text-emerald-900 border-emerald-400'
																	: 'bg-orange-100 text-orange-900 border-orange-400'
															}`}>
															{passRate}% Tuntas
														</span>
														<span
															title={`KKTP/KKM untuk ${t.mapel} jenjang ${getTingkatKelas(t.kelas)} adalah ${taskKkm}`}
															className='text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-black/30'>
															KKM {taskKkm}
														</span>
													</div>
												</div>
											</td>

											{/* Detail / Aksi */}
											<td className='px-4 py-4 text-center align-middle whitespace-nowrap'>
												<button
													onClick={() => {
														setSelectedTask(t);
														setModalSearch('');
													}}
													title='Tinjau daftar nilai siswa untuk sesi ini'
													className='inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white hover:bg-teal-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
													<span>👁️</span>
													<span>Tinjau</span>
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div className='px-5 py-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3'>
					<div className='text-xs font-bold text-gray-600'>
						Menampilkan <span className='font-black text-black'>{filteredTasks.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredTasks.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredTasks.length}</span> sesi penilaian
					</div>

					{totalPages > 1 && (
						<div className='flex items-center gap-1.5'>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className='px-3 py-1.5 bg-white hover:bg-teal-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								◀ Prev
							</button>

							<div className='flex items-center gap-1'>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
									if (
										pageNum === 1 ||
										pageNum === totalPages ||
										(pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
									) {
										return (
											<button
												key={pageNum}
												onClick={() => setCurrentPage(pageNum)}
												className={`w-8 h-8 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer ${
													currentPage === pageNum
														? 'bg-teal-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												{pageNum}
											</button>
										);
									} else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
										return (
											<span key={pageNum} className='px-1 text-xs font-black text-gray-400'>
												...
											</span>
										);
									}
									return null;
								})}
							</div>

							<button
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								className='px-3 py-1.5 bg-white hover:bg-teal-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								Next ▶
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Modal Tinjau Nilai Siswa */}
			{selectedTask && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Header */}
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-teal-300'>
							<div className='min-w-0 pr-4'>
								<div className='flex items-center gap-2 flex-wrap'>
									<span className='px-2.5 py-0.5 bg-yellow-300 text-black border border-black rounded-md text-[11px] font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
										{selectedTask.kelas}
									</span>
									<span className='text-xs font-black text-gray-900'>
										{selectedTask.mapel}
									</span>
									<span className='px-2 py-0.5 bg-white text-black border border-black rounded-md text-[11px] font-black'>
										KKM: {selectedTaskStats?.kkm}
									</span>
									<span className='text-xs font-bold text-gray-700'>
										&bull; {selectedTask.kategori || 'Tugas'}
									</span>
								</div>
								<h3 className='text-base sm:text-lg font-black text-black tracking-tight mt-1 line-clamp-1'>
									{selectedTask.deskripsi || 'Sesi Penilaian Siswa'}
								</h3>
								<p className='text-[11px] font-bold text-gray-700'>
									Guru: {selectedTask.users?.nama_lengkap || '-'} &bull; Tanggal:{' '}
									{selectedTask.tanggal
										? new Date(selectedTask.tanggal).toLocaleDateString('id-ID', {
												dateStyle: 'medium',
										  })
										: '-'}
								</p>
							</div>
							<button
								onClick={() => setSelectedTask(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer shrink-0'>
								✕
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 max-h-[75vh] overflow-y-auto space-y-4 bg-slate-50'>
							{/* Quick Stat Highlights inside Modal */}
							{selectedTaskStats && (
								<div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5'>
									<div className='bg-white border-2 border-black rounded-xl p-2.5 text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='text-[10px] font-black uppercase text-gray-500 block'>Rata-rata</span>
										<span className='font-mono font-black text-lg text-black'>{selectedTaskStats.avg}</span>
									</div>
									<div className='bg-white border-2 border-black rounded-xl p-2.5 text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='text-[10px] font-black uppercase text-gray-500 block'>Tertinggi / Terendah</span>
										<span className='font-mono font-black text-sm text-black'>
											{selectedTaskStats.highest} / {selectedTaskStats.lowest}
										</span>
									</div>
									<div className='bg-emerald-50 border-2 border-black rounded-xl p-2.5 text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='text-[10px] font-black uppercase text-emerald-800 block'>
											Tuntas KKM (&ge;{selectedTaskStats.kkm})
										</span>
										<span className='font-mono font-black text-sm text-emerald-950'>
											{selectedTaskStats.passCount} ({selectedTaskStats.passRate}%)
										</span>
									</div>
									<div className='bg-rose-50 border-2 border-black rounded-xl p-2.5 text-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='text-[10px] font-black uppercase text-rose-800 block'>
											Remedial (&lt;{selectedTaskStats.kkm})
										</span>
										<span className='font-mono font-black text-sm text-rose-950'>
											{selectedTaskStats.remedialCount} siswa
										</span>
									</div>
								</div>
							)}

							{/* Student Search & Count */}
							<div className='flex items-center justify-between gap-3'>
								<div className='relative flex-1'>
									<input
										type='text'
										value={modalSearch}
										onChange={(e) => setModalSearch(e.target.value)}
										placeholder='Cari nama siswa di kelas ini...'
										className='neo-input !py-1.5 text-xs !w-full bg-white'
									/>
									{modalSearch && (
										<button
											onClick={() => setModalSearch('')}
											className='absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 hover:text-black'>
											✕
										</button>
									)}
								</div>
								<button
									onClick={() => handleExportSingleTaskCSV(selectedTask)}
									className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 cursor-pointer flex items-center gap-1.5'>
									<span>📥</span>
									<span>Unduh CSV</span>
								</button>
							</div>

							{/* Student List Table */}
							<div className='overflow-x-auto border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] bg-white'>
								<table className='w-full text-left bg-white text-xs'>
									<thead>
										<tr className='bg-teal-200 border-b-2 border-black font-black text-black'>
											<th className='p-3 text-center w-12'>No</th>
											<th className='p-3'>Nama Siswa</th>
											<th className='p-3 text-center w-28'>Nilai</th>
											<th className='p-3 text-center w-36'>
												Status KKM ({selectedTaskStats?.kkm || '-'})
											</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-black/10'>
										{filteredModalStudents.length === 0 ? (
											<tr>
												<td colSpan={4} className='p-6 text-center text-gray-500 font-bold'>
													{modalSearch
														? `Tidak ditemukan siswa bernama "${modalSearch}"`
														: 'Belum ada data nilai siswa yang dimasukkan untuk sesi ini.'}
												</td>
											</tr>
										) : (
											filteredModalStudents.map((ns, idx) => {
												const val = parseFloat(ns.nilai);
												const taskKkm = selectedTaskStats?.kkm || 70;
												const isPass = !isNaN(val) && val >= taskKkm;
												return (
													<tr key={ns.id || idx} className='hover:bg-teal-50/50 transition-colors'>
														<td className='p-3 text-center font-bold text-gray-500'>{idx + 1}</td>
														<td className='p-3 font-black text-black'>
															{ns.nama_siswa || `Siswa ID: ${ns.siswa_id}`}
														</td>
														<td className='p-3 text-center font-mono font-black text-sm'>
															{ns.nilai !== undefined && ns.nilai !== null ? ns.nilai : '-'}
														</td>
														<td className='p-3 text-center'>
															<span
																className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${
																	isPass
																		? 'bg-emerald-100 text-emerald-900 border-emerald-400'
																		: 'bg-rose-100 text-rose-900 border-rose-400'
																}`}>
																{isPass ? '✓ Tuntas' : '✗ Remedial'}
															</span>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>

							{/* Modal Footer */}
							<div className='pt-2 flex items-center justify-between'>
								<span className='text-xs font-bold text-gray-500'>
									Total: {selectedTask.nilai_siswa?.length || 0} siswa terdaftar
								</span>
								<button
									onClick={() => setSelectedTask(null)}
									className='px-4 py-2 bg-black hover:bg-gray-800 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
									Tutup Tinjauan
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
