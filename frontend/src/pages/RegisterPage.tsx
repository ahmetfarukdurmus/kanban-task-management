import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { register } = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password });
      toast.success('Hesabınız başarıyla oluşturuldu! Hoş geldiniz 🎉');
      navigate('/boards', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Kayıt işlemi başarısız oldu.';
      toast.error(msg);
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
          <h1 className="text-2xl font-bold text-slate-800">Hesap Oluşturun</h1>
          <p className="mt-1 text-sm text-slate-400">Kanban panolarınızı hemen yönetmeye başlayın</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-username" className="field-label font-semibold text-slate-600">Kullanıcı Adı</label>
              <input
                id="reg-username"
                autoFocus
                required
                minLength={3}
                maxLength={50}
                autoComplete="username"
                placeholder="kullanici_adi"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="field-label font-semibold text-slate-600">E-posta</label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                placeholder="eposta@ornek.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="field-label font-semibold text-slate-600">Şifre</label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                maxLength={120}
                autoComplete="new-password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2 font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Kayıt olunuyor…
                </span>
              ) : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-slate-500">
          Zaten bir hesabınız var mı?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}
