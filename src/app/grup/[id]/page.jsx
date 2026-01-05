'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Edit3, Download, Printer, MoreHorizontal, Share2, Trash2, Save, Calendar, BookOpen, Layers } from 'lucide-react';
import DragDropBoard from '@/app/components/DragDropBoard'; // Pastikan path benar
import ButtonBack from '@/app/components/button/ButtonBack';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { swalConfirmDelete, swalProcess, swalSuccess, swalError } from '@/lib/swal';

export default function DetailGrupPage() {
	const { id } = useParams();
	const router = useRouter();

	const [sessionData, setSessionData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('overview');
	const [isDeleting, setIsDeleting] = useState(false);

	// Fetch Data Detail Grup by ID
	useEffect(() => {
		fetch('/api/grup')
			.then((res) => res.json())
			.then((allGroups) => {
				const found = allGroups.find((g) => g.id === id);
				if (found) setSessionData(found);
				setLoading(false);
			});
	}, [id]);

	if (loading) return <Loader />;

	if (!sessionData)
		return (
			<div className='min-h-screen bg-slate-50 p-6'>
				<div className='max-w-6xl mx-auto'>
					<div className='bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center'>
						<div className='mx-auto mb-3 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center'>
							<Layers className='w-6 h-6 text-slate-400' />
						</div>
						<p className='text-slate-700 font-semibold'>Data tidak ditemukan</p>
						<p className='text-slate-500 text-sm mt-1'>Coba kembali ke daftar dan pilih grup lain.</p>
						<button
							onClick={() => router.push('/grup')}
							className='mt-5 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'>
							Kembali ke Daftar
						</button>
					</div>
				</div>
			</div>
		);

	// Transform data_json (raw) ke format yang bisa dibaca UI
	// Asumsi API mengembalikan 'raw_json' berisi array kelompok
	const groups = sessionData.raw_json || [];

	// Fungsi Hapus
	const handleDelete = async () => {
		const result = await swalConfirmDelete('Hapus grup ini?', 'Data grup akan dihapus permanen.');
		if (!result.isConfirmed) return;

		swalProcess('Menghapus...', 'Jangan tutup halaman');
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/grup?id=${id}`, {
				method: 'DELETE',
			});

			if (!res.ok) throw new Error('Gagal menghapus');

			Swal.close();
			await swalSuccess('Terhapus', 'Data berhasil dihapus');
			router.push('/grup');
		} catch (err) {
			Swal.close();
			await swalError('Gagal', error.message);
			setIsDeleting(false);
		}
	};

	return (
		<div className='min-h-screen bg-slate-50 p-5 md:p-8 text-slate-900'>
			{/* Header */}
			<div className='max-w-6xl mx-auto mb-6 md:mb-8 space-y-4'>
				<div onClick={() => router.back()}>
					<ButtonBack />
				</div>

				<div className='bg-white rounded-2xl shadow-sm border border-slate-200/70 p-5 md:p-6'>
					<div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5'>
						{/* Title + Meta */}
						<div className='min-w-0'>
							<h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 truncate'>{sessionData.judul_kegiatan}</h1>

							<div className='flex flex-wrap items-center gap-2.5 mt-3 text-sm'>
								<span className='inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 px-3 py-1 font-semibold'>{sessionData.kelas_id}</span>

								<span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-600 px-3 py-1'>
									<Users className='w-4 h-4 text-slate-400' />
									<span className='font-medium'>{sessionData.total_siswa} Siswa</span>
								</span>

								<span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-600 px-3 py-1'>
									<BookOpen className='w-4 h-4 text-slate-400' />
									<span className='font-medium'>{sessionData.mapel_id}</span>
								</span>

								<span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-600 px-3 py-1'>
									<Calendar className='w-4 h-4 text-slate-400' />
									<span className='font-medium'>{sessionData.tanggal}</span>
								</span>
							</div>
						</div>

						{/* Actions + Tab */}
						<div className='flex gap-3 lg:items-end justify-center'>
							{/* Segmented tab */}
							<div className='inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 self-start sm:self-auto'>
								<button
									onClick={() => setActiveTab('overview')}
									className={['px-3 py-2 rounded-lg text-sm font-semibold transition', activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'].join(' ')}>
									Overview
								</button>
								<button
									onClick={() => setActiveTab('edit')}
									className={['px-3 py-2 rounded-lg text-sm font-semibold transition', activeTab === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'].join(' ')}>
									Edit Susunan
								</button>
							</div>

							<button
								onClick={handleDelete}
								disabled={isDeleting}
								className='inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-white text-rose-700 font-semibold hover:bg-rose-50 hover:border-rose-300 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2'>
								<Trash2 className='w-4 h-4' />
								{isDeleting ? 'Menghapus...' : 'Hapus'}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className='max-w-6xl mx-auto'>
				{activeTab === 'overview' ? (
					<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
						{groups.map((group, idx) => (
							<div
								key={idx}
								className='bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden hover:shadow-md transition'>
								{/* Card header */}
								<div className='p-4 bg-gradient-to-r from-white to-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3'>
									<div className='min-w-0'>
										<h3 className='font-bold text-slate-900 truncate'>{group.nama_grup || `Grup ${idx + 1}`}</h3>
										<p className='text-xs text-slate-500 mt-0.5'>Kelompok siswa</p>
									</div>
									<span className='shrink-0 text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 font-semibold'>{group.anggota_ids?.length || 0} Anggota</span>
								</div>

								{/* Members */}
								<div className='p-4'>
									<ul className=''>
										{group.members?.map((member, mIdx) => (
											<li
												key={mIdx}
												className='flex items-center gap-3 rounded-xl hover:bg-slate-50 transition p-2 -mx-2'>
												<div className='w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-extrabold border border-indigo-100'>{getInitials(member.nama)}</div>
												<div className='min-w-0'>
													<p className='text-sm font-semibold text-slate-900 truncate'>{member.nama}</p>
													{/* <p className="text-xs text-slate-500 truncate">NIS: {member.nis}</p> */}
												</div>
											</li>
										))}
									</ul>

									{!group.members?.length && <div className='text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 mt-2'>Belum ada anggota di grup ini.</div>}
								</div>
							</div>
						))}
					</div>
				) : (
					<div className='bg-white rounded-2xl shadow-sm border border-slate-200/70 p-1 h-full overflow-hidden'>
						<DragDropBoard
							initialGroups={transformDataForBoard(groups)}
							metaData={{
								judul: sessionData.judul_kegiatan,
								kelas: sessionData.kelas_id,
							}}
							sessionId={id}
							onBack={() => setActiveTab('overview')}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

// Helper: Ambil inisial nama (Budi Santoso -> BS)
function getInitials(name) {
	if (!name) return '?';
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.substring(0, 2)
		.toUpperCase();
}

// Helper: Transform data json simpanan kembali ke format Board
function transformDataForBoard(savedGroups) {
	return savedGroups.map((g, i) => ({
		id: `g-edit-${i}`,
		nama: g.nama_grup,
		members: g.members || [],
	}));
}
