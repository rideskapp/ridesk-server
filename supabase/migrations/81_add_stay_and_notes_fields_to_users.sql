-- ============================================================================
-- Migration: 80_add_stay_and_notes_fields_to_users.sql
-- Description: Add arrival_date, departure_date, stay_notes, and notes fields to users table for student stay information
-- Created: 2024-12-28
-- ============================================================================

-- Add stay-related fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS arrival_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stay_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.arrival_date IS 'Student arrival date for stay period';
COMMENT ON COLUMN users.departure_date IS 'Student departure date for stay period';
COMMENT ON COLUMN users.stay_notes IS 'Additional notes about the student stay (regular customer, preferences, etc.)';
COMMENT ON COLUMN users.notes IS 'General notes about the student';
