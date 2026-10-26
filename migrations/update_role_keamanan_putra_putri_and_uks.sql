-- ===========================================================================
-- MIGRATION: Update Role 'Keamanan Putra' & 'Keamanan Putri' + UKS + Rentang Tanggal
-- GuruApp — Keamanan Santri Putra, Putri, Dispensasi UKS, & Multi-Day Leave
-- ===========================================================================
-- Deskripsi:
-- 1. Memperbarui check constraint pada kolom role tabel public.users agar
--    mengizinkan nilai 'Keamanan Putra' dan 'Keamanan Putri' (serta 'Keamanan' lama).
-- 2. Menambahkan kolom jenis_kelamin, relasi_penjemput, no_telp_penjemput,
--    serta tanggal_selesai (untuk izin berhari-hari / rentang tanggal).
-- 3. Mengisi (backfill) tanggal_selesai = tanggal untuk surat yang sudah ada.
-- 4. Membuat index untuk pencarian cepat rentang tanggal & gender.
-- 5. Memperbarui Row Level Security (RLS) untuk Keamanan Putra, Putri, & Admin.
-- 6. Memberikan GRANT permissions eksplisit (Post-30 Oktober Supabase Compliance).
-- ===========================================================================

-- 1. PERBARUI CHECK CONSTRAINT ROLE DI TABEL public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN (
    'Admin', 
    'Guru', 
    'Kepala Sekolah', 
    'Bendahara', 
    'Kesiswaan', 
    'Kurikulum', 
    'Keamanan', 
    'Keamanan Putra', 
    'Keamanan Putri'
));

-- 2. TAMBAH KOLOM PADA TABEL public.keamanan_surat_izin
ALTER TABLE public.keamanan_surat_izin 
ADD COLUMN IF NOT EXISTS jenis_kelamin VARCHAR(20) DEFAULT 'Laki-laki',
ADD COLUMN IF NOT EXISTS relasi_penjemput VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS no_telp_penjemput VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tanggal_selesai DATE DEFAULT NULL;

-- 3. BACKFILL DATA YANG SUDAH ADA
-- Isi tanggal_selesai dengan tanggal jika masih kosong (1 hari)
UPDATE public.keamanan_surat_izin
SET tanggal_selesai = tanggal
WHERE tanggal_selesai IS NULL;

-- Backfill jenis_kelamin dari tabel master siswa
UPDATE public.keamanan_surat_izin k
SET jenis_kelamin = s.jenis_kelamin
FROM public.siswa s
WHERE k.siswa_id = s.id AND (k.jenis_kelamin IS NULL OR k.jenis_kelamin = '');

-- 4. BUAT INDEX FILTER RENTANG TANGGAL & GENDER
CREATE INDEX IF NOT EXISTS idx_keamanan_surat_gender ON public.keamanan_surat_izin(jenis_kelamin);
CREATE INDEX IF NOT EXISTS idx_keamanan_surat_rentang_tgl ON public.keamanan_surat_izin(tanggal, tanggal_selesai);

-- 5. ROW LEVEL SECURITY (RLS) UPDATE
ALTER TABLE public.keamanan_surat_izin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Surat izin viewable by authenticated users" ON public.keamanan_surat_izin;
CREATE POLICY "Surat izin viewable by authenticated users"
ON public.keamanan_surat_izin FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Keamanan & Admin can manage surat izin" ON public.keamanan_surat_izin;
CREATE POLICY "Keamanan & Admin can manage surat izin"
ON public.keamanan_surat_izin FOR ALL TO authenticated
USING ( 
    (SELECT role FROM public.users WHERE auth_id = auth.uid()) 
    IN ('Admin', 'Keamanan', 'Keamanan Putra', 'Keamanan Putri') 
);

-- 6. GRANT PERMISSIONS (SUPABASE POST-OCTOBER 30 COMPLIANCE)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keamanan_surat_izin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keamanan_surat_izin TO service_role;
