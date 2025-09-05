-- Fix trade proposal status override issue
-- The trigger function was overriding manual status updates to shipping_confirmed
-- This migration updates the trigger to be more specific about when to auto-update status

-- Update the function that updates trade proposal status
CREATE OR REPLACE FUNCTION update_trade_proposal_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If both users have confirmed shipping, mark as completed
  IF NEW.proposer_shipping_confirmed = true AND NEW.recipient_shipping_confirmed = true THEN
    NEW.status = 'completed';
    NEW.completed_at = now();
  -- If both users have confirmed the trade but not shipping, mark as shipping_pending
  -- Only do this if the status is not already a shipping-related status
  ELSIF NEW.proposer_confirmed = true AND NEW.recipient_confirmed = true 
        AND NEW.status NOT IN ('completed', 'shipping_pending', 'shipping_confirmed', 'shipped', 'delivered') THEN
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