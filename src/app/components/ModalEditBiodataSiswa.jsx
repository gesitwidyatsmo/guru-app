'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { X, Edit3, UserPlus, Check } from 'lucide-react';

export default function ModalEditBiodataSiswa({
	isOpen,
	onClose,
	onSubmit,
	initialData = null,
	kelasList = [],
	defaultKelas = '',
	isCreate = false,
}) {
	const [activeTab, setActiveTab] = useState('akademik');
	const [loading, setLoading] = useState(false);

	const emptyForm = {
		id: '',
		nis: '',
		nisn: '',
		nik: '',
		nama_lengkap: '',
		kelas: defaultKelas || '',
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
		pekerjaan_ibu: 'Ibu Rumah Tangga',
		nama_wali: '',
		pendidikan_wali: '',
		pekerjaan_wali: '',
	};

	const [formData, setFormData] = useState(emptyForm);

	useEffect(() => {
		if (isOpen) {
			if (initialData && !isCreate) {
				setFormData({
					id: initialData.id || '',
					nis: initialData.nis || '',
					nisn: initialData.nisn || '',
					nik: initialData.nik || '',
					nama_lengkap: initialData.nama_lengkap || '',
					kelas: initialData.kelas || defaultKelas || '',
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
					pekerjaan_ibu: initialData.pekerjaan_ibu || 'Ibu Rumah Tangga',
					nama_wali: initialData.nama_wali || '',
					pendidikan_wali: initialData.pendidikan_wali || '',
					pekerjaan_wali: initialData.pekerjaan_wali || '',
				});
			} else {
				setFormData({
					...emptyForm,
					kelas: defaultKelas || (kelasList[0]?.kelas || kelasList[0]?.nama_kelas || ''),
				});
			}
			setActiveTab('akademik');
		}
	}, [isOpen, initialData, isCreate, defaultKelas, kelasList]);

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!formData.nama_lengkap?.trim() || !formData.kelas) {
			Swal.fire({
				title: 'Peringatan',
				text: 'Nama Lengkap dan Kelas wajib diisi!',
				icon: 'warning',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		setLoading(true);
		try {
			const payload = {
				...formData,
				nama_lengkap: formData.nama_lengkap.trim(),
				anak_ke: formData.anak_ke ? parseInt(formData.anak_ke, 10) : null,
				jumlah_saudara: formData.jumlah_saudara ? parseInt(formData.jumlah_saudara, 10) : null,
			};
			await onSubmit(payload, isCreate);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4'>
			<div className='bg-white w-full max-w-3xl border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden rounded-none transform transition-all flex flex-col max-h-[92vh]'>
				{/* Header Modal */}
				<div className={`px-6 py-4 border-b-[4px] border-[#0D0D0D] flex justify-between items-center ${isCreate ? 'bg-[#A3E635]' : 'bg-[#F5C518]'}`}>
					<h2 className='text-lg sm:text-xl font-black text-[#0D0D0D] uppercase tracking-wider flex items-center gap-2'>
						{isCreate ? <UserPlus className='w-5 h-5' /> : <Edit3 className='w-5 h-5' />}
						<span>{isCreate ? 'Tambah Siswa Baru' : `Edit Biodata: ${formData.nama_lengkap || 'Siswa'}`}</span>
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='w-9 h-9 flex items-center justify-center bg-[#E8451A] text-white border-[2.5px] border-[#0D0D0D] hover:-translate-y-0.5 active:translate-y-0 transition-all'>
						<X className='w-5 h-5' strokeWidth={3} />
					</button>
				</div>

				{/* Tabs Navigation */}
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

				{/* Form Fields */}
				<form onSubmit={handleSubmit} className='p-6 space-y-4 bg-[#FFF5F0] overflow-y-auto flex-1 text-xs sm:text-sm font-bold'>
					{activeTab === 'akademik' && (
						<div className='space-y-4'>
							<div>
								<label className='block text-xs sm:text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-1.5'>
									Nama Lengkap Siswa <span className='text-[#E8451A]'>*</span>
								</label>
								<input
									type='text'
									required
									placeholder='Nama lengkap sesuai dokumen rapor'
									className='w-full px-4 py-2.5 bg-white border-[3px] border-[#0D0D0D] font-bold text-[#0D0D0D] focus:outline-none focus:shadow-[4px_4px_0_#000] uppercase'
									value={formData.nama_lengkap}
									onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
								/>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										NIS (Lokal Sekolah)
									</label>
									<input
										type='text'
										placeholder='Nomor Induk Siswa'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D] font-mono'
										value={formData.nis}
										onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										NISN (Nomor Nasional Kemdikbud)
									</label>
									<input
										type='text'
										placeholder='10 digit NISN'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D] font-mono'
										value={formData.nisn}
										onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										NIK (Kependudukan / KK)
									</label>
									<input
										type='text'
										placeholder='16 digit NIK'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D] font-mono'
										value={formData.nik}
										onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Agama
									</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.agama}
										onChange={(e) => setFormData({ ...formData, agama: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Rombel / Kelas <span className='text-[#E8451A]'>*</span>
									</label>
									<input
										type='text'
										required
										readOnly={Boolean(defaultKelas)}
										className={`w-full px-3 py-2 border-[2.5px] border-[#0D0D0D] font-bold uppercase ${defaultKelas ? 'bg-gray-100 text-gray-700' : 'bg-white'}`}
										value={formData.kelas}
										onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Jenis Kelamin
									</label>
									<select
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D] uppercase cursor-pointer'
										value={formData.jenis_kelamin}
										onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}>
										<option value='Laki-laki'>👦 Laki-laki</option>
										<option value='Perempuan'>👧 Perempuan</option>
									</select>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Status Akademik
									</label>
									<select
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D] uppercase cursor-pointer'
										value={formData.status}
										onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
										<option value='Aktif'>🟢 Aktif</option>
										<option value='Lulus'>🎓 Lulus</option>
										<option value='Pindah'>🚚 Pindah</option>
										<option value='Boyong'>📦 Boyong</option>
										<option value='Salah Kelas'>⚠️ Salah Kelas</option>
										<option value='Non-Aktif'>⚪ Non-Aktif</option>
									</select>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'kelahiran' && (
						<div className='space-y-3.5'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Tempat Lahir
									</label>
									<input
										type='text'
										placeholder='Kota / Kabupaten'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.tempat_lahir}
										onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Tanggal Lahir
									</label>
									<input
										type='date'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.tanggal_lahir}
										onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Anak Ke-berapa
									</label>
									<input
										type='number'
										min='1'
										placeholder='1'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.anak_ke}
										onChange={(e) => setFormData({ ...formData, anak_ke: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Jumlah Saudara Kandung
									</label>
									<input
										type='number'
										min='0'
										placeholder='0'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.jumlah_saudara}
										onChange={(e) => setFormData({ ...formData, jumlah_saudara: e.target.value })}
									/>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
									Sekolah Asal (SD / MI)
								</label>
								<input
									type='text'
									placeholder='Nama SD/MI asal'
									className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
									value={formData.sekolah_asal}
									onChange={(e) => setFormData({ ...formData, sekolah_asal: e.target.value })}
								/>
							</div>
						</div>
					)}

					{activeTab === 'domisili' && (
						<div className='space-y-3'>
							<div>
								<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
									Alamat Lengkap (Jalan / Dusun)
								</label>
								<textarea
									rows='2'
									placeholder='Alamat tempat tinggal'
									className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
									value={formData.alamat}
									onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
								/>
							</div>

							<div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>RT</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.rt}
										onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>RW</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.rw}
										onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
									/>
								</div>
								<div className='col-span-2'>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Dusun</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.dusun}
										onChange={(e) => setFormData({ ...formData, dusun: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-3 gap-2.5'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kelurahan / Desa</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.kelurahan}
										onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kecamatan</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.kecamatan}
										onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
									/>
								</div>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>Kode Pos</label>
									<input
										type='text'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.kode_pos}
										onChange={(e) => setFormData({ ...formData, kode_pos: e.target.value })}
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										Jenis Tempat Tinggal
									</label>
									<select
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
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
									<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-widest mb-1'>
										No. HP / WhatsApp (Kontak Utama)
									</label>
									<input
										type='text'
										placeholder='08xxxxxxxxxx'
										className='w-full px-3 py-2 bg-white border-[2.5px] border-[#0D0D0D]'
										value={formData.no_hp}
										onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
									/>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'orangtua' && (
						<div className='space-y-4'>
							{/* Ayah */}
							<div className='p-3.5 bg-amber-50 border-[2.5px] border-[#0D0D0D] space-y-2.5'>
								<h3 className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									👨 Data Ayah Kandung
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-2.5'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Nama Ayah</label>
										<input
											type='text'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.nama_ayah}
											onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											placeholder='SMA / S1 / dll'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pendidikan_ayah}
											onChange={(e) => setFormData({ ...formData, pendidikan_ayah: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											placeholder='Petani / Wiraswasta'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pekerjaan_ayah}
											onChange={(e) => setFormData({ ...formData, pekerjaan_ayah: e.target.value })}
										/>
									</div>
								</div>
							</div>

							{/* Ibu */}
							<div className='p-3.5 bg-pink-50 border-[2.5px] border-[#0D0D0D] space-y-2.5'>
								<h3 className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									👩 Data Ibu Kandung
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-2.5'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Nama Ibu</label>
										<input
											type='text'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.nama_ibu}
											onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											placeholder='SMA / S1 / dll'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pendidikan_ibu}
											onChange={(e) => setFormData({ ...formData, pendidikan_ibu: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											placeholder='Ibu Rumah Tangga'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pekerjaan_ibu}
											onChange={(e) => setFormData({ ...formData, pekerjaan_ibu: e.target.value })}
										/>
									</div>
								</div>
							</div>

							{/* Wali */}
							<div className='p-3.5 bg-emerald-50 border-[2.5px] border-[#0D0D0D] space-y-2.5'>
								<h3 className='font-black text-xs sm:text-sm text-[#0D0D0D] uppercase tracking-wider flex items-center gap-1.5'>
									🤝 Data Wali (Opsional)
								</h3>
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-2.5'>
									<div className='sm:col-span-1'>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Nama Wali</label>
										<input
											type='text'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.nama_wali}
											onChange={(e) => setFormData({ ...formData, nama_wali: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pendidikan</label>
										<input
											type='text'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pendidikan_wali}
											onChange={(e) => setFormData({ ...formData, pendidikan_wali: e.target.value })}
										/>
									</div>
									<div>
										<label className='block text-[11px] font-black text-gray-700 uppercase mb-1'>Pekerjaan</label>
										<input
											type='text'
											className='w-full px-3 py-1.5 bg-white border-[2px] border-[#0D0D0D] text-xs'
											value={formData.pekerjaan_wali}
											onChange={(e) => setFormData({ ...formData, pekerjaan_wali: e.target.value })}
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					<div className='pt-4 border-t-[3px] border-[#0D0D0D] flex justify-end gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='px-5 py-2.5 bg-white border-[2.5px] border-[#0D0D0D] font-black text-black uppercase tracking-wider hover:-translate-y-0.5 active:translate-y-0 shadow-[2px_2px_0_#000] transition-all'>
							Batal
						</button>
						<button
							type='submit'
							disabled={loading}
							className={`px-6 py-2.5 border-[2.5px] border-[#0D0D0D] font-black text-[#0D0D0D] uppercase tracking-wider hover:-translate-y-0.5 active:translate-y-0 shadow-[2px_2px_0_#000] transition-all disabled:opacity-50 flex items-center gap-1.5 ${isCreate ? 'bg-[#A3E635]' : 'bg-[#FF90E8]'}`}>
							<Check className='w-4 h-4' />
							<span>{loading ? 'Menyimpan...' : isCreate ? 'Simpan Siswa Baru' : 'Simpan Perubahan'}</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
