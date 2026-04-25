-- ============================================================================
-- Migration: 78_remove_order_position_from_student_levels.sql
-- Description: Remove order_position column from student_levels table
-- ============================================================================

-- Drop the index on order_position
DROP INDEX IF EXISTS idx_student_levels_order_position;

-- Remove the order_position column
ALTER TABLE student_levels DROP COLUMN IF EXISTS order_position;

