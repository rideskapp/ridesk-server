-- ============================================================================
-- Migration: 08_create_instructor_availability_table.sql
-- Description: Create instructor_availability table for managing instructor schedules
-- Created: 2024-12-19
-- ============================================================================

-- Create instructor_availability table
CREATE TABLE IF NOT EXISTS instructor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_id, date, time_start, time_end)
);

-- Create indexes for instructor_availability table
CREATE INDEX IF NOT EXISTS idx_instructor_availability_instructor_id ON instructor_availability(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_date ON instructor_availability(date);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_time_start ON instructor_availability(time_start);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_time_end ON instructor_availability(time_end);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_active ON instructor_availability(active);

-- Create composite index for availability queries
CREATE INDEX IF NOT EXISTS idx_instructor_availability_instructor_date 
ON instructor_availability(instructor_id, date, time_start) 
WHERE active = true;

-- Create triggers for updated_at
CREATE TRIGGER update_instructor_availability_updated_at 
  BEFORE UPDATE ON instructor_availability 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on instructor_availability table
ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for instructor_availability table
CREATE POLICY "Instructor availability is viewable by school members" ON instructor_availability
  FOR SELECT USING (
    instructor_id IN (
      SELECT i.id FROM instructors i 
      WHERE i.school_id IN (
        SELECT s.id FROM schools s WHERE s.id = i.school_id
      )
    )
  );

CREATE POLICY "Only school admins and instructors can manage availability" ON instructor_availability
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     instructor_id IN (
       SELECT i.id FROM instructors i 
       WHERE i.school_id = (auth.jwt() ->> 'school_id')::UUID
     )
    ) OR
    (auth.jwt() ->> 'role' = 'INSTRUCTOR' AND 
     instructor_id = (auth.jwt() ->> 'user_id')::UUID
    )
  );

-- Create function to get instructor availability for date range
CREATE OR REPLACE FUNCTION get_instructor_availability(
  p_instructor_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  instructor_id UUID,
  date DATE,
  time_start TIME,
  time_end TIME,
  active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ia.id,
    ia.instructor_id,
    ia.date,
    ia.time_start,
    ia.time_end,
    ia.active,
    ia.created_at,
    ia.updated_at
  FROM instructor_availability ia
  WHERE ia.instructor_id = p_instructor_id
    AND ia.date >= p_start_date
    AND ia.date <= p_end_date
    AND ia.active = true
  ORDER BY ia.date, ia.time_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check instructor availability for specific time
CREATE OR REPLACE FUNCTION check_instructor_availability(
  p_instructor_id UUID,
  p_date DATE,
  p_time_start TIME,
  p_time_end TIME
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if instructor has availability for the specified time slot
  RETURN EXISTS (
    SELECT 1 FROM instructor_availability ia
    WHERE ia.instructor_id = p_instructor_id
      AND ia.date = p_date
      AND ia.active = true
      AND ia.time_start <= p_time_start
      AND ia.time_end >= p_time_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add instructor availability
CREATE OR REPLACE FUNCTION add_instructor_availability(
  p_instructor_id UUID,
  p_date DATE,
  p_time_start TIME,
  p_time_end TIME
)
RETURNS UUID AS $$
DECLARE
  new_availability_id UUID;
BEGIN
  -- Validate time range
  IF p_time_start >= p_time_end THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Check for overlapping availability
  IF EXISTS (
    SELECT 1 FROM instructor_availability ia
    WHERE ia.instructor_id = p_instructor_id
      AND ia.date = p_date
      AND ia.active = true
      AND (
        (ia.time_start <= p_time_start AND ia.time_end > p_time_start) OR
        (ia.time_start < p_time_end AND ia.time_end >= p_time_end) OR
        (ia.time_start >= p_time_start AND ia.time_end <= p_time_end)
      )
  ) THEN
    RAISE EXCEPTION 'Overlapping availability already exists for this time slot';
  END IF;
  
  -- Insert availability
  INSERT INTO instructor_availability (
    instructor_id,
    date,
    time_start,
    time_end
  ) VALUES (
    p_instructor_id,
    p_date,
    p_time_start,
    p_time_end
  ) RETURNING id INTO new_availability_id;
  
  RETURN new_availability_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove instructor availability
CREATE OR REPLACE FUNCTION remove_instructor_availability(
  p_availability_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE instructor_availability 
  SET active = false, updated_at = NOW()
  WHERE id = p_availability_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get available instructors for time slot
CREATE OR REPLACE FUNCTION get_available_instructors(
  p_school_id UUID,
  p_date DATE,
  p_time_start TIME,
  p_time_end TIME,
  p_discipline TEXT DEFAULT NULL
)
RETURNS TABLE (
  instructor_id UUID,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(255),
  specialties TEXT[],
  languages TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.first_name,
    i.last_name,
    i.email,
    i.specialties,
    i.languages
  FROM instructors i
  WHERE i.school_id = p_school_id
    AND i.available = true
    AND (p_discipline IS NULL OR p_discipline = ANY(i.specialties))
    AND EXISTS (
      SELECT 1 FROM instructor_availability ia
      WHERE ia.instructor_id = i.id
        AND ia.date = p_date
        AND ia.active = true
        AND ia.time_start <= p_time_start
        AND ia.time_end >= p_time_end
    )
  ORDER BY i.first_name, i.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
