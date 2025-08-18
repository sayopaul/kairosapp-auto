/*
  # Add Subscription Fields to Database

  1. Changes
    - Add subscription_tier and subscription_status to users table
    - Create subscriptions table for tracking subscription details
    - Add proper constraints and indexes
    - Enable RLS for subscriptions table
    
  2. Security
    - Add RLS policies for subscriptions table
    - Ensure users can only access their own subscription data
*/

-- Add subscription fields to users table if they don't exist
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

-- Add check constraints for subscription fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_subscription_tier' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_tier 
    CHECK (subscription_tier IN ('trainer', 'elite', 'master'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_subscription_status' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_subscription_status 
    CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'past_due'));
  END IF;
END $$;

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL DEFAULT 'trainer',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_billing_cycle' AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT check_billing_cycle 
    CHECK (billing_cycle IN ('monthly', 'yearly'));
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' AND policyname = 'Users can view their own subscriptions'
  ) THEN
    CREATE POLICY "Users can view their own subscriptions"
      ON subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' AND policyname = 'Users can insert their own subscriptions'
  ) THEN
    CREATE POLICY "Users can insert their own subscriptions"
      ON subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' AND policyname = 'Users can update their own subscriptions'
  ) THEN
    CREATE POLICY "Users can update their own subscriptions"
      ON subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Set default subscription_tier for existing users
UPDATE users SET subscription_tier = 'trainer' WHERE subscription_tier IS NULL;