import { determineKBMStatus, getKBMStatusBadge, parseTimeToMinutes, getExpectedScheduleTimes } from '../kbmRealtimeUtils';
import { getTodayDateString } from '../dateUtils';

describe('kbmRealtimeUtils - Keterlambatan Masuk Audit (> 20m)', () => {
	const todayStr = getTodayDateString();

	it('harus berstatus Tepat Waktu jika guru masuk tepat pada jam jadwal', () => {
		const status = determineKBMStatus({
			jamMulai: '07:15',
			jamSelesai: '07:55',
			durasiMenit: 40,
			tanggal: todayStr,
			jadwalJamMulai: '07:15',
			jadwalJamSelesai: '07:55',
		});
		expect(status).toBe('Tepat Waktu');
	});

	it('harus tetap Tepat Waktu jika terlambat masuk dalam batas toleransi 20 menit (misal 15 atau 20 menit)', () => {
		// Jadwal mulai 07:15, masuk 07:35 (+20 menit, masih batas toleransi)
		const status = determineKBMStatus({
			jamMulai: '07:35',
			jamSelesai: '08:15',
			durasiMenit: 40,
			tanggal: todayStr,
			jadwalJamMulai: '07:15',
			jadwalJamSelesai: '07:55',
		});
		expect(status).toBe('Tepat Waktu');
	});

	it('harus berstatus Terlambat Masuk jika terlambat lebih dari 20 menit (>20m, misal 21 menit)', () => {
		// Jadwal mulai 07:15, masuk 07:36 (+21 menit, lewat batas 20m)
		const status = determineKBMStatus({
			jamMulai: '07:36',
			jamSelesai: '08:20',
			durasiMenit: 44,
			tanggal: todayStr,
			jadwalJamMulai: '07:15',
			jadwalJamSelesai: '07:55',
		});
		expect(status).toBe('Terlambat Masuk');
	});

	it('badge untuk Terlambat Masuk harus menampilkan label "> 20m"', () => {
		const badge = getKBMStatusBadge('Terlambat Masuk');
		expect(badge.label).toBe('Terlambat Masuk (> 20m)');
		expect(badge.icon).toBe('🟡');
	});
});
