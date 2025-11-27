import { useEffect, useState } from 'react';
import { BookOpen, LogOut, GraduationCap, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface StudentProfile {
  nim: string;
  name: string;
  email: string;
}

interface GradeWithCourse {
  id: string;
  score: number;
  letter_grade: string;
  course: {
    code: string;
    name: string;
    academic_year: string;
    semester: number;
    credits: number;
  };
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [grades, setGrades] = useState<GradeWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const { data: studentData, error: profileError } = await supabase
        .from('students')
        .select('nim, name, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(studentData);

      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          id,
          score,
          letter_grade,
          course:courses (
            code,
            name,
            academic_year,
            semester,
            credits
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (gradesError) throw gradesError;
      setGrades(gradesData as unknown as GradeWithCourse[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const calculateGPA = () => {
    if (grades.length === 0) return '0.00';

    const gradePoints: Record<string, number> = {
      'A': 4.0,
      'A-': 3.7,
      'B+': 3.3,
      'B': 3.0,
      'B-': 2.7,
      'C+': 2.3,
      'C': 2.0,
      'D': 1.0,
      'E': 0.0,
    };

    const totalPoints = grades.reduce((sum, grade) => {
      const points = gradePoints[grade.letter_grade] || 0;
      const credits = grade.course?.credits || 3;
      return sum + (points * credits);
    }, 0);

    const totalCredits = grades.reduce((sum, grade) => {
      return sum + (grade.course?.credits || 3);
    }, 0);

    return (totalPoints / totalCredits).toFixed(2);
  };

  const groupGradesByYear = () => {
    const grouped: Record<string, GradeWithCourse[]> = {};

    grades.forEach(grade => {
      const key = `${grade.course.academic_year} - Semester ${grade.course.semester}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(grade);
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  const groupedGrades = groupGradesByYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-800">Sistem Nilai Mahasiswa</h1>
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {profile?.name || 'Mahasiswa'}
              </h2>
              <div className="space-y-1">
                <p className="text-gray-600">
                  <span className="font-medium">NIM:</span> {profile?.nim}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Email:</span> {profile?.email}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-6 text-center">
              <Award className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">IPK</p>
              <p className="text-3xl font-bold text-blue-600">{calculateGPA()}</p>
            </div>
          </div>
        </div>

        {grades.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Belum Ada Nilai
            </h3>
            <p className="text-gray-600">
              Nilai Anda akan muncul di sini setelah diinput oleh dosen
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedGrades).map(([period, periodGrades]) => (
              <div key={period} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-blue-600 px-6 py-4">
                  <h3 className="text-lg font-bold text-white">{period}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kode
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mata Kuliah
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKS
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
                      {periodGrades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {grade.course.code}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {grade.course.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                            {grade.course.credits}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
