'use client';

import { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useParams, useRouter } from 'next/navigation';
import SectionHeader from '@/app/components/SectionHeader';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';

export default function AbsensiKelasPage() {
	const params = useParams();
	const router = useRouter();
	const id = params.id;

	const [kelasDetail, setKelasDetail] = useState(null);
	const [statusList, setStatusList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));

	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);
	const [loadingPage, setLoadingPage] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState('');

	const [cekLoading, setCekLoading] = useState(false);
	const [sudahAdaAbsensi, setSudahAdaAbsensi] = useState(false);

	// ✅ NEW: State untuk data absensi yang sudah tersimpan
	const [dataAbsensiTersimpan, setDataAbsensiTersimpan] = useState([]);
	const [loadingAbsensi, setLoadingAbsensi] = useState(false);

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

	// 1) Fetch detail kelas, status absensi, dan siswa
	useEffect(() => {
		if (!id) return;

		const fetchAll = async () => {
			try {
				const supabase = createClient();
				
				const [
					{ data: dataKelas },
					{ data: dataStatus },
					{ data: dataSiswa },
					{ data: dataPoin }
				] = await Promise.all([
					supabase.from('kelas').select('*'),
					supabase.from('status_absensi').select('*').order('id', { ascending: true }),
					supabase.from('siswa').select('*'),
					supabase.from('poin_siswa').select('*')
				]);

				const poinMap = {};
				(dataPoin || []).forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				const siswaDataUpdated = (dataSiswa || []).map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));

				const kelas = (dataKelas || []).find((k) => String(k.id) === String(id)) || null;
				setKelasDetail(kelas);
				setStatusList(dataStatus || []);
				setSiswaList(siswaDataUpdated.filter((s) => s.status === 'Aktif'));
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
				setLoadingPage(false);
			}
		};

		fetchAll();
	}, [id]);

	const namaKelas = kelasDetail?.kelas || kelasDetail?.nama_kelas || '';
	const siswaKelasIni = useMemo(() => siswaList.filter((s) => namaKelas && s.kelas === namaKelas), [siswaList, namaKelas]);

	// Reset absensi saat tanggal berubah
	useEffect(() => {
		// console.log('🔄 Tanggal berubah, reset absensi');
		setAbsensi({});
		setDataAbsensiTersimpan([]);
	}, [tanggal]);

	// 2) CEK apakah untuk tanggal + kelas ini sudah ada absensi
	useEffect(() => {
		let active = true;

		const cek = async () => {
			if (!kelasDetail || !tanggal || !namaKelas) {
				if (active) setSudahAdaAbsensi(false);
				return;
			}

			try {
				if (active) setCekLoading(true);

				const supabase = createClient();
				const { data, error } = await supabase.from('absensi_harian').select('sesi_id').eq('kelas', namaKelas).eq('tanggal', tanggal).single();

				if (active) {
					setSudahAdaAbsensi(!!data);
				}
			} catch (err) {
				console.error('Error cek absensi:', err);
				if (active) setSudahAdaAbsensi(false);
			} finally {
				if (active) setCekLoading(false);
			}
		};

		cek();

		return () => {
			active = false;
		};
	}, [kelasDetail, tanggal, namaKelas]);

	// ✅ NEW: Fetch data absensi jika sudah ada
	useEffect(() => {
		if (!sudahAdaAbsensi || !namaKelas || !tanggal) return;

		const fetchAbsensi = async () => {
			try {
				setLoadingAbsensi(true);
				const supabase = createClient();
				const { data: sesi } = await supabase.from('absensi_harian').select('sesi_id').eq('kelas', namaKelas).eq('tanggal', tanggal).single();
				
				if (sesi) {
					const { data: details } = await supabase.from('absensi_harian_siswa').select('siswa_id, status, keterangan').eq('sesi_id', sesi.sesi_id);
					setDataAbsensiTersimpan(details || []);
				} else {
					setDataAbsensiTersimpan([]);
				}
			} catch (err) {
				console.error('Error fetch absensi:', err);
			} finally {
				setLoadingAbsensi(false);
			}
		};

		fetchAbsensi();
	}, [sudahAdaAbsensi, namaKelas, tanggal]);

	// 3) Inisialisasi absensi dengan default status
	useEffect(() => {
		if (sudahAdaAbsensi || cekLoading) return;
		if (!namaKelas || siswaKelasIni.length === 0 || statusList.length === 0) return;

		console.log('✅ Inisialisasi absensi dengan default status');
		const defaultStatus = statusList[0].label;
		const init = {};

		siswaKelasIni.forEach((s) => {
			init[s.id] = {
				status: null,
				keterangan: '',
			};
		});

		setAbsensi(init);
	}, [namaKelas, siswaKelasIni, statusList, sudahAdaAbsensi, cekLoading]);

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

	// Handle edit absensi dipindahkan mutlak ke halaman "Riwayat Absensi"

	const handleSimpan = async () => {
		if (!kelasDetail) return;

		const konfirmasi = await Swal.fire({
			title: 'Simpan absensi?',
			text: `Kelas ${namaKelas} tanggal ${tanggal}`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'Ya, simpan',
			cancelButtonText: 'Batal',
		});

		if (!konfirmasi.isConfirmed) return;

		const data_absensi = siswaKelasIni.map((s) => ({
			siswa_id: s.id,
			status: absensi[s.id]?.status || '',
			keterangan: absensi[s.id]?.keterangan || '',
		}));

		try {
			setSaving(true);
			const supabase = createClient();

			const { data: existingSesi } = await supabase.from('absensi_harian').select('sesi_id').eq('kelas', namaKelas).eq('tanggal', tanggal).single();
			
			let sesiId = existingSesi ? existingSesi.sesi_id : `SESI-H-${Math.random().toString(36).slice(2, 11)}`;

			if (existingSesi) {
				await supabase.from('absensi_harian_siswa').delete().eq('sesi_id', sesiId);
			} else {
				const { error: insertError } = await supabase.from('absensi_harian').insert({
					sesi_id: sesiId,
					kelas: namaKelas,
					tanggal: tanggal
				});
				if (insertError) throw insertError;
			}

			if (data_absensi.length > 0) {
				const rowsToInsert = data_absensi.map(item => ({
					sesi_id: sesiId,
					siswa_id: item.siswa_id,
					status: item.status,
					keterangan: item.keterangan || ''
				}));
				const { error: detailError } = await supabase.from('absensi_harian_siswa').insert(rowsToInsert);
				if (detailError) throw detailError;
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil',
				text: 'Absensi berhasil disimpan',
				timer: 1500,
				showConfirmButton: false,
			});

			setSudahAdaAbsensi(true);
		} catch (e) {
			console.error('Error simpan absensi:', e);
			await Swal.fire({
				icon: 'error',
				title: 'Error',
				text: 'Terjadi kesalahan jaringan saat menyimpan',
			});
		} finally {
			setSaving(false);
		}
	};

	// Hitung statistik absensi
	const getStatistikAbsensi = () => {
		const stats = {};
		const total = dataAbsensiTersimpan.length;

		statusList.forEach((st) => {
			const count = dataAbsensiTersimpan.filter((d) => d.status === st.label).length;
			stats[st.label] = {
				count,
				percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0,
				color: st.warna,
				kode: st.kode,
			};
		});

		return { stats, total };
	};

	const { stats, total } = sudahAdaAbsensi ? getStatistikAbsensi() : { stats: {}, total: 0 };

	if (loading) {
		return <Loader />;
	}

	const renderAbsensiTersimpan = () => {
		if (loadingAbsensi) {
			return <div className='p-6 text-center text-gray-400 text-sm'>Memuat data absensi...</div>;
		}

		return (
			<>
				{/* Section 1: Statistik Absensi */}
				<div className='p-4 bg-linear-to-br from-indigo-50 to-blue-50 border-b border-gray-100'>
					<h3 className='text-sm font-semibold text-gray-700 mb-3'>📊 Ringkasan Absensi - {tanggal}</h3>
					<div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
						{Object.entries(stats).map(([label, data]) => (
							<div
								key={label}
								className='bg-white rounded-xl p-3 shadow-sm border border-gray-100'>
								<div className='flex items-center justify-between mb-1'>
									<span
										className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
											data.color === 'green'
												? 'bg-green-100 text-green-700'
												: data.color === 'red'
													? 'bg-red-100 text-red-700'
													: data.color === 'yellow'
														? 'bg-yellow-100 text-yellow-700'
														: data.color === 'blue'
															? 'bg-blue-100 text-blue-700'
															: 'bg-purple-100 text-purple-700'
										}`}>
										{data.kode}
									</span>
									<span className='text-2xl font-bold text-gray-800'>{data.count}</span>
								</div>
								<div className='text-xs text-gray-500 mb-1'>{label}</div>
								<div className='w-full bg-gray-200 rounded-full h-1.5'>
									<div
										className={`h-1.5 rounded-full ${
											data.color === 'green' ? 'bg-green-500' : data.color === 'red' ? 'bg-red-500' : data.color === 'yellow' ? 'bg-yellow-400' : data.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
										}`}
										style={{ width: `${data.percentage}%` }}></div>
								</div>
								<div className='text-xs text-gray-600 font-medium mt-1'>{data.percentage}%</div>
							</div>
						))}
					</div>
					<div className='mt-3 text-xs text-gray-600 text-center'>
						Total: <span className='font-semibold'>{total} siswa</span>
					</div>
				</div>

				{/* Section 2: List Siswa dengan Status */}
				<div className='p-4'>
					<h3 className='text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between'>
						<span>👥 Daftar Siswa</span>
					</h3>
					<div className='bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4 border border-yellow-200'>
						Absensi untuk pertemuan ini telah tersimpan. Jika ada kesalahan, klik tombol <b>Riwayat Absensi</b> di bawah untuk mengubah status atau mengganti tanggal sesi secara interaktif.
					</div>
					<div className='space-y-2'>
						{dataAbsensiTersimpan.map((absensi, index) => {
							const siswa = siswaList.find((s) => s.id === absensi.siswa_id);
							if (!siswa) return null;

							const statusData = statusList.find((st) => st.label === absensi.status);

							return (
								<div
									key={absensi.siswa_id || index}
									className='w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-100 transition text-left'>
									<div className='flex items-center gap-3'>
										<div className='w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold'>{index + 1}</div>
										<div>
											<div className='text-sm font-medium text-gray-800'>{siswa.nama_lengkap}</div>
											<div className='text-xs text-gray-500'>NIS: {siswa.nis}</div>
											{absensi.keterangan && <div className='text-xs text-gray-600 italic mt-0.5'>{absensi.keterangan}</div>}
										</div>
									</div>
									<div className='flex items-center gap-2'>
										<span
											className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold
											${
												statusData?.warna === 'green'
													? 'bg-green-500 text-white'
													: statusData?.warna === 'red'
														? 'bg-red-500 text-white'
														: statusData?.warna === 'yellow'
															? 'bg-yellow-400 text-white'
															: statusData?.warna === 'blue'
																? 'bg-blue-500 text-white'
																: 'bg-purple-500 text-white'
											}  `}>
											{statusData?.kode || absensi.status}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</>
		);
	};

	return (
		<div className='bg-gray-50 min-h-screen pb-10'>
			<SectionHeader
				title={namaKelas ? `Absensi ${namaKelas}` : 'Absensi'}
				leftIcon={
					<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
						<svg
							width='24'
							height='24'
							fill='none'
							stroke='currentColor'
							strokeWidth={2}>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					</div>
				}
				rightIcon={
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth='1.5'
						stroke='currentColor'
						className='size-6'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z'
						/>
					</svg>
				}
				onLeftClick={() => window.history.back()}
			/>

			{/* SECTION ATAS: Info kelas & tanggal */}
			<div className='px-4 mt-4'>
				<div className='bg-white rounded-2xl shadow-sm border border-gray-100 p-4 gap-3'>
					<div className='flex items-center justify-between gap-3 h-full mx-3'>
						<div className='flex items-center gap-3'>
							<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth='1.5'
									stroke='currentColor'
									className='size-6'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5'
									/>
								</svg>
							</div>
							<div className='text-sm font-medium'>Kelas</div>
						</div>
						<div className='mt-1 font-semibold text-sm'>{namaKelas || '-'}</div>
					</div>

					<div className='flex items-center justify-between gap-3 h-full mx-3 mt-4'>
						<div className='flex items-center gap-2'>
							<div className='bg-indigo-100 text-indigo-600 p-2 rounded-full'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth='1.5'
									stroke='currentColor'
									className='size-6'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z'
									/>
								</svg>
							</div>
							<div className='text-sm font-medium'>Tanggal</div>
						</div>
						<input
							type='date'
							className='border border-gray-200 rounded-lg px-3 py-1 text-sm'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
						/>
					</div>
				</div>
			</div>

			{/* SECTION BAWAH */}
			<div className='px-4 mt-4 mb-20'>
				<div className='bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'>
					{loading ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Memuat data...</div>
					) : !namaKelas ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Kelas tidak ditemukan.</div>
					) : cekLoading ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Mengecek absensi...</div>
					) : sudahAdaAbsensi ? (
						renderAbsensiTersimpan()
					) : siswaKelasIni.length === 0 ? (
						<div className='p-6 text-center text-gray-400 text-sm'>Tidak ada siswa aktif di kelas {namaKelas}.</div>
					) : (
						<div className='overflow-x-auto'>
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
											className='border-b border-gray-50 hover:bg-gray-50'>
											<td className='px-3 py-2 align-top text-gray-500'>{index + 1}</td>
											<td className='px-3 py-2 align-top'>
												<div className='flex items-center gap-1.5'>
													<div className='font-medium text-gray-800 text-sm'>{siswa.nama_lengkap}</div>
													<div className='flex gap-1 shrink-0'>
														{siswa.poinPositif > 0 && (
															<span
																className='text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1 py-0.5 rounded-sm'
																title='Poin +'>
																+{siswa.poinPositif}
															</span>
														)}
														{siswa.poinNegatif > 0 && (
															<span
																className='text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1 py-0.5 rounded-sm'
																title='Pelanggaran -'>
																-{siswa.poinNegatif}
															</span>
														)}
													</div>
												</div>
												<div className='text-[11px] text-gray-400 mt-0.5'>NIS: {siswa.nis}</div>
											</td>

											{statusList.map((st) => {
												const active = absensi[siswa.id]?.status === st.label;
												return (
													<td
														key={st.id}
														className='px-3 py-2 text-center align-middle'>
														<button
															type='button'
															onClick={() => handleStatusChange(siswa.id, st.label)}
															className={`${getStatusClasses(st.warna, active)} h-8 w-8 rounded-full`}>
															{st.kode}
														</button>
													</td>
												);
											})}

											<td className='px-3 py-2 align-middle text-center'>
												<textarea
													className='inline-block w-40 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-left'
													rows={2}
													placeholder='Keterangan (opsional)'
													value={absensi[siswa.id]?.keterangan || ''}
													onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>

			{/* Tombol simpan */}
			{!loading && !cekLoading && siswaKelasIni.length > 0 ? (
				!sudahAdaAbsensi ? (
					<div className='fixed inset-x-0 bottom-0 z-40 hover:cursor-pointer'>
						<div className='max-w-3xl mx-auto px-4 pb-4'>
							<button
								onClick={handleSimpan}
								disabled={saving}
								className={`w-full text-sm font-semibold py-3 rounded-2xl shadow-lg shadow-indigo-300 ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
								{saving ? 'Menyimpan...' : 'Simpan Absensi'}
							</button>
						</div>
					</div>
				) : (
					<Link
						href={`/kelas/${id}/riwayat-absensi`}
						className='fixed inset-x-0 bottom-0 z-40 cursor-pointer'>
						<div className='max-w-3xl mx-auto px-4 pb-4'>
							<button
								// onClick={handleSimpan}
								// disabled={saving}
								className={`w-full text-sm font-semibold py-3 rounded-2xl shadow-lg shadow-indigo-300 ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
								Riwayat Absensi
							</button>
						</div>
					</Link>
				)
			) : null}

			{saveMessage && (
				<div className='fixed inset-x-0 bottom-20 z-50 flex justify-center'>
					<div className='max-w-sm w-full mx-4 bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between'>
						<span>{saveMessage}</span>
						<button
							className='ml-3 text-gray-300 hover:text-white text-xs font-semibold'
							onClick={() => setSaveMessage('')}>
							Tutup
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
