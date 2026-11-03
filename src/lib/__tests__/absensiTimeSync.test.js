/**
 * Unit Test: Sinkronisasi Waktu dan Pencocokan Sesi Absensi & Jurnal KBM
 * Memverifikasi:
 * 1. Tidak ada blind fallback ke sesi jam lain yang berbeda waktu (mencegah bug jam 8.40 tersimpan 9.02).
 * 2. Pencocokan jam_ke cerdas berbasis overlap irisan jam.
 * 3. Prioritas waktu_absen (client_time) di atas created_at server.
 */

import { checkJamOverlap } from '../absensiUtils';
import { getTimeWIB } from '../kbmRealtimeUtils';

describe('Unit Test: Sinkronisasi Waktu & Lookup Sesi Absensi', () => {
	// Simulasi riwayat sesi absensi yang tersimpan di database pada satu hari
	const mockSessionsToday = [
		{
			sesi_id: 'SESI-02',
			jam_ke: '3-4',
			created_at: '2026-11-03T02:02:00.000Z', // 09:02 WIB
			waktu_absen: '09:02',
		},
		{
			sesi_id: 'SESI-01',
			jam_ke: '1-2',
			created_at: '2026-11-03T01:40:00.000Z', // 08:40 WIB
			waktu_absen: '08:40',
		},
	];

	// Fungsi helper simulasi lookup absensi jurnal (seperti di jurnal/page.jsx & api/jurnal/route.js)
	const matchSessionForJurnal = (sessions, targetJamKe) => {
		if (!sessions || sessions.length === 0) return null;

		let chosen = null;
		if (targetJamKe) {
			// 1. Exact match
			chosen = sessions.find((s) => String(s.jam_ke).trim() === String(targetJamKe).trim());
			// 2. Overlap match
			if (!chosen) {
				chosen = sessions.find((s) => checkJamOverlap(s.jam_ke, targetJamKe).isOverlap);
			}
		} else {
			// Fallback hanya jika jam_ke di jurnal memang belum diisi sama sekali
			chosen = sessions[0];
		}

		if (!chosen) return null;

		return {
			sesi_id: chosen.sesi_id,
			jam_mulai: chosen.waktu_absen || getTimeWIB(chosen.created_at),
			jam_ke: chosen.jam_ke,
		};
	};

	describe('Pencocokan Sesi Jurnal yang Akurat (Mencegah Salah Jam)', () => {
		test('jurnal jam 1-2 harus mencocokkan sesi jam 1-2 (08:40), BUKAN sesi jam 3-4 (09:02)', () => {
			const match = matchSessionForJurnal(mockSessionsToday, '1-2');
			expect(match).not.toBeNull();
			expect(match.sesi_id).toBe('SESI-01');
			expect(match.jam_mulai).toBe('08:40');
			expect(match.jam_ke).toBe('1-2');
		});

		test('jurnal jam 3-4 harus mencocokkan sesi jam 3-4 (09:02)', () => {
			const match = matchSessionForJurnal(mockSessionsToday, '3-4');
			expect(match).not.toBeNull();
			expect(match.sesi_id).toBe('SESI-02');
			expect(match.jam_mulai).toBe('09:02');
			expect(match.jam_ke).toBe('3-4');
		});

		test('jurnal jam 1 (tunggal) harus mencocokkan sesi jam 1-2 secara overlap', () => {
			const match = matchSessionForJurnal(mockSessionsToday, '1');
			expect(match).not.toBeNull();
			expect(match.sesi_id).toBe('SESI-01');
			expect(match.jam_mulai).toBe('08:40');
		});

		test('jurnal jam 5-6 TIDAK BOLEH mencocokkan sesi apa pun (TIDAK BOLEH fallback buta ke 09:02)', () => {
			const match = matchSessionForJurnal(mockSessionsToday, '5-6');
			// Sebelumnya dengan matchedSessions[0], ini akan salah mengambil SESI-02 (09:02)!
			expect(match).toBeNull();
		});

		test('jika jam_ke kosong, ambil sesi terbaru dari daftar', () => {
			const match = matchSessionForJurnal(mockSessionsToday, '');
			expect(match).not.toBeNull();
			expect(match.sesi_id).toBe('SESI-02');
		});
	});

	describe('Prioritas Waktu Presensi: waktu_absen vs created_at', () => {
		test('menggunakan waktu_absen (client_time) jika tersedia meskipun created_at terlambat sync di cloud', () => {
			const sessionWithDelay = {
				sesi_id: 'SESI-DELAYED',
				jam_ke: '1-2',
				waktu_absen: '08:40', // Waktu guru menekan simpan di kelas
				created_at: '2026-11-03T02:02:15.000Z', // Waktu server Supabase menerima request (09:02 WIB)
			};

			const result = matchSessionForJurnal([sessionWithDelay], '1-2');
			expect(result.jam_mulai).toBe('08:40');
		});

		test('fallback ke created_at jika waktu_absen belum tersedia', () => {
			const sessionLegacy = {
				sesi_id: 'SESI-LEGACY',
				jam_ke: '1-2',
				waktu_absen: null,
				created_at: '2026-11-03T01:40:00.000Z', // 08:40 WIB
			};

			const result = matchSessionForJurnal([sessionLegacy], '1-2');
			expect(result.jam_mulai).toBe('08:40');
		});
	});
});
