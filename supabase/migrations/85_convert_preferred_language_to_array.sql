-- Convert users.preferred_language from a single string to a text[] array

ALTER TABLE users
ALTER COLUMN preferred_language TYPE text[]
USING (
  CASE
    WHEN preferred_language IS NULL OR preferred_language = '' THEN ARRAY[]::text[]
    ELSE ARRAY[preferred_language]
  END
);

ALTER TABLE users
ALTER COLUMN preferred_language SET DEFAULT '{}'::text[];

