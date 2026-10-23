'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
	Award,
	Save,
	Plus,
	Trash2,
	AlertCircle,
	Search,
	Info,
	Sparkles,
} from 'lucide-react';
import Loader from '@/app/components/loading';
import { extractTingkat } from '@/utils/erapor';

const EKSKUL_PRESETS = [
	{ nama_ekskul: 'Praja Muda Karana (Pramuka)', keterangan: 'Aktif dan tertib mengikuti kegiatan kepramukaan mingguan' },
	{ nama_ekskul: 'Aswaja (Ke-NU-an)', keterangan: 'Aktif mengikuti kegiatan keaswajaan dan amaliah keagamaan' },
	{ nama_ekskul: 'Khot (Kaligrafi)', keterangan: 'Mampu menulis kaligrafi khat dengan baik, rapi, dan tekun' },
	{ nama_ekskul: "Tahfidz Al-Qur'an", keterangan: "Menghafal Al-Qur'an dengan tartil dan menjaga muraja'ah" },
	{ nama_ekskul: 'Hadrah & Seni Islami', keterangan: 'Terampil memainkan alat musik hadrah dan bersholawat' },
	{ nama_ekskul: 'Futsal & Olahraga', keterangan: 'Menunjukkan sportivitas tinggi, fisik tangguh, dan kerjasama tim yang baik' },
];

export default function EkstrakurikulerPage() {
	const [kelasList, setKelasList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');
	const [masterPresets, setMasterPresets] = useState([]);

	// Periode
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [students, setStudents] = useState([]);
	const [ekskulData, setEkskulData] = useState({}); // { [siswaId]: [ { nama_ekskul, predikat, keterangan } ] }
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	const selectedKelasObj = useMemo(() => {
		return kelasList.find((k) => k.id === selectedKelasId);
	}, [kelasList, selectedKelasId]);

	const currentTingkat = useMemo(() => {
		if (!selectedKelasObj) return 7;
		return extractTingkat(selectedKelasObj.kelas || selectedKelasObj.nama_kelas);
	}, [selectedKelasObj]);

	// Load dynamic master ekskul presets yang disesuaikan dengan tingkat kelas
	useEffect(() => {
		async function loadPresets() {
			try {
				const res = await fetch(`/api/erapor/master-ekskul?tingkat=${currentTingkat}`);
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data) && data.length > 0) {
						setMasterPresets(data);
					}
				}
			} catch (err) {
				console.error('Error load master presets:', err);
			}
		}
		loadPresets();
	}, [currentTingkat]);

	const availablePresets = useMemo(() => {
		if (masterPresets.length > 0) {
			return masterPresets.map((m) => ({
				nama_ekskul: m.nama_ekskul,
				keterangan: m.deskripsi_standar,
				kategori: m.kategori,
			}));
		}
		return EKSKUL_PRESETS.filter((p) => {
			// Aswaja hanya untuk jenjang kelas 9
			if (p.nama_ekskul.toLowerCase().includes('aswaja') && currentTingkat !== 9) {
				return false;
			}
			return true;
		});
	}, [masterPresets, currentTingkat]);

	useEffect(() => {
		async function fetchMaster() {
			try {
				const [resKelas, resTahun, resMyClass] = await Promise.all([
					fetch('/api/kelas?only_wali=true'),
					fetch('/api/tahun-ajar'),
					fetch('/api/wali-kelas/my-class').catch(() => null),
				]);

				let listK = [];
				if (resKelas.ok) {
					listK = (await resKelas.json()) || [];
				}

				if (listK.length === 0 && resMyClass && resMyClass.ok) {
					const myC = await resMyClass.json();
					if (myC?.kelas) {
						listK = [myC.kelas];
					}
				}

				setKelasList(listK);
				if (listK.length > 0) setSelectedKelasId(listK[0].id);

				if (resTahun.ok) {
					const dataT = await resTahun.json();
					const aktif = dataT.find((t) => t.is_aktif) || dataT[0];
					if (aktif) {
						setTahunAjaran(aktif.nama || '2026/2027');
						setSemester(aktif.semester || 1);
					}
				}
			} catch (err) {
				console.error('Error fetching master:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchMaster();
	}, []);

	const fetchEkskul = useCallback(async () => {
		if (!selectedKelasId) return;
		try {
			setLoading(true);
			const url = `/api/erapor/ekstrakurikuler?kelas_id=${selectedKelasId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setStudents(json.students || []);

				const eMap = {};
				(json.students || []).forEach((s) => {
					const list = s.kegiatan || s.ekskul_list || [];
					eMap[s.siswa_id] =
						list.length > 0
							? list.map((item) => ({
									id: item.id,
									nama_ekskul: item.nama_ekskul || item.nama_kegiatan,
									nama_kegiatan: item.nama_kegiatan || item.nama_ekskul,
									predikat: item.predikat || 'Baik',
									keterangan: item.keterangan || '',
									nilai_angka: item.nilai_angka,
									is_auto_synced: item.is_auto_synced,
							  }))
							: [
									{
										nama_ekskul: 'Praja Muda Karana (Pramuka)',
										predikat: 'Baik',
										keterangan: 'Aktif dan tertib mengikuti kegiatan kepramukaan mingguan',
									},
									...(currentTingkat === 9
										? [
												{
													nama_ekskul: 'Aswaja (Ke-NU-an)',
													predikat: 'Baik',
													keterangan: 'Aktif dan tertib mengikuti kegiatan keaswajaan dan amaliah keagamaan',
												},
										  ]
										: []),
									{
										nama_ekskul: 'Khot (Kaligrafi)',
										predikat: 'Baik',
										keterangan: 'Mampu menulis kaidah khat kaligrafi dengan baik, rapi, dan tekun',
									},
							  ];
				});
				setEkskulData(eMap);
			}
		} catch (err) {
			console.error('Error fetching ekskul:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, semester, tahunAjaran, currentTingkat]);

	useEffect(() => {
		fetchEkskul();
	}, [fetchEkskul]);

	const addEkskulRow = (siswaId) => {
		setEkskulData((prev) => ({
			...prev,
			[siswaId]: [
				...(prev[siswaId] || []),
				{ nama_ekskul: '', predikat: 'Baik', keterangan: '' },
			],
		}));
	};

	const removeEkskulRow = (siswaId, index) => {
		setEkskulData((prev) => ({
			...prev,
			[siswaId]: (prev[siswaId] || []).filter((_, i) => i !== index),
		}));
	};

	const updateEkskulField = (siswaId, index, field, value) => {
		setEkskulData((prev) => {
			const list = [...(prev[siswaId] || [])];
			const currentItem = { ...list[index], [field]: value };
			if (field === 'nama_ekskul') {
				const matchedPreset = availablePresets.find(
					(p) => p.nama_ekskul.toLowerCase() === value.toLowerCase()
				);
				if (matchedPreset && (!currentItem.keterangan || currentItem.keterangan.trim() === '')) {
					currentItem.keterangan = matchedPreset.keterangan;
				}
			}
			list[index] = currentItem;
			return { ...prev, [siswaId]: list };
		});
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			const payloadData = students.map((s) => ({
				siswa_id: s.siswa_id,
				kegiatan: ekskulData[s.siswa_id] || [],
				ekskul_list: ekskulData[s.siswa_id] || [],
			}));

			const res = await fetch('/api/erapor/ekstrakurikuler', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelas_id: selectedKelasId,
					semester,
					tahun_ajaran: tahunAjaran,
					payload: payloadData,
					data_ekskul: payloadData,
				}),
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');

			Swal.fire({
				icon: 'success',
				title: 'Tersimpan',
				text: 'Data ekstrakurikuler berhasil disimpan.',
				timer: 1500,
				showConfirmButton: false,
			});
			fetchEkskul();
		} catch (err) {
			Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
		} finally {
			setSaving(false);
		}
	};

	const filteredStudents = useMemo(() => {
		return students.filter((s) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return s.nama_lengkap.toLowerCase().includes(q) || (s.nis && s.nis.includes(q));
		});
	}, [students, searchQuery]);

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<Award className='w-6 h-6 text-purple-600' />
						<span>Penilaian Ekstrakurikuler</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Catat partisipasi, predikat, dan keterangan kegiatan ekstrakurikuler siswa (Pramuka, Aswaja, Khot, dll.) untuk dicetak pada lembar rapor.
					</p>
				</div>
				<button
					onClick={handleSave}
					disabled={saving || loading || students.length === 0}
					className='px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer'>
					<Save className='w-4 h-4' />
					<span>{saving ? 'Menyimpan...' : 'Simpan Nilai Ekskul'}</span>
				</button>
			</div>

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat data siswa dan ekstrakurikuler...</p>
				</div>
			) : (
				<>
					{/* Filter Bar */}
					<div className='p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
						<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-600'>Kelas Binaan:</span>
								{kelasList.length > 1 ? (
									<select
										value={selectedKelasId}
										onChange={(e) => setSelectedKelasId(e.target.value)}
										className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
										{kelasList.map((k) => (
											<option key={k.id} value={k.id}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								) : kelasList.length === 1 ? (
									<span className='px-3.5 py-1 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
										{kelasList[0].nama_kelas}
									</span>
								) : loading ? (
									<span className='px-3 py-1 bg-gray-100 text-gray-600 border-2 border-dashed border-gray-400 rounded-xl text-xs font-bold animate-pulse'>
										Memuat kelas...
									</span>
								) : (
									<span className='px-3 py-1 bg-rose-100 text-rose-700 border-2 border-rose-400 rounded-xl text-xs font-bold'>
										Bukan Wali Kelas
									</span>
								)}
							</div>

							<span className='px-2.5 py-1 bg-gray-100 text-black border border-black rounded-lg text-xs font-black'>
								Semester {semester} • {tahunAjaran}
							</span>

							<span className='px-2.5 py-1 bg-yellow-100 text-yellow-950 border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_#000]'>
								Jenjang Kelas {currentTingkat} (Fase D)
							</span>

							<span className='text-[11px] font-bold text-gray-600 hidden lg:inline'>
								{currentTingkat === 9
									? '• Ekskul Wajib Pesantren: Pramuka, Aswaja, Khot'
									: '• Ekskul Wajib Pesantren: Pramuka & Khot (Aswaja khusus Kelas 9)'}
							</span>
						</div>

						<div className='relative w-full sm:w-64'>
							<Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
							<input
								type='text'
								placeholder='Cari nama siswa...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className='w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:bg-yellow-50'
							/>
						</div>
					</div>

					{/* Tabel Siswa & Ekskul */}
					{kelasList.length === 0 ? (
						<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
							<h3 className='text-base font-black text-black'>Bukan Wali Kelas</h3>
							<p className='text-xs text-gray-500'>
								Akun Anda tidak tercatat sebagai Wali Kelas pada periode ini. Penilaian ekstrakurikuler hanya dapat dikelola oleh Wali Kelas binaan atau Administrator.
							</p>
						</div>
					) : filteredStudents.length === 0 ? (
						<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
							<h3 className='text-base font-black text-black'>Tidak Ada Siswa Ditemukan</h3>
						</div>
					) : (
						<div className='space-y-4'>
							{filteredStudents.map((s, idx) => {
								const list = ekskulData[s.siswa_id] || [];
								return (
									<div
										key={s.siswa_id}
										className='p-4 sm:p-5 bg-white border-3 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] space-y-3'>
										<div className='flex items-center justify-between border-b-2 border-black pb-2.5'>
											<div className='flex items-center gap-2'>
												<span className='w-6 h-6 rounded-lg bg-yellow-300 border-2 border-black font-black text-xs flex items-center justify-center'>
													{idx + 1}
												</span>
												<span className='font-black text-sm text-black'>{s.nama_lengkap}</span>
												<span className='text-[10px] font-mono text-gray-500 hidden sm:inline'>
													({s.nis || s.nisn || '-'})
												</span>
											</div>
											<button
												onClick={() => addEkskulRow(s.siswa_id)}
												className='px-2.5 py-1 bg-yellow-200 hover:bg-yellow-300 text-black border border-black rounded-lg text-xs font-black flex items-center gap-1 shadow-[1px_1px_0px_0px_#000]'>
												<Plus className='w-3 h-3' />
												<span>Tambah Kegiatan</span>
											</button>
										</div>

										{list.length === 0 ? (
											<p className='text-xs text-gray-400 italic py-1'>
												Belum ada kegiatan ekstrakurikuler. Klik tombol &quot;+ Tambah Kegiatan&quot;.
											</p>
										) : (
											<div className='space-y-2'>
												{list.map((item, eIdx) => (
													<div key={eIdx} className='grid grid-cols-12 gap-2 items-center text-xs'>
														<div className='col-span-12 sm:col-span-4'>
															<div className='relative'>
																<input
																	type='text'
																	list='ekskul-options'
																	placeholder='Nama Ekstrakurikuler (Pramuka, Aswaja, Khot, dll.)'
																	value={item.nama_ekskul}
																	onChange={(e) => updateEkskulField(s.siswa_id, eIdx, 'nama_ekskul', e.target.value)}
																	className='w-full px-2.5 py-1.5 bg-gray-50 border-2 border-black rounded-xl font-bold focus:bg-white focus:outline-none'
																/>
																{item.nilai_angka !== undefined && item.nilai_angka !== null && (
																	<span
																		className='absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-yellow-300 border border-black rounded font-black text-black pointer-events-none shadow-[1px_1px_0px_#000]'
																		title={`Terkonversi otomatis dari Nilai Angka Guru Mapel: ${item.nilai_angka}`}>
																		⚡ Nilai: {item.nilai_angka}
																	</span>
																)}
															</div>
														</div>
														<div className='col-span-5 sm:col-span-2'>
															<select
																value={item.predikat}
																onChange={(e) => updateEkskulField(s.siswa_id, eIdx, 'predikat', e.target.value)}
																className='w-full px-2 py-1.5 bg-gray-50 border-2 border-black rounded-xl font-bold focus:bg-white focus:outline-none'>
																<option value='Sangat Baik'>Sangat Baik</option>
																<option value='Baik'>Baik</option>
																<option value='Cukup'>Cukup</option>
																<option value='Kurang'>Kurang</option>
															</select>
														</div>
														<div className='col-span-6 sm:col-span-5'>
															<input
																type='text'
																placeholder='Keterangan capaian kegiatan...'
																value={item.keterangan}
																onChange={(e) => updateEkskulField(s.siswa_id, eIdx, 'keterangan', e.target.value)}
																className='w-full px-2.5 py-1.5 bg-gray-50 border-2 border-black rounded-xl font-medium focus:bg-white focus:outline-none'
															/>
														</div>
														<div className='col-span-1 text-center'>
															<button
																onClick={() => removeEkskulRow(s.siswa_id, eIdx)}
																className='p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-black rounded-lg'
																title='Hapus Baris'>
																<Trash2 className='w-3.5 h-3.5' />
															</button>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</>
			)}

			{/* Datalist pilihan preset ekstrakurikuler terfilter jenjang */}
			<datalist id='ekskul-options'>
				{availablePresets.map((p, pIdx) => (
					<option key={pIdx} value={p.nama_ekskul}>
						{p.kategori ? `[${p.kategori}] ` : ''}{p.keterangan}
					</option>
				))}
			</datalist>
		</div>
	);
}
