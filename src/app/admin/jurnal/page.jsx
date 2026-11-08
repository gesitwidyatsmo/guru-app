'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import { useAdminAuth } from '../AdminLayoutClient';
import { normalizeJamKe, checkJamOverlap, parseJamPelajaran, PRESET_JAM_PELAJARAN } from '@/lib/absensiUtils';
import { getTodayDateString } from '@/lib/dateUtils';
import {
	getKBMStatusBadge,
	calculateDurationMinutes,
	formatDurationString,
	getExpectedScheduleTimes,
	getTimeWIB,
} from '@/lib/kbmRealtimeUtils';
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
} from 'lucide-react';

const JP_SLOTS = [1, 2, 3, 4, 5, 6, 7];

const KENDALA_PRESETS = [
	{ id: 'hp_mati', label: 'HP Mati / Baterai Habis', icon: '🔋' },
	{ id: 'sinyal_hilang', label: 'Tidak Ada Sinyal / Kuota Habis', icon: '📶' },
	{ id: 'hp_rusak', label: 'Kerusakan HP / Perangkat', icon: '📱' },
	{ id: 'gps_error', label: 'Kendala GPS / Geofence', icon: '📍' },
	{ id: 'laporan_fisik', label: 'Laporan Jurnal Fisik / Manual', icon: '📋' },
	{ id: 'lainnya', label: 'Kendala Teknis Lainnya', icon: '⚠️' },
];

const METODE_OPTIONS = ['Ceramah', 'Diskusi', 'Praktikum', 'Presentasi', 'Tanya Jawab', 'Penugasan'];

export default function AdminJurnalPage() {
	const { role, isKepsek } = useAdminAuth();

	// Active tab
	const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'timeline' | 'semua'

	// Main Data States
	const [loading, setLoading] = useState(true);
	const [journals, setJournals] = useState([]);
	const [conflicts, setConflicts] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [guruList, setGuruList] = useState([]);
	const [mapelList, setMapelList] = useState([]);

	// Filters
	const [filterTanggal, setFilterTanggal] = useState(getTodayDateString());
	const [filterKelas, setFilterKelas] = useState('all');
	const [filterGuru, setFilterGuru] = useState('all');
	const [filterStatus, setFilterStatus] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [radarFilter, setRadarFilter] = useState('all'); // 'all' | 'freed' | 'conflict'

	// Modal Resolusi Konflik
	const [selectedConflict, setSelectedConflict] = useState(null);
	const [resolving, setResolving] = useState(false);
	const [resolveForm, setResolveForm] = useState({
		guru_a_jam: '',
		guru_a_kelas: '',
		guru_b_jam: '',
		sync_absensi: true,
	});

	// Modal Edit Langsung Jurnal
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingJournal, setEditingJournal] = useState(null);
	const [editForm, setEditForm] = useState({
		id: '',
		guru_id: '',
		kelas: '',
		mapel: '',
		tanggal: '',
		jam_ke: '',
		materi: '',
		kegiatan: '',
		hambatan: '',
		solusi: '',
		status_kehadiran: 'Normal',
		status_verifikasi: 'disetujui',
		sync_absensi: true,
		override_conflict: false,
	});
	const [savingEdit, setSavingEdit] = useState(false);

	// Modal Input Jurnal Kendala Guru oleh Admin
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [savingCreate, setSavingCreate] = useState(false);
	const initialCreateForm = {
		guru_id: '',
		kelas: '',
		mapel: '',
		tanggal: getTodayDateString(),
		jam_ke: '1-2',
		pertemuan_ke: '1',
		metode: 'Ceramah',
		materi: '',
		kegiatan: '',
		hambatan: '',
		solusi: '',
		tuntas: true,
		jam_mulai: '07:15',
		jam_selesai: '08:35',
		durasi_menit: 80,
		status_kehadiran: 'Normal',
		alasan_kendala: 'HP Mati / Baterai Habis',
		catatan_kendala: '',
		sync_absensi: true,
		override_conflict: false,
	};
	const [createForm, setCreateForm] = useState(initialCreateForm);
	const [teacherAssignments, setTeacherAssignments] = useState({}); // { [guru_id]: [ { kelas, mapel }, ... ] }
	const [filterByTeacherAssignments, setFilterByTeacherAssignments] = useState(true);

	// State Pengaturan WhatsApp Aduan KBM
	const [waModalOpen, setWaModalOpen] = useState(false);
	const [waNumberInput, setWaNumberInput] = useState('');
	const [waNameInput, setWaNameInput] = useState('Admin Kurikulum');
	const [savingWa, setSavingWa] = useState(false);

	// Load Initial Master Data & Conflicts
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			const [resConflicts, resJournals, resKelas, resUsers, resMapel, resAssignments, resWaSetting, resSchoolProfile] = await Promise.all([
				fetch('/api/admin/jurnal?conflict_only=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { conflicts: [] })),
				fetch('/api/admin/jurnal', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/kelas?all=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/users', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/mapel?all=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/admin/jurnal?guru_assignments=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { assignments: {} })),
				fetch('/api/settings?key=wa_admin_jurnal', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
				fetch('/api/settings?key=profil_sekolah', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
			]);

			setConflicts(resConflicts?.conflicts || []);
			setJournals(Array.isArray(resJournals) ? resJournals : []);
			setKelasList(Array.isArray(resKelas) ? resKelas : []);
			setGuruList(Array.isArray(resUsers) ? resUsers.filter((u) => u.role === 'Guru') : []);
			setMapelList(Array.isArray(resMapel) ? resMapel : []);
			setTeacherAssignments(resAssignments?.assignments || {});

			if (resWaSetting?.value?.no_wa) {
				setWaNumberInput(resWaSetting.value.no_wa);
				if (resWaSetting.value.nama_kontak) setWaNameInput(resWaSetting.value.nama_kontak);
			} else if (typeof resWaSetting?.value === 'string' && resWaSetting.value.trim()) {
				setWaNumberInput(resWaSetting.value.trim());
			} else if (resSchoolProfile?.value?.telepon) {
				setWaNumberInput(resSchoolProfile.value.telepon);
			} else {
				setWaNumberInput('082131028161');
			}
		} catch (err) {
			console.error('Error fetching admin jurnal data:', err);
			Swal.fire({
				title: 'Gagal Memuat Data',
				text: err.message || 'Terjadi kesalahan sistem.',
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Buka Modal Resolusi Konflik
	const handleOpenResolve = (item) => {
		setSelectedConflict(item);
		const draftJam = item.draft?.jam_ke || '';
		const conflictJam = item.conflictWith?.jam_ke || '';

		// Hitung tebakan cerdas: Jika pergeseran (misal 4-5 vs 4-5), usulkan 3-4 untuk Guru A
		let suggestedJamA = conflictJam;
		if (draftJam === conflictJam) {
			const parsed = parseJamPelajaran(draftJam);
			if (parsed.length > 0 && parsed[0] > 2) {
				const start = parsed[0] - parsed.length;
				const end = parsed[0] - 1;
				suggestedJamA = start === end ? String(start) : `${start}-${end}`;
			}
		}

		setResolveForm({
			guru_a_jam: suggestedJamA,
			guru_a_kelas: item.conflictWith?.kelas || item.draft?.kelas || '',
			guru_b_jam: draftJam,
			sync_absensi: true,
		});
	};

	// Eksekusi Resolusi Konflik (Pangkas / Geser & Sahkan / Tolak Draft / Hapus Bentrok)
	const handleExecuteResolve = async (actionType = 'adjust_and_approve', targetConflict = null) => {
		const conflict = targetConflict || selectedConflict;
		if (!conflict) return;

		try {
			setResolving(true);
			const payload = {
				draft_id: conflict.draft?.id || conflict.id,
				conflict_id: conflict.conflictWith?.id || conflict.draft?.konflik_dengan_id,
				action: actionType,
				guru_a_update: {
					jam_ke: resolveForm.guru_a_jam || conflict.conflictWith?.jam_ke,
					kelas: resolveForm.guru_a_kelas || conflict.conflictWith?.kelas,
				},
				guru_b_update: {
					jam_ke: resolveForm.guru_b_jam || conflict.draft?.jam_ke,
				},
				sync_absensi: resolveForm.sync_absensi,
			};

			const res = await fetch('/api/admin/jurnal/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyelesaikan konflik.');

			await Swal.fire({
				title: 'Berhasil!',
				text: data.message || 'Konflik berhasil diselesaikan.',
				icon: 'success',
				confirmButtonColor: '#00E599',
				customClass: {
					confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				},
			});

			setSelectedConflict(null);
			fetchData();
		} catch (err) {
			console.error('Error resolve conflict:', err);
			Swal.fire({
				title: 'Gagal Menyelesaikan',
				text: err.message,
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setResolving(false);
		}
	};

	// 1-Klik Sahkan Draft yang Slotnya Sudah Bebas (Resolusi Mandiri Antar Guru)
	const handleApproveFreedDraft = async (draftId, mapel = '') => {
		const result = await Swal.fire({
			title: 'Sahkan Jurnal KBM?',
			text: `Slot jam untuk KBM ${mapel || ''} telah bebas dari bentrok (diselesaikan mandiri). Sahkan sekarang agar hak Bisaroh guru segera aktif?`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'Ya, Sahkan Sekarang',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00E599',
			cancelButtonColor: '#0D0D0D',
			customClass: {
				confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				cancelButton: 'text-white font-bold border-[2px] border-[#0D0D0D]',
			},
		});

		if (!result.isConfirmed) return;

		try {
			setResolving(true);
			const res = await fetch('/api/admin/jurnal/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					draft_id: draftId,
					action: 'approve_freed_draft',
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mengesahkan jurnal.');

			await Swal.fire({
				title: 'Berhasil Disahkan!',
				text: data.message || 'Jurnal KBM berhasil disahkan dan hak Bisaroh telah aktif.',
				icon: 'success',
				confirmButtonColor: '#00E599',
				customClass: {
					confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				},
			});

			fetchData();
		} catch (err) {
			console.error('Error approve freed draft:', err);
			Swal.fire({
				title: 'Gagal Mengesahkan',
				text: err.message,
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setResolving(false);
		}
	};

	// Sahkan Serentak Semua Draft yang Slotnya Sudah Bebas
	const handleApproveAllFreed = async (freedIds = []) => {
		if (!freedIds.length) return;

		const result = await Swal.fire({
			title: `Sahkan ${freedIds.length} Jurnal Bebas?`,
			text: `Semua KBM ini telah diverifikasi bahwa slot jamnya sudah bebas dari bentrok. Seluruh hak Bisaroh akan diaktifkan secara serentak.`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: `⚡ Ya, Sahkan Semua (${freedIds.length})`,
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00E599',
			cancelButtonColor: '#0D0D0D',
			customClass: {
				confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				cancelButton: 'text-white font-bold border-[2px] border-[#0D0D0D]',
			},
		});

		if (!result.isConfirmed) return;

		try {
			setResolving(true);
			const res = await fetch('/api/admin/jurnal/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					action: 'approve_all_freed',
					draft_ids: freedIds,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mengesahkan serentak.');

			await Swal.fire({
				title: 'Berhasil Disahkan!',
				text: data.message || 'Semua jurnal bebas berhasil disahkan serentak.',
				icon: 'success',
				confirmButtonColor: '#00E599',
				customClass: {
					confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				},
			});

			fetchData();
		} catch (err) {
			console.error('Error approve all freed:', err);
			Swal.fire({
				title: 'Gagal Mengesahkan',
				text: err.message,
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setResolving(false);
		}
	};

	// Buka Modal Edit Langsung Jurnal
	const handleOpenEdit = (j) => {
		setEditingJournal(j);
		setEditForm({
			id: j.id,
			guru_id: j.guru_id || '',
			kelas: j.kelas || '',
			mapel: j.mapel || '',
			tanggal: j.tanggal || '',
			jam_ke: j.jam_ke || '',
			materi: j.materi || '',
			kegiatan: j.kegiatan || '',
			hambatan: j.hambatan || '',
			solusi: j.solusi || '',
			status_kehadiran: j.status_kehadiran === 'Draft Bentrok' ? 'Normal' : (j.status_kehadiran || 'Normal'),
			status_verifikasi: 'disetujui',
			sync_absensi: true,
			override_conflict: false,
		});
		setEditModalOpen(true);
	};

	// Simpan Edit Jurnal
	const handleSaveEdit = async () => {
		try {
			setSavingEdit(true);
			const res = await fetch('/api/admin/jurnal', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(editForm),
			});

			const data = await res.json();
			if (!res.ok) {
				if (res.status === 409 && data.can_override) {
					const confirmOverride = await Swal.fire({
						title: 'Konflik Jam Terdeteksi!',
						text: `${data.error} Apakah Anda ingin tetap MEMAKSA SIMPAN (Override KBM Khusus / Team Teaching)?`,
						icon: 'warning',
						showCancelButton: true,
						confirmButtonText: 'Paksa Simpan (Override)',
						cancelButtonText: 'Batal & Ubah Jam',
						confirmButtonColor: '#E8451A',
					});

					if (confirmOverride.isConfirmed) {
						setEditForm((prev) => ({ ...prev, override_conflict: true }));
						const retryRes = await fetch('/api/admin/jurnal', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							credentials: 'include',
							body: JSON.stringify({ ...editForm, override_conflict: true }),
						});
						const retryData = await retryRes.json();
						if (retryRes.ok) {
							setEditModalOpen(false);
							fetchData();
							Swal.fire('Berhasil Disimpan', 'Jurnal berhasil diperbarui dengan override khusus.', 'success');
							return;
						} else {
							throw new Error(retryData.error || 'Gagal menyimpan perubahan override.');
						}
					}
					return;
				}
				throw new Error(data.error || 'Gagal menyimpan perubahan.');
			}

			await Swal.fire({
				title: 'Berhasil!',
				text: 'Data Jurnal KBM berhasil diperbarui.',
				icon: 'success',
				confirmButtonColor: '#00E599',
			});

			setEditModalOpen(false);
			fetchData();
		} catch (err) {
			console.error('Error save edit jurnal:', err);
			Swal.fire({
				title: 'Gagal Memperbarui',
				text: err.message,
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSavingEdit(false);
		}
	};

	// Helper Hitung Pertemuan Ke Cerdas
	const getSuggestedPertemuanKe = (k, m) => {
		if (!k || !m) return '1';
		const existingCount = journals.filter(
			(j) => j.kelas === k && j.mapel === m
		).length;
		return String(existingCount + 1);
	};

	// Pemetaan Penugasan Guru Terpilih (KBM, Jadwal, & Riwayat Jurnal)
	const currentGuruAssignments = useMemo(() => {
		if (!createForm.guru_id) return [];
		return teacherAssignments[createForm.guru_id] || [];
	}, [createForm.guru_id, teacherAssignments]);

	// Daftar Kelas yang Relevan untuk Guru Terpilih
	const availableKelasOptions = useMemo(() => {
		if (!filterByTeacherAssignments || currentGuruAssignments.length === 0) {
			return kelasList.map((k) => ({
				nama_kelas: k.nama_kelas,
				isAssigned: currentGuruAssignments.some((a) => a.kelas === k.nama_kelas),
			}));
		}
		const assignedKelasSet = new Set(currentGuruAssignments.map((a) => a.kelas));
		const result = [];
		assignedKelasSet.forEach((kNama) => {
			result.push({ nama_kelas: kNama, isAssigned: true });
		});
		return result;
	}, [filterByTeacherAssignments, currentGuruAssignments, kelasList]);

	// Daftar Mapel yang Relevan untuk Guru Terpilih (dan kelas terpilih jika ada)
	const availableMapelOptions = useMemo(() => {
		if (!filterByTeacherAssignments || currentGuruAssignments.length === 0) {
			return mapelList.map((m) => ({
				mapel: m.mapel,
				isAssigned: currentGuruAssignments.some((a) => a.mapel === m.mapel),
			}));
		}
		let assigned = currentGuruAssignments;
		if (createForm.kelas) {
			const forClass = currentGuruAssignments.filter((a) => a.kelas === createForm.kelas);
			if (forClass.length > 0) {
				assigned = forClass;
			}
		}
		const assignedMapelSet = new Set(assigned.map((a) => a.mapel));
		const result = [];
		assignedMapelSet.forEach((mNama) => {
			result.push({ mapel: mNama, isAssigned: true });
		});
		return result;
	}, [filterByTeacherAssignments, currentGuruAssignments, createForm.kelas, mapelList]);

	// Saat Guru Terpilih Berubah: Otomatis sinkronkan Kelas & Mapel pertama guru tersebut
	const handleGuruChange = (selectedGuruId) => {
		const guruAssigned = teacherAssignments[selectedGuruId] || [];
		let nextKelas = createForm.kelas;
		let nextMapel = createForm.mapel;

		if (guruAssigned.length > 0) {
			nextKelas = guruAssigned[0].kelas;
			nextMapel = guruAssigned[0].mapel;
		} else {
			if (!kelasList.some((k) => k.nama_kelas === nextKelas)) {
				nextKelas = kelasList[0]?.nama_kelas || '';
			}
			if (!mapelList.some((m) => m.mapel === nextMapel)) {
				nextMapel = mapelList[0]?.mapel || '';
			}
		}

		const nextPertemuan = getSuggestedPertemuanKe(nextKelas, nextMapel);

		setCreateForm((prev) => ({
			...prev,
			guru_id: selectedGuruId,
			kelas: nextKelas,
			mapel: nextMapel,
			pertemuan_ke: nextPertemuan,
		}));
	};

	// Saat Kelas Berubah: Otomatis sesuaikan Mapel jika ditautkan
	const handleKelasChange = (selectedKelas) => {
		let nextMapel = createForm.mapel;
		if (filterByTeacherAssignments && currentGuruAssignments.length > 0) {
			const mapelsInClass = currentGuruAssignments
				.filter((a) => a.kelas === selectedKelas)
				.map((a) => a.mapel);
			if (mapelsInClass.length > 0 && !mapelsInClass.includes(nextMapel)) {
				nextMapel = mapelsInClass[0];
			}
		}
		const p = getSuggestedPertemuanKe(selectedKelas, nextMapel);
		setCreateForm((prev) => ({
			...prev,
			kelas: selectedKelas,
			mapel: nextMapel,
			pertemuan_ke: p,
		}));
	};

	// Buka Modal Input Jurnal Kendala Guru oleh Admin
	const handleOpenCreateModal = () => {
		const defaultTanggal = filterTanggal || getTodayDateString();
		const sched = getExpectedScheduleTimes('1-2', defaultTanggal);
		const start = sched?.start || '07:15';
		const end = sched?.end || '08:35';
		const dur = calculateDurationMinutes(start, end);

		const defaultGuru = filterGuru !== 'all' ? filterGuru : (guruList[0]?.id_user || '');
		const guruAssigned = defaultGuru ? (teacherAssignments[defaultGuru] || []) : [];

		let defaultKelas = '';
		let defaultMapel = '';

		if (guruAssigned.length > 0) {
			defaultKelas = guruAssigned[0].kelas;
			defaultMapel = guruAssigned[0].mapel;
		} else {
			defaultKelas = filterKelas !== 'all' ? filterKelas : (kelasList[0]?.nama_kelas || '');
			defaultMapel = mapelList[0]?.mapel || '';
		}

		const initialPertemuan = getSuggestedPertemuanKe(defaultKelas, defaultMapel);

		setFilterByTeacherAssignments(true); // Default selalu aktif menautkan ke jadwal guru
		setCreateForm({
			...initialCreateForm,
			tanggal: defaultTanggal,
			guru_id: defaultGuru,
			kelas: defaultKelas,
			mapel: defaultMapel,
			pertemuan_ke: initialPertemuan,
			jam_ke: '1-2',
			jam_mulai: start,
			jam_selesai: end,
			durasi_menit: dur,
		});
		setCreateModalOpen(true);
	};

	// Saat Jam Ke berubah: update jam_mulai & jam_selesai otomatis
	const handleCreateJamKeChange = (val) => {
		const sched = getExpectedScheduleTimes(val, createForm.tanggal);
		if (sched) {
			const dur = calculateDurationMinutes(sched.start, sched.end);
			setCreateForm((prev) => ({
				...prev,
				jam_ke: val,
				jam_mulai: sched.start,
				jam_selesai: sched.end,
				durasi_menit: dur,
			}));
		} else {
			setCreateForm((prev) => ({ ...prev, jam_ke: val }));
		}
	};

	// Tombol Pintas: Isi Jadwal Resmi
	const handleFillOfficialSchedule = () => {
		const sched = getExpectedScheduleTimes(createForm.jam_ke, createForm.tanggal);
		if (sched) {
			const dur = calculateDurationMinutes(sched.start, sched.end);
			setCreateForm((prev) => ({
				...prev,
				jam_mulai: sched.start,
				jam_selesai: sched.end,
				durasi_menit: dur,
			}));
			Swal.fire({
				toast: true,
				position: 'top-end',
				icon: 'success',
				title: `Jam diset: ${sched.start} - ${sched.end} (${sched.hari})`,
				showConfirmButton: false,
				timer: 2000,
			});
		} else {
			Swal.fire('Informasi', 'Alokasi jadwal resmi untuk slot jam ini tidak ditemukan. Silakan atur manual.', 'info');
		}
	};

	// Tombol Pintas: Isi Jam Sekarang
	const handleFillCurrentTime = () => {
		const now = getTimeWIB(new Date());
		setCreateForm((prev) => {
			const start = prev.jam_mulai || now;
			const dur = calculateDurationMinutes(start, now);
			return {
				...prev,
				jam_selesai: now,
				durasi_menit: dur,
			};
		});
	};

	// Saat Jam Mulai / Selesai diubah manual
	const handleCreateTimeChange = (field, val) => {
		setCreateForm((prev) => {
			const next = { ...prev, [field]: val };
			if (next.jam_mulai && next.jam_selesai) {
				next.durasi_menit = calculateDurationMinutes(next.jam_mulai, next.jam_selesai);
			}
			return next;
		});
	};

	// Toggle Metode
	const handleToggleCreateMetode = (methodName) => {
		const current = (createForm.metode || '')
			.split(',')
			.map((m) => m.trim())
			.filter(Boolean);
		let next;
		if (current.includes(methodName)) {
			next = current.filter((m) => m !== methodName);
		} else {
			next = [...current, methodName];
		}
		setCreateForm((prev) => ({
			...prev,
			metode: next.join(', ') || 'Ceramah',
		}));
	};

	// Simpan Input Jurnal Kendala Guru
	const handleSaveCreate = async () => {
		if (!createForm.guru_id) {
			Swal.fire('Peringatan', 'Harap pilih Guru pengajar.', 'warning');
			return;
		}
		if (!createForm.kelas) {
			Swal.fire('Peringatan', 'Harap pilih Kelas.', 'warning');
			return;
		}
		if (!createForm.mapel) {
			Swal.fire('Peringatan', 'Harap pilih Mata Pelajaran.', 'warning');
			return;
		}
		if (!createForm.tanggal) {
			Swal.fire('Peringatan', 'Tanggal KBM wajib diisi.', 'warning');
			return;
		}
		if (!createForm.jam_ke) {
			Swal.fire('Peringatan', 'Jam ke (JP) wajib diisi.', 'warning');
			return;
		}
		if (!createForm.materi.trim()) {
			Swal.fire('Peringatan', 'Materi pembelajaran wajib diisi.', 'warning');
			return;
		}

		try {
			setSavingCreate(true);
			const res = await fetch('/api/admin/jurnal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(createForm),
			});

			const data = await res.json();
			if (!res.ok) {
				if (res.status === 409 && data.can_override) {
					const confirmOverride = await Swal.fire({
						title: 'Konflik Jam Terdeteksi!',
						text: `${data.error} Apakah Anda ingin tetap MEMAKSA SIMPAN (Override KBM Khusus / Team Teaching)?`,
						icon: 'warning',
						showCancelButton: true,
						confirmButtonText: 'Paksa Simpan (Override)',
						cancelButtonText: 'Batal & Ubah Jam',
						confirmButtonColor: '#E8451A',
					});

					if (confirmOverride.isConfirmed) {
						const retryRes = await fetch('/api/admin/jurnal', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							credentials: 'include',
							body: JSON.stringify({ ...createForm, override_conflict: true }),
						});
						const retryData = await retryRes.json();
						if (retryRes.ok) {
							setCreateModalOpen(false);
							fetchData();
							Swal.fire('Berhasil Disimpan', 'Jurnal guru berhasil diinput dengan override khusus.', 'success');
							return;
						} else {
							throw new Error(retryData.error || 'Gagal menyimpan jurnal override.');
						}
					}
					return;
				}
				throw new Error(data.error || 'Gagal menyimpan jurnal.');
			}

			const guruObj = guruList.find((g) => g.id_user === createForm.guru_id);
			const namaGuru = guruObj?.nama_lengkap || 'Guru';

			await Swal.fire({
				title: 'Berhasil Disimpan!',
				html: `
					<div class="text-left text-sm space-y-2">
						<p>Jurnal KBM atas nama <b>${namaGuru}</b> telah berhasil disimpan dan langsung disahkan oleh Admin.</p>
						<p class="text-xs text-gray-600">Jam KBM & hak Bisaroh guru telah aktif.</p>
					</div>
				`,
				icon: 'success',
				confirmButtonColor: '#00E599',
				customClass: {
					confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				},
			});

			setCreateModalOpen(false);
			fetchData();
		} catch (err) {
			console.error('Error save create jurnal admin:', err);
			Swal.fire({
				title: 'Gagal Menyimpan',
				text: err.message,
				icon: 'error',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSavingCreate(false);
		}
	};

	// Hapus Jurnal
	const handleDeleteJournal = async (j) => {
		const result = await Swal.fire({
			title: 'Hapus Jurnal KBM?',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Anda akan menghapus jurnal KBM <b>${j.mapel}</b> kelas <b>${j.kelas}</b> (Jam <b>${j.jam_ke}</b>) oleh <b>${j.users?.nama_lengkap || 'Guru'}</b>.</p>
					<div class="p-2 bg-red-50 border border-red-200 text-xs text-red-700">
						Tindakan ini tidak dapat dibatalkan.
					</div>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus Jurnal',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
		});

		if (!result.isConfirmed) return;

		try {
			const res = await fetch(`/api/admin/jurnal?id=${encodeURIComponent(j.id)}&delete_absensi=true`, {
				method: 'DELETE',
				credentials: 'include',
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menghapus.');

			Swal.fire('Terhapus', 'Jurnal berhasil dihapus dari sistem.', 'success');
			fetchData();
		} catch (err) {
			console.error('Error delete jurnal:', err);
			Swal.fire('Gagal Menghapus', err.message, 'error');
		}
	};

	// Simpan Pengaturan Nomor WhatsApp Aduan KBM
	const handleSaveWaNumber = async () => {
		if (!waNumberInput.trim()) {
			Swal.fire('Peringatan', 'Nomor WhatsApp wajib diisi.', 'warning');
			return;
		}
		try {
			setSavingWa(true);
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					key: 'wa_admin_jurnal',
					value: {
						no_wa: waNumberInput.trim(),
						nama_kontak: waNameInput.trim() || 'Admin',
						updated_at: new Date().toISOString(),
					},
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan WhatsApp.');

			await Swal.fire({
				title: 'Berhasil Disimpan!',
				text: `Nomor WhatsApp aduan KBM berhasil diatur ke ${waNumberInput.trim()}`,
				icon: 'success',
				confirmButtonColor: '#00E599',
				customClass: {
					confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
				},
			});
			setWaModalOpen(false);
		} catch (err) {
			console.error('Error save WA settings:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSavingWa(false);
		}
	};

	// Pangkas Cepat Jam Jurnal (Misal 1-4 menjadi 1-2)
	const handleQuickTrim = async (j) => {
		const parsed = parseJamPelajaran(j.jam_ke);
		if (parsed.length <= 1) {
			Swal.fire('Informasi', 'Jurnal ini hanya 1 JP dan tidak dapat dipangkas otomatis.', 'info');
			return;
		}

		const half = Math.ceil(parsed.length / 2);
		const trimmedSlots = parsed.slice(0, half);
		const newJamKe = trimmedSlots.length === 1 ? String(trimmedSlots[0]) : `${trimmedSlots[0]}-${trimmedSlots[trimmedSlots.length - 1]}`;

		const prompt = await Swal.fire({
			title: 'Pangkas Jam Pelajaran?',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Jam saat ini: <b>${j.jam_ke}</b> (${parsed.length} JP)</p>
					<p>Akan dipangkas menjadi: <b class="text-[#00E599]">${newJamKe}</b> (${half} JP)</p>
					<p class="text-xs text-gray-600 mt-2">Slot jam sisanya akan otomatis terbuka untuk guru lain.</p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: `Pangkas ke Jam ${newJamKe}`,
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00E599',
			customClass: {
				confirmButton: 'text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D]',
			},
		});

		if (!prompt.isConfirmed) return;

		try {
			const res = await fetch('/api/admin/jurnal', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					id: j.id,
					jam_ke: newJamKe,
					sync_absensi: true,
					catatan_admin: `Dipangkas dari ${j.jam_ke} menjadi ${newJamKe} oleh Admin`,
				}),
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || 'Gagal memangkas.');
			}

			Swal.fire('Berhasil!', `Jam berhasil dipangkas menjadi ${newJamKe}.`, 'success');
			fetchData();
		} catch (err) {
			Swal.fire('Gagal Pangkas', err.message, 'error');
		}
	};

	// Filter untuk Tab Semua Jurnal
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (filterKelas !== 'all' && j.kelas !== filterKelas) return false;
			if (filterGuru !== 'all' && j.guru_id !== filterGuru) return false;
			if (filterTanggal && j.tanggal !== filterTanggal) return false;

			if (filterStatus === 'draft') {
				if (j.status_verifikasi !== 'draft_bentrok' && j.status_kehadiran !== 'Draft Bentrok') return false;
			} else if (filterStatus === 'disetujui') {
				if (j.status_verifikasi === 'draft_bentrok' || j.status_kehadiran === 'Draft Bentrok') return false;
			} else if (filterStatus === 'mandiri') {
				const note = String(j.catatan_admin || '').toLowerCase();
				if (!note.includes('mandiri') && !note.includes('dibebaskan')) return false;
			}

			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const matchGuru = j.users?.nama_lengkap?.toLowerCase().includes(q);
				const matchMapel = j.mapel?.toLowerCase().includes(q);
				const matchMateri = j.materi?.toLowerCase().includes(q);
				if (!matchGuru && !matchMapel && !matchMateri) return false;
			}

			return true;
		});
	}, [journals, filterKelas, filterGuru, filterTanggal, filterStatus, searchQuery]);

	// Klasifikasi Konflik: yang slotnya sudah bebas vs yang masih tumpang tindih
	const freedConflicts = useMemo(() => conflicts.filter((c) => c.slotIsFree), [conflicts]);
	const stillConflicts = useMemo(() => conflicts.filter((c) => c.isStillConflict), [conflicts]);
	const displayedConflicts = useMemo(() => {
		if (radarFilter === 'freed') return freedConflicts;
		if (radarFilter === 'conflict') return stillConflicts;
		return conflicts;
	}, [radarFilter, conflicts, freedConflicts, stillConflicts]);

	// Visual Grid: Matriks Jam per Kelas untuk Tanggal Terpilih
	const timelineData = useMemo(() => {
		const targetDate = filterTanggal || getTodayDateString();
		const dayJournals = journals.filter((j) => j.tanggal === targetDate);

		// Buat peta per kelas
		const mapByClass = {};
		kelasList.forEach((k) => {
			mapByClass[k.nama_kelas] = {
				kelas: k.nama_kelas,
				slots: {},
			};
		});

		dayJournals.forEach((j) => {
			if (!mapByClass[j.kelas]) {
				mapByClass[j.kelas] = { kelas: j.kelas, slots: {} };
			}
			const parsed = parseJamPelajaran(j.jam_ke);
			parsed.forEach((slotNum) => {
				if (!mapByClass[j.kelas].slots[slotNum]) {
					mapByClass[j.kelas].slots[slotNum] = [];
				}
				mapByClass[j.kelas].slots[slotNum].push(j);
			});
		});

		return Object.values(mapByClass);
	}, [journals, filterTanggal, kelasList]);

	if (loading) return <Loader />;

	return (
		<div className='min-h-screen bg-[#FFFDF8] p-4 sm:p-6 lg:p-8 space-y-6'>
			{/* HEADER */}
			<div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-[3px] border-[#0D0D0D] bg-white p-6 shadow-[6px_6px_0px_0px_#0D0D0D]'>
				<div>
					<div className='flex items-center gap-3'>
						<div className='p-2 bg-[#F5C518] border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D]'>
							<Layers className='w-6 h-6 text-[#0D0D0D]' />
						</div>
						<div>
							<h1 className='text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0D0D0D]'>
								Kelola Jurnal KBM & Resolusi Jam
							</h1>
							<p className='text-sm text-gray-700 font-bold'>
								Pusat supervisi, penyelesaian bentrok jam, dan penyesuaian jadwal mengajar mandiri admin.
							</p>
						</div>
					</div>
				</div>

				<div className='flex flex-wrap items-center gap-2'>
					<button
						onClick={handleOpenCreateModal}
						className='flex items-center gap-2 px-4 py-2.5 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#0D0D0D] transition-all cursor-pointer'
						title='Input jurnal KBM untuk guru yang mengalami kendala teknis (HP mati, sinyal putus, dsb)'
					>
						<PlusCircle className='w-4 h-4' />
						<span>+ Input Jurnal Kendala Guru</span>
					</button>
					<button
						onClick={() => setWaModalOpen(true)}
						className='flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-[#0D0D0D] border-[3px] border-[#0D0D0D] text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#0D0D0D] transition-all cursor-pointer'
						title='Atur nomor WhatsApp tujuan aduan jam bentrok KBM guru'
					>
						<span className='text-sm'>📱</span>
						<span>Atur No. WA Aduan</span>
						{waNumberInput && (
							<span className='px-1.5 py-0.5 bg-white text-[#0D0D0D] text-[10px] font-black border border-[#0D0D0D]'>
								{waNumberInput}
							</span>
						)}
					</button>
					<button
						onClick={fetchData}
						className='flex items-center gap-1.5 px-4 py-2.5 bg-white border-[3px] border-[#0D0D0D] text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:bg-[#F5C518] transition-all cursor-pointer'
					>
						<RefreshCw className='w-4 h-4' />
						Segarkan Data
					</button>
				</div>
			</div>

			{/* TAB NAVIGASI */}
			<div className='flex flex-wrap gap-2 border-b-[3px] border-[#0D0D0D] pb-3'>
				<button
					onClick={() => setActiveTab('radar')}
					className={`flex items-center gap-2 px-5 py-3 border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
						activeTab === 'radar'
							? 'bg-[#E8451A] text-white shadow-[4px_4px_0px_0px_#0D0D0D] -translate-y-1'
							: 'bg-white text-[#0D0D0D] hover:bg-orange-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
					}`}
				>
					<AlertTriangle className='w-4 h-4' />
					Radar Aduan & Antrean Bentrok
					{conflicts.length > 0 && (
						<span className='px-2 py-0.5 bg-[#F5C518] text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black text-[11px] rounded-full'>
							{conflicts.length}
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
					Timeline Slot KBM Harian
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
					Semua Jurnal KBM ({journals.length})
				</button>
			</div>

			{/* =================================================================== */}
			{/* TAB 1: RADAR ADUAN & ANTREAN BENTROK */}
			{/* =================================================================== */}
			{activeTab === 'radar' && (
				<div className='space-y-6'>
					{conflicts.length === 0 ? (
						<div className='border-[3px] border-[#0D0D0D] bg-white p-12 text-center shadow-[6px_6px_0px_0px_#0D0D0D] space-y-3'>
							<div className='w-16 h-16 bg-[#00E599] border-[3px] border-[#0D0D0D] mx-auto flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<CheckCircle2 className='w-8 h-8 text-[#0D0D0D]' />
							</div>
							<h3 className='text-xl font-black uppercase tracking-tight text-[#0D0D0D]'>
								Tidak Ada Aduan / Antrean Bentrok!
							</h3>
							<p className='text-sm text-gray-700 max-w-md mx-auto font-medium'>
								Seluruh KBM yang masuk saat ini berstatus normal. Jika ada guru yang terhalang bentrok dan menyimpan sebagai antrean, aduannya akan otomatis muncul di sini.
							</p>
						</div>
					) : (
						<div className='space-y-5'>
							{/* Sub-filter & Aksi Serentak */}
							<div className='flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<div className='flex flex-wrap items-center gap-2'>
									<button
										onClick={() => setRadarFilter('all')}
										className={`px-3.5 py-1.5 border-[2px] border-[#0D0D0D] font-black text-xs uppercase transition-all cursor-pointer ${
											radarFilter === 'all'
												? 'bg-[#0D0D0D] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'
												: 'bg-white text-[#0D0D0D] hover:bg-gray-100'
										}`}
									>
										Semua ({conflicts.length})
									</button>
									<button
										onClick={() => setRadarFilter('freed')}
										className={`px-3.5 py-1.5 border-[2px] border-[#0D0D0D] font-black text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
											radarFilter === 'freed'
												? 'bg-[#00E599] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'
												: 'bg-white text-[#0D0D0D] hover:bg-emerald-50'
										}`}
									>
										<span>🟢 Sudah Bebas / Mandiri</span>
										<span className='px-1.5 py-0.2 bg-white text-[#0D0D0D] border border-black text-[10px]'>
											{freedConflicts.length}
										</span>
									</button>
									<button
										onClick={() => setRadarFilter('conflict')}
										className={`px-3.5 py-1.5 border-[2px] border-[#0D0D0D] font-black text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
											radarFilter === 'conflict'
												? 'bg-[#E8451A] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'
												: 'bg-white text-[#0D0D0D] hover:bg-rose-50'
										}`}
									>
										<span>⚠️ Masih Bentrok</span>
										<span className='px-1.5 py-0.2 bg-white text-[#0D0D0D] border border-black text-[10px]'>
											{stillConflicts.length}
										</span>
									</button>
								</div>

								{freedConflicts.length > 0 && (
									<button
										onClick={() => handleApproveAllFreed(freedConflicts.map((c) => c.id))}
										className='flex items-center gap-1.5 px-4 py-2 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer'
									>
										<span>⚡ Sahkan Semua Bebas ({freedConflicts.length})</span>
									</button>
								)}
							</div>

							{/* Notifikasi Rekomendasi Selesai Mandiri */}
							{freedConflicts.length > 0 && radarFilter !== 'conflict' && (
								<div className='border-[3px] border-[#0D0D0D] bg-emerald-100 p-4 shadow-[4px_4px_0px_0px_#00E599] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
									<div className='flex items-start gap-3'>
										<span className='text-2xl'>🎉</span>
										<div className='space-y-0.5'>
											<h4 className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase'>
												{freedConflicts.length} KBM Telah Bebas / Selesai Mandiri Antar Guru!
											</h4>
											<p className='text-xs text-gray-800 font-medium'>
												Guru lawan telah menggeser jadwal atau membebaskan slot jam. KBM siap disahkan agar hak Bisaroh guru segera aktif.
											</p>
										</div>
									</div>
									<button
										onClick={() => handleApproveAllFreed(freedConflicts.map((c) => c.id))}
										className='px-3.5 py-1.5 bg-[#00E599] text-[#0D0D0D] font-black text-xs uppercase border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 whitespace-nowrap cursor-pointer'
									>
										⚡ Sahkan Serentak
									</button>
								</div>
							)}

							{/* Daftar Kartu Konflik / Draft Antrean */}
							{displayedConflicts.length === 0 ? (
								<div className='border-[3px] border-[#0D0D0D] bg-white p-8 text-center shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<p className='text-xs font-bold text-gray-600 uppercase'>
										Tidak ada data aduan pada kategori filter ini.
									</p>
								</div>
							) : (
								<div className='grid grid-cols-1 gap-6'>
									{displayedConflicts.map((item, idx) => {
										const draft = item.draft;
										const conflictWith = item.conflictWith;
										const draftGuru = draft.users?.nama_lengkap || 'Guru Pengajar';
										const conflictGuru = conflictWith?.users?.nama_lengkap || 'Guru Terkait';
										const slotIsFree = item.slotIsFree;

										return (
											<div
												key={draft.id || idx}
												className={`border-[4px] p-5 sm:p-6 shadow-[6px_6px_0px_0px_#0D0D0D] space-y-4 ${
													slotIsFree
														? 'border-[#00E599] bg-[#F4FDF8]'
														: 'border-[#0D0D0D] bg-white'
												}`}
											>
												{/* Banner Status */}
												<div
													className={`flex flex-wrap items-center justify-between gap-2 p-3 border-[2px] ${
														slotIsFree
															? 'bg-emerald-100 border-[#00E599]'
															: 'bg-red-100 border-[#E8451A]'
													}`}
												>
													<div className='flex items-center gap-2'>
														<span
															className={`px-2.5 py-1 font-black text-xs uppercase border border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] ${
																slotIsFree
																	? 'bg-[#00E599] text-[#0D0D0D]'
																	: 'bg-[#E8451A] text-white'
															}`}
														>
															{slotIsFree
																? '🟢 Slot Sudah Bebas (Selesai Mandiri)'
																: '⚠️ Konflik Jam Aktif'}
														</span>
														<span className='font-bold text-xs text-[#0D0D0D]'>
															Kelas <b>{draft.kelas}</b> • Tanggal <b>{draft.tanggal}</b>
														</span>
													</div>
													<div className='flex items-center gap-2'>
														{slotIsFree && (
															<span className='text-[11px] font-black text-emerald-800 bg-white px-2 py-0.5 border border-[#00E599]'>
																Siap Disahkan (1-Klik)
															</span>
														)}
														<span className='text-xs font-black text-gray-600'>
															ID: #{draft.id.slice(0, 8)}
														</span>
													</div>
												</div>

												{/* Catatan Status Resolusi Cerdas */}
												{item.resolutionNote && (
													<div
														className={`p-3 border-[2px] shadow-[2px_2px_0px_0px_#0D0D0D] flex items-start gap-2.5 text-xs ${
															slotIsFree
																? 'bg-white border-[#00E599]'
																: 'bg-[#FFF9F5] border-[#E8451A]'
														}`}
													>
														<span className='text-base'>{slotIsFree ? '✅' : '⚠️'}</span>
														<div className='space-y-0.5'>
															<div className='font-black text-[#0D0D0D] uppercase text-[11px]'>
																{slotIsFree
																	? 'Status Koordinasi Mandiri Antar Guru:'
																	: 'Status Tumpang Tindih Jam:'}
															</div>
															<p
																className={`font-bold ${
																	slotIsFree ? 'text-emerald-950' : 'text-rose-950'
																}`}
															>
																{item.resolutionNote}
															</p>
														</div>
													</div>
												)}

												{/* Perbandingan Berdampingan (Kiri: Jurnal Terbit / Lawan, Kanan: Draft Antrean) */}
												<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
													{/* Sesi KBM Pembanding / Lawan */}
													<div className='p-4 border-[3px] border-[#0D0D0D] bg-[#FFF5F0] space-y-2'>
														<div className='flex items-center justify-between'>
															<span className='text-[11px] font-black uppercase px-2 py-0.5 bg-[#E8451A] text-white border-[2px] border-[#0D0D0D]'>
																{slotIsFree
																	? '1. KBM Terkait (Telah Digeser/Bebas)'
																	: '1. Jurnal Terbit (Di Database)'}
															</span>
															<span className='text-xs font-black text-[#E8451A]'>
																Jam ke-{conflictWith?.jam_ke || '-'}
															</span>
														</div>
														<h4 className='text-base font-black text-[#0D0D0D]'>{conflictGuru}</h4>
														<p className='text-xs font-bold text-gray-700'>
															Kelas: <b>{conflictWith?.kelas || '-'}</b> • Mapel: <b>{conflictWith?.mapel || '-'}</b>
														</p>
														<p className='text-xs text-gray-600 line-clamp-2'>
															Materi: {conflictWith?.materi || '(Belum ada catatan materi)'}
														</p>
													</div>

													{/* Guru B (Draft Antrean Menunggu) */}
													<div
														className={`p-4 border-[3px] border-[#0D0D0D] space-y-2 ${
															slotIsFree ? 'bg-emerald-50' : 'bg-[#FFFDF0]'
														}`}
													>
														<div className='flex items-center justify-between'>
															<span
																className={`text-[11px] font-black uppercase px-2 py-0.5 border-[2px] border-[#0D0D0D] ${
																	slotIsFree
																		? 'bg-[#00E599] text-[#0D0D0D]'
																		: 'bg-[#F5C518] text-[#0D0D0D]'
																}`}
															>
																2. Draft Antrean ({slotIsFree ? 'Slot Bebas' : 'Menunggu'})
															</span>
															<span className='text-xs font-black text-[#0D0D0D]'>
																Diajukan: Jam ke-{draft.jam_ke}
															</span>
														</div>
														<h4 className='text-base font-black text-[#0D0D0D]'>{draftGuru}</h4>
														<p className='text-xs font-bold text-gray-700'>
															Kelas: <b>{draft.kelas || '-'}</b> • Mapel: <b>{draft.mapel || '-'}</b>
														</p>
														<p className='text-xs text-gray-600 line-clamp-2'>
															Materi: {draft.materi || '(Belum ada catatan materi)'}
														</p>
														<div className='pt-1'>
															{slotIsFree ? (
																<span className='text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 border border-emerald-400'>
																	✓ Siap Diaktifkan ke Rekap Bisaroh
																</span>
															) : (
																<span className='text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300'>
																	⏳ Belum Masuk Rekap Bisaroh
																</span>
															)}
														</div>
													</div>
												</div>

												{/* Panel Aksi Resolusi */}
												<div className='flex flex-wrap items-center justify-between gap-3 pt-3 border-t-[2px] border-dashed border-[#0D0D0D]'>
													<div className='text-xs text-gray-700 font-bold'>
														{slotIsFree
															? 'Tindakan: Slot sudah aman & bebas!'
															: 'Pilih tindakan penyelesaian:'}
													</div>
													<div className='flex flex-wrap items-center gap-2'>
														{slotIsFree ? (
															<>
																<button
																	onClick={() => handleApproveFreedDraft(draft.id, draft.mapel)}
																	className='flex items-center gap-1.5 px-5 py-2.5 bg-[#00E599] text-[#0D0D0D] font-black text-xs uppercase tracking-wider border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer'
																>
																	<Check className='w-4 h-4' />
																	Sahkan Jurnal Sekarang
																</button>
																<button
																	onClick={() => handleOpenResolve(item)}
																	className='flex items-center gap-1 px-3 py-2 bg-white text-[#0D0D0D] font-black text-xs uppercase border-[2px] border-[#0D0D0D] hover:bg-gray-100 cursor-pointer'
																>
																	<Scissors className='w-3.5 h-3.5' />
																	Atur Manual
																</button>
																<button
																	onClick={() => handleExecuteResolve('reject_draft', item)}
																	className='flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 font-black text-xs uppercase tracking-wider border-[2px] border-[#0D0D0D] hover:bg-gray-300 cursor-pointer'
																>
																	<X className='w-3.5 h-3.5' />
																	Tolak Draft
																</button>
															</>
														) : (
															<>
																<button
																	onClick={() => handleOpenResolve(item)}
																	className='flex items-center gap-1.5 px-4 py-2 bg-[#F5C518] text-[#0D0D0D] font-black text-xs uppercase tracking-wider border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all cursor-pointer'
																>
																	<Scissors className='w-4 h-4' />
																	Atur Jam & Sahkan
																</button>

																{conflictWith && (
																	<button
																		onClick={() =>
																			handleExecuteResolve('delete_conflict_and_approve', item)
																		}
																		className='flex items-center gap-1 px-3 py-2 bg-rose-100 text-[#E8451A] font-black text-xs uppercase tracking-wider border-[2px] border-[#0D0D0D] hover:bg-rose-200 cursor-pointer'
																		title='Gunakan jika Jurnal 1 adalah salah input/duplikat'
																	>
																		<Trash2 className='w-3.5 h-3.5' />
																		Hapus Jurnal 1 & Sahkan
																	</button>
																)}

																<button
																	onClick={() => handleExecuteResolve('reject_draft', item)}
																	className='flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 font-black text-xs uppercase tracking-wider border-[2px] border-[#0D0D0D] hover:bg-gray-300 cursor-pointer'
																>
																	<X className='w-3.5 h-3.5' />
																	Tolak Draft
																</button>
															</>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* =================================================================== */}
			{/* TAB 2: TIMELINE SLOT KBM HARIAN */}
			{/* =================================================================== */}
			{activeTab === 'timeline' && (
				<div className='space-y-6'>
					{/* Filter Tanggal */}
					<div className='p-4 border-[3px] border-[#0D0D0D] bg-white shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-wrap items-center justify-between gap-3'>
						<div className='flex items-center gap-3'>
							<label className='text-xs font-black uppercase text-[#0D0D0D]'>Tanggal KBM:</label>
							<input
								type='date'
								value={filterTanggal}
								onChange={(e) => setFilterTanggal(e.target.value)}
								className='px-3 py-2 border-[2px] border-[#0D0D0D] font-bold text-xs bg-[#FFFDF8] outline-none shadow-[2px_2px_0px_0px_#0D0D0D]'
							/>
						</div>
						<div className='flex items-center gap-3 text-xs font-bold'>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-[#00E599] border border-black inline-block'></span> Terisi Normal
							</span>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-[#E8451A] border border-black inline-block'></span> Bentrok Jam
							</span>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-amber-300 border border-black inline-block'></span> Draft Antrean
							</span>
							<span className='flex items-center gap-1'>
								<span className='w-3 h-3 bg-gray-100 border border-black inline-block'></span> Kosong
							</span>
						</div>
					</div>

					{/* Tabel Matriks Jam */}
					<div className='border-[4px] border-[#0D0D0D] bg-white shadow-[6px_6px_0px_0px_#0D0D0D] overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[800px]'>
							<thead>
								<tr className='bg-[#0D0D0D] text-white text-xs uppercase font-black'>
									<th className='p-3 border-r border-gray-700 w-28'>Kelas</th>
									{JP_SLOTS.map((slot) => (
										<th key={slot} className='p-3 text-center border-r border-gray-700'>
											JP {slot}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{timelineData.map((row) => (
									<tr key={row.kelas} className='border-b border-gray-300 hover:bg-yellow-50'>
										<td className='p-3 font-black text-sm bg-gray-50 border-r-[2px] border-[#0D0D0D]'>
											{row.kelas}
										</td>
										{JP_SLOTS.map((slot) => {
											const listInSlot = row.slots[slot] || [];
											const isConflict = listInSlot.length > 1;
											const single = listInSlot[0];
											const isDraft = single?.status_verifikasi === 'draft_bentrok';

											return (
												<td
													key={slot}
													className={`p-2 border-r border-gray-200 text-center align-top min-w-[100px] ${
														isConflict
															? 'bg-rose-100'
															: isDraft
															? 'bg-amber-100'
															: listInSlot.length === 1
															? 'bg-emerald-50'
															: 'bg-white'
													}`}
												>
													{isConflict ? (
														<div
															onClick={() => setActiveTab('radar')}
															className='p-1.5 bg-[#E8451A] text-white border border-[#0D0D0D] text-[10px] font-black uppercase cursor-pointer hover:scale-105 transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'
														>
															⚠️ Bentrok ({listInSlot.length})
															<div className='text-[9px] font-normal truncate mt-0.5'>
																Klik untuk selesai
															</div>
														</div>
													) : listInSlot.length === 1 ? (
														<div
															onClick={() => handleOpenEdit(single)}
															className={`p-1.5 border border-[#0D0D0D] text-[10px] font-bold text-left cursor-pointer hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D] ${
																isDraft ? 'bg-amber-200' : 'bg-emerald-200'
															}`}
														>
															<div className='font-black truncate text-[#0D0D0D]'>
																{single.mapel}
															</div>
															<div className='text-[9px] text-gray-700 truncate'>
																{single.users?.nama_lengkap || 'Guru'}
															</div>
															<div className='text-[9px] font-black text-gray-600 mt-0.5'>
																Jam {single.jam_ke}
															</div>
														</div>
													) : (
														<span className='text-gray-300 text-xs font-bold'>-</span>
													)}
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* TAB 3: SEMUA JURNAL KBM (SUPERVISI & EDIT LANGSUNG) */}
			{/* =================================================================== */}
			{activeTab === 'semua' && (
				<div className='space-y-4'>
					{/* Filter Bar */}
					<div className='border-[3px] border-[#0D0D0D] bg-white p-4 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Cari</label>
								<div className='relative'>
									<Search className='w-4 h-4 absolute left-3 top-2.5 text-gray-500' />
									<input
										type='text'
										placeholder='Guru, Mapel, Materi...'
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className='w-full pl-9 pr-3 py-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none bg-[#FFFDF8]'
									/>
								</div>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Kelas</label>
								<select
									value={filterKelas}
									onChange={(e) => setFilterKelas(e.target.value)}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none bg-[#FFFDF8]'
								>
									<option value='all'>Semua Kelas</option>
									{kelasList.map((k) => (
										<option key={k.id} value={k.nama_kelas}>
											{k.nama_kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Guru</label>
								<select
									value={filterGuru}
									onChange={(e) => setFilterGuru(e.target.value)}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none bg-[#FFFDF8]'
								>
									<option value='all'>Semua Guru</option>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Tanggal</label>
								<input
									type='date'
									value={filterTanggal}
									onChange={(e) => setFilterTanggal(e.target.value)}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none bg-[#FFFDF8]'
								/>
							</div>

							<div>
								<label className='block text-[11px] font-black uppercase text-gray-700 mb-1'>Status</label>
								<select
									value={filterStatus}
									onChange={(e) => setFilterStatus(e.target.value)}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] text-xs font-bold outline-none bg-[#FFFDF8]'
								>
									<option value='all'>Semua Status</option>
									<option value='draft'>Hanya Draft Antrean</option>
									<option value='disetujui'>Hanya Disetujui</option>
									<option value='mandiri'>🟢 Disahkan Mandiri / Bebas</option>
								</select>
							</div>
						</div>
					</div>

					{/* Tabel Data Jurnal */}
					<div className='border-[4px] border-[#0D0D0D] bg-white shadow-[6px_6px_0px_0px_#0D0D0D] overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[900px]'>
							<thead>
								<tr className='bg-[#0D0D0D] text-white text-xs uppercase font-black'>
									<th className='p-3 w-12 text-center'>No</th>
									<th className='p-3 w-32'>Tanggal & Jam</th>
									<th className='p-3 w-28'>Kelas / Mapel</th>
									<th className='p-3'>Guru Pengajar</th>
									<th className='p-3'>Materi & Kegiatan</th>
									<th className='p-3 w-36'>Status KBM</th>
									<th className='p-3 w-36 text-center'>Aksi Admin</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-200 text-xs'>
								{filteredJournals.length === 0 ? (
									<tr>
										<td colSpan={7} className='p-8 text-center text-gray-500 font-bold'>
											Tidak ada data jurnal yang cocok dengan filter.
										</td>
									</tr>
								) : (
									filteredJournals.map((j, idx) => {
										const isDraft =
											j.status_verifikasi === 'draft_bentrok' ||
											j.status_kehadiran === 'Draft Bentrok';
										const badge = getKBMStatusBadge(j.status_kehadiran);

										return (
											<tr
												key={j.id}
												className={`hover:bg-yellow-50 ${isDraft ? 'bg-amber-50' : ''}`}
											>
												<td className='p-3 text-center font-bold text-gray-500'>{idx + 1}</td>
												<td className='p-3'>
													<div className='font-black text-[#0D0D0D]'>{j.tanggal}</div>
													<div className='font-bold text-[#E8451A] mt-0.5'>
														Jam ke-{j.jam_ke}
													</div>
												</td>
												<td className='p-3'>
													<div className='font-black text-[#0D0D0D]'>{j.kelas}</div>
													<div className='text-gray-600 font-medium'>{j.mapel}</div>
												</td>
												<td className='p-3'>
													<div className='font-bold text-[#0D0D0D]'>
														{j.users?.nama_lengkap || 'Guru'}
													</div>
													{j.catatan_admin && (
														<div className='text-[10px] text-gray-500 italic mt-0.5 line-clamp-1'>
															📝 {j.catatan_admin}
														</div>
													)}
												</td>
												<td className='p-3'>
													<div className='font-bold text-gray-900 line-clamp-1'>
														{j.materi || '-'}
													</div>
													<div className='text-[11px] text-gray-500 line-clamp-1'>
														{j.kegiatan || '-'}
													</div>
												</td>
												<td className='p-3'>
													<div className='flex flex-col gap-1'>
														<span
															className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-black uppercase ${badge.bg} ${badge.text} ${badge.border}`}
														>
															<span>{badge.icon}</span> {badge.label}
														</span>
														{j.catatan_admin && (String(j.catatan_admin).toLowerCase().includes('mandiri') || String(j.catatan_admin).toLowerCase().includes('dibebaskan')) && (
															<span
																className='inline-flex items-center gap-1 px-2 py-0.5 border border-[#00E599] bg-emerald-100 text-emerald-950 text-[10px] font-black uppercase'
																title={j.catatan_admin}
															>
																<span>🟢</span> Selesai Mandiri
															</span>
														)}
													</div>
												</td>
												<td className='p-3 text-center'>
													<div className='flex items-center justify-center gap-1'>
														<button
															onClick={() => handleOpenEdit(j)}
															className='p-1.5 bg-yellow-300 border-[2px] border-[#0D0D0D] hover:bg-yellow-400 text-[#0D0D0D]'
															title='Edit Langsung'
														>
															<Edit className='w-3.5 h-3.5' />
														</button>

														<button
															onClick={() => handleQuickTrim(j)}
															className='p-1.5 bg-emerald-300 border-[2px] border-[#0D0D0D] hover:bg-emerald-400 text-[#0D0D0D]'
															title='Pangkas Jam Cepat'
														>
															<Scissors className='w-3.5 h-3.5' />
														</button>

														<button
															onClick={() => handleDeleteJournal(j)}
															className='p-1.5 bg-rose-300 border-[2px] border-[#0D0D0D] hover:bg-rose-400 text-[#0D0D0D]'
															title='Hapus Jurnal'
														>
															<Trash2 className='w-3.5 h-3.5' />
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
			)}

			{/* =================================================================== */}
			{/* MODAL: RESOLUSI BENTROK JAM (1-KLIK ADJUST & APPROVE) */}
			{/* =================================================================== */}
			{selectedConflict && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
					<div className='w-full max-w-xl bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 space-y-5 animate-in fade-in duration-200'>
						<div className='flex items-center justify-between border-b-[3px] border-[#0D0D0D] pb-3'>
							<div className='flex items-center gap-2'>
								<div className='p-1.5 bg-[#00E599] border-[2px] border-[#0D0D0D]'>
									<Scissors className='w-5 h-5 text-[#0D0D0D]' />
								</div>
								<h3 className='text-lg font-black uppercase text-[#0D0D0D]'>
									Resolusi & Penyesuaian Jam Mengajar
								</h3>
							</div>
							<button
								onClick={() => setSelectedConflict(null)}
								className='p-1 bg-gray-100 border-[2px] border-[#0D0D0D] hover:bg-red-400 cursor-pointer'
							>
								<X className='w-5 h-5 text-[#0D0D0D]' />
							</button>
						</div>

						<p className='text-xs text-gray-700 font-bold'>
							Sesuaikan jam mengajar Guru A dan sahkan jurnal Guru B. Kedua KBM akan resmi terdata dan berhak atas Bisaroh tanpa bentrok.
						</p>

						<div className='space-y-4 text-xs font-bold'>
							{/* Form Guru A */}
							<div className='p-3.5 bg-red-50 border-[2px] border-[#0D0D0D] space-y-2'>
								<div className='flex items-center justify-between'>
									<span className='font-black uppercase text-[#E8451A]'>
										Guru 1: {selectedConflict.conflictWith?.users?.nama_lengkap || 'Guru Lawan'}
									</span>
									<span className='text-[11px] text-gray-600'>
										Mapel: {selectedConflict.conflictWith?.mapel}
									</span>
								</div>
								<div className='grid grid-cols-2 gap-3 pt-1'>
									<div>
										<label className='block font-black text-[11px] text-gray-700 mb-1'>
											Ubah Jam Ke:
										</label>
										<input
											type='text'
											value={resolveForm.guru_a_jam}
											onChange={(e) =>
												setResolveForm({ ...resolveForm, guru_a_jam: e.target.value })
											}
											placeholder='Contoh: 3-4 atau 1-2'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-black text-xs outline-none'
										/>
									</div>
									<div>
										<label className='block font-black text-[11px] text-gray-700 mb-1'>
											Ubah Kelas (Jika Salah):
										</label>
										<select
											value={resolveForm.guru_a_kelas}
											onChange={(e) =>
												setResolveForm({ ...resolveForm, guru_a_kelas: e.target.value })
											}
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-black text-xs outline-none'
										>
											{kelasList.map((k) => (
												<option key={k.id} value={k.nama_kelas}>
													{k.nama_kelas}
												</option>
											))}
										</select>
									</div>
								</div>
							</div>

							{/* Form Guru B */}
							<div className='p-3.5 bg-emerald-50 border-[2px] border-[#0D0D0D] space-y-2'>
								<div className='flex items-center justify-between'>
									<span className='font-black uppercase text-[#007A6C]'>
										Guru 2 (Draft): {selectedConflict.draft?.users?.nama_lengkap}
									</span>
									<span className='text-[11px] text-gray-600'>
										Mapel: {selectedConflict.draft?.mapel}
									</span>
								</div>
								<div>
									<label className='block font-black text-[11px] text-gray-700 mb-1'>
										Jam yang Disahkan:
									</label>
									<input
										type='text'
										value={resolveForm.guru_b_jam}
										onChange={(e) =>
											setResolveForm({ ...resolveForm, guru_b_jam: e.target.value })
										}
										className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-black text-xs outline-none'
									/>
								</div>
							</div>

							{/* Opsi Sinkronisasi Absensi */}
							<div className='flex items-center gap-2 p-2 bg-gray-50 border border-gray-300'>
								<input
									type='checkbox'
									id='sync_absensi_cb'
									checked={resolveForm.sync_absensi}
									onChange={(e) =>
										setResolveForm({ ...resolveForm, sync_absensi: e.target.checked })
									}
									className='w-4 h-4 cursor-pointer'
								/>
								<label htmlFor='sync_absensi_cb' className='text-xs font-bold text-gray-800 cursor-pointer'>
									Ikut perbarui sesi presensi siswa (absensi_mapel) jika jam berubah
								</label>
							</div>
						</div>

						<div className='flex items-center justify-end gap-3 pt-3 border-t-[2px] border-[#0D0D0D]'>
							<button
								onClick={() => setSelectedConflict(null)}
								className='px-4 py-2.5 bg-gray-200 border-[2px] border-[#0D0D0D] font-black text-xs uppercase cursor-pointer hover:bg-gray-300'
							>
								Batal
							</button>
							<button
								disabled={resolving}
								onClick={() => handleExecuteResolve('adjust_and_approve')}
								className='flex items-center gap-2 px-5 py-2.5 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all cursor-pointer'
							>
								{resolving ? 'Memproses...' : 'Simpan & Sahkan Kedua Jurnal'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL: EDIT LANGSUNG JURNAL OLEH ADMIN */}
			{/* =================================================================== */}
			{editModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
					<div className='w-full max-w-2xl bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in duration-200'>
						<div className='flex items-center justify-between border-b-[3px] border-[#0D0D0D] pb-3'>
							<div className='flex items-center gap-2'>
								<div className='p-1.5 bg-[#F5C518] border-[2px] border-[#0D0D0D]'>
									<Edit className='w-5 h-5 text-[#0D0D0D]' />
								</div>
								<h3 className='text-lg font-black uppercase text-[#0D0D0D]'>
									Edit Mandiri Jurnal KBM
								</h3>
							</div>
							<button
								onClick={() => setEditModalOpen(false)}
								className='p-1 bg-gray-100 border-[2px] border-[#0D0D0D] hover:bg-red-400 cursor-pointer'
							>
								<X className='w-5 h-5 text-[#0D0D0D]' />
							</button>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold'>
							<div>
								<label className='block text-gray-700 mb-1'>Guru Pengajar</label>
								<select
									value={editForm.guru_id}
									onChange={(e) => setEditForm({ ...editForm, guru_id: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								>
									{guruList.map((g) => (
										<option key={g.id_user} value={g.id_user}>
											{g.nama_lengkap}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-gray-700 mb-1'>Kelas</label>
								<select
									value={editForm.kelas}
									onChange={(e) => setEditForm({ ...editForm, kelas: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								>
									{kelasList.map((k) => (
										<option key={k.id} value={k.nama_kelas}>
											{k.nama_kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-gray-700 mb-1'>Mata Pelajaran</label>
								<select
									value={editForm.mapel}
									onChange={(e) => setEditForm({ ...editForm, mapel: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								>
									{mapelList.map((m) => (
										<option key={m.id} value={m.mapel}>
											{m.mapel}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-gray-700 mb-1'>Tanggal KBM</label>
								<input
									type='date'
									value={editForm.tanggal}
									onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								/>
							</div>

							<div>
								<label className='block text-gray-700 mb-1'>Jam Ke (Contoh: 1-2, 3-4)</label>
								<input
									type='text'
									value={editForm.jam_ke}
									onChange={(e) => setEditForm({ ...editForm, jam_ke: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-black outline-none'
								/>
							</div>

							<div>
								<label className='block text-gray-700 mb-1'>Status Verifikasi</label>
								<select
									value={editForm.status_verifikasi}
									onChange={(e) =>
										setEditForm({
											...editForm,
											status_verifikasi: e.target.value,
											status_kehadiran:
												e.target.value === 'disetujui'
													? 'Normal'
													: 'Draft Bentrok',
										})
									}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								>
									<option value='disetujui'>Disetujui (Resmi)</option>
									<option value='draft_bentrok'>Draft Antrean Bentrok</option>
									<option value='ditolak'>Ditolak</option>
								</select>
							</div>

							<div className='sm:col-span-2'>
								<label className='block text-gray-700 mb-1'>Materi Pembelajaran</label>
								<input
									type='text'
									value={editForm.materi}
									onChange={(e) => setEditForm({ ...editForm, materi: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								/>
							</div>

							<div className='sm:col-span-2'>
								<label className='block text-gray-700 mb-1'>Kegiatan Pembelajaran</label>
								<textarea
									rows={2}
									value={editForm.kegiatan}
									onChange={(e) => setEditForm({ ...editForm, kegiatan: e.target.value })}
									className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
								/>
							</div>

							<div className='sm:col-span-2 flex flex-col gap-2 p-2 bg-gray-50 border border-gray-300'>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={editForm.sync_absensi}
										onChange={(e) =>
											setEditForm({ ...editForm, sync_absensi: e.target.checked })
										}
										className='w-4 h-4 cursor-pointer'
									/>
									<span>Ikut perbarui sesi presensi siswa (absensi_mapel) jika jam berubah</span>
								</label>
								<label className='flex items-center gap-2 cursor-pointer text-[#E8451A]'>
									<input
										type='checkbox'
										checked={editForm.override_conflict}
										onChange={(e) =>
											setEditForm({ ...editForm, override_conflict: e.target.checked })
										}
										className='w-4 h-4 cursor-pointer'
									/>
									<span>Bypass Konflik (Izinkan KBM bersama / Team Teaching)</span>
								</label>
							</div>
						</div>

						<div className='flex items-center justify-end gap-3 pt-3 border-t-[2px] border-[#0D0D0D]'>
							<button
								onClick={() => setEditModalOpen(false)}
								className='px-4 py-2.5 bg-gray-200 border-[2px] border-[#0D0D0D] font-black text-xs uppercase cursor-pointer hover:bg-gray-300'
							>
								Batal
							</button>
							<button
								disabled={savingEdit}
								onClick={handleSaveEdit}
								className='flex items-center gap-2 px-5 py-2.5 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all cursor-pointer'
							>
								{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
							</button>
						</div>
					</div>
				</div>
			)}
			{/* =================================================================== */}
			{/* MODAL: PENGATURAN NOMOR WHATSAPP ADUAN KBM */}
			{/* =================================================================== */}
			{waModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
					<div className='w-full max-w-md bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 space-y-4 animate-in fade-in duration-200'>
						<div className='flex items-center justify-between border-b-[3px] border-[#0D0D0D] pb-3'>
							<div className='flex items-center gap-2'>
								<div className='p-1.5 bg-[#25D366] border-[2px] border-[#0D0D0D] text-[#0D0D0D]'>
									<span className='text-base'>📱</span>
								</div>
								<h3 className='text-base sm:text-lg font-black uppercase text-[#0D0D0D]'>
									Atur WhatsApp Aduan KBM
								</h3>
							</div>
							<button
								onClick={() => setWaModalOpen(false)}
								className='p-1 bg-gray-100 border-[2px] border-[#0D0D0D] hover:bg-red-400 cursor-pointer'
							>
								<X className='w-5 h-5 text-[#0D0D0D]' />
							</button>
						</div>

						<div className='p-3 bg-amber-50 border-[2px] border-[#0D0D0D] text-xs space-y-1'>
							<p className='font-bold text-[#0D0D0D]'>💡 Alur Otomatis WhatsApp:</p>
							<p className='text-gray-700 leading-relaxed'>
								Nomor ini akan otomatis dituju saat guru mengklik tombol <b>Simpan Antrean &amp; Lapor WA</b> pada formulir KBM yang bertabrakan.
							</p>
						</div>

						<div className='space-y-3 text-xs font-bold'>
							<div>
								<label className='block text-gray-800 mb-1 uppercase tracking-wider'>
									Nomor WhatsApp Penerima (Admin / Piket)
								</label>
								<input
									type='text'
									placeholder='Contoh: 082131028161'
									value={waNumberInput}
									onChange={(e) => setWaNumberInput(e.target.value)}
									className='w-full px-3 py-2.5 border-[3px] border-[#0D0D0D] bg-white font-black text-sm outline-none shadow-[2px_2px_0px_0px_#0D0D0D] focus:bg-yellow-50'
								/>
								<p className='text-[10px] text-gray-500 font-normal mt-1'>
									Dapat diawali dengan 08... atau 628... Sistem akan otomatis menyesuaikan link WA.
								</p>
							</div>

							<div>
								<label className='block text-gray-800 mb-1 uppercase tracking-wider'>
									Nama Kontak / Jabatan (Opsional)
								</label>
								<input
									type='text'
									placeholder='Contoh: Admin Kurikulum / Guru Piket'
									value={waNameInput}
									onChange={(e) => setWaNameInput(e.target.value)}
									className='w-full px-3 py-2.5 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none'
								/>
							</div>

							{waNumberInput && (
								<div className='p-2.5 bg-gray-50 border border-gray-300 text-[11px]'>
									<span className='font-bold text-gray-600 block mb-1'>Uji Coba Tautan:</span>
									<a
										href={`https://wa.me/${waNumberInput.replace(/^0/, '62').replace(/\D/g, '')}?text=${encodeURIComponent('Halo Admin, ini tes tautan WhatsApp aduan KBM.')}`}
										target='_blank'
										rel='noopener noreferrer'
										className='inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline'
									>
										<span>🔗 Tes Buka Chat WhatsApp ({waNumberInput.replace(/^0/, '62').replace(/\D/g, '')})</span>
										<ExternalLink className='w-3 h-3' />
									</a>
								</div>
							)}
						</div>

						<div className='flex items-center justify-end gap-3 pt-3 border-t-[2px] border-[#0D0D0D]'>
							<button
								type='button'
								onClick={() => setWaModalOpen(false)}
								className='px-4 py-2.5 bg-gray-200 border-[2px] border-[#0D0D0D] font-black text-xs uppercase cursor-pointer hover:bg-gray-300'
							>
								Batal
							</button>
							<button
								type='button'
								disabled={savingWa}
								onClick={handleSaveWaNumber}
								className='flex items-center gap-2 px-5 py-2.5 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all cursor-pointer'
							>
								{savingWa ? 'Menyimpan...' : 'Simpan Nomor WA'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* =================================================================== */}
			{/* MODAL: INPUT JURNAL GURU OLEH ADMIN (KENDALA TEKNIS: HP MATI, DLL) */}
			{/* =================================================================== */}
			{createModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4'>
					<div className='w-full max-w-3xl bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in duration-200'>
						{/* Modal Header */}
						<div className='flex items-center justify-between border-b-[3px] border-[#0D0D0D] pb-3'>
							<div className='flex items-center gap-2.5'>
								<div className='p-2 bg-[#00E599] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<UserCheck className='w-5 h-5 text-[#0D0D0D]' />
								</div>
								<div>
									<h3 className='text-base sm:text-lg font-black uppercase text-[#0D0D0D] tracking-tight'>
										Input Jurnal Guru (Bantuan Kendala Teknis)
									</h3>
									<p className='text-xs text-gray-600 font-semibold'>
										Bantu inputkan jurnal KBM guru yang terkendala HP mati, sinyal putus, atau kendala perangkat.
									</p>
								</div>
							</div>
							<button
								onClick={() => setCreateModalOpen(false)}
								className='p-1.5 bg-gray-100 border-[2px] border-[#0D0D0D] hover:bg-red-400 hover:text-white cursor-pointer transition-colors'
							>
								<X className='w-5 h-5 text-[#0D0D0D]' />
							</button>
						</div>

						{/* Notice / Audit Info */}
						<div className='p-3 bg-amber-50 border-[2px] border-[#0D0D0D] flex items-start gap-2.5 shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<LifeBuoy className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
							<div className='text-xs space-y-0.5'>
								<p className='font-black text-[#0D0D0D] uppercase tracking-wide'>
									Mode Bantuan Admin &amp; Kurikulum
								</p>
								<p className='text-gray-700 leading-relaxed font-medium'>
									Jurnal yang diinputkan di sini akan <b>otomatis disahkan (disetujui)</b> dan hak jam mengajar/Bisaroh guru langsung aktif. Sistem akan mencantumkan log audit resmi bahwa data diinputkan oleh Admin karena kendala teknis.
								</p>
							</div>
						</div>

						{/* Form Content */}
						<div className='space-y-4 text-xs font-bold'>
							{/* SECTION 1: IDENTITAS GURU, KELAS, MAPEL & TANGGAL */}
							<div className='p-3.5 bg-gray-50 border-[2px] border-[#0D0D0D] space-y-3'>
								<div className='flex items-center gap-2 border-b border-gray-300 pb-1.5'>
									<BookOpen className='w-4 h-4 text-[#0D0D0D]' />
									<span className='uppercase tracking-wider font-black text-[#0D0D0D] text-[11px]'>
										1. Identitas Guru &amp; Jadwal KBM
									</span>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									{/* Pilih Guru */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Guru Pengajar <span className='text-red-500'>*</span>
										</label>
										<select
											value={createForm.guru_id}
											onChange={(e) => handleGuruChange(e.target.value)}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-black text-xs outline-none focus:bg-yellow-50 shadow-[1px_1px_0px_0px_#0D0D0D]'
										>
											<option value=''>-- Pilih Guru Pengajar --</option>
											{guruList.map((g) => (
												<option key={g.id_user} value={g.id_user}>
													{g.nama_lengkap} {g.username ? `(@${g.username})` : ''}
												</option>
											))}
										</select>
									</div>

									{/* Tanggal KBM */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Tanggal Pelaksanaan KBM <span className='text-red-500'>*</span>
										</label>
										<input
											type='date'
											value={createForm.tanggal}
											onChange={(e) => {
												const tgl = e.target.value;
												setCreateForm((prev) => {
													const sched = getExpectedScheduleTimes(prev.jam_ke, tgl);
													return {
														...prev,
														tanggal: tgl,
														jam_mulai: sched?.start || prev.jam_mulai,
														jam_selesai: sched?.end || prev.jam_selesai,
														durasi_menit: sched ? calculateDurationMinutes(sched.start, sched.end) : prev.durasi_menit,
													};
												});
											}}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										/>
									</div>

									{/* Banner Tautan Penugasan Guru */}
									<div className='sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-yellow-50 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<div className='flex items-center gap-2'>
											{currentGuruAssignments.length > 0 ? (
												<Link2 className='w-4 h-4 text-emerald-700 shrink-0' />
											) : (
												<Unlink className='w-4 h-4 text-gray-500 shrink-0' />
											)}
											<span className='text-[11px] font-bold text-gray-800'>
												{currentGuruAssignments.length > 0 ? (
													<>
														Ditemukan <b className='text-emerald-800'>{currentGuruAssignments.length} penugasan KBM</b> untuk guru ini.
													</>
												) : (
													'Guru ini belum memiliki penugasan KBM resmi di database (menampilkan seluruh kelas & mapel).'
												)}
											</span>
										</div>
										{currentGuruAssignments.length > 0 && (
											<button
												type='button'
												onClick={() => setFilterByTeacherAssignments((prev) => !prev)}
												className={`px-2.5 py-1 text-[10px] font-black uppercase border-[2px] border-[#0D0D0D] cursor-pointer transition-all ${
													filterByTeacherAssignments
														? 'bg-[#00E599] text-[#0D0D0D] shadow-[1px_1px_0px_0px_#0D0D0D]'
														: 'bg-white text-gray-700 hover:bg-gray-100'
												}`}
												title='Klik untuk beralih antara hanya kelas/mapel yang diampu guru atau seluruh kelas/mapel'
											>
												{filterByTeacherAssignments ? '✓ Ditautkan ke Jadwal Guru' : 'Tampilkan Semua Kelas & Mapel'}
											</button>
										)}
									</div>

									{/* Pilih Kelas */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Kelas <span className='text-red-500'>*</span>
											{filterByTeacherAssignments && currentGuruAssignments.length > 0 && (
												<span className='text-[10px] text-emerald-700 font-bold ml-1'>(Sesuai Guru)</span>
											)}
										</label>
										<select
											value={createForm.kelas}
											onChange={(e) => handleKelasChange(e.target.value)}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										>
											<option value=''>-- Pilih Kelas --</option>
											{availableKelasOptions.map((k) => (
												<option key={k.nama_kelas} value={k.nama_kelas}>
													{k.nama_kelas} {k.isAssigned && !filterByTeacherAssignments ? '★ (Diampu)' : ''}
												</option>
											))}
										</select>
									</div>

									{/* Pilih Mapel */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Mata Pelajaran <span className='text-red-500'>*</span>
											{filterByTeacherAssignments && currentGuruAssignments.length > 0 && (
												<span className='text-[10px] text-emerald-700 font-bold ml-1'>(Sesuai Guru)</span>
											)}
										</label>
										<select
											value={createForm.mapel}
											onChange={(e) => {
												const m = e.target.value;
												const p = getSuggestedPertemuanKe(createForm.kelas, m);
												setCreateForm((prev) => ({ ...prev, mapel: m, pertemuan_ke: p }));
											}}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										>
											<option value=''>-- Pilih Mata Pelajaran --</option>
											{availableMapelOptions.map((m) => (
												<option key={m.mapel} value={m.mapel}>
													{m.mapel} {m.isAssigned && !filterByTeacherAssignments ? '★ (Diampu)' : ''}
												</option>
											))}
										</select>
									</div>

									{/* Jam Ke (JP) */}
									<div className='sm:col-span-2'>
										<div className='flex items-center justify-between mb-1'>
											<label className='text-gray-800'>
												Jam Ke (JP) <span className='text-red-500'>*</span>
											</label>
											<span className='text-[10px] text-gray-500 font-normal'>
												Klik preset atau ketik manual (contoh: 1-2, 3-4, 5)
											</span>
										</div>
										<div className='flex flex-wrap items-center gap-1.5 mb-1.5'>
											{PRESET_JAM_PELAJARAN.map((preset) => (
												<button
													key={preset}
													type='button'
													onClick={() => handleCreateJamKeChange(preset)}
													className={`px-2.5 py-1 text-[11px] font-black border-[2px] border-[#0D0D0D] cursor-pointer transition-all ${
														createForm.jam_ke === preset
															? 'bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -translate-y-0.5'
															: 'bg-white text-gray-700 hover:bg-gray-100'
													}`}
												>
													JP {preset}
												</button>
											))}
										</div>
										<input
											type='text'
											placeholder='Contoh: 1-2 atau 3-4'
											value={createForm.jam_ke}
											onChange={(e) => handleCreateJamKeChange(e.target.value)}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-black text-sm outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										/>
									</div>

									{/* Pertemuan Ke */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Pertemuan Ke (Opsional)
										</label>
										<div className='flex items-center gap-2'>
											<input
												type='text'
												placeholder='1, 2, dst.'
												value={createForm.pertemuan_ke}
												onChange={(e) => setCreateForm({ ...createForm, pertemuan_ke: e.target.value })}
												className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none'
											/>
											<button
												type='button'
												onClick={() => {
													const p = getSuggestedPertemuanKe(createForm.kelas, createForm.mapel);
													setCreateForm((prev) => ({ ...prev, pertemuan_ke: p }));
												}}
												className='px-2.5 py-2 bg-gray-200 border border-[#0D0D0D] text-[10px] font-black uppercase hover:bg-gray-300 shrink-0 cursor-pointer'
												title='Hitung ulang dari riwayat KBM kelas & mapel ini'
											>
												Hitung
											</button>
										</div>
									</div>

									{/* Status Kehadiran KBM */}
									<div>
										<label className='block text-gray-800 mb-1'>
											Status Kehadiran KBM
										</label>
										<select
											value={createForm.status_kehadiran}
											onChange={(e) => setCreateForm({ ...createForm, status_kehadiran: e.target.value })}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										>
											<option value='Normal'>Normal / Hadir Tepat Waktu</option>
											<option value='Terlambat'>Terlambat</option>
											<option value='Tugas Luar'>Tugas Luar</option>
											<option value='Kegiatan Sekolah'>Kegiatan Sekolah</option>
										</select>
									</div>
								</div>
							</div>

							{/* SECTION 2: PENGATURAN JAM MASUK & SELESAI */}
							<div className='p-3.5 bg-emerald-50/80 border-[2px] border-emerald-500 shadow-[2px_2px_0px_0px_#0D0D0D] space-y-3'>
								<div className='flex flex-wrap items-center justify-between gap-2 border-b border-emerald-300 pb-2'>
									<div className='flex items-center gap-1.5'>
										<Clock className='w-4 h-4 text-emerald-800' />
										<span className='uppercase tracking-wider font-black text-emerald-950 text-[11px]'>
											2. Pengaturan Jam Masuk &amp; Jam Selesai KBM
										</span>
									</div>
									<div className='flex items-center gap-1.5'>
										<button
											type='button'
											onClick={handleFillOfficialSchedule}
											className='flex items-center gap-1 px-2.5 py-1 bg-white border border-[#0D0D0D] text-[10px] font-black uppercase text-[#0D0D0D] hover:bg-emerald-200 cursor-pointer shadow-[1px_1px_0px_0px_#0D0D0D]'
											title='Otomatis mengisi jam masuk & selesai sesuai jadwal resmi sekolah untuk JP yang dipilih'
										>
											<Zap className='w-3 h-3 text-amber-500 fill-amber-500' />
											<span>Jadwal Resmi</span>
										</button>
										<button
											type='button'
											onClick={handleFillCurrentTime}
											className='flex items-center gap-1 px-2.5 py-1 bg-white border border-[#0D0D0D] text-[10px] font-black uppercase text-[#0D0D0D] hover:bg-emerald-200 cursor-pointer shadow-[1px_1px_0px_0px_#0D0D0D]'
											title='Gunakan jam saat ini untuk jam selesai'
										>
											<Clock className='w-3 h-3 text-sky-600' />
											<span>Jam Sekarang</span>
										</button>
									</div>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 items-end'>
									{/* Jam Masuk */}
									<div>
										<label className='block text-emerald-950 mb-1'>
											Jam Masuk / Mulai KBM
										</label>
										<input
											type='time'
											value={createForm.jam_mulai}
											onChange={(e) => handleCreateTimeChange('jam_mulai', e.target.value)}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-black text-sm outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										/>
									</div>

									{/* Jam Selesai */}
									<div>
										<label className='block text-emerald-950 mb-1'>
											Jam Selesai KBM
										</label>
										<input
											type='time'
											value={createForm.jam_selesai}
											onChange={(e) => handleCreateTimeChange('jam_selesai', e.target.value)}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-black text-sm outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
										/>
									</div>

									{/* Durasi Terhitung */}
									<div>
										<label className='block text-emerald-950 mb-1'>
											Durasi Riil KBM
										</label>
										<div className='px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-black text-sm text-[#0D0D0D] flex items-center justify-between shadow-[1px_1px_0px_0px_#0D0D0D]'>
											<span>{formatDurationString(createForm.durasi_menit, false)}</span>
											<span className='px-1.5 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] border border-[#0D0D0D]'>
												{createForm.durasi_menit} mnt
											</span>
										</div>
									</div>
								</div>
								<p className='text-[10px] text-emerald-900 font-medium'>
									💡 <b>Fleksibilitas Penuh</b>: Admin dapat bebas menentukan jam masuk &amp; selesai riil agar durasi mengajar guru tetap tercatat akurat meskipun guru lapor terlambat akibat kendala teknis.
								</p>
							</div>

							{/* SECTION 3: ALASAN KENDALA GURU (AUDIT TRAIL) */}
							<div className='p-3.5 bg-amber-50/80 border-[2px] border-amber-500 shadow-[2px_2px_0px_0px_#0D0D0D] space-y-3'>
								<div className='flex items-center gap-2 border-b border-amber-300 pb-1.5'>
									<AlertCircle className='w-4 h-4 text-amber-700' />
									<span className='uppercase tracking-wider font-black text-amber-950 text-[11px]'>
										3. Jenis Kendala Teknis Guru
									</span>
								</div>

								{/* Pilihan Cepat Kendala */}
								<div>
									<label className='block text-amber-950 mb-1.5'>
										Pilih Jenis Kendala yang Dialami Guru:
									</label>
									<div className='grid grid-cols-2 sm:grid-cols-3 gap-1.5'>
										{KENDALA_PRESETS.map((item) => (
											<button
												key={item.id}
												type='button'
												onClick={() => setCreateForm({ ...createForm, alasan_kendala: item.label })}
												className={`px-2.5 py-1.5 text-left border-[2px] border-[#0D0D0D] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
													createForm.alasan_kendala === item.label
														? 'bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -translate-y-0.5'
														: 'bg-white text-gray-700 hover:bg-yellow-50'
												}`}
											>
												<span>{item.icon}</span>
												<span className='truncate'>{item.label}</span>
											</button>
										))}
									</div>
								</div>

								{/* Catatan Tambahan Kendala */}
								<div>
									<label className='block text-amber-950 mb-1'>
										Detail / Catatan Tambahan Kendala
									</label>
									<input
										type='text'
										placeholder='Contoh: Baterai HP drop saat di kelas 7A, lapor ke ruang kurikulum jam 10:00'
										value={createForm.catatan_kendala}
										onChange={(e) => setCreateForm({ ...createForm, catatan_kendala: e.target.value })}
										className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-medium outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
									/>
									<p className='text-[10px] text-amber-800 font-medium mt-1'>
										Catatan ini akan otomatis disimpan ke rekam jejak audit administrasi KBM guru untuk transparansi supervisi.
									</p>
								</div>
							</div>

							{/* SECTION 4: KONTEN PEMBELAJARAN */}
							<div className='p-3.5 bg-gray-50 border-[2px] border-[#0D0D0D] space-y-3'>
								<div className='flex items-center gap-2 border-b border-gray-300 pb-1.5'>
									<Sparkles className='w-4 h-4 text-[#0D0D0D]' />
									<span className='uppercase tracking-wider font-black text-[#0D0D0D] text-[11px]'>
										4. Materi &amp; Kegiatan Pembelajaran
									</span>
								</div>

								{/* Metode Pembelajaran */}
								<div>
									<label className='block text-gray-800 mb-1.5'>
										Metode Pembelajaran (Bisa pilih lebih dari satu)
									</label>
									<div className='flex flex-wrap gap-1.5'>
										{METODE_OPTIONS.map((m) => {
											const isSelected = (createForm.metode || '')
												.split(',')
												.map((s) => s.trim())
												.includes(m);
											return (
												<button
													key={m}
													type='button'
													onClick={() => handleToggleCreateMetode(m)}
													className={`px-3 py-1 text-xs font-bold border-[2px] border-[#0D0D0D] cursor-pointer transition-all ${
														isSelected
															? 'bg-[#00B2FF] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -translate-y-0.5'
															: 'bg-white text-gray-700 hover:bg-gray-100'
													}`}
												>
													{isSelected ? '✓ ' : ''}{m}
												</button>
											);
										})}
									</div>
								</div>

								{/* Materi */}
								<div>
									<label className='block text-gray-800 mb-1'>
										Materi Pembelajaran <span className='text-red-500'>*</span>
									</label>
									<input
										type='text'
										placeholder='Contoh: Bab 3 - Persamaan Linear Satu Variabel'
										value={createForm.materi}
										onChange={(e) => setCreateForm({ ...createForm, materi: e.target.value })}
										className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white font-bold outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
									/>
								</div>

								{/* Kegiatan */}
								<div>
									<label className='block text-gray-800 mb-1'>
										Kegiatan Pembelajaran (Opsional)
									</label>
									<textarea
										rows={2}
										placeholder='Contoh: Guru menjelaskan konsep dan siswa mengerjakan latihan soal kelompok.'
										value={createForm.kegiatan}
										onChange={(e) => setCreateForm({ ...createForm, kegiatan: e.target.value })}
										className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none shadow-[1px_1px_0px_0px_#0D0D0D]'
									/>
								</div>

								{/* Hambatan & Solusi */}
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									<div>
										<label className='block text-gray-800 mb-1'>Hambatan KBM Siswa (Opsional)</label>
										<input
											type='text'
											placeholder='Contoh: Beberapa siswa belum memahami rumus dasar'
											value={createForm.hambatan}
											onChange={(e) => setCreateForm({ ...createForm, hambatan: e.target.value })}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
										/>
									</div>
									<div>
										<label className='block text-gray-800 mb-1'>Solusi KBM (Opsional)</label>
										<input
											type='text'
											placeholder='Contoh: Diberikan bimbingan tambahan dan tutor sebaya'
											value={createForm.solusi}
											onChange={(e) => setCreateForm({ ...createForm, solusi: e.target.value })}
											className='w-full px-3 py-2 border-[2px] border-[#0D0D0D] bg-white outline-none'
										/>
									</div>
								</div>

								{/* Checkbox Tuntas */}
								<label className='flex items-center gap-2 cursor-pointer pt-1'>
									<input
										type='checkbox'
										checked={createForm.tuntas}
										onChange={(e) => setCreateForm({ ...createForm, tuntas: e.target.checked })}
										className='w-4 h-4 cursor-pointer accent-[#00E599]'
									/>
									<span className='text-xs font-bold text-gray-800'>
										Materi Pembelajaran Tuntas Disampaikan pada Jam Ini
									</span>
								</label>
							</div>

							{/* SECTION 5: OPSI SINKRONISASI & BYPASS */}
							<div className='p-3 bg-gray-100 border border-gray-400 space-y-2 text-xs'>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={createForm.sync_absensi}
										onChange={(e) => setCreateForm({ ...createForm, sync_absensi: e.target.checked })}
										className='w-4 h-4 cursor-pointer accent-[#0D0D0D]'
									/>
									<span className='font-bold text-gray-800'>
										Otomatis tautkan / sinkronkan sesi presensi siswa (<code className='bg-gray-200 px-1 py-0.5 rounded'>absensi_mapel</code>) jika ditemukan
									</span>
								</label>
								<label className='flex items-center gap-2 cursor-pointer text-[#E8451A]'>
									<input
										type='checkbox'
										checked={createForm.override_conflict}
										onChange={(e) => setCreateForm({ ...createForm, override_conflict: e.target.checked })}
										className='w-4 h-4 cursor-pointer accent-[#E8451A]'
									/>
									<span className='font-bold'>
										Bypass Bentrok (Izinkan simpan jika jam bertabrakan karena Team Teaching / Pengganti)
									</span>
								</label>
							</div>
						</div>

						{/* Modal Footer */}
						<div className='flex items-center justify-end gap-3 pt-3 border-t-[3px] border-[#0D0D0D]'>
							<button
								type='button'
								onClick={() => setCreateModalOpen(false)}
								className='px-4 py-2.5 bg-gray-200 border-[2px] border-[#0D0D0D] font-black text-xs uppercase cursor-pointer hover:bg-gray-300'
							>
								Batal
							</button>
							<button
								type='button'
								disabled={savingCreate}
								onClick={handleSaveCreate}
								className='flex items-center gap-2 px-6 py-2.5 bg-[#00E599] text-[#0D0D0D] border-[3px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:opacity-50'
							>
								<Check className='w-4 h-4' />
								<span>{savingCreate ? 'Menyimpan & Mengesahkan...' : 'Simpan & Sahkan Jurnal Guru'}</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
