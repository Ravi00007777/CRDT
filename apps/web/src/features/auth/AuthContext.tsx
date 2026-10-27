import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from '../../lib/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error(e); })
      .finally(() => setLoading(false));
  }, []);

  const value: AuthState = {
    user,
    loading,
    async login(email, password) {
      const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setUser(r.user);
    },
    async register(name, email, password) {
      const r = await api<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      setUser(r.user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
