'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, drawKopSuratPDF } from '@/lib/pdfKopSurat';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import { useKurikulumAuth } from '../KurikulumLayoutClient';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

const HARI_SEKOLAH = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu', 'Minggu'];

const STANDARD_JAM_SLOTS = [
	{ jam_ke: 1, jam_mulai: '07:30', jam_selesai: '08:15', label: 'Jam Ke-1' },
	{ jam_ke: 2, jam_mulai: '08:15', jam_selesai: '09:00', label: 'Jam Ke-2' },
	{ jam_ke: 3, jam_mulai: '09:00', jam_selesai: '09:45', label: 'Jam Ke-3' },
	{ jam_ke: '-', jam_mulai: '09:45', jam_selesai: '10:15', label: 'Istirahat Pagi' },
	{ jam_ke: 4, jam_mulai: '10:15', jam_selesai: '11:00', label: 'Jam Ke-4' },
	{ jam_ke: 5, jam_mulai: '11:00', jam_selesai: '11:45', label: 'Jam Ke-5' },
	{ jam_ke: 6, jam_mulai: '11:45', jam_selesai: '12:30', label: 'Jam Ke-6' },
	{ jam_ke: '-', jam_mulai: '12:30', jam_selesai: '13:15', label: 'Istirahat & Sholat' },
	{ jam_ke: 7, jam_mulai: '13:15', jam_selesai: '14:00', label: 'Jam Ke-7' },
	{ jam_ke: 8, jam_mulai: '14:00', jam_selesai: '14:45', label: 'Jam Ke-8' },
];

// Helper normalisasi waktu dari Excel
const formatTimeValue = (val, defaultVal = '07:30') => {
	if (!val) return defaultVal;
	const s = String(val).trim();
	if (/^\d{1,2}:\d{2}$/.test(s)) {
		const [h, m] = s.split(':');
		return `${h.padStart(2, '0')}:${m}`;
	}
	const num = parseFloat(s);
	if (!isNaN(num) && num > 0 && num < 1) {
		const totalMinutes = Math.round(num * 24 * 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	}
	return s;
};

export default function KurikulumMasterJadwalPage() {
	const { role } = useKurikulumAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();

	const [jadwalList, setJadwalList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [kbmList, setKbmList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	// Filter & View states
	const [viewMode, setViewMode] = useState('kelas'); // 'kelas' | 'guru'
	const [selectedTarget, setSelectedTarget] = useState('all');
	const [selectedHari, setSelectedHari] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');

	// Modal Manual Entry
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editId, setEditId] = useState(null);
	const [formData, setFormData] = useState({
		id_user: '',
		kelas: '',
		mapel: '',
		hari: 'Senin',
		jam_ke: '1',
		jam_mulai: '07:30',
		jam_selesai: '08:15',
	});
	const [isSaving, setIsSaving] = useState(false);

	// Bulk Import Excel states
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [importFile, setImportFile] = useState(null);
	const [importPreviewRows, setImportPreviewRows] = useState([]);
	const [isImporting, setIsImporting] = useState(false);
	const fileInputRef = useRef(null);

	const fetchAllData = async () => {
		try {
			setLoading(true);
			const supabase = createClient();

			const [resJadwal, resGuru, resKelas, resMapel, resKbm, resProfil] = await Promise.all([
				supabase
					.from('jadwal')
					.select('*, users:id_user(nama_lengkap, username)')
					.order('jam_mulai', { ascending: true }),
				supabase
					.from('users')
					.select('id_user, nama_lengkap, username')
					.eq('role', 'Guru')
					.order('nama_lengkap', { ascending: true }),
				supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
				supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
				supabase.from('guru_kbm').select('id_user, kelas, mapel'),
				fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
			]);

			setJadwalList(resJadwal.data || []);
			setGuruList(resGuru.data || []);
			setKelasList(resKelas.data || []);
			setMapelList(resMapel.data || []);
			setKbmList(resKbm.data || []);

			if (resProfil && resProfil.ok) {
				const pData = await resProfil.json();
				if (pData?.value && typeof pData.value === 'object') {
					setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
				}
			}
		} catch (error) {
			console.error('Error fetching master jadwal:', error);
			Swal.fire('Terjadi Kesalahan', 'Gagal memuat master jadwal pelajaran.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllData();
	}, []);

	// ---------------------------------------------------------------------------
	// Collision / Bentrok Detector:
	// 1. Guru mengajar di kelas berbeda pada hari yang sama dan jam yang bertabrakan
	// 2. Kelas diajar oleh 2 guru berbeda pada hari dan jam yang bertabrakan
	// ---------------------------------------------------------------------------
	const collisionAlerts = useMemo(() => {
		const collisions = [];
		const n = jadwalList.length;

		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = jadwalList[i];
				const b = jadwalList[j];

				if (a.hari === b.hari) {
					const aStart = a.jam_mulai || '';
					const aEnd = a.jam_selesai || '';
					const bStart = b.jam_mulai || '';
					const bEnd = b.jam_selesai || '';

					const sameJamKe = a.jam_ke && b.jam_ke && a.jam_ke === b.jam_ke;
					const overlapTime = aStart < bEnd && bStart < aEnd;

					if (sameJamKe || overlapTime) {
						// Kasus 1: Guru sama, kelas beda
						if (a.id_user === b.id_user && a.kelas !== b.kelas) {
							collisions.push({
								type: 'guru',
								title: `Bentrok Guru: ${a.users?.nama_lengkap || 'Guru'}`,
								hari: a.hari,
								jam: `${a.jam_mulai} - ${a.jam_selesai} (Jam ke-${a.jam_ke || '-'})`,
								detail: `Mengajar di kelas ${a.kelas} (${a.mapel}) dan ${b.kelas} (${b.mapel}) sekaligus.`,
							});
						}
						// Kasus 2: Kelas sama, guru beda
						else if (a.kelas === b.kelas && a.id_user !== b.id_user) {
							collisions.push({
								type: 'kelas',
								title: `Bentrok Rombel: Kelas ${a.kelas}`,
								hari: a.hari,
								jam: `${a.jam_mulai} - ${a.jam_selesai} (Jam ke-${a.jam_ke || '-'})`,
								detail: `Terdapat 2 mapel bersamaan: ${a.mapel} (${a.users?.nama_lengkap}) & ${b.mapel} (${b.users?.nama_lengkap}).`,
							});
						}
					}
				}
			}
		}
		return collisions;
	}, [jadwalList]);

	// Auto-filter mapel saat guru & kelas dipilih di modal (berdasarkan data KBM)
	const availableMapelForModal = useMemo(() => {
		if (!formData.id_user || !formData.kelas) return mapelList;
		const kbmMatches = kbmList.filter((k) => k.id_user === formData.id_user && k.kelas === formData.kelas);
		if (kbmMatches.length > 0) {
			const mapelNames = new Set(kbmMatches.map((k) => k.mapel));
			return mapelList.filter((m) => mapelNames.has(m.mapel));
		}
		return mapelList;
	}, [formData.id_user, formData.kelas, kbmList, mapelList]);

	// Filter Jadwal
	const filteredJadwal = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		return jadwalList.filter((item) => {
			const isSameHari = (h1, h2) => {
				const s1 = String(h1 || '').trim().toLowerCase();
				const s2 = String(h2 || '').trim().toLowerCase();
				return s1 === s2 || ((s1 === 'minggu' || s1 === 'ahad') && (s2 === 'minggu' || s2 === 'ahad'));
			};
			const matchHari = selectedHari === 'all' || isSameHari(item.hari, selectedHari);
			const matchTarget =
				selectedTarget === 'all' ||
				(viewMode === 'kelas' ? item.kelas === selectedTarget : item.id_user === selectedTarget);

			const matchSearch =
				!q ||
				item.mapel?.toLowerCase().includes(q) ||
				item.kelas?.toLowerCase().includes(q) ||
				item.hari?.toLowerCase().includes(q) ||
				item.users?.nama_lengkap?.toLowerCase().includes(q) ||
				item.users?.username?.toLowerCase().includes(q);

			return matchHari && matchTarget && matchSearch;
		});
	}, [jadwalList, selectedHari, selectedTarget, viewMode, searchQuery]);

	// Statistik
	const scheduleStats = useMemo(() => {
		const scheduledClasses = new Set(jadwalList.map((j) => j.kelas)).size;
		const scheduledTeachers = new Set(jadwalList.map((j) => j.id_user)).size;
		return {
			totalSlots: jadwalList.length,
			scheduledClasses,
			scheduledTeachers,
			collisionsCount: collisionAlerts.length,
		};
	}, [jadwalList, collisionAlerts]);

	// ---------------------------------------------------------------------------
	// FITUR EXPORT JADWAL KE EXCEL
	// ---------------------------------------------------------------------------
	const handleExportExcel = () => {
		try {
			if (filteredJadwal.length === 0) {
				Swal.fire('Data Kosong', 'Tidak ada data jadwal pelajaran yang cocok untuk diekspor.', 'info');
				return;
			}

			const exportRows = filteredJadwal.map((slot, idx) => ({
				No: idx + 1,
				Hari: slot.hari,
				'Jam Ke': slot.jam_ke || '-',
				'Jam Mulai': slot.jam_mulai || '',
				'Jam Selesai': slot.jam_selesai || '',
				'Rombel Kelas': slot.kelas,
				'Mata Pelajaran': slot.mapel,
				'Nama Guru': slot.users?.nama_lengkap || 'Akun Guru',
				'Username Guru': slot.users?.username || '-',
				'Tahun Ajaran': slot.tahun_ajar || tahunAjarAktif || '2026/2027',
				Semester: slot.semester || semesterAktif || 1,
			}));

			const ws = XLSX.utils.json_to_sheet(exportRows);
			ws['!cols'] = [
				{ wch: 6 },
				{ wch: 12 },
				{ wch: 10 },
				{ wch: 12 },
				{ wch: 12 },
				{ wch: 14 },
				{ wch: 28 },
				{ wch: 32 },
				{ wch: 20 },
				{ wch: 16 },
				{ wch: 10 },
			];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, 'Master_Jadwal_KBM');

			const fileName = `Master_Jadwal_KBM_${(tahunAjarAktif || '2026-2027').replace('/', '-')}_Sem${semesterAktif || 1}.xlsx`;
			XLSX.writeFile(wb, fileName);

			Swal.fire('Berhasil!', `Data jadwal (${filteredJadwal.length} sesi) berhasil diekspor.`, 'success');
		} catch (err) {
			console.error('Export Excel error:', err);
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR EKSPOR JADWAL KE PDF RESMI (KOP SURAT & MATRIKS)
	// ---------------------------------------------------------------------------
	const handleExportPDF = () => {
		try {
			if (filteredJadwal.length === 0) {
				Swal.fire('Data Kosong', 'Tidak ada data jadwal pelajaran yang cocok untuk diekspor ke PDF.', 'info');
				return;
			}

			const doc = new jsPDF('landscape');
			drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(13);
			doc.text('MASTER JADWAL PELAJARAN (TIMETABLE KBM)', 148, 48, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9.5);
			const targetLabel =
				viewMode === 'kelas'
					? selectedTarget === 'all'
						? 'Semua Rombel Kelas'
						: `Rombel: ${selectedTarget}`
					: selectedTarget === 'all'
					? 'Semua Dewan Guru'
					: `Guru: ${guruList.find((g) => g.id_user === selectedTarget)?.nama_lengkap || selectedTarget}`;

			const hariLabel = selectedHari === 'all' ? 'Semua Hari' : `Hari: ${selectedHari}`;
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '2026/2027'} | Semester: ${semesterAktif || 1} | ${targetLabel} | ${hariLabel}`,
				148,
				54,
				{ align: 'center' }
			);

			const tableRows = filteredJadwal.map((slot, idx) => [
				idx + 1,
				slot.hari,
				`Jam ${slot.jam_ke || '-'}`,
				`${slot.jam_mulai} - ${slot.jam_selesai}`,
				slot.kelas,
				slot.mapel,
				slot.users?.nama_lengkap || 'Akun Guru',
			]);

			autoTable(doc, {
				startY: 60,
				head: [['No', 'Hari', 'Jam Ke', 'Waktu Belajar', 'Kelas', 'Mata Pelajaran', 'Guru Pengampu']],
				body: tableRows,
				theme: 'grid',
				headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
				styles: { fontSize: 8.5, cellPadding: 2 },
			});

			// Tanda Tangan Pengesahan di Bawah
			const finalY = doc.lastAutoTable?.finalY || 140;
			const pageHeight = doc.internal.pageSize.getHeight();
			if (finalY + 36 < pageHeight) {
				doc.setFontSize(8.5);
				doc.text(`Mengetahui,`, 30, finalY + 12);
				doc.text(`Kepala Sekolah`, 30, finalY + 17);
				doc.text(`( ......................................... )`, 30, finalY + 34);

				const kota = schoolProfile?.kota || 'Tempat';
				doc.text(`Ditetapkan di: ${kota}`, 215, finalY + 12);
				doc.text(`Waka Kurikulum`, 215, finalY + 17);
				doc.text(`( ......................................... )`, 215, finalY + 34);
			}

			const fileName = `Master_Jadwal_KBM_${(tahunAjarAktif || '2026-2027').replace('/', '-')}_Sem${semesterAktif || 1}.pdf`;
			doc.save(fileName);
			Swal.fire('Berhasil!', `Dokumen matriks jadwal PDF (${filteredJadwal.length} sesi) berhasil diunduh.`, 'success');
		} catch (err) {
			console.error('Export PDF error:', err);
			Swal.fire('Gagal Export PDF', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR UNDUH TEMPLATE EXCEL RESMI DENGAN REFERENSI LIVE
	// ---------------------------------------------------------------------------
	const handleDownloadTemplate = () => {
		try {
			// Sheet 1: Contoh Template Jadwal
			const sampleData = [
				{
					No: 1,
					Hari: 'Senin',
					'Jam Ke': 1,
					'Jam Mulai (HH:mm)': '07:30',
					'Jam Selesai (HH:mm)': '08:15',
					Kelas: kelasList[0]?.nama_kelas || '7A',
					'Mata Pelajaran': mapelList[0]?.mapel || 'Matematika',
					'Username Guru': guruList[0]?.username || 'budi_santoso',
					'Nama Guru (Opsional)': guruList[0]?.nama_lengkap || 'Drs. Budi Santoso',
				},
				{
					No: 2,
					Hari: 'Senin',
					'Jam Ke': 2,
					'Jam Mulai (HH:mm)': '08:15',
					'Jam Selesai (HH:mm)': '09:00',
					Kelas: kelasList[0]?.nama_kelas || '7A',
					'Mata Pelajaran': mapelList[0]?.mapel || 'Matematika',
					'Username Guru': guruList[0]?.username || 'budi_santoso',
					'Nama Guru (Opsional)': guruList[0]?.nama_lengkap || 'Drs. Budi Santoso',
				},
				{
					No: 3,
					Hari: 'Senin',
					'Jam Ke': 1,
					'Jam Mulai (HH:mm)': '07:30',
					'Jam Selesai (HH:mm)': '08:15',
					Kelas: kelasList[1]?.nama_kelas || '7B',
					'Mata Pelajaran': mapelList[1]?.mapel || 'Bahasa Indonesia',
					'Username Guru': guruList[1]?.username || 'siti_aminah',
					'Nama Guru (Opsional)': guruList[1]?.nama_lengkap || 'Siti Aminah, S.Pd',
				},
				{
					No: 4,
					Hari: 'Selasa',
					'Jam Ke': 3,
					'Jam Mulai (HH:mm)': '09:00',
					'Jam Selesai (HH:mm)': '09:45',
					Kelas: kelasList[2]?.nama_kelas || '8A',
					'Mata Pelajaran': mapelList[2]?.mapel || 'Informatika',
					'Username Guru': guruList[2]?.username || 'ahmad_ridwan',
					'Nama Guru (Opsional)': guruList[2]?.nama_lengkap || 'Ahmad Ridwan, S.Kom',
				},
			];

			const wsTemplate = XLSX.utils.json_to_sheet(sampleData);
			wsTemplate['!cols'] = [
				{ wch: 6 },
				{ wch: 12 },
				{ wch: 10 },
				{ wch: 18 },
				{ wch: 18 },
				{ wch: 14 },
				{ wch: 28 },
				{ wch: 22 },
				{ wch: 32 },
			];

			// Sheet 2: Daftar Jam & Hari Standar
			const wsJam = XLSX.utils.json_to_sheet(
				STANDARD_JAM_SLOTS.map((s) => ({
					'Jam Ke': s.jam_ke,
					Keterangan: s.label,
					'Jam Mulai': s.jam_mulai,
					'Jam Selesai': s.jam_selesai,
				}))
			);
			wsJam['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];

			// Sheet 3: Referensi Guru
			const wsGuru = XLSX.utils.json_to_sheet(
				guruList.map((g, idx) => ({
					No: idx + 1,
					'Username Guru': g.username,
					'Nama Lengkap Guru': g.nama_lengkap,
				}))
			);
			wsGuru['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 36 }];

			// Sheet 4: Referensi Kelas
			const wsKelas = XLSX.utils.json_to_sheet(
				kelasList.map((k, idx) => ({
					No: idx + 1,
					'Nama Kelas / Rombel': k.nama_kelas,
				}))
			);
			wsKelas['!cols'] = [{ wch: 6 }, { wch: 24 }];

			// Sheet 5: Referensi Mapel
			const wsMapel = XLSX.utils.json_to_sheet(
				mapelList.map((m, idx) => ({
					No: idx + 1,
					'Nama Mata Pelajaran': m.mapel,
				}))
			);
			wsMapel['!cols'] = [{ wch: 6 }, { wch: 32 }];

			// Sheet 6: Petunjuk Pengisian
			const petunjukData = [
				{
					PANDUAN_IMPORT_JADWAL: 'PETUNJUK PENGISIAN TEMPLATE EXCEL MASTER JADWAL PELAJARAN',
					DETAIL: 'Mohon dibaca dengan teliti sebelum mengisi data',
				},
				{
					PANDUAN_IMPORT_JADWAL: '1. Hari Sekolah',
					DETAIL: 'Gunakan ejaan baku: Senin, Selasa, Rabu, Kamis, Jumat, atau Sabtu.',
				},
				{
					PANDUAN_IMPORT_JADWAL: '2. Format Waktu',
					DETAIL: 'Isi Jam Mulai dan Jam Selesai dengan format 24 jam HH:mm (contoh: 07:30, 08:15, 13:00).',
				},
				{
					PANDUAN_IMPORT_JADWAL: '3. Identifikasi Guru',
					DETAIL: 'Sistem mencocokkan guru berdasarkan "Username Guru". Pastikan sesuai lembar Daftar_Guru.',
				},
				{
					PANDUAN_IMPORT_JADWAL: '4. Kelas & Mapel',
					DETAIL: 'Pastikan nama Kelas dan Mapel sesuai persis dengan referensi lembar Daftar_Kelas dan Daftar_Mapel.',
				},
				{
					PANDUAN_IMPORT_JADWAL: '5. Pencegahan Bentrok',
					DETAIL: 'Sistem secara otomatis akan mendeteksi tabrakan jam guru atau kelas pada lembar pratinjau sebelum disimpan.',
				},
			];
			const wsPetunjuk = XLSX.utils.json_to_sheet(petunjukData);
			wsPetunjuk['!cols'] = [{ wch: 34 }, { wch: 80 }];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template_Jadwal');
			XLSX.utils.book_append_sheet(wb, wsJam, 'Daftar_Hari_Jam');
			XLSX.utils.book_append_sheet(wb, wsGuru, 'Daftar_Guru');
			XLSX.utils.book_append_sheet(wb, wsKelas, 'Daftar_Kelas');
			XLSX.utils.book_append_sheet(wb, wsMapel, 'Daftar_Mapel');
			XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk_Pengisian');

			XLSX.writeFile(wb, 'Template_Master_Jadwal_Kurikulum.xlsx');
			Swal.fire('Template Diunduh!', 'Berkas Template_Master_Jadwal_Kurikulum.xlsx siap diisi.', 'success');
		} catch (err) {
			console.error('Download template error:', err);
			Swal.fire('Gagal Mengunduh Template', err.message, 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// FITUR PARSER FILE EXCEL & VALIDASI COLLISION PRATINJAU
	// ---------------------------------------------------------------------------
	const handleFileChange = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			setImportFile(file);
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data, { type: 'array' });

			const firstSheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[firstSheetName];
			const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

			if (rawRows.length === 0) {
				Swal.fire('File Kosong', 'Tidak ditemukan baris data pada lembar kerja Excel ini.', 'warning');
				setImportPreviewRows([]);
				return;
			}

			// Buat peta guru, kelas, mapel untuk lookup cepat
			const guruByUsername = {};
			const guruByName = {};
			guruList.forEach((g) => {
				guruByUsername[g.username.toLowerCase().trim()] = g;
				guruByName[g.nama_lengkap.toLowerCase().trim()] = g;
			});

			const kelasSet = new Set(kelasList.map((k) => k.nama_kelas.toLowerCase().trim()));
			const mapelSet = new Set(mapelList.map((m) => m.mapel.toLowerCase().trim()));
			const validHariSet = new Set([...HARI_SEKOLAH.map((h) => h.toLowerCase()), 'ahad']);

			// Tracking collision dalam berkas import itu sendiri
			const inMemorySlots = [];

			const parsed = rawRows.map((row, idx) => {
				const rowNumber = idx + 2;

				// Normalisasi pembacaan header kolom fleksibel
				const rawHari = String(row['Hari'] || row['HARI'] || row['hari'] || '').trim();
				const rawJamKe = String(row['Jam Ke'] || row['JAM KE'] || row['jam_ke'] || row['Jam'] || '1').trim();
				const rawMulai = formatTimeValue(row['Jam Mulai (HH:mm)'] || row['Jam Mulai'] || row['jam_mulai'] || row['Mulai'] || '07:30');
				const rawSelesai = formatTimeValue(row['Jam Selesai (HH:mm)'] || row['Jam Selesai'] || row['jam_selesai'] || row['Selesai'] || '08:15');
				const rawKelas = String(row['Kelas'] || row['KELAS'] || row['kelas'] || '').trim();
				const rawMapel = String(row['Mata Pelajaran'] || row['MAPEL'] || row['mapel'] || row['Mapel'] || '').trim();
				const rawUsername = String(row['Username Guru'] || row['Username'] || row['username'] || '').trim();
				const rawNama = String(row['Nama Guru (Opsional)'] || row['Nama Guru'] || row['nama_guru'] || '').trim();

				// Cari nama hari baku
				const lookupHari = rawHari.toLowerCase() === 'ahad' ? 'minggu' : rawHari.toLowerCase();
				const matchedHari = HARI_SEKOLAH.find((h) => h.toLowerCase() === lookupHari) || rawHari;

				// Cari Guru
				let matchedGuru = null;
				if (rawUsername && guruByUsername[rawUsername.toLowerCase()]) {
					matchedGuru = guruByUsername[rawUsername.toLowerCase()];
				} else if (rawNama && guruByName[rawNama.toLowerCase()]) {
					matchedGuru = guruByName[rawNama.toLowerCase()];
				}

				// Cari Kelas & Mapel
				const matchedKelas = kelasList.find((k) => k.nama_kelas.toLowerCase().trim() === rawKelas.toLowerCase())?.nama_kelas || rawKelas;
				const matchedMapel = mapelList.find((m) => m.mapel.toLowerCase().trim() === rawMapel.toLowerCase())?.mapel || rawMapel;

				let status = 'VALID';
				let message = 'Siap Diimpor';

				// Validasi 1: Kelengkapan Data Pokok
				if (!rawHari || !validHariSet.has(rawHari.toLowerCase())) {
					status = 'ERROR';
					message = `Hari tidak valid (pilih: ${HARI_SEKOLAH.join(', ')})`;
				} else if (!rawKelas || !kelasSet.has(rawKelas.toLowerCase())) {
					status = 'ERROR';
					message = `Kelas "${rawKelas}" tidak terdaftar di sistem`;
				} else if (!rawMapel || !mapelSet.has(rawMapel.toLowerCase())) {
					status = 'ERROR';
					message = `Mapel "${rawMapel}" tidak terdaftar di sistem`;
				} else if (!matchedGuru) {
					status = 'ERROR';
					message = `Guru "${rawUsername || rawNama}" tidak ditemukan`;
				}

				// Validasi 2: Collision & Bentrok jika lolos data pokok
				if (status === 'VALID') {
					// Cek duplicate identik di DB
					const isExactDuplicateInDB = jadwalList.some(
						(db) =>
							db.hari === matchedHari &&
							db.kelas === matchedKelas &&
							db.mapel === matchedMapel &&
							db.id_user === matchedGuru.id_user &&
							(db.jam_ke === rawJamKe || db.jam_mulai === rawMulai)
					);

					if (isExactDuplicateInDB) {
						status = 'DUPLICATE';
						message = 'Slot jadwal identik sudah ada di database';
					} else {
						// Cek bentrok jam guru di DB (guru sama mengajar di kelas lain pada jam sama)
						const teacherCollisionInDB = jadwalList.find(
							(db) =>
								db.id_user === matchedGuru.id_user &&
								db.hari === matchedHari &&
								db.kelas !== matchedKelas &&
								(db.jam_ke === rawJamKe || (db.jam_mulai < rawSelesai && rawMulai < db.jam_selesai))
						);

						// Cek bentrok kelas di DB (kelas sama diajar guru lain pada jam sama)
						const classCollisionInDB = jadwalList.find(
							(db) =>
								db.kelas === matchedKelas &&
								db.hari === matchedHari &&
								db.id_user !== matchedGuru.id_user &&
								(db.jam_ke === rawJamKe || (db.jam_mulai < rawSelesai && rawMulai < db.jam_selesai))
						);

						if (teacherCollisionInDB) {
							status = 'WARNING';
							message = `Tabrakan Guru di DB: sudah ada di kelas ${teacherCollisionInDB.kelas}`;
						} else if (classCollisionInDB) {
							status = 'WARNING';
							message = `Tabrakan Kelas di DB: sedang diajar ${classCollisionInDB.mapel}`;
						} else {
							// Cek collision antar baris dalam berkas yang sama
							const fileTeacherCollision = inMemorySlots.find(
								(mem) =>
									mem.id_user === matchedGuru.id_user &&
									mem.hari === matchedHari &&
									mem.kelas !== matchedKelas &&
									(mem.jam_ke === rawJamKe || (mem.jam_mulai < rawSelesai && rawMulai < mem.jam_selesai))
							);

							const fileClassCollision = inMemorySlots.find(
								(mem) =>
									mem.kelas === matchedKelas &&
									mem.hari === matchedHari &&
									mem.id_user !== matchedGuru.id_user &&
									(mem.jam_ke === rawJamKe || (mem.jam_mulai < rawSelesai && rawMulai < mem.jam_selesai))
							);

							if (fileTeacherCollision) {
								status = 'WARNING';
								message = `Bentrok di file (baris ${fileTeacherCollision.rowNumber}): guru mengajar di kelas ${fileTeacherCollision.kelas}`;
							} else if (fileClassCollision) {
								status = 'WARNING';
								message = `Bentrok di file (baris ${fileClassCollision.rowNumber}): kelas diajar ${fileClassCollision.mapel}`;
							}
						}
					}
				}

				// Catat ke in-memory jika valid atau warning
				if (matchedGuru && status !== 'ERROR') {
					inMemorySlots.push({
						rowNumber,
						id_user: matchedGuru.id_user,
						hari: matchedHari,
						kelas: matchedKelas,
						mapel: matchedMapel,
						jam_ke: rawJamKe,
						jam_mulai: rawMulai,
						jam_selesai: rawSelesai,
					});
				}

				return {
					rowNumber,
					hari: matchedHari,
					jam_ke: rawJamKe,
					jam_mulai: rawMulai,
					jam_selesai: rawSelesai,
					kelas: matchedKelas,
					mapel: matchedMapel,
					guru: matchedGuru,
					rawUsername,
					rawNama,
					status,
					message,
				};
			});

			setImportPreviewRows(parsed);
		} catch (err) {
			console.error('Parse file error:', err);
			Swal.fire('Gagal Membaca File', 'Pastikan format berkas Excel (.xlsx / .xls) valid.', 'error');
		}
	};

	// ---------------------------------------------------------------------------
	// EKSEKUSI BULK IMPORT KE API
	// ---------------------------------------------------------------------------
	const handleExecuteBulkImport = async () => {
		const validRows = importPreviewRows.filter((r) => r.status === 'VALID');

		if (validRows.length === 0) {
			Swal.fire('Tidak Ada Data Valid', 'Tidak ditemukan baris yang siap diimpor.', 'warning');
			return;
		}

		const confirm = await Swal.fire({
			title: 'Konfirmasi Bulk Import Jadwal',
			html: `Apakah Anda yakin ingin mengimpor <b>${validRows.length} slot jadwal</b> ke sistem?`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			confirmButtonText: `Ya, Impor ${validRows.length} Jadwal`,
			cancelButtonText: 'Batal',
		});

		if (confirm.isConfirmed) {
			try {
				setIsImporting(true);

				const payload = validRows.map((r) => ({
					id_user: r.guru.id_user,
					kelas: r.kelas,
					mapel: r.mapel,
					hari: r.hari,
					jam_ke: r.jam_ke || '',
					jam_mulai: r.jam_mulai,
					jam_selesai: r.jam_selesai,
					tahun_ajar: tahunAjarAktif || '2026/2027',
					semester: semesterAktif ? parseInt(semesterAktif) : 1,
				}));

				const res = await fetch('/api/jadwal', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				const resData = await res.json();
				if (!res.ok) throw new Error(resData.error || 'Gagal melakukan bulk import jadwal.');

				Swal.fire({
					title: 'Import Sukses!',
					html: `Sebanyak <b>${validRows.length} slot jadwal KBM</b> berhasil dicatat ke matriks jadwal sekolah.`,
					icon: 'success',
					confirmButtonColor: '#F59E0B',
				});

				// Reset modal state
				setIsImportModalOpen(false);
				setImportFile(null);
				setImportPreviewRows([]);
				if (fileInputRef.current) fileInputRef.current.value = '';

				fetchAllData();
			} catch (err) {
				console.error('Import error:', err);
				Swal.fire('Gagal Impor', err.message, 'error');
			} finally {
				setIsImporting(false);
			}
		}
	};

	// Rekap Preview Import Counts
	const previewCounts = useMemo(() => {
		const valid = importPreviewRows.filter((r) => r.status === 'VALID').length;
		const warning = importPreviewRows.filter((r) => r.status === 'WARNING').length;
		const duplicate = importPreviewRows.filter((r) => r.status === 'DUPLICATE').length;
		const error = importPreviewRows.filter((r) => r.status === 'ERROR').length;
		return { valid, warning, duplicate, error, total: importPreviewRows.length };
	}, [importPreviewRows]);

	// Submit Slot Jadwal Satuan (Modal Manual)
	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			setIsSaving(true);
			const method = isEditMode ? 'PUT' : 'POST';
			const payload = isEditMode
				? { ...formData, id: editId }
				: {
						...formData,
						tahun_ajar: tahunAjarAktif || '2026/2027',
						semester: semesterAktif ? parseInt(semesterAktif) : 1,
				  };

			const res = await fetch('/api/jadwal', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan slot jadwal.');

			Swal.fire('Berhasil!', isEditMode ? 'Jadwal berhasil diperbarui.' : 'Slot jadwal berhasil ditambahkan.', 'success');
			setIsModalOpen(false);
			fetchAllData();
		} catch (err) {
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setIsSaving(false);
		}
	};

	// Open Edit
	const handleEdit = (item) => {
		setIsEditMode(true);
		setEditId(item.id);
		setFormData({
			id_user: item.id_user,
			kelas: item.kelas,
			mapel: item.mapel,
			hari: item.hari,
			jam_ke: item.jam_ke || '1',
			jam_mulai: item.jam_mulai || '07:30',
			jam_selesai: item.jam_selesai || '08:15',
		});
		setIsModalOpen(true);
	};

	// Delete Slot
	const handleDelete = async (id, nama_guru, kelas, hari, jam) => {
		const result = await Swal.fire({
			title: 'Hapus Sesi Jadwal?',
			html: `Hapus jadwal <b>${nama_guru}</b> di kelas <b>${kelas}</b> pada <b>${hari} (${jam})</b>?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch('/api/jadwal', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal menghapus slot.');

				Swal.fire('Dihapus!', 'Sesi jadwal telah dicabut.', 'success');
				fetchAllData();
			} catch (err) {
				Swal.fire('Gagal Menghapus', err.message, 'error');
			}
		}
	};

	if (loading) return <Loader text='Memuat Master Jadwal Pelajaran...' />;

	return (
		<div className='space-y-6'>
			{/* HEADER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col lg:flex-row lg:items-center justify-between gap-5'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded tracking-wider'>
							Pengorganisasian KBM
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2.5'>
						<span>📅</span> Master Jadwal Pelajaran
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl leading-relaxed'>
						Penyusunan matriks jadwal KBM sekolah terpadu, validasi tabrakan jam guru (anti-bentrok otomatis), serta pendistribusian jam tatap muka harian.
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-2.5 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={() => {
							setIsImportModalOpen(true);
							setImportFile(null);
							setImportPreviewRows([]);
						}}
						className='px-3.5 sm:px-4 py-2.5 bg-white hover:bg-neutral-100 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📥</span> Import Excel
					</button>
					<button
						onClick={() => {
							setIsEditMode(false);
							setEditId(null);
							setFormData({
								id_user: '',
								kelas: '',
								mapel: '',
								hari: 'Senin',
								jam_ke: '1',
								jam_mulai: '07:30',
								jam_selesai: '08:15',
							});
							setIsModalOpen(true);
						}}
						className='px-4 sm:px-5 py-2.5 bg-black text-white hover:bg-neutral-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>➕</span> Plot Slot Jadwal
					</button>
				</div>
			</div>

			{/* STAT HIGHLIGHT CARDS */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Total Sesi Jadwal</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{scheduleStats.totalSlots}</p>
					<p className='text-[10px] font-bold text-sky-700 mt-1'>Sesi KBM Terplot</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Status Tabrakan</p>
					<p
						className={`text-2xl sm:text-3xl font-black mt-0.5 ${
							scheduleStats.collisionsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
						}`}>
						{scheduleStats.collisionsCount} Bentrok
					</p>
					<p className='text-[10px] font-bold text-gray-500 mt-1'>
						{scheduleStats.collisionsCount === 0 ? 'Matriks Jam Sinkron & Aman' : 'Perlu Penyesuaian Jadwal'}
					</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Rombel Terjadwal</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>
						{scheduleStats.scheduledClasses} / {kelasList.length}
					</p>
					<p className='text-[10px] font-bold text-amber-700 mt-1'>Kelas Memiliki Jadwal</p>
				</div>
				<div className='bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<p className='text-xs font-black uppercase text-gray-600'>Guru Mengajar</p>
					<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>
						{scheduleStats.scheduledTeachers} / {guruList.length}
					</p>
					<p className='text-[10px] font-bold text-purple-700 mt-1'>Dewan Guru Bertugas</p>
				</div>
			</div>

			{/* COLLISION ALERT NOTIFICATION */}
			{collisionAlerts.length > 0 && (
				<div className='bg-rose-100 border-3 border-rose-600 rounded-2xl p-4 shadow-[4px_4px_0px_0px_#991B1B] animate-pulse'>
					<div className='flex items-center gap-2 text-rose-900 font-black text-sm'>
						<span>⚠️</span> TERDETEKSI {collisionAlerts.length} TABRAKAN JAM (JADWAL BENTROK):
					</div>
					<div className='mt-2.5 space-y-1.5'>
						{collisionAlerts.map((c, idx) => (
							<div
								key={idx}
								className='text-xs font-bold text-rose-900 bg-white/80 p-2.5 rounded-xl border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5'>
								<span>
									<strong>{c.title}</strong> pada hari <strong>{c.hari}</strong> ({c.jam}): {c.detail}
								</span>
								<span className='px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-black uppercase shrink-0 self-start sm:self-auto'>
									Bentrok
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* VIEW CONTROLS & FILTER BAR */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3'>
				<div className='flex flex-wrap items-center gap-3 flex-1'>
					{/* Mode Switcher */}
					<div className='bg-[#FEF08A] p-1 border-2 border-black rounded-xl flex items-center shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						<button
							onClick={() => {
								setViewMode('kelas');
								setSelectedTarget('all');
							}}
							className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
								viewMode === 'kelas' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
							}`}>
							🏫 Per Rombel
						</button>
						<button
							onClick={() => {
								setViewMode('guru');
								setSelectedTarget('all');
							}}
							className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
								viewMode === 'guru' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
							}`}>
							👨‍🏫 Per Guru
						</button>
					</div>

					{/* Target Selector */}
					<select
						value={selectedTarget}
						onChange={(e) => setSelectedTarget(e.target.value)}
						className='px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0] focus:outline-none cursor-pointer'>
						<option value='all'>Semua {viewMode === 'kelas' ? 'Kelas' : 'Guru'}</option>
						{viewMode === 'kelas'
							? kelasList.map((k) => (
									<option key={k.id} value={k.nama_kelas}>
										{k.nama_kelas}
									</option>
							  ))
							: guruList.map((g) => (
									<option key={g.id_user} value={g.id_user}>
										{g.nama_lengkap}
									</option>
							  ))}
					</select>

					{/* Hari Selector */}
					<div className='flex items-center gap-1 overflow-x-auto pb-0.5'>
						<button
							onClick={() => setSelectedHari('all')}
							className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase border-2 transition-all shrink-0 ${
								selectedHari === 'all'
									? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_0px_#0D0D0D]'
									: 'bg-white text-black border-gray-300 hover:border-black'
							}`}>
							Semua
						</button>
						{HARI_SEKOLAH.map((h) => (
							<button
								key={h}
								onClick={() => setSelectedHari(h)}
								className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase border-2 transition-all shrink-0 ${
									selectedHari === h
										? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_0px_#0D0D0D]'
										: 'bg-white text-black border-gray-300 hover:border-black'
								}`}>
								{h}
							</button>
						))}
					</div>

					{/* Search Field */}
					<div className='relative flex-1 min-w-[200px]'>
						<span className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-xs'>
							🔍
						</span>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari mapel, guru, kelas...'
							className='w-full pl-8 pr-7 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0] focus:outline-none focus:ring-2 focus:ring-amber-400'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className='absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs font-bold text-gray-400 hover:text-black'>
								✕
							</button>
						)}
					</div>
				</div>

				{/* Action Buttons */}
				<div className='flex items-center gap-2 justify-end shrink-0'>
					<button
						onClick={handleExportExcel}
						className='px-3.5 py-2 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📊</span> Ekspor Excel ({filteredJadwal.length})
					</button>
					<button
						onClick={handleExportPDF}
						className='px-3.5 py-2 bg-rose-200 hover:bg-rose-300 text-rose-950 font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
						<span>📄</span> Ekspor PDF
					</button>
				</div>
			</div>

			{/* DAFTAR JADWAL / TIMETABLE VIEW */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
						<span>📋</span> Matriks Jadwal ({filteredJadwal.length} Sesi Terjadwal)
					</h2>
					<span className='text-xs font-bold text-gray-500'>
						Menampilkan jadwal aktif TA {tahunAjarAktif || '2026/2027'} (Sem {semesterAktif || 1})
					</span>
				</div>

				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
								<th className='py-3 px-3'>Hari</th>
								<th className='py-3 px-3'>Jam Ke-</th>
								<th className='py-3 px-3'>Waktu Belajar</th>
								<th className='py-3 px-3'>Rombel Kelas</th>
								<th className='py-3 px-3'>Mata Pelajaran</th>
								<th className='py-3 px-3'>Guru Pengampu</th>
								<th className='py-3 px-3 text-right print:hidden'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
							{filteredJadwal.length === 0 ? (
								<tr>
									<td colSpan={7} className='text-center py-8 text-gray-500'>
										Tidak ada jadwal KBM yang sesuai dengan kriteria filter.
									</td>
								</tr>
							) : (
								filteredJadwal.map((slot) => (
									<tr key={slot.id} className='hover:bg-amber-50/60 transition-colors'>
										<td className='py-3 px-3'>
											<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
												{slot.hari}
											</span>
										</td>
										<td className='py-3 px-3 font-mono font-black'>Jam ke-{slot.jam_ke || '-'}</td>
										<td className='py-3 px-3 font-mono text-gray-700'>
											{slot.jam_mulai} - {slot.jam_selesai}
										</td>
										<td className='py-3 px-3'>
											<span className='px-2.5 py-1 bg-sky-100 border border-black rounded-lg text-xs font-black text-sky-950 inline-block shadow-[1px_1px_0px_0px_#0D0D0D]'>
												🏫 {slot.kelas}
											</span>
										</td>
										<td className='py-3 px-3'>
											<span className='px-2.5 py-1 bg-amber-100 border border-black rounded-lg text-xs font-black text-amber-950 inline-block shadow-[1px_1px_0px_0px_#0D0D0D]'>
												📚 {slot.mapel}
											</span>
										</td>
										<td className='py-3 px-3'>
											<div>
												<span className='font-black text-black block text-sm'>
													{slot.users?.nama_lengkap || 'Akun Guru'}
												</span>
												<span className='text-[10px] font-mono text-gray-500'>
													@{slot.users?.username || '-'}
												</span>
											</div>
										</td>
										<td className='py-3 px-3 text-right space-x-1.5 print:hidden'>
											<button
												onClick={() => handleEdit(slot)}
												className='px-2.5 py-1 bg-amber-300 hover:bg-amber-400 text-black border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
												Edit
											</button>
											<button
												onClick={() =>
													handleDelete(
														slot.id,
														slot.users?.nama_lengkap,
														slot.kelas,
														slot.hari,
														`${slot.jam_mulai}-${slot.jam_selesai}`
													)
												}
												className='px-2.5 py-1 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-lg font-black text-xs shadow-[1.5px_1.5px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
												Hapus
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* MODAL BULK IMPORT EXCEL JADWAL */}
			{isImportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-4xl shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3 shrink-0'>
							<div>
								<h3 className='text-lg font-black flex items-center gap-2'>
									<span>📥</span> Import Banyak Jadwal Pelajaran Sekaligus
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Unggah berkas Excel (.xlsx / .xls) untuk memetakan jadwal mata pelajaran dan jam tatap muka massal.
								</p>
							</div>
							<button
								onClick={() => setIsImportModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black cursor-pointer'>
								✕
							</button>
						</div>

						<div className='flex-1 overflow-y-auto space-y-4 pr-1'>
							{/* Step 1: Download Template Banner */}
							<div className='bg-emerald-50 border-2 border-black rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
								<div className='flex items-center gap-3'>
									<div className='w-9 h-9 bg-emerald-400 border-2 border-black rounded-lg flex items-center justify-center font-black text-sm shrink-0'>
										📄
									</div>
									<div>
										<p className='text-xs font-black text-emerald-950 uppercase'>Gunakan Template Resmi Sekolah</p>
										<p className='text-[11px] font-bold text-emerald-800 mt-0.5'>
											Template multi-sheet dilengkapi referensi Hari/Jam standar, daftar Guru, Rombel, dan Mapel aktif.
										</p>
									</div>
								</div>
								<button
									onClick={handleDownloadTemplate}
									type='button'
									className='px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-950 border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 flex items-center justify-center gap-1.5 cursor-pointer'>
									<span>⬇️</span> Unduh Template (.xlsx)
								</button>
							</div>

							{/* Step 2: Upload File Area */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black uppercase text-black'>
									Pilih File Excel Jadwal (.xlsx / .xls)
								</label>
								<div className='border-2 border-dashed border-black rounded-xl p-4 bg-[#FFFDF0] flex flex-col items-center justify-center text-center gap-2'>
									<input
										ref={fileInputRef}
										type='file'
										accept='.xlsx, .xls'
										onChange={handleFileChange}
										className='text-xs font-bold file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:bg-yellow-300 file:shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
									/>
									<span className='text-[10px] text-gray-500 font-bold'>
										Format didukung: Microsoft Excel Worksheet (.xlsx, .xls)
									</span>
								</div>
							</div>

							{/* Step 3: Preview Data Table */}
							{importPreviewRows.length > 0 && (
								<div className='space-y-3 pt-2'>
									<div className='flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2'>
										<h4 className='text-xs font-black uppercase text-black flex items-center gap-2'>
											<span>🔍</span> Hasil Analisis Berkas ({previewCounts.total} Baris)
										</h4>
										<div className='flex items-center gap-1.5 text-[10px] font-black'>
											<span className='px-2 py-0.5 bg-emerald-200 border border-emerald-500 rounded text-emerald-950'>
												✓ {previewCounts.valid} Valid
											</span>
											{previewCounts.warning > 0 && (
												<span className='px-2 py-0.5 bg-amber-200 border border-amber-500 rounded text-amber-950'>
													⚠️ {previewCounts.warning} Bentrok/Peringatan
												</span>
											)}
											{previewCounts.duplicate > 0 && (
												<span className='px-2 py-0.5 bg-gray-200 border border-gray-500 rounded text-gray-900'>
													📋 {previewCounts.duplicate} Duplikat
												</span>
											)}
											{previewCounts.error > 0 && (
												<span className='px-2 py-0.5 bg-rose-200 border border-rose-500 rounded text-rose-950'>
													✕ {previewCounts.error} Error
												</span>
											)}
										</div>
									</div>

									<div className='border-2 border-black rounded-xl overflow-hidden max-h-56 overflow-y-auto'>
										<table className='w-full text-left border-collapse text-xs'>
											<thead className='sticky top-0 bg-yellow-100 border-b-2 border-black text-[10px] font-black uppercase'>
												<tr>
													<th className='py-2 px-2.5'>Baris</th>
													<th className='py-2 px-2.5'>Hari & Waktu</th>
													<th className='py-2 px-2.5'>Kelas</th>
													<th className='py-2 px-2.5'>Mata Pelajaran</th>
													<th className='py-2 px-2.5'>Guru Pengampu</th>
													<th className='py-2 px-2.5 text-right'>Status Validasi</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-gray-200 font-bold'>
												{importPreviewRows.map((r, idx) => (
													<tr
														key={idx}
														className={
															r.status === 'VALID'
																? 'bg-emerald-50/60'
																: r.status === 'WARNING' || r.status === 'DUPLICATE'
																? 'bg-amber-50/60'
																: 'bg-rose-50/60'
														}>
														<td className='py-2 px-2.5 font-mono text-[10px]'>{r.rowNumber}</td>
														<td className='py-2 px-2.5'>
															<span className='font-black block'>{r.hari}</span>
															<span className='text-[10px] font-mono text-gray-600'>
																Jam {r.jam_ke} ({r.jam_mulai}-{r.jam_selesai})
															</span>
														</td>
														<td className='py-2 px-2.5'>{r.kelas}</td>
														<td className='py-2 px-2.5'>{r.mapel}</td>
														<td className='py-2 px-2.5'>
															<span className='font-black block'>
																{r.guru?.nama_lengkap || r.rawNama || '-'}
															</span>
															<span className='text-[10px] font-mono text-gray-500'>
																@{r.guru?.username || r.rawUsername}
															</span>
														</td>
														<td className='py-2 px-2.5 text-right'>
															<span
																className={`px-2 py-0.5 text-[9px] font-black rounded border uppercase inline-block ${
																	r.status === 'VALID'
																		? 'bg-emerald-200 text-emerald-950 border-emerald-500'
																		: r.status === 'WARNING'
																		? 'bg-amber-200 text-amber-950 border-amber-500'
																		: r.status === 'DUPLICATE'
																		? 'bg-gray-200 text-gray-900 border-gray-400'
																		: 'bg-rose-200 text-rose-950 border-rose-500'
																}`}>
																{r.message}
															</span>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>

						{/* Footer Actions */}
						<div className='pt-3 border-t-2 border-black flex items-center justify-between shrink-0'>
							<span className='text-[11px] font-bold text-gray-500'>
								{previewCounts.valid > 0 ? (
									<span className='text-emerald-800 font-black'>
										✓ {previewCounts.valid} slot jadwal siap disimpan ke sistem.
									</span>
								) : (
									'Pilih file Excel untuk memulai pratinjau'
								)}
							</span>

							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={() => setIsImportModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100 cursor-pointer'>
									Batal
								</button>
								<button
									type='button'
									onClick={handleExecuteBulkImport}
									disabled={isImporting || previewCounts.valid === 0}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
									{isImporting ? 'Mengimpor...' : `Impor ${previewCounts.valid} Jadwal Valid`}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* MODAL TAMBAH / EDIT SLOT JADWAL MANUAL */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl w-full max-w-lg shadow-[6px_6px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h3 className='text-lg font-black flex items-center gap-2'>
								<span>{isEditMode ? '✏️' : '➕'}</span> {isEditMode ? 'Edit Sesi Jadwal' : 'Plot Slot Jadwal Baru'}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='p-1 border-2 border-black rounded-lg hover:bg-gray-100 text-xs font-black cursor-pointer'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1.5'>
									Dewan Guru Pengajar <span className='text-rose-600'>*</span>
								</label>
								<select
									value={formData.id_user}
									onChange={(e) => setFormData({ ...formData, id_user: e.target.value })}
									required
									className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
									<option value=''>-- Pilih Guru --</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap} (@{g.username})
										</option>
									))}
								</select>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Rombel Kelas <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
										required
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
										<option value=''>-- Pilih Kelas --</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.nama_kelas}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Mata Pelajaran <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.mapel}
										onChange={(e) => setFormData({ ...formData, mapel: e.target.value })}
										required
										className='w-full px-3.5 py-2.5 border-2 border-black rounded-xl font-bold text-xs sm:text-sm bg-[#FFFDF0]'>
										<option value=''>-- Pilih Mapel --</option>
										{availableMapelForModal.map((m) => (
											<option key={m.id} value={m.mapel}>
												{m.mapel}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>
										Hari <span className='text-rose-600'>*</span>
									</label>
									<select
										value={formData.hari}
										onChange={(e) => setFormData({ ...formData, hari: e.target.value })}
										required
										className='w-full px-2.5 py-2 border-2 border-black rounded-xl font-bold text-xs bg-[#FFFDF0]'>
										{HARI_SEKOLAH.map((h) => (
											<option key={h} value={h}>
												{h}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>Jam Ke-</label>
									<input
										type='text'
										value={formData.jam_ke}
										onChange={(e) => setFormData({ ...formData, jam_ke: e.target.value })}
										placeholder='1'
										className='w-full px-2.5 py-2 border-2 border-black rounded-xl font-mono font-bold text-xs bg-[#FFFDF0]'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>Mulai</label>
									<input
										type='time'
										value={formData.jam_mulai}
										onChange={(e) => setFormData({ ...formData, jam_mulai: e.target.value })}
										required
										className='w-full px-2 py-2 border-2 border-black rounded-xl font-mono font-bold text-xs bg-[#FFFDF0]'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1.5'>Selesai</label>
									<input
										type='time'
										value={formData.jam_selesai}
										onChange={(e) => setFormData({ ...formData, jam_selesai: e.target.value })}
										required
										className='w-full px-2 py-2 border-2 border-black rounded-xl font-mono font-bold text-xs bg-[#FFFDF0]'
									/>
								</div>
							</div>

							<div className='pt-3 border-t-2 border-black flex items-center justify-end gap-2.5'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100 cursor-pointer'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isSaving}
									className='px-5 py-2 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'>
									{isSaving ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Simpan Slot Jadwal'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
