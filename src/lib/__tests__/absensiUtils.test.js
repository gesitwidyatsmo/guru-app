/**
 * Unit test untuk logika absensi siswa di guru-app.
 * Menguji normalisasi status (termasuk kepatuhan aturan AGENTS.md), kalkulasi rekap, dan parsing jam pelajaran.
 */

import {
	normStatus,
	calculateAttendanceSummary,
	parseJamPelajaran,
	checkJamOverlap,
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
	// 3. Uji Parsing Jam Pelajaran (parseJamPelajaran)
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
});
