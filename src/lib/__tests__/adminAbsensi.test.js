import {
	normStatus,
	calculateAttendanceSummary,
	normalizeJamKe,
	checkJamOverlap,
} from '../absensiUtils';

describe('Unit Test: Admin Absensi Management Logic', () => {
	describe('Deteksi Bentrok Jam Presensi (Conflict Detection)', () => {
		it('harus mendeteksi bentrok jika dua sesi presensi memiliki jam yang bertabrakan di kelas yang sama', () => {
			const sessionA = { kelas: '7A', jam_ke: '1-2', tanggal: '2026-11-18' };
			const sessionB = { kelas: '7A', jam_ke: '2-3', tanggal: '2026-11-18' };

			const normA = normalizeJamKe(sessionA.jam_ke);
			const normB = normalizeJamKe(sessionB.jam_ke);
			const { isOverlap, conflicts } = checkJamOverlap(normA, normB);

			expect(isOverlap).toBe(true);
			expect(conflicts).toContain(2);
		});

		it('tidak boleh mendeteksi bentrok jika dua sesi memiliki jam terpisah', () => {
			const sessionA = { kelas: '7A', jam_ke: '1-2', tanggal: '2026-11-18' };
			const sessionB = { kelas: '7A', jam_ke: '3-4', tanggal: '2026-11-18' };

			const normA = normalizeJamKe(sessionA.jam_ke);
			const normB = normalizeJamKe(sessionB.jam_ke);
			const { isOverlap } = checkJamOverlap(normA, normB);

			expect(isOverlap).toBe(false);
		});
	});

	describe('Normalisasi Status Siswa & Rekap Kehadiran Admin', () => {
		it('harus mengenali semua variasi status alfa/alpa/alpha/A secara seragam sesuai aturan AGENTS.md', () => {
			const records = [
				{ status: 'Hadir' },
				{ status: 'hadir' },
				{ status: 'Sakit' },
				{ status: 'Izin' },
				{ status: 'Alfa' },
				{ status: 'Alpa' },
				{ status: 'ALPHA' },
				{ status: 'A' },
			];

			const summary = calculateAttendanceSummary(records);
			expect(summary.hadir).toBe(2);
			expect(summary.sakit).toBe(1);
			expect(summary.izin).toBe(1);
			expect(summary.alfa).toBe(4);
			expect(summary.total).toBe(8);
		});
	});
});
