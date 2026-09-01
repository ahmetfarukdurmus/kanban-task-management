import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import CreateBoardModal from '@/components/CreateBoardModal';
import { boardApi } from '@/api/boardApi';
import type { BoardResponse } from '@/types';

export default function BoardsPage() {
  const queryClient               = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting,  setDeleting]  = useState<number | null>(null);

  const { data: boards = [], isLoading, isError } = useQuery({
    queryKey: ['boards'],
    queryFn:  boardApi.getAll,
  });

  const handleDelete = async (e: React.MouseEvent, board: BoardResponse) => {
    e.preventDefault();
    if (!confirm(`Delete "${board.name}" and all its data?`)) return;
    setDeleting(board.id);
    try {
      await boardApi.remove(board.id);
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Board deleted.');
    } catch {
      toast.error('Failed to delete board.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-screen-xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Panolarım</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {boards.length} {boards.length === 1 ? 'pano' : 'pano'}
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn-primary gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                 className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Yeni Pano
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="text-center py-20 text-slate-400">
            <p>Panolar yüklenemedi. Lütfen sayfayı yenileyin.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && boards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 border border-slate-300
                            flex items-center justify-center mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                   className="w-8 h-8 text-slate-400">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
                <rect x="14" y="18" width="7" height="3"  rx="1.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-600 mb-1">Henüz pano yok</h2>
            <p className="text-sm text-slate-400 mb-6">İlk panonuzu oluşturarak başlayın</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              Pano Oluştur
            </button>
          </div>
        )}

        {/* Board grid */}
        {!isLoading && boards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.id}`}
                className="group relative flex flex-col bg-white border border-slate-200
                           rounded-2xl p-5 hover:border-blue-300 hover:shadow-md
                           transition-all duration-200 cursor-pointer"
              >
                {/* Board icon + delete */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200
                                  flex items-center justify-center
                                  group-hover:bg-blue-100 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                         className="w-4 h-4 text-blue-600">
                      <rect x="3" y="3" width="7" height="18" rx="1.5" />
                      <rect x="14" y="3" width="7" height="11" rx="1.5" />
                    </svg>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, board)}
                    disabled={deleting === board.id}
                    className="opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-slate-300
                               hover:text-red-500 transition-all duration-150"
                    aria-label={`Delete ${board.name}`}
                  >
                    {deleting === board.id
                      ? <span className="w-3.5 h-3.5 border border-red-300 border-t-red-500 rounded-full animate-spin block" />
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                    }
                  </button>
                </div>

                {/* Board name */}
                <h2 className="font-semibold text-slate-800 group-hover:text-blue-700 truncate transition-colors mb-1">
                  {board.name}
                </h2>

                {/* Description */}
                {board.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">{board.description}</p>
                )}

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {format(parseISO(board.createdAt), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                         className="w-3 h-3">
                      <rect x="3" y="3" width="7" height="18" rx="1.5" />
                      <rect x="14" y="3" width="7" height="11" rx="1.5" />
                    </svg>
                    {board.columns.length} kolon
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateBoardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onBoardCreated={() => queryClient.invalidateQueries({ queryKey: ['boards'] })}
      />
    </div>
  );
}
