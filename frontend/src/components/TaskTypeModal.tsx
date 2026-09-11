import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { taskTypeService } from '@/services/taskTypeService';
import { organizationService } from '@/services/organizationService';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CreateTaskTypeColumnRequest,
  CreateTaskTypeRequest,
  CreateTransitionRuleRequest,
  OrganizationDto,
  TaskTypeDto,
  TransitionRuleType,
  UpdateTaskTypeRequest,
} from '@/types';
import { PlusIcon, TrashIcon } from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  taskTypeToEdit?: TaskTypeDto | null;
}

interface ColumnFormItem {
  id?: number;
  key: string;
  title: string;
  colorHex: string;
}

interface RuleFormState {
  sourceColumnTitle: string; // empty means "Any column"
  targetColumnTitle: string;
  ruleType: TransitionRuleType;
  description: string;
}

const PRESET_COLORS = [
  { label: 'Mavi', hex: '#3B82F6' },
  { label: 'Kırmızı', hex: '#EF4444' },
  { label: 'Yeşil', hex: '#10B981' },
  { label: 'Turuncu', hex: '#F59E0B' },
  { label: 'Mor', hex: '#8B5CF6' },
  { label: 'Pembe', hex: '#EC4899' },
  { label: 'Camgöbeği', hex: '#06B6D4' },
  { label: 'Gri', hex: '#64748B' },
];

const DEFAULT_WORKFLOW_COLUMNS: { title: string; colorHex: string }[] = [
  { title: 'Yapılacaklar', colorHex: '#64748B' },
  { title: 'Geliştirmede', colorHex: '#3B82F6' },
  { title: 'Test & QA', colorHex: '#F59E0B' },
  { title: 'Tamamlandı', colorHex: '#10B981' },
];

export default function TaskTypeModal({
  isOpen,
  onClose,
  onSaved,
  taskTypeToEdit,
}: Props) {
  const { user, isSuperAdmin } = useAuth();

  const [name, setName]                     = useState('');
  const [colorHex, setColorHex]             = useState('#3B82F6');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [requireTestDate, setRequireTestDate] = useState(false);
  const [requireEnvironment, setRequireEnvironment] = useState(false);
  
  // Dynamic Workflow Columns
  const [columns, setColumns]               = useState<ColumnFormItem[]>([]);
  // Dynamic Transition Rules
  const [rules, setRules]                   = useState<RuleFormState[]>([]);

  const [organizations, setOrganizations]   = useState<OrganizationDto[]>([]);
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const isEditing = !!taskTypeToEdit;

  // Load organizations if super admin
  useEffect(() => {
    if (!isOpen) return;

    if (isSuperAdmin) {
      organizationService.getAll()
        .then((orgs) => setOrganizations(orgs))
        .catch(() => { /* ignore */ });
    }
  }, [isOpen, isSuperAdmin]);

  // Populate form if editing
  useEffect(() => {
    if (taskTypeToEdit) {
      setName(taskTypeToEdit.name);
      setColorHex(taskTypeToEdit.colorHex || '#3B82F6');
      setOrganizationId(taskTypeToEdit.organizationId || null);
      setRequireTestDate(!!taskTypeToEdit.requireTestDate);
      setRequireEnvironment(!!taskTypeToEdit.requireEnvironment);

      // Populate workflow columns
      if (taskTypeToEdit.columns && taskTypeToEdit.columns.length > 0) {
        setColumns(
          taskTypeToEdit.columns.map((c) => ({
            id: c.id,
            key: `col-${c.id}`,
            title: c.title,
            colorHex: c.colorHex || '#3B82F6',
          }))
        );
      } else {
        setColumns(
          DEFAULT_WORKFLOW_COLUMNS.map((c, i) => ({
            key: `col-default-${i}`,
            title: c.title,
            colorHex: c.colorHex,
          }))
        );
      }

      // Populate transition rules
      if (taskTypeToEdit.rules && taskTypeToEdit.rules.length > 0) {
        setRules(
          taskTypeToEdit.rules.map((r) => ({
            sourceColumnTitle: r.sourceColumnTitle || '',
            targetColumnTitle: r.targetColumnTitle || '',
            ruleType: r.ruleType,
            description: r.description || '',
          }))
        );
      } else {
        setRules([]);
      }
    } else {
      setName('');
      setColorHex('#3B82F6');
      setOrganizationId(user?.organizationId || null);
      setRequireTestDate(false);
      setRequireEnvironment(false);
      setColumns(
        DEFAULT_WORKFLOW_COLUMNS.map((c, i) => ({
          key: `col-default-${i}`,
          title: c.title,
          colorHex: c.colorHex,
        }))
      );
      setRules([]);
    }
  }, [taskTypeToEdit, isOpen, user]);

  if (!isOpen) return null;

  /* ── Column Management Handlers ── */
  const handleAddColumn = () => {
    const newIdx = columns.length + 1;
    const newCol: ColumnFormItem = {
      key: `col-new-${Date.now()}`,
      title: `Aşama ${newIdx}`,
      colorHex: PRESET_COLORS[(newIdx - 1) % PRESET_COLORS.length].hex,
    };
    setColumns((prev) => [...prev, newCol]);
  };

  const handleRemoveColumn = (index: number) => {
    const removedCol = columns[index];
    setColumns((prev) => prev.filter((_, i) => i !== index));

    // Also update any rules referencing this column
    setRules((prev) =>
      prev.map((r) => {
        let updated = { ...r };
        if (updated.sourceColumnTitle === removedCol.title) {
          updated.sourceColumnTitle = '';
        }
        if (updated.targetColumnTitle === removedCol.title) {
          updated.targetColumnTitle = '';
        }
        return updated;
      })
    );
  };

  const handleColumnChange = (
    index: number,
    field: 'title' | 'colorHex',
    value: string
  ) => {
    const oldTitle = columns[index].title;
    setColumns((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

    // If title changed, update existing rules referencing oldTitle
    if (field === 'title' && oldTitle.trim() !== value.trim()) {
      setRules((prev) =>
        prev.map((r) => {
          let updated = { ...r };
          if (updated.sourceColumnTitle === oldTitle) {
            updated.sourceColumnTitle = value;
          }
          if (updated.targetColumnTitle === oldTitle) {
            updated.targetColumnTitle = value;
          }
          return updated;
        })
      );
    }
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === columns.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setColumns((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  /* ── Transition Rule Handlers ── */
  const handleAddRule = () => {
    if (columns.length === 0) {
      toast.error('Kural eklemek için önce en az bir iş akışı kolonu tanımlamalısınız.');
      return;
    }
    const defaultTarget = columns[columns.length - 1]?.title || columns[0]?.title || '';
    const defaultSource = columns.length > 1 ? columns[columns.length - 2]?.title : '';

    setRules((prev) => [
      ...prev,
      {
        sourceColumnTitle: defaultSource,
        targetColumnTitle: defaultTarget,
        ruleType: 'CHECKLIST_REQUIRED',
        description: '',
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRuleChange = <K extends keyof RuleFormState>(
    index: number,
    field: K,
    value: RuleFormState[K]
  ) => {
    setRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  /* ── Form Submission ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Lütfen bir görev tipi adı girin.');
      return;
    }

    if (columns.length === 0) {
      toast.error('Lütfen en az bir iş akışı kolonu ekleyin.');
      return;
    }

    // Check for empty column titles
    for (let i = 0; i < columns.length; i++) {
      if (!columns[i].title.trim()) {
        toast.error(`${i + 1}. kolon için bir başlık girmelisiniz.`);
        return;
      }
    }

    // Validate rules
    for (let i = 0; i < rules.length; i++) {
      if (!rules[i].targetColumnTitle.trim()) {
        toast.error(`${i + 1}. kural için geçerli bir hedef kolon seçilmelidir.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formattedColumns: CreateTaskTypeColumnRequest[] = columns.map((c, idx) => ({
        id: c.id,
        title: c.title.trim(),
        colorHex: c.colorHex.trim() || undefined,
        position: idx,
      }));

      const formattedRules: CreateTransitionRuleRequest[] = rules.map((r) => ({
        sourceColumnTitle: r.sourceColumnTitle.trim() || undefined,
        targetColumnTitle: r.targetColumnTitle.trim(),
        ruleType: r.ruleType,
        description: r.description.trim() || undefined,
      }));

      if (isEditing && taskTypeToEdit) {
        const updatePayload: UpdateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          requireTestDate,
          requireEnvironment,
          columns: formattedColumns,
          rules: formattedRules,
        };
        await taskTypeService.update(taskTypeToEdit.id, updatePayload);
        toast.success(`"${name}" görev tipi ve iş akışı başarıyla güncellendi.`);
      } else {
        const createPayload: CreateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          requireTestDate,
          requireEnvironment,
          organizationId: organizationId || undefined,
          columns: formattedColumns,
          rules: formattedRules,
        };
        await taskTypeService.create(createPayload);
        toast.success(`"${name}" görev tipi ve iş akışı başarıyla oluşturuldu.`);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Görev tipi kaydedilirken bir hata oluştu.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs shrink-0"
              style={{ backgroundColor: colorHex }}
            />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEditing ? 'Görev Tipi & İş Akışını Düzenle' : 'Yeni Görev Tipi & İş Akışı Tanımla'}
              </h2>
              <p className="text-xs text-slate-500">
                Özel iş akışı kolonlarını (adımlarını) ve kolonlar arası geçiş kurallarını yapılandırın.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* ── Section 1: Name, Color & Organization ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Görev Tipi Adı <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Hata Bildirimi / Bug, Tasarım İş Akışı, Story / Özellik..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
                required
              />
            </div>

            {/* Color Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Kart ve Etiket Rengi
              </label>
              
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setColorHex(preset.hex)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      colorHex.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-slate-800 bg-slate-900 text-white shadow-xs scale-105'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    placeholder="#3B82F6"
                    className="w-24 text-xs font-mono font-semibold text-slate-800 bg-transparent border-none focus:outline-none uppercase"
                  />
                </div>

                {/* Live Preview */}
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs text-slate-400">Önizleme:</span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs"
                    style={{
                      backgroundColor: `${colorHex}18`,
                      color: colorHex,
                      border: `1px solid ${colorHex}40`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colorHex }}
                    />
                    {name.trim() || 'Örnek Tip'}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Feature Flags */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Gelişmiş Doğrulama Ayarları
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTestDate}
                    onChange={(e) => setRequireTestDate(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">Test Tarihi Zorunlu (QA/Test Kolonuna Geçişte)</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Kart Test veya QA aşamasına taşınırken 'Test Tarihi' girilmemişse geçiş engellenir.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireEnvironment}
                    onChange={(e) => setRequireEnvironment(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">Test Ortamı Zorunlu (DEV/TEST/STAGING/PROD)</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Kart Test veya QA aşamasına taşınırken hedef ortam seçilmemişse geçiş engellenir.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Organization Selector for SuperAdmin */}
            {isSuperAdmin && organizations.length > 0 && !isEditing && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Organizasyon
                </label>
                <select
                  value={organizationId || ''}
                  onChange={(e) => setOrganizationId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="">Genel / Otomatik (Varsayılan)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── Section 2: Dynamic Workflow Columns ── */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>İş Akışı Kolonları (Workflow Columns)</span>
                  <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200">
                    {columns.length} Kolon
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bu görev tipine ait özel aşamaları ve boarddaki kolon sırasını tanımlayın.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddColumn}
                className="btn-secondary text-xs py-1.5 px-3 gap-1.5 font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-300"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>+ Yeni Kolon Ekle</span>
              </button>
            </div>

            {/* Columns List */}
            <div className="space-y-2.5">
              {columns.map((col, idx) => (
                <div
                  key={col.key}
                  className="flex items-center gap-2.5 p-3 bg-slate-50/80 border border-slate-200 rounded-xl transition-all hover:border-slate-300 shadow-xs"
                >
                  {/* Position Badge & Reorder Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, 'up')}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5 leading-none"
                        title="Yukarı Taşı"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, 'down')}
                        disabled={idx === columns.length - 1}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5 leading-none"
                        title="Aşağı Taşı"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Column Title Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => handleColumnChange(idx, 'title', e.target.value)}
                      placeholder="Kolon Adı (Örn: Analiz, Kodlama, QA Test, Canlıya Alındı)"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      required
                    />
                  </div>

                  {/* Column Color Picker */}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs shrink-0">
                    <input
                      type="color"
                      value={col.colorHex}
                      onChange={(e) => handleColumnChange(idx, 'colorHex', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                      title="Kolon Rengi"
                    />
                    <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase">
                      {col.colorHex}
                    </span>
                  </div>

                  {/* Delete Column Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveColumn(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                    title="Kolonu Sil"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 3: Transition Rules (Workflow Guards) ── */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>İş Akışı Geçiş Kuralları (Workflow Guards)</span>
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                    {rules.length} Kural
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Yukarıda tanımladığınız kolonlar arasında kart taşınırken zorunlu tutulacak doğrulama şartlarını belirleyin.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRule}
                className="btn-primary text-xs py-1.5 px-3 gap-1.5 font-semibold"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>+ Kural Ekle</span>
              </button>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">
                  Henüz bir geçiş kuralı tanımlanmadı. Kartların test edilmeden veya dosya yüklenmeden hedef aşamaya geçmesini engellemek için <strong className="text-slate-700 font-semibold">+ Kural Ekle</strong> butonunu kullanabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Kural #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Kuralı Sil"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Source Column Dropdown (connected to dynamic columns above) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kaynak Kolon
                        </label>
                        <select
                          value={rule.sourceColumnTitle}
                          onChange={(e) => handleRuleChange(idx, 'sourceColumnTitle', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Tüm Kolonlar (Herhangi biri)</option>
                          {columns.map((col, colIdx) => (
                            <option key={col.key} value={col.title}>
                              {colIdx + 1}. {col.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Target Column Dropdown (connected to dynamic columns above) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Hedef Kolon <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={rule.targetColumnTitle}
                          onChange={(e) => handleRuleChange(idx, 'targetColumnTitle', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          <option value="" disabled>Hedef Kolon Seçin</option>
                          {columns.map((col, colIdx) => (
                            <option key={col.key} value={col.title}>
                              {colIdx + 1}. {col.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Rule Type */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kural Türü
                        </label>
                        <select
                          value={rule.ruleType}
                          onChange={(e) => handleRuleChange(idx, 'ruleType', e.target.value as TransitionRuleType)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="CHECKLIST_REQUIRED">Kontrol Listesi Zorunlu (Checklist Tamamlanmalı)</option>
                          <option value="ATTACHMENT_REQUIRED">Dosya / Görsel Eki Zorunlu (Ek Bulunmalı)</option>
                        </select>
                      </div>

                      {/* Description / Requirement */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kural Açıklaması / Zorunlu Şart
                        </label>
                        <input
                          type="text"
                          value={rule.description}
                          onChange={(e) => handleRuleChange(idx, 'description', e.target.value)}
                          placeholder="Örn: Testler tamamlandı mı?, Ekran görüntüsü yüklenmeli"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2 px-4"
              disabled={isSubmitting}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs py-2 px-5 font-semibold gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Kaydediliyor…</span>
                </>
              ) : (
                <span>{isEditing ? 'Değişiklikleri Kaydet' : 'Görev Tipini ve İş Akışını Oluştur'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
