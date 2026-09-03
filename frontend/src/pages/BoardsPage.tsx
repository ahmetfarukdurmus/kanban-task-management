import { useMemo, useState } from 'react';
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
import { FileIcon, PlusIcon, TrashIcon, UserIcon } from '@/components/icons';

export default function BoardsPage() {
  const queryClient               = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [manageMembersModalOpen, setManageMembersModalOpen] = useState(false);
  const [deleting,  setDeleting]  = useState<number | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');

  const isDeptAdmin = isAdmin && !isSuperAdmin && (!!user?.organizationId || !!user?.organizationName);

  const pageTitle = isSuperAdmin
    ? 'Tüm Panolar'
    : (user?.organizationName ? `${user.organizationName} Panoları` : 'Panolarım');

  const pageSubtitle = isSuperAdmin
    ? 'Tüm departmanlara ait panoları, iş süreçlerini ve ilerlemeleri merkezi olarak yönetin.'
    : (user?.organizationName
        ? `${user.organizationName} departmanına ve size atanmış görevlerin bulunduğu panolara buradan erişin.`
        : 'Tüm projelerinizi, süreçlerinizi ve takım işlerinizi tek bir yerden yönetin.');

  const { data: boards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['boards'],
    queryFn:  boardApi.getAll,
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn:  organizationService.getAll,
  });

  // Selected organization object if filtering by specific department
  const selectedOrgObj = useMemo(() => {
    if (selectedOrgFilter === 'ALL') return null;
    return organizations.find((o) => o.name === selectedOrgFilter) || null;
  }, [organizations, selectedOrgFilter]);

  // Distinct departments extracted from available boards and organizations
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

  // Filtered boards for view
  const filteredBoards = useMemo(() => {
    if (selectedOrgFilter === 'ALL') {
      return boards;
    }
    return boards.filter((b) => b.organizationName === selectedOrgFilter);
  }, [boards, selectedOrgFilter]);

  const handleDelete = async (e: React.MouseEvent, board: BoardResponse) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${board.name}" panosunu ve altındaki tüm görevleri kalıcı olarak silmek istediğinizden emin misiniz?`)) return;

    setDeleting(board.id);
    try {
      await boardApi.remove(board.id);
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Pano başarıyla silindi.');
    } catch {
      toast.error('Pano silinirken bir hata oluştu.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteOrg = async (org: OrganizationDto) => {
    if (!confirm(`Bu departmanı (${org.name}) ve departmana ait tüm panoları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setDeletingOrg(true);
    try {
      await organizationService.delete(org.id);
      setSelectedOrgFilter('ALL');
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success(`"${org.name}" departmanı başarıyla silindi.`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Departman silinirken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setDeletingOrg(false);
    }
  };

  const showFilterBar = !isLoading && (isSuperAdmin || availableDepts.length > 1);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <Navbar />

      <main className="mx-auto max-w-screen-xl px-4 sm:px-6 py-8 sm:py-10">

        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {pageTitle}
              </h1>
              {isSuperAdmin ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Super Admin
                </span>
              ) : isDeptAdmin ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Departman Yöneticisi
                </span>
              ) : user?.organizationName ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Ekip Üyesi
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {pageSubtitle}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Super Admin: + Yeni Departman Button */}
            {isSuperAdmin && (
              <button
                onClick={() => setCreateOrgModalOpen(true)}
                className="btn-secondary gap-2 py-2.5 px-3.5 text-xs font-bold text-slate-700 hover:text-blue-600 shadow-xs hover:border-blue-300"
                title="Yeni Departman Tanımla"
              >
                <PlusIcon className="w-4 h-4 text-blue-600" />
                <span>Yeni Departman</span>
              </button>
            )}

            {/* New Board Button (Super Admin & Department Admin) */}
            {isAdmin && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary gap-2 py-2.5 px-4 shadow-sm hover:shadow"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Yeni Pano Oluştur</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Department Filter Bar (Super Admin or Cross-Department Access) ── */}
        {showFilterBar && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 flex-wrap sm:flex-nowrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Departman:
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrgFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {deptName} ({count})
                  </button>

                  {/* Super Admin Actions when this department is selected */}
                  {isSuperAdmin && isSelected && selectedOrgObj && (
                    <div className="inline-flex items-center gap-1.5 animate-fade-in">
                      {/* Manage Members button */}
                      <button
                        type="button"
                        onClick={() => setManageMembersModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition-all shadow-xs"
                        title={`${deptName} departmanı üyelerini yönet ve yeni üye ekle`}
                      >
                        <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Üyeleri Yönet / Ekle</span>
                      </button>

                      {/* Delete Department button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteOrg(selectedOrgObj)}
                        disabled={deletingOrg}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all shadow-xs"
                        title={`${deptName} departmanını sil`}
                      >
                        {deletingOrg ? (
                          <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-rose-600 rounded-full animate-spin block" />
                        ) : (
                          <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span>Departmanı Sil</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick + Yeni Departman button in filter bar for Super Admin */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCreateOrgModalOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 transition-all shadow-xs shrink-0"
                title="Yeni Departman Tanımla"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Yeni Departman</span>
              </button>
            )}
          </div>
        )}

        {/* ── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-400">Panolar yükleniyor…</p>
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────── */}
        {isError && (
          <div className="text-center py-20 bg-white rounded-2xl border border-rose-200/80 shadow-xs max-w-md mx-auto p-8">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Panolar yüklenemedi</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Sunucuya bağlanırken bir hata oluştu.</p>
            <button onClick={() => refetch()} className="btn-secondary py-2 px-4 text-xs font-semibold">
              Tekrar Dene
            </button>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────── */}
        {!isLoading && !isError && filteredBoards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 max-w-md mx-auto text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 my-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-blue-600">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
                <rect x="14" y="18" width="7" height="3" rx="1.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              {selectedOrgFilter !== 'ALL' ? 'Bu Departmana Ait Pano Bulunamadı' : 'Henüz Bir Pano Bulunmuyor'}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 mb-6 leading-relaxed">
              Ekip çalışmalarınızı veya hedeflerinizi organize etmek için yeni bir Kanban panosu oluşturarak başlayın.
            </p>
            {isAdmin ? (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary gap-2 py-2 px-4 text-xs font-semibold"
              >
                <PlusIcon className="w-4 h-4" />
                <span>İlk Panonuzu Oluşturun</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                Departman yöneticinizin pano eklemesi bekleniyor.
              </span>
            )}
          </div>
        )}

        {/* ── Board Grid ─────────────────────────────────────────── */}
        {!isLoading && filteredBoards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBoards.map((board) => {
              const totalTasks = board.columns?.reduce((sum, col) => sum + (col.tasks?.length || 0), 0) ?? 0;
              const columnCount = board.columns?.length ?? 0;
              const isGuestBoard = !!(user?.organizationName && board.organizationName && board.organizationName !== user.organizationName);

              return (
                <Link
                  key={board.id}
                  to={`/boards/${board.id}`}
                  className="group relative flex flex-col justify-between bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-200 cursor-pointer overflow-hidden"
                >
                  {/* Top Header inside Card */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100/80 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4.5 h-4.5">
                            <rect x="3" y="3" width="7" height="18" rx="1.5" />
                            <rect x="14" y="3" width="7" height="11" rx="1.5" />
                          </svg>
                        </div>

                        {/* Organization Badge (Super Admin or Guest assigned board view) */}
                        {board.organizationName && (
                          <span
                            className={`inline-flex items-center font-semibold text-[11px] px-2 py-0.5 rounded-md border ${
                              isGuestBoard
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200/80'
                            }`}
                          >
                            {board.organizationName}
                            {isGuestBoard && (
                              <span className="ml-1 text-[10px] text-amber-600 font-normal">(Atanmış)</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Delete Button (Only for Super Admin & Department Admin of own board) */}
                      {isAdmin && (!user?.organizationName || board.organizationName === user.organizationName || isSuperAdmin) && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, board)}
                          disabled={deleting === board.id}
                          className="opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Panoyu Sil"
                          aria-label={`Sil ${board.name}`}
                        >
                          {deleting === board.id ? (
                            <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin block" />
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Board Title */}
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate mt-1">
                      {board.name}
                    </h2>

                    {/* Description */}
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed min-h-[32px]">
                      {board.description || 'Açıklama bulunmuyor.'}
                    </p>
                  </div>

                  {/* Card Footer: Metadata & Counts */}
                  <div className="mt-5 pt-4 border-t border-slate-100/90 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium text-[11px]">
                      {board.createdAt ? format(parseISO(board.createdAt), 'd MMM yyyy', { locale: tr }) : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Column Count */}
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/60">
                        {columnCount} Kolon
                      </span>

                      {/* Task Count */}
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100">
                        <FileIcon className="w-3 h-3 text-blue-500" />
                        {totalTasks} Görev
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
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

      {/* Manage Department Members Modal */}
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
