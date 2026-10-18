-- ===========================================================================
-- MIGRATION: Tambah Role 'Kesiswaan' ke Tabel public.users & Skema Modul Kesiswaan
-- GuruApp — Desain & Fondasi Role Kesiswaan
-- ===========================================================================
-- Deskripsi:
-- 1. Memperbarui check constraint pada kolom role tabel public.users agar
--    mengizinkan nilai 'Kesiswaan'.
-- 2. Menyiapkan tabel pendukung:
--    - kesiswaan_sanksi (Surat Peringatan, Sanksi, Pemanggilan Ortu)
--    - kesiswaan_prestasi (Pencatatan prestasi lomba akademik/non-akademik)
--    - ekskul & ekskul_anggota (Pengelolaan ekstrakurikuler & anggotanya)
-- 3. Mengatur Row Level Security (RLS) untuk keamanan akses.
-- ===========================================================================

-- 1. PERBARUI CHECK CONSTRAINT ROLE
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara', 'Kesiswaan'));

-- 2. TABEL SURAT PERINGATAN & SANKSI
CREATE TABLE IF NOT EXISTS public.kesiswaan_sanksi (
    id SERIAL PRIMARY KEY,
    no_surat VARCHAR(100) UNIQUE,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    jenis_sanksi VARCHAR(50) NOT NULL, -- 'SP1', 'SP2', 'SP3', 'Teguran', 'Skorsing', 'Panggilan Ortu'
    alasan TEXT NOT NULL,
    akumulasi_poin_saat_terbit INT DEFAULT 0,
    tanggal_terbit DATE NOT NULL DEFAULT CURRENT_DATE,
    tanggal_panggilan DATE,
    batas_waktu_skorsing DATE,
    status_penyelesaian VARCHAR(30) DEFAULT 'Menunggu' CHECK (status_penyelesaian IN ('Menunggu', 'Dalam Pembinaan', 'Selesai', 'Dibatalkan')),
    tindak_lanjut TEXT,
    diterbitkan_oleh TEXT REFERENCES public.users(id_user),
    berkas_lampiran TEXT,
    tahun_ajar_id TEXT,
    semester INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kesiswaan_sanksi_siswa ON public.kesiswaan_sanksi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_kesiswaan_sanksi_status ON public.kesiswaan_sanksi(status_penyelesaian);

-- 3. TABEL PRESTASI SISWA
CREATE TABLE IF NOT EXISTS public.kesiswaan_prestasi (
    id SERIAL PRIMARY KEY,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_lomba VARCHAR(255) NOT NULL,
    kategori VARCHAR(50) NOT NULL, -- 'Akademik', 'Olahraga', 'Seni', 'Keagamaan', 'Kepemimpinan', 'Lainnya'
    tingkat VARCHAR(50) NOT NULL, -- 'Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'
    peringkat VARCHAR(50) NOT NULL, -- 'Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1', 'Peserta Terbaik'
    penyelenggara VARCHAR(255),
    tanggal_perolehan DATE NOT NULL,
    guru_pembimbing TEXT REFERENCES public.users(id_user),
    poin_reward INT DEFAULT 0,
    bukti_sertifikat_url TEXT,
    foto_kegiatan_url TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    tahun_ajar_id TEXT,
    semester INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kesiswaan_prestasi_siswa ON public.kesiswaan_prestasi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_kesiswaan_prestasi_tingkat ON public.kesiswaan_prestasi(tingkat);

-- 4. TABEL EKSTRAKURIKULER & ORGANISASI
CREATE TABLE IF NOT EXISTS public.ekskul (
    id SERIAL PRIMARY KEY,
    nama_ekskul VARCHAR(100) NOT NULL UNIQUE,
    kategori VARCHAR(50) DEFAULT 'Pilihan',
    id_pembina TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    hari_latihan VARCHAR(20),
    jam_latihan VARCHAR(50),
    tempat VARCHAR(100),
    deskripsi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL ANGGOTA EKSTRAKURIKULER
CREATE TABLE IF NOT EXISTS public.ekskul_anggota (
    id SERIAL PRIMARY KEY,
    id_ekskul INT NOT NULL REFERENCES public.ekskul(id) ON DELETE CASCADE,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    jabatan VARCHAR(50) DEFAULT 'Anggota',
    nilai_predikat VARCHAR(5),
    catatan_pembina TEXT,
    tahun_ajar_id TEXT,
    semester INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_ekskul, siswa_id, tahun_ajar_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_ekskul_anggota_siswa ON public.ekskul_anggota(siswa_id);

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.kesiswaan_sanksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kesiswaan_prestasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekskul ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekskul_anggota ENABLE ROW LEVEL SECURITY;

-- Policy Baca (Authenticated Users)
DROP POLICY IF EXISTS "Kesiswaan sanksi viewable by authenticated users" ON public.kesiswaan_sanksi;
CREATE POLICY "Kesiswaan sanksi viewable by authenticated users"
ON public.kesiswaan_sanksi FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Prestasi viewable by authenticated users" ON public.kesiswaan_prestasi;
CREATE POLICY "Prestasi viewable by authenticated users"
ON public.kesiswaan_prestasi FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Ekskul viewable by authenticated users" ON public.ekskul;
CREATE POLICY "Ekskul viewable by authenticated users"
ON public.ekskul FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Ekskul anggota viewable by authenticated users" ON public.ekskul_anggota;
CREATE POLICY "Ekskul anggota viewable by authenticated users"
ON public.ekskul_anggota FOR SELECT TO authenticated USING (true);

-- Policy Tulis/Ubah (Khusus Admin & Kesiswaan)
DROP POLICY IF EXISTS "Kesiswaan & Admin can modify sanksi" ON public.kesiswaan_sanksi;
CREATE POLICY "Kesiswaan & Admin can modify sanksi"
ON public.kesiswaan_sanksi FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kesiswaan') );

DROP POLICY IF EXISTS "Kesiswaan & Admin can modify prestasi" ON public.kesiswaan_prestasi;
CREATE POLICY "Kesiswaan & Admin can modify prestasi"
ON public.kesiswaan_prestasi FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kesiswaan') );

DROP POLICY IF EXISTS "Kesiswaan & Admin can modify ekskul" ON public.ekskul;
CREATE POLICY "Kesiswaan & Admin can modify ekskul"
ON public.ekskul FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kesiswaan') );

DROP POLICY IF EXISTS "Kesiswaan & Admin can modify ekskul_anggota" ON public.ekskul_anggota;
CREATE POLICY "Kesiswaan & Admin can modify ekskul_anggota"
ON public.ekskul_anggota FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kesiswaan') );
