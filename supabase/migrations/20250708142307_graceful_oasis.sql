/*
  # Add Tracking Information to Transactions Table

  1. Schema Updates
    - Add tracking_number column to store shipping tracking numbers
    - Add carrier column to store shipping carrier information (USPS, UPS, etc.)
    - Add tracking_status column to store current shipping status
    
  2. Constraints
    - Add check constraint for carrier to ensure valid values
    - Add check constraint for tracking_status to ensure valid status values
    - Create index for faster tracking lookups
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