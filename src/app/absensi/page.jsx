'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchSchoolProfile, drawKopSuratPDF, DEFAULT_PROFIL_SEKOLAH } from '@/lib/pdfKopSurat';
import Loader from '../components/loading';
import ButtonBack from '../components/button/ButtonBack';
import { useAcademic } from '@/context/AcademicContext';
import AcademicPeriodChip, { ArchiveBanner } from '@/app/components/AcademicPeriodChip';
import { getTodayDateString } from '@/lib/dateUtils';
import { normStatus, calculateAttendanceSummary, findConflictingSession, checkJamOverlap, parseJamPelajaran } from '@/lib/absensiUtils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { isWithinGeofence, formatDistance } from '@/lib/haversine';
import GeofenceStatusCard from '@/app/components/GeofenceStatusCard';

export default function AbsensiMapelPage() {
	const router = useRouter();
	const { tahunAjar, semester, tahunAjarAktif, semesterAktif, buildPeriodeQuery } = useAcademic();

	// --- State UI ---
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [statusList, setStatusList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [userRole, setUserRole] = useState('');

	// Geolocation & Geofencing State
	const { getPosition, loading: gpsLoading } = useGeolocation();
	const [geofenceSettings, setGeofenceSettings] = useState(null);
	const [locationStatus, setLocationStatus] = useState(null);

	// --- Filter State ---
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [tanggal, setTanggal] = useState(() => getTodayDateString());
	const [jamKe, setJamKe] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	// --- Data State ---
	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [existingId, setExistingId] = useState(null);
	const [sesiHariIni, setSesiHariIni] = useState([]);
	const [loadingSesiHariIni, setLoadingSesiHariIni] = useState(false);

	// Surat Izin Pos Keamanan
	const [suratKeamananHariIni, setSuratKeamananHariIni] = useState([]);
	const [loadingSuratKeamanan, setLoadingSuratKeamanan] = useState(false);

	// MODE: 'input' (Form Input), 'edit' (Form Edit), 'rekap' (Tampilan Tabel Hasil)
	const [mode, setMode] = useState('input');

	// Helper status colors
	const getStatusClasses = (warna, active) => {
		const base = 'px-4 py-2 rounded-xl font-bold text-sm transition-all border-2 border-[#0D0D0D] flex items-center justify-center';
		if (active) {
			const activeStyle = 'translate-x-[2px] translate-y-[2px] shadow-none';
			switch (warna) {
				case 'green': return `${base} bg-[#00A693] text-white ${activeStyle}`;
				case 'yellow': return `${base} bg-[#F5C518] text-[#0D0D0D] ${activeStyle}`;
				case 'blue': return `${base} bg-[#2F80ED] text-white ${activeStyle}`;
				case 'red': return `${base} bg-[#E8451A] text-white ${activeStyle}`;
				default: return `${base} bg-[#0D0D0D] text-white ${activeStyle}`;
			}
		}
		return `${base} bg-white text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-[1px] hover:-translate-x-[1px]`;
	};

	// Helper Badge untuk Tabel Rekap
	const getBadgeRekap = (status) => {
		const s = statusList.find((sl) => sl.label === status);
		const warna = s ? s.warna : 'gray';

		const style = 'px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] inline-block';
		switch (warna) {
			case 'green': return <span className={`${style} bg-[#00A693] text-white`}>Hadir</span>;
			case 'yellow': return <span className={`${style} bg-[#F5C518] text-[#0D0D0D]`}>Sakit</span>;
			case 'blue': return <span className={`${style} bg-[#2F80ED] text-white`}>Izin</span>;
			case 'red': return <span className={`${style} bg-[#E8451A] text-white`}>Alpha</span>;
			default: return <span className={`${style} bg-[#E8E8E8] text-[#0D0D0D]`}>{status}</span>;
		}
	};

	// 1. Fetch Master Data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
					if (profile) setUserRole(profile.role || '');
				}

				const [resKelas, resMapel, resStatus, resSiswa, resPoin] = await Promise.all([
					fetch('/api/kelas'),
					fetch('/api/mapel'),
					fetch('/api/status-absensi'),
					fetch('/api/siswa'),
					fetch(`/api/poin?${buildPeriodeQuery()}`),
				]);
				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];
				const dataPoin = resPoin.ok ? await resPoin.json() : [];

				const poinMap = {};
				dataPoin.forEach((p) => {
					if (!poinMap[p.siswa_id]) poinMap[p.siswa_id] = { positif: 0, negatif: 0 };
					if (p.tipe === 'positif') poinMap[p.siswa_id].positif += p.poin || 0;
					if (p.tipe === 'negatif') poinMap[p.siswa_id].negatif += p.poin || 0;
				});

				const siswaDataUpdated = dataSiswa.map((s) => ({
					...s,
					poinPositif: poinMap[s.id]?.positif || 0,
					poinNegatif: poinMap[s.id]?.negatif || 0,
				}));

				setKelasList(dataKelas);
				setMapelList(dataMapel);
				setStatusList(dataStatus);
				setSiswaList(siswaDataUpdated);

				if (dataKelas.length > 0) setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				if (dataMapel.length > 0) setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);

				// Ambil konfigurasi geofence sekolah
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
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchAll();
	}, []);

	const siswaKelasIni = useMemo(() => siswaList.filter((s) => String(s.kelas).trim() === String(selectedKelas).trim()), [siswaList, selectedKelas]);

	const filteredSiswa = useMemo(() => {
		if (!searchQuery.trim()) return siswaKelasIni;
		const q = searchQuery.toLowerCase().trim();
		return siswaKelasIni.filter((s) =>
			(s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(q)) ||
			(s.nis && String(s.nis).toLowerCase().includes(q))
		);
	}, [siswaKelasIni, searchQuery]);

	// Deteksi konflik tumpang tindih jam pelajaran secara real-time
	const currentJamConflict = useMemo(() => {
		if (!jamKe || !jamKe.trim() || sesiHariIni.length === 0) return null;
		return findConflictingSession(sesiHariIni, jamKe, existingId);
	}, [jamKe, sesiHariIni, existingId]);

	// 2. Fetch Riwayat Seluruh Sesi pada Tanggal Terpilih (Sesi Hari Ini)
	const fetchSesiHariIni = useCallback(async () => {
		if (!selectedKelas || !selectedMapel || !tanggal) {
			setSesiHariIni([]);
			return;
		}

		try {
			setLoadingSesiHariIni(true);
			const params = new URLSearchParams({
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal: tanggal,
			});
			const res = await fetch(`/api/absensi-mapel?${params.toString()}&${buildPeriodeQuery()}`);
			if (res.ok) {
				const data = await res.json();
				setSesiHariIni(Array.isArray(data) ? data : []);
			} else {
				setSesiHariIni([]);
			}
		} catch (err) {
			console.error('Error fetching sesi hari ini:', err);
			setSesiHariIni([]);
		} finally {
			setLoadingSesiHariIni(false);
		}
	}, [selectedKelas, selectedMapel, tanggal, buildPeriodeQuery]);

	useEffect(() => {
		fetchSesiHariIni();
	}, [fetchSesiHariIni]);

	// Fetch Riwayat Surat Izin dari Pos Keamanan untuk kelas & tanggal ini
	const fetchSuratKeamanan = useCallback(async () => {
		if (!selectedKelas || !tanggal) {
			setSuratKeamananHariIni([]);
			return;
		}

		try {
			setLoadingSuratKeamanan(true);
			const params = new URLSearchParams({
				kelas: selectedKelas,
				tanggal: tanggal,
				status_surat: 'aktif',
			});
			const res = await fetch(`/api/keamanan/surat?${params.toString()}`);
			if (res.ok) {
				const json = await res.json();
				setSuratKeamananHariIni(Array.isArray(json.data) ? json.data : []);
			} else {
				setSuratKeamananHariIni([]);
			}
		} catch (err) {
			console.error('Error fetching surat keamanan:', err);
			setSuratKeamananHariIni([]);
		} finally {
			setLoadingSuratKeamanan(false);
		}
	}, [selectedKelas, tanggal]);

	useEffect(() => {
		fetchSuratKeamanan();
	}, [fetchSuratKeamanan]);

	// Helper: Cek apakah surat keamanan berlaku untuk jam KBM tertentu
	const isLetterMatchingJam = useCallback((letter, targetJam) => {
		if (!letter) return false;
		if (letter.berlaku_seharian) return true;
		if (!targetJam) return true;

		const sessionHours = parseJamPelajaran(targetJam);
		if (sessionHours.length === 0) return true;

		const startH = letter.jam_ke_mulai ? parseInt(letter.jam_ke_mulai, 10) : null;
		const endH = letter.jam_ke_selesai ? parseInt(letter.jam_ke_selesai, 10) : startH;

		if (startH === null) return true;
		return sessionHours.some((h) => h >= startH && h <= (endH || startH));
	}, []);

	const getLetterTargetStatus = useCallback((letter) => {
		if (!letter) return 'Hadir';
		if (letter.status_absensi) return letter.status_absensi;
		if (letter.tipe_surat === 'pulang_cepat') {
			return String(letter.alasan || '').toLowerCase().includes('sakit') ? 'Sakit' : 'Izin';
		}
		if (letter.tipe_surat === 'tidak_masuk') {
			return String(letter.alasan || '').toLowerCase().includes('sakit') ? 'Sakit' : 'Izin';
		}
		return 'Izin';
	}, []);

	// 3. Fungsi Muat Detail Absensi Jam Tertentu
	const muatDetailSesi = useCallback(async (targetJam) => {
		if (!selectedKelas || !selectedMapel || !tanggal || !targetJam || siswaKelasIni.length === 0) {
			return;
		}

		try {
			const params = new URLSearchParams({
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal: tanggal,
				jam_ke: targetJam,
			});
			const res = await fetch(`/api/absensi-mapel?${params.toString()}&${buildPeriodeQuery()}`);

			if (res.ok) {
				const data = await res.json();

				if (data && data.length > 0) {
					// Load existing data
					const loadedAbsensi = {};
					data.forEach((item) => {
						loadedAbsensi[item.siswa_id] = {
							status: item.status,
							keterangan: item.keterangan || '',
						};
					});
					setAbsensi(loadedAbsensi);
					setMode('rekap');
					if (data[0]?.id_row) setExistingId(data[0].id_row);
				} else {
					// Cek Draft Lokal terlebih dahulu (Offline PWA feature)
					const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${targetJam}`;
					const savedDraft = typeof window !== 'undefined' ? localStorage.getItem(draftKey) : null;

					if (savedDraft) {
						setAbsensi(JSON.parse(savedDraft));
						setMode('input');
						setExistingId(null);
					} else {
						// Data baru: Terapkan otomatis surat izin satpam jika ada yang cocok dengan jam ini!
						const newAbsensi = {};
						siswaKelasIni.forEach((s) => {
							const matchingLetter = suratKeamananHariIni.find(
								(surat) => String(surat.siswa_id).trim() === String(s.id).trim() && isLetterMatchingJam(surat, targetJam)
							);

							if (matchingLetter) {
								const targetStatus = getLetterTargetStatus(matchingLetter);
								newAbsensi[s.id] = {
									status: targetStatus,
									keterangan: `[Surat Satpam: ${matchingLetter.nomor_surat}] ${matchingLetter.alasan}`,
								};
							} else {
								newAbsensi[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
							}
						});
						setAbsensi(newAbsensi);
						setMode('input');
						setExistingId(null);
					}
				}
			}
		} catch (err) {
			console.error('Error checking absensi:', err);
		}
	}, [selectedKelas, selectedMapel, tanggal, siswaKelasIni, statusList, suratKeamananHariIni, isLetterMatchingJam, getLetterTargetStatus, buildPeriodeQuery]);

	// Trigger cek detail absensi setiap jamKe diubah
	useEffect(() => {
		if (jamKe && jamKe.trim()) {
			muatDetailSesi(jamKe);
		}
	}, [jamKe, muatDetailSesi]);

	// Handler memilih sesi dari kartu riwayat hari ini
	const handlePilihSesi = (sesi) => {
		setJamKe(sesi.jam_ke);
		muatDetailSesi(sesi.jam_ke);
	};

	// Handler mulai input jam baru (reset form ke input mode fresh)
	const handleTambahSesiBaru = () => {
		setJamKe('');
		setExistingId(null);
		setMode('input');
		const init = {};
		siswaKelasIni.forEach((s) => {
			const matchingLetter = suratKeamananHariIni.find(
				(surat) => String(surat.siswa_id).trim() === String(s.id).trim() && isLetterMatchingJam(surat, '')
			);
			if (matchingLetter) {
				const targetStatus = getLetterTargetStatus(matchingLetter);
				init[s.id] = {
					status: targetStatus,
					keterangan: `[Surat Satpam: ${matchingLetter.nomor_surat}] ${matchingLetter.alasan}`,
				};
			} else {
				init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
			}
		});
		setAbsensi(init);
	};

	// Handler terapkan surat keamanan secara manual ke form
	const handleTerapkanSuratKeamanan = () => {
		if (suratKeamananHariIni.length === 0) return;
		let appliedCount = 0;
		setAbsensi((prev) => {
			const updated = { ...prev };
			siswaKelasIni.forEach((s) => {
				const matchingLetter = suratKeamananHariIni.find(
					(surat) => String(surat.siswa_id).trim() === String(s.id).trim() && isLetterMatchingJam(surat, jamKe)
				);
				if (matchingLetter) {
					const targetStatus = getLetterTargetStatus(matchingLetter);
					updated[s.id] = {
						status: targetStatus,
						keterangan: `[Surat Satpam: ${matchingLetter.nomor_surat}] ${matchingLetter.alasan}`,
					};
					appliedCount++;
				}
			});
			return updated;
		});

		Swal.fire({
			icon: 'success',
			title: 'Surat Keamanan Diterapkan!',
			text: `${appliedCount || suratKeamananHariIni.length} siswa disesuaikan dengan surat izin pos keamanan.`,
			timer: 1500,
			showConfirmButton: false,
		});
	};

	const handleStatusChange = (siswaId, labelStatus) => {
		setAbsensi((prev) => {
			const updated = {
				...prev,
				[siswaId]: { ...(prev[siswaId] || { keterangan: '' }), status: labelStatus },
			};
			// Simpan draft lokal
			if (selectedKelas && selectedMapel && tanggal && jamKe) {
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${jamKe}`;
				localStorage.setItem(draftKey, JSON.stringify(updated));
			}
			return updated;
		});
	};

	const handleKeteranganChange = (siswaId, value) => {
		setAbsensi((prev) => {
			const updated = {
				...prev,
				[siswaId]: { ...(prev[siswaId] || { status: statusList[0]?.label || '' }), keterangan: value },
			};
			// Simpan draft lokal
			if (selectedKelas && selectedMapel && tanggal && jamKe) {
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${jamKe}`;
				localStorage.setItem(draftKey, JSON.stringify(updated));
			}
			return updated;
		});
	};

	const handleSimpan = async () => {
		// Pengecekan offline
		if (typeof window !== 'undefined' && !window.navigator.onLine) {
			Swal.fire({
				icon: 'info',
				title: 'Anda Sedang Offline',
				text: 'Pekerjaan Anda otomatis tersimpan sebagai draft di perangkat ini. Silakan tekan "Simpan" kembali saat internet terhubung.',
				confirmButtonColor: '#E8451A',
			});
			return;
		}

		let currentJamKe = jamKe ? jamKe.trim() : '';

		if (!currentJamKe) {
			const { value: inputJamKe } = await Swal.fire({
				title: 'Jam Belum Diisi',
				text: 'Masukkan Jam Ke (misal: 1-2) untuk menyimpan.',
				input: 'text',
				inputPlaceholder: 'Contoh: 1-2',
				showCancelButton: true,
				confirmButtonColor: '#4F46E5',
				cancelButtonColor: '#6B7280',
				confirmButtonText: 'Lanjutkan',
				cancelButtonText: 'Batal',
				inputValidator: (value) => {
					if (!value || value.trim() === '') {
						return 'Jam Ke wajib diisi!';
					}
				}
			});

			if (inputJamKe) {
				currentJamKe = inputJamKe.trim();
				setJamKe(currentJamKe);
			} else {
				return;
			}
		}

		const hasAbsensiData = siswaKelasIni.some((s) => absensi[s.id]);
		if (!hasAbsensiData) {
			Swal.fire('Error', 'Belum ada data absensi siswa', 'error');
			return;
		}

		if (siswaKelasIni.length === 0) return;

		// Cek apakah sesi dengan jam tersebut memiliki konflik tumpang tindih dengan sesi lain
		const conflict = findConflictingSession(sesiHariIni, currentJamKe, existingId);

		let targetSesiId = existingId;

		if (conflict && conflict.overlapType === 'overlap') {
			// Bertabrakan / tumpang tindih sebagian dengan sesi lain (misal: input Jam 1 padahal sudah ada Jam 1-3)
			const alertResult = await Swal.fire({
				title: 'Konflik Jam Pelajaran!',
				html: `
					<div class="text-left text-sm space-y-2">
						<p>Jam <b>ke-${currentJamKe}</b> bertabrakan dengan sesi <b>Jam ${conflict.session.jam_ke}</b> yang sudah tersimpan untuk kelas <b>${selectedKelas}</b> (${selectedMapel}) pada tanggal <b>${tanggal}</b>.</p>
						<div class="p-3 bg-red-50 border-2 border-[#0D0D0D] rounded-xl text-xs">
							<p class="font-bold text-[#E8451A]">Jam yang bertabrakan: Jam ke-${conflict.conflicts.join(', ')}</p>
							<p class="text-gray-600 mt-1">Satu jam pelajaran tidak boleh diabsen ganda dalam sesi terpisah.</p>
						</div>
						<p class="text-xs text-gray-700 mt-2">Untuk mengubah absensi pada jam tersebut, silakan buka sesi <b>Jam ${conflict.session.jam_ke}</b> atau masukkan jam pelajaran lain yang belum terdata.</p>
					</div>
				`,
				icon: 'error',
				showCancelButton: true,
				confirmButtonText: `Buka Sesi Jam ${conflict.session.jam_ke}`,
				cancelButtonText: 'Kembali & Ganti Jam',
				confirmButtonColor: '#2F80ED',
				cancelButtonColor: '#6B7280',
			});

			if (alertResult.isConfirmed) {
				handlePilihSesi(conflict.session);
			}
			return;
		}

		if (conflict && conflict.overlapType === 'exact' && (!existingId || mode === 'input')) {
			const existingSession = conflict.session;
			// Sesi dengan jam yang sama persis sudah ada di database! Tampilkan peringatan detail
			const alertResult = await Swal.fire({
				title: `Jam ke-${currentJamKe} Sudah Ada!`,
				html: `
					<div class="text-left text-sm space-y-2">
						<p>Data absensi <b>${selectedMapel}</b> kelas <b>${selectedKelas}</b> untuk <b>Jam ke-${currentJamKe}</b> pada tanggal <b>${tanggal}</b> sudah pernah tersimpan.</p>
						<div class="p-3 bg-amber-50 border-2 border-[#0D0D0D] rounded-xl text-xs font-mono">
							<b>Data Tersimpan Sebelumnya:</b><br/>
							🟢 Hadir: ${existingSession.summary?.hadir ?? 0} &nbsp;|&nbsp;
							🟡 Sakit: ${existingSession.summary?.sakit ?? 0} &nbsp;|&nbsp;
							🔵 Izin: ${existingSession.summary?.izin ?? 0} &nbsp;|&nbsp;
							🔴 Alfa: ${existingSession.summary?.alfa ?? 0}
						</div>
						<p class="font-bold text-[#E8451A] mt-2">Apakah Anda ingin MENIMPA data jam yang sudah ada tersebut, atau BATAL dan melihat data tersimpan?</p>
					</div>
				`,
				icon: 'warning',
				showCancelButton: true,
				showDenyButton: true,
				confirmButtonText: 'Ya, Timpa Data Lama',
				denyButtonText: 'Batal & Lihat Data Lama',
				cancelButtonText: 'Batal',
				confirmButtonColor: '#E8451A',
				denyButtonColor: '#2F80ED',
				cancelButtonColor: '#6B7280',
			});

			if (alertResult.isDenied) {
				// Pengguna ingin melihat data yang tersimpan
				handlePilihSesi(existingSession);
				return;
			}

			if (!alertResult.isConfirmed) {
				// Pengguna membatalkan
				return;
			}

			// Pengguna mengkonfirmasi untuk menimpa data yang sudah ada
			targetSesiId = existingSession.id;
			setExistingId(targetSesiId);
		} else if (!conflict) {
			// Konfirmasi simpan biasa
			const result = await Swal.fire({
				title: 'Simpan Absensi Mapel?',
				text: `Simpan data ${selectedMapel} jam ke-${currentJamKe}?`,
				icon: 'question',
				showCancelButton: true,
				confirmButtonColor: '#4F46E5',
				cancelButtonColor: '#6B7280',
				confirmButtonText: 'Ya, Simpan',
				cancelButtonText: 'Batal',
			});

			if (!result.isConfirmed) return;
		}

		// Pengecekan Geofencing jika diaktifkan untuk absensi dan bukan Admin
		let userCoords = null;
		if (geofenceSettings?.enabled && (geofenceSettings.berlaku_untuk || []).includes('absensi') && userRole !== 'Admin') {
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
									<p class="text-xs text-gray-600 font-medium">Pengisian absensi hanya dapat dilakukan dari lingkungan sekolah.</p>
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
							<p>Sekolah mewajibkan verifikasi lokasi GPS untuk mengisi absensi siswa.</p>
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

		setSaving(true);

		const dataToSave = siswaKelasIni.map((s) => ({
			siswa_id: s.id,
			status: absensi[s.id]?.status || 'Hadir',
			keterangan: absensi[s.id]?.keterangan || '',
		}));

		const payload = {
			id: targetSesiId,
			tanggal,
			kelas: selectedKelas,
			mapel: selectedMapel,
			jam_ke: currentJamKe,
			data: dataToSave,
			tahun_ajar: tahunAjarAktif,
			semester: semesterAktif,
			user_lat: userCoords?.lat,
			user_lng: userCoords?.lng,
		};

		try {
			const res = await fetch('/api/absensi-mapel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				const responseData = await res.json();
				
				// Bersihkan draft lokal karena sudah tersimpan di server
				const draftKey = `draft_absensi_${selectedKelas}_${selectedMapel}_${tanggal}_${currentJamKe}`;
				if (typeof window !== 'undefined') localStorage.removeItem(draftKey);

				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: 'Data absensi mapel tersimpan.',
					timer: 1500,
					showConfirmButton: false,
				});

				// Setelah simpan, pindah ke mode Rekap
				setMode('rekap');
				if (responseData.id) setExistingId(responseData.id);

				// Refresh daftar sesi hari ini agar badge & list langsung terupdate
				await fetchSesiHariIni();
			} else {
				const errJson = await res.json().catch(() => ({}));
				throw new Error(errJson.error || 'Gagal menyimpan');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Gagal Menyimpan', error.message || 'Gagal menyimpan data', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleHapus = async () => {
		const result = await Swal.fire({
			title: 'Hapus Absensi?',
			text: `Yakin ingin menghapus data absensi ${selectedMapel} kelas ${selectedKelas} jam ke-${jamKe}?`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			setLoading(true);
			const params = new URLSearchParams({
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal: tanggal,
				jam_ke: jamKe,
			});
			const res = await fetch(`/api/absensi-mapel?${params.toString()}`, {
				method: 'DELETE',
			});

			if (res.ok) {
				await Swal.fire('Terhapus!', 'Data absensi telah dihapus.', 'success');
				// Reset data
				const init = {};
				siswaKelasIni.forEach((s) => {
					init[s.id] = { status: statusList[0]?.label || 'Hadir', keterangan: '' };
				});
				setAbsensi(init);
				setExistingId(null);
				setMode('input');
				// Refresh riwayat sesi hari ini
				await fetchSesiHariIni();
			} else {
				throw new Error('Gagal menghapus data');
			}
		} catch (error) {
			console.error(error);
			Swal.fire('Error', 'Gagal menghapus data absensi', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleExportPDF = async () => {
		if (siswaKelasIni.length === 0) {
			Swal.fire('Info', 'Tidak ada data siswa untuk dicetak ke PDF', 'info');
			return;
		}

		try {
			const prof = await fetchSchoolProfile().catch(() => DEFAULT_PROFIL_SEKOLAH);
			const doc = new jsPDF({ orientation: 'portrait' });
			const endKop = drawKopSuratPDF(doc, prof);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(12);
			doc.setTextColor(15, 23, 42);
			doc.text(
				'PRESENSI KEHADIRAN SISWA PER KBM',
				doc.internal.pageSize.getWidth() / 2,
				endKop + 4,
				{ align: 'center' }
			);

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8.5);
			doc.setTextColor(71, 85, 105);
			doc.text(
				`Kelas: ${selectedKelas}   •   Mapel: ${selectedMapel}   •   Tanggal: ${tanggal} (Jam ke-${jamKe || '-'})`,
				doc.internal.pageSize.getWidth() / 2,
				endKop + 9,
				{ align: 'center' }
			);

			let h = 0, s = 0, i = 0, a = 0;
			const tableBody = siswaKelasIni.map((siswa, idx) => {
				const statusRaw = absensi[siswa.id]?.status || absensi[siswa.id] || 'Hadir';
				const statusClean = normStatus(statusRaw);
				if (statusClean === 'hadir') h++;
				else if (statusClean === 'sakit') s++;
				else if (statusClean === 'izin') i++;
				else if (statusClean === 'alfa') a++;

				return [
					idx + 1,
					siswa.nis || siswa.nisn || '-',
					siswa.nama_lengkap,
					siswa.jenis_kelamin || '-',
					statusClean.toUpperCase(),
					absensi[siswa.id]?.keterangan || '-',
				];
			});

			tableBody.push([
				{
					content: `RINGKASAN: Hadir: ${h}  |  Sakit: ${s}  |  Izin: ${i}  |  Alfa: ${a} (Total: ${siswaKelasIni.length} Siswa)`,
					colSpan: 6,
					styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 247, 240] },
				},
			]);

			autoTable(doc, {
				startY: endKop + 13,
				head: [
					[
						{ content: 'No', styles: { halign: 'center' } },
						{ content: 'NIS / NISN', styles: { halign: 'center' } },
						{ content: 'Nama Siswa', styles: { halign: 'left' } },
						{ content: 'L/P', styles: { halign: 'center' } },
						{ content: 'Status Presensi', styles: { halign: 'center' } },
						{ content: 'Keterangan', styles: { halign: 'left' } },
					],
				],
				body: tableBody,
				theme: 'grid',
				headStyles: {
					fillColor: [245, 197, 24],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 8,
				},
				bodyStyles: {
					fontSize: 8,
					textColor: [15, 23, 42],
				},
				columnStyles: {
					0: { halign: 'center', cellWidth: 10 },
					1: { halign: 'center', cellWidth: 26 },
					2: { cellWidth: 45 },
					3: { halign: 'center', cellWidth: 14 },
					4: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
					5: { cellWidth: 'auto' },
				},
			});

			const finalY = (doc.lastAutoTable?.finalY || endKop + 60) + 8;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			let signY = finalY;
			if (signY + 36 > pageHeight) {
				doc.addPage();
				signY = 20;
			}

			const todayFormatted = new Intl.DateTimeFormat('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			}).format(new Date());

			doc.setFontSize(8.5);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(0, 0, 0);

			doc.text(`Batang Cenaku, ${todayFormatted}`, pageWidth - 70, signY);
			doc.text('Guru Pengampu Mapel,', pageWidth - 70, signY + 4.5);
			doc.setFont('helvetica', 'bold');
			doc.text('( .......................................... )', pageWidth - 70, signY + 24);

			doc.save(`Presensi_${selectedKelas}_${selectedMapel}_${tanggal}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_'));
		} catch (err) {
			console.error('Gagal cetak PDF presensi mapel:', err);
			Swal.fire('Gagal', 'Terjadi kesalahan saat mencetak PDF: ' + err.message, 'error');
		}
	};

	const goToRiwayat = () => {
		const kelasObj = kelasList.find(k => k.kelas === selectedKelas || k.nama_kelas === selectedKelas);
		if (kelasObj && kelasObj.id) {
			router.push(`/kelas/${kelasObj.id}/riwayat-absensi-mapel`);
		} else {
			Swal.fire('Info', 'Gagal menemukan ID Kelas untuk melihat riwayat', 'info');
		}
	};

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[var(--background)] pb-32 font-sans'>
			{/* --- Header & Filters --- */}
			<div className='bg-white border-b-4 border-[#0D0D0D] shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]'>
				<div className='max-w-5xl mx-auto px-4 py-4 space-y-4'>
					<ButtonBack />
					{/* Title Row */}
					<div className='flex flex-wrap justify-between items-center gap-3'>
						<div>
							<div className='flex flex-wrap items-center gap-2 sm:gap-3'>
								<h1 className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-tight'>Absensi Mapel</h1>
								<AcademicPeriodChip align='left' />
							</div>
							<div className='flex flex-wrap items-center gap-2 mt-2'>
								{mode === 'rekap' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#2F80ED] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Data Tersimpan (Rekap)</span>
								) : mode === 'edit' ? (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>Mode Edit</span>
								) : (
									<span className='px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border-2 border-[#0D0D0D] bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D]'>Input Baru</span>
								)}

								{geofenceSettings?.enabled && (geofenceSettings.berlaku_untuk || []).includes('absensi') && (
									<span className='px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border-2 border-[#0D0D0D] bg-emerald-300 text-emerald-950 shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1'>
										<span>📍</span>
										<span>Geofence Aktif ({geofenceSettings.radius}m)</span>
									</span>
								)}
							</div>
						</div>
						<button
							onClick={() => router.push('/laporan')}
							className='neo-btn-outline flex items-center gap-2 bg-[#F5C518] hover:bg-[#E8451A] hover:text-white'>
							<span className='text-xl'>📅</span> <span className='hidden sm:inline'>Rekap Bulanan</span>
						</button>
					</div>

					{/* Geofence Status Card Banner */}
					<GeofenceStatusCard
						geofenceSettings={geofenceSettings}
						moduleName="absensi"
						userRole={userRole}
						locationStatus={locationStatus}
						setLocationStatus={setLocationStatus}
						className="mb-4"
					/>

					{/* Filter Grid */}
					<div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
						{/* Kelas */}
						<div className='relative'>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								disabled={mode === 'edit'} // Kunci saat edit
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Mapel */}
						<div className='relative'>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								disabled={mode === 'edit'}
								className='neo-input appearance-none bg-white pr-10 cursor-pointer disabled:bg-gray-200 disabled:cursor-not-allowed'>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
							<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
						</div>

						{/* Tanggal */}
						<input
							type='date'
							value={tanggal}
							onChange={(e) => setTanggal(e.target.value)}
							disabled={mode === 'edit'}
							className='neo-input bg-white disabled:bg-gray-200 disabled:cursor-not-allowed'
						/>

						{/* Jam Ke */}
						<div className='relative'>
							<input
								type='text'
								placeholder='Jam (mis: 1-2)'
								value={jamKe}
								onChange={(e) => setJamKe(e.target.value)}
								disabled={mode === 'edit'}
								className={`neo-input text-center w-full disabled:bg-gray-200 disabled:cursor-not-allowed ${
									!jamKe ? 'border-[#E8451A] bg-[#FFF5F0]' : 'bg-white'
								}`}
							/>
						</div>
					</div>

					{/* Banner Surat Izin Pos Keamanan (Muncul jika ada surat aktif di kelas & tanggal terpilih) */}
					{suratKeamananHariIni.length > 0 && (
						<div className='mt-3 p-3.5 bg-orange-50 border-2 border-[#0D0D0D] rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] space-y-2.5'>
							<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-orange-200'>
								<div className='flex items-center gap-2'>
									<span className='text-xl'>👮‍♂️</span>
									<div>
										<h4 className='font-black text-xs uppercase text-[#0D0D0D] tracking-tight flex items-center gap-1.5'>
											<span>Surat Izin Pos Keamanan</span>
											<span className='bg-orange-300 text-black px-1.5 py-0.2 rounded border border-black text-[10px]'>
												{suratKeamananHariIni.length} Siswa
											</span>
										</h4>
										<p className='text-[11px] font-bold text-orange-950'>
											Diterbitkan di pos gerbang untuk <b>{selectedKelas}</b> pada tanggal ini.
										</p>
									</div>
								</div>
								{mode !== 'rekap' && userRole !== 'Kepala Sekolah' && (
									<button
										type='button'
										onClick={handleTerapkanSuratKeamanan}
										className='px-2.5 py-1 bg-[#00A693] hover:bg-emerald-600 text-white rounded-lg border border-[#0D0D0D] text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#0D0D0D] transition-all shrink-0 flex items-center gap-1 cursor-pointer'>
										<span>⚡ Terapkan Otomatis ke Form</span>
									</button>
								)}
							</div>

							<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
								{suratKeamananHariIni.map((surat) => {
									const isMatchingThisJam = isLetterMatchingJam(surat, jamKe);
									return (
										<div
											key={surat.id}
											className={`bg-white p-2.5 rounded-lg border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-xs space-y-1 transition-all ${
												isMatchingThisJam ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
											}`}>
											<div className='flex items-center justify-between gap-1'>
												<span className='font-black text-[#0D0D0D] line-clamp-1'>{surat.nama_siswa}</span>
												<span className='px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-orange-200 border border-black shrink-0'>
													{surat.status_absensi || 'Izin'}
												</span>
											</div>
											<p className='text-[11px] text-gray-700 font-bold'>
												<span className='text-orange-900'>
													{surat.tipe_surat === 'terlambat' ? '🕒 Terlambat' : surat.tipe_surat === 'izin_keluar' ? '🚪 Keluar' : surat.tipe_surat === 'pulang_cepat' ? '🏠 Pulang Cepat' : '📋 Titip Izin'}:
												</span>{' '}
												<span className='font-normal italic'>{surat.alasan}</span>
											</p>
											<div className='flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1 border-t border-gray-100'>
												<span>{surat.berlaku_seharian ? 'Seharian' : `Jam ${surat.jam_ke_mulai || '1'}-${surat.jam_ke_selesai || '1'}`}</span>
												{isMatchingThisJam ? (
													<span className='text-emerald-700 font-sans font-black'>✓ Cocok Jam Ini</span>
												) : (
													<span>{surat.nomor_surat}</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Indikator Jam Tersimpan & Konflik Tumpang Tindih */}
					{jamKe && currentJamConflict?.overlapType === 'overlap' && (
						<div className='mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-rose-50 border-2 border-[#E8451A] rounded-xl text-xs font-bold text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] animate-shake'>
							<div className='flex items-center gap-2'>
								<span className='text-base shrink-0'>⚠️</span>
								<span>
									<b className='text-[#E8451A]'>Konflik Jam:</b> Jam ke-<b>{jamKe}</b> bertabrakan dengan sesi <b>Jam {currentJamConflict.session.jam_ke}</b> (Jam ke-{currentJamConflict.conflicts.join(', ')}).
								</span>
							</div>
							<button
								type='button'
								onClick={() => handlePilihSesi(currentJamConflict.session)}
								className='px-2.5 py-1 bg-white border border-[#0D0D0D] shadow-[1px_1px_0px_0px_#0D0D0D] rounded-lg text-[10px] font-black uppercase text-[#2F80ED] hover:bg-blue-50 transition-all shrink-0 cursor-pointer text-center'>
								Buka Sesi Jam {currentJamConflict.session.jam_ke} →
							</button>
						</div>
					)}

					{jamKe && currentJamConflict?.overlapType === 'exact' && (
						<div className='mt-2 flex items-center justify-between gap-2 px-3.5 py-2 bg-[#E2F7F4] border-2 border-[#0D0D0D] rounded-xl text-xs font-bold text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
							<div className='flex items-center gap-2'>
								<span className='w-2.5 h-2.5 rounded-full bg-[#00A693] border border-[#0D0D0D] inline-block animate-pulse'></span>
								<span>Sesi <b>Jam {jamKe}</b> sudah pernah tersimpan pada tanggal ini.</span>
							</div>
							<span className='text-[10px] uppercase font-black px-2 py-0.5 rounded bg-[#00A693] text-white border border-[#0D0D0D]'>
								Tersimpan
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Archive Banner */}
			<ArchiveBanner />
			{userRole === 'Kepala Sekolah' && (
				<div className='max-w-5xl mx-auto px-4 mt-4'>
					<div className='bg-[#6366F1] text-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
						<div className='flex items-center gap-3'>
							<span className='text-2xl'>🎓</span>
							<div>
								<div className='font-black text-sm uppercase tracking-wider'>Mode Supervisi Presensi Siswa</div>
								<div className='text-xs font-bold opacity-90'>Menampilkan rekapitulasi kehadiran mata pelajaran seluruh kelas (Hanya Lihat).</div>
							</div>
						</div>
						<span className='bg-white text-[#0D0D0D] px-3 py-1 text-xs font-black uppercase border-[2px] border-[#0D0D0D] w-fit'>
							Read Only
						</span>
					</div>
				</div>
			)}

			{/* --- PANEL RIWAYAT SESI HARI INI / TANGGAL INI --- */}
			<div className='max-w-5xl mx-auto px-4 mt-4'>
				<div className='bg-white border-[3px] border-[#0D0D0D] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#0D0D0D]'>
						<div className='flex items-center flex-wrap gap-2'>
							<span className='text-xl'>📋</span>
							<h3 className='font-black text-sm uppercase text-[#0D0D0D]'>
								Riwayat Sesi Absensi ({new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})
							</h3>
							<span className='text-xs font-black px-2.5 py-0.5 rounded-lg border-2 border-[#0D0D0D] bg-[#FFF5F0] text-[#0D0D0D]'>
								{selectedKelas} • {selectedMapel}
							</span>
						</div>
						<div className='flex items-center gap-2 flex-wrap'>
							{sesiHariIni.length > 0 ? (
								<span className='text-xs font-black uppercase tracking-wider bg-[#00A693] text-white px-2.5 py-1 rounded-lg border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
									{sesiHariIni.length} Sesi Terdata
								</span>
							) : (
								<span className='text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-[#0D0D0D]'>
									0 Sesi Terdata
								</span>
							)}
							<button
								type='button'
								onClick={goToRiwayat}
								className='text-xs font-bold text-[#2F80ED] hover:text-[#0D0D0D] hover:underline flex items-center gap-1 transition-colors'>
								Riwayat Lengkap ↗
							</button>
						</div>
					</div>

					{/* Isi Sesi Hari Ini */}
					{loadingSesiHariIni ? (
						<div className='py-4 text-center text-xs font-bold text-gray-500 animate-pulse'>
							Memeriksa sesi absensi tersimpan...
						</div>
					) : sesiHariIni.length > 0 ? (
						<div className='mt-3 space-y-2'>
							<p className='text-xs font-bold text-gray-700'>
								Sesi yang sudah diinput pada tanggal ini (klik untuk melihat atau mengedit):
							</p>
							<div className='flex flex-wrap items-center gap-2.5'>
								{sesiHariIni.map((sesi) => {
									const isCurrent = jamKe === sesi.jam_ke;
									return (
										<button
											key={sesi.id}
											type='button'
											onClick={() => handlePilihSesi(sesi)}
											className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-[#0D0D0D] text-xs font-bold transition-all ${
												isCurrent
													? 'bg-[#2F80ED] text-white shadow-none translate-x-[2px] translate-y-[2px]'
													: 'bg-[#FFF5F0] hover:bg-[#F5C518] text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-0.5'
											}`}>
											<span className='font-black'>🕒 Jam {sesi.jam_ke}</span>
											<span className='px-1.5 py-0.5 rounded bg-white text-[#0D0D0D] border border-[#0D0D0D] text-[10px] font-mono font-bold'>
												H:{sesi.summary?.hadir ?? 0} S:{sesi.summary?.sakit ?? 0} I:{sesi.summary?.izin ?? 0} A:{sesi.summary?.alfa ?? 0}
											</span>
											{isCurrent && (
												<span className='text-[10px] font-black uppercase tracking-wider ml-1 bg-white text-[#2F80ED] px-1.5 py-0.5 rounded'>
													✓ Aktif
												</span>
											)}
										</button>
									);
								})}

								{/* Tombol Input Sesi Baru */}
								{(jamKe || mode === 'rekap') && (
									<button
										type='button'
										onClick={handleTambahSesiBaru}
										className='flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-[#0D0D0D] bg-white hover:bg-[#00A693] hover:text-white text-xs font-black text-[#0D0D0D] transition-all shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span>➕</span> <span>Input Jam Baru</span>
									</button>
								)}
							</div>
						</div>
					) : (
						<div className='mt-3 flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-gray-700 bg-[#FFF5F0] p-3 rounded-xl border-2 border-dashed border-gray-400'>
							<span className='flex items-center gap-1.5'>
								<span>💡</span>
								<span>Belum ada absensi <b>{selectedMapel}</b> untuk kelas <b>{selectedKelas}</b> pada tanggal ini. Siap untuk input baru.</span>
							</span>
							<span className='text-[11px] text-gray-600 font-normal'>
								Silakan masukkan <b>Jam Ke (mis: 1-2)</b> sebelum menyimpan absensi.
							</span>
						</div>
					)}
				</div>
			</div>

			{/* --- MAIN CONTENT --- */}
			<div className='max-w-5xl mx-auto px-4 py-6'>
				{/* 1. STATE KOSONG */}
				{siswaKelasIni.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-20'>
						<div className='text-6xl mb-4 drop-shadow-[4px_4px_0px_#0D0D0D]'>🎓</div>
						<p className='text-[#0D0D0D] font-bold text-xl border-2 border-[#0D0D0D] px-6 py-3 rounded-xl bg-white shadow-[4px_4px_0px_0px_#0D0D0D]'>Tidak ada siswa di kelas ini</p>
					</div>
				) : (
					<>
						{/* Search Bar */}
						<div className='mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border-2 border-[#0D0D0D] rounded-2xl shadow-[3px_3px_0px_0px_#0D0D0D]'>
							<div className='relative flex-1'>
								<div className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500'>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
									</svg>
								</div>
								<input
									type='text'
									placeholder='Cari nama atau NIS siswa...'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='w-full pl-10 pr-10 py-2 bg-transparent text-[#0D0D0D] font-bold text-sm outline-none placeholder:text-gray-400'
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className='absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-black font-black text-sm'
										title='Hapus pencarian'>
										✕
									</button>
								)}
							</div>
							<div className='text-xs font-bold text-[#0D0D0D] bg-[#FFF5F0] border-2 border-[#0D0D0D] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_#0D0D0D] shrink-0 text-center sm:text-left'>
								{searchQuery.trim() ? (
									<span>Menampilkan <b>{filteredSiswa.length}</b> dari {siswaKelasIni.length} siswa</span>
								) : (
									<span>Total: <b>{siswaKelasIni.length}</b> siswa</span>
								)}
							</div>
						</div>

						{filteredSiswa.length === 0 ? (
							<div className='bg-white border-2 border-[#0D0D0D] rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D] p-8 text-center my-4'>
								<div className='text-4xl mb-2'>🔍</div>
								<p className='font-bold text-[#0D0D0D] text-base'>Tidak ada siswa yang cocok dengan &quot;{searchQuery}&quot;</p>
								<button
									onClick={() => setSearchQuery('')}
									className='mt-3 neo-btn-outline bg-[#F5C518] text-[#0D0D0D] text-xs py-1.5 px-4 rounded-xl font-bold'>
									Reset Pencarian
								</button>
							</div>
						) : mode === 'rekap' ? (
							/* 2. MODE REKAPITULASI (Tabel Read Only) */
							<div className='neo-card p-0 overflow-hidden'>
								<div className='px-6 py-5 border-b-4 border-[#0D0D0D] flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 bg-[#F5C518]'>
									<div>
										<h2 className='font-black text-[#0D0D0D] text-xl uppercase tracking-tight'>Rekapitulasi Kehadiran</h2>
										<p className='text-sm font-bold text-[#0D0D0D]'>
											{selectedKelas} • {selectedMapel} • Jam ke-{jamKe}
										</p>
									</div>
									<div className='flex flex-wrap gap-3'>
										<button
											onClick={handleExportPDF}
											className='neo-btn-outline bg-rose-100 text-rose-950 hover:bg-rose-200 flex items-center gap-1.5 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-black text-sm cursor-pointer'
											title='Cetak / Unduh presensi KBM ini ke format PDF'>
											<span>📄</span>
											<span>Cetak PDF</span>
										</button>
										{userRole !== 'Kepala Sekolah' && (
											<button
												onClick={handleHapus}
												className='neo-btn-outline bg-[#E8451A] text-white hover:bg-white hover:text-[#E8451A] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
												<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
												<span className='hidden sm:inline'>Hapus</span>
											</button>
										)}
										<button
											onClick={goToRiwayat}
											className='neo-btn-outline bg-[#2F80ED] text-white hover:bg-white hover:text-[#2F80ED] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
											<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/></svg>
											<span className='hidden sm:inline'>Riwayat</span>
										</button>
										{userRole !== 'Kepala Sekolah' ? (
											<button
												onClick={() => setMode('edit')}
												className='neo-btn-outline bg-[#00A693] text-white hover:bg-white hover:text-[#00A693] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] py-1.5 px-3 rounded-xl font-bold text-sm'>
												<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'/></svg>
												<span className='hidden sm:inline'>Edit</span>
											</button>
										) : (
											<span className='bg-white text-[#6366F1] flex items-center gap-1 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] py-1 px-3 rounded-xl font-black text-xs uppercase'>
												👁️ Pantau
											</span>
										)}
									</div>
								</div>

								<div className='overflow-x-auto'>
									<table className='w-full'>
										<thead className='bg-[#0D0D0D] text-white text-xs uppercase tracking-wider font-bold border-b-4 border-[#0D0D0D]'>
											<tr>
												<th className='px-6 py-4 text-left w-16 border-r-2 border-[#0D0D0D]'>No</th>
												<th className='px-6 py-4 text-left border-r-2 border-[#0D0D0D]'>Nama Siswa</th>
												<th className='px-6 py-4 text-center w-32 border-r-2 border-[#0D0D0D]'>Status</th>
												<th className='px-6 py-4 text-left w-1/3'>Keterangan</th>
											</tr>
										</thead>
										<tbody className='divide-y-2 divide-[#0D0D0D] bg-white'>
											{filteredSiswa.map((siswa, idx) => {
												const status = absensi[siswa.id]?.status || '-';
												const ket = absensi[siswa.id]?.keterangan || '-';
												return (
													<tr
														key={siswa.id}
														className='hover:bg-[#FFF5F0] transition-colors'>
														<td className='px-6 py-4 font-bold text-[#0D0D0D] border-r-2 border-[#0D0D0D]'>{idx + 1}</td>
														<td className='px-6 py-4 border-r-2 border-[#0D0D0D]'>
															<p className='font-bold text-[#0D0D0D] text-base'>
																{siswa.nama_lengkap}
																{siswa.status !== 'Aktif' && (
																	<span className='ml-2 text-[10px] font-black uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'>
																		{siswa.status}
																	</span>
																)}
															</p>
															<p className='text-sm text-gray-600 font-mono font-bold mt-1'>{siswa.nis}</p>
															{suratKeamananHariIni.some((s) => String(s.siswa_id).trim() === String(siswa.id).trim()) && (
																<span className='inline-block text-[10px] font-black uppercase text-orange-950 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-400 mt-1'>
																	👮‍♂️ Ada Surat Satpam
																</span>
															)}
														</td>
														<td className='px-6 py-4 text-center border-r-2 border-[#0D0D0D]'>{getBadgeRekap(status)}</td>
														<td className='px-6 py-4 text-sm font-semibold text-[#0D0D0D]'>{ket !== '-' ? ket : <span className='text-gray-400 italic'>Tidak ada keterangan</span>}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						) : (
							/* 3. MODE INPUT / EDIT (Card UI) */
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
								{filteredSiswa.map((siswa, idx) => {
									const currentStatus = absensi[siswa.id]?.status || 'Hadir';
									const siswaLetter = suratKeamananHariIni.find(
										(surat) => String(surat.siswa_id).trim() === String(siswa.id).trim()
									);

									return (
										<div
											key={siswa.id}
											className='neo-card flex flex-col gap-3 relative'>
											<div className='flex justify-between items-start mb-1'>
												<div className='pr-8'>
													<div className='flex flex-wrap items-center gap-2 mb-1'>
														<h3 className='font-bold text-[#0D0D0D] line-clamp-1 text-lg uppercase tracking-tight'>
															{siswa.nama_lengkap}
															{siswa.status !== 'Aktif' && (
																<span className='ml-2 inline-flex items-center text-[10px] font-black uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] align-middle'>
																	{siswa.status}
																</span>
															)}
														</h3>
														<div className='flex gap-1 shrink-0'>
															{siswa.poinPositif > 0 && (
																<span
																	className='text-[10px] font-bold text-white bg-[#00A693] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
																	title='Poin +'>
																	+{siswa.poinPositif}
																</span>
															)}
															{siswa.poinNegatif > 0 && (
																<span
																	className='text-[10px] font-bold text-white bg-[#E8451A] border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] px-2 py-0.5 rounded-md'
																	title='Pelanggaran -'>
																	-{siswa.poinNegatif}
																</span>
															)}
														</div>
													</div>
													<p className='text-xs text-[#0D0D0D] font-mono font-bold'>{siswa.nis || '-'}</p>
												</div>
												<span className='absolute top-4 right-4 text-sm font-black text-[#0D0D0D] border-2 border-[#0D0D0D] w-8 h-8 flex items-center justify-center rounded-full bg-[#F5C518] shadow-[2px_2px_0px_0px_#0D0D0D]'>
													{idx + 1}
												</span>
											</div>

											{/* Indikator Surat Satpam Aktif di Kartu Siswa */}
											{siswaLetter && (
												<div className='flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-100 border-2 border-orange-500 text-orange-950 text-xs font-bold shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<div className='flex items-center gap-1.5 overflow-hidden'>
														<span className='text-sm shrink-0'>👮‍♂️</span>
														<div className='overflow-hidden'>
															<span className='font-black uppercase text-[10px] text-orange-900 block'>
																Surat Satpam ({siswaLetter.tipe_surat === 'terlambat' ? 'Terlambat' : siswaLetter.tipe_surat === 'izin_keluar' ? 'Izin Keluar' : siswaLetter.tipe_surat === 'pulang_cepat' ? 'Pulang Cepat' : 'Titip Izin'}):
															</span>
															<span className='line-clamp-1 text-[11px]'>{siswaLetter.alasan}</span>
														</div>
													</div>
													<span className='px-1.5 py-0.5 rounded bg-white text-black text-[10px] font-mono font-bold border border-orange-300 shrink-0'>
														{siswaLetter.berlaku_seharian ? 'Seharian' : `Jam ${siswaLetter.jam_ke_mulai || '1'}-${siswaLetter.jam_ke_selesai || '1'}`}
													</span>
												</div>
											)}

											<div className='grid grid-cols-4 gap-2 my-2'>
												{statusList.map((st) => {
													const isActive = currentStatus === st.label;
													return (
														<button
															key={st.id}
															onClick={() => handleStatusChange(siswa.id, st.label)}
															disabled={siswa.status !== 'Aktif' || userRole === 'Kepala Sekolah'}
															className={`${getStatusClasses(st.warna, isActive)} ${siswa.status !== 'Aktif' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
															{st.kode || st.label.substring(0, 1)}
														</button>
													);
												})}
											</div>

											<div className='relative'>
												<input
													type='text'
													placeholder='Keterangan...'
													value={absensi[siswa.id]?.keterangan || ''}
													onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
													disabled={siswa.status !== 'Aktif' || userRole === 'Kepala Sekolah'}
													className='neo-input text-sm disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed'
												/>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>

			{/* --- Floating Save Button (Hanya Muncul di Mode Input/Edit) --- */}
			{siswaKelasIni.length > 0 && mode !== 'rekap' && userRole !== 'Kepala Sekolah' && (
				<div className='fixed bottom-0 left-0 right-0 p-4 bg-[#FFF5F0] border-t-4 border-[#0D0D0D] z-30 flex justify-end shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]'>
					<button
						onClick={handleSimpan}
						disabled={saving}
						className='w-full md:w-auto neo-btn-primary bg-[#0D0D0D] text-white py-3 px-10 text-lg uppercase tracking-wider flex items-center justify-center gap-2'>
						{saving ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			)}
		</div>
	);
}
