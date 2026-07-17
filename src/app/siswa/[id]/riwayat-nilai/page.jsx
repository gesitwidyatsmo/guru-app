'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { ChevronLeft } from 'lucide-react';

// --- Komponen Chart Sederhana Neobrutalism ---
function SimpleBarChart({ data }) {
	if (!data || data.length === 0) {
		return <div className='flex h-48 w-full items-center justify-center border-[4px] border-[#0D0D0D] bg-white text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>BELUM ADA GRAFIK</div>;
	}

	const maxVal = 100;

	return (
		<div className='w-full overflow-x-auto pb-4 pt-6'>
			<div className='flex h-64 items-end gap-4 px-4'>
				{data.map((item, idx) => {
					const heightPct = Math.max((item.nilai / maxVal) * 100, 1);

					let barColor = 'bg-[#E8451A]'; // Merah (<60)
					if (item.nilai >= 90) barColor = 'bg-[#A3E635]'; // Hijau
					else if (item.nilai >= 75) barColor = 'bg-[#2F80ED]'; // Biru
					else if (item.nilai >= 60) barColor = 'bg-[#F5C518]'; // Kuning

					return (
						<div key={idx} className='group relative flex flex-col items-center flex-shrink-0 w-12 h-full'>
							{/* Tooltip Nilai */}
							<div className='absolute -top-12 opacity-0 transition-opacity group-hover:opacity-100 z-10'>
								<span className='block border-[3px] border-[#0D0D0D] bg-white px-2 py-1 text-sm font-black text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>{item.nilai}</span>
							</div>

							{/* BATANG GRAFIK */}
							<div className='relative w-full rounded-none bg-transparent flex items-end overflow-hidden border-b-[4px] border-[#0D0D0D]' style={{ height: '100%' }}>
								<div
									className={`w-full rounded-none transition-all duration-700 ease-out ${barColor} border-t-[4px] border-l-[4px] border-r-[4px] border-[#0D0D0D] shadow-[4px_0px_0px_0px_#0D0D0D] group-hover:-translate-y-2 group-hover:shadow-[6px_6px_0px_0px_#0D0D0D] relative`}
									style={{ height: `${heightPct}%` }}
								>
									{/* Inner Stripe Decoration */}
									<div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0tMSwxIGwyLC0yIE0wLDQgbDQsLTQgTTMsNSBsMiwtMiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]"></div>
								</div>
							</div>

							{/* Label Bawah */}
							<div className='mt-3 w-16 -rotate-45 truncate text-left text-[10px] font-black uppercase tracking-widest text-[#0D0D0D]' title={item.label}>
								{item.label}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// --- Helper Functions ---
const getInitials = (name) => {
	const parts = (name || '').trim().split(/\s+/).filter(Boolean);
	return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
};

const getColorByScore = (n) => {
	if (n >= 90) return 'text-[#0D0D0D] bg-[#A3E635]';
	if (n >= 75) return 'text-white bg-[#2F80ED]';
	if (n >= 60) return 'text-[#0D0D0D] bg-[#F5C518]';
	return 'text-white bg-[#E8451A]';
};

export default function RiwayatPenilaianPage() {
	const params = useParams();
	const id = params?.id;

	const [loading, setLoading] = useState(true);
	const [siswa, setSiswa] = useState(null);
	const [nilaiList, setNilaiList] = useState([]);
	const [filterMapel, setFilterMapel] = useState('Semua');

	useEffect(() => {
		if (!id) return;

		const fetchData = async () => {
			try {
				setLoading(true);

				const sRes = await fetch('/api/siswa');
				const sData = await sRes.json();
				const foundSiswa = Array.isArray(sData) ? sData.find((s) => String(s.id) === String(id)) : null;
				setSiswa(foundSiswa);

				const nRes = await fetch(`/api/riwayat-nilai?siswa_id=${encodeURIComponent(id)}`);
				if (nRes.ok) {
					const nData = await nRes.json();
					setNilaiList(Array.isArray(nData) ? nData : []);
				} else {
					console.error('Gagal ambil nilai', await nRes.text());
				}
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [id]);

	const uniqueMapel = useMemo(() => {
		const m = new Set(nilaiList.map((x) => x.mapel));
		return ['Semua', ...Array.from(m).sort()];
	}, [nilaiList]);

	const filteredData = useMemo(() => {
		if (filterMapel === 'Semua') return nilaiList;
		return nilaiList.filter((x) => x.mapel === filterMapel);
	}, [nilaiList, filterMapel]);

	const averageScore = useMemo(() => {
		if (filteredData.length === 0) return 0;
		const total = filteredData.reduce((acc, curr) => acc + curr.nilai, 0);
		return Math.round(total / filteredData.length);
	}, [filteredData]);

	const chartData = useMemo(() => {
		const data = [...filteredData].slice(0, 15).reverse();
		return data.map((item) => ({
			label: filterMapel === 'Semua' ? item.mapel : item.kategori,
			nilai: item.nilai,
		}));
	}, [filteredData, filterMapel]);

	if (loading) return <Loader />;

	if (!siswa) return <div className='p-20 text-center font-black text-2xl text-[#0D0D0D] bg-[#FFF5F0] uppercase tracking-widest'>Data siswa tidak ditemukan.</div>;

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigation */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#F5C518] p-3 border-[4px] border-[#0D0D0D] rotate-2 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>Riwayat Nilai</h1>
					</div>
				</div>

				{/* Profil Card */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none flex items-center gap-5 p-6'>
					<div className='h-20 w-20 flex-shrink-0 border-[4px] border-[#0D0D0D] bg-[#FF90E8] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-[#0D0D0D] font-black text-3xl'>{getInitials(siswa.nama_lengkap)}</div>
					<div>
						<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>{siswa.nama_lengkap}</h2>
						<p className='text-sm font-bold text-[#0D0D0D] uppercase mt-1 px-2 py-1 bg-[#A3E635] border-[2px] border-[#0D0D0D] inline-block'>
							KELAS {siswa.kelas} • NIS {siswa.nis}
						</p>
					</div>
				</div>

				{/* Statistik Summary */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
					{/* Card 1: Rata-rata */}
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none p-6 flex flex-col justify-center'>
						<div className='text-sm font-black text-[#0D0D0D] uppercase tracking-widest bg-[#F5C518] border-[3px] border-[#0D0D0D] px-2 py-1 inline-block w-fit mb-4'>Rata-rata Nilai</div>
						<div className='mt-2 flex items-baseline gap-2'>
							<span className='text-7xl font-black text-[#0D0D0D]'>{averageScore}</span>
							<span className='text-xl font-black text-[#0D0D0D]'>/ 100</span>
						</div>
						<p className='mt-4 text-xs font-bold text-[#0D0D0D] uppercase tracking-wider'>
							DARI {filteredData.length} TUGAS {filterMapel !== 'Semua' ? `(${filterMapel})` : ''}
						</p>
					</div>

					{/* Card 2: Grafik Ringkas */}
					<div className='md:col-span-2 bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none p-6'>
						<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4'>
							<div className='text-sm font-black text-[#0D0D0D] uppercase tracking-widest bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] px-2 py-1 inline-block'>Grafik Perkembangan</div>
							
							<div className='relative'>
								<select
									value={filterMapel}
									onChange={(e) => setFilterMapel(e.target.value)}
									className='block w-full sm:w-48 appearance-none bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] px-4 py-2 font-black uppercase tracking-widest text-[#0D0D0D] cursor-pointer focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all rounded-none'>
									{uniqueMapel.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
								<div className='pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#0D0D0D]'>
									<svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
										<path fillRule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clipRule='evenodd' />
									</svg>
								</div>
							</div>
						</div>
						<SimpleBarChart data={chartData} />
					</div>
				</div>

				{/* Tabel Riwayat */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
					<div className='px-6 py-5 border-b-[4px] border-[#0D0D0D] bg-[#FF90E8] flex items-center justify-between'>
						<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest'>Daftar Nilai</h3>
						<span className='text-sm bg-white border-[3px] border-[#0D0D0D] px-3 py-1 font-black text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>{filteredData.length} DATA</span>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left text-sm text-[#0D0D0D]'>
							<thead className='bg-[#0D0D0D] text-white text-xs uppercase font-black tracking-widest'>
								<tr>
									<th className='px-6 py-4'>Tanggal</th>
									<th className='px-6 py-4'>Mapel</th>
									<th className='px-6 py-4'>Kategori / Judul</th>
									<th className='px-6 py-4 text-right'>Nilai</th>
								</tr>
							</thead>
							<tbody className='divide-y-[3px] divide-[#0D0D0D] bg-white'>
								{filteredData.length === 0 ? (
									<tr>
										<td colSpan='4' className='px-6 py-12 text-center text-[#0D0D0D] font-black uppercase tracking-widest bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")]'>
											TIDAK ADA DATA NILAI.
										</td>
									</tr>
								) : (
									filteredData.map((item) => (
										<tr key={item.id} className='hover:bg-[#FFF5F0] transition-colors'>
											<td className='px-6 py-4 whitespace-nowrap font-bold text-xs uppercase'>{item.tanggal}</td>
											<td className='px-6 py-4 font-black text-[#0D0D0D] uppercase'>{item.mapel}</td>
											<td className='px-6 py-4 font-bold uppercase'>{item.kategori}</td>
											<td className='px-6 py-4 text-right'>
												<span className={`inline-flex items-center px-3 py-1 text-sm font-black border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase ${getColorByScore(item.nilai)}`}>
													{item.nilai}
												</span>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
