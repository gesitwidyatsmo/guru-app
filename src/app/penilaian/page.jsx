'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function PenilaianPage() {
	const router = useRouter();
	const [kelasList, setKelasList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [selectedMapel, setSelectedMapel] = useState('');
	const [judul, setJudul] = useState(''); // Judul tugas/penilaian
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [nilai, setNilai] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// State untuk daftar tugas yang sudah ada
	const [daftarTugas, setDaftarTugas] = useState([]);
	const [selectedTugasId, setSelectedTugasId] = useState('');
	const [loadingTugas, setLoadingTugas] = useState(false);

	const [initialSiswaIds, setInitialSiswaIds] = useState([]);

	// Fetch initial data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resMapel, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/mapel'), fetch('/api/siswa')]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataMapel = resMapel.ok ? await resMapel.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				setKelasList(dataKelas);
				setMapelList(dataMapel);
				setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

				if (dataKelas.length > 0) {
					setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
				}
				if (dataMapel.length > 0) {
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

	// Fetch daftar tugas ketika kelas atau mapel berubah
	useEffect(() => {
		if (!selectedKelas || !selectedMapel) return;

		// Reset ke mode "Tugas Baru" setiap kali mapel/kelas berubah
		setSelectedTugasId('');
		setJudul('');
		setNilai({});
		setInitialSiswaIds([]);
		setTanggal(new Date().toISOString().slice(0, 10));

		const fetchTugas = async () => {
			try {
				setLoadingTugas(true);
				const url = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const res = await fetch(url);

				if (res.ok) {
					const data = await res.json();
					const tugasMap = new Map();
					data.forEach((item) => {
						if (!tugasMap.has(item.tugas_id)) {
							tugasMap.set(item.tugas_id, {
								tugas_id: item.tugas_id,
								judul: item.kategori,
								tanggal: item.tanggal,
								kelas: item.kelas,
								mapel: item.mapel,
								jumlahSiswa: 1,
							});
						} else {
							tugasMap.get(item.tugas_id).jumlahSiswa++;
						}
					});
					setDaftarTugas(Array.from(tugasMap.values()).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
				}
			} catch (err) {
				console.error('Error fetching tugas:', err);
			} finally {
				setLoadingTugas(false);
			}
		};

		fetchTugas();
	}, [selectedKelas, selectedMapel]);

	// Load nilai ketika memilih tugas yang sudah ada
	// Load nilai ketika memilih tugas yang sudah ada
	useEffect(() => {
		if (!selectedTugasId) {
			setJudul('');
			setNilai({});
			setInitialSiswaIds([]);
			return;
		}

		const loadNilaiTugas = async () => {
			try {
				const url = `/api/tugas?tugasId=${selectedTugasId}`;
				const res = await fetch(url);

				if (res.ok) {
					const data = await res.json();

					if (data.length > 0) {
						setJudul(data[0].kategori);
						setTanggal(data[0].tanggal);

						// Track siswa IDs yang sudah ada
						const existingIds = data.map((item) => item.siswa_id);
						setInitialSiswaIds(existingIds);

						// Map nilai ke state
						const nilaiMap = {};
						data.forEach((item) => {
							nilaiMap[item.siswa_id] = item.nilai;
						});
						setNilai(nilaiMap);
					}
				}
			} catch (err) {
				console.error('Error loading nilai tugas:', err);
			}
		};

		loadNilaiTugas();
	}, [selectedTugasId]);

	// Helper functions
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

	const handleNilaiChange = (siswaId, value) => {
		// Validasi input hanya angka 0-100
		if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
			setNilai((prev) => ({
				...prev,
				[siswaId]: value,
			}));
		}
	};

	const refreshCurrentTugasData = async (tugasId) => {
		if (!tugasId) return;
		try {
			const url = `/api/tugas?tugasId=${tugasId}`;
			const res = await fetch(url);
			if (!res.ok) return;
			const data = await res.json();
			if (!Array.isArray(data) || data.length === 0) return;

			// Update ID siswa yang sudah punya nilai (hilangkan badge ✨ Belum)
			const existingIds = data.map((item) => item.siswa_id);
			setInitialSiswaIds(existingIds);

			// Update nilai per siswa di state
			const nilaiMap = {};
			data.forEach((item) => {
				nilaiMap[item.siswa_id] = item.nilai;
			});
			setNilai((prev) => ({
				...prev,
				...nilaiMap,
			}));
		} catch (err) {
			console.error('Error refreshing current tugas data:', err);
		}
	};

	// Modifikasi handleSimpan di halaman penilaian
	const handleSimpan = async () => {
		// Validasi judul
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
		const nilaiArray = siswaKelasIni.map((s) => ({
			siswa_id: s.id,
			nilai: nilai[s.id] || '0',
		}));

		// Hitung yang terisi
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

		// Jika mode update, cek apakah ada siswa baru
		let siswaBaruCount = 0;
		if (selectedTugasId) {
			try {
				// Fetch data tugas yang ada untuk cek siswa baru
				const url = `/api/tugas?tugasId=${selectedTugasId}`;
				const res = await fetch(url);
				if (res.ok) {
					const existingData = await res.json();
					const existingIds = existingData.map((d) => d.siswa_id);
					const currentIds = siswaKelasIni.map((s) => s.id);
					siswaBaruCount = currentIds.filter((id) => !existingIds.includes(id)).length;
				}
			} catch (err) {
				console.error('Error checking siswa baru:', err);
				// Lanjutkan proses meskipun gagal cek siswa baru
			}
		}

		// Konfirmasi dengan info siswa baru (jika ada)
		const result = await Swal.fire({
			title: selectedTugasId ? 'Update Nilai?' : 'Simpan Nilai?',
			html: `
      <div style="text-align: left;">
        <p style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${judul}</p>
        <p style="color: #6B7280; margin-bottom: 4px;">📊 ${terisi} dari ${siswaKelasIni.length} siswa akan disimpan</p>
        ${siswaBaruCount > 0 ? `<p style="color: #059669; font-weight: bold; margin-top: 8px;">✨ ${siswaBaruCount} siswa yang belum dinilai</p>` : ''}
      </div>
    `,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: selectedTugasId ? '✅ Ya, Update & Tambahkan' : 'Ya, Simpan',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);

		const payload = {
			judul,
			mapel: selectedMapel,
			kelas: selectedKelas,
			tanggal,
			nilai: nilaiArray,
		};

		try {
			let res;

			if (selectedTugasId) {
				// Update existing tugas
				res = await fetch('/api/tugas', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...payload,
						tugasId: selectedTugasId,
					}),
				});
			} else {
				// Create new tugas
				res = await fetch('/api/tugas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
			}

			if (res.ok) {
				const data = await res.json();

				// Tampilkan pesan sukses dengan detail
				let successMessage = `<div style="text-align: left;">`;
				successMessage += `<p style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${judul}</p>`;

				if (data.updated !== undefined && data.inserted !== undefined) {
					// Response dari UPSERT
					if (data.updated > 0) {
						successMessage += `<p style="color: #3B82F6; margin-bottom: 4px;">✏️ ${data.updated} nilai diperbarui</p>`;
					}
					if (data.inserted > 0) {
						successMessage += `<p style="color: #059669; margin-bottom: 4px;">✨ ${data.inserted} siswa baru dinilai</p>`;
					}
					successMessage += `<p style="color: #6B7280; margin-top: 8px; font-weight: bold;">📊 Total: ${data.total || data.count} nilai tersimpan</p>`;
				} else if (data.count !== undefined) {
					// Response dari POST biasa
					successMessage += `<p style="color: #059669;">✅ ${data.count} nilai berhasil disimpan</p>`;
				}

				successMessage += `</div>`;

				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					html: successMessage,
					confirmButtonColor: '#4F46E5',
					timer: 2500,
					timerProgressBar: true,
				});

				// Refresh daftar tugas
				const listUrl = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const reloadRes = await fetch(listUrl);
				if (reloadRes.ok) {
					const reloadData = await reloadRes.json();
					const tugasMap = new Map();
					reloadData.forEach((item) => {
						if (!tugasMap.has(item.tugas_id)) {
							tugasMap.set(item.tugas_id, {
								tugas_id: item.tugas_id,
								judul: item.kategori,
								tanggal: item.tanggal,
								kelas: item.kelas,
								mapel: item.mapel,
								jumlahSiswa: 1,
							});
						} else {
							tugasMap.get(item.tugas_id).jumlahSiswa++;
						}
					});
					setDaftarTugas(Array.from(tugasMap.values()).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
				}

				// Jika baru buat, set selectedTugasId dari response
				if (!selectedTugasId && data.tugasId) {
					setSelectedTugasId(data.tugasId);
					await refreshCurrentTugasData(data.tugasId);
				} else if (selectedTugasId) {
					// Jika update tugas existing, refresh data tugas sekarang
					await refreshCurrentTugasData(selectedTugasId);
				}

				// Refresh nilai yang ditampilkan
				if (selectedTugasId) {
					const nilaiUrl = `/api/tugas?tugasId=${selectedTugasId}`;
					const nilaiRes = await fetch(nilaiUrl);
					if (nilaiRes.ok) {
						const nilaiData = await nilaiRes.json();

						// Update state nilai dengan data terbaru
						const updatedNilai = {};
						nilaiData.forEach((item) => {
							updatedNilai[item.siswa_id] = item.nilai;
						});
						setNilai(updatedNilai);
					}
				} else if (data.tugasId) {
					// Jika baru buat, set selectedTugasId
					setSelectedTugasId(data.tugasId);
				}
			} else {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Gagal menyimpan nilai');
			}
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

	const handleTugasBaru = () => {
		setSelectedTugasId('');
		setJudul('');
		setNilai({});
		setTanggal(new Date().toISOString().slice(0, 10));
	};

	const handleHapusTugas = async () => {
		if (!selectedTugasId) return;

		const result = await Swal.fire({
			title: 'Hapus Tugas?',
			html: `Yakin ingin menghapus <b>${judul}</b>?<br>Semua nilai akan terhapus!`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		try {
			const res = await fetch(`/api/tugas?tugasId=${selectedTugasId}`, {
				method: 'DELETE',
			});

			if (res.ok) {
				await Swal.fire({
					icon: 'success',
					title: 'Terhapus!',
					text: 'Tugas berhasil dihapus',
					confirmButtonColor: '#4F46E5',
					timer: 1500,
					timerProgressBar: true,
				});

				// Reset dan refresh
				handleTugasBaru();

				// Refresh list
				const url = `/api/tugas?kelas=${encodeURIComponent(selectedKelas)}&mapel=${encodeURIComponent(selectedMapel)}`;
				const reloadRes = await fetch(url);
				if (reloadRes.ok) {
					const reloadData = await reloadRes.json();
					const tugasMap = new Map();
					reloadData.forEach((item) => {
						if (!tugasMap.has(item.tugas_id)) {
							tugasMap.set(item.tugas_id, {
								tugas_id: item.tugas_id,
								judul: item.kategori,
								tanggal: item.tanggal,
								kelas: item.kelas,
								mapel: item.mapel,
								jumlahSiswa: 1,
							});
						} else {
							tugasMap.get(item.tugas_id).jumlahSiswa++;
						}
					});
					setDaftarTugas(Array.from(tugasMap.values()));
				}
			} else {
				throw new Error('Gagal menghapus tugas');
			}
		} catch (error) {
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menghapus',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		}
	};

	// Hitung statistik
	const stats = {
		total: siswaKelasIni.length,
		terisi: Object.values(nilai).filter((n) => n !== '' && parseInt(n) > 0).length,
		kosong: siswaKelasIni.length - Object.values(nilai).filter((n) => n !== '' && parseInt(n) > 0).length,
		rataRata:
			Object.values(nilai).filter((n) => n !== '' && parseInt(n) > 0).length > 0
				? (Object.values(nilai).reduce((sum, n) => sum + (parseFloat(n) || 0), 0) / Object.values(nilai).filter((n) => n !== '' && parseInt(n) > 0).length).toFixed(2)
				: '0',
	};

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 flex items-center justify-center'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4'></div>
					<p className='text-gray-600 font-medium'>Memuat data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
				{/* Header */}
				<div className='bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 text-white'>
					<div className='flex items-center justify-between mb-4'>
						<button
							onClick={() => router.back()}
							className='bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2 rounded-xl transition-all'>
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
						<h1 className='text-2xl sm:text-3xl font-bold'>📝 Penilaian Siswa</h1>
						<div className='w-10'></div>
					</div>

					{/* Filter Section */}
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
						<div>
							<label className='block text-xs font-medium text-white/90 mb-2'>Kelas</label>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
								{kelasList.map((k) => (
									<option
										key={k.id}
										value={k.kelas || k.nama_kelas}>
										{k.kelas || k.nama_kelas}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className='block text-xs font-medium text-white/90 mb-2'>Mata Pelajaran</label>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 text-sm font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
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

				{/* Daftar Tugas & Buat Baru */}
				<div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6'>
					{/* Tugas Baru Button */}
					<button
						onClick={handleTugasBaru}
						className={`bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-2xl shadow-lg p-6 text-white transition-all transform hover:scale-105 ${
							!selectedTugasId ? 'ring-4 ring-green-300' : ''
						}`}>
						<div className='text-center'>
							<div className='text-4xl mb-2'>➕</div>
							<h3 className='font-bold text-lg'>Tugas Baru</h3>
							<p className='text-sm text-white/80 mt-1'>Buat penilaian baru</p>
						</div>
					</button>

					{/* Daftar Tugas yang Ada */}
					{loadingTugas ? (
						<div className='col-span-2 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent'></div>
						</div>
					) : daftarTugas.length > 0 ? (
						<div className='col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4'>
							{daftarTugas.map((tugas) => (
								<button
									key={tugas.tugas_id}
									onClick={() => setSelectedTugasId(tugas.tugas_id)}
									className={`bg-white hover:bg-purple-50 rounded-2xl shadow-lg p-4 text-left transition-all ${selectedTugasId === tugas.tugas_id ? 'ring-4 ring-purple-400' : ''}`}>
									<div className='flex justify-between items-start mb-2'>
										<h3 className='font-bold text-gray-800 text-base line-clamp-1'>{tugas.judul}</h3>
										<span className='bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold'>{tugas.jumlahSiswa} siswa</span>
									</div>
									<p className='text-xs text-gray-500'>
										📅{' '}
										{new Date(tugas.tanggal).toLocaleDateString('id-ID', {
											day: 'numeric',
											month: 'short',
											year: 'numeric',
										})}
									</p>
								</button>
							))}
						</div>
					) : (
						<div className='col-span-2 bg-white rounded-2xl shadow-lg p-8 text-center'>
							<div className='text-gray-400 text-5xl mb-3'>📋</div>
							<p className='text-gray-500 font-medium'>Belum ada tugas/penilaian</p>
							<p className='text-gray-400 text-sm mt-1'>Klik &quot;Tugas Baru&quot; untuk membuat</p>
						</div>
					)}
				</div>

				{/* Form Input */}
				<div className='bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden mb-6'>
					<div className='p-4 sm:p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-gray-200'>
						<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
							<div className='sm:col-span-2'>
								<label className='block text-xs font-medium text-gray-700 mb-2'>Judul Tugas/Penilaian</label>
								<input
									type='text'
									placeholder='Contoh: Tugas 1, Quiz, UTS, dll'
									value={judul}
									onChange={(e) => setJudul(e.target.value)}
									className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-semibold'
								/>
							</div>
							<div>
								<label className='block text-xs font-medium text-gray-700 mb-2'>Tanggal</label>
								<input
									type='date'
									value={tanggal}
									onChange={(e) => setTanggal(e.target.value)}
									className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-semibold'
								/>
							</div>
						</div>
					</div>

					{/* Statistik */}
					<div className='p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200'>
						<div className='grid grid-cols-4 gap-3'>
							<div className='text-center'>
								<p className='text-xs text-gray-600 mb-1'>Total</p>
								<p className='text-2xl font-bold text-gray-800'>{stats.total}</p>
							</div>
							<div className='text-center'>
								<p className='text-xs text-gray-600 mb-1'>Terisi</p>
								<p className='text-2xl font-bold text-green-600'>{stats.terisi}</p>
							</div>
							<div className='text-center'>
								<p className='text-xs text-gray-600 mb-1'>Kosong</p>
								<p className='text-2xl font-bold text-orange-600'>{stats.kosong}</p>
							</div>
							<div className='text-center'>
								<p className='text-xs text-gray-600 mb-1'>Rata-rata</p>
								<p className='text-2xl font-bold text-blue-600'>{stats.rataRata}</p>
							</div>
						</div>
					</div>

					{/* Daftar Siswa */}
					<div className='divide-y-2 divide-gray-100 max-h-[500px] overflow-y-auto'>
						{siswaKelasIni.map((siswa, index) => {
							const isSiswaBaru = selectedTugasId && !initialSiswaIds.includes(siswa.id);

							return (
								<div
									key={siswa.id}
									className={`p-4 transition-all ${isSiswaBaru ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500' : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50'}`}>
									<div className='flex items-center gap-3'>
										<div className='bg-purple-100 text-purple-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0'>{index + 1}</div>
										<div className='flex-1'>
											<div className='flex items-center gap-2'>
												<h3 className='font-bold text-gray-800 text-sm sm:text-base'>{siswa.nama_lengkap}</h3>
												{isSiswaBaru && <span className='bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold'>✨ Belum</span>}
											</div>
											{siswa.nis && <p className='text-xs text-gray-500'>NIS: {siswa.nis}</p>}
										</div>
										<div className='flex items-center gap-2'>
											<input
												type='number'
												min='0'
												max='100'
												placeholder='0-100'
												value={nilai[siswa.id] || ''}
												onChange={(e) => handleNilaiChange(siswa.id, e.target.value)}
												className={`w-20 sm:w-24 px-3 py-2 border-2 rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all ${
													isSiswaBaru ? 'border-green-300 bg-green-50' : 'border-gray-200'
												}`}
											/>
											{nilai[siswa.id] && parseInt(nilai[siswa.id]) > 0 && <div className='bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-bold text-sm'>{getPredikat(nilai[siswa.id])}</div>}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Tombol Action */}
				<div className='flex gap-3'>
					{selectedTugasId && (
						<button
							onClick={handleHapusTugas}
							className='px-6 py-4 bg-white border-2 border-red-300 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all shadow-lg'>
							🗑️ Hapus
						</button>
					)}
					<button
						onClick={() => router.back()}
						className='flex-1 sm:flex-none px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-lg'>
						Batal
					</button>
					<button
						onClick={handleSimpan}
						disabled={saving}
						className='flex-1 sm:flex-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105'>
						{saving ? 'Menyimpan...' : selectedTugasId ? '💾 Update Nilai' : '💾 Simpan Nilai'}
					</button>
				</div>
			</div>
		</div>
	);
}
