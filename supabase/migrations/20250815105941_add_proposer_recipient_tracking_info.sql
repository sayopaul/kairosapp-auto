-- Add new columns for proposer's shipping details
ALTER TABLE trade_proposals
ADD COLUMN IF NOT EXISTS proposer_tracking_number TEXT,
ADD COLUMN IF NOT EXISTS proposer_carrier TEXT,
ADD COLUMN IF NOT EXISTS proposer_label_url TEXT;

-- Add new columns for recipient's shipping details
ALTER TABLE trade_proposals
ADD COLUMN IF NOT EXISTS recipient_tracking_number TEXT,
ADD COLUMN IF NOT EXISTS recipient_carrier TEXT,
ADD COLUMN IF NOT EXISTS recipient_label_url TEXT;

-- Add a comment to the old columns indicating they're deprecated
COMMENT ON COLUMN trade_proposals.tracking_number IS 'DEPRECATED: Use proposer_tracking_number and recipient_tracking_number instead';
COMMENT ON COLUMN trade_proposals.carrier IS 'DEPRECATED: Use proposer_carrier and recipient_carrier instead';
COMMENT ON COLUMN trade_proposals.label_url IS 'DEPRECATED: Use proposer_label_url and recipient_label_url instead';