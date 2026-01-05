/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
		const base = 'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm';
		if (active) {
			switch (warna) {
				case 'green':
					return `${base} bg-gradient-to-br from-green-500 to-green-600 text-white ring-2 ring-green-400 ring-offset-2 scale-105`;
				case 'yellow':
					return `${base} bg-gradient-to-br from-yellow-400 to-yellow-500 text-white ring-2 ring-yellow-300 ring-offset-2 scale-105`;
				case 'blue':
					return `${base} bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 scale-105`;
				case 'red':
					return `${base} bg-gradient-to-br from-red-500 to-red-600 text-white ring-2 ring-red-400 ring-offset-2 scale-105`;
				default:
					return `${base} bg-gradient-to-br from-indigo-500 to-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 scale-105`;
			}
		}
		return `${base} bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md`;
	};

	// Helper Badge untuk Tabel Rekap
	const getBadgeRekap = (status) => {
		const s = statusList.find((sl) => sl.label === status);
		const warna = s ? s.warna : 'gray';

		const style = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide';
		switch (warna) {
			case 'green':
				return <span className={`${style} bg-emerald-100 text-emerald-700`}>Hadir</span>;
			case 'yellow':
				return <span className={`${style} bg-amber-100 text-amber-700`}>Sakit</span>;
			case 'blue':
				return <span className={`${style} bg-blue-100 text-blue-700`}>Izin</span>;
			case 'red':
				return <span className={`${style} bg-rose-100 text-rose-700`}>Alpha</span>;
			default:
				return <span className={`${style} bg-gray-100 text-gray-700`}>{status}</span>;
		}
	};

	// 1. Fetch Master Data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resMapel, resStatus, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/mapel'), fetch('/api/status-absensi'), fetch('/api/siswa')]);
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				setKelasList(dataKelas);
				setMapelList(dataMapel);
				setStatusList(dataStatus);
				setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

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

	const siswaKelasIni = siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim());

	// 2. Check Absensi Mapel
	useEffect(() => {
		if (!selectedKelas || !selectedMapel || !tanggal || !jamKe || siswaKelasIni.length === 0) {
			// Reset ke input bersih
			const init = {};
			siswaKelasIni.forEach((s) => {
				init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
			});
			setAbsensi(init);
			setMode('input');
			setExistingId(null);
			return;
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
						// DATA DITEMUKAN -> Masuk Mode REKAP
						const loadedAbsensi = {};
						data.forEach((item) => {
							loadedAbsensi[item.siswa_id] = {
								status: item.status,
								keterangan: '',
							};
						});
						setAbsensi(loadedAbsensi);

						// Default langsung REKAP agar user tau data sudah ada
						setMode('rekap');

						if (data[0]?.id_row) setExistingId(data[0].id_row);
					} else {
						// Data Baru -> Mode Input
						setMode('input');
						setExistingId(null);
						const init = {};
						siswaKelasIni.forEach((s) => {
							init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
						});
						setAbsensi(init);
					}
				}
			} catch (err) {
				console.error('Error checking absensi:', err);
			}
		};

		checkAbsensi();
	}, [selectedKelas, selectedMapel, tanggal, jamKe, siswaKelasIni.length]);

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

	// 3. Simpan
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

		try {
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

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-gray-50 pb-32 font-sans'>
			{/* --- Header & Filters --- */}
			<div className='bg-white shadow-sm border-b border-gray-200'>
				<div className='max-w-5xl mx-auto px-4 py-4 space-y-4'>
					<ButtonBack />
					{/* Title Row */}
					<div className='flex justify-between items-center'>
						<div>
							<h1 className='text-xl font-bold text-gray-800'>Absensi Mapel</h1>
							<div className='flex items-center gap-2 mt-1'>
								{mode === 'rekap' ? (
									<span className='px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700'>Data Tersimpan (Rekap)</span>
								) : mode === 'edit' ? (
									<span className='px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700'>Mode Edit</span>
								) : (
									<span className='px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700'>Input Baru</span>
								)}
							</div>
						</div>
					</div>

					{/* Filter Grid */}
					<div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
						{/* Kelas */}
						<div className='relative'>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								disabled={mode === 'edit'} // Kunci saat edit
								className='w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none disabled:opacity-60'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400'>▼</div>
						</div>

						{/* Mapel */}
						<div className='relative'>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								disabled={mode === 'edit'}
								className='w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none disabled:opacity-60'>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400'>▼</div>
						</div>

						{/* Tanggal */}
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							disabled={mode === 'edit'}
							className='w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60'
						/>

						{/* Jam Ke */}
						<input
							type='text'
							placeholder='Jam (mis: 1-2)'
							value={jamKe}
							onChange={(e) => setJamKe(e.target.value)}
							disabled={mode === 'edit'}
							className={`w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-center disabled:opacity-60 ${
								!jamKe ? 'border-red-300 bg-red-50 placeholder-red-400' : 'border-gray-200'
							}`}
						/>
					</div>
				</div>
			</div>

			{/* --- MAIN CONTENT --- */}
			<div className='max-w-5xl mx-auto px-4 py-6'>
				{/* 1. STATE KOSONG */}
				{siswaKelasIni.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-20 opacity-50'>
						<div className='text-6xl mb-4'>🎓</div>
						<p className='text-gray-500 font-medium'>Tidak ada siswa di kelas ini</p>
					</div>
				) : mode === 'rekap' ? (
					/* 2. MODE REKAPITULASI (Tabel Read Only) */
					<div className='bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden'>
						<div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50'>
							<div>
								<h2 className='font-bold text-gray-800 text-lg'>Rekapitulasi Kehadiran</h2>
								<p className='text-sm text-gray-500'>
									{selectedKelas} • {selectedMapel} • Jam ke-{jamKe}
								</p>
							</div>
							<button
								onClick={() => setMode('edit')}
								className='px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm'>
								✏️ Edit Data
							</button>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full'>
								<thead className='bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold'>
									<tr>
										<th className='px-6 py-4 text-left w-16'>No</th>
										<th className='px-6 py-4 text-left'>Nama Siswa</th>
										<th className='px-6 py-4 text-center w-32'>Status</th>
										<th className='px-6 py-4 text-left w-1/3'>Keterangan</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-100'>
									{siswaKelasIni.map((siswa, idx) => {
										const status = absensi[siswa.id]?.status || '-';
										const ket = absensi[siswa.id]?.keterangan || '-';
										return (
											<tr
												key={siswa.id}
												className='hover:bg-gray-50/50 transition-colors'>
												<td className='px-6 py-4 text-gray-400 font-medium'>{idx + 1}</td>
												<td className='px-6 py-4'>
													<p className='font-bold text-gray-800'>{siswa.nama_lengkap}</p>
													<p className='text-xs text-gray-400'>{siswa.nis}</p>
												</td>
												<td className='px-6 py-4 text-center'>{getBadgeRekap(status)}</td>
												<td className='px-6 py-4 text-sm text-gray-500 italic'>{ket !== '-' ? ket : <span className='text-gray-300'>Tidak ada keterangan</span>}</td>
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
									className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200'>
									<div className='flex justify-between items-start mb-4'>
										<div>
											<h3 className='font-bold text-gray-800 line-clamp-1 text-base'>{siswa.nama_lengkap}</h3>
											<p className='text-xs text-gray-400 font-mono mt-0.5'>{siswa.nis || '-'}</p>
										</div>
										<span className='text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full'>#{idx + 1}</span>
									</div>

									<div className='grid grid-cols-4 gap-2 mb-3'>
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
											className='w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition-colors'
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
				<div className='fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 z-30 flex justify-end shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]'>
					<button
						onClick={handleSimpan}
						disabled={saving}
						className='w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95'>
						{saving ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			)}
		</div>
	);
}
