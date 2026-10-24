'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { ChevronLeft, X } from 'lucide-react';

// --- Ikon SVG ---
const IconCalendar = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<rect x='3' y='4' width='18' height='18' rx='0' ry='0' />
		<line x1='16' y1='2' x2='16' y2='6' />
		<line x1='8' y1='2' x2='8' y2='6' />
		<line x1='3' y1='10' x2='21' y2='10' />
	</svg>
);
const IconEdit = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<path d='M11 4H4v14h14v-7' />
		<path d='M18.5 2.5l3 3L12 15l-4 1 1-4 9.5-9.5z' />
	</svg>
);
const IconTrash = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<polyline points='3 6 5 6 21 6' />
		<path d='M19 6v14H7V6m3 0V4h4v2' />
	</svg>
);
const IconAward = ({ className }) => (
	<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' className={className}>
		<circle cx='12' cy='8' r='7' />
		<polyline points='8.21 13.89 7 23 12 20 17 23 15.79 13.88' />
	</svg>
);

// --- MODAL EDIT NEOBRUTALISM ---
function ModalEditSiswa({ isOpen, onClose, onSubmit, kelasList, initialData }) {
	const [activeTab, setActiveTab] = useState('akademik');
	const [formData, setFormData] = useState({
		id: '',
		nis: '',
		nisn: '',
		nik: '',
		nama_lengkap: '',
		kelas: '',
		jenis_kelamin: 'Laki-laki',
		status: 'Aktif',
		tempat_lahir: '',
		tanggal_lahir: '',
		agama: 'Islam',
		anak_ke: '',
		jumlah_saudara: '',
		sekolah_asal: '',
		alamat: '',
		rt: '',
		rw: '',
		dusun: '',
		kelurahan: '',
		kecamatan: '',
		kode_pos: '',
		jenis_tinggal: 'Bersama orang tua',
		no_hp: '',
		nama_ayah: '',
		pendidikan_ayah: '',
		pekerjaan_ayah: '',
		nama_ibu: '',
		pendidikan_ibu: '',
		pekerjaan_ibu: '',
		nama_wali: '',
		pendidikan_wali: '',
		pekerjaan_wali: '',
	});
	const [loading, setLoading] = useState(false);

	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	const [prevInitialData, setPrevInitialData] = useState(initialData);

	if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
		setPrevIsOpen(isOpen);
		setPrevInitialData(initialData);
		if (isOpen && initialData) {
			setFormData({
				id: initialData.id || '',
				nis: initialData.nis || '',
				nisn: initialData.nisn || '',
				nik: initialData.nik || '',
				nama_lengkap: initialData.nama_lengkap || '',
				kelas: initialData.kelas || '',
				jenis_kelamin: initialData.jenis_kelamin || 'Laki-laki',
				status: initialData.status || 'Aktif',
				tempat_lahir: initialData.tempat_lahir || '',
				tanggal_lahir: initialData.tanggal_lahir ? String(initialData.tanggal_lahir).substring(0, 10) : '',
				agama: initialData.agama || 'Islam',
				anak_ke: initialData.anak_ke !== null && initialData.anak_ke !== undefined ? String(initialData.anak_ke) : '',
				jumlah_saudara: initialData.jumlah_saudara !== null && initialData.jumlah_saudara !== undefined ? String(initialData.jumlah_saudara) : '',
				sekolah_asal: initialData.sekolah_asal || '',
				alamat: initialData.alamat || '',
				rt: initialData.rt || '',
				rw: initialData.rw || '',
				dusun: initialData.dusun || '',
				kelurahan: initialData.kelurahan || '',
				kecamatan: initialData.kecamatan || '',
				kode_pos: initialData.kode_pos || '',
				jenis_tinggal: initialData.jenis_tinggal || 'Bersama orang tua',
				no_hp: initialData.no_hp || '',
				nama_ayah: initialData.nama_ayah || '',
				pendidikan_ayah: initialData.pendidikan_ayah || '',
				pekerjaan_ayah: initialData.pekerjaan_ayah || '',
				nama_ibu: initialData.nama_ibu || '',
				pendidikan_ibu: initialData.pendidikan_ibu || '',
				pekerjaan_ibu: initialData.pekerjaan_ibu || '',
				nama_wali: initialData.nama_wali || '',
				pendidikan_wali: initialData.pendidikan_wali || '',
				pekerjaan_wali: initialData.pekerjaan_wali || '',
			});
			setActiveTab('akademik');
		}
	}

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.nama_lengkap || !formData.kelas) {
			Swal.fire({
				title: 'ERROR',
				text: 'Nama Lengkap dan Kelas wajib diisi!',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		setLoading(true);
		const payload = {
			...formData,
			anak_ke: formData.anak_ke ? parseInt(formData.anak_ke, 10) : null,
			jumlah_saudara: formData.jumlah_saudara ? parseInt(formData.jumlah_saudara, 10) : null,
		};
		await onSubmit(payload);
		setLoading(false);
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/80 backdrop-blur-sm p-4'>
			<div className='bg-white w-full max-w-3xl border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden rounded-none transform transition-all flex flex-col max-h-[92vh]'>
				<div className='bg-[#F5C518] px-6 py-4 border-b-[4px] border-[#0D0D0D] flex justify-between items-center'>
					<h2 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2'>
						<IconEdit className='w-6 h-6' /> EDIT BIODATA LENGKAP SISWA
					</h2>
					<button
						onClick={onClose}
						className='w-10 h-10 flex items-center justify-center bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all'>
						<X className='w-6 h-6' strokeWidth={3} />
					</button>
				</div>

				{/* Tabs Header Modal */}
				<div className='flex border-b-[4px] border-[#0D0D0D] bg-white overflow-x-auto'>
					{[
						{ key: 'akademik', label: '📌 Identitas Pokok' },
						{ key: 'kelahiran', label: '🎂 Kelahiran & Asal' },
						{ key: 'domisili', label: '📍 Alamat & Kontak' },
						{ key: 'orangtua', label: '👨‍👩‍👧 Orang Tua / Wali' },
					].map((t) => (
						<button
							key={t.key}
							type='button'
							onClick={() => setActiveTab(t.key)}
							className={`px-4 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-r-[3px] border-[#0D0D0D] transition-colors whitespace-nowrap ${
								activeTab === t.key ? 'bg-[#FF90E8] text-[#0D0D0D]' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
							}`}>
							{t.label}
						</button>
					))}
				</div>

				<form onSubmit={handleSubmit} className='p-6 space-y-5 bg-[#FFF5F0] overflow-y-auto flex-1'>
					{activeTab === 'akademik' && (
						<div className='space-y-4'>
							<div>
								<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
									Nama Lengkap <span className="text-[#E8451A] text-lg">*</span>
								</label>
								<input
									type='text'
									required
									className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none uppercase'
									value={formData.nama_lengkap}
									onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
									placeholder='NAMA LENGKAP SISWA'
								/>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										NIS (Lokal Sekolah)
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.nis}
										onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
										placeholder='Nomor Induk Sekolah'
									/>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										NISN (Nomor Nasional Kemdikbud)
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.nisn}
										onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
										placeholder='10 digit NISN'
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										NIK (Nomor Induk Kependudukan)
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.nik}
										onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
										placeholder='16 digit NIK'
									/>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Agama
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.agama}
										onChange={(e) => setFormData({ ...formData, agama: e.target.value })}
										placeholder='Islam'
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Kelas <span className="text-[#E8451A] text-lg">*</span>
									</label>
									<select
										required
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}>
										<option value='' disabled>-- PILIH KELAS --</option>
										{kelasList.map((k) => (
											<option key={k.id} value={k.kelas || k.nama_kelas}>
												{k.kelas || k.nama_kelas}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Jenis Kelamin
									</label>
									<select
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
										value={formData.jenis_kelamin}
										onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
										<option value='Laki-laki'>LAKI-LAKI</option>
										<option value='Perempuan'>PEREMPUAN</option>
									</select>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Status
									</label>
									<select
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none cursor-pointer uppercase'
										value={formData.status}
										onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
										<option value='Aktif'>AKTIF</option>
										<option value='Boyong'>BOYONG</option>
										<option value='Lulus'>LULUS</option>
										<option value='Pindah'>PINDAH</option>
										<option value='Salah Kelas'>SALAH KELAS</option>
										<option value='Non-Aktif'>NON-AKTIF</option>
									</select>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'kelahiran' && (
						<div className='space-y-4'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Tempat Lahir
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.tempat_lahir}
										onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
										placeholder='Kota / Kabupaten Kelahiran'
									/>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Tanggal Lahir
									</label>
									<input
										type='date'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.tanggal_lahir}
										onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Anak Ke-berapa
									</label>
									<input
										type='number'
										min='1'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.anak_ke}
										onChange={(e) => setFormData({ ...formData, anak_ke: e.target.value })}
										placeholder='1'
									/>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Jumlah Saudara Kandung
									</label>
									<input
										type='number'
										min='0'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
										value={formData.jumlah_saudara}
										onChange={(e) => setFormData({ ...formData, jumlah_saudara: e.target.value })}
										placeholder='0'
									/>
								</div>
							</div>

							<div>
								<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
									Sekolah Asal (SD / MI)
								</label>
								<input
									type='text'
									className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
									value={formData.sekolah_asal}
									onChange={(e) => setFormData({ ...formData, sekolah_asal: e.target.value })}
									placeholder='Nama Sekolah SD/MI Asal'
								/>
							</div>
						</div>
					)}

					{activeTab === 'domisili' && (
						<div className='space-y-4'>
							<div>
								<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
									Alamat Lengkap (Jalan / Dusun)
								</label>
								<textarea
									rows='2'
									className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'
									value={formData.alamat}
									onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
									placeholder='Jl. / Dusun ...'
								/>
							</div>

							<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>RT</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.rt}
										onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>RW</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.rw}
										onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
									/>
								</div>
								<div className='col-span-2'>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Dusun</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.dusun}
										onChange={(e) => setFormData({ ...formData, dusun: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kelurahan / Desa</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.kelurahan}
										onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kecamatan</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.kecamatan}
										onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kode Pos</label>
									<input
										type='text'
										className='w-full px-3 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.kode_pos}
										onChange={(e) => setFormData({ ...formData, kode_pos: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										Jenis Tinggal
									</label>
									<select
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.jenis_tinggal}
										onChange={(e) => setFormData({ ...formData, jenis_tinggal: e.target.value })}>
										<option value='Bersama orang tua'>Bersama orang tua</option>
										<option value='Asrama'>Asrama / Pesantren</option>
										<option value='Kost'>Kost</option>
										<option value='Wali'>Wali</option>
										<option value='Lainnya'>Lainnya</option>
									</select>
								</div>
								<div>
									<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
										No. HP / WhatsApp (Kontak Utama)
									</label>
									<input
										type='text'
										className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D]'
										value={formData.no_hp}
										onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
										placeholder='08xxxxxxxxxx'
									/>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'orangtua' && (
						<div className='space-y-5'>
							{/* Ayah */}
							<div className='p-3.5 bg-amber-50 border-[3px] border-[#0D0D0D] space-y-3'>
								<h3 className='font-black text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									👨 Data Ayah Kandung
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Nama Ayah</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.nama_ayah}
											onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pendidikan_ayah}
											onChange={(e) => setFormData({ ...formData, pendidikan_ayah: e.target.value })}
											placeholder='SMA / S1 / dll'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pekerjaan_ayah}
											onChange={(e) => setFormData({ ...formData, pekerjaan_ayah: e.target.value })}
											placeholder='Petani / Wiraswasta'
										/>
									</div>
								</div>
							</div>

							{/* Ibu */}
							<div className='p-3.5 bg-pink-50 border-[3px] border-[#0D0D0D] space-y-3'>
								<h3 className='font-black text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									👩 Data Ibu Kandung
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Nama Ibu</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.nama_ibu}
											onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pendidikan_ibu}
											onChange={(e) => setFormData({ ...formData, pendidikan_ibu: e.target.value })}
											placeholder='SMA / S1 / dll'
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pekerjaan_ibu}
											onChange={(e) => setFormData({ ...formData, pekerjaan_ibu: e.target.value })}
											placeholder='Ibu Rumah Tangga / dll'
										/>
									</div>
								</div>
							</div>

							{/* Wali */}
							<div className='p-3.5 bg-emerald-50 border-[3px] border-[#0D0D0D] space-y-3'>
								<h3 className='font-black text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									🤝 Data Wali (Opsional)
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Nama Wali</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.nama_wali}
											onChange={(e) => setFormData({ ...formData, nama_wali: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pendidikan_wali}
											onChange={(e) => setFormData({ ...formData, pendidikan_wali: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-[#0D0D0D] uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											className='w-full px-3 py-2 bg-white border-[2px] border-[#0D0D0D] font-bold text-xs'
											value={formData.pekerjaan_wali}
											onChange={(e) => setFormData({ ...formData, pekerjaan_wali: e.target.value })}
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					<div className='pt-5 border-t-[4px] border-[#0D0D0D] flex justify-end gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='px-5 py-3 bg-white border-[3px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-wider hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all rounded-none'>
							BATAL
						</button>
						<button
							type='submit'
							disabled={loading}
							className='px-6 py-3 bg-[#FF90E8] border-[3px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-wider hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] active:translate-y-0 active:shadow-none transition-all rounded-none disabled:opacity-50'>
							{loading ? 'MENYIMPAN...' : 'SIMPAN BIODATA'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// --- HALAMAN UTAMA ---
export default function SiswaPage() {
	const params = useParams();
	const id = params.id;
	const router = useRouter();

	const [siswaData, setSiswaData] = useState(null);
	const [poinSiswa, setPoinSiswa] = useState({ positif: 0, negatif: 0 });
	const [loading, setLoading] = useState(true);
	const [currentUserRole, setCurrentUserRole] = useState(null);
	const [currentUserId, setCurrentUserId] = useState(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [kelasList, setKelasList] = useState([]);
	const [bioTab, setBioTab] = useState('identitas');

	const cleanWa = useMemo(() => {
		const raw = String(siswaData?.no_hp || '').replace(/[^0-9]/g, '');
		if (!raw) return null;
		if (raw.startsWith('0')) return '62' + raw.slice(1);
		if (raw.startsWith('62')) return raw;
		return '62' + raw;
	}, [siswaData?.no_hp]);

	const fetchSiswa = useCallback(async () => {
		try {
			const [resSiswa, resPoin, resAuth, resKelas] = await Promise.all([
				fetch(`/api/siswa`),
				fetch(`/api/poin?siswa_id=${id}`),
				fetch(`/api/auth/me`),
				fetch(`/api/kelas?all=true`),
			]);

			if (resAuth.ok) {
				const authData = await resAuth.json();
				if (authData?.user?.role) setCurrentUserRole(authData.user.role);
				if (authData?.user?.id) setCurrentUserId(authData.user.id);
			}

			if (resKelas.ok) {
				const dataKelas = await resKelas.json();
				if (Array.isArray(dataKelas)) setKelasList(dataKelas);
			}

			const data = await resSiswa.json();
			const siswa = data.find((item) => String(item.id) === String(id));
			if (siswa) setSiswaData(siswa);

			if (resPoin.ok) {
				const dataPoin = await resPoin.json();
				const poinTerkumpul = dataPoin.reduce(
					(acc, curr) => {
						if (curr.tipe === 'positif') acc.positif += curr.poin || 0;
						else if (curr.tipe === 'negatif') acc.negatif += curr.poin || 0;
						return acc;
					},
					{ positif: 0, negatif: 0 },
				);
				setPoinSiswa(poinTerkumpul);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		if (id) fetchSiswa();
	}, [id, fetchSiswa]);

	const waliKelasInfo = useMemo(() => {
		if (!siswaData?.kelas || !kelasList.length) return null;
		const sKelas = siswaData.kelas.trim().toLowerCase();
		return kelasList.find((k) => (k.kelas || k.nama_kelas || '').trim().toLowerCase() === sKelas) || null;
	}, [siswaData?.kelas, kelasList]);

	const isWaliKelas = useMemo(() => {
		if (!waliKelasInfo || !currentUserId) return false;
		return waliKelasInfo.id_wali_kelas === currentUserId;
	}, [waliKelasInfo, currentUserId]);

	const canManageSiswa = useMemo(() => {
		if (currentUserRole === 'Admin' || currentUserRole === 'Kurikulum') return true;
		if (currentUserRole === 'Guru' && isWaliKelas) return true;
		return false;
	}, [currentUserRole, isWaliKelas]);

	const canDeleteSiswa = canManageSiswa;

	const handleOpenEdit = async () => {
		if (!canManageSiswa) {
			Swal.fire({
				title: 'AKSES DITOLAK',
				text: 'Hak akses edit data siswa hanya bisa digunakan oleh Admin, Kurikulum, atau Wali Kelas yang bersangkutan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		if (kelasList.length === 0) {
			try {
				const res = await fetch('/api/kelas?all=true');
				if (res.ok) setKelasList(await res.json());
				else
					setKelasList([
						{ id: 1, kelas: 'VII A' },
						{ id: 2, kelas: 'VII B' },
						{ id: 3, kelas: 'VIII A' },
						{ id: 4, kelas: 'IX A' },
					]);
			} catch (e) {
				console.error('Gagal ambil kelas', e);
			}
		}
		setIsEditOpen(true);
	};

	const handleUpdateSiswa = async (updatedData) => {
		if (!canManageSiswa) {
			Swal.fire({
				title: 'AKSES DITOLAK',
				text: 'Hak akses mutasi dan edit data siswa hanya bisa digunakan oleh Admin, Kurikulum, atau Wali Kelas yang bersangkutan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		if (!updatedData.id) {
			Swal.fire({
				title: 'ERROR',
				text: 'ID Siswa hilang.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		Swal.fire({
			title: 'MENYIMPAN...',
			text: 'Jangan tutup halaman',
			allowOutsideClick: false,
			background: '#FFF5F0',
			color: '#0D0D0D',
			didOpen: () => {
				Swal.showLoading();
			},
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
			},
		});

		try {
			const res = await fetch('/api/siswa', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedData),
			});
			if (res.ok) {
				setSiswaData((prev) => ({ ...prev, ...updatedData }));
				setIsEditOpen(false);
				Swal.fire({
					title: 'BERHASIL!',
					text: 'Data berhasil disimpan',
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			} else {
				Swal.fire({
					title: 'GAGAL',
					text: 'Gagal Update Data',
					icon: 'error',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
			}
		} catch (error) {
			Swal.fire({
				title: 'ERROR',
				text: error.message || 'Terjadi kesalahan jaringan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
		}
	};

	const handleUbahStatusQuick = async () => {
		if (!canManageSiswa) {
			Swal.fire({
				title: 'AKSES DITOLAK',
				text: 'Hak akses mutasi status siswa hanya bisa digunakan oleh Admin, Kurikulum, atau Wali Kelas yang bersangkutan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		const { value: statusPilihan } = await Swal.fire({
			title: 'UBAH STATUS SISWA',
			text: 'Pilih status akademik terbaru untuk siswa ini:',
			input: 'select',
			inputOptions: {
				'Aktif': 'AKTIF (Mengikuti KBM)',
				'Pindah': 'PINDAH / MUTASI (Keluar Sekolah)',
				'Lulus': 'LULUS (Alumni)',
				'Boyong': 'BOYONG',
				'Salah Kelas': 'SALAH KELAS',
				'Non-Aktif': 'NON-AKTIF / BERHENTI'
			},
			inputValue: siswaData?.status || 'Aktif',
			showCancelButton: true,
			confirmButtonText: 'SIMPAN STATUS',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 transition-all',
			},
		});

		if (statusPilihan && statusPilihan !== siswaData?.status) {
			await handleUpdateSiswa({ ...siswaData, status: statusPilihan });
		}
	};

	const handleDeleteSiswa = async () => {
		if (!canDeleteSiswa) {
			Swal.fire({
				title: 'AKSES DITOLAK',
				text: 'Hak akses hapus siswa hanya bisa digunakan oleh Admin, Kurikulum, atau Wali Kelas yang bersangkutan.',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
			return;
		}

		const result = await Swal.fire({
			title: 'HAPUS SISWA?',
			html: `
				<div class="text-left text-xs space-y-2">
					<p class="font-bold text-red-600 uppercase">Perhatian:</p>
					<p>Tindakan ini hanya untuk data salah entri/duplikat. Jika siswa pindah atau lulus, gunakan fitur <b>Ubah Status</b> agar nilai masa lampau tidak ikut hilang.</p>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'YA, HAPUS!',
			cancelButtonText: 'BATAL',
			background: '#FFF5F0',
			color: '#0D0D0D',
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
				confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				cancelButton: 'bg-white text-[#0D0D0D] font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
			},
		});

		if (!result.isConfirmed) return;

		Swal.fire({
			title: 'MENGHAPUS...',
			text: 'Jangan tutup halaman',
			allowOutsideClick: false,
			background: '#FFF5F0',
			color: '#0D0D0D',
			didOpen: () => {
				Swal.showLoading();
			},
			customClass: {
				popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
				title: 'font-black uppercase tracking-widest',
			},
		});

		try {
			const res = await fetch(`/api/siswa?id=${id}`, { method: 'DELETE' });
			const data = await res.json();

			if (res.ok) {
				await Swal.fire({
					title: 'TERHAPUS!',
					text: 'Data berhasil dihapus',
					icon: 'success',
					background: '#FFF5F0',
					color: '#0D0D0D',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				});
				router.back();
			} else {
				Swal.fire({
					title: data.hasHistory ? 'PROTEKSI ARSIP' : 'GAGAL',
					text: data.error || 'Gagal menghapus siswa',
					icon: data.hasHistory ? 'info' : 'error',
					background: '#FFF5F0',
					color: '#0D0D0D',
					confirmButtonText: data.hasHistory ? 'Ubah Status Saja' : 'OK',
					customClass: {
						popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
						title: 'font-black uppercase tracking-widest',
						confirmButton: 'bg-[#00A693] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
					},
				}).then((r) => {
					if (r.isConfirmed && data.hasHistory) {
						handleUbahStatusQuick();
					}
				});
			}
		} catch (e) {
			Swal.fire({
				title: 'ERROR',
				text: 'Error koneksi saat menghapus',
				icon: 'error',
				background: '#FFF5F0',
				color: '#0D0D0D',
				customClass: {
					popup: 'border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none',
					title: 'font-black uppercase tracking-widest',
					confirmButton: 'bg-[#E8451A] text-white font-black border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rounded-none px-6 py-2 uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all',
				},
			});
		}
	};

	const initials = useMemo(() => {
		const name = siswaData?.nama_lengkap || '';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'S';
	}, [siswaData]);

	if (loading) return <Loader />;
	if (!siswaData) return <div className='p-20 text-center font-black text-2xl text-[#0D0D0D] bg-[#FFF5F0] uppercase tracking-widest'>Data siswa tidak ditemukan.</div>;

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 pt-8 font-sans'>
			<div className='mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8'>
				
				{/* Header Navigasi */}
				<div className='flex items-center justify-between'>
					<button
						onClick={() => window.history.back()}
						className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-1 inline-block'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>Profil Siswa</h1>
					</div>
				</div>

				{/* Profil Utama */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none'>
					{/* Banner Solid */}
					<div className='h-40 w-full bg-[#2F80ED] border-b-[4px] border-[#0D0D0D] relative overflow-hidden'>
						{/* Geometric Decoration */}
						<div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF90E8] rounded-full border-[4px] border-[#0D0D0D] opacity-80 mix-blend-multiply"></div>
						<div className="absolute right-20 bottom-[-20px] w-20 h-20 bg-[#F5C518] rotate-45 border-[4px] border-[#0D0D0D] opacity-80"></div>
					</div>

					<div className='px-6 pb-10'>
						<div className='relative flex flex-col items-center'>
							{/* Avatar */}
							<div className='-mt-20 mb-6'>
								<div className='flex h-40 w-40 items-center justify-center rounded-none border-[4px] border-[#0D0D0D] bg-white text-6xl font-black text-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D]'>
									{initials}
								</div>
							</div>

							{/* Nama & Info */}
							<div className='text-center w-full'>
								<h2 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] uppercase tracking-widest break-words'>{siswaData.nama_lengkap}</h2>
								
								<div className='mt-3 mb-6 flex flex-wrap items-center justify-center gap-2'>
									<div className='inline-block bg-[#0D0D0D] text-white px-4 py-1 text-lg font-black uppercase tracking-widest border-[2px] border-[#0D0D0D]'>
										KELAS {siswaData.kelas}
									</div>
									{waliKelasInfo?.wali_kelas && (
										<div className='inline-block bg-[#FFF5F0] text-[#0D0D0D] px-3 py-1 text-sm font-black uppercase tracking-widest border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
											Wali Kelas: {waliKelasInfo.wali_kelas}
										</div>
									)}
								</div>

								<div className='flex flex-wrap justify-center gap-4 mt-2'>
									<span className='px-4 py-2 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>
										NIS: {siswaData.nis || '-'}
									</span>
									<span
										className={`px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest ${siswaData.status === 'Aktif' ? 'bg-[#A3E635] text-[#0D0D0D]' : siswaData.status === 'Lulus' ? 'bg-[#2F80ED] text-white' : 'bg-[#E8451A] text-white'}`}>
										{siswaData.status}
									</span>
									<span className='px-4 py-2 bg-[#F5C518] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest text-[#0D0D0D]'>
										{siswaData.jenis_kelamin || 'LAKI-LAKI'}
									</span>
									<Link
										href={`/siswa/${id}/riwayat-poin`}
										title='Lihat Detail Riwayat Poin Siswa'
										className='group inline-flex items-center gap-2 hover:-translate-y-1 transition-transform'>
										<span className='px-4 py-2 bg-[#00A693] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all flex items-center gap-1'>
											POS (+): {poinSiswa.positif}
										</span>
										<span className='px-4 py-2 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] text-sm font-black uppercase tracking-widest hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all flex items-center gap-1'>
											NEG (-): {poinSiswa.negatif}
										</span>
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* SECTION: BIODATA LENGKAP SISWA */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] rounded-none overflow-hidden'>
					{/* Header Biodata */}
					<div className='bg-[#F5C518] px-6 py-4 border-b-[4px] border-[#0D0D0D] flex flex-wrap items-center justify-between gap-3'>
						<div className='flex items-center gap-2'>
							<span className='text-2xl'>📑</span>
							<h3 className='font-black text-lg sm:text-xl text-[#0D0D0D] uppercase tracking-widest'>
								Biodata Lengkap Siswa
							</h3>
						</div>
						{canManageSiswa && (
							<button
								onClick={handleOpenEdit}
								className='px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5'>
								<IconEdit className='w-4 h-4' /> Edit Biodata
							</button>
						)}
					</div>

					{/* Navigation Tabs Biodata */}
					<div className='flex border-b-[4px] border-[#0D0D0D] bg-[#FFF5F0] overflow-x-auto'>
						<button
							onClick={() => setBioTab('identitas')}
							className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-r-[3px] border-[#0D0D0D] transition-colors whitespace-nowrap ${
								bioTab === 'identitas' ? 'bg-[#FF90E8] text-[#0D0D0D]' : 'bg-transparent hover:bg-white/60 text-[#0D0D0D]/70'
							}`}>
							📌 Identitas & Sekolah
						</button>
						<button
							onClick={() => setBioTab('alamat')}
							className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-r-[3px] border-[#0D0D0D] transition-colors whitespace-nowrap ${
								bioTab === 'alamat' ? 'bg-[#A3E635] text-[#0D0D0D]' : 'bg-transparent hover:bg-white/60 text-[#0D0D0D]/70'
							}`}>
							📍 Alamat & Domisili
						</button>
						<button
							onClick={() => setBioTab('ortu')}
							className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
								bioTab === 'ortu' ? 'bg-[#00A693] text-white' : 'bg-transparent hover:bg-white/60 text-[#0D0D0D]/70'
							}`}>
							👨‍👩‍👧 Orang Tua / Wali & Kontak
						</button>
					</div>

					{/* Tab Content */}
					<div className='p-6 bg-white'>
						{bioTab === 'identitas' && (
							<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm'>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>NISN</p>
									<p className='font-black text-[#0D0D0D] text-base mt-0.5'>{siswaData.nisn || '-'}</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>NIS Lokal</p>
									<p className='font-black text-[#0D0D0D] text-base mt-0.5'>{siswaData.nis || '-'}</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>NIK (Kependudukan)</p>
									<p className='font-black text-[#0D0D0D] text-base mt-0.5'>{siswaData.nik || '-'}</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Tempat, Tanggal Lahir</p>
									<p className='font-bold text-[#0D0D0D] mt-0.5'>
										{siswaData.tempat_lahir || '-'}
										{siswaData.tanggal_lahir ? `, ${new Date(siswaData.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
									</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Agama</p>
									<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.agama || 'Islam'}</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Urutan Anak</p>
									<p className='font-bold text-[#0D0D0D] mt-0.5'>
										Anak ke-{siswaData.anak_ke || '-'} dari {siswaData.jumlah_saudara !== null && siswaData.jumlah_saudara !== undefined ? siswaData.jumlah_saudara + 1 : '-'} bersaudara
									</p>
								</div>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D] sm:col-span-2 lg:col-span-3'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Sekolah Asal (SD / MI)</p>
									<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.sekolah_asal || '-'}</p>
								</div>
							</div>
						)}

						{bioTab === 'alamat' && (
							<div className='space-y-4 text-xs sm:text-sm'>
								<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
									<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Alamat Jalan / Dusun</p>
									<p className='font-bold text-[#0D0D0D] text-sm mt-0.5'>{siswaData.alamat || '-'}</p>
								</div>

								<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>RT / RW</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>RT {siswaData.rt || '-'} / RW {siswaData.rw || '-'}</p>
									</div>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Dusun</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.dusun || '-'}</p>
									</div>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Desa / Kelurahan</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.kelurahan || '-'}</p>
									</div>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Kecamatan</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.kecamatan || '-'}</p>
									</div>
								</div>

								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Kode Pos</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.kode_pos || '-'}</p>
									</div>
									<div className='p-3 bg-[#FFF5F0] border-[2px] border-[#0D0D0D]'>
										<p className='font-black text-gray-500 uppercase text-[10px] tracking-wider'>Jenis Tempat Tinggal</p>
										<p className='font-bold text-[#0D0D0D] mt-0.5'>{siswaData.jenis_tinggal || 'Bersama orang tua'}</p>
									</div>
								</div>
							</div>
						)}

						{bioTab === 'ortu' && (
							<div className='space-y-4 text-xs sm:text-sm'>
								{/* Kontak Utama Siswa / Wali */}
								<div className='p-4 bg-emerald-50 border-[3px] border-[#0D0D0D] flex flex-wrap items-center justify-between gap-3'>
									<div>
										<p className='font-black text-emerald-900 uppercase text-[10px] tracking-wider'>No. Handphone / WhatsApp Utama</p>
										<p className='font-black text-lg text-emerald-950 font-mono mt-0.5'>{siswaData.no_hp || '-'}</p>
									</div>
									{cleanWa && (
										<a
											href={`https://wa.me/${cleanWa}`}
											target='_blank'
											rel='noopener noreferrer'
											className='px-4 py-2 bg-[#25D366] text-white font-black border-[2px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 uppercase text-xs flex items-center gap-2'>
											<span>💬</span> Chat WhatsApp Orang Tua
										</a>
									)}
								</div>

								{/* Grid Data Ortu */}
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									{/* Ayah */}
									<div className='p-4 bg-amber-50 border-[3px] border-[#0D0D0D] space-y-2'>
										<h4 className='font-black text-amber-950 uppercase text-sm border-b-2 border-[#0D0D0D] pb-1 flex items-center gap-1.5'>
											👨 Data Ayah Kandung
										</h4>
										<div>
											<p className='text-[10px] font-black uppercase text-gray-500'>Nama Lengkap</p>
											<p className='font-bold text-sm text-[#0D0D0D]'>{siswaData.nama_ayah || '-'}</p>
										</div>
										<div className='grid grid-cols-2 gap-2 pt-1'>
											<div>
												<p className='text-[10px] font-black uppercase text-gray-500'>Pendidikan</p>
												<p className='font-bold text-[#0D0D0D]'>{siswaData.pendidikan_ayah || '-'}</p>
											</div>
											<div>
												<p className='text-[10px] font-black uppercase text-gray-500'>Pekerjaan</p>
												<p className='font-bold text-[#0D0D0D]'>{siswaData.pekerjaan_ayah || '-'}</p>
											</div>
										</div>
									</div>

									{/* Ibu */}
									<div className='p-4 bg-pink-50 border-[3px] border-[#0D0D0D] space-y-2'>
										<h4 className='font-black text-pink-950 uppercase text-sm border-b-2 border-[#0D0D0D] pb-1 flex items-center gap-1.5'>
											👩 Data Ibu Kandung
										</h4>
										<div>
											<p className='text-[10px] font-black uppercase text-gray-500'>Nama Lengkap</p>
											<p className='font-bold text-sm text-[#0D0D0D]'>{siswaData.nama_ibu || '-'}</p>
										</div>
										<div className='grid grid-cols-2 gap-2 pt-1'>
											<div>
												<p className='text-[10px] font-black uppercase text-gray-500'>Pendidikan</p>
												<p className='font-bold text-[#0D0D0D]'>{siswaData.pendidikan_ibu || '-'}</p>
											</div>
											<div>
												<p className='text-[10px] font-black uppercase text-gray-500'>Pekerjaan</p>
												<p className='font-bold text-[#0D0D0D]'>{siswaData.pekerjaan_ibu || '-'}</p>
											</div>
										</div>
									</div>

									{/* Wali */}
									{siswaData.nama_wali && (
										<div className='p-4 bg-cyan-50 border-[3px] border-[#0D0D0D] space-y-2 md:col-span-2'>
											<h4 className='font-black text-cyan-950 uppercase text-sm border-b-2 border-[#0D0D0D] pb-1 flex items-center gap-1.5'>
												🤝 Data Wali
											</h4>
											<div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
												<div>
													<p className='text-[10px] font-black uppercase text-gray-500'>Nama Wali</p>
													<p className='font-bold text-[#0D0D0D]'>{siswaData.nama_wali}</p>
												</div>
												<div>
													<p className='text-[10px] font-black uppercase text-gray-500'>Pendidikan</p>
													<p className='font-bold text-[#0D0D0D]'>{siswaData.pendidikan_wali || '-'}</p>
												</div>
												<div>
													<p className='text-[10px] font-black uppercase text-gray-500'>Pekerjaan</p>
													<p className='font-bold text-[#0D0D0D]'>{siswaData.pekerjaan_wali || '-'}</p>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Menu Grid */}
				<div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
					<Link
						href={`/siswa/${id}/riwayat-absensi`}
						className='group flex items-center gap-5 bg-[#2F80ED] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:rotate-6 transition-transform'>
							<IconCalendar className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-white uppercase tracking-widest mb-1'>RIWAYAT ABSENSI</h3>
							<p className='text-sm font-bold text-white/80 uppercase'>Cek kehadiran siswa</p>
						</div>
					</Link>

					<Link
						href={`/siswa/${id}/riwayat-nilai`}
						className='group flex items-center gap-5 bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:scale-110 transition-transform'>
							<IconAward className='h-8 w-8' />
						</div>
						<div>
							<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-1'>RIWAYAT NILAI</h3>
							<p className='text-sm font-bold text-[#0D0D0D]/70 uppercase'>Akademik & rapor</p>
						</div>
					</Link>

					<Link
						href={`/siswa/${id}/riwayat-poin`}
						className='group flex items-center gap-5 bg-[#00A693] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none'>
						<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:scale-110 group-hover:rotate-12 transition-transform text-2xl font-black'>
							⭐
						</div>
						<div>
							<h3 className='font-black text-xl text-white uppercase tracking-widest mb-1'>RIWAYAT POIN</h3>
							<p className='text-sm font-bold text-white/80 uppercase'>Perilaku & sikap siswa</p>
						</div>
					</Link>

					{currentUserRole !== 'Kepala Sekolah' ? (
						canManageSiswa ? (
							<>
								<button
									onClick={handleUbahStatusQuick}
									className='group flex items-center gap-5 bg-[#A3E635] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none text-left'>
									<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:rotate-12 transition-transform text-2xl font-black'>
										🎓
									</div>
									<div>
										<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-1'>MUTASI / STATUS</h3>
										<p className='text-sm font-bold text-[#0D0D0D]/80 uppercase'>Pindah, Lulus, dsb</p>
									</div>
								</button>

								<button
									onClick={handleOpenEdit}
									className='group flex items-center gap-5 bg-[#FF90E8] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none text-left'>
									<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:-rotate-6 transition-transform'>
										<IconEdit className='h-8 w-8' />
									</div>
									<div>
										<h3 className='font-black text-xl text-[#0D0D0D] uppercase tracking-widest mb-1'>EDIT DATA</h3>
										<p className='text-sm font-bold text-[#0D0D0D]/70 uppercase'>Perbarui profil siswa</p>
									</div>
								</button>

								<button
									onClick={handleDeleteSiswa}
									className='group flex items-center gap-5 bg-[#E8451A] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all rounded-none text-left'>
									<div className='flex h-16 w-16 items-center justify-center bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] group-hover:scale-110 group-hover:rotate-3 transition-transform'>
										<IconTrash className='h-8 w-8' />
									</div>
									<div>
										<h3 className='font-black text-xl text-white uppercase tracking-widest mb-1'>HAPUS SISWA</h3>
										<p className='text-sm font-bold text-white/80 uppercase'>Hanya untuk salah input</p>
									</div>
								</button>
							</>
						) : (
							<div className='flex items-center gap-4 bg-amber-50 p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] sm:col-span-2 lg:col-span-3'>
								<span className='text-3xl'>🔒</span>
								<div>
									<h3 className='font-black text-sm text-[#0D0D0D] uppercase tracking-widest'>Akses Manajemen Terbatas</h3>
									<p className='text-xs font-bold text-[#0D0D0D]/70'>Fitur Mutasi, Edit Data, dan Hapus Siswa khusus untuk Wali Kelas yang bersangkutan, Admin, atau Kurikulum.</p>
								</div>
							</div>
						)
					) : (
						<div className='flex items-center gap-4 bg-indigo-50 p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] sm:col-span-2 lg:col-span-1'>
							<span className='text-3xl'>🎓</span>
							<div>
								<h3 className='font-black text-sm text-indigo-950 uppercase tracking-widest'>Mode Pantau</h3>
								<p className='text-xs font-bold text-indigo-900'>Data siswa berstatus read-only untuk Kepala Sekolah.</p>
							</div>
						</div>
					)}
				</div>

				<ModalEditSiswa
					isOpen={isEditOpen}
					onClose={() => setIsEditOpen(false)}
					initialData={siswaData}
					kelasList={kelasList}
					onSubmit={handleUpdateSiswa}
				/>
			</div>
		</div>
	);
}
