/**
 * Helper untuk Mengenerate Piagam Penghargaan (Certificate of Achievement) Resmi
 * Format: A4 Landscape (297mm x 210mm)
 * Menggunakan jsPDF dengan dekorasi border ornamen emas, kop sekolah, dan tanda tangan resmi.
 */

import { jsPDF } from 'jspdf';
import { DEFAULT_LOGO_KIRI, DEFAULT_LOGO_KANAN } from './defaultLogos';
import { DEFAULT_PROFIL_SEKOLAH } from './pdfKopSurat';

/**
 * Menggambar ornamen border sertifikat elegan
 */
function drawCertificateBorder(doc, width, height) {
	// 1. Background tint sangat lembut
	doc.setFillColor(255, 253, 245);
	doc.rect(0, 0, width, height, 'F');

	// 2. Garis luar tebal emas / dark amber (#B45309 / #D97706)
	doc.setDrawColor(180, 83, 9);
	doc.setLineWidth(3);
	doc.rect(8, 8, width - 16, height - 16);

	// 3. Garis kedua tipis emas (#F59E0B)
	doc.setDrawColor(245, 158, 11);
	doc.setLineWidth(0.8);
	doc.rect(11, 11, width - 22, height - 22);

	// 4. Garis ketiga putus-putus ornamen tipis (#D97706)
	doc.setDrawColor(217, 119, 6);
	doc.setLineWidth(0.3);
	doc.rect(13, 13, width - 26, height - 26);

	// 5. Sudut ornamen siku empat penjuru (Corner Ornaments)
	const corners = [
		{ x: 15, y: 15, dx: 1, dy: 1 },
		{ x: width - 15, y: 15, dx: -1, dy: 1 },
		{ x: 15, y: height - 15, dx: 1, dy: -1 },
		{ x: width - 15, y: height - 15, dx: -1, dy: -1 },
	];

	doc.setDrawColor(180, 83, 9);
	doc.setLineWidth(1.2);
	corners.forEach((c) => {
		// Siku luar
		doc.line(c.x, c.y, c.x + c.dx * 12, c.y);
		doc.line(c.x, c.y, c.x, c.y + c.dy * 12);
		// Titik aksen
		doc.setFillColor(180, 83, 9);
		doc.circle(c.x + c.dx * 3, c.y + c.dy * 3, 1, 'F');
	});
}

/**
 * Menggambar Kop Surat & Judul Piagam
 */
function drawHeader(doc, school, width) {
	const centerX = width / 2;
	const logoSize = 18; // mm

	const logoKiri = school.logo_kiri || DEFAULT_LOGO_KIRI;
	const logoKanan = school.logo_kanan || DEFAULT_LOGO_KANAN;

	// Render Logo Kiri
	if (logoKiri && typeof logoKiri === 'string' && logoKiri.startsWith('data:image')) {
		try {
			const fmt = logoKiri.includes('image/jpeg') || logoKiri.includes('image/jpg') ? 'JPEG' : 'PNG';
			doc.addImage(logoKiri, fmt, 22, 17, logoSize, logoSize);
		} catch (err) {
			console.warn('Gagal merender logo kiri piagam:', err);
		}
	}

	// Render Logo Kanan
	if (logoKanan && typeof logoKanan === 'string' && logoKanan.startsWith('data:image')) {
		try {
			const fmt = logoKanan.includes('image/jpeg') || logoKanan.includes('image/jpg') ? 'JPEG' : 'PNG';
			doc.addImage(logoKanan, fmt, width - 22 - logoSize, 17, logoSize, logoSize);
		} catch (err) {
			console.warn('Gagal merender logo kanan piagam:', err);
		}
	}

	// Nama Yayasan & Sekolah
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	doc.setTextColor(100, 116, 139); // slate-500
	doc.text(String(school.kementerian || 'YAYASAN AL-ISHLAH KUALA GADING').toUpperCase(), centerX, 22, { align: 'center' });

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(15);
	doc.setTextColor(15, 23, 42); // slate-900
	doc.text(String(school.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH').toUpperCase(), centerX, 28, { align: 'center' });

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);
	doc.setTextColor(71, 85, 105);
	const subText = `${school.alamat || 'Jl. Perintis Desa Kuala Gading, Batang Cenaku, Inhu, Riau'} • NPSN: ${school.npsn || '69953165'} • Akreditasi: ${school.akreditasi || 'A'}`;
	doc.text(subText, centerX, 33, { align: 'center' });

	// Garis pemisah ornamen emas ganda
	doc.setDrawColor(217, 119, 6);
	doc.setLineWidth(0.8);
	doc.line(30, 36.5, width - 30, 36.5);
	doc.setLineWidth(0.3);
	doc.line(45, 37.7, width - 45, 37.7);
}

/**
 * Menggambar sebuah Piagam pada dokumen jsPDF yang sedang aktif
 */
export function drawSinglePiagam(doc, data = {}) {
	const width = doc.internal.pageSize.getWidth();
	const height = doc.internal.pageSize.getHeight();
	const centerX = width / 2;

	const school = { ...DEFAULT_PROFIL_SEKOLAH, ...(data.schoolProfile || {}) };
	const siswa = data.siswa || {};
	const juaraLabel = String(data.juaraLabel || 'JUARA KELAS').toUpperCase();
	const kategoriLabel = data.kategori || 'Hasil Belajar Akademik (E-Rapor)';
	const kelas = data.kelas || siswa.kelas || '-';
	const tahunAjar = data.tahunAjaran || '2026/2027';
	const semester = data.semester || '1';
	const nomorPiagam = data.nomorPiagam || `421.3/SMPI-TB4/PP-RAPOR/${semester}/${tahunAjar.replace('/', '-')}`;
	const tanggalPiagam = data.tanggalPiagam || school.tanggal_rapor_ganjil || '20 Desember 2026';
	const tempatPiagam = school.tempat_rapor || 'Kuala Gading';
	const namaKepsek = school.nama_kepsek || 'Mujib Kodar, S.Pd.I';
	const nipKepsek = school.nip_kepsek && school.nip_kepsek !== '-' ? `NIP. ${school.nip_kepsek}` : 'NIY. 20160701001';
	const waliKelasName = data.waliKelasName || siswa.wali_kelas || '';
	const waliKelasNip = data.waliKelasNip || '';

	// 1. Gambar Bingkai / Frame
	drawCertificateBorder(doc, width, height);

	// 2. Gambar Kop Surat
	drawHeader(doc, school, width);

	// 3. Judul Sertifikat / Ribbon
	doc.setFont('times', 'bold');
	doc.setFontSize(26);
	doc.setTextColor(180, 83, 9); // dark amber
	doc.text('PIAGAM PENGHARGAAN', centerX, 52, { align: 'center' });

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.setTextColor(100, 116, 139);
	doc.text(`Nomor: ${nomorPiagam}`, centerX, 58, { align: 'center' });

	// 4. Kata Pengantar
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10.5);
	doc.setTextColor(51, 65, 85);
	doc.text('Diberikan dengan penuh rasa bangga dan apresiasi kepada:', centerX, 68, { align: 'center' });

	// 5. NAMA SISWA (Bintang Utama)
	doc.setFont('times', 'bold');
	doc.setFontSize(22);
	doc.setTextColor(15, 23, 42); // slate-900
	const namaSiswaUpper = String(siswa.nama_lengkap || 'NAMA SISWA').toUpperCase();
	doc.text(namaSiswaUpper, centerX, 80, { align: 'center' });

	// Garis ornamen bawah nama
	const namaWidth = Math.min(width - 80, Math.max(80, doc.getTextWidth(namaSiswaUpper) + 16));
	doc.setDrawColor(217, 119, 6);
	doc.setLineWidth(0.6);
	doc.line(centerX - namaWidth / 2, 83, centerX + namaWidth / 2, 83);

	// Identitas NIS & Kelas
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9.5);
	doc.setTextColor(71, 85, 105);
	const idSiswa = `NIS: ${siswa.nis || '-'}  •  NISN: ${siswa.nisn || '-'}  •  Rombel: ${kelas}`;
	doc.text(idSiswa, centerX, 89, { align: 'center' });

	// 6. Predikat Juara / Prestasi
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(51, 65, 85);
	doc.text('Sebagai:', centerX, 99, { align: 'center' });

	// Badge Box / Highlight Juara
	doc.setFillColor(254, 243, 199); // amber-100
	doc.setDrawColor(180, 83, 9);
	doc.setLineWidth(1);
	doc.roundedRect(centerX - 85, 103, 170, 14, 3, 3, 'FD');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(13);
	doc.setTextColor(146, 64, 14); // amber-900
	doc.text(`★  ${juaraLabel}  ★`, centerX, 112, { align: 'center' });

	// 7. Deskripsi Pencapaian
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9.5);
	doc.setTextColor(51, 65, 85);
	const baris1 = `Atas dedikasi, kedisiplinan, dan prestasi gemilang dalam ${kategoriLabel}`;
	const baris2 = `Semester ${semester} Tahun Ajaran ${tahunAjar}`;
	doc.text(baris1, centerX, 126, { align: 'center' });
	doc.text(baris2, centerX, 131.5, { align: 'center' });

	// Rata-rata dan Total Nilai (jika tersedia)
	if (data.rataRata !== undefined && data.rataRata !== null) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(9);
		doc.setTextColor(15, 23, 42);
		const statStr = `Nilai Rata-Rata: ${data.rataRata} ${data.totalNilai ? `(Total Nilai: ${data.totalNilai})` : ''}`;
		doc.text(statStr, centerX, 137.5, { align: 'center' });
	}

	// Harapan dan Doa
	doc.setFont('times', 'italic');
	doc.setFontSize(9);
	doc.setTextColor(100, 116, 139);
	doc.text('Semoga prestasi yang diraih menjadi inspirasi, keberkahan ilmu, dan pemacu semangat belajar berkelanjutan.', centerX, 146, { align: 'center' });

	// 8. Tanda Tangan & Titimangsa
	const dateLine = `${tempatPiagam}, ${tanggalPiagam}`;
	const signY = 160;

	// Sisi Kiri: Wali Kelas (jika piagam kelas) atau Waka Kurikulum (jika piagam umum)
	const isPiagamUmum = juaraLabel.includes('UMUM');
	const leftTitle = isPiagamUmum ? 'Waka Kurikulum,' : 'Wali Kelas,';
	const leftName = isPiagamUmum ? (data.wakaKurikulumName || 'Waka Kurikulum') : (waliKelasName || 'Guru Wali Kelas');
	const leftId = isPiagamUmum ? '' : (waliKelasNip ? `NIP. ${waliKelasNip}` : '');

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(15, 23, 42);
	doc.text('Mengetahui,', 55, signY, { align: 'center' });
	doc.text(leftTitle, 55, signY + 4.5, { align: 'center' });

	doc.setFont('helvetica', 'bold');
	doc.text(leftName, 55, signY + 28, { align: 'center' });
	if (leftId) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.text(leftId, 55, signY + 32, { align: 'center' });
	}

	// Sisi Kanan: Kepala Sekolah
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(15, 23, 42);
	doc.text(dateLine, width - 55, signY, { align: 'center' });
	doc.text('Kepala Sekolah,', width - 55, signY + 4.5, { align: 'center' });

	doc.setFont('helvetica', 'bold');
	doc.text(namaKepsek, width - 55, signY + 28, { align: 'center' });
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.text(nipKepsek, width - 55, signY + 32, { align: 'center' });
}

/**
 * Generate PDF untuk satu siswa (Single Piagam)
 */
export function generateSinglePiagamPDF(data) {
	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
	});

	drawSinglePiagam(doc, data);

	const safeName = (data.siswa?.nama_lengkap || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
	const safeLabel = (data.juaraLabel || 'Piagam').replace(/[^a-zA-Z0-9]/g, '_');
	doc.save(`Piagam_${safeLabel}_${safeName}.pdf`);
}

/**
 * Generate PDF multi-halaman untuk banyak siswa sekaligus (Batch Piagam)
 */
export function generateBatchPiagamPDF(items = [], commonData = {}) {
	if (!items || items.length === 0) return;

	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
	});

	items.forEach((item, index) => {
		if (index > 0) {
			doc.addPage('a4', 'landscape');
		}
		drawSinglePiagam(doc, {
			...commonData,
			...item,
			schoolProfile: item.schoolProfile || commonData.schoolProfile,
		});
	});

	const titlePrefix = commonData.batchTitle || 'Koleksi_Piagam_Penghargaan';
	doc.save(`${titlePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
