'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import { useAdminAuth } from '../AdminLayoutClient';
import { normalizeJamKe, checkJamOverlap, parseJamPelajaran } from '@/lib/absensiUtils';
import { getTodayDateString } from '@/lib/dateUtils';
import { getKBMStatusBadge } from '@/lib/kbmRealtimeUtils';
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
} from 'lucide-react';

const JP_SLOTS = [1, 2, 3, 4, 5, 6, 7];

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

	// State Pengaturan WhatsApp Aduan KBM
	const [waModalOpen, setWaModalOpen] = useState(false);
	const [waNumberInput, setWaNumberInput] = useState('');
	const [waNameInput, setWaNameInput] = useState('Admin Kurikulum');
	const [savingWa, setSavingWa] = useState(false);

	// Load Initial Master Data & Conflicts
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			const [resConflicts, resJournals, resKelas, resUsers, resMapel, resWaSetting, resSchoolProfile] = await Promise.all([
				fetch('/api/admin/jurnal?conflict_only=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { conflicts: [] })),
				fetch('/api/admin/jurnal', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/kelas?all=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/users', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/mapel?all=true', { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
				fetch('/api/settings?key=wa_admin_jurnal', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
				fetch('/api/settings?key=profil_sekolah', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
			]);

			setConflicts(resConflicts?.conflicts || []);
			setJournals(Array.isArray(resJournals) ? resJournals : []);
			setKelasList(Array.isArray(resKelas) ? resKelas : []);
			setGuruList(Array.isArray(resUsers) ? resUsers.filter((u) => u.role === 'Guru') : []);
			setMapelList(Array.isArray(resMapel) ? resMapel : []);

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

	// Eksekusi Resolusi Konflik (Pangkas / Geser & Sahkan)
	const handleExecuteResolve = async (actionType = 'adjust_and_approve') => {
		if (!selectedConflict) return;

		try {
			setResolving(true);
			const payload = {
				draft_id: selectedConflict.draft?.id,
				conflict_id: selectedConflict.conflictWith?.id || selectedConflict.draft?.konflik_dengan_id,
				action: actionType,
				guru_a_update: {
					jam_ke: resolveForm.guru_a_jam,
					kelas: resolveForm.guru_a_kelas,
				},
				guru_b_update: {
					jam_ke: resolveForm.guru_b_jam,
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
			status_kehadiran: j.status_kehadiran || 'Normal',
			status_verifikasi: j.status_verifikasi || 'disetujui',
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
						<div className='grid grid-cols-1 gap-6'>
							{conflicts.map((item, idx) => {
								const draft = item.draft;
								const conflictWith = item.conflictWith;
								const draftGuru = draft.users?.nama_lengkap || 'Guru Pengajar';
								const conflictGuru = conflictWith?.users?.nama_lengkap || 'Guru Lain';

								return (
									<div
										key={draft.id || idx}
										className='border-[4px] border-[#0D0D0D] bg-white p-5 sm:p-6 shadow-[6px_6px_0px_0px_#0D0D0D] space-y-4'
									>
										{/* Banner Status */}
										<div className='flex flex-wrap items-center justify-between gap-2 p-3 bg-red-100 border-[2px] border-[#E8451A]'>
											<div className='flex items-center gap-2'>
												<span className='px-2.5 py-1 bg-[#E8451A] text-white font-black text-xs uppercase'>
													⚠️ Konflik Jam Terdeteksi
												</span>
												<span className='font-bold text-xs text-[#0D0D0D]'>
													Kelas <b>{draft.kelas}</b> • Tanggal <b>{draft.tanggal}</b>
												</span>
											</div>
											<span className='text-xs font-black text-gray-600'>
												ID Antrean: #{draft.id.slice(0, 8)}
											</span>
										</div>

										{/* Perbandingan Berdampingan (Kiri: Jurnal Terdata, Kanan: Draft Antrean) */}
										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											{/* Guru A (Terdata di Database) */}
											<div className='p-4 border-[3px] border-[#0D0D0D] bg-[#FFF5F0] space-y-2'>
												<div className='flex items-center justify-between'>
													<span className='text-[11px] font-black uppercase px-2 py-0.5 bg-[#E8451A] text-white border-[2px] border-[#0D0D0D]'>
														1. Jurnal Terbit (Di Database)
													</span>
													<span className='text-xs font-black text-[#E8451A]'>
														Jam ke-{conflictWith?.jam_ke || '-'}
													</span>
												</div>
												<h4 className='text-base font-black text-[#0D0D0D]'>{conflictGuru}</h4>
												<p className='text-xs font-bold text-gray-700'>
													Mapel: <b>{conflictWith?.mapel || '-'}</b>
												</p>
												<p className='text-xs text-gray-600 line-clamp-2'>
													Materi: {conflictWith?.materi || '(Belum ada catatan materi)'}
												</p>
											</div>

											{/* Guru B (Draft Antrean Menunggu) */}
											<div className='p-4 border-[3px] border-[#0D0D0D] bg-[#FFFDF0] space-y-2'>
												<div className='flex items-center justify-between'>
													<span className='text-[11px] font-black uppercase px-2 py-0.5 bg-[#F5C518] text-[#0D0D0D] border-[2px] border-[#0D0D0D]'>
														2. Draft Antrean (Menunggu Sah)
													</span>
													<span className='text-xs font-black text-[#0D0D0D]'>
														Diajukan: Jam ke-{draft.jam_ke}
													</span>
												</div>
												<h4 className='text-base font-black text-[#0D0D0D]'>{draftGuru}</h4>
												<p className='text-xs font-bold text-gray-700'>
													Mapel: <b>{draft.mapel || '-'}</b>
												</p>
												<p className='text-xs text-gray-600 line-clamp-2'>
													Materi: {draft.materi || '(Belum ada catatan materi)'}
												</p>
												<div className='pt-1'>
													<span className='text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300'>
														⏳ Belum Masuk Rekap Bisaroh
													</span>
												</div>
											</div>
										</div>

										{/* Panel Aksi Resolusi Cepat */}
										<div className='flex flex-wrap items-center justify-between gap-3 pt-3 border-t-[2px] border-dashed border-[#0D0D0D]'>
											<div className='text-xs text-gray-700 font-bold'>
												Pilih tindakan penyelesaian:
											</div>
											<div className='flex flex-wrap items-center gap-2'>
												<button
													onClick={() => handleOpenResolve(item)}
													className='flex items-center gap-1.5 px-4 py-2 bg-[#00E599] text-[#0D0D0D] font-black text-xs uppercase tracking-wider border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all cursor-pointer'
												>
													<Scissors className='w-4 h-4' />
													Atur Jam & Sahkan
												</button>

												{conflictWith && (
													<button
														onClick={() =>
															handleExecuteResolve('delete_conflict_and_approve')
														}
														className='flex items-center gap-1 px-3 py-2 bg-rose-100 text-[#E8451A] font-black text-xs uppercase tracking-wider border-[2px] border-[#0D0D0D] hover:bg-rose-200 cursor-pointer'
														title='Gunakan jika Jurnal 1 adalah salah input/duplikat'
													>
														<Trash2 className='w-3.5 h-3.5' />
														Hapus Jurnal 1 & Sahkan
													</button>
												)}

												<button
													onClick={() => handleExecuteResolve('reject_draft')}
													className='flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 font-black text-xs uppercase tracking-wider border-[2px] border-[#0D0D0D] hover:bg-gray-300 cursor-pointer'
												>
													<X className='w-3.5 h-3.5' />
													Tolak Draft
												</button>
											</div>
										</div>
									</div>
								);
							})}
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
													<span
														className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-black uppercase ${badge.bg} ${badge.text} ${badge.border}`}
													>
														<span>{badge.icon}</span> {badge.label}
													</span>
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
		</div>
	);
}
