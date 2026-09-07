import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type {
  ColumnResponse,
  CreateChecklistItemRequest,
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
import { PlusIcon, UserIcon } from './icons';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  boardId:     number;
  columnId:    number;              // default/pre-selected column
  columns:     ColumnResponse[];    // all available columns for selector
  onTaskAdded: (task: TaskResponse) => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'LOW',    label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH',   label: 'Yüksek' },
];

export default function AddTaskModal({ isOpen, onClose, boardId, columnId, columns, onTaskAdded }: Props) {
  const [selectedColumnId, setSelectedColumnId]     = useState(columnId);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<number | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [users, setUsers]                           = useState<UserSummary[]>([]);
  const [taskTypes, setTaskTypes]                   = useState<TaskTypeDto[]>([]);
  const [loadingTypes, setLoadingTypes]             = useState(false);

  // Checklist items in modal
  const [checklistItems, setChecklistItems] = useState<CreateChecklistItemRequest[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

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
        .then((data) => setTaskTypes(data))
        .catch(() => { /* fallback */ })
        .finally(() => setLoadingTypes(false));
    }
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
      setSelectedColumnId(columnId || columns[0]?.id || 0);
      setSelectedTaskTypeId(null);
      setSelectedAssigneeIds([]);
      setChecklistItems([]);
      setNewChecklistTitle('');
      setSelectedFile(null);
      setAssigneeDropdownOpen(false);
      setAssigneeSearch('');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, columnId, columns]);

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

  const handleToggleAssignee = (userId: number) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistTitle.trim();
    if (!trimmed) return;
    setChecklistItems((prev) => [...prev, { title: trimmed }]);
    setNewChecklistTitle('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
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

    setLoading(true);
    try {
      const payload: TaskRequest = {
        title:          form.title.trim(),
        description:    form.description?.trim() || undefined,
        priority:       form.priority,
        dueDate:        form.dueDate || undefined,
        taskTypeId:     selectedTaskTypeId || undefined,
        assigneeIds:    selectedAssigneeIds.length > 0 ? selectedAssigneeIds : undefined,
        checklistItems: checklistItems.length > 0 ? checklistItems : undefined,
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
      <div className="modal-box p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
              <PlusIcon className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Yeni Görev Oluştur</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 1. Target Column Selector */}
          <div>
            <label htmlFor="task-column" className="field-label">
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
            <label htmlFor="task-type" className="field-label">
              Görev Tipi (Task Type) <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
            </label>
            <select
              id="task-type"
              value={selectedTaskTypeId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTaskTypeId(val ? Number(val) : null);
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
              <div className="mt-2 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                  Bu görev tipine tanımlı geçiş kuralları:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1">
                  {selectedType.rules.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium text-blue-950">{r.targetColumnTitle}: </span>
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
            <label htmlFor="task-title" className="field-label">
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
            <label htmlFor="task-desc" className="field-label">
              Açıklama
            </label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Göreve dair hedefler veya notlar..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none leading-relaxed"
            />
          </div>

          {/* 5. Priority + Due Date (row) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="field-label">
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
              <label htmlFor="task-due" className="field-label">
                Bitiş Tarihi
              </label>
              <input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="field"
              />
            </div>
          </div>

          {/* 6. Multi-Select Sorumlu / Atanan Kişiler */}
          <div ref={assigneeBoxRef} className="relative">
            <label className="field-label">
              Sorumlu / Atanan Kişiler <span className="text-slate-400 font-normal text-xs">(Çoklu Seçim)</span>
            </label>

            {/* Selected Assignees Tags Area */}
            <div
              onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
              className="field min-h-[42px] cursor-pointer flex flex-wrap items-center gap-1.5 p-1.5"
            >
              {selectedAssigneeIds.length === 0 ? (
                <span className="text-slate-400 text-sm font-normal px-1 flex items-center gap-1.5">
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

          {/* 7. Checklist Items Section */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="field-label">
              Kontrol Listesi (Checklist) <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
            </label>

            {/* Checklist Items List */}
            {checklistItems.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {checklistItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>{item.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(index)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                      title="Maddeyi Sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Checklist Item Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Yeni kontrol maddesi ekle…"
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="field text-xs py-1.5 flex-1"
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="btn-secondary px-3 py-1.5 text-xs font-semibold"
              >
                + Ekle
              </button>
            </div>
          </div>

          {/* 8. Attachment Upload (Optional) */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="field-label">
              Dosya / Medya Eki <span className="text-slate-400 font-normal text-xs">(Opsiyonel)</span>
            </label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="btn-primary flex-1 py-2.5 font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Oluşturuluyor…
                </span>
              ) : 'Görevi Oluştur'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4 font-medium">
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
