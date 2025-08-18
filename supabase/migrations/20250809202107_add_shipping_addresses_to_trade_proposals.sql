-- Create a new migration file, e.g., 20240809132000_add_shipping_addresses_to_trade_proposals.sql

-- Add the new columns
ALTER TABLE trade_proposals
ADD COLUMN IF NOT EXISTS proposer_address_id UUID REFERENCES shipping_preferences(id),
ADD COLUMN IF NOT EXISTS recipient_address_id UUID REFERENCES shipping_preferences(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trade_proposals_proposer_address ON trade_proposals(proposer_address_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_recipient_address ON trade_proposals(recipient_address_id);

-- Add comments for documentation
COMMENT ON COLUMN trade_proposals.proposer_address_id IS 'References the shipping_preferences.id for the proposer''s shipping address';
COMMENT ON COLUMN trade_proposals.recipient_address_id IS 'References the shipping_preferences.id for the recipient''s shipping address';