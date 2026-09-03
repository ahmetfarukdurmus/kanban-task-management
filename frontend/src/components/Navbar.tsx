import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import type { UserSummary } from '@/types';
import TeamMembersModal from './TeamMembersModal';

function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-700' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { bg: 'bg-violet-100', text: 'text-violet-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { bg: 'bg-amber-100', text: 'text-amber-700' },
    { bg: 'bg-rose-100', text: 'text-rose-700' },
    { bg: 'bg-teal-100', text: 'text-teal-700' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function Navbar() {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers]                 = useState<UserSummary[]>([]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  const isDeptAdmin = isAdmin && !isSuperAdmin && (!!user?.organizationId || !!user?.organizationName);

  const loadUsers = () => {
    if (user) {
      userService
        .getAll()
        .then((data) => setUsers(data))
        .catch(() => { /* fallback */ });
    }
  };

  useEffect(() => {
    loadUsers();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleUsers = users.slice(0, 4);
  const remainingCount = users.length - visibleUsers.length;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo & Role / Department Badge */}
        <div className="flex items-center gap-3">
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

          {/* Clean Role & Department Badge */}
          {isSuperAdmin ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/90 shadow-xs">
              Super Admin
            </span>
          ) : isDeptAdmin ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/90 shadow-xs truncate max-w-[170px] sm:max-w-[240px]">
              {user?.organizationName} (Yönetici)
            </span>
          ) : user?.organizationName ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/90 shadow-xs truncate max-w-[150px] sm:max-w-[220px]">
              {user.organizationName}
            </span>
          ) : null}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-6">
          {user && (
            <>
              {/* ── Active Team Stack & Dropdown Popover ── */}
              {users.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTeamModalOpen(!teamModalOpen)}
                    className="hidden md:flex items-center gap-2.5 pl-3 pr-2 py-1 rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
                    title="Ekip listesini görüntülemek için tıklayın"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mr-1 group-hover:text-blue-600 transition-colors">
                      <span>Ekip</span>
                    </div>

                    <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                      {visibleUsers.map((u) => {
                        const color = getAvatarColor(u.username);
                        return (
                          <div
                            key={u.id}
                            className="relative"
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white shadow-xs relative ${color.bg} ${color.text}`}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        );
                      })}

                      {remainingCount > 0 && (
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 ring-2 ring-white shadow-xs"
                        >
                          +{remainingCount}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Dropdown Popover */}
                  <TeamMembersModal
                    isOpen={teamModalOpen}
                    onClose={() => setTeamModalOpen(false)}
                    users={users}
                    onMembersUpdated={loadUsers}
                  />
                </div>
              )}

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-xs">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs text-slate-800 font-semibold">{user.username}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {isSuperAdmin ? 'Super Admin' : isDeptAdmin ? 'Yönetici' : 'Üye'}
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
