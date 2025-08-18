CREATE POLICY "Users can view their trade partner's shipping preferences"
ON shipping_preferences
FOR SELECT
USING (
  -- User owns the preference
  (auth.uid() = user_id) OR
  -- Or is in an active trade with the preference owner
  (are_users_in_trade(auth.uid(), user_id))
);

CREATE POLICY "Users can update their shipping preferences"
ON shipping_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their shipping preferences"
ON shipping_preferences
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their shipping preferences"
ON shipping_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);