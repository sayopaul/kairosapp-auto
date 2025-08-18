/*
  # Add Tracking Information to Transactions Table

  1. Schema Updates
    - Add tracking_number column to transactions table
    - Add carrier column to transactions table
    - Add tracking_status column to transactions table
    
  2. Purpose
    - Enable tracking of shipped cards between users
    - Store carrier information for tracking links
    - Track shipping status updates
*/

-- Add tracking columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_status TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_tracking ON transactions(tracking_number, carrier);

-- Add check constraint for carrier
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS check_carrier 
CHECK (carrier IS NULL OR carrier IN ('usps', 'ups', 'fedex', 'dhl'));

-- Add check constraint for tracking status
ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS check_tracking_status
CHECK (tracking_status IS NULL OR tracking_status IN (
  'Shipping Label Created',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Exception',
  'Return to Sender'
));