/**
 * Utility Helper untuk Konversi Nilai Ekstrakurikuler (Aswaja & Khot)
 * Digunakan untuk menyinkronkan nilai angka (0-100) dari guru mapel ke format Predikat & Keterangan Rapor.
 */

// 1. Konversi Nilai Angka ke Predikat Resmi
export const getPredikatFromNilai = (nilai) => {
	const num = parseFloat(nilai);
	if (isNaN(num)) return 'Baik';
	if (num >= 85) return 'Sangat Baik';
	if (num >= 75) return 'Baik';
	if (num >= 60) return 'Cukup';
	return 'Kurang';
};

// 2. Placeholder Contoh Narasi berdasarkan Mata Pelajaran / Kegiatan dan Predikat (Hanya Sebagai Placeholder / Panduan)
export const getPlaceholderNarasiEkskul = (mapelIdOrName = '', predikat = 'Baik') => {
	const str = String(mapelIdOrName || '').toUpperCase();
	const pred = String(predikat || '').trim();

	// A. Aswaja (Ke-NU-an)
	if (str === 'MP-ASW' || str.includes('ASWAJA') || str.includes('KE-NU-AN')) {
		if (pred === 'Sangat Baik' || pred === 'A') {
			return 'Contoh: Sangat aktif, tekun, dan istiqomah dalam mendalami keaswajaan serta amaliah keagamaan warga Nahdliyin.';
		}
		if (pred === 'Baik' || pred === 'B') {
			return 'Contoh: Aktif dan tertib mengikuti kegiatan keaswajaan dan pembiasaan amaliah keagamaan.';
		}
		if (pred === 'Cukup' || pred === 'C') {
			return 'Contoh: Cukup aktif dalam kegiatan keaswajaan, perlu meningkatkan kedisiplinan dan amaliah keagamaan.';
		}
		return 'Contoh: Perlu pembinaan dan bimbingan lebih intensif dalam kegiatan keaswajaan dan amaliah ibadah.';
	}

	// B. Khot (Kaligrafi)
	if (str === 'MP-KHOT' || str.includes('KHOT') || str.includes('KHAT') || str.includes('KALIGRAFI')) {
		if (pred === 'Sangat Baik' || pred === 'A') {
			return 'Contoh: Mampu menulis kaidah kaligrafi khat naskhi dan tulisan Arab dengan sangat rapi, proporsional, dan indah.';
		}
		if (pred === 'Baik' || pred === 'B') {
			return 'Contoh: Mampu menulis kaidah khat kaligrafi dengan baik, rapi, dan tekun.';
		}
		if (pred === 'Cukup' || pred === 'C') {
			return 'Contoh: Cukup mampu menulis kaligrafi khat, perlu lebih teliti pada ketepatan kaidah huruf dan harakat.';
		}
		return 'Contoh: Perlu latihan intensif dalam memegang pena khat dan merangkai kaidah huruf kaligrafi.';
	}

	// C. Pramuka (Praja Muda Karana)
	if (str.includes('PRAMUKA')) {
		if (pred === 'Sangat Baik' || pred === 'A') {
			return 'Sangat aktif, berdisiplin tinggi, dan berjiwa kepemimpinan dalam kegiatan kepramukaan.';
		}
		if (pred === 'Baik' || pred === 'B') {
			return 'Aktif dan tertib mengikuti seluruh kegiatan kepramukaan mingguan.';
		}
		if (pred === 'Cukup' || pred === 'C') {
			return 'Cukup aktif dalam kegiatan kepramukaan, perlu meningkatkan inisiatif dan kedisiplinan.';
		}
		return 'Perlu dorongan dan kehadiran yang lebih aktif dalam latihan kepramukaan mingguan.';
	}

	// Fallback Default
	if (pred === 'Sangat Baik' || pred === 'A') {
		return 'Contoh: Menunjukkan antusiasme, dedikasi, dan penguasaan materi kegiatan yang sangat memuaskan.';
	}
	if (pred === 'Baik' || pred === 'B') {
		return 'Contoh: Aktif berpartisipasi dan menyelesaikan seluruh agenda kegiatan dengan baik.';
	}
	if (pred === 'Cukup' || pred === 'C') {
		return 'Contoh: Cukup aktif berpartisipasi, perlu meningkatkan motivasi dan konsistensi kegiatan.';
	}
	return 'Contoh: Perlu bimbingan dan keaktifan yang lebih konsisten dalam mengikuti kegiatan.';
};

// 2b. Nilai Default Tersimpan: Aswaja & Khot tidak diisi teks baku otomatis (dijadikan placeholder saja)
export const getDefaultNarasiEkskul = (mapelIdOrName = '', predikat = 'Baik') => {
	const str = String(mapelIdOrName || '').toUpperCase();
	// Hapus template narasi otomatis untuk Aswaja dan Khot (dijadikan placeholder murni)
	if (str === 'MP-ASW' || str === 'MP-KHOT' || str.includes('ASWAJA') || str.includes('KHOT') || str.includes('KALIGRAFI')) {
		return '';
	}

	// Khusus Pramuka wajib memiliki narasi kepramukaan
	if (str.includes('PRAMUKA')) {
		const pred = String(predikat || '').trim();
		if (pred === 'Sangat Baik' || pred === 'A') return 'Sangat aktif, berdisiplin tinggi, dan berjiwa kepemimpinan dalam kegiatan kepramukaan.';
		if (pred === 'Baik' || pred === 'B') return 'Aktif dan tertib mengikuti seluruh kegiatan kepramukaan mingguan.';
		if (pred === 'Cukup' || pred === 'C') return 'Cukup aktif dalam kegiatan kepramukaan, perlu meningkatkan inisiatif dan kedisiplinan.';
		return 'Perlu dorongan dan kehadiran yang lebih aktif dalam latihan kepramukaan mingguan.';
	}

	return '';
};

// 3. Deteksi Apakah Suatu Mapel Termasuk Kategori Ekskul Wajib Pesantren (Opsi A: Database-driven via kelompok === 'Ekskul')
export const isEkskulMapel = (mapelIdOrName = '', mapelObj = null) => {
	// A. Jika objek mapel langsung diteruskan atau parameter pertama berupa objek mapel
	const obj = mapelObj || (typeof mapelIdOrName === 'object' && mapelIdOrName !== null ? mapelIdOrName : null);
	if (obj && obj.kelompok !== undefined) {
		return obj.kelompok === 'Ekskul';
	}

	// B. Fallback toleran string ID atau Nama
	const str = String((obj ? obj.id || obj.mapel : mapelIdOrName) || '').toUpperCase();
	return (
		str === 'MP-ASW' ||
		str === 'MP-KHOT' ||
		str.includes('ASWAJA') ||
		str.includes('KHOT') ||
		str.includes('KHAT') ||
		str.includes('KALIGRAFI')
	);
};

// 4. Nama Resmi Ekskul untuk Rapor
export const getOfficialEkskulName = (mapelIdOrName = '', mapelObj = null) => {
	const obj = mapelObj || (typeof mapelIdOrName === 'object' && mapelIdOrName !== null ? mapelIdOrName : null);
	if (obj && obj.nama_resmi) {
		return obj.nama_resmi;
	}

	const str = String((obj ? obj.id || obj.mapel : mapelIdOrName) || '').toUpperCase();
	if (str === 'MP-ASW' || str.includes('ASWAJA')) return 'Aswaja (Ke-NU-an)';
	if (str === 'MP-KHOT' || str.includes('KHOT') || str.includes('KALIGRAFI')) return 'Khot (Kaligrafi)';
	if (str.includes('PRAMUKA')) return 'Praja Muda Karana (Pramuka)';
	return obj ? obj.mapel || obj.nama_resmi || '' : String(mapelIdOrName || '');
};

// 5. Konversi Komprehensif Skor Angka Mapel ke Obyek Data Ekskul
export const convertMapelScoreToEkskul = (mapelIdOrName, scoreAngka, manualDeskripsi = '') => {
	const nama_ekskul = getOfficialEkskulName(mapelIdOrName);
	const numScore = parseFloat(scoreAngka);
	const predikat = isNaN(numScore) ? 'Baik' : getPredikatFromNilai(numScore);
	const cleanManual = String(manualDeskripsi || '').trim();
	const defaultNar = getDefaultNarasiEkskul(mapelIdOrName, predikat);
	const keterangan = cleanManual && cleanManual !== '-' ? cleanManual : (defaultNar || '-');

	return {
		nama_ekskul,
		nama_kegiatan: nama_ekskul, // alias untuk kompatibilitas DB
		predikat,
		keterangan,
		nilai_angka: !isNaN(numScore) ? numScore : null,
		is_auto_synced: true,
	};
};

// 6. Target Jenjang / Tingkat Kelas Resmi untuk Setiap Ekstrakurikuler
export const getEkskulTargetTingkat = (mapelIdOrName = '') => {
	const str = String(mapelIdOrName || '').toUpperCase();
	// Aswaja hanya wajib/diajarkan di kelas 9
	if (str === 'MP-ASW' || str.includes('ASWAJA') || str.includes('KE-NU-AN')) {
		return [9];
	}
	// Khot, Pramuka, dan ekskul lainnya berlaku untuk seluruh tingkat (7, 8, 9)
	return [7, 8, 9];
};

// 7. Periksa Apakah Suatu Ekstrakurikuler Berlaku untuk Tingkat Kelas Tertentu
export const isEkskulApplicableForTingkat = (mapelIdOrName = '', tingkat, customTingkat = null) => {
	const numTingkat = parseInt(tingkat, 10);
	if (isNaN(numTingkat)) return true;

	const obj = typeof mapelIdOrName === 'object' && mapelIdOrName !== null ? mapelIdOrName : null;
	const activeCustomTingkat = customTingkat !== null && customTingkat !== undefined ? customTingkat : obj?.tingkat;

	// 1. Jika ada customTingkat dari master_ekstrakurikuler atau mapel.tingkat
	if (activeCustomTingkat !== null && activeCustomTingkat !== undefined) {
		if (activeCustomTingkat === 'all' || activeCustomTingkat === 'semua' || activeCustomTingkat === 'Semua Tingkat') {
			return true;
		}
		if (Array.isArray(activeCustomTingkat)) {
			if (activeCustomTingkat.includes('all') || activeCustomTingkat.includes('semua')) return true;
			return activeCustomTingkat.map(Number).includes(numTingkat);
		}
		const singleNum = parseInt(activeCustomTingkat, 10);
		if (!isNaN(singleNum)) return singleNum === numTingkat;
	}

	// 2. Gunakan aturan target tingkat resmi
	const allowed = getEkskulTargetTingkat(obj ? obj.id || obj.mapel : mapelIdOrName);
	return allowed.includes(numTingkat);
};

// 8. Normalisasi Array Tingkat Kelas ([7, 8, 9]) untuk Fleksibilitas Multi-Select Checkbox
export const normalizeTingkatArray = (tingkatVal, mapelName = '') => {
	if (Array.isArray(tingkatVal)) {
		const nums = tingkatVal
			.map((x) => (x === 'all' || x === 'semua' ? [7, 8, 9] : parseInt(x, 10)))
			.flat()
			.filter((n) => [7, 8, 9].includes(n));
		if (nums.length > 0) return [...new Set(nums)].sort((a, b) => a - b);
	}
	if (typeof tingkatVal === 'string') {
		if (tingkatVal === 'semua' || tingkatVal === 'all') return [7, 8, 9];
		const num = parseInt(tingkatVal, 10);
		if ([7, 8, 9].includes(num)) return [num];
	}
	if (typeof tingkatVal === 'number' && [7, 8, 9].includes(tingkatVal)) {
		return [tingkatVal];
	}
	const s = String(mapelName || '').toLowerCase();
	if (s.includes('aswaja')) return [9];
	return [7, 8, 9];
};
