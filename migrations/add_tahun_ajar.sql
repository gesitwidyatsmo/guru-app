-- =====================================================
-- MIGRASI: TAHUN AJAR & SEMESTER
-- GuruApp — Jalankan di Supabase SQL Editor
-- =====================================================
-- PENTING: Backup data sebelum menjalankan script ini!
-- Semua data existing akan otomatis di-tag ke TA 2026/2027, Semester 1
-- =====================================================

-- 1. TABEL MASTER TAHUN AJAR
-- Menyimpan semua periode akademik yang pernah/sedang berjalan
CREATE TABLE IF NOT EXISTS public.tahun_ajar (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,            -- "2026/2027"
    semester INTEGER NOT NULL,     -- 1 atau 2
    is_aktif BOOLEAN DEFAULT FALSE,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nama, semester)
);

ALTER TABLE public.tahun_ajar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tahun ajar bisa dilihat semua user login"
ON public.tahun_ajar FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hanya Admin yang bisa kelola tahun ajar"
ON public.tahun_ajar FOR ALL TO authenticated
USING ( (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'Admin' );

-- Seed: periode aktif saat ini
INSERT INTO public.tahun_ajar (id, nama, semester, is_aktif, tanggal_mulai, tanggal_selesai)
VALUES ('TA-2026-S1', '2026/2027', 1, TRUE, '2026-07-14', '2026-12-31')
ON CONFLICT (nama, semester) DO NOTHING;

-- =====================================================
-- 2. TAMBAH KOLOM tahun_ajar & semester KE SEMUA TABEL TRANSAKSIONAL
-- Default '2026/2027' dan 1 → auto-tag semua data lama
-- =====================================================

-- JURNAL
ALTER TABLE public.jurnal
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- NILAI_TUGAS
ALTER TABLE public.nilai_tugas
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- ABSENSI HARIAN
ALTER TABLE public.absensi_harian
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- ABSENSI MAPEL
ALTER TABLE public.absensi_mapel
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- POIN
ALTER TABLE public.poin
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- GRUP
ALTER TABLE public.grup
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- JADWAL
ALTER TABLE public.jadwal
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- GURU_KBM
ALTER TABLE public.guru_kbm
    ADD COLUMN IF NOT EXISTS tahun_ajar TEXT NOT NULL DEFAULT '2026/2027',
    ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- =====================================================
-- 3. INDEX UNTUK PERFORMA QUERY FILTER
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_jurnal_periode ON public.jurnal(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_nilai_tugas_periode ON public.nilai_tugas(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_absensi_harian_periode ON public.absensi_harian(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_absensi_mapel_periode ON public.absensi_mapel(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_poin_periode ON public.poin(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_grup_periode ON public.grup(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_jadwal_periode ON public.jadwal(tahun_ajar, semester);
CREATE INDEX IF NOT EXISTS idx_guru_kbm_periode ON public.guru_kbm(tahun_ajar, semester);

-- =====================================================
-- SELESAI
-- Setelah menjalankan migrasi ini:
-- 1. Deploy ulang aplikasi (update API routes + Context)
-- 2. Verifikasi di Dashboard bahwa data Sem 1 masih tampil normal
-- 3. Coba ganti ke Sem 2 → pastikan kosong
-- =====================================================
