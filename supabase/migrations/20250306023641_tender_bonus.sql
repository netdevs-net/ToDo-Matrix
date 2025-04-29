/*
  # Add RLS policies for categories table

  1. Security
    - Enable RLS on categories table
    - Add policies for:
      - Workspace members can read categories
      - Workspace admins/owners can manage categories
      - Users can read shared categories
*/

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to read categories
CREATE POLICY "Workspace members can read categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for workspace admins/owners to manage categories
CREATE POLICY "Workspace admins can manage categories"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- Policy for users to read shared categories
CREATE POLICY "Users can read shared categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM shared_access 
      WHERE resource_type = 'category' 
      AND resource_id = categories.id 
      AND user_id = auth.uid()
    )
  );