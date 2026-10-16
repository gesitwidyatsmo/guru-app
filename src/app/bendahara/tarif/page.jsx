'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	formatRupiah,
	DEFAULT_BISAROH_SETTINGS,
	normalizeBisarohSettings,
} from '@/lib/bisaroh';
import Swal from 'sweetalert2';

export default function BendaharaTarifPage() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [users, setUsers] = useState([]);
	const [activeTab, setActiveTab] = useState('tingkatan'); // 'tingkatan' | 'tunjangan' | 'potongan' | 'cutoff'

	// Form Settings State
	const [settings, setSettings] = useState(DEFAULT_BISAROH_SETTINGS);

	// Search filter for teacher assignment in Tab 1 & Tab 5
	const [guruSearch, setGuruSearch] = useState('');
	const [pegawaiSearch, setPegawaiSearch] = useState('');

	// Modal States for Dynamic Entities
	const [modalTingkatan, setModalTingkatan] = useState({ isOpen: false, isEdit: false, data: null });
	const [modalTunjanganPokok, setModalTunjanganPokok] = useState({ isOpen: false, isEdit: false, data: null });
	const [modalTunjangan, setModalTunjangan] = useState({ isOpen: false, isEdit: false, data: null });
	const [modalPotongan, setModalPotongan] = useState({ isOpen: false, isEdit: false, data: null });
	const [modalJabatan, setModalJabatan] = useState({ isOpen: false, isEdit: false, data: null });

	// Fetch Settings & Teachers
	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				const [resSettings, resUsers] = await Promise.all([
					fetch('/api/settings?key=bisaroh_settings').catch(() => ({ ok: false })),
					fetch('/api/users').catch(() => ({ ok: false })),
				]);

				if (resSettings.ok) {
					const data = await resSettings.json();
					if (data?.value) {
						setSettings(normalizeBisarohSettings(data.value));
					}
				}

				if (resUsers.ok) {
					const data = await resUsers.json();
					setUsers(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				console.error('Error load settings & users:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// List of teachers
	const guruList = useMemo(() => {
		return users.filter((u) => u.role === 'Guru');
	}, [users]);

	const filteredGuruList = useMemo(() => {
		if (!guruSearch.trim()) return guruList;
		const q = guruSearch.toLowerCase().trim();
		return guruList.filter(
			(g) =>
				(g.nama_lengkap || '').toLowerCase().includes(q) ||
				(g.username || '').toLowerCase().includes(q)
		);
	}, [guruList, guruSearch]);

	// List of all employees (teachers and non-teachers) for position assignment in Tab 5
	const filteredPegawaiList = useMemo(() => {
		if (!pegawaiSearch.trim()) return users;
		const q = pegawaiSearch.toLowerCase().trim();
		return users.filter(
			(u) =>
				(u.nama_lengkap || '').toLowerCase().includes(q) ||
				(u.username || '').toLowerCase().includes(q) ||
				(u.role || '').toLowerCase().includes(q)
		);
	}, [users, pegawaiSearch]);

	// Central Auto-Save Handler directly to Supabase app_settings
	const saveSettingsToDB = async (newSettings, successMessage) => {
		setSettings(newSettings);
		setSaving(true);
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: 'bisaroh_settings',
					value: newSettings,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Gagal menyimpan konfigurasi');
			}

			if (successMessage) {
				Swal.fire({
					icon: 'success',
					title: successMessage,
					toast: true,
					position: 'top-end',
					showConfirmButton: false,
					timer: 2000,
					timerProgressBar: true,
				});
			}
			return true;
		} catch (err) {
			console.error('Error auto-saving bisaroh settings:', err);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan ke Database',
				text: err.message,
			});
			return false;
		} finally {
			setSaving(false);
		}
	};

	// --- HANDLERS: TINGKATAN GURU ---
	const handleSaveTingkatan = async (e) => {
		e.preventDefault();
		const formEl = e.target;
		const nama = formEl.nama.value.trim();
		const tarif = Number(formEl.tarif_per_jp.value) || 0;
		const keterangan = formEl.keterangan.value.trim();

		if (!nama || tarif <= 0) {
			Swal.fire('Input Tidak Valid', 'Nama tingkatan dan tarif per JP wajib diisi.', 'warning');
			return;
		}

		let newSettings;
		if (modalTingkatan.isEdit) {
			newSettings = {
				...settings,
				tingkatan_guru: settings.tingkatan_guru.map((t) =>
					t.id === modalTingkatan.data.id ? { ...t, nama, tarif_per_jp: tarif, keterangan } : t
				),
			};
		} else {
			const id = `grade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
			newSettings = {
				...settings,
				tingkatan_guru: [...settings.tingkatan_guru, { id, nama, tarif_per_jp: tarif, keterangan }],
			};
		}

		setModalTingkatan({ isOpen: false, isEdit: false, data: null });
		await saveSettingsToDB(
			newSettings,
			modalTingkatan.isEdit ? `Tingkatan "${nama}" berhasil diperbarui!` : `Tingkatan "${nama}" berhasil ditambahkan!`
		);
	};

	const handleDeleteTingkatan = (id) => {
		if (settings.tingkatan_guru.length <= 1) {
			Swal.fire('Tidak Dapat Dihapus', 'Minimal harus ada 1 tingkatan tarif di sistem.', 'warning');
			return;
		}

		Swal.fire({
			title: 'Hapus Tingkatan Ini?',
			text: 'Guru yang terhubung ke tingkatan ini akan otomatis beralih ke tingkatan default.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (res) => {
			if (res.isConfirmed) {
				const filtered = settings.tingkatan_guru.filter((t) => t.id !== id);
				const newDefault = settings.default_tingkatan_id === id ? filtered[0]?.id : settings.default_tingkatan_id;
				const newMap = { ...settings.guru_tingkatan_map };
				Object.keys(newMap).forEach((gId) => {
					if (newMap[gId] === id) delete newMap[gId];
				});
				const newSettings = {
					...settings,
					tingkatan_guru: filtered,
					default_tingkatan_id: newDefault,
					guru_tingkatan_map: newMap,
				};
				await saveSettingsToDB(newSettings, 'Tingkatan tarif berhasil dihapus dari database!');
			}
		});
	};

	const handleSetDefaultTingkatan = async (id) => {
		const newSettings = {
			...settings,
			default_tingkatan_id: id,
		};
		await saveSettingsToDB(newSettings, 'Tingkatan default berhasil diperbarui!');
	};

	const handleAssignGuruTingkatan = async (guruId, tingkatanId) => {
		const newMap = { ...settings.guru_tingkatan_map };
		if (tingkatanId === settings.default_tingkatan_id) {
			delete newMap[guruId]; // Kembalikan ke default bawaan
		} else {
			newMap[guruId] = tingkatanId;
		}
		const newSettings = {
			...settings,
			guru_tingkatan_map: newMap,
		};
		await saveSettingsToDB(newSettings, 'Penugasan tingkatan guru berhasil disimpan!');
	};

	// --- HANDLERS: TUNJANGAN POKOK SISTEM (CRUD) ---
	const handleSaveTunjanganPokok = async (e) => {
		e.preventDefault();
		const formEl = e.target;
		const nama = formEl.nama.value.trim();
		const kategori = formEl.kategori.value; // 'wali_kelas' | 'kehadiran' | 'umum'
		const tipe = formEl.tipe.value; // 'per_bulan' | 'per_hari' | 'per_jp'
		const nominal = Number(formEl.nominal.value) || 0;
		const penerima = kategori === 'wali_kelas' ? 'wali_kelas' : formEl.penerima.value;
		const aktif = formEl.aktif.checked;
		const keterangan = formEl.keterangan.value.trim();

		const selectedGurus = [];
		if (penerima === 'terpilih') {
			const checkboxes = formEl.querySelectorAll('input[name="target_guru_pokok"]:checked');
			checkboxes.forEach((cb) => selectedGurus.push(cb.value));
		}

		if (!nama || nominal < 0) {
			Swal.fire('Input Tidak Valid', 'Nama tunjangan pokok wajib diisi dan nominal tidak boleh negatif.', 'warning');
			return;
		}

		let newSettings;
		if (modalTunjanganPokok.isEdit) {
			const currentList = settings.tunjangan_pokok || [];
			const updated = currentList.map((t) =>
				t.id === modalTunjanganPokok.data.id
					? { ...t, nama, kategori, tipe, nominal, penerima, guru_ids: selectedGurus, aktif, keterangan }
					: t
			);
			newSettings = {
				...settings,
				tunjangan_pokok: updated,
			};
		} else {
			const id = `pok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
			newSettings = {
				...settings,
				tunjangan_pokok: [
					...(settings.tunjangan_pokok || []),
					{ id, nama, kategori, tipe, nominal, penerima, guru_ids: selectedGurus, aktif, keterangan },
				],
			};
		}

		setModalTunjanganPokok({ isOpen: false, isEdit: false, data: null });
		await saveSettingsToDB(
			newSettings,
			modalTunjanganPokok.isEdit ? `Tunjangan pokok "${nama}" berhasil diperbarui!` : `Tunjangan pokok "${nama}" berhasil ditambahkan!`
		);
	};

	const handleDeleteTunjanganPokok = (id) => {
		Swal.fire({
			title: 'Hapus Tunjangan Pokok Ini?',
			text: 'Komponen tunjangan pokok ini akan dihapus dari perhitungan bisaroh sistem.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (res) => {
			if (res.isConfirmed) {
				const newSettings = {
					...settings,
					tunjangan_pokok: (settings.tunjangan_pokok || []).filter((t) => t.id !== id),
				};
				await saveSettingsToDB(newSettings, 'Tunjangan pokok berhasil dihapus dari database!');
			}
		});
	};

	const handleToggleAktifTunjanganPokok = async (id) => {
		const newSettings = {
			...settings,
			tunjangan_pokok: (settings.tunjangan_pokok || []).map((t) =>
				t.id === id ? { ...t, aktif: !t.aktif } : t
			),
		};
		await saveSettingsToDB(newSettings, 'Status aktif tunjangan pokok berhasil diperbarui!');
	};

	// --- HANDLERS: TUNJANGAN TAMBAHAN ---
	const handleSaveTunjangan = async (e) => {
		e.preventDefault();
		const formEl = e.target;
		const nama = formEl.nama.value.trim();
		const tipe = formEl.tipe.value;
		const nominal = Number(formEl.nominal.value) || 0;
		const penerima = formEl.penerima.value;
		const keterangan = formEl.keterangan.value.trim();

		const selectedGurus = [];
		if (penerima === 'terpilih') {
			const checkboxes = formEl.querySelectorAll('input[name="target_guru"]:checked');
			checkboxes.forEach((cb) => selectedGurus.push(cb.value));
		}

		if (!nama || nominal <= 0) {
			Swal.fire('Input Tidak Valid', 'Nama tunjangan dan nominal wajib diisi.', 'warning');
			return;
		}

		let newSettings;
		if (modalTunjangan.isEdit) {
			newSettings = {
				...settings,
				tunjangan_tambahan: settings.tunjangan_tambahan.map((t) =>
					t.id === modalTunjangan.data.id
						? { ...t, nama, tipe, nominal, penerima, guru_ids: selectedGurus, keterangan }
						: t
				),
			};
		} else {
			const id = `tunj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
			newSettings = {
				...settings,
				tunjangan_tambahan: [
					...settings.tunjangan_tambahan,
					{ id, nama, tipe, nominal, penerima, guru_ids: selectedGurus, keterangan },
				],
			};
		}

		setModalTunjangan({ isOpen: false, isEdit: false, data: null });
		await saveSettingsToDB(
			newSettings,
			modalTunjangan.isEdit ? `Tunjangan "${nama}" berhasil diperbarui!` : `Tunjangan "${nama}" berhasil ditambahkan!`
		);
	};

	const handleDeleteTunjangan = (id) => {
		Swal.fire({
			title: 'Hapus Tunjangan Ini?',
			text: 'Komponen tunjangan ini tidak akan dihitung lagi pada periode berikutnya.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (res) => {
			if (res.isConfirmed) {
				const newSettings = {
					...settings,
					tunjangan_tambahan: settings.tunjangan_tambahan.filter((t) => t.id !== id),
				};
				await saveSettingsToDB(newSettings, 'Tunjangan tambahan berhasil dihapus!');
			}
		});
	};

	// --- HANDLERS: POTONGAN TETAP ---
	const handleSavePotongan = async (e) => {
		e.preventDefault();
		const formEl = e.target;
		const nama = formEl.nama.value.trim();
		const nominal = Number(formEl.nominal.value) || 0;
		const penerima = formEl.penerima.value;
		const keterangan = formEl.keterangan.value.trim();

		const selectedGurus = [];
		if (penerima === 'terpilih') {
			const checkboxes = formEl.querySelectorAll('input[name="target_guru_pot"]:checked');
			checkboxes.forEach((cb) => selectedGurus.push(cb.value));
		}

		if (!nama || nominal <= 0) {
			Swal.fire('Input Tidak Valid', 'Nama potongan dan nominal wajib diisi.', 'warning');
			return;
		}

		let newSettings;
		if (modalPotongan.isEdit) {
			newSettings = {
				...settings,
				potongan_tetap: settings.potongan_tetap.map((p) =>
					p.id === modalPotongan.data.id
						? { ...p, nama, nominal, penerima, guru_ids: selectedGurus, keterangan }
						: p
				),
			};
		} else {
			const id = `pot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
			newSettings = {
				...settings,
				potongan_tetap: [
					...settings.potongan_tetap,
					{ id, nama, nominal, penerima, guru_ids: selectedGurus, keterangan },
				],
			};
		}

		setModalPotongan({ isOpen: false, isEdit: false, data: null });
		await saveSettingsToDB(
			newSettings,
			modalPotongan.isEdit ? `Potongan "${nama}" berhasil diperbarui!` : `Potongan "${nama}" berhasil ditambahkan!`
		);
	};

	const handleDeletePotongan = (id) => {
		Swal.fire({
			title: 'Hapus Potongan Ini?',
			text: 'Komponen potongan ini akan dihapus dari daftar potongan bulanan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (res) => {
			if (res.isConfirmed) {
				const newSettings = {
					...settings,
					potongan_tetap: settings.potongan_tetap.filter((p) => p.id !== id),
				};
				await saveSettingsToDB(newSettings, 'Potongan tetap berhasil dihapus!');
			}
		});
	};

	// --- HANDLERS: JABATAN & GAJI POKOK (CRUD) ---
	const handleSaveJabatan = async (e) => {
		e.preventDefault();
		const formEl = e.target;
		const nama = formEl.nama.value.trim();
		const kategori = formEl.kategori.value; // 'pendidik_struktural' | 'tendik' | 'pimpinan'
		const tipe_penggajian = formEl.tipe_penggajian.value; // 'hybrid' | 'gaji_pokok_bulanan' | 'pimpinan'
		const gaji_pokok_bulanan = Number(formEl.gaji_pokok_bulanan.value) || 0;
		const tunjangan_jabatan = Number(formEl.tunjangan_jabatan.value) || 0;
		const keterangan = formEl.keterangan.value.trim();

		if (!nama) {
			Swal.fire('Input Tidak Valid', 'Nama jabatan wajib diisi.', 'warning');
			return;
		}

		let newSettings;
		if (modalJabatan.isEdit) {
			newSettings = {
				...settings,
				daftar_jabatan: (settings.daftar_jabatan || []).map((j) =>
					j.id === modalJabatan.data.id
						? { ...j, nama, kategori, tipe_penggajian, gaji_pokok_bulanan, tunjangan_jabatan, keterangan }
						: j
				),
			};
		} else {
			const id = `jab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
			newSettings = {
				...settings,
				daftar_jabatan: [
					...(settings.daftar_jabatan || []),
					{ id, nama, kategori, tipe_penggajian, gaji_pokok_bulanan, tunjangan_jabatan, keterangan },
				],
			};
		}

		setModalJabatan({ isOpen: false, isEdit: false, data: null });
		await saveSettingsToDB(
			newSettings,
			modalJabatan.isEdit ? `Jabatan "${nama}" berhasil diperbarui!` : `Jabatan "${nama}" berhasil ditambahkan!`
		);
	};

	const handleDeleteJabatan = (id) => {
		Swal.fire({
			title: 'Hapus Jabatan Ini?',
			text: 'Jabatan ini akan dihapus dan pegawai yang memegang jabatan ini akan kehilangan tunjangan/gaji pokok jabatannya.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E11D48',
			cancelButtonColor: '#0D0D0D',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (res) => {
			if (res.isConfirmed) {
				const newMap = { ...settings.user_jabatan_map };
				Object.keys(newMap).forEach((uId) => {
					if (newMap[uId] === id) delete newMap[uId];
				});
				const newSettings = {
					...settings,
					daftar_jabatan: (settings.daftar_jabatan || []).filter((j) => j.id !== id),
					user_jabatan_map: newMap,
				};
				await saveSettingsToDB(newSettings, 'Jabatan berhasil dihapus dari database!');
			}
		});
	};

	const handleAssignPegawaiJabatan = async (userId, jabatanId) => {
		const newMap = { ...settings.user_jabatan_map };
		if (!jabatanId || jabatanId === 'none') {
			delete newMap[userId];
		} else {
			newMap[userId] = jabatanId;
		}
		const newSettings = {
			...settings,
			user_jabatan_map: newMap,
		};
		await saveSettingsToDB(newSettings, 'Penugasan jabatan pegawai berhasil disimpan!');
	};

	if (loading) {
		return (
			<div className='py-16 text-center text-sm font-bold text-gray-500'>
				Memuat data konfigurasi tarif & tunjangan...
			</div>
		);
	}

	return (
		<div className='space-y-6 pb-20'>
			{/* Top Header Bar */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2'>
						<span>⚙️</span>
						<span>Konfigurasi Tarif Bisaroh & Tunjangan</span>
					</h1>
					<p className='text-xs sm:text-sm font-bold text-gray-600 mt-1'>
						Pengaturan tingkatan tarif mengajar (Senior/Junior), tunjangan bulanan/harian, dan potongan tetap.
					</p>
				</div>

				<div className='flex items-center gap-2.5'>
					<div className='px-4 py-2.5 bg-emerald-100 border-2 border-black rounded-xl text-xs font-black uppercase text-emerald-950 shadow-[3px_3px_0px_0px_#0D0D0D] flex items-center gap-2'>
						{saving ? (
							<>
								<span className='animate-spin text-sm'>⏳</span>
								<span>Menyimpan ke Database...</span>
							</>
						) : (
							<>
								<span className='w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-800 inline-block'></span>
								<span>Auto-Save Aktif ke Database</span>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Navigation Tabs */}
			<div className='flex flex-wrap items-center gap-2 bg-yellow-100 p-2 border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#0D0D0D]'>
				{[
					{ id: 'tingkatan', label: '🎓 Tingkatan Guru & Tarif JP', desc: 'Senior, Junior, & Mapping Guru' },
					{ id: 'jabatan', label: '🏛️ Jabatan & Gaji Pokok', desc: 'Struktural Guru & Tendik' },
					{ id: 'tunjangan', label: '💵 Komponen Tunjangan', desc: 'Transport, Wali Kelas, Fungsional' },
					{ id: 'potongan', label: '✂️ Komponen Potongan', desc: 'Infaq, Koperasi, Iuran Tetap' },
					{ id: 'cutoff', label: '📅 Batas Cut-Off', desc: 'Tanggal Penggajian' },
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all border-2 text-left ${
							activeTab === tab.id
								? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_#14B8A6]'
								: 'bg-white text-black border-transparent hover:border-black hover:bg-yellow-200'
						}`}>
						<span className='block text-xs leading-tight'>{tab.label}</span>
						<span className={`block text-[10px] font-normal leading-tight mt-0.5 ${activeTab === tab.id ? 'text-gray-300' : 'text-gray-500'}`}>
							{tab.desc}
						</span>
					</button>
				))}
			</div>

			{/* ============================================================== */}
			{/* TAB 1: TINGKATAN GURU & TARIF JP                              */}
			{/* ============================================================== */}
			{activeTab === 'tingkatan' && (
				<div className='space-y-6'>
					{/* Daftar Tingkatan / Grade */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<h3 className='font-black text-base uppercase text-black'>
									1. Master Kategori & Tingkatan Guru
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Buat kategori tingkatan guru (misal Senior, Madya, Junior, GTY, GTT) beserta tarif per Jam Pelajaran (JP).
								</p>
							</div>

							<button
								onClick={() => setModalTingkatan({ isOpen: true, isEdit: false, data: null })}
								className='px-4 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
								<span>➕</span>
								<span>Tambah Tingkatan Baru</span>
							</button>
						</div>

						{/* Grid Cards of Grades */}
						<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
							{settings.tingkatan_guru.map((t) => {
								const isDefault = settings.default_tingkatan_id === t.id;
								const assignedCount = guruList.filter(
									(g) => (settings.guru_tingkatan_map[g.id_user] || settings.default_tingkatan_id) === t.id
								).length;

								return (
									<div
										key={t.id}
										className={`p-4 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between ${
											isDefault ? 'bg-teal-50 ring-2 ring-teal-500' : 'bg-white'
										}`}>
										<div className='space-y-2'>
											<div className='flex items-center justify-between'>
												<span className='font-black text-sm text-black'>{t.nama}</span>
												{isDefault && (
													<span className='px-2 py-0.5 bg-teal-300 border border-black rounded text-[9px] font-black uppercase'>
														Default
													</span>
												)}
											</div>
											<div>
												<span className='text-2xl font-black font-mono text-emerald-900 block'>
													{formatRupiah(t.tarif_per_jp)}
												</span>
												<span className='text-[10px] font-bold text-gray-500'>per Jam Pelajaran (JP)</span>
											</div>
											<p className='text-[11px] text-gray-600 font-bold'>
												{t.keterangan || 'Tanpa keterangan khusus.'}
											</p>
										</div>

										<div className='pt-3 mt-3 border-t border-black/10 flex items-center justify-between text-xs'>
											<span className='text-[11px] font-bold text-gray-500'>
												👥 {assignedCount} Guru
											</span>
											<div className='flex items-center gap-1.5'>
												{!isDefault && (
													<button
														type='button'
														onClick={() => handleSetDefaultTingkatan(t.id)}
														title='Jadikan tingkatan standar bawaan'
														className='px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-black rounded text-[10px] font-black'>
														Set Default
													</button>
												)}
												<button
													type='button'
													onClick={() => setModalTingkatan({ isOpen: true, isEdit: true, data: t })}
													title='Edit tingkatan ini'
													className='px-2 py-1 bg-yellow-200 hover:bg-yellow-300 border border-black rounded text-[10px] font-black'>
													✏️ Edit
												</button>
												<button
													type='button'
													onClick={() => handleDeleteTingkatan(t.id)}
													title='Hapus tingkatan ini'
													className='px-2 py-1 bg-rose-200 hover:bg-rose-300 border border-black rounded text-[10px] font-black'>
													🗑️
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Mapping Guru ke Tingkatan */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<h3 className='font-black text-base uppercase text-black'>
									2. Penetapan Tingkatan Dewan Guru
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Tentukan tingkatan tarif untuk masing-masing guru. Guru yang belum diatur akan otomatis menggunakan tingkatan default.
								</p>
							</div>

							<div className='w-full sm:w-64'>
								<input
									type='text'
									value={guruSearch}
									onChange={(e) => setGuruSearch(e.target.value)}
									placeholder='Cari nama guru...'
									className='neo-input !py-1.5 text-xs font-bold'
								/>
							</div>
						</div>

						<div className='border-2 border-black rounded-xl overflow-hidden'>
							<table className='w-full text-left border-collapse text-xs font-bold'>
								<thead>
									<tr className='bg-teal-300 border-b-2 border-black font-black uppercase text-black'>
										<th className='px-4 py-3 w-12 text-center'>No</th>
										<th className='px-4 py-3'>Nama Dewan Guru</th>
										<th className='px-4 py-3'>Username</th>
										<th className='px-4 py-3'>Kategori / Tingkatan Saat Ini</th>
										<th className='px-4 py-3 text-right'>Tarif Berlaku</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-black/10'>
									{filteredGuruList.map((guru, idx) => {
										const currentTingkatanId =
											settings.guru_tingkatan_map[guru.id_user] || settings.default_tingkatan_id;
										const currentTingkatan =
											settings.tingkatan_guru.find((t) => t.id === currentTingkatanId) ||
											settings.tingkatan_guru[0];

										return (
											<tr key={guru.id_user} className='hover:bg-yellow-50/50 transition-colors'>
												<td className='px-4 py-3 text-center font-mono text-gray-500'>{idx + 1}</td>
												<td className='px-4 py-3 font-black text-black'>
													{guru.nama_lengkap}
												</td>
												<td className='px-4 py-3 font-mono text-gray-500'>
													@{guru.username}
												</td>
												<td className='px-4 py-3'>
													<select
														value={currentTingkatanId}
														onChange={(e) => handleAssignGuruTingkatan(guru.id_user, e.target.value)}
														className='px-2.5 py-1.5 border-2 border-black rounded-lg bg-white font-black text-xs cursor-pointer shadow-[1px_1px_0px_0px_#0D0D0D]'>
														{settings.tingkatan_guru.map((t) => (
															<option key={t.id} value={t.id}>
																{t.nama} &bull; {formatRupiah(t.tarif_per_jp)}/JP {settings.default_tingkatan_id === t.id ? '(Default)' : ''}
															</option>
														))}
													</select>
												</td>
												<td className='px-4 py-3 text-right font-mono font-black text-emerald-900'>
													{formatRupiah(currentTingkatan?.tarif_per_jp)} / JP
												</td>
											</tr>
										);
									})}
									{filteredGuruList.length === 0 && (
										<tr>
											<td colSpan={5} className='px-4 py-6 text-center text-gray-500'>
												Tidak ada data guru yang cocok.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* TAB: JABATAN STRUKTURAL & GAJI POKOK (GURU & TENDIK)          */}
			{/* ============================================================== */}
			{activeTab === 'jabatan' && (
				<div className='space-y-6'>
					{/* Daftar Master Jabatan */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<div className='flex items-center gap-2'>
									<h3 className='font-black text-base uppercase text-black'>
										1. Master Jabatan, Gaji Pokok & Tunjangan Struktural
									</h3>
									<span className='px-2 py-0.5 bg-indigo-100 border border-indigo-800 text-indigo-950 font-black text-[10px] rounded uppercase'>
										Struktural & Tendik
									</span>
								</div>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Kelola jabatan sekolah (Kepala Sekolah, Wakasek, Kepala Lab, TU, Satpam) beserta Gaji Pokok Bulanan dan Tunjangan Jabatannya.
								</p>
							</div>

							<button
								type='button'
								onClick={() => setModalJabatan({ isOpen: true, isEdit: false, data: null })}
								className='px-4 py-2 bg-indigo-300 hover:bg-indigo-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
								<span>➕</span>
								<span>Tambah Jabatan Baru</span>
							</button>
						</div>

						{/* Grid Cards of Positions */}
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
							{(settings.daftar_jabatan || []).map((j) => {
								const isPimpinan = j.kategori === 'pimpinan';
								const isTendik = j.kategori === 'tendik';
								const isHybrid = j.tipe_penggajian === 'hybrid';
								const assignedCount = users.filter(
									(u) => settings.user_jabatan_map?.[u.id_user] === j.id
								).length;

								return (
									<div
										key={j.id}
										className='p-4 border-2 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col justify-between space-y-3'>
										<div className='space-y-2'>
											<div className='flex items-center gap-1.5 flex-wrap'>
												<span
													className={`px-2 py-0.5 border rounded text-[9px] font-black uppercase ${
														isPimpinan
															? 'bg-purple-100 border-purple-800 text-purple-900'
															: isTendik
															? 'bg-amber-100 border-amber-800 text-amber-900'
															: 'bg-blue-100 border-blue-800 text-blue-900'
													}`}>
													{isPimpinan
														? '👑 Pimpinan'
														: isTendik
														? '💼 Tendik / Non-Guru'
														: '🎓 Guru + Jabatan'}
												</span>
												<span className='px-2 py-0.5 bg-teal-100 border border-teal-800 text-teal-900 rounded text-[9px] font-black uppercase'>
													{isHybrid
														? '⚖️ Honor JP + Tunjangan'
														: j.tipe_penggajian === 'gaji_pokok_bulanan'
														? '💵 Gaji Pokok Bulanan'
														: '🏛️ Pimpinan'}
												</span>
											</div>

											<h4 className='font-black text-sm text-black'>{j.nama}</h4>
											<p className='text-[11px] text-gray-600 font-bold leading-relaxed'>
												{j.keterangan || 'Tanpa catatan tugas khusus.'}
											</p>

											{/* Financial Box */}
											<div className='p-2.5 bg-gray-50 border border-black/20 rounded-lg space-y-1 text-xs font-mono'>
												{j.gaji_pokok_bulanan > 0 && (
													<div className='flex justify-between items-center text-emerald-950 font-bold'>
														<span className='font-sans text-[11px] text-gray-500 font-normal'>Gaji Pokok:</span>
														<span>{formatRupiah(j.gaji_pokok_bulanan)}<span className='text-[10px] text-gray-400 font-normal'>/bln</span></span>
													</div>
												)}
												{j.tunjangan_jabatan > 0 && (
													<div className='flex justify-between items-center text-indigo-950 font-bold'>
														<span className='font-sans text-[11px] text-gray-500 font-normal'>Tunj. Jabatan:</span>
														<span>+{formatRupiah(j.tunjangan_jabatan)}<span className='text-[10px] text-gray-400 font-normal'>/bln</span></span>
													</div>
												)}
												{j.gaji_pokok_bulanan === 0 && j.tunjangan_jabatan === 0 && (
													<span className='text-[10px] text-gray-400 font-sans italic'>Hanya honor jam mengajar (JP riil).</span>
												)}
											</div>
										</div>

										<div className='pt-2.5 border-t border-black/10 flex items-center justify-between text-xs'>
											<span className='text-[11px] font-bold text-gray-600'>
												👥 {assignedCount} Pegawai
											</span>

											<div className='flex items-center gap-1.5'>
												<button
													type='button'
													onClick={() => setModalJabatan({ isOpen: true, isEdit: true, data: j })}
													title='Edit rincian jabatan'
													className='px-2 py-1 bg-yellow-200 hover:bg-yellow-300 border border-black rounded text-[10px] font-black'>
													✏️ Edit
												</button>
												<button
													type='button'
													onClick={() => handleDeleteJabatan(j.id)}
													title='Hapus jabatan ini'
													className='px-2 py-1 bg-rose-200 hover:bg-rose-300 border border-black rounded text-[10px] font-black'>
													🗑️
												</button>
											</div>
										</div>
									</div>
								);
							})}

							{(!settings.daftar_jabatan || settings.daftar_jabatan.length === 0) && (
								<div className='col-span-full p-8 text-center border-2 border-dashed border-gray-300 rounded-xl'>
									<p className='text-xs font-bold text-gray-500'>
										Belum ada jabatan struktural. Klik &ldquo;Tambah Jabatan Baru&rdquo; untuk menambahkan.
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Penugasan Jabatan ke Pegawai */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<h3 className='font-black text-base uppercase text-black'>
									2. Penetapan Jabatan Pegawai & Dewan Guru
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Tentukan jabatan resmi untuk dewan guru, pimpinan, maupun tenaga kependidikan (TU/Satpam).
								</p>
							</div>

							<div className='w-full sm:w-72'>
								<input
									type='text'
									value={pegawaiSearch}
									onChange={(e) => setPegawaiSearch(e.target.value)}
									placeholder='Cari nama pegawai, username, role...'
									className='neo-input !py-1.5 text-xs font-bold'
								/>
							</div>
						</div>

						{/* Table Assignment */}
						<div className='overflow-x-auto border-2 border-black rounded-xl'>
							<table className='w-full text-left border-collapse text-xs font-bold'>
								<thead>
									<tr className='bg-indigo-200 border-b-2 border-black uppercase text-black'>
										<th className='px-4 py-3 w-12 text-center'>No</th>
										<th className='px-4 py-3'>Nama Pegawai</th>
										<th className='px-4 py-3'>Role Sistem</th>
										<th className='px-4 py-3'>Jabatan Struktural Saat Ini</th>
										<th className='px-4 py-3 text-right'>Hak Kompensasi Jabatan</th>
									</tr>
								</thead>
								<tbody className='divide-y-2 divide-black/10'>
									{filteredPegawaiList.map((pegawai, idx) => {
										const currentJabatanId = settings.user_jabatan_map?.[pegawai.id_user] || '';
										const currentJabatan = (settings.daftar_jabatan || []).find((j) => j.id === currentJabatanId);

										return (
											<tr key={pegawai.id_user} className='hover:bg-indigo-50/50 transition-colors'>
												<td className='px-4 py-3 text-center font-mono text-gray-500'>{idx + 1}</td>
												<td className='px-4 py-3'>
													<span className='font-black text-black block'>{pegawai.nama_lengkap}</span>
													<span className='text-[10px] font-mono text-gray-500'>@{pegawai.username}</span>
												</td>
												<td className='px-4 py-3'>
													<span className='px-2 py-0.5 bg-gray-100 border border-black/40 rounded text-[10px] font-black uppercase'>
														{pegawai.role}
													</span>
												</td>
												<td className='px-4 py-3'>
													<select
														value={currentJabatanId || 'none'}
														onChange={(e) => handleAssignPegawaiJabatan(pegawai.id_user, e.target.value)}
														className='px-2.5 py-1.5 border-2 border-black rounded-lg bg-white font-black text-xs cursor-pointer shadow-[1px_1px_0px_0px_#0D0D0D] max-w-xs truncate'>
														<option value='none'>-- Tanpa Jabatan Tambahan --</option>
														{(settings.daftar_jabatan || []).map((j) => (
															<option key={j.id} value={j.id}>
																{j.nama} ({j.kategori === 'pimpinan' ? 'Pimpinan' : j.kategori === 'tendik' ? 'Tendik' : 'Guru'})
															</option>
														))}
													</select>
												</td>
												<td className='px-4 py-3 text-right font-mono font-black'>
													{currentJabatan ? (
														<div className='space-y-0.5'>
															{currentJabatan.gaji_pokok_bulanan > 0 && (
																<span className='text-emerald-900 block text-xs'>
																	Gapok: {formatRupiah(currentJabatan.gaji_pokok_bulanan)}
																</span>
															)}
															{currentJabatan.tunjangan_jabatan > 0 && (
																<span className='text-indigo-900 block text-[11px]'>
																	Tunj: +{formatRupiah(currentJabatan.tunjangan_jabatan)}
																</span>
															)}
															{currentJabatan.gaji_pokok_bulanan === 0 && currentJabatan.tunjangan_jabatan === 0 && (
																<span className='text-gray-400 font-normal'>-</span>
															)}
														</div>
													) : (
														<span className='text-gray-400 font-normal'>-</span>
													)}
												</td>
											</tr>
										);
									})}
									{filteredPegawaiList.length === 0 && (
										<tr>
											<td colSpan={5} className='px-4 py-6 text-center text-gray-500'>
												Tidak ada data pegawai yang cocok dengan pencarian.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* TAB 2: KOMPONEN TUNJANGAN POKOK & DINAMIS                     */}
			{/* ============================================================== */}
			{activeTab === 'tunjangan' && (
				<div className='space-y-6'>
					{/* Tunjangan Pokok Bawaan Sistem (CRUD) */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<div className='flex items-center gap-2'>
									<h3 className='font-black text-base uppercase text-black'>
										1. Komponen Tunjangan Pokok Sistem
									</h3>
									<span className='px-2 py-0.5 bg-emerald-100 border border-emerald-800 text-emerald-950 font-black text-[10px] rounded uppercase'>
										CRUD Aktif
									</span>
								</div>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Tunjangan pokok dasar institusi (Wali Kelas, Uang Kehadiran Harian, Gaji Pokok, dll). Dapat ditambah, diedit nominal/syaratnya, dinonaktifkan, atau dihapus.
								</p>
							</div>

							<button
								type='button'
								onClick={() => setModalTunjanganPokok({ isOpen: true, isEdit: false, data: null })}
								className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
								<span>➕</span>
								<span>Tambah Tunjangan Pokok</span>
							</button>
						</div>

						{/* List of Tunjangan Pokok Items */}
						<div className='space-y-3'>
							{(settings.tunjangan_pokok || []).map((t) => {
								const isWali = t.kategori === 'wali_kelas';
								const isHadir = t.kategori === 'kehadiran';
								const isAktif = t.aktif !== false;

								return (
									<div
										key={t.id}
										className={`p-4 border-2 border-black rounded-xl transition-all shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
											isAktif ? 'bg-white' : 'bg-gray-100 opacity-75'
										}`}>
										<div className='space-y-1.5'>
											<div className='flex items-center gap-2 flex-wrap'>
												<span className='font-black text-sm text-black'>{t.nama}</span>
												<span
													className={`px-2 py-0.5 border rounded text-[9px] font-black uppercase ${
														isWali
															? 'bg-emerald-100 border-emerald-800 text-emerald-900'
															: isHadir
															? 'bg-amber-100 border-amber-800 text-amber-900'
															: 'bg-teal-100 border-teal-800 text-teal-900'
													}`}>
													{isWali
														? '🏫 Wali Kelas Otomatis'
														: isHadir
														? '📅 Kehadiran Jurnal'
														: '👥 Dewan Guru'}
												</span>
												<span className='px-2 py-0.5 bg-blue-100 border border-blue-800 text-blue-900 rounded text-[9px] font-black uppercase'>
													{t.tipe === 'per_bulan'
														? 'Bulanan Tetap'
														: t.tipe === 'per_hari'
														? 'Per Hari Hadir'
														: 'Per Jam (JP)'}
												</span>
												<span className='px-2 py-0.5 bg-yellow-100 border border-yellow-800 text-yellow-900 rounded text-[9px] font-black uppercase'>
													{t.penerima === 'wali_kelas'
														? 'Wali Kelas Saja'
														: t.penerima === 'semua'
														? 'Semua Guru'
														: `${(t.guru_ids || []).length} Guru Terpilih`}
												</span>
												<span
													className={`px-2 py-0.5 border rounded text-[9px] font-black uppercase ${
														isAktif
															? 'bg-emerald-200 border-emerald-700 text-emerald-950'
															: 'bg-gray-200 border-gray-500 text-gray-700'
													}`}>
													{isAktif ? '✓ Aktif' : '✕ Nonaktif'}
												</span>
											</div>
											<p className='text-xs font-bold text-gray-600'>
												{t.keterangan || (isWali ? 'Tunjangan otomatis bagi wali kelas' : isHadir ? 'Dikalikan jumlah hari hadir mengajar' : 'Tunjangan pokok institusi')}
											</p>
										</div>

										<div className='flex items-center justify-between sm:justify-end gap-3 shrink-0'>
											<div className='text-right'>
												<span className={`text-lg font-black font-mono block ${isAktif ? 'text-emerald-950' : 'text-gray-500 line-through'}`}>
													{formatRupiah(t.nominal)}
												</span>
												<span className='text-[10px] font-bold text-gray-500'>
													{t.tipe === 'per_bulan' ? '/bulan' : t.tipe === 'per_hari' ? '/hari hadir' : '/JP'}
												</span>
											</div>

											<div className='flex items-center gap-1.5'>
												<button
													type='button'
													onClick={() => handleToggleAktifTunjanganPokok(t.id)}
													title={isAktif ? 'Nonaktifkan tunjangan' : 'Aktifkan tunjangan'}
													className={`px-2 py-1 border border-black rounded-lg text-xs font-black transition-colors ${
														isAktif ? 'bg-gray-200 hover:bg-gray-300' : 'bg-emerald-300 hover:bg-emerald-400'
													}`}>
													{isAktif ? '⏸️ Nonaktifkan' : '▶️ Aktifkan'}
												</button>
												<button
													type='button'
													onClick={() => setModalTunjanganPokok({ isOpen: true, isEdit: true, data: t })}
													className='px-2.5 py-1 bg-yellow-200 hover:bg-yellow-300 border border-black rounded-lg text-xs font-black'>
													✏️ Edit
												</button>
												<button
													type='button'
													onClick={() => handleDeleteTunjanganPokok(t.id)}
													className='px-2.5 py-1 bg-rose-200 hover:bg-rose-300 border border-black rounded-lg text-xs font-black'>
													🗑️ Hapus
												</button>
											</div>
										</div>
									</div>
								);
							})}

							{(!settings.tunjangan_pokok || settings.tunjangan_pokok.length === 0) && (
								<div className='p-6 text-center border-2 border-dashed border-gray-300 rounded-xl'>
									<p className='text-xs font-bold text-gray-500'>
										Belum ada komponen tunjangan pokok. Klik &ldquo;Tambah Tunjangan Pokok&rdquo; untuk menambahkan.
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Tunjangan Tambahan Dinamis */}
					<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
							<div>
								<h3 className='font-black text-base uppercase text-black'>
									2. Komponen Tunjangan Tambahan (Fleksibel)
								</h3>
								<p className='text-xs font-bold text-gray-500 mt-0.5'>
									Tambahkan komponen tunjangan lain seperti uang transport bulanan, tunjangan masa kerja, pembina ekskul, dll.
								</p>
							</div>

							<button
								onClick={() => setModalTunjangan({ isOpen: true, isEdit: false, data: null })}
								className='px-4 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
								<span>➕</span>
								<span>Tambah Tunjangan Baru</span>
							</button>
						</div>

						{/* List of Dynamic Allowances */}
						<div className='space-y-3'>
							{settings.tunjangan_tambahan.map((t) => (
								<div
									key={t.id}
									className='p-4 border-2 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
									<div className='space-y-1'>
										<div className='flex items-center gap-2'>
											<span className='font-black text-sm text-black'>{t.nama}</span>
											<span className='px-2 py-0.2 bg-teal-100 border border-teal-800 text-teal-900 rounded text-[9px] font-black uppercase'>
												{t.tipe === 'per_bulan' ? 'Bulanan Tetap' : t.tipe === 'per_hari' ? 'Per Hari Hadir' : 'Per Jam (JP)'}
											</span>
											<span className='px-2 py-0.2 bg-yellow-100 border border-yellow-800 text-yellow-900 rounded text-[9px] font-black uppercase'>
												{t.penerima === 'semua' ? 'Semua Guru' : `${(t.guru_ids || []).length} Guru Terpilih`}
											</span>
										</div>
										<p className='text-xs font-bold text-gray-600'>{t.keterangan || 'Tanpa keterangan khusus.'}</p>
									</div>

									<div className='flex items-center justify-between sm:justify-end gap-4'>
										<div className='text-right'>
											<span className='text-lg font-black font-mono text-emerald-950 block'>
												{formatRupiah(t.nominal)}
											</span>
											<span className='text-[10px] font-bold text-gray-500'>
												{t.tipe === 'per_bulan' ? '/bulan' : t.tipe === 'per_hari' ? '/hari' : '/JP'}
											</span>
										</div>

										<div className='flex items-center gap-1.5'>
											<button
												onClick={() => setModalTunjangan({ isOpen: true, isEdit: true, data: t })}
												className='px-2.5 py-1 bg-yellow-200 hover:bg-yellow-300 border border-black rounded-lg text-xs font-black'>
												✏️ Edit
											</button>
											<button
												onClick={() => handleDeleteTunjangan(t.id)}
												className='px-2.5 py-1 bg-rose-200 hover:bg-rose-300 border border-black rounded-lg text-xs font-black'>
												🗑️
											</button>
										</div>
									</div>
								</div>
							))}

							{settings.tunjangan_tambahan.length === 0 && (
								<p className='text-center py-8 text-xs font-bold text-gray-500'>
									Belum ada komponen tunjangan tambahan yang dibuat.
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* TAB 3: KOMPONEN POTONGAN TETAP BULANAN                        */}
			{/* ============================================================== */}
			{activeTab === 'potongan' && (
				<div className='bg-white border-2 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-4'>
						<div>
							<h3 className='font-black text-base uppercase text-black'>
								Komponen Potongan Tetap Bulanan
							</h3>
							<p className='text-xs font-bold text-gray-500 mt-0.5'>
								Potongan otomatis yang dipotongkan setiap periode penggajian (misal: infaq yatim/sosial, iuran koperasi, kas dewan guru).
							</p>
						</div>

						<button
							onClick={() => setModalPotongan({ isOpen: true, isEdit: false, data: null })}
							className='px-4 py-2 bg-rose-300 hover:bg-rose-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] flex items-center gap-1.5 shrink-0'>
							<span>➕</span>
							<span>Tambah Potongan Baru</span>
						</button>
					</div>

					<div className='space-y-3'>
						{settings.potongan_tetap.map((p) => (
							<div
								key={p.id}
								className='p-4 border-2 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_#0D0D0D] flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
								<div className='space-y-1'>
									<div className='flex items-center gap-2'>
										<span className='font-black text-sm text-black'>{p.nama}</span>
										<span className='px-2 py-0.2 bg-rose-100 border border-rose-800 text-rose-900 rounded text-[9px] font-black uppercase'>
											{p.penerima === 'semua' ? 'Semua Guru' : `${(p.guru_ids || []).length} Guru Terpilih`}
										</span>
									</div>
									<p className='text-xs font-bold text-gray-600'>{p.keterangan || 'Tanpa keterangan khusus.'}</p>
								</div>

								<div className='flex items-center justify-between sm:justify-end gap-4'>
									<div className='text-right'>
										<span className='text-lg font-black font-mono text-rose-900 block'>
											-{formatRupiah(p.nominal)}
										</span>
										<span className='text-[10px] font-bold text-gray-500'>per bulan</span>
									</div>

									<div className='flex items-center gap-1.5'>
										<button
											onClick={() => setModalPotongan({ isOpen: true, isEdit: true, data: p })}
											className='px-2.5 py-1 bg-yellow-200 hover:bg-yellow-300 border border-black rounded-lg text-xs font-black'>
											✏️ Edit
										</button>
										<button
											onClick={() => handleDeletePotongan(p.id)}
											className='px-2.5 py-1 bg-rose-200 hover:bg-rose-300 border border-black rounded-lg text-xs font-black'>
											🗑️
										</button>
									</div>
								</div>
							</div>
						))}

						{settings.potongan_tetap.length === 0 && (
							<p className='text-center py-8 text-xs font-bold text-gray-500'>
								Belum ada komponen potongan tetap bulanan.
							</p>
						)}
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* TAB 4: BATAS CUT-OFF BULANAN                                   */}
			{/* ============================================================== */}
			{activeTab === 'cutoff' && (
				<div className='max-w-2xl bg-white border-2 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_#0D0D0D] space-y-4'>
					<div>
						<h3 className='font-black text-base uppercase text-black'>
							Kalender & Batas Cut-Off Penggajian
						</h3>
						<p className='text-xs font-bold text-gray-500 mt-0.5'>
							Tentukan tanggal penutupan buku penggajian bulanan sekolah.
						</p>
					</div>

					<div className='p-4 border-2 border-black rounded-xl bg-teal-50 space-y-3'>
						<label className='block text-xs font-black uppercase text-black'>
							Tanggal Cut-Off Default Setiap Bulan (1 - 31)
						</label>
						<div className='flex items-center gap-3 flex-wrap'>
							<input
								type='number'
								min='1'
								max='31'
								value={settings.cut_off_tanggal}
								onChange={(e) =>
									setSettings({
										...settings,
										cut_off_tanggal: Math.min(31, Math.max(1, Number(e.target.value) || 25)),
									})
								}
								className='neo-input !py-2 font-mono text-base font-bold w-32'
							/>
							<button
								type='button'
								onClick={() => saveSettingsToDB(settings, 'Tanggal cut-off berhasil disimpan ke database!')}
								disabled={saving}
								className='px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5'>
								<span>💾</span>
								<span>Simpan Tanggal Cut-Off</span>
							</button>
						</div>
						<p className='text-xs font-bold text-gray-700'>
							💡 Contoh: Jika diset ke tanggal <strong>{settings.cut_off_tanggal}</strong>, maka periode penggajian berjalan otomatis dihitung dari <strong>tanggal {settings.cut_off_tanggal + 1} bulan sebelumnya</strong> sampai dengan <strong>tanggal {settings.cut_off_tanggal} bulan ini</strong>.
						</p>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL: TAMBAH / EDIT TINGKATAN GURU                            */}
			{/* ============================================================== */}
			{modalTingkatan.isOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-md w-full shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-yellow-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>
								{modalTingkatan.isEdit ? 'Edit Tingkatan Guru' : 'Tambah Tingkatan Guru Baru'}
							</h3>
							<button
								onClick={() => setModalTingkatan({ isOpen: false, isEdit: false, data: null })}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveTingkatan} className='p-5 space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nama Tingkatan <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nama'
									type='text'
									required
									defaultValue={modalTingkatan.data?.nama || ''}
									placeholder='Contoh: Guru Senior, GTY, Guru Madya'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Tarif Dasar per Jam Pelajaran (JP) <span className='text-rose-600'>*</span>
								</label>
								<div className='relative'>
									<span className='absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-xs'>
										Rp
									</span>
									<input
										name='tarif_per_jp'
										type='number'
										min='1000'
										step='1000'
										required
										defaultValue={modalTingkatan.data?.tarif_per_jp || 40000}
										placeholder='40000'
										className='neo-input !pl-9 !py-2 font-mono text-xs font-bold'
									/>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Keterangan / Syarat
								</label>
								<input
									name='keterangan'
									type='text'
									defaultValue={modalTingkatan.data?.keterangan || ''}
									placeholder='Contoh: Masa kerja > 5 tahun'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='pt-3 border-t border-black/10 flex justify-end gap-2'>
								<button
									type='button'
									onClick={() => setModalTingkatan({ isOpen: false, isEdit: false, data: null })}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-black rounded-xl text-xs font-black uppercase'>
									Batal
								</button>
								<button
									type='submit'
									className='px-5 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
									Simpan Tingkatan
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL: TAMBAH / EDIT TUNJANGAN DINAMIS                         */}
			{/* ============================================================== */}
			{modalTunjangan.isOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-emerald-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>
								{modalTunjangan.isEdit ? 'Edit Komponen Tunjangan' : 'Tambah Komponen Tunjangan Baru'}
							</h3>
							<button
								onClick={() => setModalTunjangan({ isOpen: false, isEdit: false, data: null })}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveTunjangan} className='p-5 overflow-y-auto space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nama Tunjangan <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nama'
									type='text'
									required
									defaultValue={modalTunjangan.data?.nama || ''}
									placeholder='Contoh: Uang Transport Bulanan, Tunjangan Masa Kerja'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Sistem Perhitungan <span className='text-rose-600'>*</span>
									</label>
									<select
										name='tipe'
										defaultValue={modalTunjangan.data?.tipe || 'per_bulan'}
										className='neo-input !py-2 text-xs font-bold bg-white'>
										<option value='per_bulan'>Per Bulan (Tetap)</option>
										<option value='per_hari'>Per Hari Hadir KBM</option>
										<option value='per_jp'>Per Jam Mengajar (JP)</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Nominal (Rp) <span className='text-rose-600'>*</span>
									</label>
									<input
										name='nominal'
										type='number'
										min='1000'
										step='1000'
										required
										defaultValue={modalTunjangan.data?.nominal || 200000}
										placeholder='200000'
										className='neo-input !py-2 font-mono text-xs font-bold'
									/>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Sasaran Penerima <span className='text-rose-600'>*</span>
								</label>
								<select
									name='penerima'
									id='select-penerima-tunj'
									defaultValue={modalTunjangan.data?.penerima || 'semua'}
									onChange={(e) => {
										const container = document.getElementById('target-gurus-box');
										if (container) {
											container.style.display = e.target.value === 'terpilih' ? 'block' : 'none';
										}
									}}
									className='neo-input !py-2 text-xs font-bold bg-white'>
									<option value='semua'>Semua Dewan Guru</option>
									<option value='terpilih'>Hanya Guru Tertentu Saja</option>
								</select>
							</div>

							{/* Checklist Guru Jika Terpilih */}
							<div
								id='target-gurus-box'
								style={{ display: modalTunjangan.data?.penerima === 'terpilih' ? 'block' : 'none' }}
								className='space-y-2 border-2 border-black rounded-xl p-3 bg-gray-50 max-h-40 overflow-y-auto'>
								<p className='text-[10px] font-black uppercase text-gray-500'>
									Centang guru yang berhak menerima:
								</p>
								{guruList.map((g) => {
									const isChecked = (modalTunjangan.data?.guru_ids || []).includes(g.id_user);
									return (
										<label key={g.id_user} className='flex items-center gap-2 text-xs font-bold cursor-pointer'>
											<input
												type='checkbox'
												name='target_guru'
												value={g.id_user}
												defaultChecked={isChecked}
												className='rounded border-black'
											/>
											<span>{g.nama_lengkap} (@{g.username})</span>
										</label>
									);
								})}
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Keterangan
								</label>
								<input
									name='keterangan'
									type='text'
									defaultValue={modalTunjangan.data?.keterangan || ''}
									placeholder='Catatan atau alasan pemberian tunjangan'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='pt-3 border-t border-black/10 flex justify-end gap-2'>
								<button
									type='button'
									onClick={() => setModalTunjangan({ isOpen: false, isEdit: false, data: null })}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-black rounded-xl text-xs font-black uppercase'>
									Batal
								</button>
								<button
									type='submit'
									className='px-5 py-2 bg-emerald-400 hover:bg-emerald-500 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
									Simpan Tunjangan
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL: TAMBAH / EDIT POTONGAN TETAP                            */}
			{/* ============================================================== */}
			{modalPotongan.isOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-rose-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>
								{modalPotongan.isEdit ? 'Edit Komponen Potongan' : 'Tambah Komponen Potongan Baru'}
							</h3>
							<button
								onClick={() => setModalPotongan({ isOpen: false, isEdit: false, data: null })}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSavePotongan} className='p-5 overflow-y-auto space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nama Potongan <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nama'
									type='text'
									required
									defaultValue={modalPotongan.data?.nama || ''}
									placeholder='Contoh: Infaq Sosial, Iuran Koperasi Guru'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nominal Potongan per Bulan (Rp) <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nominal'
									type='number'
									min='1000'
									step='1000'
									required
									defaultValue={modalPotongan.data?.nominal || 25000}
									placeholder='25000'
									className='neo-input !py-2 font-mono text-xs font-bold'
								/>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Sasaran Penerima Potongan <span className='text-rose-600'>*</span>
								</label>
								<select
									name='penerima'
									defaultValue={modalPotongan.data?.penerima || 'semua'}
									onChange={(e) => {
										const container = document.getElementById('target-gurus-box-pot');
										if (container) {
											container.style.display = e.target.value === 'terpilih' ? 'block' : 'none';
										}
									}}
									className='neo-input !py-2 text-xs font-bold bg-white'>
									<option value='semua'>Semua Dewan Guru</option>
									<option value='terpilih'>Hanya Guru Tertentu Saja</option>
								</select>
							</div>

							<div
								id='target-gurus-box-pot'
								style={{ display: modalPotongan.data?.penerima === 'terpilih' ? 'block' : 'none' }}
								className='space-y-2 border-2 border-black rounded-xl p-3 bg-gray-50 max-h-40 overflow-y-auto'>
								<p className='text-[10px] font-black uppercase text-gray-500'>
									Centang guru yang dikenakan potongan:
								</p>
								{guruList.map((g) => {
									const isChecked = (modalPotongan.data?.guru_ids || []).includes(g.id_user);
									return (
										<label key={g.id_user} className='flex items-center gap-2 text-xs font-bold cursor-pointer'>
											<input
												type='checkbox'
												name='target_guru_pot'
												value={g.id_user}
												defaultChecked={isChecked}
												className='rounded border-black'
											/>
											<span>{g.nama_lengkap} (@{g.username})</span>
										</label>
									);
								})}
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Keterangan
								</label>
								<input
									name='keterangan'
									type='text'
									defaultValue={modalPotongan.data?.keterangan || ''}
									placeholder='Catatan peruntukan potongan'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='pt-3 border-t border-black/10 flex justify-end gap-2'>
								<button
									type='button'
									onClick={() => setModalPotongan({ isOpen: false, isEdit: false, data: null })}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-black rounded-xl text-xs font-black uppercase'>
									Batal
								</button>
								<button
									type='submit'
									className='px-5 py-2 bg-rose-300 hover:bg-rose-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
									Simpan Potongan
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL: TAMBAH / EDIT TUNJANGAN POKOK (CRUD)                    */}
			{/* ============================================================== */}
			{modalTunjanganPokok.isOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-teal-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>
								{modalTunjanganPokok.isEdit ? 'Edit Tunjangan Pokok' : 'Tambah Tunjangan Pokok Baru'}
							</h3>
							<button
								onClick={() => setModalTunjanganPokok({ isOpen: false, isEdit: false, data: null })}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveTunjanganPokok} className='p-5 overflow-y-auto space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nama Tunjangan Pokok <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nama'
									type='text'
									required
									defaultValue={modalTunjanganPokok.data?.nama || ''}
									placeholder='Contoh: Tunjangan Wali Kelas, Uang Kehadiran Harian, Gaji Pokok Yayasan'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Kategori Peruntukan <span className='text-rose-600'>*</span>
									</label>
									<select
										name='kategori'
										id='select-kategori-pokok'
										defaultValue={modalTunjanganPokok.data?.kategori || 'umum'}
										onChange={(e) => {
											const val = e.target.value;
											const penerimaBox = document.getElementById('box-penerima-pokok');
											const targetBox = document.getElementById('target-gurus-box-pokok');
											if (penerimaBox) {
												penerimaBox.style.display = val === 'wali_kelas' ? 'none' : 'block';
											}
											if (targetBox && val === 'wali_kelas') {
												targetBox.style.display = 'none';
											}
										}}
										className='neo-input !py-2 text-xs font-bold bg-white'>
										<option value='wali_kelas'>Khusus Wali Kelas (Otomatis Rombel)</option>
										<option value='kehadiran'>Berbasis Presensi Jurnal (Kehadiran)</option>
										<option value='umum'>Umum Dewan Guru / Tetap</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Sistem Perhitungan <span className='text-rose-600'>*</span>
									</label>
									<select
										name='tipe'
										defaultValue={modalTunjanganPokok.data?.tipe || (modalTunjanganPokok.data?.kategori === 'kehadiran' ? 'per_hari' : 'per_bulan')}
										className='neo-input !py-2 text-xs font-bold bg-white'>
										<option value='per_bulan'>Per Bulan (Tetap)</option>
										<option value='per_hari'>Per Hari Hadir KBM</option>
										<option value='per_jp'>Per Jam Mengajar (JP)</option>
									</select>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nominal Tunjangan (Rp) <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nominal'
									type='number'
									min='0'
									step='1000'
									required
									defaultValue={modalTunjanganPokok.data?.nominal ?? 100000}
									placeholder='100000'
									className='neo-input !py-2 font-mono text-xs font-bold'
								/>
							</div>

							<div
								id='box-penerima-pokok'
								style={{ display: modalTunjanganPokok.data?.kategori === 'wali_kelas' ? 'none' : 'block' }}>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Sasaran Penerima <span className='text-rose-600'>*</span>
								</label>
								<select
									name='penerima'
									defaultValue={modalTunjanganPokok.data?.penerima || 'semua'}
									onChange={(e) => {
										const container = document.getElementById('target-gurus-box-pokok');
										if (container) {
											container.style.display = e.target.value === 'terpilih' ? 'block' : 'none';
										}
									}}
									className='neo-input !py-2 text-xs font-bold bg-white'>
									<option value='semua'>Semua Dewan Guru</option>
									<option value='terpilih'>Hanya Guru Tertentu Saja</option>
								</select>
							</div>

							{/* Checklist Guru Jika Terpilih */}
							<div
								id='target-gurus-box-pokok'
								style={{ display: modalTunjanganPokok.data?.penerima === 'terpilih' ? 'block' : 'none' }}
								className='space-y-2 border-2 border-black rounded-xl p-3 bg-gray-50 max-h-40 overflow-y-auto'>
								<p className='text-[10px] font-black uppercase text-gray-500'>
									Centang guru yang berhak menerima:
								</p>
								{guruList.map((g) => {
									const isChecked = (modalTunjanganPokok.data?.guru_ids || []).includes(g.id_user);
									return (
										<label key={g.id_user} className='flex items-center gap-2 text-xs font-bold cursor-pointer'>
											<input
												type='checkbox'
												name='target_guru_pokok'
												value={g.id_user}
												defaultChecked={isChecked}
												className='rounded border-black'
											/>
											<span>{g.nama_lengkap} (@{g.username})</span>
										</label>
									);
								})}
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Keterangan / Dasar Kebijakan
								</label>
								<input
									name='keterangan'
									type='text'
									defaultValue={modalTunjanganPokok.data?.keterangan || ''}
									placeholder='Catatan syarat atau dasar SK'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='flex items-center gap-2 p-3 bg-yellow-50 border border-black rounded-xl'>
								<input
									type='checkbox'
									id='cb-aktif-pokok'
									name='aktif'
									defaultChecked={modalTunjanganPokok.data?.aktif !== false}
									className='w-4 h-4 rounded border-black'
								/>
								<label htmlFor='cb-aktif-pokok' className='text-xs font-black text-black cursor-pointer'>
									Aktifkan komponen tunjangan pokok ini dalam perhitungan bisaroh
								</label>
							</div>

							<div className='pt-3 border-t border-black/10 flex justify-end gap-2'>
								<button
									type='button'
									onClick={() => setModalTunjanganPokok({ isOpen: false, isEdit: false, data: null })}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-black rounded-xl text-xs font-black uppercase'>
									Batal
								</button>
								<button
									type='submit'
									className='px-5 py-2 bg-teal-300 hover:bg-teal-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
									Simpan Tunjangan Pokok
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL: TAMBAH / EDIT JABATAN & GAJI POKOK (CRUD)               */}
			{/* ============================================================== */}
			{modalJabatan.isOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
					<div className='bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#0D0D0D] overflow-hidden'>
						<div className='p-4 bg-indigo-300 border-b-2 border-black flex items-center justify-between'>
							<h3 className='font-black text-sm uppercase text-black'>
								{modalJabatan.isEdit ? 'Edit Jabatan Struktural' : 'Tambah Jabatan Struktural Baru'}
							</h3>
							<button
								type='button'
								onClick={() => setModalJabatan({ isOpen: false, isEdit: false, data: null })}
								className='w-7 h-7 bg-white border border-black rounded-lg flex items-center justify-center font-black text-xs hover:bg-rose-300'>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveJabatan} className='p-5 overflow-y-auto space-y-4'>
							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Nama Jabatan <span className='text-rose-600'>*</span>
								</label>
								<input
									name='nama'
									type='text'
									required
									defaultValue={modalJabatan.data?.nama || ''}
									placeholder='Contoh: Wakasek Kurikulum, Kepala Tata Usaha, Satpam'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Kategori Pegawai <span className='text-rose-600'>*</span>
									</label>
									<select
										name='kategori'
										defaultValue={modalJabatan.data?.kategori || 'pendidik_struktural'}
										className='neo-input !py-2 text-xs font-bold bg-white'>
										<option value='pendidik_struktural'>🎓 Pendidik (Guru + Jabatan)</option>
										<option value='tendik'>💼 Tenaga Kependidikan (Non-Guru)</option>
										<option value='pimpinan'>👑 Pimpinan (Kepala Sekolah)</option>
									</select>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Sistem Penggajian <span className='text-rose-600'>*</span>
									</label>
									<select
										name='tipe_penggajian'
										defaultValue={modalJabatan.data?.tipe_penggajian || 'hybrid'}
										className='neo-input !py-2 text-xs font-bold bg-white'>
										<option value='hybrid'>⚖️ Hybrid (Honor JP + Tunjangan)</option>
										<option value='gaji_pokok_bulanan'>💵 Gaji Pokok Bulanan Murni</option>
										<option value='pimpinan'>🏛️ Pimpinan (Gaji + Tunjangan)</option>
									</select>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Gaji Pokok Bulanan (Rp)
									</label>
									<input
										name='gaji_pokok_bulanan'
										type='number'
										min='0'
										step='50000'
										defaultValue={modalJabatan.data?.gaji_pokok_bulanan || 0}
										placeholder='0'
										className='neo-input !py-2 font-mono text-xs font-bold'
									/>
									<span className='text-[10px] text-gray-500 font-bold block mt-0.5'>
										Diisi untuk staf TU/Satpam/Pimpinan.
									</span>
								</div>

								<div>
									<label className='block text-xs font-black uppercase text-black mb-1'>
										Tunjangan Jabatan (Rp)
									</label>
									<input
										name='tunjangan_jabatan'
										type='number'
										min='0'
										step='25000'
										defaultValue={modalJabatan.data?.tunjangan_jabatan || 0}
										placeholder='0'
										className='neo-input !py-2 font-mono text-xs font-bold'
									/>
									<span className='text-[10px] text-gray-500 font-bold block mt-0.5'>
										Tunjangan kehormatan tugas tambahan.
									</span>
								</div>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Uraian Tugas / Keterangan
								</label>
								<input
									name='keterangan'
									type='text'
									defaultValue={modalJabatan.data?.keterangan || ''}
									placeholder='Catatan tanggung jawab atau dasar SK tugas'
									className='neo-input !py-2 text-xs font-bold'
								/>
							</div>

							<div className='pt-3 border-t border-black/10 flex justify-end gap-2'>
								<button
									type='button'
									onClick={() => setModalJabatan({ isOpen: false, isEdit: false, data: null })}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-black rounded-xl text-xs font-black uppercase'>
									Batal
								</button>
								<button
									type='submit'
									className='px-5 py-2 bg-indigo-300 hover:bg-indigo-400 border-2 border-black rounded-xl text-xs font-black uppercase shadow-[2px_2px_0px_0px_#0D0D0D]'>
									Simpan Jabatan
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
