-- First, let's add a function to find card combinations
CREATE OR REPLACE FUNCTION find_card_combinations(
  p_user_id UUID,
  p_target_value DOUBLE PRECISION,
  p_tolerance_percent DOUBLE PRECISION
) 
RETURNS TABLE(
  card_ids UUID[],
  total_value DOUBLE PRECISION
) AS $$
DECLARE
  v_min_value DOUBLE PRECISION;
  v_max_value DOUBLE PRECISION;
BEGIN
  v_min_value := p_target_value * (1 - p_tolerance_percent/100);
  v_max_value := p_target_value * (1 + p_tolerance_percent/100);
  
 -- In the find_card_combinations function, modify the RETURN QUERY part:

RETURN QUERY
WITH RECURSIVE card_combinations AS (
  -- Base case: single cards
  SELECT 
    ARRAY[c.id] AS card_ids,
    COALESCE(c.market_price, 0) AS total_value,
    1 AS depth
  FROM cards c
  WHERE c.user_id = p_user_id 
    AND c.list_type = 'trade'
    AND COALESCE(c.market_price, 0) <= v_max_value
  
  UNION ALL
  
  -- Recursive case: add another card to existing combinations
  SELECT 
    (cc.card_ids || c.id) AS card_ids,
    (cc.total_value + COALESCE(c.market_price, 0)) AS total_value,
    cc.depth + 1 AS depth
  FROM card_combinations cc
  JOIN LATERAL (
    SELECT c.id, c.market_price 
    FROM cards c 
    WHERE c.user_id = p_user_id 
      AND c.list_type = 'trade'
      AND c.id > cc.card_ids[array_length(cc.card_ids, 1)]  -- Avoid duplicate combinations
      AND c.id <> ALL(cc.card_ids)  -- Don't use the same card twice
      AND (cc.total_value + COALESCE(c.market_price, 0)) <= v_max_value
      AND cc.depth < 4  -- Limit combinations to at most 4 cards
    ORDER BY ABS(p_target_value - (cc.total_value + COALESCE(c.market_price, 0))) ASC
    LIMIT 5  -- Consider only the 5 best matches at each step
  ) c ON true
)
SELECT 
  cc.card_ids,  -- Explicitly use the alias
  cc.total_value  -- Explicitly use the alias
FROM card_combinations cc  -- Add alias here
WHERE cc.total_value BETWEEN v_min_value AND v_max_value  -- Use alias
ORDER BY ABS(cc.total_value - p_target_value) ASC  -- Use alias
LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Now modify the main function
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
  is_bundle BOOLEAN;
  card_combination RECORD;
  target_value DOUBLE PRECISION;
  card_ids UUID[];
  card_id UUID;
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
      -- First try bundle trades where our single card matches multiple of their cards
      target_value := COALESCE(new_card.market_price, 0);
      FOR card_combination IN
        SELECT fc.card_ids AS card_ids, fc.total_value AS total_value
        FROM find_card_combinations(
          other_user.id,
          target_value,
          user_tolerance
        ) fc
      LOOP
        -- Check if we want all cards in this combination
        IF EXISTS (
          SELECT 1 
          FROM unnest(card_combination.card_ids) AS unnested_id(card_id)
          WHERE NOT EXISTS (
            SELECT 1 
            FROM cards c
            JOIN cards our_wants ON cards_match(our_wants.name, c.name)
            WHERE c.id = unnested_id.card_id
              AND our_wants.user_id = new_card.user_id
              AND our_wants.list_type = 'want'
          )
        ) THEN
          CONTINUE;  -- Skip if we don't want all cards in this combination
        END IF;
        
        -- Calculate match score for bundle trade
        match_score := calculate_match_score(
          target_value,
          card_combination.total_value,
          user_tolerance
        );
        
        IF match_score >= 60 THEN
          value_diff := ABS(target_value - card_combination.total_value);
          is_bundle := TRUE;  -- Force this to be true since we know it's a bundle
          
          -- Insert the bundle match
          PERFORM create_match(
            new_card.user_id,
            other_user.id,
            ARRAY[new_card.id],
            card_combination.card_ids,
            match_score,
            value_diff,
            is_bundle
          );
          
          GET DIAGNOSTICS matches_created = ROW_COUNT;
        END IF;
      END LOOP;

      -- Then try 1:1 matches if no bundle match was found
      IF matches_created = 0 THEN
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
          -- Calculate match score for 1:1 trade
          match_score := calculate_match_score(
            COALESCE(new_card.market_price, 0)::DOUBLE PRECISION, 
            COALESCE(their_trade_card.market_price, 0)::DOUBLE PRECISION, 
            user_tolerance
          );
          
          IF match_score >= 60 THEN
            value_diff := ABS(COALESCE(new_card.market_price, 0) - COALESCE(their_trade_card.market_price, 0));
            is_bundle := FALSE;
            
            -- Insert the 1:1 match
            PERFORM create_match(
              new_card.user_id,
              other_user.id,
              ARRAY[new_card.id],
              ARRAY[their_trade_card.id],
              match_score,
              value_diff,
              is_bundle
            );
            
            GET DIAGNOSTICS matches_created = ROW_COUNT;
          END IF;
        END LOOP;
      END IF;
      
      -- Now try bundle trades (multiple cards for one card)
      target_value := COALESCE(new_card.market_price, 0);
      
      -- Find combinations of our cards that match the value of their card
      FOR card_combination IN
        SELECT fc.card_ids AS card_ids, fc.total_value AS total_value
        FROM find_card_combinations(
          other_user.id,
          target_value,
          user_tolerance
        ) fc
      LOOP
        -- Check if we want all cards in this combination
        IF EXISTS (
          SELECT 1 
          FROM unnest(card_combination.card_ids) AS unnested_id(card_id)
          WHERE NOT EXISTS (
            SELECT 1 
            FROM cards c
            JOIN cards our_wants ON cards_match(our_wants.name, c.name)
            WHERE c.id = unnested_id.card_id
              AND our_wants.user_id = new_card.user_id
              AND our_wants.list_type = 'want'
          )
        ) THEN
          CONTINUE;  -- Skip if we don't want all cards in this combination
        END IF;
        
        -- Calculate match score for bundle trade
        match_score := calculate_match_score(
          target_value,
          card_combination.total_value,
          user_tolerance
        );
        
        IF match_score >= 60 THEN
          value_diff := ABS(target_value - card_combination.total_value);
          is_bundle := array_length(card_combination.card_ids, 1) > 1;
          
          -- Insert the bundle match
          PERFORM create_match(
            new_card.user_id,
            other_user.id,
            ARRAY[new_card.id],
            card_combination.card_ids,
            match_score,
            value_diff,
            is_bundle
          );
          
          GET DIAGNOSTICS matches_created = ROW_COUNT;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  -- Similar logic for want cards (reversed)
  -- [Previous logic for want cards goes here, updated similarly]
  
  RETURN matches_created;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create matches
CREATE OR REPLACE FUNCTION create_match(
  p_user1_id UUID,
  p_user2_id UUID,
  p_user1_card_ids UUID[],
  p_user2_card_ids UUID[],
  p_match_score INTEGER,
  p_value_diff DOUBLE PRECISION,
  p_is_bundle BOOLEAN
) RETURNS VOID AS $$
BEGIN
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
    p_user1_id,
    p_user2_id,
    p_user1_card_ids[1],  -- For backward compatibility
    p_user2_card_ids[1],  -- For backward compatibility
    p_user1_card_ids,
    p_user2_card_ids,
    p_match_score,
    p_value_diff,
    'pending',
    NOW(),
    p_is_bundle
  WHERE NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE (user1_id = p_user1_id AND user2_id = p_user2_id 
           AND user1_card_ids @> p_user1_card_ids 
           AND user2_card_ids @> p_user2_card_ids)
       OR (user1_id = p_user2_id AND user2_id = p_user1_id
           AND user1_card_ids @> p_user2_card_ids
           AND user2_card_ids @> p_user1_card_ids)
  );
END;
$$ LANGUAGE plpgsql;