-- ===========================================================================
-- MIGRATION: STATUS RESOLUSI BENTROK JURNAL & REFERENSI KONFLIK
-- Menambahkan penanda status verifikasi KBM, ID konflik pembanding,
-- catatan audit resolusi admin, dan RLS permission pada tabel public.jurnal.
-- ===========================================================================

-- 1. Tambah kolom penanda verifikasi & relasi konflik di tabel public.jurnal
ALTER TABLE public.jurnal 
ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(30) DEFAULT 'disetujui',
ADD COLUMN IF NOT EXISTS konflik_dengan_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS catatan_admin TEXT;

-- Keterangan kolom:
-- status_verifikasi: 'disetujui' (resmi/default), 'draft_bentrok' (antrean koreksi), 'ditolak'
-- konflik_dengan_id: Menyimpan ID jurnal lawan yang menyebabkan bentrok (untuk auto-resolve)
-- catatan_admin: Log audit tindakan admin (misal: "Dipangkas dari 1-4 menjadi 1-2 oleh Admin")

-- 2. Index untuk mempercepat query radar bentrok dan filter Bisaroh
CREATE INDEX IF NOT EXISTS idx_jurnal_status_verifikasi ON public.jurnal(status_verifikasi);
CREATE INDEX IF NOT EXISTS idx_jurnal_konflik_id ON public.jurnal(konflik_dengan_id);

-- 3. GRANT Permissions Eksplisit (Wajib Sesuai Aturan Supabase Migrasi)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jurnal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jurnal TO service_role;

-- 4. Perluas Kebijakan RLS agar Admin / Kurikulum / Kepala Sekolah dapat mengedit & mengelola jurnal guru
DROP POLICY IF EXISTS "Guru can manage their own jurnal" ON public.jurnal;
CREATE POLICY "Guru and staff can manage jurnal" ON public.jurnal FOR ALL TO authenticated 
USING (
    guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah')
)
WITH CHECK (
    guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah')
);
