import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import type { ColumnResponse, TaskResponse } from '@/types';

interface Props {
  column:      ColumnResponse;
  boardId:     number;
  onAddTask:   (columnId: number) => void;
  onEditTask:  (task: TaskResponse) => void;
  onDeleteCol: (columnId: number) => void;
  onRenameCol: (columnId: number, title: string) => void;
}

export default function KanbanColumn({
  column, boardId: _boardId, onAddTask, onEditTask, onDeleteCol, onRenameCol,
}: Props) {
  const [editing, setEditing]   = useState(false);
  const [title,   setTitle]     = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRename = () => {
    if (title.trim() && title.trim() !== column.title) {
      onRenameCol(column.id, title.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* ── Column header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setTitle(column.title); setEditing(false); } }}
            className="field py-1 text-sm font-semibold flex-1"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-white/80 hover:text-white truncate max-w-[180px]
                       transition-colors"
            title="Click to rename"
          >
            {column.title}
          </button>
        )}

        <div className="flex items-center gap-1">
          {/* Task count badge */}
          <span className="text-xs font-medium text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
            {column.tasks.length}
          </span>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-ghost p-1 text-white/30 hover:text-white"
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
                <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-white/[0.08]
                                bg-dark-800 shadow-card py-1 animate-scale-in">
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => { onDeleteCol(column.id); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete column
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Droppable task list ─────────────────────────────────────── */}
      <Droppable droppableId={String(column.id)}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 min-h-[80px] rounded-xl p-2 space-y-2 overflow-y-auto
              border transition-all duration-150
              ${snapshot.isDraggingOver
                ? 'bg-violet-600/[0.05] border-violet-500/30'
                : 'bg-dark-800/50 border-white/[0.05]'}
            `}
            style={{ maxHeight: 'calc(100vh - 220px)' }}
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
                <div className="text-3xl mb-2 opacity-20">⬡</div>
                <p className="text-xs text-white/20">Drop a card here</p>
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* ── Add task button ─────────────────────────────────────────── */}
      <button
        onClick={() => onAddTask(column.id)}
        className="mt-2 flex items-center gap-2 w-full px-3 py-2.5 rounded-xl
                   text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04]
                   border border-dashed border-white/[0.07] hover:border-white/[0.15]
                   transition-all duration-200 group"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
             className="w-4 h-4 group-hover:text-violet-400 transition-colors">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add task
      </button>
    </div>
  );
}
