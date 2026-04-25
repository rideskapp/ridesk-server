-- ============================================================================
-- Migration: 07_create_student_notes_table.sql
-- Description: Add additional columns to existing student_notes table
-- Created: 2024-12-19
-- ============================================================================

-- Add additional columns to existing student_notes table
ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL;

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS note_type TEXT CHECK (note_type IN ('progress', 'behavior', 'medical', 'equipment', 'general', 'achievement'));

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS title VARCHAR(255);

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE student_notes 
ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT false;

-- Update existing records to have default values for new columns
UPDATE student_notes 
SET 
  note_type = 'general',
  title = 'Note',
  content = text,
  is_private = false,
  is_important = false
WHERE note_type IS NULL;

-- Make required columns NOT NULL after setting default values
ALTER TABLE student_notes 
ALTER COLUMN note_type SET NOT NULL;

ALTER TABLE student_notes 
ALTER COLUMN title SET NOT NULL;

ALTER TABLE student_notes 
ALTER COLUMN content SET NOT NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_student_notes_lesson_id ON student_notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_instructor_id ON student_notes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_note_type ON student_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_student_notes_is_private ON student_notes(is_private);
CREATE INDEX IF NOT EXISTS idx_student_notes_is_important ON student_notes(is_important);

-- Create composite index for student notes queries
CREATE INDEX IF NOT EXISTS idx_student_notes_student_type 
ON student_notes(student_id, note_type, created_at DESC);

-- Create function to get student notes
CREATE OR REPLACE FUNCTION get_student_notes(
  p_student_id UUID,
  p_note_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  lesson_id UUID,
  instructor_id UUID,
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
  note_type TEXT,
  title VARCHAR(255),
  content TEXT,
  is_private BOOLEAN,
  is_important BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sn.id,
    sn.student_id,
    sn.lesson_id,
    sn.instructor_id,
    i.first_name,
    i.last_name,
    sn.note_type,
    sn.title,
    sn.content,
    sn.is_private,
    sn.is_important,
    sn.created_at,
    sn.updated_at
  FROM student_notes sn
  LEFT JOIN instructors i ON i.id = sn.instructor_id
  WHERE sn.student_id = p_student_id
    AND (p_note_type IS NULL OR sn.note_type = p_note_type)
  ORDER BY sn.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get student progress summary
CREATE OR REPLACE FUNCTION get_student_progress_summary(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_lessons INTEGER,
  total_hours DECIMAL(10,2),
  progress_notes INTEGER,
  achievement_notes INTEGER,
  last_lesson_date DATE,
  current_level TEXT,
  instructor_feedback TEXT
) AS $$
DECLARE
  lesson_count INTEGER := 0;
  total_duration DECIMAL(10,2) := 0;
  progress_count INTEGER := 0;
  achievement_count INTEGER := 0;
  last_lesson DATE;
  student_level TEXT;
  feedback TEXT := '';
BEGIN
  -- Get lesson statistics
  SELECT 
    COUNT(*),
    SUM(l.duration),
    MAX(l.date)
  INTO lesson_count, total_duration, last_lesson
  FROM lessons l
  JOIN lesson_participants lp ON lp.lesson_id = l.id
  WHERE lp.student_id = p_student_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
    AND l.lesson_status_id IN (
      SELECT id FROM lesson_statuses WHERE name = 'confirmed'
    );
  
  -- Get note counts
  SELECT 
    COUNT(*) FILTER (WHERE note_type = 'progress'),
    COUNT(*) FILTER (WHERE note_type = 'achievement')
  INTO progress_count, achievement_count
  FROM student_notes sn
  WHERE sn.student_id = p_student_id
    AND (p_start_date IS NULL OR sn.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR sn.created_at::DATE <= p_end_date);
  
  -- Get current student level
  SELECT sl.name INTO student_level
  FROM students s
  JOIN student_levels sl ON sl.id = s.student_level_id
  WHERE s.id = p_student_id;
  
  -- Get latest instructor feedback
  SELECT sn.content INTO feedback
  FROM student_notes sn
  WHERE sn.student_id = p_student_id
    AND sn.note_type = 'progress'
    AND sn.instructor_id IS NOT NULL
  ORDER BY sn.created_at DESC
  LIMIT 1;
  
  RETURN QUERY
  SELECT 
    lesson_count,
    total_duration,
    progress_count,
    achievement_count,
    last_lesson,
    student_level,
    feedback;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add student note
CREATE OR REPLACE FUNCTION add_student_note(
  p_student_id UUID,
  p_note_type TEXT,
  p_title VARCHAR(255),
  p_content TEXT,
  p_lesson_id UUID DEFAULT NULL,
  p_instructor_id UUID DEFAULT NULL,
  p_is_private BOOLEAN DEFAULT false,
  p_is_important BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  new_note_id UUID;
BEGIN
  -- Validate note type
  IF p_note_type NOT IN ('progress', 'behavior', 'medical', 'equipment', 'general', 'achievement') THEN
    RAISE EXCEPTION 'Invalid note type: %', p_note_type;
  END IF;
  
  -- Insert note
  INSERT INTO student_notes (
    student_id,
    lesson_id,
    instructor_id,
    note_type,
    title,
    content,
    is_private,
    is_important
  ) VALUES (
    p_student_id,
    p_lesson_id,
    p_instructor_id,
    p_note_type,
    p_title,
    p_content,
    p_is_private,
    p_is_important
  ) RETURNING id INTO new_note_id;
  
  RETURN new_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;