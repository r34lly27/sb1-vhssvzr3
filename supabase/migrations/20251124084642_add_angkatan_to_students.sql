/*
  # Add Angkatan (Year) to Students Table

  ## Changes
  
  1. New Column
    - `angkatan` (text) - Student's enrollment year/batch
    - NOT NULL with default value '2024'
    - Represents the year the student enrolled (e.g., '2020', '2021', '2022')
  
  2. Purpose
    - Track which academic year/batch each student belongs to
    - Useful for reporting, filtering, and academic management
    - Required field for both manual and bulk student registration
  
  ## Important Notes
  - Existing students will have default angkatan '2024'
  - Can be updated manually after migration if needed
  - Format is flexible (can be '2024', '2024/2025', etc.)
*/

-- Add angkatan column to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'angkatan'
  ) THEN
    ALTER TABLE students ADD COLUMN angkatan text NOT NULL DEFAULT '2024';
  END IF;
END $$;
