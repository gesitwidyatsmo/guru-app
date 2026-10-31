'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Swal from 'sweetalert2';
import Loader from '../../../components/loading';
import { createClient } from '@/utils/supabase/client';
import { getTodayDateString } from '@/lib/dateUtils';
import {
	getTimeWIB,
	calculateDurationMinutes,
	formatDurationString,
	getKBMStatusBadge,
	determineKBMStatus,
	getExpectedScheduleTimes,
} from '@/lib/kbmRealtimeUtils';
import { findConflictingSession } from '@/lib/absensiUtils';

export default function JurnalKelasPage() {
	const router = useRouter();
	const params = useParams();
	const classId = params.id;

	// --- STATE MANAGEMENT ---
	const [kelasInfo, setKelasInfo] = useState(null);
	const [journals, setJournals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');

	const [userRole, setUserRole] = useState('');
	const [userId, setUserId] = useState('');

	// State Form Modal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);

	// State Deteksi Konflik Jam Mengajar (Tingkat Kelas - Opsi 1)
	const [existingJournalsToday, setExistingJournalsToday] = useState([]);
	const [loadingConflictCheck, setLoadingConflictCheck] = useState(false);

	// Data Master
	const [mapelList, setMapelList] = useState([]);

	const METODE_OPTIONS = [
		{ name: 'Ceramah', icon: '🗣️' },
		{ name: 'Diskusi', icon: '💬' },
		{ name: 'Praktikum', icon: '🔬' },
		{ name: 'Presentasi', icon: '📊' },
		{ name: 'Tanya Jawab', icon: '❓' },
		{ name: 'Penugasan', icon: '📝' },
	];

	// Form Data
	const initialForm = {
		id: '',
		tanggal: getTodayDateString(),
		jam_ke: '',
		pertemuan_ke: '',
		mapel: '',
		metode: 'Ceramah',
		materi: '',
		kegiatan: '',
		hambatan: '',
		solusi: '',
		dokumentasi: null,
		tuntas: false,
		tipe_agenda: 'reguler', // 'reguler' | 'tugas_luar' | 'kegiatan_sekolah'
		is_tugas_luar: false,
		is_kegiatan_sekolah: false,
	};
	const [formData, setFormData] = useState(initialForm);

	const handleToggleMetode = (methodName) => {
		const current = (formData.metode || '')
			.split(',')
			.map((m) => m.trim())
			.filter(Boolean);
		let next;
		if (current.includes(methodName)) {
			next = current.filter((m) => m !== methodName);
		} else {
			next = [...current, methodName];
		}
		setFormData((prev) => ({
			...prev,
			metode: next.join(', ') || 'Ceramah',
		}));
	};

	// --- 1. FETCH DATA ---
	useEffect(() => {
		const fetchData = async () => {
			if (!classId) return;
			try {
				const supabase = createClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) {
					router.push('/login');
					return;
				}
				
				const { data: profile } = await supabase.from('users').select('id_user, role').eq('auth_id', user.id).single();
				let currentUserId = '';
				let currentUserRole = '';
				if (profile) {
					currentUserId = profile.id_user;
					currentUserRole = profile.role;
					setUserId(currentUserId);
					setUserRole(currentUserRole);
				} else {
					router.push('/login');
					return;
				}
				
				const { data: kelasData } = await supabase.from('kelas').select('*').eq('id', classId).single();
				if (!kelasData) {
					Swal.fire('Error', 'Kelas tidak ditemukan', 'error');
					router.push('/kelas');
					return;
				}
				setKelasInfo(kelasData);
				
				const { data: mapelData } = await supabase.from('mapel').select('*').order('mapel', { ascending: true });
				setMapelList(mapelData || []);

				await refreshJurnal(currentUserId, currentUserRole, kelasData.kelas || kelasData.nama_kelas);

			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [classId]);

	const refreshJurnal = async (uid = userId, role = userRole, clsName = (kelasInfo?.kelas || kelasInfo?.nama_kelas)) => {
		if (!clsName) return [];
		try {
			const supabase = createClient();
			let query = supabase.from('jurnal').select('*').eq('kelas', clsName).order('tanggal', { ascending: false });
			if (role === 'Guru' && uid) {
				query = query.eq('guru_id', uid);
			}
			const { data, error } = await query;
			if (!error) {
				setJournals(data || []);
				return data || [];
			}
		} catch (error) {
			console.error('Gagal memuat jurnal:', error);
		}
		return [];
	};

	// --- RENOMOR ULANG PERTEMUAN BERDASARKAN TANGGAL ---
	const renumberPertemuan = async (kelas, mapel) => {
		try {
			const supabase = createClient();

			const { data: allJurnal, error } = await supabase
				.from('jurnal')
				.select('id, tanggal, jam_ke, pertemuan_ke')
				.eq('kelas', kelas)
				.eq('mapel', mapel)
				.eq('guru_id', userId)
				.order('tanggal', { ascending: true })
				.order('jam_ke', { ascending: true });

			if (error || !allJurnal || allJurnal.length === 0) return;

			let currentPertemuan = 1;
			let prevTanggal = null;
			const updates = [];

			allJurnal.forEach((j) => {
				if (prevTanggal !== null && j.tanggal !== prevTanggal) {
					currentPertemuan++;
				}
				const expectedPertemuan = String(currentPertemuan);
				
				if (String(j.pertemuan_ke) !== expectedPertemuan) {
					updates.push({ id: j.id, pertemuan_ke: expectedPertemuan });
				}
				prevTanggal = j.tanggal;
			});

			if (updates.length === 0) return;

			await Promise.all(
				updates.map(u =>
					supabase.from('jurnal').update({ pertemuan_ke: u.pertemuan_ke }).eq('id', u.id)
				)
			);
		} catch (err) {
			console.error('Gagal renumber pertemuan:', err);
		}
	};

	// --- LOGIC AUTO-SUGGEST PERTEMUAN ---
	const calculateMeeting = (cls, mpl) => {
		// Hanya jalankan jika mode tambah baru (bukan edit)
		if (isEditing || !cls || !mpl) return;

		// Hitung jumlah jurnal yang sudah ada untuk kelas & mapel ini
		const existingCount = journals.filter((j) => j.kelas === cls && j.mapel === mpl).length;

		// Saran = Jumlah data + 1
		const suggestion = existingCount + 1;

		setFormData((prev) => ({
			...prev,
			pertemuan_ke: suggestion.toString(),
		}));
	};

	// Fetch seluruh jurnal pada kelas & tanggal terpilih untuk deteksi bentrok jam (Tingkat Kelas - Opsi 1)
	useEffect(() => {
		const namaKelas = kelasInfo?.kelas || kelasInfo?.nama_kelas;
		if (!isModalOpen || !namaKelas || !formData.tanggal) {
			setExistingJournalsToday([]);
			return;
		}

		let isCancelled = false;
		const fetchConflictJournals = async () => {
			setLoadingConflictCheck(true);
			try {
				const params = new URLSearchParams({
					check_conflict: 'true',
					kelas: namaKelas,
					tanggal: formData.tanggal,
				});
				const res = await fetch(`/api/jurnal?${params.toString()}`);
				if (res.ok) {
					const data = await res.json();
					if (!isCancelled) {
						setExistingJournalsToday(Array.isArray(data) ? data : []);
					}
				} else if (!isCancelled) {
					setExistingJournalsToday([]);
				}
			} catch (err) {
				console.warn('Gagal memuat jurnal kelas hari ini untuk cek bentrok:', err);
				if (!isCancelled) setExistingJournalsToday([]);
			} finally {
				if (!isCancelled) setLoadingConflictCheck(false);
			}
		};

		fetchConflictJournals();

		return () => {
			isCancelled = true;
		};
	}, [isModalOpen, kelasInfo, formData.tanggal]);

	// Deteksi konflik tumpang tindih jam pelajaran secara real-time (Tingkat Kelas - Opsi 1)
	const currentJamConflict = useMemo(() => {
		if (!formData.jam_ke || !formData.jam_ke.trim() || existingJournalsToday.length === 0) return null;
		return findConflictingSession(existingJournalsToday, formData.jam_ke, isEditing ? formData.id : null);
	}, [formData.jam_ke, existingJournalsToday, isEditing, formData.id]);

	// --- HANDLERS ---
	const handleOpenModal = (journal = null) => {
		if (journal) {
			// Mode Edit
			setIsEditing(true);
			const isTL =
				journal.status_kehadiran === 'Tugas Luar' ||
				String(journal.kegiatan || '').includes('[Tugas Luar');

			const isKS =
				journal.status_kehadiran === 'Kegiatan Sekolah' ||
				String(journal.status_kehadiran || '').toLowerCase().includes('hari santri') ||
				String(journal.kegiatan || '').includes('[Kegiatan Sekolah');

			setFormData({
				...journal,
				metode: journal.metode || 'Ceramah',
				tipe_agenda: isKS ? 'kegiatan_sekolah' : (isTL ? 'tugas_luar' : 'reguler'),
				is_tugas_luar: isTL,
				is_kegiatan_sekolah: isKS,
				status_kehadiran: isKS ? 'Kegiatan Sekolah' : (isTL ? 'Tugas Luar' : (journal.status_kehadiran || 'Normal')),
			});
		} else {
			// Mode Tambah Baru
			setIsEditing(false);
			setFormData(initialForm);
		}
		setIsModalOpen(true);
	};

	const handleDelete = async (id) => {
		const result = await Swal.fire({
			title: 'Hapus Jurnal?',
			text: 'Data yang dihapus tidak bisa dikembalikan.',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#EF4444',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		});

		if (result.isConfirmed) {
			try {
				const targetJurnal = journals.find(j => j.id === id);
				const supabase = createClient();
				const { error } = await supabase.from('jurnal').delete().eq('id', id);
				if (error) throw error;
				
				Swal.fire('Terhapus!', 'Jurnal berhasil dihapus.', 'success');
				if (targetJurnal) await renumberPertemuan(targetJurnal.kelas, targetJurnal.mapel);
				refreshJurnal();
			} catch (err) {
				Swal.fire('Error', 'Terjadi kesalahan saat menghapus.', 'error');
			}
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		// Pencegahan Double Submit Instan
		if (saving) return;
		setSaving(true);

		const namaKelas = kelasInfo?.kelas || kelasInfo?.nama_kelas;

		try {
			// Validasi Bentrok Jam Mengajar (Tingkat Kelas - Opsi 1)
			try {
				const checkRes = await fetch(
					`/api/jurnal?check_conflict=true&kelas=${encodeURIComponent(namaKelas || '')}&tanggal=${encodeURIComponent(formData.tanggal)}`
				);
				const latestJournals = checkRes.ok ? await checkRes.json() : existingJournalsToday;
				const conflict = findConflictingSession(latestJournals || [], formData.jam_ke, isEditing ? formData.id : null);

				if (conflict) {
					const guruExisting = conflict.session.users?.nama_lengkap || 'Guru lain';
					const mapelExisting = conflict.session.mapel || 'Mapel lain';
					const conflictDetail = conflict.conflicts?.length > 0 ? ` (Jam ke-${conflict.conflicts.join(', ')})` : '';

					await Swal.fire({
						title: 'Konflik Jam Mengajar!',
						html: `
							<div class="text-left text-sm space-y-2">
								<p>Jam <b>ke-${formData.jam_ke}</b> bertabrakan dengan jadwal <b>${mapelExisting}</b> oleh <b>${guruExisting}</b> (Jam <b>${conflict.session.jam_ke}</b>)${conflictDetail} pada kelas <b>${namaKelas}</b> tanggal <b>${formData.tanggal}</b>.</p>
								<div class="p-3 bg-red-50 border-2 border-[#0D0D0D] rounded-xl text-xs">
									<p class="font-bold text-[#E8451A]">Satu kelas tidak boleh memiliki kegiatan belajar mengajar ganda pada jam yang sama.</p>
									<p class="text-gray-600 mt-1">Silakan pilih jam mengajar lain yang belum terisi.</p>
								</div>
							</div>
						`,
						icon: 'error',
						confirmButtonColor: '#E8451A',
						confirmButtonText: 'Tutup & Ganti Jam',
					});
					return;
				}
			} catch (checkErr) {
				console.warn('Gagal cek bentrok jurnal pra-submit:', checkErr);
			}

			const supabase = createClient();
			
			if (isEditing) {
				const id = formData.id;
				if (!id) throw new Error('ID Jurnal tidak ditemukan untuk diperbarui');

				const cleanUpdates = {
					tanggal: formData.tanggal,
					jam_ke: formData.jam_ke || '',
					pertemuan_ke: formData.pertemuan_ke || '',
					kelas: namaKelas,
					mapel: formData.mapel,
					materi: formData.materi,
					kegiatan: formData.kegiatan || '',
					hambatan: formData.hambatan || '',
					solusi: formData.solusi || '',
					tuntas: !!formData.tuntas,
				};
				if (formData.metode) cleanUpdates.metode = formData.metode;

				// Pastikan nilai kolom realtime valid (bukan string kosong "" ke kolom TIME!)
				if (formData.jam_mulai && String(formData.jam_mulai).trim() !== '') {
					cleanUpdates.jam_mulai = String(formData.jam_mulai).trim().slice(0, 8);
				} else {
					cleanUpdates.jam_mulai = null;
				}

				if (formData.jam_selesai && String(formData.jam_selesai).trim() !== '') {
					cleanUpdates.jam_selesai = String(formData.jam_selesai).trim().slice(0, 8);
				} else {
					cleanUpdates.jam_selesai = null;
				}

				if (formData.durasi_menit !== undefined && formData.durasi_menit !== '' && !isNaN(Number(formData.durasi_menit))) {
					cleanUpdates.durasi_menit = Number(formData.durasi_menit);
				} else {
					cleanUpdates.durasi_menit = 0;
				}

				if (formData.sesi_absensi_id && String(formData.sesi_absensi_id).trim() !== '') {
					cleanUpdates.sesi_absensi_id = String(formData.sesi_absensi_id).trim();
				} else {
					cleanUpdates.sesi_absensi_id = null;
				}

				if (formData.is_kegiatan_sekolah) {
					cleanUpdates.status_kehadiran = 'Kegiatan Sekolah';
					if (!cleanUpdates.kegiatan?.includes('[Kegiatan Sekolah')) {
						cleanUpdates.kegiatan = `[Kegiatan Sekolah] ${cleanUpdates.kegiatan || ''}`.trim();
					}
				} else if (formData.is_tugas_luar) {
					cleanUpdates.status_kehadiran = 'Tugas Luar';
					if (!cleanUpdates.kegiatan?.includes('[Tugas Luar')) {
						cleanUpdates.kegiatan = `[Tugas Luar / Dinas Sekolah] ${cleanUpdates.kegiatan || ''}`.trim();
					}
				} else if (cleanUpdates.jam_mulai && cleanUpdates.jam_selesai) {
					cleanUpdates.status_kehadiran = determineKBMStatus({
						jamMulai: cleanUpdates.jam_mulai,
						jamSelesai: cleanUpdates.jam_selesai,
						durasiMenit: cleanUpdates.durasi_menit,
						tanggal: cleanUpdates.tanggal,
						jamKe: cleanUpdates.jam_ke,
					});
				} else if (formData.status_kehadiran && String(formData.status_kehadiran).trim() !== '') {
					cleanUpdates.status_kehadiran = String(formData.status_kehadiran).trim();
				} else {
					cleanUpdates.status_kehadiran = 'Normal';
				}

				let updateSuccess = false;
				let lastError = null;

				// 1. Coba update via Supabase client langsung
				try {
					let { error } = await supabase.from('jurnal').update(cleanUpdates).eq('id', id);
					if (error) {
						const isMissingCol =
							error.code === 'PGRST204' ||
							error.code === '42703' ||
							String(error.message || '').toLowerCase().includes('column') ||
							String(error.message || '').toLowerCase().includes('schema cache') ||
							String(error.details || '').toLowerCase().includes('column');

						if (isMissingCol) {
							const fallback = { ...cleanUpdates };
							delete fallback.metode;
							delete fallback.jam_mulai;
							delete fallback.jam_selesai;
							delete fallback.durasi_menit;
							delete fallback.sesi_absensi_id;
							delete fallback.status_kehadiran;

							if (cleanUpdates.metode && !fallback.kegiatan?.includes('[Metode:')) {
								fallback.kegiatan = `[Metode: ${cleanUpdates.metode}] ${fallback.kegiatan || ''}`.trim();
							}

							const retry = await supabase.from('jurnal').update(fallback).eq('id', id);
							error = retry.error;
						}
					}
					if (error) throw error;
					updateSuccess = true;
				} catch (clientErr) {
					console.warn('Direct Supabase update gagal, mencoba fallback via /api/jurnal:', clientErr);
					lastError = clientErr;
				}

				// 2. Fallback via internal API jika direct client gagal
				if (!updateSuccess) {
					try {
						const res = await fetch('/api/jurnal', {
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
								'x-user-id': userId || '',
								'x-user-role': userRole || '',
							},
							body: JSON.stringify({
								id,
								...cleanUpdates,
								is_tugas_luar: formData.is_tugas_luar,
								is_kegiatan_sekolah: formData.is_kegiatan_sekolah,
								tipe_agenda: formData.tipe_agenda,
							}),
						});

						if (res.ok) {
							updateSuccess = true;
						} else {
							const resData = await res.json().catch(() => ({}));
							throw new Error(resData.error || `HTTP ${res.status}`);
						}
					} catch (apiErr) {
						console.error('Fallback /api/jurnal juga gagal:', apiErr);
						throw lastError || apiErr;
					}
				}
			} else {
				const newId = Math.random().toString(36).substring(2, 11);
				const isTL = !!formData.is_tugas_luar;
				const isKS = !!formData.is_kegiatan_sekolah;
				let finalKegiatan = formData.kegiatan || '';
				if (isKS && !finalKegiatan.includes('[Kegiatan Sekolah')) {
					finalKegiatan = `[Kegiatan Sekolah] ${finalKegiatan}`.trim();
				} else if (isTL && !finalKegiatan.includes('[Tugas Luar')) {
					finalKegiatan = `[Tugas Luar / Dinas Sekolah] ${finalKegiatan}`.trim();
				}

				const finalStatus = isKS
					? 'Kegiatan Sekolah'
					: isTL
					? 'Tugas Luar'
					: determineKBMStatus({
							jamMulai: formData.jam_mulai,
							jamSelesai: formData.jam_selesai,
							durasiMenit: formData.durasi_menit,
							tanggal: formData.tanggal,
							jamKe: formData.jam_ke,
					  });

				const insertData = {
					id: newId,
					guru_id: userId || null,
					tanggal: formData.tanggal,
					jam_ke: formData.jam_ke || '',
					pertemuan_ke: formData.pertemuan_ke || '',
					kelas: namaKelas,
					mapel: formData.mapel,
					metode: formData.metode || 'Ceramah',
					materi: formData.materi,
					kegiatan: finalKegiatan,
					hambatan: formData.hambatan || '',
					solusi: formData.solusi || '',
					tuntas: !!formData.tuntas,
					jam_mulai: formData.jam_mulai && String(formData.jam_mulai).trim() !== '' ? String(formData.jam_mulai).trim().slice(0, 8) : null,
					jam_selesai: formData.jam_selesai && String(formData.jam_selesai).trim() !== '' ? String(formData.jam_selesai).trim().slice(0, 8) : null,
					durasi_menit: formData.durasi_menit || 0,
					sesi_absensi_id: formData.sesi_absensi_id || null,
					status_kehadiran: finalStatus || (isTL ? 'Tugas Luar' : 'Normal'),
				};

				let insertSuccess = false;
				let lastInsertError = null;

				// 1. Coba insert via Supabase client langsung
				try {
					let { error } = await supabase.from('jurnal').insert(insertData);
					if (error) {
						const isMissingCol =
							error.code === 'PGRST204' ||
							error.code === '42703' ||
							String(error.message || '').toLowerCase().includes('column') ||
							String(error.message || '').toLowerCase().includes('schema cache') ||
							String(error.details || '').toLowerCase().includes('column');

						if (isMissingCol) {
							const safeInsert = { ...insertData };
							delete safeInsert.metode;
							delete safeInsert.jam_mulai;
							delete safeInsert.jam_selesai;
							delete safeInsert.durasi_menit;
							delete safeInsert.sesi_absensi_id;
							delete safeInsert.status_kehadiran;
							if (insertData.metode) {
								safeInsert.kegiatan = `[Metode: ${insertData.metode}] ${safeInsert.kegiatan || ''}`.trim();
							}
							const retry = await supabase.from('jurnal').insert(safeInsert);
							error = retry.error;
						}
					}
					if (error) throw error;
					insertSuccess = true;
				} catch (clientErr) {
					console.warn('Direct Supabase insert gagal, mencoba fallback via /api/jurnal:', clientErr);
					lastInsertError = clientErr;
				}

				// 2. Fallback via internal API jika direct client gagal
				if (!insertSuccess) {
					try {
						const res = await fetch('/api/jurnal', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'x-user-id': userId || '',
								'x-user-role': userRole || '',
							},
							body: JSON.stringify({
								...insertData,
								is_tugas_luar: formData.is_tugas_luar,
								is_kegiatan_sekolah: formData.is_kegiatan_sekolah,
								tipe_agenda: formData.tipe_agenda,
							}),
						});
						if (res.ok) {
							insertSuccess = true;
						} else {
							const resData = await res.json().catch(() => ({}));
							throw new Error(resData.error || `HTTP ${res.status}`);
						}
					} catch (apiErr) {
						console.error('Fallback insert /api/jurnal juga gagal:', apiErr);
						throw lastInsertError || apiErr;
					}
				}
			}

			await renumberPertemuan(namaKelas, formData.mapel);

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: `Jurnal berhasil ${isEditing ? 'diperbarui' : 'disimpan'}`,
				timer: 1500,
				showConfirmButton: false,
			});
			setIsModalOpen(false);
			refreshJurnal();
		} catch (err) {
			console.error('Error saving journal:', err);
			const isNetworkErr =
				err?.name === 'TypeError' &&
				String(err?.message || '').toLowerCase().includes('fetch');

			Swal.fire({
				icon: 'error',
				title: 'Gagal Menyimpan Jurnal',
				text: isNetworkErr
					? 'Koneksi ke server database (Supabase) terputus atau timeout. Pastikan koneksi internet stabil lalu coba tekan "Simpan Jurnal" kembali.'
					: err?.message || 'Gagal menyimpan data jurnal.',
				confirmButtonColor: '#E8451A',
			});
		} finally {
			setSaving(false);
		}
	};

	const filteredJournals = journals.filter((j) => {
		const matchSearch =
			searchQuery === '' ||
			[j.materi, j.kegiatan, j.mapel, j.hambatan, j.solusi]
				.filter(Boolean)
				.some((field) => field.toString().toLowerCase().includes(searchQuery.toLowerCase()));
		return matchSearch;
	});

	if (loading) {
		return <Loader />;
	}

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20'>
			{/* Header Brutalist */}
			<div className='bg-[#E8451A] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
                {/* Decorative Elements */}
                <div className='absolute top-4 right-10 w-24 h-24 bg-[#F5C518] border-[4px] border-[#0D0D0D] rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] rotate-12 hidden md:block'></div>
                <div className='absolute bottom-8 left-1/4 w-12 h-12 bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -rotate-12 hidden md:block'></div>

				<div className='max-w-5xl mx-auto relative z-10'>
					<div className='flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8'>
						<div className='flex items-center gap-4'>
							<button
								onClick={() => router.back()}
								className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
								<svg className='w-8 h-8' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
							</button>
							<div>
								<h1 className='text-4xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D] mb-2'>JURNAL {kelasInfo?.kelas || kelasInfo?.nama_kelas}</h1>
								<p className='text-white font-black tracking-widest uppercase bg-[#0D0D0D] inline-block px-3 py-1 border-[2px] border-white text-xs sm:text-sm'>Catat aktivitas harian kelas ini</p>
							</div>
						</div>
                        <button
                            onClick={() => handleOpenModal()}
                            className='w-full md:w-auto bg-[#00A693] text-white px-8 py-4 font-black shadow-[6px_6px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] flex items-center justify-center gap-3 whitespace-nowrap uppercase tracking-widest hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[10px_10px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none text-lg'>
                            <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={4} d='M12 4v16m8-8H4'/></svg>
                            BUAT JURNAL BARU
                        </button>
					</div>
				</div>
			</div>

			{/* Search & Filter Bar (Overlapping) */}
            <div className='max-w-5xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 mb-12'>
                <div className='flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
                    <div className='w-full'>
                        <div className='relative group'>
                            <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                                <svg className='w-7 h-7 text-[#0D0D0D]' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='4' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'></path></svg>
                            </div>
                            <input
                                type='text'
                                placeholder='CARI JURNAL KELAS INI...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='neo-input w-full !pl-16 pr-4 py-4 bg-white border-[4px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg'
                            />
                        </div>
                    </div>
                </div>
            </div>

			{/* Timeline Content */}
			<div className='max-w-5xl mx-auto px-4 sm:px-8 relative z-10'>
				{filteredJournals.length === 0 ? (
					<div className='bg-white shadow-[8px_8px_0px_0px_#0D0D0D] border-[4px] border-[#0D0D0D] p-16 text-center flex flex-col items-center justify-center relative overflow-hidden'>
						<div className='absolute -top-10 -right-10 w-40 h-40 bg-[#F5C518] rounded-full border-[4px] border-[#0D0D0D] opacity-50'></div>
						<div className='absolute -bottom-10 -left-10 w-40 h-40 bg-[#00A693] border-[4px] border-[#0D0D0D] rotate-45 opacity-50'></div>
						
						<div className='w-28 h-28 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center mx-auto mb-8 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform'>
							<svg className='w-16 h-16 text-[#E8451A]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'/></svg>
						</div>
						<h3 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] mb-4 uppercase tracking-widest relative z-10'>BELUM ADA JURNAL</h3>
						<p className='text-[#0D0D0D] font-bold text-lg relative z-10 bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D]'>Silakan buat jurnal baru untuk mencatat kegiatan hari ini.</p>
					</div>
				) : (
					<div className='space-y-12'>
						{filteredJournals.map((journal) => (
							<div
								key={journal.id}
								className='bg-white rounded-none border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[12px_12px_0px_0px_#0D0D0D] transition-all relative group'>
								
								{/* Status Strip */}
								<div className={`absolute left-0 top-0 bottom-0 w-4 border-r-[4px] border-[#0D0D0D] ${journal.tuntas ? 'bg-[#00A693]' : 'bg-[#E8451A]'}`}></div>

								<div className='pl-6 sm:pl-8 py-6 pr-6'>
									<div className='flex flex-col lg:flex-row justify-between items-start gap-6 mb-8'>
										<div className='flex flex-col sm:flex-row items-start sm:items-center gap-6'>
											{/* Date Badge (Offset/Popping out slightly) */}
											<div className='bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-3 min-w-[90px] text-center transform -rotate-3 hover:rotate-0 transition-all'>
												<span className='text-4xl font-black text-[#0D0D0D] block leading-none'>{new Date(journal.tanggal).getDate()}</span>
												<span className='text-xs font-black text-[#0D0D0D] uppercase tracking-widest mt-1 block bg-white border-2 border-[#0D0D0D] py-1'>{new Date(journal.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
											</div>

											{/* Info Utama */}
											<div>
												<div className='text-xl sm:text-2xl font-black text-[#0D0D0D] uppercase tracking-widest flex items-center gap-3 flex-wrap'>
													<span className='bg-white px-3 py-1 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>{journal.mapel}</span>
												</div>
												<div className='text-xs font-bold text-[#0D0D0D] flex flex-wrap items-center gap-3 mt-4'>
													<span className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] uppercase font-black'>
														<svg className='w-5 h-5 text-[#E8451A]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'></path></svg>
														JAM KE-{journal.jam_ke}
													</span>
													{journal.jam_mulai && journal.jam_selesai && (
														<span className='flex items-center gap-1.5 bg-[#FFF5F0] px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-xs font-black text-[#0D0D0D]'>
															<span>🕒</span> {journal.jam_mulai.slice(0, 5)} - {journal.jam_selesai.slice(0, 5)} ({formatDurationString(journal.durasi_menit || calculateDurationMinutes(journal.jam_mulai, journal.jam_selesai))})
														</span>
													)}
													{journal.status_kehadiran && journal.status_kehadiran !== 'Normal' && (
														(() => {
															const badge = getKBMStatusBadge(journal.status_kehadiran);
															return (
																<span className={`flex items-center gap-1 px-2.5 py-1.5 border-[2px] ${badge.border} ${badge.bg} ${badge.text} text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#0D0D0D]`}>
																	<span>{badge.icon}</span> {badge.label}
																</span>
															);
														})()
													)}
													{userRole === 'Admin' && <span className='text-[10px] font-black uppercase text-white bg-[#0D0D0D] px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>ID Guru: {journal.guru_id || 'UNKNOWN'}</span>}
												</div>
											</div>
										</div>

										{/* Action Buttons */}
										<div className='flex gap-3 shrink-0 self-start sm:self-auto'>
											<button
												onClick={() => handleOpenModal(journal)}
												className='p-3 bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
												title='Edit'>
												<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'/></svg>
											</button>
											<button
												onClick={() => handleDelete(journal.id)}
												className='p-3 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'
												title='Hapus'>
												<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'/></svg>
											</button>
										</div>
									</div>

									<div className='flex flex-wrap items-center gap-3 mb-8'>
										{/* Badge Pertemuan */}
										{journal.pertemuan_ke && <span className='px-4 py-2 bg-white text-[#0D0D0D] text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform rotate-1'>PERTEMUAN {journal.pertemuan_ke}</span>}

										{/* Badge Metode */}
										{journal.metode && (
											<span className='px-4 py-2 bg-[#F5C518] text-[#0D0D0D] text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1'>
												🎯 {journal.metode}
											</span>
										)}

										{journal.tuntas ? (
											<span className='px-4 py-2 bg-[#00A693] text-white text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1'>TUNTAS</span>
										) : (
											<span className='px-4 py-2 bg-[#E8451A] text-white text-xs font-black uppercase tracking-widest border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transform -rotate-1'>BELUM TUNTAS</span>
										)}
									</div>

									<div className='border-t-[4px] border-dashed border-[#0D0D0D] pt-8'>
										<div className='mb-8'>
											<h4 className='text-xs font-black text-white uppercase tracking-widest mb-3 bg-[#0D0D0D] inline-block px-4 py-2 transform -skew-x-6'>📝 MATERI POKOK</h4>
											<p className='text-[#0D0D0D] font-bold text-xl leading-relaxed bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] p-5'>{journal.materi}</p>
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
											<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative'>
												<div className='absolute -top-5 -right-5 text-4xl transform rotate-12 bg-[#F5C518] rounded-full border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] w-12 h-12 flex items-center justify-center'>🎯</div>
												<h4 className='text-[10px] font-black text-white uppercase tracking-widest mb-4 bg-[#0D0D0D] px-3 py-1.5 inline-block'>KEGIATAN</h4>
												<p className='text-base text-[#0D0D0D] font-bold'>{journal.kegiatan || '-'}</p>
											</div>
											<div className='bg-[#FFF5F0] p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] relative mt-4 md:mt-0'>
												<div className='absolute -top-5 -right-5 text-4xl transform -rotate-12 bg-[#E8451A] rounded-full border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] w-12 h-12 flex items-center justify-center'>💡</div>
												<div className='mb-3'>
													<h4 className='text-[10px] font-black text-white uppercase tracking-widest bg-[#0D0D0D] px-3 py-1.5 inline-block'>EVALUASI / CATATAN</h4>
												</div>
												<p className='text-sm text-[#0D0D0D] font-bold mt-2'>{journal.hambatan ? `Hambatan: ${journal.hambatan}` : 'Tidak ada hambatan.'}</p>
												{journal.solusi && (
													<p className='text-sm text-[#0D0D0D] font-bold mt-3 pt-3 border-t-[3px] border-dashed border-[#0D0D0D]'>✅ Solusi: {journal.solusi}</p>
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* MODAL FORM */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0D]/60 backdrop-blur-sm'>
					<div className='bg-white w-full max-w-2xl border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-none'>
						<form onSubmit={handleSubmit}>
							<div className='sticky top-0 bg-[#F5C518] px-8 py-5 border-b-[4px] border-[#0D0D0D] flex justify-between items-center z-10'>
								<h2 className='text-2xl font-black text-[#0D0D0D] uppercase tracking-widest'>{isEditing ? 'EDIT JURNAL' : 'JURNAL BARU'}</h2>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='w-10 h-10 flex items-center justify-center bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white transition-colors rounded-none'>
									<svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth={3} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12'/></svg>
								</button>
							</div>

							<div className='p-8 space-y-6 bg-[#FFF5F0]'>
								{/* Card Pilihan Tipe Agenda / Format Kegiatan */}
								<div className='p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] space-y-3'>
									<div className='flex items-center justify-between flex-wrap gap-2'>
										<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider'>
											Tipe Agenda / Format Kegiatan
										</label>
										{(formData.is_tugas_luar || formData.is_kegiatan_sekolah) && (
											<span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-[#0D0D0D] ${
												formData.is_kegiatan_sekolah ? 'bg-purple-600 text-white' : 'bg-[#2F80ED] text-white'
											}`}>
												Dispensasi Presensi Siswa
											</span>
										)}
									</div>

									<div className='grid grid-cols-1 sm:grid-cols-3 gap-2.5'>
										{/* 1. Reguler */}
										<button
											type='button'
											onClick={() => {
												setFormData((prev) => ({
													...prev,
													tipe_agenda: 'reguler',
													is_tugas_luar: false,
													is_kegiatan_sekolah: false,
													status_kehadiran: 'Normal',
												}));
											}}
											className={`p-3 border-[3px] text-left transition-all rounded-none flex flex-col justify-between gap-1.5 cursor-pointer ${
												!formData.is_tugas_luar && !formData.is_kegiatan_sekolah
													? 'bg-[#F5C518] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] translate-x-[-1px] translate-y-[-1px]'
													: 'bg-white border-[#0D0D0D]/40 hover:border-[#0D0D0D] hover:bg-gray-50'
											}`}>
											<div className='flex items-center justify-between'>
												<span className='text-xl'>🏫</span>
												{!formData.is_tugas_luar && !formData.is_kegiatan_sekolah && (
													<span className='w-2.5 h-2.5 bg-[#0D0D0D] rounded-full'></span>
												)}
											</div>
											<div>
												<div className='text-xs font-black uppercase tracking-tight text-[#0D0D0D]'>
													KBM di Kelas
												</div>
												<div className='text-[10px] font-medium text-gray-700 leading-tight mt-0.5'>
													Tatap muka reguler di kelas
												</div>
											</div>
										</button>

										{/* 2. Tugas Luar */}
										<button
											type='button'
											onClick={() => {
												setFormData((prev) => ({
													...prev,
													tipe_agenda: 'tugas_luar',
													is_tugas_luar: true,
													is_kegiatan_sekolah: false,
													status_kehadiran: 'Tugas Luar',
													metode: prev.metode === 'Ceramah' ? 'Penugasan' : prev.metode,
												}));
											}}
											className={`p-3 border-[3px] text-left transition-all rounded-none flex flex-col justify-between gap-1.5 cursor-pointer ${
												formData.is_tugas_luar
													? 'bg-[#EBF5FF] border-[#2F80ED] shadow-[3px_3px_0px_0px_#2F80ED] translate-x-[-1px] translate-y-[-1px]'
													: 'bg-white border-[#0D0D0D]/40 hover:border-[#0D0D0D] hover:bg-gray-50'
											}`}>
											<div className='flex items-center justify-between'>
												<span className='text-xl'>✈️</span>
												{formData.is_tugas_luar && (
													<span className='w-2.5 h-2.5 bg-[#2F80ED] rounded-full'></span>
												)}
											</div>
											<div>
												<div className='text-xs font-black uppercase tracking-tight text-[#0D0D0D]'>
													Tugas Luar / Dinas
												</div>
												<div className='text-[10px] font-medium text-gray-700 leading-tight mt-0.5'>
													Rapat dinas, workshop, lomba
												</div>
											</div>
										</button>

										{/* 3. Kegiatan Sekolah */}
										<button
											type='button'
											onClick={() => {
												setFormData((prev) => ({
													...prev,
													tipe_agenda: 'kegiatan_sekolah',
													is_tugas_luar: false,
													is_kegiatan_sekolah: true,
													status_kehadiran: 'Kegiatan Sekolah',
												}));
											}}
											className={`p-3 border-[3px] text-left transition-all rounded-none flex flex-col justify-between gap-1.5 cursor-pointer ${
												formData.is_kegiatan_sekolah
													? 'bg-[#F3E8FF] border-purple-600 shadow-[3px_3px_0px_0px_#9333EA] translate-x-[-1px] translate-y-[-1px]'
													: 'bg-white border-[#0D0D0D]/40 hover:border-[#0D0D0D] hover:bg-gray-50'
											}`}>
											<div className='flex items-center justify-between'>
												<span className='text-xl'>🎪</span>
												{formData.is_kegiatan_sekolah && (
													<span className='w-2.5 h-2.5 bg-purple-600 rounded-full'></span>
												)}
											</div>
											<div>
												<div className='text-xs font-black uppercase tracking-tight text-[#0D0D0D]'>
													Kegiatan Sekolah
												</div>
												<div className='text-[10px] font-medium text-gray-700 leading-tight mt-0.5'>
													Hari Santri, Upacara, Event, dll
												</div>
											</div>
										</button>
									</div>
								</div>

								{/* Baris 1: Mapel (Satu-satunya Dropdown) */}
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Mata Pelajaran</label>
									<div className='relative'>
										<select
											required
											value={formData.mapel}
											onChange={(e) => {
												const val = e.target.value;
												setFormData({ ...formData, mapel: val });
												calculateMeeting(kelasInfo?.kelas || kelasInfo?.nama_kelas, val);
											}}
											className='neo-input appearance-none w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none uppercase cursor-pointer'>
											<option value=''>PILIH MAPEL</option>
											{mapelList.map((m) => (
												<option key={m.id} value={m.mapel || m.nama_mapel}>{m.mapel || m.nama_mapel}</option>
											))}
										</select>
										<div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#0D0D0D] font-bold'>▼</div>
									</div>
								</div>

								{/* Baris 2: Tanggal, Jam, Pertemuan */}
								<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Tanggal</label>
										<input
											type='date'
											required
											value={formData.tanggal}
											onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none cursor-pointer'
										/>
									</div>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>
											Jam Ke- {loadingConflictCheck && <span className='text-[10px] text-gray-500 lowercase animate-pulse font-normal'>(cek...)</span>}
										</label>
										<input
											type='text'
											required
											placeholder='Contoh: 1-2'
											value={formData.jam_ke}
											onChange={(e) => setFormData({ ...formData, jam_ke: e.target.value })}
											className={`neo-input w-full px-4 py-3 bg-white border-[3px] ${currentJamConflict ? 'border-[#E8451A] bg-red-50 text-[#E8451A]' : 'border-[#0D0D0D] text-[#0D0D0D]'} font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none`}
										/>
										{currentJamConflict && (
											<div className='mt-2 p-2 bg-red-50 border-[2px] border-[#E8451A] text-xs text-[#0D0D0D]'>
												<p className='font-black text-[#E8451A] flex items-center gap-1 text-[11px] uppercase tracking-wider'>
													<span>⚠️</span> Konflik Jam Mengajar!
												</p>
												<p className='mt-1 text-[11px] font-medium leading-snug'>
													Jam ke-<b>{formData.jam_ke}</b> bentrok dengan <b>{currentJamConflict.session.mapel}</b> ({currentJamConflict.session.users?.nama_lengkap || 'Guru lain'} - Jam {currentJamConflict.session.jam_ke}) di kelas <b>{kelasInfo?.kelas || kelasInfo?.nama_kelas}</b>.
												</p>
												{currentJamConflict.conflicts?.length > 0 && (
													<p className='text-[10px] font-black text-[#E8451A] mt-0.5'>
														Jam bertabrakan: Jam ke-{currentJamConflict.conflicts.join(', ')}
													</p>
												)}
											</div>
										)}
									</div>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>
											Pertemuan <span className='text-[10px] text-[#E8451A]'>(Auto)</span>
										</label>
										<input
											type='text'
											placeholder='Auto'
											value={formData.pertemuan_ke}
											onChange={(e) => setFormData({ ...formData, pertemuan_ke: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-[#E8E8E8] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-white outline-none rounded-none'
										/>
									</div>
								</div>

								{/* Materi */}
								<div>
									<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Materi Pembelajaran</label>
									<textarea
										rows='2'
										required
										placeholder='Apa materi yang diajarkan?'
										value={formData.materi}
										onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
										className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
								</div>

								{/* Metode Pembelajaran */}
								<div>
									<div className='flex items-center justify-between mb-2'>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest'>Metode Pembelajaran</label>
										<span className='text-[10px] font-bold text-[#E8451A] bg-[#FFF5F0] border-2 border-[#0D0D0D] px-2 py-0.5'>Bisa pilih &gt; 1</span>
									</div>
									<div className='flex flex-wrap gap-2 mb-3'>
										{METODE_OPTIONS.map((item) => {
											const currentMetodes = (formData.metode || '').split(',').map((m) => m.trim()).filter(Boolean);
											const isSelected = currentMetodes.includes(item);
											return (
												<button
													key={item}
													type='button'
													onClick={() => handleToggleMetode(item)}
													className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-[3px] border-[#0D0D0D] transition-all rounded-none ${
														isSelected
															? 'bg-[#00A693] text-white shadow-[3px_3px_0px_0px_#0D0D0D] -translate-y-0.5'
															: 'bg-white text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:bg-[#F5C518]'
													}`}>
													{isSelected ? '✓ ' : '+ '}
													{item}
												</button>
											);
										})}
									</div>
									<input
										type='text'
										placeholder='Atau ketik metode lain/kombinasi...'
										value={formData.metode || ''}
										onChange={(e) => setFormData({ ...formData, metode: e.target.value })}
										className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none'
									/>
								</div>

								{/* Detail Kegiatan */}
								<div className='space-y-4'>
									<div>
										<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Kegiatan Pembelajaran</label>
										<textarea
											rows='3'
											placeholder='Deskripsi singkat aktivitas siswa...'
											value={formData.kegiatan}
											onChange={(e) => setFormData({ ...formData, kegiatan: e.target.value })}
											className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
										<div>
											<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Hambatan / Masalah</label>
											<textarea
												rows='2'
												placeholder='Kendala yang dihadapi...'
												value={formData.hambatan}
												onChange={(e) => setFormData({ ...formData, hambatan: e.target.value })}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
										</div>
										<div>
											<label className='block text-sm font-black text-[#0D0D0D] uppercase tracking-widest mb-2'>Solusi / Tindak Lanjut</label>
											<textarea
												rows='2'
												placeholder='Solusi yang dilakukan...'
												value={formData.solusi}
												onChange={(e) => setFormData({ ...formData, solusi: e.target.value })}
												className='neo-input w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] focus:bg-[#F5C518] outline-none rounded-none resize-none'></textarea>
										</div>
									</div>
								</div>

								{/* Status Checkbox */}
								<div className='bg-white p-4 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
									<div>
										<p className='font-black text-[#0D0D0D] uppercase tracking-widest'>Status Pembelajaran</p>
										<p className='text-xs text-[#0D0D0D] font-bold mt-1'>Apakah tujuan pembelajaran tercapai?</p>
									</div>
									<label className='relative inline-flex items-center cursor-pointer'>
										<input
											type='checkbox'
											checked={formData.tuntas}
											onChange={(e) => setFormData({ ...formData, tuntas: e.target.checked })}
											className='sr-only peer'
										/>
										<div className="w-16 h-8 bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-[26px] peer-checked:after:border-[#0D0D0D] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#0D0D0D] after:border-[#0D0D0D] after:border after:rounded-none after:h-6 after:w-6 after:transition-all peer-checked:bg-[#00A693] peer-checked:after:bg-white"></div>
										<span className='ml-4 text-sm font-black text-[#0D0D0D] uppercase tracking-widest min-w-[120px]'>{formData.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'}</span>
									</label>
								</div>
							</div>

							<div className='sticky bottom-0 bg-[#F5C518] px-4 sm:px-8 py-4 sm:py-5 border-t-[4px] border-[#0D0D0D] flex flex-col sm:flex-row justify-end gap-3 sm:gap-4'>
								<button
									type='button'
									onClick={() => setIsModalOpen(false)}
									className='neo-btn-outline w-full sm:w-auto bg-white text-[#0D0D0D] px-6 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest'>
									BATAL
								</button>
								<button
									type='submit'
									disabled={saving || !!currentJamConflict}
									className='neo-btn-primary w-full sm:w-auto bg-[#0D0D0D] text-white px-8 py-3 font-black shadow-[4px_4px_0px_0px_#0D0D0D] border-[3px] border-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] hover:bg-[#E8451A] hover:text-white active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed'>
									{saving ? 'MENYIMPAN...' : currentJamConflict ? 'JAM BENTROK' : 'SIMPAN JURNAL'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
