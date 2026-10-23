'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
	Target,
	Plus,
	Trash2,
	Edit3,
	Search,
	AlertCircle,
	Check,
	School,
	User,
	Loader2,
	Sparkles,
	ArrowRight,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import { extractTingkat, cleanTpDeskripsi } from '@/utils/erapor';
import { useERaporAuth } from '@/app/erapor/ERaporLayoutClient';
import { isEkskulMapel, getOfficialEkskulName } from '@/lib/eraporEkskulUtils';

export default function TujuanPembelajaranPage() {
	const { userId, userName, userRole } = useERaporAuth();
	const [tpList, setTpList] = useState([]);
	const [mapelList, setMapelList] = useState([]);
	const [kelasList, setKelasList] = useState([]);
	const [loading, setLoading] = useState(true);

	// Filter
	const [filterMapel, setFilterMapel] = useState('all');
	const [filterTingkat, setFilterTingkat] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');

	const selectedMapelObj = useMemo(() => {
		return mapelList.find((m) => m.id === filterMapel);
	}, [mapelList, filterMapel]);

	// Deteksi apakah filter mapel yang dipilih adalah mata pelajaran ekstrakurikuler (Opsi A: kelompok === 'Ekskul')
	const isEkskulSelected = useMemo(() => {
		if (!filterMapel || filterMapel === 'all') return false;
		return isEkskulMapel(filterMapel, selectedMapelObj);
	}, [filterMapel, selectedMapelObj]);

	const ekskulDisplayName = useMemo(() => {
		if (!isEkskulSelected) return '';
		return selectedMapelObj?.nama_resmi || selectedMapelObj?.mapel || getOfficialEkskulName(filterMapel, selectedMapelObj);
	}, [isEkskulSelected, selectedMapelObj, filterMapel]);

	// Modal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
	const [editId, setEditId] = useState(null);
	const [isSaving, setIsSaving] = useState(false);

	// Form
	const [formMapelId, setFormMapelId] = useState('');
	const [formTingkat, setFormTingkat] = useState('7');

	const formMapelObj = useMemo(() => {
		return mapelList.find((m) => m.id === formMapelId);
	}, [mapelList, formMapelId]);
	const isFormEkskul = isEkskulMapel(formMapelId, formMapelObj);
	const [formKodeTp, setFormKodeTp] = useState('TP-1');
	const [formDeskripsi, setFormDeskripsi] = useState('');

	// Peta Rombel Kelas per Tingkat (7, 8, 9) untuk info kelas ajar guru
	const tingkatClassesMap = useMemo(() => {
		const map = {};
		kelasList.forEach((k) => {
			const name = k.kelas || k.nama_kelas;
			const t = extractTingkat(name);
			if (!map[t]) map[t] = [];
			if (!map[t].includes(name)) map[t].push(name);
		});
		return map;
	}, [kelasList]);

	// Tingkat yang hanya diajar oleh guru ini
	const availableTingkats = useMemo(() => {
		const keys = Object.keys(tingkatClassesMap).map(Number).sort();
		return keys.length > 0 ? keys : [7, 8, 9];
	}, [tingkatClassesMap]);

	// Fetch Master Mapel & Kelas Ajar Guru
	const fetchMaster = useCallback(async () => {
		try {
			const [resMapel, resKelas] = await Promise.all([
				fetch('/api/mapel?only_kbm=true'),
				fetch('/api/kelas?only_kbm=true'),
			]);

			if (resMapel.ok) {
				const dataM = await resMapel.json();
				setMapelList(dataM || []);
				if (dataM.length > 0 && !formMapelId) {
					setFormMapelId(dataM[0].id);
				}
			}

			if (resKelas.ok) {
				const dataK = await resKelas.json();
				setKelasList(dataK || []);

				// Jika guru hanya mengajar 1 tingkat, kunci default ke tingkat tersebut
				const tMap = {};
				(dataK || []).forEach((k) => {
					const t = extractTingkat(k.kelas || k.nama_kelas);
					tMap[t] = true;
				});
				const tKeys = Object.keys(tMap).map(Number);
				if (tKeys.length === 1) {
					setFilterTingkat(tKeys[0].toString());
					setFormTingkat(tKeys[0].toString());
				} else if (tKeys.length > 1 && !tKeys.includes(7)) {
					setFormTingkat(tKeys[0].toString());
				}
			}
		} catch (err) {
			console.error('Error fetching master in TP:', err);
		}
	}, [formMapelId]);

	const fetchTp = useCallback(async () => {
		try {
			setLoading(true);
			const url = `/api/erapor/tujuan-pembelajaran?mapel_id=${filterMapel}&tingkat=${filterTingkat}`;
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				setTpList(data || []);
			}
		} catch (err) {
			console.error('Error fetching TP:', err);
		} finally {
			setLoading(false);
		}
	}, [filterMapel, filterTingkat]);

	useEffect(() => {
		fetchMaster();
	}, [fetchMaster]);

	useEffect(() => {
		fetchTp();
	}, [fetchTp]);

	const openAddModal = () => {
		setModalMode('add');
		setEditId(null);
		if (mapelList.length > 0 && !formMapelId) setFormMapelId(mapelList[0].id);

		// Otomatis arahkan form ke tingkat yang diajar guru
		const defaultT = availableTingkats.length > 0 ? availableTingkats[0].toString() : '7';
		setFormTingkat(filterTingkat !== 'all' ? filterTingkat : defaultT);
		setFormKodeTp('');
		setFormDeskripsi('');
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		setModalMode('edit');
		setEditId(item.id);
		setFormMapelId(item.mapel_id);
		setFormTingkat(item.tingkat.toString());
		setFormKodeTp(item.kode_tp || '');
		setFormDeskripsi(item.deskripsi);
		setIsModalOpen(true);
	};

	const handleSave = async (e) => {
		e.preventDefault();
		if (isSaving) return;

		const cleanedDeskripsi = cleanTpDeskripsi(formDeskripsi);

		if (!formMapelId || !cleanedDeskripsi) {
			Swal.fire({
				icon: 'warning',
				title: 'Perhatian',
				text: 'Pilih mata pelajaran dan isi deskripsi Tujuan Pembelajaran.',
			});
			return;
		}

		if (cleanedDeskripsi.length > 100) {
			Swal.fire({
				icon: 'warning',
				title: 'Batas Karakter Terlampaui',
				text: 'Deskripsi Tujuan Pembelajaran maksimal 100 karakter agar rapi dan tidak terpotong di lembar cetak rapor.',
			});
			return;
		}

		try {
			setIsSaving(true);
			const payload = {
				id: editId,
				mapel_id: formMapelId,
				tingkat: parseInt(formTingkat, 10),
				kode_tp: formKodeTp || undefined,
				deskripsi: cleanedDeskripsi,
			};

			const url = '/api/erapor/tujuan-pembelajaran';
			const method = modalMode === 'add' ? 'POST' : 'PUT';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');

			Swal.fire({
				icon: 'success',
				title: 'Berhasil',
				text: modalMode === 'add' ? 'Tujuan Pembelajaran berhasil ditambahkan.' : 'Perubahan TP berhasil disimpan.',
				timer: 1500,
				showConfirmButton: false,
			});

			setIsModalOpen(false);
			fetchTp();
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = (id, deskripsi) => {
		Swal.fire({
			title: 'Hapus Tujuan Pembelajaran?',
			text: `TP: "${deskripsi.slice(0, 80)}..." akan dihapus dari sistem.`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#E8451A',
			confirmButtonText: 'Ya, Hapus',
			cancelButtonText: 'Batal',
		}).then(async (result) => {
			if (result.isConfirmed) {
				try {
					const res = await fetch(`/api/erapor/tujuan-pembelajaran?id=${id}`, {
						method: 'DELETE',
					});
					if (!res.ok) {
						const errData = await res.json();
						throw new Error(errData.error || 'Gagal menghapus');
					}
					Swal.fire('Terhapus!', 'TP berhasil dihapus.', 'success');
					fetchTp();
				} catch (err) {
					Swal.fire('Gagal', err.message, 'error');
				}
			}
		});
	};

	const filteredList = tpList.filter((item) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			item.deskripsi.toLowerCase().includes(q) ||
			(item.kode_tp && item.kode_tp.toLowerCase().includes(q)) ||
			(item.mapel?.mapel && item.mapel.mapel.toLowerCase().includes(q)) ||
			(item.pembuat?.nama_lengkap && item.pembuat.nama_lengkap.toLowerCase().includes(q))
		);
	});

	return (
		<div className='space-y-6'>
			{/* Header Halaman */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<Target className='w-6 h-6 text-amber-500' />
						<span>Tujuan Pembelajaran (TP)</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Rumusan capaian materi per mata pelajaran yang Anda ampu untuk penilaian rapor Kurikulum Merdeka.
					</p>
				</div>
				{isEkskulSelected ? (
					<Link
						href={`/erapor/nilai-kuantitatif?mapel_id=${filterMapel}`}
						className='px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer'>
						<span>Input Nilai Kuantitatif</span>
						<ArrowRight className='w-4 h-4' />
					</Link>
				) : (
					<button
						onClick={openAddModal}
						disabled={mapelList.length === 0}
						className='px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer'>
						<Plus className='w-4 h-4' />
						<span>Tambah TP Baru</span>
					</button>
				)}
			</div>

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat rumusan Tujuan Pembelajaran...</p>
					<p className='text-xs font-bold text-gray-500'>Menyiapkan daftar TP dan capaian kompetensi</p>
				</div>
			) : (
				<>
					{/* Info Rombel Kelas Binaan Ajar */}
			{kelasList.length > 0 && (
				<div className='p-3.5 bg-amber-50 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs'>
					<div className='flex items-center gap-2 font-black text-black'>
						<School className='w-4 h-4 text-amber-600' />
						<span>Rombel Kelas Ajar Anda:</span>
					</div>
					<div className='flex items-center gap-2 flex-wrap'>
						{availableTingkats.map((t) => (
							<span
								key={t}
								className='px-2.5 py-1 bg-white border-2 border-black rounded-lg font-black text-black shadow-[1px_1px_0px_#000]'>
								Kelas {t} (Fase D): <span className='text-[#2F80ED]'>{tingkatClassesMap[t]?.join(', ') || '-'}</span>
							</span>
						))}
					</div>
				</div>
			)}

			{/* Filter & Pencarian */}
			<div className='p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
				<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
					{/* Filter Tingkat */}
					<div className='flex items-center gap-2'>
						<span className='text-xs font-black uppercase text-gray-600'>Tingkat:</span>
						<select
							value={filterTingkat}
							onChange={(e) => setFilterTingkat(e.target.value)}
							className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
							{availableTingkats.length > 1 && (
								<option value='all'>Semua Tingkat (Fase D)</option>
							)}
							{availableTingkats.map((t) => (
								<option key={t} value={t}>
									Kelas {t} (Fase D)
								</option>
							))}
						</select>
					</div>

					{/* Filter Mapel */}
					<div className='flex items-center gap-2'>
						<span className='text-xs font-black uppercase text-gray-600'>Mapel:</span>
						{mapelList.length === 0 ? (
							<span className='text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 border border-black rounded-lg'>
								Tidak ada mapel ajar
							</span>
						) : (
							<select
								value={filterMapel}
								onChange={(e) => setFilterMapel(e.target.value)}
								className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold max-w-xs cursor-pointer'>
								{mapelList.length > 1 && <option value='all'>Semua Mapel Diampu</option>}
								{mapelList.map((m) => {
									const isEks = isEkskulMapel(m.id || m.mapel, m);
									return (
										<option key={m.id} value={m.id}>
											{m.mapel} {isEks ? '⚡ (Ekstrakurikuler)' : ''}
										</option>
									);
								})}
							</select>
						)}
					</div>
				</div>

				{/* Search Box */}
				<div className='relative w-full sm:w-64'>
					<Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
					<input
						type='text'
						placeholder='Cari rumusan TP...'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:bg-yellow-50'
					/>
				</div>
			</div>

			{/* Banner Khusus Mapel Ekstrakurikuler (Aswaja & Khot) */}
			{isEkskulSelected && (
				<div className='p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-150'>
					<div className='flex items-start gap-3.5'>
						<div className='w-11 h-11 rounded-xl bg-[#2F80ED] text-white flex items-center justify-center font-black shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]'>
							<Sparkles className='w-6 h-6' />
						</div>
						<div className='space-y-1'>
							<div className='flex items-center gap-2 flex-wrap'>
								<span className='px-2.5 py-0.5 text-[10px] font-black uppercase rounded bg-blue-200 text-blue-950 border border-black shadow-[1px_1px_0px_#000]'>
									Mapel Ekstrakurikuler Wajib Pesantren
								</span>
								<span className='text-xs font-black text-gray-400'>•</span>
								<span className='text-xs font-black text-blue-900'>{ekskulDisplayName}</span>
							</div>
							<h4 className='text-sm sm:text-base font-black text-black'>
								Mata Pelajaran Ini Tidak Memerlukan Tujuan Pembelajaran (TP)
							</h4>
							<p className='text-xs text-gray-700 leading-relaxed max-w-2xl font-medium'>
								Sesuai format Kurikulum Merdeka Fase D, penilaian capaian mata pelajaran ekstrakurikuler dicetak pada <strong>Lembar 3 Rapor Siswa</strong> berupa <strong>Predikat (A, B, C, D)</strong> dan <strong>Keterangan Capaian</strong>. Anda <strong>tidak perlu menyusun Tujuan Pembelajaran (TP)</strong> intrakurikuler. Nilai angka (0–100) dan narasi capaian langsung diinput serta dikonversi di menu <strong>Penilaian Kuantitatif</strong>.
							</p>
						</div>
					</div>
					<div className='shrink-0'>
						<Link
							href={`/erapor/nilai-kuantitatif?mapel_id=${filterMapel}`}
							className='w-full md:w-auto px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer'>
							<span>Buka Penilaian Kuantitatif</span>
							<ArrowRight className='w-4 h-4' />
						</Link>
					</div>
				</div>
			)}

			{/* Tabel TP */}
			{mapelList.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-3'>
					<AlertCircle className='w-10 h-10 mx-auto text-rose-500' />
					<h3 className='text-base font-black text-black'>Belum Ada Mata Pelajaran Penugasan</h3>
					<p className='text-xs text-gray-500 max-w-md mx-auto'>
						Akun Anda belum terdaftar mengajar mata pelajaran apa pun di jadwal KBM.
					</p>
				</div>
			) : isEkskulSelected ? (
				<div className='p-10 bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-4 max-w-2xl mx-auto'>
					<div className='w-14 h-14 bg-blue-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] text-blue-600'>
						<Sparkles className='w-7 h-7' />
					</div>
					<div className='space-y-1.5'>
						<h3 className='text-base sm:text-lg font-black text-black'>
							Penilaian Ekstrakurikuler: Bebas Administrasi TP
						</h3>
						<p className='text-xs sm:text-sm text-gray-600 leading-relaxed font-medium'>
							Mata pelajaran <strong>{ekskulDisplayName}</strong> tidak memerlukan rumusan Tujuan Pembelajaran. Seluruh evaluasi nilai dan predikat langsung diolah secara otomatis di menu Penilaian Kuantitatif.
						</p>
					</div>
					<div className='pt-2 flex justify-center'>
						<Link
							href={`/erapor/nilai-kuantitatif?mapel_id=${filterMapel}`}
							className='inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer'>
							<span>Buka Penilaian Kuantitatif & Narasi</span>
							<ArrowRight className='w-4 h-4' />
						</Link>
					</div>
				</div>
			) : filteredList.length === 0 ? (
				<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-3'>
					<AlertCircle className='w-10 h-10 mx-auto text-amber-500' />
					<h3 className='text-base font-black text-black'>Belum Ada Tujuan Pembelajaran</h3>
					<p className='text-xs text-gray-500 max-w-md mx-auto'>
						Belum ada data TP yang dirumuskan untuk tingkat kelas dan mapel ini. Silakan klik tombol &quot;Tambah TP Baru&quot; untuk mulai merumuskan capaian materi.
					</p>
				</div>
			) : (
				<div className='bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-full text-left border-collapse min-w-[700px]'>
							<thead>
								<tr className='bg-yellow-300 border-b-2 border-black text-xs font-black uppercase text-black'>
									<th className='p-3.5 w-14 text-center border-r-2 border-black'>No</th>
									<th className='p-3.5 w-24 text-center border-r-2 border-black'>No. TP</th>
									<th className='p-3.5 w-36 border-r-2 border-black'>Tingkat</th>
									<th className='p-3.5 w-44 border-r-2 border-black'>Mata Pelajaran</th>
									<th className='p-3.5 border-r-2 border-black'>Deskripsi Capaian Kompetensi</th>
									<th className='p-3.5 w-44 border-r-2 border-black'>Pembuat</th>
									<th className='p-3.5 w-28 text-center'>Aksi</th>
								</tr>
							</thead>
							<tbody className='divide-y-2 divide-black text-xs font-bold text-gray-900'>
								{filteredList.map((tp, idx) => {
									const isMyTp =
										tp.id_user === userId || (!tp.id_user && userRole === 'Guru');
									const pembuatNama =
										tp.pembuat?.nama_lengkap ||
										tp.pembuat?.username ||
										(isMyTp ? userName : 'Guru Mapel');

									return (
										<tr key={tp.id} className='hover:bg-yellow-50/60 transition-colors'>
											<td className='p-3.5 text-center font-black border-r-2 border-black bg-gray-50/50'>
												{idx + 1}
											</td>
											<td className='p-3.5 text-center font-black border-r-2 border-black'>
												<span className='px-2.5 py-1 bg-yellow-100 text-yellow-950 border border-black rounded-lg text-xs font-mono font-black shadow-[1px_1px_0px_#000]'>
													{tp.kode_tp && tp.kode_tp !== '-' ? tp.kode_tp : `TP ${idx + 1}`}
												</span>
											</td>
											<td className='p-3.5 border-r-2 border-black'>
												<span className='px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-black rounded-md font-black inline-block'>
													Kelas {tp.tingkat} (Fase D)
												</span>
											</td>
											<td className='p-3.5 font-black border-r-2 border-black'>
												{tp.mapel?.nama_resmi || tp.mapel?.mapel || '-'}
											</td>
											<td className='p-3.5 font-medium leading-relaxed border-r-2 border-black'>
												<div className='text-xs font-bold text-gray-900'>{tp.deskripsi}</div>
												<div className='mt-1 text-[10px] font-mono text-gray-500'>
													{tp.deskripsi?.length || 0}/100 karakter
												</div>
											</td>
											<td className='p-3.5 border-r-2 border-black'>
												<div className='flex items-center gap-2'>
													<div className='w-7 h-7 rounded-lg bg-yellow-200 border-2 border-black flex items-center justify-center font-black text-xs text-black shrink-0 shadow-[1px_1px_0px_#000]'>
														<User className='w-3.5 h-3.5' />
													</div>
													<div className='flex flex-col min-w-0'>
														<span
															className='font-bold text-xs text-black truncate max-w-[130px]'
															title={pembuatNama}>
															{pembuatNama}
														</span>
														{isMyTp && (
															<span className='text-[10px] font-black text-amber-600 uppercase tracking-wider'>
																(Anda)
															</span>
														)}
													</div>
												</div>
											</td>
											<td className='p-3.5 text-center'>
												<div className='flex items-center justify-center gap-2'>
													<button
														onClick={() => openEditModal(tp)}
														className='p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-black rounded-lg shadow-[1px_1px_0px_0px_#000] cursor-pointer'
														title='Edit TP'>
														<Edit3 className='w-3.5 h-3.5' />
													</button>
													<button
														onClick={() => handleDelete(tp.id, tp.deskripsi)}
														className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-black rounded-lg shadow-[1px_1px_0px_0px_#000] cursor-pointer'
														title='Hapus TP'>
														<Trash2 className='w-3.5 h-3.5' />
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Modal Form Add/Edit */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
					<div className='bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150'>
						<div className='p-5 bg-yellow-300 border-b-3 border-black flex items-center justify-between'>
							<h3 className='text-lg font-black text-black flex items-center gap-2'>
								<Target className='w-5 h-5' />
								<span>{modalMode === 'add' ? 'Tambah Tujuan Pembelajaran' : 'Edit Tujuan Pembelajaran'}</span>
							</h3>
							<button
								onClick={() => !isSaving && setIsModalOpen(false)}
								disabled={isSaving}
								className='w-7 h-7 flex items-center justify-center bg-white border-2 border-black rounded-lg font-black text-black hover:bg-rose-400 hover:text-white disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed'>
								✕
							</button>
						</div>

						<form onSubmit={handleSave} className='p-5 sm:p-6 space-y-4'>
							{/* Info Guru Pembuat */}
							<div className='p-2.5 bg-amber-50 border-2 border-black rounded-xl flex items-center justify-between text-xs shadow-[1px_1px_0px_#000]'>
								<span className='font-bold text-gray-700'>Guru Pembuat TP:</span>
								<span className='font-black text-black flex items-center gap-1.5'>
									<User className='w-3.5 h-3.5 text-amber-600' />
									{userName || 'Anda'}
								</span>
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Mata Pelajaran (Diampu)
								</label>
								<select
									value={formMapelId}
									onChange={(e) => setFormMapelId(e.target.value)}
									required
									className='w-full px-3.5 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:bg-yellow-50 cursor-pointer'>
									{mapelList.map((m) => (
										<option key={m.id} value={m.id}>
											{m.mapel} {isEkskulMapel(m.id || m.mapel, m) ? '⚡ (Ekstrakurikuler)' : ''}
										</option>
									))}
								</select>
								{isFormEkskul && (
									<div className='mt-2 p-3 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs space-y-1 text-amber-900 animate-in fade-in'>
										<div className='font-black flex items-center gap-1.5'>
											<AlertCircle className='w-4 h-4 text-amber-600' />
											<span>Mata Pelajaran Ekstrakurikuler</span>
										</div>
										<p className='text-[11px] leading-relaxed'>
											Mapel ini dievaluasi sebagai ekstrakurikuler di Lembar 3 Rapor dan <strong>tidak memerlukan Tujuan Pembelajaran (TP)</strong>. Silakan langsung menginput nilai di menu <strong>Penilaian Kuantitatif</strong>.
										</p>
									</div>
								)}
							</div>

							<div>
								<label className='block text-xs font-black uppercase text-black mb-1'>
									Tingkat Kelas (Ajar)
								</label>
								<select
									value={formTingkat}
									onChange={(e) => setFormTingkat(e.target.value)}
									className='w-full px-3.5 py-2.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none cursor-pointer'>
									{availableTingkats.map((t) => (
										<option key={t} value={t}>
											Kelas {t} (Fase D)
										</option>
									))}
								</select>
							</div>

							{tingkatClassesMap[formTingkat] && (
								<p className='text-[11px] font-bold text-[#2F80ED] bg-blue-50 p-2 rounded-lg border border-blue-200'>
									* TP ini berlaku untuk seluruh rombel Kelas {formTingkat} Anda:{' '}
									<span className='font-black'>{tingkatClassesMap[formTingkat].join(', ')}</span>
								</p>
							)}

							<div>
								<div className='flex items-center justify-between mb-1'>
									<label className='block text-xs font-black uppercase text-black'>
										Deskripsi / Rumusan TP
									</label>
									<span
										className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
											formDeskripsi.length >= 100
												? 'bg-rose-100 text-rose-800 border-rose-500 font-black'
												: formDeskripsi.length >= 85
												? 'bg-amber-100 text-amber-800 border-amber-400'
												: 'bg-gray-100 text-gray-600 border-gray-300'
										}`}>
										{formDeskripsi.length} / 100 karakter
									</span>
								</div>
								<textarea
									value={formDeskripsi}
									onChange={(e) => setFormDeskripsi(e.target.value)}
									required
									rows={3}
									maxLength={100}
									placeholder='Awali langsung dengan KKO, misal: memahami konsep aljabar dan persamaan linear...'
									className={`w-full p-3 bg-gray-50 border-2 rounded-xl text-xs font-medium focus:outline-none focus:bg-yellow-50 leading-relaxed ${
										formDeskripsi.length >= 100 ? 'border-rose-500 bg-rose-50/30' : 'border-black'
									}`}
								/>

								{/* Simulasi Live Preview Kalimat Rapor */}
								{formDeskripsi.trim() && (
									<div className='mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1 animate-in fade-in duration-150'>
										<div className='font-bold text-emerald-950 flex items-center justify-between'>
											<span className='flex items-center gap-1.5 text-[11px] font-black'>
												<Sparkles className='w-3.5 h-3.5 text-emerald-600' />
												<span>Simulasi Narasi Otomatis Rapor:</span>
											</span>
											{cleanTpDeskripsi(formDeskripsi) !== formDeskripsi.trim() && (
												<span className='text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded'>
													Awalan klise otomatis dibersihkan
												</span>
											)}
										</div>
										<p className='text-[11px] text-emerald-900 leading-relaxed italic'>
											&ldquo;Menunjukkan penguasaan sangat baik dalam{' '}
											<span className='font-black underline'>
												{cleanTpDeskripsi(formDeskripsi) || '...'}
											</span>
											.&rdquo;
										</p>
									</div>
								)}

								<p className='text-[10px] text-gray-500 mt-1 font-medium'>
									*Tips: Awali langsung dengan kata kerja (misal: <em>memahami, menganalisis, mempraktikkan</em>). Jika Anda mengetik <em>&ldquo;Siswa mampu...&rdquo;</em>, sistem akan otomatis membersihkannya agar kalimat rapor tetap mengalir alami.
								</p>
							</div>

							<div className='pt-3 border-t-2 border-black flex items-center justify-end gap-3'>
								<button
									type='button'
									disabled={isSaving}
									onClick={() => setIsModalOpen(false)}
									className='px-4 py-2 bg-gray-100 hover:bg-gray-200 text-black font-black text-xs rounded-xl border-2 border-black disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed'>
									Batal
								</button>
								<button
									type='submit'
									disabled={isSaving || isFormEkskul}
									title={isFormEkskul ? 'Mata pelajaran ekstrakurikuler tidak menggunakan TP' : undefined}
									className='px-5 py-2 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all flex items-center gap-1.5 cursor-pointer'>
									{isSaving ? (
										<>
											<Loader2 className='w-4 h-4 animate-spin' />
											<span>Menyimpan...</span>
										</>
									) : (
										<>
											<Check className='w-4 h-4' />
											<span>Simpan TP</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
				</>
			)}
		</div>
	);
}
