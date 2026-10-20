-- ===========================================================================
-- MIGRATION: Tambahkan Foreign Key Constraint & ON UPDATE CASCADE untuk Mapel
-- GuruApp — Menjaga Integritas Referensial Mata Pelajaran di Seluruh Sistem
-- ===========================================================================
-- Deskripsi:
-- 1. Menjamin kolom 'mapel' pada tabel public.mapel berstatus UNIQUE.
-- 2. Menghubungkan seluruh tabel operasional (guru_kbm, jadwal, absensi_mapel,
--    jurnal, nilai_tugas) ke tabel public.mapel(mapel) menggunakan:
--    ON UPDATE CASCADE: Ketika nama mapel diubah di Kurikulum, seluruh tabel
--    otomatis ikut tersinkronisasi tanpa ada data yang tertinggal atau corrupt.
--    ON DELETE RESTRICT: Mencegah mapel terhapus jika masih aktif digunakan.
-- ===========================================================================

-- 1. PASTIKAN UNIQUE CONSTRAINT PADA KOLOM mapel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mapel_mapel_key'
    ) THEN
        ALTER TABLE public.mapel ADD CONSTRAINT mapel_mapel_key UNIQUE (mapel);
    END IF;
END $$;

-- 2. FOREIGN KEY PADA TABEL public.guru_kbm (PENUGASAN KBM)
ALTER TABLE public.guru_kbm DROP CONSTRAINT IF EXISTS guru_kbm_mapel_fkey;
ALTER TABLE public.guru_kbm
    ADD CONSTRAINT guru_kbm_mapel_fkey
    FOREIGN KEY (mapel)
    REFERENCES public.mapel(mapel)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- 3. FOREIGN KEY PADA TABEL public.jadwal (MASTER JADWAL KBM)
ALTER TABLE public.jadwal DROP CONSTRAINT IF EXISTS jadwal_mapel_fkey;
ALTER TABLE public.jadwal
    ADD CONSTRAINT jadwal_mapel_fkey
    FOREIGN KEY (mapel)
    REFERENCES public.mapel(mapel)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- 4. FOREIGN KEY PADA TABEL public.absensi_mapel (PRESENSI KBM PER MAPEL)
ALTER TABLE public.absensi_mapel DROP CONSTRAINT IF EXISTS absensi_mapel_mapel_fkey;
ALTER TABLE public.absensi_mapel
    ADD CONSTRAINT absensi_mapel_mapel_fkey
    FOREIGN KEY (mapel)
    REFERENCES public.mapel(mapel)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- 5. FOREIGN KEY PADA TABEL public.jurnal (JURNAL MENGAJAR GURU)
ALTER TABLE public.jurnal DROP CONSTRAINT IF EXISTS jurnal_mapel_fkey;
ALTER TABLE public.jurnal
    ADD CONSTRAINT jurnal_mapel_fkey
    FOREIGN KEY (mapel)
    REFERENCES public.mapel(mapel)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- 6. FOREIGN KEY PADA TABEL public.nilai_tugas (PENILAIAN TUGAS) JIKA ADA
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nilai_tugas'
    ) THEN
        ALTER TABLE public.nilai_tugas DROP CONSTRAINT IF EXISTS nilai_tugas_mapel_fkey;
        ALTER TABLE public.nilai_tugas
            ADD CONSTRAINT nilai_tugas_mapel_fkey
            FOREIGN KEY (mapel)
            REFERENCES public.mapel(mapel)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

-- 7. INDEKS UNTUK MENGOPTIMALKAN QUERY PERFORMA PADA KOLOM MAPEL
CREATE INDEX IF NOT EXISTS idx_guru_kbm_mapel ON public.guru_kbm(mapel);
CREATE INDEX IF NOT EXISTS idx_jadwal_mapel ON public.jadwal(mapel);
CREATE INDEX IF NOT EXISTS idx_absensi_mapel_mapel ON public.absensi_mapel(mapel);
CREATE INDEX IF NOT EXISTS idx_jurnal_mapel ON public.jurnal(mapel);
