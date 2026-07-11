'use client';

import { useState, useEffect } from 'react';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	LineChart,
	Line,
	PieChart,
	Pie,
	Cell
} from 'recharts';

export default function DashboardCharts() {
	const [poinData, setPoinData] = useState([]);
	const [jurnalData, setJurnalData] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchChartData = async () => {
			try {
				const [resPoin, resSiswa, resJurnal] = await Promise.all([
					fetch('/api/poin'),
					fetch('/api/siswa'),
					fetch('/api/jurnal') // assuming this gets all jurnals for the teacher
				]);

				if (resPoin.ok && resSiswa.ok && resJurnal.ok) {
					const poin = await resPoin.json();
					const siswa = await resSiswa.json();
					const jurnal = await resJurnal.json();

					// 1. Process Poin per Kelas
					// Gabungkan data poin dengan data siswa untuk mendapatkan kelasnya
					const kelasMap = {}; // { 'X-1': { positif: 10, negatif: 5 } }
					
					// Setup map dengan kelas unik
					siswa.forEach(s => {
						if (s.kelas && !kelasMap[s.kelas]) {
							kelasMap[s.kelas] = { name: s.kelas, Positif: 0, Negatif: 0 };
						}
					});

					// Distribusi poin
					poin.forEach(p => {
						const siswaTerkait = siswa.find(s => s.id === p.siswa_id);
						if (siswaTerkait && siswaTerkait.kelas) {
							const kelas = siswaTerkait.kelas;
							if (p.tipe === 'positif') {
								kelasMap[kelas].Positif += (p.poin || 0);
							} else if (p.tipe === 'negatif') {
								kelasMap[kelas].Negatif += (p.poin || 0);
							}
						}
					});

					const processedPoinData = Object.values(kelasMap).filter(k => k.Positif > 0 || k.Negatif > 0);
					setPoinData(processedPoinData);

					// 2. Process Tren Jurnal 7 Hari Terakhir
					// Generate array of last 7 dates
					const last7Days = [];
					for (let i = 6; i >= 0; i--) {
						const d = new Date();
						d.setDate(d.getDate() - i);
						const dateStr = d.toISOString().split('T')[0];
						last7Days.push({ 
							dateStr, 
							name: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
							'Jurnal Diisi': 0
						});
					}

					// Hitung jurnal per hari
					jurnal.forEach(j => {
						const dayIndex = last7Days.findIndex(d => d.dateStr === j.tanggal);
						if (dayIndex !== -1) {
							last7Days[dayIndex]['Jurnal Diisi'] += 1;
						}
					});

					setJurnalData(last7Days);
				}
			} catch (error) {
				console.error('Error fetching chart data:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchChartData();
	}, []);

	if (isLoading) {
		return (
			<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100 flex items-center justify-center min-h-[300px] mb-8'>
				<div className='animate-pulse flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin'></div>
					<p className='text-gray-400 font-medium'>Memuat Visualisasi Data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8'>
			{/* Chart 1: Poin per Kelas */}
			<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
				<div className='mb-6'>
					<h2 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
						<span className='text-2xl'>📊</span>
						Distribusi Poin Kelas
					</h2>
					<p className='text-sm text-gray-500'>Akumulasi poin positif dan negatif per kelas</p>
				</div>
				<div className='h-[300px] w-full'>
					{poinData.length > 0 ? (
						<ResponsiveContainer width='100%' height='100%'>
							<BarChart data={poinData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
								<CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#e5e7eb' />
								<XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
								<YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
								<Tooltip 
									cursor={{ fill: '#f3f4f6' }}
									contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
								/>
								<Legend wrapperStyle={{ paddingTop: '20px' }} />
								<Bar dataKey='Positif' fill='#10b981' radius={[4, 4, 0, 0]} maxBarSize={40} />
								<Bar dataKey='Negatif' fill='#f43f5e' radius={[4, 4, 0, 0]} maxBarSize={40} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className='h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200'>
							Belum ada data poin siswa
						</div>
					)}
				</div>
			</div>

			{/* Chart 2: Tren Jurnal */}
			<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
				<div className='mb-6'>
					<h2 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
						<span className='text-2xl'>📈</span>
						Aktivitas Mengajar (7 Hari)
					</h2>
					<p className='text-sm text-gray-500'>Grafik pengisian jurnal mengajar harian</p>
				</div>
				<div className='h-[300px] w-full'>
					<ResponsiveContainer width='100%' height='100%'>
						<LineChart data={jurnalData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
							<CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#e5e7eb' />
							<XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
							<YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
							<Tooltip 
								contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
							/>
							<Line 
								type='monotone' 
								dataKey='Jurnal Diisi' 
								stroke='#6366f1' 
								strokeWidth={4} 
								dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
								activeDot={{ r: 8, fill: '#6366f1', strokeWidth: 0 }} 
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}
