'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '../components/loading';
import { createClient } from '@/utils/supabase/client';

export default function PenilaianPage() {
	const router = useRouter();

	// State Data Master
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);

	// State Filter & Form
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [judul, setJudul] = useState('');
	const [type, setType] = useState('Formatif');
	const [deskripsi, setDeskripsi] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [nilai, setNilai] = useState({}); // Object {siswa_id: nilai}
	const [searchSiswa, setSearchSiswa] = useState('');

	// State UI
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// State Daftar Tugas (Side/Top Menu)
	const [daftarTugas, setDaftarTugas] = useState([]);
	const [selectedTugasId, setSelectedTugasId] = useState('');
	const [loadingTugas, setLoadingTugas] = useState(false);
	const [initialSiswaIds, setInitialSiswaIds] = useState([]);

	// --- 1. Fetch Data Awal (Kelas, Mapel, Siswa) ---
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const supabase = createClient();
				const [dataKelas, dataMapel, dataSiswa] = await Promise.all([
					fetch('/api/kelas?all=false').then(res => res.json()),
					fetch('/api/mapel?all=false').then(res => res.json()),
					fetch('/api/siswa?status=Aktif').then(res => res.json())
				]);

				setKelasList(dataKelas || []);
				setMapelList(dataMapel || []);
				setSiswaList(dataSiswa || []);

				if (dataKelas && dataKelas.length > 0) {
					setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				}
				if (dataMapel && dataMapel.length > 0) {
					setSelectedMapel(dataMapel[0].mapel || dataMapel[0].nama_mapel);
				}
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchAll();
	}, []);

	const siswaKelasIni = siswaList.filter((s) => s.kelas === selectedKelas);

	// --- 2. Fetch Daftar Tugas saat Filter Berubah ---
	useEffect(() => {
		if (!selectedKelas || !selectedMapel) return;

		// Reset ke mode "Tugas Baru" setiap kali mapel/kelas berubah
		setSelectedTugasId('');
		setJudul('');
		setType('Formatif');
		setDeskripsi('');
		setNilai({});
		setInitialSiswaIds([]);
		setTanggal(new Date().toISOString().slice(0, 10));
		setSearchSiswa('');

		const fetchTugas = async () => {
			try {
				setLoadingTugas(true);
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
				const userId = userData?.id_user;
				const role = userData?.role;

				let query = supabase.from('nilai_tugas').select('tugas_id, kategori, tanggal, kelas, mapel, guru_id').eq('kelas', selectedKelas).eq('mapel', selectedMapel);
				if (role === 'Guru' && userId) {
					query = query.eq('guru_id', userId);
				}

				const { data: tugasData } = await query;
				
				if (tugasData) {
					const tugasIds = tugasData.map(t => t.tugas_id);
					let counts = {};
					if (tugasIds.length > 0) {
						const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id, nilai').in('tugas_id', tugasIds);
						if (siswaData) {
							siswaData.forEach(s => {
								if (s.nilai && parseInt(s.nilai) > 0) {
									counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
								}
							});
						}
					}

					const mappedTugas = tugasData.map(t => ({
						tugas_id: t.tugas_id,
						judul: t.kategori,
						tanggal: t.tanggal,
						kelas: t.kelas,
						mapel: t.mapel,
						jumlahSiswaMengumpulkan: counts[t.tugas_id] || 0,
						totalSiswa: siswaList.filter(s => s.kelas === t.kelas).length
					}));

					setDaftarTugas(mappedTugas.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
				}
			} catch (err) {
				console.error('Error fetching tugas:', err);
			} finally {
				setLoadingTugas(false);
			}
		};
		fetchTugas();
	}, [selectedKelas, selectedMapel]);

	// --- 3. Load Nilai Detail saat Tugas Dipilih ---
	useEffect(() => {
		if (!selectedTugasId) {
			// Mode "Tugas Baru" -> Reset Form
			setJudul('');
			setType('Formatif');
			setDeskripsi('');
			setNilai({});
			setInitialSiswaIds([]);
			return;
		}

		const loadNilaiTugas = async () => {
			try {
				const supabase = createClient();
				
				const { data: headerData } = await supabase.from('nilai_tugas').select('*').eq('tugas_id', selectedTugasId).single();
				if (headerData) {
					setJudul(headerData.kategori);
					setType(headerData.type || 'Formatif');
					setDeskripsi(headerData.deskripsi || '');
					setTanggal(headerData.tanggal);
				}

				const { data: siswaData } = await supabase.from('nilai_siswa').select('siswa_id, nilai').eq('tugas_id', selectedTugasId);
				if (siswaData) {
					const existingIds = siswaData.map((item) => item.siswa_id);
					setInitialSiswaIds(existingIds);

					const nilaiMap = {};
					siswaData.forEach((item) => {
						nilaiMap[item.siswa_id] = item.nilai;
					});
					setNilai(nilaiMap);
				}
			} catch (err) {
				console.error('Error loading nilai tugas:', err);
			}
		};
		loadNilaiTugas();
	}, [selectedTugasId]);

	// --- Helper Functions ---

	const getSiswaById = (siswaId) => {
		return siswaList.find((s) => s.id === siswaId);
	};

	const getNilaiColor = (nilaiValue) => {
		if (!nilaiValue || nilaiValue === '') return 'bg-[#E8E8E8] text-[#0D0D0D]';
		const n = parseFloat(nilaiValue);
		if (n >= 90) return 'bg-[#00A693] text-white';
		if (n >= 80) return 'bg-[#2F80ED] text-white';
		if (n >= 70) return 'bg-[#F5C518] text-[#0D0D0D]';
		if (n >= 60) return 'bg-[#E8451A] text-white';
		return 'bg-[#0D0D0D] text-white';
	};

	const getPredikat = (nilaiValue) => {
		if (!nilaiValue || nilaiValue === '') return '-';
		const n = parseFloat(nilaiValue);
		if (n >= 90) return 'A';
		if (n >= 80) return 'B';
		if (n >= 70) return 'C';
		if (n >= 60) return 'D';
		return 'E';
	};

	// Handle input manual (Mode Tugas Baru)
	const handleNilaiChange = (siswaId, value) => {
		if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
			setNilai((prev) => ({
				...prev,
				[siswaId]: value,
			}));
		}
	};

	// Refresh data setelah edit
	const refreshCurrentTugasData = async (tugasId) => {
		if (!tugasId) return;
		try {
			const supabase = createClient();
			const { data: siswaData } = await supabase.from('nilai_siswa').select('siswa_id, nilai').eq('tugas_id', tugasId);
			if (siswaData) {
				const existingIds = siswaData.map((item) => item.siswa_id);
				setInitialSiswaIds(existingIds);

				const nilaiMap = {};
				siswaData.forEach((item) => {
					nilaiMap[item.siswa_id] = item.nilai;
				});
				setNilai((prev) => ({
					...prev,
					...nilaiMap,
				}));
			}
		} catch (err) {
			console.error('Error refreshing current tugas data:', err);
		}
	};

	// --- 4. Logic Simpan & Update ---

	// Simpan Massal (Hanya untuk Mode Tugas Baru)
	const handleSimpanMassal = async () => {
		if (!judul.trim()) {
			Swal.fire({
				icon: 'error',
				title: 'Judul Kosong',
				text: 'Masukkan judul tugas/penilaian',
				confirmButtonColor: '#4F46E5',
			});
			return;
		}

		// Prepare payload
		const nilaiArray = filteredSiswa.map((s) => ({
			siswa_id: s.id,
			nilai: nilai[s.id] || '0',
		}));

		const terisi = nilaiArray.filter((n) => n.nilai && parseInt(n.nilai) > 0).length;
		if (terisi === 0) {
			Swal.fire({
				icon: 'warning',
				title: 'Tidak Ada Nilai',
				text: 'Masukkan minimal 1 nilai siswa',
				confirmButtonColor: '#4F46E5',
			});
			return;
		}

		const result = await Swal.fire({
			title: 'Simpan Nilai Baru?',
			text: `Menyimpan nilai untuk ${terisi} siswa`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Simpan',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);

		const payload = {
			judul,
			type,
			deskripsi,
			kelas: selectedKelas,
			mapel: selectedMapel,
			tanggal,
			nilai: nilaiArray,
		};

		// Jika tidak ada koneksi, simpan ke antrian lokal
		if (!navigator.onLine) {
			addToQueue('nilai', payload, 'POST', '/api/nilai_local_queue');
			await Swal.fire({
				icon: 'info',
				title: 'Disimpan Sementara',
				text: 'Tidak ada koneksi internet. Data penilaian disimpan lokal dan akan dikirim otomatis saat online.',
				timer: 3000,
				showConfirmButton: false,
			});
			setSaving(false);
			return;
		}

		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const userId = userData?.id_user;
			const role = userData?.role;

			// Validate
			if (role === 'Guru' && userId) {
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', selectedKelas).eq('mapel', selectedMapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Anda tidak mengajar mapel ini di kelas tersebut.');
			}

			// Generate ID
			const tugasId = `TGS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

			const { error: insertHeaderError } = await supabase.from('nilai_tugas').insert({
				tugas_id: tugasId,
				guru_id: userId,
				kategori: judul,
				type,
				deskripsi,
				kelas: selectedKelas,
				mapel: selectedMapel,
				tanggal
			});
			if (insertHeaderError) throw insertHeaderError;

			// Insert scores
			const validGrades = payload.nilai.map(n => {
				const siswa = getSiswaById(n.siswa_id);
				return {
					tugas_id: tugasId,
					siswa_id: n.siswa_id,
					nama_siswa: siswa?.nama_lengkap || 'Unknown',
					nilai: n.nilai
				};
			});

			if (validGrades.length > 0) {
				const { error: insertScoreError } = await supabase.from('nilai_siswa').insert(validGrades);
				if (insertScoreError) {
					await supabase.from('nilai_tugas').delete().eq('tugas_id', tugasId);
					throw insertScoreError;
				}
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: 'Tugas baru berhasil dibuat',
				timer: 1500,
				showConfirmButton: false,
			});

			// Trigger refetch daftar tugas via dependency effect
			// Tapi kita force select tugas baru agar masuk mode edit
			setSelectedTugasId(tugasId);
		} catch (error) {
			console.error(error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setSaving(false);
		}
	};

	// Edit Nilai Per Siswa (Popup) - Mode Tugas Lama
	const handleEditNilai = async (siswaId, currentNilai) => {
		const siswa = getSiswaById(siswaId);
		if (!siswa) return;

		const { value: newNilai } = await Swal.fire({
			title: `<h3 class="text-2xl font-black text-[#0D0D0D] uppercase tracking-tight">Edit Nilai</h3>`,
			html: `
        <div class="text-left bg-[#FFF5F0] p-4 mb-6 border-4 border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]">
          <p class="text-xs font-bold text-[#0D0D0D] mb-1 uppercase tracking-wider">Siswa</p>
          <p class="font-black text-[#0D0D0D] text-lg leading-tight mb-2">${siswa.nama_lengkap}</p>
          <p class="text-[10px] font-bold font-mono text-[#0D0D0D] bg-white border-2 border-[#0D0D0D] inline-block px-2 py-0.5 shadow-[2px_2px_0px_0px_#0D0D0D]">NIS: ${siswa.nis || '-'}</p>
        </div>
        <div class="mb-2 text-left">
          <label class="block text-sm font-black text-[#0D0D0D] mb-2 uppercase tracking-widest">Input Nilai</label>
          <input 
            id="swal-input-nilai" 
            type="number" 
            class="w-full px-4 py-3 border-4 border-[#0D0D0D] bg-white text-3xl text-center font-black text-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] outline-none focus:bg-[#F5C518] transition-colors"
            min="0" 
            max="100" 
            value="${currentNilai || 0}"
            placeholder="0"
          >
        </div>
      `,
			showCancelButton: true,
			confirmButtonText: 'SIMPAN',
			cancelButtonText: 'BATAL',
			buttonsStyling: false,
			customClass: {
				popup: 'border-4 border-[#0D0D0D] rounded-none shadow-[8px_8px_0px_0px_#0D0D0D] bg-white',
				title: 'pt-4',
				confirmButton: 'bg-[#00A693] text-white font-black px-6 py-3 mx-2 border-4 border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-x-0 active:translate-y-0 active:shadow-[0px_0px_0px_0px_#0D0D0D] transition-all uppercase',
				cancelButton: 'bg-[#E8451A] text-white font-black px-6 py-3 mx-2 border-4 border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-x-0 active:translate-y-0 active:shadow-[0px_0px_0px_0px_#0D0D0D] transition-all uppercase',
			},
			focusConfirm: false,
			preConfirm: () => {
				const val = document.getElementById('swal-input-nilai').value;
				if (!val || val < 0 || val > 100) {
					Swal.showValidationMessage('Masukkan nilai valid (0-100)');
				}
				return val;
			},
		});

		if (newNilai) {
			try {
				const supabase = createClient();
				
				// Validate
				const { data: { user } } = await supabase.auth.getUser();
				const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
				const role = userData?.role;
				const userId = userData?.id_user;

				const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id, kelas, mapel').eq('tugas_id', selectedTugasId).single();
				if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

				if (role === 'Guru' && userId) {
					if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
						throw new Error('Akses Ditolak: Anda mencoba menyunting Tugas buatan kolega.');
					}
					const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', existingTugas.kelas).eq('mapel', existingTugas.mapel).single();
					if (!isAllowed) throw new Error('Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.');
				}

				// Check existing
				const { data: existingNilai } = await supabase.from('nilai_siswa').select('id').eq('tugas_id', selectedTugasId).eq('siswa_id', siswaId).single();
				if (existingNilai) {
					await supabase.from('nilai_siswa').update({ nilai: newNilai }).eq('tugas_id', selectedTugasId).eq('siswa_id', siswaId);
				} else {
					await supabase.from('nilai_siswa').insert({
						tugas_id: selectedTugasId,
						siswa_id: siswaId,
						nama_siswa: siswa.nama_lengkap,
						nilai: newNilai
					});
				}

				Swal.fire({
					icon: 'success',
					title: 'Tersimpan',
					text: `Nilai ${siswa.nama_lengkap} diupdate menjadi ${newNilai}`,
					timer: 1000,
					showConfirmButton: false,
				});
				// Refresh data lokal
				refreshCurrentTugasData(selectedTugasId);
			} catch (err) {
				console.error(err);
				Swal.fire('Error', 'Gagal mengupdate nilai', 'error');
			}
		}
	};

	// Hapus Tugas
	const handleHapusTugas = async () => {
		if (!selectedTugasId) return;

		const result = await Swal.fire({
			title: 'Hapus Tugas?',
			html: `
				<div class="text-left">
					<p class="text-gray-700 mb-2">Anda akan menghapus tugas:</p>
					<div class="bg-red-50 p-3 rounded-lg border border-red-200">
						<p class="font-bold text-red-700">${judul}</p>
						<p class="text-sm text-red-600 mt-1">${selectedKelas} - ${selectedMapel}</p>
					</div>
					<p class="text-sm text-gray-500 mt-3">⚠️ Semua nilai siswa untuk tugas ini akan dihapus permanen!</p>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus!',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);
		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const role = userData?.role;
			const userId = userData?.id_user;

			const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id, kelas, mapel').eq('tugas_id', selectedTugasId).single();
			if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

			if (role === 'Guru' && userId) {
				if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
					throw new Error('Akses Ditolak: Dilarang menghapus riwayat penilaian kepunyaan rekan Guru Anda.');
				}
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', existingTugas.kelas).eq('mapel', existingTugas.mapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Anda tidak berhak menghapus tugas dari kelas eksternal.');
			}

			const { error: deleteError } = await supabase.from('nilai_tugas').delete().eq('tugas_id', selectedTugasId);
			if (deleteError) throw deleteError;

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil Dihapus!',
				text: `Data nilai berhasil dihapus`,
				timer: 1500,
				showConfirmButton: false,
			});

			// Reset ke mode "Tugas Baru"
			setSelectedTugasId('');
			setJudul('');
			setType('Formatif');
			setDeskripsi('');
			setNilai({});
			setInitialSiswaIds([]);
			setTanggal(new Date().toISOString().slice(0, 10));

			// Refresh daftar tugas
			let query = supabase.from('nilai_tugas').select('tugas_id, kategori, tanggal, kelas, mapel, guru_id').eq('kelas', selectedKelas).eq('mapel', selectedMapel);
			if (role === 'Guru' && userId) {
				query = query.eq('guru_id', userId);
			}

			const { data: tugasData } = await query;
			if (tugasData) {
				const tugasIds = tugasData.map(t => t.tugas_id);
				let counts = {};
				if (tugasIds.length > 0) {
					const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id, nilai').in('tugas_id', tugasIds);
					if (siswaData) {
						siswaData.forEach(s => {
							if (s.nilai && parseInt(s.nilai) > 0) {
								counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
							}
						});
					}
				}

				const mappedTugas = tugasData.map(t => ({
					tugas_id: t.tugas_id,
					judul: t.kategori,
					tanggal: t.tanggal,
					kelas: t.kelas,
					mapel: t.mapel,
					jumlahSiswaMengumpulkan: counts[t.tugas_id] || 0,
					totalSiswa: siswaList.filter(s => s.kelas === t.kelas).length
				}));

				setDaftarTugas(mappedTugas.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
			}
		} catch (error) {
			console.error(error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menghapus',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setSaving(false);
		}
	};

	// Update Judul / Tanggal (Mode Edit)
	const handleUpdateInfoTugas = async () => {
		if (!selectedTugasId) return;
		if (!judul.trim()) {
			require('sweetalert2').fire('Error', 'Judul tidak boleh kosong', 'error');
			return;
		}

		setSaving(true);
		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const role = userData?.role;
			const userId = userData?.id_user;

			const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id, kelas, mapel').eq('tugas_id', selectedTugasId).single();
			if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

			if (role === 'Guru' && userId) {
				if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
					throw new Error('Akses Ditolak: Anda mencoba menyunting Tugas buatan kolega.');
				}
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', existingTugas.kelas).eq('mapel', existingTugas.mapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.');
			}

			const updates = { kategori: judul, tanggal: tanggal, deskripsi, type };
			const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', selectedTugasId);
			if (updateError) throw updateError;

			const Toast = Swal.mixin({
				toast: true,
				position: 'top-end',
				showConfirmButton: false,
				timer: 3000,
				timerProgressBar: true,
			});
			Toast.fire({
				icon: 'success',
				title: 'Informasi tugas diperbarui',
			});

			// Refresh sidebar
			let query = supabase.from('nilai_tugas').select('tugas_id, kategori, tanggal, kelas, mapel, guru_id').eq('kelas', selectedKelas).eq('mapel', selectedMapel);
			if (role === 'Guru' && userId) {
				query = query.eq('guru_id', userId);
			}

			const { data: tugasData } = await query;
			if (tugasData) {
				const tugasIds = tugasData.map(t => t.tugas_id);
				let counts = {};
				if (tugasIds.length > 0) {
					const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id, nilai').in('tugas_id', tugasIds);
					if (siswaData) {
						siswaData.forEach(s => {
							if (s.nilai && parseInt(s.nilai) > 0) {
								counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
							}
						});
					}
				}

				const mappedTugas = tugasData.map(t => ({
					tugas_id: t.tugas_id,
					judul: t.kategori,
					tanggal: t.tanggal,
					kelas: t.kelas,
					mapel: t.mapel,
					jumlahSiswaMengumpulkan: counts[t.tugas_id] || 0,
					totalSiswa: siswaList.filter(s => s.kelas === t.kelas).length
				}));

				setDaftarTugas(mappedTugas.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
			}
		} catch (err) {
			console.error(err);
			require('sweetalert2').fire('Error', 'Terjadi kesalahan saat menyimpan', 'error');
		} finally {
			setSaving(false);
		}
	};

	// --- Filter manual Data Siswa ---
	const filteredSiswa = siswaKelasIni.filter((s) => (s.nama_lengkap?.toLowerCase() || '').includes(searchSiswa.toLowerCase()) || (s.nis?.toLowerCase() || '').includes(searchSiswa.toLowerCase()));

	// --- 5. Render UI ---

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[var(--background)] pb-32'>
			{/* Header Gradient */}
			<div className='bg-[#F5C518] border-b-4 border-[#0D0D0D] pb-12 pt-8 px-4 sm:px-8 shadow-[0px_4px_0px_0px_rgba(0,0,0,0.05)]'>
				<div className='max-w-6xl mx-auto'>
					<div className='flex items-center gap-4 mb-6'>
						<button
							onClick={() => router.back()}
							className='neo-btn-outline bg-white flex items-center justify-center p-2 rounded-xl text-[#0D0D0D]'>
							<svg
								className='w-6 h-6'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								strokeWidth={3}>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M15 19l-7-7 7-7'
								/>
							</svg>
						</button>
						<h1 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-tight'>Input Penilaian</h1>
					</div>

					{/* Filter Section */}
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div className='neo-card bg-white p-4'>
							<label className='font-bold text-[#0D0D0D] text-sm mb-2 block uppercase tracking-tight'>Kelas</label>
							<div className='relative'>
								<select
									value={selectedKelas}
									onChange={(e) => setSelectedKelas(e.target.value)}
									className='neo-input appearance-none bg-white pr-10 cursor-pointer w-full'>
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
						</div>
						<div className='neo-card bg-white p-4'>
							<label className='font-bold text-[#0D0D0D] text-sm mb-2 block uppercase tracking-tight'>Mata Pelajaran</label>
							<div className='relative'>
								<select
									value={selectedMapel}
									onChange={(e) => setSelectedMapel(e.target.value)}
									className='neo-input appearance-none bg-white pr-10 cursor-pointer w-full'>
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
						</div>
					</div>
				</div>
			</div>

			<div className='max-w-6xl mx-auto px-4 sm:px-8 -mt-6 relative z-10'>
				<div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
					{/* SIDEBAR: Daftar Tugas */}
					<div className='lg:col-span-1 space-y-4'>
						<div className='neo-card bg-white p-4 h-fit'>
							<div className='flex items-center justify-between mb-4 border-b-2 border-[#0D0D0D] pb-2'>
								<h2 className='font-black text-[#0D0D0D] uppercase tracking-tight text-lg'>Daftar Tugas</h2>
							</div>

							<div className='space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar'>
								{/* Item "Tugas Baru" */}
								<div
									onClick={() => setSelectedTugasId('')}
									className={`p-3 rounded-xl cursor-pointer transition-all border-2 border-[#0D0D0D] ${
										!selectedTugasId ? 'bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D] translate-y-0' : 'bg-white text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[4px_4px_0px_0px_#0D0D0D]'
									}`}>
									<p className='font-bold text-sm'>📝 Tugas Baru</p>
									<p className={`text-xs mt-1 font-bold ${!selectedTugasId ? 'text-white' : 'text-gray-500'}`}>Buat penilaian baru</p>
								</div>

								{/* List Tugas Existing */}
								{loadingTugas ? (
									<p className='text-center text-xs text-[#0D0D0D] font-bold py-4 border-2 border-[#0D0D0D] rounded-xl bg-white'>Memuat...</p>
								) : daftarTugas.length === 0 ? (
									<p className='text-center text-xs text-[#0D0D0D] font-bold py-4 border-2 border-[#0D0D0D] rounded-xl bg-white'>Belum ada riwayat tugas</p>
								) : (
									daftarTugas.map((t) => (
										<div
											key={t.tugas_id}
											onClick={() => setSelectedTugasId(t.tugas_id)}
											className={`p-3 rounded-xl cursor-pointer transition-all border-2 border-[#0D0D0D] group ${
												selectedTugasId === t.tugas_id ? 'bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]' : 'bg-white text-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[4px_4px_0px_0px_#0D0D0D]'
											}`}>
											<div className='flex justify-between items-start mb-1'>
												<p className='font-bold text-sm line-clamp-1'>{t.judul}</p>
												<span className='text-[10px] bg-white border-2 border-[#0D0D0D] px-1.5 py-0.5 rounded font-mono font-bold shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{new Date(t.tanggal).toLocaleDateString('id-ID', {
														day: '2-digit',
														month: 'short',
													})}
												</span>
											</div>
											<div className='flex justify-between items-center mt-2'>
												<span className='text-xs font-bold text-[#0D0D0D] bg-white border-2 border-[#0D0D0D] px-2 py-0.5 rounded-md shadow-[1px_1px_0px_0px_#0D0D0D]'>
													{t.jumlahSiswaMengumpulkan}/{t.totalSiswa} Siswa
												</span>
												{selectedTugasId === t.tugas_id && <span className='w-3 h-3 rounded-full border-2 border-[#0D0D0D] bg-[#E8451A] animate-pulse shadow-[1px_1px_0px_0px_#0D0D0D]'></span>}
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</div>

					{/* MAIN CONTENT: Form Input / Table */}
					<div className='lg:col-span-3 space-y-6'>
						{/* Info Tugas Card */}
						<div className='neo-card bg-white p-6'>
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
								<div className='lg:col-span-2'>
									<label className='block text-sm font-bold text-[#0D0D0D] mb-1 uppercase tracking-tight'>Judul Tugas / Materi</label>
									<input
										type='text'
										value={judul}
										onChange={(e) => setJudul(e.target.value)}
										className={`neo-input w-full ${selectedTugasId ? 'bg-[#FFF5F0]' : 'bg-white'}`}
										placeholder='Contoh: UH Matematika Bab 1'
									/>
								</div>
								<div>
									<label className='block text-sm font-bold text-[#0D0D0D] mb-1 uppercase tracking-tight'>Tipe</label>
									<div className='relative'>
										<select
											value={type}
											onChange={(e) => setType(e.target.value)}
											className={`neo-input w-full appearance-none pr-10 cursor-pointer ${selectedTugasId ? 'bg-[#FFF5F0]' : 'bg-white'}`}>
											<option value='Formatif'>Formatif</option>
											<option value='Sumatif'>Sumatif</option>
											<option value='SAS'>SAS</option>
										</select>
										<div className='absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-[#0D0D0D]'>▼</div>
									</div>
								</div>
								<div>
									<label className='block text-sm font-bold text-[#0D0D0D] mb-1 uppercase tracking-tight'>Tanggal</label>
									<input
										type='date'
										value={tanggal}
										onChange={(e) => setTanggal(e.target.value)}
										className={`neo-input w-full ${selectedTugasId ? 'bg-[#FFF5F0]' : 'bg-white'}`}
									/>
								</div>
							</div>

							<div className='mb-4'>
								<label className='block text-sm font-bold text-[#0D0D0D] mb-1 uppercase tracking-tight'>Deskripsi (Opsional)</label>
								<textarea
									value={deskripsi}
									onChange={(e) => setDeskripsi(e.target.value)}
									rows={2}
									className={`neo-input w-full resize-none ${selectedTugasId ? 'bg-[#FFF5F0]' : 'bg-white'}`}
									placeholder='Catatan tambahan tentang tugas ini'
								/>
							</div>

							{selectedTugasId && (
								<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2'>
									<div className='bg-[#2F80ED] text-white font-bold px-4 py-3 rounded-xl border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] text-sm flex items-center gap-2 flex-auto'>
										<svg
											className='w-6 h-6 flex-shrink-0'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
											strokeWidth={3}>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
											/>
										</svg>
										<span>
											Sedang mengedit. Klik <b>Simpan</b> untuk menyimpan Judul/Tanggal, atau klik <b>Baris Siswa</b> untuk edit nilai.
										</span>
									</div>
									<button
										onClick={handleUpdateInfoTugas}
										disabled={saving}
										className='flex-shrink-0 w-full sm:w-auto neo-btn-primary bg-[#0D0D0D] text-white px-6 py-3 uppercase tracking-wider flex items-center justify-center gap-2'>
										{saving ? 'Menyimpan...' : 'Simpan Perubahan'}
									</button>
								</div>
							)}
							{selectedTugasId && (
								<button
									onClick={handleHapusTugas}
									disabled={saving}
									className='w-full neo-btn-outline bg-[#E8451A] text-white hover:bg-white hover:text-[#E8451A] uppercase tracking-wider flex items-center justify-center gap-2 mt-4'>
									<svg
										className='w-5 h-5'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
										strokeWidth={3}>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
										/>
									</svg>
									Hapus Tugas Ini
								</button>
							)}
						</div>

						{/* Tabel Siswa */}
						<div className='neo-card p-0 overflow-hidden bg-white'>
							<div className='p-4 bg-[#F5C518] border-b-4 border-[#0D0D0D]'>
								<div className='relative'>
									<div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
										<svg
											className='h-5 w-5 text-[#0D0D0D]'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
											strokeWidth={3}>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
											/>
										</svg>
									</div>
									<input
										type='text'
										placeholder='Cari Nama atau NIS Siswa...'
										value={searchSiswa}
										onChange={(e) => setSearchSiswa(e.target.value)}
										className='neo-input neo-input-with-icon bg-white w-full'
									/>
								</div>
							</div>
							<div className='grid grid-cols-12 gap-4 p-4 bg-[#0D0D0D] text-white border-b-4 border-[#0D0D0D] text-sm font-bold uppercase tracking-wider'>
								<div className='col-span-1 text-center'>No</div>
								<div className='col-span-5 sm:col-span-6'>Nama Siswa</div>
								<div className='col-span-4 sm:col-span-3 text-center'>Nilai</div>
								<div className='col-span-2 text-center'>
									<span className='block md:hidden'>Ket.</span>
									<span className='hidden md:block'>Predikat</span>
								</div>
							</div>

							<div className='divide-y-2 divide-[#0D0D0D] max-h-[600px] overflow-y-auto bg-white'>
								{filteredSiswa.length === 0 ? (
									<div className='p-8 text-center text-[#0D0D0D] font-bold'>Tidak ada siswa di kelas ini</div>
								) : (
									filteredSiswa.map((siswa, idx) => {
										const nilaiSiswa = nilai[siswa.id] || '';
										const isEditMode = !!selectedTugasId;
										const isNewStudentInTask = isEditMode && !initialSiswaIds.includes(siswa.id);

										return (
											<div
												key={siswa.id}
												onClick={() => {
													if (isEditMode) handleEditNilai(siswa.id, nilaiSiswa);
												}}
												className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${isEditMode ? 'cursor-pointer hover:bg-[#F5C518] group' : 'hover:bg-[#FFF5F0]'}`}>
												<div className='col-span-1 text-center text-[#0D0D0D] font-black'>{idx + 1}</div>
												<div className='col-span-5 sm:col-span-6'>
													<div className='flex items-center gap-2'>
														<p className='font-bold text-[#0D0D0D] text-base group-hover:underline transition-colors'>{siswa.nama_lengkap}</p>
														{isNewStudentInTask && <span className='px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00A693] text-white border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>BARU</span>}
													</div>
													<p className='text-sm text-gray-600 font-mono font-bold mt-1'>{siswa.nis || '-'}</p>
												</div>
												<div className='col-span-4 sm:col-span-3 flex justify-center'>
													{isEditMode ? (
														// --- VIEW MODE (Badge) ---
														<div
															className={`w-16 h-10 flex items-center justify-center rounded-xl font-black border-2 border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] transform transition-transform group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0px_0px_#0D0D0D] ${getNilaiColor(
																nilaiSiswa,
															)}`}>
															{Number(nilaiSiswa) > 0 ? nilaiSiswa : <span className="text-[10px] tracking-widest text-[#E8451A]">KOSONG</span>}
														</div>
													) : (
														// --- INPUT MODE (Form) ---
														<input
															type='number'
															min='0'
															max='100'
															value={nilaiSiswa}
															onChange={(e) => handleNilaiChange(siswa.id, e.target.value)}
															onWheel={(e) => e.target.blur()}
															className='neo-input text-center text-lg font-black w-full px-2 py-2'
															placeholder='0'
														/>
													)}
												</div>
												<div className='col-span-2 text-center'>
													<span className={`inline-block w-8 h-8 leading-7 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] rounded-full font-black text-sm ${nilaiSiswa ? 'bg-[#2F80ED] text-white' : 'bg-white text-[#0D0D0D]'}`}>{getPredikat(nilaiSiswa)}</span>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>

						{/* Floating Action Button / Save Button */}
						{!selectedTugasId && (
							<div className='fixed bottom-0 left-0 right-0 p-4 bg-[#FFF5F0] border-t-4 border-[#0D0D0D] z-30 flex justify-end shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]'>
								<button
									onClick={handleSimpanMassal}
									disabled={saving}
									className='w-full md:w-auto neo-btn-primary bg-[#0D0D0D] text-white py-3 px-10 text-lg uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'>
									{saving ? (
										<>
											<svg
												className='animate-spin h-6 w-6 text-white'
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'>
												<circle
													className='opacity-25'
													cx='12'
													cy='12'
													r='10'
													stroke='currentColor'
													strokeWidth='4'></circle>
												<path
													className='opacity-75'
													fill='currentColor'
													d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
											</svg>
											Menyimpan...
										</>
									) : (
										<>
											<svg
												className='w-6 h-6'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'
												strokeWidth={3}>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4'
												/>
											</svg>
											Simpan Semua Nilai
										</>
									)}
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
