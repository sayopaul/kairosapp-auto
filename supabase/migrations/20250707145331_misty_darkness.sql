/*
  # Add subscription fields to users table

  1. Changes
    - Add subscription_tier column to users table
    - Add subscription_status column to users table
    - Set default values for existing users

  2. Security
    - No changes to existing RLS policies
*/

-- Add subscription fields to users table
DO $$
BEGIN
  -- Add subscription_tier column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'trainer';
  END IF;

  -- Add subscription_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_status TEXT;
  END IF;
END $$;

-- Add check constraint for subscription_tier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_subscription_tier' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_tier 
    CHECK (subscription_tier IN ('trainer', 'elite', 'master'));
  END IF;
END $$;

-- Add check constraint for subscription_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_subscription_status' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_status 
    CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'past_due'));
  END IF;
END $$;

-- Set default subscription_tier for existing users
UPDATE users SET subscription_tier = 'trainer' WHERE subscription_tier IS NULL;