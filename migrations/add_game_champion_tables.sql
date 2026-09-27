-- ==========================================================
-- SCRIPT SQL: MIGRASI TABEL GAME CHAMPION ARENA (GURU-APP)
-- ==========================================================

-- 1. TABEL PAKET BANK SOAL (GAME_PACKAGES)
CREATE TABLE IF NOT EXISTS public.game_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Umum',
    grade TEXT NOT NULL DEFAULT 'Semua Tingkat',
    materi TEXT,
    icon TEXT DEFAULT '📚',
    game_title TEXT DEFAULT 'ARENA OF CHAMPION',
    tagline TEXT DEFAULT 'Think Fast. Solve Smart. Become the Champion!',
    sub_title TEXT,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_packages_subject ON public.game_packages(subject);
CREATE INDEX IF NOT EXISTS idx_game_packages_grade ON public.game_packages(grade);

-- RLS untuk game_packages
ALTER TABLE public.game_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all game_packages" ON public.game_packages;
DROP POLICY IF EXISTS "Allow select game_packages to all" ON public.game_packages;
DROP POLICY IF EXISTS "Allow insert game_packages to authenticated users" ON public.game_packages;
DROP POLICY IF EXISTS "Allow update game_packages to authenticated users" ON public.game_packages;
DROP POLICY IF EXISTS "Allow delete game_packages to authenticated users" ON public.game_packages;

CREATE POLICY "Allow all game_packages"
ON public.game_packages
FOR ALL
USING (true)
WITH CHECK (true);


-- 2. TABEL BUTIR PERTANYAAN SOAL (GAME_QUESTIONS)
CREATE TABLE IF NOT EXISTS public.game_questions (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL REFERENCES public.game_packages(id) ON DELETE CASCADE,
    question_number INT DEFAULT 1,
    topic TEXT NOT NULL DEFAULT 'Materi Pokok',
    grade TEXT DEFAULT 'Semua Tingkat',
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer TEXT NOT NULL,
    explanation TEXT,
    points INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_questions_package_id ON public.game_questions(package_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_number ON public.game_questions(question_number);

-- RLS untuk game_questions
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all game_questions" ON public.game_questions;
DROP POLICY IF EXISTS "Allow select game_questions to all" ON public.game_questions;
DROP POLICY IF EXISTS "Allow insert game_questions to authenticated users" ON public.game_questions;
DROP POLICY IF EXISTS "Allow update game_questions to authenticated users" ON public.game_questions;
DROP POLICY IF EXISTS "Allow delete game_questions to authenticated users" ON public.game_questions;

CREATE POLICY "Allow all game_questions"
ON public.game_questions
FOR ALL
USING (true)
WITH CHECK (true);


-- 3. TABEL SESI & RIWAYAT PERMAINAN (GAME_SESSIONS)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id TEXT PRIMARY KEY,
    package_id TEXT REFERENCES public.game_packages(id) ON DELETE SET NULL,
    package_name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Umum',
    grade TEXT NOT NULL DEFAULT 'Semua Tingkat',
    materi TEXT,
    class_name TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    game_title TEXT NOT NULL DEFAULT 'ARENA OF CHAMPION',
    sub_title TEXT,
    tagline TEXT,
    total_questions INT NOT NULL DEFAULT 100,
    team_count INT NOT NULL DEFAULT 6,
    teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    tile_states JSONB NOT NULL DEFAULT '{}'::jsonb,
    arena_seconds INT DEFAULT 0,
    game_status TEXT NOT NULL DEFAULT 'idle',
    total_students INT DEFAULT 0,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON public.game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_class_name ON public.game_sessions(class_name);

-- RLS untuk game_sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow select game_sessions to all" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow insert game_sessions to authenticated users" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow update game_sessions to authenticated users" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow delete game_sessions to authenticated users" ON public.game_sessions;

CREATE POLICY "Allow all game_sessions"
ON public.game_sessions
FOR ALL
USING (true)
WITH CHECK (true);
