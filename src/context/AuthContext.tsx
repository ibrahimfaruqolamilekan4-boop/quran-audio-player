import React, { createContext, useContext, useState, useEffect } from 'react';
import { appApi, type AppUser } from '../lib/api';

interface AuthContextType {
  user: AppUser | null;
  role: 'user' | 'admin' | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookie on first load.
  useEffect(() => {
    let cancelled = false;
    appApi<{ user: AppUser | null }>('/auth/me')
      .then(data => { if (!cancelled) setUser(data.user); })
      .catch(err => console.error('Failed to restore session', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, pass: string) => {
    const data = await appApi<{ user: AppUser }>('/auth/login', { method: 'POST', body: { email, password: pass } });
    setUser(data.user);
  };

  const signup = async (email: string, pass: string, name: string) => {
    const data = await appApi<{ user: AppUser }>('/auth/signup', { method: 'POST', body: { email, password: pass, name } });
    setUser(data.user);
  };

  const logOut = async () => {
    try {
      await appApi('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, login, signup, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
