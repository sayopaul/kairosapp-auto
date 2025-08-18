/*
  # Add Stripe Integration Support

  1. Schema Updates
    - Update subscriptions table to include Stripe-specific fields
    - Add support for tracking subscription status and payment history
    - Ensure proper constraints and indexes for Stripe integration
    
  2. Security
    - Maintain existing RLS policies
    - Add additional policies for subscription management
*/

-- Update subscriptions table with Stripe-specific fields if they don't exist
DO $$
BEGIN
  -- Add stripe_customer_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT;
  END IF;

  -- Add stripe_subscription_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT;
  END IF;
END $$;

-- Create subscription_events table to track payment history
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  amount DECIMAL(10, 2),
  currency TEXT,
  status TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Add check constraint for event_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_event_type' AND table_name = 'subscription_events'
  ) THEN
    ALTER TABLE subscription_events ADD CONSTRAINT check_event_type 
    CHECK (event_type IN ('subscription_created', 'payment_succeeded', 'payment_failed', 'subscription_updated', 'subscription_canceled'));
  END IF;
END $$;

-- Create indexes for subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at);

-- Enable RLS on subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for subscription_events
CREATE POLICY "Users can view their own subscription events"
  ON subscription_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add function to handle Stripe webhook events
CREATE OR REPLACE FUNCTION handle_stripe_webhook(
  event_type TEXT,
  stripe_event_id TEXT,
  subscription_id UUID,
  user_id UUID,
  amount DECIMAL(10, 2) DEFAULT NULL,
  currency TEXT DEFAULT NULL,
  status TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO subscription_events (
    subscription_id,
    user_id,
    event_type,
    stripe_event_id,
    amount,
    currency,
    status,
    created_at
  ) VALUES (
    subscription_id,
    user_id,
    event_type,
    stripe_event_id,
    amount,
    currency,
    status,
    NOW()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;