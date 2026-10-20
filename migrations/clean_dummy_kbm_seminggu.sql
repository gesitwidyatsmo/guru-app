-- ============================================================================
-- SKRIP PEMBERSIHAN DATA SIMULASI DUMMY KBM 1 MINGGU
-- GuruApp — Jalankan di Supabase SQL Editor jika ingin menghapus seluruh data simulasi
-- ============================================================================

DO $$
BEGIN
    DELETE FROM public.nilai_siswa WHERE tugas_id LIKE 'TGS-DUMMY-%';
    DELETE FROM public.nilai_tugas WHERE tugas_id LIKE 'TGS-DUMMY-%';
    DELETE FROM public.jurnal WHERE id LIKE 'JRN-DUMMY-%';
    DELETE FROM public.absensi_mapel_siswa WHERE sesi_id LIKE 'SESI-M-DUMMY-%';
    DELETE FROM public.absensi_mapel WHERE sesi_id LIKE 'SESI-M-DUMMY-%';
    DELETE FROM public.absensi_harian_siswa WHERE sesi_id LIKE 'SESI-H-DUMMY-%';
    DELETE FROM public.absensi_harian WHERE sesi_id LIKE 'SESI-H-DUMMY-%';

    RAISE NOTICE 'Seluruh data simulasi dummy KBM 1 minggu berhasil dibersihkan tanpa mengganggu data riil lainnya.';
END $$;
