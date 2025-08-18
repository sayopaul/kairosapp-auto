/*
  # Add Optimized Indexes for Matchmaking

  1. Performance Optimizations
    - Add specialized indexes for matchmaking queries
    - Optimize for card name searches
    - Add indexes for user reputation and preferences
    
  2. Query Performance
    - Add composite indexes for common query patterns
    - Add text pattern indexes for name matching
    - Add score-based indexes for match ranking
*/

-- Add optimized composite indexes for matchmaking performance
CREATE INDEX IF NOT EXISTS idx_cards_matchmaking_trade ON cards(list_type, name, user_id) WHERE list_type = 'trade';
CREATE INDEX IF NOT EXISTS idx_cards_matchmaking_want ON cards(list_type, name, user_id) WHERE list_type = 'want';
CREATE INDEX IF NOT EXISTS idx_cards_user_list_name ON cards(user_id, list_type, name);
CREATE INDEX IF NOT EXISTS idx_cards_market_price ON cards(market_price) WHERE market_price > 0;
CREATE INDEX IF NOT EXISTS idx_cards_name_search ON cards(name text_pattern_ops);

-- Add indexes for user reputation and trading history
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score, total_trades);
CREATE INDEX IF NOT EXISTS idx_users_trade_settings ON users(trade_percentage_min, shipping_preference);

-- Ensure matches table has optimal indexes for queries
CREATE INDEX IF NOT EXISTS idx_matches_comprehensive ON matches(user1_id, user2_id, status, match_score);
CREATE INDEX IF NOT EXISTS idx_matches_cards ON matches(user1_card_id, user2_card_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(match_score DESC) WHERE status = 'pending';