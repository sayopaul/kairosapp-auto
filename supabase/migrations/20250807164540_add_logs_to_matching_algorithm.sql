-- Improve card matching algorithm and add debug logging

-- Drop existing cards_match function if it exists
DROP FUNCTION IF EXISTS public.cards_match(TEXT, TEXT);

-- Create improved cards_match function with detailed logging
CREATE OR REPLACE FUNCTION public.cards_match(name1 TEXT, name2 TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_name1 TEXT;
  clean_name2 TEXT;
BEGIN
  -- Handle null inputs
  IF name1 IS NULL OR name2 IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Clean and normalize names
  clean_name1 := LOWER(TRIM(name1));
  clean_name2 := LOWER(TRIM(name2));
  
  -- Exact match
  IF clean_name1 = clean_name2 THEN
    RETURN TRUE;
  END IF;
  
  -- Fuzzy match using contains logic
  IF clean_name1 LIKE '%' || clean_name2 || '%' OR 
     clean_name2 LIKE '%' || clean_name1 || '%' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


-- Create or replace the find_matches_for_card function with improved logging
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
  debug_counter INTEGER := 0;
  is_bundle_trade BOOLEAN := FALSE;
  card_value NUMERIC;
  other_card_value NUMERIC;
  value_diff_percent NUMERIC;
BEGIN
  RAISE LOG 'find_matches_for_card: Starting for card_id: %s', new_card_id;
  
  -- Get the new card details
  SELECT * INTO new_card FROM cards WHERE id = new_card_id;
  
  IF NOT FOUND THEN
    RAISE LOG 'find_matches_for_card: Card with ID %s not found', new_card_id;
    RETURN 0;
  END IF;
  
  RAISE LOG 'find_matches_for_card: Processing card: %s', new_card.name;
  RAISE LOG 'find_matches_for_card: Card ID: %s, Type: %s', new_card.id, new_card.list_type;
  RAISE LOG 'find_matches_for_card: User ID: %s', new_card.user_id;
  
  -- Get user's trade tolerance
  SELECT COALESCE(trade_percentage_min, 80) INTO user_tolerance 
  FROM users 
  WHERE id = new_card.user_id;
  
  IF user_tolerance IS NULL THEN
    user_tolerance := 80;
    RAISE LOG 'find_matches_for_card: Using default trade tolerance: %s', user_tolerance;
  ELSE
    RAISE LOG 'find_matches_for_card: Using trade tolerance: %s', user_tolerance;
  END IF;
  
  -- Process based on list type
  IF new_card.list_type = 'trade' THEN
    RAISE LOG 'find_matches_for_card: Looking for users who want card: %s', new_card.name;
    
    -- Find users who want this card
    FOR other_user IN 
      SELECT DISTINCT u.* 
      FROM users u
      JOIN cards want_cards ON want_cards.user_id = u.id
      WHERE u.id != new_card.user_id 
        AND want_cards.list_type = 'want'
        AND cards_match(want_cards.name, new_card.name)
    LOOP
      debug_counter := debug_counter + 1;
      RAISE LOG 'find_matches_for_card: [%s] Found user %s who wants a card matching %s', 
        debug_counter, other_user.id, new_card.name;
      
      -- Find what they have for trade that we want
      FOR their_trade_card IN
        SELECT tc.*
        FROM cards tc
        JOIN cards our_wants ON our_wants.user_id = new_card.user_id 
          AND our_wants.list_type = 'want'
          AND cards_match(our_wants.name, tc.name)
        WHERE tc.user_id = other_user.id 
          AND tc.list_type = 'trade'
      LOOP
        debug_counter := debug_counter + 1;
        RAISE LOG 'find_matches_for_card: [%s] Potential trade: User %s has %s that user %s wants', 
          debug_counter, other_user.id, their_trade_card.name, new_card.user_id;
        
        -- Calculate values
        card_value := COALESCE(new_card.market_price, 0);
        other_card_value := COALESCE(their_trade_card.market_price, 0);
        value_diff := ABS(card_value - other_card_value);
        value_diff_percent := (value_diff / GREATEST(card_value, other_card_value)) * 100;
        
        RAISE LOG 'find_matches_for_card: Card values for %s: $%s', new_card.name, card_value;
        RAISE LOG 'find_matches_for_card: Card values for %s: $%s', their_trade_card.name, other_card_value;
        RAISE LOG 'find_matches_for_card: Value difference: $%s (%s%%)', 
          value_diff, ROUND(value_diff_percent, 2);
        
        -- Calculate match score based on value difference
        match_score := 
        CASE 
            -- If values are very close (within 5%)
            WHEN value_diff_percent < 5 THEN 100
            -- If values are close (5-15% difference)
            WHEN value_diff_percent < 15 THEN 90 - (value_diff_percent - 5)
            -- If values are somewhat close (15-30% difference)
            WHEN value_diff_percent < 30 THEN 75 - ((value_diff_percent - 15) * 0.5)
            -- If values are not close (30-50% difference)
            WHEN value_diff_percent < 50 THEN 60 - ((value_diff_percent - 30) * 0.7)
            -- For larger differences
            ELSE GREATEST(10, 50 - (value_diff_percent / 2))
        END;

        -- Add a small bonus for same card conditions if they exist
        IF new_card.condition IS NOT NULL AND their_trade_card.condition IS NOT NULL THEN
        IF new_card.condition = their_trade_card.condition THEN
            match_score := LEAST(100, match_score + 5);
        END IF;
        END IF;

       RAISE LOG 'find_matches_for_card: Calculated match score: %s (Value diff: %s%%)', 
        match_score, ROUND(value_diff_percent, 2);
        
        -- Check if a match already exists between these users
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
          RAISE LOG 'find_matches_for_card: Found existing match %s between users %s and %s', 
            existing_match_id, existing_user1_id, existing_user2_id;
            
          -- Update existing match with the new card
          IF existing_user1_id = new_card.user_id THEN
            -- Add to user1's cards if not already there
            IF NOT (existing_user1_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE LOG 'find_matches_for_card: Added card %s to user %s in match %s', 
                new_card.id, new_card.user_id, existing_match_id;
            END IF;
            
            -- Add to user2's cards if not already there
            IF NOT (existing_user2_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE LOG 'find_matches_for_card: Added card %s to user %s in match %s', 
                their_trade_card.id, other_user.id, existing_match_id;
            END IF;
          ELSE
            -- Similar logic when user positions are reversed
            IF NOT (existing_user2_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE LOG 'find_matches_for_card: Added card %s to user %s in match %s', 
                new_card.id, new_card.user_id, existing_match_id;
            END IF;
            
            IF NOT (existing_user1_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE LOG 'find_matches_for_card: Added card %s to user %s in match %s', 
                their_trade_card.id, other_user.id, existing_match_id;
            END IF;
          END IF;
        ELSE

          is_bundle_trade := (
            -- Check if either user already has multiple cards in their trade
            SELECT COUNT(*) > 1 
            FROM (
                SELECT unnest(ARRAY[new_card.id::text]) AS card_id
                UNION ALL
                SELECT unnest(ARRAY[their_trade_card.id::text])
            ) t
            GROUP BY card_id
            HAVING COUNT(*) > 1
            );
          -- Insert new match
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
            updated_at,
            is_bundle
          ) VALUES (
            new_card.user_id,
            other_user.id,
            CASE WHEN is_bundle_trade THEN NULL ELSE new_card.id::UUID END,
            CASE WHEN is_bundle_trade THEN NULL ELSE their_trade_card.id::UUID END,
            ARRAY[new_card.id::text]::TEXT[],
            ARRAY[their_trade_card.id::text]::TEXT[],
            match_score,
            value_diff,
            'pending',
            NOW(),
            NOW(),
            is_bundle_trade
          )
          RETURNING id INTO existing_match_id;
          
          RAISE LOG 'find_matches_for_card: Created new match %s between user %s and %s', 
            existing_match_id, new_card.user_id, other_user.id;
          RAISE LOG 'find_matches_for_card: Match details - Score: %s, Value diff: $%s', 
            match_score, value_diff;
          
          matches_created := matches_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  RAISE LOG 'find_matches_for_card: Processed %s potential matches, created %s new matches', 
    debug_counter, matches_created;
  
  RETURN matches_created;
END;
$$;

-- Update the trigger to include logging
CREATE OR REPLACE FUNCTION public.trigger_find_matches_for_card()
RETURNS TRIGGER AS $$
BEGIN
    RAISE LOG 'trigger_find_matches_for_card: Triggered for card_id: %s', NEW.id;
    PERFORM find_matches_for_card(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS after_card_insert ON cards;
CREATE TRIGGER after_card_insert
AFTER INSERT ON cards
FOR EACH ROW
EXECUTE FUNCTION trigger_find_matches_for_card();

-- Add a comment
COMMENT ON FUNCTION public.trigger_find_matches_for_card() IS 'Trigger function to find matches after card insertion';
COMMENT ON FUNCTION public.find_matches_for_card(UUID) IS 'Finds potential matches when a new card is added, with improved logging and matching';
COMMENT ON FUNCTION public.trigger_find_matches_for_card() IS 'Trigger function to find matches after card insertion';
COMMENT ON FUNCTION public.cards_match(TEXT, TEXT) IS 'Improved card matching function with better normalization and fuzzy matching';