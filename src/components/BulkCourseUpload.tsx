import { useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface CourseRow {
  code: string;
  name: string;
  credits: number;
  curriculum: string;
  semester?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  data: CourseRow[];
}

export function BulkCourseUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        'Kode MK': 'RMIK101',
        'Nama Mata Kuliah': 'Pengantar Rekam Medis',
        'SKS': 3,
        'Kurikulum': '2024',
        'Semester': 1,
      },
      {
        'Kode MK': 'RMIK102',
        'Nama Mata Kuliah': 'Anatomi Dasar',
        'SKS': 4,
        'Kurikulum': '2024',
        'Semester': 1,
      },
      {
        'Kode MK': 'RMIK201',
        'Nama Mata Kuliah': 'Sistem Klasifikasi Penyakit',
        'SKS': 3,
        'Kurikulum': '2024',
        'Semester': 3,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Mata Kuliah');

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 40 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.writeFile(workbook, 'Template_Upload_Mata_Kuliah.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setUploadResult(null);
    }
  };

  const validateData = (data: any[]): ValidationResult => {
    const errors: string[] = [];
    const validData: CourseRow[] = [];

    if (data.length === 0) {
      errors.push('File Excel kosong atau tidak memiliki data');
      return { valid: false, errors, data: [] };
    }

    data.forEach((row, index) => {
      const rowNum = index + 2;
      const code = row['Kode MK']?.toString().trim();
      const name = row['Nama Mata Kuliah']?.toString().trim();
      const credits = row['SKS'];
      const curriculum = row['Kurikulum']?.toString().trim();
      const semester = row['Semester'];

      if (!code) {
        errors.push(`Baris ${rowNum}: Kode MK tidak boleh kosong`);
        return;
      }

      if (!name) {
        errors.push(`Baris ${rowNum}: Nama Mata Kuliah tidak boleh kosong`);
        return;
      }

      if (!credits || isNaN(credits) || credits < 1 || credits > 8) {
        errors.push(`Baris ${rowNum}: SKS harus berupa angka antara 1-8`);
        return;
      }

      if (!curriculum) {
        errors.push(`Baris ${rowNum}: Kurikulum tidak boleh kosong`);
        return;
      }

      if (semester && (isNaN(semester) || semester < 1 || semester > 8)) {
        errors.push(`Baris ${rowNum}: Semester harus berupa angka antara 1-8`);
        return;
      }

      validData.push({
        code,
        name,
        credits: parseInt(credits),
        curriculum,
        semester: semester ? parseInt(semester) : undefined,
      });
    });

    const duplicates = validData.reduce((acc, course, idx) => {
      const duplicate = validData.findIndex(
        (c, i) => i > idx && c.code === course.code && c.curriculum === course.curriculum
      );
      if (duplicate > -1) {
        acc.push(`Kode MK "${course.code}" duplikat untuk kurikulum "${course.curriculum}"`);
      }
      return acc;
    }, [] as string[]);

    errors.push(...duplicates);

    return {
      valid: errors.length === 0,
      errors,
      data: validData,
    };
  };

  const handleValidate = async () => {
    if (!file) return;

    setUploading(true);
    setValidationResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const result = validateData(jsonData);
      setValidationResult(result);
    } catch (err) {
      alert('Error membaca file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!validationResult || !validationResult.valid) return;

    setUploading(true);
    setUploadResult(null);

    try {
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const course of validationResult.data) {
        try {
          const { data: existing } = await supabase
            .from('courses')
            .select('id')
            .eq('code', course.code)
            .eq('curriculum', course.curriculum)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('courses')
              .update({
                name: course.name,
                credits: course.credits,
                academic_year: course.curriculum,
                semester: course.semester || 1,
              })
              .eq('id', existing.id);

            if (error) {
              failedCount++;
              errors.push(`${course.code} (${course.curriculum}): Update gagal - ${error.message}`);
            } else {
              successCount++;
            }
          } else {
            const { error } = await supabase
              .from('courses')
              .insert({
                code: course.code,
                name: course.name,
                credits: course.credits,
                curriculum: course.curriculum,
                academic_year: course.curriculum,
                semester: course.semester || 1,
              });

            if (error) {
              failedCount++;
              errors.push(`${course.code} (${course.curriculum}): Insert gagal - ${error.message}`);
            } else {
              successCount++;
            }
          }
        } catch (err) {
          failedCount++;
          errors.push(`${course.code} (${course.curriculum}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      setUploadResult({ success: successCount, failed: failedCount, errors });

      if (failedCount === 0) {
        setFile(null);
        setValidationResult(null);
      }
    } catch (err) {
      alert('Error upload: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FileSpreadsheet className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Upload Mata Kuliah (Excel)</h3>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          Download Template
        </button>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Format Excel:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Kode MK:</strong> Kode mata kuliah (contoh: RMIK101)</li>
          <li>• <strong>Nama Mata Kuliah:</strong> Nama lengkap mata kuliah</li>
          <li>• <strong>SKS:</strong> Jumlah SKS (1-8)</li>
          <li>• <strong>Kurikulum:</strong> Tahun kurikulum (contoh: 2024, 2023)</li>
          <li>• <strong>Semester:</strong> Semester 1-8 (1,3,5,7=Ganjil/Gasal; 2,4,6,8=Genap), opsional</li>
        </ul>
        <p className="text-sm text-blue-800 mt-3">
          <strong>Note:</strong> Jika mata kuliah dengan kode dan kurikulum yang sama sudah ada, data akan di-update.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload File Excel
        </label>
        <div className="flex gap-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleValidate}
            disabled={!file || uploading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {uploading ? 'Validasi...' : 'Validasi Data'}
          </button>
        </div>
        {file && (
          <p className="text-sm text-gray-600 mt-2">
            File dipilih: <strong>{file.name}</strong>
          </p>
        )}
      </div>

      {validationResult && (
        <div className={`mb-6 p-4 rounded-lg ${validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center mb-3">
            {validationResult.valid ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600 mr-2" />
                <h4 className="text-lg font-semibold text-green-900">Validasi Berhasil</h4>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-600 mr-2" />
                <h4 className="text-lg font-semibold text-red-900">Validasi Gagal</h4>
              </>
            )}
          </div>

          {validationResult.valid ? (
            <>
              <p className="text-green-800 mb-4">
                <strong>{validationResult.data.length}</strong> mata kuliah siap di-upload
              </p>
              <div className="bg-white rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode MK</th>
                      <th className="px-3 py-2 text-left">Nama Mata Kuliah</th>
                      <th className="px-3 py-2 text-center">SKS</th>
                      <th className="px-3 py-2 text-center">Kurikulum</th>
                      <th className="px-3 py-2 text-center">Semester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {validationResult.data.map((course, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{course.code}</td>
                        <td className="px-3 py-2">{course.name}</td>
                        <td className="px-3 py-2 text-center">{course.credits}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {course.curriculum}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{course.semester || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                <Upload className="w-5 h-5 inline mr-2" />
                {uploading ? 'Mengupload...' : 'Upload Mata Kuliah'}
              </button>
            </>
          ) : (
            <div className="text-red-800">
              <p className="font-medium mb-2">Ditemukan {validationResult.errors.length} error:</p>
              <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
                {validationResult.errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {uploadResult && (
        <div className={`p-4 rounded-lg ${uploadResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <h4 className="text-lg font-semibold mb-3">
            {uploadResult.failed === 0 ? '✅ Upload Selesai' : '⚠️ Upload Selesai dengan Warning'}
          </h4>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm text-gray-600">Berhasil</p>
              <p className="text-2xl font-bold text-green-600">{uploadResult.success}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-sm text-gray-600">Gagal</p>
              <p className="text-2xl font-bold text-red-600">{uploadResult.failed}</p>
            </div>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="bg-white rounded-lg p-3">
              <p className="font-medium text-red-800 mb-2">Error Details:</p>
              <ul className="space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto">
                {uploadResult.errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Download template Excel terlebih dahulu untuk format yang benar</li>
          <li>• Pastikan semua kolom wajib terisi (Kode MK, Nama, SKS, Kurikulum)</li>
          <li>• Kurikulum digunakan untuk memisahkan mata kuliah per angkatan</li>
          <li>• Jika kode MK + kurikulum sudah ada, data akan di-update</li>
          <li>• Gunakan validasi sebelum upload untuk menghindari error</li>
        </ul>
      </div>
    </div>
  );
}
