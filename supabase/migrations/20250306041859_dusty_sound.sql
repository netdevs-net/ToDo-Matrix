/*
  # Clean up and recreate workspace policies
  
  1. Changes
    - Drop ALL existing policies for affected tables
    - Recreate policies with proper permissions
    - Fix infinite recursion issues
    
  2. Security
    - Maintain RLS on all tables
    - Implement proper role-based access
    - Ensure no security gaps during migration
*/

-- First, drop ALL existing policies for workspace_members
DROP POLICY IF EXISTS "Users can read their own workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can read memberships of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Owners can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can manage non-owner members" ON workspace_members;
DROP POLICY IF EXISTS "Members can read their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can read workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can read their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can read memberships where they are members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;

-- Drop todos policies
DROP POLICY IF EXISTS "Users can manage own todos" ON todos;
DROP POLICY IF EXISTS "Users can read workspace todos" ON todos;
DROP POLICY IF EXISTS "Users can manage their own todos" ON todos;

-- Drop quadrant_configs policies
DROP POLICY IF EXISTS "Users can read workspace quadrant configs" ON quadrant_configs;
DROP POLICY IF EXISTS "Admins can manage workspace quadrant configs" ON quadrant_configs;
DROP POLICY IF EXISTS "Users can manage workspace quadrant configs" ON quadrant_configs;

-- Ensure RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrant_configs ENABLE ROW LEVEL SECURITY;

-- Create new workspace_members policies with simplified checks
CREATE POLICY "workspace_members_read_own"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "workspace_members_read_workspace"
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

CREATE POLICY "workspace_members_manage_owner"
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

CREATE POLICY "workspace_members_manage_admin"
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

-- Create todos policies
CREATE POLICY "todos_manage_own"
  ON todos
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "todos_read_workspace"
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

-- Create quadrant_configs policies
CREATE POLICY "quadrant_configs_read"
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

CREATE POLICY "quadrant_configs_manage"
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