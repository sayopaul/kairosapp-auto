/*
  # Add Test Data for Matchmaking

  1. Test Data Creation
    - Create test users with diverse profiles
    - Create test cards with perfect matching scenarios
    - Ensure mutual matching opportunities exist
    
  2. Expected Matches
    - TestTrader1 Charizard ↔ TestTrader2 wants Charizard
    - TestTrader2 Pikachu ↔ TestTrader1 wants Pikachu
    - TestTrader3 Mewtwo ↔ TestTrader4 wants Mewtwo
    - TestTrader4 Machamp ↔ TestTrader3 wants Machamp
*/

-- First, clear any existing test data to avoid conflicts
DELETE FROM matches WHERE user1_id IN (
  SELECT id FROM users WHERE username LIKE 'TestTrader%'
);
DELETE FROM cards WHERE user_id IN (
  SELECT id FROM users WHERE username LIKE 'TestTrader%'
);
DELETE FROM users WHERE username LIKE 'TestTrader%';

-- Create test users with diverse profiles
INSERT INTO users (id, username, email, total_trades, match_success_rate, average_value_traded, reputation_score, shipping_preference, trade_percentage_min)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'TestTrader1', 'trader1@test.com', 15, 92, 45.50, 4.8, 'direct', 80),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'TestTrader2', 'trader2@test.com', 23, 88, 67.25, 4.6, 'direct', 85),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'TestTrader3', 'trader3@test.com', 8, 95, 32.75, 4.9, 'third-party', 75),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'TestTrader4', 'trader4@test.com', 30, 85, 120.00, 4.7, 'direct', 90),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, 'TestTrader5', 'trader5@test.com', 5, 100, 25.00, 5.0, 'local', 70);

-- Create test cards with perfect matching scenarios
INSERT INTO cards (id, user_id, name, image_url, card_number, set, condition, market_price, quantity, list_type, created_at)
VALUES 
  -- TestTrader1: High-value trader (has Charizard, wants Pikachu)
  ('660e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'Charizard', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '006', 'Base Set', 'Near Mint', 350.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'Blastoise', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '009', 'Base Set', 'Near Mint', 280.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'Pikachu', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '025', 'Base Set', 'Near Mint', 25.00, 1, 'want', now()),
  ('660e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'Venusaur', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '003', 'Base Set', 'Near Mint', 320.00, 1, 'want', now()),
  
  -- TestTrader2: Complementary trader (has Pikachu, wants Charizard)
  ('660e8400-e29b-41d4-a716-446655440005'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Pikachu', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '025', 'Base Set', 'Near Mint', 30.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440006'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Venusaur', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '003', 'Base Set', 'Near Mint', 315.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440007'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Charizard', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '006', 'Base Set', 'Near Mint', 340.00, 1, 'want', now()),
  ('660e8400-e29b-41d4-a716-446655440008'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'Blastoise', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '009', 'Base Set', 'Near Mint', 275.00, 1, 'want', now()),
  
  -- TestTrader3: Mid-tier trader (has Mewtwo, wants Machamp)
  ('660e8400-e29b-41d4-a716-446655440009'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Mewtwo', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '150', 'Base Set', 'Near Mint', 180.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440010'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Alakazam', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '065', 'Base Set', 'Near Mint', 95.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440011'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Machamp', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '068', 'Base Set', 'Near Mint', 45.00, 1, 'want', now()),
  ('660e8400-e29b-41d4-a716-446655440012'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'Raichu', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '026', 'Base Set', 'Near Mint', 85.00, 1, 'want', now()),
  
  -- TestTrader4: Premium trader (has Machamp, wants Mewtwo)
  ('660e8400-e29b-41d4-a716-446655440013'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Machamp', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '068', 'Base Set', 'Mint', 50.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440014'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Gyarados', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '130', 'Base Set', 'Near Mint', 120.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440015'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Mewtwo', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '150', 'Base Set', 'Near Mint', 175.00, 1, 'want', now()),
  ('660e8400-e29b-41d4-a716-446655440016'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'Alakazam', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '065', 'Base Set', 'Near Mint', 90.00, 1, 'want', now()),
  
  -- TestTrader5: Budget trader (has Raichu, wants Gyarados)
  ('660e8400-e29b-41d4-a716-446655440017'::uuid, '550e8400-e29b-41d4-a716-446655440005'::uuid, 'Raichu', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '026', 'Base Set', 'Lightly Played', 80.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440018'::uuid, '550e8400-e29b-41d4-a716-446655440005'::uuid, 'Nidoking', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '034', 'Base Set', 'Near Mint', 35.00, 1, 'trade', now()),
  ('660e8400-e29b-41d4-a716-446655440019'::uuid, '550e8400-e29b-41d4-a716-446655440005'::uuid, 'Gyarados', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '130', 'Base Set', 'Near Mint', 115.00, 1, 'want', now()),
  ('660e8400-e29b-41d4-a716-446655440020'::uuid, '550e8400-e29b-41d4-a716-446655440005'::uuid, 'Wartortle', 'https://images.pexels.com/photos/9820194/pexels-photo-9820194.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2', '008', 'Base Set', 'Near Mint', 15.00, 1, 'want', now());