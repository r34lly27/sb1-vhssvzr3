import { useState, useEffect } from 'react';
import { Users, BookOpen, CheckCircle, XCircle, AlertCircle, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Course {
  id: string;
  code: string;
  name: string;
  academic_year: string;
  semester: number;
}

interface Student {
  id: string;
  nim: string;
  name: string;
  angkatan: string;
}

interface EnrollmentResult {
  success: Array<{ student: Student }>;
  failed: Array<{ student: Student; error: string }>;
  skipped: Array<{ student: Student; reason: string }>;
}

export function BulkEnrollment() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [angkatanList, setAngkatanList] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedAngkatan, setSelectedAngkatan] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<EnrollmentResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAngkatan) {
      const filtered = students.filter(s => s.angkatan === selectedAngkatan);
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents([]);
    }
  }, [selectedAngkatan, students]);

  const loadData = async () => {
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').order('code'),
        supabase.from('students').select('*').order('angkatan, nim')
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (studentsRes.data) {
        setStudents(studentsRes.data);
        const uniqueAngkatan = [...new Set(studentsRes.data.map(s => s.angkatan))].sort();
        setAngkatanList(uniqueAngkatan);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEnroll = async () => {
    if (!selectedCourse || !selectedAngkatan) {
      alert('Please select both course and angkatan');
      return;
    }

    if (filteredStudents.length === 0) {
      alert('No students found for the selected angkatan');
      return;
    }

    const confirmed = confirm(
      `Enroll ${filteredStudents.length} students from Angkatan ${selectedAngkatan} to this course?`
    );

    if (!confirmed) return;

    setEnrolling(true);
    setResult(null);

    const success: Array<{ student: Student }> = [];
    const failed: Array<{ student: Student; error: string }> = [];
    const skipped: Array<{ student: Student; reason: string }> = [];

    try {
      for (const student of filteredStudents) {
        try {
          const { data: existing } = await supabase
            .from('enrollments')
            .select('id')
            .eq('student_id', student.id)
            .eq('course_id', selectedCourse)
            .maybeSingle();

          if (existing) {
            skipped.push({
              student,
              reason: 'Already enrolled'
            });
            continue;
          }

          const { error: enrollError } = await supabase
            .from('enrollments')
            .insert({
              student_id: student.id,
              course_id: selectedCourse
            });

          if (enrollError) throw enrollError;

          success.push({ student });
        } catch (err: any) {
          failed.push({
            student,
            error: err.message || 'Unknown error'
          });
        }
      }

      setResult({ success, failed, skipped });
    } catch (error: any) {
      alert(`Error during bulk enrollment: ${error.message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const resetForm = () => {
    setSelectedCourse('');
    setSelectedAngkatan('');
    setFilteredStudents([]);
    setResult(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Enrollment</h2>
            <p className="text-gray-600 mt-1">Enroll multiple students by angkatan to a course</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            How It Works
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Select a course from the dropdown</li>
            <li>Select an angkatan (enrollment year)</li>
            <li>Review the list of students that will be enrolled</li>
            <li>Click "Enroll All Students" to process</li>
            <li>Students already enrolled will be automatically skipped</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <BookOpen className="inline w-4 h-4 mr-1" />
              Select Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Choose a Course --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name} ({course.academic_year} Sem {course.semester})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              Select Angkatan
            </label>
            <select
              value={selectedAngkatan}
              onChange={(e) => setSelectedAngkatan(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Choose Angkatan --</option>
              {angkatanList.map((angkatan) => (
                <option key={angkatan} value={angkatan}>
                  Angkatan {angkatan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedAngkatan && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Students to be Enrolled ({filteredStudents.length})
              </h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                Angkatan {selectedAngkatan}
              </span>
            </div>

            {filteredStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No students found for Angkatan {selectedAngkatan}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">NIM</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-100">
                        <td className="px-4 py-2 text-gray-900">{student.nim}</td>
                        <td className="px-4 py-2 text-gray-900">{student.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleBulkEnroll}
            disabled={!selectedCourse || !selectedAngkatan || filteredStudents.length === 0 || enrolling}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enrolling ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Enrolling...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Enroll All Students
              </>
            )}
          </button>

          {(selectedCourse || selectedAngkatan) && (
            <button
              onClick={resetForm}
              disabled={enrolling}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Enrollment Results</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h4 className="font-semibold text-green-900">Enrolled</h4>
                </div>
                <p className="text-3xl font-bold text-green-700">{result.success.length}</p>
                <p className="text-sm text-green-600 mt-1">students enrolled successfully</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-900">Skipped</h4>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{result.skipped.length}</p>
                <p className="text-sm text-yellow-600 mt-1">students already enrolled</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-red-600" />
                  <h4 className="font-semibold text-red-900">Failed</h4>
                </div>
                <p className="text-3xl font-bold text-red-700">{result.failed.length}</p>
                <p className="text-sm text-red-600 mt-1">students failed to enroll</p>
              </div>
            </div>

            {result.success.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Successfully Enrolled Students
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">NIM</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.success.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-4 py-2 text-gray-900">{item.student.nim}</td>
                          <td className="px-4 py-2 text-gray-900">{item.student.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Skipped Students
                </h4>
                <div className="bg-yellow-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-yellow-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-yellow-900">NIM</th>
                        <th className="px-4 py-2 text-left font-medium text-yellow-900">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-yellow-900">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-200">
                      {result.skipped.map((item, index) => (
                        <tr key={index} className="hover:bg-yellow-100">
                          <td className="px-4 py-2 text-yellow-900">{item.student.nim}</td>
                          <td className="px-4 py-2 text-yellow-900">{item.student.name}</td>
                          <td className="px-4 py-2 text-yellow-700 text-xs">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.failed.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Failed Enrollments
                </h4>
                <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-red-900">NIM</th>
                        <th className="px-4 py-2 text-left font-medium text-red-900">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-red-900">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200">
                      {result.failed.map((item, index) => (
                        <tr key={index} className="hover:bg-red-100">
                          <td className="px-4 py-2 text-red-900">{item.student.nim}</td>
                          <td className="px-4 py-2 text-red-900">{item.student.name}</td>
                          <td className="px-4 py-2 text-red-600 text-xs">{item.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-600" />
          Important Notes
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>All students from the selected angkatan will be enrolled to the selected course</li>
          <li>Students who are already enrolled in the course will be automatically skipped</li>
          <li>The enrollment process may take a moment for large batches</li>
          <li>Make sure the course and angkatan are correct before enrolling</li>
          <li>You can view enrollment details in the Enrollment Management tab</li>
        </ul>
      </div>
    </div>
  );
}
