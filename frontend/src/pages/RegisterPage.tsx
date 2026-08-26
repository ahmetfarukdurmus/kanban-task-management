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
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password });
      toast.success('Account created! Welcome 🎉');
      navigate('/boards', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Registration failed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-mesh-purple px-4">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full
                        bg-cyan-500/8 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full
                        bg-violet-600/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl
                          bg-gradient-to-br from-violet-600 to-cyan-500 shadow-glow-purple mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
              <rect x="14" y="18" width="7" height="3"  rx="1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-white/40">Start organising your work today</p>
        </div>

        <div className="glass p-6 rounded-2xl shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-username" className="field-label">Username</label>
              <input id="reg-username" autoFocus required minLength={3} maxLength={50}
                autoComplete="username" placeholder="cool_developer"
                value={username} onChange={(e) => setUsername(e.target.value)} className="field" />
            </div>

            <div>
              <label htmlFor="reg-email" className="field-label">Email</label>
              <input id="reg-email" type="email" required
                autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </div>

            <div>
              <label htmlFor="reg-password" className="field-label">Password</label>
              <input id="reg-password" type="password" required minLength={6} maxLength={120}
                autoComplete="new-password" placeholder="At least 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </span>
              ) : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-white/30">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
