import { useState, useEffect } from 'react';
import { Printer, Download, FileText, Table, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table as DocxTable, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface Student {
  id: string;
  nim: string;
  name: string;
  angkatan: string;
  email: string;
}

interface TranscriptData {
  nim: string;
  studentName: string;
  angkatan: string;
  email: string;
  courses: {
    courseCode: string;
    courseName: string;
    sks: number;
    score: number;
    letterGrade: string;
  }[];
  totalSKS: number;
  averageScore: number;
}

export function TranscriptPrint() {
  const [students, setStudents] = useState<Student[]>([]);
  const [angkatanList, setAngkatanList] = useState<string[]>([]);
  const [selectedAngkatan, setSelectedAngkatan] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'angkatan' | 'single'>('all');
  const [loading, setLoading] = useState(false);
  const [transcriptData, setTranscriptData] = useState<TranscriptData[]>([]);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadStudents();
    loadAngkatan();
  }, []);

  const loadStudents = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('id, nim, name, angkatan, email')
        .order('nim');

      setStudents(data || []);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const loadAngkatan = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('angkatan')
        .order('angkatan');

      if (data) {
        const unique = Array.from(new Set(data.map(s => s.angkatan)));
        setAngkatanList(unique);
      }
    } catch (err) {
      console.error('Error loading angkatan:', err);
    }
  };

  const fetchTranscriptData = async (): Promise<TranscriptData[]> => {
    let query = supabase
      .from('students')
      .select(`
        id,
        nim,
        name,
        angkatan,
        email,
        grades (
          score,
          letter_grade,
          course:courses (
            code,
            name,
            credits
          )
        )
      `);

    if (filterMode === 'angkatan' && selectedAngkatan) {
      query = query.eq('angkatan', selectedAngkatan);
    } else if (filterMode === 'single' && selectedStudent) {
      query = query.eq('id', selectedStudent);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transcript:', error);
      return [];
    }

    const transcripts: TranscriptData[] = (data || []).map((student: any) => {
      const courses = (student.grades || [])
        .filter((g: any) => g.course)
        .map((grade: any) => ({
          courseCode: grade.course.code,
          courseName: grade.course.name,
          sks: grade.course.credits,
          score: parseFloat(grade.score),
          letterGrade: grade.letter_grade,
        }));

      const totalSKS = courses.reduce((sum: number, c: any) => sum + c.sks, 0);
      const averageScore = courses.length > 0
        ? courses.reduce((sum: number, c: any) => sum + c.score, 0) / courses.length
        : 0;

      return {
        nim: student.nim,
        studentName: student.name,
        angkatan: student.angkatan,
        email: student.email,
        courses,
        totalSKS,
        averageScore,
      };
    });

    return transcripts;
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await fetchTranscriptData();
      setTranscriptData(data);
      setPreviewMode(true);
    } catch (err) {
      alert('Error loading data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    setLoading(true);
    try {
      const data = transcriptData.length > 0 ? transcriptData : await fetchTranscriptData();

      data.forEach((transcript, index) => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('TRANSKRIP NILAI MAHASISWA', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`NIM: ${transcript.nim}`, 20, 40);
        doc.text(`Nama: ${transcript.studentName}`, 20, 48);
        doc.text(`Angkatan: ${transcript.angkatan}`, 20, 56);
        doc.text(`Email: ${transcript.email}`, 20, 64);

        const tableData = transcript.courses.map((course, idx) => [
          idx + 1,
          course.courseCode,
          course.courseName,
          course.sks,
          course.score.toFixed(2),
          course.letterGrade,
        ]);

        autoTable(doc, {
          startY: 75,
          head: [['No', 'Kode MK', 'Nama Mata Kuliah', 'SKS', 'Nilai', 'Grade']],
          body: tableData,
          foot: [
            ['', '', 'Total SKS', transcript.totalSKS, '', ''],
            ['', '', 'Rata-rata Nilai', transcript.averageScore.toFixed(2), '', ''],
          ],
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] },
          footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
        });

        const fileName = `Transkrip_${transcript.nim}_${transcript.studentName.replace(/\s+/g, '_')}.pdf`;

        if (index === data.length - 1) {
          doc.save(fileName);
        } else {
          doc.save(fileName);
        }
      });

      alert(`Berhasil export ${data.length} transkrip ke PDF`);
    } catch (err) {
      alert('Error exporting PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    setLoading(true);
    try {
      const data = transcriptData.length > 0 ? transcriptData : await fetchTranscriptData();

      const workbook = XLSX.utils.book_new();

      data.forEach(transcript => {
        const worksheetData = [
          ['TRANSKRIP NILAI MAHASISWA'],
          [],
          ['NIM', transcript.nim],
          ['Nama', transcript.studentName],
          ['Angkatan', transcript.angkatan],
          ['Email', transcript.email],
          [],
          ['No', 'Kode MK', 'Nama Mata Kuliah', 'SKS', 'Nilai', 'Grade'],
          ...transcript.courses.map((course, idx) => [
            idx + 1,
            course.courseCode,
            course.courseName,
            course.sks,
            course.score.toFixed(2),
            course.letterGrade,
          ]),
          [],
          ['', '', 'Total SKS', transcript.totalSKS, '', ''],
          ['', '', 'Rata-rata Nilai', transcript.averageScore.toFixed(2), '', ''],
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const sheetName = `${transcript.nim}`.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      const fileName = filterMode === 'single'
        ? `Transkrip_${data[0].nim}.xlsx`
        : `Transkrip_${filterMode === 'angkatan' ? selectedAngkatan : 'Semua'}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      alert(`Berhasil export ${data.length} transkrip ke Excel`);
    } catch (err) {
      alert('Error exporting Excel: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const exportToDOCX = async () => {
    setLoading(true);
    try {
      const data = transcriptData.length > 0 ? transcriptData : await fetchTranscriptData();

      for (const transcript of data) {
        const tableRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: 'No', bold: true })] }),
              new TableCell({ children: [new Paragraph({ text: 'Kode MK', bold: true })] }),
              new TableCell({ children: [new Paragraph({ text: 'Nama Mata Kuliah', bold: true })] }),
              new TableCell({ children: [new Paragraph({ text: 'SKS', bold: true })] }),
              new TableCell({ children: [new Paragraph({ text: 'Nilai', bold: true })] }),
              new TableCell({ children: [new Paragraph({ text: 'Grade', bold: true })] }),
            ],
          }),
          ...transcript.courses.map((course, idx) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph((idx + 1).toString())] }),
                new TableCell({ children: [new Paragraph(course.courseCode)] }),
                new TableCell({ children: [new Paragraph(course.courseName)] }),
                new TableCell({ children: [new Paragraph(course.sks.toString())] }),
                new TableCell({ children: [new Paragraph(course.score.toFixed(2))] }),
                new TableCell({ children: [new Paragraph(course.letterGrade)] }),
              ],
            })
          ),
        ];

        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                text: 'TRANSKRIP NILAI MAHASISWA',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: `NIM: ${transcript.nim}` }),
              new Paragraph({ text: `Nama: ${transcript.studentName}` }),
              new Paragraph({ text: `Angkatan: ${transcript.angkatan}` }),
              new Paragraph({ text: `Email: ${transcript.email}` }),
              new Paragraph({ text: '' }),
              new DocxTable({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
              new Paragraph({ text: '' }),
              new Paragraph({ text: `Total SKS: ${transcript.totalSKS}`, bold: true }),
              new Paragraph({ text: `Rata-rata Nilai: ${transcript.averageScore.toFixed(2)}`, bold: true }),
            ],
          }],
        });

        const blob = await Packer.toBlob(doc);
        const fileName = `Transkrip_${transcript.nim}_${transcript.studentName.replace(/\s+/g, '_')}.docx`;
        saveAs(blob, fileName);
      }

      alert(`Berhasil export ${data.length} transkrip ke DOCX`);
    } catch (err) {
      alert('Error exporting DOCX: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = selectedAngkatan
    ? students.filter(s => s.angkatan === selectedAngkatan)
    : students;

  if (previewMode && transcriptData.length > 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-blue-600 mr-3" />
            <h3 className="text-2xl font-bold text-gray-800">Preview Transkrip</h3>
          </div>
          <button
            onClick={() => setPreviewMode(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Kembali
          </button>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={exportToPDF}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400"
          >
            <Download className="w-5 h-5" />
            Export PDF
          </button>
          <button
            onClick={exportToExcel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            <Table className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={exportToDOCX}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export DOCX
          </button>
        </div>

        <div className="space-y-8">
          {transcriptData.map((transcript, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-6">
              <div className="mb-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4">TRANSKRIP NILAI MAHASISWA</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold">NIM:</span> {transcript.nim}
                  </div>
                  <div>
                    <span className="font-semibold">Nama:</span> {transcript.studentName}
                  </div>
                  <div>
                    <span className="font-semibold">Angkatan:</span> {transcript.angkatan}
                  </div>
                  <div>
                    <span className="font-semibold">Email:</span> {transcript.email}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left">No</th>
                      <th className="px-4 py-3 text-left">Kode MK</th>
                      <th className="px-4 py-3 text-left">Nama Mata Kuliah</th>
                      <th className="px-4 py-3 text-center">SKS</th>
                      <th className="px-4 py-3 text-center">Nilai</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transcript.courses.map((course, courseIdx) => (
                      <tr key={courseIdx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{courseIdx + 1}</td>
                        <td className="px-4 py-3 font-medium">{course.courseCode}</td>
                        <td className="px-4 py-3">{course.courseName}</td>
                        <td className="px-4 py-3 text-center">{course.sks}</td>
                        <td className="px-4 py-3 text-center">{course.score.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-bold">{course.letterGrade}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right">Total SKS:</td>
                      <td className="px-4 py-3 text-center">{transcript.totalSKS}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right">Rata-rata Nilai:</td>
                      <td className="px-4 py-3 text-center">{transcript.averageScore.toFixed(2)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <Printer className="w-6 h-6 text-blue-600 mr-3" />
        <h3 className="text-2xl font-bold text-gray-800">Cetak Transkrip Nilai</h3>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mode Filter
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              setFilterMode('all');
              setSelectedAngkatan('');
              setSelectedStudent('');
            }}
            className={`p-4 rounded-lg border-2 transition-all ${
              filterMode === 'all'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <p className="font-semibold text-gray-800">Semua Mahasiswa</p>
            <p className="text-xs text-gray-600 mt-1">Cetak semua transkrip</p>
          </button>
          <button
            onClick={() => {
              setFilterMode('angkatan');
              setSelectedStudent('');
            }}
            className={`p-4 rounded-lg border-2 transition-all ${
              filterMode === 'angkatan'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <p className="font-semibold text-gray-800">Per Angkatan</p>
            <p className="text-xs text-gray-600 mt-1">Cetak berdasarkan angkatan</p>
          </button>
          <button
            onClick={() => {
              setFilterMode('single');
              setSelectedAngkatan('');
            }}
            className={`p-4 rounded-lg border-2 transition-all ${
              filterMode === 'single'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
          >
            <p className="font-semibold text-gray-800">Per Mahasiswa</p>
            <p className="text-xs text-gray-600 mt-1">Cetak satu mahasiswa</p>
          </button>
        </div>
      </div>

      {filterMode === 'angkatan' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pilih Angkatan
          </label>
          <select
            value={selectedAngkatan}
            onChange={(e) => setSelectedAngkatan(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Pilih Angkatan --</option>
            {angkatanList.map(angkatan => (
              <option key={angkatan} value={angkatan}>{angkatan}</option>
            ))}
          </select>
        </div>
      )}

      {filterMode === 'single' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pilih Mahasiswa
          </label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Pilih Mahasiswa --</option>
            {filteredStudents.map(student => (
              <option key={student.id} value={student.id}>
                {student.nim} - {student.name} ({student.angkatan})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={loading || (filterMode === 'angkatan' && !selectedAngkatan) || (filterMode === 'single' && !selectedStudent)}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Memuat...' : 'Preview & Cetak'}
        </button>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Informasi:</strong><br />
          - Preview akan menampilkan semua transkrip sesuai filter<br />
          - Anda bisa export ke PDF, Excel, atau DOCX<br />
          - Setiap mahasiswa akan mendapat file terpisah untuk PDF dan DOCX<br />
          - Excel akan berisi semua mahasiswa dalam satu file dengan sheet berbeda
        </p>
      </div>
    </div>
  );
}
