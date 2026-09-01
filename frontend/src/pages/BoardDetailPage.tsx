import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import KanbanBoard from '@/components/KanbanBoard';
import AddTaskModal from '@/components/AddTaskModal';
import AddColumnModal from '@/components/AddColumnModal';
import TaskDetailModal from '@/components/TaskDetailModal';
import { boardApi } from '@/api/boardApi';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardResponse, ColumnResponse, TaskResponse } from '@/types';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);
  const { isAdmin } = useAuth();

  const [boardData,           setBoardData]           = useState<BoardResponse | null>(null);
  const [columns,             setColumns]             = useState<ColumnResponse[]>([]);
  const [isLoading,           setIsLoading]           = useState(true);
  const [isError,             setIsError]             = useState(false);

  // Modals state
  const [addTaskModalOpen,    setAddTaskModalOpen]    = useState(false);
  const [selectedColumnId,    setSelectedColumnId]    = useState<number | null>(null);
  const [addColumnModalOpen,  setAddColumnModalOpen]  = useState(false);
  const [selectedTask,        setSelectedTask]        = useState<TaskResponse | null>(null);

  /* ── Fetch Board & Full Tree ────────────────────────────────────── */
  const fetchBoardDetails = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      try {
        const data = await boardApi.getOne(boardId);
        setBoardData(data);
        setColumns(data.columns || []);
        setIsError(false);
      } catch {
        setIsError(true);
        if (!isBackground) {
          toast.error('Pano bilgileri yüklenirken bir sorun oluştu.');
        }
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    if (boardId) {
      fetchBoardDetails(false);
    }
  }, [boardId, fetchBoardDetails]);

  /* ── Task created handler ───────────────────────────────────────── */
  const handleTaskCreated = () => {
    fetchBoardDetails(true);
  };

  /* ── Column added handler ───────────────────────────────────────── */
  const handleColumnAdded = () => {
    fetchBoardDetails(true);
  };

  /* ── Task updated / deleted handler ─────────────────────────────── */
  const handleTaskUpdated = () => {
    fetchBoardDetails(true);
  };

  const handleTaskDeleted = () => {
    setSelectedTask(null);
    fetchBoardDetails(true);
  };

  /* ── Render ────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Pano yükleniyor…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !boardData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mb-4 text-red-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Pano Yüklenemedi</h2>
          <p className="text-slate-500 text-sm mb-5 max-w-sm">
            İstediğiniz pano bulunamadı veya erişim yetkiniz kısıtlanmış olabilir.
          </p>
          <div className="flex gap-3">
            <button onClick={() => fetchBoardDetails(false)} className="btn-secondary">
              Yeniden Dene
            </button>
            <Link to="/boards" className="btn-primary">
              ← Panolara Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ── Board Header ───────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-3 flex items-center gap-3">

          {/* Back link */}
          <Link
            to="/boards"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 -ml-1 rounded-lg hover:bg-slate-100"
            aria-label="Panolara geri dön"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-slate-300">/</span>

          {/* Board name */}
          <h1 className="text-base font-bold text-slate-800 truncate">{boardData.name}</h1>
          {boardData.description && (
            <span className="hidden sm:block text-sm text-slate-400 truncate max-w-xs ml-1">
              {boardData.description}
            </span>
          )}

          {/* Department badge if present */}
          {boardData.organizationName && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {boardData.organizationName}
            </span>
          )}

          {/* Counters */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium ml-1">
            <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
              {columns.length} kolon
            </span>
            <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
              {columns.reduce((acc, c) => acc + c.tasks.length, 0)} görev
            </span>
          </div>

          {/* ── Action Buttons in Header ────────────────────────────── */}
          <div className="ml-auto flex items-center gap-2">
            {/* + Kolon Ekle Butonu (Admin Only) */}
            {isAdmin && (
              <button
                onClick={() => setAddColumnModalOpen(true)}
                className="btn-secondary text-xs sm:text-sm py-2 px-3 gap-1.5 font-semibold"
                title="Yeni Kolon Ekle"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                     className="w-4 h-4 text-slate-600">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5"  y1="12" x2="19" y2="12" />
                </svg>
                + Kolon Ekle
              </button>
            )}

            {/* + Yeni Görev Oluştur Butonu (All Users / Jira Standard) */}
            <button
              onClick={() => {
                setSelectedColumnId(columns[0]?.id || null);
                setAddTaskModalOpen(true);
              }}
              disabled={columns.length === 0}
              className="btn-primary text-xs sm:text-sm py-2 px-3 gap-1.5 font-semibold disabled:opacity-40"
              title={columns.length === 0 ? 'Önce bir kolon ekleyin' : 'Yeni Görev Oluştur'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                   className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5"  y1="12" x2="19" y2="12" />
              </svg>
              + Yeni Görev Oluştur
            </button>
          </div>
        </div>
      </div>

      {/* ── Kanban Board Workspace ──────────────────────────────────── */}
      <main className="flex-1 mx-auto max-w-screen-2xl w-full px-4 sm:px-6 py-4 flex flex-col min-h-0">
        <KanbanBoard
          boardId={boardId}
          columns={columns}
          onColumns={setColumns}
          onEditTask={(task) => setSelectedTask(task)}
        />
      </main>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {columns.length > 0 && (
        <AddTaskModal
          isOpen={addTaskModalOpen}
          boardId={boardId}
          columnId={selectedColumnId ?? columns[0].id}
          columns={columns}
          onClose={() => {
            setAddTaskModalOpen(false);
            setSelectedColumnId(null);
          }}
          onTaskAdded={() => {
            handleTaskCreated();
            setAddTaskModalOpen(false);
            setSelectedColumnId(null);
          }}
        />
      )}

      <AddColumnModal
        isOpen={addColumnModalOpen}
        boardId={boardId}
        onClose={() => setAddColumnModalOpen(false)}
        onColumnAdded={handleColumnAdded}
      />

      <TaskDetailModal
        task={selectedTask}
        boardId={boardId}
        columns={columns}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => handleTaskUpdated()}
        onDeleted={() => handleTaskDeleted()}
      />
    </div>
  );
}
