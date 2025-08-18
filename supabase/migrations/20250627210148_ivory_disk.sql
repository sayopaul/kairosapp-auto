/*
  # Fix Users Table RLS Policy for Registration

  1. Security Updates
    - Update INSERT policy to allow new user registration
    - Ensure authenticated users can create their own profile during signup
    - Maintain security by only allowing users to create profiles with their own auth.uid()

  2. Changes
    - Modify existing INSERT policy to work with Supabase auth flow
    - Users can insert their own profile data when auth.uid() matches the id
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Create new INSERT policy that allows profile creation during registration
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also ensure we have proper SELECT policy for public profile viewing
DROP POLICY IF EXISTS "Users can view own profile" ON users;

CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow public read access to basic profile info for matching purposes
CREATE POLICY "Public can view basic profile info"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);