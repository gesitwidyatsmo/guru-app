-- ===========================================================================
-- MIGRATION: Tambah Role 'Keamanan' & Tabel Persuratan Digital Pos Keamanan
-- GuruApp — Fondasi & Manajemen Role Keamanan (Satpam / Pos Gerbang Sekolah)
-- ===========================================================================
-- Deskripsi:
-- 1. Memperbarui check constraint pada kolom role tabel public.users agar
--    mengizinkan nilai 'Keamanan'.
-- 2. Membuat tabel public.keamanan_surat_izin untuk mencatat:
--    - Surat Keterangan Terlambat (Izin Masuk Kelas)
--    - Surat Izin Keluar Lingkungan Sekolah Sementara
--    - Surat Izin Pulang Cepat (Sakit / Kepentingan Mendesak)
--    - Surat Keterangan Tidak Masuk (Titip Surat Ortu / Sakit)
-- 3. Membuat index untuk pencarian cepat berdasarkan tanggal dan kelas.
-- 4. Mengatur Row Level Security (RLS) untuk keamanan akses.
-- ===========================================================================

-- 1. PERBARUI CHECK CONSTRAINT ROLE DI TABEL public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara', 'Kesiswaan', 'Kurikulum', 'Keamanan'));

-- 2. TABEL PERSURATAN DIGITAL POS KEAMANAN
CREATE TABLE IF NOT EXISTS public.keamanan_surat_izin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_surat VARCHAR(80) NOT NULL UNIQUE,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_siswa VARCHAR(150) NOT NULL,
    nis VARCHAR(50),
    kelas VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Tipe Surat: 'terlambat', 'izin_keluar', 'pulang_cepat', 'tidak_masuk'
    tipe_surat VARCHAR(40) NOT NULL,
    
    -- Status Absensi Target: 'Izin', 'Sakit', 'Hadir'
    status_absensi VARCHAR(20) NOT NULL DEFAULT 'Izin',
    
    -- Rentang Jam Pelajaran (opsional jika berlaku jam tertentu)
    jam_ke_mulai VARCHAR(20) DEFAULT NULL,
    jam_ke_selesai VARCHAR(20) DEFAULT NULL,
    berlaku_seharian BOOLEAN DEFAULT FALSE,
    
    -- Keterangan & Alasan
    alasan TEXT NOT NULL,
    penjemput VARCHAR(150) DEFAULT NULL,
    waktu_surat TIME DEFAULT CURRENT_TIME,
    waktu_kembali TIME DEFAULT NULL,
    
    -- Status Surat: 'aktif', 'selesai', 'dibatalkan'
    status_surat VARCHAR(20) DEFAULT 'aktif',
    
    -- Petugas Keamanan Penerbit
    petugas_id TEXT,
    petugas_nama VARCHAR(150),
    catatan TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEX UNTUK PERFORMA QUERY
CREATE INDEX IF NOT EXISTS idx_keamanan_surat_tgl_kelas ON public.keamanan_surat_izin(tanggal, kelas);
CREATE INDEX IF NOT EXISTS idx_keamanan_surat_siswa_tgl ON public.keamanan_surat_izin(siswa_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_keamanan_surat_status ON public.keamanan_surat_izin(status_surat);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.keamanan_surat_izin ENABLE ROW LEVEL SECURITY;

-- Policy Baca (Semua user terautentikasi: Guru, Wali Kelas, Kesiswaan, Kepsek, Keamanan, Admin)
DROP POLICY IF EXISTS "Surat izin viewable by authenticated users" ON public.keamanan_surat_izin;
CREATE POLICY "Surat izin viewable by authenticated users"
ON public.keamanan_surat_izin FOR SELECT TO authenticated USING (true);

-- Policy Tulis/Ubah (Khusus Role 'Keamanan' & 'Admin')
DROP POLICY IF EXISTS "Keamanan & Admin can manage surat izin" ON public.keamanan_surat_izin;
CREATE POLICY "Keamanan & Admin can manage surat izin"
ON public.keamanan_surat_izin FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Keamanan') );

-- 5. GRANTS AKSES DATA API (SUPABASE POST-OCTOBER 30 COMPLIANCE)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keamanan_surat_izin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keamanan_surat_izin TO service_role;

