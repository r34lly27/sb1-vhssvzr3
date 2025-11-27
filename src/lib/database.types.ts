export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          nim: string
          name: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          nim: string
          name: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          nim?: string
          name?: string
          email?: string
          created_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          code: string
          name: string
          academic_year: string
          semester: number
          credits: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          academic_year: string
          semester: number
          credits?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          academic_year?: string
          semester?: number
          credits?: number
          created_at?: string
        }
      }
      grades: {
        Row: {
          id: string
          student_id: string
          course_id: string
          score: number
          letter_grade: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          course_id: string
          score: number
          letter_grade: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          course_id?: string
          score?: number
          letter_grade?: string
          created_at?: string
          updated_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          created_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          course_id?: string
          created_at?: string
        }
      }
    }
  }
}
