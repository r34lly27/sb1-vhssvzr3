import { useEffect, useState } from 'react';
import { BookOpen, LogOut, Users, Upload, Settings, UserCircle, Edit3, Printer, FileSpreadsheet, Award, TrendingUp, BookMarked, Activity } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { supabase } from '../lib/supabase';
import { ExcelGradeUpload } from './ExcelGradeUpload';
import { CourseManagement } from './CourseManagement';
import { EnrollmentManagement } from './EnrollmentManagement';
import StudentManagement from './StudentManagement';
import { ManualGradeInput } from './ManualGradeInput';
import { TranscriptPrint } from './TranscriptPrint';
import { BulkCourseUpload } from './BulkCourseUpload';
import { GradingScaleManagement } from './GradingScaleManagement';
import { SemesterGradeReport } from './SemesterGradeReport';
import { BulkEnrollmentByCurriculum } from './BulkEnrollmentByCurriculum';
import { ActivityLog } from './ActivityLog';

interface StudentGrade {
  student: {
    nim: string;
    name: string;
    angkatan: string;
  };
  course: {
    code: string;
    name: string;
    curriculum: string;
  };
  score: number;
  letter_grade: string;
}

export function AdminDashboard() {
  const { user, signOut } = useAdminAuth();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'excel-upload' | 'manual-input' | 'view' | 'courses' | 'bulk-course' | 'enrollments' | 'bulk-curriculum' | 'students' | 'print' | 'grading-scale' | 'semester-report' | 'activity-log'>('excel-upload');
  const [courseFilter, setCourseFilter] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [angkatanFilter, setAngkatanFilter] = useState('');
  const [courses, setCourses] = useState<Array<{ id: string; code: string; name: string; curriculum: string }>>([]);
  const [curriculumList, setCurriculumList] = useState<string[]>([]);
  const [angkatanList, setAngkatanList] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, code, name, curriculum')
        .order('code');

      setCourses(coursesData || []);

      if (coursesData) {
        const uniqueCurriculum = [...new Set(coursesData.map(c => c.curriculum).filter(Boolean))].sort().reverse();
        setCurriculumList(uniqueCurriculum as string[]);
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('angkatan');

      if (studentsData) {
        const uniqueAngkatan = [...new Set(studentsData.map(s => s.angkatan))].sort().reverse();
        setAngkatanList(uniqueAngkatan);
      }

      const { data: gradesData } = await supabase
        .from('grades')
        .select(`
          score,
          letter_grade,
          student:students (nim, name, angkatan),
          course:courses (code, name, curriculum)
        `)
        .order('created_at', { ascending: false });

      setGrades(gradesData as unknown as StudentGrade[]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredGrades = grades.filter(g => {
    if (courseFilter && g.course.code !== courseFilter) return false;
    if (curriculumFilter && g.course.curriculum !== curriculumFilter) return false;
    if (angkatanFilter && g.student.angkatan !== angkatanFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-800">Admin - Manajemen Nilai</h1>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Selamat datang, Admin
          </h2>
          <p className="text-gray-600">
            Email: {user?.email}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('excel-upload')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'excel-upload'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span>Upload Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('manual-input')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'manual-input'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Edit3 className="w-5 h-5" />
            <span>Input Manual</span>
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'view'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Lihat Nilai</span>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'courses'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Mata Kuliah</span>
          </button>
          <button
            onClick={() => setActiveTab('bulk-course')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'bulk-course'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Upload MK</span>
          </button>
          <button
            onClick={() => setActiveTab('enrollments')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'enrollments'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Enrollment</span>
          </button>
          <button
            onClick={() => setActiveTab('bulk-curriculum')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'bulk-curriculum'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookMarked className="w-5 h-5" />
            <span>Bulk by Kurikulum</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'students'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <UserCircle className="w-5 h-5" />
            <span>Mahasiswa</span>
          </button>
          <button
            onClick={() => setActiveTab('grading-scale')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'grading-scale'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Award className="w-5 h-5" />
            <span>Grading Scale</span>
          </button>
          <button
            onClick={() => setActiveTab('semester-report')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'semester-report'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Nilai Semester</span>
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'print'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Printer className="w-5 h-5" />
            <span>Cetak Transkrip</span>
          </button>
          <button
            onClick={() => setActiveTab('activity-log')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'activity-log'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>Activity Log</span>
          </button>
        </div>

        {activeTab === 'excel-upload' && <ExcelGradeUpload />}

        {activeTab === 'print' && <TranscriptPrint />}

        {activeTab === 'manual-input' && <ManualGradeInput />}

        {activeTab === 'students' && <StudentManagement />}

        {activeTab === 'courses' && <CourseManagement />}

        {activeTab === 'bulk-course' && <BulkCourseUpload />}

        {activeTab === 'grading-scale' && <GradingScaleManagement />}

        {activeTab === 'semester-report' && <SemesterGradeReport />}

        {activeTab === 'enrollments' && <EnrollmentManagement />}

        {activeTab === 'bulk-curriculum' && <BulkEnrollmentByCurriculum />}

        {activeTab === 'activity-log' && <ActivityLog />}

        {activeTab === 'view' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Daftar Nilai</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter Kurikulum
                  </label>
                  <select
                    value={curriculumFilter}
                    onChange={(e) => setCurriculumFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Semua Angkatan</option>
                    {angkatanList.map(angkatan => (
                      <option key={angkatan} value={angkatan}>
                        Angkatan {angkatan}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter Mata Kuliah
                  </label>
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Semua Mata Kuliah</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.code}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">
                  Menampilkan <span className="font-semibold text-gray-900">{filteredGrades.length}</span> nilai
                </div>
                {(curriculumFilter || angkatanFilter || courseFilter) && (
                  <button
                    onClick={() => {
                      setCurriculumFilter('');
                      setAngkatanFilter('');
                      setCourseFilter('');
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Memuat data...</p>
              </div>
            ) : filteredGrades.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-gray-800 mb-2">
                  Belum Ada Nilai
                </h4>
                <p className="text-gray-600">
                  Silakan upload nilai terlebih dahulu
                </p>
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
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Angkatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kode MK
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama Mata Kuliah
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kurikulum
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nilai Angka
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nilai Huruf
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredGrades.map((grade, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {grade.student.nim}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {grade.student.name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {grade.student.angkatan}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {grade.course.code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {grade.course.name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {grade.course.curriculum}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-gray-900">
                          {grade.score.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                            grade.letter_grade === 'A' ? 'bg-green-100 text-green-800' :
                            grade.letter_grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                            grade.letter_grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {grade.letter_grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
