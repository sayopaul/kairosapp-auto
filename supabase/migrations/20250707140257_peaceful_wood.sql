/*
  # Auto-Matching System for Trading Cards

  1. Functions
    - calculate_match_score() - Calculates compatibility scores between cards
    - cards_match() - Fuzzy matching for card names
    - find_matches_for_card() - Main matching logic for a specific card
    - regenerate_all_matches() - Manual matching trigger for existing cards

  2. Triggers
    - auto_match_trigger - Automatically runs matching when cards are inserted
*/

-- Create function to calculate match score between two cards
CREATE OR REPLACE FUNCTION calculate_match_score(
  card1_price DOUBLE PRECISION,
  card2_price DOUBLE PRECISION,
  user_tolerance INTEGER DEFAULT 80
) RETURNS INTEGER AS $$
DECLARE
  ratio DOUBLE PRECISION;
  percentage DOUBLE PRECISION;
  score INTEGER;
BEGIN
  -- Handle zero or null prices
  IF card1_price IS NULL OR card2_price IS NULL OR card1_price = 0 OR card2_price = 0 THEN
    RETURN 50;
  END IF;
  
  -- Calculate value ratio
  ratio := LEAST(card1_price, card2_price) / GREATEST(card1_price, card2_price);
  percentage := ratio * 100;
  
  -- Calculate score based on tolerance
  IF percentage >= user_tolerance THEN
    score := 100;
  ELSIF percentage >= (user_tolerance - 20) THEN
    score := 70 + ((percentage - (user_tolerance - 20)) / 20) * 30;
  ELSE
    score := GREATEST(0, percentage / (user_tolerance - 20) * 70);
  END IF;
  
  RETURN ROUND(score::NUMERIC)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if two card names match (fuzzy matching)
CREATE OR REPLACE FUNCTION cards_match(name1 TEXT, name2 TEXT) RETURNS BOOLEAN AS $$
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

-- Create function to find and create matches for a specific card
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
            match_score,
            value_difference,
            status,
            created_at
          )
          SELECT 
            new_card.user_id,
            other_user.id,
            new_card.id,
            their_trade_card.id,
            match_score,
            value_diff,
            'pending',
            NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM matches 
            WHERE (user1_id = new_card.user_id AND user2_id = other_user.id 
                   AND user1_card_id = new_card.id AND user2_card_id = their_trade_card.id)
               OR (user1_id = other_user.id AND user2_id = new_card.user_id 
                   AND user1_card_id = their_trade_card.id AND user2_card_id = new_card.id)
          );
          
          GET DIAGNOSTICS matches_created = ROW_COUNT;
          IF matches_created > 0 THEN
            matches_created := matches_created + 1;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  -- If this is a want card, look for users who have it for trade and want something we have
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
      -- Get their trade card that matches our want
      SELECT * INTO their_trade_card
      FROM cards 
      WHERE user_id = other_user.id 
        AND list_type = 'trade'
        AND cards_match(name, new_card.name)
      LIMIT 1;
      
      IF FOUND THEN
        -- Find what we have for trade that they want
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
              match_score,
              value_difference,
              status,
              created_at
            )
            SELECT 
              new_card.user_id,
              other_user.id,
              our_trade_card.id,
              their_trade_card.id,
              match_score,
              value_diff,
              'pending',
              NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM matches 
              WHERE (user1_id = new_card.user_id AND user2_id = other_user.id 
                     AND user1_card_id = our_trade_card.id AND user2_card_id = their_trade_card.id)
                 OR (user1_id = other_user.id AND user2_id = new_card.user_id 
                     AND user1_card_id = their_trade_card.id AND user2_card_id = our_trade_card.id)
            );
            
            GET DIAGNOSTICS matches_created = ROW_COUNT;
            IF matches_created > 0 THEN
              matches_created := matches_created + 1;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  
  RETURN matches_created;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function that runs after card insert
CREATE OR REPLACE FUNCTION trigger_find_matches() RETURNS TRIGGER AS $$
DECLARE
  matches_found INTEGER;
BEGIN
  -- Only process if this is a new card (INSERT operation)
  IF TG_OP = 'INSERT' THEN
    -- Find matches for the new card
    SELECT find_matches_for_card(NEW.id) INTO matches_found;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on cards table
DROP TRIGGER IF EXISTS auto_match_trigger ON cards;
CREATE TRIGGER auto_match_trigger
  AFTER INSERT ON cards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_find_matches();

-- Create function to manually trigger matching for existing cards (utility function)
CREATE OR REPLACE FUNCTION regenerate_all_matches(target_user_id UUID DEFAULT NULL) RETURNS INTEGER AS $$
DECLARE
  card_record RECORD;
  total_matches INTEGER := 0;
  matches_for_card INTEGER;
BEGIN
  -- Clear existing matches for the user (if specified) or all matches
  IF target_user_id IS NOT NULL THEN
    DELETE FROM matches WHERE user1_id = target_user_id OR user2_id = target_user_id;
  ELSE
    DELETE FROM matches;
  END IF;
  
  -- Process each card
  FOR card_record IN 
    SELECT id FROM cards 
    WHERE (target_user_id IS NULL OR user_id = target_user_id)
    ORDER BY created_at DESC
  LOOP
    SELECT find_matches_for_card(card_record.id) INTO matches_for_card;
    total_matches := total_matches + COALESCE(matches_for_card, 0);
  END LOOP;
  
  RETURN total_matches;
END;
$$ LANGUAGE plpgsql;