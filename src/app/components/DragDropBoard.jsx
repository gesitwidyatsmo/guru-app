'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, TouchSensor, useDroppable, useDraggable, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core';
import Swal from 'sweetalert2';
import { swalProcess, swalSuccess, swalError } from '@/lib/swal';

const DragDropBoard = ({ initialGroups, metaData, onBack, sessionId }) => {
	const router = useRouter();
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
		const result = await Swal.fire({
			title: 'Acak ulang anggota?',
			text: 'Susunan anggota akan diacak ulang.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, acak',
			cancelButtonText: 'Batal',
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

	const title = metaData?.judul_kegiatan || metaData?.judul || 'Edit Susunan Grup';
	const kelas = metaData?.kelas_id || metaData?.kelas || 'Kelas';
	const mapel = metaData?.mapel_id || metaData?.mapel || null;

	const findMemberById = (memberId) => {
		for (const g of groups) {
			const m = g.members?.find((x) => String(x.id) === String(memberId));
			if (m) return m;
		}
		return null;
	};

	const findGroupByMemberId = (memberId) => {
		return groups.find((g) => g.members?.some((x) => String(x.id) === String(memberId)));
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
		swalProcess('Menyimpan...', 'Jangan tutup halaman');
		try {
			const dataToSave = groups.map((g) => ({
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
				  };

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error('Gagal menyimpan');
			Swal.close();
			await swalSuccess('Tersimpan', 'Data berhasil disimpan');

			if (isEditMode) {
				onBack();
				window.location.reload();
			} else {
				router.push('/grup');
			}
		} catch (error) {
			Swal.close();
			await swalError('Gagal', error.message);
		} finally {
			setIsSaving(false);
		}
	};

	const overlayMember = activeDrag?.memberId ? findMemberById(activeDrag.memberId) : null;

	return (
		<div className='w-full'>
			{/* Toolbar */}
			<div className='bg-white border border-slate-200/70 rounded-2xl shadow-sm p-4 md:p-5 mb-6'>
				<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
					<div className='min-w-0'>
						<h2 className='font-bold text-lg md:text-xl text-slate-900 truncate'>{title}</h2>
						<p className='text-sm text-slate-500 mt-0.5'>
							<span className='font-medium text-slate-700'>{kelas}</span>
							{mapel ? <span> • {mapel}</span> : null}
							<span> • {totalSiswa} siswa</span>
						</p>
					</div>

					<div className='flex flex-col sm:flex-row gap-2'>
						<button
							onClick={onBack}
							className='px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'>
							Kembali
						</button>

						<button
							type='button'
							onClick={handleShuffle}
							className='px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition'>
							Acak ulang
						</button>

						<button
							onClick={handleSave}
							disabled={isSaving}
							className='inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition
                         shadow-sm hover:shadow-emerald-200/60 disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'>
							{isSaving ? <Loader2 className='animate-spin w-4 h-4' /> : <Save className='w-4 h-4' />}
							{sessionId ? 'Simpan Perubahan' : 'Simpan'}
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
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
					{groups.map((group) => (
						<DroppableGroupColumn
							key={group.id}
							group={group}>
							<div className='space-y-2 p-3'>
								{group.members.map((member) => (
									<DraggableMemberCard
										key={member.id}
										member={member}
										fromGroupId={group.id}
									/>
								))}

								{group.members.length === 0 && (
									<div className='text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-slate-50'>Lepas di sini untuk memindahkan siswa</div>
								)}
							</div>
						</DroppableGroupColumn>
					))}
				</div>

				{/* Drag overlay (ghost card yang mengikuti jari/mouse) */}
				<DragOverlay>
					{overlayMember ? (
						<div className='bg-white rounded-xl border border-slate-200 shadow-2xl p-3 w-[260px] scale-[1.03]'>
							<div className='font-semibold text-slate-900 text-sm truncate'>{overlayMember.nama}</div>
							{typeof overlayMember.nilai !== 'undefined' && <div className='text-xs text-slate-500 mt-1'>Nilai: {overlayMember.nilai}</div>}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
};

function DroppableGroupColumn({ group, children }) {
	const { isOver, setNodeRef } = useDroppable({ id: String(group.id) });

	return (
		<div
			ref={setNodeRef}
			className={['bg-white rounded-2xl border shadow-sm flex flex-col transition', isOver ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-200/70'].join(' ')}>
			<div className='p-5 border-b rounded-2xl border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-3'>
				<div className='min-w-0'>
					<h3 className='font-bold text-lg text-slate-900 truncate'>{group.nama}</h3>
					<p className='text-xs text-slate-500 mt-1'>Drag & drop antar grup</p>
				</div>
				<span className='bg-slate-100 text-slate-700 text-sm font-bold px-3 py-1 rounded-full'>{group.members.length}</span>
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
		// touchAction: 'none',
		transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={['bg-white rounded-xl border border-slate-200 p-3 select-none', 'hover:border-indigo-200 hover:shadow-sm transition', isDragging ? 'opacity-0' : ''].join(' ')}>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='font-semibold text-slate-900 text-sm truncate'>{member.nama}</div>
				</div>

				<button
					type='button'
					{...listeners}
					{...attributes}
					style={{ touchAction: 'none' }}
					className='ml-2 p-1 rounded-lg bg-slate-50 cursor-grab active:cursor-grabbing text-slate-700'
					aria-label='Tahan 1 detik lalu tarik untuk memindahkan'>
					<GripVertical className='h-5 w-5' />
				</button>

				{/* {typeof member.nilai !== 'undefined' && (
					<span
						className={[
							'text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
							member.nilai >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : member.nilai >= 60 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100',
						].join(' ')}>
						{member.nilai}
					</span>
				)} */}
			</div>
		</div>
	);
}

export default DragDropBoard;
