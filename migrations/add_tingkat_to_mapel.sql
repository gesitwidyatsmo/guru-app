-- ==============================================================================
-- MIGRASI PENAMBAHAN KOLOM TINGKAT DI TABEL MAPEL
-- Tujuan:
-- 1. Menyimpan target jenjang kelas resmi untuk setiap mata pelajaran (misal: [7, 8, 9] atau [9] saja untuk Aswaja)
-- 2. Mengatur urutan dan jenjang mapel secara terpusat di Kurikulum > Master Mapel
-- ==============================================================================

-- 1. Tambah kolom tingkat ke tabel mapel (tipe JSONB dengan default [7, 8, 9])
ALTER TABLE public.mapel 
ADD COLUMN IF NOT EXISTS tingkat JSONB DEFAULT '[7, 8, 9]'::jsonb;

-- 2. Set jenjang khusus untuk Aswaja (hanya Kelas 9)
UPDATE public.mapel
SET tingkat = '[9]'::jsonb
WHERE id = 'MP-ASW' OR UPPER(mapel) LIKE '%ASWAJA%';

-- 3. Pastikan mapel lain memiliki nilai default [7, 8, 9]
UPDATE public.mapel
SET tingkat = '[7, 8, 9]'::jsonb
WHERE tingkat IS NULL;

-- 4. Berikan izin akses Data API (PostgREST / Supabase JS) sesuai aturan Supabase (RULE 2)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapel TO service_role;
