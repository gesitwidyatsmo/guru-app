'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, TouchSensor, useDroppable, useDraggable, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core';
import Swal from 'sweetalert2';
import { swalProcess, swalSuccess, swalError } from '@/lib/swal';
import { useAcademic } from '@/context/AcademicContext';

// Neobrutalism SweetAlert Mixin
const brutalSwal = Swal.mixin({
	customClass: {
		popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
		title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
		htmlContainer: 'font-bold text-[#0D0D0D]',
		confirmButton: 'bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
		cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
	},
	buttonsStyling: false
});

const DragDropBoard = ({ initialGroups, metaData, onBack, sessionId }) => {
	const router = useRouter();
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [groups, setGroups] = useState(initialGroups);
	const [isSaving, setIsSaving] = useState(false);

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

	const handleShuffle = async () => {
		const result = await brutalSwal.fire({
			title: 'ACAK ULANG ANGGOTA?',
			text: 'SUSUNAN ANGGOTA AKAN DIACAK ULANG.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, ACAK',
			cancelButtonText: 'BATAL',
		});

		if (!result.isConfirmed) return;

		setGroups((prev) => {
			// ambil semua member
			const allMembers = prev.flatMap((g) => g.members || []);
			const shuffled = shuffleArray(allMembers);

			// jaga ukuran tiap grup tetap sama seperti sebelumnya
			let idx = 0;
			return prev.map((g) => {
				const size = (g.members || []).length;
				const nextMembers = shuffled.slice(idx, idx + size);
				idx += size;
				return { ...g, members: nextMembers };
			});
		});
	};

	// dragged = { memberId, fromGroupId }
	const [activeDrag, setActiveDrag] = useState(null);

	// Sensors: touch + pointer (mobile + desktop)
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				tolerance: 5, // masih boleh geser dikit saat nahan
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 300, // tahan 1 detik baru bisa drag
				tolerance: 5, // masih boleh geser dikit saat nahan
			},
		}),
	);

	const totalSiswa = useMemo(() => groups.reduce((acc, g) => acc + (g.members?.length || 0), 0), [groups]);

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

		if (!memberId || !fromGroupId || !toGroupId) return;
		if (String(fromGroupId) === String(toGroupId)) return;

		setGroups((prev) => {
			const next = prev.map((g) => ({ ...g, members: [...(g.members || [])] }));

			const sourceIdx = next.findIndex((g) => String(g.id) === String(fromGroupId));
			const targetIdx = next.findIndex((g) => String(g.id) === String(toGroupId));
			if (sourceIdx === -1 || targetIdx === -1) return prev;

			const member = next[sourceIdx].members.find((m) => String(m.id) === String(memberId));
			if (!member) return prev;

			next[sourceIdx].members = next[sourceIdx].members.filter((m) => String(m.id) !== String(memberId));
			next[targetIdx].members.push(member);

			return next;
		});
	};

	const handleSave = async () => {
		setIsSaving(true);
		brutalSwal.fire({
			title: 'MENYIMPAN...',
			text: 'JANGAN TUTUP HALAMAN',
			allowOutsideClick: false,
			didOpen: () => Swal.showLoading()
		});
		try {
			const dataToSave = groups
				.filter((g) => String(g.id) !== 'excluded')
				.map((g) => ({
					nama_grup: g.nama,
					metode_generate: metaData.metode || 'manual',
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
				showConfirmButton: false
			});

			if (isEditMode) {
				onBack();
				window.location.reload();
			} else {
				router.push('/grup');
			}
		} catch (error) {
			Swal.close();
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: error.message
			});
		} finally {
			setIsSaving(false);
		}
	};

	const overlayMember = activeDrag?.memberId ? findMemberById(activeDrag.memberId) : null;

	return (
		<div className='w-full'>
			{/* Toolbar */}
			<div className='bg-[#FF90E8] border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] p-5 mb-8'>
				<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
					<div className='min-w-0 bg-white p-3 border-[3px] border-[#0D0D0D]'>
						<h2 className='font-black text-xl md:text-2xl text-[#0D0D0D] uppercase tracking-widest truncate'>{title}</h2>
						<p className='text-xs font-bold text-[#0D0D0D] uppercase tracking-widest mt-1'>
							<span className='bg-[#A3E635] px-2 py-1 border-[2px] border-[#0D0D0D] mr-2'>{kelas}</span>
							{mapel ? <span className='bg-[#F5C518] px-2 py-1 border-[2px] border-[#0D0D0D] mr-2'>{mapel}</span> : null}
							<span className='bg-white px-2 py-1 border-[2px] border-[#0D0D0D]'>{totalSiswa} SISWA</span>
						</p>
					</div>

					<div className='flex flex-col sm:flex-row gap-3'>
						{onBack && (
							<button
								onClick={onBack}
								className='px-6 py-3 h-[50px] rounded-none border-[3px] border-[#0D0D0D] bg-white text-[#0D0D0D] font-black uppercase tracking-widest hover:-translate-y-1 shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center'>
								KEMBALI
							</button>
						)}

						<button
							type='button'
							onClick={handleShuffle}
							className='px-6 py-3 h-[50px] rounded-none border-[3px] border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] font-black uppercase tracking-widest hover:-translate-y-1 shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center'>
							ACAK ULANG
						</button>

						<button
							onClick={handleSave}
							disabled={isSaving}
							className='inline-flex items-center justify-center gap-2 px-6 py-3 h-[50px] rounded-none bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest hover:-translate-y-1 shadow-[4px_4px_0px_0px_#0D0D0D] transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#0D0D0D]'>
							{isSaving ? <Loader2 className='animate-spin w-5 h-5' /> : <Save className='w-5 h-5' strokeWidth={3} />}
							{sessionId ? 'SIMPAN PERUBAHAN' : 'SIMPAN'}
						</button>
					</div>
				</div>
			</div>

			{/* DnD Context (autoScroll aktif) */}
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				autoScroll={true}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}>
				{/* Board */}
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start mb-6'>
					{groups.filter(g => String(g.id) !== 'excluded').map((group) => (
						<DroppableGroupColumn
							key={group.id}
							group={group}
							isHeterogen={metaData?.metode === 'heterogen'}>
							<div className='p-4 min-h-[150px] space-y-3 bg-[#FFF5F0]'>
								{group.members.map((member) => (
									<DraggableMemberCard
										key={member.id}
										member={member}
										fromGroupId={group.id}
									/>
								))}

								{group.members.length === 0 && (
									<div className='text-center py-10 border-[3px] border-dashed border-[#0D0D0D] bg-white'>
										<span className='font-black text-sm uppercase tracking-widest text-[#0D0D0D] bg-[#FF90E8] px-3 py-1 border-[2px] border-[#0D0D0D] rotate-2 inline-block'>LEPAS DI SINI</span>
									</div>
								)}
							</div>
						</DroppableGroupColumn>
					))}
				</div>

				{/* Pengecualian Siswa (jika ada) */}
				{groups.find(g => String(g.id) === 'excluded') && (
					<div className='mt-8 pt-8 border-t-[6px] border-dashed border-[#0D0D0D]'>
						<DroppableGroupColumn
							group={groups.find(g => String(g.id) === 'excluded')}
							isHeterogen={metaData?.metode === 'heterogen'}>
							<div className='p-4 min-h-[150px] bg-gray-50 flex flex-wrap gap-3'>
								{groups.find(g => String(g.id) === 'excluded').members.map((member) => (
									<div key={member.id} className='w-full md:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)]'>
										<DraggableMemberCard
											member={member}
											fromGroupId={'excluded'}
										/>
									</div>
								))}

								{groups.find(g => String(g.id) === 'excluded').members.length === 0 && (
									<div className='w-full text-center py-10 border-[3px] border-dashed border-[#0D0D0D] bg-white'>
										<span className='font-black text-sm uppercase tracking-widest text-[#0D0D0D] bg-[#A3E635] px-3 py-1 border-[2px] border-[#0D0D0D] rotate-2 inline-block'>LEPAS DI SINI UNTUK MENGECUALIKAN SISWA</span>
									</div>
								)}
							</div>
						</DroppableGroupColumn>
					</div>
				)}

				{/* Drag overlay (ghost card yang mengikuti jari/mouse) */}
				<DragOverlay>
					{overlayMember ? (
						<div className='bg-[#A3E635] rounded-none border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-4 w-[280px] rotate-3 opacity-90 scale-105'>
							<div className='font-black text-[#0D0D0D] uppercase tracking-widest text-lg truncate mb-2'>{overlayMember.nama}</div>
							{typeof overlayMember.avg !== 'undefined' && (
								<div className='inline-block text-xs font-bold text-[#0D0D0D] bg-white px-2 py-1 border-[2px] border-[#0D0D0D] uppercase tracking-widest'>NILAI: {parseFloat(overlayMember.avg).toFixed(1)}</div>
							)}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
};

function DroppableGroupColumn({ group, isHeterogen, children }) {
	const { isOver, setNodeRef } = useDroppable({ id: String(group.id) });
	const isExcluded = String(group.id) === 'excluded';

	return (
		<div
			ref={setNodeRef}
			className={`${isExcluded ? 'bg-gray-100' : 'bg-white'} rounded-none border-[4px] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col transition-all overflow-hidden ${isOver ? 'border-[#2F80ED] scale-[1.02] shadow-[12px_12px_0px_0px_#2F80ED]' : 'border-[#0D0D0D]'}`}>
			<div className={`p-4 border-b-[4px] border-[#0D0D0D] ${isExcluded ? 'bg-[#FF90E8]' : 'bg-white'} flex items-center justify-between gap-3 relative overflow-hidden`}>
				{/* Deco bg */}
				<div className={`absolute -right-4 -top-4 w-16 h-16 ${isExcluded ? 'bg-white' : 'bg-[#F5C518]'} border-[3px] border-[#0D0D0D] rotate-12 z-0`}></div>
				
				<div className='min-w-0 relative z-10'>
					<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest truncate'>{group.nama}</h3>
					<p className='text-[10px] font-bold text-[#0D0D0D] bg-[#A3E635] px-1 border-[2px] border-[#0D0D0D] inline-block mt-1'>DRAG & DROP ANTAR GRUP</p>
				</div>
				<div className='flex flex-col items-end gap-2 relative z-10'>
					<span className='bg-[#0D0D0D] text-white text-sm font-black px-3 py-1 border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#E8451A] text-center min-w-[3rem]'>{group.members.length}</span>
					{isHeterogen && (
						<span className='bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D] text-[10px] font-black px-2 py-0.5 uppercase tracking-widest shadow-[2px_2px_0px_0px_#0D0D0D]'>
							AVG: {(group.members.reduce((acc, m) => acc + (parseFloat(m.avg) || 0), 0) / (group.members.length || 1)).toFixed(1)}
						</span>
					)}
				</div>
			</div>

			{children}
		</div>
	);
}

function DraggableMemberCard({ member, fromGroupId }) {
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
			className={`bg-white rounded-none border-[3px] border-[#0D0D0D] p-3 select-none hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-0' : ''}`}>
			<div className='flex items-center justify-between gap-3'>
				<div className='min-w-0'>
					<div className='font-black text-[#0D0D0D] uppercase tracking-widest text-sm truncate'>{member.nama}</div>
				</div>

				<div className='flex items-center gap-2 shrink-0'>
					{typeof member.avg !== 'undefined' && (
						<span className='text-[10px] font-bold px-2 py-1 border-[2px] border-[#0D0D0D] whitespace-nowrap bg-[#FFF5F0] text-[#0D0D0D] uppercase'>
							{parseFloat(member.avg).toFixed(1)}
						</span>
					)}

					<button
						type='button'
						{...listeners}
						{...attributes}
						style={{ touchAction: 'none' }}
						className='p-2 bg-[#0D0D0D] text-white border-[2px] border-[#0D0D0D] group-hover:bg-[#FF90E8] group-hover:text-[#0D0D0D] transition-colors'
						aria-label='Tahan dan tarik'>
						<GripVertical className='h-4 w-4' strokeWidth={3} />
					</button>
				</div>
			</div>
		</div>
	);
}

export default DragDropBoard;
