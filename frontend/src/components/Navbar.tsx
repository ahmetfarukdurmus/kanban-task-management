import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { searchService } from '@/services/searchService';
import type { TaskSearchDto, UserSummary } from '@/types';
import TeamMembersModal from './TeamMembersModal';
import { SearchIcon } from './icons';

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

const PRIORITY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Yüksek' },
  MEDIUM: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Orta' },
  LOW:    { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', label: 'Düşük' },
};

export default function Navbar() {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers]                 = useState<UserSummary[]>([]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Global Quick Task Search state
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState<TaskSearchDto[]>([]);
  const [isSearching, setIsSearching]         = useState(false);
  const [isDropdownOpen, setIsDropdownOpen]   = useState(false);
  const [selectedIndex, setSelectedIndex]     = useState(-1);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef     = useRef<HTMLInputElement>(null);

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

  // Global Cmd+K / Ctrl+K shortcut listener -> focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim().length >= 2) {
          setIsDropdownOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced task search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setIsDropdownOpen(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchService.searchTasks(trimmed);
        setSearchResults(results || []);
        setSelectedIndex(-1);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTask = (task: TaskSearchDto) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    if (task.boardId) {
      navigate(`/boards/${task.boardId}?taskId=${task.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || searchResults.length === 0) {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectTask(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        handleSelectTask(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleUsers = users.slice(0, 4);
  const remainingCount = users.length - visibleUsers.length;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

        {/* Left Side: Logo, Role / Department Badge & Nav Links */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <Link
            to="/boards"
            className="flex items-center gap-2.5 group"
            aria-label="Boards sayfasına git"
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
            <span className="font-bold text-slate-900 tracking-tight text-base hidden sm:inline">
              Kanban
            </span>
          </Link>

          {/* Clean Role & Department Badge */}
          {isSuperAdmin ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/90 shadow-xs">
              Super Admin
            </span>
          ) : isDeptAdmin ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/90 shadow-xs truncate max-w-[140px] sm:max-w-[200px]">
              {user?.organizationName} (Yönetici)
            </span>
          ) : user?.organizationName ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/90 shadow-xs truncate max-w-[120px] sm:max-w-[180px]">
              {user.organizationName}
            </span>
          ) : null}

          {/* Navigation Links */}
          {user && (
            <nav className="hidden lg:flex items-center gap-1.5 ml-1 pl-2.5 border-l border-slate-200">
              <Link
                to="/boards"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  location.pathname.startsWith('/boards')
                    ? 'bg-blue-50 text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Boards
              </Link>
              {(isAdmin || isSuperAdmin) && (
                <Link
                  to="/admin/task-types"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    location.pathname.startsWith('/admin/task-types')
                      ? 'bg-blue-50 text-blue-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                    <path d="M7 7h.01" />
                  </svg>
                  <span>Görev Tipleri</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Center / Global Search Bar with Live Dropdown */}
        {user && (
          <div ref={searchContainerRef} className="relative flex-1 max-w-md mx-2">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SearchIcon className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) {
                    setIsDropdownOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Görev ara (örn: FW-14, octo)..."
                className="w-full pl-9 pr-14 py-1.5 text-xs sm:text-sm bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200/90 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setIsDropdownOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white text-[10px] font-mono font-bold text-slate-400 border border-slate-200 shadow-2xs pointer-events-none">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Live Search Dropdown */}
            {isDropdownOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 font-medium px-3">
                  <span>Görev Sonuçları ({searchResults.length})</span>
                  <span className="text-[10px] text-slate-400">Yön Tuşları: Gezin / Enter: Aç</span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {isSearching && searchResults.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Aranıyor...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center px-4">
                      <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <SearchIcon className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">Eşleşen görev bulunamadı</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        "{searchQuery}" için görev kodu veya başlık eşleşmesi bulunamadı.
                      </p>
                    </div>
                  ) : (
                    searchResults.map((task, index) => {
                      const isSelected = index === selectedIndex;
                      const taskColor = task.taskTypeColor || '#3B82F6';
                      const pBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleSelectTask(task)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`p-3 cursor-pointer transition-colors flex items-start gap-3 ${
                            isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Task Key Badge */}
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black tracking-wider uppercase border shadow-2xs shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${taskColor}15`,
                              color: taskColor,
                              borderColor: `${taskColor}35`,
                            }}
                          >
                            {task.taskKey || (task.boardKey ? `${task.boardKey}-${task.id}` : `TASK-${task.id}`)}
                          </span>

                          {/* Task Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 justify-between">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                {task.title}
                              </h4>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm border shrink-0 ${pBadge.bg} ${pBadge.text}`}
                              >
                                {pBadge.label}
                              </span>
                            </div>

                            {/* Location: [BoardKey] Board > Column */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 truncate">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-slate-400 shrink-0">
                                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                                <rect x="14" y="3" width="7" height="11" rx="1.5" />
                              </svg>
                              <span className="font-semibold text-slate-700">
                                {task.boardKey ? `[${task.boardKey}] ` : ''}{task.boardTitle}
                              </span>
                              <span className="text-slate-300">›</span>
                              <span className="text-slate-600">{task.columnName}</span>
                            </div>

                            {/* Tags if available */}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {task.tags.slice(0, 3).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-sm"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {task.tags.length > 3 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{task.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right side: Team, Profile, Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user && (
            <>
              {/* ── Active Team Stack & Dropdown Popover ── */}
              {users.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTeamModalOpen(!teamModalOpen)}
                    className="hidden md:flex items-center gap-2 pl-2.5 pr-2 py-1 rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
                    title="Ekip listesini görüntülemek için tıklayın"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mr-0.5 group-hover:text-blue-600 transition-colors">
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
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white shadow-xs relative ${color.bg} ${color.text}`}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        );
                      })}

                      {remainingCount > 0 && (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 ring-2 ring-white shadow-xs"
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
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-xs">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs text-slate-800 font-semibold hidden sm:inline">{user.username}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {isSuperAdmin ? 'Admin' : isDeptAdmin ? 'Yönetici' : 'Üye'}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-ghost text-slate-500 hover:text-slate-800 p-1.5 sm:p-2 text-xs font-semibold gap-1"
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
