/*
  # Remove Test Traders and Fix Trade Proposal Buttons

  1. Changes
    - Remove all test trader users and their associated data
    - Fix constraints for trade proposals to ensure proper functionality
    
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with proper constraints
*/

-- Delete all test traders and their associated data
DELETE FROM matches WHERE user1_id IN (
  SELECT id FROM users WHERE username LIKE 'TestTrader%'
);

DELETE FROM cards WHERE user_id IN (
  SELECT id FROM users WHERE username LIKE 'TestTrader%'
);

DELETE FROM users WHERE username LIKE 'TestTrader%';

-- Fix unique constraint for trade proposals to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_single_trade_match' AND table_name = 'matches'
  ) THEN
    CREATE UNIQUE INDEX unique_single_trade_match ON matches (
      LEAST(user1_id, user2_id), 
      GREATEST(user1_id, user2_id),
      LEAST(user1_card_id, user2_card_id),
      GREATEST(user1_card_id, user2_card_id)
    ) WHERE is_bundle = false;
  END IF;
END $$;

-- Fix function to prevent duplicate bundle matches
CREATE OR REPLACE FUNCTION prevent_duplicate_bundle_match() RETURNS TRIGGER AS $$
BEGIN
  -- For bundle trades, check if there's already a match with the same users and card sets
  IF NEW.is_bundle = true THEN
    IF EXISTS (
      SELECT 1 FROM matches 
      WHERE is_bundle = true
      AND (
        (user1_id = NEW.user1_id AND user2_id = NEW.user2_id AND 
         user1_card_ids = NEW.user1_card_ids AND user2_card_ids = NEW.user2_card_ids)
        OR
        (user1_id = NEW.user2_id AND user2_id = NEW.user1_id AND 
         user1_card_ids = NEW.user2_card_ids AND user2_card_ids = NEW.user1_card_ids)
      )
    ) THEN
      RAISE EXCEPTION 'Duplicate bundle match';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for preventing duplicate bundle matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_prevent_duplicate_bundle_match'
  ) THEN
    CREATE TRIGGER trigger_prevent_duplicate_bundle_match
      BEFORE INSERT ON matches
      FOR EACH ROW
      EXECUTE FUNCTION prevent_duplicate_bundle_match();
  END IF;
END $$;