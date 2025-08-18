-- Improve card matching algorithm and add debug logging

-- Drop existing cards_match function if it exists
DROP FUNCTION IF EXISTS public.cards_match(TEXT, TEXT);

-- Create improved cards_match function
CREATE OR REPLACE FUNCTION public.cards_match(name1 TEXT, name2 TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  clean_name1 TEXT;
  clean_name2 TEXT;
BEGIN
  -- Handle null inputs
  IF name1 IS NULL OR name2 IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- More aggressive cleaning and normalization
  -- Remove all non-alphanumeric characters and convert to lowercase
  clean_name1 := regexp_replace(LOWER(TRIM(name1)), '[^a-z0-9]', '', 'g');
  clean_name2 := regexp_replace(LOWER(TRIM(name2)), '[^a-z0-9]', '', 'g');
  
  -- Exact match
  IF clean_name1 = clean_name2 THEN
    RETURN TRUE;
  END IF;
  
  -- Fuzzy match using contains logic
  IF clean_name1 LIKE '%' || clean_name2 || '%' OR 
     clean_name2 LIKE '%' || clean_name1 || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- Try matching without set numbers or special characters
  IF regexp_replace(clean_name1, '^[0-9]+', '') = regexp_replace(clean_name2, '^[0-9]+', '') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

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
BEGIN
  -- Get the new card details with debug logging
  SELECT * INTO new_card FROM cards WHERE id = new_card_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Card with ID % not found', new_card_id;
    RETURN 0;
  END IF;
  
  RAISE NOTICE 'Processing new card: % (ID: %), List Type: %', 
    new_card.name, new_card.id, new_card.list_type;
  
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
      debug_counter := debug_counter + 1;
      RAISE NOTICE 'Found user % who wants a card matching %', other_user.id, new_card.name;
      
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
        RAISE NOTICE 'Found potential trade: User % has % that user % wants', 
          other_user.id, their_trade_card.name, new_card.user_id;
        
        -- Calculate match score and value difference
        match_score := 100; -- Simplified for example
        value_diff := 0;    -- Calculate based on your logic
        
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
          -- Update existing match with the new card
          IF existing_user1_id = new_card.user_id THEN
            -- Add to user1's cards if not already there
            IF NOT (existing_user1_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE NOTICE 'Updated match % with new card % for user %', 
                existing_match_id, new_card.id, new_card.user_id;
            END IF;
            
            -- Add to user2's cards if not already there
            IF NOT (existing_user2_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE NOTICE 'Updated match % with new card % for user %', 
                existing_match_id, their_trade_card.id, other_user.id;
            END IF;
          ELSE
            -- Add to user2's cards if not already there
            IF NOT (existing_user2_cards @> ARRAY[new_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user2_card_ids = array_append(existing_user2_cards, new_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE NOTICE 'Updated match % with new card % for user %', 
                existing_match_id, new_card.id, new_card.user_id;
            END IF;
            
            -- Add to user1's cards if not already there
            IF NOT (existing_user1_cards @> ARRAY[their_trade_card.id::text]::TEXT[]) THEN
              UPDATE matches
              SET 
                user1_card_ids = array_append(existing_user1_cards, their_trade_card.id::text),
                updated_at = NOW()
              WHERE id = existing_match_id;
              RAISE NOTICE 'Updated match % with new card % for user %', 
                existing_match_id, their_trade_card.id, other_user.id;
            END IF;
          END IF;
        ELSE
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
            -- For non-bundle trades, set the first card ID
            CASE WHEN is_bundle_trade THEN NULL ELSE new_card.id::UUID END,
            CASE WHEN is_bundle_trade THEN NULL ELSE their_trade_card.id::UUID END,
            ARRAY[new_card.id::text]::TEXT[],
            ARRAY[their_trade_card.id::text]::TEXT[],
            match_score,
            value_diff,
            'pending',
            NOW(),
            NOW(),
            FALSE
          )
          RETURNING id INTO existing_match_id;
          
          RAISE NOTICE 'Created new match % between user % and %', 
            existing_match_id, new_card.user_id, other_user.id;
          
          matches_created := matches_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  RAISE NOTICE 'Processed % potential matches for card % (ID: %), created % new matches', 
    debug_counter, new_card.name, new_card.id, matches_created;
  
  RETURN matches_created;
END;
$$;

-- Update the trigger to use the new function
CREATE OR REPLACE FUNCTION public.trigger_find_matches_for_card()
RETURNS TRIGGER AS $$
BEGIN
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
COMMENT ON FUNCTION public.cards_match(TEXT, TEXT) IS 'Improved card matching function with better normalization and fuzzy matching';
COMMENT ON FUNCTION public.find_matches_for_card(UUID) IS 'Finds potential matches when a new card is added, with improved logging and matching';
COMMENT ON FUNCTION public.trigger_find_matches_for_card() IS 'Trigger function to find matches after card insertion';
