-- ============================================================================
-- Make configuration tables (student_levels, product_categories, disciplines) school specific
-- ============================================================================

-- Step 1: Add school_id column to student_levels table
DO $$ 
BEGIN
    -- Check if school_id column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='student_levels' AND column_name='school_id'
    ) THEN
        -- Add school_id column as nullable first
        ALTER TABLE student_levels 
        ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        
        -- Create index for school_id
        CREATE INDEX IF NOT EXISTS idx_student_levels_school_id ON student_levels(school_id);
        
        -- Create composite index for school-based queries
        CREATE INDEX IF NOT EXISTS idx_student_levels_school_active 
        ON student_levels(school_id, is_active);
    END IF;
END $$;

-- Step 2: Add school_id column to product_categories table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product_categories' AND column_name='school_id'
    ) THEN
        -- Add school_id column as nullable first
        ALTER TABLE product_categories 
        ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        
        -- Create index for school_id
        CREATE INDEX IF NOT EXISTS idx_product_categories_school_id ON product_categories(school_id);
        
        -- Create composite index for school-based queries
        CREATE INDEX IF NOT EXISTS idx_product_categories_school_active 
        ON product_categories(school_id, is_active);
    END IF;
END $$;

-- Step 3: Add school_id column to disciplines table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='disciplines' AND column_name='school_id'
    ) THEN
        -- Add school_id column as nullable first
        ALTER TABLE disciplines 
        ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        
        -- Create index for school_id
        CREATE INDEX IF NOT EXISTS idx_disciplines_school_id ON disciplines(school_id);
        
        -- Create composite index for school-based queries
        CREATE INDEX IF NOT EXISTS idx_disciplines_school_active 
        ON disciplines(school_id, is_active);
    END IF;
END $$;

-- Step 4: Migrate existing data to all schools
-- Duplicate all default configuration records for each school
DO $$
DECLARE
    school_record RECORD;
    old_record RECORD;
    new_id UUID;
BEGIN
    -- For student_levels
    FOR school_record IN SELECT id FROM schools LOOP
        FOR old_record IN SELECT * FROM student_levels WHERE school_id IS NULL LOOP
            INSERT INTO student_levels (
                name, slug, description, color, order_position, is_active, 
                created_at, updated_at, school_id
            )
            VALUES (
                old_record.name, 
                old_record.slug, 
                old_record.description, 
                old_record.color, 
                old_record.order_position, 
                old_record.is_active,
                old_record.created_at,
                old_record.updated_at,
                school_record.id
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
    
    -- For product_categories
    FOR school_record IN SELECT id FROM schools LOOP
        FOR old_record IN SELECT * FROM product_categories WHERE school_id IS NULL LOOP
            INSERT INTO product_categories (
                name, slug, description, color, icon, is_active, sort_order,
                created_at, updated_at, school_id
            )
            VALUES (
                old_record.name,
                old_record.slug,
                old_record.description,
                old_record.color,
                old_record.icon,
                old_record.is_active,
                old_record.sort_order,
                old_record.created_at,
                old_record.updated_at,
                school_record.id
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
    
    -- For disciplines
    FOR school_record IN SELECT id FROM schools LOOP
        FOR old_record IN SELECT * FROM disciplines WHERE school_id IS NULL LOOP
            INSERT INTO disciplines (
                name, slug, display_name, description, icon, color, is_active, sort_order,
                created_at, updated_at, school_id
            )
            VALUES (
                old_record.name,
                old_record.slug,
                old_record.display_name,
                old_record.description,
                old_record.icon,
                old_record.color,
                old_record.is_active,
                old_record.sort_order,
                old_record.created_at,
                old_record.updated_at,
                school_record.id
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Step 5: Drop UNIQUE constraints that conflict with school_id
-- student_levels: name and slug need to be unique per school
DO $$
BEGIN
    -- Drop unique constraint on name if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_levels_name_key' 
        AND conrelid = 'student_levels'::regclass
    ) THEN
        ALTER TABLE student_levels DROP CONSTRAINT student_levels_name_key;
    END IF;
    
    -- Drop unique constraint on slug if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_levels_slug_key' 
        AND conrelid = 'student_levels'::regclass
    ) THEN
        ALTER TABLE student_levels DROP CONSTRAINT student_levels_slug_key;
    END IF;
    
    -- Add composite unique constraints for name and slug per school
    CREATE UNIQUE INDEX IF NOT EXISTS student_levels_name_school_unique 
    ON student_levels(name, school_id) WHERE school_id IS NOT NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS student_levels_slug_school_unique 
    ON student_levels(slug, school_id) WHERE school_id IS NOT NULL;
END $$;

-- product_categories: slug needs to be unique per school
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'product_categories_slug_key' 
        AND conrelid = 'product_categories'::regclass
    ) THEN
        ALTER TABLE product_categories DROP CONSTRAINT product_categories_slug_key;
    END IF;
    
    CREATE UNIQUE INDEX IF NOT EXISTS product_categories_slug_school_unique 
    ON product_categories(slug, school_id) WHERE school_id IS NOT NULL;
END $$;

-- disciplines: name and slug need to be unique per school
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'disciplines_name_key' 
        AND conrelid = 'disciplines'::regclass
    ) THEN
        ALTER TABLE disciplines DROP CONSTRAINT disciplines_name_key;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'disciplines_slug_key' 
        AND conrelid = 'disciplines'::regclass
    ) THEN
        ALTER TABLE disciplines DROP CONSTRAINT disciplines_slug_key;
    END IF;
    
    CREATE UNIQUE INDEX IF NOT EXISTS disciplines_name_school_unique 
    ON disciplines(name, school_id) WHERE school_id IS NOT NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS disciplines_slug_school_unique 
    ON disciplines(slug, school_id) WHERE school_id IS NOT NULL;
END $$;

-- Step 6: Drop old records without school_id (the template records)
DELETE FROM student_levels WHERE school_id IS NULL;
DELETE FROM product_categories WHERE school_id IS NULL;
DELETE FROM disciplines WHERE school_id IS NULL;

-- Step 7: Make school_id NOT NULL now that all records have it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='student_levels' 
        AND column_name='school_id' 
        AND is_nullable='YES'
    ) THEN
        ALTER TABLE student_levels ALTER COLUMN school_id SET NOT NULL;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product_categories' 
        AND column_name='school_id' 
        AND is_nullable='YES'
    ) THEN
        ALTER TABLE product_categories ALTER COLUMN school_id SET NOT NULL;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='disciplines' 
        AND column_name='school_id' 
        AND is_nullable='YES'
    ) THEN
        ALTER TABLE disciplines ALTER COLUMN school_id SET NOT NULL;
    END IF;
END $$;

-- Step 8: Update RLS policies to filter by school_id
-- Drop existing policies first
DROP POLICY IF EXISTS "Student levels are viewable by everyone" ON student_levels;
DROP POLICY IF EXISTS "Only SUPER_ADMIN can manage student levels" ON student_levels;

-- New policies for student_levels
CREATE POLICY "Student levels are viewable by school members" ON student_levels
  FOR SELECT USING (
    school_id IN (
      SELECT s.id FROM schools s WHERE s.id = student_levels.school_id
    )
  );

CREATE POLICY "School admins can manage their school's student levels" ON student_levels
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID
    )
  );

-- Drop existing policies for product_categories
DROP POLICY IF EXISTS "Product categories are viewable by everyone" ON product_categories;
DROP POLICY IF EXISTS "Only SUPER_ADMIN can manage product categories" ON product_categories;

-- New policies for product_categories
CREATE POLICY "Product categories are viewable by school members" ON product_categories
  FOR SELECT USING (
    school_id IN (
      SELECT s.id FROM schools s WHERE s.id = product_categories.school_id
    )
  );

CREATE POLICY "School admins can manage their school's product categories" ON product_categories
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID
    )
  );

-- Drop existing policies for disciplines
DROP POLICY IF EXISTS "Disciplines are viewable by everyone" ON disciplines;
DROP POLICY IF EXISTS "Only SUPER_ADMIN can manage disciplines" ON disciplines;

-- New policies for disciplines
CREATE POLICY "Disciplines are viewable by school members" ON disciplines
  FOR SELECT USING (
    school_id IN (
      SELECT s.id FROM schools s WHERE s.id = disciplines.school_id
    )
  );

CREATE POLICY "School admins can manage their school's disciplines" ON disciplines
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID
    )
  );

-- Step 9: Update helper functions to work with school_id
DROP FUNCTION IF EXISTS get_active_student_levels();
CREATE OR REPLACE FUNCTION get_active_student_levels(p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  description TEXT,
  color VARCHAR(7),
  order_position INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.name,
    sl.slug,
    sl.description,
    sl.color,
    sl.order_position,
    sl.is_active,
    sl.created_at,
    sl.updated_at,
    sl.school_id
  FROM student_levels sl
  WHERE sl.is_active = true AND sl.school_id = p_school_id
  ORDER BY sl.order_position, sl.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_student_level_by_slug(VARCHAR(50));
CREATE OR REPLACE FUNCTION get_student_level_by_slug(p_slug VARCHAR(50), p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  description TEXT,
  color VARCHAR(7),
  order_position INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.name,
    sl.slug,
    sl.description,
    sl.color,
    sl.order_position,
    sl.is_active,
    sl.created_at,
    sl.updated_at,
    sl.school_id
  FROM student_levels sl
  WHERE sl.slug = p_slug AND sl.is_active = true AND sl.school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- product_categories functions
DROP FUNCTION IF EXISTS get_active_product_categories();
CREATE OR REPLACE FUNCTION get_active_product_categories(p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  slug VARCHAR(50),
  description TEXT,
  color VARCHAR(7),
  icon VARCHAR(50),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.name,
    pc.slug,
    pc.description,
    pc.color,
    pc.icon,
    pc.is_active,
    pc.sort_order,
    pc.created_at,
    pc.updated_at,
    pc.school_id
  FROM product_categories pc
  WHERE pc.is_active = true AND pc.school_id = p_school_id
  ORDER BY pc.sort_order, pc.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- disciplines functions
DROP FUNCTION IF EXISTS get_active_disciplines();
CREATE OR REPLACE FUNCTION get_active_disciplines(p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.slug,
    d.display_name,
    d.description,
    d.icon,
    d.color,
    d.is_active,
    d.sort_order,
    d.created_at,
    d.updated_at,
    d.school_id
  FROM disciplines d
  WHERE d.is_active = true AND d.school_id = p_school_id
  ORDER BY d.sort_order, d.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_discipline_by_slug(VARCHAR(50));
CREATE OR REPLACE FUNCTION get_discipline_by_slug(p_slug VARCHAR(50), p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.slug,
    d.display_name,
    d.description,
    d.icon,
    d.color,
    d.is_active,
    d.sort_order,
    d.created_at,
    d.updated_at,
    d.school_id
  FROM disciplines d
  WHERE d.slug = p_slug AND d.is_active = true AND d.school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN student_levels.school_id IS 'References the school this student level belongs to';
COMMENT ON COLUMN product_categories.school_id IS 'References the school this product category belongs to';
COMMENT ON COLUMN disciplines.school_id IS 'References the school this discipline belongs to';

