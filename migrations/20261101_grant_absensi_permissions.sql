-- ===========================================================================
-- MIGRATION: GRANT DATA API PERMISSIONS & ENFORCE RLS UNTUK TABEL ABSENSI
-- Wajib dijalankan di Supabase SQL Editor jika absensi gagal disimpan karena 42501 permission denied
-- ===========================================================================

-- 1. Berikan Izin Akses Data API (PostgREST) untuk Tabel Absensi Harian & Rincian Siswa
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian TO service_role;
GRANT SELECT ON public.absensi_harian TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_harian_siswa TO service_role;
GRANT SELECT ON public.absensi_harian_siswa TO anon;

-- 2. Berikan Izin Akses Data API (PostgREST) untuk Tabel Absensi Mapel & Rincian Siswa
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel TO service_role;
GRANT SELECT ON public.absensi_mapel TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi_mapel_siswa TO service_role;
GRANT SELECT ON public.absensi_mapel_siswa TO anon;

-- 3. Sequence / Serial Permissions (Jika ada auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Perluas Kebijakan RLS agar Admin / Kurikulum / Piket Bisa Mengelola Absensi Mapel
DROP POLICY IF EXISTS "Guru can manage their own absensi mapel" ON public.absensi_mapel;
CREATE POLICY "Guru and staff can manage absensi mapel" ON public.absensi_mapel FOR ALL TO authenticated 
USING (
    guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah', 'Kesiswaan')
)
WITH CHECK (
    guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah', 'Kesiswaan')
);

DROP POLICY IF EXISTS "Guru can manage their own absensi mapel siswa" ON public.absensi_mapel_siswa;
CREATE POLICY "Guru and staff can manage absensi mapel siswa" ON public.absensi_mapel_siswa FOR ALL TO authenticated 
USING (
    (SELECT guru_id FROM public.absensi_mapel WHERE sesi_id = public.absensi_mapel_siswa.sesi_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah', 'Kesiswaan')
)
WITH CHECK (
    (SELECT guru_id FROM public.absensi_mapel WHERE sesi_id = public.absensi_mapel_siswa.sesi_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid())
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum', 'Kepala Sekolah', 'Kesiswaan')
);
