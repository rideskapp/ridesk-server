-- ============================================================================
-- Migration: 18_restore_users_rls_with_proper_policies.sql
-- Description: Restore RLS on users table with proper policies for registration
-- Created: 2024-12-19
-- ============================================================================

-- Re-enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile or admin can update any" ON public.users;
DROP POLICY IF EXISTS "Only SUPER_ADMIN can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow user registration and admin user creation" ON public.users;
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;

-- Create comprehensive RLS policies

-- 1. Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 2. Allow users to update their own profile (except role and school_id)
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Allow user registration (insert own profile)
CREATE POLICY "Allow user registration" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Allow service role (admin client) to perform all operations
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Allow SUPER_ADMIN to view all users
CREATE POLICY "SUPER_ADMIN can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- 6. Allow SUPER_ADMIN to update user roles and school assignments
CREATE POLICY "SUPER_ADMIN can update users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- 7. Allow SUPER_ADMIN to delete users
CREATE POLICY "SUPER_ADMIN can delete users" ON public.users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- 8. Allow SCHOOL_ADMIN to view users in their school
CREATE POLICY "SCHOOL_ADMIN can view school users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      WHERE u1.id = auth.uid() 
      AND u1.role = 'SCHOOL_ADMIN'
      AND u1.school_id = public.users.school_id
    )
  );
