/*
  # Add Subscriptions Table

  1. New Table
    - `subscriptions` table to store user subscription information
    - Tracks subscription tier, billing cycle, and active status
    - Links to users table via user_id foreign key
    
  2. Schema
    - id: UUID primary key
    - user_id: UUID foreign key to users table
    - tier: TEXT (trainer, elite, master)
    - billing_cycle: TEXT (monthly, yearly)
    - is_active: BOOLEAN
    - created_at: TIMESTAMP
*/

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
ALTER TABLE subscriptions ADD CONSTRAINT check_subscription_tier 
CHECK (tier IN ('trainer', 'elite', 'master'));

ALTER TABLE subscriptions ADD CONSTRAINT check_billing_cycle 
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);