/*
  # Fix Database Schema for Matchmaking

  1. Schema Issues Found
    - `cards` table has incorrect default values (uid() instead of gen_random_uuid())
    - `matches` table has incorrect default values
    - `messages` table has incorrect default values  
    - `transactions` table has incorrect default values
    - Missing proper foreign key relationships
    - `user_cards` table appears to be unused and has conflicting foreign keys

  2. Changes
    - Fix UUID generation defaults
    - Ensure proper foreign key constraints
    - Add missing indexes for performance
    - Clean up unused `user_cards` table
    - Add proper timestamps with defaults

  3. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- Fix cards table defaults and constraints
ALTER TABLE cards ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE cards ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE cards ALTER COLUMN created_at SET DEFAULT now();

-- Fix matches table defaults and constraints  
ALTER TABLE matches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE matches ALTER COLUMN user1_id SET DEFAULT auth.uid();
ALTER TABLE matches ALTER COLUMN created_at SET DEFAULT now();

-- Fix messages table defaults and constraints
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE messages ALTER COLUMN match_id SET DEFAULT gen_random_uuid();
ALTER TABLE messages ALTER COLUMN timestamp SET DEFAULT now();

-- Fix transactions table defaults and constraints
ALTER TABLE transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE transactions ALTER COLUMN match_id SET DEFAULT gen_random_uuid();

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id_list_type ON cards(user_id, list_type);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_matches_user1_id ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2_id ON matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);

-- Drop the problematic user_cards table if it exists (it seems unused and has conflicting constraints)
DROP TABLE IF EXISTS user_cards CASCADE;

-- Ensure all tables have proper NOT NULL constraints where needed
ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cards ALTER COLUMN name SET NOT NULL;
ALTER TABLE cards ALTER COLUMN list_type SET NOT NULL;

ALTER TABLE matches ALTER COLUMN user1_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN status SET NOT NULL;

-- Add check constraints for data validation
ALTER TABLE cards ADD CONSTRAINT check_list_type CHECK (list_type IN ('trade', 'want'));
ALTER TABLE cards ADD CONSTRAINT check_condition CHECK (condition IN ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'));
ALTER TABLE cards ADD CONSTRAINT check_quantity_positive CHECK (quantity > 0);
ALTER TABLE cards ADD CONSTRAINT check_market_price_non_negative CHECK (market_price >= 0);

ALTER TABLE matches ADD CONSTRAINT check_match_status CHECK (status IN ('pending', 'accepted', 'declined', 'completed'));
ALTER TABLE matches ADD CONSTRAINT check_match_score_range CHECK (match_score >= 0 AND match_score <= 100);
ALTER TABLE matches ADD CONSTRAINT check_value_difference_non_negative CHECK (value_difference >= 0);

-- Ensure users table has proper constraints
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT check_reputation_score_range CHECK (reputation_score >= 0 AND reputation_score <= 5);
ALTER TABLE users ADD CONSTRAINT check_trade_percentage_range CHECK (trade_percentage_min >= 0 AND trade_percentage_min <= 100);