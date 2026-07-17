'use client';
import { useState, useEffect } from 'react';

export default function ModalJadwal({ isOpen, onClose, onSubmit, initialData, isEditMode = false }) {
	// State form data
	const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
	const hariIni = namaHari[new Date().getDay()];

	const [formData, setFormData] = useState({
		mapel: '',
		kelas: '',
		hari: hariIni,
		jam_mulai: '',
		jam_selesai: '',
		jam_ke: '',
	});

	// State untuk menyimpan list opsi dari API
	const [listMapel, setListMapel] = useState([]);
	const [listKelas, setListKelas] = useState([]);
	const [loading, setLoading] = useState(false);

	// 1. Fetch Data Master (Mapel & Kelas) saat Modal dibuka pertama kali
	useEffect(() => {
		if (isOpen) {
			fetch('/api/mapel')
				.then((res) => res.json())
				.then((data) => setListMapel(data))
				.catch((err) => console.error('Gagal ambil mapel:', err));

			fetch('/api/kelas')
				.then((res) => res.json())
				.then((data) => setListKelas(data))
				.catch((err) => console.error('Gagal ambil kelas:', err));
		}
	}, [isOpen]);

	// 2. Isi form jika ada initialData (Mode Edit)
	const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
	const [prevInitialData, setPrevInitialData] = useState(initialData);

	if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
		setPrevIsOpen(isOpen);
		setPrevInitialData(initialData);
		if (isOpen) {
			if (initialData) {
				setFormData(initialData);
			} else {
				setFormData({
					mapel: '',
					kelas: '',
					hari: hariIni,
					jam_mulai: '',
					jam_selesai: '',
					jam_ke: '',
				});
			}
		}
	}

	if (!isOpen) return null;

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		await onSubmit(formData);
		setLoading(false);
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300'>
			<div className='bg-[#FFF5F0] w-full max-w-lg rounded-none border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] overflow-hidden transform transition-all'>
				
				{/* HEADER */}
				<div className='bg-[#F5C518] border-b-[4px] border-[#0D0D0D] px-6 py-5 flex justify-between items-center'>
					<h3 className='text-xl font-black text-[#0D0D0D] uppercase tracking-widest'>{isEditMode ? 'EDIT JADWAL' : 'TAMBAH JADWAL'}</h3>
					<button
						type="button"
						onClick={onClose}
						className='w-10 h-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black flex items-center justify-center shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='p-6 space-y-6'>
					
					{/* DROPDOWN MAPEL */}
					<div>
						<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>MATA PELAJARAN</label>
						<select
							name='mapel'
							value={formData.mapel}
							onChange={handleChange}
							className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer appearance-none'
							required>
							<option value='' disabled>-- PILIH MAPEL --</option>
							{listMapel.map((m) => (
								<option key={m.id} value={m.mapel}>{m.mapel}</option>
							))}
						</select>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						{/* DROPDOWN KELAS */}
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>KELAS</label>
							<select
								name='kelas'
								value={formData.kelas}
								onChange={handleChange}
								className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer appearance-none'
								required>
								<option value='' disabled>-- KELAS --</option>
								{listKelas.map((k) => (
									<option key={k.id} value={k.kelas || k.nama_kelas}>{k.kelas || k.nama_kelas}</option>
								))}
							</select>
						</div>

						{/* INPUT HARI */}
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>HARI</label>
							<select
								name='hari'
								value={formData.hari}
								onChange={handleChange}
								className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all cursor-pointer appearance-none'
								required>
								<option value='' disabled>-- HARI --</option>
								{namaHari.map((h) => (
									<option key={h} value={h}>{h}</option>
								))}
							</select>
						</div>
					</div>

					<div className='grid grid-cols-3 gap-4'>
						{/* JAM KE */}
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>JAM KE</label>
							<input
								type='number'
								name='jam_ke'
								value={formData.jam_ke}
								onChange={handleChange}
								placeholder='1'
								min='1'
								max='15'
								className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
								required
							/>
						</div>
						{/* JAM MULAI */}
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>MULAI</label>
							<input
								type='time'
								name='jam_mulai'
								value={formData.jam_mulai}
								onChange={handleChange}
								className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
								required
							/>
						</div>
						{/* JAM SELESAI */}
						<div>
							<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-3'>SELESAI</label>
							<input
								type='time'
								name='jam_selesai'
								value={formData.jam_selesai}
								onChange={handleChange}
								className='w-full h-[60px] px-4 border-[4px] border-[#0D0D0D] bg-white rounded-none text-[#0D0D0D] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] focus:outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'
								required
							/>
						</div>
					</div>

					{/* ACTION BUTTONS */}
					<div className='flex justify-end gap-4 mt-8 pt-6 border-t-[4px] border-[#0D0D0D]'>
						<button
							type='button'
							onClick={onClose}
							className='h-[60px] px-6 bg-white text-[#0D0D0D] border-[4px] border-[#0D0D0D] rounded-none font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
							BATAL
						</button>
						<button
							type='submit'
							disabled={loading}
							className='h-[60px] px-6 bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] rounded-none font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
							{loading ? 'MENYIMPAN...' : isEditMode ? 'UPDATE' : 'SIMPAN'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
