/*
  # Create Grading Scales Table

  1. New Tables
    - `grading_scales`
      - `id` (uuid, primary key)
      - `curriculum` (text) - Tahun kurikulum (2024, 2023, etc)
      - `letter_grade` (text) - Grade huruf (A, A-, B+, etc)
      - `min_score` (numeric) - Nilai minimum untuk grade ini
      - `max_score` (numeric) - Nilai maksimum untuk grade ini
      - `grade_point` (numeric) - Nilai bobot (4.0, 3.7, 3.3, etc)
      - `description` (text, optional) - Deskripsi grade
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Purpose
    - Different curriculum years can have different grading scales
    - Flexible grade conversion rules per angkatan
    - Used during grade calculation and input
  
  3. Security
    - Enable RLS on `grading_scales` table
    - Admins can manage grading scales
    - Students can view grading scales for their curriculum
  
  4. Indexes
    - Index on curriculum for fast lookup
    - Index on (curriculum, min_score, max_score) for grade calculation
  
  5. Default Data
    - Insert default grading scale for curriculum 2024
    - Standard Indonesian university grading scale
*/

-- Create grading_scales table
CREATE TABLE IF NOT EXISTS grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum text NOT NULL,
  letter_grade text NOT NULL,
  min_score numeric(5,2) NOT NULL CHECK (min_score >= 0 AND min_score <= 100),
  max_score numeric(5,2) NOT NULL CHECK (max_score >= 0 AND max_score <= 100),
  grade_point numeric(3,2) NOT NULL CHECK (grade_point >= 0 AND grade_point <= 4),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_score_range CHECK (min_score <= max_score),
  CONSTRAINT unique_curriculum_grade UNIQUE (curriculum, letter_grade)
);

-- Enable RLS
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage grading scales"
  ON grading_scales
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Policy: Students can view grading scales
CREATE POLICY "Students can view grading scales"
  ON grading_scales
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_grading_scales_curriculum ON grading_scales(curriculum);
CREATE INDEX IF NOT EXISTS idx_grading_scales_curriculum_score ON grading_scales(curriculum, min_score, max_score);

-- Insert default grading scale for curriculum 2024 (Standard Indonesian university scale)
INSERT INTO grading_scales (curriculum, letter_grade, min_score, max_score, grade_point, description)
VALUES
  ('2024', 'A', 85.00, 100.00, 4.00, 'Sangat Baik'),
  ('2024', 'A-', 80.00, 84.99, 3.70, 'Baik Sekali'),
  ('2024', 'B+', 75.00, 79.99, 3.30, 'Lebih dari Baik'),
  ('2024', 'B', 70.00, 74.99, 3.00, 'Baik'),
  ('2024', 'B-', 65.00, 69.99, 2.70, 'Cukup Baik'),
  ('2024', 'C+', 60.00, 64.99, 2.30, 'Lebih dari Cukup'),
  ('2024', 'C', 55.00, 59.99, 2.00, 'Cukup'),
  ('2024', 'D', 50.00, 54.99, 1.00, 'Kurang'),
  ('2024', 'E', 0.00, 49.99, 0.00, 'Gagal')
ON CONFLICT (curriculum, letter_grade) DO NOTHING;

-- Create function to get letter grade from score and curriculum
CREATE OR REPLACE FUNCTION get_letter_grade(p_score numeric, p_curriculum text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_letter_grade text;
BEGIN
  SELECT letter_grade INTO v_letter_grade
  FROM grading_scales
  WHERE curriculum = p_curriculum
    AND p_score >= min_score
    AND p_score <= max_score
  LIMIT 1;
  
  -- If no grade found, return 'E' as default
  RETURN COALESCE(v_letter_grade, 'E');
END;
$$;

-- Create function to get grade point from score and curriculum
CREATE OR REPLACE FUNCTION get_grade_point(p_score numeric, p_curriculum text)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_grade_point numeric;
BEGIN
  SELECT grade_point INTO v_grade_point
  FROM grading_scales
  WHERE curriculum = p_curriculum
    AND p_score >= min_score
    AND p_score <= max_score
  LIMIT 1;
  
  -- If no grade found, return 0.00 as default
  RETURN COALESCE(v_grade_point, 0.00);
END;
$$;
