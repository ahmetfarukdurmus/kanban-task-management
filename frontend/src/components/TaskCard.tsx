import { Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isPast } from 'date-fns';
import type { TaskResponse } from '@/types';

interface Props {
  task:    TaskResponse;
  index:   number;
  onEdit:  (task: TaskResponse) => void;
}

const priorityClass: Record<string, string> = {
  HIGH:   'badge-high',
  MEDIUM: 'badge-medium',
  LOW:    'badge-low',
};

const priorityDot: Record<string, string> = {
  HIGH:   'bg-red-400',
  MEDIUM: 'bg-amber-400',
  LOW:    'bg-emerald-400',
};

export default function TaskCard({ task, index, onEdit }: Props) {
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate));

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(task)}
          className={`
            group relative rounded-xl border p-3.5 cursor-pointer
            transition-all duration-150 select-none
            ${snapshot.isDragging
              ? 'bg-dark-600 border-violet-500/60 shadow-glow-purple rotate-1 scale-[1.02]'
              : 'bg-dark-700 border-white/[0.07] hover:border-white/[0.14] hover:bg-dark-600'}
          `}
          style={provided.draggableProps.style}
        >
          {/* Priority stripe */}
          <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${priorityDot[task.priority]}`} />

          <div className="pl-3">
            {/* Title */}
            <p className="text-sm font-medium text-white/90 leading-snug line-clamp-2">
              {task.title}
            </p>

            {/* Description preview */}
            {task.description && (
              <p className="mt-1 text-xs text-white/40 line-clamp-1">{task.description}</p>
            )}

            {/* Meta row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {/* Priority badge */}
              <span className={priorityClass[task.priority]}>
                {task.priority}
              </span>

              {/* Due date */}
              {task.dueDate && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-white/40'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                       className="w-3 h-3">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8"  y1="2" x2="8"  y2="6" />
                    <line x1="3"  y1="10" x2="21" y2="10" />
                  </svg>
                  {format(parseISO(task.dueDate), 'MMM d')}
                </span>
              )}

              {/* Assignee */}
              {task.assignee && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                                 bg-white/5 text-white/40">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full
                                   bg-gradient-to-br from-violet-500 to-cyan-400 text-[8px] font-bold">
                    {task.assignee.charAt(0).toUpperCase()}
                  </span>
                  {task.assignee}
                </span>
              )}
            </div>
          </div>

          {/* Drag indicator */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
              <circle cx="9"  cy="5"  r="1.5" /><circle cx="15" cy="5"  r="1.5" />
              <circle cx="9"  cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9"  cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
            </svg>
          </div>
        </div>
      )}
    </Draggable>
  );
}
