-- ============================================================================
-- Migration: 38_fix_lesson_functions_and_foreign_keys.sql
-- Description: Fix all foreign keys to point to users table and create proper lesson functions
-- Created: 2024-12-19
-- ============================================================================

-- Drop existing foreign key constraints that point to instructors table
ALTER TABLE "public"."instructor_availability" DROP CONSTRAINT IF EXISTS "instructor_availability_instructor_id_fkey";
ALTER TABLE "public"."instructor_rates" DROP CONSTRAINT IF EXISTS "instructor_rates_instructor_id_fkey";
ALTER TABLE "public"."lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_fkey";
ALTER TABLE "public"."student_notes" DROP CONSTRAINT IF EXISTS "student_notes_instructor_id_fkey";

-- Add new foreign key constraints pointing to users table
ALTER TABLE "public"."instructor_availability" 
ADD CONSTRAINT "instructor_availability_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "public"."instructor_rates" 
ADD CONSTRAINT "instructor_rates_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "public"."lessons" 
ADD CONSTRAINT "lessons_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "public"."student_notes" 
ADD CONSTRAINT "student_notes_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Drop the instructors table since we're using users table
DROP TABLE IF EXISTS "public"."instructors" CASCADE;

-- Drop existing lesson functions
DROP FUNCTION IF EXISTS get_lessons_by_date_range(UUID, DATE, DATE, UUID, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_instructor_lessons(UUID, DATE, DATE, TEXT, INTEGER, INTEGER);

-- Create get_lessons_by_date_range function using users table
CREATE OR REPLACE FUNCTION get_lessons_by_date_range(
  p_school_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_instructor_id UUID DEFAULT NULL,
  p_discipline TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  instructor_id UUID,
  instructor_first_name TEXT,
  instructor_last_name TEXT,
  product_id UUID,
  product_name VARCHAR(255),
  discipline TEXT,
  date DATE,
  "time" TIME,
  duration INTEGER,
  level TEXT,
  lesson_status_id UUID,
  lesson_status_name VARCHAR(50),
  lesson_status_color VARCHAR(7),
  payment_status_id UUID,
  payment_status_name VARCHAR(50),
  payment_status_color VARCHAR(7),
  notes TEXT,
  price DECIMAL(10,2),
  source TEXT,
  participant_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.instructor_id,
    u.first_name as instructor_first_name,
    u.last_name as instructor_last_name,
    l.product_id,
    p.name as product_name,
    l.discipline,
    l.date,
    l.time as "time",
    l.duration,
    l.level,
    l.lesson_status_id,
    ls.name as lesson_status_name,
    ls.color as lesson_status_color,
    l.payment_status_id,
    ps.name as payment_status_name,
    ps.color as payment_status_color,
    l.notes,
    l.price,
    l.source,
    COUNT(lp.id) as participant_count,
    l.created_at,
    l.updated_at
  FROM lessons l
  JOIN users u ON u.id = l.instructor_id
  LEFT JOIN products p ON p.id = l.product_id
  LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
  LEFT JOIN payment_statuses ps ON ps.id = l.payment_status_id
  LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
  WHERE l.school_id = p_school_id
    AND l.date >= p_start_date
    AND l.date <= p_end_date
    AND (p_instructor_id IS NULL OR l.instructor_id = p_instructor_id)
    AND (p_discipline IS NULL OR l.discipline = p_discipline)
    AND (p_level IS NULL OR l.level = p_level)
  GROUP BY l.id, l.school_id, l.instructor_id, u.first_name, u.last_name, l.product_id, p.name, l.discipline, l.date, l.time, l.duration, l.level, l.lesson_status_id, ls.name, ls.color, l.payment_status_id, ps.name, ps.color, l.notes, l.price, l.source, l.created_at, l.updated_at
  ORDER BY l.date, l.time
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_instructor_lessons function using users table
CREATE OR REPLACE FUNCTION get_instructor_lessons(
  p_instructor_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_discipline TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  instructor_id UUID,
  instructor_first_name TEXT,
  instructor_last_name TEXT,
  product_id UUID,
  product_name VARCHAR(255),
  discipline TEXT,
  date DATE,
  "time" TIME,
  duration INTEGER,
  level TEXT,
  lesson_status_id UUID,
  lesson_status_name VARCHAR(50),
  lesson_status_color VARCHAR(7),
  payment_status_id UUID,
  payment_status_name VARCHAR(50),
  payment_status_color VARCHAR(7),
  notes TEXT,
  price DECIMAL(10,2),
  source TEXT,
  participant_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.instructor_id,
    u.first_name as instructor_first_name,
    u.last_name as instructor_last_name,
    l.product_id,
    p.name as product_name,
    l.discipline,
    l.date,
    l.time as "time",
    l.duration,
    l.level,
    l.lesson_status_id,
    ls.name as lesson_status_name,
    ls.color as lesson_status_color,
    l.payment_status_id,
    ps.name as payment_status_name,
    ps.color as payment_status_color,
    l.notes,
    l.price,
    l.source,
    COUNT(lp.id) as participant_count,
    l.created_at,
    l.updated_at
  FROM lessons l
  JOIN users u ON u.id = l.instructor_id
  LEFT JOIN products p ON p.id = l.product_id
  LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
  LEFT JOIN payment_statuses ps ON ps.id = l.payment_status_id
  LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
  WHERE l.instructor_id = p_instructor_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
    AND (p_discipline IS NULL OR l.discipline = p_discipline)
  GROUP BY l.id, l.school_id, l.instructor_id, u.first_name, u.last_name, l.product_id, p.name, l.discipline, l.date, l.time, l.duration, l.level, l.lesson_status_id, ls.name, ls.color, l.payment_status_id, ps.name, ps.color, l.notes, l.price, l.source, l.created_at, l.updated_at
  ORDER BY l.date DESC, l.time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
