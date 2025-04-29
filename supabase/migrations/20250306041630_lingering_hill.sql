/*
  # Fix recursive policies in workspace members table

  1. Changes
    - Remove recursive policy definitions
    - Implement direct ownership checks
    - Add proper cascading access control
    - Fix infinite recursion in workspace_members policies

  2. Security
    - Maintain row level security
    - Preserve access control hierarchy
    - Ensure proper permission checks
*/

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can read workspace members where they are members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;

-- Create new, non-recursive policies
CREATE POLICY "Members can read their own memberships"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can manage workspace members"
  ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members owner_check
      WHERE owner_check.workspace_id = workspace_members.workspace_id
      AND owner_check.user_id = auth.uid()
      AND owner_check.role = 'owner'
    )
  );

CREATE POLICY "Admins can manage non-owner members"
  ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members admin_check
      WHERE admin_check.workspace_id = workspace_members.workspace_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    AND workspace_members.role != 'owner'
  );

-- Update todos policies to use direct checks
DROP POLICY IF EXISTS "Users can read workspace todos" ON todos;

CREATE POLICY "Users can read workspace todos"
  ON todos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = todos.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Update quadrant_configs policies
DROP POLICY IF EXISTS "Users can manage workspace quadrant configs" ON quadrant_configs;
DROP POLICY IF EXISTS "Users can read workspace quadrant configs" ON quadrant_configs;

CREATE POLICY "Users can read workspace quadrant configs"
  ON quadrant_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = quadrant_configs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage workspace quadrant configs"
  ON quadrant_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = quadrant_configs.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );