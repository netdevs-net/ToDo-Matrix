/*
  # Complete Database Permissions Setup

  1. Tables and Security
    - Enable RLS on all tables
    - Set up proper foreign key relationships
    - Establish clear ownership chains

  2. Policies
    - User management
    - Workspace access control
    - Resource sharing
    - Activity logging

  3. Access Levels
    - Owner: Full control
    - Admin: Manage resources and users
    - Member: Basic access
    - Viewer: Read-only access
*/

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrant_configs ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Workspaces policies
CREATE POLICY "Members can read workspace"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage workspace"
  ON workspaces FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Members can read workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'owner'
    )
  );

CREATE POLICY "Admins can manage non-owner members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members target
      WHERE target.workspace_id = workspace_members.workspace_id
      AND target.user_id = workspace_members.user_id
      AND target.role = 'owner'
    )
  );

-- Todos policies
CREATE POLICY "Users can manage own todos"
  ON todos FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can read workspace todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read shared todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE shared_access.resource_type = 'todo'
      AND shared_access.resource_id = todos.id
      AND shared_access.user_id = auth.uid()
    )
  );

-- Categories policies
CREATE POLICY "Workspace members can read categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Shared access policies
CREATE POLICY "Resource owners can manage sharing"
  ON shared_access FOR ALL
  TO authenticated
  USING (
    CASE
      WHEN resource_type = 'todo' THEN
        EXISTS (
          SELECT 1 FROM todos
          WHERE todos.id = shared_access.resource_id
          AND todos.created_by = auth.uid()
        )
      WHEN resource_type = 'category' THEN
        EXISTS (
          SELECT 1 FROM categories
          WHERE categories.id = shared_access.resource_id
          AND categories.workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
          )
        )
      ELSE false
    END
  );

CREATE POLICY "Users can read own shared access"
  ON shared_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Comments policies
CREATE POLICY "Users can manage own comments"
  ON comments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read comments on accessible todos"
  ON comments FOR SELECT
  TO authenticated
  USING (
    todo_id IN (
      SELECT id FROM todos
      WHERE created_by = auth.uid()
      OR workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
      OR id IN (
        SELECT resource_id FROM shared_access
        WHERE resource_type = 'todo'
        AND user_id = auth.uid()
      )
    )
  );

-- Activity logs policies
CREATE POLICY "Users can read relevant activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN resource_type = 'todo' THEN
        resource_id IN (
          SELECT id FROM todos
          WHERE created_by = auth.uid()
          OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
          )
        )
      WHEN resource_type = 'workspace' THEN
        resource_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
        )
      ELSE false
    END
  );

-- Tags policies
CREATE POLICY "Workspace members can read tags"
  ON tags FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage tags"
  ON tags FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Todo tags policies
CREATE POLICY "Users can manage todo tags"
  ON todo_tags FOR ALL
  TO authenticated
  USING (
    todo_id IN (
      SELECT id FROM todos
      WHERE created_by = auth.uid()
      OR workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Todo assignments policies
CREATE POLICY "Users can manage todo assignments"
  ON todo_assignments FOR ALL
  TO authenticated
  USING (
    todo_id IN (
      SELECT id FROM todos
      WHERE created_by = auth.uid()
      OR workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Quadrant configs policies
CREATE POLICY "Users can read workspace quadrant configs"
  ON quadrant_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = quadrant_configs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage quadrant configs"
  ON quadrant_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = quadrant_configs.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );