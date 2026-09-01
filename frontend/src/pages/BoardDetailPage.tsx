import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

  /* ── Board & Column State ───────────────────────────────────────── */
  const [boardData, setBoardData]     = useState<BoardResponse | null>(null);
  const [columns, setColumns]         = useState<ColumnResponse[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isError, setIsError]         = useState(false);

  /* ── Modals State ──────────────────────────────────────────────── */
  const [addTaskModalOpen, setAddTaskModalOpen]     = useState(false);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [selectedTask, setSelectedTask]             = useState<TaskResponse | null>(null);

  /* ── Fetch fresh board details from backend ────────────────────── */
  const fetchBoardDetails = useCallback(async (silent = false) => {
    if (!boardId || isNaN(boardId)) return;
    if (!silent) setIsLoading(true);
    setIsError(false);

    try {
      const data = await boardApi.getOne(boardId);
      setBoardData(data);

      if (data?.columns) {
        const sorted = [...data.columns]
          .sort((a, b) => a.position - b.position)
          .map((col) => ({
            ...col,
            tasks: [...(col.tasks || [])].sort((a, b) => a.position - b.position),
          }));
        setColumns(sorted);
      } else {
        setColumns([]);
      }
    } catch (err) {
      console.error('Failed to fetch board details:', err);
      setIsError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [boardId]);

  /* Re-fetch when page mounts or boardId changes */
  useEffect(() => {
    fetchBoardDetails(false);
  }, [fetchBoardDetails]);

  /* ── Callbacks on modal / action success ────────────────────────── */
  const handleTaskAdded = (_task: TaskResponse) => {
    // Re-fetch fresh board data from backend to ensure consistent state
    fetchBoardDetails(true);
  };

  const handleTaskUpdated = (_updated: TaskResponse) => {
    // Re-fetch fresh board data from backend to ensure consistent state
    fetchBoardDetails(true);
  };

  const handleTaskDeleted = (_taskId: number, _columnId: number) => {
    // Re-fetch fresh board data from backend to ensure consistent state
    fetchBoardDetails(true);
  };

  const handleColumnAdded = (_newCol: ColumnResponse) => {
    // Re-fetch fresh board data from backend to ensure consistent state
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

          {/* Counters */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
              {columns.length} kolon
            </span>
            <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
              {columns.reduce((acc, c) => acc + c.tasks.length, 0)} görev
            </span>
          </div>

          {/* ── Admin-only Action Buttons in Header ─────────────────── */}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              {/* + Kolon Ekle Butonu */}
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

              {/* + Yeni Görev Oluştur Butonu */}
              <button
                onClick={() => setAddTaskModalOpen(true)}
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
          )}
        </div>
      </div>

      {/* ── Board Canvas ───────────────────────────────────────────── */}
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
              <p className="text-slate-700 text-base font-semibold">Henüz kolon oluşturulmamış</p>
              {isAdmin ? (
                <div className="mt-2">
                  <p className="text-slate-400 text-xs mb-3">Başlamak için üstteki "+ Kolon Ekle" butonunu kullanın.</p>
                  <button onClick={() => setAddColumnModalOpen(true)} className="btn-primary text-xs">
                    + Kolon Ekle
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 text-xs mt-1">Yöneticinin kolon eklemesi bekleniyor.</p>
              )}
            </div>
          )}

          <KanbanBoard
            boardId={boardId}
            columns={columns}
            onColumns={setColumns}
            onAddTask={() => setAddTaskModalOpen(true)}
            onEditTask={(task) => setSelectedTask(task)}
          />
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {/* 1. Yeni Görev Oluşturma Modalı (Admin Only) */}
      <AddTaskModal
        isOpen={addTaskModalOpen}
        onClose={() => setAddTaskModalOpen(false)}
        boardId={boardId}
        columnId={columns[0]?.id ?? 0}
        columns={columns}
        onTaskAdded={handleTaskAdded}
      />

      {/* 2. Yeni Kolon Ekleme Modalı (Admin Only) */}
      <AddColumnModal
        isOpen={addColumnModalOpen}
        boardId={boardId}
        onClose={() => setAddColumnModalOpen(false)}
        onColumnAdded={handleColumnAdded}
      />

      {/* 3. 2 Kolonlu Geniş Görev Detay Modalı (Admin & User) */}
      <TaskDetailModal
        task={selectedTask}
        boardId={boardId}
        columns={columns}
        onClose={() => setSelectedTask(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </div>
  );
}
