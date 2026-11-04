/**
 * Unit test untuk logika absensi siswa di guru-app.
 * Menguji normalisasi status (termasuk kepatuhan aturan AGENTS.md), kalkulasi rekap, dan parsing jam pelajaran.
 */

import {
	normStatus,
	calculateAttendanceSummary,
	normalizeJamKe,
	parseJamPelajaran,
	checkJamOverlap,
	formatJamPelajaran,
	getPossibleSplits,
	isJumatOrLibur,
} from '../absensiUtils';

describe('Unit Test: absensiUtils', () => {
	// =========================================================================
	// 1. Uji Normalisasi Status Presensi (Kepatuhan Wajib AGENTS.md / GEMINI.md)
	// =========================================================================
	describe('normStatus', () => {
		test.each([
			['Hadir', 'hadir'],
			['hadir', 'hadir'],
			['H', 'hadir'],
			['h', 'hadir'],
			['Sakit', 'sakit'],
			['sakit', 'sakit'],
			['S', 'sakit'],
			['s', 'sakit'],
			['Izin', 'izin'],
			['izin', 'izin'],
			['I', 'izin'],
			['i', 'izin'],
			// Variasi penulisan Alfa/Alpa/ALPHA/A yang WAJIB seragam jadi 'alfa'
			['Alfa', 'alfa'],
			['alfa', 'alfa'],
			['Alpa', 'alfa'],
			['alpa', 'alfa'],
			['ALPHA', 'alfa'],
			['Alpha', 'alfa'],
			['A', 'alfa'],
			['a', 'alfa'],
			['  Alfa  ', 'alfa'],
		])('input "%s" harus dinormalisasi menjadi "%s"', (input, expected) => {
			expect(normStatus(input)).toBe(expected);
		});

		it('harus aman menangani input null, undefined, atau string kosong', () => {
			expect(normStatus(null)).toBe('');
			expect(normStatus(undefined)).toBe('');
			expect(normStatus('')).toBe('');
		});
	});

	// =========================================================================
	// 2. Uji Rekap Total Kehadiran (calculateAttendanceSummary)
	// =========================================================================
	describe('calculateAttendanceSummary', () => {
		it('harus menghitung total kehadiran secara tepat dengan berbagai variasi status', () => {
			const daftarPresensi = [
				{ status: 'Hadir' },
				{ status: 'h' },
				{ status: 'Sakit' },
				{ status: 'Izin' },
				{ status: 'Alfa' },
				{ status: 'Alpa' }, // variasi 'p'
				{ status: 'ALPHA' }, // variasi tombol UI
				{ status: 'A' }, // singkatan
			];

			const summary = calculateAttendanceSummary(daftarPresensi);

			expect(summary).toEqual({
				hadir: 2,
				sakit: 1,
				izin: 1,
				alfa: 4, // 4 variasi alfa harus terhitung semua
				total: 8,
			});
		});

		it('harus mengembalikan 0 jika array data kosong', () => {
			const summary = calculateAttendanceSummary([]);
			expect(summary).toEqual({
				hadir: 0,
				sakit: 0,
				izin: 0,
				alfa: 0,
				total: 0,
			});
		});
	});

	// =========================================================================
	// 3. Uji Normalisasi Jam Ke (normalizeJamKe)
	// =========================================================================
	describe('normalizeJamKe', () => {
		it('harus mengonversi format jam dinding menjadi slot jam pelajaran baku', () => {
			expect(normalizeJamKe('7.55-10.15')).toBe('2-4');
			expect(normalizeJamKe('07:15 - 08:35')).toBe('1-2');
			expect(normalizeJamKe('08:35 - 09:55')).toBe('3-4');
		});

		it('harus menormalisasi deretan angka berulang menjadi rentang', () => {
			expect(normalizeJamKe('5-6-7')).toBe('5-7');
			expect(normalizeJamKe('4-5-6')).toBe('4-6');
			expect(normalizeJamKe('1-2-3')).toBe('1-3');
		});

		it('harus membersihkan spasi, kata "Jam", dan kata sambung "dan"', () => {
			expect(normalizeJamKe('Jam 2-3')).toBe('2-3');
			expect(normalizeJamKe('Jam 6-7')).toBe('6-7');
			expect(normalizeJamKe('1 - 3')).toBe('1-3');
			expect(normalizeJamKe('5 - 7')).toBe('5-7');
			expect(normalizeJamKe('3, 4,')).toBe('3-4');
			expect(normalizeJamKe('3 dan 4')).toBe('3-4');
		});
	});

	// =========================================================================
	// 4. Uji Parsing Jam Pelajaran (parseJamPelajaran)
	// =========================================================================
	describe('parseJamPelajaran', () => {
		it('harus mem-parsing rentang jam seperti "1-3" menjadi array [1, 2, 3]', () => {
			expect(parseJamPelajaran('1-3')).toEqual([1, 2, 3]);
			expect(parseJamPelajaran('Jam 1 - 3')).toEqual([1, 2, 3]);
			expect(parseJamPelajaran('1 s/d 4')).toEqual([1, 2, 3, 4]);
		});

		it('harus mem-parsing jam tunggal atau jam terpisah koma', () => {
			expect(parseJamPelajaran('2')).toEqual([2]);
			expect(parseJamPelajaran('1, 2, 3')).toEqual([1, 2, 3]);
		});

		it('harus mengembalikan array kosong jika input kosong atau null', () => {
			expect(parseJamPelajaran('')).toEqual([]);
			expect(parseJamPelajaran(null)).toEqual([]);
		});
	});

	// =========================================================================
	// 4. Uji Deteksi Bentrok / Tumpang Tindih Jam (checkJamOverlap)
	// =========================================================================
	describe('checkJamOverlap', () => {
		it('harus mendeteksi konflik tumpang tindih jam (misal 1-3 bertabrakan dengan 2-4)', () => {
			const check = checkJamOverlap('1-3', '2-4');
			expect(check.isOverlap).toBe(true);
			expect(check.conflicts).toEqual([2, 3]);
		});

		it('harus mendeteksi jika jam tidak bertabrakan (misal 1-2 dengan 3-4)', () => {
			const check = checkJamOverlap('1-2', '3-4');
			expect(check.isOverlap).toBe(false);
			expect(check.conflicts).toEqual([]);
		});
	});

	// =========================================================================
	// 5. Uji Format & Pecah Sesi Jam (formatJamPelajaran & getPossibleSplits)
	// =========================================================================
	describe('formatJamPelajaran & getPossibleSplits', () => {
		it('harus memformat array jam berurutan menjadi string range', () => {
			expect(formatJamPelajaran([1, 2, 3])).toBe('1-3');
			expect(formatJamPelajaran([2, 3])).toBe('2-3');
			expect(formatJamPelajaran([1])).toBe('1');
			expect(formatJamPelajaran([1, 3])).toBe('1, 3');
			expect(formatJamPelajaran([])).toBe('');
		});

		it('harus menghasilkan opsi pemecahan sesi yang tepat untuk Jam 1-3', () => {
			const splits = getPossibleSplits('1-3');
			expect(splits).toHaveLength(2);

			// Opsi 1: Keluar di jam ke-2 -> Sesi 1 (Jam 1), Sesi 2 (Jam 2-3)
			expect(splits[0].part1).toBe('1');
			expect(splits[0].part2).toBe('2-3');
			expect(splits[0].startHourLeft).toBe(2);

			// Opsi 2: Keluar di jam ke-3 -> Sesi 1 (Jam 1-2), Sesi 2 (Jam 3)
			expect(splits[1].part1).toBe('1-2');
			expect(splits[1].part2).toBe('3');
			expect(splits[1].startHourLeft).toBe(3);
		});

		it('harus mengembalikan array kosong untuk sesi 1 jam (tidak dapat dipecah)', () => {
			expect(getPossibleSplits('1')).toEqual([]);
			expect(getPossibleSplits('')).toEqual([]);
		});
	});
	// =========================================================================
	// 6. Uji Hari Libur Sekolah (isJumatOrLibur - Hari Jum'at Libur)
	// =========================================================================
	describe('isJumatOrLibur', () => {
		it('harus mengidentifikasi hari Jum\'at sebagai libur mingguan', () => {
			expect(isJumatOrLibur('2026-11-06')).toBe(true);
			expect(isJumatOrLibur('2026-11-13')).toBe(true);
		});

		it('harus mengembalikan false untuk hari KBM aktif selain Jum\'at', () => {
			expect(isJumatOrLibur('2026-11-02')).toBe(false);
			expect(isJumatOrLibur('2026-11-04')).toBe(false);
			expect(isJumatOrLibur('2026-11-05')).toBe(false);
			expect(isJumatOrLibur('2026-11-07')).toBe(false);
		});

		it('harus aman menangani input falsy', () => {
			expect(isJumatOrLibur(null)).toBe(false);
			expect(isJumatOrLibur(undefined)).toBe(false);
			expect(isJumatOrLibur('')).toBe(false);
		});
	});
});