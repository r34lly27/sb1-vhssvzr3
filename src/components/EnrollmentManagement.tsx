import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BulkEnrollment } from './BulkEnrollment';

interface Enrollment {
  id: string;
  student: {
    nim: string;
    name: string;
  };
  course: {
    code: string;
    name: string;
  };
}

interface Student {
  id: string;
  nim: string;
  name: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
}

export function EnrollmentManagement() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkEnrollment, setShowBulkEnrollment] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[EnrollmentManagement] Loading enrollment data...');

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          id,
          student:students (nim, name),
          course:courses (code, name)
        `)
        .order('created_at', { ascending: false });

      if (enrollmentError) {
        console.error('[EnrollmentManagement] Error loading enrollments:', enrollmentError);
        setError('Gagal memuat data enrollment: ' + enrollmentError.message);
      } else {
        console.log('[EnrollmentManagement] Enrollments loaded:', enrollmentData?.length || 0);
        setEnrollments(enrollmentData as unknown as Enrollment[]);
      }

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, nim, name')
        .order('nim');

      if (studentError) {
        console.error('[EnrollmentManagement] Error loading students:', studentError);
      } else {
        console.log('[EnrollmentManagement] Students loaded:', studentData?.length || 0);
        setStudents(studentData || []);
      }

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id, code, name')
        .order('code');

      if (courseError) {
        console.error('[EnrollmentManagement] Error loading courses:', courseError);
      } else {
        console.log('[EnrollmentManagement] Courses loaded:', courseData?.length || 0);
        setCourses(courseData || []);
      }
    } catch (err) {
      console.error('[EnrollmentManagement] Exception loading data:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.student_id || !formData.course_id) {
      setError('Silakan pilih mahasiswa dan mata kuliah');
      return;
    }

    try {
      const { error: err } = await supabase
        .from('enrollments')
        .insert([formData as any]);

      if (err) throw err;

      setFormData({
        student_id: '',
        course_id: '',
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambah enrollment';
      if (message.includes('duplicate')) {
        setError('Mahasiswa sudah terdaftar untuk mata kuliah ini');
      } else {
        setError(message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus enrollment ini?')) return;

    try {
      const { error: err } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', id);

      if (err) throw err;
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus enrollment');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showBulkEnrollment && (
        <BulkEnrollment />
      )}

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">Enrollment Mahasiswa</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowBulkEnrollment(!showBulkEnrollment);
                setShowForm(false);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Users className="w-4 h-4" />
              <span>{showBulkEnrollment ? 'Hide Bulk Enrollment' : 'Bulk Enrollment'}</span>
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setShowBulkEnrollment(false);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Enrollment</span>
            </button>
          </div>
        </div>

      {enrollments.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-600 mb-4">Belum ada enrollment</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Tambah Enrollment Pertama
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NIM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Mahasiswa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kode Mata Kuliah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Mata Kuliah
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrollments.map(enrollment => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {enrollment.student.nim}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {enrollment.student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {enrollment.course.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {enrollment.course.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleDelete(enrollment.id)}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Tambah Enrollment</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ student_id: '', course_id: '' });
                  setError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mahasiswa *
                </label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih Mahasiswa</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.nim} - {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mata Kuliah *
                </label>
                <select
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih Mata Kuliah</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ student_id: '', course_id: '' });
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Tambah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
