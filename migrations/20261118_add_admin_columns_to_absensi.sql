-- ===========================================================================
-- MIGRATION: ADD catatan_admin & status_verifikasi TO ABSENSI MAPEL & HARIAN
-- Memastikan Admin memiliki kendali penuh dan jejak audit atas presensi siswa
-- ===========================================================================

-- 1. Tambahkan kolom catatan_admin dan status_verifikasi pada absensi_mapel
ALTER TABLE public.absensi_mapel
ADD COLUMN IF NOT EXISTS catatan_admin TEXT,
ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(50) DEFAULT 'disetujui';

-- 2. Tambahkan kolom catatan_admin pada absensi_harian
ALTER TABLE public.absensi_harian
ADD COLUMN IF NOT EXISTS catatan_admin TEXT;

-- 3. Berikan Izin Akses Data API (PostgREST / Supabase JS) sesuai aturan Rule 2 AGENTS.md
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO service_role;
GRANT SELECT ON public.absensi_mapel TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO service_role;
GRANT SELECT ON public.absensi_mapel_siswa TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO service_role;
GRANT SELECT ON public.absensi_harian TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO service_role;
GRANT SELECT ON public.absensi_harian_siswa TO anon;
