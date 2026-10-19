/**
 * Standar Helper Kehadiran & Status Alfa Guru App
 * 
 * Aturan Bisnis:
 * 1. Normalisasi Status: Seluruh variasi ('alfa', 'alpa', 'alpha', 'a', 'A') diseragamkan menjadi 'alfa'.
 * 2. Status Harian: Siswa dikatakan HADIR jika minimal hadir 1 jam pelajaran (JP).
 *    Siswa dikatakan ALFA jika dari jam 1 sampai jam terakhir tidak hadir sama sekali (hadir = 0 JP, tanpa surat sakit/izin).
 * 3. Akumulasi Rekap Bulanan/Semester:
 *    - Seluruh JP Alfa dari sesi KBM mapel diakumulasikan.
 *    - 1 Hari = 7 JP.
 *    - Sisa JP < 5 JP: Tetap hari penuhnya (dibulatkan ke bawah).
 *    - Sisa JP >= 5 JP: Dibulatkan ke atas (+1 Hari).
 *    Contoh:
 *    - 7 JP  -> 1 Hari (sisa 0 JP)
 *    - 11 JP -> 1 Hari (sisa 4 JP)
 *    - 12 JP -> 2 Hari (sisa 5 JP)
 */

export const normStatus = (val) => {
	const s = String(val || '').trim().toLowerCase();
	if (s === 'hadir' || s === 'h') return 'hadir';
	if (s === 'sakit' || s === 's') return 'sakit';
	if (s === 'izin' || s === 'i') return 'izin';
	if (s === 'alfa' || s === 'alpa' || s === 'alpha' || s === 'a') return 'alfa';
	return s;
};

/**
 * Menghitung jumlah JP dari string jam_ke (contoh: "1-2" -> 2, "1-3" -> 3, "4" -> 1)
 */
export const parseJpCount = (jamKe) => {
	if (!jamKe) return 1;
	const str = String(jamKe).trim();
	const rangeMatch = str.match(/^(\d+)\s*[-_]\s*(\d+)$/);
	if (rangeMatch) {
		const start = parseInt(rangeMatch[1], 10);
		const end = parseInt(rangeMatch[2], 10);
		if (!isNaN(start) && !isNaN(end) && end >= start) {
			return end - start + 1;
		}
	}
	if (str.includes(',')) {
		const parts = str.split(',').filter((p) => p.trim());
		return parts.length || 1;
	}
	const single = parseInt(str, 10);
	if (!isNaN(single)) return 1;
	return 1;
};

/**
 * Menghitung konversi total JP Alfa menjadi Hari Alfa untuk Rekap Bulanan/Semester
 * Sesuai aturan:
 * - 1 Hari = 7 JP
 * - Sisa JP >= 5 -> +1 Hari (dibulatkan ke atas)
 * - Sisa JP <= 4 -> +0 Hari (tetap hari penuh)
 */
export const calculateHariAlfa = (totalJpAlfa) => {
	const totalJp = Math.max(0, parseInt(totalJpAlfa || 0, 10));
	const JP_PER_HARI = 7;
	const hariPenuh = Math.floor(totalJp / JP_PER_HARI);
	const sisaJp = totalJp % JP_PER_HARI;
	const hariTambahan = sisaJp >= 5 ? 1 : 0;
	const totalHari = hariPenuh + hariTambahan;

	return {
		totalHari,
		totalJpAlfa: totalJp,
		hariPenuh,
		sisaJp,
		pembulatan: hariTambahan > 0,
		label: `${totalHari} Hari (${totalJp} JP)`,
	};
};

/**
 * Evaluasi status kehadiran harian dari daftar sesi mapel
 * Aturan:
 * - Minimal hadir 1 JP -> Status Harian = "Hadir"
 * - Hadir 0 JP:
 *   - Jika ada Sakit >= Izin -> Status Harian = "Sakit"
 *   - Jika ada Izin > Sakit -> Status Harian = "Izin"
 *   - Jika tanpa Sakit/Izin -> Status Harian = "Alfa"
 */
export const evaluateDailyAttendance = (sessions) => {
	let hCount = 0;
	let sCount = 0;
	let iCount = 0;
	let aCount = 0;
	let totalJpHadir = 0;
	let totalJpAlfa = 0;
	let totalJpRecorded = 0;

	(sessions || []).forEach((sesi) => {
		const st = normStatus(sesi.status);
		const jp = parseJpCount(sesi.jam_ke);
		totalJpRecorded += jp;

		if (st === 'hadir') {
			hCount++;
			totalJpHadir += jp;
		} else if (st === 'sakit') {
			sCount++;
		} else if (st === 'izin') {
			iCount++;
		} else if (st === 'alfa') {
			aCount++;
			totalJpAlfa += jp;
		}
	});

	let recommendedStatus = 'Hadir';
	let recommendedKeterangan = '';
	let isBolosParsial = false;

	if (totalJpRecorded === 0) {
		recommendedStatus = 'Belum Ada Data';
	} else if (totalJpHadir >= 1) {
		// MINIMAL HADIR 1 JAM -> TETAP HADIR HARI INI
		recommendedStatus = 'Hadir';
		if (totalJpAlfa > 0) {
			isBolosParsial = true;
			const jamBolos = sessions
				.filter((ss) => normStatus(ss.status) === 'alfa')
				.map((ss) => `Jam ${ss.jam_ke} (${ss.mapel})`)
				.join(', ');
			recommendedKeterangan = `Hadir ${totalJpHadir} JP, Bolos ${totalJpAlfa} JP di: ${jamBolos}`;
		}
	} else {
		// Hadir 0 JP
		if (sCount >= iCount && sCount > 0) {
			recommendedStatus = 'Sakit';
			recommendedKeterangan =
				sessions.find((ss) => normStatus(ss.status) === 'sakit')?.keterangan ||
				'Surat Keterangan Sakit';
		} else if (iCount > sCount) {
			recommendedStatus = 'Izin';
			recommendedKeterangan =
				sessions.find((ss) => normStatus(ss.status) === 'izin')?.keterangan ||
				'Izin Keperluan Keluarga';
		} else {
			recommendedStatus = 'Alfa';
			recommendedKeterangan = `Tidak hadir dari jam pertama sampai jam terakhir (${totalJpAlfa} JP Alfa)`;
		}
	}

	return {
		recommendedStatus,
		recommendedKeterangan,
		isBolosParsial,
		hCount,
		sCount,
		iCount,
		aCount,
		totalJpHadir,
		totalJpAlfa,
		totalJpRecorded,
	};
};
