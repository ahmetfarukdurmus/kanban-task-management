import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { ColumnResponse, Priority, TaskRequest, TaskResponse, UserSummary } from '@/types';
import { taskApi } from '@/api/taskApi';
import { userService } from '@/services/userService';
import { PlusIcon } from './icons';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  boardId:     number;
  columnId:    number;              // default/pre-selected column
  columns:     ColumnResponse[];    // all available columns for selector
  onTaskAdded: (task: TaskResponse) => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
];

export default function AddTaskModal({ isOpen, onClose, boardId, columnId, columns, onTaskAdded }: Props) {
  const [selectedColumnId, setSelectedColumnId] = useState(columnId);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [form, setForm] = useState<TaskRequest>({
    title:       '',
    description: '',
    priority:    'MEDIUM',
    dueDate:     '',
    assignee:    '',
  });
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      userService
        .getAll()
        .then((data) => setUsers(data))
        .catch(() => { /* fallback */ });
    }
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignee: '' });
      setSelectedColumnId(columnId || columns[0]?.id || 0);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, columnId, columns]);

  if (!isOpen) return null;

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
        title:       form.title.trim(),
        description: form.description?.trim() || undefined,
        priority:    form.priority,
        dueDate:     form.dueDate || undefined,
        assignee:    form.assignee?.trim() || undefined,
      };
      const task = await taskApi.create(boardId, targetColId, payload);
      onTaskAdded(task);
      toast.success('Yeni görev başarıyla oluşturuldu!');
      onClose();
    } catch {
      toast.error('Görev oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box p-6">
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

          {/* Column selector */}
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

          {/* Title */}
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

          {/* Description */}
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

          {/* Priority + Due Date (row) */}
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

          {/* Assignee Dropdown */}
          <div>
            <label htmlFor="task-assignee" className="field-label">
              Sorumlu / Atanan Kişi
            </label>
            <select
              id="task-assignee"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="field font-medium text-slate-700"
            >
              <option value="">Seçiniz / Atanmamış</option>
              {users.map((u) => {
                const orgLabel =
                  u.organizationNames && u.organizationNames.length > 0
                    ? u.organizationNames.join(', ')
                    : u.organizationName || '';
                return (
                  <option key={u.id} value={u.username}>
                    {u.username} {orgLabel ? `(${orgLabel})` : ''}
                  </option>
                );
              })}
            </select>
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
