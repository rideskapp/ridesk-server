-- ============================================================================
-- Migration: 80_add_instructor_profile_fields.sql
-- Description: Add missing profile fields (phone_number, specialties, certifications) to users table
-- ============================================================================

-- SQL to add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS specialties TEXT[],
ADD COLUMN IF NOT EXISTS certifications TEXT[];
