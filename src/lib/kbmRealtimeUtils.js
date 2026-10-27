/**
 * Utilitas untuk pelacakan Kehadiran Real-Time KBM Guru.
 * Mengintegrasikan waktu presensi mapel siswa (waktu mulai) dan waktu simpan jurnal (waktu selesai)
 * dalam zona waktu Asia/Jakarta (WIB).
 */

import { getTodayDateString } from './dateUtils';

/**
 * Format timestamp atau Date object menjadi string "HH:mm" dalam zona waktu Asia/Jakarta (WIB).
 * @param {Date|string|number} [date=new Date()]
 * @param {boolean} [withSeconds=false]
 * @returns {string} Contoh: "07:33" atau "07:33:15"
 */
export const getTimeWIB = (date = new Date(), withSeconds = false) => {
	if (!date) return '';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) {
		// Jika formatnya sudah string "HH:mm" atau "HH:mm:ss"
		const match = String(date).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
		if (match) {
			const hh = match[1].padStart(2, '0');
			const mm = match[2];
			const ss = match[3] || '00';
			return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
		}
		return '';
	}

	return d.toLocaleTimeString('id-ID', {
		timeZone: 'Asia/Jakarta',
		hour: '2-digit',
		minute: '2-digit',
		second: withSeconds ? '2-digit' : undefined,
		hour12: false,
	}).replace(/\./g, ':');
};

/**
 * Mengubah string waktu "HH:mm" atau "HH:mm:ss" menjadi total menit dari jam 00:00.
 * Contoh: "07:30" => 450 menit.
 * @param {string} timeStr
 * @returns {number}
 */
export const parseTimeToMinutes = (timeStr) => {
	if (!timeStr) return 0;
	const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
	if (!match) return 0;
	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	return hours * 60 + minutes;
};

/**
 * Menghitung selisih waktu dalam satuan menit antara jam mulai dan jam selesai.
 * @param {string} startStr - Format "HH:mm"
 * @param {string} endStr - Format "HH:mm"
 * @returns {number} Menit (selalu >= 0)
 */
export const calculateDurationMinutes = (startStr, endStr) => {
	if (!startStr || !endStr) return 0;
	const start = parseTimeToMinutes(startStr);
	const end = parseTimeToMinutes(endStr);
	if (end >= start) {
		return end - start;
	}
	// Jika melewati tengah malam (edge case)
	return (1440 - start) + end;
};

/**
 * Format menit menjadi string ramah pengguna.
 * Contoh: 85 => "1 Jam 25 Menit" atau "85 mnt"
 * @param {number} minutes
 * @param {boolean} [shortFormat=true]
 * @returns {string}
 */
export const formatDurationString = (minutes, shortFormat = true) => {
	const mins = Math.max(0, parseInt(minutes || 0, 10));
	if (mins === 0) return '0 mnt';
	if (shortFormat) {
		return `${mins} mnt`;
	}
	const jam = Math.floor(mins / 60);
	const sisaMnt = mins % 60;
	if (jam > 0 && sisaMnt > 0) return `${jam} Jam ${sisaMnt} Menit`;
	if (jam > 0) return `${jam} Jam`;
	return `${sisaMnt} Menit`;
};

/**
 * Alokasi jam pelajaran resmi sekolah (JP).
 * Digunakan sebagai baseline audit keterlambatan masuk dan kelewatan jam tutup jurnal.
 */
/**
 * Alokasi jam pelajaran resmi sekolah (JP) untuk hari Ahad / Minggu & Senin.
 * Khusus Ahad & Senin, istirahat ke-1 dilakukan setelah JP 3 (09:15 - 09:35),
 * sehingga JP ke-4 dimulai pukul 09:35 - 10:15 WIB.
 */
export const SCHEDULE_SLOTS_AHAD_SENIN = {
	1: { start: '07:15', end: '07:55' },
	2: { start: '07:55', end: '08:35' },
	3: { start: '08:35', end: '09:15' },
	4: { start: '09:35', end: '10:15' }, // Istirahat 09:15 - 09:35
	5: { start: '10:15', end: '10:55' },
	6: { start: '10:55', end: '11:35' },
	7: { start: '11:35', end: '12:15' },
	8: { start: '12:15', end: '12:55' },
	9: { start: '12:55', end: '13:35' },
};

/**
 * Alokasi jam pelajaran resmi sekolah (JP) untuk hari reguler (Selasa, Rabu, Kamis, Sabtu).
 * JP ke-4 berlangsung pukul 09:15 - 09:55 WIB, kemudian dilanjutkan istirahat (09:55 - 10:15).
 */
export const SCHEDULE_SLOTS_REGULER = {
	1: { start: '07:15', end: '07:55' },
	2: { start: '07:55', end: '08:35' },
	3: { start: '08:35', end: '09:15' },
	4: { start: '09:15', end: '09:55' }, // Istirahat 09:55 - 10:15
	5: { start: '10:15', end: '10:55' },
	6: { start: '10:55', end: '11:35' },
	7: { start: '11:35', end: '12:15' },
	8: { start: '12:15', end: '12:55' },
	9: { start: '12:55', end: '13:35' },
};

export const STANDARD_SCHEDULE_SLOTS = SCHEDULE_SLOTS_REGULER;

/**
 * Mendapatkan nama hari dalam Bahasa Indonesia dari tanggal/Date.
 * @param {string|Date} dateVal - Format "YYYY-MM-DD" atau Date
 * @returns {string} Contoh: "Senin", "Minggu"
 */
export const getDayNameID = (dateVal) => {
	if (!dateVal) return '';
	const dateStr = typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)
		? `${dateVal}T12:00:00`
		: dateVal;
	const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
	if (isNaN(d.getTime())) return '';
	const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
	return names[d.getDay()] || '';
};

/**
 * Parsing representasi jam_ke (contoh: "1-2", "Jam 3", "4-5") menjadi array nomor slot integer.
 * @param {string|number} jamKeStr
 * @returns {number[]} Contoh: [1, 2]
 */
export const parseJamKeSlots = (jamKeStr) => {
	if (!jamKeStr && jamKeStr !== 0) return [];
	const raw = String(jamKeStr).trim().replace(/^(jam|ke)\s*[-:]?\s*/i, '');
	const matches = raw.match(/\d+/g);
	if (!matches || matches.length === 0) return [];
	const nums = matches.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
	if (nums.length === 0) return [];
	if (nums.length === 1) return [nums[0]];
	const min = Math.min(...nums);
	const max = Math.max(...nums);
	if (max - min <= 12) {
		const result = [];
		for (let i = min; i <= max; i++) result.push(i);
		return result;
	}
	return nums;
};

/**
 * Mengambil jam mulai dan selesai resmi berdasarkan string jam_ke dan hari/tanggal.
 * Secara otomatis membedakan pola JP ke-4 hari Ahad/Senin (09:35 - 10:15) vs Reguler (09:15 - 09:55).
 * @param {string|number} jamKeStr - Contoh: "1-2" atau "4"
 * @param {string|Date} [tanggalOrHari] - Tanggal "YYYY-MM-DD" atau nama hari "Ahad"/"Senin"
 * @returns {{ start: string, end: string, slots: number[], hari: string, isAhadSenin: boolean } | null}
 */
export const getExpectedScheduleTimes = (jamKeStr, tanggalOrHari = null) => {
	const slots = parseJamKeSlots(jamKeStr);
	if (slots.length === 0) return null;

	let dayName = '';
	if (tanggalOrHari) {
		const s = String(tanggalOrHari).trim();
		if (/^\d{4}-\d{2}-\d{2}/.test(s) || tanggalOrHari instanceof Date) {
			dayName = getDayNameID(tanggalOrHari);
		} else {
			dayName = s;
		}
	} else {
		dayName = getDayNameID(new Date());
	}

	const normalizedDay = String(dayName || '').trim().toLowerCase();
	const isAhadSenin = normalizedDay === 'minggu' || normalizedDay === 'ahad' || normalizedDay === 'senin';
	const scheduleSlots = isAhadSenin ? SCHEDULE_SLOTS_AHAD_SENIN : SCHEDULE_SLOTS_REGULER;

	const firstSlot = slots[0];
	const lastSlot = slots[slots.length - 1];
	const startInfo = scheduleSlots[firstSlot];
	const endInfo = scheduleSlots[lastSlot];
	if (!startInfo || !endInfo) return null;

	return {
		start: startInfo.start,
		end: endInfo.end,
		slots,
		hari: dayName,
		isAhadSenin,
	};
};

/**
 * Menentukan status audit kehadiran KBM berdasarkan waktu mulai, waktu selesai, durasi, dan jadwal resmi.
 * @param {Object} params
 * @param {string} params.jamMulai - Waktu presensi siswa real-time "HH:mm"
 * @param {string} params.jamSelesai - Waktu simpan jurnal real-time "HH:mm"
 * @param {number} [params.durasiMenit] - Durasi mengajar
 * @param {string} params.tanggal - "YYYY-MM-DD"
 * @param {string} [params.jamKe] - "1-2"
 * @param {string} [params.jadwalJamMulai] - Jam mulai jadwal eksplisit (opsional)
 * @param {string} [params.jadwalJamSelesai] - Jam selesai jadwal eksplisit (opsional)
 * @returns {string} Status audit: 'Tepat Waktu' | 'Selesai Terlalu Cepat' | 'Terlambat Masuk' | 'Ditutup Terlambat' | 'Terlambat Masuk & Ditutup Terlambat' | 'Susulan / Tanpa Presensi' | 'Input Susulan'
 */
export const determineKBMStatus = ({
	jamMulai,
	jamSelesai,
	durasiMenit,
	tanggal,
	jamKe,
	jadwalJamMulai,
	jadwalJamSelesai,
}) => {
	const todayStr = getTodayDateString();

	// 1. Jika tanggal jurnal bukan hari ini, artinya diisi susulan di hari lain
	if (tanggal && tanggal !== todayStr) {
		return 'Input Susulan';
	}

	// 2. Jika tidak ada jam mulai (guru tidak absen siswa di awal KBM)
	if (!jamMulai) {
		return 'Susulan / Tanpa Presensi';
	}

	const durasi = durasiMenit !== undefined ? durasiMenit : calculateDurationMinutes(jamMulai, jamSelesai);

	// 3. Jika durasi mengajar kurang dari 20 menit (anomali / terburu-buru ditutup)
	if (durasi > 0 && durasi < 20) {
		return 'Selesai Terlalu Cepat';
	}

	// 4. Evaluasi terhadap jadwal resmi KBM (memperhitungkan variasi hari Ahad/Senin vs Reguler)
	const expected = getExpectedScheduleTimes(jamKe, tanggal);
	const schedStart = jadwalJamMulai || expected?.start;
	const schedEnd = jadwalJamSelesai || expected?.end;

	let isLateStart = false;
	let isLateClose = false;

	if (schedStart) {
		const actualStartMins = parseTimeToMinutes(jamMulai);
		const schedStartMins = parseTimeToMinutes(schedStart);
		// Toleransi keterlambatan masuk: 15 menit dari jam mulai jadwal
		if (actualStartMins > schedStartMins + 15) {
			isLateStart = true;
		}
	}

	if (schedEnd && jamSelesai) {
		const actualEndMins = parseTimeToMinutes(jamSelesai);
		const schedEndMins = parseTimeToMinutes(schedEnd);
		// Toleransi kelewatan jam tutup jurnal: 45 menit setelah jam selesai KBM
		// Contoh: Jika KBM selesai jam 08:35, guru diharapkan menutup jurnal sebelum 09:20.
		if (actualEndMins > schedEndMins + 45) {
			isLateClose = true;
		}
	}

	if (isLateStart && isLateClose) {
		return 'Terlambat Masuk & Ditutup Terlambat';
	}
	if (isLateStart) {
		return 'Terlambat Masuk';
	}
	if (isLateClose) {
		return 'Ditutup Terlambat';
	}

	// Normal tepat waktu
	return 'Tepat Waktu';
};

/**
 * Metadata styling untuk badge status kehadiran KBM (tema Neobrutalism).
 * @param {string} status
 * @returns {{ label: string, bg: string, text: string, border: string, icon: string }}
 */
export const getKBMStatusBadge = (status) => {
	const s = String(status || '').trim().toLowerCase();

	if (s.includes('terlambat') && (s.includes('tutup') || s.includes('lewat'))) {
		return {
			label: 'Terlambat & Lewat Jam',
			bg: 'bg-rose-50',
			text: 'text-rose-900',
			border: 'border-rose-500',
			icon: '⚠️',
		};
	}

	if (s.includes('terlambat masuk') || (s.includes('terlambat') && !s.includes('tutup'))) {
		return {
			label: 'Terlambat Masuk (> 15m)',
			bg: 'bg-amber-50',
			text: 'text-amber-900',
			border: 'border-[#F5C518]',
			icon: '🟡',
		};
	}

	if (s.includes('ditutup terlambat') || s.includes('lewat jam') || s.includes('kelewatan')) {
		return {
			label: 'Ditutup Terlambat (> 45m)',
			bg: 'bg-orange-50',
			text: 'text-orange-900',
			border: 'border-orange-500',
			icon: '⏳',
		};
	}

	if (s.includes('terlalu cepat') || s.includes('anomali')) {
		return {
			label: 'Selesai Cepat (< 20m)',
			bg: 'bg-red-50',
			text: 'text-[#E8451A]',
			border: 'border-[#E8451A]',
			icon: '⚠️',
		};
	}

	if (s.includes('tanpa presensi')) {
		return {
			label: 'Tanpa Presensi Siswa',
			bg: 'bg-indigo-50',
			text: 'text-indigo-800',
			border: 'border-[#6366F1]',
			icon: 'ℹ️',
		};
	}

	if (s.includes('susulan')) {
		return {
			label: 'Input Susulan',
			bg: 'bg-slate-100',
			text: 'text-slate-700',
			border: 'border-slate-400',
			icon: '🕒',
		};
	}

	if (s.includes('kegiatan sekolah') || s.includes('hari santri') || s.includes('event')) {
		return {
			label: 'Kegiatan Sekolah',
			bg: 'bg-purple-50',
			text: 'text-purple-900',
			border: 'border-purple-500',
			icon: '🎪',
		};
	}

	if (s.includes('tugas luar') || s.includes('dinas luar') || s.includes('dinas')) {
		return {
			label: 'Tugas Luar / Dinas',
			bg: 'bg-blue-50',
			text: 'text-blue-900',
			border: 'border-blue-500',
			icon: '✈️',
		};
	}

	if (s.includes('tepat') || s === 'hadir penuh' || s === 'normal') {
		return {
			label: 'Tepat Waktu',
			bg: 'bg-[#E6F7F4]',
			text: 'text-[#007A6C]',
			border: 'border-[#00A693]',
			icon: '🟢',
		};
	}

	return {
		label: status || 'Normal',
		bg: 'bg-gray-100',
		text: 'text-gray-800',
		border: 'border-gray-400',
		icon: '⏱️',
	};
};
