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
    <div className="min-h-screen bg-dark-950 bg-mesh-purple">
      <Navbar />

      <main className="mx-auto max-w-screen-xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Boards</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {boards.length} {boards.length === 1 ? 'board' : 'boards'}
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn-primary gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                 className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Board
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="text-center py-20 text-white/40">
            <p className="text-4xl mb-3">⚠</p>
            <p>Failed to load boards. Please refresh.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && boards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-500/20
                            border border-white/[0.06] flex items-center justify-center mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                   className="w-8 h-8 text-white/30">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
                <rect x="14" y="18" width="7" height="3"  rx="1.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/60 mb-1">No boards yet</h2>
            <p className="text-sm text-white/30 mb-6">Create your first board to get started</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              Create a board
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
                className="group relative flex flex-col bg-dark-800 border border-white/[0.06]
                           rounded-2xl p-5 hover:border-violet-500/30 hover:shadow-glow-sm
                           transition-all duration-250 cursor-pointer"
              >
                {/* Board icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/30
                                  border border-white/[0.08] flex items-center justify-center
                                  group-hover:from-violet-500/50 group-hover:to-cyan-400/40 transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                         className="w-4 h-4 text-violet-300">
                      <rect x="3" y="3" width="7" height="18" rx="1.5" />
                      <rect x="14" y="3" width="7" height="11" rx="1.5" />
                    </svg>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, board)}
                    disabled={deleting === board.id}
                    className="opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-white/30
                               hover:text-red-400 transition-all duration-150"
                    aria-label={`Delete ${board.name}`}
                  >
                    {deleting === board.id
                      ? <span className="w-3.5 h-3.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin block" />
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                    }
                  </button>
                </div>

                {/* Board name */}
                <h2 className="font-semibold text-white/90 group-hover:text-white truncate transition-colors mb-1">
                  {board.name}
                </h2>

                {/* Description */}
                {board.description && (
                  <p className="text-xs text-white/35 line-clamp-2 mb-3">{board.description}</p>
                )}

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-xs text-white/25">
                    {format(parseISO(board.createdAt), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-white/20 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                         className="w-3 h-3">
                      <rect x="3" y="3" width="7" height="18" rx="1.5" />
                      <rect x="14" y="3" width="7" height="11" rx="1.5" />
                    </svg>
                    {board.columns.length} columns
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
