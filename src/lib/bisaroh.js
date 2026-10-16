/**
 * Utility & Logic Perhitungan Bisaroh / Honorarium Guru Berbasis Jurnal
 * Mendukung Multi-Tier Tingkatan Guru (Senior, Junior, dll.) & Komponen Tunjangan Dinamis
 */

export const DEFAULT_BISAROH_SETTINGS = {
	cut_off_tanggal: 25,
	// A. Tingkatan / Grade Tarif per JP
	tingkatan_guru: [
		{ id: 'senior', nama: 'Guru Senior', tarif_per_jp: 45000, keterangan: 'Masa kerja > 5 tahun atau bersertifikasi' },
		{ id: 'madya', nama: 'Guru Madya', tarif_per_jp: 40000, keterangan: 'Masa kerja 2 - 5 tahun' },
		{ id: 'junior', nama: 'Guru Junior / Pemula', tarif_per_jp: 35000, keterangan: 'Masa kerja < 2 tahun (Standar)' },
	],
	default_tingkatan_id: 'junior',
	guru_tingkatan_map: {}, // { [guru_id]: 'senior' | 'madya' | 'junior' }

	// B. Tunjangan Pokok Bawaan Sistem (Dapat Ditambah/Diedit/Dihapus/CRUD)
	tunjangan_pokok: [
		{
			id: 'tunj_wali_kelas',
			nama: 'Tunjangan Tugas Tambahan Wali Kelas',
			kategori: 'wali_kelas', // 'wali_kelas' | 'kehadiran' | 'umum'
			tipe: 'per_bulan', // 'per_bulan' | 'per_hari' | 'per_jp'
			nominal: 150000,
			penerima: 'wali_kelas', // 'wali_kelas' | 'semua' | 'terpilih'
			guru_ids: [],
			aktif: true,
			keterangan: 'Tunjangan struktural otomatis bagi guru yang menjadi wali kelas rombel aktif',
		},
		{
			id: 'tunj_kehadiran',
			nama: 'Tunjangan Kehadiran / Uang Makan Harian',
			kategori: 'kehadiran',
			tipe: 'per_hari',
			nominal: 15000,
			penerima: 'semua',
			guru_ids: [],
			aktif: true,
			keterangan: 'Dikalikan dengan jumlah hari masuk riil guru berdasarkan pengisian jurnal',
		},
	],
	tunjangan_wali_kelas: 150000, // fallback legacy
	tunjangan_kehadiran_per_hari: 15000, // fallback legacy

	// C. Komponen Tunjangan Tambahan Dinamis (Bisa Ditambah & Dihapus Fleksibel)
	tunjangan_tambahan: [
		{
			id: 'tunj_transport_bulan',
			nama: 'Uang Transport Bulanan',
			tipe: 'per_bulan', // 'per_bulan' | 'per_hari' | 'per_jp'
			nominal: 200000,
			penerima: 'semua', // 'semua' | 'terpilih'
			guru_ids: [],
			keterangan: 'Tunjangan transportasi bulanan tetap seluruh guru',
		},
		{
			id: 'tunj_fungsional',
			nama: 'Tunjangan Fungsional Yayasan',
			tipe: 'per_bulan',
			nominal: 100000,
			penerima: 'semua',
			guru_ids: [],
			keterangan: 'Tunjangan fungsional pendidik yayasan',
		},
	],

	// D. Komponen Potongan Tetap Dinamis
	potongan_tetap: [
		{
			id: 'pot_infaq',
			nama: 'Infaq / Dana Sosial Bulanan',
			nominal: 20000,
			penerima: 'semua',
			guru_ids: [],
			keterangan: 'Infaq sosial bulanan yayasan',
		},
	],

	// E. Struktur Jabatan & Gaji Pokok (Struktural Guru, Tendik, & Pimpinan)
	daftar_jabatan: [
		{
			id: 'jab_kepsek',
			nama: 'Kepala Sekolah',
			kategori: 'pimpinan', // 'pimpinan' | 'pendidik_struktural' | 'tendik'
			tipe_penggajian: 'pimpinan', // 'pimpinan' | 'hybrid' | 'gaji_pokok_bulanan'
			gaji_pokok_bulanan: 3500000,
			tunjangan_jabatan: 1500000,
			keterangan: 'Pimpinan institusi sekolah',
		},
		{
			id: 'jab_waka_kurikulum',
			nama: 'Wakil Kepala Sekolah Bidang Kurikulum',
			kategori: 'pendidik_struktural',
			tipe_penggajian: 'hybrid',
			gaji_pokok_bulanan: 0,
			tunjangan_jabatan: 750000,
			keterangan: 'Tugas tambahan struktural manajemen kurikulum & pembelajaran',
		},
		{
			id: 'jab_waka_kesiswaan',
			nama: 'Wakil Kepala Sekolah Bidang Kesiswaan',
			kategori: 'pendidik_struktural',
			tipe_penggajian: 'hybrid',
			gaji_pokok_bulanan: 0,
			tunjangan_jabatan: 750000,
			keterangan: 'Tugas tambahan struktural pembinaan kesiswaan & kedisiplinan',
		},
		{
			id: 'jab_kepala_lab',
			nama: 'Kepala Laboratorium Komputer / IPA',
			kategori: 'pendidik_struktural',
			tipe_penggajian: 'hybrid',
			gaji_pokok_bulanan: 0,
			tunjangan_jabatan: 350000,
			keterangan: 'Pengelolaan sarana laboratorium sekolah',
		},
		{
			id: 'jab_ka_tu',
			nama: 'Kepala Tata Usaha',
			kategori: 'tendik',
			tipe_penggajian: 'gaji_pokok_bulanan',
			gaji_pokok_bulanan: 2500000,
			tunjangan_jabatan: 300000,
			keterangan: 'Koordinator administrasi sekolah & kepegawaian',
		},
		{
			id: 'jab_staff_tu',
			nama: 'Staf Tata Usaha / Administrasi',
			kategori: 'tendik',
			tipe_penggajian: 'gaji_pokok_bulanan',
			gaji_pokok_bulanan: 2000000,
			tunjangan_jabatan: 0,
			keterangan: 'Tenaga kependidikan operasional administrasi sekolah',
		},
		{
			id: 'jab_satpam',
			nama: 'Petugas Keamanan / Security',
			kategori: 'tendik',
			tipe_penggajian: 'gaji_pokok_bulanan',
			gaji_pokok_bulanan: 1800000,
			tunjangan_jabatan: 0,
			keterangan: 'Keamanan lingkungan & presensi gerbang',
		},
	],
	user_jabatan_map: {}, // { [user_id]: 'jab_waka_kurikulum' }
};

/**
 * Normalisasi objek pengaturan bisaroh untuk memastikan backward compatibility
 */
export function normalizeBisarohSettings(raw) {
	const data = raw || {};
	const cutOff = Math.min(31, Math.max(1, Number(data.cut_off_tanggal) || 25));

	// Tingkatan guru
	let tingkatan = Array.isArray(data.tingkatan_guru) && data.tingkatan_guru.length > 0
		? data.tingkatan_guru.map((t) => ({
				id: t.id || String(Math.random()).substring(2, 8),
				nama: t.nama || 'Tingkatan',
				tarif_per_jp: Number(t.tarif_per_jp) || 35000,
				keterangan: t.keterangan || '',
		  }))
		: [
				{ id: 'senior', nama: 'Guru Senior', tarif_per_jp: Number(data.tarif_per_jp ? Number(data.tarif_per_jp) + 10000 : 45000), keterangan: 'Masa kerja > 5 tahun' },
				{ id: 'madya', nama: 'Guru Madya', tarif_per_jp: Number(data.tarif_per_jp ? Number(data.tarif_per_jp) + 5000 : 40000), keterangan: 'Masa kerja 2 - 5 tahun' },
				{ id: 'junior', nama: 'Guru Junior / Pemula', tarif_per_jp: Number(data.tarif_per_jp || 35000), keterangan: 'Masa kerja < 2 tahun (Standar)' },
		  ];

	const defaultTingkatanId = data.default_tingkatan_id || (tingkatan[0]?.id || 'junior');
	const guruMap = typeof data.guru_tingkatan_map === 'object' && data.guru_tingkatan_map !== null ? data.guru_tingkatan_map : {};

	// Tunjangan Pokok Bawaan Sistem (CRUD)
	let tunjanganPokok = [];
	if (Array.isArray(data.tunjangan_pokok) && data.tunjangan_pokok.length > 0) {
		tunjanganPokok = data.tunjangan_pokok.map((t) => ({
			id: t.id || `pokok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			nama: t.nama || 'Tunjangan Pokok',
			kategori: t.kategori || 'umum', // 'wali_kelas' | 'kehadiran' | 'umum'
			tipe: t.tipe || 'per_bulan', // 'per_bulan' | 'per_hari' | 'per_jp'
			nominal: Number(t.nominal) || 0,
			penerima: t.penerima || (t.kategori === 'wali_kelas' ? 'wali_kelas' : 'semua'),
			guru_ids: Array.isArray(t.guru_ids) ? t.guru_ids : [],
			aktif: t.aktif !== undefined ? Boolean(t.aktif) : true,
			keterangan: t.keterangan || '',
		}));
	} else {
		const tunjWali = data.tunjangan_wali_kelas !== undefined ? Number(data.tunjangan_wali_kelas) : 150000;
		const tunjHadir = data.tunjangan_kehadiran_per_hari !== undefined ? Number(data.tunjangan_kehadiran_per_hari) : 15000;
		tunjanganPokok = [
			{
				id: 'tunj_wali_kelas',
				nama: 'Tunjangan Tugas Tambahan Wali Kelas',
				kategori: 'wali_kelas',
				tipe: 'per_bulan',
				nominal: tunjWali,
				penerima: 'wali_kelas',
				guru_ids: [],
				aktif: true,
				keterangan: 'Tunjangan struktural otomatis bagi guru yang menjadi wali kelas rombel aktif',
			},
			{
				id: 'tunj_kehadiran',
				nama: 'Tunjangan Kehadiran / Uang Makan Harian',
				kategori: 'kehadiran',
				tipe: 'per_hari',
				nominal: tunjHadir,
				penerima: 'semua',
				guru_ids: [],
				aktif: true,
				keterangan: 'Dikalikan dengan jumlah hari masuk riil guru berdasarkan pengisian jurnal',
			},
		];
	}

	const itemWali = tunjanganPokok.find((t) => t.kategori === 'wali_kelas' || t.id === 'tunj_wali_kelas');
	const itemHadir = tunjanganPokok.find((t) => t.kategori === 'kehadiran' || t.id === 'tunj_kehadiran');
	const tunjWaliVal = itemWali && itemWali.aktif !== false ? Number(itemWali.nominal) : 0;
	const tunjHadirVal = itemHadir && itemHadir.aktif !== false ? Number(itemHadir.nominal) : 0;

	// Tunjangan tambahan
	let tunjanganTambahan = [];
	if (Array.isArray(data.tunjangan_tambahan)) {
		tunjanganTambahan = data.tunjangan_tambahan.map((t) => ({
			id: t.id || `tunj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			nama: t.nama || 'Tunjangan',
			tipe: t.tipe || 'per_bulan',
			nominal: Number(t.nominal) || 0,
			penerima: t.penerima || 'semua',
			guru_ids: Array.isArray(t.guru_ids) ? t.guru_ids : [],
			keterangan: t.keterangan || '',
		}));
	} else {
		tunjanganTambahan = [...DEFAULT_BISAROH_SETTINGS.tunjangan_tambahan];
	}

	// Potongan tetap
	let potonganTetap = [];
	if (Array.isArray(data.potongan_tetap)) {
		potonganTetap = data.potongan_tetap.map((p) => ({
			id: p.id || `pot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			nama: p.nama || 'Potongan',
			nominal: Number(p.nominal) || 0,
			penerima: p.penerima || 'semua',
			guru_ids: Array.isArray(p.guru_ids) ? p.guru_ids : [],
			keterangan: p.keterangan || '',
		}));
	} else {
		potonganTetap = [...DEFAULT_BISAROH_SETTINGS.potongan_tetap];
	}

	// Struktur Jabatan & Gaji Pokok (Struktural Guru & Tendik)
	let daftarJabatan = [];
	if (Array.isArray(data.daftar_jabatan) && data.daftar_jabatan.length > 0) {
		daftarJabatan = data.daftar_jabatan.map((j) => ({
			id: j.id || `jab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			nama: j.nama || 'Jabatan',
			kategori: j.kategori || 'pendidik_struktural', // 'pimpinan' | 'pendidik_struktural' | 'tendik'
			tipe_penggajian: j.tipe_penggajian || 'hybrid', // 'pimpinan' | 'hybrid' | 'gaji_pokok_bulanan'
			gaji_pokok_bulanan: Number(j.gaji_pokok_bulanan) || 0,
			tunjangan_jabatan: Number(j.tunjangan_jabatan) || 0,
			keterangan: j.keterangan || '',
		}));
	} else {
		daftarJabatan = [...DEFAULT_BISAROH_SETTINGS.daftar_jabatan];
	}

	const userJabatanMap =
		typeof data.user_jabatan_map === 'object' && data.user_jabatan_map !== null
			? data.user_jabatan_map
			: {};

	return {
		cut_off_tanggal: cutOff,
		tingkatan_guru: tingkatan,
		default_tingkatan_id: defaultTingkatanId,
		guru_tingkatan_map: guruMap,
		tunjangan_pokok: tunjanganPokok,
		tunjangan_wali_kelas: tunjWaliVal,
		tunjangan_kehadiran_per_hari: tunjHadirVal,
		tunjangan_tambahan: tunjanganTambahan,
		potongan_tetap: potonganTetap,
		daftar_jabatan: daftarJabatan,
		user_jabatan_map: userJabatanMap,
	};
}

/**
 * Mengambil informasi tingkatan guru dan tarif per JP
 */
export function getGuruTingkatanInfo(guruId, settings) {
	const norm = normalizeBisarohSettings(settings);
	const tingkatanId = norm.guru_tingkatan_map[guruId] || norm.default_tingkatan_id;
	const found = norm.tingkatan_guru.find((t) => t.id === tingkatanId) || norm.tingkatan_guru[0] || {
		id: 'default',
		nama: 'Guru Reguler',
		tarif_per_jp: 35000,
	};
	return found;
}

/**
 * Mengambil informasi jabatan struktural pegawai/guru
 */
export function getPegawaiJabatanInfo(userId, settings) {
	if (!userId) return null;
	const norm = normalizeBisarohSettings(settings);
	const jabId = norm.user_jabatan_map[userId];
	if (!jabId) return null;
	const found = norm.daftar_jabatan.find((j) => j.id === jabId);
	return found || null;
}

/**
 * Menghitung rincian lengkap bisaroh/penggajian untuk satu guru atau tenaga kependidikan
 */
export function calculateSingleGuruBisaroh({
	guru,
	isWaliKelas = false,
	totalJP = 0,
	totalHadir = 0,
	settings,
	manualAdj = { bonus: 0, potongan: 0, catatan: '' },
	hariKerjaDefault = 25,
}) {
	const norm = normalizeBisarohSettings(settings);
	const tingkatan = getGuruTingkatanInfo(guru?.id_user, norm);
	const tarifJP = tingkatan.tarif_per_jp;
	const jabatan = getPegawaiJabatanInfo(guru?.id_user, norm);

	const isTendik = jabatan?.tipe_penggajian === 'gaji_pokok_bulanan';
	const isPimpinan = jabatan?.tipe_penggajian === 'pimpinan';
	const isHybrid = jabatan?.tipe_penggajian === 'hybrid';

	// Gaji Pokok Jabatan & Tunjangan Jabatan Struktural
	const gajiPokokJabatan = jabatan ? Number(jabatan.gaji_pokok_bulanan) || 0 : 0;
	const tunjanganJabatan = jabatan ? Number(jabatan.tunjangan_jabatan) || 0 : 0;

	// 1. Honor Pokok Mengajar (JP Riil) - Tenaga non-guru/Tendik tidak mengajar (0 JP)
	const honorMengajar = isTendik ? 0 : totalJP * tarifJP;

	// Hari hadir efektif: jika tendik dan totalHadir 0 (tidak mengisi jurnal), gunakan hariKerjaDefault
	const effectiveHadir = isTendik && totalHadir === 0 ? hariKerjaDefault : totalHadir;

	// 2. Tunjangan Pokok Bawaan Sistem (CRUD)
	const rincianTunjanganPokok = [];
	let totalTunjanganPokok = 0;
	let tunjanganWali = 0;
	let tunjanganHadir = 0;

	norm.tunjangan_pokok.forEach((t) => {
		if (t.aktif === false) return;

		let isEligible = false;
		if (t.kategori === 'wali_kelas' || t.penerima === 'wali_kelas') {
			isEligible = Boolean(isWaliKelas) && !isTendik;
		} else if (t.penerima === 'semua') {
			isEligible = true;
		} else if (t.penerima === 'terpilih') {
			isEligible = Array.isArray(t.guru_ids) && t.guru_ids.includes(guru?.id_user);
		} else {
			isEligible = true;
		}

		if (isEligible) {
			let amount = 0;
			if (t.tipe === 'per_bulan') {
				amount = t.nominal;
			} else if (t.tipe === 'per_hari') {
				amount = effectiveHadir * t.nominal;
			} else if (t.tipe === 'per_jp') {
				amount = (isTendik ? 0 : totalJP) * t.nominal;
			}

			if (amount > 0 || t.nominal > 0) {
				rincianTunjanganPokok.push({
					id: t.id,
					nama: t.nama,
					kategori: t.kategori,
					tipe: t.tipe,
					nominalPerUnit: t.nominal,
					subtotal: amount,
				});
				totalTunjanganPokok += amount;

				if (t.kategori === 'wali_kelas' || t.id === 'tunj_wali_kelas') {
					tunjanganWali += amount;
				}
				if (t.kategori === 'kehadiran' || t.id === 'tunj_kehadiran') {
					tunjanganHadir += amount;
				}
			}
		}
	});

	// 3. Tunjangan Tambahan Dinamis
	const rincianTunjanganTambahan = [];
	let totalTunjanganTambahan = 0;

	norm.tunjangan_tambahan.forEach((t) => {
		const isEligible =
			t.penerima === 'semua' ||
			(Array.isArray(t.guru_ids) && t.guru_ids.includes(guru?.id_user));

		if (isEligible) {
			let amount = 0;
			if (t.tipe === 'per_bulan') {
				amount = t.nominal;
			} else if (t.tipe === 'per_hari') {
				amount = effectiveHadir * t.nominal;
			} else if (t.tipe === 'per_jp') {
				amount = (isTendik ? 0 : totalJP) * t.nominal;
			}

			if (amount > 0) {
				rincianTunjanganTambahan.push({
					id: t.id,
					nama: t.nama,
					tipe: t.tipe,
					nominalPerUnit: t.nominal,
					subtotal: amount,
				});
				totalTunjanganTambahan += amount;
			}
		}
	});

	// 4. Potongan Tetap Dinamis
	const rincianPotonganTetap = [];
	let totalPotonganTetap = 0;

	norm.potongan_tetap.forEach((p) => {
		const isEligible =
			p.penerima === 'semua' ||
			(Array.isArray(p.guru_ids) && p.guru_ids.includes(guru?.id_user));

		if (isEligible && p.nominal > 0) {
			rincianPotonganTetap.push({
				id: p.id,
				nama: p.nama,
				subtotal: p.nominal,
			});
			totalPotonganTetap += p.nominal;
		}
	});

	// 5. Penyesuaian Manual (Bonus / Potongan Insidental)
	const bonusManual = Number(manualAdj?.bonus) || 0;
	const potonganManual = Number(manualAdj?.potongan) || 0;

	// 6. Total Akumulasi (Gaji Pokok Jabatan + Tunjangan Jabatan + Honor JP + Tunjangan Lain - Potongan)
	const totalKotor =
		honorMengajar +
		gajiPokokJabatan +
		tunjanganJabatan +
		totalTunjanganPokok +
		totalTunjanganTambahan +
		bonusManual;
	const totalPotongan = totalPotonganTetap + potonganManual;
	const totalBersih = Math.max(0, totalKotor - totalPotongan);

	return {
		guru,
		isWaliKelas,
		tingkatan,
		tarifJP,
		jabatan,
		isTendik,
		isHybrid,
		isPimpinan,
		gajiPokokJabatan,
		tunjanganJabatan,
		totalJP: isTendik ? 0 : totalJP,
		totalHadir: effectiveHadir,
		honorMengajar,
		totalTunjanganPokok,
		rincianTunjanganPokok,
		tunjanganWali,
		tunjanganHadir,
		totalTunjanganTambahan,
		rincianTunjanganTambahan,
		totalPotonganTetap,
		rincianPotonganTetap,
		bonusManual,
		potonganManual,
		catatanManual: manualAdj?.catatan || '',
		totalKotor,
		totalPotongan,
		totalBersih,
	};
}

/**
 * Menghitung jumlah Jam Pelajaran (JP / JTM) dari string jam_ke
 * Contoh: "1-2" => 2 JP, "3-5" => 3 JP, "1" => 1 JP
 */
export function parseJTM(jamKe) {
	if (!jamKe) return 1;
	const str = String(jamKe).trim();

	// Format range: "1-2", "3 - 5", "1–2"
	const rangeMatch = str.match(/^(\d+)\s*[-–]\s*(\d+)$/);
	if (rangeMatch) {
		const start = parseInt(rangeMatch[1], 10);
		const end = parseInt(rangeMatch[2], 10);
		if (!isNaN(start) && !isNaN(end) && end >= start) {
			return end - start + 1;
		}
	}

	// Format tunggal angka
	const singleNum = parseInt(str, 10);
	if (!isNaN(singleNum) && singleNum > 0 && singleNum < 15) {
		return 1;
	}

	return 1;
}

/**
 * Format angka ke mata uang Rupiah
 */
export function formatRupiah(amount) {
	const num = Number(amount) || 0;
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(num);
}

/**
 * Menghitung periode cut-off bulanan default berdasarkan tanggal cut-off
 */
export function getDefaultCutOffRange(cutOffDate = 25) {
	const now = new Date();
	const today = now.getDate();

	let startDate, endDate;

	if (today > cutOffDate) {
		startDate = new Date(now.getFullYear(), now.getMonth(), cutOffDate + 1);
		endDate = new Date(now.getFullYear(), now.getMonth() + 1, cutOffDate);
	} else {
		startDate = new Date(now.getFullYear(), now.getMonth() - 1, cutOffDate + 1);
		endDate = new Date(now.getFullYear(), now.getMonth(), cutOffDate);
	}

	const toYMD = (d) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};

	return {
		startDate: toYMD(startDate),
		endDate: toYMD(endDate),
	};
}
