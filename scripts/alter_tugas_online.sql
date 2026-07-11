-- Jalankan script ini di SQL Editor pada Dashboard Supabase Anda

-- 1. Tambah kolom kategori dan type di tabel tugas_online
ALTER TABLE public.tugas_online 
ADD COLUMN IF NOT EXISTS kategori TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. Tambah kolom siswa_id di tabel pengumpulan_tugas (berelasi ke tabel siswa)
ALTER TABLE public.pengumpulan_tugas
ADD COLUMN IF NOT EXISTS siswa_id TEXT REFERENCES public.siswa(id) ON DELETE SET NULL;
