'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from '@/app/components/loading';
import { createClient } from '@/utils/supabase/client';
import { useAcademic } from '@/context/AcademicContext';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_PROFIL_SEKOLAH, drawKopSuratPDF } from '@/lib/pdfKopSurat';
import AcademicPeriodChip from '@/app/components/AcademicPeriodChip';

export default function KurikulumPenilaianPage() {
	const { tahunAjarAktif, semesterAktif } = useAcademic();
	const [tasks, setTasks] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [loading, setLoading] = useState(true);

	const [activeTab, setActiveTab] = useState('tugas'); // 'tugas' | 'leger'
	const [filterKelas, setFilterKelas] = useState('');
	const [filterMapel, setFilterMapel] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		const fetchPenilaianData = async () => {
			try {
				setLoading(true);
				const supabase = createClient();

				const [resTasks, resKelas, resMapel, resSiswa, resProfil] = await Promise.all([
					supabase
						.from('nilai_tugas')
						.select('*, users!nilai_tugas_guru_id_fkey(nama_lengkap, username), nilai_siswa(id, nilai, siswa_id, nama_siswa)')
						.order('tanggal', { ascending: false }),
					supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
					supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true }),
					supabase.from('siswa').select('id, nama_lengkap, nis, kelas, status').eq('status', 'Aktif').order('nama_lengkap', { ascending: true }),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				setTasks(resTasks.data || []);
				const kData = resKelas.data || [];
				setKelasList(kData);
				if (kData.length > 0) {
					setFilterKelas((prev) => prev || kData[0].nama_kelas);
				}
				setMapelList(resMapel.data || []);
				setSiswaList(resSiswa.data || []);

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Gagal memuat rekap nilai:', err);
				Swal.fire('Terjadi Kesalahan', 'Gagal memuat data penilaian.', 'error');
			} finally {
				setLoading(false);
			}
		};

		fetchPenilaianData();
	}, []);

	// Filter tasks list
	const filteredTasks = useMemo(() => {
		return tasks.filter((t) => {
			const matchKelas = !filterKelas || filterKelas === 'Semua' || t.kelas === filterKelas;
			const matchMapel = filterMapel === 'Semua' || t.mapel === filterMapel;
			const q = searchQuery.toLowerCase();
			const matchQuery =
				t.judul_tugas?.toLowerCase().includes(q) ||
				t.mapel?.toLowerCase().includes(q) ||
				t.users?.nama_lengkap?.toLowerCase().includes(q);
			return matchKelas && matchMapel && matchQuery;
		});
	}, [tasks, filterKelas, filterMapel, searchQuery]);

	// Leger Nilai Data Generation untuk kelas yang dipilih
	const legerData = useMemo(() => {
		if (!filterKelas || filterKelas === 'Semua') return [];
		const siswaInKelas = siswaList.filter((s) => s.kelas === filterKelas);

		return siswaInKelas.map((siswa, idx) => {
			const nilaiPerMapel = {};
			let totalNilai = 0;
			let mapelCount = 0;

			mapelList.forEach((m) => {
				// Cari tugas mapel ini di kelas ini
				const relevantTasks = tasks.filter((t) => t.kelas === filterKelas && t.mapel === m.mapel);
				const scores = [];

				relevantTasks.forEach((t) => {
					const scoreObj = (t.nilai_siswa || []).find((ns) => ns.siswa_id === siswa.id || ns.nama_siswa === siswa.nama_lengkap);
					if (scoreObj && scoreObj.nilai !== null && scoreObj.nilai !== undefined) {
						scores.push(Number(scoreObj.nilai));
					}
				});

				if (scores.length > 0) {
					const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
					nilaiPerMapel[m.mapel] = avg;
					totalNilai += avg;
					mapelCount += 1;
				} else {
					nilaiPerMapel[m.mapel] = '-';
				}
			});

			const rataRata = mapelCount > 0 ? (totalNilai / mapelCount).toFixed(1) : '-';

			return {
				no: idx + 1,
				nama: siswa.nama_lengkap,
				nis: siswa.nis || '-',
				nilaiPerMapel,
				rataRata,
			};
		});
	}, [filterKelas, siswaList, mapelList, tasks]);

	// Ekspor Leger ke Excel
	const exportLegerExcel = () => {
		try {
			const exportRows = legerData.map((row) => {
				const res = {
					No: row.no,
					NIS: row.nis,
					'Nama Siswa': row.nama,
				};
				mapelList.forEach((m) => {
					res[m.mapel] = row.nilaiPerMapel[m.mapel];
				});
				res['Rata-Rata'] = row.rataRata;
				return res;
			});

			const ws = XLSX.utils.json_to_sheet(exportRows);
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, `Leger_${filterKelas}`);
			XLSX.writeFile(wb, `Leger_Nilai_${filterKelas}_${tahunAjarAktif || '2026-2027'}.xlsx`);

			Swal.fire('Berhasil!', 'Leger nilai berhasil diekspor ke Excel.', 'success');
		} catch (err) {
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	// Ekspor Leger ke PDF
	const exportLegerPDF = () => {
		try {
			const doc = new jsPDF('landscape');
			drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(13);
			doc.text(`LEGER NILAI HASIL BELAJAR SISWA - KELAS ${filterKelas.toUpperCase()}`, 148, 48, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(10);
			doc.text(`Tahun Ajaran: ${tahunAjarAktif || '2026/2027'} | Semester: ${semesterAktif || '1'} | KKM/KKTP: 75.00`, 148, 54, { align: 'center' });

			const head = [['No', 'NIS', 'Nama Siswa', ...mapelList.map((m) => m.mapel), 'Rata2']];
			const body = legerData.map((row) => [
				row.no,
				row.nis,
				row.nama,
				...mapelList.map((m) => row.nilaiPerMapel[m.mapel]),
				row.rataRata,
			]);

			autoTable(doc, {
				startY: 60,
				head,
				body,
				theme: 'grid',
				headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
				styles: { fontSize: 7, cellPadding: 1.5 },
			});

			doc.save(`Leger_Nilai_${filterKelas}_PDF.pdf`);
			Swal.fire('Berhasil!', 'Leger nilai PDF berhasil diunduh.', 'success');
		} catch (err) {
			Swal.fire('Gagal Ekspor', err.message, 'error');
		}
	};

	if (loading) return <Loader text='Memuat Rekapitulasi & Leger Nilai...' />;

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
						<span>📊</span> Rekapitulasi & Leger Nilai
					</h1>
					<p className='text-xs sm:text-sm font-bold text-black/80 mt-1 max-w-2xl'>
						Pemeriksaan kepatuhan setor nilai guru, capaian ketuntasan belajar (KKTP), dan penerbitan matriks Leger Nilai kelas.
					</p>
				</div>
				<div className='flex items-center gap-3 shrink-0'>
					<AcademicPeriodChip />
				</div>
			</div>

			{/* TAB SWITCHER */}
			<div className='bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-center justify-between gap-4'>
				<div className='bg-[#FEF08A] p-1 border-2 border-black rounded-xl flex items-center shadow-[2px_2px_0px_0px_#0D0D0D] w-full sm:w-auto'>
					<button
						onClick={() => setActiveTab('tugas')}
						className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
							activeTab === 'tugas' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						📝 Monitoring Entri Nilai Guru
					</button>
					<button
						onClick={() => setActiveTab('leger')}
						className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
							activeTab === 'leger' ? 'bg-black text-white' : 'text-black hover:bg-yellow-200'
						}`}>
						📑 Matriks Leger Nilai Rombel
					</button>
				</div>

				<div className='flex items-center gap-2 w-full sm:w-auto'>
					<label className='text-xs font-black uppercase shrink-0'>Pilih Rombel:</label>
					<select
						value={filterKelas}
						onChange={(e) => setFilterKelas(e.target.value)}
						className='px-3.5 py-2 border-2 border-black rounded-xl text-xs font-bold bg-[#FFFDF0] focus:outline-none'>
						{activeTab === 'tugas' && <option value='Semua'>Semua Kelas</option>}
						{kelasList.map((k) => (
							<option key={k.id} value={k.nama_kelas}>
								{k.nama_kelas}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* TAB 1: MONITORING TUGAS & ENTRI NILAI GURU */}
			{activeTab === 'tugas' && (
				<div className='space-y-4'>
					<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='flex items-center justify-between border-b-2 border-black pb-3'>
							<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
								<span>📋</span> Daftar Penilaian & Tugas Masuk ({filteredTasks.length})
							</h2>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse'>
								<thead>
									<tr className='border-b-2 border-black bg-amber-100 text-[11px] font-black uppercase text-black'>
										<th className='py-3 px-3'>Tanggal</th>
										<th className='py-3 px-3'>Judul Penilaian</th>
										<th className='py-3 px-3'>Kelas / Mapel</th>
										<th className='py-3 px-3'>Guru Pengampu</th>
										<th className='py-3 px-3'>Siswa Dinilai</th>
										<th className='py-3 px-3'>Rata-Rata Nilai</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
									{filteredTasks.length === 0 ? (
										<tr>
											<td colSpan={6} className='text-center py-8 text-gray-500'>
												Belum ada penilaian yang tercatat untuk kelas ini.
											</td>
										</tr>
									) : (
										filteredTasks.map((t, idx) => {
											const scoredCount = (t.nilai_siswa || []).filter((ns) => ns.nilai !== null && ns.nilai !== undefined).length;
											const totalScores = (t.nilai_siswa || []).reduce((acc, curr) => acc + (Number(curr.nilai) || 0), 0);
											const avgScore = scoredCount > 0 ? (totalScores / scoredCount).toFixed(1) : '-';

											return (
												<tr key={t.tugas_id || t.id || idx} className='hover:bg-amber-50/60 transition-colors'>
													<td className='py-3 px-3 font-mono font-bold'>{t.tanggal}</td>
													<td className='py-3 px-3'>
														<span className='font-black text-black block'>{t.judul_tugas || t.kategori}</span>
														<span className='text-[10px] text-gray-500 uppercase font-mono'>{t.type ? `${t.type} • ` : ''}{t.kategori || 'Tugas'}</span>
													</td>
													<td className='py-3 px-3'>
														<span className='px-2 py-0.5 bg-sky-100 border border-sky-400 rounded text-sky-950 font-black inline-block mr-1'>
															{t.kelas}
														</span>
														<span className='px-2 py-0.5 bg-amber-100 border border-amber-400 rounded text-amber-950 font-black inline-block'>
															{t.mapel}
														</span>
													</td>
													<td className='py-3 px-3 font-black text-black'>
														{t.users?.nama_lengkap || 'Guru'}
													</td>
													<td className='py-3 px-3'>
														<span className='px-2.5 py-1 bg-yellow-200 border border-black rounded-lg text-xs font-black'>
															{scoredCount} Siswa
														</span>
													</td>
													<td className='py-3 px-3'>
														<span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${Number(avgScore) >= 75 ? 'bg-emerald-200 border-emerald-500 text-emerald-950' : 'bg-rose-200 border-rose-500 text-rose-950'}`}>
															{avgScore}
														</span>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* TAB 2: MATRIKS LEGER NILAI ROMBEL */}
			{activeTab === 'leger' && (
				<div className='space-y-4'>
					<div className='bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3'>
							<div>
								<h2 className='text-base sm:text-lg font-black flex items-center gap-2'>
									<span>📑</span> Leger Nilai Kelas {filterKelas} ({legerData.length} Santri/Siswa)
								</h2>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Kompilasi nilai akhir seluruh mata pelajaran dalam satu rombongan belajar.
								</p>
							</div>

							<div className='flex items-center gap-2'>
								<button
									onClick={exportLegerExcel}
									className='px-3.5 py-2 bg-emerald-300 hover:bg-emerald-400 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
									📊 Ekspor Excel
								</button>
								<button
									onClick={exportLegerPDF}
									className='px-3.5 py-2 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
									📄 Ekspor PDF
								</button>
							</div>
						</div>

						<div className='overflow-x-auto'>
							<table className='w-full text-left border-collapse'>
								<thead>
									<tr className='border-b-2 border-black bg-amber-100 text-[10px] font-black uppercase text-black'>
										<th className='py-3 px-2.5'>No</th>
										<th className='py-3 px-2.5'>NIS</th>
										<th className='py-3 px-2.5 min-w-[160px]'>Nama Siswa</th>
										{mapelList.map((m, mIdx) => (
											<th key={m.id || m.mapel || mIdx} className='py-3 px-2 text-center'>
												{m.mapel}
											</th>
										))}
										<th className='py-3 px-3 text-center bg-yellow-200 border-l-2 border-black'>
											Rata2
										</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-gray-100 text-xs font-bold'>
									{legerData.length === 0 ? (
										<tr>
											<td colSpan={mapelList.length + 4} className='text-center py-8 text-gray-500'>
												Tidak ada data siswa aktif di kelas {filterKelas}.
											</td>
										</tr>
									) : (
										legerData.map((row, rIdx) => (
											<tr key={row.nis || row.nama || rIdx} className='hover:bg-amber-50/60 transition-colors'>
												<td className='py-2.5 px-2.5 font-mono'>{row.no}</td>
												<td className='py-2.5 px-2.5 font-mono text-gray-500 text-[11px]'>{row.nis}</td>
												<td className='py-2.5 px-2.5 font-black text-black'>{row.nama}</td>
												{mapelList.map((m, mIdx) => {
													const score = row.nilaiPerMapel[m.mapel];
													const isBelow = score !== '-' && Number(score) < 75;
													return (
														<td
															key={m.id || m.mapel || mIdx}
															className={`py-2.5 px-2 text-center font-mono ${
																isBelow ? 'text-rose-600 font-black bg-rose-50' : 'text-gray-800'
															}`}>
															{score}
														</td>
													);
												})}
												<td className='py-2.5 px-3 text-center font-black bg-yellow-100 border-l-2 border-black'>
													{row.rataRata}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
