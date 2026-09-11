import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import CreateBoardModal from '@/components/CreateBoardModal';
import CreateOrganizationModal from '@/components/CreateOrganizationModal';
import ManageDepartmentMembersModal from '@/components/ManageDepartmentMembersModal';
import { boardApi } from '@/api/boardApi';
import { organizationService } from '@/services/organizationService';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardResponse, OrganizationDto } from '@/types';
import { FileIcon, PlusIcon, SearchIcon, TrashIcon, UserIcon } from '@/components/icons';

const FALLBACK_PALETTE = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'];

function getBoardAccentColor(board: BoardResponse): string {
  const typeColor = (board as any).taskType?.colorHex || (board as any).taskType?.colorCode || board.taskTypeColor;
  if (typeColor && typeof typeColor === 'string' && typeColor.trim() !== '') {
    return typeColor.trim();
  }
  // Deterministic fallback based on board id or name
  const hash = Math.abs((board.id || 0) * 31 + (board.name ? board.name.charCodeAt(0) : 0));
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export default function BoardsPage() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [manageMembersModalOpen, setManageMembersModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // View mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('kanban_boards_view_mode') as 'grid' | 'table') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('kanban_boards_view_mode', viewMode);
  }, [viewMode]);

  const isDeptAdmin = isAdmin && !isSuperAdmin && (!!user?.organizationId || !!user?.organizationName);

  const pageTitle = isSuperAdmin
    ? 'All Boards'
    : (user?.organizationName ? `${user.organizationName} Boardları` : 'Boardlarım');

  const pageSubtitle = isSuperAdmin
    ? 'Tüm organizasyonlara ait boardları, iş akışlarını ve ilerlemeleri merkezi olarak yönetin.'
    : (user?.organizationName
        ? `${user.organizationName} organizasyonuna ve size atanmış görevlerin bulunduğu boardlara buradan erişin.`
        : 'Tüm projelerinizi, süreçlerinizi ve takım işlerinizi tek bir yerden yönetin.');

  const { data: boards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['boards'],
    queryFn: boardApi.getAll,
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: organizationService.getAll,
  });

  // Selected organization object if filtering by specific organization
  const selectedOrgObj = useMemo(() => {
    if (selectedOrgFilter === 'ALL') return null;
    return organizations.find((o) => o.name === selectedOrgFilter) || null;
  }, [organizations, selectedOrgFilter]);

  // Distinct organizations extracted from available boards and organizations
  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    if (isSuperAdmin) {
      organizations.forEach((o) => set.add(o.name));
    }
    boards.forEach((b) => {
      if (b.organizationName) {
        set.add(b.organizationName);
      }
    });
    return Array.from(set);
  }, [boards, organizations, isSuperAdmin]);

  // Filtered boards for view (by organization and search query)
  const filteredBoards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return boards.filter((b) => {
      // 1. Organization filter
      if (selectedOrgFilter !== 'ALL' && b.organizationName !== selectedOrgFilter) {
        return false;
      }

      // 2. Search query filter
      if (!term) return true;

      const nameMatch = b.name.toLowerCase().includes(term);
      const descMatch = b.description ? b.description.toLowerCase().includes(term) : false;
      const orgMatch = b.organizationName ? b.organizationName.toLowerCase().includes(term) : false;
      const taskTypeMatch = b.taskTypeName ? b.taskTypeName.toLowerCase().includes(term) : false;

      return nameMatch || descMatch || orgMatch || taskTypeMatch;
    });
  }, [boards, selectedOrgFilter, searchTerm]);

  const canDeleteBoard = (board: BoardResponse): boolean => {
    if (isSuperAdmin) return true;
    if (user?.role === 'ROLE_ADMIN') {
      if (!board.organizationName && !board.organizationId) return false;
      if (board.organizationId && user.organizationId && board.organizationId === user.organizationId) return true;
      if (board.organizationName && user.organizationName) {
        return board.organizationName === user.organizationName;
      }
      return false;
    }
    return false;
  };

  const handleDelete = async (e: React.MouseEvent, board: BoardResponse) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Bu board'u (${board.name}) ve içindeki tüm görevleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;

    setDeleting(board.id);
    try {
      await boardApi.remove(board.id);
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success(`"${board.name}" board'u başarıyla silindi.`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Board silinirken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteOrg = async (org: OrganizationDto) => {
    if (!confirm(`Bu organizasyonu (${org.name}) ve organizasyona ait tüm boardları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setDeletingOrg(true);
    try {
      await organizationService.delete(org.id);
      setSelectedOrgFilter('ALL');
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success(`"${org.name}" organizasyonu başarıyla silindi.`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Organizasyon silinirken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setDeletingOrg(false);
    }
  };

  const showFilterBar = !isLoading && (isSuperAdmin || availableDepts.length > 1);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <Navbar />

      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {pageTitle}
              </h1>
              {isSuperAdmin ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Super Admin
                </span>
              ) : isDeptAdmin ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Organizasyon Yöneticisi
                </span>
              ) : user?.organizationName ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Ekip Üyesi
                </span>
              ) : null}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              {pageSubtitle}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Super Admin: + Yeni Organizasyon Button */}
            {isSuperAdmin && (
              <button
                onClick={() => setCreateOrgModalOpen(true)}
                className="btn-secondary gap-2 py-2 px-3 text-xs font-bold text-slate-700 hover:text-blue-600 shadow-xs hover:border-blue-300"
                title="Yeni Organizasyon Tanımla"
              >
                <PlusIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Yeni Organizasyon</span>
              </button>
            )}

            {/* New Board Button (Super Admin & Organization Admin) */}
            {isAdmin && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary gap-2 py-2 px-3.5 text-xs font-bold shadow-sm hover:shadow"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Yeni Board Oluştur</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Organization Filter Bar ── */}
        {showFilterBar && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 flex-wrap sm:flex-nowrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
              ORGANİZASYON:
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrgFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedOrgFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              Tümü ({boards.length})
            </button>

            {availableDepts.map((deptName) => {
              const count = boards.filter((b) => b.organizationName === deptName).length;
              const isSelected = selectedOrgFilter === deptName;

              return (
                <div key={deptName} className="inline-flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedOrgFilter(deptName)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {deptName} ({count})
                  </button>

                  {/* Super Admin Actions when this organization is selected */}
                  {isSuperAdmin && isSelected && selectedOrgObj && (
                    <div className="inline-flex items-center gap-1.5 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => setManageMembersModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition-all shadow-xs"
                        title={`${deptName} organizasyonu üyelerini yönet`}
                      >
                        <UserIcon className="w-3 h-3 text-blue-600" />
                        <span>Üyeleri Yönet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteOrg(selectedOrgObj)}
                        disabled={deletingOrg}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all shadow-xs"
                        title={`${deptName} organizasyonunu sil`}
                      >
                        {deletingOrg ? (
                          <span className="w-3 h-3 border-2 border-rose-400 border-t-rose-600 rounded-full animate-spin block" />
                        ) : (
                          <TrashIcon className="w-3 h-3 text-rose-600" />
                        )}
                        <span>Sil</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCreateOrgModalOpen(true)}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 transition-all shadow-xs shrink-0"
              >
                <PlusIcon className="w-3 h-3" />
                <span>Yeni Organizasyon</span>
              </button>
            )}
          </div>
        )}

        {/* ── Search & View Control Bar (Compact Toolbar) ──────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs mb-5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Board adı, açıklama veya iş akışı ara..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200 transition-colors"
                title="Aramayı Temizle"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Stats & View Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {filteredBoards.length} / {boards.length} Board
            </span>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Kompakt Grid Görünümü"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                <span className="hidden sm:inline">Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Yoğun Tablo / Liste Görünümü"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-400">Boardlar yükleniyor…</p>
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────── */}
        {isError && (
          <div className="text-center py-16 bg-white rounded-2xl border border-rose-200/80 shadow-xs max-w-md mx-auto p-6">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">Boardlar yüklenemedi</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Sunucuya bağlanırken bir hata oluştu.</p>
            <button onClick={() => refetch()} className="btn-secondary py-1.5 px-3.5 text-xs font-semibold">
              Tekrar Dene
            </button>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────── */}
        {!isLoading && !isError && filteredBoards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 max-w-md mx-auto text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 my-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 shadow-2xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-blue-600">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
                <rect x="14" y="18" width="7" height="3" rx="1.5" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-800">
              {searchTerm
                ? 'Aramanızla Eşleşen Board Bulunamadı'
                : selectedOrgFilter !== 'ALL'
                  ? 'Bu Organizasyona Ait Board Bulunmuyor'
                  : 'Henüz Bir Board Bulunmuyor'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
              {searchTerm
                ? `"${searchTerm}" terimine uygun board kaydı bulunamadı. Filtrenizi değiştirebilirsiniz.`
                : 'Ekip çalışmalarınızı organize etmek için yeni bir Kanban board\'u oluşturun.'}
            </p>
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="btn-secondary py-1.5 px-3.5 text-xs font-semibold"
              >
                Aramayı Temizle
              </button>
            ) : isAdmin ? (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary gap-1.5 py-2 px-3.5 text-xs font-semibold"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>İlk Boardunuzu Oluşturun</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                Organizasyon yöneticinizin board eklemesi bekleniyor.
              </span>
            )}
          </div>
        )}

        {/* ── Boards Container (Grid or Table View) ────────────────── */}
        {!isLoading && filteredBoards.length > 0 && (
          <div className="max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
            {viewMode === 'grid' ? (
              /* ── Compact Grid View (3-4 Columns) ─────────────────────── */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredBoards.map((board) => {
                  const totalTasks = board.columns?.reduce((sum, col) => sum + (col.tasks?.length || 0), 0) ?? 0;
                  const columnCount = board.columns?.length ?? 0;
                  const isGuestBoard = !!(user?.organizationName && board.organizationName && board.organizationName !== user.organizationName);
                  const accentColor = getBoardAccentColor(board);

                  return (
                    <Link
                      key={board.id}
                      to={`/boards/${board.id}`}
                      className="group relative flex flex-col justify-between rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden pl-5"
                      style={{
                        background: `linear-gradient(145deg, ${accentColor}1A 0%, ${accentColor}08 40%, #ffffff 90%)`,
                        border: `1.5px solid ${accentColor}3D`,
                        boxShadow: `0 4px 20px -2px ${accentColor}20`,
                      }}
                    >
                      {/* Sol Canlı Renk Şeridi (4px - 6px) */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l shadow-xs"
                        style={{ backgroundColor: accentColor }}
                      />

                      {/* Top Header inside Card */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            {/* Workflow / Task Type Badge */}
                            {board.taskTypeName ? (
                              <span
                                className="inline-flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-md shadow-2xs truncate max-w-[190px] transition-all"
                                style={{
                                  backgroundColor: `${accentColor}22`,
                                  color: accentColor,
                                  border: `1px solid ${accentColor}55`,
                                }}
                                title={`İş Akışı: ${board.taskTypeName}`}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: accentColor }}
                                />
                                {board.taskTypeName}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-md shadow-2xs"
                                style={{
                                  backgroundColor: `${accentColor}18`,
                                  color: accentColor,
                                  border: `1px solid ${accentColor}44`,
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: accentColor }}
                                />
                                Standart Board
                              </span>
                            )}

                            {/* Organization Badge */}
                            {board.organizationName && (
                              <span
                                className={`inline-flex items-center font-semibold text-[11px] px-2.5 py-0.5 rounded-full border truncate max-w-[130px] shadow-2xs ${
                                  isGuestBoard
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100/90 text-slate-700 border-slate-200/90'
                                }`}
                                title={board.organizationName}
                              >
                                {board.organizationName}
                              </span>
                            )}
                          </div>

                          {/* Delete Button */}
                          {canDeleteBoard(board) && (
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, board)}
                              disabled={deleting === board.id}
                              className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shrink-0"
                              title="Board'u Sil"
                              aria-label={`Sil ${board.name}`}
                            >
                              {deleting === board.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin block" />
                              ) : (
                                <TrashIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Board Title */}
                        <h2 className="text-sm sm:text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate mt-1.5" title={board.name}>
                          {board.name}
                        </h2>

                        {/* Description */}
                        <p className="text-xs text-slate-500/80 mt-1 line-clamp-1 leading-relaxed min-h-[18px]" title={board.description || ''}>
                          {board.description || 'Açıklama bulunmuyor.'}
                        </p>
                      </div>

                      {/* Card Footer: Metadata & Counts */}
                      <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium text-[11px]">
                          {board.createdAt ? format(parseISO(board.createdAt), 'd MMM yyyy', { locale: tr }) : ''}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 px-2.5 py-0.5 rounded-full text-[11px] border border-slate-200/80 shadow-2xs transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-slate-500">
                              <rect x="3" y="3" width="7" height="18" rx="1.5" />
                              <rect x="14" y="3" width="7" height="18" rx="1.5" />
                            </svg>
                            {columnCount} Kolon
                          </span>

                          <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/80 px-2.5 py-0.5 rounded-full text-[11px] border border-blue-200/70 shadow-2xs transition-colors">
                            <FileIcon className="w-3 h-3 text-blue-600" />
                            {totalTasks} Görev
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* ── Dense Table / List View ──────────────────────────────── */
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3.5">Board Adı</th>
                        <th className="py-2.5 px-3">İş Akışı / Görev Tipi</th>
                        <th className="py-2.5 px-3">Organizasyon</th>
                        <th className="py-2.5 px-3 text-center">Kolon</th>
                        <th className="py-2.5 px-3 text-center">Görev</th>
                        <th className="py-2.5 px-3">Oluşturulma Tarihi</th>
                        <th className="py-2.5 px-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBoards.map((board) => {
                        const totalTasks = board.columns?.reduce((sum, col) => sum + (col.tasks?.length || 0), 0) ?? 0;
                        const columnCount = board.columns?.length ?? 0;
                        const accentColor = getBoardAccentColor(board);

                        return (
                          <tr
                            key={board.id}
                            className="group hover:bg-slate-50/80 transition-colors"
                          >
                            {/* Board Name & Desc */}
                            <td className="py-2.5 px-3.5">
                              <Link
                                to={`/boards/${board.id}`}
                                className="flex items-center gap-2.5 font-bold text-slate-800 hover:text-blue-600 transition-colors"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: accentColor }}
                                />
                                <div>
                                  <div className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-600">
                                    {board.name}
                                  </div>
                                  {board.description && (
                                    <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs sm:max-w-md">
                                      {board.description}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </td>

                            {/* Workflow / Task Type Badge */}
                            <td className="py-2.5 px-3">
                              {board.taskTypeName ? (
                                <span
                                  className="inline-flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-md shadow-2xs"
                                  style={{
                                    backgroundColor: `${accentColor}22`,
                                    color: accentColor,
                                    border: `1px solid ${accentColor}55`,
                                  }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shadow-2xs"
                                    style={{ backgroundColor: accentColor }}
                                  />
                                  {board.taskTypeName}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-md shadow-2xs"
                                  style={{
                                    backgroundColor: `${accentColor}18`,
                                    color: accentColor,
                                    border: `1px solid ${accentColor}44`,
                                  }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shadow-2xs"
                                    style={{ backgroundColor: accentColor }}
                                  />
                                  Standart
                                </span>
                              )}
                            </td>

                            {/* Organization */}
                            <td className="py-2.5 px-3">
                              {board.organizationName ? (
                                <span className="inline-flex items-center font-semibold text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                  {board.organizationName}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </td>

                            {/* Column Count */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center justify-center font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs border border-slate-200/80">
                                {columnCount}
                              </span>
                            </td>

                            {/* Task Count */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center justify-center gap-1 font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full text-xs border border-blue-200/70">
                                <FileIcon className="w-3 h-3 text-blue-600" />
                                {totalTasks}
                              </span>
                            </td>

                            {/* Created Date */}
                            <td className="py-2.5 px-3 text-slate-400 text-xs font-medium whitespace-nowrap">
                              {board.createdAt ? format(parseISO(board.createdAt), 'd MMM yyyy', { locale: tr }) : '-'}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  to={`/boards/${board.id}`}
                                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-md transition-all border border-blue-200/60"
                                >
                                  Aç →
                                </Link>

                                {canDeleteBoard(board) && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDelete(e, board)}
                                    disabled={deleting === board.id}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                                    title="Board'u Sil"
                                  >
                                    {deleting === board.id ? (
                                      <span className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin block" />
                                    ) : (
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <CreateBoardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onBoardCreated={() => queryClient.invalidateQueries({ queryKey: ['boards'] })}
        defaultDepartmentName={selectedOrgFilter !== 'ALL' ? selectedOrgFilter : undefined}
      />

      <CreateOrganizationModal
        isOpen={createOrgModalOpen}
        onClose={() => setCreateOrgModalOpen(false)}
        onOrganizationCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
          queryClient.invalidateQueries({ queryKey: ['boards'] });
        }}
      />

      {/* Manage Organization Members Modal */}
      <ManageDepartmentMembersModal
        isOpen={manageMembersModalOpen}
        onClose={() => setManageMembersModalOpen(false)}
        organization={selectedOrgObj}
        onMembersChanged={() => {
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
          queryClient.invalidateQueries({ queryKey: ['boards'] });
        }}
      />
    </div>
  );
}

