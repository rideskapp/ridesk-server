-- ============================================================================
-- Migration: 25_insert_super_admin_user.sql
-- Description: Create SUPER_ADMIN user using Supabase's auth system
-- Created: 2024-12-19
-- ============================================================================

-- This migration creates a function that can be called to create the SUPER_ADMIN
-- The actual user creation must be done through the API or Supabase dashboard

-- Create a function to check if SUPER_ADMIN exists
CREATE OR REPLACE FUNCTION check_super_admin_exists()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE role = 'SUPER_ADMIN' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to create SUPER_ADMIN in public.users
-- This will be called after the auth.users entry is created
CREATE OR REPLACE FUNCTION create_super_admin_public_user()
RETURNS TEXT AS $$
DECLARE
  super_admin_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Check if SUPER_ADMIN already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE id = super_admin_id) THEN
    RETURN 'SUPER_ADMIN already exists in public.users';
  END IF;

  -- Insert into public.users
  INSERT INTO public.users (
    id,
    first_name,
    last_name,
    role,
    school_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    super_admin_id,
    'Super',
    'Admin',
    'SUPER_ADMIN',
    NULL,
    true,
    NOW(),
    NOW()
  );

  RETURN 'SUPER_ADMIN created in public.users';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_super_admin_exists() TO service_role;
GRANT EXECUTE ON FUNCTION create_super_admin_public_user() TO service_role;

-- Add instructions
COMMENT ON FUNCTION create_super_admin_public_user() IS 'Call this after creating SUPER_ADMIN in auth.users. Email: superadmin@ridesk.com, Password: SuperAdmin123!';
