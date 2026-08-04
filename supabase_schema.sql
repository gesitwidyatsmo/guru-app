-- ==========================================
-- SCRIPT SQL: MIGRASI GURU-APP KE SUPABASE
-- FASE 1: FOUNDATION & DATA MASTER
-- ==========================================

-- Mengaktifkan ekstensi UUID (Jika belum ada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL USERS (Profil Pengguna)
-- Catatan: Kita tetap menggunakan id_user lama (format UID-xxx) agar tidak 
-- merusak relasi data lama, namun kita tambahkan auth_id yang terhubung ke Supabase Auth.
CREATE TABLE public.users (
    id_user TEXT PRIMARY KEY,
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    nama_lengkap TEXT NOT NULL,
    role TEXT CHECK (role IN ('Admin', 'Guru')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mengaktifkan Row Level Security (RLS) untuk Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Admin bisa melihat semua, Guru hanya bisa melihat data mereka sendiri 
-- (Namun karena kita butuh admin/guru melihat profil, kita buat bisa dibaca semua authenticated user)
CREATE POLICY "Users can be viewed by authenticated users" 
ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert users" 
ON public.users FOR INSERT TO authenticated 
WITH CHECK ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

CREATE POLICY "Admin can update users" 
ON public.users FOR UPDATE TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

CREATE POLICY "Admin can delete users" 
ON public.users FOR DELETE TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 2. TABEL KELAS
CREATE TABLE public.kelas (
    id TEXT PRIMARY KEY,
    nama_kelas TEXT UNIQUE NOT NULL,
    wali_kelas TEXT,
    id_wali_kelas TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kelas can be viewed by authenticated users" ON public.kelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage kelas" ON public.kelas FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 3. TABEL MAPEL
CREATE TABLE public.mapel (
    id TEXT PRIMARY KEY,
    mapel TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mapel can be viewed by authenticated users" ON public.mapel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage mapel" ON public.mapel FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 4. TABEL SISWA
CREATE TABLE public.siswa (
    id TEXT PRIMARY KEY,
    nis TEXT,
    nama_lengkap TEXT NOT NULL,
    kelas TEXT REFERENCES public.kelas(nama_kelas) ON UPDATE CASCADE ON DELETE SET NULL,
    jenis_kelamin TEXT CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
    status TEXT DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Siswa can be viewed by authenticated users" ON public.siswa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage siswa" ON public.siswa FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 5. TABEL GURU_KBM
CREATE TABLE public.guru_kbm (
    id_kbm TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    kelas TEXT REFERENCES public.kelas(nama_kelas) ON UPDATE CASCADE ON DELETE CASCADE,
    mapel TEXT REFERENCES public.mapel(mapel) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guru_kbm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KBM can be viewed by authenticated users" ON public.guru_kbm FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage KBM" ON public.guru_kbm FOR ALL TO authenticated 
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
CREATE POLICY "Guru can manage their own KBM" ON public.guru_kbm FOR ALL TO authenticated 
USING ( id_user = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- ==========================================
-- FASE 2: CORE FEATURES (Jadwal, Jurnal, Nilai)
-- ==========================================

-- 6. TABEL JADWAL (Dinormalisasi dari format JSON lama)
CREATE TABLE public.jadwal (
    id TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    mapel TEXT,
    kelas TEXT,
    hari TEXT,
    jam_ke TEXT,
    jam_mulai TEXT,
    jam_selesai TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jadwal can be viewed by authenticated users" ON public.jadwal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage jadwal" ON public.jadwal FOR ALL TO authenticated USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );
CREATE POLICY "Guru can manage their own jadwal" ON public.jadwal FOR ALL TO authenticated USING ( id_user = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- 7. TABEL JURNAL
CREATE TABLE public.jurnal (
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jurnal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jurnal can be viewed by authenticated users" ON public.jurnal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own jurnal" ON public.jurnal FOR ALL TO authenticated USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- 8. TABEL NILAI TUGAS & NILAI SISWA (Dinormalisasi dari JSON)
CREATE TABLE public.nilai_tugas (
    tugas_id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    kategori TEXT,
    type TEXT,
    deskripsi TEXT,
    kelas TEXT,
    mapel TEXT,
    tanggal DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nilai_tugas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nilai Tugas can be viewed by authenticated users" ON public.nilai_tugas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own nilai_tugas" ON public.nilai_tugas FOR ALL TO authenticated USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE TABLE public.nilai_siswa (
    id SERIAL PRIMARY KEY,
    tugas_id TEXT REFERENCES public.nilai_tugas(tugas_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_siswa TEXT,
    nilai NUMERIC,
    UNIQUE(tugas_id, siswa_id)
);

ALTER TABLE public.nilai_siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nilai Siswa can be viewed by authenticated users" ON public.nilai_siswa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own nilai_siswa" ON public.nilai_siswa FOR ALL TO authenticated 
USING ( (SELECT guru_id FROM public.nilai_tugas WHERE tugas_id = public.nilai_siswa.tugas_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- ==========================================
-- FASE 3: ATTENDANCE (Absensi)
-- ==========================================

-- 9. TABEL ABSENSI HARIAN & SISWA
CREATE TABLE public.absensi_harian (
    sesi_id TEXT PRIMARY KEY,
    tanggal DATE,
    kelas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.absensi_harian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Absensi harian can be viewed by authenticated users" ON public.absensi_harian FOR SELECT TO authenticated USING (true);
-- Wali kelas atau admin
CREATE POLICY "Guru and admin can manage absensi harian" ON public.absensi_harian FOR ALL TO authenticated USING (true);

CREATE TABLE public.absensi_harian_siswa (
    id SERIAL PRIMARY KEY,
    sesi_id TEXT REFERENCES public.absensi_harian(sesi_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    status TEXT,
    keterangan TEXT,
    UNIQUE(sesi_id, siswa_id)
);

ALTER TABLE public.absensi_harian_siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Absensi harian siswa can be viewed by authenticated users" ON public.absensi_harian_siswa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru and admin can manage absensi harian siswa" ON public.absensi_harian_siswa FOR ALL TO authenticated USING (true);

-- 10. TABEL ABSENSI MAPEL & SISWA
CREATE TABLE public.absensi_mapel (
    sesi_id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    tanggal DATE,
    jam_ke TEXT,
    kelas TEXT,
    mapel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.absensi_mapel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Absensi mapel can be viewed by authenticated users" ON public.absensi_mapel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own absensi mapel" ON public.absensi_mapel FOR ALL TO authenticated USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE TABLE public.absensi_mapel_siswa (
    id SERIAL PRIMARY KEY,
    sesi_id TEXT REFERENCES public.absensi_mapel(sesi_id) ON DELETE CASCADE,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    status TEXT,
    keterangan TEXT,
    UNIQUE(sesi_id, siswa_id)
);

ALTER TABLE public.absensi_mapel_siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Absensi mapel siswa can be viewed by authenticated users" ON public.absensi_mapel_siswa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own absensi mapel siswa" ON public.absensi_mapel_siswa FOR ALL TO authenticated 
USING ( (SELECT guru_id FROM public.absensi_mapel WHERE sesi_id = public.absensi_mapel_siswa.sesi_id) = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- ==========================================
-- FASE 4: EXTRAS (Poin, Grup, Tugas Online)
-- ==========================================

-- 11. TABEL POIN
CREATE TABLE public.poin (
    id TEXT PRIMARY KEY,
    siswa_id TEXT REFERENCES public.siswa(id) ON DELETE CASCADE,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    tanggal DATE,
    tipe TEXT,
    kategori TEXT,
    aktifitas TEXT,
    poin INTEGER,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.poin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poin can be viewed by authenticated users" ON public.poin FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own poin" ON public.poin FOR ALL TO authenticated USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );
CREATE POLICY "Admin can manage poin" ON public.poin FOR ALL TO authenticated USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- 12. TABEL GRUP
CREATE TABLE public.grup (
    id TEXT PRIMARY KEY,
    guru_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    judul_kegiatan TEXT,
    kelas_id TEXT,
    mapel_id TEXT,
    tanggal DATE,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.grup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Grup can be viewed by authenticated users" ON public.grup FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guru can manage their own grup" ON public.grup FOR ALL TO authenticated USING ( guru_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- 13. TABEL TUGAS ONLINE & PENGUMPULAN TUGAS
CREATE TABLE public.tugas_online (
    id TEXT PRIMARY KEY,
    pin TEXT UNIQUE,
    judul TEXT,
    mapel TEXT,
    materi TEXT,
    tipe_soal TEXT,
    kategori TEXT,
    type TEXT,
    soal JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tugas_online ENABLE ROW LEVEL SECURITY;
-- Tugas online bisa dibaca publik/siswa dengan pin, jadi SELECT bebas saja, insert/update perlu auth
CREATE POLICY "Tugas online can be viewed by anyone" ON public.tugas_online FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tugas online can be managed by authenticated users" ON public.tugas_online FOR ALL TO authenticated USING (true);

CREATE TABLE public.pengumpulan_tugas (
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
-- Insert by anonymous (siswa), SELECT by authenticated
CREATE POLICY "Siswa can insert pengumpulan_tugas" ON public.pengumpulan_tugas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Pengumpulan_tugas can be viewed by authenticated users" ON public.pengumpulan_tugas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pengumpulan_tugas can be deleted by authenticated users" ON public.pengumpulan_tugas FOR DELETE TO authenticated USING (true);

-- ==========================================
-- FASE 5: CATATAN PRIBADI GURU
-- ==========================================

-- 14. TABEL CATATAN
CREATE TABLE public.catatan (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    judul TEXT,
    isi TEXT,
    warna TEXT DEFAULT 'cream',
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catatan ENABLE ROW LEVEL SECURITY;

-- Hanya pemilik catatan yang bisa melihat, membuat, mengubah, dan menghapus catatannya sendiri
CREATE POLICY "User can view their own catatan"
ON public.catatan FOR SELECT TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can insert their own catatan"
ON public.catatan FOR INSERT TO authenticated
WITH CHECK ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can update their own catatan"
ON public.catatan FOR UPDATE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can delete their own catatan"
ON public.catatan FOR DELETE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- Trigger untuk auto-update kolom updated_at setiap kali catatan diubah
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catatan_updated_at
BEFORE UPDATE ON public.catatan
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
