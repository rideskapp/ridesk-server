-- Test simple function to debug the structure issue
CREATE OR REPLACE FUNCTION test_simple_instructor_lessons(p_instructor_id UUID)
RETURNS TABLE (
  id UUID,
  instructor_id UUID,
  instructor_first_name TEXT,
  instructor_last_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.instructor_id,
    u.first_name as instructor_first_name,
    u.last_name as instructor_last_name
  FROM lessons l
  JOIN users u ON u.id = l.instructor_id
  WHERE l.instructor_id = p_instructor_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
