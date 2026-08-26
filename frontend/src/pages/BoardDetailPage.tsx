import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import KanbanBoard from '@/components/KanbanBoard';
import AddTaskModal from '@/components/AddTaskModal';
import EditTaskModal from '@/components/EditTaskModal';
import { boardApi } from '@/api/boardApi';
import type { ColumnResponse, TaskResponse } from '@/types';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);

  /* ── Server state ──────────────────────────────────────────────── */
  const { data: boardData, isLoading, isError } = useQuery({
    queryKey: ['board', boardId],
    queryFn:  () => boardApi.getOne(boardId),
    enabled:  !!boardId,
  });

  /* ── Local Kanban state (drives DnD) ───────────────────────────── */
  const [columns, setColumns] = useState<ColumnResponse[]>([]);

  useEffect(() => {
    if (boardData?.columns) {
      const sorted = boardData.columns
        .sort((a, b) => a.position - b.position)
        .map((col) => ({
          ...col,
          tasks: [...col.tasks].sort((a, b) => a.position - b.position),
        }));
      setColumns(sorted);
    }
  }, [boardData]);

  /* ── Add-task modal ────────────────────────────────────────────── */
  const [addModalColId, setAddModalColId] = useState<number | null>(null);

  const handleTaskAdded = (task: TaskResponse) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === task.columnId ? { ...col, tasks: [...col.tasks, task] } : col,
      ),
    );
  };

  /* ── Edit-task modal ───────────────────────────────────────────── */
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);

  const handleTaskUpdated = (updated: TaskResponse) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === updated.columnId
          ? { ...col, tasks: col.tasks.map((t) => (t.id === updated.id ? updated : t)) }
          : col,
      ),
    );
  };

  const handleTaskDeleted = (taskId: number, columnId: number) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) } : col,
      ),
    );
  };

  /* ── Render ────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isError || !boardData) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-4xl mb-3">⚠</p>
          <p className="text-white/50 mb-4">Board not found or you don't have access.</p>
          <Link to="/boards" className="btn-primary">← Back to boards</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <Navbar />

      {/* Board header */}
      <div className="border-b border-white/[0.05] bg-dark-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            to="/boards"
            className="text-white/30 hover:text-white/60 transition-colors p-1 -ml-1"
            aria-label="Back to boards"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-lg font-semibold text-white truncate">{boardData.name}</h1>
          {boardData.description && (
            <span className="hidden sm:block text-sm text-white/30 truncate max-w-sm ml-2">
              {boardData.description}
            </span>
          )}

          {/* Column + task counters */}
          <div className="ml-auto flex items-center gap-3 text-xs text-white/25 font-medium">
            <span>{columns.length} columns</span>
            <span className="text-white/10">·</span>
            <span>{columns.reduce((acc, c) => acc + c.tasks.length, 0)} tasks</span>
          </div>
        </div>
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 sm:px-6 overflow-x-auto">
          {columns.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4 opacity-20">⬡</div>
              <p className="text-white/30 text-sm">No columns yet. Add one to get started!</p>
            </div>
          )}
          <KanbanBoard
            boardId={boardId}
            columns={columns}
            onColumns={setColumns}
            onAddTask={(colId) => setAddModalColId(colId)}
            onEditTask={setEditingTask}
          />
        </div>
      </div>

      {/* Modals */}
      <AddTaskModal
        isOpen={addModalColId !== null}
        onClose={() => setAddModalColId(null)}
        boardId={boardId}
        columnId={addModalColId ?? 0}
        onTaskAdded={handleTaskAdded}
      />

      <EditTaskModal
        task={editingTask}
        boardId={boardId}
        onClose={() => setEditingTask(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </div>
  );
}
