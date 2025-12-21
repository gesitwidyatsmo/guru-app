'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
	const [stat, setStat] = useState({
		siswa: 0,
		mapel: 0,
		kelas: 0,
	});

	const router = useRouter();

	const menuItems = [
		{ label: 'Mapel', icon: '📚', route: '/mapel' },
		{ label: 'Kelas', icon: '🏫', route: '/kelas' },
		{ label: 'Jadwal', icon: '📅', route: '/jadwal' },
		{ label: 'Siswa', icon: '👨‍🎓', route: '/siswa' },
		{ label: 'Jurnal', icon: '📝', route: '/jurnal' },
		{ label: 'Grup', icon: '👥', route: '/grup' },
	];

	// FETCH DATA STATISTIK SAAT LOAD
	useEffect(() => {
		const fetchStats = async () => {
			try {
				// Gunakan Promise.all agar fetch berjalan paralel (lebih cepat)
				const [resSiswa, resMapel, resKelas] = await Promise.all([fetch('/api/siswa'), fetch('/api/mapel'), fetch('/api/kelas')]);

				// Cek jika request sukses, lalu ambil datanya
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataKelas = resKelas.ok ? await resKelas.json() : [];

				const siswaAktif = dataSiswa.filter((siswa) => siswa.status === 'Aktif');

				// Update state dengan jumlah data (length)
				setStat({
					siswa: siswaAktif.length,
					mapel: dataMapel.length,
					kelas: dataKelas.length,
				});
			} catch (error) {
				console.error('Gagal mengambil statistik:', error);
			}
		};

		fetchStats();
	}, []);

	const handleMenuClick = (route) => {
		router.push(route);
	};

	return (
		<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
			{/* Statistik */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
				<div className='stat-card rounded-lg shadow-md p-6 flex items-center justify-between hover:scale-105 transition'>
					<div>
						<p className='text-sm font-medium mb-1'>Total Siswa</p>
						<p className='text-3xl font-bold'>{stat.siswa}</p>
					</div>
					<div className='text-4xl'>👨‍🎓</div>
				</div>
				<div className='stat-card rounded-lg shadow-md p-6 flex items-center justify-between hover:scale-105 transition'>
					<div>
						<p className='text-sm font-medium mb-1'>Total Mapel</p>
						<p className='text-3xl font-bold'>{stat.mapel}</p>
					</div>
					<div className='text-4xl'>📚</div>
				</div>
				<div className='stat-card rounded-lg shadow-md p-6 flex items-center justify-between hover:scale-105 transition'>
					<div>
						<p className='text-sm font-medium mb-1'>Total Kelas</p>
						<p className='text-3xl font-bold'>{stat.kelas}</p>
					</div>
					<div className='text-4xl'>🏫</div>
				</div>
			</div>
			{/* Menu utama */}
			<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8'>
				{menuItems.map((item, idx) => (
					<div
						key={idx}
						className='menu-card rounded-lg shadow-md p-6 text-center cursor-pointer hover:bg-indigo-50 hover:scale-105 transition'
						onClick={() => handleMenuClick(item.route)}>
						<div className='text-4xl mb-3'>{item.icon}</div>
						<p className='font-semibold'>{item.label}</p>
					</div>
				))}
			</div>
			{/* Jadwal Hari Ini */}
			<div className='rounded-lg shadow-md p-6 mb-8'>
				<h2 className='text-xl font-bold mb-4'>📅 Jadwal Hari Ini</h2>
				<div
					id='today-schedule'
					className='space-y-3 text-gray-400'>
					{/* Data jadwal hari ini akan tampil di sini */}
					<div>Tidak ada jadwal hari ini</div>
				</div>
			</div>
		</main>
	);
}
