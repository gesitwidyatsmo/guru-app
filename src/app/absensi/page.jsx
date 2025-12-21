/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import SectionHeader from '@/app/components/SectionHeader';

export default function AbsensiPage() {
	const [kelasList, setKelasList] = useState([]);
	const [statusList, setStatusList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));

	// absensi: { [siswaId]: { status: 'Hadir', keterangan: '' } }
	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);

	// Helper mapping warna → kelas Tailwind
	const getStatusClasses = (warna, active) => {
		const base = 'text-xs px-2 py-1 rounded-full border transition';
		if (active) {
			switch (warna) {
				case 'green':
					return `${base} bg-green-500 text-white border-green-500`;
				case 'yellow':
					return `${base} bg-yellow-400 text-white border-yellow-400`;
				case 'blue':
					return `${base} bg-blue-500 text-white border-blue-500`;
				case 'red':
					return `${base} bg-red-500 text-white border-red-500`;
				case 'purple':
					return `${base} bg-purple-500 text-white border-purple-500`;
				default:
					return `${base} bg-indigo-600 text-white border-indigo-600`;
			}
		}
		return `${base} bg-white text-gray-500 border-gray-200 hover:bg-gray-100`;
	};

	// Fetch MASTER_KELAS, MASTER_STATUS_ABSENSI, MASTER_SISWA
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resStatus, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/status-absensi'), fetch('/api/siswa')]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				setKelasList(dataKelas);
				setStatusList(dataStatus);
				setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

				if (dataKelas.length > 0) {
					setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				}

				setLoading(false);
			} catch (err) {
				console.error(err);
				setLoading(false);
			}
		};

		fetchAll();
	}, []);

	const siswaKelasIni = siswaList.filter((s) => s.kelas === selectedKelas);

	// Inisialisasi / sinkronisasi absensi ketika kelas / siswa / status berubah
	useEffect(() => {
		if (siswaKelasIni.length > 0 && statusList.length > 0) {
			const defaultStatus = statusList[0].label; // contoh: "Hadir"
			const init = {};
			siswaKelasIni.forEach((s) => {
				init[s.id] = {
					status: absensi[s.id]?.status || defaultStatus,
					keterangan: absensi[s.id]?.keterangan || '',
				};
			});
			setAbsensi(init);
		}
	}, [selectedKelas, siswaList, statusList]);

	const handleStatusChange = (siswaId, labelStatus) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: {
				...(prev[siswaId] || { keterangan: '' }),
				status: labelStatus,
			},
		}));
	};

	const handleKeteranganChange = (siswaId, value) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: {
				...(prev[siswaId] || { status: statusList[0]?.label || '' }),
				keterangan: value,
			},
		}));
	};

	const handleTandaiSemua = (labelStatus) => {
		setAbsensi((prev) => {
			const updated = { ...prev };
			siswaKelasIni.forEach((s) => {
				updated[s.id] = {
					status: labelStatus,
					keterangan: prev[s.id]?.keterangan || '',
				};
			});
			return updated;
		});
	};

	const handleSimpan = async () => {
		const payload = siswaKelasIni.map((s) => ({
			tanggal,
			kelas: selectedKelas,
			siswa_id: s.id,
			status: absensi[s.id]?.status || '',
			keterangan: absensi[s.id]?.keterangan || '',
		}));

		console.log('Data siap kirim ke /api/absensi:', payload);

		// Contoh POST (sesuaikan jika sudah buat API absensi)
		/*
    const res = await fetch('/api/absensi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Absensi tersimpan');
    } else {
      alert('Gagal menyimpan absensi');
    }
    */
	};

	return (
		<div className='bg-gray-50 min-h-screen pb-10'>
			<SectionHeader
				title='Absensi'
				leftIcon={<span className='text-xl'>&lt;</span>}
				onLeftClick={() => window.history.back()}
			/>

			{/* SECTION ATAS: Kelas & Tanggal */}
			<div className='px-4 mt-4'>
				<div className='bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
					{/* Pilih Kelas */}
					<div className='flex items-center gap-3'>
						<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='size-5'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='1.5'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M6.75 3v2.25M17.25 3v2.25M4.5 9h15M4.875 5.25h14.25A1.125 1.125 0 0 1 20.25 6.375v12.75A1.125 1.125 0 0 1 19.125 20.25H4.875A1.125 1.125 0 0 1 3.75 19.125V6.375A1.125 1.125 0 0 1 4.875 5.25Z'
								/>
							</svg>
						</div>
						<div>
							<div className='text-xs text-gray-400 font-medium'>Kelas</div>
							<select
								className='mt-1 border border-gray-200 rounded-lg px-3 py-1 text-sm'
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Pilih tanggal */}
					<div>
						<div className='text-xs text-gray-400 font-medium mb-1'>Tanggal</div>
						<input
							type='date'
							className='border border-gray-200 rounded-lg px-3 py-1 text-sm'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
						/>
					</div>

					<button
						onClick={handleSimpan}
						className='bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-md self-start md:self-auto'>
						Simpan Absensi
					</button>
				</div>
			</div>

			{/* SECTION BAWAH: Tabel Siswa + Status + Keterangan */}
			<div className='px-4 mt-4'>
				<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto'>
					{loading ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Memuat data...</div>
					) : siswaKelasIni.length === 0 ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Tidak ada siswa aktif di kelas {selectedKelas}.</div>
					) : (
						<table className='min-w-full text-sm'>
							<thead>
								<tr className='bg-gray-50 border-b border-gray-100'>
									<th className='px-3 py-2 text-left w-8'>No</th>
									<th className='px-3 py-2 text-left'>Nama Siswa</th>

									{statusList.map((st) => (
										<th
											key={st.id}
											className='px-3 py-2 text-center'>
											<button
												type='button'
												onClick={() => handleTandaiSemua(st.label)}
												className={`${getStatusClasses(st.warna, true)} h-8 w-8 rounded-full`}>
												{st.kode}
											</button>
										</th>
									))}

									<th className='px-3 py-2 text-left w-56'>Keterangan</th>
								</tr>
							</thead>
							<tbody>
								{siswaKelasIni.map((siswa, index) => (
									<tr
										key={siswa.id}
										className='border-b border-gray-50 hover:bg-gray-50 '>
										<td className='px-3 py-2 align-top text-gray-500'>{index + 1}</td>
										<td className='px-3 py-2 align-top'>
											<div className='font-medium text-gray-800 text-sm'>{siswa.nama_lengkap}</div>
											{/* <div className='text-[11px] text-gray-400'>NIS: {siswa.nis}</div> */}
										</td>

										{statusList.map((st) => {
											const active = absensi[siswa.id]?.status === st.label;
											return (
												<td
													key={st.id}
													className='px-3 py-2 text-center'>
													<button
														type='button'
														onClick={() => handleStatusChange(siswa.id, st.label)}
														className={`${getStatusClasses(st.warna, active)} h-8 w-8 rounded-full`}>
														{st.kode}
													</button>
												</td>
											);
										})}

										{/* Kolom keterangan */}
										<td className='px-3 py-2 align-middle text-center'>
											<textarea
												type='text'
												className='w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
												placeholder=''
												value={absensi[siswa.id]?.keterangan || ''}
												onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}
