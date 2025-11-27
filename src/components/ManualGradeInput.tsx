import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Save, CheckCircle, AlertCircle, Users } from 'lucide-react';

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  curriculum: string;
}

interface EnrolledStudent {
  student_id: string;
  student: {
    id: string;
    nim: string;
    name: string;
    email: string;
    angkatan: string;
  };
  existing_grade?: {
    score: number;
    letter_grade: string;
  };
}

interface GradeInput {
  student_id: string;
  score: string;
}

export function ManualGradeInput() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [curriculumFilter, setCurriculumFilter] = useState<string>('');
  const [angkatanFilter, setAngkatanFilter] = useState<string>('');
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [curriculumList, setCurriculumList] = useState<string[]>([]);
  const [angkatanList, setAngkatanList] = useState<string[]>([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchEnrolledStudents(selectedCourse);
    } else {
      setEnrolledStudents([]);
      setGradeInputs({});
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('code');

      if (error) throw error;
      setCourses(data || []);

      if (data) {
        const uniqueCurriculum = [...new Set(data.map(c => c.curriculum).filter(Boolean))].sort().reverse();
        setCurriculumList(uniqueCurriculum as string[]);
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('angkatan');

      if (studentsData) {
        const uniqueAngkatan = [...new Set(studentsData.map(s => s.angkatan))].sort().reverse();
        setAngkatanList(uniqueAngkatan);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchEnrolledStudents = async (courseId: string) => {
    setLoading(true);
    try {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          student:students (
            id,
            nim,
            name,
            email,
            angkatan
          )
        `)
        .eq('course_id', courseId)
        .order('student(name)');

      if (error) throw error;

      const { data: existingGrades } = await supabase
        .from('grades')
        .select('student_id, score, letter_grade')
        .eq('course_id', courseId);

      const gradesMap = new Map(
        (existingGrades || []).map(g => [g.student_id, { score: g.score, letter_grade: g.letter_grade }])
      );

      const studentsWithGrades = (enrollments || []).map(enrollment => ({
        ...enrollment,
        existing_grade: gradesMap.get(enrollment.student_id)
      }));

      setEnrolledStudents(studentsWithGrades as EnrolledStudent[]);

      const initialInputs: Record<string, string> = {};
      studentsWithGrades.forEach(student => {
        if (student.existing_grade) {
          initialInputs[student.student_id] = student.existing_grade.score.toString();
        }
      });
      setGradeInputs(initialInputs);
    } catch (err) {
      console.error('Error fetching enrolled students:', err);
      setMessage({ type: 'error', text: 'Failed to load enrolled students' });
    } finally {
      setLoading(false);
    }
  };

  const calculateLetterGrade = (score: number): string => {
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D';
    return 'E';
  };

  const handleScoreChange = (studentId: string, value: string) => {
    if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100)) {
      setGradeInputs(prev => ({
        ...prev,
        [studentId]: value
      }));
    }
  };

  const handleSaveGrades = async () => {
    if (!selectedCourse) {
      setMessage({ type: 'error', text: 'Please select a course first' });
      return;
    }

    const gradesToSave = Object.entries(gradeInputs)
      .filter(([_, score]) => score !== '' && !isNaN(Number(score)))
      .map(([studentId, score]) => {
        const numScore = Number(score);
        return {
          student_id: studentId,
          course_id: selectedCourse,
          score: numScore,
          letter_grade: calculateLetterGrade(numScore)
        };
      });

    if (gradesToSave.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one valid grade' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('grades')
        .upsert(gradesToSave, {
          onConflict: 'student_id,course_id'
        });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Successfully saved ${gradesToSave.length} grade(s)`
      });

      fetchEnrolledStudents(selectedCourse);
    } catch (err: any) {
      console.error('Error saving grades:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Failed to save grades'
      });
    } finally {
      setSaving(false);
    }
  };

  const getSelectedCourse = () => courses.find(c => c.id === selectedCourse);

  const filteredCourses = courses.filter(course => {
    if (curriculumFilter && course.curriculum !== curriculumFilter) return false;
    return true;
  });

  const filteredStudents = enrolledStudents.filter(student => {
    if (angkatanFilter && student.student.angkatan !== angkatanFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manual Grade Input</h2>
            <p className="text-gray-600 mt-1">Input grades for enrolled students by course</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Kurikulum
            </label>
            <select
              value={curriculumFilter}
              onChange={(e) => {
                setCurriculumFilter(e.target.value);
                setSelectedCourse('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="">Semua Kurikulum</option>
              {curriculumList.map(curriculum => (
                <option key={curriculum} value={curriculum}>
                  Kurikulum {curriculum}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Angkatan
            </label>
            <select
              value={angkatanFilter}
              onChange={(e) => setAngkatanFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="">Semua Angkatan</option>
              {angkatanList.map(angkatan => (
                <option key={angkatan} value={angkatan}>
                  Angkatan {angkatan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(curriculumFilter || angkatanFilter) && (
          <div className="mb-4 flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">
              {curriculumFilter && <span className="mr-3">Kurikulum: <span className="font-semibold text-gray-900">{curriculumFilter}</span></span>}
              {angkatanFilter && <span>Angkatan: <span className="font-semibold text-gray-900">{angkatanFilter}</span></span>}
            </div>
            <button
              onClick={() => {
                setCurriculumFilter('');
                setAngkatanFilter('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reset Filter
            </button>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Course
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="">-- Select a course --</option>
            {filteredCourses.map(course => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.name} ({course.credits} credits)
              </option>
            ))}
          </select>
          {filteredCourses.length === 0 && curriculumFilter && (
            <p className="text-sm text-amber-600 mt-2">
              No courses found for Kurikulum {curriculumFilter}
            </p>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {selectedCourse && getSelectedCourse() && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Course Information</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Code:</span>
                <span className="ml-2 text-blue-900">{getSelectedCourse()?.code}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Name:</span>
                <span className="ml-2 text-blue-900">{getSelectedCourse()?.name}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Credits:</span>
                <span className="ml-2 text-blue-900">{getSelectedCourse()?.credits}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enrolled students...</p>
        </div>
      ) : selectedCourse && enrolledStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Students Enrolled</h3>
          <p className="text-gray-600">
            There are no students enrolled in this course yet.
          </p>
        </div>
      ) : selectedCourse && enrolledStudents.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Enrolled Students ({filteredStudents.length}{enrolledStudents.length !== filteredStudents.length ? ` / ${enrolledStudents.length}` : ''})
                </h3>
              </div>
              <button
                onClick={handleSaveGrades}
                disabled={saving || Object.keys(gradeInputs).length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save All Grades'}
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Students Match Filter</h3>
              <p className="text-gray-600">
                Try adjusting your angkatan filter.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        NIM
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Angkatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score (0-100)
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Letter Grade
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => {
                  const score = gradeInputs[student.student_id] || '';
                  const numScore = score !== '' ? Number(score) : null;
                  const letterGrade = numScore !== null && !isNaN(numScore) ? calculateLetterGrade(numScore) : '';
                  const hasExistingGrade = student.existing_grade !== undefined;

                  return (
                    <tr key={student.student_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {student.student.nim}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{student.student.name}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {student.student.angkatan}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{student.student.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={score}
                          onChange={(e) => handleScoreChange(student.student_id, e.target.value)}
                          placeholder="0-100"
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {letterGrade && (
                          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                            letterGrade === 'A' || letterGrade === 'A-' ? 'bg-green-100 text-green-800' :
                            letterGrade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                            letterGrade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {letterGrade}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {hasExistingGrade ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Graded
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                            Not graded
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <p>
                Showing: <span className="font-semibold text-gray-900">{filteredStudents.length}</span>
                {enrolledStudents.length !== filteredStudents.length && (
                  <span className="text-gray-500"> / {enrolledStudents.length} total</span>
                )}
              </p>
              <p>
                Graded: <span className="font-semibold text-gray-900">
                  {filteredStudents.filter(s => s.existing_grade).length}
                </span> / {filteredStudents.length}
              </p>
            </div>
          </div>
            </>
          )}
        </div>
      ) : null}

      {selectedCourse && enrolledStudents.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Grading Scale:</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-green-700">A:</span> <span className="text-gray-700">85-100</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-green-600">A-:</span> <span className="text-gray-700">80-84</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-blue-700">B+:</span> <span className="text-gray-700">75-79</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-blue-600">B:</span> <span className="text-gray-700">70-74</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-blue-500">B-:</span> <span className="text-gray-700">65-69</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-yellow-700">C+:</span> <span className="text-gray-700">60-64</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-yellow-600">C:</span> <span className="text-gray-700">55-59</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-yellow-500">C-:</span> <span className="text-gray-700">50-54</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-orange-600">D:</span> <span className="text-gray-700">45-49</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="font-medium text-red-600">E:</span> <span className="text-gray-700">0-44</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
