-- ============================================================================
-- Migration: 58_update_products_table_schema.sql
-- Description: Update products table schema 
-- ============================================================================

-- Add missing columns (idempotent - safe to run multiple times)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS slug VARCHAR UNIQUE,
ADD COLUMN IF NOT EXISTS category VARCHAR CHECK (category IN ('private', 'couple', 'group', 'special', 'extra')),
ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS variants JSONB,
ADD COLUMN IF NOT EXISTS price_per_hour DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS duration_hours DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS equipment_flag_discount BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS order_position INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_type VARCHAR DEFAULT 'per_person';

-- Rename columns (idempotent - only renames if old column exists and new doesn't)
DO $$ 
BEGIN
    -- Rename name to title if name column exists and title doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='name')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title') THEN
        ALTER TABLE products RENAME COLUMN name TO title;
    END IF;
    
    -- Rename description to description_short if description column exists and description_short doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description_short') THEN
        ALTER TABLE products RENAME COLUMN description TO description_short;
    END IF;
    
    -- Rename is_active to active if is_active column exists and active doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='active') THEN
        ALTER TABLE products RENAME COLUMN is_active TO active;
    END IF;
    
    -- Rename is_featured to featured if is_featured column exists and featured doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_featured')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='featured') THEN
        ALTER TABLE products RENAME COLUMN is_featured TO featured;
    END IF;
END $$;

-- Populate slug from title if slug is NULL (safe to run multiple times)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title') THEN
        UPDATE products 
        SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) 
        WHERE slug IS NULL AND title IS NOT NULL;
    END IF;
END $$;

-- Make slug NOT NULL (safe to run multiple times)
DO $$
BEGIN
    -- Only set NOT NULL if there are no NULL slugs
    IF NOT EXISTS (SELECT 1 FROM products WHERE slug IS NULL) THEN
        -- Check if column is already NOT NULL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='products' 
            AND column_name='slug' 
            AND is_nullable='YES'
        ) THEN
            ALTER TABLE products ALTER COLUMN slug SET NOT NULL;
        END IF;
    END IF;
END $$;

-- Make category NOT NULL if it doesn't have a value constraint yet
DO $$
BEGIN
    UPDATE products SET category = 'private' WHERE category IS NULL;
    
    -- Set NOT NULL if column exists and is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='products' 
        AND column_name='category' 
        AND is_nullable='YES'
    ) THEN
        ALTER TABLE products ALTER COLUMN category SET NOT NULL;
    END IF;
END $$;

-- Create indexes for better performance (idempotent - safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_discipline_id ON public.products(discipline_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured);
CREATE INDEX IF NOT EXISTS idx_products_order_position ON public.products(order_position);
