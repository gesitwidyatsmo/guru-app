/**
 * Test Suite Komprehensif: Logika Bisnis & Hak Akses
 * Role Guru (Pengampu Mata Pelajaran) & Role Wali Kelas (Hub /wali-kelas)
 */

import { normStatus, checkJamOverlap, calculateAttendanceSummary } from '../absensiUtils';
import { isWithinGeofence, haversine } from '../haversine';
import { hitungTotalPoinBersih, konversiPoinKeSikap } from '../poinUtils';
import { ROLES } from '../roles';

// =============================================================================
// HELPER LOGIKA GURU & WALI KELAS (Refleksi Aturan Bisnis Aplikasi)
// =============================================================================

/**
 * Logika Penilaian Guru:
 * 1. Hitung Nilai dari Jumlah Benar
 * 2. Hitung Nilai Akhir dari Bobot Formatif & Sumatif
 * 3. Tentukan Predikat Nilai berdasarkan KKM
 */
export function hitungNilaiDariJumlahBenar(jumlahBenar, totalSoal = 25, skalaMaks = 100) {
	if (totalSoal <= 0 || typeof jumlahBenar !== 'number' || jumlahBenar < 0) return 0;
	const skor = (jumlahBenar / totalSoal) * skalaMaks;
	return Math.min(skalaMaks, Math.max(0, Math.round(skor * 100) / 100));
}

export function hitungNilaiAkhirRapor(nilaiFormatif, nilaiSumatif, bobotFormatif = 0.4, bobotSumatif = 0.6) {
	const f = Math.max(0, Math.min(100, Number(nilaiFormatif) || 0));
	const s = Math.max(0, Math.min(100, Number(nilaiSumatif) || 0));
	return Math.round((f * bobotFormatif + s * bobotSumatif) * 10) / 10;
}

export function tentukanPredikatNilai(nilai, kkm = 75) {
	if (nilai >= 90) return { predikat: 'A', keterangan: 'Sangat Baik' };
	if (nilai >= 80) return { predikat: 'B', keterangan: 'Baik' };
	if (nilai >= kkm) return { predikat: 'C', keterangan: 'Cukup' };
	return { predikat: 'D', keterangan: 'Perlu Bimbingan / Remidial' };
}

/**
 * Logika Wali Kelas:
 * 1. Tentukan Status Harian Siswa: Min. 1 JP Hadir = Hadir Hari Ini
 * 2. Hitung Persentase Kehadiran Kelas
 * 3. Radar Siswa Membolos (Hadir di jam awal, tapi Alfa di jam berikutnya)
 * 4. Verifikasi Otorisasi Wali Kelas atas Rombel
 */
export function tentukanStatusHarianSiswa(sesiMapelList = []) {
	if (!sesiMapelList || sesiMapelList.length === 0) return 'belum_ada_data';

	const normalizedStatuses = sesiMapelList.map((s) => normStatus(s.status));

	// Aturan Wali Kelas: Jika ada minimal 1 JP Hadir, maka dihitung Hadir Hari Ini
	if (normalizedStatuses.includes('hadir')) return 'hadir';

	// Jika tidak pernah hadir, prioritaskan Sakit, lalu Izin, terakhir Alfa
	if (normalizedStatuses.includes('sakit')) return 'sakit';
	if (normalizedStatuses.includes('izin')) return 'izin';
	if (normalizedStatuses.includes('alfa')) return 'alfa';

	return normalizedStatuses[0] || 'alfa';
}

export function hitungPersentaseKehadiranKelas(hadirCount, totalSiswa) {
	if (!totalSiswa || totalSiswa <= 0) return 0;
	return Math.round((hadirCount / totalSiswa) * 100);
}

export function deteksiSiswaMembolos(sesiMapelSiswa = []) {
	// Membolos: pernah hadir di suatu sesi mapel, tetapi alfa di sesi mapel lain pada hari yang sama
	const statuses = sesiMapelSiswa.map((s) => normStatus(s.status));
	const adaHadir = statuses.includes('hadir');
	const adaAlfa = statuses.includes('alfa');
	return adaHadir && adaAlfa;
}

export function validasiOtorisasiWaliKelas({ userRole, userId, kelasWaliId }) {
	if (userRole === ROLES.ADMIN) return { allowed: true, reason: 'Admin bypass' };
	if (userRole === ROLES.WALI_KELAS || userRole === ROLES.GURU) {
		if (userId && kelasWaliId && String(userId) === String(kelasWaliId)) {
			return { allowed: true, reason: 'Wali Kelas sah' };
		}
	}
	return { allowed: false, reason: 'Akses ditolak: Bukan Wali Kelas dari rombel ini' };
}

// =============================================================================
// TEST SUITE UTAMA
// =============================================================================

describe('TEST SUITE: Role Guru & Role Wali Kelas', () => {

	// ---------------------------------------------------------------------------
	// 1. PENGUJIAN FITUR GURU (Pengampu Mapel)
	// ---------------------------------------------------------------------------
	describe('1. Fitur Guru (Pengampu Mata Pelajaran)', () => {

		describe('1.1 Presensi Mapel & Aturan Bisnis', () => {
			it('harus menormalisasi variasi ejaan Alfa/Alpa/ALPHA/A menjadi "alfa"', () => {
				expect(normStatus('Alfa')).toBe('alfa');
				expect(normStatus('Alpa')).toBe('alfa');
				expect(normStatus('ALPHA')).toBe('alfa');
				expect(normStatus('A')).toBe('alfa');
				expect(normStatus('a')).toBe('alfa');
			});

			it('harus mendeteksi konflik jadwal jika guru memilih jam ajar yang tumpang tindih', () => {
				// Sesi KBM sedang berlangsung jam 1-3, guru lain atau guru yang sama mencoba simpan sesi jam 2-4
				const check = checkJamOverlap('1-3', '2-4');
				expect(check.isOverlap).toBe(true);
				expect(check.conflicts).toEqual([2, 3]);
			});

			it('harus meloloskan jam mengajar yang tidak bentrok', () => {
				const check = checkJamOverlap('1-2', '3-4');
				expect(check.isOverlap).toBe(false);
				expect(check.conflicts).toEqual([]);
			});

			it('harus memvalidasi radius geofencing sekolah untuk presensi guru', () => {
				const schoolLat = -6.200000;
				const schoolLng = 106.816666;
				const radiusMeter = 100;

				// Posisi 1: Guru berada di dalam kelas (jarak ~30 meter) -> DITERIMA
				const posisiDalam = isWithinGeofence(-6.200200, 106.816800, schoolLat, schoolLng, radiusMeter);
				expect(posisiDalam.isInside).toBe(true);

				// Posisi 2: Guru berada di luar area sekolah (jarak ~2000 meter) -> DITOLAK
				const posisiLuar = isWithinGeofence(-6.218000, 106.816666, schoolLat, schoolLng, radiusMeter);
				expect(posisiLuar.isInside).toBe(false);
			});
		});

		describe('1.2 Penilaian Siswa (Grading)', () => {
			it('harus menghitung nilai otomatis berdasarkan jumlah benar (cth: 20 benar dari 25 soal = 80)', () => {
				expect(hitungNilaiDariJumlahBenar(20, 25, 100)).toBe(80);
				expect(hitungNilaiDariJumlahBenar(25, 25, 100)).toBe(100);
				expect(hitungNilaiDariJumlahBenar(0, 25, 100)).toBe(0);
			});

			it('harus menghitung nilai akhir rapor dengan pembobotan formatif dan sumatif', () => {
				// Formatif 80 (40%), Sumatif 90 (60%) -> (80 * 0.4) + (90 * 0.6) = 32 + 54 = 86
				const nilaiAkhir = hitungNilaiAkhirRapor(80, 90, 0.4, 0.6);
				expect(nilaiAkhir).toBe(86);
			});

			it('harus menentukan predikat nilai rapor sesuai standar KKM (75)', () => {
				expect(tentukanPredikatNilai(95, 75).predikat).toBe('A');
				expect(tentukanPredikatNilai(82, 75).predikat).toBe('B');
				expect(tentukanPredikatNilai(76, 75).predikat).toBe('C');
				expect(tentukanPredikatNilai(60, 75).predikat).toBe('D');
			});
		});

		describe('1.3 Poin Kedisiplinan & Karakter Siswa', () => {
			it('harus menghitung total poin bersih (poin positif minus poin sanksi)', () => {
				const daftarPoin = [
					{ tipe: 'positif', poin: 20 }, // Prestasi
					{ tipe: 'positif', poin: 15 }, // Juara kelas
					{ tipe: 'negatif', poin: 10 }, // Terlambat
				];
				// Bersih = (20 + 15) - 10 = 25
				expect(hitungTotalPoinBersih(daftarPoin)).toBe(25);
			});

			it('harus mengonversi akumulasi poin ke Predikat Karakter Sikap', () => {
				expect(konversiPoinKeSikap(60).predikat).toBe('A');
				expect(konversiPoinKeSikap(60).label).toBe('Sangat Baik');

				expect(konversiPoinKeSikap(25).predikat).toBe('B');
				expect(konversiPoinKeSikap(25).label).toBe('Baik');

				expect(konversiPoinKeSikap(5).predikat).toBe('C');
				expect(konversiPoinKeSikap(5).label).toBe('Cukup');

				expect(konversiPoinKeSikap(-15).predikat).toBe('D');
				expect(konversiPoinKeSikap(-15).label).toBe('Perlu Bimbingan');
			});
		});
	});

	// ---------------------------------------------------------------------------
	// 2. PENGUJIAN FITUR WALI KELAS (Hub /wali-kelas)
	// ---------------------------------------------------------------------------
	describe('2. Fitur Wali Kelas (Hub /wali-kelas)', () => {

		describe('2.1 Agregasi & Sinkronisasi Presensi Harian Rombel', () => {
			it('harus menetapkan Hadir jika siswa hadir di minimal 1 sesi JP KBM', () => {
				const sesiHariIni = [
					{ mapel: 'Matematika', status: 'Hadir' },
					{ mapel: 'Bahasa Indonesia', status: 'Alfa' }, // misal bolos jam ke-2
				];
				expect(tentukanStatusHarianSiswa(sesiHariIni)).toBe('hadir');
			});

			it('harus menetapkan status Sakit/Izin jika tidak hadir sama sekali seharian', () => {
				const sesiSakit = [
					{ mapel: 'IPA', status: 'Sakit' },
					{ mapel: 'IPS', status: 'Sakit' },
				];
				expect(tentukanStatusHarianSiswa(sesiSakit)).toBe('sakit');
			});

			it('harus menetapkan status Alfa jika seluruh sesi mapel tidak ada keterangan (Alfa/Alpa)', () => {
				const sesiAlfa = [
					{ mapel: 'IPA', status: 'Alpa' },
					{ mapel: 'IPS', status: 'ALPHA' },
				];
				expect(tentukanStatusHarianSiswa(sesiAlfa)).toBe('alfa');
			});

			it('harus menghitung persentase kehadiran kelas dengan benar (misal 27 dari 30 siswa = 90%)', () => {
				expect(hitungPersentaseKehadiranKelas(27, 30)).toBe(90);
				expect(hitungPersentaseKehadiranKelas(30, 30)).toBe(100);
				expect(hitungPersentaseKehadiranKelas(0, 30)).toBe(0);
			});
		});

		describe('2.2 Early Warning Radar: Deteksi Siswa Membolos & Perlu Atensi', () => {
			it('harus mendeteksi siswa anomali/membolos (Hadir di jam ke-1 tapi Alfa di jam berikutnya)', () => {
				const siswaA = [
					{ jam_ke: '1-2', status: 'Hadir' },
					{ jam_ke: '3-4', status: 'Alfa' },
				];
				expect(deteksiSiswaMembolos(siswaA)).toBe(true);

				const siswaRajin = [
					{ jam_ke: '1-2', status: 'Hadir' },
					{ jam_ke: '3-4', status: 'Hadir' },
				];
				expect(deteksiSiswaMembolos(siswaRajin)).toBe(false);
			});

			it('harus menandai siswa yang memerlukan atensi pembinaan wali kelas jika poin minus', () => {
				const poinSiswaBermasalah = -25;
				const predikat = konversiPoinKeSikap(poinSiswaBermasalah);
				expect(predikat.predikat).toBe('D');
				expect(predikat.label).toBe('Perlu Bimbingan');
			});
		});

		describe('2.3 Hak Akses & Keamanan Otorisasi Wali Kelas', () => {
			it('harus mengizinkan Wali Kelas mengelola rombel binaannya sendiri', () => {
				const auth = validasiOtorisasiWaliKelas({
					userRole: ROLES.WALI_KELAS,
					userId: 'guru-101',
					kelasWaliId: 'guru-101', // ID cocok
				});
				expect(auth.allowed).toBe(true);
			});

			it('harus menolak akses jika Wali Kelas mencoba mengubah data kelas rombel guru lain', () => {
				const auth = validasiOtorisasiWaliKelas({
					userRole: ROLES.WALI_KELAS,
					userId: 'guru-101',
					kelasWaliId: 'guru-999', // ID berbeda (kelas orang lain)
				});
				expect(auth.allowed).toBe(false);
				expect(auth.reason).toContain('Akses ditolak');
			});

			it('harus selalu mengizinkan Admin mengakses seluruh kelas', () => {
				const auth = validasiOtorisasiWaliKelas({
					userRole: ROLES.ADMIN,
					userId: 'admin-001',
					kelasWaliId: 'guru-888',
				});
				expect(auth.allowed).toBe(true);
			});
		});
	});
});
