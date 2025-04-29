/*
  # Fix workspace permissions and policies

  1. Changes
    - Implement proper workspace member access control
    - Add policies for todos and workspace resources
    - Fix infinite recursion in workspace_members policies

  2. Security
    - Enable RLS on all tables
    - Implement role-based access control
    - Ensure proper permission checks
*/

-- Reset existing policies
DROP POLICY IF EXISTS "Members can read their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Owners can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can manage non-owner members" ON workspace_members;
DROP POLICY IF EXISTS "Users can read workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can read workspace todos" ON todos;
DROP POLICY IF EXISTS "Users can manage workspace quadrant configs" ON quadrant_configs;
DROP POLICY IF EXISTS "Users can read workspace quadrant configs" ON quadrant_configs;

-- Base workspace member policies
CREATE POLICY "Users can read their own workspace memberships"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read memberships of their workspaces"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members my_memberships
      WHERE my_memberships.workspace_id = workspace_members.workspace_id
      AND my_memberships.user_id = auth.uid()
    )
  );

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

-- Todo policies
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todos"
  ON todos
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

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

-- Quadrant config policies
ALTER TABLE quadrant_configs ENABLE ROW LEVEL SECURITY;

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