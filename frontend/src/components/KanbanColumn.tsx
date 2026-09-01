import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import type { ColumnResponse, TaskResponse } from '@/types';

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
    <div className="flex flex-col w-72 flex-shrink-0
                    bg-slate-100/90 border border-slate-200 rounded-xl p-3">

      {/* ── Column header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-0.5">
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
            className="field py-1 text-sm font-semibold flex-1"
          />
        ) : (
          <span
            className="text-sm font-semibold text-slate-700 truncate max-w-[180px]"
            title={column.title}
          >
            {column.title}
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-2">
          {/* Task count badge */}
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200
                           px-2 py-0.5 rounded-full">
            {column.tasks.length}
          </span>

          {/* Context menu – admin only */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-ghost p-1 text-slate-400 hover:text-slate-700"
                aria-label="Column options"
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
                  <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-slate-200
                                  bg-white shadow-lg py-1 animate-scale-in">
                    <button
                      onClick={() => { setEditing(true); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-600
                                 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { onDeleteCol(column.id); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-500
                                 hover:bg-red-50 transition-colors"
                    >
                      Delete column
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Droppable task list ─────────────────────────────────────── */}
      <Droppable droppableId={String(column.id)}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 min-h-[80px] rounded-lg p-1.5 space-y-2 overflow-y-auto
              border transition-all duration-150
              ${snapshot.isDraggingOver
                ? 'bg-blue-50 border-blue-300'
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
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-slate-400">Drop a card here</p>
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* NOTE: "+ Add task" per-column button intentionally removed.
               Task creation is centralised in the board header (ROLE_ADMIN only). */}
    </div>
  );
}
