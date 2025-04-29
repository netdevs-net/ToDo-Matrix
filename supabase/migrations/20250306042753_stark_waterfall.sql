/*
  # Revert todos table changes
  
  1. Changes
    - Drop existing todos table
    - Recreate todos table with original schema
    - Restore original RLS policies
*/

-- Drop the existing todos table and all its dependencies
DROP TABLE IF EXISTS todos CASCADE;

-- Recreate the todos table with original schema
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
  archived boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Users can manage their own todos"
  ON todos FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();