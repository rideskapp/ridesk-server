-- ============================================================================
-- Migration: 77_remove_description_from_disciplines_and_categories.sql
-- Description: Remove description column from disciplines and product_categories tables
-- ============================================================================

-- Step 1: Drop description column from disciplines table
ALTER TABLE disciplines DROP COLUMN IF EXISTS description;

-- Step 2: Drop description column from product_categories table
ALTER TABLE product_categories DROP COLUMN IF EXISTS description;

-- Step 3: Update get_active_disciplines function to not return description
DROP FUNCTION IF EXISTS get_active_disciplines(UUID);
CREATE OR REPLACE FUNCTION get_active_disciplines(p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
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

-- Step 4: Update get_discipline_by_slug function to not return description
DROP FUNCTION IF EXISTS get_discipline_by_slug(VARCHAR(50), UUID);
CREATE OR REPLACE FUNCTION get_discipline_by_slug(p_slug VARCHAR(50), p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  slug VARCHAR(50),
  display_name VARCHAR(100),
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

-- Step 5: Update get_active_product_categories function to not return description
DROP FUNCTION IF EXISTS get_active_product_categories(UUID);
CREATE OR REPLACE FUNCTION get_active_product_categories(p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  slug VARCHAR(50),
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

-- Step 6: Update get_product_category_by_slug function to not return description (if exists)
DROP FUNCTION IF EXISTS get_product_category_by_slug(VARCHAR(50), UUID);
CREATE OR REPLACE FUNCTION get_product_category_by_slug(p_slug VARCHAR(50), p_school_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  slug VARCHAR(50),
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
    pc.color,
    pc.icon,
    pc.is_active,
    pc.sort_order,
    pc.created_at,
    pc.updated_at,
    pc.school_id
  FROM product_categories pc
  WHERE pc.slug = p_slug AND pc.is_active = true AND pc.school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

