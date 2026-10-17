-- ===========================================================================
-- SCRIPT: SEED AUTH USERS UNTUK PROJECT SUPABASE BARU
-- Jalankan script ini di SQL Editor Supabase setelah menjalankan supabase_backup_complete.sql
-- ===========================================================================
-- Catatan:
-- Script ini mendaftarkan akun ke skema auth.users dengan UUID yang persis sama
-- dengan data di public.users, sehingga relasi login 100% cocok.
-- Password bawaan sementara untuk semua akun di bawah adalah: guruapp123
-- (Bisa Anda ganti langsung pada variabel DEFAULT_PASSWORD di bawah sebelum dijalankan).
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  default_pass TEXT := 'guruapp123'; -- Ganti jika ingin password lain
  encrypted_pass TEXT;
  user_rec RECORD;
BEGIN
  encrypted_pass := crypt(default_pass, gen_salt('bf'));

  -- Daftar 4 pengguna bawaan yang ada di GuruApp
  FOR user_rec IN 
    SELECT * FROM (VALUES
      ('78ff3035-fa5d-4b0d-8637-845db2b70fb4'::uuid, 'admin@guruapp.com', 'admin'),
      ('3f020e98-e747-4c3b-a38e-44e0e3142d54'::uuid, 'bendahara@guruapp.com', 'bendahara'),
      ('434c4fed-02a0-4745-b9ac-5204cec2edfb'::uuid, 'kepsek@guruapp.com', 'kepsek'),
      ('63c31206-b156-4957-9ec6-025f47a2ee62'::uuid, 'gesit@guruapp.com', 'gesit')
    ) AS t(uid, email, username)
  LOOP
    -- 1. Insert ke auth.users jika belum ada
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_rec.uid) THEN
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        user_rec.uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        user_rec.email,
        encrypted_pass,
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('username', user_rec.username),
        FALSE,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );
    ELSE
      -- Jika user sudah ada, update password agar bisa login
      UPDATE auth.users 
      SET encrypted_password = encrypted_pass,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW())
      WHERE id = user_rec.uid;
    END IF;

    -- 2. Insert ke auth.identities jika belum ada
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = user_rec.uid) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        user_rec.uid,
        user_rec.uid,
        jsonb_build_object('sub', user_rec.uid::text, 'email', user_rec.email),
        'email',
        user_rec.email,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
END $$;

-- Verifikasi hasil
SELECT id, email, created_at, email_confirmed_at FROM auth.users;
