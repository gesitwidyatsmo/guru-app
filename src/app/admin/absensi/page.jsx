'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import { useAdminAuth } from '../AdminLayoutClient';
import {
	normalizeJamKe,
	checkJamOverlap,
	calculateAttendanceSummary,
	normStatus,
	PRESET_JAM_PELAJARAN,
} from '@/lib/absensiUtils';
import { getTodayDateString } from '@/lib/dateUtils';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
	fetchSchoolProfile,
} from '@/lib/pdfKopSurat';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	Edit,
	Trash2,
	RefreshCw,
	Filter,
	Search,
	Calendar,
	Layers,
	Users,
	Scissors,
	ArrowRight,
	ExternalLink,
	ShieldCheck,
	Check,
	X,
	PlusCircle,
	UserCheck,
	Zap,
	LifeBuoy,
	AlertCircle,
	Sparkles,
	BookOpen,
	Link2,
	Unlink,
	FileDown,
	Printer,
	PhoneCall,
} from 'lucide-react';

const JP_SLOTS = [1, 2, 3, 4, 5, 6, 7];

const KENDALA_PRESETS = [
	{ id: 'hp_mati', label: 'HP Mati / Baterai Habis', icon: '🔋' },
	{ id: 'sinyal_hilang', label: 'Tidak Ada Sinyal / Kuota Habis', icon: '📶' },
	{ id: 'hp_rusak', label: 'Kerusakan HP / Perangkat', icon: '📱' },
	{ id: 'gps_error', label: 'Kendala GPS / Geofence', icon: '📍' },
	{ id: 'laporan_fisik', label: 'Laporan Presensi Fisik / Manual', icon: '📋' },
	{ id: 'lainnya', label: 'Kendala Teknis Lainnya', icon: '⚠️' },
];

export default function AdminAbsensiPage() {
	const { role, isKepsek } = useAdminAuth();
	const { tahunAjarAktif, semesterAktif } = useAcademic();

	// Tab Aktif: 'radar' | 'timeline' | 'semua'
	const [activeTab, setActiveTab] = useState('radar');

	// Main Data States
	const [loading, setLoading] = useState(true);
	const [sessions, setSessions] = useState([]);
	const [radarData, setRadarData] = useState({
		conflicts: [],
		unlinked: [],
		anomali: [],
		summary: { total_sessions: 0, conflicts_count: 0, unlinked_count: 0, anomali_count: 0 },
	});
	const [kelasList, setKelasList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Filters
	const [filterTanggal, setFilterTanggal] = useState(getTodayDateString());
	const [filterKelas, setFilterKelas] = useState('all');
	const [filterMapel, setFilterMapel] = useState('all');
	const [filterGuru, setFilterGuru] = useState('all');
	const [filterJurnal, setFilterJurnal] = useState('all'); // 'all' | 'linked' | 'unlinked'
	const [searchQuery, setSearchQuery] = useState('');
	const [radarFilter, setRadarFilter] = useState('all'); // 'all' | 'conflict' | 'unlinked' | 'anomali'

	// Timeline Matrix Filter
	const [timelineDate, setTimelineDate] = useState(getTodayDateString());
	const [timelineLevel, setTimelineLevel] = useState('all'); // 'all' | '7' | '8' | '9'

	// Modal Resolusi Bentrok Jam Presensi
	const [selectedConflict, setSelectedConflict] = useState(null);
	const [resolving, setResolving] = useState(false);
	const [resolveForm, setResolveForm] = useState({
		sesi_a_jam: '',
		sesi_b_jam: '',
		sync_jurnal: true,
	});

	// Modal Input Presensi Guru oleh Admin (Bantuan Kendala Teknis)
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [savingCreate, setSavingCreate] = useState(false);
	const [loadingRoster, setLoadingRoster] = useState(false);
	const [rosterSiswa, setRosterSiswa] = useState([]);
	const [teacherAssignments, setTeacherAssignments] = useState({});
	const [filterByTeacherAssignments, setFilterByTeacherAssignments] = useState(true);

	const initialCreateForm = {
		guru_id: '',
		kelas: '',
		mapel: '',
		tanggal: getTodayDateString(),
		jam_ke: '1-2',
		alasan_kendala: 'HP Mati / Baterai Habis',
		catatan_kendala: '',
		sync_jurnal: true,
		override_conflict: false,
	};
	const [createForm, setCreateForm] = useState(initialCreateForm);
	const [createAbsensiList, setCreateAbsensiList] = useState([]);

	// Modal Detail & Edit Presensi Siswa
	const [detailModalOpen, setDetailModalOpen] = useState(false);
	const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
	const [loadingDetailStudents, setLoadingDetailStudents] = useState(false);
	const [detailStudentRows, setDetailStudentRows] = useState([]);
	const [savingStudentEdits, setSavingStudentEdits] = useState(false);

	// Modal Edit Sesi Presensi
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingSession, setEditingSession] = useState(null);
	const [editForm, setEditForm] = useState({
		sesi_id: '',
		guru_id: '',
		kelas: '',
		mapel: '',
		tanggal: '',
		jam_ke: '',
		sync_jurnal: true,
		override_conflict: false,
	});
	const [savingEdit, setSavingEdit] = useState(false);

	// Modal Pecah Sesi (Split)
	const [splitModalOpen, setSplitModalOpen] = useState(false);
	const [splittingSession, setSplittingSession] = useState(null);
	const [splitForm, setSplitForm] = useState({
		sesi_1_jam: '',
		sesi_2_jam: '',
		siswa_alfa_ids: [],
	});
	const [savingSplit, setSavingSplit] = useState(false);

	// Modal Export / Cetak Laporan
	const [exportModalOpen, setExportModalOpen] = useState(false);
	const [exportFilterKelas, setExportFilterKelas] = useState('Semua');
	const [exportFilterMapel, setExportFilterMapel] = useState('Semua');
	const [exportStartDate, setExportStartDate] = useState(getTodayDateString());
	const [exportEndDate, setExportEndDate] = useState(getTodayDateString());
	const [exporting, setExporting] = useState(false);

	// Modal WhatsApp Hotline
	const [waModalOpen, setWaModalOpen] = useState(false);

	// 1. Fetch Master Data & Sessions
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);

			// Parallel load: Sessions, Radar, Master Classes, Master Teachers, Master Mapel, School Profile, Assignments
			const [resSessions, resRadar, resKelas, resUsers, resMapel, resAssign, pProfile] = await Promise.all([
				fetch('/api/admin/absensi', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/admin/absensi?radar=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { summary: {}, conflicts: [], unlinked: [], anomali: [] })),
				fetch('/api/kelas?all=true').then((r) => (r.ok ? r.json() : [])),
				fetch('/api/users').then((r) => (r.ok ? r.json() : [])),
				fetch('/api/mapel?all=true').then((r) => (r.ok ? r.json() : [])),
				fetch('/api/admin/absensi?teacher_assignments=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { assignments: {} })),
				fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
			]);

			setSessions(Array.isArray(resSessions) ? resSessions : []);
			setRadarData({
				conflicts: resRadar?.conflicts || [],
				unlinked: resRadar?.unlinked || [],
				anomali: resRadar?.anomali || [],
				summary: resRadar?.summary || { total_sessions: 0, conflicts_count: 0, unlinked_count: 0, anomali_count: 0 },
			});
			setKelasList(Array.isArray(resKelas) ? resKelas : []);
			setGuruList(Array.isArray(resUsers) ? resUsers.filter((u) => u.role === 'Guru') : []);
			setMapelList(Array.isArray(resMapel) ? resMapel : []);
			setTeacherAssignments(resAssign?.assignments || {});
			if (pProfile) setSchoolProfile(pProfile);
		} catch (err) {
			console.error('Gagal memuat data presensi admin:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: 'Terjadi kesalahan saat memuat data presensi dari server.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Fetch sesi khusus tanggal timeline saat timelineDate diubah
	useEffect(() => {
		if (!timelineDate) return;
		let isMounted = true;
		const loadDateSessions = async () => {
			try {
				const res = await fetch(`/api/admin/absensi?tanggal=${timelineDate}`, { credentials: 'include' });
				if (res.ok) {
					const dateData = await res.json();
					if (isMounted && Array.isArray(dateData)) {
						setSessions((prev) => {
							const others = prev.filter((s) => s.tanggal !== timelineDate);
							return [...dateData, ...others];
						});
					}
				}
			} catch (err) {
				console.error('Gagal memperbarui sesi timeline tanggal:', err);
			}
		};

		loadDateSessions();
		return () => {
			isMounted = false;
		};
	}, [timelineDate]);

	// Auto-filter Kelas & Mapel saat Guru dipilih pada Form Input
	const availableClassesForTeacher = useMemo(() => {
		if (!filterByTeacherAssignments || !createForm.guru_id || !teacherAssignments[createForm.guru_id]) {
			return kelasList;
		}
		const assignedClasses = new Set(teacherAssignments[createForm.guru_id].map((a) => a.kelas));
		const filtered = kelasList.filter((k) => assignedClasses.has(k.nama_kelas));
		return filtered.length > 0 ? filtered : kelasList;
	}, [filterByTeacherAssignments, createForm.guru_id, teacherAssignments, kelasList]);

	const availableMapelsForTeacher = useMemo(() => {
		if (!filterByTeacherAssignments || !createForm.guru_id || !teacherAssignments[createForm.guru_id]) {
			return mapelList;
		}
		const assignedMapels = new Set(teacherAssignments[createForm.guru_id].map((a) => a.mapel));
		const filtered = mapelList.filter((m) => assignedMapels.has(m.mapel));
		return filtered.length > 0 ? filtered : mapelList;
	}, [filterByTeacherAssignments, createForm.guru_id, teacherAssignments, mapelList]);

	// Load Siswa Roster saat kelas dipilih pada Modal Input Admin
	useEffect(() => {
		if (!createForm.kelas) {
			setRosterSiswa([]);
			setCreateAbsensiList([]);
			return;
		}

		const fetchStudents = async () => {
			try {
				setLoadingRoster(true);
				const supabase = createClient();
				const { data: students, error } = await supabase
					.from('siswa')
					.select('id, nama_lengkap, nis, status')
					.eq('kelas', createForm.kelas)
					.eq('status', 'Aktif')
					.order('nama_lengkap', { ascending: true });

				if (error) throw error;

				const initialRows = (students || []).map((s) => ({
					siswa_id: s.id,
					nama_lengkap: s.nama_lengkap,
					nis: s.nis,
					status: 'hadir',
					keterangan: '',
				}));

				setRosterSiswa(students || []);
				setCreateAbsensiList(initialRows);
			} catch (err) {
				console.error('Gagal mengambil daftar siswa rombel:', err);
			} finally {
				setLoadingRoster(false);
			}
		};

		fetchStudents();
	}, [createForm.kelas]);

	// Filter Data Sesi pada Tab "Semua Riwayat"
	const filteredSessions = useMemo(() => {
		return sessions.filter((s) => {
			const matchKelas = filterKelas === 'all' || s.kelas === filterKelas;
			const matchMapel = filterMapel === 'all' || s.mapel === filterMapel;
			const matchGuru = filterGuru === 'all' || s.guru_id === filterGuru;
			const matchTanggal = !filterTanggal || s.tanggal === filterTanggal;
			const matchJurnal =
				filterJurnal === 'all' ||
				(filterJurnal === 'linked' && s.has_jurnal) ||
				(filterJurnal === 'unlinked' && !s.has_jurnal);

			const q = searchQuery.toLowerCase().trim();
			const matchSearch =
				!q ||
				(s.guru_nama && s.guru_nama.toLowerCase().includes(q)) ||
				(s.mapel && s.mapel.toLowerCase().includes(q)) ||
				(s.kelas && s.kelas.toLowerCase().includes(q)) ||
				(s.jam_ke && String(s.jam_ke).toLowerCase().includes(q));

			return matchKelas && matchMapel && matchGuru && matchTanggal && matchJurnal && matchSearch;
		});
	}, [sessions, filterKelas, filterMapel, filterGuru, filterTanggal, filterJurnal, searchQuery]);

	// Akumulasi Statistik Presensi Tab "Semua Riwayat"
	const summaryStats = useMemo(() => {
		let totalHadir = 0;
		let totalSakit = 0;
		let totalIzin = 0;
		let totalAlfa = 0;
		let totalRecords = 0;

		filteredSessions.forEach((s) => {
			if (s.summary) {
				totalHadir += s.summary.hadir || 0;
				totalSakit += s.summary.sakit || 0;
				totalIzin += s.summary.izin || 0;
				totalAlfa += s.summary.alfa || 0;
				totalRecords += s.summary.total || 0;
			}
		});

		return {
			totalSessions: filteredSessions.length,
			totalHadir,
			totalSakit,
			totalIzin,
			totalAlfa,
			totalRecords,
		};
	}, [filteredSessions]);

	// Data Sesi Timeline Per Kelas
	const timelineSessions = useMemo(() => {
		return sessions.filter((s) => s.tanggal === timelineDate);
	}, [sessions, timelineDate]);

	// Rombel yang difilter untuk Timeline
	const timelineClasses = useMemo(() => {
		if (timelineLevel === 'all') return kelasList;
		return kelasList.filter((k) => k.nama_kelas?.startsWith(timelineLevel));
	}, [kelasList, timelineLevel]);

	// Handle Submit Input Presensi oleh Admin
	const handleCreateSubmit = async (e) => {
		e.preventDefault();
		if (!createForm.guru_id || !createForm.kelas || !createForm.mapel || !createForm.tanggal || !createForm.jam_ke) {
			Swal.fire({
				icon: 'warning',
				title: 'Form Belum Lengkap',
				text: 'Mohon lengkapi Guru, Kelas, Mapel, Tanggal, dan Jam Ke.',
				confirmButtonColor: '#0D0D0D',
			});
			return;
		}

		if (createAbsensiList.length === 0) {
			Swal.fire({
				icon: 'warning',
				title: 'Daftar Siswa Kosong',
				text: 'Kelas ini belum memiliki siswa terdaftar.',
				confirmButtonColor: '#0D0D0D',
			});
			return;
		}

		try {
			setSavingCreate(true);
			const payload = {
				...createForm,
				absensiList: createAbsensiList,
			};

			const res = await fetch('/api/admin/absensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			// Jika terjadi konflik jadwal dan user belum mengonfirmasi override
			if (res.status === 409 && data.can_override) {
				const confirmOverride = await Swal.fire({
					icon: 'warning',
					title: '⚠️ Bentrok Jam Terdeteksi!',
					html: `
						<div class="text-left text-sm space-y-2">
							<p class="font-bold text-red-600">${data.error}</p>
							<p>Apakah Anda selaku Administrator ingin <b>mengabaikan konflik ini (Override)</b> dan tetap menyimpan presensi?</p>
						</div>
					`,
					showCancelButton: true,
					confirmButtonText: 'Ya, Tetap Simpan (Override)',
					cancelButtonText: 'Batal & Sesuaikan Jam',
					confirmButtonColor: '#E8451A',
					cancelButtonColor: '#0D0D0D',
				});

				if (confirmOverride.isConfirmed) {
					// Kirim ulang dengan override_conflict: true
					const retryRes = await fetch('/api/admin/absensi', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ...payload, override_conflict: true }),
					});
					const retryData = await retryRes.json();
					if (!retryRes.ok) throw new Error(retryData.error || 'Gagal menyimpan.');

					Swal.fire({
						icon: 'success',
						title: 'Berhasil Diinput (Override)!',
						text: 'Presensi siswa berhasil disimpan oleh Admin.',
						confirmButtonColor: '#0D0D0D',
					});
					setCreateModalOpen(false);
					setCreateForm(initialCreateForm);
					fetchData();
					return;
				}
				return;
			}

			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan presensi.');

			Swal.fire({
				icon: 'success',
				title: 'Presensi Berhasil Disimpan!',
				html: `
					<div class="text-sm">
						<p>${data.message}</p>
						${data.journal ? '<p class="text-emerald-700 font-bold mt-1">✓ Jurnal KBM Guru juga otomatis dibuat dan disahkan.</p>' : ''}
					</div>
				`,
				confirmButtonColor: '#0D0D0D',
			});

			setCreateModalOpen(false);
			setCreateForm(initialCreateForm);
			fetchData();
		} catch (err) {
			console.error('Error simpan presensi admin:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message || 'Terjadi kesalahan sistem.',
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setSavingCreate(false);
		}
	};

	// 1-Klik Set Semua Hadir pada Modal Input Admin
	const handleSetAllHadir = () => {
		setCreateAbsensiList((prev) =>
			prev.map((s) => ({
				...s,
				status: 'hadir',
				keterangan: '',
			}))
		);
	};

	// Buka Modal Detail & Edit Siswa
	const handleOpenDetailModal = async (session) => {
		setSelectedSessionDetail(session);
		setDetailModalOpen(true);
		setLoadingDetailStudents(true);

		try {
			const supabase = createClient();
			// Ambil semua siswa di kelas ini beserta status absensinya di sesi ini
			const [resStudents, resDetails] = await Promise.all([
				supabase
					.from('siswa')
					.select('id, nama_lengkap, nis')
					.eq('kelas', session.kelas)
					.eq('status', 'Aktif')
					.order('nama_lengkap', { ascending: true }),
				supabase
					.from('absensi_mapel_siswa')
					.select('siswa_id, status, keterangan')
					.eq('sesi_id', session.sesi_id),
			]);

			const detailsMap = {};
			(resDetails.data || []).forEach((d) => {
				detailsMap[d.siswa_id] = d;
			});

			const rows = (resStudents.data || []).map((s) => {
				const existing = detailsMap[s.id];
				return {
					siswa_id: s.id,
					nama_lengkap: s.nama_lengkap,
					nis: s.nis,
					status: existing ? normStatus(existing.status) : 'hadir',
					keterangan: existing ? existing.keterangan || '' : '',
				};
			});

			setDetailStudentRows(rows);
		} catch (err) {
			console.error('Gagal memuat rincian siswa sesi:', err);
		} finally {
			setLoadingDetailStudents(false);
		}
	};

	// Simpan Perubahan Status Siswa di Modal Detail
	const handleSaveStudentEdits = async () => {
		if (!selectedSessionDetail) return;
		try {
			setSavingStudentEdits(true);
			const payload = {
				sesi_id: selectedSessionDetail.sesi_id,
				absensiList: detailStudentRows,
			};

			const res = await fetch('/api/admin/absensi', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal update rincian siswa.');

			Swal.fire({
				icon: 'success',
				title: 'Data Siswa Diperbarui!',
				text: 'Status kehadiran siswa berhasil disimpan.',
				confirmButtonColor: '#0D0D0D',
			});

			setDetailModalOpen(false);
			fetchData();
		} catch (err) {
			console.error('Gagal update rincian siswa:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memperbarui',
				text: err.message,
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setSavingStudentEdits(false);
		}
	};

	// Buka Modal Edit Sesi Presensi
	const handleOpenEditSession = (session) => {
		setEditingSession(session);
		setEditForm({
			sesi_id: session.sesi_id,
			guru_id: session.guru_id,
			kelas: session.kelas,
			mapel: session.mapel,
			tanggal: session.tanggal,
			jam_ke: session.jam_ke,
			sync_jurnal: true,
			override_conflict: false,
		});
		setEditModalOpen(true);
	};

	// Submit Edit Sesi Presensi
	const handleEditSessionSubmit = async (e) => {
		e.preventDefault();
		try {
			setSavingEdit(true);
			const res = await fetch('/api/admin/absensi', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editForm),
			});

			const data = await res.json();

			if (res.status === 409 && data.can_override) {
				const confirmOverride = await Swal.fire({
					icon: 'warning',
					title: '⚠️ Bentrok Jam Terdeteksi!',
					text: data.error,
					showCancelButton: true,
					confirmButtonText: 'Ya, Tetap Simpan (Override)',
					cancelButtonText: 'Batal & Koreksi Jam',
					confirmButtonColor: '#E8451A',
					cancelButtonColor: '#0D0D0D',
				});

				if (confirmOverride.isConfirmed) {
					const retryRes = await fetch('/api/admin/absensi', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ...editForm, override_conflict: true }),
					});
					const retryData = await retryRes.json();
					if (!retryRes.ok) throw new Error(retryData.error || 'Gagal update.');

					Swal.fire({
						icon: 'success',
						title: 'Berhasil Diperbarui!',
						text: 'Data sesi presensi berhasil diubah.',
						confirmButtonColor: '#0D0D0D',
					});
					setEditModalOpen(false);
					fetchData();
					return;
				}
				return;
			}

			if (!res.ok) throw new Error(data.error || 'Gagal update sesi.');

			Swal.fire({
				icon: 'success',
				title: 'Berhasil Diperbarui!',
				text: 'Data sesi presensi berhasil diubah.',
				confirmButtonColor: '#0D0D0D',
			});
			setEditModalOpen(false);
			fetchData();
		} catch (err) {
			console.error('Error update sesi:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Update',
				text: err.message,
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setSavingEdit(false);
		}
	};

	// Hapus Sesi Presensi
	const handleDeleteSession = async (session) => {
		const result = await Swal.fire({
			title: 'Hapus Sesi Presensi?',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Anda akan menghapus data presensi <b>${session.mapel}</b> kelas <b>${session.kelas}</b> pada tanggal <b>${session.tanggal}</b> (Jam ke-${session.jam_ke}).</p>
					<p class="text-red-600 font-bold">⚠️ Seluruh rincian absensi siswa pada jam ini akan dihapus secara permanen!</p>
					<div class="mt-3 p-3 bg-gray-100 border border-gray-300 rounded text-xs">
						<label class="flex items-center gap-2 cursor-pointer font-bold">
							<input type="checkbox" id="swal-del-jurnal" class="w-4 h-4 text-red-600 rounded" ${session.has_jurnal ? 'checked' : ''} />
							<span>Juga hapus jurnal KBM yang tertaut ke sesi ini</span>
						</label>
					</div>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus Permanen',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			preConfirm: () => {
				const checkDel = document.getElementById('swal-del-jurnal');
				return { deleteJurnal: checkDel ? checkDel.checked : false };
			},
		});

		if (result.isConfirmed) {
			try {
				const delJurnal = result.value?.deleteJurnal;
				const res = await fetch(`/api/admin/absensi?sesi_id=${session.sesi_id}&delete_jurnal=${delJurnal}`, {
					method: 'DELETE',
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal menghapus.');

				Swal.fire({
					icon: 'success',
					title: 'Terhapus!',
					text: 'Sesi presensi berhasil dihapus dari sistem.',
					confirmButtonColor: '#0D0D0D',
				});
				fetchData();
			} catch (err) {
				console.error('Error delete sesi:', err);
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menghapus',
					text: err.message,
					confirmButtonColor: '#0D0D0D',
				});
			}
		}
	};

	// 1-Klik Buat Jurnal untuk Presensi Tanpa Jurnal
	const handleCreateJurnalForSession = async (session) => {
		const result = await Swal.fire({
			title: 'Terbitkan Jurnal KBM?',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Sesi presensi <b>${session.mapel}</b> kelas <b>${session.kelas}</b> oleh <b>${session.guru_nama}</b> belum memiliki jurnal KBM.</p>
					<p>Apakah Anda ingin otomatis menerbitkan dan mengesahkan Jurnal KBM untuk sesi ini?</p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'Ya, Terbitkan Jurnal',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00E599',
			cancelButtonColor: '#0D0D0D',
		});

		if (result.isConfirmed) {
			try {
				const res = await fetch('/api/admin/absensi/resolve', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'create_jurnal',
						sesi_id: session.sesi_id,
					}),
				});

				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal menerbitkan jurnal.');

				Swal.fire({
					icon: 'success',
					title: 'Jurnal Diterbitkan!',
					text: 'Jurnal KBM berhasil dibuat dan disahkan.',
					confirmButtonColor: '#0D0D0D',
				});
				fetchData();
			} catch (err) {
				console.error('Error terbitkan jurnal:', err);
				Swal.fire({
					icon: 'error',
					title: 'Gagal',
					text: err.message,
					confirmButtonColor: '#0D0D0D',
				});
			}
		}
	};

	// Buka Modal Resolusi Bentrok Jam
	const handleOpenResolveConflict = (conflict) => {
		setSelectedConflict(conflict);
		setResolveForm({
			sesi_a_jam: conflict.sessionA.jam_ke,
			sesi_b_jam: conflict.sessionB.jam_ke,
			sync_jurnal: true,
		});
	};

	// Submit Resolusi Bentrok Jam
	const handleResolveConflictSubmit = async (e) => {
		e.preventDefault();
		if (!selectedConflict) return;

		try {
			setResolving(true);
			const res = await fetch('/api/admin/absensi/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'adjust_jam',
					sesi_id_a: selectedConflict.sessionA.sesi_id,
					jam_ke_a: resolveForm.sesi_a_jam,
					sesi_id_b: selectedConflict.sessionB.sesi_id,
					jam_ke_b: resolveForm.sesi_b_jam,
					sync_jurnal: resolveForm.sync_jurnal,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyelesaikan bentrok.');

			Swal.fire({
				icon: 'success',
				title: 'Bentrok Selesai!',
				text: data.message,
				confirmButtonColor: '#0D0D0D',
			});

			setSelectedConflict(null);
			fetchData();
		} catch (err) {
			console.error('Error resolve conflict:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Resolusi',
				text: err.message,
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setResolving(false);
		}
	};

	// Buka Modal Pecah Sesi
	const handleOpenSplitModal = async (session) => {
		setSplittingSession(session);
		setSplitForm({
			sesi_1_jam: '',
			sesi_2_jam: '',
			siswa_alfa_ids: [],
		});
		setSplitModalOpen(true);
	};

	// Submit Pecah Sesi
	const handleSplitSessionSubmit = async (e) => {
		e.preventDefault();
		if (!splittingSession || !splitForm.sesi_1_jam || !splitForm.sesi_2_jam) {
			Swal.fire({
				icon: 'warning',
				title: 'Lengkapi Jam',
				text: 'Pilih slot jam ke untuk sesi pertama dan kedua.',
				confirmButtonColor: '#0D0D0D',
			});
			return;
		}

		try {
			setSavingSplit(true);
			const res = await fetch('/api/admin/absensi/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'split_session',
					sesi_id: splittingSession.sesi_id,
					sesi_1_jam: splitForm.sesi_1_jam,
					sesi_2_jam: splitForm.sesi_2_jam,
					siswa_alfa_ids: splitForm.siswa_alfa_ids,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memecah sesi.');

			Swal.fire({
				icon: 'success',
				title: 'Sesi Berhasil Dipecah!',
				text: data.message,
				confirmButtonColor: '#0D0D0D',
			});

			setSplitModalOpen(false);
			fetchData();
		} catch (err) {
			console.error('Error pecah sesi:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memecah Sesi',
				text: err.message,
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setSavingSplit(false);
		}
	};

	// Cetak / Ekspor Dokumen Resmi PDF
	const handleExportPDF = () => {
		try {
			setExporting(true);
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text(
				'LAPORAN SUPERVISI MANAJEMEN PRESENSI SISWA (KBM)',
				doc.internal.pageSize.getWidth() / 2,
				endKop + 2,
				{ align: 'center' }
			);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${exportFilterKelas}  •  Filter Mapel: ${exportFilterMapel}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const exportSessions = sessions.filter((s) => {
				const matchK = exportFilterKelas === 'Semua' || s.kelas === exportFilterKelas;
				const matchM = exportFilterMapel === 'Semua' || s.mapel === exportFilterMapel;
				const matchT = (!exportStartDate || s.tanggal >= exportStartDate) && (!exportEndDate || s.tanggal <= exportEndDate);
				return matchK && matchM && matchT;
			});

			const tableData = exportSessions.map((s, idx) => [
				idx + 1,
				s.tanggal || '-',
				`Jam ${s.jam_ke || '-'}`,
				s.kelas || '-',
				s.mapel || '-',
				s.guru_nama || 'Guru',
				s.summary ? s.summary.hadir : 0,
				s.summary ? s.summary.sakit : 0,
				s.summary ? s.summary.izin : 0,
				s.summary ? s.summary.alfa : 0,
				s.summary ? s.summary.total : 0,
				s.has_jurnal ? '✓ Tertaut' : '⚠️ Tanpa Jurnal',
			]);

			autoTable(doc, {
				startY: endKop + 10,
				head: [
					[
						'No',
						'Tanggal',
						'Jam Ke',
						'Kelas',
						'Mata Pelajaran',
						'Guru Pengajar',
						'Hadir',
						'Sakit',
						'Izin',
						'Alfa',
						'Total',
						'Status Jurnal',
					],
				],
				body: tableData,
				theme: 'grid',
				headStyles: {
					fillColor: [13, 13, 13],
					textColor: [255, 255, 255],
					fontStyle: 'bold',
					halign: 'center',
					fontSize: 8,
				},
				bodyStyles: {
					fontSize: 7.5,
					textColor: [15, 23, 42],
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 10 },
					1: { halign: 'center', cellWidth: 22 },
					2: { halign: 'center', cellWidth: 18 },
					3: { halign: 'center', cellWidth: 16 },
					6: { halign: 'center', cellWidth: 14 },
					7: { halign: 'center', cellWidth: 14 },
					8: { halign: 'center', cellWidth: 14 },
					9: { halign: 'center', cellWidth: 14 },
					10: { halign: 'center', cellWidth: 16 },
					11: { halign: 'center', cellWidth: 24 },
				},
			});

			const pageCount = doc.internal.getNumberOfPages();
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				doc.setFontSize(7.5);
				doc.setTextColor(148, 163, 184);
				doc.text(
					`Dicetak dari Portal Admin GuruApp • Halaman ${i} dari ${pageCount}`,
					doc.internal.pageSize.getWidth() / 2,
					doc.internal.pageSize.getHeight() - 6,
					{ align: 'center' }
				);
			}

			doc.save(`Laporan_Presensi_Admin_${exportFilterKelas}_${getTodayDateString()}.pdf`);
			setExportModalOpen(false);
		} catch (err) {
			console.error('Gagal cetak PDF:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Ekspor PDF',
				text: err.message,
				confirmButtonColor: '#0D0D0D',
			});
		} finally {
			setExporting(false);
		}
	};

	// Ekspor Spreadsheet Excel
	const handleExportExcel = () => {
		try {
			setExporting(true);
			const exportSessions = sessions.filter((s) => {
				const matchK = exportFilterKelas === 'Semua' || s.kelas === exportFilterKelas;
				const matchM = exportFilterMapel === 'Semua' || s.mapel === exportFilterMapel;
				const matchT = (!exportStartDate || s.tanggal >= exportStartDate) && (!exportEndDate || s.tanggal <= exportEndDate);
				return matchK && matchM && matchT;
			});

			const rows = exportSessions.map((s, idx) => ({
				No: idx + 1,
				Tanggal: s.tanggal,
				'Jam Ke': s.jam_ke,
				Kelas: s.kelas,
				'Mata Pelajaran': s.mapel,
				'Guru Pengajar': s.guru_nama,
				'Hadir (H)': s.summary ? s.summary.hadir : 0,
				'Sakit (S)': s.summary ? s.summary.sakit : 0,
				'Izin (I)': s.summary ? s.summary.izin : 0,
				'Alfa (A)': s.summary ? s.summary.alfa : 0,
				'Total Siswa': s.summary ? s.summary.total : 0,
				'Status Jurnal': s.has_jurnal ? 'Tertaut' : 'Belum Terbit Jurnal',
				'Catatan Admin': s.catatan_admin || '',
			}));

			const worksheet = XLSX.utils.json_to_sheet(rows);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Presensi');
			XLSX.writeFile(workbook, `Rekap_Presensi_Admin_${getTodayDateString()}.xlsx`);
			setExportModalOpen(false);
		} catch (err) {
			console.error('Gagal cetak Excel:', err);
		} finally {
			setExporting(false);
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-16'>
			{/* Header Navigasi & Info Portal */}
			<div className='bg-white border-[3px] border-[#0D0D0D] p-5 sm:p-7 shadow-[6px_6px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-[#00E599] border-2 border-[#0D0D0D] text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>⚡</span>
						<span>Kendali Penuh Administrator</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] tracking-tight'>
						Manajemen & Radar Presensi Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-2xl'>
						Pusat supervisi kehadiran siswa: deteksi otomatis bentrok jam mengajar, pantau matriks timeline KBM per rombel, serta beri bantuan input presensi guru saat kendala teknis.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2.5'>
					<AcademicPeriodChip />
					<button
						onClick={() => setCreateModalOpen(true)}
						className='px-4 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-[#0D0D0D] font-black text-xs uppercase tracking-wider border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center gap-2 cursor-pointer'
					>
						<PlusCircle className='w-4 h-4' />
						<span>+ Input Presensi (Bantuan)</span>
					</button>
					<button
						onClick={() => setExportModalOpen(true)}
						className='px-3.5 py-2.5 bg-white hover:bg-gray-100 text-[#0D0D0D] font-black text-xs uppercase tracking-wider border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-all flex items-center gap-1.5 cursor-pointer'
					>
						<Printer className='w-4 h-4' />
						<span className='hidden sm:inline'>Ekspor / Cetak</span>
					</button>
					<button
						onClick={() => setWaModalOpen(true)}
						className='px-3 py-2.5 bg-[#00E599] hover:bg-emerald-400 text-[#0D0D0D] font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5 cursor-pointer'
						title='Hotline WhatsApp Aduan KBM'
					>
						<LifeBuoy className='w-4 h-4' />
					</button>
					<button
						onClick={fetchData}
						className='px-3 py-2.5 bg-white hover:bg-gray-100 text-[#0D0D0D] font-black text-xs border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] transition-all flex items-center gap-1 cursor-pointer'
						title='Refresh Data'
					>
						<RefreshCw className='w-4 h-4' />
					</button>
				</div>
			</div>

			{/* Tab Switcher Neobrutalis */}
			<div className='flex flex-wrap items-center gap-2 border-b-2 border-[#0D0D0D] pb-3'>
				<button
					onClick={() => setActiveTab('radar')}
					className={`flex items-center gap-2 px-5 py-3 border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
						activeTab === 'radar'
							? 'bg-[#E8451A] text-white shadow-[4px_4px_0px_0px_#0D0D0D] -translate-y-1'
							: 'bg-white text-[#0D0D0D] hover:bg-orange-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
					}`}
				>
					<AlertTriangle className='w-4 h-4' />
					<span>Radar & Resolusi Bentrok</span>
					{radarData.summary.conflicts_count > 0 && (
						<span className='px-1.5 py-0.5 bg-white text-[#E8451A] rounded-full text-[10px] font-black'>
							{radarData.summary.conflicts_count}
						</span>
					)}
				</button>

				<button
					onClick={() => setActiveTab('timeline')}
					className={`flex items-center gap-2 px-5 py-3 border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
						activeTab === 'timeline'
							? 'bg-[#00E599] text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -translate-y-1'
							: 'bg-white text-[#0D0D0D] hover:bg-emerald-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
					}`}
				>
					<Calendar className='w-4 h-4' />
					<span>Timeline Presensi Per Rombel</span>
				</button>

				<button
					onClick={() => setActiveTab('semua')}
					className={`flex items-center gap-2 px-5 py-3 border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
						activeTab === 'semua'
							? 'bg-[#00B2FF] text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -translate-y-1'
							: 'bg-white text-[#0D0D0D] hover:bg-sky-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
					}`}
				>
					<Clock className='w-4 h-4' />
					<span>Semua Riwayat Presensi</span>
					<span className='px-1.5 py-0.5 bg-[#0D0D0D] text-white rounded-full text-[10px] font-black'>
						{sessions.length}
					</span>
				</button>
			</div>

			{/* =================================================================== */}
			{/* TAB 1: RADAR ANOMALI & RESOLUSI BENTROK JAM */}
			{/* =================================================================== */}
			{activeTab === 'radar' && (
				<div className='space-y-6'>
					{/* Stat Highlights Cards */}
					<div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
						<div
							onClick={() => setRadarFilter('conflict')}
							className={`border-[3px] border-[#0D0D0D] p-4 cursor-pointer transition-all shadow-[4px_4px_0px_0px_#0D0D0D] ${
								radarFilter === 'conflict' ? 'bg-red-200 -translate-y-1' : 'bg-white hover:bg-red-50'
							}`}
						>
							<div className='flex items-center justify-between text-xs font-black uppercase text-gray-700'>
								<span>Sesi Bentrok Jam</span>
								<span>⚠️</span>
							</div>
							<div className='text-3xl font-black text-[#E8451A] mt-2'>
								{radarData.summary.conflicts_count}
							</div>
							<div className='text-[11px] font-bold text-gray-600 mt-1'>
								Slot jam tumpang tindih
							</div>
						</div>

						<div
							onClick={() => setRadarFilter('unlinked')}
							className={`border-[3px] border-[#0D0D0D] p-4 cursor-pointer transition-all shadow-[4px_4px_0px_0px_#0D0D0D] ${
								radarFilter === 'unlinked' ? 'bg-amber-200 -translate-y-1' : 'bg-white hover:bg-amber-50'
							}`}
						>
							<div className='flex items-center justify-between text-xs font-black uppercase text-gray-700'>
								<span>Tanpa Jurnal KBM</span>
								<span>📝</span>
							</div>
							<div className='text-3xl font-black text-amber-600 mt-2'>
								{radarData.summary.unlinked_count}
							</div>
							<div className='text-[11px] font-bold text-gray-600 mt-1'>
								Presensi ada, jurnal belum
							</div>
						</div>

						<div
							onClick={() => setRadarFilter('anomali')}
							className={`border-[3px] border-[#0D0D0D] p-4 cursor-pointer transition-all shadow-[4px_4px_0px_0px_#0D0D0D] ${
								radarFilter === 'anomali' ? 'bg-purple-200 -translate-y-1' : 'bg-white hover:bg-purple-50'
							}`}
						>
							<div className='flex items-center justify-between text-xs font-black uppercase text-gray-700'>
								<span>Anomali Absen Tinggi</span>
								<span>👥</span>
							</div>
							<div className='text-3xl font-black text-purple-600 mt-2'>
								{radarData.summary.anomali_count}
							</div>
							<div className='text-[11px] font-bold text-gray-600 mt-1'>
								≥ 25% siswa tidak hadir / alpa
							</div>
						</div>

						<div
							onClick={() => setRadarFilter('all')}
							className={`border-[3px] border-[#0D0D0D] p-4 cursor-pointer transition-all shadow-[4px_4px_0px_0px_#0D0D0D] ${
								radarFilter === 'all' ? 'bg-emerald-200 -translate-y-1' : 'bg-white hover:bg-emerald-50'
							}`}
						>
							<div className='flex items-center justify-between text-xs font-black uppercase text-gray-700'>
								<span>Total Terdata</span>
								<span>🟢</span>
							</div>
							<div className='text-3xl font-black text-[#0D0D0D] mt-2'>
								{radarData.summary.total_sessions}
							</div>
							<div className='text-[11px] font-bold text-gray-600 mt-1'>
								Semua sesi di database
							</div>
						</div>
					</div>

					{/* 1. SEKSI KONFLIK BENTROK JAM MENGAJAR */}
					{(radarFilter === 'all' || radarFilter === 'conflict') && (
						<div className='space-y-4'>
							<div className='flex items-center justify-between'>
								<h2 className='text-lg font-black text-[#0D0D0D] flex items-center gap-2'>
									<span className='w-3 h-3 rounded-full bg-[#E8451A] inline-block animate-pulse'></span>
									<span>Deteksi Konflik Bentrok Jam Pelajaran ({radarData.conflicts.length})</span>
								</h2>
								{radarData.conflicts.length > 0 && (
									<span className='px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 font-bold text-xs rounded'>
										Perlu Tindakan Admin
									</span>
								)}
							</div>

							{radarData.conflicts.length === 0 ? (
								<div className='border-[3px] border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_0px_#0D0D0D] space-y-2'>
									<div className='w-12 h-12 bg-[#00E599] border-2 border-[#0D0D0D] rounded-full mx-auto flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<Check className='w-6 h-6 text-[#0D0D0D]' />
									</div>
									<h3 className='font-black text-sm text-[#0D0D0D]'>
										Tidak Ada Konflik Bentrok Jam
									</h3>
									<p className='text-xs text-gray-600 max-w-md mx-auto'>
										Seluruh sesi presensi di rombongan belajar memiliki alokasi jam pelajaran yang rapi tanpa saling bertabrakan.
									</p>
								</div>
							) : (
								<div className='grid grid-cols-1 gap-4'>
									{radarData.conflicts.map((c) => (
										<div
											key={c.id}
											className='border-[3px] border-[#0D0D0D] bg-white p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'
										>
											<div className='flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-100 pb-3'>
												<div className='flex items-center gap-2'>
													<span className='px-2 py-0.5 bg-[#E8451A] text-white text-xs font-black uppercase rounded border border-[#0D0D0D]'>
														Bentrok di Kelas {c.kelas}
													</span>
													<span className='text-xs font-bold text-gray-700'>
														📅 {c.tanggal}
													</span>
												</div>
												<div className='flex items-center gap-2'>
													<button
														onClick={() => handleOpenResolveConflict(c)}
														className='px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-[#0D0D0D] font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5 cursor-pointer'
													>
														<Zap className='w-3.5 h-3.5' />
														<span>Selesaikan Jam Bentrok</span>
													</button>
												</div>
											</div>

											{/* Komparasi Sesi A vs Sesi B */}
											<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
												<div className='p-3.5 bg-red-50 border-2 border-[#0D0D0D] rounded-lg space-y-1.5'>
													<div className='text-[10px] font-black uppercase tracking-wider text-red-700'>
														Sesi Pertama
													</div>
													<div className='text-sm font-black text-[#0D0D0D]'>
														{c.sessionA.mapel} (Jam ke-{c.sessionA.jam_ke})
													</div>
													<div className='text-xs font-bold text-gray-700 flex items-center gap-1'>
														<span>👤</span> {c.sessionA.guru_nama}
													</div>
													<div className='flex items-center gap-2 pt-2'>
														<button
															onClick={() => handleOpenEditSession(c.sessionA)}
															className='px-2.5 py-1 bg-white border border-[#0D0D0D] text-[11px] font-bold hover:bg-gray-100 transition-all cursor-pointer'
														>
															Edit Sesi
														</button>
														<button
															onClick={() => handleDeleteSession(c.sessionA)}
															className='px-2.5 py-1 bg-red-100 text-red-700 border border-red-300 text-[11px] font-bold hover:bg-red-200 transition-all cursor-pointer'
														>
															Hapus
														</button>
													</div>
												</div>

												<div className='p-3.5 bg-orange-50 border-2 border-[#0D0D0D] rounded-lg space-y-1.5'>
													<div className='text-[10px] font-black uppercase tracking-wider text-orange-700'>
														Sesi Kedua (Penabrak)
													</div>
													<div className='text-sm font-black text-[#0D0D0D]'>
														{c.sessionB.mapel} (Jam ke-{c.sessionB.jam_ke})
													</div>
													<div className='text-xs font-bold text-gray-700 flex items-center gap-1'>
														<span>👤</span> {c.sessionB.guru_nama}
													</div>
													<div className='flex items-center gap-2 pt-2'>
														<button
															onClick={() => handleOpenEditSession(c.sessionB)}
															className='px-2.5 py-1 bg-white border border-[#0D0D0D] text-[11px] font-bold hover:bg-gray-100 transition-all cursor-pointer'
														>
															Edit Sesi
														</button>
														<button
															onClick={() => handleDeleteSession(c.sessionB)}
															className='px-2.5 py-1 bg-red-100 text-red-700 border border-red-300 text-[11px] font-bold hover:bg-red-200 transition-all cursor-pointer'
														>
															Hapus
														</button>
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* 2. SEKSI PRESENSI TANPA JURNAL KBM */}
					{(radarFilter === 'all' || radarFilter === 'unlinked') && (
						<div className='space-y-4 pt-4 border-t-2 border-gray-200'>
							<div className='flex items-center justify-between'>
								<h2 className='text-lg font-black text-[#0D0D0D] flex items-center gap-2'>
									<span>📝</span>
									<span>Presensi Tanpa Jurnal KBM ({radarData.unlinked.length})</span>
								</h2>
								<span className='text-xs font-bold text-gray-600'>
									Presensi sudah diambil namun jurnal guru belum dibuat
								</span>
							</div>

							{radarData.unlinked.length === 0 ? (
								<div className='border-[3px] border-[#0D0D0D] bg-white p-6 text-center shadow-[4px_4px_0px_0px_#0D0D0D] space-y-1'>
									<div className='text-sm font-black text-[#0D0D0D]'>
										Semua Presensi Sudah Tertaut ke Jurnal KBM!
									</div>
									<p className='text-xs text-gray-600'>
										Tidak ada presensi gantung tanpa pertanggungjawaban kegiatan belajar mengajar.
									</p>
								</div>
							) : (
								<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5'>
									{radarData.unlinked.map((u) => (
										<div
											key={u.sesi_id}
											className='border-2 border-[#0D0D0D] bg-white p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between space-y-3'
										>
											<div className='space-y-1.5'>
												<div className='flex items-center justify-between'>
													<span className='px-2 py-0.5 bg-yellow-200 border border-[#0D0D0D] text-[10px] font-black uppercase'>
														Kelas {u.kelas} • Jam {u.jam_ke}
													</span>
													<span className='text-[11px] font-bold text-gray-600'>{u.tanggal}</span>
												</div>
												<div className='text-sm font-black text-[#0D0D0D]'>{u.mapel}</div>
												<div className='text-xs font-bold text-gray-700'>👤 {u.guru_nama}</div>
												<div className='text-[11px] font-semibold text-gray-600 flex items-center gap-2'>
													<span className='text-emerald-700'>H: {u.summary?.hadir || 0}</span>
													<span className='text-amber-700'>S: {u.summary?.sakit || 0}</span>
													<span className='text-sky-700'>I: {u.summary?.izin || 0}</span>
													<span className='text-red-700'>A: {u.summary?.alfa || 0}</span>
												</div>
											</div>

											<div className='pt-2 border-t border-gray-100 flex items-center justify-between gap-2'>
												<button
													onClick={() => handleCreateJurnalForSession(u)}
													className='w-full py-1.5 bg-[#00E599] hover:bg-emerald-400 text-[#0D0D0D] text-xs font-black uppercase border border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center justify-center gap-1 cursor-pointer'
												>
													<Sparkles className='w-3.5 h-3.5' />
													<span>1-Klik Terbitkan Jurnal</span>
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* 3. SEKSI ANOMALI TINGKAT ABSENSI TINGGI */}
					{(radarFilter === 'all' || radarFilter === 'anomali') && (
						<div className='space-y-4 pt-4 border-t-2 border-gray-200'>
							<div className='flex items-center justify-between'>
								<h2 className='text-lg font-black text-[#0D0D0D] flex items-center gap-2'>
									<span>👥</span>
									<span>Anomali Ketidakhadiran Tinggi Siswa ({radarData.anomali.length})</span>
								</h2>
								<span className='text-xs font-bold text-gray-600'>
									Alert kesiswaan & wali kelas
								</span>
							</div>

							{radarData.anomali.length === 0 ? (
								<div className='border-[3px] border-[#0D0D0D] bg-white p-6 text-center shadow-[4px_4px_0px_0px_#0D0D0D] space-y-1'>
									<div className='text-sm font-black text-[#0D0D0D]'>
										Tingkat Partisipasi Kehadiran Sangat Baik
									</div>
									<p className='text-xs text-gray-600'>
										Tidak ditemukan lonjakan siswa yang tidak hadir atau membolos pada sesi KBM.
									</p>
								</div>
							) : (
								<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5'>
									{radarData.anomali.map((an) => (
										<div
											key={an.sesi_id}
											className='border-2 border-[#0D0D0D] bg-purple-50 p-4 shadow-[3px_3px_0px_0px_#0D0D0D] space-y-3'
										>
											<div className='flex items-center justify-between'>
												<span className='px-2 py-0.5 bg-purple-200 border border-[#0D0D0D] text-[10px] font-black uppercase text-purple-900'>
													Kelas {an.kelas} • Jam {an.jam_ke}
												</span>
												<span className='text-xs font-black text-red-600 bg-white px-2 py-0.5 border border-red-300 rounded'>
													{an.absentRatio}% Absen
												</span>
											</div>
											<div>
												<div className='text-sm font-black text-[#0D0D0D]'>{an.mapel}</div>
												<div className='text-xs font-bold text-gray-700 mt-0.5'>👤 {an.guru_nama}</div>
											</div>
											<div className='p-2 bg-white border border-[#0D0D0D] rounded text-xs space-y-1 font-bold'>
												<div className='text-red-700 flex justify-between'>
													<span>Alfa (Bolos/Tanpa Ket.):</span>
													<span>{an.alfaCount} Siswa</span>
												</div>
												<div className='text-amber-700 flex justify-between'>
													<span>Sakit / Izin:</span>
													<span>{(an.summary?.sakit || 0) + (an.summary?.izin || 0)} Siswa</span>
												</div>
											</div>
											<button
												onClick={() => handleOpenDetailModal(an)}
												className='w-full py-1.5 bg-white hover:bg-purple-100 text-[#0D0D0D] text-xs font-black uppercase border border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer'
											>
												Cek Daftar Siswa
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* =================================================================== */}
			{/* TAB 2: TIMELINE PRESENSI HARIAN PER ROMBEL */}
			{/* =================================================================== */}
			{activeTab === 'timeline' && (
				<div className='space-y-5'>
					{/* Controls Filter Timeline */}
					<div className='border-[3px] border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-wrap items-center justify-between gap-4'>
						<div className='flex flex-wrap items-center gap-3'>
							<div className='flex items-center gap-2'>
								<label className='text-xs font-black uppercase text-[#0D0D0D]'>Tanggal:</label>
								<input
									type='date'
									value={timelineDate}
									onChange={(e) => setTimelineDate(e.target.value)}
									className='px-3 py-1.5 border-2 border-[#0D0D0D] text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div className='flex items-center gap-1'>
								<button
									onClick={() => setTimelineDate(getTodayDateString())}
									className='px-2.5 py-1.5 bg-yellow-200 hover:bg-yellow-300 border border-[#0D0D0D] text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
								>
									Hari Ini
								</button>
							</div>

							<div className='flex items-center gap-2 ml-2'>
								<label className='text-xs font-black uppercase text-[#0D0D0D]'>Tingkat:</label>
								<select
									value={timelineLevel}
									onChange={(e) => setTimelineLevel(e.target.value)}
									className='px-3 py-1.5 border-2 border-[#0D0D0D] text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									<option value='all'>Semua Tingkat (7, 8, 9)</option>
									<option value='7'>Kelas 7</option>
									<option value='8'>Kelas 8</option>
									<option value='9'>Kelas 9</option>
								</select>
							</div>
						</div>

						<div className='flex items-center gap-3 text-xs font-bold text-gray-700'>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-[#00E599] border border-[#0D0D0D] inline-block'></span> Presensi Lengkap
							</span>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-amber-300 border border-[#0D0D0D] inline-block'></span> Ada Siswa Absen
							</span>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-[#E8451A] border border-[#0D0D0D] inline-block'></span> Bentrok Jam
							</span>
						</div>
					</div>

					{/* Matrix Grid: Kelas (Y) vs JP Slot (X) */}
					<div className='border-[3px] border-[#0D0D0D] bg-white shadow-[6px_6px_0px_0px_#0D0D0D] overflow-x-auto'>
						<table className='w-full border-collapse text-left'>
							<thead>
								<tr className='bg-[#0D0D0D] text-white text-xs font-black uppercase'>
									<th className='p-3 border-r-2 border-white/30 text-center w-28'>Rombel</th>
									{JP_SLOTS.map((slot) => (
										<th key={slot} className='p-3 border-r-2 border-white/20 text-center min-w-[130px]'>
											Jam ke-{slot}
										</th>
									))}
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-[#0D0D0D] text-xs font-medium'>
								{timelineClasses.map((kls) => {
									// Cari seluruh sesi di kelas ini pada tanggal yang dipilih
									const classSessions = timelineSessions.filter((s) => s.kelas === kls.nama_kelas);

									return (
										<tr key={kls.id} className='hover:bg-gray-50'>
											<td className='p-3 border-r-2 border-[#0D0D0D] font-black text-sm bg-gray-100 text-center'>
												{kls.nama_kelas}
											</td>
											{JP_SLOTS.map((slot) => {
												// Cari sesi yang mencakup slot JP ini
												const sessionsInSlot = classSessions.filter((s) => {
													const norm = normalizeJamKe(s.jam_ke);
													return checkJamOverlap(norm, String(slot)).isOverlap;
												});

												const isConflict = sessionsInSlot.length > 1;
												const hasSession = sessionsInSlot.length === 1;
												const session = hasSession ? sessionsInSlot[0] : null;

												return (
													<td
														key={slot}
														className='p-2 border-r-2 border-[#0D0D0D] align-top min-w-[130px]'
													>
														{isConflict ? (
															<div
																onClick={() => setActiveTab('radar')}
																className='p-2 bg-[#E8451A] text-white border-2 border-[#0D0D0D] text-[10px] font-black uppercase cursor-pointer hover:scale-105 transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'
															>
																⚠️ BENTROK ({sessionsInSlot.length})
																<div className='text-[9px] font-normal truncate mt-0.5'>
																	Klik ke Radar
																</div>
															</div>
														) : hasSession ? (
															<div
																onClick={() => handleOpenDetailModal(session)}
																className={`p-2 border-2 border-[#0D0D0D] text-left cursor-pointer hover:-translate-y-0.5 transition-all shadow-[2px_2px_0px_0px_#0D0D0D] ${
																	session.summary && (session.summary.sakit > 0 || session.summary.izin > 0 || session.summary.alfa > 0)
																		? 'bg-amber-100'
																		: 'bg-[#00E599]/30'
																}`}
															>
																<div className='font-black text-xs text-[#0D0D0D] truncate'>
																	{session.mapel}
																</div>
																<div className='text-[10px] text-gray-700 truncate font-semibold'>
																	👤 {session.guru_nama}
																</div>
																<div className='flex items-center justify-between text-[9px] font-bold mt-1 text-gray-600'>
																	<span>
																		{session.summary?.hadir || 0}/{session.summary?.total || 0} H
																	</span>
																	{session.has_jurnal ? (
																		<span className='text-emerald-700 font-black' title='Tertaut Jurnal'>
																			✓ Jurnal
																		</span>
																	) : (
																		<span className='text-amber-700 font-black' title='Tanpa Jurnal'>
																			⚠️ No Jrn
																		</span>
																	)}
																</div>
															</div>
														) : (
															<div
																onClick={() => {
																	setCreateForm({
																		...initialCreateForm,
																		kelas: kls.nama_kelas,
																		tanggal: timelineDate,
																		jam_ke: String(slot),
																	});
																	setCreateModalOpen(true);
																}}
																className='h-14 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-[#0D0D0D] hover:bg-yellow-50 hover:text-[#0D0D0D] transition-all cursor-pointer group'
																title={`+ Input Presensi Kelas ${kls.nama_kelas} Jam ke-${slot}`}
															>
																<span className='text-[10px] font-bold group-hover:scale-110 transition-transform'>
																	+ Presensi
																</span>
															</div>
														)}
													</td>
												);
											})}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* TAB 3: SEMUA RIWAYAT PRESENSI & TABEL LENGKAP */}
			{/* =================================================================== */}
			{activeTab === 'semua' && (
				<div className='space-y-4'>
					{/* Filter Bar Lengkap */}
					<div className='border-[3px] border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>
									Tanggal Presensi
								</label>
								<input
									type='date'
									value={filterTanggal}
									onChange={(e) => setFilterTanggal(e.target.value)}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>
									Rombel / Kelas
								</label>
								<select
									value={filterKelas}
									onChange={(e) => setFilterKelas(e.target.value)}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									<option value='all'>Semua Rombel</option>
									{kelasList.map((k) => (
										<option key={k.id} value={k.nama_kelas}>
											{k.nama_kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>
									Mata Pelajaran
								</label>
								<select
									value={filterMapel}
									onChange={(e) => setFilterMapel(e.target.value)}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									<option value='all'>Semua Mata Pelajaran</option>
									{mapelList.map((m) => (
										<option key={m.id} value={m.mapel}>
											{m.mapel}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>
									Guru Pengajar
								</label>
								<select
									value={filterGuru}
									onChange={(e) => setFilterGuru(e.target.value)}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									<option value='all'>Semua Dewan Guru</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>
									Status Jurnal KBM
								</label>
								<select
									value={filterJurnal}
									onChange={(e) => setFilterJurnal(e.target.value)}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									<option value='all'>Semua Status</option>
									<option value='linked'>✓ Tertaut ke Jurnal</option>
									<option value='unlinked'>⚠️ Belum Ada Jurnal</option>
								</select>
							</div>
						</div>

						<div className='flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100'>
							<div className='relative flex-1 min-w-[240px]'>
								<Search className='w-4 h-4 text-gray-500 absolute left-3 top-2.5' />
								<input
									type='text'
									placeholder='Cari nama guru, mapel, rombel, atau jam...'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='w-full pl-9 pr-3 py-1.5 border-2 border-[#0D0D0D] text-xs font-semibold shadow-[2px_2px_0px_0px_#0D0D0D]'
								/>
							</div>

							<div className='flex items-center gap-2'>
								<button
									onClick={() => {
										setFilterTanggal('');
										setFilterKelas('all');
										setFilterMapel('all');
										setFilterGuru('all');
										setFilterJurnal('all');
										setSearchQuery('');
									}}
									className='px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-[#0D0D0D] text-xs font-black uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Reset Filter
								</button>
							</div>
						</div>
					</div>

					{/* Summary Pills */}
					<div className='grid grid-cols-2 sm:grid-cols-5 gap-3'>
						<div className='p-3 bg-white border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-center'>
							<div className='text-[10px] font-black uppercase text-gray-600'>Total Sesi</div>
							<div className='text-2xl font-black text-[#0D0D0D] mt-1'>{summaryStats.totalSessions}</div>
						</div>
						<div className='p-3 bg-emerald-50 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-center'>
							<div className='text-[10px] font-black uppercase text-emerald-800'>Hadir (H)</div>
							<div className='text-2xl font-black text-emerald-700 mt-1'>{summaryStats.totalHadir}</div>
						</div>
						<div className='p-3 bg-amber-50 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-center'>
							<div className='text-[10px] font-black uppercase text-amber-800'>Sakit (S)</div>
							<div className='text-2xl font-black text-amber-700 mt-1'>{summaryStats.totalSakit}</div>
						</div>
						<div className='p-3 bg-sky-50 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-center'>
							<div className='text-[10px] font-black uppercase text-sky-800'>Izin (I)</div>
							<div className='text-2xl font-black text-sky-700 mt-1'>{summaryStats.totalIzin}</div>
						</div>
						<div className='p-3 bg-red-50 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-center'>
							<div className='text-[10px] font-black uppercase text-red-800'>Alfa (A)</div>
							<div className='text-2xl font-black text-red-600 mt-1'>{summaryStats.totalAlfa}</div>
						</div>
					</div>

					{/* Tabel Data Presensi */}
					<div className='border-[3px] border-[#0D0D0D] bg-white shadow-[6px_6px_0px_0px_#0D0D0D] overflow-x-auto'>
						<table className='w-full border-collapse text-left'>
							<thead>
								<tr className='bg-[#0D0D0D] text-white text-xs font-black uppercase'>
									<th className='p-3.5 border-r border-white/20 text-center w-12'>No</th>
									<th className='p-3.5 border-r border-white/20'>Tanggal & Waktu</th>
									<th className='p-3.5 border-r border-white/20'>Rombel & Mapel</th>
									<th className='p-3.5 border-r border-white/20'>Guru Pengajar</th>
									<th className='p-3.5 border-r border-white/20 text-center'>Jam Ke</th>
									<th className='p-3.5 border-r border-white/20'>Rincian Siswa</th>
									<th className='p-3.5 border-r border-white/20 text-center'>Status Jurnal</th>
									<th className='p-3.5 text-center'>Aksi Admin</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-200 text-xs font-medium'>
								{filteredSessions.length === 0 ? (
									<tr>
										<td colSpan={8} className='p-8 text-center text-gray-500 font-bold'>
											Tidak ada data presensi yang sesuai dengan filter yang dipilih.
										</td>
									</tr>
								) : (
									filteredSessions.map((s, idx) => (
										<tr key={s.sesi_id} className='hover:bg-gray-50 transition-colors'>
											<td className='p-3 border-r border-gray-200 text-center font-bold text-gray-500'>
												{idx + 1}
											</td>
											<td className='p-3 border-r border-gray-200'>
												<div className='font-black text-[#0D0D0D]'>{s.tanggal}</div>
												<div className='text-[10px] text-gray-500 font-semibold'>
													{s.waktu_absen ? `Pukul ${s.waktu_absen} WIB` : 'Presensi KBM'}
												</div>
											</td>
											<td className='p-3 border-r border-gray-200'>
												<div className='font-black text-[#0D0D0D]'>{s.mapel}</div>
												<div className='inline-block px-1.5 py-0.5 bg-yellow-200 border border-[#0D0D0D] rounded text-[10px] font-black uppercase mt-0.5'>
													Kelas {s.kelas}
												</div>
											</td>
											<td className='p-3 border-r border-gray-200'>
												<div className='font-bold text-[#0D0D0D]'>{s.guru_nama}</div>
												{s.catatan_admin && (
													<div className='text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 mt-0.5 truncate max-w-[200px]'>
														ℹ️ {s.catatan_admin}
													</div>
												)}
											</td>
											<td className='p-3 border-r border-gray-200 text-center'>
												<span className='px-2.5 py-1 bg-white border border-[#0D0D0D] rounded font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D]'>
													Jam {s.jam_ke}
												</span>
											</td>
											<td className='p-3 border-r border-gray-200'>
												<div className='flex items-center gap-1.5 font-bold text-[11px]'>
													<span className='px-2 py-0.5 bg-[#00E599]/20 text-emerald-800 rounded border border-emerald-300'>
														H: {s.summary?.hadir || 0}
													</span>
													<span className='px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300'>
														S: {s.summary?.sakit || 0}
													</span>
													<span className='px-2 py-0.5 bg-sky-100 text-sky-800 rounded border border-sky-300'>
														I: {s.summary?.izin || 0}
													</span>
													<span className='px-2 py-0.5 bg-red-100 text-red-800 rounded border border-red-300'>
														A: {s.summary?.alfa || 0}
													</span>
												</div>
											</td>
											<td className='p-3 border-r border-gray-200 text-center'>
												{s.has_jurnal ? (
													<span className='inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black text-[10px] uppercase'>
														<Check className='w-3 h-3' /> Tertaut
													</span>
												) : (
													<button
														onClick={() => handleCreateJurnalForSession(s)}
														className='inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded font-black text-[10px] uppercase transition-all cursor-pointer'
														title='Klik untuk terbitkan Jurnal KBM 1-klik'
													>
														<PlusCircle className='w-3 h-3' /> Buat Jurnal
													</button>
												)}
											</td>
											<td className='p-3 text-center'>
												<div className='flex items-center justify-center gap-1.5'>
													<button
														onClick={() => handleOpenDetailModal(s)}
														className='p-1.5 bg-[#00E599] hover:bg-emerald-400 text-[#0D0D0D] border border-[#0D0D0D] rounded shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
														title='Lihat & Edit Daftar Siswa'
													>
														<Users className='w-3.5 h-3.5' />
													</button>
													<button
														onClick={() => handleOpenEditSession(s)}
														className='p-1.5 bg-[#FFE600] hover:bg-yellow-400 text-[#0D0D0D] border border-[#0D0D0D] rounded shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
														title='Edit Data Sesi (Jam/Guru/Kelas)'
													>
														<Edit className='w-3.5 h-3.5' />
													</button>
													<button
														onClick={() => handleOpenSplitModal(s)}
														className='p-1.5 bg-sky-200 hover:bg-sky-300 text-[#0D0D0D] border border-[#0D0D0D] rounded shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
														title='Pecah Sesi (Split)'
													>
														<Scissors className='w-3.5 h-3.5' />
													</button>
													<button
														onClick={() => handleDeleteSession(s)}
														className='p-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
														title='Hapus Sesi Presensi'
													>
														<Trash2 className='w-3.5 h-3.5' />
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 1: INPUT PRESENSI GURU OLEH ADMIN (BANTUAN KENDALA TEKNIS) */}
			{/* =================================================================== */}
			{createModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-3xl max-h-[90vh] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col'>
						<div className='p-4 bg-[#FFE600] border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<span className='p-1.5 bg-white border-2 border-[#0D0D0D] rounded font-black text-sm'>
									⚡
								</span>
								<div>
									<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
										Input Presensi Siswa (Bantuan Kendala Guru)
									</h3>
									<p className='text-[10px] text-gray-700 font-bold'>
										Bypass geofence & otomatis disahkan oleh Administrator
									</p>
								</div>
							</div>
							<button
								onClick={() => setCreateModalOpen(false)}
								className='p-1.5 bg-white hover:bg-gray-100 border-2 border-[#0D0D0D] rounded shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<form onSubmit={handleCreateSubmit} className='flex-1 overflow-y-auto p-5 space-y-4 text-xs font-semibold'>
							{/* Form Header Info KBM */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>
										Pilih Guru Pengajar *
									</label>
									<select
										required
										value={createForm.guru_id}
										onChange={(e) => setCreateForm({ ...createForm, guru_id: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'
									>
										<option value=''>-- Pilih Dewan Guru --</option>
										{guruList.map((g) => (
											<option key={g.id_user} value={g.id_user}>
												{g.nama_lengkap}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>
										Rombel / Kelas *
									</label>
									<select
										required
										value={createForm.kelas}
										onChange={(e) => setCreateForm({ ...createForm, kelas: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'
									>
										<option value=''>-- Pilih Kelas --</option>
										{availableClassesForTeacher.map((k) => (
											<option key={k.id} value={k.nama_kelas}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>
										Mata Pelajaran *
									</label>
									<select
										required
										value={createForm.mapel}
										onChange={(e) => setCreateForm({ ...createForm, mapel: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'
									>
										<option value=''>-- Pilih Mapel --</option>
										{availableMapelsForTeacher.map((m) => (
											<option key={m.id} value={m.mapel}>
												{m.mapel}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>
										Tanggal KBM *
									</label>
									<input
										type='date'
										required
										value={createForm.tanggal}
										onChange={(e) => setCreateForm({ ...createForm, tanggal: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'
									/>
								</div>
							</div>

							{/* Jam Pelajaran */}
							<div>
								<label className='block font-black uppercase text-gray-700 mb-1'>
									Jam Pelajaran (JP) *
								</label>
								<div className='flex flex-wrap items-center gap-2 mb-2'>
									{PRESET_JAM_PELAJARAN.map((preset) => (
										<button
											key={preset}
											type='button'
											onClick={() => setCreateForm({ ...createForm, jam_ke: preset })}
											className={`px-3 py-1 border-2 border-[#0D0D0D] font-black text-xs cursor-pointer shadow-[2px_2px_0px_0px_#0D0D0D] ${
												createForm.jam_ke === preset ? 'bg-[#FFE600]' : 'bg-white hover:bg-gray-100'
											}`}
										>
											Jam {preset}
										</button>
									))}
								</div>
								<input
									type='text'
									required
									placeholder='Contoh: 1-2, 3-4, atau 1-3'
									value={createForm.jam_ke}
									onChange={(e) => setCreateForm({ ...createForm, jam_ke: e.target.value })}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'
								/>
							</div>

							{/* Pilihan Kendala Guru */}
							<div className='p-3 bg-gray-50 border-2 border-[#0D0D0D] space-y-2'>
								<label className='block font-black uppercase text-gray-700'>
									Alasan / Jenis Kendala Teknis Guru
								</label>
								<div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
									{KENDALA_PRESETS.map((kd) => (
										<button
											key={kd.id}
											type='button'
											onClick={() => setCreateForm({ ...createForm, alasan_kendala: kd.label })}
											className={`p-2 border-2 border-[#0D0D0D] text-left rounded text-xs font-bold transition-all cursor-pointer ${
												createForm.alasan_kendala === kd.label
													? 'bg-[#00E599] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'
													: 'bg-white text-gray-700 hover:bg-gray-100'
											}`}
										>
											<span className='mr-1.5'>{kd.icon}</span>
											<span>{kd.label}</span>
										</button>
									))}
								</div>
								<input
									type='text'
									placeholder='Catatan tambahan audit kendala admin (opsional)...'
									value={createForm.catatan_kendala}
									onChange={(e) => setCreateForm({ ...createForm, catatan_kendala: e.target.value })}
									className='w-full px-3 py-1.5 border border-[#0D0D0D] text-xs bg-white mt-1'
								/>
							</div>

							{/* Daftar Siswa & Presensi Checklist */}
							<div className='border-2 border-[#0D0D0D] p-3 space-y-3 bg-white'>
								<div className='flex items-center justify-between'>
									<div>
										<h4 className='font-black uppercase text-[#0D0D0D] text-xs'>
											Daftar Kehadiran Siswa ({createAbsensiList.length} Siswa)
										</h4>
										<p className='text-[10px] text-gray-500'>
											Klik tombol untuk mengubah status individual siswa
										</p>
									</div>
									<button
										type='button'
										onClick={handleSetAllHadir}
										className='px-3 py-1 bg-[#00E599] hover:bg-emerald-400 border border-[#0D0D0D] font-black text-[11px] uppercase shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'
									>
										✓ Set Semua Hadir
									</button>
								</div>

								{loadingRoster ? (
									<div className='py-6 text-center text-gray-500'>Memuat data siswa kelas...</div>
								) : createAbsensiList.length === 0 ? (
									<div className='py-6 text-center text-gray-500'>
										Pilih kelas terlebih dahulu untuk menampilkan daftar siswa.
									</div>
								) : (
									<div className='max-h-60 overflow-y-auto border border-[#0D0D0D] divide-y divide-gray-200'>
										{createAbsensiList.map((st, sIdx) => (
											<div
												key={st.siswa_id}
												className='p-2 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50'
											>
												<div className='min-w-[180px]'>
													<span className='font-black text-[#0D0D0D] mr-2'>{sIdx + 1}.</span>
													<span className='font-bold text-[#0D0D0D]'>{st.nama_lengkap}</span>
													<span className='text-[10px] text-gray-500 ml-1'>({st.nis})</span>
												</div>

												<div className='flex items-center gap-1.5'>
													{['hadir', 'sakit', 'izin', 'alfa'].map((statusKey) => {
														const isActive = normStatus(st.status) === statusKey;
														let activeColor = 'bg-[#00E599] text-black';
														if (statusKey === 'sakit') activeColor = 'bg-yellow-400 text-black';
														if (statusKey === 'izin') activeColor = 'bg-sky-400 text-black';
														if (statusKey === 'alfa') activeColor = 'bg-[#E8451A] text-white';

														return (
															<button
																key={statusKey}
																type='button'
																onClick={() => {
																	setCreateAbsensiList((prev) =>
																		prev.map((item) =>
																			item.siswa_id === st.siswa_id
																				? { ...item, status: statusKey }
																				: item
																		)
																	);
																}}
																className={`px-2.5 py-1 text-[10px] font-black uppercase rounded border border-[#0D0D0D] cursor-pointer transition-all ${
																	isActive ? `${activeColor} shadow-[1px_1px_0px_0px_#0D0D0D]` : 'bg-white hover:bg-gray-100 text-gray-600'
																}`}
															>
																{statusKey === 'hadir' && 'H'}
																{statusKey === 'sakit' && 'S'}
																{statusKey === 'izin' && 'I'}
																{statusKey === 'alfa' && 'A'}
															</button>
														);
													})}
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Options Checklist */}
							<div className='p-3 bg-yellow-50 border-2 border-[#0D0D0D] space-y-2'>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={createForm.sync_jurnal}
										onChange={(e) => setCreateForm({ ...createForm, sync_jurnal: e.target.checked })}
										className='w-4 h-4 text-[#0D0D0D] rounded border-[#0D0D0D]'
									/>
									<span className='font-black text-xs text-[#0D0D0D]'>
										Otomatis Buat & Sahkan Jurnal KBM Guru Terkait (Rekomendasi)
									</span>
								</label>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={createForm.override_conflict}
										onChange={(e) => setCreateForm({ ...createForm, override_conflict: e.target.checked })}
										className='w-4 h-4 text-red-600 rounded border-[#0D0D0D]'
									/>
									<span className='font-bold text-xs text-red-700'>
										Abaikan peringatan jika ada bentrok jam mengajar (Override)
									</span>
								</label>
							</div>

							{/* Actions Footer */}
							<div className='flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0D0D0D]'>
								<button
									type='button'
									onClick={() => setCreateModalOpen(false)}
									className='px-4 py-2 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border-2 border-[#0D0D0D] cursor-pointer'
								>
									Batal
								</button>
								<button
									type='submit'
									disabled={savingCreate}
									className='px-5 py-2.5 bg-[#00E599] hover:bg-emerald-400 font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									{savingCreate ? 'Menyimpan Presensi...' : '✓ Simpan & Sahkan Presensi'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 2: RINCIAN & EDIT PRESENSI SISWA */}
			{/* =================================================================== */}
			{detailModalOpen && selectedSessionDetail && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-2xl max-h-[85vh] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col'>
						<div className='p-4 bg-[#00E599] border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<div>
								<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
									Rincian Presensi Kelas {selectedSessionDetail.kelas}
								</h3>
								<p className='text-[10px] text-[#0D0D0D] font-bold'>
									{selectedSessionDetail.mapel} • {selectedSessionDetail.tanggal} (Jam ke-{selectedSessionDetail.jam_ke})
								</p>
							</div>
							<button
								onClick={() => setDetailModalOpen(false)}
								className='p-1.5 bg-white hover:bg-gray-100 border-2 border-[#0D0D0D] rounded shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<div className='flex-1 overflow-y-auto p-4 space-y-3'>
							{loadingDetailStudents ? (
								<div className='py-8 text-center text-gray-500 font-bold'>
									Memuat rincian presensi siswa...
								</div>
							) : (
								<div className='border-2 border-[#0D0D0D] divide-y divide-gray-200'>
									{detailStudentRows.map((st, idx) => (
										<div
											key={st.siswa_id}
											className='p-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50'
										>
											<div>
												<span className='font-black mr-2 text-xs text-gray-500'>{idx + 1}.</span>
												<span className='font-bold text-xs text-[#0D0D0D]'>{st.nama_lengkap}</span>
												<span className='text-[10px] text-gray-500 ml-1'>({st.nis})</span>
											</div>

											<div className='flex items-center gap-1'>
												{['hadir', 'sakit', 'izin', 'alfa'].map((stKey) => {
													const isActive = normStatus(st.status) === stKey;
													let activeBg = 'bg-[#00E599] text-black';
													if (stKey === 'sakit') activeBg = 'bg-yellow-400 text-black';
													if (stKey === 'izin') activeBg = 'bg-sky-400 text-black';
													if (stKey === 'alfa') activeBg = 'bg-[#E8451A] text-white';

													return (
														<button
															key={stKey}
															type='button'
															onClick={() => {
																setDetailStudentRows((prev) =>
																	prev.map((item) =>
																		item.siswa_id === st.siswa_id
																			? { ...item, status: stKey }
																			: item
																	)
																);
															}}
															className={`px-2.5 py-1 text-[10px] font-black uppercase rounded border border-[#0D0D0D] cursor-pointer transition-all ${
																isActive
																	? `${activeBg} shadow-[1px_1px_0px_0px_#0D0D0D]`
																	: 'bg-white hover:bg-gray-100 text-gray-600'
															}`}
														>
															{stKey === 'hadir' && 'Hadir'}
															{stKey === 'sakit' && 'Sakit'}
															{stKey === 'izin' && 'Izin'}
															{stKey === 'alfa' && 'Alfa'}
														</button>
													);
												})}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div className='p-3 bg-gray-50 border-t-2 border-[#0D0D0D] flex items-center justify-between'>
							<span className='text-xs font-bold text-gray-600'>
								Total: {detailStudentRows.length} Siswa
							</span>
							<div className='flex items-center gap-2'>
								<button
									onClick={() => setDetailModalOpen(false)}
									className='px-3 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Tutup
								</button>
								<button
									onClick={handleSaveStudentEdits}
									disabled={savingStudentEdits}
									className='px-4 py-1.5 bg-[#00E599] hover:bg-emerald-400 font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									{savingStudentEdits ? 'Menyimpan...' : '✓ Simpan Perubahan Siswa'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 3: EDIT SESI PRESENSI */}
			{/* =================================================================== */}
			{editModalOpen && editingSession && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-lg shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<div className='p-4 bg-[#FFE600] border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
								Edit Sesi Presensi KBM
							</h3>
							<button
								onClick={() => setEditModalOpen(false)}
								className='p-1.5 bg-white hover:bg-gray-100 border-2 border-[#0D0D0D] rounded cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<form onSubmit={handleEditSessionSubmit} className='p-5 space-y-3.5 text-xs font-semibold'>
							<div>
								<label className='block font-black uppercase text-gray-700 mb-1'>Guru Pengajar</label>
								<select
									value={editForm.guru_id}
									onChange={(e) => setEditForm({ ...editForm, guru_id: e.target.value })}
									className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
								>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap}
										</option>
									))}
								</select>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Rombel / Kelas</label>
									<select
										value={editForm.kelas}
										onChange={(e) => setEditForm({ ...editForm, kelas: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									>
										{kelasList.map((k) => (
											<option key={k.id} value={k.nama_kelas}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Mata Pelajaran</label>
									<select
										value={editForm.mapel}
										onChange={(e) => setEditForm({ ...editForm, mapel: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									>
										{mapelList.map((m) => (
											<option key={m.id} value={m.mapel}>
												{m.mapel}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Tanggal KBM</label>
									<input
										type='date'
										value={editForm.tanggal}
										onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Jam Pelajaran (JP)</label>
									<input
										type='text'
										value={editForm.jam_ke}
										onChange={(e) => setEditForm({ ...editForm, jam_ke: e.target.value })}
										placeholder='Contoh: 1-2 atau 3-4'
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>
							</div>

							<div className='p-2.5 bg-yellow-50 border border-[#0D0D0D] rounded space-y-1.5'>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={editForm.sync_jurnal}
										onChange={(e) => setEditForm({ ...editForm, sync_jurnal: e.target.checked })}
										className='w-4 h-4 text-[#0D0D0D]'
									/>
									<span className='font-bold text-xs text-[#0D0D0D]'>
										Sinkronkan perubahan ke Jurnal KBM yang tertaut
									</span>
								</label>
							</div>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-[#0D0D0D]'>
								<button
									type='button'
									onClick={() => setEditModalOpen(false)}
									className='px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Batal
								</button>
								<button
									type='submit'
									disabled={savingEdit}
									className='px-4 py-2 bg-[#00E599] hover:bg-emerald-400 font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									{savingEdit ? 'Menyimpan...' : '✓ Simpan Perubahan'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 4: RESOLUSI BENTROK JAM */}
			{/* =================================================================== */}
			{selectedConflict && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-lg shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<div className='p-4 bg-[#E8451A] text-white border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<Zap className='w-5 h-5' />
								<h3 className='font-black text-sm uppercase'>
									Resolusi Jam Bentrok (Kelas {selectedConflict.kelas})
								</h3>
							</div>
							<button
								onClick={() => setSelectedConflict(null)}
								className='p-1.5 bg-white text-black hover:bg-gray-100 border-2 border-[#0D0D0D] rounded cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<form onSubmit={handleResolveConflictSubmit} className='p-5 space-y-4 text-xs font-semibold'>
							<p className='text-gray-700 font-medium'>
								Kedua sesi presensi berikut saling bertabrakan di slot jam yang sama. Sesuaikan alokasi slot jam salah satu atau kedua sesi agar tidak lagi bentrok:
							</p>

							<div className='p-3 bg-red-50 border-2 border-[#0D0D0D] rounded space-y-2'>
								<div className='font-black text-red-900'>
									Sesi A: {selectedConflict.sessionA.mapel} ({selectedConflict.sessionA.guru_nama})
								</div>
								<div className='flex items-center gap-2'>
									<label className='font-bold'>Ubah Jam Sesi A:</label>
									<input
										type='text'
										value={resolveForm.sesi_a_jam}
										onChange={(e) => setResolveForm({ ...resolveForm, sesi_a_jam: e.target.value })}
										placeholder='Contoh: 1-2'
										className='px-2.5 py-1.5 border border-[#0D0D0D] font-bold bg-white text-xs'
									/>
								</div>
							</div>

							<div className='p-3 bg-orange-50 border-2 border-[#0D0D0D] rounded space-y-2'>
								<div className='font-black text-orange-900'>
									Sesi B: {selectedConflict.sessionB.mapel} ({selectedConflict.sessionB.guru_nama})
								</div>
								<div className='flex items-center gap-2'>
									<label className='font-bold'>Ubah Jam Sesi B:</label>
									<input
										type='text'
										value={resolveForm.sesi_b_jam}
										onChange={(e) => setResolveForm({ ...resolveForm, sesi_b_jam: e.target.value })}
										placeholder='Contoh: 3-4'
										className='px-2.5 py-1.5 border border-[#0D0D0D] font-bold bg-white text-xs'
									/>
								</div>
							</div>

							<label className='flex items-center gap-2 cursor-pointer pt-1'>
								<input
									type='checkbox'
									checked={resolveForm.sync_jurnal}
									onChange={(e) => setResolveForm({ ...resolveForm, sync_jurnal: e.target.checked })}
									className='w-4 h-4'
								/>
								<span className='font-bold text-gray-800'>
									Juga perbarui jam pada Jurnal KBM yang tertaut
								</span>
							</label>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-[#0D0D0D]'>
								<button
									type='button'
									onClick={() => setSelectedConflict(null)}
									className='px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Batal
								</button>
								<button
									type='submit'
									disabled={resolving}
									className='px-4 py-2 bg-[#FFE600] hover:bg-yellow-400 font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									{resolving ? 'Menyimpan Resolusi...' : '✓ Sahkan Jam Baru'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 5: PECAH SESI (SPLIT) */}
			{/* =================================================================== */}
			{splitModalOpen && splittingSession && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-md shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<div className='p-4 bg-sky-300 border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<Scissors className='w-4 h-4 text-[#0D0D0D]' />
								<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
									Pecah Sesi Presensi (Split)
								</h3>
							</div>
							<button
								onClick={() => setSplitModalOpen(false)}
								className='p-1.5 bg-white hover:bg-gray-100 border-2 border-[#0D0D0D] rounded cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<form onSubmit={handleSplitSessionSubmit} className='p-5 space-y-4 text-xs font-semibold'>
							<p className='text-gray-700 font-medium'>
								Pecah sesi <b>{splittingSession.mapel}</b> kelas <b>{splittingSession.kelas}</b> (saat ini Jam {splittingSession.jam_ke}) menjadi dua slot presensi terpisah:
							</p>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Slot Pertama (JP)</label>
									<input
										type='text'
										required
										value={splitForm.sesi_1_jam}
										onChange={(e) => setSplitForm({ ...splitForm, sesi_1_jam: e.target.value })}
										placeholder='Contoh: 1-2'
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Slot Kedua (JP)</label>
									<input
										type='text'
										required
										value={splitForm.sesi_2_jam}
										onChange={(e) => setSplitForm({ ...splitForm, sesi_2_jam: e.target.value })}
										placeholder='Contoh: 3'
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>
							</div>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-[#0D0D0D]'>
								<button
									type='button'
									onClick={() => setSplitModalOpen(false)}
									className='px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Batal
								</button>
								<button
									type='submit'
									disabled={savingSplit}
									className='px-4 py-2 bg-sky-300 hover:bg-sky-400 font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									{savingSplit ? 'Memproses...' : '✓ Pecah Sesi Sekarang'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 6: EKSPOR & CETAK LAPORAN (PDF & EXCEL) */}
			{/* =================================================================== */}
			{exportModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-lg shadow-[8px_8px_0px_0px_#0D0D0D]'>
						<div className='p-4 bg-white border-b-[3px] border-[#0D0D0D] flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<Printer className='w-4 h-4 text-[#0D0D0D]' />
								<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
									Ekspor Rekap Laporan Presensi
								</h3>
							</div>
							<button
								onClick={() => setExportModalOpen(false)}
								className='p-1.5 bg-white hover:bg-gray-100 border-2 border-[#0D0D0D] rounded cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<div className='p-5 space-y-4 text-xs font-semibold'>
							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Rombel / Kelas</label>
									<select
										value={exportFilterKelas}
										onChange={(e) => setExportFilterKelas(e.target.value)}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									>
										<option value='Semua'>Semua Kelas</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.nama_kelas}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Mata Pelajaran</label>
									<select
										value={exportFilterMapel}
										onChange={(e) => setExportFilterMapel(e.target.value)}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									>
										<option value='Semua'>Semua Mapel</option>
										{mapelList.map((m) => (
											<option key={m.id} value={m.mapel}>
												{m.mapel}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Dari Tanggal</label>
									<input
										type='date'
										value={exportStartDate}
										onChange={(e) => setExportStartDate(e.target.value)}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>

								<div>
									<label className='block font-black uppercase text-gray-700 mb-1'>Sampai Tanggal</label>
									<input
										type='date'
										value={exportEndDate}
										onChange={(e) => setExportEndDate(e.target.value)}
										className='w-full px-3 py-2 border-2 border-[#0D0D0D] font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'
									/>
								</div>
							</div>

							<div className='p-3 bg-gray-50 border border-gray-300 rounded text-xs space-y-1 font-medium'>
								<div className='font-bold text-[#0D0D0D]'>Pilihan Format Dokumen:</div>
								<p className='text-gray-600 text-[11px]'>
									• <b>Format PDF:</b> Dilengkapi Kop Surat Resmi Sekolah, garis ganda, dan lembar tanda tangan.
								</p>
								<p className='text-gray-600 text-[11px]'>
									• <b>Format Excel:</b> Spreadsheet lengkap untuk arsip data & audit kesiswaan.
								</p>
							</div>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-[#0D0D0D]'>
								<button
									type='button'
									onClick={() => setExportModalOpen(false)}
									className='px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold text-xs uppercase border border-[#0D0D0D] cursor-pointer'
								>
									Tutup
								</button>
								<button
									type='button'
									disabled={exporting}
									onClick={handleExportExcel}
									className='px-4 py-2 bg-emerald-300 hover:bg-emerald-400 text-[#0D0D0D] font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									📊 Unduh Excel (.xlsx)
								</button>
								<button
									type='button'
									disabled={exporting}
									onClick={handleExportPDF}
									className='px-4 py-2 bg-[#E8451A] hover:bg-red-600 text-white font-black text-xs uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer disabled:opacity-50'
								>
									📄 Unduh PDF (Kop Resmi)
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL 7: WHATSAPP HOTLINE */}
			{/* =================================================================== */}
			{waModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
					<div className='bg-white border-[3px] border-[#0D0D0D] w-full max-w-sm shadow-[8px_8px_0px_0px_#0D0D0D] p-5 space-y-4'>
						<div className='flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3'>
							<div className='flex items-center gap-2'>
								<LifeBuoy className='w-5 h-5 text-emerald-600' />
								<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
									Pusat Bantuan & Aduan KBM
								</h3>
							</div>
							<button
								onClick={() => setWaModalOpen(false)}
								className='p-1 border border-[#0D0D0D] rounded cursor-pointer'
							>
								<X className='w-4 h-4' />
							</button>
						</div>

						<p className='text-xs font-medium text-gray-700'>
							Jika guru mengalami kendala teknis (mati lampu, sinyal BTS mati, atau kendala perangkat), guru dapat melapor ke kontak resmi Administrator Kurikulum:
						</p>

						<div className='p-3.5 bg-emerald-50 border-2 border-[#0D0D0D] rounded-lg text-center space-y-2'>
							<div className='text-xs font-black uppercase text-emerald-900'>Hotline WhatsApp Admin</div>
							<div className='text-lg font-black text-[#0D0D0D]'>
								{schoolProfile.telepon || '082131028161'}
							</div>
							<a
								href={`https://wa.me/${(schoolProfile.telepon || '082131028161').replace(/\D/g, '')}?text=${encodeURIComponent('Halo Admin, saya mengalami kendala teknis dalam pengisian presensi siswa...')}`}
								target='_blank'
								rel='noopener noreferrer'
								className='inline-flex items-center gap-1.5 px-4 py-2 bg-[#00E599] text-[#0D0D0D] border-2 border-[#0D0D0D] font-black text-xs uppercase shadow-[2px_2px_0px_0px_#0D0D0D] hover:scale-105 transition-all'
							>
								<PhoneCall className='w-4 h-4' />
								<span>Hubungi via WhatsApp</span>
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
