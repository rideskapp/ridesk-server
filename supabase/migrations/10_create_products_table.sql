-- ============================================================================
-- Migration: 10_create_products_table.sql
-- Description: Create products table for managing school products and services
-- Created: 2024-12-19
-- ============================================================================

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  duration INTEGER, -- Duration in minutes
  max_participants INTEGER DEFAULT 1,
  discipline TEXT CHECK (discipline IN ('kite', 'surf', 'wing')),
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  requires_instructor BOOLEAN NOT NULL DEFAULT true,
  requires_equipment BOOLEAN NOT NULL DEFAULT false,
  equipment_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_school_id ON products(school_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_discipline ON products(discipline);
CREATE INDEX IF NOT EXISTS idx_products_level ON products(level);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Create composite index for school products
CREATE INDEX IF NOT EXISTS idx_products_school_active 
ON products(school_id, is_active, created_at DESC);

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products table
CREATE POLICY "Products are viewable by school members" ON products
  FOR SELECT USING (
    school_id IN (
      SELECT s.id FROM schools s WHERE s.id = products.school_id
    )
  );

CREATE POLICY "Only school admins can manage products" ON products
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID
    )
  );

-- Create function to get products by school
CREATE OR REPLACE FUNCTION get_products_by_school(
  p_school_id UUID,
  p_category_id UUID DEFAULT NULL,
  p_discipline TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  category_id UUID,
  category_name VARCHAR(100),
  category_slug VARCHAR(50),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  currency VARCHAR(3),
  duration INTEGER,
  max_participants INTEGER,
  discipline TEXT,
  level TEXT,
  is_active BOOLEAN,
  is_featured BOOLEAN,
  requires_instructor BOOLEAN,
  requires_equipment BOOLEAN,
  equipment_included BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.school_id,
    p.category_id,
    pc.name as category_name,
    pc.slug as category_slug,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.duration,
    p.max_participants,
    p.discipline,
    p.level,
    p.is_active,
    p.is_featured,
    p.requires_instructor,
    p.requires_equipment,
    p.equipment_included,
    p.created_at,
    p.updated_at
  FROM products p
  JOIN product_categories pc ON pc.id = p.category_id
  WHERE p.school_id = p_school_id
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_discipline IS NULL OR p.discipline = p_discipline)
    AND (p_level IS NULL OR p.level = p_level)
    AND (p_is_active IS NULL OR p.is_active = p_is_active)
  ORDER BY p.is_featured DESC, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get featured products
CREATE OR REPLACE FUNCTION get_featured_products(
  p_school_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  category_id UUID,
  category_name VARCHAR(100),
  category_slug VARCHAR(50),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  currency VARCHAR(3),
  duration INTEGER,
  max_participants INTEGER,
  discipline TEXT,
  level TEXT,
  is_active BOOLEAN,
  is_featured BOOLEAN,
  requires_instructor BOOLEAN,
  requires_equipment BOOLEAN,
  equipment_included BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.school_id,
    p.category_id,
    pc.name as category_name,
    pc.slug as category_slug,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.duration,
    p.max_participants,
    p.discipline,
    p.level,
    p.is_active,
    p.is_featured,
    p.requires_instructor,
    p.requires_equipment,
    p.equipment_included,
    p.created_at,
    p.updated_at
  FROM products p
  JOIN product_categories pc ON pc.id = p.category_id
  WHERE p.school_id = p_school_id
    AND p.is_active = true
    AND p.is_featured = true
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to search products
CREATE OR REPLACE FUNCTION search_products(
  p_school_id UUID,
  p_search_query TEXT,
  p_category_id UUID DEFAULT NULL,
  p_discipline TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_min_price DECIMAL(10,2) DEFAULT NULL,
  p_max_price DECIMAL(10,2) DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  category_id UUID,
  category_name VARCHAR(100),
  category_slug VARCHAR(50),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  currency VARCHAR(3),
  duration INTEGER,
  max_participants INTEGER,
  discipline TEXT,
  level TEXT,
  is_active BOOLEAN,
  is_featured BOOLEAN,
  requires_instructor BOOLEAN,
  requires_equipment BOOLEAN,
  equipment_included BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.school_id,
    p.category_id,
    pc.name as category_name,
    pc.slug as category_slug,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.duration,
    p.max_participants,
    p.discipline,
    p.level,
    p.is_active,
    p.is_featured,
    p.requires_instructor,
    p.requires_equipment,
    p.equipment_included,
    p.created_at,
    p.updated_at
  FROM products p
  JOIN product_categories pc ON pc.id = p.category_id
  WHERE p.school_id = p_school_id
    AND p.is_active = true
    AND (p.name ILIKE '%' || p_search_query || '%' OR p.description ILIKE '%' || p_search_query || '%')
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_discipline IS NULL OR p.discipline = p_discipline)
    AND (p_level IS NULL OR p.level = p_level)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
  ORDER BY p.is_featured DESC, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
