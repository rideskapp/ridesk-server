-- ============================================================================
-- Migration: 91_support_multi_school_students.sql
-- Description: Add student_schools junction table for multi-school students
--              and backfill current students from users.school_id
-- ============================================================================

-- Create student_schools junction table
CREATE TABLE IF NOT EXISTS student_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, school_id)
);

-- Useful indexes for school and student lookups
CREATE INDEX IF NOT EXISTS idx_student_schools_student_id
  ON student_schools(student_id);
CREATE INDEX IF NOT EXISTS idx_student_schools_school_id
  ON student_schools(school_id);
CREATE INDEX IF NOT EXISTS idx_student_schools_active
  ON student_schools(is_active)
  WHERE is_active = true;

-- Keep updated_at current
CREATE OR REPLACE FUNCTION update_student_schools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_schools_updated_at ON student_schools;
CREATE TRIGGER trigger_update_student_schools_updated_at
  BEFORE UPDATE ON student_schools
  FOR EACH ROW
  EXECUTE FUNCTION update_student_schools_updated_at();

-- Enable RLS (backend uses service role; these policies keep table safe for future direct reads)
ALTER TABLE student_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to student_schools" ON student_schools;
CREATE POLICY "Service role full access to student_schools" ON student_schools
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Students can view their school assignments" ON student_schools;
CREATE POLICY "Students can view their school assignments" ON student_schools
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "School admins can manage their school students" ON student_schools;
CREATE POLICY "School admins can manage their school students" ON student_schools
  FOR ALL TO authenticated USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'SCHOOL_ADMIN'
    )
  ) WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'SCHOOL_ADMIN'
    )
  );

GRANT ALL ON student_schools TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_schools TO authenticated;

-- Backfill: migrate existing student -> school assignments from users.school_id
-- Keep users.school_id unchanged (primary/backward compatibility).
INSERT INTO student_schools (
  student_id,
  school_id,
  is_primary,
  is_active,
  created_at,
  updated_at
)
SELECT
  u.id AS student_id,
  u.school_id,
  true AS is_primary,
  true AS is_active,
  u.created_at,
  u.updated_at
FROM users u
WHERE u.role = 'USER'
  AND u.school_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM student_schools ss
    WHERE ss.student_id = u.id
      AND ss.school_id = u.school_id
  );

COMMENT ON TABLE student_schools IS 'Junction table for many-to-many relationship between students and schools';
COMMENT ON COLUMN users.school_id IS 'Primary school metadata for users. Student school authorization should use student_schools.';
