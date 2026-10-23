-- ==============================================================================
-- MIGRASI PENAMBAHAN KOLOM ID_USER DI TABEL RAPOR_TP
-- Tujuan:
-- 1. Menyimpan relasi guru pembuat TP (id_user -> public.users.id_user)
-- 2. Memastikan TP terisolasi per guru pengampu (hanya tampil dan dipakai oleh pembuatnya)
-- ==============================================================================

-- 1. Tambah kolom id_user ke tabel rapor_tp
ALTER TABLE public.rapor_tp 
ADD COLUMN IF NOT EXISTS id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE;

-- 2. Buat index untuk optimasi performa query filter per guru
CREATE INDEX IF NOT EXISTS idx_rapor_tp_id_user ON public.rapor_tp(id_user);

-- 3. Berikan hak akses Data API (PostgREST / Supabase JS) sesuai aturan Supabase (RULE 2)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_tp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_tp TO service_role;
