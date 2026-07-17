'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, Trash2, Calendar, BookOpen, Layers, ChevronLeft } from 'lucide-react';
import DragDropBoard from '@/app/components/DragDropBoard';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { swalProcess, swalSuccess, swalError } from '@/lib/swal';

// Neobrutalism SweetAlert Mixin
const brutalSwal = Swal.mixin({
	customClass: {
		popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-[#FFF5F0]',
		title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
		htmlContainer: 'font-bold text-[#0D0D0D]',
		confirmButton: 'bg-[#E8451A] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3 mr-3',
		cancelButton: 'bg-white text-[#0D0D0D] font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all px-6 py-3'
	},
	buttonsStyling: false
});

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
			<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-6 pt-12 flex justify-center'>
				<div className='max-w-2xl w-full'>
					<div className='bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-10 text-center flex flex-col items-center'>
						<div className='mb-6 bg-[#E8451A] p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<Layers className='w-10 h-10 text-white' strokeWidth={3} />
						</div>
						<p className='text-2xl text-[#0D0D0D] font-black uppercase tracking-widest bg-[#F5C518] px-4 py-2 border-[4px] border-[#0D0D0D] rotate-2'>DATA TIDAK DITEMUKAN</p>
						<p className='text-[#0D0D0D] font-bold uppercase tracking-widest mt-4'>Coba kembali ke daftar dan pilih grup lain.</p>
						<button
							onClick={() => router.push('/grup')}
							className='mt-8 h-[60px] px-8 bg-[#2F80ED] text-white font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] rounded-none hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D]'>
							KEMBALI KE DAFTAR
						</button>
					</div>
				</div>
			</div>
		);

	const groups = sessionData.raw_json || [];

	const handleDelete = async () => {
		const result = await brutalSwal.fire({
			title: 'HAPUS GRUP INI?',
			text: 'DATA GRUP AKAN DIHAPUS PERMANEN.',
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
				text: 'DATA BERHASIL DIHAPUS',
				timer: 1500,
				showConfirmButton: false,
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
					title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
					htmlContainer: 'font-bold text-[#0D0D0D]'
				}
			});
			router.push('/grup');
		} catch (err) {
			Swal.close();
			await brutalSwal.fire({
				icon: 'error',
				title: 'GAGAL',
				text: err.message,
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
					title: 'font-black uppercase tracking-widest text-[#0D0D0D]',
					htmlContainer: 'font-bold text-[#0D0D0D]',
					confirmButton: 'bg-[#0D0D0D] text-white font-black uppercase tracking-widest border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none hover:-translate-y-1 transition-all'
				}
			});
			setIsDeleting(false);
		}
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='max-w-6xl mx-auto mb-8 px-4 sm:px-6 lg:px-8 space-y-6'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] -rotate-1 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>DETAIL GRUP</h1>
					</div>
				</div>

				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 rounded-none relative overflow-hidden'>
					<div className='absolute -right-10 -top-10 w-32 h-32 bg-[#A3E635] border-[4px] border-[#0D0D0D] rotate-45 z-0'></div>
					
					<div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 relative z-10'>
						{/* Title + Meta */}
						<div className='min-w-0'>
							<h1 className='text-3xl md:text-4xl font-black tracking-widest text-[#0D0D0D] uppercase line-clamp-2'>{sessionData.judul_kegiatan}</h1>

							<div className='flex flex-wrap items-center gap-3 mt-4 text-xs font-black uppercase tracking-widest'>
								<span className='inline-flex items-center border-[3px] border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] px-4 py-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									{sessionData.kelas_id}
								</span>

								<span className='inline-flex items-center gap-2 border-[3px] border-[#0D0D0D] bg-white text-[#0D0D0D] px-4 py-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<Users className='w-4 h-4' strokeWidth={3} />
									<span>{sessionData.total_siswa} SISWA</span>
								</span>

								<span className='inline-flex items-center gap-2 border-[3px] border-[#0D0D0D] bg-[#2F80ED] text-white px-4 py-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<BookOpen className='w-4 h-4' strokeWidth={3} />
									<span>{sessionData.mapel_id}</span>
								</span>

								<span className='inline-flex items-center gap-2 border-[3px] border-[#0D0D0D] bg-white text-[#0D0D0D] px-4 py-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<Calendar className='w-4 h-4' strokeWidth={3} />
									<span>{sessionData.tanggal}</span>
								</span>
							</div>
						</div>

						{/* Actions + Tab */}
						<div className='flex flex-col sm:flex-row gap-4 lg:items-end justify-center pt-2'>
							{/* Segmented tab */}
							<div className='inline-flex border-[4px] border-[#0D0D0D] bg-white self-start sm:self-auto shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
								<button
									onClick={() => setActiveTab('overview')}
									className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all border-r-[4px] border-[#0D0D0D] ${activeTab === 'overview' ? 'bg-[#0D0D0D] text-white' : 'bg-white text-[#0D0D0D] hover:bg-gray-100'}`}>
									OVERVIEW
								</button>
								<button
									onClick={() => setActiveTab('edit')}
									className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'edit' ? 'bg-[#0D0D0D] text-white' : 'bg-white text-[#0D0D0D] hover:bg-gray-100'}`}>
									EDIT SUSUNAN
								</button>
							</div>

							<button
								onClick={handleDelete}
								disabled={isDeleting}
								className='inline-flex items-center justify-center gap-2 px-6 py-3 border-[4px] border-[#0D0D0D] bg-[#E8451A] text-white font-black uppercase tracking-widest hover:-translate-y-1 transition-all disabled:opacity-60 shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-[6px_6px_0px_0px_#0D0D0D] rounded-none'>
								<Trash2 className='w-5 h-5' strokeWidth={3} />
								{isDeleting ? 'MENGHAPUS...' : 'HAPUS'}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10'>
				{activeTab === 'overview' ? (
					<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8'>
						{groups.map((group, idx) => (
							<div
								key={idx}
								className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden rounded-none flex flex-col group hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#0D0D0D] transition-all'>
								
								{/* Card header */}
								<div className='p-5 bg-[#A3E635] border-b-[4px] border-[#0D0D0D] flex items-center justify-between gap-3'>
									<div className='min-w-0'>
										<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest truncate'>{group.nama_grup || `GRUP ${idx + 1}`}</h3>
									</div>
									<span className='shrink-0 text-xs bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-3 py-1 font-black uppercase tracking-widest text-[#0D0D0D]'>
										{group.anggota_ids?.length || 0} ANGGOTA
									</span>
								</div>

								{/* Members */}
								<div className='p-0 grow bg-white'>
									<ul className='divide-y-[3px] divide-[#0D0D0D]'>
										{group.members?.map((member, mIdx) => (
											<li
												key={mIdx}
												className='flex items-center gap-4 p-4 hover:bg-[#FFF5F0] transition-colors'>
												<div className='w-12 h-12 rounded-none bg-[#FF90E8] text-[#0D0D0D] flex items-center justify-center text-sm font-black border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
													{getInitials(member.nama)}
												</div>
												<div className='min-w-0'>
													<p className='text-base font-black text-[#0D0D0D] uppercase tracking-widest truncate'>{member.nama}</p>
													{typeof member.avg !== 'undefined' && (
														<p className='text-xs font-bold text-[#0D0D0D] mt-1 bg-[#F5C518] border-[2px] border-[#0D0D0D] px-1 inline-block'>Nilai: {parseFloat(member.avg).toFixed(1)}</p>
													)}
												</div>
											</li>
										))}
									</ul>

									{!group.members?.length && (
										<div className='p-10 flex flex-col items-center text-center bg-[#FFF5F0] border-t-[3px] border-[#0D0D0D] h-full'>
											<span className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm -rotate-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>BELUM ADA ANGGOTA</span>
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				) : (
					<div className='bg-white shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] p-1 md:p-6 h-full overflow-hidden rounded-none'>
						<DragDropBoard
							initialGroups={transformDataForBoard(groups)}
							metaData={{
								judul: sessionData.judul_kegiatan,
								kelas: sessionData.kelas_id,
								metode: sessionData.metode_generate || 'manual'
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
