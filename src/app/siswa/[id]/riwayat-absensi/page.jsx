'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function pad2(n) {
	return String(n).padStart(2, '0');
}
function ymd(date) {
	const y = date.getFullYear();
	const m = pad2(date.getMonth() + 1);
	const d = pad2(date.getDate());
	return `${y}-${m}-${d}`;
}
function mondayIndex(jsDayIndex) {
	return (jsDayIndex + 6) % 7;
}

function statusMeta(statusRaw) {
	const s = String(statusRaw || '').toLowerCase();
	// Neobrutalism Colors
	if (s === 'hadir') return { label: 'Hadir', border: 'border-[#0D0D0D]', text: 'text-[#0D0D0D]', bg: 'bg-[#A3E635]', dot: 'bg-[#0D0D0D]' };
	if (s === 'sakit') return { label: 'Sakit', border: 'border-[#0D0D0D]', text: 'text-[#0D0D0D]', bg: 'bg-[#F5C518]', dot: 'bg-[#0D0D0D]' };
	if (s === 'izin') return { label: 'Izin', border: 'border-[#0D0D0D]', text: 'text-white', bg: 'bg-[#2F80ED]', dot: 'bg-white' };
	if (s === 'alfa' || s === 'alpha') return { label: 'Alfa', border: 'border-[#0D0D0D]', text: 'text-white', bg: 'bg-[#E8451A]', dot: 'bg-white' };
	return { label: statusRaw || '-', border: 'border-[#0D0D0D]', text: 'text-[#0D0D0D]', bg: 'bg-white', dot: 'bg-[#0D0D0D]' };
}

function StatCard({ title, value, sub, type = 'default' }) {
	const meta = statusMeta(type);
	return (
		<div className={`group relative overflow-hidden rounded-none border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-1 transition-all p-5 ${meta.bg}`}>
			{/* Decorative Dots Pattern Background */}
			<div className={`absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-none opacity-20 transition-transform group-hover:scale-110 bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMSIvPjwvc3ZnPg==")]`} />
			<div className='relative z-10'>
				<div className={`text-sm font-black uppercase tracking-widest ${meta.text}`}>{title}</div>
				<div className='mt-2 flex items-baseline gap-2'>
					<div className={`text-4xl font-black ${meta.text}`}>{value}</div>
					{sub && <div className={`text-sm font-bold ${meta.text} border-[2px] ${meta.border} px-1 bg-white/20`}>{sub}</div>}
				</div>
			</div>
		</div>
	);
}

export default function RiwayatAbsensiSiswaPage() {
	const params = useParams();
	const id = params?.id;

	const [loading, setLoading] = useState(true);
	const [siswa, setSiswa] = useState(null);
	const [riwayat, setRiwayat] = useState([]);
	const [monthOffset, setMonthOffset] = useState(0);
	const [viewMode, setViewMode] = useState('kelas');
	const [selectedMapel, setSelectedMapel] = useState('');

	useEffect(() => {
		if (!id) return;
		const run = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const { data: siswaData } = await supabase.from('siswa').select('*').eq('id', id).single();
				setSiswa(siswaData || null);

				const { data: mapelDataRaw } = await supabase.from('absensi_mapel_siswa').select(`
					status,
					absensi_mapel!inner(sesi_id, tanggal, jam_ke, kelas, mapel)
				`).eq('siswa_id', id);
				
				const cleanMapel = (mapelDataRaw || []).map((r) => ({
					pertemuan_id: r.absensi_mapel.sesi_id,
					tanggal: String(r.absensi_mapel.tanggal).slice(0, 10),
					jam_ke: r.absensi_mapel.jam_ke,
					kelas: r.absensi_mapel.kelas,
					mapel: r.absensi_mapel.mapel,
					status: r.status,
				}));

				const { data: kelasDataRaw } = await supabase.from('absensi_harian_siswa').select(`
					id, status, keterangan, absensi_harian!inner(tanggal)
				`).eq('siswa_id', id);

				const cleanKelas = (kelasDataRaw || []).map((r) => ({
					id: r.id,
					tanggal: String(r.absensi_harian.tanggal).slice(0, 10),
					status: r.status,
					keterangan: r.keterangan || 'Harian',
					mapel: '-'
				}));

				const combined = [...cleanKelas, ...cleanMapel];
				combined.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

				setRiwayat(combined);
			} catch (e) {
				console.error('Gagal mengambil data riwayat:', e);
				setRiwayat([]);
			} finally {
				setLoading(false);
			}
		};
		run();
	}, [id]);

	const uniqueMapels = useMemo(() => {
		const mapels = new Set();
		riwayat.forEach((r) => {
			if (r.mapel && r.mapel !== '-') mapels.add(r.mapel);
		});
		return Array.from(mapels).sort();
	}, [riwayat]);

	useEffect(() => {
		if (viewMode === 'mapel' && !selectedMapel && uniqueMapels.length > 0) {
			setSelectedMapel(uniqueMapels[0]);
		}
	}, [viewMode, uniqueMapels, selectedMapel]);

	const initials = useMemo(() => {
		const name = siswa?.nama_lengkap || '';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
	}, [siswa]);

	const activeMonthDate = useMemo(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
	}, [monthOffset]);

	const activeMonthLabel = useMemo(() => {
		try {
			return activeMonthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
		} catch {
			return activeMonthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
		}
	}, [activeMonthDate]);

	const calendar = useMemo(() => {
		const year = activeMonthDate.getFullYear();
		const month = activeMonthDate.getMonth();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const startPad = mondayIndex(new Date(year, month, 1).getDay());

		const cells = [];
		for (let i = 0; i < startPad; i++) cells.push(null);
		for (let d = 1; d <= daysInMonth; d++) cells.push(d);

		const byDate = {};
		for (const r of riwayat) {
			if (!r?.tanggal) continue;
			const t = String(r.tanggal).slice(0, 10);
			if (!t.startsWith(`${year}-${pad2(month + 1)}`)) continue;
			if (!byDate[t]) byDate[t] = [];
			byDate[t].push(r);
		}
		return { year, month, cells, byDate };
	}, [activeMonthDate, riwayat]);

	const stats = useMemo(() => {
		const filteredRiwayat = riwayat.filter((r) => {
			if (viewMode === 'kelas') {
				return !r.mapel || r.mapel === '-';
			} else {
				return r.mapel === selectedMapel;
			}
		});

		const total = filteredRiwayat.length;
		const counts = { hadir: 0, sakit: 0, izin: 0, alfa: 0, lain: 0 };
		for (const r of filteredRiwayat) {
			const s = String(r?.status || '').toLowerCase();
			if (s === 'hadir') counts.hadir += 1;
			else if (s === 'sakit') counts.sakit += 1;
			else if (s === 'izin') counts.izin += 1;
			else if (s === 'alfa' || s === 'alpha') counts.alfa += 1;
			else counts.lain += 1;
		}
		const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
		return {
			total,
			counts,
			pct: { hadir: pct(counts.hadir), sakit: pct(counts.sakit), izin: pct(counts.izin), alfa: pct(counts.alfa) },
		};
	}, [riwayat, viewMode, selectedMapel]);

	if (loading) return <Loader />;
	if (!siswa) return <div className='p-20 text-center font-black text-2xl text-[#0D0D0D] bg-[#FFF5F0] uppercase tracking-widest'>Siswa tidak ditemukan</div>;

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#2F80ED] p-3 border-[4px] border-[#0D0D0D] -rotate-1 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-white uppercase tracking-widest'>Riwayat Absensi</h1>
					</div>
				</div>

				{/* Profil Card */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none flex items-center gap-5 p-6'>
					<div className='h-20 w-20 flex-shrink-0 border-[4px] border-[#0D0D0D] bg-[#FF90E8] shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-center text-[#0D0D0D] font-black text-3xl'>{initials}</div>
					<div>
						<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>{siswa.nama_lengkap}</h2>
						<p className='text-sm font-bold text-[#0D0D0D] uppercase mt-1 px-2 py-1 bg-[#F5C518] border-[2px] border-[#0D0D0D] inline-block'>
							KELAS {siswa.kelas} • NIS {siswa.nis}
						</p>
					</div>
				</div>

				{/* --- FILTER SECTION --- */}
				<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex w-full sm:w-auto p-1 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<button
							onClick={() => setViewMode('kelas')}
							className={`flex-1 px-6 py-3 text-sm font-black uppercase tracking-widest transition-all sm:flex-none border-[2px] border-transparent ${
								viewMode === 'kelas' ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'text-[#0D0D0D] hover:bg-gray-100'
							}`}>
							Absensi Harian
						</button>
						<button
							onClick={() => setViewMode('mapel')}
							className={`flex-1 px-6 py-3 text-sm font-black uppercase tracking-widest transition-all sm:flex-none border-[2px] border-transparent ${
								viewMode === 'mapel' ? 'bg-[#0D0D0D] text-white border-[#0D0D0D]' : 'text-[#0D0D0D] hover:bg-gray-100'
							}`}>
							Absensi Mapel
						</button>
					</div>

					{viewMode === 'mapel' && (
						<div className='relative w-full sm:w-auto flex items-center'>
							<div className='absolute left-4 pointer-events-none'>
								<Filter className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
							</div>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='block w-full sm:w-80 h-[60px] pl-14 pr-10 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] font-black uppercase tracking-widest focus:outline-none focus:-translate-y-1 focus:shadow-[8px_8px_0px_0px_#0D0D0D] transition-all cursor-pointer appearance-none rounded-none'>
								{uniqueMapels.length === 0 && <option>BELUM ADA MAPEL</option>}
								{uniqueMapels.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
							<div className='absolute right-4 pointer-events-none'>
								<svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6 text-[#0D0D0D]' viewBox='0 0 20 20' fill='currentColor'>
									<path fillRule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clipRule='evenodd' />
								</svg>
							</div>
						</div>
					)}
				</div>

				{/* Statistik */}
				<div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
					<StatCard title='Hadir' value={stats.counts.hadir} sub={`${stats.pct.hadir}%`} type='hadir' />
					<StatCard title='Sakit' value={stats.counts.sakit} sub={`${stats.pct.sakit}%`} type='sakit' />
					<StatCard title='Izin' value={stats.counts.izin} sub={`${stats.pct.izin}%`} type='izin' />
					<StatCard title='Alfa' value={stats.counts.alfa} sub={`${stats.pct.alfa}%`} type='alfa' />
				</div>

				{/* Kalender */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] rounded-none p-6 sm:p-8'>
					<div className='mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
						<div className='flex items-center gap-4 bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] inline-flex'>
							<CalendarIcon className='h-8 w-8 text-[#0D0D0D]' strokeWidth={3} />
							<div>
								<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>{viewMode === 'kelas' ? 'KALENDER HARIAN' : 'JADWAL MAPEL'}</h3>
								<p className='text-sm font-bold text-[#0D0D0D] uppercase'>{activeMonthLabel}</p>
							</div>
						</div>

						<div className='flex items-center bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<button
								onClick={() => setMonthOffset((v) => v - 1)}
								className='p-4 border-r-[4px] border-[#0D0D0D] hover:bg-[#F5C518] hover:text-[#0D0D0D] transition-colors'>
								<ChevronLeft className='h-6 w-6' strokeWidth={3} />
							</button>
							<button
								onClick={() => setMonthOffset((v) => v + 1)}
								className='p-4 hover:bg-[#F5C518] hover:text-[#0D0D0D] transition-colors'>
								<ChevronRight className='h-6 w-6' strokeWidth={3} />
							</button>
						</div>
					</div>

					<div className='border-t-[4px] border-[#0D0D0D] pt-6'>
						<div className='grid grid-cols-7 mb-4 border-b-[4px] border-[#0D0D0D] pb-2'>
							{WEEKDAYS.map((d) => (
								<div key={d} className='text-center text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>
									{d}
								</div>
							))}
						</div>

						<div className='grid grid-cols-7 gap-y-4 gap-x-2 sm:gap-x-4'>
							{calendar.cells.map((day, idx) => {
								if (!day) return <div key={`empty-${idx}`} />;

								const dateObj = new Date(calendar.year, calendar.month, day);
								const key = ymd(dateObj);
								const items = calendar.byDate[key] || [];

								let targetItem = null;
								if (viewMode === 'kelas') {
									targetItem = items.find((i) => !i.mapel || i.mapel === '-') || null;
								} else {
									targetItem = items.find((i) => i.mapel === selectedMapel);
								}

								let squareClass = 'text-[#0D0D0D] bg-white border-[3px] border-transparent hover:border-[#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1';
								if (targetItem) {
									const meta = statusMeta(targetItem.status);
									squareClass = `${meta.bg} ${meta.text} border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-2 cursor-pointer`;
								} else if (items.length > 0 && viewMode === 'mapel') {
									squareClass = 'text-gray-300 border-[3px] border-transparent bg-gray-50';
								}

								return (
									<div key={key} className='flex flex-col items-center justify-start min-h-[60px]'>
										<div
											className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center font-black text-lg transition-all rounded-none ${squareClass}`}
											title={targetItem ? `${targetItem.status.toUpperCase()}` : ''}>
											{day}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div className='mt-10 flex flex-wrap justify-center gap-6 border-t-[4px] border-[#0D0D0D] pt-6'>
						<span className='flex items-center gap-2 font-black uppercase tracking-widest text-sm text-[#0D0D0D]'>
							<span className='h-6 w-6 border-[3px] border-[#0D0D0D] bg-[#A3E635] shadow-[2px_2px_0px_0px_#0D0D0D]'></span> HADIR
						</span>
						<span className='flex items-center gap-2 font-black uppercase tracking-widest text-sm text-[#0D0D0D]'>
							<span className='h-6 w-6 border-[3px] border-[#0D0D0D] bg-[#F5C518] shadow-[2px_2px_0px_0px_#0D0D0D]'></span> SAKIT
						</span>
						<span className='flex items-center gap-2 font-black uppercase tracking-widest text-sm text-[#0D0D0D]'>
							<span className='h-6 w-6 border-[3px] border-[#0D0D0D] bg-[#2F80ED] shadow-[2px_2px_0px_0px_#0D0D0D]'></span> IZIN
						</span>
						<span className='flex items-center gap-2 font-black uppercase tracking-widest text-sm text-[#0D0D0D]'>
							<span className='h-6 w-6 border-[3px] border-[#0D0D0D] bg-[#E8451A] shadow-[2px_2px_0px_0px_#0D0D0D]'></span> ALFA
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
