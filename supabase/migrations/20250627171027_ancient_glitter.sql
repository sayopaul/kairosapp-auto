/*
  # Fix Row Level Security Policies

  1. Security Policies
    - Add RLS policies for `users` table to allow authenticated users to manage their own profiles
    - Add RLS policies for `cards` table to allow authenticated users to manage their own cards
    - Add RLS policies for `matches` table to allow users to view matches they're involved in
    - Add RLS policies for `messages` table to allow users in a match to send/receive messages
    - Add RLS policies for `transactions` table to allow users in a match to view transaction status

  2. Policy Details
    - Users can insert/update/select their own profile data
    - Users can insert/update/select/delete their own cards
    - Users can view matches where they are user1 or user2
    - Users can send messages in matches they're part of
    - Users can view transaction status for their matches
*/

-- Users table policies
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Cards table policies
CREATE POLICY "Users can insert own cards"
  ON cards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON cards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON cards
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Matches table policies
CREATE POLICY "Users can view their matches"
  ON matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert matches they initiate"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Users can update matches they're part of"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages table policies
CREATE POLICY "Users can view messages in their matches"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

-- Transactions table policies
CREATE POLICY "Users can view transactions for their matches"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = transactions.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert transactions for their matches"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = transactions.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update transactions for their matches"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = transactions.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = transactions.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );