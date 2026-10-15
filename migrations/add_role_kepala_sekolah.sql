-- ===========================================================================
-- MIGRATION: Tambah Role 'Kepala Sekolah' ke Tabel public.users
-- ===========================================================================
-- Error: new row for relation "users" violates check constraint "users_role_check"
-- Penyebab: Tabel users sebelumnya memiliki constraint CHECK (role IN ('Admin', 'Guru')).
-- Solusi: Hapus constraint lama dan buat constraint baru yang mencakup 'Kepala Sekolah'.
-- ===========================================================================

-- 1. Hapus constraint lama
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Tambahkan constraint baru yang mengizinkan 'Admin', 'Guru', dan 'Kepala Sekolah'
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah'));
