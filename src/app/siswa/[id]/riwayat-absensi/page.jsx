'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import SectionHeader from '@/app/components/SectionHeader';
import ButtonBack from '@/app/components/button/ButtonBack';

// --- Ikon SVG (Sama seperti sebelumnya) ---
const IconCalendar = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<rect
			x='3'
			y='4'
			width='18'
			height='18'
			rx='2'
			ry='2'
		/>
		<line
			x1='16'
			y1='2'
			x2='16'
			y2='6'
		/>
		<line
			x1='8'
			y1='2'
			x2='8'
			y2='6'
		/>
		<line
			x1='3'
			y1='10'
			x2='21'
			y2='10'
		/>
	</svg>
);
const IconChevronLeft = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='m15 18-6-6 6-6' />
	</svg>
);
const IconChevronRight = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<path d='m9 18 6-6-6-6' />
	</svg>
);
const IconFilter = ({ className }) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}>
		<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' />
	</svg>
);

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
	if (s === 'hadir') return { label: 'Hadir', ring: 'ring-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' };
	if (s === 'sakit') return { label: 'Sakit', ring: 'ring-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' };
	if (s === 'izin') return { label: 'Izin', ring: 'ring-sky-500', text: 'text-sky-700', bg: 'bg-sky-50', dot: 'bg-sky-500' };
	if (s === 'alfa' || s === 'alpha') return { label: 'Alfa', ring: 'ring-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500' };
	return { label: statusRaw || '-', ring: 'ring-gray-300', text: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' };
}

function StatCard({ title, value, sub, type = 'default' }) {
	const meta = statusMeta(type);
	return (
		<div className={`group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1`}>
			<div className={`absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full opacity-10 transition-transform group-hover:scale-110 ${meta.dot.replace('bg-', 'bg-')}`} />
			<div className='relative z-10'>
				<div className='text-xs font-medium uppercase tracking-wider text-gray-500'>{title}</div>
				<div className='mt-2 flex items-baseline gap-2'>
					<div className='text-3xl font-bold text-gray-900'>{value}</div>
					{sub && <div className='text-xs font-medium text-gray-400'>{sub}</div>}
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

	// State ini akan menampung GABUNGAN data (Kelas + Mapel)
	const [riwayat, setRiwayat] = useState([]);

	const [monthOffset, setMonthOffset] = useState(0);

	// View Mode & Selected Mapel
	const [viewMode, setViewMode] = useState('kelas'); // 'kelas' | 'mapel'
	const [selectedMapel, setSelectedMapel] = useState('');

	// --- PERUBAHAN UTAMA ADA DI SINI ---
	useEffect(() => {
		if (!id) return;
		const run = async () => {
			try {
				setLoading(true);

				// 1. Fetch Data Siswa
				const siswaRes = await fetch('/api/siswa');
				const siswaList = await siswaRes.json();
				const found = Array.isArray(siswaList) ? siswaList.find((x) => String(x.id) === String(id)) : null;
				setSiswa(found || null);

				// 2. Fetch Absensi Mapel (Existing)
				const mapelReq = fetch(`/api/riwayat-absensi-mapel?siswa_id=${encodeURIComponent(String(id))}`).then((res) => res.json());

				// 3. Fetch Absensi Kelas (NEW)
				const kelasReq = fetch(`/api/riwayat-absensi-kelas?siswa_id=${encodeURIComponent(String(id))}`).then((res) => res.json());
				const [mapelData, kelasData] = await Promise.all([mapelReq, kelasReq]);
				const cleanMapel = Array.isArray(mapelData) ? mapelData : [];
				const cleanKelas = Array.isArray(kelasData) ? kelasData.map((item) => ({ ...item, mapel: '-' })) : [];
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

	// Logic Kalender & Filter Data
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

	// Hitung ulang statistik berdasarkan View Mode
	const stats = useMemo(() => {
		const filteredRiwayat = riwayat.filter((r) => {
			if (viewMode === 'kelas') {
				// Mode Kelas: Ambil data yg mapelnya kosong atau '-'
				return !r.mapel || r.mapel === '-';
			} else {
				// Mode Mapel: Hanya mapel yang dipilih
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

	if (loading)
		return (
			<div className='flex min-h-screen items-center justify-center bg-slate-50'>
				<Loader />
			</div>
		);
	if (!siswa) return <div className='p-10 text-center'>Siswa tidak ditemukan</div>;

	return (
		<div className='min-h-screen bg-slate-50/50 pb-20 pt-6'>
			<div className='mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8'>
				<ButtonBack />

				{/* Profil Card */}
				<div className='rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center gap-5 -mt-2'>
					<div className='h-16 w-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md'>{initials}</div>
					<div>
						<h2 className='text-xl font-bold text-gray-900'>{siswa.nama_lengkap}</h2>
						<p className='text-sm text-gray-500'>
							Kelas {siswa.kelas} • NIS {siswa.nis}
						</p>
					</div>
				</div>

				{/* --- FILTER SECTION --- */}
				<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex w-full rounded-xl bg-gray-100 p-1.5 sm:w-auto'>
						<button
							onClick={() => setViewMode('kelas')}
							className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 sm:flex-none ${
								viewMode === 'kelas' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
							}`}>
							Absensi Harian
						</button>
						<button
							onClick={() => setViewMode('mapel')}
							className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 sm:flex-none ${
								viewMode === 'mapel' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
							}`}>
							Absensi Mapel
						</button>
					</div>

					{viewMode === 'mapel' && (
						<div className='relative w-full animate-in fade-in slide-in-from-top-1 duration-200 sm:w-auto'>
							<div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500'>
								<IconFilter className='h-4 w-4' />
							</div>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='block w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-64'>
								{uniqueMapels.length === 0 && <option>Belum ada data mapel</option>}
								{uniqueMapels.map((m) => (
									<option
										key={m}
										value={m}>
										{m}
									</option>
								))}
							</select>
							<div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									className='h-4 w-4'
									viewBox='0 0 20 20'
									fill='currentColor'>
									<path
										fillRule='evenodd'
										d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
										clipRule='evenodd'
									/>
								</svg>
							</div>
						</div>
					)}
				</div>

				{/* Statistik */}
				<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
					<StatCard
						title='Hadir'
						value={stats.counts.hadir}
						sub={`${stats.pct.hadir}%`}
						type='hadir'
					/>
					<StatCard
						title='Sakit'
						value={stats.counts.sakit}
						sub={`${stats.pct.sakit}%`}
						type='sakit'
					/>
					<StatCard
						title='Izin'
						value={stats.counts.izin}
						sub={`${stats.pct.izin}%`}
						type='izin'
					/>
					<StatCard
						title='Alfa'
						value={stats.counts.alfa}
						sub={`${stats.pct.alfa}%`}
						type='alfa'
					/>
				</div>

				{/* Kalender */}
				<div className='rounded-3xl border border-gray-100 bg-white p-6 shadow-sm'>
					<div className='mb-6 flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<div className='flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600'>
								<IconCalendar className='h-5 w-5' />
							</div>
							<div>
								<h3 className='text-lg font-bold text-gray-900'>{viewMode === 'kelas' ? 'Kalender Harian' : 'Jadwal Mapel'}</h3>
								<p className='text-sm text-gray-500 capitalize'>{activeMonthLabel}</p>
							</div>
						</div>

						<div className='flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1'>
							<button
								onClick={() => setMonthOffset((v) => v - 1)}
								className='rounded-lg p-2 text-gray-500 hover:bg-white hover:shadow-sm'>
								<IconChevronLeft className='h-4 w-4' />
							</button>
							<button
								onClick={() => setMonthOffset((v) => v + 1)}
								className='rounded-lg p-2 text-gray-500 hover:bg-white hover:shadow-sm'>
								<IconChevronRight className='h-4 w-4' />
							</button>
						</div>
					</div>

					<div className='border-t border-gray-100 pt-4'>
						<div className='grid grid-cols-7 mb-2'>
							{WEEKDAYS.map((d) => (
								<div
									key={d}
									className='text-center text-xs font-semibold uppercase tracking-wide text-gray-400 py-2'>
									{d}
								</div>
							))}
						</div>

						<div className='grid grid-cols-7 gap-y-4 gap-x-2'>
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

								let circleClass = 'text-gray-700 hover:bg-gray-50';
								if (targetItem) {
									const meta = statusMeta(targetItem.status);
									circleClass = `${meta.ring} ring-2 ${meta.bg} ${meta.text} font-bold shadow-sm cursor-pointer`;
								} else if (items.length > 0 && viewMode === 'mapel') {
									circleClass = 'text-gray-300';
								}

								return (
									<div
										key={key}
										className='flex flex-col items-center justify-start min-h-[50px]'>
										<div
											className={`flex h-10 w-10 items-center justify-center rounded-full text-sm transition-all ${circleClass}`}
											title={targetItem ? `${targetItem.status}` : ''}>
											{day}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div className='mt-8 flex flex-wrap justify-center gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500'>
						<span className='flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-emerald-500'></span> Hadir
						</span>
						<span className='flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-amber-500'></span> Sakit
						</span>
						<span className='flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-sky-500'></span> Izin
						</span>
						<span className='flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-rose-500'></span> Alfa
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
