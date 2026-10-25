-- ===========================================================================
-- MIGRATION: Waktu Real-Time KBM & Status Audit pada Tabel public.jurnal
-- GuruApp — Mencatat Waktu Mulai (dari Absensi Siswa), Waktu Selesai (Simpan Jurnal),
-- Serta Durasi dan Status Kehadiran KBM Riil.
-- ===========================================================================

-- 1. Tambah kolom pencatatan waktu riil KBM
ALTER TABLE public.jurnal 
ADD COLUMN IF NOT EXISTS jam_mulai TIME,
ADD COLUMN IF NOT EXISTS jam_selesai TIME,
ADD COLUMN IF NOT EXISTS durasi_menit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sesi_absensi_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS status_kehadiran VARCHAR(50) DEFAULT 'Normal';

-- 2. Beri komentar dokumentasi pada kolom
COMMENT ON COLUMN public.jurnal.jam_mulai IS 'Waktu riil guru mulai KBM (diambil dari created_at absensi_mapel siswa)';
COMMENT ON COLUMN public.jurnal.jam_selesai IS 'Waktu riil guru mengakhiri KBM (diambil saat simpan jurnal)';
COMMENT ON COLUMN public.jurnal.durasi_menit IS 'Selisih waktu KBM riil dalam satuan menit (jam_selesai - jam_mulai)';
COMMENT ON COLUMN public.jurnal.sesi_absensi_id IS 'ID referensi ke tabel absensi_mapel(sesi_id)';
COMMENT ON COLUMN public.jurnal.status_kehadiran IS 'Status audit: Tepat Waktu, Terlambat, Selesai Lebih Awal, Susulan / Tanpa Presensi';

-- 3. Indeks untuk mempercepat filter supervisi kurikulum & kepsek
CREATE INDEX IF NOT EXISTS idx_jurnal_status_kehadiran ON public.jurnal(status_kehadiran);
CREATE INDEX IF NOT EXISTS idx_jurnal_sesi_absensi ON public.jurnal(sesi_absensi_id);

-- 4. GRANT Hak Akses Eksplisit (Sesuai Aturan Supabase Migration Rule)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jurnal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jurnal TO service_role;
