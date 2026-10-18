'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import { getTodayDateString } from '@/lib/dateUtils';

// Komponen Searchable Dropdown Santri (Combobox / Autocomplete Dropdown)
function SearchableDropdownSiswa({
	kelas,
	siswaList = [],
	selectedSiswa,
	onSelect,
	disabled = false,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const dropdownRef = useRef(null);
	const inputRef = useRef(null);

	// Sinkronisasi teks input dengan nama santri terpilih
	useEffect(() => {
		if (selectedSiswa) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSearchQuery(selectedSiswa.nama_lengkap);
		} else {
			setSearchQuery('');
		}
	}, [selectedSiswa]);

	// Filter opsi berdasarkan kata kunci yang diketik
	const filteredList = useMemo(() => {
		if (!searchQuery.trim()) return siswaList;
		const q = searchQuery.toLowerCase();
		return siswaList.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && String(s.nis).includes(q))
		);
	}, [siswaList, searchQuery]);

	// Menutup dropdown saat klik di luar (Click Outside)
	useEffect(() => {
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
				if (selectedSiswa) {
					setSearchQuery(selectedSiswa.nama_lengkap);
				} else {
					setSearchQuery('');
				}
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, selectedSiswa]);

	const handleInputFocus = () => {
		if (!disabled) {
			setIsOpen(true);
		}
	};

	const handleInputChange = (e) => {
		setSearchQuery(e.target.value);
		setIsOpen(true);
		if (selectedSiswa && e.target.value !== selectedSiswa.nama_lengkap) {
			onSelect(null);
		}
	};

	const handleSelectItem = (siswa) => {
		onSelect(siswa);
		setSearchQuery(siswa.nama_lengkap);
		setIsOpen(false);
	};

	const handleClear = (e) => {
		e.stopPropagation();
		onSelect(null);
		setSearchQuery('');
		setIsOpen(true);
		if (inputRef.current) inputRef.current.focus();
	};

	return (
		<div ref={dropdownRef} className='relative w-full'>
			{/* Input Box Bergaya Dropdown */}
			<div
				onClick={() => {
					if (!disabled && !isOpen) {
						setIsOpen(true);
						if (inputRef.current) inputRef.current.focus();
					}
				}}
				className={`relative flex items-center border-2 border-black rounded-xl bg-white shadow-[2px_2px_0px_0px_#0D0D0D] transition-all ${
					disabled ? 'opacity-60 bg-gray-100 cursor-not-allowed' : 'cursor-text'
				} ${isOpen ? 'ring-2 ring-black bg-yellow-50/40' : ''}`}>
				<input
					ref={inputRef}
					type='text'
					disabled={disabled}
					value={searchQuery}
					onFocus={handleInputFocus}
					onChange={handleInputChange}
					placeholder={
						disabled
							? '-- Pilih Rombel Terlebih Dahulu Di Atas --'
							: selectedSiswa
							? selectedSiswa.nama_lengkap
							: `-- Ketik atau Pilih Santri Kelas ${kelas || ''} --`
					}
					className='w-full py-2.5 pl-3 pr-16 text-xs font-bold text-black bg-transparent outline-none placeholder:text-gray-400 placeholder:font-normal'
				/>

				{/* Tombol Clear & Chevron Arrow Dropdown */}
				<div className='absolute right-2.5 flex items-center gap-1.5'>
					{selectedSiswa && !disabled && (
						<button
							type='button'
							onClick={handleClear}
							title='Hapus pilihan santri'
							className='w-5 h-5 rounded-md text-gray-400 hover:text-black hover:bg-gray-200 flex items-center justify-center transition-colors'>
							<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
								<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
							</svg>
						</button>
					)}
					<button
						type='button'
						disabled={disabled}
						onClick={(e) => {
							e.stopPropagation();
							if (!disabled) {
								setIsOpen(!isOpen);
								if (!isOpen && inputRef.current) inputRef.current.focus();
							}
						}}
						className='text-gray-700 hover:text-black p-0.5 transition-transform'>
						<svg
							className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M19 9l-7 7-7-7' />
						</svg>
					</button>
				</div>
			</div>

			{/* Floating Dropdown Popover */}
			{isOpen && !disabled && (
				<div className='absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] max-h-56 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden divide-y divide-gray-100 animate-in fade-in duration-100'>
					{filteredList.length === 0 ? (
						<div className='p-3.5 text-center text-xs font-bold text-gray-500'>
							{siswaList.length === 0
								? `Tidak ada data santri aktif di kelas ${kelas}`
								: `Santri dengan kata kunci "${searchQuery}" tidak ditemukan`}
						</div>
					) : (
						filteredList.map((s) => {
							const isCurrent = selectedSiswa && String(selectedSiswa.id) === String(s.id);
							return (
								<div
									key={s.id}
									onMouseDown={() => handleSelectItem(s)}
									className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
										isCurrent ? 'bg-yellow-200 font-black' : 'hover:bg-yellow-50 font-bold'
									}`}>
									<div>
										<p className='text-xs text-black leading-tight'>{s.nama_lengkap}</p>
										<p className='text-[10px] text-gray-500 font-mono mt-0.5'>
											NIS: {s.nis || '—'} | Rombel: {s.kelas}
										</p>
									</div>
									{isCurrent ? (
										<span className='text-[10px] bg-black text-white px-2 py-0.5 rounded font-black'>
											Terpilih ✓
										</span>
									) : (
										<span className='text-[10px] text-gray-500 hover:text-black font-semibold'>
											Pilih ↵
										</span>
									)}
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// KOMPONEN LEMBAR DOKUMEN LAPORAN & BERITA ACARA BIMBINGAN SANTRI RESMI
// Digunakan bersama untuk Preview Modal di Layar dan Format Cetak Murni A4
// ============================================================================
function LembarBimbinganDocumentContent({ printItem, schoolProfile = {}, allSiswa = [] }) {
	if (!printItem) return null;

	const siswaDetail = allSiswa.find((s) => String(s.id) === String(printItem.siswa_id));
	const nisSantri = siswaDetail?.nis || '—';
	const dateObj = printItem.tanggal_bimbingan ? new Date(printItem.tanggal_bimbingan) : new Date();
	const formattedDateFull = dateObj.toLocaleDateString('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
	const formattedDateShort = dateObj.toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
	const regNumber = `REG-KSW/${dateObj.getFullYear()}/${String(printItem.id).padStart(4, '0')}`;

	return (
		<div className='w-full text-black font-sans bg-white'>
			{/* 1. KOP SURAT SEKOLAH / PESANTREN RESMI */}
			<div className='border-b-2 border-black pb-2 mb-3'>
				<div className='flex items-center justify-between gap-3'>
					{/* Logo Kiri */}
					<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
						{schoolProfile.logo_kiri ? (
							/* eslint-disable-next-line @next/next/no-img-element */
							<img
								src={schoolProfile.logo_kiri}
								alt='Logo Sekolah'
								className='max-w-full max-h-full object-contain'
							/>
						) : (
							<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded-lg flex items-center justify-center font-bold text-[9px] text-gray-500 text-center leading-tight p-1'>
								LOGO SEKOLAH
							</div>
						)}
					</div>

					{/* Teks Lembaga & Sekolah */}
					<div className='flex-1 text-center px-1'>
						<p className='text-xs font-black uppercase tracking-wider text-gray-800 leading-tight'>
							{schoolProfile.kementerian || 'YAYASAN AL-ISHLAH KUALA GADING'}
						</p>
						<h1 className='text-base sm:text-lg font-black uppercase tracking-tight text-black leading-tight mt-0.5'>
							{schoolProfile.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
						</h1>
						<p className='text-[10px] font-bold text-gray-700 font-mono mt-0.5'>
							NPSN: {schoolProfile.npsn || '69953165'} {schoolProfile.akreditasi ? `• Akreditasi: ${schoolProfile.akreditasi}` : ''}
						</p>
						<p className='text-[9.5px] text-gray-600 mt-0.5 leading-tight'>
							{schoolProfile.alamat || 'Jl. Perintis Desa Kuala Gading, Kec. Batang Cenaku, Kab. Indragiri Hulu, Riau Kode Pos 29355'}
						</p>
						<div className='flex flex-wrap items-center justify-center gap-x-2 text-[9px] text-gray-600 mt-0.5'>
							{schoolProfile.telepon && <span>Telp/WA: {schoolProfile.telepon}</span>}
							{schoolProfile.telepon && schoolProfile.email && <span>•</span>}
							{schoolProfile.email && <span>Email: {schoolProfile.email}</span>}
							{schoolProfile.website && <span>•</span>}
							{schoolProfile.website && <span>Website: {schoolProfile.website}</span>}
						</div>
					</div>

					{/* Logo Kanan */}
					<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
						{schoolProfile.logo_kanan ? (
							/* eslint-disable-next-line @next/next/no-img-element */
							<img
								src={schoolProfile.logo_kanan}
								alt='Logo Kanan'
								className='max-w-full max-h-full object-contain'
							/>
						) : (
							<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded-lg flex items-center justify-center font-bold text-[9px] text-gray-500 text-center leading-tight p-1'>
								LOGO KESISWAAN
							</div>
						)}
					</div>
				</div>

				{/* Garis Ganda Kop Surat Resmi */}
				<div className='mt-2 space-y-0.5'>
					<div className='border-b-2 border-black'></div>
					<div className='border-b border-black/70'></div>
				</div>
			</div>

			{/* 2. JUDUL DOKUMEN & NOMOR REGISTRASI */}
			<div className='text-center my-2.5'>
				<h2 className='text-sm sm:text-base font-black uppercase tracking-wider text-black underline underline-offset-4 decoration-2'>
					BERITA ACARA & LEMBAR LAPORAN BIMBINGAN SANTRI
				</h2>
				<p className='text-[10px] font-black uppercase text-gray-700 tracking-wider mt-1'>
					UNIT KESISWAAN & BIMBINGAN KONSELING (BK)
				</p>
				<div className='inline-flex items-center gap-3 text-[10px] font-mono text-gray-700 mt-1.5 px-3 py-0.5 bg-gray-100 rounded border border-gray-300'>
					<span><b>No:</b> {regNumber}</span>
					<span>•</span>
					<span><b>Tanggal:</b> {formattedDateFull}</span>
				</div>
			</div>

			{/* 3. BAGIAN I: DATA IDENTITAS SANTRI */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black flex items-center justify-between'>
					<span>I. IDENTITAS SANTRI TERBINA</span>
					<span className='font-mono text-[9.5px] font-bold text-gray-700'>Status: {printItem.status}</span>
				</div>
				<table className='w-full text-xs border-x border-b border-black'>
					<tbody>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 w-1/4 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Nama Lengkap Santri
							</td>
							<td className='py-1.5 px-3 w-3/4 font-black text-black'>
								{printItem.nama_santri}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Nomor Induk Siswa (NIS)
							</td>
							<td className='py-1.5 px-3 font-mono font-bold text-black'>
								{nisSantri}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Kelas / Rombongan Belajar
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								Kelas {printItem.kelas}
							</td>
						</tr>
						<tr>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Wali Kelas Pembina
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								{printItem.wali_kelas_nama || '—'}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* 4. BAGIAN II: URAIAN PERKARA & KEDISIPLINAN */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black'>
					II. PERKARA KEDISIPLINAN & KETIDAKHADIRAN
				</div>
				<table className='w-full text-xs border-x border-b border-black'>
					<tbody>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 w-1/4 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Jenis Pelanggaran
							</td>
							<td className='py-1.5 px-3 w-3/4 font-black text-rose-700'>
								{printItem.jenis_pelanggaran}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Akumulasi Alfa / Kejadian
							</td>
							<td className='py-1.5 px-3 font-bold text-black font-mono'>
								{printItem.jumlah_alpa} Kali / Jam Pelajaran Alfa
							</td>
						</tr>
						<tr>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Rekomendasi Tindak Lanjut
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								{printItem.rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas'}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* 5. BAGIAN III: TINDAKAN PEMBINAAN & CATATAN EVALUASI */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black'>
					III. BENTUK PEMBINAAN & HASIL BIMBINGAN
				</div>
				<div className='border-x border-b border-black p-2.5 space-y-2 text-xs'>
					<div>
						<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
							A. Tindakan / Bentuk Penanganan yang Telah Dilakukan:
						</p>
						<p className='mt-0.5 text-black font-semibold pl-2 border-l-2 border-black leading-relaxed'>
							{printItem.bentuk_penanganan}
						</p>
					</div>

					<div>
						<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
							B. Hasil Evaluasi & Catatan Bimbingan:
						</p>
						<p className='mt-0.5 text-black font-medium pl-2 border-l-2 border-gray-400 leading-relaxed'>
							{printItem.hasil_catatan}
						</p>
					</div>

					{printItem.catatan_kesiswaan && (
						<div>
							<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
								C. Catatan Khusus Staf Kesiswaan:
							</p>
							<p className='mt-0.5 text-black font-medium pl-2 border-l-2 border-yellow-500 leading-relaxed bg-yellow-50/50 p-1 rounded'>
								{printItem.catatan_kesiswaan}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* 6. BAGIAN IV: PERNYATAAN & KOMITMEN SANTRI */}
			<div className='mt-3'>
				<div className='border border-black p-2 bg-gray-50 text-[10px] leading-relaxed text-gray-800 rounded'>
					<p className='font-black text-black uppercase text-[9.5px] tracking-wide mb-0.5'>
						Pernyataan & Janji Komitmen Santri:
					</p>
					<p className='italic'>
						&ldquo;Saya yang bertanda tangan di bawah ini menyatakan dengan sesungguhnya telah menerima bimbingan dan pembinaan terkait kedisiplinan tersebut di atas. Saya berjanji sungguh-sungguh untuk mentaati seluruh tata tertib madrasah dan pesantren, tidak mengulangi pelanggaran serupa, rajin mengikuti KBM, serta bersedia menerima sanksi yang lebih tegas apabila di kemudian hari melanggar kembali.&rdquo;
					</p>
				</div>
			</div>

			{/* 7. BAGIAN V: PENGESAHAN TIGA PIHAK (KOLOM TANDA TANGAN) */}
			<div className='mt-3 pt-1'>
				<div className='text-right text-xs font-semibold text-gray-800 mb-1.5'>
					Kuala Gading, {formattedDateShort}
				</div>

				<div className='grid grid-cols-3 gap-3 text-center text-xs'>
					{/* Pihak 1: Santri */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Santri yang Dibina,</p>
							<p className='text-[9px] text-gray-500'>(Pembuat Komitmen)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								{printItem.nama_santri}
							</p>
							<p className='text-[9px] text-gray-600 font-mono'>NIS: {nisSantri}</p>
						</div>
					</div>

					{/* Pihak 2: Wali Kelas */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Wali Kelas / Pembina,</p>
							<p className='text-[9px] text-gray-500'>(Mengetahui & Membina)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								{printItem.wali_kelas_nama || 'Wali Kelas'}
							</p>
							<p className='text-[9px] text-gray-600'>Wali Kelas {printItem.kelas}</p>
						</div>
					</div>

					{/* Pihak 3: Kesiswaan */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Bagian Kesiswaan / BK,</p>
							<p className='text-[9px] text-gray-500'>(Mengesahkan)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								Staf Kesiswaan
							</p>
							<p className='text-[9px] text-gray-600'>Unit Kesiswaan & Kedisiplinan</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function BukuPenangananSantriPage() {
	const [penangananList, setPenangananList] = useState([]);
	const [summary, setSummary] = useState({
		total: 0,
		menungguBimbingan: 0,
		sudahDibina: 0,
		perluPanggilanOrtu: 0,
		selesai: 0,
	});
	const [isTableReady, setIsTableReady] = useState(true);
	const [allSiswa, setAllSiswa] = useState([]);
	const [waliKelasMap, setWaliKelasMap] = useState({});
	const [kelasList, setKelasList] = useState([]);

	const [loading, setLoading] = useState(true);
	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterStatus, setFilterStatus] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');
	const [activeTab, setActiveTab] = useState('daftar'); // 'daftar' | 'template'

	// Modal Form State
	const [showModalForm, setShowModalForm] = useState(false);
	const [selectedKasus, setSelectedKasus] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	// Modal Print Preview State
	const [showPrintModal, setShowPrintModal] = useState(false);
	const [printItem, setPrintItem] = useState(null);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Form State Khusus Modal
	const [formKelas, setFormKelas] = useState('');
	const [formWaliKelas, setFormWaliKelas] = useState('');
	const [formSiswa, setFormSiswa] = useState(null); // { id, nama_lengkap, nis, kelas }
	const [siswaSearchText, setSiswaSearchText] = useState('');

	// Pelanggaran State
	const [selectedPelanggaranOption, setSelectedPelanggaranOption] = useState('Bolos Jam Pelajaran');
	const [isPelanggaranManual, setIsPelanggaranManual] = useState(false);
	const [customPelanggaranText, setCustomPelanggaranText] = useState('');

	// Form Fields Lainnya
	const [formJumlahAlpa, setFormJumlahAlpa] = useState(1);
	const [formTanggalBimbingan, setFormTanggalBimbingan] = useState(() => getTodayDateString());
	const [formBentukPenanganan, setFormBentukPenanganan] = useState('');
	const [formHasilCatatan, setFormHasilCatatan] = useState('');
	const [formStatus, setFormStatus] = useState('Sudah Dibina');
	const [formRekomendasi, setFormRekomendasi] = useState('Pembinaan Wali Kelas');
	const [formCatatanKesiswaan, setFormCatatanKesiswaan] = useState('');

	// Fetch Data Penanganan & Master Data (Kelas, Siswa, Wali Kelas)
	const fetchPenanganan = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (filterKelas && filterKelas !== 'Semua') params.append('kelas', filterKelas);
			if (filterStatus && filterStatus !== 'Semua') params.append('status', filterStatus);
			if (searchQuery && searchQuery.trim() !== '') params.append('search', searchQuery.trim());

			const res = await fetch(`/api/kesiswaan/penanganan?${params.toString()}`);
			const data = await res.json();

			if (data.success) {
				setPenangananList(data.penangananList || []);
				setSummary(data.summary || {});
				setWaliKelasMap(data.waliKelasMap || {});
				setAllSiswa(data.allSiswa || []);
				setKelasList(data.kelasList || []);
				setIsTableReady(data.isTableReady !== false);
			} else {
				setPenangananList([]);
			}
		} catch (err) {
			console.error('Error fetching penanganan santri:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memuat Data',
				text: err.message,
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setLoading(false);
		}
	}, [filterKelas, filterStatus, searchQuery]);

	useEffect(() => {
		fetchPenanganan();
	}, [fetchPenanganan]);

	// Fetch Profil Sekolah Resmi untuk Lembar Cetak Laporan Bimbingan
	useEffect(() => {
		fetchSchoolProfile()
			.then((data) => {
				if (data) setSchoolProfile(data);
			})
			.catch(() => {});
	}, []);

	// Filter santri di kelas yang sedang dipilih di modal form
	const siswaDiKelas = useMemo(() => {
		if (!formKelas) return [];
		return allSiswa.filter((s) => s.kelas === formKelas);
	}, [allSiswa, formKelas]);

	// Filter pencarian santri di dalam kelas tersebut
	const filteredSiswaDiKelas = useMemo(() => {
		if (!siswaSearchText.trim()) return siswaDiKelas;
		const query = siswaSearchText.toLowerCase();
		return siswaDiKelas.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(query)) ||
				(s.nis && String(s.nis).includes(query))
		);
	}, [siswaDiKelas, siswaSearchText]);

	// Saat user mengganti pilihan Rombel/Kelas di form
	const handleKelasChange = (newKelas) => {
		setFormKelas(newKelas);
		// Otomatis isi wali kelas dari database
		const detectedWali = waliKelasMap[newKelas] || '';
		setFormWaliKelas(detectedWali);
		// Reset santri terpilih jika kelas diganti
		setFormSiswa(null);
		setSiswaSearchText('');
	};

	// Saat santri dipilih dari search list
	const handlePilihSantri = (siswa) => {
		setFormSiswa(siswa);
		setSiswaSearchText('');
	};

	// Handle Ganti Opsi Pelanggaran
	const handlePelanggaranOptionChange = (val) => {
		if (val === 'Lainnya') {
			setIsPelanggaranManual(true);
			setSelectedPelanggaranOption('Lainnya');
		} else {
			setIsPelanggaranManual(false);
			setSelectedPelanggaranOption(val);
			setCustomPelanggaranText('');
		}
	};

	// Reset Form untuk Buka Modal Tambah
	const handleOpenCreateModal = () => {
		setSelectedKasus(null);
		// Set default kelas ke kelas pertama jika ada
		const firstKelas = kelasList[0]?.nama_kelas || '';
		setFormKelas(firstKelas);
		setFormWaliKelas(firstKelas ? (waliKelasMap[firstKelas] || '') : '');
		setFormSiswa(null);
		setSiswaSearchText('');

		setSelectedPelanggaranOption('Bolos Jam Pelajaran');
		setIsPelanggaranManual(false);
		setCustomPelanggaranText('');

		setFormJumlahAlpa(1);
		setFormTanggalBimbingan(getTodayDateString());
		setFormBentukPenanganan('Bimbingan pribadi tatap muka & surat komitmen disiplin KBM.');
		setFormHasilCatatan('Santri mengakui kesalahan, memahami konsekuensi, dan berjanji disiplin masuk kelas.');
		setFormStatus('Sudah Dibina');
		setFormRekomendasi('Pembinaan Wali Kelas');
		setFormCatatanKesiswaan('');
		setShowModalForm(true);
	};

	// Buka Modal Edit Kasus
	const handleOpenEditModal = (item) => {
		setSelectedKasus(item);
		setFormKelas(item.kelas || '');
		setFormWaliKelas(item.wali_kelas_nama || (waliKelasMap[item.kelas] || ''));
		
		const existingSiswa = allSiswa.find((s) => String(s.id) === String(item.siswa_id)) || {
			id: item.siswa_id,
			nama_lengkap: item.nama_santri,
			kelas: item.kelas,
		};
		setFormSiswa(existingSiswa);
		setSiswaSearchText('');

		// Deteksi jenis pelanggaran
		const standardOptions = [
			'Bolos Jam Pelajaran',
			'Keluyuran saat KBM',
			'Tidak Hadir Tanpa Keterangan (Alpa)',
			'Keterlambatan Berulang',
		];
		if (standardOptions.includes(item.jenis_pelanggaran)) {
			setSelectedPelanggaranOption(item.jenis_pelanggaran);
			setIsPelanggaranManual(false);
			setCustomPelanggaranText('');
		} else {
			setSelectedPelanggaranOption('Lainnya');
			setIsPelanggaranManual(true);
			setCustomPelanggaranText(item.jenis_pelanggaran);
		}

		setFormJumlahAlpa(item.jumlah_alpa || 1);
		setFormTanggalBimbingan(item.tanggal_bimbingan || getTodayDateString());
		setFormBentukPenanganan(item.bentuk_penanganan || '');
		setFormHasilCatatan(item.hasil_catatan || '');
		setFormStatus(item.status || 'Sudah Dibina');
		setFormRekomendasi(item.rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas');
		setFormCatatanKesiswaan(item.catatan_kesiswaan || '');
		setShowModalForm(true);
	};

	// Submit Form
	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!formKelas) {
			Swal.fire({
				icon: 'warning',
				title: 'Rombel Belum Dipilih',
				text: 'Silakan pilih Rombel/Kelas terlebih dahulu di bagian atas form.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		if (!formSiswa) {
			Swal.fire({
				icon: 'warning',
				title: 'Santri Belum Dipilih',
				text: 'Silakan pilih santri yang bersangkutan dari daftar kelas.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		const finalJenisPelanggaran = isPelanggaranManual
			? customPelanggaranText.trim()
			: selectedPelanggaranOption;

		if (!finalJenisPelanggaran) {
			Swal.fire({
				icon: 'warning',
				title: 'Jenis Pelanggaran Kosong',
				text: 'Silakan isi jenis pelanggaran santri.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		if (!formBentukPenanganan.trim() || !formHasilCatatan.trim()) {
			Swal.fire({
				icon: 'warning',
				title: 'Data Belum Lengkap',
				text: 'Bentuk penanganan dan hasil/catatan bimbingan wajib diisi.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		const payload = {
			id: selectedKasus?.id,
			siswa_id: formSiswa.id,
			nama_santri: formSiswa.nama_lengkap,
			kelas: formKelas,
			wali_kelas_nama: formWaliKelas || 'Wali Kelas',
			jenis_pelanggaran: finalJenisPelanggaran,
			jumlah_alpa: Number(formJumlahAlpa) || 1,
			tanggal_bimbingan: formTanggalBimbingan,
			bentuk_penanganan: formBentukPenanganan,
			hasil_catatan: formHasilCatatan,
			status: formStatus,
			rekomendasi_tindak_lanjut: formRekomendasi,
			catatan_kesiswaan: formCatatanKesiswaan,
		};

		try {
			setSubmitting(true);
			const method = selectedKasus ? 'PUT' : 'POST';
			const res = await fetch('/api/kesiswaan/penanganan', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json();

			if (!res.ok || !result.success) {
				throw new Error(result.error || 'Gagal menyimpan laporan');
			}

			Swal.fire({
				icon: 'success',
				title: 'Berhasil Disimpan!',
				text: result.message,
				confirmButtonColor: '#10B981',
			});

			setShowModalForm(false);
			fetchPenanganan();
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

	// Hapus Kasus
	const handleDeleteKasus = async (id, nama) => {
		const confirm = await Swal.fire({
			title: 'Hapus Laporan Bimbingan?',
			text: `Data penanganan santri atas nama ${nama} akan dihapus secara permanen.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
		});

		if (confirm.isConfirmed) {
			try {
				const res = await fetch(`/api/kesiswaan/penanganan?id=${id}`, { method: 'DELETE' });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error);

				Swal.fire({
					icon: 'success',
					title: 'Terhapus',
					text: 'Laporan berhasil dihapus.',
					confirmButtonColor: '#10B981',
				});
				fetchPenanganan();
			} catch (err) {
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menghapus',
					text: err.message,
					confirmButtonColor: '#E8451A',
				});
			}
		}
	};

	// Format Teks Laporan WhatsApp
	const generateTextReport = (item) => {
		return `*LAPORAN PENANGANAN SANTRI*

Nama Santri : ${item.nama_santri}
Kelas : ${item.kelas}
Wali Kelas : ${item.wali_kelas_nama || '—'}
Jenis Pelanggaran : ${item.jenis_pelanggaran}
Jumlah Alpa : ${item.jumlah_alpa}
Tanggal Bimbingan : ${item.tanggal_bimbingan}
Bentuk Penanganan yang Sudah Dilakukan : ${item.bentuk_penanganan}
Hasil / Catatan : ${item.hasil_catatan}
Status Kasus : ${item.status}`;
	};

	const handleCopyReport = (item) => {
		const text = generateTextReport(item);
		navigator.clipboard.writeText(text);
		Swal.fire({
			icon: 'success',
			title: 'Tersalin!',
			text: 'Format teks Laporan Penanganan Santri telah disalin ke clipboard.',
			timer: 1500,
			showConfirmButton: false,
		});
	};

	// Buka Modal Cetak / Print Lembar Bimbingan Santri
	const handleOpenPrintModal = (item) => {
		setPrintItem(item);
		setShowPrintModal(true);
	};

	// Memicu Print Dialog Browser untuk Cetak Lembar A4
	const handleExecutePrint = () => {
		window.print();
	};

	// Loader layar penuh saat data belum siap
	if (loading && allSiswa.length === 0) {
		return <Loader />;
	}

	return (
		<>
			{/* KONTEN UTAMA HALAMAN KESISWAAN (Otomatis disembunyikan saat mencetak lembar bimbingan) */}
			<div className={`space-y-6 ${showPrintModal ? 'print:hidden' : ''}`}>
			{/* Banner Peringatan jika tabel belum dibuat di Supabase */}
			{!isTableReady && (
				<div className='p-4 bg-amber-100 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
					<div className='flex items-center gap-2.5'>
						<span className='text-2xl'>⚠️</span>
						<div>
							<p className='font-black text-sm text-black'>Tabel Database Belum Dibuat di Supabase</p>
							<p className='text-xs font-semibold text-gray-700'>
								Jalankan file migrasi <code>migrations/add_bimbingan_penanganan_santri.sql</code> di Supabase SQL Editor agar data tersimpan permanen.
							</p>
						</div>
					</div>
					<button
						onClick={() => {
							const sql = `CREATE TABLE IF NOT EXISTS public.kesiswaan_penanganan_santri (
    id SERIAL PRIMARY KEY,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_santri VARCHAR(255),
    kelas VARCHAR(50) NOT NULL,
    wali_kelas_id TEXT,
    wali_kelas_nama VARCHAR(255),
    jenis_pelanggaran VARCHAR(100) NOT NULL DEFAULT 'Bolos Jam Pelajaran',
    jumlah_alpa INT DEFAULT 1,
    tanggal_bimbingan DATE NOT NULL DEFAULT CURRENT_DATE,
    bentuk_penanganan TEXT NOT NULL,
    hasil_catatan TEXT NOT NULL,
    status VARCHAR(40) DEFAULT 'Sudah Dibina' CHECK (status IN ('Menunggu Bimbingan', 'Sudah Dibina', 'Perlu Panggilan Orang Tua', 'Selesai')),
    rekomendasi_tindak_lanjut VARCHAR(50) DEFAULT 'Pembinaan Wali Kelas' CHECK (rekomendasi_tindak_lanjut IN ('Pembinaan Wali Kelas', 'Panggilan Orang Tua', 'Bimbingan Konseling', 'Selesai')),
    catatan_kesiswaan TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`;
							navigator.clipboard.writeText(sql);
							Swal.fire({ icon: 'success', title: 'SQL Tersalin', text: 'Script SQL disalin ke clipboard.' });
						}}
						className='px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📋 Salin SQL
					</button>
				</div>
			)}

			{/* Banner Utama */}
			<div className='p-6 bg-gradient-to-r from-amber-100 via-yellow-100 to-orange-100 border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1.5'>
						<span className='px-2.5 py-0.5 bg-black text-white text-[10px] font-black rounded-md uppercase tracking-wider'>
							Buku Kendali Disiplin
						</span>
						<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded-md text-[10px] font-black text-black'>
							Kolaborasi Wali Kelas & Kesiswaan
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>📋</span> Laporan Penanganan & Bimbingan Santri
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-2xl'>
						Pencatatan resmi hasil bimbingan pribadi Wali Kelas untuk santri yang bolos jam pelajaran atau melanggar disiplin, sebagai dasar data resmi pemanggilan orang tua.
					</p>
				</div>

				<div className='flex flex-wrap items-center gap-2 shrink-0'>
					<button
						onClick={handleOpenCreateModal}
						className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-2xl font-black text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5'>
						<span>➕</span> Catat Laporan Bimbingan
					</button>

					<button
						onClick={() => setActiveTab(activeTab === 'template' ? 'daftar' : 'template')}
						className='px-4 py-2 bg-white hover:bg-gray-100 text-black border-2 border-black rounded-2xl font-black text-xs sm:text-sm shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
						<span>📢</span> {activeTab === 'template' ? 'Lihat Tabel Kasus' : 'Format Pesan WA'}
					</button>
				</div>
			</div>

			{/* Kartu Ringkasan Status */}
			<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4'>
				<div className='bg-white p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-gray-500 block mb-0.5'>Total Laporan Masuk</span>
					<div className='text-2xl font-black text-black'>{summary.total}</div>
					<span className='text-[10px] font-bold text-gray-600'>Seluruh rombel</span>
				</div>

				<div className='bg-yellow-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-amber-700 block mb-0.5'>⏳ Menunggu Bimbingan</span>
					<div className='text-2xl font-black text-amber-800'>{summary.menungguBimbingan}</div>
					<span className='text-[10px] font-bold text-amber-900'>Belum dibina wali kelas</span>
				</div>

				<div className='bg-emerald-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-emerald-700 block mb-0.5'>✅ Sudah Dibina</span>
					<div className='text-2xl font-black text-emerald-800'>{summary.sudahDibina}</div>
					<span className='text-[10px] font-bold text-emerald-900'>Laporan pembinaan masuk</span>
				</div>

				<div className='bg-rose-50 p-4 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<span className='text-[10px] font-black uppercase text-rose-700 block mb-0.5'>🚨 Perlu Panggilan Ortu</span>
					<div className='text-2xl font-black text-rose-800'>{summary.perluPanggilanOrtu}</div>
					<span className='text-[10px] font-bold text-rose-900'>Eskalasi ke Kesiswaan</span>
				</div>
			</div>

			{/* VIEW TAB 2: FORMAT PESAN EDARAN WA */}
			{activeTab === 'template' && (
				<div className='bg-white p-6 border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex items-center justify-between border-b-2 border-black pb-3'>
						<div>
							<h3 className='font-black text-base text-black flex items-center gap-1.5'>
								<span>📢</span> Draf Pesan Siaran Resmi Kesiswaan ke Wali Kelas
							</h3>
							<p className='text-xs text-gray-600 font-medium'>
								Salin draf surat edaran ini untuk dibagikan ke grup WhatsApp Dewan Guru & Wali Kelas.
							</p>
						</div>
						<button
							onClick={() => {
								const edaran = `*Assalamu'alaikum Warahmatullahi Wabarakatuh.*

Kepada Yth.
Bapak/Ibu Guru dan Wali Kelas
di Tempat

_Dengan hormat,_

Semoga kita semua senantiasa dalam lindungan Allah SWT.

Kami sampaikan bahwa dalam beberapa pekan terakhir, angka pelanggaran santri terutama kasus *bolos pada jam pelajaran* mengalami peningkatan yang cukup signifikan.

Bagian Kesiswaan bersama Bagian Keamanan telah melakukan upaya pencarian dan penertiban secara maksimal. Namun dengan jumlah santri yang banyak, kami tidak bisa bekerja sendiri tanpa dukungan Bapak/Ibu Guru dan Wali Kelas sebagai orang tua kedua mereka di Sekolah.

Untuk itu, kami sangat mengharapkan peran aktif Bapak/Ibu sekalian:

*1. Bagi Wali Kelas yang belum melakukan bimbingan,* mohon dengan segala hormat untuk segera melakukan pembinaan pribadi kepada santri yang bersangkutan di kelasnya.

*2. Bagi Wali Kelas yang sudah melakukan bimbingan,* mohon berkenan melaporkan hasilnya kepada kami melalui aplikasi Guru App atau format resmi berikut:

*LAPORAN PENANGANAN SANTRI*

Nama Santri : 
Kelas : 
Wali Kelas : 
Jenis Pelanggaran : (Contoh: Bolos Jam Pelajaran / Keluyuran)
Jumlah Alpa : 
Tanggal Bimbingan : 
Bentuk Penanganan yang Sudah Dilakukan : 
Hasil / Catatan : 

Laporan tersebut sangat penting sebagai data resmi kami untuk ditindaklanjuti dan disampaikan kepada Wali Murid.

Atas perhatian, keikhlasan, dan kerjasamanya, kami haturkan jazakumullahu khairan katsiran.

*Wassalamu'alaikum Warahmatullahi Wabarakatuh.*

*Hormat kami,*
*Bagian Kesiswaan*`;
								navigator.clipboard.writeText(edaran);
								Swal.fire({
									icon: 'success',
									title: 'Tersalin!',
									text: 'Format siaran edaran telah disalin ke clipboard.',
									timer: 1500,
									showConfirmButton: false,
								});
							}}
							className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1'>
							<span>📋</span> Salin Draf Siaran
						</button>
					</div>

					<pre className='p-4 bg-yellow-50 border-2 border-black rounded-2xl text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto'>
{`*Assalamu'alaikum Warahmatullahi Wabarakatuh.*

Kepada Yth.
Bapak/Ibu Guru dan Wali Kelas
di Tempat

Kami sampaikan bahwa dalam beberapa pekan terakhir, angka pelanggaran santri terutama kasus *bolos pada jam pelajaran* mengalami peningkatan yang cukup signifikan.

Bagian Kesiswaan bersama Bagian Keamanan telah melakukan upaya pencarian dan penertiban secara maksimal. Namun dengan jumlah santri yang banyak, kami tidak bisa bekerja sendiri tanpa dukungan Bapak/Ibu Guru dan Wali Kelas sebagai orang tua kedua mereka di Sekolah.

Untuk itu, kami sangat mengharapkan peran aktif Bapak/Ibu sekalian:
1. Bagi Wali Kelas yang belum melakukan bimbingan, mohon segera melakukan pembinaan pribadi.
2. Bagi Wali Kelas yang sudah melakukan bimbingan, mohon melaporkan hasilnya dengan format resmi:

*LAPORAN PENANGANAN SANTRI*
Nama Santri :
Kelas :
Wali Kelas :
Jenis Pelanggaran : (Contoh: Bolos Jam Pelajaran / Keluyuran)
Jumlah Alpa :
Tanggal Bimbingan :
Bentuk Penanganan yang Sudah Dilakukan :
Hasil / Catatan :

Laporan dapat diinput langsung ke aplikasi Guru App atau dikirim japri Kesiswaan.`}
					</pre>
				</div>
			)}

			{/* VIEW TAB 1: TABEL LAPORAN KASUS */}
			{activeTab === 'daftar' && (
				<div className='bg-white border-3 border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
					{/* Toolbar Filter & Pencarian */}
					<div className='p-4 border-b-2 border-black bg-yellow-50 flex flex-wrap items-center justify-between gap-3'>
						<div className='flex flex-wrap items-center gap-2'>
							<div>
								<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Rombel</label>
								<select
									value={filterKelas}
									onChange={(e) => setFilterKelas(e.target.value)}
									className='neo-input !py-1 text-xs font-bold bg-white'>
									<option value='Semua'>Semua Rombel</option>
									{kelasList.map((k) => (
										<option key={k.id || k.nama_kelas} value={k.nama_kelas || k.kelas}>
											{k.nama_kelas || k.kelas}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Status</label>
								<select
									value={filterStatus}
									onChange={(e) => setFilterStatus(e.target.value)}
									className='neo-input !py-1 text-xs font-bold bg-white'>
									<option value='Semua'>Semua Status</option>
									<option value='Menunggu Bimbingan'>⏳ Menunggu Bimbingan</option>
									<option value='Sudah Dibina'>✅ Sudah Dibina</option>
									<option value='Perlu Panggilan Orang Tua'>🚨 Perlu Panggilan Ortu</option>
									<option value='Selesai'>🟢 Selesai / Terbina</option>
								</select>
							</div>
						</div>

						<div className='w-full sm:w-72'>
							<label className='block text-[10px] font-black uppercase text-gray-600 mb-0.5'>Cari Santri / Wali Kelas</label>
							<input
								type='text'
								placeholder='Ketik nama santri atau wali kelas...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='neo-input !py-1 text-xs w-full bg-white font-medium'
							/>
						</div>
					</div>

					{/* Tabel Data Kasus */}
					{loading ? (
						<div className='p-16 text-center space-y-3 bg-white'>
							<div className='inline-block w-9 h-9 border-4 border-black border-t-yellow-400 rounded-full animate-spin'></div>
							<p className='text-xs font-black text-black tracking-wide'>
								Memuat data penanganan santri...
							</p>
						</div>
					) : penangananList.length === 0 ? (
						<div className='p-12 text-center space-y-2'>
							<span className='text-4xl block'>📋</span>
							<p className='text-base font-black text-black'>Belum Ada Laporan Penanganan Santri</p>
							<p className='text-xs text-gray-500 max-w-md mx-auto'>
								Silakan klik tombol <b>➕ Catat Laporan Bimbingan</b> untuk memasukkan laporan pembinaan pribadi dari wali kelas atau kesiswaan.
							</p>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[1250px] text-left text-sm'>
								<thead>
									<tr className='border-b-2 border-black text-xs font-black uppercase tracking-wider text-black bg-yellow-100/70'>
										<th className='py-3.5 px-3 text-center w-12'>No</th>
										<th className='py-3.5 px-4 min-w-[200px]'>Santri & Kelas</th>
										<th className='py-3.5 px-4 min-w-[200px]'>Wali Kelas</th>
										<th className='py-3.5 px-4 min-w-[210px]'>Jenis Pelanggaran</th>
										<th className='py-3.5 px-3 text-center min-w-[80px]'>Alpa</th>
										<th className='py-3.5 px-4 min-w-[120px]'>Tgl Bimbingan</th>
										<th className='py-3.5 px-4 min-w-[320px]'>Bentuk Penanganan & Catatan</th>
										<th className='py-3.5 px-4 text-center min-w-[170px]'>Status Kasus</th>
										<th className='py-3.5 px-4 text-right min-w-[220px]'>Tindakan</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-200 font-bold'>
									{penangananList.map((item, idx) => (
										<tr key={item.id} className='hover:bg-yellow-50 transition-colors'>
											<td className='py-4 px-3 font-mono text-xs text-center text-gray-500'>
												{idx + 1}
											</td>

											<td className='py-4 px-4 min-w-[200px] whitespace-nowrap'>
												<p className='font-black text-sm text-black'>{item.nama_santri}</p>
												<span className='px-2 py-0.5 bg-yellow-100 border border-black/30 rounded text-xs font-black inline-block mt-0.5'>
													Kelas {item.kelas}
												</span>
											</td>

											<td className='py-4 px-4 min-w-[200px] whitespace-nowrap'>
												<span className='text-xs font-bold text-gray-900'>
													{item.wali_kelas_nama || '—'}
												</span>
											</td>

											<td className='py-4 px-4 min-w-[210px] whitespace-nowrap'>
												<span className='px-2.5 py-1 bg-rose-100 text-rose-950 border border-rose-300 rounded-lg text-xs font-black inline-block'>
													{item.jenis_pelanggaran}
												</span>
											</td>

											<td className='py-4 px-3 text-center min-w-[80px] whitespace-nowrap'>
												<span className='px-2.5 py-1 bg-gray-100 border border-black/40 rounded-md text-xs font-mono font-black'>
													{item.jumlah_alpa}x
												</span>
											</td>

											<td className='py-4 px-4 text-xs font-mono font-bold text-gray-700 whitespace-nowrap'>
												{item.tanggal_bimbingan}
											</td>

											<td className='py-4 px-4 min-w-[320px] max-w-md'>
												<div className='space-y-1'>
													<p className='text-xs text-black font-black leading-snug'>
														🛠️ {item.bentuk_penanganan}
													</p>
													<p className='text-[11px] text-gray-600 font-medium leading-snug'>
														📝 {item.hasil_catatan}
													</p>
												</div>
											</td>

											<td className='py-4 px-4 text-center min-w-[170px] whitespace-nowrap'>
												<span
													className={`px-3 py-1 rounded-lg text-xs font-black border inline-flex items-center gap-1 ${
														item.status === 'Sudah Dibina'
															? 'bg-emerald-100 text-emerald-950 border-emerald-400'
															: item.status === 'Perlu Panggilan Orang Tua'
															? 'bg-rose-500 text-white border-black'
															: item.status === 'Selesai'
															? 'bg-blue-100 text-blue-900 border-blue-400'
															: 'bg-amber-100 text-amber-900 border-amber-400'
													}`}>
													{item.status === 'Sudah Dibina' && '✅ '}
													{item.status === 'Perlu Panggilan Orang Tua' && '🚨 '}
													{item.status === 'Selesai' && '🟢 '}
													{item.status === 'Menunggu Bimbingan' && '⏳ '}
													{item.status}
												</span>
											</td>

											<td className='py-4 px-4 text-right min-w-[220px] whitespace-nowrap'>
												<div className='flex items-center justify-end gap-1.5'>
													<button
														onClick={() => handleCopyReport(item)}
														title='Salin Format Laporan WA'
														className='p-1.5 bg-white hover:bg-gray-100 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5'>
														📋
													</button>

													<button
														onClick={() => handleOpenPrintModal(item)}
														title='Cetak Lembar Laporan Bimbingan Santri (A4)'
														className='p-1.5 bg-cyan-200 hover:bg-cyan-300 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5'>
														🖨️
													</button>

													<button
														onClick={() => handleOpenEditModal(item)}
														title='Edit / Ubah Laporan'
														className='p-1.5 bg-yellow-300 hover:bg-yellow-400 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] transition-transform active:translate-x-0.5 active:translate-y-0.5'>
														✏️
													</button>

													{item.status !== 'Perlu Panggilan Orang Tua' && item.status !== 'Selesai' && (
														<Link
															href={`/kesiswaan/pemanggilan-ortu?siswa_id=${item.siswa_id}&penanganan_id=${item.id}&nama=${encodeURIComponent(item.nama_santri)}`}
															title='Eskalasi: Terbitkan Surat Pemanggilan Ortu'
															className='px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all inline-flex items-center gap-1.5'>
															<span>🚨</span> Panggil Ortu
														</Link>
													)}

													<button
														onClick={() => handleDeleteKasus(item.id, item.nama_santri)}
														title='Hapus Laporan'
														className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-400 rounded-lg text-xs transition-colors'>
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
			)}

			{/* ======================================================================== */}
			{/* MODAL FORM: CATAT / EDIT LAPORAN PENANGANAN SANTRI */}
			{/* Didesain sesuai alur: Rombel & Wali Kelas Teratas -> Pilih Santri -> Pelanggaran Manual */}
			{/* ======================================================================== */}
			{showModalForm && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-6 space-y-4 animate-in fade-in zoom-in duration-150'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<div>
								<span className='px-2 py-0.5 bg-yellow-400 border border-black rounded text-[10px] font-black uppercase'>
									Format Resmi Kesiswaan
								</span>
								<h2 className='text-lg font-black text-black mt-1 flex items-center gap-1.5'>
									<span>📝</span> {selectedKasus ? 'Edit Laporan Penanganan Santri' : 'Catat Laporan Penanganan Santri'}
								</h2>
							</div>
							<button
								type='button'
								onClick={() => setShowModalForm(false)}
								title='Tutup Formulir'
								className='w-8 h-8 rounded-xl border-2 border-black bg-yellow-200 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0'>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
									<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<form onSubmit={handleSubmit} className='space-y-4'>
							{/* ============================================================ */}
							{/* BAGIAN 1 PALING ATAS: ROMBEL & WALI KELAS (OTOMATIS) */}
							{/* ============================================================ */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 bg-yellow-50/80 p-3.5 border-2 border-black rounded-2xl'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										1. Pilih Rombel / Kelas <span className='text-rose-500'>*</span>
									</label>
									<select
										value={formKelas}
										onChange={(e) => handleKelasChange(e.target.value)}
										disabled={!!selectedKasus}
										required
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value=''>-- Pilih Rombel --</option>
										{kelasList.map((k) => {
											const val = k.nama_kelas || k.kelas;
											return (
												<option key={k.id || val} value={val}>
													Kelas {val}
												</option>
											);
										})}
									</select>
								</div>

								<div>
									<div className='flex items-center justify-between mb-1'>
										<label className='block text-xs font-black uppercase text-black'>
											Wali Kelas
										</label>
										<span className='text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded'>
											Otomatis dari Rombel
										</span>
									</div>
									<input
										type='text'
										value={formWaliKelas}
										onChange={(e) => setFormWaliKelas(e.target.value)}
										placeholder='Wali kelas otomatis terisi...'
										className='neo-input w-full text-xs font-bold bg-white text-gray-800'
									/>
								</div>
							</div>

							{/* ============================================================ */}
							{/* BAGIAN 2: PILIH SANTRI (SEARCHABLE DROPDOWN KHUSUS KELAS TERPILIH) */}
							{/* ============================================================ */}
							<div>
								<div className='flex items-center justify-between mb-1'>
									<label className='block text-xs font-black uppercase text-black'>
										2. Pilih Santri {formKelas ? `(Rombel ${formKelas})` : ''} <span className='text-rose-500'>*</span>
									</label>
									{formKelas && (
										<span className='text-[10px] font-bold text-gray-600'>
											{siswaDiKelas.length} Santri di kelas ini
										</span>
									)}
								</div>

								<SearchableDropdownSiswa
									kelas={formKelas}
									siswaList={siswaDiKelas}
									selectedSiswa={formSiswa}
									onSelect={(s) => setFormSiswa(s)}
									disabled={!formKelas || !!selectedKasus}
								/>

								{formSiswa && (
									<div className='mt-2 px-3 py-1.5 bg-emerald-100 border border-emerald-400 rounded-lg flex items-center justify-between text-xs font-black text-emerald-950'>
										<span>
											✓ Santri Terpilih: <b>{formSiswa.nama_lengkap}</b> (NIS: {formSiswa.nis || '—'})
										</span>
										<span className='text-[10px] bg-white border border-emerald-600 px-1.5 py-0.2 rounded'>
											Siap Dicatat
										</span>
									</div>
								)}
							</div>

							{/* ============================================================ */}
							{/* BAGIAN 3: JENIS PELANGGARAN (DENGAN INPUT MANUAL) */}
							{/* ============================================================ */}
							<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
								<div className='sm:col-span-2'>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										3. Jenis Pelanggaran <span className='text-rose-500'>*</span>
									</label>
									<select
										value={isPelanggaranManual ? 'Lainnya' : selectedPelanggaranOption}
										onChange={(e) => handlePelanggaranOptionChange(e.target.value)}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Bolos Jam Pelajaran'>Bolos Jam Pelajaran</option>
										<option value='Keluyuran saat KBM'>Keluyuran saat KBM</option>
										<option value='Tidak Hadir Tanpa Keterangan (Alpa)'>Tidak Hadir Tanpa Keterangan (Alpa)</option>
										<option value='Keterlambatan Berulang'>Keterlambatan Berulang</option>
										<option value='Lainnya'>✏️ Pelanggaran Lainnya (Input Manual)...</option>
									</select>

									{/* Field Input Manual jika memilih Lainnya */}
									{isPelanggaranManual && (
										<div className='mt-2'>
											<input
												type='text'
												value={customPelanggaranText}
												onChange={(e) => setCustomPelanggaranText(e.target.value)}
												placeholder='Tuliskan jenis pelanggaran secara manual di sini...'
												required
												className='neo-input w-full text-xs font-bold bg-yellow-50 border-rose-400'
											/>
										</div>
									)}
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Jumlah Alpa
									</label>
									<input
										type='number'
										min='1'
										value={formJumlahAlpa}
										onChange={(e) => setFormJumlahAlpa(e.target.value)}
										className='neo-input w-full text-xs font-mono font-bold bg-white'
									/>
								</div>
							</div>

							{/* Tanggal Bimbingan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									4. Tanggal Bimbingan Pribadi <span className='text-rose-500'>*</span>
								</label>
								<input
									type='date'
									value={formTanggalBimbingan}
									onChange={(e) => setFormTanggalBimbingan(e.target.value)}
									required
									className='neo-input w-full text-xs font-bold bg-white'
								/>
							</div>

							{/* Bentuk Penanganan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									5. Bentuk Penanganan yang Sudah Dilakukan <span className='text-rose-500'>*</span>
								</label>
								<textarea
									rows='2'
									value={formBentukPenanganan}
									onChange={(e) => setFormBentukPenanganan(e.target.value)}
									placeholder='Contoh: Pembinaan tatap muka di ruang guru, membuat surat komitmen tidak mengulang, dan penugasan murajaah...'
									required
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							{/* Hasil / Catatan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									6. Hasil / Catatan Bimbingan <span className='text-rose-500'>*</span>
								</label>
								<textarea
									rows='2'
									value={formHasilCatatan}
									onChange={(e) => setFormHasilCatatan(e.target.value)}
									placeholder='Contoh: Santri mengakui bolos jam ke-5, berjanji tidak mengulangi dan siap menerima sanksi bila melanggar lagi...'
									required
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							{/* Status & Rekomendasi Tindak Lanjut */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Status Kasus</label>
									<select
										value={formStatus}
										onChange={(e) => setFormStatus(e.target.value)}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Sudah Dibina'>✅ Sudah Dibina</option>
										<option value='Menunggu Bimbingan'>⏳ Menunggu Bimbingan</option>
										<option value='Perlu Panggilan Orang Tua'>🚨 Perlu Panggilan Orang Tua</option>
										<option value='Selesai'>🟢 Selesai / Terbina</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Rekomendasi Tindak Lanjut</label>
									<select
										value={formRekomendasi}
										onChange={(e) => setFormRekomendasi(e.target.value)}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Pembinaan Wali Kelas'>Cukup Pantauan Wali Kelas</option>
										<option value='Panggilan Orang Tua'>Eskalasi: Panggilan Orang Tua</option>
										<option value='Bimbingan Konseling'>Rujukan ke Guru BK</option>
										<option value='Selesai'>Kasus Tuntas</option>
									</select>
								</div>
							</div>

							{/* Tombol Aksi */}
							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setShowModalForm(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-emerald-400 hover:bg-emerald-500 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed'>
									{submitting ? (
										<>
											<span className='inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin'></span>
											<span>Menyimpan...</span>
										</>
									) : (
										<>
											<span>💾</span>
											<span>Simpan Laporan</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			</div>

			{/* ======================================================================== */}
			{/* 1. MODAL PREVIEW DI LAYAR (Hanya tampil di browser layar, print:hidden)   */}
			{/* ======================================================================== */}
			{showPrintModal && printItem && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Toolbar Header */}
						<div className='p-4 bg-yellow-200 border-b-2 border-black flex items-center justify-between gap-3'>
							<div className='flex items-center gap-2.5'>
								<span className='w-9 h-9 bg-white border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
									🖨️
								</span>
								<div>
									<div className='flex items-center gap-2'>
										<span className='px-1.5 py-0.5 bg-black text-white text-[9px] font-black uppercase rounded'>
											Dokumen Resmi
										</span>
										<span className='text-xs font-mono font-bold text-gray-700'>
											REG-KSW/{new Date(printItem.tanggal_bimbingan || Date.now()).getFullYear()}/{String(printItem.id).padStart(4, '0')}
										</span>
									</div>
									<h3 className='font-black text-sm text-black'>
										Pratinjau Lembar Laporan Bimbingan Santri
									</h3>
								</div>
							</div>

							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={handleExecutePrint}
									className='px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5'>
									<span>🖨️</span>
									<span>Cetak Dokumen (A4)</span>
								</button>

								<button
									type='button'
									onClick={() => {
										setShowPrintModal(false);
										setPrintItem(null);
									}}
									title='Tutup Pratinjau'
									className='w-8 h-8 rounded-xl border-2 border-black bg-white hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2.5'>
										<path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
									</svg>
								</button>
							</div>
						</div>

						{/* Area Kertas Preview Lembar A4 */}
						<div className='p-4 sm:p-6 overflow-y-auto bg-gray-100 [scrollbar-width:thin]'>
							<div className='bg-white border-2 border-black rounded-xl p-8 max-w-3xl mx-auto shadow-[4px_4px_0px_0px_#0D0D0D] text-black font-sans'>
								<LembarBimbinganDocumentContent
									printItem={printItem}
									schoolProfile={schoolProfile}
									allSiswa={allSiswa}
								/>
							</div>
						</div>

						{/* Modal Footer */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex items-center justify-between gap-3'>
							<button
								type='button'
								onClick={() => {
									setShowPrintModal(false);
									setPrintItem(null);
								}}
								className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5'>
								Tutup Pratinjau
							</button>

							<button
								type='button'
								onClick={handleExecutePrint}
								className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-yellow-300 hover:bg-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all'>
								<span>🖨️</span>
								<span>Cetak Lembar Laporan Bimbingan (A4)</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ======================================================================== */}
			{/* 2. DOKUMEN CETAK MURNI (HANYA AKTIF SAAT WINDOW.PRINT())                 */}
			{/* Bebas dari modal, backdrop, flexbox, fixed, maupun overflow              */}
			{/* ======================================================================== */}
			{showPrintModal && printItem && (
				<div id='print-clean-document' className='hidden print:block w-full text-black font-sans bg-white'>
					<LembarBimbinganDocumentContent
						printItem={printItem}
						schoolProfile={schoolProfile}
						allSiswa={allSiswa}
					/>
				</div>
			)}

			{/* CSS Khusus Print Dokumen Lembar Bimbingan Santri */}
			<style dangerouslySetInnerHTML={{
				__html: `
					@media print {
						@page {
							size: A4 portrait;
							margin: 10mm 15mm 10mm 15mm;
						}
						html, body {
							background: #ffffff !important;
							color: #000000 !important;
							margin: 0 !important;
							padding: 0 !important;
							width: 100% !important;
							height: auto !important;
							overflow: visible !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						.print\\:hidden,
						header,
						aside,
						nav {
							display: none !important;
						}
						#print-clean-document {
							display: block !important;
							position: static !important;
							width: 100% !important;
							max-width: 100% !important;
							margin: 0 !important;
							padding: 0 !important;
							background: #ffffff !important;
						}
					}
				`
			}} />
		</>
	);
}
