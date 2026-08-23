-- Migration: Tambah Kolom Konfigurasi Mode Penilaian & Jumlah Benar
-- Jalankan di SQL Editor Supabase jika tabel sudah ada

-- 1. Tambah kolom konfigurasi scoring pada tabel nilai_tugas (Header Tugas)
ALTER TABLE public.nilai_tugas 
ADD COLUMN IF NOT EXISTS mode_penilaian TEXT DEFAULT 'langsung',
ADD COLUMN IF NOT EXISTS total_soal INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS skala_maks INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS pembulatan TEXT DEFAULT 'decimal_1';

-- 2. Tambah kolom jumlah_benar pada tabel nilai_siswa (Detail Siswa)
ALTER TABLE public.nilai_siswa 
ADD COLUMN IF NOT EXISTS jumlah_benar NUMERIC DEFAULT NULL;

-- Komentar kolom untuk dokumentasi
COMMENT ON COLUMN public.nilai_tugas.mode_penilaian IS 'Mode penilaian: langsung (0-100) atau jumlah_benar';
COMMENT ON COLUMN public.nilai_tugas.total_soal IS 'Jumlah butir soal / skor maksimal mentah';
COMMENT ON COLUMN public.nilai_tugas.skala_maks IS 'Skala target nilai akhir, default 100';
COMMENT ON COLUMN public.nilai_tugas.pembulatan IS 'Strategi pembulatan: round (bulat), decimal_1 (1 desimal), decimal_2 (2 desimal)';
COMMENT ON COLUMN public.nilai_siswa.jumlah_benar IS 'Jumlah jawaban benar atau skor mentah yang diperoleh siswa';
