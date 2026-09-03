import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { UserSummary } from '@/types';
import { SearchIcon, UserIcon } from './icons';

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  users:   UserSummary[];
}

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

export default function TeamMembersModal({ isOpen, onClose, users }: Props) {
  const [search, setSearch]             = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Extract distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.organizationName) {
        set.add(u.organizationName);
      }
    });
    return Array.from(set);
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);

      const matchDept =
        selectedDept === 'ALL' ||
        (selectedDept === 'UNASSIGNED' && !u.organizationName) ||
        u.organizationName === selectedDept;

      return matchSearch && matchDept;
    });
  }, [users, search, selectedDept]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col my-8 animate-scale-in max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
              <UserIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Aktif Ekip Üyeleri</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {users.length} Kişi
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Sistemdeki aktif kullanıcılar ve roller</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Search & Filter Bar ──────────────────────────────────── */}
        <div className="px-6 py-3.5 border-b border-slate-100 space-y-3 bg-white">
          {/* Search input */}
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Kullanıcı adı veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-9.5 text-xs w-full py-2 bg-slate-50/50 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDept('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                selectedDept === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Tümü ({users.length})
            </button>
            {departments.map((dept) => {
              const count = users.filter((u) => u.organizationName === dept).length;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    selectedDept === dept
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {dept} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Members List ─────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-2.5 max-h-[50vh]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <UserIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Ekip üyesi bulunamadı</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Arama kriterlerinizi değiştirmeyi deneyin.</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const avatar = getAvatarColor(u.username);
              const isSuper = u.role === 'ROLE_SUPER_ADMIN' || (u.role === 'ROLE_ADMIN' && !u.organizationId);
              const isDeptAdmin = u.role === 'ROLE_ADMIN' && !isSuper;

              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all gap-3"
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white shadow-xs ${avatar.bg} ${avatar.text}`}
                      >
                        {u.username.charAt(0).toUpperCase()}
                      </span>
                      {/* Active green dot indicator */}
                      <span
                        className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                        title="Çevrim içi / Aktif"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {u.username}
                        </span>
                        {/* Status tag */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Çevrim içi
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Right: Badges & Department */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Organization / Department Badge */}
                    {u.organizationName ? (
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80">
                        {u.organizationName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80">
                        Tüm Şirket
                      </span>
                    )}

                    {/* Role Badge */}
                    {isSuper ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-white shadow-2xs">
                        Super Admin
                      </span>
                    ) : isDeptAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        Yönetici
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        Kullanıcı
                      </span>
                    )}

                    {/* Date info if available */}
                    {u.createdAt && (
                      <span className="hidden md:inline-block text-[11px] text-slate-400 font-medium">
                        {format(parseISO(u.createdAt), 'd MMM yyyy', { locale: tr })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Modal Footer ─────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Toplam {filteredUsers.length} kişi gösteriliyor</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-1.5 px-4 text-xs font-semibold"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
