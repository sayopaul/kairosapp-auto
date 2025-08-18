/*
  # Fix Database Schema for AutoTradeTCG

  1. Schema Fixes
    - Fix table defaults and constraints
    - Add proper indexes for performance
    - Ensure data integrity with constraints
    - Remove problematic tables

  2. Data Integrity
    - Add check constraints for validation
    - Ensure proper NOT NULL constraints
    - Fix foreign key relationships
*/

-- First, clear any existing problematic data
DELETE FROM matches;

-- Fix cards table defaults and constraints
ALTER TABLE cards ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE cards ALTER COLUMN created_at SET DEFAULT now();

-- Fix matches table defaults and constraints  
ALTER TABLE matches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE matches ALTER COLUMN created_at SET DEFAULT now();

-- Fix messages table defaults and constraints
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE messages ALTER COLUMN timestamp SET DEFAULT now();

-- Fix transactions table defaults and constraints
ALTER TABLE transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop problematic user_cards table if it exists
DROP TABLE IF EXISTS user_cards CASCADE;

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id_list_type ON cards(user_id, list_type);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_matches_user1_id ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2_id ON matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);

-- Ensure all tables have proper NOT NULL constraints where needed
ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cards ALTER COLUMN name SET NOT NULL;
ALTER TABLE cards ALTER COLUMN list_type SET NOT NULL;

ALTER TABLE matches ALTER COLUMN user1_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN status SET NOT NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Add check constraints for data validation
DO $$
BEGIN
  -- Cards table constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_list_type' AND table_name = 'cards') THEN
    ALTER TABLE cards ADD CONSTRAINT check_list_type CHECK (list_type IN ('trade', 'want'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_condition' AND table_name = 'cards') THEN
    ALTER TABLE cards ADD CONSTRAINT check_condition CHECK (condition IN ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_quantity_positive' AND table_name = 'cards') THEN
    ALTER TABLE cards ADD CONSTRAINT check_quantity_positive CHECK (quantity > 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_market_price_non_negative' AND table_name = 'cards') THEN
    ALTER TABLE cards ADD CONSTRAINT check_market_price_non_negative CHECK (market_price >= 0);
  END IF;

  -- Matches table constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_match_status' AND table_name = 'matches') THEN
    ALTER TABLE matches ADD CONSTRAINT check_match_status CHECK (status IN ('pending', 'accepted', 'declined', 'completed'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_match_score_range' AND table_name = 'matches') THEN
    ALTER TABLE matches ADD CONSTRAINT check_match_score_range CHECK (match_score >= 0 AND match_score <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_value_difference_non_negative' AND table_name = 'matches') THEN
    ALTER TABLE matches ADD CONSTRAINT check_value_difference_non_negative CHECK (value_difference >= 0);
  END IF;

  -- Users table constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_reputation_score_range' AND table_name = 'users') THEN
    ALTER TABLE users ADD CONSTRAINT check_reputation_score_range CHECK (reputation_score >= 0 AND reputation_score <= 5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_trade_percentage_range' AND table_name = 'users') THEN
    ALTER TABLE users ADD CONSTRAINT check_trade_percentage_range CHECK (trade_percentage_min >= 0 AND trade_percentage_min <= 100);
  END IF;
END $$;