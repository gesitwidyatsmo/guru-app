'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	parseJTM,
	formatRupiah,
	getDefaultCutOffRange,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
	calculateSingleGuruBisaroh,
} from '@/lib/bisaroh';
import Swal from 'sweetalert2';

export default function BendaharaBisarohPage() {
	const [loading, setLoading] = useState(true);
	const [users, setUsers] = useState([]);
	const [journals, setJournals] = useState([]);
	const [kelas, setKelas] = useState([]);
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);
	const [submissions, setSubmissions] = useState([]);
	const [currentUser, setCurrentUser] = useState(null);
	const [submittingAction, setSubmittingAction] = useState(false);

	// Date range state
	const defaultRange = getDefaultCutOffRange();
	const [startDate, setStartDate] = useState(defaultRange.startDate);
	const [endDate, setEndDate] = useState(defaultRange.endDate);
	const [searchQuery, setSearchQuery] = useState('');
	const [filterKategori, setFilterKategori] = useState('all'); // 'all' | 'guru' | 'struktural' | 'tendik' | 'pimpinan'
	const [modeTabel, setModeTabel] = useState('ringkas'); // 'ringkas' (pas layar tanpa gepeng) | 'rinci' (11 kolom horizontal)

	// Penyesuaian manual insidental per guru: { [id_user]: { bonus: 0, potongan: 0, catatan: '' } }
	const [adjustments, setAdjustments] = useState({});

	// Modal slip gaji
	const [selectedSlip, setSelectedSlip] = useState(null);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resUsers, resJurnal, resKelas, resSettings, resSubmissions, resMe] = await Promise.all([
					fetch('/api/users').catch(() => ({ ok: false })),
					fetch('/api/jurnal').catch(() => ({ ok: false })),
					fetch('/api/kelas').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
					fetch('/api/settings?key=bisaroh_submissions').catch(() => ({ ok: false })),
					fetch('/api/auth/me').catch(() => ({ ok: false })),
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

				if (resSettings.ok) {
					const data = await resSettings.json();
					if (data?.value) {
						setSettings(normalizeBisarohSettings(data.value));
					}
				}

				if (resSubmissions.ok) {
					const data = await resSubmissions.json();
					const subList = Array.isArray(data?.value) ? data.value : [];
					setSubmissions(subList);
				}

				if (resMe.ok) {
					const meData = await resMe.json();
					setCurrentUser(meData?.user || null);
				}
			} catch (err) {
				console.error('Error load bisaroh calculation data:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Seluruh pegawai yang berhak menerima penggajian:
	// Guru, Kepala Sekolah, maupun pegawai/staf yang memiliki penugasan jabatan struktural
	const eligiblePegawaiList = useMemo(() => {
		return users.filter((u) => {
			if (u.role === 'Guru') return true;
			if (u.role === 'Kepala Sekolah') return true;
			if (settings.user_jabatan_map && settings.user_jabatan_map[u.id_user]) return true;
			return false;
		});
	}, [users, settings]);

	// Set nama wali kelas
	const waliKelasNames = useMemo(() => {
		const names = new Set();
		kelas.forEach((k) => {
			if (k.wali_kelas) names.add(String(k.wali_kelas).trim().toLowerCase());
		});
		return names;
	}, [kelas]);

	// Filter jurnal sesuai tanggal cut-off
	const filteredJournals = useMemo(() => {
		return journals.filter((j) => {
			if (!j.tanggal) return false;
			if (startDate && j.tanggal < startDate) return false;
			if (endDate && j.tanggal > endDate) return false;
			return true;
		});
	}, [journals, startDate, endDate]);

	// Rekap & Perhitungan Bisaroh per Pegawai dengan Multi-Tier, Jabatan Struktural & Komponen Dinamis
	const bisarohList = useMemo(() => {
		const jpMap = {};
		const dateMap = {};

		filteredJournals.forEach((j) => {
			const gId = j.guru_id;
			if (!gId) return;
			const jp = parseJTM(j.jam_ke);
			jpMap[gId] = (jpMap[gId] || 0) + jp;

			if (!dateMap[gId]) dateMap[gId] = new Set();
			dateMap[gId].add(j.tanggal);
		});

		let list = eligiblePegawaiList.map((g) => {
			const isWali =
				waliKelasNames.has(String(g.nama_lengkap || '').trim().toLowerCase()) ||
				waliKelasNames.has(String(g.username || '').trim().toLowerCase());

			const totalJP = jpMap[g.id_user] || 0;
			const totalHadir = (dateMap[g.id_user] || new Set()).size;
			const manualAdj = adjustments[g.id_user] || { bonus: 0, potongan: 0, catatan: '' };

			return calculateSingleGuruBisaroh({
				guru: g,
				isWaliKelas: isWali,
				totalJP,
				totalHadir,
				settings,
				manualAdj,
			});
		});

		// Filter berdasarkan segmentasi kategori pegawai
		if (filterKategori === 'guru') {
			list = list.filter((item) => !item.isTendik && !item.isPimpinan && !item.isHybrid);
		} else if (filterKategori === 'struktural') {
			list = list.filter((item) => item.isHybrid || (item.jabatan && item.jabatan.kategori === 'pendidik_struktural'));
		} else if (filterKategori === 'tendik') {
			list = list.filter((item) => item.isTendik || (item.jabatan && item.jabatan.kategori === 'tendik'));
		} else if (filterKategori === 'pimpinan') {
			list = list.filter((item) => item.isPimpinan || item.guru.role === 'Kepala Sekolah');
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(item) =>
					(item.guru.nama_lengkap || '').toLowerCase().includes(q) ||
					(item.guru.username || '').toLowerCase().includes(q) ||
					(item.tingkatan?.nama || '').toLowerCase().includes(q) ||
					(item.jabatan?.nama || '').toLowerCase().includes(q)
			);
		}

		return list.sort((a, b) => b.totalBersih - a.totalBersih);
	}, [eligiblePegawaiList, filteredJournals, waliKelasNames, settings, adjustments, filterKategori, searchQuery]);

	// Akumulasi Total Keseluruhan
	const totals = useMemo(() => {
		return bisarohList.reduce(
			(acc, c) => ({
				totalBersih: acc.totalBersih + c.totalBersih,
				totalJP: acc.totalJP + c.totalJP,
				totalHonorMengajar: acc.totalHonorMengajar + c.honorMengajar,
				totalGajiPokokJabatan: acc.totalGajiPokokJabatan + (c.gajiPokokJabatan || 0),
				totalTunjanganJabatan: acc.totalTunjanganJabatan + (c.tunjanganJabatan || 0),
				totalTunjangan:
					acc.totalTunjangan +
					(c.tunjanganJabatan || 0) +
					(c.totalTunjanganPokok !== undefined ? c.totalTunjanganPokok : c.tunjanganWali + c.tunjanganHadir) +
					c.totalTunjanganTambahan,
				totalPotongan: acc.totalPotongan + c.totalPotongan,
			}),
			{
				totalBersih: 0,
				totalJP: 0,
				totalHonorMengajar: 0,
				totalGajiPokokJabatan: 0,
				totalTunjanganJabatan: 0,
				totalTunjangan: 0,
				totalPotongan: 0,
			}
		);
	}, [bisarohList]);

	// Handle Penyesuaian Manual
	const handleUpdateAdj = (id_user, field, value) => {
		setAdjustments((prev) => ({
			...prev,
			[id_user]: {
				...(prev[id_user] || { bonus: 0, potongan: 0, catatan: '' }),
				[field]: value,
			},
		}));
	};

	// Ekspor CSV SPJ
	// Ekspor CSV SPJ
	const handleExportCSV = () => {
		if (bisarohList.length === 0) return;

		const headers = [
			'No',
			'Nama Pegawai',
			'Username',
			'Peran Sistem',
			'Jabatan Struktural',
			'Kategori Jabatan',
			'Gaji Pokok Jabatan (Rp)',
			'Kategori Tingkatan',
			'Total JP',
			'Tarif per JP (Rp)',
			'Honor Mengajar (Rp)',
			'Tunj. Jabatan (Rp)',
			'Hari Hadir (Efektif)',
			'Tunj. Pokok / Hadir (Rp)',
			'Status Wali',
			'Tunj. Wali (Rp)',
			'Tunj. Tambahan (Rp)',
			'Bonus Manual (Rp)',
			'Potongan Tetap (Rp)',
			'Potongan Manual (Rp)',
			'Total Bisaroh Bersih (Rp)',
		];

		const rows = bisarohList.map((item, idx) => [
			idx + 1,
			`"${(item.guru.nama_lengkap || '').replace(/"/g, '""')}"`,
			`"${(item.guru.username || '').replace(/"/g, '""')}"`,
			`"${(item.guru.role || '').replace(/"/g, '""')}"`,
			`"${(item.jabatan?.nama || '-').replace(/"/g, '""')}"`,
			`"${(item.jabatan?.kategori || '-').replace(/"/g, '""')}"`,
			item.gajiPokokJabatan || 0,
			`"${(item.tingkatan?.nama || '').replace(/"/g, '""')}"`,
			item.totalJP,
			item.tarifJP,
			item.honorMengajar,
			item.tunjanganJabatan || 0,
			item.effectiveHadir !== undefined ? item.effectiveHadir : item.totalHadir,
			item.totalTunjanganPokok !== undefined ? item.totalTunjanganPokok : item.tunjanganHadir,
			item.isWaliKelas ? 'Ya' : 'Tidak',
			item.tunjanganWali,
			item.totalTunjanganTambahan,
			item.bonusManual,
			item.totalPotonganTetap,
			item.potonganManual,
			item.totalBersih,
		]);

		const csvContent =
			'data:text/csv;charset=utf-8,\uFEFF' +
			[headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `SPJ_Bisaroh_Komprehensif_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const handlePrint = () => {
		window.print();
	};

	// Submission aktif yang cocok dengan periode cut-off yang sedang dipilih
	const currentSubmission = useMemo(() => {
		return (
			submissions.find(
				(s) => s.periode_mulai === startDate && s.periode_selesai === endDate
			) || null
		);
	}, [submissions, startDate, endDate]);

	const submissionStatus = currentSubmission?.status || 'DRAFT';
	const isLocked = submissionStatus === 'MENUNGGU_PERSETUJUAN' || submissionStatus === 'DISETUJUI';

	const formatDateIndo = (isoString) => {
		if (!isoString) return '-';
		try {
			const d = new Date(isoString);
			return d.toLocaleDateString('id-ID', {
				weekday: 'long',
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch {
			return isoString;
		}
	};

	// Simpan perubahan pengajuan ke DB
	const saveSubmissionsToDB = async (newList) => {
		setSubmittingAction(true);
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
				throw new Error(data.error || 'Gagal menyimpan pengajuan ke database.');
			}

			setSubmissions(newList);
			return true;
		} catch (err) {
			console.error('Error save bisaroh submission:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
			return false;
		} finally {
			setSubmittingAction(false);
		}
	};

	// Handle Ajukan / Ajukan Ulang ke Kepsek
	const handleAjukan = async () => {
		if (bisarohList.length === 0) {
			Swal.fire('Data Kosong', 'Tidak ada data pegawai yang dapat diajukan untuk periode ini.', 'warning');
			return;
		}

		const isResubmit = currentSubmission?.status === 'PERLU_REVISI';

		const { value: catatan, isConfirmed } = await Swal.fire({
			title: isResubmit ? 'Ajukan Ulang Revisi Bisaroh?' : 'Ajukan Draf ke Kepala Sekolah?',
			html: `
				<div style="text-align: left; font-size: 13px; line-height: 1.5;">
					<p style="margin-bottom: 6px;"><strong>Periode Cut-Off:</strong> ${startDate} s/d ${endDate}</p>
					<p style="margin-bottom: 6px;"><strong>Jumlah Penerima:</strong> ${bisarohList.length} Pegawai</p>
					<p style="margin-bottom: 6px;"><strong>Total Bisaroh Bersih:</strong> <span style="font-weight: bold; color: #059669;">${formatRupiah(totals.totalBersih)}</span></p>
					<p style="margin-top: 10px; color: #4b5563;">Draf beserta rincian kalkulasi akan dikirimkan langsung ke portal Kepala Sekolah untuk ditinjau dan disetujui (ACC).</p>
				</div>
			`,
			input: 'textarea',
			inputPlaceholder: 'Tuliskan catatan untuk Kepala Sekolah (opsional)...',
			inputValue: currentSubmission?.catatan_bendahara || '',
			showCancelButton: true,
			confirmButtonColor: '#0D9488',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: isResubmit ? 'Ya, Kirim Revisi' : 'Ya, Ajukan Draf',
			cancelButtonText: 'Batal',
		});

		if (!isConfirmed) return;

		const subId = currentSubmission?.id || `sub_${startDate}_${endDate}_${Date.now()}`;
		const submissionPayload = {
			id: subId,
			periode_mulai: startDate,
			periode_selesai: endDate,
			total_bersih: totals.totalBersih,
			total_pegawai: bisarohList.length,
			total_jp: totals.totalJP,
			total_honor_jp: totals.totalHonorMengajar,
			total_gapok: totals.totalGajiPokokJabatan,
			total_tunjangan: totals.totalTunjangan,
			total_potongan: totals.totalPotongan,
			status: 'MENUNGGU_PERSETUJUAN',
			catatan_bendahara: catatan?.trim() || '',
			catatan_kepsek: '',
			diajukan_pada: new Date().toISOString(),
			diajukan_oleh: currentUser?.nama_lengkap || 'Bendahara',
			disetujui_pada: null,
			disetujui_oleh: null,
			rekap_data: bisarohList,
		};

		const otherSubmissions = submissions.filter(
			(s) => s.id !== subId && !(s.periode_mulai === startDate && s.periode_selesai === endDate)
		);
		const updatedList = [submissionPayload, ...otherSubmissions];

		const ok = await saveSubmissionsToDB(updatedList);
		if (ok) {
			Swal.fire({
				icon: 'success',
				title: 'Berhasil Diajukan!',
				text: `Draf bisaroh periode ${startDate} s/d ${endDate} senilai ${formatRupiah(totals.totalBersih)} telah dikirim ke portal Kepala Sekolah. Status sekarang: "Menunggu Persetujuan".`,
				confirmButtonColor: '#0D9488',
			});
		}
	};

	// Handle Batalkan Pengajuan (Tarik Kembali ke Draf)
	const handleBatalAjukan = async () => {
		if (!currentSubmission) return;

		const res = await Swal.fire({
			title: 'Batalkan Pengajuan?',
			text: 'Pengajuan akan ditarik kembali ke status Draf lokal sehingga Anda dapat melakukan koreksi data sebelum ditinjau Kepala Sekolah.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Batalkan Pengajuan',
			cancelButtonText: 'Kembali',
		});

		if (!res.isConfirmed) return;

		const updatedList = submissions.filter((s) => s.id !== currentSubmission.id);
		const ok = await saveSubmissionsToDB(updatedList);
		if (ok) {
			Swal.fire({
				icon: 'success',
				title: 'Pengajuan Dibatalkan',
				text: 'Status bisaroh kembali menjadi Draf lokal dan kunci edit telah dibuka.',
				confirmButtonColor: '#0D9488',
			});
		}
	};

	return (
		<div className='space-y-6'>
			{/* Header Title */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>💰</span>
						<span>Kalkulasi Bisaroh & Penggajian Guru</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Perhitungan komprehensif berbasis tingkatan tarif (Senior/Junior), jam tatap muka riil, tunjangan dinamis, dan potongan.
					</p>
				</div>

				<div className='flex items-center gap-2 shrink-0'>
					<button
						onClick={handleExportCSV}
						className='px-3.5 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
						<span>📥</span>
						<span>Ekspor SPJ</span>
					</button>

					{submissionStatus === 'MENUNGGU_PERSETUJUAN' ? (
						<div className='flex items-center gap-2'>
							<button
								onClick={handleBatalAjukan}
								disabled={submittingAction}
								className='px-3 py-2 bg-rose-200 hover:bg-rose-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 text-rose-950'>
								<span>↩️</span>
								<span>Batal Ajukan</span>
							</button>
							<span className='px-3.5 py-2 bg-amber-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
								<span className='animate-pulse text-sm'>⏳</span>
								<span>Menunggu ACC Kepsek</span>
							</span>
						</div>
					) : submissionStatus === 'DISETUJUI' ? (
						<div className='flex items-center gap-2'>
							<span className='px-3.5 py-2 bg-emerald-300 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 text-emerald-950'>
								<span>✅</span>
								<span>Telah Di-ACC Resmi</span>
							</span>
						</div>
					) : submissionStatus === 'PERLU_REVISI' ? (
						<button
							onClick={handleAjukan}
							disabled={submittingAction}
							className='px-4 py-2 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
							<span>🔄</span>
							<span>Ajukan Ulang Revisi</span>
						</button>
					) : (
						<button
							onClick={handleAjukan}
							disabled={submittingAction}
							className='px-4 py-2 bg-teal-400 hover:bg-teal-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
							<span>📨</span>
							<span>Ajukan ke Kepsek</span>
						</button>
					)}
				</div>
			</div>

			{/* Real-time Approval Status Banner */}
			{submissionStatus === 'MENUNGGU_PERSETUJUAN' && (
				<div className='bg-amber-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div className='flex items-start gap-3.5'>
						<span className='w-10 h-10 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center text-lg font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D] animate-pulse'>
							⏳
						</span>
						<div>
							<div className='flex items-center gap-2 flex-wrap'>
								<h2 className='text-sm sm:text-base font-black text-black uppercase tracking-tight'>
									Status: Sedang Ditinjau oleh Kepala Sekolah
								</h2>
								<span className='px-2 py-0.5 bg-amber-300 border border-black rounded-md text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D]'>
									Menunggu Persetujuan (ACC)
								</span>
							</div>
							<p className='text-xs font-bold text-amber-950 mt-1'>
								Draf bisaroh periode <span className='font-mono font-black'>{startDate}</span> s/d <span className='font-mono font-black'>{endDate}</span> diajukan pada {formatDateIndo(currentSubmission.diajukan_pada)} oleh <span className='font-black'>{currentSubmission.diajukan_oleh || 'Bendahara'}</span>.
							</p>
							{currentSubmission.catatan_bendahara && (
								<p className='text-xs font-medium text-amber-900 mt-1.5 bg-amber-200/60 border border-amber-400/80 rounded-lg px-2.5 py-1 inline-block'>
									<span className='font-bold'>Catatan Anda:</span> &ldquo;{currentSubmission.catatan_bendahara}&rdquo;
								</p>
							)}
							<p className='text-[10px] text-amber-800 font-bold mt-1.5 flex items-center gap-1'>
								<span>🔒</span>
								<span>Input penyesuaian nominal dikunci sementara selama proses peninjauan Kepala Sekolah.</span>
							</p>
						</div>
					</div>

					<div className='flex items-center gap-2 shrink-0 self-start md:self-auto'>
						<button
							type='button'
							onClick={handleBatalAjukan}
							disabled={submittingAction}
							className='px-3.5 py-2 bg-rose-200 hover:bg-rose-300 text-rose-950 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
							<span>↩️</span>
							<span>Batalkan Pengajuan</span>
						</button>
					</div>
				</div>
			)}

			{submissionStatus === 'DISETUJUI' && (
				<div className='bg-emerald-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div className='flex items-start gap-3.5'>
						<span className='w-10 h-10 rounded-xl bg-emerald-300 border-2 border-black flex items-center justify-center text-lg font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]'>
							✅
						</span>
						<div>
							<div className='flex items-center gap-2 flex-wrap'>
								<h2 className='text-sm sm:text-base font-black text-emerald-950 uppercase tracking-tight'>
									Status: Telah Disetujui & Disahkan (ACC Resmi)
								</h2>
								<span className='px-2 py-0.5 bg-emerald-300 border border-black rounded-md text-[10px] font-black uppercase text-emerald-950 shadow-[1px_1px_0px_0px_#0D0D0D]'>
									Sah / Siap Dicairkan
								</span>
							</div>
							<p className='text-xs font-bold text-emerald-900 mt-1'>
								Disahkan secara resmi oleh <span className='font-black'>{currentSubmission.disetujui_oleh || 'Kepala Sekolah'}</span> pada {formatDateIndo(currentSubmission.disetujui_pada)}.
							</p>
							<p className='text-xs font-black text-emerald-950 mt-1 font-mono'>
								Total Realisasi: {formatRupiah(currentSubmission.total_bersih)} ({currentSubmission.total_pegawai} pegawai)
							</p>
							<p className='text-[10px] text-emerald-800 font-bold mt-1'>
								Penggajian telah disahkan. Anda dapat mengekspor SPJ resmi atau mencetak slip gaji individual.
							</p>
						</div>
					</div>

					<div className='flex items-center gap-2 shrink-0 self-start md:self-auto'>
						<button
							type='button'
							onClick={handleExportCSV}
							className='px-3.5 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
							<span>📥</span>
							<span>Ekspor SPJ Final</span>
						</button>
					</div>
				</div>
			)}

			{submissionStatus === 'PERLU_REVISI' && (
				<div className='bg-rose-100 border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
					<div className='flex flex-col md:flex-row md:items-start justify-between gap-4'>
						<div className='flex items-start gap-3.5'>
							<span className='w-10 h-10 rounded-xl bg-rose-300 border-2 border-black flex items-center justify-center text-lg font-black shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D] animate-bounce'>
								⚠️
							</span>
							<div>
								<div className='flex items-center gap-2 flex-wrap'>
									<h2 className='text-sm sm:text-base font-black text-rose-950 uppercase tracking-tight'>
										Status: Perlu Revisi / Dikembalikan oleh Kepala Sekolah
									</h2>
									<span className='px-2 py-0.5 bg-rose-300 border border-black rounded-md text-[10px] font-black uppercase text-rose-950 shadow-[1px_1px_0px_0px_#0D0D0D]'>
										Perlu Revisi
									</span>
								</div>
								<p className='text-xs font-bold text-rose-900 mt-1'>
									Kepala Sekolah meminta perbaikan atau peninjauan ulang pada draf bisaroh periode ini sebelum dapat di-ACC.
								</p>
							</div>
						</div>

						<button
							type='button'
							onClick={handleAjukan}
							disabled={submittingAction}
							className='px-4 py-2 bg-rose-400 hover:bg-rose-500 text-black border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto'>
							<span>🔄</span>
							<span>Ajukan Ulang Revisi</span>
						</button>
					</div>

					{/* Alert Note Box */}
					<div className='bg-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_#0D0D0D]'>
						<p className='text-[10px] font-black uppercase text-rose-700 flex items-center gap-1'>
							<span>📝</span>
							<span>Catatan Koreksi dari Kepala Sekolah:</span>
						</p>
						<p className='text-xs sm:text-sm font-bold text-black mt-1 bg-rose-50 p-2.5 rounded-lg border border-rose-200'>
							&ldquo;{currentSubmission.catatan_kepsek || 'Mohon tinjau kembali data jam mengajar atau rincian penyesuaian insidental pegawai.'}&rdquo;
						</p>
						<p className='text-[10px] text-gray-500 font-bold mt-1.5'>
							Silakan sesuaikan data bonus, potongan, atau parameter tarif, kemudian klik tombol <strong>Ajukan Ulang Revisi</strong>.
						</p>
					</div>
				</div>
			)}

			{submissionStatus === 'DRAFT' && (
				<div className='bg-blue-50 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<span className='w-8 h-8 rounded-lg bg-blue-200 border-2 border-black flex items-center justify-center text-sm font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							📝
						</span>
						<div>
							<div className='flex items-center gap-2'>
								<h2 className='text-xs sm:text-sm font-black text-black uppercase'>
									Status: Draf Lokal Bendahara (Belum Diajukan)
								</h2>
								<span className='px-1.5 py-0.2 bg-blue-200 border border-black rounded text-[9px] font-black uppercase'>
									Draf
								</span>
							</div>
							<p className='text-[11px] font-bold text-gray-600 mt-0.5'>
								Perhitungan rekap periode <span className='font-mono font-black'>{startDate}</span> s/d <span className='font-mono font-black'>{endDate}</span> masih draf kerja internal. Klik tombol &ldquo;Ajukan ke Kepsek&rdquo; untuk mengirimkan verifikasi.
							</p>
						</div>
					</div>

					<button
						type='button'
						onClick={handleAjukan}
						disabled={submittingAction}
						className='px-3.5 py-1.5 bg-teal-400 hover:bg-teal-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0'>
						<span>📨</span>
						<span>Ajukan Sekarang</span>
					</button>
				</div>
			)}

			{/* Filter & Rate Notice Box */}
			<div className='bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Cari Dewan Guru
						</label>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Nama, username, atau tingkatan...'
							className='neo-input !py-2 text-xs font-bold'
						/>
					</div>

					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Cut-Off Mulai
						</label>
						<input
							type='date'
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className='neo-input !py-2 text-xs font-mono font-bold'
						/>
					</div>

					<div>
						<label className='block text-xs font-black uppercase text-gray-700 mb-1.5'>
							Tanggal Cut-Off Selesai
						</label>
						<input
							type='date'
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className='neo-input !py-2 text-xs font-mono font-bold'
						/>
					</div>

					<div className='bg-teal-50 border-2 border-black rounded-xl p-3 flex flex-col justify-center'>
						<p className='text-[10px] font-black uppercase text-teal-800'>Parameter Aktif:</p>
						<p className='text-xs font-black text-black mt-0.5 truncate'>
							{settings.tingkatan_guru.length} Tingkatan &bull; {settings.tunjangan_tambahan.length} Tunj. Tambahan
						</p>
					</div>
				</div>
			</div>

			{/* Summary KPI Strip */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5'>
				<div className='bg-emerald-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-emerald-800'>Total Bisaroh Bersih</p>
					<p className='text-xl sm:text-2xl font-black text-emerald-950 mt-1 font-mono'>
						{formatRupiah(totals.totalBersih)}
					</p>
					<p className='text-[10px] text-emerald-800 font-bold mt-0.5'>{bisarohList.length} Penerima</p>
				</div>

				<div className='bg-yellow-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-yellow-800'>Gapok & Honor Mengajar</p>
					<p className='text-xl sm:text-2xl font-black text-black mt-1 font-mono'>
						{formatRupiah(totals.totalGajiPokokJabatan + totals.totalHonorMengajar)}
					</p>
					<p className='text-[10px] text-gray-600 font-bold mt-0.5'>
						Gapok: {formatRupiah(totals.totalGajiPokokJabatan)} &bull; {totals.totalJP} JP
					</p>
				</div>

				<div className='bg-purple-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-purple-800'>Total Tunj. Jabatan</p>
					<p className='text-xl sm:text-2xl font-black text-purple-950 mt-1 font-mono'>
						{formatRupiah(totals.totalTunjanganJabatan)}
					</p>
					<p className='text-[10px] text-purple-800 font-bold mt-0.5'>Struktural & Pimpinan</p>
				</div>

				<div className='bg-teal-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-teal-800'>Tunj. Operasional</p>
					<p className='text-xl sm:text-2xl font-black text-teal-950 mt-1 font-mono'>
						{formatRupiah(totals.totalTunjangan - totals.totalTunjanganJabatan)}
					</p>
					<p className='text-[10px] text-gray-600 font-bold mt-0.5'>Hadir, Wali & Tambahan</p>
				</div>

				<div className='bg-rose-100 border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_0px_#0D0D0D]'>
					<p className='text-[10px] font-black uppercase text-rose-800'>Total Potongan</p>
					<p className='text-xl sm:text-2xl font-black text-rose-950 mt-1 font-mono'>
						-{formatRupiah(totals.totalPotongan)}
					</p>
					<p className='text-[10px] text-gray-600 font-bold mt-0.5'>Tetap & Insidental</p>
				</div>
			</div>

			{/* Category Filter Tabs (Wrapping naturally, no overflow scrollbar) */}
			<div className='flex flex-wrap items-center gap-2'>
				{[
					{ id: 'all', label: 'Semua Pegawai', icon: '👥' },
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
							className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all border-2 border-black flex items-center gap-1.5 ${
								isActive
									? 'bg-yellow-300 text-black shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
									: 'bg-white text-gray-700 hover:bg-yellow-100 hover:text-black shadow-[2px_2px_0px_0px_#0D0D0D]'
							}`}>
							<span>{cat.icon}</span>
							<span>{cat.label}</span>
						</button>
					);
				})}
			</div>

			{/* Main Payroll Table Card */}
			<div className='bg-white border-2 border-black rounded-2xl shadow-[5px_5px_0px_0px_#0D0D0D] overflow-hidden'>
				{/* Table Card Top Control Bar */}
				<div className='px-4 py-3 bg-amber-50 border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<span className='w-7 h-7 rounded-lg bg-teal-300 border-2 border-black flex items-center justify-center text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D]'>
							📋
						</span>
						<div>
							<h2 className='text-xs sm:text-sm font-black text-black uppercase tracking-tight'>
								Daftar Rekapitulasi Bisaroh Pegawai
							</h2>
							<p className='text-[10px] text-gray-600 font-bold'>
								Menampilkan {bisarohList.length} pegawai &bull; Periode {startDate} s/d {endDate}
							</p>
						</div>
					</div>

					{/* Format Switcher */}
					<div className='flex items-center gap-1.5 bg-white p-1 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] self-start sm:self-auto'>
						<span className='text-[10px] font-black uppercase text-gray-500 px-2'>Format:</span>
						<button
							type='button'
							onClick={() => setModeTabel('ringkas')}
							className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
								modeTabel === 'ringkas'
									? 'bg-yellow-300 text-black border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'
									: 'text-gray-600 hover:text-black hover:bg-gray-100'
							}`}>
							📱 Ringkas
						</button>
						<button
							type='button'
							onClick={() => setModeTabel('rinci')}
							className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
								modeTabel === 'rinci'
									? 'bg-yellow-300 text-black border border-black shadow-[1px_1px_0px_0px_#0D0D0D]'
									: 'text-gray-600 hover:text-black hover:bg-gray-100'
							}`}>
							📊 Kolom Rinci (11 Kolom)
						</button>
					</div>
				</div>

				<div className='overflow-x-auto'>
					{modeTabel === 'ringkas' ? (
						/* ============================================================== */
						/* MODE 1: TABEL RINGKAS (8 Kolom, Pas Layar & Tidak Gepeng)     */
						/* ============================================================== */
						<table className='w-full text-left border-collapse min-w-[850px]'>
							<thead>
								<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='px-3.5 py-3.5 text-center w-10 whitespace-nowrap'>No</th>
									<th className='px-3.5 py-3.5 whitespace-nowrap'>Pegawai & Jabatan</th>
									<th className='px-3.5 py-3.5 text-center whitespace-nowrap'>JTM</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Gaji / Honor JP</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Total Tunjangan</th>
									<th className='px-3.5 py-3.5 text-center whitespace-nowrap'>Penyesuaian (+ / -)</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Bisaroh Bersih</th>
									<th className='px-3.5 py-3.5 text-center whitespace-nowrap'>Slip</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
								{loading ? (
									<tr>
										<td colSpan={8} className='px-6 py-12 text-center text-gray-500 font-bold'>
											Menghitung kalkulasi bisaroh...
										</td>
									</tr>
								) : bisarohList.length === 0 ? (
									<tr>
										<td colSpan={8} className='px-6 py-12 text-center text-gray-500 font-bold'>
											Tidak ada data pegawai yang sesuai filter.
										</td>
									</tr>
								) : (
									bisarohList.map((item, idx) => {
										const isSenior = item.tingkatan?.id === 'senior';
										const isMadya = item.tingkatan?.id === 'madya';

										const totalTunjanganSemua =
											(item.tunjanganJabatan || 0) +
											(item.totalTunjanganPokok !== undefined
												? item.totalTunjanganPokok
												: item.tunjanganWali + item.tunjanganHadir) +
											(item.totalTunjanganTambahan || 0);

										return (
											<tr key={item.guru.id_user || idx} className='hover:bg-yellow-50/60 transition-colors'>
												<td className='px-3.5 py-3 text-center font-mono font-black text-gray-500 whitespace-nowrap'>
													{idx + 1}
												</td>
												<td className='px-3.5 py-3'>
													<div className='flex items-center gap-1.5 flex-wrap'>
														<span className='font-black text-black text-sm whitespace-nowrap'>
															{item.guru.nama_lengkap}
														</span>
														{item.jabatan && (
															<span className='px-1.5 py-0.5 bg-purple-100 text-purple-950 border border-purple-800 rounded text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1'>
																<span>🏛️</span>
																<span>{item.jabatan.nama}</span>
															</span>
														)}
														{item.tingkatan && !item.isTendik && (
															<span
																className={`px-1.5 py-0.5 border rounded text-[9px] font-black uppercase whitespace-nowrap ${
																	isSenior
																		? 'bg-purple-100 text-purple-950 border-purple-800'
																		: isMadya
																		? 'bg-blue-100 text-blue-950 border-blue-800'
																		: 'bg-teal-100 text-teal-950 border-teal-800'
																}`}>
																{item.tingkatan.nama}
															</span>
														)}
													</div>
													<div className='flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 flex-wrap'>
														<span>@{item.guru.username}</span>
														<span>&bull;</span>
														{item.isTendik ? (
															<span className='font-bold text-gray-600'>Tendik / Staf</span>
														) : (
															<span className='font-mono font-bold'>{formatRupiah(item.tarifJP)}/JP</span>
														)}
														{item.isWaliKelas && (
															<span className='px-1 py-0.2 bg-teal-100 border border-teal-800 text-teal-900 text-[8px] font-black rounded uppercase'>
																Wali Kelas
															</span>
														)}
													</div>
												</td>
												<td className='px-3.5 py-3 text-center whitespace-nowrap'>
													{item.isTendik ? (
														<span className='px-2.5 py-1 bg-gray-100 border border-gray-400 rounded-lg text-[10px] text-gray-600 font-bold inline-block'>
															Non-KBM
														</span>
													) : (
														<span className='inline-block whitespace-nowrap px-3 py-1 bg-yellow-200 border border-black rounded-lg font-black font-mono text-xs shadow-[1px_1px_0px_0px_#0D0D0D]'>
															{item.totalJP} JP
														</span>
													)}
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono'>
													{item.gajiPokokJabatan > 0 && item.honorMengajar > 0 ? (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.gajiPokokJabatan + item.honorMengajar)}
															</span>
															<span className='text-[9px] text-gray-500 font-bold block'>
																Gapok {formatRupiah(item.gajiPokokJabatan)} + JP {formatRupiah(item.honorMengajar)}
															</span>
														</div>
													) : item.gajiPokokJabatan > 0 ? (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.gajiPokokJabatan)}
															</span>
															<span className='text-[9px] text-purple-700 font-bold block'>Gaji Pokok</span>
														</div>
													) : (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.honorMengajar)}
															</span>
															<span className='text-[9px] text-gray-500 font-bold block'>Honor JP</span>
														</div>
													)}
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono'>
													{totalTunjanganSemua > 0 ? (
														<div>
															<span className='text-xs font-black text-teal-950 block'>
																+{formatRupiah(totalTunjanganSemua)}
															</span>
															<span className='text-[9px] text-gray-500 font-bold block'>
																{item.effectiveHadir !== undefined ? item.effectiveHadir : item.totalHadir} Hari Hadir
																{item.tunjanganJabatan > 0 ? ' • Ada Tunj. Jabatan' : ''}
															</span>
														</div>
													) : (
														<span className='text-gray-400'>-</span>
													)}
												</td>
												<td className='px-3 py-3 text-center whitespace-nowrap'>
													<div className='inline-flex items-center gap-1.5'>
														<input
															type='number'
															disabled={isLocked}
															value={adjustments[item.guru.id_user]?.bonus || ''}
															onChange={(e) => handleUpdateAdj(item.guru.id_user, 'bonus', e.target.value)}
															placeholder='+ Bonus'
															title={isLocked ? 'Terkunci (Sedang ditinjau / Disetujui)' : 'Bonus / Penyesuaian Tambahan (+Rp)'}
															className={`w-20 text-right px-2 py-1 text-xs border rounded-lg font-mono font-bold transition-all ${
																isLocked
																	? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
																	: 'border-emerald-600 bg-emerald-50/60 text-emerald-950 placeholder:text-gray-400 focus:ring-1 focus:ring-emerald-500'
															}`}
														/>
														<input
															type='number'
															disabled={isLocked}
															value={adjustments[item.guru.id_user]?.potongan || ''}
															onChange={(e) => handleUpdateAdj(item.guru.id_user, 'potongan', e.target.value)}
															placeholder='- Pot'
															title={isLocked ? 'Terkunci (Sedang ditinjau / Disetujui)' : 'Potongan Insidental (-Rp)'}
															className={`w-20 text-right px-2 py-1 text-xs border rounded-lg font-mono font-bold transition-all ${
																isLocked
																	? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
																	: 'border-rose-600 bg-rose-50/60 text-rose-950 placeholder:text-gray-400 focus:ring-1 focus:ring-rose-500'
															}`}
														/>
													</div>
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono font-black text-sm text-emerald-900'>
													{formatRupiah(item.totalBersih)}
												</td>
												<td className='px-3.5 py-3 text-center whitespace-nowrap'>
													<button
														onClick={() => setSelectedSlip(item)}
														title='Cetak Slip Gaji'
														className='px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
														📄 Slip
													</button>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					) : (
						/* ============================================================== */
						/* MODE 2: TABEL RINCI (11 Kolom Lengkap, min-w 1260px Aman)     */
						/* ============================================================== */
						<table className='w-full text-left border-collapse min-w-[1260px]'>
							<thead>
								<tr className='bg-teal-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='px-3 py-3.5 text-center w-10 whitespace-nowrap'>No</th>
									<th className='px-3.5 py-3.5 whitespace-nowrap'>Pegawai & Jabatan</th>
									<th className='px-3 py-3.5 text-center whitespace-nowrap'>JTM</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Gapok / Honor JP</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Tunj. Jabatan</th>
									<th className='px-3.5 py-3.5 text-center whitespace-nowrap'>Tunj. Pokok</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Tunj. Tambahan</th>
									<th className='px-3 py-3.5 text-center w-24 whitespace-nowrap'>Bonus (+Rp)</th>
									<th className='px-3 py-3.5 text-center w-24 whitespace-nowrap'>Potongan (-Rp)</th>
									<th className='px-3.5 py-3.5 text-right whitespace-nowrap'>Bisaroh Bersih</th>
									<th className='px-3.5 py-3.5 text-center whitespace-nowrap'>Slip</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black/10 text-xs font-bold'>
								{loading ? (
									<tr>
										<td colSpan={11} className='px-6 py-12 text-center text-gray-500 font-bold'>
											Menghitung kalkulasi bisaroh...
										</td>
									</tr>
								) : bisarohList.length === 0 ? (
									<tr>
										<td colSpan={11} className='px-6 py-12 text-center text-gray-500 font-bold'>
											Tidak ada data pegawai yang sesuai filter.
										</td>
									</tr>
								) : (
									bisarohList.map((item, idx) => {
										const isSenior = item.tingkatan?.id === 'senior';
										const isMadya = item.tingkatan?.id === 'madya';

										return (
											<tr key={item.guru.id_user || idx} className='hover:bg-yellow-50/60 transition-colors'>
												<td className='px-3 py-3 text-center font-mono font-black text-gray-500 whitespace-nowrap'>
													{idx + 1}
												</td>
												<td className='px-3.5 py-3 whitespace-nowrap'>
													<div className='flex items-center gap-1.5 flex-wrap'>
														<span className='font-black text-black text-sm whitespace-nowrap'>{item.guru.nama_lengkap}</span>
														{item.jabatan && (
															<span className='px-1.5 py-0.5 bg-purple-100 text-purple-950 border border-purple-800 rounded text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1'>
																<span>🏛️</span>
																<span>{item.jabatan.nama}</span>
															</span>
														)}
														{item.tingkatan && !item.isTendik && (
															<span
																className={`px-1.5 py-0.5 border rounded text-[9px] font-black uppercase whitespace-nowrap ${
																	isSenior
																		? 'bg-purple-100 text-purple-950 border-purple-800'
																		: isMadya
																		? 'bg-blue-100 text-blue-950 border-blue-800'
																		: 'bg-teal-100 text-teal-950 border-teal-800'
																}`}>
																{item.tingkatan.nama}
															</span>
														)}
													</div>
													<div className='flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 flex-wrap'>
														<span>@{item.guru.username}</span>
														<span>&bull;</span>
														{item.isTendik ? (
															<span className='font-bold text-gray-600'>Tendik / Staf</span>
														) : (
															<span className='font-mono font-bold'>{formatRupiah(item.tarifJP)}/JP</span>
														)}
														{item.isWaliKelas && (
															<span className='px-1 py-0.2 bg-teal-100 border border-teal-800 text-teal-900 text-[8px] font-black rounded uppercase'>
																Wali Kelas
															</span>
														)}
													</div>
												</td>
												<td className='px-3 py-3 text-center whitespace-nowrap'>
													{item.isTendik ? (
														<span className='px-2.5 py-1 bg-gray-100 border border-gray-400 rounded-lg text-[10px] text-gray-600 font-bold inline-block'>
															Non-KBM
														</span>
													) : (
														<span className='inline-block whitespace-nowrap px-3 py-1 bg-yellow-200 border border-black rounded-lg font-black font-mono text-xs shadow-[1px_1px_0px_0px_#0D0D0D]'>
															{item.totalJP} JP
														</span>
													)}
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono font-black text-black'>
													{item.gajiPokokJabatan > 0 && item.honorMengajar > 0 ? (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.gajiPokokJabatan + item.honorMengajar)}
															</span>
															<span className='text-[9px] text-gray-500 font-bold block'>
																Gapok {formatRupiah(item.gajiPokokJabatan)} + JP {formatRupiah(item.honorMengajar)}
															</span>
														</div>
													) : item.gajiPokokJabatan > 0 ? (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.gajiPokokJabatan)}
															</span>
															<span className='text-[9px] text-purple-700 font-bold block'>Gaji Pokok</span>
														</div>
													) : (
														<div>
															<span className='block text-xs font-black text-black'>
																{formatRupiah(item.honorMengajar)}
															</span>
															<span className='text-[9px] text-gray-500 font-bold block'>Honor JP</span>
														</div>
													)}
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono'>
													{item.tunjanganJabatan > 0 ? (
														<span className='font-black text-purple-900'>
															+{formatRupiah(item.tunjanganJabatan)}
														</span>
													) : (
														<span className='text-gray-400'>-</span>
													)}
												</td>
												<td className='px-3.5 py-3 text-center whitespace-nowrap font-mono'>
													<span className='block text-xs font-black text-black whitespace-nowrap'>
														{formatRupiah(
															item.totalTunjanganPokok !== undefined
																? item.totalTunjanganPokok
																: item.tunjanganWali + item.tunjanganHadir
														)}
													</span>
													<span className='text-[9px] text-gray-500 whitespace-nowrap block mt-0.5'>
														({item.effectiveHadir !== undefined ? item.effectiveHadir : item.totalHadir} Hari Hadir)
													</span>
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono'>
													{item.totalTunjanganTambahan > 0 ? (
														<span className='font-black text-teal-900'>
															+{formatRupiah(item.totalTunjanganTambahan)}
														</span>
													) : (
														<span className='text-gray-400'>-</span>
													)}
												</td>
												<td className='px-2 py-3 text-center whitespace-nowrap'>
													<input
														type='number'
														disabled={isLocked}
														value={adjustments[item.guru.id_user]?.bonus || ''}
														onChange={(e) => handleUpdateAdj(item.guru.id_user, 'bonus', e.target.value)}
														placeholder='0'
														title={isLocked ? 'Terkunci (Sedang ditinjau / Disetujui)' : 'Bonus Insidental'}
														className={`w-20 text-right px-2 py-1 text-xs border rounded-lg font-mono font-bold transition-all ${
															isLocked
																? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
																: 'border-black bg-white focus:ring-1 focus:ring-teal-500'
														}`}
													/>
												</td>
												<td className='px-2 py-3 text-center whitespace-nowrap'>
													<input
														type='number'
														disabled={isLocked}
														value={adjustments[item.guru.id_user]?.potongan || ''}
														onChange={(e) => handleUpdateAdj(item.guru.id_user, 'potongan', e.target.value)}
														placeholder='0'
														title={isLocked ? 'Terkunci (Sedang ditinjau / Disetujui)' : 'Potongan Insidental'}
														className={`w-20 text-right px-2 py-1 text-xs border rounded-lg font-mono font-bold transition-all ${
															isLocked
																? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
																: 'border-rose-600 bg-rose-50/50 text-rose-800 focus:ring-1 focus:ring-rose-500'
														}`}
													/>
												</td>
												<td className='px-3.5 py-3 text-right whitespace-nowrap font-mono font-black text-sm text-emerald-900'>
													{formatRupiah(item.totalBersih)}
												</td>
												<td className='px-3.5 py-3 text-center whitespace-nowrap'>
													<button
														onClick={() => setSelectedSlip(item)}
														title='Cetak Slip Gaji'
														className='px-2.5 py-1 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all'>
														📄 Slip
													</button>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* ============================================================== */}
			{/* MODAL CETAK SLIP GAJI DIGITAL KOMPREHENSIF                     */}
			{/* ============================================================== */}
			{selectedSlip && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						{/* Slip Header */}
						<div className='p-4 bg-teal-300 border-b-2 border-black flex items-center justify-between print:hidden'>
							<h3 className='font-black text-sm uppercase text-black'>Preview Slip Bisaroh & Gaji Pegawai</h3>
							<button
								onClick={() => setSelectedSlip(null)}
								className='w-7 h-7 bg-white border-2 border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						{/* Slip Body (Printable Area) */}
						<div className='p-6 overflow-y-auto space-y-4 print:p-0' id='printable-slip'>
							{/* Kop Surat Sekolah */}
							<div className='text-center border-b-2 border-black pb-3'>
								<h2 className='text-lg font-black uppercase tracking-tight text-black'>SLIP BISAROH & GAJI PEGAWAI</h2>
								<p className='text-xs font-bold text-gray-700'>LEMBAGA PENDIDIKAN / MADRASAH</p>
								<p className='text-[10px] font-mono text-gray-500 mt-0.5'>
									Periode Penggajian: {startDate} s/d {endDate}
								</p>
							</div>

							{/* Identitas Pegawai */}
							<div className='grid grid-cols-2 gap-2 text-xs border-b border-black/20 pb-3'>
								<div>
									<span className='text-[10px] text-gray-500 font-bold block'>Nama Pegawai:</span>
									<span className='font-black text-black text-sm block'>{selectedSlip.guru.nama_lengkap}</span>
									<span className='text-[10px] text-gray-500'>Username: @{selectedSlip.guru.username}</span>
									{selectedSlip.jabatan && (
										<div className='mt-1'>
											<span className='px-1.5 py-0.5 bg-purple-100 border border-purple-800 text-purple-950 font-black text-[9px] rounded uppercase'>
												🏛️ {selectedSlip.jabatan.nama}
											</span>
										</div>
									)}
								</div>
								<div className='text-right'>
									<span className='text-[10px] text-gray-500 font-bold block'>Klasifikasi Pegawai:</span>
									<span className='font-black text-black block'>
										{selectedSlip.jabatan
											? selectedSlip.jabatan.kategori === 'tendik'
												? 'Tenaga Kependidikan'
												: selectedSlip.jabatan.kategori === 'pimpinan'
												? 'Pimpinan / Kepala Madrasah'
												: 'Pendidik + Tugas Tambahan'
											: 'Dewan Guru (JTM)'}
									</span>
									{!selectedSlip.isTendik && selectedSlip.tingkatan && (
										<span className='text-[10px] font-mono text-teal-800 font-bold block mt-0.5'>
											Grade: {selectedSlip.tingkatan.nama} &bull; {formatRupiah(selectedSlip.tarifJP)}/JP
										</span>
									)}
								</div>
							</div>

							{/* Rincian Komponen Penerimaan */}
							<div className='space-y-2 text-xs'>
								<p className='text-[11px] font-black uppercase tracking-wider text-gray-700'>
									A. Penerimaan (Gaji Pokok, Jam Tatap Muka & Tunjangan):
								</p>

								{/* Gaji Pokok Jabatan (Jika Ada) */}
								{selectedSlip.gajiPokokJabatan > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 bg-purple-50/50 p-1 rounded'>
										<span className='font-bold text-purple-950'>
											Gaji Pokok Jabatan ({selectedSlip.jabatan?.nama || 'Struktural'})
										</span>
										<span className='font-mono font-black text-purple-950'>
											{formatRupiah(selectedSlip.gajiPokokJabatan)}
										</span>
									</div>
								)}

								{/* Honor Mengajar JP */}
								{(selectedSlip.honorMengajar > 0 || !selectedSlip.isTendik) && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
										<span>Honor Mengajar ({selectedSlip.totalJP} JP &times; {formatRupiah(selectedSlip.tarifJP)})</span>
										<span className='font-mono font-bold'>{formatRupiah(selectedSlip.honorMengajar)}</span>
									</div>
								)}

								{/* Tunjangan Jabatan Struktural */}
								{selectedSlip.tunjanganJabatan > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-purple-900'>
										<span className='font-bold'>
											Tunjangan Struktural / Jabatan ({selectedSlip.jabatan?.nama || 'Struktural'})
										</span>
										<span className='font-mono font-bold'>+{formatRupiah(selectedSlip.tunjanganJabatan)}</span>
									</div>
								)}

								{/* Rincian Tunjangan Pokok (CRUD) */}
								{selectedSlip.rincianTunjanganPokok && selectedSlip.rincianTunjanganPokok.length > 0 ? (
									selectedSlip.rincianTunjanganPokok.map((tp) => (
										<div key={tp.id} className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
											<span>
												{tp.nama}
												{tp.tipe === 'per_hari' && ` (${selectedSlip.effectiveHadir !== undefined ? selectedSlip.effectiveHadir : selectedSlip.totalHadir} Hari \u00D7 ${formatRupiah(tp.nominalPerUnit)})`}
												{tp.tipe === 'per_jp' && ` (${selectedSlip.totalJP} JP \u00D7 ${formatRupiah(tp.nominalPerUnit)})`}
											</span>
											<span className='font-mono font-bold'>{formatRupiah(tp.subtotal)}</span>
										</div>
									))
								) : (
									<>
										{selectedSlip.tunjanganHadir > 0 && (
											<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
												<span>
													Tunjangan Kehadiran ({selectedSlip.effectiveHadir !== undefined ? selectedSlip.effectiveHadir : selectedSlip.totalHadir} Hari &times; {formatRupiah(settings.tunjangan_kehadiran_per_hari)})
												</span>
												<span className='font-mono font-bold'>{formatRupiah(selectedSlip.tunjanganHadir)}</span>
											</div>
										)}
										{selectedSlip.isWaliKelas && selectedSlip.tunjanganWali > 0 && (
											<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1'>
												<span>Tunjangan Tugas Tambahan (Wali Kelas)</span>
												<span className='font-mono font-bold'>{formatRupiah(selectedSlip.tunjanganWali)}</span>
											</div>
										)}
									</>
								)}

								{/* Rincian Tunjangan Tambahan Dinamis */}
								{selectedSlip.rincianTunjanganTambahan.map((t) => (
									<div key={t.id} className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-teal-900'>
										<span>{t.nama}</span>
										<span className='font-mono font-bold'>+{formatRupiah(t.subtotal)}</span>
									</div>
								))}

								{/* Bonus Manual Insidental */}
								{selectedSlip.bonusManual > 0 && (
									<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-emerald-800'>
										<span>Bonus / Penyesuaian Insidental</span>
										<span className='font-mono font-bold'>+{formatRupiah(selectedSlip.bonusManual)}</span>
									</div>
								)}

								{/* Rincian Potongan */}
								{(selectedSlip.totalPotonganTetap > 0 || selectedSlip.potonganManual > 0) && (
									<>
										<p className='text-[11px] font-black uppercase tracking-wider text-gray-700 pt-2'>
											B. Potongan:
										</p>
										{selectedSlip.rincianPotonganTetap.map((p) => (
											<div key={p.id} className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-rose-800'>
												<span>{p.nama}</span>
												<span className='font-mono font-bold'>-{formatRupiah(p.subtotal)}</span>
											</div>
										))}
										{selectedSlip.potonganManual > 0 && (
											<div className='flex justify-between pl-3 border-b border-dashed border-gray-200 pb-1 text-rose-800'>
												<span>Potongan Insidental</span>
												<span className='font-mono font-bold'>-{formatRupiah(selectedSlip.potonganManual)}</span>
											</div>
										)}
									</>
								)}
							</div>

							{/* Total Net */}
							<div className='p-3 bg-teal-50 border-2 border-black rounded-xl flex items-center justify-between mt-3'>
								<div>
									<p className='text-[10px] font-black uppercase text-teal-800'>Total Diterima (Bersih):</p>
									<p className='text-xl font-black text-black font-mono'>{formatRupiah(selectedSlip.totalBersih)}</p>
								</div>
								<span className='text-xs font-black px-2.5 py-1 bg-yellow-300 border border-black rounded-lg'>
									LUNAS
								</span>
							</div>

							{/* Tanda Tangan */}
							<div className='grid grid-cols-2 gap-4 text-center text-xs pt-4'>
								<div>
									<p className='text-[10px] text-gray-500'>Penerima (Bisaroh / Gaji),</p>
									<div className='h-12'></div>
									<p className='font-black border-t border-black/30 pt-1'>{selectedSlip.guru.nama_lengkap}</p>
								</div>
								<div>
									<p className='text-[10px] text-gray-500'>Bendahara Keuangan,</p>
									<div className='h-12'></div>
									<p className='font-black border-t border-black/30 pt-1'>Bendahara Sekolah</p>
								</div>
							</div>
						</div>

						{/* Modal Action Buttons */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex justify-between print:hidden'>
							<button
								onClick={handlePrint}
								className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5'>
								<span>🖨️</span>
								<span>Cetak Slip Gaji</span>
							</button>
							<button
								onClick={() => setSelectedSlip(null)}
								className='px-4 py-2 bg-black text-white border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-gray-800'>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
