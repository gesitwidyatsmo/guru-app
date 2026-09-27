'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
	Award,
	Check,
	Plus,
	Trash2,
	Save,
	Loader2,
	ExternalLink,
	AlertCircle,
	Sparkles,
	CheckCircle2,
	UserX,
	Calendar,
	BookOpen,
	Layers,
	FileText,
	ChevronRight,
	HelpCircle,
	Users,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';

// Neo-Brutalism SweetAlert Mixin Classes
const brutalCustomClass = {
	popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
	title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
	htmlContainer: 'font-bold text-[#0D0D0D]',
	input: 'border-[3px] border-[#0D0D0D] rounded-none font-black uppercase tracking-wider text-[#0D0D0D]',
	confirmButton:
		'bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
	cancelButton:
		'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3',
};

const brutalSwal = Swal.mixin({
	customClass: brutalCustomClass,
	buttonsStyling: false,
});

const GROUP_PALETTE = [
	{ bg: '#A3E635', text: '#0D0D0D' }, // Lime
	{ bg: '#FF90E8', text: '#0D0D0D' }, // Pink
	{ bg: '#F5C518', text: '#0D0D0D' }, // Yellow
	{ bg: '#38BDF8', text: '#0D0D0D' }, // Sky
	{ bg: '#FB923C', text: '#0D0D0D' }, // Orange
	{ bg: '#C084FC', text: '#0D0D0D' }, // Purple
	{ bg: '#34D399', text: '#0D0D0D' }, // Emerald
];

const TIPE_OPTIONS = [
	{ value: 'Tugas Kelompok', label: 'Tugas Kelompok' },
	{ value: 'Formatif', label: 'Formatif' },
	{ value: 'Sumatif', label: 'Sumatif' },
	{ value: 'Proyek', label: 'Proyek Kelompok' },
	{ value: 'Praktik', label: 'Praktik / Unjuk Kerja' },
];

export default function GroupScoringView({
	sessionData,
	groups = [],
	unassignedSiswa = [],
	mapelList = [],
	onAssessmentUpdated,
}) {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [existingAssessments, setExistingAssessments] = useState([]);
	const [activePhaseIndex, setActivePhaseIndex] = useState(0);

	// State Form Penilaian untuk Tahap yang Sedang Dipilih
	const [currentTugasId, setCurrentTugasId] = useState('');
	const [isNewPhase, setIsNewPhase] = useState(false);
	const [judul, setJudul] = useState('');
	const [type, setType] = useState('Tugas Kelompok');
	const [mapel, setMapel] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [deskripsi, setDeskripsi] = useState('');

	// Nilai
	const [groupBaseScores, setGroupBaseScores] = useState({}); // { [groupId]: score }
	const [studentScores, setStudentScores] = useState({}); // { [siswaId]: score }
	const [syncWithGroup, setSyncWithGroup] = useState({}); // { [groupId]: boolean }
	const [includeUnassigned, setIncludeUnassigned] = useState(false);
	const [unassignedScores, setUnassignedScores] = useState({}); // { [siswaId]: score }

	// Daftar kelompok reguler (tanpa wadah 'excluded')
	const regularGroups = useMemo(
		() => groups.filter((g) => String(g.id) !== 'excluded'),
		[groups]
	);

	// Fetch semua penilaian terkait sesi grup ini dari DB
	const fetchAssessments = useCallback(async () => {
		if (!sessionData?.id) return;
		try {
			setLoading(true);
			const supabase = createClient();
			const prefix = `TGS-GRP-${sessionData.id}`;

			// Ambil header nilai_tugas
			const { data: tugasList, error: tugasError } = await supabase
				.from('nilai_tugas')
				.select('*')
				.ilike('tugas_id', `${prefix}%`)
				.order('created_at', { ascending: true });

			if (tugasError) throw tugasError;

			if (tugasList && tugasList.length > 0) {
				const tugasIds = tugasList.map((t) => t.tugas_id);

				// Ambil detail nilai_siswa
				const { data: siswaScores, error: scoreError } = await supabase
					.from('nilai_siswa')
					.select('tugas_id, siswa_id, nama_siswa, nilai')
					.in('tugas_id', tugasIds);

					if (scoreError) throw scoreError;

				const hydrated = tugasList.map((t) => ({
					...t,
					scores: (siswaScores || []).filter((s) => s.tugas_id === t.tugas_id),
				}));

				setExistingAssessments(hydrated);
			} else {
				setExistingAssessments([]);
			}
		} catch (err) {
			console.error('Error fetching group assessments:', err);
		} finally {
			setLoading(false);
		}
	}, [sessionData?.id]);

	useEffect(() => {
		fetchAssessments();
	}, [fetchAssessments]);

	// Inisialisasi Form berdasarkan Tahap yang Aktif
	useEffect(() => {
		if (loading) return;

		// Tentukan mapel default
		let defaultMapel = '';
		if (sessionData?.mapel_id && sessionData.mapel_id !== '-') {
			defaultMapel = sessionData.mapel_id;
		} else if (mapelList.length > 0) {
			defaultMapel = mapelList[0]?.nama_mapel || mapelList[0]?.mapel || '';
		}

		if (existingAssessments.length > 0 && activePhaseIndex < existingAssessments.length) {
			// Mode Tampilkan/Edit Penilaian yang Sudah Tersimpan
			const target = existingAssessments[activePhaseIndex];
			setCurrentTugasId(target.tugas_id);
			setIsNewPhase(false);
			setJudul(target.kategori || sessionData?.judul_kegiatan || 'TUGAS KELOMPOK');
			setType(target.type || 'Tugas Kelompok');
			setMapel(target.mapel || defaultMapel);
			setTanggal(target.tanggal || new Date().toISOString().slice(0, 10));
			setDeskripsi(target.deskripsi || '');

			// Map skor siswa
			const scoreMap = {};
			(target.scores || []).forEach((s) => {
				scoreMap[s.siswa_id] = s.nilai !== null && s.nilai !== undefined ? String(s.nilai) : '';
			});
			setStudentScores(scoreMap);

			// Kalkulasi group base score berdasarkan rata-rata atau skor pertama
			const groupScoreMap = {};
			const syncMap = {};
			regularGroups.forEach((g) => {
				const memberScores = (g.members || []).map((m) => scoreMap[m.id] !== undefined ? scoreMap[m.id] : '');
				const firstScore = memberScores[0] || '';
				const allSame = memberScores.every((sc) => sc === firstScore);
				groupScoreMap[g.id] = firstScore;
				syncMap[g.id] = allSame;
			});
			setGroupBaseScores(groupScoreMap);
			setSyncWithGroup(syncMap);

			// Unassigned
			const unassignedScoreMap = {};
			let hasUnassignedScore = false;
			unassignedSiswa.forEach((u) => {
				if (scoreMap[u.id]) {
					unassignedScoreMap[u.id] = scoreMap[u.id];
					hasUnassignedScore = true;
				}
			});
			setUnassignedScores(unassignedScoreMap);
			setIncludeUnassigned(hasUnassignedScore);
		} else {
			// Mode Buat Penilaian Baru (Tahap 1 atau Tahap Berikutnya)
			const nextPhaseNum = existingAssessments.length + 1;
			const newId =
				nextPhaseNum === 1
					? `TGS-GRP-${sessionData?.id}`
					: `TGS-GRP-${sessionData?.id}-${Date.now().toString(36).toUpperCase()}`;

			setCurrentTugasId(newId);
			setIsNewPhase(true);
			setJudul(
				nextPhaseNum === 1
					? sessionData?.judul_kegiatan || 'TUGAS KELOMPOK'
					: `${sessionData?.judul_kegiatan || 'TUGAS KELOMPOK'} (TAHAP ${nextPhaseNum})`
			);
			setType('Tugas Kelompok');
			setMapel(defaultMapel);
			setTanggal(new Date().toISOString().slice(0, 10));
			setDeskripsi('');

			// Reset skor kosong
			const initialSync = {};
			const initialGroupScores = {};
			regularGroups.forEach((g) => {
				initialSync[g.id] = true;
				initialGroupScores[g.id] = '';
			});
			setGroupBaseScores(initialGroupScores);
			setSyncWithGroup(initialSync);
			setStudentScores({});
			setUnassignedScores({});
			setIncludeUnassigned(false);
		}
	}, [existingAssessments, activePhaseIndex, loading, sessionData, regularGroups, unassignedSiswa, mapelList]);

	// Handler Ubah Skor Kelompok
	const handleGroupScoreChange = (groupId, newScore) => {
		setGroupBaseScores((prev) => ({ ...prev, [groupId]: newScore }));

		// Jika fitur sinkronisasi aktif, terapkan ke seluruh anggota kelompok
		if (syncWithGroup[groupId]) {
			const group = regularGroups.find((g) => String(g.id) === String(groupId));
			if (group?.members) {
				setStudentScores((prev) => {
					const updated = { ...prev };
					group.members.forEach((m) => {
						updated[m.id] = newScore;
					});
					return updated;
				});
			}
		}
	};

	// Handler Toggle Sinkronisasi Kelompok
	const handleToggleSync = (groupId) => {
		const willSync = !syncWithGroup[groupId];
		setSyncWithGroup((prev) => ({ ...prev, [groupId]: willSync }));

		if (willSync) {
			const baseScore = groupBaseScores[groupId] || '';
			const group = regularGroups.find((g) => String(g.id) === String(groupId));
			if (group?.members) {
				setStudentScores((prev) => {
					const updated = { ...prev };
					group.members.forEach((m) => {
						updated[m.id] = baseScore;
					});
					return updated;
				});
			}
		}
	};

	// Handler Ubah Skor Individu
	const handleStudentScoreChange = (groupId, siswaId, newScore) => {
		setStudentScores((prev) => ({ ...prev, [siswaId]: newScore }));

		// Cek apakah skor individu berbeda dari skor kelompok
		const baseScore = groupBaseScores[groupId];
		if (newScore !== baseScore) {
			setSyncWithGroup((prev) => ({ ...prev, [groupId]: false }));
		}
	};

	// Handler Ubah Skor Siswa Dikecualikan
	const handleUnassignedScoreChange = (siswaId, newScore) => {
		setUnassignedScores((prev) => ({ ...prev, [siswaId]: newScore }));
	};

	// Handler Quick Fill Semua Kelompok
	const handleQuickFillAll = async () => {
		const { value: score } = await brutalSwal.fire({
			title: 'ISI CEPAT SEMUA KELOMPOK',
			input: 'number',
			inputLabel: 'MASUKKAN NILAI (0 - 100)',
			inputPlaceholder: 'Contoh: 85',
			showCancelButton: true,
			confirmButtonText: 'TERAPKAN',
			cancelButtonText: 'BATAL',
			inputValidator: (val) => {
				if (!val || val === '') return 'Nilai wajib diisi!';
				const n = parseFloat(val);
				if (isNaN(n) || n < 0 || n > 100) return 'Nilai harus antara 0 dan 100!';
			},
		});

		if (score === undefined || score === null || score === '') return;

		const validScore = String(score);
		const newGroupScores = {};
		const newSync = {};
		const newStudentScores = { ...studentScores };

		regularGroups.forEach((g) => {
			newGroupScores[g.id] = validScore;
			newSync[g.id] = true;
			(g.members || []).forEach((m) => {
				newStudentScores[m.id] = validScore;
			});
		});

		setGroupBaseScores(newGroupScores);
		setSyncWithGroup(newSync);
		setStudentScores(newStudentScores);
	};

	// Handler Tambah Tahap Penilaian Baru
	const handleAddNewPhase = () => {
		setActivePhaseIndex(existingAssessments.length);
	};

	// Statistik Real-time
	const stats = useMemo(() => {
		const activeScores = [];
		regularGroups.forEach((g) => {
			(g.members || []).forEach((m) => {
				const sc = studentScores[m.id];
				if (sc !== undefined && sc !== null && String(sc).trim() !== '') {
					const num = parseFloat(sc);
					if (!isNaN(num)) activeScores.push(num);
				}
			});
		});

		if (includeUnassigned) {
			unassignedSiswa.forEach((u) => {
				const sc = unassignedScores[u.id];
				if (sc !== undefined && sc !== null && String(sc).trim() !== '') {
					const num = parseFloat(sc);
					if (!isNaN(num)) activeScores.push(num);
				}
			});
		}

		const totalGraded = activeScores.length;
		if (totalGraded === 0) {
			return { avg: 0, max: 0, min: 0, totalGraded: 0 };
		}

		const sum = activeScores.reduce((a, b) => a + b, 0);
		const avg = (sum / totalGraded).toFixed(1);
		const max = Math.max(...activeScores);
		const min = Math.min(...activeScores);

		return { avg, max, min, totalGraded };
	}, [regularGroups, studentScores, includeUnassigned, unassignedSiswa, unassignedScores]);

	// Simpan atau Update ke Database Nilai
	const handleSaveAssessment = async () => {
		if (!judul.trim()) {
			await brutalSwal.fire({
				icon: 'warning',
				title: 'JUDUL WAJIB DIISI',
				text: 'Silakan isi judul tugas penilaian kelompok.',
			});
			return;
		}

		if (!mapel || mapel === '-') {
			await brutalSwal.fire({
				icon: 'warning',
				title: 'PILIH MATA PELAJARAN',
				text: 'Mata pelajaran wajib dipilih agar nilai dapat dicatat ke rapor KBM.',
			});
			return;
		}

		// Kumpulkan data nilai siswa
		const payloadNilai = [];
		regularGroups.forEach((g) => {
			(g.members || []).forEach((m) => {
				const sc = studentScores[m.id];
				if (sc !== undefined && sc !== null && String(sc).trim() !== '') {
					payloadNilai.push({
						siswa_id: m.id,
						nilai: parseFloat(sc) || 0,
					});
				}
			});
		});

		if (includeUnassigned) {
			unassignedSiswa.forEach((u) => {
				const sc = unassignedScores[u.id];
				if (sc !== undefined && sc !== null && String(sc).trim() !== '') {
					payloadNilai.push({
						siswa_id: u.id,
						nilai: parseFloat(sc) || 0,
					});
				}
			});
		}

		if (payloadNilai.length === 0) {
			const confirmEmpty = await brutalSwal.fire({
				title: 'BELUM ADA NILAI',
				text: 'Anda belum memasukkan nilai siswa sama sekali. Lanjutkan menyimpan form kosong?',
				icon: 'question',
				showCancelButton: true,
				confirmButtonText: 'YA, TETAP SIMPAN',
				cancelButtonText: 'BATAL',
			});
			if (!confirmEmpty.isConfirmed) return;
		}

		setSaving(true);
		brutalSwal.fire({
			title: 'MENYIMPAN KE DATABASE...',
			text: 'Menyinkronkan ke tabel nilai_tugas dan nilai_siswa',
			allowOutsideClick: false,
			didOpen: () => Swal.showLoading(),
		});

		try {
			const bodyData = {
				tugasId: currentTugasId,
				judul: judul.trim().toUpperCase(),
				type: type || 'Tugas Kelompok',
				deskripsi: deskripsi ? deskripsi.trim() : '',
				kelas: sessionData?.kelas_id,
				mapel: mapel,
				tanggal: tanggal,
				nilai: payloadNilai,
				tahun_ajar: tahunAjarAktif,
				semester: semesterAktif,
				mode_penilaian: 'langsung',
				total_soal: 100,
				skala_maks: 100,
				pembulatan: 'decimal_1',
			};

			const url = '/api/nilai';
			const method = isNewPhase ? 'POST' : 'PUT';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(bodyData),
			});

			const jsonRes = await res.json();
			if (!res.ok) throw new Error(jsonRes.error || jsonRes.details || 'Gagal menyimpan nilai');

			Swal.close();
			await brutalSwal.fire({
				icon: 'success',
				title: isNewPhase ? 'NILAI TERSIMPAN!' : 'NILAI DIPERBARUI!',
				text: `Berhasil mencatat nilai ke database utama (${payloadNilai.length} siswa dinilai).`,
				timer: 2000,
				showConfirmButton: false,
			});

			await fetchAssessments();
			if (onAssessmentUpdated) onAssessmentUpdated();
		} catch (err) {
			Swal.close();
			console.error('Error saving assessment:', err);
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL MENYIMPAN',
				text: err.message,
			});
		} finally {
			setSaving(false);
		}
	};

	// Hapus Tahap Penilaian yang Sedang Terpilih
	const handleDeletePhase = async () => {
		if (isNewPhase) {
			// Jika belum tersimpan di DB, cukup batalkan dan kembali ke tahap sebelumnya
			setActivePhaseIndex(Math.max(0, existingAssessments.length - 1));
			return;
		}

		const result = await brutalSwal.fire({
			title: 'HAPUS PENILAIAN TAHAP INI?',
			text: `Nilai dari tugas "${judul}" akan dihapus permanen dari database nilai kelas.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS',
			cancelButtonText: 'BATAL',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
				title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
				htmlContainer: 'font-bold text-[#0D0D0D]',
				confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
				cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
			},
		});

		if (!result.isConfirmed) return;

		setSaving(true);
		brutalSwal.fire({
			title: 'MENGHAPUS...',
			text: 'Menghapus data nilai dari database',
			allowOutsideClick: false,
			didOpen: () => Swal.showLoading(),
		});

		try {
			const res = await fetch(`/api/nilai?tugasId=${currentTugasId}`, {
				method: 'DELETE',
			});

			const jsonRes = await res.json();
			if (!res.ok) throw new Error(jsonRes.error || jsonRes.details || 'Gagal menghapus');

			Swal.close();
			await brutalSwal.fire({
				icon: 'success',
				title: 'PENILAIAN TERHAPUS',
				text: 'Data nilai telah dibersihkan dari database.',
				timer: 1500,
				showConfirmButton: false,
			});

			setActivePhaseIndex(0);
			await fetchAssessments();
			if (onAssessmentUpdated) onAssessmentUpdated();
		} catch (err) {
			Swal.close();
			console.error('Error deleting assessment:', err);
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: err.message,
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='p-10 bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-center space-y-3'>
				<Loader2 className='w-8 h-8 animate-spin mx-auto text-[#0D0D0D]' />
				<p className='font-black uppercase tracking-wider text-sm text-[#0D0D0D]'>
					MEMUAT DATA PENILAIAN DARI DATABASE...
				</p>
			</div>
		);
	}

	return (
		<div className='w-full space-y-6'>
			{/* Switcher Sub-Tab Penilaian (Mendukung Penilaian Tunggal & Bertahap) */}
			<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] sm:shadow-[6px_6px_0px_0px_#0D0D0D] p-3 sm:p-4'>
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-3'>
					<div className='min-w-0'>
						<div className='flex items-center gap-2'>
							<span className='p-1.5 bg-[#A3E635] border-[2px] border-[#0D0D0D]'>
								<Award className='w-4 h-4 text-[#0D0D0D]' strokeWidth={3} />
							</span>
							<h3 className='font-black text-sm sm:text-base text-[#0D0D0D] uppercase tracking-wider'>
								TAHAPAN PENILAIAN KELOMPOK
							</h3>
						</div>
						<p className='text-[10px] sm:text-xs font-bold text-[#0D0D0D]/70 uppercase tracking-widest mt-0.5'>
							Kelola penilaian tunggal atau tambahkan beberapa tahap penilaian untuk formasi kelompok ini.
						</p>
					</div>

					<button
						type='button'
						onClick={handleAddNewPhase}
						className='px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[#A3E635] text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-1.5 shrink-0'>
						<Plus className='w-4 h-4' strokeWidth={3} />
						<span>+ TAMBAH TAHAP PENILAIAN</span>
					</button>
				</div>

				{/* Strip Tombol Tahap */}
				<div className='flex flex-wrap items-center gap-2 pt-3 mt-3 border-t-[2px] border-[#0D0D0D]'>
					{existingAssessments.map((ass, idx) => {
						const isSelected = activePhaseIndex === idx;
						return (
							<button
								key={ass.tugas_id}
								type='button'
								onClick={() => setActivePhaseIndex(idx)}
								className={`px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black uppercase text-xs tracking-wider transition-all flex items-center gap-2 ${
									isSelected
										? 'bg-[#0D0D0D] text-white shadow-[3px_3px_0px_0px_#2F80ED] -translate-y-0.5'
										: 'bg-gray-100 text-[#0D0D0D] hover:bg-white shadow-[2px_2px_0px_0px_#0D0D0D]'
								}`}>
								<span>{idx + 1}. {ass.kategori}</span>
								<span className={`px-1.5 py-0.5 text-[9px] font-black border-[1.5px] border-[#0D0D0D] ${
									isSelected ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-white text-[#0D0D0D]'
								}`}>
									{ass.scores?.length || 0} SISWA
								</span>
							</button>
						);
					})}

					{/* Indikator Mode Buat Baru */}
					{isNewPhase && (
						<button
							type='button'
							className='px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black uppercase text-xs tracking-wider bg-[#F5C518] text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-1.5 -translate-y-0.5'>
							<Sparkles className='w-3.5 h-3.5' strokeWidth={3} />
							<span>TAHAP BARU (BELUM DISIMPAN)</span>
						</button>
					)}
				</div>
			</div>

			{/* Form Pengaturan Penilaian & Quick Stats */}
			<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] sm:shadow-[6px_6px_0px_0px_#0D0D0D] p-4 sm:p-6 space-y-5'>
				{/* Top Status Banner */}
				<div className='flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-[#0D0D0D] pb-4'>
					<div className='flex flex-wrap items-center gap-2'>
						<span className='px-2.5 py-1 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider'>
							{isNewPhase ? 'BUAT PENILAIAN BARU' : 'EDIT PENILAIAN TERSIMPAN'}
						</span>
						<span className='px-2.5 py-1 bg-gray-100 text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider'>
							ID: {currentTugasId}
						</span>
						{!isNewPhase && (
							<span className='px-2.5 py-1 bg-[#A3E635] text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider flex items-center gap-1'>
								<Check className='w-3.5 h-3.5' strokeWidth={3} />
								<span>TERDAFTAR DI DATABASE</span>
							</span>
						)}
					</div>

					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={handleQuickFillAll}
							className='px-3 py-1.5 bg-[#F5C518] text-[#0D0D0D] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1'>
							<Sparkles className='w-3.5 h-3.5' strokeWidth={3} />
							<span>ISI CEPAT SEMUA KELOMPOK</span>
						</button>
					</div>
				</div>

				{/* Input Field Grid */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
					{/* Judul Penilaian */}
					<div className='md:col-span-2 space-y-1'>
						<label className='font-black text-xs uppercase tracking-wider text-[#0D0D0D]'>
							JUDUL PENILAIAN / TUGAS *
						</label>
						<input
							type='text'
							value={judul}
							onChange={(e) => setJudul(e.target.value)}
							placeholder='Contoh: DISKUSI SISTEM PERNAPASAN'
							className='w-full px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] focus:outline-none focus:bg-[#FFF5F0]'
						/>
					</div>

					{/* Tipe Penilaian */}
					<div className='space-y-1'>
						<label className='font-black text-xs uppercase tracking-wider text-[#0D0D0D]'>
							TIPE PENILAIAN
						</label>
						<select
							value={type}
							onChange={(e) => setType(e.target.value)}
							className='w-full px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] bg-white focus:outline-none focus:bg-[#FFF5F0]'>
							{TIPE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* Mata Pelajaran */}
					<div className='space-y-1'>
						<label className='font-black text-xs uppercase tracking-wider text-[#0D0D0D]'>
							MATA PELAJARAN *
						</label>
						{sessionData?.mapel_id && sessionData.mapel_id !== '-' ? (
							<div className='px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-xs sm:text-sm uppercase tracking-wider bg-gray-100 text-[#0D0D0D] truncate'>
								{sessionData.mapel_id}
							</div>
						) : (
							<select
								value={mapel}
								onChange={(e) => setMapel(e.target.value)}
								className='w-full px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] bg-white focus:outline-none focus:bg-[#FFF5F0]'>
								<option value=''>-- PILIH MAPEL --</option>
								{mapelList.map((m, idx) => {
									const val = m.nama_mapel || m.mapel || m;
									return (
										<option key={idx} value={val}>
											{val}
										</option>
									);
								})}
							</select>
						)}
					</div>

					{/* Tanggal Penilaian */}
					<div className='space-y-1'>
						<label className='font-black text-xs uppercase tracking-wider text-[#0D0D0D]'>
							TANGGAL
						</label>
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							className='w-full px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] focus:outline-none focus:bg-[#FFF5F0]'
						/>
					</div>

					{/* Deskripsi Singkat */}
					<div className='md:col-span-3 space-y-1'>
						<label className='font-black text-xs uppercase tracking-wider text-[#0D0D0D]'>
							CATATAN / RUBRIK (OPSIONAL)
						</label>
						<input
							type='text'
							value={deskripsi}
							onChange={(e) => setDeskripsi(e.target.value)}
							placeholder='Contoh: Kriteria penilaian: keaktifan, materi, dan kerjasama kelompok.'
							className='w-full px-3 py-2 border-[2px] sm:border-[3px] border-[#0D0D0D] font-bold text-xs sm:text-sm text-[#0D0D0D] focus:outline-none focus:bg-[#FFF5F0]'
						/>
					</div>
				</div>

				{/* Strip Statistik Cepat Nilai */}
				<div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-3 border-t-[2px] border-[#0D0D0D]'>
					<div className='bg-[#A3E635] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70'>
							RATA-RATA NILAI
						</p>
						<p className='text-xl sm:text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.avg}</p>
					</div>

					<div className='bg-[#38BDF8] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70'>
							NILAI TERTINGGI
						</p>
						<p className='text-xl sm:text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.max}</p>
					</div>

					<div className='bg-[#F5C518] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70'>
							NILAI TERENDAH
						</p>
						<p className='text-xl sm:text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.min}</p>
					</div>

					<div className='bg-[#FF90E8] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70'>
							SISWA DINILAI
						</p>
						<p className='text-xl sm:text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.totalGraded}</p>
					</div>
				</div>
			</div>

			{/* Panduan Ringkas Penilaian */}
			<div className='bg-[#FFFDF0] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between gap-3 text-xs text-[#0D0D0D]'>
				<div className='flex items-center gap-2.5 min-w-0'>
					<span className='p-1.5 bg-[#F5C518] border-[2px] border-[#0D0D0D] text-[#0D0D0D] shrink-0'>
						<Sparkles className='w-4 h-4' strokeWidth={3} />
					</span>
					<p className='font-bold uppercase tracking-wide leading-relaxed text-[11px] sm:text-xs'>
						<span className='font-black'>CARA MENILAI:</span> Masukkan nilai pada kotak header kelompok untuk mengisi nilai semua anggota sekaligus. Anda tetap dapat mengubah nilai masing-masing siswa jika ada yang menonjol atau tidak hadir.
					</p>
				</div>
			</div>

			{/* Grid Kartu Penilaian Kelompok */}
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 items-start'>
				{regularGroups.map((group, idx) => {
					const color = GROUP_PALETTE[idx % GROUP_PALETTE.length];
					const baseScore = groupBaseScores[group.id] || '';
					const isSynced = syncWithGroup[group.id] !== false;

					return (
						<div
							key={group.id}
							className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] rounded-none flex flex-col overflow-hidden'>
							
							{/* Header Kelompok & Input Nilai Basis Kelompok */}
							<div
								style={{ backgroundColor: color.bg }}
								className='p-3.5 sm:p-4 border-b-[3px] sm:border-b-[4px] border-[#0D0D0D] space-y-3'>
								<div className='flex items-center justify-between gap-2'>
									<div className='min-w-0'>
										<h4 className='font-black text-base sm:text-lg text-[#0D0D0D] uppercase tracking-wider truncate'>
											{group.nama_grup || group.nama || 'TANPA NAMA'}
										</h4>
										<p className='text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]/70'>
											{group.members?.length || 0} ANGGOTA
										</p>
									</div>

									{/* Input Nilai Kelompok */}
									<div className='flex items-center gap-2 shrink-0'>
										<div className='text-right'>
											<span className='text-[9px] font-black uppercase tracking-wider block text-[#0D0D0D]'>
												NILAI GRUP
											</span>
											<input
												type='number'
												min='0'
												max='100'
												value={baseScore}
												onChange={(e) => handleGroupScoreChange(group.id, e.target.value)}
												onWheel={(e) => e.target.blur()}
												placeholder='0-100'
												className='w-16 px-2 py-1.5 bg-white border-[2px] sm:border-[3px] border-[#0D0D0D] font-black text-sm sm:text-base text-center text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0D0D0D]'
											/>
										</div>
									</div>
								</div>

								{/* Toggle Sinkronkan Nilai ke Anggota */}
								<div className='flex items-center justify-between pt-1 text-[11px] font-bold text-[#0D0D0D] border-t border-[#0D0D0D]/20'>
									<label className='flex items-center gap-2 cursor-pointer select-none'>
										<input
											type='checkbox'
											checked={isSynced}
											onChange={() => handleToggleSync(group.id)}
											className='w-4 h-4 accent-[#0D0D0D] cursor-pointer'
										/>
										<span className='uppercase tracking-wide'>
											{isSynced ? 'Semua anggota mengikuti skor grup' : 'Skor anggota disesuaikan manual'}
										</span>
									</label>
								</div>
							</div>

							{/* Daftar Anggota dengan Input Skor Individu */}
							<div className='p-0 grow divide-y-[2px] divide-[#0D0D0D] bg-white'>
								{group.members?.length === 0 ? (
									<div className='p-6 text-center text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/60'>
										Belum ada anggota di kelompok ini
									</div>
								) : (
									group.members.map((member, mIdx) => {
										const memberScore = studentScores[member.id] || '';
										const isCustom = memberScore !== '' && memberScore !== baseScore;

										return (
											<div
												key={member.id}
												className='p-3 flex items-center justify-between gap-3 hover:bg-[#FFF5F0] transition-colors'>
												{/* Nomor & Nama Siswa */}
												<div className='flex items-center gap-2.5 min-w-0'>
													<span className='w-6 h-6 bg-[#0D0D0D] text-white flex items-center justify-center font-black text-[11px] shrink-0 border-[2px] border-[#0D0D0D]'>
														{mIdx + 1}
													</span>
													<div className='min-w-0'>
														<p className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider truncate'>
															{member.nama}
														</p>
														<div className='flex items-center gap-2 mt-0.5'>
															{member.nis && (
																<span className='text-[10px] font-bold text-[#0D0D0D]/60 uppercase tracking-widest'>
																	NIS: {member.nis}
																</span>
															)}
															{isCustom && (
																<span className='text-[9px] font-black bg-[#F5C518] text-[#0D0D0D] px-1.5 py-0.2 border border-[#0D0D0D] uppercase tracking-wider'>
																	DISESUAIKAN
																</span>
															)}
														</div>
													</div>
												</div>

												{/* Input Skor Individu Siswa */}
												<div className='shrink-0'>
													<input
														type='number'
														min='0'
														max='100'
														value={memberScore}
														onChange={(e) =>
															handleStudentScoreChange(group.id, member.id, e.target.value)
														}
														onWheel={(e) => e.target.blur()}
														placeholder='-'
														className={`w-14 px-2 py-1 border-[2px] border-[#0D0D0D] font-black text-xs sm:text-sm text-center text-[#0D0D0D] focus:outline-none ${
															isCustom ? 'bg-[#FFF0B3]' : 'bg-white'
														}`}
													/>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Bagian Siswa yang Dikecualikan ("TIDAK MASUK KELOMPOK") */}
			{unassignedSiswa.length > 0 && (
				<div className='border-[3px] sm:border-[4px] border-[#0D0D0D] bg-[#FF90E8]/20 p-4 sm:p-6 shadow-[6px_6px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[3px] border-[#0D0D0D] pb-3'>
						<div className='flex items-center gap-2.5 min-w-0'>
							<span className='p-2 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D]'>
								<UserX className='w-4 h-4 sm:w-5 sm:h-5' strokeWidth={3} />
							</span>
							<div>
								<h4 className='font-black text-base sm:text-lg text-[#0D0D0D] uppercase tracking-wider'>
									SISWA DIKECUALIKAN / BELUM MASUK KELOMPOK ({unassignedSiswa.length} SISWA)
								</h4>
								<p className='text-[10px] sm:text-xs font-bold text-[#0D0D0D] uppercase tracking-widest mt-0.5'>
									Siswa ini tidak masuk kelompok. Secara default tidak dimasukkan ke database nilai tugas ini.
								</p>
							</div>
						</div>

						{/* Toggle Nilai Mandiri */}
						<label className='flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] select-none'>
							<input
								type='checkbox'
								checked={includeUnassigned}
								onChange={(e) => setIncludeUnassigned(e.target.checked)}
								className='w-4 h-4 accent-[#0D0D0D] cursor-pointer'
							/>
							<span className='text-xs font-black uppercase tracking-wider text-[#0D0D0D]'>
								Beri Nilai Mandiri
							</span>
						</label>
					</div>

					{includeUnassigned && (
						<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2'>
							{unassignedSiswa.map((siswa, uIdx) => (
								<div
									key={siswa.id || uIdx}
									className='bg-white border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center justify-between gap-3'>
									<div className='min-w-0'>
										<p className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider truncate'>
											{siswa.nama_lengkap}
										</p>
										{siswa.nis && (
											<p className='text-[10px] font-bold text-[#0D0D0D]/60 uppercase tracking-widest mt-0.5'>
												NIS: {siswa.nis}
											</p>
										)}
									</div>

									<input
										type='number'
										min='0'
										max='100'
										value={unassignedScores[siswa.id] || ''}
										onChange={(e) => handleUnassignedScoreChange(siswa.id, e.target.value)}
										onWheel={(e) => e.target.blur()}
										placeholder='0-100'
										className='w-14 px-2 py-1 border-[2px] border-[#0D0D0D] font-black text-xs sm:text-sm text-center text-[#0D0D0D] bg-white focus:outline-none'
									/>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Sticky Bottom Action Bar untuk Simpan / Update / Hapus */}
			<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-3 sm:p-4 sticky bottom-3 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
				<div className='flex items-center gap-3'>
					<span className='p-2 bg-[#A3E635] border-[2px] border-[#0D0D0D] hidden sm:inline-block'>
						<CheckCircle2 className='w-5 h-5 text-[#0D0D0D]' strokeWidth={3} />
					</span>
					<div>
						<p className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider'>
							{stats.totalGraded} SISWA SUDAH TERISI NILAI
						</p>
						<p className='text-[10px] font-bold text-[#0D0D0D]/70 uppercase tracking-widest'>
							Data tersimpan otomatis tersinkron ke Rekap Nilai & Rapor Siswa.
						</p>
					</div>
				</div>

				<div className='flex flex-wrap items-center gap-2 sm:gap-2.5'>
					{/* Tombol Hapus Tahap Penilaian */}
					{!isNewPhase && (
						<button
							type='button'
							onClick={handleDeletePhase}
							disabled={saving}
							className='px-3 sm:px-4 py-2.5 bg-[#E8451A] text-white border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 disabled:opacity-60'>
							<Trash2 className='w-4 h-4' strokeWidth={3} />
							<span>HAPUS TAHAP INI</span>
						</button>
					)}

					{/* Tombol Tautan ke Laporan Nilai */}
					{!isNewPhase && (
						<a
							href={`/laporan-nilai`}
							target='_blank'
							rel='noopener noreferrer'
							className='px-3 sm:px-4 py-2.5 bg-white text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5'>
							<ExternalLink className='w-4 h-4' strokeWidth={3} />
							<span className='hidden sm:inline'>LIHAT DI REKAP</span>
						</a>
					)}

					{/* Tombol Simpan / Perbarui */}
					<button
						type='button'
						onClick={handleSaveAssessment}
						disabled={saving}
						className='px-5 sm:px-6 py-2.5 bg-[#2F80ED] text-white border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] sm:shadow-[4px_4px_0px_0px_#0D0D0D] font-black uppercase text-xs sm:text-sm tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 disabled:opacity-60'>
						{saving ? (
							<Loader2 className='w-4 h-4 animate-spin' />
						) : (
							<Save className='w-4 h-4' strokeWidth={3} />
						)}
						<span>{isNewPhase ? 'SIMPAN KE DATABASE NILAI' : 'UPDATE PENILAIAN'}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
