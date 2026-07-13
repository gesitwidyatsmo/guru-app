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
			<div className='bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl flex items-center justify-center min-h-[300px] mb-8'>
				<div className='animate-pulse flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin'></div>
					<p className='text-black font-black uppercase tracking-wider'>Memuat Visualisasi Data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8'>
			{/* Chart 1: Poin per Kelas */}
			<div className='bg-[#FFF5F0] border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl p-6'>
				<div className='mb-6 border-b-[3px] border-black pb-4'>
					<h2 className='text-2xl font-black text-black flex items-center gap-3 uppercase tracking-wider'>
						<span className='bg-yellow-300 border-2 border-black p-2 rounded-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>📊</span>
						Distribusi Poin Kelas
					</h2>
					<p className='text-sm text-black font-bold mt-2'>Akumulasi poin positif dan negatif per kelas</p>
				</div>
				<div className='h-[300px] w-full'>
					{poinData.length > 0 ? (
						<ResponsiveContainer width='100%' height='100%'>
							<BarChart data={poinData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
								<CartesianGrid strokeDasharray='0' vertical={false} stroke='#000000' strokeWidth={2} />
								<XAxis dataKey='name' axisLine={{ stroke: '#000', strokeWidth: 3 }} tickLine={{ stroke: '#000', strokeWidth: 3 }} tick={{ fill: '#000', fontSize: 14, fontWeight: 'bold' }} />
								<YAxis axisLine={{ stroke: '#000', strokeWidth: 3 }} tickLine={{ stroke: '#000', strokeWidth: 3 }} tick={{ fill: '#000', fontSize: 14, fontWeight: 'bold' }} />
								<Tooltip 
									cursor={{ fill: 'rgba(0,0,0,0.1)' }}
									contentStyle={{ backgroundColor: '#fff', borderRadius: '0px', border: '3px solid #000', boxShadow: '4px 4px 0px 0px #000', fontWeight: 'bold', color: '#000' }}
									itemStyle={{ color: '#000', fontWeight: '900' }}
								/>
								<Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', color: '#000' }} />
								<Bar dataKey='Positif' fill='#4ade80' stroke='#000' strokeWidth={3} radius={[0, 0, 0, 0]} maxBarSize={40} />
								<Bar dataKey='Negatif' fill='#f87171' stroke='#000' strokeWidth={3} radius={[0, 0, 0, 0]} maxBarSize={40} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className='h-full flex items-center justify-center text-black bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] font-bold'>
							Belum ada data poin siswa
						</div>
					)}
				</div>
			</div>

			{/* Chart 2: Tren Jurnal */}
			<div className='bg-[#FFF5F0] border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl p-6'>
				<div className='mb-6 border-b-[3px] border-black pb-4'>
					<h2 className='text-2xl font-black text-black flex items-center gap-3 uppercase tracking-wider'>
						<span className='bg-cyan-300 border-2 border-black p-2 rounded-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>📈</span>
						Aktivitas Mengajar
					</h2>
					<p className='text-sm text-black font-bold mt-2'>Grafik pengisian jurnal mengajar harian (7 Hari)</p>
				</div>
				<div className='h-[300px] w-full'>
					<ResponsiveContainer width='100%' height='100%'>
						<LineChart data={jurnalData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
							<CartesianGrid strokeDasharray='0' vertical={false} stroke='#000000' strokeWidth={2} />
							<XAxis dataKey='name' axisLine={{ stroke: '#000', strokeWidth: 3 }} tickLine={{ stroke: '#000', strokeWidth: 3 }} tick={{ fill: '#000', fontSize: 14, fontWeight: 'bold' }} />
							<YAxis axisLine={{ stroke: '#000', strokeWidth: 3 }} tickLine={{ stroke: '#000', strokeWidth: 3 }} tick={{ fill: '#000', fontSize: 14, fontWeight: 'bold' }} allowDecimals={false} />
							<Tooltip 
								contentStyle={{ backgroundColor: '#fff', borderRadius: '0px', border: '3px solid #000', boxShadow: '4px 4px 0px 0px #000', fontWeight: 'bold', color: '#000' }}
								itemStyle={{ color: '#000', fontWeight: '900' }}
							/>
							<Line 
								type='linear' 
								dataKey='Jurnal Diisi' 
								stroke='#000' 
								strokeWidth={4} 
								dot={{ r: 6, strokeWidth: 3, stroke: '#000', fill: '#fcd34d' }} 
								activeDot={{ r: 10, fill: '#fcd34d', stroke: '#000', strokeWidth: 3 }} 
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}
