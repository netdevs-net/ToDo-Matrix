/*
  # Todos Schema

  1. Tables
    - todos
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - text (text)
      - completed (boolean)
      - quadrant (text)
      - created_at (timestamp)
      - completed_at (timestamp)
      - time_spent (bigint)
      - archived (boolean)
      - settings (jsonb)

  2. Security
    - Enable RLS
    - Add policies for todo access
*/

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  completed boolean DEFAULT false,
  quadrant text NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  time_spent bigint DEFAULT 0,
  archived boolean DEFAULT false,
  settings jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT todos_quadrant_check CHECK (quadrant IN ('urgentImportant', 'importantNotUrgent', 'urgentNotImportant', 'notUrgentNotImportant'))
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own todos"
  ON todos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read shared todos"
  ON todos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_access
      WHERE shared_access.resource_type = 'todo'
      AND shared_access.resource_id = todos.id
      AND shared_access.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_todos_user ON todos(user_id);
CREATE INDEX idx_todos_quadrant ON todos(quadrant);