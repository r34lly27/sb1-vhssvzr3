/*
  # Fix Students Table RLS Policies

  ## Changes
  
  1. Security Fix - Multiple Permissive Policies
    - Drop existing permissive SELECT policies
    - Create a single combined SELECT policy that handles both admin and student access
    - This eliminates the security warning about multiple permissive policies
  
  2. Policy Logic
    - Admins: Can view all students (checked via admin_users table)
    - Students: Can only view their own profile (checked via auth.uid())
    - Combined into one policy using OR condition
  
  ## Important Notes
  - Using a single PERMISSIVE policy is more secure and efficient
  - The policy maintains the same access control as before
  - No data access changes for users
*/

-- Drop the existing permissive SELECT policies
DROP POLICY IF EXISTS "Admins can view all students" ON students;
DROP POLICY IF EXISTS "Students can view own profile" ON students;

-- Create a single combined SELECT policy for both admins and students
CREATE POLICY "Authenticated users can view permitted students"
  ON students
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is an admin
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
    OR
    -- Allow if user is viewing their own profile
    auth.uid() = id
  );
