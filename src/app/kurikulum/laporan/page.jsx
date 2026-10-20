'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, drawKopSuratPDF } from '@/lib/pdfKopSurat';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';
import { getTodayDateString } from '@/lib/dateUtils';
import { normStatus } from '@/lib/absensiUtils';
import { createClient } from '@/utils/supabase/client';

export default function KurikulumLaporanPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [activeTab, setActiveTab] = useState('absensi'); // 'absensi' | 'nilai' | 'jurnal'
	const [loading, setLoading] = useState(true);

	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('Semua');
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Data
	const [rekapAbsensi, setRekapAbsensi] = useState([]);
	const [rekapNilai, setRekapNilai] = useState([]);
	const [rekapJurnal, setRekapJurnal] = useState([]);

	const todayStr = useMemo(() => getTodayDateString(), []);

	useEffect(() => {
		const fetchInitial = async () => {
			try {
				setLoading(true);
				const supabase = createClient();
				const [resKelas, resMapel, resProfile] = await Promise.all([
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				const kData = resKelas.data || [];
				setKelasList(kData);
				if (kData.length > 0) {
					setSelectedKelas((prev) => prev || kData[0].nama_kelas);
				}
				setMapelList(resMapel.data || []);

				if (resProfile && resProfile.ok) {
					const pData = await resProfile.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Initial fetch error:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchInitial();
	}, []);

	// Fetch Rekap Data whenever selectedKelas or activeTab changes
	useEffect(() => {
		if (!selectedKelas) return;

		const fetchRekap = async () => {
			try {
				const supabase = createClient();

				if (activeTab === 'absensi') {
					// 1. Ambil siswa aktif di kelas
					const { data: siswaData } = await supabase
						.from('siswa')
						.select('id, nis, nama_lengkap')
						.eq('kelas', selectedKelas)
						.eq('status', 'Aktif')
						.order('nama_lengkap', { ascending: true });

					// 2. Ambil sesi absensi harian kelas
					const { data: sessions } = await supabase
						.from('absensi_harian')
						.select('sesi_id, tanggal')
						.eq('kelas', selectedKelas);

					const sesiIds = (sessions || []).map((s) => s.sesi_id);
					let details = [];
					if (sesiIds.length > 0) {
						const { data: detData } = await supabase
							.from('absensi_harian_siswa')
							.select('sesi_id, siswa_id, status')
							.in('sesi_id', sesiIds);
						details = detData || [];
					}

					const mapped = (siswaData || []).map((s) => {
						const sDetails = details.filter((d) => String(d.siswa_id) === String(s.id));
						let hadir = 0;
						let sakit = 0;
						let izin = 0;
						let alfa = 0;

						sDetails.forEach((d) => {
							const st = normStatus(d.status);
							if (st === 'hadir') hadir++;
							else if (st === 'sakit') sakit++;
							else if (st === 'izin') izin++;
							else if (st === 'alfa') alfa++;
						});

						return {
							nama_lengkap: s.nama_lengkap,
							nis: s.nis,
							hadir,
							sakit,
							izin,
							alfa,
						};
					});

					setRekapAbsensi(mapped);
				} else if (activeTab === 'nilai') {
					// 1. Ambil siswa aktif
					const { data: siswaData } = await supabase
						.from('siswa')
						.select('id, nis, nama_lengkap')
						.eq('kelas', selectedKelas)
						.eq('status', 'Aktif')
						.order('nama_lengkap', { ascending: true });

					// 2. Ambil tugas nilai untuk kelas ini
					const { data: tasks } = await supabase
						.from('nilai_tugas')
						.select('tugas_id, kategori, type, mapel, tanggal')
						.eq('kelas', selectedKelas);

					const tugasIds = (tasks || []).map((t) => t.tugas_id);
					let allNilai = [];
					if (tugasIds.length > 0) {
						const { data: nData } = await supabase
							.from('nilai_siswa')
							.select('tugas_id, siswa_id, nilai')
							.in('tugas_id', tugasIds);
						allNilai = nData || [];
					}

					const taskMap = {};
					(tasks || []).forEach((t) => {
						taskMap[t.tugas_id] = t;
					});

					const mapped = (siswaData || []).map((s) => {
						const studentScores = allNilai.filter((n) => String(n.siswa_id) === String(s.id));
						let tugasScores = [];
						let utsScores = [];
						let uasScores = [];
						let allScores = [];

						studentScores.forEach((n) => {
							const val = parseFloat(n.nilai);
							if (!isNaN(val)) {
								allScores.push(val);
								const t = taskMap[n.tugas_id];
								const typeLower = (t?.type || '').toLowerCase();
								const titleLower = (t?.kategori || '').toLowerCase();

								if (
									typeLower === 'formatif' ||
									typeLower === 'harian' ||
									titleLower.includes('formatif') ||
									titleLower.includes('tugas')
								) {
									tugasScores.push(val);
								} else if (
									typeLower === 'sumatif' ||
									typeLower === 'pts' ||
									typeLower === 'uts' ||
									typeLower === 'sts' ||
									titleLower.includes('sts') ||
									titleLower.includes('uts') ||
									titleLower.includes('pts')
								) {
									utsScores.push(val);
								} else if (
									typeLower === 'sas' ||
									typeLower === 'uas' ||
									typeLower === 'pas' ||
									titleLower.includes('sas') ||
									titleLower.includes('pas') ||
									titleLower.includes('uas')
								) {
									uasScores.push(val);
								}
							}
						});

						const avgAll = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '-';
						const avgTugas = tugasScores.length > 0 ? (tugasScores.reduce((a, b) => a + b, 0) / tugasScores.length).toFixed(1) : '-';
						const avgUts = utsScores.length > 0 ? (utsScores.reduce((a, b) => a + b, 0) / utsScores.length).toFixed(1) : '-';
						const avgUas = uasScores.length > 0 ? (uasScores.reduce((a, b) => a + b, 0) / uasScores.length).toFixed(1) : '-';

						return {
							nama_siswa: s.nama_lengkap,
							mapel: 'Semua Mapel',
							nilai_tugas: avgTugas,
							nilai_uts: avgUts,
							nilai_uas: avgUas,
							nilai_akhir: avgAll,
						};
					});

					setRekapNilai(mapped);
				} else if (activeTab === 'jurnal') {
					const { data: journals } = await supabase
						.from('jurnal')
						.select('*, users!jurnal_guru_id_fkey(nama_lengkap, username)')
						.eq('kelas', selectedKelas)
						.order('tanggal', { ascending: false });

					setRekapJurnal(journals || []);
				}
			} catch (err) {
				console.error('Error fetching rekap data:', err);
			}
		};

		fetchRekap();
	}, [selectedKelas, activeTab]);

	// Cetak PDF Laporan
	const handlePrintPDF = () => {
		try {
			const doc = new jsPDF('portrait');
			drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			const title =
				activeTab === 'absensi'
					? `REKAPITULASI PRESENSI SISWA - KELAS ${selectedKelas}`
					: activeTab === 'nilai'
					? `REKAPITULASI PENILAIAN AKADEMIK - KELAS ${selectedKelas}`
					: `REKAPITULASI JURNAL KBM - KELAS ${selectedKelas}`;
			doc.text(title, 105, 48, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.text(`Tahun Ajaran: ${tahunAjarAktif || '2026/2027'} | Semester: ${semesterAktif || '1'} | Tanggal Cetak: ${todayStr}`, 105, 54, { align: 'center' });

			if (activeTab === 'absensi') {
				const body = (Array.isArray(rekapAbsensi) ? rekapAbsensi : []).map((s, idx) => [
					idx + 1,
					s.nama_lengkap || s.nama || '-',
					s.hadir || 0,
					s.sakit || 0,
					s.izin || 0,
					s.alfa || s.alpa || 0,
				]);

				autoTable(doc, {
					startY: 60,
					head: [['No', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alfa']],
					body,
					theme: 'grid',
					headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
					styles: { fontSize: 8 },
				});
			} else if (activeTab === 'nilai') {
				const body = (Array.isArray(rekapNilai) ? rekapNilai : []).map((s, idx) => [
					idx + 1,
					s.nama_siswa || s.nama || '-',
					s.mapel || '-',
					s.nilai_tugas || '-',
					s.nilai_uts || '-',
					s.nilai_uas || '-',
					s.nilai_akhir || '-',
				]);

				autoTable(doc, {
					startY: 60,
					head: [['No', 'Nama Siswa', 'Mata Pelajaran', 'Tugas', 'UTS/PTS', 'UAS/SAS', 'Nilai Akhir']],
					body,
					theme: 'grid',
					headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
					styles: { fontSize: 8 },
				});
			} else {
				const body = (Array.isArray(rekapJurnal) ? rekapJurnal : []).map((j, idx) => [
					idx + 1,
					j.tanggal || '-',
					j.users?.nama_lengkap || 'Guru',
					j.mapel || '-',
					j.materi || '-',
					j.tuntas ? 'Tuntas' : 'Belum',
				]);

				autoTable(doc, {
					startY: 60,
					head: [['No', 'Tanggal', 'Guru', 'Mapel', 'Materi', 'Status']],
					body,
					theme: 'grid',
					headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
					styles: { fontSize: 8 },
				});
			}

			doc.save(`Laporan_Kurikulum_${activeTab}_${selectedKelas}.pdf`);
			Swal.fire('Berhasil!', 'Dokumen laporan PDF berhasil diunduh.', 'success');
		} catch (err) {
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	if (loading) return <Loader text='Memuat Laporan Akademik...' />;

	return (
		<div className='space-y-6'>
			{/* HEADER */}
			<div className='bg-amber-300 border-3 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
				<div>
					<div className='flex items-center gap-2 mb-1'>
						<span className='px-2 py-0.5 bg-black text-amber-300 text-[10px] font-black uppercase rounded'>
							Supervisi & Evaluasi
						</span>
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2'>
						<span>📑</span> Laporan Akademik KBM
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl'>
						Penerbitan rekapitulasi presensi, rekap nilai, dan bukti KBM resmi siap cetak berformat PDF dengan Kop Surat Sekolah.
					</p>
				</div>
				<div className='flex items-center gap-3 shrink-0'>
					<AcademicPeriodChip />
					<button
						onClick={handlePrintPDF}
						className='px-4 py-2.5 bg-black text-white hover:bg-neutral-800 font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#FFFFFF] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5'>
						<span>🖨️</span> Cetak PDF Resmi
					</button>
				</div>
			</div>

			{/* TAB & KELAS SELECTOR */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-center justify-between gap-4'>
				<div className='bg-[#FEF08A] p-1 border-2 border-black rounded-xl flex items-center shadow-[2px_2px_0px_0px_#0D0D0D] w-full md:w-auto overflow-x-auto'>
					<button
						onClick={() => setActiveTab('absensi')}
						className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${
							activeTab === 'absensi' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						📅 Rekap Presensi
					</button>
					<button
						onClick={() => setActiveTab('nilai')}
						className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${
							activeTab === 'nilai' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						📊 Rekap Nilai
					</button>
					<button
						onClick={() => setActiveTab('jurnal')}
						className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-all ${
							activeTab === 'jurnal' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						📖 Bukti KBM Jurnal
					</button>
				</div>

				<div className='flex items-center gap-2 w-full md:w-auto'>
					<label className='text-xs font-black uppercase shrink-0'>Pilih Rombel:</label>
					<select
						value={selectedKelas}
						onChange={(e) => setSelectedKelas(e.target.value)}
						className='px-3.5 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0] focus:outline-none'>
						{kelasList.map((k) => (
							<option key={k.id} value={k.nama_kelas}>
								{k.nama_kelas}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* TAB CONTENT TABLE */}
			<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='flex items-center justify-between border-b-2 border-black pb-3'>
					<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
						<span>📋</span> Laporan {activeTab.toUpperCase()} - Kelas {selectedKelas}
					</h2>
				</div>

				{activeTab === 'absensi' && (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
									<th className='py-3 px-3'>No</th>
									<th className='py-3 px-3'>Nama Siswa</th>
									<th className='py-3 px-3 text-center'>Hadir</th>
									<th className='py-3 px-3 text-center'>Sakit</th>
									<th className='py-3 px-3 text-center'>Izin</th>
									<th className='py-3 px-3 text-center'>Alfa</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{rekapAbsensi.length === 0 ? (
									<tr>
										<td colSpan={6} className='text-center py-8 text-gray-500'>
											Belum ada rekap presensi untuk kelas {selectedKelas}.
										</td>
									</tr>
								) : (
									rekapAbsensi.map((s, idx) => (
										<tr key={idx} className='hover:bg-amber-50/60'>
											<td className='py-2.5 px-3 font-mono'>{idx + 1}</td>
											<td className='py-2.5 px-3 font-black text-black'>{s.nama_lengkap || s.nama}</td>
											<td className='py-2.5 px-3 text-center font-mono'>{s.hadir || 0}</td>
											<td className='py-2.5 px-3 text-center font-mono text-amber-700'>{s.sakit || 0}</td>
											<td className='py-2.5 px-3 text-center font-mono text-sky-700'>{s.izin || 0}</td>
											<td className='py-2.5 px-3 text-center font-mono text-rose-600 font-black'>{s.alfa || s.alpa || 0}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{activeTab === 'nilai' && (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
									<th className='py-3 px-3'>No</th>
									<th className='py-3 px-3'>Nama Siswa</th>
									<th className='py-3 px-3'>Mata Pelajaran</th>
									<th className='py-3 px-3 text-center'>Tugas</th>
									<th className='py-3 px-3 text-center'>PTS/UTS</th>
									<th className='py-3 px-3 text-center'>PAS/SAS</th>
									<th className='py-3 px-3 text-center bg-yellow-200'>Nilai Akhir</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{rekapNilai.length === 0 ? (
									<tr>
										<td colSpan={7} className='text-center py-8 text-gray-500'>
											Belum ada rekap nilai akademik untuk kelas {selectedKelas}.
										</td>
									</tr>
								) : (
									rekapNilai.map((s, idx) => (
										<tr key={idx} className='hover:bg-amber-50/60'>
											<td className='py-2.5 px-3 font-mono'>{idx + 1}</td>
											<td className='py-2.5 px-3 font-black text-black'>{s.nama_siswa || s.nama}</td>
											<td className='py-2.5 px-3'>{s.mapel || '-'}</td>
											<td className='py-2.5 px-3 text-center font-mono'>{s.nilai_tugas || '-'}</td>
											<td className='py-2.5 px-3 text-center font-mono'>{s.nilai_uts || '-'}</td>
											<td className='py-2.5 px-3 text-center font-mono'>{s.nilai_uas || '-'}</td>
											<td className='py-2.5 px-3 text-center font-mono font-black bg-yellow-100'>{s.nilai_akhir || '-'}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{activeTab === 'jurnal' && (
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse'>
							<thead>
								<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
									<th className='py-3 px-3'>No</th>
									<th className='py-3 px-3'>Tanggal</th>
									<th className='py-3 px-3'>Guru Pengampu</th>
									<th className='py-3 px-3'>Mapel</th>
									<th className='py-3 px-3'>Materi Pembelajaran</th>
									<th className='py-3 px-3 text-center'>Status</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
								{rekapJurnal.length === 0 ? (
									<tr>
										<td colSpan={6} className='text-center py-8 text-gray-500'>
											Belum ada riwayat jurnal KBM di kelas {selectedKelas}.
										</td>
									</tr>
								) : (
									rekapJurnal.map((j, idx) => (
										<tr key={idx} className='hover:bg-amber-50/60'>
											<td className='py-2.5 px-3 font-mono'>{idx + 1}</td>
											<td className='py-2.5 px-3 font-mono'>{j.tanggal}</td>
											<td className='py-2.5 px-3 font-black text-black'>{j.users?.nama_lengkap || 'Guru'}</td>
											<td className='py-2.5 px-3'>{j.mapel}</td>
											<td className='py-2.5 px-3 max-w-xs truncate'>{j.materi || '-'}</td>
											<td className='py-2.5 px-3 text-center'>
												<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${j.tuntas ? 'bg-emerald-200 text-emerald-950' : 'bg-yellow-200 text-yellow-950'}`}>
													{j.tuntas ? 'Tuntas' : 'Belum'}
												</span>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
