'use client';

import { useState, useEffect } from 'react';
import Loader from '@/app/components/loading';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

export default function PromosiKelasAdminPage() {
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [loading, setLoading] = useState(true);

	const [promosiMode, setPromosiMode] = useState('massal');
	const [promosiMassal, setPromosiMassal] = useState([]);
	const [promosiIndividual, setPromosiIndividual] = useState([]);
	const [isSavingPromosi, setIsSavingPromosi] = useState(false);

	const [searchSiswaPromosi, setSearchSiswaPromosi] = useState('');
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
			console.error('Error load data promosi:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Handler: Promosi Massal
	const handlePromosiMassal = async () => {
		const items = promosiMassal.filter((p) => p.ke_kelas && p.ke_kelas !== p.dari_kelas);
		if (items.length === 0) {
			Swal.fire('Info', 'Tidak ada rombel kelas yang dipilih untuk dipromosikan.', 'info');
			return;
		}

		const result = await Swal.fire({
			title: 'Konfirmasi Promosi Massal',
			html: `
				<div class="text-left text-sm space-y-2">
					<p>Sebanyak <b>${items.length}</b> rombongan belajar akan dipromosikan:</p>
					<ul class="list-disc pl-5 font-bold text-xs bg-yellow-100 p-2.5 rounded-xl border-2 border-black">
						${items.map((i) => `<li>${i.dari_kelas} &rarr; ${i.ke_kelas}</li>`).join('')}
					</ul>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Jalankan Promosi',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'massal', items }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);

			Swal.fire('Berhasil!', data.message || 'Promosi massal kelas berhasil diproses.', 'success');
			loadData();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSavingPromosi(false);
		}
	};

	// Handler: Promosi Individual
	const handlePromosiIndividual = async () => {
		const items = promosiIndividual.filter((p) => p.ke_kelas && p.ke_kelas !== p.kelas_lama);
		if (items.length === 0) {
			Swal.fire('Info', 'Tidak ada siswa yang dipilih untuk dipindahkan/dipromosikan.', 'info');
			return;
		}

		const result = await Swal.fire({
			title: 'Konfirmasi Promosi Individual',
			text: `${items.length} siswa akan diperbarui data kelasnya.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Simpan Pemetaan',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'individual',
					items: items.map((p) => ({ siswa_id: p.siswa_id, ke_kelas: p.ke_kelas })),
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);

			Swal.fire('Berhasil!', data.message || 'Pemetaan kelas individual berhasil diperbarui.', 'success');
			loadData();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		} finally {
			setIsSavingPromosi(false);
		}
	};

	// Handler: Download Template Excel Penjurusan / Plotting
	const handleDownloadTemplatePenjurusan = () => {
		let targetStudents = siswaList;
		if (filterKelasAsal !== 'all') {
			targetStudents = siswaList.filter((s) => s.kelas === filterKelasAsal);
		}
		if (targetStudents.length === 0) {
			Swal.fire('Perhatian', 'Tidak ada siswa aktif pada kelas yang dipilih.', 'warning');
			return;
		}

		const dataToExport = targetStudents.map((s, idx) => ({
			No: idx + 1,
			NIS: s.nis || '',
			'Nama Siswa': s.nama_lengkap,
			'Kelas Asal': s.kelas,
			'Kelas Baru': '', // diisi oleh kurikulum/admin (misal: 11-IPA-1, 11-IPS-2, atau Lulus)
		}));

		const ws = XLSX.utils.json_to_sheet(dataToExport);
		ws['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 22 }];
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Plotting_Penjurusan');

		const fileName = `Template_Penjurusan_${filterKelasAsal === 'all' ? 'Semua_Kelas' : filterKelasAsal}_${new Date().getFullYear()}.xlsx`;
		XLSX.writeFile(wb, fileName);
	};

	// Handler: Upload Mapping Excel Penjurusan / Plotting
	const handleUploadExcelPenjurusan = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const arrayBuffer = await file.arrayBuffer();
			const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
			const sheetName = workbook.SheetNames[0];
			const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

			if (!rawData || rawData.length === 0) {
				Swal.fire('Error', 'File Excel kosong atau format kolom tidak sesuai.', 'error');
				return;
			}

			const parsedItems = [];
			for (const row of rawData) {
				const nis = String(row['NIS'] || row['nis'] || '').trim();
				const nama = String(row['Nama Siswa'] || row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || '').trim();
				const keKelas = String(row['Kelas Baru'] || row['kelas_baru'] || row['Ke Kelas'] || row['ke_kelas'] || '').trim();

				if ((nis || nama) && keKelas) {
					let matchedSiswa = null;
					if (nis) {
						matchedSiswa = siswaList.find((s) => String(s.nis).trim() === nis);
					}
					if (!matchedSiswa && nama) {
						matchedSiswa = siswaList.find((s) => s.nama_lengkap.toLowerCase() === nama.toLowerCase());
					}

					if (matchedSiswa) {
						parsedItems.push({
							siswa_id: matchedSiswa.id,
							nis: matchedSiswa.nis,
							nama: matchedSiswa.nama_lengkap,
							kelas_lama: matchedSiswa.kelas,
							ke_kelas: keKelas,
						});
					} else {
						parsedItems.push({
							nis,
							nama,
							ke_kelas: keKelas,
						});
					}
				}
			}

			if (parsedItems.length === 0) {
				Swal.fire('Perhatian', 'Tidak ditemukan data pemetaan kelas yang valid pada kolom "Kelas Baru". Pastikan kolom terisi.', 'warning');
				return;
			}

			const confirm = await Swal.fire({
				title: 'Konfirmasi Plotting Penjurusan',
				html: `
					<div class="text-left text-sm space-y-2">
						<p>Ditemukan <b>${parsedItems.length}</b> siswa dengan pemetaan kelas baru dari file Excel.</p>
						<p class="text-gray-600 text-xs">Contoh sampel 3 data pertama:</p>
						<ul class="list-disc pl-5 text-xs font-bold bg-yellow-100 p-2.5 rounded-xl border-2 border-black">
							${parsedItems.slice(0, 3).map((p) => `<li>${p.nama || p.nis} (${p.kelas_lama || 'Asal'} &rarr; ${p.ke_kelas})</li>`).join('')}
						</ul>
					</div>
				`,
				icon: 'question',
				showCancelButton: true,
				confirmButtonText: 'Ya, Jalankan Plotting',
				cancelButtonText: 'Batal',
				confirmButtonColor: '#00A693',
				cancelButtonColor: '#0D0D0D',
			});

			if (!confirm.isConfirmed) return;

			setIsSavingPromosi(true);
			const res = await fetch('/api/promosi-kelas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'individual', items: parsedItems }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memproses pemetaan kelas.');

			Swal.fire('Berhasil!', data.message || `Berhasil memplot ${parsedItems.length} siswa ke kelas baru.`, 'success');
			loadData();
		} catch (err) {
			console.error(err);
			Swal.fire('Error', err.message || 'Gagal membaca file Excel.', 'error');
		} finally {
			setIsSavingPromosi(false);
			e.target.value = '';
		}
	};

	if (loading) return <Loader />;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D]'>
				<div className='inline-flex items-center gap-2 px-3 py-1 bg-purple-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
					<span>🎓</span> Kenaikan Tingkat & Penjurusan
				</div>
				<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
					Promosi Kelas & Plotting Siswa
				</h1>
				<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
					Pindahkan rombongan belajar secara massal atau petakan penjurusan minat siswa (IPA/IPS/Bahasa) via Excel.
				</p>
			</div>

			{/* Mode Switcher Tabs */}
			<div className='flex flex-wrap gap-2 bg-yellow-100 p-2 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] w-fit shrink-0'>
				{[
					{ id: 'massal', label: '🏫 Promosi Massal (Per Rombel)' },
					{ id: 'individual', label: '👤 Individual / Plotting Excel' },
				].map((mode) => (
					<button
						key={mode.id}
						onClick={() => setPromosiMode(mode.id)}
						className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase transition-all whitespace-nowrap border-2 ${
							promosiMode === mode.id
								? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_#F5C518] translate-x-[-1px] translate-y-[-1px]'
								: 'bg-white text-black border-black hover:bg-yellow-200 shadow-[2px_2px_0px_0px_#0D0D0D]'
						}`}>
						{mode.label}
					</button>
				))}
			</div>

			{/* ======================================================== */}
			{/* MODE 1: PROMOSI MASSAL                                   */}
			{/* ======================================================== */}
			{promosiMode === 'massal' && (
				<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-6 animate-in fade-in duration-150'>
					<div>
						<h2 className='text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
							<span>🏫</span> Promosi Massal Antar Rombel
						</h2>
						<p className='text-xs font-medium text-gray-600 mt-1'>
							Pilih kelas target untuk setiap rombongan belajar. Seluruh siswa pada kelas asal akan langsung dinaikkan ke kelas target yang dipilih.
						</p>
					</div>

					<div className='space-y-3'>
						{promosiMassal.map((item, idx) => (
							<div
								key={idx}
								className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-yellow-50/50 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
								<div className='flex items-center gap-3 w-full sm:w-1/3'>
									<span className='w-8 h-8 rounded-lg bg-orange-300 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D]'>
										{idx + 1}
									</span>
									<span className='font-black text-base text-black'>{item.dari_kelas}</span>
								</div>

								<div className='hidden sm:flex items-center text-gray-500 font-bold'>
									&rarr;
								</div>

								<div className='w-full sm:w-1/2 flex items-center gap-2'>
									<select
										value={item.ke_kelas}
										onChange={(e) => {
											const updated = [...promosiMassal];
											updated[idx].ke_kelas = e.target.value;
											setPromosiMassal(updated);
										}}
										className='neo-input text-xs sm:text-sm bg-white font-bold'>
										<option value=''>-- Tetap / Tidak Diubah --</option>
										{kelasList.map((k) => (
											<option key={k.id || k.nama_kelas || k.kelas} value={k.nama_kelas || k.kelas}>
												{k.nama_kelas || k.kelas}
											</option>
										))}
										<option value='Lulus'>🎓 Lulus (Keluarkan dari Kelas Aktif)</option>
									</select>
								</div>
							</div>
						))}
					</div>

					<div className='pt-4 border-t-2 border-black/10 flex justify-end'>
						<button
							onClick={handlePromosiMassal}
							disabled={isSavingPromosi}
							className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-3 !px-6 bg-black text-white disabled:opacity-50'>
							{isSavingPromosi ? 'Memproses Promosi...' : '🎓 Jalankan Promosi Massal'}
						</button>
					</div>
				</div>
			)}

			{/* ======================================================== */}
			{/* MODE 2: PROMOSI INDIVIDUAL & EXCEL TOOLBAR               */}
			{/* ======================================================== */}
			{promosiMode === 'individual' && (
				<div className='space-y-6 animate-in fade-in duration-150'>
					{/* Excel Bulk Plotting Toolbar */}
					<div className='bg-gradient-to-br from-purple-100 via-indigo-50 to-pink-50 border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
							<div>
								<div className='inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-400 text-black border-2 border-black rounded-md text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D] mb-1.5'>
									<span>📊</span> Plotting Penjurusan Cepat
								</div>
								<h3 className='text-lg font-black text-black uppercase tracking-tight'>
									Impor Pemetaan Penjurusan via Excel
								</h3>
								<p className='text-xs font-medium text-gray-700 max-w-xl'>
									Unduh format daftar siswa terisi, tentukan kolom <b>Kelas Baru</b> di Excel (misal sebar kelas 10 ke 11-MIPA-1, 11-IPS-2, atau Lulus), lalu unggah kembali ke sini.
								</p>
							</div>

							<div className='flex flex-wrap items-center gap-3'>
								<button
									onClick={handleDownloadTemplatePenjurusan}
									className='neo-btn-outline flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 bg-white'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
									</svg>
									<span>Download Template ({filterKelasAsal === 'all' ? 'Semua' : filterKelasAsal})</span>
								</button>

								<label className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-4 bg-black text-white cursor-pointer'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' />
									</svg>
									<span>Upload Excel (.xlsx)</span>
									<input
										type='file'
										accept='.xlsx, .xls'
										onChange={handleUploadExcelPenjurusan}
										className='hidden'
										disabled={isSavingPromosi}
									/>
								</label>
							</div>
						</div>
					</div>

					{/* Manual Filter & Student List */}
					<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						{/* Filters */}
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b-2 border-black/10'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Filter Berdasarkan Kelas Asal:
								</label>
								<select
									value={filterKelasAsal}
									onChange={(e) => setFilterKelasAsal(e.target.value)}
									className='neo-input text-xs sm:text-sm bg-white font-bold'>
									<option value='all'>Semua Kelas Asal ({siswaList.length} siswa)</option>
									{kelasList.map((k) => {
										const cCount = siswaList.filter((s) => s.kelas === (k.nama_kelas || k.kelas)).length;
										return (
											<option key={k.id || k.nama_kelas || k.kelas} value={k.nama_kelas || k.kelas}>
												{k.nama_kelas || k.kelas} ({cCount} siswa)
											</option>
										);
									})}
								</select>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
									Pencarian Nama / NIS Siswa:
								</label>
								<input
									type='text'
									placeholder='Ketik nama atau NIS...'
									value={searchSiswaPromosi}
									onChange={(e) => setSearchSiswaPromosi(e.target.value)}
									className='neo-input text-xs sm:text-sm'
								/>
							</div>
						</div>

						{/* Table List */}
						<div className='border-2 border-black rounded-xl overflow-hidden max-h-[500px] overflow-y-auto'>
							<table className='w-full text-left border-collapse'>
								<thead>
									<tr className='bg-yellow-300 border-b-2 border-black sticky top-0 z-10'>
										<th className='px-4 py-3 text-xs font-black text-black uppercase'>Identitas Siswa</th>
										<th className='px-4 py-3 text-xs font-black text-black uppercase'>Kelas Asal</th>
										<th className='px-4 py-3 text-xs font-black text-black uppercase'>Pilih Kelas / Jurusan Baru</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-black/10'>
									{promosiIndividual
										.filter((s) => {
											const matchClass = filterKelasAsal === 'all' || s.kelas_lama === filterKelasAsal;
											const matchSearch =
												!searchSiswaPromosi ||
												s.nama.toLowerCase().includes(searchSiswaPromosi.toLowerCase()) ||
												(s.nis && s.nis.toLowerCase().includes(searchSiswaPromosi.toLowerCase()));
											return matchClass && matchSearch;
										})
										.map((item) => {
											const origIdx = promosiIndividual.findIndex((p) => p.siswa_id === item.siswa_id);
											const isChanged = item.ke_kelas && item.ke_kelas !== item.kelas_lama;
											return (
												<tr
													key={item.siswa_id}
													className={`transition-colors ${isChanged ? 'bg-emerald-50' : 'hover:bg-yellow-50/50'}`}>
													<td className='px-4 py-3'>
														<span className='font-black text-black block text-sm'>{item.nama}</span>
														<span className='text-[11px] font-mono font-bold text-gray-500'>
															NIS: {item.nis || '-'}
														</span>
													</td>

													<td className='px-4 py-3'>
														<span className='px-2.5 py-1 text-xs font-black bg-gray-100 border border-black rounded-md'>
															{item.kelas_lama}
														</span>
													</td>

													<td className='px-4 py-3'>
														<select
															value={item.ke_kelas}
															onChange={(e) => {
																const updated = [...promosiIndividual];
																updated[origIdx].ke_kelas = e.target.value;
																setPromosiIndividual(updated);
															}}
															className={`border-2 border-black rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
																isChanged ? 'bg-emerald-300 text-black shadow-[2px_2px_0px_0px_#0D0D0D]' : 'bg-white text-black'
															}`}>
															<option value=''>-- Tetap (Tidak Diubah) --</option>
															{kelasList.map((k) => (
																<option key={k.id || k.nama_kelas || k.kelas} value={k.nama_kelas || k.kelas}>
																	{k.nama_kelas || k.kelas}
																</option>
															))}
															<option value='Lulus'>🎓 Lulus</option>
															<option value='Mutasi'>Pindah / Mutasi</option>
														</select>
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>

						{/* Footer Actions */}
						<div className='pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
							<p className='text-xs font-bold text-gray-600'>
								{promosiIndividual.filter((p) => p.ke_kelas && p.ke_kelas !== p.kelas_lama).length} siswa siap dipromosikan / dipetakan.
							</p>

							<button
								onClick={handlePromosiIndividual}
								disabled={isSavingPromosi || promosiIndividual.filter((p) => p.ke_kelas && p.ke_kelas !== p.kelas_lama).length === 0}
								className='neo-btn-primary flex items-center gap-2 text-xs sm:text-sm !py-2.5 !px-6 bg-black text-white disabled:opacity-50'>
								<span>💾</span>
								<span>{isSavingPromosi ? 'Menyimpan...' : 'Simpan Pemetaan Individual'}</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
