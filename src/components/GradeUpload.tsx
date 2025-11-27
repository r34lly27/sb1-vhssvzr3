import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UploadResult {
  type: 'success' | 'error';
  message: string;
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

export function GradeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadStats, setUploadStats] = useState({ success: 0, failed: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResult(null);
    } else {
      setResult({
        type: 'error',
        message: 'Silakan pilih file CSV',
      });
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setUploadStats({ success: 0, failed: 0 });

    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      let successCount = 0;
      let failedCount = 0;

      for (const row of csvData) {
        try {
          const nim = row['NIM'] || row['nim'];
          const courseCode = row['Kode Mata Kuliah'] || row['course_code'];
          const score = parseFloat(row['Nilai'] || row['score'] || '0');

          if (!nim || !courseCode || !score) {
            failedCount++;
            continue;
          }

          const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('nim', nim)
            .maybeSingle();

          if (!student || !student.id) {
            failedCount++;
            continue;
          }

          const { data: course } = await supabase
            .from('courses')
            .select('id')
            .eq('code', courseCode)
            .maybeSingle();

          if (!course || !course.id) {
            failedCount++;
            continue;
          }

          const letterGrade = getLetterGrade(score);

          const { error: upsertError } = await supabase
            .from('grades')
            .upsert(
              {
                student_id: student.id,
                course_id: course.id,
                score,
                letter_grade: letterGrade,
              } as any,
              { onConflict: 'student_id,course_id' }
            );

          if (upsertError) {
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      setUploadStats({ success: successCount, failed: failedCount });
      setResult({
        type: 'success',
        message: `Upload selesai! ${successCount} nilai berhasil diinput, ${failedCount} gagal.`,
      });
      setFile(null);
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload gagal',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <Upload className="w-6 h-6 text-purple-600 mr-3" />
        <h3 className="text-2xl font-bold text-gray-800">Upload Nilai</h3>
      </div>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Format CSV: NIM, Kode Mata Kuliah, Nilai
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Contoh format CSV:</strong><br />
            NIM,Kode Mata Kuliah,Nilai<br />
            2024001,CS101,85<br />
            2024002,CS101,90
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block mb-3">
          <span className="sr-only">Pilih file CSV</span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-50 file:text-purple-700
              hover:file:bg-purple-100"
          />
        </label>
        {file && (
          <p className="text-sm text-green-600 mt-2">
            File dipilih: {file.name}
          </p>
        )}
      </div>

      {result && (
        <div
          className={`mb-6 flex items-start p-4 rounded-lg ${
            result.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p
              className={
                result.type === 'success' ? 'text-green-800' : 'text-red-800'
              }
            >
              {result.message}
            </p>
            {result.type === 'success' && uploadStats.success > 0 && (
              <p className="text-sm text-green-700 mt-2">
                Berhasil: {uploadStats.success} | Gagal: {uploadStats.failed}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Memproses...' : 'Upload Nilai'}
      </button>
    </div>
  );
}
