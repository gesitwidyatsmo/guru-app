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
 * Menentukan status audit kehadiran KBM berdasarkan waktu mulai, waktu selesai, dan durasi.
 * @param {Object} params
 * @param {string} params.jamMulai
 * @param {string} params.jamSelesai
 * @param {number} params.durasiMenit
 * @param {string} params.tanggal - "YYYY-MM-DD"
 * @param {string} [params.jamKe] - "1-2"
 * @returns {string} Status audit: 'Tepat Waktu' | 'Selesai Terlalu Cepat' | 'Terlambat Masuk' | 'Susulan / Tanpa Presensi' | 'Input Susulan'
 */
export const determineKBMStatus = ({
	jamMulai,
	jamSelesai,
	durasiMenit,
	tanggal,
}) => {
	const todayStr = getTodayDateString();

	// Jika tanggal jurnal bukan hari ini, artinya diisi susulan
	if (tanggal && tanggal !== todayStr) {
		return 'Input Susulan';
	}

	// Jika tidak ada jam mulai (guru tidak absen siswa di awal)
	if (!jamMulai) {
		return 'Susulan / Tanpa Presensi';
	}

	const durasi = durasiMenit !== undefined ? durasiMenit : calculateDurationMinutes(jamMulai, jamSelesai);

	// Jika durasi mengajar kurang dari 20 menit (indikasi anomali/terlalu cepat ditutup)
	if (durasi > 0 && durasi < 20) {
		return 'Selesai Terlalu Cepat';
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

	if (s.includes('tepat') || s === 'hadir penuh' || s === 'normal') {
		return {
			label: 'Tepat Waktu',
			bg: 'bg-[#E6F7F4]',
			text: 'text-[#007A6C]',
			border: 'border-[#00A693]',
			icon: '🟢',
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

	if (s.includes('terlambat')) {
		return {
			label: 'Terlambat Masuk',
			bg: 'bg-amber-50',
			text: 'text-amber-800',
			border: 'border-[#F5C518]',
			icon: '🟡',
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

	return {
		label: status || 'Normal',
		bg: 'bg-gray-100',
		text: 'text-gray-800',
		border: 'border-gray-400',
		icon: '⏱️',
	};
};
