-- ===========================================================================
-- MIGRATION: Tambah Kolom Biodata Siswa Lengkap (Standar Rapor & Buku Induk)
-- Guru App - SMP IT Tebuireng 4 Al-Ishlah
-- ===========================================================================
-- Menambahkan kolom identitas pokok, alamat tempat tinggal, serta data 
-- orang tua / wali dan kontak ke tabel public.siswa.
-- ===========================================================================

ALTER TABLE public.siswa
    -- Identitas Pokok Siswa
    ADD COLUMN IF NOT EXISTS nisn VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nik VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tempat_lahir VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
    ADD COLUMN IF NOT EXISTS agama VARCHAR(30) DEFAULT 'Islam',
    ADD COLUMN IF NOT EXISTS anak_ke INTEGER,
    ADD COLUMN IF NOT EXISTS jumlah_saudara INTEGER,
    ADD COLUMN IF NOT EXISTS sekolah_asal VARCHAR(150),

    -- Alamat & Domisili
    ADD COLUMN IF NOT EXISTS alamat TEXT,
    ADD COLUMN IF NOT EXISTS rt VARCHAR(10),
    ADD COLUMN IF NOT EXISTS rw VARCHAR(10),
    ADD COLUMN IF NOT EXISTS dusun VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kelurahan VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kecamatan VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kode_pos VARCHAR(10),
    ADD COLUMN IF NOT EXISTS jenis_tinggal VARCHAR(50),

    -- Kontak & Data Orang Tua / Wali
    ADD COLUMN IF NOT EXISTS no_hp VARCHAR(30),
    ADD COLUMN IF NOT EXISTS nama_ayah VARCHAR(150),
    ADD COLUMN IF NOT EXISTS pekerjaan_ayah VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pendidikan_ayah VARCHAR(50),
    ADD COLUMN IF NOT EXISTS nama_ibu VARCHAR(150),
    ADD COLUMN IF NOT EXISTS pekerjaan_ibu VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pendidikan_ibu VARCHAR(50),
    ADD COLUMN IF NOT EXISTS nama_wali VARCHAR(150),
    ADD COLUMN IF NOT EXISTS pekerjaan_wali VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pendidikan_wali VARCHAR(50);

-- Buat index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON public.siswa(nisn);
CREATE INDEX IF NOT EXISTS idx_siswa_nik ON public.siswa(nik);

-- Pastikan izin akses Data API tetap aktif
GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.siswa TO service_role;
GRANT SELECT ON public.siswa TO anon;
