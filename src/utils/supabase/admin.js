import { createClient } from '@supabase/supabase-js';

// Service Role Key diperlukan untuk operasi admin seperti create/delete user auth
// Pastikan SUPABASE_SERVICE_ROLE_KEY ditambahkan di .env.local
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
