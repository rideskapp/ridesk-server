-- ============================================================================
-- Migration: 11_create_lesson_statuses_table.sql
-- Description: Create lesson_statuses table for tracking lesson states
-- Created: 2024-12-19
-- ============================================================================

-- Create lesson_statuses table
CREATE TABLE IF NOT EXISTS lesson_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280', -- Hex color code
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for lesson_statuses table
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_name ON lesson_statuses(name);
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_is_active ON lesson_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_sort_order ON lesson_statuses(sort_order);

-- Create triggers for updated_at
CREATE TRIGGER update_lesson_statuses_updated_at 
  BEFORE UPDATE ON lesson_statuses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on lesson_statuses table
ALTER TABLE lesson_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lesson_statuses table
CREATE POLICY "Lesson statuses are viewable by everyone" ON lesson_statuses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can manage lesson statuses" ON lesson_statuses
  FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- Insert default lesson statuses
INSERT INTO lesson_statuses (name, display_name, description, color, sort_order) VALUES
('scheduled', 'Scheduled', 'Lesson is scheduled and confirmed', '#3B82F6', 1),
('confirmed', 'Confirmed', 'Lesson is confirmed by instructor and student', '#10B981', 2),
('in_progress', 'In Progress', 'Lesson is currently taking place', '#F59E0B', 3),
('completed', 'Completed', 'Lesson has been completed successfully', '#059669', 4),
('cancelled', 'Cancelled', 'Lesson has been cancelled', '#DC2626', 5),
('no_show', 'No Show', 'Student did not show up for the lesson', '#7C2D12', 6),
('rescheduled', 'Rescheduled', 'Lesson has been rescheduled to another time', '#7C3AED', 7),
('pending', 'Pending', 'Lesson is pending confirmation', '#6B7280', 8),
('waiting_list', 'Waiting List', 'Lesson is on waiting list', '#F97316', 9),
('expired', 'Expired', 'Lesson time has passed without completion', '#374151', 10)
ON CONFLICT (name) DO NOTHING;

-- Create function to get active lesson statuses
CREATE OR REPLACE FUNCTION get_active_lesson_statuses()
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id,
    ls.name,
    ls.display_name,
    ls.description,
    ls.color,
    ls.is_active,
    ls.sort_order,
    ls.created_at,
    ls.updated_at
  FROM lesson_statuses ls
  WHERE ls.is_active = true
  ORDER BY ls.sort_order, ls.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lesson status by name
CREATE OR REPLACE FUNCTION get_lesson_status_by_name(p_name VARCHAR(50))
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id,
    ls.name,
    ls.display_name,
    ls.description,
    ls.color,
    ls.is_active,
    ls.sort_order,
    ls.created_at,
    ls.updated_at
  FROM lesson_statuses ls
  WHERE ls.name = p_name AND ls.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update lesson status
CREATE OR REPLACE FUNCTION update_lesson_status(
  p_lesson_id UUID,
  p_status_name VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  status_id UUID;
BEGIN
  -- Get status ID
  SELECT id INTO status_id
  FROM lesson_statuses
  WHERE name = p_status_name AND is_active = true;
  
  IF status_id IS NULL THEN
    RAISE EXCEPTION 'Lesson status not found: %', p_status_name;
  END IF;
  
  -- Update lesson status
  UPDATE lessons 
  SET lesson_status_id = status_id, updated_at = NOW()
  WHERE id = p_lesson_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lesson status statistics
CREATE OR REPLACE FUNCTION get_lesson_status_statistics(
  p_school_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  status_name VARCHAR(50),
  status_display_name VARCHAR(100),
  status_color VARCHAR(7),
  lesson_count BIGINT,
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  total_lessons BIGINT := 0;
BEGIN
  -- Get total lessons count
  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  WHERE l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date);
  
  -- Return statistics
  RETURN QUERY
  SELECT 
    ls.name,
    ls.display_name,
    ls.color,
    COUNT(l.id) as lesson_count,
    CASE 
      WHEN total_lessons > 0 THEN ROUND((COUNT(l.id)::DECIMAL / total_lessons * 100), 2)
      ELSE 0
    END as percentage
  FROM lesson_statuses ls
  LEFT JOIN lessons l ON l.lesson_status_id = ls.id
    AND l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
  WHERE ls.is_active = true
  GROUP BY ls.id, ls.name, ls.display_name, ls.color, ls.sort_order
  ORDER BY ls.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
