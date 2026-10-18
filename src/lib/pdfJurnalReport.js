import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawKopSuratPDF, drawKepsekSignaturePDF } from '@/lib/pdfKopSurat';
import { getTodayDateString } from '@/lib/dateUtils';

/**
 * Menghitung Jam Pelajaran (JP) dari string jam_ke
 * Contoh: "1-2" => 2 JP, "3-5" => 3 JP, "1" => 1 JP
 */
export function getJPFromJamKe(jamKe) {
	if (!jamKe) return 1;
	const str = String(jamKe).trim();

	// Format range: "1-2", "3 - 5", "1–2"
	const rangeMatch = str.match(/^(\d+)\s*[-–]\s*(\d+)$/);
	if (rangeMatch) {
		const start = parseInt(rangeMatch[1], 10);
		const end = parseInt(rangeMatch[2], 10);
		if (!isNaN(start) && !isNaN(end) && end >= start) {
			return end - start + 1;
		}
	}

	// Format tunggal angka
	const singleNum = parseInt(str, 10);
	if (!isNaN(singleNum) && singleNum > 0 && singleNum < 15) {
		return 1;
	}

	return 1;
}

/**
 * Generate dan unduh PDF Laporan Jurnal Guru lengkap dengan:
 * 1. Kop Surat Resmi Profil Sekolah
 * 2. Ringkasan Eksekutif Statistik Jurnal (Total Jurnal, Total Jam, Jumlah Guru, Jumlah Mapel, Jumlah Kelas)
 * 3. Distribusi Hari Mengajar (Senin s/d Sabtu)
 * 4. Statistik Kinerja per Guru
 * 5. Tabel Rincian Detail Jurnal KBM
 * 6. Blok Pengesahan Tanda Tangan Kepala Sekolah (Nama & NIP otomatis)
 */
export function exportJurnalPDFReport({
	journals = [],
	schoolProfile = {},
	title = 'LAPORAN REKAPITULASI JURNAL PEMBELAJARAN GURU (KBM)',
	subInfo = '',
	filename = `Laporan_Jurnal_Guru_${getTodayDateString()}.pdf`,
}) {
	if (!Array.isArray(journals) || journals.length === 0) {
		throw new Error('Tidak ada data jurnal yang tersedia untuk diekspor.');
	}

	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 14;

	// 1. Gambar Kop Surat Resmi
	const endKop = drawKopSuratPDF(doc, schoolProfile, { startY: 8, margin });

	// 2. Judul Laporan & Sub-info
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.setTextColor(15, 23, 42); // slate-900
	doc.text(title, pageWidth / 2, endKop + 2.5, { align: 'center' });

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(71, 85, 105); // slate-600
	const defaultSub = `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
	doc.text(subInfo ? `${subInfo}  •  ${defaultSub}` : defaultSub, pageWidth / 2, endKop + 6.8, { align: 'center' });

	// 3. Kalkulasi Statistik Utama
	const totalJurnal = journals.length;
	let totalJam = 0;
	const guruMap = new Map();
	const mapelSet = new Set();
	const kelasSet = new Set();
	let tuntasCount = 0;

	// Inisialisasi Hari (1: Senin, ..., 6: Sabtu, 0: Minggu)
	const hariStats = {
		1: { nama: 'Senin', count: 0, jp: 0 },
		2: { nama: 'Selasa', count: 0, jp: 0 },
		3: { nama: 'Rabu', count: 0, jp: 0 },
		4: { nama: 'Kamis', count: 0, jp: 0 },
		5: { nama: 'Jumat', count: 0, jp: 0 },
		6: { nama: 'Sabtu', count: 0, jp: 0 },
		0: { nama: 'Minggu', count: 0, jp: 0 },
	};

	journals.forEach((j) => {
		const jp = getJPFromJamKe(j.jam_ke);
		totalJam += jp;

		if (j.mapel) mapelSet.add(String(j.mapel).trim());
		if (j.kelas) kelasSet.add(String(j.kelas).trim());
		if (j.tuntas) tuntasCount += 1;

		// Hitung Hari
		if (j.tanggal) {
			const dayIndex = new Date(`${String(j.tanggal).slice(0, 10)}T00:00:00`).getDay();
			if (hariStats[dayIndex] !== undefined) {
				hariStats[dayIndex].count += 1;
				hariStats[dayIndex].jp += jp;
			}
		}

		// Hitung Per Guru
		const guruKey = j.guru_id || j.users?.nama_lengkap || 'guru_unknown';
		const guruNama = j.users?.nama_lengkap || j.nama_guru || 'Guru Pengajar';
		if (!guruMap.has(guruKey)) {
			guruMap.set(guruKey, {
				id: guruKey,
				nama: guruNama,
				totalJurnal: 0,
				totalJP: 0,
				mapelSet: new Set(),
				kelasSet: new Set(),
				tuntasCount: 0,
			});
		}
		const g = guruMap.get(guruKey);
		g.totalJurnal += 1;
		g.totalJP += jp;
		if (j.mapel) g.mapelSet.add(String(j.mapel).trim());
		if (j.kelas) g.kelasSet.add(String(j.kelas).trim());
		if (j.tuntas) g.tuntasCount += 1;
	});

	const totalGuru = guruMap.size;
	const persentaseTuntas = totalJurnal > 0 ? Math.round((tuntasCount / totalJurnal) * 100) : 0;

	// =========================================================================
	// TABEL 1: RINGKASAN EKSEKUTIF STATISTIK JURNAL (KPI CARDS)
	// =========================================================================
	autoTable(doc, {
		startY: endKop + 10,
		margin: { left: margin, right: margin },
		head: [
			['TOTAL JURNAL', 'TOTAL JAM (JP)', 'JUMLAH GURU', 'JUMLAH MAPEL', 'JUMLAH KELAS', 'KETUNTASAN KBM'],
		],
		body: [
			[
				`${totalJurnal} Sesi KBM`,
				`${totalJam} Jam Pelajaran`,
				`${totalGuru} Tenaga Pendidik`,
				`${mapelSet.size} Mata Pelajaran`,
				`${kelasSet.size} Rombel Kelas`,
				`${persentaseTuntas}% (${tuntasCount}/${totalJurnal} Sesi)`,
			],
		],
		theme: 'grid',
		headStyles: {
			fillColor: [79, 70, 229], // Indigo 600
			textColor: [255, 255, 255],
			fontSize: 7.5,
			fontStyle: 'bold',
			halign: 'center',
			cellPadding: 2,
		},
		bodyStyles: {
			fillColor: [248, 250, 252], // Slate 50
			textColor: [15, 23, 42],
			fontSize: 8.5,
			fontStyle: 'bold',
			halign: 'center',
			cellPadding: 2.5,
		},
	});

	let currentY = (doc.lastAutoTable?.finalY || endKop + 28) + 5;

	// =========================================================================
	// SECTION: DISTRIBUSI HARI MENGAJAR & STATISTIK PER GURU
	// =========================================================================
	// Header Section A
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8.5);
	doc.setTextColor(30, 41, 59);
	doc.text('A. DISTRIBUSI HARI MENGAJAR', margin, currentY);

	const activeHariList = [1, 2, 3, 4, 5, 6];
	if (hariStats[0].count > 0) activeHariList.push(0);

	const hariBody = activeHariList.map((dayIdx, idx) => {
		const h = hariStats[dayIdx];
		const porsi = totalJam > 0 ? ((h.jp / totalJam) * 100).toFixed(1) : '0.0';
		return [
			idx + 1,
			h.nama,
			`${h.count} Sesi`,
			`${h.jp} JP`,
			`${porsi}%`,
		];
	});

	// Tambahkan baris total akumulatif
	hariBody.push([
		'',
		'TOTAL KESELURUHAN',
		`${totalJurnal} Sesi`,
		`${totalJam} JP`,
		'100.0%',
	]);

	autoTable(doc, {
		startY: currentY + 1.5,
		margin: { left: margin, right: margin },
		head: [['No', 'Hari Mengajar', 'Jumlah Jurnal / Sesi', 'Total Jam Pelajaran (JP)', 'Porsi Jam (%)']],
		body: hariBody,
		theme: 'grid',
		headStyles: {
			fillColor: [30, 41, 59], // Slate 800
			textColor: [255, 255, 255],
			fontSize: 7,
			fontStyle: 'bold',
			halign: 'center',
			cellPadding: 1.8,
		},
		bodyStyles: {
			fontSize: 7,
			textColor: [15, 23, 42],
			cellPadding: 1.5,
		},
		columnStyles: {
			0: { halign: 'center', cellWidth: 10 },
			1: { fontStyle: 'bold', cellWidth: 45 },
			2: { halign: 'center', cellWidth: 45 },
			3: { halign: 'center', fontStyle: 'bold', cellWidth: 50 },
			4: { halign: 'center', cellWidth: 40 },
		},
		didParseCell: (data) => {
			if (data.row.index === hariBody.length - 1) {
				data.cell.styles.fontStyle = 'bold';
				data.cell.styles.fillColor = [241, 245, 249];
			}
		},
	});

	currentY = (doc.lastAutoTable?.finalY || currentY + 35) + 5;

	// =========================================================================
	// TABEL 3: STATISTIK KINERJA MENGAJAR PER GURU
	// =========================================================================
	// Jika space di bawah terlalu mepet untuk tabel guru (< 45mm), pindah halaman baru
	if (currentY + 45 > pageHeight) {
		doc.addPage();
		currentY = 14;
	}

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8.5);
	doc.setTextColor(30, 41, 59);
	doc.text('B. STATISTIK KINERJA MENGAJAR PER GURU', margin, currentY);

	const guruList = Array.from(guruMap.values()).sort((a, b) => b.totalJP - a.totalJP || b.totalJurnal - a.totalJurnal);

	const guruBody = guruList.map((g, idx) => {
		const persen = g.totalJurnal > 0 ? Math.round((g.tuntasCount / g.totalJurnal) * 100) : 0;
		const mapelStr = Array.from(g.mapelSet).slice(0, 3).join(', ') + (g.mapelSet.size > 3 ? ' ...' : '');
		const kelasStr = Array.from(g.kelasSet).sort().join(', ');
		return [
			idx + 1,
			g.nama,
			`${g.totalJurnal} Sesi`,
			`${g.totalJP} JP`,
			mapelStr || '-',
			kelasStr || '-',
			`${persen}% (${g.tuntasCount}/${g.totalJurnal})`,
		];
	});

	autoTable(doc, {
		startY: currentY + 1.5,
		margin: { left: margin, right: margin },
		head: [['No', 'Nama Guru Pengajar', 'Total Jurnal', 'Total Jam', 'Mata Pelajaran', 'Kelas / Rombel', 'Ketuntasan']],
		body: guruBody,
		theme: 'grid',
		headStyles: {
			fillColor: [14, 116, 144], // Cyan 700
			textColor: [255, 255, 255],
			fontSize: 7,
			fontStyle: 'bold',
			halign: 'center',
			cellPadding: 1.8,
		},
		bodyStyles: {
			fontSize: 7,
			textColor: [15, 23, 42],
			cellPadding: 1.5,
		},
		columnStyles: {
			0: { halign: 'center', cellWidth: 8 },
			1: { fontStyle: 'bold', cellWidth: 52 },
			2: { halign: 'center', cellWidth: 22 },
			3: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
			4: { cellWidth: 60 },
			5: { cellWidth: 55 },
			6: { halign: 'center', cellWidth: 40 },
		},
	});

	currentY = (doc.lastAutoTable?.finalY || currentY + 35) + 5;

	// =========================================================================
	// TABEL 4: RINCIAN DETAIL CATATAN JURNAL KBM
	// =========================================================================
	// Selalu buka halaman baru untuk detail jurnal agar bersih dan rapi
	doc.addPage();
	currentY = 14;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8.5);
	doc.setTextColor(30, 41, 59);
	doc.text('C. RINCIAN CATATAN JURNAL PEMBELAJARAN (KBM)', margin, currentY);

	const detailHead = [
		['No', 'Tanggal', 'Jam', 'Guru Pengajar', 'Kelas', 'Mapel', 'Pert.', 'Materi Pokok Pembelajaran', 'Status', 'Catatan / Kendala'],
	];

	const detailBody = journals.map((j, idx) => [
		idx + 1,
		j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID') : '-',
		j.jam_ke || '-',
		j.users?.nama_lengkap || j.nama_guru || '-',
		j.kelas || '-',
		j.mapel || '-',
		j.pertemuan_ke ? `Ke-${j.pertemuan_ke}` : '-',
		j.materi || '-',
		j.tuntas ? 'Tuntas' : 'Belum Tuntas',
		j.hambatan || j.solusi || '-',
	]);

	autoTable(doc, {
		startY: currentY + 1.5,
		margin: { left: margin, right: margin },
		head: detailHead,
		body: detailBody,
		theme: 'grid',
		headStyles: {
			fillColor: [79, 70, 229], // Indigo 600
			textColor: [255, 255, 255],
			fontSize: 7,
			fontStyle: 'bold',
			halign: 'center',
			cellPadding: 1.8,
		},
		bodyStyles: {
			fontSize: 6.8,
			textColor: [15, 23, 42],
			cellPadding: 1.4,
		},
		columnStyles: {
			0: { halign: 'center', cellWidth: 8 },
			1: { halign: 'center', cellWidth: 20 },
			2: { halign: 'center', cellWidth: 12 },
			3: { fontStyle: 'bold', cellWidth: 38 },
			4: { halign: 'center', cellWidth: 16 },
			5: { cellWidth: 30 },
			6: { halign: 'center', cellWidth: 14 },
			7: { cellWidth: 65 },
			8: { halign: 'center', cellWidth: 18 },
			9: { cellWidth: 48 },
		},
	});

	// =========================================================================
	// BLOK PENGESAHAN TANDA TANGAN KEPALA SEKOLAH
	// =========================================================================
	const finalDetailY = (doc.lastAutoTable?.finalY || currentY + 40) + 8;
	if (finalDetailY + 30 > pageHeight) {
		doc.addPage();
		drawKepsekSignaturePDF(doc, schoolProfile, {
			startY: 20,
			title: 'Mengetahui & Mengesahkan,\nKepala Sekolah',
			x: pageWidth - 70,
		});
	} else {
		drawKepsekSignaturePDF(doc, schoolProfile, {
			startY: finalDetailY,
			title: 'Mengetahui & Mengesahkan,\nKepala Sekolah',
			x: pageWidth - 70,
		});
	}

	doc.save(filename);
}
