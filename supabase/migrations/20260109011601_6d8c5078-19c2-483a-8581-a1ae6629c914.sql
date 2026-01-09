-- Add 'manager' and 'rep' to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'rep';

-- Add role column to rep_profiles (using 'viewer' as default since 'rep' might not exist yet)
DO $$ BEGIN
  ALTER TABLE public.rep_profiles ADD COLUMN role app_role DEFAULT 'viewer';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;