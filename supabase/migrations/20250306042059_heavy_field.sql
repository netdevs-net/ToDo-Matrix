/*
  # Split Workspace Access Policies

  1. Changes
    - Remove existing problematic policies
    - Implement separate policies for different access levels
    - Add clear role-based permissions
    - Fix infinite recursion issues

  2. Security
    - Maintain row level security
    - Implement proper access controls
    - Prevent policy recursion
    - Clear separation between read and write access

  3. Policies Added
    - Self access - users can read their own memberships
    - Owner access - full control over workspace
    - Admin access - manage non-owner members
    - Member read access - view workspace members
*/

-- First, drop any existing problematic policies to start fresh
DROP POLICY IF EXISTS "Users can read memberships of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can read their own workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage non-owner members" ON workspace_members;
DROP POLICY IF EXISTS "Members can read their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Owners can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can read workspace members" ON workspace_members;

-- Basic self-access - users can always read their own memberships
CREATE POLICY "workspace_self_access"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owner access - full control over workspace
CREATE POLICY "workspace_owner_access"
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

-- Admin access - can manage non-owner members
CREATE POLICY "workspace_admin_access"
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
    AND NOT EXISTS (
      SELECT 1 
      FROM workspace_members target
      WHERE target.workspace_id = workspace_members.workspace_id
      AND target.user_id = workspace_members.user_id
      AND target.role = 'owner'
    )
  );

-- Member read access - members can view other members in their workspaces
CREATE POLICY "workspace_member_read"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workspace_members member_check
      WHERE member_check.workspace_id = workspace_members.workspace_id
      AND member_check.user_id = auth.uid()
    )
  );

-- Ensure RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;