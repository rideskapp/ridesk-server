-- ============================================================================
-- Migration: 13_create_student_levels_table.sql
-- Description: Create student_levels table for categorizing student skill levels
-- Created: 2024-12-19
-- ============================================================================

-- Create student_levels table
CREATE TABLE IF NOT EXISTS student_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280', -- Hex color code
  order_position INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for student_levels table
CREATE INDEX IF NOT EXISTS idx_student_levels_name ON student_levels(name);
CREATE INDEX IF NOT EXISTS idx_student_levels_slug ON student_levels(slug);
CREATE INDEX IF NOT EXISTS idx_student_levels_order_position ON student_levels(order_position);
CREATE INDEX IF NOT EXISTS idx_student_levels_is_active ON student_levels(is_active);

-- Create triggers for updated_at
CREATE TRIGGER update_student_levels_updated_at 
  BEFORE UPDATE ON student_levels 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on student_levels table
ALTER TABLE student_levels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for student_levels table
CREATE POLICY "Student levels are viewable by everyone" ON student_levels
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can manage student levels" ON student_levels
  FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- Insert default student levels
INSERT INTO student_levels (name, slug, description, color, order_position) VALUES
('beginner', 'beginner', 'Complete beginner with no experience', '#DC2626', 1),
('novice', 'novice', 'Basic skills, can stand up and ride', '#F59E0B', 2),
('intermediate', 'intermediate', 'Can ride upwind and perform basic maneuvers', '#3B82F6', 3),
('advanced', 'advanced', 'Can perform advanced maneuvers and ride in various conditions', '#10B981', 4),
('expert', 'expert', 'Professional level skills, can teach others', '#7C3AED', 5),
('instructor', 'instructor', 'Certified instructor level', '#059669', 6)
ON CONFLICT (slug) DO NOTHING;

-- Create function to get active student levels
CREATE OR REPLACE FUNCTION get_active_student_levels()
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  description TEXT,
  color VARCHAR(7),
  order_position INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.name,
    sl.slug,
    sl.description,
    sl.color,
    sl.order_position,
    sl.is_active,
    sl.created_at,
    sl.updated_at
  FROM student_levels sl
  WHERE sl.is_active = true
  ORDER BY sl.order_position, sl.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get student level by slug
CREATE OR REPLACE FUNCTION get_student_level_by_slug(p_slug VARCHAR(50))
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  description TEXT,
  color VARCHAR(7),
  order_position INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.name,
    sl.slug,
    sl.description,
    sl.color,
    sl.order_position,
    sl.is_active,
    sl.created_at,
    sl.updated_at
  FROM student_levels sl
  WHERE sl.slug = p_slug AND sl.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get student level statistics
CREATE OR REPLACE FUNCTION get_student_level_statistics(
  p_school_id UUID
)
RETURNS TABLE (
  level_name VARCHAR(50),
  level_slug VARCHAR(50),
  level_color VARCHAR(7),
  student_count BIGINT,
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  total_students BIGINT := 0;
BEGIN
  -- Get total students count
  SELECT COUNT(*) INTO total_students
  FROM students s
  WHERE s.school_id = p_school_id;
  
  -- Return statistics
  RETURN QUERY
  SELECT 
    sl.name,
    sl.slug,
    sl.color,
    COUNT(s.id) as student_count,
    CASE 
      WHEN total_students > 0 THEN ROUND((COUNT(s.id)::DECIMAL / total_students * 100), 2)
      ELSE 0
    END as percentage
  FROM student_levels sl
  LEFT JOIN students s ON s.student_level_id = sl.id
    AND s.school_id = p_school_id
  WHERE sl.is_active = true
  GROUP BY sl.id, sl.name, sl.slug, sl.color, sl.order_position
  ORDER BY sl.order_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update student level
CREATE OR REPLACE FUNCTION update_student_level(
  p_student_id UUID,
  p_level_slug VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  level_id UUID;
BEGIN
  -- Get level ID
  SELECT id INTO level_id
  FROM student_levels
  WHERE slug = p_level_slug AND is_active = true;
  
  IF level_id IS NULL THEN
    RAISE EXCEPTION 'Student level not found: %', p_level_slug;
  END IF;
  
  -- Update student level
  UPDATE students 
  SET student_level_id = level_id, updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get students by level
CREATE OR REPLACE FUNCTION get_students_by_level(
  p_school_id UUID,
  p_level_slug VARCHAR(50),
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  avatar TEXT,
  student_level_id UUID,
  level_name VARCHAR(50),
  level_slug VARCHAR(50),
  level_color VARCHAR(7),
  preferred_language VARCHAR(50),
  secondary_language VARCHAR(50),
  special_needs TEXT[],
  special_needs_other TEXT,
  notes TEXT,
  arrival_date DATE,
  departure_date DATE,
  stay_notes TEXT,
  height INTEGER,
  weight INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.school_id,
    s.first_name,
    s.last_name,
    s.email,
    s.phone_number,
    s.avatar,
    s.student_level_id,
    sl.name as level_name,
    sl.slug as level_slug,
    sl.color as level_color,
    s.preferred_language,
    s.secondary_language,
    s.special_needs,
    s.special_needs_other,
    s.notes,
    s.arrival_date,
    s.departure_date,
    s.stay_notes,
    s.height,
    s.weight,
    s.created_at,
    s.updated_at
  FROM students s
  JOIN student_levels sl ON sl.id = s.student_level_id
  WHERE s.school_id = p_school_id
    AND sl.slug = p_level_slug
  ORDER BY s.first_name, s.last_name
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
