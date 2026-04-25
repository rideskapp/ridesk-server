-- ============================================================================
-- inserts default student levels, product categories, and disciplines for all existing schools
-- ============================================================================

-- Insert default student levels for each school
DO $$
DECLARE
    school_record RECORD;
BEGIN
    FOR school_record IN SELECT id FROM schools LOOP
        -- Insert student levels
        INSERT INTO student_levels (name, slug, description, color, order_position, is_active, school_id) VALUES
        ('beginner', 'beginner', 'Complete beginner with no experience', '#DC2626', 1, true, school_record.id),
        ('novice', 'novice', 'Basic skills, can stand up and ride', '#F59E0B', 2, true, school_record.id),
        ('intermediate', 'intermediate', 'Can ride upwind and perform basic maneuvers', '#3B82F6', 3, true, school_record.id),
        ('advanced', 'advanced', 'Can perform advanced maneuvers and ride in various conditions', '#10B981', 4, true, school_record.id),
        ('expert', 'expert', 'Professional level skills, can teach others', '#7C3AED', 5, true, school_record.id),
        ('instructor', 'instructor', 'Certified instructor level', '#059669', 6, true, school_record.id)
        ON CONFLICT (name, school_id) WHERE school_id IS NOT NULL DO NOTHING;
    END LOOP;
END $$;

-- Insert default product categories for each school
DO $$
DECLARE
    school_record RECORD;
BEGIN
    FOR school_record IN SELECT id FROM schools LOOP
        -- Insert product categories
        INSERT INTO product_categories (name, slug, description, color, icon, is_active, sort_order, school_id) VALUES
        ('Kitesurfing Lessons', 'kitesurfing-lessons', 'Individual and group kitesurfing lessons', '#3B82F6', 'kite', true, 1, school_record.id),
        ('Surfing Lessons', 'surfing-lessons', 'Individual and group surfing lessons', '#10B981', 'surf', true, 2, school_record.id),
        ('Wing Foiling Lessons', 'wing-foiling-lessons', 'Individual and group wing foiling lessons', '#F59E0B', 'wing', true, 3, school_record.id),
        ('Equipment Rental', 'equipment-rental', 'Kitesurfing, surfing, and wing foiling equipment rental', '#8B5CF6', 'equipment', true, 4, school_record.id),
        ('Private Lessons', 'private-lessons', 'One-on-one private instruction', '#EF4444', 'private', true, 5, school_record.id),
        ('Group Lessons', 'group-lessons', 'Group instruction sessions', '#06B6D4', 'group', true, 6, school_record.id),
        ('Beginner Courses', 'beginner-courses', 'Complete beginner courses and packages', '#84CC16', 'beginner', true, 7, school_record.id),
        ('Advanced Courses', 'advanced-courses', 'Advanced technique and skill development courses', '#F97316', 'advanced', true, 8, school_record.id),
        ('Safety Courses', 'safety-courses', 'Water safety and rescue training', '#DC2626', 'safety', true, 9, school_record.id),
        ('Equipment Sales', 'equipment-sales', 'New and used equipment sales', '#7C3AED', 'sales', true, 10, school_record.id)
        ON CONFLICT (slug, school_id) WHERE school_id IS NOT NULL DO NOTHING;
    END LOOP;
END $$;

-- Insert default disciplines for each school
DO $$
DECLARE
    school_record RECORD;
BEGIN
    FOR school_record IN SELECT id FROM schools LOOP
        -- Insert disciplines
        INSERT INTO disciplines (name, slug, display_name, description, icon, color, is_active, sort_order, school_id) VALUES
        ('kite', 'kite', 'Kitesurfing', 'Kitesurfing lessons and equipment', 'kite', '#3B82F6', true, 1, school_record.id),
        ('surf', 'surf', 'Surfing', 'Surfing lessons and equipment', 'surf', '#10B981', true, 2, school_record.id),
        ('wing', 'wing', 'Wing Foiling', 'Wing foiling lessons and equipment', 'wing', '#F59E0B', true, 3, school_record.id)
        ON CONFLICT (name, school_id) WHERE school_id IS NOT NULL DO NOTHING;
    END LOOP;
END $$;

