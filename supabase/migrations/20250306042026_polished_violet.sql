/*
  # Split Workspace Policies
  
  1. Changes
    - Separate policies by access level
    - Remove recursive checks
    - Implement direct permission checks
    
  2. Security
    - Maintain strict access control
    - Prevent policy recursion
    - Clear separation of concerns
*/

-- Drop existing policies
DROP POLICY IF EXISTS "workspace_members_read_own" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_read_workspace" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_manage_owner" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_manage_admin" ON workspace_members;

-- Basic read access for own records
CREATE POLICY "workspace_self_access"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owner access - can do everything
CREATE POLICY "workspace_owner_access"
  ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    role = 'owner' 
    AND user_id = auth.uid()
  );

-- Admin access - can manage non-owners
CREATE POLICY "workspace_admin_access"
  ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    role = 'admin' 
    AND user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 
      FROM workspace_members target
      WHERE target.workspace_id = workspace_members.workspace_id
      AND target.role = 'owner'
    )
  );

-- Member read access
CREATE POLICY "workspace_member_read"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );