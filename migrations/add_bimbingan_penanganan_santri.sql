-- ===========================================================================
-- MIGRATION: Modul Bimbingan & Penanganan Santri serta Pemanggilan Orang Tua
-- Kesiswaan & Wali Kelas Kolaborasi — Guru App
-- ===========================================================================

-- 1. TABEL PENANGANAN SANTRI (Laporan Bimbingan Wali Kelas & Kesiswaan)
CREATE TABLE IF NOT EXISTS public.kesiswaan_penanganan_santri (
    id SERIAL PRIMARY KEY,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nama_santri VARCHAR(255),
    kelas VARCHAR(50) NOT NULL,
    wali_kelas_id TEXT,
    wali_kelas_nama VARCHAR(255),
    jenis_pelanggaran VARCHAR(100) NOT NULL DEFAULT 'Bolos Jam Pelajaran',
    jumlah_alpa INT DEFAULT 1,
    tanggal_bimbingan DATE NOT NULL DEFAULT CURRENT_DATE,
    bentuk_penanganan TEXT NOT NULL,
    hasil_catatan TEXT NOT NULL,
    status VARCHAR(40) DEFAULT 'Sudah Dibina' CHECK (status IN ('Menunggu Bimbingan', 'Sudah Dibina', 'Perlu Panggilan Orang Tua', 'Selesai')),
    rekomendasi_tindak_lanjut VARCHAR(50) DEFAULT 'Pembinaan Wali Kelas' CHECK (rekomendasi_tindak_lanjut IN ('Pembinaan Wali Kelas', 'Panggilan Orang Tua', 'Bimbingan Konseling', 'Selesai')),
    catatan_kesiswaan TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penanganan_santri_siswa ON public.kesiswaan_penanganan_santri(siswa_id);
CREATE INDEX IF NOT EXISTS idx_penanganan_santri_kelas ON public.kesiswaan_penanganan_santri(kelas);
CREATE INDEX IF NOT EXISTS idx_penanganan_santri_status ON public.kesiswaan_penanganan_santri(status);

-- 2. TABEL PEMANGGILAN ORANG TUA (Surat & Berita Acara Pertemuan Resmi)
CREATE TABLE IF NOT EXISTS public.kesiswaan_pemanggilan_ortu (
    id SERIAL PRIMARY KEY,
    penanganan_id INT REFERENCES public.kesiswaan_penanganan_santri(id) ON DELETE SET NULL,
    siswa_id TEXT NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
    nomor_surat VARCHAR(100) UNIQUE,
    tanggal_pemanggilan DATE NOT NULL,
    waktu_pemanggilan VARCHAR(50) DEFAULT '09:00 WIB',
    tempat VARCHAR(150) DEFAULT 'Ruang Kesiswaan / BK',
    alasan_pemanggilan TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'Dijadwalkan' CHECK (status IN ('Dijadwalkan', 'Hadir', 'Reschedule', 'Selesai')),
    catatan_hasil_pertemuan TEXT,
    komitmen_ortu_santri TEXT,
    diterbitkan_oleh TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pemanggilan_ortu_siswa ON public.kesiswaan_pemanggilan_ortu(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pemanggilan_ortu_status ON public.kesiswaan_pemanggilan_ortu(status);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.kesiswaan_penanganan_santri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kesiswaan_pemanggilan_ortu ENABLE ROW LEVEL SECURITY;

-- Policy Baca (Semua authenticated user)
DROP POLICY IF EXISTS "Penanganan santri viewable by authenticated users" ON public.kesiswaan_penanganan_santri;
CREATE POLICY "Penanganan santri viewable by authenticated users"
ON public.kesiswaan_penanganan_santri FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Pemanggilan ortu viewable by authenticated users" ON public.kesiswaan_pemanggilan_ortu;
CREATE POLICY "Pemanggilan ortu viewable by authenticated users"
ON public.kesiswaan_pemanggilan_ortu FOR SELECT TO authenticated USING (true);

-- Policy Tulis/Ubah
DROP POLICY IF EXISTS "Authenticated can insert/update penanganan santri" ON public.kesiswaan_penanganan_santri;
CREATE POLICY "Authenticated can insert/update penanganan santri"
ON public.kesiswaan_penanganan_santri FOR ALL TO authenticated
USING (true);

DROP POLICY IF EXISTS "Kesiswaan & Admin can modify pemanggilan ortu" ON public.kesiswaan_pemanggilan_ortu;
CREATE POLICY "Kesiswaan & Admin can modify pemanggilan ortu"
ON public.kesiswaan_pemanggilan_ortu FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) IN ('Admin', 'Kesiswaan') );

-- ===========================================================================
-- 4. CONTOH SEED DATA AWAL (BERBASIS KASUS EDARAN BOLOS SANTRI)
-- ===========================================================================
INSERT INTO public.kesiswaan_penanganan_santri (
    siswa_id, nama_santri, kelas, wali_kelas_nama, jenis_pelanggaran, jumlah_alpa,
    tanggal_bimbingan, bentuk_penanganan, hasil_catatan, status, rekomendasi_tindak_lanjut, created_by
) VALUES 
(
    'SIS-0001',
    'ABID AQILA PRANAJA',
    'VII.A',
    'Ahmad Aris Kasanova, S.A, S.H, M.H',
    'Bolos Jam Pelajaran',
    2,
    CURRENT_DATE - INTERVAL '1 day',
    'Bimbingan pribadi tatap muka oleh Wali Kelas di ruang guru, membuat surat komitmen disiplin KBM.',
    'Santri mengakui bolos jam ke-3 dan 4 ke kantin belakang, menunjukkan penyesalan dan berkomitmen aktif hadir di kelas.',
    'Sudah Dibina',
    'Pembinaan Wali Kelas',
    'Wali Kelas VII.A'
),
(
    'SIS-0002',
    'ACHMAD HABIBI',
    'VII.A',
    'Ahmad Aris Kasanova, S.A, S.H, M.H',
    'Bolos Jam Pelajaran / Keluyuran saat KBM',
    4,
    CURRENT_DATE,
    'Bimbingan tatap muka Wali Kelas bersama Staf Kesiswaan, koordinasi via telepon dengan orang tua.',
    'Santri berulang kali meninggalkan kelas pada jam pelajaran siang. Diperlukan kehadiran fisik orang tua untuk penandatanganan komitmen bersama.',
    'Perlu Panggilan Orang Tua',
    'Panggilan Orang Tua',
    'Wali Kelas VII.A'
)
ON CONFLICT DO NOTHING;

-- Seed Pemanggilan Orang Tua untuk kasus SIS-0002
INSERT INTO public.kesiswaan_pemanggilan_ortu (
    penanganan_id, siswa_id, nomor_surat, tanggal_pemanggilan, waktu_pemanggilan, tempat,
    alasan_pemanggilan, status, diterbitkan_oleh
) VALUES
(
    (SELECT id FROM public.kesiswaan_penanganan_santri WHERE siswa_id = 'SIS-0002' ORDER BY id DESC LIMIT 1),
    'SIS-0002',
    '001/SP-ORTU/KESISWAAN/X/2026',
    CURRENT_DATE + INTERVAL '1 day',
    '09:00 WIB',
    'Ruang Kesiswaan / BK',
    'Pembinaan kedisiplinan dan koordinasi kehadiran santri terkait catatan bolos jam pelajaran berulang.',
    'Dijadwalkan',
    'Bagian Kesiswaan'
)
ON CONFLICT DO NOTHING;
