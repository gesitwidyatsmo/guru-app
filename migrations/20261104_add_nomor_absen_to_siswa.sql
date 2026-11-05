-- ===========================================================================
-- MIGRATION: NOMOR ABSEN / URUTAN SISWA PER KELAS (ROMBEL)
-- Menambahkan kolom nomor_absen ke tabel public.siswa, index pencarian,
-- serta inisialisasi nomor urut awal (backfill) per kelas.
-- ===========================================================================

-- 1. Tambah kolom nomor_absen ke tabel public.siswa
ALTER TABLE public.siswa 
ADD COLUMN IF NOT EXISTS nomor_absen INTEGER;

-- 2. Index untuk optimasi query pengurutan daftar siswa per rombel
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_nomor_absen 
ON public.siswa(kelas, nomor_absen ASC NULLS LAST);

-- 3. Inisialisasi otomatis nomor_absen 1..N untuk data siswa yang belum memiliki nomor urut
-- Berurutan berdasarkan nama_lengkap (A-Z) per kelas
WITH ranked_siswa AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (
            PARTITION BY kelas 
            ORDER BY nama_lengkap ASC
        ) AS new_no_absen
    FROM public.siswa
    WHERE kelas IS NOT NULL AND status = 'Aktif'
)
UPDATE public.siswa s
SET nomor_absen = r.new_no_absen
FROM ranked_siswa r
WHERE s.id = r.id AND s.nomor_absen IS NULL;

-- 4. GRANT Permissions Eksplisit (Wajib Sesuai Aturan Supabase Migrasi)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO service_role;
GRANT SELECT ON public.siswa TO anon;
