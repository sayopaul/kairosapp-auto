/*
  # Trade Confirmation Flow Schema

  1. New Tables
    - `trade_proposals` table to track the entire trade lifecycle
    - `shipping_preferences` table to store user shipping addresses
    
  2. Features
    - Trade proposal status tracking (proposed, accepted, confirmed, etc.)
    - Shipping method selection (mail vs local meetup)
    - Shipping confirmation tracking
    - Automatic status transitions via triggers
    - Prevention of duplicate proposals
    - Match status synchronization
*/

-- Create trade_proposals table if it doesn't exist
CREATE TABLE IF NOT EXISTS trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'proposed',
  shipping_method TEXT,
  proposer_confirmed BOOLEAN DEFAULT FALSE,
  recipient_confirmed BOOLEAN DEFAULT FALSE,
  proposer_shipping_confirmed BOOLEAN DEFAULT FALSE,
  recipient_shipping_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Add check constraints only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_proposal_status' AND table_name = 'trade_proposals'
  ) THEN
    ALTER TABLE trade_proposals ADD CONSTRAINT check_proposal_status 
    CHECK (status IN ('proposed', 'accepted_by_recipient', 'confirmed', 'declined', 'cancelled', 'shipping_pending', 'shipping_confirmed', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_shipping_method' AND table_name = 'trade_proposals'
  ) THEN
    ALTER TABLE trade_proposals ADD CONSTRAINT check_shipping_method
    CHECK (shipping_method IS NULL OR shipping_method IN ('mail', 'local_meetup'));
  END IF;
END $$;

-- Create indexes for trade_proposals
CREATE INDEX IF NOT EXISTS idx_trade_proposals_match_id ON trade_proposals(match_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_proposer_id ON trade_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_recipient_id ON trade_proposals(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_status ON trade_proposals(status);

-- Enable RLS on trade_proposals
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for trade_proposals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trade_proposals' AND policyname = 'Users can view their trade proposals'
  ) THEN
    CREATE POLICY "Users can view their trade proposals"
      ON trade_proposals
      FOR SELECT
      TO authenticated
      USING (auth.uid() = proposer_id OR auth.uid() = recipient_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trade_proposals' AND policyname = 'Users can insert their own trade proposals'
  ) THEN
    CREATE POLICY "Users can insert their own trade proposals"
      ON trade_proposals
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = proposer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trade_proposals' AND policyname = 'Users can update their trade proposals'
  ) THEN
    CREATE POLICY "Users can update their trade proposals"
      ON trade_proposals
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = proposer_id OR auth.uid() = recipient_id)
      WITH CHECK (auth.uid() = proposer_id OR auth.uid() = recipient_id);
  END IF;
END $$;

-- Create shipping_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS shipping_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_name TEXT NOT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  is_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Create index for shipping_preferences
CREATE INDEX IF NOT EXISTS idx_shipping_preferences_user_id ON shipping_preferences(user_id);

-- Enable RLS on shipping_preferences
ALTER TABLE shipping_preferences ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for shipping_preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shipping_preferences' AND policyname = 'Users can view their shipping preferences'
  ) THEN
    CREATE POLICY "Users can view their shipping preferences"
      ON shipping_preferences
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shipping_preferences' AND policyname = 'Users can insert their shipping preferences'
  ) THEN
    CREATE POLICY "Users can insert their shipping preferences"
      ON shipping_preferences
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shipping_preferences' AND policyname = 'Users can update their shipping preferences'
  ) THEN
    CREATE POLICY "Users can update their shipping preferences"
      ON shipping_preferences
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shipping_preferences' AND policyname = 'Users can delete their shipping preferences'
  ) THEN
    CREATE POLICY "Users can delete their shipping preferences"
      ON shipping_preferences
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add function to update trade proposal status if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_trade_proposal_status') THEN
    CREATE FUNCTION update_trade_proposal_status() RETURNS TRIGGER AS $$
    BEGIN
      -- Set updated_at timestamp
      NEW.updated_at := now();
      
      -- Auto-update status based on confirmation flags
      IF NEW.proposer_confirmed = TRUE AND NEW.recipient_confirmed = TRUE AND NEW.status = 'accepted_by_recipient' THEN
        NEW.status := 'confirmed';
      ELSIF NEW.shipping_method IS NOT NULL AND NEW.status = 'confirmed' THEN
        NEW.status := 'shipping_pending';
      ELSIF NEW.proposer_shipping_confirmed = TRUE AND NEW.recipient_shipping_confirmed = TRUE AND NEW.status = 'shipping_pending' THEN
        NEW.status := 'shipping_confirmed';
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for trade_proposals if it doesn't exist
DROP TRIGGER IF EXISTS update_trade_proposal_status_trigger ON trade_proposals;
CREATE TRIGGER update_trade_proposal_status_trigger
  BEFORE UPDATE ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_proposal_status();

-- Add function to create transaction record when trade is confirmed if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_transaction_for_confirmed_trade') THEN
    CREATE FUNCTION create_transaction_for_confirmed_trade() RETURNS TRIGGER AS $$
    BEGIN
      -- If status changed to 'confirmed', create a transaction record
      IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
        INSERT INTO transactions (
          match_id,
          user1_sent,
          user2_sent
        ) VALUES (
          NEW.match_id,
          FALSE,
          FALSE
        );
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for creating transactions if it doesn't exist
DROP TRIGGER IF EXISTS create_transaction_trigger ON trade_proposals;
CREATE TRIGGER create_transaction_trigger
  AFTER UPDATE ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_for_confirmed_trade();

-- Add function to update match status when trade proposal status changes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_match_status_from_proposal') THEN
    CREATE FUNCTION update_match_status_from_proposal() RETURNS TRIGGER AS $$
    BEGIN
      -- Update the match status based on the trade proposal status
      IF NEW.status = 'confirmed' THEN
        UPDATE matches SET status = 'accepted' WHERE id = NEW.match_id;
      ELSIF NEW.status = 'completed' THEN
        UPDATE matches SET status = 'completed' WHERE id = NEW.match_id;
      ELSIF NEW.status = 'declined' OR NEW.status = 'cancelled' THEN
        UPDATE matches SET status = 'declined' WHERE id = NEW.match_id;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for updating match status if it doesn't exist
DROP TRIGGER IF EXISTS update_match_status_trigger ON trade_proposals;
CREATE TRIGGER update_match_status_trigger
  AFTER UPDATE ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_match_status_from_proposal();

-- Add function to prevent duplicate trade proposals if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_duplicate_trade_proposals') THEN
    CREATE FUNCTION prevent_duplicate_trade_proposals() RETURNS TRIGGER AS $$
    BEGIN
      -- Check if there's already an active proposal for this match
      IF EXISTS (
        SELECT 1 FROM trade_proposals 
        WHERE match_id = NEW.match_id 
        AND status NOT IN ('declined', 'cancelled', 'completed')
      ) THEN
        RAISE EXCEPTION 'A trade proposal already exists for this match';
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger to prevent duplicate proposals if it doesn't exist
DROP TRIGGER IF EXISTS prevent_duplicate_proposals_trigger ON trade_proposals;
CREATE TRIGGER prevent_duplicate_proposals_trigger
  BEFORE INSERT ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_trade_proposals();