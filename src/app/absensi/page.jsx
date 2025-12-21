/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function AbsensiPage() {
	const router = useRouter();
	const [kelasList, setKelasList] = useState([]);
	const [statusList, setStatusList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState('');
	const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
	const [absensi, setAbsensi] = useState({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// State untuk mode (input atau rekap)
	const [mode, setMode] = useState('input');
	const [dataRekap, setDataRekap] = useState([]);
	const [loadingRekap, setLoadingRekap] = useState(false);

	// Helper status colors
	const getStatusClasses = (warna, active) => {
		const base = 'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm';
		if (active) {
			switch (warna) {
				case 'green':
					return `${base} bg-gradient-to-br from-green-500 to-green-600 text-white ring-2 ring-green-400 ring-offset-2 scale-105`;
				case 'yellow':
					return `${base} bg-gradient-to-br from-yellow-400 to-yellow-500 text-white ring-2 ring-yellow-300 ring-offset-2 scale-105`;
				case 'blue':
					return `${base} bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 scale-105`;
				case 'red':
					return `${base} bg-gradient-to-br from-red-500 to-red-600 text-white ring-2 ring-red-400 ring-offset-2 scale-105`;
				default:
					return `${base} bg-gradient-to-br from-indigo-500 to-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 scale-105`;
			}
		}
		return `${base} bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md`;
	};

	const getStatusBadgeColor = (status) => {
		switch (status) {
			case 'Hadir':
				return 'from-green-500 to-green-600';
			case 'Sakit':
				return 'from-yellow-400 to-yellow-500';
			case 'Izin':
				return 'from-blue-500 to-blue-600';
			case 'Alpha':
				return 'from-red-500 to-red-600';
			default:
				return 'from-gray-400 to-gray-500';
		}
	};

	// Fetch initial data
	useEffect(() => {
		const fetchAll = async () => {
			try {
				const [resKelas, resStatus, resSiswa] = await Promise.all([fetch('/api/kelas'), fetch('/api/status-absensi'), fetch('/api/siswa')]);

				const dataKelas = resKelas.ok ? await resKelas.json() : [];
				const dataStatus = resStatus.ok ? await resStatus.json() : [];
				const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

				setKelasList(dataKelas);
				setStatusList(dataStatus);
				setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

				if (dataKelas.length > 0) {
					setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
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

	// Helper function untuk get data siswa by ID
	const getSiswaById = (siswaId) => {
		return siswaList.find((s) => s.id === siswaId);
	};

	const getNamaSiswa = (siswaId) => {
		const siswa = getSiswaById(siswaId);
		return siswa?.nama_lengkap || 'Nama tidak ditemukan';
	};

	const getNisSiswa = (siswaId) => {
		const siswa = getSiswaById(siswaId);
		return siswa?.nis || '-';
	};

	// Check apakah sudah ada absensi untuk tanggal & kelas ini
	useEffect(() => {
		if (!selectedKelas || !tanggal || siswaList.length === 0) return;

		const checkAbsensi = async () => {
			try {
				setLoadingRekap(true);
				const url = `/api/absensi?kelas=${encodeURIComponent(selectedKelas)}&tanggal=${tanggal}`;
				const res = await fetch(url);

				if (res.ok) {
					const data = await res.json();

					if (data && data.length > 0) {
						setMode('rekap');
						setDataRekap(data);
					} else {
						setMode('input');
						setDataRekap([]);
						if (siswaKelasIni.length > 0 && statusList.length > 0) {
							const init = {};
							siswaKelasIni.forEach((s) => {
								init[s.id] = { status: statusList[0]?.label || '', keterangan: '' };
							});
							setAbsensi(init);
						}
					}
				} else {
					setMode('input');
					setDataRekap([]);
				}
			} catch (err) {
				console.error('Error checking absensi:', err);
				setMode('input');
			} finally {
				setLoadingRekap(false);
			}
		};

		checkAbsensi();
	}, [selectedKelas, tanggal, siswaList.length, siswaKelasIni.length, statusList.length]);

	const handleStatusChange = (siswaId, labelStatus) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: {
				...(prev[siswaId] || { keterangan: '' }),
				status: labelStatus,
			},
		}));
	};

	const handleKeteranganChange = (siswaId, value) => {
		setAbsensi((prev) => ({
			...prev,
			[siswaId]: {
				...(prev[siswaId] || { status: statusList[0]?.label || '' }),
				keterangan: value,
			},
		}));
	};

	const handleTandaiSemua = (labelStatus) => {
		setAbsensi((prev) => {
			const updated = { ...prev };
			siswaKelasIni.forEach((s) => {
				updated[s.id] = {
					status: labelStatus,
					keterangan: prev[s.id]?.keterangan || '',
				};
			});
			return updated;
		});
	};

	const handleSimpan = async () => {
		const result = await Swal.fire({
			title: 'Simpan Absensi?',
			text: `Menyimpan absensi untuk ${siswaKelasIni.length} siswa`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Simpan',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);

		const payload = siswaKelasIni.map((s) => ({
			tanggal,
			kelas: selectedKelas,
			siswa_id: s.id,
			status: absensi[s.id]?.status || '',
			keterangan: absensi[s.id]?.keterangan || '',
		}));

		try {
			const res = await fetch('/api/absensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				await Swal.fire({
					icon: 'success',
					title: 'Berhasil!',
					text: `Absensi ${siswaKelasIni.length} siswa tersimpan`,
					confirmButtonColor: '#4F46E5',
					timer: 1500,
					timerProgressBar: true,
					showConfirmButton: false,
				});

				// Refresh data untuk menampilkan rekap
				const url = `/api/absensi?kelas=${encodeURIComponent(selectedKelas)}&tanggal=${tanggal}`;
				const rekapRes = await fetch(url);
				const rekapData = await rekapRes.json();

				setMode('rekap');
				setDataRekap(rekapData);
			} else {
				throw new Error('Gagal menyimpan absensi');
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

	// Edit absensi per siswa dengan modal
	// Edit absensi per siswa dengan modal MODERN
	const handleEditSiswa = async (absensiItem) => {
		const siswa = getSiswaById(absensiItem.siswa_id);
		if (!siswa) return;

		let selectedStatus = absensiItem.status;

		// Icon untuk setiap status
		const statusIcons = {
			Hadir: '✓',
			Sakit: '🤒',
			Izin: '📝',
			Alpha: '✗',
		};

		// Buat HTML untuk modal
		const statusButtonsHTML = statusList
			.map((st) => {
				const icon = statusIcons[st.label] || '•';
				const isActive = selectedStatus === st.label;

				let bgColor = 'background: rgba(255, 255, 255, 0.9); color: #6B7280; border: 2px solid rgba(229, 231, 235, 0.8);';
				if (isActive) {
					switch (st.warna) {
						case 'green':
							bgColor = 'background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: 2px solid #10B981; transform: scale(1.05);';
							break;
						case 'yellow':
							bgColor = 'background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); color: white; border: 2px solid #FBBF24; transform: scale(1.05);';
							break;
						case 'blue':
							bgColor = 'background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; border: 2px solid #3B82F6; transform: scale(1.05);';
							break;
						case 'red':
							bgColor = 'background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; border: 2px solid #EF4444; transform: scale(1.05);';
							break;
						case 'purple':
							bgColor = 'background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; border: 2px solid #8B5CF6; transform: scale(1.05);';
							break;
					}
				}

				return `
      <button 
        type="button"
        class="status-btn-custom"
        data-status="${st.label}"
        data-color="${st.warna}"
        style="
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          box-shadow: ${isActive ? '0 6px 12px rgba(0, 0, 0, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.05)'};
          ${bgColor}
          backdrop-filter: blur(10px);
        ">
        <span style="font-size: 20px;">${icon}</span>
        <span style="font-size: 12px;">${st.label}</span>
      </button>
    `;
			})
			.join('');

		const result = await Swal.fire({
			html: `
      <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 20px 16px; margin: -16px -16px 0 -16px; border-radius: 20px 20px 0 0;">
        <div style="text-align: center; color: white;">
          <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 24px; font-weight: bold;">
            ${siswa.nama_lengkap.charAt(0).toUpperCase()}
          </div>
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">${siswa.nama_lengkap}</h2>
          <p style="font-size: 12px; opacity: 0.9; margin: 0;">NIS: ${siswa.nis || '-'}</p>
        </div>
      </div>
      
      <div style="padding: 20px 16px 16px 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #374151; font-size: 13px; text-align: left;">
          📊 Status Kehadiran
        </label>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px;">
          ${statusButtonsHTML}
        </div>
        
        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #374151; font-size: 13px; text-align: left;">
          💬 Keterangan
        </label>
        <input 
          id="modal-keterangan" 
          type="text" 
          placeholder="Keterangan (opsional)"
          value="${absensiItem.keterangan || ''}"
          style="
            width: 100%;
            padding: 12px 14px;
            border: 2px solid rgba(229, 231, 235, 0.8);
            border-radius: 12px;
            font-size: 13px;
            outline: none;
            transition: all 0.2s;
            box-sizing: border-box;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
          "
        >
      </div>
    `,
			showCancelButton: true,
			confirmButtonText: '💾 Simpan',
			cancelButtonText: 'Batal',
			width: window.innerWidth < 640 ? '90%' : '480px',
			padding: '16px',
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			allowOutsideClick: true,
			allowEscapeKey: true,
			allowEnterKey: true,
			buttonsStyling: true,
			background: 'rgba(255, 255, 255, 0.95)',
			backdrop: 'rgba(0, 0, 0, 0.6)',
			customClass: {
				popup: 'swal-popup-blur',
				confirmButton: 'swal-btn-confirm',
				cancelButton: 'swal-btn-cancel',
				actions: 'swal-actions-custom',
			},
			didOpen: () => {
				// Add blur effect to popup
				const popup = document.querySelector('.swal-popup-blur');
				if (popup) {
					popup.style.backdropFilter = 'blur(20px)';
					popup.style.WebkitBackdropFilter = 'blur(20px)';
					popup.style.borderRadius = '20px';
					popup.style.border = '1px solid rgba(255, 255, 255, 0.3)';
					popup.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.3)';
				}

				// Style buttons
				const confirmBtn = document.querySelector('.swal-btn-confirm');
				const cancelBtn = document.querySelector('.swal-btn-cancel');
				const actions = document.querySelector('.swal-actions-custom');

				if (confirmBtn) {
					confirmBtn.style.borderRadius = '12px';
					confirmBtn.style.padding = '10px 24px';
					confirmBtn.style.fontSize = '14px';
					confirmBtn.style.fontWeight = '600';
				}

				if (cancelBtn) {
					cancelBtn.style.borderRadius = '12px';
					cancelBtn.style.padding = '10px 24px';
					cancelBtn.style.fontSize = '14px';
					cancelBtn.style.fontWeight = '600';
				}

				if (actions) {
					actions.style.gap = '8px';
					actions.style.marginTop = '16px';
				}

				// Responsive grid for larger screens
				if (window.innerWidth >= 640) {
					const statusContainer = popup.querySelector('div[style*="grid-template-columns"]');
					if (statusContainer) {
						statusContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
					}
				}

				const buttons = document.querySelectorAll('.status-btn-custom');

				buttons.forEach((btn) => {
					// Hover effect
					btn.addEventListener('mouseenter', () => {
						if (!btn.classList.contains('active-status')) {
							btn.style.transform = 'translateY(-2px)';
							btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
						}
					});

					btn.addEventListener('mouseleave', () => {
						if (!btn.classList.contains('active-status')) {
							btn.style.transform = 'translateY(0)';
							btn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
						}
					});

					// Click handler
					btn.addEventListener('click', () => {
						const status = btn.getAttribute('data-status');
						const color = btn.getAttribute('data-color');
						selectedStatus = status;

						// Update semua buttons
						buttons.forEach((b) => {
							b.classList.remove('active-status');
							b.style.background = 'rgba(255, 255, 255, 0.9)';
							b.style.color = '#6B7280';
							b.style.borderColor = 'rgba(229, 231, 235, 0.8)';
							b.style.transform = 'scale(1)';
							b.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
						});

						// Set active button
						btn.classList.add('active-status');
						let bgGradient = '';
						switch (color) {
							case 'green':
								bgGradient = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
								btn.style.borderColor = '#10B981';
								break;
							case 'yellow':
								bgGradient = 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)';
								btn.style.borderColor = '#FBBF24';
								break;
							case 'blue':
								bgGradient = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
								btn.style.borderColor = '#3B82F6';
								break;
							case 'red':
								bgGradient = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
								btn.style.borderColor = '#EF4444';
								break;
							case 'purple':
								bgGradient = 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)';
								btn.style.borderColor = '#8B5CF6';
								break;
							default:
								bgGradient = 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)';
								btn.style.borderColor = '#4F46E5';
						}
						btn.style.background = bgGradient;
						btn.style.color = 'white';
						btn.style.transform = 'scale(1.05)';
						btn.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
					});
				});

				// Focus handler untuk input
				const input = document.getElementById('modal-keterangan');
				if (input) {
					input.addEventListener('focus', () => {
						input.style.borderColor = '#4F46E5';
						input.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.1)';
						input.style.background = 'white';
					});
					input.addEventListener('blur', () => {
						input.style.borderColor = 'rgba(229, 231, 235, 0.8)';
						input.style.boxShadow = 'none';
						input.style.background = 'rgba(255, 255, 255, 0.9)';
					});
				}
			},
			preConfirm: () => {
				const keterangan = document.getElementById('modal-keterangan').value;
				return {
					status: selectedStatus,
					keterangan: keterangan,
				};
			},
		});

		// Handle jika user confirm (klik Simpan)
		if (result.isConfirmed) {
			try {
				// Tampilkan loading
				Swal.fire({
					title: 'Menyimpan...',
					html: '<div style="font-size: 14px; color: #6B7280;">Memperbarui data absensi</div>',
					allowOutsideClick: false,
					allowEscapeKey: false,
					showConfirmButton: false,
					background: 'rgba(255, 255, 255, 0.95)',
					backdrop: 'rgba(0, 0, 0, 0.6)',
					didOpen: () => {
						Swal.showLoading();
					},
				});

				const updateRes = await fetch('/api/absensi', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: absensiItem.id,
						status: result.value.status,
						keterangan: result.value.keterangan,
					}),
				});

				if (updateRes.ok) {
					await Swal.fire({
						icon: 'success',
						title: 'Berhasil! 🎉',
						html: `<div style="font-size: 14px; color: #6B7280;">Absensi ${siswa.nama_lengkap} berhasil diperbarui</div>`,
						confirmButtonColor: '#4F46E5',
						confirmButtonText: 'OK',
						timer: 2000,
						timerProgressBar: true,
						background: 'rgba(255, 255, 255, 0.95)',
						backdrop: 'rgba(0, 0, 0, 0.6)',
						customClass: {
							confirmButton: 'swal-btn-confirm',
						},
						didOpen: () => {
							const btn = document.querySelector('.swal-btn-confirm');
							if (btn) {
								btn.style.borderRadius = '12px';
								btn.style.padding = '10px 24px';
								btn.style.fontSize = '14px';
							}
						},
					});

					// Refresh data rekap
					const url = `/api/absensi?kelas=${encodeURIComponent(selectedKelas)}&tanggal=${tanggal}`;
					const rekapRes = await fetch(url);
					const rekapData = await rekapRes.json();
					setDataRekap(rekapData);
				} else {
					const errorData = await updateRes.json();
					throw new Error(errorData.error || 'Gagal memperbarui absensi');
				}
			} catch (error) {
				console.error('Error updating absensi:', error);
				Swal.fire({
					icon: 'error',
					title: 'Gagal',
					html: `<div style="font-size: 14px; color: #6B7280;">${error.message}</div>`,
					confirmButtonColor: '#4F46E5',
					confirmButtonText: 'OK',
					background: 'rgba(255, 255, 255, 0.95)',
					backdrop: 'rgba(0, 0, 0, 0.6)',
					customClass: {
						confirmButton: 'swal-btn-confirm',
					},
					didOpen: () => {
						const btn = document.querySelector('.swal-btn-confirm');
						if (btn) {
							btn.style.borderRadius = '12px';
							btn.style.padding = '10px 24px';
							btn.style.fontSize = '14px';
						}
					},
				});
			}
		}
	};

	// Hitung statistik
	const stats =
		mode === 'rekap' && dataRekap.length > 0
			? {
					total: dataRekap.length,
					hadir: dataRekap.filter((d) => d.status === 'Hadir').length,
					sakit: dataRekap.filter((d) => d.status === 'Sakit').length,
					izin: dataRekap.filter((d) => d.status === 'Izin').length,
					alpha: dataRekap.filter((d) => d.status === 'Alpha').length,
			  }
			: {
					total: siswaKelasIni.length,
					hadir: Object.values(absensi).filter((a) => a.status === 'Hadir').length,
					sakit: Object.values(absensi).filter((a) => a.status === 'Sakit').length,
					izin: Object.values(absensi).filter((a) => a.status === 'Izin').length,
					alpha: Object.values(absensi).filter((a) => a.status === 'Alpha').length,
			  };

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mx-auto mb-4'></div>
					<p className='text-gray-600 font-medium'>Memuat data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
				{/* Header */}
				<div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 text-white'>
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
						<h1 className='text-2xl sm:text-3xl font-bold'>{mode === 'rekap' ? '📊 Rekap Absensi' : '📋 Input Absensi'}</h1>
						<div className='w-10'></div>
					</div>

					{/* Filter Section */}
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-white/90 mb-2'>Pilih Kelas</label>
							<select
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								disabled={mode === 'rekap'}
								className='w-full px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed'>
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
							<label className='block text-sm font-medium text-white/90 mb-2'>Tanggal</label>
							<input
								type='date'
								value={tanggal}
								onChange={(e) => setTanggal(e.target.value)}
								className='w-full px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'
							/>
						</div>
					</div>
				</div>

				{/* Statistik */}
				<div className='grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6'>
					<div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100 hover:shadow-xl transition-all'>
						<div className='text-center'>
							<p className='text-xs sm:text-sm text-gray-600 mb-1'>Total Siswa</p>
							<p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
						</div>
					</div>
					<div className='bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
						<div className='text-center'>
							<p className='text-xs sm:text-sm text-white/90 mb-1'>Hadir</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.hadir}</p>
						</div>
					</div>
					<div className='bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
						<div className='text-center'>
							<p className='text-xs sm:text-sm text-white/90 mb-1'>Sakit</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.sakit}</p>
						</div>
					</div>
					<div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
						<div className='text-center'>
							<p className='text-xs sm:text-sm text-white/90 mb-1'>Izin</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.izin}</p>
						</div>
					</div>
					<div className='bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
						<div className='text-center'>
							<p className='text-xs sm:text-sm text-white/90 mb-1'>Alpha</p>
							<p className='text-2xl sm:text-3xl font-bold'>{stats.alpha}</p>
						</div>
					</div>
				</div>

				{loadingRekap ? (
					<div className='text-center py-12'>
						<div className='animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto'></div>
					</div>
				) : mode === 'input' ? (
					/* MODE INPUT */
					<>
						{/* Quick Actions */}
						<div className='bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6 border-2 border-gray-100'>
							<h3 className='text-sm font-semibold text-gray-700 mb-3'>Tandai Semua Sebagai:</h3>
							<div className='flex flex-wrap gap-2'>
								{statusList.map((st) => (
									<button
										key={st.id}
										onClick={() => handleTandaiSemua(st.label)}
										className={`${getStatusClasses(st.warna, false)} hover:scale-105`}>
										{st.label}
									</button>
								))}
							</div>
						</div>

						{/* Form Input Absensi */}
						<div className='bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden mb-6'>
							<div className='p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200'>
								<h2 className='text-xl font-bold text-gray-800'>Daftar Siswa ({siswaKelasIni.length})</h2>
							</div>

							<div className='divide-y-2 divide-gray-100'>
								{siswaKelasIni.map((siswa, index) => (
									<div
										key={siswa.id}
										className='p-4 sm:p-6 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all'>
										{/* Mobile Layout */}
										<div className='block lg:hidden'>
											<div className='flex items-start gap-3 mb-4'>
												<div className='bg-indigo-100 text-indigo-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0'>{index + 1}</div>
												<div className='flex-1'>
													<h3 className='font-bold text-gray-800 text-base mb-1'>{siswa.nama_lengkap}</h3>
													{siswa.nis && <p className='text-xs text-gray-500'>NIS: {siswa.nis}</p>}
												</div>
											</div>

											<div className='grid grid-cols-2 gap-2 mb-3'>
												{statusList.map((st) => {
													const active = absensi[siswa.id]?.status === st.label;
													return (
														<button
															key={st.id}
															onClick={() => handleStatusChange(siswa.id, st.label)}
															className={getStatusClasses(st.warna, active)}>
															{st.label}
														</button>
													);
												})}
											</div>

											<input
												type='text'
												placeholder='Keterangan (opsional)'
												value={absensi[siswa.id]?.keterangan || ''}
												onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
												className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm'
											/>
										</div>

										{/* Desktop Layout */}
										<div className='hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center'>
											<div className='col-span-3 flex items-center gap-3'>
												<div className='bg-indigo-100 text-indigo-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0'>{index + 1}</div>
												<div>
													<h3 className='font-bold text-gray-800 text-sm'>{siswa.nama_lengkap}</h3>
													{siswa.nis && <p className='text-xs text-gray-500'>NIS: {siswa.nis}</p>}
												</div>
											</div>

											<div className='col-span-6 flex gap-2'>
												{statusList.map((st) => {
													const active = absensi[siswa.id]?.status === st.label;
													return (
														<button
															key={st.id}
															onClick={() => handleStatusChange(siswa.id, st.label)}
															className={getStatusClasses(st.warna, active)}>
															{st.label}
														</button>
													);
												})}
											</div>

											<div className='col-span-3'>
												<input
													type='text'
													placeholder='Keterangan'
													value={absensi[siswa.id]?.keterangan || ''}
													onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
													className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm'
												/>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Tombol Simpan */}
						<div className='flex gap-3'>
							<button
								onClick={() => router.back()}
								className='flex-1 sm:flex-none px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-lg'>
								Batal
							</button>
							<button
								onClick={handleSimpan}
								disabled={saving}
								className='flex-1 sm:flex-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105'>
								{saving ? 'Menyimpan...' : '💾 Simpan Absensi'}
							</button>
						</div>
					</>
				) : (
					/* MODE REKAP */
					<>
						{/* Success Badge */}
						<div className='text-center mb-6'>
							<div className='inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-lg'>
								<svg
									className='w-6 h-6'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={3}
										d='M5 13l4 4L19 7'
									/>
								</svg>
								<span className='font-bold'>Absensi Sudah Tersimpan - Klik siswa untuk edit</span>
							</div>
						</div>

						{/* Detail Rekap */}
						<div className='bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden'>
							<div className='bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4'>
								<h2 className='text-xl font-bold text-white'>Detail Absensi Siswa</h2>
							</div>
							<div className='divide-y divide-gray-100 max-h-[600px] overflow-y-auto'>
								{dataRekap.map((item, index) => (
									<div
										key={item.id}
										onClick={() => handleEditSiswa(item)}
										className='p-4 hover:bg-indigo-50 transition-all cursor-pointer group'>
										<div className='flex items-center justify-between gap-4'>
											<div className='flex items-center gap-3 flex-1'>
												<div className='bg-gray-100 group-hover:bg-indigo-100 text-gray-700 group-hover:text-indigo-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 transition-all'>
													{index + 1}
												</div>
												<div className='flex-1'>
													<h3 className='font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors'>{getNamaSiswa(item.siswa_id)}</h3>
													<p className='text-xs text-gray-500'>NIS: {getNisSiswa(item.siswa_id)}</p>
													{item.keterangan && <p className='text-xs text-gray-500 mt-1'>💬 {item.keterangan}</p>}
												</div>
											</div>
											<div className='flex items-center gap-3'>
												<div className={`bg-gradient-to-br ${getStatusBadgeColor(item.status)} px-4 py-2 rounded-xl text-white font-bold text-sm shadow-md`}>{item.status}</div>
												<svg
													className='w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M9 5l7 7-7 7'
													/>
												</svg>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
