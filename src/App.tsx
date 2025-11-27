import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { Dashboard } from './components/Dashboard';
import { AdminLoginForm } from './components/AdminLoginForm';
import { AdminDashboard } from './components/AdminDashboard';

const ROLE_STORAGE_KEY = 'user_role';

function RoleSelector() {
  const [role, setRole] = useState<'student' | 'admin' | null>(() => {
    const savedRole = localStorage.getItem(ROLE_STORAGE_KEY);
    return (savedRole as 'student' | 'admin') || null;
  });
  const [autoDetecting, setAutoDetecting] = useState(false);

  const handleSetRole = (newRole: 'student' | 'admin' | null) => {
    if (newRole) {
      localStorage.setItem(ROLE_STORAGE_KEY, newRole);
    } else {
      localStorage.removeItem(ROLE_STORAGE_KEY);
    }
    setRole(newRole);
  };

  useEffect(() => {
    const detectRole = async () => {
      if (role) return;

      const savedRole = localStorage.getItem(ROLE_STORAGE_KEY);
      console.log('[RoleSelector] Detecting role from localStorage:', savedRole);
      if (savedRole) {
        setRole(savedRole as 'student' | 'admin');
      }
    };

    detectRole();
  }, [role]);

  console.log('[RoleSelector] Current role:', role);

  if (role === 'student') {
    console.log('[RoleSelector] Rendering StudentApp');
    return <StudentApp onSwitchRole={() => handleSetRole(null)} />;
  }

  if (role === 'admin') {
    console.log('[RoleSelector] Rendering AdminApp');
    return <AdminApp onSwitchRole={() => handleSetRole(null)} />;
  }

  console.log('[RoleSelector] No role, showing selector');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
            Sistem Nilai
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Pilih role untuk melanjutkan
          </p>

          <div className="space-y-4">
            <button
              onClick={() => handleSetRole('student')}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
            >
              Login Mahasiswa
            </button>
            <button
              onClick={() => handleSetRole('admin')}
              className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-lg"
            >
              Login Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentApp({ onSwitchRole }: { onSwitchRole: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('[StudentApp] Auth state:', { user: !!user, loading, email: user?.email });
  }, [user, loading]);

  if (loading) {
    console.log('[StudentApp] Still loading...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user) {
    console.log('[StudentApp] User authenticated, showing Dashboard');
    return <Dashboard />;
  }

  console.log('[StudentApp] No user, showing login form');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-6">
        {isLogin ? (
          <LoginForm onToggle={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onToggle={() => setIsLogin(true)} />
        )}
        <button
          onClick={onSwitchRole}
          className="text-blue-600 font-medium hover:text-blue-700 underline"
        >
          Kembali ke pemilihan role
        </button>
      </div>
    </div>
  );
}

function AdminApp({ onSwitchRole }: { onSwitchRole: () => void }) {
  const { user, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user && isAdmin) {
    return <AdminDashboard />;
  }

  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
              Akses Ditolak
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Akun Anda bukan admin. Hubungi administrator untuk mengaktifkan akses admin.
            </p>
            <button
              onClick={onSwitchRole}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-6">
        <AdminLoginForm onToggle={() => {}} />
        <button
          onClick={onSwitchRole}
          className="text-purple-600 font-medium hover:text-purple-700 underline"
        >
          Kembali ke pemilihan role
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <RoleSelector />
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
