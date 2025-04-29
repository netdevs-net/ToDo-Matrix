/*
  # Add Todo Table Constraints

  1. Changes
    - Add default values for common fields
    - Add quadrant type check constraint
    - Add created_at timestamp default
    - Add foreign key constraint for created_by

  2. Validation
    - Ensures data integrity
    - Prevents invalid quadrant values
    - Ensures proper timestamps
    - Links todos to users
*/

-- Add default values and constraints
ALTER TABLE todos
  ALTER COLUMN completed SET DEFAULT false,
  ALTER COLUMN time_spent SET DEFAULT 0,
  ALTER COLUMN archived SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ADD CONSTRAINT todos_quadrant_check CHECK (
    quadrant IN (
      'urgentImportant',
      'importantNotUrgent', 
      'urgentNotImportant',
      'notUrgentNotImportant'
    )
  );

-- Ensure created_by is required and linked to users
ALTER TABLE todos
  ALTER COLUMN created_by SET NOT NULL,
  ADD CONSTRAINT todos_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);
CREATE INDEX IF NOT EXISTS idx_todos_quadrant ON todos(quadrant);