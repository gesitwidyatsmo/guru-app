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
			title: 'Hapus Tugas?',
			text: 'Data tugas ini akan dihapus permanen dari sistem.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#ef4444',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Ya, Hapus!',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const supabase = createClient();
				const { error } = await supabase.from('tugas_online').delete().eq('id', id);
				
				if (!error) {
					Swal.fire('Terhapus!', 'Tugas telah dihapus.', 'success');
					fetchTasks();
				} else {
					Swal.fire('Gagal!', 'Terjadi kesalahan saat menghapus.', 'error');
				}
			} catch (error) {
				console.error(error);
			}
		}
	};

	const copyLink = (task) => {
		const url = `${window.location.origin}/soal`;
		const text = `📋 TUGAS BARU: ${task.judul}\nMata Pelajaran: ${task.mapel}\n\nSilakan kerjakan tugas Anda melalui portal berikut:\n🔗 ${url}\n\n🔑 Gunakan PIN: ${task.pin}`;
		navigator.clipboard.writeText(text);
		Swal.fire({
			title: 'Tersalin!',
			text: 'Link dan PIN telah disalin ke clipboard.',
			icon: 'success',
			timer: 1500,
			showConfirmButton: false,
		});
	};

	if (loading) return <Loader />;

	return (
		<main className='min-h-screen bg-gray-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
				{/* Header */}
				<div className='mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
					<div className='flex items-center gap-4'>
						<Link
							href='/'
							className='p-2 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors'>
							<ChevronLeft className='w-6 h-6 text-gray-600' />
						</Link>
						<div>
							<h1 className='text-3xl font-bold text-gray-800'>Tugas Online</h1>
							<p className='text-gray-500'>Kelola tugas dan studi kasus siswa</p>
						</div>
					</div>
					<Link
						href='/tugas/buat'
						className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all'>
						<Plus className='w-5 h-5' />
						Buat Tugas Baru
					</Link>
				</div>

				{/* Daftar Tugas */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					{tasks.map((task) => (
						<div
							key={task.id}
							className='bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col'>
							<div className='flex justify-between items-start mb-4'>
								<div className='bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold tracking-wider'>{task.pin}</div>
								<div className='flex gap-2'>
									<button
										onClick={() => copyLink(task)}
										className='p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors'
										title='Copy Link & PIN'>
										<LinkIcon className='w-5 h-5' />
									</button>
									<Link
										href={`/tugas/edit/${task.id}`}
										className='p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
										title='Edit Tugas'>
										<Edit className='w-5 h-5' />
									</Link>
									<button
										onClick={() => handleDelete(task.id)}
										className='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
										title='Hapus Tugas'>
										<Trash2 className='w-5 h-5' />
									</button>
								</div>
							</div>

							<h3 className='text-xl font-bold text-gray-800 mb-2 line-clamp-2'>{task.judul}</h3>
							<div className='flex flex-wrap gap-2 mb-4'>
								<span className='text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md'>{task.mapel}</span>
								{task.materi && <span className='text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md'>{task.materi}</span>}
							</div>

							<div className='mt-auto pt-4 border-t border-gray-100 flex flex-col gap-4'>
								<div className='flex items-center justify-between'>
									<div className='text-sm text-gray-500 flex items-center gap-1.5'>
										<Users className='w-4 h-4' />
										Tipe: {task.tipe_soal === 'Tunggal' ? 'Satu Soal' : 'Studi Kasus'}
									</div>
									<div className='text-xs text-gray-400'>
										{new Date(task.createdAt).toLocaleDateString('id-ID', {
											day: 'numeric',
											month: 'short',
											year: 'numeric',
										})}
									</div>
								</div>
								<Link
									href={`/tugas/hasil/${task.pin}`}
									className='w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl font-semibold transition-colors'
								>
									Lihat Hasil Pengumpulan
								</Link>
							</div>
						</div>
					))}

					{tasks.length === 0 && (
						<div className='col-span-full py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300'>
							<div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4'>
								<svg
									className='w-8 h-8 text-gray-400'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
									/>
								</svg>
							</div>
							<h3 className='text-lg font-bold text-gray-800 mb-1'>Belum ada tugas</h3>
							<p className='text-gray-500 text-center max-w-sm'>Buat tugas baru untuk membagikan PIN kepada siswa.</p>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
