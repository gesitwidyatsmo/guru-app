-- ===========================================================================
-- DATABASE SCHEMA: GURU-APP (SUPABASE POSTGRESQL)
-- Versi: 2.0 (Lengkap Seluruh Modul & Migrasi)
-- Target: Supabase Postgres
-- ===========================================================================

-- 1. EKSTENSI POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================================================
-- FASE 1: FOUNDATION & DATA MASTER
-- ===========================================================================

-- 1. TABEL USERS (Profil Pengguna GuruApp)
CREATE TABLE IF NOT EXISTS public.users (
    id_user TEXT PRIMARY KEY,
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    nama_lengkap TEXT NOT NULL,
    role TEXT CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara')) NOT NULL,
    nip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can be viewed by authenticated users" ON public.users;
CREATE POLICY "Users can be viewed by authenticated users" ON public.users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert users" ON public.users;
CREATE POLICY "Admin can insert users" ON public.users FOR INSERT TO authenticated 
WITH CHECK ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
DROP POLICY IF EXISTS "Admin can update users" ON public.users;
CREATE POLICY "Admin can update users" ON public.users FOR UPDATE TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;
CREATE POLICY "Admin can delete users" ON public.users FOR DELETE TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 2. TABEL APP_SETTINGS (Pengaturan Aplikasi, Geofence, & Bisaroh)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.app_settings;
CREATE POLICY "Allow read for authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for admin" ON public.app_settings;
CREATE POLICY "Allow write for admin" ON public.app_settings FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' )
WITH CHECK ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 3. TABEL TAHUN_AJAR (Master Periode Akademik Multi-Tahun)
CREATE TABLE IF NOT EXISTS public.tahun_ajar (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    semester INTEGER NOT NULL,
    is_aktif BOOLEAN DEFAULT FALSE,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nama, semester)
);

ALTER TABLE public.tahun_ajar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tahun ajar bisa dilihat semua user login" ON public.tahun_ajar;
CREATE POLICY "Tahun ajar bisa dilihat semua user login" ON public.tahun_ajar FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Hanya Admin yang bisa kelola tahun ajar" ON public.tahun_ajar;
CREATE POLICY "Hanya Admin yang bisa kelola tahun ajar" ON public.tahun_ajar FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 4. TABEL KELAS
CREATE TABLE IF NOT EXISTS public.kelas (
    id TEXT PRIMARY KEY,
    nama_kelas TEXT UNIQUE NOT NULL,
    wali_kelas TEXT,
    id_wali_kelas TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kelas can be viewed by authenticated users" ON public.kelas;
CREATE POLICY "Kelas can be viewed by authenticated users" ON public.kelas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage kelas" ON public.kelas;
CREATE POLICY "Admin can manage kelas" ON public.kelas FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 5. TABEL WALI_KELAS (Relasi Penugasan Wali Kelas & Multi-Tahun Ajar)
CREATE TABLE IF NOT EXISTS public.wali_kelas (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    id_kelas TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    tahun_ajar_id TEXT REFERENCES public.tahun_ajar(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tahun_ajar_id, is_active)
);

ALTER TABLE public.wali_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Wali kelas can be viewed by authenticated users" ON public.wali_kelas;
CREATE POLICY "Wali kelas can be viewed by authenticated users" ON public.wali_kelas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage wali_kelas" ON public.wali_kelas;
CREATE POLICY "Admin can manage wali_kelas" ON public.wali_kelas FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

CREATE INDEX IF NOT EXISTS idx_wali_kelas_user ON public.wali_kelas(user_id);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_kelas ON public.wali_kelas(id_kelas);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_active ON public.wali_kelas(is_active);

-- Trigger Sinkronisasi Cache Wali Kelas ke Tabel Kelas
CREATE OR REPLACE FUNCTION sync_kelas_wali_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_active = TRUE THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NEW.user_id,
            wali_kelas = (SELECT nama_lengkap FROM public.users WHERE id_user = NEW.user_id)
        WHERE id = NEW.id_kelas;
    ELSIF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.is_active = FALSE) THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NULL,
            wali_kelas = NULL
        WHERE id = OLD.id_kelas AND id_wali_kelas = OLD.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kelas_wali ON public.wali_kelas;
CREATE TRIGGER trg_sync_kelas_wali
AFTER INSERT OR UPDATE OR DELETE ON public.wali_kelas
FOR EACH ROW EXECUTE FUNCTION sync_kelas_wali_cache();

-- 6. TABEL MAPEL (Mata Pelajaran)
CREATE TABLE IF NOT EXISTS public.mapel (
    id TEXT PRIMARY KEY,
    mapel TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mapel can be viewed by authenticated users" ON public.mapel;
CREATE POLICY "Mapel can be viewed by authenticated users" ON public.mapel FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage mapel" ON public.mapel;
CREATE POLICY "Admin can manage mapel" ON public.mapel FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 7. TABEL SISWA
CREATE TABLE IF NOT EXISTS public.siswa (
    id TEXT PRIMARY KEY,
    nis TEXT,
    nama_lengkap TEXT NOT NULL,
    kelas TEXT REFERENCES public.kelas(nama_kelas) ON UPDATE CASCADE ON DELETE SET NULL,
    jenis_kelamin TEXT CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
    status TEXT DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Siswa can be viewed by authenticated users" ON public.siswa;
CREATE POLICY "Siswa can be viewed by authenticated users" ON public.siswa FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage siswa" ON public.siswa;
CREATE POLICY "Admin can manage siswa" ON public.siswa FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 8. TABEL GURU_KBM (Penugasan Mengajar Guru)
CREATE TABLE IF NOT EXISTS public.guru_kbm (
    id_kbm TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    kelas TEXT REFERENCES public.kelas(nama_kelas) ON UPDATE CASCADE ON DELETE CASCADE,
    mapel TEXT REFERENCES public.mapel(mapel) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.guru_kbm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "KBM can be viewed by authenticated users" ON public.guru_kbm;
CREATE POLICY "KBM can be viewed by authenticated users" ON public.guru_kbm FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage KBM" ON public.guru_kbm;
CREATE POLICY "Admin can manage KBM" ON public.guru_kbm FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
DROP POLICY IF EXISTS "Guru can manage their own KBM" ON public.guru_kbm;
CREATE POLICY "Guru can manage their own KBM" ON public.guru_kbm FOR ALL TO authenticated 
USING ( id_user = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_guru_kbm_periode ON public.guru_kbm(tahun_ajar, semester);

-- ===========================================================================
-- FASE 2: CORE FEATURES (Jadwal, Jurnal, Nilai)
-- ===========================================================================

-- 9. TABEL JADWAL
CREATE TABLE IF NOT EXISTS public.jadwal (
    id TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    mapel TEXT,
    kelas TEXT,
    hari TEXT,
    jam_ke TEXT,
    jam_mulai TEXT,
    jam_selesai TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Jadwal can be viewed by authenticated users" ON public.jadwal;
CREATE POLICY "Jadwal can be viewed by authenticated users" ON public.jadwal FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage jadwal" ON public.jadwal;
CREATE POLICY "Admin can manage jadwal" ON public.jadwal FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
DROP POLICY IF EXISTS "Guru can manage their own jadwal" ON public.jadwal;
CREATE POLICY "Guru can manage their own jadwal" ON public.jadwal FOR ALL TO authenticated 
USING ( id_user = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_jadwal_periode ON public.jadwal(tahun_ajar, semester);

-- 10. TABEL JURNAL
CREATE TABLE IF NOT EXISTS public.jurnal (
    id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    tanggal DATE,
    jam_ke TEXT,
    pertemuan_ke TEXT,
    kelas TEXT,
    mapel TEXT,
    materi TEXT,
    kegiatan TEXT,
    hambatan TEXT,
    solusi TEXT,
    tuntas BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.jurnal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Jurnal can be viewed by authenticated users" ON public.jurnal;
CREATE POLICY "Jurnal can be viewed by authenticated users" ON public.jurnal FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own jurnal" ON public.jurnal;
CREATE POLICY "Guru can manage their own jurnal" ON public.jurnal FOR ALL TO authenticated 
USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_jurnal_periode ON public.jurnal(tahun_ajar, semester);

-- 11. TABEL NILAI TUGAS & NILAI SISWA
CREATE TABLE IF NOT EXISTS public.nilai_tugas (
    tugas_id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    kategori TEXT,
    type TEXT,
    deskripsi TEXT,
    kelas TEXT,
    mapel TEXT,
    tanggal DATE,
    mode_penilaian TEXT DEFAULT 'langsung',
    total_soal INTEGER DEFAULT 100,
    skala_maks INTEGER DEFAULT 100,
    pembulatan TEXT DEFAULT 'decimal_1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nilai Tugas can be viewed by authenticated users" ON public.nilai_tugas;
CREATE POLICY "Nilai Tugas can be viewed by authenticated users" ON public.nilai_tugas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own nilai_tugas" ON public.nilai_tugas;
CREATE POLICY "Guru can manage their own nilai_tugas" ON public.nilai_tugas FOR ALL TO authenticated 
USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_nilai_tugas_periode ON public.nilai_tugas(tahun_ajar, semester);

CREATE TABLE IF NOT EXISTS public.nilai_siswa (
    id SERIAL PRIMARY KEY,
    tugas_id TEXT REFERENCES public.nilai_tugas(tugas_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_siswa TEXT,
    nilai NUMERIC,
    jumlah_benar NUMERIC DEFAULT NULL,
    UNIQUE(tugas_id, siswa_id)
);

ALTER TABLE public.nilai_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nilai Siswa can be viewed by authenticated users" ON public.nilai_siswa;
CREATE POLICY "Nilai Siswa can be viewed by authenticated users" ON public.nilai_siswa FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own nilai_siswa" ON public.nilai_siswa;
CREATE POLICY "Guru can manage their own nilai_siswa" ON public.nilai_siswa FOR ALL TO authenticated 
USING ( (SELECT guru_id FROM public.nilai_tugas WHERE tugas_id = public.nilai_siswa.tugas_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- ===========================================================================
-- FASE 3: ATTENDANCE (Absensi)
-- ===========================================================================

-- 12. TABEL ABSENSI HARIAN & SISWA
CREATE TABLE IF NOT EXISTS public.absensi_harian (
    sesi_id TEXT PRIMARY KEY,
    tanggal DATE,
    kelas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.absensi_harian ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Absensi harian can be viewed by authenticated users" ON public.absensi_harian;
CREATE POLICY "Absensi harian can be viewed by authenticated users" ON public.absensi_harian FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru and admin can manage absensi harian" ON public.absensi_harian;
CREATE POLICY "Guru and admin can manage absensi harian" ON public.absensi_harian FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_absensi_harian_periode ON public.absensi_harian(tahun_ajar, semester);

CREATE TABLE IF NOT EXISTS public.absensi_harian_siswa (
    id SERIAL PRIMARY KEY,
    sesi_id TEXT REFERENCES public.absensi_harian(sesi_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    status TEXT,
    keterangan TEXT,
    UNIQUE(sesi_id, siswa_id)
);

ALTER TABLE public.absensi_harian_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Absensi harian siswa can be viewed by authenticated users" ON public.absensi_harian_siswa;
CREATE POLICY "Absensi harian siswa can be viewed by authenticated users" ON public.absensi_harian_siswa FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru and admin can manage absensi harian siswa" ON public.absensi_harian_siswa;
CREATE POLICY "Guru and admin can manage absensi harian siswa" ON public.absensi_harian_siswa FOR ALL TO authenticated USING (true);

-- 13. TABEL ABSENSI MAPEL & SISWA
CREATE TABLE IF NOT EXISTS public.absensi_mapel (
    sesi_id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    tanggal DATE,
    jam_ke TEXT,
    kelas TEXT,
    mapel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.absensi_mapel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Absensi mapel can be viewed by authenticated users" ON public.absensi_mapel;
CREATE POLICY "Absensi mapel can be viewed by authenticated users" ON public.absensi_mapel FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own absensi mapel" ON public.absensi_mapel;
CREATE POLICY "Guru can manage their own absensi mapel" ON public.absensi_mapel FOR ALL TO authenticated 
USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_absensi_mapel_periode ON public.absensi_mapel(tahun_ajar, semester);

CREATE TABLE IF NOT EXISTS public.absensi_mapel_siswa (
    id SERIAL PRIMARY KEY,
    sesi_id TEXT REFERENCES public.absensi_mapel(sesi_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    status TEXT,
    keterangan TEXT,
    UNIQUE(sesi_id, siswa_id)
);

ALTER TABLE public.absensi_mapel_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Absensi mapel siswa can be viewed by authenticated users" ON public.absensi_mapel_siswa;
CREATE POLICY "Absensi mapel siswa can be viewed by authenticated users" ON public.absensi_mapel_siswa FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own absensi mapel siswa" ON public.absensi_mapel_siswa;
CREATE POLICY "Guru can manage their own absensi mapel siswa" ON public.absensi_mapel_siswa FOR ALL TO authenticated 
USING ( (SELECT guru_id FROM public.absensi_mapel WHERE sesi_id = public.absensi_mapel_siswa.sesi_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- ===========================================================================
-- FASE 4: EXTRAS (Poin Siswa, Grup, Tugas Online, Catatan Guru)
-- ===========================================================================

-- 14. TABEL POIN (Poin Pelanggaran / Prestasi Siswa)
CREATE TABLE IF NOT EXISTS public.poin (
    id TEXT PRIMARY KEY,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    tanggal DATE,
    tipe TEXT,
    kategori TEXT,
    aktifitas TEXT,
    poin INTEGER,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.poin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Poin can be viewed by authenticated users" ON public.poin;
CREATE POLICY "Poin can be viewed by authenticated users" ON public.poin FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own poin" ON public.poin;
CREATE POLICY "Guru can manage their own poin" ON public.poin FOR ALL TO authenticated 
USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "Admin can manage poin" ON public.poin;
CREATE POLICY "Admin can manage poin" ON public.poin FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

CREATE INDEX IF NOT EXISTS idx_poin_periode ON public.poin(tahun_ajar, semester);

-- 15. TABEL GRUP (Kelompok Belajar Siswa)
CREATE TABLE IF NOT EXISTS public.grup (
    id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    judul_kegiatan TEXT,
    kelas_id TEXT,
    mapel_id TEXT,
    tanggal DATE,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    semester INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.grup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Grup can be viewed by authenticated users" ON public.grup;
CREATE POLICY "Grup can be viewed by authenticated users" ON public.grup FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guru can manage their own grup" ON public.grup;
CREATE POLICY "Guru can manage their own grup" ON public.grup FOR ALL TO authenticated 
USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE INDEX IF NOT EXISTS idx_grup_periode ON public.grup(tahun_ajar, semester);

-- 16. TABEL TUGAS ONLINE & PENGUMPULAN TUGAS
CREATE TABLE IF NOT EXISTS public.tugas_online (
    id TEXT PRIMARY KEY,
    pin TEXT UNIQUE,
    judul TEXT,
    mapel TEXT,
    materi TEXT,
    tipe_soal TEXT,
    soal JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tugas_online ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tugas online can be viewed by anyone" ON public.tugas_online;
CREATE POLICY "Tugas online can be viewed by anyone" ON public.tugas_online FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Tugas online can be managed by authenticated users" ON public.tugas_online;
CREATE POLICY "Tugas online can be managed by authenticated users" ON public.tugas_online FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.pengumpulan_tugas (
    id SERIAL PRIMARY KEY,
    waktu TIMESTAMPTZ DEFAULT NOW(),
    pin TEXT REFERENCES public.tugas_online(pin) ON UPDATE CASCADE ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE SET NULL,
    kelas TEXT,
    nama_siswa TEXT,
    no_absen TEXT,
    jawaban_teks TEXT,
    link_file TEXT,
    nilai NUMERIC
);

ALTER TABLE public.pengumpulan_tugas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Siswa can insert pengumpulan_tugas" ON public.pengumpulan_tugas;
CREATE POLICY "Siswa can insert pengumpulan_tugas" ON public.pengumpulan_tugas FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Pengumpulan_tugas can be viewed by authenticated users" ON public.pengumpulan_tugas;
CREATE POLICY "Pengumpulan_tugas can be viewed by authenticated users" ON public.pengumpulan_tugas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pengumpulan_tugas can be deleted by authenticated users" ON public.pengumpulan_tugas;
CREATE POLICY "Pengumpulan_tugas can be deleted by authenticated users" ON public.pengumpulan_tugas FOR DELETE TO authenticated USING (true);

-- 17. TABEL CATATAN (Catatan Pribadi Guru & Memo)
CREATE TABLE IF NOT EXISTS public.catatan (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    judul TEXT,
    isi TEXT,
    warna TEXT DEFAULT 'cream',
    pinned BOOLEAN DEFAULT FALSE,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catatan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User can view their own catatan" ON public.catatan;
CREATE POLICY "User can view their own catatan" ON public.catatan FOR SELECT TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "User can insert their own catatan" ON public.catatan;
CREATE POLICY "User can insert their own catatan" ON public.catatan FOR INSERT TO authenticated
WITH CHECK ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "User can update their own catatan" ON public.catatan;
CREATE POLICY "User can update their own catatan" ON public.catatan FOR UPDATE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "User can delete their own catatan" ON public.catatan;
CREATE POLICY "User can delete their own catatan" ON public.catatan FOR DELETE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- Trigger Auto-update timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS catatan_updated_at ON public.catatan;
CREATE TRIGGER catatan_updated_at
BEFORE UPDATE ON public.catatan
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 18. TABEL NOTIFIKASI
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    tipe TEXT NOT NULL,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifikasi" ON public.notifikasi;
CREATE POLICY "Users can view their own notifikasi" ON public.notifikasi FOR SELECT TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "Users can update their own notifikasi" ON public.notifikasi;
CREATE POLICY "Users can update their own notifikasi" ON public.notifikasi FOR UPDATE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "Users can delete their own notifikasi" ON public.notifikasi;
CREATE POLICY "Users can delete their own notifikasi" ON public.notifikasi FOR DELETE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
DROP POLICY IF EXISTS "Authenticated can insert notifikasi" ON public.notifikasi;
CREATE POLICY "Authenticated can insert notifikasi" ON public.notifikasi FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifikasi_user ON public.notifikasi(user_id, is_read);

-- ===========================================================================
-- FASE 5: GAMIFICATION & INTERACTIVE QUIZ
-- ===========================================================================

-- 19. TABEL GAME_PACKAGES
CREATE TABLE IF NOT EXISTS public.game_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT DEFAULT 'Umum',
    grade TEXT DEFAULT 'Semua Tingkat',
    materi TEXT,
    icon TEXT DEFAULT '📚',
    game_title TEXT DEFAULT 'ARENA OF CHAMPION',
    tagline TEXT DEFAULT 'Think Fast. Solve Smart. Become the Champion!',
    sub_title TEXT,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Game packages can be viewed by authenticated users" ON public.game_packages;
CREATE POLICY "Game packages can be viewed by authenticated users" ON public.game_packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage game packages" ON public.game_packages;
CREATE POLICY "Authenticated can manage game packages" ON public.game_packages FOR ALL TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_game_packages_updated_at ON public.game_packages;
CREATE TRIGGER trg_game_packages_updated_at
BEFORE UPDATE ON public.game_packages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 20. TABEL GAME_QUESTIONS
CREATE TABLE IF NOT EXISTS public.game_questions (
    id TEXT PRIMARY KEY,
    package_id TEXT REFERENCES public.game_packages(id) ON DELETE CASCADE,
    question_number INTEGER DEFAULT 1,
    topic TEXT DEFAULT 'Materi Pokok',
    grade TEXT DEFAULT 'Semua Tingkat',
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Game questions can be viewed by authenticated users" ON public.game_questions;
CREATE POLICY "Game questions can be viewed by authenticated users" ON public.game_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage game questions" ON public.game_questions;
CREATE POLICY "Authenticated can manage game questions" ON public.game_questions FOR ALL TO authenticated USING (true);

-- 21. TABEL GAME_SESSIONS
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id TEXT PRIMARY KEY,
    package_id TEXT REFERENCES public.game_packages(id) ON DELETE SET NULL,
    package_name TEXT NOT NULL,
    subject TEXT DEFAULT 'Umum',
    grade TEXT DEFAULT 'Semua Tingkat',
    materi TEXT,
    class_name TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    game_title TEXT DEFAULT 'ARENA OF CHAMPION',
    sub_title TEXT,
    tagline TEXT,
    total_questions INTEGER DEFAULT 100,
    team_count INTEGER DEFAULT 6,
    teams JSONB NOT NULL,
    tile_states JSONB NOT NULL,
    arena_seconds INTEGER,
    game_status TEXT DEFAULT 'idle',
    total_students INTEGER,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Game sessions can be viewed by authenticated users" ON public.game_sessions;
CREATE POLICY "Game sessions can be viewed by authenticated users" ON public.game_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage game sessions" ON public.game_sessions;
CREATE POLICY "Authenticated can manage game sessions" ON public.game_sessions FOR ALL TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER trg_game_sessions_updated_at
BEFORE UPDATE ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- FASE 6: STORAGE BUCKETS (Foto & Berkas)
-- ===========================================================================

-- 1. Buat bucket storage jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('catatan-foto', 'catatan-foto', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies
DROP POLICY IF EXISTS "User can upload catatan foto" ON storage.objects;
CREATE POLICY "User can upload catatan foto"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catatan-foto');

DROP POLICY IF EXISTS "Catatan foto can be viewed by anyone" ON storage.objects;
CREATE POLICY "Catatan foto can be viewed by anyone"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'catatan-foto');

DROP POLICY IF EXISTS "User can delete their own catatan foto" ON storage.objects;
CREATE POLICY "User can delete their own catatan foto"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catatan-foto' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===========================================================================
-- SELESAI: SCHEMA LENGKAP SIAP DIGUNAKAN
-- ===========================================================================


-- ===========================================================================
-- DATA RESTORE
-- ===========================================================================

-- ===========================================================================
-- DATABASE DATA DUMP: GURU-APP (SUPABASE POSTGRESQL)
-- Sumber Supabase URL: https://mfxhtrnzrovdjpvktrun.supabase.co
-- Tanggal Ekspor: 2026-10-17T14:35:27.957Z
-- Total Baris: 1871
-- ===========================================================================

-- PANDUAN RESTORE:
-- 1. Jalankan terlebih dahulu supabase_schema.sql untuk membuat seluruh tabel.
-- 2. Script ini menggunakan 'session_replication_role = replica' untuk menonaktifkan
--    sementara foreign key check & triggers agar impor data berjalan lancar.
-- 3. Akun auth Supabase yang terhubung pada tabel users:
--    - bendahara@guruapp.com (Auth UID: 3f020e98-e747-4c3b-a38e-44e0e3142d54)
--    - kepsek@guruapp.com (Auth UID: 434c4fed-02a0-4745-b9ac-5204cec2edfb)
--    - gesit@guruapp.com (Auth UID: 63c31206-b156-4957-9ec6-025f47a2ee62)
--    - admin@guruapp.com (Auth UID: 78ff3035-fa5d-4b0d-8637-845db2b70fb4)

BEGIN;

-- 1. Daftarkan akun auth bawaan ke auth.users agar foreign key auth_id terpenuhi
-- Password default sementara: guruapp123
DO $$
DECLARE
  default_pass TEXT := crypt('guruapp123', gen_salt('bf'));
  user_rec RECORD;
BEGIN
  FOR user_rec IN 
    SELECT * FROM (VALUES
      ('78ff3035-fa5d-4b0d-8637-845db2b70fb4'::uuid, 'admin@guruapp.com', 'admin'),
      ('3f020e98-e747-4c3b-a38e-44e0e3142d54'::uuid, 'bendahara@guruapp.com', 'bendahara'),
      ('434c4fed-02a0-4745-b9ac-5204cec2edfb'::uuid, 'kepsek@guruapp.com', 'kepsek'),
      ('63c31206-b156-4957-9ec6-025f47a2ee62'::uuid, 'gesit@guruapp.com', 'gesit')
    ) AS t(uid, email, username)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_rec.uid) THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        user_rec.uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        user_rec.email, default_pass, NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('username', user_rec.username),
        NOW(), NOW()
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = user_rec.uid) THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        user_rec.uid, user_rec.uid,
        jsonb_build_object('sub', user_rec.uid::text, 'email', user_rec.email),
        'email', user_rec.email, NOW(), NOW(), NOW()
      );
    END IF;
  END LOOP;
END $$;

-- Nonaktifkan trigger & FK sementara selama proses import
SET session_replication_role = 'replica';

-- =====================================================
-- DATA: public.users (4 baris)
-- =====================================================
INSERT INTO public.users ("id_user", "auth_id", "username", "nama_lengkap", "role", "created_at", "nip")
VALUES
  ('UID-0661ADMIN', '78ff3035-fa5d-4b0d-8637-845db2b70fb4', 'admin', 'Administrator Utama', 'Admin', '2026-05-26T15:59:15.270054+00:00', NULL),
  ('UID-1792087726378VEYM', '3f020e98-e747-4c3b-a38e-44e0e3142d54', 'bendahara', 'bendahara', 'Bendahara', '2026-10-15T18:08:46.40847+00:00', NULL),
  ('UID-1791987663789WMWR', '434c4fed-02a0-4745-b9ac-5204cec2edfb', 'kepsek', 'Mujib Kodar, S.Pd,I', 'Kepala Sekolah', '2026-10-14T14:21:07.46704+00:00', NULL),
  ('UID-1779817062842YOUA', '63c31206-b156-4957-9ec6-025f47a2ee62', 'gesit', 'Gesit Widi Atmoko, S.Kom', 'Guru', '2026-05-26T17:37:43.369013+00:00', NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.app_settings (4 baris)
-- =====================================================
INSERT INTO public.app_settings ("key", "value", "updated_at")
VALUES
  ('geofence', '{"lat":-0.615449,"lng":102.268365,"radius":500,"enabled":true,"nama_lokasi":"Area Sekolah","berlaku_untuk":["jurnal"]}'::jsonb, '2026-10-15T12:56:10.971+00:00'),
  ('bisaroh_submissions', '[{"id":"sub_2026-09-26_2026-10-25_1792137869214","status":"MENUNGGU_PERSETUJUAN","total_jp":4,"rekap_data":[{"guru":{"role":"Kepala Sekolah","id_user":"UID-1791987663789WMWR","username":"kepsek","nama_lengkap":"Kepsek"},"jabatan":{"id":"jab_kepsek","nama":"Kepala Sekolah","kategori":"pimpinan","keterangan":"Pimpinan institusi sekolah","tipe_penggajian":"pimpinan","tunjangan_jabatan":1500000,"gaji_pokok_bulanan":3500000},"tarifJP":50000,"totalJP":0,"isHybrid":false,"isTendik":false,"tingkatan":{"id":"senior","nama":"Guru Senior","keterangan":"Masa kerja > 5 tahun","tarif_per_jp":50000},"isPimpinan":true,"totalHadir":0,"totalKotor":5300000,"bonusManual":0,"isWaliKelas":false,"totalBersih":5300000,"catatanManual":"","honorMengajar":0,"totalPotongan":0,"tunjanganWali":0,"potonganManual":0,"tunjanganHadir":0,"gajiPokokJabatan":3500000,"tunjanganJabatan":1500000,"totalPotonganTetap":0,"totalTunjanganPokok":0,"rincianPotonganTetap":[],"rincianTunjanganPokok":[],"totalTunjanganTambahan":300000,"rincianTunjanganTambahan":[{"id":"tunj_transport_bulan","nama":"Uang Transport Bulanan","tipe":"per_bulan","subtotal":200000,"nominalPerUnit":200000},{"id":"tunj_fungsional","nama":"Tunjangan Fungsional Yayasan","tipe":"per_bulan","subtotal":100000,"nominalPerUnit":100000}]},{"guru":{"role":"Guru","id_user":"UID-1779817062842YOUA","username":"gesit","nama_lengkap":"Gesit Widi Atmoko"},"jabatan":null,"tarifJP":40000,"totalJP":4,"isHybrid":false,"isTendik":false,"tingkatan":{"id":"madya","nama":"Guru Madya","keterangan":"Masa kerja 2 - 5 tahun","tarif_per_jp":40000},"isPimpinan":false,"totalHadir":1,"totalKotor":460000,"bonusManual":0,"isWaliKelas":false,"totalBersih":460000,"catatanManual":"","honorMengajar":160000,"totalPotongan":0,"tunjanganWali":0,"potonganManual":0,"tunjanganHadir":0,"gajiPokokJabatan":0,"tunjanganJabatan":0,"totalPotonganTetap":0,"totalTunjanganPokok":0,"rincianPotonganTetap":[],"rincianTunjanganPokok":[],"totalTunjanganTambahan":300000,"rincianTunjanganTambahan":[{"id":"tunj_transport_bulan","nama":"Uang Transport Bulanan","tipe":"per_bulan","subtotal":200000,"nominalPerUnit":200000},{"id":"tunj_fungsional","nama":"Tunjangan Fungsional Yayasan","tipe":"per_bulan","subtotal":100000,"nominalPerUnit":100000}]}],"total_gapok":3500000,"total_bersih":5760000,"diajukan_oleh":"bendahara","diajukan_pada":"2026-10-16T08:04:29.214Z","periode_mulai":"2026-09-26","total_pegawai":2,"catatan_kepsek":"","disetujui_oleh":null,"disetujui_pada":null,"total_honor_jp":160000,"total_potongan":0,"periode_selesai":"2026-10-25","total_tunjangan":2100000,"catatan_bendahara":""}]'::jsonb, '2026-10-16T08:04:30.02+00:00'),
  ('bisaroh_settings', '{"daftar_jabatan":[{"id":"jab_kepsek","nama":"Kepala Sekolah","kategori":"pimpinan","keterangan":"Pimpinan institusi sekolah","tipe_penggajian":"pimpinan","tunjangan_jabatan":1500000,"gaji_pokok_bulanan":3500000},{"id":"jab_waka_kurikulum","nama":"Wakil Kepala Sekolah Bidang Kurikulum","kategori":"pendidik_struktural","keterangan":"Tugas tambahan struktural manajemen kurikulum & pembelajaran","tipe_penggajian":"hybrid","tunjangan_jabatan":750000,"gaji_pokok_bulanan":0},{"id":"jab_waka_kesiswaan","nama":"Wakil Kepala Sekolah Bidang Kesiswaan","kategori":"pendidik_struktural","keterangan":"Tugas tambahan struktural pembinaan kesiswaan & kedisiplinan","tipe_penggajian":"hybrid","tunjangan_jabatan":750000,"gaji_pokok_bulanan":0},{"id":"jab_kepala_lab","nama":"Kepala Laboratorium Komputer / IPA","kategori":"pendidik_struktural","keterangan":"Pengelolaan sarana laboratorium sekolah","tipe_penggajian":"hybrid","tunjangan_jabatan":350000,"gaji_pokok_bulanan":0},{"id":"jab_ka_tu","nama":"Kepala Tata Usaha","kategori":"tendik","keterangan":"Koordinator administrasi sekolah & kepegawaian","tipe_penggajian":"gaji_pokok_bulanan","tunjangan_jabatan":300000,"gaji_pokok_bulanan":0},{"id":"jab_staff_tu","nama":"Staf Tata Usaha / Administrasi","kategori":"tendik","keterangan":"Tenaga kependidikan operasional administrasi sekolah","tipe_penggajian":"gaji_pokok_bulanan","tunjangan_jabatan":0,"gaji_pokok_bulanan":2000000},{"id":"jab_satpam","nama":"Petugas Keamanan / Security","kategori":"tendik","keterangan":"Keamanan lingkungan & presensi gerbang","tipe_penggajian":"gaji_pokok_bulanan","tunjangan_jabatan":0,"gaji_pokok_bulanan":1800000}],"potongan_tetap":[],"tingkatan_guru":[{"id":"senior","nama":"Guru Senior","keterangan":"Masa kerja > 5 tahun","tarif_per_jp":50000},{"id":"madya","nama":"Guru Madya","keterangan":"Masa kerja 2 - 5 tahun","tarif_per_jp":40000},{"id":"junior","nama":"Guru Junior / Pemula","keterangan":"Masa kerja < 2 tahun (Standar)","tarif_per_jp":35000}],"cut_off_tanggal":25,"tunjangan_pokok":[{"id":"tunj_wali_kelas","nama":"Tunjangan Tugas Tambahan Wali Kelas","tipe":"per_bulan","aktif":true,"nominal":100000,"guru_ids":[],"kategori":"wali_kelas","penerima":"wali_kelas","keterangan":"Tunjangan struktural otomatis bagi guru yang menjadi wali kelas rombel aktif"},{"id":"tunj_kehadiran","nama":"Tunjangan Kehadiran / Uang Makan Harian","tipe":"per_hari","aktif":false,"nominal":15000,"guru_ids":[],"kategori":"kehadiran","penerima":"semua","keterangan":"Dikalikan dengan jumlah hari masuk riil guru berdasarkan pengisian jurnal"}],"user_jabatan_map":{"UID-1791987663789WMWR":"jab_kepsek"},"guru_tingkatan_map":{"UID-1779817062842YOUA":"madya"},"tunjangan_tambahan":[{"id":"tunj_transport_bulan","nama":"Uang Transport Bulanan","tipe":"per_bulan","nominal":100000,"guru_ids":[],"penerima":"semua","keterangan":"Tunjangan transportasi bulanan tetap seluruh guru"}],"default_tingkatan_id":"senior","tunjangan_wali_kelas":100000,"tunjangan_kehadiran_per_hari":0}'::jsonb, '2026-10-16T08:49:02.872+00:00'),
  ('profil_sekolah', '{"npsn":"69953165","email":"tebuireng4_alishlah@yahoo.com","motto":"Mencerdaskan Generasi Berakhlak Mulia & Berprestasi Global","alamat":"Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355","status":"Swasta","jenjang":"SMP","telepon":"082131028161","website":"www.tebuireng4.com","logo_kiri":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQcAAAFACAYAAACx9rlzAAAQAElEQVR4AeydBaAdxfX/PzO7e+153ouHBEIIHtzdinuBQqEUrSAFWmipAXWhQBUplBYo7u7u7hJICHF5L8/ftd2d/3dukv5oi5QCIfzLsHN3duTMmWNz5swDLEtQMu+By15f36t+2KhRO4xeeumfLT127M/aRrTt8sVDvzjqPYZ81vQZBT4RCpx99tnRWhsMXXXp8UNOtploig0b243JdA4fPPzcvfbaq+kTQeq/mHSJMg7uXRZw+eWXB9ede93ZHXPbL2if33HirFkzT2yf1XHN38+9+NURSy39p4MO+spKe+11UsY591725V2gf1b9GQU+HAW83N1zz8nhoEGDGnfYec89jzn2+/c+9UjX43Omxj9wlfyYMM21hkGheVb7nC/fdf+dv1b/JUrv3m31SzySnpCnnXbmnmnCTmlcbk36+omLZTImsqHN182aNufwCy+9+O7rb/rVY+NXG3fUVbdeNVxjPjMS78bxf9R/RqJ/kOJDFC655Jal11xtkwO23/4XD3f3dr1+y21XXVosDmwQ2cZcUuq1zflexi/XSxj2E+XToLOva69DvnLgZh9iysU2dIk3DkcccUThmaefPqEQZesKWfj1aSvwi18MY5ONQtoayuRMGrhiOrRadqtOenXyqZ/fdc9Hh7QNO3fs2LF7nnrqyW2fGYp3k6V389Perf9n9Z4CTz75ZHT4MccMHzV21Bebmwf/ed/9dr3/mecfObdSTtY2aTjExSbMRQNm6RF97L9vyCWXD+baG8dx2FfrCLxjO9DYdNnfr/v1ySef3Ozh/af5k+i3xBuHyROnrh5XKitWy33BqivX8cU9Hcd+HW66cRkuuWwohx2eZYVxJeozpSCsEoWV/OiOrvYDJ0+efPHxx5/8xKgxw76zzgZrbLbbl3dr1vEk80kQ+bM5P90UOP/883N77LHH8NXWXHP3rbfd9vQ/n3HG0zPenP6X7p55hwS2slRgkyjKVE3rYNhld8tPfj6Y++9ejfP+PI4t15vPMkNf4dvHDGaFsZE2s6opFntXve+++3b5RDYu85/z4h2NwwcY/5/P9F/0fPPNN3OTpry4Z864Qs46Ntu4lUF1DlueQ5aX2HSjWfzq11XuvW805565DPvu0kJzVMQkSRCgkwcsPWPqnJ898+RL11/3t+smfvXIr//+CwcdtN7FF1/c9l+g8z87ZEmRh8XJACmuveSSS0bssMPu2xxxxHHXXXPNNS+99sKzF/Z1dByRNQzLODLZFDOoEXbfvZk/nDmGx55ZgYsvaua4o/sZ1PAEDEwlchE2ThgxLOZrBw7DpQNEQZB55plnDr/iiitaFueaanN9AIfR1gb8y88HGP8vIz/az1//+oRRU96cvn8mSMjnYP8DG0iZgsmkqIDsBZFJxIgudtutyplnN/HYsyvyuzNGsuP2BUY0Q14rzKa2MXT5wT0dXYdefuH59xx0+IH3FwqFq5dffvmD9t9//3E333yzWMxn6V0o8N7y8P+H6fDG4OyLT23bddcdVl169LAf1tXV3XrIlw6+7/abr7vJFXu3KgS0hImrqwtg9DDYZ58hnH3OaO67ZwJ/PquNA/YqMbR+EmGpU0ZhgCiTQDAgilYkq45qTyd77LIiaywXYIjp7e1d45RTTtlSHZbYR6qzxOLGNdfdv49L45YkqbLr7qMYNaaTJCyTWoMLRWJvI+KqFtCLNfPI1nUwfOg0Dj+4h4svqOf661fkVz8ZwTZbhIweWcakiQ1S2YtqumK5VNzltdcmniMv4rF99933shEjRvxwk0022XGvvfYaecMNNxQE9LPnP6LAe5uO/wjEJ9DJG4PzzjuvYYcddhiz5ppr7j985NDfH/e1H95y/fW3P/bW1I4fxAPVrUnK4zI21ZEhDpYZG7Dnro386Q8rcu0Na3KWNqLP79PFcsu+SmN2MlFF8idR9OdWgwyAK+CcJZGbEUtWq7ZKy7DZfPmrzZRjhzEmM2XKlC/5Iwvvm8z79vg4OiyxxuGOO+5o6uru+VwYmMAjuftubUS2F2NDqklENc1gwgwEBqerDBtWSMs9ZGStw7hMXdDBGqtPVCCog8uuzXLdzaO4+MI12WaTOprqwUQusFkXOpsO6u7p2W7WrHk/fOCBh6+58qqrnz7ooEPOWmmllb68zz67r/K5z32uTsGjUMJk+Cx9aikg/tmTTjops+OO+7V88YtfXEf8/cq3vvWtS26+5ZaXnn76mb/NntX19f5ut3bosvmCMWEhG5vBOnzu8/k8V165OtfduArnXNrKbvu9ybIrvkxs3pSs9RFq45LeY5HCp/1gU1w11AaWJQ0T4jDG5ByERarmdXbawzC4NYA0Dkulgc2uuuqqCe9PVI1//04feQ/7kUP8CAA6hzn5VydvVOwrrxcnjpVWgbU36iHn+mvMyFIlk8YEcYXQpQR+FUWrciTeGDBVGQxD2pclrObErDLjxs9ns61f5qqb8jz9ZCvX3bkRRx0/lKFLqbt4ZazTr41caga3t8/b/5XXXj778iuuvffOO+98/De/+d2Zo0evtPdeex28/I03PrD4z4l8lv5bCuhs3/ztbx+x8gorjDnyt7897epbb73smUsuuezOVydO/H1nd+cO2lzqCI2NclVyUuCVluvnFz9ajntuWpkXnhjEOWcFbLXFqyw1fJI8T6dYVwvWjKIYLk0500o8kMXFdVQzEXIHFO8ymKCiPt26nUjIVg1B0ZCXUOfSIkObUn74nWXkvkLeuII2wZ8efvjhEUtg8mq1xKF1yl/Pzz5+/5PfDkIbZUW2I49dmYZ8LCV3C3A1eptUZQN6SJ33BJB1kFGwxOkYZnUsxWU31PPb8/LcdG/EjPZWCnWt8hRhSNMAO6z0Er/+SomX7xvFw7cP54wfL8seOwSMaItNPnQmZ8mEuNbApisWi/MPnDHzlb9ddc1f793z81teXyjUnzNkyNJfGz165Y323//w4U/e8GSB/6+S+VSuRt5B+Ie//aF1pZVWWmPUmGUObWppO2uDDbe89bTTLr3r9dcHftHTVdzBumRMxsSNhTQJmgxm2SEpX967md//fHkeum88tz+0LPt8YwZjN5ExGNZHHAWkSStxTx1X/yXiwD262HGzyey/01uc/as6ioynagdwJqYSOlyNcv7X59pH7cfUfsHaMp//wiCWXSaSrBo5HtU1O/s6V17YvES97BKFzUJkXrn11pXiamFV0tQuPTbL1jskWLFB+/rCHv4l4utM5+KAJAEnY+FsIleuiZsfhq12eZMjj53LSd+bx0F7d7PtBm/x+9+kvDaxkVJpEK5YJSpUaA5ns96q8zjiKzO49JI2nntuJS75+3AOPnA4G6zdxPBmY/KOKO9MNoqjYWkpu3FpwBwyb+6830yb9sqtl1127kPr77n+31ta2o5fbrlV9hg3bsU1N99887Zf//rXdZe7ywOP6acvi7ZLONIyBPaGG24obLXLLkNXW2u1LZbVMbBp0JDfHn3oCfdMfnP2dTOnzfpdX3ffYXG1uB5JaWjBhfmGoNEMa7KsN6Fe/G7h+msbePHJMZx3Rp6DvzSXFVd5k9ZwKm0p5Loz2N4Mr74R8utzQ9bZqYMjj3md6+9y3P9EhofuifnFKVM47fczcYUmbBBQCULJn31PyqVugLrGyTUDYbWz2dS23H7LDd85++yTl7gNxr7nSj6BxnvuOT931103fitMTZMMMXvv00R90wwcnTgFcv4ZJYtxGYJcIG9BLbkcXX31HH3szBpTB9wYKnYpynEDs2bAqb+eycZbTWbvw2fz8BvLUIxWodoyhLJCF0lYJXRdtDXMZJfPdfOrH/dy151DeWPy2txx5wgOPjhiubHQ1thP3vTaDOV8xhXqTbWwjKnY3Xo623/5+uQXL5ky45U7733g3leP//bxjx7QcMBpW35u001/fvrJYy+/53JFOiQN1DKfpQ9IAef/ggh73XXXjfjKV76y2tChrcftvPPOj99z8/Uvv/DCczdOevXl8yrl7q/btLRqmPYsFbqSHMCSrQ/LjBhc5fP7tHPTbXVMfHMN7rh7ECefVGSTDWUEcgM6isa6ZaiSLwVYM5SezuW47dZl+dzmPWy6bgenHP8Wrz5fpUsea280hFI4mqIt0G8Mv/9bO889bRRSUAAStJ85/b77Yw1kw0723NsyflmIdKbp6Sztdvk1N6/27qM+mRb7yUz77rN+//u/X72jvX+3bNBnVxiXZY+9ckS2KKLHIMtMTUYWjndihI0olwyJLHexXM+11xSZP119Mw2UxTyz7DLELcPpzzXTUbUUK4abb6+w5S4vMmG95/nhT5DArEY5GQKR4FR6ZXAMuWwOW5mJKT/POqt3ccZvGnj88TYefnQEDz2yCr87PcdOO1QZP67KoKYKuRATpmRsKWgJ0vwg6xpXqvTlvn73nQ/feuLxpzy8z/b7PKoz0h25XO7cbKHwtTXX23itk0765ah77rmn+cknn4wWruiz10IKvPrqqw0XXXXVqJ333Hfl5tbBR2VzucujTOaBPffe++5zzj33nrnz5v9cZnZFEweDstV8IZ8GNipVGNZgGL9MliO+luGyKwfz4ONL8cyzwzjn9xEbrDWLrHmKMJpNJgupdcq9pIVu2uM2rrl7CF88tIcJGz/NXoc8wyMvwUBs8GIWpOrfWMCutTpjDzsGo2DVQL1jfjec+euKjrzLkEksoWDyHkn2BVdJWG5ciW23a8VRIRdF4bNPvHXYtGnT8u8xdLE32cU+43tMeI+7J5w0aeaemYBsmlbY9nNNrLB8FeIEK0yNNeAW6pGKKKVVR5izpCakUh3CHbeWaCinhHEfmTXXZuxxv6bpmLPI7fRdwhGbyWzLCKRZKv0FJk+MOe2ns9hlyyc54kBdf56X480Zo+inQNUMYIISQcZJOCoKNHWSMbN1JdrBiuPf4JAvOy69bBh33juWa28cye//NJJvHdvGdttEEk7M8ObY1ofF0KTk5WsOpRysHFeSLcrV6v6VcvH0Z558+N5TTvn2o1tsueVdm26y1SVtbcN+s9RSY743buxKX9xg7U3X+NKXvjryL3/5y+BHH7258eabb5Yoa7H/nz06GgQPPnhdg/8z991332H8GhMmfH7UqNEntbYO/+3qE9a7/IA9v/jgjVdd+0jP/N5fV+J0l7ha2dAk5eVDk7SEhrCp3tgxozNsvXHK8Uc38JdzxnHLzeN49JHlOfWXreywXRfLj5tKc/1U7c9lbCICmhxxNaIaNjOrZzh3PDiMb37Xsc1OUzjg4GlcflUvM+dayi4izWVI21pJl1uH/HZH0vbV39N68I9JV92d0Xt9C1kZXBry0EMxbz6ZEgk2seZ4r0f7WUhIXCmxxz4jtLEgj9gEXfPn7/md73xnifIe7HutY3G3XX/cFUu3z+s6EO0Cg1oMn9+njWqxHcV6CAJhk8Y4MQ230DLgsKEMg4IOcWqY+laWe+72O39AagcxQjVccwAAEABJREFUeMt9mNKyLPNHi7k7fJVxx53NiM+fQm753XUUWZo0GEkc1DG7y+gWo5vDvzGPTTd7i0MOn8+V17by5lvDKcajqUSDdDwJSXR16uJYx4+KXNF+SGbS2jSZtVabzwH7lTn5pDxXXbMCjz22KjfdPIZTT23giEPb2GrjgKVHGAY1WlufSTM5XDZI0vqczY/U1dma1VLPngPd846aO2PGd9+c/OqfH3/qofsvvODsVw4++ODnN9x4x3sPPfygX62wwgpfWX/99ffeeuutd9x11103POSQQ8Zsv/32jSeffHLB35VffvnlmXvuuSfU9yfGU3Honx6Pi/eKPH4qFw4//PC2Aw88cC3hvfMmm2zyhfErjTp5q213veFbx5/81HXX3vzExFdeOXvOjOnf7Z8/56ig2rddzlTGZEkbpM7Z+ijJDGnKMmGFiN13zvO97w/nkktH8Mgj47n2rmGc9FPDLntMY6VVp2CC5+RUzJLnJ3kZiEjLBSl6AyU7hPnzx/LYE6P5+c9Tdth+EtvtNJXf/rHC6y9YbDlHQgNxMAQ7cg2CzQ4iOuiPNH3zcsyev6Bj2Z3pyS3P7GQwdvnPYQavqvU2M2N+ltPPm0UyUMCYRbKppnd61G5doJu2Kiut3MXuew0iChyBDbPXX3/98TKY7wPgnYB+PHX24wH730E9//yLjiBIGwMCNt+8iZWldBnvhynW4EqCaZE5yKgQKPsypElFdQHZzCCuvmYmfTpitNthhKPWoNw6mHKpA+pjurMpk3KNFDfclbZvnsbIb59K6/b7Y5ddm0pdM/35PANhwNyekKuvtBx26CzW22wm++47nYsvbGPKtGEEuTEQKXSg6Y1y4KoEroxJYoJqj4zGDFz5OeqyT7LS8q9x6ME9nHFazE3XDef5l1fhucdX5JK/DeXkH47kS18cwcYbJYwaofESjmI1icppXCBI8wKoSWgIwswwlwZrzJzRftTEiRPPfPzxxy+66667rpYQ3SGFe/K222576cc/+tGLhxxyyFP77bffnYceeugpt9566wF77bXXZscdd9wav/jFL1b+85//vOI111yz9NNPPz3Yu+oSPstHn8yLL75Y/+CDD4649NJLx5922mmrHnXUUesL3y8Ir59/7Wtfu+dHwvPcc8994YILLrhXeF/24EMPXfTGG3O/Vx6INjUmGm1N2FitVgcFLs0kLtXdYsKECSm77wTfOa6Bq/6+LM8/uQH33b0qF543mO99q0dGdzat9c9jBkT3pJMgKBMnoqdLkA3H2Cai7BicW4n7H1yKH/6oxCbbTORzu7zGL37ZziuvNGKCBpwJKOfy9DUNpn7dzzHk0JMY/I3fkd/zeNyEzZlfaKVbca00n+j4qU0h72QgDA2bHABWB4NwgIvu6mDyjHochfemrj+jJCk2CQiieRx4eCOZuhhDNdvf37/V3/72t5XeG8Dia7WLb6r3nunqq68e0lss72wSly2ICV/72lLkwg6CJMSYDNJ+xR3ApI5ULEiNyhICY6qkJmVGh+GGG9RfzKlElsIaE6ChBVEeyn24pIukUKGzxTI9GzB76TUo73IoTUf+iqav/J7CBodhRm1Kkl1KO0cTZerolaG47fYSxxz5MjtsO4NdtpkmZY946LFlmNsuD9COxWgXsCYG+ZOBjFiUgtVnZG3tbeL5ZMIp5HiOIUNfZYed+jjmW2X+8Ce48OJm7rp/LI89uiHXXbUGvz9tKEcf2cLuu7ew2SYhy4+tMrgpQQpjpNQmTVOdqRSBta7gjGuTYI4SLZbRlCvGsdt48qTJ33n80cfOu+rKK+88/bTTHjnxxBOf0G792Be+8IV7N9lkkzvXXXed2xobm25qaGi4tqmp6UrlS0aOHPnH5Vdc/sfrbrDu8dtsu81Xd9ltl/333Hvf3fbee78d9t13/+2+8IX9d9x559321c8hW2699VHrb7jhtyesuebJY8aM+V1TS9MlgnF1Y2Pj9RtuuOHt22673Z3773/wfccd953H//jHM++/5ZabL3h94uvHVUql9QLcMkGaDoucq7dpmpfGBsSJacgmZvmlE7bcOM/+XxjKKd8fzHWXrcIj92/IFVeszrkXGb7/syKbbjOdpkGPkM9NJDBzsElJbjwEaYCpBtg0xBIR2gYIx/LG1DFcen0bXztuFmts8ir77PUyvztjPpPeiKmKjHGYJfZHxqZW8qtvQ8MB36b++78nf/j3qKyyKaXGwQik7HQPpPOU23H0EwYDJKaTtDVH3WobEg738pLQV0w5++JEctMK6qn1gebxWbzCGaOqLBjAhpKbkMBVGD++xFabFYhwBGTyRxxxxK9OOumkDEtAsksADlx++eXB8d8+6ctJOT8qkKKvvXrE6msMSACqIrDDybKnVDDGiKgVEptSrWGu7zQhcYb7nox57ln11U5OoYlBK21Id6kBl9SBEVNICOVl2AEgzlNJs/RFTXQ2L03valtiDjyGpqN+wODDjie35e5Eo8ZTydVRDeoomQJTZ4fc+WCRE380j8/vOYl9vjCdo4/p5vLrsrw0eTl6epaFQJ5F0EyaGM0mXKIqaWBJ4gCjaY1NiCv9BHE7WTufIY0DjGmezYRlnmPnrSZy5OF9nPaLKpf+PeWaK+q44eoh3HHzCtx5/QTO+eOynPzDQRxyUD3bbNnMOms0yjvJM2YpQ2uzM/l8aqxBjwu0mYUiT9Y6lzfONVQr5THFgeKEYn9pg0pf/3al3v5dB3r69hzo7d979syZX5v4ysTvPfHIU7+48/Z7/nj9tTf99erLL73y8ssvvv6SSy668dJLL7ruxhuvu/DmG24459677jzj8Ucf+flLzzzzw6lvTT2yp7P3C709fbv39Q7s1NszsEFxoLxiEsfDjDE5Y1xkLUEmcqZOvtDgIY5xKwSstX4De+zUwEnfXJZrLpjA7TeuyC3XjeHay5o49y8h3zq+wnbbT1Nc5xVGDp5GRjQr9lQIZXzDQHwU4w1Z0TNLGluqrk5KPpz5XW0889xI/np2wN67dbLzbtM56OA3OOe8Ii++WaGnKA7kClSjZpLGcWSW3566XU9g+DFn0XT4b4jX/xL9bevSHg6jJ99MT1SgaOsFvwFHnRQ7Q1AqyEPUvDZDSR5AR2MDdatviyk1E1UMl18/m0kz1W4iaklGCx2D00Aip+zI1KqdCzCZMkbH4XzQzg++O55B9ZastZlitbjRi6+9tnKt4yf8Yz/h+WvTn33J2c3T35p3UGDTbJRJ+eqRQ4lsiaqUDKkZKhuHDENILRn9+ozQTyNyto1r/l5Gfj2pMWTHr4QbPAwZYpwXqARsapRR8oASjFF/VxXjDYlgFF0d5caxsOpWDN37aEYedyqDv3oyme0OJh22BnH9OCqZoaRBjs4BwzPPdvCXizrY56CY9becyOc+P49vntTDPQ9Bt1mJgXgEpeJQwnQkYbmNoNxMWIpwGmuDAFMuYZM+gkw/NugHpxwPQFnf5V6a6noZs/RcVlx5Ihtt/hKHHjCDk44t8eczctx2dTMP3zacB28dy703Lc/d16/MbdeuxrVXbcqf/rgqJxzfxv77ZNh845CVxoW0NYXU1xsKuYRsLiWXTcmECRkT2yyYLMZIbG3BWFsITSAsleX1QpAxBPlQVAywocFGxpmMNaZgjKlTCL9OcOozMQ2FmLr6hCFtCZuuH3PQ/s387JTV+PuFW3PzzRtxx13Lc9+DQ5Qtf73K8L1fzGD7PV5g3Y0nMnqZt8jkZuKq8+Qddsv4d4vWnVRMB3YA4Z0hKFZFw16s1uCKRRI3iIHKCtx9T8iXvtXHhrv0sNnnpnDE8QPcdYdhzpt1ZKoZ8kCUyVHJL028zPq0HnoCDd/8IfUn/AB22Zv20SvQkW3DX02mWJyxpBjcomyMIPgMiUlJZayMS0EaH6cZmtfbGNM6HO+JzHq9yH239qp/ozKCoc3NlheWNcaqzTgI+9RoVR/oXWX8KlU22kRGKC4SmVzjo48+9JWTTz7Zd1CfT+75xBHwS++e1rc5qV2GtMSENUK2330IVoQMtbs7MQMrgopZyPHyZf/ps3fX5Ofx+sQMTz/YLaY6yiQ0brQZ3blGkjAvg2IxsZHXEKgcUhtjEqSdghijQeAyOBrkIQxiPm1MzSzFjNZV6V95Jxr3/Q5tJ/yJEUf8jMG7HkU6dlOqmeH05FopZnJAhaJ4/uQTXZx91nx226uTlVd6mc/t1M4R3w244pouZszVfNkRxGYwZZOHtKApI3klhsQLpMtK8lQfFyCWYFUHCWcZlHiQdqo8Yaz23gYoKhRRFC1KXaLENJoKExk9YhKrrvwGG6z9Gltu/iz77jON73/fceY5TVx5dTMPPNrC62+2MfG1Bp5+ZhD337uc7vCX45qrlueii1biwos24qyz1ucXP1uV409Ymq8eOljB1XoO+GKd4iI+13Pwl1o54qsj+O4J4/nRSatxxhnrcN7563DxxWtw7bXLcevNw3n8scG88VobuoHkxpvy/O6PKUcfM4Vdd3mM9dd+lmVHTaElNwfb102u2gP9RcraOfvjmLKo77IOY2MCC6F0KlMJyFHAxSEU9S6MYn51BLfem+c7ZzSz2W5djF3jZXbbr5Mrz+vh9RdL9GtcORvTU1ehT7zpa1yRYL3DGLfv6Qw54Rzajvg11XX2pLTUenTll6I/GETVNFK19SQ2Ei/f63FCLMbZCoFLMYoZpNTR3zKStg02EW9DYQvXXNpJT3+9VmRkdRMwMTijLPhGMGRUqCWLl2GD6swbHHJUgZxEwJVD0z571h5PP/3YarVun+CP/UjnFg0+KLyTTz69+Y2X3vwGSTFTyFXZe28pgHsF0qpy1pMOT1uMBy50bUVK7rApuCBRznHlRe3MmxvhIkui40Cy9Cr0ZBtIItWVBghMgJUr55wVeh5OirNiiy/6Gg+rop8wR1JoIA0yOnaElILBdPTn6KsbzcAy6xBsuTcjj/4ZQ085m8IXj6dl/S8Qta6JC0aQho0MuCy9ccDsjpTHn6zwt7/OYf9vdLPK9u2svNWrfOmEAc65ZAx3P1DH/I5WKf4QgkorLm0mtgUS7cIEPZigg9TNxbn52LCMFkyc1Zm3oJ01O58k20Ua9WtMhSSoav5YYyrkoz7qgy7yrp1MMo/GzHyaMvOoM7Npy3cxZkgnKy4/lbXXnMmWW8xi511mseNOL/KFfV/ha1+fygkntPOjn1Q443dZTj9D+bc+Z/jFr1NO+XGJ47/TzlHfmM6BB77Gnnu+zI47TGKLTeewwbr9LDeqnyG5PpptlXq53LlyN9m4W95Sr3K/8Clr54cgCTGlkLASUZfkqNPunksibDkkrWTwx8DYDcKFQ3lrXparnx/Kd86sY/t921ltvVnstZeCvKf28fgDFebPTqjGKYnmdBmLyzcSLLsGzVvvQ6OOiG0/Og170BFMXW9L5i+1Kj11yxDHbeQGGsl0WDLFSHTLIm0HEvBsJ/4AABAASURBVOX3eYwjtSmGWB6hUec83WETrLUxLteMMZbnXihx773gogacdcj2gwyCQWWMxgTKekwMJpFcWh01S2ywkWULXYMHgp2UaX3hhVe/rDiTF1jeNQmcnndt/rAN7z35B4Xu1/8Bx1x96WWbDBR71gzoMsuODfnCF0ZSLPYRBIY09Uv3GSUBl9CJPSRVizUNlFNLR3erdsGUJMlAGDFy410oNWmX9g5zXEXUF3NiUjEuNYHgGGU9RkJhJBximGdIZCoS3F5MtQfv4jvj9zMpnoSuFDh6ojzzMk3MqhtJ+7AJlDfaG7vviYw98RxGnfAHCrsdQW6lrXBtK+CyQ3CuHpPmdBWboWue4eXnEi65oJMTT3iZPfaczaoT5rDF1vP43g8Hcc0tY3n8+ZFMnzua/sooYttAKvyrMjZpaIgDj0dA1YQkNgSTISWQ8FlA2RitwmFiCbhBdEPybjQ/Wo8hkMEKkkBlCG1Zgt2v9h59d5J1XTrB623mk7fzKQTdFHSMqw9K1OldMEXt4APkGSDn+pX7yKYVGbUYWy1rziJUeoXFALo2wNMO9UUReZOAEEONtZcxqcq+0oFqrP8cMFANGRjIMGN6E/fcN5af/WIQG23cyeoTBjhsl7f4wynTue/GCnOmq18pQ6L1J+J1WqgnHToas9Z21H3xFJb59lUsddglZD/3U9IV9qareTxddVn6C46qDH5JMpAomzTVOmIZryKZchcm6QGqyu/zOCO6Q2K1BhOD5C/ONlMcPk5BzY206jx9ZfjTmZ0kjCQNDE590FqN+htn0SA9WTSpssPIW8xJtnCzOezwkeQD4aRdbvbM2bv95Cc/WZ73Sg70vFePD9Xmsf1QAD7MYFlGM23GtL0CU6nLRY6DDlqKpvoumhogLlYJAr/0YOEUKhsxRQIV5eq0w2QxulZ89LmUN6bFuDBPUJArvs52lI0AICWSFcZUSE1CLKGIvWI5CWONSTIm6uOMw4lx1pSJxN6s65XQ9Mqm9JJmfO7Xu0QaVvCClbgcLmnGxa2055p4bUQLM8avSbrtV6k77I8s//2rWf7bF9Cy7/Ewfn1sdmlMPFKyN1ycHEFV4/riFmb3Rdwv3H/559fY5/BH2Ga351l9rYmsuuoMdtymj9/+up6Xnt+M2bO2p7NrYyr9LZi4nlRxi7RkCNKQKLCEJsUmVayCA6mWZvJWZajo5iSWMUXGjUieUprIgCakVa0XJRtgIx1j0gxIQKk2alATRnCtHeD/cpFAtLGmhNXbUIaohClIOTJVnFMWOFVCGuk7I9ooZ3Oiu//WHFEzqR0k+g2jIqUZSEcwo7ONZ6duwGkXt7LzXkVWWWWAtdeayz57vsgfT3+DF18oyrBWxIt6oZ8T/1KqdZqrTZMtvyx2z2No+tYNjPrRE+S+cinpZkcyddQaTGlsZHZdRF82qzGSg1ixp3KLBmlsUKFUKNPdKK+joUxvvkSi689cIoUUDdXpPR4RN8mCCYmDhMRWAac4iSWtG0ph/a1I9K5EEU8/28Ob04eTxBHOOjASWhkIUj9e32ke/DdKolm5JxXdDBtskGPsuFAtRUrl4qgLLrjgK15H1OsTeewnMuvCSbfddrd1BwZ6tslFqW4cDTvvmhex50HZEoQiqKyoI0QlsUGDTIzJSZgHBiDup79vGD/52WSKEujUVMlO2JyuhpHEiiGQOIyrUDMOnpkhpNbitMuSOny7OKL2VPUplSCmKkamvl3sUQMEKGt2k0Atx1gSQl2hhoIRlKRMfaOkDMMoKwbR1dbM5EH1TFl6aSpb7Ubdt09n0M//TOv3Tqf16z8g3G5vwmVWxTS0QbYOY40UHAmQYaBq6JabPbUjx4NPhpz00w423vx2Vln1Ojba9D522KGXvfcwHHtUHX8+s4UH7l6eN15enbmzV2b+/KUY6BlEKQjkTQWUjHZXKYjLhcRahPew/M4Z1uexWbE8FB1En7Ti6eMQMUC0xcaA/5bQG5UWZi2aWjYL6nSlSppWicWZamjQyYB+0a5PNC7nDSUFP8thI13xUGb0jOKFiUtxy13D+PmpKfvuW2KrbdvZeIvZrLP5vXzzlJnc9HSOt4p55lNHZ1igPQgp5qDYGNK+VBs9a26I2e0Yhh1xIUO+dauODJeQ2/4o+pdblZlaY9GWKFkFKaMYV9D69Ja7BNbzztTWZIQvRgotWSBUfaR+olciZceFkhV9q+d7PWGcxciYOo1Pw5LAC56OSWXy1C23OtGIcSRRhs5++MMvn5dxGEU1ASOZMYngmwX0dfLGMKKz0EDlXM6SE+2DYDZ/OGdl6mRPA2vsvHnztj7//PNH8QklYfzJzHzyySfbRx99+GvOxYM9AQ8+tJWhw4pEVkTT2dNYUdWJmGkEPtfQFDUrQjlRm6JWL7yQKBAGsYTDZELaVt+GPgmXSUPxP5VZiTGmDIGYqGHIOBjBCZ0jimPtvom+pAgBuFCKFGSomJyyuJMWdA7OKmcw1RBkDFTAaaepRtrVdMvg4wMhfQRGxiopEpfKyNOmHDbSl2mlzzbTMWgs7ePXomfdz9G419cZ9p3fMvI7f2TwV35O0x7HEW+wH8HSW5EpTMCaUSS2iaIrUEK42ICe2DBpespDz5e4+aEu/nzlPI46ZTZb7v08K234JKtv9CLb7j6NPfdv59ijC5zy3UGcfcZQrrywjdtvGMYzTy0nd3015rSvzNx5S9PbPYLiwBBKlRZS6nFhBjKieTbWW8ZChtrZLBjVG9Fe2QURTgG7Re9U+PX3N9HbO1h5LHPmrMyUKavy8ENjuOSSFk77dRPfOLLCAfvPZrttJ7Lxpi+w2+df4ZSfzuX62zp4QkesqTOk/QMZwnKA6RMfgjyuZQh25KrYtfehYfeTyH/lLHIn/pnmY06nfvfj6Br3ObpaV6MvqzWkAUlaIkl6sa6C1THGxhZbslCNxCpHmJQV6+gm1HFICyJIAqKBkGx/hmxflkypoLo68buBqvjOeyTjDJk4g01DBFi5LLhVzQuxYiY9USO5DTeDbCAxi7jwgnbenOjI5D1QC5InIaUPh5MHo19EfLAVjLiNrj2DoMTY5eexymo5jIGenu4Vzj777H2UIw1c7I+wXuxz1ibsj/uX6S+VtiJIg6GDLcd+bUUyyRxPadI0EeFEHe2sloQwtVgxxw90xQoUDAM0cvG1PWQkvASQGbcc5WU2lkzXYYjVNUU2ALQr4LRM/+FkXJyaFu6Oplanbw/b9/GAbIgzyi4Q40NlKxStDL1VR6M2sdU6Uh150nCANJon8N242pwSHLmMppLFlIW/hDVNVEed7svrmJ/WMSMaxozBE5i/6o6UdziW3IE/Z6mj/sj475/PsGN/Td3eR1DYck/cmluTjF2XtGl5yI8mybVQkaTFmTrNnSVxkXYlI6WH556He+40XHh+wO9OH+DE783gsK/NYo8vTGN9XYMuu+rTrDThGTbc9BW233U6+xw8m2O/1c/Pf5LlzL+M5iwFSS++Zimuv2MEd9w/gocfHM6jD43UeyT3PzCcu+4cwY03juSSS0fyl7+O4vQ/DOWEHxr2P2QeW2w/idXXeZFVVn+GbXd8g8MPn83JP5rD38/v4sHbEya9ZugbsCQyNnFQRxw1kmQKuIYmktaVSZbZnLr196Zp96MZ8vVfMfL751F/8C/p2/pY3RbtS7VhbbrT4XRKMcthSjUskto+nKmKtxbjcuJzrkYPJ4PhxEPr9CtjbpWDNJU8qKv/TQ2hjG1UtWT0DhNT42liLGpS+T0eIw7bBKd/tAi0CLzIWCp4Re4jR2HtrXW0HU4qY1rCcO0dA1SrjbIJTjLkZdqJDoFanPB+21yRIalWJeOOQfU9HP/NNqyao8AFjz322En3P/HEUH0u9sfjsNgnPfvJs6PLLv/7YQlmRFVWf7Mtswxqm0ro+gnEABuJ8daB3HdjSiJajPHckxKbwDMUXpvdzCXXtJNKOIwJCNbZnHn5YThZ4NTGSC+JTbYmOJ6R4gqkKc6ktbaq4MQyPiB4HnZCrR1vmIjF+IQ48NkRWyQS/idE1kCCEUEcCb2ChLKZlAJIwDACElQ1Vlnw01D9PJslpPi5wgDZHBK1JVGGoo3oM1nezNXzknbNWcuvR2nbg6gccBJ1Xz+Dod/8M6O+/ReGH3Mmjft9j+adjqZpvb2JVtgaRq8FQ1bA1Y0Qfs1UwnpKcnUHzAAlYVuV15GEWlsg1PQqC7Xps+GJ5wNuugvOu6DMab9p56jjXtFNxSQO/PKbfGG/t9hlr7fYdo8pfG6PN9l2zynssOdUdt7nLfY8YAoHHD6Nw78xjW//YDp/PqePW2+xig0YOntEG7noyDOLfVa5KC+s1+YpBw0ycKOwS69JfrWtqdf6Bh9yCmO/9UeGfu8vNH/zbMzBP6Wy9SG0L7sBU8NWuqVciY3FmX6qaVmsS0E0c8qp1uaM5hPPHaKnMaJnqna1BDH+qrHGfxnviscjzFG18oIELdGwYsbJ80jolac0kKkQB2XkbohIMe+VJI1UohKpESGrWfE/T1V4xJHmpEqstfY0jKJ1nZ1JY0MpjTjzgnnM7RyJ378oF0HxCIzDChecoSYv+tY5mIxEJUrKcnL72HyTHJtsMoRI4hZgs68+8+LOfALJfgJzctOPrh4z7Y1ZXyUZsI31jqOPW0bkEvFSEcxzwWcVkSIvIKAYUiunIOWNkzzXXTyf6hwnpsSYYSvRvPyWGNurdg0W0xbLujyOwvzDziU5JtDSvGOTGEM1CBjI5OguKLcOYmDpMcQb7k680+G4g75H/uhf0fCN39B0zG9pO+Esmr/1BxoO+wmFnQ8kv9Xnya67HdGKGyq+sQ6MWA1axxPnRlO1Q2QfpSiS1tRayhJMF0oCJQW1HTaGqsjXL3L3VcG/B7S4ksfJhqRStNoVXVCn2jwOvW0LLhwGDcsRDFmL+rFb0rrartRtfyR1X/4Jw4/7EyOPP4vBR55G42E/pbDHMVTW3IPZo9alP99EJQyoiI4VLT7xNFBZKAi++wgoKzAf2yNE/wV2VfIbrbEVYfMYsjL6M6Y4Lr+8HVw95ALFg/LoDAJ+s/iXsW//DDLdfOmgZqolyARB9Oprzxzxy9+dNOrtfRZHWWKxOKb5vzkuv/zy4JVXJu4uz6/RSCA+t81gVlgpISl2gA3+r+M7lQy4XE7CNJbbr+4h74VJipRdd2eKdeOkYAM4Cfz7Ef+dQH9SdVoSVuvwxgHnsRBLTEAiWhSDLL06SvRmGxmgkT43iB7TRl8wlHLTOEpDVqV/xJok47bArbMn7HkK5qDfER75F6JjLyR79N+oO/pCGo66gJYjL5Dbfi4jD/4tzfv8lLqdj8NtfRh2nX2IVt0eM3Yj4uEbYNrWJWpbiUheSdS2gsorkh26CtkRyuPWJrfqRhQ22pXsjofpRuYEhn3lZww/+nSGHfNH2r51Ng3H/pnwq7/H7nF07e9CelfbkjmjVqW9ZWnXcL35AAAQAElEQVTmyMuZG7bSnRlEf2EwpWyBShQQiwh+6T57CizI//y1oG7J/k2MpXPE8uRX2UwepSGUUb3qyk4qCpzH8hSSJIeVkX2/VVjTxRbbJKyzhgywblFK/eUVLjj3ys+/37iPul2S+FGDfG94U6ZMGTz1rZlfj6wzVsbha18bpiDZG7K22pl8oJF/QckI3tvkpF9n+bvvHWDqxFQ2QI31w8msvzO92UHYJMBKy8QTDfq0PAZRglQGwb/1wYIcQBLi0hyYPEZXhkE8QFgdwLoKJtU2j2iAk9sNVY3vV79+MvTJxe3Lt9DXPIyBISMpjRlHcfwqdK66ITM23JvurQ9nYK9vEh90Cvao35P7xh8YeeJZtJ58FdHJd5P74b3K95E/5QFyJ99P4ccPkj9Zdd+6juiIiwgO+ilmL8HY7gvM3WA7Zq22CbPHrc6cocsyq3E4cxqG0SPF7xVu/WmVRO80dOJslcBUMMmAEO7VJlqhKv8gCSPSIMQY8dMpsyi9jfGLqpbgtxP+A4UCbZvvRhI1EOqf556LefQlrUnelikPYKzcMt47GVNlUFMnXz9qBTIamg+jYOaU+Xs+/fTTg9975H/ZqjneaaR9p8qPs+7cv/1pX8VeRpkEtt4sYM1Vi+QDK8+his34md+GqYpePBSPlBoEOJMhjpbil7+cQbEq+QoKhMuuR1/jSFJdTaW6R06cvAeJo4f0ach+fVW5+NXAs2LBgj1tgtiQkbHLVUIyA1p7EJPkqjoeJMSZmHImoZJxlLOGgayjFMRkKl1kK91kql1k4vmEaSeGLu3MXZSDLrDd1FcGyJdi8sUyrpKS6P6xqZww/64bKE2ZIgUOGdDVWjEb0KvzTn8Y0CUF7yam28b0SnB7cfTbiJKxorQDKsq9YLoxbi6mOgPSEmnq1NNgjJrimFC7YFgt4v+IKhtr/iAAeUhqBYz6WmrJmdorrf1+in681yoadQ4dSzRuJWIZ8IrOacf8bCrFZAj5qCJjKJosWN67Lkz7Jpmkny236mepsYa0mqWvN1n7xO+duP3JJ5+8kEjvOvyDN3gWvsOoj36id5hkUdWtt946aMa0OV8IwiQMrOEbxw6jEMwlk41w8iIW9Ps/THX0APWLi0h0QkV087z6RhOvvFChhKVU10TdNnvg8s3aeRISKZnxDOJTloxng89IuVICBWJDRdkjbTI+h6nBpHlICsp6p3UoEimaFZTratl/V009FdNA1SqbRqpBI3HYRJoRfZQrimMM5PoVuKxQVDAuyWgCGZj+2c/S9cifKT5zIUk8TYa4hzjoxyjYlorS/o/EarcDtkwteEdGeAxSbsbE9YTVPJlKJKNjKKhLXSmVF5fTYupxpp7U1JHYOqomT5UsVSMjr4yTcXBa98JstU7rWJCMXj7r9al5hLuJY3obm2jYYz+S2t+yhJLXMq9NakD2lSDUotTvPdekWxdbdrQ0zea731mabLZMYKvhvXff810aaRYEFkcSZxbHNJJl58y55/5xw/7e0prGxAwfblh7zX5s0kuYyWB1t556F+Ht6IiIrmoIFWeolgOsHcR5575CecCRBFnsMsuTW34lxSgl5JUiSVjS6Izy4iKfpvooHr9uryAelvE7izd0CZUwoRSllKOESEeMqBqyIAd6B4SxJYhNLdvaNpvi/F4u4+KUtXWjwy9o9yJ2KhvJZwZkXAKdf9GNS1abfvzk3RSKUynd/Rda+ych0oJLNTzBmAAwIGOMM3r7nNVbQTbToKoGwWzQFE1UaaaiXKVF9d44hODHL8zOBqRBSOKzyjjBTsVXGYUwMTKKBqM5DD4JX6Psi5+S7NHNSE4TebG51TbGKNZSqeYUcwj51Wkva93DcWXLgvW916IcVkYkSgfYcedGxi0XkiadIY7hT9735HapE5Hea/hH1Gb5D1DlI0jHHXdc7obrb/t5NtsWJrp+/MGPJ9CQM9h8QNzeK2I0gc5okkoWoeSJaAL9SglC7TxvTi1y9VW9OMlMGmbIrL0JXV7+4kSClUJWbYkqFikan45kha9NLbbG85TEOuIwpSqjUM0mVDKpclHfujePFuV+9eknifpqOQ37cWEVQhEncCKhI0gcGRmFrIxDTjt6FIsenjzGqpASUKbQN5vSk3fxq8NXY/2VK8x78FIJooxCJCMihcXzxMkYpPp2yrV3Ecwc5XnK88H24IIB4VOiKhzKwt0xIGPUp9wPbmFGb19fewuGGOmN2qK1WydQylICwQUtgk9TMkI4k9bLkFeZWbLUKXBrg3ry1QI3317ihbfEE2NEj/dbVQKVssgQUNfQyT5fqsOKb5VK2nDHHXeecsUV57W8H4SPot0uwvSjAPZeMGZ1zlqvkibj0kofK+gctf3n5pCNJNDFAlHBkhY78UKCVxBPv1pWvXYVF5WoFAJuuCFLuROqJiJtXZb8WltSljEwAdT7P2yRa0tGQucl7r2Q+cjavCR/FMBiAYlxtX+0GKkti3ZqrX8BjzSXeXvWEKMsgfS/+LennboIjH/wn6nG+OwNTuIJFRZAe72P/TbKIPU+eikrDZ3Dl76e57ijhhO+dj8NMybrJqiELC4mVXcPOzKg3SyjOEJOg61XbHkXhlStEmbBZFE2FdX5eqe3skNvZf+uZaNvo4pUOGrVmiQRz2JZB48rwhn1E2g+TcmJZzGh0K7iogJ2tR1wo8aD6aUku3jx9SXJro4XLo937NRVhlh0IAeiSG3dfu2oPZJnFqfSibnstbtlxRUzhFHelItmzM9/9cfdWQzJLoY5uOeee+rvvu3uY4yJslZu797b1zGkpQsnIRI9wTqs1a4nwcO7miACG/2kGCPhiUIGKjkuvmKm6GmIbQN1a26mqzCdewvNeKIaKVEQ5yCUomkMiyUJx49gHv+vAfvslRlPEBeC/zNdudwiBCKZvmU0anWL2t7+jtTuv63eQsgp6xFJRCsZUw2typtIVYeMaZRzZHT2b+rrJbnvbxz6pTx19jU+v18bYwqi8Sv3ky13Y+XRIANQQ0AwVCHsUrwRTwXBZ0eEE1dYZND8HMpO377+3bMHCM6kNU8pEeqLsqeDEYxP3+N0vPJGPtHCUm1go2laa3P6A61VXtxVl3Uwc55kVspvVOUqDhNE1HhtRAA9aOGpaCcI8hYMNi4xeniVvfZoI477CbK5aMqkKQc9/PCtHhAfZ/LofJzwa7AvvvjiCXNnz93eWGeGD3Hs9+VRlIramTwlwj71EUX0eCXHGwdJh5FgGmMwiYhczHLnNRXefL1K0Ytnrp7mddelYkXYaiD9sTqbW6o2RL4tOIH87Pl3Clgr6kmAS53UVUoMPH4TQxpnsNN2MqoyGOX5M/nCXm30P3kduYEuTNgg2gbgDbe8BW9YYvFEJP932B9xzaeThY5aEFcGj7Sfqrzk1rU+B5nxsrFZuiYlXH6xA1NHah1GZHd61+yvZJ5FyZQwgVwNNaQ6DiY6Nu++7yBGjna4Shc93X3r/OhHZ2y1qPvH9f7YjcOLL76Yueuuu/Y22IxNYnbaqY0xYzvJKGhDmsMZByjrkSUAWdDU70RGttPXBRGZ3AQu/esAAyVkEOqxK61FccgIUrlucik03FIKLXFgJcehbIzhU5P8GhcXsjoKpP1FAgUECzIQnQ+ezze+lGPMyC4ZgR4iXZV+aacGRpnJMOkpTL8kM5MRdlWMXFwTG2LxRyEg1X2YZ3Eu+sPg+cHHOsmtHozksRrE9AxalswWBwtQG0EVrrpqFtVgKIliNzV7W0kwkTY5v1EuIouN8bd3Lo2xea+iMaPHzOTLBzdT0LV1SBQ9/PBT35g5c2ZBgD+2x8/8sQH3gO+4445RU6dO3TvSrhUFCXvvO0TVc0WKRZQwOBOrTgrt3z77L33WrKrNMvGZXp7z/35/oMp8C4M235FiQ6ui6QHZjM52Eu3a+ViCGyaBjAOfnqQlLTZkvSHOBDp55el+9T6aSq/xpT2bSV03ccaQardbekTMPjsXmHvDeQx2PRLogRqvojQhTFOwBidevifO7j1b1WiU/z98tKxU1DKmASNDQJDSkc1Tv9H2UO9vdeCVN0pcf+2bpMEgEmPwHgSpOnua+byQLIHXTNE6LWUFsSLj3M3BBwxhcEsgmc+ZYn95wu9+97sNnXOalY8leRQ+FsCLgJ5++umHpmk6BHkNn9uiwKord0p5K8h0gtFb5+ja8vw5G6HjXViTyGAgIYQ0znPe+bPp6m8g0bHBjlpOV5grUtSNhyiLMUZ9U8HyGSXB4GOjl+B/mp8UaxyFgSIDT1/NzjvlGdZWxAtxNayAbkVIZ7Pnbi3UVacQTr6HXCrjoOCFddrFKIuyBpyn8XvQQV3eo/X/2yanlaWiUBpnsUkOkU3eraG/tYlwxWXpD1WuBJx5Vg8D/W2kCkRGGR0VdAGMSTX6/x4jYEbGwVi/mQZkdMQY3jqfXXcahIt7pT7l+l/+8pcXnXPOOY18TOl9uPzhZp03b16D8h6CEgRZwxFfH0JDXbtcfyk0AZiEf6SahfBfniop+iXV1dnM2UO49Op59KYVUltHdrMdMQ3DIcmDCSnpUJbaKmhncyJg1Ro8U/gs/TsFPFGLvfDGfRTaH+JnPxyFCXq0gwWSTUMi2rnsAKuvnLDrNhHTr/0lg4rz5TGEor0MdiBD4jyQ8N9hf1azgAJeq10keurGoSbjZaKWOtq235FqY150NDz5ZJXnnjVYO7gm54YqIO/Z6OUfv1HKVniVSIx0RCR3OtJZ08Pxxy9LU4tX27JRarn++us/ttiDn8Wj8895EZL/XPuBv7785S/vW61WxzoJ1ErLh6y5uoiQlDCCb6oLpna2Av4v/3wlahBF1F1nLjB2KHffWqGj2xGbMrZ1OepXXJP+OCQqG/UWDBkGoxz481nicIEoyZKYPnm8QlnNkTqa9d//R3bbso62+vm4sESgW5FspaA3VG1CnM7gB98aR0PPZOLXnydIImIrabVFjF+G+n8wCvtBH2zE+/f+OGC+/6z/1OPfPoRTUMHqnjJNC5JhfyRwDHR3kS6zDuGyG2DkVSSK6F50UTvFcoFYx+Aa4c0CYE7yz0LPLDUpLjNHcm7UJdIRD4aPmstuX2hY1CXz6KOPfvPhhx/+WG4upF38e9Ia/73yg9V85zvfabnjjltPBhPkdM7da+/BFOo7MEZTejkzDYAoYpTThZ6RJ4q3moQibJ6u+RGXXakAjj966BK0Zbl1SFtGUK5CVtbZOiFq9EFKJM8hcAKsc54HyxKXtM6PHSdXU17j/ET68QW9rBc4VQWiV3naJNy85zli/0GYageeVja1hNUcYZJBpCcOE5ZqmcXmG9Yx95HbySQGdSGRETaCYRbC4z9OH8faPw6Y//GC3r2jjsr+X5xKPSHl+RrdNGQydbTTRn793SBtkrS2cNvtc3n11SKJ5Njz4B8Aa7S11OrEO7nZGiMjUzU6ElYpFadwwIFtNCv2EIYBPT3da/zgRighyQAAEABJREFUuz9QUIOPPAmLjxxmDeDzLz+zXpImgzJJxo4cEnDUEUPI2QpWO7x+IBiovSSHWNsDNpZBkAuV8Sg5ymkdjz8VctcTvVS126H7ebfxrnS7epIoSylyIrKol0YiXoaqycg91lhdfQpQDYf/qR8jw6jdPSuvKisymkBXYaJrwWbI9gVk0gqNwVx6L/wxu2xVYfUNHc46GQgZaaNy1IkISVRsJKoYqG/ntN+MJTv5Gppeuo/GagtpOJzQlomMYKv34n3c4p3uv51NBjaREXUZ0UhkxISkcSyaVikstybpqptIbhNmzk+54IZ2bXIFkGFOjZX8IptgiIMUnCHQkqMYjCmS6qrDhFZHvJSVx87m8AM0rFpFqpB/7Y2pX3ryyScjPuIkbfqIIQqcjhHB448/fZBkT/t9kd12aSYTztKCtVoMRg1IyNRVdfrV4hHJTCQhrVYw8iDq8iO5+Mp2RBsIMtQvvxmMWJZE57hUWFcFw0moERGdC0g8E4zhf9IwsChJqFQ0zojKKgSWUtURRvVkRLdk2ouUpj/FYQeuwkBxDmFDHSRZ0UyPF0iTyFikBBLUKAfDh/Wx9cb1dDx4Lq5HN0w691YEM3YVAV/cj1ncE/5X85nakctpbFU5JRUnYhKs/3dJ6lsxa6xL7T+yI2/6jhuKzJlXj0tizwBMmtEYv84EDwHxsZYVsDT+XzMoxgSCl6eHL+4/nIzsSmnA0dE+Z8O//vXMHTX4I32kZh8pvBqwzx944Mpd87u2Qrt9Qz3sskcTaVqqtb3nj3EkuoMnrmPSizH3Pdgt78JgKpaGjfalEkYiTfKeIP5nG2vSlNZ2ndQbSe1gXvHTTI6SiWmpFum962pWWbHKhBUDGvMaUCyCaK4fasmkkIlF46rOxjG2MofDD26j2P4w2d7nCXVsM0SkNqx1X6J+lhBkjOhpZBKk7QswMgGpNq7YZijZHM0rrY6rb8FVI6a86rQB9uFydVh5fLbaoL4GK2NieFsSP9OK+CLPwQSWVKwbtyzsuFuGgmBWy331V159w5Hnn3++TPrbxn3I4sdiHJ59+IF9kko8KGsambBWxFrrGiL/34V8H2R1tKXi/yjEDubmGzqZNi2R7OYwTcsSj1uHAe8tIAFeCOefCLiw7n/3JYmRUMXiaGytjGokUsgyZ3OEOmckk58lfPlefvmT1Wlr7oSBMvgjmElgISEl1yp7r8CRloyMQR/bbplj3dX66LrjD+T7urD+X8Ky8jb4LP0rBYxYYJyTzC5qETNkHHCBjsY5+uIA1zqSxq22I6CeMGninAt66Sg2L7Alips5NH7R8Le9A8m+z3E5kSMdUIln8MffrUchP0A+ssyf173OxImzPievfSE33zb4vywK+/9y5LsM09Vlw7yuuTtks4FJXRdHHDVcPSdRLQ7o/d5PSXqfrw8Z6DSce8l8wshI3AsM2Ww3euvqCOojnFWnhWDcwvf/+sssJIDRzo7ok0rbjQsxPh7T10sh7KX38atYcUiJjdbug9JMTE6jJMgQ40y6AIIRRb3BiCI0WsbBUY1f4VtHrqhbiyeonz8FfDxCAeIFAz77/XcKGFFftSIlb9vIkOeQKPdHdWQ22Jy0roWqDO30uRXuuz+CICs+9GIUX7MLIAjI/z1OR4xEdjyqE2eco7EgzpWfYIcdBskLSZVd4yWXnffVZ599tomPKNmPCM4/wJz84++sO9BdGl+VG9RQb1h9tQzZIEYe0T/6vFvBijCmFPDCG4ZJs8ok3pWoFxHX2gQyZar6B2Pebfj/bH1NDvF0CZGE+YfUfyYVBawkOFMfofjKHXz/62No8P9ilZXXoFiEj3g5BbpSIwPhgXh/1QQyACJlmkXbG7mwykYT+hk7eICu+y6hJe3TTEYdPnv+nQKeLlIpZ/F2Fk9TF0MUkGqbIwyJbUQybBzZFdcgzhQp9hh+e+pU5s9vgIKjVJIFSN8BsgAGYo3uPpFi4CqOoU0Jxx7fwJA2xBPHlCmTtjnjT2dsykeU7EcEpwZGLo297bYH90gSlxc92GbHiJYWCaI81f9koozcroHiYP503nSK3jCEObLjViIYP56yK4EXXJ3I+Cy9IwWc3FfSBZRObCLdL9E8MI/qY5ey5pgBttk+wBhF0f1o7UQYS+KNg7wNX0XqjUukYoD3QCTjEuaEoQ19/Pb7E4ifvRY74ymiZEB93uP5H23yJMUTDaN/kIGQojufYxltZZkI36ffNtGyxXbQUK8+dTzxWJWnX8lQNhFpmtbG8j7JClBQqrLiCjE77zYSa6qEEeFD9z2255tvvpl7n+H/UfMCSfqPur5/p733Pjlsb49XwkVGRpJvfGtpXR7MJbASuvT9xweVLG9Nb+OiayTAnshBM00bbkNXtSSQDZiKBNcrwPuD+h/sYbTmkFB0M74YJIRS/EHdMyg9+iB77zOYfNtbeKXHR8VdHc5kZEtSal6GhA0faffGxUiQbQXZ6lp2cSdbbxQxtqlI33NX05yRwGu2z55/p4CrqbbByPW3yoZUZdHLH/lkKNRCYuopr7AW2bHrY8mRM3DOhfPoj8eS01Ha74O4f4f9TzUy5H5ssX8G+x3UhPEqFhvF6abscMnVl4z+p77/5cdHahwmT346LPYVh1sTUF9vGLdCG1bBq7SSAQXJajj6RXtBNCr47Ilp1CJCKozLbbd2UtP/SkBm+PIky62BNSJuUAdJHmqSzGfp3yhgJISWILF6p6hAkJZof+xOlm7qZq8dmvH/XUgvo+hiE513nSILqad/DZYFo+yl0qQ46xAoCTLYICZrpnDMsaMpPnUflc5Z+J6onxiC/+OqwPP0H7Ac/7PJaOXG/+gtWloZhFomEXUSnIKOqYxzb9REbq2dMS6DNyI339zDK69mKCsQbBTzQb3R+AWZhcnT1Wd96lXqiskXLEuN7WKjTWTsk0AB/UrLw/c/vL56fOinxuMPDWUhgJ12WjPO5osdJkxcZw/sufNTvPCyjgTRcIW9Arx5S2XxqnGBVBFWHZuk6xHlslaasXQkI7j4hmnUxxarSG64yob0Dh5GOWsJ4nYWyF/AZ+kdKCDiWHKkuj72AiV9pr6ri+77/86RB7Ywauhsgqq2FycDG8gzC7uxujKOypZMSXVxhthU5FToDCilN4KXlQORryKjkoFBPeywS8jy9bOxt95Ec1wG240xveQ1pK5YwKR5CKwMRyyBT98Byf//q1Ijoyr6eQcstUbyHSiHOAVwfLYS9SiRV+YKRKuuhRs3ll7aqPZlufisieQbcjgjtfQGxoBnZxI4qt410LkB1eEp7OEMCQW7nnxmLJttsQaB/w8dudR0+P/N1kdAamHxEUBZCMIYEy+77OgL5QR0h2GDu/++Ivvt+xR/u6hEhREkEjhHM9Y0Soid3ganuoysX1oMee75hJeelUSmkOrut3GlCYqW15OWBxFKeBeclyWJfJb+lQJGFTaOcQpqOVemXjtV8fk7aUims9uuQ3B0SnhEWCP6SoAxiUbE0mUjPqRUK3nmd+dJ/VlCNx2yEhh1D5STakKqY0pd/Ry+tNdwep68ivqBdiJ5hVYeSDXQ7KYqg6C3xqb+heN/OfnVL8hGlFiQkWb7Ok97o5hanG+hZZPtSAveICTcdFuRufOXUn/PIxHeexVxFiuCBjIQSTUvz0A8kgE2YZZqdTRvTR7Dn8+awzlnPQmCj1y+Ia1DZvMRpI/UOJx88snp008+e97qa21wTLHk5kZRo5szO+XEE2Zw4Jdn0d63HAMSzkriSEsFwkAr0G7lRAeTGcWVF8/FaqfqF3myE5bHjRlLpDhEdmAQJm4hoBdMmc/Su1DAJMSZAYwUNeqZR/9jV/ClA0cwvE1uXFDBqR6fU7HdCYZoL7kj1rurezAnHtdHqTIYfJs/wvmsvmGU0t+dUJeP2XHnLE2ZifQ8fQuZgZCkMBSdAEmiXsJUzJNrK2sjGeWz9A4UcMYgx1hyXqWYhmRX3QrX0kiSMUybB7/41VtiUR34a2gfP0qdjLTFFWXIAxngfEbB+Ra6B1bmB9+ezVabv8jPfvwas3S7Vyg0uiiqn7jZlp+7/R2m/sBVkpIPPOY9BxhJ5reP+/pF++xz6FaVpHBflGvrKZYst99RYbudX+GJ5+oI67OEGa/kDksg7yBgoG8IjzzaLjcp0u5XoDJhXTrqBmFlOXJe5sjXZNa7Ze+JwP9oo3EGgz82DGBzIX1P3sWwvlc59ksKVtk5oqshThYSJ20AnXuxJeT5YrMRkydZrrgW5s2tR4DA/9T+tNoSJAliGVT6GbdcJ4cf1Ezfg5eQ6+qDvgCXV1PUR+iqhDXjAHzkkiWY/188RrQPah5bHDlKg5ahsNHOpNkczma49OIyc6a3kjrxyBtyBYZxCUFk5L2VKSVtXHZlxKabPsFZ5/UwvzNlQPqVuKAUhvW3fuWoIz5/7LFfnflRkMp+FED+Fcbee++dXHLJ6S9dffWVu+QbW36U2sLU3mIufe7FgEMPmsFlV3RppwklrEZHjXoSm+PVib28OTWhbCTgdSPJrv45qrkGknAAgl5ZWytHuU5CrvZ/nfCz7xoFjGhnKlXyA11UnrmLXTZrZMzwHkymKmGTkkvAahbWxwbksmqLUr0jJcejj/dI8OC5F3pxOvO6sIiLwKVGP2DkBkeyJNmgnX13rSOc/TLmlQepE1dIyyRBLHOSEKQoOeXPnneigBGVojRLHFpS20dP1dC84f7YEStirTbJLrjzYYjFFRcExKJnmrFUNWZ+xzKcePwsjjt6BpPejORB1FMm35tvHHLzCiutdtTvf3/2F3//m5+/rA36I2HAx2IcFhFl11037p09Y+Jvll1huS8EYfiMS6N45nTDsUd2ce5ZWcrJeEpym4gCbrn1NUqxIzES1bZlCcJWJKXEUZFqphu8BbUFgf4UGwdh/3E9chyIjSOfBuRef4zG9sfZd48myHZoE0+JwixJ1c9uanRFQoqSjqj0KBh2/8Pzcer5+NMxLsiBLWPCEqnqEHCjt1E8wkfelxvTxx67Fig/eSX5zsnyGGJSEygjqIng81l6Nwo4g5V3VbO5USw6W3qzo8kut6HoViEwjt+dN0V8C+kvVrGFkIFiKy+9sTS77DCZS/5WolTKOQXzK7mGwmPrrLfuPi+++MTnX3npqXO/+MWdOvkI08dqHBbh+eoLzzxy8EH7bZVvMpebTDTQP1DHCcf3cdK3S5RdK33VfiZPlBg6tMuFNNc3MYQqptiNs6F2JS+2A1BzmwO9P3v+lQJORjUwAwzpH6DrqjPZZoOIjbfR2ZU+0iStnVuNdn/wRK5qeEXZfxna54zkkccq2GwD9z80j67OJsqSPnQVGgQZ9RPNBV8FDTBk8z2ccNRwMjPuonHSPWSKJdXXUxGvMILrNIeeWv/Pfv6NAlWrKpeCNxI2phyE5JaZAIUGYhmPV1+HV17sxP+pdMW1cf8jTey560ReeSNLkBlN1SCK1AAAABAASURBVCUDK64w4se/++0vt3v00ftuWWqppYp8DMmj+d+DNf/50HPOOaf7q18+/NB8ruFkF9n5adDEn86dyzeOmE1cXoqhgyRsopfcBzomv0Ly/B0MTvt13GrGxU3UxSWM/+uQRUL6flP/rwmnTUgjXVG++QbhtJc5/IAmquYNqgWwORG2WiYgg7Z2VZQXZAMpIc89PcA87TmVuMILzztmTh1KWMjKjFgZllBj1NGKoF7xVetvQ1ZdOWCbjeqZc+8ltCQWk0qwA/WXsFsZIyTkfJb+jQLOOOKwSrZaJaw0yz4EZHLdjB8zjsA00W/FE9Fu9tQ6KuWNFINo4fCvTWZae0B3laSnOnvymmusvM9lV/zyVwcddJAOIXxsSah8CNiSlw8y+vTTTy/+4hc/PaN1WMtxxWR+b2xw110zwJGHt7PtLtuSLWQIJeRx71TeuuQ39N9xFQ39Et84q8BkjDFlTZfIwQWr40hQm18/fhXKRsVQemDUi9qPL/z/krUwLcXo9sAoym18JBtfVwW/cH2HpTKzHrqWDVeDDTdwiuf04f9UPwaM6GqtCO4CnFdyKbtkkChT4IH752F1LECGt7cEzz/Xr/4NOP1jRFf0ppbkQaQ5kjRS1TwO3WcodvZLlCe/SKCgGUGRxMY4l1F7bWBt1P/Oj4TOZTGeF66M8QFFozoTqs5Qk03JKLo5yurGrq6SIx/ryDzlXl699kLSATV6ssnzamhajr//JeEbX3+VOfNSkrAaF+qCh3bdbfvtH3vymZtXWWXvysdNV4/Kxz3HP8H/yle+Uj391FMvWm/N9fdJbamzLMG+4fYefnHO0xxz0vZEDQ5r5VIVZ9N/+W9x55xIS3kqZcmbtjFIKtrrHIEUIasdynri+7YACSjUi2RB+k9TvvPHp6rWC00sAXMEumUIknpMJZRCyzCg611dNYYStOYX5+Feu4SjfxiRy88jF0NdAlbDHak8sGrNbU11XyyPVgJn6ekexVPPiWhOncULT5b7n2jXoCFScoPBb05qQylRBL0yGGNbqaRdbL5FmW3WLtN5719pjucQmBmkoYwPinX4aKaGLJZH61ss87zfJDIK/q98A/Eo67olxz0gDTOKlYWK1+RjS6g+Nh3ANzS0v0zm8h/Tf/phDDz8dxriHqKqY5XVRnLvC0tz5A8eoByKc2lQqc8MvuXCv12412WXXTPRmIWMEpSP8xHqHyf4d4btbzMeeeKR25ZbbtyRLqUzkQDfedezTHl1Ijdf9nmWX0Yuqt8hgwoDr1/C7N8dSP3klygEEaaQoyppzxQKVGV9TWygrJyC/0uy3kyqoOY7z/vprfXSH2NMDEYGwRZxck0TYkwmo/WXaQw76H31VMaMD9lio9VQF4yrw6ZeUeswklJjUylwgHWhsmriAtNeN0yb2K/7iqwIqB1OkbJXXumne64jsKIrgp/UqU3tthsy0wlkSDJmsM6/PXzpwKVIX3gEJk6hrjgeV/MgZuC9CBZXMotroveex4g/GTeP1JQZCEeQpoOIkhL5tJ2UXvqCCok8q7ZqQPTCtcw6+wh6b78Zuh1pGNNNF9vsNJo9d1uan/30OtJUZI8pt7W2XH7ssd/66h577DGXxZjsYpzrn6aS9UvPPPOcKwa3tZ0gyvWlMVx1ySs8+dAbXH7Rhuy+6yCCsCQPoZ/wraeZ/7efY199kMbqgPSjSElum8tFBBL6rK6DAhkJZx2Jztf+/U+T/X/xIUlBVtRUSO0Azv/xBwYTRxI+QzrrDcrP3M83DhmH6Z+Dk7o7Gihr7bEt6VsFHUfQkcC7/a7aiCuN4LnHeunrMqJjRORyylneeLHI7GmDSZIIJ2PkZCASV09iLLIqMgDzsdF8gepm461gxXED9D5yNfU6MAdCESdPREzlfy45bCCvKyjj0jp5ARF5xXqStESSDQjzKU19kyhfdwHz/34G2dnP0ZR0UkjLTFjdcMqfRrHfYW2c8etHqAxUyYaUmxpbrjj00MO/dcop3565uMkpbi/uKf9vvi222CK++OIr/trS1PxDIdLXF0fud79/hvlTp/CXs1bkG19toz7nMEkVRMi+836NffwBRsgIWErEUZWqzhDqQRSDSR38fyuUEUZneSNj6LRDYVNAylzNMVjHq777r2LF4UW+vHeWXMNs+qpFuisNdJWa6C5HdJcK9JSb6YmLdKqts+To6C9w+bVzRDFHVb/IRMTOML/PcdPt0+joy9AjZe+s1jG/3CYYgjXQysBAI/O7BTNpJgi6+N5xeZJXb6Qy924ig4z6SKQNwu9/63Ey1uWwIOMNUdpFxvVR0m1POWjGBHVkZ02m94o/0XPD7zDd0zHVlOFDHT/4Xoabrl6KHdZr41tHPs3s7pQ0DuMoaLjnb3+98Oif/exncz4QJc0H6v2une27tvxTw0c02z/BXPDhDcTRRx/ze5fay6quGs8SYQ7+ymT622N+elIdZ/y+jUrkcEkfduZMOv98JoVXHqduYC5Ro5GF7qMagbNGDNFySqk+FsD+/+dX63KhaFCQocxrWQu+jXbzgoxDdu40khev48B9h0m9p+DjCV/5Sh9bbDCJTVafyYYTSmy+cR8brtvO+qsmbLhawgZr97DRei9y9wNFeWFGHkaRqukg0a5XUlDtJz99i43W7WW9NVPWXXs26607mY026NS4+Wy6Vg/bblJkg3U7+e1pXbp/H8Uyg3qwb9xA2j+ftBqKB8JRmP5PPcbK02rDxI6866KijatS36Ir+YQR1V6K5/6W9ME7qbPtZJISSy9v+OuNS3HECVkGFYZyzL6v0DlNpEtyRGHDq+ecc9EhO+20U+cHpqH7wCPeccB/yMGPaLZ3RAFOPvnk+AilxiBzK2kQT+6K+dr3X6NcbmKvXarceMMYWpssDWEPoYKTr8uDYOJj5DpnQJOUxlSokGDFlHq5zQtuMd5lsk9rtQTPyL1HiguyhikSQkNdsY+5T1zJkLoO9ts7IdtQIU7K/PT0cYxYJmD2bMfc6SN5dWKeN6bD5Jl6zzRMkpM6eXZCf5KnbALSMAEJcy2Hjp7SYN6cnuX1KTB5Wsib0/K8NingrRkhU2cGvPZGyoabtPG1o5Yjl+tk38/X0/HgbbSV55DJ9IMVPP7HklcTf8Q1IcUgoJLxAVzHEOYz62eHY167m3rXT1H9tt6xwE23rMjyy+rYnJnAt747madeqRAEeepMdd4Wm27y1X333VVc+uRoaD+5qf955t///vfltcev/z1RZ3Iq4bz51nauv1rnLgnvVuvO589nrkhLa4mcmymX7FW6r/gL2ReeobGrm8DIs4gsVQ/S+SUZX/r/KEuaTFW7Uqo1+bVJ8dIykeqypZn0PvAXvnFAE4ObEmJJXiYKaRs6k3POH8cOO+eJCrMgq1hFJlIIU+/AkYpMij3i9A9G8IxAe/A6VlCjZJEUGQ3Vu6isRt+nDicPzRaqfOO4ZfnpT1cS7Ekkbi5HfnUoY+o76Lv7ClzXZDnYPu6gYYset6jw/+/biJaZtIqRIa+aCKPjX0PHZOaedTKZiXfT4rqIwz522T/DWecsw5DMJAqmgZuu6eGiy+dRtI2UU9O/8bqrnnDz7dc99klTSiLySaPwf/Pf+cL9L7QNHvbjsJzpy8Qhv/vTdKa3D5a9MGy/VQd/+PM4GlohiAdw7dMUpLyAoXO7KJSq2CAgiQIGQoMX+v+DuoSU3IfBQ4MVVEQeEjIIRpmgTGgHaH/xdm32/ez3+SHYJFYQDELFaPIWmgvTufDSZfjigRmiTExa9keSAqTCRSBxgQrqqF+jOpuEEGfVnmLol2kQXVUyEnprY6zmGzS4zCmntvLDn+epzz5KUy4mEi5tzfP54vZD6H3iVpYqGI2N+adk/unr/8+PGk1TYsW+jKKJjR2vkVz1B8wLD5CVWS6JtDt+sYG/n7kcTdnpZOpzzNOt0Kk/fYmyYjjE2TjbkH1gh/2+fIkxsiyfMJUWSMbbkfiEy4fvftC1DekQZRe/8loPf7qwk35R1ZkOttq4g3PPXon6vCGXdJPOe5Pp55xBU8c8Qr+5ScLTKMX/FZokXCtJsborXZD1qecTk9EPM3FtrMXIOBgSrcJhHGT6ptH70MV8cY86lho0B5ubj4t6KBYTOQN1EsgspvIGv/71EE753jAasr1kKMmYCJa3oKKXlZfg/zgnk0CEkVIHgm2xJtFXTChPIpdmyacVlhtd5ZzzhnDwQfUkpdeozybYYgBVi+vv4CsHZ8SXOcy++xbNU8YIfhhbAidkTQmsDFoCgXdb+DQmIY/WIippFeCs5AvRKCFwCSIVSSYAGYe2SjfV+y6l9PD1FHTDNmBgp/3rOPPna5DvnUsh7YNMhkuvmc8rr1UJdJ+fyySvnXvB+YcfffTR5X+njgD8e+U/at679R/d/vOCANr/vPfi6XnKn07pW3+z8Sd3xunsUinigvPnMK2zGRs47YqdbLvxdH7188G4rJgUzKI44wGK91xOW7FIxmSFpKdrjNH2aJXf/vZHaiulsGKqOn56Ho9vKhqkKf5vD1xST2NFHsBj1zCo/Cqnf28jXEbKJ0MofaSQSwhMOzbbiQIQUty5HPX1DOf8sZ6RQ6oU/P/OykQggjgZHIsXA6u9LcbVyk0k8sSqMrSK8pKX1G+9boYrL2xj283LZCpzdbyzGLnQ2Co2LZBkU1rGdXDQwTkqt15Gtn+uIMXiWU7KE0BmAGP7yabiY5wBHU8+PQxYgKmXJ0QhjDwscqqM8IY1FF+MDKCRvOF6afTX7E8+TPGua0WebmJTZNMd8vziB3law5ch6SHJ5Hn2pVZO/f0APbGhZNLScuNG/Gbf3Xabxjsm9461iyrfu3VRrw/wFkD7Abovtq7rbbrpm2Emd60J4kr73Jhz/jSHNKinxgkXs9/BBfbfp4GsrvCIS3Q89ncqEy8np5sKixWeAU4MTAnErkB7bYDzCqaW2iNG1t6foh8bVEiMoxr2SikD6pJuep+8ju02b6GuYZLo4xXbLFiR8y+HkbEIIkMmJ0NQ6WD3fQZx1vnDGTOuQtb/nYQMJaJLKp8hIS9aZUldSYa1rzbWGKMybLV1A2dfuA4r6S7exQNoMk3gqDWiJOMRBpL5aj8H7r8yaferDDx7vwxDTKo4R9l7CiaPSQNSDUpsqkEJGMHg05NS0QOfiZFLBvK6vJeamEC8CXE2JJJs5ea+Qfvlv8H1t2MyVcavmnLeGasxsrGe1Mi7y1dFw6FcfNFc5syOkaxXGhqarzv19FMvF9Al5rFLDCZvQ+Tkk09Ojz/hhJ+nzs1zqePcM3uYMU2nthScAsCBe4tfnzxa13IBxrtn1Zl03/E3Gntf0a5WECQpA7LuYpqTkXB6p8bKYBi1OQzKTsVPzSNkFUfQOUFCWKE+G9D91G1kFfj73jdGEzW3S6krWo1dmP06RSutWfaRpKKIeBasm82WW1a58KJNoOownpiiTUJF4p6IKinGVvVH5C8bAAAQAElEQVSW8OrX/3vBa6w2mLP+tiVNg5/BhfNBim5EU4yUW7PVHuNwxZQGHfeWHdXH9jvliO+9itbeLuEbQ6FR82WwaU7KYYkDja2Nd7XhH/bHfFgA/+l40UpEU2/RR96BVqL1aWmih7MRIpCODCXm3/wXaH+NSDxrGez4y99GMSj3skjm5CGIVjLIr0+s4+rLuog0LE3j3tXWWOPUbbfdtl/A/8Pn4+/mpenjn+W/mEEGYlZdff11xtRVrYh50w0yBNlGEXeAwIW05Cbx61+OImdSwmJI9Y036XvoXAUnnYRQhqE2Z0DNBawx1UowxT8jgdQYlfj0JKM1+129iEkz5IpzKN57BZ/Xjj5umekk/sbGWvBek9OanVHZkMqwpklMkLW4dEDfZYya2qfP1w6Xw7l65RRnU1A8gLAikwCRNeAfgeruHMDm3iDMVUjKop0eZEqECAunARJs5Ej7y9QF0/nR91agvuslyi/cQyYoguCZNK9ztfiksgs0n0vEghowjf9wz0cD5T/AwRtbT0B5DAGeljHOE8paDXZkXQXz9CNUn7mTQmJp0jJP+mYbyy09hzrRr5J24EyEydfzt7/NY/ZcSEWM5qbWKw488LsvCsgS9fhVLVEILULGGOPGj1/hb3GalOMkkAs2j/n9rfiTREBGVC2z6lpz+N6J9dRre8xoJ+x++F7y814gm0ogpRSCAbGsvNw9jKGWZBgM4lrt49Pz4yRs1kVkqgnJK/cTznqeL+0xnDCaj2ei34iNW7QeabUMaqgGmyYYF2OsI/BGoGy557Y5iqijb+XI1navjG56/M4e0EiaSIAFy+vCW1P6ee3lKdgEIim11a7vXAlw+gdSP6lvtCC9J2O6WWHcPDZZPUvfk5fRkCr2UB7AiEfCQP0N6Ks2mE9b0iKdw+q4ZmUQZXsVU8xgqjH5ZIBC1zR67rgIUyrWaLXT1gUO2buefLlEKjqbTFmbmWPe/BauvbmdxGVkHHKz9tp7nzMPOmiL0pJGDa32Q6Lkef0hQbzb8C996Uuv5vK5J+TJ8uyLFZ59OiEbN2BiSa6kK5sr8/XDxzB+mYCcrDbzi3Tecx51cQdBtajdtorxEquAkZdHnxeMfLcZl9R6EVmaHsb1NJXn03PbuXxuI8M6a4dgDH4HtzrPS1X1nVB7ozFq8OtXF/+lej1pHc8+3y/Rlifg5qk+wKQZ/K1ExuQI1O78H1pJMlIRSyC47SYnxR+l44nBWBmaYGGDQXOrrKMIUhoBw8ojCO1svnfsaNKpz1J97kbyaT8urRJbDfCdUv8OhIx/6/Vpefwa/XJx+sfibIaKrtEzosfgtIvy/VcSznuajG/NOY789jJkzVyiLPIzygS5eqyOVrfcmmfazKoMZVAJbea5JCm+8kmR4L04IBH4kGiJWB8SwrsO15VOz4gRQ/5aSarykA233FSRcRgKElAardxcQ1Ohm299c7gEr0JoSww8divlmW/QkqNmINC5D1LwjK3NtECZvNDXPj8NP9qpSHpBghhOfQr71mMc+YUm6trmUUIszCOVi/Ujw2C0Vp9Vg2+TB8HC5HTksPVjeOnlPhL1sXVS2DggldcVyVU2Sbf293lEOcHyMRspsSDyzGMBSaUNZzSXV3Ad61D2JE2kGD6jkaRhbaaQhAnrltli/ZD+By5hZLFDClMh9R6GcVIQo37eOAieSkv+4xagmDoZ0hQj4Uk9fYzMQKZAWOojO28SlYeuwiU9RKafg78yhFXX6McFJZzNkpMHV+kv0VcdxF/OnSRqQ2IGqptssfWvzjnnnCqfUHLvMe8Sz53WpZsfFf4Kdzkef7SHam9WLnEVf/2TRnXYoIctduhjwvo6Q6e92FKZvqceI6wMEKVlqUeM8colIF5fxFeZCi+cPvvKT0G2jjhKdAU5QPfD97DGcpaNNpfCKhBbzKakgQJ+ydvZ7MupFubX6LOK/pFncPstr9A3EEkwDb6XtQWiIMN6G+a48upVWX5lqLoiaaqjhRmCSw2vvzpfY0qYyAORAfBGQIbGiaB+Fu/ZOW8cXEFGWNukpgwaZ7L/AUOpvDyZ4mvPyjiUIEzEC+SdBOonOB7cf5nNfznuvxu2YDYjaxi6VKsW+nhiZHVVCYXA0P30/cSdb4luKW1DQ474WhuVcDZpfYg/8qkLOUne69NSHno80ZHC6sYoenafgw554b/D6eMfZT/+KT7cDKsvu/r0TJR53Ua4l17pUxDHEebzOi8bAY61o/UyaHCJ/Q4o4OJUIiqhf/6+2h9IBS6LCXI4ReONzt3SIowNZDTEYDFaABbD4953jkA7UvB2fIwBn1VnkqoCebEUKiGe9Bjl1+/iG18brhuLuQTSsTCScahNEVJLvqxdHQmvw0gc1a4Gp1yhgT/+rY9+zRepHBQtDbqBOOTLGS76+7JsuVUn5184js03DwnTCqT9WLnHM+anTJwSU9XxgzQCMUONWFnaIAWjjKhc0wLNaTSZK5XYVkeftVcp0f7Y1Vidu22Sl32oKGf4sElTfFgQH3h8QKJVBpBK/hSXwcYQ9lKY/zrz7rjRrxwnI33AfkMYPqKPKFMh8UdatbjYiRdZHn4owPpviPOZ/GOH7r3d/A+MyGIaYBfTPP/1NPvuu29lmWWWubhaNa67aLjtidlUkxw5BRyDpCyCO+JyH9ts1MLYkXKRfTBy2uMUX3+WpKod0iuKTLd1EnYTSrADCb4Te1hMybznPL7VChvrDYHzXVWz0DBICokCS17aNljbc/zIlawwqpvddszhtyynXT2MY4zr0bfq/HCZR5zKfnfXd+pSPDifu3oUb3hd9FKMwCYlWkPHKd9t4ae/rGdQy6vkwlkKJr7GX84aw87bNJMJ+0RfGNCx469/m6Hg5zDNlUisBzRfgtX8kY4lYRJojhSCEorOgb5zMsyDW+Zw2KEtlKfcSjR9igJzon+1irUBVnjxKUtGxiExFrS20NPXlcgE7SSvP4brnIsTLcaOsOy712D1mY+rpGR8BD02GPFlIM7z1INlarzTSXn8uPF385El85FBWgRIK11UXDLfW2yxRbzWWmvdIewSKyW58vJ+GQe5EaKF33Ej3fmjrWvUqBzb7zyGyCYYY4ifVmDIFQnisthicCbA93PaNavy8Wp6yCefPB5SMylhoB3FYSSA8k1BCoTOtdXEkiSGzLQ3KU98gL0+P5hss5TMeRpY9UdehV9HFZx/KxuVlVMFAQOt1aRaf5Kjr7ORrrdKogk0Nlb5/flDOewbjeQz/VCWQdF8CqozZEgHfzhvab50YBs+/JBN8tx3W4X+boRdCaKKJnnvJ4lL+D922mGHIbRGMQNPXK3rvXnEUT3FXCdi5XsD+K9bP76BYgPOOvxbUiZiJCJFhXnPvUgQRvj//unWW7ey7HIVjCniErHEOLCGxGXp6mnmtjtm1fhpjOled911n/nosNU8Hx2wGiRb+13Cf7bddtt5QRDMMxjemgRxXE/qLE4EdzrNBoElCLrYYWcIpDfeiBSnTSFTnKNocVVurCE1WqoYixgWW401H8GiPyJ+pCaq4Wd19AmcFNtLVegXksGYAMUb6bjraka3dfKFfQokAzNBcQLn1+QMNg3Aj8Mn7eDEYCv4v94zMg5xHOJo4YUnZ8OAYUhbwNnnjWG3PQPC8C0ZFxnRIIJKVUrrFKBMaK6fyamnjeIbxw6jTu5xcX6Zrk6DDTP8RyljxKeUQY3zOfboQVRfuBk380WibI406Ja+GKxw51OUUmMQgUiCFDlyujKvEM2aRvn11zFJkciV2WMPq7VNJlaULJKlNUayl5RwYQMTX7fM7qSWWltb79500017ah9L6I80ZgnF7G1obbjhhu1hGM5wztHbW6ZTO1gqwTJGgipdMKon6WDV1RKWGRPonl6VPe0MvPkcOTEm8kcLq6XalMC7s76MGP22Of6r4kcAAo+H8HFe0U0i/BKM9YAD0NEpFySUZ01k4JFrOXCvOpYZoliDjgXOaJ1Yyar6ylCC1szCZFTWjhUETkcrByYL1HHbjfNEH7j0imXZfkcZj8p8bLXOQ4G4CzSXSyx5jcsq5pDPvsaJJ2V17FiKRAZ48mslHeEaBMt7GXq91xMYUo+DrpUP3yXP+MI8ep68E5eIeUZ4y6AZ8fC9QCxxbR5fK3oqpwYaFA+qPPUolEsydBXWXTXDaqvJuMpbzWn9Nsng1LHsUkwmy0OPdGDFWxsEyZAhQ+7de++9+5a4Nb4NIfu28vsWRY/37fNxdFhuueXKxpg5Xo+qJUd/KV8TPEm1lEOELzsyUUJdvkvBtOHqprq0l/4Hb6QprEpvPOYhJnXI6AvFD7Rs9f+4H+FnHMYbOe3xaAVUYylukfqSvJ+J99KUmc2X9miW/vr4lQJjRmPUz/r+tXG8Lbla2f8m2uKMsXR39uJ05LrlrvFMWK1DdJiNqST+IKG+CSqAQAaCZyTcQdhFWNVuyFT2PbTMHXeN4NGH52GjwaSCyfslwTIitjfGrTqHf2HnDOlTt1PX/yY2qYOFtx3vB2aJao8deLqniV4pddVezBvPaS1FyWOFHbYaRluzIROqmwK3PgBrdPzL18tg2IAXX14gt3EcOxmHKSzhyX4Q/ESaD9L9I+3b0tLyqteBgRgmv9mj00GEtAeCquYRZpUKDdmEDTYoUtDGFrge3NzJuN75VHzE2HsPSbKgrw8mqfTxPsLpP53A7/SkNYFLJHxOURLihJzW1jD/NbruuYAD9mlmqWEDeBqgQKL8WO1WrpZ9GQz/SFI8/C6nCqsjigkS8goenHpGG0OGzSZM+3WcqCNNKhB0gokhlcL67L0xhLtJMNr1Iu9ZVLoZt0ofXz0ukmHo1DjD+ybR21WqBHKAKM1m932kONFUoqevpqG7JGy9gUveF8yS1CHI5EUn0SYyGB0BMwMd9M2cCNVuAtVtubXHVs5A6hdtRcUUMcizkq6uhDmze5Cd9p2qI0eOnOoLS3L+QMbhk1zIoEGDpmn+1BvvyZM9ketwpgiKBpvAiFmWuFxhs80jGhsCMSsh7Z1L2tOByUQY7XaR1wGTYhIjUB/385/OIWGToHlhc+gfK8HyV4VRlrq4h/5nbmNQZRrHHjcUE5S14VqwsZSrir9zDzQcox8/xvg1qd27AS6Diy1B1upoUVQQMyFX0E6X9uiSU31KVSLFBRA9QN/a4Zx/68iCdvxanfDBGwjbSFLsoi5fxdp+bK3dz/XuOa2mZHMRCEH/h0ArrAJ77NlExzV/ZWjffBLTj7PpuwNYAlusbmFMvABnGxrKc6fplkJimfbR3GZYagW1Ke6QktHaKqRBESfDm+qolpZbmT1dcrtgXRUdkWctKC65v5KKJRe5t2OWy+VmSAVcEMC0qb04f+duVONXIJ4Y7bYBWUaMyTNicEhF983EA1R7u0n9OS+1ulZCzIJAAm8W7qwshmQ0h8FhtO3Xyg6VlUFK7nOid4ywI9U6CDLUzrFSyPlPAhQRRwAAEABJREFUP8D2Gw5mxKgysbGqzuJ0/neKRxitG43EeKgaw8IkRSeNCKyUU9Y0yqVS7h5CGYq0mMH4f8kqk2KQga22gpHXkCmRZsokCoS6UONsqHrtlPJecN2ClSUIm7CipfMGRKP5tyQ8jBhkQoIowMg4IcVwuYA4ms1B+9eRL3Uz89HbyWXLBFqAdIz/NAcC/09Z83v2e7qp+PE+DvHMEAYRyAM1osPMV/2RIpZJjVl5jTYaChXP5QXZpuDpZBPJaoCrtDF/VkrgrLPWdq2xxhoVlvC0gLZLOJIePRmHDr1dLJrPmpliZBwSf6IIVBs4vKx65aPUyypjM+Dr5V5XJs0jV62SRt0UM0UpX4SVNcdoDB82iXxGMGrwhIxNQbGCTL6eQMYpp3KDPJvGuEpTqY/hboDhlQ5GyM1eqtrOUmkPI6tdtPT30ZoUiLUzuUi4G0suTOh/4gZynW9xxJEbajkjyUSjyTSuQNUti2lYEcKVqfSPFQLDSGtukYqhJQ2H4DITiFkVEy0PZhnCumWJ3SjCBn1nR2uuBuIwx1XXB3z7BwHHnZjjO99XPjHPt79d4AT/PrHAt7+X43unZPjByXV8/0TDH//YzJPPrkORDakawXF5XCjjYy2zu0dz0s8KHHtSnm/+IM8xgnf8jwp8W+9TfhTQ3bUMm286luK958CFvyBzyU+ILj1J+WSiS35MdPGvlH+j/EvV/UhZbRf7b+VLfkXmsp+TufynRNf+gvCiHxBe/XMa3riHBpN49oMzEGS1XqPvRIqYYMWSWj0fMkle0kDKbyVYsaF1oBOefRJjsnhbuvmKBfKZEKNprCliFN/y8mhkHK1u1ebM6aJYgTi1DBs2/PG2trZEXZfoxy7R2L0NuUwmM6BP58MHXeKLcQHGC4MnsV+FdWqOtVuVWHpkE9qk9W3omTpLxqGMC/tJpHDI5QM/SM0fxeP85BIJo/lNSpiz5Cv9FCp9NJc6aHjlAdJLT6XnrO8w+wf7MfuEPZj13c8z49u7Ke/J7FO/Rnztj3EPXslSUudMtYKpDDDSzqf42G1CNeUnv7yXPXZ8nN12epGdd3yeXXefxPY7vMyee77E0V/r4JUXliGtDId4FNNfG8NRR05lp12eYs/Pv8SuO76ucVPZefvJ7LbLJHbd9UUO2GsaV13SwtPPjeHIY+Zy+u+7+OOZRX77215O/103p/2hU7mb3/yxg9/8oYtf/7abX/22g1P/MJdvnTid7YTLmms9ys9/PkBP9/JUq/UKEjfxvRPf4tTf9PPb33Xx2zM6+f0fBeO3nZx+Rg+n/bKbww55jNdenwXdU+i77W8Ub/3zwnwOxdvOVv6j8pnKZ1G8Vd+3+vrfU7xN+Va13fInKsqlG/5A+Z6/Ed98Dr2X/JF4/iwZAlkBE4KMlGerlQAYnJTV6NPzSK8P9QiOvKjYmhrMnG7DaJ+DS7KK58CGE/qp6p9U28+CeZF8IoMVYEyOeR1z0H6hmA2upaV5yjrrrCOE1b4EPx8F1RbL8lpaWno0UY2g8+erpMcIe3nXKr3tSaoMWaoBDJCWqcyahKUC3pDUKn3RN6r9wz4ulQA4AQyUMxgdV7IkmK4ZDB+YTte1f2bWOd/BPn8Fq0VvscOazXxlj9U4/oCNOPaLG7PnxqNZZ/AA5vXraL/xF8w66/u0THmC0fIsOh6+i2RGNyGjmdc5lvaB1WnvWY2OrtXp6FyDrt7VmDt/Ra67rV/xiEfpKTdTMk387VLD3y+19JXGM7tzeTo0pr1nQu3d0bWuXNu1eeqRIfzqx1OZOWU81XIDt910H3NmzWXenLm0z3uT9o6ZzJPgz2tXnXLH/HnMmTebGTMn88BDd3DKj35I2+D1+ONpPRy47xS6hEehYXVee9Gwzhpb8dbUmcxtn05Hx1zmz+ukfXYXZ5/5V6ZPH2D6tAG+efy3BWsGcwR7Tvts5mi+OR3TmTNfuWOqvv17BrPn+/ya6l8RTq/SMW8ic2a+rjW8Rdfs2fz25B8TzJuDE36hK0PNg0jEixTwWb8fEasFkDQRTHkE1hjKxV6StAS2Qj4bsNoazTgGkBDwr8nIYM2bN0/tC1oaG5vnlUq6dlvwucT+Sr0+etzMRw+SwYMHl3RWq0oV6e0FYxbYZ9Gdf0oSkKHDyuR0XMYm0DMd68REJ6xcqK7uH0zSx4d6Au1OPiOnHxMRaudq1PVfS+8MJp/zE6pPXs/+h+/NI888xoOPPsBV113N7/58Lj874/f8+Le/408XXcjN997DW8+9xre+vJ+MxO3MPfd42iY/QO/NN2DjHNtssSMPPPao8iPKj3H/Y4KlfN/DD3Hfow+zzR5bc99zKdP6OugM53DFra8zZoUVuf6OG3n4sXt54PEnNO5B5Yd44NGHuP/xh1l38y3plWzGZOSrpNQ1ZWluaaRpUIHmQfUqD6JlUBstLYNrOZNp0nsog4eMZK111uMrR36D+x68jx/+4Bwee6yHr3/1eQYGWimXDZHc7qWGD2NQk6G5ydHcXKfcRCQYxuaxUSN1Dc00t7Xq2q+FIS2DGNLczODmeuUcg1tCZb19XVMb9c2DyDe3kWlpIxJO2SHDCVvbyLY0EQ9poirlzIZOtCrLe0hwsTYCz2HjFvLW6m2UP/yT+jOtcoAhLfZolrKAlqmrD2kbVqfaEuYf86pJjwKPIJp0dHi8VKGnUMj1rLXWWqmKS/TjKfeRI7iILR81YCvKyyYQx4gJRswxSB/5v2RUTBk2pJdsBLlsFpJuqqUuSAPwgTqN+qjws9qdjDwFvHHwhkexjVyli3nXnk9m7sv8/c+/5Lyf/4RlpVRZlyFMc7hqHpfUaUS94grNUs8s+bCJX/zgZG67/Cpa0yLPnf8L3JzHabAzMG4mmAESA87YBVmGLtWdQ+Ly7LbbQT7MwfQZg7VjG155OWCrzb+g69w29c1gdMZFfZ0JiC300Q65CqUgpT/uIJUBTeUO12jiO+h8nGJJdVzSJqndkdqtQ5LKYXbCQW3OaoRL+Pq39+fIb57AfQ+XePSpboK6EJvt0Q7bj9NacQVi2WeB0jz9JAxQTjtlIEriX5+AJaKFUd9QZS1QPRAuEIPO6iYOKZQL1CvXVQvk0wKR8Kv9URsakgi4lNGkVWxSJSswpqqyrxOu6rLgMQteH/bXiobGGIzwdP5vyePeWrl1sAEFfSHV97/PYoKAUomFbcblcrluUGf9fJKPsH7P6SUu79m+xDR2dnZmUueCILBEEeAcgYRApX9+TEpTc5kwhFK/OKLQGXE/KHqPgpj+T4qd+mj4P4/7r74cC1DwZDRkJTSVKa/S/+IjHPO1L7HPbtsQVfuIdLxxiiM4uaJd7TPpmDeLUncneSlY2i8lCQewCtlvutnmHPqlr5B0zWTEsH5GDArICldLvVRSQu/KZIS4KUthpXE2heWXW0V1Ic8+Ci8+OZgseXbdYS8CMgQyWE6+ltEYWSWspMGEBYyNSGKDo1lktHoHC9aR5EjTOmUrBU+YO3cuc+W2+2NFX1+/FD3B66MTdGdLpLafvQ74ImE4iJtvnklJNyOJjnDW1BGkg0CxiEAG2fh5g4QwstQVLBnrswyXSTBCymktaaJvlwcfS5IxQ7gbByY1qjMYGcTQGIIk0XpjcjIiza4IaRWfjBQw9pYoirQmDfSVi/K/fC6qfre3eZcGTY8PeqUyROV+Bb6EQ6i+I4bqd6CHUK93nCqJKRYNgQesHBBUjDY6PuH0jri+DSf7tvISXdQZLZumaeTPfQ0NkgntZJJiJNn/grfTkSJGfMKkgdrK0ouiyrIoEjgVcEZkEZPU+OEfk+K3BK+AUVxi4JVn5AnE7L3vvkhPqCouUUxLuj0w/OGv5zBmufEMGzmKXb6wG1NmvIXJB9rFi8TZCpVyLwcdtif1jRmWGdlKISsvo4pMjtFSeyRcXZpKBiLr9B6AtJ/RS42mvq6RG695geefLNBQV2DVNQZpmWWMjlNGSknix/ZoTAWT1kGinFqVpYw44a8dXJbGhVWMifFLkjFm7XVWZ8zokYwbp8DlkYfTpWBPZLPygOowUtbUDTB++eUYPXYN7rpjKqViAVxW8EVcb5ACxz9oLSWPyymlTses14u88NBbPPPMIzz/4mM88+SzPPfMq0yeNAPnMoJhqSWBqWhHntQ5lUdefZL71f+pF5/k2eee4PlnHmfGxNeEr6Hk3aooRyIj44SXw2reGoT/6kcUeddxBg89ptjfg5giYwUNhTxijsb8+0hjwClWUXNiFzbHLg513FCLhixRzz+jtJALSxSG74hMb2+vTAKkIvDgwUiIVPA9F758cVHO5iA0lkC7p6SYuFLGesOgGiT5TjuWIPBhk5/ayyU1msYE8QCdc6ewwoQVdbQRklZKRCM524it5vjh8T9VICslkgI8fMejHPmVo8ibHPVmMJHe2XzKqGFNDBnRwtPPzNdaA2wuR4rD2mbt2i3KIXNmz9f6U4x23bpCHeusva0UrcqtN01i6XFjKdRp93c59SnQOadfY5pVHiQjA0GaELiq1EfjvQuiYwWmF2d6cEGnlhKLVgGxYicF4TNu/BA2WH9V/n7RZZx/3jlUS1UZB0smycq7gCAMFJys543Xu6BmeOoXkDWQ5yx4BEV9J4KbkIkMQ1oMZ517KutvtTobbLgN666zKRtuuiEbbLwex3/nB3iapsQ44eX0Ecm7uv6iv7PFepuw9QZbsOl6WwqfbVl3g1055feXY5qWJRo8gqrJkMaaKpRxMhYB0AeaN0Ufyh/+MTL0RtwIhGW5az5G+Hkcm+sbUDWqXpDfPpXRCG1kfkMzC+uLxaIn0qLPhbVLwksLehsaouLbvpbgYl9fX4OoaZRoaQEbgJFy1BjCorRgcVHolxVIMELIiJUKUlh5EUZ5AfcW9Fs06r99a5PSUAMyOJiqTE9ZRskx0OMV0lANMpSkkhUpo///f951/53se8AXmLDuqhSaCjzw8H1s97ktWX+99Vlv3U1YY/XtWVPR/pmT5rLMeEccDFByfYKAdsUIp107JeSOu++gVJbyhSV5JnDsd75JrCW9+VYPq6+3IiZbJNW1mxOCd9x5DwPlIlXvtgOB6cOaKlbUMWr39NMpWGSRvCaDIM2TVlKy2SzVsmPk8MFsvPEqhNYxb/YsMpksJhYgUiKbUUETR/MIRWcfl0ikQERzwUop0wbBk6UmABnkMJNy6h834aw/t/K7MyK++5OxZJpigmxCqJ3fhqHWkQhyTKr+iXFS+JDEtlAJhzBs16/S/KUf4Pb/IclBPyI+7KcUDvs+pr6VxIjXQYQxFjBQy/p1Dvwi9fthn1QwjTH6Fcz+XoReDWQ+IzrouGNS1Ma/JItTQ2NjQOCF1jlTLpfr7733XvsvHZe4zyUewUUUq1QqwxzivNzW1sFgg17x3KkgoUgkfPhyWXWWlKg2LDRanlz9ULubSSMx0zMx1LvWvPDnv39ZwcR7J9kBXL6TNFTKzywAABAASURBVFtleOuyzHqjh/lT/S5cpZCzUkShlSZMWG0VLjz/PO668w7uuOM2/njWn2gaPITu7gFeePZppr3+Bu1T3uTwQ5bjzD9vhsuWMQbFEUpSkjKpBFBL4YEH7qW/38PMSSkd62+wKo0NTYTZDDvvvLs8gwxGx4aevl4eePxeeSCpcBBVdJ63igGkAhpLshORx8gVN040ISSVgqWKJZCRJ+HAaG0P3Pcyv/nNFawyYWW+fMihOI2tCqcYb7CMPKEB2uWdLL10liiMiE0XDhknzYXmcppZoDC+nMCYUTFf3C/isAOzfOfIQfzou81ESRUjryuVG2asjIkCj4EMirUDCCXSqmbT8SjcYDuSDfYk3Hhf2GwPzAZbUxy5Kn3CM5ZL6QOlJGURxmktllQwnBGiUk79fujHyBNEG0wq40oQIOrj4RcizZX04TSDz4imqEEPTv8YW6Sx1cjwhWAStNENamjwex1LdLJLNHZvQ07Wdqg+TSCFX375IQSBFwLVSOCQAKqEJBAklNVqUFOI1FWQZGGswRmxTUwzxkjoDR9FqjFfzMbvloT0BU2ky6+ndyNnX3QpmCKJ3HOnM6eJUzJSHp01aairZ7UJa3DA/gdw+SWX8fAjj3D+hecwaEiBaqVCS0OOccs2yAMQztR5EScnqxDUcHf0dHcxadI0AglrKq+orhAxetQYmhob2XLz7UjjgMBEzNZOf/9D9+DXb7V+U0M4wIkCCejt9Pt/j5M6xa5MWQrW0FjP+X+9hBtvvkWG7Hbuve8eGYh1SPyo0MljqWptEZMnT+bN1yex/Q6ry6sQTGMox4MwJi/Agr+I1JpbbMCJHibpwMTzsfHzHHrQsoweoa5pVWR0GmcxoqXH1cpFMVbmxZ8XkhJ9mXq6TQMV2yhFy+CM1qIjmgtClf1ETjASARMekolUuKS+ulbzYX8M3ng6gUmFF1GA1Zr8txVVbJjCorkkZwvKqqh1qDJiZLOQ8h/OzGuft9wLL7wQsIQnu4Tj9w/0enp6RhiJANqVxo9fGmk/TgKAkTAYEd0tWorTriqXXDtJxcg4EGB8BNtbe+u/E/HN1ezIP4D/l4VY8JwpY0oZGGijYpeif5V1yWyzNWdd+leOO/FEjNWOmokIs1lFrMukfnbhGgqnRDiWkwSviHvttSePPP402223M6ed/iR33zudgf4MlWoq7HJ+uXo7ZTDG8Oyzz+KTgrQ451h55ZVZe+211QaBdjVf9+KLLyreoPWqv++78OWL75IdoRQvF7VpXJZNt9iYzbfYivHj16S+frCOJhpmDWgXrxRTrA35+18uZqDUx+e2HyR96SZjMoRORxQprXq/y2PwDDCuRGDnsdMums/FWB/BFVepJfWRRwN6syAtKDl9+KzXYn0WGh4va0Y8yYTEwtX/1WPF/21FJuL/UF2An8fXGEmt+DyotYGMPEHfp6O9Y+329vaAJTwt0qglHE3kenePNsaQjRyDGlOcCJ56zljPCH2L6p5vqE9fb0BV7bXAo8lidZ5NggrOlLROJ7kUc2ud9flhHqt5NX9UjciVc5hqKPFOafzcFjTKDT/zD39mexmKCy+4gC7t9plcFmcD7XosxA9sYGQwUooKmtY1NfK7s//M2LHjOOboZ9CVvfpL6LyBw9QwNWbB+6677pKxKRJ5IyMDs/vuu7POOuvgjYI3GL6zzrXU1dXV6qy1GLNgrG97t+xJmsjYBFFFePWSmH6CKCUWyZBhcFRBilyfLXD2GX/jnHPOYuddGlhrnT5C04fcCcKojJHqvNsci+o93NTN4YAvr4Hzld7QquS88vlvMqDduVZcEn7kwRjPc0/GyBsH8J5Jn/8jBhuwYA1CVHR+O9qBRXKbMniwQU3oiDz4pZde8oxV5yX3EdpLEnLvjIsEPkiSZKgnbF7eajbbixUzatupAc8IJwWqjdZHf1+ED9DJ74OggAlzUrKK+kmwa50+oh8dYYzNkeqfjBuguTyP7BtPU338flqa2sjWDePu+x7h8K8czkorrcIhX/k6N956B6++9ho6JtXQX8AAhw1D7SwBTc1DOPa478triJk7rw/vOXihM1qvtQt6e+W/88476erS+V6KHGrsdtttx6abblozFoE8B51ref7550Wn/xuT6Hjzfiv3U1TiMjYsM1Cco6BkuwhcxF/dFXvmM33KKzz24D3suev2/PikI1htzZhf/Xo0afIGoU1qSpAyB8wA75tkwCMdD5ua+xkyDAx+pT6noC9qngNLTvJGSzkVnmGuQGoX6HexJI/UWwmPqUff414rGzyTgyAil40ZOiyrjQmjlJWBGOS7LMl5geQsyRgKt0mTJrXqNQwDuXxIXbZfrmtKoF3X17naTwgyDD63txeoVJyG6MkMwmYbwSqopWMAUmgrtx4/hg+ZUs1p6/DHi9R24N54kM4zvk/Xhefy5nU3MtBZJsxo59Y0HfPnc+HfLmSv3fZkzfU2Zulx47nh5puoepdUqIYSIG/M/DXsuPHLURmwlEuOKGPQTVht9xeY2tsrvzcMb7zxhtpSJGw1D2GTTTbRcSCp9Zk+fTrPPfdc7du3+2zt+7M7jg3ZTIGZM4qsMeFzDBu8MkuNGMXYESMYv9Qo1lhhLbbbagf8v2PxxS/nuOLKdWUQJtOgY5MrW12BRliF6hzGo/vu2YFJkfFKMbZb3gYy7xb/i/GNKr4fDN9lcWbRz5hAW4GhrnUoTuvUAujo6hcWIYYAvGz5jE+m9q3NjfqCpXVIXgZUVc5FAwMDo32PJTl7bizJ+NVwu/rqq5tkaVt93K+lOaSh3pH4v4ZTgE8cUh8xwd9QSPGRaM6dnUFeuooWmkboGjDLPwTOM67Wjw+djDG4cglyGUwO4q7phAOzuOEPv+HVxx7mtTeeY+KbE5k1ezZ/v+Ri6loGscbGm7D2+htgtNvv9/m9ePKpp4WaEdZOS/GnWEc+V09gC1JyCIIKgdcVZf4l3X///WqXQC6s98rvsxfGl19+GcVpFrb85y+ryVJ5IwUdgZJKlSGtZTbdyLLJRiW23rLKN48ay98vWJf7HxnFj39eJ6F/jLZBRSK/y7uMcG7RgWKIJiwov9cj3ui2J0iRUsXKXmlUru3AqmTBd61B5SXi0ebjxCnCPFYG1Hk5ksGYJUcJ8cwbBmO0Lt/H88u36x0PVAnDmOXGa026kdFagtdff/0z4yBCfKhHgm4efvjhZeRK10uLWHklQyZTEfmN4FpkxvXWU1N6fZuA+bpawzfrJzNILi95VASpH4QCI4USo1XxoZ5AUf0oLQqGoSzFCIeMIdWVXU91gOVWHsXoMW0MGdxES3Mz6220MW1tg3nq0cfp7e2nrlAgTmIdH/rJBCE63GtNJRJXZL68jEpZa7RGaJeoyZtmefvjvYenn34aHbeI47jWJBrV3r7tlltuqZU/2I9R9x4wc7E+1mDLbLvdKM7/+3pcfPVQ/vr3QXz3ByV22HE2yy3TJQ9jvhwy4RdHeC8AUyGx/STC2vldlPdKmiuuBxkDQ7qgo2i3oJCKU9IqdVFhQdUS8StMEzAmJFPv/9gmp4+QjvnCV4HjNAlwuupUJbXkZcwGWPGxUuljwuqp+Itoa408hzGSbVvrt4T+vAdySwbGPnAzder0zURgqw2NLbYsEClAlnp5iiVA0itxayGyBqIsM2fpnOxrJGwtQ0aShhnwVhyrt7J/+/YPmSMTU/BXWNWEOK2DwcvimkZx3QMPULFSlOo8QilYWUeH4UMHc+U1V7HJxpvi/ww5yIZ87eij2HjDjYWFk1BVpehF7TABN113M5G21KamLElFiq9lqpMev2ifHWnqeOzRR+np7taYkFTxBCtBVCcZiwovvviCLyKK1N4sKhkPzC364u3JSBOtaSQtD8a4BrJpnkCKn5bayYUdRGG7jME0XGkGWR3TIpPoWx5OT6iRFYUIHC7jjYPIvBBwbbqFZf8ytZmNOvic0TyBTlNWb8QVb7R9L59j/fi16lUzHqbWB42vYe+FwaFU+9H743+EAbJ8on1AlGvEBtp0dLTs7Y9pnzFPCAh/4afCwke4pQlBBqx1rLH6SMmDmgxm1qxZW51zzjkN+lpiH7vEYrYQsSuvfCh88dWpW5lMakJhu90Wwwkq3nwXiCMppehvAr9zzYe86m0zL86O1ceQ1c40sHwrnYUKUbmgG4U8LuijHBVxRgMXzvHfvko2S08qzhvJugQ4bWihbqvduOrWR7n/vsfJx2DiLqoZzaVnlVHLcPv1l/PiEw/wzAN3cdpvfkaYy1NCjVEfxmSY+PRsLv/rX1lhmRzDBxUUW2lBdkDK7+dYuKsHwl/Gbs6cDt5842XSUpVAu1bqd2Gta+pbrzJl8kQC4WWkXwaDT7GryFDK07FFrOpzgZXCKRNCOkAgI2ZiS2KtMHKUdEXhXB86YWj+KsgAmSggmxe8qnCuyCBGqq8v473lVApAkpGSgwBAbIQbmgNCf5WcQNY1y6BIJ5zmVGBZkxLGzYgIRLoJCdTPkghjIWh6ca6KM/0CEhF1VwRbxouQICmqT0Iaqp2PPxl5AXl5hwSaKwjF0yYdJUOMNoX+ouHlqZHwjHFRidSWCWRUDTEEJVyQgINBdVnWXF0Fk1Iul1Z79NFHGwVtiX3sAszMgtcS+NvePqm5Uuwal1YNo0ZYGvK9InSCV+7EOgkImKSKDbVraQdPyTFjNlh/zLAyBq3NOLUFqcUqGyNGGYeAKH+4x0lUnTULgIjhsQ1pWGsjksbhfOcHv+SV12dgg1ay1RxmADIW7bjg/zsHdQ2JcK9g0qrMSg8lKfa0yRW+evDhRHXt/OWytSEYIJBhSejR0UI4uwJp2qRcT07RcrSOq6+7hlRXi/4vBL0jJe+WF199le7eHoLIq9mClfrZYkl2Qp40bcCYEKTYzgZgpZamqLeEWdOEmarai6quaP6qyiWtUQ36FTH1a5X1yDPTIJx1CkTWiw+GqOZt+Dn78P9pPnL9OHplVxJMAGXTScWpTQqT6khWllWJgzI2C1XbS6r2VKATKWKq9VpSrFcyk1II1OIqaCK/dECD/DpU+rgf2QaqkjMho5tcg61vhZZG4ZFQHgh5+KlITQG+nxOuEIgIRplaTrTW1lbL2usOYqHI1Mk4iMlqf7dHw9+taXHUL+LyB5xr8WE9ac4Ly2m2uowUb+yyTeTrqmBkoU0Fox3GU9rFqvMCqt1z2tQ+nen1LaGphlntzA0gxXPGaZyECyXnly2oKn6YR/siJhVMubjOWKpBlmjIKJp23Junp/aw22EncN1N9zBv5hQJTRdkyjg7AC7E0kjGNWLLEV3TY6644EG23X47XplxD9/7VT1Dl55FEKYSPClu2VCpVqhoh6oUQ5KqY+iIDINHhLoqfYABBWeLEtxqtUS52Mcll1xA6+BGlhk7jDATUyr3M1AsalwiGE6KLAPhqacd2YSGko4ucdlRjmMqlSpOdqLUnwo/q10+1Bq6mQkoAAAQAElEQVTzGHkqNVrVBF+0ROsWDLQSI3pGYauMr1HYQXMophIXQ8qlgKrwLhUt1Uqjjl4QFAyJNz7ZFCMPJJWmmEyjcIDY1dFfbKS/lGGgHCs74V2VMTF4y1KmrJeQE+8TEwqDPKQ5qOHBx5yc/BoZT7T2qqWaa4BxY/TVLcPneO7lqoxGln/sPTVsQgjFO6GcyYIx81h7rTpcaolslM6ePW8D3itpqvdqXtj2sb3sfwd58WE95bVJyxGYXFyNmLBaVmc9UdpWMVaCIpnxgQjpJs6XwxyPPFqmr5RI0EJsUKfdqw68IIlrzibUMPed+fDJaGLrDZTeYCgRMicOGLL+52jd9+u80ROxxx77sf5mG7L7gXtz2Ilf5/un/5rTfvdnTv/5n/jhcSey/95fYMN1t+OwQz9PEDzPXy8Zzt5fCMhQJJSxe+mpx9hzh13Za5fd2G2n/dhn5/154uE7yOXaWWftwbz68svsv88B7Lnbfuy5857svceu3HrDnUxYaSgTVl6GSa9O5OD992LvXXZiT8HYXe/H7ruXwY0B5Z4O0soA3zn+RHbZ+cvsuvMX2WOXvfn8Tntx2H5fpHNOJ426orS6VTAyAPhkqngNqJFQNAVRVG1OBqih4Jj8xpPss+cO7LmTYO28r+bci9133offnnY6eSlIEs8nmwmolhPKMkC5XB2lgSLNDYbHHnyE3XfZi92E5y677MGuu+3DrrvvyzmX3Ap1w+nSBhGL93g+Gomu8EJzs7hSBowMcaA4Q7dy/YRVwcY48f+5l9rplTE0LEq+FIIClEGAvLBUxr6DddatqL8MY2qzlWKw8g03PFlYNGJJe4vCSxpK/4ePbinyXf3z1zWpDIGrstH6/WrsBS+Uysap6HMUyHqLA0GzAnEFSkVwJsINH0malYX3LqpNif0YKbEVY43efKTJIO4T55t5qyKhWHEDhnzt+4w65Cf0LL0DNz1T4tzzH+Hn3z+bb3/7u3zn+yfwyzN+yUtvXM4OO7zJxeeP4p67h7DlhgPUVSKaAsMvftzM+JVe03ruobPnNgb6r6Kv7wpGj2rnlz8dysnfb2H7bct0dFxLT9dVdHfdrPb72HKLihS+TkeUfjbbqF/tD6j+bvp7b6PYczerrfYy3/rGcHbfMWb/LzmKpbt48K6bePm5W+jouZb5A9cp38/ndiyzz/6NRNFMjLy1Grm8Ujqn7wRsCUxZ75ig0MXXj16atdYdEK7309V5tea6kc6Ou+TJ3UQm/xjHf2s0y481IPoEMqJZGe2kWGZ422y+/73BLL/KdPr6b9Q6b6F99o3cc8e1PPrCJKalQ2ncZn8YvhypDTRnCvJYbJoSJBUMTt+L4dExLdRsPsfGkFlqHBRk8SRrUyc5ejsLQsKqh14eJ9HKOUuYFYbyyIwbYNiQlLVXi0B+SLk0sObdd185Qh9L5GOXSKwWInX77bc3zJ7WsaPRd1uhyoRV6qEmpBIO4xYwITUYbWPeepdLOV58oVOWGVmHCLPSqsShPAf1cTVmaddT2Uiw+EiSmK65a6CkMAhuQkA5U0dX1EhX81KU1t+dzJ4/pPWwMxl/9DmssN/XcUGVE741jpde3oRb7x7Dz35elrcwnyGNc8hI2AO55Lbczuc+18FFFzdx1bVLc/V1g7niqmW5+LJVufLKkeywZT+rrzidM38/hGuuW5brrl+am25YhWuvGs1fzsmz8Uavs8mmb3H2nxq56Ua1X70cV1++rNpHcu55BQ44qJ+Whic59dQGfvnzCcgWsc2mgzXPKlx9w2iuvXk0Z5w1lBUmTMcGs0TrtLZMVPLrBH3LODjt4qICaeUttt/V8YezlhV+E7jxxpW45uqluPaakVx/w1iuu3EpvvrVXppaukl07LC6rTHyBkMdkQKmsee+vfz94jqNaePaq5fmsovWYeVxAa6xgZX2PZxo0z3odfU4m0M/IDxCYjLaODxrWRxJPLYEGG0yLjJUCiOxg8bgDUVVG9LLL6K2JmUHVEDHH2NUVjBIe5NGOhrqKuyzzwr4fwU+sK7l73//+74nn3yyZQlMSyRSi+j0wMNPr0bsWjMh2pEyDBssFU8WteotuuMi/P9dSYac3r48zz7XjbijnKF+NQ23eYzcc//vWSQSZJSszvx6fehHdobUBIJjlPWkQkgC5GQkYkXYymGBjgx0NuXoax1Gsa6ZyU/cxbJjQ7555LKMGDKRtkFzaNI5HLnYRkFXTAkn1zuU6w0JdYU+CrkZNDfmKQ5001Q/n6ZGS1gtQI+jKSzRVj9Niq5cN5NB9Z3qm2CTPgngAM31VZqzHTQX5tHW2kNLvcp1RcntPKxiNUFcpCkvGgn1hkJIfb5dY6TEuU4Ff9VP+IAa9aDkSHG15Rq9U6iVQQDVbQrNgyYzqPV1rekNWgbNoG3QbCqlqYTCM8r2QTqfTF2CKZch0ngPLLZaS5nBikMMbigxrHkGKyw7k8MPaqE640V5HzMYkHueKosk4OMfJiSVkhopoCpYLEno+rldbc4K1exI8iNWxwn9JIHb77MK9jYtQCVQhWIkOG1Ivkb0s8qhPIaNNo9pULeAJOrsnLPTlClTMr7Lkpa1rCUNpf/D5/lnnt7KpdkorsC2O4whny1hpIwpCyTSeMEiK4ZYgijD1Gm9zOt0arXYQgN26DDiICNV1TK96TYONWIUEJJk86GT8XAX4eI0T0yQppJVzVMDLgUqWFIphgkr2NI0ynOf5cufH8yg/BsUgh4oB7hyG9ghkJEVVDTe1MfIoik4aEh1JRYFy3DxBXmO/3aZQMoeZNoxth+TqSgPEFcq6FxFYjpJTa/GVtRutNQYa2L1KREWekWndrAV8EYsEu4RUto6kSLw+5xiJr1kdR3s+o1uVuq002WR66X+gbJRRsmvTWWvEfrCfypblUOrtcfCUdeMVh6bK1ucrjYnvjiEv/6pRBiMp1LJakgGl1FbtkzNHmbyBApKuspggmorSSnFZrv42jdWYqmhVTqe1LEk7iEvnEMJg9E0KL6T2oDYa5xxmn0xPAkk2lhST0MU4HWtMHbDGp0zLuXex9uZM0/G0+MnEmGhJqK+rKMsiRU9Kqy+FoxZOo9LK9Y6OyZNy+MXA/YfeAqh/4HHLJYBTz75ZEFR9pWsCbzIscqq3aJ1jKQfXIRZRHUJurGivgl54gkpQGJw6lk3aDDIQECk/qqT/KRGP2KlM/ajWYPHwQmWpnc1iU0FN9WG6DDCC+egO1ZgsZkmReyn3ng59ZkSe+2aVb+pYLR7kmDqZ0nIpwvvKopc4WyG1N+PS1HTaBhn/amXY4+ayIgRgZQ+QxIX1d4HkdYrZfGR8MBkCCLnh7PIPqkJZHASl5CkmidwhNqtTViPJsJJYJ3TphXkhAWEeQm26ZaB6IJgtm435mFNP5iYBckbL/WXguBpWFt/gAI7aBNUhkhdQvEjpb9WlZqUCRNGcfnljmO+NlW3EqtRLo/UtWCBspYb5i2J0xxRFybfQTWegwlSqsWqrn+nsfs2oyi/9hBNPVNxve1YYszCeVNjiG0gupkF6H3Mv1pKTfz8mhAesQtoHb8miJ5GmL34Yh9vzTAkfvPxKFkQiixInk4FjLBN42nssVsbTrgnKa1X3Hjtgffcc48ot6DnkvIr9JcUVP4ZjzseeGBIb2/nxtnMAGPaDCuuANZzhxSbNOCvsLxC+jOvDbMMVPI88WSOStIIcRNu2eVwoS9bbGrJxkioZLnFraqE18sXHzIFcnND7eyYBKIKaVTFC6xRfUZGKtL1IhntpFKU7NRXMM/cytf3zLPc2AF8PSYkYy2xXE/nldYrnTcq8gScbVS94g3Xh3z35FkM6Gy+9LgKoZQ1TMH6BaQGG1p8CgyiSwBVi1+vUXsYqEU4eG/GJhajjGgBffj/jJxRtD+TdKpeRsZ3jQMypQjrwAh2EBqQOIPVSxmnr0RZxJThMzKMxqkJXyekagZD/fS2QYXIv4HmUWW50QGXXtLLl7/wJt3zxxCoe05wjVyHgJx4JmTNAFE+Vm2ksRBm5nD0UTA66GXupWcSpr1U8jrYBJaCLEvWG0nqNINR/vgfq/UmQUIqvoWiVRp20DesmWjprZGOy1wYbnugB1sYWzMQznuFvp8FiQPONYh2KVGxjx22ThnZJljO2mJ3cd/TL/y+XMePfw0fZAah/UG6L56+Ci6a8889dxsJXoOOxey06wiaW6yIWwYrqRIb9IEojf9vNCRphc55WZ54ZAZiA5iI3HIrULFanjRE8NRVZSkMteRqv2//MW//+I/LfpSyBye3UshopNErlDBYEu0M2JBctY/eF28in5/D1w9fDUwnBA6ntRi0Q8KCZZkYtBuZIEuq6PacWSP5wQ/eoL9Cze0fu2wLSVLSWjSh0SBfkrFbsCyHUcFnISA4tQ7q5JRZ2GZrbw1TF82PFNJpTok2SgvGWo1dmKWm+M61zMLk4S3KC6vw3yprfhb1VZWrWi3fexpFWodCtQp33TuHs855g2o6TPOoLdH8qRo0pTFG+KF643/Alhi1bI7P79FK6a3HaSrLq/B/5SU6JWEvCzqLOLxj+sgrE/HLM8rKSFgZVuk1xShL20priT8BYh333RHT1+ewClim1QRCsxCPAIJuPM5hJmCFFfOst94gOXYiUkDL8/fO2pYlLNklDJ8aOqecckrw5sSJB1iiMJcx7Lh7q0SuCIjYBmpnPuMwKap3BEGGt16rY9oU/61+DY0Uxoyh6NRfO6tXg1SC7iR8SJCtMv+S3L98/yefcsJJPBIabLRDWGUjCYmtJQ4C0sAQFg11HVPpevoSNt68wJChswVaRk6/zkoxTIz3PoIk8qgp53QsaBDcwXzlwMnM0OkjVV//DBs6hMQtGKuF+6q3ZfO28mIovt90aSD7HWCM0fEkoXkQlORJpKLNb343nbvvLOBMG0QJng4u0bu2vYYaUyMoXhEH+iZx0CGN5JJ5zLnzKhrlafjjWDlTlFkVzRYFTBfDkpHXgDaBMAlUzGrGHNVcA3b5ZbUGpyAxvPp8L6+9BtWyw9arSzXWMgLwXqGVbKoKHfFc2s0ue7bh/+oycFF25sw5e91223N1vnlJyXZJQeTteMRx31LGJMsEGIYMDll7/R7xZEBfC3v5gJCU0OjMLHnDuAYee6CXJDW4TCyvYTzllqESPi3PJfiBCwyD9UWsdkv15MMmZ2R2lK1c7EhzB6nFCa/aXFYCrglGkKXvrqupz8ziJz9YmmxW3o3xZkWN6iupEf4GtBbVIB+fNGjgggvm8uwzReJE8mIytQ0oCGMCa9UHNJH/WZj1WtzPguW966zOK7oNUHSROI3x5/RYNCrJaMhO84tTdbzoG0TsLCYEY0UDJ2XXN8hoItpqjiBbZfy4Lr68Wz3JY3cSTX2TIJWB9EY/CAnUh8WVxGtMSiA+G6/sTsYhKlAZNpRgmbGedczvMtxy83xs0AypELPKvq9fkx+vTy0NTDcbbd7PCepdUAAAEABJREFUqisHULWmWmLDb33rUIUqWWKSR32JQEaiUcNDRwBz//33rZEJ7XAnZ23DdYfQ2NxfU2in3bjWySQYKZbxwqSKRPGGx59MSMigajJLr0i1we9KkeSsjDEG5yXS+OWmGPXUsA//eHBB6iFLYIzggjcYxmoOlxCW+2kZ6KT/5fvZdJ0mVhgzgPWCrZmdDwSmcqslaOhYhBcem6EalJjbFfPLXwxQiaUQ1GMzWRkFZPxirJEwafyn4TG2LEqnwtnSq2tXqTtGbnZvyfDo071cc20v5USxFVHOGcRTT1CfHT4ZY8gEDuvmc+zRK5ArzqT6zF20JBVMfyS4kegearTvvRiyxzFF8znpvT6QfOlmpdLSRsvqaysAW6fGLFddU6SnrxETWEjFLy3HLPIaUJVOUaEM/dBhney2a558EJO1JjtlymuHqXmJeYT9J4WLJ+7/ze0WFm+//cLCw4888YNyMbb5DGy3Qxulvn4CCYmR68mijmIR2mWcdqMpb1meea6dqqnDybUPxq1BkZyaQ3EiRb/oQzOIUQJgifX9D0Cq/y8f888wUr8kTeb8UcFVaNI8b93xd5KON/jqgW3UZzq9hmvTD0hlHIy3ZN5j0BjShDSWsEV13P1AO7NmOJlGj1cVl8b4fxG1IqVKYj+nZ5ufbFH2/Xy9fy8ZOZVZMEEVK+OZCXO0zxHO4lcixUa8S5OQv/xlGrAMqYyk89YhFMNFBzFH9VpbkiXWscwWLEMGvc4ma1h6Hr2A3KxpNNaPwJWL6IplQV/9fuyPSCwxxB8lq2EiNCsYGfR+kyFcZ1PIDpUM5nhrSplpb7YS69rWBB4rWRR5krU16lNDSMsJabXCfl9cljoFWa0byA309W7z979fNVZdlojHfnJYiNLvMPkPf3jGCpKPcVGAWXpcjs22qRLpGGEkK8RCdwGdNTLFB/Qw9Tz5RIW32h2pAj20LEtu2AqU5fJBAHEq+27ESGV8FgDZ/VpRUD7c4+EJNJZEqCUSAPzf/icDFOI+mrvm0fPEpWy7ecQWGzaj7Q4yFkcWFwgPU/aDQTcR5DyMkFJ5OOeerSOU4FXjWGhKAeKyxhjmzetVfxkQKRk+q5V/pHem5z+aF3dBpHHC2smYxcWAjnZEpRx4C2q0drW9+mLMlDezJORlAIW/N/5Gb49rzaPKk8kWdH6vUj+8yq9/OUF0ncbAwzcTzJtPIH5Xq0VBWjjGj/sYs4lDrDyBqnb9JFMU9cvocoWq6qsjxhItvw5plNAvI/7HMyaSVobjEuFmxUe/ZLMQuRiCKMJqvSOGdbPVVnVkdAUVWNN4yCFf/N6Scq0pEVyI8BLw8keK2bM7trDW5lKdWbfachCtQzoJoxSTCEGXB39+045rkHFQZUKd3NMOkjCCKGbYmlsTR4NIbQ4EI7RGTNB4sZJa9r8pH12yNVCJhLqm8BnBFh71Oj50PfsErmsGh355jNzG6eonf1I4OamJo4oxkhJ5F2C0mpSyBOnVl3O89Jyr2QtjIoJA63ROB6YsLz4/nzAogIwLElI0jn8kCaHU5B+fn3DB2lCKEYCxTHmji555ZZnqJvA4G5RSKmXDeec+I88hK0UXHcUrMVht/lGnRPyuWFLB6qOf5SdMZ/M1MvQ+ez+DgwF5WiXIesHw/T/+HMkIBDJaaaA5oxKWMlGff+fo1GZUt+7mwkd4a6VXX9vHzLcCTOj5Aka3Gyzij5aaVlIdifIEZh7HnTCKujoreGkuteUtf37an5ZiCUhCcwnAYiEKt9xyS8PMmTO+EJg0tPLftt56KCQdxH7DFM0TKZYXNmkS/myfWMe8dsOTLxclYKgpwa6wNtVIQuV3qNQRZXOU5ZaLOyxiTmoETF8f+knTmtFKpbq4UOCUkxJBDLavk+4HbmTs6ITNN9Y3usZK1EW4Gb2MjAPOF1KQYYnlPeTq6rnvnl76e1Nv15Ct0LoS7SpWQhTwwouGhLyWL0PoB/vx3h0HnEnBZ4mYvkC9kBHFH6qMOvqMn1lN/ql9+8K/ZO+R1Mapr4fns4f19rywjxOM1Mp41fpY8PVoLt9X6CDcgqiOF1+ydLQHOAJNltbQFHSZxRxXXFahUsoRy8PDK50MvjrpEZxa2YkGoZQsQxrM4isHDcbNm8jsO6+kIPo7XYMadbUuxWdfpkYDP5ep1QUKQPMhk6mNd2hJOLvgy/g5TSpnMMDWtZEutxrZEcNIMk58gtvvL5Fqk3Kp+uvo5EE4zwN9ukBrrmYxWuMKK8ZsukkTRo06aQx/45VXdz/55JOt7/9J5k8cgbcv/pjvfWedamxWtNoV15qQYcP1Z5GpxmS9VyCGmKwDK82TwHvDULYFHn02yzQdKZyPXBca6FtpVbp1Y4EXiNhSlGteykI1SJCU4aTEFZvBYd4+9X9VDmV0QhkglzYJXoGoGgm9lCgVHq88QTDzQU4/sYlBDVOwHm9R25+TrfN9NL/6EahSu4tfIjTz+uu9VJxQVbP/ryClUgD/tx6p8H75lX4mKb6SSMmcjCcKehp5FbH6VuRdaZgGZsAJpjCqGayFO5Zvc7U1p/wjmXRB0bgFbz9GtHWK19TG1r7V5ts1j4gn2PpWvIAkSyKeVCJH7HHx88SaO1W7+ppqipURLmv3v/chGcrEEpv5CLxgBDXIJeHf15MqHqHp/RxJEW8garZJRoegA38Uy8X1ZIuNhMay1ZYVNl27j75HLiffW1F7nVblRPOUUPBsTXuFB2K66BC5Cj6b2oz818lpZCUqU/KxhmoOig1aT4auQkqJmLgfqoNGkV9+Q80U0xUEnHbZDGb3L62RMiqVIk74x4Ehkd2yNpFRgWwSk48m8cUDGilkDdoRMm9Ne/Xr06dPH6yBi+fRtO80kX2nyk+qbsbEKQcYG+WcSdh19zYKOtAtQDARSmKPLYEXGtsgGXIk5UbOPWcKSU2bHIXltiXINqqPUf+P/5G84//mwpo+TZZQDXtxcZb6ZC69j9/ISstbNtt0qHYESxyrS6i3FAdT1Yd/tDopEFqa32qcpObNyZ0SdrX5OtSuIr5DkGHyGwFPPV0hDRSTMJFapADqEyRZvH6apEFdM5Dq6OE1zA5A6HGjBtOYCu+bPG5GSmo8wga8ssmVxsNzmjORYkjpULYyEp4d+DWYlJobhUdceIUhqep65jdx4w0lAiPeIXw8K/E/gm2rlGPH9BmxQAQ4b1j8Dqv11MDg+zhM0IcRTla0K9RXOeTLS5N0vEjppTuoS1JSQqo6eiQIhnEL8PCbg4AkJiA2oUqCxUeVPCyfF5BnEdSyaFW3+jbYwkiJaZbXXnLcepv4acQP3dIkJl/bPIQMpKKRET1sQqmYssU2o1hjnQyCapK4Ovruu+/edxHcj/0tkr3THPadKj+Juquuump4sZRsatLUNjVY9txnJEnSByI4EjIkjE6E9MH9tJpgTYZZUyLuvRuJhkiabyCzxu4UK6HGLJ4VOGNIdYYI0blHBo2wRNbUkbxwF+lbT/Ll/QdT36zjhIgf2CxOR4cwCPg/4yAlkbI5Ihk4Q2AzzJtrvICwIGkgPoOC2zIwWa67posw10IslcBlQIprtWMG0k1Ui+0BW1Z9vUCoXb94oknhjGjoP987V6kZEW8cfH9vEJwEGWV5LxiN9opuelWs1oySFQ4IPqrBgg/Kpoq7pLaOZ57K0D43Vp2y0VpkAH03p47OOuRgML89R0AdSPnRHCYR7t5I+PUYD6+Isf2aS+PjXrbeup7hY4oUH7qY+s5OMAGpDEBijd5O4Cu1LIDEMqKJx52PPyXCoW/M2hTGbypeB8LXcukl3drE2nCRpSJeG2O0cpS0MFvV25EvhKTuNY48ZhyKsUqebTRr1ux9f/az3y0+70GY/Otj/7Xik/hWIDI45ZRTdjOpG5XVBd4G6+doGvQWoYwBpOCUUwmPWC67QGz7QEePRx7opSSZc16Ah4+mf4W1pAd5LUGE1+/H/kgoESsDjx9VYReSLffQ/dB1TBheZt9dM9hoHsiAIHfSSUlNlFLTOetwQRlvGEwSEmbytfF9vajOvAPqBmND7r+/yLPPFfC648Ki+hnlWJu2jI5dsBNhK6rLgaeZ8+0J+HeiHUwt7/24tzX7scpGdaYKgXb/WhY8K56o3gmm1dGBQIgHHh9Lqjb/h4z9peGcfeYkGTUk/IvAWhA4/+PpICjM74hJFOwzGfUxHnfBN2oRjWqapHmsDCCJH5swuHkWPzlxKZJZz1J55hEyxKA+WNFAb+uq4kpZ9BQcGV5n5fHw8Se/rO5cKy0bfl60qtMeEPD440Wem2ipyIAGWoMJLJ4V2H4wwtt/JAmpaWeDjVImrGzI6ChZKZdW/+tfztwbtAw+mWQ/iWnNv0y60047Nb766qtHBZTDQh4OPmQIuWwv1nniieR+gLTBiJBJxWByMaXKIK6+qpMob6lqd8ivsD5xYyDCG9CQf5ni4/k08lKSDKnE08pVzpTryL31GO6Vpzhgt1YGt0kAqAodKZXrl3I7lRcYhziRkEQJNQGxljgBL9yJx91nfS56nGYg6KLqepknW/PTU2YyoCvPOEoEvaz1Cg9pUSo5Kg0MolgaTBz2E0c9pFIwp2syUD/hiPrwnuntIiFETIyTsfEzEWgq5UReUBKHgpYjrTZT1U7vTwRoHS5toWpyOoc38OBDGW65syjstTOmRrMugAd1tbKJfF1GbrWhZl/V7BTDqNJDoneSqlvNACNZ8BNLOFIrOnaz81Z5xrTGlJ+6joZqtzgQyyBA4BGxaJUxVhj6EiqxOJLRJCahsowCk2NWgDShJHt93M/bGYgbyepYXEkSnAtEU8m2x8tFOG0ckXBubmzn16euRS5Ca0wVe5h8yOWXX97IJ5SE0uKfWTLwT5P+P/b+Au6Tqvzjh9/nzMy37t773u5i6e4UJCRFCSlFVEDAjp8tGCgKWIiSAoKSAtLd3b00271797cmzvM532VxRUoX+L+e5//MzvnOzJnrXH1d5zpndqGnp2fjJEnGhyY1q0/LsfOuowmsnFIBJCujiBK8lKrfYj7CSJnTX7Dc91BCLclwrV3kp25NbAbliDGNMXxQx0rcK5Kdycu4RayM3t5fY9ltpzO8rZ9dd+8E291g3XhWNJtiJEMGWVIkM+0YP9MFSh5ZFS+vf6+JRTH2FmYJNaMaJ8fKc9cdZa67VvqxPhBzJK5FdBwDlaEc/4N+5ry0IantJFZSSGxBiaeEn6VTP/sL0rPz9k20nQLRK9GIWSOercPnwdhYUmOUDALSXKuqtuH87jcVXnqmCxNFmv0zUglQrtQpV0dz0m9fJEsNqU1fJ2devyqZCY+rO3x+aG+T/nwSErm0lmCKopEYTH4IqCoxSghWDZ+dfJJxKUPaynzh4OFUZ96LffYemgeWKjlYsiBP6ozoiGdSvE55V5l5nw7RTWK6O7po/the2GJROtHXtMcHWLh0pFZ7DpsPcJroPEGnxAAWo30X/1g0KLoAABAASURBVG+Iktoy1lp9maqHIlIPcVJb84QTfrGHEoQ3iB/yoTb7oVJ7C2JXX3116Zlnnjlcu/JF+Zc2IodSq0wn0CI7MA6y1wfZmirHEFOTv8RD+Os/eqnK9t5fojFTCSZuTk4BahQQAnx90AdxMW8gFTdQGVCgQEEOmJ/9DMnjt3LQx7uYtk4N10hwOb2xOONwnllXpNw3lKfvs2T1ghw5gTBVcBmcS2hrQ3CS+w0q0KCYoRcWq9m5r8/ykx/O4dmnOojCTmyuRWFgQXX5woXN7LPP7Tz4QESSSZf1TuqVTgiaFaS8++EDq9E8qHj2aA3YQBKmSjJJp3gezmB9NSWGbs44s0fPY0jKHSKfI07LNDcP55Tfz+HBBxMSJc9EZYEJhE9LQf0qHDSdehElU+bqtLamkq2KES1nIImDRnJ56vFm6SSnd36UYFTBUNS9dJklSzn4wC4mdnUzeO8/GJ4MYAZVnYVaOolm1iAoIkokvOFEGvsBnkZ7JpFyeF0TQWGTbcmGT5BuIga7HaedNZs0HEJWc7KnW86FEiLe2j4RSheReO1o6+UrXx2GlIQScvTEk0/9SjEiAy4f8mH+yhwfJrn/pPWnP/1p3XK5um0QBKa1LeTjn2yhpVUZIAkxjdlCY6RL47NClpcu87j6BK69eYmcX44TG/IyRDU3Qp+75LwyjJPCNeoDP/2nTKuklaJNxyxl6cNX0Bw4jji8SMYMcWEwpl0OLp6N0VUype3cfl2VU0/WGj0bglO/MXqX1qnVBhg7PpBDyVMMrx/Lb2zqHzPJnAh3kdmvWr771fn0dY+iVp6DU9IIS1X2PGQSS3tqHLzPK/zkOymzXxlFqThNumwmVLISJY/oTU0KfqNH98bT91fw1FPZIqm0ERXWpdI3iSsvbeJj2z/Kyb/uZeyUZsZOm00YxfLnjDAscd2FGaf9tp9M9opyTRonPKEDvzHofPDGupcuNCK0aPmlxJDV8dkrikKsHc4Tj4Z8/ZjZShLiRRJLAIhqulPCCQy26Bg7oZeP71vSV4vHcAtmUQwisqrglSQz6dRIDksCCjo+hMNkhiZVOjYpszDXRvNG+nJhSkT1HGef28tzMyNymkYM8m9fnRlv1FSiie+KJbQGk/Sz217D2XSzLvmGFEQ29NFHH96R/wcO+/8AzX8j+eSTT+1rTTrEaRNm/32GMnFsopmughaZasFyWH9RaYuUn2aWy25YzGtzHbI/ttRJYdrWDOZiUl8262uF8TX08pH/+68zcioRFi6je2945R2x5WhcM6irPxdZ8rUy+YVy5Kdv4uMfa2XiFBlfhnY2rwCR8RGvgs2Mpa4Z+P5HcjzypCNNJ8oZRCNzYJAnxEyZOhwvl2/+X2EaDFa4AppEV09yKP3K5dt58IGMQz/zHN218bigDWOWsfm2c9l2+wLaF+WcP/bwsV0e42O7389PT0y4+OrRPDJ9HH2DW+Dshrh8nliBZrJW0QarLwWxnNaFBRLTRRKuwazFa3PbfRM5/ew2Pr3f03x0+8f55pef4dVnHKWS4cc/HUmx/SXS4jIqWi5d8Y+Mo760kMEBQ6K4jNOMejWSHgBTF48xBlRD5RQUTonD0DkKRBqnhYHTfoUR/VtvH+QB6ai3V5WXL7+NFQ6HlbqUPSERLreAg/cdQmdpMbNv+RtROcGaTMgyyeKwqaehCUX0PpRTRnP6ghSKhzjXjN1wL9yIKZIqo1pxXHi1/IIWxBwusRhrcamTPprEXgHdYHwiS2dx1GEjkbpkJ3Kvvjbz6F/84hcfevVgedPxYT7+6lfHjlm6ZNle1mVRTjPLAZ/q0sb+q+QVfUFOnmUdmYJTXoNLpERx2++G8Juz5+sZ6iYhP2594o7VcKUK1aYKNm7GZN6D3g9JPB7fDCLtbeftKseWfYFM66C6Zsr2qgL9jstpM/P46tdbibI+bD2PcUbOXNbYWmOcRlAl4ZVFZRb1xFx43jwyBSYUMTFKFovZaruAYsHoQc3lsY1ocLhM+vAcmJTUVBBqKlnErXeW+djH5nL73V1QG0N7W51f/nYkm24TKHnB0qUFbr63wrHHL+LQw+byib3nsf1HX2L/fV7jrxcPUFFyiIIKE0fCkPYaptjBY48FHP+LAXb+2Hx22HEm++73El/5zotcfE0fT7+akJmQXFPCySdNYvPN67h6KwvnTeXEX1u+9tWl9JULyFySp0qaVMV7KHtJj7KXrCa9WOkk1SwKw4cFdA1XEs2FJFpK1h0sWpxx/Y09wmFYuCDD0YpzwpEBKQo2q41HK52VWXdynf33KFF++kbswplESUVaqkjfVuoualykQR/O2bCJ7JN4OZXwB0euR2nTXagGTvzAJZcsYV5PE6n0Z/1eUz0TYxIY8ag+WRmCTPXVIB/fsZvtNigRGEMtrmx87rl/213AH+opDX6o9N4gps+X5oyzzj1ALjHCJQGbbh6w2uoBNlwO4hNoIzFIOdLW652G+YuGM9f/34XqBprGMuKjn8bPNNTqYJpw+lzo5B6s6mGcMChiFczeaKkSVWrlm9aQiKdUDSr42T2/bCk9z97M1lsX2GiLLn1VkIPmqhgT49Kq8AiXTjBKBob+wZq+tjj+ct6rlONRpNp7MKqKcrkBtts2ZuI4S7MpQToMJ5qq6uVQNd2nChQaV/+3DU3UJ3zw0tN1DtzrOY46qpuX54wnGjaMY0/dlWmbdJGFgwTiPYgcfjsm7U5UVfSwzqQ6a00YqSTmWGODWdxyyxi+/r1mqPcwsnM11pkwmuZ4kPLiMij5RVI3xuJU+QxIlu8fvxk7f3I15i4o8dsTY3bf+jVOPj6jpzcQeCZQI2lTiVxRq6OBoI04H+QZ/k+ZZk0I3//+SPJhP6nK6kCViFXo33I9PCeZMqC/N8YaQ5omBGJC2xfqlVL0i7QR5mp84fBxRLZK9emLaKnX8P9vzbrNoyISgkEFZtqA/sB/nMPaTD6YoQ0lMjlx1wY74nITSeMC819IuejvNeK4He9PBoeJQpwbFJ9KomY5h37vqdhU48vfHi3/cXpPbs6cmYdfd90FrcshPpzfFVr+cKitROWKK24dMmfWos9kSdJcUJXwnR9OoNg6F4xXLlKIkXPpKgV6h0gAk+/g7LOeJ1vqCNMCpmsj7Bo7ULMWG4ZkSQ5FggB5Xw5rUowa4gmMTplTjuoD1jdsTJOrsPju2yiVX+XoQzQrlKdjm1JtlopjbRQonGgcTuM1+yE8mQSKTcDDT8dcenk/QamVLIjIYkNLvpevHD5UE0hZ88kSJJh04fWg5iuizCeNIiYwjcrA5A2hdsAHta69+FLD5ps+qe/lD/OZQ+7htZflWKqkWrCMlludcNxUbrtnLe5+qIMf/DzHuutUyJk2XFxnrJJF25AKQa7M0NFPs9d+3Vx23Wo8/PBkLrt0Q/bYtU0VUYDRsiMh5Yxzn2SzTW5im42f56QTenl1vnqDKqnPQFZ2QLDocGqC97rSVA9enyAtwIihOXbaIUdTsSbhHCYXsXRZF3/6w2xVDZr1cWQmkw5SMs3EinL+/TB67GPqan3suOMQuh+9iuLCp8kr0UopOCUTQ6yN6rroOcF+CGfg6QRI5ZI6YaBjEqXtPw9ZB3nZ9+8XLiNXXJN6EiEDg19ehEoM2ruSuIKzmCDTbT/bfnQJG6xrCCVIpVLZ5Hv/d9xeznlH+hDkEAmr9qGfXsCzTj9t66yeTLHOmNUml9h8s7yCYKmaFOP9QeY0JpCiwP/Fp6DUxIxZNS6+rI9QHLuoiXDdbZlT6NLyQs6VlNUbYHMpeIdi1Q7jMgyJkGRqOq2aMfrRjb/IfCapUVg2n8qjt/KR9Rw7bRtgg7oSA4R+aVBJwVg1wBmCzBLosVAqkZo8PvBPOGkWTyhJYNoJbRMmqbD3J9oYO9qQs31kqUGMLG/4wweeD+ghkBWJlTAGpSAnuklY0X6CY/4rrbzwVMZgbz/tTRW+9s3R3H3nOI78vJYPUxJK7YNkYR3CFhYvGcFjjzRz47Uh118Vcv8jTcxa1EUcjCTVLDxyREVLi1c467yQK68fztZbJpLD8cLTjlkvd7K0u42BuAXNfQyamFgJMA0HyFwsZgtqklMJBRQ0NsMYXb1Iakd9qY229vkkSR9EAeXB4fz0h0t44fkYq7IbRVixyQhHqufGRerUs3Spp8bpyMjnl/GDY9ppK8+j/5FLaK6JpsaiMtRoUzTQDN4A/qB/xFqcJmCboVzHhBndxTaat9qdrLVdvDumv1zhrxe8otzV0tg6yTxP0onV1Xg9OfFu6jjqFPI1vv+9NWnWBJCzNnr2+Rnf+/phX28TKHwIP56nD4HMv5P47ne/23rn/dd8z7qo4EveL345InCvYWRoD2k9V1KYIgMTmIYSq7V27r47YuECx6ACJm1qpWWrj1ALA1xY0zzlnTGTc/bjSD2aVWpGWGg0oTHG/4ARY5noZJl4TWlVcui9/2Zs/QWOPEQbT1Z7DWmGtQY/05kgZOXDykl9+TukMyIRi5V6xNx5CV89ehmz500kSeQYGtI+dA6///MQWpsDCgr6hlrEggk0yPZCoGASBy7tIKvra4gCIEkdTgEVpDmCJNMuxgAbrp8ooIfxg2NrSjYLiYq99KZLePSxYfzm13k23/g11lrjOXbdZRYH7DefA/ftZbede1h73flstunz2lOo8cQTIUmtmZYgz2Yb1LnsH118+evN5AvSg5Kns3XSQMnAOkgjXDIUEoMxkUS3KObxerSuWZVHEwWpUJU0e+zdzKFfbKNQ1P6Jt146igsvdPztwl4l10gi1zQuo61Vcgm3MXr0ZyMx+AffwAifdYNsuVUbW6ybp/eJW2jpX0akZQVpKN/J44znZTk8H+AhDZAF8kdVtaHxlU9CmgsoDxtOYfJY+sRCRbo586xlLOluwkluYzJx5EeuuEggwRlpIKcEsdvOlnXXzhO42KZpNvn+6Y/u6CdXQX/gpzj5wGn8B4H7Hnpo48H+6kbGlM3k1Qz77DeCSBtXYSqtvAEthZlETxmZjBuGq3H+XxfjBNOvKsKuvyHhiC5IB3GCc5qxkJ79X0kGjdXI9+V0HpfnS6pSUsAYmTQlSqu09XVTuf1ixgzpZvs9NVuk/Q3SNo2w2vvAhOCHosM7tXCFZpDVpqYESmhhWCRWgnj08ZjdPvoEy3rXpKb1Si0rs+XOhi99q0klMoTKCQVXJNK7YhGhLBMVlgHdanU1EXGBPpkVKNBEmNXZ5aMRV1wxmo03WSJeyrjaxtx97aZ8cudlfGy72fz0Z908o2XHQOoYEN5B8VdRtVRRtNUcPPNSyi9+PZcdP/Iae350Pj3l9Sn31Glqyjj2B1384oThdLX3E5hmrA1A5/KKrUc2aVNyjDC2RmZq5HOGUHwFbgg5VU8bbxBx/K90XxJsaMiCSZx9TsYxX5pJPY4kT76hR5mZYaPblQCr6nNgBZsZ3fumZ6PEId0g2ZOeVzjyC0P2143wAAAQAElEQVTJ9y5k0b2XUFzc3UiSJueoBXkErXEf/On/vYjnh0YFID5VyVZNwpQD9iVplmy5PA89XOGJx5ukt+EYIwFMhiAxuiKdIVsYyRkkOajN4pgjR2OwgIkeevie47///VNVNvKBH57iB05kZQLnnHNO4bnnnjrIBIRqSgzjKBaWqJVwfuZ8w4q6sSmplJRm7dx79zKefUqOZgsQtdG59cfoqdXlgHUtRXJyxhZMlgOjcYb34RASOR0Ip7NyVtMwkM0U2HGZkgze9+gDRN0vceyPOsg3vQx5warUz4nnQGxgY9nZKUDEjsehi3U1ttw8L35TMtcvvIGqnRZmL6qx3XYPcM3Vq5NaNcEd/qXR/O6UUUwcmifIEvK2oI07Q6TZKY4zCCpg+zCmKtfRs75eBLafnbYP+fOZ4+jomE+WlXjttbU5/Euvsc9ht/HoE45y0kYi5acBpCaPQ8FsLcppZKo6NEmJU0PdGiqi9dAzsOak6/jr+aE+UbYThcs4+vPNHP+zSbTJdqF0IYSSRcPCMph+8STeTCbbGJx0Ftkl5KL5fGq/oZx79npMHJ0S16aweNFWHHboPI798QwCJRHNj6SSPS9+Pv7xJkrFBOOVaQDtOxh/1S0svzGCQ5kp6Ej42M41NlnPUr3nb4yuLaJQ75E8A6R5JWk+jMOJFS93HZz0Knuo7MKpfFrWtTr5NbcGTQaB9Hr2mUvpH2ghsQF+wnvdScAkQKTEYTE2k84G2WmvKutvHGLC1DqXH3vxhX/aS0Af+Gk/cApvInDppX9ffdnSZUqjIa0dlk8cAGnSjYkDzXARTobWDw3bK9BTVQS5fCfnXzCH3n5L4t8PnUB1/No4Y8jJAXEFOWC7AkiJQ4rlfTmsDByo+WvYuBrNssr9mskTsv5eeh6+mzWHO/b4eDP1fC9xkBPlvORIG80FiQJdDqPZEi+QKo8gi1U5lFhvnQLGxPL3OllYoR4Y5s6L+fxnn+DoLyzm2cenUKt0c+Chjr//faI2p4rktYNtsThtMoY0iacGVgz+iEjMAOOnOH7754m0dyzEuSE8cf9Y9tn3CS64ej7dOOqZhnm9kuGWDwQlF1kBkxYk23DN7i14B85UslQVkANZF93VVo47finHHDOXvsWjcdXXOPizgxz9NfGRCFHaIcQBQit+MoxNybQfEtoSgbFMXafESaeO4cQ/D2PsuCpzp+c4849z2WHre7n2ykGqtVYqdYOJMgLpwpqQPXedRGjr2MDhc4BLxaoxgG+8fsg2poWkUqbQVubQgzuhfx7LHrueVrQEkwyE8euwH9BlBVrp1SdsS5XMyU7yRZskhNLDQjec0hb7C3IIadLKA/ct5rHH+yVfiDHyKqemt40z8/ch1GuySUJrcQlf+EqXXskXg1xx/sKZnz799ONK6vhAT1H7QPH/G3K/Vrr3wQePcI5mH9RHHDqSiaMGNME6aFGABQnOB5J3No3MdJ9zLQxUIm5/oJfMRioRh9G6/Sdw+SZ8oVBLlaWl/DDL8LM6aQ5kGA1fpdMh55YjOq3eZSUCN4gLyqRhFesyomcfJzfvTo48tIUO/9myFpGJB2dqoisvxuFd2KQlrGfUzwiqJPRSgdvPXnuP1awAxhgSVQW1WsCggqMm2S+5uJsttn6cLx6xkHPPTSgHAaeefRi/O20/NtlyCtZkouUaAWM13rgc3pCteTj5N2MYOXYx1hR49JEO9v30Mzz9SlWzcRFSI64gc1XwmSFGh/g1mu0Qv94ppUsj+dI4wzXEMGRZTdVNQD21XHhJL188ah61bApRsIAvHRmwwdScwiDERF7iECtc1qEizjFyRCvf/+HBXHTZ11hv40n887puvvnNl/noR1/jez+czYyZGfWkiVpdiYWCHyRdJ4wZGbLDDqEShZhMM+HSK49euCGDxlUdYtKJvyjfTpbW2X1Xx6RhGQtv+ivNfX0gnol7xVOqIEXNaqxOm4JNdOOIBBNkRvfv8XTvANeofg2N5YWoWkIlgzp58ZebqK9rk9fDBHXmd0dc8o9BXNKCMgD1MCE20oF8xem9zIDcH1T5kVVVDVZZb+2AIKlTrVS3/M1vLtiJD/Dw2rAfIP7/QP27M84YMTAwuJs1zprAceA+LRSSfqJIbNQHSSNvLLGlD/sN/SsosqyNP5++mDnauPNlsG0bzbA1NqOWJiSRoPJFvGFzroL1gemkYITjP6j/dx0+dpz1TgjWWeEeAJXMqXbThpby9N7yd6aM6eOgQwPCekqYBKpiEoxVoDUiA5CFA//fOfDIbMJyZ4SAZez9SYuKCN2Hwp8HObl+iOWkmULNuhLXXWf50pfnsdsez2tz8Qy++qVrefzJGSSi4ZOQEwkkq1MLhH/X7TvYeos6xgwyf9FIvvHdV5i9FNIgJNCnzig2Sr7oEI9OQefFW6ll9BOjwHd9OEGR6EdLAujVjUp00kb/Vbf0csLJi/Q1o5Mh8u0Tfz2RlmKPYOr4jJVTfjaSo5gLWLx4Mb8/5Sq22PQ3fHS7u/n8YXM47ewqc/siYhdRt1BzZY21SgChKhKjIE/Ze68mfcmYCdkgijSQLnGB4HSaFIxn3KIXBF4fWp9bV9fn0QG+9+XRhH0vUZn+JIVUsAIVVoyzGOExGHQD2sD1V5uFWPXzXg/z1oAef5CUMOLTGekCR6YvJqlLsHGFuNiO3WYnJeoKzpa4/vp+Zs5sl+kdSaiG5FNGMLYuDmvY0IJpln/DqM5BvvqFIRSjmCAshTPmzD6GD/Dw9hf1D5DCSqgvueSS4He/OOHzaezGhJphPvHJZiZMkTNIgQSpbOwUO6mCSx4Z6ZqBUfQsU7l46XlL5IjKwKosihtvSNzSIaWXwGeL2HmVemASH8y+8X4cMpSC2pp+8VHELxlcFtFUaaX74etIuh9l9z07aBvTQZpVCIIMY8T7vzmOwwVKKkENGv1GjhARmIjxY1KO+HwXxbCOU2LDZNBIKhmZrSouB9UvPYiHumJ5sL+i0rtfs0ZNoEWMke40BAL9MXIYx36facXm+1Rit3HaKfN4/NFESU2JR9VIJgdNVRHwrod3i7cC+ld/ppn21D8u48nHcziTse4WEROmgREnuJLMWVBV1ESqSiWuJ3Qv7aU8MEhSixEbglNi1HIxpUSmJxqtjJEe8lgmjw055NMthMb38S6HdCq9u2CZ4DJIY/bcp5kRoxMWPHwxrbUFWNNCai2JNaTSGz4AfZMc3l0y6V15g/ftMCk0WoafYFxgSYOQmgnoXHsTbNea4smxaCFc+NdluHA4udhSUOWJbK9MgfM6kb8RLpcrqabsud8YJk3KAZWgXqltvssuu+yohw/stB8Y5jchvvTSG9tmz557WODCoKUEx3xlLFG4BBsWScoCNql24yELMlUQDmkHY5q57+EyL2lX3WomylraGbrDzizWJ6rMljAuj0ksPrc4uZk38vIAE75VPg0GqzJUDmcUnaKHG0JHfx/Vmy6gvbmfz3x6HK62BOTENufh1NAh9nFGN1Lv67OTHnSqT0FhNGkX8vP5wY/HMWl8QKB1loRBBBFJXY2aBRtAliekGadAq5UNmZZNqSsIVO/06/sddYYOh623T7E2ZfH80Vx5hZwqLeJqSiRA4uoEfibS/aqeqXgaHLScfXYvKUMI86+x5UfyRMZixWeaRGTOkshmLgvwushiJQRVV9YHJz6pqNsO6CeUnAm+4gpx5KzjoAPaWH3dOpnUDoZ3PsxyCOnZGQPOMGTEbPbfT3415z7iZx+iNJCAEoPzlaiuSKOBEkOopBk4R2oyNW+0d6b0rm89CvkxwifB8FfnE7JKqbp0U7c5kpZh8uGDlfgNNgs587J+FiwdRqBlqfVVmgWyIlKFbnQa8S6fcdJlofQqn/18J0U5vNTUfPPNt5148MFfbhXUB3J6Vj4QxG9GOnPm01sYojHeATZZr8Tmm9ZwZhlZUkH5QbNKWcpySAfUI69lOXStg/PPC+VoBcWIpWXyxvS3jCRr6xRcnlCBktdgQ0ZmM5z1Gfv1AH0zA//1s3iQgweioU8SGt1EWC3QtOBJqrMe48hPdzFh/DIFbR9hPpWx66SyowBfP71qfTM4774uAKM7k/knQs0QpeJ0fRZcTfeGxpHpV04rYeUcJaxrJtCsk2R95PQJzOk15EUrVbUSEwWGwFqsKGyxVUBzy4B0ZbnpxgoLFqTSSoCyp+BjcvmAOPP8sMqHMQE2auGmm/t4+aWIqFjnoENqFEJHk5aIKVXiZBAjvhB3oSmJh7x4jnCZeHIZTsmqkdWt2DEoXCEiYZP183zxmxOIB7oJ8pFevsspG9FogtMyRb+kA4N86ytrMKS5TuWOWxiV1qT6FKR7sQP6sXK0SIlMQYYzrtH0YhVPb6FUuF6nhX92WCWHNMnIciV6VQ3kNvoItnWECoRW5vUm3H1fXmYqirbgffKyme4he6PitIQmw5gevqDPmlMm5GmOtDjPsmkzZjypTyB8IIf9QLC+CekJJ5zQ9sgjj5wY2HpUyqmc/kIXWX0e1tQhUssgDKQYOZ32lPDxkQbNPPWE4c5bekiM3KwAhY32plzooprImJnRzJThYp9kHImsrElDlI3a+3AKmTFGvAi/Zlyj8ri91svsO84nrCV85pOaMc0CbCDmFYYmcwTy+4Y/4HnwTXxkakoMzsnR1eVsDCoddEsxV2HXPVJt0I2mpNdFIWjJT5ReRoAcPgv6SSkjNqhJzlS4MuczUBUtYpfLr6VXqcmx+ZbTQLOPc01cfe3zDNaduPIz86DoOer1Gtn7lBycrWmJU2f2Ysvzz5eI45A1VxtOS87oXtWE5MtMSuJq4j+lrkSQ6i5TS/B/6uItpZBvA4yqM0de5p882nKKPsEOGfIiuVwNk1aQItTe6TSgGdhofCY9axA52WRI0wvsv0c79dcew857kkKtrABT0Io+8hW8Uhto5Vt+sG+N5//9xwmnayytLLhMiHxDvi4fDyPS1JFFBSqdnTStvZWWGVCr5/nlCY/S09uqdxGVmmCs7ItweGfSBiWeZyUHuYgmhJf4zCEtWCUbZ9LCk08+dvgll1zSLGLv++k5eN+RvhnhaaedtpsNzASXxWbTTQp8dLtUpXQVmRWnH+d81tRNlhFEUkESKdhHcsXl/Vpjt+M/qVl9urSTNqNmBevAOCcbpxqfCDYjW2FczQboPat4WEKIU+q5QSWgJvLJILmZd1J+5ja++NlmJgxfRt5rT2w36HmavnmpvFCsOASgQKdhbHBy3Lo3rGuhrNI81zyXb3wzxzFHDqUpgLQ+gNHutDM+MWQ00Oknk7y60DiUVK3YQx1GzqivZQwf1iqdFqSvgCefEx3xZqMUYxw6Wf7D+3O4GCcHTmWvJ55YTBCWKERFOltET46sWJU9xIPxLZN6BK+tTqd3TkljhXrqg7G+FOQoSYY1pwac87c1GTepRj0uUxeSjOHg7aDftz+lI6e3CiKf+/waH5PTDpsOAgAAEABJREFUkmSQww6cRlEJ/NXLf0d7rV9JXbqV7rQaJQ08b2IQNZ3C8L6cTrK4Bs8ikAmlTxLSE5o8pAgy0esPc7Rsuxt2WBcqK3huesrDjxvZXktlo3HykX/Zy4ISA0o82rlFm10ccEA7Y1SDRzlMuTLw0WOPPXZzPoBDlD8ArCuhvP3225uXLl16oDW2mEnAAw9po6WtgtHMZmTUTEHjPLz/kVICBWQuyzNnQRtX31bFZmUpMKJj04MpDxmO84qSsq1vUnVqM2KNy3zlIRwmBcOqH4GC0dOgIGMp44/UkqX3gctojZZxzJfHUurIcDURE83l1ETVz1y+yUFocOFfary/F2OZQDIJfd99KXdeF5DL70696uhonc/PfjyUI45Qgigt0mevBeRyTlgsSWLkV6KlsXg80hc6/KMRLUMT2oMjr1k7VFUSa1e8XM9QbJGIPauIMT4ajXjRew1d9VPErZYQvgKePbusvaOMnA1UCYAnpTXH8huRxDfB4+n75qn7Pl2HtDkl2AHWXTvHmeeNYb1N55PVBjDpKHoHO/jhDxcyUA0F+foA3f3nmYmWqjERclbVkaehCabYBBuuG3PAvh3UFz1KNPsVWrMKjc1fVyWVPbVdpVHC2GDaM6n7VTnFpvP7A1og8bqdRFD8iUePV+/lsmTaU+ibsBq5aetrAkpologXXl6mXJ9MvpAjle/h/Vy4kEz+3tQDgqBIqHdDR1Q4RJ/Q40RILU1z583y/61J72jqeP9O+/6hemtMP/vZzzYsl8s7xPWMqVMNO+wUkZV75QDL4Z0r4KyXUpoz4Cs+yjmuvHYJr7xawXjllIYTT9iZAT9juZpmyFSBkwhBIiPrGqa6d42xkYJhucXVtQqnVQlsfNZ3JWypRu9rr1F+7mm22aaVCVMh6R/E5nOiYGR82UWBSsMhvEqN+pefJtM7z5BJaSQHwYwePZQvHb6Mk773pAJ7lNbXmeJpNt/4/jLO/UcXY6dYkrohTUYoHbRKP8txIalpzEp6J5ENOb1XVaPEUB7skx+WyeUUKBacEV1VLIZ26aVA4zCucVnlnwzxJhpCZJSUa7KLvJxKFTLx6Got4Fr1Nq/mmdFlxen8japDL0dc5Utfy3PpdaNZa8MBatUectpneObhiXx8215GjhlJ8V3/dqMQKpCMkdzSsTMGqoNQFt3sJT732XZYWmPxA/eSV0WiehxsXS0j0zhnPD/6ERp/t2pNeLzeZWPkD4H0HyiYpSIC6Sx0GaH6kiRPf1MzuQ2192AiErF+6RWLeOa5kFjLPyerIjhS8S6UnieTqapQNlPRAdki9j1oEqUW2dgofdQr299ww1VTeJ8PafB9xrgSOuecvf/he78S2kK+TTXQ5w7o0Hdoia5Z0WnaMZreIh/sSDteCakG5wL64in85bwlVPRcU8laXG8f6irBrHAYZxEGUmNlXClHRqCREOzyfi+RxyVU7/l0/wkp3hWwwl+PKdbyDNx+Ma2Dr/Htw0vaH5lDUojIFMANI/7bcKenlZpma0OKkRcGmZGTOCZObebzXxvOL/88i4/uPJvfnzGE12ZPJWyawLbbNXPjDetw5tlrsN02fbQNqWIUSzbwQiVYOwAqz5GzWTl5ahZRjh0vvagOCkQKpuFjIUtLotmkUO1Tq+lewzwKXd7t9GBejVYjLf4P+kUuGwAK+CCgMTnqadRwq3jL09Mf0qsqyEtOw57+LhCEbzToR+oaorwxbkTAUYe1ctMNa/Oz48djWucxo6+LGx5ckwM+N8iuH79Lm6t1Prm3JTAKZFHm7Q6fDKzRW6MNaoOVGlwxwDXlNUNXWHc94ftoQu2p66nOnUPeDNOXgRqRvpxAIE22YOSH1qWs8mEkIJ7fWKh88jHySaumq4FM7538IYxq0lkXA6ttgVttGjVToh40ceqFL1HVNaevcYHksH5iSVqFSzhyZeGpQj2SDyWMGz6DLxxgKIlknDLk0suv/vZxxx1nBfy+ne8rsjdz9bUffW1qNa1t5dIsHNZZ07frkbi0VxtVDhMFoEA3LpPp3fKhmgFjlZHPvhjx2ksVXGSoF4bQvsXexHkpOHUYF0jJAakytG/IwHglKvj0Vv1Cuxzbe/81/wmaWiM+E/JKSOG810ievYGdty6y6YY5anG/ZjiNsSurz6kjW6n5Z998nwgoMZjUYDWTOLeIgz43jB127eSpZ2r84Cfz2Wybx9h/n5f59U8TbrxmGSOGBQqcHfn9H/bgkAM3YtjQvBIDZC4BnBKUIZVrZ7auPRe4++45elfA1UO23LKEShLBJdJVImjxIF3jk6h63+0Ut7KJUUIwutJoNI5Uv14mb7siVoG53oYdyITceediegYzsga0AsQMgK2AyYCIfMGy7far8bWvbcs5Z+/Gpw/cjEWvxpzxmzo//GbATtu/wD57PM2VVw7Q0m756veGMHpSj8YKl37f/jRgLN6XrOSz0q8ypJJjhSDIaCr08ONvD6NUeZmBp+4kGKgIvAmtX0CwTtox0iTv1+HlNdKTrl5TmVnurzI/jeZpyX9MEmFbxtOyxY7Eubz2WRx33tENyTTZ0evXj1YyUOLyrJkgxkgeBYUeLUGwjOO+P4mOFsmehdFgtbzzs688MkYv37dTmN83XP+G6JFHHol+//M/nBgktiMKK+yyewsdnYuwUZUgFGgmJzdqLgf6vJNhZCanwBvGGX98El82+J7cpKkE4yZhtP5yMiZGzqDh7+/pDfHvGLUIILMB+QE558OX4srzOPCz7ZhijbxmpqQygA3kBLzL4aRi8Y5PYhg8+2k6QNfQZZx22lS2276kILNUyznuvC3ghBPm8KWjZ7OHAmW7ba/k0EP+wQXnPkpvT5UscwRWOETSCJ/FNvAZ4NHH+lm0ME8+amavHSbTnKvqbZW6BeULnGC8nv3lnZrB/wkEYsnkyD7cG04tPM6o29ssDQjjFsaoAthgY0FkcOuNsl0N8Sd7ijdkzeVNY3TWVN3ceseLHPvzu9hxj8vZeZfr2f/QF/n+D+Zw0VllFuqrRyEt0qm89uOfjGC3vUvE/f38L4crl8WIIciFpJU6G28xjLXXK1J79GraKzPJqhFxTpOPzQhMH1ko3XrD8K/D/Ov2fb3zeEMT4IIqRnw0r7Y1DFV1oAq6e4blgj/NJmuo0EHg5VBr6NKzYfQjZRunvGaV/5ew9UdbsTKQc8moR+556VDt8YUCel9Omfx9wfMfSI488rDVTdC0uZJDfmhHxDe+PR5nuuXghriSoQIAjATVngNZk+6RM0a8OLPI1VcNEOpVFuUpbbcbC+MAk1q5rZQiKN73wyv9TUgDi7Uh+XkL6L33QrbYIGPrbRJcboDBckquZHBVRcObhr35cXlAZeqWsfWL8kkhssTVhQzvmsVfzprIJz/RRpwkpMaRhW2kQTNWGTQUWwUszaYgnQUgFKnGOynPqVrKNFMiAv7vV5TLjsuvEX9U2W7LpWy8Vo6AFo2RbkMw1vlVPu9+BNKzBghQVvLoG00IaDTxEwkiyJay9x4lxkwYoFbpUmLrU6WFWh0ju5psiMzbLvpAEKNOTBDpGpHP56lqmTQY5RiwGUZLSZNljBha46yzRrD/fnkF8CLCIOB/OWwQYK2Sm5aEQRSIjzl8/agOgt6ZWh5eStGJD+sxZ9KRghSHBviON5p63rh/P28M+mNCMtHPyYaDQ6aSX3dzkY8oJc387neLmDOQQ9sLZF5vtkpDiZ4h30yq50zN0dwe83/fa6K1qa6NB2Nnzlh45G9++Zexevlvp/m3p/f+IBbfO/B7hdQMH85bMG8v0qwz0Gy/68daGTGiByvnt6oUApvHiGMvqzIemQT294O1Vq66ropT+Z0GBcJxk6mvsSnZEG2qeW1q1lQsvFc2/is4Y8SQHyF+lcEa9igmCthn7ibqXsK3vjiS9iH9ZLZCSVvhqSY1k3t9jB/3dk2yYVQh+SuCF52kBrlQEicL6eqYy29/O4pvf6OTgioRo4oqlaypgiYJ0afbkLJpI9NY7/CBEhZYfYlwjdnDJwjjUWXwt0vnkto2mpqWcPihQ8nlYzDNiGmNcGoZ7+1woicnNIIWvyB7OSWarIQ1EYGrMrIz5dOHN+u5yJWX1JkxM/VkcKFPUDUMKVbNGNG04CSPCxKslhfVtO7faIaskkYZ1aTOJpvHXHBJB7vtOqhFSD+Rvjdam4qB/+FUYnD6VGPCQL4kPoJ+PrZDxNZrRgw8fANN1UUEmXgXX0azLqKFuP0fKP3XQzJpJlNKMnLk1JSpUKS002EEWmJYQpYNOh59qkP6KSE30NWhIfj8hcbge4zDWUcQlpkytcaeuzWRN4HR+2HPvfLonrzpEIY39by3R6nnvQH+N1D77LPP6IWLlx0VmIpta3IcfEAXUaCZQIEXyuMjk0My4pl2QVWOWJFTO3oHRnLhRTOpy1iVrEjzBh8laRmpnfG6YAPBaYRR+2+Y+W9gxZ8xBh+EUeYo9cyj59ErWG2UZfsdLMaUsS5VORgQaNbDZbzrYQRhBGcTNIWBLO7/kk6UpYQmUxD00Zl/iZ8dO5wzTp3IxHEV9ZcJghacaSKLEpJoITaXib6Gi6YxRvcWsatmcBg08fLEkzHnnNlPXZtWex5UYu89c0S2W67YpIE5JSTpHQTNOxyp8MU0/NAKzAUY26wxOYq5kMgktBYdP/rJMKas1cesGS2c9KsFDMY5Ms3InidkI2t7NK4ff+9tbQOwkQNtVhpjMFkeaqBffbcfyjl/XZ1NNq43ZLeZ1t5mQKAtgrdq/+Wp8spqIvHVSOMqBlrbBjl4nw6yxa9Rf+xKmmoFnJK/CaQb/x+YMeF/SeR/BDcSy1pMLPGDCnX5UbVrQ9yUrSiLz2Vafp168izSdIwmgACfs7xtkd80KBrVc0Z30rGTDxVMH58+JCe9ZZpcKtG8eTMPPv3007sEscqnXWUMb4Hg7rvvPci6oNNIgG0/Ytl88yKuVlVgeeBEP3KShveB32RJSAijFv75z4W8+jK4qIQbNppo/V2ppQVgEBUT+OW7Hj6Q06UpGGnde7euudogtcduwM69nyM+M57W9l4FYkAuDQgbO932PfFjJCq++R8ZFoUqTjL55jebNHOFQR5Tf4X99l/IjTePYd9PBNhaH7ZuMWkkuuhzV6bgy7CaIKQh9Ylfj5MVh4U0z29OWELvwFoUWpZw4u/b2XSDSHgGyQUB5aTaAHaN37f70azk8Rq99w39+ISY9ZHFvfh/Ffjpw0bx2SNXF73h/P6kZbzsqwYjR27IB15m3xqqlJ1DFIjVErbcRFBXkoqtlo0xE4cWueSSHfjtHzpVWarqqWUSTdz5isHrJh2iZ+FlFQ/p2CV97LZnO6sr+fbcfhbNixdhE+lUS1eJR5CI7iqSeS/DPRVfFeZF28rPvHrLXicbbsNgMSffh0fuco2/Hez/K9U2lAqkQzzs63ZxevYJIyrlSMsJW25dYMtNAuK0qupV/loAABAASURBVGI9XvMPp575vvxzbnnUexHpvcOcfvoJbb29lb2zNCr4JeZRX50qhl8maFCS8YNBMGWQ8ZVA5fAQmCL1/nFcelEPOQHGrp/cRhsy2LU2pDlC10tmjcahw6tXl/f7VBaOQh+ITnYwlNIy5Uf+yeQxAYce1UQa9KNaFOtnGRkhM3XShkzvwogc09u0AeUjxkoH3tCN5pCH4sIBldsVrB1k3LDFnPnnEdx8wxj2+3iV1qBG0QeT9OJxZFmixJDg1UEDsfC9fnU2Zo42JT++zxO8MqONzo4qF2oN/8k9OkRD+AvOo3iXZlShGdBJ40hUfVTJ2RqtTY7/+85Ijv3ZBBJ55yknlbnk4qWYqBnCCgQpJIXGJOBcUUlCM7+qQCeyoRA2KbH5f3m4xpSEk06Ywt33rMfuH32W9sLLmvV6yecG8frQekOiKYHm5oCfYlnFwyjBWEPnyF6O+PxwgrkvU37mFtpLTaqyeshFCYGWNqtI5T0OlzJkp0By2bhNcoagTfrWLTfRxvtE6c/gqoZ/XraUUmECNd0HVmO8Eht29mSMdFwi0dehKG/lln185RvjyBUgTtLSjFemH3bJJZfkWMXDruL4fxuuvQbz61+fuXeasG5g8kxbw7LW2oMEDGAEabyAJkOS6UlKMTklB89CC889mTH96YRMs7JRRmzaahvKwRAJHpLP5Hg+sIyG+abLqp9OzuuR+eawgcUHnpETBaLV+9ITZLOfZu89O2hum6ulToZTSY2SGsRkmt0y43l/F070JQb/tcIth/M4fBA7OQfCgVDEgaPm8WZtZPWU5sICbSou5uwz2rjx2okcoc+ea68VkJO5I/HpncWIB2NSjHhFh881QZCRmByPPVHne19fyPzXxjNqZJ0/n9nE177bSVObmJC4HlYXP+r1psvrp8O/UXPqULPCb7UpttbaEWf/ZR2+9o1O8foiZ/x5BqecvIj+wZBEBbHWR3hZcE26SCiNsWEFYzLZP2bk8EF9mTH89rQWrr51FIcfvYSutsewyRIlXEOqKskGEWR54Ukh7AGvIxyrfgSaoBym0Msn9skxarij9/GrKHdr+VKQXV0f3uYSlZXbG3Sd7nzTZdVPjyjFKdnaRAYlgHQpPRI93Ho33Zcw+nPTjb0sXJQRFVR16bmhBuPHigOnMZn6nWDlO0ZVyKbbDjJ8hCWwkS1XqptfccWFGwlylU67SqPfNPiwww7Lz5o9+yjrokJLVOG3vx9GKb8Q5LDUDf5wumTeOyVwvZoQRBH9psYPfvEK1QFHIo7s+K0xwzbBB1JmEpzKUmMGQGtafKB5RKvUMk+dnL41G22QyjvJBxWydAAX1mlZNpvsvBMZM7TKZ7/QTrW+mKJ15LwMtgx+ppETR5ol35UNjRMxgVk1o1s1v2+g+VkdkskQas2UV+K0rkqUkwO4uvqrNBW72XTTpZx8UsDtN4znxSfW4E8nljj60BKbrNfG1ElNTBjXxLDOiJyBTF+BAm32Ibmuu77Cpz71JM8+P4Fi1MxPv1bikdvW4pOfFPwQS5tmmaItUgqaCUyAsaCoxoQZoVrRWdrFyrThEcd/P899d6/GrrvWVOFZTj6+wPe/N4dFgynVQKWsq8mpEb+W0cNrTBjTxOTVWtlmxwLf/UHIHXcM47FHJnHZRU0cdmCFUUMWEdl+JbsUY2g0H5ykIqhkgj/UD/7HN1bpcCISWEtQG2BcV8y+u42EubdTfOEp2mqWsLmNWkP/NOYtK4/zZgsyo2RhgUhNCpNOdLOKZyBdtVK3AWluGWiDm6iLetpJ6+QtMC0jGBS/L7wWc/75A6oEIrI4FJzB20caItA6yDIoOw1ikpQwV6OluZcff28qTSbBZEHzpVdcfeJxxx0npv93du3/PvQ/R85e8uIG1ubWsGSMn+jYdKNWcpGRAA7yOZByZQPEvVqdXLFAVd+hF80fzkOP1MnETZpvprTFzpTDLhnKaYhRGR1hXKLxBhoOwyodHkvgDH5Z4EyGkFMtxyrt2yiqP37pEZVsr7DXbi1MnNhMEADKzuidmAL/rC4jsXR5l1P48YAGJH+jrRjx+rOV4KYBIhlJ9VaKeJ2IkRMEwSIKUTddQx277jGZY3+xNZdevSlX3rA9v/r9dgwdLXihr+oSa2mSSKbYRDz+Qo0d97yXX53Yw9LFEzRj5jn73FHc89DqnHHuGHZWsA8fVWaIKoqOZiWDpoCOloAJE0K+eEzEtbeszf1Pjufob5Wome7GPy3eeefn+eMpCxiotJG4Ipl04v8xmTdLsQSfOWIsV91yIFddvxd//esnOOaorVhz2kgl1ypyc/lChEkLavIH7+3iG/GLR9DQk9cX/6krdb1x+jFvPLz7jXGxkp6aaFjby5e+3s7QFkPvPWdT7EuJBwfJCprNFZQSRwiXE3DG6d6f/urt4q/+eVWacGuC03yA//KFAp1IFaOSVEvnWIqbbCtemqiK3M3XzSW0w0GJDaOoMq/TFRum4ScCUp8zGUYTzo5KxqPGBhQCY5Jaus6Nt9049fUR/9NF7vQ/jfuPQd868VtND9//+PeSetZiqXHQYXmZvk/lYooNJYGyMFp/IsU0fMCkZFoz5XLtXHdJhcogDBIRDZ/KmHW3IJcvkUkhyKCZMNE4Mmhkl8bD//xjnSFMQ9JA+IJYOIWqqQtXK9LeX6PvrisoNg/ymc9MoV5bQFoDE6DDNJqP6cwmZFo7quM/Tw/2n73/c4/TyKjZ8Oxz3XzxyOl8dNub2GGrm9l5m6v5zP7XMuPFVJNuSIOvwOGCFGcjYn0L6C47fnPqPHbd81GO/1k3rzxWprNYY689Mi65dCRPPj5Zs/o07rtrMo8+NJnnn1mLpx5Zl1/8fCrrrpNR6R/JZRcMYb/9Btlrn2d45IU6FU/DlDH5OoTSofd06bN7seN3v57Otpufwd47nM/2G53Prlvfxhl/eEFwERgZ2VZ0lUKDMqCx+v2vT/dfjjCio70ajKGeDTJxSoXdd+4gfvUB8vNnLU/DsqWgxJGhIY6FhsviexMRlJ+Y/5awhr3V6fHIR4IVk0JN+MMCAyZk4nY7Q6ENF4ZMn17l5WelN8WFS3NiKFLoiDHC/8QqZoeNrLDLLk2k2j/LBe352S/N3V1LfT+A/+X4nwe+mdgj1z6ywUB3fcfIWTN2TI2DPt1OXFtGIEfCK0OKAKPbAOvX1+ozOUvPohJn/WmujAZeKa3rbEN/0MSgV5gN1Wlxxmqkbnl/jGOUHIJM0R4p89o6JjM4UyIfyxDPPYt56W523LHEWqtXyIX9ShQBLjE0cpR48Vxk2i/wyx7P1X80D/AfnavQYTItbQZYZ70C5563IV/+8jjWX7dISymirRBgXSp3yQgdkgU5keTKFICoQ8nU/4XB2XMr/O2CWXzlsIXccd08AmU8V5tDMXqJ0UNfY7Upc5k05hWGtj5LYJ8lNDNJagv5v6/fw3f+bwb3395HXI+QeYX/dVqxa2wLSBXkFEMFY2jOhXQ05Rk33vKpA0v8/ZLRfOu7I7V27gEtQRBPRmtmo+qBhkLF74dx1kVZS1jj/zFCfQ5HHVykK19l1lV/IldeJh3K9laMNJp+JAuN5kClulWqBd2zqodwCJ/HYjAEPi7iDBtE9GnirIychB27mvQMvYOOP5y8hBSVZEr0+L866aBhZCMbo0PPRhfrFCfM4YBDWxg+zBFmUW7u/Plf/PSnPz1cr/+nU1r4n8b926Bnnnkm9/xLLx5UyjcXLVU+/dlR2tnuIaSOzaUkfi0ZFcDUMY1NJhpHpZJw880F5izOSMWJaRmF3XB7akVlTn3/NXJspVDkioKXClQ66eZ9OY1XplB6g/uLrdcp9PfQf99VDGkuc8KPp5KzM+W+/bhKiokCgaY47zBybvwgI8u8L9y8MxJPpiDdBW4uQ4ZN5+BDe/nbJUN57uUNuPv+1Tn9tNF8+ysd7LvLaD6+/TB22qaNHbYpsvMOBXbesUPVRic/+/lIfSbdhHueWJdPHDQKsgGiEKyQm6COMan68moROZXhoe2nvaub8/7eysMPTuXEE4doidDCblpq7fQR4d42ZNft8uy+UzP779PB17/epuXGGG68aX2efXFn/nlzFz/6ZYVJa82C4qui1QcGHV6Poa5qrtGh+w/4FB1nAlIFYuInBe3LbLIJ7LxRO27mzbQsnkmu4m2p5u3r2THeIXUjFnVilKDt++V/XtfybUeAyQxBZHFpjCu2MI8milvujAtyip6QG29exILeovYeZBocJlCsKLk440By+fgwOKwe07jC6mssZautmpD9TGCCoTfddNPH+R8PaeB/HLnSsONPOn7SovkL969rbVBUMthnvyp5OVhR9reaXUKrrJzUNSJRy8ArxxgKrV1cfskcyugoNhGsuSVm1DSWVj2MRHYe3mF8IONZdQLUO/2uyumx1H05LGchFZM4AjtIcdl0qi/cxObT8kwe240NykQyog0Qy+LFZjIIaoF4MhjdflinfIJIcwiVPgr0E8bzyAYfZfLEF/jUAYs57pdV/n6h5ZKLAv75D+0XXFXgn5eFXPUPzT6/STjyCz1MXO0R6tETcrpXETKcyWMCL4XkylRpeH175XjH84JpRjNZn/YqZnD45+CkXxguPz/jiisSLr8u5ZKrdf1nnb9fVOX4n2tSOGQJ6633lPRyHUG9G1PJKdFYqHn8DikRfPVgyyB9N575EA75j7GRbJYndJGuolnp5pgvjyeyvSy55XKG1HowSZng9QRgBELD5xo3y8csv13FX+lBPuWMIVXzG/BZpsQgA9eEuZ5rI7fuNtihE4m1JzerG+66pZuwqL2vKNWnVzBSqTHQYErVBkJpZFUrvE2FWEvALk3IFclSK/T19e1x9dVXl/gfDpH5H0a9acitN9x8uGagjkjp63NfGMXoUTGBSgEjn/CgjfLbVwwNgXwPypRNPPlohfseqZEWIwg6aNtkRyr5FsjntbWgYNQ3Ud3gpA3nDSUlLB+9ar9Z4IjDBFsPCfwXByWrpupcuu88kyLz+ObXVcEk86V7EfTK15cJeTzLmzhJA4LM6D0f3uFnvEyJzFctasYZrBKbl8HWwdbqGDOHKL+AYn4pBbNMgdlLEPdhqr1YzSoRMUZ1mPHypG2YpFXqDXHqdd7bbAxhFSf9qEtGCsCXsiaDtB8Tl8lJ7oL4yAMl4YqSWElAjqh3QVrBahIItOYN47xoN+m5iEkF7Wl6XFkE+kJkPsxlhXEoP2CzjCgV43pwyo5rb76EDda3xE9cB7OeoqQZ2foEIbmcwBqDpOvGtaEQ37nqzSiIPf7MGlyQ4UwV9KUKLQ8zJWyXH0HbalvLFhlJqIR/KQyUA+pZncZEJVul6Qo+rMaqybaReKwNxmy9XcgG64SEVh/N43iLY489dt0V0P/N1WP9b+D/A/byyy8f1tvdv5v4sibv2O/gAqVirFCOIRN6OZNT8DmVrnJhSAMaisk6Oe/k71ENAAAQAElEQVTsAL9hhmvH5IYTjZ7MgAxHKIdNqliTYZXJnfocwiUi/8HA/9DhbAZRnaKSQxj75Q40x/OpvHQdW2xWYrttOwkC8e9pps2SowTONCiZxjWUwxvEXqPvQ/mx8oYgAd98EPvWYMAHcFH8FRTouogZX3I6JWqkO7zO5GAucPI9I7Fz2owVGsqSTjqWPYyC1zcawRtKLrMckSCcHJjA4DdfM1ORGvr1zoESC/rWThaAkgU+2FPPRw48TTuAsT2gQCCTDpNOyNrBb0r7bBYOCEwy8cEfmqeI5X/GiKYnmbSRhilh0yJ+8tOxNLGEZQ/dSYlEuqmrZbLv63z55KBEgp8kpI/Xe//nizS7fGIxFq9XAqer7KoEYVS5Wad+htCy5s54NRI18cCD/Ux/sY4JLN4cruKwNi9bIH36FuBhTVIk0N5Ea/siPnVQpz4E6LVzbVr2fwU8BP/V4Tn5rwasDOx3Qn/2i5/tWY+TKUq2bLqJZdqach4tJZCgeEG9A3m+jJTgnU/O4ZQ0ssI4rr+5lzgyoFlsxG4HkTXJecII4SUIwXgcGteIR4/jjcYqHuJFklvxYWX8AikLrjwPyj0cqi8UNbcAq/dgZYAQJ5U73etGdOVdPug8U14+z5N49Bff5ccIqHE6YxrXt/xpjBEfHq9vHpd4QYh8cPsroot/p77MaJ42EZlwerzOiC/x6MIKRD24qJ+6kkBNMLHcPbMdJLaV2AQkopXIfwgCOX2TsMnRjALFylZyShrygF7KFgrutFVeZcnCmDSqUjMxcVDQLFYkDgPl95pUIZoMij0lUcFhvINbQDyq6UZnpvdlCJapez6Ei2n8fzxQv04RoSFrQ3aL0pfGSCeSkYbc/n558zL7PmcEYnyfR+Cbnl2gH3/qufFO7yUlHo+H95h1NbrikxUtkC9LN3U22bzG+pOLVJ++l8rCuYSqhKzG+X+3QKZBSgpOvDj1eX49lVVtwvo6Kt1Z8RoIowWTpcr9jkTVVXHcBjBqiuAKLO3LcbU2kW2+nVTJ3IUFMl29qBoECI8zum0mtCWSpMYBn1mDzva8nm2geNrsV7/61Uj+y0Msvc2I99D99a8f1vr0E09+J3BZ0F7I+P73Jsmd+9QUQD4pWF2tZicZr561aZIxkMmZ7XDO+MsCXtOGZBI6wnxEbYOPsKTQjFPp5O3nlZCZQPbJ8LOWrz6QkfCKYNUOq0ixAyGDTZY06mHYSzNIH7+djSan7LRzCZNbJD4NmbJwFi3DRb167gAlNmwGoXf4FLI8JE1iKyOxhkyB6bISnkWn2TQTv0nkxL8Bp5Y5XZ02xjLBZzRmdw/fmHE1u9IK1ge9w6EgTUTT43cpqU0EnwijkxNY/GycunYyPyvLmYxkCkxGZBICo+B30jtlAlvXGEvgebWOpKCgDiWDZ5IiWdhCnE9JclWcyn3SFkRIMtgGhP8JbIY1MQEJ4g5pDWNTweTFVyBeAb1HXaQR1qRIfBRX6gfkyIhHjMMEerZqOpPAkemPy4qinccXIXXxlppQPEh+OYLLsuX4ZYtEOFKHRmQarRu9x5cFjSrGI1af3noIp72FVPZKRMvajHySw6XD0CcpKMzFaAOwqVKkFNc58usFctXnyW64kJyxVDVDG1WWuayC8YJQEJmYTLoV4VU6nRSaWK8zMZY6qOsaR6Dqzdk8SZAxWCgzoyvH8PUO03tVa9pHuPqWPOXuoY2/iDco3ivNCdYnL1OXzyQILS7qVl8/eW24thUf5ZO7WaIsI0iD0Sf8+reHKEkY/otDnP0X0G8CvffeZzdOM8YJidlo/VY22TjXcE4jhkACe7Na538xUkilsfECvT0FzlJyiH2FIccprLWFfL1Lju55d6Lirwani5NDge9T9/t0Oq/JQDOcgrwkZ1jy6D8xvT18+6tr0NqyQFRiSI0cqEBgMqxJ5CRySAVpgxUnEO/JclYP15h4vcyZ0xiNVYfxgILP5MBO/RJOYrhGs1bjdYvvdxUwmsVdjx67NaqGkcxOJTy2D2y/xkCosj1ILYgvUh844sfondVYBa08XzCBkkCESYzg5DTaFBYqrJzQxgGmVlB/1MDX+PE8xxarmduC6CbQoNkjPhIkhuDVpUALE+kizmO1DDOeD1VdyKGzJI9Hg9hp3PhqTzOgSOrR0Oj3Px6ZYPRKONVPIL4QvzkMKcbL62FkdOdxIP6zPKbu90YKGMkS2JhACdi4FuFoAiUMMQ9hLxKaNw7xZpR0rSpVL78n77f7jb/xHWIiMEb6kq6rPez78Umst5alMv02urKqAkopUDKmgZPtY9FOhdqoWbVVPx0el/C4Fc0/Bzjx5HTrxGcSRgQT1sZEnTKt5aVXqtx3n+Bp0pacIYk9T/55BRLdS29eT0ZBGami/NRnRtLWKqkdud7uxV/82Mc+ptlGcO/x/J+lveSS+4pPPvn8kUFYyDll2oMOHIX/T1cFfoYLQhrye0HVUpsR2FRdElvZ8dXnCjz5ZD9WzkYwnLadP0VV00zQ8DI+8MNZgxNPYTqIWTyb8lM3MGao4aPbB/K1WQTeSW2IkZPhs7NvckrXmDcNmSuRZdKzUzN5GdXikMO6AliLHnTNqRUFV9JjSTKpOVVGqNlmjO5R0KGZXd4IuRAb5HAmaJA0gcEpgSF9EYDJDD4YUYVAFmCkLysZCDWzBg6s6CuYUBKxrlXvmzBWzRQ1WLwYi8naCJKx4k+8CD8mh0kD9RmsTzqeUKDXJhQPEe71SsIkHYITflWAuEQAmVqAcU2QtYP00WhyXDTLZsKbuWb1t4GCVIYXf+LRCF68ubRDaFpFM79cJj/7mbTxbJIujOhjMr1rBS2F8DryycLE6CWmQWcI0CIdBaSREpkNRKtNYySv3mBkW1PBIjxWHaUiTvrIMslhxHPNQJBS8FXT4Esc8bmJuNp8Xr38HDpqKSZoEl7hVOUbuirG20r2F6YP/hTLWU2xMnY8Ztq2mKREXXPIBX+bQRyNIFeLKDrp7k2cGOnKhAGBNvidZFhvvTzrb5gjdM6EYaF9wYJlO71pyDs+2nd8+w4vf/vbn6wTx9mOLovNumsEKscDisHihi1dvbZ8pJxJLiGjZMp0FYIoIAuHce4FC4n8i6yJ/IStqE5enTQwCkzfyVse5i17/9dOBZRKs6IcJH74Cuyy1zj2ByMZ0jqfgJgwL6fQUodcDylObhmQmKHEZhI1O255C0ZSU2KLgxEqQ0dQN6NJ7AjFeyuxs9TSElX8mDHU7ShiwSd2rO5HM5gN13UiqRlFKoq1JKSWjCBxqxNna1BJJzCYTtV1GtV0GnXGkIRlXCAPkUP7ZU2mAKxlI6n4lq5OPZ1M5hIyBVWSdVA3I6mlY4nTEQryCB8sUKPuuvQ7fDlvDMPolf9HYIlm2cx0ENsJerc29WxNXadJZv/cqf4AF1YhUoBKPU506kqgNdtBORhNPRxJEowi1n3NjhL9MdTcKDI6gJBEibYSt1E1HnYcdTsMIgW/Zjh5v2BaSc008Taaqi2QWEWIXQZBD/59ZiMyO5xKfTwDtcnSzRoMxqvTX50iHYzWuBYyEyAmQckTI159A+KkjfLgVMrxBtTiLUmq6wlvOyTyN5EpFSvs/rF2Vh9fJX3sGsJZrxGKX6wBU9FkUaeBF8uHcVjxlBOpZaWQEVvvAWE7Wd1w0+0JCxfqpXwgisVbg5l//WRpiosT0kodmYZccTEf36sTY2pKxrbjxedfPvC6667L/2vEO9/Zd3791m+duz2cPv2pgwJsq5IDe+01ihEjerEmJquBlY2WjwwVWv4uQ5OiZoaEl15KuObubnJBSBQWadpkV3qsxlEXrPPAb9ne/s1bgr9zp5Dlck2UupdSfeJaJozMsc/eozBRH94wqKR09Ui+UyRmBM7sDrn/k/P+RHh/DsH3IPwKWf4YBe03sfyQ0H5Lfd9WAH+W2G1FWDxKfd8hNN/F6F0afEPr+u+SheoL/0/O9j1s4TsK4K1Jsr0F/13i4Edy8OM07qdY8wPxo+fgh5j8T0iDQ+XkOwr3aDI7GVP6PNb+BOtOwIS/JGr5hnhdi4RtofAl8eF5+REm92PI70EtGYUrbEHQdIT4/75kkizh90nMjgqYMaRuB1z0LZKGbD8QzP8R6L0z35BzHaPnz+FyBwp2B6qVKUpE64jn/QmiLxDab0qu/yPJfZs0930wPyYw35KDfl00v0I92U6624ao8BWs/QZZ8E3QfWo/o+S3Hmn0MY37CUl6LDb8svziS+JnJ5KoXUGfUyKYRGb2Ed4vQU7jw88Rh5/F5Y8m3/wD6epLkn2KPKhGFsoBnSWuB5JHY+stYLck1/oFkvAz1MxnMO0aG62pfr0zFpN3tLct5iufn0hucCbVR69F3zNQVkVZQnRjgiCHBqh98KcxmWSqk6giYtpayg0jICjRPZjw4ONVUi2njBLBmznJUuQLgXg1gCGLl7HTLhnDRoQEQJokm5xwwg8n6fY9nfY9Qb0J6Nvf/sfY/t6efXMmtp1thk98YgjGLZYykVACNg6MOBWDsqreiTHN1GHYwW03DTJjiaNsE+ptHWRrb0ZmYxlSQ4L/iR3+28NIVWFZSn76Jtyc5zlgj1bamnvEsng2YHzpjiUxRrNNjqi4E2ecsoAtNjmVLTc7k802/SObbfZr3f+KrbY5lc23OI2ttvoDnz/0Kmz+AIg2Y+as9dnz4xex6Wa/1+fR37P9tn9m283/qDG/Z8ut/8j22/2F2a9sRBasDcGmvDh9JNtu9gu23uIkttvuFLbZ9nfCe7zaLzns09dy8y0TsYWjqdm16akNxaR78sk9rmTrbc5gqy1+zay544RrHKESwPnndrPttn9i803/xGl/6MOFW+By3sHW4DcnPsHWW/+JLTY/m+N/OkfOtKUSTjNBcWuuuKzElpuerHHHscmmP2ebbX7N5pLzY7tdwFe++jT3P7AhdXM4id2EqpLN4OD6HHbYVWyx1W/ZdhvJtunv2Fo0t9jsVNH4Ix9R363Xh5jiZqoipjFrzqbstOPpbLnlb9lt178wb+HWkumjxOlu/OPCDsl9Htts9Rv+8Q9DmN+Fskr5vmwoQdOu9Nc+y4UXDWGzjX/HhMlfpWPIwYweezgH7n8Z9909DmN2IYjGKQACMu9r7UUG+iOi3EeE6zCO/enjGvMpTWKf5xb5YBpMln1bGj5rbErOdrPrR3J0Fh29T1xObsFLBHVkmwjvDlkSN2DV86GcictwoaM2pAW72lq4NK/qGy66agG1Wpvkla++iZMwVEeW6UencwQaP2ZMzC67haRuQEmlPuy5517dT2/f02nfE9RKQKJpTj31zG9EWhwGpsonPj6cSROXCELK0+/yU8nB+rJORbOzhJnBLyOy6ij+cZkBDFnO0rH5dtSHdOCk/TCM5KQZH8Zhk5T2Wj/dd57NpOYyx3xxBDFLSQPPmzSs5VBKL0E0SC7fp5l9Mcv65/PUC4/z+DPP8PQLFIfvRwAAEABJREFUr/H09Nd44rnpPOnbs6/wxDPP8vyLr+CoU82WaIaFJ596hWdfmMczL73GA489xcNPTeeJp5/jicee5ZnpL9LbPUBYWEJv7UVMrswzLz/FE9Mf56HHH+GxJx7jqece5OnnHuHCK//B3p/4AfffVyYojSFoKeI04z0x/RnRf0w83U81XYT/V36ZJFm4tJ+Hn3hC+GYye/EAlWSAcrpQzhbxtHh8TPw+Of1VyTFDyaGCyS8lTqq8OKtX9J+XnM/w7PTpPPLI46I/nbvvf4bTzr6BPfb6Dg8/khEWR2mW78ZEAc88N4vnXpnHw489z+PPvcijzzzGk08/weOS9/Enp7NgaQ+pXSytLKRv0HDP/Y/z1LOvcdtdj/K1r/0aH6RR02rMmF/R+On4McuWJWRZgs31Y3JrKcjXZoePHMlnPv8Tpr+ylO5lA0oAjr6+hCuvu4d99j+KZ55oxbpPEpjVsCrHK4MDBAV9CgwP4B9/q/DrEy7D2pGYcAyJG0lqFGxK/qkJFPSBqtpBxk3I+MZXi6Tdz8HjN8tHHGklJoksRp8HQz/pfQgOmhqrWAhwVcnoUlo33Q6iJsLQcNW1MTPmtYNgeJfDVRSHcTdHfHEUBSU940xYGaxse/vtt8vJ32WwXlu1/+o849LTW2txfYfAJPnW5pCjvjiMfH6JKjChykIcBqdbTCq8Cnani5p1hvvv7GH682VsrI4oh91kB1LqRFr72qSAPAIh0IAP9sxZx+DzD5HNn8Hn9x/KsI5ZpIU+rYONCh05SxATBAm6EGhjx6aLWWfdDg741HYccNCOmt02ImcLRAqO9vaIAw/an4MO+CR777kTxvSRi5aq7ugjJNMaUPKmda68/G/ceN3V3Hb7rVx705Vc8rdLWW2daZDOo7lQUwlY0dpWiktg6tRJmqXv4t677mXPj38StP7NpLI7bn+GyI6n2i+9hgUFQoxLK3idWTTD1FpFv41EPHv9u7Qbl9WRRBRMEZJmbNIk5YpIoOCJahgqhPWYUO+dEFll/xx59th9d+594F7uvvcBVS9bY0zIQDnm7nuepFDoomhD6ccSpAHJQIrRn5NPPIHrrr2Km267gRtuuZWrrrhWlcIO2KybfFiWTlICY3GJ5BT8jddP59ZrBzDZNIKwotltHs7PmFrShVb6rRZoj/blhONv4JlnZhKGA6y59nCuuOZi7nngJvb8xPYEto9CUzuXX/KcEtxk4SiSJJALp2CDfbnzzoTDvvhl6WgAa3sFP0gSK+mYHt3rWcEnM2FMhqnN4RBtTI4b4VjywA20VVKCXMkjw5AQ+Lqddzrer3cBhO00J80kqawybRPs8PG4Go2NyTvu7QdNYO9KLYswJmLkqGWMGB9qTI5KLVr/Zz/79obvOlYAVu09n8cdd5z988l/3jS0ZrzLHButl2PamiEurmOwMmxOeo50FSOIF69Mt/y5XmvioisW0D3QTCSHCieuS3X0mrjM4J2lnsg4VuwYDVzF0yiQQApWsxmqWhxGyclIoaH4zvdptr79Moq5Ont9SkkqX8b4ZOYki6dtYlTaYCpQCHU7+LT2VYZw/nmf5W9//TGHHbIXxqlfFcik8aP52zm/4i9/OZLv/XgH4vL1oGQCZVGPMVSV8zJGjR7O8FHNtLe3MGLoKKas0S7cfUqUfYSSO1P1JDeQFkOs9DN21BRGjRwj2GGiZUDOu8Zak6jXl1DKR5i0Kty+2yoQmqTDSHRVUdSb9dyCEEFQxSoogzDDGsGSI6+kjHhCSTnQexlAeAIFTih9pCg3CFeRkFamTl6DyZMmMmHCCPLFTHCOMKjhsgEi68c0YzQTGK87YsaPG6ayvZ0RXZ2MGNbK2IkjGDG6RFpd2kimmlDIBQ5UEaBLtV7g4IN/wksvdGMjBW80iIhgvc/EmfSnqjLbmquveBYcSsYZv//dSey6065svvHWnPHHM/jnlZdz/fU38KOfnEy+VKIeLFGSGI9xh/DcU1P54pE/oRpX+MJh+9LSoook7qYQpSLjNPnW8ckIMlw9IS0ahowYYPcd26nPfYnFD9whPUR6rSQheQ2W/zzcf3atao8xsq+l4DcdY3lScyf5tdeTjSLpxHDnbcuoVztExcq3dPGnZ8MgNelHXCMJjXgO1NPcXOeILxSINNsZstZHHnvuM4rlkHc53kratx3ihrrSEw89cUIcZ6VcznDgoa3Y5AktGzKNiUlFXDGIScS4ZjunHVanLxIJTcxZNokLrxM5O4AL2mnb6pOUCzK+bcXYJYrFCvIz4Vm100hJ1iMyRbBNSgwZxSyRqkK1Ik31Os3P3Q/P3sK++xcZs2GVNEzJVYoU45jA1VAHJm3G5JGTDSrYBD/wc9LBr5FVLlfw9KAcQ6YdfltPce5+BiuHU619llp2LjasSyYZDjDGYGXSTTfdkfXX35gNN9iAjTbYhL323BGn5KTX4tMSFdpQniQ1dV59bSYf+cjH2Hqbj3DOOacTmICvHfMNdtl9M9GYLicpi2aO0LVgs2YlDKPAWUCa71fJ3K7ZoZUgKOGyjFoaq88xaPrIwh7ZqAyeeUA5HWc7qIYtohtos86np5hMSeP+h+9i7333Z/uP7sTFF/2VanmQ4e1t7LX7Dirp5xPrT+JKwh2Q2RpStPR5ABtutAXrrrsh66+7ER/beUcIy4JcCvKJNA3lqon66jQ1j5SeHH3VREn1F9RNprlZTBnx5YoQteIKLbw6cw4LepagvK5ZNGGN1dYgji2//8OfOfkPv+TmOy/lbxecxvE/Ppn+/hFUnfwpdwjV+nZ86Ys/Zfbcfj532Lf48pe+i983CC2ycRfl/jWJzTASI5ouw+QCSL1e5/ONLwxhbPMSqo/8lahPvCtRGVsg1Ua1oN90egRv6lrVR5fIb/q016GYKLRTjizhBuuQKNhD4K47+pmxcC3QZKa8h4B1b2RbRxIEqp5KNBSmScBJr00m4cgD1mRkaxUblMOBvvhjV155RzPvckhV7wKx0utLTrt8QyJWz0ehmTS1xO4fH0WuAEZ/xA2aBpGGQcygALUFBwzIIQIee6rOQH9NzqS+ztG0TF1fQ7KGcZzL04gMGUkDVul0xpHZOijI/KcTo2uFGplmiyyX0pL0seSha2hqijny86uRz4l0Kudwcg6xhj+MfoRHb3ST4eUyYY8caDEm7CULBtVX1TsJ74ZgslYKZoCiZC1mVUINIe1ScHYKRQmhZ+qkcYwZPZTRo1dnmErEKZO1aSwniGvgUmiQQ2idI01Senv6WThvoXBIniTh4ksu465bX6KptCmDVfEa9BPbZVKb58PhFFA23wPhC5Ra55DWYyWOdgrpZLLqcJpMp8QoECZDMErcMgpyI4zkDnwizPKEYtQGhiCos3DRXO678xZefOEpMZWx6w57cuMNtzBtrUUM1u/G/z0Rb2uDw0he62D08AmMG7YaE8eNYcKkCUwcOxWklci00PAJQkxqMDFsstGWHHTQAUTGcv2Vt3LeaVdCLLnk8Ea8mFRK0Tq/X/sygfoQDaOufC5HbbDMBeddysknnMcfT76U3/72j/zqlBMYGGyTMldTW4f9PvENHn36JXbZ7SP88dSfEuSalIxkC/FZau6itWM/TLIl1pQgaRXtCGvRkTFucrOWVaOI5zxEOONecuK5nmX4v70ogA/n1OfYmmlGs6b4MxRGrI4doYQgHfb0wM23vUya5sk1SaBEygkNMoXODB8DjYcwJNPkkKUJzS2OtTfoEC6ZyyUjoyhd790Eaajj3YD8+9u1iTFv1pKdTWyKTs67975FKXwe1ELxIeawjRSBlQVtBdIALXepmTrVpIOzznpJzgqRzROtvRmV0mjIYlyQaSJrJpdYAhnA01q15nCauaGmIK3jSElyFoKEoN6HmfUk1RfuYedtW1h3msFV+7FBRCMvObOctPd2k7BcIJYfJia1GWmjPxVejdWbTHKjMjjMEmxiRCYgdDG+zynwMnRvUm686Xpt8N3HY4/dxZNPPsBfzz9bDtmPMZHoGzDKEh6r8E+ZOlkw9/PajBe4+MK/ImT0lpfyy1+eQVxZV8E7CQLpP9KbMFXVETJY7iQp70YaT2XBohmEsoNzg5TCfvKReNAM7UwTJm0SxwbjwBpVEWpW2ck0+KwpUUljAt9rr1249qrbGDZkHKGxPPL4Mzz11MsQQGY1w1qvnwEakS5cEp9zzzmNhx+9lQcffpAHHriPi/9xmWQskiY5rO3FBhVJ6GR2Q2Dr/OKn32FoR0EOPMgrL70k1ELuUowdFJxg07o2u0dSjIqYrIlC1MTMma/S1JZw1NEHcOyPfsTUyWsJNgTagQ4KuU3p7uni4YdeIFcoaN/kTtbbeD32+MTH6e3TbCy6nzrkQP7468splPSlpK7q1SefXBGpnrpK+SzXywGfyckfeynfdR6lPskpEv7rgYh84GfDNvLFqm0D+ZBJHK44hubVtiOhBWsNV1y1BJsfiYyoJpZkAwx6zHRJ1aEzcwRBqD0WWTeezacOKqjAs1hM8aUXpn/+D1/+Q15Qb3vat33zphennPLrEQP93Z8OXWS6hhg+vndRRHrkTAHOCo1TWzFGBsAWkJV1sUyfnnH7nQlWmSwptBJsuDXdgZ/BMjRd4VQ5RKmY9gKyiofReOuUiBz+MzEuwoU+igwtrsriu/5BZ76XL32hS18i5hNmKdI1RjM2ck+NBpOBDxYZCN/0lJkQh1XLQ9oikBb0Q2J7NWwQ54PFwwqPU/BkwQBZqLV0PhWdIvMWzGfx0l7mL1ig4J3PvIWLFfBgm8YTZ8KrBIKO1Dr87N07MEBdFUM9TUlFtZaUNb6b7qUhcS0vnSWMHTNVsE0kaZnzL7iKRQu256mnu7j88vuFKSAXJqy1ntX4l8SfIt4YXRNNwnI2rWEyuRH044I+nO0D8eCM1XvI5wvsvOu27PvJT2Mk+9KemfzouG8w69UmgmAT6jZHJpkzm+E8Xtmuu7+XhcsWMnveTMm4gIVLFzJ/bh+2eSwDiXSkRJQqyKAoGgMMG9XEhRefSkurEc4aqamDEW/BMuEcJJFzt3f2svX26wjeUq4H/P6Pp0h3r7LPp3Zkr09uT2uHFX+SjR4pcwGpqjG/15IGNbKszEDfQp5/7jlefuVZ4U/xS6k5c+fqK8pcJa1uNGNgtBwjkR2tZHeGilvEhptU2HvnAvUn7yd4ZbqSvueND+UQF1hvC8WLkU5yaVXLrmaC9bYhK7ST2pDpLw7Q3d1B5v3biS35Mf7qf4zXhx4MZOrPRd7SC9lpJ1+5GgKD6elbtvtlT142inc47Du8+7dXd9750N65oNrlQ2THj4ZMmiSXTcFag/GQjR+W32sadqnDFJoxQYkbbq7iMiPj5gnHTsGtviH1qEN+4MlnGhRgZRTfWOVDjCjZBCq5wiwnp1IwJzkClYatC2dTe+Yutlq/yHYyfM4tJtAMa3xtHzhR1tiGBLr3Cnb2X31ZUZpuJlcAnakAABAASURBVK0Vacl3ynjNyEq4fEbmysRGyshlOLXYZXLSKqnyfCa61UrA9tvvzYYbbsXGG+3AJptuzRZb7sCV/7hfcBM0Ww3FmC7RyhHaEi++/KrK7m1Ze+0t+PSnjyIIWmhqCll/rZHaeU6JcjM17jEOPmR3rCq0plIHfzr1dNbbZFs+uuMnmTGzIscfxmQtXXb++Lrap3hFgSw927o48tVCRBCOI0k7pR8rx8uIVXq6TDLJ2ay+O5erNWos4icnHoTJxWRBxsuzZ/OX8+6jlN+PgepY4WqRffNgNWu7Fg46+ItsuNH2bLrpRxsybrrlNvzulAtxwSjC0hBSnxlCIzlbJENANZ7BJluP5cBP70ql7rBIxwGCj0GVHoW6fOYGvvHtHYkKMWGujXP/co2+HO3ElHW3ZJPNt+TBBx+QH2XSEVjTJ/1lWrblefaFx7TR+RozX5jHnJmzue3mqylqDZxjFOedcSnf+eEBGvAENqeqgDoqE4QnIm9LRPkaBX3C/sYXW2lyNar3/ZNWJ55W/HsGX+FmKWEgZiXN+39m4CvJoCa/KBNRRXUU+alrYIYOJcaybKnThLuQ1LYSK7ZUJqkXMOCTvITBmQxjLIaAyDpaSwPa65qmWMvkT8Y8//zzO/EOh32Hd2+80pKiMDhQ2S1LKOZtzKGfHUk+6NasGytYKhA6wfr2r4vJpcTVmGXdQ7nltkVyjBwYzTprbUY11wJ+tkR9SiKYCrFVvpQgrOqhJENWwGQ5HCGpkQFTQ1tfmXn/vIAoXqbPjiMVVLPAJGqAEe8mRloDqRJ/mFS/6vcq9ziVcNLYUShaqC8gbxZJ4TWarGRRYIW5ZhI5kP8nzsjBrGawMBAf4sEKl0vqODlXltZURidkiVN5nScyo8iHbVQHB7GS34prP9eXB/upV9XnUgoS4WNbb80JJ39aeryBpsJj9Pf+TXYYxam/PQZb68bUKtRqZVUbVaIoZqvNJnLB+d8iX3iAlBcI9bnUmKV6rmFkQ3mYnKVdoucJszYCQgJPX81ovdvZNJxq9VGaig9xwk+/TJMZTkSJi/9+nfZCcgxpWh+TFvG85oBAakEVjEsHG7IlWnom4r+g6qUQdFEfbCUMHU15izXymWRA15fE70P85CdfYqN1N8Zmw9XyBEo7jgEMy6hm17D2+vO59dafssH6wzEmR22gSGVhAPUSna0j+PbRRzNrxo20tT1KmtxMrfpL2jqOp33Ij2npOI6Otku1H5KjJWcohpbRI1tpKk1XUp4uPzTg7ev5V2KM4oCc9l6EiPW3amLDKRGDL91IbsZjFJT0BY0NQ0wQqlyP+SAOZwyZ90n6cbYi9hwusvTIEYIJk3Sfl93gtNNnUoublTgFr8/XJlvBzXLfdUb+a8VxGoFuQ9PPjjulZLqv1tK2OE63fae/Tu1VsgLj215/+IufrJ3Uq1toQ9eMHROx3nqQ1epylohAxnaxuDJiSEQ9P0YzrrNVgijklec7eORhMeQTQamVwvpbksrAkKqaKChIJXg4QN16Nwvelof/6oXY8fCJzXBBTC4u07FoNslTd7DpWhG77CWxzYAHWd70iA8YL4N02ej0139pW10puahOWn2WvfYbz333/ZCHHjiRM/5wKMY+TzJYBS0pUq3tc5lh4sQ6N137Cx57+BQef/R3PP6Iv/6+cX3o/t9x152/4RP7ro2rPUuYPMEaa9W4/44/8OD9v+XB+07i4Qd/w6MP/47np5/G4oVXcuFF32X0sLsw1RvIs4jmwjMktTP5/OGdzJn1d6699gQuufDn2qg7XjR+w213fpG11r5HgfJXmnILlIiWQvYC3/vex3jg/uN46KFf8aMffRSSGUT1MjaZzUEHTdZM/HsevPcsfvKjA2gOnyatXc/hn9+K+268QP2XceVlx1HIz4LaQlqKr3Hh377GffeexOPi9fFHThbt3/H4Y3+Wbk5TO5WjvrQBQe15SvQweUI3d99xIo899Bv+/MfPSZ8PKyleR0vTg1x1zXHcf9+fpNczOOTg9fVV6BUFaZkm9zJGPGy24QJuv+1bwnkSl1/2E/5y1ne555Y/MOPl8/npL9Zk6LDLJeP55Oz9ajcSmUuJ7F+Jgr9ItvMZN24+d956AnffeTybbT0gvdyFSxcRak2PkqHD6JIq6AaJGhNWSt4s4+ijJlOqL6TnvitoUnmPlnmZlnvoMNY7jm7e59MpfkQdtAzWDzFFjHwqzYXYDbaEqEWJGR5+2LFkqVGCMNh8CUeAcWC877LiSMHUIUNve1l3g4xRo9TljO3t7f3ohRderife8rBv2btS53HHHRc+89ijR5sga1Pi5Mgvl2gp9Ur5LWSDOQgLDWZ8tsNv7EgwlIFN5ujpr3LR32eQJYZAM5KdOoXy6PHiM8BL5yiQ91na9pEFMo4NeV+OzCukRhxWcbZMm64L77iGwuB8vvHFURRa5+MCJSUiMvHlDMuflRwc0uIbTHhN69lkknGQwPWrGnpUznoZUyffy7pr3MzUsf8gW/Z3iiqDPff5UAuv2gD0n8Nak//B6pOvZK1pN7DW1JtZa8ptarewxqTrWFP37dFFwnUTeXs7tv801ln9HqaNu461pt7I6hOvZe3J1zF26CWy7W8pd/+BILmCKFyIqUbKZUq+5gH6ek6hEJ7PFps8x5579LLvbkuYNvkGGPyN4K9SgCsABqVpVU+m/CTDW+9k2po3MWm1Cxk76kps9U4KhWVQvkN2PZfVpv5TG7XXM3LIOWR9FxLW7yGonMqa61zOmpMvZeK4S+ko/JNccAf1wTOYMOZa1mnIdz1rrXYda027kbWm3M60SXeyxuQ7GKFZOxm4hlzyMDn3N1Yff5f0cj3jh9yoQuNWulqeo9Z/Jm2l3zBt9b+y1lr/JMrOJ4yfJqgZigkUklex9UvpW3oca652Jbvu/Cyf+tQCLb1uJc+vFOSnUO07k2LuOYJ6TeMsYcUSVY0+UadE6Qy185ki2qtNuwQTnAg8pMRRxtqa7jMSa0kCf1+F15NDFoV8/OOZ5ClQeeZ2TP9CwoJm7SDA+QRh5Dga/X6fzkSaZ5oJMgnvIiWHNs32ga4Bdq3NMO2jsSbn8xQvvFQnyuXJVNUaH3srMeN07+S7eJ/OQjA1hnQNstc+SiRyeueijnvuuWMH3uawb9P/Rreyy/D+nsGdpQYzrMPymUMnE9hBKQeMFJWqanCeEIbESGkCRFnEEZJvH8Ud9/fjXIDfaGtbb0uCsEioNZvNYpxxZHpnNN4nC/DisIqHk+LKJGFMGlSEMiGe/zwDT/+TMV01tt6pDWf6xashNYHUJt6MvwetdHCSI9OzZ2nF1fc5q+wrzgrN3crSj0Goct1dR67tVsLi8+AquNRqHW8xgZJn6RkIryQMriblao307Rpdr1IZeKv8zz9fR5RXsKcLCaKHSbLLybXcqXc36/l6MnMNYe5WgtzN5Ip3Q36OZoYUkpL62iVnQlPLTGzxLvF+hZzlT3Lws8XDtRr3NCYZhLggXF1kaUF2WCTa9xBpdg2DawmKt+LCuYLpJ8i/SrH5bgrFG0T3UnJDLtfzM+TD+djoHsidSdhyHvmma0jN3cL3OPniw4TBjQT2WjBenmukB71HfAfXE0Y348x9hOE80ZqLMXeTJNcLVnC5O8gFM6n0zqXUMVc83kpUuATHlRRbHsbYWSg6wESQVqTzeTQ3PUe+dKNo/E19Z2GCi4T3LrL6bEotEXES4WxecoYYW9D4UDbQpdAjnd5Jam+lnF4rOg8K70xAfuxisA7n6SB49eoBS6BlVZ1QPnPgQSMxy+bT/8hNmMGlwm0QQ9g0R07mCJyC2GQaadXeh1NBblxOCS0Ua1YyBWRBJHoBpVIn0fBxShR56pnhhhs00UnmehyTYcCJvi7+xno8esSowzVBlpdP9PDpQ6bSnBevhmDegtl78jaHIN7mzevdd9577wbk7NBIzxuv30qLd2YXY4M6RHIqW8VoyeATQBzGOJOJCV3lwI++WOTF2an68jCkg2zdbZTZnRhUIAmHpi1qYYhL2jTLpVKEDCU6q3IanAwr3sKIQAHRVW0mfeBmKfplDj+yja7OxeSVZQPn4RLB6qoEZZVZja4YK/IySON+OTZnAvUZyal3aZ+cfancyMuOePeOpX5rILQEQQqmT2h0Ta1kCgi1b+CM10Oi/kHxVaOUy3DhMlzgNC7QNSEI+yEZpBBBFOrZJugtNsgIVAEZI74CwRYV9OlSIotwiVzSTxQMEmnzLDK95AKjcQ4jPM4qOds52Jx0HtYUOK8RSf5iBtSWeAFwuQAj3k29SuBVZ0WnKrmULZ00FEQGG4CRPEFmsCYg0BhlMyIjOtQA8WqMrikR/fKIZQSmD6x8IR/gNA5ScoUUGyQY26u+HkrNIVTVHxiixNBkLMTCJ/mzICATrOcv0yfGnAQ29ZiAilCVRcuopUpSMSapE2kZGSqJm8jrVrLKFs7LoiAJtd/hddSaoyFjHoP3ASdZnDAG2rQO/V/hDwGxYOKQgvSv8pjddu9UJRdRu/Z02pa8oAQt+k0d2KSZYmyFJ9aYFIQHP1h3q3amWF81aO8s1NUEffIVR2aKhAM12qeuTq0YEEve65WTy9UC1n++NxlkFqMLmt2M7GXVCDKynHwr65Bf1Zk8dg5D2sEE9TBJk3VPP/10vxvOmw/75o6VnzWo9PLzL36BJIysg/0PbiVDRDxBIwP6hl5Ql6ozCRS+rpoA54r8/dzXqNUzUptgR61N2DGCWK6TGVnAO8EbxIzGOWjg0mUVTiNMtt5EVC7QVhlKx8JuBh6+nSlD4KtHr46p1sSnTJhlunojvLm9qV+BbTPB+KvTO80SVonN+qv6jfrfaK8/W/U1xujZyrjWXz28719x9f26Xz42w1+tnq2H8fC+rbhfqd/DGT2bxjvx8wZcIh9I1RLJpab3RjKaBmwi/L7Pt1gwaaPZxrtU75Y3z2egcf5qdTUrmvA0+jyt15vxV68Pf/VNsNbD+avwBq83K5jlfKR4nA08r8NYwdiGHrwc2XKePC41T9s24F7nzd+rv9Hnx/j7Fa2BR/j17McZPRvBr9ys3ln1ex4D3fvW6NO9h7NKOEaNxuGkE/mJ/DqI+5k8znH4wcMwA4vInr6T5vpSGOwBJa5EEZT6zCm/a7ivJp0GilX8Wf6JGMWVCGQGUt8sdcVOfsqaUGpvkFs0L2P6UwlGr/E9/iZTfOE7HG8cSuKYOk7L+NY2xy47djbuXeZGXnrppeu/AbfSjSiv9PSm2yuvvHJCf3//TiYNzMRJhm13jIjrAxjTjFPGlQY1QkyIsE7CNERP4jFksLfI5RfUMYHDhUWKk7cmzrUq2xVJlSAIIpYDa4QfjEMD1VbtzDS8rpIpzdUw+qg9++GLcP3Ps/seTSrZX1OiGiTJG1LNJG/f0PsVzel+5eb73/z85r6V36+49zAr2oq+t7uugPPXt4NZ0e9hVrQVfW93XQEGJnYZAAAQAElEQVTnryvDvPnZv/N9K5p/XtF834r7FVff59uK53e7vh3sW/W/Xd/b9b+Ztofz7c39b3qOYhI1F8iBGi0lCBMSVyN2L/LJg4qMbk5ZevPFDO15TXtly0jqvVRVcaWEoOpEI9+fU1O/C1LFitAqSGwqhjKDU2KoqCZzw8cTdI2hMb/K4R+9p6DUlFNzGqB4ck3iQyWS0bPG64FGrNpBwWRkaS/7HTyWUhQSuubcHXfc8c1LLrkkx5uOd0wOTz755A7GRMW8Sdl1t/E0tXRjPcHXM9O/9GFE25FrZGFRCCyvzRpJUhZzBsLWoYzYYEcGyxkuKoldKRMrQL3Urz9VBfnLqjehtAWVuMyjJXqa2rPnM2RIype/vA0uaCFpGUG/9VmzC5sO/bdm9Ly8dWHS/3z/Zvjlzx7Ot6H/hmv5uzf3eTjf3tz/Vs8ezre3evfmvv8G7v9pWM/72/Hwdv1+zJvb+wtrsk4aLR0O6UgtbYbp2q6lWpHIFBnVGXDgbiPJd8+j58FbaUp7sCWBBHI4kwfFhK+SVt2BhUEoCVIa8aVN/lBLBZsaLZtyuLDEgD4zuynr4gRQV//D9y0moEkDnWIrI9PegtM4fIwJxvc6bWz69ZRPKFbVzbQ15zFhvMNlmUnTdGOtElqE4N9OH6H/1rHiQZmkeXBwcFeVYoaszvY7VSnoW7nwimYdf1XFKHCr8iRENSFpPVZ2K1CX1m6/ZbEUBk4QZswUGDqGLCqQKtM5rSWdH+yRLIfQr/GQaqt2mswR9RqG1y3LHr4Et3ghk4eP5IZLK5x7WjNnnhFy3jntnHnWEE4/s4MzzhzyeutUn29DXr92vt4/pHF9A1bjzjhjeZ8fe7qeffP3b9n+A/bf8f7bmPcA+wYfr/N9uq6evr/+Gy71v/n59LM6OV38vrn/DPW9efzpb4ZdwdvrsCvzcbrvE/wbeFfAigeP999gpfPT3w7W49F7j2fFuNPV55/f3Hy/h/H9/tqg8RawjXfq91cP61sDVrz5+3/ZsoszzxzK6WcM48wzhnL22V38Rfd/OXMk557eynnnZuQ6J+NU8XY//qTcvSZ/TsEaUPCaxswubzdq/6MLC9PrIz0OJQd1ZEY/egwUL2lSVWxZ+kyB1jU3gaCFGMsjjyfUGb48hjx936wGrcDmZ16fHATh6hoWZnR29bHemkoormwE1rxkyZJ1df23822Tw1VXXTV6YGBg68BmjB+TsdlmoXJEGVVR4Cl4BpSnRA9jA/VBoCVEUk+oKdP+/dJXqSRCH5QoTV6HZcofzhjB+ezwetMOhh/vOcqU+5xPa/5hlZr2O9IO6pUm+l+eQdC+No+/WuTLJ73KF3++hG/+opdv/ayXL/26j6N/3c9Rujbar3o56gTf+nR9va14p+sbsL/SuxPV1OfHHf2rfnzz92/Z/gO27180f/2m+/cA+wYfK+jr6ukfretb0l+p/2jxfrT4/Q84378SnH9/tO9bGXYFb75fsEevpLujBXe0+v24RlsB24Dr+zc9+3FvC+vxvI736MbYfum27y31dXQDdvm7FbBHrcyDxnteGu9Wgl3e1/8vnK/zesyveznGjxGOI0/s5vCTu/nCSf0c/usaR5xY4YiTlvGry14hG70eWVJk2QLtO/iNUwdW7hzIl12oZNGIi//NgYVq+UB/o2SA4isxwqxANybBOm186l2mSsUMnYSJOog10S7tS3no3qX4vTxnwP+lQpQ2FGw0WqMvw78z+gBgEqOFUMwOO7TgEPPCNH/+/I0E/K9TYxS9/3pe+e7aa6/9jDGmkGYZXzhc6xv87jNY7aA6P8oqBXlFiNlUy4nMaA9BAR42FXn2pQovzvJkSxAMJV59Hfq94hAj2iiCRKR8S8H4PiMmfWOVD6+AekFVQ65A8yHfZcyPzmbUD//O2B//gzE/vIpxP7iY0T+4kPYfXUHHj1dqx11Jx5vbyu////f/rq//H9NH+7GX0fbjy2k79kbafnK12iW0Heefb6X9xzfRceyFDP/RXxn9xV+w2rd+TWnkJPl2qPDNiBQjVg2b0PBn3odDFbCCAj9hJpp0U1PHmCpWO3ZkAVHzcGyxC3IRPVXDzbcEZKaAwhETlMGIF7+B0qjOlRhsDX84P2HHBajX2WqbJlpalD5cFixatOgTV1+90v9TU4h8mPsx/9Zuv/32sFKpbKm1SK6o+N5p1yEUSz6IHS5pprF+MRriSxUnQoHW+GLEmRYtGwJuuyOgovVDQl77DWNoGT+eVMuyIIu1AZISaNc4UJKwyo4+vwgTkpx3Ojy5d3r/xjujhGMX4Frq1JomMYtW5nVN4bWh45g5qotXS6uzoLgWfcXJ9Bcn0V94veWXX/v07Nsb/Xpu3K8Mu6LPX32/b/7+3ZqH8+3d4Pz7t4N7q/636vM43qq9E+zK7/y9b2+Fw/et/M7f++b739x8v28r+le+X9G34urf+bby84r7N19XhvPv3vzs+1a0N797/XllOw/kxzBYHKU2koHiCPqahtLbNJpe+UlPYSo9pcnMa1udhSM3YDbt1MImbE5OnWXLk4MPy0AxYt6zp/J2h1Fc+GrEo0QR6idjp8RjiBU7MUYBb1Q9FDfYAiKo6fmpJyuKPfEj+s4Hld9z8PG5gojv8/eZ56+VIMkzasxCNt4sIghChZ9Z47jjjtNmiwda3uzyy7//3vHQQyPqcW2twDpGDM8xfrSqBu0nGCE2JcScZxBVERouovrFz9hVa4njJp55JCZSjLpA39bX2ZLBsAurTCUOGnDCwBuHWXHnVty85XXFW5GgkA7SVuulrVyl4DOh12RUJpDyivW8lj5FtMlMXNfVtJMo02ZZrI2aGBcUyPT1xMiOocYGWYJVssqnELzwAm1982hO+klloDiqk2jH2knhxBlBmrIcXklSFkuFJFEFlShLp8aRyZJOSRI1I11Z0dBJalBzpI0/iXTgWwymrlbDNf4Y/a7U3Er3rHT/Vv1v1bfymJXv3wl25Xf+3reVx658v/I7f+/byu9X3Pt+31Z+9vfSn3OhJppAzcuX6ap1tiYNJ0029AY0/n4Iie4S+V3aaF6vMou+jlnCJCDUp3WboiPDfzZPTLVhtyRC1xBf1Rq9D7Q3gM2ETT6gJWxEH9bJxgqi1OYJ5SOWfvVVMWkIWST6spWtkSkWXL6VahxRb+rUc0AaVwRjwDWLrwKByv7QRgypVBhTWURTog18h/wmlMRiwMb4/IH6xOw7nFbwZvn7TMAKfqeezARkuhr5UTmMaN1wG1AVIDZ5dfYgLmnFCd4I3hiDMxkSxp+NZhw0/tl5w+8MLaWUzTbqIPJVvXGl559/fsvlRJf/2uWXf/0qe9ibrrtuk8y5Ialw77t3C02FbjxbDahsCcbEWHm80TYI1ivIYWwCBQ1gBI/e16+aIYKwgll3c2p0UlDApBJu5ZbJQM4j9VzTuPNPb98EUqBI/f47GLj8FDpfuYfx1T5K5bqMY8m8MhTANi5ineolGdtYQyCj2SzBem+RUIl4j0NHqncuqEmBFUr1OrUr/krPhb+kc8FDDEl7lWRqBBj8EeXzmJwhDeVMkssVUnzWFiFEACerpzYl1TWzjky4k8A0rlhhaDSLU7/yBs7wevMwGYnG/b+rpZLZqpnlOlP1mQUxSbi8pVFKpnI6kb68HlPpMg0gkx7TICXWu1QtU5ZIwiqp+hObkw/kcQVNCpoojCYR6xQ0toz/X/7VydSb4qJmCjJKR/llRtRmESx4DmP0TrNx6vnQDORQoKENO9kbTTzexjYuY+Rfic2TRJF8Xn4nulVyZHGOaGk3xZ7FDJ35DL3Xn0v5gZuwSZ1Ak5NF8WHVRNdg5BBvf3rfSM0KGMWU/N5plyDR0j2xId6/+iNDOmaykAxTM8xekFBZlseaHMZorPSFZAE/2GBT9QmxVYLC9mBsFZPEbLZhE9Wa0xgCG4ZrsdJhV7pfcZt76J57vhOaKGhpsuy210QRFIMr3r7F1YiRNE5J04SHHtCnnqUpdZtCvo38sLF4yokYYxUPiyEYDJi02ppkT9/Cq2d+kVeO35/Sw3fSuigmJzbj/AKoL5Lxy+SiAQh75TjdZFGVTAGIDIkUSGSpRwINpDTjlOWrmNpi3DM38Oovv8DA+T9kzNPPMqmnSlelgIlbqGojKs6VSAshadAPiaFQHk6h2kIUB4ROxjc1fJJIgojUNMsoedkoUIuwiVwybcKkbbhUs082VNVMl8yX5/+dhwxGhneNDEtmAmi0CFyoFhGkzWpNmhFL0meRRmBq1kxyhno+o5avEUeD6g8E0w71IZj+VvJJSaGdo1luaDWbumIk1JZmA8MGeml98k76Lz2F2ccfRfL7r9HZ30NihgnPELVm8eJtEkGmq18Ta8IpVus06ctd4CsGTTLOCZmNiZJehpkegpcfZ/Csr/PCqV+i/85ryI8YIY9FrS7pxIhkSpWA/DBW+XAgPeTbO0HLgnqS8sRjM3HO84v8S774bjQ0Ya657ghaC5BTaqhU+9ZzDaGWD7TLL//6veOOO0akqZ1iXZFJkwMmTp2rl7HaO5xK24EJEX6uuSqlVndUhTnomECYl7I1/6Y2egcE7+1VRkbc1EtFWbN15DQKynzTSi/Qd9HR1M4+kvx9lzO83ENbFMogUKsluFCSBzkwFqMKInID5DWjGIlk0wDnQmENlCsSvZ/Htuvk+f7nxjD01SuY+edPM/f0w6jefTbti16kTQ5RUPURljOCqsOYgHoItTAjVpZOgzqNf4OhBGFUrhrRSzXzxDk5sFqilkYJaS4myyVkGpdJLe+Ps/D/XYcB61I16bHBuQXpE6TQN5olUMINBeebr/6Mnn2zqlotNY3XiKRZcAZjBiHqwxX7iXOOAQXKIJ0U7DBaF1dpnfUU7s7fsPTMPVnwt0NpevlGWvqnQ/9iOhKHUa4ysrGR3QxV4a5oyVIjp3d5+Usim6bFmuw2iNWkUojztHf30jT9Ruaf9gUqf/0G45bcqQQyC9qbyGlizKKC+EoJFIioesb7IoZVPoyRHxUIu0aD8k6sdvNdAcY0Y5SKnHTWEIi3PxyO9tYlbLaxKi05Yhab1b7y/c9pl3P5GLv88q9f7VquZ0ypNVO23WS9JoZ29eqlKOv37U+LkQJTBduTj5eJtV5LioZw4x0J8i0aJkFsoOsqnhaq4QC9Q0dR2Hh3CEOOPmIaf/7ZRNbN3Uv9/G+z9A9HM/DgP2mqdNOiBBdVWlQRDIW4TboKsGaAHH2UNNPn6zmsZobUFIRXScJ20zWqwrE/Gc8N/1yLHxzdyvjofuq3fp25p2xF+cIDyT1yDiOXLGJU7xCaYytHnI/L9cruXkc50ShopgsI5UgR/Rg7CLauVgNTwZh+cL0Y103gloj+YoycnP+XHaYhr0OKwDk9GQv4puTg/FWPStv1wgA1tSRXJdMsHWgDsBA7SlVolWpLFVVxpkgaDeDyc7DhPC1pB8hX6rTFlRIrXQAAEABJREFUNXJLppPc/xeSc46m5w+fwV55MqtFD/PDYzq59tJN2Xk3+YXGxlk/+ayPyPUrNfk2qGuFQEkodIlslWqvoSo/6VeFGtHenRE9dDeD53+VnnMPYeLgzfzsiE5++83tseK/ZetdyNomKm4LJDaTP2RY8Y565ABeuFVrxlAP5W9+aWEjxRw89mxEon02pMvEORrL7Hek4mhp6WP99bvEmwANwy+/5NK1ddc4V1ih8eC/UnT3Lt04isIoo8LOHx2uUrgm5228fvsfbd6ZyJJmLbw2s4zUACZi2MbbUalLsWGA9Mt7P94G0ii15wYYiItEUw6kWtiAP1z2DPt/dil33TycM346kqmVZ6ie/y0W//ZgCg9eysjuZXTUcqoW2rHBEKpRkUFl/VSZvB6kZLkcPrsPmBxEEJQkr3mWyVNe4NhjKzx271QuPXUsn/lISPPTN9H/p28x+5e7s/RiVSqPn0Fx6WMMT5bRWc0oDpYwvc1SdDuJHCQJNN14vFkTaKPU1iz5NKKo7uZ6SlO9RnO9qtlJcr2NyP8/2+2QX+lHs5duwP9IZ3hf0qxndQ3Vii7AaE1sfSnqFGimiVqujQGXo7fQzEAuD9p3MLaH9rCb4bUeWp57hfYbr2Xw1CMpn7AttXO/yJDXruKo7Qa57oJRPHPHNH76nUHWXWc2g+kgzrZTM+3yA0hzllgTWaplYV2zvA/Amjxa8wD58miGVIrknriYZWfsQf8ZhzBs0Y0c9+VOnnpgbb7/4wL3P34fA1EbwTo7Uc7aQAGcyt+c5Ms1kkNVojpW+TDQr8q4OFmx7CKEnhnz+ljW7XDSk/Md1vGOh3FY28umG2fkVc1aZbWFM6sfWbG0sCsPnjHjieYF8xcd6P/9xJjhKWutbZQc3oUAOhS0zhZ48UXHwl7EXA7TOp64YwQ20PhY0RBoRhDoKp1ZSFiZRlBvp09JomuXTXhtQY0X5rYT2SoHH2G4/Z4pnParMWw+5CkW//0bzPvDniQ3/Zpo5v20yBEiOVWWayYu1cnyZbCDaqlUKQUnIQXVZ2FWJhfUSJNBomQGu320xlknG56+YzSXnTmEz+7tGLrkChaddyzlXxzN0t8cQ3Dt6bQ8dQejKovoUklaNAmQEBqjq3DbPFlQ0hJEzh02MygeBnLtuiqRBHovqP//6VRIOMIsJp9UKCRV4iqqxArSY5EgDgg02eS07m8uBpTCGm2VPkY88gLDrr2eyum/YPEvDmbJKQez4J9fZT1u4rufaeWqv+d54KEufn9aK1tvXsWWu0GmD5OMNm1UGbuA1CxVUohwqiKxzWSuCWtz2LRCmyaM3OBLlG4+j95fHk7/WT9iWu1pfnPsKO69ZQzf/m5GXHiJmcsMVz1YJZy8EfVRa+F84krqOJtpDy6vwDBqdZnZqa3iKb9yUUR+1EQweTzGucvixn/8xaQROb1r5CLe/jAaZNKELTcfRqkU4lKTU2LYaP/997d+VOPH3/j25z+fNV7VyIhQjr3+RiXGjulToEsohY5//7YtEBWV8LffVlalkBEqW4Yt4xjMF7CmRigGUBZ+2/Hv8YURczntFuPKmFJEMH4z4oECF1+0CFNoJzFzaR76Kkd8usxV50/iklNHsPXEF4jv+gmDZx9E9eJvafPyajrnvsjQ+kKGZssoJt3k4gotqZjQEsNkVjLrXrNWYGu6KYOya1AYZOTIZXzykyFnntzOTZdP4PK/TOKY3S2b5J+EB05g4d8PY/6fd2PZnz5FeMupDHvyVkqvPkx734uMcIvoNN1y+m5ps4yTjrPAkkovzvybGUTz/wWnWSHjihsnvWQq32NyWY2SgjLvBqFYVjXXRyFYyJDKywyb/wCdD11E7h/HE//mcMq/PICFp3+O3ot/zGrzH+JjawQc+62AO25agysvG8/Pfxqx6y4RQ0YuxYRzcUEvWbhQ1278xNBecKCNo6Bcw8YDSj5l2pIaw6vdDFswna6n/0n5r1+n/IfP6gvE99i863F+d2yeW/45ia8cnTJ66AIIl5Goar725piX5gcEW+5O1UTCVSV0/WBS+WaJjALKDmrvwyn/xE+4barum1ShGBjshaVLRUGTaCo/lkLflZARnuFjHF1DhCAzWvmYKffee68PeuzKo196ad7OWBslCsLNt2yiSbOrTYYI5N/A9PymU3jrSY7bb3Mk0nWiTZ1QG4Zla4UuwTbWFAJ607D/9tEZR8Xq60NbD5V8haB9Dcywj3LLJb0sfjUjsCF1zfxxtIgho2aw76fK/POvHdx40WT232IpbQ9fQv/Z36TnpG/Se9YpFB6+l1GLZtO2bBGFARkxlZ/kQ8qlPAOazK3MaQqGOGfICpa0mJDlFhJEL7LamFl8YpdlnPLHTq6+tJWbrx3B2b+DPTebxdjBewmvOZGlvxed336dvhOOpOd3X6N+xSl0PX4rExa+wtClC2jtXUapPECk5Bng8PSsdO+b0bXRpKR315wT1MpNj295rsC04vqWQO/S6em8C8jbvPZUVzQkr/FNcnrZQ+k60FLPqlQIqgMEmt1b+xbRde8N2ItPp/z777HsxMOZ/4fPMf+8r5Lc/luGLr6dzSc/yy9+toiLLvsIx/98W/b9eJEjPj+GDTaYQVfXDKxZiCZZIk1egQlxJiNVCR0HMU6bw2FJ8pgChUo/o8qzGNP9EsFjN9J/4UmqCI9i8Z++TNtDV3LQaku45fyxXHdlE1/5umXUmNcwUTexSwnIk6+O5ba/L8C1jqbg/1GUqp9cZQlNSR+Qim6R2BTBWInutcCqHZmGhxGDWoq1Dx+pB+FMc8yauUDVV9B4lmS6vvNpModhGWusCRmRXK7Qsv7m6w/1o8Spv6DZ0pnYZFMiY3PeST+yeYRLB3BmQACeE13e7kyhpztk+pyaEBnhykjWXIfQtjJoi1RzijTNzm83/L32S3zCBCXiQGVawED7ECZuuQvPvOx49AHRMO2iCTYE9PXAaLZu7VjM1pss5oI/jeGJu6Zx6SlN7LzGg1QeOp/Zf/4yr/7ocyw9cV/mnr0fLF6CPEdFTp6i9klsZqAu2WXoLKtKeUoOKVK++m0igy8kiV+go6POutMWcdi+NS79SyeP3DqRB++cwvX/WJNffCVl+2mPY1+9kfK1f2TuKV9lxg++wuIff5rK8YfDKQcSXPItcg+exshFtzK+9jwjKnMZHfczPK3SVKuST4xK7EAVDkokDptl4GK8jIT+WtGLCjmWEdFHIL59ixRsudQR+G/caQn8rn4SEMRNwlHCWrBBCkhhqRxX5SgKnkYjwaoFGfilWKjZyOA0oAqh7BwZsDlQYDWu1r9LFSiGomADI5yhQYTkfE44rKoBQ0u9QqfroSudzcT0RcYufIbmh68nuvb3BH8+Bn73LfpP+A6Ljv88M366h6qCr1O/+jcUn7+crSY9ynHfirjiik259fZdePTeT3LrDRsTJp38/Cd3ccP9IUvKO/PTnz9OIScZE9koKEAtT6AvW0gYIz5D6TPMmuWnIbUBQ5D2Mu+M3zHnpz8SzcNV+X2J2r2ns/WaT3D+aSN54oHJnHfuELbbbj7NTbOhPB+TpBjZwEptFTncC7N6ufeRMma9bUk6R+K0JK3r8+lg2AKihRKEdXXxisax6od0TDXURmwVM2mUZGgV3hzPvmwgHxEGNW/Vd6XjpI84WcC01TuwpiZ/KLfNfm3+VD/Q+h/frrj1oSGDA+VNnGaxUa0wdmwkoyYaMKDXTu0dzgyWLE4UW4MYE5HpK0Jh4gQCUyR1OTJtVkpb74DgPb4SG4Evl7IATd+UcwHpmuvh2kdxwQ2L5brjG9WDjUEyC6kGUMe5XsLiQjqHvcrH9ylz2aWjefHJDbjiwgn85GslPrn5bCZ3PEGLWUCPNk3i/n7tbUgo0TLKzFHmyCkgcwmE6kN9oqCLAsBYHApOVUdGCcS6PkotcvqpPXQPLmNA69DDDt6IB+7dV5XVlvzj7138/qfdfPPg6Ww74XY6eu8iu+3vxOf9gvk/O5yZ3/8k839+AHN/dYjWzoeTXfBd8v/4KdENvyT/0NkUnr6crhl3MWbRc4xZMoNxPUsY3T/IyMEafhffim15o2RPMFRlgwGCQE4blSFXx4YOF6ZktqbWRxbKvlEdZR01DbbSmTVgjPSmhvqUJJBSrakT2FTBP0h7bTFdtUWMrC5kVHU+o5KFjKzNYljvdFrmP0rHCzfR9vgVFO7+K8Xr/0jhst/gzjmewT8fx9JffYUlkvWV7x3IzOMPoPfsLysB/FqfFq9kveBK9ln3dr524HxOPamJq6/s4rEHJ/LqSxty3T+3YHhLyIVnPMZJP35Cyfh2nnqsStZT5bjvn8Gvf/FX9vrE0ZooWqj3FQkL8kUlVxsFGFKcZHBeNIlk0zxGFe7oYZCrVZjSfg+f3vFufvrllCsvHMULT67BVZdMYr/9++kY9gquMA9sVXicmlFTfKSBNkstljZuui2gR5vRpWk7S2PNhCZHaiMSVwB9JvT+n9k60j6eB1bxMC7A1B0EdSpD2uTvRfEU8+qcSH05/H/URYy8KxVhAOll0kRLk2xvXFZ87bU5e2vvQZ79+vBbrrlpmMuSyeDYYMMiba0ZxkgUBcXrIG9/CXIsWZxS7knlUBrTPpRiSwep9gecDTxKtfTtx7/nN4bUhOLQi1QjtRmDrcqaa2/HHY/185yyZqTSSmwjoOVYnW3IgdaxgWaOQDN+FC5iwuTH2G33V/jud1POPGscV12+I8M7UjqV6Isq16Sx5ePf4deIVqBZ2tpyg55zEbVySKbAmjmjjbNO7WOdtQ7niQfX4v++8RS33vkAO31iPp/7ygJ+dlLEpf/clMce25lXHtmVOy/YiNN/PlJBEXDAZj3sOvppNna3MmL2RZgHT6V+42+1Z/Ijaud8mZ4/HMb84w9h7rGHMvvYo5j38/9jwS9/TJ9mv9p5p5BedjLm2lOIbjyL3E1nUbztLJrvOZ2WB06j5f6/0vHQuXQ+chmdD99B63230v7w1Qx57FI6HrmEjgeuoPOeq9Suo+uea+m673Ja7vwLxZv/hPnnqaQX/ZnaBb9j8LyfsuzMb7FAXwTm/+ZzzD92fxYc+ykW/PxTLD7pIJb97guUT1UlcOH3MdcdT3jvCQx/7Q9sWDuPnYfczH5rvsDhu1c44buOS7XJe8+1U5Wwt+HWa7finD9vyYk/Hs7nDlrCzrssYfW1Z9Dc8iSVgVe4+pIFnHz8XZx/wQw+8cn/44F7lrLO5ugz3oNKdjFjxoyjraWVRQsiTUyGIIq1udgNGN44Gg6S4LRXtuGGEwgCw+e+MJI//ini/763jI99bBZjRj1HLnyVkB5NxDmCREGXGpxsm4bycY1FySFMWijP7eLcc54nN+YjtA9fj7Tfktf+VaQvUjnj8BUGJkWuSBpa3pfDeCwOfAg3d+LIdJ8xfx5kfvLUK3XybofxwwQ0ZXKzdKzJzmEGehZve5L3Dc4AABAASURBVOmll2ohrRc+S/zz6ks3ITMFr8NNNh1PpHI104zp7LsJ48A088rL/eIKcIbmEWNVjVviLBXvnqCHUdPrVTsNNi2QiwNsvQ5ZTCUs0rrpjsxbHHDLLYsxKrWUQWhYwguDbj1pr0ybUikPqCKvE1WNtODIygsp2UUUc4vJe6Nr0yTMG+KKtIYfKARvcxqfvVMrAgJwXs4QbU6TmA4uvrCfzxzyEw747Hf49W/O4yfH/YnnHhFMtYAbTAlrKa25WXS0Pc3S+oNUtNu96Uea+Pp3R3Pa6UO48rLR3Hfzerz86EdY8upu9L2wH09fuyWX/WECxx9jOHyPXj6+yWy2GvsoaxdvZlrtctaecTZTnz6VsQ+dyLA7fkm7qo3mq08guvh43Hk/Jjn3uyR//RbVc79C/+lH0X3KEQz88Uv0/fFI+v50JOXTj6Hq21lHEP/lC9T/dgTJhccQXP4ditf+lGE3/4pxd53MiIfPoP2Fixk+71rG9d3DxPpjTM3PYvPRC9l36x6++ukqv/vpGP5++prccc0GvPLklix6ZRNeeWZ1HrpvFDdcU+DiC+qcdnrKt/+vl70/UaW13XLR+Q/zhc8+wC7b3MM1lwyST0sKzlC6ivCzZOewIp2dTVRr6svlWXfb1Zk+cwnT1p3ADbddzIAqPqt5/GO7fJxFi9uBFur1DKv9BbwvyDdpHE6/qeyWKCByGJmwtcnSEtZhcIBAtvFBHcQOp/FZuYLQKsgjUODFgq8rPtCMSy3PE0+Vef4lyK+/EXFzF2GuTdSEV8uaQEuJQMsPTNLAga/KRH2VTyPeNNM7LWlcy3AcDhFlYDCmt1dyGHjX0AVMoKZ9n4mT22ltK4g9A9hRt9xyizSi25+AWTz7hU8YsKUCrLtehahglIGcCBje9TAtTH9eGvOgQY6gcxQmasaIOycb+E2PICcu3hXRuwEYGaik5BBpDQ6hysKaKol07JoUJk3jyn/OJo5L4AMV0fOpWiiNyspEUZuokik2G3KFELTGDm0ruaAFq6VQIZ+Tgg0os9f0uSxskyOgZ41/29Mb3LdMEKJlAtFslnF6hvPc9KHsvs9+JMIa20w0isRVhyWjoE3PQG4f6H7eq2V+9asRzFnwC845by0te15h9oIStqBkW3yBLLoLcjcQNV/Baus9xG57z+Er38n43ekhF/0z5NYHAh5+LuCBZwPufXyI2gTuenw0tz+4Jnc+sAV3P7Ah9z+0CQ88uBn337c+99y1Nffcszn33L85dz/0Ee5+cHvuuW8rvduMB+/eigfv30Twa3PXQ+ty54Mbc9uDG3HHw+ty98Orcc/Dk7n3wck89sAUpt8/hafuG6c2jKfva+WFB5q478YhXHzOCE786Si+cEwTO+5XYY1NX6NlxCNkxcfJcs9L4iXScY7MyU6VXtJqTE+5i+8dN48Nt72eE05/ij/8/SbOu9owEI7E1TKs1te5nNNSYS7rb5Rx8+2XoUmbqatvyJKl0yAbS29PHwNLyzJEmU/ueyhXXvM4cb1IrpQjqaq7YUvjb1h+q2DVTT0pY+UO1AOoN8v8JcIgrzcRgfZMMmswigX80lGVgFH1kFmI5R4uSCHfxPV39GHac9ht12dJAcpkDGYVXFNE7LSUsIJTAOIPn6CM8Xer3mxGSoTJd8nLQHOVZI6li4RMTK4g+Y6EHEhEho3KKUGHii/kxkF09wN3j7B+4NVHbhxkLh1jMWGxKWTjTTtJa72YHGQKQA/zTs0FLbzwmoA9IXEYDButndmcGFeH1OzEeprG74TiPb3z2Gom1ixrqQVGNCJi0U6bJxFN3oqnn0t45YWRYNuEz0ProtNksQyOqqFMAqlZOUZ+AArL1BaThn3U3WAjkOtKLHXTRt1bX7xr+NufpoZLamDyOGPUUOKJOP3Pi9hiy71p7RpCzfZho7ocLcBPQIFJZYxERtDYai+L5nQypH0Eh372cH570l9Zf7V1yKWDKmN7MPWqlpROM1mG0SxqkhJBlidyRq2uJsdOK1h5f7NoFJsSeW1KQfwUrdMyqca4cXOZNPY51pj4EmuMf4k1p85mnclLRaeb1ca9zDqrv6LN1PmsM2EO60yZ1YBba9pLTJv0nMa9ytSJ/YwbmTF5bF6f7XoYNnQ+Q4cNaPLIkwZFxVSesJjhbC+ObhYurXPa2Ys49puDfOdzNf70i7qS+OqYciiZZBpi0Ea3tVWQfjOgkljZoY3NtvwIHRPXYJ0ttmDyxhty833dOAShdbUfFir5brRpkUcef1q+VaG9rY2m0hS+/bUn6GieSLXspNuUzhGd3PdQTnhbcWlEYANRMWornUY0hT0MrQIJEjuIy3XLlLpGFTIbk6mSNJHTOySr4NWH9pYCtxxPagq8OreFy65ZSLjGDgx2rkWac7gmJYSWgFjwaRRIAtH2Y1SJ6wHeU9Qup/F2v6KiV5n2NCDMdZEFFn1SoK8/oVqVrkVIVAXzzqfLwFrBpIuZMDEWawFplhanPzt9gu8mfFLmzdIRiPmhHZau4Y4gipWxvRxeKg1+h7MyYFi0RNnRCD5NKY8cTywHpYHddzrdZu+A4T2+Mg7X4RTMg6SR+IpyDR7RMmPYtB3oSVo570pIsqIQih8EY1bQ1b16/envUh/M4s8piJzHixxIL5yuzlh8n4d9x6axjayTNeFsplkio7vb8uj9efbd7xDK9X6eevoJMmVxkoKCwxLokxppAVKLaYKZsyzDRq4uGOnORSzrmaWN0xYwiTp8wm3BqcqAAaBPbRDjNz6lZ5/jwrohqlslkSYWzB3OvnvN56tfHODrX1rMj777ImU/RHOZcQMEYZlavJCZr+U5848Jv/55wvE/rnHJORFLFw6DoIoJ+rU0k5MoCWFGcdbp8MffFfnZDxPOPiskC7q48p8Zh39xHkd9eTGfPWIRd9w3TDrXeDeCJx8ew3PPjuVTB/6Sb37nJB56qMJgd5Gg0EZmwAUZLkpwoeRLmsklOXJaahXiglIFROq2acindvsqfzl5gHJV42INDNsgaWKttUexYNFj5KMamZvDN7/5RU4+6W/cdfdzrD5lEl7XhaY8cTqUefMykprBhEXp7c2nETPqc4F+dGtNg7/MGFJxkq3UnPqcwAkzZEAlO/EpnrKsnfvuG2T2nBIjx+1D88BQoqym1cYSTK1HdnOYIIdrlCah7Gbkrxnvz+HAqgm/DTpQBkQsa9mc0tcrJeqVGODdDmPw+Y4g7GPM6BSL+AQzfsyY5ZXD+uuvMVyEWj2+SRMhjPo1QtlPHSbQaN75WNJdp7u/vhxIY5Ihw8lEZHmHxqsP9Sx/XpVfJ/+tCIEh1FqwrdrHqNps2l67kcW3asOs1st5f3+cpVp7YhyYDBoa0r3u3jgVhC6VQpMWrF9eJAFRXCSUB0R+ZkCBZMsC9+N1eZvTTwAmZ0lNlVTryjDXztUXd/LxPQ5j5KgpLJi3iFtuvEcsWGGoY/2UowDVR3xEEIqhlmP9TJy2jpKpwAQVNMfUox7ifAI5iHMhVb8k85nApmB883z55uXyTfda1syeaens2oYLLpvB3y+bTdHsgM3asVEJk4RaPwfMXTyUY45cQnvL5/j2l6/lm1+5nHp1T448dAYLFnZKHwZjmojKAXNe7uXlZ0scsPuvOezAs7j8oiKzXk6578FY1cFd/P2C2Xzp6HO49saXcVEfKQvpGFkUvbGssfEnGDZpQ9yQDpLmIgOun7pm1XoI2jKg7nURBEAHWb2JvMtj5CMRvepbwrrrr07Pwqn6SpHHScdOPmnCAQql+XQOKVOtFEjiVlZfbWPGTFibtJbhHd1kJXzW3WKLNXn2eenQz6iDr/tmwxdYrmjZWnc67fJnJWyTtElPbVj5ReCrtDSvRBAo4J2akpp4dyqnrb4+ePOE8pULLp5PFKUMPHcX/kvSuN5XGJcM0KpP92EtwehrHa4gOpEaGGnJuyarfMjuUl8qu9tcK+RyDYzVGvQPipbkXiFu48U7/GiuwWU9jB5TUvUMmhiDUmtxpDQDM2bM6nAZRUnClEltyrZLMcZicBhjVkK74t6p7/Wmru7eCgODFUxqsCYkaJPBsTQOgQkEn5Ebz+/w06BHJu48kB/lm/B4HIrEUF9OWgdiRnRXGDJjBsm157HgN59hlnbMOxfdxhf3G8mFp09iSEviEbyprcAVCH+GtX0Yo9nYVX2tQOiDWyOiNCGX1eUUepD8AvY3CBjwOFZqJsSvuhJbIchb5s4e5OKze9jzk5/VMMO55/6dllIT1tRwtoI/MlU5qHpwUShJc7w2o8yEkSPkfLE27B5l/JASHYWMMBG01quBq2FlslgBm9gWEttEHBRItS7OghDnnSAMlEQS5maLyY3Kk+ldrGCZX020Fm5SRePQsp1+VVafPGQ2P/vDRexzxPdombAuTePX4LNf+yXf+Nk5HPG1Fxk0YyRTBdPpyA8r0TxyDcauuR2jVt+cuKWdZZr5s5ylvLQVYwuEto1yv5PrJHpOKIRLuf+ep8hJTYWwhfEda1NdUqekyilfM+RU6eRV9ua0H5AVyiSlhIqN8P+2AUn68msLePzZ58jl2zjuZydxw9WtJMlwUFVrtXzJFZaw6aatXHbBPygEHSCfM2EZqUSVwkxq5ZjMlDjssJ+qaplFGFqM+HWkiMmGBWkkBvkB/jD+R5TrDZ/wfmHNAMZUBF7HiK7xyx5VM3XTRFX6J1Mgyh8NfXz3/1o57OARtPRdwYzzj2HGKd+g+6oLaZ71Gh31hLzsYJyyirEojsVbJvKuQXOVf8S6X/abUMmnIJ4iQ6UCy5ZlDX29V/yBhURx0NFRQJ5CaI0JAruOuuHpp5/cGFeygQkYPyXABf1CHmGcwRkRMl4YcYIHtxJQryVvJv3qLf0DkFRSwUOqXeSgqUCUaoxO7CAOjdWa+d2YjbIKeTWjEZgimBbhLBHKszuSOi2LZ1J66GIGz/kqS079DMFtJ7DVmFc4+ecFbr5mCn86JWC7rRcTuUG8L+CZ8yW9Mj1ZQf6lRgFnQqyyPpn4Un9iDFUFd1mPiQLOZkWMHFgak6ANJEIXaHbP6ZrHsVx4E5eQd6vSjDSLDefmW5r46N57aE0+hhkz53HRRRfT3t4qOWKCIKNWMZLH4GKN9zOlbaa/fyjDhk9AqubpJ25i4hhHXjoz6JDuTTAoXjOs+JRySfyLwOGUKPGsid9BMe5k4UpPgfGju0g1vr/Wz2B5CcVmizGBPivnmDl/CBO1Np623hbESY07brmJGc/MlDSWjbTOn79sFHOXjgEFU5pWacnnqS4VLatlgOiGDvEhmSNY3N+HHlFhI11ZXGqxQUCpY7HK/gHqWZ18oVn8rMnMlxcT5qoYwRgtDYzkwtQxaZ0sGWCgt4fmwhA8wrhW4dKLryBNIrbfZXtue6iJWUsSCLpwSiwhNSaPD7jkkvNxpiaaCZde93cOPOQjHHzgLtxz5xXqi5m01rq8MqOLJBtJZuvRe5ndAAAQAElEQVRU8ymJdaIp3asyEMO4IKQeLGkkToz0rYDHK9U4PUgmk8O5klqbepWIFN3W/70Zk9IIhaDGtttXtFcUcetN4/nTbyw7jHmZ4I7fMfePRzBw1lcoPvoPWhc/TzHtU6KqQyhZhH2VT/ksKFbFSBJVKYyfhFgjSw1zFy2BKJR+zLuTkeOZXITck7Y2Q87EUk2OWhxuaC+55JJgyZJlO7gssk1FwzhtShipwrpAiC00FAWipJ/lxORryuZgQoPPAeWypa6MFfjXpVb8jBb4oPQ6JhagfxHybkdic9StgtfK+1TK5OM+hlZnM2bOndQv/TE9vz+YBZf8H+GcGzhyv25uuGIcN13ZzlePyjNsxFwSluHkBGJMpETP5XQVLq9IU8fImYypYsSTdAKNfjm/ZEyoEgROikmwaRkQz3IeH3SJ+pNASpMzGKvxTjK5BBQ0cblfzoh2zdu46sqMr3/v5zhl8J7epZgspaVlqN63YmxRKnRkJsNEdUgr2qDsIwg7GT5iDE4h+vhTzzJieIDz1YVPBp5/Oax1Vrh6xVEFowyvPEBazek+j0kSSorXTJ/fan0hXR3DCSVPvVohCjQmq+ETYRgYnn92Hofs/0388crLj7Lf/ntz5OGHUhuo0VRsZuP1NmPmK4ukB6sxGSVrSQczAptKBmhva2WgeyiF3DDqCmyph1wYUtWekwktiiL8f3ukXovpH+wlNUW6Oscxb25Zr1KRzeGTNJIHQqQKqTCl0j/YoC8liE7GHXfczfx580izhI232ZprbugTHw7jJyABTZlaZO6Sp+nr60XKZOZTNTZeo8gRn+viwXsu1+SQ4dkpBuuxbG6TaBjy2rsI0wg/2aW5MhUlq4rsGMnPmmNHrh4gg6oZNZ0+AZg6TlWJC/sh6CXnyuTVrBIUEsckYKuDFNxsJra/yFGHNnPNZaO4+ao1+d4R0tfcW+g7+xh6//BZuPDndL70IEMrPQSiKQqreBpw4tkEZPJDV2hBAaA+S1U+gfrfEwGhkdLlW9DakpI3TrbKWLho6QhbLBbz9bpbzyhjFEuWsWPa5RhOeL30ma6vnxokyjQsChghzZQZjLLXYDmiXNNbPxO3DCFVCYb6wQIeh2+6fZczU8mWBW2gjB1mVVrri+m76k/M+vO3qd37N3YaX+Gvp2/G0499lN/9ZDJbrLtIS/dXMekcmltialZNUZ9EAf4vqqTK0k5BjWYOAYl1i4m9Ettk2xACWTeoYHDaGHONpN6khFevKXiLjkRRGFsjfmg4XM6lkigFqxaoZU6B4h2+iWuvKrP22vth7FAyU2H11VfnyccfZ489dyPzwWBCvC1dKF3YGkZ0Fi5Iae8YRlt7B1aVwPTp3YydWGqMF6Oim4g3o3c5bF7jAm1OBkWWan8n6iiJlkERRJYUxN8EyuUcI0cNB3FZ0TLPuW6IhUMJxYRV0lqVsW1dNIURE8aP56BDDuGxp2fyqQO+wN577MX1N91CU9McfFVilRhMlGkGGRQJryvINTfzve8+yB23LsSIhkF9+gRcSzLxnKpP+lAF1t4eU1HgOvlDZ9ckXnlVOlYSQcFGOKBRyBbCmQUaE9HbV6WltRXnHJV6lRdeeJHrb72OSLPfV79yOHffHpEVhuFa8ygnMXT0ICPHLmbR4h4Qjl133pjnn36CrbbMmPVCt/JuRmD7tHk5ghtum0cap3KBGJOknjCJ/CILU0JtVNb7EkoO8iQ07EoG8gcxI94ySZliFRtWPmTkNY3XcQnqndK9fEmJxdRjwQj3wBJM8VXWWv8ljvteE09fuxo3nbM1246eT+XuS1h08kksPeciiiYQjffhlEMZ+bvBilcD3s90R6NZaFx5D0eM/ztNrU0xhSLyq4y+7kUl+8gjj4TG0G5NYvIFS1ennN0rp9EQQbXG6fS7vPlfI9qpatwg18S82ctwQoJUbIeMFI856TAQvMHzZ2T0lRDx9ofHvLxlEjgL8ozYehfa1t+eJDeUB17o55qbX+GBe1+Rz7sGGmMcrpoSa/Yr/H/YewtAS4prbfupatl2dNyYGVwGZ3B3h0Bwd4IEDe6BQHAI7oEIJGiCBQnuboOPu5w5urWl/rfPJLm5Erj5k2v50tO1u7tk1fK1quqEhBFWhuec5pVzsnoaGTBZVykqYmZWjJOxpbn+ak2DUb/QaJ9EKVlnuUA1tzqNdCg2CeV8fPyGL+USwUprRRiJSKuHkPqRFMRpadDOM0+lHHXcKVSSCihHC5Wa55WWZ8xNjBROhiERgHJz+VT1KTLly4GMHDEKNH+tXmbO/C8ZODIlCXpwVspmNU5UmjRHuTaaKy6Hi35Y1EbgEB76leHLL3OkXhGjTCWOffr6LKMWGyljtpTlHDwrQ1R6j0k1RU0OYSivPv046kA+18Y111zPhx9/yirjl2HevHf5zQPLseoqgRRFcxtfWU2kDKFMaiwNY7jx1jt45vdTePLx91l5lRXkOBLCMEeU7TA6AxmfXZW11kzp7p4pzCNGLDaCSdOczEoRLhBcZV5CAJTBiUiMNfT0VAlLLWS2O2joSI45/gQWW2wMUZTS3jZSy4gdePEF6VhaJM0E5s1m6x3aef+tVzIQDB41hM+m1QkHt9GdfEm5vkDz1VhPuvPMiwuxAyQsZQAZH0wMuToEGc71wfhNS9LlGcqBo/8y+s32CDQXcWb8RYhzEGU6nZPsA7TKFYBYcyuzCEVTyek9Jsk77dc1CHNNJJLFS5/28NP7P+bDr+TE5JBL663H4C23kW5pjKb5m+4M3ayIH0ZOwUi3jYzNCKjNZKF3vf7nbmW4RgPbFHAKhUB+UUwiNXbBggWBIOSMomJRzqGtxcf2Tyri6X9Rc3brXUqWvWWA1F3TW4wtMm1ql3r6KiEtioSel+tvy/r2a4zR2EUf3/hrlC2YpA+jlD01AT1yCB1D1iC/4ykMPeFuqqsewr1Px+x51NeM3/IzbrpTBvLVksSNZQlQ+l61BGmkkigpEG5JDrTGJZaAUymIDNSFwtXvxMpZGGf60YOQr79ssKAPHn+1xqqbv8oPb4755MPR9C5cDtdYSsrRDtnehQQBPqnLEQuGyw/i0Qf6WHut7zJs1AgZneXyKy/m/gdu117OK1Rq3errMMYSxwZjwOkniZqY+nWJsaNXVQVUqmX8whxCbWA2kgESTbsyMAsyntQkfDnZCN5YNtv4HkiO4f13N+Lcc8uU60UqUS9proO+SoMBA8QH0VOrVsjnDWTWAMTOsfQyA/n5Ly5l3qy3CEItN4KGlpHtnHveaZx19vn86Bwdu5ZHqbfGZb82Ikq1aShdNsaRLzbTlB9Fa/NIfBlUqFMUkSIn4eESH+eMlhkx45Zv17JirnxQHwOHDmRuV0JnOU9kczitRaJIz34lS0D49cqx+9l/f0C0Dh02hvPO/SFbbbYlRllBI/H4zi77cd31vXR2N+EFRTwarLFKM6+//jhpamkeMIpc09pMmdPNMquVmDTxTeZP7YCaYeGCOpGM3YVSepolyzFUO1fk6w+X5EbBPP2i9+kULh0KIkK/XxbI0DKdgDwkme6U9JQuSf4p6hJWSHI9pPk6LmcoK6g0ckOppEszccoKXHZlxErbTmH346dzz1tQXnknhp3yE4LdDmbe2MVpWCsof4dbOuVZi1wTRv/00g/UorrECdH+z2/8ybK1bKjA0NrWRLEk2WQjhKL94oupJefIOZdqA8nS0uRLKGrJZjKCr5L1/VdFHMqAGYkJ7eRWah6pOJtKuE3NEgCgLvpddBvhuejtm399rQFDOQhPm2EZhEgOotdrYXZ+OAsXWxt2PZmlz/4ldrPj+GLhmhxzZhOrbTmV9bf5kieeGUC9dxWMp40Zz0Jezk3rbYU+eXPTr7i1OKUhQyMzmj8wz2WKkLby+mufScgp4fBVmT5rLD+6tINVd/iUMRt8yPfOnsTkzlWkZKsoS1Fknh9SqLQSJCXqjRH85Ko6u+y8PfVyH19N+II333iY7vIdHH/EZnzy3lvkMz4leZpyliwC+YEhTSyffraQsUstiZFyRlGDr76Ek094m3tuc3z63rLaeV5cDsXD+inlhmXY2CXYZMutOfrEc7joql/TNmQosVdCqzCRmSgC17S5OQLf+tTqdfz+aBhjpMCNuiFsSrn2rtU44Iid6e6dRSDaF3QtIAxzbLv1QVo7b8SXnzTjZWlvonGSfRLLaflOzgXhCdZLcZGMQsugWPzM5wvUayFOemDkNH2bsPxyQ/l64peEXjNNzYOZOcvQV12Vzp6l6K0tJd1Yl8QOwVnxQYGgo6NOmzbDtJ9JGmueOMGYPnwTk7MFZQCba46CHM5iOsK0mKjACkt7fP75Z/QtnE3oGqyz3Ai+em8WG61e4Ltb7sEmK6/MM48czNU/WoXKwpH01Bfn06njOOvKMmPHf8KKm33OqRd28MHHIBbie5o3RZdBBgC2Qpp2SuYdwrcb7SjK5CoEXoTpc3hJiOe1yjkPkGzG8bvfD2O9Tb5ixQ0+5fQLIybNG0m4yTEsdvZjuP2uY85SO9GZG0UqejQBf4/LeJbQFz9kwEiHbFaMwYqvkPGQb72MMf19khRCOWhEJUZVDuznn3/Qqg/jGUf2P7bKUmKTBotas1+jn+zuf2pE/zOrUHFWPyHIMTixsL9YzSJYZEWt2W2yCTQ0e//G0g/PYkyKR0P0lvXswXPdBLaXXMkwza5B8xZnMva0Wxh13OX46x7LB3NWZ6cj5rHEeh+w9c4LufsBnylzlqbmjyVuzkFzgzSokXiGJA1p1ApgPPovLTFQWnXgARsxdumAWs98NjvialY57mfkdz6WnmEbcuujQ1l2vZdYboOP2f/YKr97Icf8OSUapkhaqrDv0e18/6T9+O7Om3PC9w5gv7089trbY/U1W2huqqEUAF9Kn+i0wik9jeuOhpzxhAlzGbrYABlejXZF/FdfeZWzznyBFZf5BS8/syEXnTuJ1CuSykgWzEgYOrBdy6mINHZUeiaRywcSpSMf5MWrEl0L1WfYkkgCdHbNZsgQS1LrI62qT3Egn07o5sU3JlKuVFl+mQ3Ze5/96V4wRzAr+NrV3HDr9fjws8kgpUuzTVtxP036cEkFcZG7b7uTrbdely232ZBf/uLnBL7B8z2qWYpu8zhlUvINrLjCMKZ8OV3fvvqEKotxwH5fsM9eHey5+zy23uxVvvrKk5zzGB8th4x0bxAGqPb16NTpPA47cAu22GhdnWQslMxSzjn/Rm6//WPyQTt5k5Cni+HDpnLSsbtxoFL1r955jHGLdbH5xrN5880l+OCztTn6jLG8PWEGBx3Sx+rrTGbVzd7mkp/m6Ri+HkN3PplVdztXcw5gtPHYd4vlISmQ6bK8D85r0B9gtA/XkJONjcM1moTsQFw0VMemw3nw4ZA9949Zda1P2WWfacrulqK4xp4sddIdDDz997hNL2NOOB6TjsDrVSaX9soh92jOlL/5ErOcRuEbAwAAEABJREFUHGsc17AmpdGoCK5TSfXt+tXbZU7jPzuRU0fBFAC9LLrtnDlz2pXpuax+zOgIV+0Tg+yi1m/99dTXFz+z0QkoDXUSnJPXgowBmrEf8rcC6u+QmIDY5DRykXMyMgormMY2iNI+GVSZqKmPLglsen4YvcvuQH7XMxl46m0M3P8iepf6Ls9/NpiDjw1Zc6Ov2O/IKtfe0cQHEwbT1TeMYjiM0AzES5Uqaq5UZDpxwzO90HiX668aST43k5d/fTOuIEGvfwmth95Dy9E3UNjxWKYPHc99b3vs/P0Kq2w+hV327eBHl81h2VWLXH/bUlx9Yzc/vHQhW241i5LS/OGDPG6/5Xbu/ulZfPLJ41gJ01cW4MlJ1StyMPObaW0dKNo8CTPHyDHLMW7cumy4yVbsdeDJFJubJOgSaNNrbPsA3vn9bzj+0L258IwTOfW4ExncUqMkxfBMiI3rcnoNjA0JxM0F82fS3BLIeBOsjDiuB5x/Vg8F72iOPeY6dv/uDkojuznooB21M/05mIjmIUPobogp1gBGxi3nElcwLlNqQ7mrW7Q12HGXUJlJjVT0GM/pGapvgBFD0yiltQkWzJso3MEPi9x0+89k2Pfy+ONvaKPxU5Ye9x0mzazLKQbYwNDd7TOgfTDGpTpReYnfP3uLNkthyKDPeOftp+numcOgYUN46KEGC+eXxceIsFDl5FOGstVOCRf+JOGWh9Zn4BLtPPpcxOW3+uy8/6csu9anHHhaxOMfFZk5bDPat7mItiPvZsTRt9K+/i5yUB+SDxdw1x3LM3TQV0iZFxWRn2lvomWQ8YaQpsvSMX8ZPp28ONfe2cb+34c1Np7GbofWefqDdnpG78yQPS/t/79bLB14HTMW34DeJg/X0kWD+doA7SEt5EgbAblGTnRqmr/5dgig4k5dMk+IezpJyWSR0NSUg6ShdvX5z8zTH5T/fUc7dOhiw4LAWAUjllomJ/AJOHHn3/f9VzVGykM/ULeIWONAaY2RQRuhmWYhpH+E7f8V0D88//IjxcqtBIuKjDdRiUxIHDbT8FtoBC2CPFA8cSSlBl2l+cxr7WXhqKF0r74VbftdzJJn/pKhe59FffguPPJcM6ec2sua685jmy3m8uMLfZ5/osicGc1KBYcRpe04SqJEM5t5rL92J6efPJRk3itMffVO6nYSsRgdD98As8GFDNzrAUZ9/3e07XoJfeMO4KkvluHSSyJ23XYGG67xLlec28vUz4fz6fuWObPmc+QpQ9jzwM+YPuO3PPLITzjo0MGQ9GK0Bi5rDR5XB9O1MCaq1kgUAZzrwwv7iIMGTz93J6uutRzGE+fE01U2nM19T5W48Kp32HnvX7L97s9z0BFd+Lky6Xwrv1zAs3kx16lAd9c82gc1EacRcWTwggGUmvIccNAB7LDzd9hm+y2YMW06vnKChR1CK8kxt2cufikzC0gzMCpJHGE9+q+cjGVAe5blLKRj/lysZF7SsiJNfRpaxmQdTaYDdDFt+qeau67sxunUYCnGLr46YX6MAA9iyKgWHUWCk3wxeW2eehQLRS0dKlTL01h1FY8NNqhx+tklrrr6IvbcZ32V7Vh/vcHkgkHKdErao8kRBhFeoZefPdzLnnu/zYorTWe3/Rtc9bO5vDB7MXJrHkTzPlcw9NwHaDrwBmqbHEE8Zhz1oIeJr9xEeepv+MFZY1lvrU4I5kl/DZgikWuhUhvG5EnDePp3g7nkojrbbPUhK67/KSdePJtfvdlKfeyhDNz7Fkaf9BSFA65h7rpbMG3pNuY3J9RyjnoxpC65eflEhHYBZRo5S1+xmdRYff+Nd39WkJASC34E3QskD8hkNWhYCad285+aJutkkBHwby8rIKV6Fc8JUmtbG6kVo/yqJtQgCR0pyL8dFNUFTCmneqhfTYOFoNSMdCDN6uxJvxrZ/6owUypXUB8nxOtq+bY7VQcRSlYypv5h8ljPVLMlApiUyaZyGW5xERp57SlYGl4Ts1UmFUfQs+53cYdezNALH6X5xJ/Ruu0pTEi25MyrKuyw73RWXGcSa6/+Nacd18S9PxvMO+8OoqM3B+kwTjxqS44+sI3e39+CffMWms00KjLAbu1hzC9Yulpaya+zM/ndL2HEyQ8z4ryHCZW1LFh2N+54e6CiyodssV0Xq6zSw87bfc1zvx3AOuOW4bzzxrDvQU3adBwgpcnT1JayyeY9nHj02myyxRLsstc6HH/iSdxz+7289uKveeX397DUiCKu5rCNhKQ+G6IvaStOY7VlO9hu0wajhklOSQ82X5GYIpKwBaQU0hhqvQspFX1iZSlOabGX9LLK0mVmzJ+Hl29l/a32YP3tD2C3Q05mmeVX1bgy7739MmOXjIl1ChNrTyYMU6qNlAqD6TOGoDScRl8n7U09xI2FZHIOPUchWxsIA3yDUeZYLM6iVg5wkcSpTQRfQSSQI7ASIxZWWHUAM6YPE2456pXB6udxwxUXs+cOq3HumafqJCTA2LmMWy3iF78s8OCvRvPEb1bngAPH8OCTrRz7A4/V1+hk/Dqz2GefL7jgxg5eWLA03jr7kD/scoae/zRNJ/+axl7nU1lje2aWJN9SkaqXp61aoP7cm8SvPc6+uw7lnCMWxysklJVZvv/hEtz3wFKcelaB9TZewJrrzGSX3T/nouvKTKytT7jN6RROelTO5gnMgWeRrrsps5tbWSja8ErEvSlUVfp10xdPQ5LIA5uTWAygkkV0/vYrSDyCpIAraUrbh+mYQ7Nklm+BloEpUWJwQuHbZwpAKPuSiyOzOTIsVednosqgZN+G7HJKL1FEyN7JBJ69uEVtWa/s0w/0KyXMogRJlZEjxAAj6FKSznlzcUKyH0amDE5KYoToH0Bo5F++sz5/LP29BEB3/+uffkRJhpcUrp/6TBCZ4xApiXBoyHXWhGA1X2JeUCRZdlXsrofQ/P0fMvqCO2j63sVEm+zP5KGrc+1zKfufOYkt9pzFJjtErLOZlOG7TzNnJoQmpeeJV0kmTKZJAjeaL/ESyqFjQcFjQanArNIQ5g9fhWTD71I64GxGHnczS57yM4q7nE6y6nd5ccFqnP3TiWx/2G/YbPe3WH2Dqey9V5WrLmrn3VeGcdTBo7j7zpE88qtRXHxugd23m0C1+xJe/v0JtA6az8Ch80G8iwgkP2VMcRs+TfgmJ/fplLI6IpMQhQ0VHxePksgs2VVWmtnSXKSujULPdzg62XHn0Vx57vH4OtUoNgqcddSZnHjgkQR1y9cTvmLy22+w9gpDsNobKXpgdIoQRGjDL8KkvQwu5LF9jlT7Nl0ND2d9rLK6OAio00wcBSTWEuR9oiDm4afu5f6HH9Uewt2cfvxpHL3/Dhy025o8/sCdrDh2ISaqScHLnPPDEiefN58rbgz41cODGbdcwNsvjuGB20ZzwWkT2XXn99hiqzfYYbfXOPSEj7n9meHMbt8Zt/5pDD74Rpb4/i2MPOKHtOx5EuGqm0s+I+kOBlBRJpWIf0g3IKHUmEs44236nruPXK2b2sKUQ4/5kK127mHdLeaw7S4T2Puwj7nmPo+J6VqS6yGER11N2wV34Z91DU17HA2jVqLDNlOWfvVZo6AklqPLqWR6mBXpCtl3v91k8vDUaNRRlbIbffzNtxFsmwquwEaVPozgegrYxSZLS7NFovlPzGFwSUrqPHEHrOwnK/TjLxiQGEEWoD8Ynd76CVv0AwYR5alYlewdAXGYNMWYBCfnMHxU+6IG4+icPx9Vq2/WPytGkDwVoz5//f3XjspmMy4i2/tIQo+yH9JVaGP+wDFMH70SvRvsCPsej3/SpbScfCuDj7qLYJufMHPM6XzeuxkvTRjDI6+E1PKKRPV2Fr7+FU2uJEUW7hJGLK7HgcUFYqoPNVugEmrdqYxlfssyzFliU5JNvkf+oKtoOe5OBhx1C8MOvZLy6qfwZX0LHnxtac66sc42e77Blrt+yHf2+JgfHD2ZR382k1lTU1Zbezy77rsax5+zOM1DajivSiAjtybGIM8uvidxirwFXqb4EmiqZyKmz5w9mUsvPZebrruILyZ9zIDBNXI6t44i4W76GLdKhUY8gbvvuJQ5s98nakyiXP2KL758myvOO5kf/XgEba0dGNdMKoeB55MZ+mcTfs/nH77B7LmfEycRra2tTPjkUx59/CF+85u76etbQJqWpRd1DTEEQZW9vut45snjePudg0nsqay/6W/Z97DJXHBxjp/8ZDE22aSdGdNKfPjZSF57xePJZyucfdFU9j1wtngygy12+oi9Tu3gxodH8/q01ZjW/l1y25yn/YKbaT/+RuzRl+D2OIqutXdg3og1mVdckoU6DejzBhDbogj2xK8UP23gxRFePSGI+5j+/jMkXoV6fhCPvAD3PjuKV77ems9GHMG8HU6l5cTraD/xTsnuVmWHZ8Mau9I3bDW686PoqqckLsH3PcQkEskCXbJT/ep2Kv9Nd5oZhrX9tma7ujDSzYSUVi0dB7UVtMIXMum3I+MUBNWzv2NFQaORKUtGkOBb1WYgVP7YRbWqFGfpn5nsyupUskHZZ9bVOjkGKa+t09rmKZol4GIaCxfgJXrXjRBGXsgJmMvG/f8of+04J0Mh8EnjGCJN6BVwqUqsBY8bQhIPp5KMpodl6Bm4ljY1tybZYB+G7HUKo864jQGn3sqgM37KyBOvZeyxpxJutDF9oS8YqQRg8RPRqk07K0UxUV11PaK3D2xErAhaTnx6/Dbm0kpX0xi6R21C9yr74Lb+HgNOvkpHW7cx/KS7GHzYTcxb51xeT/bnwbdGcOGNvez//Y9Zd5PfMn6759h463e08TeXQ/ZLueL8gN/eF2uzbjh9PasqY1iD1K0gdi+GJ5pyaYmS18V1NzZYfsW7GTziRo45rpeVl5tPmNQIM3wp9u+U/+LeFZg192oO2Gtjdtlme76z5Taccsz62rztY/U1u/C8DpzpxuYcsZutqBpz3o924cyLt+WDLy5lw22bWXWVDu2xvMCXHx/B3DlXcelFoxnSVkOBVE5F2Zq3GAfvvyrXX74Z5x2zHpuvsRTVrhrPvTCXk8+ZyM4HfaHj5wlsuMlUxq/3IfscNoULr+zjwceLvF5enYkrHUhw5KU0n3QDraffwuAzb6b98B8Sb7EXHSutS8ewUfQoc+vTsqkaWCpeO9X8YOpeC2ka4vBBOmecw7gUT840SPNUbRP+ZjvRfuyPaDn+clpOuorWU29m4Gm3E+x9AW6r4+gbvzudw1djrjavF3pt1I10R8sGIxhWjhjP0tAxb+YYAsmb/47L/ceTGCvzlZcIOzsgtVnooL05z8BWX9SrzZn/eOCf1WYgrE3FJ5g7t5Nyb4U0o1NctL6fJr5vksBkTLWLgP7Z4P/oNcPVZPMahxHg1uaIUsGBk5F0LSSn3SxV61udjIqgZvd/BOvvX2dIIgteAayYVEuxtYRApVCJaOpr0FQGE7VDHFAzNZlKEo8AABAASURBVLqLXUzPz+VrM5+ZA1uYPXhx5oxaUbvOY0m0X9BnGjgpItJ+T8ZfVErdrL2AYhwp4a+Q0W2SsqJURX4pwqPS/+47MVqLuV716s21MTsYxNSmMcwfuw4L192FZOejCY+7jAEX/IxhF/2K9pNvYchhl9GidHlqaW+en7EmP392CGdemrLvSWXW3n4io1d9i6VWeZu1t5jAVrtMZ499ejn62CJnn1Pgxd/XWLCgj3whpqWliVkzF2P+rJWI6+tCtCpefhx+mOOM89bmoSe35tZ7NuTOn2/Jrx7fm7U3ylHQ6QjeGAiWg3B5knAJDjhyB2776f789Kf7cdaFe9M2bAQL5xm222wFll9yBO3KIj75opczzrEceQLsfkiZbXb9RJuHz7DSck+w+LjntL/xEQcdPU0OoMqDTxd4bdp4prbsTe9Wx1I86BzaT/kp7ac9xLCLn6L9sJ/QvP2xmNW2IF56JTpGLsH05oHMKrTQGbRKXiVQJme16+9XfXzJ0FkHSQ3iKmgJ1a/pUu5MyROTI/YL1PGpNQ2lNmRlukfLYY/Zgs7F1qBr2BBmNXXilO2UKpDri+RQU3wpsJMcY9NH4ldIxNM0hwxQc0kPnLVk/xlEffFffpl/P4NTXZbFhEIgP38Wqe+T1Q1uNZRKsZykxhhPP990O1IEQGMT6Whnl9VGrwMF9LCQa9hGI+6Q4cYmtdqUqWBtoEYBVB/UQHaZNPv9UxFe/X2Mhcz2m5uTRc5BzCTuw9VlHPLalmycilUx/QD5L780jZUUbRIo8RGCJODJuJWexxJyI1emEVaFRkNFbTZjEIqSwjYsiqlisvNJ5FzqYQvyAZAzojdCPCPyPaoy+JqUsKEoEqlfrJLYkEQKk6grot1oXusiSC3O5cUJj1iCyPYtIq9GJHxSL5LixSxsGci8YctTXn4betfen+oWx1PY7yKGfP8Khp9/A4MvvAX/kJtht8tINvsB5WUO5mv/O7w0d2MefH8pbnokzxV3pJx2eoOjju7Tzn4HW+4wjbU3+4qV1/mIJVZ/hyVXfYdl5VTWWv1NNlz3BXba4TH22fc+Djn8Xnb57q/Zeae32WH7GWy37XS22vJLNtz4azZY/wvWWuNh1l7t16y58v2sOf4XrLH2e6y9xWw20/p8z8O/5nsnT+W0H83j8p+m3PpEOw+9P47n52zOhNaDmLXcUdQ2/wHscQGFo65kyBm3Mursuxh59C20fPcK6lucSG3Tw+laflu6Rq7DnNzS9AZLU3cjSVw7LsmpBCohLg4xkqtRFuhpI86PC1omqCgryic95JM+7Y2UsWlFcpdspQfIIWTOIc0Cn7K/RPxHBmPl3P16CRpNRLHk7XuSayxZJKS+zMVLJa8YCQ4jV2+kSzYKITGkkq8epIKVTeH0zd/t+s8Dcpo/+0/QhVrmMW+GcE37dXWZJSKM6e3/NlLvb4NojGxT+popd1+PTz3KCPIYOmL4DDtnzoI5YBuZ4k6e2I1LrOBlxdPTgG7IZslKxg7+3dXeGtBSUv80xpiYWl+nHHiMRd/ZWNUJ23837r+iwghfK2KzYjIR2kQCbxDnGjSKDWqliEaphguVPniJUFCGEQ+UogxRhtGutWmOQEsGry7cpRCmYZRlRJBI4cTt1DdEOY96HqJQimtbxNcWUttEYkokWu/GJk+kiBVJKY2EiKlonjKGPry0j1xSoViLaKo6mis+QVQgSZtomCY5nlZ6cq0sLLUzb/Bw5o4ZxdzFF6ey2i5U1j2I+rYnkO5zNsFBP2TA0Zey2GnXs9SFd7H8Jb9g3Pn366j1Dpr2v5x42zPoXv/7dKzxPWYtvRdTRu3AxAGb83G0Lu93bc6bs9fl1ZmjlZ0M57mpy/P7SWvzzNer8/vJy/HijJV4Y954PuzbkC+SDZndtCELBm5I5+I7UF35IKprHUey7QXk9/8JA4/7OUuc/yjLnPs7ljzrEYaecC+lw28gOvx0aoedRGW3k+jb7Ai6V/4uc0aMZ9bAMcxtHUhvWzuhGYhfDzGNOrgyaIkaeY6an6cSNlELiviNhpZFdfGojp/WpVN18btK7NepB3UaQUN8TbAmkhlH+C7Se6K6TOmN4EovrYqJVddHIemgpd5Ba60i/lvBboa4TXLTfMWAej7ol2vqh5JZDisn5NeLBLUmSAIy55A5hD8WdfofuVNEn0mFX5XyAjmHuE4kTFZb2QrPbjxPT31/620ccZyITyELO5J+izVY11QsvWwHDhxYjhppqApmzrR4QV4dPUh9yEIlusyfFaf3Py/6HKxUfOCAZjEfjE1JOuZJUImmyAjQxEYlI4b/+itDLbVyCDYitTFIKTL7xIkmRSLSAqQh0FBRe7+0fazqvNST8Rr8NMbXxpMV/TltOhWimLw8tM1OYZQJ9MPKqFUf0qrg1UFKKc+qpzAwGcN8Tavi9WK9hcgCFIhyJGk7cTKYBCmkHEhiPWxSUnrchEnE81QiNoInvJ2OcNNGE6kdQur1kea6aRRr9GqJ093UzILmYcxqW5qp7Svx1ZBV+WiJNZi06rbM3+AAatsdS6rd+/SQ00i//yPS468kPeF60jN+SnrenXDBvZjznsSc+6je78NdeDfpBQ/A+b/FXPAw6TmPk5z5GMlpP8eceAveiTfhjr2cyv5X0Nj+UtyGJ9Gzyp7MWXwjJg5allmDVxYuI+keMpzeAQFxUyx8JQfxKdUyL9sLSHMlxGZiZU0N10vFQt0zJH6KCRxKvLCyOpOFZqmMEb+tcWSbZonkmdgGqa2Tanzql0mDXmI5iJqXo27zNEwovgZogGZFsFLI9C7RMxFALS4Sr0bmVGpBghII9VcX7UsQG6iJ/8pEkFoguWdjE5sQqW9dJfUER93/V9zW4QUGE1WpztPxWkangbGLN5OqDvGWfj38Fmw1Juvh+0Vmze4gML6GeXG1XH7PLrHEEl1qlEbKc3SqpxQWfFUtuk266PmnX3X50zv6kC2UWnIMGRhmMlFTgjdvhowslRIkqpNQ1Af6f9T+L7dG/8vHn739qV6KwR/LH7IBeZ3+nl5qJHz11I0n2Fk/KRbCKfUSUhuLPzHSOzytS02UxzSK+JU8uXJIoebhaWPJeBWwvaR+r5SgRiOMqcl31LV0SHxHJCGkgm2kLJ6UNVNYpEhGCu8ndaWyXYRpl5xHj55lzVcXBg2VSCWVF2/DxcMgbRdqeVDmkeRSanlHX9HQU7TUcjXioBPjz8N4KulCTFwjqOcolAfQ1D1YEa5dUbYFv1zQcaLkEzULXjNJEmrta4jjGCN8PMDVLUZZj1cPlLQ4RBpBOY+ptcgYmkhNRIpgNEZDfSlc2oSTEUCJxLWozZAaFVKcSURuojlitdVITYOouY++ljnErfNx7T2khW7K9NEgpaaMiCQg19tGqaOdQk+RghxcweUIoxQrh2clRBNoAZ+VnJ4hJL54IEea+j04Pa3tk1zqNPwmIq9N8lQxzThbBFMANC7RM82T9i/rCiSqT6yiu7yMs+KDZGdI8FKV2OJcgbqOXsvaW+mTzlblZJMwAq9Lcusj13Dab0jIsg9PTtpzdY2tSY8yHekhy2ywCWK0imPRZfTIipOqSt4mldyz96xOSNjsiXQVtRv9qE49RAiID5jsW684/aQq2VOP7P7Tq9NY/qwYsu7GNaCvF7rmCVJKsRXahrr+uZzoRfLg2y4HXiDeeHmmTTNEsrPUJWlX9/zpdplllhHllFMC192bUu0z4CQt2xAJCSZz9ZnRCUiGUH9RC/2FRVc6mzXGC0n1yZSqMPVL8g1ImxLQZIEitu1HdlH3P/6q+x9fFz01j8lKagRdrZkgfMHwEqxJCCRkWWE/P5vqHrnYg8AhrcOYSEJ1GAJQBPGcRzFSc2JJbQ7nS7HCPImf9atRkHGnGVNyTrA9gchjXBNYKZ9g+NpUNTYhS6Dqgaeg4hHLWcijoIkEzycOfBqBJc6UUfOpUnN5OM/HaUx/8UKclRKrD04IuZp0q6qi9wx/Oa5FipyItSkCgDNFXGYUYYGqdpzKuQqNfJk47CMNKmprCGZMRq2QJ4PbryiZigiE0VxOJbGa2yuS+Dli35DmxMtCpPEZrYHIqODZbox4i2jGE07Wlzm1iceC7pdBtCS2XTQOhmQgQbZrH0cYxCdlPMrDRUszRvM6zW+ydNwvUteclZxTc5lGvlPfFSLh5LwSqVfAeQaogo4abeTL8eX1HoJRvZVTkmIb6Q6K9laG6mstbBOrZrX7gOdhhINJNM7UsJKXJ6dkpa9OOLtQMIIEY1KVOtnf7wQN0RUNAKvxmsPERfzqQNm78BHuifUlT8k5FA/8PKnL6JJOOOmUl6I1jsbWBU8yFF6YDI5wtmrXuzUNjG0QpCm5yEJWLx3J7F9sV736eTnhmuEeqj2vojorXmuspSaQkYBqLuEjYPp2WJcK5UTP7N1iRaPFx9TrVD/+WPhHFMSvUaOtTqqqmEYrcS2P8xO+7TIKdAKvANDCp9N8QfE1pCIL6ptnV1111UQYdBlbSxvazZ8zrw9nY3XwVLI7yX5UDE4d6S/860sKv/KKA1EHEZvSOWuyomgNeRoImkmVrhv7Rzj/eui/+rICYeifwchJ4DIcVClGOeORqFBNaKnEtDZiGX8kRqjUI4oNFUVbL61KxxvkFaXyEZQaKU31mpSvB1vvVX1CLjaKEAabrbU0rqT2dpWimG30nZPyN0UNcrWGMoyUUt3R1DA01VOKtZhStUq+XlF7opLX3CGFKKAohSiqb74ek8/GVuuaqxfrFioC6SljsHIQhgTjUtVnJYHUIknqOxSlvp4OMkcovnpUZMQ1jByJF/tafnjircFKAREMdQRrMAbhlmgdHVMUHQWt4xeVSN8JxVoqnGKs+GfFG0tM7FeJVFKTYGR4QeSRRc+ceFDU+KZaVeOq5Gp1QvE4L14WxLOmRkKpkpKrmv5SqkJrzdGmrKGkMV6tTBA5QgWEnJYImaFkJzwlZTSlakpJfCmIf7gY5ACsZG0ka6ONYKT0KLV1KtZZOe2IvNbThaROsdEQDQ1ylQah5gqzb+0F5euJ+qhfUtOzRq5eldFnfSMKkmVeOBeVJeazUm9gKzVlVFXCjE/KuIriR0FOL59E5CW7QLBzgl3QvDnBz2jO1Q22EUq3QjnIkFDy6Le9fjlAJoBUXiDLLoviT5PmDMVHxMe8nq0qzdIx26iRS2tyFMJB+CJ9QHK0Djw5IdvPB+m9aEd1unHGkapkz+w7NRnbDEo8YdJHAuHwZRvjlm1iQFuoxhjftxlYvvWy6iHH190dMWtWrLlAll7fbLNNJ9sxY8bIJ7u5qam6SsUxb25DrXVN4KtYjBSHP1zC6Q9vf/5QbVJl1BLN5POqlwePFkzF75uNFbGIiRkxJlAbGWnZ8y8UMUCD1MvhaZBNxKRsHS6TcSI+tvrGpxpaFhRTuooOZas4RcWKImyvUoW4qUqiZ6VgtamXY2HRo5yAfZOTAAAQAElEQVSvkYQ6rgp7yP7uvauUZ16zokNe8IJUdQ36lNrXcorISnnq+YQeHc3WQ0c1ZynnQrWrhAGV0KguIgrKRMokGl6esvZpuvMB3QWDsn7qilp1tUVeLP71kXM9WDkGZ1JSa1Q8CVs8MDGelMMTz2wqfisioKdNzaJ6pbWWTB4pflJU0tKkUsCTkwi1xPEVdU1mYFLKVFlCLYBymFAR/tVCTH/RexbBq8JbXKW1auXI0JUI/5jUTxFyYrsvg86TWM1YqFMpNCjnIupBgzioqm+dWiGht+TRK96UxZuGeNPI+5RFe6/e+7LlUlgnVf84bChjMNTUVs2H6qOSCwQTqmFEwxddJCDn4DCkKk5yRvKl/+kRS+ZRTv1LKX1NEWWVepAIR6MsxNEo1KgVG+J3IFodleYG1VKNhuSYyHLrkm0ln1IuQVmy6WuqUytU6Q9+NqYhvehrqlGWlfX3KUXUczGxl9AQ3VV5vUpznYqSpEYQ4NIiXlLCJpJBGiBUZOQNTJbeZ/h7AXGYo0fLlYXSz0i6JC9CTTLoKCZ0Sy9dWJP8E/G70e/0bRKR6boRPFyo9wA/9QQzFUSJSbeTgFwmY0WA1DrhH6FXSlGdeM6n4qEnfKt8d8eApNwHTZ74GWkODf622zgiObMpU3vp625ktpdCMGvXDQ/vsXvssUej2Oy/5/uJ6emGzz/3cEJgkYAs5tuAZ+3GMWZQzFKjSkhqqulm3ifPM8AO6EfcyVBSl0HKipr/0m2El03JutrUShAeiFH9RQzCWHlupUsyoqrvkWQ7sklO2UMTflTExDkyfSOxOJcXg5pU8hjBCuXh/VgTq3+qdDH1i4Kdw2Rrc63bHSGpvDZyRk7wUzk2k+Zw/aWAc0UcKpk3kiCtjDiMPUVajwzXTMEzATpnMUpvPRWT5oVOQMMGxF6IswXIismDIqPErGckyuJ+PicyhlhGnsgJpkboWTTOJ/JyiwxF7XU/1LcvXFI818DLMgzRh/AkFXwpmJNxOUF14pfL5umnJS+8cmgUsfVVPLCawKiobyrYtey82xjBFmaiz8gY/CRPLvL7DSGTgyMH4q0VTCdeOM2Z8SZRndPcRvIyqbq4RDyTsonvzgmmeLaIl3k1ZkWezDn0oaLfDA/hgHDvL85iVfrHONErNDPeBnGefKMonPKCr3r1N6pzGT5W82RwxItQfby4gJOzWcSDHE60oSlzDcGoF6QXWX/NLbyd5O8Ey+rINMz2p6QD/WPFo366YumL6I3Ez4acQCOTk0E4xjLmSLBEhnhAWiJVko/zxG8r/RKOwqeupW2a4SL+1P2cjDkgFr6pgUzuiRL5WPOL85JGrIJ0QsjqN7sXFX2bRA0JgYKCXTibpONrESDIzSlbbDxYgahOktaxfqR6vv3S/E6zvf+uoavLYayXNhWHvPjp/N2z/WJYYYXln0wcibJmvv5KnlmKgTGkaYbqt8PHWtraGqy5eoiXCdj14j5/hVwXGCrgNZQlSxn4lss4dcgKGGfIlEycQ9xG6IjZiYo+NV/mwExqtFQI8WpFbNoqB5Enp91EP8qEojYpTHb4azKhuaLg5fFk4P0wBZ+61XIjkJIVaUhBbNBM5mBMAwIJy0iQJuOFnjgPJFxj8zhT6N8IRG051ZJKEF6CJhAeToLz8KRIjryMuonEa9HwFsiURkqHYGNsdpONMaYuHOoYRdas0vkWIQqZgUkRkWIR1HCK5GloiKyKb5CE8DMlSQwZLqmV8+p3PgGZf7faofejWLT4iECsolo5O65Dcg2LoP0Or+Hjp76iYQOnaOe8mnga4xkpeSLcnXa5XAE/tthI82TZnPhhsmc2b8ZHFS9zfkoPnfYUnBywJwRMWsO4ungheHJinjD2TYhT5pOagmgXPOGCLqc2BAdEu4rvnBxSiqelDpE6xClW83qSpVUWZeW4rBTWxIZQNJhYffD6+WAU2ZO64MtpBHJmRk7cCo7V0shmzj9pAtciWVu8DK7aPQUUEzl8I5oFHyNdyGiUDhm19c/hKjjJITu1iAOLyBDKKb7kZFMnfnqit4jVEXVe8g213LE14ecJlvjp0lAYCi9fQUtOHs9gJT+D5KE9FAKfWP8cdXEjZdFlyHQCo6eHrkSvCdnfdXS+9zLU+/BtgzHLhLQ0dQteShpLln4Chm+9nGwozA3kk4+raJj6J+XlV1zxofPPN6nVF8svs8K0JKbi5KEnfNSL9YeTKt21imDCO+vyjcUpOphchd13jyiEMUgRanOm6gy/jBf0QlIjizbfCCRrdH/6IcPMiWHGisJaWcrZwG+UcWknKR34gmuddrYFOy34NAoBpijGV6r4UZkSPTSZhRiviivlqGfeOiwQR13kwl4pwUJyejeRmOKlxE0BieewnhgvZpe8KsaI8XThs0AKvoDAar5szrwhLeapa86+ICIJa8griUbB9msEcTee5k9sN8hAinFCsVLBVrrVVlPk65WhVZGLxwgv62tepelOKSYi1zMRXnUhLbZKMepTvyp5N1+KPA+koCiVT0Phq75GvM+UE10uiHEa49OHSXtIq3OxaQfUZpNTCl6NO4nTCjTnkXcTLJ9ABpDTjndecG08iya/g2ZbIY3FNz8gyhepSYlj8cRFC8n4kqcXT7ywtlOzzseYBfhBD4nmjU0DJ94kgZrCRPzvw/o9eGY+IR24hk44tKxwpgYmUeEPl1FfD9IE06iSnQQFUvy8KxNGnRRNldCrEAmPmhxcLUgI9AxNhZLtVp8FmEaX6KqR5vPEGY+8RE6vlwFhXW66h2a/QiJY9cCjKppQ0CrQRV5yLgn3UDyLqZGEvnytj7Ep1LsIxbei6abVW4iXzgO/gRgrPTQk1oDefOFtXSrx9GA0T1qfTZPtpVV4Nvp6cFrCukKORH2NdLYl6mFAWqbZVfBcBNZIt2NMkBLkNK969tueEXijn9RlL+K7wUQNShpfe+0x8mks5xSz9poteH6v+jgC6TFyrvr49tta9RnJh++WwYgSF1VWXXaZz9CVtfDBB5/NtNh5OOM+1bIiSYeAkaKps26+9TJOXbpYb5NBtA/WawzJ/F56pr6qKNotRQXf+Gr4ljsDk5LhKKZDZBOh1MDXejZfLzNWRrnvSk0csULAEUtajlmmwA7DLaV6pyZcSKE6nx1Gt3PwciUOX9py6Jgy+y2VY2DnPDmCVBtZfWw2HA5bssJBi8ccv2LIfss1M9j0iKEVGe9s1tCa9fBlPA5ZwnDIsgGHLetz1DKWo5dx7DM6YlWzkDbtqRR7uySgGOMMvmcFu4eVtNbbb3HLkUv7HLEswiPliFUM+yzt2G+c5cDlPNbTzv2gnilSjL5+oTYUfRtRCth+WDZtMKTRyy5Lt3HAkj4HLGU5fPmUffS+uOkljxSzqqIhcvq4fh4lWEXo5sochvXNYot2xzlrtHD7jstxw/ZLcckWozlimYTx+T5yffMFoyp+VTFybgUp5tLi6x7azDp4qYSDxhoOXzbHlovlKDnxXnzP17rYbEwzh69c4pAxEQcvaTh4mYDDxZcjVY5aGnYfVmfFuIOBlQ4KfV3QsPjKSFqkyKvnGxygyHaI+h64dCC+GMYXqviLQpVkjC6HU4TSDzkvJZRTXGpgnv2Xz3O08DlSfD1wmRyrDWqQq02jLV7AmqWYA6UHBywfc9gyPgcv1cxKig+5aqccUZWltUex/1I++wyLOET4HjHGsNWQIl7aC0k36yiBOGyU5VDJev+xloOWybOG9Den9ly1i8VF//5LNnOkYB8oGRy4vMeWY5ooSN+MsciKM1OXDOQU5EiM+q+eq3Ko9POgcQUOXa7AvkumrDHQpzlz9uL9WsWY/ZaO2Ud47bs47DuuheWUxHlV4WQNXi5HtSH5mswYVKRfSNDZfDZKxLOIAinJ9C9IeiaRKqNr13H4ofs3yWZqYKQYsSNNPSKTeWi+8XLKiOfPLjBposPKJ1prZr7y7rNzskE2+1l22WVr1voTBTjt7Ir45L152MCwKLromXX6hmJ8p4gUkc/1ssZ6eSw5OeUCc96+V4GzG0xeLinh2y4jJtjE4jAiVL3FcOQFfRORU9awzarD2LV5IevNfIv1J77GOjPe4ayNBrBCWy82nc0Qfx6nbDGA8T2fMn7mK6w1/WX2GjSXA1cfQLOi9hgqnCgPu878t1lvxkusPv019hrRy3bLtuC6v2Yxt5DTNh3MuFnvM27KG4yf9TZrz3yd9Wa9ynozX2a7xgSu3GIYP9xyKVb26hSybIAQo1OeQVL0w1Ybzoa9k1h3zluso/nXn/0KK096nnXmvsT46c+xcfldThkfcOEuK7KkNgxDLUeM8XE2T6LU1tiAJsHZcrEC+42os8a0N1l/xquM//oVNqvP5fh1FqfUsZBCQVrdMOKTJTEQe7Eic5UVXAcXbTGWY5eIyT/3GJ9ecj7vnHMK8++5gRVFyxVbjZEzHEapcw4mjHGNTlzUxW5rDWDr5k7Wm/oh6095izU7JnD8GnnG2jIttQWs2g4nrN3MKgs+YM0Zr7D2bPFm9pusPeN11p/+CuuL1p3t11y54yhOWm8Ug3vnEzY8bC1ghGR6wgaLs4EMerUZb7HxvDfYdP57nLX2EFrk0ES86DDSGTAuITApnrK5Zsl+v02Hsk7yNWvNfou1przGCnPe4aQNWhjKLEa7OZy5Xjsb9X7FuNmvstacN9iBGRyzeitDq3NoVeTee5U8O4bzWGvWm6whPm7U9RFnbaD2fC/tXg/Hr9/CltXPWGPW65L162xRn8QJ67UyhIUMEb8PXKHAHqUOVhedK2qOpad/yKmrDWA5C55ONJABIieRySD7Y6kkrXLM+m1sUPuM8XPfYsXZgtv9mfRlAIvTydh0Pqdt2Mb6U19jvWkvs+a0N1iz90uO2WgYQ4yMU4aeSK7W5viXy4AD4yxe6jCaN69nx6fvQH2h9AZWXjHH6iu0EPsxqXVSCDkHFxDZkG+7DCHPPT2Nvp46Sn5Sa81He+yxR5yNs9nP/fffn3qeeUYg01rZ8ezz3aRBjrjfa/lZl28pFusEKu1jm22bKHi+ptRkk16n2BsRJAFxUlWfBE8K4LlUxIpoPMFV0TxWdRldqiBrMarDpmJMAysijecxSqn3g7ffweHf3YOj9tuP7x20Py0aYNwCEi/GFg26OeOwQzlk3705cP8DufjkU9hkmSaao/kEQRdxzzxOOvxIDt1rf/beYw9efeJxhrUZCs2B5u1hlNbd39vtuxy2554csdtuHLzHnhy4x14cusc+HLLTduy7wXpUJn3C8dsvzZCwh9jUiFub8f08g5KYK879EQftvSuH7b0nR+69F9/ffV9O2HUPTt5jb47ZYSf2XmctPvrNPZy67dI0KVr4Wmc68cuJY8iQSjKMDUa28+trrtH4fTlx7705eZ89uPioo1gxD4u3NNHoXKgU0uCcJ+eQw5g8Q9OFfH+rZYm/+JB9Nlyfc35wOLfdcDn3RcX1VgAAEABJREFU33Y9155/KkfsvQfH7bkrB609gA1HFLHZ/02ZThLqASyZd7x090/VvidH7bM/Rx1wIH7nXHzbTapTC4IqzbUezjr0EA7aa0/xZDcOF28O3W1PDhNfDt1tbw7YcksO3nQTWrsmcdIuK5NF50YY0qMouFKr5crTTuGIPXbX2D04/ftHM0zOKUSKrMynX+6St3MxWeaAFyBxs0TBcNuPLuSgPXfn0H325eS99iDLIJt0qmB1ShFGFX508g84XDw6fO99uPXySxnkx/hK5etpFyNE1+3XXMshe+3LEfvvxYnfP5ZCtQc/H2N1zj2YBsdLV7530D4cvtc+nH3ccYzMCQW/D2yDobmYe2++gcMlx8NUvi/87Zw5DJXN5TNcY8kglW4bH8U0SCMWb4bbzj+Hw/bcR3qzN6cdezSDFDyhIprqDPPKnLrfgRwlnI/ed38uP+EUxrWnWqn0EngGK12HQKqQqnggvmAjUoSzKeqp4FteSPLeS+KxIVSXHXdYUqcU0/QNJnOzVujLnjJnQnYZgUEdsyKWq5PY7Am0RyVu49mX6mg7Bqv132JjF3/w/PPPT7NhApM9cPvtt9Ojqcv1lF0zjzzfw9xyiA3VHDWrg6Dr9y/ekY9NcngiYtcd21hmdA1LJ5TLxK98KMOM8GW1lgRPaawVoWQYmpwe0njj4buE7Eo9R7ak6VcY9Uf11bhIT1iizVUp+cIJqMpdx8bJgVVpS0NFm7Fa7w1SVKloKRMR5XwaRXj3mWcofvw5O4wdSMF0kYj5Hs0yLIsTnFBrs7CRp1JtI6rnlUoj3FMyXwehnnlMMwTWp6bNvfnT53PGrpvjf/oSB67aSinRaow8rj6QocIpn1aoBCJd9MWNgNS0kEh5jIUocZQ7q9x+zg/oe/kx9l11pCJQNxm9xnqkaUwQLWTtYZZnH3uQupxhrzOUNXbK5Ink++bROqiIy9Xl5bs1gwdJC7moxPfHDcL/8DXO/s62OpKaTySD7G2CPjSvtaRhjo9eeYHrf3AqB6w8ihVzg2BehWrYRij+F8XnspxUtwnxSRks7vhegV6TJ7YlhmTfEpEzIq5/5gDPyyOJksv72DhiwecfcuUR+7O7Mp/VWyoiq0qSH0Cg/qFo8/XEiqd61sTgVC2YRDrhEIloU0X8NpTFs6r2O0YKepP2PpRkkxgo1R3D9RLXCnSHg0njlFCbrijr8uVYUz8RZEONgRC00yIDGeBZpdcQRfRrXZPqvKgF12iimDoq1lCrxKLYkPFB52uYbH4zSE+fxG/0BzKT+mRXLD5kR8TZUawnWFYO2okmbKBYltHhCFIrffREixXMBkXNUUnaqQTD+ueMGjEyL3o9KODhp4Kci2gkCjaNBrGD1FOlKxIosBL0Yq32S0wrsfjZ9+GzuNkTxDefwS2ObXZsEJhOinUBlE25vMW3DbK/1xERGXvEv0A6n0c/ZJfTbmoqeU9dMIrfvCB9MeJPFHRddMrl72btWbHZT1a23nr3mYHvPjJC4u23EmZMaSU1wtIrq1lP/f7FW/2Ml9CQsJpbGmy1zWApmEDHDarv30tRG12pMojYhsQmROqAMyIeSYxYYBMSY0kXqYi+wegff7qM3kx/jdFbdjv9ZEWP/ts4zdffQ7VOvSLBT9Qkpb//vofYbI1hCoA9ymoMgTyPeqhx0b3oPfvNyh/rDAUJNXP6TjvOkTZr/cTKCBoSfMyFp5zKOksMZIjoNoqqnoQZ4RSLGqIDrGfwrIcxPg0/JDNwo3AY+obe7goP3vtrtl65Vc6oDr6XSUbKFTNm6AC6OubStaBDgtRtbL88y/Uqs2fMYLEBOYycVKaUeIHG1Gmqz2f9ZQdw7uXn98+fl3blyj5IdB6Gkvjhlyv4UY2nbr6OId1fskzYoK29iFG0M3KQGIMTPGctmhWj3z/eTl9//HZZpfiSZEXySvwCfbGlpgYrQ5w56StefPwZVhkrfidxP7+c4AuFfr6kmsekFi/rr5KB+9clq1w0myinIfoRTg0ZX11aFWs8GT4yyth6/XqD8OBfXab/y2Sg+t/08+fvGu9U/tBLjdn9r79Q+6LCv78Wdf2z+n9XobZ/qcvesvkQTKOSPfsf/NnVj6z7Q4VkIH3LR5ZENBPlcXKCzs5lscZM4teelYiqBEGd3fYcxOiR4mfgaax03kifMtvqtwdfuiNYGWyrekHDWFzkMFlGqOXsO+/Op3O+wDnSlubCi3sfttM8Aeq/NbL/idYZ1abm4hs6pYgV3Hn1RRmtVYQVAot6fMOvjZVRNcjnoF6ewR77GbSRLMVIiHs+pD7hGRTEQF4tlYNIjQjpJ0AIKxuAlER1zhj+HlcqINJHSMAX3Ifu/zUjiiGjS5ZcowZxTbJx6vWX74yfngynIDzzuSZlItnSwSMQc0IZ34T33mXyW6+zxTIjMXEvqeiQLElCI9iCm6QU86GWWdux+W77s9jK4wnCkFQ78ZIqn3/4ASs3+7TaCKUUZIZlG30sP6qJudOm0qg1BMQjVnTz9CbW8vKLLzJuaEBO/HK5EqkUJpf2ssOqg3n3+Uf58qO3qJhY0cjSmjaz2pqbMn7LHQmLzbQaX1AcfXKMr7z7BquupO+oU5G3Tk4Ms7Eh+ytGP8lmU9e/cBvVp4qYoxYfw46778nm2+9C85AxJDYgFtOTRp2f3fgTVh3dRkGpt6czd3DCWGzPButdKOA7g/lmESBwpHIMmACXwe93BgjniIJOdoxwSTLHkL3o/R/lNtIgkxqCNBHfAgWjVowXELgZJK8/TDz1SxQVyFhz4GGjiM1spHiLyM+W4kavzortvoqe+sT0C3lRP7Un6leutfHIg50ogcj61YtNTc8bY1zWPSt/GJm9wuKLD30QZxLklR+8fz5d3QNpyMsvav2G30zaARiBzdmElcclbLullDgbW6nT+dqjDJeTydqxHihFFzZYeTkPOYjMiq0B/hU6+v7/eWeM8LJ5xAspaMf8Gdx72x0cuNVGlKRUf1zCfBN0I1RSsWLd8eOZNXce1/32UcauuIKEFeMLf190vPD442y2dI5mL8LaBpEIlC33g/Uk4GFDh/LgQ7fzw+sv48HnnsMqsmYbbkjRs/+c3hD1LCprMHI2KO0uujpLy2FM+OgT+i0jMRgpRUZOqL5vvvkuKzYbmuS0nM7QjRfQonn3XiPkkbvugBjhZwho5ZDDT+EXLz3DtY8/xAnnXEpsfJxwcnKWb775EcMHtJMmDWLRoYMFUg8qNlY/AdFc33RbLe1WW3M81911E9eoPPPKS4SFZtAcOQMfvPkaI5scQUPRzYhfgHwB/emCQVjwx1e+/Uo1OOtlUMpEKF1pa3QxsNZNXlmh0zf/YJeR881orfkNrIzcpSXxz6el3sG85x4mqFX7ebLZ5j6LLzUTm/bquyQuGPXTo//2VKcim5Ja0s90aYcjL52CmpZJn0zween5hRi9i8tdBx30vd/xZ5f9s3dOOunor3w//Mz3S7zzXsTHHylzkPL293H6NeqeufPsXZ9/uvVtrYRXCwk1kUm6OOLYxSgJK5sUiCdNoOPDZwgbvVpWNoSn+mawcEI90ncqUCKkv06vf8OdKaHQwcWJPG0G0+DLYT15/89ZZ9BA2n2fLPJ92xSZX6sJf6PjvvmxR9/I0Vx45Y/JNRWoKStI5JSnfPoJS+QD/HqvGK4sSf2jTAAJEpghlufXNgNX3PRrerXGW3bFcWpFwkj6bR9dRsrtiW5PzqGViGUHN/Pc7x5F4LFy0mutv774Q3+ZOXUacVcHSzYFanNIb2gJI5b0POZ9/pXwkHIo8vuDR7P9sftzxlPvctAvHma7w/dkjU22YrdDjuRnzz7PyeeexeSeBg3PJ5F8s3V3ItFi6yAc9PONdyr6A6WJEydN465fPEprW4HSgEHEymQwwkGjM2fW/+aQlFVhVLJbT6M6PbKvby2e+EMa4RFjhV9b4NhtzSXYbaWRDJZswiADIYDZ4x+liEHGi4kKdTw5bLwUX/pRfusDklnTyYJqW4vhwvPHE1htsHoi3PT/QMbYf8UOCVbfAkkmicx809DD+EUefayTrm6rIflkscVG33LxxWdoLatuf7jtH579j/32O65n8cWXuqEeRY2k4bjn7sngZfEt65bNoG5SREHTy7++HVZKX8CmHp5S7xVXW8AK43KKHjJ+bUx2/f4+hiULtElSVrtg2VBKIyRlzZ4+9SHczb8G+ld+ZaMzUAKEp+iuPTK8IEc9qTJ94hd89vGHBJoo+YMCfxN4mZ4M2ZFYS8XTrvnrXzJ0hVUZMWakYBdJVDd75lRKvk8p78nhxHjGEpocogoNI+NTLYZtN1qLdgl73ty5ODUIqpxMkR4g8kKS1JKIZwXhOTiI+OyDD8hZ8IM823znO8JY/dR31rSplKdMZNyQEJQBGeNoLfoMMIbOeR20KiMJtHs+ZtwKdJQKvDdnOpGWMhOrMXfc/0tOu+hCZhXbuevNL3n45a+pGQEVPlaIKsukoAwmn2mPqr/tzmhsLpbYaM0VKXd1Ue1eAFZ4CpfWIUOYqyO5xM+RGo80A5b9ZEUCcob+Or1mLX+xqJscvOnXF6v9K0/O9ld33UDfp29R+/htHrr9dhbMmwP9HNLjH+Q2koHLnLROa9K0SrbZmJs/lcqTz2BdBef1sd0Wg1heGbpJ6tIFcVIb4UjzMlZk/EXOFGVtiwr9lxHXrR8T1XLi2wgee7xLQcoQxfXaiiuu8jtjTCah/r7Zj8SZPf6lLD92qacg7sF67uXXe5g8qV1z5kBKRKqxQvxfei96E2qaRO9ZOiQlzxDMFStcdt1qNBfr5I3TOukzau88xQBXJmlEyLrULTNVDyuYJhUU3YLyt99GIAQvMD41rYGNDLnW18sPzzwDlxqcjh2RQfBNVwZDJao3SET7nDRP7BUYNnw4iWBbbTDM75iHNurBJCDLMEZqWk/7lTnLTsqVMo899iTMm8QFPziG6dOmk8iASWKWHDeOCXLAnbUE4/nCxjFuiVF88d5b1Pu6kB0IjmWDDTdk5IB2NB2R9kvmffYxy7UE5ORRnSKqEhe8tEZXX42qNioLJmDx5RZnVqXGzuOW5KytNmGgNZQrfdR6e1h9xFD2X39V9tlgCQq1PlC0T4S9thyIfMieTt9/6XaSmjWGmdNn8OXHHzD10w/43iGH0ah0ibfSjyBgj0OPZMLMGhXrk5icRhhxB2xqxCBD9oisZtEn33SpPZXOhSZzRR7ZhvcFZ/yQ0w49mFMPOYDzTjuVuQvmfROE/5NtRtZt4kCe1oOwTrOT3jz3IHb2VELby0htQJ556miqfZ/ga4/L+g50guWc18/rfqKNpGpkZ+ipCqMuaiSmhu8P48Ff9vDVF8isC2mYD77edNMNtJZVxz+77Z+9979u993t5gweNvjXDpvOnJ7wwC9nav9OExg1ZxMopdTbv7n/0OiVVa++wiJRBrHs+OlsvFkBFyWYvjKdL40bMF8AABAASURBVDxMumCmkBPhNg8mlLJYMj3xUnRlE+jxd7izzTojJrcPGEymYJ5nePX5l5kydTqRcPvWKYRP5keLVhYjtFKviZrWCMMHDJN/9pXm+VT6KhhxMNU8xgTyEZZSUACNDT2fjoXzOWy//Tlizz34zZ0/wzNGwgnwAsuGG2/IS192003Ybzj4VkfAHtNk/LW+OhlHW0rNLL38Mmy25RYa54GOFd9+4VnGLzuUvE1AE4WeYc6sGdQpUFMW47QHscQSwykpkmzc3syvjj+bY7bdnl2225xDd/8ux2yxDafvvgfbLZljSL2PnJynL3yNsEj7lYv+ufkLl1GrU9/XXniRA3bdlRMPP5S3XnpW0c3hCcV8qYmDj/oeH0+dpWVLQKTMyBijEfQvlUzGSwk8NsJehW+40qxN2UfkQrJicgaxmlBML5iS4OVJsgrhlHX9hyniVy4pkusVfTpV6JrwLA3t2+XcfGVSCYcfPJillp5CMV/Dq4dQF+VZBpFxWZmjvhbdNsLZBMRzsnWw+OSJ9/Nnw603zVXGkEe6Wz/y6MOOPeWUUzLjXTTuD7/2D88/PY488sjowMMOuSIl7cw80q139zBnTlHw20kyYRZCvWezZUXDjNOUTmil+nAqi26TOloKNY49bjmGDoKWXERjypdU33yCkukBKa/VZiFOCuSaSU1OyxKNFZjMKAVWHwg2/+krmz0b5zsrBfKkUI4Dj/we2frYCOtytcov77sfY81/Cmamd0502AywDKehdUogZxES4ud84kjMF4ZhLid4hizaOznPUJlGpIgsUjDy6j5J/5yR8XFaOmwqx7D9Ycfzs/drRDan1oS2pMaaw9r4+L1PkI1h9bP0qkszoJhn/dXXQOir3vLJxEksmWvQLjikPvl8E50L++RgG8ogEupC1jTnibWUG6YlRefXnzP543eZ+OEnfPbRB3z51Qd89O5rGOfoS5xghv2nFX4KfrbxkBHNN10Ok5h+eadaAjmXIOIwWpJk9B99zPG85+V4qyPGeXlxJ6Yfef1mDsEZT3NbAs1nhQPfcPVLSZmDZyxWtMS+wffAkywCl+KZCAKHMwkNzZSLbfZJPXTqVFAm4xH2OyeQ7wWTksrNZvgYjXf6ckqzAwHNvo1RFw1NbEBDMHy1F5SyiZL+Ocgu0Ru4ZmKXU50jSFRpimAK4p/mEV2amNQ4YWQwwl1sxsmCA+ska0eU7SMoQPmpIZUB1y1kw2xaJND+VrYZaTK9Udba2tlL/NxD5Lqm0UQfK6/azIF7NRO6BYhsUgVecmKKZGJMLD0AmwFDMDMaHRjRFzVQQ45Go5WHHqowa7bDel5SKHlv7bLDLu+o9d/dQuvf1XHFRRdNLpXyryrCuoUdjgceglrcRixGdy6MMdYsGuR8YeCT6VNWkMpAAEIo0OZRdWEPa65e5MBDRiq9T4R0na5XH8L7TJGGqnpbjGA49U9lUAiuEWSrksHo55jass//bDEYsvGZ4jkBWXWt8Wyw0cZkRpvh+OsH76e3rxt141uvbG7h5DKA4n8gi80YHRMrxY8JtBtmNEesZUIGy0gh5EvkjVOs6FFQl8OoEMthxDIKlAnsusvW3HHHnTz8cQ+fJ804ORtsjbZ6D6uUPD7/8H1BhGoKW+y6vVjgGLPEMjIEh6djwZlaY0+Z/jXLthcxMoZG3VFsGoivk468GJkq0nZJEwLJqqcuPAtFIimh7xvhlInG4Sv1N6KrWhxIzeaJRZ8xqeZ1JMKbb7wMPh75HHiC4eUKGOMTqvzwoh/z/e+fyDlPfM5804qT47cukjwkCeNIPQNeID3wyaeQyYhvuIzaPCm4J9pSZUREDicPkzpPRmakOwkY3YIdG0tehhWKY7UwwfkhVs4T9RVh6ivaZXCRS/CNE79SxBbIOUwmNBAoQ4ZiknjEghFollLDJxWdaIwnPvnWkdYLOE8B02tgkwaoP3IQOely5ixEmtoNJtEAKU/daJog1rg+jN7xYiHj4ZET7JTsj/nUTf3zGEV+5yfUkwpFv4PKfTfCV19ixAdbNJx52hIMGVrFaFqhghWeoBk9wNQxRJAput5sLiAWkWmU4heg2sjz1ZQRXHblHGqqT6hEa6292tWbbrppjf/gsv9BXX/VWmutdYNzgtdIufSKTqbMSjCmmdYheTHDkeFDmsdREIH6FNVOAqK/oL6OfCnWkvYrDj58GEsuaTBUoGsulQd+ysiuBWKWr7EN2nJz1LaA/hSIv+1yxok9YniGoElxtQoH77efDBR831Lu7aCivQBE3DfOZNXqQ0NCyZyzicvk5IHnC+86dZzcc6hoJgaIHxK81v+of+wlmQ5LmNDeOoBzzzqDQe1tWBmdqfTy1uuvMePrr+VCHc1ZBInreF7EUCmp64uYrmVPdrSYGenYkcvQu6CT5qEj8fxACEH2x1EfvvchSw0OKGr92NfbxfDRI5EFkhg0b6otjikMKhQJPEtN+FMoqSGU8oEnun3VedDfV5Kj/zLZW4Iq+abLieCMxyuvtCL77bUbJrZ41hOfEp74/dNigcFbuFCGmYhHRjiJKZKuyRRWOozmdpKLbFyQ+MYr1bi6cfpVN6HmiwcXXnkVl9zzay7+6a+56MrrGDZsCCIJjPkTPBMnxMryZH3UG+KvjDsVx5EFJjZHHqNiSYQ3kYfSQDw9HLDITyQYOdiM1lR12S32IB8vkHqTs8JUcHGnTKCOCWSpOYtvAlI198O1gi+huGxeAfEFOG99EiEbpgnGJDTkKD2/VY5K+BhLKn2IfEOalhhgW6i9+xDRF7/ENhIi3+OQQ4psvmVA3OglLfKHK8P6D6//5pFqIzoUPBc78SYhCcbyk6ums7DTEgQegwcOePqm6296jr9w2b9Qz8knn/xSa3v746nx6KgYbrq5Jt620eisLBqSeWViMm+ViukZU7KCmKNKsiuqpBTyHQwdOo1rL12c1jxYF1Od+Cld993AoKSHVAbbK8NztoxxjWzY31jECANxpiwmxa9V2XmHnRg6YrQqwRezlIuB2vmmSwIlUQfhl/NSSvWFlPyU2XNmYY2TTsW0trRTjw2elxmAOhtIbEJMpmQpzU3NnHba2ex/4IGaMtKUCXNmd/Ljy69km1UHE3dOxw9S4qiXtZcdxcu/eZy4UqE/2Imn39v3UJZddk023XbH/s04K5wTZ/jwnQ9YblAzbWkfsdJuAkvY1CRlszRqNWZ/+gWjFNrrjQaX3XYVT7z0ey780cUExpciigfO9T+zyGNIMVIdstJfkQr7v3wb9Y6UDaywwvLcdN0trD9+PYhq/Ur/1jtvcdNNV3PYJqvSnBmQRSzMeLMIntiINJ/Upihbp19fFjX9h79OOMWhT6o5Q3k+r+Hxnb32pT5mKSpjl2DHffZkYNNQjTUgfsWaLzOV7E+qPePoFf2tgwdI5xxGp2P9CZ6cRlO1jyZtxnqNmCT2sXIYRnN4YYBUFi/wybIJI8ix5wTbCBN9ZHdm5HEHYXkOTfkGbXRRqs3G71FR31heJt/SjABj9a+qjeF21RdqvYSaMxTvqwkIKcGs0qasr142NLJAKwY5G9Ekx2Q/n0DfM7/AytGSlFl3o5AfnDEcL/qEQJv9WeQXlG+8jWYwDYcRD01uEE/8biG/fqSHxBQV9aPGaqutdM1yyy3X+5eAiJ3/cdN2221XX37ZZX+SuqQWibif3zOfV15MCMPcIk8tYSBPlwk4lR92EgYmgewpRqdq8LSVbuUlretgk/UaHHWABClFtp5H35uP0vj97bQIRuQNI7QF/DTlb7mMBjsVTQ/WI8OlXUbi5Usc/YMzxCp57sRhPMN/6nKQ4d9iDHuuviRd0ycxW7v0SPE9eeNho0ZRUTjpqyRY45FK8IkU3wYGkd/Ppyyl2/+wIyg1lUCnNHkZ4CuvvcM0pYobLaeMolFWNI9ZfrjH+y+8TKMh5+tDaFJK1R7irjlEUQ/qJHjij5zDi79/hpWHwVC/QiPxmC8824bJ2cgxeZ5h4oTPsFGdzz6fxJtfTiJtaWfo4MFkUcv0M8f8ifxMXIu+BORPtd/yIhrSJCH0cuy97wGCaLEBJPUaDzz4AJuPKjIslC64uL/N6Tebw5MEcKrXM1KFE1+/aSanxqhfQ02/HHJKuXvE9998PoXffD2HTtFuUj8TM2iOFNmxSkG66SvSdjZqDBmzmPYhNJk27ObNnc8X777JRqNyrD88R2P+NLpkfFG9ghHcQnOJbulruVohkACN8MwcDoLtVKzAeMJ/97VGcNq6gzl5xVaOHFfiuPFtbDA6IE66mVVLGTZKei5d9hTsyjpN6Zk1n7VGlVh9eImuaXMF1eLEQyP+jGxvUiZr6HYtOM+j5LoY3PU53Y/cgNNGc64WsMwIx7lntFEqdWOCiCSNCayQ4Zsvk/FO86RRwNwFI7nw4tmU9V5J6ukyy46+9vjjT37tmyBkw/9i+0UXXfTO4ksufoMJSKq1di48p5tyVbuLiqbZf803DRQB1IgiST+qUmhIBc/HSkBBHPenYZm39O1MTjqrjQ03yIHXJwb10PPwleQ+eZGwprpam4aGGBlYqnGZcHGCZQTur7odAo7T/JqcpFZlwvT5rLftdmAtvq/2rEHz8E2XuuU0fVqN6Js6kY21uXrHldewYO5CjU6QJrDU8iszu1qDfIvw9pFd6pmSGWGq8UYKFXs+w5dehuVWWV08EWoa2tPZyfMP/IodpFjZ3zYMDEPGtDbz6acTMBIm6hPI6YTUCFyNRJuVRpWBpGU9j9mTpzGwVmagKUvYjmn1hDGK5JoOpLxzZk3h0QceY+tN1mHc4qMZEBoeevxppb3is7KHODHIBsCYRYW//nJKbzrLlnHrrEyh0CQcBUN1X+t8rEl7Oss0pwRpDSM6Mlan/fwA268faSYiFaNB33xn48VRdXKSaUKMR2fYRGexhboAp5mzVyuCnIg/mgZfhl6NUqbJwIeMGdUvD1+GiDKcO2++ie+u0MyxG4/i3rvuVCSu0qSM0JOxDRw6gmlaRlfilDy+nD3KcAQUI77q9hxP/e431N57kUEfv8OgD95h6NcfMmrmBE7YcAhhoc7EhWXGrbYqBfG8JIH52ic65/tHcvC6S7LvuqO467o7wA6VnlhKBlZfaXk+mV6n4bWIsoTh1dnM/OUl1Cc+TSCcctqfOOPExdh0tVj8qlBW5puJLahLOfvp/ss/UgXtJ4Xi2QjOO/NzvvoiIrUNl2s1X37n4L2uzxKAvzwacfQbWrONip132Pl6G3gzY3ne997r5obrFpCIuCgvZmUpizDwtWYW3zIWIm2g/3I5yBZGqTrK46dhSkthCrdcvhQjRyW4pqif2Lm3nUPz9E/IR3IMSag6jZYB1JUeo+eiCtX9J+5MMfpFmb0IFuJiltF8OmceCwcMY90tdkdLUBFtvhWsEe899Xzj7bdYY+UV2WW1dXj03vto8Yv4Ri3KTDbYZmuen5rSUUk1VV7GIIb0RNjXAAAQAElEQVRmcwvXRCWLjNoj442J09l5v4OQn5CJiy1oafDqi2w8op1B2qNYouDTHvXx5cQJZL4hlPP1NL5sffrEA6dvK1riVDzzAjLeTPr8U1ZZYjjzyxGvToNNd9kVhJcX+P3md9bZp3H0AQdzz0+uY4uNNuXRB++VMdVpiCaTy9PQRA1nSI39Ey/MH3Dn2y4LLvX5RBGxMngEy8jxGdFkkhyNuMHVF1/KFuNGU+ibj42qyBfhjEHmLfpiGQZZb77t0jR4GuxIZKRR/3inkXWbo6KN10gAjIoahBDSS2QIqlC4N7kWPpxXZviyK1JTVeZ0i9qge+2F51l7xGKsOmg4maMoiRdxnJDis92+h/D05C6MnL2CPqn4GWWCcPTjnDn9C049i+P325Nz992Diw/Yj/P23pMfH3U4KwKp5PPRrAWsue6G1OWpolg4y4G98NhvGT+wnQ2U3T3ws1vU0cP3fbIMZ/VN1+Cj+R392eGQeCFf33MV9QkvUoh7tFfayQGHjWT/fdox2ozF1Gj4gimnR+LzbZcLQhpRC088Vuf+X4gLcSsiqbzJ1uPOvvT0S6U13wwh4/839mhra5u23LLLnZOaSiUi5eqrU15/q0mBcyCJCQkV2bRJipU12DQDJU5q3SStYJGjUKWJiBRWkyBl8SGzuePHy1CyDaT30D2DhbedzoBpr9Oi3V9xGNsf4UV8f3jjr7oyBc+IMgQIEKmMYIF88lOfzeWHV55OWAzJlMlIyb4RsEHU+hhFqURRJ58RqIE9SqfrInS5lVZipc224Pdfz8bl24kaPnLyBFLmDK6o1nhDrz5endzLKuuMJ3IGYyxWS6gpn35MqdzJMgObWVYo9c3tZkG1c5GCK+e+8Lq7ePT993nw/Q949O33ueOXP6dUKkCUYmTgn737LmNaQ0yhnQdfmc1WO+7O6BFjpQwNUm2O6RCC1555gkdvvYnqzGkYIwPwDamMqn34KKrCM8gVxW5PVAkvVCQ6Ic23Xql4o8xsoUl5q6vOHofuTyjP56eCpRTh4Qd/ySoDDKPzEGo3X91JDcQZYI3JAomvuaz4kVX9paIhGo/wc8R+Kn2L0Qz4iQdGrYKV6Vgmb1WQWENsLIEpUI/g8/mdMGIUa6y2MdnIWKcn2clAIFnmTSycHBXtGTXEz+Fjl2IVHTG/+tVkrf89fDEw1sypYKLLCt9Q4xExJguIpkHkqlQFq+RZiuqTp8QnnQGNwSMZvfxYMieWmBwZmU68MKHFEhGENTzp0TJrrkXzSmvxRU8XA6LJdPz0h9h3nsWkjnzo2HnbgVxyUTvOTgOvqrGJnIbBS0Wx4VuvcmMAn3y1GGecMUtoi3MJ9eGDht9x5bk/e/RbB6uDZtHvN9znn39+eveNdz/Q1lp4XM41LmsD56QTJmtjbgQEHklsJScfEpUMTj/STgyJRFQdvLqe+hbBibTCBt1svn43d108mpYmjZXY3IKPmHLrSdS+fpswF5LK4yIhg2HR5fQQDP3yx7o/b+qvy/pkrUZoZk/hYzxiCbdRLPH6V3MYveSSLLfCODHf8qfLLAJkWDR+0W/Waoi9kLJ2sTKFCiXURH0TGxDJq511ycW8M7mTid01XFAC56NMUkJfBLtfIQS6IlDvTJrBgMWXZulxK0jBPYzzcD093P/T21h98TbWGDaA53/7kFZnDaSrOALW23EXnurI89OZPk92lxSN1qetTZ5ffEm1nn3luWdpbSriFduY1hsrinfpZOQsZSeiW4YUR1o3a7nXbi0lLc+kv2SMGT56LHfJ0bzx4VdyfHmwnhRH1GcIY0SHENYz44O+sg+VP/Jer9mtRicFrSjqvjhlFtvutCNNpWZFOg/E71mzZ1GeOZWVRrRQ8lLRowEapyGCrC6aS6qgmn97G1WoLOoO4ndOxkh2iaz+/Ry9B1pKeFngMIm+UjSi/5mqfzZUdgfZ33+ImW9rb+KK668iaG6hrDQuVu9AvZ3kKg9AVY44Fg++d8JxTF5YZVYtxoVF4siJL5bUqLMoyB5G461kk4jGsvi6UIDKoSOS4J3gFr02ZlQD3pxX5cQLLsQvtspBlCRzi5H+IzkIRby4S3Zj2Ot7R/PC3JjpvfPoevJmzBsP0J4onKjfRtsM5pqrRlLMzaHu9VDTstaIgflqqOwL8GP9/KU7w9ZSrg3ktDMmMmOmI45zrqUpeOu8H/zwkhVXXLHxl0b+sX4RhD9+fcNz/PjxlW222egUbDC9lsZuwicJ5509lai+LK7YRNQQlyhBJisV5ywmK8bhBDcVR3x53bxSUWhgc7PZdXfL6ScOpV3Dcq6G6ZhB389/TPDuY7SpTyrsDCGexgXy0H7SR09glF7lsH6A51tCwW1OQ9WF8lM1in6VepyjYQJ8v4tACtAT5OlTtO11Ifd/Wee7hx2G50UUNNYXnIbx8WxMS9ojwyhTBtmLRw5Ltq/imYgsUjlFqcALGDJ6NCdffxOD19qKX7wzm0ZhqGhtaEwXPVb0ekWliz4F62E9Q6+BspTtgykdHHz8D9B0GK/cn+r++tePMr7oWH9wyLuvPI9VX6vo2z5gKOGQAm9M6+Wl6R6PTgwZMGQ4A0aMwNkGHjHPvfQyg/w6A2qzyA9s5aZ3Olh257343oU/pslvEs6QSx1GRmRxeLkCK6+3Ib996y3eSlv5yXtT6VUanI8qxLKmmhALraVVSKReQI+U3dhYUq0RUqHHGFzg4RtHk7IEmRCJxs2cvoB5Xo4lVlwP65c1p9iYpnz0/oesMzTHkKqWFkqtnRxtYDxCY3GCheAYGQHSk9hCYhyI9iCBUlomUICYKydasyGeHxAqM7PStU4PgqBOc9RFqnaEq8vw8ht42TcQhpJiYyFRMIB7P6tQW35VvnfMyRQLeTQdZRcT2UTjDQLNLrvvz9r7H8EN7/YRh0Mh7sX3K4KU4gknkatJPZxSemOc6j0i/QZS0jDSe+TTh6MWl6lq6XLvexNZf9vd2POow8nlU+155Pp1VJNS12ZikvfZ/diDWWe7HXn+6c+oPfIU8UuPEWhO38Rstc4gfnL5WAYOmEr2n4LLB6lknuA5Tap5QDDFw9h6OPPHOjUKNyf+xqaNcjRWjmEKL73cQ058c55bsO3WW5xy+AmHz81GfFsRNOy3dfpj+y9+8fi0NcaveWwY5uelUqAnHu3mxxfNISqPhHwOZ7MMwYCfQzaZ4b+oZNIQg42oMGrwfEG0qfpN48STBnLpBSNliI68q+DN+YTyXZdiXvotgyQgjC9hCaa3gKa0l/ky/M322I0L7rydC392E+dcfzVl36PLNlHXeqxXOJTDgJOvuppr7rqRa265nsXW35iFLqDiN/PT96ewyZ77c/Wdt3D1bTdz+W13suq2W7FQAraJGC4jnil4F91xN9fedBMX334HV9x2K9feeguX3XoDP33iCR794BXGbr07Jz/0BV97I+SMAm1q9RLnyswv5Tj87DO5+uY7uf7OOzj6onNZ4HksoMDrkxewzV57cMHtt3Pl7TdzgeDuetQJDGlvptjcLEX6PpfdcjOX3nwLF95+C12Bz6xyTFoYrPGtvFvxZPgXcvFNP+GK22/ixGt/QqG9hZFNHpWkyifRIM59/As23OcIHnztbY4/9UK+s9v+bLX7Aez/g3O4+9EnuPfhx7n1rV4ueXkm0wavKPv0KCYRHeLzRnvuxY9uvJHLb7qRC6+/kdqgIZS9HHEsHMSTrtZWTv7JtVx6621cfevt7HjEkcyrp1LTdp6ZZTn0sou49PZbuSobf9N1DFhiaYYMHUgSCb4czb6nn8Ult9zEpcL/lCsuo9MvEEvBUcDI9Cm1qJePlQPJpdKF1DHZwO4n/0Dyuosb77iDc26+jZ6WIl2Cmerkh7ZmjlCE/tFdt0hOt7D/0UdRkYKV07KAVXDSi4n1Eqc9/iU7/eBEfvXSs5x1+gUc8N2D2H27vTnkwBO47lf3cuadN/Hjl6bwxoIIaMPIccRejW4TsMeBB4vmW/ix5rj6zlv5yW23cdWtd/CTW+/k1ptv5aZrb+SMH13OTOm3VI9UGeRMfykO//VH7H/WuTz4zFOcc/qp7K89oR2235kDTj6NG598kO+fcS033/cSb/78Wuov3K8EOxGvDatv4PHzny/PqEGfYNIu8FJMbAiU4RgSfQtHA0aOMBWvnMnMGNAjsYayy1FLB3HTLX088ECZnIJCX71S2/472x16zwP3vqWef+n+d/USyb+r+w8rjDFOpxdPtw1qv7iRBuV6w3D77bO56546aTqSho73lBIQa3PODwTCppD6mKQgQixGEY+MOJfXQ3VqJprIXvvmuPGWpWhrb+ArOwh757Pg/uvo/c11lKqT5MGrJIIXe238/s0+XpZBfrXKlkxYaTumrbojP36ti8+rlrSpielpjjOen8vcsevRsew2dI3bifumhDzyeYW+oIlptPHjVxayYNx2zFxe7SttwVPz23js4056CouxwB/Otc9107WcHMZK27NgxS2Yt+JWzFxxW2atvCPPmsU56YkpXPLMVL7QXGUpoiXG+SFzJbw735nOpJHjmDtuayYvvRVzlt2O855WZBXcV+f7XPZGN51Lbyq8tqdzuW1YuMyGXPXafM5+biKfjFqLeattT8fK2/L1kFW58oVZLPBCqnEfkSLHuY9P5qOh6zNnuZ2Zvez2pOp7w2sL+KwzIvIsiQz4/XqBC56fxZ3TLWMPOJQtLruWrS65iuUPPpq3C0tz0K8/5uHpC+ltyYzWx9lmUtPEva9283J9JLPX2JJpK2/OgiXX4Ya3a0zs8annhvPZfMONr8yjY4kN6FhpW6aKL2+UFufnnztmeAO55+3ZvJkfw8yVN+2noXeN3figsDiXvziTL1rGimdzmTl2PD2rbiO+b8ZUwbn01Vn0GB9MCplmS+GdszT0mfhFuhqOe56dzcQBKzF3mc2ZsexmdC+zKTe91ENnMoo56TCufHE+U0evTue4ncXrbfgwtwx3v9lFV9AOtgiNBrmcz9S+Osf99iseWNjMqN0OYodLr2SXq29g7ZNO48sRq3PMI1/xzpw+9fWQhQqbkG6/jV+908lr0UgWrrAdHeN2ZO6yO0gXtmfiatswYc0t+WStzfl67c2YuORq/PB3U5gT+aRJm2Q2hK/caI5+5AseiwczZt8j2PHSn7DftTex7iHHCa3lOe+cW/n11Zcy79OnIZ2OH5XZZN0ct961LC0D38T055ZizV+4jWzJl2O32ca7C8EY4sRhzWB+9rM6F108FwlXWX2jsdRSS11+xhln/M4Y4/grLvtX9GXTTTeNjzzskOvb2gbdHZl8rVIznHP2ZB58IMH4YxRFwWuxYlAK8mxkSIvVVgZknNGbmK/f/t1Lk6hPjUJuFrvumvLLX45g5TGpMoQuvGQa5Rdup3H7+Qz48nNK5Xb67EC+0nn0Xe8v4I73erj7w5hb34l44suEum2BWkpDz6cn9SpD6OG6j00jVQAAEABJREFUd7pljD38/NMK8/0B1I1H3Svw4oKQq96tc9VHZa58q5NfftzF9KhIVAtJzCBemwm3fdjLjZ/UuPn9bq7X+7Uf9HHNBxV+Ptnydn0Ac3IDqDa1kcgLeqIniRKiQhtvK/Lc8PZ8jenmuvf7uPndCu/M9ZTdtDLbtfPwFzXu+CTmJ+/0cPMHPdz5YYUnZsY8uTDk2vcXcsnrHRpb5s6PenlqYpk+wYzFJ2fqfFhv4bb369zxheFajb/hrT6enlKnK2wl1tIhiyBdxSF8KWd8/wLDD95cwNEvTOG41+Zy4mudXPdpnQ/CxVhQbKPulXBeHv1oCZbnq2rI3Z90cfm7C7np8z6ufbuD389IqOcGkthmyt4gnvq6zE1vdXDDxzWuEt63TajwcW+OspZV83ODuPvTefz47Zlc+UEXN71T4Z6PGnzYKDK/OIwPa03c+GYX1787n1s+7uFW0fdqhyd55RD7/qCCBjyPKDWKflYZUxtfdjS44+0ufvJBJ1d/sJCbtXR6a4ZHEo5ioWC+PB9uEqzr1OfG93v56YddvDY/pSycnVfEWEUV8SbxmviqMZj7pjqOebub/V6bxkHvzuKotxZw7Qe9fFofRNVpfetijOeDnFPdlvikmucuwbxJsH+icVe+X+aKD6tc+3GFGz7t5vJPF3KZyjUfzeOVHkOl2AbKQD0TU00jJoYDuWGy5ZB3LAe9WObUpyZx2a9f4PLzL+ZZHVf2zXqTggy8FKfsso3l1pvGKNuajss85B+48pceRoyzTnaWyjFgiD0wctA/vyfk3LNnkgXvWuKS4SNG3Hv77bdfra0BpRz8VZf9q3qr8/nnn58++eSDZzS3DXikYfNxnzz8scd9waP3t9JwQ/sVteEJbJYh4IOtkUWHLCo4VO/p29bJrlTR1qYOF01lvY0rPHD/Miy3ItKRBFPvJn7rJeZfej6B1mPtpo8+rc+rpRZcbhTYUVLy4ZjCEEy5QS71sFp2JPkhdBYGMC83mPLQZahKwdN8AdIqqVK0ioypqzSSvqbhlPMDqIRFkkwhtKpziSEOSnQ2D2GGnr35Nnql+D354fQWNMZr18bQQJJQSi1hpFI83+RFikpaEPwWys2DWVgYTE9pGBVasbkSKYZGrola21A6bBsdautqG01nsZ1y2EQl3yxDbCUZugR9+WF0F4brexA1RT+X8afRQByhIhg9Muxq60gWlobQU1Qf7am4JMIPZQiKXE7wk7RJvBkguMPoSSSXcLhkM4DYtWJkOGRy0X4BgaEWOrryefrEJ9e2vHAaS0euVWOLEGnfSrCdkYOTgdU0Z1d+IJWmodRahojegijzBNtRdx7xoMXo8wfSHYygL8mT5ku4QjNR7IibBtElWXUWR9AjJ55KRs744t0fbwe6TRASm4BqAuU0oDvfKloH0d08lB6/hUqmV5rLa2qnakOqhVbKwqunaYjwbqEmXiLHnQWLfueXQiQZ17SsjMJBODNY+4LDiKrtJHE7fvNoel2BuNgi/lgwMjYFmjQoUvdzdJfa6MwNoCzcG750jQGYZICADpWOjqRolyXtG0I+HUZaL1BAGUh9Hk7ST0QPQQvWlCjGls5Xn+fzGy5kyvv3qe9CcnIkBVfh/FOHcOedyzF08FS8uIwv5yRE+MYrg5118LRP4jckg8H84m7HaadNpVwrkQQFV2ouvq9s/+QNN9ywM+v61xZx468dAuuss07Pvofte4rxec8EgUvwOe6kj3nwQUs1XgzE2DSMSU2vlDqlXjegYxzMH5yXWzRnKGM1Ouoq5hLCqJPB4xZw531jOXHPQQyT8uYpy7dMYOEjP6DjrlPIzZxCS9xHmPRCrYKXM1SSCtaPxOw+nDy/XACxTSHwiWvZfHqvdWNdFZuUIZFzkujwLC5nSTRW0sX3IhmONDKpkyRVXGARwEUl6y8j7ce6XsPWq3iNXgJtvMUSOpnCplIqkzkJSEW1TRt4JsGv9eCnfRjN7zS3Cw3OGs1Rx6Ux+OJNWhfoCFer0j9NYsEWIAmFU0kG6GMzJ5t0aazw698O09gML+dwfkDcqOO5DGYkWKJZv5ljyfiQii/Guv5NvmJvlUDORgyDtJfsf1kZ+zGJ9XEVXz4040sIjT6s+B/G3fhSWM849RFQkyCEUGjCdw0KjR7JrgKeDF1OQEIB4WVFo2vUcPVeMClo74JUfYxgCzKp8BTuasy6Lyrql2VAIpY0zIv8PC7TGw/BN6CNx0By8qQDXtyLs+KBcSBeYxo4tfUX6QZ+iNNeU+oXqPtWIkrF2wZhailVHc11S158rkfCXZuGNSsUPc2XajIvEMwEDScVXDEARTCioCFYDZHf0DIgJt8IqPV4BM3D6RNcF6SUSylZEEuLBRl6J2Pjz2h65gI6Ltqa7gd/iOv8WmPr5JKYdVfL8+QTy/H9E+sUzETCjExlA57r0ZtT+ZdbqkbGl342OkMq3CVyXKFEX72dO28tcfIJ09F6nwY9ifT787333G+nAw88sONfoPx1b/av6/4vva+77LIZhx6yz17FUv7laiN2XdprOPUHU7jxSo9qeUVqiSHJG4yUP2wKSWWoEhGkYnyiNWFaItMRWS3SJYiLuGovY0dWuPCHw7j22iVZbLTmy1Uk9DLRe7+jeu1RxM/cTmvHRwy0swgrk0jzC6k1JSRFKbZAywKQa8e4GiaVgsvQPRlhRqgV421axUi5+qNiGmn6hoRdl6HXJLAaXlpDyAJVfLV7ipxGDszKaXh6BnoGEmxOqSBCPJIu6YFJDEbGYRQNPInHlzPIa/6c5guFS6A1pNE7ehehkCm0jNaqhHoPNa8vXG1Sw2gOI5yN8EXY4SyBxuXSCkFaFs4V0VYTjEgFcD5GCoOpg1eh/2kSPbMSg22QejJUOZjARaIz6qcNl7U31C+WKBIKcQNf+KN5rfAJRUPgGv1tFhm4cCWjIapjowZhUsETXb76yC4XTSvtDVwFX/OE4l0omkL1C0SPJ2fgC4yvei+uZpTBH36RQ+0v2Rz9uKujTUB0I34jfhvBsJKLs70YIzr1TZzgxzU8OUZLXf1Fj+Cj4JLJRQqIEShPjsqoTz0X0d2c0tWUUs3HGI3xszbR7eQgyfiodzIY6m9EnyccfMkFU5OzrogfFUK1ecIzsB5xvY5vq5DKecchuTjP4AXTKT15L9POO5Huh38BC2ZBJlc/YfSQmEsuHMsv7x/GamvMIMiVyWAjOSFZkwT826vf2Wr56uc8rHHYQDIvtFApj+H6aw1nnjmVsvYBCaxrG9D08t233brprbfeOvvfwvlrvu1f0/nf9r3++tsn33rzHfs0tbU81zB+0lNp4vJLJ3HeGdOo1ccRRXkiGU2jlkhGgQQhCBnx+HrRbf6sqDWvtrTegWufxra7zea3vxnOFpuEBIgZpkrz3M/peeRW5l9+KsEr9zKg+1Pa832kNiKtxxJORo4TULBS/JwEGkrZUpdTqtqs0oSn0FyQYoZRgpc4EmuJPJ9IipFiNU5zaQwyhuxbaAnbBF91ngpSnkQYNUyRyPNkl1JI0xDcGF+wrdNIA5FQaXjZ09e8IU60WcE0xCClNjIUm0WpNCQxObUE/Xh7ardSWCulNIKLSYUjxCavklNfTziikmrO7KmS+qIlkHE7mupQqhkKVW9RUUgsqq4pEn4uojefUA/QeCOjMpjYgtNtxENPHUlA8IxS90T8aNiAuuaOTAGr6OjriDHjnZ9YGr6hoshetyGkBcEL8UVXdtyaGATJF00G4wxObiQ2IbHJ6tBXojo1Zwzuf8uQ0NySG/0lBdGOoHiq9sXMbM7sfwhVDVNqvlOzryicw8o5IlydQVeCp/G+Qq3Rsi+DZSS3UpRSqhvydY+w5hPoWah54pehpDW+l/WVFLK+2bsnB2n03Y+eYCMtwPdxBUtcclRaEvqaYyptDZLmKjadSTvTGTHxXdoeupsFJx5Kcu/ttEz+muZyTW2WYU1w0HcG8urLy3PEkb0MGDgLL18mFe+dFb3kxEcFzqQFxH/+1SV6lTk5OT35X6I0TyMex7lnzObyH3dQizUklOkMbHv2smuu2XefffbRjuS/AvBXf9i/esS/GbDHHnvMvPrKa/YbNGzogwpr9bJC6T13zWLvnT+k0r2UiCiR2YCVASLlwtRxwQISvyyxQ8aSVEJN/T45kIqYnBAEVYqlmKEj5vLIL5bjviuHMbbZULMFmmNLOPNz5txxLbOu/xFzX3mOXF9E0WsnX7EUaw7jQowEGqRO8Dyc0frZDATTqndfES8hJzxtljeagtCSoftFGjYvnAKQIYNH6oUkUuZIDiQxRortEdmA2C+oNOPkvckMymtgTIIBUvVNrU+qtXMU5Kh5RRlXkUgOIJGCOZex3OKk0KnwTE2RxGsSvJKWQ6EKGBNhTUMvDRySunXq06bSTmrUV0aG8MsgmUyJREeiunLo05cLqYQhtWxupda1IKCq+rIiTqVoiUoqMuhUuASKcmEciEe2n+R6GAkPwOVJyBOJ35FXkqyacKLDSXn91EjMHonmi/0ccS5HEqqPKYmmAomS49gXvpo78fL0OxcvIJYDcfrOSvaemH7swdB/GRxWo21Gr55kTxm5JhZ+AaFwNXKkccZ/8T31fY0rYJMiiStpRAEnnKREqgdPziGQwRsXkXqOXtHflwvEl5C6n5djK1ATn7K6nrwvup3GNfA1xtdYg9M/D2cCEpMXbUVKvSWaOouEfYGWlmAVYMK+PgbNmcPYCZ9SvuYKZl+5K3NeOB/HZCr5Bj10ERa72WKzKq+8vizX3phjYMvnCi8deF5CuccRG0/8saRWMvcXgt8BJuHPL/lcMoyEHn5ziXmzi+y0/Tv8/BedVGND6uXTkaOWfuzMU8/d/9C9D53152P//77b/78D/3zcwQcfPOd7hxz+/ZHDh1wRmURnCpaX34pZb4OPeOrJ0TTqyxPV5BGdjBQrup2ER38xjn79cAYpPnjyytQjOfwGLfmUoPElO27j8dzTq3D8kZbWpk5yrqbSrROgd+FnF1G98kTyT/2CJRdMYbFyn8wmlEIXqUkpjUkoKBX24m5MWiYOA3qLBSlJRIKuJNDEBb14KPSRhvX+ghepzqmkwk89TQ3PlCXUbhlHB4Gbh43LkGicsyT9ziMTn8ak/cOQNNGki4qgiDr+paififVdJ8skpH16NxoiJZHhJipOBfGLfuYIHy1zcBlwQ6r6bE6ntyxS9xfNkXVdVFINczhB7f9GeGa4RgYU9RMZZ6Sq2NLfh37tU1s//Ayv/pFq1LtSaFQciZycT13GlkW7/jH98NTHNAS2QZrRlE2I6mSYml634GpsBgMnA9B7Nr+A687m0SPDXTS5DE89yYr4mj0TA/UgIrbJIlgZHaknvGMSOWcr2fhyJL42ZIOspFbQEjLd8hNfYnWC1odTP+Ro8S3IwTjph7NG9Qk2LeDFA4V1kYYXkjk8bB6TBOQUrfNRH4nmTJMC7apadXoAABAASURBVGLaYp2zWOyzJ8g9dBY9Vx/A19JB3n8VoYnV3pE1VRYb0scxR7fIBobz87vbWLz9K5qYpalTQi/Fa8Q05YyWKAavn2eIf5Ah7mJDqvTTeXkFWFCSQ0XOuNeswC03NbH9zvN4+c2IrqohMSZeeqkl7znm5BMOO+GEE/7mjIE/XPYPz7/5cf7558/Tccl5y49b/gdeIT+1Qd5NnW44/NAJXHjBPBb2DJJiWWJKOJvDZUoghpgshc2E6VCdip6SLNov1EeE8RsEpQUMH/4Zl1zSxP2PjWaP/UsMHeDTpo65ujKOKa+w8JEL+fKWk+h+8i7aJ77MoK5plKTwDRlALVchyS/AWBl2NVBK2UokRqfZpqOJNE8vXtpFLu6jWHc0VYrkyy0g3JA7cCqpyRGrJFkhJHVyKs5XH4sI6heqyGDRJSLSP5R+Y0vB6JvsMtkP/d8m0TPWeD0VrfqNTTSlMtysOKk0WXFGfTI8VVBfcSqrSlWdStmdSQGVbAo9hBxk8/6x9NepS6IBmTHrOxsfC3X5CbJ3NO+iFwHpx0udMpjZfE7zZkXzJMqMYo1zmaFmOP+xEOGs+mVjM4BZfTYWwesvgucyWtWnHy7/7nKiNSvo+S9FRmJTEpVUBcmUfsJFYj8+saJ+onZIrSHxDNlfP0baaI59OXoba3YPm5RkuB457S/k6z3ka136rmCSFJSip3IyaW4uNtcp3etWe4+WH4mWLWCMIQ5j2pLJFKc/S9/TNzL9lrOYetN59D7zaxozP8JzmU0upLnYx0rLFTnn1JE8rmXxVZcVWGM1BRLmY6X3Rnhk7HEgvMDo18ixWfHGSmdsLIWNpVvG0a9e2rOxhTzVeCxvvLIMu333K04+dQ6fTxLeYeCc53cvt/xyV9x66w2nnnLUUfP4O1727wiL+++/P5nw8YTr99nv4L0d+a9S8mkqQd5661w23+RjXn65jVoygIrxpb8izhUhLal4/ergiWOe+hsV1Gwy5KTgqa0TtNZJ3DxWXnE2t92yJI/cvxTf2bZAWxbN415MfS7R/LeY8/otzL90f8p3nUbzBw8xsDyrf00ZRAVFhxbC1BFog8uXUvhJQy6qD9904dMnQWnSTHjRUIgHQJayZ5iZkGxp4kwzqVFqbweR2MGkNPHP699ywPzbir/yW0rw14zQdM7zJCplXHIMqZeS+CpeTOI1SL0aieQXmUxekn/s0dSo0Bx10xT3kE/q8tOpZB9L3hW9VxUKVJf00ZYuZEg0mXDSUzQe+zFzrtiDBVftS/k3V+G+eAejvQTjLFZzhkMT1t/FcNWVY3jvlVU546QK45afSxLNItImQUMzJIEjyiVEntRLJTHCGwUYtUmZQLqO9FIvuJza8pAWF+OjjxbjlGN72GHrD3n3dYNT3pyaQElw+OX++++/26effnrGRhttNP+vYdt/pq/9z3T6a/vccfP1b+y772EbLjtunSt7GmHFKX2bPNWx257T+d73OpgyZRRJMERMcv3CQ95dFEswRkVcSwNIcqB1ptVYbeYT6ZjNiok5GTeNL1h19ZncquOb558bw4lHFBgtWw4qdQqVDplzF5UPn2L6becz/0fH4+74CaXXX2VQ73ysr7ZgPh5lOQspRRY1XCsNr5VaWKBSSii3dFNr6lI0qOClVTztttukik1qi0pcx8aRcI3/Wtb8s/+3csB8a48/72AUhuUD8CIkk6xYbGIlM0/FVwnwXAPPdJD9/z2UQ+jONdMdttHnl2hYC6ahTMFTIGliaAPycybhvfMIHfddxOyLD6fvipMIf3M33sxP5Ey6KUQVilpmNDc62XbdKtf8uI23XhzN/T8bxT67LJRevYMvB2QqBe2VlGT+Abmio+FViExV2UoOIx03JpXaZ87QA+0/gZ6eE56OqhnOm++M4KC95rH91hP51a878JTpVtMoSU3z1DXGb3/SVVddtcEdd9zxe/6LLnHm7w/ZGON+9rMr5v3ud/ect9zy4w/xcgPeahjrKnXDQw+WtZEykYsuipk6axBp2KK1pCFOhYd2v51NxKPkX5gWBfh+E36WYyUeRlpgXB0jAQW5BSy74kwuvNTn6SeX4KrzF2PD8U14GVXaFPPiPtLZEyi/djddPzuOjqv2pP6rH9Hy0e9xfV+T86sSnMHEBWzSIgQCMBXwlSLKgSCnZUyMMZEcTlVK1ic8eglcF6Hr1Ngq/7z+Wznw7ybLNh6btCdQ0GlMmDiJzIH0xFHAmZKCcRNWSyLfZnt0C0mlF1FQIvZUT0Cbl1BcOIXip8/R+N2tLLj2B3RddRx9d/8InruX3PTPaK706SQo7Yfdpq2zDTctccH5A3jhxeW595ftHHtowvID58i5zO/XD9IIzw9RtMG4vHRVOq0TkUDvYdKkZa10WjhaOTFnEhpajkU5SxSMoru+Ao//fgQHHzyf3XadycMPOxb2hHIqXlRN3cK2IYOvO+CIvbZ9/fWHbzryyCMXGGPcv2PK36nC/p3g/IdgFltssepnn736qx9fetmuSy238hWJ9ToSz7r58yw/vqxDHnEe11/jM2ve4nLXi9EbiUESXkMMQzu9qa1JwDVSRWwnwXsmxCmN043WBojrEEXYNGXsYt0ce2oL9/x8APf/alV23L6ZUSPrBLlesL2YWgfxlE9Ifnc7XdcfQ+OaY4luO5XCG/cxbPb7DOmeQXu1rj2HHLbWjkkGkXhFKVFeJacSqPhSLq+/JHJkqeGf1/8wB5xso2YairQNIj/BFQNcXjIKDJl8Em08JmErDTOIXDiQpsjRqs3EIVPeo/DSvdSvPZHqVUezULrQ95uraXz0DHbeREX+XvLWkf2vKltHxqyzmcd116/J/Q+szK8eGswJZ9ZYftxXtBTLULfSF49Mz5yXkgayV68PFLwIFuqp78hgKh5eLcTppM6ldXHOwwRt1BnOVzOH8ZM7e9nqOzPY+4DpPHR/RMdCXMOYNLFmdqm57VfnXnTxmnNmzDn51uuv/1xOIRaA/9Lb/pdC/wPwo446cObnn75/+m333L1BWCi8WTWNKCjClBkJZ5w1nw3XnsJ5F/ThgqWpuQHykiWqEZi8gTDF5mKsX8NQwZHon6+lWVGlCeflwFbJjn9qvRMY3DqLHTf9mt/cYHnn2eHcc+soNt7Qo5QHDcQzjjCqUZj4GenLT9J1yznMvOxgeq4/gtqvL2Hg5PdZoVplTDWVf5IAGypxQjFXIsw3kwRNRLZEREHgAgH95/0XOeD+Ysuihm9rX9TrG3+zPdZ6ziNpyZOE0g6vLL2RzEwnpAsI4jk01xdKnjG5998kvuVCypccxpwfHUDXnWdQfv+3pDM+JFeZR5M2JT3pWEIdryllp4NC7ntybV56fSl+/UCRg/b4hHWW+1QOZgq2LyGfy4JFjbTYSVIoE+kkrGHzxNLUVMsDtPehDQnhkadeA5fpcF54hR4uzJPmhvDyK46D9q2y6TrT+MGJC3nrw276NB7bEkVpWhs4zP/ltbdcvlFnZ8cB559xxiQ5hfQbGfJ3bLR/R1jfCCoj6uB99vn8xhvO22LV1VbeLTHFTxLPNEwe5vekXH1FJxuM/5ITjzFM+mIl/GADGo3hMvwC2jPSU+B9J7YZZQoySq01MTEYbTjFKb4HuYKv9D/EdktB/G4Gtc1lj+06eOK+Em++NoSb7liOrXcdSdgeKqr4+KZB3qvhV2dTnvYG1RdvYublu/H5ORsy74pdCR+5miFfPMvSXV8wrGcKrX2zKVa7CJJIMg8wXsA/r2/ggPmGtqzp29qzPt9SjAkk8xKUHdQiCvUyw6sLGNszhZGTX6fwxK0k15/A9DM3o+cnBxC9ew/erNcpJtPxvLIMtkEWgMyghBV1ZH72Fcvw7JOLMeOjEdz94xybr/wRI0tzCFKHL2vxrZ7GSA9ruLSmp4xeOKYmexrtcXjSD0/LCbIKBTAPZ5ohPxQKw+mzg3j1Y48fnOOx/jpz2GXnbp7+XYWO7pSmpkJMQwpZN1OWWK71B1tssf2KTzz64iHHHHbM14ug6fe/8Ra5/42zaaoDDjil/M4bH/32gRdeWnvssisfjm1+pZbYyPkBX30V8uB9vWyz2Vscsu/7/O7RgI65AzH+ENJIqUYkw8dhtanj2bKeNUwCvg9WT1M3uMRSbW6nHDbLMxfVu07OL7P8sA6O+O487r/F8cnrw7jj5qHst89QVlzWUDSRNprqEmxCWq8QL5xDZeI79DxzE/OuP5GJlx7BtFvPxj1zN/kJL9C28GsG9M2kVFuIr/Wsp2MoTzvN0hsphekv9KuNIbuM029/0Xfm1LJ3VRlS9coQ/0NFf53T+D8W9G7+ULL3P9YvevI/e33j7Eacz0p/J5f9Gv1kRY8/3F4KWcn49ocqxBD+dGmcEV9NxienD904K6Ozf+JJEKU09TgG16wceIXiO++y4O5bmHbZecy6/Gz6HrqT6kcvkiycRapNZS37aeQFqOhYbWWPo3cfzoPXj+bzZxbn6dubOPfwbjZfq5eBLT3akaj2BxCfXnJ04NlICGtsf0bgpHvCI87j1fMEdV+bj3V8ZR5G+qC1BakrKIvI01UPePmdPBdeaNlsow623hyuvzHh3QkJ5QgaLm6kznZ7pvDQqGGj9rv7zrvG7zvhoOufffbxSePHj1ePP3Hkv/XF/rfO9meT7Th+fGXihHfueeP1F7bZeONN9nDYDxsurvQ0XLqgbHno0Sr7HTSV9TeeyZXXWD6fsTJd8XK4qF3czEH/3yAYnGzLCW6qIF5LY1IvItTmot9QNJGCulAG70ekeT29hZjcLIYNn8Meu9e57lrDC6+M5rU3h3LqqXnWXC1k9OCUokRaiqBQq1JqlEFr0PTDJ1nw8DV03HIS88/dg45LDyB47lZapr3GgO5JtHTNZ0ADmtMCflqEOBRWuX5dt1JwXxHOSMVM4mFSiyUhsBUpYLcUTgOFf7+laO5AyhVqHyWMLX4SKlMqYJ04pDHZuD8V1dF/Gf1mRY//Jbelgefqoj8FkxGX01PF6t0a0e9or5r+ko8NCsaIGeCpv+cw1uo1JYwrFKgRanPYon9pniAukat6FCs12hdMYug7v6Lj+u8z55zd6bj1ZOqv3IOb9ibU5pKmZcGp02oajB0QsZaCwQWn5/nw7aV5/tnFuP562PW7FUYvNo9C2IVzGuN1Sb36cArkaZAgkYHvJFPhXg/pr7Ag74AzdVJlsM6WcApiFb9Ib9DOnL7Fef6N5Tj1LMsqq89ip+9M4ZIrpvHhp1Ctpi6OY5c60+Ns8HFzW/vVF19yxepd3R17z5g99cEDDzyw43xzfsr/8JWR+D+KwiqrrFJ+4YXf/+aII45Ye6vtN9pk6KgB96d4PTVXSFPXwqxZARf/aC4br/8G22zxBXfc4zN5xnLEdilSWyTJW1JFE2N9dNKDNQmemU0u7IBGH1aK5ycFPYuYOIcXhzI45OHL+LaDwE1l+WXLcg5Ffvf0CK3sTznHAAAQAElEQVQvx/Hia6ty8umwwrIhzXIqzV6Cr7PqMG2Qc32Y+izcjHfpfOgKui45hI5zd6Pv8n3ofehs2qc8ytDaBAaEC/DThRjqJLmEOFeW8iyU8nfhvIYyoRxRbSQ2WYowEl6NOp4yIxMP0MnNUJlWOw3lsVGumyQ/R7QmgMUJIipO7/wvvhLjS0aB8LUs8uARSsvkGGvYtIaTsS5sDljYHFINjb5jiKribR0T1XHiR2osDdtGJWimLr+Ct4BmM5lhC17Gf/oy6j/6DvN+tBNf3ft90okPYhpf4jfmka/2UpSsWrSpvcSSjv0ONDz+1FjeeGslHntsACceF7DYkMkUwxng5pEmPULRSBZFlZzws+IwYrfwSrMnaNuJhjbGCRu4IBG+KOCE9CU+VVOijzamz23nrptb2G6jPtZc+Su+u+OH3HpTN3NnWeoNI7mKrDht5PPm6xEjhpy10047bbz+euuv9f3jvn/mGWec+N+6n8C3XEbtVuV/w+2uu+66+u8e/f3bd95y14Fbb7PdOsssuezJQan9pXra3FOJmly1XOLjjx3Hnr6Ajbf/kG12msFV17bxxWer0VcZhYvzeNnGg4mRCHBJA+NkStYjk4rRvoTVkZeX7RfoqMmkNaxJ8K2kryNP1+ikOTedAe2fs8IKX3Lame088/KSPPvaSH5+/+KcpmizwQY+w5W4NGlMoOgf1vLkqo5cuUw8+yvqz/+CqVcczYwL9qZbTiN/7w8Z+MGjDJnxMcO7lFnUEi1fClhXwBRCXLFBLeiRQnuU6k2QBrodaaGBy0oogzIpQhOHJTG+opT/h6dHqjo1oHC3qPxvkOQfcTCyZpPHGCMsYznVGvm0Si6tyyFHqmuQ5jtUFsrYapKVIZQTD2RovhF/AsnNT/H1r7XSRcukV/F/dw3lW45m+hX7U370atzsDwjKC8k1iniNhDZljksNzrPnjnlu/slwnlFm8Mrzw7j5xuGstfYcWlo/ob11LqEcfCA9sXL4Jk2wyjYNVXAq0o2Mn2I7robwtKQKMPgBruRJXr4cVjPd5ZF8/cVy/PaRoZxyvGXrLWaw5qpfcfop8/jgfUtnd44obXGxa45S09Td3DTg+eHDhl2w2hqrbXfk9/ZZa8aMGZc+8sgjH7zwwgu188/7n88S+DeX07dV+V91b7fddvXHH3/4sy++fu+aa35y9c6bbbXpDu1DBt+aFrxPI89GkRek0+fBC6/1cuZ5M1hr7Xf7z4OvurKN518YxPyFy9KbaAOo2Ers+WR/N+G8OmifBxOjCtHrQ2BAZ88mMliVplIBqg2aAkvOVeRQpEzFT1h+qelsuvE0zj17AI//dnleeH5l7rpzDCcfW2SLLWoMHR3R0tKgaBv49RqBYARz52A+e53KM/co3T2L+RceR+f15+I/chsDPnmBEfM/o7VnCqVkrtDopKE5q0FAquWPMT0ylE5M2gs6viWjJRkEyNikqhhP78JfRoOxejcYg1qc3v833YvwdMLMZm5M6z8j9LLvWLSk5MX3ikoVIg+npWDsWnGRr2VDlUI8h0LH+zS9fCs9N/yAnkvPoPHAfSTvvovt6KDgNfqhtbSlrLBUhaP3G8ztNyzJKy+O4667l9CysY9Vl57PsGIHRvtDnrKSQrZk6WkQBgVsIn7GwtH6oGUORplZVmyKM4bUBJiwSY64ncQOorc6kMmT1+DJJ5bmoota2WOPmay3zsccdsRM7vxZF++/7+iqhNSMXIyJGmEp94lXaDy57PKjTtx6u802ePzJ3+w8a9acC95/+/3fX3P1T7uMydyPSPhffGfa9b8WvYMP3qXrqaceeHnu3Enf++Vvf7rR7gftuP3wYQMfsc52p2kYxS5HPQ15+Y2Us384g62/M4dll/uCE46tcc/tg/ny6+Vl/6viwpGkQY5ISuBCSDHQKEDQopIHKwXpq2BDi0liMh1SLFI0UlPVUko9vfcQJl8zfNAnbLPNdC76ccSjvx3JF++twtOPjuS0H7Sy3dY+Y0ZXkYeQUkVSsoQg6qLYO5nk02eY9/hVzLzhSGZctB99d19E29MPs8SXnzOwPpl8OIuC7ZRh1DWXp1KEpCh8clomFTDGQX+RQsvp0e8kjOp0u4yiRM3qw/+WKxUisUpCtpMfCd+GCanbZhKvXcF5INSG4sXDMWkbvnjclFQZHs+j9P5jRD+7kMp5+9B59xm49x/Fds8gX6+Ti+s0SUBLL+ZxzJGjePjB0bz9wRJce2OJ7b/TwYChX4lvX8sBNAg0u5Hj8W1BTkgfdYOVDiAYOHSFuLQAUTNOWVmsgNFQicMB0pflmds1jmeUeVx1jc+uu8xm5ZXfZPc9J3D5j2fw4ksBC2sFYpqkV1k+5GqRV1+w5Ljlbt79gD22vvvnN23R01feYcJnE25QsPtkgw026NWE/6du+38F21232LXjl7f9+tmLzrt431NOOWXl9dfb/LvLLrPcRc7GXQ3Fm4an4JP36U5z3P0rx9HHf82W23zOqqt/yeFHdXDbPQN4/7MxdNWXwZRWJA2HKlFwxPqXKq1EfsKR4BThpCm42OBknE4RBJPIo5QxaVUpaURJiu4puTC1OQTBe4xbcTpnXVDlF/eHvPDSYrz2ykpcfflw9tipicWXQs4pJk3rivURXtKH7ZtK/OZvmfnLi/n6isNZeOXRJD//sYzi95TKc8kHhkT+KlsR+a4up9RNkNSxcQ2yksYSm7TbyDnoTYhlv/+rikkaQquOCCcV5bEcQ2LzIEMlkdmKr8YOwCjUttXn0jrtebxnr2DOZfvTcfcFpC8+TqHcg82WFmFC3jbYePWEHx43kBd+syLPP70il/3IstZaC4mSr4jcVLywD0cNgow3DfBruFwPeL2kXkjsWShCXSdMUVAn1l6QU3aAjhij3GpMnr8sT70wjAsvrbDp1l+z5jofsNe+Ezjvglm8/LoB3yDRo0QziYgb0ov5iy0+6oaVVlphn9323m3dY48+dskLz/3VCff99L4Xdt55n7nGZN78f5VY/ipk7F/V+3+4c8bsgw8+uHbppZdOe+WVJx+9+eZrLrjyiiuW3GWXXTYeMmzoxW0tLQ+Tb3SnfhQrfrsFvSmTpqT84pdwwnEL+M6OU9h223kcfMgMbvppJ29+OpKp84dRcYtRc4Ml9BYSnYvGQUqmv86GIDXAJii0gY0XFSJxQo5ETiPbzc7+Ki6pRJSSmOHN3ayx5CSO37/ML++0PPmbscowVlW0GcHO27ayzOJQClMMwtB0k8QdxFM+0hLkfubfdiG9P/kB6c8voPDeQ7R3f0az10XievHibgpeTOi5/rlldcgS9K7bGcHT83/R7cnpelrPYywoKsvKQW7CRD2U0i7a6nMY3vcBAz9/kOj+s+m6/Wi6H76EVBu9YXUBNo1IZFur6nThxGOH8ejDK3DfQ0M5/ryUVTb4iua2jwlyM0iSXuwf6Rd/Ur8h6US40JFoaicPK6mR5hrKBlKyTNMUBxB5o/tl/9SrBS68eia77zWZHbeexd67zeWSC2u8+XqD+QtiesuG2JCmxkVhrvhVa9vAnw8dNvzcHXfacZ2LLz5/2aef+u3JH3743q/u/+X9H1x33XU9e+yxYkOE/kPcYt//XTo23XTT+KSTTlr48MMPvz535tyzX3rupb1uvebWFTffdtM9C6XS74zxP04odCeuKY3TkutYmOf9dxfy61/N48STOtlx+8/YaYe5HLBvlWsuh5deHMjMOcvQWx6Ns0p7/TrkPHTkRJr+GauMAZNgs39lD6/uKah4QKLMoyybreByfRD3MmrELDZe+2NOPLaXX/0y4KnHx/Dzu5fh9B+MYfllcgzUPqTt3xMpE/TNIPflq7in7qJy/Tn0/eQ0Ko/fTKnrY5ptlYLU3pPb64/KMjQ0kybVbVT+d91GPsxlLisLtdYKuYS8qTPUdTC48xPQ8WPnDccyO/uz5Rd/DfOmU0xTmk3CwAGWLbdv5o6frsXvH1iMy86ybLLJdHKD59Io9FI2cgDWYKKUgsK4rxMoq7VLNifZnEDqoNEw4A3ABMOoRoPo6hnJVxOX4LZbDPvtU2fbbWax806TOfe8Xh5/vIOJEwW3UdTIUhon+Zpz4eQgyL09duyyV5x06mlrPvbYYxvddNOCg2bPnn3xb3/72/fPOOOMzqWXXrqu6f4h70xq/zCErbjiio3DDz98xrO/ff7hclffDmeccfr4U087aL3d91z/O4OHBQ9Frt4XY+qpCevIlstVjy+/CHj8sSoXXNDJrjqLXn+1z9hh83kcdoAyjrs95swagw1Xw/pjFcEHKlK1kSatWnIM1CFIMw1FRZf3SLyENIiUusak+ZTIpcQ5HxNGGpuAIpzHAh2hzWGnTWdz0ek1PnhlEG88FXL7Vcuz+Vp5rIHIpDgrfYvmU5/4LrWHbqLz7EOYf9Ml9H7wMm1pL83UsYmyF6kxToT8oXhZBM3qMolmEVtEGrUZ1QsB1QoP/f7tdwYnK2Ccj01Vsjn659aPcaRyCk5LB7LLxRTSKoPqHfS+9jhTbz2frvuuoPzFB9DXLT/rcLGjZYDH+ReuyyvPrclvft7KXttOoHn4NGJfR8eiO9+IKDYsTY2c4OX650Z8tqaKp6dJpM5JXqS2K+EbTq64NNVKgccf7OCEI3222Wg2G6/1GaecuJDHftPLxK9KRI1mcAUSjYpdrd5wfXNWWnXxE086/siNbrjh2nV//vN71p088fPTr7r00g8VjObssYdR14yof/wibv5DEumMMekFF1zQuOSSKz+9997fPPrSS3fve/MtN4/a6Ts7rbP40kt/f9TIsRcGgf9laurVxDaixJqkLAWd0+t4/ZMav/jNfI45ucLKa09i3Cofs9seCznvomYeerKJWT3txMVWYjkFCnmyjVFckaQRYmNPm19W6b8hjCLFMZ84NdSVeSQWYmpyIr0QzMULZ7LEcmX22WcKDz3YyofvLs21V4xlp20HKqOItdfQR5CWlZl0Yd57mPqtP2D+j48ieOpnDO2cQlu9l1wKxpTANVGQ4dgslfcdaHkETbikRcYbqE9NdT2oo8rfcgu2shh80eAC0dtK0GjTRmEBT5Ff4RxtkJBojS+vSBD3MiKaRenFXzLv8hMp33MV4VfvEPRqn0E+umQSdtzS49c/H837by3BUUdMZMxiH2DtdDyvT7af9iNrbA5HK840kXqWhquTmJjEMyAHnZi86tupJUN5Z0KOC36cY6fvzGbFVWay35EN7r5/Dh9NjOhqOOoOF1NPnClXwzD+bOmlRl20yqorH3TggQeOe+qpp5Z+770Pr7/y2ivfVqCZu8ceeyTSJRHN/3OX/cej2PyHJC299Hb1I488svuRRx754PPPJ9w2adKk81577dW1rrv+2mVXGLfcvvlC/q5Sc/Ojfi43xfP9WopLqipdFccXX0f89okerrp6KkcfMYM1V5nKphtM4ZzT6/z61x6ffNpER2+JXLmiAQAAEABJREFUNGzWfluexBplGJY0F9Iopxgb4FsPE+fwrPokRTkQvSsltjEEpkwxN4cll5zGQYf3cNPtzfz+hfGceeZSrDaumYJFDiVElkIyaQIdv7mZuVd+j9LLNzGo6y0Z5UxiZS19+RZMkJOxduPHczHefAh7yTY3vSRPrlESb/5j/qjhP3kbgiSbo4TRvySo0sgvIArmydmVwQjZqCSHFNMcz2TYxBeYf8WpLLjvJqLJrxOEc4m9CgMGpGyz9Sh++/h47v7lKHbYeS6DB00SL+Zj5GSsnKmRU/WNnFssXjYaONtDI1qI8+sYz+LCPLFtYVbnIJ59YRQXX5Rnsw1msOv2nVx52Qx+93wv0zsTksApr1AyZ2y5UCq929zScu8SS4495txzz1ruo4/eW/vLL78898P3Pvz53XffPXHrrbcuG2NS/nkhSf6jccH9OUF/8V0K4MaPH999zDHHTP/444/v7+3tPVxlp7feemvFq666asXV11zjAKz3bGqssouww/nN5di2ph3Vouvoy/HuR5abbuzl2MO62GHTWYwfN4/D9uuSs2hnxvzlmVPOU5bxhMVRJOXhlLst1qbEtV4wFdDSQF4EZLAmasarZw7EkC9UaG2aqog3lRNPqfLCG0vz5HND2WTDiMFBN8NyjlK1RjLnM2Y+djmzbj6Clk9/y9DeKRi7kETn+WEcUFRUx/VB0AGKwEZnuDYu8fe4jByNHytTcDWMJ2PVKUHsxzRSh58ktMZlxs77EvvAXUy/8iyiL58lZJr2ZWo05S0bb5Dnt48syR335Nl4i/mqm0nOiqZaIvQy+dVBjoGkRFLuw/oGz3PEicEPDRUdTXX3LsF7L63PiUfmWGWVuey+59dced1MPvgiZn65oezAuiRtLqeNpulRtemDMWMWP+fKK69cua+vb73u7u59J06ceIsyy2nLLbdcrzEmm5R/Xv+aA/Zff/7za5VVVikfd9xxE999691fRtVo++233na1ddfdYI31N1p/u+Fj2o4qtdrf0BRPrdlGtYrvykk7XfVWFvYGPPhIwuGHz2S9NT5h03Vr7LGDx203J0ybPYDEG0MlKWBLHqmUHeOBa4J0AMqQMaHFVeu43hoYg4sWUgpm48fvs87qnTx9VztvPTaGAw5OMO1dEDagUcBNr7LglqtYeNVBtHz5CMPSLuKkjb5oOC5uV9ofK4qXSWxMzff4e1wNz6MeODxlPH4ifNOiwI7FsyMZVOvDvXEPs645nfLTv4K4A+OrOYLN1vF57pHleORXQ1lh+emEfC06Z2CTBmnV4AfN6i8HloYgfDMnapstSarxhSFUysvy/DPLcPRBhvXWmsh2O/yee+7roqO7jQYD6GvYVElGNWj2Pxk0quWCjTfdaNvxG2271pVX/nrdyZMnXnbiiSdmf6IsxgneP+9v5YD91h7/D3cwxiSPPvpo5bXXnpv60nNPvDRt4pRbn37izn0OPny38cuNW27bsUstdUzroLbbvIL3et3S0TBWau65+coSpk7P8/sXPU46bQbrbfg+223/tU5ICvzi5wOZOHVF+txi1HIRUamLtADOeRilyiYQwxVBPRUbp0rhHbZexy/NY8wKM7nw4hLP/m44Rxw0kGEtck+K0rZ3DvHkCXTdfDl9v7qD9loHgc7ykfmRFLFJgPU8XPJ3sgsvlYNLaQQhiQzZT0sUKgkD5szSceRP6bn/RtK572OS2RT8BqssZbn39iX4zc9GseryX1IIp2KbGngYTF+CNamKE36p9hQKpKaFRpzH5dpZ2L0kb72/FCd/37H1ll+wx16f88BjNabOs3QSUMGl1o86hcozw4aNOHONNcdtcsFlF24wf/r8H774+8dffvuF++ccd9x2dWP+mR1Is/6q+5/O4a9iF6y33h7VW6+8d8Hn73/+4qQvPrtp4YKJR7zw/FPbHnLE4eutPH7Vw9oGD74zLOTeJajPiW1vVJW+d1fh3Q8dP717AYcetYDVlVnsttc07vplG2983MaCSpu2KXM0bJHEFWUcHqkUP5aBYDycZ6iFqCRKzXsYv3g3N13QrB39Eey6TUyxkJLTBmS+o5u+Nx9lzjUH0TTtEVrMbLygQJI04SopIe6vpPY/7m6zFXxDxuyaSPPN5GtzGTXjBbp1NFl79QFM70Jiv0rbMMf3Divx4pPLs8sOCwgL04RBIqeA9kUgVUphRFtSM6SBTyNISERLX9TMrNnL89Nb2vjObpPYePMvuOXu+UyYZOlzxskRJzoRmhUU7StjVxhx3t57bb/pxx++u9OsGTMufef1CW+dfuTp3eb/rDMw/zHT/wdq7X/jnP+wU43X3sVtN9zw5Qdvv/fT+bNnH/bEE0+sc+21143f5Ts7bjRupVUvxgunRM7WG+RSzxtIIyny6os5jj9qLptuOIPxa87g8mstn01alq7qMvhNy8lYmkjSBrGzpF4RYyw220dIcng6jbD+FFZfbRb3/npxfnHvWJYclZCji6a+r7EzX6XjpmNpPH2LIvpsAusUwXPKJv4+iuc1UsErQhJRpA//s6f56sYj8af8jtbaJHy/wiorOX5931iuvHIIpeIEqqaXcjEvB9eMiQOCPkQPRJEhLZUoRyVlCovxzidFjjt1Bmus8wEnnDyR199Gm45GSzKoNOK4WCy9s856ax52xVVXrPuz23+2yeQJUy/6+c9/9eHiiy9e4x/icn8nKszfDOefzuFvZuG/B6Dz8Pioo46a+dBDj75x3bVXn3/8ccetuOWW2660zPKL7ztsZOE6WcfMSpTWbdDSsK6deXOaufCHnWyyyTvstOOXOqWYxdvvlZRJDMOFOaytkY8duf6lQg/OVkkzyQU+cW0GW63fy1PPjuWos9rJt0MxNvidjtqjj1D/1eUM6PlAUbqTai7498j+/6iJg4C43smoaCre726j62c3QZes3fPxc3DSkQN44oEl2HBcp/ZQ5gtfhxc6OYMyXlrXt9EJAmR/xJRrHkXHzNE8dP9gtt18JtttPYP77o3oq3nUvbxylCgOC+HnSy+93Ck77rrnhvufcNJm27y0/T0nHHnCtD10zMg/r7/Agb/dyWQq9heA/7P678GBzFFcccUV5WeeeeyrLz+bcN+UKXefdP4Pz1tl3fVW3MIP6z8Ji9WnEq/Slchs+npzvP1Wnauu6GSPXWdw4H693H1Pka+njCWhnX5xKwswqQxNKTl1h2digqCDwQMn84Mzc9x45+Iss6xHk3b7S3191J97mIX3XkaxZyJBo49sd9AqG7Fqx2Ti97Cpp9nB0lB7DBiszNI6A1reoBbfxfqNNSTEKnMY7pUpP3s3fY/cgu2ciY1h4PAcF/14CR0pDmZIbp761jVdjG8CgqqlWE0J0xqxb6kWR/LVnFFcf10fu+82heOO+prXX23Q15NH7iCOyc3MN7XeudY6G+18yQ8vWf+rzz+/4tGHfvXGjRdc0Pe/4T+EIsb8w9/2H57C/2UEGrNpfOaZZ3a8+uq7r5TL5VNefPGlHU8/7rSVRw4feSZe8kFsXI/WHm5ul+XJ5/s44pj5bLH1NM4+w2Py1NHUGUrVhFQih8sVdDLhgfGwaUJzdTa7bNHBrx5cjK22igi8bnwtTRofvE/1pzcweuE0POuwiY9VdmFk7nieHINPTsZtbBn8BsZafJdgnQPtVCjt0HeD0KlNDmNEVMd/7D66nnoYok7yrpPVRvdw3/VLcfi+Flf7AprlBEyDRBkA8SCMKZAW8lTjPD1dS3Hdj2K22GomJ5zZx9uf1unTVKlvo9REk0YMH3bV5Zf/cN3u7rmHvfnqS09kfyIvRP55/zdx4I/T2D++/Hc8zX/HJP/H5hg/fnz0o6t+NH36zMmX7bLLLmtvtdWW6w0eMuTsOEnnp6lfNtYwa3bMtTd1sOFG09j/gAqvvzuYXOtiYCoEuaoM0OG5VsJ0MVwlz8hRMT+5ZWkOOriFghdDUqX8xWtMufc8Bs97h5zXR5wPcX6KTbvlDMrUdVKSuDateHK4NNbmoCMOKmA71J4S+UNwLs8gN5vyOz9h8gt3a36HJWHsGJ97frkKa6y/QHNlm6Dg+oxwCnV0W6Pq5tIIffqqI7ji+mbW2egzLrx0LnPnJVjPkThTD8Lwg3XXXec7e+2112pXXXPFmSeffPJ0/s9e5v8s5n+OuP3zj//qd/dfPcH/YfjGGHf//fc3nnrqqQmzZs368emnn77soEGDDizk83fJBDtqZlB9TvcAfvt4g/33msXB+8/jg/dbIR2G9UOSNIWkVwZZ0sZjnZb2yZx1QYlDD2qlkC0Xkk6iic+z8L6rtB/xNTZINTbBd3W0rCEJnL5blVEUZPARWq+oRHrvU9RPSWOfFs+n/uJ9dD5xl7KD6ZjyPMaNLnD/r5ZnuZWmEJgubD4mrjk84YRGp1GI8Qfyq1+GbLvVbH70ox4mzgip502SGNsdhuHvllhiib0vv/zyjV966aUnfvGLX/Tsscceyf+MKM3faVr3d4LzPwvmv9U5/M+S+n9ndmNM+uMf/7hz9uzZD/b1lQ/bbNNN1wpz6Q0UGp/GYRzNWZidBDTYfacezjgpYdrMMeggH5fvxYVzSF0nvinTVOzgwouWY//dminJQdhKSvTe+/Q+dS+lrkkEsSEyLXIMUgO/CloyOBdoFSHlTmQoSV6wSii8kw/qVN9/jp7H7sNb0EFYT1h5cZ/bb1yJZRafD3E31iQkPSl+3qPh1eiNmvj486U4YPcuTj5+Ae99GBORS5zNdeXCQb9dcullv/vmm2/u/OWXXz583HHH9fzPS0h0/xVImL+i7//FrtKK/4to/7+Dc+Yonn322Un16oKTr7jopA2LQeES38/PjEwumd8bcN1P57PaBl9w250DqdeXlHOIaVhFfFtUBmEp5iZw3bUj2GOHvE48DC7Okb74IOETd9LeV1NUHwK2CYze4x6MlhRWpxGeNg/9agvEQ7UBGVOc+ybl+3+M1zkHuRMWa4Pbb1pDR5aT8c38fseAshCbayJOh1NlPNfe5ths84/47bPQ3ShBjopzPRO323bjbV5++sk9v/z0099n/0ta/o9ef50r+f9H5P/kqH86h/9J7v+Vc5900vkLt9162x8OHNi+3qDBzRc3PDOrroVBj7YGTjlrEtts8zUvvTxc0XlxylGKUfQmKePZiVx82RJsuomHYS4t9U66n/kV4aRPsJU69GcJCb5fI9VyQwcTsmOfnMsRqrTXe+m981xMxyeESTdNJcNPfzaKlVfWUiJUtkIipxRQNY6K7zF9zji23upjLr5kAUnQTOL5aRokU8YsscSxR31vtzUef+Q3b2V7LX8l+f/s/t/MAfvfPN8/p/sbOaB9iUTLjWnz5s05d4UVl/1usa3pl1i/kiS+e+f9hN12mcFFP0zoKo9VBuHhrCFbFgweOIdrb16alceBFgtaoXQz82eX0jT7fZqSBqahDUr1dZ5DHoI4Z2mkC2iPZlF74VQjYAoAAAiaSURBVLdEkz+nXW6nuQgnnN7KuhtWBXYeLqrhsr+3aEBkBnL/byxrbfgU771TpVHNEceF+cMWW+z6jTbbfIfPJ3z+0xtvvL/PGDTJ38iIfw7/L+fAP53DfzmL/+sm+Oi999648keXHrzSCsvvWwhz7ze8IC43mrj6yunsu8dEJnyoJUE4hLTWkDX2stiQWdx9+xgKAww1pQeu5xOqL9xCS8dM/KSJ2C9ik1hLDzmGvMNr7yad9gx9v/s5YaWGF8PWOw7h2BOWI4m7kFcA36dR9+jtW4KrLnMce+Q8KnWjZYZJi346bdzSY8+56rIfnvT8U49OMMb80ynwf+ey/3dQ/Sem/xEHjjzyyOjjDz5+5IQTDttuyPChl9fjct3zCrz5eoO9d5vBM08YkmAYxvj42lNYZbmY758xkjhw+LaT6I3HqH+l5YUXCHyAn1qsjTFRlZZGHz1P/BS/bwoltQ4c4XHeBWOIy18T+j6p9hhSW6SajObY46Zx5WVdNLQJWekL0/bWtleOOeLAHXbYZbvb9vgfO30Q0n/H+/81UP90Dv8gEr/44mvnnnv22eetvvqau6fUpyuiJ1PmOvY9Yg6PPNJOvTGSNNSCom8uB+/tsflWRe0ngFfppfOlpyCeh633YnUqkeYqtFQ86k+8Rv3zz/r3GeJilQuuWYoRgyeT83qpVQ3OLzFpdjvf3W8GDz1ZpeqaSTH1JZYactOR3z9s70uvv/Xj888/P/0HYfH/c2T80zn8A4k8yyLefff1xw484ID1ree/6oyfxlWP4477hF/8whFFixO1JLSGjjMPX0L7AarzEy0d3iB8+3c00U3Dm4OXRrTPs/Q98wBBupBE/dfaKs8mGydk2QdO9p5vZuKXwzn+yIW88fuINGrT0sV1jRg16KKJX730gwsuuGzWPxBr/58k5Z/O4f9j59pjmrrC+O/ce1taoTwKVuIji0Z8jMzpJn/MB5HqtoREjVvEbFOjm8o2owhzPhmgQOOiQhiK05l1QR1zOB0hZEYNC2KmUzf3cmKmlkkQeYhQSh+397EDickM1pBqpbT3pr1tzz3nO9/3+05/Od/3tTfA3N4T15vN5obNJtMC7RD9caeodrkFgqzMmyg5aEOrIxQMJYTEl7uxaAGtR7IE4O9C+PEQhoo0x8CFQSep0flTFaT2qzT0EBBhICgoHgUdd7d3LIEKd5pCsXZNI87WuCDIsZQYtK1Tp8avbvjXkkeIb/8hSTUOMK/5pzkKOfT6JfCWW05GRvuKFR+m6qJGftEtaOwddga5efX4+jChOYIwsKr72Jw2ETqaauAEAXxDHawXL0DXGYOw2x2wXjJDja7eTcK8+XqMixAQ4iYgcihuNo3AwpRGnL/UDXBaiIy1bdr0uGXr16cf7YXTxyfZx/J9I574RqwPpTI+lD2IRPvvcnuSJVVYmNP+SWHW1vCYiK94mlHoyRMU53fh80M2uBCJMeO78Nr0MGgkuhcQWNw7WYWRDRagpgJSRx0kVkZUNJD+gZYSA01S0jxDfesIvL+uCb/94QblCkoMjvppM59/t6bGeFJJPOIxh/+uMU9KK+TgCRk/aX/SJbV28WJrxYljm6L0EUckiRNsXQy2ZDeirJJFiMqGrE0GRIYBMqHVh5ZruLFvFe7+agYhNtD8JRa9FYMxsXSZyF1wuQ3IzG5BdbWdVjTUECXm/ksJL2w4V3OhkhAl8YgAO6jX/cgiRRWfIDBjxowuk8mUETU0siIkNFKWHDqkf2zBXxYd4icRrFyho3mDDoQOaYTadgUqh4WGHQJ0Q2SsT4umSUgRdl5G7mctKC9vB6EBhyi5+YSEyRnnz/1y7GkrTZ62wECR94yBYQIFN8WOxyNAKxmd896es9oqWS+ygpbvsmmxcNk13OsmWP0RJYuNYWBonBDF9vyCkmDyFBWqz0yAgaPVCmJHbd0o7D3koDkHBmrCO+PixudMWj71CJ31STc3VMTDj6cu8GHxg/fTMwZGIQcvlgrxYow/DDlYVNacnps+H1z3P5QJcL1OQmZmEziNBjlbRqD21Gjs2TMUlcenoLrSiOdG3QIJEXC7JRrvLbkKa0cIZFYt6YfFVuzfv6/wQOoBtz/YpejgGwQUcvAC12dM4F5o6HmIaZ2pOT5huEmC28aK4Sj7xobTp0SwUjPi425h/txWTH/lGtSun6EN08LJRSBv2x1IVrqlEEVZG85c2VGYvSEpKcnpeRblSiAg4JkcAsE6xYZHIrAxLf9otD66RKXmeZdbQtGuFjg6YkE0XM/OABAkMGpazux04cR3PKqq7HAKWhAiO4wzX81bmpJ6+5GClcaAQkAhh4ByZ/+MSUlJEee+nrKH5x2tIJCv/m5D6ZcdEAU9QBOPtHYBQhiw3ETs/LQNVheLTpdLjBs3tigtLe1k/2ZReg12BBRyGOwe9FJ/s7mkYc7sWakswzokUQVzaTucztEQVSpIrJvuIAzYnl2PGxYZslorq7RoTE5O3KeEE14CPqDDvMuSKeQwoE4b2MnDw2NOi2CuuxAiNjUJKCiyQGSj6VODxjsGlB220nBCA6ic9jeWzkorKChpGFiNldn7ItCfFrk/nfr0Yfq0KA1Bg0B5ebnbaEzeAFa223gGxXtb8Xd9JOxSPHbuakXbfYAlsqRWceeXZKz7IWiAUQztRUAhh14YgvYk796df1YTqv5eAsfbHTIyMizYuq0Rh8uaIUsEkLsdE0aP3Zkcl+wKWpSC1HCFHILU8Q/M7rnBa2LinO1u2dXsFji5tsaJkmJaveBpOMFI4rBh+tLLl/8886C/8ho8CCjkEDy+9mhpRcW3NxMTZy8RIVhlkThZwkk8rXLGDo8tXfnOm1mEEMnjYOXC/xAIrLcKOQSWP72yhn755erqU7VGo/FFvT5iuSEmepXBoE/Kzd+xJmf3gbY+Qmm00adNaQg4BP4DAAD//w7BzV4AAAAGSURBVAMAAMhvzS5uZfMAAAAASUVORK5CYII=","akreditasi":"A (Unggul)","logo_kanan":"data:image/png;base64,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","nip_kepsek":"19750812 199903 1 002","kementerian":"YAYASAN AL-ISHLAH KUALA GADING","nama_kepsek":"Drs. H. Mulyadi, M.Pd.","nama_sekolah":"SMP IT TEBUIRENG 4 AL-ISHLAH"}'::jsonb, '2026-10-16T09:34:05.379+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.tahun_ajar (2 baris)
-- =====================================================
INSERT INTO public.tahun_ajar ("id", "nama", "semester", "is_aktif", "tanggal_mulai", "tanggal_selesai", "created_at")
VALUES
  ('TA-2026-S1', '2026/2027', 1, TRUE, '2026-07-14', '2026-12-31', '2026-08-05T10:01:04.614518+00:00'),
  ('TA-2026-2027-S2', '2026/2027', 2, FALSE, '2027-01-01', '2027-06-30', '2026-08-23T16:15:11.968916+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.mapel (1 baris)
-- =====================================================
INSERT INTO public.mapel ("id", "mapel", "created_at")
VALUES
  ('8jv4ubj8f', 'Informatika', '2026-05-26T08:17:11.094584+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.kelas (11 baris)
-- =====================================================
INSERT INTO public.kelas ("id", "nama_kelas", "wali_kelas", "id_wali_kelas", "created_at")
VALUES
  ('t33cwfj8g', 'XI 2', 'Kaharudin, M.Pd', NULL, '2026-05-26T08:17:09.262458+00:00'),
  ('67ldad7m2', 'XI 3', 'Siti Fatimah, S.Pd', NULL, '2026-05-26T08:17:09.415762+00:00'),
  ('krm2e9qkw', 'XI 4', 'Mardika Pratitya, S.E', NULL, '2026-05-26T08:17:09.582146+00:00'),
  ('vdmomuvks', 'XI 5', 'Sri Astutik, S.Pd', NULL, '2026-05-26T08:17:09.737114+00:00'),
  ('lpopfqy7u', 'XII 1', 'Wiwik Nurhidayah, S.Pd', NULL, '2026-05-26T08:17:09.894995+00:00'),
  ('a50782tox', 'XII 2', 'Alif Muhtarom, S.Pd.I', NULL, '2026-05-26T08:17:10.054213+00:00'),
  ('visvm10b2', 'XII 3', 'Nurhasanah, S.Pd', NULL, '2026-05-26T08:17:10.228303+00:00'),
  ('6l6e709zx', 'XII 4', 'Siti Anisa, S.Si', NULL, '2026-05-26T08:17:10.389106+00:00'),
  ('mx8jcwlnw', 'XII 5', 'Zumrotun Naimah, S.Pd', NULL, '2026-05-26T08:17:10.5521+00:00'),
  ('cf3zffkxd', 'Test', NULL, NULL, '2026-07-22T18:48:35.423477+00:00'),
  ('rbs4avbto', 'XI 1', NULL, 'UID-1779817062842YOUA', '2026-07-11T05:38:21.821869+00:00')
ON CONFLICT DO NOTHING;

-- Tabel public.wali_kelas: (0 baris / Kosong)
-- =====================================================
-- DATA: public.siswa (312 baris)
-- =====================================================
INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('317', '0095755134', 'Sri Ikke Rahmawati Sholeha', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:05.218565+00:00'),
  ('318', '0089870672', 'Suci Rahmadani', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:05.385309+00:00'),
  ('320', '0082102027', 'Uyun Khomariyah', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:05.693492+00:00'),
  ('321', '0094191689', 'Vanecia Zahratun Niswa', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:05.858441+00:00'),
  ('322', '0098777450', 'Wirda Tusifa', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.028082+00:00'),
  ('323', '0081264640', 'Yelsa Afrianti', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.182257+00:00'),
  ('324', '0086488014', 'Yelsa Yunia Putri', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.327111+00:00'),
  ('328', '0096930599', 'Anisa Liswianti', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.976442+00:00'),
  ('331', '0094489553', 'Aurel', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:07.451844+00:00'),
  ('333', '0088507379', 'Bella Ayu Lestari', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:07.79475+00:00'),
  ('337', '0094086759', 'Eva Azkiya Nur Rohim', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.43575+00:00'),
  ('341', '0089768130', 'Irna Puji Astuti', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.10233+00:00'),
  ('342', '0092454894', 'Jenita Nur Sabila', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.255251+00:00'),
  ('346', '0099466922', 'Lutfiana Nursabita', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.898535+00:00'),
  ('357', '0085524296', 'Nurul Choirul Ningsih', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:11.773913+00:00'),
  ('360', '0088690415', 'Rahma Aulia', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.255365+00:00'),
  ('361', '0085441455', 'Rara Zaskia Junianti', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.423619+00:00'),
  ('362', '0081834751', 'Reni Wahyu Ulandari', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.573729+00:00'),
  ('XII-1784137806982-tlx1p', 'NIS-1784137806982', 'Muhammad Alfarizi', 'XII 1', 'Laki-laki', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-oubco', 'NIS-1784137806982', 'Azhar Faris Arasyid', 'XII 2', 'Laki-laki', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-wz863', 'NIS-1784137806982', 'Nur Fadilatun Afrillia', 'XII 4', 'Perempuan', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-4zsm3', 'NIS-1784137806982', 'Dety Novita Liana', 'XII 5', 'Perempuan', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-zjpj8', 'NIS-1784137806982', 'Intan Nur Febrianti', 'XII 5', 'Perempuan', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-popjk', 'NIS-1784137806982', 'Melany', 'XII 5', 'Perempuan', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('XII-1784137806982-nzllq', 'NIS-1784137806982', 'Parida Anum', 'XII 5', 'Perempuan', 'Aktif', '2026-07-15T17:50:07.455576+00:00'),
  ('SIS-179145938994792', '3', 'test3', 'Test', 'Laki-laki', 'Aktif', '2026-10-08T11:36:33.600232+00:00'),
  ('XI3-13', 'XI3-13', 'Diah Asyifa Deviana', 'XI 3', 'Perempuan', 'Boyong', '2026-07-13T09:55:12.02631+00:00'),
  ('XI1-1', 'XI1-1', 'Abdul Hamid Syaiful Barnawi', 'XI 1', 'Laki-laki', 'Boyong', '2026-07-13T09:55:11.548957+00:00'),
  ('334', '0094479329', 'Deby Etika Maharani', 'XII 3', 'Perempuan', 'Boyong', '2026-05-26T08:18:07.94992+00:00'),
  ('SIS-179145936408236', '1', 'test1', 'Test', 'Laki-laki', 'Aktif', '2026-10-08T11:36:07.752169+00:00'),
  ('XI1-2', 'XI1-2', 'Adil Rashad Zaki', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-3', 'XI1-3', 'Ardiul Hafidz', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-4', 'XI1-4', 'Aris Tama Putra', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-5', 'XI1-5', 'Chessli Alkhazahri', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-6', 'XI1-6', 'Daffa Dzakwan Irsyad', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-7', 'XI1-7', 'Danil', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-8', 'XI1-8', 'Dhigo Pratama', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-9', 'XI1-9', 'Fahry Al Gizrie', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-10', 'XI1-10', 'Firly Rizky Adha', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-11', 'XI1-11', 'Ilham Juwanda', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-12', 'XI1-12', 'Irsyadur Rifqi', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-13', 'XI1-13', 'Jos Raharjo', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-14', 'XI1-14', 'Ma''ruf Nurdiansyah', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-15', 'XI1-15', 'M. Irfan Alghifary', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-16', 'XI1-16', 'M.riski Alfariz', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-17', 'XI1-17', 'Magenta Aidil Rahman', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-18', 'XI1-18', 'Muhammad Alfi Zadah', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-19', 'XI1-19', 'Muhammad Fachry Yusuf', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-23', 'XI2-23', 'Muhammad Revand Alfajri', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-24', 'XI2-24', 'Mumtaz Al Baqi', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('XI2-25', 'XI2-25', 'Raditya Faturahman', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-26', 'XI2-26', 'Royhan Yusuf At Thibbi', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI2-27', 'XI2-27', 'Safwan Zaizuly', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI2-28', 'XI2-28', 'Tegar Ananka Pratama', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI2-29', 'XI2-29', 'Wisnu Lutfiansyah', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI2-30', 'XI2-30', 'Yoga May Prasetyo', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-1', 'XI3-1', 'Aina Bismika Fatma', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-2', 'XI3-2', 'Alfya Chelshelia', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-3', 'XI3-3', 'Anastasya Aulia', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-4', 'XI3-4', 'Anissa Koirotus Zahra', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-5', 'XI3-5', 'Anisyatul Nabila', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-6', 'XI3-6', 'Assyifa Rahmatul Husna', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-8', 'XI3-8', 'Avelya Dian Ningtias', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-9', 'XI3-9', 'Ayu Kanza Salamah', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-10', 'XI3-10', 'Dara Anggia Wafiroh', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-11', 'XI3-11', 'Dea Ananta Siregar', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-12', 'XI3-12', 'Dea Rahma Said', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-14', 'XI3-14', 'Dika Arum Utami', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-15', 'XI3-15', 'Dina Amelia Putri', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-16', 'XI3-16', 'Dira Anggia Wafiroh', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-17', 'XI3-17', 'Dwi Alsapitri', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-18', 'XI3-18', 'Elsa Laily Saputri', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-19', 'XI3-19', 'Elvina Ramadani', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('311', '0096160767', 'Risma Adelia Putri', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:03.939786+00:00'),
  ('312', '0081900531', 'Rista Novelya', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:04.391394+00:00'),
  ('313', '0099039655', 'Risty Nadiyanti', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:04.568529+00:00'),
  ('314', '0093380792', 'Salma Nurul Fathonah', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:04.731592+00:00'),
  ('315', '0094799557', 'Sapwa Syahrani', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:04.896094+00:00'),
  ('316', '3086116800', 'Sheril Rahmawati', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:05.062128+00:00'),
  ('325', '0092318262', 'Alisah Nursakinah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.490812+00:00'),
  ('242', '0092093093', 'Mutia Az Zahra Mauliana R', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:52.458549+00:00'),
  ('SIS-178474614301545', '123', 'Test 1', 'Test', 'Laki-laki', 'Aktif', '2026-07-22T18:49:03.617981+00:00'),
  ('237', '0096584522', 'Intan Nur Febrianti', 'XII 4', 'Perempuan', 'Salah Kelas', '2026-05-26T08:17:51.653627+00:00'),
  ('240', '0086083658', 'Melany', 'XII 3', 'Perempuan', 'Boyong', '2026-05-26T08:17:52.150905+00:00'),
  ('SIS-179145937756077', '2', 'test2', 'Test', 'Laki-laki', 'Aktif', '2026-10-08T11:36:21.234323+00:00'),
  ('326', '0088765815', 'Amelia Dwi Kusumawati', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.649642+00:00'),
  ('327', '0092761194', 'Amelya Indriani', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:06.818432+00:00'),
  ('329', '0095944699', 'Anisa Nurjanah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:07.137264+00:00'),
  ('XI3-7', 'XI3-7', 'Aufa Azalia', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('330', '0087436146', 'Annifa''u Sholikhah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:07.28749+00:00'),
  ('335', '3094037991', 'Dinda Alfiah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.114711+00:00'),
  ('336', '0095052822', 'Elvia Hasanah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.272443+00:00'),
  ('338', '3083334435', 'Gilsa Rahmadani', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.587878+00:00'),
  ('339', '0099690783', 'Hamidatul Husna', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.754849+00:00'),
  ('340', '0085646034', 'Hana Amalia', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:08.910858+00:00'),
  ('343', '0093828727', 'Jihan Pahira', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.420071+00:00'),
  ('344', '0094935054', 'Karisma Cantika', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.582986+00:00'),
  ('345', '0084615479', 'Luna Losari', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:09.744474+00:00'),
  ('347', '0088138106', 'Madina Suci Rahayu Al,Munawarah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.0555+00:00'),
  ('348', '0097583520', 'Mazidatul Magfiroh', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.212995+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('349', '0089397154', 'Milla Nafisah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.368661+00:00'),
  ('350', '0088973747', 'Muhtia Dewi Br Sinaga', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.517325+00:00'),
  ('226', '0095671936', 'Anisa Avrilian Shenia', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:49.822028+00:00'),
  ('227', '0084505139', 'Chika Kasih Ardana', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:49.972782+00:00'),
  ('228', '0095329746', 'Dea Putri Rahmawati', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:50.172827+00:00'),
  ('351', '0087099844', 'Nadia Dwi Rahayu', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.670665+00:00'),
  ('230', '0092602172', 'Efriza Wati', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:50.501014+00:00'),
  ('352', '0097300200', 'Nadin Syabhani', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:10.827811+00:00'),
  ('354', '0097432839', 'Nisatul Karomah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:11.268725+00:00'),
  ('355', '0085108281', 'Novi Risma Olivia', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:11.451147+00:00'),
  ('231', '0097455353', 'Erika Zola Nuraini', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:50.653253+00:00'),
  ('233', '0087684068', 'Firni Tara Santika', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:50.975413+00:00'),
  ('234', '0098459095', 'Heni Miftahul Jannah', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:51.168518+00:00'),
  ('235', '0094509290', 'Ina Yatus Syifa', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:51.326952+00:00'),
  ('358', '0091128979', 'Piranti Kinasih', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:11.937363+00:00'),
  ('359', '3093826553', 'Quilla Gadizavirgin', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.095491+00:00'),
  ('236', '0081106467', 'Intan Nailatul Izzah Ufairoh', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:51.486515+00:00'),
  ('238', '0087480669', 'Lailatul Munawaroh', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:51.822966+00:00'),
  ('239', '0097025912', 'Lusiana Maysaroh', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:51.982326+00:00'),
  ('241', '3084933598', 'Miftahus Salamah', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:52.299643+00:00'),
  ('243', '0098553908', 'Novira Sulistia', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:52.612868+00:00'),
  ('244', '0098101175', 'Nuria Aulia Gadis', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:52.775751+00:00'),
  ('245', '3076020719', 'Putri Natalia', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:52.941874+00:00'),
  ('246', '3097507371', 'Ressa Clarawati', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.105499+00:00'),
  ('247', '0086349595', 'Saufa Ajry', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.286131+00:00'),
  ('248', '0087184864', 'Seftia Ramadhani', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.446975+00:00'),
  ('250', '3081199867', 'Syafika Khoerunnisa', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.776787+00:00'),
  ('364', '0095885144', 'Rissa Iffatun Nafsi', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.902461+00:00'),
  ('365', '0097426983', 'Ulfatul Khasanah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:13.05683+00:00'),
  ('366', '0098034994', 'Wilda', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:13.210128+00:00'),
  ('251', '0098208128', 'Syifa Salsabila Mahfud', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.933995+00:00'),
  ('252', '0091993164', 'Tri Nuraini', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:54.08654+00:00'),
  ('254', '0087101911', 'Zaneta Maya Suryani', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:54.413469+00:00'),
  ('255', '0086210132', 'Zian Sephia Cinta Ramadani', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:54.569531+00:00'),
  ('XI3-20', 'XI3-20', 'Fauziah Zulfa Riski', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-21', 'XI3-21', 'Fina Ayu Lestari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-22', 'XI3-22', 'Fita Sari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-23', 'XI3-23', 'Fitri Rahma Sari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-24', 'XI3-24', 'Hafidzah Aulia Azhari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-25', 'XI3-25', 'Hafizah Husnatullaila', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-26', 'XI3-26', 'Imelda Olivia', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-27', 'XI3-27', 'Ira Boru Rahman', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-28', 'XI3-28', 'Istiqomah Kaffah', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-29', 'XI3-29', 'Liliana Sulistiyaningsih', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-30', 'XI3-30', 'Mala Vita Sari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-31', 'XI3-31', 'Miftahatun Mafanza Mutiara', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-32', 'XI3-32', 'Moza Putri Anjani', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-33', 'XI3-33', 'Muhajarotul Khusnia', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-34', 'XI3-34', 'Mustivatul Maulidah', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-35', 'XI3-35', 'Mutiara', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('XI3-36', 'XI3-36', 'Nabila Azizah', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI3-37', 'XI3-37', 'Nayzila Dwi Lestari', 'XI 3', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI4-1', 'XI4-1', 'Nazila Rahmatika Habib', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI4-2', 'XI4-2', 'Nazwa May Nur Winarni', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI4-3', 'XI4-3', 'Neva Setia Ningsih', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.02631+00:00'),
  ('XI4-34', 'XI4-34', 'Zaskia Aulia Putri', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-35', 'XI4-35', 'Zilia Layli Nafisa', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-1', 'XI5-1', 'Almeira Rahma Utami', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-2', 'XI5-2', 'Atikah Miftakhul Jannah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-3', 'XI5-3', 'Ayu Bunga Lestari', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-4', 'XI5-4', 'Ayu Salimah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-5', 'XI5-5', 'Cantika Berlianda Putri', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-6', 'XI5-6', 'Cintya Maulidya', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-7', 'XI5-7', 'Citra Agustia', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-8', 'XI5-8', 'Dwi Apriyanti', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-9', 'XI5-9', 'Elisa Riski', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-10', 'XI5-10', 'Fara Nuriana', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-11', 'XI5-11', 'Fatkhiyatuz Zahroh', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-12', 'XI5-12', 'Hani Umi Latipah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-13', 'XI5-13', 'Kulsum Khotimah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-14', 'XI5-14', 'Kamila Insani Kaisan', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-15', 'XI5-15', 'Kanza Nurmadinatul Arsya', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-16', 'XI5-16', 'Khumaira Nur Fadyah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-18', 'XI5-18', 'Meifa Zumratul Latifah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI5-17', 'XI5-17', 'Kia Febiansyah Nita', 'XI 5', 'Perempuan', 'Boyong', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-33', 'XI4-33', 'Zarwa Sugiarti', 'XI 4', 'Perempuan', 'Boyong', '2026-07-13T09:55:12.201432+00:00'),
  ('284', '0092316942', 'Ahmad Izudin Ubaidillah', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:43.008883+00:00'),
  ('285', '3091167866', 'Alvin Pratama Imanudin', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:43.899972+00:00'),
  ('287', '3097047523', 'Dika Pratama', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:44.576895+00:00'),
  ('288', '0098071012', 'Dimas Pasya Saputra', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:44.931016+00:00'),
  ('289', '0091904865', 'Fadhil Azmy Pratama', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:45.092721+00:00'),
  ('256', '0086807857', 'Agus Susanto', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:36.07298+00:00'),
  ('249', '0056706985', 'Syafaatul Uzma Abdillah', 'XII 5', 'Perempuan', 'Aktif', '2026-05-26T08:17:53.612444+00:00'),
  ('XI4-4', 'XI4-4', 'Novi Nuraini', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-5', 'XI4-5', 'Nur Hidayah', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-6', 'XI4-6', 'Nur Indah Safitri', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-7', 'XI4-7', 'Nur Khani Fatussaadah', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-8', 'XI4-8', 'Pika Mutiara', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-9', 'XI4-9', 'Qoonitah Simanjuntak', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-10', 'XI4-10', 'Siva Afril Lanni', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-11', 'XI4-11', 'Ulfiatul Khoiroh', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-12', 'XI4-12', 'Rahma Roma Dona', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-13', 'XI4-13', 'Rahmatika Khoirun Nisa', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-14', 'XI4-14', 'Refa Putriyanti', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-15', 'XI4-15', 'Resti Muthia Rahmawati', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-16', 'XI4-16', 'Revany Rihadatul Aisyi', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-17', 'XI4-17', 'Rima Septiani', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-18', 'XI4-18', 'Riva Anzila Rahma', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-19', 'XI4-19', 'Rizka Salsabila Irawan', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-20', 'XI4-20', 'Rizkia Indana Zulfa', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('XI4-21', 'XI4-21', 'Safa Novia Sari', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-22', 'XI4-22', 'Saniya Roudlotullatiifah', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-23', 'XI4-23', 'Shinta Aulia Shanwirya', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-24', 'XI4-24', 'Silvi Zulia Asrofi', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-25', 'XI4-25', 'Siva Meryana', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-26', 'XI4-26', 'Sopi Ariani', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-27', 'XI4-27', 'Syla Hafidzah Ramadhani', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-28', 'XI4-28', 'Thasya Nurdianingsih', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-29', 'XI4-29', 'Tria Sari Retno Wati', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-30', 'XI4-30', 'Winnie Alenskia Sirait', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-31', 'XI4-31', 'Yasmin Safinatun Najwa', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('XI4-32', 'XI4-32', 'Zahra Alya Fathiya', 'XI 4', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.201432+00:00'),
  ('278', '0096510353', 'Revan Rizki Agustian', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:40.970872+00:00'),
  ('332', '0087504477', 'Bela Sapitri', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:07.610788+00:00'),
  ('363', '0097278700', 'Riska Hasanah', 'XII 3', 'Perempuan', 'Aktif', '2026-05-26T08:18:12.746486+00:00'),
  ('353', '3093546462', 'Nayla Putri Ramadhani', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:11.019+00:00'),
  ('367', '0087602151', 'Yuni Salamah', 'XII 4', 'Perempuan', 'Aktif', '2026-05-26T08:18:13.369287+00:00'),
  ('305', '0089178790', 'Muhammad Dzaka Prawira', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:50.580271+00:00'),
  ('308', '0099216177', 'Pratama Aidil Fitrah', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:51.667716+00:00'),
  ('309', '0094733263', 'Radit Devfahry', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:52.052147+00:00'),
  ('310', '0098617892', 'Respati Bayuaji Kamajaya', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:52.296661+00:00'),
  ('319', '0087907837', 'Tatong Ihsantri', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:54.964843+00:00'),
  ('XI5-19', 'XI5-19', 'Najwa Tsaqova', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-20', 'XI5-20', 'Naswa Puspa Ningrum', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-21', 'XI5-21', 'Nisa Alfizah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-22', 'XI5-22', 'Novi Yani Dongoran', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-23', 'XI5-23', 'Nurrahma Rahmadhani', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-24', 'XI5-24', 'Ulfatus Saiba', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-25', 'XI5-25', 'Ranti Amelia', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-26', 'XI5-26', 'Rifa Iyyah', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-27', 'XI5-27', 'Risma Ayu Ramadhani', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-28', 'XI5-28', 'Sabrina Aita Safaroh', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-29', 'XI5-29', 'Serlina Anggriani', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-30', 'XI5-30', 'Siti Anisah Bilqis Sugiono', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-31', 'XI5-31', 'Siti Nurhaliza', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-33', 'XI5-33', 'Ukhtia Rahmadani', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-34', 'XI5-34', 'Versi Ellora Bakti', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-35', 'XI5-35', 'Wismi Diniarti', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('XI5-36', 'XI5-36', 'Zaskia Ika Rahmadhani', 'XI 5', 'Perempuan', 'Aktif', '2026-07-13T09:55:12.549144+00:00'),
  ('302', '0087428655', 'Muhammad Alfan As''Ari', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:49.616826+00:00'),
  ('306', '0087466372', 'Muhammad Khoirun Ni''Amy', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:50.94695+00:00'),
  ('307', '3092038360', 'Nur Abdillah Mu''Iz', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:51.248064+00:00'),
  ('304', '0091299871', 'Muhammad Burhanuddin', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:50.343627+00:00'),
  ('XI5-32', 'XI5-32', 'Syarifah Annisa Ramadani', 'XI 5', 'Perempuan', 'Boyong', '2026-07-13T09:55:12.549144+00:00'),
  ('290', '0084413403', 'Fatku Rohman', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:45.391253+00:00'),
  ('291', '0092068998', 'Fawwaz Rizaka', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:46.243017+00:00'),
  ('292', '0085986169', 'Fergie Ikhsan', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:46.42403+00:00'),
  ('293', '3098741341', 'Hakimul Adli', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:46.692442+00:00'),
  ('294', '0092940730', 'Henkky Irawan Siregar', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:47.128873+00:00'),
  ('295', '0096360439', 'Jonal Dika', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:47.569191+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('296', '0095855491', 'Khoirul Anwar', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:47.899424+00:00'),
  ('297', '0092126165', 'M. Imam Musyaffa', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:48.248049+00:00'),
  ('298', '0094306027', 'Mahsun Huda', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:48.540197+00:00'),
  ('299', '0094077513', 'Muhamad Dwi Praditya Herianto', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:48.901745+00:00'),
  ('300', '0087044142', 'Muhamad Maulana', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:49.124117+00:00'),
  ('301', '3083717093', 'Muhamad Yusuf Nurasyid', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:49.332353+00:00'),
  ('303', '0083934560', 'Muhammad Ali Romadhon', 'XII 2', 'Laki-laki', 'Aktif', '2026-05-26T09:46:50.010992+00:00'),
  ('XI1-20', 'XI1-20', 'Muhammad Ilham', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-21', 'XI1-21', 'Muhammad Rafiansyah', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-22', 'XI1-22', 'Nauval Hysaam Amrullah', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-23', 'XI1-23', 'Ozi Ovandra', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-24', 'XI1-24', 'Raditya Firmansyah', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-25', 'XI1-25', 'Resno Fauzan Al Hafiz', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI1-26', 'XI1-26', 'Risqi Andika Pratama', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-15T17:36:31.377124+00:00'),
  ('XI1-27', 'XI1-27', 'Rudi Setiawan', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-15T17:36:31.377124+00:00'),
  ('XI1-28', 'XI1-28', 'Wildan Rizky', 'XI 1', 'Laki-laki', 'Aktif', '2026-07-15T17:36:31.377124+00:00'),
  ('XI2-1', 'XI2-1', 'Ahmadilah Rifanto', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-2', 'XI2-2', 'Ahmat Ilham Romadhon', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-3', 'XI2-3', 'Aldy Pramuditya', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-4', 'XI2-4', 'Alfikri', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-5', 'XI2-5', 'Arya Pandu Brilliant', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-6', 'XI2-6', 'Bagas', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-7', 'XI2-7', 'Budi Septria', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('257', '0084797615', 'Ahidit Wahyudi', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:36.244753+00:00'),
  ('258', '0083826374', 'Alpin Sahputra', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:36.42449+00:00'),
  ('259', '0085491664', 'Beny Setiawan', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:36.689886+00:00'),
  ('260', '0097203954', 'Dedy Setiadi', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:36.976457+00:00'),
  ('261', '0086544733', 'Fahri Abdul Hanif', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:37.206276+00:00'),
  ('262', '0083976235', 'Farel Irgian Virerza', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:37.410951+00:00'),
  ('263', '0099430382', 'Faris Zaky Ahmadtulloh', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:37.614829+00:00'),
  ('264', '3096236396', 'Gigih Ali Sofyan', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:37.817013+00:00'),
  ('265', '0095445723', 'Ikhsan Yusuf Hidayat', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:38.050382+00:00'),
  ('266', '0095257489', 'Julian Alfino Ferdiansyah', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:38.251406+00:00'),
  ('268', '0096503127', 'M. Shobirin Saputra', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:38.730172+00:00'),
  ('269', '0091599868', 'Maulana Ikhsan', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:38.897814+00:00'),
  ('270', '0088771383', 'Mohammad Raditya Pratama Irfan', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:39.162238+00:00'),
  ('271', '3097781434', 'Muhamad Taufik Nurhidayat', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:39.457471+00:00'),
  ('272', '0099423645', 'Muhamad Zikri Firmansyah', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:39.648313+00:00'),
  ('273', '0093552061', 'Muhammad Dani Alhakim', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:39.889065+00:00'),
  ('274', '0085303421', 'Muhammad Dhani Saputra', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:40.061546+00:00'),
  ('275', '0088492527', 'Naufal Ariba Yusro', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:40.283036+00:00'),
  ('276', '0096797088', 'Rafiq Hariri', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:40.568691+00:00'),
  ('277', '0094852574', 'Raka Aditya Pratama', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:40.769911+00:00'),
  ('279', '0087863150', 'Rhendy Ahmad Basuki', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:41.337554+00:00'),
  ('280', '0098259573', 'Riddho Syubkhi', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:41.610539+00:00'),
  ('281', '0088122695', 'Surya Pratama Fahrelliansyah', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:41.871483+00:00'),
  ('283', '0099584683', 'Zulfahmi Candra Ginatan', 'XII 1', 'Laki-laki', 'Aktif', '2026-05-26T09:46:42.625952+00:00'),
  ('XI2-8', 'XI2-8', 'David Alamsyah', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-9', 'XI2-9', 'Dika Setiawan', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-10', 'XI2-10', 'Elvino Aqil Adzaky', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00')
ON CONFLICT DO NOTHING;

INSERT INTO public.siswa ("id", "nis", "nama_lengkap", "kelas", "jenis_kelamin", "status", "created_at")
VALUES
  ('XI2-11', 'XI2-11', 'Fadhlan Naufal Hidayatullah', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-12', 'XI2-12', 'Firhan Al Zikri', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-13', 'XI2-13', 'Galih Latifatul Fadli', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-14', 'XI2-14', 'Habib Qowwiya', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-15', 'XI2-15', 'Hayyu Al Rozaqi', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-16', 'XI2-16', 'Ilham Bagus Ramadani', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-17', 'XI2-17', 'Labib Deskha Pratama', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-18', 'XI2-18', 'M. Arif Alfarizi', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-19', 'XI2-19', 'Muhamad Khoirul Tri Sugiarto', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-20', 'XI2-20', 'Muhammad Eko Bima Saputra', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-21', 'XI2-21', 'Muhammad Fatkhur Rizky', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00'),
  ('XI2-22', 'XI2-22', 'Muhammad Inggil Maulana Ibrahim', 'XI 2', 'Laki-laki', 'Aktif', '2026-07-13T09:55:11.548957+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.guru_kbm (11 baris)
-- =====================================================
INSERT INTO public.guru_kbm ("id_kbm", "id_user", "kelas", "mapel", "created_at", "tahun_ajar", "semester")
VALUES
  ('KBM-1783758276710RWGO', 'UID-1779817062842YOUA', 'XII 1', 'Informatika', '2026-07-11T08:24:37.394573+00:00', '2026/2027', 1),
  ('KBM-1783758287266MS9Y', 'UID-1779817062842YOUA', 'XII 2', 'Informatika', '2026-07-11T08:24:47.946745+00:00', '2026/2027', 1),
  ('KBM-178375829646148RV', 'UID-1779817062842YOUA', 'XII 3', 'Informatika', '2026-07-11T08:24:57.131356+00:00', '2026/2027', 1),
  ('KBM-1783758311605VRR5', 'UID-1779817062842YOUA', 'XII 4', 'Informatika', '2026-07-11T08:25:12.284884+00:00', '2026/2027', 1),
  ('KBM-178375832203752FW', 'UID-1779817062842YOUA', 'XII 5', 'Informatika', '2026-07-11T08:25:22.725284+00:00', '2026/2027', 1),
  ('KBM-1783835695407UOL8', 'UID-1779817062842YOUA', 'XI 1', 'Informatika', '2026-07-12T05:54:56.23129+00:00', '2026/2027', 1),
  ('KBM-1783835704276NM7W', 'UID-1779817062842YOUA', 'XI 2', 'Informatika', '2026-07-12T05:55:05.077558+00:00', '2026/2027', 1),
  ('KBM-1783835720328XXB2', 'UID-1779817062842YOUA', 'XI 3', 'Informatika', '2026-07-12T05:55:21.126118+00:00', '2026/2027', 1),
  ('KBM-1783835732046R350', 'UID-1779817062842YOUA', 'XI 4', 'Informatika', '2026-07-12T05:55:32.854863+00:00', '2026/2027', 1),
  ('KBM-17838357404573BPG', 'UID-1779817062842YOUA', 'XI 5', 'Informatika', '2026-07-12T05:55:41.267166+00:00', '2026/2027', 1),
  ('KBM-1791459308838ZGA0', 'UID-1779817062842YOUA', 'Test', 'Informatika', '2026-10-08T11:35:12.544558+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.jadwal (30 baris)
-- =====================================================
INSERT INTO public.jadwal ("id", "id_user", "mapel", "kelas", "hari", "jam_ke", "jam_mulai", "jam_selesai", "created_at", "tahun_ajar", "semester")
VALUES
  ('58293', 'UID-1779817062842YOUA', 'Informatika', 'XII 4', 'Senin', '5', '10:15', '10:55', '2026-07-12T05:27:44.580756+00:00', '2026/2027', 1),
  ('27022', 'UID-1779817062842YOUA', 'Informatika', 'XII 5', 'Senin', '2', '07:55', '08:35', '2026-07-12T05:25:14.897108+00:00', '2026/2027', 1),
  ('78612', 'UID-1779817062842YOUA', 'Informatika', 'XII 5', 'Senin', '4', '09:35', '10:15', '2026-07-12T05:26:58.093834+00:00', '2026/2027', 1),
  ('66050', 'UID-1779817062842YOUA', 'Informatika', 'XII 5', 'Senin', '3', '08:35', '09:15', '2026-07-12T05:26:06.557154+00:00', '2026/2027', 1),
  ('87016', 'UID-1779817062842YOUA', 'Informatika', 'XII 4', 'Senin', '6', '10:55', '11:35', '2026-07-12T05:40:18.288676+00:00', '2026/2027', 1),
  ('14669', 'UID-1779817062842YOUA', 'Informatika', 'XII 4', 'Senin', '6', '11:35', '12:15', '2026-07-12T05:40:46.557602+00:00', '2026/2027', 1),
  ('6269', 'UID-1779817062842YOUA', 'Informatika', 'XII 3', 'Selasa', '5', '10:15', '10:55', '2026-07-12T05:41:34.853442+00:00', '2026/2027', 1),
  ('41921', 'UID-1779817062842YOUA', 'Informatika', 'XII 3', 'Selasa', '6', '10:55', '11:35', '2026-07-12T05:51:02.538683+00:00', '2026/2027', 1),
  ('88879', 'UID-1779817062842YOUA', 'Informatika', 'XII 3', 'Selasa', '7', '11:35', '12:15', '2026-07-12T05:51:31.448922+00:00', '2026/2027', 1),
  ('98092', 'UID-1779817062842YOUA', 'Informatika', 'XII 1', 'Selasa', '1', '07:15', '07:55', '2026-07-12T05:52:11.227453+00:00', '2026/2027', 1),
  ('94871', 'UID-1779817062842YOUA', 'Informatika', 'XII 1', 'Selasa', '2', '07:55', '08:35', '2026-07-12T05:52:44.23456+00:00', '2026/2027', 1),
  ('55930', 'UID-1779817062842YOUA', 'Informatika', 'XII 1', 'Selasa', '3', '08:35', '09:15', '2026-07-12T05:53:11.982684+00:00', '2026/2027', 1),
  ('22591', 'UID-1779817062842YOUA', 'Informatika', 'XI 5', 'Kamis', '2', '07:55', '08:35', '2026-07-12T06:01:18.762683+00:00', '2026/2027', 1),
  ('98253', 'UID-1779817062842YOUA', 'Informatika', 'XI 5', 'Kamis', '5', '09:15', '09:55', '2026-07-12T06:02:24.57521+00:00', '2026/2027', 1),
  ('71103', 'UID-1779817062842YOUA', 'Informatika', 'XI 5', 'Kamis', '3', '08:35', '09:15', '2026-07-12T06:01:53.330769+00:00', '2026/2027', 1),
  ('99551', 'UID-1779817062842YOUA', 'Informatika', 'XI 4', 'Kamis', '7', '10:15', '10:55', '2026-07-12T06:03:21.327194+00:00', '2026/2027', 1),
  ('73118', 'UID-1779817062842YOUA', 'Informatika', 'XI 4', 'Kamis', '6', '10:55', '11:35', '2026-07-12T06:04:04.42091+00:00', '2026/2027', 1),
  ('20783', 'UID-1779817062842YOUA', 'Informatika', 'XI 4', 'Kamis', '7', '11:35', '12:15', '2026-07-12T06:04:40.123874+00:00', '2026/2027', 1),
  ('67368', 'UID-1779817062842YOUA', 'Informatika', 'XI 3', 'Sabtu', '3', '08:35', '09:15', '2026-07-12T06:07:47.368687+00:00', '2026/2027', 1),
  ('72985', 'UID-1779817062842YOUA', 'Informatika', 'XI 3', 'Sabtu', '4', '09:15', '09:55', '2026-07-12T06:09:33.640721+00:00', '2026/2027', 1),
  ('27129', 'UID-1779817062842YOUA', 'Informatika', 'XI 1', 'Sabtu', '5', '10:15', '10:55', '2026-07-12T06:10:25.237289+00:00', '2026/2027', 1),
  ('48621', 'UID-1779817062842YOUA', 'Informatika', 'XI 1', 'Sabtu', '6', '10:55', '11:35', '2026-07-12T06:10:55.870505+00:00', '2026/2027', 1),
  ('95599', 'UID-1779817062842YOUA', 'Informatika', 'XI 1', 'Sabtu', '7', '11:35', '12:15', '2026-07-12T06:11:25.230529+00:00', '2026/2027', 1),
  ('56043', 'UID-1779817062842YOUA', 'Informatika', 'XI 3', 'Minggu', '4', '09:35', '10:15', '2026-07-12T06:12:18.41998+00:00', '2026/2027', 1),
  ('25558', 'UID-1779817062842YOUA', 'Informatika', 'XI 2', 'Minggu', '5', '10:15', '10:55', '2026-07-12T06:12:42.782418+00:00', '2026/2027', 1),
  ('24374', 'UID-1779817062842YOUA', 'Informatika', 'XI 2', 'Minggu', '6', '10:55', '11:35', '2026-07-12T06:13:12.806303+00:00', '2026/2027', 1),
  ('6742', 'UID-1779817062842YOUA', 'Informatika', 'XI 2', 'Minggu', '7', '11:35', '12:15', '2026-07-12T06:13:35.361542+00:00', '2026/2027', 1),
  ('14796', 'UID-1779817062842YOUA', 'Informatika', 'XII 2', 'Minggu', '1', '07:15', '07:55', '2026-08-02T12:10:45.954271+00:00', '2026/2027', 1),
  ('21273', 'UID-1779817062842YOUA', 'Informatika', 'XII 2', 'Minggu', '2', '07:55', '08:35', '2026-08-02T12:11:25.134701+00:00', '2026/2027', 1),
  ('49843', 'UID-1779817062842YOUA', 'Informatika', 'XII 2', 'Minggu', '3', '08:35', '09:15', '2026-08-02T12:11:55.803033+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.jurnal (36 baris)
-- =====================================================
INSERT INTO public.jurnal ("id", "guru_id", "tanggal", "jam_ke", "pertemuan_ke", "kelas", "mapel", "materi", "kegiatan", "hambatan", "solusi", "tuntas", "created_at", "tahun_ajar", "semester")
VALUES
  ('ldphc54ft', 'UID-1779817062842YOUA', '2026-08-10', '2-4', '3', 'XII 5', 'Informatika', 'Informatika Sekarang dan Masa Depan ', 'Mengerjakan sumatif BAB 1', '', '', TRUE, '2026-08-10T01:24:56.464492+00:00', '2026/2027', 1),
  ('80b9o9g86', 'UID-1779817062842YOUA', '2026-08-10', '5-7', '3', 'XII 4', 'Informatika', 'Informatika sekarang dan masa depan ', 'Mengerjakan tugas sumatif bab 1 ', '', '', TRUE, '2026-08-10T04:36:59.035032+00:00', '2026/2027', 1),
  ('kg6o0r80x', 'UID-1779817062842YOUA', '2026-09-22', '1-3', '4', 'XII 1', 'Informatika', 'Sistem Komputer', 'Analisis sistem dan algoritma', '', '', TRUE, '2026-09-23T17:18:51.147899+00:00', '2026/2027', 1),
  ('zuuyyrp7z', 'UID-1779817062842YOUA', '2026-09-21', '2-4', '4', 'XII 5', 'Informatika', 'Sistem Komputer', 'Praktek membuat tabel dan flowchart', '', '', FALSE, '2026-09-23T17:21:47.793586+00:00', '2026/2027', 1),
  ('y0if8w8al', 'UID-1779817062842YOUA', '2026-09-20', '1-3', '3', 'XII 2', 'Informatika', 'Sistem Komputer', 'Masuk bentar', '', '', FALSE, '2026-09-23T17:23:54.860442+00:00', '2026/2027', 1),
  ('lya15or4k', 'UID-1779817062842YOUA', '2026-09-20', '5-7', '3', 'XI 2', 'Informatika', 'Analisis Data', 'Materi dan tugas analisis data (mengumpulkan, mengolah, membuat kesimpulan)', '', '', FALSE, '2026-09-23T17:25:55.333599+00:00', '2026/2027', 1),
  ('5ob4sr8vm', 'UID-1779817062842YOUA', '2026-09-24', '5-7', '2', 'XI 4', 'Informatika', 'Analisis Data ', 'Materi dan tugas kelompok ', '', '', FALSE, '2026-09-24T04:15:26.452042+00:00', '2026/2027', 1),
  ('mvpuaoxbc', 'UID-1779817062842YOUA', '2026-09-27', '1-3', '4', 'XII 2', 'Informatika', 'Sistem Komputer ', 'Materi dan tugas studi kasus sistem informasi', '', '', FALSE, '2026-09-27T03:14:54.189692+00:00', '2026/2027', 1),
  ('yuoeavyti', 'UID-1779817062842YOUA', '2026-08-10', '2-4', '3', 'XII 5', 'Informatika', 'Informatika sekarang dan masa depan ', 'Mengerjakan tugas sumatif bab 1 ', '', '', TRUE, '2026-08-10T04:36:31.961096+00:00', '2026/2027', 1),
  ('mwk4o40gw', 'UID-1779817062842YOUA', '2026-09-22', '5-7', '4', 'XII 3', 'Informatika', 'Sistem Komputer', 'Tugas Analisis sistem dan algoritma', '', '', FALSE, '2026-09-23T17:20:23.121032+00:00', '2026/2027', 1),
  ('jjaiw8e47', 'UID-1779817062842YOUA', '2026-08-04', '5-7', '3', 'XII 3', 'Informatika', 'Penilaian Sumatif bab 1', 'Mengerjakan tugas pilihan ganda dan pilihan ganda kompleks', '', '', TRUE, '2026-08-04T03:53:48.095428+00:00', '2026/2027', 1),
  ('6nk9sn594', 'UID-1779817062842YOUA', '2026-07-28', '5-7', '2', 'XII 3', 'Informatika', 'Informatika sekarang dan masa depan', 'Materi dan tugas pro kontra AI dan cara menggunakannya', '', '', TRUE, '2026-08-04T03:55:40.201968+00:00', '2026/2027', 1),
  ('tnkdbjb6t', 'UID-1779817062842YOUA', '2026-09-21', '5-7', '4', 'XII 4', 'Informatika', 'Sistem Komputer', 'Tugas analisis sistem dan algoritma', '', '', FALSE, '2026-09-23T17:22:41.212575+00:00', '2026/2027', 1),
  ('xknhfp4ui', 'UID-1779817062842YOUA', '2026-07-21', '1-3', '1', 'XII 1', 'Informatika', 'Bersih labor', '', '', '', TRUE, '2026-07-21T06:57:45.663654+00:00', '2026/2027', 1),
  ('83ys98yk0', 'UID-1779817062842YOUA', '2026-07-21', '5-7', '1', 'XII 3', 'Informatika', 'Test Kemampuan Mengetik', '', '', '', TRUE, '2026-07-21T06:58:37.16627+00:00', '2026/2027', 1),
  ('56ms2etqc', 'UID-1779817062842YOUA', '2026-07-23', '2-4', '1', 'XI 5', 'Informatika', 'Perkenalkan Teman Sebangku', 'Perkenalkan Teman Sebangku', '', '', TRUE, '2026-07-23T05:33:23.140512+00:00', '2026/2027', 1),
  ('owqdbseg9', 'UID-1779817062842YOUA', '2026-07-23', '5-7', '1', 'XI 4', 'Informatika', 'Typing', 'Test Kemampuan Mengetik', 'Jaringan', 'Mencoba beberapa jaringan', TRUE, '2026-07-23T05:34:14.38454+00:00', '2026/2027', 1),
  ('quzg3dgwc', 'UID-1779817062842YOUA', '2026-07-27', '2-4', '1', 'XII 5', 'Informatika', 'Informatika sekarang dan masa depan', 'Melihat perkembangan teknologi masa lalu hingga saat ini. Juga test Kemampuan Mengetik. ', 'Proyektor rusak', 'Memperbaiki walaupun memakan waktu yang lama. ', TRUE, '2026-07-27T11:44:03.853735+00:00', '2026/2027', 1),
  ('xwjc8hm1h', 'UID-1779817062842YOUA', '2026-07-27', '5-7', '1', 'XII 4', 'Informatika', 'Informatika sekarang dan masa depan. ', '', '', '', FALSE, '2026-07-27T11:44:53.988986+00:00', '2026/2027', 1),
  ('bjrj7f7jp', 'UID-1779817062842YOUA', '2026-07-26', '1-3', '1', 'XII 2', 'Informatika', 'Test Kemampuan Mengetik ', 'Test Kemampuan Mengetik siswa', '', '', TRUE, '2026-07-27T11:46:41.574787+00:00', '2026/2027', 1),
  ('5fqyhe7e7', 'UID-1779817062842YOUA', '2026-07-26', '5-7', '1', 'XI 2', 'Informatika', 'Test Kemampuan Mengetik ', 'Test Kemampuan Mengetik ', '', '', TRUE, '2026-07-27T11:47:20.510151+00:00', '2026/2027', 1),
  ('7i7we7xuw', 'UID-1779817062842YOUA', '2026-08-02', '1-3', '2', 'XII 2', 'Informatika', 'Informatika sekarang dan masa depan ', 'Ceramah materi dan tugas pro kontra ai dengan ide iot', '', '', FALSE, '2026-08-02T12:13:05.172977+00:00', '2026/2027', 1),
  ('hlzymfz1v', 'UID-1779817062842YOUA', '2026-08-02', '5-7', '2', 'XI 2', 'Informatika', 'Mesin Pencari', 'Memahami mesin pencari dan tugas studi kasus mesin pencari ', 'Kesulitan memahami tugas', 'Memberikan contoh dan mendikte tugas perkelompok ', TRUE, '2026-08-02T12:16:33.720276+00:00', '2026/2027', 1),
  ('hfwsi7f4k', 'UID-1779817062842YOUA', '2026-09-24', '2-4', '2', 'XI 5', 'Informatika', 'Analisis data ', 'Tugas kelompok mencari, mengolah, dan menyimpulkan data. ', '', '', FALSE, '2026-09-24T02:36:02.693097+00:00', '2026/2027', 1),
  ('98bvpayw2', 'UID-1779817062842YOUA', '2026-07-28', '1-3', '2', 'XII 1', 'Informatika', 'Informatika sekarang dan masa depan ', 'Materi dan tugas ide IoT', '', '', TRUE, '2026-08-04T04:02:36.984954+00:00', '2026/2027', 1),
  ('lc1my1urt', 'UID-1779817062842YOUA', '2026-08-04', '1-3', '3', 'XII 1', 'Informatika', 'Informatika sekarang dan masa depan ', 'Tugas sumatif bab 1 ', 'Ada satu dibawah kkm', '', TRUE, '2026-08-04T04:03:29.448705+00:00', '2026/2027', 1),
  ('f5pwps916', 'UID-1779817062842YOUA', '2026-08-03', '2-4', '2', 'XII 5', 'Informatika', 'Informatika sekarang dan masa depan ', 'Materi pembelajaran mengenai informatika dan teknologi saat ini ', '', '', TRUE, '2026-08-04T04:05:45.785673+00:00', '2026/2027', 1),
  ('krreu47nl', 'UID-1779817062842YOUA', '2026-08-03', '5-7', '2', 'XII 4', 'Informatika', 'Informatika sekarang dan masa depan ', 'Materi pembelajaran mengenai informatika dan teknologi saat ini ', '', '', TRUE, '2026-08-04T04:07:01.685474+00:00', '2026/2027', 1),
  ('rohqj5ks6', 'UID-1779817062842YOUA', '2026-06-17', '1-3', '1', 'XI 3', 'Informatika', 'dghg', 'Di', '', '', FALSE, '2026-10-15T04:44:15.398182+00:00', '2026/2027', 1),
  ('1w1r88y2z', 'UID-1779817062842YOUA', '2026-07-25', '3-4', '3', 'XI 3', 'Informatika', 'Test Kemampuan Mengetik', '', '', '', FALSE, '2026-07-25T10:58:30.276932+00:00', '2026/2027', 1),
  ('udbfwm79f', 'UID-1779817062842YOUA', '2026-07-18', '3-4', '2', 'XI 3', 'Informatika', 'Perkenalan Diri', '', '', '', FALSE, '2026-07-25T10:58:00.270307+00:00', '2026/2027', 1),
  ('776qkcao2', 'UID-1779817062842YOUA', '2026-09-20', '4', '6', 'XI 3', 'Informatika', 'Analisis Data', 'Materi analisis data', '', '', FALSE, '2026-09-23T17:24:42.904573+00:00', '2026/2027', 1),
  ('q5x97c54w', 'UID-1779817062842YOUA', '2026-09-27', '4', '7', 'XI 3', 'Informatika', 'Analisis Data ', 'Tugas mengumpulkan, mengolah, menyimpulkan data', '', '', FALSE, '2026-09-27T03:14:00.494517+00:00', '2026/2027', 1),
  ('nl3vkfq1v', 'UID-1779817062842YOUA', '2026-08-01', '3-4', '4', 'XI 3', 'Informatika', 'Mesin Pencari ', 'Mesin Pencari ', '', '', TRUE, '2026-08-01T02:31:12.074151+00:00', '2026/2027', 1),
  ('q2qugq5oj', 'UID-1779817062842YOUA', '2026-08-02', '4', '5', 'XI 3', 'Informatika', 'Mesin pencari ', 'Latihan studi kasus mesin pencari', 'Kesulitan memahami soal', 'Jadikan sebagai tugas asrama', FALSE, '2026-08-02T12:14:17.34257+00:00', '2026/2027', 1),
  ('nm6wsz3fw', 'UID-1779817062842YOUA', '2026-07-25', '5-7', '1', 'XI 1', 'Informatika', 'Perkenalan', '', '', '', FALSE, '2026-08-04T16:54:15.394335+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.absensi_harian (1 baris)
-- =====================================================
INSERT INTO public.absensi_harian ("sesi_id", "tanggal", "kelas", "created_at", "tahun_ajar", "semester")
VALUES
  ('SESI-H-q9421alpw', '2026-10-17', 'XI 1', '2026-10-17T11:11:30.588915+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.absensi_harian_siswa (27 baris)
-- =====================================================
INSERT INTO public.absensi_harian_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (1025, 'SESI-H-q9421alpw', 'XI1-2', 'Hadir', ''),
  (1026, 'SESI-H-q9421alpw', 'XI1-3', 'Hadir', ''),
  (1027, 'SESI-H-q9421alpw', 'XI1-4', 'Hadir', ''),
  (1028, 'SESI-H-q9421alpw', 'XI1-5', 'Hadir', ''),
  (1029, 'SESI-H-q9421alpw', 'XI1-6', 'Hadir', ''),
  (1030, 'SESI-H-q9421alpw', 'XI1-7', 'Hadir', ''),
  (1031, 'SESI-H-q9421alpw', 'XI1-8', 'Hadir', ''),
  (1032, 'SESI-H-q9421alpw', 'XI1-9', 'Hadir', ''),
  (1033, 'SESI-H-q9421alpw', 'XI1-10', 'Hadir', ''),
  (1034, 'SESI-H-q9421alpw', 'XI1-11', 'Hadir', ''),
  (1035, 'SESI-H-q9421alpw', 'XI1-12', 'Hadir', ''),
  (1036, 'SESI-H-q9421alpw', 'XI1-13', 'Hadir', ''),
  (1037, 'SESI-H-q9421alpw', 'XI1-15', 'Hadir', ''),
  (1038, 'SESI-H-q9421alpw', 'XI1-16', 'Hadir', ''),
  (1039, 'SESI-H-q9421alpw', 'XI1-14', 'Hadir', ''),
  (1040, 'SESI-H-q9421alpw', 'XI1-17', 'Hadir', ''),
  (1041, 'SESI-H-q9421alpw', 'XI1-18', 'Hadir', ''),
  (1042, 'SESI-H-q9421alpw', 'XI1-19', 'Hadir', ''),
  (1043, 'SESI-H-q9421alpw', 'XI1-20', 'Hadir', ''),
  (1044, 'SESI-H-q9421alpw', 'XI1-21', 'Hadir', ''),
  (1045, 'SESI-H-q9421alpw', 'XI1-22', 'Hadir', ''),
  (1046, 'SESI-H-q9421alpw', 'XI1-23', 'Hadir', ''),
  (1047, 'SESI-H-q9421alpw', 'XI1-24', 'Hadir', ''),
  (1048, 'SESI-H-q9421alpw', 'XI1-25', 'Hadir', ''),
  (1049, 'SESI-H-q9421alpw', 'XI1-26', 'Hadir', ''),
  (1050, 'SESI-H-q9421alpw', 'XI1-27', 'Hadir', ''),
  (1051, 'SESI-H-q9421alpw', 'XI1-28', 'Hadir', '')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.absensi_mapel (21 baris)
-- =====================================================
INSERT INTO public.absensi_mapel ("sesi_id", "guru_id", "tanggal", "jam_ke", "kelas", "mapel", "created_at", "tahun_ajar", "semester")
VALUES
  ('SESI-M-nbtwx2qiv', 'UID-1779817062842YOUA', '2026-07-19', '1-3', 'XII 2', 'Informatika', '2026-07-19T00:49:28.688773+00:00', '2026/2027', 1),
  ('SESI-M-i9evxc0eh', 'UID-1779817062842YOUA', '2026-07-21', '5-7', 'XII 3', 'Informatika', '2026-07-21T04:02:26.859197+00:00', '2026/2027', 1),
  ('SESI-M-1padbl2zv', 'UID-1779817062842YOUA', '2026-07-23', '3-5', 'XI 5', 'Informatika', '2026-07-23T02:09:29.582605+00:00', '2026/2027', 1),
  ('SESI-M-njabbcwt3', 'UID-1779817062842YOUA', '2026-07-23', '5-7', 'XI 4', 'Informatika', '2026-07-23T04:07:00.46008+00:00', '2026/2027', 1),
  ('SESI-M-mf6s0bnw8', 'UID-1779817062842YOUA', '2026-07-26', '5-7', 'XI 2', 'Informatika', '2026-07-27T11:50:41.787159+00:00', '2026/2027', 1),
  ('SESI-M-sqmzu75pl', 'UID-1779817062842YOUA', '2026-07-26', '1-3', 'XII 2', 'Informatika', '2026-07-27T11:52:48.569364+00:00', '2026/2027', 1),
  ('SESI-M-jeoi9gkft', 'UID-1779817062842YOUA', '2026-07-28', '1-3', 'XII 1', 'Informatika', '2026-07-28T00:52:40.86607+00:00', '2026/2027', 1),
  ('SESI-M-ezzb1qclp', 'UID-1779817062842YOUA', '2026-08-01', '3-4', 'XI 3', 'Informatika', '2026-08-01T02:34:03.301839+00:00', '2026/2027', 1),
  ('SESI-M-7ubmd6pqh', 'UID-1779817062842YOUA', '2026-08-02', '1-3', 'XII 2', 'Informatika', '2026-08-02T01:49:35.201877+00:00', '2026/2027', 1),
  ('SESI-M-dg7ercews', 'UID-1779817062842YOUA', '2026-07-28', '5-7', 'XII 3', 'Informatika', '2026-08-04T01:50:55.129316+00:00', '2026/2027', 1),
  ('SESI-M-mfl2en7tb', 'UID-1779817062842YOUA', '2026-08-04', '5-7', 'XII 3', 'Informatika', '2026-08-04T03:42:13.235378+00:00', '2026/2027', 1),
  ('SESI-M-k59p1d7jp', 'UID-1779817062842YOUA', '2026-08-10', '5-7', 'XII 4', 'Informatika', '2026-08-10T04:34:30.115471+00:00', '2026/2027', 1),
  ('SESI-M-sa2k93fht', 'UID-1779817062842YOUA', '2026-08-09', '1-3', 'XII 2', 'Informatika', '2026-08-11T06:37:12.690875+00:00', '2026/2027', 1),
  ('SESI-M-y4azn80bd', 'UID-1779817062842YOUA', '2026-08-08', '5-7', 'XI 1', 'Informatika', '2026-08-11T06:53:42.769036+00:00', '2026/2027', 1),
  ('SESI-M-elr40i66k', 'UID-1779817062842YOUA', '2026-08-23', '1-3', 'XII 2', 'Informatika', '2026-08-23T01:00:07.991523+00:00', '2026/2027', 1),
  ('SESI-M-sm9huwbfr', 'UID-1779817062842YOUA', '2026-09-24', '2-4', 'XI 5', 'Informatika', '2026-09-24T02:36:49.438667+00:00', '2026/2027', 1),
  ('SESI-M-781izyyzf', 'UID-1779817062842YOUA', '2026-09-24', '5-7', 'XI 4', 'Informatika', '2026-09-24T04:17:28.856184+00:00', '2026/2027', 1),
  ('SESI-M-ak140ruzz', 'UID-1779817062842YOUA', '2026-10-10', '3-4', 'XI 3', 'Informatika', '2026-10-10T01:51:45.008573+00:00', '2026/2027', 1),
  ('SESI-M-xt2xs2gp6', 'UID-1779817062842YOUA', '2026-10-11', '1-3', 'XII 2', 'Informatika', '2026-10-11T01:32:22.141579+00:00', '2026/2027', 1),
  ('SESI-M-n383jxmpj', 'UID-1779817062842YOUA', '2026-06-17', '1-3', 'Test', 'Informatika', '2026-10-15T04:42:18.87377+00:00', '2026/2027', 1),
  ('SESI-M-expttkfyl', 'UID-1779817062842YOUA', '2026-10-17', '5-7', 'XI 1', 'Informatika', '2026-10-17T06:37:28.910816+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.absensi_mapel_siswa (615 baris)
-- =====================================================
INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (3707, 'SESI-M-nbtwx2qiv', '284', 'Hadir', ''),
  (3708, 'SESI-M-nbtwx2qiv', '285', 'Alpa', ''),
  (3709, 'SESI-M-nbtwx2qiv', 'XII-1784137806982-oubco', 'Hadir', ''),
  (3710, 'SESI-M-nbtwx2qiv', '287', 'Alpa', ''),
  (3711, 'SESI-M-nbtwx2qiv', '288', 'Hadir', ''),
  (3712, 'SESI-M-nbtwx2qiv', '289', 'Alpa', ''),
  (3713, 'SESI-M-nbtwx2qiv', '290', 'Hadir', ''),
  (3714, 'SESI-M-nbtwx2qiv', '291', 'Hadir', ''),
  (3715, 'SESI-M-nbtwx2qiv', '292', 'Alpa', ''),
  (3716, 'SESI-M-nbtwx2qiv', '293', 'Hadir', ''),
  (3717, 'SESI-M-nbtwx2qiv', '294', 'Hadir', ''),
  (3718, 'SESI-M-nbtwx2qiv', '295', 'Hadir', ''),
  (3719, 'SESI-M-nbtwx2qiv', '296', 'Alpa', ''),
  (3720, 'SESI-M-nbtwx2qiv', '297', 'Hadir', ''),
  (3721, 'SESI-M-nbtwx2qiv', '298', 'Hadir', ''),
  (3722, 'SESI-M-nbtwx2qiv', '299', 'Alpa', ''),
  (3723, 'SESI-M-nbtwx2qiv', '300', 'Hadir', ''),
  (3724, 'SESI-M-nbtwx2qiv', '301', 'Hadir', ''),
  (3725, 'SESI-M-nbtwx2qiv', '302', 'Hadir', ''),
  (3726, 'SESI-M-nbtwx2qiv', '303', 'Hadir', ''),
  (3727, 'SESI-M-nbtwx2qiv', '304', 'Alpa', ''),
  (3728, 'SESI-M-nbtwx2qiv', '305', 'Alpa', ''),
  (3729, 'SESI-M-nbtwx2qiv', '306', 'Alpa', ''),
  (3730, 'SESI-M-nbtwx2qiv', '307', 'Hadir', ''),
  (3731, 'SESI-M-nbtwx2qiv', '308', 'Hadir', ''),
  (3732, 'SESI-M-nbtwx2qiv', '309', 'Alpa', ''),
  (3733, 'SESI-M-nbtwx2qiv', '310', 'Hadir', ''),
  (3734, 'SESI-M-nbtwx2qiv', '319', 'Hadir', ''),
  (3847, 'SESI-M-i9evxc0eh', '328', 'Hadir', ''),
  (3848, 'SESI-M-i9evxc0eh', '331', 'Hadir', ''),
  (3849, 'SESI-M-i9evxc0eh', '332', 'Hadir', ''),
  (3850, 'SESI-M-i9evxc0eh', '333', 'Hadir', ''),
  (3851, 'SESI-M-i9evxc0eh', '334', 'Hadir', ''),
  (3852, 'SESI-M-i9evxc0eh', '337', 'Hadir', ''),
  (3853, 'SESI-M-i9evxc0eh', '341', 'Hadir', ''),
  (3854, 'SESI-M-i9evxc0eh', '342', 'Sakit', ''),
  (3855, 'SESI-M-i9evxc0eh', '346', 'Hadir', ''),
  (3856, 'SESI-M-i9evxc0eh', '240', 'Alpa', ''),
  (3857, 'SESI-M-i9evxc0eh', '357', 'Hadir', ''),
  (3858, 'SESI-M-i9evxc0eh', '360', 'Hadir', ''),
  (3859, 'SESI-M-i9evxc0eh', '361', 'Hadir', ''),
  (3860, 'SESI-M-i9evxc0eh', '362', 'Hadir', ''),
  (3861, 'SESI-M-i9evxc0eh', '363', 'Hadir', ''),
  (3862, 'SESI-M-i9evxc0eh', '311', 'Hadir', ''),
  (3863, 'SESI-M-i9evxc0eh', '312', 'Hadir', ''),
  (3864, 'SESI-M-i9evxc0eh', '313', 'Hadir', ''),
  (3865, 'SESI-M-i9evxc0eh', '314', 'Hadir', ''),
  (3866, 'SESI-M-i9evxc0eh', '315', 'Hadir', ''),
  (3867, 'SESI-M-i9evxc0eh', '316', 'Sakit', ''),
  (3868, 'SESI-M-i9evxc0eh', '317', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (3869, 'SESI-M-i9evxc0eh', '318', 'Hadir', ''),
  (3870, 'SESI-M-i9evxc0eh', '320', 'Hadir', ''),
  (3871, 'SESI-M-i9evxc0eh', '321', 'Hadir', ''),
  (3872, 'SESI-M-i9evxc0eh', '322', 'Hadir', ''),
  (3873, 'SESI-M-i9evxc0eh', '323', 'Hadir', ''),
  (3874, 'SESI-M-i9evxc0eh', '324', 'Sakit', ''),
  (4280, 'SESI-M-dg7ercews', '328', 'Hadir', ''),
  (4281, 'SESI-M-dg7ercews', '331', 'Hadir', ''),
  (4282, 'SESI-M-dg7ercews', '332', 'Hadir', ''),
  (4283, 'SESI-M-dg7ercews', '333', 'Hadir', ''),
  (4284, 'SESI-M-dg7ercews', '334', 'Hadir', ''),
  (4285, 'SESI-M-dg7ercews', '337', 'Sakit', ''),
  (4286, 'SESI-M-dg7ercews', '341', 'Sakit', ''),
  (4287, 'SESI-M-dg7ercews', '342', 'Sakit', ''),
  (4288, 'SESI-M-dg7ercews', '346', 'Hadir', ''),
  (3884, 'SESI-M-1padbl2zv', 'XI5-1', 'Hadir', ''),
  (3885, 'SESI-M-1padbl2zv', 'XI5-2', 'Hadir', ''),
  (3886, 'SESI-M-1padbl2zv', 'XI5-3', 'Hadir', ''),
  (3887, 'SESI-M-1padbl2zv', 'XI5-4', 'Hadir', ''),
  (3888, 'SESI-M-1padbl2zv', 'XI5-5', 'Hadir', ''),
  (3889, 'SESI-M-1padbl2zv', 'XI5-6', 'Hadir', ''),
  (3890, 'SESI-M-1padbl2zv', 'XI5-7', 'Hadir', ''),
  (3891, 'SESI-M-1padbl2zv', 'XI5-8', 'Izin', ''),
  (3892, 'SESI-M-1padbl2zv', 'XI5-9', 'Hadir', ''),
  (3893, 'SESI-M-1padbl2zv', 'XI5-10', 'Hadir', 'Nyanyi'),
  (3894, 'SESI-M-1padbl2zv', 'XI5-11', 'Hadir', ''),
  (3895, 'SESI-M-1padbl2zv', 'XI5-12', 'Hadir', ''),
  (3896, 'SESI-M-1padbl2zv', 'XI5-14', 'Hadir', ''),
  (3897, 'SESI-M-1padbl2zv', 'XI5-15', 'Hadir', ''),
  (3898, 'SESI-M-1padbl2zv', 'XI5-16', 'Hadir', ''),
  (3899, 'SESI-M-1padbl2zv', 'XI5-17', 'Alpa', 'Boyong'),
  (3900, 'SESI-M-1padbl2zv', 'XI5-13', 'Hadir', ''),
  (3901, 'SESI-M-1padbl2zv', 'XI5-18', 'Hadir', ''),
  (3902, 'SESI-M-1padbl2zv', 'XI5-19', 'Hadir', ''),
  (3903, 'SESI-M-1padbl2zv', 'XI5-20', 'Hadir', ''),
  (3904, 'SESI-M-1padbl2zv', 'XI5-21', 'Hadir', ''),
  (3905, 'SESI-M-1padbl2zv', 'XI5-22', 'Hadir', ''),
  (3906, 'SESI-M-1padbl2zv', 'XI5-23', 'Hadir', ''),
  (3907, 'SESI-M-1padbl2zv', 'XI5-25', 'Izin', ''),
  (3908, 'SESI-M-1padbl2zv', 'XI5-26', 'Izin', ''),
  (3909, 'SESI-M-1padbl2zv', 'XI5-27', 'Hadir', ''),
  (3910, 'SESI-M-1padbl2zv', 'XI5-28', 'Hadir', ''),
  (3911, 'SESI-M-1padbl2zv', 'XI5-29', 'Hadir', ''),
  (3912, 'SESI-M-1padbl2zv', 'XI5-30', 'Hadir', ''),
  (3913, 'SESI-M-1padbl2zv', 'XI5-31', 'Sakit', ''),
  (3914, 'SESI-M-1padbl2zv', 'XI5-32', 'Hadir', ''),
  (3915, 'SESI-M-1padbl2zv', 'XI5-33', 'Hadir', ''),
  (3916, 'SESI-M-1padbl2zv', 'XI5-24', 'Hadir', ''),
  (3917, 'SESI-M-1padbl2zv', 'XI5-34', 'Sakit', ''),
  (4289, 'SESI-M-dg7ercews', '240', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4290, 'SESI-M-dg7ercews', '357', 'Hadir', ''),
  (4225, 'SESI-M-7ubmd6pqh', '284', 'Hadir', ''),
  (4226, 'SESI-M-7ubmd6pqh', '285', 'Hadir', ''),
  (4227, 'SESI-M-7ubmd6pqh', 'XII-1784137806982-oubco', 'Hadir', ''),
  (4228, 'SESI-M-7ubmd6pqh', '287', 'Hadir', ''),
  (4229, 'SESI-M-7ubmd6pqh', '288', 'Hadir', ''),
  (4230, 'SESI-M-7ubmd6pqh', '289', 'Hadir', 'Telat'),
  (4231, 'SESI-M-7ubmd6pqh', '290', 'Hadir', ''),
  (4232, 'SESI-M-7ubmd6pqh', '291', 'Hadir', 'Telat'),
  (4233, 'SESI-M-7ubmd6pqh', '292', 'Hadir', ''),
  (4234, 'SESI-M-7ubmd6pqh', '293', 'Izin', ''),
  (4235, 'SESI-M-7ubmd6pqh', '294', 'Hadir', ''),
  (4236, 'SESI-M-7ubmd6pqh', '295', 'Hadir', ''),
  (4237, 'SESI-M-7ubmd6pqh', '296', 'Alpa', ''),
  (4238, 'SESI-M-7ubmd6pqh', '297', 'Hadir', ''),
  (4239, 'SESI-M-7ubmd6pqh', '298', 'Hadir', ''),
  (4240, 'SESI-M-7ubmd6pqh', '299', 'Hadir', ''),
  (4241, 'SESI-M-7ubmd6pqh', '300', 'Alpa', ''),
  (4242, 'SESI-M-7ubmd6pqh', '301', 'Hadir', ''),
  (4243, 'SESI-M-7ubmd6pqh', '302', 'Hadir', ''),
  (4244, 'SESI-M-7ubmd6pqh', '303', 'Hadir', ''),
  (4245, 'SESI-M-7ubmd6pqh', '304', 'Hadir', ''),
  (4246, 'SESI-M-7ubmd6pqh', '305', 'Alpa', ''),
  (4247, 'SESI-M-7ubmd6pqh', '306', 'Hadir', 'Telat'),
  (4248, 'SESI-M-7ubmd6pqh', '307', 'Hadir', ''),
  (4249, 'SESI-M-7ubmd6pqh', '308', 'Hadir', ''),
  (4250, 'SESI-M-7ubmd6pqh', '309', 'Hadir', ''),
  (4251, 'SESI-M-7ubmd6pqh', '310', 'Hadir', ''),
  (4252, 'SESI-M-7ubmd6pqh', '319', 'Hadir', ''),
  (3918, 'SESI-M-1padbl2zv', 'XI5-35', 'Hadir', ''),
  (3919, 'SESI-M-1padbl2zv', 'XI5-36', 'Hadir', ''),
  (3920, 'SESI-M-njabbcwt3', 'XI4-1', 'Alpa', ''),
  (3921, 'SESI-M-njabbcwt3', 'XI4-2', 'Hadir', '20/97'),
  (3922, 'SESI-M-njabbcwt3', 'XI4-3', 'Hadir', '19/96'),
  (3923, 'SESI-M-njabbcwt3', 'XI4-4', 'Hadir', '21/97'),
  (3924, 'SESI-M-njabbcwt3', 'XI4-5', 'Alpa', ''),
  (3925, 'SESI-M-njabbcwt3', 'XI4-6', 'Hadir', '16/96'),
  (3926, 'SESI-M-njabbcwt3', 'XI4-7', 'Hadir', '14/94'),
  (3927, 'SESI-M-njabbcwt3', 'XI4-8', 'Hadir', '16/96'),
  (3928, 'SESI-M-njabbcwt3', 'XI4-9', 'Alpa', ''),
  (3929, 'SESI-M-njabbcwt3', 'XI4-12', 'Alpa', ''),
  (3930, 'SESI-M-njabbcwt3', 'XI4-13', 'Alpa', ''),
  (3931, 'SESI-M-njabbcwt3', 'XI4-14', 'Alpa', ''),
  (3932, 'SESI-M-njabbcwt3', 'XI4-15', 'Alpa', ''),
  (3933, 'SESI-M-njabbcwt3', 'XI4-16', 'Alpa', ''),
  (3934, 'SESI-M-njabbcwt3', 'XI4-17', 'Alpa', ''),
  (3935, 'SESI-M-njabbcwt3', 'XI4-18', 'Alpa', ''),
  (3936, 'SESI-M-njabbcwt3', 'XI4-19', 'Alpa', ''),
  (3937, 'SESI-M-njabbcwt3', 'XI4-20', 'Alpa', ''),
  (3938, 'SESI-M-njabbcwt3', 'XI4-21', 'Alpa', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (3939, 'SESI-M-njabbcwt3', 'XI4-22', 'Alpa', ''),
  (3940, 'SESI-M-njabbcwt3', 'XI4-23', 'Alpa', ''),
  (3941, 'SESI-M-njabbcwt3', 'XI4-24', 'Alpa', ''),
  (3942, 'SESI-M-njabbcwt3', 'XI4-10', 'Hadir', '16/94'),
  (3943, 'SESI-M-njabbcwt3', 'XI4-25', 'Alpa', ''),
  (3944, 'SESI-M-njabbcwt3', 'XI4-26', 'Alpa', ''),
  (3945, 'SESI-M-njabbcwt3', 'XI4-27', 'Alpa', ''),
  (3946, 'SESI-M-njabbcwt3', 'XI4-28', 'Alpa', ''),
  (3947, 'SESI-M-njabbcwt3', 'XI4-29', 'Alpa', ''),
  (3948, 'SESI-M-njabbcwt3', 'XI4-11', 'Alpa', ''),
  (3949, 'SESI-M-njabbcwt3', 'XI4-30', 'Alpa', ''),
  (3950, 'SESI-M-njabbcwt3', 'XI4-31', 'Alpa', ''),
  (3951, 'SESI-M-njabbcwt3', 'XI4-32', 'Alpa', ''),
  (3952, 'SESI-M-njabbcwt3', 'XI4-33', 'Alpa', ''),
  (3953, 'SESI-M-njabbcwt3', 'XI4-34', 'Alpa', ''),
  (3954, 'SESI-M-njabbcwt3', 'XI4-35', 'Alpa', ''),
  (3955, 'SESI-M-mf6s0bnw8', 'XI2-1', 'Hadir', ''),
  (3956, 'SESI-M-mf6s0bnw8', 'XI2-2', 'Hadir', ''),
  (3957, 'SESI-M-mf6s0bnw8', 'XI2-3', 'Alpa', ''),
  (3958, 'SESI-M-mf6s0bnw8', 'XI2-4', 'Hadir', ''),
  (3959, 'SESI-M-mf6s0bnw8', 'XI2-5', 'Hadir', ''),
  (3960, 'SESI-M-mf6s0bnw8', 'XI2-6', 'Hadir', ''),
  (3961, 'SESI-M-mf6s0bnw8', 'XI2-7', 'Hadir', ''),
  (3962, 'SESI-M-mf6s0bnw8', 'XI2-8', 'Hadir', ''),
  (3963, 'SESI-M-mf6s0bnw8', 'XI2-9', 'Sakit', ''),
  (3964, 'SESI-M-mf6s0bnw8', 'XI2-10', 'Hadir', ''),
  (3965, 'SESI-M-mf6s0bnw8', 'XI2-11', 'Hadir', ''),
  (3966, 'SESI-M-mf6s0bnw8', 'XI2-12', 'Hadir', ''),
  (3967, 'SESI-M-mf6s0bnw8', 'XI2-13', 'Hadir', ''),
  (3968, 'SESI-M-mf6s0bnw8', 'XI2-14', 'Hadir', ''),
  (3969, 'SESI-M-mf6s0bnw8', 'XI2-15', 'Alpa', ''),
  (3970, 'SESI-M-mf6s0bnw8', 'XI2-16', 'Izin', ''),
  (3971, 'SESI-M-mf6s0bnw8', 'XI2-17', 'Hadir', ''),
  (3972, 'SESI-M-mf6s0bnw8', 'XI2-18', 'Izin', ''),
  (3973, 'SESI-M-mf6s0bnw8', 'XI2-19', 'Hadir', ''),
  (3974, 'SESI-M-mf6s0bnw8', 'XI2-20', 'Hadir', ''),
  (3975, 'SESI-M-mf6s0bnw8', 'XI2-21', 'Hadir', ''),
  (3976, 'SESI-M-mf6s0bnw8', 'XI2-22', 'Hadir', ''),
  (3977, 'SESI-M-mf6s0bnw8', 'XI2-23', 'Hadir', ''),
  (3978, 'SESI-M-mf6s0bnw8', 'XI2-24', 'Hadir', ''),
  (3979, 'SESI-M-mf6s0bnw8', 'XI2-25', 'Hadir', ''),
  (3980, 'SESI-M-mf6s0bnw8', 'XI2-26', 'Hadir', ''),
  (3981, 'SESI-M-mf6s0bnw8', 'XI2-27', 'Alpa', ''),
  (3982, 'SESI-M-mf6s0bnw8', 'XI2-28', 'Hadir', ''),
  (3983, 'SESI-M-mf6s0bnw8', 'XI2-29', 'Sakit', ''),
  (3984, 'SESI-M-mf6s0bnw8', 'XI2-30', 'Alpa', ''),
  (3985, 'SESI-M-sqmzu75pl', '284', 'Hadir', ''),
  (3986, 'SESI-M-sqmzu75pl', '285', 'Hadir', ''),
  (3987, 'SESI-M-sqmzu75pl', 'XII-1784137806982-oubco', 'Hadir', ''),
  (3988, 'SESI-M-sqmzu75pl', '287', 'Sakit', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (3989, 'SESI-M-sqmzu75pl', '288', 'Hadir', ''),
  (3990, 'SESI-M-sqmzu75pl', '289', 'Alpa', ''),
  (3991, 'SESI-M-sqmzu75pl', '290', 'Hadir', ''),
  (3992, 'SESI-M-sqmzu75pl', '291', 'Hadir', ''),
  (3993, 'SESI-M-sqmzu75pl', '292', 'Hadir', ''),
  (3994, 'SESI-M-sqmzu75pl', '293', 'Izin', ''),
  (3995, 'SESI-M-sqmzu75pl', '294', 'Hadir', ''),
  (3996, 'SESI-M-sqmzu75pl', '295', 'Hadir', ''),
  (3997, 'SESI-M-sqmzu75pl', '296', 'Sakit', ''),
  (3998, 'SESI-M-sqmzu75pl', '297', 'Hadir', ''),
  (3999, 'SESI-M-sqmzu75pl', '298', 'Izin', ''),
  (4000, 'SESI-M-sqmzu75pl', '299', 'Hadir', ''),
  (4001, 'SESI-M-sqmzu75pl', '300', 'Sakit', ''),
  (4002, 'SESI-M-sqmzu75pl', '301', 'Hadir', ''),
  (4003, 'SESI-M-sqmzu75pl', '302', 'Hadir', ''),
  (4004, 'SESI-M-sqmzu75pl', '303', 'Hadir', ''),
  (4005, 'SESI-M-sqmzu75pl', '304', 'Hadir', ''),
  (4006, 'SESI-M-sqmzu75pl', '305', 'Hadir', ''),
  (4007, 'SESI-M-sqmzu75pl', '306', 'Alpa', ''),
  (4008, 'SESI-M-sqmzu75pl', '307', 'Hadir', ''),
  (4009, 'SESI-M-sqmzu75pl', '308', 'Hadir', ''),
  (4010, 'SESI-M-sqmzu75pl', '309', 'Hadir', ''),
  (4011, 'SESI-M-sqmzu75pl', '310', 'Hadir', ''),
  (4012, 'SESI-M-sqmzu75pl', '319', 'Izin', ''),
  (4291, 'SESI-M-dg7ercews', '360', 'Hadir', ''),
  (4292, 'SESI-M-dg7ercews', '361', 'Hadir', ''),
  (4293, 'SESI-M-dg7ercews', '362', 'Hadir', ''),
  (4294, 'SESI-M-dg7ercews', '363', 'Sakit', ''),
  (4295, 'SESI-M-dg7ercews', '311', 'Hadir', ''),
  (4296, 'SESI-M-dg7ercews', '312', 'Hadir', ''),
  (4297, 'SESI-M-dg7ercews', '313', 'Sakit', ''),
  (4298, 'SESI-M-dg7ercews', '314', 'Hadir', ''),
  (4299, 'SESI-M-dg7ercews', '315', 'Sakit', ''),
  (4300, 'SESI-M-dg7ercews', '316', 'Hadir', ''),
  (4301, 'SESI-M-dg7ercews', '317', 'Sakit', ''),
  (4302, 'SESI-M-dg7ercews', '318', 'Hadir', ''),
  (4303, 'SESI-M-dg7ercews', '320', 'Hadir', ''),
  (4304, 'SESI-M-dg7ercews', '321', 'Sakit', ''),
  (4305, 'SESI-M-dg7ercews', '322', 'Hadir', ''),
  (4306, 'SESI-M-dg7ercews', '323', 'Hadir', ''),
  (4307, 'SESI-M-dg7ercews', '324', 'Hadir', ''),
  (4336, 'SESI-M-k59p1d7jp', '325', 'Hadir', ''),
  (4337, 'SESI-M-k59p1d7jp', '326', 'Hadir', ''),
  (4338, 'SESI-M-k59p1d7jp', '327', 'Hadir', ''),
  (4339, 'SESI-M-k59p1d7jp', '329', 'Hadir', ''),
  (4340, 'SESI-M-k59p1d7jp', '330', 'Hadir', ''),
  (4341, 'SESI-M-k59p1d7jp', '335', 'Hadir', ''),
  (4342, 'SESI-M-k59p1d7jp', '336', 'Hadir', ''),
  (4343, 'SESI-M-k59p1d7jp', '338', 'Hadir', ''),
  (4344, 'SESI-M-k59p1d7jp', '339', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4345, 'SESI-M-k59p1d7jp', '340', 'Hadir', ''),
  (4346, 'SESI-M-k59p1d7jp', '237', 'Hadir', ''),
  (4347, 'SESI-M-k59p1d7jp', '343', 'Hadir', ''),
  (4348, 'SESI-M-k59p1d7jp', '344', 'Hadir', ''),
  (4349, 'SESI-M-k59p1d7jp', '345', 'Hadir', ''),
  (4308, 'SESI-M-mfl2en7tb', '328', 'Hadir', ''),
  (4309, 'SESI-M-mfl2en7tb', '331', 'Hadir', ''),
  (4310, 'SESI-M-mfl2en7tb', '332', 'Hadir', ''),
  (4311, 'SESI-M-mfl2en7tb', '333', 'Hadir', ''),
  (4312, 'SESI-M-mfl2en7tb', '334', 'Hadir', ''),
  (4313, 'SESI-M-mfl2en7tb', '337', 'Hadir', ''),
  (4314, 'SESI-M-mfl2en7tb', '341', 'Hadir', ''),
  (4315, 'SESI-M-mfl2en7tb', '342', 'Hadir', ''),
  (4316, 'SESI-M-mfl2en7tb', '346', 'Hadir', ''),
  (4317, 'SESI-M-mfl2en7tb', '240', 'Hadir', ''),
  (4318, 'SESI-M-mfl2en7tb', '357', 'Hadir', ''),
  (4319, 'SESI-M-mfl2en7tb', '360', 'Hadir', ''),
  (4320, 'SESI-M-mfl2en7tb', '361', 'Hadir', ''),
  (4321, 'SESI-M-mfl2en7tb', '362', 'Hadir', ''),
  (4322, 'SESI-M-mfl2en7tb', '363', 'Hadir', ''),
  (4323, 'SESI-M-mfl2en7tb', '311', 'Hadir', ''),
  (4324, 'SESI-M-mfl2en7tb', '312', 'Hadir', ''),
  (4325, 'SESI-M-mfl2en7tb', '313', 'Hadir', ''),
  (4326, 'SESI-M-mfl2en7tb', '314', 'Sakit', ''),
  (4327, 'SESI-M-mfl2en7tb', '315', 'Hadir', ''),
  (4328, 'SESI-M-mfl2en7tb', '316', 'Hadir', ''),
  (4329, 'SESI-M-mfl2en7tb', '317', 'Hadir', ''),
  (4330, 'SESI-M-mfl2en7tb', '318', 'Hadir', ''),
  (4331, 'SESI-M-mfl2en7tb', '320', 'Hadir', ''),
  (4332, 'SESI-M-mfl2en7tb', '321', 'Hadir', ''),
  (4333, 'SESI-M-mfl2en7tb', '322', 'Hadir', ''),
  (4334, 'SESI-M-mfl2en7tb', '323', 'Hadir', ''),
  (4335, 'SESI-M-mfl2en7tb', '324', 'Hadir', ''),
  (4350, 'SESI-M-k59p1d7jp', '347', 'Hadir', ''),
  (4351, 'SESI-M-k59p1d7jp', '348', 'Hadir', ''),
  (4352, 'SESI-M-k59p1d7jp', '349', 'Hadir', ''),
  (4353, 'SESI-M-k59p1d7jp', '350', 'Hadir', ''),
  (4354, 'SESI-M-k59p1d7jp', '351', 'Hadir', ''),
  (4355, 'SESI-M-k59p1d7jp', '352', 'Hadir', ''),
  (4356, 'SESI-M-k59p1d7jp', '353', 'Hadir', ''),
  (4104, 'SESI-M-ezzb1qclp', 'XI3-1', 'Izin', ''),
  (4105, 'SESI-M-ezzb1qclp', 'XI3-2', 'Hadir', ''),
  (4106, 'SESI-M-ezzb1qclp', 'XI3-3', 'Hadir', ''),
  (4107, 'SESI-M-ezzb1qclp', 'XI3-4', 'Hadir', ''),
  (4108, 'SESI-M-ezzb1qclp', 'XI3-5', 'Hadir', ''),
  (4109, 'SESI-M-ezzb1qclp', 'XI3-6', 'Hadir', ''),
  (4110, 'SESI-M-ezzb1qclp', 'XI3-7', 'Sakit', ''),
  (4111, 'SESI-M-ezzb1qclp', 'XI3-8', 'Sakit', ''),
  (4112, 'SESI-M-ezzb1qclp', 'XI3-9', 'Hadir', ''),
  (4113, 'SESI-M-ezzb1qclp', 'XI3-10', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4114, 'SESI-M-ezzb1qclp', 'XI3-11', 'Hadir', ''),
  (4115, 'SESI-M-ezzb1qclp', 'XI3-12', 'Hadir', ''),
  (4116, 'SESI-M-ezzb1qclp', 'XI3-13', 'Hadir', ''),
  (4117, 'SESI-M-ezzb1qclp', 'XI3-14', 'Hadir', ''),
  (4118, 'SESI-M-ezzb1qclp', 'XI3-15', 'Hadir', ''),
  (4119, 'SESI-M-ezzb1qclp', 'XI3-16', 'Hadir', ''),
  (4120, 'SESI-M-ezzb1qclp', 'XI3-17', 'Hadir', ''),
  (4121, 'SESI-M-ezzb1qclp', 'XI3-18', 'Hadir', ''),
  (4122, 'SESI-M-ezzb1qclp', 'XI3-19', 'Izin', ''),
  (4123, 'SESI-M-ezzb1qclp', 'XI3-20', 'Hadir', ''),
  (4124, 'SESI-M-ezzb1qclp', 'XI3-21', 'Hadir', ''),
  (4125, 'SESI-M-ezzb1qclp', 'XI3-22', 'Hadir', ''),
  (4126, 'SESI-M-ezzb1qclp', 'XI3-23', 'Hadir', ''),
  (4127, 'SESI-M-ezzb1qclp', 'XI3-24', 'Hadir', ''),
  (4128, 'SESI-M-ezzb1qclp', 'XI3-25', 'Hadir', ''),
  (4129, 'SESI-M-ezzb1qclp', 'XI3-26', 'Hadir', ''),
  (4130, 'SESI-M-ezzb1qclp', 'XI3-27', 'Izin', ''),
  (4131, 'SESI-M-ezzb1qclp', 'XI3-28', 'Hadir', ''),
  (4132, 'SESI-M-ezzb1qclp', 'XI3-29', 'Hadir', ''),
  (4133, 'SESI-M-ezzb1qclp', 'XI3-30', 'Hadir', ''),
  (4134, 'SESI-M-ezzb1qclp', 'XI3-31', 'Hadir', ''),
  (4135, 'SESI-M-ezzb1qclp', 'XI3-32', 'Hadir', ''),
  (4136, 'SESI-M-ezzb1qclp', 'XI3-33', 'Sakit', ''),
  (4137, 'SESI-M-ezzb1qclp', 'XI3-34', 'Hadir', ''),
  (4138, 'SESI-M-ezzb1qclp', 'XI3-35', 'Hadir', ''),
  (4139, 'SESI-M-ezzb1qclp', 'XI3-36', 'Hadir', ''),
  (4140, 'SESI-M-ezzb1qclp', 'XI3-37', 'Hadir', ''),
  (4357, 'SESI-M-k59p1d7jp', '354', 'Hadir', ''),
  (4358, 'SESI-M-k59p1d7jp', '355', 'Sakit', ''),
  (4359, 'SESI-M-k59p1d7jp', 'XII-1784137806982-wz863', 'Hadir', ''),
  (4360, 'SESI-M-k59p1d7jp', '358', 'Hadir', ''),
  (4361, 'SESI-M-k59p1d7jp', '359', 'Hadir', ''),
  (4362, 'SESI-M-k59p1d7jp', '364', 'Hadir', ''),
  (4363, 'SESI-M-k59p1d7jp', '365', 'Hadir', ''),
  (4364, 'SESI-M-k59p1d7jp', '366', 'Hadir', ''),
  (4365, 'SESI-M-k59p1d7jp', '367', 'Hadir', ''),
  (4366, 'SESI-M-sa2k93fht', '284', 'Hadir', ''),
  (4367, 'SESI-M-sa2k93fht', '285', 'Sakit', ''),
  (4368, 'SESI-M-sa2k93fht', 'XII-1784137806982-oubco', 'Hadir', ''),
  (4369, 'SESI-M-sa2k93fht', '287', 'Alpa', ''),
  (4370, 'SESI-M-sa2k93fht', '288', 'Hadir', ''),
  (4371, 'SESI-M-sa2k93fht', '289', 'Hadir', ''),
  (4372, 'SESI-M-sa2k93fht', '290', 'Hadir', ''),
  (4373, 'SESI-M-sa2k93fht', '291', 'Hadir', ''),
  (4374, 'SESI-M-sa2k93fht', '292', 'Hadir', ''),
  (4375, 'SESI-M-sa2k93fht', '293', 'Hadir', ''),
  (4253, 'SESI-M-jeoi9gkft', '256', 'Hadir', ''),
  (4254, 'SESI-M-jeoi9gkft', '257', 'Hadir', ''),
  (4255, 'SESI-M-jeoi9gkft', '258', 'Sakit', ''),
  (4256, 'SESI-M-jeoi9gkft', '259', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4257, 'SESI-M-jeoi9gkft', '260', 'Hadir', ''),
  (4258, 'SESI-M-jeoi9gkft', '261', 'Hadir', ''),
  (4259, 'SESI-M-jeoi9gkft', '262', 'Hadir', ''),
  (4260, 'SESI-M-jeoi9gkft', '263', 'Hadir', ''),
  (4261, 'SESI-M-jeoi9gkft', '264', 'Alpa', ''),
  (4262, 'SESI-M-jeoi9gkft', '265', 'Hadir', ''),
  (4263, 'SESI-M-jeoi9gkft', '266', 'Izin', ''),
  (4264, 'SESI-M-jeoi9gkft', '268', 'Hadir', ''),
  (4265, 'SESI-M-jeoi9gkft', '269', 'Hadir', ''),
  (4266, 'SESI-M-jeoi9gkft', '270', 'Hadir', ''),
  (4267, 'SESI-M-jeoi9gkft', '271', 'Hadir', ''),
  (4268, 'SESI-M-jeoi9gkft', '272', 'Hadir', ''),
  (4269, 'SESI-M-jeoi9gkft', 'XII-1784137806982-tlx1p', 'Sakit', ''),
  (4270, 'SESI-M-jeoi9gkft', '273', 'Hadir', ''),
  (4271, 'SESI-M-jeoi9gkft', '274', 'Hadir', ''),
  (4272, 'SESI-M-jeoi9gkft', '275', 'Hadir', ''),
  (4273, 'SESI-M-jeoi9gkft', '276', 'Hadir', ''),
  (4274, 'SESI-M-jeoi9gkft', '277', 'Sakit', ''),
  (4275, 'SESI-M-jeoi9gkft', '278', 'Hadir', ''),
  (4276, 'SESI-M-jeoi9gkft', '279', 'Hadir', ''),
  (4277, 'SESI-M-jeoi9gkft', '280', 'Hadir', ''),
  (4278, 'SESI-M-jeoi9gkft', '281', 'Hadir', ''),
  (4279, 'SESI-M-jeoi9gkft', '283', 'Hadir', ''),
  (4376, 'SESI-M-sa2k93fht', '294', 'Hadir', ''),
  (4377, 'SESI-M-sa2k93fht', '295', 'Hadir', ''),
  (4378, 'SESI-M-sa2k93fht', '296', 'Alpa', ''),
  (4379, 'SESI-M-sa2k93fht', '297', 'Hadir', ''),
  (4380, 'SESI-M-sa2k93fht', '298', 'Hadir', ''),
  (4381, 'SESI-M-sa2k93fht', '299', 'Sakit', ''),
  (4382, 'SESI-M-sa2k93fht', '300', 'Hadir', ''),
  (4383, 'SESI-M-sa2k93fht', '301', 'Hadir', ''),
  (4384, 'SESI-M-sa2k93fht', '302', 'Hadir', ''),
  (4385, 'SESI-M-sa2k93fht', '303', 'Hadir', ''),
  (4386, 'SESI-M-sa2k93fht', '304', 'Hadir', ''),
  (4387, 'SESI-M-sa2k93fht', '305', 'Hadir', ''),
  (4388, 'SESI-M-sa2k93fht', '306', 'Sakit', ''),
  (4389, 'SESI-M-sa2k93fht', '307', 'Hadir', ''),
  (4390, 'SESI-M-sa2k93fht', '308', 'Hadir', ''),
  (4391, 'SESI-M-sa2k93fht', '309', 'Alpa', ''),
  (4392, 'SESI-M-sa2k93fht', '310', 'Hadir', ''),
  (4393, 'SESI-M-sa2k93fht', '319', 'Hadir', ''),
  (4394, 'SESI-M-y4azn80bd', 'XI1-1', 'Hadir', ''),
  (4395, 'SESI-M-y4azn80bd', 'XI1-2', 'Hadir', ''),
  (4396, 'SESI-M-y4azn80bd', 'XI1-3', 'Sakit', ''),
  (4397, 'SESI-M-y4azn80bd', 'XI1-4', 'Hadir', ''),
  (4398, 'SESI-M-y4azn80bd', 'XI1-5', 'Hadir', ''),
  (4399, 'SESI-M-y4azn80bd', 'XI1-6', 'Hadir', ''),
  (4400, 'SESI-M-y4azn80bd', 'XI1-7', 'Hadir', ''),
  (4401, 'SESI-M-y4azn80bd', 'XI1-8', 'Hadir', ''),
  (4402, 'SESI-M-y4azn80bd', 'XI1-9', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4403, 'SESI-M-y4azn80bd', 'XI1-10', 'Hadir', ''),
  (4404, 'SESI-M-y4azn80bd', 'XI1-11', 'Hadir', ''),
  (4405, 'SESI-M-y4azn80bd', 'XI1-12', 'Izin', ''),
  (4406, 'SESI-M-y4azn80bd', 'XI1-13', 'Hadir', ''),
  (4407, 'SESI-M-y4azn80bd', 'XI1-15', 'Hadir', ''),
  (4408, 'SESI-M-y4azn80bd', 'XI1-16', 'Hadir', ''),
  (4409, 'SESI-M-y4azn80bd', 'XI1-14', 'Hadir', ''),
  (4410, 'SESI-M-y4azn80bd', 'XI1-17', 'Hadir', ''),
  (4411, 'SESI-M-y4azn80bd', 'XI1-18', 'Hadir', ''),
  (4412, 'SESI-M-y4azn80bd', 'XI1-19', 'Izin', ''),
  (4413, 'SESI-M-y4azn80bd', 'XI1-20', 'Hadir', ''),
  (4414, 'SESI-M-y4azn80bd', 'XI1-21', 'Izin', ''),
  (4415, 'SESI-M-y4azn80bd', 'XI1-22', 'Hadir', ''),
  (4416, 'SESI-M-y4azn80bd', 'XI1-23', 'Hadir', ''),
  (4417, 'SESI-M-y4azn80bd', 'XI1-24', 'Izin', ''),
  (4418, 'SESI-M-y4azn80bd', 'XI1-25', 'Hadir', ''),
  (4419, 'SESI-M-y4azn80bd', 'XI1-26', 'Sakit', ''),
  (4420, 'SESI-M-y4azn80bd', 'XI1-27', 'Hadir', ''),
  (4421, 'SESI-M-y4azn80bd', 'XI1-28', 'Sakit', ''),
  (4450, 'SESI-M-elr40i66k', '284', 'Hadir', ''),
  (4451, 'SESI-M-elr40i66k', '285', 'Alpa', ''),
  (4452, 'SESI-M-elr40i66k', 'XII-1784137806982-oubco', 'Hadir', ''),
  (4453, 'SESI-M-elr40i66k', '287', 'Alpa', ''),
  (4454, 'SESI-M-elr40i66k', '288', 'Sakit', ''),
  (4455, 'SESI-M-elr40i66k', '289', 'Hadir', ''),
  (4456, 'SESI-M-elr40i66k', '290', 'Hadir', ''),
  (4457, 'SESI-M-elr40i66k', '291', 'Hadir', ''),
  (4458, 'SESI-M-elr40i66k', '292', 'Hadir', 'Telat'),
  (4459, 'SESI-M-elr40i66k', '293', 'Hadir', ''),
  (4460, 'SESI-M-elr40i66k', '294', 'Alpa', ''),
  (4461, 'SESI-M-elr40i66k', '295', 'Hadir', ''),
  (4462, 'SESI-M-elr40i66k', '296', 'Sakit', ''),
  (4463, 'SESI-M-elr40i66k', '297', 'Hadir', ''),
  (4464, 'SESI-M-elr40i66k', '298', 'Sakit', ''),
  (4465, 'SESI-M-elr40i66k', '299', 'Hadir', ''),
  (4466, 'SESI-M-elr40i66k', '300', 'Hadir', ''),
  (4467, 'SESI-M-elr40i66k', '301', 'Hadir', ''),
  (4468, 'SESI-M-elr40i66k', '302', 'Hadir', ''),
  (4469, 'SESI-M-elr40i66k', '303', 'Hadir', ''),
  (4470, 'SESI-M-elr40i66k', '304', 'Sakit', ''),
  (4471, 'SESI-M-elr40i66k', '305', 'Alpa', ''),
  (4472, 'SESI-M-elr40i66k', '306', 'Alpa', ''),
  (4473, 'SESI-M-elr40i66k', '307', 'Hadir', ''),
  (4474, 'SESI-M-elr40i66k', '308', 'Izin', 'Ngerawat sakit'),
  (4475, 'SESI-M-elr40i66k', '309', 'Sakit', ''),
  (4476, 'SESI-M-elr40i66k', '310', 'Hadir', ''),
  (4477, 'SESI-M-elr40i66k', '319', 'Hadir', ''),
  (4478, 'SESI-M-sm9huwbfr', 'XI5-1', 'Hadir', ''),
  (4479, 'SESI-M-sm9huwbfr', 'XI5-2', 'Sakit', ''),
  (4480, 'SESI-M-sm9huwbfr', 'XI5-3', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4481, 'SESI-M-sm9huwbfr', 'XI5-4', 'Hadir', ''),
  (4482, 'SESI-M-sm9huwbfr', 'XI5-5', 'Hadir', ''),
  (4483, 'SESI-M-sm9huwbfr', 'XI5-6', 'Hadir', ''),
  (4484, 'SESI-M-sm9huwbfr', 'XI5-7', 'Sakit', 'Pulang '),
  (4485, 'SESI-M-sm9huwbfr', 'XI5-8', 'Hadir', ''),
  (4486, 'SESI-M-sm9huwbfr', 'XI5-9', 'Hadir', ''),
  (4487, 'SESI-M-sm9huwbfr', 'XI5-10', 'Hadir', ''),
  (4488, 'SESI-M-sm9huwbfr', 'XI5-11', 'Hadir', ''),
  (4489, 'SESI-M-sm9huwbfr', 'XI5-12', 'Hadir', ''),
  (4490, 'SESI-M-sm9huwbfr', 'XI5-14', 'Hadir', ''),
  (4491, 'SESI-M-sm9huwbfr', 'XI5-15', 'Hadir', ''),
  (4492, 'SESI-M-sm9huwbfr', 'XI5-16', 'Hadir', ''),
  (4493, 'SESI-M-sm9huwbfr', 'XI5-17', 'Hadir', ''),
  (4494, 'SESI-M-sm9huwbfr', 'XI5-13', 'Hadir', ''),
  (4495, 'SESI-M-sm9huwbfr', 'XI5-18', 'Hadir', ''),
  (4496, 'SESI-M-sm9huwbfr', 'XI5-19', 'Hadir', ''),
  (4497, 'SESI-M-sm9huwbfr', 'XI5-20', 'Hadir', ''),
  (4498, 'SESI-M-sm9huwbfr', 'XI5-21', 'Hadir', ''),
  (4499, 'SESI-M-sm9huwbfr', 'XI5-22', 'Hadir', ''),
  (4500, 'SESI-M-sm9huwbfr', 'XI5-23', 'Hadir', ''),
  (4501, 'SESI-M-sm9huwbfr', 'XI5-25', 'Hadir', ''),
  (4502, 'SESI-M-sm9huwbfr', 'XI5-26', 'Hadir', ''),
  (4503, 'SESI-M-sm9huwbfr', 'XI5-27', 'Hadir', ''),
  (4504, 'SESI-M-sm9huwbfr', 'XI5-28', 'Hadir', ''),
  (4505, 'SESI-M-sm9huwbfr', 'XI5-29', 'Hadir', ''),
  (4506, 'SESI-M-sm9huwbfr', 'XI5-30', 'Hadir', ''),
  (4507, 'SESI-M-sm9huwbfr', 'XI5-31', 'Hadir', ''),
  (4508, 'SESI-M-sm9huwbfr', 'XI5-32', 'Hadir', ''),
  (4509, 'SESI-M-sm9huwbfr', 'XI5-33', 'Hadir', ''),
  (4510, 'SESI-M-sm9huwbfr', 'XI5-24', 'Hadir', ''),
  (4511, 'SESI-M-sm9huwbfr', 'XI5-34', 'Hadir', ''),
  (4512, 'SESI-M-sm9huwbfr', 'XI5-35', 'Hadir', ''),
  (4513, 'SESI-M-sm9huwbfr', 'XI5-36', 'Hadir', ''),
  (4514, 'SESI-M-781izyyzf', 'XI4-1', 'Hadir', ''),
  (4515, 'SESI-M-781izyyzf', 'XI4-2', 'Hadir', ''),
  (4516, 'SESI-M-781izyyzf', 'XI4-3', 'Hadir', ''),
  (4517, 'SESI-M-781izyyzf', 'XI4-4', 'Hadir', ''),
  (4518, 'SESI-M-781izyyzf', 'XI4-5', 'Hadir', ''),
  (4519, 'SESI-M-781izyyzf', 'XI4-6', 'Hadir', ''),
  (4520, 'SESI-M-781izyyzf', 'XI4-7', 'Hadir', ''),
  (4521, 'SESI-M-781izyyzf', 'XI4-8', 'Hadir', ''),
  (4522, 'SESI-M-781izyyzf', 'XI4-9', 'Hadir', ''),
  (4523, 'SESI-M-781izyyzf', 'XI4-12', 'Hadir', ''),
  (4524, 'SESI-M-781izyyzf', 'XI4-13', 'Sakit', ''),
  (4525, 'SESI-M-781izyyzf', 'XI4-14', 'Hadir', ''),
  (4526, 'SESI-M-781izyyzf', 'XI4-15', 'Hadir', ''),
  (4527, 'SESI-M-781izyyzf', 'XI4-16', 'Hadir', ''),
  (4528, 'SESI-M-781izyyzf', 'XI4-17', 'Hadir', ''),
  (4529, 'SESI-M-781izyyzf', 'XI4-18', 'Hadir', ''),
  (4530, 'SESI-M-781izyyzf', 'XI4-19', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4531, 'SESI-M-781izyyzf', 'XI4-20', 'Hadir', ''),
  (4532, 'SESI-M-781izyyzf', 'XI4-21', 'Hadir', ''),
  (4533, 'SESI-M-781izyyzf', 'XI4-22', 'Hadir', ''),
  (4534, 'SESI-M-781izyyzf', 'XI4-23', 'Hadir', ''),
  (4535, 'SESI-M-781izyyzf', 'XI4-24', 'Hadir', ''),
  (4536, 'SESI-M-781izyyzf', 'XI4-10', 'Hadir', ''),
  (4537, 'SESI-M-781izyyzf', 'XI4-25', 'Hadir', ''),
  (4538, 'SESI-M-781izyyzf', 'XI4-26', 'Sakit', ''),
  (4539, 'SESI-M-781izyyzf', 'XI4-27', 'Hadir', ''),
  (4540, 'SESI-M-781izyyzf', 'XI4-28', 'Hadir', ''),
  (4541, 'SESI-M-781izyyzf', 'XI4-29', 'Hadir', ''),
  (4542, 'SESI-M-781izyyzf', 'XI4-11', 'Hadir', ''),
  (4543, 'SESI-M-781izyyzf', 'XI4-30', 'Hadir', ''),
  (4544, 'SESI-M-781izyyzf', 'XI4-31', 'Hadir', ''),
  (4545, 'SESI-M-781izyyzf', 'XI4-32', 'Hadir', ''),
  (4546, 'SESI-M-781izyyzf', 'XI4-33', 'Hadir', ''),
  (4547, 'SESI-M-781izyyzf', 'XI4-34', 'Hadir', ''),
  (4548, 'SESI-M-781izyyzf', 'XI4-35', 'Hadir', ''),
  (4553, 'SESI-M-ak140ruzz', 'XI3-1', 'Hadir', ''),
  (4554, 'SESI-M-ak140ruzz', 'XI3-2', 'Hadir', ''),
  (4555, 'SESI-M-ak140ruzz', 'XI3-3', 'Hadir', ''),
  (4556, 'SESI-M-ak140ruzz', 'XI3-4', 'Hadir', ''),
  (4557, 'SESI-M-ak140ruzz', 'XI3-5', 'Hadir', ''),
  (4558, 'SESI-M-ak140ruzz', 'XI3-6', 'Hadir', ''),
  (4559, 'SESI-M-ak140ruzz', 'XI3-7', 'Hadir', ''),
  (4560, 'SESI-M-ak140ruzz', 'XI3-8', 'Hadir', ''),
  (4561, 'SESI-M-ak140ruzz', 'XI3-9', 'Hadir', ''),
  (4562, 'SESI-M-ak140ruzz', 'XI3-10', 'Hadir', ''),
  (4563, 'SESI-M-ak140ruzz', 'XI3-11', 'Hadir', ''),
  (4564, 'SESI-M-ak140ruzz', 'XI3-12', 'Hadir', ''),
  (4565, 'SESI-M-ak140ruzz', 'XI3-13', 'Hadir', ''),
  (4566, 'SESI-M-ak140ruzz', 'XI3-14', 'Hadir', ''),
  (4567, 'SESI-M-ak140ruzz', 'XI3-15', 'Hadir', ''),
  (4568, 'SESI-M-ak140ruzz', 'XI3-16', 'Sakit', ''),
  (4569, 'SESI-M-ak140ruzz', 'XI3-17', 'Hadir', ''),
  (4570, 'SESI-M-ak140ruzz', 'XI3-18', 'Hadir', ''),
  (4571, 'SESI-M-ak140ruzz', 'XI3-19', 'Hadir', ''),
  (4572, 'SESI-M-ak140ruzz', 'XI3-20', 'Hadir', ''),
  (4573, 'SESI-M-ak140ruzz', 'XI3-21', 'Hadir', ''),
  (4574, 'SESI-M-ak140ruzz', 'XI3-22', 'Hadir', ''),
  (4575, 'SESI-M-ak140ruzz', 'XI3-23', 'Hadir', ''),
  (4576, 'SESI-M-ak140ruzz', 'XI3-24', 'Hadir', ''),
  (4577, 'SESI-M-ak140ruzz', 'XI3-25', 'Hadir', ''),
  (4578, 'SESI-M-ak140ruzz', 'XI3-26', 'Hadir', ''),
  (4579, 'SESI-M-ak140ruzz', 'XI3-27', 'Hadir', ''),
  (4580, 'SESI-M-ak140ruzz', 'XI3-28', 'Hadir', ''),
  (4581, 'SESI-M-ak140ruzz', 'XI3-29', 'Hadir', ''),
  (4582, 'SESI-M-ak140ruzz', 'XI3-30', 'Hadir', ''),
  (4583, 'SESI-M-ak140ruzz', 'XI3-31', 'Hadir', ''),
  (4584, 'SESI-M-ak140ruzz', 'XI3-32', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4585, 'SESI-M-ak140ruzz', 'XI3-33', 'Hadir', ''),
  (4586, 'SESI-M-ak140ruzz', 'XI3-34', 'Hadir', ''),
  (4587, 'SESI-M-ak140ruzz', 'XI3-35', 'Hadir', ''),
  (4588, 'SESI-M-ak140ruzz', 'XI3-36', 'Hadir', ''),
  (4589, 'SESI-M-ak140ruzz', 'XI3-37', 'Hadir', ''),
  (4618, 'SESI-M-xt2xs2gp6', '284', 'Hadir', ''),
  (4619, 'SESI-M-xt2xs2gp6', '285', 'Hadir', ''),
  (4620, 'SESI-M-xt2xs2gp6', 'XII-1784137806982-oubco', 'Hadir', ''),
  (4621, 'SESI-M-xt2xs2gp6', '287', 'Alpa', ''),
  (4622, 'SESI-M-xt2xs2gp6', '288', 'Izin', 'Pulang '),
  (4623, 'SESI-M-xt2xs2gp6', '289', 'Hadir', 'Telat '),
  (4624, 'SESI-M-xt2xs2gp6', '290', 'Hadir', ''),
  (4625, 'SESI-M-xt2xs2gp6', '291', 'Izin', 'Pulang'),
  (4626, 'SESI-M-xt2xs2gp6', '292', 'Alpa', ''),
  (4627, 'SESI-M-xt2xs2gp6', '293', 'Hadir', ''),
  (4628, 'SESI-M-xt2xs2gp6', '294', 'Hadir', ''),
  (4629, 'SESI-M-xt2xs2gp6', '295', 'Hadir', ''),
  (4630, 'SESI-M-xt2xs2gp6', '296', 'Alpa', ''),
  (4631, 'SESI-M-xt2xs2gp6', '297', 'Alpa', ''),
  (4632, 'SESI-M-xt2xs2gp6', '298', 'Alpa', ''),
  (4633, 'SESI-M-xt2xs2gp6', '299', 'Hadir', ''),
  (4634, 'SESI-M-xt2xs2gp6', '300', 'Alpa', ''),
  (4635, 'SESI-M-xt2xs2gp6', '301', 'Hadir', ''),
  (4636, 'SESI-M-xt2xs2gp6', '302', 'Alpa', ''),
  (4637, 'SESI-M-xt2xs2gp6', '303', 'Hadir', ''),
  (4638, 'SESI-M-xt2xs2gp6', '304', 'Hadir', ''),
  (4639, 'SESI-M-xt2xs2gp6', '305', 'Hadir', ''),
  (4640, 'SESI-M-xt2xs2gp6', '306', 'Alpa', ''),
  (4641, 'SESI-M-xt2xs2gp6', '307', 'Hadir', ''),
  (4642, 'SESI-M-xt2xs2gp6', '308', 'Hadir', ''),
  (4643, 'SESI-M-xt2xs2gp6', '309', 'Alpa', ''),
  (4644, 'SESI-M-xt2xs2gp6', '310', 'Hadir', ''),
  (4645, 'SESI-M-xt2xs2gp6', '319', 'Hadir', ''),
  (4650, 'SESI-M-n383jxmpj', 'SIS-178474614301545', 'Hadir', ''),
  (4651, 'SESI-M-n383jxmpj', 'SIS-179145936408236', 'Hadir', 'tel'),
  (4652, 'SESI-M-n383jxmpj', 'SIS-179145937756077', 'Hadir', ''),
  (4653, 'SESI-M-n383jxmpj', 'SIS-179145938994792', 'Hadir', ''),
  (4654, 'SESI-M-expttkfyl', 'XI1-1', 'Hadir', ''),
  (4655, 'SESI-M-expttkfyl', 'XI1-2', 'Hadir', ''),
  (4656, 'SESI-M-expttkfyl', 'XI1-3', 'Hadir', ''),
  (4657, 'SESI-M-expttkfyl', 'XI1-4', 'Hadir', ''),
  (4658, 'SESI-M-expttkfyl', 'XI1-5', 'Hadir', ''),
  (4659, 'SESI-M-expttkfyl', 'XI1-6', 'Hadir', ''),
  (4660, 'SESI-M-expttkfyl', 'XI1-7', 'Hadir', ''),
  (4661, 'SESI-M-expttkfyl', 'XI1-8', 'Hadir', ''),
  (4662, 'SESI-M-expttkfyl', 'XI1-9', 'Hadir', ''),
  (4663, 'SESI-M-expttkfyl', 'XI1-10', 'Hadir', ''),
  (4664, 'SESI-M-expttkfyl', 'XI1-11', 'Hadir', ''),
  (4665, 'SESI-M-expttkfyl', 'XI1-12', 'Hadir', ''),
  (4666, 'SESI-M-expttkfyl', 'XI1-13', 'Hadir', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.absensi_mapel_siswa ("id", "sesi_id", "siswa_id", "status", "keterangan")
VALUES
  (4667, 'SESI-M-expttkfyl', 'XI1-15', 'Hadir', ''),
  (4668, 'SESI-M-expttkfyl', 'XI1-16', 'Hadir', ''),
  (4669, 'SESI-M-expttkfyl', 'XI1-14', 'Hadir', ''),
  (4670, 'SESI-M-expttkfyl', 'XI1-17', 'Hadir', ''),
  (4671, 'SESI-M-expttkfyl', 'XI1-18', 'Hadir', ''),
  (4672, 'SESI-M-expttkfyl', 'XI1-19', 'Hadir', ''),
  (4673, 'SESI-M-expttkfyl', 'XI1-20', 'Hadir', ''),
  (4674, 'SESI-M-expttkfyl', 'XI1-21', 'Hadir', ''),
  (4675, 'SESI-M-expttkfyl', 'XI1-22', 'Hadir', ''),
  (4676, 'SESI-M-expttkfyl', 'XI1-23', 'Hadir', ''),
  (4677, 'SESI-M-expttkfyl', 'XI1-24', 'Hadir', ''),
  (4678, 'SESI-M-expttkfyl', 'XI1-25', 'Hadir', ''),
  (4679, 'SESI-M-expttkfyl', 'XI1-26', 'Hadir', ''),
  (4680, 'SESI-M-expttkfyl', 'XI1-27', 'Hadir', ''),
  (4681, 'SESI-M-expttkfyl', 'XI1-28', 'Hadir', '')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.nilai_tugas (20 baris)
-- =====================================================
INSERT INTO public.nilai_tugas ("tugas_id", "guru_id", "kategori", "type", "deskripsi", "kelas", "mapel", "tanggal", "created_at", "tahun_ajar", "semester", "mode_penilaian", "total_soal", "skala_maks", "pembulatan")
VALUES
  ('TGS-ONLINE-239LS6-XI 4', 'UID-1779817062842YOUA', 'Pengetahuan', 'Formatif', 'Mesin Pencari', 'XI 4', 'Informatika', '2026-08-06', '2026-08-06T04:25:25.461715+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1786240984485-db4nl', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XII 2', 'Informatika', '2026-08-09', '2026-08-09T02:03:06.290999+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1786328724221-flp8e', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XII 5', 'Informatika', '2026-08-10', '2026-08-10T02:25:25.721712+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1786336371937-7g523', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XII 4', 'Informatika', '2026-08-10', '2026-08-10T04:32:53.713805+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1787372123928-fvkgj', 'UID-1779817062842YOUA', 'Mari berlatih bab 1 ', 'Formatif', '', 'XI 1', 'Informatika', '2026-08-22', '2026-08-22T04:15:24.11503+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1787491430175-f1z2g', 'UID-1779817062842YOUA', 'SUMATIF BAB 1', 'Sumatif', '', 'XI 1', 'Informatika', '2026-08-21', '2026-08-23T13:23:53.185106+00:00', '2026/2027', 1, 'jumlah_benar', 20, 100, 'decimal_1'),
  ('TGS-1787806412030-ce8xp', 'UID-1779817062842YOUA', 'Sumatif bab 1', 'Sumatif', '', 'XI 4', 'Informatika', '2026-08-27', '2026-08-27T04:53:32.603817+00:00', '2026/2027', 1, 'langsung', 25, 100, 'decimal_1'),
  ('TGS-1788580989089-2q0cx', 'UID-1779817062842YOUA', 'Informasi Digital ', 'Sumatif', '', 'XI 3', 'Informatika', '2026-09-05', '2026-09-05T04:03:09.909263+00:00', '2026/2027', 1, 'langsung', 20, 100, 'decimal_1'),
  ('TGS-1788053979488-xoddh', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XI 2', 'Informatika', '2026-08-30', '2026-08-30T01:39:40.04807+00:00', '2026/2027', 1, 'jumlah_benar', 20, 100, 'decimal_1'),
  ('TGS-1785805460073-sfa2e', 'UID-1779817062842YOUA', 'Ide IoT', 'Formatif', '', 'XII 1', 'Informatika', '2026-08-04', '2026-08-04T01:04:21.214721+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1785807186461-pj1sb', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XII 1', 'Informatika', '2026-08-04', '2026-08-04T01:33:08.369133+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-GRP-GRP-MUK3IGLM', 'UID-1779817062842YOUA', 'TEST', 'Formatif', 'tugas kelompok', 'XI 1', 'Informatika', '2026-09-27', '2026-09-27T17:32:14.901484+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1785817198174-4qw7n', 'UID-1779817062842YOUA', 'Sumatif bab 1 ', 'Sumatif', '', 'XII 3', 'Informatika', '2026-08-04', '2026-08-04T04:19:59.34409+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-GRP-GRP-MUHV7ISF', 'UID-1779817062842YOUA', 'ANALISIS DATA', 'Formatif', 'Tugas Kelompok', 'XI 1', 'Informatika', '2026-09-28', '2026-09-28T16:23:27.434856+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-GRP-GRP-MUEVMZDU', 'UID-1779817062842YOUA', 'ANALISIS DATA', 'Formatif', 'Kelompok', 'XI 5', 'Informatika', '2026-09-28', '2026-09-28T17:53:07.243812+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-ONLINE-239LS6-XI 5', 'UID-1779817062842YOUA', 'Pengetahuan', 'Formatif', 'Mesin Pencari', 'XI 5', 'Informatika', '2026-08-06', '2026-08-06T02:22:42.97448+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1791540562495-f2quw', 'UID-1779817062842YOUA', 'Test', 'Formatif', '', 'Test', 'Informatika', '2026-10-09', '2026-10-09T10:09:27.104012+00:00', '2026/2027', 1, 'langsung', 25, 100, 'decimal_1'),
  ('TGS-GRP-GRP-MUS86QWS', 'UID-1779817062842YOUA', 'ANALISIS DATA', 'Tugas Kelompok', '', 'XI 3', 'Informatika', '2026-10-03', '2026-10-03T11:32:07.750617+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-GRP-GRP-MUJ44J2N', 'UID-1779817062842YOUA', 'SISTEM KOMPUTER', 'Formatif', 'Tugas kelompok analisis dan algoritma komputer', 'XII 2', 'Informatika', '2026-10-09', '2026-10-09T14:25:47.572345+00:00', '2026/2027', 1, 'langsung', 100, 100, 'decimal_1'),
  ('TGS-1781659392252-h8gtm', 'UID-1779817062842YOUA', 'hf', 'Formatif', '', 'XI 1', 'Informatika', '2026-06-17', '2026-10-15T04:45:37.772585+00:00', '2026/2027', 1, 'langsung', 25, 100, 'decimal_1')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.nilai_siswa (471 baris)
-- =====================================================
INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (4704, 'TGS-1785805460073-sfa2e', '256', 'Agus Susanto', 100, NULL),
  (4705, 'TGS-1785805460073-sfa2e', '257', 'Ahidit Wahyudi', 100, NULL),
  (4706, 'TGS-1785805460073-sfa2e', '258', 'Alpin Sahputra', 0, NULL),
  (4707, 'TGS-1785805460073-sfa2e', '259', 'Beny Setiawan', 100, NULL),
  (4708, 'TGS-1785805460073-sfa2e', '260', 'Dedy Setiadi', 100, NULL),
  (4709, 'TGS-1785805460073-sfa2e', '261', 'Fahri Abdul Hanif', 100, NULL),
  (4710, 'TGS-1785805460073-sfa2e', '262', 'Farel Irgian Virerza', 80, NULL),
  (4711, 'TGS-1785805460073-sfa2e', '263', 'Faris Zaky Ahmadtulloh', 100, NULL),
  (4712, 'TGS-1785805460073-sfa2e', '264', 'Gigih Ali Sofyan', 0, NULL),
  (4714, 'TGS-1785805460073-sfa2e', '266', 'Julian Alfino Ferdiansyah', 0, NULL),
  (4715, 'TGS-1785805460073-sfa2e', '268', 'M. Shobirin Saputra', 100, NULL),
  (4716, 'TGS-1785805460073-sfa2e', '269', 'Maulana Ikhsan', 100, NULL),
  (4717, 'TGS-1785805460073-sfa2e', '270', 'Mohammad Raditya Pratama Irfan', 100, NULL),
  (4718, 'TGS-1785805460073-sfa2e', '271', 'Muhamad Taufik Nurhidayat', 100, NULL),
  (4719, 'TGS-1785805460073-sfa2e', '272', 'Muhamad Zikri Firmansyah', 100, NULL),
  (4720, 'TGS-1785805460073-sfa2e', 'XII-1784137806982-tlx1p', 'Muhammad Alfarizi', 0, NULL),
  (4721, 'TGS-1785805460073-sfa2e', '273', 'Muhammad Dani Alhakim', 100, NULL),
  (4722, 'TGS-1785805460073-sfa2e', '274', 'Muhammad Dhani Saputra', 100, NULL),
  (4723, 'TGS-1785805460073-sfa2e', '275', 'Naufal Ariba Yusro', 100, NULL),
  (4724, 'TGS-1785805460073-sfa2e', '276', 'Rafiq Hariri', 100, NULL),
  (4725, 'TGS-1785805460073-sfa2e', '277', 'Raka Aditya Pratama', 0, NULL),
  (4726, 'TGS-1785805460073-sfa2e', '278', 'Revan Rizki Agustian', 100, NULL),
  (4727, 'TGS-1785805460073-sfa2e', '279', 'Rhendy Ahmad Basuki', 0, NULL),
  (4728, 'TGS-1785805460073-sfa2e', '280', 'Riddho Syubkhi', 100, NULL),
  (4729, 'TGS-1785805460073-sfa2e', '281', 'Surya Pratama Fahrelliansyah', 100, NULL),
  (4730, 'TGS-1785805460073-sfa2e', '283', 'Zulfahmi Candra Ginatan', 100, NULL),
  (4713, 'TGS-1785805460073-sfa2e', '265', 'Ikhsan Yusuf Hidayat', 100, NULL),
  (4731, 'TGS-1785807186461-pj1sb', '256', 'Agus Susanto', 85, NULL),
  (4732, 'TGS-1785807186461-pj1sb', '257', 'Ahidit Wahyudi', 60, NULL),
  (4733, 'TGS-1785807186461-pj1sb', '258', 'Alpin Sahputra', 85, NULL),
  (4734, 'TGS-1785807186461-pj1sb', '259', 'Beny Setiawan', 85, NULL),
  (4735, 'TGS-1785807186461-pj1sb', '260', 'Dedy Setiadi', 85, NULL),
  (4736, 'TGS-1785807186461-pj1sb', '261', 'Fahri Abdul Hanif', 85, NULL),
  (4737, 'TGS-1785807186461-pj1sb', '262', 'Farel Irgian Virerza', 85, NULL),
  (4738, 'TGS-1785807186461-pj1sb', '263', 'Faris Zaky Ahmadtulloh', 87.5, NULL),
  (4739, 'TGS-1785807186461-pj1sb', '264', 'Gigih Ali Sofyan', 93, NULL),
  (4740, 'TGS-1785807186461-pj1sb', '265', 'Ikhsan Yusuf Hidayat', 70, NULL),
  (4741, 'TGS-1785807186461-pj1sb', '266', 'Julian Alfino Ferdiansyah', 95, NULL),
  (4742, 'TGS-1785807186461-pj1sb', '268', 'M. Shobirin Saputra', 85, NULL),
  (4743, 'TGS-1785807186461-pj1sb', '269', 'Maulana Ikhsan', 90, NULL),
  (4744, 'TGS-1785807186461-pj1sb', '270', 'Mohammad Raditya Pratama Irfan', 93.5, NULL),
  (4745, 'TGS-1785807186461-pj1sb', '271', 'Muhamad Taufik Nurhidayat', 82, NULL),
  (4746, 'TGS-1785807186461-pj1sb', '272', 'Muhamad Zikri Firmansyah', 85, NULL),
  (4747, 'TGS-1785807186461-pj1sb', 'XII-1784137806982-tlx1p', 'Muhammad Alfarizi', 85, NULL),
  (4748, 'TGS-1785807186461-pj1sb', '273', 'Muhammad Dani Alhakim', 95, NULL),
  (4749, 'TGS-1785807186461-pj1sb', '274', 'Muhammad Dhani Saputra', 0, NULL),
  (4750, 'TGS-1785807186461-pj1sb', '275', 'Naufal Ariba Yusro', 85, NULL),
  (4751, 'TGS-1785807186461-pj1sb', '276', 'Rafiq Hariri', 87, NULL),
  (4752, 'TGS-1785807186461-pj1sb', '277', 'Raka Aditya Pratama', 0, NULL),
  (4753, 'TGS-1785807186461-pj1sb', '278', 'Revan Rizki Agustian', 60, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (4754, 'TGS-1785807186461-pj1sb', '279', 'Rhendy Ahmad Basuki', 90, NULL),
  (4755, 'TGS-1785807186461-pj1sb', '280', 'Riddho Syubkhi', 90, NULL),
  (4756, 'TGS-1785807186461-pj1sb', '281', 'Surya Pratama Fahrelliansyah', 90, NULL),
  (4757, 'TGS-1785807186461-pj1sb', '283', 'Zulfahmi Candra Ginatan', 85, NULL),
  (4762, 'TGS-1785817198174-4qw7n', '334', 'Deby Etika Maharani', 0, NULL),
  (4761, 'TGS-1785817198174-4qw7n', '333', 'Bella Ayu Lestari', 85, NULL),
  (4764, 'TGS-1785817198174-4qw7n', '341', 'Irna Puji Astuti', 83, NULL),
  (4765, 'TGS-1785817198174-4qw7n', '342', 'Jenita Nur Sabila', 80, NULL),
  (4760, 'TGS-1785817198174-4qw7n', '332', 'Bela Sapitri', 79, NULL),
  (4759, 'TGS-1785817198174-4qw7n', '331', 'Aurel', 69, NULL),
  (4885, 'TGS-1786328724221-flp8e', '236', 'Intan Nailatul Izzah Ufairoh', 91.5, NULL),
  (4826, 'TGS-ONLINE-239LS6-XI 5', 'XI5-12', 'Hani Umi Latipah', 95, NULL),
  (4824, 'TGS-ONLINE-239LS6-XI 5', 'XI5-8', 'Dwi Apriyanti', 80, NULL),
  (4828, 'TGS-ONLINE-239LS6-XI 5', 'XI5-26', 'Rifa Iyyah', 100, NULL),
  (4829, 'TGS-ONLINE-239LS6-XI 5', 'XI5-31', 'Siti Nurhaliza', 100, NULL),
  (4831, 'TGS-ONLINE-239LS6-XI 4', 'XI4-18', 'Riva Anzila Rahma', 80, NULL),
  (4832, 'TGS-ONLINE-239LS6-XI 4', 'XI4-11', 'Ulfiatul Khoiroh', 100, NULL),
  (4833, 'TGS-ONLINE-239LS6-XI 4', 'XI4-14', 'Refa Putriyanti', 10, NULL),
  (4835, 'TGS-ONLINE-239LS6-XI 4', 'XI4-1', 'Nazila Rahmatika Habib', 80, NULL),
  (4836, 'TGS-ONLINE-239LS6-XI 4', 'XI4-3', 'Neva Setia Ningsih', 85, NULL),
  (4758, 'TGS-1785817198174-4qw7n', '328', 'Anisa Liswianti', 88, NULL),
  (4763, 'TGS-1785817198174-4qw7n', '337', 'Eva Azkiya Nur Rohim', 79, NULL),
  (4766, 'TGS-1785817198174-4qw7n', '346', 'Lutfiana Nursabita', 68, NULL),
  (4767, 'TGS-1785817198174-4qw7n', '240', 'Melany', 0, NULL),
  (4768, 'TGS-1785817198174-4qw7n', '357', 'Nurul Choirul Ningsih', 78, NULL),
  (4773, 'TGS-1785817198174-4qw7n', '311', 'Risma Adelia Putri', 88, NULL),
  (4775, 'TGS-1785817198174-4qw7n', '313', 'Risty Nadiyanti', 89, NULL),
  (4776, 'TGS-1785817198174-4qw7n', '314', 'Salma Nurul Fathonah', 0, NULL),
  (4777, 'TGS-1785817198174-4qw7n', '315', 'Sapwa Syahrani', 84, NULL),
  (4779, 'TGS-1785817198174-4qw7n', '317', 'Sri Ikke Rahmawati Sholeha', 92, NULL),
  (4778, 'TGS-1785817198174-4qw7n', '316', 'Sheril Rahmawati', 78, NULL),
  (4780, 'TGS-1785817198174-4qw7n', '318', 'Suci Rahmadani', 78, NULL),
  (4781, 'TGS-1785817198174-4qw7n', '320', 'Uyun Khomariyah', 92, NULL),
  (4782, 'TGS-1785817198174-4qw7n', '321', 'Vanecia Zahratun Niswa', 85, NULL),
  (4785, 'TGS-1785817198174-4qw7n', '324', 'Yelsa Yunia Putri', 97, NULL),
  (4784, 'TGS-1785817198174-4qw7n', '323', 'Yelsa Afrianti', 83, NULL),
  (4783, 'TGS-1785817198174-4qw7n', '322', 'Wirda Tusifa', 81, NULL),
  (4770, 'TGS-1785817198174-4qw7n', '361', 'Rara Zaskia Junianti', 85, NULL),
  (4772, 'TGS-1785817198174-4qw7n', '363', 'Riska Hasanah', 85, NULL),
  (4771, 'TGS-1785817198174-4qw7n', '362', 'Reni Wahyu Ulandari', 79, NULL),
  (4774, 'TGS-1785817198174-4qw7n', '312', 'Rista Novelya', 97, NULL),
  (4769, 'TGS-1785817198174-4qw7n', '360', 'Rahma Aulia', 87, NULL),
  (4837, 'TGS-ONLINE-239LS6-XI 4', 'XI4-2', 'Nazwa May Nur Winarni', 70, NULL),
  (4840, 'TGS-ONLINE-239LS6-XI 4', 'XI4-24', 'Silvi Zulia Asrofi', 70, NULL),
  (4839, 'TGS-ONLINE-239LS6-XI 4', 'XI4-6', 'Nur Indah Safitri', 80, NULL),
  (4842, 'TGS-ONLINE-239LS6-XI 4', 'XI4-4', 'Novi Nuraini', 55, NULL),
  (4851, 'TGS-1786240984485-db4nl', '287', 'Dika Pratama', 1, NULL),
  (4834, 'TGS-ONLINE-239LS6-XI 4', 'XI4-9', 'Qoonitah Simanjuntak', 50, NULL),
  (4846, 'TGS-ONLINE-239LS6-XI 4', 'XI4-8', 'Pika Mutiara', 80, NULL),
  (4847, 'TGS-ONLINE-239LS6-XI 4', 'XI4-30', 'Winnie Alenskia Sirait', 60, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (4848, 'TGS-1786240984485-db4nl', '284', 'Ahmad Izudin Ubaidillah', 58, NULL),
  (4850, 'TGS-1786240984485-db4nl', 'XII-1784137806982-oubco', 'Azhar Faris Arasyid', 80, NULL),
  (4852, 'TGS-1786240984485-db4nl', '288', 'Dimas Pasya Saputra', 86.5, NULL),
  (4853, 'TGS-1786240984485-db4nl', '289', 'Fadhil Azmy Pratama', 75, NULL),
  (4854, 'TGS-1786240984485-db4nl', '290', 'Fatku Rohman', 86.5, NULL),
  (4855, 'TGS-1786240984485-db4nl', '291', 'Fawwaz Rizaka', 80, NULL),
  (4856, 'TGS-1786240984485-db4nl', '292', 'Fergie Ikhsan', 88.5, NULL),
  (4857, 'TGS-1786240984485-db4nl', '293', 'Hakimul Adli', 63.5, NULL),
  (4858, 'TGS-1786240984485-db4nl', '294', 'Henkky Irawan Siregar', 0, NULL),
  (4859, 'TGS-1786240984485-db4nl', '295', 'Jonal Dika', 80, NULL),
  (4861, 'TGS-1786240984485-db4nl', '297', 'M. Imam Musyaffa', 86.5, NULL),
  (4862, 'TGS-1786240984485-db4nl', '298', 'Mahsun Huda', 88.5, NULL),
  (4864, 'TGS-1786240984485-db4nl', '300', 'Muhamad Maulana', 60, NULL),
  (4865, 'TGS-1786240984485-db4nl', '301', 'Muhamad Yusuf Nurasyid', 91, NULL),
  (4866, 'TGS-1786240984485-db4nl', '302', 'Muhammad Alfan As''Ari', 55, NULL),
  (4867, 'TGS-1786240984485-db4nl', '303', 'Muhammad Ali Romadhon', 62, NULL),
  (4868, 'TGS-1786240984485-db4nl', '304', 'Muhammad Burhanuddin', 47.5, NULL),
  (4869, 'TGS-1786240984485-db4nl', '305', 'Muhammad Dzaka Prawira', 89.5, NULL),
  (4871, 'TGS-1786240984485-db4nl', '307', 'Nur Abdillah Mu''Iz', 90, NULL),
  (4872, 'TGS-1786240984485-db4nl', '308', 'Pratama Aidil Fitrah', 85, NULL),
  (4874, 'TGS-1786240984485-db4nl', '310', 'Respati Bayuaji Kamajaya', 90.7, NULL),
  (4875, 'TGS-1786240984485-db4nl', '319', 'Tatong Ihsantri', 55, NULL),
  (4876, 'TGS-1786328724221-flp8e', '226', 'Anisa Avrilian Shenia', 91.5, NULL),
  (4877, 'TGS-1786328724221-flp8e', '227', 'Chika Kasih Ardana', 78, NULL),
  (4878, 'TGS-1786328724221-flp8e', '228', 'Dea Putri Rahmawati', 86.5, NULL),
  (4879, 'TGS-1786328724221-flp8e', 'XII-1784137806982-4zsm3', 'Dety Novita Liana', 83.5, NULL),
  (4880, 'TGS-1786328724221-flp8e', '230', 'Efriza Wati', 80, NULL),
  (4881, 'TGS-1786328724221-flp8e', '231', 'Erika Zola Nuraini', 84, NULL),
  (4882, 'TGS-1786328724221-flp8e', '233', 'Firni Tara Santika', 76.5, NULL),
  (4883, 'TGS-1786328724221-flp8e', '234', 'Heni Miftahul Jannah', 82, NULL),
  (4884, 'TGS-1786328724221-flp8e', '235', 'Ina Yatus Syifa', 78, NULL),
  (4873, 'TGS-1786240984485-db4nl', '309', 'Radit Devfahry', 1, NULL),
  (4870, 'TGS-1786240984485-db4nl', '306', 'Muhammad Khoirun Ni''Amy', 2, NULL),
  (4863, 'TGS-1786240984485-db4nl', '299', 'Muhamad Dwi Praditya Herianto', 2, NULL),
  (4860, 'TGS-1786240984485-db4nl', '296', 'Khoirul Anwar', 1, NULL),
  (4849, 'TGS-1786240984485-db4nl', '285', 'Alvin Pratama Imanudin', 2, NULL),
  (4886, 'TGS-1786328724221-flp8e', 'XII-1784137806982-zjpj8', 'Intan Nur Febrianti', 77, NULL),
  (4887, 'TGS-1786328724221-flp8e', '238', 'Lailatul Munawaroh', 66.5, NULL),
  (4888, 'TGS-1786328724221-flp8e', '239', 'Lusiana Maysaroh', 75, NULL),
  (4889, 'TGS-1786328724221-flp8e', 'XII-1784137806982-popjk', 'Melany', 88, NULL),
  (4890, 'TGS-1786328724221-flp8e', '241', 'Miftahus Salamah', 85, NULL),
  (4891, 'TGS-1786328724221-flp8e', '242', 'Mutia Az Zahra Mauliana R', 95, NULL),
  (4892, 'TGS-1786328724221-flp8e', '243', 'Novira Sulistia', 81.5, NULL),
  (4893, 'TGS-1786328724221-flp8e', '244', 'Nuria Aulia Gadis', 91.5, NULL),
  (4894, 'TGS-1786328724221-flp8e', 'XII-1784137806982-nzllq', 'Parida Anum', 75, NULL),
  (4895, 'TGS-1786328724221-flp8e', '245', 'Putri Natalia', 72, NULL),
  (4896, 'TGS-1786328724221-flp8e', '246', 'Ressa Clarawati', 76.5, NULL),
  (4897, 'TGS-1786328724221-flp8e', '247', 'Saufa Ajry', 90, NULL),
  (4899, 'TGS-1786328724221-flp8e', '249', 'Syafaatul Uzma Abdillah', 75, NULL),
  (4900, 'TGS-1786328724221-flp8e', '250', 'Syafika Khoerunnisa', 75, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (4901, 'TGS-1786328724221-flp8e', '251', 'Syifa Salsabila Mahfud', 1, NULL),
  (4902, 'TGS-1786328724221-flp8e', '252', 'Tri Nuraini', 75, NULL),
  (4903, 'TGS-1786328724221-flp8e', '254', 'Zaneta Maya Suryani', 57, NULL),
  (4904, 'TGS-1786328724221-flp8e', '255', 'Zian Sephia Cinta Ramadani', 80, NULL),
  (4898, 'TGS-1786328724221-flp8e', '248', 'Seftia Ramadhani', 91.5, NULL),
  (4905, 'TGS-1786336371937-7g523', '325', 'Alisah Nursakinah', 95, NULL),
  (4906, 'TGS-1786336371937-7g523', '326', 'Amelia Dwi Kusumawati', 96.5, NULL),
  (4907, 'TGS-1786336371937-7g523', '327', 'Amelya Indriani', 97, NULL),
  (4908, 'TGS-1786336371937-7g523', '329', 'Anisa Nurjanah', 95, NULL),
  (4909, 'TGS-1786336371937-7g523', '330', 'Annifa''u Sholikhah', 92, NULL),
  (4910, 'TGS-1786336371937-7g523', '335', 'Dinda Alfiah', 100, NULL),
  (4911, 'TGS-1786336371937-7g523', '336', 'Elvia Hasanah', 96.5, NULL),
  (4912, 'TGS-1786336371937-7g523', '338', 'Gilsa Rahmadani', 96.5, NULL),
  (4913, 'TGS-1786336371937-7g523', '339', 'Hamidatul Husna', 97.5, NULL),
  (4914, 'TGS-1786336371937-7g523', '340', 'Hana Amalia', 95, NULL),
  (4915, 'TGS-1786336371937-7g523', '237', 'Intan Nur Febrianti', 0, NULL),
  (4916, 'TGS-1786336371937-7g523', '343', 'Jihan Pahira', 92.5, NULL),
  (4917, 'TGS-1786336371937-7g523', '344', 'Karisma Cantika', 92.5, NULL),
  (4918, 'TGS-1786336371937-7g523', '345', 'Luna Losari', 85, NULL),
  (4919, 'TGS-1786336371937-7g523', '347', 'Madina Suci Rahayu Al,Munawarah', 97, NULL),
  (4920, 'TGS-1786336371937-7g523', '348', 'Mazidatul Magfiroh', 95, NULL),
  (4921, 'TGS-1786336371937-7g523', '349', 'Milla Nafisah', 97, NULL),
  (4922, 'TGS-1786336371937-7g523', '350', 'Muhtia Dewi Br Sinaga', 95, NULL),
  (4923, 'TGS-1786336371937-7g523', '351', 'Nadia Dwi Rahayu', 97, NULL),
  (4924, 'TGS-1786336371937-7g523', '352', 'Nadin Syabhani', 96.5, NULL),
  (4925, 'TGS-1786336371937-7g523', '353', 'Nayla Putri Ramadhani', 97, NULL),
  (4926, 'TGS-1786336371937-7g523', '354', 'Nisatul Karomah', 97, NULL),
  (4927, 'TGS-1786336371937-7g523', '355', 'Novi Risma Olivia', 1, NULL),
  (4928, 'TGS-1786336371937-7g523', 'XII-1784137806982-wz863', 'Nur Fadilatun Afrillia', 95, NULL),
  (4929, 'TGS-1786336371937-7g523', '358', 'Piranti Kinasih', 95, NULL),
  (4930, 'TGS-1786336371937-7g523', '359', 'Quilla Gadizavirgin', 97, NULL),
  (4931, 'TGS-1786336371937-7g523', '364', 'Rissa Iffatun Nafsi', 88.5, NULL),
  (4932, 'TGS-1786336371937-7g523', '365', 'Ulfatul Khasanah', 92.5, NULL),
  (4933, 'TGS-1786336371937-7g523', '366', 'Wilda', 97, NULL),
  (4934, 'TGS-1786336371937-7g523', '367', 'Yuni Salamah', 93.5, NULL),
  (4935, 'TGS-1787372123928-fvkgj', 'XI1-1', 'Abdul Hamid Syaiful Barnawi', 0, NULL),
  (4936, 'TGS-1787372123928-fvkgj', 'XI1-2', 'Adil Rashad Zaki', 100, NULL),
  (4937, 'TGS-1787372123928-fvkgj', 'XI1-3', 'Ardiul Hafidz', 0, NULL),
  (4938, 'TGS-1787372123928-fvkgj', 'XI1-4', 'Aris Tama Putra', 100, NULL),
  (4939, 'TGS-1787372123928-fvkgj', 'XI1-5', 'Chessli Alkhazahri', 100, NULL),
  (4940, 'TGS-1787372123928-fvkgj', 'XI1-6', 'Daffa Dzakwan Irsyad', 100, NULL),
  (4941, 'TGS-1787372123928-fvkgj', 'XI1-7', 'Danil', 100, NULL),
  (4942, 'TGS-1787372123928-fvkgj', 'XI1-8', 'Dhigo Pratama', 100, NULL),
  (4943, 'TGS-1787372123928-fvkgj', 'XI1-9', 'Fahry Al Gizrie', 100, NULL),
  (4944, 'TGS-1787372123928-fvkgj', 'XI1-10', 'Firly Rizky Adha', 100, NULL),
  (4945, 'TGS-1787372123928-fvkgj', 'XI1-11', 'Ilham Juwanda', 100, NULL),
  (4946, 'TGS-1787372123928-fvkgj', 'XI1-12', 'Irsyadur Rifqi', 0, NULL),
  (4947, 'TGS-1787372123928-fvkgj', 'XI1-13', 'Jos Raharjo', 100, NULL),
  (4948, 'TGS-1787372123928-fvkgj', 'XI1-15', 'M. Irfan Alghifary', 100, NULL),
  (4949, 'TGS-1787372123928-fvkgj', 'XI1-16', 'M.riski Alfariz', 100, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (4950, 'TGS-1787372123928-fvkgj', 'XI1-14', 'Ma''ruf Nurdiansyah', 100, NULL),
  (4951, 'TGS-1787372123928-fvkgj', 'XI1-17', 'Magenta Aidil Rahman', 100, NULL),
  (4952, 'TGS-1787372123928-fvkgj', 'XI1-18', 'Muhammad Alfi Zadah', 100, NULL),
  (4953, 'TGS-1787372123928-fvkgj', 'XI1-19', 'Muhammad Fachry Yusuf', 100, NULL),
  (4954, 'TGS-1787372123928-fvkgj', 'XI1-20', 'Muhammad Ilham', 100, NULL),
  (4955, 'TGS-1787372123928-fvkgj', 'XI1-21', 'Muhammad Rafiansyah', 0, NULL),
  (4956, 'TGS-1787372123928-fvkgj', 'XI1-22', 'Nauval Hysaam Amrullah', 100, NULL),
  (4957, 'TGS-1787372123928-fvkgj', 'XI1-23', 'Ozi Ovandra', 100, NULL),
  (4958, 'TGS-1787372123928-fvkgj', 'XI1-24', 'Raditya Firmansyah', 0, NULL),
  (4959, 'TGS-1787372123928-fvkgj', 'XI1-25', 'Resno Fauzan Al Hafiz', 100, NULL),
  (4960, 'TGS-1787372123928-fvkgj', 'XI1-26', 'Risqi Andika Pratama', 0, NULL),
  (4961, 'TGS-1787372123928-fvkgj', 'XI1-27', 'Rudi Setiawan', 0, NULL),
  (4962, 'TGS-1787372123928-fvkgj', 'XI1-28', 'Wildan Rizky', 0, NULL),
  (4991, 'TGS-1787491430175-f1z2g', 'XI1-1', 'Abdul Hamid Syaiful Barnawi', 0, NULL),
  (4992, 'TGS-1787491430175-f1z2g', 'XI1-2', 'Adil Rashad Zaki', 5, 1),
  (4993, 'TGS-1787491430175-f1z2g', 'XI1-3', 'Ardiul Hafidz', 5, 1),
  (4994, 'TGS-1787491430175-f1z2g', 'XI1-4', 'Aris Tama Putra', 70, 14),
  (4995, 'TGS-1787491430175-f1z2g', 'XI1-5', 'Chessli Alkhazahri', 95, 19),
  (4996, 'TGS-1787491430175-f1z2g', 'XI1-6', 'Daffa Dzakwan Irsyad', 96.5, 19.3),
  (4997, 'TGS-1787491430175-f1z2g', 'XI1-7', 'Danil', 80, 16),
  (4998, 'TGS-1787491430175-f1z2g', 'XI1-8', 'Dhigo Pratama', 100, 20),
  (4999, 'TGS-1787491430175-f1z2g', 'XI1-9', 'Fahry Al Gizrie', 95, 19),
  (5000, 'TGS-1787491430175-f1z2g', 'XI1-10', 'Firly Rizky Adha', 0, 0),
  (5001, 'TGS-1787491430175-f1z2g', 'XI1-11', 'Ilham Juwanda', 5, 1),
  (5002, 'TGS-1787491430175-f1z2g', 'XI1-12', 'Irsyadur Rifqi', 80, 16),
  (5003, 'TGS-1787491430175-f1z2g', 'XI1-13', 'Jos Raharjo', 5, 1),
  (5004, 'TGS-1787491430175-f1z2g', 'XI1-15', 'M. Irfan Alghifary', 75, 15),
  (5005, 'TGS-1787491430175-f1z2g', 'XI1-16', 'M.riski Alfariz', 90, 18),
  (5006, 'TGS-1787491430175-f1z2g', 'XI1-14', 'Ma''ruf Nurdiansyah', 100, 20),
  (5007, 'TGS-1787491430175-f1z2g', 'XI1-17', 'Magenta Aidil Rahman', 90, 18),
  (5008, 'TGS-1787491430175-f1z2g', 'XI1-18', 'Muhammad Alfi Zadah', 92.5, 18.5),
  (5009, 'TGS-1787491430175-f1z2g', 'XI1-19', 'Muhammad Fachry Yusuf', 90, 18),
  (5010, 'TGS-1787491430175-f1z2g', 'XI1-20', 'Muhammad Ilham', 5, 1),
  (5011, 'TGS-1787491430175-f1z2g', 'XI1-21', 'Muhammad Rafiansyah', 90, 18),
  (5012, 'TGS-1787491430175-f1z2g', 'XI1-22', 'Nauval Hysaam Amrullah', 90, 18),
  (5013, 'TGS-1787491430175-f1z2g', 'XI1-23', 'Ozi Ovandra', 95, 19),
  (5014, 'TGS-1787491430175-f1z2g', 'XI1-24', 'Raditya Firmansyah', 60, 12),
  (5015, 'TGS-1787491430175-f1z2g', 'XI1-25', 'Resno Fauzan Al Hafiz', 91.5, 18.3),
  (5016, 'TGS-1787491430175-f1z2g', 'XI1-26', 'Risqi Andika Pratama', 5, 1),
  (5017, 'TGS-1787491430175-f1z2g', 'XI1-27', 'Rudi Setiawan', 90, 18),
  (5018, 'TGS-1787491430175-f1z2g', 'XI1-28', 'Wildan Rizky', 95, 19),
  (5019, 'TGS-1787806412030-ce8xp', 'XI4-1', 'Nazila Rahmatika Habib', 85.3, NULL),
  (5020, 'TGS-1787806412030-ce8xp', 'XI4-2', 'Nazwa May Nur Winarni', 90, NULL),
  (5021, 'TGS-1787806412030-ce8xp', 'XI4-3', 'Neva Setia Ningsih', 1, NULL),
  (5022, 'TGS-1787806412030-ce8xp', 'XI4-4', 'Novi Nuraini', 83.5, NULL),
  (5023, 'TGS-1787806412030-ce8xp', 'XI4-5', 'Nur Hidayah', 1, NULL),
  (5024, 'TGS-1787806412030-ce8xp', 'XI4-6', 'Nur Indah Safitri', 1, NULL),
  (5025, 'TGS-1787806412030-ce8xp', 'XI4-7', 'Nur Khani Fatussaadah', 94, NULL),
  (5026, 'TGS-1787806412030-ce8xp', 'XI4-8', 'Pika Mutiara', 82.5, NULL),
  (5027, 'TGS-1787806412030-ce8xp', 'XI4-9', 'Qoonitah Simanjuntak', 100, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (5028, 'TGS-1787806412030-ce8xp', 'XI4-12', 'Rahma Roma Dona', 79, NULL),
  (5029, 'TGS-1787806412030-ce8xp', 'XI4-13', 'Rahmatika Khoirun Nisa', 92.5, NULL),
  (5030, 'TGS-1787806412030-ce8xp', 'XI4-14', 'Refa Putriyanti', 1, NULL),
  (5031, 'TGS-1787806412030-ce8xp', 'XI4-15', 'Resti Muthia Rahmawati', 1, NULL),
  (5032, 'TGS-1787806412030-ce8xp', 'XI4-16', 'Revany Rihadatul Aisyi', 1, NULL),
  (5033, 'TGS-1787806412030-ce8xp', 'XI4-17', 'Rima Septiani', 1, NULL),
  (5034, 'TGS-1787806412030-ce8xp', 'XI4-18', 'Riva Anzila Rahma', 100, NULL),
  (5035, 'TGS-1787806412030-ce8xp', 'XI4-19', 'Rizka Salsabila Irawan', 87.5, NULL),
  (5036, 'TGS-1787806412030-ce8xp', 'XI4-20', 'Rizkia Indana Zulfa', 70, NULL),
  (5037, 'TGS-1787806412030-ce8xp', 'XI4-21', 'Safa Novia Sari', 67.5, NULL),
  (5038, 'TGS-1787806412030-ce8xp', 'XI4-22', 'Saniya Roudlotullatiifah', 90, NULL),
  (5039, 'TGS-1787806412030-ce8xp', 'XI4-23', 'Shinta Aulia Shanwirya', 94, NULL),
  (5040, 'TGS-1787806412030-ce8xp', 'XI4-24', 'Silvi Zulia Asrofi', 1, NULL),
  (5041, 'TGS-1787806412030-ce8xp', 'XI4-10', 'Siva Afril Lanni', 70, NULL),
  (5042, 'TGS-1787806412030-ce8xp', 'XI4-25', 'Siva Meryana', 1, NULL),
  (5043, 'TGS-1787806412030-ce8xp', 'XI4-26', 'Sopi Ariani', 85.5, NULL),
  (5044, 'TGS-1787806412030-ce8xp', 'XI4-27', 'Syla Hafidzah Ramadhani', 87.5, NULL),
  (5045, 'TGS-1787806412030-ce8xp', 'XI4-28', 'Thasya Nurdianingsih', 97.5, NULL),
  (5046, 'TGS-1787806412030-ce8xp', 'XI4-29', 'Tria Sari Retno Wati', 80, NULL),
  (5047, 'TGS-1787806412030-ce8xp', 'XI4-11', 'Ulfiatul Khoiroh', 98.5, NULL),
  (5048, 'TGS-1787806412030-ce8xp', 'XI4-30', 'Winnie Alenskia Sirait', 90, NULL),
  (5049, 'TGS-1787806412030-ce8xp', 'XI4-31', 'Yasmin Safinatun Najwa', 1, NULL),
  (5050, 'TGS-1787806412030-ce8xp', 'XI4-32', 'Zahra Alya Fathiya', 100, NULL),
  (5051, 'TGS-1787806412030-ce8xp', 'XI4-33', 'Zarwa Sugiarti', 1, NULL),
  (5052, 'TGS-1787806412030-ce8xp', 'XI4-34', 'Zaskia Aulia Putri', 1, NULL),
  (5053, 'TGS-1787806412030-ce8xp', 'XI4-35', 'Zilia Layli Nafisa', 1, NULL),
  (5057, 'TGS-1788053979488-xoddh', 'XI2-4', 'Alfikri', 97.5, 19.5),
  (5058, 'TGS-1788053979488-xoddh', 'XI2-5', 'Arya Pandu Brilliant', 97.5, 19.5),
  (5059, 'TGS-1788053979488-xoddh', 'XI2-6', 'Bagas', 92.5, 18.5),
  (5060, 'TGS-1788053979488-xoddh', 'XI2-7', 'Budi Septria', 97.5, 19.5),
  (5061, 'TGS-1788053979488-xoddh', 'XI2-8', 'David Alamsyah', 94, 18.8),
  (5062, 'TGS-1788053979488-xoddh', 'XI2-9', 'Dika Setiawan', 97.5, 19.5),
  (5063, 'TGS-1788053979488-xoddh', 'XI2-10', 'Elvino Aqil Adzaky', 97.5, 19.5),
  (5064, 'TGS-1788053979488-xoddh', 'XI2-11', 'Fadhlan Naufal Hidayatullah', 97.5, 19.5),
  (5056, 'TGS-1788053979488-xoddh', 'XI2-3', 'Aldy Pramuditya', 85, 17),
  (5055, 'TGS-1788053979488-xoddh', 'XI2-2', 'Ahmat Ilham Romadhon', 70, 14),
  (5054, 'TGS-1788053979488-xoddh', 'XI2-1', 'Ahmadilah Rifanto', 70, 14),
  (5065, 'TGS-1788053979488-xoddh', 'XI2-12', 'Firhan Al Zikri', 67, 13.4),
  (5066, 'TGS-1788053979488-xoddh', 'XI2-13', 'Galih Latifatul Fadli', 97.5, 19.5),
  (5067, 'TGS-1788053979488-xoddh', 'XI2-14', 'Habib Qowwiya', 100, 20),
  (5068, 'TGS-1788053979488-xoddh', 'XI2-15', 'Hayyu Al Rozaqi', 97.5, 19.5),
  (5071, 'TGS-1788053979488-xoddh', 'XI2-18', 'M. Arif Alfarizi', 96.5, 19.3),
  (5072, 'TGS-1788053979488-xoddh', 'XI2-19', 'Muhamad Khoirul Tri Sugiarto', 0, NULL),
  (5073, 'TGS-1788053979488-xoddh', 'XI2-20', 'Muhammad Eko Bima Saputra', 95, 19),
  (5076, 'TGS-1788053979488-xoddh', 'XI2-23', 'Muhammad Revand Alfajri', 90, 18),
  (5077, 'TGS-1788053979488-xoddh', 'XI2-24', 'Mumtaz Al Baqi', 100, 20),
  (5078, 'TGS-1788053979488-xoddh', 'XI2-25', 'Raditya Faturahman', 0, NULL),
  (5079, 'TGS-1788053979488-xoddh', 'XI2-26', 'Royhan Yusuf At Thibbi', 92.5, 18.5),
  (5080, 'TGS-1788053979488-xoddh', 'XI2-27', 'Safwan Zaizuly', 100, 20),
  (5083, 'TGS-1788053979488-xoddh', 'XI2-30', 'Yoga May Prasetyo', 95, 19)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (5074, 'TGS-1788053979488-xoddh', 'XI2-21', 'Muhammad Fatkhur Rizky', 100, 20),
  (5082, 'TGS-1788053979488-xoddh', 'XI2-29', 'Wisnu Lutfiansyah', 85, 17),
  (5084, 'TGS-1788580989089-2q0cx', 'XI3-1', 'Aina Bismika Fatma', 90, NULL),
  (5085, 'TGS-1788580989089-2q0cx', 'XI3-2', 'Alfya Chelshelia', 0, NULL),
  (5086, 'TGS-1788580989089-2q0cx', 'XI3-3', 'Anastasya Aulia', 0, NULL),
  (5087, 'TGS-1788580989089-2q0cx', 'XI3-4', 'Anissa Koirotus Zahra', 85, NULL),
  (5088, 'TGS-1788580989089-2q0cx', 'XI3-5', 'Anisyatul Nabila', 0, NULL),
  (5089, 'TGS-1788580989089-2q0cx', 'XI3-6', 'Assyifa Rahmatul Husna', 0, NULL),
  (5090, 'TGS-1788580989089-2q0cx', 'XI3-7', 'Aufa Azalia', 0, NULL),
  (5091, 'TGS-1788580989089-2q0cx', 'XI3-8', 'Avelya Dian Ningtias', 85, NULL),
  (5092, 'TGS-1788580989089-2q0cx', 'XI3-9', 'Ayu Kanza Salamah', 0, NULL),
  (5093, 'TGS-1788580989089-2q0cx', 'XI3-10', 'Dara Anggia Wafiroh', 0, NULL),
  (5094, 'TGS-1788580989089-2q0cx', 'XI3-11', 'Dea Ananta Siregar', 0, NULL),
  (5095, 'TGS-1788580989089-2q0cx', 'XI3-12', 'Dea Rahma Said', 0, NULL),
  (5096, 'TGS-1788580989089-2q0cx', 'XI3-13', 'Diah Asyifa Deviana', 0, NULL),
  (5097, 'TGS-1788580989089-2q0cx', 'XI3-14', 'Dika Arum Utami', 0, NULL),
  (5098, 'TGS-1788580989089-2q0cx', 'XI3-15', 'Dina Amelia Putri', 0, NULL),
  (5099, 'TGS-1788580989089-2q0cx', 'XI3-16', 'Dira Anggia Wafiroh', 0, NULL),
  (5100, 'TGS-1788580989089-2q0cx', 'XI3-17', 'Dwi Alsapitri', 0, NULL),
  (5101, 'TGS-1788580989089-2q0cx', 'XI3-18', 'Elsa Laily Saputri', 0, NULL),
  (5102, 'TGS-1788580989089-2q0cx', 'XI3-19', 'Elvina Ramadani', 0, NULL),
  (5103, 'TGS-1788580989089-2q0cx', 'XI3-20', 'Fauziah Zulfa Riski', 0, NULL),
  (5104, 'TGS-1788580989089-2q0cx', 'XI3-21', 'Fina Ayu Lestari', 0, NULL),
  (5105, 'TGS-1788580989089-2q0cx', 'XI3-22', 'Fita Sari', 0, NULL),
  (5106, 'TGS-1788580989089-2q0cx', 'XI3-23', 'Fitri Rahma Sari', 90, NULL),
  (5107, 'TGS-1788580989089-2q0cx', 'XI3-24', 'Hafidzah Aulia Azhari', 0, NULL),
  (5108, 'TGS-1788580989089-2q0cx', 'XI3-25', 'Hafizah Husnatullaila', 87.5, NULL),
  (5109, 'TGS-1788580989089-2q0cx', 'XI3-26', 'Imelda Olivia', 0, NULL),
  (5110, 'TGS-1788580989089-2q0cx', 'XI3-27', 'Ira Boru Rahman', 0, NULL),
  (5111, 'TGS-1788580989089-2q0cx', 'XI3-28', 'Istiqomah Kaffah', 0, NULL),
  (5112, 'TGS-1788580989089-2q0cx', 'XI3-29', 'Liliana Sulistiyaningsih', 0, NULL),
  (5113, 'TGS-1788580989089-2q0cx', 'XI3-30', 'Mala Vita Sari', 0, NULL),
  (5114, 'TGS-1788580989089-2q0cx', 'XI3-31', 'Miftahatun Mafanza Mutiara', 0, NULL),
  (5115, 'TGS-1788580989089-2q0cx', 'XI3-32', 'Moza Putri Anjani', 0, NULL),
  (5116, 'TGS-1788580989089-2q0cx', 'XI3-33', 'Muhajarotul Khusnia', 0, NULL),
  (5117, 'TGS-1788580989089-2q0cx', 'XI3-34', 'Mustivatul Maulidah', 90, NULL),
  (5118, 'TGS-1788580989089-2q0cx', 'XI3-35', 'Mutiara', 0, NULL),
  (5119, 'TGS-1788580989089-2q0cx', 'XI3-36', 'Nabila Azizah', 95, NULL),
  (5120, 'TGS-1788580989089-2q0cx', 'XI3-37', 'Nayzila Dwi Lestari', 0, NULL),
  (5069, 'TGS-1788053979488-xoddh', 'XI2-16', 'Ilham Bagus Ramadani', 70, 14),
  (5081, 'TGS-1788053979488-xoddh', 'XI2-28', 'Tegar Ananka Pratama', 63, 12.6),
  (5075, 'TGS-1788053979488-xoddh', 'XI2-22', 'Muhammad Inggil Maulana Ibrahim', 73, 14.6),
  (5070, 'TGS-1788053979488-xoddh', 'XI2-17', 'Labib Deskha Pratama', 70, 14),
  (5121, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-9', 'Fahry Al Gizrie', 90, NULL),
  (5122, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-18', 'Muhammad Alfi Zadah', 90, NULL),
  (5123, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-21', 'Muhammad Rafiansyah', 90, NULL),
  (5124, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-13', 'Jos Raharjo', 90, NULL),
  (5125, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-26', 'Risqi Andika Pratama', 90, NULL),
  (5126, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-4', 'Aris Tama Putra', 90, NULL),
  (5127, 'TGS-GRP-GRP-MUK3IGLM', 'XI1-28', 'Wildan Rizky', 90, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (5128, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-8', 'Dhigo Pratama', 100, NULL),
  (5129, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-2', 'Adil Rashad Zaki', 100, NULL),
  (5130, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-19', 'Muhammad Fachry Yusuf', 100, NULL),
  (5131, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-17', 'Magenta Aidil Rahman', 94, NULL),
  (5132, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-11', 'Ilham Juwanda', 94, NULL),
  (5133, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-12', 'Irsyadur Rifqi', 94, NULL),
  (5134, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-6', 'Daffa Dzakwan Irsyad', 90, NULL),
  (5135, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-23', 'Ozi Ovandra', 90, NULL),
  (5136, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-27', 'Rudi Setiawan', 90, NULL),
  (5137, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-25', 'Resno Fauzan Al Hafiz', 88, NULL),
  (5138, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-13', 'Jos Raharjo', 88, NULL),
  (5139, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-4', 'Aris Tama Putra', 88, NULL),
  (5140, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-22', 'Nauval Hysaam Amrullah', 87, NULL),
  (5141, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-20', 'Muhammad Ilham', 87, NULL),
  (5142, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-15', 'M. Irfan Alghifary', 87, NULL),
  (5143, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-7', 'Danil', 100, NULL),
  (5144, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-3', 'Ardiul Hafidz', 100, NULL),
  (5145, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-28', 'Wildan Rizky', 100, NULL),
  (5146, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-9', 'Fahry Al Gizrie', 90, NULL),
  (5147, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-21', 'Muhammad Rafiansyah', 90, NULL),
  (5148, 'TGS-GRP-GRP-MUHV7ISF', 'XI1-18', 'Muhammad Alfi Zadah', 90, NULL),
  (5149, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-12', 'Hani Umi Latipah', 94, NULL),
  (5150, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-24', 'Ulfatus Saiba', 94, NULL),
  (5151, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-22', 'Novi Yani Dongoran', 94, NULL),
  (5152, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-10', 'Fara Nuriana', 100, NULL),
  (5153, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-19', 'Najwa Tsaqova', 100, NULL),
  (5154, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-16', 'Khumaira Nur Fadyah', 100, NULL),
  (5155, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-25', 'Ranti Amelia', 100, NULL),
  (5156, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-35', 'Wismi Diniarti', 100, NULL),
  (5157, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-7', 'Citra Agustia', 100, NULL),
  (5158, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-9', 'Elisa Riski', 100, NULL),
  (5159, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-36', 'Zaskia Ika Rahmadhani', 100, NULL),
  (5160, 'TGS-GRP-GRP-MUEVMZDU', 'XI5-3', 'Ayu Bunga Lestari', 100, NULL),
  (5181, 'TGS-GRP-GRP-MUS86QWS', 'XI3-23', 'Fitri Rahma Sari', 94, NULL),
  (5213, 'TGS-1791540562495-f2quw', 'SIS-178474614301545', 'Test 1', 1, NULL),
  (5214, 'TGS-1791540562495-f2quw', 'SIS-179145936408236', 'test1', 2, NULL),
  (5215, 'TGS-1791540562495-f2quw', 'SIS-179145937756077', 'test2', 3, NULL),
  (5216, 'TGS-1791540562495-f2quw', 'SIS-179145938994792', 'test3', 4, NULL),
  (5220, 'TGS-GRP-GRP-MUS86QWS', 'XI3-33', 'Muhajarotul Khusnia', 10, NULL),
  (5161, 'TGS-GRP-GRP-MUS86QWS', 'XI3-6', 'Assyifa Rahmatul Husna', 100, NULL),
  (5162, 'TGS-GRP-GRP-MUS86QWS', 'XI3-4', 'Anissa Koirotus Zahra', 100, NULL),
  (5163, 'TGS-GRP-GRP-MUS86QWS', 'XI3-5', 'Anisyatul Nabila', 100, NULL),
  (5164, 'TGS-GRP-GRP-MUS86QWS', 'XI3-7', 'Aufa Azalia', 99, NULL),
  (5165, 'TGS-GRP-GRP-MUS86QWS', 'XI3-8', 'Avelya Dian Ningtias', 99, NULL),
  (5166, 'TGS-GRP-GRP-MUS86QWS', 'XI3-9', 'Ayu Kanza Salamah', 99, NULL),
  (5167, 'TGS-GRP-GRP-MUS86QWS', 'XI3-12', 'Dea Rahma Said', 100, NULL),
  (5168, 'TGS-GRP-GRP-MUS86QWS', 'XI3-11', 'Dea Ananta Siregar', 100, NULL),
  (5169, 'TGS-GRP-GRP-MUS86QWS', 'XI3-10', 'Dara Anggia Wafiroh', 100, NULL),
  (5170, 'TGS-GRP-GRP-MUS86QWS', 'XI3-15', 'Dina Amelia Putri', 95, NULL),
  (5171, 'TGS-GRP-GRP-MUS86QWS', 'XI3-14', 'Dika Arum Utami', 95, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (5172, 'TGS-GRP-GRP-MUS86QWS', 'XI3-16', 'Dira Anggia Wafiroh', 95, NULL),
  (5173, 'TGS-GRP-GRP-MUS86QWS', 'XI3-18', 'Elsa Laily Saputri', 100, NULL),
  (5174, 'TGS-GRP-GRP-MUS86QWS', 'XI3-19', 'Elvina Ramadani', 100, NULL),
  (5175, 'TGS-GRP-GRP-MUS86QWS', 'XI3-17', 'Dwi Alsapitri', 100, NULL),
  (5176, 'TGS-GRP-GRP-MUS86QWS', 'XI3-36', 'Nabila Azizah', 100, NULL),
  (5177, 'TGS-GRP-GRP-MUS86QWS', 'XI3-22', 'Fita Sari', 100, NULL),
  (5178, 'TGS-GRP-GRP-MUS86QWS', 'XI3-37', 'Nayzila Dwi Lestari', 100, NULL),
  (5179, 'TGS-GRP-GRP-MUS86QWS', 'XI3-21', 'Fina Ayu Lestari', 100, NULL),
  (5180, 'TGS-GRP-GRP-MUS86QWS', 'XI3-20', 'Fauziah Zulfa Riski', 100, NULL),
  (5182, 'TGS-GRP-GRP-MUS86QWS', 'XI3-24', 'Hafidzah Aulia Azhari', 94, NULL),
  (5183, 'TGS-GRP-GRP-MUS86QWS', 'XI3-25', 'Hafizah Husnatullaila', 94, NULL),
  (5184, 'TGS-GRP-GRP-MUS86QWS', 'XI3-27', 'Ira Boru Rahman', 100, NULL),
  (5185, 'TGS-GRP-GRP-MUS86QWS', 'XI3-26', 'Imelda Olivia', 100, NULL),
  (5186, 'TGS-GRP-GRP-MUS86QWS', 'XI3-28', 'Istiqomah Kaffah', 100, NULL),
  (5187, 'TGS-GRP-GRP-MUS86QWS', 'XI3-31', 'Miftahatun Mafanza Mutiara', 100, NULL),
  (5188, 'TGS-GRP-GRP-MUS86QWS', 'XI3-30', 'Mala Vita Sari', 100, NULL),
  (5189, 'TGS-GRP-GRP-MUS86QWS', 'XI3-29', 'Liliana Sulistiyaningsih', 100, NULL),
  (5190, 'TGS-GRP-GRP-MUS86QWS', 'XI3-34', 'Mustivatul Maulidah', 100, NULL),
  (5191, 'TGS-GRP-GRP-MUS86QWS', 'XI3-32', 'Moza Putri Anjani', 100, NULL),
  (5192, 'TGS-GRP-GRP-MUS86QWS', 'XI3-35', 'Mutiara', 100, NULL),
  (5221, 'TGS-GRP-GRP-MUJ44J2N', '319', 'Tatong Ihsantri', 55, NULL),
  (5222, 'TGS-GRP-GRP-MUJ44J2N', '297', 'M. Imam Musyaffa', 55, NULL),
  (5223, 'TGS-GRP-GRP-MUJ44J2N', '303', 'Muhammad Ali Romadhon', 55, NULL),
  (5224, 'TGS-GRP-GRP-MUJ44J2N', '289', 'Fadhil Azmy Pratama', 60, NULL),
  (5225, 'TGS-GRP-GRP-MUJ44J2N', '299', 'Muhamad Dwi Praditya Herianto', 60, NULL),
  (5226, 'TGS-GRP-GRP-MUJ44J2N', '290', 'Fatku Rohman', 60, NULL),
  (5227, 'TGS-GRP-GRP-MUJ44J2N', '284', 'Ahmad Izudin Ubaidillah', 94, NULL),
  (5228, 'TGS-GRP-GRP-MUJ44J2N', '301', 'Muhamad Yusuf Nurasyid', 94, NULL),
  (5229, 'TGS-GRP-GRP-MUJ44J2N', 'XII-1784137806982-oubco', 'Azhar Faris Arasyid', 94, NULL),
  (5230, 'TGS-GRP-GRP-MUJ44J2N', '305', 'Muhammad Dzaka Prawira', 72, NULL),
  (5231, 'TGS-GRP-GRP-MUJ44J2N', '308', 'Pratama Aidil Fitrah', 72, NULL),
  (5232, 'TGS-GRP-GRP-MUJ44J2N', '285', 'Alvin Pratama Imanudin', 72, NULL),
  (5233, 'TGS-GRP-GRP-MUJ44J2N', '295', 'Jonal Dika', 62, NULL),
  (5234, 'TGS-GRP-GRP-MUJ44J2N', '302', 'Muhammad Alfan As''Ari', 62, NULL),
  (5235, 'TGS-GRP-GRP-MUJ44J2N', '288', 'Dimas Pasya Saputra', 62, NULL),
  (5236, 'TGS-GRP-GRP-MUJ44J2N', '304', 'Muhammad Burhanuddin', 94, NULL),
  (5237, 'TGS-GRP-GRP-MUJ44J2N', '310', 'Respati Bayuaji Kamajaya', 94, NULL),
  (5238, 'TGS-GRP-GRP-MUJ44J2N', '294', 'Henkky Irawan Siregar', 94, NULL),
  (5239, 'TGS-GRP-GRP-MUJ44J2N', '292', 'Fergie Ikhsan', 62, NULL),
  (5240, 'TGS-GRP-GRP-MUJ44J2N', '300', 'Muhamad Maulana', 62, NULL),
  (5219, 'TGS-GRP-GRP-MUS86QWS', 'XI3-2', 'Alfya Chelshelia', 70, NULL),
  (5217, 'TGS-GRP-GRP-MUS86QWS', 'XI3-3', 'Anastasya Aulia', 70, NULL),
  (5218, 'TGS-GRP-GRP-MUS86QWS', 'XI3-1', 'Aina Bismika Fatma', 70, NULL),
  (5241, 'TGS-1781659392252-h8gtm', 'XI1-1', 'Abdul Hamid Syaiful Barnawi', 0, NULL),
  (5242, 'TGS-1781659392252-h8gtm', 'XI1-2', 'Adil Rashad Zaki', 90, NULL),
  (5243, 'TGS-1781659392252-h8gtm', 'XI1-3', 'Ardiul Hafidz', 77, NULL),
  (5244, 'TGS-1781659392252-h8gtm', 'XI1-4', 'Aris Tama Putra', 0, NULL),
  (5245, 'TGS-1781659392252-h8gtm', 'XI1-5', 'Chessli Alkhazahri', 0, NULL),
  (5246, 'TGS-1781659392252-h8gtm', 'XI1-6', 'Daffa Dzakwan Irsyad', 0, NULL),
  (5247, 'TGS-1781659392252-h8gtm', 'XI1-7', 'Danil', 0, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.nilai_siswa ("id", "tugas_id", "siswa_id", "nama_siswa", "nilai", "jumlah_benar")
VALUES
  (5248, 'TGS-1781659392252-h8gtm', 'XI1-8', 'Dhigo Pratama', 0, NULL),
  (5249, 'TGS-1781659392252-h8gtm', 'XI1-9', 'Fahry Al Gizrie', 0, NULL),
  (5250, 'TGS-1781659392252-h8gtm', 'XI1-10', 'Firly Rizky Adha', 0, NULL),
  (5251, 'TGS-1781659392252-h8gtm', 'XI1-11', 'Ilham Juwanda', 0, NULL),
  (5252, 'TGS-1781659392252-h8gtm', 'XI1-12', 'Irsyadur Rifqi', 0, NULL),
  (5253, 'TGS-1781659392252-h8gtm', 'XI1-13', 'Jos Raharjo', 0, NULL),
  (5254, 'TGS-1781659392252-h8gtm', 'XI1-15', 'M. Irfan Alghifary', 0, NULL),
  (5255, 'TGS-1781659392252-h8gtm', 'XI1-16', 'M.riski Alfariz', 0, NULL),
  (5256, 'TGS-1781659392252-h8gtm', 'XI1-14', 'Ma''ruf Nurdiansyah', 0, NULL),
  (5257, 'TGS-1781659392252-h8gtm', 'XI1-17', 'Magenta Aidil Rahman', 0, NULL),
  (5258, 'TGS-1781659392252-h8gtm', 'XI1-18', 'Muhammad Alfi Zadah', 0, NULL),
  (5259, 'TGS-1781659392252-h8gtm', 'XI1-19', 'Muhammad Fachry Yusuf', 0, NULL),
  (5260, 'TGS-1781659392252-h8gtm', 'XI1-20', 'Muhammad Ilham', 0, NULL),
  (5261, 'TGS-1781659392252-h8gtm', 'XI1-21', 'Muhammad Rafiansyah', 0, NULL),
  (5262, 'TGS-1781659392252-h8gtm', 'XI1-22', 'Nauval Hysaam Amrullah', 0, NULL),
  (5263, 'TGS-1781659392252-h8gtm', 'XI1-23', 'Ozi Ovandra', 0, NULL),
  (5264, 'TGS-1781659392252-h8gtm', 'XI1-24', 'Raditya Firmansyah', 0, NULL),
  (5265, 'TGS-1781659392252-h8gtm', 'XI1-25', 'Resno Fauzan Al Hafiz', 0, NULL),
  (5266, 'TGS-1781659392252-h8gtm', 'XI1-26', 'Risqi Andika Pratama', 0, NULL),
  (5267, 'TGS-1781659392252-h8gtm', 'XI1-27', 'Rudi Setiawan', 0, NULL),
  (5268, 'TGS-1781659392252-h8gtm', 'XI1-28', 'Wildan Rizky', 0, NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.poin (174 baris)
-- =====================================================
INSERT INTO public.poin ("id", "siswa_id", "guru_id", "tanggal", "tipe", "kategori", "aktifitas", "poin", "keterangan", "created_at", "tahun_ajar", "semester")
VALUES
  ('POIN-1785153369846853', 'XI5-35', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:56:10.450752+00:00', '2026/2027', 1),
  ('POIN-1785153391923598', 'XI5-16', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:56:32.505123+00:00', '2026/2027', 1),
  ('POIN-1785153414455745', 'XI5-36', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:56:54.617278+00:00', '2026/2027', 1),
  ('POIN-1785153428559466', 'XI5-12', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:57:08.71207+00:00', '2026/2027', 1),
  ('POIN-1785153450938531', 'XI5-7', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:57:31.096727+00:00', '2026/2027', 1),
  ('POIN-1785153501361480', 'XI5-7', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:58:21.521653+00:00', '2026/2027', 1),
  ('POIN-178515351226945', 'XI5-12', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:58:32.836573+00:00', '2026/2027', 1),
  ('POIN-1785153522750565', 'XI5-36', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:58:42.895187+00:00', '2026/2027', 1),
  ('POIN-1785153534996914', 'XI5-35', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:58:55.550244+00:00', '2026/2027', 1),
  ('POIN-1785153543751625', 'XI5-9', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T11:59:03.904743+00:00', '2026/2027', 1),
  ('POIN-1785153612704676', 'XI3-24', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'Lainnya', 'Menjawab Quiz 2X', 20, '', '2026-07-27T12:00:12.870253+00:00', '2026/2027', 1),
  ('POIN-178515364924264', 'XI3-2', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:00:49.83456+00:00', '2026/2027', 1),
  ('POIN-1785153661640912', 'XI3-35', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:01:02.220777+00:00', '2026/2027', 1),
  ('POIN-1785153672022623', 'XI3-1', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:01:12.234262+00:00', '2026/2027', 1),
  ('POIN-1785153691761421', 'XI3-4', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:01:31.916637+00:00', '2026/2027', 1),
  ('POIN-1785153701077951', 'XI3-31', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:01:41.222689+00:00', '2026/2027', 1),
  ('POIN-1785153713115787', 'XI3-15', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:01:53.275119+00:00', '2026/2027', 1),
  ('POIN-1785153722274894', 'XI3-34', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:02:02.428318+00:00', '2026/2027', 1),
  ('POIN-1785153738386761', 'XI3-5', 'UID-1779817062842YOUA', '2026-07-27', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-27T12:02:18.549169+00:00', '2026/2027', 1),
  ('POIN-1785153868296747', '289', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:04:28.563844+00:00', '2026/2027', 1),
  ('POIN-1785153899101225', '306', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:04:59.242709+00:00', '2026/2027', 1),
  ('POIN-1785153934243995', 'XI2-3', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:05:34.417147+00:00', '2026/2027', 1),
  ('POIN-1785153960290559', 'XI2-15', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:06:00.435047+00:00', '2026/2027', 1),
  ('POIN-1785153981493296', 'XI2-27', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:06:21.635911+00:00', '2026/2027', 1),
  ('POIN-1785154001588607', 'XI2-30', 'UID-1779817062842YOUA', '2026-07-27', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-07-27T12:06:41.736663+00:00', '2026/2027', 1),
  ('POIN-1785201934574494', '278', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:25:35.148599+00:00', '2026/2027', 1),
  ('POIN-1785201963145295', '280', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:26:03.674644+00:00', '2026/2027', 1),
  ('POIN-1785201996635124', '309', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'Lainnya', 'Quiz', 30, '', '2026-07-28T01:26:36.902795+00:00', '2026/2027', 1),
  ('POIN-1785202037604943', '273', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:27:17.780945+00:00', '2026/2027', 1),
  ('POIN-178520206738749', '262', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-07-28T01:27:47.536925+00:00', '2026/2027', 1),
  ('POIN-1785202095362343', '257', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-07-28T01:28:15.909315+00:00', '2026/2027', 1),
  ('POIN-1785202455700417', '278', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:34:15.872362+00:00', '2026/2027', 1),
  ('POIN-1785202483795599', '260', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:34:43.942586+00:00', '2026/2027', 1),
  ('POIN-1785202506552501', '260', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:35:06.703152+00:00', '2026/2027', 1),
  ('POIN-1785202542451113', '272', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:35:43.105809+00:00', '2026/2027', 1),
  ('POIN-178520256051847', '273', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:36:01.068729+00:00', '2026/2027', 1),
  ('POIN-1785202626369104', '279', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:37:06.529812+00:00', '2026/2027', 1),
  ('POIN-1785202655698385', '275', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:37:36.269683+00:00', '2026/2027', 1),
  ('POIN-1785202683761301', '259', 'UID-1779817062842YOUA', '2026-07-28', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-07-28T01:38:03.911638+00:00', '2026/2027', 1),
  ('POIN-1785551756654717', 'XI3-21', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:35:56.936127+00:00', '2026/2027', 1),
  ('POIN-1785551793506773', 'XI3-3', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'Lainnya', 'Quiz', 40, '', '2026-08-01T02:36:34.04448+00:00', '2026/2027', 1),
  ('POIN-1785551814269433', 'XI3-10', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:36:54.415295+00:00', '2026/2027', 1),
  ('POIN-1785551826600337', 'XI3-9', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:37:07.122008+00:00', '2026/2027', 1),
  ('POIN-1785551952494108', 'XI3-15', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-08-01T02:39:12.753194+00:00', '2026/2027', 1),
  ('POIN-1785551972264291', 'XI3-29', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:39:32.384584+00:00', '2026/2027', 1),
  ('POIN-1785551989041749', 'XI3-4', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:39:49.164292+00:00', '2026/2027', 1),
  ('POIN-1785552015586480', 'XI3-2', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-08-01T02:40:15.710372+00:00', '2026/2027', 1),
  ('POIN-1785552064201812', 'XI3-34', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'Lainnya', 'Quiz', 70, '', '2026-08-01T02:41:04.347924+00:00', '2026/2027', 1),
  ('POIN-1785552077428868', 'XI3-20', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:41:17.551974+00:00', '2026/2027', 1),
  ('POIN-1785552096348845', 'XI3-28', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-01T02:41:36.473708+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.poin ("id", "siswa_id", "guru_id", "tanggal", "tipe", "kategori", "aktifitas", "poin", "keterangan", "created_at", "tahun_ajar", "semester")
VALUES
  ('POIN-1785552127223503', 'XI3-35', 'UID-1779817062842YOUA', '2026-08-01', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-08-01T02:42:07.35288+00:00', '2026/2027', 1),
  ('POIN-1785635488308742', '288', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 40, '', '2026-08-02T01:51:28.541132+00:00', '2026/2027', 1),
  ('POIN-1785635576939957', '319', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 20, '', '2026-08-02T01:52:57.084292+00:00', '2026/2027', 1),
  ('POIN-1785635616630314', '308', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 40, '', '2026-08-02T01:53:36.870757+00:00', '2026/2027', 1),
  ('POIN-178563552521151', '285', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 50, '', '2026-08-02T01:52:05.372896+00:00', '2026/2027', 1),
  ('POIN-1785635683878416', '287', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 40, '', '2026-08-02T01:54:44.026622+00:00', '2026/2027', 1),
  ('POIN-1785635705191498', '289', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-02T01:55:05.328006+00:00', '2026/2027', 1),
  ('POIN-1785635734139909', '291', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 20, '', '2026-08-02T01:55:34.268381+00:00', '2026/2027', 1),
  ('POIN-1785635768940486', '292', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 30, '', '2026-08-02T01:56:09.4967+00:00', '2026/2027', 1),
  ('POIN-1785635796292208', '302', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 30, '', '2026-08-02T01:56:36.42204+00:00', '2026/2027', 1),
  ('POIN-1785635822624192', '298', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 40, '', '2026-08-02T01:57:02.758847+00:00', '2026/2027', 1),
  ('POIN-1785635838305903', '294', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-02T01:57:18.434981+00:00', '2026/2027', 1),
  ('POIN-1785635875372594', '299', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'Lainnya', 'Quiz ', 20, '', '2026-08-02T01:57:55.529568+00:00', '2026/2027', 1),
  ('POIN-1785635899620504', '301', 'UID-1779817062842YOUA', '2026-08-02', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-02T01:58:19.749503+00:00', '2026/2027', 1),
  ('POIN-1785807985142488', '270', 'UID-1779817062842YOUA', '2026-08-04', 'positif', 'Lainnya', 'Quiz', 30, '', '2026-08-04T01:46:25.423827+00:00', '2026/2027', 1),
  ('POIN-1785808085551443', '276', 'UID-1779817062842YOUA', '2026-08-04', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-04T01:48:05.799637+00:00', '2026/2027', 1),
  ('POIN-1786430311584267', '292', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:38:31.752564+00:00', '2026/2027', 1),
  ('POIN-1786430360405124', '287', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-08-11T06:39:20.642574+00:00', '2026/2027', 1),
  ('POIN-1786430386970121', '296', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-08-11T06:39:47.10626+00:00', '2026/2027', 1),
  ('POIN-1786430328696674', '293', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:38:48.84035+00:00', '2026/2027', 1),
  ('POIN-1786430460730586', '297', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:41:00.900027+00:00', '2026/2027', 1),
  ('POIN-1786430482181385', '298', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:41:22.884093+00:00', '2026/2027', 1),
  ('POIN-1786430503415722', '300', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:41:43.995059+00:00', '2026/2027', 1),
  ('POIN-1786430543865366', '305', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:42:24.00268+00:00', '2026/2027', 1),
  ('POIN-1786430579344665', '319', 'UID-1779817062842YOUA', '2026-08-09', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-08-11T06:42:59.480873+00:00', '2026/2027', 1),
  ('POIN-1786430819080151', 'XI1-25', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'Lainnya', 'Quiz', 100, '', '2026-08-11T06:46:59.287595+00:00', '2026/2027', 1),
  ('POIN-1786430842352326', 'XI1-11', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-11T06:47:22.495909+00:00', '2026/2027', 1),
  ('POIN-178643088904066', 'XI1-9', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'Lainnya', 'Quiz ', 70, '', '2026-08-11T06:48:09.593321+00:00', '2026/2027', 1),
  ('POIN-1786430959229230', 'XI1-23', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'Lainnya', 'Quiz ', 20, '', '2026-08-11T06:49:19.373013+00:00', '2026/2027', 1),
  ('POIN-1786430939451747', 'XI1-4', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'Lainnya', 'Quiz ', 20, '', '2026-08-11T06:48:59.590656+00:00', '2026/2027', 1),
  ('POIN-1786430917168341', 'XI1-18', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'Lainnya', 'Quiz ', 50, '', '2026-08-11T06:48:37.32534+00:00', '2026/2027', 1),
  ('POIN-1786431008191176', 'XI1-6', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-11T06:50:08.326479+00:00', '2026/2027', 1),
  ('POIN-1786431041007282', 'XI1-2', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-11T06:50:41.155972+00:00', '2026/2027', 1),
  ('POIN-1786431059494585', 'XI1-17', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-11T06:50:59.635291+00:00', '2026/2027', 1),
  ('POIN-1786431024331346', 'XI1-16', 'UID-1779817062842YOUA', '2026-08-08', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-08-11T06:50:24.513185+00:00', '2026/2027', 1),
  ('POIN-1786431095902855', 'XI1-15', 'UID-1779817062842YOUA', '2026-08-08', 'negatif', 'tidur', 'Tidur di Kelas', 5, '', '2026-08-11T06:51:36.540297+00:00', '2026/2027', 1),
  ('POIN-1788753371274596', '354', 'UID-1779817062842YOUA', '2026-09-07', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-07T03:56:11.858319+00:00', '2026/2027', 1),
  ('POIN-1790184560282998', 'XI5-36', 'UID-1779817062842YOUA', '2026-09-17', 'positif', 'Lainnya', 'Quiz', 40, '', '2026-09-23T17:29:20.440771+00:00', '2026/2027', 1),
  ('POIN-1790184631594334', 'XI5-16', 'UID-1779817062842YOUA', '2026-09-17', 'positif', 'Lainnya', 'Quiz', 30, '', '2026-09-23T17:30:32.135197+00:00', '2026/2027', 1),
  ('POIN-1790184678207553', 'XI5-18', 'UID-1779817062842YOUA', '2026-09-17', 'positif', 'Lainnya', 'Quiz', 30, '', '2026-09-23T17:31:19.313322+00:00', '2026/2027', 1),
  ('POIN-1790184644598953', 'XI5-3', 'UID-1779817062842YOUA', '2026-09-17', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-23T17:30:45.57245+00:00', '2026/2027', 1),
  ('POIN-1790184736834642', 'XI5-30', 'UID-1779817062842YOUA', '2026-09-17', 'positif', 'Lainnya', 'Quiz', 20, '', '2026-09-23T17:32:17.457671+00:00', '2026/2027', 1),
  ('POIN-1790531378248493', 'XI1-25', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar 4X', 40, '', '2026-09-27T17:49:39.010138+00:00', '2026/2027', 1),
  ('POIN-1790531399052759', 'XI1-13', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:49:59.560615+00:00', '2026/2027', 1),
  ('POIN-1790531445897242', 'XI1-16', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:50:46.420846+00:00', '2026/2027', 1),
  ('POIN-1790531478100979', 'XI1-9', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar 3X', 30, '', '2026-09-27T17:51:18.865183+00:00', '2026/2027', 1),
  ('POIN-1790531505199769', 'XI1-3', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:51:45.704137+00:00', '2026/2027', 1),
  ('POIN-1790531545321436', 'XI1-18', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:52:26.062393+00:00', '2026/2027', 1),
  ('POIN-179053152191516', 'XI1-7', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:52:02.654347+00:00', '2026/2027', 1),
  ('POIN-1790531580246998', 'XI1-6', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:53:00.752708+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.poin ("id", "siswa_id", "guru_id", "tanggal", "tipe", "kategori", "aktifitas", "poin", "keterangan", "created_at", "tahun_ajar", "semester")
VALUES
  ('POIN-1790531616210151', 'XI1-28', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:53:36.721453+00:00', '2026/2027', 1),
  ('POIN-1790531633507587', 'XI1-11', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:53:54.004729+00:00', '2026/2027', 1),
  ('POIN-1790531661094596', 'XI1-22', 'UID-1779817062842YOUA', '2026-09-26', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:54:21.604016+00:00', '2026/2027', 1),
  ('POIN-1790531811336913', 'XI3-21', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:56:51.852057+00:00', '2026/2027', 1),
  ('POIN-1790531888988713', 'XI3-2', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:58:09.703763+00:00', '2026/2027', 1),
  ('POIN-1790531910578832', 'XI3-34', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 3X', 30, '', '2026-09-27T17:58:31.064092+00:00', '2026/2027', 1),
  ('POIN-1790531956650945', 'XI3-27', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 4X', 40, '', '2026-09-27T17:59:17.161797+00:00', '2026/2027', 1),
  ('POIN-1790531939025920', 'XI3-17', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T17:58:59.55008+00:00', '2026/2027', 1),
  ('POIN-1790531988244563', 'XI3-31', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T17:59:49.004797+00:00', '2026/2027', 1),
  ('POIN-1790532010544851', 'XI3-32', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T18:00:11.307108+00:00', '2026/2027', 1),
  ('POIN-1790532046233259', 'XI3-28', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T18:00:46.990792+00:00', '2026/2027', 1),
  ('POIN-1790532137731842', 'XI3-24', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 5X', 50, '', '2026-09-27T18:02:18.222376+00:00', '2026/2027', 1),
  ('POIN-1790532337438349', 'XI3-3', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-09-27T18:05:37.934973+00:00', '2026/2027', 1),
  ('POIN-1790532385932787', 'XI3-1', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T18:06:26.449778+00:00', '2026/2027', 1),
  ('POIN-1790532403417943', 'XI3-11', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T18:06:43.921496+00:00', '2026/2027', 1),
  ('POIN-1790532421217742', 'XI3-5', 'UID-1779817062842YOUA', '2026-09-20', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-09-27T18:07:01.724542+00:00', '2026/2027', 1),
  ('POIN-1790533561199798', 'XI1-10', 'UID-1779817062842YOUA', '2026-09-26', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin 3X', 75, '', '2026-09-27T18:26:01.93399+00:00', '2026/2027', 1),
  ('POIN-1790830091501721', 'XI4-9', 'UID-1779817062842YOUA', '2026-10-01', 'positif', 'misi', 'Misi Harian Selesai 3X', 45, '', '2026-10-01T04:48:11.753053+00:00', '2026/2027', 1),
  ('POIN-1790830208083746', 'XI4-8', 'UID-1779817062842YOUA', '2026-10-01', 'positif', 'misi', 'Misi Harian Selesai 3X', 45, '', '2026-10-01T04:50:08.626787+00:00', '2026/2027', 1),
  ('POIN-1790830252239908', 'XI4-25', 'UID-1779817062842YOUA', '2026-10-01', 'positif', 'misi', 'Misi Harian Selesai 3X', 45, '', '2026-10-01T04:50:52.823896+00:00', '2026/2027', 1),
  ('POIN-1790830311163369', 'XI4-1', 'UID-1779817062842YOUA', '2026-10-01', 'positif', 'misi', 'Misi Harian Selesai 2X', 30, '', '2026-10-01T04:51:51.73557+00:00', '2026/2027', 1),
  ('POIN-1791036793836854', 'XI1-2', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836774-1', 'XI1-3', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836275-2', 'XI1-4', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836318-3', 'XI1-5', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836293-4', 'XI1-6', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836926-5', 'XI1-7', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836578-6', 'XI1-8', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836721-7', 'XI1-9', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836265-8', 'XI1-10', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836912-9', 'XI1-11', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836785-10', 'XI1-12', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836248-11', 'XI1-13', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836497-12', 'XI1-15', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-179103679383644-13', 'XI1-16', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836563-14', 'XI1-14', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836488-15', 'XI1-17', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836795-16', 'XI1-18', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836502-17', 'XI1-19', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836987-18', 'XI1-20', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836871-19', 'XI1-21', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836877-20', 'XI1-22', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836774-21', 'XI1-23', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836794-22', 'XI1-24', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836114-23', 'XI1-25', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836764-24', 'XI1-26', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791036793836114-25', 'XI1-27', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-179103679383626-26', 'XI1-28', 'UID-1779817062842YOUA', '2026-10-03', 'negatif', 'Lainnya', 'tidak patuh dan tidur sekelas', 25, '', '2026-10-03T14:13:15.175601+00:00', '2026/2027', 1),
  ('POIN-1791682453252368', '287', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252419-2', '292', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.poin ("id", "siswa_id", "guru_id", "tanggal", "tipe", "kategori", "aktifitas", "poin", "keterangan", "created_at", "tahun_ajar", "semester")
VALUES
  ('POIN-1791682453252371-3', '296', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252188-4', '297', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252158-5', '298', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252444-6', '300', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252653-7', '302', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252991-8', '306', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682453252297-9', '309', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'bolos', 'Bolos/Absen Tanpa Izin', 25, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791682491184949', '301', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-11T01:34:51.39677+00:00', '2026/2027', 1),
  ('POIN-1791682522446218', 'XII-1784137806982-oubco', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 5X', 50, '', '2026-10-11T01:35:22.983377+00:00', '2026/2027', 1),
  ('POIN-1791682538921594', '305', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 4X', 40, '', '2026-10-11T01:35:39.477633+00:00', '2026/2027', 1),
  ('POIN-1791682555885916', '310', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-10-11T01:35:56.041449+00:00', '2026/2027', 1),
  ('POIN-1791682570852798', '299', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-10-11T01:36:11.014082+00:00', '2026/2027', 1),
  ('POIN-1791682709996513', '304', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 3X', 30, '', '2026-10-11T01:38:30.294412+00:00', '2026/2027', 1),
  ('POIN-1791682730107350', '290', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-10-11T01:38:50.66141+00:00', '2026/2027', 1),
  ('POIN-1791682730107384-1', '294', 'UID-1779817062842YOUA', '2026-10-11', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-10-11T01:38:50.66141+00:00', '2026/2027', 1),
  ('POIN-1791682453252569-1', '289', 'UID-1779817062842YOUA', '2026-10-11', 'negatif', 'terlambat', 'Terlambat >30 menit', 10, '', '2026-10-11T01:34:13.448133+00:00', '2026/2027', 1),
  ('POIN-1791901501492643', '322', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar 4X', 40, '', '2026-10-13T14:25:01.713912+00:00', '2026/2027', 1),
  ('POIN-1791901533215141', '357', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:25:33.863363+00:00', '2026/2027', 1),
  ('POIN-1791901533215478-1', '332', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:25:33.863363+00:00', '2026/2027', 1),
  ('POIN-1791901533215782-2', '318', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:25:33.863363+00:00', '2026/2027', 1),
  ('POIN-1791901533215228-3', '328', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:25:33.863363+00:00', '2026/2027', 1),
  ('POIN-1791901548032922', '320', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:25:48.185754+00:00', '2026/2027', 1),
  ('POIN-1791901560747529', '314', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar', 10, '', '2026-10-13T14:26:01.338445+00:00', '2026/2027', 1),
  ('POIN-1791901581635642', '314', 'UID-1779817062842YOUA', '2026-10-13', 'positif', 'quiz', 'Jawaban Quiz Benar 2X', 20, '', '2026-10-13T14:26:22.211072+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.grup (22 baris)
-- =====================================================
INSERT INTO public.grup ("id", "guru_id", "judul_kegiatan", "kelas_id", "mapel_id", "tanggal", "data_json", "created_at", "tahun_ajar", "semester")
VALUES
  ('GRP-MRP3EOOX', 'UID-1779817062842YOUA', 'Dua', 'XI 2', 'Informatika', '2026-07-17', '[{"nama_grup":"Grup 1","anggota_ids":["XI2-4","XI2-12","XI2-20","XI2-24"],"metode_generate":"manual"},{"nama_grup":"Grup 2","anggota_ids":["XI2-19","XI2-25","XI2-16","XI2-1","XI2-6","XI2-22"],"metode_generate":"manual"},{"nama_grup":"Grup 3","anggota_ids":["XI2-10","XI2-13","XI2-28","XI2-3","XI2-17"],"metode_generate":"manual"},{"nama_grup":"Grup 4","anggota_ids":["XI2-26","XI2-7","XI2-29","XI2-2","XI2-5"],"metode_generate":"manual"},{"nama_grup":"Grup 5","anggota_ids":["XI2-14","XI2-23","XI2-27","XI2-30","XI2-15"],"metode_generate":"manual"},{"nama_grup":"Grup 6","anggota_ids":["XI2-9","XI2-8","XI2-11","XI2-21","XI2-18"],"metode_generate":"manual"}]'::jsonb, '2026-07-17T15:28:32.652881+00:00', '2026/2027', 1),
  ('GRP-MRP3JFHB', 'UID-1779817062842YOUA', 'Dua', 'XI 3', 'Informatika', '2026-07-17', '[{"nama_grup":"Grup 1","anggota_ids":["XI3-27","XI3-31","XI3-24","XI3-2"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["XI3-17","XI3-3","XI3-6","XI3-35"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["XI3-13","XI3-29","XI3-30","XI3-26"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["XI3-22","XI3-20","XI3-5","XI3-9"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["XI3-36","XI3-32","XI3-21","XI3-11"],"metode_generate":"random"},{"nama_grup":"Grup 6","anggota_ids":["XI3-12","XI3-14","XI3-19","XI3-18"],"metode_generate":"random"},{"nama_grup":"Grup 7","anggota_ids":["XI3-23","XI3-33","XI3-15","XI3-16"],"metode_generate":"random"},{"nama_grup":"Grup 8","anggota_ids":["XI3-1","XI3-4","XI3-34"],"metode_generate":"random"},{"nama_grup":"Grup 9","anggota_ids":["XI3-25","XI3-8","XI3-7"],"metode_generate":"random"},{"nama_grup":"Grup 10","anggota_ids":["XI3-10","XI3-37","XI3-28"],"metode_generate":"random"}]'::jsonb, '2026-07-17T15:32:13.978921+00:00', '2026/2027', 1),
  ('GRP-MS2L50WP', 'UID-1779817062842YOUA', 'Tentang AI', 'XII 5', 'Informatika', '2026-07-27', '[{"nama_grup":"Grup 1","anggota_ids":["246","235","233"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["242","XII-1784137806982-4zsm3","227","234"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["250","255","231","239"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["228","248","249"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["243","251","230"],"metode_generate":"random"},{"nama_grup":"Grup 6","anggota_ids":["236","254","XII-1784137806982-nzllq"],"metode_generate":"random"},{"nama_grup":"Grup 7","anggota_ids":["226","XII-1784137806982-zjpj8","244"],"metode_generate":"random"},{"nama_grup":"Grup 8","anggota_ids":["252","XII-1784137806982-popjk","245"],"metode_generate":"random"},{"nama_grup":"Grup 9","anggota_ids":["247","238","241"],"metode_generate":"random"}]'::jsonb, '2026-07-27T02:05:55.023139+00:00', '2026/2027', 1),
  ('GRP-MS2P8JRR', 'UID-1779817062842YOUA', 'AI', 'XII 4', 'Informatika', '2026-07-27', '[{"nama_grup":"Grup 1","anggota_ids":["353","330","335"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["351","349","348"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["343","329","339"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["325","344","354"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["350","326","365"],"metode_generate":"random"},{"nama_grup":"Grup 6","anggota_ids":["364","327","338"],"metode_generate":"random"},{"nama_grup":"Grup 7","anggota_ids":["345","340","347"],"metode_generate":"random"},{"nama_grup":"Grup 8","anggota_ids":["358","359","352"],"metode_generate":"random"},{"nama_grup":"Grup 9","anggota_ids":["355","XII-1784137806982-wz863","367","366","336","237"],"metode_generate":"random"}]'::jsonb, '2026-07-27T04:00:37.407472+00:00', '2026/2027', 1),
  ('GRP-MS455ARD', 'UID-1779817062842YOUA', 'AI', 'XII 3', 'Informatika', '2026-07-28', '[{"nama_grup":"Grup 1","anggota_ids":["346","316","361"],"metode_generate":"manual"},{"nama_grup":"Grup 2","anggota_ids":["324","314","318"],"metode_generate":"manual"},{"nama_grup":"Grup 3","anggota_ids":["323","360","331"],"metode_generate":"manual"},{"nama_grup":"Grup 4","anggota_ids":["333","328","322"],"metode_generate":"manual"},{"nama_grup":"Grup 5","anggota_ids":["362","311","332","320"],"metode_generate":"manual"},{"nama_grup":"Grup 6","anggota_ids":["357","312","334"],"metode_generate":"manual"},{"nama_grup":"Grup 7","anggota_ids":["341","317","321","363","315","313","342","240","337"],"metode_generate":"manual"}]'::jsonb, '2026-07-28T04:13:46.166629+00:00', '2026/2027', 1),
  ('GRP-MS6W1BTN', 'UID-1779817062842YOUA', 'Mesin pencari ', 'XI 5', 'Informatika', '2026-07-30', '[{"nama_grup":"Grup 1","anggota_ids":["XI5-4","XI5-23","XI5-6","XI5-16","XI5-33","XI5-20"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["XI5-1","XI5-26","XI5-24","XI5-11","XI5-30","XI5-29"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["XI5-2","XI5-35","XI5-19","XI5-31","XI5-25","XI5-12"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["XI5-7","XI5-9","XI5-10","XI5-34","XI5-27","XI5-13"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["XI5-3","XI5-14","XI5-18","XI5-15","XI5-5","XI5-21"],"metode_generate":"random"},{"nama_grup":"Grup 6","anggota_ids":["XI5-17","XI5-8","XI5-36","XI5-28","XI5-22","XI5-32"],"metode_generate":"random"}]'::jsonb, '2026-07-30T02:22:02.966868+00:00', '2026/2027', 1),
  ('GRP-MS6W9RAV', 'UID-1779817062842YOUA', 'Mesin pencari ', 'XI 5', 'Informatika', '2026-07-30', '[{"nama_grup":"Grup 1","anggota_ids":["XI5-14","XI5-28","XI5-12","XI5-16","XI5-8","XI5-31","XI5-21"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["XI5-15","XI5-6","XI5-35","XI5-19","XI5-10","XI5-3","XI5-13","XI5-20"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["XI5-18","XI5-2","XI5-9","XI5-36","XI5-4","XI5-27","XI5-24"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["XI5-26","XI5-25","XI5-17","XI5-32","XI5-11","XI5-7","XI5-33"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["XI5-30","XI5-34","XI5-29","XI5-22","XI5-23","XI5-1","XI5-5"],"metode_generate":"random"}]'::jsonb, '2026-07-30T02:28:35.886416+00:00', '2026/2027', 1),
  ('GRP-MV34Q12D', 'UID-1779817062842YOUA', 'Berpikir Komputasional ', 'XII 2', 'Informatika', '2026-10-11', '[{"id":1,"nama_grup":"KELOMPOK 1","anggota_ids":["XII-1784137806982-oubco","290","285","301"],"metode_generate":"random"},{"id":2,"nama_grup":"KELOMPOK 2","anggota_ids":["295","310","293","307"],"metode_generate":"random"},{"id":3,"nama_grup":"KELOMPOK 3","anggota_ids":["284","303","308","304"],"metode_generate":"random"},{"id":4,"nama_grup":"KELOMPOK 4","anggota_ids":["294","319","305","299"],"metode_generate":"random"}]'::jsonb, '2026-10-11T01:13:14.702645+00:00', '2026/2027', 1),
  ('GRP-MS71AT01', 'UID-1779817062842YOUA', 'Mea', 'XI 4', 'Informatika', '2026-07-30', '[{"nama_grup":"Grup 1","anggota_ids":["XI4-30","XI4-10","XI4-2","XI4-5","XI4-9","XI4-22","XI4-17"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["XI4-34","XI4-20","XI4-16","XI4-12","XI4-1","XI4-8","XI4-35"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["XI4-31","XI4-19","XI4-27","XI4-6","XI4-23","XI4-14","XI4-21"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["XI4-29","XI4-7","XI4-24","XI4-3","XI4-28","XI4-11","XI4-15"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["XI4-25","XI4-18","XI4-32","XI4-26","XI4-13","XI4-4","XI4-33"],"metode_generate":"random"}]'::jsonb, '2026-07-30T04:49:23.23441+00:00', '2026/2027', 1),
  ('GRP-MSB7D69G', 'UID-1779817062842YOUA', 'Mesin pencari ', 'XI 3', 'Informatika', '2026-08-02', '[{"nama_grup":"Grup 1","anggota_ids":["XI3-14","XI3-27","XI3-31","XI3-21","XI3-16"],"metode_generate":"random"},{"nama_grup":"Grup 2","anggota_ids":["XI3-5","XI3-22","XI3-26","XI3-15","XI3-2"],"metode_generate":"random"},{"nama_grup":"Grup 3","anggota_ids":["XI3-33","XI3-24","XI3-36","XI3-25","XI3-23"],"metode_generate":"random"},{"nama_grup":"Grup 4","anggota_ids":["XI3-32","XI3-17","XI3-30","XI3-4","XI3-1"],"metode_generate":"random"},{"nama_grup":"Grup 5","anggota_ids":["XI3-12","XI3-10","XI3-28","XI3-18","XI3-19","XI3-29"],"metode_generate":"random"},{"nama_grup":"Grup 6","anggota_ids":["XI3-35","XI3-20","XI3-11","XI3-9","XI3-37"],"metode_generate":"random"},{"nama_grup":"Grup 7","anggota_ids":["XI3-6","XI3-3","XI3-8","XI3-34","XI3-7","XI3-13"],"metode_generate":"random"}]'::jsonb, '2026-08-02T02:50:16.101928+00:00', '2026/2027', 1),
  ('GRP-MT3QGP4L', 'UID-1779817062842YOUA', 'Membaca lateral ', 'XI 3', 'Informatika', '2026-08-22', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["XI3-29","XI3-3","XI3-5","XI3-20","XI3-22","XI3-30","XI3-9"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XI3-35","XI3-7","XI3-28","XI3-27","XI3-18","XI3-19","XI3-6"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["XI3-31","XI3-21","XI3-8","XI3-24","XI3-32","XI3-12","XI3-17"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["XI3-2","XI3-16","XI3-15","XI3-10","XI3-11","XI3-26"],"metode_generate":"random"}]'::jsonb, '2026-08-22T02:02:26.160389+00:00', '2026/2027', 1),
  ('GRP-MU4WDW5B', 'UID-1779817062842YOUA', 'Analisis data ', 'XI 5', 'Informatika', '2026-09-17', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["XI5-35","XI5-4","XI5-3"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XI5-20","XI5-6","XI5-10"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["XI5-2","XI5-27"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["XI5-31","XI5-18","XI5-25"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["XI5-24","XI5-21","XI5-8"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["XI5-36","XI5-11","XI5-7"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["XI5-1","XI5-15","XI5-5"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["XI5-22","XI5-29","XI5-23"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 9","anggota_ids":["XI5-34","XI5-19","XI5-16"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 10","anggota_ids":["XI5-26","XI5-13"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 11","anggota_ids":["XI5-30","XI5-33","XI5-14"],"metode_generate":"random"}]'::jsonb, '2026-09-17T02:15:41.738892+00:00', '2026/2027', 1),
  ('GRP-MUAP1Z97', 'UID-1779817062842YOUA', 'Algoritma ', 'XII 4', 'Informatika', '2026-09-21', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["336","325","365"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XII-1784137806982-wz863","345","329"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["343","326","367"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["339","340","354"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["335","349","327"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["330","359","358"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["366","348","347"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["351","350","338"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 9","anggota_ids":["355","364","353"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 10","anggota_ids":["344","352"],"metode_generate":"random"}]'::jsonb, '2026-09-21T03:37:05.422052+00:00', '2026/2027', 1),
  ('GRP-MUC4N4NN', 'UID-1779817062842YOUA', 'Sistem komputer ', 'XII 3', 'Informatika', '2026-09-22', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["320","316","341"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["318","317","323"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["315","328","324"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["314","363","357"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["332","360","342"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["321","346","361"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["331","322","312"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["362","333","311"],"metode_generate":"random"}]'::jsonb, '2026-09-22T03:41:12.171667+00:00', '2026/2027', 1),
  ('GRP-MUEVMZDU', 'UID-1779817062842YOUA', 'Analisis Data ', 'XI 5', 'Informatika', '2026-09-24', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["XI5-20","XI5-33","XI5-8","XI5-4"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XI5-5","XI5-30","XI5-31"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["XI5-26","XI5-27","XI5-1"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["XI5-13","XI5-28","XI5-15"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["XI5-11","XI5-34","XI5-23"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["XI5-18","XI5-29","XI5-21"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["XI5-12","XI5-24","XI5-22"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["XI5-10","XI5-19","XI5-16"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 9","anggota_ids":["XI5-25","XI5-35","XI5-7"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 10","anggota_ids":["XI5-9","XI5-36","XI5-3"],"metode_generate":"random"}]'::jsonb, '2026-09-24T01:52:27.67518+00:00', '2026/2027', 1),
  ('GRP-MUEZWD91', 'UID-1779817062842YOUA', 'Analisis data ', 'XI 4', 'Informatika', '2026-09-24', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["XI4-25","XI4-20","XI4-2","XI4-15"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XI4-10","XI4-4","XI4-16","XI4-9"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["XI4-34","XI4-32","XI4-3"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["XI4-28","XI4-30","XI4-17"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["XI4-1","XI4-23","XI4-31"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["XI4-35","XI4-11","XI4-27"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["XI4-18","XI4-19","XI4-5"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["XI4-29","XI4-22","XI4-8"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 9","anggota_ids":["XI4-21","XI4-12","XI4-24"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 10","anggota_ids":["XI4-14","XI4-7","XI4-6"],"metode_generate":"random"}]'::jsonb, '2026-09-24T03:51:44.036309+00:00', '2026/2027', 1),
  ('GRP-MUHV7ISF', 'UID-1779817062842YOUA', 'Analisis data ', 'XI 1', 'Informatika', '2026-09-26', '[{"nama_grup":"KELOMPOK 1","anggota_ids":["XI1-8","XI1-2","XI1-19"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 2","anggota_ids":["XI1-17","XI1-11","XI1-12"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 3","anggota_ids":["XI1-6","XI1-23","XI1-27"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 4","anggota_ids":["XI1-25","XI1-13","XI1-4"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 5","anggota_ids":["XI1-22","XI1-20","XI1-15"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 6","anggota_ids":["XI1-14","XI1-5","XI1-26"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 7","anggota_ids":["XI1-7","XI1-3","XI1-28"],"metode_generate":"random"},{"nama_grup":"KELOMPOK 8","anggota_ids":["XI1-9","XI1-21","XI1-18"],"metode_generate":"random"}]'::jsonb, '2026-09-26T04:03:44.496139+00:00', '2026/2027', 1),
  ('GRP-MULK8C82', 'UID-1779817062842YOUA', 'Sistem komputer ', 'XII 1', 'Informatika', '2026-09-28', '[{"id":1,"nama_grup":"KELOMPOK 1","anggota_ids":["259","257","256","258"],"metode_generate":"random"},{"id":2,"nama_grup":"KELOMPOK 2","anggota_ids":["261","262","263","260"],"metode_generate":"random"},{"id":3,"nama_grup":"KELOMPOK 3","anggota_ids":["264","266","265","268"],"metode_generate":"random"},{"id":4,"nama_grup":"KELOMPOK 4","anggota_ids":["271","270","272","269"],"metode_generate":"random"},{"id":5,"nama_grup":"KELOMPOK 5","anggota_ids":["279","280","281"],"metode_generate":"random"},{"id":6,"nama_grup":"KELOMPOK 6","anggota_ids":["275","276","XII-1784137806982-tlx1p","278"],"metode_generate":"random"}]'::jsonb, '2026-09-28T18:07:31.962641+00:00', '2026/2027', 1),
  ('GRP-MUS86QWS', 'UID-1779817062842YOUA', 'Analisis data', 'XI 3', 'Informatika', '2026-10-03', '[{"id":1,"nama_grup":"KELOMPOK 1","anggota_ids":["XI3-3","XI3-1","XI3-2","XI3-33"],"metode_generate":"random"},{"id":"new-group-1791020954815","nama_grup":"KELOMPOK 2","anggota_ids":["XI3-6","XI3-4","XI3-5"],"metode_generate":"random"},{"id":"new-group-1791020956470","nama_grup":"KELOMPOK 3","anggota_ids":["XI3-7","XI3-8","XI3-9"],"metode_generate":"random"},{"id":"new-group-1791020958924","nama_grup":"KELOMPOK 4","anggota_ids":["XI3-12","XI3-11","XI3-10"],"metode_generate":"random"},{"id":"new-group-1791020960218","nama_grup":"KELOMPOK 5","anggota_ids":["XI3-15","XI3-14","XI3-16"],"metode_generate":"random"},{"id":"new-group-1791020961801","nama_grup":"KELOMPOK 6","anggota_ids":["XI3-18","XI3-19","XI3-17","XI3-36"],"metode_generate":"random"},{"id":"new-group-1791020963489","nama_grup":"KELOMPOK 7","anggota_ids":["XI3-22","XI3-37","XI3-21","XI3-20"],"metode_generate":"random"},{"id":"new-group-1791020964656","nama_grup":"KELOMPOK 8","anggota_ids":["XI3-23","XI3-24","XI3-25"],"metode_generate":"random"},{"id":"new-group-1791020965983","nama_grup":"KELOMPOK 9","anggota_ids":["XI3-27","XI3-26","XI3-28"],"metode_generate":"random"},{"id":"new-group-1791020967921","nama_grup":"KELOMPOK 10","anggota_ids":["XI3-31","XI3-30","XI3-29"],"metode_generate":"random"},{"id":"new-group-1791020969448","nama_grup":"KELOMPOK 11","anggota_ids":["XI3-34","XI3-32","XI3-35"],"metode_generate":"random"}]'::jsonb, '2026-10-03T10:04:45.541949+00:00', '2026/2027', 1),
  ('GRP-MUJ44J2N', 'UID-1779817062842YOUA', 'Sistem komputer ', 'XII 2', 'Informatika', '2026-09-27', '[{"id":"grup-1","nama_grup":"KELOMPOK 1","anggota_ids":["319","297","303"],"metode_generate":"manual"},{"id":"grup-2","nama_grup":"KELOMPOK 2","anggota_ids":["289","299","290"],"metode_generate":"manual"},{"id":"grup-3","nama_grup":"KELOMPOK 3","anggota_ids":["284","301","XII-1784137806982-oubco"],"metode_generate":"manual"},{"id":"grup-4","nama_grup":"KELOMPOK 4","anggota_ids":["305","308","285"],"metode_generate":"manual"},{"id":"grup-5","nama_grup":"KELOMPOK 5","anggota_ids":["295","302","288"],"metode_generate":"manual"},{"id":"grup-6","nama_grup":"KELOMPOK 6","anggota_ids":["304","310","294"],"metode_generate":"manual"},{"id":"new-group-1791554470877","nama_grup":"KELOMPOK 7","anggota_ids":["292","300"],"metode_generate":"manual"}]'::jsonb, '2026-09-27T01:01:08.049955+00:00', '2026/2027', 1),
  ('GRP-MV12KQ54', 'UID-1779817062842YOUA', 'Analisis data', 'XI 2', 'Informatika', '2026-10-09', '[{"id":1,"nama_grup":"KELOMPOK 1","anggota_ids":["XI2-22","XI2-13"],"metode_generate":"random"},{"id":2,"nama_grup":"KELOMPOK 2","anggota_ids":["XI2-9","XI2-18"],"metode_generate":"random"},{"id":3,"nama_grup":"KELOMPOK 3","anggota_ids":["XI2-20","XI2-30"],"metode_generate":"random"},{"id":4,"nama_grup":"KELOMPOK 4","anggota_ids":["XI2-21","XI2-24"],"metode_generate":"random"},{"id":5,"nama_grup":"KELOMPOK 5","anggota_ids":["XI2-10","XI2-26"],"metode_generate":"random"},{"id":6,"nama_grup":"KELOMPOK 6","anggota_ids":["XI2-14","XI2-12"],"metode_generate":"random"},{"id":7,"nama_grup":"KELOMPOK 7","anggota_ids":["XI2-23","XI2-16"],"metode_generate":"random"},{"id":8,"nama_grup":"KELOMPOK 8","anggota_ids":["XI2-4","XI2-2"],"metode_generate":"random"},{"id":9,"nama_grup":"KELOMPOK 9","anggota_ids":["XI2-5","XI2-28"],"metode_generate":"random"},{"id":10,"nama_grup":"KELOMPOK 10","anggota_ids":["XI2-8","XI2-19"],"metode_generate":"random"}]'::jsonb, '2026-10-09T14:37:39.393505+00:00', '2026/2027', 1),
  ('GRP-MV654UZV', 'UID-1779817062842YOUA', 'Berpikir Komputasional ', 'XII 3', 'Informatika', '2026-10-13', '[{"id":1,"nama_grup":"KELOMPOK 1","anggota_ids":["332","363","361","333"],"metode_generate":"random"},{"id":2,"nama_grup":"KELOMPOK 2","anggota_ids":["331","318","316","328"],"metode_generate":"random"},{"id":3,"nama_grup":"KELOMPOK 3","anggota_ids":["357","311","322","362"],"metode_generate":"random"},{"id":4,"nama_grup":"KELOMPOK 4","anggota_ids":["324","360","312","346"],"metode_generate":"random"},{"id":5,"nama_grup":"KELOMPOK 5","anggota_ids":["341","315","342","320"],"metode_generate":"random"},{"id":6,"nama_grup":"KELOMPOK 6","anggota_ids":["314","337","313"],"metode_generate":"random"}]'::jsonb, '2026-10-13T03:48:05.437748+00:00', '2026/2027', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.tugas_online (4 baris)
-- =====================================================
INSERT INTO public.tugas_online ("id", "pin", "judul", "mapel", "materi", "tipe_soal", "soal", "created_by", "created_at")
VALUES
  ('1790821025558', '7YR8JT', 'Praktek Excel', 'Informatika', 'Analisis data ', 'Tunggal', '{"data":"<p>Ketikan&nbsp;nama&nbsp;Kamu&nbsp;</p>","type":"Formatif","_wrapper":true,"kategori":"Pengetahuan","isCBTMode":false,"allowUpload":true}'::jsonb, 'Gesit Widi Atmoko', '2026-10-01T02:17:05.75229+00:00'),
  ('1785381749878', '013C6V', 'Mesin Pencari', 'Informatika', 'Mesin Pencari', 'Kasus', '{"data":["<p><strong>Instruksi&nbsp;Umum:</strong>&nbsp;</p><p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li><li><strong>Hasil&nbsp;(Screenshot/Link):</strong>&nbsp;(Sertakan&nbsp;1&nbsp;tautan&nbsp;hasil&nbsp;pencarian&nbsp;paling&nbsp;relevan&nbsp;dari&nbsp;halaman&nbsp;pertama&nbsp;Google)</li></ol><p></p>","<p><strong>Instruksi&nbsp;Umum:</strong>&nbsp;</p><p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li><li><strong>Hasil&nbsp;(Screenshot/Link):</strong>&nbsp;(Sertakan&nbsp;1&nbsp;tautan&nbsp;hasil&nbsp;pencarian&nbsp;paling&nbsp;relevan&nbsp;dari&nbsp;halaman&nbsp;pertama&nbsp;Google)</li></ol><p></p>","<p><strong>Instruksi&nbsp;Umum:</strong>&nbsp;</p><p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li><li><strong>Hasil&nbsp;(Screenshot/Link):</strong>&nbsp;(Sertakan&nbsp;1&nbsp;tautan&nbsp;hasil&nbsp;pencarian&nbsp;paling&nbsp;relevan&nbsp;dari&nbsp;halaman&nbsp;pertama&nbsp;Google)</li></ol><p></p>","<p><strong>Instruksi&nbsp;Umum:</strong>&nbsp;</p><p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li><li><strong>Hasil&nbsp;(Screenshot/Link):</strong>&nbsp;(Sertakan&nbsp;1&nbsp;tautan&nbsp;hasil&nbsp;pencarian&nbsp;paling&nbsp;relevan&nbsp;dari&nbsp;halaman&nbsp;pertama&nbsp;Google)</li></ol><p></p>","<p><strong>Instruksi&nbsp;Umum:</strong>&nbsp;</p><p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li><li><strong>Hasil&nbsp;(Screenshot/Link):</strong>&nbsp;(Sertakan&nbsp;1&nbsp;tautan&nbsp;hasil&nbsp;pencarian&nbsp;paling&nbsp;relevan&nbsp;dari&nbsp;halaman&nbsp;pertama&nbsp;Google)</li></ol><p></p>"],"type":"Formatif","_wrapper":true,"kategori":"Pengetahuan","isCBTMode":false,"allowUpload":true}'::jsonb, 'Gesit Widi Atmoko', '2026-07-30T03:22:31.665568+00:00'),
  ('1785975373648', '239LS6', 'Mesin Pencari', 'Informatika', 'Informasi Digital', 'Essai', '{"data":[{"id":1785974866903,"pertanyaan":"<p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li></ol><p></p><h3>Studi&nbsp;Kasus&nbsp;1:&nbsp;Si&nbsp;Bendahara&nbsp;Panitia&nbsp;(Fokus:&nbsp;Rentang&nbsp;Angka&nbsp;/&nbsp;Harga)</h3><p><strong>Skenario:</strong>&nbsp;Kamu&nbsp;ditunjuk&nbsp;menjadi&nbsp;bendahara&nbsp;panitia&nbsp;pentas&nbsp;seni&nbsp;(Pensi)&nbsp;sekolah.&nbsp;Kamu&nbsp;ditugaskan&nbsp;mencari&nbsp;jasa&nbsp;sewa&nbsp;<em>sound&nbsp;system</em>&nbsp;di&nbsp;internet.&nbsp;Namun,&nbsp;uang&nbsp;kas&nbsp;panitia&nbsp;terbatas,&nbsp;jadi&nbsp;kamu&nbsp;hanya&nbsp;boleh&nbsp;mencari&nbsp;harga&nbsp;sewa&nbsp;di&nbsp;kisaran&nbsp;<strong>Rp1.500.000&nbsp;sampai&nbsp;Rp3.000.000</strong>&nbsp;saja.</p><p></p><p><strong>Instruksi:</strong>&nbsp;Gunakan&nbsp;simbol&nbsp;titik&nbsp;tiga&nbsp;atau&nbsp;elipsis&nbsp;untuk&nbsp;membuat&nbsp;kata&nbsp;kunci&nbsp;pencarian&nbsp;agar&nbsp;Google&nbsp;hanya&nbsp;menampilkan&nbsp;harga&nbsp;yang&nbsp;pas&nbsp;dengan&nbsp;<em>budget</em>&nbsp;(dana)&nbsp;panitiamu!</p>"},{"id":1785974876937,"pertanyaan":"<p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li></ol><p></p><h3>Studi&nbsp;Kasus&nbsp;2:&nbsp;Penggemar&nbsp;Sastra&nbsp;(Fokus:&nbsp;Kutipan&nbsp;Persis&nbsp;&amp;&nbsp;Format&nbsp;<em>File</em>)</h3><p><strong>Skenario:</strong>&nbsp;Guru&nbsp;Bahasa&nbsp;Indonesia&nbsp;menugaskanmu&nbsp;membuat&nbsp;resensi&nbsp;dari&nbsp;cerpen&nbsp;terkenal&nbsp;karya&nbsp;A.A.&nbsp;Navis&nbsp;yang&nbsp;berjudul&nbsp;<em>Robohnya&nbsp;Surau&nbsp;Kami</em>.&nbsp;Karena&nbsp;di&nbsp;perpustakaan&nbsp;bukunya&nbsp;sedang&nbsp;dipinjam&nbsp;teman,&nbsp;kamu&nbsp;ingin&nbsp;membaca&nbsp;teks&nbsp;aslinya&nbsp;secara&nbsp;<em>online</em>.&nbsp;Agar&nbsp;bisa&nbsp;dibaca&nbsp;saat&nbsp;tidak&nbsp;ada&nbsp;kuota&nbsp;internet,&nbsp;kamu&nbsp;butuh&nbsp;yang&nbsp;bentuk&nbsp;filenya&nbsp;dokumen&nbsp;siap&nbsp;<em>download</em>&nbsp;(PDF).</p><p></p><p><strong>Instruksi:</strong>&nbsp;Buat&nbsp;rumus&nbsp;pencarian&nbsp;agar&nbsp;kamu&nbsp;langsung&nbsp;menemukan&nbsp;dokumen&nbsp;PDF&nbsp;dari&nbsp;cerpen&nbsp;tersebut&nbsp;dengan&nbsp;judul&nbsp;yang&nbsp;akurat,&nbsp;tanpa&nbsp;harus&nbsp;nyasar&nbsp;ke&nbsp;blog&nbsp;pribadi&nbsp;orang&nbsp;lain!</p>"},{"id":1785974879870,"pertanyaan":"<p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li></ol><p></p><h3>Studi&nbsp;Kasus&nbsp;3:&nbsp;Pencari&nbsp;Definisi&nbsp;Bebas&nbsp;Iklan&nbsp;(Fokus:&nbsp;Judul&nbsp;&amp;&nbsp;Pengecualian)</h3><p><strong>Skenario:</strong>&nbsp;Kamu&nbsp;mendapat&nbsp;PR&nbsp;Fisika&nbsp;untuk&nbsp;mencari&nbsp;artikel&nbsp;tentang&nbsp;penemu&nbsp;&quot;Teropong&nbsp;Bintang&quot;.&nbsp;Namun,&nbsp;tiap&nbsp;kali&nbsp;kamu&nbsp;<em>googling</em>,&nbsp;yang&nbsp;muncul&nbsp;malah&nbsp;toko&nbsp;<em>online</em>&nbsp;yang&nbsp;berjualan&nbsp;teropong&nbsp;mainan.&nbsp;Kamu&nbsp;ingin&nbsp;artikel&nbsp;yang&nbsp;judul&nbsp;utamanya&nbsp;<em>pasti</em>&nbsp;membahas&nbsp;penemu&nbsp;alat&nbsp;tersebut,&nbsp;dan&nbsp;kamu&nbsp;sama&nbsp;sekali&nbsp;<strong>tidak&nbsp;mau</strong>&nbsp;melihat&nbsp;hasil&nbsp;dari&nbsp;situs&nbsp;yang&nbsp;mengandung&nbsp;kata&nbsp;&quot;jual&quot;&nbsp;atau&nbsp;&quot;harga&quot;.</p><p></p><p><strong>Instruksi:</strong>&nbsp;Susunlah&nbsp;trik&nbsp;pencariannya&nbsp;agar&nbsp;bersih&nbsp;dari&nbsp;situs&nbsp;jualan!</p>"},{"id":1785974881919,"pertanyaan":"<p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li></ol><p></p><h3>Studi&nbsp;Kasus&nbsp;4:&nbsp;Si&nbsp;Penulis&nbsp;Esai&nbsp;yang&nbsp;Cerdas&nbsp;(Fokus:&nbsp;Sinonim&nbsp;Kata)</h3><p><strong>Skenario:</strong>&nbsp;Kamu&nbsp;sedang&nbsp;menulis&nbsp;esai&nbsp;tentang&nbsp;teknologi&nbsp;untuk&nbsp;tugas&nbsp;akhir.&nbsp;Topikmu&nbsp;adalah&nbsp;&quot;kendaraan&quot;.&nbsp;Kamu&nbsp;merasa&nbsp;tulisanmu&nbsp;akan&nbsp;membosankan&nbsp;kalau&nbsp;terus-terusan&nbsp;memakai&nbsp;kata&nbsp;yang&nbsp;sama&nbsp;saat&nbsp;<em>googling</em>&nbsp;mencari&nbsp;bahan.&nbsp;Kamu&nbsp;ingat&nbsp;ada&nbsp;simbol&nbsp;ajaib&nbsp;di&nbsp;Google&nbsp;yang&nbsp;bisa&nbsp;menyuruh&nbsp;mesin&nbsp;pencari&nbsp;mencarikan&nbsp;padanan&nbsp;kata&nbsp;(sinonim)&nbsp;dari&nbsp;kendaraan.</p><p></p><p><strong>Instruksi:</strong>&nbsp;Buat&nbsp;rumus&nbsp;pencarian&nbsp;Google&nbsp;untuk&nbsp;mencari&nbsp;info&nbsp;tentang&nbsp;<em>kendaraan</em>&nbsp;listrik,&nbsp;tetapi&nbsp;gunakan&nbsp;simbol&nbsp;yang&nbsp;akan&nbsp;menyuruh&nbsp;Google&nbsp;ikut&nbsp;mencari&nbsp;sinonim&nbsp;dari&nbsp;kata&nbsp;&quot;kendaraan&quot;&nbsp;(seperti&nbsp;mobil,&nbsp;motor,&nbsp;transportasi,&nbsp;dll)!</p>"},{"id":1785974883886,"pertanyaan":"<p>Bacalah&nbsp;skenario&nbsp;di&nbsp;bawah&nbsp;ini.&nbsp;Tugas&nbsp;kalian&nbsp;bukan&nbsp;sekadar&nbsp;menemukan&nbsp;jawabannya,&nbsp;melainkan&nbsp;<strong>merumuskan&nbsp;kata&nbsp;kunci&nbsp;(kueri)&nbsp;yang&nbsp;paling&nbsp;efektif</strong>&nbsp;menggunakan&nbsp;trik&nbsp;<em>Search&nbsp;Engine</em>&nbsp;yang&nbsp;telah&nbsp;dipelajari&nbsp;(site:,&nbsp;filetype:,&nbsp;&quot;&nbsp;&quot;,&nbsp;-,&nbsp;dll).&nbsp;Kumpulkan&nbsp;format&nbsp;jawaban&nbsp;berupa:</p><ol><li><strong>Kueri&nbsp;Pencarian:</strong>&nbsp;(Ketikkan&nbsp;rumus&nbsp;pencarian&nbsp;yang&nbsp;kamu&nbsp;gunakan)</li><li><strong>Alasan:</strong>&nbsp;(Mengapa&nbsp;kamu&nbsp;menggunakan&nbsp;rumus&nbsp;tersebut?)</li></ol><p></p><h3>Studi&nbsp;Kasus&nbsp;5:&nbsp;Detektif&nbsp;Berita&nbsp;Lupa&nbsp;Ingatan&nbsp;(Fokus:&nbsp;<em>Site</em>&nbsp;&amp;&nbsp;<em>Wildcard</em>)</h3><p><strong>Skenario:</strong>&nbsp;Kamu&nbsp;ingat&nbsp;bulan&nbsp;lalu&nbsp;membaca&nbsp;berita&nbsp;sains&nbsp;yang&nbsp;sangat&nbsp;menarik&nbsp;di&nbsp;situs&nbsp;<em>Kompas</em>&nbsp;(kompas.com)&nbsp;tentang&nbsp;fenomena&nbsp;langit&nbsp;&quot;Gerhana&nbsp;Bulan...&quot;.&nbsp;Tapi,&nbsp;kamu&nbsp;benar-benar&nbsp;lupa&nbsp;kelanjutan&nbsp;jenis&nbsp;gerhananya&nbsp;(apakah&nbsp;itu&nbsp;gerhana&nbsp;bulan&nbsp;total,&nbsp;sebagian,&nbsp;merah,&nbsp;atau&nbsp;cincin).&nbsp;Kamu&nbsp;hanya&nbsp;ingat&nbsp;depannya&nbsp;dan&nbsp;ingat&nbsp;situs&nbsp;berita&nbsp;yang&nbsp;memuatnya.</p><p></p><p><strong>Instruksi:</strong>&nbsp;Tuliskan&nbsp;rumus&nbsp;yang&nbsp;bisa&nbsp;memerintahkan&nbsp;Google&nbsp;mengisi&nbsp;kata&nbsp;yang&nbsp;kamu&nbsp;lupakan&nbsp;tersebut&nbsp;secara&nbsp;otomatis,&nbsp;dan&nbsp;pastikan&nbsp;pencariannya&nbsp;tidak&nbsp;nyasar&nbsp;ke&nbsp;situs&nbsp;web&nbsp;lain&nbsp;selain&nbsp;<em>Kompas</em>!</p>"}],"type":"Formatif","_wrapper":true,"kategori":"Pengetahuan","isCBTMode":false,"allowUpload":false}'::jsonb, 'Gesit Widi Atmoko', '2026-08-06T00:16:13.924259+00:00'),
  ('1789958607746', 'UFKQ05', 'Algoritma ', 'Informatika', 'Sistem Komputer ', 'Tunggal', '{"data":"<p>Kumpulan&nbsp;file</p>","type":"Formatif","_wrapper":true,"kategori":"Pengetahuan","isCBTMode":false,"allowUpload":true}'::jsonb, 'Gesit Widi Atmoko', '2026-09-21T02:43:28.45457+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.pengumpulan_tugas (100 baris)
-- =====================================================
INSERT INTO public.pengumpulan_tugas ("id", "waktu", "pin", "kelas", "nama_siswa", "no_absen", "jawaban_teks", "link_file", "nilai", "siswa_id")
VALUES
  (41, '2026-08-06T01:57:16.234901+00:00', '239LS6', 'XI 5', 'Zaskia Ika Rahmadhani', '36', '[No. 1]
harga Rp1.500.000...Rp3.000.000
karna merncari rentang angka/harga

[No. 2]
zaskia ika rahmadhani 
syarifah annisa ramadhani

[No. 3]
"teropong bintang"
karena untuk mencari hasil yang sama persis

[No. 4]
aaa

[No. 5]
*gerhana bulan*
karena mencari ganti kata yang hilang', '', NULL, 'XI5-36'),
  (44, '2026-08-06T01:57:48.813169+00:00', '239LS6', 'XI 5', 'Kamila Insani Kaisan', '13', '[No. 1]
AAAAA

[No. 2]
File tupe :Alasan hanya cari file rentang waktu

[No. 3]
... :Alasan hasil sama persis

[No. 4]
Site : Alasan hanya dari situs tersebut

[No. 5]
* : Alasan ganti kata yang hilang
Nur rahma rahmadhani', '', NULL, 'XI5-14'),
  (42, '2026-08-06T01:57:26.643019+00:00', '239LS6', 'XI 5', 'Hani Umi Latipah', '12', '[No. 1]
AI

[No. 2]
Robohnya Surau Kami file type:PDF
karna mencari jenis file

[No. 3]
IQ

[No. 4]
AM

[No. 5]
"Gerhana*Bulan"
karna mencari kata ganti yang hilang


yang mengerjakan:
khumaira nur fadyah', '', 95, 'XI5-12'),
  (47, '2026-08-06T02:17:19.669914+00:00', '239LS6', 'XI 5', 'Dwi Apriyanti', '8', '[No. 1]
"jasa sewa sound system dengan budget Rp1500000 sampai Rp3000000"
karna ingin hasil sangat persis 


[No. 2]
intitle :Robohnya Surau Kami filetype:PDF 
karna kata wajib ada di judul dan hanya cari jenis file 


[No. 3]
"Teropong Bintang-jual atau harga "
karna kecuali kata 

[No. 4]
A


[No. 5]
site:Kompas.com Gerhana bulan 
hanya ada di situs tersebut 
', '', 80, 'XI5-8'),
  (48, '2026-08-06T02:19:02.166919+00:00', '239LS6', 'XI 5', 'Rifa Iyyah', '25', '[No. 1]
1.sewa sound system RP1.500.000 ... RP3.000.000
2.karna mencari rentang harga

[No. 2]
1.''''Robohnya Surau Kami filetype:pdf''''
2.karna mencari hasil yang sama persis dan mencari jenis dari file tersebut

[No. 3]
1.intitle:teropong bintang - jual harga
2.karna mencari kata wajib di judul dan mengecualikan kata

[No. 4]
ranti amelia sama rifa iyyah><

[No. 5]
1.site: kompas.com Gerhana Bulan* 
2.karna hanya mencari dari situs tersebut dan ganti kata yang hilang   ', '', 100, 'XI5-26'),
  (43, '2026-08-06T01:57:27.352037+00:00', '239LS6', 'XI 5', 'Cantika Berlianda Putri', '5', '[No. 1]
aaa

[No. 2]
aaa

[No. 3]
1.-

[No. 4]
aaa

[No. 5]
1.kompas.com Gerhana bulan
2.kata wajib ada di link', '', NULL, 'XI5-5'),
  (45, '2026-08-06T02:11:57.025106+00:00', '239LS6', 'XI 5', 'Siti Nurhaliza', '30', '[No. 1]
abillgemoyyyyylizaaacuteeeee

[No. 2]
Siti Anissah Bilqis

[No. 3]
''''Teropong Bintang''''
karena untuk hasil yang sama persis

[No. 4]
''''kendaraan''''
karena untuk mencari hasil yang sama persis

[No. 5]
*Gerhana Bulan*
karena mengganti kata yang hilang', '', 100, 'XI5-31'),
  (46, '2026-08-06T02:17:04.033019+00:00', '239LS6', 'XI 5', 'Versi Ellora Bakti', '34', '[No. 1]
q

[No. 2]
a

[No. 3]
''''Teropong Bintang''''
karna untuk mencari hasil sama persis

[No. 4]
site:,filetype''''kendaraan''''-,
karena hanya untuk situs tersebut

[No. 5]
''''Gerhana Bulan
alasanya untuk ganti kata yang hilang ', '', NULL, 'XI5-34'),
  (49, '2026-08-06T02:32:13.454235+00:00', '239LS6', 'XI 5', 'Fatkhiyatuz Zahroh', '11', '[No. 1]
"jasa sewa sound system di internet"
karena hasil sama persis

[No. 2]
a

[No. 3]
teropong bintang-jual atau harga
karena kecuali kata

[No. 4]
a

[No. 5]
a', '', NULL, 'XI5-11'),
  (50, '2026-08-06T02:32:57.941928+00:00', '239LS6', 'XI 5', 'Kulsum Khotimah', '17', '[No. 1]
... mencari jasa sewa sound dengan harga rp.1.500.000 sampai rp.3.000.000

[No. 2]
''''robohnya surau kami''''

[No. 3]
'''' teropong bintang''''.

[No. 4]
''''kendaraan''''

[No. 5]
''''...''''apakah itu gerhana bulan total,sebagian,merah,atau cincin', '', NULL, 'XI5-13'),
  (51, '2026-08-06T02:33:06.891704+00:00', '239LS6', 'XI 5', 'Elisa Riski', '9', '[No. 1]
site:, filetype:, "Rp1.500.000 sa mpai Rp3.000.000", -,
karna hanya dari situs tersebut 

[No. 2]
a

[No. 3]
"Teropong Bintang".
karna hasil sama persis

[No. 4]
"kendaraan-mobil
kecuali kata

[No. 5]
"langit*Gerhana Bulan"
ganti kata yang hilang', '', NULL, 'XI5-9'),
  (52, '2026-08-06T02:34:10.972125+00:00', '239LS6', 'XI 5', 'Ayu Salimah', '4', '[No. 1]
 1 .''''Rp1.500.000 sampai Rp3.000.000''''  
 2 . karena hasil sama persis 

[No. 2]
1. file type: ''''cerpen terkenal karya A.A.Navis yang berjudul Robohnya Surau Kami'''' 
2.karena hanya cari jenis file 

[No. 3]
1.''''Teropong Bintang''''_jual atau harga''''
2. karena kecuali kata 

[No. 4]
wismi diniarti 
ayu salimah 

[No. 5]
a', '', NULL, 'XI5-4'),
  (53, '2026-08-06T02:42:52.216038+00:00', '239LS6', 'XI 5', 'Nisa Alfizah', '21', '[No. 1]
''''...''''harga sewa di kisaran rp.1.500.000 sampai rp. 3.000.000 saja

[No. 2]
'''' robohnya surau kami ''''

[No. 3]
'''' jual'''' atau ''''harga''''.

[No. 4]
'''' kendaraan ''''

[No. 5]
''''gerhana bulan ''''', '', NULL, 'XI5-21'),
  (54, '2026-08-06T02:45:19.169718+00:00', '239LS6', 'XI 5', 'Naswa Puspa Ningrum', '20', '[No. 1]
"mencari jasa sewa sound dengan harga 1.500.000"



[No. 2]
"Robohnya surau kami"

[No. 3]
"tropong bintang"

[No. 4]
"kendaraan"

[No. 5]
"apakah itu gerhana bulan total"', '', NULL, 'XI5-20'),
  (55, '2026-08-06T02:50:32.914961+00:00', '239LS6', 'XI 5', 'Risma Ayu Ramadhani', '26', '[No. 1]
'''' 1.mencari harga sewa di kisaran Rp1.500.000 sampai Rp3.000.000 ''''
'''' rentang waktu ''''

[No. 2]
aa

[No. 3]
''''Teropong Bintang''''
karena hasil yang sama persis

[No. 4]
aa

[No. 5]
''''Gerhana Bulan''''
karna hasil yang sama persis', '', NULL, 'XI5-27'),
  (61, '2026-08-06T04:20:50.706276+00:00', '239LS6', 'XI 4', 'Riva Anzila Rahma', '16', '[No. 1]
jasa sewa sound system dengan harga kisaran Rp1.500.000 ... Rp3.000.000  
rumus yg di gunakan operator ...
alasan karna rentang angka 


[No. 2]
a

[No. 3]
intitle:Teropong Bintang

[No. 4]
a

[No. 5]
Riva anzila rahma
Siva meryana ', '', 80, 'XI4-18'),
  (60, '2026-08-06T04:17:26.122975+00:00', '239LS6', 'XI 4', 'Ulfiatul Khoiroh', '29', '[No. 1]
"Jasa sewa sound system dengan harga sewa Rp1.500.000...Rp3.000.000" 
Alasan saya menggunakan tanda kutip agar hasil pencarian sama persis, dan tanda titik tiga agar menampilkan hasil pencarian yang menyebutkan angka. 
Nama: Rahmatika Khoirunnisa, dan Ulfiatul Khoiroh.

[No. 2]
"Cerpen berjudul Rubuhnya Surau Kami karya A.A. Navis." Filetype:PDF
Alasan kami menggunakan tanda kutip agar hasil pencarian sama persis, dan kami menggunakan Filetype:PDF agar dokumen bisa terdownload.

[No. 3]
A

[No. 4]
A

[No. 5]
 A', '', 100, 'XI4-11'),
  (58, '2026-08-06T04:10:48.167801+00:00', '239LS6', 'XI 4', 'Refa Putriyanti', '12', '[No. 1]
saran dikasaran RP1.500.000 RP3.000.000









[No. 2]
aaaaaaaa

[No. 3]
Refa Putri Yanti

[No. 4]
saniya raudhotul latifah

[No. 5]
aaaaaaaaaaaa', '', 10, 'XI4-14'),
  (70, '2026-08-06T04:48:04.827583+00:00', '239LS6', 'XI 4', 'Syla Hafidzah Ramadhani', '26', '[No. 1]
"Jasa sewa sound system di kisaran harga Rp1.500.000...Rp3.000.000"
karna kami menggunakan tanda petik agar hasil sama persis,dan tanda titik tiga untuk mencari judul yang mengandung angka.

[No. 2]
" Judul Cerpen Robohnya Surau Kami karya A.A. Navis filetype:PDF."
karna kami ingin mencari jenis file tertentu, dan karna kami ingin mencari hasil sama persis.

[No. 3]
Aaaaaaa

[No. 4]
Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

[No. 5]
Nama:Syla Hafidzah Ramadhani
         ;Rahma Romadhona', '', NULL, 'XI4-27'),
  (57, '2026-08-06T04:10:28.475523+00:00', '239LS6', 'XI 4', 'Nazila Rahmatika Habib', '1', '[No. 1]
''''sewa sound system harga kisaran Rp1.500.000-Rp3.000.000''''
Kuari pencarian: ''''...''''
Alasan:mencari hasil sama persis

[No. 2]
Nazila Rahmatika Habib
Sava Novia Sari 

[No. 3]
''''Teropong Bintang-jual-harga''''
kueri pencarian:''''...'''' dan -
alasan:mencari hasil sama persis dan kecuali kata jual-harga

[No. 4]
aaaaa

[No. 5]
''''Gerhana Bulan * .Kompas.com''''', '', 80, 'XI4-1'),
  (59, '2026-08-06T04:11:00.669347+00:00', '239LS6', 'XI 4', 'Neva Setia Ningsih', '3', '[No. 1]
jasa sewa sound system Rp1.500.000...Rp3.000.000

[No. 2]
''''robohnya surau kami karya A.A.Navis ''''filetype;pdf

[No. 3]
neva setia ningsih
resti muthia rahmawati

[No. 4]
aaaaaaaaa

[No. 5]
aaaaa', '', 85, 'XI4-3'),
  (71, '2026-08-06T04:54:15.416798+00:00', '239LS6', 'XI 4', 'Zaskia Aulia Putri', '34', '[No. 1]
aaaaaaaaaaaaaaaaaaaaaaa

[No. 2]
Filetype:"pdfRobohnyaSurauKami"
Alasan: saya menggunakan tanda filetype karna hanya mencari jenis file tertentu

[No. 3]
aaaaaaaaaaaaaaaaaaaaaaaa

[No. 4]
aaaaaaaaaaaaaaaaaaaaa

[No. 5]
zaskia aulia putri 
zahra alya fathiya', '', NULL, 'XI4-34'),
  (62, '2026-08-06T04:25:59.076749+00:00', '239LS6', 'XI 4', 'Nazwa May Nur Winarni', '2', '[No. 1]
1.jasa sewa sound system mulai harga Rp1.500.000 ... Rp3.000.000
2.alasannya mencari rentang angka

[No. 2]
a

[No. 3]
1. penemu Teropong Bintang-jual mainan
2.alasannya adalah setiap kali saya mencari yang muncul adalah tempat orang yang berjualan   mainan.

[No. 4]
aa

[No. 5]
aa', '', 70, 'XI4-2'),
  (63, '2026-08-06T04:29:18.175651+00:00', '239LS6', 'XI 4', 'Silvi Zulia Asrofi', '22', '[No. 1]
jasa sewa sound system harga kisaran Rp1.500.000...Rp3.000.000
alasan kami menggunakan titik tiga karena rentang angka

[No. 2]
filetype:pdfRobohnyaSurauKami
alasannya:hanya cari jenis file tertentu

[No. 3]
silvi zulia gemoy
Nurkhani cute

[No. 4]
ochhhh

[No. 5]
smeeee', '', 70, 'XI4-24'),
  (64, '2026-08-06T04:30:50.518244+00:00', '239LS6', 'XI 4', 'Nur Indah Safitri', '6', '[No. 1]
jasa sawa sound system  harga kisaran Rp1.500.000...Rp3.000.000
alasalan kami menggunakan titik tiga karna memiki fungsi untuk rentang angka

[No. 2]
filetype:pdRobohnyasuraukami
alasan kami memakai filetype karena memiki fungsi hanya cari jenis file tertentu

[No. 3]
''''triasari'''' 

[No. 4]
nurindah

[No. 5]
TRIA SARI RETNO WATI ', '', 80, 'XI4-6'),
  (67, '2026-08-06T04:36:41.330127+00:00', '239LS6', 'XI 4', 'Rima Septiani', '15', '[No. 1]
a

[No. 2]
a

[No. 3]
a

[No. 4]
1.''''kendaraan''''
2.karena saya mendapat tugas untuk mencari topik yang berjudul besar kendaraan.

[No. 5]
1.site:Gerhana bulan.com bulan lalu
2.karena lupa jenis gerhana bulan yang terjadi bulan lalu', '', NULL, 'XI4-17'),
  (65, '2026-08-06T04:32:33.030871+00:00', '239LS6', 'XI 4', 'Novi Nuraini', '4', '[No. 1]
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa



[No. 2]
aaaaaaaaaaaaaaaaaaaaaaaa

[No. 3]
1. Teropong Bintang-penjual mainan 
2 karena (-) kecuali kata karna setiap saya mencari namun yang muncul malah toko online yang berjualan teropong mainan 

[No. 4]
aaaaaaaaaaaaaaaaaaaaa

[No. 5]
1''''gerhana bulan*''''', '', 55, 'XI4-4'),
  (56, '2026-08-06T04:09:52.773846+00:00', '239LS6', 'XI 4', 'Qoonitah Simanjuntak', '9', '[No. 1]
sewa dikisaran Rp1.500.000...Rp3.000.000
1.kueri pencarian: ...
2.alasannya : rentang angka 

[No. 2]
qoonitahtasyaaacomellllllllllll

[No. 3]
qoonitahsimanjuntak
thasyanurdianingsih


[No. 4]
harus100 ya pak

[No. 5]
gatau seterah yang penting ngisi nilainya 100', '', 50, 'XI4-9'),
  (66, '2026-08-06T04:36:32.636322+00:00', '239LS6', 'XI 4', 'Pika Mutiara', '8', '[No. 1]
jasa sewa sound system harga sewa kisaran Rp1.500.000 ... Rp3.000.000
alasanya : rentang angka

[No. 2]
"cerpen yang berjudul ROBOHNYA SURAU KAMI karya A.A .Navis
agar bisa dibaca saat tidak ada kuota internet yang bentuk filenya dokumen siap downlod [PDF]







[No. 3]
aaaaaaaaaa

[No. 4]
aaaaaaaa

[No. 5]
pika mutiara
sopi ariani', '', 80, 'XI4-8'),
  (68, '2026-08-06T04:40:52.881489+00:00', '239LS6', 'XI 4', 'Winnie Alenskia Sirait', '30', '[No. 1]
a

[No. 2]
filetype;pdf robohnya surau kami

[No. 3]
a

[No. 4]
kendaraan listrik - mobil 

[No. 5]
intitle;tentang fenomena langit ''''gerhana bulan * '''' kompas . com', '', 60, 'XI4-30'),
  (69, '2026-08-06T04:45:17.201774+00:00', '239LS6', 'XI 4', 'Rizkia Indana Zulfa', '18', '[No. 1]
"Jasa sewa sound system. Di kisaran harga Rp1.500.000...Rp3.000.000" 
alasan: tanda kutip karena mencari judul yang sama persis, dan tanda titik tiga  untuk menunjukan hasil yang mengadung angka.

[No. 2]
a

[No. 3]
"Penemu teropong bintang -jual dan harga."
alasan:kecuali kata kami menggunakan tanda [-]
dan kami menggunakan tanda kutip hasilnya sama persis

[No. 4]
Di kerjakan oleh Rizkia Indana Zulfa dan Siva Afril Lanni 

[No. 5]
a', '', NULL, 'XI4-20'),
  (72, '2026-08-06T04:55:22.260957+00:00', '239LS6', 'XI 4', 'Zarwa Sugiarti', '33', '[No. 1]
a

[No. 2]
intitle: cerpen yang berjudul ROBOHNYA SURAU KAMI karya A.A. Navis

Agar bisa di baca saat tidak ada kuota internet, yang bentuk filenya dokumen siap download 

[No. 3]
zarwa sugiarti 
yasmin safinatun najwa

[No. 4]
kendaraan listrik - mobil

kecuali kata 

[No. 5]
kompas "Gerhana Bulan*".com.

ganti kata yang hilang ', '', NULL, 'XI4-33'),
  (101, '2026-09-21T03:08:26.152993+00:00', 'UFKQ05', 'XII 5', 'Dea Putri Rahmawati', '3', '
', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/3_Dea_Putri_Rahmawati_DEAAAA2.docx', NULL, '228'),
  (73, '2026-08-08T02:22:35.807865+00:00', '239LS6', 'XI 3', 'Hafidzah Aulia Azhari', '24', '[No. 1]
Jasa sewa sound system harga sewa 1500000 ... 3000000

[No. 2]
"Novel Robohnya Surau Kami karya A.A Navis filetype:PDF

[No. 3]
"Teropong Bintang -jual"

[No. 4]
"transportasi listrik"

[No. 5]
"fenomena langit Gerhana Bulan * site:kompas.com"', '', NULL, 'XI3-24'),
  (74, '2026-08-08T02:27:16.236803+00:00', '239LS6', 'XI 3', 'Nabila Azizah', '36', '[No. 1]
jasa sewa sound system harga sewa 150000 ... 3000000

[No. 2]
''''robohnya surau kami karya A.A Navis''''

[No. 3]
''''Teropong Bintang - jual''''

[No. 4]
''''kendaraan''''site:mobil

[No. 5]
''''Gerhana Bulan * '''' site:kompas.com', '', NULL, 'XI3-36'),
  (75, '2026-08-08T02:36:52.171643+00:00', '239LS6', 'XI 3', 'Muhajarotul Khusnia', '33', '[No. 1]
jasa sewa sound system 1.500.00...3.000.000  

[No. 2]
''''karya A.A navis yang berjudul robohnya surau kami'''' filetype:pdf:''''

[No. 3]
''''Teropong Bintang-jual

[No. 4]
tranportasi listrik 

[No. 5]
aaaaa', '', NULL, 'XI3-33'),
  (76, '2026-08-08T02:39:29.740725+00:00', '239LS6', 'XI 3', 'Fitri Rahma Sari', '23', '[No. 1]
''''jasa sewa sound system 150000...3000000''''

[No. 2]
'''' karya A.A Navis yang berjudul Robohnya surau kami filetype:PDF''''


[No. 3]
''''Teropong Bintang-jual''''

[No. 4]
'''' mobil listrik''''

[No. 5]
''''Gerhana Bulan*'''' site:kompas.com', '', NULL, 'XI3-23'),
  (77, '2026-08-08T02:40:24.103944+00:00', '239LS6', 'XI 3', 'Hafizah Husnatullaila', '25', '[No. 1]
jasa sewa sound system 1500000 ... 3000000

[No. 2]
''''karya A.A. Navis yang berjudul Robohnya Surau Kami filetype:PDF''''

[No. 3]
 ''''Teropong Bintang-jual''''

[No. 4]
''''kendaraan'''' site:mobil

[No. 5]
''''Gerhana Bulan*''''site:kompas', '', NULL, 'XI3-25'),
  (78, '2026-08-08T02:43:34.70623+00:00', '239LS6', 'XI 3', 'Fauziah Zulfa Riski', '20', '[No. 1]
1.kueri pencarian -1.500.000sewa sound system  1.500.000 sampai 3.000.000 
alasan nya ;untuk mencari yang lewat dari harga tersebuta

[No. 2]
''''cerpen terkenal a.a. navis yang berjudul robohnya surau kami ''''

[No. 3]
a

[No. 4]
a

[No. 5]
a', '', NULL, 'XI3-20'),
  (79, '2026-08-08T02:48:10.479688+00:00', '239LS6', 'XI 3', 'Mutiara', '35', '[No. 1]
1. kueri pencarian : ...1.500.000 jasa sewa sound system 1.500.00 sampai 3.000.000
2. alasan : menggunakan rumus ... untuk membuat kata kunci pencarian agar gogle hanya menampilkan harga yang pas dengan budget (dana) panitiamu


[No. 2]
a

[No. 3]
1. kueri pencarian : teropong bintang - teropong mainan  
2. alasan : menggunakan rumus  - ( pengecualian kata ) agar kamu melihat apa yang ingin kamu car

[No. 4]
a

[No. 5]
a', '', NULL, 'XI3-35'),
  (80, '2026-08-08T02:48:49.496803+00:00', '239LS6', 'XI 3', 'Dea Ananta Siregar', '11', '[No. 1]
''''jasa sewa sound system harga sewa  kisaran 1.500.000 sampai 3.000.000'''' Alasan ('''' '''') Untuk memaksa goole mencari yg sama persis

[No. 2]
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

[No. 3]
''''Teropong Bintang'''' ( - ) : ''''Teropong Bintang - mainan'''' Alasan :Agar pencarian tidak memuncul kan kata setelah ( - )tersebut

[No. 4]
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

[No. 5]
''''Gerhana Bulan ...'''' ''''Gerhana Bulan * '''' (*)untuk mencari kata yg hilang', '', NULL, 'XI3-11'),
  (81, '2026-08-08T02:48:57.452559+00:00', '239LS6', 'XI 3', 'Nayzila Dwi Lestari', '37', '[No. 1]
1. Kueri Pencarian: ...1.500.000 jasa sewa sound system 1.500.000 sampai 3.000.000
2.Alasan:Menggunakan rumus ... untuk membuat kata kunci pencarian agar Google hanya menampilkan harga yang pas dengan budget (dana) panitiamu!

[No. 2]
aaaa

[No. 3]
1.Kueri Pencarian :Teropong Bintang -Teropong Mainan
2.Alasan :Menggunakan rumus - (pengecualian kata) agar kamu melihat apa yang ingin kamu cari

[No. 4]
aaaaaaaaa

[No. 5]
aaaaaaaa', '', NULL, 'XI3-37'),
  (82, '2026-08-08T02:50:06.969098+00:00', '239LS6', 'XI 3', 'Ayu Kanza Salamah', '9', '[No. 1]
"Harga sewa sound system di kisaran Rp1.500.000 ... Rp3.000.000"




[No. 2]
"cerpen terkenal karya A.A. Navis''Intitle:Robohnya Surau Kami filetype:PDF"

[No. 3]
"Teropong Bintang-Teropong mainan''site:prfisika"

[No. 4]
*

[No. 5]
*', '', NULL, 'XI3-9'),
  (83, '2026-09-21T02:57:22.496115+00:00', 'UFKQ05', 'XII 5', 'Melany', '14', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/14_Melany_memellyaa_2.docx', NULL, 'XII-1784137806982-popjk'),
  (84, '2026-09-21T02:57:25.225907+00:00', 'UFKQ05', 'XII 5', 'Intan Nur Febrianti', '11', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/11_Intan_Nur_Febrianti_INTAN_NUR_FEBRIANTI.docx', NULL, 'XII-1784137806982-zjpj8'),
  (85, '2026-09-21T02:58:48.102994+00:00', 'UFKQ05', 'XII 5', 'Lusiana Maysaroh', '13', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/13_Lusiana_Maysaroh_tabel_tabel_lucy.docx', NULL, '239'),
  (86, '2026-09-21T02:59:53.886054+00:00', 'UFKQ05', 'XII 5', 'Seftia Ramadhani', '23', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/23_Seftia_Ramadhani_septia_xII.docx', NULL, '248'),
  (87, '2026-09-21T03:01:38.525474+00:00', 'UFKQ05', 'XII 5', 'Syafaatul Uzma Abdillah', '24', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/24_Syafaatul_Uzma_Abdillah_AHN_TULUZZ.docx', NULL, '249'),
  (88, '2026-09-21T03:01:59.139355+00:00', 'UFKQ05', 'XII 5', 'Zaneta Maya Suryani', '28', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/28_Zaneta_Maya_Suryani_zant.docx', NULL, '254'),
  (89, '2026-09-21T03:02:06.4685+00:00', 'UFKQ05', 'XII 5', 'Miftahus Salamah', '15', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/15_Miftahus_Salamah_miftaalqaa.docx', NULL, '241')
ON CONFLICT DO NOTHING;

INSERT INTO public.pengumpulan_tugas ("id", "waktu", "pin", "kelas", "nama_siswa", "no_absen", "jawaban_teks", "link_file", "nilai", "siswa_id")
VALUES
  (90, '2026-09-21T03:02:15.504044+00:00', 'UFKQ05', 'XII 5', 'Syafaatul Uzma Abdillah', '24', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/24_Syafaatul_Uzma_Abdillah_Syafa_tuluzz.docx', NULL, '249'),
  (91, '2026-09-21T03:02:17.831441+00:00', 'UFKQ05', 'XII 5', 'Syafika Khoerunnisa', '25', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/25_Syafika_Khoerunnisa_viekaa_imuett.docx', NULL, '250'),
  (92, '2026-09-21T03:03:18.108045+00:00', 'UFKQ05', 'XII 5', 'Efriza Wati', '5', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/5_Efriza_Wati_EFRIZA.docx', NULL, '230'),
  (93, '2026-09-21T03:03:31.594989+00:00', 'UFKQ05', 'XII 5', 'Ressa Clarawati', '21', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/21_Ressa_Clarawati_clara_lingkaran.docx', NULL, '246'),
  (94, '2026-09-21T03:03:40.812245+00:00', 'UFKQ05', 'XII 5', 'Chika Kasih Ardana', '2', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/2_Chika_Kasih_Ardana_ksihhhhhh.docx', NULL, '227'),
  (95, '2026-09-21T03:05:15.682529+00:00', 'UFKQ05', 'XII 5', 'Zian Sephia Cinta Ramadani', '29', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/29_Zian_Sephia_Cinta_Ramadani_Doc4.docx', NULL, '255'),
  (96, '2026-09-21T03:05:30.891311+00:00', 'UFKQ05', 'XII 5', 'Putri Natalia', '20', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/20_Putri_Natalia_putri.docx', NULL, '245'),
  (97, '2026-09-21T03:06:55.86282+00:00', 'UFKQ05', 'XII 5', 'Firni Tara Santika', '7', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/7_Firni_Tara_Santika_firni_imut.docx', NULL, '233'),
  (98, '2026-09-21T03:08:11.010951+00:00', 'UFKQ05', 'XII 5', 'Dety Novita Liana', '4', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/4_Dety_Novita_Liana_Dety_Novita_Liana.docx', NULL, 'XII-1784137806982-4zsm3'),
  (99, '2026-09-21T03:08:19.392274+00:00', 'UFKQ05', 'XII 5', 'Tri Nuraini', '27', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/27_Tri_Nuraini_ainiiiiiiii_lui.docx', NULL, '252'),
  (100, '2026-09-21T03:08:20.096985+00:00', 'UFKQ05', 'XII 5', 'Heni Miftahul Jannah', '8', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/8_Heni_Miftahul_Jannah_X11_heni_miftakhul_jannah.docx', NULL, '234'),
  (102, '2026-09-21T03:09:01.906711+00:00', 'UFKQ05', 'XII 5', 'Ina Yatus Syifa', '9', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/9_Ina_Yatus_Syifa_DEAAAA2.docx', NULL, '235'),
  (103, '2026-09-21T03:12:06.805346+00:00', 'UFKQ05', 'XII 5', 'Erika Zola Nuraini', '6', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/6_Erika_Zola_Nuraini_firni_imut.docx', NULL, '231'),
  (104, '2026-09-21T03:13:58.043934+00:00', 'UFKQ05', 'XII 5', 'Saufa Ajry', '22', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/22_Saufa_Ajry_SAUFA.....docx', NULL, '247'),
  (105, '2026-09-21T03:14:06.517679+00:00', 'UFKQ05', 'XII 5', 'Anisa Avrilian Shenia', '1', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/1_Anisa_Avrilian_Shenia_Lian_XII.5.docx', NULL, '226'),
  (106, '2026-09-21T03:14:27.281471+00:00', 'UFKQ05', 'XII 5', 'Novira Sulistia', '17', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/17_Novira_Sulistia_novira_kelassssss_x11.docx', NULL, '243'),
  (107, '2026-09-21T03:14:31.273647+00:00', 'UFKQ05', 'XII 5', 'Nuria Aulia Gadis', '18', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/18_Nuria_Aulia_Gadis_X114_nayla_putri_-pratek_1.docx', NULL, '244'),
  (108, '2026-09-21T03:16:34.471382+00:00', 'UFKQ05', 'XII 5', 'Syifa Salsabila Mahfud', '26', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/26_Syifa_Salsabila_Mahfud_adhannn__zii.docx', NULL, '251'),
  (109, '2026-09-21T03:18:30.159088+00:00', 'UFKQ05', 'XII 5', 'Mutia Az Zahra Mauliana R', '16', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/16_Mutia_Az_Zahra_Mauliana_R_mutia_azzahra.docx', NULL, '242'),
  (110, '2026-09-21T03:22:53.576389+00:00', 'UFKQ05', 'XII 5', 'Parida Anum', '19', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/19_Parida_Anum_Masala1.docx', NULL, 'XII-1784137806982-nzllq'),
  (111, '2026-09-21T03:25:24.872363+00:00', 'UFKQ05', 'XII 5', 'Dea Putri Rahmawati', '3', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/UFKQ05/3_Dea_Putri_Rahmawati_woi.docx', NULL, '228'),
  (112, '2026-10-01T02:28:50.405974+00:00', '7YR8JT', 'XI 5', 'Nurrahma Rahmadhani', '23', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/23_Nurrahma_Rahmadhani_NURRAHMA_RAHMADHANI.xlsx', NULL, 'XI5-23'),
  (113, '2026-10-01T02:28:58.446896+00:00', '7YR8JT', 'XI 5', 'Ayu Bunga Lestari', '3', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/3_Ayu_Bunga_Lestari_X15_AYU_BUNGA_LESTARI_IMT.xlsx', NULL, 'XI5-3'),
  (114, '2026-10-01T02:28:58.76923+00:00', '7YR8JT', 'XI 5', 'Dwi Apriyanti', '8', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/8_Dwi_Apriyanti_DWIAPRIYANTI.xlsx', NULL, 'XI5-8'),
  (115, '2026-10-01T02:28:59.537296+00:00', '7YR8JT', 'XI 5', 'Hani Umi Latipah', '12', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/12_Hani_Umi_Latipah_HANI_UMI_LATIPAH.xlsx', NULL, 'XI5-12'),
  (116, '2026-10-01T02:29:02.311044+00:00', '7YR8JT', 'XI 5', 'Zaskia Ika Rahmadhani', '36', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/36_Zaskia_Ika_Rahmadhani_XI-ZASKIA_IKA_RAHMADHANI.xlsx', NULL, 'XI5-36'),
  (117, '2026-10-01T02:29:18.418569+00:00', '7YR8JT', 'XI 5', 'Serlina Anggriani', '28', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/28_Serlina_Anggriani_SERLINA_ANGGRIANI.xlsx', NULL, 'XI5-29'),
  (118, '2026-10-01T02:29:38.83545+00:00', '7YR8JT', 'XI 5', 'Cantika Berlianda Putri', '5', 'AYU SALIMAH 
CANTIKA BERLIANDA PUTRI', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/5_Cantika_Berlianda_Putri_Cantika_Berlianda_Putri.xlsx', NULL, 'XI5-5'),
  (119, '2026-10-01T02:29:43.500927+00:00', '7YR8JT', 'XI 5', 'Naswa Puspa Ningrum', '20', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/20_Naswa_Puspa_Ningrum_XI5NASWA_PUSPA_NINGRUM.xlsx', NULL, 'XI5-20'),
  (120, '2026-10-01T02:29:44.313728+00:00', '7YR8JT', 'XI 5', 'Citra Agustia', '7', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/7_Citra_Agustia_citra_agustia.xlsx', NULL, 'XI5-7'),
  (121, '2026-10-01T02:30:11.210539+00:00', '7YR8JT', 'XI 5', 'Sabrina Aita Safaroh', '27', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/27_Sabrina_Aita_Safaroh_XI.5_sabrina_aita_safaroh.xlsx', NULL, 'XI5-28'),
  (122, '2026-10-01T02:30:13.511713+00:00', '7YR8JT', 'XI 5', 'Ukhtia Rahmadani', '32', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/32_Ukhtia_Rahmadani_X15_Ukhtia_Rahmadani.xlsx', NULL, 'XI5-33'),
  (123, '2026-10-01T02:30:17.939194+00:00', '7YR8JT', 'XI 5', 'Fara Nuriana', '10', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/10_Fara_Nuriana_Fara_Nuriana.xlsx', NULL, 'XI5-10'),
  (124, '2026-10-01T02:30:24.222208+00:00', '7YR8JT', 'XI 5', 'Elisa Riski', '9', 'ELISA RISKI', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/9_Elisa_Riski_ELISA_RISKI.xlsx', NULL, 'XI5-9'),
  (125, '2026-10-01T02:30:49.81939+00:00', '7YR8JT', 'XI 5', 'Siti Nurhaliza', '30', 'siti nurhaliza', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/30_Siti_Nurhaliza_SITI_NURHALIZA.xlsx', NULL, 'XI5-31'),
  (126, '2026-10-01T02:30:57.845777+00:00', '7YR8JT', 'XI 5', 'Siti Anisah Bilqis Sugiono', '29', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/29_Siti_Anisah_Bilqis_Sugiono_XI-5_siti_anissah_bilqis.xlsx', NULL, 'XI5-30'),
  (127, '2026-10-01T02:31:01.264943+00:00', '7YR8JT', 'XI 5', 'Versi Ellora Bakti', '34', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/34_Versi_Ellora_Bakti_xI-5_versi_ellora.xlsx', NULL, 'XI5-34'),
  (128, '2026-10-01T02:32:44.208849+00:00', '7YR8JT', 'XI 5', 'Fatkhiyatuz Zahroh', '11', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/11_Fatkhiyatuz_Zahroh_Book1.xlsx', NULL, 'XI5-11'),
  (129, '2026-10-01T02:35:12.810402+00:00', '7YR8JT', 'XI 5', 'Wismi Diniarti', '35', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/35_Wismi_Diniarti_Wismi_Diniarti.xlsx', NULL, 'XI5-35'),
  (130, '2026-10-01T02:35:44.51853+00:00', '7YR8JT', 'XI 5', 'Najwa Tsaqova', '19', 'najwa tsaqofa ', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/19_Najwa_Tsaqova_NAJWA_TSAQOVA_XI_5.xlsx', NULL, 'XI5-19'),
  (131, '2026-10-01T02:38:25.721737+00:00', '7YR8JT', 'XI 5', 'Kamila Insani Kaisan', '13', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/13_Kamila_Insani_Kaisan_Kamila_insani_kaisan.xlsx', NULL, 'XI5-14'),
  (132, '2026-10-01T02:42:54.519682+00:00', '7YR8JT', 'XI 5', 'Atikah Miftakhul Jannah', '2', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/2_Atikah_Miftakhul_Jannah_Atika_X15.xlsx', NULL, 'XI5-2'),
  (133, '2026-10-01T02:44:22.180047+00:00', '7YR8JT', 'XI 5', 'Ulfatus Saiba', '33', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/33_Ulfatus_Saiba_ulfatussaiba_ips.xlsx', NULL, 'XI5-24'),
  (134, '2026-10-01T02:44:57.65632+00:00', '7YR8JT', 'XI 5', 'Kulsum Khotimah', '17', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/17_Kulsum_Khotimah_kulsum_khotimah_kls_11.5_ips.xlsx', NULL, 'XI5-13'),
  (135, '2026-10-01T02:46:53.436408+00:00', '7YR8JT', 'XI 5', 'Ranti Amelia', '24', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/24_Ranti_Amelia_rantiii_amelliaaaaa.xlsx', NULL, 'XI5-25'),
  (136, '2026-10-01T02:47:31.983888+00:00', '7YR8JT', 'XI 5', 'Kanza Nurmadinatul Arsya', '14', 'jaringan tidak bisa komputer eror', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/14_Kanza_Nurmadinatul_Arsya_Book1.xlsx', NULL, 'XI5-15'),
  (137, '2026-10-01T02:47:47.977319+00:00', '7YR8JT', 'XI 5', 'Khumaira Nur Fadyah', '15', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/15_Khumaira_Nur_Fadyah_Khumaira_Nur_Fadyah.xlsx', NULL, 'XI5-16'),
  (138, '2026-10-01T02:48:03.806944+00:00', '7YR8JT', 'XI 5', 'Meifa Zumratul Latifah', '18', 'meifa cantikkkkkkkkkkkkkkk
rifa imupppppppppppppppp', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/18_Meifa_Zumratul_Latifah_Rifa_Iyyah_imut__Meifa_cantikk_.xlsx', NULL, 'XI5-18'),
  (139, '2026-10-01T02:51:00.876583+00:00', '7YR8JT', 'XI 5', 'Novi Yani Dongoran', '22', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/22_Novi_Yani_Dongoran_SERLINA_ANGGRIANI.xlsx', NULL, 'XI5-22'),
  (140, '2026-10-01T02:54:01.159982+00:00', '7YR8JT', 'XI 5', 'Nisa Alfizah', '21', '', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/tugas-siswa/7YR8JT/21_Nisa_Alfizah_nisa_al_fizah_kls_x5.xlsx', NULL, 'XI5-21')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.catatan (1 baris)
-- =====================================================
INSERT INTO public.catatan ("id", "user_id", "judul", "isi", "warna", "pinned", "created_at", "updated_at", "foto_url")
VALUES
  ('28e5a46d-3b73-46dc-b780-12a6b4548314', 'UID-1779817062842YOUA', 'test', 'tets gambar', 'cream', FALSE, '2026-08-02T13:46:17.074869+00:00', '2026-08-02T13:46:17.074869+00:00', 'https://mfxhtrnzrovdjpvktrun.supabase.co/storage/v1/object/public/catatan-foto/63c31206-b156-4957-9ec6-025f47a2ee62/28e5a46d-3b73-46dc-b780-12a6b4548314.png')
ON CONFLICT DO NOTHING;

-- Tabel public.notifikasi: (0 baris / Kosong)
-- =====================================================
-- DATA: public.game_packages (1 baris)
-- =====================================================
INSERT INTO public.game_packages ("id", "name", "subject", "grade", "materi", "icon", "game_title", "tagline", "sub_title", "id_user", "created_at", "updated_at")
VALUES
  ('pkg_1788028530004_2f4sh', 'Informatika Kelas XII', 'Informatika', 'Kelas 12', 'Informatika Sekarang dan masa depan', '🖥️', 'ARENA OF CHAMPION', 'Think Fast. Solve Smart. Become the Champion!', '', NULL, '2026-08-29T18:35:31.033335+00:00', '2026-08-29T18:41:20.614+00:00')
ON CONFLICT DO NOTHING;

-- =====================================================
-- DATA: public.game_questions (3 baris)
-- =====================================================
INSERT INTO public.game_questions ("id", "package_id", "question_number", "topic", "grade", "question", "options", "answer", "explanation", "points", "created_at")
VALUES
  ('q_pkg_1788028530004_2f4sh_1788028848664_0_tnnj', 'pkg_1788028530004_2f4sh', 1, 'Materi Umum', 'Kelas XII', '[Genetika) Basa nitrogen yang menggantikan Timin pada RNA adalah.', '["Urasil","Adenin","Guanin","Sitosin"]'::jsonb, 'Urasil', '', 10, '2026-08-29T18:40:48.868934+00:00'),
  ('q_pkg_1788028530004_2f4sh_1788028848664_1_0y27', 'pkg_1788028530004_2f4sh', 2, 'Materi Umum', 'Kelas XII', 'tMetab01isme] Tahap glikolisis terjadi di...', '["Sitosol","Mit0kond1ia"]'::jsonb, 'Sitosol', '', 10, '2026-08-29T18:40:48.868934+00:00'),
  ('q_pkg_1788028530004_2f4sh_1788028879335_0_da06', 'pkg_1788028530004_2f4sh', 2, 'Materi Umum', 'Kelas XII', 'tMetab01isme] Tahap glikolisis terjadi di...', '["Sitosol","Mit0kond1ia"]'::jsonb, 'Sitosol', '', 10, '2026-08-29T18:41:19.543363+00:00')
ON CONFLICT DO NOTHING;

-- Tabel public.game_sessions: (0 baris / Kosong)
-- =====================================================
-- RESET SEQUENCES UNTUK TABEL DENGAN SERIAL PRIMARY KEY
-- =====================================================
SELECT setval(pg_get_serial_sequence('public.wali_kelas', 'id'), COALESCE(max(id), 1)) FROM public.wali_kelas;
SELECT setval(pg_get_serial_sequence('public.absensi_harian_siswa', 'id'), COALESCE(max(id), 1)) FROM public.absensi_harian_siswa;
SELECT setval(pg_get_serial_sequence('public.absensi_mapel_siswa', 'id'), COALESCE(max(id), 1)) FROM public.absensi_mapel_siswa;
SELECT setval(pg_get_serial_sequence('public.nilai_siswa', 'id'), COALESCE(max(id), 1)) FROM public.nilai_siswa;
SELECT setval(pg_get_serial_sequence('public.pengumpulan_tugas', 'id'), COALESCE(max(id), 1)) FROM public.pengumpulan_tugas;

-- Kembalikan role ke mode normal
SET session_replication_role = 'origin';

COMMIT;

-- =====================================================
-- SELESAI: RESTORE DATA BERHASIL
-- =====================================================
