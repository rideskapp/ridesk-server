-- ============================================================================
-- Migration: 24_support_multi_school_instructors.sql
-- Description: Support instructors working at multiple schools
-- Created: 2024-12-19
-- ============================================================================

-- Create instructor_schools junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS instructor_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- One school can be marked as primary
  hourly_rate DECIMAL(10,2), -- School-specific hourly rate
  commission_rate DECIMAL(5,2), -- School-specific commission rate (percentage)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique instructor-school combinations
  UNIQUE(instructor_id, school_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_instructor_schools_instructor_id ON instructor_schools(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_schools_school_id ON instructor_schools(school_id);
CREATE INDEX IF NOT EXISTS idx_instructor_schools_active ON instructor_schools(is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_instructor_schools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_instructor_schools_updated_at
  BEFORE UPDATE ON instructor_schools
  FOR EACH ROW
  EXECUTE FUNCTION update_instructor_schools_updated_at();

-- Enable RLS on instructor_schools
ALTER TABLE instructor_schools ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructor_schools
CREATE POLICY "Service role full access to instructor_schools" ON instructor_schools
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Instructors can view their school assignments" ON instructor_schools
  FOR SELECT USING (auth.uid() = instructor_id);

CREATE POLICY "School admins can manage their school instructors" ON instructor_schools
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Function to add instructor to school
CREATE OR REPLACE FUNCTION add_instructor_to_school(
  p_instructor_id UUID,
  p_school_id UUID,
  p_is_primary BOOLEAN DEFAULT false,
  p_hourly_rate DECIMAL(10,2) DEFAULT NULL,
  p_commission_rate DECIMAL(5,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_assignment_id UUID;
BEGIN
  -- Validate instructor exists and has INSTRUCTOR role
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_instructor_id AND role = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'User is not an instructor';
  END IF;
  
  -- Validate school exists
  IF NOT EXISTS (
    SELECT 1 FROM public.schools 
    WHERE id = p_school_id
  ) THEN
    RAISE EXCEPTION 'School does not exist';
  END IF;
  
  -- If setting as primary, unset other primary assignments for this instructor
  IF p_is_primary THEN
    UPDATE instructor_schools 
    SET is_primary = false 
    WHERE instructor_id = p_instructor_id;
  END IF;
  
  -- Insert new assignment
  INSERT INTO instructor_schools (
    instructor_id,
    school_id,
    is_primary,
    hourly_rate,
    commission_rate
  ) VALUES (
    p_instructor_id,
    p_school_id,
    p_is_primary,
    p_hourly_rate,
    p_commission_rate
  ) RETURNING id INTO new_assignment_id;
  
  RETURN new_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove instructor from school
CREATE OR REPLACE FUNCTION remove_instructor_from_school(
  p_instructor_id UUID,
  p_school_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM instructor_schools 
  WHERE instructor_id = p_instructor_id AND school_id = p_school_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get instructor's schools
CREATE OR REPLACE FUNCTION get_instructor_schools(p_instructor_id UUID)
RETURNS TABLE (
  assignment_id UUID,
  school_id UUID,
  school_name VARCHAR(255),
  school_slug VARCHAR(100),
  is_primary BOOLEAN,
  hourly_rate DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ins.id as assignment_id,
    s.id as school_id,
    s.name as school_name,
    s.slug as school_slug,
    ins.is_primary,
    ins.hourly_rate,
    ins.commission_rate,
    ins.is_active
  FROM instructor_schools ins
  JOIN public.schools s ON ins.school_id = s.id
  WHERE ins.instructor_id = p_instructor_id
  ORDER BY ins.is_primary DESC, s.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get school's instructors
CREATE OR REPLACE FUNCTION get_school_instructors(p_school_id UUID)
RETURNS TABLE (
  assignment_id UUID,
  instructor_id UUID,
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
  instructor_email TEXT,
  is_primary BOOLEAN,
  hourly_rate DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ins.id as assignment_id,
    u.id as instructor_id,
    u.first_name as instructor_first_name,
    u.last_name as instructor_last_name,
    au.email as instructor_email,
    ins.is_primary,
    ins.hourly_rate,
    ins.commission_rate,
    ins.is_active
  FROM instructor_schools ins
  JOIN public.users u ON ins.instructor_id = u.id
  JOIN auth.users au ON u.id = au.id
  WHERE ins.school_id = p_school_id
  ORDER BY ins.is_primary DESC, u.first_name ASC, u.last_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_instructor_to_school(UUID, UUID, BOOLEAN, DECIMAL, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION remove_instructor_from_school(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_instructor_schools(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_school_instructors(UUID) TO service_role;

-- Add comments
COMMENT ON TABLE instructor_schools IS 'Junction table for many-to-many relationship between instructors and schools';
COMMENT ON FUNCTION add_instructor_to_school IS 'Adds an instructor to a school with optional rates and primary status';
COMMENT ON FUNCTION remove_instructor_from_school IS 'Removes an instructor from a school';
COMMENT ON FUNCTION get_instructor_schools IS 'Gets all schools where an instructor works';
COMMENT ON FUNCTION get_school_instructors IS 'Gets all instructors working at a school';
