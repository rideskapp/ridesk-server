-- ============================================================================
-- Migration: 16_fix_user_registration_rls.sql
-- Description: Fix RLS policies to allow user registration
-- Created: 2024-12-19
-- ============================================================================

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Only SUPER_ADMIN can insert users" ON public.users;

-- Create a new policy that allows user creation during registration
-- This policy allows insertion if:
-- 1. The user is creating their own profile (auth.uid() = id)
-- 2. OR the user is a SUPER_ADMIN
-- 3. OR the operation is being performed by the service role (admin client)
CREATE POLICY "Allow user registration and admin user creation" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    get_user_role(auth.uid()) = 'SUPER_ADMIN' OR
    auth.role() = 'service_role'
  );

-- Also update the update policy to be more permissive for user profile updates
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile or admin can update any" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR 
    get_user_role(auth.uid()) = 'SUPER_ADMIN' OR
    auth.role() = 'service_role'
  );

-- Update the delete policy to be more permissive for admin operations
DROP POLICY IF EXISTS "Only SUPER_ADMIN can delete users" ON public.users;

CREATE POLICY "Admin can delete users" ON public.users
  FOR DELETE USING (
    get_user_role(auth.uid()) = 'SUPER_ADMIN' OR
    auth.role() = 'service_role'
  );
