-- ============================================================================
-- Migration: 15_create_lessons_table.sql
-- Description: Add advanced lesson management features and functions
-- Created: 2024-12-19
-- ============================================================================

-- Add additional columns to lessons table if they don't exist
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lesson_status_id UUID REFERENCES lesson_statuses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_status_id UUID REFERENCES payment_statuses(id) ON DELETE SET NULL;

-- Create additional indexes for lessons table
CREATE INDEX IF NOT EXISTS idx_lessons_product_id ON lessons(product_id);
CREATE INDEX IF NOT EXISTS idx_lessons_lesson_status_id ON lessons(lesson_status_id);
CREATE INDEX IF NOT EXISTS idx_lessons_payment_status_id ON lessons(payment_status_id);
CREATE INDEX IF NOT EXISTS idx_lessons_time ON lessons(time);
CREATE INDEX IF NOT EXISTS idx_lessons_level ON lessons(level);
CREATE INDEX IF NOT EXISTS idx_lessons_source ON lessons(source);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lessons_school_date ON lessons(school_id, date);
CREATE INDEX IF NOT EXISTS idx_lessons_instructor_date ON lessons(instructor_id, date);
CREATE INDEX IF NOT EXISTS idx_lessons_discipline_date ON lessons(discipline, date);

-- Create function to get lessons by date range
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
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
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
    i.first_name as instructor_first_name,
    i.last_name as instructor_last_name,
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
  JOIN instructors i ON i.id = l.instructor_id
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
  GROUP BY l.id, i.first_name, i.last_name, p.name, ls.name, ls.color, ps.name, ps.color
  ORDER BY l.date, l.time
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lessons by instructor
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
  LEFT JOIN products p ON p.id = l.product_id
  LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
  LEFT JOIN payment_statuses ps ON ps.id = l.payment_status_id
  LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
  WHERE l.instructor_id = p_instructor_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
    AND (p_discipline IS NULL OR l.discipline = p_discipline)
  GROUP BY l.id, l.school_id, l.instructor_id, l.product_id, p.name, l.discipline, l.date, l.time, l.duration, l.level, l.lesson_status_id, ls.name, ls.color, l.payment_status_id, ps.name, ps.color, l.notes, l.price, l.source, l.created_at, l.updated_at
  ORDER BY l.date DESC, l.time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get lesson statistics
CREATE OR REPLACE FUNCTION get_lesson_statistics(
  p_school_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_lessons BIGINT,
  total_hours DECIMAL(10,2),
  total_revenue DECIMAL(12,2),
  average_lesson_duration DECIMAL(10,2),
  average_lesson_price DECIMAL(10,2),
  lessons_by_discipline JSONB,
  lessons_by_level JSONB,
  lessons_by_status JSONB
) AS $$
DECLARE
  total_lessons_count BIGINT := 0;
  total_hours_count DECIMAL(10,2) := 0;
  total_revenue_count DECIMAL(12,2) := 0;
  avg_duration DECIMAL(10,2) := 0;
  avg_price DECIMAL(10,2) := 0;
  discipline_stats JSONB := '{}';
  level_stats JSONB := '{}';
  status_stats JSONB := '{}';
BEGIN
  -- Get basic statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(duration), 0),
    COALESCE(SUM(price), 0),
    COALESCE(AVG(duration), 0),
    COALESCE(AVG(price), 0)
  INTO total_lessons_count, total_hours_count, total_revenue_count, avg_duration, avg_price
  FROM lessons l
  WHERE l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date);
  
  -- Get discipline statistics
  SELECT jsonb_object_agg(discipline, discipline_count) INTO discipline_stats
  FROM (
    SELECT 
      l.discipline,
      COUNT(*) as discipline_count
    FROM lessons l
    WHERE l.school_id = p_school_id
      AND (p_start_date IS NULL OR l.date >= p_start_date)
      AND (p_end_date IS NULL OR l.date <= p_end_date)
    GROUP BY l.discipline
  ) discipline_data;
  
  -- Get level statistics
  SELECT jsonb_object_agg(level, level_count) INTO level_stats
  FROM (
    SELECT 
      l.level,
      COUNT(*) as level_count
    FROM lessons l
    WHERE l.school_id = p_school_id
      AND (p_start_date IS NULL OR l.date >= p_start_date)
      AND (p_end_date IS NULL OR l.date <= p_end_date)
    GROUP BY l.level
  ) level_data;
  
  -- Get status statistics
  SELECT jsonb_object_agg(COALESCE(ls.name, 'no_status'), status_count) INTO status_stats
  FROM (
    SELECT 
      ls.name,
      COUNT(*) as status_count
    FROM lessons l
    LEFT JOIN lesson_statuses ls ON ls.id = l.lesson_status_id
    WHERE l.school_id = p_school_id
      AND (p_start_date IS NULL OR l.date >= p_start_date)
      AND (p_end_date IS NULL OR l.date <= p_end_date)
    GROUP BY ls.name
  ) status_data;
  
  RETURN QUERY
  SELECT 
    total_lessons_count,
    total_hours_count,
    total_revenue_count,
    avg_duration,
    avg_price,
    discipline_stats,
    level_stats,
    status_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
