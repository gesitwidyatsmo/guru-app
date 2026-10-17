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
