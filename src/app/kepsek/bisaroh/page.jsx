'use client';

import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	DEFAULT_PROFIL_SEKOLAH,
	fetchSchoolProfile,
	drawKopSuratPDF,
	KopSuratHtmlPreview,
} from '@/lib/pdfKopSurat';
import {
	formatRupiah,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
} from '@/lib/bisaroh';

export default function KepsekBisarohApprovalPage() {
	const [loading, setLoading] = useState(true);
	const [submissions, setSubmissions] = useState([]);
	const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);
	const [selectedSlip, setSelectedSlip] = useState(null);
	const [filterKategori, setFilterKategori] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [currentUser, setCurrentUser] = useState(null);
	const [savingAction, setSavingAction] = useState(false);

	// Load Submissions, User Profile, and Settings
	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resSub, resSettings, resUser, resProfil] = await Promise.all([
					fetch('/api/settings?key=bisaroh_submissions').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
					fetch('/api/auth/me').catch(() => ({ ok: false })),
					fetch('/api/settings?key=profil_sekolah').catch(() => ({ ok: false })),
				]);

				if (resSub.ok) {
					const data = await resSub.json();
					const subList = Array.isArray(data?.value) ? data.value : [];
					setSubmissions(subList);
					if (subList.length > 0) {
						setSelectedSubmissionId(subList[0].id);
					}
				}

				if (resSettings.ok) {
					const data = await resSettings.json();
					if (data?.value) {
						setSettings(normalizeBisarohSettings(data.value));
					}
				}

				if (resUser.ok) {
					const data = await resUser.json();
					setCurrentUser(data?.user || null);
				}

				if (resProfil && resProfil.ok) {
					const pData = await resProfil.json();
					if (pData?.value && typeof pData.value === 'object') {
						setSchoolProfile({ ...DEFAULT_PROFIL_SEKOLAH, ...pData.value });
					}
				}
			} catch (err) {
				console.error('Error load bisaroh submissions for kepsek:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Selected Active Submission
	const currentSubmission = useMemo(() => {
		if (!selectedSubmissionId) return submissions[0] || null;
		return submissions.find((s) => s.id === selectedSubmissionId) || submissions[0] || null;
	}, [submissions, selectedSubmissionId]);

	// Filtered items in selected submission
	const filteredItems = useMemo(() => {
		if (!currentSubmission?.rekap_data) return [];
		let list = currentSubmission.rekap_data;

		if (filterKategori === 'guru') {
			list = list.filter((item) => !item.isTendik && !item.isPimpinan && !item.isHybrid);
		} else if (filterKategori === 'struktural') {
			list = list.filter((item) => item.isHybrid || (item.jabatan && item.jabatan.kategori === 'pendidik_struktural'));
		} else if (filterKategori === 'tendik') {
			list = list.filter((item) => item.isTendik || (item.jabatan && item.jabatan.kategori === 'tendik'));
		} else if (filterKategori === 'pimpinan') {
			list = list.filter((item) => item.isPimpinan || item.guru?.role === 'Kepala Sekolah');
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(item) =>
					(item.guru?.nama_lengkap || '').toLowerCase().includes(q) ||
					(item.guru?.username || '').toLowerCase().includes(q) ||
					(item.tingkatan?.nama || '').toLowerCase().includes(q) ||
					(item.jabatan?.nama || '').toLowerCase().includes(q)
			);
		}

		return list;
	}, [currentSubmission, filterKategori, searchQuery]);

	// Save Updated Submissions List to Supabase
	const updateSubmissionsToDB = async (newList, successMessage) => {
		setSavingAction(true);
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: 'bisaroh_submissions',
					value: newList,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Gagal memperbarui status pengajuan.');
			}

			setSubmissions(newList);
			Swal.fire({
				icon: 'success',
				title: successMessage,
				confirmButtonColor: '#0D9488',
			});
		} catch (err) {
			console.error('Error update submission status:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSavingAction(false);
		}
	};

	// Aksi: Setujui (ACC) Pengajuan
	const handleApprove = () => {
		if (!currentSubmission) return;

		Swal.fire({
			title: 'Setujui Pengajuan Bisaroh Ini?',
			text: `Draf bisaroh periode ${currentSubmission.periode_mulai} s/d ${currentSubmission.periode_selesai} senilai ${formatRupiah(currentSubmission.total_bersih)} akan disahkan secara resmi oleh Kepala Sekolah.`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#059669',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Sahkan & Setujui (ACC)',
			cancelButtonText: 'Batal',
		}).then((res) => {
			if (res.isConfirmed) {
				const now = new Date().toISOString();
				const approverName = currentUser?.nama_lengkap || 'Kepala Sekolah';

				const updatedList = submissions.map((sub) =>
					sub.id === currentSubmission.id
						? {
								...sub,
								status: 'DISETUJUI',
								disetujui_pada: now,
								disetujui_oleh: approverName,
						  }
						: sub
				);

				updateSubmissionsToDB(updatedList, 'Pengajuan Bisaroh Berhasil Disahkan & Disetujui!');
			}
		});
	};

	// Aksi: Minta Revisi
	const handleRequestRevision = () => {
		if (!currentSubmission) return;

		Swal.fire({
			title: 'Minta Revisi ke Bendahara',
			text: 'Tuliskan catatan perbaikan yang perlu diperiksa atau disesuaikan oleh Bendahara:',
			input: 'textarea',
			inputPlaceholder: 'Contoh: Mohon tinjau kembali jam mengajar Bapak Ahmad...',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Kirim Catatan Revisi',
			cancelButtonText: 'Batal',
			inputValidator: (val) => {
				if (!val || !val.trim()) {
					return 'Catatan revisi wajib diisi agar Bendahara mengetahui apa yang perlu diperbaiki.';
				}
			},
		}).then((res) => {
			if (res.isConfirmed) {
				const updatedList = submissions.map((sub) =>
					sub.id === currentSubmission.id
						? {
								...sub,
								status: 'PERLU_REVISI',
								catatan_kepsek: res.value.trim(),
						  }
						: sub
				);

				updateSubmissionsToDB(updatedList, 'Pengajuan dikembalikan ke Bendahara untuk revisi.');
			}
		});
	};

	// Aksi: Buka Kembali Kunci / Batalkan ACC
	const handleReopen = () => {
		if (!currentSubmission) return;

		Swal.fire({
			title: 'Buka Kembali Pengajuan?',
			text: 'Status akan dikembalikan ke "Menunggu Persetujuan" sehingga Anda dapat mengubah tinjauan atau meminta revisi kembali.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#F59E0B',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Buka Kembali',
			cancelButtonText: 'Batal',
		}).then((res) => {
			if (res.isConfirmed) {
				const updatedList = submissions.map((sub) =>
					sub.id === currentSubmission.id
						? {
								...sub,
								status: 'MENUNGGU_PERSETUJUAN',
								disetujui_pada: null,
								disetujui_oleh: null,
						  }
						: sub
				);

				updateSubmissionsToDB(updatedList, 'Status pengajuan dikembalikan ke status Menunggu Persetujuan.');
			}
		});
	};

	// Ekspor Dokumen Resmi SPJ Bisaroh dengan Kop Surat Resmi
	const handleExportSPJPDF = () => {
		if (!currentSubmission || !currentSubmission.rekap_data || currentSubmission.rekap_data.length === 0) {
			Swal.fire('Info', 'Tidak ada data pengajuan untuk diekspor.', 'info');
			return;
		}

		try {
			const doc = new jsPDF({ orientation: 'landscape' });
			const endKop = drawKopSuratPDF(doc, schoolProfile);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(11);
			doc.setTextColor(15, 23, 42);
			doc.text('LEMBAR PENGESAHAN & REKAPITULASI BISAROH PEGAWAI', doc.internal.pageSize.getWidth() / 2, endKop + 2, { align: 'center' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			const statusLabel =
				currentSubmission.status === 'DISETUJUI'
					? 'DISETUJUI (ACC RESMI KEPALA SEKOLAH)'
					: currentSubmission.status === 'PERLU_REVISI'
					? 'PERLU REVISI'
					: 'MENUNGGU PERSETUJUAN (DRAFT)';

			doc.text(
				`Periode: ${currentSubmission.periode_mulai} s/d ${currentSubmission.periode_selesai}   |   Status: ${statusLabel}`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 6.5,
				{ align: 'center' }
			);

			const tableHead = [
				['No', 'Nama Pegawai', 'Jabatan / Tingkatan', 'Total JP', 'Hadir', 'Honor JP', 'Tunj. Pokok', 'Tunj. Tambahan', 'Bonus', 'Potongan', 'Total Bersih'],
			];

			const tableBody = currentSubmission.rekap_data.map((item, idx) => {
				const namaPegawai = item.guru?.nama_lengkap || '-';
				const jabatan = item.jabatan?.nama || (item.isTendik ? 'Tendik' : item.tingkatan?.nama || 'Guru');
				const jp = item.totalJP || 0;
				const hadir = item.totalHadir || 0;
				const honor = formatRupiah(item.honorMengajar || 0);
				const tunjPokok = formatRupiah(
					(item.gajiPokokJabatan || 0) +
					(item.tunjanganJabatan || 0) +
					(item.totalTunjanganPokok || 0) +
					(item.tunjanganWali || 0) +
					(item.tunjanganHadir || 0)
				);
				const tunjTambahan = formatRupiah(item.totalTunjanganTambahan || 0);
				const bonus = formatRupiah(item.bonusManual || 0);
				const pot = formatRupiah((item.totalPotonganTetap || 0) + (item.potonganManual || 0));
				const bersih = formatRupiah(item.totalBersih || 0);

				return [idx + 1, namaPegawai, jabatan, `${jp} JP`, `${hadir} hr`, honor, tunjPokok, tunjTambahan, bonus, pot, bersih];
			});

			// Baris total agregat
			tableBody.push([
				'',
				'TOTAL KESELURUHAN',
				`${currentSubmission.total_pegawai || currentSubmission.rekap_data.length} Pegawai`,
				`${currentSubmission.total_jp || 0} JP`,
				'-',
				formatRupiah(currentSubmission.total_honor_jp || 0),
				formatRupiah(
					(currentSubmission.total_gapok || 0) +
					(currentSubmission.total_tunjangan_jabatan || 0) +
					(currentSubmission.total_tunjangan_pokok || 0)
				),
				formatRupiah(currentSubmission.total_tunjangan_tambahan || 0),
				formatRupiah(currentSubmission.total_bonus || 0),
				formatRupiah(currentSubmission.total_potongan || 0),
				formatRupiah(currentSubmission.total_bersih || 0),
			]);

			autoTable(doc, {
				startY: endKop + 10,
				head: tableHead,
				body: tableBody,
				theme: 'grid',
				headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
				bodyStyles: { fontSize: 7, textColor: [15, 23, 42] },
				columnStyles: {
					0: { halign: 'center', cellWidth: 8 },
					1: { fontStyle: 'bold' },
					3: { halign: 'center' },
					4: { halign: 'center' },
					5: { halign: 'right' },
					6: { halign: 'right' },
					7: { halign: 'right' },
					8: { halign: 'right' },
					9: { halign: 'right' },
					10: { halign: 'right', fontStyle: 'bold' },
				},
				didParseCell: (data) => {
					if (data.row.index === tableBody.length - 1) {
						data.cell.styles.fontStyle = 'bold';
						data.cell.styles.fillColor = [224, 231, 255];
					}
				},
			});

			// Kolom Tanda Tangan
			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 7;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			if (finalY + 30 <= pageHeight) {
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				doc.text(
					`Diajukan oleh,\nBendahara Keuangan\n\n\n\n${currentSubmission.diajukan_oleh || 'Bendahara Sekolah'}`,
					20,
					finalY
				);

				const kepsekName = currentSubmission.disetujui_oleh || schoolProfile.nama_kepsek || 'Kepala Sekolah';
				const kepsekNip = schoolProfile.nip_kepsek ? `\nNIP. ${schoolProfile.nip_kepsek}` : '';
				doc.text(
					`Disetujui & Disahkan oleh,\nKepala Sekolah\n\n\n\n${kepsekName}${kepsekNip}`,
					pageWidth - 75,
					finalY
				);
			}

			doc.save(`SPJ_Bisaroh_${currentSubmission.periode_mulai}_sd_${currentSubmission.periode_selesai}.pdf`);
		} catch (err) {
			console.error('Gagal export SPJ PDF:', err);
			Swal.fire('Gagal Ekspor PDF', err.message, 'error');
		}
	};

	// Cetak Lembar Pengesahan Resmi
	const handlePrintPengesahan = () => {
		window.print();
	};

	if (loading) {
		return (
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center font-bold text-gray-500 text-sm'>
				Memuat daftar pengajuan bisaroh dari bendahara...
			</div>
		);
	}

	return (
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20'>
			{/* Page Header Banner */}
			<div className='bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div>
					<div className='inline-flex items-center gap-2 px-3 py-1 bg-indigo-300 border-2 border-black rounded-full text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] mb-2'>
						<span>🏛️</span> Supervisi Keuangan & Bisaroh
					</div>
					<h1 className='text-2xl sm:text-3xl font-black text-black tracking-tight'>
						Validasi & Pengesahan Bisaroh
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Persetujuan resmi anggaran bisaroh, kompensasi jam mengajar riil, tunjangan, dan berita acara SPJ.
					</p>
				</div>

				{currentSubmission && (
					<div className='flex items-center gap-2 shrink-0'>
						<button
							onClick={handlePrintPengesahan}
							className='px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2'>
							<span>🖨️</span>
							<span>Cetak Berita Acara</span>
						</button>
					</div>
				)}
			</div>

			{/* Submissions Switcher Pills */}
			{submissions.length > 0 ? (
				<div className='bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3.5'>
					<p className='text-xs font-black uppercase text-gray-700'>
						Pilih Periode Pengajuan dari Bendahara:
					</p>
					<div className='flex flex-wrap items-center gap-2.5'>
						{submissions.map((sub) => {
							const isSelected = sub.id === currentSubmission?.id;
							const isApproved = sub.status === 'DISETUJUI';
							const isRevision = sub.status === 'PERLU_REVISI';

							return (
								<button
									key={sub.id}
									onClick={() => setSelectedSubmissionId(sub.id)}
									className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all border-2 border-black flex items-center gap-2 ${
										isSelected
											? 'bg-black text-white shadow-[3px_3px_0px_0px_#14B8A6] -translate-y-0.5'
											: 'bg-white text-black hover:bg-yellow-50 shadow-[2px_2px_0px_0px_#0D0D0D]'
									}`}>
									<span>{isApproved ? '✅' : isRevision ? '🔴' : '🟡'}</span>
									<span>
										Periode: {sub.periode_mulai} s/d {sub.periode_selesai}
									</span>
									<span
										className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
											isApproved
												? 'bg-emerald-200 text-emerald-950'
												: isRevision
												? 'bg-rose-200 text-rose-950'
												: 'bg-yellow-200 text-yellow-950'
										}`}>
										{isApproved ? 'Disetujui' : isRevision ? 'Revisi' : 'Menunggu'}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			) : (
				<div className='bg-white border-2 border-black rounded-2xl p-8 text-center shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
					<div className='w-12 h-12 bg-yellow-200 border-2 border-black rounded-2xl flex items-center justify-center text-xl mx-auto shadow-[2px_2px_0px_0px_#0D0D0D]'>
						📭
					</div>
					<h3 className='text-base font-black text-black uppercase'>Belum Ada Pengajuan Bisaroh</h3>
					<p className='text-xs font-bold text-gray-600 max-w-md mx-auto'>
						Saat ini Bendahara belum mengajukan draf rekapitulasi penggajian. Ketika Bendahara menekan tombol &ldquo;Ajukan ke Kepsek&rdquo;, draf akan otomatis muncul di halaman ini untuk diverifikasi.
					</p>
				</div>
			)}

			{/* Status & Approval Decision Action Banner */}
			{currentSubmission && (
				<div
					className={`border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0px_0px_#0D0D0D] transition-all space-y-4 ${
						currentSubmission.status === 'DISETUJUI'
							? 'bg-emerald-100'
							: currentSubmission.status === 'PERLU_REVISI'
							? 'bg-rose-100'
							: 'bg-yellow-100'
					}`}>
					<div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
						<div className='space-y-1.5'>
							<div className='flex items-center gap-2'>
								<span className='text-lg'>
									{currentSubmission.status === 'DISETUJUI'
										? '✅'
										: currentSubmission.status === 'PERLU_REVISI'
										? '🔴'
										: '🟡'}
								</span>
								<h2 className='text-base font-black text-black uppercase tracking-tight'>
									{currentSubmission.status === 'DISETUJUI'
										? 'PENGESAHAN: Draf Bisaroh Telah Disetujui (ACC Resmi)'
										: currentSubmission.status === 'PERLU_REVISI'
										? 'STATUS: Dikembalikan ke Bendahara untuk Revisi'
										: 'STATUS: Menunggu Verifikasi & Persetujuan Kepala Sekolah'}
								</h2>
							</div>

							<p className='text-xs font-bold text-gray-700'>
								Diajukan oleh <strong>{currentSubmission.diajukan_oleh || 'Bendahara'}</strong> pada{' '}
								{new Date(currentSubmission.diajukan_pada).toLocaleDateString('id-ID', {
									weekday: 'long',
									day: 'numeric',
									month: 'long',
									year: 'numeric',
								})}
								.
								{currentSubmission.status === 'DISETUJUI' && (
									<>
										{' '}
										Disahkan oleh <strong>{currentSubmission.disetujui_oleh}</strong> pada{' '}
										{new Date(currentSubmission.disetujui_pada).toLocaleDateString('id-ID', {
											weekday: 'long',
											day: 'numeric',
											month: 'long',
											year: 'numeric',
										})}
										.
									</>
								)}
							</p>

							{currentSubmission.catatan_bendahara && (
								<p className='text-xs italic bg-white/70 p-2 border border-black/20 rounded-lg'>
									<strong>Pesan Bendahara:</strong> &ldquo;{currentSubmission.catatan_bendahara}&rdquo;
								</p>
							)}

							{currentSubmission.catatan_kepsek && currentSubmission.status === 'PERLU_REVISI' && (
								<p className='text-xs font-bold text-rose-900 bg-white/80 p-2 border border-rose-300 rounded-lg'>
									<strong>Catatan Revisi Kepsek:</strong> &ldquo;{currentSubmission.catatan_kepsek}&rdquo;
								</p>
							)}
						</div>

						{/* Action Buttons for Kepsek */}
						<div className='flex items-center gap-2.5 shrink-0 flex-wrap'>
							{currentSubmission.status === 'MENUNGGU_PERSETUJUAN' && (
								<>
									<button
										type='button'
										onClick={handleRequestRevision}
										disabled={savingAction}
										className='px-4 py-2.5 bg-rose-200 hover:bg-rose-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
										<span>📝</span>
										<span>Minta Revisi</span>
									</button>
									<button
										type='button'
										onClick={handleApprove}
										disabled={savingAction}
										className='px-5 py-2.5 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2'>
										<span>✅</span>
										<span>Setujui & Sahkan (ACC)</span>
									</button>
								</>
							)}

							{currentSubmission.status === 'DISETUJUI' && (
								<button
									type='button'
									onClick={handleReopen}
									disabled={savingAction}
									className='px-4 py-2 bg-yellow-200 hover:bg-yellow-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
									<span>🔄</span>
									<span>Buka Kunci Kembali</span>
								</button>
							)}

							{currentSubmission.status === 'PERLU_REVISI' && (
								<button
									type='button'
									onClick={handleApprove}
									disabled={savingAction}
									className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
									<span>✅</span>
									<span>Ubah Jadi Setujui</span>
								</button>
							)}

							<button
								type='button'
								onClick={handleExportSPJPDF}
								className='px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'
								title='Ekspor Lembar Pengesahan SPJ Bisaroh Lengkap Ber-Kop Surat Resmi'>
								<span>📥</span>
								<span>Ekspor PDF SPJ</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Summary KPI Cards of Selected Submission */}
			{currentSubmission && (
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
					<div className='bg-emerald-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-emerald-800'>Total Anggaran Bersih</p>
						<p className='text-xl sm:text-2xl font-black text-emerald-950 mt-1.5 font-mono'>
							{formatRupiah(currentSubmission.total_bersih)}
						</p>
						<p className='text-[10px] text-emerald-800 font-bold mt-1'>
							{currentSubmission.total_pegawai} Pegawai Penerima
						</p>
					</div>

					<div className='bg-yellow-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-yellow-800'>Gapok & Honor Mengajar</p>
						<p className='text-xl sm:text-2xl font-black text-black mt-1.5 font-mono'>
							{formatRupiah((currentSubmission.total_gapok || 0) + (currentSubmission.total_honor_jp || 0))}
						</p>
						<p className='text-[10px] text-gray-600 font-bold mt-1'>
							Gapok: {formatRupiah(currentSubmission.total_gapok || 0)} &bull; {currentSubmission.total_jp || 0} JP
						</p>
					</div>

					<div className='bg-purple-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-purple-800'>Tunjangan Struktural</p>
						<p className='text-xl sm:text-2xl font-black text-purple-950 mt-1.5 font-mono'>
							{formatRupiah(currentSubmission.total_tunjangan_jabatan || 0)}
						</p>
						<p className='text-[10px] text-purple-800 font-bold mt-1'>Jabatan & Tugas Tambahan</p>
					</div>

					<div className='bg-teal-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-teal-800'>Tunjangan Operasional</p>
						<p className='text-xl sm:text-2xl font-black text-teal-950 mt-1.5 font-mono'>
							{formatRupiah(
								(currentSubmission.total_tunjangan || 0) - (currentSubmission.total_tunjangan_jabatan || 0)
							)}
						</p>
						<p className='text-[10px] text-gray-600 font-bold mt-1'>Kehadiran, Wali, Tambahan</p>
					</div>

					<div className='bg-rose-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-rose-800'>Total Potongan</p>
						<p className='text-xl sm:text-2xl font-black text-rose-950 mt-1.5 font-mono'>
							-{formatRupiah(currentSubmission.total_potongan || 0)}
						</p>
						<p className='text-[10px] text-gray-600 font-bold mt-1'>Tetap & Insidental</p>
					</div>
				</div>
			)}

			{/* Filter Tabs & Search Bar */}
			{currentSubmission && (
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1'>
					<div className='flex flex-wrap items-center gap-2'>
						{[
							{ id: 'all', label: 'Semua', icon: '👥' },
							{ id: 'guru', label: 'Dewan Guru (JTM)', icon: '📚' },
							{ id: 'struktural', label: 'Guru + Jabatan', icon: '🏛️' },
							{ id: 'tendik', label: 'Tenaga Kependidikan', icon: '💼' },
							{ id: 'pimpinan', label: 'Pimpinan / Kepsek', icon: '👑' },
						].map((cat) => {
							const isActive = filterKategori === cat.id;
							return (
								<button
									key={cat.id}
									type='button'
									onClick={() => setFilterKategori(cat.id)}
									className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all border-2 border-black flex items-center gap-1.5 ${
										isActive
											? 'bg-yellow-300 text-black shadow-[2px_2px_0px_0px_#0D0D0D]'
											: 'bg-white text-gray-700 hover:bg-gray-100 shadow-[2px_2px_0px_0px_#0D0D0D]'
									}`}>
									<span>{cat.icon}</span>
									<span>{cat.label}</span>
								</button>
							);
						})}
					</div>

					<div className='w-full sm:w-72'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Cari nama atau jabatan...'
							className='neo-input !py-2 !px-3.5 text-xs font-bold'
						/>
					</div>
				</div>
			)}

			{/* Review Payroll Table */}
			{currentSubmission && (
				<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
					<div className='px-5 py-4 bg-amber-50 border-b-2 border-black flex items-center justify-between'>
						<div className='flex items-center gap-2.5'>
							<span className='w-7 h-7 rounded-lg bg-teal-300 border-2 border-black flex items-center justify-center text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
								📋
							</span>
							<span className='text-xs sm:text-sm font-black uppercase text-black tracking-tight'>
								Rincian Hak Finansial Pegawai ({filteredItems.length} Orang)
							</span>
						</div>
					</div>

					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[950px]'>
							<thead>
								<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='px-4 py-3.5 text-center w-12 whitespace-nowrap'>No</th>
									<th className='px-4 py-3.5 whitespace-nowrap'>Pegawai & Jabatan</th>
									<th className='px-4 py-3.5 text-center whitespace-nowrap'>JTM</th>
									<th className='px-4 py-3.5 text-right whitespace-nowrap'>Gaji / Honor JP</th>
									<th className='px-4 py-3.5 text-right whitespace-nowrap'>Tunj. Jabatan</th>
									<th className='px-4 py-3.5 text-right whitespace-nowrap'>Tunjangan Lain</th>
									<th className='px-4 py-3.5 text-right whitespace-nowrap'>Potongan</th>
									<th className='px-4 py-3.5 text-right whitespace-nowrap'>Bisaroh Bersih</th>
									<th className='px-4 py-3.5 text-center whitespace-nowrap'>Slip</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
								{filteredItems.length === 0 ? (
									<tr>
										<td colSpan={9} className='px-6 py-10 text-center text-gray-500 font-bold'>
											Tidak ada data pegawai yang sesuai filter.
										</td>
									</tr>
								) : (
									filteredItems.map((item, idx) => {
										const totalTunjLain =
											(item.totalTunjanganPokok !== undefined
												? item.totalTunjanganPokok
												: item.tunjanganWali + item.tunjanganHadir) +
											(item.totalTunjanganTambahan || 0);

										return (
											<tr key={item.guru?.id_user || idx} className='hover:bg-yellow-50/60 transition-colors'>
												<td className='px-4 py-3.5 text-center font-mono font-black text-gray-500 whitespace-nowrap'>
													{idx + 1}
												</td>
												<td className='px-4 py-3.5'>
													<div className='flex items-center gap-1.5 flex-wrap'>
														<span className='font-black text-black text-sm whitespace-nowrap'>
															{item.guru?.nama_lengkap}
														</span>
														{item.jabatan && (
															<span className='px-1.5 py-0.5 bg-purple-100 text-purple-950 border border-purple-800 rounded text-[9px] font-black uppercase whitespace-nowrap'>
																🏛️ {item.jabatan.nama}
															</span>
														)}
														{item.tingkatan && !item.isTendik && (
															<span className='px-1.5 py-0.5 bg-teal-100 text-teal-950 border border-teal-800 rounded text-[9px] font-black uppercase whitespace-nowrap'>
																{item.tingkatan.nama}
															</span>
														)}
													</div>
													<p className='text-[10px] text-gray-500 font-mono mt-0.5'>
														@{item.guru?.username} &bull; {item.isTendik ? 'Tendik' : `${formatRupiah(item.tarifJP)}/JP`}
													</p>
												</td>
												<td className='px-4 py-3.5 text-center whitespace-nowrap'>
													{item.isTendik ? (
														<span className='px-2.5 py-1 bg-gray-100 border border-gray-400 rounded-lg text-[10px] text-gray-600 font-bold'>
															Non-KBM
														</span>
													) : (
														<span className='inline-block whitespace-nowrap px-3 py-1 bg-yellow-200 border border-black rounded-lg font-black font-mono text-xs'>
															{item.totalJP} JP
														</span>
													)}
												</td>
												<td className='px-4 py-3.5 text-right whitespace-nowrap font-mono font-black text-black'>
													{formatRupiah((item.gajiPokokJabatan || 0) + item.honorMengajar)}
												</td>
												<td className='px-4 py-3.5 text-right whitespace-nowrap font-mono'>
													{item.tunjanganJabatan > 0 ? (
														<span className='text-purple-900 font-black'>
															+{formatRupiah(item.tunjanganJabatan)}
														</span>
													) : (
														<span className='text-gray-400'>-</span>
													)}
												</td>
												<td className='px-4 py-3.5 text-right whitespace-nowrap font-mono'>
													{totalTunjLain > 0 ? (
														<span className='text-teal-900 font-black'>
															+{formatRupiah(totalTunjLain)}
														</span>
													) : (
														<span className='text-gray-400'>-</span>
													)}
												</td>
												<td className='px-4 py-3.5 text-right whitespace-nowrap font-mono text-rose-800'>
													{item.totalPotongan > 0 ? `-${formatRupiah(item.totalPotongan)}` : '-'}
												</td>
												<td className='px-4 py-3.5 text-right whitespace-nowrap font-mono font-black text-sm text-emerald-950'>
													{formatRupiah(item.totalBersih)}
												</td>
												<td className='px-4 py-3.5 text-center whitespace-nowrap'>
													<button
														onClick={() => setSelectedSlip(item)}
														className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
														📄 Slip
													</button>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL PREVIEW SLIP GAJI DIGITAL                                */}
			{/* ============================================================== */}
			{selectedSlip && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-teal-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>Slip Bisaroh Pegawai</h3>
							<button
								onClick={() => setSelectedSlip(null)}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<div className='p-6 overflow-y-auto space-y-4'>
							{/* Kop Surat Sekolah Resmi */}
							<KopSuratHtmlPreview profil={schoolProfile} showBorder={true} />

							<div className='text-center border-b-2 border-black pb-2 mt-2'>
								<h2 className='text-base font-black uppercase tracking-tight text-black'>SLIP BISAROH & GAJI PEGAWAI</h2>
								<p className='text-[10px] font-mono text-gray-500 font-bold'>
									Periode Penggajian: {currentSubmission?.periode_mulai} s/d {currentSubmission?.periode_selesai}
								</p>
							</div>

							<div className='grid grid-cols-2 gap-2 text-xs border-b border-black/20 pb-3'>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Nama Pegawai:</span>
									<span className='font-black text-black text-sm block'>{selectedSlip.guru?.nama_lengkap}</span>
									<span className='text-[10px] text-gray-500'>@{selectedSlip.guru?.username}</span>
									{selectedSlip.jabatan && (
										<span className='mt-1 px-1.5 py-0.5 bg-purple-100 border border-purple-800 text-purple-950 font-black text-[9px] rounded uppercase block w-fit'>
											🏛️ {selectedSlip.jabatan.nama}
										</span>
									)}
								</div>
								<div className='text-right'>
									<span className='text-[10px] text-gray-500 font-bold block'>Tingkatan / Grade:</span>
									<span className='font-black text-black block'>
										{selectedSlip.isTendik ? 'Tendik' : selectedSlip.tingkatan?.nama || '-'}
									</span>
									{!selectedSlip.isTendik && (
										<span className='text-[10px] font-mono text-teal-800 font-bold'>
											Tarif: {formatRupiah(selectedSlip.tarifJP)}/JP
										</span>
									)}
								</div>
							</div>

							<div className='space-y-2 text-xs'>
								<p className='text-[11px] font-black uppercase tracking-wider text-gray-700'>
									Rincian Penerimaan:
								</p>
								{selectedSlip.gajiPokokJabatan > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
										<span className='font-bold text-purple-950'>Gaji Pokok Jabatan</span>
										<span className='font-mono font-bold'>{formatRupiah(selectedSlip.gajiPokokJabatan)}</span>
									</div>
								)}
								{(selectedSlip.honorMengajar > 0 || !selectedSlip.isTendik) && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
										<span>Honor Mengajar ({selectedSlip.totalJP} JP)</span>
										<span className='font-mono font-bold'>{formatRupiah(selectedSlip.honorMengajar)}</span>
									</div>
								)}
								{selectedSlip.tunjanganJabatan > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-purple-900'>
										<span>Tunjangan Jabatan</span>
										<span className='font-mono font-bold'>+{formatRupiah(selectedSlip.tunjanganJabatan)}</span>
									</div>
								)}
								{selectedSlip.rincianTunjanganPokok?.map((tp) => (
									<div key={tp.id} className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
										<span>{tp.nama}</span>
										<span className='font-mono font-bold'>{formatRupiah(tp.subtotal)}</span>
									</div>
								))}
								{selectedSlip.rincianTunjanganTambahan?.map((t) => (
									<div key={t.id} className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-teal-900'>
										<span>{t.nama}</span>
										<span className='font-mono font-bold'>+{formatRupiah(t.subtotal)}</span>
									</div>
								))}
								{selectedSlip.bonusManual > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-emerald-800'>
										<span>Bonus Insidental</span>
										<span className='font-mono font-bold'>+{formatRupiah(selectedSlip.bonusManual)}</span>
									</div>
								)}
								{selectedSlip.totalPotongan > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-rose-800'>
										<span>Total Potongan</span>
										<span className='font-mono font-bold'>-{formatRupiah(selectedSlip.totalPotongan)}</span>
									</div>
								)}
							</div>

							<div className='p-3 bg-teal-50 border-2 border-black rounded-xl flex items-center justify-between'>
								<div>
									<p className='text-[10px] font-black uppercase text-teal-800'>Total Diterima (Bersih):</p>
									<p className='text-xl font-black text-black font-mono'>{formatRupiah(selectedSlip.totalBersih)}</p>
								</div>
								<span
									className={`text-xs font-black px-2.5 py-1 border border-black rounded-lg ${
										currentSubmission?.status === 'DISETUJUI'
											? 'bg-emerald-300'
											: 'bg-yellow-300'
									}`}>
									{currentSubmission?.status === 'DISETUJUI' ? 'ACC KEPSEK' : 'DRAFT'}
								</span>
							</div>

							{/* Kolom Tanda Tangan Slip */}
							<div className='grid grid-cols-2 gap-4 text-center text-xs pt-3'>
								<div>
									<p className='text-[10px] text-gray-500'>Penerima Bisaroh,</p>
									<div className='h-10'></div>
									<p className='font-black border-t border-black/30 pt-1 text-[11px]'>{selectedSlip.guru?.nama_lengkap}</p>
								</div>
								<div>
									<p className='text-[10px] text-gray-500'>Disahkan oleh,</p>
									<div className='h-10'></div>
									<p className='font-black border-t border-black/30 pt-1 text-[11px]'>{currentSubmission?.disetujui_oleh || schoolProfile.nama_kepsek || 'Kepala Sekolah'}</p>
									{schoolProfile.nip_kepsek && (
										<p className='text-[9px] font-mono font-bold text-gray-500'>NIP. {schoolProfile.nip_kepsek}</p>
									)}
								</div>
							</div>
						</div>

						<div className='p-4 bg-gray-50 border-t-2 border-black flex justify-between items-center print:hidden'>
							<button
								type='button'
								onClick={() => window.print()}
								className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
								<span>🖨️</span>
								<span>Cetak Slip</span>
							</button>
							<button
								onClick={() => setSelectedSlip(null)}
								className='px-4 py-2 bg-black text-white border-2 border-black rounded-xl text-xs font-black uppercase hover:bg-gray-800'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
