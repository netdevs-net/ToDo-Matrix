/*
  # Update users table RLS policies

  1. Security Changes
    - Enable RLS on users table
    - Add policy for authenticated users to read all users (needed for sharing)
    - Add policy for authenticated users to create new users (needed for sharing)
    - Add policy for users to update their own data
*/

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for reading users (needed for sharing functionality)
CREATE POLICY "Users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for creating new users (needed for sharing with new users)
CREATE POLICY "Users can create new users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);