import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import type { ColumnResponse, TaskResponse } from '@/types';
import { ColumnStatusIcon } from './icons';

interface Props {
  column:      ColumnResponse;
  boardId:     number;
  onEditTask:  (task: TaskResponse) => void;
  onDeleteCol: (columnId: number) => void;
  onRenameCol: (columnId: number, title: string) => void;
  /** When true, admin-only actions (rename/delete column) are shown. */
  isAdmin:     boolean;
}

export default function KanbanColumn({
  column, boardId: _boardId, onEditTask, onDeleteCol, onRenameCol, isAdmin,
}: Props) {
  const [editing,  setEditing]  = useState(false);
  const [title,    setTitle]    = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRename = () => {
    if (title.trim() && title.trim() !== column.title) {
      onRenameCol(column.id, title.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col w-76 sm:w-80 flex-shrink-0 bg-slate-100/90 border border-slate-200/90 rounded-2xl p-3 shadow-xs">

      {/* ── Column Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ColumnStatusIcon title={column.title} />

          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleRename();
                if (e.key === 'Escape') { setTitle(column.title); setEditing(false); }
              }}
              className="field py-1 px-2 text-sm font-semibold flex-1"
            />
          ) : (
            <span
              className="text-sm font-bold text-slate-800 tracking-tight truncate max-w-[180px]"
              title={column.title}
            >
              {column.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {/* Pill counter badge */}
          <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shadow-xs">
            {column.tasks.length}
          </span>

          {/* Context menu – admin only */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-ghost p-1 text-slate-400 hover:text-slate-700 rounded-md"
                aria-label="Kolon seçenekleri"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <circle cx="12" cy="5"  r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-xl py-1 animate-scale-in">
                    <button
                      onClick={() => { setEditing(true); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-slate-400">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Yeniden Adlandır
                    </button>
                    <button
                      onClick={() => { onDeleteCol(column.id); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-rose-500">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Kolonu Sil
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Droppable Task List ─────────────────────────────────────── */}
      <Droppable droppableId={String(column.id)}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 min-h-[90px] rounded-xl p-1 space-y-2.5 overflow-y-auto
              border transition-all duration-150
              ${snapshot.isDraggingOver
                ? 'col-drop-active'
                : 'bg-transparent border-transparent'}
            `}
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          >
            {column.tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onEdit={onEditTask}
              />
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {column.tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-200/80 bg-white/40">
                <p className="text-xs font-medium text-slate-400">Görev bulunmuyor</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Kartları buraya sürükleyin</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
