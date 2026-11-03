/**
 * Utility functions for attendance status normalization and calculation.
 * Follows AGENTS.md / GEMINI.md normalization rules.
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
 * Counts attendance summary from a list of records with { status }
 * @param {Array<{ status: string }>} records 
 * @returns {{ hadir: number, sakit: number, izin: number, alfa: number, total: number }}
 */
export const calculateAttendanceSummary = (records = []) => {
	let hadir = 0;
	let sakit = 0;
	let izin = 0;
	let alfa = 0;

	(records || []).forEach((r) => {
		const st = normStatus(r.status);
		if (st === 'hadir') hadir++;
		else if (st === 'sakit') sakit++;
		else if (st === 'izin') izin++;
		else if (st === 'alfa') alfa++;
	});

	return {
		hadir,
		sakit,
		izin,
		alfa,
		total: records.length,
	};
};

/**
 * Daftar slot jam pelajaran resmi sekolah (JP) untuk deteksi waktu jam dinding.
 */
export const JP_SLOTS = [
	{ slot: 1, startMin: 435, endMin: 475 }, // 07:15 - 07:55
	{ slot: 2, startMin: 475, endMin: 515 }, // 07:55 - 08:35
	{ slot: 3, startMin: 515, endMin: 555 }, // 08:35 - 09:15
	{ slot: 4, startMin: 555, endMin: 615 }, // 09:15/09:35 - 09:55/10:15
	{ slot: 5, startMin: 615, endMin: 655 }, // 10:15 - 10:55
	{ slot: 6, startMin: 655, endMin: 695 }, // 10:55 - 11:35
	{ slot: 7, startMin: 695, endMin: 735 }, // 11:35 - 12:15
	{ slot: 8, startMin: 735, endMin: 775 }, // 12:15 - 12:55
	{ slot: 9, startMin: 775, endMin: 815 }, // 12:55 - 13:35
	{ slot: 10, startMin: 815, endMin: 855 }, // 13:35 - 14:15
	{ slot: 11, startMin: 855, endMin: 895 }, // 14:15 - 14:55
	{ slot: 12, startMin: 895, endMin: 935 }, // 14:55 - 15:35
];

/**
 * Mencari slot JP terdekat untuk menit jam dinding tertentu (toleransi maks 25 menit).
 */
export const findSlotForTimeMinutes = (min, isEnd = false) => {
	let bestSlot = null;
	let minDiff = 999;
	for (const s of JP_SLOTS) {
		const target = isEnd ? s.endMin : s.startMin;
		const diff = Math.abs(min - target);
		if (diff < minDiff) {
			minDiff = diff;
			bestSlot = s.slot;
		}
	}
	return minDiff <= 25 ? bestSlot : null;
};

/**
 * Preset tombol cepat jam pelajaran yang umum digunakan di sekolah.
 */
export const PRESET_JAM_PELAJARAN = ['1-2', '3-4', '5-6', '7-8', '1-3', '4-6', '5-7'];

/**
 * Menormalisasi string jam pelajaran menjadi format baku seragam (contoh: "1-2", "1-3", atau "4").
 * Mengakali berbagai variasi input guru:
 * - Jam dinding: "7.55-10.15", "07:15-08:35", "07.15 - 08.35" -> "2-4", "1-2"
 * - Deretan slot: "1-2-3", "5-6-7", "4-5-6" -> "1-3", "5-7", "4-6"
 * - Pemisah beragam: "Jam 2-3", "3, 4,", "3 dan 4", "1 - 3" -> "2-3", "3-4", "1-3"
 * @param {string|number} jamVal
 * @returns {string} Contoh: "1-2" atau "4"
 */
export const normalizeJamKe = (jamVal) => {
	if (!jamVal && jamVal !== 0) return '';
	const raw = String(jamVal).trim();
	if (!raw) return '';

	// 1. Cek pola jam dinding: misal "7.55-10.15", "07:15 - 08:35", "07.15 s/d 08.35"
	const timeRangeMatch = raw.match(/^(\d{1,2})[.:](\d{2})\s*(?:[-–—]|s\/?d\.?|sampai)\s*(\d{1,2})[.:](\d{2})$/i);
	if (timeRangeMatch) {
		const sMin = parseInt(timeRangeMatch[1], 10) * 60 + parseInt(timeRangeMatch[2], 10);
		const eMin = parseInt(timeRangeMatch[3], 10) * 60 + parseInt(timeRangeMatch[4], 10);
		const startSlot = findSlotForTimeMinutes(sMin, false);
		const endSlot = findSlotForTimeMinutes(eMin, true);
		if (startSlot && endSlot) {
			return startSlot === endSlot ? String(startSlot) : `${startSlot}-${endSlot}`;
		}
	}

	// 2. Bersihkan kata awalan & penghubung umum: "Jam", "ke", "ke-", "dan"
	const cleaned = raw
		.replace(/^(jam|ke)\s*[-:]?\s*/gi, '')
		.replace(/\s+dan\s+/gi, ',')
		.replace(/\s*(?:[-–—]|s\/?d\.?|sampai)\s*/gi, '-');

	// 3. Ambil semua digit angka valid (antara jam 1 sampai 15)
	const nums = (cleaned.match(/\d+/g) || [])
		.map((n) => parseInt(n, 10))
		.filter((n) => !isNaN(n) && n > 0 && n <= 15);

	if (nums.length === 0) {
		return raw;
	}

	if (nums.length === 1) {
		return String(nums[0]);
	}

	const min = Math.min(...nums);
	const max = Math.max(...nums);
	return min === max ? String(min) : `${min}-${max}`;
};

/**
 * Mem-parsing string representasi jam pelajaran menjadi array integer terurut.
 * Mendukung format: "1", "1-3", "1 - 3", "1–3", "1 s/d 3", "1 sd 3", "1,2", "Jam 1-3", dll.
 * @param {string|number} jamVal 
 * @returns {number[]} Array nomor jam, misal: [1, 2, 3]
 */
export const parseJamPelajaran = (jamVal) => {
	if (!jamVal && jamVal !== 0) return [];
	const norm = normalizeJamKe(jamVal);
	if (!norm) return [];

	// Bersihkan awalan kata non-angka yang umum (misal: "Jam", "ke", "ke-", dll)
	const cleaned = norm.replace(/^(jam|ke)\s*[-:]?\s*/i, '');

	// Pisahkan jika ada pemisah koma atau ampersand (&)
	const segments = cleaned.split(/[,&]/);
	const resultSet = new Set();

	for (const segment of segments) {
		const part = segment.trim();
		if (!part) continue;

		// Cek pola rentang: "1-3", "1 - 3", "1–3", "1—3", "1 s/d 3", "1 sd 3", "1 s.d. 3", "1 sampai 3"
		const rangeMatch = part.match(/^(\d+)\s*(?:[-–—]|s\/?d\.?|sampai)\s*(\d+)$/i);
		if (rangeMatch) {
			const start = parseInt(rangeMatch[1], 10);
			const end = parseInt(rangeMatch[2], 10);
			if (!isNaN(start) && !isNaN(end)) {
				const min = Math.min(start, end);
				const max = Math.max(start, end);
				// Batasi rentang wajar jam pelajaran sekolah (maks 15 jam pelajaran)
				if (max - min <= 15) {
					for (let i = min; i <= max; i++) {
						resultSet.add(i);
					}
					continue;
				}
			}
		}

		// Jika bukan rentang baku, ambil semua digit angka dalam bagian ini
		const numbers = part.match(/\d+/g);
		if (numbers) {
			numbers.forEach((n) => {
				const val = parseInt(n, 10);
				if (!isNaN(val)) resultSet.add(val);
			});
		}
	}

	return Array.from(resultSet).sort((a, b) => a - b);
};

/**
 * Mengecek apakah dua string jam pelajaran bertabrakan / tumpang tindih.
 * @param {string|number} jamA 
 * @param {string|number} jamB 
 * @returns {{ isOverlap: boolean, isExact: boolean, conflicts: number[] }}
 */
export const checkJamOverlap = (jamA, jamB) => {
	const aParsed = parseJamPelajaran(jamA);
	const bParsed = parseJamPelajaran(jamB);

	// Jika dua-duanya tidak memiliki angka (misal teks murni), bandingkan string secara case-insensitive
	if (aParsed.length === 0 || bParsed.length === 0) {
		const sA = String(jamA || '').trim().toLowerCase();
		const sB = String(jamB || '').trim().toLowerCase();
		const exact = sA === sB && sA !== '';
		return {
			isOverlap: exact,
			isExact: exact,
			conflicts: [],
		};
	}

	// Cek apakah sama persis (contoh: [1, 2, 3] dan [1, 2, 3])
	const isExact =
		aParsed.length === bParsed.length &&
		aParsed.every((val, index) => val === bParsed[index]);

	// Cek irisan jam
	const conflicts = aParsed.filter((j) => bParsed.includes(j));

	return {
		isOverlap: conflicts.length > 0,
		isExact,
		conflicts,
	};
};

/**
 * Memeriksa apakah targetJam bertabrakan dengan salah satu sesi yang sudah tersimpan.
 * @param {Array<Object>} sessions - Daftar sesi dari API (memiliki field jam_ke dan id/sesi_id)
 * @param {string|number} targetJam - Jam pelajaran yang ingin dicek
 * @param {string|null} currentSessionId - ID sesi yang sedang diedit (akan diabaikan agar tidak konflik dengan dirinya sendiri)
 * @returns {null | { session: Object, overlapType: 'exact' | 'overlap', conflicts: number[] }}
 */
export const findConflictingSession = (sessions = [], targetJam, currentSessionId = null) => {
	if (!targetJam || !sessions || sessions.length === 0) return null;

	const targetStr = String(targetJam).trim();
	if (!targetStr) return null;

	for (const s of sessions) {
		const sId = s.id || s.sesi_id;
		// Abaikan sesi yang sedang aktif diedit
		if (currentSessionId && String(sId) === String(currentSessionId)) {
			continue;
		}

		const overlap = checkJamOverlap(targetStr, s.jam_ke);
		if (overlap.isOverlap) {
			return {
				session: s,
				overlapType: overlap.isExact ? 'exact' : 'overlap',
				conflicts: overlap.conflicts,
			};
		}
	}

	return null;
};

/**
 * Menghitung konversi total JP Alfa menjadi Hari Alfa untuk Rekap Bulanan/Semester
 * Sesuai aturan:
 * - 1 Hari = 7 JP
 * - Sisa JP >= 5 -> +1 Hari (dibulatkan ke atas)
 * - Sisa JP <= 4 -> +0 Hari (tetap hari penuh)
 * Contoh:
 * - 7 JP  -> 1 Hari (sisa 0 JP)
 * - 11 JP -> 1 Hari (sisa 4 JP)
 * - 12 JP -> 2 Hari (sisa 5 JP)
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
 *   - Jika tanpa Sakit/Izin -> Status Harian = "Alfa" (jam 1 sampai jam terakhir tidak hadir)
 */
export const evaluateDailyAttendance = (sessions = []) => {
	let hCount = 0;
	let sCount = 0;
	let iCount = 0;
	let aCount = 0;
	let totalJpHadir = 0;
	let totalJpAlfa = 0;
	let totalJpRecorded = 0;

	(sessions || []).forEach((sesi) => {
		const st = normStatus(sesi.status);
		const jpList = parseJamPelajaran(sesi.jam_ke);
		const jp = jpList.length > 0 ? jpList.length : 1;
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
		// ATURAN: MINIMAL HADIR 1 JAM -> TETAP HADIR
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
		// Hadir 0 JP sama sekali
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
			recommendedKeterangan = `Tidak hadir dari jam 1 sampai jam terakhir (${totalJpAlfa} JP Alfa)`;
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

/**
 * Memformat array nomor jam menjadi format string yang rapi.
 * Contoh: [1] -> "1", [1, 2, 3] -> "1-3", [2, 3] -> "2-3", [1, 3] -> "1, 3"
 * @param {number[]} hours 
 * @returns {string}
 */
export const formatJamPelajaran = (hours = []) => {
	if (!Array.isArray(hours) || hours.length === 0) return '';
	const sorted = [...new Set(hours.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)))].sort((a, b) => a - b);
	if (sorted.length === 0) return '';
	if (sorted.length === 1) return String(sorted[0]);

	// Cek apakah berurutan (kontigu)
	let isConsecutive = true;
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] !== sorted[i - 1] + 1) {
			isConsecutive = false;
			break;
		}
	}

	if (isConsecutive) {
		return `${sorted[0]}-${sorted[sorted.length - 1]}`;
	}
	return sorted.join(', ');
};

/**
 * Menghitung opsi titik pemecahan (split) untuk sesi multi-jam.
 * Contoh: jamVal = "1-3" (hours [1, 2, 3])
 * Menghasilkan:
 * [
 *   {
 *     splitIndex: 1,
 *     part1: "1",
 *     part2: "2-3",
 *     startHourLeft: 2,
 *     hoursPart1: [1],
 *     hoursPart2: [2, 3],
 *     label: "Keluar mulai Jam ke-2 (Sesi 1: Jam 1 • Sesi 2: Jam 2-3)"
 *   },
 *   {
 *     splitIndex: 2,
 *     part1: "1-2",
 *     part2: "3",
 *     startHourLeft: 3,
 *     hoursPart1: [1, 2],
 *     hoursPart2: [3],
 *     label: "Keluar mulai Jam ke-3 (Sesi 1: Jam 1-2 • Sesi 2: Jam 3)"
 *   }
 * ]
 * @param {string|number} jamVal 
 * @returns {Array<Object>}
 */
export const getPossibleSplits = (jamVal) => {
	const parsed = parseJamPelajaran(jamVal);
	if (!parsed || parsed.length < 2) return [];

	const options = [];
	for (let i = 1; i < parsed.length; i++) {
		const part1 = parsed.slice(0, i);
		const part2 = parsed.slice(i);
		const part1Str = formatJamPelajaran(part1);
		const part2Str = formatJamPelajaran(part2);
		const startHourLeft = part2[0];

		options.push({
			splitIndex: i,
			part1: part1Str,
			part2: part2Str,
			startHourLeft,
			hoursPart1: part1,
			hoursPart2: part2,
			label: `Keluar mulai Jam ke-${startHourLeft} (Sesi 1: Jam ${part1Str} • Sesi 2: Jam ${part2Str})`,
		});
	}

	return options;
};


