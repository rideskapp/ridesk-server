-- ============================================================================
-- Migration: 17_disable_users_rls_temporarily.sql
-- Description: Temporarily disable RLS on users table for testing
-- Created: 2024-12-19
-- ============================================================================

-- Temporarily disable RLS on users table to allow registration
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Note: This is for testing purposes only
-- In production, we should re-enable RLS with proper policies
