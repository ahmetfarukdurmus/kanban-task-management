import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService } from '@/services/searchService';
import type { BoardSearchDto, GlobalSearchResponse, Priority, TaskSearchDto } from '@/types';
import { SearchIcon } from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const priorityBadgeMap: Record<Priority, { label: string; className: string }> = {
  HIGH:   { label: 'Yüksek', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  MEDIUM: { label: 'Orta',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  LOW:    { label: 'Düşük',  className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export default function GlobalSearchModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResponse>({ tasks: [], boards: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus on input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ tasks: [], boards: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ tasks: [], boards: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      searchService
        .search(trimmed)
        .then((data) => {
          setResults(data);
          setSelectedIndex(0);
        })
        .catch(() => {
          setResults({ tasks: [], boards: [] });
        })
        .finally(() => {
          setLoading(false);
        });
    }, 220);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isOpen]);

  // Combined flat list of items for keyboard navigation
  const flatItems: Array<{ type: 'task'; data: TaskSearchDto } | { type: 'board'; data: BoardSearchDto }> = [
    ...results.tasks.map((t) => ({ type: 'task' as const, data: t })),
    ...results.boards.map((b) => ({ type: 'board' as const, data: b })),
  ];

  const handleSelectTask = (task: TaskSearchDto) => {
    onClose();
    navigate(`/boards/${task.boardId}?taskId=${task.id}`);
  };

  const handleSelectBoard = (board: BoardSearchDto) => {
    onClose();
    navigate(`/boards/${board.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flatItems[selectedIndex];
      if (current) {
        if (current.type === 'task') {
          handleSelectTask(current.data);
        } else {
          handleSelectBoard(current.data);
        }
      }
    }
  };

  if (!isOpen) return null;

  const totalResults = results.tasks.length + results.boards.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[75vh]">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <SearchIcon className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Görev kodu (örn: FW-14), başlık, etiket (#acil) veya pano ara..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 font-medium focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              ×
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {query.trim() === '' ? (
            /* Empty Prompt / Quick Hints */
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                <SearchIcon className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                Tüm sistemde hızlı arama yapın
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-400">
                <span>İpuçları:</span>
                <button
                  type="button"
                  onClick={() => setQuery('FW-')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold transition-colors"
                >
                  FW-
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('PAY-')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold transition-colors"
                >
                  PAY-
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('Ödeme')}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Ödeme
                </button>
              </div>
            </div>
          ) : !loading && totalResults === 0 ? (
            /* No Results Found */
            <div className="py-8 text-center space-y-2">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                &ldquo;{query}&rdquo; ile eşleşen sonuç bulunamadı
              </p>
              <p className="text-xs text-slate-400">
                Görev kodu, başlık, etiket veya pano adını kontrol ediniz.
              </p>
            </div>
          ) : (
            <>
              {/* Tasks Group */}
              {results.tasks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Görevler ({results.tasks.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.tasks.map((task) => {
                      const itemIdx = flatItems.findIndex(
                        (fi) => fi.type === 'task' && fi.data.id === task.id
                      );
                      const isSelected = itemIdx === selectedIndex;
                      const priority = priorityBadgeMap[task.priority] || priorityBadgeMap.LOW;

                      return (
                        <div
                          key={`task-${task.id}`}
                          onClick={() => handleSelectTask(task)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-200 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Task Key Badge */}
                            <span
                              className="px-2 py-0.5 rounded-md text-xs font-mono font-bold border shrink-0 shadow-2xs"
                              style={{
                                backgroundColor: task.taskTypeColor ? `${task.taskTypeColor}15` : '#F1F5F9',
                                color: task.taskTypeColor || '#334155',
                                borderColor: task.taskTypeColor ? `${task.taskTypeColor}40` : '#CBD5E1',
                              }}
                            >
                              {task.taskKey}
                            </span>

                            {/* Title & Board / Column Context */}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                                <span className="font-medium text-slate-600 truncate">{task.boardTitle}</span>
                                <span>/</span>
                                <span className="text-slate-500 font-medium truncate">{task.columnName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Priority & Tags */}
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {task.tags && task.tags.length > 0 && (
                              <div className="hidden sm:flex items-center gap-1">
                                {task.tags.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priority.className}`}>
                              {priority.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Boards Group */}
              {results.boards.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Panolar ({results.boards.length})</span>
                  </div>
                  <div className="space-y-1">
                    {results.boards.map((board) => {
                      const itemIdx = flatItems.findIndex(
                        (fi) => fi.type === 'board' && fi.data.id === board.id
                      );
                      const isSelected = itemIdx === selectedIndex;

                      return (
                        <div
                          key={`board-${board.id}`}
                          onClick={() => handleSelectBoard(board)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-200 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18" />
                                <path d="M9 21V9" />
                              </svg>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                {board.title}
                              </p>
                              {board.organizationName && (
                                <p className="text-[11px] text-slate-400 font-medium truncate">
                                  {board.organizationName}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 shrink-0 ml-3">
                            <span>{board.columnCount} Kolon</span>
                            <span>•</span>
                            <span>{board.taskCount} Görev</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white border border-slate-200 rounded text-[10px] font-mono">↑↓</kbd> Gezin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white border border-slate-200 rounded text-[10px] font-mono">↵</kbd> Seç
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white border border-slate-200 rounded text-[10px] font-mono">ESC</kbd> Kapat
            </span>
          </div>
          <span>Kanban Search Engine</span>
        </div>

      </div>
    </div>
  );
}
