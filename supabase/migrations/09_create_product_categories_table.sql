-- ============================================================================
-- Migration: 09_create_product_categories_table.sql
-- Description: Create product_categories table for organizing products
-- Created: 2024-12-19
-- ============================================================================

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
  icon VARCHAR(50), -- Icon name or class
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for product_categories table
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active ON product_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_product_categories_sort_order ON product_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_categories_created_at ON product_categories(created_at);

-- Create triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at 
  BEFORE UPDATE ON product_categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on product_categories table
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_categories table
CREATE POLICY "Product categories are viewable by everyone" ON product_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can manage product categories" ON product_categories
  FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- Insert default product categories
INSERT INTO product_categories (name, slug, description, color, icon, sort_order) VALUES
('Kitesurfing Lessons', 'kitesurfing-lessons', 'Individual and group kitesurfing lessons', '#3B82F6', 'kite', 1),
('Surfing Lessons', 'surfing-lessons', 'Individual and group surfing lessons', '#10B981', 'surf', 2),
('Wing Foiling Lessons', 'wing-foiling-lessons', 'Individual and group wing foiling lessons', '#F59E0B', 'wing', 3),
('Equipment Rental', 'equipment-rental', 'Kitesurfing, surfing, and wing foiling equipment rental', '#8B5CF6', 'equipment', 4),
('Private Lessons', 'private-lessons', 'One-on-one private instruction', '#EF4444', 'private', 5),
('Group Lessons', 'group-lessons', 'Group instruction sessions', '#06B6D4', 'group', 6),
('Beginner Courses', 'beginner-courses', 'Complete beginner courses and packages', '#84CC16', 'beginner', 7),
('Advanced Courses', 'advanced-courses', 'Advanced technique and skill development courses', '#F97316', 'advanced', 8),
('Safety Courses', 'safety-courses', 'Water safety and rescue training', '#DC2626', 'safety', 9),
('Equipment Sales', 'equipment-sales', 'New and used equipment sales', '#7C3AED', 'sales', 10)
ON CONFLICT (slug) DO NOTHING;

-- Create function to get active product categories
CREATE OR REPLACE FUNCTION get_active_product_categories()
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
  updated_at TIMESTAMP WITH TIME ZONE
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
    pc.updated_at
  FROM product_categories pc
  WHERE pc.is_active = true
  ORDER BY pc.sort_order, pc.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get product category by slug
CREATE OR REPLACE FUNCTION get_product_category_by_slug(p_slug VARCHAR(50))
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
  updated_at TIMESTAMP WITH TIME ZONE
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
    pc.updated_at
  FROM product_categories pc
  WHERE pc.slug = p_slug AND pc.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update category sort order
CREATE OR REPLACE FUNCTION update_category_sort_order(
  p_category_id UUID,
  p_new_sort_order INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE product_categories 
  SET sort_order = p_new_sort_order, updated_at = NOW()
  WHERE id = p_category_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reorder categories
CREATE OR REPLACE FUNCTION reorder_categories(
  p_category_orders JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  category_order JSONB;
BEGIN
  -- Update sort order for each category
  FOR category_order IN SELECT * FROM jsonb_array_elements(p_category_orders)
  LOOP
    UPDATE product_categories 
    SET sort_order = (category_order->>'sort_order')::INTEGER,
        updated_at = NOW()
    WHERE id = (category_order->>'id')::UUID;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
