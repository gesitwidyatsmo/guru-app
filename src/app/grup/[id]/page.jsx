'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
	Users,
	Trash2,
	Calendar,
	BookOpen,
	Layers,
	ChevronLeft,
	UserX,
	Copy,
	Check,
	Search,
	X,
	Edit3,
	ArrowRight,
	Share2,
	LayoutGrid,
	AlertCircle,
	CheckCircle2,
	Award
} from 'lucide-react';
import DragDropBoard from '@/app/components/DragDropBoard';
import GroupScoringView from '@/app/components/GroupScoringView';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { createClient } from '@/utils/supabase/client';

// Neobrutalism SweetAlert Mixin
const brutalCustomClass = {
	popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
	title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
	htmlContainer: 'font-bold text-[#0D0D0D]',
	confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
	cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
};

const brutalSwal = Swal.mixin({
	customClass: brutalCustomClass,
	buttonsStyling: false
});

const GROUP_HEADER_COLORS = [
	'#A3E635', // Lime
	'#FF90E8', // Pink
	'#F5C518', // Yellow
	'#6EE7B7', // Emerald
	'#93C5FD', // Blue
	'#FDBA74', // Orange
	'#C4B5FD', // Purple
	'#FCA5A5'  // Coral
];

export default function DetailGrupPage() {
	const { id } = useParams();
	const router = useRouter();

	const [sessionData, setSessionData] = useState(null);
	const [classSiswa, setClassSiswa] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'edit' | 'penilaian'
	const [isDeleting, setIsDeleting] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [isCopied, setIsCopied] = useState(false);

	// State Penilaian Terintegrasi
	const [assessmentsSummary, setAssessmentsSummary] = useState([]);
	const [mapelList, setMapelList] = useState([]);

	// Fetch Ringkasan Penilaian Sesi Grup ini dari DB
	const fetchAssessmentSummary = useCallback(async () => {
		if (!id) return;
		try {
			const supabase = createClient();
			const prefix = `TGS-GRP-${id}`;
			const { data: tugasData, error: errTugas } = await supabase
				.from('nilai_tugas')
				.select(`
					tugas_id,
					kategori,
					type,
					tanggal,
					nilai_siswa (
						siswa_id,
						nilai
					)
				`)
				.ilike('tugas_id', `${prefix}%`)
				.order('created_at', { ascending: true });

			if (!errTugas && tugasData) {
				setAssessmentsSummary(tugasData);
			} else {
				setAssessmentsSummary([]);
			}
		} catch (e) {
			console.error('Error fetching assessment summary:', e);
		}
	}, [id]);

	// Fetch Data Detail Grup by ID dan seluruh siswa aktif di kelas tersebut
	useEffect(() => {
		const fetchData = async () => {
			try {
				const res = await fetch('/api/grup');
				const allGroups = await res.json();
				const found = allGroups.find((g) => g.id === id);
				if (found) {
					setSessionData(found);

					// Ambil seluruh siswa aktif di kelas ini untuk mengetahui siapa yang dikecualikan
					try {
						const supabase = createClient();
						const { data: siswaData, error: siswaErr } = await supabase
							.from('siswa')
							.select('id, nis, nama_lengkap, status, kelas')
							.eq('kelas', found.kelas_id)
							.eq('status', 'Aktif');

						if (siswaData && !siswaErr && siswaData.length > 0) {
							setClassSiswa(siswaData);
						} else {
							// Fallback ke API siswa
							const resSiswa = await fetch(`/api/siswa?kelas=${encodeURIComponent(found.kelas_id)}&status=Aktif`);
							const jsonSiswa = await resSiswa.json();
							if (Array.isArray(jsonSiswa)) {
								setClassSiswa(jsonSiswa);
							}
						}
					} catch (siswaError) {
						console.error('Gagal mengambil daftar siswa kelas:', siswaError);
					}
				}
			} catch (err) {
				console.error('Error fetching detail:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
		fetchAssessmentSummary();

		// Fetch daftar mapel untuk fallback
		fetch('/api/mapel?all=false')
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setMapelList(Array.isArray(data) ? data : []))
			.catch((err) => console.error('Error fetching mapel list:', err));
	}, [id, fetchAssessmentSummary]);

	const groups = sessionData?.raw_json || [];

	const unassignedSiswa = useMemo(() => {
		if (!sessionData || !classSiswa.length) return [];
		const assignedIds = new Set();
		const savedGroups = sessionData.raw_json || [];
		savedGroups.forEach((g) => {
			(g.members || []).forEach((m) => {
				if (m?.id) assignedIds.add(String(m.id));
			});
			(g.anggota_ids || []).forEach((sid) => {
				if (sid) assignedIds.add(String(sid));
			});
		});

		return classSiswa.filter((s) => !assignedIds.has(String(s.id)));
	}, [sessionData, classSiswa]);

	const initialBoardGroups = useMemo(() => {
		return transformDataForBoard(groups, unassignedSiswa);
	}, [groups, unassignedSiswa]);

	// Filter grup & anggota berdasarkan pencarian di Tab Overview
	const filteredGroups = useMemo(() => {
		if (!searchQuery.trim()) return groups;
		const query = searchQuery.toLowerCase().trim();
		return groups.filter((g) => {
			const groupMatch = g.nama_grup?.toLowerCase().includes(query);
			const memberMatch = g.members?.some(
				(m) => m.nama?.toLowerCase().includes(query) || String(m.nis || '').includes(query)
			);
			return groupMatch || memberMatch;
		});
	}, [groups, searchQuery]);

	const filteredUnassigned = useMemo(() => {
		if (!searchQuery.trim()) return unassignedSiswa;
		const query = searchQuery.toLowerCase().trim();
		return unassignedSiswa.filter(
			(s) => s.nama_lengkap?.toLowerCase().includes(query) || String(s.nis || '').includes(query)
		);
	}, [unassignedSiswa, searchQuery]);

	// Statistik ringkas
	const stats = useMemo(() => {
		const totalGroups = groups.length;
		const totalAssigned = groups.reduce((acc, g) => acc + (g.members?.length || 0), 0);
		const avgPerGroup = totalGroups > 0 ? (totalAssigned / totalGroups).toFixed(1) : '0';
		const totalExcluded = unassignedSiswa.length;
		return { totalGroups, totalAssigned, avgPerGroup, totalExcluded };
	}, [groups, unassignedSiswa]);

	// Peta skor dari penilaian terakhir untuk ditampilkan di tab overview
	const latestAssessment = assessmentsSummary[assessmentsSummary.length - 1];
	const latestScoresMap = useMemo(() => {
		const map = {};
		if (latestAssessment?.nilai_siswa) {
			latestAssessment.nilai_siswa.forEach((s) => {
				map[s.siswa_id] = s.nilai;
			});
		}
		return map;
	}, [latestAssessment]);

	// Salin format WhatsApp
	const handleCopyWA = async () => {
		try {
			let text = `*📋 SUSUNAN KELOMPOK: ${sessionData.judul_kegiatan.toUpperCase()}*\n`;
			text += `Kelas: ${sessionData.kelas_id}\n`;
			if (sessionData.mapel_id && sessionData.mapel_id !== '-') {
				text += `Mata Pelajaran: ${sessionData.mapel_id}\n`;
			}
			text += `Tanggal: ${sessionData.tanggal}\n\n`;

			groups.forEach((g, idx) => {
				const groupName = g.nama_grup || `KELOMPOK ${idx + 1}`;
				text += `*${groupName.toUpperCase()}* (${g.members?.length || 0} Siswa):\n`;
				if (!g.members || g.members.length === 0) {
					text += `- (Belum ada anggota)\n`;
				} else {
					g.members.forEach((m, mIdx) => {
						text += `${mIdx + 1}. ${m.nama}${m.nis ? ` (NIS: ${m.nis})` : ''}\n`;
					});
				}
				text += `\n`;
			});

			if (unassignedSiswa.length > 0) {
				text += `*⚠️ TIDAK MASUK KELOMPOK / DIKECUALIKAN (${unassignedSiswa.length} Siswa):*\n`;
				unassignedSiswa.forEach((s, sIdx) => {
					text += `${sIdx + 1}. ${s.nama_lengkap}${s.nis ? ` (NIS: ${s.nis})` : ''}\n`;
				});
				text += `\n`;
			}

			text += `_Dibuat melalui Guru App_`;

			await navigator.clipboard.writeText(text.trim());
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2500);

			await brutalSwal.fire({
				icon: 'success',
				title: 'FORMAT WA DISALIN!',
				text: 'Susunan kelompok telah disalin ke clipboard dan siap dikirim ke WhatsApp.',
				timer: 1500,
				showConfirmButton: false,
			});
		} catch (err) {
			console.error('Gagal menyalin format WA:', err);
		}
	};

	const handleDelete = async () => {
		const result = await brutalSwal.fire({
			title: 'HAPUS GRUP INI?',
			text: 'DATA GRUP AKAN DIHAPUS PERMANEN DARI DATABASE.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL'
		});
		if (!result.isConfirmed) return;

		brutalSwal.fire({
			title: 'MENGHAPUS...',
			text: 'JANGAN TUTUP HALAMAN',
			allowOutsideClick: false,
			didOpen: () => Swal.showLoading()
		});
		setIsDeleting(true);
		
		try {
			const res = await fetch(`/api/grup?id=${id}`, {
				method: 'DELETE',
			});

			if (!res.ok) throw new Error('Gagal menghapus');

			Swal.close();
			await brutalSwal.fire({
				icon: 'success',
				title: 'TERHAPUS!',
				text: 'DATA GRUP BERHASIL DIHAPUS',
				timer: 1500,
				showConfirmButton: false,
			});
			router.push('/grup');
		} catch (err) {
			Swal.close();
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: err.message,
			});
			setIsDeleting(false);
		}
	};

	if (loading) return <Loader />;

	if (!sessionData)
		return (
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-4 sm:p-6 pt-12 flex justify-center'>
				<div className='max-w-2xl w-full'>
					<div className='bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] sm:shadow-[12px_12px_0px_0px_#0D0D0D] p-6 sm:p-10 text-center flex flex-col items-center'>
						<div className='mb-6 bg-[#E8451A] p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<Layers className='w-10 h-10 text-white' strokeWidth={3} />
						</div>
						<p className='text-xl sm:text-2xl text-[#0D0D0D] font-black uppercase tracking-widest bg-[#F5C518] px-4 py-2 border-[4px] border-[#0D0D0D] rotate-1'>DATA TIDAK DITEMUKAN</p>
						<p className='text-[#0D0D0D] font-bold uppercase tracking-widest mt-4 text-sm sm:text-base'>Coba kembali ke daftar dan pilih kelompok lain.</p>
						<button
							onClick={() => router.push('/grup')}
							className='mt-8 h-[54px] sm:h-[60px] px-6 sm:px-8 bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] rounded-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D] text-sm sm:text-base'>
							KEMBALI KE DAFTAR
						</button>
					</div>
				</div>
			</div>
		);

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-24 pt-4 sm:pt-8 font-sans'>
			<div className='max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-8'>
				
				{/* Top Bar: Navigasi & Aksi Utama */}
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<button
							onClick={() => router.push('/grup')}
							className='p-3 sm:px-4 sm:py-3 bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] sm:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-2 font-black uppercase text-xs sm:text-sm'
							title='Kembali ke Daftar Grup'>
							<ChevronLeft className='w-5 h-5 sm:w-6 sm:h-6 text-[#0D0D0D]' strokeWidth={3} />
							<span className='hidden sm:inline'>DAFTAR GRUP</span>
						</button>

						<div className='bg-[#FF90E8] px-3 py-2 sm:px-4 sm:py-2.5 border-[3px] sm:border-[4px] border-[#0D0D0D] -rotate-1 inline-block shadow-[3px_3px_0px_0px_#0D0D0D] sm:shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<h1 className='text-base sm:text-xl md:text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>DETAIL GRUP</h1>
						</div>
					</div>

					<div className='flex items-center gap-2 sm:gap-3 ml-auto'>
						<button
							onClick={handleCopyWA}
							className='px-3 sm:px-4 py-2.5 sm:py-3 bg-[#25D366] text-white border-[3px] sm:border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] sm:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-2'
							title='Salin Susunan untuk WhatsApp'>
							{isCopied ? <Check className='w-4 h-4' strokeWidth={3} /> : <Share2 className='w-4 h-4' strokeWidth={3} />}
							<span>{isCopied ? 'TERSALIN!' : 'BAGIKAN (WA)'}</span>
						</button>

						<button
							onClick={handleDelete}
							disabled={isDeleting}
							className='px-3 sm:px-4 py-2.5 sm:py-3 bg-[#E8451A] text-white border-[3px] sm:border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] sm:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-60'
							title='Hapus Formasi Grup'>
							<Trash2 className='w-4 h-4' strokeWidth={3} />
							<span className='hidden sm:inline'>{isDeleting ? 'MENGHAPUS...' : 'HAPUS'}</span>
						</button>
					</div>
				</div>

				{/* Hero Card: Ringkasan Kegiatan & Quick Stats */}
				<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] sm:shadow-[10px_10px_0px_0px_#0D0D0D] rounded-none overflow-hidden relative'>
					<div className='absolute -right-8 -top-8 w-28 h-28 bg-[#A3E635] border-[3px] border-[#0D0D0D] rotate-45 z-0'></div>
					
					<div className='p-4 sm:p-6 md:p-8 relative z-10 space-y-6'>
						{/* Judul & Meta Chips */}
						<div className='space-y-3'>
							<div className='flex items-center gap-2'>
								<span className='text-[10px] sm:text-xs font-black uppercase tracking-widest bg-[#0D0D0D] text-white px-2 py-0.5 border-[2px] border-[#0D0D0D]'>
									ID: {sessionData.id}
								</span>
								<span className='text-[10px] sm:text-xs font-black uppercase tracking-widest bg-gray-100 text-[#0D0D0D] px-2 py-0.5 border-[2px] border-[#0D0D0D]'>
									METODE: {sessionData.metode_generate || 'MANUAL'}
								</span>
							</div>

							<h2 className='text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider text-[#0D0D0D] leading-tight break-words'>
								{sessionData.judul_kegiatan}
							</h2>

							<div className='flex flex-wrap items-center gap-2 sm:gap-3 pt-1'>
								<div className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<Layers className='w-3.5 h-3.5' strokeWidth={3} />
									<span>KELAS {sessionData.kelas_id}</span>
								</div>

								<div className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-[#2F80ED] text-white px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<BookOpen className='w-3.5 h-3.5' strokeWidth={3} />
									<span>{sessionData.mapel_id || 'SEMUA MAPEL'}</span>
								</div>

								<div className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-white text-[#0D0D0D] px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<Calendar className='w-3.5 h-3.5' strokeWidth={3} />
									<span>{sessionData.tanggal}</span>
								</div>

								{unassignedSiswa.length > 0 && (
									<div className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-[#FF90E8] text-[#0D0D0D] px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<UserX className='w-3.5 h-3.5' strokeWidth={3} />
										<span>{unassignedSiswa.length} DIKECUALIKAN</span>
									</div>
								)}

								{/* Status Penilaian Chip */}
								{assessmentsSummary.length > 0 ? (
									<button
										type='button'
										onClick={() => setActiveTab('penilaian')}
										className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-[#A3E635] text-[#0D0D0D] px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all'>
										<Award className='w-3.5 h-3.5' strokeWidth={3} />
										<span>{assessmentsSummary.length} TAHAP PENILAIAN TERCATAT</span>
									</button>
								) : (
									<button
										type='button'
										onClick={() => setActiveTab('penilaian')}
										className='inline-flex items-center gap-1.5 border-[2px] sm:border-[3px] border-[#0D0D0D] bg-white text-[#0D0D0D] px-3 py-1.5 font-black uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all'>
										<Award className='w-3.5 h-3.5 text-[#0D0D0D]' strokeWidth={3} />
										<span>BELUM DINILAI (+ BERI NILAI)</span>
									</button>
								)}
							</div>
						</div>

						{/* Quick Stats Strip */}
						<div className='grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 pt-2 border-t-[3px] border-[#0D0D0D]'>
							<div className='bg-[#A3E635] border-[3px] border-[#0D0D0D] p-3 sm:p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<p className='text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#0D0D0D]/70'>TOTAL KELOMPOK</p>
								<p className='text-xl sm:text-2xl md:text-3xl font-black text-[#0D0D0D] mt-1'>{stats.totalGroups}</p>
							</div>

							<div className='bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] p-3 sm:p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<p className='text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/80'>SISWA MASUK GRUP</p>
								<p className='text-xl sm:text-2xl md:text-3xl font-black mt-1'>{stats.totalAssigned}</p>
							</div>

							<div className='bg-[#F5C518] border-[3px] border-[#0D0D0D] p-3 sm:p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<p className='text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#0D0D0D]/70'>RATA-RATA / GRUP</p>
								<p className='text-xl sm:text-2xl md:text-3xl font-black text-[#0D0D0D] mt-1'>{stats.avgPerGroup}</p>
							</div>

							<div className={`${stats.totalExcluded > 0 ? 'bg-[#FF90E8]' : 'bg-gray-100'} border-[3px] border-[#0D0D0D] p-3 sm:p-4 shadow-[3px_3px_0px_0px_#0D0D0D]`}>
								<p className='text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#0D0D0D]/70'>DIKECUALIKAN</p>
								<p className='text-xl sm:text-2xl md:text-3xl font-black text-[#0D0D0D] mt-1'>{stats.totalExcluded}</p>
							</div>
						</div>
					</div>

					{/* Segmented Tab Nav */}
					<div className='border-t-[3px] sm:border-t-[4px] border-[#0D0D0D] bg-gray-100 p-2 sm:p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3'>
						<button
							type='button'
							onClick={() => setActiveTab('overview')}
							className={`py-3 px-4 font-black uppercase tracking-wider text-xs sm:text-sm border-[3px] border-[#0D0D0D] transition-all flex items-center justify-center gap-2 ${
								activeTab === 'overview'
									? 'bg-[#0D0D0D] text-white shadow-[4px_4px_0px_0px_#2F80ED] -translate-y-0.5'
									: 'bg-white text-[#0D0D0D] hover:bg-gray-50 shadow-[2px_2px_0px_0px_#0D0D0D]'
							}`}>
							<LayoutGrid className='w-4 h-4' strokeWidth={3} />
							<span>OVERVIEW KELOMPOK</span>
							<span className={`px-2 py-0.5 text-[10px] font-black border-[2px] border-[#0D0D0D] ${
								activeTab === 'overview' ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-gray-200 text-[#0D0D0D]'
							}`}>
								{groups.length} GRUP
							</span>
						</button>

						<button
							type='button'
							onClick={() => setActiveTab('edit')}
							className={`py-3 px-4 font-black uppercase tracking-wider text-xs sm:text-sm border-[3px] border-[#0D0D0D] transition-all flex items-center justify-center gap-2 ${
								activeTab === 'edit'
									? 'bg-[#0D0D0D] text-white shadow-[4px_4px_0px_0px_#E8451A] -translate-y-0.5'
									: 'bg-white text-[#0D0D0D] hover:bg-gray-50 shadow-[2px_2px_0px_0px_#0D0D0D]'
							}`}>
							<Edit3 className='w-4 h-4' strokeWidth={3} />
							<span>EDIT SUSUNAN & DRAG DROP</span>
							<span className='px-2 py-0.5 text-[10px] font-black border-[2px] border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D]'>
								INTERAKTIF
							</span>
						</button>

						<button
							type='button'
							onClick={() => setActiveTab('penilaian')}
							className={`py-3 px-4 font-black uppercase tracking-wider text-xs sm:text-sm border-[3px] border-[#0D0D0D] transition-all flex items-center justify-center gap-2 ${
								activeTab === 'penilaian'
									? 'bg-[#0D0D0D] text-white shadow-[4px_4px_0px_0px_#A3E635] -translate-y-0.5'
									: 'bg-white text-[#0D0D0D] hover:bg-gray-50 shadow-[2px_2px_0px_0px_#0D0D0D]'
							}`}>
							<Award className='w-4 h-4' strokeWidth={3} />
							<span>PENILAIAN KELOMPOK</span>
							<span className={`px-2 py-0.5 text-[10px] font-black border-[2px] border-[#0D0D0D] ${
								assessmentsSummary.length > 0 ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-[#F5C518] text-[#0D0D0D]'
							}`}>
								{assessmentsSummary.length > 0 ? `${assessmentsSummary.length} TAHAP` : 'BELUM DINILAI'}
							</span>
						</button>
					</div>
				</div>

				{/* Tab 1: OVERVIEW */}
				{activeTab === 'overview' && (
					<div className='space-y-6 sm:space-y-8 animate-in fade-in duration-200'>
						
						{/* Banner Status Penilaian Kelompok */}
						{assessmentsSummary.length > 0 ? (
							<div className='bg-[#A3E635]/20 border-[3px] sm:border-[4px] border-[#0D0D0D] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
								<div className='flex items-center gap-2.5 min-w-0'>
									<span className='p-2 bg-[#A3E635] border-[2px] border-[#0D0D0D] text-[#0D0D0D] shrink-0'>
										<Award className='w-4 h-4 sm:w-5 sm:h-5' strokeWidth={3} />
									</span>
									<div className='min-w-0'>
										<p className='font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] truncate'>
											PENILAIAN TERCATAT: {assessmentsSummary.length} TAHAP (TERAKHIR: {latestAssessment?.kategori || 'PENILAIAN'})
										</p>
										<p className='text-[10px] sm:text-xs font-bold text-[#0D0D0D]/70 uppercase tracking-widest mt-0.5'>
											Nilai kegiatan kelompok ini telah masuk ke database nilai_tugas dan rapor siswa.
										</p>
									</div>
								</div>
								<button
									type='button'
									onClick={() => setActiveTab('penilaian')}
									className='px-3.5 py-2 bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1.5 shrink-0'>
									<span>KELOLA PENILAIAN</span>
									<ArrowRight className='w-3.5 h-3.5' strokeWidth={3} />
								</button>
							</div>
						) : (
							<div className='bg-[#FFFDF0] border-[3px] sm:border-[4px] border-[#0D0D0D] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
								<div className='flex items-center gap-2.5 min-w-0'>
									<span className='p-2 bg-[#F5C518] border-[2px] border-[#0D0D0D] text-[#0D0D0D] shrink-0'>
										<Award className='w-4 h-4 sm:w-5 sm:h-5' strokeWidth={3} />
									</span>
									<div className='min-w-0'>
										<p className='font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D]'>
											KEGIATAN KELOMPOK INI BELUM DINILAI
										</p>
										<p className='text-[10px] sm:text-xs font-bold text-[#0D0D0D]/70 uppercase tracking-widest mt-0.5'>
											Berikan nilai per kelompok atau per individu agar langsung tercatat ke database nilai kelas.
										</p>
									</div>
								</div>
								<button
									type='button'
									onClick={() => setActiveTab('penilaian')}
									className='px-3.5 py-2 bg-[#2F80ED] text-white border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1.5 shrink-0'>
									<span>BERI NILAI KELOMPOK</span>
									<ArrowRight className='w-3.5 h-3.5' strokeWidth={3} />
								</button>
							</div>
						)}
						
						{/* Search Bar & Result Indicator */}
						<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] p-3 sm:p-4 shadow-[4px_4px_0px_0px_#0D0D0D] sm:shadow-[6px_6px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
							<div className='relative flex-1'>
								<Search className='w-5 h-5 text-[#0D0D0D] absolute left-3 top-1/2 -translate-y-1/2' strokeWidth={3} />
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder='CARI NAMA SISWA ATAU KELOMPOK...'
									className='w-full pl-10 pr-10 py-2.5 sm:py-3 border-[3px] border-[#0D0D0D] rounded-none font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] placeholder:text-gray-400 focus:outline-none focus:bg-[#FFF5F0]'
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className='absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 border-[2px] border-[#0D0D0D]'
										title='Bersihkan pencarian'>
										<X className='w-3.5 h-3.5' strokeWidth={3} />
									</button>
								)}
							</div>

							<div className='flex items-center justify-between sm:justify-end gap-2 text-xs font-black uppercase tracking-widest text-[#0D0D0D]'>
								<span>MENAMPILKAN:</span>
								<span className='bg-[#A3E635] px-2.5 py-1 border-[2px] border-[#0D0D0D]'>
									{filteredGroups.length} KELOMPOK
								</span>
							</div>
						</div>

						{/* Grid Kelompok */}
						{filteredGroups.length === 0 ? (
							<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] p-10 text-center shadow-[6px_6px_0px_0px_#0D0D0D]'>
								<AlertCircle className='w-12 h-12 text-[#E8451A] mx-auto mb-3' strokeWidth={3} />
								<p className='text-lg font-black uppercase tracking-widest text-[#0D0D0D]'>TIDAK DITEMUKAN HASIL</p>
								<p className='text-xs font-bold text-gray-600 uppercase tracking-widest mt-1'>
									Tidak ada kelompok atau siswa yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
								</p>
								<button
									onClick={() => setSearchQuery('')}
									className='mt-4 px-4 py-2 bg-[#F5C518] text-[#0D0D0D] font-black uppercase tracking-widest text-xs border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
									RESET PENCARIAN
								</button>
							</div>
						) : (
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6'>
								{filteredGroups.map((group, idx) => {
									const headerColor = GROUP_HEADER_COLORS[idx % GROUP_HEADER_COLORS.length];
									const memberCount = group.members?.length || 0;

									return (
										<div
											key={group.id || idx}
											className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] rounded-none flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#0D0D0D] transition-all'>
											
											{/* Card Header dengan Warna Pastel Variatif */}
											<div
												style={{ backgroundColor: headerColor }}
												className='p-4 border-b-[3px] sm:border-b-[4px] border-[#0D0D0D] flex items-center justify-between gap-3 relative overflow-hidden'>
												<div className='min-w-0'>
													<h3 className='font-black text-lg sm:text-xl text-[#0D0D0D] uppercase tracking-wider truncate'>
														{group.nama_grup || `KELOMPOK ${idx + 1}`}
													</h3>
												</div>
												<div className='flex items-center gap-1.5 shrink-0'>
													{/* Skor Penilaian Kelompok jika ada */}
													{(() => {
														const memberScoreVals = (group.members || [])
															.map((m) => latestScoresMap[m.id])
															.filter((sc) => sc !== undefined && sc !== null && sc !== '');
														if (memberScoreVals.length > 0) {
															const avgScore = (
																memberScoreVals.reduce((a, b) => a + parseFloat(b), 0) / memberScoreVals.length
															).toFixed(1);
															return (
																<span className='text-xs bg-[#0D0D0D] text-[#A3E635] border-[2px] border-[#0D0D0D] px-2 py-1 font-black uppercase tracking-wider'>
																	NILAI: {avgScore}
																</span>
															);
														}
														return null;
													})()}

													<span className='text-xs bg-white text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2.5 py-1 font-black uppercase tracking-widest'>
														{memberCount} SISWA
													</span>
													{group.avg && (
														<span className='text-[10px] bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] px-2 py-1 font-black uppercase tracking-widest'>
															AVG {parseFloat(group.avg).toFixed(1)}
														</span>
													)}
												</div>
											</div>

											{/* Member List */}
											<div className='p-0 grow bg-white flex flex-col justify-between'>
												{memberCount === 0 ? (
													<div className='p-8 text-center bg-[#FFF5F0] border-dashed border-[#0D0D0D] my-auto'>
														<span className='bg-white px-3 py-1.5 border-[2px] border-[#0D0D0D] font-black uppercase tracking-widest text-xs inline-block shadow-[2px_2px_0px_0px_#0D0D0D]'>
															BELUM ADA ANGGOTA
														</span>
													</div>
												) : (
													<ul className='divide-y-[2px] sm:divide-y-[3px] divide-[#0D0D0D]'>
														{group.members.map((member, mIdx) => {
															const isMatch = searchQuery && (
																member.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
																String(member.nis || '').includes(searchQuery)
															);

															return (
																<li
																	key={member.id || mIdx}
																	className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
																		isMatch ? 'bg-[#F5C518]/30 font-black' : 'hover:bg-[#FFF5F0]'
																	}`}>
																	<div className='flex items-center gap-3 min-w-0'>
																		<span className='w-6 sm:w-7 h-6 sm:h-7 bg-[#0D0D0D] text-white flex items-center justify-center font-black text-xs shrink-0 border-[2px] border-[#0D0D0D]'>
																			{mIdx + 1}
																		</span>
																		<div className='min-w-0'>
																			<p className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider truncate'>
																				{member.nama}
																			</p>
																			{member.nis && (
																				<p className='text-[10px] font-bold text-[#0D0D0D]/60 uppercase tracking-widest'>
																					NIS: {member.nis}
																				</p>
																			)}
																		</div>
																	</div>

																	{/* Skor dari Penilaian Terakhir */}
																	{latestScoresMap[member.id] !== undefined && latestScoresMap[member.id] !== null && String(latestScoresMap[member.id]).trim() !== '' && (
																		<span className='text-[10px] font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] bg-[#A3E635] text-[#0D0D0D] uppercase shrink-0 shadow-[1px_1px_0px_0px_#0D0D0D]'>
																			NILAI: {latestScoresMap[member.id]}
																		</span>
																	)}

																	{typeof member.avg !== 'undefined' && (
																		<span className='text-[10px] font-black px-2 py-0.5 border-[2px] border-[#0D0D0D] bg-white text-[#0D0D0D] uppercase shrink-0'>
																			{parseFloat(member.avg).toFixed(1)}
																		</span>
																	)}
																</li>
															);
														})}
													</ul>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}

						{/* Section Siswa yang Dikecualikan / Tidak Masuk Kelompok */}
						{unassignedSiswa.length > 0 && (
							<div className='border-[3px] sm:border-[4px] border-[#0D0D0D] bg-[#FF90E8] p-4 sm:p-6 shadow-[6px_6px_0px_0px_#0D0D0D] rounded-none space-y-4'>
								<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[3px] border-[#0D0D0D] pb-4'>
									<div className='min-w-0'>
										<div className='flex items-center gap-2'>
											<span className='p-1.5 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D]'>
												<UserX className='w-4 h-4 text-white' strokeWidth={3} />
											</span>
											<h3 className='font-black text-lg sm:text-xl text-[#0D0D0D] uppercase tracking-wider'>
												TIDAK MASUK KELOMPOK / DIKECUALIKAN
											</h3>
										</div>
										<p className='text-xs font-bold text-[#0D0D0D] uppercase tracking-widest mt-1'>
											Siswa ini belum dimasukkan ke kelompok manapun atau dikecualikan saat pembuatan.
										</p>
									</div>

									<div className='flex items-center gap-3'>
										<span className='px-3 py-1.5 bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black uppercase text-xs shadow-[2px_2px_0px_0px_#0D0D0D] whitespace-nowrap'>
											{unassignedSiswa.length} SISWA
										</span>

										<button
											onClick={() => setActiveTab('edit')}
											className='px-4 py-2 bg-[#A3E635] text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black uppercase text-xs shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-1.5 whitespace-nowrap'>
											<span>ATUR SUSUNAN</span>
											<ArrowRight className='w-3.5 h-3.5' strokeWidth={3} />
										</button>
									</div>
								</div>

								{/* Daftar Siswa Dikecualikan */}
								<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
									{filteredUnassigned.map((siswa, sIdx) => (
										<div
											key={siswa.id || sIdx}
											className='bg-white border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between gap-3'>
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
											<span className='text-[10px] font-black bg-[#F5C518] border-[2px] border-[#0D0D0D] px-2 py-0.5 uppercase tracking-widest shrink-0'>
												DIKECUALIKAN
											</span>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Banner Semua Siswa Terbagi jika tidak ada yang dikecualikan */}
						{unassignedSiswa.length === 0 && (
							<div className='bg-[#A3E635] border-[3px] sm:border-[4px] border-[#0D0D0D] p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center gap-3'>
								<CheckCircle2 className='w-6 h-6 text-[#0D0D0D] shrink-0' strokeWidth={3} />
								<div>
									<p className='font-black text-sm uppercase tracking-widest text-[#0D0D0D]'>
										SEMUA SISWA AKTIF SUDAH MASUK KE DALAM KELOMPOK
									</p>
									<p className='text-xs font-bold text-[#0D0D0D]/80 uppercase tracking-widest mt-0.5'>
										Tidak ada siswa yang dikecualikan atau tertinggal di kelas ini.
									</p>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Tab 2: EDIT SUSUNAN (Drag & Drop) */}
				{activeTab === 'edit' && (
					<div className='animate-in fade-in duration-200'>
						<DragDropBoard
							initialGroups={initialBoardGroups}
							metaData={{
								judul: sessionData.judul_kegiatan,
								kelas: sessionData.kelas_id,
								metode: sessionData.metode_generate || 'manual'
							}}
							sessionId={id}
							onBack={() => setActiveTab('overview')}
							isTabMode={true}
						/>
					</div>
				)}

				{/* Tab 3: PENILAIAN KELOMPOK */}
				{activeTab === 'penilaian' && (
					<div className='animate-in fade-in duration-200'>
						<GroupScoringView
							sessionData={sessionData}
							groups={groups}
							unassignedSiswa={unassignedSiswa}
							mapelList={mapelList}
							onAssessmentUpdated={fetchAssessmentSummary}
						/>
					</div>
				)}

			</div>
		</div>
	);
}

// Helper: Transform data json simpanan kembali ke format Board termasuk siswa yang dikecualikan
function transformDataForBoard(savedGroups, unassignedList = []) {
	const regularGroups = savedGroups.filter(
		(g) => String(g.id) !== 'excluded' && g.nama_grup !== 'TIDAK MASUK KELOMPOK'
	);

	const boardGroups = regularGroups.map((g, i) => ({
		id: g.id || `g-edit-${i}`,
		nama: g.nama_grup,
		members: g.members || [],
	}));

	const existingExcluded = savedGroups.find(
		(g) => String(g.id) === 'excluded' || g.nama_grup === 'TIDAK MASUK KELOMPOK'
	);
	const existingMembers = existingExcluded?.members || [];

	const excludedMap = new Map();
	existingMembers.forEach((m) => {
		if (m?.id) excludedMap.set(String(m.id), m);
	});
	unassignedList.forEach((s) => {
		if (s?.id && !excludedMap.has(String(s.id))) {
			excludedMap.set(String(s.id), {
				id: s.id,
				nama: s.nama_lengkap,
				nis: s.nis,
			});
		}
	});

	boardGroups.push({
		id: 'excluded',
		nama: 'TIDAK MASUK KELOMPOK',
		members: Array.from(excludedMap.values()),
	});

	return boardGroups;
}
