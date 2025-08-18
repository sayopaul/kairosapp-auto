/*
  # Add completed_at timestamp to trade proposals

  1. Schema Changes
    - Add `completed_at` timestamp field to `trade_proposals` table
    - This will track when a trade was fully completed

  2. Purpose
    - Better record-keeping for completed trades
    - Enables sorting and filtering by completion date
    - Provides audit trail for trade completion
*/

-- Add completed_at column to trade_proposals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_proposals' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE trade_proposals ADD COLUMN completed_at timestamptz;
  END IF;
END $$;