import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-dark-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/boards"
          className="flex items-center gap-2.5 group"
          aria-label="Go to boards"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg
                           bg-gradient-to-br from-violet-600 to-cyan-500 shadow-glow-sm
                           group-hover:shadow-glow-purple transition-shadow duration-300">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
              <rect x="14" y="18" width="7" height="3"  rx="1.5" />
            </svg>
          </span>
          <span className="font-bold text-white tracking-tight">
            Kanban
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* Avatar + username */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full
                                 bg-gradient-to-br from-violet-500 to-cyan-400
                                 text-xs font-bold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-white/80 font-medium">{user.username}</span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="btn-ghost text-white/50 hover:text-white"
                aria-label="Logout"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                     className="w-4 h-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
