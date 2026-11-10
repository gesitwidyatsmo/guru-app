'use client';

import { useState, useMemo, useEffect } from 'react';
import Swal from 'sweetalert2';
import { swalProcess } from '@/lib/swal';
import { getPossibleSplits } from '@/lib/absensiUtils';

export default function ModalSplitSesi({
	isOpen,
	onClose,
	jamKe,
	selectedKelas,
	selectedMapel,
	tanggal,
	siswaList = [],
	absensi = {},
	userCoords = null,
	tahunAjar = '',
	semester = null,
	onSuccess,
}) {
	const splits = useMemo(() => getPossibleSplits(jamKe), [jamKe]);
	const [selectedSplitIndex, setSelectedSplitIndex] = useState(0);
	const [selectedSiswaIds, setSelectedSiswaIds] = useState([]);
	const [searchFilter, setSearchFilter] = useState('');
	const [statusAlfa, setStatusAlfa] = useState('Alpa');
	const [keteranganAlfa, setKeteranganAlfa] = useState('');
	const [loading, setLoading] = useState(false);

	const activeSplit = splits[selectedSplitIndex] || null;

	// Reset / inisialisasi default keterangan saat titik potong berubah
	useEffect(() => {
		if (activeSplit) {
			setKeteranganAlfa(`Keluar / meninggalkan kelas mulai jam ke-${activeSplit.startHourLeft}`);
		}
	}, [activeSplit]);

	// Reset state saat modal dibuka
	useEffect(() => {
		if (isOpen) {
			setSelectedSplitIndex(0);
			setSelectedSiswaIds([]);
			setSearchFilter('');
			setStatusAlfa('Alpa');
		}
	}, [isOpen, jamKe]);

	// Filter daftar siswa aktif di kelas
	const filteredSiswa = useMemo(() => {
		const targetSiswa = siswaList.filter((s) => s.status === 'Aktif' || !s.status);
		if (!searchFilter.trim()) return targetSiswa;
		const q = searchFilter.toLowerCase().trim();
		return targetSiswa.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && String(s.nis).toLowerCase().includes(q))
		);
	}, [siswaList, searchFilter]);

	if (!isOpen) return null;

	if (!activeSplit || splits.length === 0) {
		return (
			<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4'>
				<div className='bg-white border-[3px] border-[#0D0D0D] rounded-2xl p-6 max-w-md w-full shadow-[8px_8px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center gap-3'>
						<span className='text-3xl'>⚠️</span>
						<h3 className='font-black text-lg text-[#0D0D0D]'>Sesi Tidak Dapat Dipecah</h3>
					</div>
					<p className='text-sm text-gray-700 font-bold'>
						Sesi jam ke-<b>{jamKe}</b> hanya terdiri dari 1 jam pelajaran (1 JP) sehingga tidak dapat dipecah lagi.
					</p>
					<div className='flex justify-end pt-2'>
						<button
							onClick={onClose}
							className='neo-btn-primary bg-[#0D0D0D] text-white py-2 px-6 rounded-xl font-black text-sm uppercase cursor-pointer'>
							Tutup
						</button>
					</div>
				</div>
			</div>
		);
	}

	const toggleSiswa = (id) => {
		setSelectedSiswaIds((prev) => {
			if (prev.includes(id)) {
				return prev.filter((item) => item !== id);
			}
			return [...prev, id];
		});
	};

	const handleSelectAllFiltered = () => {
		const filteredIds = filteredSiswa.map((s) => s.id);
		const allSelected = filteredIds.every((id) => selectedSiswaIds.includes(id));
		if (allSelected) {
			setSelectedSiswaIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
		} else {
			setSelectedSiswaIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
		}
	};

	const handleProsesSplit = async () => {
		if (selectedSiswaIds.length === 0) {
			await Swal.fire({
				icon: 'warning',
				title: 'Pilih Siswa',
				text: 'Silakan centang minimal 1 siswa yang keluar / membolos pada sesi kedua.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		const konfirmasi = await Swal.fire({
			title: 'Konfirmasi Pecah Sesi',
			html: `
				<div class="text-left text-xs space-y-2">
					<p>Sesi <b>Jam ${jamKe}</b> akan dipecah menjadi:</p>
					<ul class="list-disc pl-5 font-bold space-y-1">
						<li><b>Sesi 1 (Jam ${activeSplit.part1}):</b> Semua siswa tetap <b>Hadir</b>.</li>
						<li><b>Sesi 2 (Jam ${activeSplit.part2}):</b> <b>${selectedSiswaIds.length} siswa</b> ditandai <b>${statusAlfa}</b>, siswa lainnya tetap <b>Hadir</b>.</li>
					</ul>
					<p class="text-gray-600 mt-2">Keterangan: <i>"${keteranganAlfa}"</i></p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#00A693',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Pecah Sesi',
			cancelButtonText: 'Batal',
		});

		if (!konfirmasi.isConfirmed) return;

		setLoading(true);
		swalProcess('Sedang Memecah Sesi...', 'Mohon tunggu, sistem sedang memproses pembagian sesi...');
		try {
			const res = await fetch('/api/absensi-mapel/split', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas: selectedKelas,
					mapel: selectedMapel,
					tanggal,
					original_jam_ke: jamKe,
					sesi_1_jam: activeSplit.part1,
					sesi_2_jam: activeSplit.part2,
					siswa_alfa_ids: selectedSiswaIds,
					status_alfa: statusAlfa,
					keterangan_alfa: keteranganAlfa,
					tahun_ajar: tahunAjar,
					semester,
					user_lat: userCoords?.lat,
					user_lng: userCoords?.lng,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal memecah sesi absensi');
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil Dipecah!',
				html: `
					<div class="text-left text-xs space-y-1">
						<p>Sesi berhasil dipecah menjadi:</p>
						<p>✅ <b>Jam ${data.sesi_1_jam}</b> (Sesi 1)</p>
						<p>✅ <b>Jam ${data.sesi_2_jam}</b> (Sesi 2: ${data.count_siswa_alfa} siswa Alfa)</p>
					</div>
				`,
				timer: 2000,
				showConfirmButton: false,
			});

			onClose();
			if (onSuccess) {
				onSuccess(data);
			}
		} catch (err) {
			console.error('Error split sesi:', err);
			await Swal.fire({
				icon: 'error',
				title: 'Gagal Memecah Sesi',
				text: err.message || 'Terjadi kesalahan sistem saat memproses.',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in'>
			<div className='bg-white border-[3px] border-[#0D0D0D] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden my-auto'>
				{/* Header Modal */}
				<div className='bg-[#FFF5F0] border-b-[3px] border-[#0D0D0D] p-4 flex items-center justify-between gap-3'>
					<div className='flex items-center gap-2.5'>
						<span className='text-2xl p-1.5 bg-[#F5C518] rounded-xl border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
							✂️
						</span>
						<div>
							<h3 className='font-black text-base text-[#0D0D0D] uppercase tracking-tight'>
								Pecah Sesi Jam Absensi
							</h3>
							<p className='text-xs font-bold text-gray-700'>
								{selectedKelas} • {selectedMapel} • Jam ke-{jamKe}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						disabled={loading}
						className='w-8 h-8 rounded-xl border-2 border-[#0D0D0D] bg-white hover:bg-rose-100 font-black text-sm flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
						✕
					</button>
				</div>

				{/* Body Modal */}
				<div className='p-4 space-y-4 overflow-y-auto flex-1'>
					{/* Banner Panduan */}
					<div className='bg-[#E2F7F4] border-2 border-[#0D0D0D] p-3 rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-bold text-[#0D0D0D] flex items-start gap-2.5'>
						<span className='text-lg shrink-0'>💡</span>
						<div>
							<p className='font-black text-emerald-950 uppercase text-[11px] mb-0.5'>
								Alur Otomatis Pecah Sesi:
							</p>
							<p className='text-gray-800 font-medium leading-relaxed'>
								Fitur ini membagi sesi <b>Jam {jamKe}</b> menjadi 2 sesi. Di sesi pertama siswa tetap <b>Hadir</b>, dan di sesi kedua siswa yang Anda pilih di bawah akan otomatis berubah status menjadi <b>{statusAlfa}</b>.
							</p>
						</div>
					</div>

					{/* Step 1: Pilih Titik Pemecahan */}
					<div>
						<label className='block font-black text-xs text-[#0D0D0D] uppercase tracking-wider mb-2'>
							1. Pilih Jam Keluar / Mulai Membolos:
						</label>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
							{splits.map((s, idx) => {
								const isSelected = selectedSplitIndex === idx;
								return (
									<button
										key={idx}
										type='button'
										onClick={() => setSelectedSplitIndex(idx)}
										className={`p-3 rounded-xl border-2 border-[#0D0D0D] text-left transition-all cursor-pointer ${
											isSelected
												? 'bg-[#2F80ED] text-white shadow-[3px_3px_0px_0px_#0D0D0D] translate-x-[1px] translate-y-[1px]'
												: 'bg-white hover:bg-[#FFF5F0] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'
										}`}>
										<div className='flex items-center justify-between mb-1'>
											<span className='font-black text-xs uppercase'>
												Mulai Jam ke-{s.startHourLeft}
											</span>
											{isSelected && (
												<span className='bg-white text-[#2F80ED] text-[10px] font-black uppercase px-1.5 py-0.2 rounded'>
													✓ Dipilih
												</span>
											)}
										</div>
										<div className={`text-[11px] font-mono ${isSelected ? 'text-blue-100' : 'text-gray-600'}`}>
											Sesi 1: <b>Jam {s.part1}</b> • Sesi 2: <b>Jam {s.part2}</b>
										</div>
									</button>
								);
							})}
						</div>
					</div>

					{/* Step 2: Form Catatan Sesi Kedua */}
					<div className='grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FFF5F0] p-3 border-2 border-[#0D0D0D] rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<div>
							<label className='block font-black text-[11px] text-[#0D0D0D] uppercase mb-1'>
								Status di Sesi 2:
							</label>
							<select
								value={statusAlfa}
								onChange={(e) => setStatusAlfa(e.target.value)}
								className='neo-input bg-white text-xs py-1.5 font-bold cursor-pointer'>
								<option value='Alpa'>Alpa / Alfa</option>
								<option value='Cabut'>Cabut (Bolos)</option>
								<option value='Izin'>Izin</option>
								<option value='Sakit'>Sakit</option>
							</select>
						</div>
						<div className='sm:col-span-2'>
							<label className='block font-black text-[11px] text-[#0D0D0D] uppercase mb-1'>
								Keterangan di Sesi 2:
							</label>
							<input
								type='text'
								value={keteranganAlfa}
								onChange={(e) => setKeteranganAlfa(e.target.value)}
								placeholder='Mis: Keluar tanpa izin di jam ke-2...'
								className='neo-input bg-white text-xs py-1.5 font-bold'
							/>
						</div>
					</div>

					{/* Step 3: Pilih Siswa yang Keluar */}
					<div>
						<div className='flex items-center justify-between mb-2 gap-2 flex-wrap'>
							<label className='font-black text-xs text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
								<span>2. Centang Siswa yang Keluar / Membolos:</span>
								<span className='px-2 py-0.5 rounded-lg border border-[#0D0D0D] bg-[#E8451A] text-white text-[10px] font-mono font-black'>
									{selectedSiswaIds.length} Dipilih
								</span>
							</label>
							<button
								type='button'
								onClick={handleSelectAllFiltered}
								className='text-[11px] font-bold text-[#2F80ED] hover:underline cursor-pointer'>
								{filteredSiswa.every((s) => selectedSiswaIds.includes(s.id))
									? 'Batalkan Semua'
									: 'Pilih Semua yang Tampil'}
							</button>
						</div>

						{/* Pencarian Siswa */}
						<div className='mb-2'>
							<input
								type='text'
								placeholder='Cari nama siswa atau NIS...'
								value={searchFilter}
								onChange={(e) => setSearchFilter(e.target.value)}
								className='neo-input bg-white text-xs py-1.5 font-bold w-full'
							/>
						</div>

						{/* List Siswa */}
						<div className='border-2 border-[#0D0D0D] rounded-xl max-h-56 overflow-y-auto divide-y-2 divide-[#0D0D0D] bg-white shadow-[2px_2px_0px_0px_#0D0D0D]'>
							{filteredSiswa.length === 0 ? (
								<div className='py-6 text-center text-xs text-gray-500 font-bold'>
									Tidak ada siswa yang cocok dengan pencarian.
								</div>
							) : (
								filteredSiswa.map((siswa, idx) => {
									const isChecked = selectedSiswaIds.includes(siswa.id);
									const currentStatus = absensi[siswa.id]?.status || 'Hadir';

									return (
										<div
											key={siswa.id}
											onClick={() => toggleSiswa(siswa.id)}
											className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
												isChecked
													? 'bg-rose-100 font-bold'
													: 'hover:bg-gray-50'
											}`}>
											<div className='flex items-center gap-2.5 overflow-hidden'>
												<input
													type='checkbox'
													checked={isChecked}
													onChange={() => toggleSiswa(siswa.id)}
													onClick={(e) => e.stopPropagation()}
													className='w-4 h-4 rounded border-2 border-[#0D0D0D] text-[#E8451A] focus:ring-0 cursor-pointer'
												/>
												<div className='overflow-hidden'>
													<span className='font-bold text-[#0D0D0D] truncate block'>
														{idx + 1}. {siswa.nama_lengkap}
													</span>
													<span className='text-[10px] text-gray-500 font-mono'>
														NIS: {siswa.nis || '-'}
													</span>
												</div>
											</div>
											<div className='shrink-0 flex items-center gap-2'>
												<span className='text-[10px] font-bold px-2 py-0.5 rounded border border-[#0D0D0D] bg-white text-gray-800'>
													{currentStatus}
												</span>
												{isChecked && (
													<span className='text-[10px] font-black uppercase text-white bg-[#E8451A] px-1.5 py-0.5 rounded border border-[#0D0D0D]'>
														→ {statusAlfa}
													</span>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>

				{/* Footer Modal */}
				<div className='bg-gray-50 border-t-[3px] border-[#0D0D0D] p-4 flex items-center justify-between gap-2 flex-wrap'>
					<button
						type='button'
						onClick={onClose}
						disabled={loading}
						className='neo-btn-outline bg-white hover:bg-gray-100 text-[#0D0D0D] py-2 px-5 rounded-xl text-xs font-black uppercase border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
						Batal
					</button>

					<button
						type='button'
						onClick={handleProsesSplit}
						disabled={loading || selectedSiswaIds.length === 0}
						className='neo-btn-primary bg-[#00A693] hover:bg-emerald-600 text-white py-2.5 px-6 rounded-xl text-xs font-black uppercase border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'>
						<span>✂️</span>
						<span>{loading ? 'Memproses Pemecahan...' : `Pecah Sesi (${selectedSiswaIds.length} Siswa Alfa)`}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
