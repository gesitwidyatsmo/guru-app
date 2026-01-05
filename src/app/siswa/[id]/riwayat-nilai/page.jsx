'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import SectionHeader from '@/app/components/SectionHeader';
import ButtonBack from '@/app/components/button/ButtonBack';

// --- Komponen Chart Sederhana (Bar Chart CSS) ---
function SimpleBarChart({ data }) {
	// 1. Handle jika data kosong
	if (!data || data.length === 0) {
		return <div className='flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400'>Belum ada data grafik</div>;
	}

	const maxVal = 100; // Asumsi nilai maksimal 100

	return (
		<div className='w-full overflow-x-auto pb-4'>
			{/* Container utama grafik */}
			<div className='flex h-52 items-end gap-3 px-2 pt-6'>
				{data.map((item, idx) => {
					// Hitung tinggi persen (minimal 1% biar bar tetap nongol dikit kalau nilai kecil)
					const heightPct = Math.max(item.nilai, 1);

					// Tentukan warna berdasarkan nilai
					let barColor = 'bg-rose-500'; // Merah (<60)
					if (item.nilai >= 90) barColor = 'bg-emerald-500'; // Hijau
					else if (item.nilai >= 75) barColor = 'bg-blue-500'; // Biru
					else if (item.nilai >= 60) barColor = 'bg-yellow-500'; // Kuning

					return (
						// WRAPPER BAR: flex-shrink-0 PENTING agar bar tidak gepeng saat data banyak
						<div
							key={idx}
							className='group relative flex flex-col items-center flex-shrink-0 w-10 h-full'>
							{/* Tooltip Nilai (Muncul saat hover) */}
							<div className='absolute -top-8 mb-2 opacity-0 transition-opacity group-hover:opacity-100 z-10'>
								<span className='rounded bg-gray-800 px-2 py-1 text-[10px] font-bold text-white shadow-lg'>{item.nilai}</span>
								{/* Segitiga kecil di bawah tooltip */}
								<div className='mx-auto h-0 w-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-gray-800'></div>
							</div>

							{/* BATANG GRAFIK */}
							<div
								className='relative w-full rounded-t-md bg-gray-100 flex items-end overflow-hidden'
								style={{ height: '100%' }} // Container bar setinggi h-52 parent
							>
								{/* Isi Batang (Animasi Height) */}
								<div
									className={`w-full rounded-t-md transition-all duration-700 ease-out ${barColor} hover:brightness-110`}
									style={{ height: `${heightPct}%` }}
								/>
							</div>

							{/* Label Bawah (Mapel/Kategori) */}
							<div
								className='mt-2 w-full truncate text-center text-[10px] font-medium text-gray-500'
								title={item.label}>
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
	if (n >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
	if (n >= 75) return 'text-blue-600 bg-blue-50 border-blue-200';
	if (n >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
	return 'text-rose-600 bg-rose-50 border-rose-200';
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

				// 1. Data Siswa
				const sRes = await fetch('/api/siswa');
				const sData = await sRes.json();
				const foundSiswa = Array.isArray(sData) ? sData.find((s) => String(s.id) === String(id)) : null;
				setSiswa(foundSiswa);

				// 2. Data Nilai (Pakai endpoint baru yang dibuat di langkah 1)
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

	// --- Statistik & Filter ---

	// List unik mapel untuk dropdown filter
	const uniqueMapel = useMemo(() => {
		const m = new Set(nilaiList.map((x) => x.mapel));
		return ['Semua', ...Array.from(m).sort()];
	}, [nilaiList]);

	// Data yang ditampilkan (terfilter)
	const filteredData = useMemo(() => {
		if (filterMapel === 'Semua') return nilaiList;
		return nilaiList.filter((x) => x.mapel === filterMapel);
	}, [nilaiList, filterMapel]);

	// Rata-rata Nilai (dari data terfilter)
	const averageScore = useMemo(() => {
		if (filteredData.length === 0) return 0;
		const total = filteredData.reduce((acc, curr) => acc + curr.nilai, 0);
		return Math.round(total / filteredData.length);
	}, [filteredData]);

	const chartData = useMemo(() => {
		// Ambil 15 data terbaru, lalu reverse urutannya untuk grafik
		const data = [...filteredData].slice(0, 15).reverse();

		return data.map((item) => ({
			// Label bisa digabung Mapel + Kategori biar jelas
			// Contoh: "IPA - UH1"
			label: filterMapel === 'Semua' ? item.mapel : item.kategori,
			nilai: item.nilai,
		}));
	}, [filteredData, filterMapel]);

	if (loading) return <Loader />;

	if (!siswa) return <div className='p-10 text-center'>Data siswa tidak ditemukan.</div>;

	return (
		<div className='min-h-screen bg-slate-50/50 pb-20 pt-6'>
			<div className='mx-auto max-w-5xl space-y-3 px-4 sm:px-6 lg:px-8'>
				{/* Header Navigation */}
				<ButtonBack />

				{/* Profil Card */}
				<div className='rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center gap-5 -mt-2'>
					<div className='h-16 w-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md'>
						{getInitials(siswa.nama_lengkap)}
					</div>
					<div>
						<h2 className='text-xl font-bold text-gray-900'>{siswa.nama_lengkap}</h2>
						<p className='text-sm text-gray-500'>
							Kelas {siswa.kelas} • NIS {siswa.nis}
						</p>
					</div>
				</div>

				{/* Statistik Summary */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					{/* Card 1: Rata-rata */}
					<div className='rounded-2xl border border-gray-100 bg-white p-5 shadow-sm'>
						<div className='text-xs font-medium text-gray-400 uppercase tracking-wide'>Rata-rata Nilai</div>
						<div className='mt-2 flex items-baseline gap-2'>
							<span className='text-4xl font-bold text-gray-900'>{averageScore}</span>
							<span className='text-sm text-gray-500'>/ 100</span>
						</div>
						<p className='mt-1 text-xs text-gray-400'>
							Dari {filteredData.length} tugas {filterMapel !== 'Semua' ? `(${filterMapel})` : ''}
						</p>
					</div>

					{/* Card 2: Grafik Ringkas */}
					<div className='md:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm'>
						<div className='flex items-center justify-between mb-2'>
							<div className='text-xs font-medium text-gray-400 uppercase tracking-wide'>Grafik Perkembangan</div>
							{/* Filter Dropdown */}
							<select
								value={filterMapel}
								onChange={(e) => setFilterMapel(e.target.value)}
								className='text-xs border-gray-200 rounded-lg py-1 pl-2 pr-6 bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500'>
								{uniqueMapel.map((m) => (
									<option
										key={m}
										value={m}>
										{m}
									</option>
								))}
							</select>
						</div>
						<SimpleBarChart data={chartData} />
					</div>
				</div>

				{/* Tabel Riwayat */}
				<div className='rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden'>
					<div className='px-6 py-4 border-b border-gray-100 flex items-center justify-between'>
						<h3 className='font-semibold text-gray-900'>Daftar Nilai</h3>
						<span className='text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600'>{filteredData.length} Data</span>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left text-sm text-gray-600'>
							<thead className='bg-gray-50 text-xs uppercase font-medium text-gray-500'>
								<tr>
									<th className='px-6 py-3'>Tanggal</th>
									<th className='px-6 py-3'>Mapel</th>
									<th className='px-6 py-3'>Kategori / Judul</th>
									<th className='px-6 py-3 text-right'>Nilai</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-100'>
								{filteredData.length === 0 ? (
									<tr>
										<td
											colSpan='4'
											className='px-6 py-8 text-center text-gray-400 italic'>
											Tidak ada data nilai untuk ditampilkan.
										</td>
									</tr>
								) : (
									filteredData.map((item) => (
										<tr
											key={item.id}
											className='hover:bg-gray-50/50 transition-colors'>
											<td className='px-6 py-3 whitespace-nowrap font-mono text-xs'>{item.tanggal}</td>
											<td className='px-6 py-3 font-medium text-gray-900'>{item.mapel}</td>
											<td className='px-6 py-3'>{item.kategori}</td>
											<td className='px-6 py-3 text-right'>
												<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColorByScore(item.nilai)}`}>{item.nilai}</span>
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
