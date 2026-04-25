-- Ultra simple test function without any joins
CREATE OR REPLACE FUNCTION test_ultra_simple_lessons(p_instructor_id UUID)
RETURNS TABLE (
  id UUID,
  instructor_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.instructor_id
  FROM lessons l
  WHERE l.instructor_id = p_instructor_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
