CREATE OR REPLACE FUNCTION are_users_in_trade(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trade_proposals 
    WHERE (proposer_id = $1 AND recipient_id = $2)
       OR (proposer_id = $2 AND recipient_id = $1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;