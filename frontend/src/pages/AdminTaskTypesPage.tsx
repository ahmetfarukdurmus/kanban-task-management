import { useMemo, useState, useEffect } from 'react';
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
  const [expandedCards, setExpandedCards]       = useState<Record<number, boolean>>({});

  // View mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('admin_task_types_view_mode') as 'grid' | 'table') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('admin_task_types_view_mode', viewMode);
  }, [viewMode]);

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

  const toggleExpand = (id: number) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 max-w-screen-2xl">
        
        {/* Header Banner - Compact & Linear-styled */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Görev Tipleri & İş Akışı Kuralları
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Dinamik şablonları, iş akışı aşamalarını ve kolon geçiş kurallarını (Guards) yönetin.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            type="button"
            className="btn-primary py-2 px-3.5 rounded-lg text-xs font-bold gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Yeni Görev Tipi</span>
          </button>
        </div>

        {/* Filter, Search & View Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex flex-1 items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Görev tipi, kural veya kolon ara…"
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Organization Filter */}
            {isSuperAdmin && organizations.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Org:</span>
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  className="bg-slate-50/70 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="ALL">Tümü ({taskTypes.length})</option>
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

          {/* Stats & View Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {filteredTaskTypes.length} Görev Tipi
            </span>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Yönetim Tablosu"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span className="hidden sm:inline">Tablo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Görev tipleri yükleniyor…</span>
          </div>
        )}

        {isError && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-2">
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
          <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
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
                className="btn-primary text-xs py-1.5 px-3.5 rounded-lg font-semibold gap-1.5 mt-2 inline-flex"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>İlk Görev Tipini Oluştur</span>
              </button>
            )}
          </div>
        )}

        {/* ── Content: Grid View or Table View ──────────────────────── */}
        {!isLoading && !isError && filteredTaskTypes.length > 0 && (
          viewMode === 'grid' ? (
            /* ── 3-Column Compact Grid View ──────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTaskTypes.map((type) => {
                const ruleCount = type.rules?.length || 0;
                const colCount = type.columns?.length || 0;
                const color = type.colorHex || '#3B82F6';
                const isExpanded = expandedCards[type.id] ?? true;

                return (
                  <div
                    key={type.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between border-l-4"
                    style={{ borderLeftColor: color }}
                  >
                    {/* Compact Card Header */}
                    <div className="p-3.5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: color }}
                          />
                          <div className="min-w-0">
                            <h2 className="text-sm font-bold text-slate-900 truncate" title={type.name}>
                              {type.name}
                            </h2>
                            {type.organizationName ? (
                              <span className="text-[10px] text-slate-500 font-medium truncate block">
                                {type.organizationName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium block">
                                Genel Şablon
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEdit(type)}
                            type="button"
                            className="px-2 py-0.5 text-[11px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-md transition-all border border-blue-200/60"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDelete(type)}
                            type="button"
                            disabled={deletingId === type.id}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Görev Tipini Sil"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Summary Badges Row */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center font-semibold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60">
                            {colCount} Kolon
                          </span>
                          <span
                            className="inline-flex items-center font-semibold text-[10px] px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: `${color}12`,
                              color: color,
                              borderColor: `${color}30`,
                            }}
                          >
                            {ruleCount} Kural
                          </span>
                          {type.requireTestDate && (
                            <span className="inline-flex items-center font-bold text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200" title="QA Kolonuna Geçişte Test Tarihi Zorunlu">
                              Test Tarihi Zorunlu
                            </span>
                          )}
                          {type.requireEnvironment && (
                            <span className="inline-flex items-center font-bold text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200" title="QA Kolonuna Geçişte Ortam Zorunlu">
                              Ortam Zorunlu
                            </span>
                          )}
                        </div>

                        {/* Accordion Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(type.id)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? 'Gizle' : 'Detaylar'}</span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Body: Columns & Transition Rules */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50/50 flex-1 space-y-2.5 text-xs animate-fade-in">
                        {/* Columns Mini Flow */}
                        {type.columns && type.columns.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Aşamalar ({type.columns.length}):
                            </span>
                            <div className="flex flex-wrap items-center gap-1 p-1.5 bg-white rounded-lg border border-slate-200/70 shadow-2xs">
                              {type.columns.map((col, cIdx) => (
                                <div key={col.id || cIdx} className="flex items-center gap-1">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                                    style={{
                                      backgroundColor: col.colorHex ? `${col.colorHex}10` : '#f8fafc',
                                      borderColor: col.colorHex ? `${col.colorHex}30` : '#e2e8f0',
                                      color: col.colorHex || '#475569',
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: col.colorHex || '#94a3b8' }}
                                    />
                                    <span>{col.title}</span>
                                  </span>
                                  {cIdx < (type.columns?.length || 0) - 1 && (
                                    <span className="text-slate-300 text-[9px]">→</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Transition Rules List (Max Height Scroll) */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Geçiş Kuralları ({ruleCount}):
                          </span>

                          {ruleCount === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-0.5">
                              Özel geçiş kuralı bulunmuyor.
                            </p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                              {type.rules.map((rule) => {
                                const isChecklist = rule.ruleType === 'CHECKLIST_REQUIRED';
                                return (
                                  <div
                                    key={rule.id}
                                    className="flex items-center justify-between gap-1.5 p-1.5 bg-white border border-slate-200/80 rounded-lg text-[11px] shadow-2xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {/* Path */}
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] shrink-0">
                                        <span>{rule.sourceColumnTitle || 'Tümü'}</span>
                                        <span className="text-slate-400">→</span>
                                        <span className="text-blue-700 font-bold">{rule.targetColumnTitle}</span>
                                      </span>

                                      {/* Type Icon Badge */}
                                      <span
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                          isChecklist
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                                        }`}
                                        title={isChecklist ? 'Kontrol Listesi Şartı' : 'Dosya / Görsel Şartı'}
                                      >
                                        {isChecklist ? (
                                          <span>✓ Liste</span>
                                        ) : (
                                          <>
                                            <PaperclipIcon className="w-2.5 h-2.5" />
                                            <span>Ek</span>
                                          </>
                                        )}
                                      </span>

                                      {/* Description */}
                                      {rule.description && (
                                        <span className="text-slate-500 text-[10px] truncate" title={rule.description}>
                                          {rule.description}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRule(type.id, rule.id)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-colors shrink-0"
                                      title="Kuralı Sil"
                                    >
                                      <TrashIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Modern Table View (Linear SaaS Style) ────────────────── */
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Görev Tipi</th>
                      <th className="py-2.5 px-3">Organizasyon</th>
                      <th className="py-2.5 px-3">İş Akışı Kolonları</th>
                      <th className="py-2.5 px-3">Geçiş Kuralları</th>
                      <th className="py-2.5 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTaskTypes.map((type) => {
                      const color = type.colorHex || '#3B82F6';
                      const ruleCount = type.rules?.length || 0;
                      const colCount = type.columns?.length || 0;

                      return (
                        <tr key={type.id} className="group hover:bg-blue-50/30 transition-colors">
                          {/* Name & Color */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                {type.name}
                              </span>
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded border"
                                style={{
                                  backgroundColor: `${color}12`,
                                  color: color,
                                  borderColor: `${color}30`,
                                }}
                              >
                                {color}
                              </span>
                            </div>
                          </td>

                          {/* Organization */}
                          <td className="py-2.5 px-3">
                            {type.organizationName ? (
                              <span className="inline-flex items-center font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/80">
                                {type.organizationName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Genel Şablon</span>
                            )}
                          </td>

                          {/* Columns */}
                          <td className="py-2.5 px-3">
                            {colCount > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap max-w-sm">
                                {type.columns?.map((c, i) => (
                                  <span
                                    key={c.id || i}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                                    style={{
                                      backgroundColor: c.colorHex ? `${c.colorHex}10` : '#f8fafc',
                                      borderColor: c.colorHex ? `${c.colorHex}30` : '#e2e8f0',
                                      color: c.colorHex || '#475569',
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: c.colorHex || '#94a3b8' }}
                                    />
                                    {c.title}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Standart</span>
                            )}
                          </td>

                          {/* Rules */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="inline-flex items-center font-bold text-[10px] px-2 py-0.5 rounded-md border"
                                style={{
                                  backgroundColor: `${color}12`,
                                  color: color,
                                  borderColor: `${color}30`,
                                }}
                              >
                                {ruleCount} Kural
                              </span>
                              {type.requireTestDate && (
                                <span className="inline-flex items-center font-bold text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                  Test Tarihi
                                </span>
                              )}
                              {type.requireEnvironment && (
                                <span className="inline-flex items-center font-bold text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                                  Ortam
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(type)}
                                type="button"
                                className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-md transition-all border border-blue-200/60"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleDelete(type)}
                                type="button"
                                disabled={deletingId === type.id}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                                title="Görev Tipini Sil"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
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
