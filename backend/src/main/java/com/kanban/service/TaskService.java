package com.kanban.service;

import com.kanban.dto.task.MoveTaskRequest;
import com.kanban.dto.task.TaskRequest;
import com.kanban.dto.task.TaskResponse;
import com.kanban.entity.BoardColumn;
import com.kanban.entity.Task;
import com.kanban.entity.Task.Priority;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.BoardColumnRepository;
import com.kanban.repository.BoardRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Business logic for Task CRUD, in-column reordering, and cross-column moves.
 *
 * <h3>Position Algorithm</h3>
 *
 * <p>Tasks within a column maintain a zero-based {@code position} field.
 * Kanban drag-and-drop sends a single {@link MoveTaskRequest} which is handled
 * by {@link #moveTask(Long, MoveTaskRequest)} regardless of whether the card
 * stays in the same column or changes columns.</p>
 *
 * <h4>Case A – Same-column reorder ({@code srcCol == dstCol})</h4>
 * <pre>
 * srcPos → dstPos (dst > src):
 *   tasks in (srcPos, dstPos] shift LEFT  (position − 1)
 *   task.position = dstPos
 *
 * srcPos → dstPos (dst < src):
 *   tasks in [dstPos, srcPos) shift RIGHT (position + 1)
 *   task.position = dstPos
 * </pre>
 *
 * <h4>Case B – Cross-column move ({@code srcCol ≠ dstCol})</h4>
 * <pre>
 * 1. Close gap in source column:
 *      tasks where position > srcPos shift LEFT by 1
 * 2. Open slot in target column:
 *      tasks where position >= dstPos shift RIGHT by 1
 * 3. Assign task to targetColumn at dstPos (clamped to count)
 * </pre>
 *
 * <p>Both cases use the efficient JPQL {@code @Modifying} queries in
 * {@link com.kanban.repository.TaskRepository} — only the affected range is updated.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository        taskRepository;
    private final BoardColumnRepository columnRepository;
    private final BoardRepository       boardRepository;
    private final SecurityUtils         securityUtils;

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns all tasks in a column, ordered by position.
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> getTasks(Long boardId, Long columnId) {
        User user = securityUtils.getCurrentUser();
        requireColumnOwned(boardId, columnId, user.getId());

        return taskRepository.findAllByColumnIdOrderByPositionAsc(columnId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Returns a single task.
     */
    @Transactional(readOnly = true)
    public TaskResponse getTask(Long boardId, Long columnId, Long taskId) {
        User user = securityUtils.getCurrentUser();
        requireColumnOwned(boardId, columnId, user.getId());
        return toResponse(requireTask(columnId, taskId));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new task appended at the end of the column.
     */
    public TaskResponse createTask(Long boardId, Long columnId, TaskRequest request) {
        User        user   = securityUtils.getCurrentUser();
        BoardColumn column = requireColumnOwned(boardId, columnId, user.getId());

        int nextPosition = taskRepository.countByColumnId(columnId);

        Task task = Task.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority() != null ? request.priority() : Priority.MEDIUM)
                .dueDate(request.dueDate())
                .assignee(request.assignee())
                .position(nextPosition)
                .column(column)
                .build();

        return toResponse(taskRepository.save(task));
    }

    /**
     * Updates the fields of an existing task.
     * Does NOT change position or column — use {@link #moveTask} for that.
     */
    public TaskResponse updateTask(Long boardId, Long columnId, Long taskId, TaskRequest request) {
        User user = securityUtils.getCurrentUser();
        requireColumnOwned(boardId, columnId, user.getId());

        Task task = requireTask(columnId, taskId);
        task.setTitle(request.title());
        task.setDescription(request.description());
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        task.setDueDate(request.dueDate());
        task.setAssignee(request.assignee());

        return toResponse(taskRepository.save(task));
    }

    /**
     * Deletes a task and closes the positional gap in its column.
     */
    public void deleteTask(Long boardId, Long columnId, Long taskId) {
        User user = securityUtils.getCurrentUser();
        requireColumnOwned(boardId, columnId, user.getId());

        Task task       = requireTask(columnId, taskId);
        int  deletedPos = task.getPosition();

        taskRepository.delete(task);
        taskRepository.flush();   // flush DELETE before the UPDATE

        // Close gap: shift all tasks after deletedPos left by 1
        taskRepository.shiftPositionsLeft(columnId, deletedPos, Integer.MAX_VALUE);
    }

    /**
     * Moves or reorders a task via the unified Kanban drag-and-drop endpoint.
     *
     * <p>This method is intentionally board-agnostic at the signature level;
     * ownership is verified through the task's current column → board → owner chain
     * AND through the target column → board → owner chain to prevent moving tasks
     * into boards owned by other users.</p>
     *
     * @param taskId  identifier of the task being dragged
     * @param request destination column + position
     * @return the updated task response
     */
    public TaskResponse moveTask(Long taskId, MoveTaskRequest request) {
        User user    = securityUtils.getCurrentUser();
        Task task    = taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));

        // Verify source ownership
        verifyTaskOwnership(task, user);

        Long srcColId = task.getColumn().getId();
        int  srcPos   = task.getPosition();
        Long dstColId = request.targetColumnId();
        int  dstPos   = request.targetPosition();

        if (srcColId.equals(dstColId)) {
            // ── Case A: same-column reorder ────────────────────────────────
            int total       = taskRepository.countByColumnId(srcColId);
            int clampedDst  = Math.min(dstPos, total - 1);

            if (srcPos == clampedDst) {
                return toResponse(task);   // no-op
            }

            if (clampedDst > srcPos) {
                // Moving down: intermediate tasks shift left
                taskRepository.shiftPositionsLeft(srcColId, srcPos, clampedDst);
            } else {
                // Moving up: intermediate tasks shift right
                taskRepository.shiftPositionsRight(srcColId, clampedDst, srcPos);
            }
            task.setPosition(clampedDst);

        } else {
            // ── Case B: cross-column move ──────────────────────────────────

            // Verify target column belongs to same user
            BoardColumn targetColumn = columnRepository.findById(dstColId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Column", dstColId));
            if (!targetColumn.getBoard().getOwner().getId().equals(user.getId())) {
                throw ResourceNotFoundException.of("Column", dstColId);
            }

            // 1. Close gap in source column
            taskRepository.shiftPositionsLeft(srcColId, srcPos, Integer.MAX_VALUE);

            // 2. Clamp dst to [0, targetCount] then open slot in target column
            int targetCount = taskRepository.countByColumnId(dstColId);
            int clampedDst  = Math.min(dstPos, targetCount);   // targetCount = valid append pos

            taskRepository.shiftPositionsRight(dstColId, clampedDst, Integer.MAX_VALUE);

            // 3. Assign task to target column at clamped position
            task.setColumn(targetColumn);
            task.setPosition(clampedDst);
        }

        return toResponse(taskRepository.save(task));
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Loads the column and verifies it belongs to the given board and user.
     * Returns the column for further use.
     */
    private BoardColumn requireColumnOwned(Long boardId, Long columnId, Long ownerId) {
        // Verify board ownership first
        boardRepository.findByIdAndOwnerId(boardId, ownerId)
                .orElseThrow(() -> ResourceNotFoundException.of("Board", boardId));

        return columnRepository.findByIdAndBoardId(columnId, boardId)
                .orElseThrow(() -> ResourceNotFoundException.of("Column", columnId));
    }

    private Task requireTask(Long columnId, Long taskId) {
        return taskRepository.findByIdAndColumnId(taskId, columnId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));
    }

    /**
     * Verifies that a task's board is owned by the given user.
     * Throws a 404 (not 403) to avoid revealing other users' resource IDs.
     */
    private void verifyTaskOwnership(Task task, User user) {
        Long boardOwnerId = task.getColumn().getBoard().getOwner().getId();
        if (!boardOwnerId.equals(user.getId())) {
            throw ResourceNotFoundException.of("Task", task.getId());
        }
    }

    private TaskResponse toResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority().name(),
                task.getDueDate(),
                task.getAssignee(),
                task.getPosition(),
                task.getColumn().getId());
    }
}
