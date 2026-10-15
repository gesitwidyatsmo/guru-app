-- =====================================================
-- MIGRASI: APP_SETTINGS & GEOFENCING SEKOLAH
-- GuruApp — Jalankan di Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aktifkan Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: User yang terautentikasi bisa membaca pengaturan
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.app_settings;
CREATE POLICY "Allow read for authenticated" ON public.app_settings
    FOR SELECT TO authenticated USING (true);

-- Policy: Hanya Admin yang bisa insert/update/delete
DROP POLICY IF EXISTS "Allow write for admin" ON public.app_settings;
CREATE POLICY "Allow write for admin" ON public.app_settings
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin'
    )
    WITH CHECK (
        (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin'
    );

-- Seed default geofence configuration jika belum ada
INSERT INTO public.app_settings (key, value)
VALUES (
    'geofence',
    '{
        "enabled": false,
        "lat": -6.200000,
        "lng": 106.816666,
        "radius": 200,
        "nama_lokasi": "Area Sekolah",
        "berlaku_untuk": ["jurnal"]
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
