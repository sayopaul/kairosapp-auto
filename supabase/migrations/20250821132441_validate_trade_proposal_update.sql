-- Update the validation trigger to allow all valid status transitions
CREATE OR REPLACE FUNCTION validate_trade_proposal_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate status updates if the status is actually changing
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allow all status values that are defined in the table schema
    IF NEW.status NOT IN ('proposed', 'accepted_by_recipient', 'confirmed', 'declined', 'cancelled', 'shipping_pending', 'shipping_confirmed', 'completed') THEN
      RAISE EXCEPTION 'Invalid status update: % is not a valid status', NEW.status;
    END IF;
  END IF;
  
  -- Don't allow updating non-null tracking fields once they're set
  IF OLD.tracking_number IS NOT NULL AND 
     NEW.tracking_number IS DISTINCT FROM OLD.tracking_number THEN
    RAISE EXCEPTION 'Tracking number cannot be modified once set';
  END IF;
  
  IF OLD.carrier IS NOT NULL AND 
     NEW.carrier IS DISTINCT FROM OLD.carrier THEN
    RAISE EXCEPTION 'Carrier cannot be modified once set';
  END IF;
  
  IF OLD.label_url IS NOT NULL AND 
     NEW.label_url IS DISTINCT FROM OLD.label_url THEN
    RAISE EXCEPTION 'Label URL cannot be modified once set';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger is already created, so no need to recreate it
-- CREATE TRIGGER validate_trade_proposal_update_trigger
-- BEFORE UPDATE ON trade_proposals
-- FOR EACH ROW
-- EXECUTE FUNCTION validate_trade_proposal_update();