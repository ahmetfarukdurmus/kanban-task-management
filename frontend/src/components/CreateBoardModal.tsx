import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BoardRequest } from '@/types';
import { boardApi } from '@/api/boardApi';

interface Props {
  isOpen:         boolean;
  onClose:        () => void;
  onBoardCreated: () => void;
}

export default function CreateBoardModal({ isOpen, onClose, onBoardCreated }: Props) {
  const [form, setForm]       = useState<BoardRequest>({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await boardApi.create({ name: form.name.trim(), description: form.description?.trim() });
      onBoardCreated();
      toast.success('Board created!');
      setForm({ name: '', description: '' });
      onClose();
    } catch {
      toast.error('Failed to create board.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white">New Board</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-white/40 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="board-name" className="field-label">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="board-name"
              ref={nameRef}
              autoFocus
              required
              maxLength={100}
              placeholder="e.g. Sprint 42 or Product Roadmap"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="board-desc" className="field-label">Description</label>
            <textarea
              id="board-desc"
              rows={3}
              maxLength={500}
              placeholder="What's this board for?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || !form.name.trim()} className="btn-primary flex-1">
              {loading ? 'Creating…' : 'Create Board'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost px-4">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
