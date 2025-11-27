import { useState, useEffect, Fragment } from 'react';
import { FileSpreadsheet, Printer, Download, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  curriculum: string;
}

interface Grade {
  score: number;
  letter_grade: string;
  course_id: string;
  student_id: string;
}

interface StudentGrade {
  student_id: string;
  nim: string;
  name: string;
  angkatan: string;
  courses: {
    [courseId: string]: {
      score: number;
      letter_grade: string;
      grade_point: number;
      credits: number;
    };
  };
  totalScore: number;
  totalGradePoint: number;
  totalCredits: number;
  gpa: number;
  rank: number;
}

export function SemesterGradeReport() {
  const [angkatanList, setAngkatanList] = useState<string[]>([]);
  const [semesterList, setSemesterList] = useState<number[]>([]);
  const [selectedAngkatan, setSelectedAngkatan] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curriculumFilter, setCurriculumFilter] = useState<string>('');
  const [sortField, setSortField] = useState<'nim' | 'name' | 'rank'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadAngkatanList();
    loadSemesterList();
  }, []);

  const loadAngkatanList = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('angkatan')
        .order('angkatan', { ascending: false });

      if (data) {
        const unique = Array.from(new Set(data.map(s => s.angkatan))).filter(Boolean);
        setAngkatanList(unique);
        if (unique.length > 0) {
          setSelectedAngkatan(unique[0]);
        }
      }
    } catch (err) {
      console.error('Error loading angkatan:', err);
    }
  };

  const loadSemesterList = async () => {
    try {
      const { data } = await supabase
        .from('courses')
        .select('semester')
        .order('semester');

      if (data) {
        const unique = Array.from(new Set(data.map(c => c.semester))).filter(Boolean);
        setSemesterList(unique);
      }
    } catch (err) {
      console.error('Error loading semesters:', err);
    }
  };

  const getGradePoint = async (score: number, curriculum: string): Promise<number> => {
    try {
      const { data } = await supabase
        .from('grading_scales')
        .select('grade_point')
        .eq('curriculum', curriculum)
        .lte('min_score', score)
        .gte('max_score', score)
        .maybeSingle();

      return data?.grade_point || 0;
    } catch (err) {
      console.error('Error getting grade point:', err);
      return 0;
    }
  };

  const loadReport = async () => {
    if (!selectedAngkatan || !selectedSemester) {
      alert('Pilih angkatan dan semester terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      const curriculum = curriculumFilter || selectedAngkatan;

      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('semester', selectedSemester)
        .eq('curriculum', curriculum)
        .order('code');

      if (!coursesData || coursesData.length === 0) {
        alert(`Tidak ada mata kuliah untuk semester ${selectedSemester} kurikulum ${curriculum}`);
        setLoading(false);
        return;
      }

      setCourses(coursesData);

      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('angkatan', selectedAngkatan)
        .order('nim');

      if (!studentsData || studentsData.length === 0) {
        alert('Tidak ada mahasiswa untuk angkatan ini');
        setLoading(false);
        return;
      }

      const { data: gradesData } = await supabase
        .from('grades')
        .select('*')
        .in('course_id', coursesData.map(c => c.id))
        .in('student_id', studentsData.map(s => s.id));

      const studentGradesMap: { [key: string]: StudentGrade } = {};

      for (const student of studentsData) {
        studentGradesMap[student.id] = {
          student_id: student.id,
          nim: student.nim,
          name: student.name,
          angkatan: student.angkatan,
          courses: {},
          totalScore: 0,
          totalGradePoint: 0,
          totalCredits: 0,
          gpa: 0,
          rank: 0,
        };
      }

      for (const grade of gradesData || []) {
        const course = coursesData.find(c => c.id === grade.course_id);
        if (course && studentGradesMap[grade.student_id]) {
          const gradePoint = await getGradePoint(grade.score, curriculum);

          studentGradesMap[grade.student_id].courses[grade.course_id] = {
            score: grade.score,
            letter_grade: grade.letter_grade,
            grade_point: gradePoint,
            credits: course.credits,
          };
        }
      }

      const studentsList: StudentGrade[] = Object.values(studentGradesMap).map(student => {
        let totalScore = 0;
        let totalWeightedGradePoint = 0;
        let totalCredits = 0;
        let courseCount = 0;

        for (const courseId in student.courses) {
          const courseGrade = student.courses[courseId];
          totalScore += courseGrade.score;
          totalWeightedGradePoint += courseGrade.grade_point * courseGrade.credits;
          totalCredits += courseGrade.credits;
          courseCount++;
        }

        return {
          ...student,
          totalScore,
          totalGradePoint: totalWeightedGradePoint,
          totalCredits,
          gpa: totalCredits > 0 ? totalWeightedGradePoint / totalCredits : 0,
        };
      });

      studentsList.sort((a, b) => {
        if (b.gpa !== a.gpa) return b.gpa - a.gpa;
        if (b.totalGradePoint !== a.totalGradePoint) return b.totalGradePoint - a.totalGradePoint;
        return b.totalScore - a.totalScore;
      });

      studentsList.forEach((student, index) => {
        student.rank = index + 1;
      });

      setStudentGrades(studentsList);
    } catch (err) {
      console.error('Error loading report:', err);
      alert('Error loading report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'nim' | 'name' | 'rank') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedStudents = () => {
    const sorted = [...studentGrades];

    sorted.sort((a, b) => {
      let compareValue = 0;

      if (sortField === 'nim') {
        compareValue = a.nim.localeCompare(b.nim);
      } else if (sortField === 'name') {
        compareValue = a.name.localeCompare(b.name);
      } else if (sortField === 'rank') {
        compareValue = a.rank - b.rank;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  };

  const sortedStudentGrades = getSortedStudents();

  const exportToExcel = () => {
    const worksheetData: any[] = [];

    const headerRow1 = ['No', 'NIM', 'Nama Mahasiswa'];
    courses.forEach(course => {
      headerRow1.push(course.code, '', '', '');
    });
    headerRow1.push('Total Nilai', 'Total Grade Point', 'Total SKS', 'IPK', 'Peringkat');

    const headerRow2 = ['', '', ''];
    courses.forEach(() => {
      headerRow2.push('Nilai', 'Grade', 'GP', 'SKS');
    });
    headerRow2.push('', '', '', '', '');

    worksheetData.push(headerRow1);
    worksheetData.push(headerRow2);

    sortedStudentGrades.forEach((student, index) => {
      const row = [index + 1, student.nim, student.name];

      courses.forEach(course => {
        const grade = student.courses[course.id];
        if (grade) {
          row.push(
            grade.score,
            grade.letter_grade,
            grade.grade_point.toFixed(2),
            grade.credits
          );
        } else {
          row.push('-', '-', '-', '-');
        }
      });

      row.push(
        student.totalScore.toFixed(2),
        student.totalGradePoint.toFixed(2),
        student.totalCredits,
        student.gpa.toFixed(2),
        student.rank
      );

      worksheetData.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Apply cell styling for score highlighting
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    for (let row = 2; row < worksheetData.length; row++) { // Start from row 2 (after headers)
      let colIndex = 3; // Start after No, NIM, Nama

      courses.forEach(course => {
        const studentIndex = row - 2;
        const student = sortedStudentGrades[studentIndex];
        const grade = student?.courses[course.id];

        if (grade && grade.score < 75) {
          const scoreCell = XLSX.utils.encode_cell({ r: row, c: colIndex });
          const gradeCell = XLSX.utils.encode_cell({ r: row, c: colIndex + 1 });

          const fillColor = grade.score < 70 ? 'FFCCCC' : 'FFFFCC'; // Red or Yellow
          const fontColor = grade.score < 70 ? 'CC0000' : 'CC8800'; // Dark red or Dark yellow

          if (!worksheet[scoreCell]) worksheet[scoreCell] = { t: 'n', v: grade.score };
          if (!worksheet[gradeCell]) worksheet[gradeCell] = { t: 's', v: grade.letter_grade };

          worksheet[scoreCell].s = {
            fill: { fgColor: { rgb: fillColor } },
            font: { bold: true, color: { rgb: fontColor } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };

          worksheet[gradeCell].s = {
            fill: { fgColor: { rgb: fillColor } },
            font: { bold: true, color: { rgb: fontColor } },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }

        colIndex += 4; // Move to next course (Nilai, Grade, GP, SKS)
      });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Semester ${selectedSemester}`);

    XLSX.writeFile(
      workbook,
      `Nilai_Semester_${selectedSemester}_Angkatan_${selectedAngkatan}.xlsx`
    );
  };

  const exportToPDF = () => {
    // Calculate dynamic width based on number of courses
    const baseWidth = 100; // For No, NIM, Nama, Totals, IPK, Rank
    const courseWidth = courses.length * 40; // 40mm per course (4 columns x 10mm)
    const totalWidth = baseWidth + courseWidth;

    // Use custom page size with dynamic width
    const pageWidth = Math.max(297, totalWidth); // Minimum A4 landscape width (297mm)
    const pageHeight = 210; // A4 landscape height

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pageWidth, pageHeight],
    });

    doc.setFontSize(16);
    doc.text(`Nilai Semester ${selectedSemester} - Angkatan ${selectedAngkatan}`, 14, 15);

    doc.setFontSize(10);
    doc.text(`Kurikulum: ${curriculumFilter || selectedAngkatan}`, 14, 22);

    // Build headers with course names
    const headerRow1: any[] = [
      { content: 'No', rowSpan: 2 },
      { content: 'NIM', rowSpan: 2 },
      { content: 'Nama', rowSpan: 2 },
    ];

    courses.forEach(course => {
      headerRow1.push({
        content: `${course.code}\n${course.name}`,
        colSpan: 4,
      });
    });

    headerRow1.push(
      { content: 'Total\nNilai', rowSpan: 2 },
      { content: 'Total\nGP', rowSpan: 2 },
      { content: 'SKS', rowSpan: 2 },
      { content: 'IPK', rowSpan: 2 },
      { content: 'Rank', rowSpan: 2 }
    );

    const headerRow2: string[] = ['', '', ''];
    courses.forEach(() => {
      headerRow2.push('Nilai', 'Grade', 'GP', 'SKS');
    });
    headerRow2.push('', '', '', '', '');

    const headers = [headerRow1, headerRow2];

    const tableData = sortedStudentGrades.map((student, index) => {
      const row = [
        (index + 1).toString(),
        student.nim,
        student.name,
      ];

      courses.forEach(course => {
        const grade = student.courses[course.id];
        if (grade) {
          row.push(
            grade.score.toString(),
            grade.letter_grade,
            grade.grade_point.toFixed(2),
            grade.credits.toString()
          );
        } else {
          row.push('-', '-', '-', '-');
        }
      });

      row.push(
        student.totalScore.toFixed(2),
        student.totalGradePoint.toFixed(2),
        student.totalCredits.toString(),
        student.gpa.toFixed(2),
        student.rank.toString()
      );

      return row;
    });

    // Build column styles dynamically
    const columnStyles: any = {
      0: { cellWidth: 10, halign: 'center' }, // No
      1: { cellWidth: 25, halign: 'left' }, // NIM
      2: { cellWidth: 45, halign: 'left' }, // Nama
    };

    let colIndex = 3;
    courses.forEach(() => {
      columnStyles[colIndex] = { cellWidth: 12, halign: 'center' }; // Nilai
      columnStyles[colIndex + 1] = { cellWidth: 12, halign: 'center' }; // Grade
      columnStyles[colIndex + 2] = { cellWidth: 10, halign: 'center' }; // GP
      columnStyles[colIndex + 3] = { cellWidth: 10, halign: 'center' }; // SKS
      colIndex += 4;
    });

    // Total columns
    columnStyles[colIndex] = { cellWidth: 15, halign: 'center', fontStyle: 'bold' }; // Total Nilai
    columnStyles[colIndex + 1] = { cellWidth: 15, halign: 'center', fontStyle: 'bold' }; // Total GP
    columnStyles[colIndex + 2] = { cellWidth: 10, halign: 'center', fontStyle: 'bold' }; // SKS
    columnStyles[colIndex + 3] = { cellWidth: 15, halign: 'center', fontStyle: 'bold', fontSize: 9 }; // IPK
    columnStyles[colIndex + 4] = { cellWidth: 10, halign: 'center', fontStyle: 'bold' }; // Rank

    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 3,
      },
      columnStyles: columnStyles,
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: function(data) {
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          const colIndex = data.column.index;

          // Total columns styling
          const totalColStart = 3 + (courses.length * 4);
          if (colIndex >= totalColStart && colIndex < totalColStart + 3) {
            data.cell.styles.fillColor = [255, 248, 220]; // Light yellow for totals
            data.cell.styles.fontStyle = 'bold';
          }

          // IPK column styling
          if (colIndex === totalColStart + 3) {
            data.cell.styles.fillColor = [220, 255, 220]; // Light green for IPK
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9;
          }

          // Rank column styling
          if (colIndex === totalColStart + 4) {
            data.cell.styles.fontStyle = 'bold';
          }

          // Calculate which course column this is (after No, NIM, Nama)
          if (colIndex >= 3 && colIndex < totalColStart) {
            const relativeCourseCol = (colIndex - 3) % 4;
            const courseIndex = Math.floor((colIndex - 3) / 4);

            // Check if this is a Nilai (0) or Grade (1) column
            if ((relativeCourseCol === 0 || relativeCourseCol === 1) && courseIndex < courses.length) {
              const student = sortedStudentGrades[rowIndex];
              const course = courses[courseIndex];
              const grade = student?.courses[course.id];

              if (grade && grade.score < 75) {
                if (grade.score < 70) {
                  // Red highlight
                  data.cell.styles.fillColor = [255, 204, 204];
                  data.cell.styles.textColor = [204, 0, 0];
                  data.cell.styles.fontStyle = 'bold';
                } else {
                  // Yellow highlight
                  data.cell.styles.fillColor = [255, 255, 204];
                  data.cell.styles.textColor = [204, 136, 0];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          }
        }

        // Header styling for course names
        if (data.section === 'head' && data.row.index === 0) {
          if (data.column.index >= 3) {
            const courseIndex = Math.floor((data.column.index - 3) / 4);
            if (courseIndex < courses.length) {
              data.cell.styles.fillColor = [52, 152, 219]; // Blue for course headers
              data.cell.styles.fontSize = 7;
            }
          }
        }
      },
      margin: { top: 28, left: 10, right: 10, bottom: 10 },
      tableWidth: 'auto',
    });

    doc.save(`Nilai_Semester_${selectedSemester}_Angkatan_${selectedAngkatan}.pdf`);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TrendingUp className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Laporan Nilai Semester</h3>
        </div>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Tentang Laporan:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Menampilkan nilai seluruh mahasiswa dalam satu semester</li>
          <li>• Format landscape dengan mata kuliah memanjang ke kanan</li>
          <li>• Setiap mata kuliah menampilkan: Nilai, Grade, Grade Point, SKS</li>
          <li>• Menampilkan Total Nilai, Total Grade Point, IPK, dan Peringkat</li>
          <li>• Peringkat berdasarkan IPK → Total Grade Point → Total Nilai</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Angkatan *
          </label>
          <select
            value={selectedAngkatan}
            onChange={(e) => setSelectedAngkatan(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Pilih Angkatan</option>
            {angkatanList.map(angkatan => (
              <option key={angkatan} value={angkatan}>{angkatan}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Semester *
          </label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {semesterList.map(sem => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kurikulum (opsional)
          </label>
          <input
            type="text"
            value={curriculumFilter}
            onChange={(e) => setCurriculumFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Default = angkatan"
          />
          <p className="text-xs text-gray-500 mt-1">Kosongkan untuk menggunakan angkatan sebagai kurikulum</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={loadReport}
          disabled={loading || !selectedAngkatan}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {loading ? 'Memuat...' : 'Tampilkan Laporan'}
        </button>

        {studentGrades.length > 0 && (
          <>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Export Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export PDF
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
          </>
        )}
      </div>

      {studentGrades.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg" id="report-content">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold w-[60px]">
                  No
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-left font-semibold min-w-[120px]">
                  <button
                    onClick={() => handleSort('nim')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    NIM
                    {sortField === 'nim' ? (
                      sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                    ) : (
                      <ArrowUpDown size={16} className="text-gray-400" />
                    )}
                  </button>
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-left font-semibold min-w-[200px]">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    Nama Mahasiswa
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                    ) : (
                      <ArrowUpDown size={16} className="text-gray-400" />
                    )}
                  </button>
                </th>
                {courses.map(course => (
                  <th key={course.id} colSpan={4} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-blue-50">
                    {course.code}
                    <div className="text-xs font-normal text-gray-600">{course.name}</div>
                  </th>
                ))}
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                  Total<br/>Nilai
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                  Total<br/>Grade Point
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                  Total<br/>SKS
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-green-50">
                  IPK
                </th>
                <th rowSpan={2} className="px-3 py-2 border border-gray-300 text-center font-semibold bg-gray-100">
                  Peringkat
                </th>
              </tr>
              <tr>
                {courses.map(course => (
                  <Fragment key={`sub-${course.id}`}>
                    <th className="px-2 py-1 border border-gray-300 text-center text-xs bg-gray-50">Nilai</th>
                    <th className="px-2 py-1 border border-gray-300 text-center text-xs bg-gray-50">Grade</th>
                    <th className="px-2 py-1 border border-gray-300 text-center text-xs bg-gray-50">GP</th>
                    <th className="px-2 py-1 border border-gray-300 text-center text-xs bg-gray-50">SKS</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStudentGrades.map((student, idx) => (
                <tr key={student.student_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 border border-gray-300 text-center">{idx + 1}</td>
                  <td className="px-3 py-2 border border-gray-300">{student.nim}</td>
                  <td className="px-3 py-2 border border-gray-300">{student.name}</td>
                  {courses.map(course => {
                    const grade = student.courses[course.id];
                    if (grade) {
                      const getScoreColor = (score: number) => {
                        if (score < 70) return 'bg-red-100 text-red-800 font-bold';
                        if (score < 75) return 'bg-yellow-100 text-yellow-800 font-bold';
                        return '';
                      };

                      const scoreColorClass = getScoreColor(grade.score);

                      return (
                        <Fragment key={`${student.student_id}-${course.id}`}>
                          <td className={`px-2 py-2 border border-gray-300 text-center ${scoreColorClass}`}>
                            {grade.score}
                          </td>
                          <td className={`px-2 py-2 border border-gray-300 text-center font-semibold ${scoreColorClass}`}>
                            {grade.letter_grade}
                          </td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{grade.grade_point.toFixed(2)}</td>
                          <td className="px-2 py-2 border border-gray-300 text-center">{grade.credits}</td>
                        </Fragment>
                      );
                    } else {
                      return (
                        <Fragment key={`${student.student_id}-${course.id}`}>
                          <td className="px-2 py-2 border border-gray-300 text-center text-gray-400">-</td>
                          <td className="px-2 py-2 border border-gray-300 text-center text-gray-400">-</td>
                          <td className="px-2 py-2 border border-gray-300 text-center text-gray-400">-</td>
                          <td className="px-2 py-2 border border-gray-300 text-center text-gray-400">-</td>
                        </Fragment>
                      );
                    }
                  })}
                  <td className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                    {student.totalScore.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                    {student.totalGradePoint.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-semibold bg-yellow-50">
                    {student.totalCredits}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-bold text-lg bg-green-50">
                    {student.gpa.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 border border-gray-300 text-center font-semibold">
                    {student.rank}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && studentGrades.length === 0 && selectedAngkatan && (
        <div className="text-center py-12 text-gray-500">
          <p>Belum ada data. Klik "Tampilkan Laporan" untuk memuat data.</p>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-content, #report-content * {
            visibility: visible;
          }
          #report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: landscape;
            margin: 10mm;
          }
          table {
            font-size: 8pt;
          }
          th, td {
            padding: 2px 4px !important;
          }
        }
      `}</style>
    </div>
  );
}
