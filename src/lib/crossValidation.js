/**
 * Cross-Validation Utility: Jurnal Mengajar vs Absensi Mapel Siswa
 * Digunakan untuk audit integritas KBM dan kelayakan bisaroh guru.
 * Mengikuti aturan normalisasi status absensi di AGENTS.md / GEMINI.md.
 */

import { checkJamOverlap } from './absensiUtils.js';

/**
 * Normalisasi status absensi sesuai aturan wajib AGENTS.md / GEMINI.md
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
 * Menghitung ringkasan kehadiran siswa dari daftar record
 */
export const summarizeAttendance = (records = []) => {
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
 * Membuat normalisasi composite key untuk pencocokan jurnal dan absensi
 */
export const getCrossMatchKey = (tanggal, kelas, mapel) => {
	const tgl = String(tanggal || '').slice(0, 10).trim();
	const kls = String(kelas || '').trim().toLowerCase();
	const mpl = String(mapel || '').trim().toLowerCase();
	return `${tgl}__${kls}__${mpl}`;
};

/**
 * Membangun Map pencarian cepat O(1) dari daftar sesi absensi mapel
 * @param {Array} sessions - Array record dari tabel absensi_mapel
 * @returns {Map<string, Array>} Map dengan key composite dan value array session
 */
export const buildCrossValidationMap = (sessions = []) => {
	const map = new Map();

	(sessions || []).forEach((s) => {
		const key = getCrossMatchKey(s.tanggal, s.kelas, s.mapel);
		const rawDetails = s.data_absensi || s.absensi_mapel_siswa || [];
		const summary = s.summary || summarizeAttendance(rawDetails);

		const enrichedSession = {
			...s,
			tanggal: String(s.tanggal || '').slice(0, 10),
			summary,
			totalSiswa: summary.total,
		};

		if (!map.has(key)) {
			map.set(key, [enrichedSession]);
		} else {
			map.get(key).push(enrichedSession);
		}
	});

	return map;
};

/**
 * Mencocokkan satu entri jurnal dengan sesi absensi siswa terkait
 * @param {Object} jurnal - Entri jurnal dari tabel jurnal
 * @param {Map} crossMap - Map hasil dari buildCrossValidationMap
 * @returns {Object} Hasil validasi silang { isValid, status, session, summary, studentCount, label }
 */
export const validateJurnalWithAbsensi = (jurnal, crossMap) => {
	if (!jurnal || !crossMap) {
		return {
			isValid: false,
			status: 'belum_absen',
			session: null,
			summary: { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0 },
			studentCount: 0,
			label: 'Belum Absen Siswa',
		};
	}

	const key = getCrossMatchKey(jurnal.tanggal, jurnal.kelas, jurnal.mapel);
	const candidates = crossMap.get(key) || [];

	if (candidates.length === 0) {
		return {
			isValid: false,
			status: 'belum_absen',
			session: null,
			summary: { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0 },
			studentCount: 0,
			label: 'Belum Absen Siswa',
		};
	}

	let matchedSession = candidates[0];

	// Jika ada lebih dari 1 sesi di hari/kelas/mapel yang sama, cocokkan jam atau guru_id
	if (candidates.length > 1) {
		const byJam = candidates.find((c) => {
			if (!jurnal.jam_ke || !c.jam_ke) return false;
			const overlap = checkJamOverlap(jurnal.jam_ke, c.jam_ke);
			return overlap.isOverlap;
		});

		if (byJam) {
			matchedSession = byJam;
		} else {
			const byGuru = candidates.find((c) => c.guru_id === jurnal.guru_id);
			if (byGuru) matchedSession = byGuru;
		}
	}

	const summary = matchedSession.summary || { hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0 };
	const studentCount = summary.total;
	const isValid = studentCount > 0;

	return {
		isValid,
		status: isValid ? 'lengkap' : 'belum_absen',
		session: matchedSession,
		summary,
		studentCount,
		label: isValid ? 'Lengkap' : 'Belum Absen Siswa',
	};
};

/**
 * Menghitung metrik kepatuhan kelengkapan administrasi guru dalam suatu periode
 * @param {Array} guruJournals - Seluruh jurnal milik satu guru dalam periode
 * @param {Map} crossMap - Map hasil dari buildCrossValidationMap
 * @returns {Object} { totalSesi, sesiLengkap, sesiBelumLengkap, persentase }
 */
export const calculateGuruCompliance = (guruJournals = [], crossMap) => {
	const totalSesi = guruJournals.length;
	let sesiLengkap = 0;

	guruJournals.forEach((j) => {
		const val = validateJurnalWithAbsensi(j, crossMap);
		if (val.isValid) sesiLengkap++;
	});

	const sesiBelumLengkap = totalSesi - sesiLengkap;
	const persentase = totalSesi > 0 ? Math.round((sesiLengkap / totalSesi) * 100) : 100;

	return {
		totalSesi,
		sesiLengkap,
		sesiBelumLengkap,
		persentase,
	};
};
