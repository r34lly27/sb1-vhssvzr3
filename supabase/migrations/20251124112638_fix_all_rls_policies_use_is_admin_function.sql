/*
  # Fix All RLS Policies to Use is_admin Function

  ## Problem
  
  All RLS policies use `EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())`
  which creates circular dependency issues. When checking permissions, the query
  needs to access admin_users table which itself has RLS, causing the same
  circular problem we fixed earlier.
  
  ## Solution
  
  Replace all admin checks in RLS policies with the `is_admin(auth.uid())` function
  which bypasses RLS and reliably checks admin status.
  
  ## Tables Updated
  
  1. students - All admin policies
  2. courses - All admin policies  
  3. enrollments - All admin policies
  4. grades - All admin policies
  
  ## Security
  
  - Same security level maintained
  - More reliable admin checking
  - Eliminates circular dependency issues
  - Consistent with admin_users table fix
*/

-- ============================================================================
-- STUDENTS TABLE POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view permitted students" ON students;
DROP POLICY IF EXISTS "Admins can insert students" ON students;
DROP POLICY IF EXISTS "Admins can update students" ON students;
DROP POLICY IF EXISTS "Admins can delete students" ON students;

-- Recreate with is_admin function
CREATE POLICY "Authenticated users can view permitted students"
  ON students
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = id);

CREATE POLICY "Admins can insert students"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update students"
  ON students
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete students"
  ON students
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- COURSES TABLE POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins can update courses" ON courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- Recreate with is_admin function
CREATE POLICY "Admins can insert courses"
  ON courses
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update courses"
  ON courses
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete courses"
  ON courses
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- ENROLLMENTS TABLE POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins can insert enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can update enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can delete enrollments" ON enrollments;

-- Recreate with is_admin function
CREATE POLICY "Admins can insert enrollments"
  ON enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update enrollments"
  ON enrollments
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete enrollments"
  ON enrollments
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- GRADES TABLE POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view grades" ON grades;
DROP POLICY IF EXISTS "Admins can insert grades" ON grades;
DROP POLICY IF EXISTS "Admins can update grades" ON grades;

-- Recreate with is_admin function
CREATE POLICY "Authenticated users can view grades"
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE auth.uid() = id
    ) 
    OR is_admin(auth.uid())
  );

CREATE POLICY "Admins can insert grades"
  ON grades
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update grades"
  ON grades
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
