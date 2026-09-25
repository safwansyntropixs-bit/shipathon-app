-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  total_score integer default 0,
  fcm_token text,
  is_premium boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile." on profiles for update using (auth.uid() = id);



-- ==========================================
-- 3. FRIEND REQUESTS TABLE
-- ==========================================
create table friend_requests (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sender_id, receiver_id)
);

-- Enable RLS
alter table friend_requests enable row level security;

-- Policies
create policy "Users can see requests sent to or from them." on friend_requests for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send requests." on friend_requests for insert with check (auth.uid() = sender_id);
create policy "Users can delete their own requests." on friend_requests for delete using (auth.uid() = sender_id or auth.uid() = receiver_id);


-- ==========================================
-- 4. FRIENDS TABLE
-- ==========================================
create table friends (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  friend_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

-- Enable RLS
alter table friends enable row level security;

-- Policies
create policy "Friends are viewable by the user." on friends for select using (auth.uid() = user_id);
create policy "Users can add friends." on friends for insert with check (auth.uid() = user_id);
create policy "Users can remove friends." on friends for delete using (auth.uid() = user_id);










-- ==========================================
-- 7. AUTH TRIGGER (FOR SIGN UP)
-- ==========================================
-- Automatically create a profile when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Replix Database Schema
-- Run this script in your Supabase SQL Editor to set up the database.

-- 1. Drop existing tables to ensure a clean slate
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;

DROP TABLE IF EXISTS workouts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. Profiles Table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  is_premium BOOLEAN DEFAULT FALSE,
  streak_count INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  total_volume INTEGER DEFAULT 0,
  last_workout_date DATE NULL,
  organization_id UUID NULL,
  timezone TEXT DEFAULT 'Asia/Karachi',
  country TEXT,
  country_flag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workouts Table
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type VARCHAR(50) NOT NULL CHECK (exercise_type IN ('pushup', 'squat', 'plank', 'pullup', 'situp', 'lunge', 'burpee')),
  duration_seconds INTEGER DEFAULT 0 CHECK (duration_seconds >= 0),
  target_reps INTEGER DEFAULT 0,
  target_seconds INTEGER DEFAULT 0,
  valid_rep_count INTEGER DEFAULT 0,
  valid_active_seconds INTEGER DEFAULT 0,
  is_ended_early BOOLEAN DEFAULT FALSE,
  form_accuracy INTEGER DEFAULT 0,
  earned_xp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. User Devices Table
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
);

-- 6. Subscriptions Table
CREATE TABLE subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revenuecat_id TEXT UNIQUE,
  tier VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ
);

-- 7. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- -- -- 8. Pro Entitlement Verification Helper Function
CREATE OR REPLACE FUNCTION public.is_active_pro(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = user_uuid AND is_premium = true
    UNION ALL
    SELECT 1 FROM public.subscriptions WHERE user_id = user_uuid AND (status != 'expired') AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 9. RLS Policies
CREATE POLICY "Users can view and update own profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Workouts: Current month for free tier, full history for verified Pro users (wrapped in SELECT for cached plan evaluation)
CREATE POLICY "Workouts access policy based on subscription" ON workouts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    created_at >= date_trunc('month', now())
    OR (SELECT public.is_active_pro(auth.uid()))
  )
);

CREATE POLICY "Users can insert own workouts" ON workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can read own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own devices" ON user_devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. Trigger for updating profile aggregations (streak, longest streak, total workouts, volume)
CREATE OR REPLACE FUNCTION public.update_user_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_profile RECORD;
  v_user_tz TEXT;
  local_new_date DATE;
  v_new_streak INT;
  v_new_longest INT;
BEGIN
  -- 1. Lock the user's profile row FOR UPDATE to prevent race conditions
  SELECT streak_count, longest_streak, total_workouts, total_volume, last_workout_date, COALESCE(timezone, 'Asia/Karachi') as user_tz
  INTO v_profile
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_user_tz := v_profile.user_tz;
  local_new_date := (NEW.created_at AT TIME ZONE v_user_tz)::DATE;
  v_new_streak := COALESCE(v_profile.streak_count, 0);
  v_new_longest := COALESCE(v_profile.longest_streak, 0);

  -- 2. Streak evaluation based on local calendar dates
  IF v_profile.last_workout_date IS NULL THEN
    v_new_streak := 1;
  ELSIF local_new_date = v_profile.last_workout_date THEN
    -- Same day workout: maintain active streak, don't increment
    IF v_new_streak = 0 THEN
      v_new_streak := 1;
    END IF;
  ELSIF local_new_date = (v_profile.last_workout_date + INTERVAL '1 day')::DATE THEN
    -- Consecutive day: increment streak
    v_new_streak := v_new_streak + 1;
  ELSIF local_new_date > (v_profile.last_workout_date + INTERVAL '1 day')::DATE THEN
    -- Missed day(s): reset streak to 1
    v_new_streak := 1;
  END IF;

  -- 3. Calculate new longest streak
  v_new_longest := GREATEST(v_new_longest, v_new_streak);

  -- 4. Atomic update of profile aggregations
  UPDATE public.profiles
  SET 
    total_workouts = COALESCE(total_workouts, 0) + 1,
    total_volume = COALESCE(total_volume, 0) + COALESCE(NEW.valid_rep_count, 0),
    streak_count = v_new_streak,
    longest_streak = v_new_longest,
    last_workout_date = local_new_date,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workout_completed ON workouts;
CREATE TRIGGER on_workout_completed
  AFTER INSERT ON workouts
  FOR EACH ROW EXECUTE PROCEDURE public.update_user_aggregates();

-- 10. Dynamic Read-Time Streak Evaluator (Decays automatically if day missed)
CREATE OR REPLACE FUNCTION public.get_active_streak(p_streak_count INT, p_last_workout_date DATE, p_timezone TEXT DEFAULT 'Asia/Karachi')
RETURNS INT AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE COALESCE(p_timezone, 'Asia/Karachi'))::DATE;
BEGIN
  IF p_last_workout_date IS NULL THEN
    RETURN 0;
  ELSIF p_last_workout_date >= (v_today - INTERVAL '1 day')::DATE THEN
    RETURN COALESCE(p_streak_count, 0);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 




-- 1. Speeds up fetching a specific user's workout history and dashboard stats
CREATE INDEX idx_workouts_user_id ON workouts(user_id);

-- 2. Speeds up the time-filtered Leaderboards (daily/weekly/monthly) and History sorting
CREATE INDEX idx_workouts_created_at ON workouts(created_at DESC);

-- 3. Speeds up all-time profile volume sorting
CREATE INDEX idx_profiles_total_volume ON profiles(total_volume DESC);

-- 4. Speeds up RLS subscription verification checks
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_expiry ON subscriptions (user_id, status, expires_at);


-- 1. Add the missing avatar_url column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Force Supabase to refresh its API cache immediately
NOTIFY pgrst, 'reload schema';



-- Supabase SQL Query to create the avatars bucket and configure RLS
-- Run this in your Supabase SQL Editor

-- avatar bucket setup

-- 1. Create the storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Allow public access to read all avatars
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- 3. Allow authenticated users to upload their own avatar
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Allow authenticated users to update their own avatar
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Allow authenticated users to delete their own avatar
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );



-- ====================================================================
-- Replix SEED SCRIPT FOR LOGGED IN USER: d0a891af-8821-4418-ae15-412a7ad0b262
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure Table Structure & RLS Policies Exist
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see requests sent to or from them." ON friend_requests;
CREATE POLICY "Users can see requests sent to or from them." ON friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can send requests." ON friend_requests;
CREATE POLICY "Users can send requests." ON friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Users can delete requests." ON friend_requests;
CREATE POLICY "Users can delete requests." ON friend_requests FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Friends are viewable by user" ON friends;
CREATE POLICY "Friends are viewable by user" ON friends FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can add friends" ON friends;
CREATE POLICY "Users can add friends" ON friends FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove friends" ON friends;
CREATE POLICY "Users can remove friends" ON friends FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pushup_target INT DEFAULT 50,
  squat_target INT DEFAULT 50,
  plank_target INT DEFAULT 60
);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ====================================================================
-- 2. SETUP DUMMY OPPONENT USERS IN auth.users FOR LEADERBOARD & FRIENDS
-- ====================================================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.shreds@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zain.beast@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emma.athlete@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david.iron@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ali.repking@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria.crossfit@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW()),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'steve.power@replix.io', '$2a$10$abcdefghijklmnopqrstuu', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


-- ====================================================================
-- 3. PROFILES SETUP (LOGGED IN USER + OPPONENTS)
-- ====================================================================

-- Upsert Your Logged-In Account Profile
INSERT INTO public.profiles (id, email, username, is_premium, streak_count, total_volume, avatar_url)
VALUES (
  'd0a891af-8821-4418-ae15-412a7ad0b262',
  'daniyal@replix.app',
  'daniyal_pro',
  true,
  14,
  3250,
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
)
ON CONFLICT (id) DO UPDATE SET
  username = COALESCE(profiles.username, 'daniyal_pro'),
  avatar_url = COALESCE(profiles.avatar_url, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
  is_premium = true,
  streak_count = 14,
  total_volume = 3250;

-- Opponents Profiles
INSERT INTO public.profiles (id, email, username, is_premium, streak_count, total_volume, avatar_url)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'sarah.shreds@replix.io', 'sarah_shreds', true, 21, 2450, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'),
  ('33333333-3333-3333-3333-333333333333', 'zain.beast@replix.io', 'zain_beast', false, 7, 1120, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
  ('44444444-4444-4444-4444-444444444444', 'emma.athlete@replix.io', 'emma_athlete', true, 30, 3100, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'),
  ('55555555-5555-5555-5555-555555555555', 'david.iron@replix.io', 'david_iron', false, 3, 640, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
  ('66666666-6666-6666-6666-666666666666', 'ali.repking@replix.io', 'ali_repking', true, 18, 2200, 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'),
  ('77777777-7777-7777-7777-777777777777', 'maria.crossfit@replix.io', 'maria_crossfit', false, 5, 890, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'),
  ('88888888-8888-8888-8888-888888888888', 'steve.power@replix.io', 'steve_power', true, 12, 1600, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  is_premium = EXCLUDED.is_premium,
  streak_count = EXCLUDED.streak_count,
  total_volume = EXCLUDED.total_volume;


-- ====================================================================
-- 4. WORKOUT HISTORY FOR YOUR LOGGED IN USER (PAST 30 DAYS)
-- ====================================================================

-- Clean out previous workouts for clean re-insert
DELETE FROM workouts WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';

INSERT INTO workouts (id, user_id, exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pushup', 50, 0, 90, NOW() - INTERVAL '2 hours'),
  ('10000000-0000-0000-0000-000000000002', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'squat', 80, 0, 150, NOW() - INTERVAL '1 day'),
  ('10000000-0000-0000-0000-000000000003', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'plank', 0, 180, 180, NOW() - INTERVAL '2 days'),
  ('10000000-0000-0000-0000-000000000004', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pullup', 20, 0, 80, NOW() - INTERVAL '3 days'),
  ('10000000-0000-0000-0000-000000000005', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'situp', 60, 0, 120, NOW() - INTERVAL '4 days'),
  ('10000000-0000-0000-0000-000000000006', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'lunge', 50, 0, 110, NOW() - INTERVAL '5 days'),
  ('10000000-0000-0000-0000-000000000007', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'burpee', 30, 0, 140, NOW() - INTERVAL '6 days'),
  ('10000000-0000-0000-0000-000000000008', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pushup', 60, 0, 100, NOW() - INTERVAL '8 days'),
  ('10000000-0000-0000-0000-000000000009', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'squat', 100, 0, 200, NOW() - INTERVAL '10 days'),
  ('10000000-0000-0000-0000-000000000010', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pushup', 45, 0, 85, NOW() - INTERVAL '14 days'),
  ('10000000-0000-0000-0000-000000000011', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'lunge', 40, 0, 90, NOW() - INTERVAL '20 days'),
  ('10000000-0000-0000-0000-000000000012', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'situp', 70, 0, 130, NOW() - INTERVAL '25 days');


-- Workouts for Opponents
DELETE FROM workouts WHERE user_id IN ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');
INSERT INTO workouts (id, user_id, exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, created_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'pushup', 60, 0, 120, NOW() - INTERVAL '1 hour'),
  ('20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'squat', 100, 0, 200, NOW() - INTERVAL '1 day'),
  ('40000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'squat', 120, 0, 240, NOW() - INTERVAL '3 hours'),
  ('40000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'pushup', 70, 0, 140, NOW() - INTERVAL '1 day');


-- ====================================================================
-- 5. BIOMECHANICAL FORM ANALYSIS FOR YOUR WORKOUTS
-- ====================================================================

INSERT INTO biomechanical_metrics (id, workout_id, joint_angles, velocity_data, form_score)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '{"elbow_left": 91.2, "elbow_right": 90.8, "shoulder_left": 45.0, "shoulder_right": 44.8}'::jsonb,
    '{"avg_velocity_m_s": 0.48, "peak_velocity_m_s": 0.65}'::jsonb,
    96
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '{"knee_left": 89.5, "knee_right": 90.1, "hip_angle": 79.2}'::jsonb,
    '{"avg_velocity_m_s": 0.54, "peak_velocity_m_s": 0.72}'::jsonb,
    92
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000008',
    '{"elbow_left": 88.0, "elbow_right": 89.1, "shoulder_left": 46.2, "shoulder_right": 45.5}'::jsonb,
    '{"avg_velocity_m_s": 0.50, "peak_velocity_m_s": 0.68}'::jsonb,
    94
  )
ON CONFLICT (workout_id) DO UPDATE SET
  joint_angles = EXCLUDED.joint_angles,
  velocity_data = EXCLUDED.velocity_data,
  form_score = EXCLUDED.form_score;


-- ====================================================================
-- 6. FRIENDS & FRIEND REQUESTS FOR YOUR LOGGED IN ACCOUNT
-- ====================================================================

-- Clean out previous test friends/requests for your account
DELETE FROM friend_requests WHERE sender_id = 'd0a891af-8821-4418-ae15-412a7ad0b262' OR receiver_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM friends WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262' OR friend_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';

-- Add Active Friends for You (Sarah, Emma, Ali)
INSERT INTO friends (user_id, friend_id)
VALUES
  ('d0a891af-8821-4418-ae15-412a7ad0b262', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', 'd0a891af-8821-4418-ae15-412a7ad0b262'),

  ('d0a891af-8821-4418-ae15-412a7ad0b262', '44444444-4444-4444-4444-444444444444'),
  ('44444444-4444-4444-4444-444444444444', 'd0a891af-8821-4418-ae15-412a7ad0b262'),

  ('d0a891af-8821-4418-ae15-412a7ad0b262', '66666666-6666-6666-6666-666666666666'),
  ('66666666-6666-6666-6666-666666666666', 'd0a891af-8821-4418-ae15-412a7ad0b262')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- Incoming Requests (Zain & David want to be your friend)
-- Outgoing Request (You sent a request to Steve)
INSERT INTO friend_requests (sender_id, receiver_id, status)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pending'),
  ('55555555-5555-5555-5555-555555555555', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pending'),
  ('d0a891af-8821-4418-ae15-412a7ad0b262', '88888888-8888-8888-8888-888888888888', 'pending')
ON CONFLICT (sender_id, receiver_id) DO NOTHING;


-- ====================================================================
-- 7. USER PREFERENCES & TARGETS
-- ====================================================================

INSERT INTO user_preferences (user_id, pushup_target, squat_target, plank_target)
VALUES ('d0a891af-8821-4418-ae15-412a7ad0b262', 50, 60, 120)
ON CONFLICT (user_id) DO UPDATE SET
  pushup_target = EXCLUDED.pushup_target,
  squat_target = EXCLUDED.squat_target,
  plank_target = EXCLUDED.plank_target;


-- ====================================================================
-- 8. SUBSCRIPTION & DEVICE SETTINGS
-- ====================================================================

INSERT INTO subscriptions (user_id, revenuecat_id, tier, status, expires_at)
VALUES ('d0a891af-8821-4418-ae15-412a7ad0b262', 'rc_sub_daniyal_active', 'pro', 'active', NOW() + INTERVAL '1 year')
ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at;

INSERT INTO user_devices (user_id, fcm_token, platform)
VALUES ('d0a891af-8821-4418-ae15-412a7ad0b262', 'fcm_token_daniyal_dev_999', 'android')
ON CONFLICT (user_id, fcm_token) DO NOTHING;


-- ====================================================================
-- 9. RE-CALCULATE AGGREGATES & REFRESH POSTGREST SCHEMA
-- ====================================================================

-- Calculate total volume directly from inserted workouts for accuracy
UPDATE profiles p
SET total_volume = COALESCE((
  SELECT SUM(valid_rep_count) FROM workouts w WHERE w.user_id = p.id
), p.total_volume);

NOTIFY pgrst, 'reload schema';

SELECT 'Data inserted successfully for user d0a891af-8821-4418-ae15-412a7ad0b262!' AS status;


-- Fix RLS policy for accepting friends
DROP POLICY IF EXISTS "Users can add friends" ON friends;
CREATE POLICY "Users can add friends" ON friends 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

NOTIFY pgrst, 'reload schema';


-- ====================================================================
-- FIX ALL RLS POLICIES FOR PROFILES, FRIENDS, & FRIEND REQUESTS
-- ====================================================================

-- 1. PROFILES: Allow all logged-in users to view profiles (for search, friends & leaderboard)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON profiles;

CREATE POLICY "Public profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- 2. FRIENDS: Allow viewing and inserting mutual friend connections
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Friends are viewable by user" ON friends;
DROP POLICY IF EXISTS "Friends are viewable by the user." ON friends;
DROP POLICY IF EXISTS "Users can add friends" ON friends;
DROP POLICY IF EXISTS "Users can add friends." ON friends;
DROP POLICY IF EXISTS "Users can remove friends" ON friends;
DROP POLICY IF EXISTS "Users can remove friends." ON friends;
DROP POLICY IF EXISTS "Users can manage friends" ON friends;

CREATE POLICY "Users can view friends" ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage friends" ON public.friends FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);


-- 3. FRIEND REQUESTS: Allow sending, seeing, accepting, and cancelling requests
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see requests sent to or from them." ON friend_requests;
DROP POLICY IF EXISTS "Users can send requests." ON friend_requests;
DROP POLICY IF EXISTS "Users can delete requests." ON friend_requests;
DROP POLICY IF EXISTS "Users can delete their own requests." ON friend_requests;
DROP POLICY IF EXISTS "Users can see requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send requests" ON friend_requests;

CREATE POLICY "Users can see requests" ON public.friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send requests" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can delete requests" ON public.friend_requests FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Reload Supabase API Cache
NOTIFY pgrst, 'reload schema';



-- Ensure unique index for username in lower case
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles (LOWER(username));
NOTIFY pgrst, 'reload schema';





ALTER TABLE profiles
ADD COLUMN weight_kg NUMERIC DEFAULT NULL,
ADD COLUMN height_cm NUMERIC DEFAULT NULL,
ADD COLUMN age INTEGER DEFAULT NULL,
ADD COLUMN gender TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';


-- 1. Add level and xp columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;

-- 2. Create the achievements tracking table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  progress integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  type text NOT NULL, -- 'daily', 'weekly', 'lifetime'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Add Unique constraint so a user doesn't get duplicate achievement records
ALTER TABLE public.user_achievements
ADD CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id);

-- 4. Enable Row Level Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can read own achievements"
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON public.user_achievements
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Important: Notify the API to reload the schema cache so the app can instantly see the new columns
NOTIFY pgrst, 'reload schema';


-- 1. Create XP Transactions Table
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL, -- e.g. 'workout_reps', 'quest_daily_pushups'
  reference_id uuid, -- Client UUID reference for idempotent workout/quest sync
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Index for faster leaderboard timeframe queries & idempotent sync
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_date 
ON public.xp_transactions (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at
ON public.xp_transactions (created_at);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_reference_id
ON public.xp_transactions (reference_id);

-- 3. Row Level Security
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON public.xp_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.xp_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';


-- 1. DELETE THE BLOATED DUPLICATE QUEST XP TRANSACTIONS
-- This deletes all the duplicated 50 XP quest entries that caused the 1800XP on the leaderboard.
DELETE FROM public.xp_transactions 
WHERE source LIKE 'quest_%';

-- 2. FIX YOUR PROFILE XP BACK TO NORMAL
-- Replace '50' with whatever XP you actually want (e.g. 150)
-- Replace 'YOUR_USERNAME_HERE' with your actual username in the app
UPDATE public.profiles 
SET xp = 150 
WHERE username = 'M.Daniyal';



ALTER TABLE public.profiles ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;


-- Run this snippet in your Supabase SQL Editor 
-- (get_statistics_range_data defined canonically below)




-- 1)
ALTER TABLE workouts 
ADD COLUMN sets_data JSONB,
ADD COLUMN valid_rep_count INT4;

-- 2)
ALTER TABLE workouts 
ADD COLUMN is_ended_early BOOLEAN DEFAULT FALSE;

-- 3)
ALTER TABLE workouts 
ADD COLUMN valid_active_seconds INT4 DEFAULT 0;

-- 4)
UPDATE profiles p
SET preferences = COALESCE(p.preferences, '{}'::jsonb) || 
                  jsonb_build_object(
                    'pushup_target', up.pushup_target,
                    'squat_target', up.squat_target,
                    'plank_target', up.plank_target
                  )
FROM user_preferences up
WHERE p.id = up.user_id;

-- 5)
DROP TABLE user_preferences;


-- Upgrading the profiles table for gamification
ALTER TABLE profiles
ADD COLUMN xp INT DEFAULT 0,
ADD COLUMN level INT DEFAULT 1;

-- Upgrading workouts to track verified effort vs raw time
ALTER TABLE workouts
ADD COLUMN valid_rep_count INT DEFAULT 0,
ADD COLUMN valid_active_seconds INT DEFAULT 0,
ADD COLUMN duration_seconds INT DEFAULT 0,
ADD COLUMN is_ended_early BOOLEAN DEFAULT false,
ADD COLUMN earned_xp INT DEFAULT 0;
B. New Gamification Tables
Created the read-only dictionary, the user achievement tracker, and the immutable XP ledger.

SQL
-- 1. The Secure Dictionary (Read-Only for frontend)
CREATE TABLE quest_dictionary (
    id TEXT PRIMARY KEY,
    xp_reward INT NOT NULL,
    target INT NOT NULL,
    type TEXT NOT NULL -- 'daily', 'medium', 'hard', 'lifetime'
);

-- 2. The User Achievement Tracker
CREATE TABLE user_achievements (
    user_id UUID REFERENCES auth.users(id),
    achievement_id TEXT REFERENCES quest_dictionary(id),
    type TEXT,
    is_completed BOOLEAN DEFAULT false,
    progress INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, achievement_id)
);

-- 3. The Immutable XP Ledger
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    amount INT NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- 4. Backend Security & Triggers (SQL)
-- To ensure users cannot spoof XP drops from the frontend, we implemented two primary Postgres Triggers.

-- Trigger 1: Base Workout XP & Biological Anti-Cheat
-- When a workout session is inserted, this trigger ignores whatever XP the frontend claims. It recalculates the XP based on verified metrics, enforces a biological sanity check (e.g., you cannot do more than 2 valid reps per second), and enforces a hard cap of 300 XP per session.

-- SQL
CREATE OR REPLACE FUNCTION secure_calculate_xp()
RETURNS TRIGGER AS $$
DECLARE
    safe_reps INT := 0;
    safe_seconds INT := 0;
... (82 lines left)



-- ====================================================================
-- 1. DELETE PREVIOUS DATA (Excluding auth.users)
-- ====================================================================

-- Wipe biomechanical metrics linked to your workouts
DELETE FROM public.biomechanical_metrics WHERE workout_id IN (SELECT id FROM public.workouts WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262');

-- Wipe workouts, friends, requests, and other dynamic data
DELETE FROM public.workouts WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.friend_requests WHERE sender_id = 'd0a891af-8821-4418-ae15-412a7ad0b262' OR receiver_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.friends WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262' OR friend_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.user_achievements WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.user_preferences WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.subscriptions WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';
DELETE FROM public.user_devices WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';


-- ====================================================================
-- 2. UPDATE PROFILE WITH NEW DATA (RPG Stats & Physical Metrics)
-- ====================================================================
UPDATE public.profiles SET
  username = 'daniyal_beast',
  avatar_url = 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150',
  is_premium = true,
  streak_count = 12,
  level = 7,
  xp = 2400,
  weight_kg = 75.5,
  height_cm = 182,
  age = 25,
  gender = 'male'
WHERE id = 'd0a891af-8821-4418-ae15-412a7ad0b262';


-- ====================================================================
-- 3. INSERT NEW DIVERSE WORKOUTS
-- ====================================================================
INSERT INTO public.workouts (id, user_id, exercise_type, valid_rep_count, valid_active_seconds, duration_seconds, created_at)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pushup', 65, 0, 110, NOW() - INTERVAL '1 hour'),
  ('11111111-0000-0000-0000-000000000002', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'squat', 120, 0, 210, NOW() - INTERVAL '1 day'),
  ('11111111-0000-0000-0000-000000000003', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'plank', 0, 240, 240, NOW() - INTERVAL '2 days'),
  ('11111111-0000-0000-0000-000000000004', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'lunge', 80, 0, 160, NOW() - INTERVAL '3 days'),
  ('11111111-0000-0000-0000-000000000005', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'situp', 100, 0, 180, NOW() - INTERVAL '5 days'),
  ('11111111-0000-0000-0000-000000000006', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pullup', 30, 0, 95, NOW() - INTERVAL '7 days');


-- ====================================================================
-- 4. INSERT BIOMECHANICAL FORM DATA
-- ====================================================================
INSERT INTO public.biomechanical_metrics (workout_id, joint_angles, velocity_data, form_score)
VALUES
  ('11111111-0000-0000-0000-000000000001', '{"elbow_left": 92.5, "elbow_right": 91.0, "shoulder_left": 44.5, "shoulder_right": 45.2}'::jsonb, '{"avg_velocity_m_s": 0.55, "peak_velocity_m_s": 0.70}'::jsonb, 98),
  ('11111111-0000-0000-0000-000000000002', '{"knee_left": 88.5, "knee_right": 89.2, "hip_angle": 78.5}'::jsonb, '{"avg_velocity_m_s": 0.60, "peak_velocity_m_s": 0.85}'::jsonb, 95),
  ('11111111-0000-0000-0000-000000000004', '{"knee_left": 85.0, "knee_right": 86.5, "hip_angle": 80.0}'::jsonb, '{"avg_velocity_m_s": 0.50, "peak_velocity_m_s": 0.65}'::jsonb, 92);


-- ====================================================================
-- 5. INSERT FRIENDS & FRIEND REQUESTS (Using Opponent IDs)
-- ====================================================================

-- Active Friends (Bidirectional)
INSERT INTO public.friends (user_id, friend_id)
VALUES
  ('d0a891af-8821-4418-ae15-412a7ad0b262', '22222222-2222-2222-2222-222222222222'), -- Sarah
  ('22222222-2222-2222-2222-222222222222', 'd0a891af-8821-4418-ae15-412a7ad0b262'),

  ('d0a891af-8821-4418-ae15-412a7ad0b262', '33333333-3333-3333-3333-333333333333'), -- Zain
  ('33333333-3333-3333-3333-333333333333', 'd0a891af-8821-4418-ae15-412a7ad0b262'),

  ('d0a891af-8821-4418-ae15-412a7ad0b262', '44444444-4444-4444-4444-444444444444'), -- Emma
  ('44444444-4444-4444-4444-444444444444', 'd0a891af-8821-4418-ae15-412a7ad0b262');

-- Pending Requests
INSERT INTO public.friend_requests (sender_id, receiver_id, status)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pending'), -- David sent you a request
  ('66666666-6666-6666-6666-666666666666', 'd0a891af-8821-4418-ae15-412a7ad0b262', 'pending'), -- Ali sent you a request
  ('d0a891af-8821-4418-ae15-412a7ad0b262', '88888888-8888-8888-8888-888888888888', 'pending'); -- You sent Steve a request


-- ====================================================================
-- 6. INSERT ACHIEVEMENTS
-- ====================================================================
INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
VALUES 
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 'first_workout', NOW() - INTERVAL '30 days'),
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 'streak_3', NOW() - INTERVAL '14 days'),
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 'pushup_100', NOW() - INTERVAL '2 days'),
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 'plank_5m', NOW() - INTERVAL '5 days');


-- ====================================================================
-- 7. INSERT PREFERENCES & SUBSCRIPTIONS
-- ====================================================================
INSERT INTO public.user_preferences (user_id, pushup_target, squat_target, plank_target)
VALUES ('d0a891af-8821-4418-ae15-412a7ad0b262', 100, 150, 300);

INSERT INTO public.subscriptions (user_id, revenuecat_id, tier, status, expires_at)
VALUES ('d0a891af-8821-4418-ae15-412a7ad0b262', 'rc_sub_daniyal_active_new', 'pro', 'active', NOW() + INTERVAL '1 year');


-- ====================================================================
-- 8. RE-CALCULATE AGGREGATES & REFRESH POSTGREST SCHEMA
-- ====================================================================
UPDATE public.profiles p
SET total_volume = COALESCE((
  SELECT SUM(valid_rep_count) FROM public.workouts w WHERE w.user_id = p.id
), p.total_volume)
WHERE id = 'd0a891af-8821-4418-ae15-412a7ad0b262';

NOTIFY pgrst, 'reload schema';



-- 1. Wipe all your old ghost XP transactions to clear out the random 600 XP
DELETE FROM public.xp_transactions WHERE user_id = 'd0a891af-8821-4418-ae15-412a7ad0b262';

-- 2. Manually insert the exact XP for the 6 workouts we injected 
INSERT INTO public.xp_transactions (user_id, amount, source, created_at)
VALUES
  -- 1 hour ago (Pushups)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 65, 'workout_pushup', NOW() - INTERVAL '1 hour'),
  -- 1 day ago (Squats)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 120, 'workout_squat', NOW() - INTERVAL '1 day'),
  -- 2 days ago (Plank - 240s)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 100, 'workout_plank', NOW() - INTERVAL '2 days'),
  -- 3 days ago (Lunges)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 80, 'workout_lunge', NOW() - INTERVAL '3 days'),
  -- 5 days ago (Situps)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 100, 'workout_situp', NOW() - INTERVAL '5 days'),
  -- 7 days ago (Pullups)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 30, 'workout_pullup', NOW() - INTERVAL '7 days');

-- 3. Manually insert the exact XP for the 3 Quests you completed
INSERT INTO public.xp_transactions (user_id, amount, source, created_at)
VALUES
  -- 1 hour ago (Daily Quest: Quick Pump)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 50, 'quest_quick_pump', NOW() - INTERVAL '1 hour'),
  -- 1 day ago (Medium Quest: Leg Day Burn)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 150, 'quest_leg_day_burn', NOW() - INTERVAL '1 day'),
  -- 5 days ago (Medium Quest: Iron Core)
  ('d0a891af-8821-4418-ae15-412a7ad0b262', 150, 'quest_iron_core', NOW() - INTERVAL '5 days');



DROP POLICY IF EXISTS "Users can read own transactions" ON public.xp_transactions;

CREATE POLICY "Anyone can read xp transactions for leaderboards"
  ON public.xp_transactions
  FOR SELECT
  USING (true);


CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH user_workouts AS (
        SELECT w.*, NULLIF(w.form_accuracy, 0) as form_score
        FROM workouts w
        WHERE w.user_id = p_user_id
    ),
    weekly_workouts AS (
        SELECT * FROM user_workouts
        WHERE created_at >= NOW() - INTERVAL '7 days'
    ),
    daily_acc AS (
        SELECT 
            EXTRACT(ISODOW FROM created_at) as day_of_week,
            AVG(form_score) as avg_score
        FROM weekly_workouts
        GROUP BY EXTRACT(ISODOW FROM created_at)
    ),
    acc_trend AS (
        SELECT COALESCE(json_agg(COALESCE(da.avg_score, 0)), '[0,0,0,0,0,0,0]'::json) as trend
        FROM generate_series(1, 7) d(day)
        LEFT JOIN daily_acc da ON da.day_of_week = d.day
    )
    SELECT json_build_object(
        'pushupReps', COALESCE((SELECT SUM(valid_rep_count) FROM user_workouts WHERE exercise_type = 'pushup'), 0),
        'squatReps', COALESCE((SELECT SUM(valid_rep_count) FROM user_workouts WHERE exercise_type = 'squat'), 0),
        'plankTimeMin', COALESCE((SELECT SUM(valid_active_seconds)/60 FROM user_workouts WHERE exercise_type = 'plank'), 0),
        'totalTimeHr', COALESCE((SELECT SUM(duration_seconds)/3600 FROM user_workouts), 0),
        'totalTimeMin', COALESCE((SELECT SUM(duration_seconds)/60 FROM user_workouts), 0),
        'totalVolume', (SELECT COALESCE(total_volume, 0) FROM profiles WHERE id = p_user_id),
        'weeklySets', (SELECT COUNT(*) FROM weekly_workouts),
        'weeklyReps', COALESCE((SELECT SUM(valid_rep_count) FROM weekly_workouts), 0),
        'weeklyPushupAccuracy', COALESCE((SELECT AVG(form_score) FROM weekly_workouts WHERE exercise_type = 'pushup'), 85),
        'weeklySquatAccuracy', COALESCE((SELECT AVG(form_score) FROM weekly_workouts WHERE exercise_type = 'squat'), 88),
        'formScore', COALESCE((SELECT AVG(form_score) FROM user_workouts), 0),
        'accuracyTrend', (SELECT trend FROM acc_trend)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_statistics_range_data(
    p_user_id UUID, 
    p_range TEXT, 
    p_offset INT DEFAULT 0
) 
RETURNS JSON AS $$ 
DECLARE 
  result JSON; 
  v_cutoff_start TIMESTAMPTZ;
  v_cutoff_end TIMESTAMPTZ := NOW();
  v_now TIMESTAMPTZ := NOW();
BEGIN 
  -- Pro Security Gate: Free tier users can ONLY view 'week' statistics. 'month' and 'year' are Pro-exclusive.
  IF p_range IN ('month', 'year') AND NOT public.is_active_pro(p_user_id) THEN
    RETURN json_build_object(
        'isLocked', true,
        'labelPrefix', CASE WHEN p_range = 'month' THEN 'Monthly' ELSE 'Yearly' END,
        'reps', 0,
        'sets', 0,
        'activeDays', 0,
        'timeSec', 0,
        'timeMin', 0,
        'pushupReps', 0,
        'squatReps', 0,
        'plankTimeSec', 0,
        'plankTimeMin', 0,
        'pushupAccuracy', 0,
        'squatAccuracy', 0,
        'plankAccuracy', 0,
        'accuracy', 0,
        'trend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'timeTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'setsTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'repsTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'pushupTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'squatTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'plankTrend', CASE WHEN p_range = 'month' THEN '[0,0,0,0]'::json ELSE '[0,0,0,0,0,0,0,0,0,0,0,0]'::json END,
        'labels', CASE 
            WHEN p_range = 'month' THEN '["W1","W2","W3","W4"]'::json 
            ELSE '["J","F","M","A","M","J","J","A","S","O","N","D"]'::json 
        END
    );
  END IF;

  IF p_range = 'week' THEN 
    v_cutoff_start := DATE_TRUNC('week', v_now) + (p_offset || ' weeks')::INTERVAL; 
    IF p_offset < 0 THEN
      v_cutoff_end := v_cutoff_start + INTERVAL '1 week';
    END IF;
  ELSIF p_range = 'year' THEN
    v_cutoff_start := DATE_TRUNC('year', v_now);
    v_cutoff_end := v_cutoff_start + INTERVAL '1 year';
  ELSE -- 'month'
    v_cutoff_start := DATE_TRUNC('month', v_now) + (p_offset || ' months')::INTERVAL;
    IF p_offset < 0 THEN
      v_cutoff_end := v_cutoff_start + INTERVAL '1 month';
    END IF;
  END IF;

  WITH range_workouts AS (
      SELECT 
          w.*, 
          NULLIF(w.form_accuracy, 0) as form_score
      FROM workouts w
      WHERE w.user_id = p_user_id 
        AND w.created_at >= v_cutoff_start 
        AND w.created_at < v_cutoff_end
  ),
  daily_acc AS (
      SELECT
          EXTRACT(ISODOW FROM created_at) as day_of_week,
          AVG(form_score) as avg_score,
          SUM(duration_seconds) as total_time_sec,
          COUNT(*) as sets_count,
          SUM(valid_rep_count) as reps_count,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups') THEN valid_rep_count ELSE 0 END) as pushup_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats') THEN valid_rep_count ELSE 0 END) as squat_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks') THEN GREATEST(valid_active_seconds, duration_seconds) ELSE 0 END) as plank_time_sec
      FROM range_workouts
      WHERE p_range = 'week'
      GROUP BY EXTRACT(ISODOW FROM created_at)
  ),
  weekly_acc AS (
      SELECT
          LEAST(FLOOR((EXTRACT(DAY FROM created_at) - 1) / 7) + 1, 4) as week_num,
          AVG(form_score) as avg_score,
          SUM(duration_seconds) as total_time_sec,
          COUNT(*) as sets_count,
          SUM(valid_rep_count) as reps_count,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups') THEN valid_rep_count ELSE 0 END) as pushup_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats') THEN valid_rep_count ELSE 0 END) as squat_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks') THEN GREATEST(valid_active_seconds, duration_seconds) ELSE 0 END) as plank_time_sec
      FROM range_workouts
      WHERE p_range = 'month'
      GROUP BY 1
  ),
  monthly_acc AS (
      SELECT
          EXTRACT(MONTH FROM created_at) as month_num,
          AVG(form_score) as avg_score,
          SUM(duration_seconds) as total_time_sec,
          COUNT(*) as sets_count,
          SUM(valid_rep_count) as reps_count,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups') THEN valid_rep_count ELSE 0 END) as pushup_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats') THEN valid_rep_count ELSE 0 END) as squat_reps,
          SUM(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks') THEN GREATEST(valid_active_seconds, duration_seconds) ELSE 0 END) as plank_time_sec
      FROM range_workouts
      WHERE p_range = 'year'
      GROUP BY EXTRACT(MONTH FROM created_at)
  ),
  acc_trend AS (
      SELECT
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(ROUND(COALESCE(da.avg_score, 0)) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(ROUND(COALESCE(wa.avg_score, 0)) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(ROUND(COALESCE(ma.avg_score, 0)) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.total_time_sec, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.total_time_sec, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.total_time_sec, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as time_trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.sets_count, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.sets_count, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.sets_count, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as sets_trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.reps_count, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.reps_count, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.reps_count, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as reps_trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.pushup_reps, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.pushup_reps, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.pushup_reps, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as pushup_trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.squat_reps, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.squat_reps, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.squat_reps, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as squat_trend,
          CASE
              WHEN p_range = 'week' THEN (SELECT COALESCE(json_agg(COALESCE(da.plank_time_sec, 0) ORDER BY d.day ASC), '[0,0,0,0,0,0,0]'::json) FROM generate_series(1, 7) d(day) LEFT JOIN daily_acc da ON da.day_of_week = d.day)
              WHEN p_range = 'month' THEN (SELECT COALESCE(json_agg(COALESCE(wa.plank_time_sec, 0) ORDER BY w.wk ASC), '[0,0,0,0]'::json) FROM generate_series(1, 4) w(wk) LEFT JOIN weekly_acc wa ON wa.week_num = w.wk)
              ELSE (SELECT COALESCE(json_agg(COALESCE(ma.plank_time_sec, 0) ORDER BY m.mon ASC), '[0,0,0,0,0,0,0,0,0,0,0,0]'::json) FROM generate_series(1, 12) m(mon) LEFT JOIN monthly_acc ma ON ma.month_num = m.mon)
          END as plank_trend
  )
  SELECT json_build_object(
      'labelPrefix', CASE WHEN p_range = 'week' THEN 'Weekly' WHEN p_range = 'month' THEN 'Monthly' ELSE 'Yearly' END,
      'reps', COALESCE((SELECT SUM(valid_rep_count) FROM range_workouts), 0),
      'sets', (SELECT COUNT(*) FROM range_workouts),
      'activeDays', (SELECT COUNT(DISTINCT created_at::DATE) FROM range_workouts),
      'timeSec', COALESCE((SELECT SUM(duration_seconds) FROM range_workouts), 0),
      'timeMin', COALESCE((SELECT ROUND(SUM(duration_seconds)/60.0) FROM range_workouts), 0),
      'pushupReps', COALESCE((SELECT SUM(valid_rep_count) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups')), 0),
      'squatReps', COALESCE((SELECT SUM(valid_rep_count) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats')), 0),
      'plankTimeSec', COALESCE((SELECT SUM(GREATEST(valid_active_seconds, duration_seconds)) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks')), 0),
      'plankTimeMin', COALESCE((SELECT ROUND(SUM(GREATEST(valid_active_seconds, duration_seconds))/60.0) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks')), 0),
      'pushupAccuracy', COALESCE((SELECT ROUND(AVG(form_score)) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups')), 85),
      'squatAccuracy', COALESCE((SELECT ROUND(AVG(form_score)) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats')), 88),
      'plankAccuracy', COALESCE((SELECT ROUND(AVG(form_score)) FROM range_workouts WHERE LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks')), 87),
      'accuracy', COALESCE((SELECT ROUND(AVG(form_score)) FROM range_workouts), 0),
      'trend', (SELECT trend FROM acc_trend),
      'timeTrend', (SELECT time_trend FROM acc_trend),
      'setsTrend', (SELECT sets_trend FROM acc_trend),
      'repsTrend', (SELECT reps_trend FROM acc_trend),
      'pushupTrend', (SELECT pushup_trend FROM acc_trend),
      'squatTrend', (SELECT squat_trend FROM acc_trend),
      'plankTrend', (SELECT plank_trend FROM acc_trend),
      'labels', CASE 
          WHEN p_range = 'week' THEN '["M","T","W","T","F","S","S"]'::json 
          WHEN p_range = 'month' THEN '["W1","W2","W3","W4"]'::json 
          ELSE '["J","F","M","A","M","J","J","A","S","O","N","D"]'::json 
      END
  ) INTO result;

  RETURN result;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_personal_records(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'maxPushups', COALESCE(MAX(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('pushup', 'pushups') THEN COALESCE(valid_rep_count, 0) ELSE 0 END), 0),
        'maxSquats', COALESCE(MAX(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('squat', 'squats') THEN COALESCE(valid_rep_count, 0) ELSE 0 END), 0),
        'maxPlankTime', COALESCE(MAX(CASE WHEN LOWER(REPLACE(REPLACE(exercise_type, '-', ''), '_', '')) IN ('plank', 'planks') THEN GREATEST(COALESCE(valid_active_seconds, 0), COALESCE(duration_seconds, 0)) ELSE 0 END), 0)
    ) INTO result
    FROM workouts
    WHERE user_id = COALESCE(p_user_id, auth.uid());

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- 9. WORKOUT XP TRIGGER
-- ====================================================================

CREATE OR REPLACE FUNCTION secure_calculate_xp()
RETURNS TRIGGER AS $$
DECLARE
    base_xp FLOAT := 0;
    speed_multiplier FLOAT := 1.0;
    completion_multiplier FLOAT := 1.0;
    final_xp INT;
    expected_time FLOAT;
BEGIN
    -- 1. BASE XP (BALANCED)
    IF NEW.valid_rep_count > 0 THEN
        base_xp := NEW.valid_rep_count; -- 1 Rep = 1 XP
    ELSIF NEW.valid_active_seconds > 0 THEN
        base_xp := NEW.valid_active_seconds / 4.0; -- 4 Seconds = 1 XP (Game Balance Fix)
    END IF;

    IF base_xp = 0 THEN
        NEW.earned_xp := 0;
        RETURN NEW;
    END IF;

    -- 2. THE MULTIPLIERS (Unchanged)
    IF NEW.valid_rep_count > 0 THEN
        expected_time := NEW.valid_rep_count * 4.0; 
        IF NEW.duration_seconds <= (expected_time * 0.8) THEN speed_multiplier := 1.2;
        ELSIF NEW.duration_seconds <= (expected_time * 1.3) THEN speed_multiplier := 1.0;
        ELSE speed_multiplier := 0.8; END IF;
    ELSIF NEW.valid_active_seconds > 0 THEN
        expected_time := NEW.valid_active_seconds;
        IF NEW.duration_seconds <= (expected_time * 1.1) THEN speed_multiplier := 1.2; 
        ELSIF NEW.duration_seconds <= (expected_time * 1.5) THEN speed_multiplier := 1.0;
        ELSE speed_multiplier := 0.8; END IF;
    END IF;

    -- 3. THE COMPLETION PENALTY
    IF (NEW.target_reps > 0 AND NEW.valid_rep_count < NEW.target_reps) OR 
       (NEW.target_seconds > 0 AND NEW.valid_active_seconds < NEW.target_seconds) THEN
        completion_multiplier := 0.7; 
        NEW.is_ended_early := true; 
    END IF;

    -- 4. CALCULATE FINAL XP
    final_xp := ROUND(base_xp * speed_multiplier * completion_multiplier);
    NEW.earned_xp := final_xp; 

    -- Safely update profiles without using an alias to avoid Pgrst issues
    UPDATE profiles SET total_score = COALESCE(total_score, 0) + NEW.earned_xp WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_workout_xp ON workouts;
DROP FUNCTION IF EXISTS secure_calculate_xp();

-- ==========================================
-- UNIFIED XP LEDGER MIGRATION
-- ==========================================
ALTER TABLE xp_transactions ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE workouts DROP COLUMN IF EXISTS earned_xp;

-- ==========================================
-- LEADERBOARD RPCs (Phase 1)
-- ==========================================

-- 1. Global All-Time Pagination
CREATE OR REPLACE FUNCTION get_paginated_all_time(page_number INT, page_size INT)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    RANK() OVER (ORDER BY xp DESC, id ASC) as rank,
    id as user_id,
    username,
    avatar_url,
    xp as total_xp,
    country_flag
  FROM profiles
  ORDER BY xp DESC, id ASC
  OFFSET (page_number - 1) * page_size
  LIMIT page_size;
$$;

-- 2. Global All-Time Current User Rank
CREATE OR REPLACE FUNCTION get_user_rank_all_time(target_user_id UUID)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ranked_users AS (
    SELECT 
      RANK() OVER (ORDER BY xp DESC, id ASC) as rank,
      id as user_id,
      username,
      avatar_url,
      xp as total_xp,
      country_flag
    FROM profiles
  )
  SELECT * FROM ranked_users WHERE user_id = target_user_id;
$$;

-- 3. Global Weekly Pagination
DROP FUNCTION IF EXISTS get_paginated_weekly(INT, INT);
CREATE OR REPLACE FUNCTION get_paginated_weekly(page_number INT, page_size INT, offset_weeks INT DEFAULT 0)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, is_premium BOOLEAN, level INT, total_volume BIGINT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH weekly_xp AS (
    SELECT 
      user_id,
      SUM(amount) as weekly_total
    FROM xp_transactions
    WHERE created_at >= date_trunc('week', now()) + (offset_weeks || ' weeks')::interval
      AND created_at < date_trunc('week', now()) + ((offset_weeks + 1) || ' weeks')::interval
    GROUP BY user_id
  )
  SELECT 
    RANK() OVER (ORDER BY COALESCE(w.weekly_total, 0) DESC, p.id ASC) as rank,
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.is_premium,
    p.level,
    p.total_volume,
    COALESCE(w.weekly_total::INT, 0) as total_xp,
    p.country_flag
  FROM profiles p
  LEFT JOIN weekly_xp w ON p.id = w.user_id
  WHERE p.username IS NOT NULL AND p.username != ''
  ORDER BY COALESCE(w.weekly_total, 0) DESC, p.id ASC
  OFFSET (page_number - 1) * page_size
  LIMIT page_size;
$$;

-- 4. Global Weekly Current User Rank
DROP FUNCTION IF EXISTS get_user_rank_weekly(UUID);
CREATE OR REPLACE FUNCTION get_user_rank_weekly(target_user_id UUID, offset_weeks INT DEFAULT 0)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, is_premium BOOLEAN, level INT, total_volume BIGINT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH weekly_xp AS (
    SELECT 
      user_id,
      SUM(amount) as weekly_total
    FROM xp_transactions
    WHERE created_at >= date_trunc('week', now()) + (offset_weeks || ' weeks')::interval
      AND created_at < date_trunc('week', now()) + ((offset_weeks + 1) || ' weeks')::interval
    GROUP BY user_id
  ),
  ranked_users AS (
    SELECT 
      RANK() OVER (ORDER BY COALESCE(w.weekly_total, 0) DESC, p.id ASC) as rank,
      p.id as user_id,
      p.username,
      p.avatar_url,
      p.is_premium,
      p.level,
      p.total_volume,
      COALESCE(w.weekly_total::INT, 0) as total_xp,
      p.country_flag
    FROM profiles p
    LEFT JOIN weekly_xp w ON p.id = w.user_id
    WHERE p.username IS NOT NULL AND p.username != ''
  )
  SELECT * FROM ranked_users WHERE user_id = target_user_id;
$$;

-- 5. Global Monthly Pagination
DROP FUNCTION IF EXISTS get_paginated_monthly(INT, INT);
DROP FUNCTION IF EXISTS get_paginated_monthly(INT, INT, INT);
CREATE OR REPLACE FUNCTION get_paginated_monthly(page_number INT, page_size INT, offset_months INT DEFAULT 0)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, is_premium BOOLEAN, level INT, total_volume BIGINT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH monthly_xp AS (
    SELECT 
      user_id,
      SUM(amount) as monthly_total
    FROM xp_transactions
    WHERE created_at >= date_trunc('month', now()) + (offset_months || ' months')::interval
      AND created_at < date_trunc('month', now()) + ((offset_months + 1) || ' months')::interval
    GROUP BY user_id
  )
  SELECT 
    RANK() OVER (ORDER BY COALESCE(m.monthly_total, 0) DESC, p.id ASC) as rank,
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.is_premium,
    p.level,
    p.total_volume,
    COALESCE(m.monthly_total::INT, 0) as total_xp,
    p.country_flag
  FROM profiles p
  LEFT JOIN monthly_xp m ON p.id = m.user_id
  WHERE p.username IS NOT NULL AND p.username != ''
  ORDER BY COALESCE(m.monthly_total, 0) DESC, p.id ASC
  OFFSET (page_number - 1) * page_size
  LIMIT page_size;
$$;

-- 6. Global Monthly Current User Rank
DROP FUNCTION IF EXISTS get_user_rank_monthly(UUID);
DROP FUNCTION IF EXISTS get_user_rank_monthly(UUID, INT);
CREATE OR REPLACE FUNCTION get_user_rank_monthly(target_user_id UUID, offset_months INT DEFAULT 0)
RETURNS TABLE (rank BIGINT, user_id UUID, username TEXT, avatar_url TEXT, is_premium BOOLEAN, level INT, total_volume BIGINT, total_xp INT, country_flag TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH monthly_xp AS (
    SELECT 
      user_id,
      SUM(amount) as monthly_total
    FROM xp_transactions
    WHERE created_at >= date_trunc('month', now()) + (offset_months || ' months')::interval
      AND created_at < date_trunc('month', now()) + ((offset_months + 1) || ' months')::interval
    GROUP BY user_id
  ),
  ranked_users AS (
    SELECT 
      RANK() OVER (ORDER BY COALESCE(m.monthly_total, 0) DESC, p.id ASC) as rank,
      p.id as user_id,
      p.username,
      p.avatar_url,
      p.is_premium,
      p.level,
      p.total_volume,
      COALESCE(m.monthly_total::INT, 0) as total_xp,
      p.country_flag
    FROM profiles p
    LEFT JOIN monthly_xp m ON p.id = m.user_id
    WHERE p.username IS NOT NULL AND p.username != ''
  )
  SELECT * FROM ranked_users WHERE user_id = target_user_id;
$$;

-- ====================================================================
-- PHASE 4: SERVER-AUTHORITATIVE BACKEND RE-ARCHITECTURE
-- ====================================================================

-- 1. Idempotent XP Transactions Reference Column & Index
ALTER TABLE public.xp_transactions ADD COLUMN IF NOT EXISTS reference_id UUID;
CREATE INDEX IF NOT EXISTS idx_xp_transactions_reference_id ON public.xp_transactions(reference_id);

-- 2. Helper Function: Pure Level Progression from XP
CREATE OR REPLACE FUNCTION public.calculate_level_from_xp(p_xp INT)
RETURNS INT AS $$
DECLARE
    v_xp INT := COALESCE(p_xp, 0);
BEGIN
    IF v_xp >= 25000 THEN
        RETURN 10 + FLOOR((v_xp - 25000) / 5000);
    ELSIF v_xp >= 18000 THEN RETURN 9;
    ELSIF v_xp >= 14000 THEN RETURN 8;
    ELSIF v_xp >= 10500 THEN RETURN 7;
    ELSIF v_xp >= 7500 THEN RETURN 6;
    ELSIF v_xp >= 5000 THEN RETURN 5;
    ELSIF v_xp >= 3000 THEN RETURN 4;
    ELSIF v_xp >= 1500 THEN RETURN 3;
    ELSIF v_xp >= 500 THEN RETURN 2;
    ELSE RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Drop existing function signatures to ensure clean parameter updates
DROP FUNCTION IF EXISTS public.log_workout_session(UUID, TEXT, INT, INT, INT, FLOAT, INT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.log_workout_session(UUID, TEXT, INT, INT, INT, FLOAT, INT, INT, BOOLEAN, UUID, TIMESTAMPTZ);

-- 3. The Server-Authoritative log_workout_session RPC
CREATE OR REPLACE FUNCTION public.log_workout_session(
    p_user_id UUID,
    p_exercise_type TEXT,
    p_duration_seconds INT,
    p_valid_rep_count INT,
    p_valid_active_seconds INT,
    p_form_accuracy FLOAT,
    p_target_reps INT,
    p_target_seconds INT,
    p_is_ended_early BOOLEAN,
    p_workout_id UUID DEFAULT NULL,
    p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    workout_id UUID, 
    earned_xp INT, 
    streak_bonus_xp INT, 
    streak_days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workout_id UUID := COALESCE(p_workout_id, gen_random_uuid());
    v_created_at TIMESTAMPTZ := COALESCE(p_created_at, NOW());
    v_base_xp FLOAT := 0;
    v_speed_multiplier FLOAT := 1.0;
    v_completion_multiplier FLOAT := 1.0;
    v_final_xp INT := 0;
    v_expected_time FLOAT;
    v_is_ended_early BOOLEAN := COALESCE(p_is_ended_early, false);
    v_old_streak INT := 0;
    v_new_streak INT := 0;
    v_streak_bonus_xp INT := 0;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. SERVER-SIDE SANITY CHECKS & ANTI-TAMPERING
    -- -------------------------------------------------------------------------
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id cannot be null';
    END IF;

    -- Clock Tampering Guard: Reject workouts timestamped > 1 hour in the future
    IF v_created_at > (NOW() + INTERVAL '1 hour') THEN
        RAISE EXCEPTION 'Invalid workout timestamp: workout cannot be in the future (timestamp: %, server_now: %)', v_created_at, NOW();
    END IF;

    -- Stale Guard: Reject workouts older than 90 days
    IF v_created_at < (NOW() - INTERVAL '90 days') THEN
        RAISE EXCEPTION 'Invalid workout timestamp: workout is older than 90 days (timestamp: %)', v_created_at;
    END IF;

    -- Bounds checks on workout metrics
    IF p_duration_seconds < 0 OR p_duration_seconds > 86400 THEN
        RAISE EXCEPTION 'Invalid duration: must be between 0 and 86400 seconds';
    END IF;

    IF p_valid_rep_count < 0 OR p_valid_rep_count > 10000 THEN
        RAISE EXCEPTION 'Invalid rep count: must be between 0 and 10000';
    END IF;

    IF p_valid_active_seconds < 0 OR p_valid_active_seconds > 86400 THEN
        RAISE EXCEPTION 'Invalid active seconds: must be between 0 and 86400';
    END IF;

    IF p_form_accuracy < 0 OR p_form_accuracy > 100 THEN
        RAISE EXCEPTION 'Invalid form accuracy: must be between 0 and 100';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. CLIENT UUID IDEMPOTENCY GUARD
    -- -------------------------------------------------------------------------
    -- If this workout UUID was already inserted (e.g., client retried due to network drop),
    -- exit cleanly and return the already-recorded XP and streak without duplicate mutations!
    IF EXISTS (SELECT 1 FROM public.workouts WHERE id = v_workout_id) THEN
        SELECT COALESCE(SUM(amount), 0)
        INTO v_final_xp
        FROM public.xp_transactions 
        WHERE reference_id = v_workout_id AND source = 'workout';

        SELECT COALESCE(SUM(amount), 0)
        INTO v_streak_bonus_xp
        FROM public.xp_transactions 
        WHERE reference_id = v_workout_id AND source = 'streak_bonus';

        SELECT COALESCE(streak_count, 0) 
        INTO v_new_streak 
        FROM public.profiles 
        WHERE id = p_user_id;

        RETURN QUERY SELECT v_workout_id, v_final_xp, v_streak_bonus_xp, v_new_streak;
        RETURN;
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. SERVER-AUTHORITATIVE XP CALCULATION
    -- -------------------------------------------------------------------------
    -- Get pre-workout streak for streak bonus threshold checking
    SELECT COALESCE(streak_count, 0) INTO v_old_streak FROM public.profiles WHERE id = p_user_id;

    -- Base XP: 1 Rep = 1 XP | 4 Plank Seconds = 1 XP
    IF p_valid_rep_count > 0 THEN
        v_base_xp := p_valid_rep_count;
    ELSIF p_valid_active_seconds > 0 THEN
        v_base_xp := p_valid_active_seconds / 4.0;
    END IF;

    IF v_base_xp > 0 THEN
        -- Speed Multipliers
        IF p_valid_rep_count > 0 THEN
            v_expected_time := p_valid_rep_count * 4.0; 
            IF p_duration_seconds <= (v_expected_time * 0.8) THEN 
                v_speed_multiplier := 1.2;
            ELSIF p_duration_seconds <= (v_expected_time * 1.3) THEN 
                v_speed_multiplier := 1.0;
            ELSE 
                v_speed_multiplier := 0.8; 
            END IF;
        ELSIF p_valid_active_seconds > 0 THEN
            v_expected_time := p_valid_active_seconds;
            IF p_duration_seconds <= (v_expected_time * 1.1) THEN 
                v_speed_multiplier := 1.2; 
            ELSIF p_duration_seconds <= (v_expected_time * 1.5) THEN 
                v_speed_multiplier := 1.0;
            ELSE 
                v_speed_multiplier := 0.8; 
            END IF;
        END IF;

        -- Target Completion Penalty
        IF (p_target_reps > 0 AND p_valid_rep_count < p_target_reps) OR 
           (p_target_seconds > 0 AND p_valid_active_seconds < p_target_seconds) THEN
            v_completion_multiplier := 0.7; 
            v_is_ended_early := true; 
        END IF;

        v_final_xp := ROUND(v_base_xp * v_speed_multiplier * v_completion_multiplier);
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. INSERT WORKOUT RECORD WITH HISTORICAL TIMESTAMP
    -- -------------------------------------------------------------------------
    -- Triggers on_workout_completed (update_user_aggregates) automatically fire here,
    -- updating streak, total_volume, and total_workouts using v_created_at.
    INSERT INTO public.workouts (
        id,
        user_id,
        exercise_type,
        duration_seconds,
        valid_rep_count,
        valid_active_seconds,
        form_accuracy,
        target_reps,
        target_seconds,
        is_ended_early,
        created_at
    )
    VALUES (
        v_workout_id,
        p_user_id,
        p_exercise_type,
        p_duration_seconds,
        p_valid_rep_count,
        p_valid_active_seconds,
        p_form_accuracy,
        p_target_reps,
        p_target_seconds,
        v_is_ended_early,
        v_created_at
    );

    -- -------------------------------------------------------------------------
    -- 5. STREAK BONUS & XP LEDGER TRANSACTIONS
    -- -------------------------------------------------------------------------
    -- Fetch authoritative streak computed by the trigger
    SELECT COALESCE(streak_count, 0) INTO v_new_streak FROM public.profiles WHERE id = p_user_id;

    -- Streak Milestone Bonus (Every 7 days)
    IF v_new_streak > v_old_streak AND v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
        IF v_new_streak = 7 THEN v_streak_bonus_xp := 100;
        ELSIF v_new_streak = 14 THEN v_streak_bonus_xp := 150;
        ELSIF v_new_streak = 21 THEN v_streak_bonus_xp := 200;
        ELSE v_streak_bonus_xp := 250; END IF;
    END IF;

    -- Record immutable ledger entries
    IF v_final_xp > 0 THEN
        INSERT INTO public.xp_transactions (
            user_id,
            amount,
            source,
            reference_id,
            created_at
        )
        VALUES (
            p_user_id,
            v_final_xp,
            'workout',
            v_workout_id,
            v_created_at
        );
    END IF;

    IF v_streak_bonus_xp > 0 THEN
        INSERT INTO public.xp_transactions (
            user_id,
            amount,
            source,
            reference_id,
            created_at
        )
        VALUES (
            p_user_id,
            v_streak_bonus_xp,
            'streak_bonus',
            v_workout_id,
            v_created_at
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 6. ATOMIC PROFILE XP & LEVEL RECONCILIATION
    -- -------------------------------------------------------------------------
    IF v_final_xp > 0 OR v_streak_bonus_xp > 0 THEN
        UPDATE public.profiles 
        SET 
            xp = COALESCE(xp, 0) + v_final_xp + v_streak_bonus_xp,
            level = public.calculate_level_from_xp(COALESCE(xp, 0) + v_final_xp + v_streak_bonus_xp),
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    -- Return authoritative numbers to client
    RETURN QUERY SELECT v_workout_id, v_final_xp, v_streak_bonus_xp, v_new_streak;
END;
$$;

-- ============================================================================
-- TROPHY GAMIFICATION ENGINE: GLOBAL RARITY
-- ============================================================================

-- 1. Create the lightweight stats table
CREATE TABLE IF NOT EXISTS trophy_global_stats (
    trophy_id TEXT PRIMARY KEY,
    rarity_percent NUMERIC(5,2) DEFAULT 0.00,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Read-only for everyone)
ALTER TABLE trophy_global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read trophy stats" 
    ON trophy_global_stats FOR SELECT 
    USING (true);

-- 2. Create the Calculation Engine (RPC)
CREATE OR REPLACE FUNCTION update_trophy_rarity()
RETURNS void AS $$
DECLARE
    total_users INT;
BEGIN
    -- Get total registered users to calculate the baseline percentage
    SELECT COUNT(*) INTO total_users FROM profiles;

    -- Prevent division by zero if the app has no users yet
    IF total_users = 0 THEN
        RETURN;
    END IF;

    -- Calculate the rarity and UPSERT into our stats table
    INSERT INTO trophy_global_stats (trophy_id, rarity_percent, last_updated)
    SELECT 
        achievement_id as trophy_id,
        ROUND((COUNT(DISTINCT user_id)::NUMERIC / total_users::NUMERIC) * 100, 2) as rarity_percent,
        NOW() as last_updated
    FROM user_achievements
    WHERE type = 'trophy'
    GROUP BY achievement_id
    ON CONFLICT (trophy_id) DO UPDATE 
    SET 
        rarity_percent = EXCLUDED.rarity_percent,
        last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- SECURITY DEFINER ensures the cron job bypasses RLS to read all users

-- 3. Enable the pg_cron extension (if not already active)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Schedule the nightly cron job (Runs at 00:00 every day)
SELECT cron.schedule(
    'nightly-trophy-rarity-update', 
    '0 0 * * *', 
    $$SELECT update_trophy_rarity();$$
);

-- ============================================================================
-- GLOBAL LEADERBOARD TROPHIES (Weekly)
-- ============================================================================

-- 1. Create the user_trophies table with timeframe support
CREATE TABLE IF NOT EXISTS public.user_trophies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rank_position SMALLINT NOT NULL CHECK (rank_position IN (1, 2, 3)),
    timeframe VARCHAR(10) NOT NULL DEFAULT 'weekly' CHECK (timeframe IN ('weekly', 'monthly')),
    period_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, timeframe, period_date) 
);

-- Migration safety: Add timeframe & rename week_start_date if upgrading existing table
ALTER TABLE public.user_trophies 
    ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) NOT NULL DEFAULT 'weekly' 
    CHECK (timeframe IN ('weekly', 'monthly'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_trophies' 
          AND column_name = 'week_start_date'
    ) THEN
        ALTER TABLE public.user_trophies RENAME COLUMN week_start_date TO period_date;
    END IF;
END $$;

ALTER TABLE public.user_trophies 
    DROP CONSTRAINT IF EXISTS user_trophies_user_id_week_start_date_key;

ALTER TABLE public.user_trophies 
    DROP CONSTRAINT IF EXISTS unique_user_trophy_period;

ALTER TABLE public.user_trophies 
    ADD CONSTRAINT unique_user_trophy_period UNIQUE (user_id, timeframe, period_date);

-- 2. Setup Row Level Security (RLS) for absolute security
ALTER TABLE public.user_trophies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trophies are publicly viewable" 
ON public.user_trophies FOR SELECT 
USING (true);

-- 3. Create Indexes for hyper-fast profile rendering
CREATE INDEX IF NOT EXISTS idx_user_trophies_user_id ON public.user_trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trophies_timeframe ON public.user_trophies(user_id, timeframe);

-- 4. Automated Weekly Trophy Processing Function
CREATE OR REPLACE FUNCTION process_weekly_trophies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
BEGIN
    v_week_start := date_trunc('week', now() - INTERVAL '1 week')::DATE;
    
    IF EXISTS (SELECT 1 FROM public.user_trophies WHERE timeframe = 'weekly' AND period_date = v_week_start) THEN
        RETURN;
    END IF;

    INSERT INTO public.user_trophies (user_id, rank_position, timeframe, period_date)
    SELECT 
        user_id,
        (ROW_NUMBER() OVER(ORDER BY total_xp DESC))::SMALLINT as rank_position,
        'weekly',
        v_week_start
    FROM (
        SELECT 
            user_id, 
            SUM(amount) as total_xp
        FROM public.xp_transactions
        WHERE created_at >= date_trunc('week', now() - INTERVAL '1 week')
          AND created_at < date_trunc('week', now())
        GROUP BY user_id
        HAVING SUM(amount) > 0
    ) aggregated
    ORDER BY total_xp DESC
    LIMIT 3;
END;
$$;

-- 5. Automated Monthly Trophy Processing Function
CREATE OR REPLACE FUNCTION process_monthly_trophies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', now() - INTERVAL '1 month')::DATE;
    
    IF EXISTS (SELECT 1 FROM public.user_trophies WHERE timeframe = 'monthly' AND period_date = v_month_start) THEN
        RETURN;
    END IF;

    INSERT INTO public.user_trophies (user_id, rank_position, timeframe, period_date)
    SELECT 
        user_id,
        (ROW_NUMBER() OVER(ORDER BY total_xp DESC))::SMALLINT as rank_position,
        'monthly',
        v_month_start
    FROM (
        SELECT 
            user_id, 
            SUM(amount) as total_xp
        FROM public.xp_transactions
        WHERE created_at >= date_trunc('month', now() - INTERVAL '1 month')
          AND created_at < date_trunc('month', now())
        GROUP BY user_id
        HAVING SUM(amount) > 0
    ) aggregated
    ORDER BY total_xp DESC
    LIMIT 3;
END;
$$;

-- 6. Schedule the Cron Jobs
-- Weekly Job: Runs every Monday at 00:01 UTC
SELECT cron.schedule(
    'process_weekly_trophies_job',
    '1 0 * * 1', 
    $$ SELECT process_weekly_trophies(); $$
);

-- Monthly Job: Runs on the 1st of every month at 00:05 UTC
SELECT cron.schedule(
    'process_monthly_trophies_job',
    '5 0 1 * *', 
    $$ SELECT process_monthly_trophies(); $$
);

-- ==========================================
-- NOTIFICATION WEBHOOKS
-- Note: The push-notification edge function maps these triggers to Expo Push
-- and routes the user to: /(tabs)/leaderboard?scope=friends&action=requests
-- ==========================================

-- 1. Create the trigger function using pg_net
CREATE OR REPLACE FUNCTION trigger_push_notification_webhook()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
      url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/push-notification',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_OR_SERVICE_KEY>"}'::jsonb,
      body:=json_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', null
      )::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the friend_requests table
DROP TRIGGER IF EXISTS on_friend_request_insert ON public.friend_requests;

CREATE TRIGGER on_friend_request_insert
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification_webhook();

-- 3. Create the trigger function for accepted friend requests
CREATE OR REPLACE FUNCTION trigger_notify_friend_accepted_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- We insert two rows (A->B and B->A) when a friend request is accepted.
  -- To prevent duplicate notifications, we only fire when auth.uid() = NEW.user_id.
  -- This guarantees the person who clicked "Accept" triggers ONE webhook.
  IF auth.uid() = NEW.user_id THEN
    PERFORM net.http_post(
        url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-friend-accepted',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_OR_SERVICE_KEY>"}'::jsonb,
        body:=json_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA,
          'record', row_to_json(NEW),
          'old_record', null
        )::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the INSERT trigger to the friends table
DROP TRIGGER IF EXISTS on_friend_request_update ON public.friend_requests;
DROP TRIGGER IF EXISTS on_friend_insert ON public.friends;

CREATE TRIGGER on_friend_insert
  AFTER INSERT ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_friend_accepted_webhook();

-- ==========================================
-- 15. SECURE FRIEND REMOVAL RPC
-- ==========================================
-- Securely bypasses RLS to delete both sides of a reciprocal friendship
CREATE OR REPLACE FUNCTION remove_friend(target_friend_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.friends 
  WHERE (user_id = auth.uid() AND friend_id = target_friend_id)
     OR (user_id = target_friend_id AND friend_id = auth.uid());
END;
$$;

-- ============================================================================
-- 16. MIGRATION & BACKFILL: Profile Aggregates (Longest Streak, Total Workouts)
-- ============================================================================
-- Run this block once to backfill existing users with accurate historical metrics
DO $$
DECLARE
  r RECORD;
  w RECORD;
  v_last_date DATE;
  v_curr_date DATE;
  v_streak INT;
  v_longest INT;
  v_total_workouts INT;
  v_total_vol INT;
  v_tz TEXT;
BEGIN
  -- 1. Ensure columns exist
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_workouts INTEGER DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_workout_date DATE NULL;

  -- 2. Iterate each user and reconstruct true all-time metrics
  FOR r IN SELECT id, COALESCE(timezone, 'Asia/Karachi') as user_tz FROM public.profiles LOOP
    v_last_date := NULL;
    v_streak := 0;
    v_longest := 0;
    v_total_workouts := 0;
    v_total_vol := 0;
    v_tz := r.user_tz;

    FOR w IN 
      SELECT valid_rep_count, (created_at AT TIME ZONE v_tz)::DATE as local_d
      FROM public.workouts
      WHERE user_id = r.id
      ORDER BY created_at ASC
    LOOP
      v_total_workouts := v_total_workouts + 1;
      v_total_vol := v_total_vol + COALESCE(w.valid_rep_count, 0);
      v_curr_date := w.local_d;

      IF v_last_date IS NULL THEN
        v_streak := 1;
      ELSIF v_curr_date = v_last_date THEN
        -- Same day workout: maintain current streak
        IF v_streak = 0 THEN
          v_streak := 1;
        END IF;
      ELSIF v_curr_date = (v_last_date + INTERVAL '1 day')::DATE THEN
        -- Next consecutive day: increment streak
        v_streak := v_streak + 1;
      ELSE
        -- Missed day: reset streak to 1
        v_streak := 1;
      END IF;

      IF v_streak > v_longest THEN
        v_longest := v_streak;
      END IF;

      v_last_date := v_curr_date;
    END LOOP;

    -- 3. Atomic update for each user profile
    UPDATE public.profiles
    SET 
      total_workouts = v_total_workouts,
      total_volume = v_total_vol,
      streak_count = v_streak,
      longest_streak = v_longest,
      last_workout_date = v_last_date
    WHERE id = r.id;
  END LOOP;
END $$;



-- ==========================================
-- AUTH HELPER: Check Email Exists (User Enumeration Protection)
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(check_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated, service_role;
