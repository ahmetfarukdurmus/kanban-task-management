import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { ColumnResponse, Priority, TaskRequest, TaskResponse } from '@/types';
import { taskApi } from '@/api/taskApi';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  boardId:     number;
  columnId:    number;              // default/pre-selected column
  columns:     ColumnResponse[];    // all available columns for selector
  onTaskAdded: (task: TaskResponse) => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

export default function AddTaskModal({ isOpen, onClose, boardId, columnId, columns, onTaskAdded }: Props) {
  const [selectedColumnId, setSelectedColumnId] = useState(columnId);
  const [form, setForm] = useState<TaskRequest>({
    title:       '',
    description: '',
    priority:    'MEDIUM',
    dueDate:     '',
    assignee:    '',
  });
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignee: '' });
      setSelectedColumnId(columnId);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, columnId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    try {
      const payload: TaskRequest = {
        title:       form.title.trim(),
        description: form.description?.trim() || undefined,
        priority:    form.priority,
        dueDate:     form.dueDate || undefined,
        assignee:    form.assignee?.trim() || undefined,
      };
      const task = await taskApi.create(boardId, selectedColumnId, payload);
      onTaskAdded(task);
      toast.success('Task created!');
      onClose();
    } catch {
      toast.error('Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Yeni Görev Oluştur</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Column selector (shown when more than one column exists) */}
          {columns.length > 1 && (
            <div>
              <label htmlFor="task-column" className="field-label">Kolon</label>
              <select
                id="task-column"
                value={selectedColumnId}
                onChange={(e) => setSelectedColumnId(Number(e.target.value))}
                className="field"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="task-title" className="field-label">
              Başlık <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              ref={titleRef}
              required
              maxLength={200}
              placeholder="Ne yapılacak?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="field"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-desc" className="field-label">Açıklama</label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Daha fazla detay ekle…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none"
            />
          </div>

          {/* Priority + Due Date (row) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="field-label">Öncelik</label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="field"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due" className="field-label">Bitiş Tarihi</label>
              <input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="field"
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label htmlFor="task-assignee" className="field-label">Sorumlu</label>
            <input
              id="task-assignee"
              maxLength={100}
              placeholder="Birine ata…"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="field"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || !form.title.trim()} className="btn-primary flex-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Oluşturuluyor…
                </span>
              ) : 'Oluştur'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
