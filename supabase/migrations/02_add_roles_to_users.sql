-- ============================================================================
-- Migration: 02_add_roles_to_users.sql
-- Description: Create public.users table and role management functions
-- Created: 2024-12-19
-- ============================================================================

-- Create public.users table that references auth.users
-- This is the proper way to extend user data in Supabase
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'INSTRUCTOR', 'USER')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  avatar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Create updated_at trigger for users table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'SUPER_ADMIN' FROM public.users WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is school admin
CREATE OR REPLACE FUNCTION is_school_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'SCHOOL_ADMIN' FROM public.users WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is instructor
CREATE OR REPLACE FUNCTION is_instructor(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'INSTRUCTOR' FROM public.users WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user school ID
CREATE OR REPLACE FUNCTION get_user_school_id(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM public.users WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for public.users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only SUPER_ADMIN can view all users" ON public.users
  FOR SELECT USING (get_user_role(auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Only SUPER_ADMIN can insert users" ON public.users
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Only SUPER_ADMIN can update user roles" ON public.users
  FOR UPDATE USING (get_user_role(auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Only SUPER_ADMIN can delete users" ON public.users
  FOR DELETE USING (get_user_role(auth.uid()) = 'SUPER_ADMIN');

-- Create function to update user role (only for SUPER_ADMIN)
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id UUID,
  new_role TEXT,
  new_school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user is SUPER_ADMIN
  IF get_user_role(auth.uid()) != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can update user roles';
  END IF;
  
  -- Update user role and school_id
  UPDATE public.users 
  SET 
    role = new_role,
    school_id = new_school_id,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create user with role
CREATE OR REPLACE FUNCTION create_user_with_role(
  user_email TEXT,
  user_password TEXT,
  user_role TEXT,
  user_school_id UUID DEFAULT NULL,
  user_first_name TEXT DEFAULT NULL,
  user_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if current user is SUPER_ADMIN
  IF get_user_role(auth.uid()) != 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can create users with roles';
  END IF;
  
  -- Create user in auth.users (this will be handled by Supabase Auth)
  -- We'll create the public.users record after auth user creation
  -- This function is mainly for reference - actual user creation should go through Supabase Auth
  
  RAISE EXCEPTION 'User creation should be handled through Supabase Auth API';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync auth user to public.users
-- This should be called after a user signs up through Supabase Auth
CREATE OR REPLACE FUNCTION sync_auth_user_to_public(
  user_id UUID,
  user_role TEXT DEFAULT 'USER',
  user_school_id UUID DEFAULT NULL,
  user_first_name TEXT DEFAULT NULL,
  user_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  -- Insert or update user in public.users
  INSERT INTO public.users (
    id,
    role,
    school_id,
    first_name,
    last_name
  ) VALUES (
    user_id,
    user_role,
    user_school_id,
    user_first_name,
    user_last_name
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    school_id = EXCLUDED.school_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW();
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on public.users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;