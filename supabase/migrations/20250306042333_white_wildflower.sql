/*
  # Fix Todos Table Schema

  1. Updates
    - Adjust column names to match snake_case convention
    - Add missing columns
    - Set appropriate defaults
    - Ensure proper types
*/

-- Drop existing todos table if it exists
DROP TABLE IF EXISTS todos CASCADE;

-- Recreate todos table with proper schema
CREATE TABLE todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  completed boolean DEFAULT false,
  quadrant text NOT NULL CHECK (
    quadrant IN (
      'urgentImportant',
      'importantNotUrgent',
      'urgentNotImportant',
      'notUrgentNotImportant'
    )
  ),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  time_spent bigint DEFAULT 0,
  last_start_time timestamptz,
  archived boolean DEFAULT false,
  due_date timestamptz,
  estimated_duration integer,
  reminder jsonb,
  category_id uuid REFERENCES categories(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  recurrence text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Recreate policies
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

-- Create updated_at trigger
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();