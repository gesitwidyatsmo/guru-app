-- ==============================================================================
-- MIGRASI: PENGATURAN MODE PEMELIHARAAN (MAINTENANCE MODE)
-- GuruApp — Jalankan di Supabase SQL Editor
-- ==============================================================================

-- 1. Pastikan tabel app_settings sudah ada
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy RLS
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.app_settings;
CREATE POLICY "Allow read for authenticated" ON public.app_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write for admin" ON public.app_settings;
CREATE POLICY "Allow write for admin" ON public.app_settings
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin'
    )
    WITH CHECK (
        (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin'
    );

-- 4. GRANT PERMISSIONS SESUAI ATURAN SUPABASE (Mulai 30 Oktober)
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;

-- 5. Seed default konfigurasi maintenance_mode jika belum ada
INSERT INTO public.app_settings (key, value)
VALUES (
    'maintenance_mode',
    '{
        "enabled": false,
        "pesan": "Mohon maaf atas ketidaknyamanannya. Website GuruApp saat ini sedang menjalani proses pemeliharaan dan pembaruan sistem secara berkala untuk meningkatkan stabilitas dan performa aplikasi.",
        "estimasi_selesai": "Segera Kembali",
        "kontak_bantuan": "081277813478",
        "allow_admin_bypass": true
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
