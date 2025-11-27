import { useState } from 'react';
import { Upload, CheckCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface UploadedRow {
  nim: string;
  courseCode: string;
  angkatan?: string;
  score: number;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

interface CourseInfo {
  id: string;
  code: string;
  name: string;
}

function getLetterGrade(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'D';
  return 'E';
}

export function ExcelGradeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedRows, setUploadedRows] = useState<UploadedRow[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedAngkatan, setSelectedAngkatan] = useState('');
  const [angkatanList, setAngkatanList] = useState<string[]>([]);
  const [preview, setPreview] = useState<UploadedRow[]>([]);
  const [step, setStep] = useState<'select' | 'course' | 'angkatan' | 'preview' | 'upload'>('select');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      alert('Silakan pilih file Excel (.xlsx atau .xls)');
      return;
    }

    setFile(selectedFile);
    setStep('course');
  };

  const loadCourses = async () => {
    try {
      const { data } = await supabase
        .from('courses')
        .select('id, code, name')
        .order('code');

      setCourses(data || []);
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  const loadAngkatan = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('angkatan')
        .order('angkatan');

      if (data) {
        const uniqueAngkatan = Array.from(new Set(data.map(s => s.angkatan)));
        setAngkatanList(uniqueAngkatan);
      }
    } catch (err) {
      console.error('Error loading angkatan:', err);
    }
  };

  const handleCourseSelect = () => {
    if (!selectedCourse) return;
    setStep('angkatan');
  };

  const handleAngkatanSelect = async () => {
    if (!selectedAngkatan || !file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const rows: UploadedRow[] = data.map((row: any) => ({
        nim: String(row['NIM'] || row['nim'] || '').trim(),
        courseCode: selectedCourse,
        angkatan: selectedAngkatan,
        score: parseFloat(row['Nilai'] || row['nilai'] || row['Score'] || '0'),
        status: 'pending',
      }));

      setPreview(rows);
      setStep('preview');
    } catch (err) {
      alert('Error membaca file Excel: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!preview.length) return;

    setLoading(true);
    setStep('upload');

    const processedRows: UploadedRow[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of preview) {
      try {
        if (!row.nim || row.score < 0 || row.score > 100) {
          processedRows.push({
            ...row,
            status: 'error',
            message: 'NIM atau nilai tidak valid',
          });
          errorCount++;
          continue;
        }

        const { data: student } = await supabase
          .from('students')
          .select('id, angkatan')
          .eq('nim', row.nim)
          .eq('angkatan', row.angkatan || '')
          .maybeSingle();

        if (!student || !student.id) {
          processedRows.push({
            ...row,
            status: 'error',
            message: `Mahasiswa dengan NIM ${row.nim} angkatan ${row.angkatan} tidak ditemukan`,
          });
          errorCount++;
          continue;
        }

        const { data: course } = await supabase
          .from('courses')
          .select('id')
          .eq('code', row.courseCode)
          .maybeSingle();

        if (!course || !course.id) {
          processedRows.push({
            ...row,
            status: 'error',
            message: `Mata kuliah ${row.courseCode} tidak ditemukan`,
          });
          errorCount++;
          continue;
        }

        const letterGrade = getLetterGrade(row.score);

        const { error: upsertError } = await supabase
          .from('grades')
          .upsert(
            {
              student_id: student.id,
              course_id: course.id,
              score: row.score,
              letter_grade: letterGrade,
            } as any,
            { onConflict: 'student_id,course_id' }
          );

        if (upsertError) {
          processedRows.push({
            ...row,
            status: 'error',
            message: upsertError.message,
          });
          errorCount++;
        } else {
          processedRows.push({
            ...row,
            status: 'success',
          });
          successCount++;
        }
      } catch (err) {
        processedRows.push({
          ...row,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
        errorCount++;
      }
    }

    setUploadedRows(processedRows);
    setLoading(false);
  };

  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setUploadedRows([]);
    setSelectedCourse('');
    setSelectedAngkatan('');
    setStep('select');
  };

  if (step === 'select') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Upload className="w-6 h-6 text-purple-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Upload Nilai Excel</h3>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Petunjuk Format Excel:</strong><br />
            Kolom 1: NIM (nomor identitas mahasiswa)<br />
            Kolom 2: Nilai (angka 0-100)
          </p>
        </div>

        <label className="block mb-6">
          <span className="sr-only">Pilih file Excel</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-50 file:text-purple-700
              hover:file:bg-purple-100 file:cursor-pointer"
          />
        </label>

        {file && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
            File dipilih: <strong>{file.name}</strong>
          </div>
        )}
      </div>
    );
  }

  if (step === 'course') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Upload className="w-6 h-6 text-purple-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Pilih Mata Kuliah</h3>
        </div>

        <p className="text-gray-600 mb-4">
          File: <strong>{file?.name}</strong>
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mata Kuliah
          </label>
          <button
            onClick={loadCourses}
            className="w-full text-left px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 mb-2"
          >
            {courses.length === 0 ? 'Muat daftar mata kuliah...' : 'Pilih dari daftar di bawah'}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {courses.map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course.code)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedCourse === course.code
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <p className="font-semibold text-gray-800">{course.code}</p>
                <p className="text-sm text-gray-600">{course.name}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('select')}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Kembali
          </button>
          <button
            onClick={handleCourseSelect}
            disabled={!selectedCourse || loading}
            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400"
          >
            {loading ? 'Memproses...' : 'Lanjutkan'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'angkatan') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Upload className="w-6 h-6 text-purple-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Pilih Angkatan</h3>
        </div>

        <p className="text-gray-600 mb-4">
          File: <strong>{file?.name}</strong><br />
          Mata Kuliah: <strong>{selectedCourse}</strong>
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Angkatan
          </label>
          <button
            onClick={loadAngkatan}
            className="w-full text-left px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 mb-2"
          >
            {angkatanList.length === 0 ? 'Muat daftar angkatan...' : 'Pilih dari daftar di bawah'}
          </button>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {angkatanList.map(angkatan => (
              <button
                key={angkatan}
                onClick={() => setSelectedAngkatan(angkatan)}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  selectedAngkatan === angkatan
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <p className="font-bold text-lg text-gray-800">{angkatan}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('course')}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Kembali
          </button>
          <button
            onClick={handleAngkatanSelect}
            disabled={!selectedAngkatan || loading}
            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400"
          >
            {loading ? 'Memproses...' : 'Lanjutkan'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Upload className="w-6 h-6 text-purple-600 mr-3" />
            <h3 className="text-2xl font-bold text-gray-800">Preview Data</h3>
          </div>
          <span className="text-sm text-gray-600">
            {preview.length} baris akan diupload
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Mata Kuliah:</strong> {selectedCourse}<br />
            <strong>Angkatan:</strong> {selectedAngkatan}<br />
            <strong>Total Baris:</strong> {preview.length}
          </p>
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">No</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">NIM</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Angkatan</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-700">Nilai</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {preview.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{row.nim}</td>
                  <td className="px-4 py-2 text-gray-700">{row.angkatan}</td>
                  <td className="px-4 py-2 text-center text-gray-700">{row.score}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {getLetterGrade(row.score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 10 && (
            <p className="text-sm text-gray-600 mt-2">
              +{preview.length - 10} baris lainnya tidak ditampilkan
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('angkatan')}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Kembali
          </button>
          <button
            onClick={handleUpload}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Mengupload...' : 'Upload Sekarang'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    const successCount = uploadedRows.filter(r => r.status === 'success').length;
    const errorCount = uploadedRows.filter(r => r.status === 'error').length;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {loading ? (
              <>
                <div className="w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <h3 className="text-2xl font-bold text-gray-800">Mengupload...</h3>
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-2xl font-bold text-gray-800">Upload Selesai</h3>
              </>
            )}
          </div>
          {!loading && (
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {!loading && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-sm text-green-700">Berhasil</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              <p className="text-sm text-red-700">Gagal</p>
            </div>
          </div>
        )}

        {!loading && errorCount > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">Baris yang Gagal:</h4>
            <div className="bg-red-50 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              {uploadedRows
                .filter(r => r.status === 'error')
                .map((row, idx) => (
                  <div key={idx} className="border-b border-red-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">
                      {row.nim} - Nilai: {row.score}
                    </p>
                    <p className="text-red-600">{row.message}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!loading && (
          <button
            onClick={resetForm}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Upload File Baru
          </button>
        )}
      </div>
    );
  }

  return null;
}
