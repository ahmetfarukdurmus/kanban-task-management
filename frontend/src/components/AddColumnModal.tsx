import { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { columnApi } from '@/api/columnApi';
import type { ColumnResponse } from '@/types';

interface Props {
  isOpen:         boolean;
  boardId:        number;
  onClose:        () => void;
  onColumnAdded:  (column: ColumnResponse) => void;
}

export default function AddColumnModal({ isOpen, boardId, onClose, onColumnAdded }: Props) {
  const [title, setTitle]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const created = await columnApi.create(boardId, { title: trimmed });
      onColumnAdded({ ...created, tasks: [] });
      toast.success('Yeni kolon oluşturuldu!');
      onClose();
    } catch {
      toast.error('Kolon oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-slate-800">Yeni Kolon Ekle</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="new-col-title" className="field-label font-semibold text-slate-600">
              Kolon Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              id="new-col-title"
              ref={inputRef}
              required
              maxLength={100}
              placeholder="Örn: Yapılacaklar, Test, Canlı..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary flex-1 py-2.5 font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ekleniyor…
                </span>
              ) : 'Kolon Ekle'}
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
