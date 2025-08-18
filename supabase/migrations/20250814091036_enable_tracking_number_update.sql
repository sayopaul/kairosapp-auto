-- Drop the existing trigger
DROP TRIGGER IF EXISTS validate_trade_proposal_update_trigger ON trade_proposals;

-- Update the trigger function to allow tracking number updates
CREATE OR REPLACE FUNCTION validate_trade_proposal_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow updating status to specific values
  IF NEW.status IS DISTINCT FROM OLD.status AND 
     NEW.status NOT IN ('shipping_pending', 'shipping_confirmed', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'Invalid status update';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER validate_trade_proposal_update_trigger
BEFORE UPDATE ON trade_proposals
FOR EACH ROW
EXECUTE FUNCTION validate_trade_proposal_update();