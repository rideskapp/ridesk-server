-- ============================================================================
-- Fix instructor_rates table to reference users table instead of instructors table
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE instructor_rates DROP CONSTRAINT IF EXISTS instructor_rates_instructor_id_fkey;

-- Add new foreign key constraint pointing to users table
ALTER TABLE instructor_rates 
ADD CONSTRAINT instructor_rates_instructor_id_fkey 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Instructor rates are viewable by school members" ON instructor_rates;
DROP POLICY IF EXISTS "Only school admins can manage instructor rates" ON instructor_rates;

-- Recreate RLS policies to reference users table with role filter
CREATE POLICY "Instructor rates are viewable by school members" ON instructor_rates
  FOR SELECT USING (
    instructor_id IN (
      SELECT u.id FROM users u 
      WHERE u.role = 'INSTRUCTOR'
        AND (u.school_id IN (
          SELECT s.id FROM schools s WHERE s.id = u.school_id
        ) OR instructor_id IN (
          SELECT ins.instructor_id FROM instructor_schools ins 
          WHERE ins.instructor_id = instructor_rates.instructor_id
        ))
    )
  );

CREATE POLICY "Only school admins can manage instructor rates" ON instructor_rates
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     (instructor_id IN (
       SELECT u.id FROM users u 
       WHERE u.role = 'INSTRUCTOR' 
         AND u.school_id = (auth.jwt() ->> 'school_id')::UUID
     ) OR instructor_id IN (
       SELECT ins.instructor_id FROM instructor_schools ins
       WHERE ins.instructor_id = instructor_rates.instructor_id
         AND ins.school_id = (auth.jwt() ->> 'school_id')::UUID
     ))
    )
  );

