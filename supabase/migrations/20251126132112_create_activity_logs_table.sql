/*
  # Create Activity Logs Table

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key) - Unique identifier for each log entry
      - `user_id` (uuid, nullable) - ID of the user performing the action (null for system actions)
      - `user_email` (text) - Email of the user for quick reference
      - `user_type` (text) - Type of user: 'admin' or 'student'
      - `action` (text) - Action performed (e.g., 'login', 'upload_grades', 'create_course')
      - `entity_type` (text, nullable) - Type of entity affected (e.g., 'course', 'student', 'grade')
      - `entity_id` (text, nullable) - ID of the affected entity
      - `description` (text) - Human-readable description of the action
      - `metadata` (jsonb, nullable) - Additional data about the action
      - `ip_address` (text, nullable) - IP address of the user (if available)
      - `created_at` (timestamptz) - Timestamp of when the action occurred

  2. Security
    - Enable RLS on `activity_logs` table
    - Only admins can view activity logs
    - System can insert logs (via service role)

  3. Indexes
    - Index on user_id for fast user activity lookups
    - Index on action for filtering by action type
    - Index on created_at for time-based queries
    - Index on entity_type and entity_id for entity-specific queries
*/

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('admin', 'student', 'system')),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type ON activity_logs(user_type);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view activity logs
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  );

-- Policy: Authenticated users can insert their own logs
CREATE POLICY "Users can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Anonymous users can insert logs (for login attempts)
CREATE POLICY "Anonymous can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE activity_logs IS 'Stores all user and admin activity logs for audit purposes';
