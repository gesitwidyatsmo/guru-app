'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import ButtonBack from '../components/button/ButtonBack';

export default function AbsensiMapelPage() {
	const router = useRouter();

	// --- State UI ---
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [statusList, setStatusList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);

	// --- Filter State ---
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [jamKe, setJamKe] = useState('');

	// --- Data State ---
	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [existingId, setExistingId] = useState(null);

	// MODE: 'input' (Form Input), 'edit' (Form Edit), 'rekap' (Tampilan Tabel Hasil)
	const [mode, setMode] = useState('input');

	// Helper status colors
	const getStatusClasses = (warna, active) => {
		const base = 'px-4 py-2 rounded-xl font-bold text-sm transition-all border-2 border-[#0D0D0D] flex items-center justify-center';
		if (active) {
			const activeStyle = 'translate-x-[2px] translate-y-[2px] shadow-none';
			switch (warna) {
				case 'green': return `${base} bg-[#00A693] text-white ${activeStyle}`;
				case 'yellow': return `${base} bg-[#F5C518] text-[#0D0D0D] ${activeStyle}`;
				case 'blue': return `${base} bg-[#2F80ED] text-white ${activeStyle}`;
				case 'red': return `${base} bg-[#E8451A] text-white ${activeStyle}`;
				default: return `${base} bg-[#0D0D0D] text-white ${activeStyle}`;
			}
		}
		return `${base} bg-white text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-[1px] hover:-translate-x-[1px]`;
	};

	// Helper Badge untuk Tabel Rekap
	const getBadgeRekap = (status) => {
		const s = statusList.find((sl) => sl.label === status);
		const warna = s ? s.warna : 'gray';

		const style = 'px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-block';
		switch (warna) {
			case 'green': return <span className={`${style} bg-[#00A693] text-white`}>Hadir</span>;
			case 'yellow': return <span className={`${style} bg-[#F5C518] text-[#0D0D0D]`}>Sakit</span>;
			case 'blue': return <span className={`${style} bg-[#2F80ED] text-white`}>Izin</span>;
			case 'red': return <span className={`${style} bg-[#E8451A] text-white`}>Alpha</span>;
			default: return <span className={`${style} bg-[#E8E8E8] text-[#0D0D0D]`}>{status}</span>;
		}
	};

	// 1. Fetch Master Data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resMapel, resStatus, resSiswa, resPoin] = await Promise.all([fetch('/api/kelas'), fetch('/api/mapel'), fetch('/api/status-absensi'), fetch('/api/siswa'), fetch('/api/poin')]);
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataPoin = resPoin.ok ? await resPoin.json() : [];

				const poinMap = {};
				dataPoin.forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				const siswaDataUpdated = dataSiswa.map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));

				setKelasList(dataKelas);
				setMapelList(dataMapel);
				setStatusList(dataStatus);
				setSiswaList(siswaDataUpdated.filter((s) => s.status === 'Aktif'));

				if (dataKelas.length > 0) setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				if (dataMapel.length > 0) setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchAll();
	}, []);

	const siswaKelasIni = useMemo(() => siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim()), [siswaList, selectedKelas]);

	// 2. Check Absensi Mapel
	useEffect(() => {
		if (!selectedKelas || !selectedMapel || !tanggal || !jamKe || siswaKelasIni.length === 0) {
			return; // <-- HAPUS RESET! Biarkan state user tetap
		}

		const checkAbsensi = async () => {
			try {
				const params = new URLSearchParams({
					kelas: selectedKelas,
					mapel: selectedMapel,
					tanggal: tanggal,
					jam_ke: jamKe,
				});
				const res = await fetch(`/api/absensi-mapel?${params.toString()}`);

				if (res.ok) {
					const data = await res.json();

					if (data && data.length > 0) {
						// Load existing data
						const loadedAbsensi = {};
						data.forEach((item) => {
							loadedAbsensi[item.siswa_id] = {
								status: item.status,
								keterangan: item.keterangan || '', // Tambah keterangan jika ada di DB
							};
						});
						setAbsensi(loadedAbsensi);
						setMode('rekap');
						if (data[0]?.id_row) setExistingId(data[0].id_row);
					} else {
						// Data baru: INIT SAJA jika absensi kosong total (bukan reset)
						setAbsensi((prev) => {
							if (Object.keys(prev).length === 0) {
								const init = {};
								siswaKelasIni.forEach((s) => {
									init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
								});
								return init;
							}
							return prev;
						});
						setMode('input');
						setExistingId(null);
					}
				}
			} catch (err) {
				console.error('Error checking absensi:', err);
			}
		};

		checkAbsensi();
	}, [selectedKelas, selectedMapel, tanggal, jamKe, siswaKelasIni, statusList]); // Tambah statusList ke deps

	const handleStatusChange = (siswaId, labelStatus) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: { ...(prev[siswaId] || { keterangan: '' }), status: labelStatus },
		}));
	};

	const handleKeteranganChange = (siswaId, value) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: { ...(prev[siswaId] || { status: statusList[0]?.label || '' }), keterangan: value },
		}));
	};

	const handleSimpan = async () => {
		if (!jamKe || jamKe.trim() === '') {
			Swal.fire({
				icon: 'warning',
				title: 'Jam Belum Diisi',
				text: 'Harap isi Jam Ke (misal: 1-2) sebelum menyimpan.',
				confirmButtonColor: '#f59e0b',
			});
			return;
		}

		const hasAbsensiData = siswaKelasIni.some((s) => absensi[s.id]);
		if (!hasAbsensiData) {
			Swal.fire('Error', 'Belum ada data absensi siswa', 'error');
			return;
		}

		if (siswaKelasIni.length === 0) return;

		const result = await Swal.fire({
			title: 'Simpan Absensi Mapel?',
			text: `Simpan data ${selectedMapel} jam ke-${jamKe}?`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Simpan',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;
		setSaving(true);

		const dataToSave = siswaKelasIni.map((s) => ({
			siswa_id: s.id,
			status: absensi[s.id]?.status || 'Hadir',
		}));

		const payload = {
			id: existingId,
			tanggal,
			kelas: selectedKelas,
			mapel: selectedMapel,
			jam_ke: jamKe,
			data: dataToSave,
		};

		try {
			const res = await fetch('/api/absensi-mapel', {
				method: 'POST', // POST untuk Upsert (Insert/Update handled by backend or ID)
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				const responseData = await res.json();
				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: 'Data absensi mapel tersimpan.',
					timer: 1500,
					showConfirmButton: false,
				});

				// Setelah simpan, pindah ke mode Rekap
				setMode('rekap');
				// Update ID jika ini insert baru
				if (!existingId && responseData.id) setExistingId(responseData.id);
			} else {
				throw new Error('Gagal menyimpan');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal menyimpan data', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleHapus = async () => {
		const result = await Swal.fire({
			title: 'Hapus Absensi?',
			text: `Yakin ingin menghapus data absensi ${selectedMapel} kelas ${selectedKelas} jam ke-${jamKe}?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setLoading(true);
			const params = new URLSearchParams({
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal: tanggal,
				jam_ke: jamKe,
			});
			const res = await fetch(`/api/absensi-mapel?${params.toString()}`, {
				method: 'DELETE',
			});

			if (res.ok) {
				await Swal.fire('Terhapus!', 'Data absensi telah dihapus.', 'success');
				// Reset data
				const init = {};
				siswaKelasIni.forEach((s) => {
					init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
				});
				setAbsensi(init);
				setExistingId(null);
				setMode('input');
			} else {
				throw new Error('Gagal menghapus data');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal menghapus data absensi', 'error');
		} finally {
			setLoading(false);
		}
	};

	const goToRiwayat = () => {
		const kelasObj = kelasList.find(k => k.kelas === selectedKelas || k.nama_kelas === selectedKelas);
		if (kelasObj && kelasObj.id) {
			router.push(`/kelas/${kelasObj.id}/riwayat-absensi-mapel`);
		} else {
			Swal.fire('Info', 'Gagal menemukan ID Kelas untuk melihat riwayat', 'info');
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[var(--background)] pb-32 font-sans'>
			{/* --- Header & Filters --- */}
			<div className='bg-white border-b-4 border-[#0D0D0D] shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]'>
				<div className='max-w-5xl mx-auto px-4 py-4 space-y-4'>
					<ButtonBack />
					{/* Title Row */}
					<div className='flex justify-between items-center'>
						<div>
							<h1 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-tight'>Absensi Mapel</h1>
							<div className='flex items-center gap-2 mt-2'>
								{mode === 'rekap' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#2F80ED] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Data Tersimpan (Rekap)</span>
								) : mode === 'edit' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>Mode Edit</span>
								) : (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Input Baru</span>
								)}
							</div>
						</div>
						<button
							onClick={() => router.push('/laporan')}
							className='neo-btn-outline flex items-center gap-2 bg-[#F5C518] hover:bg-[#E8451A] hover:text-white'>
							<span className='text-xl'>📅</span> <span className='hidden sm:inline'>Rekap Bulanan</span>
						</button>
					</div>

					{/* Filter Grid */}
					<div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
						{/* Kelas */}
						<div className='relative'>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								disabled={mode === 'edit'} // Kunci saat edit
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Mapel */}
						<div className='relative'>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								disabled={mode === 'edit'}
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Tanggal */}
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							disabled={mode === 'edit'}
							className='neo-input bg-white disabled:bg-gray-200 disabled:cursor-not-allowed'
						/>

						{/* Jam Ke */}
						<input
							type='text'
							placeholder='Jam (mis: 1-2)'
							value={jamKe}
							onChange={(e) => setJamKe(e.target.value)}
							disabled={mode === 'edit'}
							className={`neo-input text-center disabled:bg-gray-200 disabled:cursor-not-allowed ${
								!jamKe ? 'border-[#E8451A] bg-[#FFF5F0]' : 'bg-white'
							}`}
						/>
					</div>
				</div>
			</div>

			{/* --- MAIN CONTENT --- */}
			<div className='max-w-5xl mx-auto px-4 py-6'>
				{/* 1. STATE KOSONG */}
				{siswaKelasIni.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-20'>
						<div className='text-6xl mb-4 drop-shadow-[4px_4px_0px_#0D0D0D]'>🎓</div>
						<p className='text-[#0D0D0D] font-bold text-xl border-2 border-[#0D0D0D] px-6 py-3 rounded-xl bg-white shadow-[4px_4px_0px_0px_#0D0D0D]'>Tidak ada siswa di kelas ini</p>
					</div>
				) : mode === 'rekap' ? (
					/* 2. MODE REKAPITULASI (Tabel Read Only) */
					<div className='neo-card p-0 overflow-hidden'>
						<div className='px-6 py-5 border-b-4 border-[#0D0D0D] flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 bg-[#F5C518]'>
							<div>
								<h2 className='font-black text-[#0D0D0D] text-xl uppercase tracking-tight'>Rekapitulasi Kehadiran</h2>
								<p className='text-sm font-bold text-[#0D0D0D]'>
									{selectedKelas} • {selectedMapel} • Jam ke-{jamKe}
								</p>
							</div>
							<div className='flex flex-wrap gap-3'>
								<button
									onClick={handleHapus}
									className='neo-btn-outline bg-[#E8451A] text-white hover:bg-white hover:text-[#E8451A] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
									<span className='hidden sm:inline'>Hapus</span>
								</button>
								<button
									onClick={goToRiwayat}
									className='neo-btn-outline bg-[#2F80ED] text-white hover:bg-white hover:text-[#2F80ED] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/></svg>
									<span className='hidden sm:inline'>Riwayat</span>
								</button>
								<button
									onClick={() => setMode('edit')}
									className='neo-btn-outline bg-[#00A693] text-white hover:bg-white hover:text-[#00A693] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'/></svg>
									<span className='hidden sm:inline'>Edit</span>
								</button>
							</div>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full'>
								<thead className='bg-[#0D0D0D] text-white text-xs uppercase tracking-wider font-bold border-b-4 border-[#0D0D0D]'>
									<tr>
										<th className='px-6 py-4 text-left w-16 border-r-2 border-[#0D0D0D]'>No</th>
										<th className='px-6 py-4 text-left border-r-2 border-[#0D0D0D]'>Nama Siswa</th>
										<th className='px-6 py-4 text-center w-32 border-r-2 border-[#0D0D0D]'>Status</th>
										<th className='px-6 py-4 text-left w-1/3'>Keterangan</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-[#0D0D0D] bg-white'>
									{siswaKelasIni.map((siswa, idx) => {
										const status = absensi[siswa.id]?.status || '-';
										const ket = absensi[siswa.id]?.keterangan || '-';
										return (
											<tr
												key={siswa.id}
												className='hover:bg-[#FFF5F0] transition-colors'>
												<td className='px-6 py-4 font-bold text-[#0D0D0D] border-r-2 border-[#0D0D0D]'>{idx + 1}</td>
												<td className='px-6 py-4 border-r-2 border-[#0D0D0D]'>
													<p className='font-bold text-[#0D0D0D] text-base'>{siswa.nama_lengkap}</p>
													<p className='text-sm text-gray-600 font-mono font-bold mt-1'>{siswa.nis}</p>
												</td>
												<td className='px-6 py-4 text-center border-r-2 border-[#0D0D0D]'>{getBadgeRekap(status)}</td>
												<td className='px-6 py-4 text-sm font-semibold text-[#0D0D0D]'>{ket !== '-' ? ket : <span className='text-gray-400 italic'>Tidak ada keterangan</span>}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					/* 3. MODE INPUT / EDIT (Card UI) */
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{siswaKelasIni.map((siswa, idx) => {
							const currentStatus = absensi[siswa.id]?.status || 'Hadir';

							return (
								<div
									key={siswa.id}
									className='neo-card flex flex-col gap-3 relative'>
									<div className='flex justify-between items-start mb-1'>
										<div className='pr-8'>
											<div className='flex flex-wrap items-center gap-2 mb-1'>
												<h3 className='font-bold text-[#0D0D0D] line-clamp-1 text-lg uppercase tracking-tight'>{siswa.nama_lengkap}</h3>
												<div className='flex gap-1 shrink-0'>
													{siswa.poinPositif > 0 && (
														<span
															className='text-[10px] font-bold text-white bg-[#00A693] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
															title='Poin +'>
															+{siswa.poinPositif}
														</span>
													)}
													{siswa.poinNegatif > 0 && (
														<span
															className='text-[10px] font-bold text-white bg-[#E8451A] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
															title='Pelanggaran -'>
															-{siswa.poinNegatif}
														</span>
													)}
												</div>
											</div>
											<p className='text-xs text-[#0D0D0D] font-mono font-bold'>{siswa.nis || '-'}</p>
										</div>
										<span className='absolute top-4 right-4 text-sm font-black text-[#0D0D0D] border-2 border-[#0D0D0D] w-8 h-8 flex items-center justify-center rounded-full bg-[#F5C518] shadow-[2px_2px_0px_0px_#0D0D0D]'>
											{idx + 1}
										</span>
									</div>

									<div className='grid grid-cols-4 gap-2 my-2'>
										{statusList.map((st) => {
											const isActive = currentStatus === st.label;
											return (
												<button
													key={st.id}
													onClick={() => handleStatusChange(siswa.id, st.label)}
													className={getStatusClasses(st.warna, isActive)}>
													{st.kode || st.label.substring(0, 1)}
												</button>
											);
										})}
									</div>

									<div className='relative'>
										<input
											type='text'
											placeholder='Keterangan...'
											value={absensi[siswa.id]?.keterangan || ''}
											onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
											className='neo-input text-sm'
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* --- Floating Save Button (Hanya Muncul di Mode Input/Edit) --- */}
			{siswaKelasIni.length > 0 && mode !== 'rekap' && (
				<div className='fixed bottom-0 left-0 right-0 p-4 bg-[#FFF5F0] border-t-4 border-[#0D0D0D] z-30 flex justify-end shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]'>
					<button
						onClick={handleSimpan}
						disabled={saving}
						className='w-full md:w-auto neo-btn-primary bg-[#0D0D0D] text-white py-3 px-10 text-lg uppercase tracking-wider flex items-center justify-center gap-2'>
						{saving ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			)}
		</div>
	);
}
