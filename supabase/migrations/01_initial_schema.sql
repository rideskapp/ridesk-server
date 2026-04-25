-- ============================================================================
-- Migration: 01_initial_schema.sql
-- Description: Create base tables (schools, students, instructors, lessons, school_settings)
-- Created: 2024-12-19
-- ============================================================================

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  logo TEXT,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  spot_name VARCHAR(100),
  windguru_url TEXT,
  disciplines TEXT[] NOT NULL DEFAULT '{}',
  open_hours_start TIME,
  open_hours_end TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  avatar TEXT,
  level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced')) NOT NULL,
  notes TEXT,
  whatsapp VARCHAR(50),
  preferred_language VARCHAR(50),
  secondary_language VARCHAR(50),
  special_needs TEXT[],
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create instructors table
CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  avatar TEXT,
  specialties TEXT[] NOT NULL,
  languages TEXT[] NOT NULL,
  available BOOLEAN DEFAULT true,
  notes TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE,
  discipline VARCHAR(20) CHECK (discipline IN ('kite', 'surf', 'wing')) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL,
  level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced')) NOT NULL,
  payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid', 'partial')) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('confirmed', 'pending', 'cancelled')) NOT NULL,
  notes TEXT,
  price DECIMAL(10, 2),
  source VARCHAR(20) CHECK (source IN ('manual', 'web')) DEFAULT 'manual',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create school_settings table
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  spot_name VARCHAR(255),
  windguru_url TEXT,
  disciplines TEXT[] NOT NULL,
  open_hours_start TIME,
  open_hours_end TIME,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create student_notes table
CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author_id UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  edit_history JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_created_at ON schools(created_at);

CREATE INDEX IF NOT EXISTS idx_school_settings_school_id ON school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_instructors_school_id ON instructors(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_school_id ON student_notes(school_id);

CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date);
CREATE INDEX IF NOT EXISTS idx_lessons_student_id ON lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_instructor_id ON lessons(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_student_notes_student_id ON student_notes(student_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_schools_updated_at 
  BEFORE UPDATE ON schools 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at 
  BEFORE UPDATE ON students 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instructors_updated_at 
  BEFORE UPDATE ON instructors 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at 
  BEFORE UPDATE ON lessons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_school_settings_updated_at 
  BEFORE UPDATE ON school_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_notes_updated_at 
  BEFORE UPDATE ON student_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for schools table
CREATE POLICY "Schools are viewable by everyone" ON schools
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can insert schools" ON schools
  FOR INSERT WITH CHECK (auth.role() = 'SUPER_ADMIN');

CREATE POLICY "Only SUPER_ADMIN can update schools" ON schools
  FOR UPDATE USING (auth.role() = 'SUPER_ADMIN');

CREATE POLICY "Only SUPER_ADMIN can delete schools" ON schools
  FOR DELETE USING (auth.role() = 'SUPER_ADMIN');

-- Create RLS policies for school_settings table
CREATE POLICY "School settings are viewable by school members" ON school_settings
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = school_settings.school_id
    )
  );

CREATE POLICY "Only school admins can manage school settings" ON school_settings
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Create RLS policies for instructors table
CREATE POLICY "Instructors are viewable by school members" ON instructors
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = instructors.school_id
    )
  );

CREATE POLICY "Only school admins can manage instructors" ON instructors
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Create RLS policies for students table
CREATE POLICY "Students are viewable by school members" ON students
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = students.school_id
    )
  );

CREATE POLICY "Only school admins can manage students" ON students
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Create RLS policies for lessons table
CREATE POLICY "Lessons are viewable by school members" ON lessons
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = lessons.school_id
    )
  );

CREATE POLICY "Only school admins can manage lessons" ON lessons
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Create RLS policies for student_notes table
CREATE POLICY "Student notes are viewable by school members" ON student_notes
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = student_notes.school_id
    )
  );

CREATE POLICY "Only school admins can manage student notes" ON student_notes
  FOR ALL USING (
    auth.role() = 'SUPER_ADMIN' OR 
    (auth.role() = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );
