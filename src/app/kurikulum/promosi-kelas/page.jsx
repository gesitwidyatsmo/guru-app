'use client';

import { useState, useEffect } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export default function KurikulumPromosiKelasPage() {
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [promosiMode, setPromosiMode] = useState('massal'); // 'massal' | 'individual'
	const [promosiMassal, setPromosiMassal] = useState([]);
	const [promosiIndividual, setPromosiIndividual] = useState([]);
	const [isSaving, setIsSaving] = useState(false);

	const [searchQuery, setSearchQuery] = useState('');
	const [filterKelasAsal, setFilterKelasAsal] = useState('all');

	const loadData = async () => {
		try {
			setLoading(true);
			const [resKelas, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/siswa')]);
			const dataKelas = resKelas.ok ? await resKelas.json() : [];
			const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

			const activeSiswa = (dataSiswa || []).filter((s) => s.status === 'Aktif');

			setKelasList(dataKelas);
			setSiswaList(activeSiswa);

			// Init promosi massal
			const initMassal = dataKelas.map((k) => ({
				dari_kelas: k.nama_kelas || k.kelas,
				ke_kelas: '',
			}));
			setPromosiMassal(initMassal);

			// Init promosi individual
			setPromosiIndividual(
				activeSiswa.map((s) => ({
					siswa_id: s.id,
					nama: s.nama_lengkap,
					nis: s.nis,
					kelas_lama: s.kelas,
					ke_kelas: '',
				})),
			);
		} catch (err) {
			console.error('Error load promosi data:', err);
			Swal.fire('Terjadi Kesalahan', 'Gagal memuat data rombel dan siswa.', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Handle Massal Change
	const handleMassalChange = (dari_kelas, ke_kelas) => {
		setPromosiMassal((prev) =>
			prev.map((item) => (item.dari_kelas === dari_kelas ? { ...item, ke_kelas } : item)),
		);
	};

	// Eksekusi Promosi Massal
	const handleSimpanMassal = async () => {
		const targetPromosi = promosiMassal.filter((m) => m.ke_kelas && m.ke_kelas.trim() !== '');
		if (targetPromosi.length === 0) {
			Swal.fire('Peringatan', 'Tentukan kelas tujuan untuk setidaknya satu rombel kelas!', 'warning');
			return;
		}

		const confirm = await Swal.fire({
			title: 'Proses Kenaikan Kelas Massal?',
			html: `Anda akan memindahkan siswa dari <b>${targetPromosi.length} kelas</b> ke jenjang berikutnya.<br/><span class="text-xs text-rose-600 font-bold">Pastikan seluruh penilaian & rapor semester telah tuntas.</span>`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			confirmButtonText: 'Ya, Jalankan Pleno',
			cancelButtonText: 'Batal',
		});

		if (confirm.isConfirmed) {
			try {
				setIsSaving(true);
				const res = await fetch('/api/promosi-kelas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ mode: 'massal', data: targetPromosi }),
				});
				const resData = await res.json();
				if (!res.ok) throw new Error(resData.error || 'Gagal memproses kenaikan kelas massal.');

				Swal.fire('Sukses Pleno!', resData.message || 'Kenaikan kelas massal berhasil dijalankan.', 'success');
				loadData();
			} catch (err) {
				Swal.fire('Gagal', err.message, 'error');
			} finally {
				setIsSaving(false);
			}
		}
	};

	// Eksekusi Promosi Individual
	const handleIndividualChange = (siswa_id, ke_kelas) => {
		setPromosiIndividual((prev) =>
			prev.map((item) => (item.siswa_id === siswa_id ? { ...item, ke_kelas } : item)),
		);
	};

	const handleSimpanIndividual = async () => {
		const targetSiswa = promosiIndividual.filter((s) => s.ke_kelas && s.ke_kelas.trim() !== '');
		if (targetSiswa.length === 0) {
			Swal.fire('Peringatan', 'Tentukan kelas tujuan untuk setidaknya satu santri/siswa!', 'warning');
			return;
		}

		const confirm = await Swal.fire({
			title: 'Mutasikan Santri / Siswa?',
			html: `Sebanyak <b>${targetSiswa.length} santri/siswa</b> akan dipindahkan ke kelas baru yang telah ditentukan.`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			confirmButtonText: 'Ya, Pindahkan',
			cancelButtonText: 'Batal',
		});

		if (confirm.isConfirmed) {
			try {
				setIsSaving(true);
				const res = await fetch('/api/promosi-kelas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ mode: 'individual', data: targetSiswa }),
				});
				const resData = await res.json();
				if (!res.ok) throw new Error(resData.error || 'Gagal memproses promosi individual.');

				Swal.fire('Sukses Mutasi!', resData.message || 'Siswa berhasil dipindahkan.', 'success');
				loadData();
			} catch (err) {
				Swal.fire('Gagal', err.message, 'error');
			} finally {
				setIsSaving(false);
			}
		}
	};

	const filteredIndividual = promosiIndividual.filter((item) => {
		const matchKelas = filterKelasAsal === 'all' || item.kelas_lama === filterKelasAsal;
		const q = searchQuery.toLowerCase();
		const matchSearch = item.nama.toLowerCase().includes(q) || (item.nis && item.nis.includes(q));
		return matchKelas && matchSearch;
	});

	if (loading) return <Loader text='Memuat Modul Promosi Kelas...' />;

	return (
		<div className='space-y-6'>
			{/* HEADER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1'>
						<span className='px-2 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded'>
							Periode & Promosi
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>🎓</span> Promosi & Kenaikan Kelas Siswa
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl'>
						Rapat pleno akhir tahun ajaran: perpindahan massal rombel ke tingkat atasnya, mutasi individual, dan pencatatan status kelulusan.
					</p>
				</div>
				<div className='flex items-center gap-3 shrink-0'>
					<AcademicPeriodChip />
				</div>
			</div>

			{/* MODE SWITCHER */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between gap-4'>
				<div className='bg-[#FEF08A] p-1 border-2 border-black rounded-xl flex items-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
					<button
						onClick={() => setPromosiMode('massal')}
						className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
							promosiMode === 'massal' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						🏛️ Promosi Massal Rombel
					</button>
					<button
						onClick={() => setPromosiMode('individual')}
						className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
							promosiMode === 'individual' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						👤 Mutasi / Penjurusan Individual
					</button>
				</div>
			</div>

			{/* MODE 1: PROMOSI MASSAL */}
			{promosiMode === 'massal' && (
				<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center justify-between border-b-2 border-black pb-3'>
						<div>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>🏛️</span> Pemetaan Kenaikan Rombel Kelas
							</h2>
							<p className='text-xs font-bold text-gray-500 mt-0.5'>
								Seluruh santri/siswa di kelas asal akan otomatis dipindahkan ke rombel kelas tujuan yang dipilih.
							</p>
						</div>

						<button
							onClick={handleSimpanMassal}
							disabled={isSaving}
							className='px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
							{isSaving ? 'Memproses Pleno...' : 'Jalankan Promosi Massal →'}
						</button>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
									<th className='py-3 px-3'>No</th>
									<th className='py-3 px-3'>Kelas Asal</th>
									<th className='py-3 px-3 text-center'>Arah Promosi</th>
									<th className='py-3 px-3'>Target Kelas Baru / Status Kelulusan</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{promosiMassal.map((p, idx) => (
									<tr key={idx} className='hover:bg-amber-50/60'>
										<td className='py-3 px-3 font-mono'>{idx + 1}</td>
										<td className='py-3 px-3'>
											<span className='px-3 py-1 bg-yellow-200 border border-black rounded-lg text-xs font-black'>
												🏫 {p.dari_kelas}
											</span>
										</td>
										<td className='py-3 px-3 text-center text-xl font-black'>
											➔
										</td>
										<td className='py-3 px-3'>
											<select
												value={p.ke_kelas}
												onChange={(e) => handleMassalChange(p.dari_kelas, e.target.value)}
												className='px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0] focus:outline-none w-full sm:w-64'>
												<option value=''>-- Tetap / Jangan Ubah --</option>
												{kelasList.map((k) => (
													<option key={k.id} value={k.nama_kelas}>
														Naik ke: {k.nama_kelas}
													</option>
												))}
												<option value='Lulus'>🎓 Lulus / Alumni</option>
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* MODE 2: PROMOSI INDIVIDUAL */}
			{promosiMode === 'individual' && (
				<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3'>
						<div>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>👤</span> Penjurusan & Mutasi Individual ({filteredIndividual.length} Siswa)
							</h2>
							<p className='text-xs font-bold text-gray-500 mt-0.5'>
								Tentukan kelas tujuan secara spesifik per siswa (cocok untuk penjurusan SMA/MA atau penyesuaian rombel).
							</p>
						</div>

						<button
							onClick={handleSimpanIndividual}
							disabled={isSaving}
							className='px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
							{isSaving ? 'Menyimpan Mutasi...' : 'Simpan Mutasi Siswa →'}
						</button>
					</div>

					{/* FILTERS */}
					<div className='flex flex-col sm:flex-row items-center gap-3'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari nama santri / siswa atau NIS...'
							className='w-full sm:w-80 px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'
						/>
						<select
							value={filterKelasAsal}
							onChange={(e) => setFilterKelasAsal(e.target.value)}
							className='w-full sm:w-auto px-3 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'>
							<option value='all'>Semua Kelas Asal</option>
							{kelasList.map((k) => (
								<option key={k.id} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					<div className='overflow-x-auto max-h-[500px] overflow-y-auto'>
						<table className='w-full text-left border-collapse'>
							<thead className='sticky top-0 bg-amber-100'>
								<tr className='border-b-2 border-black text-[11px] font-black uppercase text-black'>
									<th className='py-3 px-3'>No</th>
									<th className='py-3 px-3'>NIS</th>
									<th className='py-3 px-3'>Nama Siswa</th>
									<th className='py-3 px-3'>Kelas Asal</th>
									<th className='py-3 px-3'>Pindah / Naik Ke Kelas</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{filteredIndividual.length === 0 ? (
									<tr>
										<td colSpan={5} className='text-center py-8 text-gray-500'>
											Tidak ada santri/siswa yang cocok dengan filter.
										</td>
									</tr>
								) : (
									filteredIndividual.map((s, idx) => (
										<tr key={s.siswa_id} className='hover:bg-amber-50/60'>
											<td className='py-2.5 px-3 font-mono'>{idx + 1}</td>
											<td className='py-2.5 px-3 font-mono text-gray-500 text-[11px]'>{s.nis || '-'}</td>
											<td className='py-2.5 px-3 font-black text-black'>{s.nama}</td>
											<td className='py-2.5 px-3'>
												<span className='px-2.5 py-0.5 bg-yellow-100 border border-black rounded text-xs font-bold'>
													{s.kelas_lama}
												</span>
											</td>
											<td className='py-2.5 px-3'>
												<select
													value={s.ke_kelas}
													onChange={(e) => handleIndividualChange(s.siswa_id, e.target.value)}
													className='px-2.5 py-1.5 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0]'>
													<option value=''>-- Tetap di {s.kelas_lama} --</option>
													{kelasList.map((k) => (
														<option key={k.id} value={k.nama_kelas}>
															Pindah ke: {k.nama_kelas}
														</option>
													))}
													<option value='Lulus'>🎓 Lulus</option>
												</select>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
