import { calculateDurationMinutes, formatDurationString, getExpectedScheduleTimes } from '@/lib/kbmRealtimeUtils';
import { normalizeJamKe, findConflictingSession } from '@/lib/absensiUtils';

describe('Admin Jurnal Input Helper & Validation Tests', () => {
	describe('Perhitungan Jam Masuk, Jam Selesai & Durasi Riil KBM oleh Admin', () => {
		it('harus menghitung durasi KBM dalam menit dengan tepat dari jam masuk dan jam selesai', () => {
			const durasi1 = calculateDurationMinutes('07:15', '08:35');
			expect(durasi1).toBe(80);

			const durasi2 = calculateDurationMinutes('08:35', '09:55');
			expect(durasi2).toBe(80);

			const durasi3 = calculateDurationMinutes('10:15', '11:35');
			expect(durasi3).toBe(80);

			const durasi4 = calculateDurationMinutes('07:30', '08:45');
			expect(durasi4).toBe(75);
		});

		it('harus memformat durasi menit menjadi teks yang ramah dibaca admin', () => {
			expect(formatDurationString(80, false)).toBe('1 Jam 20 Menit');
			expect(formatDurationString(40, false)).toBe('40 Menit');
			expect(formatDurationString(120, false)).toBe('2 Jam');
		});

		it('harus mengambil jadwal resmi sekolah otomatis untuk JP 1-2 di hari biasa', () => {
			// Hari Selasa (reguler)
			const sched = getExpectedScheduleTimes('1-2', '2026-11-10');
			expect(sched).not.toBeNull();
			expect(sched.start).toBe('07:15');
			expect(sched.end).toBe('08:35');
			expect(calculateDurationMinutes(sched.start, sched.end)).toBe(80);
		});

		it('harus mengenali perbedaan waktu JP 4 hari Senin vs hari reguler', () => {
			// Senin: JP 4 setelah istirahat (09:35 - 10:15)
			const schedSenin = getExpectedScheduleTimes('4', '2026-11-09');
			expect(schedSenin.start).toBe('09:35');
			expect(schedSenin.end).toBe('10:15');

			// Selasa: JP 4 sebelum istirahat (09:15 - 09:55)
			const schedSelasa = getExpectedScheduleTimes('4', '2026-11-10');
			expect(schedSelasa.start).toBe('09:15');
			expect(schedSelasa.end).toBe('09:55');
		});
	});

	describe('Normalisasi Jam Ke & Deteksi Konflik KBM', () => {
		it('harus menormalisasi format jam yang diketikkan admin', () => {
			expect(normalizeJamKe('1-2')).toBe('1-2');
			expect(normalizeJamKe('Jam 3-4')).toBe('3-4');
			expect(normalizeJamKe('5 dan 6')).toBe('5-6');
		});

		it('harus mendeteksi konflik jam KBM aktif jika admin tidak mengaktifkan override', () => {
			const activeJournals = [
				{
					id: 'j1',
					jam_ke: '1-2',
					mapel: 'Matematika',
					status_verifikasi: 'disetujui',
					status_kehadiran: 'Normal',
					users: { nama_lengkap: 'Guru A' },
				},
			];

			const conflict = findConflictingSession(activeJournals, '2-3');
			expect(conflict).not.toBeNull();
			expect(conflict.session.id).toBe('j1');
		});

		it('harus meloloskan KBM jika slot jam tidak bertabrakan', () => {
			const activeJournals = [
				{
					id: 'j1',
					jam_ke: '1-2',
					mapel: 'Matematika',
					status_verifikasi: 'disetujui',
					status_kehadiran: 'Normal',
					users: { nama_lengkap: 'Guru A' },
				},
			];

			const conflict = findConflictingSession(activeJournals, '3-4');
			expect(conflict).toBeNull();
		});
	});

	describe('Penautan Kelas & Mapel Berdasarkan Data Penugasan Guru', () => {
		const mockAssignments = {
			guru_1: [
				{ kelas: 'VII A', mapel: 'Matematika' },
				{ kelas: 'VII B', mapel: 'Matematika' },
			],
			guru_2: [
				{ kelas: 'VIII A', mapel: 'IPA' },
				{ kelas: 'VIII A', mapel: 'Fisika' },
				{ kelas: 'VIII B', mapel: 'IPA' },
			],
		};

		it('harus mengambil kelas yang diampu guru tertentu dengan benar', () => {
			const assignedForGuru1 = mockAssignments['guru_1'] || [];
			const classesGuru1 = Array.from(new Set(assignedForGuru1.map((a) => a.kelas)));
			expect(classesGuru1).toEqual(['VII A', 'VII B']);
		});

		it('harus memfilter mapel yang spesifik diampu oleh guru pada kelas tertentu', () => {
			const assignedForGuru2 = mockAssignments['guru_2'] || [];
			const mapelFor8A = assignedForGuru2
				.filter((a) => a.kelas === 'VIII A')
				.map((a) => a.mapel);
			expect(mapelFor8A).toEqual(['IPA', 'Fisika']);

			const mapelFor8B = assignedForGuru2
				.filter((a) => a.kelas === 'VIII B')
				.map((a) => a.mapel);
			expect(mapelFor8B).toEqual(['IPA']);
		});

		it('harus menangani kasus guru yang belum memiliki data penugasan (fallback kosong)', () => {
			const assignedUnknown = mockAssignments['guru_3'] || [];
			expect(assignedUnknown).toHaveLength(0);
		});
	});
});
