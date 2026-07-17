'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Loader from '../components/loading';
import Swal from 'sweetalert2';
import { ChevronLeft, Plus, Trash2, Link as LinkIcon, Users, Edit } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function TugasDashboard() {
	const [tasks, setTasks] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchTasks = async () => {
		try {
			const supabase = createClient();
			// We can fetch tasks ordered by created_at desc
			const { data: tasksData, error } = await supabase.from('tugas_online').select('*').order('created_at', { ascending: false });
			if (error) throw error;
			
			if (tasksData) {
				const formattedTasks = tasksData.map(task => ({
					id: task.id,
					pin: task.pin,
					judul: task.judul,
					mapel: task.mapel,
					materi: task.materi,
					tipe_soal: task.tipe_soal,
					soal: typeof task.soal === 'string' ? task.soal : JSON.stringify(task.soal),
					kategori: task.kategori,
					type: task.type,
					createdAt: task.created_at,
					createdBy: task.created_by,
				}));
				setTasks(formattedTasks);
			}
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchTasks();
	}, []);

	const handleDelete = async (id) => {
		const result = await Swal.fire({
			title: 'HAPUS TUGAS?',
			text: 'Data tugas ini akan dihapus permanen dari sistem.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
			},
		});

		if (result.isConfirmed) {
			try {
				const supabase = createClient();
				const { error } = await supabase.from('tugas_online').delete().eq('id', id);
				
				if (!error) {
					Swal.fire({
						title: 'TERHAPUS!',
						text: 'Tugas telah dihapus.',
						icon: 'success',
						background: '#FFF5F0',
						color: '#0D0D0D',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
							title: 'font-black uppercase tracking-widest',
							confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
						},
					});
					fetchTasks();
				} else {
					Swal.fire({
						title: 'GAGAL!',
						text: 'Terjadi kesalahan saat menghapus.',
						icon: 'error',
						background: '#FFF5F0',
						color: '#0D0D0D',
						customClass: {
							popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
							title: 'font-black uppercase tracking-widest',
							confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
						},
					});
				}
			} catch (error) {
				console.error(error);
			}
		}
	};

	const copyLink = (task) => {
		const url = `\${window.location.origin}/soal`;
		const text = `📋 TUGAS BARU: \${task.judul}\nMata Pelajaran: \${task.mapel}\n\nSilakan kerjakan tugas Anda melalui portal berikut:\n🔗 \${url}\n\n🔑 Gunakan PIN: \${task.pin}`;
		navigator.clipboard.writeText(text);
		Swal.fire({
			title: 'TERSALIN!',
			text: 'Link dan PIN telah disalin ke clipboard.',
			icon: 'success',
			timer: 2000,
			showConfirmButton: false,
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
			},
		});
	};

	if (loading) return <Loader />;

	return (
		<main className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				{/* Header */}
				<div className='mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6'>
					<div className='flex items-center gap-6'>
						<Link
							href='/'
							className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
						</Link>
						<div>
							<h1 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest drop-shadow-[2px_2px_0px_#F5C518] mb-1'>Tugas Online</h1>
							<p className='text-[#0D0D0D] font-bold text-sm sm:text-base uppercase tracking-wider'>Kelola tugas dan studi kasus siswa</p>
						</div>
					</div>
					<Link
						href='/tugas/buat'
						className='inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#A3E635] text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<Plus className='w-6 h-6' strokeWidth={3} />
						BUAT TUGAS BARU
					</Link>
				</div>

				{/* Banner Panduan Distribusi PIN */}
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] mb-12 flex flex-col sm:flex-row gap-6 items-center'>
					<div className='bg-white p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rotate-3'>
						<svg className='w-12 h-12 text-[#E8451A]' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={3}>
							<path strokeLinecap='square' strokeLinejoin='miter' d='M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' />
						</svg>
					</div>
					<div className='flex-1 text-center sm:text-left'>
						<h2 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-2'>Panduan Distribusi Tugas</h2>
						<p className='text-[#0D0D0D] font-bold text-sm leading-relaxed'>
							Bagikan <span className='bg-white px-2 py-0.5 border-[2px] border-[#0D0D0D]'>PIN Tugas</span> ke siswa Anda. 
							Siswa dapat mengakses dan mengerjakan tugas ini melalui portal <Link href='/soal' className='text-[#2F80ED] underline underline-offset-4 decoration-[3px] hover:text-[#E8451A] hover:decoration-[#0D0D0D]'>/soal</Link> menggunakan PIN tersebut.
						</p>
					</div>
				</div>

				{/* Daftar Tugas */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
					{tasks.map((task, index) => {
						const cardColors = ['bg-white', 'bg-[#FF90E8]', 'bg-[#00A693]'];
						const textColor = index % cardColors.length === 0 ? 'text-[#0D0D0D]' : 'text-[#0D0D0D]';
						const subTextColor = index % cardColors.length === 0 ? 'text-gray-600' : 'text-[#0D0D0D]';
						const currentBg = cardColors[index % cardColors.length];

						return (
						<div
							key={task.id}
							className={`\${currentBg} border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 flex flex-col transition-transform hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] duration-200`}>
							
							<div className='flex justify-between items-start mb-6'>
								<div className='bg-[#F5C518] text-[#0D0D0D] px-3 py-1 text-sm font-black tracking-widest border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-3'>
									{task.pin}
								</div>
								<div className='flex gap-2'>
									<button
										onClick={() => copyLink(task)}
										className='p-2 bg-white text-[#0D0D0D] border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
										title='Copy Link & PIN'>
										<LinkIcon className='w-5 h-5' strokeWidth={3} />
									</button>
									<Link
										href={`/tugas/edit/\${task.id}`}
										className='p-2 bg-white text-[#0D0D0D] border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
										title='Edit Tugas'>
										<Edit className='w-5 h-5' strokeWidth={3} />
									</Link>
									<button
										onClick={() => handleDelete(task.id)}
										className='p-2 bg-white text-[#E8451A] border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
										title='Hapus Tugas'>
										<Trash2 className='w-5 h-5' strokeWidth={3} />
									</button>
								</div>
							</div>

							<h3 className={`text-2xl font-black \${textColor} mb-3 uppercase tracking-wider line-clamp-2 leading-tight`}>{task.judul}</h3>
							
							<div className='flex flex-wrap gap-2 mb-6'>
								<span className='text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white text-[#0D0D0D] border-[2px] border-[#0D0D0D]'>{task.mapel}</span>
								{task.materi && <span className='text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-[#A3E635] text-[#0D0D0D] border-[2px] border-[#0D0D0D]'>{task.materi}</span>}
							</div>

							<div className={`mt-auto pt-4 border-t-[3px] border-[#0D0D0D] flex flex-col gap-5`}>
								<div className='flex items-center justify-between'>
									<div className={`text-xs font-bold \${textColor} flex items-center gap-2 uppercase tracking-wider`}>
										<Users className='w-5 h-5' strokeWidth={3} />
										{task.tipe_soal === 'Tunggal' ? '1 SOAL' : 'STUDI KASUS'}
									</div>
									<div className={`text-xs font-bold \${subTextColor} uppercase tracking-widest`}>
										{new Date(task.createdAt).toLocaleDateString('id-ID', {
											day: '2-digit',
											month: 'short',
											year: 'numeric',
										})}
									</div>
								</div>
								<Link
									href={`/tugas/hasil/\${task.pin}`}
									className='w-full flex items-center justify-center gap-2 py-3 bg-[#0D0D0D] text-white hover:bg-[#F5C518] hover:text-[#0D0D0D] border-[4px] border-[#0D0D0D] font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
								>
									LIHAT HASIL
								</Link>
							</div>
						</div>
						);
					})}

					{tasks.length === 0 && (
						<div className='col-span-full py-20 flex flex-col items-center justify-center bg-[#FF90E8] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
							<div className='w-20 h-20 bg-white border-[4px] border-[#0D0D0D] flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_#0D0D0D] rotate-6'>
								<svg
									className='w-10 h-10 text-[#0D0D0D]'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									strokeWidth={3}>
									<path strokeLinecap='square' strokeLinejoin='miter' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' />
								</svg>
							</div>
							<h3 className='text-3xl font-black text-[#0D0D0D] mb-3 uppercase tracking-widest text-center'>BELUM ADA TUGAS</h3>
							<p className='text-[#0D0D0D] font-bold text-center max-w-sm uppercase tracking-wider'>Buat tugas baru untuk membagikan PIN kepada siswa.</p>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
