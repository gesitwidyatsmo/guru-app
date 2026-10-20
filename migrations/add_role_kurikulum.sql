-- ===========================================================================
-- MIGRATION: Tambah Role 'Kurikulum' ke Tabel public.users & Skema Modul Kurikulum
-- GuruApp — Fondasi & Manajemen Role Kurikulum (Waka Kurikulum / Tim Akademik)
-- ===========================================================================
-- Deskripsi:
-- 1. Memperbarui check constraint pada kolom role tabel public.users agar
--    mengizinkan nilai 'Kurikulum'.
-- 2. Menyiapkan tabel pendukung:
--    - kurikulum_kktp (Kriteria Ketercapaian Tujuan Pembelajaran / KKM per mapel & jenjang)
--    - Penyesuaian kolom tabel jadwal (is_master, status publikasi)
-- 3. Mengatur Row Level Security (RLS) untuk keamanan akses.
-- ===========================================================================

-- 1. PERBARUI CHECK CONSTRAINT ROLE DI TABEL public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara', 'Kesiswaan', 'Kurikulum'));

-- 2. PENYESUAIAN TABEL JADWAL UNTUK MASTER TIMETABLE
ALTER TABLE public.jadwal 
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Published';

-- 3. TABEL KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP / KKM)
CREATE TABLE IF NOT EXISTS public.kurikulum_kktp (
    id SERIAL PRIMARY KEY,
    mapel_id TEXT NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
    tingkat_kelas VARCHAR(10) NOT NULL, -- contoh: '7', '8', '9' atau '10', '11', '12'
    nilai_kktp NUMERIC(5,2) DEFAULT 75.00,
    keterangan TEXT,
    tahun_ajar_id TEXT,
    semester INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mapel_id, tingkat_kelas, tahun_ajar_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_kurikulum_kktp_mapel ON public.kurikulum_kktp(mapel_id);
CREATE INDEX IF NOT EXISTS idx_kurikulum_kktp_tingkat ON public.kurikulum_kktp(tingkat_kelas);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.kurikulum_kktp ENABLE ROW LEVEL SECURITY;

-- Policy Baca KKTP (Authenticated Users)
DROP POLICY IF EXISTS "KKTP viewable by authenticated users" ON public.kurikulum_kktp;
CREATE POLICY "KKTP viewable by authenticated users"
ON public.kurikulum_kktp FOR SELECT TO authenticated USING (true);

-- Policy Tulis/Ubah KKTP (Khusus Admin & Kurikulum)
DROP POLICY IF EXISTS "Kurikulum & Admin can modify KKTP" ON public.kurikulum_kktp;
CREATE POLICY "Kurikulum & Admin can modify KKTP"
ON public.kurikulum_kktp FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum') );

-- Policy Guru KBM & Mapel (Pastikan role Kurikulum diizinkan memodifikasi)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guru_kbm'
    ) THEN
        DROP POLICY IF EXISTS "Kurikulum & Admin can modify guru_kbm" ON public.guru_kbm;
        CREATE POLICY "Kurikulum & Admin can modify guru_kbm"
        ON public.guru_kbm FOR ALL TO authenticated
        USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kurikulum') );
    END IF;
END $$;
