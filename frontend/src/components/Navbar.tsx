import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link
          to="/boards"
          className="flex items-center gap-2.5 group"
          aria-label="Panolara git"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl
                           bg-blue-600 shadow-sm
                           group-hover:bg-blue-700 transition-colors duration-200">
            <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 text-white" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
              <rect x="14" y="18" width="7" height="3"  rx="1.5" />
            </svg>
          </span>
          <span className="font-bold text-slate-900 tracking-tight text-base">
            Kanban
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* User Profile Pill */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-xs">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs text-slate-800 font-semibold">{user.username}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {isAdmin ? 'Admin' : 'Üye'}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-ghost text-slate-500 hover:text-slate-800 p-2 text-xs font-semibold gap-1.5"
                aria-label="Çıkış Yap"
                title="Oturumu Kapat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                     className="w-4 h-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
