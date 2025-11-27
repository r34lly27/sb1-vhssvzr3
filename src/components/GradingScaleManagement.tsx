import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Copy, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GradingScale {
  id: string;
  curriculum: string;
  letter_grade: string;
  min_score: number;
  max_score: number;
  grade_point: number;
  description: string;
}

interface GradingScaleForm {
  curriculum: string;
  letter_grade: string;
  min_score: string;
  max_score: string;
  grade_point: string;
  description: string;
}

export function GradingScaleManagement() {
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [curriculums, setCurriculums] = useState<string[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GradingScaleForm>({
    curriculum: '2024',
    letter_grade: 'A',
    min_score: '85',
    max_score: '100',
    grade_point: '4.00',
    description: 'Sangat Baik',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadGradingScales();
    loadCurriculums();
  }, []);

  const loadGradingScales = async () => {
    try {
      const { data, error: err } = await supabase
        .from('grading_scales')
        .select('*')
        .order('curriculum', { ascending: false })
        .order('min_score', { ascending: false });

      if (err) throw err;
      setGradingScales(data || []);

      if (data && data.length > 0 && !selectedCurriculum) {
        setSelectedCurriculum(data[0].curriculum);
      }
    } catch (err) {
      console.error('Error loading grading scales:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurriculums = async () => {
    try {
      const { data } = await supabase
        .from('grading_scales')
        .select('curriculum')
        .order('curriculum', { ascending: false });

      if (data) {
        const unique = Array.from(new Set(data.map(g => g.curriculum)));
        setCurriculums(unique);
      }
    } catch (err) {
      console.error('Error loading curriculums:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const minScore = parseFloat(formData.min_score);
    const maxScore = parseFloat(formData.max_score);
    const gradePoint = parseFloat(formData.grade_point);

    if (isNaN(minScore) || isNaN(maxScore) || isNaN(gradePoint)) {
      setError('Nilai harus berupa angka yang valid');
      return;
    }

    if (minScore < 0 || minScore > 100 || maxScore < 0 || maxScore > 100) {
      setError('Nilai harus antara 0-100');
      return;
    }

    if (minScore > maxScore) {
      setError('Nilai minimum tidak boleh lebih besar dari nilai maksimum');
      return;
    }

    if (gradePoint < 0 || gradePoint > 4) {
      setError('Grade point harus antara 0-4');
      return;
    }

    try {
      const dataToSave = {
        curriculum: formData.curriculum,
        letter_grade: formData.letter_grade,
        min_score: minScore,
        max_score: maxScore,
        grade_point: gradePoint,
        description: formData.description,
      };

      if (editingId) {
        const { error: err } = await supabase
          .from('grading_scales')
          .update(dataToSave)
          .eq('id', editingId);

        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('grading_scales')
          .insert([dataToSave]);

        if (err) throw err;
      }

      setFormData({
        curriculum: '2024',
        letter_grade: 'A',
        min_score: '85',
        max_score: '100',
        grade_point: '4.00',
        description: 'Sangat Baik',
      });
      setEditingId(null);
      setShowForm(false);
      loadGradingScales();
      loadCurriculums();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan grading scale');
    }
  };

  const handleEdit = (scale: GradingScale) => {
    setFormData({
      curriculum: scale.curriculum,
      letter_grade: scale.letter_grade,
      min_score: scale.min_score.toString(),
      max_score: scale.max_score.toString(),
      grade_point: scale.grade_point.toString(),
      description: scale.description || '',
    });
    setEditingId(scale.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus grading scale ini?')) return;

    try {
      const { error: err } = await supabase
        .from('grading_scales')
        .delete()
        .eq('id', id);

      if (err) throw err;
      loadGradingScales();
      loadCurriculums();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus grading scale');
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      curriculum: '2024',
      letter_grade: 'A',
      min_score: '85',
      max_score: '100',
      grade_point: '4.00',
      description: 'Sangat Baik',
    });
    setError('');
  };

  const handleCopyCurriculum = async (fromCurriculum: string) => {
    const newCurriculum = prompt(
      `Copy grading scale dari kurikulum "${fromCurriculum}" ke kurikulum baru.\n\nMasukkan nama kurikulum baru:`,
      ''
    );

    if (!newCurriculum || newCurriculum.trim() === '') return;

    try {
      const scalesToCopy = gradingScales.filter(s => s.curriculum === fromCurriculum);

      if (scalesToCopy.length === 0) {
        alert('Tidak ada grading scale untuk di-copy');
        return;
      }

      const newScales = scalesToCopy.map(scale => ({
        curriculum: newCurriculum.trim(),
        letter_grade: scale.letter_grade,
        min_score: scale.min_score,
        max_score: scale.max_score,
        grade_point: scale.grade_point,
        description: scale.description,
      }));

      const { error: err } = await supabase
        .from('grading_scales')
        .insert(newScales);

      if (err) throw err;

      alert(`Berhasil copy ${newScales.length} grading scale ke kurikulum "${newCurriculum}"`);
      loadGradingScales();
      loadCurriculums();
      setSelectedCurriculum(newCurriculum.trim());
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Gagal copy grading scale'));
    }
  };

  const filteredScales = selectedCurriculum
    ? gradingScales.filter(s => s.curriculum === selectedCurriculum)
    : gradingScales;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Award className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-2xl font-bold text-gray-800">Grading Scale</h3>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Grade</span>
        </button>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Tentang Grading Scale:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Setiap kurikulum dapat memiliki aturan grading yang berbeda</li>
          <li>• Grade huruf (A, B+, B, dll) ditentukan berdasarkan range nilai</li>
          <li>• Grade point digunakan untuk kalkulasi IPK</li>
          <li>• Pastikan tidak ada gap atau overlap dalam range nilai</li>
        </ul>
      </div>

      <div className="mb-6 flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Kurikulum
          </label>
          <select
            value={selectedCurriculum}
            onChange={(e) => setSelectedCurriculum(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Semua Kurikulum</option>
            {curriculums.map(curriculum => (
              <option key={curriculum} value={curriculum}>{curriculum}</option>
            ))}
          </select>
        </div>
        {selectedCurriculum && (
          <button
            onClick={() => handleCopyCurriculum(selectedCurriculum)}
            className="mt-7 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy ke Kurikulum Baru
          </button>
        )}
      </div>

      {filteredScales.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-600 mb-4">
            {selectedCurriculum
              ? `Belum ada grading scale untuk kurikulum ${selectedCurriculum}`
              : 'Belum ada grading scale'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Buat Grading Scale
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kurikulum
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Range Nilai
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade Point
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredScales.map(scale => (
                <tr key={scale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {scale.curriculum}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-lg font-bold text-gray-900">
                      {scale.letter_grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                    {scale.min_score} - {scale.max_score}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {scale.grade_point.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {scale.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                    <button
                      onClick={() => handleEdit(scale)}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(scale.id)}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingId ? 'Edit Grading Scale' : 'Tambah Grading Scale'}
              </h3>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurikulum *
                </label>
                <input
                  type="text"
                  value={formData.curriculum}
                  onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2024"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Huruf *
                </label>
                <input
                  type="text"
                  value={formData.letter_grade}
                  onChange={(e) => setFormData({ ...formData, letter_grade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="A, A-, B+, B, etc"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nilai Min *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_score}
                    onChange={(e) => setFormData({ ...formData, min_score: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="85.00"
                    min="0"
                    max="100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nilai Max *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100.00"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Point *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.grade_point}
                  onChange={(e) => setFormData({ ...formData, grade_point: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="4.00"
                  min="0"
                  max="4"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Untuk kalkulasi IPK (0.00 - 4.00)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Sangat Baik, Baik, Cukup, dll"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
