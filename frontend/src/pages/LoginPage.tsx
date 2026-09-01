import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();
  const location                = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/boards';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ username, password });
      navigate(from, { replace: true });
    } catch {
      toast.error('Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl
                          bg-blue-600 shadow-md mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
              <rect x="14" y="18" width="7" height="3"  rx="1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Tekrar Hoşgeldiniz</h1>
          <p className="mt-1 text-sm text-slate-400">Kanban çalışma alanınıza giriş yapın</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="field-label">Kullanıcı Adı</label>
              <input
                id="login-username"
                autoFocus
                required
                autoComplete="username"
                placeholder="kullanici_adi"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="field-label">Şifre</label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş yapılıyor…
                </span>
              ) : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-slate-500">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
