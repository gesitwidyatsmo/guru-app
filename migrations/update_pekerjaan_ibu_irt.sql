-- ===========================================================================
-- MIGRATION: Update Pekerjaan Ibu Kandung 'Tidak bekerja' -> 'Ibu Rumah Tangga'
-- Guru App - SMP IT Tebuireng 4 Al-Ishlah
-- Target: Supabase SQL Editor
-- ===========================================================================

-- 1. Jalankan pembaruan data
UPDATE public.siswa
SET pekerjaan_ibu = 'Ibu Rumah Tangga'
WHERE LOWER(TRIM(pekerjaan_ibu)) = 'tidak bekerja';

-- 2. Verifikasi hasil pembaruan
SELECT 
    pekerjaan_ibu, 
    COUNT(*) AS total_siswa
FROM public.siswa
GROUP BY pekerjaan_ibu
ORDER BY total_siswa DESC;
