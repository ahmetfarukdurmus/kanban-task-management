import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthUser, LoginRequest, RegisterRequest } from '@/types';
import { authApi } from '@/api/authApi';
import { TOKEN_KEY } from '@/api/axiosClient';
import { queryClient } from '@/queryClient';

/* ── Context shape ────────────────────────────────────────────────── */
interface AuthContextType {
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isAdmin:         boolean;   // true when user.role === 'ROLE_ADMIN'
  isLoading:       boolean;
  login:           (data: LoginRequest)    => Promise<void>;
  register:        (data: RegisterRequest) => Promise<void>;
  logout:          () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = 'kanban_user';

/* ── Provider ─────────────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Rehydrate from localStorage on first render */
  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token  = localStorage.getItem(TOKEN_KEY);
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((token: string, authUser: AuthUser) => {
    queryClient.clear();
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    persist(res.token, {
      id:               res.id,
      username:         res.username,
      email:            res.email,
      role:             res.role,
      organizationId:   res.organizationId,
      organizationName: res.organizationName,
    });
  }, [persist]);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    persist(res.token, {
      id:               res.id,
      username:         res.username,
      email:            res.email,
      role:             res.role,
      organizationId:   res.organizationId,
      organizationName: res.organizationName,
    });
  }, [persist]);

  const logout = useCallback(() => {
    queryClient.clear();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin:         user?.role === 'ROLE_ADMIN',
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook ─────────────────────────────────────────────────────────── */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
