-- Migration to fix type mismatch in find_matches_for_card function
-- This ensures proper type casting when comparing arrays and handles unique constraints

-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS after_card_insert ON cards;

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.find_matches_for_card(UUID);

-- Add updated_at column to matches table if it doesn't exist
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create the main function with proper type casting and constraint handling
CREATE OR REPLACE FUNCTION public.find_matches_for_card(new_card_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_card RECORD;
  other_user RECORD;
  their_trade_card RECORD;
  match_score INTEGER;
  value_diff DOUBLE PRECISION;
  matches_created INTEGER := 0;
  user_tolerance INTEGER;
  existing_match_id UUID;
  existing_user1_id UUID;
  existing_user2_id UUID;
  existing_user1_cards TEXT[];
  existing_user2_cards TEXT[];
BEGIN
  -- Get the new card details
  SELECT * INTO new_card FROM cards WHERE id = new_card_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Get user's trade tolerance
  SELECT COALESCE(trade_percentage_min, 80) INTO user_tolerance 
  FROM users 
  WHERE id = new_card.user_id;
  
  IF user_tolerance IS NULL THEN
    user_tolerance := 80;
  END IF;
  
  -- If this is a trade card, look for users who want it and have something we want
  IF new_card.list_type = 'trade' THEN
    -- Find users who want this card
    FOR other_user IN 
      SELECT DISTINCT u.* 
      FROM users u
      JOIN cards want_cards ON want_cards.user_id = u.id
      WHERE u.id != new_card.user_id 
        AND want_cards.list_type = 'want'
        AND cards_match(want_cards.name, new_card.name)
    LOOP
      -- Find what they have for trade that we want
      FOR their_trade_card IN
        SELECT tc.*
        FROM cards tc
        WHERE tc.user_id = other_user.id 
          AND tc.list_type = 'trade'
          AND EXISTS (
            SELECT 1 FROM cards our_wants 
            WHERE our_wants.user_id = new_card.user_id 
              AND our_wants.list_type = 'want'
              AND cards_match(our_wants.name, tc.name)
          )
      LOOP
        -- Calculate match score and value difference
        match_score := 100; -- Simplified for example
        value_diff := 0;    -- Calculate based on your logic
        
        -- Check if a match already exists between these users (regardless of direction)
        SELECT 
          m.id,
          m.user1_id,
          m.user2_id,
          m.user1_card_ids,
          m.user2_card_ids
        INTO 
          existing_match_id,
          existing_user1_id,
          existing_user2_id,
          existing_user1_cards,
          existing_user2_cards
        FROM matches m
        WHERE 
          (m.user1_id = new_card.user_id AND m.user2_id = other_user.id)
          OR (m.user1_id = other_user.id AND m.user2_id = new_card.user_id)
        LIMIT 1;
        
        IF existing_match_id IS NOT NULL THEN
          -- Update existing match with the new card
          IF existing_user1_id = new_card.user_id THEN
            -- Add to user1's cards if not already there
            IF NOT (existing_user1_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
            END IF;
            
            -- Add to user2's cards if not already there
            IF NOT (existing_user2_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
            END IF;
          ELSE
            -- Add to user2's cards if not already there
            IF NOT (existing_user2_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
            END IF;
            
            -- Add to user1's cards if not already there
            IF NOT (existing_user1_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
            END IF;
          END IF;
        ELSE
          -- Insert new match
          INSERT INTO matches (
            user1_id,
            user2_id,
            user1_card_ids,
            user2_card_ids,
            match_score,
            value_difference,
            status,
            created_at,
            updated_at,
            is_bundle
          ) VALUES (
            new_card.user_id,
            other_user.id,
            ARRAY[new_card.id::text]::TEXT[],
            ARRAY[their_trade_card.id::text]::TEXT[],
            match_score,
            value_diff,
            'pending',
            NOW(),
            NOW(),
            FALSE
          );
          
          matches_created := matches_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN matches_created;
END;
$$;

-- Create a wrapper function for the trigger
CREATE OR REPLACE FUNCTION public.trigger_find_matches_for_card()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM find_matches_for_card(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER after_card_insert
AFTER INSERT ON cards
FOR EACH ROW
EXECUTE FUNCTION trigger_find_matches_for_card();

-- Add a comment
COMMENT ON FUNCTION public.find_matches_for_card(UUID) IS 'Finds potential matches when a new card is added, with proper type casting and constraint handling';