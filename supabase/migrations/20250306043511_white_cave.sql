/*
  # Fix workspace policies and data recording

  1. Changes
    - Remove duplicate workspace_members policies
    - Add proper workspace member policies
    - Add missing columns for data recording
    - Add proper indexes for performance

  2. Security
    - Ensure proper RLS policies for workspace members
    - Maintain data access control
*/

-- First remove the duplicate policy
DROP POLICY IF EXISTS "Users can read their own workspace memberships" ON workspace_members;

-- Add proper workspace member policies
CREATE POLICY "workspace_members_read_own" ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "workspace_members_read_workspace" ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add missing columns for proper data recording
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS time_spent bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_todos_time_tracking ON todos(last_start_time) WHERE last_start_time IS NOT NULL;