import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { activityLogger } from '../lib/activityLogger';

interface AdminAuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(async () => {
        console.log('User inactive for 10 minutes, logging out...');
        await signOut();
        alert('You have been logged out due to inactivity.');
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [user]);

  const checkAdminStatus = async (userId: string) => {
    try {
      console.log('[AdminAuth] Checking admin status for user:', userId);

      const { data, error } = await supabase.rpc('is_admin', {
        user_id: userId
      });

      if (error) {
        console.error('[AdminAuth] RPC Error checking admin status:', error);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      console.log('[AdminAuth] Admin check result (RPC):', data);

      if (data === true) {
        console.log('[AdminAuth] ✓ User IS admin');
        setIsAdmin(true);
      } else {
        console.log('[AdminAuth] ✗ User is NOT admin');
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('[AdminAuth] Exception checking admin status:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      await activityLogger.logLogin(email, 'admin', false);
      throw error;
    }

    await activityLogger.logLogin(email, 'admin', true);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          id: data.user.id,
          email,
          name,
          role: 'admin',
        } as any);

      if (adminError) throw adminError;
    }
  };

  const signOut = async () => {
    if (user?.email) {
      await activityLogger.logLogout(user.email, 'admin');
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('user_role');
  };

  return (
    <AdminAuthContext.Provider value={{ user, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
