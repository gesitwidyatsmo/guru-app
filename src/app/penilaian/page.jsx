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
						const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id').in('tugas_id', tugasIds);
						if (siswaData) {
							siswaData.forEach(s => {
								counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
							});
						}
					}

					const mappedTugas = tugasData.map(t => ({
						tugas_id: t.tugas_id,
						judul: t.kategori,
						tanggal: t.tanggal,
						kelas: t.kelas,
						mapel: t.mapel,
						jumlahSiswa: counts[t.tugas_id] || 0
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
		if (!nilaiValue || nilaiValue === '') return 'from-gray-400 to-gray-500';
		const n = parseFloat(nilaiValue);
		if (n >= 90) return 'from-green-500 to-green-600';
		if (n >= 80) return 'from-blue-500 to-blue-600';
		if (n >= 70) return 'from-yellow-500 to-yellow-600';
		if (n >= 60) return 'from-orange-500 to-orange-600';
		return 'from-red-500 to-red-600';
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
			const validGrades = payload.nilai.filter(n => n.nilai && String(n.nilai).trim() !== '' && String(n.nilai) !== '0').map(n => {
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
			title: `<h3 class="text-xl font-bold text-gray-800">Edit Nilai</h3>`,
			html: `
        <div class="text-left bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Nama Siswa</p>
          <p class="font-bold text-gray-800 text-lg">${siswa.nama_lengkap}</p>
          <p class="text-xs text-gray-400">NIS: ${siswa.nis || '-'}</p>
        </div>
        <div class="mb-2">
          <label class="block text-sm font-medium text-gray-700 mb-2">Nilai (0-100)</label>
          <input 
            id="swal-input-nilai" 
            type="number" 
            class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg text-center font-bold text-indigo-600 transition-all outline-none"
            min="0" 
            max="100" 
            value="${currentNilai || 0}"
            placeholder="0"
          >
        </div>
      `,
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#EF4444',
			confirmButtonText: 'Simpan Perubahan',
			cancelButtonText: 'Batal',
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
					const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id').in('tugas_id', tugasIds);
					if (siswaData) {
						siswaData.forEach(s => {
							counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
						});
					}
				}

				const mappedTugas = tugasData.map(t => ({
					tugas_id: t.tugas_id,
					judul: t.kategori,
					tanggal: t.tanggal,
					kelas: t.kelas,
					mapel: t.mapel,
					jumlahSiswa: counts[t.tugas_id] || 0
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
					const { data: siswaData } = await supabase.from('nilai_siswa').select('tugas_id, siswa_id').in('tugas_id', tugasIds);
					if (siswaData) {
						siswaData.forEach(s => {
							counts[s.tugas_id] = (counts[s.tugas_id] || 0) + 1;
						});
					}
				}

				const mappedTugas = tugasData.map(t => ({
					tugas_id: t.tugas_id,
					judul: t.kategori,
					tanggal: t.tanggal,
					kelas: t.kelas,
					mapel: t.mapel,
					jumlahSiswa: counts[t.tugas_id] || 0
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
		return (
			<div className='min-h-screen flex items-center justify-center bg-gray-50'>
				<Loader />
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gray-50 pb-20'>
			{/* Header Gradient */}
			<div className='bg-gradient-to-r from-blue-600 to-indigo-700 pb-20 pt-8 px-4 sm:px-8 rounded-b-[3rem] shadow-2xl'>
				<div className='max-w-6xl mx-auto'>
					<div className='flex items-center gap-4 mb-6'>
						<button
							onClick={() => router.back()}
							className='p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-all'>
							<svg
								className='w-6 h-6'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 19l-7-7 7-7'
								/>
							</svg>
						</button>
						<h1 className='text-3xl font-bold text-white'>Input Penilaian</h1>
					</div>

					{/* Filter Section */}
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div className='bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20'>
							<label className='text-blue-100 text-sm mb-2 block'>Kelas</label>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full bg-white/90 border-0 rounded-xl px-4 py-3 text-gray-800 font-semibold focus:ring-2 focus:ring-blue-400'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
						</div>
						<div className='bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20'>
							<label className='text-blue-100 text-sm mb-2 block'>Mata Pelajaran</label>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full bg-white/90 border-0 rounded-xl px-4 py-3 text-gray-800 font-semibold focus:ring-2 focus:ring-blue-400'>
								{mapelList.map((m) => (
									<option
										key={m.id}
										value={m.mapel || m.nama_mapel}>
										{m.mapel || m.nama_mapel}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>
			</div>

			<div className='max-w-6xl mx-auto px-4 sm:px-8 -mt-10'>
				<div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
					{/* SIDEBAR: Daftar Tugas */}
					<div className='lg:col-span-1 space-y-4'>
						<div className='bg-white rounded-2xl shadow-xl p-4 border border-gray-100 h-fit'>
							<div className='flex items-center justify-between mb-4'>
								<h2 className='font-bold text-gray-700'>Daftar Tugas</h2>
								{/* <button
									onClick={() => setSelectedTugasId('')}
									className='text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-colors font-semibold'>
									+ Baru
								</button> */}
							</div>

							<div className='space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar'>
								{/* Item "Tugas Baru" */}
								<div
									onClick={() => setSelectedTugasId('')}
									className={`p-3 rounded-xl cursor-pointer transition-all border ${
										!selectedTugasId ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'
									}`}>
									<p className={`font-bold text-sm ${!selectedTugasId ? 'text-indigo-700' : 'text-gray-700'}`}>📝 Tugas Baru</p>
									<p className='text-xs text-gray-500 mt-1'>Buat penilaian baru</p>
								</div>

								{/* List Tugas Existing */}
								{loadingTugas ? (
									<p className='text-center text-xs text-gray-400 py-4'>Memuat...</p>
								) : daftarTugas.length === 0 ? (
									<p className='text-center text-xs text-gray-400 py-4'>Belum ada riwayat tugas</p>
								) : (
									daftarTugas.map((t) => (
										<div
											key={t.tugas_id}
											onClick={() => setSelectedTugasId(t.tugas_id)}
											className={`p-3 rounded-xl cursor-pointer transition-all border group ${
												selectedTugasId === t.tugas_id ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-300 hover:shadow-sm'
											}`}>
											<div className='flex justify-between items-start mb-1'>
												<p className={`font-bold text-sm line-clamp-1 ${selectedTugasId === t.tugas_id ? 'text-indigo-700' : 'text-gray-700'}`}>{t.judul}</p>
												<span className='text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono'>
													{new Date(t.tanggal).toLocaleDateString('id-ID', {
														day: '2-digit',
														month: 'short',
													})}
												</span>
											</div>
											<div className='flex justify-between items-center mt-2'>
												<span className='text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md'>{t.jumlahSiswa} Siswa</span>
												{selectedTugasId === t.tugas_id && <span className='w-2 h-2 rounded-full bg-indigo-500 animate-pulse'></span>}
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
						<div className='bg-white rounded-2xl shadow-xl p-6 border border-gray-100'>
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
								<div className='lg:col-span-2'>
									<label className='block text-sm font-medium text-gray-500 mb-1'>Judul Tugas / Materi</label>
									<input
										type='text'
										value={judul}
										onChange={(e) => setJudul(e.target.value)}
										className={`w-full px-4 py-2 rounded-xl border ${
											selectedTugasId ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-300' : 'bg-white border-gray-300'
										} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none`}
										placeholder='Contoh: UH Matematika Bab 1'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-500 mb-1'>Tipe</label>
									<select
										value={type}
										onChange={(e) => setType(e.target.value)}
										className={`w-full px-4 py-2 rounded-xl border ${
											selectedTugasId ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-300' : 'bg-white border-gray-300'
										} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none`}>
										<option value='Formatif'>Formatif</option>
										<option value='Sumatif'>Sumatif</option>
										<option value='SAS'>SAS</option>
									</select>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-500 mb-1'>Tanggal</label>
									<input
										type='date'
										value={tanggal}
										onChange={(e) => setTanggal(e.target.value)}
										className={`w-full px-4 py-2 rounded-xl border ${
											selectedTugasId ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-300' : 'bg-white border-gray-300'
										} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none`}
									/>
								</div>
							</div>

							<div className='mb-4'>
								<label className='block text-sm font-medium text-gray-500 mb-1'>Deskripsi (Opsional)</label>
								<textarea
									value={deskripsi}
									onChange={(e) => setDeskripsi(e.target.value)}
									rows={2}
									className={`w-full px-4 py-2 rounded-xl border ${
										selectedTugasId ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-300' : 'bg-white border-gray-300'
									} focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none`}
									placeholder='Catatan tambahan tentang tugas ini'
								/>
							</div>

							{selectedTugasId && (
								<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2'>
									<div className='bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 flex-auto'>
										<svg
											className='w-5 h-5 flex-shrink-0'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
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
										className='flex-shrink-0 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm'>
										{saving ? 'Menyimpan...' : 'Simpan Perubahan'}
									</button>
								</div>
							)}
							{selectedTugasId && (
								<button
									onClick={handleHapusTugas}
									disabled={saving}
									className='w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-3'>
									<svg
										className='w-5 h-5'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
										/>
									</svg>
									Hapus Tugas Ini
								</button>
							)}
						</div>

						{/* Tabel Siswa */}
						<div className='bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden'>
							<div className='p-4 bg-white border-b border-gray-100'>
								<div className='relative'>
									<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
										<svg
											className='h-5 w-5 text-gray-400'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
											/>
										</svg>
									</div>
									<input
										type='text'
										placeholder='Cari Nama atau NIS Siswa...'
										value={searchSiswa}
										onChange={(e) => setSearchSiswa(e.target.value)}
										className='block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out'
									/>
								</div>
							</div>
							<div className='grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-500 uppercase tracking-wider'>
								<div className='col-span-1 text-center'>No</div>
								<div className='col-span-6 sm:col-span-6'>Nama Siswa</div>
								<div className='col-span-3 sm:col-span-3 text-center'>Nilai</div>
								<div className='col-span-2 text-center'>
									<span className='block md:hidden'>Ket.</span>
									<span className='hidden md:block'>Predikat</span>
								</div>
							</div>

							<div className='divide-y divide-gray-100 max-h-[600px] overflow-y-auto'>
								{filteredSiswa.length === 0 ? (
									<div className='p-8 text-center text-gray-400'>Tidak ada siswa di kelas ini</div>
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
												className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${isEditMode ? 'cursor-pointer hover:bg-indigo-50 group' : 'hover:bg-gray-50'}`}>
												<div className='col-span-1 text-center text-gray-500 font-medium'>{idx + 1}</div>
												<div className='col-span-6 sm:col-span-6'>
													<div className='flex items-center gap-2'>
														<p className='font-bold text-gray-800 group-hover:text-indigo-700 transition-colors'>{siswa.nama_lengkap}</p>
														{isNewStudentInTask && <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200'>BARU</span>}
													</div>
													<p className='text-xs text-gray-400'>{siswa.nis || '-'}</p>
												</div>
												<div className='col-span-3 sm:col-span-3 flex justify-center'>
													{isEditMode ? (
														// --- VIEW MODE (Badge) ---
														<div
															className={`w-16 h-10 flex items-center justify-center rounded-lg font-bold text-white shadow-sm transform transition-transform group-hover:scale-110 bg-gradient-to-br ${getNilaiColor(
																nilaiSiswa,
															)}`}>
															{nilaiSiswa || '0'}
														</div>
													) : (
														// --- INPUT MODE (Form) ---
														<input
															type='number'
															min='0'
															max='100'
															value={nilaiSiswa}
															onChange={(e) => handleNilaiChange(siswa.id, e.target.value)}
															className='w-full text-center font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all'
															placeholder='0'
														/>
													)}
												</div>
												<div className='col-span-2 text-center'>
													<span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold text-sm ${nilaiSiswa ? 'bg-gray-100 text-gray-700' : 'text-gray-300'}`}>{getPredikat(nilaiSiswa)}</span>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>

						{/* Floating Action Button / Save Button */}
						{!selectedTugasId && (
							<div className='mt-6 flex justify-end sticky bottom-6'>
								<button
									onClick={handleSimpanMassal}
									disabled={saving}
									className='bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 backdrop-blur-md bg-opacity-90'>
									{saving ? (
										<>
											<svg
												className='animate-spin h-5 w-5 text-white'
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
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
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
