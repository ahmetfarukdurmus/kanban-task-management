import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { taskTypeService } from '@/services/taskTypeService';
import { organizationService } from '@/services/organizationService';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CreateTaskTypeColumnRequest,
  CreateTaskTypeFieldRequest,
  CreateTaskTypeRequest,
  CreateTransitionRuleRequest,
  CustomFieldType,
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

interface FieldFormItem {
  id?: number;
  key: string;
  fieldName: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string;
  placeholder: string;
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
  const [taskPrefix, setTaskPrefix]         = useState('');
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  
  // Dynamic Workflow Columns
  const [columns, setColumns]               = useState<ColumnFormItem[]>([]);
  // Dynamic Transition Rules
  const [rules, setRules]                   = useState<RuleFormState[]>([]);
  // Dynamic Custom Input Fields
  const [fields, setFields]                 = useState<FieldFormItem[]>([]);

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
      setTaskPrefix(taskTypeToEdit.taskPrefix || '');
      setOrganizationId(taskTypeToEdit.organizationId || null);

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

      // Populate dynamic custom fields
      if (taskTypeToEdit.fields && taskTypeToEdit.fields.length > 0) {
        setFields(
          taskTypeToEdit.fields.map((f) => ({
            id: f.id,
            key: `field-${f.id}`,
            fieldName: f.fieldName,
            fieldType: f.fieldType || 'TEXT',
            required: !!f.required,
            options: f.options || '',
            placeholder: f.placeholder || '',
          }))
        );
      } else {
        setFields([]);
      }
    } else {
      setName('');
      setColorHex('#3B82F6');
      setOrganizationId(user?.organizationId || null);
      setColumns(
        DEFAULT_WORKFLOW_COLUMNS.map((c, i) => ({
          key: `col-default-${i}`,
          title: c.title,
          colorHex: c.colorHex,
        }))
      );
      setRules([]);
      setFields([]);
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

  /* ── Custom Field Handlers ── */
  const handleAddField = () => {
    const newField: FieldFormItem = {
      key: `field-new-${Date.now()}`,
      fieldName: '',
      fieldType: 'TEXT',
      required: false,
      options: '',
      placeholder: '',
    };
    setFields((prev) => [...prev, newField]);
  };

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = <K extends keyof FieldFormItem>(
    index: number,
    fieldKey: K,
    value: FieldFormItem[K]
  ) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [fieldKey]: value };
      return next;
    });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
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

    // Validate fields
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].fieldName.trim()) {
        toast.error(`${i + 1}. özel alan için bir alan adı girmelisiniz.`);
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

      const formattedFields: CreateTaskTypeFieldRequest[] = fields.map((f, idx) => ({
        id: f.id,
        fieldName: f.fieldName.trim(),
        fieldType: f.fieldType,
        required: f.required,
        options: f.options?.trim() || undefined,
        placeholder: f.placeholder?.trim() || undefined,
        position: idx,
      }));

      if (isEditing && taskTypeToEdit) {
        const updatePayload: UpdateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          taskPrefix: taskPrefix.trim() || undefined,
          requireTestDate: false,
          requireEnvironment: false,
          columns: formattedColumns,
          rules: formattedRules,
          fields: formattedFields,
        };
        await taskTypeService.update(taskTypeToEdit.id, updatePayload);
        toast.success(`"${name}" görev tipi ve iş akışı başarıyla güncellendi.`);
      } else {
        const createPayload: CreateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          taskPrefix: taskPrefix.trim() || undefined,
          requireTestDate: false,
          requireEnvironment: false,
          organizationId: organizationId || undefined,
          columns: formattedColumns,
          rules: formattedRules,
          fields: formattedFields,
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
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? `"${taskTypeToEdit.name}" Düzenle` : 'Yeni Görev Tipi & İş Akışı Tanımla'}
              </h3>
              <p className="text-xs text-slate-500">
                Görev şablonu, aşamalar, geçiş kuralları ve özel alanları yönetin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* ── Section 1: Name, Color & Organization ── */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Görev Tipi Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: Firewall & Ağ, Kritik Ödeme Entegrasyonu..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ön Ek (Prefix)
                </label>
                <input
                  type="text"
                  value={taskPrefix}
                  onChange={(e) => setTaskPrefix(e.target.value.toUpperCase())}
                  placeholder="Örn: FW, PAY"
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Boşsa addan türetilir</span>
              </div>
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

          {/* ── Section 4: Dynamic Custom Input Fields ── */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Dinamik Form Alanları (Custom Input Fields)</span>
                  <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-purple-200">
                    {fields.length} Alan
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bu görev tipinde kart oluşturulurken girilmesi gereken özel alanları (Örn: Kaynak IP, Hedef URL, Sunucu vb.) ve zorunluluk durumlarını belirleyin.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddField}
                className="btn-secondary text-xs py-1.5 px-3 gap-1.5 font-semibold text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>+ Yeni Alan Ekle</span>
              </button>
            </div>

            {/* Fields List */}
            {fields.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">
                  Bu görev tipine özel form alanı tanımlanmadı. Görev oluştururken kaynak, hedef URL, sunucu/makine bilgisi gibi ek alanlar istemek için <strong className="text-purple-700 font-semibold">+ Yeni Alan Ekle</strong> butonunu kullanabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((fieldItem, idx) => (
                  <div
                    key={fieldItem.key}
                    className="p-3.5 bg-purple-50/20 border border-purple-200/80 rounded-xl space-y-3 transition-all hover:border-purple-300 shadow-2xs"
                  >
                    {/* Field Header: Index & Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {fieldItem.fieldName.trim() || `Özel Alan #${idx + 1}`}
                        </span>
                        {fieldItem.required && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            * Zorunlu
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'up')}
                          disabled={idx === 0}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-1"
                          title="Yukarı Taşı"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'down')}
                          disabled={idx === fields.length - 1}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-1"
                          title="Aşağı Taşı"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                          title="Alanı Sil"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inputs Row 1: Name, Type, Required */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                      {/* Field Name */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Alan Adı / Etiket <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fieldItem.fieldName}
                          onChange={(e) => handleFieldChange(idx, 'fieldName', e.target.value)}
                          placeholder="Örn: Kaynak IP / Host, Hedef URL, Sunucu Bilgisi..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-400 shadow-2xs"
                          required
                        />
                      </div>

                      {/* Field Type */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Alan Türü
                        </label>
                        <select
                          value={fieldItem.fieldType}
                          onChange={(e) => handleFieldChange(idx, 'fieldType', e.target.value as CustomFieldType)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                        >
                          <option value="TEXT">Metin (Yazı)</option>
                          <option value="NUMBER">Sayı</option>
                          <option value="DATE">Tarih</option>
                          <option value="SELECT">Seçim Listesi (Dropdown)</option>
                        </select>
                      </div>

                      {/* Required Checkbox */}
                      <div className="sm:col-span-3 flex items-center pt-6">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={fieldItem.required}
                            onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Zorunlu Alan</span>
                        </label>
                      </div>
                    </div>

                    {/* Inputs Row 2: Placeholder & Options if SELECT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Placeholder hint */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          İpucu / Placeholder Metni
                        </label>
                        <input
                          type="text"
                          value={fieldItem.placeholder}
                          onChange={(e) => handleFieldChange(idx, 'placeholder', e.target.value)}
                          placeholder="Örn: 192.168.1.1 veya https://api.banka.com"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-400"
                        />
                      </div>

                      {/* Options (if SELECT) */}
                      {fieldItem.fieldType === 'SELECT' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Seçenekler <span className="text-slate-400 font-normal">(Virgülle ayırın)</span>
                          </label>
                          <input
                            type="text"
                            value={fieldItem.options}
                            onChange={(e) => handleFieldChange(idx, 'options', e.target.value)}
                            placeholder="Örn: Giriş (Inbound), Çıkış (Outbound), Çift Yönlü"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-400"
                            required
                          />
                        </div>
                      )}
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
