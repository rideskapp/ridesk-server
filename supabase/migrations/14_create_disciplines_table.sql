-- ============================================================================
-- Migration: 14_create_disciplines_table.sql
-- Description: Create disciplines table for managing water sports disciplines
-- Created: 2024-12-19
-- ============================================================================

-- Create disciplines table
CREATE TABLE IF NOT EXISTS disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Icon name or class
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for disciplines table
CREATE INDEX IF NOT EXISTS idx_disciplines_name ON disciplines(name);
CREATE INDEX IF NOT EXISTS idx_disciplines_slug ON disciplines(slug);
CREATE INDEX IF NOT EXISTS idx_disciplines_is_active ON disciplines(is_active);
CREATE INDEX IF NOT EXISTS idx_disciplines_sort_order ON disciplines(sort_order);

-- Create triggers for updated_at
CREATE TRIGGER update_disciplines_updated_at 
  BEFORE UPDATE ON disciplines 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on disciplines table
ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for disciplines table
CREATE POLICY "Disciplines are viewable by everyone" ON disciplines
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can manage disciplines" ON disciplines
  FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- Insert default disciplines
INSERT INTO disciplines (name, slug, display_name, description, icon, color, sort_order) VALUES
('kite', 'kite', 'Kitesurfing', 'Kitesurfing lessons and equipment', 'kite', '#3B82F6', 1),
('surf', 'surf', 'Surfing', 'Surfing lessons and equipment', 'surf', '#10B981', 2),
('wing', 'wing', 'Wing Foiling', 'Wing foiling lessons and equipment', 'wing', '#F59E0B', 3)
ON CONFLICT (slug) DO NOTHING;

-- Create function to get active disciplines
CREATE OR REPLACE FUNCTION get_active_disciplines()
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.slug,
    d.display_name,
    d.description,
    d.icon,
    d.color,
    d.is_active,
    d.sort_order,
    d.created_at,
    d.updated_at
  FROM disciplines d
  WHERE d.is_active = true
  ORDER BY d.sort_order, d.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get discipline by slug
CREATE OR REPLACE FUNCTION get_discipline_by_slug(p_slug VARCHAR(50))
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.slug,
    d.display_name,
    d.description,
    d.icon,
    d.color,
    d.is_active,
    d.sort_order,
    d.created_at,
    d.updated_at
  FROM disciplines d
  WHERE d.slug = p_slug AND d.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get discipline statistics
CREATE OR REPLACE FUNCTION get_discipline_statistics(
  p_school_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  discipline_name VARCHAR(50),
  discipline_slug VARCHAR(50),
  discipline_display_name VARCHAR(100),
  discipline_color VARCHAR(7),
  lesson_count BIGINT,
  total_hours DECIMAL(10,2),
  total_revenue DECIMAL(12,2),
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
    d.name,
    d.slug,
    d.display_name,
    d.color,
    COUNT(l.id) as lesson_count,
    COALESCE(SUM(l.duration), 0) as total_hours,
    COALESCE(SUM(l.price), 0) as total_revenue,
    CASE 
      WHEN total_lessons > 0 THEN ROUND((COUNT(l.id)::DECIMAL / total_lessons * 100), 2)
      ELSE 0
    END as percentage
  FROM disciplines d
  LEFT JOIN lessons l ON l.discipline = d.name
    AND l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
  WHERE d.is_active = true
  GROUP BY d.id, d.name, d.slug, d.display_name, d.color, d.sort_order
  ORDER BY d.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get instructors by discipline
CREATE OR REPLACE FUNCTION get_instructors_by_discipline(
  p_school_id UUID,
  p_discipline_slug VARCHAR(50),
  p_is_available BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  avatar TEXT,
  specialties TEXT[],
  languages TEXT[],
  available BOOLEAN,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.school_id,
    i.first_name,
    i.last_name,
    i.email,
    i.phone_number,
    i.avatar,
    i.specialties,
    i.languages,
    i.available,
    i.notes,
    i.created_at,
    i.updated_at
  FROM instructors i
  WHERE i.school_id = p_school_id
    AND p_discipline_slug = ANY(i.specialties)
    AND (p_is_available IS NULL OR i.available = p_is_available)
  ORDER BY i.first_name, i.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lessons by discipline
CREATE OR REPLACE FUNCTION get_lessons_by_discipline(
  p_school_id UUID,
  p_discipline_slug VARCHAR(50),
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  instructor_id UUID,
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
  product_id UUID,
  discipline TEXT,
  date DATE,
  "time" TIME,
  duration INTEGER,
  level TEXT,
  lesson_status_id UUID,
  lesson_status_name VARCHAR(50),
  payment_status_id UUID,
  payment_status_name VARCHAR(50),
  notes TEXT,
  price DECIMAL(10,2),
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.instructor_id,
    i.first_name as instructor_first_name,
    i.last_name as instructor_last_name,
    l.product_id,
    l.discipline,
    l.date,
    l.time as "time",
    l.duration,
    l.level,
    l.lesson_status_id,
    ls.name as lesson_status_name,
    l.payment_status_id,
    ps.name as payment_status_name,
    l.notes,
    l.price,
    l.source,
    l.created_at,
    l.updated_at
  FROM lessons l
  JOIN instructors i ON i.id = l.instructor_id
  LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
  LEFT JOIN payment_statuses ps ON ps.id = l.payment_status_id
  WHERE l.school_id = p_school_id
    AND l.discipline = p_discipline_slug
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
  ORDER BY l.date DESC, l.time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
