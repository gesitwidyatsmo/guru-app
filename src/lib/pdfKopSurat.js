/**
 * Shared Helper untuk Profil Sekolah & Kop Surat Resmi
 * Digunakan untuk:
 * 1. Menampilkan preview Kop Surat resmi di halaman Profil Sekolah.
 * 2. Menggambar Kop Surat resmi (Logo Kiri, Logo Kanan, Nama Sekolah, Alamat, Kontak, Garis Ganda)
 *    secara otomatis di dokumen PDF (jsPDF) untuk semua laporan.
 */

import { DEFAULT_LOGO_KIRI, DEFAULT_LOGO_KANAN } from './defaultLogos';

export const DEFAULT_PROFIL_SEKOLAH = {
	nama_sekolah: 'SMP IT TEBUIRENG 4 AL-ISHLAH',
	npsn: '69953165',
	kementerian: 'YAYASAN AL-ISHLAH KUALA GADING',
	alamat: 'Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355',
	telepon: '082131028161',
	email: 'tebuireng4_alishlah@yahoo.com',
	website: 'www.tebuireng4.com',
	logo_kiri: DEFAULT_LOGO_KIRI,
	logo_kanan: DEFAULT_LOGO_KANAN,
	nama_kepsek: '',
	nip_kepsek: '',
	jenjang: 'SMP',
	status: 'Swasta',
	akreditasi: 'A (Unggul)',
	motto: 'Mencerdaskan Generasi Berakhlak Mulia & Berprestasi Global',
};

/**
 * Mengambil data profil sekolah dari API settings
 * @returns {Promise<typeof DEFAULT_PROFIL_SEKOLAH>}
 */
export async function fetchSchoolProfile() {
	try {
		const res = await fetch('/api/settings?key=profil_sekolah');
		if (res.ok) {
			const data = await res.json();
			if (data?.value && typeof data.value === 'object') {
				return { ...DEFAULT_PROFIL_SEKOLAH, ...data.value };
			}
		}
	} catch (err) {
		console.warn('Gagal memuat profil sekolah dari API, menggunakan default:', err);
	}
	return DEFAULT_PROFIL_SEKOLAH;
}

/**
 * Menggambar Kop Surat Resmi pada dokumen jsPDF.
 *
 * @param {import('jspdf').jsPDF} doc - Dokumen jsPDF
 * @param {typeof DEFAULT_PROFIL_SEKOLAH} profil - Data profil sekolah
 * @param {Object} [options] - Opsi kustomisasi
 * @param {number} [options.startY=10] - Posisi awal vertikal dalam mm
 * @param {number} [options.margin=14] - Margin horizontal dalam mm
 * @returns {number} endY - Posisi Y di bawah garis ganda kop surat untuk meletakkan judul atau tabel
 */
export function drawKopSuratPDF(doc, profil = {}, options = {}) {
	const p = { ...DEFAULT_PROFIL_SEKOLAH, ...profil };
	const pageWidth = doc.internal.pageSize.getWidth();
	const startY = options.startY || 10;
	const margin = options.margin || 14;
	const centerX = pageWidth / 2;

	let currentY = startY;
	const logoSize = 22; // mm

	const logoKiri = p.logo_kiri || DEFAULT_LOGO_KIRI;
	const logoKanan = p.logo_kanan || DEFAULT_LOGO_KANAN;

	// 1. Gambar Logo Kiri (jika ada)
	if (logoKiri && typeof logoKiri === 'string' && logoKiri.startsWith('data:image')) {
		try {
			const format = logoKiri.includes('image/jpeg') || logoKiri.includes('image/jpg') ? 'JPEG' : 'PNG';
			doc.addImage(logoKiri, format, margin, startY, logoSize, logoSize);
		} catch (err) {
			console.warn('Gagal merender logo kiri pada PDF:', err);
		}
	}

	// 2. Gambar Logo Kanan (jika ada)
	if (logoKanan && typeof logoKanan === 'string' && logoKanan.startsWith('data:image')) {
		try {
			const format = logoKanan.includes('image/jpeg') || logoKanan.includes('image/jpg') ? 'JPEG' : 'PNG';
			doc.addImage(logoKanan, format, pageWidth - margin - logoSize, startY, logoSize, logoSize);
		} catch (err) {
			console.warn('Gagal merender logo kanan pada PDF:', err);
		}
	}

	// 3. Teks Kop Surat di Tengah
	// Lembaga / Yayasan / Kementerian
	if (p.kementerian) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(9.5);
		doc.setTextColor(30, 41, 59); // slate-800
		doc.text(String(p.kementerian).toUpperCase(), centerX, currentY + 4, { align: 'center' });
		currentY += 4.5;
	}

	// Nama Sekolah (Headline Tebal)
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(13);
	doc.setTextColor(15, 23, 42); // slate-900
	doc.text(String(p.nama_sekolah || 'SEKOLAH').toUpperCase(), centerX, currentY + 4.5, { align: 'center' });
	currentY += 5;

	// Baris NPSN
	if (p.npsn) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.setTextColor(71, 85, 105); // slate-600
		doc.text(`NPSN: ${p.npsn}`, centerX, currentY + 4, { align: 'center' });
		currentY += 4;
	}

	// Baris Alamat Lengkap
	if (p.alamat) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7.5);
		doc.setTextColor(71, 85, 105);
		doc.text(String(p.alamat), centerX, currentY + 3.5, { align: 'center' });
		currentY += 3.8;
	}

	// Baris Kontak (Telp, Email, Website)
	const contactItems = [];
	if (p.telepon) contactItems.push(`Telp: ${p.telepon}`);
	if (p.email) contactItems.push(`Email: ${p.email}`);
	if (p.website) contactItems.push(`Website: ${p.website}`);

	if (contactItems.length > 0) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(7.5);
		doc.setTextColor(71, 85, 105);
		doc.text(contactItems.join('  •  '), centerX, currentY + 3.5, { align: 'center' });
		currentY += 4;
	}

	// Pastikan posisi garis di bawah logo atau di bawah teks
	const lineY = Math.max(currentY + 2, startY + logoSize + 1);

	// 4. Garis Pembatas Ganda Kop Surat Resmi
	// Garis Tebal (Atas)
	doc.setDrawColor(15, 23, 42); // hitam pekat
	doc.setLineWidth(0.65);
	doc.line(margin, lineY, pageWidth - margin, lineY);

	// Garis Tipis (Bawah)
	doc.setLineWidth(0.2);
	doc.line(margin, lineY + 0.8, pageWidth - margin, lineY + 0.8);

	// Kembalikan koordinat Y berikutnya dengan jarak yang rapi
	return lineY + 5;
}

/**
 * Komponen HTML Preview Kop Surat Resmi (untuk halaman Profil Sekolah dan Print Dokumen)
 */
export function KopSuratHtmlPreview({ profil = {}, className = '' }) {
	const p = { ...DEFAULT_PROFIL_SEKOLAH, ...profil };
	const logoKiri = p.logo_kiri || DEFAULT_LOGO_KIRI;
	const logoKanan = p.logo_kanan || DEFAULT_LOGO_KANAN;

	return (
		<div className={`p-4 bg-white border border-gray-300 rounded-xl font-sans text-black ${className}`}>
			<div className='flex items-center justify-between gap-3'>
				{/* Logo Kiri */}
				<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
					{logoKiri ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img
							src={logoKiri}
							alt='Logo Kiri'
							className='max-w-full max-h-full object-contain'
						/>
					) : (
						<div className='w-14 h-14 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400'>
							Logo Kiri
						</div>
					)}
				</div>

				{/* Teks Kop Surat Tengah */}
				<div className='flex-1 text-center px-2'>
					{p.kementerian && (
						<p className='text-[10px] sm:text-xs font-black uppercase text-gray-700 tracking-wider leading-tight'>
							{p.kementerian}
						</p>
					)}
					<h2 className='text-sm sm:text-base font-black uppercase tracking-tight text-black leading-tight mt-0.5'>
						{p.nama_sekolah || 'NAMA SEKOLAH'}
					</h2>
					{p.npsn && (
						<p className='text-[10px] font-bold text-gray-600 mt-0.5 font-mono'>
							NPSN: {p.npsn}
						</p>
					)}
					{p.alamat && (
						<p className='text-[9px] sm:text-[10px] text-gray-600 mt-0.5 leading-tight'>
							{p.alamat}
						</p>
					)}
					<div className='flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[8.5px] sm:text-[9.5px] text-gray-500 mt-0.5'>
						{p.telepon && <span>Telp: {p.telepon}</span>}
						{p.telepon && p.email && <span>&bull;</span>}
						{p.email && <span>Email: {p.email}</span>}
						{p.website && (p.telepon || p.email) && <span>&bull;</span>}
						{p.website && <span>Website: {p.website}</span>}
					</div>
				</div>

				{/* Logo Kanan */}
				<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
					{logoKanan ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img
							src={logoKanan}
							alt='Logo Kanan'
							className='max-w-full max-h-full object-contain'
						/>
					) : (
						<div className='w-14 h-14 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400'>
							Logo Kanan
						</div>
					)}
				</div>
			</div>

			{/* Garis Ganda Kop Surat */}
			<div className='mt-2.5 space-y-0.5'>
				<div className='border-b-2 border-black'></div>
				<div className='border-b border-black/60'></div>
			</div>
		</div>
	);
}

/**
 * Menggambar Blok Tanda Tangan Kepala Sekolah pada dokumen jsPDF secara dinamis.
 * Menggunakan data akun Kepala Sekolah asli dari database (nama & NIP).
 *
 * @param {import('jspdf').jsPDF} doc - Dokumen jsPDF
 * @param {typeof DEFAULT_PROFIL_SEKOLAH} [profil] - Profil sekolah
 * @param {Object} [options] - Opsi kustomisasi
 * @param {number} [options.startY] - Posisi Y awal tanda tangan (default: setelah tabel)
 * @param {number} [options.x] - Posisi horizontal X (default: kanan)
 * @param {string} [options.title] - Kalimat pembuka tanda tangan
 */
export function drawKepsekSignaturePDF(doc, profil = {}, options = {}) {
	const p = { ...DEFAULT_PROFIL_SEKOLAH, ...profil };
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const startY = options.startY || (doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : 200);
	const title = options.title || 'Mengetahui & Menyetujui,\nKepala Sekolah';
	const x = options.x !== undefined ? options.x : pageWidth - 70;

	if (startY + 28 <= pageHeight) {
		doc.setFontSize(8);
		doc.setFont('helvetica', 'normal');
		const kepsekName = p.nama_kepsek || 'Kepala Sekolah';
		const kepsekNip = p.nip_kepsek ? `\nNIP. ${p.nip_kepsek}` : '';
		doc.text(
			`${title}\n\n\n\n${kepsekName}${kepsekNip}`,
			x,
			startY
		);
	}
}

