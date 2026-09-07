import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { taskTypeService } from '@/services/taskTypeService';
import { boardApi } from '@/api/boardApi';
import { organizationService } from '@/services/organizationService';
import { useAuth } from '@/contexts/AuthContext';
import type {
  BoardResponse,
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

interface RuleFormState {
  sourceColumnId?: number | null;
  targetColumnId: number | '';
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
  const [rules, setRules]                   = useState<RuleFormState[]>([]);

  const [boards, setBoards]                 = useState<BoardResponse[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [organizations, setOrganizations]   = useState<OrganizationDto[]>([]);
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const isEditing = !!taskTypeToEdit;

  // Load boards and organizations
  useEffect(() => {
    if (!isOpen) return;

    boardApi.getAll()
      .then((data) => {
        setBoards(data);
        if (data.length > 0 && !selectedBoardId) {
          setSelectedBoardId(data[0].id);
        }
      })
      .catch(() => { /* ignore */ });

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

      if (taskTypeToEdit.rules && taskTypeToEdit.rules.length > 0) {
        setRules(
          taskTypeToEdit.rules.map((r) => ({
            sourceColumnId: r.sourceColumnId || null,
            targetColumnId: r.targetColumnId,
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
      setRules([]);
    }
  }, [taskTypeToEdit, isOpen, user]);

  if (!isOpen) return null;

  // Active columns from selected board
  const selectedBoard = boards.find((b) => b.id === selectedBoardId) || boards[0];
  const availableColumns = selectedBoard?.columns || [];

  const handleAddRule = () => {
    if (availableColumns.length === 0) {
      toast.error('Kural eklemek için önce kolonları olan bir pano seçmelisiniz.');
      return;
    }
    const defaultTarget = availableColumns.length > 1 ? availableColumns[availableColumns.length - 1].id : availableColumns[0].id;
    setRules((prev) => [
      ...prev,
      {
        sourceColumnId: null,
        targetColumnId: defaultTarget,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Lütfen bir görev tipi adı girin.');
      return;
    }

    // Validate rules
    for (let i = 0; i < rules.length; i++) {
      if (!rules[i].targetColumnId) {
        toast.error(`${i + 1}. kural için geçerli bir hedef kolon seçilmelidir.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formattedRules: CreateTransitionRuleRequest[] = rules.map((r) => ({
        sourceColumnId: r.sourceColumnId ? Number(r.sourceColumnId) : null,
        targetColumnId: Number(r.targetColumnId),
        ruleType: r.ruleType,
        description: r.description.trim() || undefined,
      }));

      if (isEditing && taskTypeToEdit) {
        const updatePayload: UpdateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          rules: formattedRules,
        };
        await taskTypeService.update(taskTypeToEdit.id, updatePayload);
        toast.success(`"${name}" görev tipi başarıyla güncellendi.`);
      } else {
        const createPayload: CreateTaskTypeRequest = {
          name: name.trim(),
          colorHex: colorHex.trim(),
          organizationId: organizationId || undefined,
          rules: formattedRules,
        };
        await taskTypeService.create(createPayload);
        toast.success(`"${name}" görev tipi başarıyla oluşturuldu.`);
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
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs"
              style={{ backgroundColor: colorHex }}
            />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEditing ? 'Görev Tipini Düzenle' : 'Yeni Görev Tipi Tanımla'}
              </h2>
              <p className="text-xs text-slate-500">
                Görev şablonu özelliklerini ve kolon geçiş kurallarını yapılandırın.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Name & Color */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Görev Tipi Adı <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Hata Bildirimi / Bug, Tasarım Görevi, Story..."
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

          {/* Transition Rules Section */}
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
                  Kartlar belirli bir kolona taşınırken zorunlu tutulacak doğrulama kurallarını belirleyin.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRule}
                className="btn-primary text-xs py-1.5 px-3 gap-1.5 font-semibold"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Kural Ekle</span>
              </button>
            </div>

            {/* Board Selector for Column Options */}
            {boards.length > 1 && (
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                <span className="font-semibold text-slate-600 shrink-0">Referans Pano:</span>
                <select
                  value={selectedBoardId || ''}
                  onChange={(e) => setSelectedBoardId(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.organizationName ? `(${b.organizationName})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 text-[11px] ml-auto">
                  Kurallar için bu panodaki kolonlar listelenir.
                </span>
              </div>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">
                  Henüz bir geçiş kuralı tanımlanmadı. Kartların tamamlanmadan veya dosya yüklenmeden taşınmasını engellemek için <strong className="text-slate-700 font-semibold">+ Kural Ekle</strong> butonunu kullanabilirsiniz.
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
                      {/* Source Column */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kaynak Kolon
                        </label>
                        <select
                          value={rule.sourceColumnId || ''}
                          onChange={(e) => handleRuleChange(idx, 'sourceColumnId', e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Tüm Kolonlar (Herhangi biri)</option>
                          {availableColumns.map((col) => (
                            <option key={col.id} value={col.id}>
                              {col.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Target Column */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Hedef Kolon <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={rule.targetColumnId || ''}
                          onChange={(e) => handleRuleChange(idx, 'targetColumnId', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          <option value="" disabled>Hedef Kolon Seçin</option>
                          {availableColumns.map((col) => (
                            <option key={col.id} value={col.id}>
                              {col.title}
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
                <span>{isEditing ? 'Değişiklikleri Kaydet' : 'Görev Tipini Oluştur'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
