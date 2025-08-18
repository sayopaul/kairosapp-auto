-- Add tracking_number and carrier columns to trade_proposals
ALTER TABLE trade_proposals
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS label_url TEXT;

-- Drop the existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their trade proposals" ON trade_proposals;

-- Create a simpler update policy that allows updating specific fields
CREATE POLICY "Users can update their trade proposals"
ON trade_proposals
FOR UPDATE
TO authenticated
USING (
  auth.uid() = proposer_id OR
  auth.uid() = recipient_id
)
WITH CHECK (true);  -- Allow all updates that pass the USING clause

-- Create a trigger function to validate updates
CREATE OR REPLACE FUNCTION validate_trade_proposal_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow updating status to specific values
  IF NEW.status IS DISTINCT FROM OLD.status AND 
     NEW.status NOT IN ('shipping_pending', 'shipping_confirmed') THEN
    RAISE EXCEPTION 'Invalid status update';
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

-- Create the trigger
DROP TRIGGER IF EXISTS validate_trade_proposal_update_trigger ON trade_proposals;
CREATE TRIGGER validate_trade_proposal_update_trigger
BEFORE UPDATE ON trade_proposals
FOR EACH ROW
EXECUTE FUNCTION validate_trade_proposal_update();