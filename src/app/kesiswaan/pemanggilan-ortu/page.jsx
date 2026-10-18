'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';

function PemanggilanOrtuContent() {
	const searchParams = useSearchParams();
	const paramSiswaId = searchParams.get('siswa_id');
	const paramPenangananId = searchParams.get('penanganan_id');
	const paramNama = searchParams.get('nama');

	const [pemanggilanList, setPemanggilanList] = useState([]);
	const [summary, setSummary] = useState({
		total: 0,
		dijadwalkan: 0,
		hadir: 0,
		reschedule: 0,
		selesai: 0,
	});
	const [allSiswa, setAllSiswa] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterStatus, setFilterStatus] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	// Modal State
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showBeritaAcaraModal, setShowBeritaAcaraModal] = useState(false);
	const [selectedItem, setSelectedItem] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	// Form State
	const [formData, setFormData] = useState({
		siswa_id: paramSiswaId || '',
		penanganan_id: paramPenangananId || '',
		nomor_surat: '',
		tanggal_pemanggilan: new Date().toISOString().slice(0, 10),
		waktu_pemanggilan: '09:00 WIB',
		tempat: 'Ruang Kesiswaan / BK',
		alasan_pemanggilan: 'Pembinaan kedisiplinan dan koordinasi kehadiran santri terkait catatan bolos jam pelajaran.',
	});

	// Berita Acara State
	const [beritaAcara, setBeritaAcara] = useState({
		id: null,
		status: 'Hadir',
		catatan_hasil_pertemuan: '',
		komitmen_ortu_santri: '',
	});

	// Fetch Data Pemanggilan
	const fetchPemanggilan = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (filterStatus && filterStatus !== 'Semua') params.append('status', filterStatus);
			if (searchQuery && searchQuery.trim() !== '') params.append('search', searchQuery.trim());

			const res = await fetch(`/api/kesiswaan/pemanggilan-ortu?${params.toString()}`);
			const data = await res.json();

			if (data.success) {
				setPemanggilanList(data.pemanggilanList || []);
				setSummary(data.summary || {});
			}
		} catch (err) {
			console.error('Error fetching pemanggilan ortu:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setLoading(false);
		}
	}, [filterStatus, searchQuery]);

	// Fetch Siswa untuk Dropdown
	useEffect(() => {
		fetch('/api/siswa')
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setAllSiswa(Array.isArray(data) ? data : []))
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetchPemanggilan();
	}, [fetchPemanggilan]);

	// Auto open modal jika ada parameter dari query
	useEffect(() => {
		if (paramSiswaId) {
			setFormData((prev) => ({
				...prev,
				siswa_id: paramSiswaId,
				penanganan_id: paramPenangananId || '',
				alasan_pemanggilan: `Tindak lanjut pembinaan kesiswaan santri an. ${paramNama || 'Santri'} terkait akumulasi ketidakhadiran / bolos jam pelajaran.`,
			}));
			setShowCreateModal(true);
		}
	}, [paramSiswaId, paramPenangananId, paramNama]);

	// Submit Buat Surat Pemanggilan
	const handleCreateSubmit = async (e) => {
		e.preventDefault();
		if (!formData.siswa_id || !formData.tanggal_pemanggilan || !formData.alasan_pemanggilan) {
			Swal.fire({
				icon: 'warning',
				title: 'Data Belum Lengkap',
				text: 'Silakan pilih santri, tanggal pemanggilan, dan alasan pemanggilan.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		try {
			setSubmitting(true);
			const res = await fetch('/api/kesiswaan/pemanggilan-ortu', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});
			const result = await res.json();

			if (!res.ok || !result.success) {
				throw new Error(result.error || 'Gagal menerbitkan pemanggilan');
			}

			Swal.fire({
				icon: 'success',
				title: 'Surat Berhasil Diterbitkan!',
				text: result.message,
				confirmButtonColor: '#10B981',
			});

			setShowCreateModal(false);
			fetchPemanggilan();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menerbitkan',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSubmitting(false);
		}
	};

	// Open Berita Acara Modal
	const handleOpenBeritaAcara = (item) => {
		setSelectedItem(item);
		setBeritaAcara({
			id: item.id,
			status: item.status === 'Dijadwalkan' ? 'Hadir' : item.status,
			catatan_hasil_pertemuan: item.catatan_hasil_pertemuan || '',
			komitmen_ortu_santri: item.komitmen_ortu_santri || '',
		});
		setShowBeritaAcaraModal(true);
	};

	// Submit Berita Acara
	const handleBeritaAcaraSubmit = async (e) => {
		e.preventDefault();
		try {
			setSubmitting(true);
			const res = await fetch('/api/kesiswaan/pemanggilan-ortu', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(beritaAcara),
			});
			const result = await res.json();

			if (!res.ok || !result.success) throw new Error(result.error);

			Swal.fire({
				icon: 'success',
				title: 'Berita Acara Disimpan!',
				text: 'Catatan pertemuan bersama orang tua berhasil dicatat.',
				confirmButtonColor: '#10B981',
			});

			setShowBeritaAcaraModal(false);
			fetchPemanggilan();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSubmitting(false);
		}
	};

	// Hapus Pemanggilan
	const handleDelete = async (id, nama) => {
		const confirm = await Swal.fire({
			title: 'Hapus Agenda Pemanggilan?',
			text: `Agenda pemanggilan orang tua dari santri ${nama} akan dihapus.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
		});

		if (confirm.isConfirmed) {
			try {
				const res = await fetch(`/api/kesiswaan/pemanggilan-ortu?id=${id}`, { method: 'DELETE' });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error);

				Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Agenda berhasil dihapus.' });
				fetchPemanggilan();
			} catch (err) {
				Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
			}
		}
	};

	// Format Draf Pesan WhatsApp Undangan Resmi
	const getWhatsAppInviteUrl = (item) => {
		const text = `*Assalamu'alaikum Warahmatullahi Wabarakatuh.*

Kepada Yth.
Bapak/Ibu Orang Tua / Wali Murid dari *${item.nama_lengkap}* (Kelas ${item.kelas})
di Tempat

_Dengan hormat,_

Semoga Bapak/Ibu senantiasa dalam keadaan sehat wal'afiat.

Sehubungan dengan pentingnya evaluasi proses belajar serta pembinaan kedisiplinan dan kehadiran ananda di sekolah, kami dari Bagian Kesiswaan mengundang Bapak/Ibu untuk berkenan hadir ke sekolah pada:

📅 *Hari / Tanggal* : ${item.tanggal_pemanggilan}
⏰ *Pukul* : ${item.waktu_pemanggilan}
📍 *Tempat* : ${item.tempat}
📋 *Perihal* : ${item.alasan_pemanggilan}
🔖 *Nomor Surat* : ${item.nomor_surat || '—'}

Kehadiran Bapak/Ibu sangat kami harapkan demi kelancaran dan masa depan pendidikan ananda tercinta.

Atas perhatian dan kerjasamanya, kami haturkan terima kasih.

*Wassalamu'alaikum Warahmatullahi Wabarakatuh.*

*Hormat kami,*
*Bagian Kesiswaan Sekolah*`;

		const phone = item.nomor_telepon_orang_tua?.replace(/[^0-9]/g, '') || '';
		const targetUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
		return targetUrl;
	};

	if (loading && pemanggilanList.length === 0 && allSiswa.length === 0) {
		return <Loader />;
	}

	return (
		<div className='space-y-6'>
			{/* Banner Utama */}
			<div className='p-6 bg-gradient-to-r from-rose-100 via-pink-100 to-yellow-100 border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-white text-[10px] font-black rounded-md uppercase tracking-wider'>
							Eskalasi Resmi
						</span>
						<span className='px-2 py-0.5 bg-rose-400 border border-black rounded-md text-[10px] font-black text-black'>
							Data Resmi ke Wali Murid
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>📩</span> Pemanggilan Orang Tua & Arsip Kasus
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-2xl'>
						Penerbitan surat pemanggilan resmi dan berita acara konseling bersama orang tua/wali murid berdasarkan rekam jejak bimbingan wali kelas.
					</p>
				</div>

				<button
					onClick={() => {
						setSelectedItem(null);
						setFormData({
							siswa_id: '',
							penanganan_id: '',
							nomor_surat: '',
							tanggal_pemanggilan: new Date().toISOString().slice(0, 10),
							waktu_pemanggilan: '09:00 WIB',
							tempat: 'Ruang Kesiswaan / BK',
							alasan_pemanggilan: 'Pembinaan kedisiplinan dan koordinasi kehadiran santri terkait catatan bolos jam pelajaran.',
						});
						setShowCreateModal(true);
					}}
					className='px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-2xl font-black text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5 shrink-0'>
					<span>➕</span> Terbitkan Surat Pemanggilan
				</button>
			</div>

			{/* Kartu Ringkasan Status */}
			<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4'>
				<div className='bg-white p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-gray-500 block mb-0.5'>Total Surat Terbit</span>
					<div className='text-2xl font-black text-black'>{summary.total}</div>
					<span className='text-[10px] font-bold text-gray-600'>Arsip pemanggilan</span>
				</div>

				<div className='bg-yellow-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-amber-700 block mb-0.5'>📅 Dijadwalkan</span>
					<div className='text-2xl font-black text-amber-800'>{summary.dijadwalkan}</div>
					<span className='text-[10px] font-bold text-amber-900'>Menunggu kehadiran</span>
				</div>

				<div className='bg-emerald-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-emerald-700 block mb-0.5'>🤝 Hadir / Terlaksana</span>
					<div className='text-2xl font-black text-emerald-800'>{summary.hadir}</div>
					<span className='text-[10px] font-bold text-emerald-900'>Konseling telah berlangsung</span>
				</div>

				<div className='bg-blue-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-blue-700 block mb-0.5'>✅ Kasus Selesai</span>
					<div className='text-2xl font-black text-blue-800'>{summary.selesai}</div>
					<span className='text-[10px] font-bold text-blue-900'>Komitmen disepakati</span>
				</div>
			</div>

			{/* Tabel Daftar Pemanggilan */}
			<div className='bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				{/* Toolbar Filter */}
				<div className='p-4 border-b-2 border-black bg-yellow-50 flex flex-wrap items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<label className='text-[10px] font-black uppercase text-gray-600'>Filter Status:</label>
						<select
							value={filterStatus}
							onChange={(e) => setFilterStatus(e.target.value)}
							className='neo-input !py-1 text-xs font-bold bg-white'>
							<option value='Semua'>Semua Status</option>
							<option value='Dijadwalkan'>📅 Dijadwalkan</option>
							<option value='Hadir'>🤝 Hadir</option>
							<option value='Reschedule'>🔄 Reschedule</option>
							<option value='Selesai'>✅ Selesai</option>
						</select>
					</div>

					<div className='w-full sm:w-72'>
						<input
							type='text'
							placeholder='Cari santri atau nomor surat...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='neo-input !py-1 text-xs w-full bg-white font-medium'
						/>
					</div>
				</div>

				{loading ? (
					<div className='p-16 text-center space-y-3 bg-white'>
						<div className='inline-block w-9 h-9 border-4 border-black border-t-yellow-400 rounded-full animate-spin'></div>
						<p className='text-xs font-black text-black tracking-wide'>Memuat arsip pemanggilan orang tua...</p>
					</div>
				) : pemanggilanList.length === 0 ? (
					<div className='p-12 text-center space-y-2'>
						<span className='text-4xl block'>📩</span>
						<p className='text-base font-black text-black'>Belum Ada Surat Pemanggilan Orang Tua</p>
						<p className='text-xs text-gray-500 max-w-md mx-auto'>
							Gunakan tombol <b>➕ Terbitkan Surat Pemanggilan</b> atau tombol panggil orang tua dari menu <i>Radar Absensi</i> / <i>Buku Bimbingan Santri</i>.
						</p>
					</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[1050px] text-left text-sm'>
							<thead>
								<tr className='border-b-2 border-black text-xs font-black uppercase text-black bg-yellow-100/70'>
									<th className='py-3 px-4'>No Surat & Tgl</th>
									<th className='py-3 px-4'>Santri & Rombel</th>
									<th className='py-3 px-4'>Jadwal Pertemuan</th>
									<th className='py-3 px-4'>Alasan & Berita Acara</th>
									<th className='py-3 px-4 text-center'>Status</th>
									<th className='py-3 px-4 text-right'>Aksi</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-gray-200 font-bold'>
								{pemanggilanList.map((item) => (
									<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
										<td className='py-3.5 px-4'>
											<p className='font-mono text-xs font-black text-black'>{item.nomor_surat || '—'}</p>
											<span className='text-[10px] text-gray-500'>Diterbitkan: {item.created_at?.slice(0, 10)}</span>
										</td>

										<td className='py-3.5 px-4'>
											<p className='font-black text-black'>{item.nama_lengkap}</p>
											<div className='flex items-center gap-1.5 mt-0.5'>
												<span className='px-1.5 py-0.2 bg-yellow-100 border border-black/30 rounded text-[10px] font-black'>
													Kelas {item.kelas}
												</span>
												{item.nomor_telepon_orang_tua && (
													<span className='text-[10px] text-gray-500 font-mono'>
														📞 {item.nomor_telepon_orang_tua}
													</span>
												)}
											</div>
										</td>

										<td className='py-3.5 px-4'>
											<p className='text-xs font-black text-black'>📅 {item.tanggal_pemanggilan}</p>
											<p className='text-[11px] text-gray-600 font-medium'>⏰ {item.waktu_pemanggilan} ({item.tempat})</p>
										</td>

										<td className='py-3.5 px-4 max-w-xs'>
											<p className='text-xs text-gray-800 line-clamp-1'>
												{item.alasan_pemanggilan}
											</p>
											{item.catatan_hasil_pertemuan && (
												<p className='text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 mt-1 line-clamp-1'>
													🤝 Hasil: {item.catatan_hasil_pertemuan}
												</p>
											)}
										</td>

										<td className='py-3.5 px-4 text-center'>
											<span
												className={`px-2.5 py-1 rounded-md text-[11px] font-black border ${
													item.status === 'Hadir'
														? 'bg-emerald-100 text-emerald-950 border-emerald-400'
														: item.status === 'Selesai'
														? 'bg-blue-100 text-blue-900 border-blue-400'
														: item.status === 'Reschedule'
														? 'bg-rose-100 text-rose-900 border-rose-400'
														: 'bg-yellow-100 text-yellow-900 border-yellow-400'
												}`}>
												{item.status}
											</span>
										</td>

										<td className='py-3.5 px-4 text-right'>
											<div className='flex items-center justify-end gap-1.5'>
												<a
													href={getWhatsAppInviteUrl(item)}
													target='_blank'
													rel='noopener noreferrer'
													title='Kirim Undangan Resmi via WhatsApp'
													className='px-2 py-1 bg-emerald-400 hover:bg-emerald-500 text-black border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
													<span>💬</span> Undangan WA
												</a>

												<button
													onClick={() => handleOpenBeritaAcara(item)}
													title='Catat Hasil Pertemuan / Berita Acara'
													className='px-2 py-1 bg-yellow-300 hover:bg-yellow-400 text-black border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
													<span>📝</span> Hasil
												</button>

												<button
													onClick={() => handleDelete(item.id, item.nama_lengkap)}
													title='Hapus'
													className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-400 rounded-lg text-xs'>
													🗑️
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* ======================================================================== */}
			{/* MODAL: TERBITKAN SURAT PEMANGGILAN BARU */}
			{/* ======================================================================== */}
			{showCreateModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-xl max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-6 space-y-4 animate-in fade-in zoom-in duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<span className='px-2 py-0.5 bg-rose-400 border border-black rounded text-[10px] font-black uppercase text-white'>
									Surat Pemanggilan Resmi
								</span>
								<h2 className='text-lg font-black text-black mt-1 flex items-center gap-1.5'>
									<span>📩</span> Terbitkan Surat Panggilan Orang Tua
								</h2>
							</div>
							<button
								type='button'
								onClick={() => setShowCreateModal(false)}
								title='Tutup Formulir'
								className='w-8 h-8 rounded-xl border-2 border-black bg-yellow-200 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<form onSubmit={handleCreateSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Pilih Santri <span className='text-rose-500'>*</span>
								</label>
								<select
									value={formData.siswa_id}
									onChange={(e) => setFormData({ ...formData, siswa_id: e.target.value })}
									required
									className='neo-input w-full text-xs font-bold bg-yellow-50'>
									<option value=''>-- Pilih Santri --</option>
									{allSiswa.map((s) => (
										<option key={s.id} value={s.id}>
											{s.nama_lengkap} (Kelas {s.kelas} - NIS: {s.nis || '—'})
										</option>
									))}
								</select>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Tanggal Pertemuan</label>
									<input
										type='date'
										value={formData.tanggal_pemanggilan}
										onChange={(e) => setFormData({ ...formData, tanggal_pemanggilan: e.target.value })}
										required
										className='neo-input w-full text-xs font-bold bg-white'
									/>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Waktu Pertemuan</label>
									<input
										type='text'
										value={formData.waktu_pemanggilan}
										onChange={(e) => setFormData({ ...formData, waktu_pemanggilan: e.target.value })}
										placeholder='Contoh: 09:00 WIB'
										className='neo-input w-full text-xs font-bold bg-white'
									/>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Tempat Pertemuan</label>
								<input
									type='text'
									value={formData.tempat}
									onChange={(e) => setFormData({ ...formData, tempat: e.target.value })}
									placeholder='Ruang Kesiswaan / BK'
									className='neo-input w-full text-xs font-bold bg-white'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Alasan / Perihal Pemanggilan <span className='text-rose-500'>*</span>
								</label>
								<textarea
									rows='3'
									value={formData.alasan_pemanggilan}
									onChange={(e) => setFormData({ ...formData, alasan_pemanggilan: e.target.value })}
									placeholder='Tulis alasan resmi pemanggilan...'
									required
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setShowCreateModal(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-rose-500 hover:bg-rose-600 text-white shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
									<span>💾</span> {submitting ? 'Menerbitkan...' : 'Terbitkan Surat'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ======================================================================== */}
			{/* MODAL: CATAT BERITA ACARA PERTEMUAN ORANG TUA */}
			{/* ======================================================================== */}
			{showBeritaAcaraModal && selectedItem && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-xl max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-6 space-y-4 animate-in fade-in zoom-in duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded text-[10px] font-black uppercase'>
									Berita Acara Konseling
								</span>
								<h2 className='text-lg font-black text-black mt-1 flex items-center gap-1.5'>
									<span>📝</span> Hasil Pertemuan dengan Orang Tua
								</h2>
								<p className='text-xs text-gray-600 font-semibold'>
									Santri: {selectedItem.nama_lengkap} (Kelas {selectedItem.kelas})
								</p>
							</div>
							<button
								type='button'
								onClick={() => setShowBeritaAcaraModal(false)}
								title='Tutup Formulir'
								className='w-8 h-8 rounded-xl border-2 border-black bg-yellow-200 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<form onSubmit={handleBeritaAcaraSubmit} className='space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>Status Kehadiran Pertemuan</label>
								<select
									value={beritaAcara.status}
									onChange={(e) => setBeritaAcara({ ...beritaAcara, status: e.target.value })}
									className='neo-input w-full text-xs font-bold bg-white'>
									<option value='Hadir'>🤝 Hadir (Pertemuan Terlaksana)</option>
									<option value='Reschedule'>🔄 Reschedule (Minta Dijadwalkan Ulang)</option>
									<option value='Selesai'>✅ Kasus Selesai (Sudah Tertib)</option>
								</select>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Catatan Hasil Pembahasan Bersama Orang Tua
								</label>
								<textarea
									rows='3'
									value={beritaAcara.catatan_hasil_pertemuan}
									onChange={(e) => setBeritaAcara({ ...beritaAcara, catatan_hasil_pertemuan: e.target.value })}
									placeholder='Contoh: Orang tua hadir dan mendengarkan penjelasan rekam jejak bolos anak. Orang tua bersikap kooperatif dan akan memperketat pengawasan...'
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-gray-700 mb-1'>
									Komitmen yang Disepakati (Orang Tua & Santri)
								</label>
								<textarea
									rows='2'
									value={beritaAcara.komitmen_ortu_santri}
									onChange={(e) => setBeritaAcara({ ...beritaAcara, komitmen_ortu_santri: e.target.value })}
									placeholder='Contoh: Santri menandatangani surat komitmen terakhir, bila mengulangi 1 kali lagi bersedia menerima sanksi skorsing...'
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setShowBeritaAcaraModal(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-emerald-400 hover:bg-emerald-500 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
									<span>💾</span> {submitting ? 'Menyimpan...' : 'Simpan Berita Acara'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

export default function PemanggilanOrtuPage() {
	return (
		<Suspense fallback={<Loader />}>
			<PemanggilanOrtuContent />
		</Suspense>
	);
}
