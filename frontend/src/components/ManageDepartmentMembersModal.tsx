import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { organizationService } from '@/services/organizationService';
import { userService } from '@/services/userService';
import type { CreateNewMemberRequest, OrganizationDto, UserSummary } from '@/types';
import { PlusIcon, SearchIcon, TrashIcon, UserIcon } from './icons';

interface Props {
  isOpen:            boolean;
  onClose:           () => void;
  organization:      OrganizationDto | null;
  onMembersChanged?: () => void;
}

type MainTab = 'current' | 'add';
type AddSubTab = 'existing' | 'new';

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

export default function ManageDepartmentMembersModal({
  isOpen,
  onClose,
  organization,
  onMembersChanged,
}: Props) {
  const [activeTab, setActiveTab]         = useState<MainTab>('current');
  const [addSubTab, setAddSubTab]         = useState<AddSubTab>('existing');

  const [members, setMembers]             = useState<UserSummary[]>([]);
  const [allUsers, setAllUsers]           = useState<UserSummary[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentSearch, setCurrentSearch] = useState('');

  // Existing user selection state
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [existingSearch, setExistingSearch]   = useState('');
  const [addingExisting, setAddingExisting]   = useState(false);

  // New user form state
  const [newUsername, setNewUsername]         = useState('');
  const [newEmail, setNewEmail]               = useState('');
  const [newPassword, setNewPassword]         = useState('user123');
  const [newRole, setNewRole]                 = useState('ROLE_USER');
  const [creatingNew, setCreatingNew]         = useState(false);

  // Removing member state
  const [removingId, setRemovingId]           = useState<number | null>(null);

  const loadData = () => {
    if (!organization) return;
    setLoadingMembers(true);
    Promise.all([
      organizationService.getMembers(organization.id),
      userService.getAll(),
    ])
      .then(([mems, all]) => {
        setMembers(mems);
        setAllUsers(all);
      })
      .catch(() => {
        toast.error('Üye bilgileri yüklenemedi.');
      })
      .finally(() => setLoadingMembers(false));
  };

  useEffect(() => {
    if (isOpen && organization) {
      setActiveTab('current');
      setAddSubTab('existing');
      setCurrentSearch('');
      setSelectedUserIds([]);
      setExistingSearch('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('user123');
      setNewRole('ROLE_USER');
      loadData();
    }
  }, [isOpen, organization]);

  if (!isOpen || !organization) return null;

  // Filter current members
  const filteredCurrentMembers = members.filter((m) => {
    const q = currentSearch.trim().toLowerCase();
    if (!q) return true;
    return m.username.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  // Non-members for existing selection
  const memberIdSet = new Set(members.map((m) => m.id));
  const nonMembers = allUsers.filter((u) => !memberIdSet.has(u.id));

  const filteredNonMembers = nonMembers.filter((u) => {
    const q = existingSearch.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleToggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllNonMembers = () => {
    setSelectedUserIds(filteredNonMembers.map((u) => u.id));
  };

  const handleClearNonMembers = () => {
    setSelectedUserIds([]);
  };

  // Add existing members submit
  const handleAddExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      toast.error('Lütfen eklenecek en az bir kullanıcı seçin.');
      return;
    }

    setAddingExisting(true);
    try {
      await organizationService.addExistingMembers(organization.id, selectedUserIds);
      toast.success(`${selectedUserIds.length} kullanıcı "${organization.name}" departmanına eklendi.`);
      setSelectedUserIds([]);
      setActiveTab('current');
      loadData();
      if (onMembersChanged) onMembersChanged();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Kullanıcılar eklenirken hata oluştu.';
      toast.error(msg);
    } finally {
      setAddingExisting(false);
    }
  };

  // Create brand new member submit
  const handleCreateNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = newUsername.trim();
    if (!trimmedUser) {
      toast.error('Lütfen kullanıcı adı girin.');
      return;
    }

    const payload: CreateNewMemberRequest = {
      username: trimmedUser,
      email: newEmail.trim() || `${trimmedUser}@kanban.local`,
      password: newPassword || 'user123',
      role: newRole,
    };

    setCreatingNew(true);
    try {
      await organizationService.createNewMember(organization.id, payload);
      toast.success(`"${trimmedUser}" kullanıcısı oluşturuldu ve "${organization.name}" departmanına eklendi.`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('user123');
      setActiveTab('current');
      loadData();
      if (onMembersChanged) onMembersChanged();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Kullanıcı oluşturulurken hata oluştu.';
      toast.error(msg);
    } finally {
      setCreatingNew(false);
    }
  };

  // Remove member action
  const handleRemoveMember = async (userId: number, username: string) => {
    if (!confirm(`"${username}" kullanıcısını "${organization.name}" departmanından çıkarmak istediğinizden emin misiniz?`)) {
      return;
    }

    setRemovingId(userId);
    try {
      await organizationService.removeMember(organization.id, userId);
      toast.success(`"${username}" "${organization.name}" departmanından çıkarıldı.`);
      loadData();
      if (onMembersChanged) onMembersChanged();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Üye çıkarılırken hata oluştu.';
      toast.error(msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col my-8 animate-scale-in max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
              <UserIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{organization.name} - Üyeleri Yönet</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {members.length} Üye
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Departman üyeliklerini düzenleyin veya yeni üye ekleyin</p>
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

        {/* ── Navigation Tabs ──────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-200/80 bg-white flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'current'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Mevcut Üyeler ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Üye Ekle</span>
          </button>
        </div>

        {/* ── Tab 1: Current Members ───────────────────────────────── */}
        {activeTab === 'current' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Üyelerde ara..."
                  value={currentSearch}
                  onChange={(e) => setCurrentSearch(e.target.value)}
                  className="field pl-9 text-xs w-full py-1.5 bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0">
              {loadingMembers ? (
                <div className="text-center py-8 text-xs text-slate-400">Üyeler yükleniyor…</div>
              ) : filteredCurrentMembers.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <UserIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">Bu departmanda henüz üye bulunmuyor</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">"Üye Ekle" sekmesinden yeni üyeler atayabilirsiniz.</p>
                </div>
              ) : (
                filteredCurrentMembers.map((m) => {
                  const avatar = getAvatarColor(m.username);
                  const isRemoving = removingId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white transition-all gap-2.5"
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white shadow-xs ${avatar.bg} ${avatar.text}`}
                        >
                          {m.username.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 truncate block">{m.username}</span>
                          <span className="text-[11px] text-slate-500 truncate block">{m.email}</span>
                        </div>
                      </div>

                      {/* Right: Badges & Remove button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {m.role === 'ROLE_SUPER_ADMIN' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-white shadow-2xs">
                            Super Admin
                          </span>
                        ) : m.role === 'ROLE_ADMIN' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            Yönetici
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Kullanıcı
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.username)}
                          disabled={isRemoving}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Departmandan Çıkar"
                        >
                          {isRemoving ? (
                            <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-rose-600 rounded-full animate-spin block" />
                          ) : (
                            <TrashIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Add Members ───────────────────────────────────── */}
        {activeTab === 'add' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3 overflow-y-auto">
            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setAddSubTab('existing')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  addSubTab === 'existing'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sistemden Seç (Mevcut Kullanıcılar)
              </button>
              <button
                type="button"
                onClick={() => setAddSubTab('new')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  addSubTab === 'new'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Yeni Kullanıcı Oluştur
              </button>
            </div>

            {/* Sub-tab: Existing Users (Checkbox list) */}
            {addSubTab === 'existing' && (
              <form onSubmit={handleAddExistingSubmit} className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Eklenecek kullanıcıları ara..."
                      value={existingSearch}
                      onChange={(e) => setExistingSearch(e.target.value)}
                      className="field pl-8 text-xs w-full py-1.5 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllNonMembers}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Tümü
                    </button>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={handleClearNonMembers}
                      className="text-slate-500 hover:text-slate-700 font-semibold"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs flex-1">
                  {filteredNonMembers.length === 0 ? (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      Eklenebilecek başka kullanıcı bulunamadı.
                    </div>
                  ) : (
                    filteredNonMembers.map((u) => {
                      const isChecked = selectedUserIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                              : 'bg-white border-transparent text-slate-700 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectUser(u.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate font-medium">{u.username}</span>
                            <span className="text-[11px] text-slate-400 truncate">({u.email})</span>
                          </div>
                          {u.organizationName && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                              {u.organizationName}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0">
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedUserIds.length} kullanıcı seçildi
                  </span>
                  <button
                    type="submit"
                    disabled={addingExisting || selectedUserIds.length === 0}
                    className="btn-primary py-2 px-4 text-xs font-semibold gap-1.5 shadow-sm"
                  >
                    {addingExisting ? 'Ekleniyor…' : `Seçilen ${selectedUserIds.length} Kullanıcıyı Ekle`}
                  </button>
                </div>
              </form>
            )}

            {/* Sub-tab: Create New Member */}
            {addSubTab === 'new' && (
              <form onSubmit={handleCreateNewSubmit} className="space-y-3 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kullanıcı Adı <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="örn: stajyer_ali"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    placeholder="örn: ali@kanban.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="field w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Şifre
                    </label>
                    <input
                      type="password"
                      placeholder="Varsayılan: user123"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Rol
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="field w-full text-xs font-semibold"
                    >
                      <option value="ROLE_USER">Ekip Üyesi (Kullanıcı)</option>
                      <option value="ROLE_ADMIN">Departman Yöneticisi</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={creatingNew || !newUsername.trim()}
                    className="btn-primary py-2 px-4 text-xs font-semibold gap-1.5 shadow-sm"
                  >
                    {creatingNew ? 'Oluşturuluyor…' : 'Oluştur ve Departmana Ata'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Modal Footer ─────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end shrink-0">
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
