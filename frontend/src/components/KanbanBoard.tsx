import { useCallback, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import KanbanColumn from './KanbanColumn';
import type { ColumnResponse, TaskResponse } from '@/types';
import { taskApi } from '@/api/taskApi';
import { columnApi } from '@/api/columnApi';

interface Props {
  boardId:    number;
  columns:    ColumnResponse[];
  onColumns:  (cols: ColumnResponse[]) => void;
  onAddTask:  (columnId: number) => void;
  onEditTask: (task: TaskResponse) => void;
}

export default function KanbanBoard({ boardId, columns, onColumns, onAddTask, onEditTask }: Props) {
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  /* ── Drag-and-drop ─────────────────────────────────────────────── */
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;

      // Dropped outside any column
      if (!destination) return;

      const srcColId = Number(source.droppableId);
      const dstColId = Number(destination.droppableId);
      const taskId   = Number(draggableId);

      // No change
      if (srcColId === dstColId && source.index === destination.index) return;

      // ── Optimistic update ──────────────────────────────────────────
      const previousColumns = columns;

      onColumns(
        columns.map((col) => {
          if (col.id !== srcColId && col.id !== dstColId) return col;

          const srcTasks = [...columns.find((c) => c.id === srcColId)!.tasks];
          const dstTasks = srcColId === dstColId ? srcTasks : [...columns.find((c) => c.id === dstColId)!.tasks];

          // Remove from source
          const [moved] = srcTasks.splice(source.index, 1);

          // Insert into destination
          if (srcColId === dstColId) {
            srcTasks.splice(destination.index, 0, { ...moved, columnId: dstColId });
            if (col.id === srcColId) return { ...col, tasks: srcTasks };
          } else {
            dstTasks.splice(destination.index, 0, { ...moved, columnId: dstColId });
            if (col.id === srcColId) return { ...col, tasks: srcTasks };
            if (col.id === dstColId) return { ...col, tasks: dstTasks };
          }

          return col;
        }),
      );

      // ── API call ──────────────────────────────────────────────────
      taskApi
        .move(taskId, { targetColumnId: dstColId, targetPosition: destination.index })
        .catch(() => {
          onColumns(previousColumns);
          toast.error('Could not move the task. Please try again.');
        });
    },
    [columns, onColumns],
  );

  /* ── Add column ────────────────────────────────────────────────── */
  const handleAddColumn = async () => {
    const title = newColTitle.trim();
    if (!title) return;

    try {
      const col = await columnApi.create(boardId, { title });
      onColumns([...columns, { ...col, tasks: [] }]);
      setNewColTitle('');
      setAddingCol(false);
    } catch {
      toast.error('Failed to create column.');
    }
  };

  /* ── Delete column ─────────────────────────────────────────────── */
  const handleDeleteColumn = async (columnId: number) => {
    if (!confirm('Delete this column and all its tasks?')) return;
    try {
      await columnApi.remove(boardId, columnId);
      onColumns(columns.filter((c) => c.id !== columnId));
      toast.success('Column deleted.');
    } catch {
      toast.error('Failed to delete column.');
    }
  };

  /* ── Rename column ─────────────────────────────────────────────── */
  const handleRenameColumn = async (columnId: number, title: string) => {
    try {
      await columnApi.update(boardId, columnId, { title });
      onColumns(columns.map((c) => c.id === columnId ? { ...c, title } : c));
    } catch {
      toast.error('Failed to rename column.');
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-5 items-start overflow-x-auto pb-6 pt-2 px-1 min-h-[calc(100vh-160px)]">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            boardId={boardId}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteCol={handleDeleteColumn}
            onRenameCol={handleRenameColumn}
          />
        ))}

        {/* ── Add column panel ─────────────────────────────────────── */}
        {addingCol ? (
          <div className="flex-shrink-0 w-72 bg-dark-800 border border-white/[0.06] rounded-xl p-3
                          animate-scale-in">
            <input
              autoFocus
              placeholder="Column title…"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') { setAddingCol(false); setNewColTitle(''); }
              }}
              className="field text-sm mb-2"
            />
            <div className="flex gap-2">
              <button onClick={handleAddColumn} className="btn-primary flex-1 py-1.5 text-xs">
                Add
              </button>
              <button onClick={() => { setAddingCol(false); setNewColTitle(''); }} className="btn-ghost py-1.5 text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCol(true)}
            className="flex-shrink-0 w-72 flex items-center gap-2 px-4 py-3 rounded-xl
                       border-2 border-dashed border-white/[0.08] hover:border-violet-500/40
                       text-white/30 hover:text-violet-400 transition-all duration-200 group"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-sm font-medium">Add column</span>
          </button>
        )}
      </div>
    </DragDropContext>
  );
}
