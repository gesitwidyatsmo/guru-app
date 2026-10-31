'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Loader from '../components/loading';
import Swal from 'sweetalert2';
import {
	Users,
	Calendar,
	CheckCircle2,
	AlertTriangle,
	Award,
	BookOpen,
	ArrowLeft,
	Search,
	ExternalLink,
	UserCheck,
	ShieldAlert,
	FileText,
	ChevronRight,
	Clock,
	Zap,
	RefreshCw,
	AlertCircle,
	HeartHandshake,
	Plus,
	Trash2,
	Edit3,
	Printer,
	Copy,
	Check,
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { isWithinGeofence, formatDistance } from '@/lib/haversine';
import { normStatus } from '@/lib/absensiUtils';
import GeofenceStatusCard from '@/app/components/GeofenceStatusCard';
import { fetchSchoolProfile, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import { getTodayDateString } from '@/lib/dateUtils';
import LembarBimbinganDocument from '@/app/components/LembarBimbinganDocument';

function WaliKelasHubContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const rawTab = searchParams.get('tab') || 'ringkasan';

	// Mapping URL tab ke 4 kategori utama (backward compatible)
	let defaultMainTab = 'ringkasan';
	let defaultSubPembinaan = 'bimbingan';
	let defaultSubAkademik = 'siswa';

	if (rawTab === 'presensi') {
		defaultMainTab = 'presensi';
	} else if (rawTab === 'bimbingan') {
		defaultMainTab = 'pembinaan';
		defaultSubPembinaan = 'bimbingan';
	} else if (rawTab === 'poin') {
		defaultMainTab = 'pembinaan';
		defaultSubPembinaan = 'poin';
	} else if (rawTab === 'siswa') {
		defaultMainTab = 'akademik';
		defaultSubAkademik = 'siswa';
	} else if (rawTab === 'leger') {
		defaultMainTab = 'akademik';
		defaultSubAkademik = 'leger';
	} else if (rawTab === 'pembinaan') {
		defaultMainTab = 'pembinaan';
	} else if (rawTab === 'akademik') {
		defaultMainTab = 'akademik';
	}

	const [activeTab, setActiveTab] = useState(defaultMainTab);
	const [subTabPembinaan, setSubTabPembinaan] = useState(defaultSubPembinaan);
	const [subTabAkademik, setSubTabAkademik] = useState(defaultSubAkademik);
	const [dataHub, setDataHub] = useState(null);
	const [loading, setLoading] = useState(true);
	const [searchSiswa, setSearchSiswa] = useState('');
	const [syncing, setSyncing] = useState(false);
	const [editedStatuses, setEditedStatuses] = useState({});

	// Geolocation & Geofencing State
	const { getPosition, loading: gpsLoading } = useGeolocation();
	const [geofenceSettings, setGeofenceSettings] = useState(null);
	const [locationStatus, setLocationStatus] = useState(null);

	const fetchHubData = useCallback(async () => {
		try {
			const res = await fetch('/api/wali-kelas/my-class');
			if (!res.ok) {
				if (res.status === 401) {
					router.replace('/login');
					return;
				}
				throw new Error('Gagal memuat data kelas binaan');
			}
			const data = await res.json();
			setDataHub(data);

			// Ambil pengaturan geofence sekolah
			try {
				const geoRes = await fetch('/api/settings?key=geofence');
				if (geoRes.ok) {
					const geoData = await geoRes.json();
					if (geoData?.value) setGeofenceSettings(geoData.value);
				}
			} catch (geoErr) {
				console.warn('Gagal memuat pengaturan geofence:', geoErr);
			}
		} catch (err) {
			console.error('Error Hub Wali Kelas:', err);
			Swal.fire({
				icon: 'error',
				title: 'Terjadi Kesalahan',
				text: err.message || 'Tidak dapat memuat data Hub Wali Kelas',
			});
		} finally {
			setLoading(false);
		}
	}, [router]);

	useEffect(() => {
		fetchHubData();
	}, [fetchHubData]);

	const {
		isWaliKelas,
		kelas,
		tahunAjar,
		stats,
		siswaList = [],
		siswaPerhatian = [],
		siswaBolosList = [],
		siswaMapelBreakdown = [],
	} = dataHub || {};

	// Filter siswa di Tab Siswa
	const filteredSiswa = useMemo(() => {
		if (!siswaList) return [];
		if (!searchSiswa.trim()) return siswaList;
		const q = searchSiswa.toLowerCase();
		return siswaList.filter(
			(s) =>
				(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
				(s.nis && s.nis.toLowerCase().includes(q))
		);
	}, [siswaList, searchSiswa]);

	// Handler untuk 1-Klik Sahkan Presensi Harian dari Agregasi Mapel
	const handleSyncPresensi = async () => {
		if (!kelas || !stats?.absensiHariIni) return;

		// Pengecekan Geofencing jika diaktifkan untuk absensi dan bukan Admin
		let userCoords = null;
		if (geofenceSettings?.enabled && (geofenceSettings.berlaku_untuk || []).includes('absensi') && dataHub?.userRole !== 'Admin') {
			try {
				if (locationStatus?.checked && locationStatus?.isInside && locationStatus?.userLat) {
					userCoords = { lat: locationStatus.userLat, lng: locationStatus.userLng };
				} else {
					userCoords = await getPosition();
					const check = isWithinGeofence(userCoords.lat, userCoords.lng, geofenceSettings.lat, geofenceSettings.lng, geofenceSettings.radius);
					setLocationStatus({ ...check, checked: true, userLat: userCoords.lat, userLng: userCoords.lng });

					if (!check.isInside) {
						await Swal.fire({
							icon: 'error',
							title: 'Di Luar Area Sekolah',
							html: `
								<div class="text-left text-sm space-y-2">
									<p>Sistem mendeteksi posisi Anda saat ini di luar area <b>${geofenceSettings.nama_lokasi || 'Sekolah'}</b>.</p>
									<div class="bg-red-50 p-3 rounded border border-red-200">
										<p class="text-xs text-gray-700">Jarak Anda ke sekolah: <b class="text-red-600 text-sm">${formatDistance(check.distance)}</b></p>
										<p class="text-xs text-gray-500 mt-1">Radius maksimum yang diizinkan: <b>${geofenceSettings.radius} meter</b></p>
									</div>
									<p class="text-xs text-gray-600 font-medium">Pengesahan presensi harian hanya dapat dilakukan dari lingkungan sekolah.</p>
								</div>
							`,
							confirmButtonColor: '#E8451A',
							confirmButtonText: 'Tutup',
						});
						return;
					}
				}
			} catch (gpsErr) {
				await Swal.fire({
					icon: 'warning',
					title: 'Akses Lokasi Wajib',
					html: `
						<div class="text-left text-sm space-y-2">
							<p>Sekolah mewajibkan verifikasi lokasi GPS untuk mengesahkan presensi harian siswa.</p>
							<p class="text-xs text-red-600 font-bold">${gpsErr.message || 'Gagal membaca GPS'}</p>
							<p class="text-xs text-gray-600">Pastikan GPS aktif dan izin lokasi telah diberikan di browser perangkat Anda.</p>
						</div>
					`,
					confirmButtonColor: '#E8451A',
					confirmButtonText: 'Mengerti',
				});
				return;
			}
		}

		const confirm = await Swal.fire({
			title: 'Sahkan Presensi Harian?',
			text: 'Data hasil agregasi sesi mapel hari ini (siswa hadir jika minimal mengikuti 1 JP) akan disimpan resmi ke Buku Absensi Harian kelas ini.',
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: '⚡ Ya, Sahkan Sekarang!',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#00A693',
			cancelButtonColor: '#0D0D0D',
		});

		if (!confirm.isConfirmed) return;

		setSyncing(true);
		try {
			// Susun payload dari breakdown mapel (dengan mempertimbangkan edit status dari wali kelas jika ada)
			const payloadData = siswaMapelBreakdown.map((s) => {
				const currentStatus =
					editedStatuses[s.siswa_id] ||
					(s.recommendedStatus === 'Belum Ada Data' ? 'Hadir' : s.recommendedStatus);
				return {
					siswa_id: s.siswa_id,
					status: currentStatus,
					keterangan: s.recommendedKeterangan || '',
				};
			});

			const res = await fetch('/api/wali-kelas/sync-presensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id_kelas: kelas.id,
					tanggal: stats.absensiHariIni.tanggal,
					data_absensi: payloadData,
					tahun_ajar: tahunAjar?.nama,
					semester: tahunAjar?.semester,
					user_lat: userCoords?.lat,
					user_lng: userCoords?.lng,
				}),
			});

			const resJson = await res.json();
			if (!res.ok) throw new Error(resJson.error || 'Gagal menyinkronkan presensi');

			await Swal.fire({
				icon: 'success',
				title: 'Presensi Disahkan!',
				text: resJson.message || 'Presensi harian resmi berhasil disimpan.',
				confirmButtonColor: '#00A693',
			});

			// Refresh data hub
			fetchHubData();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal',
				text: err.message,
			});
		} finally {
			setSyncing(false);
		}
	};

	// Bimbingan & Kasus Santri State
	const [bimbinganList, setBimbinganList] = useState([]);
	const [bimbinganSummary, setBimbinganSummary] = useState({
		total: 0,
		menungguBimbingan: 0,
		sudahDibina: 0,
		perluPanggilanOrtu: 0,
		selesai: 0,
	});
	const [loadingBimbingan, setLoadingBimbingan] = useState(false);
	const [searchBimbingan, setSearchBimbingan] = useState('');
	const [statusFilterBimbingan, setStatusFilterBimbingan] = useState('Semua');

	// Form Modal State
	const [showModalBimbingan, setShowModalBimbingan] = useState(false);
	const [selectedKasus, setSelectedKasus] = useState(null);
	const [formSiswa, setFormSiswa] = useState(null);
	const [formJumlahAlpa, setFormJumlahAlpa] = useState(1);
	const [selectedPelanggaranOption, setSelectedPelanggaranOption] = useState('Bolos Jam Pelajaran');
	const [customPelanggaranText, setCustomPelanggaranText] = useState('');
	const [isPelanggaranManual, setIsPelanggaranManual] = useState(false);
	const [formTanggalBimbingan, setFormTanggalBimbingan] = useState(getTodayDateString());
	const [formBentukPenanganan, setFormBentukPenanganan] = useState('');
	const [formHasilCatatan, setFormHasilCatatan] = useState('');
	const [formStatus, setFormStatus] = useState('Sudah Dibina');
	const [formRekomendasi, setFormRekomendasi] = useState('Pembinaan Wali Kelas');
	const [submittingBimbingan, setSubmittingBimbingan] = useState(false);

	// Print Modal State
	const [showPrintModal, setShowPrintModal] = useState(false);
	const [printItem, setPrintItem] = useState(null);
	const [schoolProfile, setSchoolProfile] = useState(DEFAULT_PROFIL_SEKOLAH);

	// Fetch catatan bimbingan kelas ini
	const fetchBimbingan = useCallback(async () => {
		if (!kelas?.nama_kelas) return;
		setLoadingBimbingan(true);
		try {
			const res = await fetch(`/api/kesiswaan/penanganan?kelas=${encodeURIComponent(kelas.nama_kelas)}`);
			if (!res.ok) throw new Error('Gagal memuat catatan bimbingan');
			const json = await res.json();
			setBimbinganList(json.penangananList || []);
			if (json.summary) {
				setBimbinganSummary(json.summary);
			}
		} catch (err) {
			console.error('Error fetch bimbingan:', err);
		} finally {
			setLoadingBimbingan(false);
		}
	}, [kelas?.nama_kelas]);

	useEffect(() => {
		if (kelas?.nama_kelas) {
			fetchBimbingan();
			fetchSchoolProfile()
				.then((p) => {
					if (p) setSchoolProfile(p);
				})
				.catch(() => {});
		}
	}, [kelas?.nama_kelas, fetchBimbingan]);

	// Filter bimbingan list
	const filteredBimbinganList = useMemo(() => {
		let list = bimbinganList;
		if (statusFilterBimbingan && statusFilterBimbingan !== 'Semua') {
			list = list.filter((b) => b.status === statusFilterBimbingan);
		}
		if (searchBimbingan.trim()) {
			const q = searchBimbingan.toLowerCase();
			list = list.filter(
				(b) =>
					(b.nama_santri && b.nama_santri.toLowerCase().includes(q)) ||
					(b.jenis_pelanggaran && b.jenis_pelanggaran.toLowerCase().includes(q)) ||
					(b.bentuk_penanganan && b.bentuk_penanganan.toLowerCase().includes(q)) ||
					(b.hasil_catatan && b.hasil_catatan.toLowerCase().includes(q))
			);
		}
		return list;
	}, [bimbinganList, statusFilterBimbingan, searchBimbingan]);

	const handleOpenAddModal = (defaultSiswa = null, defaultPelanggaran = 'Bolos Jam Pelajaran', defaultAlpa = 1) => {
		setSelectedKasus(null);
		setFormSiswa(defaultSiswa || (siswaList && siswaList.length > 0 ? siswaList[0] : null));
		setFormJumlahAlpa(defaultAlpa || 1);
		setSelectedPelanggaranOption(defaultPelanggaran);
		setCustomPelanggaranText('');
		setIsPelanggaranManual(defaultPelanggaran === 'Lainnya');
		setFormTanggalBimbingan(getTodayDateString());
		setFormBentukPenanganan('');
		setFormHasilCatatan('');
		setFormStatus('Sudah Dibina');
		setFormRekomendasi('Pembinaan Wali Kelas');
		setShowModalBimbingan(true);
	};

	const handleOpenEditModal = (item) => {
		setSelectedKasus(item);
		const s = (siswaList || []).find((sw) => String(sw.id) === String(item.siswa_id)) || {
			id: item.siswa_id,
			nama_lengkap: item.nama_santri,
			nis: item.nis || '',
			kelas: item.kelas,
		};
		setFormSiswa(s);
		setFormJumlahAlpa(item.jumlah_alpa || 1);

		const standardOptions = [
			'Bolos Jam Pelajaran',
			'Keluyuran saat KBM',
			'Tidak Hadir Tanpa Keterangan (Alpa)',
			'Keterlambatan Berulang',
		];
		if (standardOptions.includes(item.jenis_pelanggaran)) {
			setSelectedPelanggaranOption(item.jenis_pelanggaran);
			setIsPelanggaranManual(false);
			setCustomPelanggaranText('');
		} else {
			setSelectedPelanggaranOption('Lainnya');
			setIsPelanggaranManual(true);
			setCustomPelanggaranText(item.jenis_pelanggaran);
		}

		setFormTanggalBimbingan(item.tanggal_bimbingan || getTodayDateString());
		setFormBentukPenanganan(item.bentuk_penanganan || '');
		setFormHasilCatatan(item.hasil_catatan || '');
		setFormStatus(item.status || 'Sudah Dibina');
		setFormRekomendasi(item.rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas');
		setShowModalBimbingan(true);
	};

	const handleSubmitBimbingan = async (e) => {
		e.preventDefault();
		if (!formSiswa) {
			Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih santri terlebih dahulu' });
			return;
		}

		const jenisPelanggaranFinal = isPelanggaranManual
			? customPelanggaranText.trim() || 'Pelanggaran Lainnya'
			: selectedPelanggaranOption;

		setSubmittingBimbingan(true);
		try {
			const payload = {
				siswa_id: formSiswa.id,
				nama_santri: formSiswa.nama_lengkap,
				kelas: kelas.nama_kelas,
				wali_kelas_id: kelas.wali_kelas_id || null,
				wali_kelas_nama: kelas.wali_kelas || 'Wali Kelas',
				jenis_pelanggaran: jenisPelanggaranFinal,
				jumlah_alpa: Number(formJumlahAlpa) || 1,
				tanggal_bimbingan: formTanggalBimbingan,
				bentuk_penanganan: formBentukPenanganan,
				hasil_catatan: formHasilCatatan,
				status: formStatus,
				rekomendasi_tindak_lanjut: formRekomendasi,
				created_by: `Wali Kelas ${kelas.nama_kelas}`,
			};

			if (selectedKasus) {
				payload.id = selectedKasus.id;
				const res = await fetch('/api/kesiswaan/penanganan', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const resJson = await res.json();
				if (!res.ok) throw new Error(resJson.error || 'Gagal memperbarui catatan bimbingan');
			} else {
				const res = await fetch('/api/kesiswaan/penanganan', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const resJson = await res.json();
				if (!res.ok) throw new Error(resJson.error || 'Gagal menyimpan catatan bimbingan');
			}

			Swal.fire({
				icon: 'success',
				title: 'Berhasil Disimpan',
				text: selectedKasus ? 'Catatan bimbingan berhasil diperbarui.' : 'Kasus & bimbingan santri berhasil dicatat.',
				confirmButtonColor: '#10B981',
			});

			setShowModalBimbingan(false);
			fetchBimbingan();
		} catch (err) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: err.message,
			});
		} finally {
			setSubmittingBimbingan(false);
		}
	};

	const handleDeleteBimbingan = async (id, nama) => {
		const confirm = await Swal.fire({
			title: 'Hapus Catatan Bimbingan?',
			text: `Kasus santri ${nama} akan dihapus secara permanen.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
			confirmButtonColor: '#E8451A',
		});

		if (confirm.isConfirmed) {
			try {
				const res = await fetch(`/api/kesiswaan/penanganan?id=${id}`, { method: 'DELETE' });
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Gagal menghapus catatan bimbingan');

				Swal.fire({
					icon: 'success',
					title: 'Terhapus',
					text: 'Catatan bimbingan berhasil dihapus.',
					confirmButtonColor: '#10B981',
				});
				fetchBimbingan();
			} catch (err) {
				Swal.fire({
					icon: 'error',
					title: 'Gagal Menghapus',
					text: err.message,
				});
			}
		}
	};

	const handleCopyWABimbingan = (item) => {
		const text = `*LAPORAN BIMBINGAN SANTRI ROMBEL ${kelas?.nama_kelas?.toUpperCase() || ''}*

Nama Santri : ${item.nama_santri}
Kelas : ${item.kelas}
Wali Kelas : ${item.wali_kelas_nama || kelas?.wali_kelas || '—'}
Jenis Pelanggaran : ${item.jenis_pelanggaran}
Akumulasi Kejadian : ${item.jumlah_alpa} Kali
Tanggal Bimbingan : ${item.tanggal_bimbingan}
Bentuk Pembinaan : ${item.bentuk_penanganan}
Hasil / Evaluasi : ${item.hasil_catatan}
Status Kasus : ${item.status}
Rekomendasi : ${item.rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas'}`;

		navigator.clipboard.writeText(text);
		Swal.fire({
			icon: 'success',
			title: 'Tersalin!',
			text: 'Format teks laporan bimbingan telah disalin ke clipboard.',
			timer: 1500,
			showConfirmButton: false,
		});
	};

	const handleOpenPrintBimbingan = (item) => {
		setPrintItem(item);
		setShowPrintModal(true);
	};

	const handleExecutePrintBimbingan = () => {
		window.print();
	};

	if (loading) {
		return <Loader />;
	}

	// State jika akun login BUKAN wali kelas
	if (!isWaliKelas || !kelas) {
		return (
			<div className='min-h-screen bg-[#FFF5F0] flex items-center justify-center p-4'>
				<div className='max-w-md w-full neo-card bg-white text-center p-8 border-[3px] border-black shadow-[6px_6px_0px_#000]'>
					<div className='w-20 h-20 bg-amber-200 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[3px_3px_0px_#000] text-4xl'>
						🎓
					</div>
					<h2 className='text-2xl font-black uppercase text-black mb-2'>
						Bukan Wali Kelas
					</h2>
					<p className='text-sm font-bold text-gray-700 mb-6'>
						Akun Anda saat ini belum ditugaskan sebagai Wali Kelas untuk rombel aktif mana pun. Penugasan dapat dilakukan oleh Administrator melalui menu Manajemen Kelas.
					</p>
					<div className='flex flex-col gap-3'>
						<Link
							href='/'
							className='neo-btn-primary bg-black text-white py-3 font-black uppercase text-sm text-center'>
							Kembali ke Beranda KBM
						</Link>
						<Link
							href='/kelas'
							className='neo-btn-outline py-2.5 font-bold text-sm text-center'>
							Lihat Daftar Seluruh Kelas
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const absensiToday = stats?.absensiHariIni || {};
	const poinStats = stats?.poin || {};
	const isAutoFeed = absensiToday.source === 'auto_mapel';
	const isOfficial = absensiToday.source === 'official';

	return (
		<div className={`min-h-screen bg-[#FFF5F0] text-black pb-24 font-sans ${showPrintModal ? 'print:hidden' : ''}`}>
			{/* TOP NAVBAR / HEADER */}
			<div className='sticky top-0 z-40 bg-[#F5C518] border-b-[3px] border-black px-4 sm:px-6 py-4 shadow-[0_4px_0_#000]'>
				<div className='max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4'>
					{/* Left: Back & Title */}
					<div className='flex items-center gap-3'>
						<Link
							href='/'
							className='w-10 h-10 bg-white border-2 border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0_#000] hover:bg-black hover:text-white transition-all shrink-0'
							title='Kembali ke Beranda'>
							<ArrowLeft className='w-5 h-5' strokeWidth={2.5} />
						</Link>
						<div>
							<div className='flex flex-wrap items-center gap-2 mb-0.5'>
								<span className='text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 bg-black text-yellow-400 rounded border border-black'>
									🌟 Hub Wali Kelas
								</span>
								<span className='text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 bg-white text-black border border-black rounded'>
									TA {tahunAjar?.nama || '2026/2027'} (Sem {tahunAjar?.semester || 1})
								</span>
							</div>
							<h1 className='text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight'>
								Rombel {kelas.nama_kelas}
							</h1>
						</div>
					</div>

					{/* Right: Quick CTA */}
					<div className='flex flex-wrap items-center gap-2 self-start md:self-auto'>
						<Link
							href='/wali-kelas/biodata'
							className='px-3.5 py-2 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide shadow-[2px_2px_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5'>
							<span>📑 CRUD Biodata Siswa</span>
						</Link>
						<Link
							href={`/kelas/${kelas.id}`}
							className='neo-btn-outline !py-2 !px-3 bg-white text-black flex items-center gap-1.5 text-xs sm:text-sm font-bold'>
							<span>Profil Rombel</span>
							<ExternalLink className='w-3.5 h-3.5' />
						</Link>
					</div>
				</div>
			</div>

			{/* MAIN CONTAINER */}
			<div className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6'>
				{/* TAB BAR (4 Kategori Utama - Responsive Grid Mobile & Desktop) */}
				<div className='grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3'>
					{[
						{
							id: 'ringkasan',
							label: 'Ringkasan',
							sublabel: 'Dashboard Rombel',
							icon: <BookOpen className='w-4 h-4' />,
						},
						{
							id: 'presensi',
							label: `Presensi KBM ${isAutoFeed ? '⚡' : ''}`,
							sublabel: 'Sesi & Rekap Harian',
							icon: <Calendar className='w-4 h-4' />,
						},
						{
							id: 'pembinaan',
							label: 'Pembinaan',
							sublabel: 'Bimbingan & Poin',
							badge: bimbinganList.length > 0 ? `${bimbinganList.length}` : null,
							icon: <HeartHandshake className='w-4 h-4' />,
						},
						{
							id: 'akademik',
							label: 'Data Siswa',
							sublabel: 'Buku Induk & Leger',
							badge: stats?.totalSiswa ? `${stats.totalSiswa}` : null,
							icon: <Users className='w-4 h-4' />,
						},
					].map((tab) => {
						const isActive = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border-[2.5px] border-black transition-all text-left ${
									isActive
										? 'bg-[#E8451A] text-white shadow-[4px_4px_0_#000] -translate-y-0.5'
										: 'bg-white text-black hover:bg-yellow-200 shadow-[2px_2px_0_#000]'
								}`}>
								<div className='flex items-center gap-2.5 min-w-0'>
									<div
										className={`p-1.5 sm:p-2 rounded-xl border-2 border-black shrink-0 ${
											isActive ? 'bg-black text-yellow-300' : 'bg-yellow-100 text-black'
										}`}>
										{tab.icon}
									</div>
									<div className='min-w-0'>
										<div className='font-black text-xs sm:text-sm uppercase tracking-wide truncate'>
											{tab.label}
										</div>
										<div
											className={`text-[10px] sm:text-xs font-bold truncate ${
												isActive ? 'text-white/80' : 'text-gray-500'
											}`}>
											{tab.sublabel}
										</div>
									</div>
								</div>
								{tab.badge && (
									<span
										className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border border-black shrink-0 ml-1.5 ${
											isActive ? 'bg-white text-black' : 'bg-black text-white'
										}`}>
										{tab.badge}
									</span>
								)}
							</button>
						);
					})}
				</div>

				{/* ======================================================== */}
				{/* TAB 1: RINGKASAN ROMBEL */}
				{/* ======================================================== */}
				{activeTab === 'ringkasan' && (
					<div className='space-y-6'>
						{/* 4 BENTO METRIC CARDS */}
						<div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
							{/* Card 1: Total Siswa */}
							<div className='neo-card bg-[#2F80ED] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Siswa Terdaftar
									</span>
									<Users className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>{stats?.totalSiswa || 0}</div>
								<div className='flex items-center gap-2 text-xs font-bold'>
									<span className='bg-white text-blue-900 px-2 py-0.5 rounded border border-black'>
										👦 {stats?.lakiLaki || 0} L
									</span>
									<span className='bg-white text-blue-900 px-2 py-0.5 rounded border border-black'>
										👧 {stats?.perempuan || 0} P
									</span>
								</div>
							</div>

							{/* Card 2: Kehadiran Hari Ini (Smart Status) */}
							<div className='neo-card bg-[#F5C518] text-black p-5 border-[3px] border-black shadow-[4px_4px_0_#000] flex flex-col justify-between'>
								<div>
									<div className='flex items-center justify-between mb-2'>
										<span className='text-[10px] sm:text-xs font-black uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded'>
											{isOfficial ? 'Presensi Resmi' : isAutoFeed ? 'Agregasi Mapel' : 'Presensi Harian'}
										</span>
										<CheckCircle2 className='w-5 h-5 text-black' />
									</div>
									<div className='text-3xl sm:text-4xl font-black mb-1'>
										{absensiToday.persentaseHadir}%
									</div>
									<div className='text-xs font-bold text-gray-900 mb-2'>
										{absensiToday.hadir} Hadir • {absensiToday.sakit} Sakit • {absensiToday.izin} Izin • {absensiToday.alfa} Alfa
									</div>
								</div>

								{/* Status Indicator: Langsung Sah */}
								<div>
									{absensiToday.recorded || absensiToday.totalSesiMapel > 0 ? (
										<span className='inline-block text-[11px] font-black bg-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0_#000]'>
											✅ Presensi Sah (Terhubung KBM)
										</span>
									) : (
										<span className='inline-block text-[11px] font-black bg-rose-200 text-rose-900 px-2 py-0.5 rounded border border-black'>
											⚠️ Belum Ada Data KBM Hari Ini
										</span>
									)}
								</div>
							</div>

							{/* Card 3: Poin Prestasi */}
							<div className='neo-card bg-[#00A693] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Poin Prestasi
									</span>
									<Award className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>
									+{poinStats.totalPositif || 0}
								</div>
								<p className='text-xs font-bold text-white/90'>
									Akumulasi sikap positif kelas
								</p>
							</div>

							{/* Card 4: Poin Pelanggaran */}
							<div className='neo-card bg-[#E8451A] text-white p-5 border-[3px] border-black shadow-[4px_4px_0_#000]'>
								<div className='flex items-center justify-between mb-3'>
									<span className='text-xs font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded'>
										Poin Pelanggaran
									</span>
									<AlertTriangle className='w-5 h-5 text-white' />
								</div>
								<div className='text-3xl sm:text-4xl font-black mb-2'>
									-{poinStats.totalNegatif || 0}
								</div>
								<p className='text-xs font-bold text-white/90'>
									Perlu pembinaan karakter
								</p>
							</div>
						</div>

						{/* TWO-COLUMN GRID: Early Warning vs Quick Actions */}
						<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
							{/* EARLY WARNING RADAR (2 Columns) */}
							<div className='lg:col-span-2 space-y-6'>
								{/* RADAR 1: SISWA MEMBOLOS JAM TERTENTU / ANOMALI */}
								{siswaBolosList.length > 0 && (
									<div className='neo-card bg-rose-50 p-6 border-[3px] border-rose-600 shadow-[4px_4px_0_#991b1b]'>
										<div className='flex items-center justify-between pb-3 border-b-2 border-rose-600 mb-4'>
											<div className='flex items-center gap-2.5'>
												<div className='w-9 h-9 rounded-xl bg-rose-500 text-white border-2 border-black flex items-center justify-center font-black'>
													🚨
												</div>
												<div>
													<h2 className='text-lg font-black uppercase text-rose-950'>
														Radar Siswa Membolos / Anomali Kehadiran ({siswaBolosList.length} Siswa)
													</h2>
													<p className='text-xs font-bold text-rose-800'>
														Terdeteksi oleh sistem dari perbandingan antar-sesi mata pelajaran hari ini
													</p>
												</div>
											</div>
										</div>

										<div className='space-y-3'>
											{siswaBolosList.map((item, idx) => (
												<div
													key={idx}
													className='p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000] space-y-2.5'>
													<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
														<div>
															<div className='flex items-center gap-2'>
																<span className='font-black text-sm text-black'>{item.nama_lengkap}</span>
																<span className='text-xs font-mono font-bold text-gray-500'>({item.nis || '-'})</span>
															</div>
															<div className='text-xs font-bold text-rose-700 mt-0.5'>
																{item.judulKasus}: <span className='font-black'>{item.keterangan}</span>
															</div>
														</div>
														<div className='flex items-center gap-2 shrink-0'>
															<button
																type='button'
																onClick={() => {
																	const s = (siswaList || []).find((sw) => String(sw.id) === String(item.siswa_id)) || {
																		id: item.siswa_id,
																		nama_lengkap: item.nama_lengkap,
																		nis: item.nis || '',
																		kelas: kelas.nama_kelas,
																	};
																	handleOpenAddModal(s, item.judulKasus || 'Bolos Jam Pelajaran', 1);
																}}
																className='neo-btn-primary !py-1 !px-2.5 bg-amber-400 hover:bg-amber-500 text-black text-xs font-black flex items-center gap-1 shadow-[2px_2px_0_#000]'>
																<HeartHandshake className='w-3.5 h-3.5' />
																<span>Bina Kasus</span>
															</button>
															<Link
																href={`/kelas/${kelas.id}/poin`}
																className='neo-btn-primary !py-1 !px-2.5 bg-rose-600 text-white text-xs font-black flex items-center gap-1'>
																<ShieldAlert className='w-3.5 h-3.5' />
																<span>+ Catat Poin Bolos</span>
															</Link>
															<Link
																href={`/siswa/${item.siswa_id}`}
																className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold'>
																Profil
															</Link>
														</div>
													</div>

													{/* Timeline Visual Sesi Mapel Siswa Ini */}
													<div className='flex flex-wrap items-center gap-2 pt-2 border-t border-black/10'>
														<span className='text-[10px] font-black uppercase text-gray-600'>Sesi Hari Ini:</span>
														{item.sessions.map((sesi, sIdx) => {
															const isAlfa = (sesi.status || '').toLowerCase() === 'alfa';
															return (
																<span
																	key={sIdx}
																	className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
																		isAlfa
																			? 'bg-rose-400 text-white animate-pulse'
																			: 'bg-emerald-100 text-emerald-950'
																	}`}>
																	Jam {sesi.jam_ke} ({sesi.mapel}): {sesi.status}
																</span>
															);
														})}
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* RADAR 2: SISWA DENGAN POIN MINUS / PERILAKU */}
								<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000]'>
									<div className='flex items-center justify-between pb-4 border-b-2 border-black mb-4'>
										<div className='flex items-center gap-2.5'>
											<div className='w-9 h-9 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center font-black'>
												⚠️
											</div>
											<div>
												<h2 className='text-lg font-black uppercase text-black'>
													Radar Siswa Perlu Atensi Karakter
												</h2>
												<p className='text-xs font-bold text-gray-600'>
													Akumulasi poin kedisiplinan dan catatan pembinaan siswa
												</p>
											</div>
										</div>
										<Link
											href={`/kelas/${kelas.id}/poin`}
											className='text-xs font-black uppercase text-blue-700 hover:underline flex items-center gap-1'>
											Lihat Semua <ChevronRight className='w-3.5 h-3.5' />
										</Link>
									</div>

									{siswaPerhatian.length === 0 ? (
										<div className='text-center py-8 bg-emerald-50 border-2 border-dashed border-emerald-400 rounded-xl p-4'>
											<div className='text-3xl mb-2'>🎉</div>
											<p className='font-black text-sm text-emerald-900 uppercase'>
												Kondisi Kelas Sangat Baik
											</p>
											<p className='text-xs font-bold text-emerald-700 mt-1'>
												Tidak ada siswa dengan akumulasi poin pelanggaran yang mengkhawatirkan saat ini.
											</p>
										</div>
									) : (
										<div className='space-y-3'>
											{siswaPerhatian.map((siswa, idx) => (
												<div
													key={siswa.id}
													className='flex items-center justify-between p-3.5 bg-amber-50 border-2 border-black rounded-xl hover:bg-amber-100 transition-colors'>
													<div className='flex items-center gap-3'>
														<span className='w-6 h-6 rounded-md bg-black text-white font-black text-xs flex items-center justify-center'>
															{idx + 1}
														</span>
														<div>
															<div className='font-black text-sm text-black'>{siswa.nama_lengkap}</div>
															<div className='text-xs font-bold text-gray-600'>NIS: {siswa.nis || '-'}</div>
														</div>
													</div>
													<div className='flex items-center gap-3'>
														<span className='px-2.5 py-1 bg-rose-200 border-2 border-rose-900 text-rose-950 font-black text-xs rounded-lg'>
															Skor Poin: {siswa.skorPoin}
														</span>
														<Link
															href={`/siswa/${siswa.id}`}
															className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold'>
															Profil
														</Link>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>

							{/* AKSI CEPAT WALI KELAS (1 Column) */}
							<div className='neo-card bg-amber-100 p-6 border-[3px] border-black shadow-[4px_4px_0_#000] flex flex-col justify-between'>
								<div>
									<h2 className='text-lg font-black uppercase text-black mb-4 flex items-center gap-2'>
										<span>⚡</span> Aksi Cepat Wali Kelas
									</h2>
									<div className='space-y-3'>
										{/* JURNAL KBM ROMBEL */}
										<Link
											href={`/kelas/${kelas.id}/jurnal`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-emerald-200 border border-black flex items-center justify-center font-bold text-emerald-900'>
													📖
												</div>
												<span className='font-black text-xs uppercase'>Jurnal KBM Rombel</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>

										{/* BIMBINGAN & KASUS SANTRI */}
										<button
											onClick={() => {
												setActiveTab('pembinaan');
												setSubTabPembinaan('bimbingan');
											}}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group text-left'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-amber-200 border border-black flex items-center justify-center font-bold text-amber-900'>
													🤝
												</div>
												<span className='font-black text-xs uppercase'>Buku Bimbingan &amp; Kasus</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</button>

										<button
											onClick={() => setActiveTab('presensi')}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group text-left'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-indigo-200 border border-black flex items-center justify-center font-bold text-indigo-900'>
													📋
												</div>
												<span className='font-black text-xs uppercase'>Lihat Rekap Presensi KBM</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</button>

										<Link
											href={`/kelas/${kelas.id}/riwayat-absensi`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-teal-200 border border-black flex items-center justify-center font-bold text-teal-900'>
													📅
												</div>
												<span className='font-black text-xs uppercase'>Rekap Kalender Bulanan</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>

										<button
											onClick={() => {
												setActiveTab('pembinaan');
												setSubTabPembinaan('poin');
											}}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group text-left'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-rose-200 border border-black flex items-center justify-center font-bold text-rose-900'>
													🛡️
												</div>
												<span className='font-black text-xs uppercase'>Rekap &amp; Log Poin Siswa</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</button>

										<Link
											href={`/kelas/${kelas.id}/riwayat-nilai`}
											className='w-full neo-card bg-white hover:bg-yellow-300 p-3.5 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between transition-all group'>
											<div className='flex items-center gap-2.5'>
												<div className='w-8 h-8 rounded-lg bg-blue-200 border border-black flex items-center justify-center font-bold text-blue-900'>
													📑
												</div>
												<span className='font-black text-xs uppercase'>Buku Nilai Kelas</span>
											</div>
											<ChevronRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
										</Link>
									</div>
								</div>

								<div className='mt-6 pt-4 border-t-2 border-black/20 text-xs font-bold text-gray-700'>
									Wali Kelas: <span className='font-black text-black'>{kelas.wali_kelas}</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 2: PRESENSI HARIAN (TIMELINE & 50% RULE MATRIX) */}
				{/* ======================================================== */}
				{activeTab === 'presensi' && (
					<div className='space-y-6'>
						<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000]'>
							{/* Header Bar */}
							<div className='flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black mb-6'>
								<div>
									<div className='flex flex-wrap items-center gap-2 mb-1'>
										<span className='text-xs font-black uppercase px-2.5 py-0.5 rounded border border-black bg-emerald-300 text-emerald-950'>
											✅ Presensi Sah &amp; Terhubung KBM
										</span>
										<span className='text-xs font-bold text-gray-600'>
											{absensiToday.tanggal}
										</span>
									</div>
									<h2 className='text-xl sm:text-2xl font-black uppercase text-black'>
										Rekap Presensi KBM Hari Ini
									</h2>
								</div>
								<div className='flex flex-wrap items-center gap-2'>
									<Link
										href={`/kelas/${kelas.id}/riwayat-absensi`}
										className='neo-btn-outline !py-2 !px-3 bg-white text-xs sm:text-sm font-bold flex items-center gap-1.5'>
										<Calendar className='w-4 h-4' />
										<span>Rekap Kalender</span>
									</Link>
								</div>
							</div>

							{/* Geofence Status Card Banner */}
							<GeofenceStatusCard
								geofenceSettings={geofenceSettings}
								moduleName="absensi"
								userRole={dataHub?.userRole}
								locationStatus={locationStatus}
								setLocationStatus={setLocationStatus}
								className="mb-6"
							/>

							{/* Sesi KBM yang Masuk Hari Ini */}
							{absensiToday.sesiMapelToday && absensiToday.sesiMapelToday.length > 0 ? (
								<div className='mb-6 p-4 bg-yellow-50 border-2 border-black rounded-xl'>
									<div className='text-xs font-black uppercase text-black mb-2 flex items-center gap-1.5'>
										<Clock className='w-4 h-4 text-black' />
										<span>Sesi Mata Pelajaran yang Terlaksana Hari Ini ({absensiToday.sesiMapelToday.length} Sesi):</span>
									</div>
									<div className='flex flex-wrap gap-2'>
										{absensiToday.sesiMapelToday.map((sesi, idx) => (
											<div
												key={idx}
												className='px-3 py-1 bg-white border border-black rounded-lg text-xs font-bold shadow-[1px_1px_0_#000]'>
												<span className='font-black'>Jam {sesi.jam_ke}</span>: {sesi.mapel}{' '}
												<span className='text-gray-500'>({sesi.guru})</span>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className='mb-6 p-4 bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl text-xs font-bold text-amber-900'>
									Belum ada sesi guru mapel yang menginput absensi KBM hari ini.
								</div>
							)}

							{/* Summary Counters */}
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6'>
								<div className='p-4 bg-emerald-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-emerald-900'>Hadir</div>
									<div className='text-3xl font-black text-emerald-950 mt-1'>
										{absensiToday.hadir || 0}
									</div>
								</div>
								<div className='p-4 bg-amber-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-amber-900'>Sakit</div>
									<div className='text-3xl font-black text-amber-950 mt-1'>
										{absensiToday.sakit || 0}
									</div>
								</div>
								<div className='p-4 bg-blue-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-blue-900'>Izin</div>
									<div className='text-3xl font-black text-blue-950 mt-1'>
										{absensiToday.izin || 0}
									</div>
								</div>
								<div className='p-4 bg-rose-100 border-2 border-black rounded-xl text-center'>
									<div className='text-xs font-black uppercase text-rose-900'>Alfa / Bolos</div>
									<div className='text-3xl font-black text-rose-950 mt-1'>
										{absensiToday.alfa || 0}
									</div>
								</div>
							</div>

							{/* MATRIKS TIMELINE KEHADIRAN SISWA LENGKAP */}
							<div className='space-y-3'>
								<div className='flex items-center justify-between'>
									<h3 className='text-sm font-black uppercase tracking-wider text-black'>
										Detail Kehadiran per Siswa (Min. 1 JP Hadir = Hadir Hari Ini)
									</h3>
									<span className='text-xs font-bold text-gray-500'>
										{siswaMapelBreakdown.length} Siswa
									</span>
								</div>

								<div className='overflow-x-auto border-2 border-black rounded-xl'>
									<table className='w-full text-left border-collapse text-xs sm:text-sm font-bold'>
										<thead className='bg-[#F5C518] text-black border-b-2 border-black font-black uppercase tracking-wider text-xs'>
											<tr>
												<th className='p-3 border-r-2 border-black w-10 text-center'>No</th>
												<th className='p-3 border-r-2 border-black'>Nama Siswa</th>
												<th className='p-3 border-r-2 border-black'>Sesi Mapel Hari Ini</th>
												<th className='p-3 border-r-2 border-black text-center w-32'>Jam Hadir</th>
												<th className='p-3 border-r-2 border-black text-center w-36'>Status Harian</th>
												<th className='p-3 text-center w-32'>Koreksi</th>
											</tr>
										</thead>
										<tbody className='divide-y-2 divide-black/10 bg-white'>
											{siswaMapelBreakdown.length === 0 ? (
												<tr>
													<td colSpan={6} className='p-6 text-center text-gray-500 italic'>
														Belum ada catatan presensi mapel hari ini.
													</td>
												</tr>
											) : (
												siswaMapelBreakdown.map((item, idx) => {
													const currentStatus =
														editedStatuses[item.siswa_id] ||
														(item.recommendedStatus === 'Belum Ada Data'
															? 'Hadir'
															: item.recommendedStatus);

													return (
														<tr key={item.siswa_id} className='hover:bg-yellow-50 transition-colors'>
															<td className='p-3 border-r-2 border-black/10 text-center font-black'>
																{idx + 1}
															</td>
															<td className='p-3 border-r-2 border-black/10'>
																<div className='font-black text-black'>{item.nama_lengkap}</div>
																<div className='text-[11px] font-mono text-gray-500'>
																	{item.nis || '-'}
																</div>
															</td>
															{/* Visual Timeline Sesi Mapel */}
															<td className='p-3 border-r-2 border-black/10'>
																{item.sessions && item.sessions.length > 0 ? (
																	<div className='flex flex-wrap gap-1.5'>
																		{item.sessions.map((sesi, sIdx) => {
																			const st = normStatus(sesi.status);
																			const isAlfa = st === 'alfa';
																			const isHadir = st === 'hadir';
																			return (
																				<span
																					key={sIdx}
																					title={`${sesi.mapel} (${sesi.guru})`}
																					className={`px-2 py-0.5 rounded text-[10px] font-black border border-black ${
																						isAlfa
																							? 'bg-rose-400 text-white'
																							: isHadir
																							? 'bg-emerald-200 text-emerald-950'
																							: 'bg-amber-200 text-amber-950'
																					}`}>
																					Jam {sesi.jam_ke}: {sesi.status}
																				</span>
																			);
																		})}
																	</div>
																) : (
																	<span className='text-[11px] text-gray-400 italic'>
																		Belum ada sesi tercatat
																	</span>
																)}
															</td>
															{/* Rasio Jam Belajar */}
															<td className='p-3 border-r-2 border-black/10 text-center'>
																<span
																	className={`px-2 py-0.5 rounded text-xs font-black border border-black ${
																		(item.totalJpHadir || 0) >= 1
																			? 'bg-emerald-100 text-emerald-950'
																			: 'bg-rose-100 text-rose-950'
																	}`}>
																	{item.totalJpHadir || 0} / {item.totalRecorded || 0} JP
																</span>
															</td>
															{/* Rekomendasi Status Harian */}
															<td className='p-3 border-r-2 border-black/10 text-center'>
																<span
																	className={`px-2.5 py-1 rounded-lg text-xs font-black border-2 border-black ${
																		currentStatus === 'Hadir'
																			? 'bg-emerald-300 text-emerald-950'
																			: currentStatus === 'Sakit'
																			? 'bg-amber-300 text-amber-950'
																			: currentStatus === 'Izin'
																			? 'bg-blue-300 text-blue-950'
																			: 'bg-rose-400 text-white'
																	}`}>
																	{currentStatus}
																</span>
																{item.isBolosParsial && (
																	<div className='text-[10px] text-rose-600 font-bold mt-1'>
																		⚠️ Bolos {item.totalJpAlfa || 0} JP
																	</div>
																)}
															</td>
															{/* Quick Override Dropdown */}
															<td className='p-3 text-center'>
																<select
																	value={currentStatus}
																	onChange={(e) =>
																		setEditedStatuses((prev) => ({
																			...prev,
																			[item.siswa_id]: e.target.value,
																		}))
																	}
																	className='neo-input !py-1 !px-2 text-xs font-bold bg-white'>
																	<option value='Hadir'>Hadir</option>
																	<option value='Sakit'>Sakit</option>
																	<option value='Izin'>Izin</option>
																	<option value='Alfa'>Alfa</option>
																</select>
															</td>
														</tr>
													);
												})
											)}
										</tbody>
									</table>
								</div>

								{/* Bottom Save Action */}
								{/* Bottom Action: Langsung Sah Otomatis */}
								<div className='pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-yellow-50 p-4 border-2 border-black rounded-xl'>
									<div className='text-xs font-bold text-gray-800'>
										✨ <span className='font-black'>Presensi Langsung Sah:</span> Data kehadiran otomatis terakumulasi langsung dari sesi KBM guru mapel hari ini.
										{Object.keys(editedStatuses).length > 0 && (
											<span className='text-rose-600 block sm:inline sm:ml-2 font-black'>
												(Ada {Object.keys(editedStatuses).length} siswa yang statusnya Anda sesuaikan)
											</span>
										)}
									</div>
									{Object.keys(editedStatuses).length > 0 && (
										<button
											onClick={handleSyncPresensi}
											disabled={syncing}
											className='neo-btn-primary !py-2 !px-4 bg-emerald-600 text-white hover:bg-emerald-700 text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-[2px_2px_0_#000] shrink-0 disabled:opacity-50'>
											<span>{syncing ? 'Menyimpan...' : '💾 Simpan Koreksi Status'}</span>
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ======================================================== */}
				{/* TAB 3: PEMBINAAN & KARAKTER SANTRI                       */}
				{/* ======================================================== */}
				{activeTab === 'pembinaan' && (
					<div className='space-y-6'>
						{/* SUB-NAVIGASI SEGMENTED (Buku Bimbingan vs Poin Karakter) */}
						<div className='flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-2xl border-[2.5px] border-black shadow-[3px_3px_0_#000] w-full sm:w-fit'>
							<button
								type='button'
								onClick={() => setSubTabPembinaan('bimbingan')}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex-1 sm:flex-initial justify-center ${
									subTabPembinaan === 'bimbingan'
										? 'bg-[#F5C518] text-black border-2 border-black shadow-[2px_2px_0_#000] -translate-y-0.5'
										: 'text-gray-700 hover:bg-yellow-50'
								}`}>
								<HeartHandshake className='w-4 h-4' />
								<span>Buku Kasus &amp; Bimbingan ({bimbinganList.length})</span>
							</button>
							<button
								type='button'
								onClick={() => setSubTabPembinaan('poin')}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex-1 sm:flex-initial justify-center ${
									subTabPembinaan === 'poin'
										? 'bg-[#E8451A] text-white border-2 border-black shadow-[2px_2px_0_#000] -translate-y-0.5'
										: 'text-gray-700 hover:bg-rose-50'
								}`}>
								<Award className='w-4 h-4' />
								<span>Skor &amp; Log Poin Karakter</span>
							</button>
						</div>

						{/* SUB-VIEW 1: BUKU BIMBINGAN SANTRI */}
						{subTabPembinaan === 'bimbingan' && (
							<div className='space-y-6'>
								{/* Header Banner */}
								<div className='p-6 bg-gradient-to-r from-amber-100 via-yellow-100 to-orange-100 border-[3px] border-black rounded-3xl shadow-[5px_5px_0px_0px_#0D0D0D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
							<div>
								<div className='flex items-center gap-2 mb-1'>
									<span className='px-2.5 py-0.5 bg-black text-yellow-400 font-black text-xs uppercase rounded'>
										Bimbingan Wali Kelas
									</span>
									<span className='text-xs font-bold text-gray-700 font-mono'>
										Rombel {kelas.nama_kelas}
									</span>
								</div>
								<h2 className='text-xl sm:text-2xl font-black uppercase text-black tracking-tight'>
									Buku Bimbingan &amp; Kasus Santri
								</h2>
								<p className='text-xs sm:text-sm font-semibold text-gray-700 mt-1'>
									Pencatatan pembinaan santri rombel terhadap kasus bolos KBM, ketidakhadiran alfa, dan kedisiplinan yang terhubung ke Kesiswaan &amp; BK.
								</p>
							</div>

							<div className='flex items-center gap-2 shrink-0'>
								<button
									onClick={() => fetchBimbingan()}
									disabled={loadingBimbingan}
									title='Refresh Catatan'
									className='p-2.5 bg-white hover:bg-gray-100 text-black border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 transition-all'>
									<RefreshCw className={`w-4 h-4 ${loadingBimbingan ? 'animate-spin' : ''}`} />
								</button>
								<button
									onClick={() => handleOpenAddModal()}
									className='px-4 py-2.5 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black rounded-2xl font-black text-xs uppercase shadow-[3px_3px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5'>
									<Plus className='w-4 h-4 stroke-[3]' />
									<span>+ Catat Bimbingan</span>
								</button>
							</div>
						</div>

						{/* 5 BENTO STATS CARDS */}
						<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
							<div className='p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between'>
								<span className='text-[10px] font-black uppercase tracking-wider text-gray-600'>Total Kasus</span>
								<div className='text-2xl sm:text-3xl font-black text-black mt-2'>{bimbinganSummary.total}</div>
							</div>

							<div className='p-4 bg-amber-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between'>
								<span className='text-[10px] font-black uppercase tracking-wider text-amber-900'>Menunggu Bimbingan</span>
								<div className='text-2xl sm:text-3xl font-black text-amber-950 mt-2'>{bimbinganSummary.menungguBimbingan}</div>
							</div>

							<div className='p-4 bg-blue-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between'>
								<span className='text-[10px] font-black uppercase tracking-wider text-blue-900'>Sudah Dibina</span>
								<div className='text-2xl sm:text-3xl font-black text-blue-950 mt-2'>{bimbinganSummary.sudahDibina}</div>
							</div>

							<div className='p-4 bg-rose-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between'>
								<span className='text-[10px] font-black uppercase tracking-wider text-rose-900'>Panggilan Ortu</span>
								<div className='text-2xl sm:text-3xl font-black text-rose-950 mt-2'>{bimbinganSummary.perluPanggilanOrtu}</div>
							</div>

							<div className='p-4 bg-emerald-50 border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between col-span-2 sm:col-span-1'>
								<span className='text-[10px] font-black uppercase tracking-wider text-emerald-900'>Kasus Selesai</span>
								<div className='text-2xl sm:text-3xl font-black text-emerald-950 mt-2'>{bimbinganSummary.selesai}</div>
							</div>
						</div>

						{/* FILTER & TOOLBAR */}
						<div className='p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
							<div className='relative flex-1'>
								<Search className='w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2' />
								<input
									type='text'
									value={searchBimbingan}
									onChange={(e) => setSearchBimbingan(e.target.value)}
									placeholder='Cari santri, jenis pelanggaran, atau hasil bimbingan...'
									className='neo-input w-full pl-9 text-xs font-bold'
								/>
							</div>

							<div className='flex items-center gap-2'>
								<select
									value={statusFilterBimbingan}
									onChange={(e) => setStatusFilterBimbingan(e.target.value)}
									className='neo-input text-xs font-bold py-2 bg-white'>
									<option value='Semua'>Semua Status</option>
									<option value='Menunggu Bimbingan'>⏳ Menunggu Bimbingan</option>
									<option value='Sudah Dibina'>✅ Sudah Dibina</option>
									<option value='Perlu Panggilan Orang Tua'>🚨 Perlu Panggilan Orang Tua</option>
									<option value='Selesai'>🟢 Selesai</option>
								</select>
							</div>
						</div>

						{/* CASE TABLE */}
						<div className='neo-card bg-white p-4 sm:p-6 border-[3px] border-black shadow-[4px_4px_0_#000]'>
							<div className='flex items-center justify-between pb-3 border-b-2 border-black mb-4'>
								<h3 className='font-black text-sm uppercase text-black flex items-center gap-2'>
									<span>📋</span> Daftar Catatan Kasus &amp; Bimbingan Santri ({filteredBimbinganList.length})
								</h3>
								<span className='text-xs font-bold text-gray-500'>
									Wali Kelas: {kelas.wali_kelas}
								</span>
							</div>

							{loadingBimbingan ? (
								<div className='text-center py-12'>
									<div className='inline-block w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin'></div>
									<p className='text-xs font-black text-black uppercase mt-3'>Memuat Catatan Bimbingan...</p>
								</div>
							) : filteredBimbinganList.length === 0 ? (
								<div className='p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl text-center'>
									<div className='text-3xl mb-2'>🌱</div>
									<p className='font-black text-sm text-black uppercase'>
										{searchBimbingan || statusFilterBimbingan !== 'Semua'
											? 'Tidak Ada Catatan yang Sesuai Filter'
											: 'Belum Ada Catatan Bimbingan Kasus'}
									</p>
									<p className='text-xs font-bold text-gray-600 mt-1 max-w-md mx-auto'>
										{searchBimbingan || statusFilterBimbingan !== 'Semua'
											? 'Coba ganti filter status atau kata kunci pencarian.'
											: 'Catat pembinaan santri rombel saat terdeteksi anomali kehadiran, bolos KBM, atau ketidakhadiran berulang.'}
									</p>
									<button
										type='button'
										onClick={() => handleOpenAddModal()}
										className='mt-4 px-4 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5'>
										+ Catat Kasus Sekarang
									</button>
								</div>
							) : (
								<div className='overflow-x-auto'>
									<table className='w-full text-left text-xs'>
										<thead>
											<tr className='border-b-2 border-black bg-gray-100 uppercase tracking-wider font-black text-black'>
												<th className='py-3 px-3 w-12'>No</th>
												<th className='py-3 px-3'>Tanggal</th>
												<th className='py-3 px-3'>Santri</th>
												<th className='py-3 px-3'>Pelanggaran &amp; Kejadian</th>
												<th className='py-3 px-3'>Pembinaan &amp; Hasil</th>
												<th className='py-3 px-3'>Status</th>
												<th className='py-3 px-3 text-center w-36'>Aksi</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-gray-200'>
											{filteredBimbinganList.map((item, idx) => (
												<tr key={item.id} className='hover:bg-yellow-50/60 transition-colors'>
													<td className='py-3 px-3 font-mono font-bold'>{idx + 1}</td>
													<td className='py-3 px-3 font-mono font-bold whitespace-nowrap'>
														{item.tanggal_bimbingan}
													</td>
													<td className='py-3 px-3'>
														<div className='font-black text-black'>{item.nama_santri}</div>
														<div className='text-[10px] text-gray-500 font-mono'>
															NIS: {item.siswa_id || '—'}
														</div>
													</td>
													<td className='py-3 px-3'>
														<div className='font-bold text-rose-700'>{item.jenis_pelanggaran}</div>
														<div className='text-[10px] font-mono text-gray-600 mt-0.5'>
															Akumulasi: <span className='font-bold text-black'>{item.jumlah_alpa} Kali</span>
														</div>
													</td>
													<td className='py-3 px-3 max-w-xs'>
														<div className='line-clamp-2 text-gray-800 font-medium'>
															<span className='font-bold text-black'>Bina:</span> {item.bentuk_penanganan}
														</div>
														<div className='line-clamp-2 text-gray-600 italic text-[11px] mt-0.5'>
															<span className='font-bold not-italic text-gray-800'>Hasil:</span> {item.hasil_catatan}
														</div>
													</td>
													<td className='py-3 px-3 whitespace-nowrap'>
														<span
															className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black ${
																item.status === 'Selesai'
																	? 'bg-emerald-200 text-emerald-950'
																	: item.status === 'Sudah Dibina'
																	? 'bg-blue-200 text-blue-950'
																	: item.status === 'Perlu Panggilan Orang Tua'
																	? 'bg-rose-200 text-rose-950'
																	: 'bg-amber-200 text-amber-950'
															}`}>
															{item.status}
														</span>
														{item.rekomendasi_tindak_lanjut && (
															<div className='text-[10px] font-bold text-gray-600 mt-1'>
																{item.rekomendasi_tindak_lanjut}
															</div>
														)}
													</td>
													<td className='py-3 px-3'>
														<div className='flex items-center justify-center gap-1.5'>
															<button
																type='button'
																onClick={() => handleCopyWABimbingan(item)}
																title='Salin Format Teks WA'
																className='p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-x-0.5 active:translate-y-0.5'>
																<Copy className='w-3.5 h-3.5' />
															</button>
															<button
																type='button'
																onClick={() => handleOpenPrintBimbingan(item)}
																title='Cetak Lembar Dokumen Bimbingan A4'
																className='p-1.5 bg-yellow-200 hover:bg-yellow-300 text-yellow-950 border border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-x-0.5 active:translate-y-0.5'>
																<Printer className='w-3.5 h-3.5' />
															</button>
															<button
																type='button'
																onClick={() => handleOpenEditModal(item)}
																title='Edit Kasus'
																className='p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-x-0.5 active:translate-y-0.5'>
																<Edit3 className='w-3.5 h-3.5' />
															</button>
															<button
																type='button'
																onClick={() => handleDeleteBimbingan(item.id, item.nama_santri)}
																title='Hapus Kasus'
																className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-x-0.5 active:translate-y-0.5'>
																<Trash2 className='w-3.5 h-3.5' />
															</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				)}

				{/* SUB-VIEW 2: POIN KARAKTER */}
				{subTabPembinaan === 'poin' && (
					<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black'>
							<div>
								<h2 className='text-xl font-black uppercase text-black'>
									Catatan Karakter &amp; Poin Siswa
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Log prestasi dan pelanggaran siswa rombel {kelas.nama_kelas}
								</p>
							</div>
							<Link
								href={`/kelas/${kelas.id}/poin`}
								className='neo-btn-primary bg-[#E8451A] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 self-start sm:self-auto'>
								<ShieldAlert className='w-4 h-4' />
								<span>Catat Poin Baru</span>
							</Link>
						</div>

						{/* Log list */}
						{poinStats.recentLogs && poinStats.recentLogs.length > 0 ? (
							<div className='space-y-3'>
								{poinStats.recentLogs.map((item) => {
									const isPos = String(item.tipe || '').toLowerCase() === 'positif';
									return (
									<div
										key={item.id}
										className={`p-4 border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
											isPos ? 'bg-emerald-50' : 'bg-rose-50'
										}`}>
										<div className='space-y-1'>
											<div className='flex items-center gap-2'>
												<span
													className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black ${
														isPos
															? 'bg-emerald-200 text-emerald-950'
															: 'bg-rose-200 text-rose-950'
													}`}>
													{item.tipe}
												</span>
												<span className='font-black text-sm text-black'>{item.nama_siswa}</span>
											</div>
											<p className='text-xs font-bold text-gray-800'>{item.aktifitas}</p>
											{item.keterangan && (
												<p className='text-[11px] text-gray-600 italic font-medium'>
													&ldquo;{item.keterangan}&rdquo;
												</p>
											)}
										</div>
										<div className='flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0'>
											<span
												className={`text-base font-black px-3 py-1 rounded-lg border-2 border-black ${
													isPos
														? 'bg-emerald-400 text-black'
														: 'bg-rose-400 text-white'
												}`}>
												{isPos ? `+${item.poin}` : `-${item.poin}`}
											</span>
											<span className='text-[11px] font-bold text-gray-500 font-mono'>
												{item.tanggal}
											</span>
										</div>
									</div>
								);
								})}
							</div>
						) : (
							<p className='text-xs font-bold text-gray-500 italic p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl'>
								Belum ada catatan poin perilaku siswa di kelas ini.
							</p>
						)}
					</div>
				)}
			</div>
		)}

				{/* ======================================================== */}
				{/* TAB 4: DATA SISWA & AKADEMIK ROMBEL                     */}
				{/* ======================================================== */}
				{activeTab === 'akademik' && (
					<div className='space-y-6'>
						{/* SUB-NAVIGASI SEGMENTED (Buku Induk vs Leger Nilai) */}
						<div className='flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-2xl border-[2.5px] border-black shadow-[3px_3px_0_#000] w-full sm:w-fit'>
							<button
								type='button'
								onClick={() => setSubTabAkademik('siswa')}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex-1 sm:flex-initial justify-center ${
									subTabAkademik === 'siswa'
										? 'bg-[#2F80ED] text-white border-2 border-black shadow-[2px_2px_0_#000] -translate-y-0.5'
										: 'text-gray-700 hover:bg-blue-50'
								}`}>
								<Users className='w-4 h-4' />
								<span>Buku Induk Siswa ({stats?.totalSiswa || 0})</span>
							</button>
							<button
								type='button'
								onClick={() => setSubTabAkademik('leger')}
								className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex-1 sm:flex-initial justify-center ${
									subTabAkademik === 'leger'
										? 'bg-[#F5C518] text-black border-2 border-black shadow-[2px_2px_0_#000] -translate-y-0.5'
										: 'text-gray-700 hover:bg-yellow-50'
								}`}>
								<FileText className='w-4 h-4' />
								<span>Leger Nilai (Preview)</span>
							</button>

							<Link
								href='/wali-kelas/biodata'
								className='flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide transition-all bg-[#A3E635] hover:bg-[#8ee012] text-black border-2 border-black shadow-[2px_2px_0_#000] hover:-translate-y-0.5 ml-auto'>
								<span>📑 CRUD Biodata Siswa Sekaligus</span>
								<ExternalLink className='w-4 h-4' />
							</Link>
						</div>

						{/* SUB-VIEW 1: BUKU INDUK SISWA */}
						{subTabAkademik === 'siswa' && (
							<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black'>
							<div>
								<h2 className='text-xl font-black uppercase text-black'>
									Buku Induk Rombel {kelas.nama_kelas}
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Total: {siswaList.length} siswa aktif terdaftar
								</p>
							</div>
							<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
								<div className='relative w-full sm:w-64'>
									<Search className='w-4 h-4 absolute left-3 top-3 text-gray-500' />
									<input
										type='text'
										placeholder='Cari nama atau NIS...'
										value={searchSiswa}
										onChange={(e) => setSearchSiswa(e.target.value)}
										className='neo-input !pl-9 text-xs sm:text-sm'
									/>
								</div>
								<Link
									href='/wali-kelas/biodata'
									className='px-3 py-2 bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase tracking-wide shadow-[2px_2px_0_#000] flex items-center gap-1.5 whitespace-nowrap hover:-translate-y-0.5 transition-all'>
									<span>Buka Editor CRUD Sekaligus</span>
									<ExternalLink className='w-3.5 h-3.5' />
								</Link>
							</div>
						</div>

						{/* TABLE SISWA */}
						<div className='overflow-x-auto border-2 border-black rounded-xl'>
							<table className='w-full text-left border-collapse text-xs sm:text-sm font-bold'>
								<thead className='bg-[#F5C518] text-black border-b-2 border-black font-black uppercase tracking-wider text-xs'>
									<tr>
										<th className='p-3 border-r-2 border-black w-12 text-center'>No</th>
										<th className='p-3 border-r-2 border-black'>NIS</th>
										<th className='p-3 border-r-2 border-black'>Nama Siswa</th>
										<th className='p-3 border-r-2 border-black text-center'>L/P</th>
										<th className='p-3 border-r-2 border-black text-center'>Status</th>
										<th className='p-3 text-center w-28'>Aksi</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-black/10 bg-white'>
									{filteredSiswa.length === 0 ? (
										<tr>
											<td colSpan={6} className='p-6 text-center text-gray-500 italic'>
												Tidak ada siswa yang cocok dengan pencarian.
											</td>
										</tr>
									) : (
										filteredSiswa.map((siswa, idx) => (
											<tr key={siswa.id} className='hover:bg-yellow-50 transition-colors'>
												<td className='p-3 border-r-2 border-black/10 text-center font-black'>
													{idx + 1}
												</td>
												<td className='p-3 border-r-2 border-black/10 font-mono'>
													{siswa.nis || '-'}
												</td>
												<td className='p-3 border-r-2 border-black/10 font-black text-black'>
													{siswa.nama_lengkap}
												</td>
												<td className='p-3 border-r-2 border-black/10 text-center'>
													<span
														className={`px-2 py-0.5 rounded text-[11px] font-black border border-black ${
															siswa.jenis_kelamin === 'Laki-laki'
																? 'bg-blue-100 text-blue-900'
																: 'bg-pink-100 text-pink-900'
														}`}>
														{siswa.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}
													</span>
												</td>
												<td className='p-3 border-r-2 border-black/10 text-center'>
													<span className='px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-black'>
														{siswa.status}
													</span>
												</td>
												<td className='p-3 text-center'>
													<Link
														href={`/siswa/${siswa.id}`}
														className='neo-btn-outline !py-1 !px-2.5 text-xs bg-white font-bold inline-block'>
														Profil
													</Link>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* SUB-VIEW 2: LEGER NILAI */}
				{subTabAkademik === 'leger' && (
					<div className='neo-card bg-white p-6 border-[3px] border-black shadow-[4px_4px_0_#000] space-y-6'>
						<div className='flex items-center justify-between pb-4 border-b-2 border-black flex-wrap gap-4'>
							<div>
								<div className='text-xs font-black uppercase px-2 py-0.5 bg-yellow-300 text-black border border-black rounded inline-block mb-1'>
									Modul E-Rapor Digital
								</div>
								<h2 className='text-xl font-black uppercase text-black'>
									Leger Nilai & Cetak Rapor Rombel
								</h2>
								<p className='text-xs font-bold text-gray-600'>
									Matriks nilai seluruh siswa rombel {kelas.nama_kelas} dari semua guru mapel pengajar dan pencetakan rapor Kurikulum Merdeka.
								</p>
							</div>
							<div className='flex items-center gap-2'>
								<Link
									href='/erapor/rekap-leger'
									className='neo-btn-primary bg-yellow-300 text-black text-xs sm:text-sm font-black flex items-center gap-1.5 border-2 border-black shadow-[3px_3px_0px_0px_#000]'>
									<span>Buka Leger Lengkap</span>
									<ExternalLink className='w-4 h-4' />
								</Link>
							</div>
						</div>

						<div className='p-6 bg-yellow-50 border-3 border-black rounded-2xl flex flex-col items-center text-center space-y-4 shadow-[4px_4px_0px_0px_#000]'>
							<div className='w-14 h-14 bg-yellow-300 border-2 border-black rounded-2xl flex items-center justify-center text-2xl shadow-[2px_2px_0_#000]'>
								📊
							</div>
							<h3 className='text-base font-black uppercase text-black'>
								Pusat Leger & Rapor Kelas {kelas.nama_kelas}
							</h3>
							<p className='text-xs font-bold text-gray-700 max-w-lg'>
								Modul E-Rapor kini telah aktif dan terhubung langsung. Anda dapat melihat rekapitulasi nilai kuantitatif, rangking siswa, menarik absensi harian otomatis, serta mencetak lembar rapor Kurikulum Merdeka.
							</p>
							<div className='pt-2 flex flex-wrap gap-3 justify-center'>
								<Link
									href='/erapor/rekap-leger'
									className='px-4 py-2 bg-white hover:bg-yellow-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5'>
									<span>Matriks Leger Nilai</span>
								</Link>
								<Link
									href='/erapor/ketidakhadiran'
									className='px-4 py-2 bg-white hover:bg-teal-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5'>
									<span>Rekap Ketidakhadiran</span>
								</Link>
								<Link
									href='/erapor/ekstrakurikuler'
									className='px-4 py-2 bg-white hover:bg-violet-100 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5'>
									<span>Catatan Ekskul</span>
								</Link>
								<Link
									href='/erapor/cetak'
									className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5'>
									<Printer className='w-3.5 h-3.5' />
									<span>Cetak Rapor Siswa</span>
								</Link>
							</div>
						</div>
					</div>
				)}
			</div>
		)}
	</div>

			{/* ======================================================================== */}
			{/* MODAL FORM CATAT / EDIT BIMBINGAN SANTRI ROMBEL                          */}
			{/* ======================================================================== */}
			{showModalBimbingan && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden'>
					<div className='bg-white border-3 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150'>
						<div className='flex items-center justify-between pb-3 mb-4 border-b-2 border-black'>
							<div className='flex items-center gap-2'>
								<span className='w-8 h-8 rounded-xl bg-amber-300 border-2 border-black flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#0D0D0D]'>
									{selectedKasus ? '✏️' : '📝'}
								</span>
								<h3 className='font-black text-base text-black uppercase tracking-tight'>
									{selectedKasus ? 'Edit Catatan Bimbingan Santri' : 'Catat Bimbingan & Kasus Santri'}
								</h3>
							</div>
							<button
								type='button'
								onClick={() => setShowModalBimbingan(false)}
								className='w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center bg-gray-100 hover:bg-rose-500 hover:text-white transition-colors'>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmitBimbingan} className='space-y-4'>
							{/* Pilih Santri Rombel Ini */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									1. Pilih Santri Rombel {kelas.nama_kelas} <span className='text-rose-500'>*</span>
								</label>
								{selectedKasus ? (
									<div className='p-3 bg-gray-100 border-2 border-black rounded-xl font-black text-xs text-black'>
										{formSiswa?.nama_lengkap || formSiswa?.nama_santri} (NIS: {formSiswa?.nis || '—'})
									</div>
								) : (
									<select
										value={formSiswa ? formSiswa.id : ''}
										onChange={(e) => {
											const found = (siswaList || []).find((s) => String(s.id) === String(e.target.value));
											setFormSiswa(found || null);
										}}
										required
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value=''>-- Pilih Santri --</option>
										{(siswaList || []).map((s) => (
											<option key={s.id} value={s.id}>
												{s.nama_lengkap} {s.nis ? `(NIS: ${s.nis})` : ''}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Wali Kelas (Auto) */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 bg-yellow-50/80 p-3 border-2 border-black rounded-xl text-xs'>
								<div>
									<span className='font-bold text-gray-600 block text-[10px] uppercase'>Rombongan Belajar</span>
									<span className='font-black text-black'>Kelas {kelas.nama_kelas}</span>
								</div>
								<div>
									<span className='font-bold text-gray-600 block text-[10px] uppercase'>Wali Kelas Pembina</span>
									<span className='font-black text-black'>{kelas.wali_kelas || 'Wali Kelas'}</span>
								</div>
							</div>

							{/* Jenis Pelanggaran & Jumlah Alpa */}
							<div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
								<div className='sm:col-span-2'>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										2. Jenis Pelanggaran <span className='text-rose-500'>*</span>
									</label>
									<select
										value={isPelanggaranManual ? 'Lainnya' : selectedPelanggaranOption}
										onChange={(e) => {
											const val = e.target.value;
											if (val === 'Lainnya') {
												setIsPelanggaranManual(true);
											} else {
												setIsPelanggaranManual(false);
												setSelectedPelanggaranOption(val);
											}
										}}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Bolos Jam Pelajaran'>Bolos Jam Pelajaran</option>
										<option value='Keluyuran saat KBM'>Keluyuran saat KBM</option>
										<option value='Tidak Hadir Tanpa Keterangan (Alpa)'>Tidak Hadir Tanpa Keterangan (Alpa)</option>
										<option value='Keterlambatan Berulang'>Keterlambatan Berulang</option>
										<option value='Lainnya'>✏️ Pelanggaran Lainnya (Input Manual)...</option>
									</select>

									{isPelanggaranManual && (
										<div className='mt-2'>
											<input
												type='text'
												value={customPelanggaranText}
												onChange={(e) => setCustomPelanggaranText(e.target.value)}
												placeholder='Tuliskan jenis pelanggaran secara spesifik...'
												required
												className='neo-input w-full text-xs font-bold bg-yellow-50 border-rose-400'
											/>
										</div>
									)}
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Jumlah Alpa / Jam
									</label>
									<input
										type='number'
										min='1'
										value={formJumlahAlpa}
										onChange={(e) => setFormJumlahAlpa(e.target.value)}
										className='neo-input w-full text-xs font-mono font-bold bg-white'
									/>
								</div>
							</div>

							{/* Tanggal Bimbingan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									3. Tanggal Bimbingan <span className='text-rose-500'>*</span>
								</label>
								<input
									type='date'
									value={formTanggalBimbingan}
									onChange={(e) => setFormTanggalBimbingan(e.target.value)}
									required
									className='neo-input w-full text-xs font-bold bg-white'
								/>
							</div>

							{/* Bentuk Penanganan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									4. Bentuk Penanganan / Pembinaan yang Dilakukan <span className='text-rose-500'>*</span>
								</label>
								<textarea
									rows='2'
									value={formBentukPenanganan}
									onChange={(e) => setFormBentukPenanganan(e.target.value)}
									placeholder='Contoh: Pemanggilan santri ke meja wali kelas, klarifikasi penyebab ketidakhadiran, nasihat kedisiplinan...'
									required
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							{/* Hasil / Catatan */}
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									5. Hasil Bimbingan &amp; Komitmen Santri <span className='text-rose-500'>*</span>
								</label>
								<textarea
									rows='2'
									value={formHasilCatatan}
									onChange={(e) => setFormHasilCatatan(e.target.value)}
									placeholder='Contoh: Santri mengakui kesalahan, menandatangani surat komitmen tidak mengulang, dan bersedia menerima sanksi bila melanggar...'
									required
									className='neo-input w-full text-xs font-medium bg-white'></textarea>
							</div>

							{/* Status & Rekomendasi */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Status Kasus</label>
									<select
										value={formStatus}
										onChange={(e) => setFormStatus(e.target.value)}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Sudah Dibina'>✅ Sudah Dibina</option>
										<option value='Menunggu Bimbingan'>⏳ Menunggu Bimbingan</option>
										<option value='Perlu Panggilan Orang Tua'>🚨 Perlu Panggilan Orang Tua</option>
										<option value='Selesai'>🟢 Selesai / Terbina</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>Rekomendasi Tindak Lanjut</label>
									<select
										value={formRekomendasi}
										onChange={(e) => setFormRekomendasi(e.target.value)}
										className='neo-input w-full text-xs font-bold bg-white'>
										<option value='Pembinaan Wali Kelas'>Cukup Pantauan Wali Kelas</option>
										<option value='Panggilan Orang Tua'>Eskalasi: Panggilan Orang Tua</option>
										<option value='Bimbingan Konseling'>Rujukan ke Guru BK</option>
										<option value='Selesai'>Kasus Tuntas</option>
									</select>
								</div>
							</div>

							{/* Actions */}
							<div className='flex items-center justify-end gap-2 pt-3 border-t-2 border-black'>
								<button
									type='button'
									onClick={() => setShowModalBimbingan(false)}
									className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200'>
									Batal
								</button>
								<button
									type='submit'
									disabled={submittingBimbingan}
									className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-emerald-400 hover:bg-emerald-500 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 disabled:opacity-60'>
									{submittingBimbingan ? (
										<>
											<span className='inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin'></span>
											<span>Menyimpan...</span>
										</>
									) : (
										<>
											<span>💾</span>
											<span>Simpan Catatan</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ======================================================================== */}
			{/* MODAL PRATINJAU CETAK DOKUMEN RESMI A4 (print:hidden)                    */}
			{/* ======================================================================== */}
			{showPrintModal && printItem && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:hidden'>
					<div className='bg-white border-3 border-black rounded-3xl shadow-[8px_8px_0px_0px_#0D0D0D] w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150'>
						{/* Modal Toolbar Header */}
						<div className='p-4 bg-yellow-200 border-b-2 border-black flex items-center justify-between gap-3'>
							<div className='flex items-center gap-2.5'>
								<span className='w-9 h-9 bg-white border-2 border-black rounded-xl flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#0D0D0D]'>
									🖨️
								</span>
								<div>
									<div className='flex items-center gap-2'>
										<span className='px-1.5 py-0.5 bg-black text-white text-[9px] font-black uppercase rounded'>
											Dokumen Resmi
										</span>
										<span className='text-xs font-mono font-bold text-gray-700'>
											REG-KSW/{new Date(printItem.tanggal_bimbingan || Date.now()).getFullYear()}/{String(printItem.id).padStart(4, '0')}
										</span>
									</div>
									<h3 className='font-black text-sm text-black'>
										Pratinjau Lembar Berita Acara Bimbingan Santri
									</h3>
								</div>
							</div>

							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={handleExecutePrintBimbingan}
									className='px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5'>
									<span>🖨️</span>
									<span>Cetak Dokumen (A4)</span>
								</button>

								<button
									type='button'
									onClick={() => {
										setShowPrintModal(false);
										setPrintItem(null);
									}}
									title='Tutup Pratinjau'
									className='w-8 h-8 rounded-xl border-2 border-black bg-white hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'>
									✕
								</button>
							</div>
						</div>

						{/* Area Kertas Preview Lembar A4 */}
						<div className='p-4 sm:p-6 overflow-y-auto bg-gray-100 [scrollbar-width:thin]'>
							<div className='bg-white border-2 border-black rounded-xl p-8 max-w-3xl mx-auto shadow-[4px_4px_0px_0px_#0D0D0D] text-black font-sans'>
								<LembarBimbinganDocument
									printItem={printItem}
									schoolProfile={schoolProfile}
									allSiswa={siswaList}
								/>
							</div>
						</div>

						{/* Modal Footer */}
						<div className='p-4 bg-gray-50 border-t-2 border-black flex items-center justify-between gap-3'>
							<button
								type='button'
								onClick={() => {
									setShowPrintModal(false);
									setPrintItem(null);
								}}
								className='px-4 py-2 border-2 border-black rounded-xl font-bold text-xs bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5'>
								Tutup Pratinjau
							</button>

							<button
								type='button'
								onClick={handleExecutePrintBimbingan}
								className='px-5 py-2 border-2 border-black rounded-xl font-black text-xs bg-yellow-300 hover:bg-yellow-400 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all'>
								<span>🖨️</span>
								<span>Cetak Lembar Dokumen (A4)</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ======================================================================== */}
			{/* DOKUMEN CETAK MURNI (HANYA AKTIF SAAT WINDOW.PRINT())                     */}
			{/* Bebas dari modal, backdrop, flexbox, fixed, maupun overflow              */}
			{/* ======================================================================== */}
			{showPrintModal && printItem && (
				<div id='print-clean-document' className='hidden print:block w-full text-black font-sans bg-white'>
					<LembarBimbinganDocument
						printItem={printItem}
						schoolProfile={schoolProfile}
						allSiswa={siswaList}
					/>
				</div>
			)}

			{/* CSS Khusus Print Dokumen Lembar Bimbingan Santri */}
			<style dangerouslySetInnerHTML={{
				__html: `
					@media print {
						@page {
							size: A4 portrait;
							margin: 10mm 15mm 10mm 15mm;
						}
						html, body {
							background: #ffffff !important;
							color: #000000 !important;
							margin: 0 !important;
							padding: 0 !important;
							width: 100% !important;
							height: auto !important;
							overflow: visible !important;
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						.print\\:hidden,
						header,
						aside,
						nav {
							display: none !important;
						}
						#print-clean-document {
							display: block !important;
							position: static !important;
							width: 100% !important;
							max-width: 100% !important;
							margin: 0 !important;
							padding: 0 !important;
							background: #ffffff !important;
						}
					}
				`
			}} />
		</div>
	);
}

export default function WaliKelasHubPage() {
	return (
		<Suspense fallback={<Loader />}>
			<WaliKelasHubContent />
		</Suspense>
	);
}

