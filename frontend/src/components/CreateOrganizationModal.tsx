import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { organizationService } from '@/services/organizationService';
import { userService } from '@/services/userService';
import type { CreateOrganizationRequest, OrganizationDto, UserSummary } from '@/types';
import { PlusIcon, SearchIcon } from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationCreated: (org: OrganizationDto) => void;
}

type AdminMode = 'none' | 'existing' | 'new';
type MemberMode = 'none' | 'existing' | 'new';

export default function CreateOrganizationModal({
  isOpen,
  onClose,
  onOrganizationCreated,
}: Props) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');

  // Admin section state
  const [adminMode, setAdminMode]     = useState<AdminMode>('none');
  const [adminUserId, setAdminUserId] = useState<number | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail]       = useState('');
  const [newPassword, setNewPassword] = useState('admin123');

  // Members section state (Multi-select)
  const [memberMode, setMemberMode]               = useState<MemberMode>('none');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch]           = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberEmail, setNewMemberEmail]       = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('user123');

  const [users, setUsers]             = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');

      setAdminMode('none');
      setAdminUserId(null);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('admin123');

      setMemberMode('none');
      setSelectedMemberIds([]);
      setMemberSearch('');
      setNewMemberUsername('');
      setNewMemberEmail('');
      setNewMemberPassword('user123');

      setLoadingUsers(true);
      userService
        .getAll()
        .then((data) => {
          setUsers(data);
          if (data.length > 0) {
            setAdminUserId(data[0].id);
          }
        })
        .catch(() => { /* ignore */ })
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllMembers = () => {
    setSelectedMemberIds(users.map((u) => u.id));
  };

  const handleClearMembers = () => {
    setSelectedMemberIds([]);
  };

  const filteredUsersForMembers = users.filter((u) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Lütfen organizasyon adı girin.');
      return;
    }

    const payload: CreateOrganizationRequest = {
      name: trimmedName,
      description: description.trim() || undefined,
    };

    // 1. Process Admin
    if (adminMode === 'existing' && adminUserId) {
      payload.adminUserId = adminUserId;
    } else if (adminMode === 'new') {
      const trimmedUser = newUsername.trim();
      if (!trimmedUser) {
        toast.error('Lütfen yeni yönetici için kullanıcı adı girin.');
        return;
      }
      payload.newAdmin = {
        username: trimmedUser,
        email: newEmail.trim() || `${trimmedUser}@kanban.local`,
        password: newPassword || 'admin123',
      };
    }

    // 2. Process Members (Multi-select or new user)
    if (memberMode === 'existing' && selectedMemberIds.length > 0) {
      payload.memberUserIds = selectedMemberIds;
    } else if (memberMode === 'new') {
      const trimmedMember = newMemberUsername.trim();
      if (!trimmedMember) {
        toast.error('Lütfen yeni ekip üyesi için kullanıcı adı girin.');
        return;
      }
      payload.newUser = {
        username: trimmedMember,
        email: newMemberEmail.trim() || `${trimmedMember}@kanban.local`,
        password: newMemberPassword || 'user123',
      };
    }

    setSubmitting(true);
    try {
      const createdOrg = await organizationService.create(payload);
      toast.success(`"${createdOrg.name}" organizasyonu başarıyla oluşturuldu.`);
      onOrganizationCreated(createdOrg);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Organizasyon oluşturulurken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-scale-in my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <PlusIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Yeni Organizasyon Oluştur</h2>
              <p className="text-xs text-slate-500 font-medium">Organizasyon, yönetici ve çoklu üye atama</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Organizasyon Adı */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              ORGANİZASYON ADI <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              required
              maxLength={100}
              placeholder="örn: İnsan Kaynakları, Yazılım & IT, Satış"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field w-full text-sm"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              AÇIKLAMA <span className="text-slate-400 font-normal text-[11px]">(Opsiyonel)</span>
            </label>
            <textarea
              rows={2}
              maxLength={255}
              placeholder="Organizasyonun çalışma alanı ve genel hedefleri..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="field w-full text-sm resize-none"
            />
          </div>

          {/* Organizasyon Yöneticisi Ata Bölümü */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ORGANİZASYON YÖNETİCİSİ ATA
            </label>

            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAdminMode('none')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  adminMode === 'none'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Atama Yapma
              </button>
              <button
                type="button"
                onClick={() => setAdminMode('existing')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  adminMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mevcut Kullanıcı
              </button>
              <button
                type="button"
                onClick={() => setAdminMode('new')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  adminMode === 'new'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Yeni Yönetici
              </button>
            </div>

            {/* Mode: Existing User */}
            {adminMode === 'existing' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 animate-fade-in">
                <label className="block text-xs font-semibold text-slate-700">
                  Yönetici Olarak Atanacak Kullanıcı:
                </label>
                {loadingUsers ? (
                  <div className="text-xs text-slate-400 py-1">Kullanıcılar yükleniyor...</div>
                ) : (
                  <select
                    value={adminUserId || ''}
                    onChange={(e) => setAdminUserId(Number(e.target.value))}
                    className="field w-full text-xs font-medium bg-white"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email}) {u.organizationName ? `– [${u.organizationName}]` : '– [Organizasyonsuz]'}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-500">
                  Seçilen kullanıcının rolü otomatik olarak Organizasyon Yöneticisi (`ROLE_ADMIN`) yapılacaktır.
                </p>
              </div>
            )}

            {/* Mode: New Admin */}
            {adminMode === 'new' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Kullanıcı Adı <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="örn: ik_yoneticisi"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    placeholder="örn: ik_admin@kanban.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    placeholder="Varsayılan: admin123"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Organizasyon Üyeleri Ekle (Çoklu Seçim) Bölümü */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                ORGANİZASYON ÜYELERİ EKLE <span className="text-slate-400 font-normal text-[11px]">(Çoklu)</span>
              </label>
              {memberMode === 'existing' && selectedMemberIds.length > 0 && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {selectedMemberIds.length} üye seçildi
                </span>
              )}
            </div>

            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMemberMode('none')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  memberMode === 'none'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Üye Ekleme
              </button>
              <button
                type="button"
                onClick={() => setMemberMode('existing')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  memberMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mevcut Kullanıcılar
              </button>
              <button
                type="button"
                onClick={() => setMemberMode('new')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  memberMode === 'new'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Yeni Kullanıcı Oluştur
              </button>
            </div>

            {/* Mode: Existing Users (Multi-select checkbox list) */}
            {memberMode === 'existing' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 animate-fade-in">
                {/* Search & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Kullanıcı ara..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="field pl-8 text-xs w-full py-1.5 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectAllMembers}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-1 rounded hover:bg-blue-50"
                    >
                      Tümünü Seç
                    </button>
                    <button
                      type="button"
                      onClick={handleClearMembers}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-1.5 py-1 rounded hover:bg-slate-200/60"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                {/* Checkbox List */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {filteredUsersForMembers.length === 0 ? (
                    <div className="text-xs text-slate-400 py-3 text-center">Kullanıcı bulunamadı.</div>
                  ) : (
                    filteredUsersForMembers.map((u) => {
                      const isChecked = selectedMemberIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleMember(u.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{u.username}</span>
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
              </div>
            )}

            {/* Mode: New User */}
            {memberMode === 'new' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Kullanıcı Adı <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="örn: ahmet_stajyer"
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    placeholder="örn: ahmet@kanban.local"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    placeholder="Varsayılan: user123"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    className="field w-full text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary py-2 px-4 text-xs font-semibold"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary py-2 px-4 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Oluşturuluyor…</span>
                </>
              ) : (
                <>
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Organizasyonu Oluştur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
