-- ============================================================================
-- Make products slug unique per school instead of globally
-- ============================================================================

-- Drop the global unique constraint on products.slug

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_slug_key' 
        AND conrelid = 'products'::regclass
    ) THEN
        ALTER TABLE products DROP CONSTRAINT products_slug_key;
        RAISE NOTICE 'Dropped global unique constraint: products_slug_key';
    ELSE
        RAISE NOTICE 'Constraint products_slug_key does not exist, skipping';
    END IF;
END $$;

-- This allows the same slug to exist in different schools, but ensures
-- uniqueness within each school (e.g., School A can have "prod1" and 
-- School B can also have "prod1", but School A cannot have two "prod1" products)
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_school_unique 
ON products(slug, school_id) WHERE school_id IS NOT NULL;

