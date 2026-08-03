-- ============================================
-- SimplyChat Database Reset & Setup
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================

-- Drop all existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow insert access to users" ON users;
DROP POLICY IF EXISTS "Allow update access to own user" ON users;
DROP POLICY IF EXISTS "Allow insert access to messages" ON messages;
DROP POLICY IF EXISTS "Allow read access to messages" ON messages;
DROP POLICY IF EXISTS "Allow read access to own messages" ON messages;
DROP POLICY IF EXISTS "Allow read access to public keys" ON public_keys;
DROP POLICY IF EXISTS "Allow insert access to public keys" ON public_keys;
DROP POLICY IF EXISTS "Allow update access to public keys" ON public_keys;

-- Drop tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS public_keys CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT 'managed_by_supabase_auth',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Public keys table (E2E encryption)
CREATE TABLE public_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access to users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow insert access to users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to own user" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow insert access to messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read access to messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow read access to public keys" ON public_keys FOR SELECT USING (true);
CREATE POLICY "Allow insert access to public keys" ON public_keys FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to public keys" ON public_keys FOR UPDATE USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE users TO anon, authenticated;
GRANT ALL ON TABLE messages TO anon, authenticated;
GRANT ALL ON TABLE public_keys TO anon, authenticated;
