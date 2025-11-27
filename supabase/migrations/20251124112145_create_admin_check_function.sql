/*
  # Create Admin Check Function

  ## Problem
  
  RLS policies on admin_users table are preventing reliable admin status checks.
  Even with "Users can view own admin record" policy, there may be timing or
  policy evaluation issues.
  
  ## Solution
  
  Create a database function that runs with SECURITY DEFINER privilege.
  This allows it to bypass RLS and directly check if a user is an admin.
  
  ## Function: is_admin
  
  - Takes a user_id (uuid) parameter
  - Returns boolean (true if admin, false if not)
  - Runs with elevated privileges to bypass RLS
  - Safe because it only reads data, never modifies
  
  ## Security
  
  - SECURITY DEFINER is safe here because function only does SELECT
  - No user input is used in dynamic SQL
  - Function is read-only
  - Only returns boolean, no sensitive data exposed
*/

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin(uuid) IS 'Checks if a user ID exists in admin_users table. Bypasses RLS for reliable admin verification.';
