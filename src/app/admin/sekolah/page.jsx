'use client';

import { useState, useEffect, useRef } from 'react';
import Loader from '../../components/loading';
import Swal from 'sweetalert2';
import { useAdminAuth } from '../AdminLayoutClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
	KopSuratHtmlPreview,
} from '@/lib/pdfKopSurat';

export default function AdminSekolahPage() {
	const { role: authRole } = useAdminAuth();
	const [profil, setProfil] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [initialProfil, setInitialProfil] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [currentUserRole, setCurrentUserRole] = useState(authRole || null);
	const [infoPenggunaanOpen, setInfoPenggunaanOpen] = useState(false);

	const fileLogoKiriRef = useRef(null);
	const fileLogoKananRef = useRef(null);

	useEffect(() => {
		if (authRole) setCurrentUserRole(authRole);
	}, [authRole]);

	const isReadOnly = currentUserRole === 'Kepala Sekolah';

	// Load data profil dari API
	useEffect(() => {
		const fetchProfil = async () => {
			try {
				setLoading(true);
				const res = await fetch('/api/settings?key=profil_sekolah');
				if (res.ok) {
					const data = await res.json();
					if (data?.value && typeof data.value === 'object') {
						const merged = { ...DEFAULT_PROFIL_SEKOLAH, ...data.value };
						setProfil(merged);
						setInitialProfil(merged);
					}
				}
			} catch (err) {
				console.error('Error load profil sekolah:', err);
			} finally {
				setLoading(false);
			}
		};
		fetchProfil();
	}, []);

	// Handler kompresi & konversi logo ke Base64 Data URL
	const handleLogoUpload = (e, field) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validasi ukuran maks 2MB
		if (file.size > 2 * 1024 * 1024) {
			Swal.fire({
				title: 'Ukuran Terlalu Besar',
				text: 'Ukuran file logo maksimal adalah 2MB.',
				icon: 'warning',
				confirmButtonColor: '#6366F1',
			});
			e.target.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
				// Resize via Canvas agar base64 ringan (< 40KB) tapi sangat tajam untuk cetak PDF
				const canvas = document.createElement('canvas');
				const maxDim = 320;
				let w = img.width;
				let h = img.height;

				if (w > h) {
					if (w > maxDim) {
						h = Math.round((h * maxDim) / w);
						w = maxDim;
					}
				} else {
					if (h > maxDim) {
						w = Math.round((w * maxDim) / h);
						h = maxDim;
					}
				}

				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, w, h);

				const dataUrl = canvas.toDataURL('image/png', 0.92);
				setProfil((prev) => ({ ...prev, [field]: dataUrl }));
			};
			img.src = event.target.result;
		};
		reader.readAsDataURL(file);
	};

	// Hapus Logo
	const handleRemoveLogo = (field) => {
		setProfil((prev) => ({ ...prev, [field]: '' }));
		if (field === 'logo_kiri' && fileLogoKiriRef.current) {
			fileLogoKiriRef.current.value = '';
		}
		if (field === 'logo_kanan' && fileLogoKananRef.current) {
			fileLogoKananRef.current.value = '';
		}
	};

	// Reset Form ke Data Terakhir Tersimpan
	const handleReset = () => {
		Swal.fire({
			title: 'Reset Perubahan?',
			text: 'Form akan dikembalikan ke data profil yang terakhir kali tersimpan di database.',
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#6366F1',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Reset',
			cancelButtonText: 'Batal',
		}).then((res) => {
			if (res.isConfirmed) {
				setProfil(initialProfil);
				if (fileLogoKiriRef.current) fileLogoKiriRef.current.value = '';
				if (fileLogoKananRef.current) fileLogoKananRef.current.value = '';
			}
		});
	};

	// Simpan Profil Sekolah ke Supabase
	const handleSave = async (e) => {
		if (e) e.preventDefault();
		if (isReadOnly) return;

		if (!profil.nama_sekolah?.trim()) {
			Swal.fire('Validasi Gagal', 'Nama Resmi Sekolah wajib diisi.', 'warning');
			return;
		}

		try {
			setSaving(true);
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: 'profil_sekolah',
					value: profil,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan profil sekolah.');
			}

			// Simpan juga nama sekolah dan logo ke localStorage untuk sinkronisasi instan
			if (typeof window !== 'undefined') {
				localStorage.setItem('school_name', profil.nama_sekolah);
				if (profil.logo_kiri || profil.logo_kanan) {
					localStorage.setItem('school_logo', profil.logo_kiri || profil.logo_kanan);
				} else {
					localStorage.removeItem('school_logo');
				}
			}

			setInitialProfil(profil);

			Swal.fire({
				title: 'Berhasil Disimpan!',
				text: 'Profil sekolah berhasil diperbarui. Kop surat resmi akan langsung diterapkan pada semua laporan PDF.',
				icon: 'success',
				confirmButtonColor: '#6366F1',
			});
		} catch (err) {
			console.error('Error save profil:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSaving(false);
		}
	};

	// Cetak Lembar Kop Surat
	const handlePrint = () => {
		window.print();
	};

	// Export Contoh Sampel PDF dengan Kop Surat Baru
	const handleExportSamplePDF = () => {
		const doc = new jsPDF({ orientation: 'portrait' });
		const nextY = drawKopSuratPDF(doc, profil);

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.setTextColor(15, 23, 42);
		doc.text('DOKUMEN VERIFIKASI IDENTITAS & KOP SURAT SEKOLAH', 105, nextY + 4, { align: 'center' });

		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8.5);
		doc.setTextColor(71, 85, 105);
		doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, 105, nextY + 9, { align: 'center' });

		autoTable(doc, {
			startY: nextY + 14,
			head: [['No', 'Parameter Lembaga', 'Nilai Konfigurasi']],
			body: [
				['1', 'Nama Resmi Sekolah', profil.nama_sekolah || '-'],
				['2', 'NPSN', profil.npsn || '-'],
				['3', 'Kementerian / Lembaga Naungan', profil.kementerian || '-'],
				['4', 'Alamat Lengkap', profil.alamat || '-'],
				['5', 'Kontak Telepon', profil.telepon || '-'],
				['6', 'Email Resmi', profil.email || '-'],
				['7', 'Website Resmi', profil.website || '-'],
				['8', 'Status Logo Kiri', profil.logo_kiri ? 'Terpasang (Aktif)' : 'Belum Ada'],
				['9', 'Status Logo Kanan', profil.logo_kanan ? 'Terpasang (Aktif)' : 'Belum Ada'],
			],
			theme: 'grid',
			headStyles: { fillColor: [91, 77, 183] },
			styles: { fontSize: 8.5 },
		});

		doc.save(`Sampel_Kop_Surat_${(profil.nama_sekolah || 'Sekolah').replace(/\s+/g, '_')}.pdf`);
	};

	if (loading) return <Loader />;

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20'>
			{/* Top Page Header Title */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 rounded-xl bg-blue-500 border-2 border-black flex items-center justify-center text-xl text-white shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🏢
					</div>
					<div>
						<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
							Profil Sekolah
						</h1>
						<p className='text-xs sm:text-sm font-bold text-gray-600 mt-0.5'>
							Kelola identitas resmi lembaga dan logo untuk kop surat laporan PDF.
						</p>
					</div>
				</div>

				<div className='flex items-center gap-2.5 shrink-0'>
					<button
						type='button'
						onClick={handlePrint}
						className='px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>🖨️</span>
						<span>Cetak</span>
					</button>

					<button
						type='button'
						onClick={handleExportSamplePDF}
						className='px-3.5 py-2 bg-blue-500 hover:bg-blue-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📥</span>
						<span>Export</span>
					</button>
				</div>
			</div>

			{/* Top Information Banner (Purple Card) */}
			<div className='bg-[#5B4DB7] text-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-2'>
				<div className='flex items-center gap-2 text-white font-black text-sm uppercase tracking-wide'>
					<span className='w-5 h-5 rounded-full bg-white text-[#5B4DB7] flex items-center justify-center text-xs font-black'>
						i
					</span>
					<span>Informasi Penting</span>
				</div>
				<ul className='space-y-1 text-xs font-medium text-white/95 pl-6 list-disc'>
					<li>Profil sekolah akan tampil di header semua laporan PDF</li>
					<li>Pastikan logo memiliki rasio 1:1 untuk tampilan optimal</li>
					<li>Data NPSN dan alamat harus sesuai dengan data resmi</li>
					<li>Perubahan akan berlaku untuk semua laporan baru</li>
				</ul>
			</div>

			{/* Read-Only Notice for Kepsek */}
			{isReadOnly && (
				<div className='bg-indigo-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<span className='text-2xl'>🎓</span>
						<div>
							<p className='text-sm font-black text-indigo-950 uppercase'>Mode Monitoring Kepala Sekolah</p>
							<p className='text-xs text-indigo-900 font-medium'>Data profil sekolah ditampilkan dalam mode baca (Read Only).</p>
						</div>
					</div>
					<span className='px-3 py-1 bg-white border border-black rounded-lg text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						Read Only
					</span>
				</div>
			)}

			{/* Main Grid: Form Left (7 Cols) & Widgets Right (5 Cols) */}
			<div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
				{/* ============================================================== */}
				{/* LEFT COLUMN: EDIT PROFIL FORM                                  */}
				{/* ============================================================== */}
				<div className='lg:col-span-7 space-y-6'>
					<div className='bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-5'>
						<div className='flex items-center gap-2 pb-3 border-b-2 border-black/10'>
							<span className='text-base'>✏️</span>
							<h2 className='text-base font-black text-black uppercase tracking-tight'>
								Edit Profil Sekolah
							</h2>
						</div>

						<form onSubmit={handleSave} className='space-y-4'>
							{/* Row: Nama Sekolah & NPSN */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Nama Sekolah <span className='text-rose-600'>*</span>
									</label>
									<input
										type='text'
										required
										disabled={isReadOnly}
										value={profil.nama_sekolah || ''}
										onChange={(e) => setProfil({ ...profil, nama_sekolah: e.target.value })}
										placeholder='SMP IT TEBUIRENG 4 AL-ISHLAH'
										className='neo-input !py-2 text-xs font-bold'
									/>
									<p className='text-[10px] text-gray-500 mt-1 font-medium'>
										Nama lengkap sekolah sesuai akta pendirian
									</p>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										NPSN
									</label>
									<input
										type='text'
										disabled={isReadOnly}
										value={profil.npsn || ''}
										onChange={(e) => setProfil({ ...profil, npsn: e.target.value })}
										placeholder='69953165'
										className='neo-input !py-2 text-xs font-mono font-bold'
									/>
									<p className='text-[10px] text-gray-500 mt-1 font-medium'>
										8 digit kode NPSN sekolah
									</p>
								</div>
							</div>

							{/* Kementrian / Lembaga */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Kementrian/Lembaga
								</label>
								<input
									type='text'
									disabled={isReadOnly}
									value={profil.kementerian || ''}
									onChange={(e) => setProfil({ ...profil, kementerian: e.target.value })}
									placeholder='YAYASAN AL-ISHLAH KUALA GADING'
									className='neo-input !py-2 text-xs font-bold'
								/>
								<p className='text-[10px] text-gray-500 mt-1 font-medium'>
									Nama kementrian/lembaga yang menaungi
								</p>
							</div>

							{/* Alamat Lengkap */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Alamat Lengkap
								</label>
								<textarea
									rows={3}
									disabled={isReadOnly}
									value={profil.alamat || ''}
									onChange={(e) => setProfil({ ...profil, alamat: e.target.value })}
									placeholder='Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355'
									className='neo-input !py-2 text-xs font-medium resize-none'
								/>
								<p className='text-[10px] text-gray-500 mt-1 font-medium'>
									Alamat lengkap termasuk kode pos
								</p>
							</div>

							{/* Telepon & Email */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Telepon
									</label>
									<div className='relative'>
										<span className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-xs'>
											📞
										</span>
										<input
											type='text'
											disabled={isReadOnly}
											value={profil.telepon || ''}
											onChange={(e) => setProfil({ ...profil, telepon: e.target.value })}
											placeholder='082131028161'
											className='neo-input !py-2 !pl-8 text-xs font-mono font-bold'
										/>
									</div>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Email
									</label>
									<div className='relative'>
										<span className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-xs'>
											✉️
										</span>
										<input
											type='email'
											disabled={isReadOnly}
											value={profil.email || ''}
											onChange={(e) => setProfil({ ...profil, email: e.target.value })}
											placeholder='tebuireng4_alishlah@yahoo.com'
											className='neo-input !py-2 !pl-8 text-xs font-medium'
										/>
									</div>
								</div>
							</div>

							{/* Website */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Website
								</label>
								<div className='relative'>
									<span className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-xs'>
										🌐
									</span>
									<input
										type='text'
										disabled={isReadOnly}
										value={profil.website || ''}
										onChange={(e) => setProfil({ ...profil, website: e.target.value })}
										placeholder='www.tebuireng4.com'
										className='neo-input !py-2 !pl-8 text-xs font-medium'
									/>
								</div>
								<p className='text-[10px] text-gray-500 mt-1 font-medium'>
									URL lengkap website sekolah (jika ada)
								</p>
							</div>

							{/* Upload Logo Sekolah (Logo Kiri) */}
							<div className='pt-2 border-t border-black/10 space-y-1.5'>
								<label className='block text-xs font-black uppercase text-black'>
									Logo Sekolah (Logo Kiri)
								</label>
								<input
									ref={fileLogoKiriRef}
									type='file'
									accept='image/*'
									disabled={isReadOnly}
									onChange={(e) => handleLogoUpload(e, 'logo_kiri')}
									className='block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:uppercase file:bg-gray-100 file:text-black hover:file:bg-yellow-200 cursor-pointer border border-gray-300 rounded-xl p-1 bg-white'
								/>
								<p className='text-[10px] text-gray-500 font-medium'>
									Format: JPG, PNG, GIF. Ukuran maksimal: 2MB. Rasio 1:1 untuk hasil terbaik
								</p>

								{profil.logo_kiri && !isReadOnly && (
									<label className='inline-flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-800 cursor-pointer pt-1'>
										<input
											type='checkbox'
											onChange={() => handleRemoveLogo('logo_kiri')}
											className='rounded border-black text-rose-600 focus:ring-rose-500'
										/>
										<span>🗑️ Hapus logo kiri saat ini</span>
									</label>
								)}
							</div>

							{/* Upload Logo Kanan */}
							<div className='pt-2 border-t border-black/10 space-y-1.5'>
								<label className='block text-xs font-black uppercase text-black'>
									Logo Kanan
								</label>
								<input
									ref={fileLogoKananRef}
									type='file'
									accept='image/*'
									disabled={isReadOnly}
									onChange={(e) => handleLogoUpload(e, 'logo_kanan')}
									className='block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-2 file:border-black file:text-xs file:font-black file:uppercase file:bg-gray-100 file:text-black hover:file:bg-yellow-200 cursor-pointer border border-gray-300 rounded-xl p-1 bg-white'
								/>
								<p className='text-[10px] text-gray-500 font-medium'>
									Format: JPG, PNG, GIF. Ukuran maksimal: 2MB. Logo tambahan di pojok kanan header laporan.
								</p>

								{profil.logo_kanan && !isReadOnly && (
									<label className='inline-flex items-center gap-1.5 text-xs font-black text-rose-600 hover:text-rose-800 cursor-pointer pt-1'>
										<input
											type='checkbox'
											onChange={() => handleRemoveLogo('logo_kanan')}
											className='rounded border-black text-rose-600 focus:ring-rose-500'
										/>
										<span>🗑️ Hapus logo kanan saat ini</span>
									</label>
								)}
							</div>

							{/* Action Buttons */}
							{!isReadOnly && (
								<div className='flex items-center justify-between pt-4 border-t-2 border-black/10'>
									<button
										type='button'
										onClick={handleReset}
										disabled={saving}
										className='px-4 py-2.5 bg-white hover:bg-gray-100 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
										<span>🔄</span>
										<span>Reset</span>
									</button>

									<button
										type='submit'
										disabled={saving}
										className='px-6 py-2.5 bg-[#5B4DB7] hover:bg-[#4d3fa5] text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-50'>
										<span>💾</span>
										<span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
									</button>
								</div>
							)}
						</form>
					</div>

					{/* Collapsible: Informasi Penggunaan */}
					<div className='bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] overflow-hidden'>
						<button
							type='button'
							onClick={() => setInfoPenggunaanOpen(!infoPenggunaanOpen)}
							className='w-full px-5 py-3.5 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left text-xs font-black uppercase text-black'>
							<span className='flex items-center gap-2'>
								<span>ℹ️</span>
								<span>Informasi Penggunaan & Sinkronisasi Laporan</span>
							</span>
							<span className='font-mono text-sm'>{infoPenggunaanOpen ? '▲' : '▼'}</span>
						</button>

						{infoPenggunaanOpen && (
							<div className='p-5 border-t-2 border-black text-xs font-medium text-gray-700 space-y-2 bg-white'>
								<p>
									<strong>1. Penempatan Kop Surat:</strong> Semua ekspor PDF (Absensi Siswa, Rekapitulasi Nilai, Rekap Karakter/Poin, dan Jurnal Mengajar) akan secara otomatis merender logo kiri, nama sekolah, NPSN, alamat, kontak, dan logo kanan di bagian paling atas dokumen.
								</p>
								<p>
									<strong>2. Penyimpanan Logo:</strong> Logo dikonversi ke format Web Base64 beresolusi tinggi dan disimpan langsung di database pengaturan aplikasi, sehingga dapat dimuat seketika tanpa masalah CORS atau kendala jaringan saat mencetak.
								</p>
								<p>
									<strong>3. Format Rekomendasi:</strong> Gunakan logo berlatar belakang transparan (PNG) dengan rasio aspek persegi 1:1 untuk tampilan yang tajam dan proporsional di dokumen cetak A4.
								</p>
							</div>
						)}
					</div>
				</div>

				{/* ============================================================== */}
				{/* RIGHT COLUMN: PREVIEW LOGO & PREVIEW KOP SURAT                 */}
				{/* ============================================================== */}
				<div className='lg:col-span-5 space-y-6'>
					{/* Logo Kiri Card */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='flex items-center gap-2'>
							<span>🖼️</span>
							<h3 className='text-xs font-black uppercase text-black'>Logo Kiri</h3>
						</div>

						<div className='w-full h-40 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center p-3'>
							{profil.logo_kiri ? (
								<img
									src={profil.logo_kiri}
									alt='Preview Logo Kiri'
									className='max-w-full max-h-full object-contain'
								/>
							) : (
								<div className='text-center space-y-1 text-gray-400'>
									<span className='text-2xl block'>🏫</span>
									<span className='text-xs font-bold'>Belum ada logo kiri</span>
								</div>
							)}
						</div>

						<div className='flex items-center justify-center gap-1.5 text-xs font-black pt-1'>
							{profil.logo_kiri ? (
								<span className='text-emerald-700 flex items-center gap-1'>
									<span>✅</span> Logo kiri terpasang
								</span>
							) : (
								<span className='text-gray-500'>⚠️ Logo kiri belum diunggah</span>
							)}
						</div>
					</div>

					{/* Logo Kanan Card */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='flex items-center gap-2'>
							<span>🖼️</span>
							<h3 className='text-xs font-black uppercase text-black'>Logo Kanan</h3>
						</div>

						<div className='w-full h-40 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center p-3'>
							{profil.logo_kanan ? (
								<img
									src={profil.logo_kanan}
									alt='Preview Logo Kanan'
									className='max-w-full max-h-full object-contain'
								/>
							) : (
								<div className='text-center space-y-1 text-gray-400'>
									<span className='text-2xl block'>🏛️</span>
									<span className='text-xs font-bold'>Belum ada logo kanan</span>
								</div>
							)}
						</div>

						<div className='flex items-center justify-center gap-1.5 text-xs font-black pt-1'>
							{profil.logo_kanan ? (
								<span className='text-emerald-700 flex items-center gap-1'>
									<span>✅</span> Logo kanan terpasang
								</span>
							) : (
								<span className='text-gray-500'>⚠️ Logo kanan belum diunggah</span>
							)}
						</div>
					</div>

					{/* Preview Header Laporan (Kop Surat) */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='flex items-center gap-2'>
							<span>📄</span>
							<h3 className='text-xs font-black uppercase text-black'>Preview Header Laporan</h3>
						</div>

						{/* Live Kop Surat HTML Preview */}
						<KopSuratHtmlPreview profil={profil} />

						<p className='text-[11px] font-bold text-gray-600 flex items-center gap-1.5 pt-1'>
							<span>ℹ️</span>
							<span>Inilah tampilan header pada laporan PDF (Logo Kiri & Logo Kanan)</span>
						</p>
					</div>

					{/* Informasi Sistem Card (Purple) */}
					<div className='bg-[#5B4DB7] text-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-2'>
						<div className='flex items-center gap-2 font-black text-xs uppercase tracking-wider text-white'>
							<span>⚙️</span>
							<span>Informasi Sistem</span>
						</div>
						<ul className='space-y-1 text-[11px] font-medium text-white/95 pl-5 list-disc'>
							<li>Data profil digunakan untuk identifikasi resmi</li>
							<li>Logo otomatis di-resize ke 60x60px di laporan</li>
							<li>Semua data wajib diisi untuk laporan yang valid</li>
							<li>Pastikan alamat email aktif untuk notifikasi</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
