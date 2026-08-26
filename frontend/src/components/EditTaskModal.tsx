import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Priority, TaskRequest, TaskResponse } from '@/types';
import { taskApi } from '@/api/taskApi';

interface Props {
  task:        TaskResponse | null;
  boardId:     number;
  onClose:     () => void;
  onUpdated:   (task: TaskResponse) => void;
  onDeleted:   (taskId: number, columnId: number) => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

export default function EditTaskModal({ task, boardId, onClose, onUpdated, onDeleted }: Props) {
  const [form, setForm]       = useState<TaskRequest>({ title: '', priority: 'MEDIUM' });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title:       task.title,
        description: task.description ?? '',
        priority:    task.priority,
        dueDate:     task.dueDate ?? '',
        assignee:    task.assignee ?? '',
      });
    }
  }, [task]);

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: TaskRequest = {
        title:       form.title.trim(),
        description: form.description?.trim() || undefined,
        priority:    form.priority,
        dueDate:     form.dueDate || undefined,
        assignee:    form.assignee?.trim() || undefined,
      };
      const updated = await taskApi.update(boardId, task.columnId, task.id, payload);
      onUpdated(updated);
      toast.success('Task updated!');
      onClose();
    } catch {
      toast.error('Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task permanently?')) return;
    setDeleting(true);
    try {
      await taskApi.remove(boardId, task.columnId, task.id);
      onDeleted(task.id, task.columnId);
      toast.success('Task deleted.');
      onClose();
    } catch {
      toast.error('Failed to delete task.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white">Edit Task</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="edit-title" className="field-label">Title <span className="text-red-400">*</span></label>
            <input id="edit-title" required maxLength={200} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} className="field" />
          </div>

          <div>
            <label htmlFor="edit-desc" className="field-label">Description</label>
            <textarea id="edit-desc" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-priority" className="field-label">Priority</label>
              <select id="edit-priority" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                className="field">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-due" className="field-label">Due Date</label>
              <input id="edit-due" type="date" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="edit-assignee" className="field-label">Assignee</label>
            <input id="edit-assignee" maxLength={100} value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="field" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost px-4">Cancel</button>
          </div>
        </form>

        {/* Delete footer */}
        <div className="px-5 pb-5">
          <button onClick={handleDelete} disabled={deleting}
            className="btn-danger w-full text-sm justify-center">
            {deleting ? 'Deleting…' : '🗑  Delete task'}
          </button>
        </div>
      </div>
    </div>
  );
}
