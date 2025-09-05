DROP POLICY IF EXISTS "Users can delete their own matches" ON matches;
CREATE POLICY "Users can delete their own matches"
    ON matches
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);