'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, fetchSchoolProfile, drawKopSuratPDF } from '@/lib/pdfKopSurat';
import { parseJTM, getDefaultCutOffRange } from '@/lib/bisaroh';
import {
	buildCrossValidationMap,
	validateJurnalWithAbsensi,
	calculateGuruCompliance,
} from '@/lib/crossValidation';

export default function KurikulumJTMPage() {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [journals, setJournals] = useState([]);
	const [kelas, setKelas] = useState([]);
	const [absensiSessions, setAbsensiSessions] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Date range state
	const defaultRange = getDefaultCutOffRange();
	const [startDate, setStartDate] = useState(defaultRange.startDate);
	const [endDate, setEndDate] = useState(defaultRange.endDate);
	const [searchQuery, setSearchQuery] = useState('');

	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 15;

	// Modal detail guru
	const [selectedGuru, setSelectedGuru] = useState(null);

	const toYMD = (d) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	const todayYMD = useMemo(() => toYMD(new Date()), []);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resUsers, resJurnal, resKelas, resAbsensi, prof] = await Promise.all([
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/kelas').catch(() => ({ ok: false })),
					fetch('/api/absensi-mapel?cross_check=true').catch(() => ({ ok: false })),
					fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH),
				]);

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
				}

				if (resJurnal.ok) {
					const data = await resJurnal.json();
					setJournals(Array.isArray(data) ? data : []);
				}

				if (resKelas.ok) {
					const data = await resKelas.json();
					setKelas(Array.isArray(data) ? data : []);
				}

				if (resAbsensi.ok) {
					const data = await resAbsensi.json();
					setAbsensiSessions(Array.isArray(data) ? data : []);
				}

				if (prof) {
					setSchoolProfile(prof);
				}
			} catch (err) {
				console.error('Error load JTM data for kurikulum:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Filter dewan guru
	const guruList = useMemo(() => {
		return users.filter((u) => u.role === 'Guru');
	}, [users]);

	// Set nama wali kelas
	const waliKelasNames = useMemo(() => {
		const names = new Set();
		kelas.forEach((k) => {
			if (k.wali_kelas) names.add(String(k.wali_kelas).trim().toLowerCase());
		});
		return names;
	}, [kelas]);

	// Cross validation map
	const crossMap = useMemo(() => {
		return buildCrossValidationMap(absensiSessions);
	}, [absensiSessions]);

	// Filter jurnal sesuai rentang tanggal yang dipilih
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (!j.tanggal) return false;
			if (startDate && j.tanggal < startDate) return false;
			if (endDate && j.tanggal > endDate) return false;
			return true;
		});
	}, [journals, startDate, endDate]);

	// Rekap per guru
	const guruJTMList = useMemo(() => {
		const map = {};

		guruList.forEach((g) => {
			const isWali =
				waliKelasNames.has(String(g.nama_lengkap || '').trim().toLowerCase()) ||
				waliKelasNames.has(String(g.username || '').trim().toLowerCase());

			map[g.id_user] = {
				guru: g,
				isWaliKelas: isWali,
				totalJP: 0,
				totalSesi: 0,
				dates: new Set(),
				kendalaCount: 0,
				sessions: [],
			};
		});

		filteredJournals.forEach((j) => {
			const gId = j.guru_id;
			if (map[gId]) {
				const jp = parseJTM(j.jam_ke);
				map[gId].totalJP += jp;
				map[gId].totalSesi += 1;
				map[gId].dates.add(j.tanggal);
				if (j.hambatan && j.hambatan.trim() && j.hambatan.trim() !== '-') {
					map[gId].kendalaCount += 1;
				}
				map[gId].sessions.push({ ...j, jp });
			}
		});

		let list = Object.values(map);

		// Hitung skor kepatuhan presensi siswa per guru
		list.forEach((item) => {
			item.compliance = calculateGuruCompliance(item.sessions, crossMap);
		});

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(item) =>
					(item.guru.nama_lengkap || '').toLowerCase().includes(q) ||
					(item.guru.username || '').toLowerCase().includes(q)
			);
		}

		return list.sort((a, b) => b.totalJP - a.totalJP);
	}, [guruList, filteredJournals, waliKelasNames, crossMap, searchQuery]);

	// Total ringkasan metrik
	const totalJPAll = useMemo(() => guruJTMList.reduce((acc, c) => acc + c.totalJP, 0), [guruJTMList]);
	const totalSesiAll = useMemo(() => guruJTMList.reduce((acc, c) => acc + c.totalSesi, 0), [guruJTMList]);
	const activeGuruCount = useMemo(() => guruJTMList.filter((g) => g.totalJP > 0).length, [guruJTMList]);
	const avgJP = useMemo(() => (activeGuruCount > 0 ? (totalJPAll / activeGuruCount).toFixed(1) : 0), [totalJPAll, activeGuruCount]);

	const totalComplianceStats = useMemo(() => {
		let total = 0;
		let lengkap = 0;
		guruJTMList.forEach((item) => {
			if (item.compliance) {
				total += item.compliance.totalSesi;
				lengkap += item.compliance.sesiLengkap;
			}
		});
		const pct = total > 0 ? Math.round((lengkap / total) * 100) : 100;
		return { total, lengkap, belumLengkap: total - lengkap, pct };
	}, [guruJTMList]);

	// Pagination
	const totalPages = Math.max(1, Math.ceil(guruJTMList.length / itemsPerPage));
	const paginatedGuruList = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return guruJTMList.slice(start, start + itemsPerPage);
	}, [guruJTMList, currentPage]);

	// Reset page saat filter berubah
	useEffect(() => {
		setCurrentPage(1);
	}, [startDate, endDate, searchQuery]);

	// Preset tanggal
	const handlePreset = (type) => {
		const now = new Date();

		if (type === 'today') {
			const ymd = toYMD(now);
			setStartDate(ymd);
			setEndDate(ymd);
		} else if (type === 'cutoff') {
			const def = getDefaultCutOffRange();
			setStartDate(def.startDate);
			setEndDate(def.endDate);
		} else if (type === 'thisMonth') {
			const first = new Date(now.getFullYear(), now.getMonth(), 1);
			const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			setStartDate(toYMD(first));
			setEndDate(toYMD(last));
		} else if (type === 'lastMonth') {
			const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const last = new Date(now.getFullYear(), now.getMonth(), 0);
			setStartDate(toYMD(first));
			setEndDate(toYMD(last));
		} else if (type === 'all') {
			setStartDate('');
			setEndDate('');
		}
	};

	// Cek apakah preset sedang aktif
	const isPresetActive = (type) => {
		const now = new Date();
		if (type === 'today') {
			return startDate === todayYMD && endDate === todayYMD;
		}
		if (type === 'cutoff') {
			const def = getDefaultCutOffRange();
			return startDate === def.startDate && endDate === def.endDate;
		}
		if (type === 'thisMonth') {
			const first = toYMD(new Date(now.getFullYear(), now.getMonth(), 1));
			const last = toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
			return startDate === first && endDate === last;
		}
		if (type === 'lastMonth') {
			const first = toYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1));
			const last = toYMD(new Date(now.getFullYear(), now.getMonth(), 0));
			return startDate === first && endDate === last;
		}
		if (type === 'all') {
			return !startDate && !endDate;
		}
		return false;
	};

	// Ekspor PDF Resmi Ber-Kop Surat
	const handleExportPDF = () => {
		if (guruJTMList.length === 0) return;

		try {
			const doc = new jsPDF('landscape');
			const endKop = drawKopSuratPDF(doc, schoolProfile);
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			// Judul Laporan
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(13);
			doc.text(
				'REKAPITULASI JAM TATAP MUKA (JTM) & KEHADIRAN DEWAN GURU',
				pageWidth / 2,
				endKop + 6,
				{ align: 'center' }
			);

			// Sub-Judul & Metadata Periode
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			const periodeStr =
				startDate && endDate
					? startDate === endDate
						? `Hari: ${startDate}`
						: `Periode: ${startDate} s/d ${endDate}`
					: startDate
					? `Mulai: ${startDate}`
					: endDate
					? `Sampai: ${endDate}`
					: 'Semua Periode Tanggal';

			const todayFormatted = new Date().toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			});

			doc.text(
				`${periodeStr}   |   Tanggal Unduh: ${todayFormatted}   |   Total Guru: ${guruJTMList.length} Orang   |   Total KBM: ${totalJPAll} JP (${totalSesiAll} Sesi)`,
				pageWidth / 2,
				endKop + 12,
				{ align: 'center' }
			);

			// Tabel Data
			const headers = [
				['No', 'Nama Dewan Guru', 'Status Tugas', 'Hadir KBM', 'Total Sesi', 'Total JP Riil', 'Presensi Siswa', 'Kendala KBM']
			];

			const body = guruJTMList.map((item, idx) => [
				idx + 1,
				`${item.guru.nama_lengkap || item.guru.username}\n@${item.guru.username}`,
				item.isWaliKelas ? 'Wali Kelas' : 'Guru Mapel',
				`${item.dates.size} Hari`,
				`${item.totalSesi} Sesi`,
				`${item.totalJP} JP`,
				`${item.compliance?.persentase || 0}% Lengkap\n(${item.compliance?.sesiLengkap || 0}/${item.compliance?.totalSesi || 0} Sesi)`,
				item.kendalaCount > 0 ? `${item.kendalaCount} Kendala` : 'Lancar',
			]);

			autoTable(doc, {
				startY: endKop + 16,
				head: headers,
				body: body,
				theme: 'grid',
				headStyles: {
					fillColor: [13, 148, 136], // Teal-600
					textColor: [255, 255, 255],
					fontSize: 9,
					fontStyle: 'bold',
					halign: 'center',
					valign: 'middle',
				},
				styles: {
					fontSize: 8.5,
					cellPadding: 2.5,
					valign: 'middle',
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 12 },
					1: { halign: 'left' },
					2: { halign: 'center', cellWidth: 26 },
					3: { halign: 'center', cellWidth: 24 },
					4: { halign: 'center', cellWidth: 24 },
					5: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
					6: { halign: 'center', cellWidth: 38 },
					7: { halign: 'center', cellWidth: 26 },
				},
			});

			// Area Pengesahan / Tanda Tangan
			const finalY = doc.lastAutoTable.finalY + 8;
			const signHeight = 35;

			if (finalY + signHeight > pageHeight) {
				doc.addPage();
			}

			const signY = finalY + signHeight > pageHeight ? 20 : finalY;
			const signMargin = 25;

			// Tanda Tangan Kiri: Waka Kurikulum
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text('Mengetahui / Mengesahkan,', signMargin, signY);
			doc.text('Waka Bidang Kurikulum', signMargin, signY + 5);
			doc.text('( .................................................... )', signMargin, signY + 24);
			doc.text('NIP. .............................................', signMargin, signY + 29);

			// Tanda Tangan Kanan: Kepala Sekolah
			const rightSignX = pageWidth - signMargin - 65;
			const kotaTitimangsa = schoolProfile.alamat ? 'Kuala Gading' : 'Ditetapkan';
			doc.text(`${kotaTitimangsa}, ${todayFormatted}`, rightSignX, signY);
			doc.text('Kepala Sekolah,', rightSignX, signY + 5);
			const namaKepsek = schoolProfile.nama_kepsek || '( .................................................... )';
			const nipKepsek = schoolProfile.nip_kepsek
				? `NIP. ${schoolProfile.nip_kepsek}`
				: 'NIP. .............................................';
			doc.setFont('helvetica', 'bold');
			doc.text(namaKepsek, rightSignX, signY + 24);
			doc.setFont('helvetica', 'normal');
			doc.text(nipKepsek, rightSignX, signY + 29);

			doc.save(`Rekap_JTM_Kurikulum_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}.pdf`);
		} catch (err) {
			console.error('Error generating PDF:', err);
		}
	};

	// Ekspor CSV
	const handleExportCSV = () => {
		if (guruJTMList.length === 0) return;

		const headers = [
			'No',
			'Nama Guru',
			'Username',
			'Tugas Wali Kelas',
			'Hari Hadir KBM',
			'Total Sesi Mengajar',
			'Total Jam Pelajaran (JP)',
			'Kepatuhan Presensi Siswa (%)',
			'Sesi Lengkap Diabsen',
			'Sesi Belum Diabsen',
			'Jumlah Kendala KBM',
		];
		const rows = guruJTMList.map((item, idx) => [
			idx + 1,
			`"${(item.guru.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(item.guru.username || '').replace(/"/g, '""')}"`,
			item.isWaliKelas ? 'Ya' : 'Bukan',
			item.dates.size,
			item.totalSesi,
			item.totalJP,
			`${item.compliance?.persentase || 0}%`,
			item.compliance?.sesiLengkap || 0,
			item.compliance?.sesiBelumLengkap || 0,
			item.kendalaCount,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `Rekap_JTM_Kurikulum_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<div className='space-y-6'>
			{/* Page Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2'>
						<span className='px-2.5 py-0.5 bg-yellow-300 border border-black rounded-lg text-[10px] font-black uppercase tracking-wider'>
							Pusat Kendali Akademik
						</span>
						<Link
							href='/kurikulum/jurnal'
							className='text-[10px] font-black text-teal-800 hover:underline flex items-center gap-1'>
							<span>📖 Supervisi Jurnal Guru &rarr;</span>
						</Link>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black uppercase tracking-tight flex items-center gap-2 mt-1'>
						<span>⏱️</span>
						<span>Monitoring JTM & Kehadiran Guru</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-0.5'>
						Rekapitulasi beban jam tatap muka, frekuensi kehadiran mengajar riil, dan integritas presensi siswa.
					</p>
				</div>

				{/* Action Buttons: Ekspor PDF & CSV */}
				<div className='flex items-center gap-2 shrink-0'>
					<button
						onClick={handleExportPDF}
						disabled={guruJTMList.length === 0}
						className='px-3.5 py-2.5 bg-rose-400 hover:bg-rose-500 disabled:opacity-50 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={guruJTMList.length === 0}
						className='px-3.5 py-2.5 bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>
				</div>
			</div>

			{/* KPI Metrik Akademik (4 Kotak Rapi & Seimbang) */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
				{/* Card 1: Guru Aktif */}
				<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-gray-500 tracking-wider'>Dewan Guru Aktif</p>
						<span className='w-8 h-8 rounded-xl bg-teal-200 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							👨‍🏫
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-black'>{activeGuruCount}</span>
							<span className='text-xs font-bold text-gray-600'>/ {guruList.length} Guru</span>
						</div>
						<p className='text-[11px] font-bold text-gray-500 mt-0.5'>Melaksanakan KBM periode ini</p>
					</div>
				</div>

				{/* Card 2: Total JP Terlaksana */}
				<div className='bg-yellow-200 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-yellow-950 tracking-wider'>Total Jam Mengajar</p>
						<span className='w-8 h-8 rounded-xl bg-yellow-400 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							⏱️
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-black'>{totalJPAll}</span>
							<span className='text-xs font-bold text-yellow-900'>JP Riil</span>
						</div>
						<p className='text-[11px] font-bold text-yellow-900 mt-0.5'>Dari total {totalSesiAll} sesi jurnal</p>
					</div>
				</div>

				{/* Card 3: Rata-Rata JP */}
				<div className='bg-sky-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px]'>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase text-sky-950 tracking-wider'>Rata-Rata JP / Guru</p>
						<span className='w-8 h-8 rounded-xl bg-sky-300 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							📊
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black text-sky-950'>{avgJP}</span>
							<span className='text-xs font-bold text-sky-800'>JP</span>
						</div>
						<p className='text-[11px] font-bold text-sky-800 mt-0.5'>Beban tatap muka rata-rata</p>
					</div>
				</div>

				{/* Card 4: Kepatuhan Presensi Siswa */}
				<div className={`border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col justify-between min-h-[110px] ${
					totalComplianceStats.pct >= 90 ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'
				}`}>
					<div className='flex items-center justify-between'>
						<p className='text-[11px] font-black uppercase tracking-wider'>Kepatuhan Presensi</p>
						<span className='w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							{totalComplianceStats.pct >= 90 ? '🟢' : '🟡'}
						</span>
					</div>
					<div className='mt-2'>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl sm:text-3xl font-black'>{totalComplianceStats.pct}%</span>
							<span className='text-xs font-bold'>
								({totalComplianceStats.lengkap}/{totalComplianceStats.total} Sesi)
							</span>
						</div>
						<div className='w-full h-2.5 bg-white border border-black rounded-full overflow-hidden mt-1.5'>
							<div
								className={`h-full transition-all duration-500 ${
									totalComplianceStats.pct >= 90
										? 'bg-emerald-500'
										: totalComplianceStats.pct >= 75
										? 'bg-amber-400'
										: 'bg-rose-500'
								}`}
								style={{ width: `${totalComplianceStats.pct}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Filter Box Rapi */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4'>
					{/* Search Guru */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Cari Dewan Guru
						</label>
						<div className='relative'>
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='Ketik nama guru atau @username...'
								className='neo-input !py-2.5 !pl-9 text-xs font-bold w-full'
							/>
							<span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm'>
								🔍
							</span>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery('')}
									className='absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-black font-black'>
									✕
								</button>
							)}
						</div>
					</div>

					{/* Start Date */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Mulai
						</label>
						<input
							type='date'
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className='neo-input !py-2.5 text-xs font-mono font-bold w-full'
						/>
					</div>

					{/* End Date */}
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Selesai
						</label>
						<input
							type='date'
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className='neo-input !py-2.5 text-xs font-mono font-bold w-full'
						/>
					</div>
				</div>

				{/* Quick Preset Buttons (Termasuk Hari Ini) */}
				<div className='flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t-2 border-black/10'>
					<div className='flex flex-wrap items-center gap-2'>
						<span className='text-[10px] font-black uppercase text-gray-500 mr-1'>Pintasan Rentang:</span>
						
						{/* Pintasan Hari Ini */}
						<button
							onClick={() => handlePreset('today')}
							className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 ${
								isPresetActive('today')
									? 'bg-yellow-300 text-black'
									: 'bg-white hover:bg-yellow-100 text-gray-800'
							}`}>
							<span>⚡</span>
							<span>Hari Ini</span>
						</button>

						{/* Cut-off */}
						<button
							onClick={() => handlePreset('cutoff')}
							className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 ${
								isPresetActive('cutoff')
									? 'bg-teal-300 text-black'
									: 'bg-white hover:bg-teal-100 text-gray-800'
							}`}>
							<span>📅</span>
							<span>Periode Cut-Off (26-25)</span>
						</button>

						{/* Bulan Ini */}
						<button
							onClick={() => handlePreset('thisMonth')}
							className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 ${
								isPresetActive('thisMonth')
									? 'bg-emerald-300 text-black'
									: 'bg-white hover:bg-emerald-100 text-gray-800'
							}`}>
							<span>📆</span>
							<span>Bulan Ini</span>
						</button>

						{/* Bulan Lalu */}
						<button
							onClick={() => handlePreset('lastMonth')}
							className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 ${
								isPresetActive('lastMonth')
									? 'bg-gray-300 text-black'
									: 'bg-white hover:bg-gray-100 text-gray-800'
							}`}>
							<span>⏮️</span>
							<span>Bulan Lalu</span>
						</button>

						{/* Semua Tanggal */}
						<button
							onClick={() => handlePreset('all')}
							className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ${
								isPresetActive('all')
									? 'bg-black text-white'
									: 'bg-white hover:bg-gray-100 text-gray-800'
							}`}>
							Semua Tanggal
						</button>
					</div>

					<div className='flex items-center gap-2 text-xs font-bold text-gray-600'>
						<span>
							Menampilkan: <strong className='text-black font-black'>{guruJTMList.length}</strong> Guru
						</span>
						{(searchQuery || startDate || endDate) && (
							<button
								onClick={() => {
									setSearchQuery('');
									setStartDate('');
									setEndDate('');
								}}
								className='px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-400 rounded-lg text-xs font-black uppercase transition-colors'>
								✕ Reset
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
								<th className='px-4 py-3.5 text-center w-12'>No</th>
								<th className='px-4 py-3.5 min-w-[200px]'>Dewan Guru</th>
								<th className='px-4 py-3.5 text-center whitespace-nowrap w-28'>Hadir KBM</th>
								<th className='px-4 py-3.5 text-center whitespace-nowrap w-24'>Total Sesi</th>
								<th className='px-4 py-3.5 text-center whitespace-nowrap w-28'>Total JP Riil</th>
								<th className='px-4 py-3.5 text-center min-w-[170px] whitespace-nowrap'>Presensi Siswa</th>
								<th className='px-4 py-3.5 text-center whitespace-nowrap w-28'>Kendala KBM</th>
								<th className='px-4 py-3.5 text-right w-24'>Aksi</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
							{loading ? (
								<tr>
									<td colSpan={8} className='px-6 py-14 text-center text-gray-500 font-bold'>
										<div className='inline-flex items-center gap-2'>
											<span className='animate-spin text-lg'>⌛</span>
											<span>Memuat rekap jam mengajar & kepatuhan presensi guru...</span>
										</div>
									</td>
								</tr>
							) : paginatedGuruList.length === 0 ? (
								<tr>
									<td colSpan={8} className='px-6 py-14 text-center text-gray-500 font-bold'>
										<div className='max-w-xs mx-auto space-y-2'>
											<span className='text-3xl block'>🔍</span>
											<p className='text-sm font-black text-black uppercase'>Tidak Ada Data Guru</p>
											<p className='text-xs text-gray-500'>
												Tidak ada data guru atau jurnal yang cocok dengan filter tanggal ini.
											</p>
											{(searchQuery || startDate || endDate) && (
												<button
													onClick={() => {
														setSearchQuery('');
														setStartDate('');
														setEndDate('');
													}}
													className='mt-2 px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedGuruList.map((item, idx) => {
									const rowIdx = (currentPage - 1) * itemsPerPage + idx + 1;
									return (
										<tr key={item.guru.id_user || idx} className='hover:bg-yellow-50/70 transition-colors'>
											<td className='px-4 py-4 text-center font-mono font-black text-gray-600 align-middle'>
												{rowIdx}
											</td>
											<td className='px-4 py-4 align-middle'>
												<div className='flex items-center gap-3'>
													<div className='w-9 h-9 rounded-xl bg-teal-200 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_#0D0D0D] shrink-0'>
														{item.guru.nama_lengkap?.charAt(0).toUpperCase() || 'G'}
													</div>
													<div>
														<p className='font-black text-sm text-black leading-tight'>
															{item.guru.nama_lengkap}
														</p>
														<div className='flex items-center gap-1.5 mt-0.5'>
															<span className='text-[10px] font-mono text-gray-500'>
																@{item.guru.username}
															</span>
															{item.isWaliKelas && (
																<span className='px-1.5 py-0.2 bg-yellow-200 border border-yellow-800 text-yellow-950 text-[9px] font-black rounded uppercase'>
																	Wali Kelas
																</span>
															)}
														</div>
													</div>
												</div>
											</td>
											<td className='px-4 py-4 text-center font-mono align-middle'>
												<span className='px-2.5 py-1 bg-emerald-100 border border-emerald-400 text-emerald-950 rounded-lg font-black'>
													{item.dates.size} Hari
												</span>
											</td>
											<td className='px-4 py-4 text-center font-mono align-middle'>
												<span className='px-2 py-0.5 bg-gray-100 border border-black/20 rounded font-black'>
													{item.totalSesi} Sesi
												</span>
											</td>
											<td className='px-4 py-4 text-center font-mono align-middle'>
												<span className='px-3 py-1 bg-yellow-300 border-2 border-black rounded-xl font-black text-black shadow-[2px_2px_0px_0px_#0D0D0D] text-xs'>
													{item.totalJP} JP
												</span>
											</td>
											{/* Tingkat Kepatuhan Presensi Siswa */}
											<td className='px-4 py-4 text-center align-middle whitespace-nowrap'>
												{item.compliance ? (
													<div className='inline-flex flex-col items-center gap-0.5'>
														<span
															className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black ${
																item.compliance.persentase >= 90
																	? 'bg-emerald-100 border-emerald-500 text-emerald-950'
																	: item.compliance.persentase >= 75
																	? 'bg-amber-100 border-amber-500 text-amber-950'
																	: 'bg-rose-100 border-rose-500 text-rose-950'
															}`}>
															{item.compliance.persentase}% Lengkap
														</span>
														<span className='text-[9px] text-gray-500 font-bold'>
															{item.compliance.sesiLengkap}/{item.compliance.totalSesi} Sesi
														</span>
													</div>
												) : (
													<span className='text-[10px] text-gray-400'>-</span>
												)}
											</td>
											<td className='px-4 py-4 text-center align-middle'>
												{item.kendalaCount > 0 ? (
													<span className='px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black rounded-lg'>
														⚠️ {item.kendalaCount} Kendala
													</span>
												) : (
													<span className='px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black rounded-lg'>
														✓ Lancar
													</span>
												)}
											</td>
											<td className='px-4 py-4 text-right align-middle'>
												<button
													onClick={() => setSelectedGuru(item)}
													className='px-3 py-1.5 bg-white hover:bg-yellow-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ml-auto flex items-center gap-1'>
													<span>Detail</span>
													<span>➔</span>
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination Bar */}
				{totalPages > 1 && (
					<div className='p-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-black'>
						<span className='text-gray-600'>
							Menampilkan halaman <strong className='text-black'>{currentPage}</strong> dari {totalPages} ({guruJTMList.length} guru)
						</span>
						<div className='flex items-center gap-1.5'>
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage(1)}
								className='px-2.5 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								⇤ Awal
							</button>
							<button
								disabled={currentPage === 1}
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								className='px-3 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Prev
							</button>
							<span className='px-3 py-1 bg-yellow-300 border-2 border-black rounded-lg font-black'>
								{currentPage}
							</span>
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								className='px-3 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Next
							</button>
							<button
								disabled={currentPage === totalPages}
								onClick={() => setCurrentPage(totalPages)}
								className='px-2.5 py-1 bg-white border-2 border-black rounded-lg disabled:opacity-40 hover:bg-gray-100 font-bold shadow-xs'>
								Akhir ⇥
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Modal Detail Sesi Mengajar Guru */}
			{selectedGuru && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Modal Header */}
						<div className='p-4 sm:p-5 bg-teal-300 border-b-2 border-black flex items-center justify-between shrink-0'>
							<div>
								<div className='flex items-center gap-2 mb-1'>
									<span className='text-[10px] font-black uppercase text-teal-950 bg-teal-200 px-2 py-0.5 rounded border border-teal-800 inline-block'>
										Rincian Sesi KBM
									</span>
									{selectedGuru.compliance && (
										<span
											className={`text-[10px] font-black px-2 py-0.5 rounded border ${
												selectedGuru.compliance.persentase >= 90
													? 'bg-emerald-200 border-emerald-700 text-emerald-950'
													: 'bg-amber-200 border-amber-700 text-amber-950'
											}`}>
											Presensi Siswa: {selectedGuru.compliance.persentase}% (
											{selectedGuru.compliance.sesiLengkap}/{selectedGuru.compliance.totalSesi} Sesi Sah)
										</span>
									)}
								</div>
								<h3 className='text-lg font-black text-black uppercase tracking-tight'>
									{selectedGuru.guru.nama_lengkap}
								</h3>
								<p className='text-xs font-bold text-gray-800 mt-0.5'>
									Total Jam Pelajaran: <span className='font-mono font-black'>{selectedGuru.totalJP} JP</span> ({selectedGuru.totalSesi} sesi pada periode ini)
								</p>
							</div>
							<button
								onClick={() => setSelectedGuru(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-xl flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-rose-300 transition-colors'>
								✕
							</button>
						</div>

						{/* Modal Content Table */}
						<div className='p-4 sm:p-5 overflow-y-auto flex-1 space-y-3'>
							{selectedGuru.sessions.length === 0 ? (
								<p className='text-center py-8 text-gray-500 font-bold'>
									Belum ada entri sesi jurnal pada rentang tanggal ini.
								</p>
							) : (
								<div className='border-2 border-black rounded-xl overflow-hidden'>
									<table className='w-full text-left border-collapse text-xs font-bold'>
										<thead>
											<tr className='bg-gray-100 border-b-2 border-black font-black uppercase text-[10px] text-gray-600'>
												<th className='px-3 py-2.5'>Tanggal</th>
												<th className='px-3 py-2.5'>Kelas & Mapel</th>
												<th className='px-3 py-2.5 text-center'>Jam Ke-</th>
												<th className='px-3 py-2.5 text-center'>Durasi</th>
												<th className='px-3 py-2.5 text-center'>Presensi Siswa</th>
												<th className='px-3 py-2.5'>Materi Pokok</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-black/10'>
											{selectedGuru.sessions.map((s, i) => {
												const val = validateJurnalWithAbsensi(s, crossMap);
												return (
													<tr key={s.id || i} className='hover:bg-teal-50/50 transition-colors'>
														<td className='px-3 py-2.5 font-mono text-gray-700 whitespace-nowrap align-middle'>
															{s.tanggal}
														</td>
														<td className='px-3 py-2.5 align-middle'>
															<span className='font-black text-black'>{s.mapel}</span>
															<span className='text-[10px] text-gray-500 block font-normal'>
																Kelas {s.kelas}
															</span>
														</td>
														<td className='px-3 py-2.5 text-center font-mono align-middle'>
															{s.jam_ke}
														</td>
														<td className='px-3 py-2.5 text-center font-mono align-middle'>
															<span className='px-2 py-0.5 bg-yellow-200 border border-black/30 rounded font-black'>
																{s.jp} JP
															</span>
														</td>
														<td className='px-3 py-2.5 text-center whitespace-nowrap align-middle'>
															{val.isValid ? (
																<span className='px-2 py-0.5 bg-emerald-100 border border-emerald-500 text-emerald-950 text-[10px] font-black rounded-lg'>
																	✓ {val.studentCount} Siswa
																</span>
															) : (
																<span className='px-2 py-0.5 bg-amber-100 border border-amber-500 text-amber-950 text-[10px] font-black rounded-lg animate-pulse'>
																	⚠️ Belum Absen
																</span>
															)}
														</td>
														<td className='px-3 py-2.5 align-middle'>
															<p className='line-clamp-1 text-black font-normal' title={s.materi || '-'}>
																{s.materi || '-'}
															</p>
															{s.hambatan && s.hambatan.trim() && s.hambatan.trim() !== '-' && (
																<span className='text-[10px] text-rose-700 font-bold block mt-0.5'>
																	Kendala: {s.hambatan}
																</span>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex justify-between items-center text-xs font-black shrink-0'>
							<span className='text-gray-500'>
								Terpilih {selectedGuru.sessions.length} sesi mengajar
							</span>
							<button
								onClick={() => setSelectedGuru(null)}
								className='px-5 py-2.5 bg-black text-white border-2 border-black rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
