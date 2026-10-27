/**
 * Unit Test: Fitur Tugas Luar / Dinas Sekolah untuk Guru
 * Memastikan bahwa guru yang bertugas di luar sekolah:
 * 1. Dibebaskan dari validasi absensi siswa (crossValidation menganggap sah/valid)
 * 2. Lolos dari pembatasan radius GPS Geofence
 * 3. Memperoleh status dan badge audit yang tepat (Tugas Luar / Dinas)
 */

import { validateJurnalWithAbsensi, buildCrossValidationMap } from '../crossValidation';
import { getKBMStatusBadge } from '../kbmRealtimeUtils';
import { verifyGeofence } from '../geofenceServer';

describe('Unit Test: Penerapan Tugas Luar Guru', () => {
	const emptyCrossMap = buildCrossValidationMap([]);

	describe('Validasi Silang Absensi Siswa (crossValidation)', () => {
		it('jurnal KBM reguler tanpa presensi siswa harus berstatus "belum_absen"', () => {
			const regulerJurnal = {
				id: 'j-01',
				tanggal: '2026-10-28',
				kelas: '7A',
				mapel: 'Matematika',
				jam_ke: '1-2',
				status_kehadiran: 'Tepat Waktu',
				kegiatan: 'KBM di kelas',
			};

			const result = validateJurnalWithAbsensi(regulerJurnal, emptyCrossMap);
			expect(result.isValid).toBe(false);
			expect(result.status).toBe('belum_absen');
		});

		it('jurnal dengan status "Tugas Luar" harus diakui sah/valid tanpa absensi siswa', () => {
			const tugasLuarJurnal = {
				id: 'j-02',
				tanggal: '2026-10-28',
				kelas: '7A',
				mapel: 'Matematika',
				jam_ke: '1-2',
				status_kehadiran: 'Tugas Luar',
				kegiatan: 'Mendampingi lomba santri',
			};

			const result = validateJurnalWithAbsensi(tugasLuarJurnal, emptyCrossMap);
			expect(result.isValid).toBe(true);
			expect(result.status).toBe('tugas_luar');
			expect(result.label).toContain('Tugas Luar');
		});

		it('jurnal dengan keterangan kegiatan "[Tugas Luar]" juga harus diakui sah', () => {
			const noteTugasLuarJurnal = {
				id: 'j-03',
				tanggal: '2026-10-28',
				kelas: '8B',
				mapel: 'IPA',
				jam_ke: '3-4',
				status_kehadiran: 'Normal',
				kegiatan: '[Tugas Luar / Dinas Sekolah] Rapat MGMP',
			};

			const result = validateJurnalWithAbsensi(noteTugasLuarJurnal, emptyCrossMap);
			expect(result.isValid).toBe(true);
			expect(result.status).toBe('tugas_luar');
		});

		it('jurnal dengan status "Kegiatan Sekolah" (misal Hari Santri) harus diakui sah tanpa absensi siswa', () => {
			const kegiatanSekolahJurnal = {
				id: 'j-04',
				tanggal: '2026-10-22',
				kelas: '9A',
				mapel: 'Aswaja',
				jam_ke: '1-3',
				status_kehadiran: 'Kegiatan Sekolah',
				kegiatan: 'Peringatan Hari Santri Nasional & Apel Akbar',
			};

			const result = validateJurnalWithAbsensi(kegiatanSekolahJurnal, emptyCrossMap);
			expect(result.isValid).toBe(true);
			expect(result.status).toBe('kegiatan_sekolah');
			expect(result.label).toContain('Kegiatan Sekolah');
		});

		it('jurnal dengan catatan "[Kegiatan Sekolah]" atau status "Hari Santri" harus berstatus "kegiatan_sekolah"', () => {
			const hariSantriJurnal = {
				id: 'j-05',
				tanggal: '2026-10-22',
				kelas: '7B',
				mapel: 'PAI',
				jam_ke: '4-5',
				status_kehadiran: 'Hari Santri',
				kegiatan: '[Kegiatan Sekolah] Pawai Taaruf Hari Santri',
			};

			const result = validateJurnalWithAbsensi(hariSantriJurnal, emptyCrossMap);
			expect(result.isValid).toBe(true);
			expect(result.status).toBe('kegiatan_sekolah');
		});
	});

	describe('Metadata Styling Badge KBM Real-Time', () => {
		it('harus menghasilkan badge khusus bertema biru dengan icon pesawat untuk Tugas Luar', () => {
			const badge = getKBMStatusBadge('Tugas Luar');
			expect(badge.label).toBe('Tugas Luar / Dinas');
			expect(badge.icon).toBe('✈️');
			expect(badge.border).toContain('border-blue-500');
			expect(badge.text).toContain('text-blue-900');
		});

		it('harus menghasilkan badge khusus bertema ungu dengan icon tenda untuk Kegiatan Sekolah', () => {
			const badge = getKBMStatusBadge('Kegiatan Sekolah');
			expect(badge.label).toBe('Kegiatan Sekolah');
			expect(badge.icon).toBe('🎪');
			expect(badge.border).toContain('border-purple-500');
			expect(badge.text).toContain('text-purple-900');
		});
	});

	describe('Pengecualian Radius GPS Geofence Server-Side', () => {
		it('harus meloloskan (allowed: true) jika isTugasLuar adalah true meskipun posisi jauh dari sekolah', async () => {
			// Mock supabase yang mengembalikan geofence aktif
			const mockSupabase = {
				from: () => ({
					select: () => ({
						eq: () => ({
							maybeSingle: async () => ({
								data: {
									value: {
										enabled: true,
										lat: -7.5,
										lng: 112.2,
										radius: 200,
										nama_lokasi: 'Sekolah',
										berlaku_untuk: ['jurnal'],
									},
								},
								error: null,
							}),
						}),
					}),
				}),
			};

			// User berada jauh (jarak ratusan kilometer) atau tanpa koordinat
			const result = await verifyGeofence({
				supabase: mockSupabase,
				userLat: -6.2, // Jauh di Jakarta
				userLng: 106.8,
				moduleName: 'jurnal',
				role: 'Guru',
				isTugasLuar: true,
			});

			expect(result.allowed).toBe(true);
			expect(result.isTugasLuar).toBe(true);
		});

		it('harus meloloskan (allowed: true) jika isKegiatanSekolah adalah true (misal pawai/kegiatan luar)', async () => {
			const mockSupabase = {
				from: () => ({
					select: () => ({
						eq: () => ({
							maybeSingle: async () => ({
								data: {
									value: {
										enabled: true,
										lat: -7.5,
										lng: 112.2,
										radius: 200,
										nama_lokasi: 'Sekolah',
										berlaku_untuk: ['jurnal'],
									},
								},
								error: null,
							}),
						}),
					}),
				}),
			};

			const result = await verifyGeofence({
				supabase: mockSupabase,
				userLat: -6.5,
				userLng: 107.0,
				moduleName: 'jurnal',
				role: 'Guru',
				isKegiatanSekolah: true,
			});

			expect(result.allowed).toBe(true);
			expect(result.isKegiatanSekolah).toBe(true);
		});
	});
});
