DROP FUNCTION IF EXISTS get_instructor_lessons(UUID, DATE, DATE, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_instructor_lessons(
  p_instructor_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_discipline VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
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
  price DECIMAL(10,2),
  source VARCHAR,
  participant_count BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
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
  WHERE l.instructor_id = p_instructor_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
    AND (p_discipline IS NULL OR l.discipline = p_discipline)
  GROUP BY 
    l.id, l.school_id, l.instructor_id, u.first_name, u.last_name, 
    l.product_id, p.name, l.discipline, l.date, l.time, l.duration, 
    l.level, l.lesson_status_id, ls.name, ls.color, 
    l.payment_status_id, ps.name, ps.color, 
    l.notes, l.price, l.source, l.created_at, l.updated_at
  ORDER BY l.date DESC, l.time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

