-- ===========================================================================
-- MIGRATION: Tambah Role 'Bendahara' ke Tabel public.users & Pengaturan Bisaroh
-- ===========================================================================
-- Deskripsi:
-- 1. Memperbarui check constraint pada kolom role tabel public.users agar
--    mengizinkan nilai 'Bendahara'.
-- 2. Menyiapkan konfigurasi bawaan (default) tarif bisaroh di tabel app_settings.
-- ===========================================================================

-- 1. Hapus constraint lama
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Tambahkan constraint baru yang mengizinkan 'Admin', 'Guru', 'Kepala Sekolah', dan 'Bendahara'
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara'));

-- 3. Seed default bisaroh configuration ke tabel app_settings (jika tabel sudah dibuat)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_settings') THEN
        INSERT INTO public.app_settings (key, value, updated_at)
        VALUES (
            'bisaroh_settings',
            '{"tarif_per_jp": 35000, "tunjangan_wali_kelas": 150000, "tunjangan_kehadiran_per_hari": 15000, "cut_off_tanggal": 25}'::jsonb,
            NOW()
        )
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;
