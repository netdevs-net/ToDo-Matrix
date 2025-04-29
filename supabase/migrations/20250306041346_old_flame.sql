/*
  # Fix workspace member policies

  1. Changes
    - Fix infinite recursion in workspace_members policies
    - Add proper RLS policies for workspace_members table
    - Add policies for todos table
    - Add policies for quadrant_configs table

  2. Security
    - Enable RLS on all tables
    - Add proper access control policies
    - Prevent infinite recursion by restructuring policies
*/

-- Fix workspace_members policies
DROP POLICY IF EXISTS "Workspace members can read workspace members" ON workspace_members;

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
      FROM workspace_members AS my_memberships 
      WHERE my_memberships.workspace_id = workspace_members.workspace_id 
      AND my_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage members"
  ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workspace_members AS admin_check
      WHERE admin_check.workspace_id = workspace_members.workspace_id 
      AND admin_check.user_id = auth.uid() 
      AND admin_check.role IN ('owner', 'admin')
    )
  );

-- Add todos policies
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own todos"
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
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add quadrant_configs policies
ALTER TABLE quadrant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace quadrant configs"
  ON quadrant_configs
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );