-- =====================================================
-- MIGRASI: TAMBAH KOLOM NIP PADA TABEL USERS
-- GuruApp — Jalankan script ini di Supabase SQL Editor
-- =====================================================

-- 1. Tambah kolom nip di tabel users jika belum ada
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS nip TEXT;

-- 2. Beri komentar dokumentasi kolom
COMMENT ON COLUMN public.users.nip IS 'Nomor Induk Pegawai (NIP) / NUPTK / Identitas Pegawai Resmi';

-- 3. Verifikasi struktur kolom
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users';
