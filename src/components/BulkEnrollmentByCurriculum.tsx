import { useState, useEffect } from 'react';
import { Users, BookOpen, CheckCircle, XCircle, AlertCircle, GraduationCap, BookMarked } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Course {
  id: string;
  code: string;
  name: string;
  curriculum: string;
  sks: number;
  semester: number | null;
}

interface Student {
  id: string;
  nim: string;
  name: string;
  angkatan: string;
}

interface EnrollmentDetail {
  course: Course;
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface EnrollmentResult {
  totalStudents: number;
  totalCourses: number;
  courseDetails: EnrollmentDetail[];
}

export function BulkEnrollmentByCurriculum() {
  const [curriculumList, setCurriculumList] = useState<string[]>([]);
  const [angkatanList, setAngkatanList] = useState<string[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedAngkatan, setSelectedAngkatan] = useState('');
  const [coursesInCurriculum, setCoursesInCurriculum] = useState<Course[]>([]);
  const [studentsInAngkatan, setStudentsInAngkatan] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<EnrollmentResult | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCurriculum) {
      loadCoursesForCurriculum(selectedCurriculum);
    } else {
      setCoursesInCurriculum([]);
    }
  }, [selectedCurriculum]);

  useEffect(() => {
    if (selectedAngkatan) {
      loadStudentsForAngkatan(selectedAngkatan);
    } else {
      setStudentsInAngkatan([]);
    }
  }, [selectedAngkatan]);

  const loadInitialData = async () => {
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('curriculum').not('curriculum', 'is', null),
        supabase.from('students').select('angkatan')
      ]);

      if (coursesRes.data) {
        const uniqueCurriculum = [...new Set(coursesRes.data.map(c => c.curriculum))].sort().reverse();
        setCurriculumList(uniqueCurriculum as string[]);
      }

      if (studentsRes.data) {
        const uniqueAngkatan = [...new Set(studentsRes.data.map(s => s.angkatan))].sort().reverse();
        setAngkatanList(uniqueAngkatan);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCoursesForCurriculum = async (curriculum: string) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('curriculum', curriculum)
        .order('semester', { ascending: true, nullsFirst: false })
        .order('code');

      if (error) throw error;
      setCoursesInCurriculum(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const loadStudentsForAngkatan = async (angkatan: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('angkatan', angkatan)
        .order('nim');

      if (error) throw error;
      setStudentsInAngkatan(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleBulkEnrollByCurriculum = async () => {
    if (!selectedCurriculum || !selectedAngkatan) {
      alert('Please select both curriculum and angkatan');
      return;
    }

    if (coursesInCurriculum.length === 0) {
      alert('No courses found for the selected curriculum');
      return;
    }

    if (studentsInAngkatan.length === 0) {
      alert('No students found for the selected angkatan');
      return;
    }

    const totalEnrollments = coursesInCurriculum.length * studentsInAngkatan.length;

    const confirmed = confirm(
      `This will enroll ${studentsInAngkatan.length} students from Angkatan ${selectedAngkatan} ` +
      `to ALL ${coursesInCurriculum.length} courses in Curriculum ${selectedCurriculum}.\n\n` +
      `Total enrollments to process: ${totalEnrollments}\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) return;

    setEnrolling(true);
    setResult(null);

    const courseDetails: EnrollmentDetail[] = [];

    try {
      for (const course of coursesInCurriculum) {
        let success = 0;
        let failed = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const student of studentsInAngkatan) {
          try {
            const { data: existing } = await supabase
              .from('enrollments')
              .select('id')
              .eq('student_id', student.id)
              .eq('course_id', course.id)
              .maybeSingle();

            if (existing) {
              skipped++;
              continue;
            }

            const { error: enrollError } = await supabase
              .from('enrollments')
              .insert({
                student_id: student.id,
                course_id: course.id
              });

            if (enrollError) {
              failed++;
              errors.push(`${student.nim}: ${enrollError.message}`);
            } else {
              success++;
            }
          } catch (err: any) {
            failed++;
            errors.push(`${student.nim}: ${err.message || 'Unknown error'}`);
          }
        }

        courseDetails.push({
          course,
          success,
          failed,
          skipped,
          errors
        });
      }

      setResult({
        totalStudents: studentsInAngkatan.length,
        totalCourses: coursesInCurriculum.length,
        courseDetails
      });
    } catch (error: any) {
      alert(`Error during bulk enrollment: ${error.message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const resetForm = () => {
    setSelectedCurriculum('');
    setSelectedAngkatan('');
    setCoursesInCurriculum([]);
    setStudentsInAngkatan([]);
    setResult(null);
  };

  const getTotalStats = () => {
    if (!result) return { success: 0, failed: 0, skipped: 0 };

    return result.courseDetails.reduce(
      (acc, detail) => ({
        success: acc.success + detail.success,
        failed: acc.failed + detail.failed,
        skipped: acc.skipped + detail.skipped
      }),
      { success: 0, failed: 0, skipped: 0 }
    );
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
          <BookMarked className="w-8 h-8 text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Enrollment by Curriculum</h2>
            <p className="text-gray-600 mt-1">Enroll entire angkatan to all courses in a curriculum</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            How It Works
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-purple-800">
            <li>Select a curriculum (e.g., 2024)</li>
            <li>Select an angkatan (e.g., 2024)</li>
            <li>Review all courses in that curriculum</li>
            <li>Review all students in that angkatan</li>
            <li>Click "Enroll All to Curriculum" to enroll ALL students to ALL courses</li>
            <li>Students already enrolled in specific courses will be automatically skipped</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <BookMarked className="inline w-4 h-4 mr-1" />
              Select Curriculum
            </label>
            <select
              value={selectedCurriculum}
              onChange={(e) => setSelectedCurriculum(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">-- Choose a Curriculum --</option>
              {curriculumList.map((curriculum) => (
                <option key={curriculum} value={curriculum}>
                  Kurikulum {curriculum}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

        {selectedCurriculum && coursesInCurriculum.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Courses in Curriculum {selectedCurriculum} ({coursesInCurriculum.length})
              </h3>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                {coursesInCurriculum.reduce((sum, c) => sum + c.sks, 0)} Total SKS
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Code</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Course Name</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">SKS</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Sem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {coursesInCurriculum.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-100">
                      <td className="px-4 py-2 text-gray-900 font-medium">{course.code}</td>
                      <td className="px-4 py-2 text-gray-900">{course.name}</td>
                      <td className="px-4 py-2 text-center text-gray-700">{course.sks}</td>
                      <td className="px-4 py-2 text-center text-gray-700">
                        {course.semester || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedAngkatan && studentsInAngkatan.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Students in Angkatan {selectedAngkatan} ({studentsInAngkatan.length})
              </h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                Angkatan {selectedAngkatan}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">NIM</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {studentsInAngkatan.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-100">
                      <td className="px-4 py-2 text-gray-900">{student.nim}</td>
                      <td className="px-4 py-2 text-gray-900">{student.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedCurriculum && selectedAngkatan && coursesInCurriculum.length > 0 && studentsInAngkatan.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-amber-900">Enrollment Summary</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-amber-700">Total Students:</p>
                <p className="text-2xl font-bold text-amber-900">{studentsInAngkatan.length}</p>
              </div>
              <div>
                <p className="text-amber-700">Total Courses:</p>
                <p className="text-2xl font-bold text-amber-900">{coursesInCurriculum.length}</p>
              </div>
              <div>
                <p className="text-amber-700">Total Enrollments:</p>
                <p className="text-2xl font-bold text-amber-900">
                  {studentsInAngkatan.length * coursesInCurriculum.length}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleBulkEnrollByCurriculum}
            disabled={
              !selectedCurriculum ||
              !selectedAngkatan ||
              coursesInCurriculum.length === 0 ||
              studentsInAngkatan.length === 0 ||
              enrolling
            }
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enrolling ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Enrolling...
              </>
            ) : (
              <>
                <GraduationCap className="w-5 h-5" />
                Enroll All to Curriculum
              </>
            )}
          </button>

          {(selectedCurriculum || selectedAngkatan) && (
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
            <p className="text-sm text-gray-600 mt-1">
              Enrolled {result.totalStudents} students to {result.totalCourses} courses in Curriculum {selectedCurriculum}
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h4 className="font-semibold text-green-900">Success</h4>
                </div>
                <p className="text-3xl font-bold text-green-700">{getTotalStats().success}</p>
                <p className="text-sm text-green-600 mt-1">enrollments completed</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-900">Skipped</h4>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{getTotalStats().skipped}</p>
                <p className="text-sm text-yellow-600 mt-1">already enrolled</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-red-600" />
                  <h4 className="font-semibold text-red-900">Failed</h4>
                </div>
                <p className="text-3xl font-bold text-red-700">{getTotalStats().failed}</p>
                <p className="text-sm text-red-600 mt-1">failed to enroll</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Details by Course</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.courseDetails.map((detail, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {detail.course.code} - {detail.course.name}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {detail.course.sks} SKS • Semester {detail.course.semester || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <p className="text-green-600 font-semibold">{detail.success}</p>
                        <p className="text-gray-600 text-xs">Success</p>
                      </div>
                      <div className="text-center">
                        <p className="text-yellow-600 font-semibold">{detail.skipped}</p>
                        <p className="text-gray-600 text-xs">Skipped</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-600 font-semibold">{detail.failed}</p>
                        <p className="text-gray-600 text-xs">Failed</p>
                      </div>
                    </div>

                    {detail.errors.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs font-semibold text-red-900 mb-1">Errors:</p>
                        <ul className="text-xs text-red-700 space-y-1">
                          {detail.errors.slice(0, 3).map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                          {detail.errors.length > 3 && (
                            <li className="text-red-600">
                              ... and {detail.errors.length - 3} more errors
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-600" />
          Important Notes
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>This will enroll ALL students from the selected angkatan to ALL courses in the curriculum</li>
          <li>Students who are already enrolled in specific courses will be automatically skipped</li>
          <li>The process may take several minutes for large batches</li>
          <li>Make sure the curriculum and angkatan match before proceeding</li>
          <li>Example: Angkatan 2024 should be enrolled to Kurikulum 2024</li>
        </ul>
      </div>
    </div>
  );
}
