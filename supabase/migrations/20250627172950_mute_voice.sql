/*
  # Add foreign key constraints to matches table

  1. Foreign Key Constraints
    - Add foreign key constraint from matches.user1_id to users.id
    - Add foreign key constraint from matches.user2_id to users.id  
    - Add foreign key constraint from matches.user1_card_id to cards.id
    - Add foreign key constraint from matches.user2_card_id to cards.id

  2. Security
    - No changes to existing RLS policies
    
  These constraints will enable proper joins in Supabase queries and ensure data integrity.
*/

-- Add foreign key constraint for user1_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_user1_id_fkey' 
    AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_user1_id_fkey 
    FOREIGN KEY (user1_id) REFERENCES users(id);
  END IF;
END $$;

-- Add foreign key constraint for user2_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_user2_id_fkey' 
    AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_user2_id_fkey 
    FOREIGN KEY (user2_id) REFERENCES users(id);
  END IF;
END $$;

-- Add foreign key constraint for user1_card_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_user1_card_id_fkey' 
    AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_user1_card_id_fkey 
    FOREIGN KEY (user1_card_id) REFERENCES cards(id);
  END IF;
END $$;

-- Add foreign key constraint for user2_card_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_user2_card_id_fkey' 
    AND table_name = 'matches'
  ) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_user2_card_id_fkey 
    FOREIGN KEY (user2_card_id) REFERENCES cards(id);
  END IF;
END $$;