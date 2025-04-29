/*
  # Initial Schema Setup for ToDo Matrix

  1. Tables
    - users
    - workspaces
    - workspace_members
    - todos
    - comments
    - tags
    - categories
    - activity_logs
    - quadrant_configs
    - shared_access

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES users(id) NOT NULL,
  settings jsonb NOT NULL DEFAULT '{
    "defaultQuadrantAccess": "private",
    "allowGuestAccess": false,
    "enableComments": true,
    "enableTimeTracking": true,
    "enableTags": true,
    "enableCategories": true,
    "enableReminders": true
  }',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workspace members table
CREATE TABLE workspace_members (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Categories table
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  color text NOT NULL,
  parent_id uuid REFERENCES categories(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tags table
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  color text NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (name, workspace_id)
);

-- Todos table
CREATE TABLE todos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  text text NOT NULL,
  completed boolean DEFAULT false,
  quadrant text NOT NULL CHECK (quadrant IN ('urgentImportant', 'importantNotUrgent', 'urgentNotImportant', 'notUrgentNotImportant')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  time_spent bigint DEFAULT 0,
  last_start_time timestamptz,
  archived boolean DEFAULT false,
  due_date timestamptz,
  estimated_duration integer, -- in minutes
  reminder jsonb,
  category_id uuid REFERENCES categories(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  recurrence text, -- RRULE string
  updated_at timestamptz DEFAULT now()
);

-- Todo tags junction table
CREATE TABLE todo_tags (
  todo_id uuid REFERENCES todos(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- Todo assignments table
CREATE TABLE todo_assignments (
  todo_id uuid REFERENCES todos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES users(id),
  PRIMARY KEY (todo_id, user_id)
);

-- Comments table
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  todo_id uuid REFERENCES todos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz,
  mentions jsonb DEFAULT '[]'
);

-- Activity logs table
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  timestamp timestamptz DEFAULT now()
);

-- Quadrant configurations table
CREATE TABLE quadrant_configs (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  bg_color text NOT NULL,
  border_color text NOT NULL,
  custom_color text,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Shared access table
CREATE TABLE shared_access (
  resource_type text NOT NULL CHECK (resource_type IN ('todo', 'quadrant')),
  resource_id uuid NOT NULL,
  user_id uuid REFERENCES users(id),
  access text NOT NULL CHECK (access IN ('read', 'write', 'admin')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadrant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Workspace members can read workspace"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can read workspace members"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read accessible todos"
  ON todos
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM shared_access
      WHERE resource_type = 'todo'
      AND resource_id = id
      AND user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_todos_workspace ON todos(workspace_id);
CREATE INDEX idx_todos_category ON todos(category_id);
CREATE INDEX idx_todo_tags_todo ON todo_tags(todo_id);
CREATE INDEX idx_todo_tags_tag ON todo_tags(tag_id);
CREATE INDEX idx_comments_todo ON comments(todo_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_categories_workspace ON categories(workspace_id);
CREATE INDEX idx_tags_workspace ON tags(workspace_id);

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_quadrant_configs_updated_at
  BEFORE UPDATE ON quadrant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();