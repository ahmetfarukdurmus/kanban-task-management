import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Navigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TaskTypeModal from '@/components/TaskTypeModal';
import { taskTypeService } from '@/services/taskTypeService';
import { organizationService } from '@/services/organizationService';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskTypeDto } from '@/types';
import {
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '@/components/icons';

export default function AdminTaskTypesPage() {
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin } = useAuth();

  const [modalOpen, setModalOpen]               = useState(false);
  const [editingTaskType, setEditingTaskType]   = useState<TaskTypeDto | null>(null);
  const [deletingId, setDeletingId]             = useState<number | null>(null);
  const [searchQuery, setSearchQuery]           = useState('');
  const [orgFilter, setOrgFilter]               = useState<string>('ALL');

  // Guard: Only ADMIN or SUPER_ADMIN can access
  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/boards" replace />;
  }

  const {
    data: taskTypes = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => taskTypeService.getAll(),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: organizationService.getAll,
    enabled: isSuperAdmin,
  });

  // Filtered task types
  const filteredTaskTypes = useMemo(() => {
    return taskTypes.filter((type) => {
      // Organization filter
      if (orgFilter !== 'ALL') {
        if (orgFilter === 'GLOBAL' && type.organizationId != null) return false;
        if (orgFilter !== 'GLOBAL' && type.organizationName !== orgFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = type.name.toLowerCase().includes(q);
        const matchesOrg = type.organizationName?.toLowerCase().includes(q);
        const matchesRule = type.rules?.some(
          (r) =>
            r.targetColumnTitle?.toLowerCase().includes(q) ||
            r.sourceColumnTitle?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q)
        );
        return matchesName || matchesOrg || matchesRule;
      }

      return true;
    });
  }, [taskTypes, orgFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingTaskType(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (type: TaskTypeDto) => {
    setEditingTaskType(type);
    setModalOpen(true);
  };

  const handleDelete = async (type: TaskTypeDto) => {
    if (
      !confirm(
        `"${type.name}" görev tipini silmek istediğinizden emin misiniz? Bu tipe bağlı görevlerin tip tanımları kaldırılacaktır.`
      )
    ) {
      return;
    }

    setDeletingId(type.id);
    try {
      await taskTypeService.remove(type.id);
      await queryClient.invalidateQueries({ queryKey: ['task-types'] });
      toast.success(`"${type.name}" görev tipi başarıyla silindi.`);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Görev tipi silinirken hata oluştu.';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRule = async (taskTypeId: number, ruleId: number) => {
    try {
      await taskTypeService.removeRule(taskTypeId, ruleId);
      await queryClient.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Geçiş kuralı başarıyla kaldırıldı.');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Kural silinirken hata oluştu.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                  <path d="M7 7h.01" />
                </svg>
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Görev Tipleri & İş Akışı Kuralları
              </h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Kart renklerini, şablon tiplerini ve kolonlar arası geçişte zorunlu tutulacak doğrulama kurallarını (Workflow Guards) buradan yönetin.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            type="button"
            className="btn-primary py-2.5 px-4 rounded-xl text-xs font-semibold gap-2 shadow-xs shrink-0 self-start md:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Yeni Görev Tipi Oluştur</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Görev tipi veya kural ara…"
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>

          {isSuperAdmin && organizations.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Organizasyon:</span>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              >
                <option value="ALL">Tüm Organizasyonlar</option>
                <option value="GLOBAL">Genel / Şirket Bağımsız</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Görev tipleri yükleniyor…</span>
          </div>
        )}

        {isError && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
            <p className="text-xs text-rose-700 font-semibold">Görev tipleri yüklenirken bir sorun oluştu.</p>
            <button
              onClick={() => refetch()}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Yeniden Dene
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredTaskTypes.length === 0 && (
          <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tanımlı Görev Tipi Bulunamadı</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchQuery || orgFilter !== 'ALL'
                ? 'Arama kriterlerinize uygun görev tipi bulunamadı.'
                : 'Ekibiniz için dinamik görev şablonları ve kolon geçiş kuralları tanımlamak için ilk görev tipinizi oluşturun.'}
            </p>
            {!searchQuery && orgFilter === 'ALL' && (
              <button
                onClick={handleOpenCreate}
                type="button"
                className="btn-primary text-xs py-2 px-4 rounded-xl font-semibold gap-1.5 mt-2 inline-flex"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>İlk Görev Tipini Oluştur</span>
              </button>
            )}
          </div>
        )}

        {/* Task Types Grid / Cards */}
        {!isLoading && !isError && filteredTaskTypes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredTaskTypes.map((type) => {
              const ruleCount = type.rules?.length || 0;
              const color = type.colorHex || '#3B82F6';

              return (
                <div
                  key={type.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full ring-2 ring-white shadow-xs shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>{type.name}</span>
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border"
                              style={{
                                backgroundColor: `${color}15`,
                                color: color,
                                borderColor: `${color}35`,
                              }}
                            >
                              {color}
                            </span>
                          </h2>
                          {type.organizationName && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Organizasyon: <strong className="text-slate-700">{type.organizationName}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(type)}
                          type="button"
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(type)}
                          type="button"
                          disabled={deletingId === type.id}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Görev Tipini Sil"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Body: Workflow Stages & Transition Rules */}
                  <div className="p-5 bg-slate-50/40 flex-1 space-y-4">

                    {/* Workflow Stages Pipeline */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-600">
                            <rect x="3" y="3" width="7" height="18" rx="1" />
                            <rect x="14" y="3" width="7" height="11" rx="1" />
                          </svg>
                          <span>İş Akışı Aşamaları (Kolonlar)</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {type.columns?.length || 0} Kolon
                        </span>
                      </div>

                      {type.columns && type.columns.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                          {type.columns.map((col, cIdx) => (
                            <div key={col.id || cIdx} className="flex items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-2xs"
                                style={{
                                  backgroundColor: col.colorHex ? `${col.colorHex}12` : '#f1f5f9',
                                  borderColor: col.colorHex ? `${col.colorHex}35` : '#e2e8f0',
                                  color: col.colorHex || '#334155',
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: col.colorHex || '#94a3b8' }}
                                />
                                <span>{col.title}</span>
                              </span>
                              {cIdx < (type.columns?.length || 0) - 1 && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-slate-400">
                                  <path d="m9 18 6-6-6-6" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-0.5">
                          Standart pano kolonları kullanılır.
                        </p>
                      )}
                    </div>

                    {/* Transition Rules */}
                    <div className="pt-3 border-t border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-blue-600">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                          <span>Geçiş Doğrulama Kuralları</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {ruleCount} Kural
                        </span>
                      </div>

                    {ruleCount === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        Bu görev tipi için henüz bir kolon geçiş kuralı tanımlanmamış.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {type.rules.map((rule) => {
                          const isChecklist = rule.ruleType === 'CHECKLIST_REQUIRED';
                          return (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs shadow-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Transition Path Badge */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] shrink-0">
                                  <span>{rule.sourceColumnTitle || 'Tüm Kolonlar'}</span>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-slate-400">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-blue-700 font-bold">{rule.targetColumnTitle}</span>
                                </span>

                                {/* Rule Type Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                                    isChecklist
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                                  }`}
                                >
                                  {isChecklist ? (
                                    <>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Kontrol Listesi</span>
                                    </>
                                  ) : (
                                    <>
                                      <PaperclipIcon className="w-3 h-3" />
                                      <span>Dosya / Görsel Eki</span>
                                    </>
                                  )}
                                </span>

                                {/* Description */}
                                {rule.description && (
                                  <span className="text-slate-500 text-[11px] truncate" title={rule.description}>
                                    "{rule.description}"
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteRule(type.id, rule.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                                title="Kuralı Sil"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Create / Edit Modal */}
      <TaskTypeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['task-types'] })}
        taskTypeToEdit={editingTaskType}
      />
    </div>
  );
}
