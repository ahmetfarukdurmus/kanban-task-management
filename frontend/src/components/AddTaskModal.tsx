import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type {
  ColumnResponse,
  CreateChecklistItemRequest,
  CustomFieldDto,
  CustomFieldType,
  Priority,
  TaskRequest,
  TaskResponse,
  TaskTypeDto,
  UserSummary,
} from '@/types';
import { taskApi } from '@/api/taskApi';
import { userService } from '@/services/userService';
import { taskTypeService } from '@/services/taskTypeService';
import { attachmentService } from '@/services/attachmentService';
import { useAuth } from '@/contexts/AuthContext';
import { isColumnMatching } from '@/utils/workflowUtils';
import CascadingSelectField from './CascadingSelectField';
import { PlusIcon, UserIcon } from './icons';

interface Props {
  isOpen:             boolean;
  onClose:            () => void;
  boardId:            number;
  columnId:           number;              // default/pre-selected column
  columns:            ColumnResponse[];    // all available columns for selector
  defaultTaskTypeId?: number | null;       // default workflow / task type from Board
  onTaskAdded:        (task: TaskResponse) => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'LOW',    label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH',   label: 'Yüksek' },
];

export default function AddTaskModal({ isOpen, onClose, boardId, columnId, columns, defaultTaskTypeId, onTaskAdded }: Props) {
  const { user } = useAuth();
  const [selectedColumnId, setSelectedColumnId]     = useState(columnId);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<number | null>(defaultTaskTypeId || null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [reporterId, setReporterId]                 = useState<number | null>(null);
  const [estimatedHours, setEstimatedHours]         = useState<number | ''>('');
  const [customFieldValues, setCustomFieldValues]   = useState<Record<string, string>>({});
  const [users, setUsers]                           = useState<UserSummary[]>([]);
  const [taskTypes, setTaskTypes]                   = useState<TaskTypeDto[]>([]);
  const [loadingTypes, setLoadingTypes]             = useState(false);

  // Checklist items in modal
  const [checklistItems, setChecklistItems] = useState<CreateChecklistItemRequest[]>([]);

  // Tags in modal
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Selected file attachment (optional)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Assignee dropdown toggle
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const [form, setForm] = useState<TaskRequest>({
    title:       '',
    description: '',
    priority:    'MEDIUM',
    dueDate:     '',
  });
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const assigneeBoxRef = useRef<HTMLDivElement>(null);

  // Fetch users & task types when modal opens
  useEffect(() => {
    if (isOpen) {
      userService
        .getAll()
        .then((data) => setUsers(data))
        .catch(() => { /* fallback */ });

      setLoadingTypes(true);
      taskTypeService
        .getAll()
        .then((data) => {
          setTaskTypes(data);
          if (defaultTaskTypeId) {
            const selected = data.find((t) => t.id === defaultTaskTypeId);
            if (selected?.rules) {
              const checklistRules = selected.rules.filter((r) => r.ruleType === 'CHECKLIST_REQUIRED');
              if (checklistRules.length > 0) {
                setChecklistItems((prev) => {
                  const newItems = [...prev];
                  checklistRules.forEach((rule) => {
                    const ruleTitle = rule.description?.trim() || `${rule.targetColumnTitle} Kontrolü`;
                    if (!newItems.some((item) => item.title.trim().toLowerCase() === ruleTitle.toLowerCase())) {
                      const targetCol = columns.find(
                        (c) =>
                          (rule.targetColumnId && c.id === rule.targetColumnId) ||
                          (rule.targetColumnTitle && isColumnMatching(rule.targetColumnTitle, c.title))
                      );
                      newItems.push({
                        title: ruleTitle,
                        requiredForColumnId: targetCol?.id,
                      });
                    }
                  });
                  return newItems;
                });
              }
            }
          }
        })
        .catch(() => { /* fallback */ })
        .finally(() => setLoadingTypes(false));
    }
  }, [isOpen, defaultTaskTypeId, columns]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
      setSelectedColumnId(columnId || columns[0]?.id || 0);
      setSelectedTaskTypeId(defaultTaskTypeId || null);
      setSelectedAssigneeIds([]);
      setReporterId(user?.id || null);
      setEstimatedHours('');
      setCustomFieldValues({});
      setChecklistItems([]);
      setTags([]);
      setTagInput('');
      setSelectedFile(null);
      setAssigneeDropdownOpen(false);
      setAssigneeSearch('');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, columnId, columns, defaultTaskTypeId, user]);

  // Close assignee dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assigneeBoxRef.current && !assigneeBoxRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const selectedType = taskTypes.find((t) => t.id === selectedTaskTypeId);

  const handleTaskTypeChange = (typeId: number | null) => {
    setSelectedTaskTypeId(typeId);
    if (!typeId) {
      setChecklistItems([]);
      return;
    }

    const selected = taskTypes.find((t) => t.id === typeId);
    if (!selected || !selected.rules) {
      setChecklistItems([]);
      return;
    }

    const checklistRules = selected.rules.filter((r) => r.ruleType === 'CHECKLIST_REQUIRED');
    const newItems: CreateChecklistItemRequest[] = [];
    checklistRules.forEach((rule) => {
      const ruleTitle = rule.description?.trim() || `${rule.targetColumnTitle} Kontrolü`;
      const targetCol = columns.find(
        (c) =>
          (rule.targetColumnId && c.id === rule.targetColumnId) ||
          (rule.targetColumnTitle && isColumnMatching(rule.targetColumnTitle, c.title))
      );
      newItems.push({
        title: ruleTitle,
        requiredForColumnId: targetCol?.id,
      });
    });
    setChecklistItems(newItems);
  };

  const handleToggleAssignee = (userId: number) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Başlık zorunludur.');
      return;
    }

    const targetColId = selectedColumnId || columns[0]?.id;
    if (!targetColId) {
      toast.error('Lütfen bir kolon seçin.');
      return;
    }

    if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
      toast.error('Dosya boyutu 25MB sınırını aşamaz.');
      return;
    }

    // Validate required custom fields from selected TaskType
    if (selectedType?.fields && selectedType.fields.length > 0) {
      for (const field of selectedType.fields) {
        if (field.required) {
          const val = customFieldValues[field.fieldName];
          if (val === undefined || val === null || val.trim() === '') {
            toast.error(`"${field.fieldName}" alanı bu görev tipi için zorunludur.`);
            return;
          }
        }
      }
    }

    const customFieldsPayload: CustomFieldDto[] = selectedType?.fields && selectedType.fields.length > 0
      ? selectedType.fields
          .filter((f) => customFieldValues[f.fieldName] !== undefined && customFieldValues[f.fieldName] !== null && customFieldValues[f.fieldName].trim() !== '')
          .map((f) => ({
            fieldName: f.fieldName,
            fieldType: (f.fieldType as CustomFieldType) || 'TEXT',
            fieldValue: customFieldValues[f.fieldName].trim(),
          }))
      : [];

    setLoading(true);
    try {
      const payload: TaskRequest = {
        title:             form.title.trim(),
        description:       form.description?.trim() || undefined,
        priority:          form.priority,
        dueDate:           form.dueDate || undefined,
        estimatedHours:    typeof estimatedHours === 'number' && !isNaN(estimatedHours) ? estimatedHours : undefined,
        reporterId:        reporterId || undefined,
        taskTypeId:        selectedTaskTypeId || undefined,
        assigneeIds:       selectedAssigneeIds.length > 0 ? selectedAssigneeIds : undefined,
        customFields:      customFieldsPayload.length > 0 ? customFieldsPayload : undefined,
        checklistItems:    checklistItems.length > 0 ? checklistItems : undefined,
        tags:              tags.length > 0 ? tags : undefined,
      };

      const task = await taskApi.create(boardId, targetColId, payload);

      // If a file was attached, upload it
      if (selectedFile) {
        try {
          await attachmentService.upload(task.id, selectedFile);
        } catch {
          toast.error('Görev oluşturuldu ancak dosya yüklenemedi.');
        }
      }

      onTaskAdded(task);
      toast.success('Yeni görev başarıyla oluşturuldu!');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Görev oluşturulamadı.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = assigneeSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      (u.organizationName && u.organizationName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-4xl xl:max-w-5xl w-full p-0 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
              <PlusIcon className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Yeni Görev Oluştur</h2>
              <p className="text-xs text-slate-500">Board için yeni bir görev tanımlayın ve detaylarını belirleyin</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto pr-3 flex-1 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SOL SÜTUN: Ana Bilgiler (Kolon, Görev Tipi, Başlık, Açıklama) */}
              <div className="space-y-4">
                {/* 1. Target Column Selector */}
                <div>
                  <label htmlFor="task-column" className="field-label font-semibold text-slate-700">
                    Hedef Kolon <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="task-column"
                    value={selectedColumnId}
                    onChange={(e) => setSelectedColumnId(Number(e.target.value))}
                    className="field font-semibold text-slate-800"
                    required
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Task Type Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="task-type" className="field-label font-semibold text-slate-700 mb-0">
                      Görev Tipi (Task Type)
                    </label>
                    <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
                  </div>
                  <select
                    id="task-type"
                    value={selectedTaskTypeId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleTaskTypeChange(val ? Number(val) : null);
                    }}
                    disabled={loadingTypes}
                    className="field font-medium text-slate-800"
                  >
                    <option value="">-- Görev Tipi Seçiniz (Varsayılan) --</option>
                    {taskTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.rules && t.rules.length > 0 ? `(${t.rules.length} geçiş kuralı)` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Task Type Rules Info Box */}
                  {selectedType && selectedType.rules && selectedType.rules.length > 0 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-1.5">
                      <p className="font-semibold flex items-center gap-1.5 text-blue-950">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                        Bu görev tipine tanımlı geçiş kuralları:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                        {selectedType.rules.map((r) => (
                          <li key={r.id}>
                            <span className="font-semibold text-blue-950">{r.targetColumnTitle}: </span>
                            {r.ruleType === 'CHECKLIST_REQUIRED' ? 'Kontrol listesi (Checklist) tamamlanmalıdır' : 'Dosya/medya eki yüklenmelidir'}
                            {r.description ? ` (${r.description})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 3. Title */}
                <div>
                  <label htmlFor="task-title" className="field-label font-semibold text-slate-700">
                    Başlık <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="task-title"
                    ref={titleRef}
                    required
                    maxLength={200}
                    placeholder="Örn: Kullanıcı kimlik doğrulama modülünü tamamla"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="field font-medium"
                  />
                </div>

                {/* 4. Description */}
                <div>
                  <label htmlFor="task-desc" className="field-label font-semibold text-slate-700">
                    Açıklama <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
                  </label>
                  <textarea
                    id="task-desc"
                    rows={5}
                    placeholder="Göreve dair hedefler veya detaylı notlar..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="field resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* SAĞ SÜTUN: Süreç ve Meta Veriler (Öncelik, Tarih, Raporlayan, Efor, Atananlar, Özel Alanlar, Checklist, Ek) */}
              <div className="space-y-4">
                {/* 5. Priority + Due Date (row) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="task-priority" className="field-label font-semibold text-slate-700">
                      Öncelik
                    </label>
                    <select
                      id="task-priority"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                      className="field font-medium"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="task-due" className="field-label font-semibold text-slate-700">
                      Bitiş Tarihi
                    </label>
                    <input
                      id="task-due"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className="field font-medium"
                    />
                  </div>
                </div>

                {/* Extended Field: Reporter */}
                <div>
                  <label htmlFor="task-reporter" className="field-label font-semibold text-slate-700 flex items-center justify-between">
                    <span>Raporlayan</span>
                    <span className="text-[10px] text-slate-400 font-normal">Varsayılan: Siz</span>
                  </label>
                  <select
                    id="task-reporter"
                    value={reporterId ?? ''}
                    onChange={(e) => setReporterId(e.target.value ? Number(e.target.value) : null)}
                    className="field text-xs font-medium"
                  >
                    <option value="">-- Raporlayan Seçiniz --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.id === user?.id ? '(Siz)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Multi-Select Sorumlu / Atanan Kişiler */}
                <div ref={assigneeBoxRef} className="relative">
                  <label className="field-label font-semibold text-slate-700">
                    Sorumlu / Atanan Kişiler <span className="text-slate-400 font-normal text-xs">(Çoklu Seçim)</span>
                  </label>

                  {/* Selected Assignees Tags Area */}
                  <div
                    onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                    className="field min-h-[42px] cursor-pointer flex flex-wrap items-center gap-1.5 p-1.5 bg-white"
                  >
                    {selectedAssigneeIds.length === 0 ? (
                      <span className="text-slate-400 text-xs font-normal px-1 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" />
                        Kişi seçiniz…
                      </span>
                    ) : (
                      selectedAssigneeIds.map((userId) => {
                        const u = users.find((item) => item.id === userId);
                        if (!u) return null;
                        return (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
                          >
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                            {u.username}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAssignee(u.id);
                              }}
                              className="hover:text-rose-600 text-blue-400 ml-0.5 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {assigneeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto p-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Kullanıcı ara…"
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        className="field text-xs py-1.5 mb-2 w-full"
                      />
                      {filteredUsers.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">Kullanıcı bulunamadı.</p>
                      ) : (
                        <div className="space-y-1">
                          {filteredUsers.map((u) => {
                            const isSelected = selectedAssigneeIds.includes(u.id);
                            const orgLabel = u.organizationNames && u.organizationNames.length > 0
                              ? u.organizationNames.join(', ')
                              : u.organizationName || '';

                            return (
                              <div
                                key={u.id}
                                onClick={() => handleToggleAssignee(u.id)}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                  isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{u.username}</span>
                                  {orgLabel && (
                                    <span className="text-[10px] text-slate-400 font-normal">({orgLabel})</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5.3 Dynamic Task Type Custom Input Fields */}
                {selectedType?.fields && selectedType.fields.length > 0 && (
                  <div className="p-3.5 bg-purple-50/40 border border-purple-200/90 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="field-label mb-0 text-purple-900 font-bold flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                        <span>{selectedType.name} — Özel Form Alanları</span>
                      </label>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full border border-purple-200">
                        {selectedType.fields.length} Alan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedType.fields.map((field) => {
                        const val = customFieldValues[field.fieldName] || '';
                        const options = field.options
                          ? field.options.split(',').map((o) => o.trim()).filter(Boolean)
                          : [];

                        const isCascading = field.fieldType === 'CASCADING_SELECT' || (field.fieldName != null && field.fieldName.toLowerCase().includes('port'));

                        return (
                          <div key={field.id || field.fieldName} className={(isCascading || (field.fieldType === 'TEXT' && (field.placeholder?.length || 0) > 30)) ? 'sm:col-span-2' : ''}>
                            <label className="field-label flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span className="flex items-center gap-1">
                                <span>{field.fieldName}</span>
                                {field.required && <span className="text-rose-500 font-bold">*</span>}
                              </span>
                              {field.required && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  Zorunlu
                                </span>
                              )}
                            </label>

                            {isCascading ? (
                              <CascadingSelectField
                                fieldName={field.fieldName}
                                fieldValue={val}
                                options={field.options}
                                placeholder={field.placeholder}
                                required={field.required}
                                onChange={(newVal) =>
                                  setCustomFieldValues((prev) => ({ ...prev, [field.fieldName]: newVal }))
                                }
                              />
                            ) : field.fieldType === 'SELECT' ? (
                              <select
                                value={val}
                                onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                                className={`field text-xs font-medium ${field.required && !val ? 'border-purple-300 bg-white' : ''}`}
                                required={field.required}
                              >
                                <option value="">-- {field.placeholder || 'Seçiniz'} --</option>
                                {options.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.fieldType === 'DATE' ? (
                              <input
                                type="date"
                                value={val}
                                onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                                className={`field text-xs font-medium ${field.required && !val ? 'border-purple-300 bg-white' : ''}`}
                                required={field.required}
                              />
                            ) : field.fieldType === 'NUMBER' ? (
                              <input
                                type="number"
                                value={val}
                                onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                                placeholder={field.placeholder || '0'}
                                className={`field text-xs font-medium ${field.required && !val ? 'border-purple-300 bg-white' : ''}`}
                                required={field.required}
                              />
                            ) : (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                                placeholder={field.placeholder || ''}
                                className={`field text-xs font-medium ${field.required && !val ? 'border-purple-300 bg-white' : ''}`}
                                required={field.required}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7. Checklist Items Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="field-label mb-0 font-semibold text-slate-700">
                      Kontrol Listesi (Checklist) <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
                    </label>
                    {checklistItems.length > 0 && (
                      <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                        {checklistItems.length} madde
                      </span>
                    )}
                  </div>

                  {/* Checklist Transition Rules Pills (if task type has checklist rules) */}
                  {selectedType && selectedType.rules?.some((r) => r.ruleType === 'CHECKLIST_REQUIRED') && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs">
                      <span className="text-amber-900 font-semibold flex items-center gap-1 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Zorunlu Geçiş Kuralları:
                      </span>
                      {selectedType.rules
                        .filter((r) => r.ruleType === 'CHECKLIST_REQUIRED')
                        .map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-amber-900 border border-amber-200/90 shadow-2xs"
                          >
                            [{r.targetColumnTitle} için Zorunlu]
                            {r.description ? ` (${r.description})` : ''}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Checklist Items List */}
                  {checklistItems.length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {checklistItems.map((item, index) => {
                        let targetColTitle: string | null = null;
                        if (item.requiredForColumnId) {
                          const col = columns.find((c) => c.id === item.requiredForColumnId);
                          if (col) targetColTitle = col.title;
                        }
                        if (!targetColTitle && selectedType?.rules) {
                          const matchedRule = selectedType.rules.find(
                            (r) =>
                              r.ruleType === 'CHECKLIST_REQUIRED' &&
                              (r.description?.trim().toLowerCase() === item.title.trim().toLowerCase() ||
                                item.title.toLowerCase().includes(r.targetColumnTitle.toLowerCase()))
                          );
                          if (matchedRule) targetColTitle = matchedRule.targetColumnTitle;
                        }

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span className="truncate">{item.title}</span>
                              {targetColTitle && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  [{targetColTitle} için Zorunlu]
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center bg-slate-50/50">
                      <p className="text-xs text-slate-400">Bu görev tipi için zorunlu kontrol listesi kuralı bulunmuyor.</p>
                    </div>
                  )}
                </div>

                {/* 8. Tags (Optional) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="field-label mb-0 font-semibold text-slate-700">
                      Etiketler (Tags) <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {tags.length} etiket
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 min-h-[38px]">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                          className="text-blue-400 hover:text-rose-600 ml-0.5 font-bold transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={tags.length === 0 ? "Etiket yazıp Enter'a basın..." : "Etiket ekle..."}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const clean = tagInput.trim().replace(/^#/, '');
                          if (clean && !tags.includes(clean)) {
                            setTags((prev) => [...prev, clean]);
                          }
                          setTagInput('');
                        }
                      }}
                      className="bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none flex-1 min-w-[120px]"
                    />
                  </div>
                </div>

                {/* 9. Attachment Upload (Optional) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="field-label mb-0 font-semibold text-slate-700">
                      Dosya / Medya Eki <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
                    </label>
                    {selectedType?.rules?.some((r) => r.ruleType === 'ATTACHMENT_REQUIRED') && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        [Bu aşama için Görsel/Dosya Zorunludur]
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Sticky Bottom Footer Buttons */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm font-medium">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="btn-primary px-5 py-2 text-sm font-semibold shadow-xs"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Oluşturuluyor…
                </span>
              ) : 'Görevi Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
