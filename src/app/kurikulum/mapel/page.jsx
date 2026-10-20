'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, drawKopSuratPDF, fetchSchoolProfile } from '@/lib/pdfKopSurat';
import { useAcademic } from '@/context/AcademicContext';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export const MAPEL_DISPLAY_NAMES = {
	'MP-PABP': 'PAPB (Pendidikan Agama & Budi Pekerti)',
	'MP-PKN': 'PKN (Pendidikan Kewarganegaraan)',
	'MP-BINDO': 'BAHASA INDONESIA',
	'MP-BING': 'BAHASA INGGRIS',
	'MP-MTK': 'MATEMATIKA',
	'MP-IPA': 'IPA (Ilmu Pengetahuan Alam)',
	'MP-IPS': 'IPS (Ilmu Pengetahuan Sosial)',
	'MP-SBK': 'SENI BUDAYA',
	'MP-PJOK': 'PENJASKES (PJOK)',
	'MP-PRAKARYA': 'PRAKARYA',
	'MP-TIK': 'INFORMATIKA (TIK)',
	'MP-BMR': 'BUDAYA MELAYU RIAU (BMR)',
	'MP-KHOT': 'KHOT',
	'MP-BMK': 'BMK',
	'MP-ASW': 'ASWAJA',
};

export default function KurikulumMapelPage() {
	const { role } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();

	const [mapelList, setMapelList] = useState([]);
	const [kktpList, setKktpList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');

	// Modal Edit KKTP per Mapel
	const [isKktpModalOpen, setIsKktpModalOpen] = useState(false);
	const [selectedMapelForKktp, setSelectedMapelForKktp] = useState(null);
	const [kktpFormData, setKktpFormData] = useState({
		vii: '70',
		viii: '72',
		ix: '75',
	});
	const [isSavingKktp, setIsSavingKktp] = useState(false);

	// Modal Tambah / Edit Nama Mapel
	const [isMapelModalOpen, setIsMapelModalOpen] = useState(false);
	const [isEditMapelMode, setIsEditMapelMode] = useState(false);
	const [editMapelId, setEditMapelId] = useState(null);
	const [mapelFormData, setMapelFormData] = useState({ mapel: '' });
	const [isSavingMapel, setIsSavingMapel] = useState(false);

	const fetchAllData = async () => {
		try {
			setLoading(true);
			const [resMapel, resKktp, prof] = await Promise.all([
				fetch('/api/mapel?all=true'),
				fetch('/api/kktp'),
				fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
			]);

			if (!resMapel.ok) throw new Error('Gagal memuat mata pelajaran.');
			const mapelData = await resMapel.json();
			const kktpData = resKktp.ok ? await resKktp.json() : [];

			setMapelList(mapelData || []);
			setKktpList(kktpData || []);
			if (prof) setSchoolProfile(prof);
		} catch (err) {
			console.error('Fetch mapel/kktp error:', err);
			Swal.fire('Terjadi Kesalahan', err.message, 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllData();
	}, []);

	// Peta KKTP berdasarkan Mapel ID dan Tingkat Kelas
	const kktpMatrix = useMemo(() => {
		const map = {};
		kktpList.forEach((item) => {
			if (!map[item.mapel_id]) {
				map[item.mapel_id] = {};
			}
			const displayVal = item.keterangan || (item.nilai_kktp != null ? String(item.nilai_kktp) : '-');
			map[item.mapel_id][item.tingkat_kelas] = {
				raw: item.nilai_kktp,
				display: displayVal,
			};
		});
		return map;
	}, [kktpList]);

	// Filter Mapel
	const filteredMapel = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		return mapelList.filter((m) => {
			const fullName = (MAPEL_DISPLAY_NAMES[m.id] || m.mapel).toLowerCase();
			return fullName.includes(q) || m.mapel.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
		});
	}, [mapelList, searchQuery]);

	// Statistik Rata-rata KKTP per Tingkat Kelas
	const kktpAverages = useMemo(() => {
		const numsVII = [];
		const numsVIII = [];
		const numsIX = [];

		mapelList.forEach((m) => {
			const kktp = kktpMatrix[m.id];
			if (kktp) {
				const valVII = parseFloat(kktp['VII']?.display);
				const valVIII = parseFloat(kktp['VIII']?.display);
				const valIX = parseFloat(kktp['IX']?.display);

				if (!isNaN(valVII)) numsVII.push(valVII);
				if (!isNaN(valVIII)) numsVIII.push(valVIII);
				if (!isNaN(valIX)) numsIX.push(valIX);
			}
		});

		const avg = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-');
		return {
			avgVII: avg(numsVII),
			avgVIII: avg(numsVIII),
			avgIX: avg(numsIX),
			totalMapel: mapelList.length,
		};
	}, [mapelList, kktpMatrix]);

	// Buka Modal Edit KKTP
	const handleOpenEditKktp = (mapelItem) => {
		setSelectedMapelForKktp(mapelItem);
		const current = kktpMatrix[mapelItem.id] || {};
		setKktpFormData({
			vii: current['VII']?.display || '70',
			viii: current['VIII']?.display || '72',
			ix: current['IX']?.display || '75',
		});
		setIsKktpModalOpen(true);
	};

	// Buka Modal Edit Nama Mapel
	const handleOpenEditMapel = (mapelItem) => {
		setIsEditMapelMode(true);
		setEditMapelId(mapelItem.id);
		setMapelFormData({ mapel: mapelItem.mapel });
		setIsMapelModalOpen(true);
	};

	// Simpan Nilai KKTP ke Database
	const handleSaveKktp = async (e) => {
		e.preventDefault();
		if (!selectedMapelForKktp) return;

		try {
			setIsSavingKktp(true);

			const payload = [
				{
					mapel_id: selectedMapelForKktp.id,
					tingkat_kelas: 'VII',
					nilai_kktp: !isNaN(parseFloat(kktpFormData.vii)) ? parseFloat(kktpFormData.vii) : null,
					keterangan: kktpFormData.vii.trim(),
					tahun_ajar_id: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				},
				{
					mapel_id: selectedMapelForKktp.id,
					tingkat_kelas: 'VIII',
					nilai_kktp: !isNaN(parseFloat(kktpFormData.viii)) ? parseFloat(kktpFormData.viii) : null,
					keterangan: kktpFormData.viii.trim(),
					tahun_ajar_id: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				},
				{
					mapel_id: selectedMapelForKktp.id,
					tingkat_kelas: 'IX',
					nilai_kktp: !isNaN(parseFloat(kktpFormData.ix)) ? parseFloat(kktpFormData.ix) : null,
					keterangan: kktpFormData.ix.trim(),
					tahun_ajar_id: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				},
			];

			const res = await fetch('/api/kktp', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai KKTP.');

			Swal.fire({
				title: 'Berhasil!',
				text: `Standar KKTP untuk ${selectedMapelForKktp.mapel} berhasil diperbarui.`,
				icon: 'success',
				confirmButtonColor: '#F59E0B',
			});

			setIsKktpModalOpen(false);
			fetchAllData();
		} catch (err) {
			console.error('Save KKTP error:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setIsSavingKktp(false);
		}
	};

	// Submit Mapel Baru / Edit Nama Mapel
	const handleSaveMapel = async (e) => {
		e.preventDefault();
		if (!mapelFormData.mapel.trim()) {
			Swal.fire('Peringatan', 'Nama mata pelajaran tidak boleh kosong!', 'warning');
			return;
		}

		try {
			setIsSavingMapel(true);
			const method = isEditMapelMode ? 'PUT' : 'POST';
			const payload = isEditMapelMode
				? { id: editMapelId, mapel: mapelFormData.mapel.trim() }
				: { mapel: mapelFormData.mapel.trim() };

			const res = await fetch('/api/mapel', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data mapel.');

			Swal.fire(
				'Berhasil!',
				isEditMapelMode ? 'Nama mata pelajaran diperbarui.' : 'Mata pelajaran berhasil ditambahkan.',
				'success'
			);
			setIsMapelModalOpen(false);
			fetchAllData();
		} catch (err) {
			Swal.fire('Gagal', err.message, 'error');
		} finally {
			setIsSavingMapel(false);
		}
	};

	// Hapus Mapel
	const handleDeleteMapel = async (id, namaMapel) => {
		const result = await Swal.fire({
			title: 'Hapus Mata Pelajaran?',
			html: `Apakah Anda yakin ingin menghapus <b>${namaMapel}</b>?<br/><span class="text-xs text-gray-500 font-bold mt-1 inline-block">Standar nilai KKTP terkait mapel ini juga akan dibersihkan.</span>`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#4B5563',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				Swal.fire({
					title: 'Menghapus...',
					text: 'Sedang memproses penghapusan mata pelajaran',
					allowOutsideClick: false,
					didOpen: () => Swal.showLoading(),
				});

				const res = await fetch('/api/mapel', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal menghapus mata pelajaran.');

				await Swal.fire({
					title: 'Berhasil Dihapus!',
					text: data.message || `Mata pelajaran ${namaMapel} berhasil dihapus dari kurikulum.`,
					icon: 'success',
					confirmButtonColor: '#000000',
				});
				fetchAllData();
			} catch (err) {
				Swal.fire({
					title: 'Gagal Menghapus',
					text: err.message,
					icon: 'error',
					confirmButtonColor: '#000000',
				});
			}
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR EKSPOR EXCEL MATRIKS KKTP
	// ---------------------------------------------------------------------------
	const handleExportExcel = () => {
		try {
			if (filteredMapel.length === 0) {
				Swal.fire('Data Kosong', 'Tidak ada data mata pelajaran untuk diekspor.', 'info');
				return;
			}

			const exportRows = filteredMapel.map((m, idx) => {
				const kktp = kktpMatrix[m.id] || {};
				return {
					NO: idx + 1,
					'MATA PELAJARAN': MAPEL_DISPLAY_NAMES[m.id] || m.mapel,
					'KBM KELAS VII': kktp['VII']?.display || '-',
					'KBM KELAS VIII': kktp['VIII']?.display || '-',
					'KBM KELAS IX': kktp['IX']?.display || '-',
					'KODE MAPEL': m.id,
				};
			});

			const ws = XLSX.utils.json_to_sheet(exportRows);
			ws['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, 'Standar_KKTP_KBM');

			const fileName = `Standar_KKTP_KBM_${(tahunAjarAktif || '2026-2027').replace('/', '-')}.xlsx`;
			XLSX.writeFile(wb, fileName);

			Swal.fire('Berhasil!', `Data KKTP (${filteredMapel.length} mapel) berhasil diekspor ke Excel.`, 'success');
		} catch (err) {
			console.error('Export Excel error:', err);
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR EKSPOR PDF RESMI (KOP SURAT & MATRIKS DOKUMEN KKTP)
	// ---------------------------------------------------------------------------
	const handleExportPDF = () => {
		try {
			if (filteredMapel.length === 0) {
				Swal.fire('Data Kosong', 'Tidak ada data mata pelajaran untuk diekspor.', 'info');
				return;
			}

			const doc = new jsPDF('portrait');
			drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			doc.text('STANDAR KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)', 105, 48, { align: 'center' });
			doc.text('KETUNTASAN BELAJAR MINIMAL (KBM) TINGKAT KELAS VII, VIII, & IX', 105, 53.5, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '2026/2027'} | Semester: ${semesterAktif || 1} | Satuan Pendidikan: SMP IT Tebuireng 4 Al-Ishlah`,
				105,
				59,
				{ align: 'center' }
			);

			const tableRows = filteredMapel.map((m, idx) => {
				const kktp = kktpMatrix[m.id] || {};
				return [
					idx + 1,
					MAPEL_DISPLAY_NAMES[m.id] || m.mapel,
					kktp['VII']?.display || '-',
					kktp['VIII']?.display || '-',
					kktp['IX']?.display || '-',
				];
			});

			autoTable(doc, {
				startY: 64,
				head: [
					[
						{ content: 'NO', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
						{ content: 'MATA PELAJARAN', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
						{ content: 'KBM / AMBANG BATAS KKTP', colSpan: 3, styles: { halign: 'center' } },
					],
					[
						{ content: 'KELAS VII', styles: { halign: 'center' } },
						{ content: 'KELAS VIII', styles: { halign: 'center' } },
						{ content: 'KELAS IX', styles: { halign: 'center' } },
					],
				],
				body: tableRows,
				theme: 'grid',
				headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5 },
				styles: { fontSize: 8, cellPadding: 2 },
				columnStyles: {
					0: { halign: 'center', cellWidth: 10 },
					1: { cellWidth: 85 },
					2: { halign: 'center', cellWidth: 28 },
					3: { halign: 'center', cellWidth: 28 },
					4: { halign: 'center', cellWidth: 28 },
				},
			});

			// Pengesahan Tanda Tangan di Bawah Dokumen
			const finalY = doc.lastAutoTable?.finalY || 140;
			const pageHeight = doc.internal.pageSize.getHeight();
			if (finalY + 38 < pageHeight) {
				doc.setFontSize(8.5);
				doc.text(`Mengetahui,`, 25, finalY + 12);
				doc.text(`Kepala Sekolah`, 25, finalY + 17);
				doc.text(`( ......................................... )`, 25, finalY + 34);

				const kota = schoolProfile?.kota || 'Kuala Gading';
				doc.text(`Ditetapkan di: ${kota}`, 135, finalY + 12);
				doc.text(`Waka Kurikulum`, 135, finalY + 17);
				doc.text(`( ......................................... )`, 135, finalY + 34);
			}

			const fileName = `Standar_KKTP_KBM_${(tahunAjarAktif || '2026-2027').replace('/', '-')}.pdf`;
			doc.save(fileName);
			Swal.fire('Berhasil!', `Dokumen matriks KKTP PDF berhasil diunduh.`, 'success');
		} catch (err) {
			console.error('Export PDF error:', err);
			Swal.fire('Gagal Export PDF', err.message, 'error');
		}
	};

	if (loading) return <Loader text='Memuat Standar KKTP & Mata Pelajaran...' />;

	return (
		<div className='space-y-6'>
			{/* HEADER BANNER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col lg:flex-row lg:items-center justify-between gap-5'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded tracking-wider'>
							Pengorganisasian KBM
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2.5'>
						<span>📚</span> Standar KKTP & Master Mapel
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl leading-relaxed'>
						Katalog mata pelajaran resmi serta ambang batas Kriteria Ketercapaian Tujuan Pembelajaran (KKTP / KBM)
						berjenjang untuk Kelas VII, Kelas VIII, dan Kelas IX.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-2.5 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={() => {
							setIsEditMapelMode(false);
							setEditMapelId(null);
							setMapelFormData({ mapel: '' });
							setIsMapelModalOpen(true);
						}}
						className='px-4 sm:px-5 py-2.5 bg-black text-white hover:bg-neutral-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>➕</span> Tambah Mapel
					</button>
				</div>
			</div>

			{/* HIGHLIGHT STAT CARDS */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Total Mapel</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kktpAverages.totalMapel}</p>
					<p className='text-[10px] font-bold text-amber-700 mt-1'>Mata Pelajaran KBM</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Rata-rata KBM Kelas VII</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kktpAverages.avgVII}</p>
					<p className='text-[10px] font-bold text-sky-700 mt-1'>Standar Ketuntasan Tingkat VII</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Rata-rata KBM Kelas VIII</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kktpAverages.avgVIII}</p>
					<p className='text-[10px] font-bold text-emerald-700 mt-1'>Standar Ketuntasan Tingkat VIII</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Rata-rata KBM Kelas IX</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{kktpAverages.avgIX}</p>
					<p className='text-[10px] font-bold text-purple-700 mt-1'>Standar Ketuntasan Tingkat IX</p>
				</div>
			</div>

			{/* SEARCH & ACTION TOOLBAR */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3'>
				{/* Search Field */}
				<div className='relative flex-1 max-w-md'>
					<span className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 text-sm'>
						🔍
					</span>
					<input
						type='text'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder='Cari nama mata pelajaran atau kode...'
						className='w-full pl-9 pr-8 py-2.5 border-2 border-black rounded-xl text-xs sm:text-sm font-bold bg-[#FFFDF0] focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-400'
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className='absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 hover:text-black cursor-pointer'>
							✕
						</button>
					)}
				</div>

				{/* Table Actions: Export Excel & PDF */}
				<div className='flex items-center gap-2 justify-end shrink-0'>
					<button
						onClick={handleExportExcel}
						className='px-3.5 sm:px-4 py-2.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📊</span> Ekspor Excel
					</button>
					<button
						onClick={handleExportPDF}
						className='px-3.5 sm:px-4 py-2.5 bg-rose-200 hover:bg-rose-300 text-rose-950 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📄</span> Ekspor PDF
					</button>
				</div>
			</div>

			{/* TABEL MATRIKS STANDAR KKTP / KBM */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<div>
						<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
							<span>📋</span> Matriks Ambang Batas KBM ({filteredMapel.length} Mata Pelajaran)
						</h2>
						<p className='text-xs font-bold text-gray-500 mt-0.5'>
							Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) per jenjang kelas TA {tahunAjarAktif || '2026/2027'}
						</p>
					</div>
					<span className='text-xs font-black px-2.5 py-1 bg-yellow-200 border border-black rounded-lg'>
						Semester {semesterAktif || 1}
					</span>
				</div>

				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							{/* Header Tingkat 1 */}
							<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
								<th rowSpan={2} className='py-3 px-3 text-center border-r-2 border-black w-14'>
									NO
								</th>
								<th rowSpan={2} className='py-3 px-4 border-r-2 border-black'>
									MATA PELAJARAN
								</th>
								<th colSpan={3} className='py-2 px-3 text-center border-r-2 border-black bg-amber-200'>
									KBM / STANDAR KKTP
								</th>
								<th rowSpan={2} className='py-3 px-3 text-center w-64'>
									AKSI
								</th>
							</tr>
							{/* Header Tingkat 2 (Kelas VII, VIII, IX) */}
							<tr className='border-b-2 border-black bg-amber-200/90 text-[11px] font-black uppercase text-black text-center'>
								<th className='py-2 px-3 border-r border-black w-28'>KELAS VII</th>
								<th className='py-2 px-3 border-r border-black w-28'>KELAS VIII</th>
								<th className='py-2 px-3 border-r-2 border-black w-28'>KELAS IX</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{filteredMapel.length === 0 ? (
								<tr>
									<td colSpan={6} className='text-center py-8 text-gray-500'>
										Tidak ada mata pelajaran yang cocok dengan pencarian.
									</td>
								</tr>
							) : (
								filteredMapel.map((item, idx) => {
									const kktp = kktpMatrix[item.id] || {};
									const valVII = kktp['VII']?.display || '-';
									const valVIII = kktp['VIII']?.display || '-';
									const valIX = kktp['IX']?.display || '-';

									const renderBadge = (val) => {
										if (val === 'Ekstra') {
											return (
												<span className='px-2.5 py-0.5 bg-sky-100 border border-sky-400 rounded-lg text-sky-950 font-black text-xs'>
													Ekstra
												</span>
											);
										}
										if (val === 'TIDAK ADA' || val === 'Tidak Ada') {
											return (
												<span className='px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-bold text-[11px]'>
													TIDAK ADA
												</span>
											);
										}
										if (!isNaN(parseFloat(val))) {
											return (
												<span className='px-3 py-1 bg-emerald-100 border border-emerald-400 rounded-lg text-emerald-950 font-black text-xs font-mono shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{val}
												</span>
											);
										}
										return <span className='text-gray-400 font-mono'>-</span>;
									};

									return (
										<tr key={item.id} className='hover:bg-amber-50/60 transition-colors'>
											<td className='py-3 px-3 text-center font-mono font-bold border-r border-gray-200'>
												{idx + 1}
											</td>
											<td className='py-3 px-4 border-r border-gray-200'>
												<div>
													<span className='font-black text-black text-sm block'>
														{MAPEL_DISPLAY_NAMES[item.id] || item.mapel}
													</span>
													<span className='text-[10px] font-mono text-gray-500'>Kode: {item.id}</span>
												</div>
											</td>
											<td className='py-3 px-3 text-center border-r border-gray-200'>{renderBadge(valVII)}</td>
											<td className='py-3 px-3 text-center border-r border-gray-200'>{renderBadge(valVIII)}</td>
											<td className='py-3 px-3 text-center border-r-2 border-black'>{renderBadge(valIX)}</td>
											<td className='py-3 px-3 text-center'>
												<div className='flex items-center justify-center gap-1.5'>
													<button
														type='button'
														onClick={() => handleOpenEditKktp(item)}
														title='Atur Nilai Ambang Batas KKTP (Kelas VII, VIII, IX)'
														className='px-2.5 py-1.5 bg-amber-300 hover:bg-amber-400 text-black border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1'>
														<span>📐</span>
														<span>KKTP</span>
													</button>
													<button
														type='button'
														onClick={() => handleOpenEditMapel(item)}
														title='Ubah Nama Mata Pelajaran'
														className='px-2.5 py-1.5 bg-sky-200 hover:bg-sky-300 text-sky-950 border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1'>
														<span>✏️</span>
														<span>Edit</span>
													</button>
													<button
														type='button'
														onClick={() => handleDeleteMapel(item.id, item.mapel)}
														title='Hapus Mata Pelajaran dari Kurikulum'
														className='px-2.5 py-1.5 bg-rose-200 hover:bg-rose-300 text-rose-950 border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1'>
														<span>🗑️</span>
														<span>Hapus</span>
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* MODAL EDIT KKTP BERJENJANG (KELAS VII, VIII, IX) */}
			{isKktpModalOpen && selectedMapelForKktp && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-md shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<h3 className='text-lg font-black flex items-center gap-2'>
									<span>📐</span> Atur Nilai KKTP / KBM
								</h3>
								<p className='text-xs font-bold text-gray-600 mt-0.5'>
									{MAPEL_DISPLAY_NAMES[selectedMapelForKktp.id] || selectedMapelForKktp.mapel}
								</p>
							</div>
							<button
								onClick={() => setIsKktpModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black cursor-pointer'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveKktp} className='space-y-4'>
							<p className='text-xs font-medium text-gray-600'>
								Tentukan angka ambang batas ketuntasan (misal: 70, 75) atau ketik <b>Ekstra</b> / <b>TIDAK ADA</b> bila
								mata pelajaran berstatus non-reguler pada jenjang tersebut.
							</p>

							<div className='space-y-3 bg-[#FFFDF0] p-4 border-2 border-black rounded-xl'>
								{/* KELAS VII */}
								<div className='flex items-center justify-between gap-3'>
									<label className='text-xs font-black uppercase text-black w-28 shrink-0'>
										Kelas VII:
									</label>
									<div className='flex items-center gap-1.5 flex-1'>
										<input
											type='text'
											value={kktpFormData.vii}
											onChange={(e) => setKktpFormData({ ...kktpFormData, vii: e.target.value })}
											required
											placeholder='70 / Ekstra / TIDAK ADA'
											className='w-full px-3 py-1.5 border-2 border-black rounded-lg font-bold text-xs bg-white text-center'
										/>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, vii: 'Ekstra' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-sky-100 hover:bg-sky-200'>
											Ekstra
										</button>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, vii: 'TIDAK ADA' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-gray-100 hover:bg-gray-200'>
											N/A
										</button>
									</div>
								</div>

								{/* KELAS VIII */}
								<div className='flex items-center justify-between gap-3'>
									<label className='text-xs font-black uppercase text-black w-28 shrink-0'>
										Kelas VIII:
									</label>
									<div className='flex items-center gap-1.5 flex-1'>
										<input
											type='text'
											value={kktpFormData.viii}
											onChange={(e) => setKktpFormData({ ...kktpFormData, viii: e.target.value })}
											required
											placeholder='72 / Ekstra / TIDAK ADA'
											className='w-full px-3 py-1.5 border-2 border-black rounded-lg font-bold text-xs bg-white text-center'
										/>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, viii: 'Ekstra' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-sky-100 hover:bg-sky-200'>
											Ekstra
										</button>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, viii: 'TIDAK ADA' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-gray-100 hover:bg-gray-200'>
											N/A
										</button>
									</div>
								</div>

								{/* KELAS IX */}
								<div className='flex items-center justify-between gap-3'>
									<label className='text-xs font-black uppercase text-black w-28 shrink-0'>
										Kelas IX:
									</label>
									<div className='flex items-center gap-1.5 flex-1'>
										<input
											type='text'
											value={kktpFormData.ix}
											onChange={(e) => setKktpFormData({ ...kktpFormData, ix: e.target.value })}
											required
											placeholder='75 / Ekstra / TIDAK ADA'
											className='w-full px-3 py-1.5 border-2 border-black rounded-lg font-bold text-xs bg-white text-center'
										/>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, ix: 'Ekstra' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-sky-100 hover:bg-sky-200'>
											Ekstra
										</button>
										<button
											type='button'
											onClick={() => setKktpFormData({ ...kktpFormData, ix: 'TIDAK ADA' })}
											className='px-2 py-1 text-[10px] font-black border border-black rounded bg-gray-100 hover:bg-gray-200'>
											N/A
										</button>
									</div>
								</div>
							</div>

							<div className='pt-3 border-t-2 border-black flex items-center justify-end gap-2.5'>
								<button
									type='button'
									onClick={() => setIsKktpModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100 cursor-pointer'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isSavingKktp}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
									{isSavingKktp ? 'Menyimpan...' : 'Simpan Nilai KKTP'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* MODAL TAMBAH / EDIT NAMA MAPEL */}
			{isMapelModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-md shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black flex items-center gap-2'>
								<span>{isEditMapelMode ? '✏️' : '➕'}</span>{' '}
								{isEditMapelMode ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
							</h3>
							<button
								onClick={() => setIsMapelModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black cursor-pointer'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveMapel} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Nama Mata Pelajaran <span className='text-rose-600'>*</span>
								</label>
								<input
									type='text'
									value={mapelFormData.mapel}
									onChange={(e) => setMapelFormData({ ...mapelFormData, mapel: e.target.value })}
									required
									placeholder='Contoh: Fiqih, Bahasa Arab, Robotika...'
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'
								/>
							</div>

							<div className='pt-3 border-t-2 border-black flex items-center justify-end gap-2.5'>
								<button
									type='button'
									onClick={() => setIsMapelModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100 cursor-pointer'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isSavingMapel}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
									{isSavingMapel ? 'Menyimpan...' : isEditMapelMode ? 'Simpan Perubahan' : 'Tambah Mapel'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
