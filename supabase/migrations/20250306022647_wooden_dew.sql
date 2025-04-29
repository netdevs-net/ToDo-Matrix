/*
  # Add sharing functionality

  1. New Tables
    - `shared_access`
      - `resource_type` (text) - Type of resource being shared ('todo' or 'category')
      - `resource_id` (uuid) - ID of the shared resource
      - `user_id` (uuid) - User who has access
      - `access` (text) - Access level ('read', 'write', 'admin')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on shared_access table
    - Add policies for:
      - Users can read their own shared access
      - Resource owners can manage sharing
*/

CREATE TABLE IF NOT EXISTS shared_access (
  resource_type text NOT NULL CHECK (resource_type IN ('todo', 'category')),
  resource_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access text NOT NULL CHECK (access IN ('read', 'write', 'admin')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id, user_id)
);

ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own shared access
CREATE POLICY "Users can read own shared access"
  ON shared_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Resource owners can manage sharing
CREATE POLICY "Resource owners can manage sharing"
  ON shared_access
  FOR ALL
  TO authenticated
  USING (
    CASE
      WHEN resource_type = 'todo' THEN
        EXISTS (
          SELECT 1 FROM todos
          WHERE todos.id = resource_id
          AND todos.created_by = auth.uid()
        )
      WHEN resource_type = 'category' THEN
        EXISTS (
          SELECT 1 FROM categories
          WHERE categories.id = resource_id
          AND categories.workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
          )
        )
      ELSE false
    END
  );