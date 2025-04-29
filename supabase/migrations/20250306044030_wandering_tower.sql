/*
  # Fix workspace policies

  1. Changes
    - Remove duplicate workspace_members policies
    - Add proper workspace member policies
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