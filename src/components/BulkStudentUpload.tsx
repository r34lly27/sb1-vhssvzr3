import { useState } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileSpreadsheet, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface StudentData {
  nim: string;
  name: string;
  email: string;
  password: string;
  angkatan: string;
}

interface UploadResult {
  success: StudentData[];
  failed: Array<{ student: StudentData; error: string }>;
}

export function BulkStudentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        nim: 'STU001',
        name: 'John Doe',
        email: 'john.doe@university.edu',
        password: 'Password123',
        angkatan: '2024'
      },
      {
        nim: 'STU002',
        name: 'Jane Smith',
        email: 'jane.smith@university.edu',
        password: 'Password123',
        angkatan: '2024'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 }
    ];

    XLSX.writeFile(wb, 'student_upload_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setResult(null);
      } else {
        alert('Please select an Excel file (.xlsx or .xls)');
        e.target.value = '';
      }
    }
  };

  const validateStudentData = (data: any[]): { valid: StudentData[]; invalid: Array<{ row: number; errors: string[] }> } => {
    const valid: StudentData[] = [];
    const invalid: Array<{ row: number; errors: string[] }> = [];

    data.forEach((row, index) => {
      const errors: string[] = [];
      const rowNum = index + 2;

      if (!row.nim || String(row.nim).trim() === '') {
        errors.push('NIM is required');
      }
      if (!row.name || String(row.name).trim() === '') {
        errors.push('Name is required');
      }
      if (!row.email || String(row.email).trim() === '') {
        errors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim())) {
        errors.push('Invalid email format');
      }
      if (!row.password || String(row.password).trim() === '') {
        errors.push('Password is required');
      } else if (String(row.password).length < 6) {
        errors.push('Password must be at least 6 characters');
      }
      if (!row.angkatan || String(row.angkatan).trim() === '') {
        errors.push('Angkatan is required');
      }

      if (errors.length > 0) {
        invalid.push({ row: rowNum, errors });
      } else {
        valid.push({
          nim: String(row.nim).trim(),
          name: String(row.name).trim(),
          email: String(row.email).trim().toLowerCase(),
          password: String(row.password).trim(),
          angkatan: String(row.angkatan).trim()
        });
      }
    });

    return { valid, invalid };
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('The Excel file is empty');
        setUploading(false);
        return;
      }

      const { valid, invalid } = validateStudentData(jsonData);

      if (invalid.length > 0) {
        const errorMessages = invalid.map(
          item => `Row ${item.row}: ${item.errors.join(', ')}`
        ).join('\n');
        alert(`Validation errors found:\n\n${errorMessages}\n\nPlease fix these errors and try again.`);
        setUploading(false);
        return;
      }

      const success: StudentData[] = [];
      const failed: Array<{ student: StudentData; error: string }> = [];

      for (const student of valid) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: student.email,
            password: student.password,
          });

          if (authError) throw authError;

          if (authData.user) {
            const { error: studentError } = await supabase
              .from('students')
              .insert({
                id: authData.user.id,
                nim: student.nim,
                name: student.name,
                email: student.email,
                angkatan: student.angkatan,
              });

            if (studentError) throw studentError;
            success.push(student);
          }
        } catch (err: any) {
          failed.push({
            student,
            error: err.message || 'Unknown error'
          });
        }
      }

      setResult({ success, failed });
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      alert(`Error processing file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Student Upload</h2>
            <p className="text-gray-600 mt-1">Upload multiple student accounts using Excel file</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Instructions
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Download the Excel template by clicking the button below</li>
            <li>Fill in the student data (NIM, Name, Email, Password, Angkatan)</li>
            <li>Make sure all required fields are filled correctly</li>
            <li>Email must be unique and in valid format</li>
            <li>Password must be at least 6 characters</li>
            <li>Angkatan represents the enrollment year (e.g., 2024)</li>
            <li>Upload the completed file</li>
          </ol>
        </div>

        <div className="space-y-4">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Excel Template
          </button>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Click to select Excel file
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-gray-500 text-sm mt-2">or drag and drop</p>
            <p className="text-gray-400 text-xs mt-1">Excel files only (.xlsx, .xls)</p>
          </div>

          {file && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-5 h-5" />
                  {uploading ? 'Uploading...' : 'Upload Students'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {uploading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900 mb-2">Uploading Students...</p>
          <p className="text-gray-600">Please wait, this may take a moment</p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Upload Results</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h4 className="font-semibold text-green-900">Successful</h4>
                </div>
                <p className="text-3xl font-bold text-green-700">{result.success.length}</p>
                <p className="text-sm text-green-600 mt-1">students uploaded successfully</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-red-600" />
                  <h4 className="font-semibold text-red-900">Failed</h4>
                </div>
                <p className="text-3xl font-bold text-red-700">{result.failed.length}</p>
                <p className="text-sm text-red-600 mt-1">students failed to upload</p>
              </div>
            </div>

            {result.success.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Successfully Uploaded Students
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">NIM</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.success.map((student, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-4 py-2 text-gray-900">{student.nim}</td>
                          <td className="px-4 py-2 text-gray-900">{student.name}</td>
                          <td className="px-4 py-2 text-gray-600">{student.email}</td>
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
                  Failed Uploads
                </h4>
                <div className="bg-red-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-red-900">NIM</th>
                        <th className="px-4 py-2 text-left font-medium text-red-900">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-red-900">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-red-900">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200">
                      {result.failed.map((item, index) => (
                        <tr key={index} className="hover:bg-red-100">
                          <td className="px-4 py-2 text-red-900">{item.student.nim}</td>
                          <td className="px-4 py-2 text-red-900">{item.student.name}</td>
                          <td className="px-4 py-2 text-red-700">{item.student.email}</td>
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

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Important Notes
        </h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
          <li>Each email address must be unique across all students</li>
          <li>Students will be able to login using their email and password</li>
          <li>Make sure to save the passwords securely before uploading</li>
          <li>Failed uploads are usually due to duplicate emails or invalid data</li>
          <li>You can re-upload the failed students after fixing the errors</li>
        </ul>
      </div>
    </div>
  );
}
