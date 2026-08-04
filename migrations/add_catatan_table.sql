-- ==========================================
-- MIGRASI: TABEL CATATAN PRIBADI
-- Jalankan script ini di Supabase SQL Editor
-- ==========================================

CREATE TABLE IF NOT EXISTS public.catatan (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    judul TEXT,
    isi TEXT,
    warna TEXT DEFAULT 'cream',
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view their own catatan"
ON public.catatan FOR SELECT TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can insert their own catatan"
ON public.catatan FOR INSERT TO authenticated
WITH CHECK ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can update their own catatan"
ON public.catatan FOR UPDATE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

CREATE POLICY "User can delete their own catatan"
ON public.catatan FOR DELETE TO authenticated
USING ( user_id = (SELECT id_user FROM public.users WHERE auth_id = auth.uid()) );

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catatan_updated_at
BEFORE UPDATE ON public.catatan
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
