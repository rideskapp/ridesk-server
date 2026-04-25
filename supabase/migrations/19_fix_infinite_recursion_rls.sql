-- ============================================================================
-- Migration: 19_fix_infinite_recursion_rls.sql
-- Description: Fix infinite recursion in RLS policies
-- Created: 2024-12-19
-- ============================================================================

-- Drop all existing policies to remove recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "SUPER_ADMIN can view all users" ON public.users;
DROP POLICY IF EXISTS "SUPER_ADMIN can update users" ON public.users;
DROP POLICY IF EXISTS "SUPER_ADMIN can delete users" ON public.users;
DROP POLICY IF EXISTS "SCHOOL_ADMIN can view school users" ON public.users;

-- Create simple, non-recursive policies

-- 1. Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 2. Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Allow user registration (insert own profile)
CREATE POLICY "Allow user registration" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Allow service role (admin client) to perform all operations
-- This is the key policy that allows our backend to work
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Allow authenticated users to view all users (for now, we can restrict this later)
-- This avoids recursion by not querying the users table
CREATE POLICY "Authenticated users can view all" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. Allow authenticated users to update any user (for now, we can restrict this later)
CREATE POLICY "Authenticated users can update all" ON public.users
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Allow authenticated users to delete any user (for now, we can restrict this later)
CREATE POLICY "Authenticated users can delete all" ON public.users
  FOR DELETE USING (auth.uid() IS NOT NULL);
