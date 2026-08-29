import { createClient } from '@supabase/supabase-js';

// Service Role Key diperlukan untuk operasi admin (bypass RLS, create/delete user auth).
// Jika SUPABASE_SERVICE_ROLE_KEY tidak di-set, singleton ini tetap dibuat dengan anon key
// agar tidak crash saat inisialisasi, tapi operasi admin yang butuh bypass RLS akan gagal.
// Pastikan SUPABASE_SERVICE_ROLE_KEY ditambahkan di .env.local & Vercel environment variables.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn(
    '[supabaseAdmin] WARNING: SUPABASE_SERVICE_ROLE_KEY tidak dikonfigurasi. ' +
    'Operasi yang membutuhkan bypass RLS (seperti middleware profile fetch) akan gagal.'
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      // Admin client tidak perlu menyimpan sesi atau auto-refresh token
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
