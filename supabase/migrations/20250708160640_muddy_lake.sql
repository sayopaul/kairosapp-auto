/*
  # Remove Test Traders and Fix Unique Constraints

  1. Changes
    - Delete all test trader data (matches, cards, users)
    - Fix unique constraint for trade proposals to prevent duplicates
    - Add function to prevent duplicate bundle matches
    
  2. Order of Operations
    - Delete matches first to avoid foreign key violations
    - Then delete cards owned by test traders
    - Finally delete the test trader users themselves
*/

-- First, delete all matches involving test traders to avoid foreign key constraint violations
DELETE FROM matches 
WHERE user1_id IN (SELECT id FROM users WHERE username LIKE 'TestTrader%')
   OR user2_id IN (SELECT id FROM users WHERE username LIKE 'TestTrader%');

-- Now delete cards owned by test traders
DELETE FROM cards 
WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'TestTrader%');

-- Finally delete the test trader users
DELETE FROM users WHERE username LIKE 'TestTrader%';

-- Fix unique constraint for trade proposals to prevent duplicates
-- First drop the index if it exists, then recreate it
DROP INDEX IF EXISTS unique_single_trade_match;

CREATE UNIQUE INDEX unique_single_trade_match ON matches (
  LEAST(user1_id, user2_id), 
  GREATEST(user1_id, user2_id),
  LEAST(COALESCE(user1_card_id, '00000000-0000-0000-0000-000000000000'::uuid), 
        COALESCE(user2_card_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  GREATEST(COALESCE(user1_card_id, '00000000-0000-0000-0000-000000000000'::uuid), 
           COALESCE(user2_card_id, '00000000-0000-0000-0000-000000000000'::uuid))
) WHERE is_bundle = false;

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