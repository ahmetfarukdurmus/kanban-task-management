import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { organizationService } from '@/services/organizationService';
import type { OrganizationDto } from '@/types';

export default function RegisterPage() {
  const [username,       setUsername]       = useState('');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [organizationId, setOrganizationId] = useState<number | undefined>(undefined);
  const [organizations,  setOrganizations]  = useState<OrganizationDto[]>([]);
  const [loadingOrgs,    setLoadingOrgs]    = useState(false);
  const [loading,        setLoading]        = useState(false);

  const { register } = useAuth();
  const navigate     = useNavigate();

  useEffect(() => {
    setLoadingOrgs(true);
    organizationService
      .getAll()
      .then((data) => {
        setOrganizations(data);
        if (data.length > 0) {
          setOrganizationId(data[0].id);
        }
      })
      .catch(() => {
        const defaults: OrganizationDto[] = [
          { id: 1, name: 'Muhasebe', description: 'Mali İşler ve Muhasebe Departmanı' },
          { id: 2, name: 'Uyum & Risk', description: 'Yasal Uyum ve Risk Yönetimi Departmanı' },
        ];
        setOrganizations(defaults);
        setOrganizationId(defaults[0].id);
      })
      .finally(() => setLoadingOrgs(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password, organizationId });
      toast.success('Hesabınız başarıyla oluşturuldu.');
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50/70 px-4 py-8">
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hesap Oluşturun</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">Departmanınızı seçin ve ekibinize katılın</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Departman Seçimi */}
            <div>
              <label htmlFor="reg-org" className="field-label font-semibold text-slate-700">
                Departman / Ekip <span className="text-rose-500">*</span>
              </label>
              <select
                id="reg-org"
                value={organizationId ?? ''}
                onChange={(e) => setOrganizationId(Number(e.target.value))}
                disabled={loadingOrgs}
                className="field font-semibold text-slate-800"
                required
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.description ? `(${org.description})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Kullanıcı Adı */}
            <div>
              <label htmlFor="reg-username" className="field-label font-semibold text-slate-700">Kullanıcı Adı</label>
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

            {/* E-posta */}
            <div>
              <label htmlFor="reg-email" className="field-label font-semibold text-slate-700">E-posta</label>
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

            {/* Şifre */}
            <div>
              <label htmlFor="reg-password" className="field-label font-semibold text-slate-700">Şifre</label>
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
              className="btn-primary w-full justify-center py-2.5 mt-2 font-semibold shadow-sm hover:shadow"
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
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}
