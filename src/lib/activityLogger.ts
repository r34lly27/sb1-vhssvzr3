import { supabase } from './supabase';

export interface LogActivity {
  action: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

class ActivityLogger {
  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    return !!data;
  }

  async log(params: LogActivity) {
    try {
      const user = await this.getCurrentUser();

      if (!user) {
        await supabase.from('activity_logs').insert({
          user_email: 'anonymous',
          user_type: 'system',
          action: params.action,
          entity_type: params.entityType || null,
          entity_id: params.entityId || null,
          description: params.description,
          metadata: params.metadata || {},
        });
        return;
      }

      const isAdminUser = await this.isAdmin(user.id);

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_email: user.email || 'unknown',
        user_type: isAdminUser ? 'admin' : 'student',
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        description: params.description,
        metadata: params.metadata || {},
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async logLogin(email: string, userType: 'admin' | 'student', success: boolean) {
    try {
      await supabase.from('activity_logs').insert({
        user_email: email,
        user_type: userType,
        action: success ? 'login_success' : 'login_failed',
        description: success
          ? `${userType === 'admin' ? 'Admin' : 'Student'} ${email} logged in successfully`
          : `Failed login attempt for ${email}`,
        metadata: { success },
      });
    } catch (error) {
      console.error('Failed to log login activity:', error);
    }
  }

  async logLogout(email: string, userType: 'admin' | 'student') {
    try {
      await supabase.from('activity_logs').insert({
        user_email: email,
        user_type: userType,
        action: 'logout',
        description: `${userType === 'admin' ? 'Admin' : 'Student'} ${email} logged out`,
        metadata: {},
      });
    } catch (error) {
      console.error('Failed to log logout activity:', error);
    }
  }

  async logGradeUpload(courseCode: string, studentCount: number, method: 'excel' | 'manual') {
    await this.log({
      action: 'grade_upload',
      description: `Uploaded ${studentCount} grades for course ${courseCode} via ${method}`,
      entityType: 'course',
      entityId: courseCode,
      metadata: { studentCount, method }
    });
  }

  async logCourseCreate(courseCode: string, courseName: string) {
    await this.log({
      action: 'course_create',
      description: `Created course: ${courseCode} - ${courseName}`,
      entityType: 'course',
      entityId: courseCode,
      metadata: { courseName }
    });
  }

  async logCourseUpdate(courseCode: string, courseName: string) {
    await this.log({
      action: 'course_update',
      description: `Updated course: ${courseCode} - ${courseName}`,
      entityType: 'course',
      entityId: courseCode,
      metadata: { courseName }
    });
  }

  async logCourseDelete(courseCode: string) {
    await this.log({
      action: 'course_delete',
      description: `Deleted course: ${courseCode}`,
      entityType: 'course',
      entityId: courseCode
    });
  }

  async logStudentCreate(nim: string, name: string) {
    await this.log({
      action: 'student_create',
      description: `Created student: ${nim} - ${name}`,
      entityType: 'student',
      entityId: nim,
      metadata: { name }
    });
  }

  async logStudentUpdate(nim: string, name: string) {
    await this.log({
      action: 'student_update',
      description: `Updated student: ${nim} - ${name}`,
      entityType: 'student',
      entityId: nim,
      metadata: { name }
    });
  }

  async logStudentDelete(nim: string) {
    await this.log({
      action: 'student_delete',
      description: `Deleted student: ${nim}`,
      entityType: 'student',
      entityId: nim
    });
  }

  async logBulkEnrollment(courseCount: number, studentCount: number, type: 'by_course' | 'by_curriculum') {
    await this.log({
      action: 'bulk_enrollment',
      description: `Bulk enrollment: ${studentCount} students to ${courseCount} courses (${type})`,
      entityType: 'enrollment',
      metadata: { courseCount, studentCount, type }
    });
  }

  async logTranscriptView(nim: string, studentName: string) {
    await this.log({
      action: 'transcript_view',
      description: `Viewed transcript for student: ${nim} - ${studentName}`,
      entityType: 'student',
      entityId: nim,
      metadata: { studentName }
    });
  }

  async logTranscriptPrint(nim: string, studentName: string, format: 'pdf' | 'docx') {
    await this.log({
      action: 'transcript_print',
      description: `Printed transcript for student: ${nim} - ${studentName} (${format})`,
      entityType: 'student',
      entityId: nim,
      metadata: { studentName, format }
    });
  }

  async logBulkUpload(type: 'courses' | 'students' | 'grades', count: number) {
    await this.log({
      action: `bulk_upload_${type}`,
      description: `Bulk uploaded ${count} ${type}`,
      entityType: type,
      metadata: { count }
    });
  }
}

export const activityLogger = new ActivityLogger();
