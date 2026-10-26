'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import { useLogout } from '@/hooks/useLogout';
import { getTodayDateString } from '@/lib/dateUtils';
import Link from 'next/link';

export default function KeamananDashboard() {
	const { handleLogout } = useLogout();

	// Baca role & nama dari cookie/storage secara sinkron agar zero-flicker (langsung Putra/Putri tanpa sempat flash Umum)
	const [userProfile, setUserProfile] = useState(() => {
		if (typeof window !== 'undefined') {
			const matchRole = document.cookie.match(/(?:^|;\s*)user_role=([^;]*)/);
			const cookieRole = matchRole ? decodeURIComponent(matchRole[1]) : (localStorage.getItem('user_role') || '');
			const matchName = document.cookie.match(/(?:^|;\s*)user_name=([^;]*)/);
			const cookieName = matchName ? decodeURIComponent(matchName[1]) : (localStorage.getItem('user_name') || '');
			if (cookieRole) {
				return {
					nama: cookieName || 'Petugas Keamanan',
					role: cookieRole,
				};
			}
		}
		return { nama: 'Petugas Keamanan', role: '' };
	});

	const [tanggal, setTanggal] = useState(() => getTodayDateString());
	const [suratList, setSuratList] = useState([]);
	const [tableReady, setTableReady] = useState(true);
	const [tableMessage, setTableMessage] = useState('');
	const [loading, setLoading] = useState(true);

	// Filter Gender (untuk Admin / Kepsek / Keamanan Umum)
	const [selectedGenderFilter, setSelectedGenderFilter] = useState(() => {
		if (typeof window !== 'undefined') {
			const matchRole = document.cookie.match(/(?:^|;\s*)user_role=([^;]*)/);
			const cookieRole = matchRole ? decodeURIComponent(matchRole[1]) : localStorage.getItem('user_role');
			if (cookieRole === 'Keamanan Putra') return 'Laki-laki';
			if (cookieRole === 'Keamanan Putri') return 'Perempuan';
		}
		return 'all';
	});

	// Master Siswa & Kelas untuk Autocomplete
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelasFilter, setSelectedKelasFilter] = useState('Semua');
	const [searchQuery, setSearchQuery] = useState('');
	const [filterTab, setFilterTab] = useState('semua'); // 'semua' | 'aktif' | 'terlambat' | 'izin_keluar' | 'pulang_cepat' | 'izin_uks' | 'tidak_masuk'

	// State Modal Tambah Surat
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [modalKelas, setModalKelas] = useState('');
	const [modalSearchSiswa, setModalSearchSiswa] = useState('');
	const [selectedSiswaObj, setSelectedSiswaObj] = useState(null);
	const [isComboboxOpen, setIsComboboxOpen] = useState(false);
	const comboboxRef = useRef(null);

	const [formData, setFormData] = useState({
		tipe_surat: 'terlambat', // 'terlambat' | 'izin_keluar' | 'pulang_cepat' | 'izin_uks' | 'tidak_masuk'
		status_absensi: 'Izin',
		tanggal_mulai: '',
		tanggal_selesai: '',
		is_rentang_tanggal: false,
		berlaku_seharian: false,
		jam_ke_mulai: '1',
		jam_ke_selesai: '1',
		alasan: '',
		penjemput: '',
		relasi_penjemput: '',
		no_telp_penjemput: '',
		catatan: '',
	});

	// Deteksi Mode Role
	const isPutra = userProfile.role === 'Keamanan Putra';
	const isPutri = userProfile.role === 'Keamanan Putri';
	const isSupervisor = userProfile.role === 'Admin' || userProfile.role === 'Kepala Sekolah' || userProfile.role === 'Keamanan';

	// Quick chips saran alasan khas Pesantren & Asrama Santri
	const quickReasons = {
		terlambat: [
			'Antre MCK / Mandi asrama pagi',
			'Menuntaskan setoran hafalan / diniyah pagi',
			'Piket kebersihan kamar / ro\'an asrama',
			'Panggilan ustadz / pembina asrama',
			'Piket dapur / ambil sarapan pondok',
			'Baru tiba dari izin kepulangan / luar pondok',
		],
		izin_keluar: [
			'Beli kitab / alat tulis ke toko luar pondok',
			'Urusan perbankan / tarik uang saku di ATM',
			'Periksa kesehatan ke puskesmas / klinik luar',
			'Fotokopi materi pelajaran / modul diniyah',
		],
		pulang_cepat: [
			'Dijemput orang tua (kepentingan keluarga penting)',
			'Rujukan sakit rawat inap / periksa dokter spesialis',
			'Takziyah keluarga kandung',
			'Izin acara keluarga besar (ada konfirmasi wali)',
		],
		izin_uks: [
			'Demam / menggigil saat KBM',
			'Sakit kepala / pusing berat',
			'Sakit maag / perut melilit',
			'Lemas & observasi Poskestren / UKS',
			'Cedera olahraga / luka ringan',
		],
		tidak_masuk: [
			'Istirahat di kamar asrama (rekomendasi Poskestren)',
			'Izin kepulangan resmi pondok (ada surat pengasuh)',
			'Rawat inap di rumah sakit',
			'Konfirmasi izin dari orang tua / pengasuh',
		],
	};

	// 1. Ambil Profil User
	useEffect(() => {
		fetch('/api/auth/me')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.user) {
					const role = data.user.role || 'Keamanan';
					setUserProfile({
						nama: data.user.nama_lengkap || 'Petugas Keamanan',
						role: role,
					});
					if (role === 'Keamanan Putra') {
						setSelectedGenderFilter('Laki-laki');
					} else if (role === 'Keamanan Putri') {
						setSelectedGenderFilter('Perempuan');
					}
				}
			})
			.catch(() => {});
	}, []);

	// 2. Fetch Master Kelas & Siswa
	useEffect(() => {
		Promise.all([
			fetch('/api/kelas').then((r) => (r.ok ? r.json() : [])),
			fetch('/api/siswa').then((r) => (r.ok ? r.json() : [])),
		])
			.then(([dataKelas, dataSiswa]) => {
				setKelasList(Array.isArray(dataKelas) ? dataKelas : []);
				setSiswaList(Array.isArray(dataSiswa) ? dataSiswa.filter((s) => s.status === 'Aktif') : []);
			})
			.catch((err) => console.error('Error fetching master:', err));
	}, []);

	// 3. Fetch Data Surat Hari Ini
	const fetchSuratList = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams({ tanggal });
			if (selectedKelasFilter && selectedKelasFilter !== 'Semua') {
				params.append('kelas', selectedKelasFilter);
			}

			// Gender filtering logic
			if (isPutra) {
				params.append('gender', 'Laki-laki');
			} else if (isPutri) {
				params.append('gender', 'Perempuan');
			} else if (selectedGenderFilter && selectedGenderFilter !== 'all') {
				params.append('gender', selectedGenderFilter);
			}

			const res = await fetch(`/api/keamanan/surat?${params.toString()}`);
			if (res.ok) {
				const json = await res.json();
				setSuratList(json.data || []);
				setTableReady(json.tableReady !== false);
				setTableMessage(json.message || '');
			} else {
				setSuratList([]);
			}
		} catch (err) {
			console.error('Error fetching surat:', err);
		} finally {
			setLoading(false);
		}
	}, [tanggal, selectedKelasFilter, isPutra, isPutri, selectedGenderFilter]);

	useEffect(() => {
		fetchSuratList();
	}, [fetchSuratList]);

	// Listener tutup combobox saat klik di luar
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
				setIsComboboxOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Master daftar kelas yang tersedia untuk form modal (terurut rapi)
	const availableKelasList = useMemo(() => {
		const setFromKelas = new Set(
			kelasList.map((k) => k.kelas || k.nama_kelas).filter(Boolean)
		);
		siswaList.forEach((s) => {
			if (s.kelas) setFromKelas.add(s.kelas);
		});
		return Array.from(setFromKelas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	}, [kelasList, siswaList]);

	// Daftar siswa di kelas terpilih (dengan segregasi gender Putra/Putri)
	const siswaDiKelasTerpilih = useMemo(() => {
		if (!modalKelas) return [];
		let pool = siswaList.filter((s) => String(s.kelas).trim() === String(modalKelas).trim());
		if (isPutra) {
			pool = pool.filter((s) => s.jenis_kelamin === 'Laki-laki');
		} else if (isPutri) {
			pool = pool.filter((s) => s.jenis_kelamin === 'Perempuan');
		} else if (selectedGenderFilter && selectedGenderFilter !== 'all') {
			pool = pool.filter((s) => s.jenis_kelamin === selectedGenderFilter);
		}
		return pool.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
	}, [siswaList, modalKelas, isPutra, isPutri, selectedGenderFilter]);

	// Filter pencarian combobox siswa di dalam kelas terpilih
	const filteredSiswaCombobox = useMemo(() => {
		if (!modalKelas) return [];
		if (!modalSearchSiswa.trim()) return siswaDiKelasTerpilih;
		const q = modalSearchSiswa.toLowerCase().trim();
		return siswaDiKelasTerpilih.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && String(s.nis).toLowerCase().includes(q))
		);
	}, [modalKelas, modalSearchSiswa, siswaDiKelasTerpilih]);

	// Statistik Ringkas
	const stats = useMemo(() => {
		const total = suratList.length;
		const terlambat = suratList.filter((s) => s.tipe_surat === 'terlambat').length;
		const izinKeluar = suratList.filter((s) => s.tipe_surat === 'izin_keluar').length;
		const izinKeluarBelumKembali = suratList.filter((s) => s.tipe_surat === 'izin_keluar' && s.status_surat === 'aktif').length;
		const pulangCepat = suratList.filter((s) => s.tipe_surat === 'pulang_cepat').length;
		const izinUks = suratList.filter((s) => s.tipe_surat === 'izin_uks').length;
		const izinUksAktif = suratList.filter((s) => s.tipe_surat === 'izin_uks' && s.status_surat === 'aktif').length;
		const tidakMasuk = suratList.filter((s) => s.tipe_surat === 'tidak_masuk').length;
		return { total, terlambat, izinKeluar, izinKeluarBelumKembali, pulangCepat, izinUks, izinUksAktif, tidakMasuk };
	}, [suratList]);

	// Filter Tampilan Tabel
	const filteredSurat = useMemo(() => {
		return suratList.filter((item) => {
			// Tab Filter
			if (filterTab === 'aktif' && item.status_surat !== 'aktif') return false;
			if (filterTab === 'terlambat' && item.tipe_surat !== 'terlambat') return false;
			if (filterTab === 'izin_keluar' && item.tipe_surat !== 'izin_keluar') return false;
			if (filterTab === 'pulang_cepat' && item.tipe_surat !== 'pulang_cepat') return false;
			if (filterTab === 'izin_uks' && item.tipe_surat !== 'izin_uks') return false;
			if (filterTab === 'tidak_masuk' && item.tipe_surat !== 'tidak_masuk') return false;

			// Search Query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const matchNama = item.nama_siswa?.toLowerCase().includes(q);
				const matchNis = item.nis?.toLowerCase().includes(q);
				const matchKelas = item.kelas?.toLowerCase().includes(q);
				const matchNomor = item.nomor_surat?.toLowerCase().includes(q);
				const matchAlasan = item.alasan?.toLowerCase().includes(q);
				if (!matchNama && !matchNis && !matchKelas && !matchNomor && !matchAlasan) return false;
			}

			return true;
		});
	}, [suratList, filterTab, searchQuery]);

	// Buka Modal Tambah
	const handleOpenModal = (tipe = 'terlambat') => {
		setSelectedSiswaObj(null);
		setModalSearchSiswa('');
		setModalKelas('');
		setIsComboboxOpen(false);

		let defaultAbsensi = 'Izin';
		let startJam = '1';
		let endJam = '1';

		if (tipe === 'pulang_cepat' || tipe === 'tidak_masuk' || tipe === 'izin_uks') {
			defaultAbsensi = 'Sakit';
		}

		if (tipe === 'terlambat') {
			startJam = '1';
			endJam = '1';
		} else if (tipe === 'izin_uks') {
			startJam = '3';
			endJam = '4';
		} else {
			startJam = '3';
			endJam = '4';
		}

		setFormData({
			tipe_surat: tipe,
			status_absensi: defaultAbsensi,
			tanggal_mulai: tanggal || getTodayDateString(),
			tanggal_selesai: tanggal || getTodayDateString(),
			is_rentang_tanggal: false,
			berlaku_seharian: tipe === 'tidak_masuk',
			jam_ke_mulai: startJam,
			jam_ke_selesai: endJam,
			alasan: '',
			penjemput: '',
			relasi_penjemput: '',
			no_telp_penjemput: '',
			catatan: '',
		});
		setIsModalOpen(true);
	};

	// Pilih Siswa di Modal
	const handleSelectSiswa = (siswa) => {
		// Validasi Gender saat pemilihan
		if (isPutra && siswa.jenis_kelamin === 'Perempuan') {
			Swal.fire('Perhatian', 'Petugas Keamanan Putra hanya dapat menerbitkan izin untuk santri putra (Laki-laki).', 'warning');
			return;
		}
		if (isPutri && siswa.jenis_kelamin === 'Laki-laki') {
			Swal.fire('Perhatian', 'Petugas Keamanan Putri hanya dapat menerbitkan izin untuk santriwati putri (Perempuan).', 'warning');
			return;
		}

		setSelectedSiswaObj(siswa);
		setModalSearchSiswa(siswa.nama_lengkap);
		if (siswa.kelas) setModalKelas(siswa.kelas);
		setIsComboboxOpen(false);
	};

	// Kirim Formulir Surat Baru
	const handleSubmitSurat = async (e) => {
		e.preventDefault();
		if (!modalKelas) {
			Swal.fire('Perhatian', 'Silakan pilih kelas santri terlebih dahulu.', 'warning');
			return;
		}
		if (!selectedSiswaObj) {
			Swal.fire('Perhatian', 'Silakan pilih santri terlebih dahulu dari daftar combobox siswa.', 'warning');
			return;
		}
		if (!formData.alasan.trim()) {
			Swal.fire('Perhatian', 'Alasan / keperluan izin wajib diisi.', 'warning');
			return;
		}

		// Validasi Mahram untuk Santriwati Putri yang Pulang Cepat
		const isTargetPerempuan = selectedSiswaObj.jenis_kelamin === 'Perempuan';
		if (isTargetPerempuan && formData.tipe_surat === 'pulang_cepat') {
			if (!formData.penjemput.trim()) {
				Swal.fire('Verifikasi Mahram Wajib', 'Untuk santriwati putri yang pulang cepat, nama penjemput wajib dicatat.', 'warning');
				return;
			}
		}

		try {
			setSubmitting(true);
			const tglMulai = formData.tanggal_mulai || tanggal;
			const tglSelesai = formData.is_rentang_tanggal ? (formData.tanggal_selesai || tglMulai) : tglMulai;
			const isMultiDay = formData.is_rentang_tanggal && tglSelesai !== tglMulai;

			const payload = {
				siswa_id: selectedSiswaObj.id,
				nama_siswa: selectedSiswaObj.nama_lengkap,
				nis: selectedSiswaObj.nis || '',
				kelas: selectedSiswaObj.kelas,
				tanggal: tglMulai,
				tanggal_selesai: tglSelesai,
				jenis_kelamin: selectedSiswaObj.jenis_kelamin || 'Laki-laki',
				tipe_surat: formData.tipe_surat,
				status_absensi: formData.status_absensi,
				jam_ke_mulai: (isMultiDay || formData.berlaku_seharian) ? null : formData.jam_ke_mulai,
				jam_ke_selesai: (isMultiDay || formData.berlaku_seharian) ? null : formData.jam_ke_selesai,
				berlaku_seharian: Boolean(isMultiDay || formData.berlaku_seharian),
				alasan: formData.alasan,
				penjemput: formData.penjemput || null,
				relasi_penjemput: formData.relasi_penjemput || null,
				no_telp_penjemput: formData.no_telp_penjemput || null,
				catatan: formData.catatan || null,
			};

			const res = await fetch('/api/keamanan/surat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const result = await res.json();
			if (!res.ok) {
				throw new Error(result.error || 'Gagal menerbitkan surat');
			}

			await Swal.fire({
				icon: 'success',
				title: 'Surat Berhasil Diterbitkan!',
				html: `
					<div class="text-left text-sm space-y-1.5 font-sans">
						<p><b>Nomor Surat:</b> <span class="font-mono text-[#00A693]">${result.data?.nomor_surat}</span></p>
						<p><b>Siswa:</b> ${result.data?.nama_siswa} (${result.data?.kelas}) &bull; ${result.data?.jenis_kelamin === 'Laki-laki' ? '👦 Putra' : '👧 Putri'}</p>
						<p><b>Jenis Izin:</b> <span class="font-bold uppercase">${result.data?.tipe_surat === 'izin_uks' ? '🏥 Istirahat di UKS' : result.data?.tipe_surat}</span></p>
						<p><b>Status Absensi Mapel:</b> Terhubung otomatis ke presensi guru di kelas.</p>
					</div>
				`,
				confirmButtonColor: '#00A693',
			});

			setIsModalOpen(false);
			await fetchSuratList();
		} catch (err) {
			console.error(err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSubmitting(false);
		}
	};

	// Tandai Siswa Izin Keluar Sudah Kembali
	const handleTandaiKembali = async (item) => {
		const nowWib = new Date().toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		}).replace('.', ':');

		const isUks = item.tipe_surat === 'izin_uks';
		const confirmPrompt = isUks
			? `Tandai bahwa <b>${item.nama_siswa}</b> telah selesai beristirahat di UKS dan kembali masuk ke kelas pada pukul <b>${nowWib} WIB</b>?`
			: `Tandai bahwa <b>${item.nama_siswa}</b> telah kembali masuk ke lingkungan sekolah pada pukul <b>${nowWib} WIB</b>?`;

		const result = await Swal.fire({
			title: isUks ? 'Konfirmasi Kembali ke Kelas' : 'Konfirmasi Siswa Kembali',
			html: confirmPrompt,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: isUks ? 'Ya, Kembali ke Kelas' : 'Ya, Tandai Kembali',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00A693',
		});

		if (!result.isConfirmed) return;

		try {
			const res = await fetch('/api/keamanan/surat', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: item.id,
					status_surat: 'selesai',
					waktu_kembali: nowWib,
				}),
			});

			if (!res.ok) throw new Error('Gagal memperbarui status');
			Swal.fire({
				icon: 'success',
				title: 'Selesai',
				text: `${item.nama_siswa} tercatat kembali pukul ${nowWib} WIB.`,
				timer: 1500,
				showConfirmButton: false,
			});
			fetchSuratList();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		}
	};

	// Batalkan Surat
	const handleBatalkanSurat = async (item) => {
		const result = await Swal.fire({
			title: 'Batalkan Surat?',
			text: `Yakin ingin membatalkan surat ${item.nomor_surat} untuk ${item.nama_siswa}?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			confirmButtonText: 'Ya, Batalkan',
			cancelButtonText: 'Tutup',
		});

		if (!result.isConfirmed) return;

		try {
			const res = await fetch('/api/keamanan/surat', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: item.id,
					status_surat: 'dibatalkan',
				}),
			});
			if (!res.ok) throw new Error('Gagal membatalkan surat');
			Swal.fire('Dibatalkan', 'Surat telah ditandai batal.', 'success');
			fetchSuratList();
		} catch (err) {
			Swal.fire('Error', err.message, 'error');
		}
	};

	// Helper Render Badge Tipe
	const renderBadgeTipe = (tipe) => {
		switch (tipe) {
			case 'terlambat':
				return (
					<span className='px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-300 text-black border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
						<span>🕒</span> Terlambat Masuk
					</span>
				);
			case 'izin_keluar':
				return (
					<span className='px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-blue-300 text-black border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
						<span>🚪</span> Izin Keluar
					</span>
				);
			case 'pulang_cepat':
				return (
					<span className='px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-rose-300 text-black border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
						<span>🏠</span> Pulang Cepat
					</span>
				);
			case 'izin_uks':
				return (
					<span className='px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
						<span>🏥</span> Istirahat di UKS
					</span>
				);
			default:
				return (
					<span className='px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-purple-300 text-black border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-flex items-center gap-1'>
						<span>📋</span> Titip Izin/Sakit
					</span>
				);
		}
	};

	// Styling Top Bar Berdasarkan Role
	const topBgColor = isPutra ? 'bg-sky-50' : isPutri ? 'bg-pink-50' : 'bg-white';
	const topIconBg = isPutra ? 'bg-sky-400 text-white' : isPutri ? 'bg-pink-400 text-white' : 'bg-orange-400 text-black';
	const topRoleLabel = isPutra
		? 'Pos Keamanan Santri Putra'
		: isPutri
		? 'Pos Keamanan Santriwati Putri'
		: 'Pos Keamanan & Surat Izin Digital';
	const topBadgeText = isPutra ? 'Santri Putra' : isPutri ? 'Santri Putri' : 'Gerbang Terpadu';
	const topBadgeBg = isPutra ? 'bg-sky-700 text-white' : isPutri ? 'bg-pink-700 text-white' : 'bg-[#00A693] text-white';

	return (
		<div className='min-h-screen bg-[var(--background)] pb-24 font-sans'>
			{/* --- TOP NAVBAR POS KEAMANAN --- */}
			<div className={`${topBgColor} border-b-4 border-[#0D0D0D] shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)] sticky top-0 z-30 transition-colors`}>
				<div className='max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<div className={`w-11 h-11 ${topIconBg} border-2 border-[#0D0D0D] rounded-xl flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#0D0D0D] shrink-0`}>
							{isPutri ? '🧕' : '👮‍♂️'}
						</div>
						<div>
							<div className='flex items-center gap-2'>
								<h1 className='text-lg sm:text-xl font-black text-[#0D0D0D] uppercase tracking-tight'>
									{topRoleLabel}
								</h1>
								<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${topBadgeBg} border border-[#0D0D0D]`}>
									{topBadgeText}
								</span>
							</div>
							<p className='text-xs font-bold text-gray-600'>
								Petugas: <b>{userProfile.nama}</b> &bull; Terhubung Real-Time ke Absensi Guru
							</p>
						</div>
					</div>

					<div className='flex items-center gap-2.5'>
						<button
							onClick={() => handleOpenModal('terlambat')}
							className='neo-btn-primary bg-[#00A693] text-white text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5 shadow-[3px_3px_0px_0px_#0D0D0D]'>
							<span>➕</span>
							<span>Terbitkan Surat Baru</span>
						</button>
						<button
							onClick={handleLogout}
							title='Keluar Akun'
							className='neo-btn-outline bg-white hover:bg-rose-100 text-[#0D0D0D] text-xs py-2 px-3 border-2 border-[#0D0D0D] rounded-xl font-black shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<span>🚪 Keluar</span>
						</button>
					</div>
				</div>
			</div>

			<div className='max-w-6xl mx-auto px-4 py-6 space-y-6'>
				{/* --- ALERT BANNER JIKA TABEL BELUM DIMIGRASI --- */}
				{!tableReady && (
					<div className='p-4 bg-amber-100 border-3 border-[#0D0D0D] rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
						<div className='flex items-center gap-3'>
							<span className='text-3xl'>⚠️</span>
							<div>
								<h4 className='font-black text-sm text-[#0D0D0D] uppercase'>Tabel Database Belum Siap</h4>
								<p className='text-xs font-bold text-amber-900'>
									Jalankan skrip migrasi <code className='bg-white px-1.5 py-0.5 rounded border border-black font-mono font-bold text-black'>migrations/update_role_keamanan_putra_putri_and_uks.sql</code> di SQL Editor Supabase agar data tersimpan permanen.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* --- FILTER CONTROL BAR --- */}
				<div className='bg-white border-3 border-[#0D0D0D] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
						{/* Tanggal, Gender Switcher & Kelas Filter */}
						<div className='flex flex-wrap items-center gap-2.5'>
							<div className='flex items-center gap-1.5 bg-[#FFF5F0] border-2 border-[#0D0D0D] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
								<span className='text-sm font-bold text-gray-700'>📅 Tanggal:</span>
								<input
									type='date'
									value={tanggal}
									onChange={(e) => setTanggal(e.target.value)}
									className='font-bold text-xs bg-transparent outline-none cursor-pointer text-[#0D0D0D]'
								/>
							</div>

							{/* Dual Gender Switcher (Hanya tampil untuk Admin / Kepsek / Keamanan Umum) */}
							{isSupervisor && (
								<div className='flex items-center gap-1 bg-yellow-100 p-1 border-2 border-[#0D0D0D] rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D]'>
									<button
										onClick={() => setSelectedGenderFilter('all')}
										className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg transition-all ${
											selectedGenderFilter === 'all'
												? 'bg-black text-white'
												: 'text-black hover:bg-yellow-200'
										}`}>
										Semua
									</button>
									<button
										onClick={() => setSelectedGenderFilter('Laki-laki')}
										className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg transition-all ${
											selectedGenderFilter === 'Laki-laki'
												? 'bg-sky-600 text-white'
												: 'text-sky-950 hover:bg-sky-200'
										}`}>
										👦 Putra
									</button>
									<button
										onClick={() => setSelectedGenderFilter('Perempuan')}
										className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg transition-all ${
											selectedGenderFilter === 'Perempuan'
												? 'bg-pink-600 text-white'
												: 'text-pink-950 hover:bg-pink-200'
										}`}>
										👧 Putri
									</button>
								</div>
							)}

							<div className='relative'>
								<select
									value={selectedKelasFilter}
									onChange={(e) => setSelectedKelasFilter(e.target.value)}
									className='neo-input appearance-none bg-white pr-8 !py-1.5 text-xs font-bold cursor-pointer'>
									<option value='Semua'>Semua Kelas</option>
									{kelasList.map((k) => (
										<option key={k.id} value={k.kelas || k.nama_kelas}>
											{k.kelas || k.nama_kelas}
										</option>
									))}
								</select>
								<div className='absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-black'>▼</div>
							</div>
						</div>

						{/* Quick Create Buttons */}
						<div className='flex flex-wrap items-center gap-2'>
							<button
								onClick={() => handleOpenModal('terlambat')}
								className='px-3 py-1.5 bg-amber-200 hover:bg-amber-300 border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all hover:-translate-y-0.5'>
								🕒 + Terlambat
							</button>
							<button
								onClick={() => handleOpenModal('izin_keluar')}
								className='px-3 py-1.5 bg-blue-200 hover:bg-blue-300 border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all hover:-translate-y-0.5'>
								🚪 + Izin Keluar
							</button>
							<button
								onClick={() => handleOpenModal('pulang_cepat')}
								className='px-3 py-1.5 bg-rose-200 hover:bg-rose-300 border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all hover:-translate-y-0.5'>
								🏠 + Pulang Cepat
							</button>
							<button
								onClick={() => handleOpenModal('izin_uks')}
								className='px-3 py-1.5 bg-emerald-200 hover:bg-emerald-300 border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all hover:-translate-y-0.5'>
								🏥 + Izin UKS
							</button>
						</div>
					</div>

					{/* --- STAT CARDS --- */}
					<div className='grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t-2 border-[#0D0D0D]'>
						<div
							onClick={() => setFilterTab('terlambat')}
							className={`p-3 rounded-xl border-2 border-[#0D0D0D] cursor-pointer transition-all ${
								filterTab === 'terlambat' ? 'bg-amber-300 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-amber-50 hover:bg-amber-100 shadow-[3px_3px_0px_0px_#0D0D0D]'
							}`}>
							<p className='text-[11px] font-black uppercase text-amber-900'>🕒 Terlambat Masuk</p>
							<p className='text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.terlambat}</p>
							<span className='text-[10px] text-gray-600 font-bold'>Siswa pagi ini</span>
						</div>

						<div
							onClick={() => setFilterTab('izin_keluar')}
							className={`p-3 rounded-xl border-2 border-[#0D0D0D] cursor-pointer transition-all ${
								filterTab === 'izin_keluar' ? 'bg-blue-300 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-blue-50 hover:bg-blue-100 shadow-[3px_3px_0px_0px_#0D0D0D]'
							}`}>
							<p className='text-[11px] font-black uppercase text-blue-900'>🚪 Izin Keluar</p>
							<p className='text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.izinKeluar}</p>
							<span className={`text-[10px] font-bold ${stats.izinKeluarBelumKembali > 0 ? 'text-rose-600 font-black' : 'text-gray-600'}`}>
								{stats.izinKeluarBelumKembali > 0 ? `⚠️ ${stats.izinKeluarBelumKembali} belum kembali` : 'Semua telah kembali'}
							</span>
						</div>

						<div
							onClick={() => setFilterTab('pulang_cepat')}
							className={`p-3 rounded-xl border-2 border-[#0D0D0D] cursor-pointer transition-all ${
								filterTab === 'pulang_cepat' ? 'bg-rose-300 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-rose-50 hover:bg-rose-100 shadow-[3px_3px_0px_0px_#0D0D0D]'
							}`}>
							<p className='text-[11px] font-black uppercase text-rose-900'>🏠 Pulang Cepat</p>
							<p className='text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.pulangCepat}</p>
							<span className='text-[10px] text-gray-600 font-bold'>Dijemput orang tua</span>
						</div>

						<div
							onClick={() => setFilterTab('izin_uks')}
							className={`p-3 rounded-xl border-2 border-[#0D0D0D] cursor-pointer transition-all ${
								filterTab === 'izin_uks' ? 'bg-emerald-300 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-emerald-50 hover:bg-emerald-100 shadow-[3px_3px_0px_0px_#0D0D0D]'
							}`}>
							<p className='text-[11px] font-black uppercase text-emerald-900'>🏥 Istirahat di UKS</p>
							<p className='text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.izinUks}</p>
							<span className={`text-[10px] font-bold ${stats.izinUksAktif > 0 ? 'text-emerald-800 font-black' : 'text-gray-600'}`}>
								{stats.izinUksAktif > 0 ? `🏥 ${stats.izinUksAktif} sedang di UKS` : 'Tidak ada di UKS'}
							</span>
						</div>

						<div
							onClick={() => setFilterTab('tidak_masuk')}
							className={`p-3 rounded-xl border-2 border-[#0D0D0D] cursor-pointer transition-all ${
								filterTab === 'tidak_masuk' ? 'bg-purple-300 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-purple-50 hover:bg-purple-100 shadow-[3px_3px_0px_0px_#0D0D0D]'
							}`}>
							<p className='text-[11px] font-black uppercase text-purple-900'>📋 Titip Izin/Sakit</p>
							<p className='text-2xl font-black text-[#0D0D0D] mt-0.5'>{stats.tidakMasuk}</p>
							<span className='text-[10px] text-gray-600 font-bold'>Surat dokter / wali</span>
						</div>
					</div>
				</div>

				{/* --- SEARCH & TAB FILTER BAR --- */}
				<div className='bg-white border-2 border-[#0D0D0D] rounded-2xl p-3 shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
					<div className='relative flex-1'>
						<input
							type='text'
							placeholder='Cari nama santri, NIS, kelas, atau nomor surat...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='w-full pl-9 pr-8 py-2 bg-transparent text-[#0D0D0D] font-bold text-xs sm:text-sm outline-none placeholder:text-gray-400'
						/>
						<span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm'>🔍</span>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className='absolute right-2 top-1/2 -translate-y-1/2 font-bold text-gray-400 hover:text-black'>
								✕
							</button>
						)}
					</div>

					<div className='flex flex-wrap items-center gap-1.5 shrink-0 bg-[#FFF5F0] p-1 rounded-xl border border-[#0D0D0D]'>
						{[
							{ id: 'semua', label: `Semua (${stats.total})` },
							{ id: 'aktif', label: 'Aktif / Belum Kembali' },
							{ id: 'terlambat', label: 'Terlambat' },
							{ id: 'izin_keluar', label: 'Izin Keluar' },
							{ id: 'pulang_cepat', label: 'Pulang Cepat' },
							{ id: 'izin_uks', label: 'Di UKS' },
							{ id: 'tidak_masuk', label: 'Titip Izin' },
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setFilterTab(tab.id)}
								className={`px-2.5 py-1 text-xs font-black uppercase rounded-lg transition-all ${
									filterTab === tab.id
										? 'bg-[#0D0D0D] text-white shadow-[1px_1px_0px_0px_#F5C518]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				{/* --- DAFTAR SURAT IZIN HARI INI --- */}
				{loading ? (
					<Loader />
				) : filteredSurat.length === 0 ? (
					<div className='bg-white border-3 border-[#0D0D0D] rounded-2xl p-10 text-center shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
						<div className='text-5xl'>📭</div>
						<h3 className='font-black text-lg text-[#0D0D0D] uppercase'>Belum Ada Surat Terbit</h3>
						<p className='text-xs font-bold text-gray-500 max-w-md mx-auto'>
							{searchQuery
								? `Tidak ditemukan surat dengan kata kunci "${searchQuery}".`
								: `Belum ada surat izin yang dicatat untuk tanggal ${tanggal}. Silakan klik tombol "➕ Terbitkan Surat Baru" jika ada siswa yang melapor.`}
						</p>
						<button
							onClick={() => handleOpenModal('terlambat')}
							className='neo-btn-primary bg-[#00A693] text-white text-xs py-2 px-5 inline-flex items-center gap-2 mt-2'>
							<span>➕</span> Terbitkan Surat Sekarang
						</button>
					</div>
				) : (
					<div className='space-y-3.5'>
						{filteredSurat.map((item) => {
							const isKeluarAktif = item.tipe_surat === 'izin_keluar' && item.status_surat === 'aktif';
							const isUksAktif = item.tipe_surat === 'izin_uks' && item.status_surat === 'aktif';
							const isDibatalkan = item.status_surat === 'dibatalkan';
							const isSantriPutra = item.jenis_kelamin === 'Laki-laki';

							return (
								<div
									key={item.id}
									className={`bg-white border-3 border-[#0D0D0D] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
										isKeluarAktif
											? 'border-l-8 border-l-blue-500 bg-blue-50/30'
											: isUksAktif
											? 'border-l-8 border-l-emerald-500 bg-emerald-50/30'
											: isDibatalkan
											? 'opacity-60 bg-gray-50'
											: ''
									}`}>
									{/* Detail Siswa & Surat */}
									<div className='space-y-2 flex-1'>
										<div className='flex flex-wrap items-center gap-2'>
											{renderBadgeTipe(item.tipe_surat)}

											{/* Badge Gender Santri */}
											<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-black ${
												isSantriPutra ? 'bg-sky-200 text-sky-950' : 'bg-pink-200 text-pink-950'
											}`}>
												{isSantriPutra ? '👦 Putra' : '👧 Putri'}
											</span>

											<span className='font-mono text-xs font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-300'>
												{item.nomor_surat}
											</span>
											<span className='text-xs font-bold text-gray-500'>
												Pukul {String(item.waktu_surat || '').slice(0, 5)} WIB
											</span>

											{item.status_absensi && (
												<span className='text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400'>
													Absensi: {item.status_absensi}
												</span>
											)}

											{isKeluarAktif && (
												<span className='px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500 text-white animate-pulse'>
													⚠️ Belum Kembali
												</span>
											)}

											{isUksAktif && (
												<span className='px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white animate-pulse'>
													🏥 Sedang di UKS
												</span>
											)}

											{item.status_surat === 'selesai' && item.waktu_kembali && (
												<span className='px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white'>
													✓ Kembali pk {String(item.waktu_kembali).slice(0, 5)} WIB
												</span>
											)}

											{isDibatalkan && (
												<span className='px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-400 text-white'>
													Dibatalkan
												</span>
											)}
										</div>

										<div>
											<h3 className='text-base sm:text-lg font-black text-[#0D0D0D] uppercase tracking-tight flex items-center gap-2'>
												<span>{item.nama_siswa}</span>
												<span className='text-xs font-bold px-2 py-0.5 rounded-lg border-2 border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D]'>
													Kelas {item.kelas}
												</span>
											</h3>
											{item.nis && <p className='text-xs font-mono font-bold text-gray-500'>NIS: {item.nis}</p>}
										</div>

										{/* Alasan & Jam Berlaku */}
										<div className='text-xs space-y-1 font-bold text-gray-800 bg-[#FFF5F0] p-2.5 rounded-xl border border-[#0D0D0D]'>
											<p>
												<span className='text-gray-500'>Keperluan/Alasan:</span> {item.alasan}
											</p>
											<div className='flex flex-wrap items-center gap-4 text-[11px] text-gray-600 font-normal'>
												{item.tanggal_selesai && item.tanggal_selesai !== item.tanggal ? (
													<span className='font-bold text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-400'>
														🗓️ <b>Rentang Izin:</b> {item.tanggal} s/d {item.tanggal_selesai} (Seharian Penuh)
													</span>
												) : (
													<span>
														🕒 <b>Jam Berlaku:</b>{' '}
														{item.berlaku_seharian
															? 'Seharian Penuh'
															: item.jam_ke_mulai === item.jam_ke_selesai
															? `Jam ke-${item.jam_ke_mulai}`
															: `Jam ke-${item.jam_ke_mulai} s/d ${item.jam_ke_selesai}`}
													</span>
												)}
												{item.penjemput && (
													<span>
														👤 <b>Dijemput oleh:</b> {item.penjemput}{' '}
														{item.relasi_penjemput ? `(${item.relasi_penjemput})` : ''}
													</span>
												)}
												{item.no_telp_penjemput && (
													<span>
														📞 <b>Kontak:</b> {item.no_telp_penjemput}
													</span>
												)}
												<span>
													👮 <b>Petugas:</b> {item.petugas_nama || 'Satpam'}
												</span>
											</div>
										</div>
									</div>

									{/* Action Buttons */}
									<div className='flex flex-wrap items-center md:flex-col justify-end gap-2 shrink-0'>
										{isKeluarAktif && (
											<button
												onClick={() => handleTandaiKembali(item)}
												className='px-3.5 py-2 bg-[#00A693] hover:bg-emerald-600 text-white border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5'>
												<span>✅</span> Tandai Kembali
											</button>
										)}

										{isUksAktif && (
											<button
												onClick={() => handleTandaiKembali(item)}
												className='px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-[#0D0D0D] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1.5'>
												<span>🏥</span> Kembali ke Kelas
											</button>
										)}

										{!isDibatalkan && (
											<button
												onClick={() => handleBatalkanSurat(item)}
												className='px-2.5 py-1.5 bg-white hover:bg-rose-50 text-[#E8451A] border-2 border-[#0D0D0D] rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D] transition-all'>
												Batalkan
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* ============================================================ */}
			{/* MODAL: TERBITKAN SURAT DIGITAL POS KEAMANAN                  */}
			{/* ============================================================ */}
			{isModalOpen && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto'>
					<div className='bg-white border-4 border-[#0D0D0D] rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-[8px_8px_0px_0px_#0D0D0D] my-8 max-h-[90vh] overflow-y-auto'>
						<div className='flex items-center justify-between border-b-2 border-[#0D0D0D] pb-3 mb-4'>
							<div className='flex items-center gap-2.5'>
								<span className='text-2xl'>{isPutri ? '🧕' : '👮‍♂️'}</span>
								<div>
									<h2 className='text-lg font-black text-[#0D0D0D] uppercase'>
										Terbitkan Surat Izin Digital
									</h2>
									<p className='text-xs font-bold text-gray-500'>
										{isPutra ? 'Pos Keamanan Santri Putra (Bani)' : isPutri ? 'Pos Keamanan Santriwati Putri (Banat)' : 'Pos Gerbang Keamanan'}
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsModalOpen(false)}
								className='w-8 h-8 rounded-full border-2 border-[#0D0D0D] bg-rose-200 text-rose-900 font-black flex items-center justify-center hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmitSurat} className='space-y-4'>
							{/* 1. Pilih Kelas Terlebih Dahulu */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
									Pilih Kelas Santri <span className='text-rose-600'>*</span>
								</label>
								<select
									value={modalKelas}
									onChange={(e) => {
										const val = e.target.value;
										setModalKelas(val);
										setSelectedSiswaObj(null);
										setModalSearchSiswa('');
										setIsComboboxOpen(false);
									}}
									className='neo-input text-sm font-bold bg-[#FFF5F0] w-full cursor-pointer'>
									<option value=''>-- Pilih Kelas Santri --</option>
									{availableKelasList.map((k) => (
										<option key={k} value={k}>
											Kelas {k}
										</option>
									))}
								</select>
							</div>

							{/* 2. Pilih Santri di Kelas Tersebut (Combobox) */}
							<div className='space-y-1.5 relative' ref={comboboxRef}>
								<div className='flex items-center justify-between'>
									<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
										Pilih Santri <span className='text-rose-600'>*</span>{' '}
										<span className='font-normal text-[10px] text-gray-500'>
											{isPutra ? '(Khusus Santri Putra)' : isPutri ? '(Khusus Santriwati Putri)' : ''}
										</span>
									</label>
									{modalKelas && (
										<span className='text-[10px] font-bold text-gray-500'>
											{siswaDiKelasTerpilih.length} santri terdata di kelas {modalKelas}
										</span>
									)}
								</div>

								{!modalKelas ? (
									<div className='neo-input text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-between'>
										<span>Pilih kelas santri terlebih dahulu di atas...</span>
										<span className='text-xs'>🔒</span>
									</div>
								) : (
									<div className='relative'>
										<div className='relative flex items-center'>
											<input
												type='text'
												placeholder={
													isPutra
														? `Ketik nama santri putra kelas ${modalKelas}...`
														: isPutri
														? `Ketik nama santriwati putri kelas ${modalKelas}...`
														: `Ketik nama santri kelas ${modalKelas}...`
												}
												value={modalSearchSiswa}
												onFocus={() => setIsComboboxOpen(true)}
												onChange={(e) => {
													setModalSearchSiswa(e.target.value);
													setIsComboboxOpen(true);
													if (selectedSiswaObj && e.target.value !== selectedSiswaObj.nama_lengkap) {
														setSelectedSiswaObj(null);
													}
												}}
												className='neo-input text-sm font-bold bg-[#FFF5F0] w-full pr-16'
											/>
											<div className='absolute right-2 flex items-center gap-1'>
												{modalSearchSiswa && (
													<button
														type='button'
														onClick={() => {
															setModalSearchSiswa('');
															setSelectedSiswaObj(null);
															setIsComboboxOpen(true);
														}}
														className='text-gray-400 hover:text-black font-black text-xs px-1.5 py-0.5 rounded cursor-pointer'>
														✕
													</button>
												)}
												<button
													type='button'
													onClick={() => setIsComboboxOpen((prev) => !prev)}
													className='text-[#0D0D0D] p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer'
													title='Buka/Tutup daftar santri'>
													<svg
														className={`w-4 h-4 transition-transform ${isComboboxOpen ? 'rotate-180' : ''}`}
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'>
														<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M19 9l-7 7-7-7' />
													</svg>
												</button>
											</div>
										</div>

										{/* Combobox Dropdown List */}
										{isComboboxOpen && (
											<div className='absolute left-0 right-0 top-full mt-1.5 bg-white border-3 border-[#0D0D0D] rounded-xl shadow-[4px_4px_0px_0px_#0D0D0D] z-30 max-h-52 overflow-y-auto divide-y-2 divide-gray-100'>
												{filteredSiswaCombobox.length === 0 ? (
													<div className='p-3 text-center text-xs font-bold text-gray-500'>
														Tidak ada santri yang cocok dengan &ldquo;{modalSearchSiswa}&rdquo; di kelas {modalKelas}
													</div>
												) : (
													filteredSiswaCombobox.map((s) => {
														const isSelected = selectedSiswaObj?.id === s.id;
														return (
															<button
																key={s.id}
																type='button'
																onClick={() => {
																	handleSelectSiswa(s);
																	setIsComboboxOpen(false);
																}}
																className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs font-bold transition-colors cursor-pointer ${
																	isSelected ? 'bg-emerald-100 text-emerald-950 font-black' : 'hover:bg-amber-100'
																}`}>
																<div>
																	<p className='text-[#0D0D0D] font-black flex items-center gap-1.5'>
																		<span>{s.nama_lengkap}</span>
																		<span
																			className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
																				s.jenis_kelamin === 'Laki-laki'
																					? 'bg-sky-200 text-sky-900'
																					: 'bg-pink-200 text-pink-900'
																			}`}>
																			{s.jenis_kelamin === 'Laki-laki' ? '👦 L' : '👧 P'}
																		</span>
																	</p>
																	<p className='text-[10px] text-gray-500 font-mono'>NIS: {s.nis || '-'}</p>
																</div>
																<div className='flex items-center gap-2'>
																	<span className='px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold'>
																		Kelas {s.kelas}
																	</span>
																	{isSelected && <span className='text-emerald-700 font-black'>✓</span>}
																</div>
															</button>
														);
													})
												)}
											</div>
										)}
									</div>
								)}

								{selectedSiswaObj && (
									<div className='flex items-center justify-between bg-emerald-100 border-2 border-[#0D0D0D] p-2.5 rounded-xl text-xs font-bold text-emerald-950 mt-1 shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='flex items-center gap-1.5'>
											<span className='text-base'>✓</span>
											<span>
												Santri Terpilih: <b>{selectedSiswaObj.nama_lengkap}</b> &bull; Kelas{' '}
												<b>{selectedSiswaObj.kelas}</b> ({selectedSiswaObj.jenis_kelamin === 'Laki-laki' ? '👦 Putra' : '👧 Putri'})
											</span>
										</span>
										<button
											type='button'
											onClick={() => {
												setSelectedSiswaObj(null);
												setModalSearchSiswa('');
												setIsComboboxOpen(true);
											}}
											className='text-xs text-rose-700 hover:text-rose-900 hover:underline font-black px-2 py-0.5 rounded border border-rose-400 bg-white shadow-[1px_1px_0px_0px_#0D0D0D] cursor-pointer'>
											Ganti
										</button>
									</div>
								)}
							</div>

							{/* 2. Pilihan Jenis Surat (Termasuk izin_uks) */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
									Jenis Surat Izin <span className='text-rose-600'>*</span>
								</label>
								<div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
									{[
										{ id: 'terlambat', label: '🕒 Terlambat', absensi: 'Izin' },
										{ id: 'izin_keluar', label: '🚪 Izin Keluar', absensi: 'Izin' },
										{ id: 'pulang_cepat', label: '🏠 Pulang Cepat', absensi: 'Sakit' },
										{ id: 'izin_uks', label: '🏥 Istirahat UKS', absensi: 'Sakit' },
										{ id: 'tidak_masuk', label: '📋 Titip Izin/Sakit', absensi: 'Izin' },
									].map((opt) => (
										<button
											key={opt.id}
											type='button'
											onClick={() =>
												setFormData({
													...formData,
													tipe_surat: opt.id,
													status_absensi: opt.absensi,
													berlaku_seharian: opt.id === 'tidak_masuk',
												})
											}
											className={`p-2 rounded-xl border-2 border-[#0D0D0D] text-xs font-black uppercase text-center transition-all ${
												formData.tipe_surat === opt.id
													? 'bg-[#F5C518] text-[#0D0D0D] shadow-none translate-x-[2px] translate-y-[2px]'
													: 'bg-white hover:bg-gray-50 text-gray-700 shadow-[2px_2px_0px_0px_#0D0D0D]'
											}`}>
											{opt.label}
										</button>
									))}
								</div>
								{formData.tipe_surat === 'izin_uks' && (
									<p className='text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 p-2 rounded-lg'>
										🏥 <b>Catatan UKS:</b> Santri tetap berada di lingkungan sekolah/pondok. Presensi jam pelajaran di kelas otomatis diberi dispensasi <b>Sakit</b> tanpa dianggap alpa.
									</p>
								)}
							</div>

							{/* 3. Rentang Tanggal Izin */}
							<div className='p-3 bg-indigo-50/70 border-2 border-[#0D0D0D] rounded-xl space-y-2.5'>
								<div className='flex items-center justify-between gap-2'>
									<label className='block text-xs font-black uppercase text-indigo-950'>
										🗓️ Periode / Tanggal Izin <span className='text-rose-600'>*</span>
									</label>
									<label className='flex items-center gap-1.5 text-xs font-bold text-indigo-900 cursor-pointer select-none'>
										<input
											type='checkbox'
											checked={formData.is_rentang_tanggal}
											onChange={(e) =>
												setFormData({
													...formData,
													is_rentang_tanggal: e.target.checked,
													berlaku_seharian: e.target.checked ? true : formData.berlaku_seharian,
												})
											}
											className='cursor-pointer w-3.5 h-3.5'
										/>
										<span>Izin Berhari-hari (Rentang Tanggal)</span>
									</label>
								</div>

								{formData.is_rentang_tanggal ? (
									<div className='space-y-2'>
										<div className='grid grid-cols-2 gap-2'>
											<div>
												<span className='block text-[10px] font-bold text-gray-600 mb-0.5'>Tanggal Mulai</span>
												<input
													type='date'
													value={formData.tanggal_mulai}
													onChange={(e) => {
														const newStart = e.target.value;
														setFormData({
															...formData,
															tanggal_mulai: newStart,
															tanggal_selesai: formData.tanggal_selesai < newStart ? newStart : formData.tanggal_selesai,
														});
													}}
													className='neo-input text-xs font-bold bg-white w-full'
												/>
											</div>
											<div>
												<span className='block text-[10px] font-bold text-gray-600 mb-0.5'>Tanggal Selesai</span>
												<input
													type='date'
													min={formData.tanggal_mulai}
													value={formData.tanggal_selesai}
													onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value })}
													className='neo-input text-xs font-bold bg-white w-full'
												/>
											</div>
										</div>
										<div className='p-2 bg-indigo-100 rounded-lg border border-indigo-300 text-[11px] font-bold text-indigo-950 flex items-center justify-between'>
											<span>
												✓ <b>Durasi:</b>{' '}
												{Math.max(1, Math.round((new Date(formData.tanggal_selesai) - new Date(formData.tanggal_mulai)) / (1000 * 60 * 60 * 24)) + 1)}{' '}
												Hari (Otomatis berlaku seharian penuh di presensi mapel kelas)
											</span>
										</div>
									</div>
								) : (
									<div className='flex items-center gap-2'>
										<span className='text-xs font-bold text-gray-700'>Tanggal:</span>
										<input
											type='date'
											value={formData.tanggal_mulai}
											onChange={(e) =>
												setFormData({
													...formData,
													tanggal_mulai: e.target.value,
													tanggal_selesai: e.target.value,
												})
											}
											className='neo-input text-xs font-bold bg-white !py-1'
										/>
										<span className='text-[10px] text-gray-500 font-bold'>(1 Hari)</span>
									</div>
								)}
							</div>

							{/* 4. Status Absensi & Jam Berlaku */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-[#0D0D0D] mb-1'>
										Status Absensi Mapel
									</label>
									<select
										value={formData.status_absensi}
										onChange={(e) => setFormData({ ...formData, status_absensi: e.target.value })}
										className='neo-input text-xs font-bold bg-white'>
										<option value='Izin'>Izin</option>
										<option value='Sakit'>Sakit</option>
										<option value='Hadir'>Hadir (dengan catatan)</option>
									</select>
								</div>

								{!formData.is_rentang_tanggal ? (
									<div className='space-y-1'>
										<div className='flex items-center justify-between mb-1'>
											<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
												Jam Ke Berapa?
											</label>
											<label className='flex items-center gap-1 text-[11px] font-bold text-gray-700 cursor-pointer'>
												<input
													type='checkbox'
													checked={formData.berlaku_seharian}
													onChange={(e) => setFormData({ ...formData, berlaku_seharian: e.target.checked })}
													className='cursor-pointer'
												/>
												<span>Seharian Penuh</span>
											</label>
										</div>

										{!formData.berlaku_seharian ? (
											<div className='flex items-center gap-2'>
												<input
													type='number'
													min='1'
													max='12'
													placeholder='Mulai'
													value={formData.jam_ke_mulai}
													onChange={(e) => setFormData({ ...formData, jam_ke_mulai: e.target.value })}
													className='neo-input text-xs font-mono font-bold text-center'
												/>
												<span className='font-bold text-xs'>s/d</span>
												<input
													type='number'
													min='1'
													max='12'
													placeholder='Selesai'
													value={formData.jam_ke_selesai}
													onChange={(e) => setFormData({ ...formData, jam_ke_selesai: e.target.value })}
													className='neo-input text-xs font-mono font-bold text-center'
												/>
											</div>
										) : (
											<div className='py-2 px-3 bg-purple-100 border border-[#0D0D0D] rounded-xl text-xs font-bold text-purple-900'>
												✓ Berlaku untuk seluruh jam pelajaran hari ini
											</div>
										)}
									</div>
								) : (
									<div className='flex flex-col justify-center p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950'>
										<span>✓ Izin Multi-Hari</span>
										<span className='text-[10px] text-emerald-800 font-normal'>Otomatis berlaku seharian penuh pada tanggal-tanggal tersebut.</span>
									</div>
								)}
							</div>

							{/* 4. Alasan / Keperluan + Quick Chips */}
							<div className='space-y-1.5'>
								<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
									Alasan / Keperluan <span className='text-rose-600'>*</span>
								</label>
								<textarea
									rows='2'
									placeholder='Tuliskan alasan izin siswa...'
									value={formData.alasan}
									onChange={(e) => setFormData({ ...formData, alasan: e.target.value })}
									className='neo-input text-xs font-bold w-full'
								/>

								{/* Quick chips saran */}
								<div className='flex flex-wrap items-center gap-1.5 mt-1'>
									<span className='text-[10px] font-black uppercase text-gray-400'>Saran:</span>
									{(quickReasons[formData.tipe_surat] || []).map((reason, idx) => (
										<button
											key={idx}
											type='button'
											onClick={() => setFormData({ ...formData, alasan: reason })}
											className='px-2 py-0.5 rounded-lg border border-gray-400 bg-gray-100 hover:bg-[#F5C518] hover:border-black text-[10px] font-bold text-gray-700 transition-colors'>
											{reason}
										</button>
									))}
								</div>
							</div>

							{/* 5. Nama Penjemput & Status Mahram (Khusus Pulang Cepat & Izin Keluar) */}
							{(formData.tipe_surat === 'pulang_cepat' || formData.tipe_surat === 'izin_keluar') && (
								<div className='p-3 bg-yellow-50 border-2 border-black rounded-xl space-y-2.5'>
									<div className='space-y-1'>
										<label className='block text-xs font-black uppercase text-[#0D0D0D]'>
											Nama Penjemput / Pendamping {formData.tipe_surat === 'pulang_cepat' && <span className='text-rose-600'>*</span>}
										</label>
										<input
											type='text'
											placeholder='Contoh: Bapak Ahmad Fauzi / Sendiri'
											value={formData.penjemput}
											onChange={(e) => setFormData({ ...formData, penjemput: e.target.value })}
											className='neo-input text-xs font-bold bg-white'
										/>
									</div>

									{/* Status Mahram & Hubungan (Sangat penting untuk Santriwati Putri) */}
									<div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
										<div>
											<label className='block text-[11px] font-bold uppercase text-gray-700 mb-1'>
												Hubungan / Status Mahram
											</label>
											<select
												value={formData.relasi_penjemput}
												onChange={(e) => setFormData({ ...formData, relasi_penjemput: e.target.value })}
												className='neo-input text-xs font-bold bg-white'>
												<option value=''>-- Pilih Relasi --</option>
												<option value='Ayah Kandung (Mahram)'>Ayah Kandung (Mahram)</option>
												<option value='Ibu Kandung'>Ibu Kandung</option>
												<option value='Kakak/Adik Kandung Laki-laki (Mahram)'>Kakak/Adik Kandung Laki-laki (Mahram)</option>
												<option value='Paman / Kakek Kandung (Mahram)'>Paman / Kakek Kandung (Mahram)</option>
												<option value='Wali Resmi Surat Kuasa'>Wali Resmi (Surat Kuasa)</option>
												<option value='Sendiri / Mandiri'>Sendiri / Mandiri</option>
											</select>
										</div>
										<div>
											<label className='block text-[11px] font-bold uppercase text-gray-700 mb-1'>
												No. WhatsApp / HP Penjemput
											</label>
											<input
												type='tel'
												placeholder='0812xxxxxxxx'
												value={formData.no_telp_penjemput}
												onChange={(e) => setFormData({ ...formData, no_telp_penjemput: e.target.value })}
												className='neo-input text-xs font-mono font-bold bg-white'
											/>
										</div>
									</div>
								</div>
							)}

							{/* 6. Tombol Aksi */}
							<div className='pt-3 border-t-2 border-[#0D0D0D] flex items-center justify-end gap-2.5'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='neo-btn-outline bg-gray-200 text-[#0D0D0D] text-xs py-2.5 px-4 font-black'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submitting}
									className='neo-btn-primary bg-[#00A693] text-white text-xs py-2.5 px-6 font-black uppercase flex items-center gap-2'>
									<span>🚀</span>
									<span>{submitting ? 'Menerbitkan...' : 'Terbitkan Surat Digital'}</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
