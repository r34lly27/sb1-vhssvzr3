/*
  # Initial Database Schema

  1. New Tables
    - `students`
      - `id` (uuid, primary key, references auth.users)
      - `nim` (text, unique, not null) - Student ID number
      - `name` (text, not null) - Student name
      - `email` (text, unique, not null) - Student email
      - `angkatan` (text, not null, default '2024') - Enrollment year
      - `created_at` (timestamptz, default now())

    - `admin_users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, not null) - Admin email
      - `created_at` (timestamptz, default now())

    - `courses`
      - `id` (uuid, primary key)
      - `code` (text, unique, not null) - Course code
      - `name` (text, not null) - Course name
      - `sks` (integer, not null) - Credit hours
      - `semester` (integer, not null) - Semester number
      - `curriculum` (text, not null, default '2020') - Curriculum year
      - `created_at` (timestamptz, default now())

    - `enrollments`
      - `id` (uuid, primary key)
      - `student_id` (uuid, not null, references students)
      - `course_id` (uuid, not null, references courses)
      - `created_at` (timestamptz, default now())
      - Unique constraint on (student_id, course_id)

    - `grades`
      - `id` (uuid, primary key)
      - `enrollment_id` (uuid, not null, references enrollments)
      - `numeric_grade` (numeric, check >= 0 and <= 100)
      - `letter_grade` (text)
      - `grade_point` (numeric)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `grading_scales`
      - `id` (uuid, primary key)
      - `min_score` (numeric, not null, check >= 0 and <= 100)
      - `max_score` (numeric, not null, check >= 0 and <= 100)
      - `letter_grade` (text, not null)
      - `grade_point` (numeric, not null, check >= 0 and <= 4)
      - `description` (text)
      - `created_at` (timestamptz, default now())

    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_email` (text, not null)
      - `user_role` (text, not null)
      - `action` (text, not null)
      - `details` (jsonb)
      - `success` (boolean, default true)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add helper function `is_admin()` to check admin status
    - Add policies for authenticated users and admins
*/

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nim text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  angkatan text NOT NULL DEFAULT '2024',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  sks integer NOT NULL CHECK (sks > 0),
  semester integer NOT NULL CHECK (semester >= 1 AND semester <= 14),
  curriculum text NOT NULL DEFAULT '2020',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Create grades table
CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  numeric_grade numeric CHECK (numeric_grade >= 0 AND numeric_grade <= 100),
  letter_grade text,
  grade_point numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Create grading_scales table
CREATE TABLE IF NOT EXISTS grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score numeric NOT NULL CHECK (min_score >= 0 AND min_score <= 100),
  max_score numeric NOT NULL CHECK (max_score >= 0 AND max_score <= 100),
  letter_grade text NOT NULL,
  grade_point numeric NOT NULL CHECK (grade_point >= 0 AND grade_point <= 4),
  description text,
  created_at timestamptz DEFAULT now(),
  CHECK (min_score <= max_score)
);

ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_role text NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  success boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students table
CREATE POLICY "Students can view own profile"
  ON students FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Students can insert own profile"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Students can update own profile"
  ON students FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for admin_users table
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Authenticated users can register as admin"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for courses table
CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete courses"
  ON courses FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for enrollments table
CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE id = auth.uid()) OR is_admin());

CREATE POLICY "Admins can insert enrollments"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update enrollments"
  ON enrollments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete enrollments"
  ON enrollments FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for grades table
CREATE POLICY "Students can view own grades"
  ON grades FOR SELECT
  TO authenticated
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments 
      WHERE student_id IN (SELECT id FROM students WHERE id = auth.uid())
    ) OR is_admin()
  );

CREATE POLICY "Admins can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete grades"
  ON grades FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for grading_scales table
CREATE POLICY "Authenticated users can view grading scales"
  ON grading_scales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert grading scales"
  ON grading_scales FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update grading scales"
  ON grading_scales FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete grading scales"
  ON grading_scales FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for activity_logs table
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default grading scales
INSERT INTO grading_scales (min_score, max_score, letter_grade, grade_point, description)
VALUES
  (85, 100, 'A', 4.0, 'Sangat Baik'),
  (80, 84.99, 'A-', 3.7, 'Baik Sekali'),
  (75, 79.99, 'B+', 3.3, 'Lebih dari Baik'),
  (70, 74.99, 'B', 3.0, 'Baik'),
  (65, 69.99, 'B-', 2.7, 'Cukup Baik'),
  (60, 64.99, 'C+', 2.3, 'Lebih dari Cukup'),
  (55, 59.99, 'C', 2.0, 'Cukup'),
  (50, 54.99, 'C-', 1.7, 'Kurang dari Cukup'),
  (40, 49.99, 'D', 1.0, 'Kurang'),
  (0, 39.99, 'E', 0.0, 'Gagal')
ON CONFLICT DO NOTHING;
