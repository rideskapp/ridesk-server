-- ============================================================================
-- Migration: 23_create_super_admin.sql
-- Description: Create initial SUPER_ADMIN user for system administration
-- Created: 2024-12-19
-- ============================================================================

-- Note: This migration only sets up the data structure
-- The actual SUPER_ADMIN user will be created via the API endpoint
-- /api/auth/init-super-admin

-- This migration is intentionally empty as we'll create the SUPER_ADMIN
-- through the application service to ensure proper auth.users creation

-- This migration is now empty as SUPER_ADMIN creation is handled by the application
