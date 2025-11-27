/*
  # Fix Admin Users RLS Circular Dependency

  ## Problem
  
  The current RLS policy on admin_users creates a circular dependency:
  - To check if a user is admin, we query admin_users table
  - But the SELECT policy only allows access if user is already in admin_users
  - This prevents users from checking their own admin status
  
  ## Solution
  
  1. Drop the problematic "Admins can view all admin users" policy
  2. Create TWO new policies:
     - "Users can view own admin record" - Allow users to check their own status
     - "Admins can view all admin users" - Allow existing admins to view all records
  
  This breaks the circular dependency by allowing initial self-lookup.
  
  ## Security
  
  - Users can only see their own admin record initially
  - Once verified as admin, they can see all admin records
  - Non-admin users will get null/empty result when checking their status
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;

-- Policy 1: Allow users to check their own admin status
CREATE POLICY "Users can view own admin record"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Allow verified admins to view all admin records
CREATE POLICY "Admins can view all admin records"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
