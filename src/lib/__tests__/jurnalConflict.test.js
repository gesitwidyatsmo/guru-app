/**
 * Unit Test: Logika Deteksi Bentrok Jam Mengajar (Jurnal) - Opsi 1: Tingkat Kelas
 * Memastikan bahwa jika satu kelas pada hari yang sama sudah diisi jam 1-3,
 * maka jam 1, 2, 3, 1-2, atau 2-3 akan terdeteksi konflik dan ditolak.
 */

import { parseJamPelajaran, checkJamOverlap, findConflictingSession } from '../absensiUtils';

describe('Unit Test: Validasi Konflik Jam Jurnal Mengajar (Tingkat Kelas)', () => {
	// Simulasi data jurnal yang sudah tersimpan di database pada kelas 7A hari ini
	const existingJournalsKelas7A = [
		{
			id: 'jurnal-budi-01',
			guru_id: 'user_budi',
			kelas: '7A',
			tanggal: '2026-10-27',
			mapel: 'Matematika',
			jam_ke: '1-3',
			users: { nama_lengkap: 'Budi Santoso' },
		},
	];

	describe('Deteksi Bentrok Jam untuk Input Baru (Guru Sama atau Guru Lain)', () => {
		test.each([
			['1', [1]],
			['2', [2]],
			['3', [3]],
			['1-2', [1, 2]],
			['2-3', [2, 3]],
			['1-3', [1, 2, 3]],
			['Jam 2-4', [2, 3]],
			['1 s/d 2', [1, 2]],
		])('input jam "%s" HARUS terdeteksi bentrok dengan jam "1-3"', (jamBaru, expectedConflicts) => {
			const conflict = findConflictingSession(existingJournalsKelas7A, jamBaru, null);
			expect(conflict).not.toBeNull();
			expect(conflict.session.id).toBe('jurnal-budi-01');
			expect(conflict.conflicts).toEqual(expectedConflicts);
			expect(conflict.session.users.nama_lengkap).toBe('Budi Santoso');
		});

		test.each([
			['4'],
			['4-5'],
			['Jam 4-6'],
			['7-8'],
		])('input jam "%s" TIDAK BOLEH terdeteksi bentrok (jam sesudahnya)', (jamBaru) => {
			const conflict = findConflictingSession(existingJournalsKelas7A, jamBaru, null);
			expect(conflict).toBeNull();
		});
	});

	describe('Mode Edit Jurnal (Self Session Exclusion)', () => {
		it('tidak boleh mendeteksi konflik dengan dirinya sendiri saat mengedit jurnal', () => {
			// Budi mengedit jurnal miliknya sendiri ('jurnal-budi-01') dengan jam tetap '1-3'
			const conflict = findConflictingSession(existingJournalsKelas7A, '1-3', 'jurnal-budi-01');
			expect(conflict).toBeNull();
		});

		it('harus mendeteksi konflik jika mengedit jurnal lain agar jamnya bertabrakan', () => {
			const multipleJournals = [
				...existingJournalsKelas7A,
				{
					id: 'jurnal-siti-02',
					guru_id: 'user_siti',
					kelas: '7A',
					tanggal: '2026-10-27',
					mapel: 'Bahasa Inggris',
					jam_ke: '4-5',
					users: { nama_lengkap: 'Siti Rahma' },
				},
			];

			// Siti ingin mengubah jamnya dari 4-5 menjadi 3-4 (bentrok dengan Budi di jam 3)
			const conflict = findConflictingSession(multipleJournals, '3-4', 'jurnal-siti-02');
			expect(conflict).not.toBeNull();
			expect(conflict.session.id).toBe('jurnal-budi-01');
			expect(conflict.conflicts).toEqual([3]);
		});
	});
});
