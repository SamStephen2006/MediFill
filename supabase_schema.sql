-- ═══════════════════════════════════════════════════════════════════════════
--  MediFill — Supabase Database Schema
--  
--  HOW TO USE:
--    1. Go to your Supabase project → SQL Editor
--    2. Paste this entire file → click "Run"
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles table ────────────────────────────────────────────────────────────
-- Stores user display name and avatar, linked to Supabase Auth user via id.

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Medicines table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.medicines (
  id               TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  dosage           TEXT,
  frequency        TEXT,
  total_quantity   INTEGER DEFAULT 0,
  current_quantity INTEGER DEFAULT 0,
  expiry_date      TEXT,
  notes            TEXT,
  interactions     JSONB DEFAULT '[]',
  time_to_take     JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS medicines_user_id_idx ON public.medicines(user_id);

-- ── Row Level Security — profiles ─────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── Row Level Security — medicines ────────────────────────────────────────────

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own medicines" ON public.medicines;

CREATE POLICY "Users can manage own medicines"
  ON public.medicines FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime for the medicines table

ALTER PUBLICATION supabase_realtime ADD TABLE public.medicines;
