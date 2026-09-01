import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import KanbanBoard from '@/components/KanbanBoard';
import AddTaskModal from '@/components/AddTaskModal';
import EditTaskModal from '@/components/EditTaskModal';
import { boardApi } from '@/api/boardApi';
import { useAuth } from '@/contexts/AuthContext';
import type { ColumnResponse, TaskResponse } from '@/types';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const { isAdmin } = useAuth();

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

  /* ── Add-task modal – opens for a specific column ──────────────── */
  const [addModalColId, setAddModalColId] = useState<number | null>(null);

  /**
   * "New Task" header button: defaults to the first column.
   * If no columns exist yet we pick 0 (modal will be disabled).
   */
  const handleOpenAddTask = () => {
    const firstColId = columns[0]?.id ?? null;
    setAddModalColId(firstColId);
  };

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
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isError || !boardData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-slate-400 mb-4">Board not found or you don't have access.</p>
          <Link to="/boards" className="btn-primary">← Back to boards</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ── Board header ───────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-3 flex items-center gap-3">

          {/* Back link */}
          <Link
            to="/boards"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 -ml-1"
            aria-label="Back to boards"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-slate-300">/</span>

          {/* Board name */}
          <h1 className="text-base font-semibold text-slate-800 truncate">{boardData.name}</h1>
          {boardData.description && (
            <span className="hidden sm:block text-sm text-slate-400 truncate max-w-xs ml-1">
              {boardData.description}
            </span>
          )}

          {/* Counters */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              {columns.length} columns
            </span>
            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              {columns.reduce((acc, c) => acc + c.tasks.length, 0)} tasks
            </span>
          </div>

          {/* ── Admin-only action buttons ─────────────────────── */}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              {/* New Task button — opens modal with first column pre-selected */}
              <button
                onClick={handleOpenAddTask}
                disabled={columns.length === 0}
                className="btn-primary text-sm gap-1.5 disabled:opacity-40"
                title={columns.length === 0 ? 'Add a column first' : 'Create a new task'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                     className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5"  y1="12" x2="19" y2="12" />
                </svg>
                Yeni Görev Oluştur
              </button>

              {/* Add Column – clicking focuses the inline input in KanbanBoard.
                  We trigger it by setting a flag that the board reads. */}
            </div>
          )}
        </div>
      </div>

      {/* ── Board canvas ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 sm:px-6 overflow-x-auto">
          {columns.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center pt-24">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                     className="w-8 h-8 text-slate-400">
                  <rect x="3" y="3" width="7" height="18" rx="1.5" />
                  <rect x="14" y="3" width="7" height="11" rx="1.5" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">No columns yet</p>
              {isAdmin
                ? <p className="text-slate-400 text-xs mt-1">Use the "Add column" button on the board to get started.</p>
                : <p className="text-slate-400 text-xs mt-1">Wait for an admin to add columns.</p>
              }
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

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AddTaskModal
        isOpen={addModalColId !== null}
        onClose={() => setAddModalColId(null)}
        boardId={boardId}
        columnId={addModalColId ?? 0}
        columns={columns}
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
