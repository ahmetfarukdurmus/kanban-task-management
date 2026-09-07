import { Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isPast } from 'date-fns';
import type { TaskResponse } from '@/types';
import { CalendarIcon, UserIcon } from './icons';

interface Props {
  task:    TaskResponse;
  index:   number;
  onEdit:  (task: TaskResponse) => void;
}

const priorityAccent: Record<string, string> = {
  HIGH:   'bg-rose-500',
  MEDIUM: 'bg-amber-400',
  LOW:    'bg-slate-400',
};

const priorityBadge: Record<string, { label: string; className: string }> = {
  HIGH:   { label: 'Yüksek', className: 'badge-high' },
  MEDIUM: { label: 'Orta',   className: 'badge-medium' },
  LOW:    { label: 'Düşük',  className: 'badge-low' },
};

// Generates consistent soft pastel background colors for user avatars
function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-700' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { bg: 'bg-violet-100', text: 'text-violet-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { bg: 'bg-amber-100', text: 'text-amber-700' },
    { bg: 'bg-rose-100', text: 'text-rose-700' },
    { bg: 'bg-teal-100', text: 'text-teal-700' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function TaskCard({ task, index, onEdit }: Props) {
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate));
  const priority = priorityBadge[task.priority] || priorityBadge.LOW;

  // Resolve assignees list
  const assigneesList = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assignee
      ? [{ id: 0, username: task.assignee, email: '' }]
      : [];

  // Checklist counts
  const totalChecklists = task.checklistItems?.length || 0;
  const completedChecklists = task.checklistItems?.filter((c) => c.isCompleted).length || 0;

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(task)}
          className={`
            group relative bg-white border rounded-xl p-3.5 cursor-pointer
            transition-all duration-150 select-none
            ${snapshot.isDragging
              ? 'border-blue-400 shadow-xl ring-2 ring-blue-500/20 rotate-1'
              : 'border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300'}
          `}
          style={provided.draggableProps.style}
        >
          {/* Priority accent stripe */}
          <div
            className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all ${priorityAccent[task.priority] || 'bg-slate-300'}`}
          />

          <div className="pl-2">
            {/* Task Type Badge (if assigned) */}
            {task.taskTypeName && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border"
                  style={{
                    backgroundColor: task.taskTypeColor ? `${task.taskTypeColor}15` : '#EFF6FF',
                    color: task.taskTypeColor || '#2563EB',
                    borderColor: task.taskTypeColor ? `${task.taskTypeColor}35` : '#BFDBFE',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: task.taskTypeColor || '#2563EB' }}
                  />
                  {task.taskTypeName}
                </span>
              </div>
            )}

            {/* Title */}
            <p className="text-sm font-semibold text-slate-800 leading-snug tracking-tight group-hover:text-blue-600 transition-colors line-clamp-2">
              {task.title}
            </p>

            {/* Description preview */}
            {task.description && (
              <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100/80">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Priority Badge */}
                <span className={priority.className}>
                  {priority.label}
                </span>

                {/* Due Date */}
                {task.dueDate && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      isOverdue
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-slate-50 text-slate-500 border border-slate-200/60'
                    }`}
                    title={isOverdue ? 'Süresi geçmiş' : 'Bitiş Tarihi'}
                  >
                    <CalendarIcon className="w-3 h-3" />
                    {format(parseISO(task.dueDate), 'd MMM')}
                  </span>
                )}

                {/* Checklist Progress Badge */}
                {totalChecklists > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                      completedChecklists === totalChecklists
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                    title={`Kontrol Listesi: ${completedChecklists}/${totalChecklists} tamamlandı`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {completedChecklists}/{totalChecklists}
                  </span>
                )}

                {/* Custom Fields Count Badge */}
                {task.customFields && task.customFields.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200/60"
                    title={`${task.customFields.length} özel alan`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-slate-400">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                    {task.customFields.length}
                  </span>
                )}
              </div>

              {/* Multi-Assignee Avatars */}
              <div className="flex items-center">
                {assigneesList.length === 0 ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-dashed border-slate-300"
                    title="Atanmamış"
                  >
                    <UserIcon className="w-3 h-3" />
                  </span>
                ) : (
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {assigneesList.slice(0, 3).map((u, i) => {
                      const avatar = getAvatarColor(u.username);
                      return (
                        <span
                          key={u.id || i}
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold border-2 border-white shadow-xs ${avatar.bg} ${avatar.text}`}
                          title={`Sorumlu: ${u.username}`}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      );
                    })}
                    {assigneesList.length > 3 && (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold bg-slate-200 text-slate-700 border-2 border-white shadow-xs"
                        title={`${assigneesList.length - 3} kişi daha`}
                      >
                        +{assigneesList.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
