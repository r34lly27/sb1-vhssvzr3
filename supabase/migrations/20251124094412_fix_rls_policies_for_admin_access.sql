/*
  # Fix RLS Policies for Admin Access

  ## Issues Being Fixed
  
  1. Admin users cannot properly manage students due to restrictive RLS
  2. Admin users need full access to students table for CRUD operations
  3. Students table needs proper policies for admin INSERT operations
  4. Admin registration policy needs to be more restrictive

  ## Changes
  
  1. **admin_users table:**
     - Remove overly permissive public INSERT policy
     - Add proper admin INSERT policy for authenticated users
     - Add policy for admins to view all admin records
  
  2. **students table:**
     - Add policy for admins to INSERT students (bulk upload)
     - Add policy for admins to UPDATE students
     - Add policy for admins to DELETE students
     - Keep existing SELECT policy for authenticated users
  
  3. Security Notes
     - Only authenticated users can create admin accounts
     - Admins can manage all students
     - Students can only view their own data
     - All admin operations require valid admin_users record
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow self registration for admin_users" ON admin_users;
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Users can insert own profile" ON students;

-- Admin Users Table Policies
CREATE POLICY "Admins can view all admin users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can register as admin"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Students Table Policies (Add admin management capabilities)
CREATE POLICY "Admins can insert students"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Students can insert own profile"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update students"
  ON students
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Students can update own profile"
  ON students
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can delete students"
  ON students
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
