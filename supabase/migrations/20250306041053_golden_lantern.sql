/*
  # Update Todos Schema

  1. Changes
    - Add created_by column to todos table
    - Add foreign key constraint to users table
    - Update RLS policies to use created_by for ownership checks

  2. Security
    - Maintain existing RLS policies
    - Add new policy for created_by checks
*/

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'todos' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE todos 
    ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can manage own todos" ON todos;
CREATE POLICY "Users can manage own todos"
  ON todos
  FOR ALL
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);

-- Update existing todos to set created_by if null
UPDATE todos 
SET created_by = auth.uid()
WHERE created_by IS NULL;