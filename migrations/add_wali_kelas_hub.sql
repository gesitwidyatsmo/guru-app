-- ===========================================================================
-- MIGRATION: Tabel Relasi Penugasan Wali Kelas & Sinkronisasi Cache
-- GuruApp — Fase 1 Implementasi Hub Wali Kelas
-- ===========================================================================
-- Deskripsi:
-- 1. Membuat tabel 'public.wali_kelas' untuk mencatat penugasan wali kelas
--    berbasis periode/tahun ajaran (mendukung riwayat historis multi-tahun).
-- 2. Menambahkan trigger sinkronisasi otomatis ke kolom 'kelas.id_wali_kelas'
--    dan 'kelas.wali_kelas' (100% backward-compatible).
-- 3. Mengisi data awal (seed) dari penugasan kelas yang sudah ada di tabel 'kelas'.
-- ===========================================================================

-- 1. TABEL RELASI WALI KELAS
CREATE TABLE IF NOT EXISTS public.wali_kelas (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    id_kelas TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    tahun_ajar_id TEXT REFERENCES public.tahun_ajar(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tahun_ajar_id, is_active)
);

-- Indeks performa pencarian
CREATE INDEX IF NOT EXISTS idx_wali_kelas_user ON public.wali_kelas(user_id);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_kelas ON public.wali_kelas(id_kelas);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_active ON public.wali_kelas(is_active);

-- Row Level Security (RLS)
ALTER TABLE public.wali_kelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wali kelas can be viewed by authenticated users" ON public.wali_kelas;
CREATE POLICY "Wali kelas can be viewed by authenticated users" 
ON public.wali_kelas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage wali_kelas" ON public.wali_kelas;
CREATE POLICY "Admin can manage wali_kelas" 
ON public.wali_kelas FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 2. FUNGSI & TRIGGER SINKRONISASI CACHE KE TABEL KELAS
CREATE OR REPLACE FUNCTION sync_kelas_wali_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_active = TRUE THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NEW.user_id,
            wali_kelas = (SELECT nama_lengkap FROM public.users WHERE id_user = NEW.user_id)
        WHERE id = NEW.id_kelas;
    ELSIF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.is_active = FALSE) THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NULL,
            wali_kelas = NULL
        WHERE id = OLD.id_kelas AND id_wali_kelas = OLD.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kelas_wali ON public.wali_kelas;
CREATE TRIGGER trg_sync_kelas_wali
AFTER INSERT OR UPDATE OR DELETE ON public.wali_kelas
FOR EACH ROW EXECUTE FUNCTION sync_kelas_wali_cache();

-- 3. SEED DARI DATA EXISTING (Migrasi riwayat kelas yang sudah memiliki id_wali_kelas)
DO $$
DECLARE
    active_ta_id TEXT;
BEGIN
    -- Cari ID tahun ajar aktif jika ada
    SELECT id INTO active_ta_id FROM public.tahun_ajar WHERE is_aktif = TRUE LIMIT 1;

    -- Salin assignment yang sudah ada di tabel kelas ke tabel wali_kelas
    INSERT INTO public.wali_kelas (user_id, id_kelas, tahun_ajar_id, is_active)
    SELECT k.id_wali_kelas, k.id, active_ta_id, TRUE
    FROM public.kelas k
    WHERE k.id_wali_kelas IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.wali_kelas wk 
          WHERE wk.user_id = k.id_wali_kelas 
            AND wk.id_kelas = k.id 
            AND wk.is_active = TRUE
      );
END $$;
