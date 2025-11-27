/*
  # Add Curriculum Column to Courses

  1. Changes
    - Add `curriculum` column to `courses` table
      - Type: text
      - Purpose: To differentiate courses by academic year/curriculum version
      - Examples: "2024", "2023", "2022"
      - Allows same course code for different curriculums
    
  2. Data Migration
    - Set default curriculum "2024" for existing courses
    - This maintains backward compatibility
  
  3. Index
    - Add index on curriculum for better query performance
    
  4. Notes
    - Different angkatan can have different curriculum
    - Same course code can exist in multiple curriculums
    - Enrollment will be filtered by matching student's angkatan to curriculum
*/

-- Add curriculum column to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'curriculum'
  ) THEN
    ALTER TABLE courses ADD COLUMN curriculum text NOT NULL DEFAULT '2024';
  END IF;
END $$;

-- Update existing courses to have curriculum value
UPDATE courses 
SET curriculum = '2024'
WHERE curriculum IS NULL OR curriculum = '';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_curriculum ON courses(curriculum);

-- Create index for common query pattern (curriculum + code)
CREATE INDEX IF NOT EXISTS idx_courses_curriculum_code ON courses(curriculum, code);
