-- ==============================================================================
-- MIGRASI MODUL ERAPOR KURIKULUM MERDEKA - GURU APP
-- Target: Supabase Postgres (SMP IT Tebuireng 4 Al-Ishlah)
-- ==============================================================================

-- 1. Lengkapi tabel public.siswa dengan atribut identitas rapor
ALTER TABLE public.siswa 
ADD COLUMN IF NOT EXISTS nisn TEXT,
ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
ADD COLUMN IF NOT EXISTS agama TEXT DEFAULT 'Islam',
ADD COLUMN IF NOT EXISTS status_dalam_keluarga TEXT,
ADD COLUMN IF NOT EXISTS anak_ke INTEGER,
ADD COLUMN IF NOT EXISTS alamat TEXT,
ADD COLUMN IF NOT EXISTS telepon_siswa TEXT,
ADD COLUMN IF NOT EXISTS sekolah_asal TEXT,
ADD COLUMN IF NOT EXISTS diterima_di_kelas TEXT,
ADD COLUMN IF NOT EXISTS diterima_pada_tanggal DATE,
ADD COLUMN IF NOT EXISTS nama_ayah TEXT,
ADD COLUMN IF NOT EXISTS pekerjaan_ayah TEXT,
ADD COLUMN IF NOT EXISTS nama_ibu TEXT,
ADD COLUMN IF NOT EXISTS pekerjaan_ibu TEXT,
ADD COLUMN IF NOT EXISTS alamat_orang_tua TEXT,
ADD COLUMN IF NOT EXISTS telepon_orang_tua TEXT,
ADD COLUMN IF NOT EXISTS wali_siswa TEXT,
ADD COLUMN IF NOT EXISTS pekerjaan_wali TEXT,
ADD COLUMN IF NOT EXISTS alamat_wali TEXT,
ADD COLUMN IF NOT EXISTS telepon_wali TEXT;

-- 2. Lengkapi tabel public.mapel dengan format nama resmi rapor & kelompok
ALTER TABLE public.mapel
ADD COLUMN IF NOT EXISTS nama_resmi TEXT,
ADD COLUMN IF NOT EXISTS kelompok TEXT DEFAULT 'A',
ADD COLUMN IF NOT EXISTS urutan INTEGER DEFAULT 1;

-- Update data nama resmi mata pelajaran standar Kurikulum Merdeka
UPDATE public.mapel SET nama_resmi = 'Pendidikan Agama Islam dan Budi Pekerti', kelompok = 'A', urutan = 1 WHERE id ILIKE '%PABP%' OR mapel ILIKE '%PABP%';
UPDATE public.mapel SET nama_resmi = 'Pendidikan Pancasila', kelompok = 'A', urutan = 2 WHERE id ILIKE '%PKN%' OR mapel ILIKE '%PKN%';
UPDATE public.mapel SET nama_resmi = 'Bahasa Indonesia', kelompok = 'A', urutan = 3 WHERE id ILIKE '%BINDO%' OR mapel ILIKE '%B.INDO%';
UPDATE public.mapel SET nama_resmi = 'Matematika', kelompok = 'A', urutan = 4 WHERE id ILIKE '%MTK%' OR mapel ILIKE '%MTK%';
UPDATE public.mapel SET nama_resmi = 'Ilmu Pengetahuan Alam', kelompok = 'A', urutan = 5 WHERE id ILIKE '%IPA%' OR mapel ILIKE '%IPA%';
UPDATE public.mapel SET nama_resmi = 'Ilmu Pengetahuan Sosial', kelompok = 'A', urutan = 6 WHERE id ILIKE '%IPS%' OR mapel ILIKE '%IPS%';
UPDATE public.mapel SET nama_resmi = 'Bahasa Inggris', kelompok = 'A', urutan = 7 WHERE id ILIKE '%BING%' OR mapel ILIKE '%B.ING%';
UPDATE public.mapel SET nama_resmi = 'Pendidikan Jasmani Olahraga dan Kesehatan', kelompok = 'A', urutan = 8 WHERE id ILIKE '%PJOK%' OR mapel ILIKE '%PJOK%';
UPDATE public.mapel SET nama_resmi = 'Informatika', kelompok = 'A', urutan = 9 WHERE id ILIKE '%TIK%' OR id ILIKE '%INF%' OR mapel ILIKE '%TIK%' OR mapel ILIKE '%INF%';
UPDATE public.mapel SET nama_resmi = 'Seni Rupa', kelompok = 'A', urutan = 10 WHERE id ILIKE '%SBK%' OR id ILIKE '%SENI%' OR mapel ILIKE '%SBK%' OR mapel ILIKE '%SENI%';
UPDATE public.mapel SET nama_resmi = 'Budaya Melayu Riau (BMR)', kelompok = 'B', urutan = 11 WHERE id ILIKE '%BMR%' OR mapel ILIKE '%BMR%';
UPDATE public.mapel SET nama_resmi = 'Belajar Membaca Kitab Kuning', kelompok = 'B', urutan = 12 WHERE id ILIKE '%BMK%' OR id ILIKE '%KITAB%' OR mapel ILIKE '%BMK%';
UPDATE public.mapel SET nama_resmi = 'Aswaja / Ke-NU-an', kelompok = 'B', urutan = 13 WHERE id ILIKE '%ASW%' OR mapel ILIKE '%ASW%';
UPDATE public.mapel SET nama_resmi = 'Khat / Kaligrafi', kelompok = 'B', urutan = 14 WHERE id ILIKE '%KHOT%' OR mapel ILIKE '%KHOT%';

-- 3. Tabel Tujuan Pembelajaran (TP)
CREATE TABLE IF NOT EXISTS public.rapor_tp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapel_id TEXT NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
    deskripsi TEXT NOT NULL,
    tingkat INTEGER NOT NULL DEFAULT 7, -- 7, 8, atau 9
    kode_tp TEXT DEFAULT '-',
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabel Nilai Kuantitatif (Nilai Akhir 0-100)
CREATE TABLE IF NOT EXISTS public.rapor_nilai_kuantitatif (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id TEXT NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL DEFAULT 1,
    tahun_ajaran TEXT NOT NULL,
    nilai_akhir NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_nk_unique UNIQUE (siswa_id, mapel_id, kelas_id, semester, tahun_ajaran)
);

-- 5. Tabel Nilai TP (Rubrik Skala 1-4 per TP)
CREATE TABLE IF NOT EXISTS public.rapor_nilai_tp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    tp_id UUID NOT NULL REFERENCES public.rapor_tp(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL DEFAULT 1,
    tahun_ajaran TEXT NOT NULL,
    nilai INTEGER CHECK (nilai BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_ntp_unique UNIQUE (siswa_id, tp_id, semester, tahun_ajaran)
);

-- 6. Tabel Nilai Kualitatif (Deskripsi Otomatis Capaian Kompetensi)
CREATE TABLE IF NOT EXISTS public.rapor_nilai_kualitatif (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    mapel_id TEXT NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL DEFAULT 1,
    tahun_ajaran TEXT NOT NULL,
    deskripsi_tertinggi TEXT,
    deskripsi_terendah TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_nkl_unique UNIQUE (siswa_id, mapel_id, kelas_id, semester, tahun_ajaran)
);

-- 7. Tabel Ekstrakurikuler
CREATE TABLE IF NOT EXISTS public.rapor_ekstrakurikuler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL DEFAULT 1,
    tahun_ajaran TEXT NOT NULL,
    nama_ekskul TEXT NOT NULL,
    predikat TEXT, -- 'Sangat Baik', 'Baik', dll.
    keterangan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_ekskul_unique UNIQUE (siswa_id, nama_ekskul, semester, tahun_ajaran)
);

-- 8. Tabel Ketidakhadiran Rekap Semester
CREATE TABLE IF NOT EXISTS public.rapor_ketidakhadiran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    kelas_id TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL DEFAULT 1,
    tahun_ajaran TEXT NOT NULL,
    sakit INTEGER DEFAULT 0,
    izin INTEGER DEFAULT 0,
    tanpa_keterangan INTEGER DEFAULT 0,
    catatan_wali_kelas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_absen_unique UNIQUE (siswa_id, semester, tahun_ajaran)
);

-- 9. Tabel Pengaturan Rapor & Titimangsa
CREATE TABLE IF NOT EXISTS public.rapor_pengaturan (
    id SERIAL PRIMARY KEY,
    tempat_rapor TEXT DEFAULT 'Kuala Gading',
    tanggal_rapor TEXT DEFAULT '21 Desember 2024',
    titimangsa_rapor DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed pengaturan rapor awal jika belum ada
INSERT INTO public.rapor_pengaturan (id, tempat_rapor, tanggal_rapor)
VALUES (1, 'Kuala Gading', '21 Desember 2024')
ON CONFLICT (id) DO NOTHING;

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.rapor_tp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_nilai_kuantitatif ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_nilai_tp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_nilai_kualitatif ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_ekstrakurikuler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_ketidakhadiran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_pengaturan ENABLE ROW LEVEL SECURITY;

-- 11. Kebijakan Akses (RLS Policies)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'rapor_tp', 'rapor_nilai_kuantitatif', 'rapor_nilai_tp', 
        'rapor_nilai_kualitatif', 'rapor_ekstrakurikuler', 
        'rapor_ketidakhadiran', 'rapor_pengaturan'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_authenticated_all" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "allow_authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- 12. GRANT Permissions (Wajib Supabase Migration Rule)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_tp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_tp TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_kuantitatif TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_kuantitatif TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_tp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_tp TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_kualitatif TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_nilai_kualitatif TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_ekstrakurikuler TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_ekstrakurikuler TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_ketidakhadiran TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_ketidakhadiran TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_pengaturan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapor_pengaturan TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rapor_pengaturan_id_seq TO authenticated, service_role;

-- 13. Index untuk performa query ERapor
CREATE INDEX IF NOT EXISTS idx_rapor_tp_mapel_tingkat ON public.rapor_tp(mapel_id, tingkat);
CREATE INDEX IF NOT EXISTS idx_rapor_nk_filter ON public.rapor_nilai_kuantitatif(kelas_id, mapel_id, semester, tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_rapor_nkl_filter ON public.rapor_nilai_kualitatif(kelas_id, mapel_id, semester, tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_rapor_ntp_filter ON public.rapor_nilai_tp(tp_id, semester, tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_rapor_absen_filter ON public.rapor_ketidakhadiran(kelas_id, semester, tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_rapor_ekskul_filter ON public.rapor_ekstrakurikuler(kelas_id, semester, tahun_ajaran);
