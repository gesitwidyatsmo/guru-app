'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	drawKopSuratPDF,
} from '@/lib/pdfKopSurat';

export default function KepsekKelasPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedKelas, setSelectedKelas] = useState(null);

	useEffect(() => {
		const fetchKelasData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resKelas, resSiswa, resProfil] = await Promise.all([
					supabase.from('kelas').select('*, users!kelas_id_wali_kelas_fkey(nama_lengkap, username)').order('nama_kelas', { ascending: true }),
					supabase.from('siswa').select('id, nama_lengkap, kelas, nis, jenis_kelamin, status').eq('status', 'Aktif'),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				setKelasList(resKelas.data || []);
				setSiswaList(resSiswa.data || []);

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Gagal mengambil data kelas:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchKelasData();
	}, []);

	// Gabungkan jumlah siswa per kelas
	const kelasWithStats = useMemo(() => {
		return kelasList.map((k) => {
			const students = siswaList.filter((s) => s.kelas === k.nama_kelas);
			const l = students.filter((s) => s.jenis_kelamin === 'Laki-laki').length;
			const p = students.filter((s) => s.jenis_kelamin === 'Perempuan').length;
			return {
				...k,
				totalSiswa: students.length,
				lakiLaki: l,
				perempuan: p,
				students,
			};
		});
	}, [kelasList, siswaList]);

	const filteredKelas = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return kelasWithStats;
		return kelasWithStats.filter((k) => {
			const nama = k.nama_kelas?.toLowerCase() || '';
			const wali = k.users?.nama_lengkap?.toLowerCase() || k.wali_kelas?.toLowerCase() || '';
			return nama.includes(q) || wali.includes(q);
		});
	}, [kelasWithStats, searchQuery]);

	// Export to PDF with Kop Surat Resmi
	const handleExportPDF = () => {
		if (filteredKelas.length === 0) {
			Swal.fire('Info', 'Tidak ada data rombel kelas untuk diekspor.', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'portrait' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text('DAFTAR ROMBONGAN BELAJAR & WALI KELAS', doc.internal.pageSize.getWidth() / 2, endKop + 2, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Tahun Ajaran: ${tahunAjarAktif || '-'}  •  Semester: ${semesterAktif || '-'}  •  Total: ${filteredKelas.length} Rombel`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const tableHead = [
				['No', 'Nama Rombel / Kelas', 'Tingkat', 'Wali Kelas Terdaftar', 'L', 'P', 'Total Siswa'],
			];

			const tableBody = filteredKelas.map((k, idx) => [
				idx + 1,
				k.nama_kelas || '-',
				k.tingkat ? `Tingkat ${k.tingkat}` : '-',
				k.users?.nama_lengkap || k.wali_kelas || 'Belum Ditugaskan',
				k.lakiLaki,
				k.perempuan,
				k.totalSiswa,
			]);

			// Tambah baris total siswa sekolah
			const grandTotal = filteredKelas.reduce((sum, k) => sum + (k.totalSiswa || 0), 0);
			const grandL = filteredKelas.reduce((sum, k) => sum + (k.lakiLaki || 0), 0);
			const grandP = filteredKelas.reduce((sum, k) => sum + (k.perempuan || 0), 0);

			tableBody.push(['', 'TOTAL KESELURUHAN', '', `${filteredKelas.length} Rombel`, grandL, grandP, grandTotal]);

			autoTable(doc, {
				startY: endKop + 10,
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
				bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { fontStyle: 'bold', cellWidth: 35 },
					2: { halign: 'center', cellWidth: 24 },
					3: { fontStyle: 'bold' },
					4: { halign: 'center', cellWidth: 16 },
					5: { halign: 'center', cellWidth: 16 },
					6: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
				},
				didParseCell: (data) => {
					if (data.row.index === tableBody.length - 1) {
						data.cell.styles.fontStyle = 'bold';
						data.cell.styles.fillColor = [224, 231, 255];
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
					`Mengetahui & Mengesahkan,\nKepala Sekolah\n\n\n\n${kepsekName}${kepsekNip}`,
					pageWidth - 70,
					finalY
				);
			}

			doc.save(`Daftar_Rombel_Kelas_${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (err) {
			console.error('Gagal export PDF rombel:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Export to CSV helper
	const handleExportCSV = () => {
		if (filteredKelas.length === 0) return;

		const headers = ['Nama Kelas', 'Tingkat', 'Wali Kelas', 'Username Wali', 'Total Siswa', 'Laki-laki', 'Perempuan'];
		const rows = filteredKelas.map((k) => [
			`"${(k.nama_kelas || '').replace(/"/g, '""')}"`,
			k.tingkat || '',
			`"${(k.users?.nama_lengkap || k.wali_kelas || 'Belum Ditugaskan').replace(/"/g, '""')}"`,
			`"${(k.users?.username || '').replace(/"/g, '""')}"`,
			k.totalSiswa,
			k.lakiLaki,
			k.perempuan,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute(
			'download',
			`rekap_rombel_kelas_${new Date().toISOString().split('T')[0]}.csv`
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
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-indigo-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🏫</span> Struktur Rombongan Belajar
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Daftar Rombel & Penugasan Wali Kelas
					</h1>
					<p className='text-xs sm:text-sm font-medium text-gray-600 mt-1'>
						Tinjau seluruh rombongan belajar aktif, persebaran populasi siswa, dan guru yang ditugaskan sebagai wali kelas.
					</p>
				</div>

				<div className='flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto flex-wrap'>
					<button
						onClick={handleExportPDF}
						disabled={filteredKelas.length === 0}
						title='Unduh rekapitulasi rombel kelas dalam format PDF dengan Kop Surat Resmi'
						className='px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📄</span>
						<span>Ekspor PDF</span>
					</button>

					<button
						onClick={handleExportCSV}
						disabled={filteredKelas.length === 0}
						title='Unduh rekapitulasi rombel kelas dalam format CSV'
						className='px-3.5 py-2.5 bg-white hover:bg-yellow-200 disabled:opacity-50 disabled:hover:bg-white text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed'>
						<span>📥</span>
						<span>Ekspor CSV</span>
					</button>

					<div className='bg-indigo-50 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black shrink-0 text-center min-w-[140px]'>
						<span className='text-gray-500 block text-[10px] uppercase font-bold'>Periode Sistem</span>
						<span className='text-indigo-950 font-black text-xs sm:text-sm'>
							TA {tahunAjarAktif || '-'} &bull; Sem {semesterAktif || '-'}
						</span>
					</div>
				</div>
			</div>

			{/* Search Bar & Result Summary */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
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
						placeholder='Cari nama kelas atau nama wali kelas...'
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

				<div className='flex items-center gap-2 shrink-0'>
					<span className='inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-950 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
						<span>🏫</span>
						<span>{filteredKelas.length} Kelas ({siswaList.length} Siswa)</span>
					</span>

					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className='inline-flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer whitespace-nowrap'>
							<span>↺</span>
							<span>Reset</span>
						</button>
					)}
				</div>
			</div>

			{/* Grid Cards Rombel */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
				{filteredKelas.length === 0 ? (
					<div className='col-span-full p-12 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] text-center text-gray-500 font-bold'>
						<div className='flex flex-col items-center justify-center gap-2'>
							<span className='text-3xl'>🔍</span>
							<p className='text-black font-black text-base'>Tidak ada rombel kelas yang cocok</p>
							<p className='text-xs text-gray-500'>Tidak ditemukan rombel dengan kata kunci &ldquo;{searchQuery}&rdquo;.</p>
							<button
								onClick={() => setSearchQuery('')}
								className='mt-2 px-4 py-2 bg-indigo-200 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
								Tampilkan Semua Kelas
							</button>
						</div>
					</div>
				) : (
					filteredKelas.map((k) => (
						<div
							key={k.id || k.nama_kelas}
							className='neo-card flex flex-col justify-between !p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all'>
							<div>
								<div className='flex items-center justify-between mb-3'>
									<span className='px-3 py-1 bg-yellow-300 text-black border-2 border-black rounded-lg text-sm font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
										🏫 {k.nama_kelas}
									</span>
									<span className='text-xs font-black font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-indigo-900'>
										{k.totalSiswa} Siswa
									</span>
								</div>

								{/* Wali Kelas */}
								<div className='bg-yellow-50/60 border border-black/20 rounded-xl p-3 my-3'>
									<span className='text-[10px] font-black uppercase text-gray-500 block'>Wali Kelas Bertugas</span>
									<p className='text-xs sm:text-sm font-black text-black mt-0.5 truncate'>
										{k.users?.nama_lengkap || k.wali_kelas || 'Belum Ditugaskan'}
									</p>
									{k.users?.username && (
										<span className='font-mono text-[10px] text-gray-500'>
											@{k.users.username}
										</span>
									)}
								</div>

								{/* Gender breakdown */}
								<div className='grid grid-cols-2 gap-2 text-center text-xs font-black my-3'>
									<div className='bg-blue-50 border border-blue-200 p-2 rounded-lg text-blue-900'>
										<span className='block text-[10px] text-blue-700 font-bold'>Laki-laki</span>
										<span className='text-sm'>{k.lakiLaki} Siswa</span>
									</div>
									<div className='bg-pink-50 border border-pink-200 p-2 rounded-lg text-pink-900'>
										<span className='block text-[10px] text-pink-700 font-bold'>Perempuan</span>
										<span className='text-sm'>{k.perempuan} Siswa</span>
									</div>
								</div>
							</div>

							<div className='pt-3 border-t-2 border-black/10 flex items-center justify-between mt-2'>
								<span className='text-[11px] font-bold text-gray-500'>
									Tingkat {k.tingkat || '-'}
								</span>
								<button
									onClick={() => setSelectedKelas(k)}
									className='px-3 py-1.5 bg-white hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer'>
									👥 Daftar Siswa
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{/* Modal Rombel Siswa */}
			{selectedKelas && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-3 border-black rounded-2xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150'>
						<div className='px-6 py-4 border-b-2 border-black flex items-center justify-between bg-yellow-300'>
							<div>
								<h3 className='text-base sm:text-lg font-black text-black uppercase tracking-tight flex items-center gap-2'>
									<span>👥</span>
									<span>Daftar Siswa Kelas {selectedKelas.nama_kelas}</span>
								</h3>
								<p className='text-xs font-bold text-gray-800'>
									Wali: {selectedKelas.users?.nama_lengkap || selectedKelas.wali_kelas || 'Belum Ditugaskan'} &bull; Total {selectedKelas.totalSiswa} Siswa
								</p>
							</div>
							<button
								onClick={() => setSelectedKelas(null)}
								className='w-8 h-8 bg-white border-2 border-black rounded-lg flex items-center justify-center text-black font-black hover:bg-rose-400 hover:text-white transition-colors shadow-[2px_2px_0px_0px_#0D0D0D] cursor-pointer'>
								✕
							</button>
						</div>

						<div className='p-6 max-h-[70vh] overflow-y-auto space-y-4 bg-[var(--background)]'>
							<div className='overflow-x-auto border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
								<table className='w-full text-left bg-white text-xs'>
									<thead>
										<tr className='bg-indigo-200 border-b-2 border-black font-black'>
											<th className='p-3'>No</th>
											<th className='p-3'>NIS</th>
											<th className='p-3'>Nama Siswa</th>
											<th className='p-3 text-center'>Gender</th>
											<th className='p-3 text-right'>Status</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-black/10'>
										{selectedKelas.students.length === 0 ? (
											<tr>
												<td colSpan={5} className='p-6 text-center text-gray-500 font-bold'>
													Belum ada peserta didik yang terdaftar aktif di kelas ini.
												</td>
											</tr>
										) : (
											selectedKelas.students.map((s, idx) => (
												<tr key={s.id || idx} className='hover:bg-yellow-50'>
													<td className='p-3 font-bold text-gray-500'>{idx + 1}</td>
													<td className='p-3 font-mono font-bold'>{s.nis || '-'}</td>
													<td className='p-3 font-black text-black'>{s.nama_lengkap}</td>
													<td className='p-3 text-center'>
														<span className={`px-2 py-0.5 rounded text-[10px] font-black ${s.jenis_kelamin === 'Laki-laki' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
															{s.jenis_kelamin || '-'}
														</span>
													</td>
													<td className='p-3 text-right'>
														<span className='px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]'>
															{s.status || 'Aktif'}
														</span>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>

							<div className='pt-2 flex justify-end'>
								<button
									onClick={() => setSelectedKelas(null)}
									className='neo-btn-primary text-xs sm:text-sm !py-2 !px-5 bg-black text-white cursor-pointer'>
									Tutup Daftar
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
