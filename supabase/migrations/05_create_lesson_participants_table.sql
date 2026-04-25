-- ============================================================================
-- Migration: 05_create_lesson_participants_table.sql
-- Description: Create lesson_participants table for many-to-many relationship
-- Created: 2024-12-19
-- ============================================================================

-- Create lesson_participants table
CREATE TABLE IF NOT EXISTS lesson_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lesson_id, student_id)
);

-- Create indexes for lesson_participants table
CREATE INDEX IF NOT EXISTS idx_lesson_participants_lesson_id ON lesson_participants(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_participants_student_id ON lesson_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_participants_created_at ON lesson_participants(created_at);

-- Create triggers for updated_at
CREATE TRIGGER update_lesson_participants_updated_at 
  BEFORE UPDATE ON lesson_participants 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on lesson_participants table
ALTER TABLE lesson_participants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lesson_participants table
CREATE POLICY "Lesson participants are viewable by school members" ON lesson_participants
  FOR SELECT USING (
    lesson_id IN (
      SELECT l.id FROM lessons l 
      WHERE l.school_id IN (
        SELECT s.id FROM schools s WHERE s.id = l.school_id
      )
    )
  );

CREATE POLICY "Only school admins can manage lesson participants" ON lesson_participants
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     lesson_id IN (
       SELECT l.id FROM lessons l 
       WHERE l.school_id = (auth.jwt() ->> 'school_id')::UUID
     )
    )
  );

-- Create function to add participant to lesson
CREATE OR REPLACE FUNCTION add_lesson_participant(
  p_lesson_id UUID,
  p_student_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_participant_id UUID;
BEGIN
  -- Check if lesson and student exist and belong to same school
  IF NOT EXISTS (
    SELECT 1 FROM lessons l
    JOIN students s ON s.school_id = l.school_id
    WHERE l.id = p_lesson_id AND s.id = p_student_id
  ) THEN
    RAISE EXCEPTION 'Lesson and student must belong to the same school';
  END IF;
  
  -- Insert participant
  INSERT INTO lesson_participants (lesson_id, student_id)
  VALUES (p_lesson_id, p_student_id)
  ON CONFLICT (lesson_id, student_id) DO NOTHING
  RETURNING id INTO new_participant_id;
  
  RETURN new_participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove participant from lesson
CREATE OR REPLACE FUNCTION remove_lesson_participant(
  p_lesson_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM lesson_participants 
  WHERE lesson_id = p_lesson_id AND student_id = p_student_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lesson participants
CREATE OR REPLACE FUNCTION get_lesson_participants(p_lesson_id UUID)
RETURNS TABLE (
  id UUID,
  lesson_id UUID,
  student_id UUID,
  student_first_name VARCHAR(50),
  student_last_name VARCHAR(50),
  student_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.id,
    lp.lesson_id,
    lp.student_id,
    s.first_name,
    s.last_name,
    s.email,
    lp.created_at
  FROM lesson_participants lp
  JOIN students s ON s.id = lp.student_id
  WHERE lp.lesson_id = p_lesson_id
  ORDER BY s.first_name, s.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get student lessons
CREATE OR REPLACE FUNCTION get_student_lessons(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  lesson_id UUID,
  student_id UUID,
  instructor_id UUID,
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
  discipline TEXT,
  date DATE,
  "time" TIME,
  duration INTEGER,
  level TEXT,
  lesson_status TEXT,
  payment_status TEXT,
  notes TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.id,
    lp.lesson_id,
    lp.student_id,
    l.instructor_id,
    i.first_name,
    i.last_name,
    l.discipline,
    l.date,
    l.time as "time",
    l.duration,
    l.level,
    ls.name as lesson_status,
    ps.name as payment_status,
    l.notes,
    l.price,
    lp.created_at
  FROM lesson_participants lp
  JOIN lessons l ON l.id = lp.lesson_id
  JOIN instructors i ON i.id = l.instructor_id
  LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
  LEFT JOIN payment_statuses ps ON ps.id = l.payment_status_id
  WHERE lp.student_id = p_student_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
  ORDER BY l.date DESC, l.time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
