-- ===========================================================================
-- MIGRATION: Tambah Kolom 'metode' pada Tabel public.jurnal
-- GuruApp — Menyimpan Metode Pembelajaran (Ceramah, Diskusi, Praktikum, dll.)
-- ===========================================================================

-- 1. Tambah kolom metode ke tabel jurnal jika belum ada
ALTER TABLE public.jurnal 
ADD COLUMN IF NOT EXISTS metode VARCHAR(150) DEFAULT 'Ceramah';

-- 2. Beri komentar dokumentasi pada kolom
COMMENT ON COLUMN public.jurnal.metode IS 'Metode pembelajaran yang diterapkan: Ceramah, Diskusi, Praktikum, Presentasi, Tanya Jawab, Penugasan';

-- 3. Indeks untuk mempercepat query / filter metode jika diperlukan
CREATE INDEX IF NOT EXISTS idx_jurnal_metode ON public.jurnal(metode);
