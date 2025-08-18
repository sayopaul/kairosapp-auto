/*
  # Migration to fix array columns in matches table
  
  This migration:
  1. Adds array columns for card IDs if they don't exist
  2. Migrates data from old single-card columns to new array columns
  3. Updates the trigger function to use array columns
  4. Drops the old single-card columns
*/

-- 1. Add new array columns if they don't exist
DO $$
BEGIN
  -- Add user1_card_ids as UUID[]
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'matches' AND column_name = 'user1_card_ids') THEN
    ALTER TABLE matches ADD COLUMN user1_card_ids UUID[] DEFAULT '{}';
  END IF;
  
  -- Add user2_card_ids as UUID[]
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'matches' AND column_name = 'user2_card_ids') THEN
    ALTER TABLE matches ADD COLUMN user2_card_ids UUID[] DEFAULT '{}';
  END IF;
  
  -- Add is_bundle column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'matches' AND column_name = 'is_bundle') THEN
    ALTER TABLE matches ADD COLUMN is_bundle BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Migrate data from old columns to new array columns
UPDATE matches 
SET 
  user1_card_ids = ARRAY[user1_card_id]::UUID[],
  user2_card_ids = ARRAY[user2_card_id]::UUID[]
WHERE 
  (user1_card_id IS NOT NULL OR user2_card_id IS NOT NULL)
  AND (user1_card_ids IS NULL OR user2_card_ids IS NULL OR 
       array_length(user1_card_ids, 1) IS NULL OR array_length(user2_card_ids, 1) IS NULL);

-- 3. Update the trigger function to use array columns
CREATE OR REPLACE FUNCTION find_matches_for_card(new_card_id UUID) RETURNS INTEGER AS $$
DECLARE
  new_card RECORD;
  other_user RECORD;
  other_card RECORD;
  our_trade_card RECORD;
  their_trade_card RECORD;
  match_score INTEGER;
  value_diff DOUBLE PRECISION;
  matches_created INTEGER := 0;
  user_tolerance INTEGER;
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
        -- Calculate match score
        match_score := calculate_match_score(
          COALESCE(new_card.market_price, 0)::DOUBLE PRECISION, 
          COALESCE(their_trade_card.market_price, 0)::DOUBLE PRECISION, 
          user_tolerance
        );
        
        -- Only create matches with decent scores
        IF match_score >= 60 THEN
          value_diff := ABS(COALESCE(new_card.market_price, 0) - COALESCE(their_trade_card.market_price, 0));
          
          -- Insert the match (avoid duplicates)
          INSERT INTO matches (
            user1_id,
            user2_id,
            user1_card_id,
            user2_card_id,
            user1_card_ids,
            user2_card_ids,
            match_score,
            value_difference,
            status,
            created_at,
            is_bundle
          )
          SELECT 
            new_card.user_id,
            other_user.id,
            new_card.id::UUID,
            their_trade_card.id::UUID,  
            ARRAY[new_card.id]::UUID[],
            ARRAY[their_trade_card.id]::UUID[],
            match_score,
            value_diff,
            'pending',
            NOW(),
            FALSE
          WHERE NOT EXISTS (
            SELECT 1 FROM matches 
            WHERE (user1_id = new_card.user_id AND user2_id = other_user.id 
                   AND user1_card_ids @> ARRAY[new_card.id]::UUID[] 
                   AND user2_card_ids @> ARRAY[their_trade_card.id]::UUID[])
               OR (user1_id = other_user.id AND user2_id = new_card.user_id 
                   AND user1_card_ids @> ARRAY[their_trade_card.id]::UUID[] 
                   AND user2_card_ids @> ARRAY[new_card.id]::UUID[])
          );
          
          GET DIAGNOSTICS matches_created = ROW_COUNT;
          IF matches_created > 0 THEN
            matches_created := matches_created + 1;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  -- If this is a want card, look for users who have it for trade
  IF new_card.list_type = 'want' THEN
    -- Find users who have this card for trade
    FOR other_user IN 
      SELECT DISTINCT u.* 
      FROM users u
      JOIN cards trade_cards ON trade_cards.user_id = u.id
      WHERE u.id != new_card.user_id 
        AND trade_cards.list_type = 'trade'
        AND cards_match(trade_cards.name, new_card.name)
    LOOP
      -- Find what they want that we have for trade
      FOR our_trade_card IN
        SELECT tc.*
        FROM cards tc
        WHERE tc.user_id = new_card.user_id 
          AND tc.list_type = 'trade'
          AND EXISTS (
            SELECT 1 FROM cards their_wants 
            WHERE their_wants.user_id = other_user.id 
              AND their_wants.list_type = 'want'
              AND cards_match(their_wants.name, tc.name)
          )
      LOOP
        -- Find the specific card they want that matches our trade card
        FOR their_trade_card IN
          SELECT tc.*
          FROM cards tc
          WHERE tc.user_id = other_user.id 
            AND tc.list_type = 'trade'
            AND cards_match(tc.name, new_card.name)
          LIMIT 1
        LOOP
          -- Calculate match score
          match_score := calculate_match_score(
            COALESCE(our_trade_card.market_price, 0)::DOUBLE PRECISION, 
            COALESCE(their_trade_card.market_price, 0)::DOUBLE PRECISION, 
            user_tolerance
          );
          
          -- Only create matches with decent scores
          IF match_score >= 60 THEN
            value_diff := ABS(COALESCE(our_trade_card.market_price, 0) - COALESCE(their_trade_card.market_price, 0));
            
            -- Insert the match (avoid duplicates)
            INSERT INTO matches (
              user1_id,
              user2_id,
              user1_card_id,
              user2_card_id,
              user1_card_ids,
              user2_card_ids,
              match_score,
              value_difference,
              status,
              created_at,
              is_bundle
            )
            SELECT 
              new_card.user_id,
              other_user.id,
              our_trade_card.id::UUID,
              their_trade_card.id::UUID,
              ARRAY[our_trade_card.id]::UUID[],
              ARRAY[their_trade_card.id]::UUID[],
              match_score,
              value_diff,
              'pending',
              NOW(),
              FALSE
            WHERE NOT EXISTS (
              SELECT 1 FROM matches 
              WHERE (user1_id = new_card.user_id AND user2_id = other_user.id 
                     AND user1_card_ids @> ARRAY[our_trade_card.id]::UUID[] 
                     AND user2_card_ids @> ARRAY[their_trade_card.id]::UUID[])
                 OR (user1_id = other_user.id AND user2_id = new_card.user_id 
                     AND user1_card_ids @> ARRAY[their_trade_card.id]::UUID[] 
                     AND user2_card_ids @> ARRAY[our_trade_card.id]::UUID[])
            );
            
            GET DIAGNOSTICS matches_created = ROW_COUNT;
            IF matches_created > 0 THEN
              matches_created := matches_created + 1;
            END IF;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN matches_created;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop old columns if they exist (only after confirming everything works)
-- Uncomment these lines after verifying the migration works in a test environment
/*
ALTER TABLE matches DROP COLUMN IF EXISTS user1_card_id;
ALTER TABLE matches DROP COLUMN IF EXISTS user2_card_id;
*/

-- 5. Add a comment about the migration
COMMENT ON COLUMN matches.user1_card_ids IS 'Array of card IDs from user1 in this match';
COMMENT ON COLUMN matches.user2_card_ids IS 'Array of card IDs from user2 in this match';
COMMENT ON COLUMN matches.is_bundle IS 'Whether this match is a bundle trade (multiple cards)';

-- 6. Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS auto_match_trigger ON cards;
CREATE TRIGGER auto_match_trigger
  AFTER INSERT ON cards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_find_matches();

-- 7. Add indexes for better performance with array operations
CREATE INDEX IF NOT EXISTS idx_matches_user1_card_ids ON matches USING GIN (user1_card_ids);
CREATE INDEX IF NOT EXISTS idx_matches_user2_card_ids ON matches USING GIN (user2_card_ids);
