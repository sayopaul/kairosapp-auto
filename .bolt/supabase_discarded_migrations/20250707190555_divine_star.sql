/*
  # Add Subscription Events Table

  1. New Table
    - `subscription_events` table to track subscription-related events
    - Records payment history, subscription changes, and status updates
    - Links to subscriptions and users tables
    
  2. Schema
    - id: UUID primary key
    - subscription_id: UUID foreign key to subscriptions table
    - user_id: UUID foreign key to users table
    - event_type: TEXT (subscription_created, payment_succeeded, etc.)
    - stripe_event_id: TEXT
    - amount: NUMERIC(10,2)
    - currency: TEXT
    - status: TEXT
    - created_at: TIMESTAMP
*/

-- Create subscription_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  amount NUMERIC(10,2),
  currency TEXT,
  status TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Add check constraint for event_type
ALTER TABLE subscription_events ADD CONSTRAINT check_event_type 
CHECK (event_type IN ('subscription_created', 'payment_succeeded', 'payment_failed', 'subscription_updated', 'subscription_canceled'));

-- Create indexes for subscription_events
CREATE INDEX idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX idx_subscription_events_created_at ON subscription_events(created_at);

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
  amount NUMERIC(10,2) DEFAULT NULL,
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