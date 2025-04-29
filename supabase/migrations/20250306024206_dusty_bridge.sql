/*
  # Update RLS policies for sharing functionality

  1. Security Changes
    - Enable RLS on users and shared_access tables
    - Add policies for users table:
      - Allow authenticated users to read all users
      - Allow authenticated users to create new users
      - Allow users to update their own data
    - Add policies for shared_access table:
      - Allow resource owners to manage sharing
      - Allow users to read their own shared access
      - Allow workspace admins to manage category sharing

  2. Changes
    - Adds missing RLS policies needed for sharing functionality
    - Fixes permission issues when sharing with new users
    - Ensures proper access control for shared resources
*/

-- Enable RLS on users table if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Users table policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Users can read all users'
  ) THEN
    CREATE POLICY "Users can read all users"
      ON users
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Users can create new users'
  ) THEN
    CREATE POLICY "Users can create new users"
      ON users
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data"
      ON users
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Enable RLS on shared_access table if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'shared_access' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Shared access policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shared_access' 
    AND policyname = 'Resource owners can manage sharing'
  ) THEN
    CREATE POLICY "Resource owners can manage sharing"
      ON shared_access
      FOR ALL
      TO authenticated
      USING (
        CASE
          WHEN resource_type = 'todo' THEN (
            EXISTS (
              SELECT 1 FROM todos
              WHERE todos.id = shared_access.resource_id
              AND todos.created_by = auth.uid()
            )
          )
          WHEN resource_type = 'category' THEN (
            EXISTS (
              SELECT 1 FROM categories
              WHERE categories.id = shared_access.resource_id
              AND categories.workspace_id IN (
                SELECT workspace_members.workspace_id
                FROM workspace_members
                WHERE workspace_members.user_id = auth.uid()
                AND workspace_members.role IN ('owner', 'admin')
              )
            )
          )
          ELSE false
        END
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shared_access' 
    AND policyname = 'Users can read own shared access'
  ) THEN
    CREATE POLICY "Users can read own shared access"
      ON shared_access
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shared_access' 
    AND policyname = 'Workspace admins can manage category sharing'
  ) THEN
    CREATE POLICY "Workspace admins can manage category sharing"
      ON shared_access
      FOR ALL
      TO authenticated
      USING (
        resource_type = 'category'
        AND EXISTS (
          SELECT 1 FROM categories c
          JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
          WHERE c.id = shared_access.resource_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;