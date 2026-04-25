-- Recreate instructor_schools table that was accidentally dropped
-- This table manages the many-to-many relationship between instructors and schools
DROP TRIGGER IF EXISTS trigger_update_instructor_schools_updated_at ON instructor_schools;
DROP POLICY IF EXISTS "Service role full access to instructor_schools" ON instructor_schools;
DROP POLICY IF EXISTS "Instructors can view their school assignments" ON instructor_schools;
DROP POLICY IF EXISTS "School admins can manage their school instructors" ON instructor_schools;

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

-- Ensure trigger can be re-run safely
CREATE TRIGGER trigger_update_instructor_schools_updated_at
  BEFORE UPDATE ON instructor_schools
  FOR EACH ROW
  EXECUTE FUNCTION update_instructor_schools_updated_at();

-- Enable RLS on instructor_schools
ALTER TABLE instructor_schools ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructor_schools
CREATE POLICY "Service role full access to instructor_schools" ON instructor_schools
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Instructors can view their school assignments" ON instructor_schools
  FOR SELECT TO authenticated USING (instructor_id = auth.uid());

CREATE POLICY "School admins can manage their school instructors" ON instructor_schools
  FOR ALL TO authenticated USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'SCHOOL_ADMIN'
    )
  ) WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'SCHOOL_ADMIN'
    )
  );

-- Grant permissions
GRANT ALL ON instructor_schools TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON instructor_schools TO authenticated;

-- Add comments
COMMENT ON TABLE instructor_schools IS 'Junction table for many-to-many relationship between instructors and schools';
COMMENT ON COLUMN instructor_schools.instructor_id IS 'Reference to users table where role = INSTRUCTOR';
COMMENT ON COLUMN instructor_schools.school_id IS 'Reference to schools table';
COMMENT ON COLUMN instructor_schools.is_primary IS 'Whether this is the primary school for the instructor';
COMMENT ON COLUMN instructor_schools.hourly_rate IS 'School-specific hourly rate for the instructor';
COMMENT ON COLUMN instructor_schools.commission_rate IS 'School-specific commission rate (percentage)';
COMMENT ON COLUMN instructor_schools.is_active IS 'Whether this instructor-school relationship is active';


