import { useCallback, useEffect, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import KanbanColumn from './KanbanColumn';
import type { ColumnResponse, TaskResponse, TaskTypeDto } from '@/types';
import { taskApi } from '@/api/taskApi';
import { columnApi } from '@/api/columnApi';
import { taskTypeService } from '@/services/taskTypeService';
import { useAuth } from '@/contexts/AuthContext';
import { isColumnMatching, normalizeColumnTitle } from '@/utils/workflowUtils';

interface Props {
  boardId:    number;
  columns:    ColumnResponse[];
  onColumns:  (cols: ColumnResponse[]) => void;
  onEditTask: (task: TaskResponse) => void;
}

export default function KanbanBoard({ boardId, columns, onColumns, onEditTask }: Props) {
  const { isAdmin } = useAuth();
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
        const srcColIndex = columns.findIndex((c) => c.id === srcColId);
        const dstColIndex = columns.findIndex((c) => c.id === dstColId);
        const srcCol = columns[srcColIndex];
        const dstCol = columns[dstColIndex];
        const task = srcCol?.tasks.find((t) => t.id === taskId);

        // 1. Enforce sequential column transition (cannot skip forward across columns)
        if (srcColIndex !== -1 && dstColIndex !== -1 && dstColIndex > srcColIndex + 1) {
          const nextCol = columns[srcColIndex + 1];
          toast.error(
            `Görevler aşamaları atlayarak taşınamaz. Lütfen iş akışı sırasını takip edin (Sıradaki aşama: ${nextCol?.title || 'Sonraki Aşama'}).`,
            {
              duration: 5000,
              style: {
                border: '1px solid #EF4444',
                padding: '12px',
                color: '#991B1B',
                backgroundColor: '#FEF2F2',
              },
            }
          );
          return;
        }

        // 2. Task type transition rules check
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
                if (items.length === 0) {
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

                const normRuleDesc = normalizeColumnTitle(rule.description);
                const descMatchedItems = normRuleDesc
                  ? items.filter((item) => {
                      const itemTitle = normalizeColumnTitle(item.title);
                      return itemTitle.includes(normRuleDesc) || normRuleDesc.includes(itemTitle);
                    })
                  : [];

                const colMatchedItems = items.filter(
                  (item) => item.requiredForColumnId && item.requiredForColumnId === dstColId
                );

                let targetItemsToCheck = items.filter(
                  (item) => !item.requiredForColumnId || item.requiredForColumnId === dstColId
                );
                if (descMatchedItems.length > 0) {
                  targetItemsToCheck = descMatchedItems;
                } else if (colMatchedItems.length > 0) {
                  targetItemsToCheck = colMatchedItems;
                }

                const uncompleted = targetItemsToCheck.filter((item) => !item.isCompleted);
                if (targetItemsToCheck.length === 0 || uncompleted.length > 0) {
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
      </div>
    </DragDropContext>
  );
}
