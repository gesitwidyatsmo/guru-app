'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/app/components/loading';
import Swal from 'sweetalert2';
import {
	ArrowLeft,
	ArrowUp,
	ArrowDown,
	Save,
	RotateCcw,
	Sparkles,
	Users,
	HelpCircle,
	Copy,
	Check,
	AlertCircle,
	SlidersHorizontal,
	ArrowUpDown,
} from 'lucide-react';

const SQL_MIGRATION_TEXT = `-- MIGRATION: Tambah Kolom nomor_absen pada tabel public.siswa
ALTER TABLE public.siswa 
ADD COLUMN IF NOT EXISTS nomor_absen INTEGER;

CREATE INDEX IF NOT EXISTS idx_siswa_kelas_nomor_absen 
ON public.siswa(kelas, nomor_absen ASC NULLS LAST);

WITH ranked_siswa AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (
            PARTITION BY kelas 
            ORDER BY nama_lengkap ASC
        ) AS new_no_absen
    FROM public.siswa
    WHERE kelas IS NOT NULL AND status = 'Aktif'
)
UPDATE public.siswa s
SET nomor_absen = r.new_no_absen
FROM ranked_siswa r
WHERE s.id = r.id AND s.nomor_absen IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO service_role;
GRANT SELECT ON public.siswa TO anon;`;

function UrutanSiswaInner() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const initialKelas = searchParams.get('kelas') || '';

	const [kelasList, setKelasList] = useState([]);
	const [selectedKelas, setSelectedKelas] = useState(initialKelas);
	const [siswaList, setSiswaList] = useState([]);
	const [originalList, setOriginalList] = useState([]);
	const [loadingKelas, setLoadingKelas] = useState(true);
	const [loadingSiswa, setLoadingSiswa] = useState(false);
	const [saving, setSaving] = useState(false);
	const [currentUserRole, setCurrentUserRole] = useState('');
	const [hasNomorAbsenColumn, setHasNomorAbsenColumn] = useState(true);
	const [showMigrationModal, setShowMigrationModal] = useState(false);
	const [copiedSql, setCopiedSql] = useState(false);
	const [filterGender, setFilterGender] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');

	// 1. Muat info user & daftar kelas
	useEffect(() => {
		const initData = async () => {
			try {
				setLoadingKelas(true);
				const [resAuth, resKelas] = await Promise.all([
					fetch('/api/auth/me'),
					fetch('/api/kelas?all=true', { cache: 'no-store' }),
				]);

				if (resAuth.ok) {
					const authData = await resAuth.json();
					if (authData?.user?.role) setCurrentUserRole(authData.user.role);
				}

				if (resKelas.ok) {
					const kData = await resKelas.json();
					const list = Array.isArray(kData) ? kData : [];
					setKelasList(list);

					// Jika belum ada kelas terpilih dari query param, pilih kelas pertama
					if (!initialKelas && list.length > 0) {
						setSelectedKelas(list[0].nama_kelas || list[0].kelas || '');
					}
				}
			} catch (err) {
				console.error('Error load master kelas:', err);
				Swal.fire('Error', 'Gagal memuat daftar kelas rombel.', 'error');
			} finally {
				setLoadingKelas(false);
			}
		};

		initData();
	}, [initialKelas]);

	// 2. Muat siswa di kelas terpilih
	const fetchSiswa = useCallback(async (kelasNama) => {
		if (!kelasNama) {
			setSiswaList([]);
			setOriginalList([]);
			return;
		}

		try {
			setLoadingSiswa(true);
			const res = await fetch(`/api/siswa/urutan?kelas=${encodeURIComponent(kelasNama)}`, { cache: 'no-store' });
			const json = await res.json();

			if (!res.ok) {
				throw new Error(json.error || 'Gagal memuat siswa');
			}

			setHasNomorAbsenColumn(json.hasNomorAbsenColumn !== false);

			const rawList = Array.isArray(json.data) ? json.data : [];
			// Pastikan setiap siswa memiliki nomor absen sementara 1..N jika masih null
			const mapped = rawList.map((s, idx) => ({
				...s,
				nomor_absen: s.nomor_absen != null ? Number(s.nomor_absen) : idx + 1,
			}));

			setSiswaList(mapped);
			setOriginalList(JSON.parse(JSON.stringify(mapped)));
		} catch (err) {
			console.error('Error fetch urutan siswa:', err);
			Swal.fire('Gagal Memuat Siswa', err.message, 'error');
		} finally {
			setLoadingSiswa(false);
		}
	}, []);

	useEffect(() => {
		if (selectedKelas) {
			fetchSiswa(selectedKelas);
			// Sinkronisasi query param
			router.replace(`/admin/siswa/urutan?kelas=${encodeURIComponent(selectedKelas)}`);
		}
	}, [selectedKelas, fetchSiswa, router]);

	// Deteksi apakah ada urutan yang berubah (dirty state)
	const isDirty = useMemo(() => {
		if (siswaList.length !== originalList.length) return false;
		for (let i = 0; i < siswaList.length; i++) {
			if (siswaList[i].id !== originalList[i].id) return true;
			if (Number(siswaList[i].nomor_absen) !== Number(originalList[i].nomor_absen)) return true;
		}
		return false;
	}, [siswaList, originalList]);

	// Helper: Pindah Baris (Naik / Turun)
	const handleMove = (index, direction) => {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= siswaList.length) return;

		const newList = [...siswaList];
		const temp = newList[index];
		newList[index] = newList[targetIndex];
		newList[targetIndex] = temp;

		// Re-number 1..N
		const renumbered = newList.map((s, idx) => ({
			...s,
			nomor_absen: idx + 1,
		}));

		setSiswaList(renumbered);
	};

	// Helper: Input langsung nomor absen
	const handleNomorAbsenChange = (siswaId, newAbsenVal) => {
		const num = parseInt(newAbsenVal, 10);
		setSiswaList((prev) =>
			prev.map((s) => (s.id === siswaId ? { ...s, nomor_absen: isNaN(num) ? '' : num } : s))
		);
	};

	// Preset 1: Abjad A–Z
	const applySortAbjad = () => {
		const sorted = [...siswaList].sort((a, b) =>
			(a.nama_lengkap || '').localeCompare(b.nama_lengkap || '', 'id', { sensitivity: 'base' })
		);
		const renumbered = sorted.map((s, idx) => ({ ...s, nomor_absen: idx + 1 }));
		setSiswaList(renumbered);
	};

	// Preset 2: Berdasarkan NIS
	const applySortNIS = () => {
		const sorted = [...siswaList].sort((a, b) => {
			const nisA = String(a.nis || '').trim();
			const nisB = String(b.nis || '').trim();
			const numA = parseInt(nisA, 10);
			const numB = parseInt(nisB, 10);
			if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
			return nisA.localeCompare(nisB);
		});
		const renumbered = sorted.map((s, idx) => ({ ...s, nomor_absen: idx + 1 }));
		setSiswaList(renumbered);
	};

	// Reset ke urutan simpanan terakhir
	const handleReset = () => {
		setSiswaList(JSON.parse(JSON.stringify(originalList)));
	};

	// Simpan Urutan ke Database
	const handleSave = async () => {
		if (!selectedKelas) return;

		// Validasi apakah ada nomor absen kosong atau duplikat
		const urutanPayload = siswaList.map((s, idx) => ({
			id: s.id,
			nomor_absen: s.nomor_absen != null && s.nomor_absen !== '' ? Number(s.nomor_absen) : idx + 1,
		}));

		// Pastikan diurutkan rapi berdasarkan nomor absen sebelum dikirim
		urutanPayload.sort((a, b) => a.nomor_absen - b.nomor_absen);

		try {
			setSaving(true);
			const res = await fetch('/api/siswa/urutan', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas: selectedKelas,
					urutan: urutanPayload,
				}),
			});

			const json = await res.json();
			if (!res.ok) {
				if (json.migrationNeeded) {
					setShowMigrationModal(true);
				}
				throw new Error(json.error || 'Gagal menyimpan urutan');
			}

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil Disimpan!',
				text: `Urutan nomor absen kelas ${selectedKelas} berhasil diperbarui.`,
				confirmButtonColor: '#000',
			});

			// Re-fetch data terbaru
			fetchSiswa(selectedKelas);
		} catch (err) {
			console.error('Error save urutan:', err);
			Swal.fire('Gagal Menyimpan', err.message, 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleCopySql = () => {
		navigator.clipboard.writeText(SQL_MIGRATION_TEXT);
		setCopiedSql(true);
		setTimeout(() => setCopiedSql(false), 2500);
	};

	// Siswa yang difilter di layar (pencarian / gender)
	const displayedSiswa = useMemo(() => {
		return siswaList.filter((s) => {
			const q = searchQuery.toLowerCase().trim();
			const matchQ =
				!q ||
				(s.nama_lengkap || '').toLowerCase().includes(q) ||
				(s.nis && String(s.nis).toLowerCase().includes(q));
			const matchGender = filterGender === 'all' || s.jenis_kelamin === filterGender;
			return matchQ && matchGender;
		});
	}, [siswaList, searchQuery, filterGender]);

	if (loadingKelas) {
		return <Loader text='Memuat halaman pengatur urutan siswa...' />;
	}

	return (
		<div className='min-h-screen bg-[#FFFDF5] p-3 sm:p-6 lg:p-8 space-y-6'>
			{/* TOP BAR / NAVIGATION */}
			<div className='bg-white border-[3px] border-black rounded-2xl p-5 shadow-[4px_4px_0_#000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
				<div className='flex items-center gap-3'>
					<Link
						href='/admin/siswa'
						className='w-10 h-10 bg-[#F5C518] border-2 border-black rounded-xl flex items-center justify-center font-black shadow-[2px_2px_0_#000] hover:bg-yellow-400 active:translate-y-0.5 transition-all'
						title='Kembali ke Master Siswa'
					>
						<ArrowLeft className='w-5 h-5 text-black' />
					</Link>
					<div>
						<div className='inline-flex items-center gap-2 px-2.5 py-0.5 bg-blue-100 border border-black rounded-full text-[10px] font-black uppercase shadow-[1px_1px_0_#000] mb-1'>
							<SlidersHorizontal className='w-3 h-3 text-blue-600' />
							<span>Manajemen Rombel & Presensi</span>
						</div>
						<h1 className='text-xl sm:text-2xl font-black uppercase text-black tracking-tight'>
							Atur Urutan & Nomor Absen Siswa
						</h1>
					</div>
				</div>

				{/* PILIH KELAS DROPDOWN */}
				<div className='flex flex-wrap items-center gap-3 w-full md:w-auto'>
					<label className='font-black text-xs uppercase text-gray-700 shrink-0'>Rombel / Kelas:</label>
					<select
						value={selectedKelas}
						onChange={(e) => setSelectedKelas(e.target.value)}
						className='px-3 py-2 bg-yellow-100 border-2 border-black rounded-xl font-black text-sm shadow-[2px_2px_0_#000] focus:outline-none focus:ring-2 focus:ring-black cursor-pointer'
					>
						{kelasList.map((k) => {
							const name = k.nama_kelas || k.kelas;
							return (
								<option key={name} value={name}>
									Kelas {name} {k.wali_kelas ? `(${k.wali_kelas})` : ''}
								</option>
							);
						})}
					</select>
				</div>
			</div>

			{/* MIGRATION NOTICE CARD (Jika kolom belum ada di Supabase) */}
			{!hasNomorAbsenColumn && (
				<div className='bg-amber-100 border-[3px] border-black rounded-2xl p-5 shadow-[4px_4px_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
					<div className='flex items-start gap-3'>
						<div className='w-10 h-10 bg-amber-400 border-2 border-black rounded-xl flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]'>
							<AlertCircle className='w-5 h-5 text-black' />
						</div>
						<div>
							<h3 className='font-black text-sm uppercase text-black'>Kolom nomor_absen Belum Dibuat</h3>
							<p className='text-xs font-semibold text-gray-700 mt-0.5'>
								Database Supabase Anda belum memiliki kolom <code className='font-mono font-bold bg-white px-1.5 py-0.5 border border-black rounded'>nomor_absen</code>. Jalankan file migrasi SQL agar urutan dapat tersimpan permanen.
							</p>
						</div>
					</div>
					<button
						type='button'
						onClick={() => setShowMigrationModal(true)}
						className='px-4 py-2 bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-800 active:translate-y-0.5 transition-all shadow-[2px_2px_0_#000] shrink-0'
					>
						Lihat SQL Migrasi
					</button>
				</div>
			)}

			{/* PRESET SHORTCUTS & CONTROLS */}
			<div className='bg-white border-[3px] border-black rounded-2xl p-5 shadow-[4px_4px_0_#000] space-y-4'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black/10'>
					<div className='flex items-center gap-2'>
						<Sparkles className='w-5 h-5 text-amber-500' />
						<h2 className='text-sm sm:text-base font-black uppercase text-black tracking-wide'>
							Urutkan Otomatis (1-Klik Preset)
						</h2>
					</div>
					<span className='text-xs font-bold text-gray-500'>
						Pilih preset susunan di bawah untuk mengurutkan otomatis rombel {selectedKelas}:
					</span>
				</div>

				<div className='flex flex-wrap items-center gap-3'>
					<button
						type='button'
						onClick={applySortAbjad}
						className='flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-xl font-black text-xs uppercase tracking-wide shadow-[2px_2px_0_#000] active:translate-y-0.5 transition-all'
						title='Urutkan nama A sampai Z'
					>
						<span>🔤</span>
						<span>Abjad Nama (A–Z)</span>
					</button>

					<button
						type='button'
						onClick={applySortNIS}
						className='flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-300 hover:bg-cyan-400 border-2 border-black rounded-xl font-black text-xs uppercase tracking-wide shadow-[2px_2px_0_#000] active:translate-y-0.5 transition-all'
						title='Urutkan berdasarkan NIS'
					>
						<span>🔢</span>
						<span>Berdasarkan NIS</span>
					</button>
				</div>
			</div>

			{/* TABLE DAFTAR SISWA */}
			<div className='bg-white border-[3px] border-black rounded-2xl p-5 shadow-[4px_4px_0_#000] space-y-4'>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
					<div className='flex items-center gap-2'>
						<Users className='w-5 h-5 text-black' />
						<h2 className='text-base font-black uppercase text-black'>
							Daftar Siswa Rombel {selectedKelas} ({siswaList.length} Siswa)
						</h2>
					</div>

					<div className='flex flex-wrap items-center gap-2'>
						<input
							type='text'
							placeholder='Cari nama atau NIS...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='px-3 py-1.5 text-xs font-bold border-2 border-black rounded-xl shadow-[2px_2px_0_#000] focus:outline-none w-48'
						/>
						<select
							value={filterGender}
							onChange={(e) => setFilterGender(e.target.value)}
							className='px-2.5 py-1.5 text-xs font-bold border-2 border-black rounded-xl shadow-[2px_2px_0_#000] focus:outline-none'
						>
							<option value='all'>Semua Gender</option>
							<option value='Laki-laki'>Putra (L)</option>
							<option value='Perempuan'>Putri (P)</option>
						</select>
					</div>
				</div>

				{loadingSiswa ? (
					<div className='py-12 text-center font-black text-gray-500'>
						Memuat daftar siswa rombel {selectedKelas}...
					</div>
				) : siswaList.length === 0 ? (
					<div className='py-12 text-center font-bold text-gray-500 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl'>
						Belum ada siswa aktif terdaftar di kelas {selectedKelas}.
					</div>
				) : (
					<div className='overflow-x-auto border-2 border-black rounded-xl'>
						<table className='w-full text-left border-collapse text-xs sm:text-sm font-bold'>
							<thead className='bg-[#F5C518] text-black border-b-2 border-black font-black uppercase text-xs tracking-wider'>
								<tr>
									<th className='p-3 border-r-2 border-black text-center w-24'>No. Absen</th>
									<th className='p-3 border-r-2 border-black text-center w-28'>Aksi Urutan</th>
									<th className='p-3 border-r-2 border-black'>Nama Siswa</th>
									<th className='p-3 border-r-2 border-black w-28 text-center'>NIS</th>
									<th className='p-3 border-r-2 border-black w-24 text-center'>Gender</th>
									<th className='p-3 text-center w-24'>Status</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black bg-white'>
								{displayedSiswa.map((siswa, idx) => {
									const actualIndex = siswaList.findIndex((s) => s.id === siswa.id);
									const isFirst = actualIndex === 0;
									const isLast = actualIndex === siswaList.length - 1;

									return (
										<tr
											key={siswa.id}
											className='hover:bg-yellow-50/60 transition-colors'
										>
											{/* INPUT / BADGE NOMOR ABSEN */}
											<td className='p-2.5 border-r-2 border-black text-center bg-gray-50'>
												<div className='flex items-center justify-center gap-1.5'>
													<input
														type='number'
														min='1'
														max='99'
														value={siswa.nomor_absen || ''}
														onChange={(e) => handleNomorAbsenChange(siswa.id, e.target.value)}
														className='w-12 h-9 text-center font-black text-sm bg-white border-2 border-black rounded-lg shadow-[2px_2px_0_#000] focus:ring-2 focus:ring-black focus:outline-none'
													/>
												</div>
											</td>

											{/* TOMBOL NAIK / TURUN */}
											<td className='p-2 border-r-2 border-black text-center'>
												<div className='flex items-center justify-center gap-1'>
													<button
														type='button'
														disabled={isFirst}
														onClick={() => handleMove(actualIndex, 'up')}
														className={`w-7 h-7 flex items-center justify-center border-2 border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-y-0.5 transition-all ${
															isFirst
																? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
																: 'bg-emerald-300 hover:bg-emerald-400 text-black'
														}`}
														title='Pindah Naik (Lebih Awal)'
													>
														<ArrowUp className='w-4 h-4' />
													</button>
													<button
														type='button'
														disabled={isLast}
														onClick={() => handleMove(actualIndex, 'down')}
														className={`w-7 h-7 flex items-center justify-center border-2 border-black rounded-lg shadow-[1px_1px_0_#000] active:translate-y-0.5 transition-all ${
															isLast
																? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
																: 'bg-rose-300 hover:bg-rose-400 text-black'
														}`}
														title='Pindah Turun (Lebih Akhir)'
													>
														<ArrowDown className='w-4 h-4' />
													</button>
												</div>
											</td>

											{/* NAMA SISWA */}
											<td className='p-3 border-r-2 border-black'>
												<span className='font-black text-black block'>
													{siswa.nama_lengkap}
												</span>
												{siswa.nisn && (
													<span className='text-[10px] text-gray-500 font-mono'>
														NISN: {siswa.nisn}
													</span>
												)}
											</td>

											{/* NIS */}
											<td className='p-3 border-r-2 border-black text-center font-mono text-gray-700'>
												{siswa.nis || '-'}
											</td>

											{/* GENDER */}
											<td className='p-3 border-r-2 border-black text-center'>
												<span
													className={`inline-block px-2 py-0.5 border border-black rounded-md text-[10px] font-black uppercase shadow-[1px_1px_0_#000] ${
														siswa.jenis_kelamin === 'Laki-laki'
															? 'bg-blue-200 text-blue-900'
															: 'bg-pink-200 text-pink-900'
													}`}
												>
													{siswa.jenis_kelamin === 'Laki-laki' ? 'Putra' : 'Putri'}
												</span>
											</td>

											{/* STATUS */}
											<td className='p-3 text-center'>
												<span
													className={`inline-block px-2 py-0.5 border border-black rounded-md text-[10px] font-black uppercase shadow-[1px_1px_0_#000] ${
														siswa.status === 'Aktif'
															? 'bg-emerald-200 text-emerald-900'
															: 'bg-gray-200 text-gray-700'
													}`}
												>
													{siswa.status || 'Aktif'}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* STICKY BOTTOM SAVE ACTION BAR */}
			<div className='sticky bottom-4 z-30 bg-white border-[3px] border-black rounded-2xl p-4 shadow-[5px_5px_0_#000] flex flex-col sm:flex-row items-center justify-between gap-3'>
				<div className='flex items-center gap-2'>
					{isDirty ? (
						<div className='flex items-center gap-2 text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-800 text-xs font-black'>
							<span className='w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse'></span>
							<span>Ada perubahan nomor absen yang belum disimpan!</span>
						</div>
					) : (
						<div className='text-xs font-bold text-gray-500 flex items-center gap-1.5'>
							<Check className='w-4 h-4 text-emerald-600' />
							<span>Urutan saat ini tersinkronisasi dengan database.</span>
						</div>
					)}
				</div>

				<div className='flex items-center gap-2 w-full sm:w-auto justify-end'>
					<button
						type='button'
						disabled={!isDirty || saving}
						onClick={handleReset}
						className='flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black rounded-xl font-black text-xs uppercase tracking-wide shadow-[2px_2px_0_#000] active:translate-y-0.5 transition-all'
					>
						<RotateCcw className='w-4 h-4' />
						<span>Batal / Reset</span>
					</button>

					<button
						type='button'
						disabled={saving}
						onClick={handleSave}
						className='flex items-center gap-2 px-5 py-2.5 bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide shadow-[3px_3px_0_#000] active:translate-y-0.5 transition-all text-black'
					>
						<Save className='w-4 h-4' />
						<span>{saving ? 'Menyimpan...' : 'Simpan Urutan Nomor Absen'}</span>
					</button>
				</div>
			</div>

			{/* MODAL PETUNJUK MIGRASI SQL */}
			{showMigrationModal && (
				<div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'>
					<div className='bg-white border-[3px] border-black rounded-2xl max-w-xl w-full p-6 shadow-[6px_6px_0_#000] space-y-4 animate-in fade-in zoom-in-95'>
						<div className='flex items-center justify-between pb-3 border-b-2 border-black'>
							<div className='flex items-center gap-2'>
								<AlertCircle className='w-5 h-5 text-amber-500' />
								<h3 className='font-black text-base uppercase text-black'>File Migrasi Database</h3>
							</div>
							<button
								type='button'
								onClick={() => setShowMigrationModal(false)}
								className='w-8 h-8 flex items-center justify-center bg-gray-100 border-2 border-black rounded-lg font-black hover:bg-rose-100'
							>
								✕
							</button>
						</div>

						<p className='text-xs font-semibold text-gray-700'>
							Jalankan perintah SQL berikut di <b>Supabase SQL Editor</b> Anda untuk menambahkan kolom <code className='font-bold bg-gray-100 px-1 border border-gray-300 rounded'>nomor_absen</code>:
						</p>

						<pre className='bg-[#111] text-emerald-400 p-3 rounded-xl border-2 border-black font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed'>
							{SQL_MIGRATION_TEXT}
						</pre>

						<div className='flex items-center justify-between gap-2 pt-2'>
							<button
								type='button'
								onClick={handleCopySql}
								className='flex items-center gap-1.5 px-4 py-2 bg-cyan-300 hover:bg-cyan-400 border-2 border-black rounded-xl font-black text-xs uppercase shadow-[2px_2px_0_#000] active:translate-y-0.5'
							>
								{copiedSql ? <Check className='w-4 h-4' /> : <Copy className='w-4 h-4' />}
								<span>{copiedSql ? 'Tersalin!' : 'Salin Query SQL'}</span>
							</button>

							<button
								type='button'
								onClick={() => setShowMigrationModal(false)}
								className='px-4 py-2 bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-800'
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function UrutanSiswaPage() {
	return (
		<Suspense fallback={<Loader text='Memuat antarmuka urutan siswa...' />}>
			<UrutanSiswaInner />
		</Suspense>
	);
}
