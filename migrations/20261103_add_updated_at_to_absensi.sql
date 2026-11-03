-- ===========================================================================
-- MIGRATION: ADD updated_at & waktu_absen TO ABSENSI MAPEL & HARIAN
-- Memastikan pencatatan waktu absensi akurat sesuai jam guru mengambil presensi
-- ===========================================================================

-- 1. Tambahkan kolom updated_at dan waktu_absen pada public.absensi_mapel
ALTER TABLE public.absensi_mapel
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS waktu_absen TEXT;

-- 2. Tambahkan kolom updated_at dan waktu_absen pada public.absensi_harian
ALTER TABLE public.absensi_harian
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS waktu_absen TEXT;

-- 3. Berikan Izin Akses Data API (PostgREST / Supabase JS) sesuai aturan Rule 2 AGENTS.md
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO service_role;
GRANT SELECT ON public.absensi_mapel TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO service_role;
GRANT SELECT ON public.absensi_harian TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO service_role;
GRANT SELECT ON public.absensi_mapel_siswa TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO service_role;
GRANT SELECT ON public.absensi_harian_siswa TO anon;
