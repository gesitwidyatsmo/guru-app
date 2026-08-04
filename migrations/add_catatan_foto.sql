-- ==========================================
-- MIGRASI: TAMBAH KOLOM FOTO DI TABEL CATATAN
-- Jalankan script ini di Supabase SQL Editor
-- ==========================================

-- 1. Tambah kolom foto_url
ALTER TABLE public.catatan ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 2. Buat Storage Bucket untuk foto catatan (jalankan juga di SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('catatan-foto', 'catatan-foto', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policy: user authenticated bisa upload
CREATE POLICY "User can upload catatan foto"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catatan-foto');

CREATE POLICY "Catatan foto can be viewed by anyone"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'catatan-foto');

CREATE POLICY "User can delete their own catatan foto"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catatan-foto' AND auth.uid()::text = (storage.foldername(name))[1]);
