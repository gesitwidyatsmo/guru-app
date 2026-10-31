'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { hitungTotalPoinBersih, konversiPoinKeSikap, isPoinPositif } from '@/lib/poinUtils';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
} from '@/lib/pdfKopSurat';

export default function KepsekPoinPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [poinList, setPoinList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	const [filterKelas, setFilterKelas] = useState('Semua');
	const [filterTipe, setFilterTipe] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	useEffect(() => {
		const fetchPoinData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resPoin, resSiswa, resKelas, resProfil] = await Promise.all([
					supabase
						.from('poin')
						.select('*, users!poin_guru_id_fkey(nama_lengkap, username), siswa(nama_lengkap, kelas, nis)')
						.order('tanggal', { ascending: false }),
					supabase.from('siswa').select('id, nama_lengkap, kelas, nis').eq('status', 'Aktif'),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				setPoinList(resPoin.data || []);
				setSiswaList(resSiswa.data || []);
				setKelasList(resKelas.data || []);

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Gagal memuat rekap poin:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchPoinData();
	}, []);

	// Reset pagination on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [filterKelas, filterTipe, searchQuery]);

	// Filter
	const filteredPoin = useMemo(() => {
		return poinList.filter((p) => {
			const sKelas = p.siswa?.kelas || '';
			const matchKelas = filterKelas === 'Semua' || sKelas === filterKelas;
			const isPos = isPoinPositif(p);
			const matchTipe =
				filterTipe === 'Semua' ||
				(filterTipe === 'Positif' && isPos) ||
				(filterTipe === 'Negatif' && !isPos);

			const q = searchQuery.toLowerCase().trim();
			const sNama = p.siswa?.nama_lengkap?.toLowerCase() || '';
			const akt = p.aktifitas?.toLowerCase() || '';
			const guruName = p.users?.nama_lengkap?.toLowerCase() || '';
			const matchSearch = !q || sNama.includes(q) || akt.includes(q) || guruName.includes(q);

			return matchKelas && matchTipe && matchSearch;
		});
	}, [poinList, filterKelas, filterTipe, searchQuery]);

	// Akumulasi Poin per Siswa untuk Leaderboard & Deteksi Bimbingan
	const siswaAggregates = useMemo(() => {
		const map = {};
		siswaList.forEach((s) => {
			map[s.id] = {
				id: s.id,
				nama: s.nama_lengkap,
				kelas: s.kelas,
				poinList: [],
			};
		});

		poinList.forEach((p) => {
			if (p.siswa_id && map[p.siswa_id]) {
				map[p.siswa_id].poinList.push(p);
			}
		});

		const list = Object.values(map).map((s) => {
			const totalBersih = hitungTotalPoinBersih(s.poinList);
			const sikap = konversiPoinKeSikap(totalBersih);
			return { ...s, totalBersih, sikap };
		});

		const topPrestasi = [...list]
			.filter((s) => s.totalBersih > 0)
			.sort((a, b) => b.totalBersih - a.totalBersih)
			.slice(0, 5);
		const butuhBimbingan = [...list]
			.filter((s) => s.totalBersih < 0)
			.sort((a, b) => a.totalBersih - b.totalBersih)
			.slice(0, 5);

		let posCount = 0;
		let negCount = 0;
		poinList.forEach((p) => {
			if (isPoinPositif(p)) posCount += Math.abs(p.poin || 0);
			else negCount += Math.abs(p.poin || 0);
		});

		return {
			topPrestasi,
			butuhBimbingan,
			totalPositif: posCount,
			totalNegatif: negCount,
			siswaPerluBimbinganCount: list.filter((s) => s.sikap.predikat === 'D').length,
		};
	}, [poinList, siswaList]);

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredPoin.length / itemsPerPage));
	const paginatedPoin = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return filteredPoin.slice(start, start + itemsPerPage);
	}, [filteredPoin, currentPage]);

	// Active filter check
	const isFilterActive =
		Boolean(searchQuery.trim()) ||
		filterKelas !== 'Semua' ||
		filterTipe !== 'Semua';

	const handleResetFilters = () => {
		setSearchQuery('');
		setFilterKelas('Semua');
		setFilterTipe('Semua');
	};

	// Export to PDF with Kop Surat Resmi
	const handleExportPDF = () => {
		if (filteredPoin.length === 0) {
			Swal.fire('Info', 'Tidak ada data poin untuk diekspor.', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text('LAPORAN SUPERVISI POIN KARAKTER & KEDISIPLINAN SISWA', doc.internal.pageSize.getWidth() / 2, endKop + 2, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Filter Kelas: ${filterKelas}  •  Filter Tipe: ${filterTipe}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const tableHead = [
				['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'NIS', 'Aktivitas / Catatan', 'Kategori', 'Tipe', 'Poin', 'Guru Pelapor'],
			];

			const tableBody = filteredPoin.map((p, idx) => {
				const isPos = isPoinPositif(p);
				return [
					idx + 1,
					p.tanggal || '-',
					p.siswa?.nama_lengkap || '-',
					p.siswa?.kelas || '-',
					p.siswa?.nis || '-',
					p.aktifitas || '-',
					p.kategori || 'Umum',
					isPos ? 'Prestasi' : 'Pelanggaran',
					isPos ? `+${Math.abs(p.poin)}` : `-${Math.abs(p.poin)}`,
					p.users?.nama_lengkap || '-',
				];
			});

			autoTable(doc, {
				startY: endKop + 10,
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: { fillColor: [202, 138, 4], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
				bodyStyles: { fontSize: 7, textColor: [15, 23, 42] },
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { halign: 'center', cellWidth: 20 },
					2: { fontStyle: 'bold', cellWidth: 32 },
					3: { halign: 'center', cellWidth: 16 },
					4: { halign: 'center', cellWidth: 16 },
					6: { halign: 'center', cellWidth: 18 },
					7: { halign: 'center', cellWidth: 18 },
					8: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
				},
				didParseCell: (data) => {
					if (data.column.index === 7) {
						if (data.cell.raw === 'Prestasi') {
							data.cell.styles.textColor = [5, 150, 105];
							data.cell.styles.fontStyle = 'bold';
						} else if (data.cell.raw === 'Pelanggaran') {
							data.cell.styles.textColor = [225, 29, 72];
							data.cell.styles.fontStyle = 'bold';
						}
					}
				},
			});

			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 8;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			if (finalY + 28 <= pageHeight) {
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				const kepsekName = schoolProfile.nama_kepsek || 'Kepala Sekolah';
				const kepsekNip = schoolProfile.nip_kepsek ? `\nNIP. ${schoolProfile.nip_kepsek}` : '';
				doc.text(
					`Mengetahui & Menyetujui,\nKepala Sekolah\n\n\n\n${kepsekName}${kepsekNip}`,
					pageWidth - 70,
					finalY
				);
			}

			doc.save(`Supervisi_Poin_Karakter_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (err) {
			console.error('Gagal export PDF poin:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredPoin.length === 0) return;

		const headers = [
			'Tanggal',
			'Nama Siswa',
			'Kelas',
			'NIS',
			'Aktivitas / Catatan',
			'Kategori',
			'Tipe',
			'Poin',
			'Guru Pelapor',
		];

		const rows = filteredPoin.map((p) => {
			const isPos = isPoinPositif(p);
			return [
				p.tanggal || '',
				`"${(p.siswa?.nama_lengkap || '').replace(/"/g, '""')}"`,
				`"${(p.siswa?.kelas || '').replace(/"/g, '""')}"`,
				p.siswa?.nis || '',
				`"${(p.aktifitas || '').replace(/"/g, '""')}"`,
				`"${(p.kategori || 'Umum').replace(/"/g, '""')}"`,
				isPos ? 'Prestasi' : 'Pelanggaran',
				isPos ? `+${Math.abs(p.poin)}` : `-${Math.abs(p.poin)}`,
				`"${(p.users?.nama_lengkap || '').replace(/"/g, '""')}"`,
			];
		});

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`rekap_poin_siswa_${new Date().toISOString().split('T')[0]}.csv`
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12'>
			{/* Page Header */}
			<div className='bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-yellow-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>⭐</span> Pembinaan Karakter & Tata Tertib
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Supervisi Poin & Kedisiplinan Siswa
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Pantau akumulasi prestasi penghargaan dan penegakan tata tertib disiplin peserta didik sekolah.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto flex-wrap'>
					<button
						onClick={handleExportPDF}
						disabled={filteredPoin.length === 0}
						title='Unduh rekapitulasi poin siswa dalam format PDF dengan Kop Surat Resmi'
						className='px-3.5 py-2.5 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={filteredPoin.length === 0}
						title='Unduh rekapitulasi poin siswa dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-yellow-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-gray-500 block text-[10px] uppercase font-bold'>Periode Sistem</span>
						<span className='text-yellow-950 font-black text-xs sm:text-sm'>
							TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}
						</span>
					</div>
				</div>
			</div>

			{/* Stat Highlights Bar (Clickable as Quick Filters) */}
			<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
				<button
					onClick={() => setFilterTipe(filterTipe === 'Positif' ? 'Semua' : 'Positif')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterTipe === 'Positif' ? 'bg-emerald-100 ring-2 ring-emerald-600' : 'bg-emerald-50 hover:bg-emerald-100/60'
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-emerald-800'>Poin Prestasi (+)</p>
						<p className='text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5'>+{siswaAggregates.totalPositif}</p>
						<span className='text-[10px] font-bold text-emerald-700'>
							{filterTipe === 'Positif' ? '✓ Filter aktif' : 'Klik filter prestasi'}
						</span>
					</div>
					<span className='w-11 h-11 bg-emerald-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🏆
					</span>
				</button>

				<button
					onClick={() => setFilterTipe(filterTipe === 'Negatif' ? 'Semua' : 'Negatif')}
					className={`border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterTipe === 'Negatif' ? 'bg-rose-100 ring-2 ring-rose-600' : 'bg-rose-50 hover:bg-rose-100/60'
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-rose-800'>Poin Pelanggaran (-)</p>
						<p className='text-2xl sm:text-3xl font-black text-rose-950 mt-0.5'>-{siswaAggregates.totalNegatif}</p>
						<span className='text-[10px] font-bold text-rose-700'>
							{filterTipe === 'Negatif' ? '✓ Filter aktif' : 'Klik filter pelanggaran'}
						</span>
					</div>
					<span className='w-11 h-11 bg-rose-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						⚠️
					</span>
				</button>

				<div className='bg-yellow-50 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between'>
					<div>
						<p className='text-[11px] font-black uppercase text-yellow-800'>Perlu Bimbingan (Predikat D)</p>
						<p className='text-2xl sm:text-3xl font-black text-yellow-950 mt-0.5'>{siswaAggregates.siswaPerluBimbinganCount} Siswa</p>
						<span className='text-[10px] font-bold text-yellow-700'>Atensi Wali Kelas / BK</span>
					</div>
					<span className='w-11 h-11 bg-yellow-300 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						🤝
					</span>
				</div>

				<button
					onClick={() => setFilterTipe('Semua')}
					className={`bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex items-center justify-between text-left transition-all cursor-pointer hover:-translate-y-0.5 ${
						filterTipe === 'Semua' ? 'ring-2 ring-yellow-500 bg-yellow-50/40' : ''
					}`}>
					<div>
						<p className='text-[11px] font-black uppercase text-gray-500'>Total Insiden Dicatat</p>
						<p className='text-2xl sm:text-3xl font-black text-black mt-0.5'>{poinList.length}</p>
						<span className='text-[10px] font-bold text-gray-500'>Semua catatan poin</span>
					</div>
					<span className='w-11 h-11 bg-gray-100 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0'>
						📝
					</span>
				</button>
			</div>

			{/* Dual Leaderboard Grid */}
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
				{/* Top Prestasi */}
				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<h3 className='text-sm font-black uppercase tracking-tight text-emerald-950 flex items-center gap-2 mb-3'>
						<span>🏆</span> Top 5 Siswa Teladan & Berprestasi
					</h3>
					<div className='space-y-2'>
						{siswaAggregates.topPrestasi.length === 0 ? (
							<p className='text-xs text-gray-500 font-bold p-3 bg-emerald-50 rounded-lg'>Belum ada rekaman poin prestasi positif.</p>
						) : (
							siswaAggregates.topPrestasi.map((s, idx) => (
								<div key={s.id} className='flex items-center justify-between p-2.5 bg-emerald-50 border border-black/20 rounded-xl'>
									<div className='flex items-center gap-2.5'>
										<span className='w-6 h-6 rounded-lg bg-emerald-300 border border-black text-xs font-black flex items-center justify-center'>{idx + 1}</span>
										<div>
											<p className='text-xs font-black text-black'>{s.nama}</p>
											<span className='text-[10px] font-bold text-gray-600'>Kelas {s.kelas}</span>
										</div>
									</div>
									<span className='font-mono font-black text-xs text-emerald-800 bg-white px-2 py-0.5 rounded border border-black'>
										+{s.totalBersih} Poin
									</span>
								</div>
							))
						)}
					</div>
				</div>

				{/* Perlu Bimbingan */}
				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<h3 className='text-sm font-black uppercase tracking-tight text-rose-950 flex items-center gap-2 mb-3'>
						<span>⚠️</span> Top Siswa Memerlukan Perhatian Khusus
					</h3>
					<div className='space-y-2'>
						{siswaAggregates.butuhBimbingan.length === 0 ? (
							<p className='text-xs text-gray-500 font-bold p-3 bg-emerald-50 rounded-lg'>Tidak ada siswa dengan akumulasi poin negatif.</p>
						) : (
							siswaAggregates.butuhBimbingan.map((s, idx) => (
								<div key={s.id} className='flex items-center justify-between p-2.5 bg-rose-50 border border-black/20 rounded-xl'>
									<div className='flex items-center gap-2.5'>
										<span className='w-6 h-6 rounded-lg bg-rose-300 border border-black text-xs font-black flex items-center justify-center text-white'>{idx + 1}</span>
										<div>
											<p className='text-xs font-black text-black'>{s.nama}</p>
											<span className='text-[10px] font-bold text-gray-600'>Kelas {s.kelas} &bull; {s.sikap.label}</span>
										</div>
									</div>
									<span className='font-mono font-black text-xs text-rose-800 bg-white px-2 py-0.5 rounded border border-black'>
										{s.totalBersih} Poin
									</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			{/* Search & Multi Filter Box (Clean Structured Two-Tier Layout) */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				{/* Row 1: Search & Summary */}
				<div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
					<div className='relative flex-1'>
						<svg
							className='w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
							strokeWidth='2.5'>
							<path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
						</svg>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari nama siswa, deskripsi aktivitas, atau guru pelapor...'
							className='neo-input neo-input-with-icon !py-2.5 text-xs sm:text-sm !w-full'
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								title='Hapus pencarian'
								className='absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-black font-black text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors'>
								✕
							</button>
						)}
					</div>

					<div className='flex items-center justify-between sm:justify-end gap-2 shrink-0'>
						<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-yellow-50 text-yellow-950 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							<span>⭐</span>
							<span>{filteredPoin.length} Catatan Ditemukan</span>
						</span>

						{isFilterActive && (
							<button
								onClick={handleResetFilters}
								className='inline-flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
								<span>↺</span>
								<span>Reset Filter</span>
							</button>
						)}
					</div>
				</div>

				{/* Row 2: Filter Rombel & Tipe Poin */}
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t-2 border-black/10'>
					{/* Filter Rombel */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏫</span> Rombongan Belajar
						</label>
						<select
							value={filterKelas}
							onChange={(e) => setFilterKelas(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Kelas ({kelasList.length})</option>
							{kelasList.map((k) => (
								<option key={k.id || k.nama_kelas} value={k.nama_kelas}>
									{k.nama_kelas}
								</option>
							))}
						</select>
					</div>

					{/* Filter Tipe */}
					<div className='space-y-1.5'>
						<label className='text-[11px] font-black uppercase text-gray-600 flex items-center gap-1.5'>
							<span>🏷️</span> Tipe Catatan Karakter
						</label>
						<select
							value={filterTipe}
							onChange={(e) => setFilterTipe(e.target.value)}
							className='neo-input !py-2.5 text-xs font-bold bg-white cursor-pointer hover:bg-gray-50 !w-full'>
							<option value='Semua'>Semua Tipe Poin</option>
							<option value='Positif'>🏆 Prestasi / Penghargaan (+)</option>
							<option value='Negatif'>⚠️ Pelanggaran Disiplin (-)</option>
						</select>
					</div>
				</div>
			</div>

			{/* Main Table */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full text-left border-collapse'>
						<thead>
							<tr className='bg-yellow-300 border-b-2 border-black'>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Waktu</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Siswa Bersangkutan</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Aktivitas / Catatan</th>
								<th className='px-5 py-3.5 text-xs font-black text-black uppercase tracking-wider'>Guru Pelapor</th>
								<th className='px-5 py-3.5 text-center text-xs font-black text-black uppercase tracking-wider'>Poin</th>
							</tr>
						</thead>
						<tbody className='divide-y-2 divide-black/10'>
							{paginatedPoin.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className='px-6 py-12 text-center text-sm font-bold text-gray-500 bg-yellow-50/30'>
										<div className='flex flex-col items-center justify-center gap-2'>
											<span className='text-3xl'>🔍</span>
											<p className='text-black font-black text-base'>Tidak ada catatan poin siswa yang sesuai</p>
											<p className='text-xs text-gray-500'>Coba ubah kata kunci pencarian atau reset filter untuk menampilkan semua data.</p>
											{isFilterActive && (
												<button
													onClick={handleResetFilters}
													className='mt-2 px-4 py-2 bg-yellow-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
													Reset Semua Filter
												</button>
											)}
										</div>
									</td>
								</tr>
							) : (
								paginatedPoin.map((p, idx) => {
									const isPositive = isPoinPositif(p);
									return (
										<tr
											key={p.id || idx}
											className='hover:bg-yellow-50/50 transition-colors'>
											<td className='px-5 py-4 whitespace-nowrap text-xs font-bold text-gray-700'>
												{p.tanggal ? new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
											</td>

											<td className='px-5 py-4 whitespace-nowrap'>
												<span className='font-black text-xs sm:text-sm text-black block'>
													{p.siswa?.nama_lengkap || `Siswa ID: ${p.siswa_id}`}
												</span>
												<span className='inline-block px-1.5 py-0.5 bg-yellow-100 text-[10px] font-bold rounded border border-black/20'>
													Kelas {p.siswa?.kelas || '-'}
												</span>
											</td>

											<td className='px-5 py-4'>
												<span className='font-bold text-xs sm:text-sm text-black block'>
													{p.aktifitas || '-'}
												</span>
												<span className='text-[10px] font-bold text-gray-500'>
													Kategori: {p.kategori || 'Umum'} {p.keterangan ? `• ${p.keterangan}` : ''}
												</span>
											</td>

											<td className='px-5 py-4 whitespace-nowrap'>
												<span className='font-black text-xs text-black block'>
													{p.users?.nama_lengkap || 'Guru Pelapor'}
												</span>
												<span className='font-mono text-[10px] text-gray-500'>
													@{p.users?.username || 'user'}
												</span>
											</td>

											<td className='px-5 py-4 text-center whitespace-nowrap'>
												<span
													className={`inline-block font-mono font-black text-xs px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#0D0D0D] ${
														isPositive ? 'bg-emerald-300 text-black' : 'bg-rose-300 text-black'
													}`}>
													{isPositive ? `+${Math.abs(p.poin)}` : `-${Math.abs(p.poin)}`}
												</span>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div className='px-5 py-4 bg-gray-50 border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3'>
					<div className='text-xs font-bold text-gray-600'>
						Menampilkan <span className='font-black text-black'>{filteredPoin.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> s/d{' '}
						<span className='font-black text-black'>{Math.min(currentPage * itemsPerPage, filteredPoin.length)}</span> dari{' '}
						<span className='font-black text-black'>{filteredPoin.length}</span> rekaman poin
					</div>

					{totalPages > 1 && (
						<div className='flex items-center gap-1.5'>
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className='px-3 py-1.5 bg-white hover:bg-yellow-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								◀ Prev
							</button>

							<div className='flex items-center gap-1'>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
									if (
										pageNum === 1 ||
										pageNum === totalPages ||
										(pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
									) {
										return (
											<button
												key={pageNum}
												onClick={() => setCurrentPage(pageNum)}
												className={`w-8 h-8 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer ${
													currentPage === pageNum
														? 'bg-yellow-300 shadow-[2px_2px_0px_0px_#0D0D0D]'
														: 'bg-white hover:bg-gray-100'
												}`}>
												{pageNum}
											</button>
										);
									} else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
										return (
											<span key={pageNum} className='px-1 text-xs font-black text-gray-400'>
												...
											</span>
										);
									}
									return null;
								})}
							</div>

							<button
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								className='px-3 py-1.5 bg-white hover:bg-yellow-100 disabled:opacity-40 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all cursor-pointer disabled:cursor-not-allowed'>
								Next ▶
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
