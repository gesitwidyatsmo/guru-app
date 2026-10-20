'use client';

import { useState } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export default function KurikulumTahunAjarPage() {
	const { daftarTahunAjar, tahunAjarAktif, semesterAktif, refreshDaftar } = useAcademic();
	const [loading, setLoading] = useState(false);
	const [isSavingTA, setIsSavingTA] = useState(false);
	const [isSettingAktif, setIsSettingAktif] = useState(false);
	const [showFormTA, setShowFormTA] = useState(false);
	const [formTA, setFormTA] = useState({
		nama: '',
		semester: '1',
		tanggal_mulai: '',
		tanggal_selesai: '',
	});

	// Tambah Tahun Ajaran Baru
	const handleBuatTA = async (e) => {
		e.preventDefault();
		if (!formTA.nama.trim() || !formTA.semester) {
			Swal.fire('Perhatian', 'Nama Tahun Ajar dan Semester wajib diisi!', 'warning');
			return;
		}

		try {
			setIsSavingTA(true);
			const res = await fetch('/api/tahun-ajar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formTA),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal membuat tahun ajar baru.');

			Swal.fire('Berhasil!', `Tahun Ajar ${formTA.nama} Semester ${formTA.semester} berhasil ditambahkan.`, 'success');
			setFormTA({ nama: '', semester: '1', tanggal_mulai: '', tanggal_selesai: '' });
			setShowFormTA(false);
			await refreshDaftar();
		} catch (err) {
			Swal.fire('Gagal', err.message, 'error');
		} finally {
			setIsSavingTA(false);
		}
	};

	// Set Semester / Tahun Ajaran Aktif
	const handleSetAktif = async (ta) => {
		const result = await Swal.fire({
			title: 'Aktifkan Periode Akademik?',
			html: `Anda akan menetapkan <b>${ta.nama} Semester ${ta.semester}</b> sebagai periode aktif seluruh sistem GuruApp.<br/><br/><span class="text-xs text-amber-700">Seluruh absensi, jurnal, dan penilaian akan terikat pada periode ini.</span>`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Aktifkan',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				setIsSettingAktif(true);
				const res = await fetch('/api/tahun-ajar/aktif', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: ta.id }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Gagal mengaktifkan periode.');

				Swal.fire('Periode Aktif!', `Tahun Ajar ${ta.nama} Semester ${ta.semester} kini aktif.`, 'success');
				await refreshDaftar();
			} catch (err) {
				Swal.fire('Gagal Mengaktifkan', err.message, 'error');
			} finally {
				setIsSettingAktif(false);
			}
		}
	};

	if (loading) return <Loader text='Memuat Kalender Akademik...' />;

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
						<span>📅</span> Tahun Ajar & Kalender Akademik
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl'>
						Penetapan semester dan tahun ajaran aktif, pengaturan pekan efektif KBM, serta kalender pendidikan sekolah.
					</p>
				</div>
				<div className='flex items-center gap-3 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={() => setShowFormTA(!showFormTA)}
						className='px-4 py-2.5 bg-black text-white hover:bg-neutral-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5'>
						<span>{showFormTA ? '✕ Tutup' : '➕ Tambah Periode'}</span>
					</button>
				</div>
			</div>

			{/* FORM TAMBAH PERIODE BARU */}
			{showFormTA && (
				<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] animate-in fade-in duration-200'>
					<h3 className='text-base font-black flex items-center gap-2 mb-3 border-b-2 border-black pb-2'>
						<span>➕</span> Buat Tahun Ajaran / Semester Baru
					</h3>

					<form onSubmit={handleBuatTA} className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
						<div>
							<label className='block text-xs font-black uppercase text-black mb-1'>
								Nama Tahun Ajar *
							</label>
							<input
								type='text'
								value={formTA.nama}
								onChange={(e) => setFormTA({ ...formTA, nama: e.target.value })}
								placeholder='Contoh: 2026/2027'
								required
								className='w-full px-3 py-2 border-2 border-black rounded-xl font-bold text-xs bg-[#FFFDF0]'
							/>
						</div>

						<div>
							<label className='block text-xs font-black uppercase text-black mb-1'>
								Semester *
							</label>
							<select
								value={formTA.semester}
								onChange={(e) => setFormTA({ ...formTA, semester: e.target.value })}
								className='w-full px-3 py-2 border-2 border-black rounded-xl font-bold text-xs bg-[#FFFDF0]'>
								<option value='1'>Semester 1 (Ganjil)</option>
								<option value='2'>Semester 2 (Genap)</option>
							</select>
						</div>

						<div>
							<label className='block text-xs font-black uppercase text-black mb-1'>
								Tanggal Mulai
							</label>
							<input
								type='date'
								value={formTA.tanggal_mulai}
								onChange={(e) => setFormTA({ ...formTA, tanggal_mulai: e.target.value })}
								className='w-full px-3 py-2 border-2 border-black rounded-xl font-bold text-xs bg-[#FFFDF0]'
							/>
						</div>

						<div>
							<label className='block text-xs font-black uppercase text-black mb-1'>
								Tanggal Selesai
							</label>
							<input
								type='date'
								value={formTA.tanggal_selesai}
								onChange={(e) => setFormTA({ ...formTA, tanggal_selesai: e.target.value })}
								className='w-full px-3 py-2 border-2 border-black rounded-xl font-bold text-xs bg-[#FFFDF0]'
							/>
						</div>

						<div className='sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2'>
							<button
								type='button'
								onClick={() => setShowFormTA(false)}
								className='px-4 py-2 border-2 border-black rounded-xl font-black text-xs hover:bg-gray-100'>
								Batal
							</button>
							<button
								type='submit'
								disabled={isSavingTA}
								className='px-5 py-2 bg-amber-400 hover:bg-amber-500 text-black border-2 border-black rounded-xl font-black text-xs shadow-[2px_2px_0px_0px_#0D0D0D]'>
								{isSavingTA ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
							</button>
						</div>
					</form>
				</div>
			)}

			{/* DAFTAR PERIODE AKADEMIK */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
						<span>📋</span> Katalog Periode Tahun Ajaran ({daftarTahunAjar?.length || 0})
					</h2>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
					{(daftarTahunAjar || []).map((ta) => {
						const isAktif = ta.is_aktif || (ta.nama === tahunAjarAktif && ta.semester === semesterAktif);
						return (
							<div
								key={ta.id || `${ta.nama}-${ta.semester}`}
								className={`border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex flex-col justify-between ${
									isAktif ? 'bg-amber-100' : 'bg-white'
								}`}>
								<div>
									<div className='flex items-center justify-between mb-2'>
										<span className='px-2.5 py-0.5 bg-black text-white text-[10px] font-black uppercase rounded'>
											Semester {ta.semester} ({ta.semester === 1 ? 'Ganjil' : 'Genap'})
										</span>
										{isAktif && (
											<span className='px-2.5 py-0.5 bg-emerald-400 text-black border border-black rounded-lg text-[10px] font-black uppercase animate-pulse'>
												Aktif
											</span>
										)}
									</div>
									<h3 className='text-xl font-black text-black tracking-tight'>{ta.nama}</h3>
									<p className='text-xs font-bold text-gray-600 mt-1'>
										{ta.tanggal_mulai && ta.tanggal_selesai
											? `${ta.tanggal_mulai} s.d. ${ta.tanggal_selesai}`
											: 'Jadwal pekan efektif belum diatur'}
									</p>
								</div>

								<div className='pt-4 mt-4 border-t-2 border-black/20 flex items-center justify-between'>
									<span className='text-[10px] font-mono text-gray-500'>ID: {ta.id}</span>
									{!isAktif ? (
										<button
											onClick={() => handleSetAktif(ta)}
											disabled={isSettingAktif}
											className='px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-black border-2 border-black rounded-xl font-black text-xs shadow-[2px_2px_0px_0px_#0D0D0D] transition-all active:translate-x-0.5 active:translate-y-0.5'>
											Aktifkan
										</button>
									) : (
										<span className='text-xs font-black text-emerald-800 flex items-center gap-1'>
											<span>✓</span> Sedang Berjalan
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
