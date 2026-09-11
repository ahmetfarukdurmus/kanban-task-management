import { useCallback, useEffect, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import KanbanColumn from './KanbanColumn';
import type { ColumnResponse, TaskResponse, TaskTypeDto } from '@/types';
import { taskApi } from '@/api/taskApi';
import { columnApi } from '@/api/columnApi';
import { taskTypeService } from '@/services/taskTypeService';
import { useAuth } from '@/contexts/AuthContext';
import { isColumnMatching } from '@/utils/workflowUtils';

interface Props {
  boardId:    number;
  columns:    ColumnResponse[];
  onColumns:  (cols: ColumnResponse[]) => void;
  onEditTask: (task: TaskResponse) => void;
}

export default function KanbanBoard({ boardId, columns, onColumns, onEditTask }: Props) {
  const { isAdmin } = useAuth();
  const [addingCol,   setAddingCol]   = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [taskTypes,   setTaskTypes]   = useState<TaskTypeDto[]>([]);

  useEffect(() => {
    taskTypeService.getAll().then(setTaskTypes).catch(() => {});
  }, []);

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

      // ── Transition Rules Guard (Client-side pre-validation) ────────
      if (srcColId !== dstColId) {
        const srcCol = columns.find((c) => c.id === srcColId);
        const dstCol = columns.find((c) => c.id === dstColId);
        const task = srcCol?.tasks.find((t) => t.id === taskId);

        if (task && task.taskTypeId && dstCol) {
          const currentType = taskTypes.find((t) => t.id === task.taskTypeId);
          if (currentType?.rules && currentType.rules.length > 0) {
            for (const rule of currentType.rules) {
              const targetMatches =
                (rule.targetColumnId && rule.targetColumnId === dstColId) ||
                (rule.targetColumnTitle && isColumnMatching(rule.targetColumnTitle, dstCol.title));

              if (!targetMatches) continue;

              const hasSource = rule.sourceColumnId || (rule.sourceColumnTitle && rule.sourceColumnTitle.trim() !== '');
              if (hasSource && srcCol) {
                const sourceMatches =
                  (rule.sourceColumnId && rule.sourceColumnId === srcColId) ||
                  (rule.sourceColumnTitle && isColumnMatching(rule.sourceColumnTitle, srcCol.title));
                if (!sourceMatches) continue;
              }

              if (rule.ruleType === 'CHECKLIST_REQUIRED') {
                const items = task.checklistItems || [];
                const uncompleted = items.filter(
                  (item) => !item.isCompleted && (!item.requiredForColumnId || item.requiredForColumnId === dstColId)
                );
                if (items.length === 0 || uncompleted.length > 0) {
                  const ruleDetail = rule.description ? ` (${rule.description})` : '';
                  toast.error(`Bu aşamaya (${dstCol.title}) geçebilmek için kontrol listesi maddeleri tamamlanmalıdır.${ruleDetail}`, {
                    duration: 5000,
                    style: {
                      border: '1px solid #EF4444',
                      padding: '12px',
                      color: '#991B1B',
                      backgroundColor: '#FEF2F2',
                    },
                  });
                  return; // Stop drag transition immediately, task stays in source column!
                }
              }
            }
          }
        }
      }

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
        .catch((err: unknown) => {
          onColumns(previousColumns);
          const errorMsg =
            (err as { response?: { data?: { detail?: string; title?: string } } })?.response?.data?.detail ||
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Bu aşamaya geçebilmek için zorunlu kontrol listesi maddeleri tamamlanmalıdır.';
          toast.error(errorMsg, {
            duration: 6000,
            style: {
              border: '1px solid #EF4444',
              padding: '12px',
              color: '#991B1B',
              backgroundColor: '#FEF2F2',
            },
          });
        });
    },
    [columns, onColumns, taskTypes],
  );

  /* ── Add column (admin only) ───────────────────────────────────── */
  const handleAddColumn = async () => {
    const title = newColTitle.trim();
    if (!title) return;

    try {
      const col = await columnApi.create(boardId, { title });
      onColumns([...columns, { ...col, tasks: [] }]);
      setNewColTitle('');
      setAddingCol(false);
      toast.success('Yeni kolon eklendi.');
    } catch {
      toast.error('Kolon oluşturulamadı.');
    }
  };

  /* ── Delete column ─────────────────────────────────────────────── */
  const handleDeleteColumn = async (columnId: number) => {
    if (!confirm('Bu kolonu ve altındaki tüm görevleri silmek istediğinizden emin misiniz?')) return;
    try {
      await columnApi.remove(boardId, columnId);
      onColumns(columns.filter((c) => c.id !== columnId));
      toast.success('Kolon silindi.');
    } catch {
      toast.error('Kolon silinemedi.');
    }
  };

  /* ── Rename column ─────────────────────────────────────────────── */
  const handleRenameColumn = async (columnId: number, title: string) => {
    try {
      await columnApi.update(boardId, columnId, { title });
      onColumns(columns.map((c) => c.id === columnId ? { ...c, title } : c));
    } catch {
      toast.error('Kolon yeniden adlandırılamadı.');
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="w-full flex gap-3.5 items-start overflow-x-auto pb-6 pt-1 px-0.5 min-h-[calc(100vh-180px)]">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            boardId={boardId}
            onEditTask={onEditTask}
            onDeleteCol={handleDeleteColumn}
            onRenameCol={handleRenameColumn}
            isAdmin={isAdmin}
          />
        ))}

        {/* ── Add column panel – ADMIN only ─────────────────────── */}
        {isAdmin && (
          addingCol ? (
            <div className="flex-1 min-w-[280px] max-w-[340px] shrink-0 bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm animate-scale-in">
              <input
                autoFocus
                placeholder="Kolon başlığı…"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  handleAddColumn();
                  if (e.key === 'Escape') { setAddingCol(false); setNewColTitle(''); }
                }}
                className="field text-xs sm:text-sm py-1.5 mb-2.5"
              />
              <div className="flex gap-2">
                <button onClick={handleAddColumn} className="btn-primary flex-1 py-1.5 text-xs font-semibold">
                  Ekle
                </button>
                <button onClick={() => { setAddingCol(false); setNewColTitle(''); }} className="btn-ghost py-1.5 text-xs">
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCol(true)}
              className="flex-1 min-w-[280px] max-w-[340px] shrink-0 min-h-[160px] flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/20 text-slate-400 hover:text-blue-600 transition-all duration-200 group bg-slate-50/40 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-blue-300 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all text-slate-400 group-hover:text-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                     className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5"  y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-xs font-bold tracking-tight">Yeni Kolon Ekle</span>
              <span className="text-[10px] text-slate-400 font-normal">İş akışına yeni bir aşama tanımlayın</span>
            </button>
          )
        )}
      </div>
    </DragDropContext>
  );
}
