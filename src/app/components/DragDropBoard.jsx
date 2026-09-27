'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	Save,
	Loader2,
	GripVertical,
	Plus,
	Trash2,
	Shuffle,
	Edit2,
	UserX,
	ArrowRightLeft,
	ArrowRight,
	Sparkles,
	X,
	Layers,
	BookOpen,
	Users,
} from 'lucide-react';
import {
	DndContext,
	PointerSensor,
	TouchSensor,
	useDroppable,
	useDraggable,
	useSensor,
	useSensors,
	DragOverlay,
	closestCenter,
} from '@dnd-kit/core';
import Swal from 'sweetalert2';
import { useAcademic } from '@/context/AcademicContext';

// Neobrutalism SweetAlert Mixin Classes
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

// Palet warna ceria neo-brutalism untuk header kelompok
const GROUP_COLORS = [
	{ bg: '#A3E635', text: '#0D0D0D' }, // Lime
	{ bg: '#FF90E8', text: '#0D0D0D' }, // Bubblegum Pink
	{ bg: '#F5C518', text: '#0D0D0D' }, // Sunflower Yellow
	{ bg: '#38BDF8', text: '#0D0D0D' }, // Sky Blue
	{ bg: '#FB923C', text: '#0D0D0D' }, // Coral Orange
	{ bg: '#C084FC', text: '#0D0D0D' }, // Purple
	{ bg: '#34D399', text: '#0D0D0D' }, // Emerald Green
];

const DragDropBoard = ({ initialGroups, metaData, onBack, sessionId, isTabMode = false }) => {
	const router = useRouter();
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [groups, setGroups] = useState(initialGroups || []);
	const [isSaving, setIsSaving] = useState(false);
	const [quickMoveTarget, setQuickMoveTarget] = useState(null); // { member, fromGroupId }

	useEffect(() => {
		setGroups(initialGroups || []);
	}, [initialGroups]);

	const shuffleArray = (arr) => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};

	// 1. Acak Ulang Anggota Kelompok Aktif
	const handleShuffle = async () => {
		const result = await brutalSwal.fire({
			title: 'ACAK ULANG ANGGOTA?',
			text: 'SUSUNAN ANGGOTA AKAN DIACAK ULANG KE SELURUH KELOMPOK AKTIF.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, ACAK',
			cancelButtonText: 'BATAL',
		});

		if (!result.isConfirmed) return;

		setGroups((prev) => {
			const activeGroups = prev.filter((g) => String(g.id) !== 'excluded');
			if (activeGroups.length === 0) return prev;

			const allActiveMembers = activeGroups.flatMap((g) => g.members || []);
			if (allActiveMembers.length === 0) return prev;

			const shuffled = shuffleArray(allActiveMembers);
			const numGroups = activeGroups.length;
			const newActiveGroupsMap = new Map();
			activeGroups.forEach((g) => {
				newActiveGroupsMap.set(String(g.id), { ...g, members: [] });
			});

			shuffled.forEach((member, i) => {
				const targetGroup = activeGroups[i % numGroups];
				newActiveGroupsMap.get(String(targetGroup.id)).members.push(member);
			});

			return prev.map((g) => {
				if (String(g.id) === 'excluded') return g;
				return newActiveGroupsMap.get(String(g.id)) || g;
			});
		});
	};

	// 2. Tambah Kelompok Baru
	const handleAddGroup = async () => {
		const regularGroups = groups.filter((g) => String(g.id) !== 'excluded');
		const defaultName = `KELOMPOK ${regularGroups.length + 1}`;

		const result = await brutalSwal.fire({
			title: 'TAMBAH KELOMPOK',
			input: 'text',
			inputLabel: 'NAMA KELOMPOK BARU',
			inputValue: defaultName,
			showCancelButton: true,
			confirmButtonText: 'TAMBAH',
			cancelButtonText: 'BATAL',
			inputValidator: (value) => {
				if (!value || !value.trim()) {
					return 'Nama kelompok tidak boleh kosong!';
				}
				if (groups.some((g) => g.nama?.trim().toUpperCase() === value.trim().toUpperCase())) {
					return 'Nama kelompok sudah ada!';
				}
			},
		});

		if (!result.isConfirmed || !result.value) return;

		const newGroupName = result.value.trim().toUpperCase();
		const newGroupId = `new-group-${Date.now()}`;

		setGroups((prev) => {
			const excludedIndex = prev.findIndex((g) => String(g.id) === 'excluded');
			const newGroup = {
				id: newGroupId,
				nama: newGroupName,
				members: [],
			};

			if (excludedIndex !== -1) {
				const updated = [...prev];
				updated.splice(excludedIndex, 0, newGroup);
				return updated;
			} else {
				return [...prev, newGroup];
			}
		});
	};

	// 3. Ganti Nama Kelompok
	const handleRenameGroup = async (group) => {
		const result = await brutalSwal.fire({
			title: 'GANTI NAMA KELOMPOK',
			input: 'text',
			inputLabel: 'MASUKKAN NAMA BARU',
			inputValue: group.nama,
			showCancelButton: true,
			confirmButtonText: 'SIMPAN',
			cancelButtonText: 'BATAL',
			inputValidator: (value) => {
				if (!value || !value.trim()) {
					return 'Nama kelompok tidak boleh kosong!';
				}
				const trimmed = value.trim().toUpperCase();
				if (
					groups.some(
						(g) => String(g.id) !== String(group.id) && g.nama?.trim().toUpperCase() === trimmed
					)
				) {
					return 'Nama kelompok sudah ada!';
				}
			},
		});

		if (!result.isConfirmed || !result.value) return;

		const updatedName = result.value.trim().toUpperCase();
		setGroups((prev) =>
			prev.map((g) => (String(g.id) === String(group.id) ? { ...g, nama: updatedName } : g))
		);
	};

	// 4. Hapus Kelompok (Anggota dipindahkan aman ke 'excluded')
	const handleDeleteGroup = async (groupToDelete) => {
		const regularGroups = groups.filter((g) => String(g.id) !== 'excluded');
		if (regularGroups.length <= 1) {
			await brutalSwal.fire({
				icon: 'warning',
				title: 'TIDAK DAPAT DIHAPUS',
				text: 'Minimal harus ada 1 kelompok!',
			});
			return;
		}

		const memberCount = (groupToDelete.members || []).length;
		const confirmText =
			memberCount > 0
				? `Kelompok ini memiliki ${memberCount} anggota. Seluruh anggota akan dipindahkan ke "TIDAK MASUK KELOMPOK". Lanjutkan?`
				: `Hapus kelompok "${groupToDelete.nama}"?`;

		const result = await brutalSwal.fire({
			title: `HAPUS ${groupToDelete.nama}?`,
			text: confirmText,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS',
			cancelButtonText: 'BATAL',
			customClass: {
				...brutalCustomClass,
				confirmButton:
					'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
			},
		});

		if (!result.isConfirmed) return;

		setGroups((prev) => {
			const membersToMove = groupToDelete.members || [];
			let next = prev.filter((g) => String(g.id) !== String(groupToDelete.id));

			if (membersToMove.length > 0) {
				const excludedIndex = next.findIndex((g) => String(g.id) === 'excluded');
				if (excludedIndex !== -1) {
					next[excludedIndex] = {
						...next[excludedIndex],
						members: [...(next[excludedIndex].members || []), ...membersToMove],
					};
				} else {
					next.push({
						id: 'excluded',
						nama: 'TIDAK MASUK KELOMPOK',
						members: [...membersToMove],
					});
				}
			}

			return next;
		});
	};

	// 5. Pindah Anggota Langsung (Digunakan oleh Drag & Drop DAN Modal Pindah Cepat)
	const moveMemberDirectly = (memberId, fromGroupId, toGroupId) => {
		if (!memberId || !fromGroupId || !toGroupId) return;
		if (String(fromGroupId) === String(toGroupId)) return;

		setGroups((prev) => {
			const next = prev.map((g) => ({ ...g, members: [...(g.members || [])] }));

			const sourceIdx = next.findIndex((g) => String(g.id) === String(fromGroupId));
			const targetIdx = next.findIndex((g) => String(g.id) === String(toGroupId));
			if (sourceIdx === -1 || targetIdx === -1) return prev;

			const member = next[sourceIdx].members.find((m) => String(m.id) === String(memberId));
			if (!member) return prev;

			next[sourceIdx].members = next[sourceIdx].members.filter(
				(m) => String(m.id) !== String(memberId)
			);
			next[targetIdx].members.push(member);

			return next;
		});
	};

	// 6. Sensor DnD: Pointer + Touch
	const [activeDrag, setActiveDrag] = useState(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 200,
				tolerance: 8,
			},
		})
	);

	const regularGroups = useMemo(
		() => groups.filter((g) => String(g.id) !== 'excluded'),
		[groups]
	);
	const excludedGroup = useMemo(
		() => groups.find((g) => String(g.id) === 'excluded'),
		[groups]
	);
	const activeMembersCount = useMemo(
		() => regularGroups.reduce((acc, g) => acc + (g.members?.length || 0), 0),
		[regularGroups]
	);
	const excludedCount = excludedGroup?.members?.length || 0;
	const totalSiswa = activeMembersCount + excludedCount;

	const title = metaData?.judul_kegiatan || metaData?.judul || 'EDIT SUSUNAN GRUP';
	const kelas = metaData?.kelas_id || metaData?.kelas || 'KELAS';
	const mapel = metaData?.mapel_id || metaData?.mapel || null;

	const findMemberById = (memberId) => {
		for (const g of groups) {
			const m = g.members?.find((x) => String(x.id) === String(memberId));
			if (m) return m;
		}
		return null;
	};

	const handleDragStart = (event) => {
		const { active } = event;
		const memberId = active?.data?.current?.memberId;
		const fromGroupId = active?.data?.current?.fromGroupId;
		if (!memberId || !fromGroupId) return;
		setActiveDrag({ memberId, fromGroupId });
	};

	const handleDragEnd = (event) => {
		const { active, over } = event;
		setActiveDrag(null);

		const memberId = active?.data?.current?.memberId;
		const fromGroupId = active?.data?.current?.fromGroupId;
		const toGroupId = over?.id;

		moveMemberDirectly(memberId, fromGroupId, toGroupId);
	};

	// 7. Simpan Formasi ke Database
	const handleSave = async () => {
		setIsSaving(true);
		brutalSwal.fire({
			title: 'MENYIMPAN...',
			text: 'JANGAN TUTUP HALAMAN',
			allowOutsideClick: false,
			didOpen: () => Swal.showLoading(),
		});
		try {
			const dataToSave = regularGroups.map((g) => ({
				nama_grup: g.nama,
				metode_generate: metaData?.metode || 'manual',
				anggota_ids: g.members.map((m) => m.id),
			}));

			const isEditMode = !!sessionId;
			const url = '/api/grup';
			const method = isEditMode ? 'PUT' : 'POST';

			const payload = isEditMode
				? { id: sessionId, data_grup: dataToSave }
				: {
						judul_kegiatan: metaData.judul,
						kelas_id: metaData.kelas,
						mapel_id: metaData.mapel,
						data_grup: dataToSave,
						tahun_ajar: tahunAjarAktif,
						semester: semesterAktif,
				  };

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error('Gagal menyimpan');
			Swal.close();

			await brutalSwal.fire({
				icon: 'success',
				title: 'TERSIMPAN!',
				text: 'DATA BERHASIL DISIMPAN',
				timer: 1500,
				showConfirmButton: false,
			});

			if (isEditMode) {
				if (onBack) onBack();
				window.location.reload();
			} else {
				router.push('/grup');
			}
		} catch (error) {
			Swal.close();
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: error.message,
			});
		} finally {
			setIsSaving(false);
		}
	};

	const overlayMember = activeDrag?.memberId ? findMemberById(activeDrag.memberId) : null;

	return (
		<div className='w-full space-y-5'>
			{/* Mode Standalone (bukan tab): tampilkan Hero Banner lengkap */}
			{!isTabMode && (
				<div className='bg-[#FF90E8] border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-4 sm:p-6'>
					<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
						<div className='min-w-0 bg-white p-3.5 border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D]'>
							<h2 className='font-black text-xl md:text-2xl text-[#0D0D0D] uppercase tracking-wider truncate'>
								{title}
							</h2>
							<div className='flex flex-wrap items-center gap-2 mt-2'>
								<span className='bg-[#A3E635] px-2.5 py-1 border-[2px] border-[#0D0D0D] font-black text-xs uppercase'>
									{kelas}
								</span>
								{mapel && (
									<span className='bg-[#F5C518] px-2.5 py-1 border-[2px] border-[#0D0D0D] font-black text-xs uppercase'>
										{mapel}
									</span>
								)}
								<span className='bg-white px-2.5 py-1 border-[2px] border-[#0D0D0D] font-black text-xs uppercase'>
									{totalSiswa} SISWA
								</span>
								{excludedCount > 0 && (
									<span className='bg-[#FF90E8] px-2.5 py-1 border-[2px] border-[#0D0D0D] font-black text-xs uppercase'>
										{excludedCount} DIKECUALIKAN
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Smart Action Toolbar (Sticky on Scroll) */}
			<div className='bg-white border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] sm:shadow-[6px_6px_0px_0px_#0D0D0D] p-3 sm:p-4 sticky top-2 sm:top-4 z-20'>
				<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3'>
					{/* Status Counter Badges */}
					<div className='flex flex-wrap items-center gap-2'>
						<div className='flex items-center gap-1.5 px-2.5 py-1 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider'>
							<Users className='w-3.5 h-3.5 text-[#A3E635]' strokeWidth={3} />
							<span>{regularGroups.length} KELOMPOK</span>
						</div>

						<div className='px-2.5 py-1 bg-[#2F80ED] text-white border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider'>
							<span>{activeMembersCount} SISWA TERBAGI</span>
						</div>

						{excludedCount > 0 && (
							<div className='px-2.5 py-1 bg-[#FF90E8] text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider flex items-center gap-1'>
								<UserX className='w-3.5 h-3.5' strokeWidth={3} />
								<span>{excludedCount} DIKECUALIKAN</span>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className='flex flex-wrap items-center gap-2 sm:gap-2.5'>
						{onBack && (
							<button
								type='button'
								onClick={onBack}
								className='px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all'>
								BATAL
							</button>
						)}

						<button
							type='button'
							onClick={handleAddGroup}
							className='px-3 sm:px-4 py-2 sm:py-2.5 bg-[#A3E635] text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-1.5'>
							<Plus className='w-4 h-4' strokeWidth={3} />
							<span>+ KELOMPOK</span>
						</button>

						<button
							type='button'
							onClick={handleShuffle}
							className='px-3 sm:px-4 py-2 sm:py-2.5 bg-[#F5C518] text-[#0D0D0D] border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-1.5'>
							<Shuffle className='w-4 h-4' strokeWidth={3} />
							<span>ACAK ULANG</span>
						</button>

						<button
							type='button'
							onClick={handleSave}
							disabled={isSaving}
							className='px-4 sm:px-5 py-2 sm:py-2.5 bg-[#2F80ED] text-white border-[2px] sm:border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] sm:shadow-[3px_3px_0px_0px_#0D0D0D] font-black uppercase text-xs tracking-wider hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all flex items-center gap-1.5 disabled:opacity-60'>
							{isSaving ? (
								<Loader2 className='w-4 h-4 animate-spin' />
							) : (
								<Save className='w-4 h-4' strokeWidth={3} />
							)}
							<span>{sessionId ? 'SIMPAN PERUBAHAN' : 'SIMPAN'}</span>
						</button>
					</div>
				</div>
			</div>

			{/* Panduan Ringkas Strip */}
			<div className='bg-[#FFFDF0] border-[2px] sm:border-[3px] border-[#0D0D0D] p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center justify-between gap-3 text-xs text-[#0D0D0D]'>
				<div className='flex items-center gap-2.5 min-w-0'>
					<span className='p-1.5 bg-[#F5C518] border-[2px] border-[#0D0D0D] text-[#0D0D0D] shrink-0'>
						<Sparkles className='w-4 h-4' strokeWidth={3} />
					</span>
					<p className='font-bold uppercase tracking-wide leading-relaxed text-[11px] sm:text-xs'>
						<span className='font-black'>CARA ATUR:</span> Tahan & geser kartu siswa antar kelompok, atau klik ikon panah (⇄) pada kartu untuk pindah instan. Tarik ke kotak bawah untuk mengecualikan siswa.
					</p>
				</div>
			</div>

			{/* DnD Context Canvas */}
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				autoScroll={true}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}>
				
				{/* Grid Kelompok Aktif */}
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 items-start'>
					{regularGroups.map((group, idx) => (
						<DroppableGroupColumn
							key={group.id}
							group={group}
							index={idx}
							isHeterogen={metaData?.metode === 'heterogen'}
							onRenameGroup={handleRenameGroup}
							onDeleteGroup={handleDeleteGroup}>
							<div className='p-3 sm:p-4 min-h-[160px] space-y-2.5 bg-[#FFFDFB]'>
								{group.members.map((member, mIdx) => (
									<DraggableMemberCard
										key={member.id}
										member={member}
										fromGroupId={group.id}
										index={mIdx}
										onQuickMove={() => setQuickMoveTarget({ member, fromGroupId: group.id })}
									/>
								))}

								{group.members.length === 0 && (
									<div className='text-center py-10 border-[3px] border-dashed border-[#0D0D0D] bg-white'>
										<span className='font-black text-xs uppercase tracking-widest text-[#0D0D0D] bg-[#FF90E8] px-3 py-1 border-[2px] border-[#0D0D0D] rotate-1 inline-block shadow-[2px_2px_0px_0px_#0D0D0D]'>
											LEPAS SISWA DI SINI
										</span>
									</div>
								)}
							</div>
						</DroppableGroupColumn>
					))}

					{/* Tombol Tambah Kelompok di Akhir Grid */}
					<div
						onClick={handleAddGroup}
						className='min-h-[200px] border-[3px] sm:border-[4px] border-dashed border-[#0D0D0D] bg-white/70 hover:bg-white p-6 flex flex-col items-center justify-center gap-3 cursor-pointer shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#0D0D0D] transition-all group select-none'>
						<div className='p-3 bg-[#A3E635] border-[3px] border-[#0D0D0D] group-hover:scale-110 shadow-[3px_3px_0px_0px_#0D0D0D] transition-transform'>
							<Plus className='w-7 h-7 text-[#0D0D0D]' strokeWidth={3} />
						</div>
						<span className='font-black text-xs sm:text-sm uppercase tracking-wider text-[#0D0D0D] text-center'>
							+ TAMBAH KELOMPOK BARU
						</span>
					</div>
				</div>

				{/* Wadah Pengecualian Siswa ("TIDAK MASUK KELOMPOK") */}
				{excludedGroup && (
					<div className='mt-8 pt-6 border-t-[4px] border-dashed border-[#0D0D0D]'>
						<div className='bg-[#FF90E8]/10 border-[3px] sm:border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] overflow-hidden'>
							{/* Header Wadah Pengecualian */}
							<div className='p-3.5 sm:p-4 bg-[#FF90E8] border-b-[3px] sm:border-b-[4px] border-[#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
								<div className='flex items-center gap-2.5 min-w-0'>
									<span className='p-2 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D]'>
										<UserX className='w-4 h-4 sm:w-5 sm:h-5' strokeWidth={3} />
									</span>
									<div>
										<h3 className='font-black text-base sm:text-lg text-[#0D0D0D] uppercase tracking-wider'>
											TIDAK MASUK KELOMPOK / DIKECUALIKAN
										</h3>
										<p className='text-[10px] sm:text-xs font-bold text-[#0D0D0D] uppercase tracking-widest mt-0.5'>
											Siswa di wadah ini tidak akan terdaftar di kelompok manapun. Tarik siswa ke sini jika ingin mengecualikannya.
										</p>
									</div>
								</div>

								<div className='flex items-center gap-2 shrink-0'>
									<span className='px-3 py-1 bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D] font-black uppercase text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
										{excludedGroup.members?.length || 0} SISWA
									</span>
								</div>
							</div>

							{/* Drop Zone Wadah Pengecualian */}
							<DroppableExcludedContainer group={excludedGroup}>
								<div className='p-4 min-h-[140px]'>
									{excludedGroup.members?.length === 0 ? (
										<div className='w-full text-center py-8 border-[3px] border-dashed border-[#0D0D0D] bg-white'>
											<span className='font-black text-xs sm:text-sm uppercase tracking-widest text-[#0D0D0D] bg-[#A3E635] px-3 py-1.5 border-[2px] border-[#0D0D0D] rotate-1 inline-block shadow-[2px_2px_0px_0px_#0D0D0D]'>
												SEMUA SISWA AKTIF SUDAH MASUK KELOMPOK
											</span>
											<p className='text-[11px] font-bold text-[#0D0D0D]/60 uppercase tracking-widest mt-2'>
												Tarik kartu siswa ke area ini untuk mengecualikannya dari kelompok.
											</p>
										</div>
									) : (
										<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3'>
											{excludedGroup.members.map((member, mIdx) => (
												<DraggableMemberCard
													key={member.id}
													member={member}
													fromGroupId='excluded'
													index={mIdx}
													onQuickMove={() => setQuickMoveTarget({ member, fromGroupId: 'excluded' })}
												/>
											))}
										</div>
									)}
								</div>
							</DroppableExcludedContainer>
						</div>
					</div>
				)}

				{/* Drag Overlay: Kartu Mengambang yang Mengikuti Kursor/Sentuhan */}
				<DragOverlay>
					{overlayMember ? (
						<div className='bg-[#A3E635] border-[4px] border-[#0D0D0D] shadow-[10px_10px_0px_0px_#0D0D0D] p-3 w-[260px] rotate-3 opacity-95 scale-105 pointer-events-none'>
							<div className='font-black text-[#0D0D0D] uppercase tracking-wider text-sm truncate'>
								{overlayMember.nama}
							</div>
							{overlayMember.nis && (
								<div className='text-[10px] font-bold text-[#0D0D0D]/80 uppercase tracking-widest mt-0.5'>
									NIS: {overlayMember.nis}
								</div>
							)}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			{/* Modal Interaktif: Pindah Cepat Siswa (Mudah diakses via Ponsel/Sentuhan) */}
			{quickMoveTarget && (
				<div className='fixed inset-0 z-50 bg-[#0D0D0D]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150'>
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-md p-5 space-y-4'>
						<div className='flex items-center justify-between border-b-[3px] border-[#0D0D0D] pb-3'>
							<div>
								<span className='text-[10px] font-black uppercase tracking-widest bg-[#A3E635] px-2 py-0.5 border-[2px] border-[#0D0D0D]'>
									PINDAH KELOMPOK CEPAT
								</span>
								<h4 className='font-black text-lg text-[#0D0D0D] uppercase mt-1 truncate'>
									{quickMoveTarget.member.nama}
								</h4>
							</div>
							<button
								onClick={() => setQuickMoveTarget(null)}
								className='p-1.5 border-[2px] border-[#0D0D0D] hover:bg-gray-100 transition-colors'>
								<X className='w-4 h-4' strokeWidth={3} />
							</button>
						</div>

						<p className='text-xs font-bold text-[#0D0D0D] uppercase tracking-wider'>
							Pilih kelompok tujuan:
						</p>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1'>
							{groups.map((targetGroup, tIdx) => {
								const isCurrent = String(targetGroup.id) === String(quickMoveTarget.fromGroupId);
								const isTargetExcluded = String(targetGroup.id) === 'excluded';
								const color = isTargetExcluded
									? '#FF90E8'
									: GROUP_COLORS[tIdx % GROUP_COLORS.length].bg;

								return (
									<button
										key={targetGroup.id}
										disabled={isCurrent}
										onClick={() => {
											moveMemberDirectly(
												quickMoveTarget.member.id,
												quickMoveTarget.fromGroupId,
												targetGroup.id
											);
											setQuickMoveTarget(null);
										}}
										className={`p-3 text-left border-[3px] border-[#0D0D0D] font-black uppercase tracking-wider text-xs transition-all flex items-center justify-between gap-2 ${
											isCurrent
												? 'opacity-40 bg-gray-200 cursor-not-allowed'
												: 'hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none'
										}`}
										style={{ backgroundColor: isCurrent ? undefined : color }}>
										<span className='truncate'>{targetGroup.nama}</span>
										{isCurrent ? (
											<span className='text-[9px] bg-[#0D0D0D] text-white px-1.5 py-0.5'>
												SAAT INI
											</span>
										) : (
											<ArrowRight className='w-3.5 h-3.5 shrink-0' strokeWidth={3} />
										)}
									</button>
								);
							})}
						</div>

						<div className='pt-2 border-t-[2px] border-[#0D0D0D] flex justify-end'>
							<button
								onClick={() => setQuickMoveTarget(null)}
								className='px-4 py-2 border-[2px] border-[#0D0D0D] font-black uppercase text-xs hover:bg-gray-100 transition-colors'>
								TUTUP
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

// Komponen Kolom Grup (Droppable Target)
function DroppableGroupColumn({
	group,
	index = 0,
	isHeterogen,
	onRenameGroup,
	onDeleteGroup,
	children,
}) {
	const { isOver, setNodeRef } = useDroppable({ id: String(group.id) });
	const color = GROUP_COLORS[index % GROUP_COLORS.length];

	return (
		<div
			ref={setNodeRef}
			className={`bg-white rounded-none border-[3px] sm:border-[4px] shadow-[6px_6px_0px_0px_#0D0D0D] flex flex-col transition-all overflow-hidden ${
				isOver
					? 'border-[#2F80ED] ring-4 ring-[#2F80ED]/30 scale-[1.01] shadow-[8px_8px_0px_0px_#2F80ED]'
					: 'border-[#0D0D0D]'
			}`}>
			{/* Card Header dengan Warna Pastel Variatif */}
			<div
				style={{ backgroundColor: color.bg }}
				className='p-3 sm:p-4 border-b-[3px] sm:border-b-[4px] border-[#0D0D0D] flex items-center justify-between gap-2 relative overflow-hidden'>
				
				<div className='min-w-0 flex items-center gap-1.5 sm:gap-2'>
					<h3 className='font-black text-base sm:text-lg text-[#0D0D0D] uppercase tracking-wider truncate'>
						{group.nama}
					</h3>
					{onRenameGroup && (
						<button
							type='button'
							onClick={() => onRenameGroup(group)}
							title='Ganti nama kelompok'
							className='p-1 bg-white/80 hover:bg-white border-[2px] border-[#0D0D0D] shadow-[1px_1px_0px_0px_#0D0D0D] hover:-translate-y-0.5 transition-all'>
							<Edit2 className='w-3 h-3 text-[#0D0D0D]' strokeWidth={3} />
						</button>
					)}
				</div>

				<div className='flex items-center gap-1.5 sm:gap-2 shrink-0'>
					<span className='bg-white text-[#0D0D0D] text-xs font-black px-2.5 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase tracking-wider'>
						{group.members?.length || 0} SISWA
					</span>

					{isHeterogen && (
						<span className='bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] text-[10px] font-black px-2 py-0.5 uppercase tracking-widest hidden sm:inline-block'>
							AVG: {(group.members.reduce((acc, m) => acc + (parseFloat(m.avg) || 0), 0) / (group.members.length || 1)).toFixed(1)}
						</span>
					)}

					{onDeleteGroup && (
						<button
							type='button'
							onClick={() => onDeleteGroup(group)}
							title={`Hapus ${group.nama}`}
							className='p-1.5 bg-[#E8451A] text-white border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all cursor-pointer'
							aria-label={`Hapus ${group.nama}`}>
							<Trash2 className='w-3.5 h-3.5' strokeWidth={3} />
						</button>
					)}
				</div>
			</div>

			{children}
		</div>
	);
}

// Komponen Kartu Siswa yang Bisa Digeser (Draggable Member Card)
function DraggableMemberCard({ member, fromGroupId, index = 0, onQuickMove }) {
	const id = `member-${member.id}`;

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
		id,
		data: { memberId: member.id, fromGroupId },
	});

	const style = {
		transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`bg-white rounded-none border-[2px] sm:border-[3px] border-[#0D0D0D] p-2.5 sm:p-3 select-none hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] transition-all group ${
				isDragging ? 'opacity-25' : ''
			}`}>
			<div className='flex items-center justify-between gap-2 sm:gap-2.5'>
				{/* Nomor Urut + Nama Siswa + NIS */}
				<div className='flex items-center gap-2 sm:gap-2.5 min-w-0'>
					<span className='w-6 h-6 bg-[#0D0D0D] text-white flex items-center justify-center font-black text-[11px] shrink-0 border-[2px] border-[#0D0D0D]'>
						{index + 1}
					</span>
					<div className='min-w-0'>
						<p className='font-black text-[#0D0D0D] uppercase tracking-wider text-xs sm:text-sm truncate'>
							{member.nama}
						</p>
						{member.nis && (
							<p className='text-[10px] font-bold text-[#0D0D0D]/60 uppercase tracking-widest mt-0.5'>
								NIS: {member.nis}
							</p>
						)}
					</div>
				</div>

				{/* Aksi: Nilai (jika ada) + Tombol Pindah Cepat + Grip Handle */}
				<div className='flex items-center gap-1.5 shrink-0'>
					{typeof member.avg !== 'undefined' && (
						<span className='text-[10px] font-black px-1.5 py-0.5 border-[2px] border-[#0D0D0D] bg-[#FFF5F0] text-[#0D0D0D] uppercase'>
							{parseFloat(member.avg).toFixed(1)}
						</span>
					)}

					{onQuickMove && (
						<button
							type='button'
							onClick={(e) => {
								e.stopPropagation();
								onQuickMove(member, fromGroupId);
							}}
							title='Pindah Cepat ke Kelompok Lain'
							className='p-1.5 bg-[#F5C518] hover:bg-[#F5C518]/80 text-[#0D0D0D] border-[2px] border-[#0D0D0D] shadow-[1px_1px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 transition-all'>
							<ArrowRightLeft className='h-3.5 w-3.5' strokeWidth={3} />
						</button>
					)}

					<button
						type='button'
						{...listeners}
						{...attributes}
						style={{ touchAction: 'none' }}
						className='p-1.5 sm:p-2 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] group-hover:bg-[#FF90E8] group-hover:text-[#0D0D0D] transition-colors cursor-grab active:cursor-grabbing'
						aria-label='Tahan dan tarik'>
						<GripVertical className='h-3.5 w-3.5 sm:h-4 sm:w-4' strokeWidth={3} />
					</button>
				</div>
			</div>
		</div>
	);
}

// Wadah Khusus Siswa Dikecualikan
function DroppableExcludedContainer({ group, children }) {
	const { isOver, setNodeRef } = useDroppable({ id: 'excluded' });

	return (
		<div
			ref={setNodeRef}
			className={`transition-all ${
				isOver ? 'bg-pink-100 ring-4 ring-[#FF90E8] border-[3px] border-[#FF90E8]' : 'bg-transparent'
			}`}>
			{children}
		</div>
	);
}

export default DragDropBoard;
