/*
  # Update trade proposal completion trigger

  1. Function Updates
    - Modify the trade proposal status update function to handle completion
    - Set status to 'completed' when both users confirm shipping
    - Set completed_at timestamp when trade is completed

  2. Logic
    - Check if both proposer_shipping_confirmed and recipient_shipping_confirmed are true
    - If so, update status to 'completed' and set completed_at timestamp
*/

-- Create or replace the function that updates trade proposal status
CREATE OR REPLACE FUNCTION update_trade_proposal_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If both users have confirmed shipping, mark as completed
  IF NEW.proposer_shipping_confirmed = true AND NEW.recipient_shipping_confirmed = true THEN
    NEW.status = 'completed';
    NEW.completed_at = now();
  -- If both users have confirmed the trade but not shipping, mark as shipping_pending
  ELSIF NEW.proposer_confirmed = true AND NEW.recipient_confirmed = true AND NEW.status != 'completed' THEN
    NEW.status = 'shipping_pending';
  -- If recipient has accepted but proposer hasn't confirmed, mark as accepted_by_recipient
  ELSIF NEW.recipient_confirmed = true AND NEW.proposer_confirmed = false AND NEW.status = 'proposed' THEN
    NEW.status = 'accepted_by_recipient';
  -- If proposer has confirmed after recipient acceptance, mark as confirmed
  ELSIF NEW.proposer_confirmed = true AND NEW.recipient_confirmed = true AND OLD.status = 'accepted_by_recipient' THEN
    NEW.status = 'confirmed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS update_trade_proposal_status_trigger ON trade_proposals;
CREATE TRIGGER update_trade_proposal_status_trigger
  BEFORE UPDATE ON trade_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_proposal_status();