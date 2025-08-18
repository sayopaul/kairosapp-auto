/*
  # Add Tracking Information to Transactions

  1. Changes
    - Add tracking_number column to transactions table
    - Add carrier column to transactions table
    - Add tracking_status column to transactions table
    - Add appropriate constraints and indexes
    
  2. Purpose
    - Enable tracking of shipped cards between users
    - Support integration with Shippo shipping service
    - Allow users to monitor shipping status
*/

-- Add tracking columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_status TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_tracking ON transactions(tracking_number, carrier);

-- Add check constraint for carrier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'transactions' AND constraint_name = 'check_carrier'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT check_carrier 
    CHECK (carrier IS NULL OR carrier IN ('usps', 'ups', 'fedex', 'dhl'));
  END IF;
END $$;

-- Add check constraint for tracking status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'transactions' AND constraint_name = 'check_tracking_status'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT check_tracking_status
    CHECK (tracking_status IS NULL OR tracking_status IN (
      'Shipping Label Created',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Exception',
      'Return to Sender'
    ));
  END IF;
END $$;