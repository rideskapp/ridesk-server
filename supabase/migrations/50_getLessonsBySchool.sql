-- Fix get_lessons_by_date_range function to match actual DB column types
DROP FUNCTION IF EXISTS get_lessons_by_date_range(UUID, DATE, DATE, UUID, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_lessons_by_date_range(
  p_school_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_instructor_id UUID DEFAULT NULL,
  p_discipline VARCHAR DEFAULT NULL,
  p_level VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  instructor_id UUID,
  instructor_first_name VARCHAR,
  instructor_last_name VARCHAR,
  product_id UUID,
  product_name VARCHAR,
  discipline VARCHAR,
  date DATE,
  "time" TIME,
  duration INTEGER,
  level VARCHAR,
  lesson_status_id UUID,
  lesson_status_name VARCHAR,
  lesson_status_color VARCHAR,
  payment_status_id UUID,
  payment_status_name VARCHAR,
  payment_status_color VARCHAR,
  notes TEXT,
  price NUMERIC,
  source VARCHAR,
  participant_count BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.school_id,
    l.instructor_id,
    u.first_name,
    u.last_name,
    l.product_id,
    p.name,
    l.discipline,
    l.date,
    l.time,
    l.duration,
    l.level,
    l.lesson_status_id,
    ls.name,
    ls.color,
    l.payment_status_id,
    ps.name,
    ps.color,
    l.notes,
    l.price,
    l.source,
    COUNT(lp.id),
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
  GROUP BY 
    l.id, l.school_id, l.instructor_id, u.first_name, u.last_name, 
    l.product_id, p.name, l.discipline, l.date, l.time, l.duration, 
    l.level, l.lesson_status_id, ls.name, ls.color, 
    l.payment_status_id, ps.name, ps.color, 
    l.notes, l.price, l.source, l.created_at, l.updated_at
  ORDER BY l.date, l.time
  LIMIT p_limit OFFSET p_offset;
END;
$$;
