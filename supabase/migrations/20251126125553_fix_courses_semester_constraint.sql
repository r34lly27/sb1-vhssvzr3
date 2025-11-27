/*
  # Fix courses semester constraint

  1. Changes
    - Drop existing semester check constraint (1-2 only)
    - Add new semester check constraint (1-8)
    
  2. Reason
    - Allow semesters 1-8 for better academic tracking
    - Semester 1,3,5,7 = Ganjil (Gasal)
    - Semester 2,4,6,8 = Genap
*/

-- Drop old constraint
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_semester_check;

-- Add new constraint allowing semester 1-8
ALTER TABLE courses ADD CONSTRAINT courses_semester_check 
  CHECK (semester >= 1 AND semester <= 8);
