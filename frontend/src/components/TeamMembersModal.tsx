import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { organizationService } from '@/services/organizationService';
import type { OrganizationDto, UserSummary } from '@/types';
import { PlusIcon, SearchIcon, UserIcon } from './icons';

interface Props {
  isOpen:            boolean;
  onClose:           () => void;
  users:             UserSummary[];
  onMembersUpdated?: () => void;
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

export default function TeamMembersModal({
  isOpen,
  onClose,
  users,
  onMembersUpdated,
}: Props) {
  const { isSuperAdmin } = useAuth();

  const [search, setSearch]             = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Assign members panel state (for Super Admin)
  const [showAssignPanel, setShowAssignPanel]             = useState(false);
  const [targetOrgId, setTargetOrgId]                     = useState<number | null>(null);
  const [selectedAssignUserIds, setSelectedAssignUserIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch]                   = useState('');
  const [organizations, setOrganizations]                 = useState<OrganizationDto[]>([]);
  const [assigning, setAssigning]                         = useState(false);

  // Load organizations when Super Admin opens dropdown
  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      organizationService
        .getAll()
        .then((orgs) => {
          setOrganizations(orgs);
          if (orgs.length > 0 && !targetOrgId) {
            setTargetOrgId(orgs[0].id);
          }
        })
        .catch(() => { /* fallback */ });
    }
  }, [isOpen, isSuperAdmin]);

  // Extract distinct organizations from users list (supporting ManyToMany)
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.organizationNames && u.organizationNames.length > 0) {
        u.organizationNames.forEach((name) => set.add(name));
      } else if (u.organizationName) {
        set.add(u.organizationName);
      }
    });
    return Array.from(set);
  }, [users]);

  // Filtered users for main list
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);

      const userOrgs =
        u.organizationNames && u.organizationNames.length > 0
          ? u.organizationNames
          : (u.organizationName ? [u.organizationName] : []);

      const matchDept =
        selectedDept === 'ALL' ||
        (selectedDept === 'UNASSIGNED' && userOrgs.length === 0) ||
        userOrgs.includes(selectedDept);

      return matchSearch && matchDept;
    });
  }, [users, search, selectedDept]);

  // Filtered users for assignment panel
  const filteredUsersForAssign = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organizationName && u.organizationName.toLowerCase().includes(q))
    );
  }, [users, assignSearch]);

  const handleToggleAssignUser = (id: number) => {
    setSelectedAssignUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllAssign = () => {
    setSelectedAssignUserIds(filteredUsersForAssign.map((u) => u.id));
  };

  const handleClearAssign = () => {
    setSelectedAssignUserIds([]);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId) {
      toast.error('Lütfen bir organizasyon seçin.');
      return;
    }
    if (selectedAssignUserIds.length === 0) {
      toast.error('Lütfen atanacak en az bir kullanıcı seçin.');
      return;
    }

    const targetOrgName = organizations.find((o) => o.id === targetOrgId)?.name || 'Organizasyon';

    setAssigning(true);
    try {
      await organizationService.addExistingMembers(targetOrgId, selectedAssignUserIds);
      toast.success(`${selectedAssignUserIds.length} kullanıcı "${targetOrgName}" organizasyonuna atandı.`);
      setShowAssignPanel(false);
      setSelectedAssignUserIds([]);
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Kullanıcılar atanırken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible backdrop for outside click to close */}
      <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={onClose} />

      {/* ── Dropdown Popover Panel ────────────────────────────────────── */}
      <div
        className="absolute right-0 top-full mt-2 z-50 w-[560px] sm:w-[680px] lg:w-[740px] max-w-[95vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[520px] sm:max-h-[580px] overflow-hidden animate-scale-in origin-top-right text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed Header ─────────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
              <UserIcon className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Aktif Ekip Üyeleri</h2>
                <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {users.length} Kişi
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Sistemdeki aktif kullanıcılar ve roller</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Super Admin: + Organizasyona Üye Ekle button */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowAssignPanel(!showAssignPanel)}
                className={`btn-secondary py-1 px-2.5 text-[11px] gap-1 font-semibold transition-all ${
                  showAssignPanel ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-slate-700'
                }`}
                title="Organizasyona toplu kullanıcı ata"
              >
                <PlusIcon className="w-3 h-3 text-blue-600" />
                <span>Üye Ekle</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="btn-ghost p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              aria-label="Kapat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Super Admin: Assign Members to Organization Panel ──────── */}
        {isSuperAdmin && showAssignPanel && (
          <form onSubmit={handleAssignSubmit} className="p-3.5 bg-blue-50/60 border-b border-blue-200/80 space-y-2.5 shrink-0 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Organizasyona Üye Ata (Toplu)</span>
              <button
                type="button"
                onClick={() => setShowAssignPanel(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Organization selector */}
              <div className="sm:col-span-5">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hedef Organizasyon
                </label>
                <select
                  value={targetOrgId || ''}
                  onChange={(e) => setTargetOrgId(Number(e.target.value))}
                  className="field w-full text-xs font-semibold bg-white py-1.5"
                  required
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* User search */}
              <div className="sm:col-span-7">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Kullanıcılar ({selectedAssignUserIds.length} seçildi)
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAllAssign}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Tümü
                    </button>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={handleClearAssign}
                      className="text-slate-500 hover:text-slate-700 font-semibold"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Kullanıcı ara..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="field pl-8 text-xs w-full py-1 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox list of users */}
            <div className="max-h-28 overflow-y-auto space-y-1 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              {filteredUsersForAssign.map((u) => {
                const isChecked = selectedAssignUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-1 rounded-md border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                        : 'bg-white border-transparent text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleAssignUser(u.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{u.username}</span>
                      <span className="text-[10px] text-slate-400">({u.email})</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAssignPanel(false)}
                className="btn-ghost py-1 px-3 text-xs"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={assigning || selectedAssignUserIds.length === 0}
                className="btn-primary py-1 px-3.5 text-xs font-semibold"
              >
                {assigning ? 'Atanıyor…' : 'Seçilenleri Ata'}
              </button>
            </div>
          </form>
        )}

        {/* ── Fixed Search & Filter Bar ────────────────────────────── */}
        <div className="px-5 py-2.5 border-b border-slate-100 space-y-2 bg-white shrink-0">
          {/* Search input */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Kullanıcı adı veya e-posta ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-8.5 text-xs w-full py-1.5 bg-slate-50/50 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Organization filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDept('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 text-xs ${
                selectedDept === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Tümü ({users.length})
            </button>
            {departments.map((dept) => {
              const count = users.filter((u) => {
                const orgs = u.organizationNames && u.organizationNames.length > 0
                  ? u.organizationNames
                  : (u.organizationName ? [u.organizationName] : []);
                return orgs.includes(dept);
              }).length;

              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 text-xs ${
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

        {/* ── Scrollable Members List ──────────────────────────────── */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-0">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <UserIcon className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Ekip üyesi bulunamadı</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Arama kriterlerinizi değiştirmeyi deneyin.</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const avatar = getAvatarColor(u.username);
              const orgList =
                u.organizationNames && u.organizationNames.length > 0
                  ? u.organizationNames
                  : (u.organizationName ? [u.organizationName] : []);

              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all space-y-2.5 shadow-2xs"
                >
                  {/* Top Row: User Avatar, Name, Email (Left) & Role, Date (Right) */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Avatar + Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-2 ring-white shadow-xs ${avatar.bg} ${avatar.text}`}
                      >
                        {u.username.charAt(0).toUpperCase()}
                      </span>

                      <div className="min-w-0">
                        <span className="font-bold text-sm text-slate-900 truncate block">
                          {u.username}
                        </span>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>

                    {/* Right: Role Badge & Date */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role Badge */}
                      {u.role === 'ROLE_SUPER_ADMIN' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-white shadow-2xs">
                          Super Admin
                        </span>
                      ) : u.role === 'ROLE_ADMIN' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Yönetici
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Kullanıcı
                        </span>
                      )}

                      {/* Registration date */}
                      {u.createdAt && (
                        <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
                          {format(parseISO(u.createdAt), 'd MMM yyyy', { locale: tr })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Multi-organization / Department Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5 shrink-0">
                      Departmanlar:
                    </span>
                    {orgList.length > 0 ? (
                      orgList.map((orgName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs"
                        >
                          {orgName}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 italic">
                        Tanımlı departman yok
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Fixed Footer ─────────────────────────────────────────── */}
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px]">Toplam {filteredUsers.length} kişi gösteriliyor</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-1 px-3 text-xs font-semibold"
          >
            Kapat
          </button>
        </div>
      </div>
    </>
  );
}
